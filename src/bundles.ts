import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";
import type { LocalServerSummary } from "./catalog.js";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const DEFAULT_BUNDLE_CONFIG_PATH =
  process.env.ELLMOS_BUNDLE_CONFIG ?? path.join(PROJECT_ROOT, "data", "capability-bundles.json");

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

export interface BundleDefinition {
  id: string;
  title: string;
  description: string;
  keywords: string[];
}

export class BundleConfigError extends Error {
  readonly name = "BundleConfigError";

  constructor(
    message: string,
    readonly code: string,
    readonly details: Record<string, unknown> = {}
  ) {
    super(message);
  }
}

export const DEFAULT_BUNDLE_DEFINITIONS: BundleDefinition[] = [
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneDefinitions(definitions: BundleDefinition[]): BundleDefinition[] {
  return definitions.map((definition) => ({
    ...definition,
    keywords: [...definition.keywords]
  }));
}

function readRequiredString(value: Record<string, unknown>, fieldName: string, configPath: string, index: number): string {
  const rawValue = value[fieldName];
  if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
    throw new BundleConfigError(
      `Bundle definition at index ${index} in ${configPath} must define a non-empty '${fieldName}' string.`,
      "bundle-schema-invalid",
      { configPath, index, fieldName }
    );
  }
  return rawValue.trim();
}

function readKeywords(value: Record<string, unknown>, configPath: string, index: number): string[] {
  const rawKeywords = value.keywords;
  if (!Array.isArray(rawKeywords)) {
    throw new BundleConfigError(
      `Bundle definition at index ${index} in ${configPath} must define a 'keywords' array.`,
      "bundle-schema-invalid",
      { configPath, index, fieldName: "keywords" }
    );
  }
  const keywords = rawKeywords
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  if (keywords.length === 0) {
    throw new BundleConfigError(
      `Bundle definition at index ${index} in ${configPath} must contain at least one keyword.`,
      "bundle-schema-invalid",
      { configPath, index, fieldName: "keywords" }
    );
  }
  return [...new Set(keywords)];
}

function normalizeBundleDefinition(value: unknown, configPath: string, index: number): BundleDefinition {
  if (!isRecord(value)) {
    throw new BundleConfigError(
      `Bundle definition at index ${index} in ${configPath} must be a JSON object.`,
      "bundle-schema-invalid",
      { configPath, index }
    );
  }
  return {
    id: readRequiredString(value, "id", configPath, index),
    title: readRequiredString(value, "title", configPath, index),
    description: readRequiredString(value, "description", configPath, index),
    keywords: readKeywords(value, configPath, index)
  };
}

function extractRawDefinitions(rawConfig: unknown, configPath: string): unknown[] {
  if (Array.isArray(rawConfig)) {
    return rawConfig;
  }
  if (isRecord(rawConfig) && Array.isArray(rawConfig.bundles)) {
    return rawConfig.bundles;
  }
  throw new BundleConfigError(
    `Bundle config ${configPath} must be an array or an object with a 'bundles' array.`,
    "bundle-schema-invalid",
    { configPath }
  );
}

function normalizeBundleDefinitions(rawConfig: unknown, configPath: string): BundleDefinition[] {
  const definitions = extractRawDefinitions(rawConfig, configPath).map((definition, index) =>
    normalizeBundleDefinition(definition, configPath, index)
  );
  const seen = new Set<string>();
  for (const definition of definitions) {
    if (seen.has(definition.id)) {
      throw new BundleConfigError(
        `Bundle config ${configPath} contains duplicate bundle id '${definition.id}'.`,
        "bundle-id-duplicate",
        { configPath, bundleId: definition.id }
      );
    }
    seen.add(definition.id);
  }
  return definitions;
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

export async function loadBundleDefinitions(configPath: string = DEFAULT_BUNDLE_CONFIG_PATH): Promise<BundleDefinition[]> {
  let raw: string;
  try {
    raw = await fs.readFile(configPath, "utf-8");
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      return cloneDefinitions(DEFAULT_BUNDLE_DEFINITIONS);
    }
    throw new BundleConfigError(
      `Bundle config ${configPath} could not be read: ${error instanceof Error ? error.message : String(error)}`,
      "bundle-read-failed",
      { configPath }
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new BundleConfigError(
      `Bundle config ${configPath} contains invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      "bundle-json-invalid",
      { configPath }
    );
  }

  return normalizeBundleDefinitions(parsed, configPath);
}

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

export function buildCapabilityBundles(
  servers: LocalServerSummary[],
  definitions: BundleDefinition[] = DEFAULT_BUNDLE_DEFINITIONS
): CapabilityBundle[] {
  return definitions.map((definition) => {
    const matchedServers = servers
      .filter((server) => matchesDefinition(server, definition))
      .sort((a, b) => a.packageName.localeCompare(b.packageName));
    const toolCounts = matchedServers
      .map((server) => server.toolCount)
      .filter((count): count is number => typeof count === "number");

    return {
      ...definition,
      serverCount: matchedServers.length,
      totalTools: toolCounts.length > 0 ? toolCounts.reduce((sum, count) => sum + count, 0) : null,
      servers: matchedServers.map((server) => server.packageName)
    };
  });
}

export async function loadCapabilityBundles(
  servers: LocalServerSummary[],
  configPath: string = DEFAULT_BUNDLE_CONFIG_PATH
): Promise<CapabilityBundle[]> {
  return buildCapabilityBundles(servers, await loadBundleDefinitions(configPath));
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
