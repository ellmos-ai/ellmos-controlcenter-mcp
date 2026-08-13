import * as fs from "fs/promises";
import * as path from "path";
import { DEFAULT_MCP_ROOT, readLocalServerSummary, type LocalServerSummary } from "./catalog.js";

export const MCP_CATALOG_FILENAME = "mcps.catalog.v1.json";
export const MCP_CATALOG_SCHEMA = "ellmos.mcps.v1";

/**
 * Why the catalog is (not) usable. Everything except "ok" degrades the
 * enriched fields to null instead of failing the surrounding tool call.
 */
export type McpCatalogStatus = "ok" | "missing" | "unreadable" | "schema_mismatch";

export interface McpCatalogEntry {
  id: string;
  mcpKind: string | null;
  namespace: string | null;
  npm: string | null;
  persistentState: boolean | null;
  /** namespace or store -> prose description of who owns that state */
  stateOwner: Record<string, string>;
  note: string | null;
  wraps: string | null;
  wrapsTarget: string | null;
  targetKind: string | null;
  composition: string | null;
  source: string | null;
}

export interface McpCatalog {
  status: McpCatalogStatus;
  catalogPath: string;
  schema: string | null;
  updated: string | null;
  maintainedBy: string | null;
  kinds: string[];
  entries: McpCatalogEntry[];
}

export interface EnrichedLocalServer extends LocalServerSummary {
  catalog: McpCatalogEntry | null;
}

export interface LocalServerLandscape {
  mcpRoot: string;
  rootReadable: boolean;
  servers: EnrichedLocalServer[];
  catalog: McpCatalog;
  /** Catalog entries without a matching directory below mcpRoot. */
  catalogOnly: McpCatalogEntry[];
}

const IGNORED_DIRECTORIES = new Set([".git", ".github", "_tools", "tests", "node_modules", "dist"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function stringMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") result[key] = entry;
  }
  return result;
}

export function getMcpCatalogPath(
  mcpRoot: string = DEFAULT_MCP_ROOT,
  env: NodeJS.ProcessEnv = process.env
): string {
  const override = env.ELLMOS_MCP_CATALOG;
  if (override && override.trim().length > 0) return override;
  return path.join(mcpRoot, MCP_CATALOG_FILENAME);
}

function emptyCatalog(status: McpCatalogStatus, catalogPath: string, schema: string | null = null): McpCatalog {
  return { status, catalogPath, schema, updated: null, maintainedBy: null, kinds: [], entries: [] };
}

function readCatalogEntry(value: unknown): McpCatalogEntry | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;
  return {
    id: value.id,
    mcpKind: optionalString(value.mcp_kind),
    namespace: optionalString(value.namespace),
    npm: optionalString(value.npm),
    persistentState: typeof value.persistent_state === "boolean" ? value.persistent_state : null,
    stateOwner: stringMap(value.state_owner),
    note: optionalString(value.note),
    wraps: optionalString(value.wraps),
    wrapsTarget: optionalString(value.wraps_target),
    targetKind: optionalString(value.target_kind),
    composition: optionalString(value.composition),
    source: optionalString(value.source)
  };
}

/**
 * Reads the hand-curated MCP catalog. Never throws: a missing, unreadable or
 * foreign-schema catalog is reported through `status` so callers can degrade.
 */
export async function loadMcpCatalog(
  mcpRoot: string = DEFAULT_MCP_ROOT,
  env: NodeJS.ProcessEnv = process.env
): Promise<McpCatalog> {
  const catalogPath = getMcpCatalogPath(mcpRoot, env);

  let raw: string;
  try {
    raw = await fs.readFile(catalogPath, "utf-8");
  } catch {
    return emptyCatalog("missing", catalogPath);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyCatalog("unreadable", catalogPath);
  }

  if (!isRecord(parsed)) return emptyCatalog("unreadable", catalogPath);

  const schema = optionalString(parsed.schema);
  if (schema !== MCP_CATALOG_SCHEMA || !Array.isArray(parsed.mcps)) {
    return emptyCatalog("schema_mismatch", catalogPath, schema);
  }

  return {
    status: "ok",
    catalogPath,
    schema,
    updated: optionalString(parsed.updated),
    maintainedBy: optionalString(parsed.maintained_by),
    kinds: stringArray(parsed.kinds),
    entries: parsed.mcps
      .map(readCatalogEntry)
      .filter((entry): entry is McpCatalogEntry => entry !== null)
  };
}

