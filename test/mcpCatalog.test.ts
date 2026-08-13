import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { describe, expect, it } from "vitest";
import {
  describeMcpServer,
  findCatalogEntry,
  getMcpCatalogPath,
  loadMcpCatalog,
  MCP_CATALOG_FILENAME,
  scanLocalServerLandscape
} from "../src/mcpCatalog.js";

async function makeRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "controlcenter-mcpcatalog-"));
}

async function addServer(root: string, directoryName: string, packageName = directoryName): Promise<void> {
  const dir = path.join(root, directoryName);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, "package.json"),
    JSON.stringify({ name: packageName, version: "1.2.3", description: "fixture with 4 tools" }),
    "utf-8"
  );
}

const CATALOG = {
  schema: "ellmos.mcps.v1",
  updated: "2026-08-13",
  maintained_by: "hand-curated fixture",
  kinds: ["tool", "adapter", "stack", "control-plane"],
  mcps: [
    {
      id: "alpha-mcp",
      mcp_kind: "tool",
      namespace: "al_*",
      npm: "alpha-mcp",
      persistent_state: false,
      state_owner: {}
    },
    {
      id: "beta-mcp",
      mcp_kind: "stack",
      namespace: "be_*",
      npm: "beta-mcp",
      persistent_state: true,
      state_owner: { be_garden: "GARDENER owns the two SQLite stores" },
      composition: "beta-stack",
      note: "composes the beta stack"
    },
    {
      // Published under a different npm name — the join must fall back to it.
      id: "renamed-mcp",
      mcp_kind: "adapter",
      npm: "ellmos-renamed-mcp",
      persistent_state: false,
      state_owner: {},
      wraps: "renamed core module"
    },
    {
      // No directory below the root: must surface as catalogOnly, not vanish.
      id: "ghost-mcp",
      mcp_kind: "tool",
      npm: "ghost-mcp",
      persistent_state: false,
      state_owner: {}
    }
  ]
};

async function writeCatalog(root: string, content: unknown = CATALOG): Promise<void> {
  await fs.writeFile(path.join(root, MCP_CATALOG_FILENAME), JSON.stringify(content), "utf-8");
}

async function populatedRoot(): Promise<string> {
  const root = await makeRoot();
  await addServer(root, "alpha-mcp");
  await addServer(root, "beta-mcp");
  // Directory name and catalog id differ; only the npm package name matches.
  await addServer(root, "renamed-dir-mcp", "ellmos-renamed-mcp");
  // Present on disk but absent from the catalog.
  await addServer(root, "orphan-mcp");
  return root;
}

