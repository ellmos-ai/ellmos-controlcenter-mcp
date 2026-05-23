#!/usr/bin/env node

import * as http from "http";
import { URL } from "url";
import { buildCapabilityBundles } from "./bundles.js";
import {
  createLocalServerMcpConfig,
  DEFAULT_MCP_ROOT,
  scanLocalServers
} from "./catalog.js";
import { auditResolvedProfile, summarizePolicyFindings } from "./policy.js";
import {
  DEFAULT_PROFILE_ROOT,
  listClaudeProfiles,
  prepareProfileSwitch,
  readEditableProfile,
  resolveClaudeProfile,
  writeEditableProfile
} from "./profiles.js";

const DEFAULT_HOST = process.env.ELLMOS_DASHBOARD_HOST ?? "127.0.0.1";
const DEFAULT_PORT = Number.parseInt(process.env.ELLMOS_DASHBOARD_PORT ?? "3737", 10);

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
    bundles: buildCapabilityBundles(servers)
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
  const filePath = await writeEditableProfile(profileName, updatedProfile, DEFAULT_PROFILE_ROOT);
  const resolved = await resolveClaudeProfile(profileName, DEFAULT_PROFILE_ROOT);
  return { filePath, resolved };
}

function htmlPage(): string {
  return `<!doctype html>
<html lang="de">
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
    button.primary {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
    }
    button.danger {
      color: var(--accent-2);
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
      <div class="meta" id="roots">lädt...</div>
    </div>
    <div class="toolbar">
      <button id="refresh">Aktualisieren</button>
      <button class="primary" id="write-config">MCP-Config erzeugen</button>
    </div>
  </header>
  <main>
    <aside class="stack">
      <div class="panel stack">
        <h2>Profil</h2>
        <select id="profile"></select>
        <div id="profile-meta" class="meta"></div>
      </div>
      <div class="panel stack">
        <h2>Audit</h2>
        <div id="audit"></div>
      </div>
    </aside>
    <section class="stack">
      <div class="grid">
        <div class="panel">
          <h2>Lokale Server</h2>
          <div id="servers" class="list"></div>
        </div>
        <div class="panel">
          <h2>Capability-Bundles</h2>
          <div id="bundles" class="list"></div>
        </div>
      </div>
      <div class="panel">
        <h2>Generierte Konfiguration</h2>
        <pre id="output">Noch keine Aktion ausgeführt.</pre>
      </div>
    </section>
  </main>
  <script>
    let overview = null;
    let selectedProfile = "";

    async function api(path, options = {}) {
      const response = await fetch(path, {
        headers: { "content-type": "application/json" },
        ...options
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "API-Fehler");
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
      document.getElementById("roots").textContent = overview.mcpRoot + " · " + overview.profileRoot;
      const profileSelect = document.getElementById("profile");
      profileSelect.innerHTML = overview.profiles.map((profile) => '<option value="' + profile.name + '">' + profile.name + '</option>').join("");
      profileSelect.value = selectedProfile;
      const profile = currentProfileSummary();
      document.getElementById("profile-meta").textContent = profile ? profile.serverCount + " Server · " + profile.filePath : "";

      const profileServers = new Set(profile ? profile.servers : []);
      document.getElementById("servers").innerHTML = overview.servers.map((server) => {
        const checked = profileServers.has(server.packageName) ? "checked" : "";
        return '<div class="row"><div><strong>' + server.packageName + '</strong><div class="meta">' +
          (server.description || "Keine Beschreibung") + '</div><div class="meta">' + server.absolutePath +
          '</div></div><label><input type="checkbox" data-server="' + server.packageName + '" ' + checked + '> aktiv</label></div>';
      }).join("");

      document.getElementById("bundles").innerHTML = overview.bundles.map((bundle) => {
        return '<div class="row"><div><strong>' + bundle.title + '</strong><div class="meta">' +
          bundle.description + '</div><div class="meta">' + (bundle.servers.join(", ") || "-") +
          '</div></div><span class="badge">' + bundle.serverCount + '</span></div>';
      }).join("");

      document.querySelectorAll("[data-server]").forEach((input) => {
        input.addEventListener("change", async (event) => {
          const checkbox = event.target;
          await api("/api/profiles/" + selectedProfile + "/servers/" + checkbox.dataset.server, {
            method: "POST",
            body: JSON.stringify({ enabled: checkbox.checked })
          });
          await loadOverview();
        });
      });
    }

    async function loadProfileDetails() {
      if (!selectedProfile) return;
      const details = await api("/api/profiles/" + selectedProfile);
      const summary = details.auditSummary;
      document.getElementById("audit").innerHTML =
        '<div><span class="badge">' + summary.high + ' high</span> <span class="badge">' +
        summary.warning + ' warning</span> <span class="badge">' + summary.info + ' info</span></div>' +
        '<div class="meta">' + details.resolved.serverCount + ' aufgelöste Server</div>';
    }

    document.getElementById("profile").addEventListener("change", async (event) => {
      selectedProfile = event.target.value;
      render();
      await loadProfileDetails();
    });
    document.getElementById("refresh").addEventListener("click", loadOverview);
    document.getElementById("write-config").addEventListener("click", async () => {
      const result = await api("/api/profiles/" + selectedProfile + "/generated-config", {
        method: "POST",
        body: JSON.stringify({ write: true })
      });
      document.getElementById("output").textContent = JSON.stringify(result, null, 2);
    });

    loadOverview().catch((error) => {
      document.getElementById("output").textContent = error.stack || String(error);
    });
  </script>
</body>
</html>`;
}

