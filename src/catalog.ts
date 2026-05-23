import * as fs from "fs/promises";
import * as path from "path";

export const DEFAULT_MCP_ROOT =
  process.env.ELLMOS_MCP_ROOT ?? "C:\\Users\\User\\OneDrive\\.TOPICS\\.AI\\.MCP";

const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".github",
  "_tools",
  "tests",
  "node_modules",
  "dist"
]);

export interface LocalServerSummary {
  directoryName: string;
  packageName: string;
  mcpName: string | null;
  version: string | null;
  description: string;
  absolutePath: string;
  binName: string | null;
  entryPoint: string | null;
  toolCount: number | null;
  hasServerJson: boolean;
  keywords: string[];
}

export interface McpServerConfig {
  command: string;
  args: string[];
}

interface PackageJsonShape {
  name?: string;
  version?: string;
  description?: string;
  mcpName?: string;
  main?: string;
  bin?: Record<string, string> | string;
  keywords?: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function extractToolCountFromDescription(description: string | undefined): number | null {
  if (!description) return null;
  const match = description.match(/\b(\d+)\s+tools?\b/i);
  if (!match) return null;
  return Number.parseInt(match[1], 10);
}

async function readJsonFile(filePath: string): Promise<unknown | null> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function discoverLocalServerDirectories(mcpRoot: string = DEFAULT_MCP_ROOT): Promise<string[]> {
  const entries = await fs.readdir(mcpRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !IGNORED_DIRECTORIES.has(name))
    .filter((name) => name.endsWith("-mcp"))
    .sort((a, b) => a.localeCompare(b));
}

export async function readLocalServerSummary(serverDirectory: string, mcpRoot: string = DEFAULT_MCP_ROOT): Promise<LocalServerSummary | null> {
  const absolutePath = path.join(mcpRoot, serverDirectory);
  const packagePath = path.join(absolutePath, "package.json");
  const serverJsonPath = path.join(absolutePath, "server.json");
  const packageJsonRaw = await readJsonFile(packagePath);
  if (!isRecord(packageJsonRaw)) {
    return null;
  }

  const packageJson = packageJsonRaw as PackageJsonShape;
  const binName =
    typeof packageJson.bin === "string"
      ? packageJson.name ?? null
      : isRecord(packageJson.bin)
        ? Object.keys(packageJson.bin)[0] ?? null
        : null;
  const entryPoint =
    typeof packageJson.bin === "string"
      ? packageJson.bin
      : isRecord(packageJson.bin) && binName
        ? String(packageJson.bin[binName])
        : packageJson.main ?? null;

  try {
    await fs.access(serverJsonPath);
  } catch {
    return {
      directoryName: serverDirectory,
      packageName: packageJson.name ?? serverDirectory,
      mcpName: packageJson.mcpName ?? null,
      version: packageJson.version ?? null,
      description: packageJson.description ?? "",
      absolutePath,
      binName,
      entryPoint,
      toolCount: extractToolCountFromDescription(packageJson.description),
      hasServerJson: false,
      keywords: Array.isArray(packageJson.keywords) ? packageJson.keywords.filter((item): item is string => typeof item === "string") : []
    };
  }

  return {
    directoryName: serverDirectory,
    packageName: packageJson.name ?? serverDirectory,
    mcpName: packageJson.mcpName ?? null,
    version: packageJson.version ?? null,
    description: packageJson.description ?? "",
    absolutePath,
    binName,
    entryPoint,
    toolCount: extractToolCountFromDescription(packageJson.description),
    hasServerJson: true,
    keywords: Array.isArray(packageJson.keywords) ? packageJson.keywords.filter((item): item is string => typeof item === "string") : []
  };
}

export async function scanLocalServers(mcpRoot: string = DEFAULT_MCP_ROOT): Promise<LocalServerSummary[]> {
  const directories = await discoverLocalServerDirectories(mcpRoot);
  const summaries = await Promise.all(directories.map((directory) => readLocalServerSummary(directory, mcpRoot)));
  return summaries.filter((item): item is LocalServerSummary => item !== null);
}

export function createLocalServerMcpConfig(server: LocalServerSummary): McpServerConfig {
  const entryPoint = server.entryPoint ?? "dist/index.js";
  return {
    command: "node",
    args: [path.join(server.absolutePath, entryPoint)]
  };
}
