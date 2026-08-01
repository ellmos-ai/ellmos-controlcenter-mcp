import { createHash, createPrivateKey, randomUUID, sign } from "node:crypto";
import { readFile } from "node:fs/promises";
import { hostname as readHostname } from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  readToolCatalogTarget,
  type ServerToolCatalog,
  type ToolCatalogTarget
} from "./toolCatalog.js";

const CONFIG_SCHEMA = "ellmos.controlcenter.actual-self-producer.v1";
const RECEIPT_SCHEMA = "ellmos.actual-self-component-receipt.v1";
const COMPONENT_REF = "access_surface:controlcenter";
const COMPONENT_TYPE = "access_surface";
const PRODUCER_REF = "access_surface:controlcenter";
const ADAPTER_ID = "controlcenter.native-list-tools.v1";
const FUNCTION_ID = "controlcenter-cli-api-mcp-gui-access";
const PROBE_ID = "controlcenter.list-tools.v1";
const MAX_TTL_SECONDS = 300;

export interface ActualSelfReceipt {
  schema: typeof RECEIPT_SCHEMA;
  receipt_id: string;
  component_ref: typeof COMPONENT_REF;
  component_type: typeof COMPONENT_TYPE;
  scope: {
    system_id: string;
    instance_id: string;
    host_id: string;
  };
  registry_binding: {
    registry_content_hash: string;
    source: string;
    record_id: string;
  };
  producer: {
    ref: typeof PRODUCER_REF;
    adapter_id: typeof ADAPTER_ID;
    signer_id: string;
    host_id: string;
    probe_kind: "native-runtime-readback";
  };
  observed_at: string;
  expires_at: string;
  functions: Array<{
    id: typeof FUNCTION_ID;
    status: "observed";
    probe_id: typeof PROBE_ID;
    readback_sha256: string;
  }>;
  signature: {
    algorithm: "ed25519";
    signer_id: string;
    value: string;
  };
  content_hash: string;
}

interface ProducerConfig {
  schema: typeof CONFIG_SCHEMA;
  enabled: true;
  scope: ActualSelfReceipt["scope"];
  registry_binding: ActualSelfReceipt["registry_binding"];
  signer_id: string;
  private_key_path: string;
  private_key_sha256: string;
  ttl_seconds: number;
}

export interface ProduceActualSelfReceiptOptions {
  configPath?: string;
  environment?: NodeJS.ProcessEnv;
  hostName?: string;
  now?: Date;
  uuid?: string;
  packageRoot?: string;
  probe?: (target: ToolCatalogTarget) => Promise<ServerToolCatalog>;
}

export function publicActualSelfReceiptError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message === "ELLMOS_CONTROLCENTER_ACTUAL_SELF_CONFIG is not configured; no receipt was emitted") {
    return message;
  }
  return "host-local configuration, key pin, or native probe validation failed; no receipt was emitted";
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("canonical JSON rejects non-finite numbers");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  throw new Error(`canonical JSON rejects ${typeof value}`);
}

function exactObject(
  value: unknown,
  label: string,
  fields: readonly string[]
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  const record = value as Record<string, unknown>;
  const actual = Object.keys(record).sort();
  const expected = [...fields].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`${label} must contain exactly: ${expected.join(", ")}`);
  }
  return record;
}

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) {
    throw new Error(`${label} must be a non-empty trimmed string`);
  }
  return value;
}

function stableRef(value: unknown, label: string): string {
  const result = nonEmptyString(value, label);
  if (!/^[^\s:]+:[^\s]+$/.test(result)) {
    throw new Error(`${label} must be a stable typed reference`);
  }
  return result;
}

function lowerSha256(value: unknown, label: string): string {
  const result = nonEmptyString(value, label);
  if (!/^[0-9a-f]{64}$/.test(result)) {
    throw new Error(`${label} must be a lowercase SHA-256 digest`);
  }
  return result;
}

function parseConfig(value: unknown): ProducerConfig {
  const root = exactObject(value, "actual-self producer config", [
    "schema",
    "enabled",
    "scope",
    "registry_binding",
    "signer_id",
    "private_key_path",
    "private_key_sha256",
    "ttl_seconds"
  ]);
  if (root.schema !== CONFIG_SCHEMA) {
    throw new Error(`actual-self producer config must use ${CONFIG_SCHEMA}`);
  }
  if (root.enabled !== true) {
    throw new Error("actual-self producer config must set enabled to true");
  }
  const scope = exactObject(root.scope, "scope", ["system_id", "instance_id", "host_id"]);
  const registry = exactObject(root.registry_binding, "registry_binding", [
    "registry_content_hash",
    "source",
    "record_id"
  ]);
  const ttlSeconds = root.ttl_seconds;
  if (!Number.isInteger(ttlSeconds) || (ttlSeconds as number) <= 0 || (ttlSeconds as number) > MAX_TTL_SECONDS) {
    throw new Error(`ttl_seconds must be an integer between 1 and ${MAX_TTL_SECONDS}`);
  }
  return {
    schema: CONFIG_SCHEMA,
    enabled: true,
    scope: {
      system_id: nonEmptyString(scope.system_id, "scope.system_id"),
      instance_id: nonEmptyString(scope.instance_id, "scope.instance_id"),
      host_id: nonEmptyString(scope.host_id, "scope.host_id")
    },
    registry_binding: {
      registry_content_hash: lowerSha256(registry.registry_content_hash, "registry_binding.registry_content_hash"),
      source: nonEmptyString(registry.source, "registry_binding.source"),
      record_id: nonEmptyString(registry.record_id, "registry_binding.record_id")
    },
    signer_id: stableRef(root.signer_id, "signer_id"),
    private_key_path: nonEmptyString(root.private_key_path, "private_key_path"),
    private_key_sha256: lowerSha256(root.private_key_sha256, "private_key_sha256"),
    ttl_seconds: ttlSeconds as number
  };
}

