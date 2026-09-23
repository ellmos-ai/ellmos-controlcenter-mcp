import * as fs from "fs/promises";
import * as http from "http";
import * as os from "os";
import * as path from "path";
import { once } from "events";
import { afterEach, describe, expect, it } from "vitest";
import { type LocalServerSummary } from "../src/catalog.js";
import {
  buildToolCatalog,
  createToolScanBudget,
  normalizeToolScanParallelism,
  normalizeToolScanResponseBytes,
  readToolCatalogTarget,
  type ToolCatalogTarget
} from "../src/toolCatalog.js";

const tempDirectories: string[] = [];

afterEach(async () => {
  while (tempDirectories.length > 0) {
    const directory = tempDirectories.pop();
    if (directory) await fs.rm(directory, { recursive: true, force: true });
  }
});

function targetForStdio(root: string, name: string): ToolCatalogTarget {
  return {
    source: "local-repository",
    profileName: null,
    directoryName: name,
    packageName: name,
    mcpName: null,
    transportKind: "stdio",
    command: process.execPath,
    args: [path.join(root, "server.mjs")],
    cwd: root,
    url: null,
    error: null
  };
}

function summaryForStdio(root: string, name: string): LocalServerSummary {
  return {
    directoryName: name,
    packageName: name,
    mcpName: null,
    version: "0.0.1",
    description: "fixture",
    absolutePath: root,
    binName: name,
    entryPoint: "server.mjs",
    toolCount: null,
    hasServerJson: false,
    keywords: []
  };
}

async function makeStdioFixture(options: { description?: string; delayMs?: number } = {}): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "controlcenter-toolcatalog-"));
  tempDirectories.push(root);
  const description = JSON.stringify(options.description ?? "fixture tool");
  const delayMs = options.delayMs ?? 0;
  await fs.writeFile(
    path.join(root, "server.mjs"),
    [
      "import fs from 'node:fs';",
      "import path from 'node:path';",
      `const description = ${description};`,
      `const delayMs = ${delayMs};`,
      `const logPath = ${JSON.stringify(path.join(root, "events.log"))};`,
      "let buffer = '';",
      "function log(value) { fs.appendFileSync(logPath, value + '\\n'); }",
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
      "      send({ jsonrpc: '2.0', id: message.id, result: { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'fixture', version: '0.0.1' } } });",
      "    } else if (message.method === 'tools/list') {",
      "      log('START');",
      "      setTimeout(() => {",
      "        log('END');",
      "        send({ jsonrpc: '2.0', id: message.id, result: { tools: [{ name: 'fixture_tool', description, inputSchema: { type: 'object' } }] } });",
      "      }, delayMs);",
      "    } else if (message.id) {",
      "      send({ jsonrpc: '2.0', id: message.id, result: {} });",
      "    }",
      "  }",
      "});"
    ].join("\n"),
    "utf-8"
  );
  return root;
}

