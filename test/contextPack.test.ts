import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { describe, expect, it } from "vitest";
import { buildStackContextPack } from "../src/contextPack.js";

async function fixtureRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "controlcenter-context-pack-"));
  await fs.mkdir(path.join(root, "private"), { recursive: true });
  await fs.writeFile(path.join(root, "stacks.catalog.json"), JSON.stringify({
    schema: "ellmos.stacks.catalog.v1",
    stacks: [{ id: "private", name: "Private Stack", path: "private", manifest: "private/stack.v2.json", visibility: "private" }]
  }), "utf-8");
  await fs.writeFile(path.join(root, "private", "stack.v2.json"), JSON.stringify({
    schema: "ellmos.stack.v2",
    id: "private",
    components: [{ id: "core" }],
    mcp_servers: ["controlcenter"],
    required_roles: ["routing.default"],
    policies: { network: "declared", secret: "must-not-appear", unsafe: { command: "must-not-appear" } }
  }), "utf-8");
  return root;
}

describe("stack context packs", () => {
  it("creates a manifest-only short pack without local path disclosure", async () => {
    const root = await fixtureRoot();
    const pack = await buildStackContextPack("private", "short", root);
    expect(pack).toContain("# Context Pack: Private Stack");
    expect(pack).toContain("- core");
    expect(pack).toContain("- controlcenter");
    expect(pack).not.toContain(root);
    expect(pack).not.toContain("Execution boundary");
  });

  it("adds execution safeguards and declared policy only at the requested levels", async () => {
    const root = await fixtureRoot();
    const execution = await buildStackContextPack("private", "execution", root);
    const full = await buildStackContextPack("private", "full", root);
    expect(execution).toContain("This is a read-only plan input");
    expect(execution).toContain("routing.default");
    expect(execution).not.toContain("Declared policies");
    expect(full).toContain("private/stack.v2.json");
    expect(full).toContain("- network: declared");
    expect(full).not.toContain("must-not-appear");
    expect(full).toContain("not proof of runtime enforcement");
  });

  it("returns null for an unknown registered stack", async () => {
    expect(await buildStackContextPack("missing", "short", await fixtureRoot())).toBeNull();
  });

  it("escapes and bounds untrusted manifest strings", async () => {
    const root = await fixtureRoot();
    const manifestPath = path.join(root, "private", "stack.v2.json");
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf-8"));
    manifest.components = [{ id: "safe\n# not-a-heading" }];
    await fs.writeFile(manifestPath, JSON.stringify(manifest), "utf-8");
    const pack = await buildStackContextPack("private", "short", root);
    expect(pack).toContain("safe \\# not-a-heading");
    manifest.components = Array.from({ length: 45 }, (_, index) => ({ id: `component-${index}` }));
    await fs.writeFile(manifestPath, JSON.stringify(manifest), "utf-8");
    expect(await buildStackContextPack("private", "short", root)).toContain("additional declared items omitted");
  });
});
