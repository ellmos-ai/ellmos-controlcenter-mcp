import { describe, expect, it } from "vitest";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import {
  evaluateGatewayPolicy,
  findGatewayTarget,
  formatGatewayInvocation,
  formatGatewayToolListing,
  invokeGatewayTool,
  listGatewayTools,
  loadGatewayPolicy,
  maskGatewayText,
  parseGatewayPolicy,
  resolveGatewayScope,
  GatewayPolicyError,
  type GatewayPolicy
} from "../src/gateway.js";
import { resetGatewayLimiter } from "../src/gatewayHardening.js";

async function createTempDirectory(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

/**
 * Fixture MCP server that answers initialize, tools/list and tools/call.
 * `gateway_fail` returns a protocol-level tool error (isError), which must stay
 * distinguishable from the gateway itself failing.
 */
async function createCallableFixtureServer(serverDir: string): Promise<string> {
  await fs.mkdir(serverDir, { recursive: true });
  const serverPath = path.join(serverDir, "server.mjs");
  await fs.writeFile(
    serverPath,
    [
      "const tools = [",
      "  { name: 'gateway_echo', title: 'Gateway Echo', description: 'Echoes the value back.',",
      "    inputSchema: { type: 'object', properties: { value: { type: 'string' } } } },",
      "  { name: 'gateway_fail', title: 'Gateway Fail', description: 'Always reports a tool error.',",
      "    inputSchema: { type: 'object', properties: {} } },",
      "  { name: 'gateway_secret', title: 'Gateway Secret', description: 'Returns a payload holding credentials.',",
      "    inputSchema: { type: 'object', properties: {} } }",
      "];",
      "let buffer = '';",
      "function send(message) { process.stdout.write(JSON.stringify(message) + '\\n'); }",
      "process.stdin.setEncoding('utf8');",
      "process.stdin.on('data', (chunk) => {",
      "  buffer += chunk;",
      "  let newlineIndex;",
      "  while ((newlineIndex = buffer.indexOf('\\n')) !== -1) {",
      "    const line = buffer.slice(0, newlineIndex).trim();",
      "    buffer = buffer.slice(newlineIndex + 1);",
      "    if (!line) continue;",
      "    const message = JSON.parse(line);",
      "    if (message.method === 'initialize') {",
      "      send({ jsonrpc: '2.0', id: message.id, result: {",
      "        protocolVersion: '2025-06-18',",
      "        capabilities: { tools: { listChanged: false } },",
      "        serverInfo: { name: 'gateway-fixture-mcp', version: '0.0.1' } } });",
      "    } else if (message.method === 'tools/list') {",
      "      send({ jsonrpc: '2.0', id: message.id, result: { tools } });",
      "    } else if (message.method === 'tools/call') {",
      "      const name = message.params && message.params.name;",
      "      const args = (message.params && message.params.arguments) || {};",
      "      if (name === 'gateway_secret') {",
      "        send({ jsonrpc: '2.0', id: message.id, result: {",
      "          content: [{ type: 'text', text: 'key sk-abcdefghijklmnopqrstuvwx trailing' }],",
      "          structuredContent: { nested: { apiKey: 'super-secret-value' } }, isError: false } });",
      "      } else if (name === 'gateway_fail') {",
      "        send({ jsonrpc: '2.0', id: message.id, result: {",
      "          content: [{ type: 'text', text: 'fixture tool failed on purpose' }], isError: true } });",
      "      } else {",
      "        send({ jsonrpc: '2.0', id: message.id, result: {",
      "          content: [{ type: 'text', text: 'echo:' + String(args.value ?? '') }], isError: false } });",
      "      }",
      "    } else if (message.id) {",
      "      send({ jsonrpc: '2.0', id: message.id, result: {} });",
      "    }",
      "  }",
      "});"
    ].join("\n"),
    "utf-8"
  );
  return serverPath;
}

async function createProfileRoot(
  root: string,
  servers: Record<string, unknown>
): Promise<string> {
  const profileRoot = path.join(root, "profiles");
  await fs.mkdir(profileRoot, { recursive: true });
  await fs.writeFile(
    path.join(profileRoot, "base.json"),
    JSON.stringify({ mcpServers: servers }),
    "utf-8"
  );
  return profileRoot;
}

async function createWorkingProfile(prefix: string): Promise<{
  root: string;
  profileRoot: string;
  auditLogPath: string;
}> {
  const root = await createTempDirectory(prefix);
  const serverDir = path.join(root, "gateway-fixture");
  const serverPath = await createCallableFixtureServer(serverDir);
  const profileRoot = await createProfileRoot(root, {
    fixture: { command: process.execPath, args: [serverPath], cwd: serverDir }
  });
  return { root, profileRoot, auditLogPath: path.join(root, "audit.jsonl") };
}

function openPolicy(sourcePath = "memory"): GatewayPolicy {
  return { mode: "open", deny: [], allow: [], sourcePath, isDefault: true };
}

describe("gateway policy", () => {
  it("allows any tool in open mode", () => {
    expect(evaluateGatewayPolicy(openPolicy(), "fc", "fc_read_file").allowed).toBe(true);
  });

  it("denies by wildcard rule and reports the reason", () => {
    const policy: GatewayPolicy = {
      ...openPolicy(),
      deny: [{ server: "*", tool: "fc_delete_*", reason: "Löschen ist gesperrt." }]
    };
    const denied = evaluateGatewayPolicy(policy, "filecommander", "fc_delete_file");
    expect(denied.allowed).toBe(false);
    expect(denied.reason).toBe("Löschen ist gesperrt.");
    expect(evaluateGatewayPolicy(policy, "filecommander", "fc_read_file").allowed).toBe(true);
  });

  it("requires an explicit allow rule in allowlist mode", () => {
    const policy: GatewayPolicy = {
      ...openPolicy(),
      mode: "allowlist",
      allow: [{ server: "fixture", tool: "gateway_echo", reason: "allow" }]
    };
    expect(evaluateGatewayPolicy(policy, "fixture", "gateway_echo").allowed).toBe(true);
    expect(evaluateGatewayPolicy(policy, "fixture", "gateway_fail").allowed).toBe(false);
  });

  it("lets deny win over allow", () => {
    const policy: GatewayPolicy = {
      ...openPolicy(),
      mode: "allowlist",
      allow: [{ server: "*", tool: "*", reason: "allow" }],
      deny: [{ server: "*", tool: "gateway_fail", reason: "deny" }]
    };
    expect(evaluateGatewayPolicy(policy, "fixture", "gateway_fail").allowed).toBe(false);
  });

  it("treats a wildcard as a segment, not as a substring match on unrelated tools", () => {
    const policy: GatewayPolicy = {
      ...openPolicy(),
      deny: [{ server: "fixture", tool: "gateway_*", reason: "deny" }]
    };
    expect(evaluateGatewayPolicy(policy, "fixture", "gateway_echo").allowed).toBe(false);
    expect(evaluateGatewayPolicy(policy, "fixture", "other_echo").allowed).toBe(true);
    expect(evaluateGatewayPolicy(policy, "other", "gateway_echo").allowed).toBe(true);
  });

  it("falls back to the built-in open policy only when no file exists", async () => {
    const root = await createTempDirectory("gateway-policy-missing-");
    const policy = await loadGatewayPolicy(path.join(root, "absent.json"));
    expect(policy.mode).toBe("open");
    expect(policy.isDefault).toBe(true);
  });

  it("rejects malformed policy files instead of allowing everything", async () => {
    const root = await createTempDirectory("gateway-policy-broken-");
    const configPath = path.join(root, "gateway-policy.json");
    await fs.writeFile(configPath, "{ not json", "utf-8");
    await expect(loadGatewayPolicy(configPath)).rejects.toBeInstanceOf(GatewayPolicyError);

    expect(() => parseGatewayPolicy({ mode: "whatever" }, "x")).toThrow(GatewayPolicyError);
    expect(() => parseGatewayPolicy({ schema: "other.v9" }, "x")).toThrow(GatewayPolicyError);
    expect(() => parseGatewayPolicy({ deny: [{ server: "*" }] }, "x")).toThrow(GatewayPolicyError);
    expect(() => parseGatewayPolicy({ deny: "all" }, "x")).toThrow(GatewayPolicyError);
  });

  it("accepts the shipped default policy file", async () => {
    const policy = await loadGatewayPolicy(
      path.join(process.cwd(), "data", "gateway-policy.json")
    );
    expect(policy.mode).toBe("open");
    expect(policy.isDefault).toBe(false);
  });
});

describe("gateway scope resolution", () => {
  it("reports an unreadable MCP root instead of an empty server list", async () => {
    const root = await createTempDirectory("gateway-scope-");
    const scope = await resolveGatewayScope({ mcpRoot: path.join(root, "does-not-exist") });
    expect(scope.targets).toHaveLength(0);
    expect(scope.scopeError).toContain("nicht lesbar");
  });

  it("reports a missing profile as a scope error", async () => {
    const root = await createTempDirectory("gateway-scope-profile-");
    const scope = await resolveGatewayScope({ profileName: "absent", profileRoot: root });
    expect(scope.targets).toHaveLength(0);
    expect(scope.scopeError).not.toBeNull();
  });

  it("matches a target by package, directory, or mcp name", async () => {
    const { profileRoot } = await createWorkingProfile("gateway-scope-match-");
    const scope = await resolveGatewayScope({ profileName: "base", profileRoot });
    expect(findGatewayTarget(scope.targets, "fixture")).not.toBeNull();
    expect(findGatewayTarget(scope.targets, "FIXTURE")).not.toBeNull();
    expect(findGatewayTarget(scope.targets, "unknown")).toBeNull();
  });
});

describe("gateway tool listing", () => {
  it("lists tools of a server the host has not loaded", async () => {
    const { profileRoot } = await createWorkingProfile("gateway-list-");
    const listing = await listGatewayTools({ profileName: "base", profileRoot, timeoutMs: 4000 });

    expect(listing.servers).toHaveLength(1);
    expect(listing.servers[0]).toMatchObject({ serverName: "fixture", status: "ok", toolCount: 3 });
    expect(listing.complete).toBe(true);
    expect(listing.servers[0].tools.map((tool) => tool.name)).toEqual(["gateway_echo", "gateway_fail", "gateway_secret"]);
  });

  it("omits input schemas unless explicitly requested", async () => {
    const { profileRoot } = await createWorkingProfile("gateway-list-schema-");
    const lean = await listGatewayTools({ profileName: "base", profileRoot, timeoutMs: 4000 });
    expect(lean.servers[0].tools[0].inputSchema).toEqual({});

    const full = await listGatewayTools({
      profileName: "base",
      profileRoot,
      includeSchemas: true,
      timeoutMs: 4000
    });
    expect(full.servers[0].tools[0].inputSchema).toMatchObject({ type: "object" });
  });

  it("marks an unreachable server as unknown rather than tool-free", async () => {
    const root = await createTempDirectory("gateway-list-unreachable-");
    const profileRoot = await createProfileRoot(root, {
      broken: { command: process.execPath, args: [path.join(root, "missing.mjs")] }
    });

    const listing = await listGatewayTools({ profileName: "base", profileRoot, timeoutMs: 3000 });
    expect(listing.servers[0].status).toBe("unreachable");
    expect(listing.servers[0].toolCount).toBeNull();
    expect(listing.complete).toBe(false);

    const text = formatGatewayToolListing(listing);
    expect(text).toContain("Unvollständig");
    expect(text).toContain("nicht befragt werden");
  });

  it("warns in the text output when only some servers of a set answered", async () => {
    const root = await createTempDirectory("gateway-list-mixed-");
    const serverDir = path.join(root, "gateway-fixture");
    const serverPath = await createCallableFixtureServer(serverDir);
    const profileRoot = await createProfileRoot(root, {
      fixture: { command: process.execPath, args: [serverPath], cwd: serverDir },
      broken: { command: process.execPath, args: [path.join(root, "missing.mjs")] }
    });

    const listing = await listGatewayTools({ profileName: "base", profileRoot, timeoutMs: 3000 });
    expect(listing.reachableCount).toBe(1);
    expect(listing.unreachableCount).toBe(1);
    expect(listing.complete).toBe(false);

    const text = formatGatewayToolListing(listing);
    expect(text).toContain("1 von 2 Servern konnten nicht befragt werden");
    expect(text).toContain("gateway_echo");
  });

  it("reports an unreadable scope as incomplete instead of empty", async () => {
    const root = await createTempDirectory("gateway-list-scope-");
    const listing = await listGatewayTools({ mcpRoot: path.join(root, "nope") });
    expect(listing.complete).toBe(false);
    expect(listing.scopeError).not.toBeNull();
    expect(formatGatewayToolListing(listing)).toContain("kein leeres Ergebnis");
  });

  it("names an unknown server and lists the known ones", async () => {
    const { profileRoot } = await createWorkingProfile("gateway-list-unknown-");
    const listing = await listGatewayTools({
      profileName: "base",
      profileRoot,
      serverName: "nope",
      timeoutMs: 4000
    });
    expect(listing.unknownServer).toBe(true);
    expect(listing.complete).toBe(false);
    expect(formatGatewayToolListing(listing)).toContain("fixture");
  });
});

describe("gateway invocation", () => {
  it("forwards a call to a server the host has not loaded and returns its result", async () => {
    const { profileRoot, auditLogPath } = await createWorkingProfile("gateway-invoke-");

    const result = await invokeGatewayTool({
      serverName: "fixture",
      toolName: "gateway_echo",
      args: { value: "hallo" },
      profileName: "base",
      profileRoot,
      auditLogPath,
      timeoutMs: 5000
    });

    expect(result.outcome).toBe("ok");
    expect(result.delivered).toBe(true);
    expect(result.transportKind).toBe("stdio");
    expect(formatGatewayInvocation(result)).toContain("echo:hallo");
  });

  it("keeps a target tool error apart from a gateway failure", async () => {
    const { profileRoot, auditLogPath } = await createWorkingProfile("gateway-invoke-targeterr-");

    const result = await invokeGatewayTool({
      serverName: "fixture",
      toolName: "gateway_fail",
      profileName: "base",
      profileRoot,
      auditLogPath,
      timeoutMs: 5000
    });

    expect(result.outcome).toBe("target-error");
    expect(result.delivered).toBe(true);
    const text = formatGatewayInvocation(result);
    expect(text).toContain("Tool-Fehler des Zielservers");
    expect(text).toContain("fixture tool failed on purpose");
  });

  it("reports an unreachable server as unreachable, not as an empty result", async () => {
    const root = await createTempDirectory("gateway-invoke-unreachable-");
    const profileRoot = await createProfileRoot(root, {
      broken: { command: process.execPath, args: [path.join(root, "missing.mjs")] }
    });

    const result = await invokeGatewayTool({
      serverName: "broken",
      toolName: "anything",
      profileName: "base",
      profileRoot,
      auditLogPath: path.join(root, "audit.jsonl"),
      timeoutMs: 3000
    });

    expect(result.outcome).toBe("unreachable");
    expect(result.delivered).toBe(false);
    expect(result.content).toBeNull();
    expect(formatGatewayInvocation(result)).toContain("kein leeres Ergebnis");
  });

  it("names the known servers when the server is unknown", async () => {
    const { profileRoot, auditLogPath } = await createWorkingProfile("gateway-invoke-unknown-server-");

    const result = await invokeGatewayTool({
      serverName: "not-there",
      toolName: "gateway_echo",
      profileName: "base",
      profileRoot,
      auditLogPath,
      timeoutMs: 4000
    });

    expect(result.outcome).toBe("unknown-server");
    expect(result.knownServers).toEqual(["fixture"]);
    expect(formatGatewayInvocation(result)).toContain("fixture");
  });

  it("returns the available tool names when the tool name is wrong", async () => {
    const { profileRoot, auditLogPath } = await createWorkingProfile("gateway-invoke-unknown-tool-");

    const result = await invokeGatewayTool({
      serverName: "fixture",
      toolName: "gateway_ehco",
      profileName: "base",
      profileRoot,
      auditLogPath,
      timeoutMs: 5000
    });

    expect(result.outcome).toBe("unknown-tool");
    expect(result.delivered).toBe(false);
    expect(result.availableTools).toEqual(["gateway_echo", "gateway_fail", "gateway_secret"]);
    expect(formatGatewayInvocation(result)).toContain("gateway_echo");
  });

  it("refuses a denied tool without contacting the server", async () => {
    const { root, profileRoot, auditLogPath } = await createWorkingProfile("gateway-invoke-denied-");
    const policyPath = path.join(root, "gateway-policy.json");
    await fs.writeFile(
      policyPath,
      JSON.stringify({
        schema: "ellmos.controlcenter.gateway-policy.v1",
        mode: "open",
        deny: [{ server: "fixture", tool: "gateway_echo", reason: "Im Test gesperrt." }]
      }),
      "utf-8"
    );

    const result = await invokeGatewayTool({
      serverName: "fixture",
      toolName: "gateway_echo",
      profileName: "base",
      profileRoot,
      policyPath,
      auditLogPath,
      timeoutMs: 5000
    });

    expect(result.outcome).toBe("policy-denied");
    expect(result.delivered).toBe(false);
    expect(result.policyReason).toBe("Im Test gesperrt.");
  });

  it("refuses every invocation while the policy file is malformed", async () => {
    const { root, profileRoot, auditLogPath } = await createWorkingProfile("gateway-invoke-badpolicy-");
    const policyPath = path.join(root, "gateway-policy.json");
    await fs.writeFile(policyPath, "{ broken", "utf-8");

    const result = await invokeGatewayTool({
      serverName: "fixture",
      toolName: "gateway_echo",
      profileName: "base",
      profileRoot,
      policyPath,
      auditLogPath,
      timeoutMs: 5000
    });

    expect(result.outcome).toBe("policy-unavailable");
    expect(result.delivered).toBe(false);
  });

  it("refuses when the scope itself cannot be read", async () => {
    const root = await createTempDirectory("gateway-invoke-scope-");
    const result = await invokeGatewayTool({
      serverName: "fixture",
      toolName: "gateway_echo",
      mcpRoot: path.join(root, "nope"),
      auditLogPath: path.join(root, "audit.jsonl")
    });

    expect(result.outcome).toBe("scope-unavailable");
    expect(result.delivered).toBe(false);
  });

  it("honours the timeout when a server never answers", async () => {
    const root = await createTempDirectory("gateway-invoke-timeout-");
    const serverDir = path.join(root, "silent");
    await fs.mkdir(serverDir, { recursive: true });
    const serverPath = path.join(serverDir, "server.mjs");
    await fs.writeFile(serverPath, "setInterval(() => {}, 1000);\n", "utf-8");
    const profileRoot = await createProfileRoot(root, {
      silent: { command: process.execPath, args: [serverPath], cwd: serverDir }
    });

    const startedAt = Date.now();
    const result = await invokeGatewayTool({
      serverName: "silent",
      toolName: "whatever",
      profileName: "base",
      profileRoot,
      auditLogPath: path.join(root, "audit.jsonl"),
      timeoutMs: 1200
    });

    expect(result.outcome).toBe("unreachable");
    expect(Date.now() - startedAt).toBeLessThan(15000);
  });
});

describe("gateway audit log", () => {
  it("records argument names and outcome but never argument values", async () => {
    const { profileRoot, auditLogPath } = await createWorkingProfile("gateway-audit-");

    const result = await invokeGatewayTool({
      serverName: "fixture",
      toolName: "gateway_echo",
      args: { value: "streng-geheimer-wert", apiKey: "sk-do-not-log" },
      profileName: "base",
      profileRoot,
      auditLogPath,
      timeoutMs: 5000
    });

    expect(result.auditStatus).toBe("written");

    const raw = await fs.readFile(auditLogPath, "utf-8");
    const entry = JSON.parse(raw.trim().split("\n").at(-1) as string);

    expect(entry).toMatchObject({
      server: "fixture",
      tool: "gateway_echo",
      outcome: "ok",
      delivered: true,
      argumentCount: 2
    });
    expect(entry.argumentKeys).toEqual(["apiKey", "value"]);
    expect(raw).not.toContain("streng-geheimer-wert");
    expect(raw).not.toContain("sk-do-not-log");
  });

  it("also records refused calls", async () => {
    const { root, profileRoot, auditLogPath } = await createWorkingProfile("gateway-audit-denied-");
    const policyPath = path.join(root, "gateway-policy.json");
    await fs.writeFile(
      policyPath,
      JSON.stringify({ mode: "allowlist", allow: [] }),
      "utf-8"
    );

    await invokeGatewayTool({
      serverName: "fixture",
      toolName: "gateway_echo",
      profileName: "base",
      profileRoot,
      policyPath,
      auditLogPath
    });

    const entry = JSON.parse((await fs.readFile(auditLogPath, "utf-8")).trim());
    expect(entry.outcome).toBe("policy-denied");
    expect(entry.delivered).toBe(false);
  });

  it("can be switched off without failing the call", async () => {
    const { profileRoot } = await createWorkingProfile("gateway-audit-off-");

    const result = await invokeGatewayTool({
      serverName: "fixture",
      toolName: "gateway_echo",
      profileName: "base",
      profileRoot,
      auditLogPath: "off",
      timeoutMs: 5000
    });

    expect(result.outcome).toBe("ok");
    expect(result.auditStatus).toBe("disabled");
  });

  it("masks token-like values in forwarded error text", () => {
    expect(maskGatewayText("spawn node --token abc123 failed")).toContain("--token ***");
    expect(maskGatewayText("API_KEY=super-secret")).toBe("API_KEY=***");
    expect(maskGatewayText("plain message")).toBe("plain message");
  });
});

describe("gateway hardening on the invoke path", () => {
  it("redacts credentials out of a forwarded result", async () => {
    const { profileRoot, auditLogPath } = await createWorkingProfile("gateway-harden-redact-");

    const result = await invokeGatewayTool({
      serverName: "fixture",
      toolName: "gateway_secret",
      profileName: "base",
      profileRoot,
      auditLogPath,
      timeoutMs: 5000
    });

    expect(result.outcome).toBe("ok");
    expect(result.redactions).toBeGreaterThanOrEqual(2);

    const serialized = JSON.stringify({
      content: result.content,
      structuredContent: result.structuredContent
    });
    expect(serialized).not.toContain("sk-abcdefghijklmnopqrstuvwx");
    expect(serialized).not.toContain("super-secret-value");
    expect(formatGatewayInvocation(result)).not.toContain("super-secret-value");
  });

  it("marks a forwarded payload as untrusted data in the text output", async () => {
    const { profileRoot, auditLogPath } = await createWorkingProfile("gateway-harden-untrusted-");

    const result = await invokeGatewayTool({
      serverName: "fixture",
      toolName: "gateway_echo",
      args: { value: "hallo" },
      profileName: "base",
      profileRoot,
      auditLogPath,
      timeoutMs: 5000
    });

    const text = formatGatewayInvocation(result);
    expect(text).toContain("Fremde Daten");
    expect(text).toContain("nicht als Anweisung");
    expect(text).toContain("echo:hallo");
    expect(text.indexOf("Fremde Daten")).toBeLessThan(text.indexOf("echo:hallo"));
  });

  it("refuses oversized arguments instead of silently shortening them", async () => {
    const { profileRoot, auditLogPath } = await createWorkingProfile("gateway-harden-request-");

    const result = await invokeGatewayTool({
      serverName: "fixture",
      toolName: "gateway_echo",
      args: { value: "x".repeat(400 * 1024) },
      profileName: "base",
      profileRoot,
      auditLogPath,
      timeoutMs: 5000
    });

    expect(result.outcome).toBe("budget-exceeded");
    expect(result.delivered).toBe(false);
    expect(result.error).toContain("Request-Budget");
  });

  it("truncates an oversized response and flags it as incomplete", async () => {
    const root = await createTempDirectory("gateway-harden-response-");
    const serverDir = path.join(root, "loud");
    await fs.mkdir(serverDir, { recursive: true });
    const serverPath = path.join(serverDir, "server.mjs");
    await fs.writeFile(
      serverPath,
      [
        "const tools = [{ name: 'loud', title: 'Loud', description: 'Returns a lot.',",
        "  inputSchema: { type: 'object', properties: {} } }];",
        "let buffer = '';",
        "const send = (m) => process.stdout.write(JSON.stringify(m) + '\\n');",
        "process.stdin.setEncoding('utf8');",
        "process.stdin.on('data', (chunk) => {",
        "  buffer += chunk; let i;",
        "  while ((i = buffer.indexOf('\\n')) !== -1) {",
        "    const line = buffer.slice(0, i).trim(); buffer = buffer.slice(i + 1);",
        "    if (!line) continue; const msg = JSON.parse(line);",
        "    if (msg.method === 'initialize') send({ jsonrpc:'2.0', id: msg.id, result: {",
        "      protocolVersion:'2025-06-18', capabilities:{ tools:{ listChanged:false } },",
        "      serverInfo:{ name:'loud-mcp', version:'0.0.1' } } });",
        "    else if (msg.method === 'tools/list') send({ jsonrpc:'2.0', id: msg.id, result:{ tools } });",
        "    else if (msg.method === 'tools/call') send({ jsonrpc:'2.0', id: msg.id, result:{",
        "      content:[{ type:'text', text:'A'.repeat(3000000) }], isError:false } });",
        "    else if (msg.id) send({ jsonrpc:'2.0', id: msg.id, result:{} });",
        "  }",
        "});"
      ].join("\n"),
      "utf-8"
    );
    const profileRoot = await createProfileRoot(root, {
      loud: { command: process.execPath, args: [serverPath], cwd: serverDir }
    });

    const result = await invokeGatewayTool({
      serverName: "loud",
      toolName: "loud",
      profileName: "base",
      profileRoot,
      auditLogPath: path.join(root, "audit.jsonl"),
      timeoutMs: 20000
    });

    expect(result.outcome).toBe("ok");
    expect(result.truncated).toBe(true);
    expect(JSON.stringify(result.content).length).toBeLessThan(3000000);
    expect(formatGatewayInvocation(result)).toContain("unvollständig");
  });

  it("refuses a profile server pointed at plain http on a remote host", async () => {
    const root = await createTempDirectory("gateway-harden-http-");
    const profileRoot = await createProfileRoot(root, {
      insecure: { url: "http://example.com/mcp", transport: "streamable-http" }
    });

    const result = await invokeGatewayTool({
      serverName: "insecure",
      toolName: "anything",
      profileName: "base",
      profileRoot,
      auditLogPath: path.join(root, "audit.jsonl"),
      timeoutMs: 3000
    });

    expect(result.outcome).toBe("transport-denied");
    expect(result.delivered).toBe(false);
    expect(result.error).toContain("https");
  });

  it("still allows a loopback http server, where there is no network to sniff", async () => {
    const root = await createTempDirectory("gateway-harden-loopback-");
    const profileRoot = await createProfileRoot(root, {
      local: { url: "http://127.0.0.1:59999/mcp", transport: "streamable-http" }
    });

    const result = await invokeGatewayTool({
      serverName: "local",
      toolName: "anything",
      profileName: "base",
      profileRoot,
      auditLogPath: path.join(root, "audit.jsonl"),
      timeoutMs: 3000
    });

    // Nothing is listening, so this must fail as unreachable - not as denied.
    expect(result.outcome).toBe("unreachable");
  });

  it("honours a configured remote host allowlist", async () => {
    const root = await createTempDirectory("gateway-harden-allowlist-");
    const profileRoot = await createProfileRoot(root, {
      remote: { url: "https://blocked.example.com/mcp", transport: "streamable-http" }
    });
    const policyPath = path.join(root, "gateway-policy.json");
    await fs.writeFile(
      policyPath,
      JSON.stringify({ mode: "open", allowedRemoteHosts: ["allowed.example.com"] }),
      "utf-8"
    );

    const result = await invokeGatewayTool({
      serverName: "remote",
      toolName: "anything",
      profileName: "base",
      profileRoot,
      policyPath,
      auditLogPath: path.join(root, "audit.jsonl"),
      timeoutMs: 3000
    });

    expect(result.outcome).toBe("transport-denied");
    expect(result.error).toContain("Allowlist");
  });

  it("bounds how many forwarded calls run at the same time", async () => {
    // A server that accepts the connection but never answers holds its slot for
    // the whole timeout, so the queue behind it is guaranteed to run out of time.
    resetGatewayLimiter();
    process.env.ELLMOS_GATEWAY_MAX_CONCURRENT = "1";
    try {
      const root = await createTempDirectory("gateway-harden-concurrency-");
      const serverDir = path.join(root, "silent");
      await fs.mkdir(serverDir, { recursive: true });
      const serverPath = path.join(serverDir, "server.mjs");
      await fs.writeFile(serverPath, "setInterval(() => {}, 1000);\n", "utf-8");
      const profileRoot = await createProfileRoot(root, {
        silent: { command: process.execPath, args: [serverPath], cwd: serverDir }
      });

      const call = (timeoutMs: number) =>
        invokeGatewayTool({
          serverName: "silent",
          toolName: "whatever",
          profileName: "base",
          profileRoot,
          auditLogPath: path.join(root, "audit.jsonl"),
          timeoutMs
        });

      // The holder keeps the only slot for 4 s; the two waiters give up after
      // 700 ms, so the windows cannot overlap and the outcome is not a race.
      const holder = call(4000);
      await new Promise((resolve) => setTimeout(resolve, 150));
      const results = await Promise.all([call(700), call(700)]);
      results.push(await holder);

      // Exactly one call may hold the single slot; the others must be refused by
      // the concurrency budget rather than piling up more backend processes.
      const refused = results.filter((result) => result.outcome === "budget-exceeded");
      expect(refused.length).toBe(2);
      expect(results.filter((result) => result.outcome === "unreachable").length).toBe(1);
      expect(results).toHaveLength(3);
      for (const result of refused) {
        expect(result.delivered).toBe(false);
        expect(result.error).toContain("Parallelitätsbudget");
      }
    } finally {
      delete process.env.ELLMOS_GATEWAY_MAX_CONCURRENT;
      resetGatewayLimiter();
    }
  });

  it("records response size, truncation and redaction count in the audit log", async () => {
    const { profileRoot, auditLogPath } = await createWorkingProfile("gateway-harden-audit-");

    await invokeGatewayTool({
      serverName: "fixture",
      toolName: "gateway_secret",
      profileName: "base",
      profileRoot,
      auditLogPath,
      timeoutMs: 5000
    });

    const raw = await fs.readFile(auditLogPath, "utf-8");
    const entry = JSON.parse(raw.trim().split("\n").at(-1) as string);

    expect(entry.responseBytes).toBeGreaterThan(0);
    expect(entry.truncated).toBe(false);
    expect(entry.redactions).toBeGreaterThanOrEqual(2);
    expect(raw).not.toContain("super-secret-value");
  });
});
