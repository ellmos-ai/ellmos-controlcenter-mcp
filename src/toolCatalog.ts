import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { FetchLike, Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  createLocalServerMcpConfig,
  scanLocalServers,
  type LocalServerSummary
} from "./catalog.js";
import { t } from "./i18n/index.js";
import { resolveMcpProfile, type ResolvedProfile } from "./profiles.js";
import { prepareSupervisedStdioLaunch } from "./processSupervisor.js";

export const DEFAULT_TOOL_SCAN_TIMEOUT_MS = 5000;
export const DEFAULT_TOOL_SCAN_MAX_PARALLEL_PROBES = 4;
export const DEFAULT_TOOL_SCAN_MAX_RESPONSE_BYTES = 1024 * 1024;
export const TOOL_SCAN_HEADER_CONTRACT = "ellmos.tool-scan-headers.v1";
const MIN_TOOL_SCAN_PARALLEL_PROBES = 1;
const MAX_TOOL_SCAN_PARALLEL_PROBES = 32;
const MIN_TOOL_SCAN_RESPONSE_BYTES = 1024;
const MAX_TOOL_SCAN_RESPONSE_BYTES = 16 * 1024 * 1024;

export type ToolCatalogSource = "local-repository" | "profile";
export type ToolCatalogTransportKind = "stdio" | "streamable-http" | "sse" | "unsupported";
export type ToolCatalogStatus = "ok" | "failed" | "incomplete" | "unsupported";

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
  /** False means that the target was not fully probed; no success is implied. */
  complete: boolean;
}

export interface ToolScanBudget {
  maxResponseBytes: number;
  usedResponseBytes: number;
}

export interface ToolCatalogOptions {
  timeoutMs?: number;
  serverName?: string;
  maxParallelProbes?: number;
  maxResponseBytes?: number;
  /** Shared by one aggregate scan; callers normally leave this unset. */
  budget?: ToolScanBudget;
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

export function normalizeToolScanParallelism(maxParallelProbes: number | undefined): number {
  if (typeof maxParallelProbes !== "number" || !Number.isFinite(maxParallelProbes)) {
    return DEFAULT_TOOL_SCAN_MAX_PARALLEL_PROBES;
  }
  return Math.min(Math.max(Math.trunc(maxParallelProbes), MIN_TOOL_SCAN_PARALLEL_PROBES), MAX_TOOL_SCAN_PARALLEL_PROBES);
}

export function normalizeToolScanResponseBytes(maxResponseBytes: number | undefined): number {
  if (typeof maxResponseBytes !== "number" || !Number.isFinite(maxResponseBytes)) {
    return DEFAULT_TOOL_SCAN_MAX_RESPONSE_BYTES;
  }
  return Math.min(Math.max(Math.trunc(maxResponseBytes), MIN_TOOL_SCAN_RESPONSE_BYTES), MAX_TOOL_SCAN_RESPONSE_BYTES);
}

export function createToolScanBudget(maxResponseBytes: number | undefined = undefined): ToolScanBudget {
  return {
    maxResponseBytes: normalizeToolScanResponseBytes(maxResponseBytes),
    usedResponseBytes: 0
  };
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

class ToolScanResponseBudgetExceeded extends Error {
  constructor() {
    super("response budget exceeded");
    this.name = "ToolScanResponseBudgetExceeded";
  }
}

function reserveResponseBytes(budget: ToolScanBudget, bytes: number): boolean {
  if (bytes <= 0) return true;
  if (budget.usedResponseBytes + bytes > budget.maxResponseBytes) return false;
  budget.usedResponseBytes += bytes;
  return true;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sanitizeError(error: unknown, target: ToolCatalogTarget): string {
  let message = formatError(error);
  const sensitiveValues = [
    ...Object.values(target.headers ?? {}),
    ...Object.values(target.env ?? {})
  ].filter((value) => value.length > 0);
  for (const value of sensitiveValues) {
    message = message.split(value).join("***");
  }
  if (target.url) {
    message = message.split(target.url).join(maskUrl(target.url) ?? "***");
  }
  return message;
}

function budgetedFetch(budget: ToolScanBudget): FetchLike {
  const fetchImpl = globalThis.fetch.bind(globalThis) as FetchLike;
  return async (url, init) => {
    const response = await fetchImpl(url, init);
    if (!response.body) return response;

    const reader = response.body.getReader();
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          if (done) {
            controller.close();
            return;
          }
          const bytes = value?.byteLength ?? 0;
          if (!reserveResponseBytes(budget, bytes)) {
            await reader.cancel();
            controller.error(new ToolScanResponseBudgetExceeded());
            return;
          }
          controller.enqueue(value);
        } catch (error) {
          controller.error(error);
        }
      },
      cancel(reason) {
        return reader.cancel(reason);
      }
    });

    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  };
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

export function maskSensitiveArgs(args: string[]): string[] {
  return args.map((arg, index) => {
    const previousArg = args[index - 1] ?? "";
    if (index > 0 && sensitiveName(previousArg)) {
      return "***";
    }
    return maskSensitiveArg(arg);
  });
}

