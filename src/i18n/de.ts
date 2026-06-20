import type { Translations } from "./types.js";

export const de: Translations = {
  language: {
    name: "Deutsch",
    current: (langName, lang) => `Aktuelle Sprache: ${langName} (${lang})`,
    changed: (langName, lang) => `Sprache gesetzt auf ${langName} (${lang}).`,
    supported: (languages) => `Unterstützte Sprachen: ${languages}`,
    note: "Alle unterstützten Sprachen haben gepflegte Textsets; eigene Bundle-Titel und -Beschreibungen werden wie gepflegt angezeigt."
  },
  common: {
    yes: "ja",
    no: "nein",
    none: "-",
    allLocalServers: "alle lokalen MCP-Server",
    allProfileServers: "alle Profilserver",
    notAvailable: "-",
    noLocalServers: "Keine lokalen MCP-Server gefunden.",
    noProfiles: "Keine Claude-Profile gefunden.",
    noBundles: "Keine Capability-Bundles verfügbar.",
    noToolScanServers: "Keine MCP-Server für den Tool-Scan gefunden.",
    noToolsReported: "Keine Tools gemeldet.",
    noBundleAssignments: "Keine Bundle-Zuordnungen berechnet.",
    noMatchingTools: "Keine passenden Tools.",
    unsupportedStartForm: "Nicht unterstützte MCP-Startform.",
    serverConfigNotObject: "Server-Konfiguration ist kein Objekt.",
    noSupportedStartForm: "Keine unterstützte MCP-Startform erkannt.",
    status: "Status",
    source: "Quelle",
    filter: "Filter",
    transport: "Transport",
    tools: "Tools",
    duration: "Dauer",
    start: "Start",
    error: "Fehler",
    active: "aktiv",
    id: "ID",
    keywords: "Schlüsselwörter",
    server: "Server",
    servers: "Server",
    profile: "Profil",
    profiles: "Profile",
    output: "Ausgabe",
    written: "Geschrieben",
    command: "Startbefehl",
    details: "Details",
    findings: "Befunde",
    severity: "Schweregrad",
    hint: "Hinweis",
    high: "Hoch",
    warning: "Warnung",
    info: "Info"
  },
  tables: {
    server: {
      repo: "Repo",
      version: "Version",
      tools: "Tools",
      serverJson: "server.json",
      path: "Pfad"
    },
    profile: {
      profile: "Profil",
      extends: "Erweitert",
      server: "Server",
      file: "Datei"
    },
    bundle: {
      bundle: "Bundle",
      server: "Server",
      tools: "Tools",
      description: "Beschreibung"
    },
    tool: {
      tool: "Tool",
      title: "Titel",
      description: "Beschreibung"
    },
    assignment: {
      server: "Server",
      tool: "Tool",
      matches: "Treffer",
      description: "Beschreibung"
    },
    skill: {
      name: "Name",
      description: "Beschreibung",
      version: "Version",
      deployed: "Deployt",
      category: "Kategorie",
      path: "Pfad"
    },
    plugin: {
      name: "Name",
      type: "Typ",
      version: "Version",
      marketplaceScope: "Marketplace/Scope",
      skills: "Skills",
      commands: "Commands",
      mcp: "MCP",
      path: "Pfad"
    }
  },
  headings: {
    statusTitle: "# ellmos ControlCenter Status",
    localServers: (root) => `# Lokale MCP-Server in ${root}`,
    localRepos: "## Lokale MCP-Repos",
    claudeProfiles: (root) => root ? `# Claude-Profile in ${root}` : "## Claude-Profile",
    capabilityBundles: (root) => root ? `# Capability-Bundles in ${root}` : "## Capability-Bundles",
    details: "## Details",
    bundleRecommendation: "# Bundle-Empfehlung",
    profileRecommendation: "# Profilempfehlung",
    resolvedProfile: "# Aufgelöstes Profil",
    profileSwitchPrepared: "# Profilwechsel vorbereitet",
    profileAudit: "# Profil-Audit",
    mcpServers: "## MCP-Server",
    catalogCreated: "# Katalog erstellt",
    toolCatalog: "# MCP-Tool-Katalog",
    toolBundleAssignment: "# Tool-Bundle-Zuordnung",
    probeNotes: "## Probe-Hinweise",
    language: "# ControlCenter-Sprache",
    deployedSkills: (count) => `## Deployte Skills (${count})`,
    sourceOnlySkills: (count) => `## Nur-Quell-Skills (${count})`,
    claudeCodePlugins: (count) => `## Claude Code Plugins (${count})`,
    localModules: (count) => `## Lokale Module (${count})`
  },
  messages: {
    sourceLocalRepos: (root) => `Lokale MCP-Repos in ${root}`,
    sourceProfile: (profileName, profileRoot) => `Profil ${profileName} in ${profileRoot}`,
    recommendation: "Empfehlung",
    score: "Score",
    rationale: "Begründung",
    noStrongBundleMatches: "Keine starken Bundle-Treffer erkannt.",
    noStrongProfileKeywords: "Keine starken Keywords erkannt. Base-Profil als sichere Standardempfehlung.",
    profileRationale: (count, keywords) => `Empfohlen wegen ${count} passender Keywords: ${keywords}`,
    mcpRoot: "MCP-Root",
    profileRoot: "Profil-Root",
    localRepoCount: "Lokale MCP-Repos",
    profileCount: "Claude-Profile",
    serverProbes: "Server-Probes",
    failedProbes: "Nicht erfolgreiche Probes",
    policyRules: "Policy-Regeln",
    generatedConfig: "Generierte Konfiguration",
    serverCount: "Server",
    toolScan: "Tool-Scan",
    profileToolScan: "Profil-Tool-Scan",
    toolBundleAssignment: "Tool-Bundle-Zuordnung",
    resolvedServers: "aufgelöste Server",
    skillsRoot: "Skills-Root",
    sourceSkillsRoot: "Quell-Skills-Root",
    skipped: "(übersprungen)",
    pluginsRoot: "Plugins-Root",
    modulesRoot: "Module-Root",
    skillsTotal: (total, deployed, sourceOnly) => `Gesamt: ${total} (${deployed} deployt, ${sourceOnly} nur-Quelle)`,
    pluginsTotal: (total, plugins, modules) => `Gesamt: ${total} (${plugins} Plugins, ${modules} Module)`,
    noSkills: "Keine Skills gefunden.",
    noPlugins: "Keine Plugins oder Module gefunden."
  },
  policy: {
    invalidServerConfig: "Server-Konfiguration ist kein Objekt.",
    missingCommand: "Server hat keinen ausführbaren command-Eintrag.",
    npxRuntimeFetch: "Server wird über npx gestartet. Das ist bequem, aber weniger reproduzierbar als ein gepinnter lokaler Pfad.",
    envSecretsPresent: "Server-Konfiguration enthält Environment-Variablen. Werte werden absichtlich nicht ausgegeben.",
    sensitiveArgName: "Server-Argumente enthalten sensitive Namensbestandteile. Inhalte bitte separat prüfen.",
    noFindings: "Keine Policy-Hinweise im aufgelösten Profil gefunden."
  },
  toolDescriptions: {
    controlcenter_status: {
      title: "ControlCenter Status",
      description: "Zeigt einen Überblick über den lokalen MCP-Stack, lokale Server und Claude-Profile."
    },
    controlcenter_get_language: {
      title: "ControlCenter Sprache anzeigen",
      description: "Zeigt die aktuelle ControlCenter-Ausgabesprache und die unterstützten Sprachcodes."
    },
    controlcenter_set_language: {
      title: "ControlCenter Sprache setzen",
      description: "Setzt die ControlCenter-Ausgabesprache für diese laufende MCP-Serverinstanz."
    },
    controlcenter_list_local_servers: {
      title: "Lokale MCP-Server listen",
      description: "Scannt den lokalen MCP-Root und listet gefundene MCP-Repos mit Metadaten auf."
    },
    controlcenter_list_tools: {
      title: "MCP-Tools listen",
      description: "Startet lokale oder profildefinierte MCP-Server kontrolliert und liest deren echte Tool-Liste per MCP list_tools aus."
    },
    controlcenter_assign_tool_bundles: {
      title: "Tools Capability-Bundles zuordnen",
      description: "Ordnet echte MCP-Tools anhand ihrer Metadaten den ControlCenter-Capability-Bundles zu."
    },
    controlcenter_list_bundles: {
      title: "Capability-Bundles listen",
      description: "Gruppiert lokale MCP-Server in Aufgaben-Bundles wie Software, Filesystem, Automation und Control Plane."
    },
    controlcenter_suggest_bundles: {
      title: "Capability-Bundles empfehlen",
      description: "Empfiehlt passende Capability-Bundles für eine Aufgabenbeschreibung."
    },
    controlcenter_list_profiles: {
      title: "Claude-Profile listen",
      description: "Liest die lokalen Claude-Profile und zeigt Serveranzahl, Vererbung und Dateipfade."
    },
    controlcenter_suggest_profile: {
      title: "Profil empfehlen",
      description: "Empfiehlt ein Claude-Profil anhand der Aufgabenbeschreibung."
    },
    controlcenter_resolve_profile: {
      title: "Claude-Profil auflösen",
      description: "Löst ein Claude-Profil inklusive optionaler Vererbung auf und zeigt die resultierenden MCP-Server."
    },
    controlcenter_switch_profile: {
      title: "Profilwechsel vorbereiten",
      description: "Bereitet einen Profilwechsel vor, indem ein aufgelöstes --mcp-config-File erzeugt oder als Vorschau angezeigt wird."
    },
    controlcenter_audit_profile: {
      title: "Claude-Profil auditieren",
      description: "Prüft ein aufgelöstes Claude-Profil auf erste Policy-Hinweise wie npx-Starts, Env-Secrets und ungültige Server-Konfigurationen."
    },
    controlcenter_build_catalog: {
      title: "Lokalen Server-Katalog bauen",
      description: "Erzeugt einen JSON-Katalog der lokal gefundenen MCP-Server."
    },
    controlcenter_list_skills: {
      title: "Claude Code Skills listen",
      description: "Inventarisiert installierte Claude Code Skills aus dem deployte Skills-Ordner und der Quell-Skill-Bibliothek."
    },
    controlcenter_list_plugins: {
      title: "Plugins und Module listen",
      description: "Inventarisiert installierte Claude Code Plugins und lokale ellmos-Module mit ihren Fähigkeiten."
    }
  },
  inputDescriptions: {
    language: "Sprachcode für die ControlCenter-Ausgaben.",
    mcpRoot: "Optionaler MCP-Root. Standard ist der lokale ellmos-MCP-Ordner.",
    profileName: "Optionaler Profilname. Wenn gesetzt, werden die aufgelösten Server dieses Claude-Profils gescannt.",
    requiredProfileName: "Profilname ohne .json, zum Beispiel software oder ai-lab.",
    profileRoot: "Optionaler Profilordner. Standard ist ~/.claude/profiles.",
    serverName: "Optionaler Servername, Paketname, mcpName oder Profilservername für einen gezielten Scan.",
    simpleServerName: "Optionaler Servername für einen gezielten Scan.",
    timeoutMs: "Timeout pro MCP-Tool-Scan in Millisekunden. Standard: 5000.",
    listToolsTimeoutMs: "Timeout pro Connect- und list_tools-Anfrage in Millisekunden. Standard: 5000.",
    bundleConfigPath: "Optionaler Pfad zu einer Capability-Bundle-Konfiguration.",
    task: "Aufgabenbeschreibung oder Ziel der Session.",
    outputPath: "Optionaler Ausgabeort für die generierte MCP-Config.",
    write: "Wenn true, wird die generierte Config geschrieben. Sonst nur Vorschau.",
    policyConfigPath: "Optionaler Pfad zu einer Policy-Regel-Konfiguration.",
    catalogOutputPath: "Optionaler Ausgabeort für den JSON-Katalog.",
    includeTools: "Wenn true, werden lokale MCP-Server gestartet und echte list_tools-Ergebnisse in den Katalog aufgenommen.",
    includeToolAssignments: "Wenn true, werden Tool-Bundle-Zuordnungen für gescannte Tools in den Katalog aufgenommen.",
    skillsRoot: "Optionaler Pfad zum deployte Skills-Ordner. Standard ist ~/.claude/skills.",
    sourceSkillsRoot: "Optionaler Pfad zum Quell-Skill-Bibliotheks-Root. Standard ist der lokale .AI/.SKILLS/skills-Ordner.",
    pluginsRoot: "Optionaler Pfad zum Claude Code Plugins-Ordner. Standard ist ~/.claude/plugins.",
    modulesRoot: "Optionaler Pfad zum ellmos-Module-Ordner. Standard ist der lokale .AI/.MODULES-Ordner.",
    deployedOnly: "Wenn true, werden nur deployte Skills zurückgegeben und die Quell-Skill-Bibliothek nicht gescannt.",
    pluginsOnly: "Wenn true, werden nur Claude Code Plugins zurückgegeben und lokale Module nicht gescannt.",
    modulesOnly: "Wenn true, werden nur lokale Module zurückgegeben und Claude Code Plugins nicht gescannt."
  },
  dashboard: {
    loading: "lädt...",
    refresh: "Aktualisieren",
    writeConfig: "MCP-Config erzeugen",
    language: "Sprache",
    profile: "Profil",
    audit: "Audit",
    localServers: "Lokale Server",
    capabilityBundles: "Capability-Bundles",
    toolCatalog: "Tool-Katalog",
    toolBundleAssignment: "Tool-Bundle-Zuordnung",
    generatedConfig: "Generierte Konfiguration",
    toolScopeProfile: "Profil",
    toolScopeLocal: "Lokale Repos",
    scan: "Scannen",
    timeoutLabel: "Timeout in Millisekunden",
    noToolScan: "Noch kein Tool-Scan ausgeführt.",
    noAction: "Noch keine Aktion ausgeführt.",
    noDescription: "Keine Beschreibung",
    active: "aktiv",
    enableVerb: "aktivieren",
    disableVerb: "deaktivieren",
    confirmServerPrefix: "Server '",
    confirmServerMiddle: "' im Profil '",
    confirmServerSuffix: "? Vor dem Schreiben wird ein Backup erzeugt.",
    confirmWritePrefix: "Generierte MCP-Config für Profil '",
    confirmWriteSuffix: "' schreiben? Eine vorhandene Datei wird vorher gesichert.",
    scanRunning: "Scan läuft...",
    noToolsReported: "Keine Tools gemeldet.",
    noMatchingTools: "Keine passenden Tools.",
    serverOk: "Server OK",
    high: "high",
    warning: "warning",
    info: "info",
    resolvedServers: "aufgelöste Server",
    apiError: "API-Fehler"
  }
};
