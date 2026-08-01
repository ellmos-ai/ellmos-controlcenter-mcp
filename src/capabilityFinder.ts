import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import { tokenize } from "./skillFinder.js";

export const CAPABILITY_METHOD = "controlcenter-lexical-candidate" as const;
export const CAPABILITY_SCORE_DOMAIN = "controlcenter.lexical.v1" as const;

const STABLE_REF = /^[a-z][a-z0-9_-]*:[A-Za-z0-9][A-Za-z0-9._:/-]*$/;
const TYPE_PREFIX: Record<string, string> = {
  module: "module",
  skill: "skill",
  software_app: "software",
  interface: "interface",
  access_surface: "access_surface"
};

type JsonObject = Record<string, unknown>;

export interface ComponentState {
  declared: true;
  installed: null;
  configured: null;
  running: null;
  healthy: null;
  observed: null;
}

export interface CapabilityCandidate {
  ref: string;
  component_type: string;
  role: string | null;
  bundle_refs: string[];
  provides: string[];
  consumes: string[];
  desired_status: string | null;
  score: number;
  matched_terms: string[];
  identity_claim: "native-binding";
  identity_verified: false;
  registry_binding_claim: { source: string; record_id: string };
  state: ComponentState;
}

export interface CapabilitySearchResult {
  schema: "ellmos.controlcenter-lexical-candidates.v1";
  query: string;
  method: typeof CAPABILITY_METHOD;
  score_domain: typeof CAPABILITY_SCORE_DOMAIN;
  source: {
    schema: "system-explorer.resolution.v1";
    content_hash: string;
    component_registry_content_hash: string;
    self_consistency: "verified";
    component_registry_source_claim: "verified";
    provenance_verified: false;
  };
  candidates: CapabilityCandidate[];
  selected_ref: null;
  selection_authority: "none";
  availability_verified: false;
  executable: false;
  result_status: "ambiguous" | "declared-not-observed" | "not-found";
}

export interface CapabilityOverviewResult {
  schema: "ellmos.controlcenter-tool-overview.v1";
  source: CapabilitySearchResult["source"];
  components: Array<Omit<CapabilityCandidate, "score" | "matched_terms">>;
  state_axes: ["declared", "installed", "configured", "running", "healthy", "observed"];
  note: "desired_status is declarative and never substitutes for observed runtime state";
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])])
  );
}

export function canonicalContentHash(value: JsonObject): string {
  const unsigned = { ...value };
  delete unsigned.content_hash;
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(unsigned)), "utf8")
    .digest("hex");
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string"))].sort();
}

function stableComponentRef(value: unknown): string | null {
  const candidate = typeof value === "string"
    ? value
    : isObject(value) && typeof value.ref === "string"
      ? value.ref
      : null;
  if (!candidate || !STABLE_REF.test(candidate)) return null;
  const tail = candidate.slice(candidate.indexOf(":") + 1);
  if (tail.includes("..") || tail.includes("\\") || tail.startsWith("/") || tail.includes("://")) return null;
  return candidate;
}

function checkResolutionSelfConsistency(resolution: JsonObject): CapabilitySearchResult["source"] {
  if (resolution.schema !== "system-explorer.resolution.v1") {
    throw new Error("unsupported resolution schema");
  }
  const expected = resolution.content_hash;
  if (typeof expected !== "string" || !/^[a-f0-9]{64}$/.test(expected)) {
    throw new Error("resolution content_hash is missing or invalid");
  }
  if (canonicalContentHash(resolution) !== expected) {
    throw new Error("resolution content_hash verification failed");
  }
  const registry = resolution.component_registry;
  if (!isObject(registry) || registry.source_verification !== "verified") {
    throw new Error("component registry source verification is not verified");
  }
  if (typeof registry.content_hash !== "string" || !/^[a-f0-9]{64}$/.test(registry.content_hash)) {
    throw new Error("component registry content_hash is missing or invalid");
  }
  return {
    schema: "system-explorer.resolution.v1",
    content_hash: expected,
    component_registry_content_hash: registry.content_hash,
    self_consistency: "verified",
    component_registry_source_claim: "verified",
    provenance_verified: false
  };
}

function declaredState(): ComponentState {
  return {
    declared: true,
    installed: null,
    configured: null,
    running: null,
    healthy: null,
    observed: null
  };
}

