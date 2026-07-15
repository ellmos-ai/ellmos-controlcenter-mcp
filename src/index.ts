#!/usr/bin/env node

import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
// @ts-expect-error update-notifier (v7, ESM) liefert keine eigenen Typdeklarationen
import updateNotifier from "update-notifier";
import { createRequire } from "node:module";
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
import { DEFAULT_STACKS_ROOT, describeStack, scanStacks, type StackSummary } from "./stacks.js";
import { DEFAULT_PLUGINS_ROOT, DEFAULT_MODULES_ROOT, scanInstalledPlugins, scanModules, scanPluginsAndModules, type PluginSummary } from "./plugins.js";
import { DEFAULT_SKILLS_ROOT, DEFAULT_SOURCE_SKILLS_ROOT, scanSkills, type SkillSummary } from "./skills.js";
import { findSkills, type SkillMatch } from "./skillFinder.js";
import {
  describeSupportedLanguages,
  getLanguage,
  getLanguageName,
  getSupportedLanguages,
  setLanguage,
  SUPPORTED_LANGUAGES,
  t,
  type Lang
} from "./i18n/index.js";
import { auditResolvedProfile, loadPolicyRules, summarizePolicyFindings } from "./policy.js";
import { buildToolCatalog, scanLocalServerTools, scanProfileServerTools, type ServerToolCatalog } from "./toolCatalog.js";
import {
  DEFAULT_PROFILE_ROOT,
  listMcpProfiles,
  prepareProfileSwitch,
  resolveMcpProfile,
  suggestProfile
} from "./profiles.js";

const server = new McpServer({
  name: "ellmos-controlcenter-mcp",
  version: "0.1.0-alpha.8"
});

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function formatServerTable(serverRows: Awaited<ReturnType<typeof scanLocalServers>>): string {
  const labels = t();
  if (serverRows.length === 0) {
    return labels.common.noLocalServers;
  }

  const lines = [
    `| ${labels.tables.server.repo} | ${labels.tables.server.version} | ${labels.tables.server.tools} | ${labels.tables.server.serverJson} | ${labels.tables.server.path} |`,
    "|---|---:|---:|---|---|"
  ];

  for (const row of serverRows) {
    lines.push(
      `| ${row.directoryName} | ${row.version ?? labels.common.notAvailable} | ${row.toolCount ?? labels.common.notAvailable} | ${row.hasServerJson ? labels.common.yes : labels.common.no} | ${row.absolutePath} |`
    );
  }

  return lines.join("\n");
}

function formatProfileTable(profileRows: Awaited<ReturnType<typeof listMcpProfiles>>): string {
  const labels = t();
  if (profileRows.length === 0) {
    return labels.common.noProfiles;
  }

  const lines = [
    `| ${labels.tables.profile.profile} | ${labels.tables.profile.extends} | ${labels.tables.profile.server} | ${labels.tables.profile.file} |`,
    "|---|---|---:|---|"
  ];

  for (const row of profileRows) {
    const extendsLabel = row.extendsProfiles.length > 0 ? row.extendsProfiles.join(", ") : labels.common.none;
    lines.push(
      `| ${row.name} | ${extendsLabel} | ${row.serverCount} | ${row.filePath} |`
    );
  }

  return lines.join("\n");
}

function formatBundleTable(bundleRows: CapabilityBundle[]): string {
  const labels = t();
  if (bundleRows.length === 0) {
    return labels.common.noBundles;
  }

  const lines = [
    `| ${labels.tables.bundle.bundle} | ${labels.tables.bundle.server} | ${labels.tables.bundle.tools} | ${labels.tables.bundle.description} |`,
    "|---|---:|---:|---|"
  ];

  for (const row of bundleRows) {
    lines.push(
      `| ${row.id} | ${row.serverCount} | ${row.totalTools ?? labels.common.notAvailable} | ${row.description} |`
    );
  }

  return lines.join("\n");
}

function formatStackTable(stacks: StackSummary[]): string {
  if (stacks.length === 0) return "No registered stacks found.";
  return [
    "| Stack | Kind | Status | Visibility | Components | Warnings | Manifest |",
    "|---|---|---|---|---:|---|---|",
    ...stacks.map((stack) =>
      `| ${escapeMarkdownTableCell(stack.name)} | ${stack.kind ?? "-"} | ${stack.status ?? "-"} | ${stack.visibility ?? "-"} | ${stack.componentCount + stack.mcpServerCount + stack.skillCount + stack.nestedStackCount + stack.externalComponentCount} | ${stack.warnings.join(", ") || "-"} | ${escapeMarkdownTableCell(stack.manifestPath)} |`
    )
  ].join("\n");
}

