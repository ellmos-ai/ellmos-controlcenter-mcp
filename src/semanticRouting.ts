import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { findSkills, type SkillMatch } from "./skillFinder.js";
import type { SkillSummary } from "./skills.js";

export const SEMANTIC_ROUTING_SCHEMA = "semantic-persona-routing.map.v1";
export const DEFAULT_SEMANTIC_ROUTING_MAP =
  process.env.ELLMOS_SEMANTIC_ROUTING_MAP ??
  path.join(os.homedir(), ".ellmos", "controlcenter", "routing", "semantic-persona-routing-map.v1.json");

interface VerifiedEndpointRef {
  skill: string;
  resolution: "explicit" | "provenance";
}

interface CandidateEndpointRef {
  skill: string;
  resolution: "lexical-candidate";
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
  endpoint_skills: VerifiedEndpointRef[];
  candidate_skills: CandidateEndpointRef[];
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

const STABLE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`routing map ${key} must be a non-empty string`);
  }
  return value;
}

function requiredStableId(record: Record<string, unknown>, key = "id"): string {
  const value = requiredString(record, key);
  if (!STABLE_ID.test(value)) throw new Error(`routing map ${key} must be a stable normalized id: ${value}`);
  return value;
}

function stringArray(record: Record<string, unknown>, key: string): string[] {
  const values = requiredArray(record, key);
  if (values.some((value) => typeof value !== "string" || value.trim().length === 0)) {
    throw new Error(`routing map ${key} must contain only non-empty strings`);
  }
  return values as string[];
}

function uniqueIds(records: Record<string, unknown>[], kind: string): Set<string> {
  const ids = new Set<string>();
  for (const record of records) {
    const id = requiredStableId(record);
    if (ids.has(id)) throw new Error(`routing map duplicate ${kind} id: ${id}`);
    ids.add(id);
  }
  return ids;
}

function recordsArray(record: Record<string, unknown>, key: string): Record<string, unknown>[] {
  const values = requiredArray(record, key);
  if (values.some((value) => !isRecord(value))) throw new Error(`routing map ${key} must contain only objects`);
  return values as Record<string, unknown>[];
}

function assertRefs(values: string[], allowed: Set<string>, context: string): void {
  for (const value of values) {
    if (!STABLE_ID.test(value) || !allowed.has(value)) throw new Error(`routing map unknown ${context} reference: ${value}`);
  }
}

function parseEndpointRefs(
  expert: Record<string, unknown>,
  key: "endpoint_skills" | "candidate_skills",
  allowedSkills: Set<string>
): Array<VerifiedEndpointRef | CandidateEndpointRef> {
  const seen = new Set<string>();
  return recordsArray(expert, key).map((record) => {
    const skill = requiredStableId(record, "skill");
    if (!allowedSkills.has(skill)) throw new Error(`routing map unknown ${key} skill reference: ${skill}`);
    if (seen.has(skill)) throw new Error(`routing map duplicate ${key} skill reference: ${skill}`);
    seen.add(skill);
    const resolution = requiredString(record, "resolution");
    const allowed = key === "endpoint_skills" ? ["explicit", "provenance"] : ["lexical-candidate"];
    if (!allowed.includes(resolution)) throw new Error(`routing map invalid ${key} resolution: ${resolution}`);
    return { skill, resolution } as VerifiedEndpointRef | CandidateEndpointRef;
  });
}

