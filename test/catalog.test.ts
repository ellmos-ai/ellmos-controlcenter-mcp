import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildCapabilityBundles,
  BundleConfigError,
  loadBundleDefinitions,
  loadCapabilityBundles,
  suggestCapabilityBundles
} from "../src/bundles.js";
import {
  discoverLocalServerDirectories,
  extractToolCountFromDescription,
  createLocalServerMcpConfig,
  scanLocalServers
} from "../src/catalog.js";
import {
  extractExtendsProfiles,
  extractRemovedServerNames,
  extractServerNames,
  listClaudeProfiles,
  prepareProfileSwitch,
  ProfileConfigError,
  readEditableProfile,
  resolveClaudeProfile,
  suggestProfile,
  summarizeProfile,
  writeEditableProfile
} from "../src/profiles.js";
import {
  auditResolvedProfile,
  loadPolicyRules,
  PolicyConfigError,
  summarizePolicyFindings
} from "../src/policy.js";

const tempDirectories: string[] = [];

afterEach(async () => {
  while (tempDirectories.length > 0) {
    const directory = tempDirectories.pop();
    if (directory) {
      await fs.rm(directory, { recursive: true, force: true });
    }
  }
});

async function createTempDirectory(prefix: string): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirectories.push(directory);
  return directory;
}

describe("catalog helpers", () => {
  it("extracts tool count from descriptions", () => {
    expect(extractToolCountFromDescription("providing 17 tools for code analysis")).toBe(17);
    expect(extractToolCountFromDescription("no explicit count here")).toBeNull();
  });

  it("discovers local mcp repositories and reads metadata", async () => {
    const root = await createTempDirectory("controlcenter-mcp-root-");
    const serverDir = path.join(root, "demo-server-mcp");
    await fs.mkdir(serverDir, { recursive: true });
    await fs.writeFile(
      path.join(serverDir, "package.json"),
      JSON.stringify({
        name: "demo-server-mcp",
        version: "0.0.1",
        description: "A demo server with 3 tools",
        mcpName: "io.github.demo/demo-server-mcp",
        bin: {
          demo: "dist/index.js"
        }
      }),
      "utf-8"
    );

    const directories = await discoverLocalServerDirectories(root);
    expect(directories).toEqual(["demo-server-mcp"]);

    const summaries = await scanLocalServers(root);
    expect(summaries).toHaveLength(1);
    expect(summaries[0].toolCount).toBe(3);
    expect(summaries[0].binName).toBe("demo");
  });

  it("creates a local node mcp config from server metadata", () => {
    const config = createLocalServerMcpConfig({
      directoryName: "demo-server-mcp",
      packageName: "demo-server-mcp",
      mcpName: "io.github.demo/demo-server-mcp",
      version: "0.0.1",
      description: "Demo",
      absolutePath: "C:/tmp/demo-server-mcp",
      binName: "demo",
      entryPoint: "dist/index.js",
      toolCount: 3,
      hasServerJson: true,
      keywords: []
    });

    expect(config.command).toBe("node");
    expect(config.args[0]).toContain("dist");
  });
});

