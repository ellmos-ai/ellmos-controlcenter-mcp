import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { fileURLToPath } from "url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { DEFAULT_MCP_ROOT } from "./catalog.js";
import { scanLocalServerLandscape } from "./mcpCatalog.js";
import { DEFAULT_PROFILE_ROOT, resolveMcpProfile } from "./profiles.js";
import {
  createLocalServerToolTarget,
  createProfileToolCatalogTargets,
  createTransport,
  maskSensitiveArgs,
  maskUrl,
  readToolCatalogTarget,
  type McpToolSummary,
  type ToolCatalogTarget,
  type ToolCatalogTransportKind
} from "./toolCatalog.js";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const GATEWAY_POLICY_SCHEMA = "ellmos.controlcenter.gateway-policy.v1";

export const DEFAULT_GATEWAY_POLICY_PATH =
  process.env.ELLMOS_GATEWAY_POLICY ?? path.join(PROJECT_ROOT, "data", "gateway-policy.json");

export const DEFAULT_GATEWAY_AUDIT_LOG =
  process.env.ELLMOS_GATEWAY_AUDIT_LOG ??
  path.join(os.homedir(), ".ellmos", "controlcenter", "gateway-audit.jsonl");

/** Longest a single forwarded tool call may take before the gateway gives up. */
export const DEFAULT_GATEWAY_TIMEOUT_MS = 30000;

export type GatewayPolicyMode = "open" | "allowlist";

export interface GatewayPolicyRule {
  server: string;
  tool: string;
  reason: string;
}

export interface GatewayPolicy {
  mode: GatewayPolicyMode;
  deny: GatewayPolicyRule[];
  allow: GatewayPolicyRule[];
  sourcePath: string;
  /** True when no policy file existed and the built-in default applies. */
  isDefault: boolean;
}

export type GatewayPolicyDecision =
  | { allowed: true; reason: null; rule: null }
  | { allowed: false; reason: string; rule: GatewayPolicyRule | null };

/**
 * A broken policy file must never degrade into "allow everything". Callers turn
 * this error into a refused invocation, not into a permissive fallback.
 */
export class GatewayPolicyError extends Error {
  readonly name = "GatewayPolicyError";

  constructor(
    message: string,
    readonly code: string,
    readonly details: Record<string, unknown> = {}
  ) {
    super(message);
  }
}

export const DEFAULT_GATEWAY_POLICY: Omit<GatewayPolicy, "sourcePath" | "isDefault"> = {
  mode: "open",
  deny: [],
  allow: []
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Connection failures echo the spawn command back, which can carry a token in an
 * argument. Everything that leaves the gateway as text passes through here.
 */
export function maskGatewayText(value: string): string {
  return value
    .replace(/((?:token|secret|password|passwd|credential|api[-_]?key|auth)[-_a-z0-9]*\s*[=:]\s*)(\S+)/gi, "$1***")
    .replace(/(--(?:token|secret|password|passwd|credential|api[-_]?key|auth)[-_a-z0-9]*\s+)(\S+)/gi, "$1***");
}

function globToRegExp(pattern: string): RegExp {
  const source = pattern
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, (character) => `\\${character}`))
    .join(".*");
  return new RegExp(`^${source}$`, "i");
}

function matchesRule(rule: GatewayPolicyRule, serverName: string, toolName: string): boolean {
  return globToRegExp(rule.server).test(serverName) && globToRegExp(rule.tool).test(toolName);
}

function normalizeGatewayRule(value: unknown, configPath: string, listName: string, index: number): GatewayPolicyRule {
  if (!isRecord(value)) {
    throw new GatewayPolicyError(
      `Gateway policy ${configPath}: '${listName}[${index}]' must be a JSON object.`,
      "gateway-policy-schema-invalid",
      { configPath, listName, index }
    );
  }

  const server = typeof value.server === "string" && value.server.trim().length > 0 ? value.server.trim() : "*";
  if (typeof value.tool !== "string" || value.tool.trim().length === 0) {
    throw new GatewayPolicyError(
      `Gateway policy ${configPath}: '${listName}[${index}]' must define a non-empty 'tool' pattern.`,
      "gateway-policy-schema-invalid",
      { configPath, listName, index, fieldName: "tool" }
    );
  }

  return {
    server,
    tool: value.tool.trim(),
    reason: typeof value.reason === "string" && value.reason.trim().length > 0 ? value.reason.trim() : listName
  };
}

