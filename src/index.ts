#!/usr/bin/env node

import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { buildCapabilityBundles, suggestCapabilityBundles } from "./bundles.js";
import { DEFAULT_MCP_ROOT, scanLocalServers } from "./catalog.js";
import { auditResolvedProfile, summarizePolicyFindings } from "./policy.js";
import {
  DEFAULT_PROFILE_ROOT,
  listClaudeProfiles,
  prepareProfileSwitch,
  resolveClaudeProfile,
  suggestProfile
} from "./profiles.js";

const server = new McpServer({
  name: "ellmos-controlcenter-mcp",
  version: "0.1.0"
});

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function formatServerTable(serverRows: Awaited<ReturnType<typeof scanLocalServers>>): string {
  if (serverRows.length === 0) {
    return "Keine lokalen MCP-Server gefunden.";
  }

  const lines = [
    "| Repo | Version | Tools | server.json | Pfad |",
    "|---|---:|---:|---|---|"
  ];

  for (const row of serverRows) {
    lines.push(
      `| ${row.directoryName} | ${row.version ?? "-"} | ${row.toolCount ?? "-"} | ${row.hasServerJson ? "ja" : "nein"} | ${row.absolutePath} |`
    );
  }

  return lines.join("\n");
}

function formatProfileTable(profileRows: Awaited<ReturnType<typeof listClaudeProfiles>>): string {
  if (profileRows.length === 0) {
    return "Keine Claude-Profile gefunden.";
  }

  const lines = [
    "| Profil | Erweitert | Server | Datei |",
    "|---|---|---:|---|"
  ];

  for (const row of profileRows) {
    const extendsLabel = row.extendsProfiles.length > 0 ? row.extendsProfiles.join(", ") : "-";
    lines.push(
      `| ${row.name} | ${extendsLabel} | ${row.serverCount} | ${row.filePath} |`
    );
  }

  return lines.join("\n");
}

function formatBundleTable(bundleRows: ReturnType<typeof buildCapabilityBundles>): string {
  if (bundleRows.length === 0) {
    return "Keine Capability-Bundles verfügbar.";
  }

  const lines = [
    "| Bundle | Server | Tools | Beschreibung |",
    "|---|---:|---:|---|"
  ];

  for (const row of bundleRows) {
    lines.push(
      `| ${row.id} | ${row.serverCount} | ${row.totalTools ?? "-"} | ${row.description} |`
    );
  }

  return lines.join("\n");
}