describe("profile helpers", () => {
  it("extracts servers from different profile buckets", () => {
    expect(
      extractServerNames({
        extends: "base",
        mcpServers: { github: {}, gmail: {} },
        add: { context7: {} }
      })
    ).toEqual(["context7", "github", "gmail"]);
  });

  it("extracts profile inheritance and removal lists from compact schema variants", () => {
    expect(
      extractExtendsProfiles({
        extends: ["base", "shared", "base"]
      })
    ).toEqual(["base", "shared"]);
    expect(
      extractRemovedServerNames({
        remove: "github",
        disabled: ["context7"],
        disabledServers: ["gmail", "github"]
      })
    ).toEqual(["context7", "github", "gmail"]);
  });

  it("summarizes a profile", () => {
    const summary = summarizeProfile("software", "C:/tmp/software.json", {
      extends: "base",
      mcpServers: { github: {}, context7: {} }
    });
    expect(summary.extendsProfile).toBe("base");
    expect(summary.extendsProfiles).toEqual(["base"]);
    expect(summary.serverCount).toBe(2);
  });

  it("lists profile files from disk", async () => {
    const root = await createTempDirectory("controlcenter-profile-root-");
    await fs.writeFile(
      path.join(root, "ai-lab.json"),
      JSON.stringify({
        extends: "base",
        mcpServers: { github: {}, "n8n-manager-mcp": {} }
      }),
      "utf-8"
    );

    const profiles = await listClaudeProfiles(root);
    expect(profiles).toHaveLength(1);
    expect(profiles[0].name).toBe("ai-lab");
    expect(profiles[0].serverCount).toBe(2);
  });

  it("resolves inherited profiles and lets child servers override base servers", async () => {
    const root = await createTempDirectory("controlcenter-profile-root-");
    await fs.writeFile(
      path.join(root, "base.json"),
      JSON.stringify({
        mcpServers: {
          github: { command: "npx" },
          shared: { command: "base" }
        }
      }),
      "utf-8"
    );
    await fs.writeFile(
      path.join(root, "software.json"),
      JSON.stringify({
        extends: "base",
        mcpServers: {
          shared: { command: "child" },
          context7: { command: "npx" }
        }
      }),
      "utf-8"
    );

    const resolved = await resolveClaudeProfile("software", root);
    expect(resolved.servers).toEqual(["context7", "github", "shared"]);
    expect(resolved.config.mcpServers.shared).toEqual({ command: "child" });
    expect(resolved.sourceFiles.map((file) => path.basename(file))).toEqual(["software.json", "base.json"]);
  });

  it("resolves multiple inherited profiles and can remove inherited servers", async () => {
    const root = await createTempDirectory("controlcenter-profile-root-");
    await fs.writeFile(
      path.join(root, "base.json"),
      JSON.stringify({
        mcpServers: {
          github: { command: "npx" },
          shared: { command: "base" }
        }
      }),
      "utf-8"
    );
    await fs.writeFile(
      path.join(root, "automation.json"),
      JSON.stringify({
        mcpServers: {
          n8n: { command: "node" }
        }
      }),
      "utf-8"
    );
    await fs.writeFile(
      path.join(root, "ai-lab.json"),
      JSON.stringify({
        extends: ["base", "automation"],
        remove: ["github"],
        mcpServers: {
          ollama: { command: "node" }
        }
      }),
      "utf-8"
    );

    const resolved = await resolveClaudeProfile("ai-lab", root);

    expect(resolved.servers).toEqual(["n8n", "ollama", "shared"]);
    expect(resolved.config.mcpServers.github).toBeUndefined();
    expect(resolved.sourceFiles.map((file) => path.basename(file))).toEqual(["ai-lab.json", "base.json", "automation.json"]);
  });

  it("reports missing profiles with a user-facing path", async () => {
    const root = await createTempDirectory("controlcenter-profile-root-");

    await expect(resolveClaudeProfile("missing", root)).rejects.toMatchObject({
      name: "ProfileConfigError",
      code: "profile-not-found",
      details: {
        profileName: "missing",
        profileRoot: root
      }
    } satisfies Partial<ProfileConfigError>);
  });

  it("reports invalid profile json without hiding the profile name", async () => {
    const root = await createTempDirectory("controlcenter-profile-root-");
    await fs.writeFile(path.join(root, "broken.json"), "{", "utf-8");

    await expect(resolveClaudeProfile("broken", root)).rejects.toMatchObject({
      name: "ProfileConfigError",
      code: "profile-json-invalid",
      details: {
        profileName: "broken"
      }
    } satisfies Partial<ProfileConfigError>);
  });

  it("detects inheritance cycles with the full chain", async () => {
    const root = await createTempDirectory("controlcenter-profile-root-");
    await fs.writeFile(path.join(root, "a.json"), JSON.stringify({ extends: "b" }), "utf-8");
    await fs.writeFile(path.join(root, "b.json"), JSON.stringify({ extends: "a" }), "utf-8");

    await expect(resolveClaudeProfile("a", root)).rejects.toMatchObject({
      name: "ProfileConfigError",
      code: "profile-inheritance-cycle",
      details: {
        chain: ["a", "b", "a"]
      }
    } satisfies Partial<ProfileConfigError>);
  });

  it("prepares and writes generated mcp config files", async () => {
    const root = await createTempDirectory("controlcenter-profile-root-");
    const outputPath = path.join(root, "_generated", "base.mcp.json");
    await fs.writeFile(
      path.join(root, "base.json"),
      JSON.stringify({
        mcpServers: {
          github: { command: "npx" }
        }
      }),
      "utf-8"
    );

    const plan = await prepareProfileSwitch("base", {
      profileRoot: root,
      outputPath,
      write: true
    });
    const written = JSON.parse(await fs.readFile(outputPath, "utf-8"));

    expect(plan.written).toBe(true);
    expect(plan.command).toContain("claude --mcp-config");
    expect(written.mcpServers.github.command).toBe("npx");
  });

  it("backs up existing generated mcp config files before overwriting", async () => {
    const root = await createTempDirectory("controlcenter-profile-root-");
    const outputPath = path.join(root, "_generated", "base.mcp.json");
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify({ old: true }), "utf-8");
    await fs.writeFile(
      path.join(root, "base.json"),
      JSON.stringify({
        mcpServers: {
          github: { command: "npx" }
        }
      }),
      "utf-8"
    );

    const plan = await prepareProfileSwitch("base", {
      profileRoot: root,
      outputPath,
      write: true
    });

    expect(plan.backupPath).not.toBeNull();
    expect(JSON.parse(await fs.readFile(plan.backupPath ?? "", "utf-8"))).toEqual({ old: true });
  });

  it("can read editable profiles from disk", async () => {
    const root = await createTempDirectory("controlcenter-profile-root-");
    await fs.writeFile(
      path.join(root, "base.json"),
      JSON.stringify({
        mcpServers: {
          github: { command: "npx" }
        }
      }),
      "utf-8"
    );

    const editable = await readEditableProfile("base", root);
    expect(editable.filePath).toContain("base.json");
    expect(extractServerNames(editable.profile)).toEqual(["github"]);
  });

  it("backs up existing editable profiles before writing", async () => {
    const root = await createTempDirectory("controlcenter-profile-root-");
    await fs.writeFile(
      path.join(root, "base.json"),
      JSON.stringify({
        mcpServers: {
          github: { command: "npx" }
        }
      }),
      "utf-8"
    );

    const result = await writeEditableProfile("base", { mcpServers: {} }, root);

    expect(result.backupPath).not.toBeNull();
    expect(extractServerNames(JSON.parse(await fs.readFile(result.backupPath ?? "", "utf-8")))).toEqual(["github"]);
  });

  it("suggests ai-lab for MCP-oriented tasks", () => {
    const suggestion = suggestProfile("Bitte richte einen MCP Agent mit n8n und OpenAI ein");
    expect(suggestion.profile).toBe("ai-lab");
    expect(suggestion.score).toBeGreaterThan(0);
  });
});

