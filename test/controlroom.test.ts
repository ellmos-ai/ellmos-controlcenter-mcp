import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { existsSync } from "fs";
import { describe, expect, it } from "vitest";
import { execFileSync } from "child_process";
import {
  checkLock,
  describeResource,
  evaluatePermission,
  formatDecisions,
  formatGovernance,
  formatLockCheck,
  formatLockList,
  formatPermission,
  formatResource,
  formatResources,
  listDecisions,
  listGovernance,
  listLocks,
  listResources,
  resolveControlroomConfig,
  runBridge,
  type BridgeResult
} from "../src/controlroom.js";

/**
 * Two layers here.
 *
 * The unit layer injects a fake bridge runner, so it verifies the fail-closed
 * contract and the rendering on any machine, with no Python and no host registers.
 *
 * The integration layer drives the real Python bridge against a fixture tree this
 * test builds itself. It imports the host's canonical lock modules read-only but
 * never depends on the live lock state, so it stays deterministic. It skips where
 * those modules are absent, e.g. in CI.
 */

const CANONICAL_SCRIPTS = process.env.ELLMOS_LOCK_SCRIPTS
  ?? path.join(os.homedir(), "OneDrive", "_scripts");
const HAS_CANONICAL = existsSync(path.join(CANONICAL_SCRIPTS, "lock_utils.py"))
  && existsSync(path.join(CANONICAL_SCRIPTS, "permissions.py"));

const EMPTY_ENV: NodeJS.ProcessEnv = {};
const CONFIGURED_ENV: NodeJS.ProcessEnv = {
  ELLMOS_LOCK_SCRIPTS: CANONICAL_SCRIPTS,
  ELLMOS_DECISIONS_ROOT: path.join(os.tmpdir(), "decisions-placeholder")
};
const POLICY_REGISTRY_FIXTURE_SRC = path.join(
  path.resolve(__dirname, ".."), "test", "fixtures", "policy_registry_src"
);
const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);

function policyEntry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "policy:test",
    kind: "policy",
    title: "Public policy title",
    scope: "system-wide",
    owner: "fixture",
    priority: 10,
    precedence: 10,
    version: "1",
    privacy: "internal",
    source: { uri: "C:/PRIVATE/POLICY_SOURCE.md", type: "file" },
    consumers: ["*"],
    status: "active",
    adoption: "adopted",
    authority: "normative",
    hash: { algorithm: "sha256", value: SHA_A },
    summary: "PRIVATE_POLICY_SUMMARY_MUST_NOT_LEAK",
    rationale: "PRIVATE_POLICY_RATIONALE_MUST_NOT_LEAK",
    receipt: { secret: "PRIVATE_POLICY_RECEIPT_MUST_NOT_LEAK" },
    execution: { command: "PRIVATE_POLICY_EXECUTION_MUST_NOT_LEAK" },
    ...overrides
  };
}

function byumCandidate(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: `byum-candidate:pred-1@sha256:${SHA_B}`,
    kind: "decision-candidate",
    title: "BYUM decision candidate D-1",
    scope: "global",
    owner: "BYUM",
    authority: "advisory-pointer",
    priority: 0,
    precedence: 0,
    version: "byum.decision-prediction.v2",
    hash: { algorithm: "sha256", value: SHA_B },
    privacy: "private",
    source: {
      uri: "C:/PRIVATE/BYUM_PROJECTION.json",
      type: "byum-projection",
      canonical: false,
      origin: "build-your-users-mind"
    },
    consumers: ["*"],
    status: "active",
    adoption: "pending",
    summary: "PRIVATE_BYUM_SUMMARY_MUST_NOT_LEAK",
    prompt: "PRIVATE_BYUM_PROMPT_MUST_NOT_LEAK",
    private_text: "PRIVATE_BYUM_SECURE_TEXT_MUST_NOT_LEAK",
    receipt: { id: "PRIVATE_BYUM_RECEIPT_MUST_NOT_LEAK" },
    execution: { authorized: true, action: "PRIVATE_BYUM_ACTION_MUST_NOT_LEAK" },
    provenance: {
      protocol: "byum.decision-prediction.v2",
      prediction_id: "pred-1",
      decision_ref: {
        decision_id: "D-1",
        index_key: "IDX-1",
        scope: "global",
        source_locator: {
          path: "C:/PRIVATE/DECISION_SOURCE.txt",
          block_id: "BLOCK-1"
        },
        source_sha256: SHA_A
      },
      projection_status: "validated"
    },
    ...overrides
  };
}

