import type { ResolvedProfile } from "./profiles.js";

export type PolicySeverity = "info" | "warning" | "high";

export interface PolicyFinding {
  severity: PolicySeverity;
  serverName: string;
  ruleId: string;
  message: string;
  details: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function auditResolvedProfile(profile: ResolvedProfile): PolicyFinding[] {
  const findings: PolicyFinding[] = [];

  for (const [serverName, rawConfig] of Object.entries(profile.config.mcpServers)) {
    if (!isRecord(rawConfig)) {
      findings.push({
        severity: "high",
        serverName,
        ruleId: "invalid-server-config",
        message: "Server-Konfiguration ist kein Objekt.",
        details: {}
      });
      continue;
    }

    const command = typeof rawConfig.command === "string" ? rawConfig.command : null;
    const args = asStringArray(rawConfig.args);
    const env = isRecord(rawConfig.env) ? rawConfig.env : null;

    if (!command) {
      findings.push({
        severity: "high",
        serverName,
        ruleId: "missing-command",
        message: "Server hat keinen ausführbaren command-Eintrag.",
        details: {}
      });
    }

    if (command === "npx") {
      findings.push({
        severity: "warning",
        serverName,
        ruleId: "npx-runtime-fetch",
        message: "Server wird über npx gestartet. Das ist bequem, aber weniger reproduzierbar als ein gepinnter lokaler Pfad.",
        details: { args }
      });
    }

    if (env && Object.keys(env).length > 0) {
      findings.push({
        severity: "warning",
        serverName,
        ruleId: "env-secrets-present",
        message: "Server-Konfiguration enthält Environment-Variablen. Werte werden absichtlich nicht ausgegeben.",
        details: { envKeys: Object.keys(env).sort((a, b) => a.localeCompare(b)) }
      });
    }

    if (args.some((arg) => /token|secret|password|key/i.test(arg))) {
      findings.push({
        severity: "warning",
        serverName,
        ruleId: "sensitive-arg-name",
        message: "Server-Argumente enthalten sensitive Namensbestandteile. Inhalte bitte separat prüfen.",
        details: { matchedArgs: args.filter((arg) => /token|secret|password|key/i.test(arg)) }
      });
    }
  }

  if (findings.length === 0) {
    findings.push({
      severity: "info",
      serverName: profile.name,
      ruleId: "no-policy-findings",
      message: "Keine Policy-Hinweise im aufgelösten Profil gefunden.",
      details: { serverCount: profile.serverCount }
    });
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