describe("bundle helpers", () => {
  it("groups local servers into capability bundles", () => {
    const bundles = buildCapabilityBundles([
      {
        directoryName: "ellmos-codecommander-mcp",
        packageName: "ellmos-codecommander-mcp",
        mcpName: "io.github.ellmos-ai/ellmos-codecommander-mcp",
        version: "1.0.0",
        description: "A developer MCP server with 17 tools for code analysis",
        absolutePath: "C:/tmp/ellmos-codecommander-mcp",
        binName: "ellmos-codecommander",
        entryPoint: "dist/index.js",
        toolCount: 17,
        hasServerJson: true,
        keywords: ["developer-tools", "code-analysis"]
      },
      {
        directoryName: "n8n-manager-mcp",
        packageName: "n8n-manager-mcp",
        mcpName: "io.github.ellmos-ai/n8n-manager-mcp",
        version: "1.0.0",
        description: "Workflow automation MCP server",
        absolutePath: "C:/tmp/n8n-manager-mcp",
        binName: "n8n-manager",
        entryPoint: "dist/index.js",
        toolCount: 8,
        hasServerJson: true,
        keywords: ["automation", "workflow"]
      }
    ]);

    const software = bundles.find((bundle) => bundle.id === "software");
    const automation = bundles.find((bundle) => bundle.id === "automation");
    expect(software?.servers).toContain("ellmos-codecommander-mcp");
    expect(automation?.servers).toContain("n8n-manager-mcp");
  });

  it("suggests bundles for a task", () => {
    const bundles = buildCapabilityBundles([]);
    const suggestions = suggestCapabilityBundles("Ich brauche n8n automation workflows", bundles);
    expect(suggestions[0].bundle.id).toBe("automation");
    expect(suggestions[0].score).toBeGreaterThan(0);
  });

  it("does not match short keywords inside unrelated words", () => {
    const bundles = buildCapabilityBundles([
      {
        directoryName: "ellmos-controlcenter-mcp",
        packageName: "ellmos-controlcenter-mcp",
        mcpName: "io.github.ellmos-ai/ellmos-controlcenter-mcp",
        version: "0.1.0",
        description: "Profile inspection and control plane",
        absolutePath: "C:/tmp/ellmos-controlcenter-mcp",
        binName: "ellmos-controlcenter",
        entryPoint: "dist/index.js",
        toolCount: null,
        hasServerJson: true,
        keywords: ["profile-management"]
      }
    ]);

    const filesystem = bundles.find((bundle) => bundle.id === "filesystem");
    const controlPlane = bundles.find((bundle) => bundle.id === "control-plane");
    expect(filesystem?.servers).not.toContain("ellmos-controlcenter-mcp");
    expect(controlPlane?.servers).toContain("ellmos-controlcenter-mcp");
  });

  it("loads capability bundles from a JSON config file", async () => {
    const root = await createTempDirectory("controlcenter-bundle-config-");
    const configPath = path.join(root, "bundles.json");
    await fs.writeFile(
      configPath,
      JSON.stringify({
        schemaVersion: 1,
        bundles: [
          {
            id: "research",
            title: "Research Tools",
            description: "Literatur, Paper und Quellenarbeit.",
            keywords: ["research", "paper", "zenodo"]
          }
        ]
      }),
      "utf-8"
    );

    const definitions = await loadBundleDefinitions(configPath);
    expect(definitions).toHaveLength(1);
    expect(definitions[0].id).toBe("research");

    const bundles = await loadCapabilityBundles([
      {
        directoryName: "paper-helper-mcp",
        packageName: "paper-helper-mcp",
        mcpName: "io.github.demo/paper-helper-mcp",
        version: "1.0.0",
        description: "Research and paper workflow helper",
        absolutePath: "C:/tmp/paper-helper-mcp",
        binName: "paper-helper",
        entryPoint: "dist/index.js",
        toolCount: 5,
        hasServerJson: true,
        keywords: ["zenodo"]
      }
    ], configPath);

    expect(bundles).toHaveLength(1);
    expect(bundles[0].servers).toEqual(["paper-helper-mcp"]);
    expect(suggestCapabilityBundles("Bitte Paper und Zenodo vorbereiten", bundles)[0].bundle.id).toBe("research");
  });

  it("reports duplicate capability bundle ids", async () => {
    const root = await createTempDirectory("controlcenter-bundle-config-");
    const configPath = path.join(root, "bundles.json");
    const duplicateBundle = {
      id: "dup",
      title: "Duplicate",
      description: "Duplicate bundle.",
      keywords: ["duplicate"]
    };
    await fs.writeFile(
      configPath,
      JSON.stringify({ bundles: [duplicateBundle, duplicateBundle] }),
      "utf-8"
    );

    await expect(loadBundleDefinitions(configPath)).rejects.toMatchObject({
      name: "BundleConfigError",
      code: "bundle-id-duplicate",
      details: {
        bundleId: "dup"
      }
    } satisfies Partial<BundleConfigError>);
  });
});

