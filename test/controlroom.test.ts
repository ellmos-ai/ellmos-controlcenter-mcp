import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { existsSync } from "fs";
import { describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "child_process";
import { createHash } from "crypto";
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
const CANDIDATE_LOCK_MASTER_ROOT = process.env.T530_CANDIDATE_LOCK_MASTER_ROOT;
const CANDIDATE_LOCK_MASTER_HEAD = "b2152873cbfbd140ac5613869c5417f80a0d668d";
const CANDIDATE_LOCK_UTILS_SHA256 = "b10e818f276656780ac66d0d42bf8bb0d6a2b03fdf874c93c13ad6b6705fce66";

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

async function plansFixture(
  plans: Record<string, unknown>[] = [{
    id: "plan:test",
    name: "Test plan",
    status: "aktiv",
    verantwortlich: "fixture",
    existiert: true,
    letzte_aktualisierung: "2026-08-29",
    ort: "C:/PRIVATE/PLAN.md",
    host_varianten: ["C:/PRIVATE/HOST-PLAN.md"],
    notiz: "PRIVATE_PLAN_NOTE_MUST_NOT_LEAK"
  }],
  schema = "ellmos.plans-register/1"
): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "controlroom-governance-plans-"));
  const register = path.join(root, "plans-register.json");
  await fs.writeFile(register, JSON.stringify({
    schema,
    generated_at: "2026-08-29",
    pflege: "PRIVATE_PLAN_REGISTER_NOTE_MUST_NOT_LEAK",
    plans
  }), "utf-8");
  return register;
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

async function canonicalScriptsFixture(
  root: string,
  twinResolution?: Record<string, unknown>
): Promise<string> {
  const scripts = path.join(root, "scripts");
  await fs.mkdir(scripts, { recursive: true });
  for (const name of ["lock_utils.py", "lock_scan.py", "permissions.py"]) {
    await fs.copyFile(path.join(CANONICAL_SCRIPTS, name), path.join(scripts, name));
  }
  await fs.writeFile(
    path.join(scripts, "lock_roots.json"),
    JSON.stringify({ roots: [], twin_resolution: twinResolution }),
    "utf-8"
  );
  return scripts;
}

async function twinStatusFixture(root: string): Promise<string> {
  const scripts = path.join(root, "scripts");
  await fs.mkdir(scripts);
  await fs.writeFile(path.join(scripts, "lock_utils.py"), [
    "import json",
    "from pathlib import Path",
    "def worktree_main_dir(_path):",
    "    file = Path(__file__).with_name('main-clone.json')",
    "    return Path(json.loads(file.read_text(encoding='utf-8'))) if file.is_file() else None",
    "def active_locks_for_path(_path, _now): return []",
    "def twin_dirs_for_path(_path, _config):",
    "    return [], json.loads(Path(__file__).with_name('twin-status.json').read_text(encoding='utf-8'))",
    ""
  ].join("\n"), "utf-8");
  await fs.writeFile(path.join(scripts, "permissions.py"), "", "utf-8");
  await fs.writeFile(path.join(scripts, "lock_scan.py"), [
    "def load_config(_path): return {}",
    "def _query_redirect_or_error(_target, _config): return None",
    ""
  ].join("\n"), "utf-8");
  await fs.writeFile(path.join(scripts, "lock_roots.json"),
    JSON.stringify({ twin_resolution: { clone_roots: [root], index_path: "unused" } }), "utf-8");
  return scripts;
}

