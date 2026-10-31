import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";

export const DEFAULT_PLUGINS_ROOT =
  process.env.ELLMOS_PLUGINS_ROOT ?? path.join(os.homedir(), ".claude", "plugins");

export const DEFAULT_CODEX_PLUGINS_ROOT =
  process.env.ELLMOS_CODEX_PLUGINS_ROOT ?? path.join(os.homedir(), ".codex", "plugins");

export const DEFAULT_ANTIGRAVITY_PLUGINS_ROOT =
  process.env.ELLMOS_ANTIGRAVITY_PLUGINS_ROOT ??
  path.join(os.homedir(), ".gemini", "config", "plugins");

export const DEFAULT_MODULES_ROOT =
  process.env.ELLMOS_MODULES_ROOT ?? getDefaultModulesRoot();

export function getDefaultModulesRoot(
  env: NodeJS.ProcessEnv = process.env,
  homeDirectory: string = os.homedir()
): string {
  const oneDriveRoot =
    firstNonEmptyPath(env.OneDrive, env.ONEDRIVE) ??
    path.join(homeDirectory, "OneDrive");
  return path.join(oneDriveRoot, ".TOPICS", ".AI", ".MODULES");
}

function firstNonEmptyPath(...values: Array<string | undefined>): string | null {
  for (const value of values) {
    if (value && value.trim().length > 0) {
      return value;
    }
  }
  return null;
}

export interface PluginSummary {
  name: string;
  type: "plugin" | "module";
  provider?: "claude-code" | "codex" | "antigravity" | "module";
  version: string | null;
  marketplace: string | null;
  scope: string | null;
  absolutePath: string;
  installedAt: string | null;
  lastUpdated: string | null;
  hasSkills: boolean;
  hasCommands: boolean;
  hasMcp: boolean;
}

// ──────────────────────────────────────────────
// installed_plugins.json shapes
// ──────────────────────────────────────────────

interface PluginInstall {
  scope?: string;
  installPath?: string;
  version?: string;
  installedAt?: string;
  lastUpdated?: string;
}