async function readPackageVersion(packageRoot: string): Promise<string> {
  const value = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf-8")) as Record<string, unknown>;
  return nonEmptyString(value.version, "package version");
}

export async function produceActualSelfReceipt(
  options: ProduceActualSelfReceiptOptions = {}
): Promise<ActualSelfReceipt> {
  const environment = options.environment ?? process.env;
  const configuredPath = options.configPath ?? environment.ELLMOS_CONTROLCENTER_ACTUAL_SELF_CONFIG;
  if (!configuredPath) {
    throw new Error("ELLMOS_CONTROLCENTER_ACTUAL_SELF_CONFIG is not configured; no receipt was emitted");
  }
  const configPath = path.resolve(configuredPath);
  const config = parseConfig(JSON.parse(await readFile(configPath, "utf-8")));
  const nativeHost = options.hostName ?? readHostname();
  if (config.scope.host_id.toLocaleLowerCase("en-US") !== nativeHost.toLocaleLowerCase("en-US")) {
    throw new Error("configured scope.host_id does not match the native host");
  }

  const privateKeyPath = path.resolve(path.dirname(configPath), config.private_key_path);
  const privateKeyBytes = await readFile(privateKeyPath);
  if (sha256(privateKeyBytes) !== config.private_key_sha256) {
    throw new Error("private key does not match the configured SHA-256 pin");
  }
  const privateKey = createPrivateKey(privateKeyBytes);
  if (privateKey.asymmetricKeyType !== "ed25519") {
    throw new Error("actual-self private key must be Ed25519");
  }

  const packageRoot = options.packageRoot
    ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const packageVersion = await readPackageVersion(packageRoot);
  const target: ToolCatalogTarget = {
    source: "local-repository",
    profileName: null,
    directoryName: "ellmos-controlcenter-mcp",
    packageName: "ellmos-controlcenter-mcp",
    mcpName: "io.github.ellmos-ai/ellmos-controlcenter-mcp",
    transportKind: "stdio",
    command: process.execPath,
    args: [path.join(packageRoot, "dist", "index.js")],
    cwd: packageRoot,
    url: null,
    error: null
  };
  const catalog = await (options.probe ?? ((value) => readToolCatalogTarget(value, { timeoutMs: 5000 })))(target);
  if (
    catalog.status !== "ok"
    || catalog.toolCount === null
    || catalog.toolCount < 1
    || !catalog.tools.some((tool) => tool.name === "controlcenter_actual_self_receipt")
  ) {
    throw new Error("native ControlCenter list_tools probe did not return the expected tool surface");
  }
  const now = options.now ?? new Date();
  if (Number.isNaN(now.valueOf())) throw new Error("actual-self observation time is invalid");
  const observedAt = now.toISOString();
  const expiresAt = new Date(now.valueOf() + config.ttl_seconds * 1000).toISOString();
  const readback = {
    schema: "ellmos.controlcenter.native-readback.v1",
    component_ref: COMPONENT_REF,
    function_id: FUNCTION_ID,
    host_id: config.scope.host_id,
    package: { name: "ellmos-controlcenter-mcp", version: packageVersion },
    probe_id: PROBE_ID,
    runtime: { name: "node", version: process.version },
    tool_count: catalog.toolCount,
    tools: catalog.tools.map((tool) => ({
      name: tool.name,
      metadata_sha256: sha256(canonicalJson({
        annotations: tool.annotations,
        description: tool.description,
        input_schema: tool.inputSchema,
        title: tool.title
      }))
    }))
  };
  const unsigned: Omit<ActualSelfReceipt, "signature" | "content_hash"> = {
    schema: RECEIPT_SCHEMA,
    receipt_id: `actual-self:controlcenter:${config.scope.host_id}:${options.uuid ?? randomUUID()}`,
    component_ref: COMPONENT_REF,
    component_type: COMPONENT_TYPE,
    scope: config.scope,
    registry_binding: config.registry_binding,
    producer: {
      ref: PRODUCER_REF,
      adapter_id: ADAPTER_ID,
      signer_id: config.signer_id,
      host_id: config.scope.host_id,
      probe_kind: "native-runtime-readback" as const
    },
    observed_at: observedAt,
    expires_at: expiresAt,
    functions: [{
      id: FUNCTION_ID,
      status: "observed" as const,
      probe_id: PROBE_ID,
      readback_sha256: sha256(canonicalJson(readback))
    }]
  };
  const payload = Buffer.from(canonicalJson(unsigned), "utf-8");
  const contentHash = sha256(payload);
  const signature = sign(null, payload, privateKey).toString("base64");
  return {
    ...unsigned,
    signature: {
      algorithm: "ed25519",
      signer_id: config.signer_id,
      value: signature
    },
    content_hash: contentHash
  };
}
