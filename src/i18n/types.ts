export const SUPPORTED_LANGUAGES = ["de", "en", "es", "zh", "ja", "ru"] as const;

export type Lang = typeof SUPPORTED_LANGUAGES[number];

export interface ToolText {
  title: string;
  description: string;
}

export interface Translations {
  language: {
    name: string;
    current: (langName: string, lang: Lang) => string;
    changed: (langName: string, lang: Lang) => string;
    supported: (languages: string) => string;
    note: string;
  };
  common: {
    yes: string;
    no: string;
    none: string;
    allLocalServers: string;
    allProfileServers: string;
    notAvailable: string;
    noLocalServers: string;
    noProfiles: string;
    noBundles: string;
    noToolScanServers: string;
    noToolsReported: string;
    noBundleAssignments: string;
    noMatchingTools: string;
    unsupportedStartForm: string;
    serverConfigNotObject: string;
    noSupportedStartForm: string;
    status: string;
    source: string;
    filter: string;
    transport: string;
    tools: string;
    duration: string;
    start: string;
    error: string;
    active: string;
    id: string;
    keywords: string;
    server: string;
    servers: string;
    profile: string;
    profiles: string;
    output: string;
    written: string;
    command: string;
    details: string;
    findings: string;
    severity: string;
    hint: string;
    high: string;
    warning: string;
    info: string;
  };
  tables: {
    server: {
      repo: string;
      version: string;
      tools: string;
      serverJson: string;
      path: string;
    };
    profile: {
      profile: string;
      extends: string;
      server: string;
      file: string;
    };
    bundle: {
      bundle: string;
      server: string;
      tools: string;
      description: string;
    };
    tool: {
      tool: string;
      title: string;
      description: string;
    };
    assignment: {
      server: string;
      tool: string;
      matches: string;
      description: string;
    };
  };
  headings: {
    statusTitle: string;
    localServers: (root: string) => string;
    localRepos: string;
    claudeProfiles: (root?: string) => string;
    capabilityBundles: (root?: string) => string;
    details: string;
    bundleRecommendation: string;
    profileRecommendation: string;
    resolvedProfile: string;
    profileSwitchPrepared: string;
    profileAudit: string;
    mcpServers: string;
    catalogCreated: string;
    toolCatalog: string;
    toolBundleAssignment: string;
    probeNotes: string;
    language: string;
  };
  messages: {
    sourceLocalRepos: (root: string) => string;
    sourceProfile: (profileName: string, profileRoot: string) => string;
    recommendation: string;
    score: string;
    rationale: string;
    noStrongBundleMatches: string;
    noStrongProfileKeywords: string;
    profileRationale: (count: number, keywords: string) => string;
    mcpRoot: string;
    profileRoot: string;
    localRepoCount: string;
    profileCount: string;
    serverProbes: string;
    failedProbes: string;
    policyRules: string;
    generatedConfig: string;
    serverCount: string;
    toolScan: string;
    profileToolScan: string;
    toolBundleAssignment: string;
    resolvedServers: string;
  };
  policy: {
    invalidServerConfig: string;
    missingCommand: string;
    npxRuntimeFetch: string;
    envSecretsPresent: string;
    sensitiveArgName: string;
    noFindings: string;
  };
  toolDescriptions: Record<string, ToolText>;
  inputDescriptions: Record<string, string>;
  dashboard: {
    loading: string;
    refresh: string;
    writeConfig: string;
    language: string;
    profile: string;
    audit: string;
    localServers: string;
    capabilityBundles: string;
    toolCatalog: string;
    toolBundleAssignment: string;
    generatedConfig: string;
    toolScopeProfile: string;
    toolScopeLocal: string;
    scan: string;
    timeoutLabel: string;
    noToolScan: string;
    noAction: string;
    noDescription: string;
    active: string;
    enableVerb: string;
    disableVerb: string;
    confirmServerPrefix: string;
    confirmServerMiddle: string;
    confirmServerSuffix: string;
    confirmWritePrefix: string;
    confirmWriteSuffix: string;
    scanRunning: string;
    noToolsReported: string;
    noMatchingTools: string;
    serverOk: string;
    high: string;
    warning: string;
    info: string;
    resolvedServers: string;
    apiError: string;
  };
}