interface InstalledPluginsJson {
  version?: number;
  plugins?: Record<string, PluginInstall[]>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function readJsonFile(filePath: string): Promise<unknown | null> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Checks whether a directory (plugin install path) contains signs of skills, commands, or MCP.
 */
async function detectPluginCapabilities(installPath: string): Promise<{
  hasSkills: boolean;
  hasCommands: boolean;
  hasMcp: boolean;
}> {
  let entries: string[];
  try {
    const dirEntries = await fs.readdir(installPath, { withFileTypes: true });
    entries = dirEntries.map((e) => e.name.toLowerCase());
  } catch {
    return { hasSkills: false, hasCommands: false, hasMcp: false };
  }

  return {
    hasSkills: entries.includes("skills") || entries.includes("skill.md"),
    hasCommands: entries.includes("commands"),
    hasMcp:
      entries.some((e) => e.endsWith(".mcp.json")) ||
      entries.includes("mcp.json") ||
      entries.includes("mcp_config.json") ||
      entries.includes("server.json") ||
      entries.includes(".app.json")
  };
}

/**
 * Parses installed_plugins.json and returns a PluginSummary per install entry.
 */
export async function scanInstalledPlugins(
  pluginsRoot: string = DEFAULT_PLUGINS_ROOT
): Promise<PluginSummary[]> {
  const registryPath = path.join(pluginsRoot, "installed_plugins.json");
  const raw = await readJsonFile(registryPath);
  if (!isRecord(raw)) return [];

  const registry = raw as InstalledPluginsJson;
  if (!isRecord(registry.plugins)) return [];

  const results: PluginSummary[] = [];

  for (const [key, installs] of Object.entries(registry.plugins)) {
    if (!Array.isArray(installs)) continue;

    // key format: "pluginName@marketplace" or just "pluginName"
    const atIndex = key.lastIndexOf("@");
    const pluginName = atIndex >= 0 ? key.slice(0, atIndex) : key;
    const marketplace = atIndex >= 0 ? key.slice(atIndex + 1) : null;

    for (const install of installs) {
      if (!isRecord(install)) continue;

      const installPath = typeof install.installPath === "string" ? install.installPath : null;
      const capabilities = installPath
        ? await detectPluginCapabilities(installPath)
        : { hasSkills: false, hasCommands: false, hasMcp: false };

      results.push({
        name: pluginName,
        type: "plugin",
        provider: "claude-code",
        version: typeof install.version === "string" ? install.version : null,
        marketplace,
        scope: typeof install.scope === "string" ? install.scope : null,
        absolutePath: installPath ?? path.join(pluginsRoot, "cache", marketplace ?? "", pluginName),
        installedAt: typeof install.installedAt === "string" ? install.installedAt : null,
        lastUpdated: typeof install.lastUpdated === "string" ? install.lastUpdated : null,
        ...capabilities
      });
    }
  }

  return results;
}

// ──────────────────────────────────────────────
// Codex & Antigravity plugin scanning (read-only)
// ──────────────────────────────────────────────

async function readPluginManifest(
  pluginDir: string,
  candidates: string[]
): Promise<Record<string, unknown> | null> {
  for (const rel of candidates) {
    const parsed = await readJsonFile(path.join(pluginDir, rel));
    if (isRecord(parsed)) {
      return parsed as Record<string, unknown>;
    }
  }
  return null;
}

function isTransientPluginDir(name: string): boolean {
  return (
    name.startsWith(".") ||
    name === "node_modules" ||
    name.startsWith("plugin-backup-") ||
    name.startsWith("plugin-install-") ||
    name.startsWith("marketplace-plugin-source-") ||
    name.startsWith("remote-plugin-bundle-")
  );
}

/**
 * Scans locally installed OpenAI Codex plugins (`~/.codex/plugins/cache/<marketplace>/<plugin>/<version>`
 * or direct `<codexPluginsRoot>/<plugin>` directories) reading `plugin.json` or `.codex-plugin/plugin.json`.
 */
export async function scanCodexPlugins(
  codexPluginsRoot: string = DEFAULT_CODEX_PLUGINS_ROOT
): Promise<PluginSummary[]> {
  const results: PluginSummary[] = [];
  const manifestCandidates = [
    "plugin.json",
    path.join(".codex-plugin", "plugin.json"),
    path.join(".claude-plugin", "plugin.json")
  ];

  const inspectDir = async (
    installPath: string,
    fallbackName: string,
    marketplace: string | null,
    fallbackVersion: string | null
  ): Promise<PluginSummary | null> => {
    const manifest = await readPluginManifest(installPath, manifestCandidates);
    const capabilities = await detectPluginCapabilities(installPath);
    if (!manifest && !capabilities.hasSkills && !capabilities.hasCommands && !capabilities.hasMcp) {
      return null;
    }
    const name =
      manifest && typeof manifest["name"] === "string" && manifest["name"].trim()
        ? (manifest["name"] as string).trim()
        : fallbackName;
    const version =
      manifest && typeof manifest["version"] === "string" && manifest["version"].trim()
        ? (manifest["version"] as string).trim()
        : fallbackVersion;
    const hasManifestMcp = Boolean(manifest && manifest["mcpServers"]);
    return {
      name,
      type: "plugin",
      provider: "codex",
      version: version ?? null,
      marketplace: marketplace ?? "codex",
      scope: "codex",
      absolutePath: installPath,
      installedAt: null,
      lastUpdated: null,
      hasSkills: capabilities.hasSkills || Boolean(manifest && manifest["skills"]),
      hasCommands: capabilities.hasCommands,
      hasMcp: capabilities.hasMcp || hasManifestMcp
    };
  };

  // 1. Scan cache/<marketplace>/<plugin>/<version>
  const cacheRoot = path.join(codexPluginsRoot, "cache");
  try {
    const marketplaces = await fs.readdir(cacheRoot, { withFileTypes: true });
    for (const mpEntry of marketplaces) {
      if (!mpEntry.isDirectory() || isTransientPluginDir(mpEntry.name)) continue;
      const mpPath = path.join(cacheRoot, mpEntry.name);
      let pluginDirs: import("fs").Dirent[] = [];
      try {
        pluginDirs = await fs.readdir(mpPath, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const plugEntry of pluginDirs) {
        if (!plugEntry.isDirectory() || isTransientPluginDir(plugEntry.name)) continue;
        const plugPath = path.join(mpPath, plugEntry.name);
        // Check if plugPath itself has a manifest or if versions are nested one level deeper
        const directManifest = await readPluginManifest(plugPath, manifestCandidates);
        if (directManifest) {
          const item = await inspectDir(plugPath, plugEntry.name, mpEntry.name, null);
          if (item) results.push(item);
          continue;
        }
        let versionDirs: import("fs").Dirent[] = [];
        try {
          versionDirs = await fs.readdir(plugPath, { withFileTypes: true });
        } catch {
          continue;
        }
        for (const verEntry of versionDirs) {
          if (!verEntry.isDirectory() || isTransientPluginDir(verEntry.name)) continue;
          const verPath = path.join(plugPath, verEntry.name);
          const item = await inspectDir(verPath, plugEntry.name, mpEntry.name, verEntry.name);
          if (item) results.push(item);
        }
      }
    }
  } catch {
    // cache directory not present; check direct children below
  }

  // 2. Scan direct plugin directories under codexPluginsRoot (excluding cache/ and data/)
  try {
    const directEntries = await fs.readdir(codexPluginsRoot, { withFileTypes: true });
    for (const entry of directEntries) {
      if (
        !entry.isDirectory() ||
        entry.name === "cache" ||
        entry.name === "data" ||
        isTransientPluginDir(entry.name)
      ) {
        continue;
      }
      const dirPath = path.join(codexPluginsRoot, entry.name);
      const item = await inspectDir(dirPath, entry.name, "codex", null);
      if (item) results.push(item);
    }
  } catch {
    // root does not exist
  }

  return results;
}

/**
 * Scans locally installed Antigravity plugins (`~/.gemini/config/plugins/<plugin>`)
 * reading `plugin.json` or `gemini-extension.json`.
 */
export async function scanAntigravityPlugins(
  antigravityPluginsRoot: string = DEFAULT_ANTIGRAVITY_PLUGINS_ROOT
): Promise<PluginSummary[]> {
  let entries: import("fs").Dirent[];
  try {
    entries = await fs.readdir(antigravityPluginsRoot, { withFileTypes: true });
  } catch {
    return [];
  }

  const manifestCandidates = [
    "plugin.json",
    "gemini-extension.json",
    path.join(".antigravity-plugin", "plugin.json")
  ];

  const results: PluginSummary[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || isTransientPluginDir(entry.name)) continue;
    const pluginPath = path.join(antigravityPluginsRoot, entry.name);
    const manifest = await readPluginManifest(pluginPath, manifestCandidates);
    const capabilities = await detectPluginCapabilities(pluginPath);
    if (!manifest && !capabilities.hasSkills && !capabilities.hasCommands && !capabilities.hasMcp) {
      continue;
    }
    const name =
      manifest && typeof manifest["name"] === "string" && manifest["name"].trim()
        ? (manifest["name"] as string).trim()
        : entry.name;
    const version =
      manifest && typeof manifest["version"] === "string" && manifest["version"].trim()
        ? (manifest["version"] as string).trim()
        : null;
    results.push({
      name,
      type: "plugin",
      provider: "antigravity",
      version,
      marketplace: "antigravity",
      scope: "antigravity",
      absolutePath: pluginPath,
      installedAt: null,
      lastUpdated: null,
      ...capabilities
    });
  }

  return results;
}

/**
 * Scans installed plugins across Claude Code, OpenAI Codex, and Antigravity.
 */
export async function scanAllInstalledPlugins(
  claudePluginsRoot: string = DEFAULT_PLUGINS_ROOT,
  codexPluginsRoot: string = DEFAULT_CODEX_PLUGINS_ROOT,
  antigravityPluginsRoot: string = DEFAULT_ANTIGRAVITY_PLUGINS_ROOT
): Promise<PluginSummary[]> {
  const [claude, codex, antigravity] = await Promise.all([
    scanInstalledPlugins(claudePluginsRoot),
    scanCodexPlugins(codexPluginsRoot),
    scanAntigravityPlugins(antigravityPluginsRoot)
  ]);
  return [...claude, ...codex, ...antigravity];
}

// ──────────────────────────────────────────────
// .AI/.MODULES scanning
// ──────────────────────────────────────────────

interface EllmosModuleJson {
  id?: string;
  name?: string;
  version?: string;
  description?: string;
  type?: string;
  surfaces?: string[];
  resolved_source?: string;
}

interface EllmosModulesCatalog {
  schema?: string;
  modules?: unknown[];
}

async function readModuleVersion(modulePath: string): Promise<string | null> {
  // Priority 1: portable v2 module manifest
  const moduleV2Json = await readJsonFile(path.join(modulePath, "ellmos-module.v2.json"));
  if (isRecord(moduleV2Json) && typeof (moduleV2Json as Record<string, unknown>)["version"] === "string") {
    return (moduleV2Json as Record<string, unknown>)["version"] as string;
  }

  // Priority 2: legacy ellmos-module.json
  const moduleJson = await readJsonFile(path.join(modulePath, "ellmos-module.json"));
  if (isRecord(moduleJson) && typeof (moduleJson as Record<string, unknown>)["version"] === "string") {
    return (moduleJson as Record<string, unknown>)["version"] as string;
  }

  // Priority 3: package.json
  const pkgJson = await readJsonFile(path.join(modulePath, "package.json"));
  if (isRecord(pkgJson) && typeof (pkgJson as Record<string, unknown>)["version"] === "string") {
    return (pkgJson as Record<string, unknown>)["version"] as string;
  }

  // Priority 4: pyproject.toml — read first line match
  try {
    const pyproject = await fs.readFile(path.join(modulePath, "pyproject.toml"), "utf-8");
    const match = /version\s*=\s*["']([^"']+)["']/.exec(pyproject);
    if (match) return match[1];
  } catch {
    // not present
  }

  // Priority 5: VERSION file
  try {
    const versionContent = await fs.readFile(path.join(modulePath, "VERSION"), "utf-8");
    return versionContent.trim().split(/\r?\n/)[0] ?? null;
  } catch {
    // not present
  }

  return null;
}

async function detectModuleCapabilities(modulePath: string): Promise<{
  hasSkills: boolean;
  hasCommands: boolean;
  hasMcp: boolean;
}> {
  let entries: string[];
  try {
    const dirEntries = await fs.readdir(modulePath, { withFileTypes: true });
    entries = dirEntries.map((e) => e.name.toLowerCase());
  } catch {
    return { hasSkills: false, hasCommands: false, hasMcp: false };
  }

  return {
    hasSkills: entries.includes("skills") || entries.includes("skill.md"),
    hasCommands: entries.includes("commands"),
    hasMcp:
      entries.some((e) => e.endsWith(".mcp.json")) ||
      entries.includes("mcp.json") ||
      entries.includes("server.json")
  };
}

export async function scanModules(
  modulesRoot: string = DEFAULT_MODULES_ROOT
): Promise<PluginSummary[]> {
  const catalogRaw = await readJsonFile(path.join(modulesRoot, "modules.catalog.json"));
  if (isRecord(catalogRaw)) {
    const catalog = catalogRaw as EllmosModulesCatalog;
    if (catalog.schema === "ellmos.modules-catalog.v1" && Array.isArray(catalog.modules)) {
      const catalogModules = catalog.modules.filter(isRecord) as Array<Record<string, unknown>>;
      const results: Array<PluginSummary | null> = await Promise.all(
        catalogModules.map(async (moduleJson): Promise<PluginSummary | null> => {
          const moduleId = typeof moduleJson["id"] === "string" ? moduleJson["id"] as string : null;
          const resolvedSource = typeof moduleJson["resolved_source"] === "string"
            ? moduleJson["resolved_source"] as string
            : null;
          if (!moduleId || !resolvedSource) return null;
          const modulePath = path.resolve(modulesRoot, resolvedSource);
          const detected = await detectModuleCapabilities(modulePath);
          const surfaces = Array.isArray(moduleJson["surfaces"])
            ? moduleJson["surfaces"].filter((item): item is string => typeof item === "string")
            : [];
          return {
            name: moduleId,
            type: "module" as const,
            version: typeof moduleJson["version"] === "string"
              ? moduleJson["version"] as string
              : await readModuleVersion(modulePath),
            marketplace: null,
            scope: typeof moduleJson["category"] === "string" ? moduleJson["category"] as string : null,
            absolutePath: modulePath,
            installedAt: null,
            lastUpdated: null,
            hasSkills: detected.hasSkills || surfaces.includes("skill"),
            hasCommands: detected.hasCommands,
            hasMcp: detected.hasMcp || surfaces.includes("mcp-adapter")
          } satisfies PluginSummary;
        })
      );
      return results.filter((item): item is PluginSummary => item !== null);
    }
  }

  // Compatibility fallback for installations that do not have the v2 catalog yet.
  let entries: import("fs").Dirent[];
  try {
    entries = await fs.readdir(modulesRoot, { withFileTypes: true });
  } catch {
    return [];
  }

  const dirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => !name.startsWith(".") && name !== "node_modules");

