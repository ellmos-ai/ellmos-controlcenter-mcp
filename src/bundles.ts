import type { LocalServerSummary } from "./catalog.js";

export interface CapabilityBundle {
  id: string;
  title: string;
  description: string;
  keywords: string[];
  serverCount: number;
  totalTools: number | null;
  servers: string[];
}

export interface BundleSuggestion {
  bundle: CapabilityBundle;
  score: number;
  matchedKeywords: string[];
}

interface BundleDefinition {
  id: string;
  title: string;
  description: string;
  keywords: string[];
}

const BUNDLE_DEFINITIONS: BundleDefinition[] = [
  {
    id: "core-local",
    title: "Core Local Stack",
    description: "Lokale ellmos-Basistools für Dateien, Code, Automatisierung und Steuerung.",
    keywords: ["ellmos", "bach", "local", "control", "commander", "mcp"]
  },
  {
    id: "software",
    title: "Software Development",
    description: "Codeanalyse, Build-Hilfen, Developer Tools und Repository-Arbeit.",
    keywords: ["code", "developer", "typescript", "python", "analysis", "json", "diff", "regex", "build"]
  },
  {
    id: "filesystem",
    title: "Filesystem Operations",
    description: "Dateiverwaltung, Suche, Prozesse, Archive und lokale Arbeitsordner.",
    keywords: ["file", "filesystem", "directory", "process", "zip", "archive", "ocr", "markdown"]
  },
  {
    id: "automation",
    title: "Automation",
    description: "n8n, Workflows, Automatisierung und wiederkehrende Abläufe.",
    keywords: ["n8n", "automation", "workflow", "workflows", "schedule", "trigger"]
  },
  {
    id: "control-plane",
    title: "Control Plane",
    description: "Profilverwaltung, Kataloge, Server-Discovery und spätere Policy-Schicht.",
    keywords: ["control", "profile", "catalog", "registry", "policy", "gateway", "discovery"]
  }
];

function buildHaystack(server: LocalServerSummary): string {
  return [
    server.directoryName,
    server.packageName,
    server.mcpName ?? "",
    server.description,
    server.keywords.join(" ")
  ].join(" ").toLowerCase();
}

function tokenize(value: string): Set<string> {
  return new Set(value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
}

function matchesKeyword(haystackTokens: Set<string>, keyword: string): boolean {
  const keywordTokens = keyword.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return keywordTokens.length > 0 && keywordTokens.every((token) => haystackTokens.has(token));
}

function matchesDefinition(server: LocalServerSummary, definition: BundleDefinition): boolean {
  const haystackTokens = tokenize(buildHaystack(server));
  return definition.keywords.some((keyword) => matchesKeyword(haystackTokens, keyword));
}

export function buildCapabilityBundles(servers: LocalServerSummary[]): CapabilityBundle[] {
  return BUNDLE_DEFINITIONS.map((definition) => {
    const matchedServers = servers
      .filter((server) => matchesDefinition(server, definition))
      .map((server) => server.packageName)
      .sort((a, b) => a.localeCompare(b));
    const toolCounts = servers
      .filter((server) => matchedServers.includes(server.packageName))
      .map((server) => server.toolCount)
      .filter((count): count is number => typeof count === "number");

    return {
      ...definition,
      serverCount: matchedServers.length,
      totalTools: toolCounts.length > 0 ? toolCounts.reduce((sum, count) => sum + count, 0) : null,
      servers: matchedServers
    };
  });
}

export function suggestCapabilityBundles(task: string, bundles: CapabilityBundle[]): BundleSuggestion[] {
  const taskTokens = tokenize(task);
  return bundles
    .map((bundle) => {
      const matchedKeywords = bundle.keywords.filter((keyword) => matchesKeyword(taskTokens, keyword));
      return {
        bundle,
        score: matchedKeywords.length,
        matchedKeywords
      };
    })
    .filter((suggestion) => suggestion.score > 0)
    .sort((a, b) => b.score - a.score || a.bundle.id.localeCompare(b.bundle.id));
}
