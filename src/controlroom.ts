import { spawn } from "child_process";
import * as path from "path";
import { fileURLToPath } from "url";

/**
 * Read-only view onto the host's lock, permission, decision, resource and
 * governance registers.
 *
 * These queries answer "what applies on THIS machine right now", which is host-bound
 * by nature. The rules themselves are not reimplemented here: the bridge
 * script delegates every semantic decision to the host's canonical Python modules
 * (lock_utils.py, permissions.py, lock_scan.py). A second implementation of the lock
 * rules in TypeScript would drift from the spec on the next change, and a lock
 * checker that is quietly wrong is worse than none.
 *
 * Two contracts hold throughout:
 *
 *  1. Nothing here writes. No lock is created, renewed or released, no decision is
 *     answered. LOCK.user.* files in particular are removed by the user alone.
 *  2. Uncertainty reads as locked. Missing configuration, a missing interpreter, an
 *     unreadable path or a timeout all yield "unknown" with safeToProceed false —
 *     never a reassuring "clear".
 *
 * Without configuration the tools are inert by design: this package is published, and
 * on a foreign machine these registers do not exist.
 */

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const BRIDGE_SCRIPT = path.join(PROJECT_ROOT, "scripts", "controlroom_bridge.py");

/** Environment variables that switch the host-bound registers on. */
export const CONTROLROOM_ENV = {
  /** Directory holding the canonical lock_utils.py / permissions.py / lock_scan.py. */
  scripts: "ELLMOS_LOCK_SCRIPTS",
  /** Optional lock_roots.json override; defaults to the one beside the scripts. */
  roots: "ELLMOS_LOCK_ROOTS",
  /** Directory holding the TO-DECIDE chain and its generated index. */
  decisions: "ELLMOS_DECISIONS_ROOT",
  /** Path to the ControlRoom resource inventory SQLite file (systems/software). */
  inventory: "ELLMOS_INVENTORY_DB",
  /** Explicit path to an ellmos.policy-registry.v1 registry. */
  policyRegistry: "ELLMOS_POLICY_REGISTRY_PATH",
  /** Optional src root containing the canonical policy_registry Python package. */
  policyRegistrySrc: "ELLMOS_POLICY_REGISTRY_SRC",
  /** Explicit path to the ellmos.plans-register/1 metadata index. */
  plansRegister: "ELLMOS_PLANS_REGISTER",
  /** Python interpreter; defaults to "python" with a "python3" fallback. */
  python: "ELLMOS_PYTHON"
} as const;

export interface ControlroomConfig {
  scriptsDir: string;
  rootsFile: string;
  decisionsRoot: string;
  inventoryDb: string;
  policyRegistryPath: string;
  policyRegistrySrc: string;
  plansRegister: string;
  python: string;
}

export function resolveControlroomConfig(
  env: NodeJS.ProcessEnv = process.env
): ControlroomConfig {
  return {
    scriptsDir: env[CONTROLROOM_ENV.scripts]?.trim() ?? "",
    rootsFile: env[CONTROLROOM_ENV.roots]?.trim() ?? "",
    decisionsRoot: env[CONTROLROOM_ENV.decisions]?.trim() ?? "",
    inventoryDb: env[CONTROLROOM_ENV.inventory]?.trim() ?? "",
    policyRegistryPath: env[CONTROLROOM_ENV.policyRegistry]?.trim() ?? "",
    policyRegistrySrc: env[CONTROLROOM_ENV.policyRegistrySrc]?.trim() ?? "",
    plansRegister: env[CONTROLROOM_ENV.plansRegister]?.trim() ?? "",
    python: env[CONTROLROOM_ENV.python]?.trim() || "python"
  };
}

/** Every result carries a verdict; the unknown ones are the fail-closed ones. */
export interface BridgeResult {
  schema?: string;
  command?: string;
  verdict: string;
  safe_to_proceed?: boolean;
  reason?: string;
  error?: string;
  [key: string]: unknown;
}

export type BridgeRunner = (args: string[], timeoutMs: number) => Promise<BridgeResult>;

function failClosed(command: string, reason: string): BridgeResult {
  return {
    schema: "controlcenter.controlroom/1",
    command,
    verdict: "unknown",
    safe_to_proceed: false,
    reason
  };
}

