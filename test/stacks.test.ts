import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { describe, expect, it } from "vitest";
import { describeStack, getDefaultStacksRoot, scanStacks } from "../src/stacks.js";

async function fixtureRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "controlcenter-stacks-"));
  await fs.mkdir(path.join(root, "private"), { recursive: true });
  await fs.writeFile(path.join(root, "stacks.catalog.json"), JSON.stringify({
    schema: "ellmos.stacks.catalog.v1",
    stacks: [{
      id: "private",
      name: "Private Stack",
      path: "private",
      manifest: "private/stack.v2.json",
      kind: "private-product-stack",
      status: "development",
      visibility: "private",
      roles: ["on-prem"]
    }]
  }), "utf-8");
  await fs.writeFile(path.join(root, "private", "stack.v2.json"), JSON.stringify({
    schema: "ellmos.stack.v2",
    id: "private",
    components: [{ id: "core" }, { id: "router" }],
    required_roles: ["routing.default"],
    skills: ["skills"],
    mcp_servers: ["controlcenter"],
    nested_stacks: ["base"],
    external_components: [{ id: "ollama" }],
    policies: { network: "declared", local_first: true }
  }), "utf-8");
  return root;
}

describe("stack discovery", () => {
  it("resolves the default stacks root from OneDrive", () => {
    expect(getDefaultStacksRoot({ OneDrive: "C:\\Users\\Test\\OneDrive" }, "C:\\Users\\Test"))
      .toContain(path.join(".TOPICS", ".AI", ".STACKS"));
  });

  it("reads the stack catalog and manifest summaries", async () => {
    const stacks = await scanStacks(await fixtureRoot());
    expect(stacks).toHaveLength(1);
    expect(stacks[0]).toMatchObject({
      id: "private",
      visibility: "private",
      manifestSchema: "ellmos.stack.v2",
      componentCount: 2,
      mcpServerCount: 1
    });
    expect(stacks[0].warnings).toEqual([]);
  });

  it("describes typed stack components without executing them", async () => {
    const stack = await describeStack("private", await fixtureRoot());
    expect(stack).toMatchObject({
      components: ["core", "router"],
      mcpServers: ["controlcenter"],
      skills: ["skills"],
      nestedStacks: ["base"],
      externalComponents: ["ollama"],
      requiredRoles: ["routing.default"],
      policies: { network: "declared", local_first: true }
    });
  });

  it("rejects catalog paths that escape the stacks root", async () => {
    const root = await fixtureRoot();
    const catalog = JSON.parse(await fs.readFile(path.join(root, "stacks.catalog.json"), "utf-8"));
    catalog.stacks[0].manifest = "../private.json";
    await fs.writeFile(path.join(root, "stacks.catalog.json"), JSON.stringify(catalog), "utf-8");
    expect(await scanStacks(root)).toEqual([]);
  });

  it("returns no entries for an invalid catalog", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "controlcenter-stacks-invalid-"));
    await fs.writeFile(path.join(root, "stacks.catalog.json"), "{}", "utf-8");
    expect(await scanStacks(root)).toEqual([]);
    expect(await describeStack("missing", root)).toBeNull();
  });
});