async function candidateCoreFixture(root: string, candidateRoot: string,
  twinResolution: Record<string, unknown>): Promise<string> {
  const candidateHead = execFileSync("git", ["-C", candidateRoot, "rev-parse", "HEAD"],
    { encoding: "utf-8" }).trim();
  expect(candidateHead).toBe(CANDIDATE_LOCK_MASTER_HEAD);
  const scripts = path.join(root, "scripts");
  await fs.mkdir(scripts);
  const sources = {
    "lock_utils.py": path.join(candidateRoot, "pure-locking", "lock_utils.py"),
    "lock_scan.py": path.join(candidateRoot, "pure-locking", "lock_scan.py"),
    "permissions.py": path.join(candidateRoot, "permission-control", "permissions.py")
  };
  const utils = await fs.readFile(sources["lock_utils.py"]);
  expect(createHash("sha256").update(utils).digest("hex")).toBe(CANDIDATE_LOCK_UTILS_SHA256);
  for (const [name, source] of Object.entries(sources)) {
    await fs.copyFile(source, path.join(scripts, name));
  }
  await fs.writeFile(path.join(scripts, "lock_roots.json"), JSON.stringify({
    roots: [{ path: path.join(root, "mirror-ü") }],
    twin_resolution: twinResolution
  }), "utf-8");
  return scripts;
}

function scopedLockText(protectedPaths: string, pathsVersion = "1"): string {
  return [
    "owner: fixture-agent",
    "created: " + new Date().toISOString(),
    "expires_after: 24h",
    "purpose: scoped lock comparison fixture",
    "paths_version: " + pathsVersion,
    "protected_paths: " + protectedPaths,
    ""
  ].join("\n");
}

function canonicalLockScan(target: string, scriptsDir: string): Record<string, unknown> {
  const config = resolveControlroomConfig(EMPTY_ENV);
  const result = spawnSync(
    config.python,
    [
      path.join(scriptsDir, "lock_scan.py"),
      "--check-dir",
      target,
      "--json",
      "--roots-file",
      path.join(scriptsDir, "lock_roots.json")
    ],
    {
      encoding: "utf-8",
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      windowsHide: true
    }
  );
  if (result.error) throw result.error;
  if (result.status !== 0 && result.status !== 1) {
    throw new Error("canonical lock_scan failed: " + result.stderr + result.stdout);
  }
  return JSON.parse(result.stdout) as Record<string, unknown>;
}

async function expectLockParity(
  target: string,
  scriptsDir: string,
  expected?: string
): Promise<Record<string, unknown>> {
  const canonical = canonicalLockScan(target, scriptsDir);
  const rows = Array.isArray(canonical.locks)
    ? canonical.locks as Record<string, unknown>[]
    : [];
  const twinStatus = String(canonical.twin_status ?? "");
  const canonicalVerdict = !["ok", "not-applicable"].includes(twinStatus)
    ? "unknown"
    : rows.length > 0 ? "locked" : "clear";
  const bridge = await checkLock(target, {
    config: { ...resolveControlroomConfig(EMPTY_ENV), scriptsDir }
  });
  expect(bridge.verdict).toBe(canonicalVerdict);
  if (expected) expect(bridge.verdict).toBe(expected);
  return bridge;
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
      policy_registry: { status: "unconfigured" },
      plans_register: { status: "unconfigured" }
    });
    expect(result.decisions).toEqual([]);
    expect(result.registry_entries).toEqual([]);
    expect(result.byum_candidates).toEqual([]);
    expect(result.plans).toEqual([]);
    expect(result.counts).toEqual({ decisions: 0, registry_entries: 0, byum_candidates: 0, plans: 0 });
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
  it("reads all eight environment variables", () => {
    const config = resolveControlroomConfig({
      ELLMOS_LOCK_SCRIPTS: "/scripts",
      ELLMOS_LOCK_ROOTS: "/roots.json",
      ELLMOS_DECISIONS_ROOT: "/decisions",
      ELLMOS_INVENTORY_DB: "/inventory.db",
      ELLMOS_POLICY_REGISTRY_PATH: "/policy-registry.json",
      ELLMOS_POLICY_REGISTRY_SRC: "/policy-registry-src",
      ELLMOS_PLANS_REGISTER: "/plans-register.json",
      ELLMOS_PYTHON: "python3.12"
    });
    expect(config).toEqual({
      scriptsDir: "/scripts",
      rootsFile: "/roots.json",
      decisionsRoot: "/decisions",
      inventoryDb: "/inventory.db",
      policyRegistryPath: "/policy-registry.json",
      policyRegistrySrc: "/policy-registry-src",
      plansRegister: "/plans-register.json",
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
        ELLMOS_POLICY_REGISTRY_SRC: "/policy-registry-src",
        ELLMOS_PLANS_REGISTER: "/plans-register.json"
      }),
      runner: fakeRunner({ verdict: "complete", complete: true }, capture)
    });
    expect(capture.args).toEqual([
      "--decisions-root", "/decisions",
      "--policy-registry", "/policy-registry.json",
      "--policy-registry-src", "/policy-registry-src",
      "--plans-register", "/plans-register.json",
      "list-governance", "--status", "OFFEN", "--decision-limit", "50", "--registry-limit", "200",
      "--plan-limit", "100"
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
        policy_registry: { status: "unreadable" },
        plans_register: { status: "available" }
      },
      counts: { decisions: 1, registry_entries: 0, byum_candidates: 0, plans: 1 },
      decisions: [{ key: "D-1", id: "D-1", date: "2026-08-26", title: "Choose safely", status: "OFFEN", scope: "global" }],
      registry_entries: [],
      byum_candidates: [],
      plans: [{ id: "plan:test", name: "Test plan", status: "aktiv", owner: "fixture", exists: true, updated_at: "2026-08-29" }]
    });
    expect(text).toContain("PARTIAL");
    expect(text).toContain("available");
    expect(text).toContain("unreadable");
    expect(text).toContain("stale: yes");
    expect(text).toContain("Test plan");
    expect(text).not.toContain("TO-DECIDE-USER.txt");
  });
});