function normalizeGatewayRules(value: unknown, configPath: string, listName: string): GatewayPolicyRule[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new GatewayPolicyError(
      `Gateway policy ${configPath}: '${listName}' must be an array.`,
      "gateway-policy-schema-invalid",
      { configPath, listName }
    );
  }
  return value.map((rule, index) => normalizeGatewayRule(rule, configPath, listName, index));
}

export function parseGatewayPolicy(rawConfig: unknown, configPath: string): GatewayPolicy {
  if (!isRecord(rawConfig)) {
    throw new GatewayPolicyError(
      `Gateway policy ${configPath} must be a JSON object.`,
      "gateway-policy-schema-invalid",
      { configPath }
    );
  }

  if (rawConfig.schema !== undefined && rawConfig.schema !== GATEWAY_POLICY_SCHEMA) {
    throw new GatewayPolicyError(
      `Gateway policy ${configPath} declares unknown schema '${String(rawConfig.schema)}'; expected '${GATEWAY_POLICY_SCHEMA}'.`,
      "gateway-policy-schema-unknown",
      { configPath, schema: rawConfig.schema }
    );
  }

  const mode = rawConfig.mode ?? "open";
  if (mode !== "open" && mode !== "allowlist") {
    throw new GatewayPolicyError(
      `Gateway policy ${configPath}: 'mode' must be 'open' or 'allowlist'.`,
      "gateway-policy-schema-invalid",
      { configPath, mode }
    );
  }

  return {
    mode,
    deny: normalizeGatewayRules(rawConfig.deny, configPath, "deny"),
    allow: normalizeGatewayRules(rawConfig.allow, configPath, "allow"),
    sourcePath: configPath,
    isDefault: false
  };
}

export async function loadGatewayPolicy(
  configPath: string = DEFAULT_GATEWAY_POLICY_PATH
): Promise<GatewayPolicy> {
  let raw: string;
  try {
    raw = await fs.readFile(configPath, "utf-8");
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      return { ...DEFAULT_GATEWAY_POLICY, sourcePath: configPath, isDefault: true };
    }
    throw new GatewayPolicyError(
      `Gateway policy ${configPath} could not be read: ${formatError(error)}`,
      "gateway-policy-read-failed",
      { configPath }
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new GatewayPolicyError(
      `Gateway policy ${configPath} contains invalid JSON: ${formatError(error)}`,
      "gateway-policy-json-invalid",
      { configPath }
    );
  }

  return parseGatewayPolicy(parsed, configPath);
}

export function evaluateGatewayPolicy(
  policy: GatewayPolicy,
  serverName: string,
  toolName: string
): GatewayPolicyDecision {
  const denyRule = policy.deny.find((rule) => matchesRule(rule, serverName, toolName));
  if (denyRule) {
    return { allowed: false, reason: denyRule.reason, rule: denyRule };
  }

  if (policy.mode === "allowlist") {
    const allowRule = policy.allow.find((rule) => matchesRule(rule, serverName, toolName));
    if (!allowRule) {
      return {
        allowed: false,
        reason: `Policy-Modus 'allowlist': für '${serverName}/${toolName}' ist keine Allow-Regel hinterlegt.`,
        rule: null
      };
    }
  }

  return { allowed: true, reason: null, rule: null };
}

export type GatewayScopeKind = "profile" | "local-repository";

export interface GatewayScopeOptions {
  profileName?: string;
  profileRoot?: string;
  mcpRoot?: string;
}

export interface GatewayTargetScope {
  kind: GatewayScopeKind;
  label: string;
  targets: ToolCatalogTarget[];
  /**
   * Set when the scope itself could not be read. An unreadable root or a missing
   * profile is never reported as "no servers found".
   */
  scopeError: string | null;
}

function targetNames(target: ToolCatalogTarget): string[] {
  return [target.packageName, target.directoryName, target.mcpName ?? ""].filter(
    (value) => value.trim().length > 0
  );
}

