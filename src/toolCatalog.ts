import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  createLocalServerMcpConfig,
  scanLocalServers,
  type LocalServerSummary
} from "./catalog.js";
import { t } from "./i18n/index.js";
import { resolveMcpProfile, type ResolvedProfile } from "./profiles.js";

export const DEFAULT_TOOL_SCAN_TIMEOUT_MS = 5000;

export type ToolCatalogSource = "local-repository" | "profile";
export type ToolCatalogTransportKind = "stdio" | "streamable-http" | "sse" | "unsupported";
export type ToolCatalogStatus = "ok" | "failed" | "unsupported";

export interface McpToolSummary {
  name: string;
  title: string | null;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: Record<string, unknown> | null;
}

export interface ServerToolCatalog {
  source: ToolCatalogSource;
  profileName: string | null;
  directoryName: string;
  packageName: string;
  mcpName: string | null;
  status: ToolCatalogStatus;
  transportKind: ToolCatalogTransportKind;
  command: string | null;
  args: string[];
  url: string | null;
  durationMs: number;
  toolCount: number | null;
  tools: McpToolSummary[];
  error: string | null;
}

export interface ToolCatalogOptions {
  timeoutMs?: number;
  serverName?: string;
}

export interface ToolCatalogTarget {
  source: ToolCatalogSource;
  profileName: string | null;
  directoryName: string;
  packageName: string;
  mcpName: string | null;
  transportKind: ToolCatalogTransportKind;
  command: string | null;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
  url: string | null;
  headers?: Record<string, string>;
  error: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeToolScanTimeout(timeoutMs: number | undefined): number {
  if (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs)) {
    return DEFAULT_TOOL_SCAN_TIMEOUT_MS;
  }
  return Math.min(Math.max(Math.trunc(timeoutMs), 500), 60000);
}

export function filterTargetsForToolScan(
  targets: ToolCatalogTarget[],
  serverName?: string
): ToolCatalogTarget[] {
  if (!serverName || serverName.trim().length === 0) {
    return targets;
  }

  const normalizedName = serverName.trim().toLowerCase();
  return targets.filter((target) =>
    [
      target.directoryName,
      target.packageName,
      target.mcpName ?? "",
      target.profileName ?? ""
    ].some((value) => value.toLowerCase() === normalizedName)
  );
}