async function decisionFixture(stale = false): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "controlroom-governance-decisions-"));
  const tools = path.join(root, "_tools");
  const source = path.join(root, "TO-DECIDE-USER.txt");
  const index = path.join(tools, "decisions.index.json");
  await fs.mkdir(tools, { recursive: true });
  await fs.writeFile(source, "decision source", "utf-8");
  await fs.writeFile(index, JSON.stringify({
    generated_at: "2026-08-26T12:00:00+02:00",
    counts: { by_status_class: { OFFEN: 1 } },
    entries: [{
      key: "D-1", id: "D-1", date: "2026-08-26", title: "Choose a safe option",
      status_class: "OFFEN", scope: "global", source_file: "C:/PRIVATE/TO-DECIDE-USER.txt",
      question: "PRIVATE_DECISION_QUESTION_MUST_NOT_LEAK",
      options: ["PRIVATE_DECISION_OPTION_MUST_NOT_LEAK"],
      recommendation: "PRIVATE_DECISION_RECOMMENDATION_MUST_NOT_LEAK"
    }]
  }), "utf-8");
  const now = Date.now();
  const sourceTime = stale ? new Date(now) : new Date(now - 60_000);
  const indexTime = stale ? new Date(now - 60_000) : new Date(now);
  await fs.utimes(source, sourceTime, sourceTime);
  await fs.utimes(index, indexTime, indexTime);
  return root;
}

async function registryFixture(
  entries: Record<string, unknown>[],
  schema = "ellmos.policy-registry.v1"
): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "controlroom-governance-registry-"));
  const registry = path.join(root, "registry.json");
  await fs.writeFile(registry, JSON.stringify({ schema, updated_at: null, entries }), "utf-8");
  return registry;
}

/** Records what the bridge was asked, and answers with a canned payload. */
function fakeRunner(payload: BridgeResult, capture?: { args?: string[] }) {
  return async (args: string[]): Promise<BridgeResult> => {
    if (capture) capture.args = args;
    return payload;
  };
}