describe("mcp catalog discovery", () => {
  it("enriches scanned servers with kind and state ownership from the catalog", async () => {
    const root = await populatedRoot();
    await writeCatalog(root);

    const landscape = await scanLocalServerLandscape(root, {});

    expect(landscape.rootReadable).toBe(true);
    expect(landscape.catalog.status).toBe("ok");
    expect(landscape.catalog.updated).toBe("2026-08-13");

    const alpha = landscape.servers.find((server) => server.directoryName === "alpha-mcp");
    expect(alpha?.catalog).toMatchObject({ mcpKind: "tool", persistentState: false, namespace: "al_*" });

    const beta = landscape.servers.find((server) => server.directoryName === "beta-mcp");
    expect(beta?.catalog).toMatchObject({ mcpKind: "stack", persistentState: true, composition: "beta-stack" });
    expect(beta?.catalog?.stateOwner).toEqual({ be_garden: "GARDENER owns the two SQLite stores" });
  });

  it("degrades to plain directory data when the catalog is absent", async () => {
    const root = await populatedRoot();

    const landscape = await scanLocalServerLandscape(root, {});

    expect(landscape.catalog.status).toBe("missing");
    expect(landscape.catalog.entries).toEqual([]);
    expect(landscape.catalog.catalogPath).toBe(path.join(root, MCP_CATALOG_FILENAME));
    // The servers themselves are still discovered — only the enrichment is gone.
    expect(landscape.servers.map((server) => server.directoryName)).toEqual([
      "alpha-mcp",
      "beta-mcp",
      "orphan-mcp",
      "renamed-dir-mcp"
    ]);
    expect(landscape.servers.every((server) => server.catalog === null)).toBe(true);
    expect(landscape.catalogOnly).toEqual([]);
  });

  it("reports both join directions: unmatched servers and catalog-only entries", async () => {
    const root = await populatedRoot();
    await writeCatalog(root);

    const landscape = await scanLocalServerLandscape(root, {});

    const orphan = landscape.servers.find((server) => server.directoryName === "orphan-mcp");
    expect(orphan?.catalog).toBeNull();

    expect(landscape.catalogOnly.map((entry) => entry.id)).toEqual(["ghost-mcp"]);
  });

  it("joins on the npm package name when the directory name differs from the catalog id", async () => {
    const root = await populatedRoot();
    await writeCatalog(root);

    const landscape = await scanLocalServerLandscape(root, {});
    const renamed = landscape.servers.find((server) => server.directoryName === "renamed-dir-mcp");

    expect(renamed?.catalog).toMatchObject({ id: "renamed-mcp", mcpKind: "adapter", wraps: "renamed core module" });
    // Having been matched, it must not also be reported as catalog-only.
    expect(landscape.catalogOnly.map((entry) => entry.id)).not.toContain("renamed-mcp");
  });

  it("flags a foreign catalog schema instead of reading it", async () => {
    const root = await populatedRoot();
    await writeCatalog(root, { schema: "ellmos.mcps.v99", mcps: [{ id: "alpha-mcp", mcp_kind: "tool" }] });

    const catalog = await loadMcpCatalog(root, {});

    expect(catalog.status).toBe("schema_mismatch");
    expect(catalog.schema).toBe("ellmos.mcps.v99");
    expect(catalog.entries).toEqual([]);
  });

  it("flags a corrupt catalog instead of throwing", async () => {
    const root = await populatedRoot();
    await fs.writeFile(path.join(root, MCP_CATALOG_FILENAME), "{ not json", "utf-8");

    const catalog = await loadMcpCatalog(root, {});

    expect(catalog.status).toBe("unreadable");
    expect(catalog.entries).toEqual([]);
  });

  it("reports an unreadable root instead of claiming an empty result", async () => {
    const root = path.join(os.tmpdir(), "controlcenter-mcpcatalog-does-not-exist");

    const landscape = await scanLocalServerLandscape(root, {});

    expect(landscape.rootReadable).toBe(false);
    expect(landscape.servers).toEqual([]);
    expect(landscape.catalog.status).toBe("missing");
  });

  it("honours an explicit catalog path over the mcp root", async () => {
    const root = await populatedRoot();
    const elsewhere = await makeRoot();
    const catalogPath = path.join(elsewhere, "custom.catalog.json");
    await fs.writeFile(catalogPath, JSON.stringify(CATALOG), "utf-8");

    expect(getMcpCatalogPath(root, { ELLMOS_MCP_CATALOG: catalogPath })).toBe(catalogPath);

    const landscape = await scanLocalServerLandscape(root, { ELLMOS_MCP_CATALOG: catalogPath });
    expect(landscape.catalog.status).toBe("ok");
    expect(landscape.servers.find((server) => server.directoryName === "alpha-mcp")?.catalog?.mcpKind).toBe("tool");
  });

  it("resolves a single server by directory, catalog id or npm name", async () => {
    const root = await populatedRoot();
    await writeCatalog(root);

    const byDirectory = await describeMcpServer("beta-mcp", root, {});
    expect(byDirectory?.entry?.mcpKind).toBe("stack");
    expect(byDirectory?.server?.version).toBe("1.2.3");

    const byNpmName = await describeMcpServer("ellmos-renamed-mcp", root, {});
    expect(byNpmName?.entry?.id).toBe("renamed-mcp");
    expect(byNpmName?.server?.directoryName).toBe("renamed-dir-mcp");

    // Known to the catalog only: described, but without local directory data.
    const catalogOnly = await describeMcpServer("ghost-mcp", root, {});
    expect(catalogOnly?.server).toBeNull();
    expect(catalogOnly?.entry?.id).toBe("ghost-mcp");

    expect(await describeMcpServer("nowhere-mcp", root, {})).toBeNull();
  });

  it("matches catalog entries by id before falling back to the npm name", () => {
    const catalog = {
      status: "ok" as const,
      catalogPath: "irrelevant",
      schema: "ellmos.mcps.v1",
      updated: null,
      maintainedBy: null,
      kinds: [],
      entries: [
        {
          id: "second-mcp",
          mcpKind: "tool",
          namespace: null,
          npm: "first-mcp",
          persistentState: null,
          stateOwner: {},
          note: null,
          wraps: null,
          wrapsTarget: null,
          targetKind: null,
          composition: null,
          source: null
        },
        {
          id: "first-mcp",
          mcpKind: "adapter",
          namespace: null,
          npm: "first-mcp-npm",
          persistentState: null,
          stateOwner: {},
          note: null,
          wraps: null,
          wrapsTarget: null,
          targetKind: null,
          composition: null,
          source: null
        }
      ]
    };

    const match = findCatalogEntry(catalog, { directoryName: "first-mcp", packageName: "first-mcp" });
    expect(match?.id).toBe("first-mcp");
    expect(findCatalogEntry(catalog, { directoryName: "unknown", packageName: null })).toBeNull();
  });
});