/**
 * The reachable server set is the gateway's real boundary: only servers that the
 * configured MCP root or the named profile already declares can be addressed.
 */
export async function resolveGatewayScope(options: GatewayScopeOptions = {}): Promise<GatewayTargetScope> {
  if (options.profileName && options.profileName.trim().length > 0) {
    const profileRoot = options.profileRoot ?? DEFAULT_PROFILE_ROOT;
    const profileName = options.profileName.trim();
    try {
      const profile = await resolveMcpProfile(profileName, profileRoot);
      return {
        kind: "profile",
        label: `Profil '${profileName}' (${profileRoot})`,
        targets: createProfileToolCatalogTargets(profile),
        scopeError: null
      };
    } catch (error) {
      return {
        kind: "profile",
        label: `Profil '${profileName}' (${profileRoot})`,
        targets: [],
        scopeError: maskGatewayText(formatError(error))
      };
    }
  }

  const mcpRoot = options.mcpRoot ?? DEFAULT_MCP_ROOT;
  const landscape = await scanLocalServerLandscape(mcpRoot);
  if (!landscape.rootReadable) {
    return {
      kind: "local-repository",
      label: `Lokale MCP-Repos (${mcpRoot})`,
      targets: [],
      scopeError: `MCP-Root '${mcpRoot}' ist nicht lesbar — die Serverliste konnte nicht ermittelt werden.`
    };
  }

  return {
    kind: "local-repository",
    label: `Lokale MCP-Repos (${mcpRoot})`,
    targets: landscape.servers
      .map((server) => createLocalServerToolTarget(server))
      .sort((a, b) => a.packageName.localeCompare(b.packageName)),
    scopeError: null
  };
}

export function findGatewayTarget(
  targets: ToolCatalogTarget[],
  serverName: string
): ToolCatalogTarget | null {
  const normalized = serverName.trim().toLowerCase();
  if (normalized.length === 0) {
    return null;
  }
  return (
    targets.find((target) =>
      targetNames(target).some((value) => value.toLowerCase() === normalized)
    ) ?? null
  );
}

export type GatewayServerStatus = "ok" | "unreachable" | "unsupported";

export interface GatewayServerTools {
  serverName: string;
  source: ToolCatalogTarget["source"];
  profileName: string | null;
  transportKind: ToolCatalogTransportKind;
  status: GatewayServerStatus;
  /** `null` whenever the server could not be asked — never 0 as a stand-in. */
  toolCount: number | null;
  tools: McpToolSummary[];
  durationMs: number;
  error: string | null;
}

export interface GatewayToolListing {
  scope: GatewayScopeKind;
  scopeLabel: string;
  requestedServer: string | null;
  servers: GatewayServerTools[];
  reachableCount: number;
  unreachableCount: number;
  /** False when any addressed server could not be asked, or the scope failed. */
  complete: boolean;
  scopeError: string | null;
  unknownServer: boolean;
  knownServers: string[];
}

export interface GatewayListOptions extends GatewayScopeOptions {
  serverName?: string;
  timeoutMs?: number;
  includeSchemas?: boolean;
}

export async function listGatewayTools(options: GatewayListOptions = {}): Promise<GatewayToolListing> {
  const scope = await resolveGatewayScope(options);
  const knownServers = scope.targets.map((target) => target.packageName).sort((a, b) => a.localeCompare(b));
  const requestedServer =
    options.serverName && options.serverName.trim().length > 0 ? options.serverName.trim() : null;

  if (scope.scopeError) {
    return {
      scope: scope.kind,
      scopeLabel: scope.label,
      requestedServer,
      servers: [],
      reachableCount: 0,
      unreachableCount: 0,
      complete: false,
      scopeError: scope.scopeError,
      unknownServer: false,
      knownServers
    };
  }

  let selectedTargets = scope.targets;
  let unknownServer = false;
  if (requestedServer) {
    const target = findGatewayTarget(scope.targets, requestedServer);
    if (!target) {
      unknownServer = true;
      selectedTargets = [];
    } else {
      selectedTargets = [target];
    }
  }

  const servers: GatewayServerTools[] = [];
  for (const target of selectedTargets) {
    const catalog = await readToolCatalogTarget(target, { timeoutMs: options.timeoutMs });
    const status: GatewayServerStatus =
      catalog.status === "ok" ? "ok" : catalog.status === "unsupported" ? "unsupported" : "unreachable";
    servers.push({
      serverName: target.packageName,
      source: target.source,
      profileName: target.profileName,
      transportKind: catalog.transportKind,
      status,
      toolCount: status === "ok" ? catalog.tools.length : null,
      tools:
        options.includeSchemas === true
          ? catalog.tools
          : catalog.tools.map((tool) => ({ ...tool, inputSchema: {} })),
      durationMs: catalog.durationMs,
      error: catalog.error ? maskGatewayText(catalog.error) : null
    });
  }

  const reachableCount = servers.filter((entry) => entry.status === "ok").length;
  const unreachableCount = servers.length - reachableCount;

  return {
    scope: scope.kind,
    scopeLabel: scope.label,
    requestedServer,
    servers,
    reachableCount,
    unreachableCount,
    complete: unreachableCount === 0 && !unknownServer,
    scopeError: null,
    unknownServer,
    knownServers
  };
}

