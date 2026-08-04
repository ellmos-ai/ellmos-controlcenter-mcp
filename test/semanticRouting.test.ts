import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { loadSemanticRoutingMap, resolveSemanticRoute, type SemanticRoutingMap } from "../src/semanticRouting.js";
import type { SkillSummary } from "../src/skills.js";

const map: SemanticRoutingMap = {
  schema: "semantic-persona-routing.map.v1",
  roles: {
    coordinators: [{ id: "office", name: "office", description: "Office", experts: ["tax"], personas: [] }],
    experts: [{ id: "tax", name: "tax", description: "Tax", parent_roles: ["office"], endpoint_skills: [{ skill: "employee-tax", resolution: "explicit" }], candidate_skills: [], personas: ["theodor"] }]
  },
  personas: [{ id: "theodor", display_name: "Theodor", roles: ["tax"], skills: ["employee-tax"] }],
  skills: [{ id: "employee-tax", name: "employee-tax" }],
  gaps: [],
  issues: []
};

function skill(overrides: Partial<SkillSummary> = {}): SkillSummary {
  return { name: "employee-tax", description: "Tax receipts", version: "1.0.0", type: "skill", category: "office", status: "active", tags: ["tax"], aliases: [], absolutePath: "C:/skills/employee-tax", deployed: true, hasSkillMd: true, ...overrides };
}

describe("semantic routing adapter", () => {
  it("keeps semantic selection external and exposes allowed experts", () => {
    const result = resolveSemanticRoute(map, [skill()], { intent: "tax receipts", selectedRoleId: "office" });
    expect(result.status).toBe("expert-selection-required");
    expect(result.available_experts.map((item) => item.id)).toEqual(["tax"]);
    expect(result.authority.execution_authority).toBe("none");
  });

  it("verifies explicit endpoints against the live skill inventory", () => {
    const result = resolveSemanticRoute(map, [skill()], { intent: "tax receipts", selectedRoleId: "office", selectedExpertId: "tax", personaId: "theodor" });
    expect(result.status).toBe("resolved");
    expect(result.verified_endpoints[0]).toMatchObject({ skill: "employee-tax", deployed: true, resolution: "explicit-live" });
    expect(result.selection.persona?.id).toBe("theodor");
  });

  it("returns a visible gap instead of promoting fuzzy candidates", () => {
    const result = resolveSemanticRoute(map, [skill({ name: "other-tax" })], { intent: "tax receipts", selectedExpertId: "tax" });
    expect(result.status).toBe("gap");
    expect(result.verified_endpoints).toEqual([]);
    expect(result.gaps).toContain("no-verified-live-endpoint:tax");
    expect(result.authority.candidate_promotion).toBe("explicit-confirmation-and-live-inventory");
  });

  it("promotes a declared candidate only after explicit confirmation and live verification", () => {
    const candidateMap: SemanticRoutingMap = {
      ...map,
      roles: { ...map.roles, experts: [{ ...map.roles.experts[0], endpoint_skills: [], candidate_skills: [{ skill: "employee-tax", resolution: "lexical-candidate" }] }] }
    };
    const result = resolveSemanticRoute(candidateMap, [skill()], { intent: "tax receipts", selectedExpertId: "tax", confirmedCandidateSkillId: "employee-tax" });
    expect(result.status).toBe("resolved");
    expect(result.verified_endpoints[0].resolution).toBe("verified-candidate-live");
    expect(result.gaps).not.toContain("candidate-skills-require-second-signal:tax");
  });

  it("fails closed on a wrong schema", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "semantic-route-"));
    const file = path.join(dir, "map.json");
    await fs.writeFile(file, JSON.stringify({ ...map, schema: "wrong" }), "utf-8");
    await expect(loadSemanticRoutingMap(file)).rejects.toThrow("semantic-persona-routing.map.v1");
  });
});
