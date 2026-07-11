import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildCapabilityBundles,
  buildBundleToolAssignments,
  BundleConfigError,
  loadBundleDefinitions,
  loadCapabilityBundles,
  suggestCapabilityBundles
} from "../src/bundles.js";
import {
  discoverLocalServerDirectories,
  extractToolCountFromDescription,
  createLocalServerMcpConfig,
  getDefaultMcpRoot,
  scanLocalServers
} from "../src/catalog.js";
import {
  extractExtendsProfiles,
  extractRemovedServerNames,
  extractServerNames,
  listMcpProfiles,
  prepareProfileSwitch,
  ProfileConfigError,
  readEditableProfile,
  resolveMcpProfile,
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
import {
  parseFrontmatter,
  parseInlineList,
  scanSkills,
  getDefaultSourceSkillsRoot,
  type SkillSummary
} from "../src/skills.js";
import { findSkills, scoreSkill, tokenize } from "../src/skillFinder.js";
import {
  scanInstalledPlugins,
  scanModules,
  scanPluginsAndModules,
  getDefaultModulesRoot
} from "../src/plugins.js";
import { getToolBundleOverview } from "../src/dashboard.js";
import {
  getLanguage,
  getLanguageName,
  getSupportedLanguages,
  setLanguage,
  t
} from "../src/i18n/index.js";
import {
  buildToolCatalog,
  createProfileToolCatalogTargets,
  filterServersForToolScan,
  normalizeToolScanTimeout,
  scanProfileServerTools
} from "../src/toolCatalog.js";

const tempDirectories: string[] = [];

afterEach(async () => {
  setLanguage("de");
  while (tempDirectories.length > 0) {
    const directory = tempDirectories.pop();
    if (directory) {
      await fs.rm(directory, { recursive: true, force: true });
    }
  }
});

describe("i18n helpers", () => {
  it("switches ControlCenter output text between German and English", () => {
    setLanguage("de");

    expect(getSupportedLanguages()).toEqual(["de", "en", "es", "zh", "ja", "ru"]);
    expect(getLanguage()).toBe("de");
    expect(t().common.noProfiles).toBe("Keine Claude-Profile gefunden.");

    setLanguage("en");

    expect(getLanguage()).toBe("en");
    expect(t().common.noProfiles).toBe("No Claude profiles found.");
    expect(suggestProfile("debug a TypeScript repository").rationale).toContain("Recommended because");
  });

  it("provides maintained text sets for every registered language", () => {
    const localizedLanguages = [
      {
        lang: "es",
        name: "Español",
        noProfiles: "No se encontraron perfiles de Claude.",
        rationaleFragment: "Recomendado porque"
      },
      {
        lang: "zh",
        name: "中文",
        noProfiles: "未找到 Claude 配置文件。",
        rationaleFragment: "推荐原因"
      },
      {
        lang: "ja",
        name: "日本語",
        noProfiles: "Claude プロファイルが見つかりません。",
        rationaleFragment: "推奨"
      },
      {
        lang: "ru",
        name: "Русский",
        noProfiles: "Профили Claude не найдены.",
        rationaleFragment: "Рекомендуется"
      }
    ] as const;

    for (const language of localizedLanguages) {
      setLanguage(language.lang);

      expect(getLanguageName(language.lang)).toBe(language.name);
      expect(t().language.note).not.toMatch(/fallback|English text set/i);
      expect(t().common.noProfiles).toBe(language.noProfiles);
      expect(t().common.noProfiles).not.toBe("No Claude profiles found.");
      expect(suggestProfile("debug a TypeScript repository").rationale).toContain(language.rationaleFragment);
    }
  });
});

async function createTempDirectory(prefix: string): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirectories.push(directory);
  return directory;
}

