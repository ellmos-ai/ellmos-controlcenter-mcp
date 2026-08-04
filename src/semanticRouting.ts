import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { findSkills, type SkillMatch } from "./skillFinder.js";
import type { SkillSummary } from "./skills.js";

export const SEMANTIC_ROUTING_SCHEMA = "semantic-persona-routing.map.v1";
export const DEFAULT_SEMANTIC_ROUTING_MAP =
  process.env.ELLMOS_SEMANTIC_ROUTING_MAP ??
  path.join(os.homedir(), ".ellmos", "controlcenter", "routing", "semantic-persona-routing-map.v1.json");

interface EndpointRef {
  skill: string;
  resolution: string;
}

interface Coordinator {
  id: string;
  name: string;
  description: string;
  experts: string[];
  personas: string[];
}

interface Expert {
  id: string;
  name: string;
  description: string;
  parent_roles: string[];
  endpoint_skills: EndpointRef[];
  candidate_skills: EndpointRef[];
  personas: string[];
}

interface Persona {
  id: string;
  display_name: string;
  roles: string[];
  skills: string[];
}

export interface SemanticRoutingMap {
  schema: typeof SEMANTIC_ROUTING_SCHEMA;
  roles: { coordinators: Coordinator[]; experts: Expert[] };
  personas: Persona[];
  skills: Array<{ id: string; name: string }>;
  gaps: Array<{ expert: string; reason: string }>;
  issues: unknown[];
}