/**
 * Joins on the catalog id first (matches the directory name for every server
 * shipped today) and falls back to the npm package name, which is the one
 * field that legitimately differs — e.g. blender-use-mcp publishes as
 * ellmos-blender-use-mcp.
 */
export function findCatalogEntry(
  catalog: McpCatalog,
  keys: { directoryName?: string | null; packageName?: string | null }
): McpCatalogEntry | null {
  const directoryName = keys.directoryName ?? null;
  const packageName = keys.packageName ?? null;

  for (const entry of catalog.entries) {
    if (directoryName && entry.id === directoryName) return entry;
  }
  for (const entry of catalog.entries) {
    if (packageName && (entry.npm === packageName || entry.id === packageName)) return entry;
  }
  return null;
}

async function listServerDirectories(mcpRoot: string): Promise<string[] | null> {
  try {
    const entries = await fs.readdir(mcpRoot, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => !IGNORED_DIRECTORIES.has(name))
      .filter((name) => name.endsWith("-mcp"))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return null;
  }
}

/**
 * Directory scan plus catalog enrichment, reported in both directions:
 * scanned servers carry their catalog entry (or null), and catalog entries
 * without a directory are surfaced separately instead of vanishing.
 */
export async function scanLocalServerLandscape(
  mcpRoot: string = DEFAULT_MCP_ROOT,
  env: NodeJS.ProcessEnv = process.env
): Promise<LocalServerLandscape> {
  const [directories, catalog] = await Promise.all([
    listServerDirectories(mcpRoot),
    loadMcpCatalog(mcpRoot, env)
  ]);

  if (directories === null) {
    return { mcpRoot, rootReadable: false, servers: [], catalog, catalogOnly: catalog.entries };
  }

  const summaries = await Promise.all(
    directories.map((directory) => readLocalServerSummary(directory, mcpRoot))
  );

  const servers: EnrichedLocalServer[] = summaries
    .filter((item): item is LocalServerSummary => item !== null)
    .map((server) => ({
      ...server,
      catalog: findCatalogEntry(catalog, {
        directoryName: server.directoryName,
        packageName: server.packageName
      })
    }));

  const matchedIds = new Set(
    servers.flatMap((server) => (server.catalog ? [server.catalog.id] : []))
  );

  return {
    mcpRoot,
    rootReadable: true,
    servers,
    catalog,
    catalogOnly: catalog.entries.filter((entry) => !matchedIds.has(entry.id))
  };
}

export interface McpServerDescription {
  serverId: string;
  server: EnrichedLocalServer | null;
  entry: McpCatalogEntry | null;
  catalog: McpCatalog;
  mcpRoot: string;
}

/**
 * Resolves one server by directory name, catalog id or npm package name.
 * Returns null only when neither the directory nor the catalog knows it.
 */
export async function describeMcpServer(
  serverId: string,
  mcpRoot: string = DEFAULT_MCP_ROOT,
  env: NodeJS.ProcessEnv = process.env
): Promise<McpServerDescription | null> {
  const landscape = await scanLocalServerLandscape(mcpRoot, env);
  const needle = serverId.trim().toLowerCase();

  const server =
    landscape.servers.find(
      (candidate) =>
        candidate.directoryName.toLowerCase() === needle ||
        candidate.packageName.toLowerCase() === needle ||
        candidate.catalog?.id.toLowerCase() === needle
    ) ?? null;

  const entry =
    server?.catalog ??
    landscape.catalog.entries.find(
      (candidate) => candidate.id.toLowerCase() === needle || candidate.npm?.toLowerCase() === needle
    ) ??
    null;

  if (!server && !entry) return null;

  return { serverId, server, entry, catalog: landscape.catalog, mcpRoot: landscape.mcpRoot };
}