describe("policy helpers", () => {
  it("audits npx and env usage without exposing env values", () => {
    const findings = auditResolvedProfile({
      name: "software",
      profileRoot: "C:/tmp/profiles",
      sourceFiles: ["C:/tmp/profiles/software.json"],
      serverCount: 1,
      servers: ["github"],
      config: {
        mcpServers: {
          github: {
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-github"],
            env: {
              EXAMPLE_CREDENTIAL: "credential-value"
            }
          }
        }
      }
    });

    const serialized = JSON.stringify(findings);
    expect(findings.map((finding) => finding.ruleId)).toContain("npx-runtime-fetch");
    expect(findings.map((finding) => finding.ruleId)).toContain("env-secrets-present");
    expect(serialized).toContain("EXAMPLE_CREDENTIAL");
    expect(serialized).not.toContain("credential-value");
  });

  it("summarizes policy findings by severity", () => {
    const summary = summarizePolicyFindings([
      { severity: "warning", serverName: "a", ruleId: "one", message: "one", details: {} },
      { severity: "high", serverName: "b", ruleId: "two", message: "two", details: {} }
    ]);

    expect(summary.warning).toBe(1);
    expect(summary.high).toBe(1);
    expect(summary.info).toBe(0);
  });

  it("loads policy rule overrides and applies them during audit", async () => {
    const root = await createTempDirectory("controlcenter-policy-config-");
    const configPath = path.join(root, "policy.json");
    await fs.writeFile(
      configPath,
      JSON.stringify({
        schemaVersion: 1,
        rules: [
          { id: "npx-runtime-fetch", enabled: false },
          { id: "env-secrets-present", severity: "high" }
        ]
      }),
      "utf-8"
    );

    const policyRules = await loadPolicyRules(configPath);
    const findings = auditResolvedProfile({
      name: "software",
      profileRoot: "C:/tmp/profiles",
      sourceFiles: ["C:/tmp/profiles/software.json"],
      serverCount: 1,
      servers: ["github"],
      config: {
        mcpServers: {
          github: {
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-github"],
            env: {
              EXAMPLE_CREDENTIAL: "credential-value"
            }
          }
        }
      }
    }, policyRules);

    expect(findings.map((finding) => finding.ruleId)).not.toContain("npx-runtime-fetch");
    expect(findings).toContainEqual(expect.objectContaining({
      ruleId: "env-secrets-present",
      severity: "high"
    }));
  });

  it("reports duplicate policy rule ids", async () => {
    const root = await createTempDirectory("controlcenter-policy-config-");
    const configPath = path.join(root, "policy.json");
    await fs.writeFile(
      configPath,
      JSON.stringify({
        rules: [
          { id: "npx-runtime-fetch", enabled: true },
          { id: "npx-runtime-fetch", enabled: false }
        ]
      }),
      "utf-8"
    );

    await expect(loadPolicyRules(configPath)).rejects.toMatchObject({
      name: "PolicyConfigError",
      code: "policy-rule-duplicate",
      details: {
        ruleId: "npx-runtime-fetch"
      }
    } satisfies Partial<PolicyConfigError>);
  });
});