// ---------------------------------------------------------------------------
// Integration against an explicit PolicyRegistry.load() source seam
// ---------------------------------------------------------------------------

describe("controlroom governance federation", () => {
  async function governanceConfig(registryPath: string, stale = false, plansPath?: string) {
    return resolveControlroomConfig({
      ELLMOS_DECISIONS_ROOT: await decisionFixture(stale),
      ELLMOS_POLICY_REGISTRY_PATH: registryPath,
      ELLMOS_POLICY_REGISTRY_SRC: POLICY_REGISTRY_FIXTURE_SRC,
      ELLMOS_PLANS_REGISTER: plansPath ?? await plansFixture()
    });
  }

  it("reports a valid registry with zero BYUM candidates as complete count zero", async () => {
    const registry = await registryFixture([policyEntry()]);
    const result = await listGovernance({ config: await governanceConfig(registry) });
    expect(result.verdict).toBe("complete");
    expect(result.complete).toBe(true);
    expect(result.sources).toMatchObject({
      decisions: { status: "available" },
      policy_registry: { status: "available", byum_candidate_count: 0 },
      plans_register: { status: "available", plan_count: 1 }
    });
    expect(result.counts).toEqual({ decisions: 1, registry_entries: 1, byum_candidates: 0, plans: 1 });
    expect(result.byum_candidates).toEqual([]);
  });

  it("projects policy and BYUM metadata through exact allowlists only", async () => {
    const registry = await registryFixture([policyEntry(), byumCandidate()]);
    const result = await listGovernance({ config: await governanceConfig(registry) });
    const norms = result.registry_entries as Record<string, unknown>[];
    const candidates = result.byum_candidates as Record<string, unknown>[];
    const decisions = result.decisions as Record<string, unknown>[];
    const plans = result.plans as Record<string, unknown>[];

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
    expect(Object.keys(plans[0]).sort()).toEqual(["exists", "id", "name", "owner", "status", "updated_at"]);
    expect(candidates[0].authority).toBe("advisory-pointer");

    const serialized = JSON.stringify(result);
    for (const forbidden of [
      "C:/PRIVATE", "PRIVATE_POLICY_SUMMARY", "PRIVATE_POLICY_RATIONALE", "PRIVATE_POLICY_RECEIPT",
      "PRIVATE_POLICY_EXECUTION", "PRIVATE_BYUM_SUMMARY", "PRIVATE_BYUM_PROMPT", "PRIVATE_BYUM_SECURE_TEXT",
      "PRIVATE_BYUM_RECEIPT", "PRIVATE_BYUM_ACTION", "PRIVATE_DECISION_QUESTION",
      "PRIVATE_DECISION_OPTION", "PRIVATE_DECISION_RECOMMENDATION", "C:/PRIVATE/PLAN.md",
      "C:/PRIVATE/HOST-PLAN.md", "PRIVATE_PLAN_NOTE", "PRIVATE_PLAN_REGISTER_NOTE"
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

  it.each([
    ["foreign schema", "ellmos.plans-register/999", undefined],
    ["invalid metadata", "ellmos.plans-register/1", [{
      id: "plan:test",
      name: { secret: "PRIVATE_NESTED_PLAN_MUST_NOT_LEAK" },
      status: "aktiv",
      verantwortlich: "fixture",
      existiert: true,
      letzte_aktualisierung: "2026-08-29"
    }]]
  ])("marks a %s plan register invalid and leaks no plan metadata", async (_label, schema, entries) => {
    const registry = await registryFixture([policyEntry()]);
    const plans = await plansFixture(entries, schema);
    const result = await listGovernance({ config: await governanceConfig(registry, false, plans) });
    expect((result.sources as Record<string, Record<string, unknown>>).plans_register.status).toBe("invalid");
    expect(result.plans).toEqual([]);
    expect(result.verdict).toBe("partial");
    expect(JSON.stringify(result)).not.toContain("PRIVATE_NESTED_PLAN_MUST_NOT_LEAK");
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

it("treats only canonical safe twin statuses as clearance", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "controlroom-twin-status-"));
  const target = path.join(root, "target");
  await fs.mkdir(target);
  const scripts = await twinStatusFixture(root);
  for (const [status, expected] of [
    ["ok", "clear"], ["not-applicable", "clear"],
    ["index-missing", "unknown"], ["index-unresolved", "unknown"],
    ["index-unmapped", "unknown"], ["pointer-unreadable", "unknown"],
    ["pointer-unresolved", "unknown"], ["future-status", "unknown"],
    ["", "unknown"], [null, "unknown"], [17, "unknown"],
    [{ unexpected: true }, "unknown"]
  ] as Array<[unknown, string]>) {
    await fs.writeFile(path.join(scripts, "twin-status.json"), JSON.stringify(status), "utf-8");
    const result = await checkLock(target, {
      config: { ...resolveControlroomConfig(EMPTY_ENV), scriptsDir: scripts }
    });
    expect(result.verdict, JSON.stringify(status)).toBe(expected);
    expect(result.safe_to_proceed, JSON.stringify(status)).toBe(expected === "clear");
  }
  await fs.writeFile(path.join(scripts, "main-clone.json"),
    JSON.stringify(path.join(root, "repo-Ã¼")), "utf-8");
  await fs.writeFile(path.join(scripts, "twin-status.json"), '"ok"', "utf-8");
  const unresolvedMain = await checkLock(target, {
    config: { ...resolveControlroomConfig(EMPTY_ENV), scriptsDir: scripts }
  });
  expect(unresolvedMain.verdict).toBe("unknown");
  expect(unresolvedMain.safe_to_proceed).toBe(false);
  expect(unresolvedMain.errors).toContainEqual(expect.stringContaining("main clone does not exist"));
});

it.skipIf(!CANDIDATE_LOCK_MASTER_ROOT)(
  "matches the pinned candidate core for Unicode worktrees and unresolved twins",
  async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "controlroom-candidate-core-"));
    const clone = path.join(root, "repos", "repo-ü");
    const worktree = path.join(root, "worktrees", "review-ä");
    const mirror = path.join(root, "mirror-ü");
    for (const area of [clone, mirror]) {
      await fs.mkdir(path.join(area, "protected"), { recursive: true });
      await fs.mkdir(path.join(area, "sibling"), { recursive: true });
    }
    await fs.writeFile(path.join(clone, "protected", "tracked.txt"), "fixture", "utf-8");
    await fs.writeFile(path.join(clone, "sibling", "tracked.txt"), "fixture", "utf-8");
    execFileSync("git", ["init", "--quiet", clone]);
    execFileSync("git", ["-C", clone, "config", "user.name", "fixture"]);
    execFileSync("git", ["-C", clone, "config", "user.email", "fixture@example.invalid"]);
    execFileSync("git", ["-C", clone, "add", "--all"]);
    execFileSync("git", ["-C", clone, "commit", "--quiet", "-m", "fixture"]);
    await fs.mkdir(path.dirname(worktree), { recursive: true });
    execFileSync("git", ["-C", clone, "worktree", "add", "--detach", "--quiet", worktree]);
    const pointer = path.join(mirror, "REPO.pointer.json");
    const validPointer = { repo_id: "ellmos-ai/repo-ü", local_locator: {
      repo_name: "repo-ü", windows_default: clone
    } };
    await fs.writeFile(pointer, JSON.stringify(validPointer), "utf-8");
    await fs.writeFile(path.join(mirror, "LOCK.scope.txt"),
      scopedLockText("protected"), "utf-8");
    const scripts = await candidateCoreFixture(root, CANDIDATE_LOCK_MASTER_ROOT!, {
      clone_roots: [path.join(root, "repos")],
      index_path: path.join(root, "TWIN-INDEX.{host}.json")
    });
    const python = resolveControlroomConfig(EMPTY_ENV).python;
    execFileSync(python, ["-X", "utf8", path.join(scripts, "lock_scan.py"),
      "--write-cache", "--roots-file", path.join(scripts, "lock_roots.json")],
    { encoding: "utf-8", env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
    const indexFiles = (await fs.readdir(root)).filter((name) =>
      name.startsWith("TWIN-INDEX.") && name.endsWith(".json"));
    expect(indexFiles).toHaveLength(1);
    const indexPath = path.join(root, indexFiles[0]);

    await expectLockParity(path.join(worktree, "protected"), scripts, "locked");
    await expectLockParity(path.join(worktree, "sibling"), scripts, "clear");
    if (process.platform === "win32") {
      const pythonMode = spawnSync(python, ["-c", "import sys; print(sys.flags.utf8_mode)"], {
        encoding: "utf-8", env: { ...process.env, PYTHONUTF8: "0", PYTHONIOENCODING: "utf-8" }
      });
      expect(pythonMode.status).toBe(0);
      expect(pythonMode.stdout.trim()).toBe("0");
      const priorUtf8 = process.env.PYTHONUTF8;
      try {
        process.env.PYTHONUTF8 = "0";
        const nativeMode = await checkLock(path.join(worktree, "sibling"), {
          config: { ...resolveControlroomConfig(EMPTY_ENV), scriptsDir: scripts }
        });
        expect(nativeMode.verdict).toBe("clear");
        expect(nativeMode.safe_to_proceed).toBe(true);
      } finally {
        if (priorUtf8 === undefined) delete process.env.PYTHONUTF8;
        else process.env.PYTHONUTF8 = priorUtf8;
      }
    }
    await expectLockParity(path.join(clone, "protected"), scripts, "locked");
    await expectLockParity(path.join(mirror, "sibling"), scripts, "clear");

    // The first matching twin must not suppress another registered mirror.
    const secondMirror = path.join(root, "mirror2-ü");
    await fs.mkdir(path.join(secondMirror, "sibling"), { recursive: true });
    await fs.writeFile(path.join(secondMirror, "REPO.pointer.json"),
      JSON.stringify(validPointer), "utf-8");
    const secondLock = path.join(secondMirror, "LOCK.scope.txt");
    await fs.writeFile(secondLock, scopedLockText("sibling"), "utf-8");
    const rootsFile = path.join(scripts, "lock_roots.json");
    const rootsConfig = JSON.parse(await fs.readFile(rootsFile, "utf-8")) as Record<string, unknown>;
    rootsConfig.roots = [{ path: mirror }, { path: secondMirror }];
    await fs.writeFile(rootsFile, JSON.stringify(rootsConfig), "utf-8");
    execFileSync(python, ["-X", "utf8", path.join(scripts, "lock_scan.py"),
      "--write-cache", "--roots-file", rootsFile],
    { encoding: "utf-8", env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
    const multiple = await expectLockParity(path.join(worktree, "sibling"), scripts, "locked");
    expect((multiple.locks as Array<Record<string, unknown>>).some((lock) =>
      lock.path === secondLock && lock.from_twin === true)).toBe(true);
    await fs.unlink(secondLock);

    const originalIndex = await fs.readFile(indexPath, "utf-8");
    await fs.unlink(indexPath);
    await expectLockParity(path.join(worktree, "sibling"), scripts, "unknown");
    const foreignIndex = JSON.parse(originalIndex) as Record<string, unknown>;
    foreignIndex.producer_host = "FOREIGN-HOST";
    await fs.writeFile(indexPath, JSON.stringify(foreignIndex), "utf-8");
    await expectLockParity(path.join(clone, "sibling"), scripts, "unknown");
    await fs.writeFile(indexPath, originalIndex, "utf-8");

    for (const malformed of [
      { local_locator: ["invalid"] },
      { local_locator: { windows_default: 17 } }
    ]) {
      await fs.writeFile(pointer, JSON.stringify(malformed), "utf-8");
      await expectLockParity(path.join(clone, "sibling"), scripts, "unknown");
      await expectLockParity(path.join(mirror, "sibling"), scripts, "unknown");
    }
  }, 360_000
);

it.skipIf(!CANDIDATE_LOCK_MASTER_ROOT)(
  "holds lexical junction ancestors before any physical-path normalization",
  async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "controlroom-junction-"));
    const project = path.join(root, "locked-project");
    const outside = path.join(root, "outside");
    const leaf = path.join(outside, "leaf");
    await fs.mkdir(project);
    await fs.mkdir(leaf, { recursive: true });
    await fs.writeFile(path.join(leaf, "file.txt"), "fixture", "utf-8");
    await fs.writeFile(path.join(project, "LOCK.parent.txt"), scopedLockText("junction"), "utf-8");
    const junction = path.join(project, "junction");
    await fs.symlink(outside, junction, process.platform === "win32" ? "junction" : "dir");
    const scripts = await candidateCoreFixture(root, CANDIDATE_LOCK_MASTER_ROOT!, {
      clone_roots: [path.join(root, "repos")],
      index_path: path.join(root, "TWIN-INDEX.{host}.json")
    });
    const config = { ...resolveControlroomConfig(EMPTY_ENV), scriptsDir: scripts };
    const canonical = canonicalLockScan(path.join(junction, "leaf"), scripts);
    expect(canonical.error).toBe("target-redirect");
    for (const target of [path.join(junction, "leaf"), path.join(junction, "leaf", "file.txt")]) {
      const result = await checkLock(target, { config });
      expect(result.verdict).toBe("unknown");
      expect(result.safe_to_proceed).toBe(false);
      expect(result.reason).toContain("target-redirect");
    }
    const direct = await checkLock(project, { config });
    expect(direct.verdict).toBe("locked");
    await fs.writeFile(path.join(outside, "LOCK.physical.txt"), scopedLockText("leaf"), "utf-8");
    const physical = await checkLock(leaf, { config });
    expect(physical.verdict).toBe("locked");
  }, 120_000
);

it("maps real Unicode worktrees with Python UTF-8 mode disabled", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "controlroom-worktree-encoding-"));
  const mainClone = path.join(root, "main-clone");
  await fs.mkdir(path.join(mainClone, "protected"), { recursive: true });
  await fs.writeFile(path.join(mainClone, "protected", "tracked.txt"), "fixture", "utf-8");
  execFileSync("git", ["init", "--quiet", mainClone]);
  execFileSync("git", ["-C", mainClone, "-c", "user.name=fixture", "-c",
    "user.email=fixture@example.invalid", "add", "--all"]);
  execFileSync("git", ["-C", mainClone, "-c", "user.name=fixture", "-c",
    "user.email=fixture@example.invalid", "commit", "--quiet", "-m", "fixture"]);
  const python = resolveControlroomConfig(EMPTY_ENV).python;
  const script = [
    "import importlib.util, json, sys",
    "from pathlib import Path",
    "from types import SimpleNamespace",
    "spec = importlib.util.spec_from_file_location('bridge_encoding_fixture', sys.argv[1])",
    "bridge = importlib.util.module_from_spec(spec)",
    "spec.loader.exec_module(bridge)",
    "helper = SimpleNamespace(worktree_main_dir=lambda _: Path(sys.argv[2]), git_worktree_top_dir=lambda p: p.parent)",
    "print(json.dumps(str(bridge._main_clone_target(helper, Path(sys.argv[3])))))"
  ].join("\n");
  for (const name of ["linked-ascii", "linked-ü"]) {
    const worktree = path.join(root, name);
    execFileSync("git", ["-C", mainClone, "worktree", "add", "--detach", "--quiet", worktree]);
    for (const mode of ["0", "1"]) {
      const result = spawnSync(python, ["-X", `utf8=${mode}`, "-c", script,
        path.resolve("scripts/controlroom_bridge.py"), mainClone, path.join(worktree, "protected")], {
        encoding: "utf-8", windowsHide: true,
        env: { ...process.env, PYTHONIOENCODING: "utf-8" }
      });
      expect(result.error, `${name}, utf8=${mode}`).toBeUndefined();
      expect(result.status, result.stderr).toBe(0);
      expect(JSON.parse(result.stdout)).toBe(path.join(mainClone, "protected"));
    }
  }
});


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

  it("matches lock_scan for root, protected, and free sibling queries", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "controlroom-scope-parity-"));
    const project = path.join(root, "project");
    const protectedPath = path.join(project, "protected", "secure");
    const sibling = path.join(project, "sibling");
    await fs.mkdir(protectedPath, { recursive: true });
    await fs.mkdir(sibling, { recursive: true });
    const scripts = await canonicalScriptsFixture(root);
    await fs.writeFile(
      path.join(project, "LOCK.scope.txt"),
      scopedLockText("protected/secure"),
      "utf-8"
    );

    await expectLockParity(project, scripts, "locked");
    await expectLockParity(protectedPath, scripts, "locked");
    await expectLockParity(sibling, scripts, "clear");
  });

  it("fails closed for unknown and malformed protected-path metadata", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "controlroom-scope-invalid-"));
    const project = path.join(root, "project");
    const sibling = path.join(project, "sibling");
    await fs.mkdir(sibling, { recursive: true });
    const scripts = await canonicalScriptsFixture(root);
    const lock = path.join(project, "LOCK.scope.txt");

    await fs.writeFile(lock, scopedLockText("../escape", "1"), "utf-8");
    await expectLockParity(sibling, scripts, "locked");
    await fs.writeFile(lock, scopedLockText("protected", "2"), "utf-8");
    await expectLockParity(sibling, scripts, "locked");
  });

  it("inherits main-clone locks or holds when the old core lacks verified worktree roots", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "controlroom-worktree-parity-"));
    const mainClone = path.join(root, "main-clone");
    const worktree = path.join(root, "worktrees", "linked");
    await fs.mkdir(path.join(mainClone, "protected"), { recursive: true });
    await fs.mkdir(path.join(mainClone, "sibling"), { recursive: true });
    await fs.writeFile(path.join(mainClone, "protected", "tracked.txt"), "fixture", "utf-8");
    await fs.writeFile(path.join(mainClone, "sibling", "tracked.txt"), "fixture", "utf-8");
    execFileSync("git", ["init", "--quiet", mainClone]);
    execFileSync("git", ["-C", mainClone, "config", "user.name", "fixture"]);
    execFileSync("git", ["-C", mainClone, "config", "user.email", "fixture@example.invalid"]);
    execFileSync("git", ["-C", mainClone, "add", "--all"]);
    execFileSync("git", ["-C", mainClone, "commit", "--quiet", "-m", "fixture"]);
    await fs.mkdir(path.dirname(worktree), { recursive: true });
    execFileSync("git", ["-C", mainClone, "worktree", "add", "--detach", "--quiet", worktree]);
    await fs.writeFile(
      path.join(mainClone, "LOCK.scope.txt"),
      scopedLockText("protected"),
      "utf-8"
    );
    const scripts = await canonicalScriptsFixture(root);
    const python = resolveControlroomConfig(EMPTY_ENV).python;
    const capability = spawnSync(python, ["-c", [
      "import sys", "sys.path.insert(0, sys.argv[1])", "import lock_utils",
      "print(int(callable(getattr(lock_utils, 'git_worktree_top_dir', None))))"
    ].join("; "), scripts], { encoding: "utf-8", windowsHide: true });
    expect(capability.status).toBe(0);
    if (capability.stdout.trim() === "1") {
      await expectLockParity(path.join(worktree, "protected"), scripts, "locked");
      await expectLockParity(path.join(worktree, "sibling"), scripts, "clear");
    } else {
      for (const target of ["protected", "sibling"]) {
        const held = await checkLock(path.join(worktree, target), {
          config: { ...resolveControlroomConfig(EMPTY_ENV), scriptsDir: scripts }
        });
        expect(held.verdict).toBe("unknown");
        expect(held.safe_to_proceed).toBe(false);
        expect(held.errors).toContainEqual(expect.stringContaining("lacks git_worktree_top_dir"));
      }
    }
  });

  it("matches twin scoped locks and returns unknown when the twin index is missing", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "controlroom-twin-parity-"));
    const clone = path.join(root, "clone");
    const mirror = path.join(root, "mirror");
    const protectedPath = path.join(clone, "protected");
    const sibling = path.join(clone, "sibling");
    await fs.mkdir(protectedPath, { recursive: true });
    await fs.mkdir(sibling, { recursive: true });
    await fs.mkdir(path.join(mirror, "protected"), { recursive: true });
    await fs.mkdir(path.join(mirror, "sibling"), { recursive: true });
    await fs.writeFile(path.join(mirror, "REPO.pointer.json"), JSON.stringify({
      repo_id: "ellmos-ai/clone",
      local_locator: { repo_name: "clone", windows_default: clone }
    }), "utf-8");
    const index = path.join(root, "twin-index.json");
    await fs.writeFile(index, JSON.stringify({
      schema: "ellmos-lock-twin-index-v2",
      producer_host: os.hostname(),
      by_repo_name: {},
      by_clone_path: { [path.resolve(clone).toLowerCase()]: [mirror] },
      unreadable_pointers_by_dirname: {}
    }), "utf-8");
    const scripts = await canonicalScriptsFixture(root, {
      clone_roots: [clone],
      index_path: index
    });
    await fs.writeFile(
      path.join(mirror, "LOCK.scope.txt"),
      scopedLockText("protected"),
      "utf-8"
    );

    await expectLockParity(protectedPath, scripts, "locked");
    await expectLockParity(sibling, scripts, "clear");

    const missingRoot = await fs.mkdtemp(path.join(os.tmpdir(), "controlroom-twin-missing-"));
    const missingClone = path.join(missingRoot, "clone");
    const missingTarget = path.join(missingClone, "child");
    await fs.mkdir(missingTarget, { recursive: true });
    const missingScripts = await canonicalScriptsFixture(missingRoot, {
      clone_roots: [missingClone],
      index_path: path.join(missingRoot, "absent-index.json")
    });
    await expectLockParity(missingTarget, missingScripts, "unknown");
  }, 120_000);

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