  const results = await Promise.all(
    dirs.map(async (name) => {
      const modulePath = path.join(modulesRoot, name);

      const moduleJsonRaw = await readJsonFile(path.join(modulePath, "ellmos-module.json"));
      const moduleJson = isRecord(moduleJsonRaw) ? (moduleJsonRaw as EllmosModuleJson) : null;

      const version = await readModuleVersion(modulePath);
      const capabilities = await detectModuleCapabilities(modulePath);

      return {
        name: moduleJson?.name ?? name,
        type: "module" as const,
        version,
        marketplace: null,
        scope: null,
        absolutePath: modulePath,
        installedAt: null,
        lastUpdated: null,
        ...capabilities
      } satisfies PluginSummary;
    })
  );

  return results;
}

export async function scanPluginsAndModules(
  pluginsRoot: string = DEFAULT_PLUGINS_ROOT,
  modulesRoot: string = DEFAULT_MODULES_ROOT,
  codexPluginsRoot?: string,
  antigravityPluginsRoot?: string
): Promise<PluginSummary[]> {
  const [claudePlugins, codexPlugins, antigravityPlugins, modules] = await Promise.all([
    scanInstalledPlugins(pluginsRoot),
    codexPluginsRoot ? scanCodexPlugins(codexPluginsRoot) : Promise.resolve([]),
    antigravityPluginsRoot ? scanAntigravityPlugins(antigravityPluginsRoot) : Promise.resolve([]),
    scanModules(modulesRoot)
  ]);
  return [...claudePlugins, ...codexPlugins, ...antigravityPlugins, ...modules];
}