async function createFixtureMcpServer(serverDir: string): Promise<string> {
  await fs.mkdir(serverDir, { recursive: true });
  const serverPath = path.join(serverDir, "server.mjs");
  await fs.writeFile(
    serverPath,
    [
      "const tools = [{",
      "  name: 'fixture_echo',",
      "  title: 'Fixture Echo',",
      "  description: 'Echoes fixture input.',",
      "  inputSchema: { type: 'object', properties: { value: { type: 'string' } } },",
      "  annotations: { readOnlyHint: true }",
      "}];",
      "let buffer = '';",
      "function send(message) { process.stdout.write(JSON.stringify(message) + '\\n'); }",
      "process.stdin.setEncoding('utf8');",
      "process.stdin.on('data', (chunk) => {",
      "  buffer += chunk;",
      "  let newlineIndex;",
      "  while ((newlineIndex = buffer.indexOf('\\n')) !== -1) {",
      "    const line = buffer.slice(0, newlineIndex).trim();",
      "    buffer = buffer.slice(newlineIndex + 1);",
      "    if (!line) continue;",
      "    const message = JSON.parse(line);",
      "    if (message.method === 'initialize') {",
      "      send({",
      "        jsonrpc: '2.0',",
      "        id: message.id,",
      "        result: {",
      "          protocolVersion: '2025-06-18',",
      "          capabilities: { tools: { listChanged: false } },",
      "          serverInfo: { name: 'tool-fixture-mcp', version: '0.0.1' }",
      "        }",
      "      });",
      "    } else if (message.method === 'tools/list') {",
      "      send({ jsonrpc: '2.0', id: message.id, result: { tools } });",
      "    } else if (message.id) {",
      "      send({ jsonrpc: '2.0', id: message.id, result: {} });",
      "    }",
      "  }",
      "});"
    ].join("\n"),
    "utf-8"
  );
  return serverPath;
}