export function maskUrl(urlValue: string | null): string | null {
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

export interface TransportHardening {
  /** Pass "error" to refuse HTTP redirects on remote transports. */
  redirect?: RequestRedirect;
  /** Wrap all remote response bodies so one aggregate scan budget is enforced. */
  fetch?: FetchLike;
}

export function createTransport(
  target: ToolCatalogTarget,
  hardening: TransportHardening = {}
): Transport | null {
  const requestInit: RequestInit | undefined =
    target.headers || hardening.redirect
      ? {
          ...(target.headers ? { headers: target.headers } : {}),
          ...(hardening.redirect ? { redirect: hardening.redirect } : {})
        }
      : undefined;

  if (target.transportKind === "stdio" && target.command) {
    const launch = prepareSupervisedStdioLaunch(target.command, target.args, target.env);
    const transport = new StdioClientTransport({
      command: launch.command,
      args: launch.args,
      cwd: target.cwd,
      env: launch.env,
      stderr: "pipe"
    });
    transport.stderr?.on("data", () => {
      // Drain stderr so noisy servers cannot block the probe. Values are not returned to avoid leaking secrets.
    });
    return transport;
  }

  if (target.transportKind === "streamable-http" && target.url) {
    return new StreamableHTTPClientTransport(new URL(target.url), { requestInit, fetch: hardening.fetch });
  }

  if (target.transportKind === "sse" && target.url) {
    return new SSEClientTransport(new URL(target.url), { requestInit, fetch: hardening.fetch });
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
    error,
    complete: status === "ok"
  };
}

function createIncompleteCatalogEntry(
  target: ToolCatalogTarget,
  reason: string,
  startedAt = Date.now()
): ServerToolCatalog {
  return createBaseCatalogEntry(target, "incomplete", startedAt, reason);
}

export async function readToolCatalogTarget(
  target: ToolCatalogTarget,
  options: ToolCatalogOptions = {}
): Promise<ServerToolCatalog> {
  const timeoutMs = normalizeToolScanTimeout(options.timeoutMs);
  const budget = options.budget ?? createToolScanBudget(options.maxResponseBytes);
  const startedAt = Date.now();
  if (target.transportKind === "unsupported") {
    return createBaseCatalogEntry(target, "unsupported", startedAt, target.error ?? t().common.unsupportedStartForm);
  }
  if (budget.usedResponseBytes >= budget.maxResponseBytes) {
    return createIncompleteCatalogEntry(target, "not scanned: aggregate response budget exhausted", startedAt);
  }

  let transport: Transport | null = null;
  const client = new Client(
    { name: "ellmos-controlcenter-tool-catalog", version: "0.1.0-alpha.8" },
    { capabilities: {} }
  );

  try {
    const remote = target.transportKind === "sse" || target.transportKind === "streamable-http";
    transport = createTransport(target, {
      redirect: remote ? "error" : undefined,
      fetch: remote ? budgetedFetch(budget) : undefined
    });
    if (!transport) {
      return createBaseCatalogEntry(target, "unsupported", startedAt, target.error ?? t().common.unsupportedStartForm);
    }
    await client.connect(transport, { timeout: timeoutMs });
    const result = await client.listTools(undefined, { timeout: timeoutMs });
    if (target.transportKind === "stdio") {
      const serializedBytes = Buffer.byteLength(JSON.stringify(result), "utf-8");
      if (!reserveResponseBytes(budget, serializedBytes)) {
        return createIncompleteCatalogEntry(target, "not scanned: aggregate response budget exceeded", startedAt);
      }
    }
    const tools = result.tools
      .map(normalizeTool)
      .sort((a, b) => a.name.localeCompare(b.name));

    return createBaseCatalogEntry(target, "ok", startedAt, null, tools);
  } catch (error) {
    if (error instanceof ToolScanResponseBudgetExceeded) {
      return createIncompleteCatalogEntry(target, "not scanned: aggregate response budget exceeded", startedAt);
    }
    return createBaseCatalogEntry(target, "failed", startedAt, sanitizeError(error, target));
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

async function scanTargetsWithBudget(
  targets: ToolCatalogTarget[],
  options: ToolCatalogOptions
): Promise<ServerToolCatalog[]> {
  const budget = options.budget ?? createToolScanBudget(options.maxResponseBytes);
  const maxParallelProbes = normalizeToolScanParallelism(options.maxParallelProbes);
  const catalogs: ServerToolCatalog[] = new Array(targets.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = nextIndex++;
      if (index >= targets.length) return;
      const target = targets[index];
      if (target.transportKind !== "unsupported" && budget.usedResponseBytes >= budget.maxResponseBytes) {
        catalogs[index] = createIncompleteCatalogEntry(target, "not scanned: aggregate response budget exhausted");
        continue;
      }
      catalogs[index] = await readToolCatalogTarget(target, { ...options, budget });
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(maxParallelProbes, Math.max(targets.length, 1)) }, () => worker())
  );
  return catalogs;
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
  return scanTargetsWithBudget(selectedServers.map(createLocalServerToolTarget), options);
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
  return scanTargetsWithBudget(targets, options);
}