export function filterServersForToolScan(
  servers: LocalServerSummary[],
  serverName?: string
): LocalServerSummary[] {
  if (!serverName || serverName.trim().length === 0) {
    return servers;
  }

  const normalizedName = serverName.trim().toLowerCase();
  return servers.filter((server) =>
    [
      server.directoryName,
      server.packageName,
      server.mcpName ?? "",
      server.binName ?? ""
    ].some((value) => value.toLowerCase() === normalizedName)
  );
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asStringRecord(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const entries = Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string");
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function transportMarker(value: unknown): string {
  if (typeof value === "string") {
    return value.toLowerCase();
  }
  if (isRecord(value) && typeof value.type === "string") {
    return value.type.toLowerCase();
  }
  return "";
}

function detectProfileTransportKind(config: Record<string, unknown>): ToolCatalogTransportKind {
  if (typeof config.command === "string" && config.command.trim().length > 0) {
    return "stdio";
  }
  if (typeof config.url === "string" && config.url.trim().length > 0) {
    const marker = `${transportMarker(config.transport)} ${transportMarker(config.type)}`;
    return marker.includes("sse") ? "sse" : "streamable-http";
  }
  return "unsupported";
}

function sensitiveName(value: string): boolean {
  return /token|secret|password|passwd|credential|api[-_]?key|auth/i.test(value);
}

function maskSensitiveArg(arg: string): string {
  const assignmentMatch = arg.match(/^([^=]+)=(.*)$/);
  if (assignmentMatch && sensitiveName(assignmentMatch[1])) {
    return `${assignmentMatch[1]}=***`;
  }
  return sensitiveName(arg) ? "***" : arg;
}

function maskSensitiveArgs(args: string[]): string[] {
  return args.map((arg, index) => {
    const previousArg = args[index - 1] ?? "";
    if (index > 0 && sensitiveName(previousArg)) {
      return "***";
    }
    return maskSensitiveArg(arg);
  });
}

function maskUrl(urlValue: string | null): string | null {
  if (!urlValue) {
    return null;
  }
  try {
    const url = new URL(urlValue);
    for (const key of [...url.searchParams.keys()]) {
      if (sensitiveName(key)) {
        url.searchParams.set(key, "***");
      }
    }
    return url.toString();
  } catch {
    return urlValue;
  }
}

function normalizeTool(tool: {
  name: string;
  title?: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  annotations?: Record<string, unknown>;
}): McpToolSummary {
  return {
    name: tool.name,
    title: typeof tool.title === "string" ? tool.title : null,
    description: typeof tool.description === "string" ? tool.description : "",
    inputSchema: isRecord(tool.inputSchema) ? tool.inputSchema : { type: "object" },
    annotations: isRecord(tool.annotations) ? tool.annotations : null
  };
}

export function createLocalServerToolTarget(server: LocalServerSummary): ToolCatalogTarget {
  const config = createLocalServerMcpConfig(server);
  return {
    source: "local-repository",
    profileName: null,
    directoryName: server.directoryName,
    packageName: server.packageName,
    mcpName: server.mcpName,
    transportKind: "stdio",
    command: config.command,
    args: config.args,
    cwd: server.absolutePath,
    url: null,
    error: null
  };
}

function createUnsupportedProfileTarget(
  profileName: string,
  serverName: string,
  error: string
): ToolCatalogTarget {
  return {
    source: "profile",
    profileName,
    directoryName: `${profileName}/${serverName}`,
    packageName: serverName,
    mcpName: null,
    transportKind: "unsupported",
    command: null,
    args: [],
    url: null,
    error
  };
}

export function createProfileToolCatalogTargets(profile: ResolvedProfile): ToolCatalogTarget[] {
  return Object.entries(profile.config.mcpServers)
    .map<ToolCatalogTarget>(([serverName, rawConfig]) => {
      if (!isRecord(rawConfig)) {
        return createUnsupportedProfileTarget(profile.name, serverName, t().common.serverConfigNotObject);
      }

      const transportKind = detectProfileTransportKind(rawConfig);
      if (transportKind === "unsupported") {
        return createUnsupportedProfileTarget(profile.name, serverName, t().common.noSupportedStartForm);
      }

      const url = typeof rawConfig.url === "string" && rawConfig.url.trim().length > 0 ? rawConfig.url.trim() : null;
      return {
        source: "profile",
        profileName: profile.name,
        directoryName: `${profile.name}/${serverName}`,
        packageName: serverName,
        mcpName: null,
        transportKind,
        command: typeof rawConfig.command === "string" ? rawConfig.command : null,
        args: asStringArray(rawConfig.args),
        cwd: typeof rawConfig.cwd === "string" ? rawConfig.cwd : undefined,
        env: asStringRecord(rawConfig.env),
        url,
        headers: asStringRecord(rawConfig.headers),
        error: null
      };
    })
    .sort((a, b) => a.packageName.localeCompare(b.packageName));
}

function createTransport(target: ToolCatalogTarget): Transport | null {
  if (target.transportKind === "stdio" && target.command) {
    const transport = new StdioClientTransport({
      command: target.command,
      args: target.args,
      cwd: target.cwd,
      env: target.env,
      stderr: "pipe"
    });
    transport.stderr?.on("data", () => {
      // Drain stderr so noisy servers cannot block the probe. Values are not returned to avoid leaking secrets.
    });
    return transport;
  }

  if (target.transportKind === "streamable-http" && target.url) {
    return new StreamableHTTPClientTransport(new URL(target.url), {
      requestInit: target.headers ? { headers: target.headers } : undefined
    });
  }

  if (target.transportKind === "sse" && target.url) {
    return new SSEClientTransport(new URL(target.url), {
      requestInit: target.headers ? { headers: target.headers } : undefined
    });
  }

  return null;
}

function createBaseCatalogEntry(
  target: ToolCatalogTarget,
  status: ToolCatalogStatus,
  startedAt: number,
  error: string | null,
  tools: McpToolSummary[] = []
): ServerToolCatalog {
  return {
    source: target.source,
    profileName: target.profileName,
    directoryName: target.directoryName,
    packageName: target.packageName,
    mcpName: target.mcpName,
    status,
    transportKind: target.transportKind,
    command: target.command,
    args: maskSensitiveArgs(target.args),
    url: maskUrl(target.url),
    durationMs: Date.now() - startedAt,
    toolCount: status === "ok" ? tools.length : null,
    tools,
    error
  };
}

export async function readToolCatalogTarget(
  target: ToolCatalogTarget,
  options: ToolCatalogOptions = {}
): Promise<ServerToolCatalog> {
  const timeoutMs = normalizeToolScanTimeout(options.timeoutMs);
  const startedAt = Date.now();
  if (target.transportKind === "unsupported") {
    return createBaseCatalogEntry(target, "unsupported", startedAt, target.error ?? t().common.unsupportedStartForm);
  }

  let transport: Transport | null = null;
  const client = new Client(
    { name: "ellmos-controlcenter-tool-catalog", version: "0.1.0-alpha.8" },
    { capabilities: {} }
  );

  try {
    transport = createTransport(target);
    if (!transport) {
      return createBaseCatalogEntry(target, "unsupported", startedAt, target.error ?? t().common.unsupportedStartForm);
    }
    await client.connect(transport, { timeout: timeoutMs });
    const result = await client.listTools(undefined, { timeout: timeoutMs });
    const tools = result.tools
      .map(normalizeTool)
      .sort((a, b) => a.name.localeCompare(b.name));

    return createBaseCatalogEntry(target, "ok", startedAt, null, tools);
  } catch (error) {
    return createBaseCatalogEntry(target, "failed", startedAt, formatError(error));
  } finally {
    try {
      await client.close();
    } catch {
      // Best-effort cleanup; failed probes should not keep the catalog run alive.
    }
    if (transport) try {
      await transport.close();
    } catch {
      // Best-effort cleanup; the transport may already have been closed by the client.
    }
  }
}

export async function readServerToolCatalog(
  server: LocalServerSummary,
  options: ToolCatalogOptions = {}
): Promise<ServerToolCatalog> {
  return readToolCatalogTarget(createLocalServerToolTarget(server), options);
}

export async function buildToolCatalog(
  servers: LocalServerSummary[],
  options: ToolCatalogOptions = {}
): Promise<ServerToolCatalog[]> {
  const selectedServers = filterServersForToolScan(servers, options.serverName);
  const catalogs: ServerToolCatalog[] = [];
  for (const server of selectedServers) {
    catalogs.push(await readServerToolCatalog(server, options));
  }
  return catalogs;
}

export async function scanLocalServerTools(
  mcpRoot: string,
  options: ToolCatalogOptions = {}
): Promise<ServerToolCatalog[]> {
  return buildToolCatalog(await scanLocalServers(mcpRoot), options);
}

export async function scanProfileServerTools(
  profileName: string,
  profileRoot: string,
  options: ToolCatalogOptions = {}
): Promise<ServerToolCatalog[]> {
  const profile = await resolveMcpProfile(profileName, profileRoot);
  const targets = filterTargetsForToolScan(createProfileToolCatalogTargets(profile), options.serverName);
  const catalogs: ServerToolCatalog[] = [];
  for (const target of targets) {
    catalogs.push(await readToolCatalogTarget(target, options));
  }
  return catalogs;
}