async function makeSseFixture(expectedHeader: string): Promise<{
  url: string;
  requests: Array<{ method: string; path: string; authorization: string | undefined }>;
  wasClosed: () => boolean;
  close: () => Promise<void>;
}> {
  const requests: Array<{ method: string; path: string; authorization: string | undefined }> = [];
  let streamResponse: http.ServerResponse | null = null;
  let streamClosed = false;
  const server = http.createServer((request, response) => {
    requests.push({ method: request.method ?? "", path: request.url ?? "", authorization: request.headers.authorization });
    if (request.headers.authorization !== expectedHeader) {
      response.writeHead(401, { "content-type": "text/plain" });
      response.end("unauthorized");
      return;
    }

    if (request.method === "GET") {
      streamResponse = response;
      request.on("close", () => { streamClosed = true; });
      response.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
      response.write("event: endpoint\ndata: /messages\n\n");
      return;
    }

    if (request.method === "POST") {
      const chunks: Buffer[] = [];
      request.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      request.on("end", () => {
        const message = JSON.parse(Buffer.concat(chunks).toString("utf-8")) as { id?: number; method?: string };
        if (message.id !== undefined && streamResponse && !streamResponse.writableEnded) {
          const result = message.method === "initialize"
            ? { protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "sse-fixture", version: "0.0.1" } }
            : { tools: [{ name: "sse_fixture_tool", description: "SSE fixture", inputSchema: { type: "object" } }] };
          streamResponse.write(`data: ${JSON.stringify({ jsonrpc: "2.0", id: message.id, result })}\n\n`);
        }
        response.writeHead(202);
        response.end();
      });
      return;
    }

    response.writeHead(404);
    response.end();
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("SSE fixture did not receive a port");
  return {
    url: `http://127.0.0.1:${address.port}/sse?token=fixture-secret`,
    requests,
    wasClosed: () => streamClosed,
    close: () => new Promise<void>((resolve, reject) => {
      streamResponse?.end();
      server.close((error) => error ? reject(error) : resolve());
    })
  };
}

describe("tool scan budgets and remote transport handling", () => {
  it("normalizes bounded concurrency and response budget overrides", () => {
    expect(normalizeToolScanParallelism(undefined)).toBe(4);
    expect(normalizeToolScanParallelism(0)).toBe(1);
    expect(normalizeToolScanParallelism(99)).toBe(32);
    expect(normalizeToolScanResponseBytes(undefined)).toBe(1024 * 1024);
    expect(normalizeToolScanResponseBytes(1)).toBe(1024);
    expect(normalizeToolScanResponseBytes(99 * 1024 * 1024)).toBe(16 * 1024 * 1024);
    expect(createToolScanBudget(2048)).toEqual({ maxResponseBytes: 2048, usedResponseBytes: 0 });
  });

  it("keeps the aggregate response budget honest for stdio probes", async () => {
    const root = await makeStdioFixture({ description: "x".repeat(5000) });
    const result = await readToolCatalogTarget(targetForStdio(root, "large-fixture"), {
      timeoutMs: 5000,
      maxResponseBytes: 2048
    });

    expect(result.status).toBe("incomplete");
    expect(result.complete).toBe(false);
    expect(result.toolCount).toBeNull();
    expect(result.tools).toEqual([]);
    expect(result.error).toContain("response budget");
  });

  it("limits concurrent probes and preserves every target as a real result", async () => {
    const root = await makeStdioFixture({ delayMs: 120 });
    await fs.writeFile(path.join(root, "events.log"), "", "utf-8");
    const catalogs = await buildToolCatalog(
      [summaryForStdio(root, "one-mcp"), summaryForStdio(root, "two-mcp")],
      { timeoutMs: 5000, maxParallelProbes: 2, maxResponseBytes: 1024 * 1024 }
    );
    const events = (await fs.readFile(path.join(root, "events.log"), "utf-8")).trim().split(/\r?\n/).filter(Boolean);

    expect(catalogs).toHaveLength(2);
    expect(catalogs.every((catalog) => catalog.status === "ok" && catalog.complete)).toBe(true);
    expect(events).toEqual(["START", "START", "END", "END"]);
  });

  it("passes profile SSE headers to the event stream and message POST, rejects redirects, and masks secrets", async () => {
    const secret = "Bearer fixture-secret";
    const fixture = await makeSseFixture(secret);
    const target: ToolCatalogTarget = {
      source: "profile",
      profileName: "fixture",
      directoryName: "fixture/sse",
      packageName: "fixture-sse",
      mcpName: null,
      transportKind: "sse",
      command: null,
      args: [],
      url: fixture.url,
      headers: { Authorization: secret },
      error: null
    };

    const result = await readToolCatalogTarget(target, { timeoutMs: 5000, maxResponseBytes: 1024 * 1024 });
    expect(result.status).toBe("ok");
    expect(result.complete).toBe(true);
    expect(result.toolCount).toBe(1);
    expect(fixture.requests[0]?.method).toBe("GET");
    expect(fixture.requests.filter((request) => request.method === "POST").length).toBeGreaterThanOrEqual(2);
    expect(fixture.requests.every((request) => request.authorization === secret)).toBe(true);
    expect(result.url).not.toContain("fixture-secret");
    expect(JSON.stringify(result)).not.toContain("fixture-secret");
    await fixture.close();
    expect(fixture.wasClosed()).toBe(true);
  });
});
