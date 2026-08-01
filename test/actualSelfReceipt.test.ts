import { createHash, generateKeyPairSync, verify } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  canonicalJson,
  produceActualSelfReceipt,
  publicActualSelfReceiptError
} from "../src/actualSelfReceipt.js";

const directories: string[] = [];

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  while (directories.length > 0) {
    await rm(directories.pop()!, { recursive: true, force: true });
  }
});

async function fixture(overrides: Record<string, unknown> = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "controlcenter-actual-self-"));
  directories.push(root);
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const privatePem = privateKey.export({ type: "pkcs8", format: "pem" });
  const keyPath = path.join(root, "signer.pem");
  await writeFile(keyPath, privatePem);
  await writeFile(path.join(root, "package.json"), JSON.stringify({ version: "0.3.0" }));
  const config = {
    schema: "ellmos.controlcenter.actual-self-producer.v1",
    enabled: true,
    scope: {
      system_id: "ellmos-development-system",
      instance_id: "ellmos-development-system@WORKSTATION-LG",
      host_id: "WORKSTATION-LG"
    },
    registry_binding: {
      registry_content_hash: "a".repeat(64),
      source: "surface:controlcenter-mcp",
      record_id: "io.github.ellmos-ai/ellmos-controlcenter-mcp"
    },
    signer_id: "signer:controlcenter-workstation-lg",
    private_key_path: "signer.pem",
    private_key_sha256: createHash("sha256").update(privatePem).digest("hex"),
    ttl_seconds: 120,
    ...overrides
  };
  const configPath = path.join(root, "producer.json");
  await writeFile(configPath, JSON.stringify(config));
  return { root, configPath, publicKey };
}

describe("actual-self receipt producer", () => {
  it("matches the Python System Explorer canonical JSON vector", () => {
    const payload = canonicalJson({ z: "ä", a: { y: 2, x: [true, null, "ß"] } });
    expect(payload).toBe('{"a":{"x":[true,null,"ß"],"y":2},"z":"ä"}');
    expect(createHash("sha256").update(Buffer.from(payload)).digest("hex"))
      .toBe("67b2d6330a093973f4e0f938065188759e04abbfc7f4324ffc483b89a79b1463");
  });

  it("emits a System Explorer-compatible, signed, host-bound receipt", async () => {
    const { root, configPath, publicKey } = await fixture();
    const receipt = await produceActualSelfReceipt({
      configPath,
      hostName: "WORKSTATION-LG",
      now: new Date("2026-08-01T08:00:00.000Z"),
      uuid: "00000000-0000-4000-8000-000000000001",
      packageRoot: root,
      probe: async () => ({
        source: "local-repository",
        profileName: null,
        directoryName: "ellmos-controlcenter-mcp",
        packageName: "ellmos-controlcenter-mcp",
        mcpName: "io.github.ellmos-ai/ellmos-controlcenter-mcp",
        status: "ok",
        transportKind: "stdio",
        command: process.execPath,
        args: [],
        url: null,
        durationMs: 1,
        toolCount: 1,
        tools: [{
          name: "controlcenter_actual_self_receipt",
          title: "Emit actual-self receipt",
          description: "test",
          inputSchema: { type: "object" },
          annotations: { readOnlyHint: true }
        }],
        error: null
      })
    });
    const { signature, content_hash: contentHash, ...payloadValue } = receipt;
    const payload = Buffer.from(canonicalJson(payloadValue), "utf-8");
    expect(createHash("sha256").update(payload).digest("hex")).toBe(contentHash);
    expect(verify(null, payload, publicKey, Buffer.from(signature.value, "base64"))).toBe(true);
    expect(receipt).toMatchObject({
      schema: "ellmos.actual-self-component-receipt.v1",
      component_ref: "access_surface:controlcenter",
      component_type: "access_surface",
      producer: {
        adapter_id: "controlcenter.native-list-tools.v1",
        probe_kind: "native-runtime-readback"
      },
      functions: [{
        id: "controlcenter-cli-api-mcp-gui-access",
        status: "observed",
        probe_id: "controlcenter.list-tools.v1"
      }],
      observed_at: "2026-08-01T08:00:00.000Z",
      expires_at: "2026-08-01T08:02:00.000Z"
    });
  });

  it("fails closed when producer configuration is absent", async () => {
    await expect(produceActualSelfReceipt({ environment: {} })).rejects.toThrow(
      "ELLMOS_CONTROLCENTER_ACTUAL_SELF_CONFIG is not configured"
    );
  });

  it("rejects a foreign host scope", async () => {
    const { root, configPath } = await fixture();
    await expect(produceActualSelfReceipt({
      configPath,
      hostName: "ASUS-GEI",
      packageRoot: root
    })).rejects.toThrow("does not match the native host");
  });

  it("rejects a substituted signing key", async () => {
    const { root, configPath } = await fixture({ private_key_sha256: "0".repeat(64) });
    await expect(produceActualSelfReceipt({
      configPath,
      hostName: "WORKSTATION-LG",
      packageRoot: root
    })).rejects.toThrow("does not match the configured SHA-256 pin");
  });

  it("rejects a failed or incomplete native list_tools probe", async () => {
    const { root, configPath } = await fixture();
    await expect(produceActualSelfReceipt({
      configPath,
      hostName: "WORKSTATION-LG",
      packageRoot: root,
      probe: async () => ({
        source: "local-repository",
        profileName: null,
        directoryName: "ellmos-controlcenter-mcp",
        packageName: "ellmos-controlcenter-mcp",
        mcpName: "io.github.ellmos-ai/ellmos-controlcenter-mcp",
        status: "ok",
        transportKind: "stdio",
        command: process.execPath,
        args: [],
        url: null,
        durationMs: 1,
        toolCount: 1,
        tools: [{
          name: "controlcenter_status",
          title: null,
          description: "test",
          inputSchema: { type: "object" },
          annotations: null
        }],
        error: null
      })
    })).rejects.toThrow("did not return the expected tool surface");
  });

  it("redacts unexpected local errors at the MCP boundary", () => {
    const value = publicActualSelfReceiptError(new Error("ENOENT C:\\private\\signer.pem"));
    expect(value).not.toContain("private");
    expect(value).not.toContain("signer.pem");
    expect(value).toContain("no receipt was emitted");
  });
});