function claimedNativeComponents(resolution: JsonObject): Array<Omit<CapabilityCandidate, "score" | "matched_terms">> {
  const bundles = Array.isArray(resolution.bundles) ? resolution.bundles : [];
  const components = new Map<string, Omit<CapabilityCandidate, "score" | "matched_terms">>();
  for (const bundle of bundles) {
    if (!isObject(bundle) || typeof bundle.id !== "string" || !Array.isArray(bundle.components)) continue;
    for (const component of bundle.components) {
      if (!isObject(component) || typeof component.type !== "string") continue;
      const registry = component.registry_resolution;
      const ref = stableComponentRef(component.ref);
      const expectedPrefix = TYPE_PREFIX[component.type];
      if (
        !ref ||
        !expectedPrefix ||
        !ref.startsWith(`${expectedPrefix}:`) ||
        !isObject(registry) ||
        registry.class !== "native-binding" ||
        typeof registry.source !== "string" ||
        typeof registry.record_id !== "string"
      ) continue;
      const provides = stringList(component.provides);
      const consumes = stringList(component.consumes);
      const current = components.get(ref);
      if (current) {
        if (
          current.component_type !== component.type ||
          current.registry_binding_claim.source !== registry.source ||
          current.registry_binding_claim.record_id !== registry.record_id
        ) {
          throw new Error(`component ${ref} has conflicting typed registry bindings`);
        }
        current.bundle_refs = [...new Set([...current.bundle_refs, bundle.id])].sort();
        current.provides = [...new Set([...current.provides, ...provides])].sort();
        current.consumes = [...new Set([...current.consumes, ...consumes])].sort();
        continue;
      }
      components.set(ref, {
        ref,
        component_type: component.type,
        role: typeof component.role === "string" ? component.role : null,
        bundle_refs: [bundle.id],
        provides,
        consumes,
        desired_status: typeof component.desired_status === "string" ? component.desired_status : null,
        identity_claim: "native-binding",
        identity_verified: false,
        registry_binding_claim: { source: registry.source, record_id: registry.record_id },
        state: declaredState()
      });
    }
  }
  return [...components.values()].sort((a, b) => a.ref.localeCompare(b.ref));
}

export async function loadSelfConsistentResolution(resolutionPath: string): Promise<JsonObject> {
  const parsed: unknown = JSON.parse(await fs.readFile(resolutionPath, "utf8"));
  if (!isObject(parsed)) throw new Error("resolution must be a JSON object");
  checkResolutionSelfConsistency(parsed);
  return parsed;
}

function scoreCandidate(queryTokens: string[], candidate: Omit<CapabilityCandidate, "score" | "matched_terms">) {
  const fields: Array<[string, number]> = [
    [candidate.ref.replace(/[:._/-]/g, " "), 5],
    [candidate.provides.join(" ").replace(/[.:_/-]/g, " "), 4],
    [(candidate.role ?? "").replace(/[.:_/-]/g, " "), 2],
    [candidate.consumes.join(" ").replace(/[.:_/-]/g, " "), 1]
  ];
  let score = 0;
  const matched = new Set<string>();
  for (const [text, weight] of fields) {
    const fieldTokens = new Set(tokenize(text));
    for (const term of queryTokens) {
      if (fieldTokens.has(term)) {
        score += weight;
        matched.add(term);
      }
    }
  }
  return { score, matched_terms: [...matched].sort() };
}

export function findCapabilities(
  query: string,
  resolution: JsonObject,
  limit = 10
): CapabilitySearchResult {
  const source = checkResolutionSelfConsistency(resolution);
  const queryTokens = [...new Set(tokenize(query))];
  const ranked = claimedNativeComponents(resolution)
    .map((candidate) => ({ ...candidate, ...scoreCandidate(queryTokens, candidate) }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || b.matched_terms.length - a.matched_terms.length || a.ref.localeCompare(b.ref));
  const tied = ranked.length > 1 && ranked[0].score === ranked[1].score;
  const candidates = ranked.slice(0, Math.max(1, Math.min(limit, 100)));
  return {
    schema: "ellmos.controlcenter-lexical-candidates.v1",
    query,
    method: CAPABILITY_METHOD,
    score_domain: CAPABILITY_SCORE_DOMAIN,
    source,
    candidates,
    selected_ref: null,
    selection_authority: "none",
    availability_verified: false,
    executable: false,
    result_status: candidates.length === 0 ? "not-found" : tied ? "ambiguous" : "declared-not-observed"
  };
}

export function buildCapabilityOverview(resolution: JsonObject): CapabilityOverviewResult {
  const source = checkResolutionSelfConsistency(resolution);
  return {
    schema: "ellmos.controlcenter-tool-overview.v1",
    source,
    components: claimedNativeComponents(resolution),
    state_axes: ["declared", "installed", "configured", "running", "healthy", "observed"],
    note: "desired_status is declarative and never substitutes for observed runtime state"
  };
}