export type GatewayInvocationOutcome =
  | "ok"
  | "target-error"
  | "unknown-server"
  | "unknown-tool"
  | "unreachable"
  | "unsupported"
  | "policy-denied"
  | "policy-unavailable"
  | "scope-unavailable"
  | "audit-unavailable";

export type GatewayAuditStatus = "written" | "disabled" | "failed";

export interface GatewayInvocationResult {
  outcome: GatewayInvocationOutcome;
  /**
   * True only when the call actually reached the target server. A target that
   * answered with `isError` still counts as delivered.
   */
  delivered: boolean;
  serverName: string;
  toolName: string;
  source: ToolCatalogTarget["source"] | null;
  profileName: string | null;
  transportKind: ToolCatalogTransportKind | null;
  durationMs: number;
  content: unknown[] | null;
  structuredContent: unknown | null;
  error: string | null;
  availableTools: string[] | null;
  knownServers: string[] | null;
  policyReason: string | null;
  auditStatus: GatewayAuditStatus;
  auditError: string | null;
}

export interface GatewayInvokeOptions extends GatewayScopeOptions {
  serverName: string;
  toolName: string;
  args?: Record<string, unknown>;
  timeoutMs?: number;
  policyPath?: string;
  auditLogPath?: string;
}

export interface GatewayAuditEntry {
  timestamp: string;
  server: string;
  tool: string;
  source: string | null;
  transportKind: string | null;
  command: string | null;
  url: string | null;
  /** Argument names only. Values are never written to the audit log. */
  argumentKeys: string[];
  argumentCount: number;
  outcome: GatewayInvocationOutcome;
  delivered: boolean;
  durationMs: number;
  contentBlocks: number | null;
  error: string | null;
}

export function isGatewayAuditDisabled(auditLogPath: string): boolean {
  return auditLogPath.trim().toLowerCase() === "off";
}

export function isGatewayAuditRequired(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env.ELLMOS_GATEWAY_AUDIT_REQUIRED;
  return value === "1" || value?.toLowerCase() === "true";
}

export async function appendGatewayAuditEntry(
  entry: GatewayAuditEntry,
  auditLogPath: string = DEFAULT_GATEWAY_AUDIT_LOG
): Promise<{ status: GatewayAuditStatus; error: string | null }> {
  if (isGatewayAuditDisabled(auditLogPath)) {
    return { status: "disabled", error: null };
  }
  try {
    await fs.mkdir(path.dirname(auditLogPath), { recursive: true });
    await fs.appendFile(auditLogPath, `${JSON.stringify(entry)}\n`, "utf-8");
    return { status: "written", error: null };
  } catch (error) {
    return { status: "failed", error: maskGatewayText(formatError(error)) };
  }
}

function argumentKeysOf(args: Record<string, unknown> | undefined): string[] {
  return args ? Object.keys(args).sort((a, b) => a.localeCompare(b)) : [];
}

function normalizeGatewayTimeout(timeoutMs: number | undefined): number {
  if (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs)) {
    return DEFAULT_GATEWAY_TIMEOUT_MS;
  }
  return Math.min(Math.max(Math.trunc(timeoutMs), 500), 300000);
}