function escapeMarkdownTableCell(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function formatToolCatalog(toolCatalog: ServerToolCatalog[]): string {
  const labels = t();
  if (toolCatalog.length === 0) {
    return labels.common.noToolScanServers;
  }

  return toolCatalog
    .map((entry) => {
      const header = [
        `## ${entry.packageName}`,
        "",
        `- ${labels.common.status}: ${entry.status}`,
        `- ${labels.common.source}: ${entry.source}${entry.profileName ? ` (${entry.profileName})` : ""}`,
        `- ${labels.common.transport}: ${entry.transportKind}`,
        `- ${labels.common.tools}: ${entry.toolCount ?? labels.common.notAvailable}`,
        `- ${labels.common.duration}: ${entry.durationMs} ms`,
        `- ${labels.common.start}: ${entry.command ? `${entry.command} ${entry.args.join(" ")}`.trim() : entry.url ?? labels.common.notAvailable}`
      ];
      if (entry.error) {
        header.push(`- ${labels.common.error}: ${entry.error}`);
      }
      if (entry.tools.length === 0) {
        return [...header, "", labels.common.noToolsReported].join("\n");
      }
      return [
        ...header,
        "",
        `| ${labels.tables.tool.tool} | ${labels.tables.tool.title} | ${labels.tables.tool.description} |`,
        "|---|---|---|",
        ...entry.tools.map((tool) =>
          `| ${escapeMarkdownTableCell(tool.name)} | ${escapeMarkdownTableCell(tool.title ?? labels.common.notAvailable)} | ${escapeMarkdownTableCell(tool.description || labels.common.notAvailable)} |`
        )
      ].join("\n");
    })
    .join("\n\n");
}

function formatBundleToolAssignments(assignments: BundleToolAssignment[]): string {
  const labels = t();
  if (assignments.length === 0) {
    return labels.common.noBundleAssignments;
  }

  return assignments
    .map((assignment) => {
      const header = [
        `## ${assignment.title}`,
        "",
        `- ${labels.common.id}: ${assignment.bundleId}`,
        `- ${labels.common.tools}: ${assignment.toolCount}`,
        `- ${labels.common.keywords}: ${assignment.keywords.join(", ")}`
      ];
      if (assignment.tools.length === 0) {
        return [...header, "", labels.common.noMatchingTools].join("\n");
      }
      return [
        ...header,
        "",
        `| ${labels.tables.assignment.server} | ${labels.tables.assignment.tool} | ${labels.tables.assignment.matches} | ${labels.tables.assignment.description} |`,
        "|---|---|---|---|",
        ...assignment.tools.map((tool) =>
          `| ${escapeMarkdownTableCell(tool.serverName)} | ${escapeMarkdownTableCell(tool.toolName)} | ${escapeMarkdownTableCell(tool.matchedKeywords.join(", "))} | ${escapeMarkdownTableCell(tool.description || labels.common.notAvailable)} |`
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
  const labels = t();
  if (options.profileName && options.profileName.trim().length > 0) {
    const profileRoot = options.profileRoot ?? DEFAULT_PROFILE_ROOT;
    return {
      sourceLabel: labels.messages.sourceProfile(options.profileName, profileRoot),
      toolCatalog: await scanProfileServerTools(options.profileName, profileRoot, {
        serverName: options.serverName,
        timeoutMs: options.timeoutMs
      })
    };
  }

  const mcpRoot = options.mcpRoot ?? DEFAULT_MCP_ROOT;
  return {
    sourceLabel: labels.messages.sourceLocalRepos(mcpRoot),
    toolCatalog: await scanLocalServerTools(mcpRoot, {
      serverName: options.serverName,
      timeoutMs: options.timeoutMs
    })
  };
}

function toolText(name: string) {
  return t().toolDescriptions[name] ?? t("en").toolDescriptions[name] ?? { title: name, description: "" };
}

function inputText(name: string): string {
  return t().inputDescriptions[name] ?? t("en").inputDescriptions[name] ?? name;
}

function formatLanguageReport(): string {
  const labels = t();
  const current = getLanguage();
  return [
    labels.headings.language,
    "",
    `- ${labels.language.current(getLanguageName(current), current)}`,
    `- ${labels.language.supported(describeSupportedLanguages())}`,
    `- ${labels.common.hint}: ${labels.language.note}`
  ].join("\n");
}

server.registerTool(
  "controlcenter_get_language",
  {
    title: toolText("controlcenter_get_language").title,
    description: toolText("controlcenter_get_language").description,
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  async () => ({ content: [{ type: "text", text: formatLanguageReport() }] })
);

server.registerTool(
  "controlcenter_set_language",
  {
    title: toolText("controlcenter_set_language").title,
    description: toolText("controlcenter_set_language").description,
    inputSchema: {
      language: z.enum(SUPPORTED_LANGUAGES).describe(inputText("language"))
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  async ({ language }) => {
    const current = setLanguage(language as Lang);
    const labels = t();
    const output = [
      labels.headings.language,
      "",
      `- ${labels.language.changed(getLanguageName(current), current)}`,
      `- ${labels.language.supported(getSupportedLanguages().map((lang) => `${lang}=${getLanguageName(lang)}`).join(", "))}`,
      `- ${labels.common.hint}: ${labels.language.note}`
    ].join("\n");
    return { content: [{ type: "text", text: output }] };
  }
);

server.registerTool(
  "controlcenter_status",
  {
    title: toolText("controlcenter_status").title,
    description: toolText("controlcenter_status").description,
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  async () => {
    const labels = t();
    const [servers, profiles] = await Promise.all([
      scanLocalServers(DEFAULT_MCP_ROOT),
      listMcpProfiles(DEFAULT_PROFILE_ROOT)
    ]);
    const bundles = await loadCapabilityBundles(servers);

    const output = [
      labels.headings.statusTitle,
      "",
      `- ${labels.messages.mcpRoot}: ${DEFAULT_MCP_ROOT}`,
      `- ${labels.messages.profileRoot}: ${DEFAULT_PROFILE_ROOT}`,
      `- ${labels.messages.localRepoCount}: ${servers.length}`,
      `- ${labels.messages.profileCount}: ${profiles.length}`,
      "",
      labels.headings.localRepos,
      formatServerTable(servers),
      "",
      labels.headings.claudeProfiles(),
      formatProfileTable(profiles),
      "",
      labels.headings.capabilityBundles(),
      formatBundleTable(bundles)
    ].join("\n");

    return { content: [{ type: "text", text: output }] };
  }
);

server.registerTool(
  "controlcenter_list_local_servers",
  {
    title: toolText("controlcenter_list_local_servers").title,
    description: toolText("controlcenter_list_local_servers").description,
    inputSchema: {
      mcpRoot: z.string().optional().describe(inputText("mcpRoot"))
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  async ({ mcpRoot }) => {
    const labels = t();
    const resolvedRoot = mcpRoot ?? DEFAULT_MCP_ROOT;
    const servers = await scanLocalServers(resolvedRoot);

    const output = [
      labels.headings.localServers(resolvedRoot),
      "",
      formatServerTable(servers)
    ].join("\n");

    return { content: [{ type: "text", text: output }] };
  }
);

server.registerTool(
  "controlcenter_list_stacks",
  {
    title: toolText("controlcenter_list_stacks").title,
    description: toolText("controlcenter_list_stacks").description,
    inputSchema: {
      stacksRoot: z.string().optional().describe(inputText("stacksRoot"))
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  async ({ stacksRoot }) => {
    const resolvedRoot = stacksRoot ?? DEFAULT_STACKS_ROOT;
    const stacks = await scanStacks(resolvedRoot);
    return { content: [{ type: "text", text: [`# Registered Stacks`, "", `- Root: ${resolvedRoot}`, `- Count: ${stacks.length}`, "", formatStackTable(stacks)].join("\n") }] };
  }
);

server.registerTool(
  "controlcenter_describe_stack",
  {
    title: toolText("controlcenter_describe_stack").title,
    description: toolText("controlcenter_describe_stack").description,
    inputSchema: {
      stackId: z.string().min(1).describe(inputText("stackId")),
      stacksRoot: z.string().optional().describe(inputText("stacksRoot"))
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  async ({ stackId, stacksRoot }) => {
    const resolvedRoot = stacksRoot ?? DEFAULT_STACKS_ROOT;
    const stack = await describeStack(stackId, resolvedRoot);
    if (!stack) {
      return { content: [{ type: "text", text: `Stack '${stackId}' was not found in ${resolvedRoot}.` }], isError: true };
    }
    const lines = [
      `# ${stack.name}`,
      "",
      `- ID: ${stack.id}`,
      `- Kind: ${stack.kind ?? "-"}`,
      `- Status: ${stack.status ?? "-"}`,
      `- Visibility: ${stack.visibility ?? "-"}`,
      `- Manifest: ${stack.manifestPath}`,
      `- Warnings: ${stack.warnings.join(", ") || "-"}`,
      "",
      "## Components",
      ...[...stack.components, ...stack.mcpServers, ...stack.skills, ...stack.nestedStacks, ...stack.externalComponents].map((id) => `- ${id}`),
      "",
      "## Required roles",
      ...(stack.requiredRoles.length ? stack.requiredRoles.map((role) => `- ${role}`) : ["-"]),
      "",
      "## Policies",
      "```json",
      JSON.stringify(stack.policies, null, 2),
      "```"
    ];
    return { content: [{ type: "text", text: lines.join("\n") }] };
  }
);

server.registerTool(
  "controlcenter_list_tools",
  {
    title: toolText("controlcenter_list_tools").title,
    description: toolText("controlcenter_list_tools").description,
    inputSchema: {
      mcpRoot: z.string().optional().describe(inputText("mcpRoot")),
      profileName: z.string().optional().describe(inputText("profileName")),
      profileRoot: z.string().optional().describe(inputText("profileRoot")),
      serverName: z.string().optional().describe(inputText("serverName")),
      timeoutMs: z.number().int().positive().max(60000).optional().describe(inputText("listToolsTimeoutMs"))
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  async ({ mcpRoot, profileName, profileRoot, serverName, timeoutMs }) => {
    const labels = t();
    const { sourceLabel, toolCatalog } = await readRequestedToolCatalog({ mcpRoot, profileName, profileRoot, serverName, timeoutMs });
    const output = [
      labels.headings.toolCatalog,
      "",
      `${labels.common.source}: ${sourceLabel}`,
      serverName
        ? `${labels.common.filter}: ${serverName}`
        : profileName
          ? `${labels.common.filter}: ${labels.common.allProfileServers}`
          : `${labels.common.filter}: ${labels.common.allLocalServers}`,
      "",
      formatToolCatalog(toolCatalog)
    ].join("\n");

    return { content: [{ type: "text", text: output }] };
  }
);

server.registerTool(
  "controlcenter_assign_tool_bundles",
  {
    title: toolText("controlcenter_assign_tool_bundles").title,
    description: toolText("controlcenter_assign_tool_bundles").description,
    inputSchema: {
      mcpRoot: z.string().optional().describe(inputText("mcpRoot")),
      profileName: z.string().optional().describe(inputText("profileName")),
      profileRoot: z.string().optional().describe(inputText("profileRoot")),
      serverName: z.string().optional().describe(inputText("simpleServerName")),
      bundleConfigPath: z.string().optional().describe(inputText("bundleConfigPath")),
      timeoutMs: z.number().int().positive().max(60000).optional().describe(inputText("timeoutMs"))
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  async ({ mcpRoot, profileName, profileRoot, serverName, bundleConfigPath, timeoutMs }) => {
    const labels = t();
    const [{ sourceLabel, toolCatalog }, definitions] = await Promise.all([
      readRequestedToolCatalog({ mcpRoot, profileName, profileRoot, serverName, timeoutMs }),
      loadBundleDefinitions(bundleConfigPath)
    ]);
    const assignments = buildBundleToolAssignments(toolCatalog, definitions);
    const failedCatalogs = toolCatalog.filter((entry) => entry.status !== "ok");
    const output = [
      labels.headings.toolBundleAssignment,
      "",
      `${labels.common.source}: ${sourceLabel}`,
      `${labels.messages.serverProbes}: ${toolCatalog.length}`,
      `${labels.messages.failedProbes}: ${failedCatalogs.length}`,
      "",
      formatBundleToolAssignments(assignments),
      failedCatalogs.length > 0
        ? [
          "",
          labels.headings.probeNotes,
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
    title: toolText("controlcenter_list_bundles").title,
    description: toolText("controlcenter_list_bundles").description,
    inputSchema: {
      mcpRoot: z.string().optional().describe(inputText("mcpRoot")),
      bundleConfigPath: z.string().optional().describe(inputText("bundleConfigPath"))
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  async ({ mcpRoot, bundleConfigPath }) => {
    const labels = t();
    const resolvedRoot = mcpRoot ?? DEFAULT_MCP_ROOT;
    const bundles = await loadCapabilityBundles(await scanLocalServers(resolvedRoot), bundleConfigPath);
    const output = [
      labels.headings.capabilityBundles(resolvedRoot),
      "",
      formatBundleTable(bundles),
      "",
      labels.headings.details,
      bundles
        .map((bundle) => [
          `### ${bundle.title}`,
          "",
          `- ${labels.common.id}: ${bundle.id}`,
          `- ${labels.common.server}: ${bundle.servers.length > 0 ? bundle.servers.join(", ") : labels.common.none}`,
          `- ${labels.common.keywords}: ${bundle.keywords.join(", ")}`
        ].join("\n"))
        .join("\n\n")
    ].join("\n");

    return { content: [{ type: "text", text: output }] };
  }
);

server.registerTool(
  "controlcenter_suggest_bundles",
  {
    title: toolText("controlcenter_suggest_bundles").title,
    description: toolText("controlcenter_suggest_bundles").description,
    inputSchema: {
      task: z.string().min(3).describe(inputText("task")),
      mcpRoot: z.string().optional().describe(inputText("mcpRoot")),
      bundleConfigPath: z.string().optional().describe(inputText("bundleConfigPath"))
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  async ({ task, mcpRoot, bundleConfigPath }) => {
    const labels = t();
    const resolvedRoot = mcpRoot ?? DEFAULT_MCP_ROOT;
    const bundles = await loadCapabilityBundles(await scanLocalServers(resolvedRoot), bundleConfigPath);
    const suggestions = suggestCapabilityBundles(task, bundles);
    const output = [
      labels.headings.bundleRecommendation,
      "",
      suggestions.length > 0
        ? suggestions.map((suggestion) => [
          `## ${suggestion.bundle.title}`,
          "",
          `- ${labels.common.id}: ${suggestion.bundle.id}`,
          `- ${labels.messages.score}: ${suggestion.score}`,
          `- ${labels.common.keywords}: ${suggestion.matchedKeywords.join(", ")}`,
          `- ${labels.common.server}: ${suggestion.bundle.servers.length > 0 ? suggestion.bundle.servers.join(", ") : labels.common.none}`
        ].join("\n")).join("\n\n")
        : labels.messages.noStrongBundleMatches
    ].join("\n");

    return { content: [{ type: "text", text: output }] };
  }
);

server.registerTool(
  "controlcenter_list_profiles",
  {
    title: toolText("controlcenter_list_profiles").title,
    description: toolText("controlcenter_list_profiles").description,
    inputSchema: {
      profileRoot: z.string().optional().describe(inputText("profileRoot"))
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  async ({ profileRoot }) => {
    const labels = t();
    const resolvedRoot = profileRoot ?? DEFAULT_PROFILE_ROOT;
    const profiles = await listMcpProfiles(resolvedRoot);

    const output = [
      labels.headings.claudeProfiles(resolvedRoot),
      "",
      formatProfileTable(profiles)
    ].join("\n");

    return { content: [{ type: "text", text: output }] };
  }
);

server.registerTool(
  "controlcenter_suggest_profile",
  {
    title: toolText("controlcenter_suggest_profile").title,
    description: toolText("controlcenter_suggest_profile").description,
    inputSchema: {
      task: z.string().min(3).describe(inputText("task"))
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  async ({ task }) => {
    const labels = t();
    const suggestion = suggestProfile(task);
    const output = [
      labels.headings.profileRecommendation,
      "",
      `- ${labels.messages.recommendation}: ${suggestion.profile}`,
      `- ${labels.messages.score}: ${suggestion.score}`,
      `- ${labels.messages.rationale}: ${suggestion.rationale}`,
      `- ${labels.common.keywords}: ${suggestion.matchedKeywords.length > 0 ? suggestion.matchedKeywords.join(", ") : labels.common.none}`
    ].join("\n");

    return { content: [{ type: "text", text: output }] };
  }
);

server.registerTool(
  "controlcenter_resolve_profile",
  {
    title: toolText("controlcenter_resolve_profile").title,
    description: toolText("controlcenter_resolve_profile").description,
    inputSchema: {
      profileName: z.string().min(1).describe(inputText("requiredProfileName")),
      profileRoot: z.string().optional().describe(inputText("profileRoot"))
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  async ({ profileName, profileRoot }) => {
    const labels = t();
    const resolved = await resolveMcpProfile(profileName, profileRoot ?? DEFAULT_PROFILE_ROOT);
    const output = [
      labels.headings.resolvedProfile,
      "",
      `- ${labels.common.profile}: ${resolved.name}`,
      `- ${labels.common.server}: ${resolved.serverCount}`,
      `- ${labels.common.source}: ${resolved.sourceFiles.join(", ")}`,
      "",
      labels.headings.mcpServers,
      resolved.servers.length > 0 ? resolved.servers.map((name) => `- ${name}`).join("\n") : labels.common.none
    ].join("\n");

    return { content: [{ type: "text", text: output }] };
  }
);

server.registerTool(
  "controlcenter_switch_profile",
  {
    title: toolText("controlcenter_switch_profile").title,
    description: toolText("controlcenter_switch_profile").description,
    inputSchema: {
      profileName: z.string().min(1).describe(inputText("requiredProfileName")),
      profileRoot: z.string().optional().describe(inputText("profileRoot")),
      outputPath: z.string().optional().describe(inputText("outputPath")),
      launchTemplate: z.string().optional().describe(inputText("launchTemplate")),
      write: z.boolean().default(false).describe(inputText("write"))
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  async ({ profileName, profileRoot, outputPath, launchTemplate, write }) => {
    const labels = t();
    const plan = await prepareProfileSwitch(profileName, {
      profileRoot: profileRoot ?? DEFAULT_PROFILE_ROOT,
      outputPath,
      launchTemplate,
      write
    });
    const output = [
      labels.headings.profileSwitchPrepared,
      "",
      `- ${labels.common.profile}: ${plan.name}`,
      `- ${labels.common.server}: ${plan.serverCount}`,
      `- ${labels.common.output}: ${plan.outputPath}`,
      `- ${labels.common.written}: ${plan.written ? labels.common.yes : labels.common.no}`,
      `- ${labels.common.command}: ${plan.command}`,
      "",
      labels.headings.mcpServers,
      plan.servers.length > 0 ? plan.servers.map((name) => `- ${name}`).join("\n") : labels.common.none
    ].join("\n");

    return { content: [{ type: "text", text: output }] };
  }
);

server.registerTool(
  "controlcenter_audit_profile",
  {
    title: toolText("controlcenter_audit_profile").title,
    description: toolText("controlcenter_audit_profile").description,
    inputSchema: {
      profileName: z.string().min(1).describe(inputText("requiredProfileName")),
      profileRoot: z.string().optional().describe(inputText("profileRoot")),
      policyConfigPath: z.string().optional().describe(inputText("policyConfigPath"))
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  async ({ profileName, profileRoot, policyConfigPath }) => {
    const labels = t();
    const resolved = await resolveMcpProfile(profileName, profileRoot ?? DEFAULT_PROFILE_ROOT);
    const policyRules = await loadPolicyRules(policyConfigPath);
    const findings = auditResolvedProfile(resolved, policyRules);
    const summary = summarizePolicyFindings(findings);
    const output = [
      labels.headings.profileAudit,
      "",
      `- ${labels.common.profile}: ${resolved.name}`,
      `- ${labels.common.server}: ${resolved.serverCount}`,
      `- ${labels.messages.policyRules}: ${policyRules.filter((rule) => rule.enabled).length}/${policyRules.length} ${labels.common.active}`,
      `- ${labels.common.high}: ${summary.high}`,
      `- ${labels.common.warning}: ${summary.warning}`,
      `- ${labels.common.info}: ${summary.info}`,
      "",
      `## ${labels.common.findings}`,
      findings
        .map((finding) => [
          `### ${finding.ruleId}`,
          "",
          `- ${labels.common.severity}: ${finding.severity}`,
          `- ${labels.common.server}: ${finding.serverName}`,
          `- ${labels.common.hint}: ${finding.message}`,
          `- ${labels.common.details}: ${JSON.stringify(finding.details)}`
        ].join("\n"))
        .join("\n\n")
    ].join("\n");

    return { content: [{ type: "text", text: output }] };
  }
);

server.registerTool(
  "controlcenter_build_catalog",
  {
    title: toolText("controlcenter_build_catalog").title,
    description: toolText("controlcenter_build_catalog").description,
    inputSchema: {
      mcpRoot: z.string().optional().describe(inputText("mcpRoot")),
      outputPath: z.string().optional().describe(inputText("catalogOutputPath")),
      profileName: z.string().optional().describe(inputText("profileName")),
      profileRoot: z.string().optional().describe(inputText("profileRoot")),
      bundleConfigPath: z.string().optional().describe(inputText("bundleConfigPath")),
      includeTools: z.boolean().default(false).describe(inputText("includeTools")),
      includeToolAssignments: z.boolean().default(false).describe(inputText("includeToolAssignments")),
      timeoutMs: z.number().int().positive().max(60000).optional().describe(inputText("timeoutMs"))
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  async ({ mcpRoot, outputPath, profileName, profileRoot, bundleConfigPath, includeTools, includeToolAssignments, timeoutMs }) => {
    const labels = t();
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
      labels.headings.catalogCreated,
      "",
      `- ${labels.common.output}: ${resolvedOutputPath}`,
      `- ${labels.messages.serverCount}: ${servers.length}`,
      `- ${labels.messages.toolScan}: ${shouldScanTools ? labels.common.yes : labels.common.no}`,
      `- ${labels.messages.profileToolScan}: ${profileToolCatalog ? labels.common.yes : labels.common.no}`,
      `- ${labels.messages.toolBundleAssignment}: ${includeToolAssignments ? labels.common.yes : labels.common.no}`
    ].join("\n");

    return { content: [{ type: "text", text: output }] };
  }
);

function formatSkillsTable(skills: SkillSummary[]): string {
  const labels = t();
  if (skills.length === 0) {
    return labels.common.none;
  }
  const tbl = labels.tables.skill;
  const lines = [
    `| ${tbl.name} | ${tbl.description} | ${tbl.version} | ${tbl.deployed} | ${tbl.category} | ${tbl.path} |`,
    `|---|---|---|---|---|---|`
  ];
  for (const s of skills) {
    lines.push(
      `| ${escapeMarkdownTableCell(s.name)} | ${escapeMarkdownTableCell(s.description || labels.common.notAvailable)} | ${s.version ?? labels.common.notAvailable} | ${s.deployed ? labels.common.yes : labels.common.no} | ${escapeMarkdownTableCell(s.category ?? labels.common.notAvailable)} | ${escapeMarkdownTableCell(s.absolutePath)} |`
    );
  }
  return lines.join("\n");
}

function formatPluginsTable(plugins: PluginSummary[]): string {
  const labels = t();
  if (plugins.length === 0) {
    return labels.common.none;
  }
  const tbl = labels.tables.plugin;
  const lines = [
    `| ${tbl.name} | ${tbl.type} | ${tbl.version} | ${tbl.marketplaceScope} | ${tbl.skills} | ${tbl.commands} | ${tbl.mcp} | ${tbl.path} |`,
    `|---|---|---|---|---|---|---|---|`
  ];
  for (const p of plugins) {
    const marketplaceScope = [p.marketplace, p.scope].filter(Boolean).join(" / ") || labels.common.notAvailable;
    lines.push(
      `| ${escapeMarkdownTableCell(p.name)} | ${p.type} | ${p.version ?? labels.common.notAvailable} | ${escapeMarkdownTableCell(marketplaceScope)} | ${p.hasSkills ? labels.common.yes : labels.common.no} | ${p.hasCommands ? labels.common.yes : labels.common.no} | ${p.hasMcp ? labels.common.yes : labels.common.no} | ${escapeMarkdownTableCell(p.absolutePath)} |`
    );
  }
  return lines.join("\n");
}

server.registerTool(
  "controlcenter_list_skills",
  {
    title: toolText("controlcenter_list_skills").title,
    description: toolText("controlcenter_list_skills").description,
    inputSchema: {
      skillsRoot: z.string().optional().describe(inputText("skillsRoot")),
      sourceSkillsRoot: z.string().optional().describe(inputText("sourceSkillsRoot")),
      deployedOnly: z.boolean().default(false).describe(inputText("deployedOnly"))
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  async ({ skillsRoot, sourceSkillsRoot, deployedOnly }) => {
    const labels = t();
    const resolvedSkillsRoot = skillsRoot ?? DEFAULT_SKILLS_ROOT;
    const resolvedSourceRoot = sourceSkillsRoot ?? DEFAULT_SOURCE_SKILLS_ROOT;

    // When deployedOnly, pass an empty string for sourceRoot — scanSkills gracefully returns [] for missing dirs
    const skills: SkillSummary[] = await scanSkills(
      resolvedSkillsRoot,
      deployedOnly ? "" : resolvedSourceRoot
    );

    const deployed = skills.filter((s) => s.deployed);
    const sourceOnly = skills.filter((s) => !s.deployed);

    const output = [
      `# ${toolText("controlcenter_list_skills").title}`,
      "",
      `- ${labels.messages.skillsRoot}: ${resolvedSkillsRoot}`,
      `- ${labels.messages.sourceSkillsRoot}: ${deployedOnly ? labels.messages.skipped : resolvedSourceRoot}`,
      `- ${labels.messages.skillsTotal(skills.length, deployed.length, sourceOnly.length)}`,
      "",
      labels.headings.deployedSkills(deployed.length),
      "",
      formatSkillsTable(deployed),
      ...(deployedOnly ? [] : [
        "",
        labels.headings.sourceOnlySkills(sourceOnly.length),
        "",
        formatSkillsTable(sourceOnly)
      ])
    ].join("\n");

    return { content: [{ type: "text", text: output }] };
  }
);

function formatSkillMatches(intent: string, matches: SkillMatch[]): string {
  const labels = t();
  const title = toolText("controlcenter_find_skill").title;
  const header = [
    `# ${title}`,
    "",
    `- ${labels.common.filter}: ${intent}`,
    ""
  ];
  if (matches.length === 0) {
    return [...header, labels.common.none].join("\n");
  }
  const blocks = matches.map((m) =>
    [
      `## ${m.skill.name}`,
      "",
      `- ${labels.messages.score}: ${m.score}`,
      `- ${labels.common.keywords}: ${m.matchedTerms.length > 0 ? m.matchedTerms.join(", ") : labels.common.none}`,
      `- ${labels.tables.skill.category}: ${m.skill.category ?? labels.common.notAvailable}`,
      `- ${labels.tables.skill.deployed}: ${m.skill.deployed ? labels.common.yes : labels.common.no}`,
      `- ${labels.common.hint}: ${m.skill.description || labels.common.notAvailable}`,
      `- ${labels.tables.skill.path}: ${m.skill.absolutePath}`
    ].join("\n")
  );
  return [...header, blocks.join("\n\n")].join("\n");
}

server.registerTool(
  "controlcenter_find_skill",
  {
    title: toolText("controlcenter_find_skill").title,
    description: toolText("controlcenter_find_skill").description,
    inputSchema: {
      intent: z.string().min(3).describe(inputText("skillIntent")),
      skillsRoot: z.string().optional().describe(inputText("skillsRoot")),
      sourceSkillsRoot: z.string().optional().describe(inputText("sourceSkillsRoot")),
      deployedOnly: z.boolean().default(false).describe(inputText("deployedOnly")),
      limit: z.number().int().positive().max(25).default(5).describe(inputText("skillFinderLimit"))
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  async ({ intent, skillsRoot, sourceSkillsRoot, deployedOnly, limit }) => {
    const resolvedSkillsRoot = skillsRoot ?? DEFAULT_SKILLS_ROOT;
    const resolvedSourceRoot = sourceSkillsRoot ?? DEFAULT_SOURCE_SKILLS_ROOT;
    const skills = await scanSkills(resolvedSkillsRoot, deployedOnly ? "" : resolvedSourceRoot);
    const matches = findSkills(intent, skills, limit);
    return { content: [{ type: "text", text: formatSkillMatches(intent, matches) }] };
  }
);

server.registerTool(
  "controlcenter_list_plugins",
  {
    title: toolText("controlcenter_list_plugins").title,
    description: toolText("controlcenter_list_plugins").description,
    inputSchema: {
      pluginsRoot: z.string().optional().describe(inputText("pluginsRoot")),
      modulesRoot: z.string().optional().describe(inputText("modulesRoot")),
      pluginsOnly: z.boolean().default(false).describe(inputText("pluginsOnly")),
      modulesOnly: z.boolean().default(false).describe(inputText("modulesOnly"))
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  async ({ pluginsRoot, modulesRoot, pluginsOnly, modulesOnly }) => {
    const labels = t();
    const resolvedPluginsRoot = pluginsRoot ?? DEFAULT_PLUGINS_ROOT;
    const resolvedModulesRoot = modulesRoot ?? DEFAULT_MODULES_ROOT;

    let plugins: PluginSummary[];
    if (pluginsOnly) {
      plugins = await scanInstalledPlugins(resolvedPluginsRoot);
    } else if (modulesOnly) {
      plugins = await scanModules(resolvedModulesRoot);
    } else {
      plugins = await scanPluginsAndModules(resolvedPluginsRoot, resolvedModulesRoot);
    }

    const pluginEntries = plugins.filter((p) => p.type === "plugin");
    const moduleEntries = plugins.filter((p) => p.type === "module");

    const output = [
      `# ${toolText("controlcenter_list_plugins").title}`,
      "",
      `- ${labels.messages.pluginsRoot}: ${modulesOnly ? labels.messages.skipped : resolvedPluginsRoot}`,
      `- ${labels.messages.modulesRoot}: ${pluginsOnly ? labels.messages.skipped : resolvedModulesRoot}`,
      `- ${labels.messages.pluginsTotal(plugins.length, pluginEntries.length, moduleEntries.length)}`,
      ...(modulesOnly ? [] : [
        "",
        labels.headings.claudeCodePlugins(pluginEntries.length),
        "",
        formatPluginsTable(pluginEntries)
      ]),
      ...(pluginsOnly ? [] : [
        "",
        labels.headings.localModules(moduleEntries.length),
        "",
        formatPluginsTable(moduleEntries)
      ])
    ].join("\n");

    return { content: [{ type: "text", text: output }] };
  }
);

async function main(): Promise<void> {
  // Update-Hinweis nur im interaktiven Terminal — niemals im stdio-/MCP-Betrieb (Protokoll-Schutz)
  if (process.stdout.isTTY) {
    try {
      updateNotifier({ pkg: createRequire(import.meta.url)("../package.json") }).notify();
    } catch { /* Update-Check darf den Start nie blockieren */ }
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Failed to start ellmos-controlcenter-mcp:", error);
  process.exit(1);
});
