import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildCapabilityOverview,
  canonicalContentHash,
  findCapabilities,
  loadSelfConsistentResolution
} from "../src/capabilityFinder.js";

function fixture() {
  const resolution: Record<string, unknown> = {
    schema: "system-explorer.resolution.v1",
    system: { id: "fixture-system" },
    instance: { host_id: "TEST-HOST" },
    component_registry: {
      schema: "ellmos.component-registry-bindings.v1",
      id: "fixture-registry",
      version: "1.0.0",
      content_hash: "a".repeat(64),
      source_verification: "verified"
    },
    bundles: [
      {
        id: "ellmos-tools-bundle",
        components: [
          {
            type: "module",
            ref: "module:api-prober",
            role: "API inspection",
            provides: ["tool.api.inspect", "tool.health.probe"],
            consumes: [],
            desired_status: "configured",
            registry_resolution: {
              class: "native-binding",
              source: "registry:modules",
              record_id: "api-prober"
            }
          },
          {
            type: "software_app",
            ref: { ref: "software:sqlite-viewer", version: "1.0.0" },
            role: "database inspection",
            provides: ["tool.database.inspect"],
            consumes: [],
            desired_status: "available",
            registry_resolution: {
              class: "native-binding",
              source: "registry:software",
              record_id: "sqlite-viewer"
            }
          },
          {
            type: "module",
            ref: "module:declared-only",
            role: "must not appear",
            provides: ["tool.api.inspect"],
            registry_resolution: { class: "declared-only" }
          },
          {
            type: "module",
            ref: "C:\\unsafe\\local-module",
            role: "must not appear",
            provides: ["tool.api.inspect"],
            registry_resolution: {
              class: "native-binding",
              source: "registry:modules",
              record_id: "unsafe"
            }
          },
          {
            type: "module",
            ref: "skill:type-confused",
            role: "must not appear",
            provides: ["tool.api.inspect"],
            registry_resolution: {
              class: "native-binding",
              source: "registry:modules",
              record_id: "type-confused"
            }
          }
        ]
      },
      {
        id: "ellmos-api-alternative-bundle",
        components: [
          {
            type: "skill",
            ref: "skill:api-reader",
            role: "API inspection",
            provides: ["tool.api.inspect"],
            consumes: [],
            desired_status: "available",
            registry_resolution: {
              class: "native-binding",
              source: "registry:skills",
              record_id: "api-reader"
            }
          },
          {
            type: "module",
            ref: "module:api-prober",
            role: "API inspection",
            provides: ["tool.api.inspect", "tool.schema.read"],
            consumes: [],
            desired_status: "configured",
            registry_resolution: {
              class: "native-binding",
              source: "registry:modules",
              record_id: "api-prober"
            }
          }
        ]
      }
    ]
  };
  resolution.content_hash = canonicalContentHash(resolution);
  return resolution;
}

describe("verified capability search", () => {
  it("returns only typed native bindings and never grants execution authority", () => {
    const result = findCapabilities("database inspect", fixture());
    expect(result.method).toBe("controlcenter-lexical-candidate");
    expect(result.score_domain).toBe("controlcenter.lexical.v1");
    expect(result.candidates[0].ref).toBe("software:sqlite-viewer");
    expect(result.candidates.map((item) => item.ref)).not.toContain("module:declared-only");
    expect(result.candidates.map((item) => item.ref)).not.toContain("C:\\unsafe\\local-module");
    expect(result.candidates.map((item) => item.ref)).not.toContain("skill:type-confused");
    expect(result.selected_ref).toBeNull();
    expect(result.executable).toBe(false);
    expect(result.source).toMatchObject({
      self_consistency: "verified",
      component_registry_source_claim: "verified",
      provenance_verified: false
    });
    expect(result.candidates[0].identity_verified).toBe(false);
    expect(result.result_status).toBe("declared-not-observed");
  });

  it("stops with explicit ambiguity when top lexical scores tie", () => {
    const result = findCapabilities("api inspect", fixture());
    expect(result.result_status).toBe("ambiguous");
    expect(result.candidates.slice(0, 2).map((item) => item.ref)).toEqual([
      "module:api-prober",
      "skill:api-reader"
    ]);
    expect(findCapabilities("api inspect", fixture(), 1).result_status).toBe("ambiguous");
  });

  it("keeps desired and observed runtime state separate", () => {
    const overview = buildCapabilityOverview(fixture());
    expect(overview.state_axes).toEqual([
      "declared", "installed", "configured", "running", "healthy", "observed"
    ]);
    expect(overview.components).toHaveLength(3);
    expect(overview.components.find((item) => item.ref === "module:api-prober")?.bundle_refs).toEqual([
      "ellmos-api-alternative-bundle",
      "ellmos-tools-bundle"
    ]);
    expect(overview.components.find((item) => item.ref === "module:api-prober")?.provides).toContain("tool.schema.read");
    expect(overview.components[0].state).toEqual({
      declared: true,
      installed: null,
      configured: null,
      running: null,
      healthy: null,
      observed: null
    });
    expect(overview.note).toContain("never substitutes");
  });

  it("fails closed on source-verification and content-hash drift", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "controlcenter-capability-"));
    const resolutionPath = path.join(root, "resolution.json");
    const unverified = fixture();
    (unverified.component_registry as Record<string, unknown>).source_verification = "declared";
    unverified.content_hash = canonicalContentHash(unverified);
    await fs.writeFile(resolutionPath, JSON.stringify(unverified), "utf8");
    await expect(loadSelfConsistentResolution(resolutionPath)).rejects.toThrow("not verified");

    const drifted = fixture();
    drifted.system = { id: "tampered" };
    await fs.writeFile(resolutionPath, JSON.stringify(drifted), "utf8");
    await expect(loadSelfConsistentResolution(resolutionPath)).rejects.toThrow("content_hash verification failed");
  });

  it("matches the System Explorer canonical JSON golden vector", () => {
    expect(canonicalContentHash({
      schema: "system-explorer.resolution.v1",
      z: ["ä", { β: 2, a: 1 }],
      a: { 中: true, x: null },
      content_hash: "ignored"
    })).toBe("117f56c78b9adcad92495cc555e48870bf6f49bf3ace692b7e388eae12bf05fb");
  });

  it("accepts the System Explorer interface type only with an interface prefix", () => {
    const resolution = fixture();
    const bundles = resolution.bundles as Array<Record<string, unknown>>;
    (bundles[0].components as Array<Record<string, unknown>>).push({
      type: "interface",
      ref: "interface:api-endpoint",
      role: "API endpoint",
      provides: ["tool.api.inspect"],
      registry_resolution: {
        class: "native-binding",
        source: "registry:interfaces",
        record_id: "api-endpoint"
      }
    });
    resolution.content_hash = canonicalContentHash(resolution);
    expect(buildCapabilityOverview(resolution).components.map((item) => item.ref)).toContain("interface:api-endpoint");
  });
});
