#!/usr/bin/env node

import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  buildBundleToolAssignments,
  loadBundleDefinitions,
  loadCapabilityBundles,
  suggestCapabilityBundles,
  type BundleToolAssignment,
  type CapabilityBundle
} from "./bundles.js";
import { DEFAULT_MCP_ROOT, scanLocalServers } from "./catalog.js";
import { auditResolvedProfile, loadPolicyRules, summarizePolicyFindings } from "./policy.js";
import { buildToolCatalog, scanLocalServerTools, scanProfileServerTools, type ServerToolCatalog } from "./toolCatalog.js";
import {
  DEFAULT_PROFILE_ROOT,
  listClaudeProfiles,
  prepareProfileSwitch,
  resolveClaudeProfile,
  suggestProfile
} from "./profiles.js";

const server = new McpServer({
  name: "ellmos-controlcenter-mcp",
  version: "0.1.0-alpha.4"
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

function formatBundleTable(bundleRows: CapabilityBundle[]): string {
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

function escapeMarkdownTableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function formatToolCatalog(toolCatalog: ServerToolCatalog[]): string {
  if (toolCatalog.length === 0) {
    return "Keine MCP-Server für den Tool-Scan gefunden.";
  }

  return toolCatalog
    .map((entry) => {
      const header = [
        `## ${entry.packageName}`,
        "",
        `- Status: ${entry.status}`,
        `- Quelle: ${entry.source}${entry.profileName ? ` (${entry.profileName})` : ""}`,
        `- Transport: ${entry.transportKind}`,
        `- Tools: ${entry.toolCount ?? "-"}`,
        `- Dauer: ${entry.durationMs} ms`,
        `- Start: ${entry.command ? `${entry.command} ${entry.args.join(" ")}`.trim() : entry.url ?? "-"}`
      ];
      if (entry.error) {
        header.push(`- Fehler: ${entry.error}`);
      }
      if (entry.tools.length === 0) {
        return [...header, "", "Keine Tools gemeldet."].join("\n");
      }
      return [
        ...header,
        "",
        "| Tool | Titel | Beschreibung |",
        "|---|---|---|",
        ...entry.tools.map((tool) =>
          `| ${escapeMarkdownTableCell(tool.name)} | ${escapeMarkdownTableCell(tool.title ?? "-")} | ${escapeMarkdownTableCell(tool.description || "-")} |`
        )
      ].join("\n");
    })
    .join("\n\n");
}

function formatBundleToolAssignments(assignments: BundleToolAssignment[]): string {
  if (assignments.length === 0) {
    return "Keine Bundle-Zuordnungen berechnet.";
  }

  return assignments
    .map((assignment) => {
      const header = [
        `## ${assignment.title}`,
        "",
        `- ID: ${assignment.bundleId}`,
        `- Tools: ${assignment.toolCount}`,
        `- Keywords: ${assignment.keywords.join(", ")}`
      ];
      if (assignment.tools.length === 0) {
        return [...header, "", "Keine passenden Tools."].join("\n");
      }
      return [
        ...header,
        "",
        "| Server | Tool | Treffer | Beschreibung |",
        "|---|---|---|---|",
        ...assignment.tools.map((tool) =>
          `| ${escapeMarkdownTableCell(tool.serverName)} | ${escapeMarkdownTableCell(tool.toolName)} | ${escapeMarkdownTableCell(tool.matchedKeywords.join(", "))} | ${escapeMarkdownTableCell(tool.description || "-")} |`
        )
      ].join("\n");
    })
    .join("\n\n");
}

async function readRequestedToolCatalog(options: {
  mcpRoot?: string;
  profileName?: string;
  profileRoot?: string;
  serverName?: string;
  timeoutMs?: number;
}): Promise<{ sourceLabel: string; toolCatalog: ServerToolCatalog[] }> {
  if (options.profileName && options.profileName.trim().length > 0) {
    const profileRoot = options.profileRoot ?? DEFAULT_PROFILE_ROOT;
    return {
      sourceLabel: `Profil ${options.profileName} in ${profileRoot}`,
      toolCatalog: await scanProfileServerTools(options.profileName, profileRoot, {
        serverName: options.serverName,
        timeoutMs: options.timeoutMs
      })
    };
  }

  const mcpRoot = options.mcpRoot ?? DEFAULT_MCP_ROOT;
  return {
    sourceLabel: `Lokale MCP-Repos in ${mcpRoot}`,
    toolCatalog: await scanLocalServerTools(mcpRoot, {
      serverName: options.serverName,
      timeoutMs: options.timeoutMs
    })
  };
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
    const bundles = await loadCapabilityBundles(servers);

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
      formatBundleTable(bundles)
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
  "controlcenter_list_tools",
  {
    title: "List MCP Tools",
    description: "Startet lokale oder profildefinierte MCP-Server kontrolliert und liest deren echte Tool-Liste per MCP list_tools aus.",
    inputSchema: {
      mcpRoot: z.string().optional().describe("Optionaler MCP-Root. Standard ist der lokale ellmos-MCP-Ordner."),
      profileName: z.string().optional().describe("Optionaler Profilname. Wenn gesetzt, werden die aufgelösten Server dieses Claude-Profils gescannt."),
      profileRoot: z.string().optional().describe("Optionaler Profilordner. Standard ist ~/.claude/profiles."),
      serverName: z.string().optional().describe("Optionaler Servername, Paketname, mcpName oder Profilservername für einen gezielten Scan."),
      timeoutMs: z.number().int().positive().max(60000).optional().describe("Timeout pro Connect- und list_tools-Anfrage in Millisekunden. Standard: 5000.")
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  async ({ mcpRoot, profileName, profileRoot, serverName, timeoutMs }) => {
    const { sourceLabel, toolCatalog } = await readRequestedToolCatalog({ mcpRoot, profileName, profileRoot, serverName, timeoutMs });
    const output = [
      "# MCP-Tool-Katalog",
      "",
      `Quelle: ${sourceLabel}`,
      serverName ? `Filter: ${serverName}` : profileName ? "Filter: alle Profilserver" : "Filter: alle lokalen MCP-Server",
      "",
      formatToolCatalog(toolCatalog)
    ].join("\n");

    return { content: [{ type: "text", text: output }] };
  }
);

server.registerTool(
  "controlcenter_assign_tool_bundles",
  {
    title: "Assign Tools To Capability Bundles",
    description: "Ordnet echte MCP-Tools anhand ihrer Metadaten den ControlCenter-Capability-Bundles zu.",
    inputSchema: {
      mcpRoot: z.string().optional().describe("Optionaler MCP-Root. Standard ist der lokale ellmos-MCP-Ordner."),
      profileName: z.string().optional().describe("Optionaler Profilname. Wenn gesetzt, werden die aufgelösten Server dieses Claude-Profils gescannt."),
      profileRoot: z.string().optional().describe("Optionaler Profilordner. Standard ist ~/.claude/profiles."),
      serverName: z.string().optional().describe("Optionaler Servername für einen gezielten Scan."),
      bundleConfigPath: z.string().optional().describe("Optionaler Pfad zu einer Capability-Bundle-Konfiguration."),
      timeoutMs: z.number().int().positive().max(60000).optional().describe("Timeout pro MCP-Tool-Scan in Millisekunden. Standard: 5000.")
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  async ({ mcpRoot, profileName, profileRoot, serverName, bundleConfigPath, timeoutMs }) => {
    const [{ sourceLabel, toolCatalog }, definitions] = await Promise.all([
      readRequestedToolCatalog({ mcpRoot, profileName, profileRoot, serverName, timeoutMs }),
      loadBundleDefinitions(bundleConfigPath)
    ]);
    const assignments = buildBundleToolAssignments(toolCatalog, definitions);
    const failedCatalogs = toolCatalog.filter((entry) => entry.status !== "ok");
    const output = [
      "# Tool-Bundle-Zuordnung",
      "",
      `Quelle: ${sourceLabel}`,
      `Server-Probes: ${toolCatalog.length}`,
      `Nicht erfolgreiche Probes: ${failedCatalogs.length}`,
      "",
      formatBundleToolAssignments(assignments),
      failedCatalogs.length > 0
        ? [
          "",
          "## Probe-Hinweise",
          failedCatalogs.map((entry) => `- ${entry.packageName}: ${entry.status}${entry.error ? ` (${entry.error})` : ""}`).join("\n")
        ].join("\n")
        : ""
    ].filter(Boolean).join("\n");

    return { content: [{ type: "text", text: output }] };
  }
);

server.registerTool(
  "controlcenter_list_bundles",
  {
    title: "List Capability Bundles",
    description: "Gruppiert lokale MCP-Server in Aufgaben-Bundles wie Software, Filesystem, Automation und Control Plane.",
    inputSchema: {
      mcpRoot: z.string().optional().describe("Optionaler MCP-Root. Standard ist der lokale ellmos-MCP-Ordner."),
      bundleConfigPath: z.string().optional().describe("Optionaler Pfad zu einer Capability-Bundle-Konfiguration.")
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  async ({ mcpRoot, bundleConfigPath }) => {
    const resolvedRoot = mcpRoot ?? DEFAULT_MCP_ROOT;
    const bundles = await loadCapabilityBundles(await scanLocalServers(resolvedRoot), bundleConfigPath);
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
      mcpRoot: z.string().optional().describe("Optionaler MCP-Root. Standard ist der lokale ellmos-MCP-Ordner."),
      bundleConfigPath: z.string().optional().describe("Optionaler Pfad zu einer Capability-Bundle-Konfiguration.")
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  async ({ task, mcpRoot, bundleConfigPath }) => {
    const resolvedRoot = mcpRoot ?? DEFAULT_MCP_ROOT;
    const bundles = await loadCapabilityBundles(await scanLocalServers(resolvedRoot), bundleConfigPath);
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
      profileRoot: z.string().optional().describe("Optionaler Profilordner. Standard ist ~/.claude/profiles."),
      policyConfigPath: z.string().optional().describe("Optionaler Pfad zu einer Policy-Regel-Konfiguration.")
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  async ({ profileName, profileRoot, policyConfigPath }) => {
    const resolved = await resolveClaudeProfile(profileName, profileRoot ?? DEFAULT_PROFILE_ROOT);
    const policyRules = await loadPolicyRules(policyConfigPath);
    const findings = auditResolvedProfile(resolved, policyRules);
    const summary = summarizePolicyFindings(findings);
    const output = [
      "# Profil-Audit",
      "",
      `- Profil: ${resolved.name}`,
      `- Server: ${resolved.serverCount}`,
      `- Policy-Regeln: ${policyRules.filter((rule) => rule.enabled).length}/${policyRules.length} aktiv`,
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
      outputPath: z.string().optional().describe("Optionaler Ausgabeort für den JSON-Katalog."),
      profileName: z.string().optional().describe("Optionaler Profilname. Wenn gesetzt, werden bei includeTools zusätzlich die Profilserver gescannt."),
      profileRoot: z.string().optional().describe("Optionaler Profilordner. Standard ist ~/.claude/profiles."),
      bundleConfigPath: z.string().optional().describe("Optionaler Pfad zu einer Capability-Bundle-Konfiguration für Tool-Zuordnungen."),
      includeTools: z.boolean().default(false).describe("Wenn true, werden lokale MCP-Server gestartet und echte list_tools-Ergebnisse in den Katalog aufgenommen."),
      includeToolAssignments: z.boolean().default(false).describe("Wenn true, werden Tool-Bundle-Zuordnungen für gescannte Tools in den Katalog aufgenommen."),
      timeoutMs: z.number().int().positive().max(60000).optional().describe("Timeout pro MCP-Tool-Scan in Millisekunden. Standard: 5000.")
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  async ({ mcpRoot, outputPath, profileName, profileRoot, bundleConfigPath, includeTools, includeToolAssignments, timeoutMs }) => {
    const resolvedRoot = mcpRoot ?? DEFAULT_MCP_ROOT;
    const resolvedOutputPath = outputPath ?? path.join(PROJECT_ROOT, "data", "server-catalog.json");
    const servers = await scanLocalServers(resolvedRoot);
    const shouldScanTools = includeTools || includeToolAssignments;
    const toolCatalog = shouldScanTools ? await buildToolCatalog(servers, { timeoutMs }) : null;
    const profileToolCatalog = shouldScanTools && profileName
      ? await scanProfileServerTools(profileName, profileRoot ?? DEFAULT_PROFILE_ROOT, { timeoutMs })
      : null;
    const allToolCatalogs = [...(toolCatalog ?? []), ...(profileToolCatalog ?? [])];
    const bundleDefinitions = includeToolAssignments ? await loadBundleDefinitions(bundleConfigPath) : null;
    const payload = {
      generatedAt: new Date().toISOString(),
      mcpRoot: resolvedRoot,
      serverCount: servers.length,
      servers,
      ...(toolCatalog ? { toolCatalog } : {}),
      ...(profileToolCatalog ? { profileName, profileToolCatalog } : {}),
      ...(bundleDefinitions ? { toolBundleAssignments: buildBundleToolAssignments(allToolCatalogs, bundleDefinitions) } : {})
    };

    await fs.mkdir(path.dirname(resolvedOutputPath), { recursive: true });
    await fs.writeFile(resolvedOutputPath, JSON.stringify(payload, null, 2), "utf-8");

    const output = [
      "# Katalog erstellt",
      "",
      `- Ausgabe: ${resolvedOutputPath}`,
      `- Server: ${servers.length}`,
      `- Tool-Scan: ${shouldScanTools ? "ja" : "nein"}`,
      `- Profil-Tool-Scan: ${profileToolCatalog ? "ja" : "nein"}`,
      `- Tool-Bundle-Zuordnung: ${includeToolAssignments ? "ja" : "nein"}`
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
