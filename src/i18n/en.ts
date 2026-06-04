import type { Translations } from "./types.js";

export const en: Translations = {
  language: {
    name: "English",
    current: (langName, lang) => `Current language: ${langName} (${lang})`,
    changed: (langName, lang) => `Language set to ${langName} (${lang}).`,
    supported: (languages) => `Supported languages: ${languages}`,
    fallbackNote: "German and English are fully maintained; es, zh, ja, and ru currently fall back to English text."
  },
  common: {
    yes: "yes",
    no: "no",
    none: "-",
    allLocalServers: "all local MCP servers",
    allProfileServers: "all profile servers",
    notAvailable: "-",
    noLocalServers: "No local MCP servers found.",
    noProfiles: "No Claude profiles found.",
    noBundles: "No capability bundles available.",
    noToolScanServers: "No MCP servers found for the tool scan.",
    noToolsReported: "No tools reported.",
    noBundleAssignments: "No bundle assignments calculated.",
    noMatchingTools: "No matching tools.",
    unsupportedStartForm: "Unsupported MCP start form.",
    serverConfigNotObject: "Server configuration is not an object.",
    noSupportedStartForm: "No supported MCP start form detected.",
    status: "Status",
    source: "Source",
    filter: "Filter",
    transport: "Transport",
    tools: "Tools",
    duration: "Duration",
    start: "Start",
    error: "Error",
    active: "active",
    id: "ID",
    keywords: "Keywords",
    server: "Server",
    servers: "Servers",
    profile: "Profile",
    profiles: "Profiles",
    output: "Output",
    written: "Written",
    command: "Launch command",
    details: "Details",
    findings: "Findings",
    severity: "Severity",
    hint: "Hint",
    high: "High",
    warning: "Warning",
    info: "Info"
  },
  tables: {
    server: {
      repo: "Repo",
      version: "Version",
      tools: "Tools",
      serverJson: "server.json",
      path: "Path"
    },
    profile: {
      profile: "Profile",
      extends: "Extends",
      server: "Servers",
      file: "File"
    },
    bundle: {
      bundle: "Bundle",
      server: "Servers",
      tools: "Tools",
      description: "Description"
    },
    tool: {
      tool: "Tool",
      title: "Title",
      description: "Description"
    },
    assignment: {
      server: "Server",
      tool: "Tool",
      matches: "Matches",
      description: "Description"
    }
  },
  headings: {
    statusTitle: "# ellmos ControlCenter Status",
    localServers: (root) => `# Local MCP servers in ${root}`,
    localRepos: "## Local MCP Repositories",
    claudeProfiles: (root) => root ? `# Claude profiles in ${root}` : "## Claude Profiles",
    capabilityBundles: (root) => root ? `# Capability bundles in ${root}` : "## Capability Bundles",
    details: "## Details",
    bundleRecommendation: "# Bundle Recommendation",
    profileRecommendation: "# Profile Recommendation",
    resolvedProfile: "# Resolved Profile",
    profileSwitchPrepared: "# Profile Switch Prepared",
    profileAudit: "# Profile Audit",
    mcpServers: "## MCP Servers",
    catalogCreated: "# Catalog Created",
    toolCatalog: "# MCP Tool Catalog",
    toolBundleAssignment: "# Tool Bundle Assignment",
    probeNotes: "## Probe Notes",
    language: "# ControlCenter Language"
  },
  messages: {
    sourceLocalRepos: (root) => `Local MCP repositories in ${root}`,
    sourceProfile: (profileName, profileRoot) => `Profile ${profileName} in ${profileRoot}`,
    recommendation: "Recommendation",
    score: "Score",
    rationale: "Rationale",
    noStrongBundleMatches: "No strong bundle matches detected.",
    noStrongProfileKeywords: "No strong keywords detected. Base profile is the safe default recommendation.",
    profileRationale: (count, keywords) => `Recommended because ${count} keywords matched: ${keywords}`,
    mcpRoot: "MCP root",
    profileRoot: "Profile root",
    localRepoCount: "Local MCP repositories",
    profileCount: "Claude profiles",
    serverProbes: "Server probes",
    failedProbes: "Failed probes",
    policyRules: "Policy rules",
    generatedConfig: "Generated configuration",
    serverCount: "Servers",
    toolScan: "Tool scan",
    profileToolScan: "Profile tool scan",
    toolBundleAssignment: "Tool bundle assignment",
    resolvedServers: "resolved servers"
  },
  policy: {
    invalidServerConfig: "Server configuration is not an object.",
    missingCommand: "Server has no executable command entry.",
    npxRuntimeFetch: "Server starts through npx. This is convenient, but less reproducible than a pinned local path.",
    envSecretsPresent: "Server configuration contains environment variables. Values are intentionally not returned.",
    sensitiveArgName: "Server arguments contain names that look sensitive. Review the contents separately.",
    noFindings: "No policy hints found in the resolved profile."
  },
  toolDescriptions: {
    controlcenter_status: {
      title: "ControlCenter Status",
      description: "Shows an overview of the local MCP stack, local servers, and Claude profiles."
    },
    controlcenter_get_language: {
      title: "Show ControlCenter Language",
      description: "Shows the current ControlCenter output language and supported language codes."
    },
    controlcenter_set_language: {
      title: "Set ControlCenter Language",
      description: "Sets the ControlCenter output language for this running MCP server instance."
    },
    controlcenter_list_local_servers: {
      title: "List Local MCP Servers",
      description: "Scans the local MCP root and lists discovered MCP repositories with metadata."
    },
    controlcenter_list_tools: {
      title: "List MCP Tools",
      description: "Starts local or profile-defined MCP servers in a controlled way and reads their real tool list through MCP list_tools."
    },
    controlcenter_assign_tool_bundles: {
      title: "Assign Tools To Capability Bundles",
      description: "Assigns real MCP tools to ControlCenter capability bundles using their metadata."
    },
    controlcenter_list_bundles: {
      title: "List Capability Bundles",
      description: "Groups local MCP servers into task bundles such as software, filesystem, automation, and control plane."
    },
    controlcenter_suggest_bundles: {
      title: "Suggest Capability Bundles",
      description: "Suggests matching capability bundles for a task description."
    },
    controlcenter_list_profiles: {
      title: "List Claude Profiles",
      description: "Reads local Claude profiles and shows server counts, inheritance, and file paths."
    },
    controlcenter_suggest_profile: {
      title: "Suggest Profile",
      description: "Suggests a Claude profile from a task description."
    },
    controlcenter_resolve_profile: {
      title: "Resolve Claude Profile",
      description: "Resolves a Claude profile including optional inheritance and shows the resulting MCP servers."
    },
    controlcenter_switch_profile: {
      title: "Prepare Profile Switch",
      description: "Prepares a profile switch by creating or previewing a resolved --mcp-config file."
    },
    controlcenter_audit_profile: {
      title: "Audit Claude Profile",
      description: "Checks a resolved Claude profile for initial policy hints such as npx starts, env secrets, and invalid server configurations."
    },
    controlcenter_build_catalog: {
      title: "Build Local Server Catalog",
      description: "Creates a JSON catalog of locally discovered MCP servers."
    }
  },
  inputDescriptions: {
    language: "Language code for ControlCenter output.",
    mcpRoot: "Optional MCP root. Defaults to the local ellmos MCP folder.",
    profileName: "Optional profile name. When set, the resolved servers of that Claude profile are scanned.",
    requiredProfileName: "Profile name without .json, for example software or ai-lab.",
    profileRoot: "Optional profile folder. Defaults to ~/.claude/profiles.",
    serverName: "Optional server name, package name, mcpName, or profile server name for a targeted scan.",
    simpleServerName: "Optional server name for a targeted scan.",
    timeoutMs: "Timeout per MCP tool scan in milliseconds. Default: 5000.",
    listToolsTimeoutMs: "Timeout per connect and list_tools request in milliseconds. Default: 5000.",
    bundleConfigPath: "Optional path to a capability bundle configuration.",
    task: "Task description or session goal.",
    outputPath: "Optional output location for the generated MCP config.",
    write: "When true, the generated config is written. Otherwise only a preview is returned.",
    policyConfigPath: "Optional path to a policy rule configuration.",
    catalogOutputPath: "Optional output location for the JSON catalog.",
    includeTools: "When true, local MCP servers are started and real list_tools results are added to the catalog.",
    includeToolAssignments: "When true, tool bundle assignments are added for scanned tools."
  },
  dashboard: {
    loading: "loading...",
    refresh: "Refresh",
    writeConfig: "Generate MCP config",
    language: "Language",
    profile: "Profile",
    audit: "Audit",
    localServers: "Local Servers",
    capabilityBundles: "Capability Bundles",
    toolCatalog: "Tool Catalog",
    toolBundleAssignment: "Tool Bundle Assignment",
    generatedConfig: "Generated Configuration",
    toolScopeProfile: "Profile",
    toolScopeLocal: "Local Repos",
    scan: "Scan",
    timeoutLabel: "Timeout in milliseconds",
    noToolScan: "No tool scan has run yet.",
    noAction: "No action has run yet.",
    noDescription: "No description",
    active: "active",
    enableVerb: "enable",
    disableVerb: "disable",
    confirmServerPrefix: "Change server '",
    confirmServerMiddle: "' in profile '",
    confirmServerSuffix: "? A backup is created before writing.",
    confirmWritePrefix: "Write generated MCP config for profile '",
    confirmWriteSuffix: "'? An existing file is backed up first.",
    scanRunning: "Scan running...",
    noToolsReported: "No tools reported.",
    noMatchingTools: "No matching tools.",
    serverOk: "servers OK",
    high: "high",
    warning: "warning",
    info: "info",
    resolvedServers: "resolved servers",
    apiError: "API error"
  }
};