describe("catalog helpers", () => {
  it("derives the default MCP root from OneDrive or the current home directory", () => {
    const oneDriveRoot = path.join(os.tmpdir(), "controlcenter-onedrive-root");
    const homeDirectory = path.join(os.tmpdir(), "controlcenter-home-root");

    expect(getDefaultMcpRoot({ OneDrive: oneDriveRoot }, homeDirectory)).toBe(
      path.join(oneDriveRoot, ".TOPICS", ".AI", ".MCP")
    );
    expect(getDefaultMcpRoot({ ONEDRIVE: oneDriveRoot }, homeDirectory)).toBe(
      path.join(oneDriveRoot, ".TOPICS", ".AI", ".MCP")
    );
    expect(getDefaultMcpRoot({ OneDrive: "   " }, homeDirectory)).toBe(
      path.join(homeDirectory, "OneDrive", ".TOPICS", ".AI", ".MCP")
    );
    expect(getDefaultMcpRoot({}, homeDirectory)).toBe(
      path.join(homeDirectory, "OneDrive", ".TOPICS", ".AI", ".MCP")
    );
  });

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

describe("tool catalog helpers", () => {
  it("normalizes timeout limits for MCP tool probes", () => {
    expect(normalizeToolScanTimeout(undefined)).toBe(5000);
    expect(normalizeToolScanTimeout(100)).toBe(500);
    expect(normalizeToolScanTimeout(90000)).toBe(60000);
    expect(normalizeToolScanTimeout(2500.9)).toBe(2500);
  });

  it("filters servers by package, directory, mcpName, or bin name", () => {
    const servers = [
      {
        directoryName: "demo-server-mcp",
        packageName: "demo-server-mcp",
        mcpName: "io.github.demo/demo-server-mcp",
        version: "0.0.1",
        description: "Demo",
        absolutePath: "C:/tmp/demo-server-mcp",
        binName: "demo-server",
        entryPoint: "dist/index.js",
        toolCount: null,
        hasServerJson: true,
        keywords: []
      }
    ];

    expect(filterServersForToolScan(servers, "demo-server-mcp")).toHaveLength(1);
    expect(filterServersForToolScan(servers, "io.github.demo/demo-server-mcp")).toHaveLength(1);
    expect(filterServersForToolScan(servers, "demo-server")).toHaveLength(1);
    expect(filterServersForToolScan(servers, "missing")).toHaveLength(0);
  });

  it("reads real MCP tools through stdio list_tools", async () => {
    const root = await createTempDirectory("controlcenter-tool-root-");
    const serverDir = path.join(root, "tool-fixture-mcp");
    await createFixtureMcpServer(serverDir);
    await fs.writeFile(
      path.join(serverDir, "package.json"),
      JSON.stringify({
        name: "tool-fixture-mcp",
        version: "0.0.1",
        description: "A fixture MCP server",
        mcpName: "io.github.demo/tool-fixture-mcp",
        bin: {
          "tool-fixture": "server.mjs"
        }
      }),
      "utf-8"
    );

    const servers = await scanLocalServers(root);
    const toolCatalog = await buildToolCatalog(servers, { timeoutMs: 2000 });

    expect(toolCatalog).toHaveLength(1);
    expect(toolCatalog[0]).toMatchObject({
      packageName: "tool-fixture-mcp",
      status: "ok",
      toolCount: 1,
      error: null
    });
    expect(toolCatalog[0].tools[0]).toMatchObject({
      name: "fixture_echo",
      title: "Fixture Echo",
      description: "Echoes fixture input."
    });
  });

  it("reads profile-defined stdio tools without assuming a node repo layout", async () => {
    const root = await createTempDirectory("controlcenter-profile-tools-");
    const serverDir = path.join(root, "standalone-fixture");
    const serverPath = await createFixtureMcpServer(serverDir);
    const profileRoot = path.join(root, "profiles");
    await fs.mkdir(profileRoot, { recursive: true });
    await fs.writeFile(
      path.join(profileRoot, "base.json"),
      JSON.stringify({
        mcpServers: {
          standalone: {
            command: process.execPath,
            args: [serverPath],
            cwd: serverDir,
            env: {
              EXAMPLE_SECRET: "hidden"
            }
          }
        }
      }),
      "utf-8"
    );

    const toolCatalog = await scanProfileServerTools("base", profileRoot, { timeoutMs: 2000 });

    expect(toolCatalog).toHaveLength(1);
    expect(toolCatalog[0]).toMatchObject({
      source: "profile",
      profileName: "base",
      packageName: "standalone",
      transportKind: "stdio",
      status: "ok",
      toolCount: 1
    });
    expect(JSON.stringify(toolCatalog)).not.toContain("hidden");
  });

  it("detects remote and unsupported profile start forms without leaking URL secrets", () => {
    const targets = createProfileToolCatalogTargets({
      name: "remote",
      profileRoot: "C:/tmp/profiles",
      sourceFiles: ["C:/tmp/profiles/remote.json"],
      serverCount: 3,
      servers: ["http", "legacy-sse", "broken"],
      config: {
        mcpServers: {
          http: { url: "https://example.com/mcp?token=secret-value", transport: "streamable-http" },
          "legacy-sse": { url: "https://example.com/sse", transport: "sse" },
          broken: { args: ["--missing-command"] }
        }
      }
    });

    expect(targets.find((target) => target.packageName === "http")?.transportKind).toBe("streamable-http");
    expect(targets.find((target) => target.packageName === "legacy-sse")?.transportKind).toBe("sse");
    expect(targets.find((target) => target.packageName === "broken")?.transportKind).toBe("unsupported");
  });
});

describe("dashboard helpers", () => {
  it("returns tool catalog and bundle assignments for a selected profile", async () => {
    const root = await createTempDirectory("controlcenter-dashboard-tools-");
    const serverDir = path.join(root, "standalone-fixture");
    const serverPath = await createFixtureMcpServer(serverDir);
    const profileRoot = path.join(root, "profiles");
    await fs.mkdir(profileRoot, { recursive: true });
    await fs.writeFile(
      path.join(profileRoot, "base.json"),
      JSON.stringify({
        mcpServers: {
          fixture: {
            command: process.execPath,
            args: [serverPath],
            cwd: serverDir
          }
        }
      }),
      "utf-8"
    );

    const overview = await getToolBundleOverview({
      scope: "profile",
      profileName: "base",
      profileRoot,
      timeoutMs: 2000
    });

    expect(overview.scope).toBe("profile");
    expect(overview.serverCount).toBe(1);
    expect(overview.totalTools).toBe(1);
    expect(overview.toolCatalog[0].tools[0].name).toBe("fixture_echo");
    expect(overview.assignments.some((assignment) => assignment.toolCount > 0)).toBe(true);
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

    const profiles = await listMcpProfiles(root);
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

    const resolved = await resolveMcpProfile("software", root);
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

    const resolved = await resolveMcpProfile("ai-lab", root);

    expect(resolved.servers).toEqual(["n8n", "ollama", "shared"]);
    expect(resolved.config.mcpServers.github).toBeUndefined();
    expect(resolved.sourceFiles.map((file) => path.basename(file))).toEqual(["ai-lab.json", "base.json", "automation.json"]);
  });

  it("reports missing profiles with a user-facing path", async () => {
    const root = await createTempDirectory("controlcenter-profile-root-");

    await expect(resolveMcpProfile("missing", root)).rejects.toMatchObject({
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

    await expect(resolveMcpProfile("broken", root)).rejects.toMatchObject({
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

    await expect(resolveMcpProfile("a", root)).rejects.toMatchObject({
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

  it("supports custom launch templates for generated mcp config files", async () => {
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
      launchTemplate: "codex mcp run --config {config}"
    });

    expect(plan.command).toContain("codex mcp run --config");
    expect(plan.command).toContain(outputPath.includes(" ") ? `"${outputPath}"` : outputPath);
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

  it("assigns real tool metadata to capability bundles", () => {
    const assignments = buildBundleToolAssignments([
      {
        source: "profile",
        profileName: "base",
        directoryName: "base/files",
        packageName: "files",
        mcpName: null,
        status: "ok",
        transportKind: "stdio",
        command: "node",
        args: [],
        url: null,
        durationMs: 1,
        toolCount: 2,
        error: null,
        tools: [
          {
            name: "read_file",
            title: "Read File",
            description: "Read a file from the local filesystem.",
            inputSchema: { type: "object" },
            annotations: null
          },
          {
            name: "run_workflow",
            title: "Run Workflow",
            description: "Trigger an automation workflow.",
            inputSchema: { type: "object" },
            annotations: null
          }
        ]
      }
    ]);

    const filesystem = assignments.find((assignment) => assignment.bundleId === "filesystem");
    const automation = assignments.find((assignment) => assignment.bundleId === "automation");
    expect(filesystem?.tools.map((tool) => tool.toolName)).toContain("read_file");
    expect(automation?.tools.map((tool) => tool.toolName)).toContain("run_workflow");
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

// ──────────────────────────────────────────────────────────────────────────────
// skills helpers
// ──────────────────────────────────────────────────────────────────────────────

describe("skills helpers", () => {
  it("parses simple key-value frontmatter", () => {
    const md = `---
name: brainstorm
version: 1.2.0
description: A brainstorming skill
type: skill
category: utilities
status: active
---
# Content here
`;
    const fm = parseFrontmatter(md);
    expect(fm["name"]).toBe("brainstorm");
    expect(fm["version"]).toBe("1.2.0");
    expect(fm["description"]).toBe("A brainstorming skill");
    expect(fm["type"]).toBe("skill");
    expect(fm["category"]).toBe("utilities");
    expect(fm["status"]).toBe("active");
  });

  it("parses folded scalar (>) in frontmatter without crashing", () => {
    const md = `---
name: think
version: 2.0.0
description: >
  Strukturierte Methoden fuer
  kritisches Denken
status: active
---
`;
    const fm = parseFrontmatter(md);
    expect(fm["name"]).toBe("think");
    expect(fm["description"]).toContain("Strukturierte");
    expect(fm["status"]).toBe("active");
  });

  it("returns empty record for content without frontmatter", () => {
    const fm = parseFrontmatter("# Just a heading\nNo frontmatter here.");
    expect(Object.keys(fm)).toHaveLength(0);
  });

  it("returns empty record for unclosed frontmatter", () => {
    const fm = parseFrontmatter("---\nname: broken\n# no closing dashes");
    expect(Object.keys(fm)).toHaveLength(0);
  });

  it("scans deployed skills and returns entries with deployed=true", async () => {
    const root = await createTempDirectory("controlcenter-skills-deployed-");
    // Create a skill directory with SKILL.md
    const skillDir = path.join(root, "my-skill");
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(
      path.join(skillDir, "SKILL.md"),
      `---\nname: my-skill\nversion: 1.0.0\ndescription: Test skill\nstatus: active\n---\n# My Skill\n`,
      "utf-8"
    );
    // Create a directory WITHOUT SKILL.md
    const noSkillMdDir = path.join(root, "content-only");
    await fs.mkdir(noSkillMdDir, { recursive: true });
    await fs.writeFile(path.join(noSkillMdDir, "CONTENT.md"), "content", "utf-8");

    const skills = await scanSkills(root, "");
    const found = skills.find((s) => s.name === "my-skill");
    const noMd = skills.find((s) => s.name === "content-only");

    expect(found).toBeDefined();
    expect(found?.deployed).toBe(true);
    expect(found?.version).toBe("1.0.0");
    expect(found?.hasSkillMd).toBe(true);

    expect(noMd).toBeDefined();
    expect(noMd?.hasSkillMd).toBe(false);
    expect(noMd?.deployed).toBe(true);
  });

  it("returns empty array when deployed skills root does not exist", async () => {
    const root = await createTempDirectory("controlcenter-skills-empty-");
    const missing = path.join(root, "nonexistent");
    const skills = await scanSkills(missing, "");
    expect(skills).toEqual([]);
  });

  it("merges deployed and source skills, deployed takes precedence", async () => {
    const deployedRoot = await createTempDirectory("controlcenter-skills-dep-");
    const sourceRoot = await createTempDirectory("controlcenter-skills-src-");

    // Deployed skill
    const depSkill = path.join(deployedRoot, "shared-skill");
    await fs.mkdir(depSkill, { recursive: true });
    await fs.writeFile(path.join(depSkill, "SKILL.md"), "---\nname: shared-skill\nversion: 2.0.0\n---\n", "utf-8");

    // Source-only skill
    const srcCategory = path.join(sourceRoot, "utilities");
    await fs.mkdir(srcCategory, { recursive: true });
    const srcSkill = path.join(srcCategory, "source-only-skill");
    await fs.mkdir(srcSkill, { recursive: true });
    await fs.writeFile(path.join(srcSkill, "SKILL.md"), "---\nname: source-only-skill\nversion: 1.0.0\n---\n", "utf-8");

    // Source has same name as deployed (should NOT appear twice)
    const srcDup = path.join(srcCategory, "shared-skill");
    await fs.mkdir(srcDup, { recursive: true });
    await fs.writeFile(path.join(srcDup, "SKILL.md"), "---\nname: shared-skill\nversion: 1.0.0\n---\n", "utf-8");

    const skills = await scanSkills(deployedRoot, sourceRoot);
    const sharedEntries = skills.filter((s) => s.name === "shared-skill");
    const sourceOnly = skills.find((s) => s.name === "source-only-skill");

    // Deployed wins — only one entry
    expect(sharedEntries).toHaveLength(1);
    expect(sharedEntries[0].deployed).toBe(true);

    // Source-only is present with deployed=false
    expect(sourceOnly).toBeDefined();
    expect(sourceOnly?.deployed).toBe(false);
  });

  it("resolves default source skills root from OneDrive env", () => {
    const fakeEnv = { OneDrive: "C:\\Users\\TestUser\\OneDrive" };
    const result = getDefaultSourceSkillsRoot(fakeEnv, "C:\\Users\\TestUser");
    expect(result).toContain(".AI");
    expect(result).toContain(".SKILLS");
    expect(result).toContain("skills");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// plugins helpers
// ──────────────────────────────────────────────────────────────────────────────

function makeSkill(partial: Partial<SkillSummary> & { name: string }): SkillSummary {
  return {
    name: partial.name,
    description: partial.description ?? "",
    version: partial.version ?? null,
    type: partial.type ?? null,
    category: partial.category ?? null,
    status: partial.status ?? null,
    tags: partial.tags ?? [],
    aliases: partial.aliases ?? [],
    absolutePath: partial.absolutePath ?? `/skills/${partial.name}`,
    deployed: partial.deployed ?? false,
    hasSkillMd: partial.hasSkillMd ?? true
  };
}

describe("skill finder", () => {
  it("parses inline YAML lists for tags and aliases", () => {
    expect(parseInlineList("[mcp, skills, sync]")).toEqual(["mcp", "skills", "sync"]);
    expect(parseInlineList("alpha, beta")).toEqual(["alpha", "beta"]);
    expect(parseInlineList('["a", "b"]')).toEqual(["a", "b"]);
    expect(parseInlineList(undefined)).toEqual([]);
    expect(parseInlineList("")).toEqual([]);
  });

  it("tokenizes and drops stopwords", () => {
    const tokens = tokenize("Please help me sync the MCP servers");
    expect(tokens).toContain("sync");
    expect(tokens).toContain("mcp");
    expect(tokens).toContain("servers");
    expect(tokens).not.toContain("the");
    expect(tokens).not.toContain("me");
  });

  it("ranks skills by lexical relevance and reports matched terms", () => {
    const skills = [
      makeSkill({ name: "mcp-config-sync", description: "Synchronisiert MCP-Server zwischen Claude Code und Claude Desktop", tags: ["mcp", "sync"] }),
      makeSkill({ name: "brainstorm", description: "Kreativitaetsmethoden fuer Ideenfindung", tags: ["ideas"] }),
      makeSkill({ name: "agents-bridge", description: "Bridge fuer fremde Agent-Tools", tags: ["multi-agent"] })
    ];
    const matches = findSkills("mcp server sync", skills);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].skill.name).toBe("mcp-config-sync");
    expect(matches[0].matchedTerms).toContain("sync");
    expect(matches.find((m) => m.skill.name === "brainstorm")).toBeUndefined();
  });

  it("weights name above description", () => {
    const named = makeSkill({ name: "deploy-tool", description: "unrelated text" });
    const described = makeSkill({ name: "other", description: "this helps you deploy things" });
    const namedScore = scoreSkill(tokenize("deploy"), named).score;
    const describedScore = scoreSkill(tokenize("deploy"), described).score;
    expect(namedScore).toBeGreaterThan(describedScore);
  });

  it("respects the limit and returns [] for no match or empty intent", () => {
    const skills = Array.from({ length: 10 }, (_, i) => makeSkill({ name: `skill-${i}`, tags: ["common"] }));
    expect(findSkills("common", skills, 3)).toHaveLength(3);
    expect(findSkills("zzznomatch", skills)).toEqual([]);
    expect(findSkills("   ", skills)).toEqual([]);
  });
});

describe("plugins helpers", () => {
  it("returns empty array when installed_plugins.json is missing", async () => {
    const root = await createTempDirectory("controlcenter-plugins-empty-");
    const plugins = await scanInstalledPlugins(root);
    expect(plugins).toEqual([]);
  });

  it("parses installed_plugins.json and returns plugin summaries", async () => {
    const root = await createTempDirectory("controlcenter-plugins-registry-");
    const cacheDir = path.join(root, "cache", "my-marketplace", "my-plugin", "1.0.0");
    await fs.mkdir(cacheDir, { recursive: true });
    // Add a skills subdirectory to signal hasSkills
    await fs.mkdir(path.join(cacheDir, "skills"), { recursive: true });

    const registry = {
      version: 2,
      plugins: {
        "my-plugin@my-marketplace": [
          {
            scope: "user",
            installPath: cacheDir,
            version: "1.0.0",
            installedAt: "2026-01-01T00:00:00.000Z",
            lastUpdated: "2026-06-01T00:00:00.000Z"
          }
        ]
      }
    };
    await fs.writeFile(path.join(root, "installed_plugins.json"), JSON.stringify(registry), "utf-8");

    const plugins = await scanInstalledPlugins(root);
    expect(plugins).toHaveLength(1);
    expect(plugins[0].name).toBe("my-plugin");
    expect(plugins[0].marketplace).toBe("my-marketplace");
    expect(plugins[0].type).toBe("plugin");
    expect(plugins[0].version).toBe("1.0.0");
    expect(plugins[0].hasSkills).toBe(true);
    expect(plugins[0].hasCommands).toBe(false);
  });

  it("handles plugin with unknown version gracefully", async () => {
    const root = await createTempDirectory("controlcenter-plugins-unknown-");
    const registry = {
      version: 2,
      plugins: {
        "feature-dev@claude-plugins-official": [
          {
            scope: "user",
            installPath: path.join(root, "cache", "claude-plugins-official", "feature-dev", "unknown"),
            version: "unknown",
            installedAt: "2026-04-23T22:48:18.418Z"
          }
        ]
      }
    };
    await fs.writeFile(path.join(root, "installed_plugins.json"), JSON.stringify(registry), "utf-8");

    const plugins = await scanInstalledPlugins(root);
    expect(plugins[0].version).toBe("unknown");
    expect(plugins[0].name).toBe("feature-dev");
    expect(plugins[0].hasMcp).toBe(false);
    expect(plugins[0].hasSkills).toBe(false);
  });

  it("scans local modules from modules root", async () => {
    const root = await createTempDirectory("controlcenter-modules-");
    // Module with ellmos-module.json
    const modDir = path.join(root, "my-module");
    await fs.mkdir(modDir, { recursive: true });
    await fs.writeFile(
      path.join(modDir, "ellmos-module.json"),
      JSON.stringify({ name: "my-module", version: "3.1.0" }),
      "utf-8"
    );
    // Add server.json to signal hasMcp
    await fs.writeFile(path.join(modDir, "server.json"), "{}", "utf-8");

    const modules = await scanModules(root);
    expect(modules).toHaveLength(1);
    expect(modules[0].name).toBe("my-module");
    expect(modules[0].type).toBe("module");
    expect(modules[0].version).toBe("3.1.0");
    expect(modules[0].hasMcp).toBe(true);
  });

  it("prefers the v2 catalog and discovers modules inside category directories", async () => {
    const root = await createTempDirectory("controlcenter-modules-v2-");
    const modDir = path.join(root, ".MEMORY", "catalog-module");
    await fs.mkdir(modDir, { recursive: true });
    await fs.writeFile(
      path.join(modDir, "ellmos-module.v2.json"),
      JSON.stringify({ id: "catalog-module", version: "4.0.0" }),
      "utf-8"
    );
    await fs.writeFile(
      path.join(root, "modules.catalog.json"),
      JSON.stringify({
        schema: "ellmos.modules-catalog.v1",
        modules: [{
          id: "catalog-module",
          category: "memory",
          version: "4.0.0",
          resolved_source: ".MEMORY/catalog-module",
          surfaces: ["skill"]
        }]
      }),
      "utf-8"
    );

    const modules = await scanModules(root);
    expect(modules).toHaveLength(1);
    expect(modules[0]).toMatchObject({
      name: "catalog-module",
      version: "4.0.0",
      scope: "memory",
      absolutePath: modDir,
      hasSkills: true
    });
  });

  it("keeps the flat directory scan as fallback for an invalid catalog", async () => {
    const root = await createTempDirectory("controlcenter-modules-fallback-");
    const modDir = path.join(root, "legacy-module");
    await fs.mkdir(modDir, { recursive: true });
    await fs.writeFile(path.join(root, "modules.catalog.json"), "{}", "utf-8");
    await fs.writeFile(
      path.join(modDir, "ellmos-module.json"),
      JSON.stringify({ name: "legacy-module", version: "1.0.0" }),
      "utf-8"
    );

    const modules = await scanModules(root);
    expect(modules).toHaveLength(1);
    expect(modules[0].name).toBe("legacy-module");
  });

  it("falls back to package.json for module version", async () => {
    const root = await createTempDirectory("controlcenter-modules-pkgjson-");
    const modDir = path.join(root, "pkg-module");
    await fs.mkdir(modDir, { recursive: true });
    await fs.writeFile(
      path.join(modDir, "package.json"),
      JSON.stringify({ name: "pkg-module", version: "2.5.0" }),
      "utf-8"
    );

    const modules = await scanModules(root);
    expect(modules[0].version).toBe("2.5.0");
  });

  it("returns empty array when modules root does not exist", async () => {
    const root = await createTempDirectory("controlcenter-modules-missing-");
    const missing = path.join(root, "nonexistent");
    const modules = await scanModules(missing);
    expect(modules).toEqual([]);
  });

  it("combines plugins and modules in scanPluginsAndModules", async () => {
    const pluginsRoot = await createTempDirectory("controlcenter-combined-plugins-");
    const modulesRoot = await createTempDirectory("controlcenter-combined-modules-");

    // Registry with one plugin
    const registry = {
      version: 2,
      plugins: { "combo-plugin@official": [{ scope: "user", version: "1.0.0" }] }
    };
    await fs.writeFile(path.join(pluginsRoot, "installed_plugins.json"), JSON.stringify(registry), "utf-8");

    // One module
    const modDir = path.join(modulesRoot, "combo-module");
    await fs.mkdir(modDir, { recursive: true });
    await fs.writeFile(path.join(modDir, "ellmos-module.json"), JSON.stringify({ name: "combo-module", version: "1.0.0" }), "utf-8");

    const all = await scanPluginsAndModules(pluginsRoot, modulesRoot);
    expect(all.some((p) => p.type === "plugin" && p.name === "combo-plugin")).toBe(true);
    expect(all.some((p) => p.type === "module" && p.name === "combo-module")).toBe(true);
  });

  it("resolves default modules root from OneDrive env", () => {
    const fakeEnv = { OneDrive: "C:\\Users\\TestUser\\OneDrive" };
    const result = getDefaultModulesRoot(fakeEnv, "C:\\Users\\TestUser");
    expect(result).toContain(".AI");
    expect(result).toContain(".MODULES");
  });
});