interface CallToolShape {
  content?: unknown;
  structuredContent?: unknown;
  isError?: unknown;
}

/**
 * Forwards one tool call to a backend server that the host has not loaded.
 *
 * The connection is opened per call and closed in `finally`: ControlCenter must
 * not leave stdio children behind, so no session is held between invocations.
 */
export async function invokeGatewayTool(options: GatewayInvokeOptions): Promise<GatewayInvocationResult> {
  const startedAt = Date.now();
  const serverName = options.serverName.trim();
  const toolName = options.toolName.trim();
  const auditLogPath = options.auditLogPath ?? DEFAULT_GATEWAY_AUDIT_LOG;
  const argumentKeys = argumentKeysOf(options.args);

  const base = {
    serverName,
    toolName,
    source: null,
    profileName: null,
    transportKind: null,
    content: null,
    structuredContent: null,
    availableTools: null,
    knownServers: null,
    policyReason: null
  } satisfies Partial<GatewayInvocationResult>;

  async function finish(
    partial: Omit<GatewayInvocationResult, "durationMs" | "auditStatus" | "auditError">,
    auditFields: { command: string | null; url: string | null; contentBlocks: number | null }
  ): Promise<GatewayInvocationResult> {
    const durationMs = Date.now() - startedAt;
    const audit = await appendGatewayAuditEntry(
      {
        timestamp: new Date().toISOString(),
        server: partial.serverName,
        tool: partial.toolName,
        source: partial.source,
        transportKind: partial.transportKind,
        command: auditFields.command,
        url: auditFields.url,
        argumentKeys,
        argumentCount: argumentKeys.length,
        outcome: partial.outcome,
        delivered: partial.delivered,
        durationMs,
        contentBlocks: auditFields.contentBlocks,
        error: partial.error
      },
      auditLogPath
    );

    if (audit.status === "failed" && isGatewayAuditRequired()) {
      return {
        ...partial,
        outcome: "audit-unavailable",
        delivered: partial.delivered,
        error:
          `Audit-Log konnte nicht geschrieben werden und ELLMOS_GATEWAY_AUDIT_REQUIRED ist gesetzt: ${audit.error}`,
        durationMs,
        auditStatus: audit.status,
        auditError: audit.error
      };
    }

    return { ...partial, durationMs, auditStatus: audit.status, auditError: audit.error };
  }

  let policy: GatewayPolicy;
  try {
    policy = await loadGatewayPolicy(options.policyPath);
  } catch (error) {
    return finish(
      {
        ...base,
        outcome: "policy-unavailable",
        delivered: false,
        error: `Gateway-Policy konnte nicht gelesen werden — der Aufruf wurde abgelehnt: ${maskGatewayText(formatError(error))}`
      },
      { command: null, url: null, contentBlocks: null }
    );
  }

  const decision = evaluateGatewayPolicy(policy, serverName, toolName);
  if (!decision.allowed) {
    return finish(
      {
        ...base,
        outcome: "policy-denied",
        delivered: false,
        error: `Gateway-Policy verbietet '${serverName}/${toolName}': ${decision.reason}`,
        policyReason: decision.reason
      },
      { command: null, url: null, contentBlocks: null }
    );
  }

  const scope = await resolveGatewayScope(options);
  if (scope.scopeError) {
    return finish(
      {
        ...base,
        outcome: "scope-unavailable",
        delivered: false,
        error: `Die Serverliste konnte nicht ermittelt werden — es ist unklar, ob '${serverName}' existiert: ${scope.scopeError}`
      },
      { command: null, url: null, contentBlocks: null }
    );
  }

  const target = findGatewayTarget(scope.targets, serverName);
  if (!target) {
    const knownServers = scope.targets.map((entry) => entry.packageName).sort((a, b) => a.localeCompare(b));
    return finish(
      {
        ...base,
        outcome: "unknown-server",
        delivered: false,
        error: `Server '${serverName}' ist in ${scope.label} nicht bekannt.`,
        knownServers
      },
      { command: null, url: null, contentBlocks: null }
    );
  }

  const auditConnection = {
    command: target.command ? `${target.command} ${maskSensitiveArgs(target.args).join(" ")}`.trim() : null,
    url: maskUrl(target.url)
  };
  const identity = {
    serverName: target.packageName,
    toolName,
    source: target.source,
    profileName: target.profileName,
    transportKind: target.transportKind
  };

  if (target.transportKind === "unsupported") {
    return finish(
      {
        ...base,
        ...identity,
        outcome: "unsupported",
        delivered: false,
        error: `Server '${target.packageName}' hat keine unterstützte Startform: ${target.error ?? "unbekannt"}`
      },
      { ...auditConnection, contentBlocks: null }
    );
  }

  const timeoutMs = normalizeGatewayTimeout(options.timeoutMs);
  let transport: Transport | null = null;
  const client = new Client(
    { name: "ellmos-controlcenter-gateway", version: "0.5.0" },
    { capabilities: {} }
  );

  try {
    transport = createTransport(target);
    if (!transport) {
      return finish(
        {
          ...base,
          ...identity,
          outcome: "unsupported",
          delivered: false,
          error: `Für Server '${target.packageName}' konnte kein Transport erzeugt werden.`
        },
        { ...auditConnection, contentBlocks: null }
      );
    }

    await client.connect(transport, { timeout: timeoutMs });

    const listed = await client.listTools(undefined, { timeout: timeoutMs });
    const availableTools = listed.tools.map((tool) => tool.name).sort((a, b) => a.localeCompare(b));
    if (!availableTools.includes(toolName)) {
      return finish(
        {
          ...base,
          ...identity,
          outcome: "unknown-tool",
          delivered: false,
          error: `Server '${target.packageName}' kennt kein Tool '${toolName}'.`,
          availableTools
        },
        { ...auditConnection, contentBlocks: null }
      );
    }

    const raw = (await client.callTool(
      { name: toolName, arguments: options.args ?? {} },
      undefined,
      { timeout: timeoutMs }
    )) as CallToolShape;

    const content = Array.isArray(raw.content) ? raw.content : [];
    const isTargetError = raw.isError === true;

    return finish(
      {
        ...base,
        ...identity,
        outcome: isTargetError ? "target-error" : "ok",
        delivered: true,
        content,
        structuredContent: raw.structuredContent ?? null,
        error: isTargetError
          ? `Der Zielserver '${target.packageName}' hat das Tool ausgeführt und einen Tool-Fehler gemeldet.`
          : null
      },
      { ...auditConnection, contentBlocks: content.length }
    );
  } catch (error) {
    return finish(
      {
        ...base,
        ...identity,
        outcome: "unreachable",
        delivered: false,
        error: `Server '${target.packageName}' konnte nicht befragt werden: ${maskGatewayText(formatError(error))}`
      },
      { ...auditConnection, contentBlocks: null }
    );
  } finally {
    try {
      await client.close();
    } catch {
      // Best-effort cleanup; a half-open client must not keep the call alive.
    }
    if (transport) {
      try {
        await transport.close();
      } catch {
        // Best-effort cleanup; the client may already have closed the transport.
      }
    }
  }
}