export interface SemanticRouteResult {
  schema: "ellmos.controlcenter.semantic-route.v1";
  status: "semantic-selection-required" | "expert-selection-required" | "resolved" | "gap";
  selection: {
    role: Coordinator | null;
    expert: Expert | null;
    persona: Persona | null;
  };
  verified_endpoints: Array<{
    skill: string;
    deployed: boolean;
    load_reference: string;
    resolution: "explicit-live" | "provenance-live" | "verified-candidate-live";
  }>;
  live_resolver_candidates: SkillMatch[];
  available_experts: Expert[];
  gaps: string[];
  authority: {
    semantic_selection: "caller-llm-or-user";
    endpoint_availability: "live-skill-inventory";
    candidate_promotion: "explicit-confirmation-and-live-inventory";
    execution_authority: "none";
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requiredArray(record: Record<string, unknown>, key: string): unknown[] {
  const value = record[key];
  if (!Array.isArray(value)) throw new Error(`routing map ${key} must be an array`);
  return value;
}

export async function loadSemanticRoutingMap(filePath = DEFAULT_SEMANTIC_ROUTING_MAP): Promise<SemanticRoutingMap> {
  const raw = JSON.parse(await fs.readFile(filePath, "utf-8")) as unknown;
  if (!isRecord(raw) || raw.schema !== SEMANTIC_ROUTING_SCHEMA || !isRecord(raw.roles)) {
    throw new Error(`routing map must use ${SEMANTIC_ROUTING_SCHEMA}`);
  }
  requiredArray(raw.roles, "coordinators");
  requiredArray(raw.roles, "experts");
  requiredArray(raw, "personas");
  requiredArray(raw, "skills");
  requiredArray(raw, "gaps");
  requiredArray(raw, "issues");
  return raw as unknown as SemanticRoutingMap;
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("en-US").replace(/[_\s]+/g, "-");
}

export function resolveSemanticRoute(
  map: SemanticRoutingMap,
  skills: SkillSummary[],
  options: {
    intent: string;
    selectedRoleId?: string;
    selectedExpertId?: string;
    personaId?: string;
    confirmedCandidateSkillId?: string;
    limit?: number;
  }
): SemanticRouteResult {
  const role = options.selectedRoleId
    ? map.roles.coordinators.find((item) => normalize(item.id) === normalize(options.selectedRoleId!)) ?? null
    : null;
  if (options.selectedRoleId && !role) throw new Error(`unknown semantic role: ${options.selectedRoleId}`);

  const expert = options.selectedExpertId
    ? map.roles.experts.find((item) => normalize(item.id) === normalize(options.selectedExpertId!)) ?? null
    : null;
  if (options.selectedExpertId && !expert) throw new Error(`unknown semantic expert: ${options.selectedExpertId}`);
  if (role && expert && !role.experts.includes(expert.id) && !expert.parent_roles.includes(role.id)) {
    throw new Error(`expert ${expert.id} is not connected to role ${role.id}`);
  }

  const persona = options.personaId
    ? map.personas.find((item) => normalize(item.id) === normalize(options.personaId!)) ?? null
    : null;
  if (options.personaId && !persona) throw new Error(`unknown persona: ${options.personaId}`);
  if (persona && expert && !persona.roles.includes(expert.id) && !expert.personas.includes(persona.id)) {
    throw new Error(`persona ${persona.id} is not connected to expert ${expert.id}`);
  }

  const availableExperts = role
    ? map.roles.experts.filter((item) => role.experts.includes(item.id) || item.parent_roles.includes(role.id))
    : [];
  const byId = new Map(skills.map((skill) => [normalize(skill.name), skill]));
  const verifiedEndpoints: SemanticRouteResult["verified_endpoints"] = (expert?.endpoint_skills ?? []).flatMap((endpoint) => {
    const live = byId.get(normalize(endpoint.skill));
    if (!live || !live.hasSkillMd) return [];
    return [{
      skill: live.name,
      deployed: live.deployed,
      load_reference: path.join(live.absolutePath, "SKILL.md"),
      resolution: endpoint.resolution === "provenance" ? "provenance-live" as const : "explicit-live" as const
    }];
  });
  if (expert && options.confirmedCandidateSkillId) {
    const candidateId = normalize(options.confirmedCandidateSkillId);
    const declared = expert.candidate_skills.some((item) => normalize(item.skill) === candidateId);
    if (!declared) throw new Error(`skill ${options.confirmedCandidateSkillId} is not a declared candidate for expert ${expert.id}`);
    const live = byId.get(candidateId);
    if (!live || !live.hasSkillMd) throw new Error(`confirmed candidate ${options.confirmedCandidateSkillId} is not live`);
    verifiedEndpoints.push({
      skill: live.name,
      deployed: live.deployed,
      load_reference: path.join(live.absolutePath, "SKILL.md"),
      resolution: "verified-candidate-live"
    });
  }
  const rawCandidates = findSkills(options.intent, skills, Math.max(options.limit ?? 5, skills.length));
  const seenCandidates = new Set<string>();
  const candidates = rawCandidates.filter((item) => {
    const key = normalize(item.skill.name);
    if (seenCandidates.has(key)) return false;
    seenCandidates.add(key);
    return true;
  }).slice(0, options.limit ?? 5);
  const gaps: string[] = [];
  if (expert && verifiedEndpoints.length === 0) gaps.push(`no-verified-live-endpoint:${expert.id}`);
  if (expert?.candidate_skills.length && !options.confirmedCandidateSkillId) gaps.push(`candidate-skills-require-second-signal:${expert.id}`);

  let status: SemanticRouteResult["status"] = "semantic-selection-required";
  if (role && !expert) status = "expert-selection-required";
  if (expert) status = verifiedEndpoints.length > 0 ? "resolved" : "gap";
  return {
    schema: "ellmos.controlcenter.semantic-route.v1",
    status,
    selection: { role, expert, persona },
    verified_endpoints: verifiedEndpoints,
    live_resolver_candidates: candidates,
    available_experts: availableExperts,
    gaps,
    authority: {
      semantic_selection: "caller-llm-or-user",
      endpoint_availability: "live-skill-inventory",
      candidate_promotion: "explicit-confirmation-and-live-inventory",
      execution_authority: "none"
    }
  };
}
