#!/usr/bin/env node

import * as http from "http";
import { URL } from "url";
import { buildBundleToolAssignments, loadBundleDefinitions, loadCapabilityBundles } from "./bundles.js";
import {
  createLocalServerMcpConfig,
  DEFAULT_MCP_ROOT,
  scanLocalServers
} from "./catalog.js";
import {
  getLanguage,
  getLanguageName,
  getSupportedLanguages,
  isSupportedLanguage,
  setLanguage,
  t,
  type Lang
} from "./i18n/index.js";
import { auditResolvedProfile, loadPolicyRules, summarizePolicyFindings } from "./policy.js";
import {
  DEFAULT_PROFILE_ROOT,
  listClaudeProfiles,
  prepareProfileSwitch,
  readEditableProfile,
  resolveClaudeProfile,
  writeEditableProfile
} from "./profiles.js";
import { scanLocalServerTools, scanProfileServerTools } from "./toolCatalog.js";

const DEFAULT_HOST = process.env.ELLMOS_DASHBOARD_HOST ?? "127.0.0.1";
const DEFAULT_PORT = Number.parseInt(process.env.ELLMOS_DASHBOARD_PORT ?? "3737", 10);

class DashboardRequestError extends Error {
  constructor(message: string, readonly statusCode: number = 400) {
    super(message);
  }
}

function sendJson(response: http.ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(payload, null, 2));
}

function sendHtml(response: http.ServerResponse, html: string): void {
  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(html);
}

async function readBody(request: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf-8")) as Record<string, unknown>;
}

function requireConfirmed(body: Record<string, unknown>, action: string): void {
  if (body.confirm !== true) {
    throw new DashboardRequestError(`${action} requires confirm: true`);
  }
}

async function getOverview() {
  const [servers, profiles] = await Promise.all([
    scanLocalServers(DEFAULT_MCP_ROOT),
    listClaudeProfiles(DEFAULT_PROFILE_ROOT)
  ]);
  return {
    mcpRoot: DEFAULT_MCP_ROOT,
    profileRoot: DEFAULT_PROFILE_ROOT,
    servers,
    profiles,
    bundles: await loadCapabilityBundles(servers)
  };
}

export async function getToolBundleOverview(options: {
  scope?: "local" | "profile";
  mcpRoot?: string;
  profileName?: string;
  profileRoot?: string;
  serverName?: string;
  timeoutMs?: number;
} = {}) {
  const labels = t();
  const scope = options.scope === "local" ? "local" : "profile";
  const timeoutMs = typeof options.timeoutMs === "number" ? options.timeoutMs : undefined;
  const toolCatalog = scope === "local"
    ? await scanLocalServerTools(options.mcpRoot ?? DEFAULT_MCP_ROOT, {
      serverName: options.serverName,
      timeoutMs
    })
    : await scanProfileServerTools(
      options.profileName ?? "base",
      options.profileRoot ?? DEFAULT_PROFILE_ROOT,
      { serverName: options.serverName, timeoutMs }
    );
  const assignments = buildBundleToolAssignments(toolCatalog, await loadBundleDefinitions());
  const okServerCount = toolCatalog.filter((entry) => entry.status === "ok").length;
  const totalTools = toolCatalog.reduce((sum, entry) => sum + (entry.toolCount ?? 0), 0);

  return {
    scope,
    sourceLabel: scope === "local"
      ? labels.messages.sourceLocalRepos(options.mcpRoot ?? DEFAULT_MCP_ROOT)
      : labels.messages.sourceProfile(options.profileName ?? "base", options.profileRoot ?? DEFAULT_PROFILE_ROOT),
    serverCount: toolCatalog.length,
    okServerCount,
    issueServerCount: toolCatalog.length - okServerCount,
    totalTools,
    toolCatalog,
    assignments
  };
}