function escapeCell(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

export function formatGatewayToolListing(listing: GatewayToolListing): string {
  const lines: string[] = ["# Erreichbare Tools (Gateway)", ""];

  if (listing.scopeError) {
    lines.push(
      `**Unvollständig:** ${listing.scopeLabel} konnte nicht befragt werden — das ist kein leeres Ergebnis.`,
      "",
      `- Fehler: ${listing.scopeError}`
    );
    return lines.join("\n");
  }

  if (listing.unknownServer) {
    lines.push(
      `**Unbekannter Server:** '${listing.requestedServer}' ist in ${listing.scopeLabel} nicht bekannt.`,
      "",
      `- Bekannte Server: ${listing.knownServers.length > 0 ? listing.knownServers.join(", ") : "keine"}`
    );
    return lines.join("\n");
  }

  if (listing.unreachableCount > 0) {
    lines.push(
      `**Unvollständig:** ${listing.unreachableCount} von ${listing.servers.length} Servern konnten nicht befragt werden. Fehlende Tools bedeuten hier nicht "nicht vorhanden".`,
      ""
    );
  }

  lines.push(
    `- Bereich: ${listing.scopeLabel}`,
    `- Server befragt: ${listing.servers.length}`,
    `- Davon erreichbar: ${listing.reachableCount}`,
    `- Ergebnis vollständig: ${listing.complete ? "ja" : "nein"}`,
    ""
  );

  if (listing.servers.length === 0) {
    lines.push("Keine Server im gewählten Bereich.");
    return lines.join("\n");
  }

  for (const entry of listing.servers) {
    lines.push(
      `## ${entry.serverName}`,
      "",
      `- Status: ${entry.status}`,
      `- Transport: ${entry.transportKind}`,
      `- Tools: ${entry.toolCount ?? "unbekannt (Server nicht befragbar)"}`,
      `- Dauer: ${entry.durationMs} ms`
    );
    if (entry.error) {
      lines.push(`- Fehler: ${entry.error}`);
    }
    lines.push("");

    if (entry.status !== "ok") {
      lines.push("Dieser Server konnte nicht befragt werden — seine Tools sind unbekannt.", "");
      continue;
    }
    if (entry.tools.length === 0) {
      lines.push("Der Server antwortete erfolgreich und meldet keine Tools.", "");
      continue;
    }

    lines.push("| Tool | Beschreibung |", "|---|---|");
    for (const tool of entry.tools) {
      lines.push(`| ${escapeCell(tool.name)} | ${escapeCell(tool.description || "-")} |`);
    }
    lines.push("");
  }

  lines.push(
    "Aufruf: `controlcenter_invoke` mit `server`, `tool` und `args` — ein vorheriger Listenaufruf ist nicht nötig, wenn der Toolname bekannt ist."
  );
  return lines.join("\n");
}

function stringifyContentBlock(block: unknown): string {
  if (isRecord(block) && block.type === "text" && typeof block.text === "string") {
    return block.text;
  }
  return JSON.stringify(block);
}

export function formatGatewayInvocation(result: GatewayInvocationResult): string {
  const lines: string[] = [
    `# Gateway-Aufruf ${result.serverName}/${result.toolName}`,
    "",
    `- Ergebnis: ${result.outcome}`,
    `- Beim Zielserver angekommen: ${result.delivered ? "ja" : "nein"}`,
    `- Dauer: ${result.durationMs} ms`,
    `- Audit: ${result.auditStatus}${result.auditError ? ` (${result.auditError})` : ""}`
  ];

  if (result.transportKind) {
    lines.push(`- Transport: ${result.transportKind}`);
  }
  lines.push("");

  switch (result.outcome) {
    case "ok":
      break;
    case "target-error":
      lines.push(
        "**Tool-Fehler des Zielservers.** Das Gateway hat korrekt zugestellt; der Fehler stammt aus dem Zielserver und dessen Antwort steht unten.",
        ""
      );
      break;
    case "unknown-server":
      lines.push(
        `**Unbekannter Server.** ${result.error}`,
        "",
        `- Bekannte Server: ${result.knownServers && result.knownServers.length > 0 ? result.knownServers.join(", ") : "keine"}`
      );
      return lines.join("\n");
    case "unknown-tool":
      lines.push(
        `**Unbekanntes Tool.** ${result.error}`,
        "",
        `- Verfügbare Tools: ${result.availableTools && result.availableTools.length > 0 ? result.availableTools.join(", ") : "keine"}`
      );
      return lines.join("\n");
    case "unreachable":
      lines.push(
        `**Nicht erreichbar.** ${result.error}`,
        "",
        "Das ist kein leeres Ergebnis: ob das Tool etwas geliefert hätte, ist unbekannt."
      );
      return lines.join("\n");
    case "scope-unavailable":
    case "unsupported":
    case "policy-denied":
    case "policy-unavailable":
    case "audit-unavailable":
      lines.push(`**Abgelehnt.** ${result.error}`);
      return lines.join("\n");
  }

  const content = result.content ?? [];
  if (content.length === 0 && result.structuredContent === null) {
    lines.push("Der Zielserver hat einen leeren Inhalt zurückgegeben.");
    return lines.join("\n");
  }

  for (const block of content) {
    lines.push(stringifyContentBlock(block));
  }
  if (result.structuredContent !== null) {
    lines.push("", "```json", JSON.stringify(result.structuredContent, null, 2), "```");
  }

  return lines.join("\n");
}
