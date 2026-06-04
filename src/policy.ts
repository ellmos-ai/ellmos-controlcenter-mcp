import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";
import { t } from "./i18n/index.js";
import type { ResolvedProfile } from "./profiles.js";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const DEFAULT_POLICY_CONFIG_PATH =
  process.env.ELLMOS_POLICY_CONFIG ?? path.join(PROJECT_ROOT, "data", "policy-rules.json");

export type PolicySeverity = "info" | "warning" | "high";

export interface PolicyFinding {
  severity: PolicySeverity;
  serverName: string;
  ruleId: string;
  message: string;
  details: Record<string, unknown>;
}

export interface PolicyRuleDefinition {
  id: string;
  title: string;
  description: string;
  severity: PolicySeverity;
  enabled: boolean;
}

interface PolicyRuleOverride {
  id: string;
  severity?: PolicySeverity;
  enabled?: boolean;
}

export class PolicyConfigError extends Error {
  readonly name = "PolicyConfigError";

  constructor(
    message: string,
    readonly code: string,
    readonly details: Record<string, unknown> = {}
  ) {
    super(message);
  }
}

export const DEFAULT_POLICY_RULES: PolicyRuleDefinition[] = [
  {
    id: "invalid-server-config",
    title: "Invalid server config",
    description: "Server configuration is not a JSON object.",
    severity: "high",
    enabled: true
  },
  {
    id: "missing-command",
    title: "Missing command",
    description: "Server configuration has no executable command entry.",
    severity: "high",
    enabled: true
  },
  {
    id: "npx-runtime-fetch",
    title: "npx runtime fetch",
    description: "Server starts through npx instead of a pinned local path.",
    severity: "warning",
    enabled: true
  },
  {
    id: "env-secrets-present",
    title: "Environment variables present",
    description: "Server configuration contains environment variables; values stay hidden.",
    severity: "warning",
    enabled: true
  },
  {
    id: "sensitive-arg-name",
    title: "Sensitive argument name",
    description: "Server arguments contain names that look like tokens, keys, passwords, or secrets.",
    severity: "warning",
    enabled: true
  },
  {
    id: "no-policy-findings",
    title: "No policy findings",
    description: "Informational result emitted when no enabled policy rule matched.",
    severity: "info",
    enabled: true
  }
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasField(value: Record<string, unknown>, fieldName: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, fieldName);
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function isPolicySeverity(value: unknown): value is PolicySeverity {
  return value === "info" || value === "warning" || value === "high";
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function clonePolicyRules(rules: PolicyRuleDefinition[]): PolicyRuleDefinition[] {
  return rules.map((rule) => ({ ...rule }));
}

function extractRawPolicyRules(rawConfig: unknown, configPath: string): unknown[] {
  if (Array.isArray(rawConfig)) {
    return rawConfig;
  }
  if (isRecord(rawConfig) && Array.isArray(rawConfig.rules)) {
    return rawConfig.rules;
  }
  throw new PolicyConfigError(
    `Policy config ${configPath} must be an array or an object with a 'rules' array.`,
    "policy-schema-invalid",
    { configPath }
  );
}

function normalizePolicyRuleOverride(value: unknown, configPath: string, index: number): PolicyRuleOverride {
  if (!isRecord(value)) {
    throw new PolicyConfigError(
      `Policy rule at index ${index} in ${configPath} must be a JSON object.`,
      "policy-schema-invalid",
      { configPath, index }
    );
  }

  if (typeof value.id !== "string" || value.id.trim().length === 0) {
    throw new PolicyConfigError(
      `Policy rule at index ${index} in ${configPath} must define a non-empty 'id' string.`,
      "policy-schema-invalid",
      { configPath, index, fieldName: "id" }
    );
  }

  const override: PolicyRuleOverride = { id: value.id.trim() };

  if (hasField(value, "enabled")) {
    if (typeof value.enabled !== "boolean") {
      throw new PolicyConfigError(
        `Policy rule '${override.id}' in ${configPath} must use a boolean 'enabled' value.`,
        "policy-schema-invalid",
        { configPath, index, fieldName: "enabled", ruleId: override.id }
      );
    }
    override.enabled = value.enabled;
  }

  if (hasField(value, "severity")) {
    if (!isPolicySeverity(value.severity)) {
      throw new PolicyConfigError(
        `Policy rule '${override.id}' in ${configPath} must use severity info, warning, or high.`,
        "policy-schema-invalid",
        { configPath, index, fieldName: "severity", ruleId: override.id }
      );
    }
    override.severity = value.severity;
  }

  return override;
}

function normalizePolicyRuleOverrides(rawConfig: unknown, configPath: string): PolicyRuleOverride[] {
  const overrides = extractRawPolicyRules(rawConfig, configPath).map((rule, index) =>
    normalizePolicyRuleOverride(rule, configPath, index)
  );
  const seen = new Set<string>();
  for (const override of overrides) {
    if (seen.has(override.id)) {
      throw new PolicyConfigError(
        `Policy config ${configPath} contains duplicate policy rule id '${override.id}'.`,
        "policy-rule-duplicate",
        { configPath, ruleId: override.id }
      );
    }
    seen.add(override.id);
  }
  return overrides;
}

function applyPolicyRuleOverrides(
  overrides: PolicyRuleOverride[],
  configPath: string,
  baseRules: PolicyRuleDefinition[] = DEFAULT_POLICY_RULES
): PolicyRuleDefinition[] {
  const rules = new Map<string, PolicyRuleDefinition>(
    baseRules.map((rule) => [rule.id, { ...rule }])
  );

  for (const override of overrides) {
    const currentRule = rules.get(override.id);
    if (!currentRule) {
      throw new PolicyConfigError(
        `Policy config ${configPath} references unknown policy rule '${override.id}'.`,
        "policy-rule-unknown",
        { configPath, ruleId: override.id }
      );
    }
    rules.set(override.id, {
      ...currentRule,
      severity: override.severity ?? currentRule.severity,
      enabled: override.enabled ?? currentRule.enabled
    });
  }

  return [...rules.values()];
}

export async function loadPolicyRules(configPath: string = DEFAULT_POLICY_CONFIG_PATH): Promise<PolicyRuleDefinition[]> {
  let raw: string;
  try {
    raw = await fs.readFile(configPath, "utf-8");
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      return clonePolicyRules(DEFAULT_POLICY_RULES);
    }
    throw new PolicyConfigError(
      `Policy config ${configPath} could not be read: ${error instanceof Error ? error.message : String(error)}`,
      "policy-read-failed",
      { configPath }
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new PolicyConfigError(
      `Policy config ${configPath} contains invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      "policy-json-invalid",
      { configPath }
    );
  }

  return applyPolicyRuleOverrides(normalizePolicyRuleOverrides(parsed, configPath), configPath);
}

function activeRuleMap(rules: PolicyRuleDefinition[]): Map<string, PolicyRuleDefinition> {
  return new Map(
    rules
      .filter((rule) => rule.enabled)
      .map((rule) => [rule.id, rule])
  );
}

function createFinding(
  rules: Map<string, PolicyRuleDefinition>,
  ruleId: string,
  serverName: string,
  message: string,
  details: Record<string, unknown>
): PolicyFinding | null {
  const rule = rules.get(ruleId);
  if (!rule) {
    return null;
  }
  return {
    severity: rule.severity,
    serverName,
    ruleId,
    message,
    details
  };
}

export function auditResolvedProfile(
  profile: ResolvedProfile,
  rules: PolicyRuleDefinition[] = DEFAULT_POLICY_RULES
): PolicyFinding[] {
  const labels = t();
  const enabledRules = activeRuleMap(rules);
  const findings: PolicyFinding[] = [];

  function pushFinding(
    ruleId: string,
    serverName: string,
    message: string,
    details: Record<string, unknown> = {}
  ): void {
    const finding = createFinding(enabledRules, ruleId, serverName, message, details);
    if (finding) {
      findings.push(finding);
    }
  }

  for (const [serverName, rawConfig] of Object.entries(profile.config.mcpServers)) {
    if (!isRecord(rawConfig)) {
      pushFinding(
        "invalid-server-config",
        serverName,
        labels.policy.invalidServerConfig
      );
      continue;
    }

    const command = typeof rawConfig.command === "string" ? rawConfig.command : null;
    const args = asStringArray(rawConfig.args);
    const env = isRecord(rawConfig.env) ? rawConfig.env : null;

    if (!command) {
      pushFinding(
        "missing-command",
        serverName,
        labels.policy.missingCommand
      );
    }

    if (command === "npx") {
      pushFinding(
        "npx-runtime-fetch",
        serverName,
        labels.policy.npxRuntimeFetch,
        { args }
      );
    }

    if (env && Object.keys(env).length > 0) {
      pushFinding(
        "env-secrets-present",
        serverName,
        labels.policy.envSecretsPresent,
        { envKeys: Object.keys(env).sort((a, b) => a.localeCompare(b)) }
      );
    }

    const sensitiveArgs = args.filter((arg) => /token|secret|password|key/i.test(arg));
    if (sensitiveArgs.length > 0) {
      pushFinding(
        "sensitive-arg-name",
        serverName,
        labels.policy.sensitiveArgName,
        { matchedArgs: sensitiveArgs }
      );
    }
  }

  if (findings.length === 0) {
    pushFinding(
      "no-policy-findings",
      profile.name,
      labels.policy.noFindings,
      { serverCount: profile.serverCount }
    );
  }

  return findings;
}

export function summarizePolicyFindings(findings: PolicyFinding[]): Record<PolicySeverity, number> {
  return findings.reduce<Record<PolicySeverity, number>>(
    (summary, finding) => {
      summary[finding.severity] += 1;
      return summary;
    },
    { info: 0, warning: 0, high: 0 }
  );
}