async function setServerEnabled(profileName: string, serverName: string, enabled: boolean) {
  const [servers, editable] = await Promise.all([
    scanLocalServers(DEFAULT_MCP_ROOT),
    readEditableProfile(profileName, DEFAULT_PROFILE_ROOT)
  ]);
  const localServer = servers.find((server) => server.packageName === serverName || server.directoryName === serverName);
  const mcpServers =
    typeof editable.profile.mcpServers === "object" && editable.profile.mcpServers !== null && !Array.isArray(editable.profile.mcpServers)
      ? { ...(editable.profile.mcpServers as Record<string, unknown>) }
      : {};

  if (enabled) {
    if (!localServer) {
      throw new Error(`Local MCP server not found: ${serverName}`);
    }
    mcpServers[localServer.packageName] = createLocalServerMcpConfig(localServer);
  } else {
    delete mcpServers[serverName];
  }

  const updatedProfile = { ...editable.profile, mcpServers };
  const writeResult = await writeEditableProfile(profileName, updatedProfile, DEFAULT_PROFILE_ROOT);
  const resolved = await resolveClaudeProfile(profileName, DEFAULT_PROFILE_ROOT);
  return { ...writeResult, resolved };
}

function htmlPage(lang: Lang = getLanguage()): string {
  const labels = t(lang).dashboard;
  const dashboardLabels = JSON.stringify(labels);
  const languageOptions = getSupportedLanguages()
    .map((language) => `<option value="${language}"${language === lang ? " selected" : ""}>${language} - ${getLanguageName(language)}</option>`)
    .join("");
  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ellmos ControlCenter</title>
  <style>
    :root {
      --bg: #f3f1eb;
      --ink: #20211f;
      --muted: #6c6b64;
      --line: #d6d1c4;
      --panel: #ffffff;
      --accent: #176b5d;
      --accent-2: #b94d2f;
      --warn: #936015;
      --shadow: 0 10px 24px rgba(35, 35, 30, 0.08);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: linear-gradient(140deg, #f8f6f1 0%, var(--bg) 48%, #e8efe9 100%);
      color: var(--ink);
      font: 14px/1.45 "Aptos", "Segoe UI", sans-serif;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 18px 22px;
      border-bottom: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.72);
      backdrop-filter: blur(12px);
      position: sticky;
      top: 0;
      z-index: 2;
    }
    h1, h2, h3 { margin: 0; }
    h1 { font-size: 18px; }
    h2 { font-size: 15px; }
    h3 { font-size: 13px; color: var(--muted); font-weight: 600; }
    button, select {
      border: 1px solid var(--line);
      background: var(--panel);
      color: var(--ink);
      border-radius: 6px;
      padding: 8px 10px;
      font: inherit;
    }
    button {
      cursor: pointer;
      font-weight: 650;
    }
    label.language-control {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    button.primary {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
    }
    button.danger {
      color: var(--accent-2);
    }
    input[type="number"] {
      width: 96px;
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 8px 10px;
      font: inherit;
      background: var(--panel);
      color: var(--ink);
    }
    main {
      display: grid;
      grid-template-columns: 280px 1fr;
      min-height: calc(100vh - 66px);
    }
    aside {
      border-right: 1px solid var(--line);
      padding: 18px;
      background: rgba(255, 255, 255, 0.54);
    }
    section {
      padding: 18px;
    }
    .stack { display: grid; gap: 14px; }
    .toolbar { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .panel {
      background: rgba(255, 255, 255, 0.86);
      border: 1px solid var(--line);
      border-radius: 8px;
      box-shadow: var(--shadow);
      padding: 14px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }
    .list { display: grid; gap: 8px; margin-top: 10px; }
    .row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 10px;
      align-items: center;
      padding: 10px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #fff;
    }
    .row.compact {
      grid-template-columns: 1fr;
      align-items: start;
    }
    .meta { color: var(--muted); font-size: 12px; overflow-wrap: anywhere; }
    .badge {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 2px 8px;
      background: #e9f2ee;
      color: var(--accent);
      font-size: 12px;
      font-weight: 700;
    }
    .warn { color: var(--warn); }
    pre {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      padding: 12px;
      border-radius: 6px;
      background: #20211f;
      color: #f8f6f1;
      max-height: 260px;
      overflow: auto;
    }
    @media (max-width: 860px) {
      main { grid-template-columns: 1fr; }
      aside { border-right: 0; border-bottom: 1px solid var(--line); }
      .grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>ellmos ControlCenter</h1>
      <div class="meta" id="roots">${labels.loading}</div>
    </div>
    <div class="toolbar">
      <label class="language-control"><span class="meta">${labels.language}</span><select id="language">${languageOptions}</select></label>
      <button id="refresh">${labels.refresh}</button>
      <button class="primary" id="write-config">${labels.writeConfig}</button>
    </div>
  </header>
  <main>
    <aside class="stack">
      <div class="panel stack">
        <h2>${labels.profile}</h2>
        <select id="profile"></select>
        <div id="profile-meta" class="meta"></div>
      </div>
      <div class="panel stack">
        <h2>${labels.audit}</h2>
        <div id="audit"></div>
      </div>
    </aside>
    <section class="stack">
      <div class="grid">
        <div class="panel">
          <h2>${labels.localServers}</h2>
          <div id="servers" class="list"></div>
        </div>
        <div class="panel">
          <h2>${labels.capabilityBundles}</h2>
          <div id="bundles" class="list"></div>
        </div>
      </div>
      <div class="panel stack">
        <div class="toolbar">
          <h2>${labels.toolCatalog}</h2>
          <select id="tool-scope">
            <option value="profile">${labels.toolScopeProfile}</option>
            <option value="local">${labels.toolScopeLocal}</option>
          </select>
          <input id="tool-timeout" type="number" min="500" max="60000" step="500" value="5000" aria-label="${labels.timeoutLabel}">
          <button id="scan-tools">${labels.scan}</button>
        </div>
        <div id="tool-summary" class="meta">${labels.noToolScan}</div>
        <div id="tool-catalog" class="list"></div>
      </div>
      <div class="panel">
        <h2>${labels.toolBundleAssignment}</h2>
        <div id="tool-assignments" class="list"></div>
      </div>
      <div class="panel">
        <h2>${labels.generatedConfig}</h2>
        <pre id="output">${labels.noAction}</pre>
      </div>
    </section>
  </main>
  <script>
    let overview = null;
    let selectedProfile = "";
    const L = ${dashboardLabels};

    function escapeHtml(value) {
      return String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[char]);
    }

    async function api(path, options = {}) {
      const response = await fetch(path, {
        headers: { "content-type": "application/json" },
        ...options
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || L.apiError);
      return data;
    }

    function currentProfileSummary() {
      return overview.profiles.find((profile) => profile.name === selectedProfile);
    }

    async function loadOverview() {
      overview = await api("/api/overview");
      if (!selectedProfile && overview.profiles.length > 0) {
        selectedProfile = overview.profiles[0].name;
      }
      render();
      await loadProfileDetails();
    }

    function render() {
      document.getElementById("roots").textContent = overview.mcpRoot + " | " + overview.profileRoot;
      const profileSelect = document.getElementById("profile");
      profileSelect.innerHTML = overview.profiles.map((profile) => '<option value="' + profile.name + '">' + profile.name + '</option>').join("");
      profileSelect.value = selectedProfile;
      const profile = currentProfileSummary();
      document.getElementById("profile-meta").textContent = profile ? profile.serverCount + " " + L.localServers + " | " + profile.filePath : "";

      const profileServers = new Set(profile ? profile.servers : []);
      document.getElementById("servers").innerHTML = overview.servers.map((server) => {
        const checked = profileServers.has(server.packageName) ? "checked" : "";
        return '<div class="row"><div><strong>' + server.packageName + '</strong><div class="meta">' +
          (server.description || L.noDescription) + '</div><div class="meta">' + server.absolutePath +
          '</div></div><label><input type="checkbox" data-server="' + server.packageName + '" ' + checked + '> ' + L.active + '</label></div>';
      }).join("");

      document.getElementById("bundles").innerHTML = overview.bundles.map((bundle) => {
        return '<div class="row"><div><strong>' + bundle.title + '</strong><div class="meta">' +
          bundle.description + '</div><div class="meta">' + (bundle.servers.join(", ") || "-") +
          '</div></div><span class="badge">' + bundle.serverCount + '</span></div>';
      }).join("");

      document.querySelectorAll("[data-server]").forEach((input) => {
        input.addEventListener("change", async (event) => {
          const checkbox = event.target;
          const verb = checkbox.checked ? L.enableVerb : L.disableVerb;
          if (!confirm(L.confirmServerPrefix + checkbox.dataset.server + L.confirmServerMiddle + selectedProfile + "': " + verb + L.confirmServerSuffix)) {
            checkbox.checked = !checkbox.checked;
            return;
          }
          try {
            await api("/api/profiles/" + selectedProfile + "/servers/" + checkbox.dataset.server, {
              method: "POST",
              body: JSON.stringify({ enabled: checkbox.checked, confirm: true })
            });
            await loadOverview();
          } catch (error) {
            checkbox.checked = !checkbox.checked;
            throw error;
          }
        });
      });
    }

    async function loadProfileDetails() {
      if (!selectedProfile) return;
      const details = await api("/api/profiles/" + selectedProfile);
      const summary = details.auditSummary;
      document.getElementById("audit").innerHTML =
        '<div><span class="badge">' + summary.high + ' ' + L.high + '</span> <span class="badge">' +
        summary.warning + ' ' + L.warning + '</span> <span class="badge">' + summary.info + ' ' + L.info + '</span></div>' +
        '<div class="meta">' + details.resolved.serverCount + ' ' + L.resolvedServers + '</div>';
    }

    function renderToolScan(data) {
      document.getElementById("tool-summary").textContent =
        data.sourceLabel + " | " + data.totalTools + " Tools | " +
        data.okServerCount + "/" + data.serverCount + " " + L.serverOk;

      document.getElementById("tool-catalog").innerHTML = data.toolCatalog.map((server) => {
        const tools = server.tools.length > 0
          ? '<div class="meta">' + server.tools.slice(0, 8).map((tool) => escapeHtml(tool.name)).join(", ") +
            (server.tools.length > 8 ? " +" + (server.tools.length - 8) : "") + '</div>'
          : '<div class="meta">' + escapeHtml(server.error || L.noToolsReported) + '</div>';
        return '<div class="row"><div><strong>' + escapeHtml(server.packageName) +
          '</strong><div class="meta">' + escapeHtml(server.source) + " | " + escapeHtml(server.transportKind) +
          " | " + escapeHtml(server.status) + '</div>' + tools +
          '</div><span class="badge">' + (server.toolCount ?? 0) + '</span></div>';
      }).join("");

      document.getElementById("tool-assignments").innerHTML = data.assignments.map((bundle) => {
        const toolList = bundle.tools.length > 0
          ? bundle.tools.slice(0, 10).map((tool) =>
            '<div class="meta">' + escapeHtml(tool.serverName) + " | " + escapeHtml(tool.toolName) +
            " (" + escapeHtml(tool.matchedKeywords.join(", ")) + ")</div>"
          ).join("")
          : '<div class="meta">' + L.noMatchingTools + '</div>';
        return '<div class="row compact"><div><strong>' + escapeHtml(bundle.title) +
          '</strong> <span class="badge">' + bundle.toolCount + '</span>' + toolList + '</div></div>';
      }).join("");
    }

    document.getElementById("profile").addEventListener("change", async (event) => {
      selectedProfile = event.target.value;
      render();
      await loadProfileDetails();
    });
    document.getElementById("language").addEventListener("change", async (event) => {
      const language = event.target.value;
      await api("/api/language", {
        method: "POST",
        body: JSON.stringify({ language })
      });
      window.location.search = "?lang=" + encodeURIComponent(language);
    });
    document.getElementById("refresh").addEventListener("click", loadOverview);
    document.getElementById("write-config").addEventListener("click", async () => {
      if (!confirm(L.confirmWritePrefix + selectedProfile + L.confirmWriteSuffix)) return;
      const result = await api("/api/profiles/" + selectedProfile + "/generated-config", {
        method: "POST",
        body: JSON.stringify({ write: true, confirm: true })
      });
      document.getElementById("output").textContent = JSON.stringify(result, null, 2);
    });
    document.getElementById("scan-tools").addEventListener("click", async () => {
      const scope = document.getElementById("tool-scope").value;
      const timeoutMs = Number.parseInt(document.getElementById("tool-timeout").value || "5000", 10);
      document.getElementById("tool-summary").textContent = L.scanRunning;
      document.getElementById("tool-catalog").innerHTML = "";
      document.getElementById("tool-assignments").innerHTML = "";
      const result = await api("/api/tool-bundles", {
        method: "POST",
        body: JSON.stringify({ scope, profileName: selectedProfile, timeoutMs })
      });
      renderToolScan(result);
      document.getElementById("output").textContent = JSON.stringify({
        sourceLabel: result.sourceLabel,
        serverCount: result.serverCount,
        totalTools: result.totalTools,
        bundles: result.assignments.map((bundle) => ({ id: bundle.bundleId, tools: bundle.toolCount }))
      }, null, 2);
    });

    loadOverview().catch((error) => {
      document.getElementById("output").textContent = error.stack || String(error);
    });
  </script>
</body>
</html>`;
}

async function handleApi(request: http.IncomingMessage, response: http.ServerResponse, url: URL): Promise<void> {
  if (request.method === "GET" && url.pathname === "/api/language") {
    const language = getLanguage();
    sendJson(response, 200, {
      language,
      languageName: getLanguageName(language),
      supportedLanguages: getSupportedLanguages().map((item) => ({
        code: item,
        name: getLanguageName(item)
      }))
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/language") {
    const body = await readBody(request);
    if (typeof body.language !== "string" || !isSupportedLanguage(body.language)) {
      throw new DashboardRequestError(`Unsupported language: ${String(body.language)}`);
    }
    const language = setLanguage(body.language);
    sendJson(response, 200, {
      language,
      languageName: getLanguageName(language)
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/overview") {
    sendJson(response, 200, await getOverview());
    return;
  }

  const profileMatch = url.pathname.match(/^\/api\/profiles\/([^/]+)$/);
  if (request.method === "GET" && profileMatch) {
    const profileName = decodeURIComponent(profileMatch[1]);
    const resolved = await resolveClaudeProfile(profileName, DEFAULT_PROFILE_ROOT);
    const policyRules = await loadPolicyRules();
    const findings = auditResolvedProfile(resolved, policyRules);
    sendJson(response, 200, {
      resolved,
      policyRules,
      auditSummary: summarizePolicyFindings(findings),
      findings
    });
    return;
  }

  const generatedConfigMatch = url.pathname.match(/^\/api\/profiles\/([^/]+)\/generated-config$/);
  if (request.method === "POST" && generatedConfigMatch) {
    const profileName = decodeURIComponent(generatedConfigMatch[1]);
    const body = await readBody(request);
    if (body.write === true) {
      requireConfirmed(body, "Writing generated MCP config");
    }
    sendJson(response, 200, await prepareProfileSwitch(profileName, {
      write: body.write === true,
      outputPath: typeof body.outputPath === "string" ? body.outputPath : undefined
    }));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/tool-bundles") {
    const body = await readBody(request);
    sendJson(response, 200, await getToolBundleOverview({
      scope: body.scope === "local" ? "local" : "profile",
      profileName: typeof body.profileName === "string" ? body.profileName : undefined,
      serverName: typeof body.serverName === "string" ? body.serverName : undefined,
      timeoutMs: typeof body.timeoutMs === "number" ? body.timeoutMs : undefined
    }));
    return;
  }

  const serverToggleMatch = url.pathname.match(/^\/api\/profiles\/([^/]+)\/servers\/([^/]+)$/);
  if (request.method === "POST" && serverToggleMatch) {
    const profileName = decodeURIComponent(serverToggleMatch[1]);
    const serverName = decodeURIComponent(serverToggleMatch[2]);
    const body = await readBody(request);
    requireConfirmed(body, "Changing profile server activation");
    sendJson(response, 200, await setServerEnabled(profileName, serverName, body.enabled === true));
    return;
  }

  sendJson(response, 404, { error: "Not found" });
}

export function createDashboardServer(): http.Server {
  return http.createServer((request, response) => {
    void (async () => {
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
      if (url.pathname === "/") {
        const requestedLanguage = url.searchParams.get("lang");
        const pageLanguage = requestedLanguage && isSupportedLanguage(requestedLanguage) ? requestedLanguage : getLanguage();
        sendHtml(response, htmlPage(pageLanguage));
        return;
      }
      if (url.pathname.startsWith("/api/")) {
        await handleApi(request, response, url);
        return;
      }
      sendJson(response, 404, { error: "Not found" });
    })().catch((error) => {
      const statusCode = error instanceof DashboardRequestError ? error.statusCode : 500;
      sendJson(response, statusCode, { error: error instanceof Error ? error.message : String(error) });
    });
  });
}

if (process.argv[1]?.endsWith("dashboard.js")) {
  const server = createDashboardServer();
  server.listen(DEFAULT_PORT, DEFAULT_HOST, () => {
    console.log(`ellmos ControlCenter Dashboard: http://${DEFAULT_HOST}:${DEFAULT_PORT}`);
  });
}