server.registerTool(
  "controlcenter_status",
  {
    title: "ControlCenter Status",
    description: "Zeigt einen Überblick über den lokalen MCP-Stack, lokale Server und Claude-Profile.",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  async () => {
    const [servers, profiles] = await Promise.all([
      scanLocalServers(DEFAULT_MCP_ROOT),
      listClaudeProfiles(DEFAULT_PROFILE_ROOT)
    ]);

    const output = [
      "# ellmos ControlCenter Status",
      "",
      `- MCP-Root: ${DEFAULT_MCP_ROOT}`,
      `- Profil-Root: ${DEFAULT_PROFILE_ROOT}`,
      `- Lokale MCP-Repos: ${servers.length}`,
      `- Claude-Profile: ${profiles.length}`,
      "",
      "## Lokale MCP-Repos",
      formatServerTable(servers),
      "",
      "## Claude-Profile",
      formatProfileTable(profiles),
      "",
      "## Capability-Bundles",
      formatBundleTable(buildCapabilityBundles(servers))
    ].join("\n");

    return { content: [{ type: "text", text: output }] };
  }
);

server.registerTool(
  "controlcenter_list_local_servers",
  {
    title: "List Local MCP Servers",
    description: "Scannt den lokalen MCP-Root und listet gefundene MCP-Repos mit Metadaten auf.",
    inputSchema: {
      mcpRoot: z.string().optional().describe("Optionaler MCP-Root. Standard ist der lokale ellmos-MCP-Ordner.")
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  async ({ mcpRoot }) => {
    const resolvedRoot = mcpRoot ?? DEFAULT_MCP_ROOT;
    const servers = await scanLocalServers(resolvedRoot);

    const output = [
      `# Lokale MCP-Server in ${resolvedRoot}`,
      "",
      formatServerTable(servers)
    ].join("\n");

    return { content: [{ type: "text", text: output }] };
  }
);

server.registerTool(
  "controlcenter_list_bundles",
  {
    title: "List Capability Bundles",
    description: "Gruppiert lokale MCP-Server in Aufgaben-Bundles wie Software, Filesystem, Automation und Control Plane.",
    inputSchema: {
      mcpRoot: z.string().optional().describe("Optionaler MCP-Root. Standard ist der lokale ellmos-MCP-Ordner.")
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  async ({ mcpRoot }) => {
    const resolvedRoot = mcpRoot ?? DEFAULT_MCP_ROOT;
    const bundles = buildCapabilityBundles(await scanLocalServers(resolvedRoot));
    const output = [
      `# Capability-Bundles in ${resolvedRoot}`,
      "",
      formatBundleTable(bundles),
      "",
      "## Details",
      bundles
        .map((bundle) => [
          `### ${bundle.title}`,
          "",
          `- ID: ${bundle.id}`,
          `- Server: ${bundle.servers.length > 0 ? bundle.servers.join(", ") : "-"}`,
          `- Keywords: ${bundle.keywords.join(", ")}`
        ].join("\n"))
        .join("\n\n")
    ].join("\n");

    return { content: [{ type: "text", text: output }] };
  }
);

server.registerTool(
  "controlcenter_suggest_bundles",
  {
    title: "Suggest Capability Bundles",
    description: "Empfiehlt passende Capability-Bundles für eine Aufgabenbeschreibung.",
    inputSchema: {
      task: z.string().min(3).describe("Aufgabenbeschreibung oder Ziel der Session"),
      mcpRoot: z.string().optional().describe("Optionaler MCP-Root. Standard ist der lokale ellmos-MCP-Ordner.")
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  async ({ task, mcpRoot }) => {
    const resolvedRoot = mcpRoot ?? DEFAULT_MCP_ROOT;
    const bundles = buildCapabilityBundles(await scanLocalServers(resolvedRoot));
    const suggestions = suggestCapabilityBundles(task, bundles);
    const output = [
      "# Bundle-Empfehlung",
      "",
      suggestions.length > 0
        ? suggestions.map((suggestion) => [
          `## ${suggestion.bundle.title}`,
          "",
          `- ID: ${suggestion.bundle.id}`,
          `- Score: ${suggestion.score}`,
          `- Keywords: ${suggestion.matchedKeywords.join(", ")}`,
          `- Server: ${suggestion.bundle.servers.length > 0 ? suggestion.bundle.servers.join(", ") : "-"}`
        ].join("\n")).join("\n\n")
        : "Keine starken Bundle-Treffer erkannt."
    ].join("\n");

    return { content: [{ type: "text", text: output }] };
  }
);

server.registerTool(
  "controlcenter_list_profiles",
  {
    title: "List Claude Profiles",
    description: "Liest die lokalen Claude-Profile und zeigt Serveranzahl, Vererbung und Dateipfade.",
    inputSchema: {
      profileRoot: z.string().optional().describe("Optionaler Profilordner. Standard ist ~/.claude/profiles.")
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  async ({ profileRoot }) => {
    const resolvedRoot = profileRoot ?? DEFAULT_PROFILE_ROOT;
    const profiles = await listClaudeProfiles(resolvedRoot);

    const output = [
      `# Claude-Profile in ${resolvedRoot}`,
      "",
      formatProfileTable(profiles)
    ].join("\n");

    return { content: [{ type: "text", text: output }] };
  }
);

server.registerTool(
  "controlcenter_suggest_profile",
  {
    title: "Suggest Profile",
    description: "Empfiehlt ein Claude-Profil anhand der Aufgabenbeschreibung.",
    inputSchema: {
      task: z.string().min(3).describe("Aufgabenbeschreibung oder Ziel der Session")
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  async ({ task }) => {
    const suggestion = suggestProfile(task);
    const output = [
      "# Profilempfehlung",
      "",
      `- Empfehlung: ${suggestion.profile}`,
      `- Score: ${suggestion.score}`,
      `- Begründung: ${suggestion.rationale}`,
      `- Keywords: ${suggestion.matchedKeywords.length > 0 ? suggestion.matchedKeywords.join(", ") : "-"}`
    ].join("\n");

    return { content: [{ type: "text", text: output }] };
  }
);

server.registerTool(
  "controlcenter_resolve_profile",
  {
    title: "Resolve Claude Profile",
    description: "Löst ein Claude-Profil inklusive optionaler Vererbung auf und zeigt die resultierenden MCP-Server.",
    inputSchema: {
      profileName: z.string().min(1).describe("Profilname ohne .json, zum Beispiel software oder ai-lab"),
      profileRoot: z.string().optional().describe("Optionaler Profilordner. Standard ist ~/.claude/profiles.")
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  async ({ profileName, profileRoot }) => {
    const resolved = await resolveClaudeProfile(profileName, profileRoot ?? DEFAULT_PROFILE_ROOT);
    const output = [
      "# Aufgelöstes Profil",
      "",
      `- Profil: ${resolved.name}`,
      `- Server: ${resolved.serverCount}`,
      `- Quellen: ${resolved.sourceFiles.join(", ")}`,
      "",
      "## MCP-Server",
      resolved.servers.length > 0 ? resolved.servers.map((name) => `- ${name}`).join("\n") : "-"
    ].join("\n");

    return { content: [{ type: "text", text: output }] };
  }
);

server.registerTool(
  "controlcenter_switch_profile",
  {
    title: "Prepare Profile Switch",
    description: "Bereitet einen Profilwechsel vor, indem ein aufgelöstes --mcp-config-File erzeugt oder als Vorschau angezeigt wird.",
    inputSchema: {
      profileName: z.string().min(1).describe("Profilname ohne .json, zum Beispiel software oder ai-lab"),
      profileRoot: z.string().optional().describe("Optionaler Profilordner. Standard ist ~/.claude/profiles."),
      outputPath: z.string().optional().describe("Optionaler Ausgabeort für die generierte MCP-Config."),
      write: z.boolean().default(false).describe("Wenn true, wird die generierte Config geschrieben. Sonst nur Vorschau.")
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  async ({ profileName, profileRoot, outputPath, write }) => {
    const plan = await prepareProfileSwitch(profileName, {
      profileRoot: profileRoot ?? DEFAULT_PROFILE_ROOT,
      outputPath,
      write
    });
    const output = [
      "# Profilwechsel vorbereitet",
      "",
      `- Profil: ${plan.name}`,
      `- Server: ${plan.serverCount}`,
      `- Ausgabe: ${plan.outputPath}`,
      `- Geschrieben: ${plan.written ? "ja" : "nein"}`,
      `- Startbefehl: ${plan.command}`,
      "",
      "## MCP-Server",
      plan.servers.length > 0 ? plan.servers.map((name) => `- ${name}`).join("\n") : "-"
    ].join("\n");

    return { content: [{ type: "text", text: output }] };
  }
);

server.registerTool(
  "controlcenter_audit_profile",
  {
    title: "Audit Claude Profile",
    description: "Prüft ein aufgelöstes Claude-Profil auf erste Policy-Hinweise wie npx-Starts, Env-Secrets und ungültige Server-Konfigurationen.",
    inputSchema: {
      profileName: z.string().min(1).describe("Profilname ohne .json, zum Beispiel software oder ai-lab"),
      profileRoot: z.string().optional().describe("Optionaler Profilordner. Standard ist ~/.claude/profiles.")
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  async ({ profileName, profileRoot }) => {
    const resolved = await resolveClaudeProfile(profileName, profileRoot ?? DEFAULT_PROFILE_ROOT);
    const findings = auditResolvedProfile(resolved);
    const summary = summarizePolicyFindings(findings);
    const output = [
      "# Profil-Audit",
      "",
      `- Profil: ${resolved.name}`,
      `- Server: ${resolved.serverCount}`,
      `- High: ${summary.high}`,
      `- Warning: ${summary.warning}`,
      `- Info: ${summary.info}`,
      "",
      "## Findings",
      findings
        .map((finding) => [
          `### ${finding.ruleId}`,
          "",
          `- Severity: ${finding.severity}`,
          `- Server: ${finding.serverName}`,
          `- Hinweis: ${finding.message}`,
          `- Details: ${JSON.stringify(finding.details)}`
        ].join("\n"))
        .join("\n\n")
    ].join("\n");

    return { content: [{ type: "text", text: output }] };
  }
);

server.registerTool(
  "controlcenter_build_catalog",
  {
    title: "Build Local Server Catalog",
    description: "Erzeugt einen JSON-Katalog der lokal gefundenen MCP-Server.",
    inputSchema: {
      mcpRoot: z.string().optional().describe("Optionaler MCP-Root für den Scan."),
      outputPath: z.string().optional().describe("Optionaler Ausgabeort für den JSON-Katalog.")
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  async ({ mcpRoot, outputPath }) => {
    const resolvedRoot = mcpRoot ?? DEFAULT_MCP_ROOT;
    const resolvedOutputPath = outputPath ?? path.join(PROJECT_ROOT, "data", "server-catalog.json");
    const servers = await scanLocalServers(resolvedRoot);
    const payload = {
      generatedAt: new Date().toISOString(),
      mcpRoot: resolvedRoot,
      serverCount: servers.length,
      servers
    };

    await fs.mkdir(path.dirname(resolvedOutputPath), { recursive: true });
    await fs.writeFile(resolvedOutputPath, JSON.stringify(payload, null, 2), "utf-8");

    const output = [
      "# Katalog erstellt",
      "",
      `- Ausgabe: ${resolvedOutputPath}`,
      `- Server: ${servers.length}`
    ].join("\n");

    return { content: [{ type: "text", text: output }] };
  }
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Failed to start ellmos-controlcenter-mcp:", error);
  process.exit(1);
});