export async function loadSemanticRoutingMap(filePath = DEFAULT_SEMANTIC_ROUTING_MAP): Promise<SemanticRoutingMap> {
  const raw = JSON.parse(await fs.readFile(filePath, "utf-8")) as unknown;
  if (!isRecord(raw) || raw.schema !== SEMANTIC_ROUTING_SCHEMA || !isRecord(raw.roles)) {
    throw new Error(`routing map must use ${SEMANTIC_ROUTING_SCHEMA}`);
  }
  const coordinators = recordsArray(raw.roles, "coordinators");
  const experts = recordsArray(raw.roles, "experts");
  const personas = recordsArray(raw, "personas");
  const skills = recordsArray(raw, "skills");
  const gaps = recordsArray(raw, "gaps");
  requiredArray(raw, "issues");

  const coordinatorIds = uniqueIds(coordinators, "coordinator");
  const expertIds = uniqueIds(experts, "expert");
  const personaIds = uniqueIds(personas, "persona");
  const skillIds = uniqueIds(skills, "skill");
  const roleIds = new Set([...coordinatorIds, ...expertIds]);

  for (const coordinator of coordinators) {
    requiredString(coordinator, "name");
    requiredString(coordinator, "description");
    assertRefs(stringArray(coordinator, "experts"), expertIds, "expert");
    assertRefs(stringArray(coordinator, "personas"), personaIds, "persona");
  }
  for (const expert of experts) {
    requiredString(expert, "name");
    requiredString(expert, "description");
    assertRefs(stringArray(expert, "parent_roles"), coordinatorIds, "parent role");
    assertRefs(stringArray(expert, "personas"), personaIds, "persona");
    const endpoints = parseEndpointRefs(expert, "endpoint_skills", skillIds);
    const candidates = parseEndpointRefs(expert, "candidate_skills", skillIds);
    const endpointSkills = new Set(endpoints.map((item) => item.skill));
    for (const candidate of candidates) {
      if (endpointSkills.has(candidate.skill)) {
        throw new Error(`routing map skill cannot be both endpoint and candidate: ${candidate.skill}`);
      }
    }
  }
  for (const persona of personas) {
    requiredString(persona, "display_name");
    assertRefs(stringArray(persona, "roles"), roleIds, "role");
    assertRefs(stringArray(persona, "skills"), skillIds, "skill");
  }
  for (const skill of skills) requiredString(skill, "name");
  for (const gap of gaps) {
    const expert = requiredStableId(gap, "expert");
    if (!expertIds.has(expert)) throw new Error(`routing map unknown gap expert reference: ${expert}`);
    requiredString(gap, "reason");
  }
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
  const liveById = new Map<string, SkillSummary[]>();
  for (const skill of skills) {
    if (!skill.hasSkillMd || !skill.deployed) continue;
    const id = normalize(skill.name);
    liveById.set(id, [...(liveById.get(id) ?? []), skill]);
  }
  const ambiguousLiveIds = new Set(
    [...liveById.entries()].filter(([, matches]) => matches.length > 1).map(([id]) => id)
  );
  const verifiedSkills = new Map(
    [...liveById.entries()].filter(([, matches]) => matches.length === 1).map(([id, matches]) => [id, matches[0]])
  );
  const verifiedEndpointIds = new Set<string>();
  const verifiedEndpoints: SemanticRouteResult["verified_endpoints"] = (expert?.endpoint_skills ?? []).flatMap((endpoint) => {
    const endpointId = normalize(endpoint.skill);
    if (verifiedEndpointIds.has(endpointId)) return [];
    const live = verifiedSkills.get(normalize(endpoint.skill));
    if (!live) return [];
    verifiedEndpointIds.add(endpointId);
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
    if (ambiguousLiveIds.has(candidateId)) throw new Error(`confirmed candidate ${options.confirmedCandidateSkillId} has ambiguous live deployments`);
    const live = verifiedSkills.get(candidateId);
    if (!live) throw new Error(`confirmed candidate ${options.confirmedCandidateSkillId} is not deployed live`);
    if (!verifiedEndpointIds.has(candidateId)) {
      verifiedEndpointIds.add(candidateId);
      verifiedEndpoints.push({
        skill: live.name,
        deployed: live.deployed,
        load_reference: path.join(live.absolutePath, "SKILL.md"),
        resolution: "verified-candidate-live"
      });
    }
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
  if (expert) {
    for (const endpoint of expert.endpoint_skills) {
      if (ambiguousLiveIds.has(normalize(endpoint.skill))) gaps.push(`ambiguous-live-endpoint:${endpoint.skill}`);
    }
  }
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