async function handleApi(request: http.IncomingMessage, response: http.ServerResponse, url: URL): Promise<void> {
  if (request.method === "GET" && url.pathname === "/api/overview") {
    sendJson(response, 200, await getOverview());
    return;
  }

  const profileMatch = url.pathname.match(/^\/api\/profiles\/([^/]+)$/);
  if (request.method === "GET" && profileMatch) {
    const profileName = decodeURIComponent(profileMatch[1]);
    const resolved = await resolveClaudeProfile(profileName, DEFAULT_PROFILE_ROOT);
    const findings = auditResolvedProfile(resolved);
    sendJson(response, 200, {
      resolved,
      auditSummary: summarizePolicyFindings(findings),
      findings
    });
    return;
  }

  const generatedConfigMatch = url.pathname.match(/^\/api\/profiles\/([^/]+)\/generated-config$/);
  if (request.method === "POST" && generatedConfigMatch) {
    const profileName = decodeURIComponent(generatedConfigMatch[1]);
    const body = await readBody(request);
    sendJson(response, 200, await prepareProfileSwitch(profileName, {
      write: body.write === true,
      outputPath: typeof body.outputPath === "string" ? body.outputPath : undefined
    }));
    return;
  }

  const serverToggleMatch = url.pathname.match(/^\/api\/profiles\/([^/]+)\/servers\/([^/]+)$/);
  if (request.method === "POST" && serverToggleMatch) {
    const profileName = decodeURIComponent(serverToggleMatch[1]);
    const serverName = decodeURIComponent(serverToggleMatch[2]);
    const body = await readBody(request);
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
        sendHtml(response, htmlPage());
        return;
      }
      if (url.pathname.startsWith("/api/")) {
        await handleApi(request, response, url);
        return;
      }
      sendJson(response, 404, { error: "Not found" });
    })().catch((error) => {
      sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) });
    });
  });
}

if (process.argv[1]?.endsWith("dashboard.js")) {
  const server = createDashboardServer();
  server.listen(DEFAULT_PORT, DEFAULT_HOST, () => {
    console.log(`ellmos ControlCenter Dashboard: http://${DEFAULT_HOST}:${DEFAULT_PORT}`);
  });
}