/** Spawn the bridge once with a given interpreter. Rejects only on spawn failure. */
function spawnBridge(
  python: string,
  args: string[],
  timeoutMs: number
): Promise<{ code: number | null; stdout: string; stderr: string; spawnError?: NodeJS.ErrnoException }> {
  return new Promise((resolve) => {
    const child = spawn(python, [BRIDGE_SCRIPT, ...args], {
      // The canonical modules print German text; Windows consoles default to cp1252.
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      resolve({ code: null, stdout, stderr: `${stderr}\n<timeout after ${timeoutMs} ms>` });
    }, timeoutMs);

    child.stdout?.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr?.on("data", (chunk) => { stderr += String(chunk); });

    child.on("error", (error: NodeJS.ErrnoException) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code: null, stdout, stderr, spawnError: error });
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

/**
 * Run the bridge and parse its JSON. Any failure mode — missing interpreter, crash,
 * timeout, unparseable output — becomes a fail-closed result rather than an exception.
 */
export async function runBridge(
  args: string[],
  timeoutMs: number,
  config: ControlroomConfig = resolveControlroomConfig()
): Promise<BridgeResult> {
  // The subcommand is the first argument that is neither a flag nor a flag's value.
  const command = ((): string => {
    for (let i = 0; i < args.length; i += 1) {
      if (args[i].startsWith("--")) { i += 1; continue; }
      return args[i];
    }
    return "bridge";
  })();

  let result = await spawnBridge(config.python, args, timeoutMs);

  // "python" is frequently absent on POSIX hosts that only ship "python3".
  if (result.spawnError?.code === "ENOENT" && config.python === "python") {
    result = await spawnBridge("python3", args, timeoutMs);
  }

  if (result.spawnError) {
    return failClosed(
      command,
      `Python interpreter "${config.python}" could not be started (${result.spawnError.code ?? "spawn error"}). ` +
        `Set ${CONTROLROOM_ENV.python} to a working interpreter.`
    );
  }

  const trimmed = result.stdout.trim();
  if (!trimmed) {
    return failClosed(
      command,
      `The lock bridge produced no output${result.code === null ? " (timed out)" : ` (exit ${result.code})`}. ` +
        `${result.stderr.trim().slice(0, 400)}`
    );
  }

  try {
    const parsed = JSON.parse(trimmed) as BridgeResult;
    if (typeof parsed.verdict !== "string") {
      return failClosed(command, "The lock bridge returned a result without a verdict.");
    }
    return parsed;
  } catch {
    return failClosed(command, `The lock bridge returned output that is not JSON: ${trimmed.slice(0, 400)}`);
  }
}

interface QueryOptions {
  config?: ControlroomConfig;
  runner?: BridgeRunner;
  timeoutMs?: number;
}

function runnerFor(options: QueryOptions): BridgeRunner {
  const config = options.config ?? resolveControlroomConfig();
  return options.runner ?? ((args, timeoutMs) => runBridge(args, timeoutMs, config));
}

function requireScripts(config: ControlroomConfig, command: string): BridgeResult | null {
  if (config.scriptsDir) return null;
  return failClosed(
    command,
    `Not configured: set ${CONTROLROOM_ENV.scripts} to the directory holding lock_utils.py, ` +
      `permissions.py and lock_scan.py. Until then this host's locks cannot be read, ` +
      `so no path can be reported as free.`
  );
}

/** Is this path locked, counting locks inherited from any parent directory? */
export async function checkLock(
  targetPath: string,
  options: QueryOptions = {}
): Promise<BridgeResult> {
  const config = options.config ?? resolveControlroomConfig();
  const notConfigured = requireScripts(config, "check-lock");
  if (notConfigured) return notConfigured;

  return runnerFor({ ...options, config })(
    ["--scripts-dir", config.scriptsDir, "check-lock", targetPath],
    options.timeoutMs ?? 30_000
  );
}

/** All active locks across the configured roots, under a wall-clock budget. */
export async function listLocks(
  options: QueryOptions & { budgetSeconds?: number; rootsFile?: string } = {}
): Promise<BridgeResult> {
  const config = options.config ?? resolveControlroomConfig();
  const notConfigured = requireScripts(config, "list-locks");
  if (notConfigured) return notConfigured;

  const budget = options.budgetSeconds ?? 60;
  const rootsFile = options.rootsFile ?? config.rootsFile;
  const args = ["--scripts-dir", config.scriptsDir, "list-locks", "--budget-seconds", String(budget)];
  if (rootsFile) args.push("--roots-file", rootsFile);

  // The bridge stops scanning at its own budget; the process gets a little longer so
  // a partial-but-honest answer comes back instead of a timeout.
  return runnerFor({ ...options, config })(args, options.timeoutMs ?? (budget + 20) * 1000);
}

/** What may this agent do here, per the nearest LOCK.permissions register? */
export async function evaluatePermission(
  targetPath: string,
  agent: string,
  action: string,
  options: QueryOptions = {}
): Promise<BridgeResult> {
  const config = options.config ?? resolveControlroomConfig();
  const notConfigured = requireScripts(config, "evaluate-permission");
  if (notConfigured) return notConfigured;

  return runnerFor({ ...options, config })(
    ["--scripts-dir", config.scriptsDir, "evaluate-permission", targetPath, agent, action],
    options.timeoutMs ?? 30_000
  );
}

/** Open user decisions, from the generated index, with staleness reported. */
export async function listDecisions(
  options: QueryOptions & { status?: string; limit?: number } = {}
): Promise<BridgeResult> {
  const config = options.config ?? resolveControlroomConfig();
  if (!config.decisionsRoot) {
    return failClosed(
      "list-decisions",
      `Not configured: set ${CONTROLROOM_ENV.decisions} to the directory holding the ` +
        `TO-DECIDE chain. An unconfigured register is not an empty one — no statement ` +
        `about open decisions can be made.`
    );
  }

  return runnerFor({ ...options, config })(
    [
      "--decisions-root", config.decisionsRoot,
      "list-decisions",
      "--status", options.status ?? "OFFEN",
      "--limit", String(options.limit ?? 50)
    ],
    options.timeoutMs ?? 30_000
  );
}

function emptyGovernance(config: ControlroomConfig): BridgeResult {
  return {
    schema: "controlcenter.controlroom.governance/1",
    command: "list-governance",
    verdict: "unknown",
    complete: false,
    sources: {
      decisions: { status: config.decisionsRoot ? "unreadable" : "unconfigured" },
      policy_registry: { status: config.policyRegistryPath ? "unreadable" : "unconfigured" },
      plans_register: { status: config.plansRegister ? "unreadable" : "unconfigured" }
    },
    counts: { decisions: 0, registry_entries: 0, byum_candidates: 0, plans: 0 },
    decisions: [],
    registry_entries: [],
    byum_candidates: [],
    plans: []
  };
}

/**
 * Federated, allowlist-only view of decision-index metadata, a canonically
 * validated policy registry, and the existing strategic-plan index. The bridge
 * performs all source validation and never dereferences a registry pointer.
 */
export async function listGovernance(
  options: QueryOptions & {
    status?: string;
    decisionLimit?: number;
    registryLimit?: number;
    planLimit?: number;
  } = {}
): Promise<BridgeResult> {
  const config = options.config ?? resolveControlroomConfig();
  if (!config.decisionsRoot && !config.policyRegistryPath && !config.plansRegister) {
    return emptyGovernance(config);
  }

  const args: string[] = [];
  if (config.decisionsRoot) args.push("--decisions-root", config.decisionsRoot);
  if (config.policyRegistryPath) args.push("--policy-registry", config.policyRegistryPath);
  if (config.policyRegistrySrc) args.push("--policy-registry-src", config.policyRegistrySrc);
  if (config.plansRegister) args.push("--plans-register", config.plansRegister);
  args.push(
    "list-governance",
    "--status", options.status ?? "OFFEN",
    "--decision-limit", String(options.decisionLimit ?? 50),
    "--registry-limit", String(options.registryLimit ?? 200),
    "--plan-limit", String(options.planLimit ?? 100)
  );

  const result = await runnerFor({ ...options, config })(args, options.timeoutMs ?? 30_000);
  if (result.sources && result.counts) return result;

  // A bridge-level failure (for example a missing interpreter) still preserves the
  // per-source unknown/unconfigured distinction instead of returning an empty view.
  return { ...emptyGovernance(config), reason: result.reason ?? result.error };
}

export async function listResources(
  options: QueryOptions & { type?: string; host?: string; limit?: number } = {}
): Promise<BridgeResult> {
  const config = options.config ?? resolveControlroomConfig();
  if (!config.inventoryDb) {
    return failClosed(
      "list-resources",
      `Not configured: set ${CONTROLROOM_ENV.inventory} to the resource inventory ` +
        `SQLite file. An unconfigured register is not an empty one -- no statement ` +
        `about known systems/software can be made.`
    );
  }

  const args = [
    "--inventory-db", config.inventoryDb,
    "list-resources",
    "--type", options.type ?? "all",
    "--limit", String(options.limit ?? 100)
  ];
  if (options.host) {
    args.push("--host", options.host);
  }

  return runnerFor({ ...options, config })(args, options.timeoutMs ?? 30_000);
}

export async function describeResource(
  id: number,
  options: QueryOptions & { type?: string } = {}
): Promise<BridgeResult> {
  const config = options.config ?? resolveControlroomConfig();
  if (!config.inventoryDb) {
    return failClosed(
      "describe-resource",
      `Not configured: set ${CONTROLROOM_ENV.inventory} to the resource inventory ` +
        `SQLite file. An unconfigured register is not an empty one -- no statement ` +
        `about a specific resource can be made.`
    );
  }

  return runnerFor({ ...options, config })(
    [
      "--inventory-db", config.inventoryDb,
      "describe-resource", String(id),
      "--type", options.type ?? "systems"
    ],
    options.timeoutMs ?? 30_000
  );
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function verdictBanner(result: BridgeResult): string {
  switch (result.verdict) {
    case "clear":
      return "**CLEAR** — no active lock covers this path.";
    case "locked":
      return "**LOCKED** — do not modify this area.";
    case "unknown":
      return "**UNKNOWN — treat as locked.** The lock state could not be determined.";
    default:
      return `**${String(result.verdict).toUpperCase()}**`;
  }
}

function reasonLine(result: BridgeResult): string[] {
  const detail = result.reason ?? result.error;
  return detail ? ["", detail] : [];
}

export function formatLockCheck(result: BridgeResult): string {
  const locks = (result.locks as Record<string, unknown>[] | undefined) ?? [];
  const lines = [
    "# Lock check",
    "",
    `- Path: ${String(result.path ?? "?")}`,
    `- Verdict: ${verdictBanner(result)}`,
    `- Safe to proceed: ${result.safe_to_proceed === true ? "yes" : "no"}`,
    ...reasonLine(result)
  ];

  if (locks.length > 0) {
    lines.push("", `## Active locks (${locks.length})`, "");
    lines.push("| Lock | Type | Scope | Inherited | Protected | Expires |", "|---|---|---|---|---|---|");
    for (const lock of locks) {
      lines.push(
        `| ${String(lock.path)} | ${String(lock.lock_type)} | ${String(lock.scope)} ` +
          `| ${lock.inherited ? `yes (${String(lock.distance)} up)` : "no"} ` +
          `| ${lock.protected ? "yes" : "no"} | ${lock.expires_at ? String(lock.expires_at) : "never"} |`
      );
      const operations = (lock.restricted_operations as string[] | undefined) ?? [];
      if (operations.length > 0) {
        lines.push(`| ↳ restricted to operations: ${operations.join(", ")} | | | | | |`);
      }
    }
    lines.push(
      "",
      "A lock in a parent directory locks everything beneath it. Protected locks " +
        "(LOCK.user.*, LOCK.condition.*) never expire on time — the user, or the stated " +
        "condition, releases them."
    );
  }

  return lines.join("\n");
}

export function formatLockList(result: BridgeResult): string {
  const locks = (result.locks as Record<string, unknown>[] | undefined) ?? [];
  const skipped = (result.skipped_roots as string[] | undefined) ?? [];
  const lines = [
    "# Active locks",
    "",
    `- Scan: ${result.complete === true ? "complete" : "**INCOMPLETE**"}` +
      (result.elapsed_seconds !== undefined ? ` (${String(result.elapsed_seconds)} s)` : ""),
    `- Locks found: ${locks.length}`,
    ...reasonLine(result)
  ];

  if (skipped.length > 0) {
    lines.push(
      "",
      `**${skipped.length} root(s) were not scanned within the budget.** Nothing is known ` +
        "about them — treat them as potentially locked, or raise budgetSeconds:",
      "",
      ...skipped.map((root) => `- ${root}`)
    );
  }

  if (locks.length > 0) {
    lines.push("", "| Lock | Type | Scope | Owner | Remaining |", "|---|---|---|---|---|");
    for (const lock of locks) {
      lines.push(
        `| ${String(lock.path)} | ${String(lock.lock_type)} | ${String(lock.scope)} ` +
          `| ${String(lock.owner || "?")} | ${String(lock.remaining ?? "?")} |`
      );
    }
  }

  return lines.join("\n");
}

export function formatPermission(result: BridgeResult): string {
  const decision = String(result.decision ?? result.verdict);
  const explanation: Record<string, string> = {
    allow: "The register permits this action.",
    deny: "The register forbids this action.",
    ask: "The register requires asking the user first.",
    unknown: "**No decision could be derived — do not treat this as permission.**"
  };

  return [
    "# Permission check",
    "",
    `- Path: ${String(result.path ?? "?")}`,
    `- Agent: ${String(result.agent ?? "?")}`,
    `- Action: ${String(result.action ?? "?")}`,
    `- Decision: **${decision.toUpperCase()}** — ${explanation[decision] ?? ""}`,
    ...(result.register ? [`- Register: ${String(result.register)}`] : []),
    ...(result.register_default ? [`- Register default: ${String(result.register_default)}`] : []),
    ...(result.applies_to_agent === false
      ? ["- Note: the register does not list this agent, so only its default applied."]
      : []),
    ...reasonLine(result),
    "",
    "Precedence is deny > ask > allow > default. This is a report, not enforcement."
  ].join("\n");
}

export function formatDecisions(result: BridgeResult): string {
  const decisions = (result.decisions as Record<string, unknown>[] | undefined) ?? [];
  const lines = [
    "# Open user decisions",
    "",
    `- Status filter: ${String(result.status_filter ?? "OFFEN")}`,
    `- Matches: ${String(result.match_count ?? decisions.length)}`,
    ...(result.index_generated_at ? [`- Index generated: ${String(result.index_generated_at)}`] : []),
    ...reasonLine(result)
  ];

  if (result.stale === true) {
    const sources = (result.stale_sources as string[] | undefined) ?? [];
    lines.push(
      "",
      "**The index is older than its sources** " +
        (sources.length > 0 ? `(changed since: ${sources.join(", ")})` : "") +
        ". Entries may be missing; regenerate the index on the host before relying on this list."
    );
  }

  if (decisions.length > 0) {
    lines.push("", "| ID | Date | Title | Status | Scope |", "|---|---|---|---|---|");
    for (const entry of decisions) {
      lines.push(
        `| ${String(entry.key ?? entry.id)} | ${String(entry.date ?? "")} | ${String(entry.title ?? "")} ` +
          `| ${String(entry.status ?? "")} | ${String(entry.scope ?? "")} |`
      );
    }
    lines.push(
      "",
      "Titles and status only. Question texts, options and recommendations stay in the " +
        "register — read them there."
    );
  }

  return lines.join("\n");
}

export function formatGovernance(result: BridgeResult): string {
  const sources = (result.sources as Record<string, Record<string, unknown>> | undefined) ?? {};
  const decisions = (result.decisions as Record<string, unknown>[] | undefined) ?? [];
  const registryEntries = (result.registry_entries as Record<string, unknown>[] | undefined) ?? [];
  const candidates = (result.byum_candidates as Record<string, unknown>[] | undefined) ?? [];
  const plans = (result.plans as Record<string, unknown>[] | undefined) ?? [];
  const decisionSource = sources.decisions ?? { status: "unreadable" };
  const registrySource = sources.policy_registry ?? { status: "unreadable" };
  const planSource = sources.plans_register ?? { status: "unreadable" };
  const lines = [
    "# Federated governance metadata (read-only)",
    "",
    `- Aggregate: **${String(result.verdict ?? "unknown").toUpperCase()}**`,
    `- Complete: ${result.complete === true ? "yes" : "no"}`,
    "",
    "| Source | Status | Detail |",
    "|---|---|---|",
    `| decisions | ${String(decisionSource.status)} | stale: ${decisionSource.stale === true ? "yes" : "no"}; entries: ${decisions.length} |`,
    `| policy_registry | ${String(registrySource.status)} | norms: ${registryEntries.length}; BYUM candidates: ${candidates.length} |`,
    `| plans_register | ${String(planSource.status)} | plans: ${plans.length} |`
  ];

  if (decisions.length > 0) {
    lines.push("", "## Decision index", "", "| ID | Key | Date | Title | Status | Scope |", "|---|---|---|---|---|---|");
    for (const entry of decisions) {
      lines.push(
        `| ${String(entry.id ?? "")} | ${String(entry.key ?? "")} | ${String(entry.date ?? "")} ` +
          `| ${String(entry.title ?? "")} | ${String(entry.status ?? "")} | ${String(entry.scope ?? "")} |`
      );
    }
  }

  if (registryEntries.length > 0) {
    lines.push("", "## Adopted registry metadata", "", "| ID | Kind | Title | Scope | Status | Adoption | Authority | Privacy | Hash |", "|---|---|---|---|---|---|---|---|---|");
    for (const entry of registryEntries) {
      lines.push(
        `| ${String(entry.id ?? "")} | ${String(entry.kind ?? "")} | ${String(entry.title ?? "")} ` +
          `| ${String(entry.scope ?? "")} | ${String(entry.status ?? "")} | ${String(entry.adoption ?? "")} ` +
          `| ${String(entry.authority ?? "")} | ${String(entry.privacy ?? "")} | ${String(entry.hash_status ?? "")} |`
      );
    }
  }

  if (plans.length > 0) {
    lines.push(
      "", "## Strategic plan index", "",
      "| ID | Name | Status | Owner | Exists | Updated |",
      "|---|---|---|---|---|---|"
    );
    for (const plan of plans) {
      lines.push(
        `| ${String(plan.id ?? "")} | ${String(plan.name ?? "")} | ${String(plan.status ?? "")} ` +
          `| ${String(plan.owner ?? "")} | ${plan.exists === true ? "yes" : "no"} ` +
          `| ${String(plan.updated_at ?? "")} |`
      );
    }
    lines.push(
      "",
      "Plan paths, notes and host variants stay in the plan register. This view is not a plan authority."
    );
  }

  if (candidates.length > 0) {
    lines.push(
      "", "## BYUM advisory pointers", "",
      "| ID | Prediction | Decision / index | Scope | Block | Source hash | Projection | Authority |",
      "|---|---|---|---|---|---|---|---|"
    );
    for (const entry of candidates) {
      const ref = (entry.decision_ref as Record<string, unknown> | undefined) ?? {};
      lines.push(
        `| ${String(entry.id ?? "")} | ${String(entry.prediction_id ?? "")} ` +
          `| ${String(ref.decision_id ?? "")} / ${String(ref.index_key ?? "")} | ${String(ref.scope ?? entry.scope ?? "")} ` +
          `| ${String(ref.block_id ?? "")} | ${String(ref.source_sha256 ?? "")} ` +
          `| ${String(entry.projection_status ?? "")} / ${String(entry.projection_sha256 ?? "")} ` +
          `| ${String(entry.authority ?? "")} |`
      );
    }
    lines.push("", "Candidates are advisory pointers only. This view grants no adoption or execution authority.");
  }

  return lines.join("\n");
}

export function formatResources(result: BridgeResult): string {
  const resources = (result.resources as Record<string, unknown>[] | undefined) ?? [];
  const lines = [
    "# ControlRoom resource inventory (read-only mirror)",
    "",
    `- Type filter: ${String(result.type_filter ?? "all")}`,
    ...(result.host_filter ? [`- Host filter: ${String(result.host_filter)}`] : []),
    `- Matches: ${String(result.match_count ?? resources.length)}`,
    `- Returned: ${String(result.returned ?? resources.length)}`,
    ...reasonLine(result)
  ];

  if (resources.length > 0) {
    lines.push("", "| Type | ID | Name | Host | Detail |", "|---|---|---|---|---|");
    for (const entry of resources) {
      const type = String(entry.resource_type ?? "");
      const host = String(entry.hostname ?? entry.system_hostname ?? "");
      const detail =
        type === "software"
          ? String(entry.version ?? entry.purpose ?? "")
          : String(entry.role ?? entry.os ?? "");
      lines.push(`| ${type} | ${String(entry.id ?? "")} | ${String(entry.name ?? "")} | ${host} | ${detail} |`);
    }
    lines.push(
      "",
      "Summary columns only. Call controlcenter_describe_resource for the full row " +
        "(cpu/ram/gpu, install_path, notes, ...)."
    );
  }

  return lines.join("\n");
}

export function formatResource(result: BridgeResult): string {
  const resource = result.resource as Record<string, unknown> | null | undefined;
  if (!resource) {
    return [
      "# ControlRoom resource",
      "",
      `- Verdict: ${result.verdict}`,
      ...reasonLine(result)
    ].join("\n");
  }

  const lines = [
    `# ${String(resource.resource_type ?? "resource")}: ${String(resource.name ?? resource.id)}`,
    ""
  ];
  for (const [key, value] of Object.entries(resource)) {
    if (value === null || value === undefined || value === "") continue;
    lines.push(`- **${key}**: ${String(value)}`);
  }
  return lines.join("\n");
}