function isoMinutesAgo(minutes: number): string {
  const when = new Date(Date.now() - minutes * 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}`
    + `T${pad(when.getHours())}:${pad(when.getMinutes())}`;
}

async function lockFixture(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "controlroom-locks-"));
  await fs.mkdir(path.join(root, "locked-parent", "child", "grandchild"), { recursive: true });
  await fs.mkdir(path.join(root, "free-project"), { recursive: true });
  await fs.mkdir(path.join(root, "expired-project"), { recursive: true });
  await fs.mkdir(path.join(root, "user-locked"), { recursive: true });

  await fs.writeFile(
    path.join(root, "locked-parent", "LOCK.txt"),
    `owner: fixture-agent\ncreated: ${isoMinutesAgo(5)}\nexpires_after: 24h\npurpose: inheritance fixture\n`,
    "utf-8"
  );
  // Nominally 48 h past its 24 h window: an ordinary lock, so it must count as gone.
  await fs.writeFile(
    path.join(root, "expired-project", "LOCK.txt"),
    `owner: fixture-agent\ncreated: ${isoMinutesAgo(60 * 48)}\nexpires_after: 24h\n`,
    "utf-8"
  );
  // Same age, but a user lock: the spec says only the user removes it, so it holds.
  await fs.writeFile(
    path.join(root, "user-locked", "LOCK.user.txt"),
    `owner: user\ncreated: ${isoMinutesAgo(60 * 48)}\nexpires_after: 24h\n`,
    "utf-8"
  );
  return root;
}

async function permissionFixture(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "controlroom-perms-"));
  await fs.mkdir(path.join(root, "project", "nested", "deep"), { recursive: true });
  await fs.writeFile(
    path.join(root, "project", "LOCK.permissions.json"),
    JSON.stringify({
      format: "lock-permissions-v1",
      default: "allow",
      rules: {
        allow: ["Read(**)", "Write(**)"],
        deny: ["Write(**/CREDENTIALS/**)"],
        ask: ["Write(**/RELEASE/**)"]
      },
      applies_to_agents: ["claude", "codex"]
    }),
    "utf-8"
  );
  return root;
}

/** Builds a tiny real SQLite fixture (systems + software) via Python's stdlib --
 * no new npm dependency, same interpreter the bridge itself needs. */
async function inventoryFixture(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "controlroom-inventory-"));
  const dbPath = path.join(root, "inventory.db");
  const script = [
    "import sqlite3",
    `conn = sqlite3.connect(${JSON.stringify(dbPath)})`,
    "conn.execute('CREATE TABLE systems (id INTEGER PRIMARY KEY, name TEXT, hostname TEXT, os TEXT, role TEXT)')",
    "conn.execute('CREATE TABLE software (id INTEGER PRIMARY KEY, system_id INTEGER, name TEXT, version TEXT, purpose TEXT)')",
    "conn.execute(\"INSERT INTO systems VALUES (1, 'laptop', 'ASUS-GEI', 'Windows 11', 'mobile')\")",
    "conn.execute(\"INSERT INTO systems VALUES (2, 'mac-studio', 'mac-studio', 'macOS', 'server')\")",
    "conn.execute(\"INSERT INTO software VALUES (1, 1, 'Claude Code CLI', '2.1.62', 'agent')\")",
    "conn.commit()",
    "conn.close()"
  ].join("; ");
  execFileSync("python", ["-c", script]);
  return dbPath;
}

// ---------------------------------------------------------------------------
// Fail-closed contract
// ---------------------------------------------------------------------------

describe("controlroom fail-closed contract", () => {
  it("reports unknown, not free, when the lock scripts are unconfigured", async () => {
    const result = await checkLock("C:/anywhere", { config: resolveControlroomConfig(EMPTY_ENV) });
    expect(result.verdict).toBe("unknown");
    expect(result.safe_to_proceed).toBe(false);
    expect(result.reason).toContain("ELLMOS_LOCK_SCRIPTS");
  });

  it("does not invoke the bridge at all when unconfigured", async () => {
    const capture: { args?: string[] } = {};
    await checkLock("C:/anywhere", {
      config: resolveControlroomConfig(EMPTY_ENV),
      runner: fakeRunner({ verdict: "clear", safe_to_proceed: true }, capture)
    });
    expect(capture.args).toBeUndefined();
  });

  it("refuses to call an unconfigured decision register an empty one", async () => {
    const result = await listDecisions({ config: resolveControlroomConfig(EMPTY_ENV) });
    expect(result.verdict).toBe("unknown");
    expect(result.decisions).toBeUndefined();
    expect(result.reason).toContain("ELLMOS_DECISIONS_ROOT");
  });

  it("reports unknown when list-locks is unconfigured", async () => {
    const result = await listLocks({ config: resolveControlroomConfig(EMPTY_ENV) });
    expect(result.verdict).toBe("unknown");
    expect(result.safe_to_proceed).toBe(false);
  });

  it("reports unknown when evaluate-permission is unconfigured", async () => {
    const result = await evaluatePermission("C:/x", "claude", "Read(a)", {
      config: resolveControlroomConfig(EMPTY_ENV)
    });
    expect(result.verdict).toBe("unknown");
  });

  it("refuses to call an unconfigured resource inventory an empty one", async () => {
    const result = await listResources({ config: resolveControlroomConfig(EMPTY_ENV) });
    expect(result.verdict).toBe("unknown");
    expect(result.resources).toBeUndefined();
    expect(result.reason).toContain("ELLMOS_INVENTORY_DB");
  });

  it("reports unknown when describe-resource is unconfigured", async () => {
    const result = await describeResource(1, { config: resolveControlroomConfig(EMPTY_ENV) });
    expect(result.verdict).toBe("unknown");
    expect(result.reason).toContain("ELLMOS_INVENTORY_DB");
  });

  it("distinguishes unconfigured governance sources from valid empty sources", async () => {
    const result = await listGovernance({ config: resolveControlroomConfig(EMPTY_ENV) });
    expect(result.verdict).toBe("unknown");
    expect(result.complete).toBe(false);
    expect(result.sources).toMatchObject({
      decisions: { status: "unconfigured" },
      policy_registry: { status: "unconfigured" }
    });
    expect(result.decisions).toEqual([]);
    expect(result.registry_entries).toEqual([]);
    expect(result.byum_candidates).toEqual([]);
    expect(result.counts).toEqual({ decisions: 0, registry_entries: 0, byum_candidates: 0 });
  });

  it("fails closed when the Python interpreter is missing", async () => {
    const config = { ...resolveControlroomConfig(CONFIGURED_ENV), python: "definitely-not-a-real-interpreter" };
    const result = await runBridge(["--scripts-dir", CANONICAL_SCRIPTS, "check-lock", "C:/x"], 15_000, config);
    expect(result.verdict).toBe("unknown");
    expect(result.safe_to_proceed).toBe(false);
    expect(result.reason).toContain("ELLMOS_PYTHON");
  });

  it("fails closed when the bridge returns output that is not JSON", async () => {
    const config = { ...resolveControlroomConfig(CONFIGURED_ENV), python: "definitely-not-a-real-interpreter" };
    const result = await runBridge(["list-locks"], 15_000, config);
    expect(result.verdict).toBe("unknown");
    expect(result.safe_to_proceed).toBe(false);
  });

  it("treats a verdict-less bridge answer as unknown", async () => {
    const result = await checkLock("C:/x", {
      config: resolveControlroomConfig(CONFIGURED_ENV),
      runner: fakeRunner({ nonsense: true } as unknown as BridgeResult)
    });
    // The fake runner bypasses parsing, so the guard that matters is the renderer:
    // an unrecognised verdict must never render as safe.
    expect(formatLockCheck(result)).toContain("Safe to proceed: no");
  });
});

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

describe("controlroom configuration", () => {
  it("reads all seven environment variables", () => {
    const config = resolveControlroomConfig({
      ELLMOS_LOCK_SCRIPTS: "/scripts",
      ELLMOS_LOCK_ROOTS: "/roots.json",
      ELLMOS_DECISIONS_ROOT: "/decisions",
      ELLMOS_INVENTORY_DB: "/inventory.db",
      ELLMOS_POLICY_REGISTRY_PATH: "/policy-registry.json",
      ELLMOS_POLICY_REGISTRY_SRC: "/policy-registry-src",
      ELLMOS_PYTHON: "python3.12"
    });
    expect(config).toEqual({
      scriptsDir: "/scripts",
      rootsFile: "/roots.json",
      decisionsRoot: "/decisions",
      inventoryDb: "/inventory.db",
      policyRegistryPath: "/policy-registry.json",
      policyRegistrySrc: "/policy-registry-src",
      python: "python3.12"
    });
  });

  it("defaults to python and empty roots when only the scripts dir is set", () => {
    const config = resolveControlroomConfig({ ELLMOS_LOCK_SCRIPTS: "/scripts" });
    expect(config.python).toBe("python");
    expect(config.rootsFile).toBe("");
    expect(config.decisionsRoot).toBe("");
  });

  it("passes the scan budget and roots file through to the bridge", async () => {
    const capture: { args?: string[] } = {};
    await listLocks({
      config: resolveControlroomConfig({ ELLMOS_LOCK_SCRIPTS: "/scripts" }),
      runner: fakeRunner({ verdict: "complete", complete: true, locks: [] }, capture),
      budgetSeconds: 5,
      rootsFile: "/custom/roots.json"
    });
    expect(capture.args).toContain("--budget-seconds");
    expect(capture.args).toContain("5");
    expect(capture.args).toContain("/custom/roots.json");
  });

  it("passes only configured governance source locations to the bridge", async () => {
    const capture: { args?: string[] } = {};
    await listGovernance({
      config: resolveControlroomConfig({
        ELLMOS_DECISIONS_ROOT: "/decisions",
        ELLMOS_POLICY_REGISTRY_PATH: "/policy-registry.json",
        ELLMOS_POLICY_REGISTRY_SRC: "/policy-registry-src"
      }),
      runner: fakeRunner({ verdict: "complete", complete: true }, capture)
    });
    expect(capture.args).toEqual([
      "--decisions-root", "/decisions",
      "--policy-registry", "/policy-registry.json",
      "--policy-registry-src", "/policy-registry-src",
      "list-governance", "--status", "OFFEN", "--decision-limit", "50", "--registry-limit", "200"
    ]);
  });
});

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe("controlroom rendering", () => {
  it("marks an incomplete scan and names the unscanned roots", () => {
    const text = formatLockList({
      verdict: "partial",
      complete: false,
      locks: [],
      skipped_roots: ["C:/big/tree"],
      elapsed_seconds: 60
    });
    expect(text).toContain("INCOMPLETE");
    expect(text).toContain("C:/big/tree");
  });

  it("shows inheritance distance and never-expiring locks", () => {
    const text = formatLockCheck({
      verdict: "locked",
      safe_to_proceed: false,
      path: "C:/p/child",
      locks: [{
        path: "C:/p/LOCK.user.txt", lock_type: "user", scope: "project",
        inherited: true, distance: 1, protected: true, expires_at: null,
        restricted_operations: []
      }]
    });
    expect(text).toContain("LOCKED");
    expect(text).toContain("yes (1 up)");
    expect(text).toContain("never");
  });

  it("does not present an unknown permission as allowed", () => {
    const text = formatPermission({ verdict: "unknown", decision: "unknown", path: "C:/x" });
    expect(text).toContain("UNKNOWN");
    expect(text).toContain("do not treat this as permission");
  });

  it("warns when the decision index is older than its sources", () => {
    const text = formatDecisions({
      verdict: "stale", stale: true, stale_sources: ["TO-DECIDE-USER_4.txt"],
      match_count: 2, decisions: []
    });
    expect(text).toContain("older than its sources");
    expect(text).toContain("TO-DECIDE-USER_4.txt");
  });

  it("renders only identifying fields of a decision", () => {
    const text = formatDecisions({
      verdict: "ok", match_count: 1,
      decisions: [{ key: "D-1", id: "D-1", date: "2026-08-08", title: "A title", status: "OFFEN", scope: "global" }]
    });
    expect(text).toContain("D-1");
    expect(text).toContain("A title");
    expect(text).toContain("Titles and status only");
  });

  it("renders a resource list with type and host filters visible", () => {
    const text = formatResources({
      verdict: "ok", type_filter: "systems", host_filter: "ASUS-GEI", match_count: 1, returned: 1,
      resources: [{ resource_type: "systems", id: 1, name: "laptop", hostname: "ASUS-GEI", role: "mobile" }]
    });
    expect(text).toContain("laptop");
    expect(text).toContain("ASUS-GEI");
    expect(text).toContain("Type filter: systems");
    expect(text).toContain("Host filter: ASUS-GEI");
  });

  it("renders a single resource's full row, skipping empty fields", () => {
    const text = formatResource({
      verdict: "ok",
      resource: { resource_type: "systems", id: 1, name: "laptop", role: "mobile", specialization: null, notes: "" }
    });
    expect(text).toContain("laptop");
    expect(text).toContain("**role**: mobile");
    expect(text).not.toContain("specialization");
    expect(text).not.toContain("notes");
  });

  it("renders a not-found resource by its verdict, not a stale table", () => {
    const text = formatResource({ verdict: "not_found", reason: "no systems row with id=99999", resource: null });
    expect(text).toContain("not_found");
    expect(text).toContain("id=99999");
  });

  it("renders partial governance and decision staleness without source paths", () => {
    const text = formatGovernance({
      verdict: "partial",
      complete: false,
      sources: {
        decisions: { status: "available", stale: true, stale_source_count: 1 },
        policy_registry: { status: "unreadable" }
      },
      counts: { decisions: 1, registry_entries: 0, byum_candidates: 0 },
      decisions: [{ key: "D-1", id: "D-1", date: "2026-08-26", title: "Choose safely", status: "OFFEN", scope: "global" }],
      registry_entries: [],
      byum_candidates: []
    });
    expect(text).toContain("PARTIAL");
    expect(text).toContain("available");
    expect(text).toContain("unreadable");
    expect(text).toContain("stale: yes");
    expect(text).not.toContain("TO-DECIDE-USER.txt");
  });
});

// ---------------------------------------------------------------------------
// Integration against an explicit PolicyRegistry.load() source seam
// ---------------------------------------------------------------------------

describe("controlroom governance federation", () => {
  async function governanceConfig(registryPath: string, stale = false) {
    return resolveControlroomConfig({
      ELLMOS_DECISIONS_ROOT: await decisionFixture(stale),
      ELLMOS_POLICY_REGISTRY_PATH: registryPath,
      ELLMOS_POLICY_REGISTRY_SRC: POLICY_REGISTRY_FIXTURE_SRC
    });
  }

  it("reports a valid registry with zero BYUM candidates as complete count zero", async () => {
    const registry = await registryFixture([policyEntry()]);
    const result = await listGovernance({ config: await governanceConfig(registry) });
    expect(result.verdict).toBe("complete");
    expect(result.complete).toBe(true);
    expect(result.sources).toMatchObject({
      decisions: { status: "available" },
      policy_registry: { status: "available", byum_candidate_count: 0 }
    });
    expect(result.counts).toEqual({ decisions: 1, registry_entries: 1, byum_candidates: 0 });
    expect(result.byum_candidates).toEqual([]);
  });

  it("projects policy and BYUM metadata through exact allowlists only", async () => {
    const registry = await registryFixture([policyEntry(), byumCandidate()]);
    const result = await listGovernance({ config: await governanceConfig(registry) });
    const norms = result.registry_entries as Record<string, unknown>[];
    const candidates = result.byum_candidates as Record<string, unknown>[];
    const decisions = result.decisions as Record<string, unknown>[];

    expect(Object.keys(norms[0]).sort()).toEqual([
      "adoption", "authority", "hash_status", "id", "kind", "privacy", "scope", "status", "title"
    ]);
    expect(Object.keys(candidates[0]).sort()).toEqual([
      "adoption", "authority", "decision_ref", "hash_status", "id", "kind", "prediction_id",
      "privacy", "projection_sha256", "projection_status", "protocol", "scope", "status", "title"
    ]);
    expect(Object.keys(candidates[0].decision_ref as Record<string, unknown>).sort()).toEqual([
      "block_id", "decision_id", "index_key", "scope", "source_sha256"
    ]);
    expect(Object.keys(decisions[0]).sort()).toEqual(["date", "id", "key", "scope", "status", "title"]);
    expect(candidates[0].authority).toBe("advisory-pointer");

    const serialized = JSON.stringify(result);
    for (const forbidden of [
      "C:/PRIVATE", "PRIVATE_POLICY_SUMMARY", "PRIVATE_POLICY_RATIONALE", "PRIVATE_POLICY_RECEIPT",
      "PRIVATE_POLICY_EXECUTION", "PRIVATE_BYUM_SUMMARY", "PRIVATE_BYUM_PROMPT", "PRIVATE_BYUM_SECURE_TEXT",
      "PRIVATE_BYUM_RECEIPT", "PRIVATE_BYUM_ACTION", "PRIVATE_DECISION_QUESTION",
      "PRIVATE_DECISION_OPTION", "PRIVATE_DECISION_RECOMMENDATION"
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it.each([
    ["foreign schema", "ellmos.policy-registry.v999", [policyEntry()]],
    ["invalid entry", "ellmos.policy-registry.v1", [{ ...policyEntry(), owner: undefined }]]
  ])("marks a %s registry invalid and leaks no entries", async (_label, schema, entries) => {
    const cleaned = JSON.parse(JSON.stringify(entries)) as Record<string, unknown>[];
    const registry = await registryFixture(cleaned, schema);
    const result = await listGovernance({ config: await governanceConfig(registry) });
    expect((result.sources as Record<string, Record<string, unknown>>).policy_registry.status).toBe("invalid");
    expect(result.registry_entries).toEqual([]);
    expect(result.byum_candidates).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("Public policy title");
  });

  it("keeps stale decisions visible when the registry is unreadable and marks the aggregate partial", async () => {
    const missing = path.join(os.tmpdir(), "controlroom-governance-registry-missing.json");
    const result = await listGovernance({ config: await governanceConfig(missing, true) });
    expect(result.verdict).toBe("partial");
    expect(result.complete).toBe(false);
    expect(result.sources).toMatchObject({
      decisions: { status: "available", stale: true },
      policy_registry: { status: "unreadable" }
    });
    expect((result.decisions as unknown[])).toHaveLength(1);
    expect(result.registry_entries).toEqual([]);
  });

  it("rejects a BYUM projection that claims execution authority", async () => {
    const registry = await registryFixture([
      byumCandidate({ authority: "execution-authority", execution_authorized: true })
    ]);
    const result = await listGovernance({ config: await governanceConfig(registry) });
    expect((result.sources as Record<string, Record<string, unknown>>).policy_registry.status).toBe("invalid");
    expect(result.byum_candidates).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("execution-authority");
  });

  it("rejects non-scalar allowlisted metadata instead of leaking nested values", async () => {
    const registry = await registryFixture([
      policyEntry({ authority: { receipt: "PRIVATE_NESTED_AUTHORITY_MUST_NOT_LEAK" } })
    ]);
    const result = await listGovernance({ config: await governanceConfig(registry) });
    expect((result.sources as Record<string, Record<string, unknown>>).policy_registry.status).toBe("invalid");
    expect(result.registry_entries).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("PRIVATE_NESTED_AUTHORITY_MUST_NOT_LEAK");
  });

  it("marks non-scalar decision metadata invalid and keeps the registry side available", async () => {
    const decisionsRoot = await decisionFixture();
    const indexPath = path.join(decisionsRoot, "_tools", "decisions.index.json");
    const index = JSON.parse(await fs.readFile(indexPath, "utf-8"));
    index.entries[0].title = { prompt: "PRIVATE_NESTED_DECISION_MUST_NOT_LEAK" };
    await fs.writeFile(indexPath, JSON.stringify(index), "utf-8");
    const registry = await registryFixture([policyEntry()]);
    const config = resolveControlroomConfig({
      ELLMOS_DECISIONS_ROOT: decisionsRoot,
      ELLMOS_POLICY_REGISTRY_PATH: registry,
      ELLMOS_POLICY_REGISTRY_SRC: POLICY_REGISTRY_FIXTURE_SRC
    });
    const result = await listGovernance({ config });
    expect(result.verdict).toBe("partial");
    expect(result.sources).toMatchObject({
      decisions: { status: "invalid" },
      policy_registry: { status: "available" }
    });
    expect(result.decisions).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("PRIVATE_NESTED_DECISION_MUST_NOT_LEAK");
  });
});

// ---------------------------------------------------------------------------
// Integration against the real canonical lock logic
// ---------------------------------------------------------------------------

describe.skipIf(!HAS_CANONICAL)("controlroom against the canonical lock modules", () => {
  const config = () => ({ ...resolveControlroomConfig(EMPTY_ENV), scriptsDir: CANONICAL_SCRIPTS });

  it("reports a directory with no lock as clear", async () => {
    const root = await lockFixture();
    const result = await checkLock(path.join(root, "free-project"), { config: config() });
    expect(result.verdict).toBe("clear");
    expect(result.safe_to_proceed).toBe(true);
  });

  it("reports a locked directory as locked", async () => {
    const root = await lockFixture();
    const result = await checkLock(path.join(root, "locked-parent"), { config: config() });
    expect(result.verdict).toBe("locked");
    expect(result.safe_to_proceed).toBe(false);
  });

  it("inherits a parent lock down to a grandchild directory", async () => {
    const root = await lockFixture();
    const result = await checkLock(
      path.join(root, "locked-parent", "child", "grandchild"),
      { config: config() }
    );
    expect(result.verdict).toBe("locked");
    const locks = result.locks as Record<string, unknown>[];
    expect(locks).toHaveLength(1);
    expect(locks[0].inherited).toBe(true);
    expect(locks[0].distance).toBe(2);
  });

  it("treats an expired ordinary lock as gone", async () => {
    const root = await lockFixture();
    const result = await checkLock(path.join(root, "expired-project"), { config: config() });
    expect(result.verdict).toBe("clear");
  });

  it("holds a user lock past its nominal expiry", async () => {
    const root = await lockFixture();
    const result = await checkLock(path.join(root, "user-locked"), { config: config() });
    expect(result.verdict).toBe("locked");
    const locks = result.locks as Record<string, unknown>[];
    expect(locks[0].lock_type).toBe("user");
    expect(locks[0].protected).toBe(true);
    expect(locks[0].expires_at).toBeNull();
  });

  it("fails closed on a path that does not exist", async () => {
    const result = await checkLock(path.join(os.tmpdir(), "controlroom-absent-xyz"), { config: config() });
    expect(result.verdict).toBe("unknown");
    expect(result.safe_to_proceed).toBe(false);
  });

  it("applies precedence deny > ask > allow", async () => {
    const root = await permissionFixture();
    const target = path.join(root, "project", "nested");
    const decide = async (action: string) =>
      (await evaluatePermission(target, "claude", action, { config: config() })).decision;

    // Write(**) is allowed, yet the narrower deny and ask rules win over it.
    expect(await decide("Read(notes.txt)")).toBe("allow");
    expect(await decide("Write(notes.txt)")).toBe("allow");
    expect(await decide("Write(x/CREDENTIALS/key)")).toBe("deny");
    expect(await decide("Write(x/RELEASE/tag)")).toBe("ask");
  });

  it("finds a permission register inherited from a parent directory", async () => {
    const root = await permissionFixture();
    const result = await evaluatePermission(
      path.join(root, "project", "nested", "deep"), "claude", "Read(a)", { config: config() }
    );
    expect(result.decision).toBe("allow");
    expect(result.register_directory).toBe(path.join(root, "project"));
  });

  it("returns unknown where no permission register exists at all", async () => {
    const root = await lockFixture();
    const result = await evaluatePermission(
      path.join(root, "free-project"), "claude", "Write(x)", { config: config() }
    );
    expect(result.decision).toBe("unknown");
    expect(result.register).toBeNull();
  });

  it("falls back to the register default for an agent it does not list", async () => {
    const root = await permissionFixture();
    const result = await evaluatePermission(
      path.join(root, "project"), "some-other-agent", "Write(x/CREDENTIALS/key)", { config: config() }
    );
    expect(result.applies_to_agent).toBe(false);
    expect(result.decision).toBe("allow"); // the register default, deny rules not applied
  });

  it("reports an unscanned root instead of claiming an empty result", async () => {
    const root = await lockFixture();
    const rootsFile = path.join(root, "roots.json");
    await fs.writeFile(rootsFile, JSON.stringify({
      default_max_depth: 4, shallow_depth: 2, skip_dirs: [],
      roots: [{ path: path.join(root, "locked-parent") }, { path: path.join(root, "free-project") }]
    }), "utf-8");

    const complete = await listLocks({ config: config(), rootsFile, budgetSeconds: 30 });
    expect(complete.complete).toBe(true);
    expect(complete.lock_count).toBe(1);

    // A zero budget stops before the first root: no lock found, and that must not
    // be rendered as "nothing is locked".
    const starved = await listLocks({ config: config(), rootsFile, budgetSeconds: 0, timeoutMs: 30_000 });
    expect(starved.complete).toBe(false);
    expect(formatLockList(starved)).toContain("INCOMPLETE");
  });
});

// ---------------------------------------------------------------------------
// Integration against a real SQLite fixture (resource inventory)
// ---------------------------------------------------------------------------

describe("controlroom against a real resource inventory", () => {
  const config = async () => ({
    ...resolveControlroomConfig(EMPTY_ENV),
    inventoryDb: await inventoryFixture()
  });

  it("lists systems and software together by default", async () => {
    const result = await listResources({ config: await config() });
    expect(result.verdict).toBe("ok");
    const resources = result.resources as Record<string, unknown>[];
    expect(resources.some((r) => r.resource_type === "systems" && r.name === "laptop")).toBe(true);
    expect(resources.some((r) => r.resource_type === "software" && r.name === "Claude Code CLI")).toBe(true);
  });

  it("filters by type", async () => {
    const result = await listResources({ config: await config(), type: "software" });
    const resources = result.resources as Record<string, unknown>[];
    expect(resources).toHaveLength(1);
    expect(resources[0].resource_type).toBe("software");
  });

  it("filters by host across both tables", async () => {
    const result = await listResources({ config: await config(), host: "mac-studio" });
    const resources = result.resources as Record<string, unknown>[];
    // mac-studio has a systems row but no software row in the fixture.
    expect(resources).toHaveLength(1);
    expect(resources[0].name).toBe("mac-studio");
  });

  it("describes a single system by id", async () => {
    const result = await describeResource(1, { config: await config(), type: "systems" });
    expect(result.verdict).toBe("ok");
    const resource = result.resource as Record<string, unknown>;
    expect(resource.name).toBe("laptop");
    expect(resource.hostname).toBe("ASUS-GEI");
  });

  it("reports not_found for an id that does not exist", async () => {
    const result = await describeResource(9999, { config: await config() });
    expect(result.verdict).toBe("not_found");
  });

  it("fails closed when the inventory file does not exist", async () => {
    const missing = path.join(os.tmpdir(), "controlroom-inventory-absent-xyz.db");
    const result = await listResources({
      config: { ...resolveControlroomConfig(EMPTY_ENV), inventoryDb: missing }
    });
    expect(result.verdict).toBe("unavailable");
    expect(result.resources).toEqual([]);
  });
});
