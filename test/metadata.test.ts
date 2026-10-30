import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { execFileSync } from "child_process";

describe("metadata & manifest parity", () => {
  const root = path.resolve(__dirname, "..");
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf-8"));
  const packageLock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf-8"));
  const serverJson = JSON.parse(fs.readFileSync(path.join(root, "server.json"), "utf-8"));
  const glamaJson = JSON.parse(fs.readFileSync(path.join(root, "glama.json"), "utf-8"));
  const llmsTxt = fs.readFileSync(path.join(root, "llms.txt"), "utf-8");
  const readmeEn = fs.readFileSync(path.join(root, "README.md"), "utf-8");
  const readmeDe = fs.readFileSync(path.join(root, "README_de.md"), "utf-8");
  const indexTs = fs.readFileSync(path.join(root, "src", "index.ts"), "utf-8");
  const securityMd = fs.readFileSync(path.join(root, "SECURITY.md"), "utf-8");
  const license = fs.readFileSync(path.join(root, "LICENSE"), "utf-8");
  const notice = fs.readFileSync(path.join(root, "NOTICE"), "utf-8");
  const ciYml = fs.readFileSync(path.join(root, ".github", "workflows", "ci.yml"), "utf-8");
  const welcomeYml = fs.readFileSync(path.join(root, ".github", "workflows", "welcome.yml"), "utf-8");
  const staleYml = fs.readFileSync(path.join(root, ".github", "workflows", "stale.yml"), "utf-8");
  const autoAssignYml = fs.readFileSync(path.join(root, ".github", "workflows", "auto-assign.yml"), "utf-8");
  const labelSyncYml = fs.readFileSync(path.join(root, ".github", "workflows", "label-sync.yml"), "utf-8");
  const labelsYml = fs.readFileSync(path.join(root, ".github", "labels.yml"), "utf-8");
  const contributingMd = fs.readFileSync(path.join(root, "CONTRIBUTING.md"), "utf-8");
  const gitignore = fs.readFileSync(path.join(root, ".gitignore"), "utf-8");

  it("ensures version parity across package.json, package-lock.json, server.json, and glama.json", () => {
    expect(packageJson.version).toBe("0.7.4");
    expect(packageLock.version).toBe(packageJson.version);
    expect(packageLock.packages[""].version).toBe(packageJson.version);
    expect(packageJson.version).toBe(serverJson.version);
    expect(packageJson.version).toBe(glamaJson.version);
    expect(serverJson.packages[0].version).toBe(packageJson.version);
    expect(packageJson.engines.node).toBe(">=20.0.0");
    expect(readmeEn).toContain("node-%3E%3D20-brightgreen.svg");
    expect(readmeDe).toContain("node-%3E%3D20-brightgreen.svg");
    expect(llmsTxt).toContain("Runtime: Node.js >=20");
  });

  it("ensures tool count matches across index.ts, glama.json, and llms.txt", () => {
    const toolMatches = indexTs.match(/server\.registerTool\(\s*["']([^"']+)["']/g) || [];
    const toolNames = toolMatches.map((m) => {
      const exec = /server\.registerTool\(\s*["']([^"']+)["']/.exec(m);
      return exec ? exec[1] : "";
    }).filter(Boolean);

    expect(toolNames.length).toBe(34);
    expect(glamaJson.tools.count).toBe(toolNames.length);

    for (const name of toolNames) {
      expect(llmsTxt).toContain(name);
      expect(readmeEn).toContain(`\`${name}\``);
      expect(readmeDe).toContain(`\`${name}\``);
    }
  });

  it("ensures llms.txt contains required metadata and ecosystem links", () => {
    // Format instead of literals: refreshing the stamp or adding a test must not turn the
    // suite red -- that is what the freshness stamp and the test badge are for.
    expect(llmsTxt).toMatch(/Last-checked: \d{4}-\d{2}-\d{2}/);
    expect(llmsTxt).toMatch(/Test status: (\d+)\/\1 Vitest tests passing \(100% green\)/);
    expect(llmsTxt).toContain("io.github.ellmos-ai/ellmos-controlcenter-mcp");
    expect(llmsTxt).toContain("https://github.com/ellmos-ai/ellmos-controlcenter-mcp");
    expect(llmsTxt).toContain("License: MIT");
    expect(llmsTxt).toContain("Attribution: NOTICE");
    expect(llmsTxt).toContain("THIRD_PARTY_LICENSES.txt");
  });

  it("ensures license parity across package.json, glama.json, LICENSE, and llms.txt", () => {
    expect(packageJson.license).toBe("MIT");
    expect(glamaJson.license).toBe("MIT");
    expect(license).toContain("MIT License");
    expect(llmsTxt).toContain("License: MIT");
  });

  it("ensures README.md and README_de.md contain badges, platforms, and security indicators", () => {
    const badges = [
      "Ecosystem-ellmos--ai-blue.svg",
      "Umbrella-open--bricks-blueviolet.svg",
      "LLM--Ready-llms.txt-success.svg",
      "Level%201%20SBOM",
      "Attribution-NOTICE-blue.svg",
      "MCP%20Tools-34-blue.svg",
      "Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg",
      "Privacy-Local--First%20%7C%20Explicit%20HTTPS-success.svg",
      "Security-Local--First%20%7C%20Policy--Gated-blue.svg",
      "Security%20SLA-48h%20SLA-blue.svg",
      "actions/workflows/ci.yml/badge.svg",
    ];

    for (const badge of badges) {
      expect(readmeEn).toContain(badge);
      expect(readmeDe).toContain(badge);
    }

    // Shape, not value: the test count and the verification date are checked for
    // cross-surface consistency in their own cases, so refreshing them stays possible.
    for (const readme of [readmeEn, readmeDe]) {
      expect(readme).toMatch(/Vitest-\d+%20passed-brightgreen\.svg/);
      expect(readme).toMatch(/verified-\d{4}--\d{2}--\d{2}-blue\.svg/);
    }

    expect(readmeEn).toContain("README_de.md");
    expect(readmeDe).toContain("README.md");
  });

  it("ensures quick navigation and sequence diagrams exist in both READMEs", () => {
    expect(readmeEn).toContain("### Quick Navigation");
    expect(readmeEn).toContain("## Control Plane & Gateway Lifecycle");
    expect(readmeEn).toContain("sequenceDiagram");

    expect(readmeDe).toContain("### Schnellnavigation");
    expect(readmeDe).toContain("## Control Plane & Gateway-Lebenszyklus");
    expect(readmeDe).toContain("sequenceDiagram");
  });

  it("ensures core required documents exist", () => {
    const required = [
      "README.md",
      "README_de.md",
      "SECURITY.md",
      "LICENSE",
      "NOTICE",
      "llms.txt",
      "CHANGELOG.md",
      "server.json",
      "glama.json",
      "CONTRIBUTING.md",
      "THIRD_PARTY_LICENSES.md",
      "THIRD_PARTY_LICENSES.txt",
    ];
    for (const file of required) {
      expect(fs.existsSync(path.join(root, file))).toBe(true);
    }
  });

  it("ensures SECURITY.md is bilingual and documents key safety boundaries, zero-egress, and contacts", () => {
    expect(securityMd).toContain("# Security Policy / Sicherheitsrichtlinie");
    expect(securityMd).toContain("## English");
    expect(securityMd).toContain("## Deutsch");
    expect(securityMd).toContain("Zero-Egress & Local-First Guarantees");
    expect(securityMd).toContain("Non-Elevation (User-Mode Only)");
    expect(securityMd).toContain("Gateway Safety Model & Eigendark Invariants");
    expect(securityMd).toContain("controlcenter_invoke");
    expect(securityMd).toContain("gateway-audit.jsonl");
    expect(securityMd).toContain("security@open-bricks.org");
    expect(securityMd).toContain("security@ellmos.ai");
    expect(securityMd).toContain("support@lukasgeiger.com");
    expect(securityMd).toContain("lukas@open-bricks.org");
    expect(securityMd).toContain("https://github.com/ellmos-ai/ellmos-controlcenter-mcp/issues");
    expect(securityMd).toContain("https://github.com/ellmos-ai/ellmos-controlcenter-mcp/security/advisories");
  });

  it("ensures SECURITY.md documents SLAs, umbrella contact, and supported versions", () => {
    expect(securityMd).toContain("48 hours");
    expect(securityMd).toContain("48 Stunden");
    expect(securityMd).toContain("5 business days");
    expect(securityMd).toContain("5 Werktagen");
    expect(securityMd).toContain("Supported Versions");
    expect(securityMd).toContain("Unterstützte Versionen");
    expect(securityMd).toContain("0.7.x");
  });

  it("ensures CI workflow is properly configured with multi-OS and Node.js matrix strategy", () => {
    expect(ciYml).toContain("actions/checkout@v4");
    expect(ciYml).toContain("actions/setup-node@v4");
    expect(ciYml).toContain("os: [ubuntu-latest, windows-latest, macos-latest]");
    expect(ciYml).toContain("node-version: [20.x, 22.x, 24.x]");
    expect(ciYml).toContain("npm run test");
    expect(ciYml).toContain("npm run build");
  });

  it("ensures CI workflow includes concurrency control, packaging verification, and timeout guardrails", () => {
    expect(ciYml).toContain("concurrency:");
    expect(ciYml).toContain("cancel-in-progress: true");
    expect(ciYml).toContain("timeout-minutes: 15");
    expect(ciYml).toContain("npm pack --dry-run");
  });

  it("ensures welcome.yml and stale.yml CI lifecycle workflows are properly configured", () => {
    expect(welcomeYml).toContain("actions/first-interaction@v3");
    expect(welcomeYml).toContain("timeout-minutes: 5");
    expect(welcomeYml).toContain("cancel-in-progress: true");
    expect(welcomeYml).toContain("issues: write");
    expect(welcomeYml).toContain("pull-requests: write");

    expect(staleYml).toContain("actions/stale@v9");
    expect(staleYml).toContain("cron: '30 1 * * *'");
    expect(staleYml).toContain("timeout-minutes: 10");
    expect(staleYml).toContain("cancel-in-progress: true");
    expect(staleYml).toContain("issues: write");
    expect(staleYml).toContain("pull-requests: write");
  });

  it("ensures .gitignore is hardened against multi-host conflict files, canonical locks, and cache artifacts", () => {
    expect(gitignore).toContain("*.sync-conflict-*");
    expect(gitignore).toContain("*-CONFLIT-*");
    expect(gitignore).toContain("* (kopie)*");
    expect(gitignore).toContain("*-ASUS*");
    expect(gitignore).toContain("*-LAPTOP*");
    expect(gitignore).toContain("*-Mac Studio*");
    expect(gitignore).toContain("*-MacBook*");
    expect(gitignore).toContain("*-IDEAPAD*");
    expect(gitignore).toContain("*-WORKSTATION*");
    expect(gitignore).toContain("*-WORKSTATION-LG*");
    expect(gitignore).toContain("LOCK");
    expect(gitignore).toContain("LOCK.*");
    expect(gitignore).toContain("LOCK.user.*");
    expect(gitignore).toContain("LOCK.until.*");
    expect(gitignore).toContain("LOCK.condition.*");
    expect(gitignore).toContain(".automation-lock");
    expect(gitignore).toContain("uv.lock");
    expect(gitignore).toContain("!package-lock.json");
    expect(gitignore).toContain(".pytest_cache/");
    expect(gitignore).toContain(".pytest_temp/");
    expect(gitignore).toContain(".coverage");
    expect(gitignore).toContain(".coverage.*");
    expect(gitignore).toContain(".nyc_output/");
    expect(gitignore).toContain(".turbo/");
    expect(gitignore).toContain("build/");
    expect(gitignore).toContain("*.rej");
  });

  it("ensures sibling ecosystem partner matrix exists in both READMEs", () => {
    const siblingTokens = [
      "ellmos-filecommander-mcp",
      "ellmos-codecommander-mcp",
      "n8n-manager-mcp",
      "BACH",
      "open-bricks",
      "dev-bricks",
      "doc-bricks",
      "file-bricks",
    ];
    for (const token of siblingTokens) {
      expect(readmeEn).toContain(token);
      expect(readmeDe).toContain(token);
    }
  });

  it("keeps the sibling tool counts identical in both READMEs and sourced from one map", () => {
    // Counted against each sibling repository's own statement on 2026-10-18
    // (README badge, prose, diagram label or registered tool names in its source).
    const SIBLING_TOOL_COUNTS: Record<string, number> = {
      "ellmos-filecommander-mcp": 50,
      "ellmos-codecommander-mcp": 23,
      "ellmos-clatcher-mcp": 12,
      "n8n-manager-mcp": 19,
      "ellmos-controlcenter-mcp": 34,
      "ellmos-homebase-mcp": 51,
      "ellmos-servercommander-mcp": 8,
      "ellmos-blender-use-mcp": 4,
      "open-compute-mcp": 19,
    };
    for (const [repo, count] of Object.entries(SIBLING_TOOL_COUNTS)) {
      for (const readme of [readmeEn, readmeDe]) {
        const row = readme
          .split("\n")
          .find((line) => line.startsWith("|") && line.includes(`/${repo})`));
        expect(row, repo).toBeTruthy();
        expect(row as string, repo).toMatch(new RegExp(`\\|\\s*\\*{0,2}${count}\\*{0,2}\\s*\\|`));
      }
    }
  });

  it("keeps private or non-existent repositories out of the ecosystem tables", () => {
    // Measured on 2026-10-18: automation-master and workflowhooker-provenance are private;
    // file-bricks/lock-master and open-bricks/DokuZen do not exist; ProFiler lives under
    // file-bricks and build-your-users-mind under ellmos-ai. Each link was a reader-facing 404.
    const unreachable = [
      "dev-bricks/automation-master",
      "ellmos-ai/workflowhooker-provenance",
      "file-bricks/lock-master",
      "open-bricks/DokuZen",
      "open-bricks/ProFiler",
      "research-line/build-your-users-mind",
    ];
    for (const target of unreachable) {
      expect(readmeEn, target).not.toContain(`github.com/${target}`);
      expect(readmeDe, target).not.toContain(`github.com/${target}`);
      expect(llmsTxt, target).not.toContain(`github.com/${target}`);
    }
  });

  it("ensures key gateway hardening controls are documented in both READMEs", () => {
    const hardeningControls = [
      "Recursive redaction",
      "Request budget",
      "Response budget",
      "Transport",
      "Untrusted marking",
    ];
    for (const control of hardeningControls) {
      expect(readmeEn).toContain(control);
    }
  });

  it("ensures runtime package dependencies remain lean without an automatic update client", () => {
    const deps = Object.keys(packageJson.dependencies || {});
    expect(deps).toEqual(["@modelcontextprotocol/sdk", "zod"]);
    expect(indexTs).not.toContain("update-notifier");
    expect(indexTs).not.toContain("updateNotifier");
  });

  it("ensures READMEs and llms.txt contain Governance & Runtime Invariants (INV-LOCAL-01 to INV-SLA-10)", () => {
    const invariants = [
      "INV-LOCAL-01",
      "INV-GATE-02",
      "INV-SUB-03",
      "INV-SCRUB-04",
      "INV-PRIV-05",
      "INV-LOCK-06",
      "INV-PERM-07",
      "INV-GOV-08",
      "INV-SYNC-09",
      "INV-SLA-10",
    ];
    for (const inv of invariants) {
      expect(readmeEn).toContain(inv);
      expect(readmeDe).toContain(inv);
      expect(llmsTxt).toContain(inv);
    }
  });

  it("keeps egress and redaction claims within the implemented gateway boundary", () => {
    for (const document of [readmeEn, readmeDe, llmsTxt]) {
      expect(document).toContain("INV-LOCAL-01");
      expect(document).toContain("HTTPS");
      expect(document).not.toContain("100% Local-First & Zero-Egress");
    }
    expect(readmeEn).toContain("key-based wiping applies only to structured metadata");
    expect(readmeDe).toContain("Key-basiertes Entfernen gilt nur für strukturierte Metadaten");
  });

  it("ensures quick navigation has 18 anchors with 100% conceptual parity between README.md and README_de.md", () => {
    const enQuickNav = readmeEn.split("### Quick Navigation")[1]?.split("---")[0]?.trim() || "";
    const deQuickNav = readmeDe.split("### Schnellnavigation")[1]?.split("---")[0]?.trim() || "";

    const enAnchors = (enQuickNav.match(/\[([^\]]+)\]\(([^)]+)\)/g) || []);
    const deAnchors = (deQuickNav.match(/\[([^\]]+)\]\(([^)]+)\)/g) || []);

    expect(enAnchors.length).toBe(18);
    expect(deAnchors.length).toBe(18);

    expect(enQuickNav).toContain("#installation");
    expect(deQuickNav).toContain("#installation");
    expect(enQuickNav).toContain("#target-personas--discoverability");
    expect(deQuickNav).toContain("#zielgruppen--auffindbarkeit");
    expect(enQuickNav).toContain("#comparative-matrix-vs-alternatives");
    expect(deQuickNav).toContain("#vergleichsmatrix-gegenueber-alternativen");
    expect(enQuickNav).toContain("#system-architecture");
    expect(deQuickNav).toContain("#systemarchitektur");
    expect(enQuickNav).toContain("#governance--runtime-invariants");
    expect(deQuickNav).toContain("#governance--und-laufzeit-invarianten");
    expect(enQuickNav).toContain("#third-party-licenses--transparency");
    expect(deQuickNav).toContain("#drittanbieter-lizenzen--transparenz");
    expect(enQuickNav).toContain("SECURITY.md");
    expect(deQuickNav).toContain("SECURITY.md");
    expect(enQuickNav).toContain("llms.txt");
    expect(deQuickNav).toContain("llms.txt");
  });

  it("ensures Target Personas & Discoverability section is present in both READMEs with 4 core archetypes", () => {
    expect(readmeEn).toContain("## Target Personas & Discoverability");
    expect(readmeDe).toContain("## Zielgruppen & Auffindbarkeit");

    const archetypesEn = [
      "AI Infrastructure Engineers & MCP Tooling Architects",
      "Multi-Agent Runtime Developers & Swarm Operators",
      "Enterprise SecOps & Compliance Officers",
      "Local Homelab Automators & AI Power Users",
    ];
    for (const archetype of archetypesEn) {
      expect(readmeEn).toContain(archetype);
    }

    const archetypesDe = [
      "KI-Infrastruktur-Ingenieure & MCP-Architekten",
      "Multi-Agenten-Entwickler & Swarm-Operatoren",
      "Enterprise SecOps & Compliance-Verantwortliche",
      "Lokale Homelab-Automatisierer & Power-User",
    ];
    for (const archetype of archetypesDe) {
      expect(readmeDe).toContain(archetype);
    }

    expect(readmeEn).toContain("Discovery Keywords & High-Intent Topic Tags");
    expect(readmeDe).toContain("Suchbegriffe & Themen-Tags");
  });

  it("ensures Comparative Matrix vs Alternatives is present in both READMEs across alternatives", () => {
    expect(readmeEn).toContain("## Comparative Matrix vs Alternatives");
    expect(readmeDe).toContain("## Vergleichsmatrix gegenüber Alternativen");

    const alternativesEn = [
      "Static MCP Configurations",
      "Monolithic MCP Meta-Servers",
      "Heavyweight Agent Frameworks",
      "Cloud LLMOps & Remote Gateways",
    ];
    for (const alt of alternativesEn) {
      expect(readmeEn).toContain(alt);
    }

    const alternativesDe = [
      "Statische MCP-Konfiguration",
      "Monolithische MCP-Meta-Server",
      "Schwergewichtige Agenten-Frameworks",
      "Cloud-LLMOps & Remote Gateways",
    ];
    for (const alt of alternativesDe) {
      expect(readmeDe).toContain(alt);
    }
  });

  it("ensures dedicated Third-Party Licenses & Transparency section is present in both READMEs", () => {
    expect(readmeEn).toContain("## Third-Party Licenses & Transparency");
    expect(readmeDe).toContain("## Drittanbieter-Lizenzen & Transparenz");
    expect(readmeEn).toContain("0% Copyleft / GPL / AGPL");
    expect(readmeDe).toContain("0% Copyleft / GPL / AGPL");
  });

  it("ensures THIRD_PARTY_LICENSES.md covers all direct runtime and dev dependencies with audit summary", () => {
    const thirdParty = fs.readFileSync(path.join(root, "THIRD_PARTY_LICENSES.md"), "utf-8");
    expect(thirdParty).toContain("@modelcontextprotocol/sdk");
    expect(thirdParty).toContain("zod");
    expect(thirdParty).not.toContain("update-notifier");
    expect(thirdParty).toContain("typescript");
    expect(thirdParty).toContain("vitest");
    expect(thirdParty).toContain("MIT");
    expect(thirdParty).toContain("Audit Date / Prüfdatum");
    expect(thirdParty).toContain("2026-09-14");
    expect(thirdParty).toContain("2026-09-26");
    expect(thirdParty).toContain("2026-09-28");
    expect(thirdParty).toContain("2026-09-29");
    expect(thirdParty).toContain("THIRD_PARTY_LICENSES.txt");
    expect(thirdParty).toContain("Level 1 SBOM Invariant Cross-Reference Matrix");
    expect(thirdParty).toContain("INV-LOCAL-01");
    expect(thirdParty).toContain("INV-SLA-10");
    expect(thirdParty).toContain("RunAsInvoker");
    expect(thirdParty).toContain("NOTICE");
    expect(thirdParty).toContain("Permissive Open-Source Ratio");
    expect(thirdParty).toContain("100%");
  });

  it("ships public documents in the files manifest and no internal pipeline logs", () => {
    expect(packageJson.files).toContain("CONTRIBUTING.md");
    expect(packageJson.files).toContain("THIRD_PARTY_LICENSES.md");
    expect(packageJson.files).toContain("THIRD_PARTY_LICENSES.txt");
    expect(packageJson.files).toContain("NOTICE");
    expect(packageJson.files).not.toContain("MARKETING-LOG.txt");

    // A document can exist in the maintainer checkout yet be absent from npm.
    // Check both the link target and the package allowlist for public doc links.
    for (const [name, text] of [["README.md", readmeEn], ["README_de.md", readmeDe]]) {
      const targets = [...text.matchAll(/\]\(([^)]+)\)/g)]
        .map((match) => match[1])
        .filter((target) => !/^(?:[a-z]+:|#|\/\/)/i.test(target))
        .map((target) => target.split("#")[0].replace(/^\.\//, ""))
        .filter((target) => /\.(?:md|txt)$/i.test(target) || target === "NOTICE");
      expect(targets.length, name).toBeGreaterThan(10);
      for (const target of targets) {
        expect(fs.existsSync(path.join(root, target)), `${name}: ${target}`).toBe(true);
        expect(packageJson.files, `${name}: ${target}`).toContain(target);
      }
    }
    const importantFiles = llmsTxt.split("## Important Files")[1]?.split("\n## ")[0];
    expect(importantFiles).toBeTruthy();
    const documents = [...(importantFiles ?? "").matchAll(/^- `([^`]+\.(?:md|txt))`:/gm)];
    expect(documents.length).toBeGreaterThan(5);
    for (const [, target] of documents) {
      expect(fs.existsSync(path.join(root, target)), `llms.txt: ${target}`).toBe(true);
      expect(packageJson.files, `llms.txt: ${target}`).toContain(target);
    }
  });

  it("keeps relative documentation links in READMEs and llms.txt resolvable", () => {
    const documents: Array<[string, string]> = [
      ["README.md", readmeEn],
      ["README_de.md", readmeDe],
      ["llms.txt", llmsTxt],
    ];
    for (const [name, text] of documents) {
      const targets = [...text.matchAll(/\]\(\.\/([^)#\s]+)[^)]*\)/g)].map((match) => match[1]);
      for (const target of targets) {
        expect(fs.existsSync(path.join(root, target)), `${name} links to missing ${target}`).toBe(true);
      }
    }
  });

  it("ensures canonical NOTICE attribution exists and is complete", () => {
    expect(notice).toContain("ellmos-controlcenter-mcp");
    expect(notice).toContain("Copyright (c) 2026 Lukas Geiger <lukas@open-bricks.org>");
    expect(notice).toContain("ellmos-ai and open-bricks open-source ecosystems");
    expect(notice).toContain("MIT License");
    expect(notice).toContain("THIRD_PARTY_LICENSES.txt");
  });

  it("ensures CHANGELOG.md documents latest 0.7.4 release and Unreleased Pfad A/B entries", () => {
    const changelog = fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf-8");
    expect(changelog).toContain("## [Unreleased] - 2026-09-29");
    expect(changelog).toContain("## [Unreleased] - 2026-09-28");
    expect(changelog).toContain("Discoverability, Visual Architecture, 18-Point Bilingual Navigation Parity, § 521 BGB Statutory Disclaimer & Level 1 SBOM Audit");
    expect(changelog).toContain("Technical Hygiene, CI Lifecycle Workflows, Multi-Host Sync Defense, Canonical NOTICE Attribution & Level 1 SBOM Audit");
    expect(changelog).toContain("## 0.7.4 - 2026-09-13");
    expect(changelog).toContain("Discoverability, Target Personas, Comparative Matrix & 18-Anchor Nav Parity");
    expect(changelog).toContain("Target Personas & Discoverability Framework");
    expect(changelog).toContain("10-Dimension Comparative Matrix vs Alternatives");
  });

  it("ensures reciprocal dual HTML anchors sec-01 through sec-18 exist in both README.md and README_de.md", () => {
    for (let i = 1; i <= 18; i++) {
      const anchor = `<a id="sec-${i.toString().padStart(2, "0")}"></a>`;
      expect(readmeEn).toContain(anchor);
      expect(readmeDe).toContain(anchor);
    }
  });

  it("ensures German statutory disclaimer (§ 521 BGB) and 48h SLA exist in Section 18 of both READMEs", () => {
    for (const doc of [readmeEn, readmeDe]) {
      expect(doc).toContain("521 BGB");
      expect(doc).toContain("Gefälligkeitsrecht");
      expect(doc).toContain("INV-SLA-10");
    }
    expect(readmeEn).toContain("48 hours");
    expect(readmeDe).toContain("48 Stunden");
  });

  it("ensures package.json contains 20 saturated keywords in alphabetical order matching GitHub topics", () => {
    const expected = [
      "ai-agents",
      "automation",
      "claude-code",
      "claude-profiles",
      "dashboard",
      "developer-tools",
      "llm",
      "llm-agents",
      "local-first",
      "local-mcp",
      "mcp",
      "mcp-control-plane",
      "mcp-dashboard",
      "mcp-registry",
      "mcp-server",
      "model-context-protocol",
      "policy-audit",
      "profile-management",
      "registry-metadata",
      "typescript",
    ];
    expect(packageJson.keywords).toEqual(expected);
    expect(packageJson.keywords.length).toBe(20);
  });

  it("ensures THIRD_PARTY_LICENSES.txt Level 1 SBOM plain-text companion verifies all invariants and runtime dependencies", () => {
    const thirdPartyTxt = fs.readFileSync(path.join(root, "THIRD_PARTY_LICENSES.txt"), "utf-8");
    expect(thirdPartyTxt).toContain("Third-Party Licenses & Level 1 SBOM");
    expect(thirdPartyTxt).toContain("2026-09-29");
    expect(thirdPartyTxt).toContain("@modelcontextprotocol/sdk");
    expect(thirdPartyTxt).toContain("zod");
    expect(thirdPartyTxt).toContain("hono");
    expect(thirdPartyTxt).toContain("vitest");
    expect(thirdPartyTxt).toContain("RunAsInvoker");
    const invList = [
      "INV-LOCAL-01",
      "INV-GATE-02",
      "INV-SUB-03",
      "INV-SCRUB-04",
      "INV-PRIV-05",
      "INV-LOCK-06",
      "INV-PERM-07",
      "INV-GOV-08",
      "INV-SYNC-09",
      "INV-SLA-10",
    ];
    for (const inv of invList) {
      expect(thirdPartyTxt).toContain(inv);
    }
  });

  it("ensures ASCII Four-View Architectural Topology Projection exists in both README.md and README_de.md", () => {
    const viewsEn = [
      "[VIEW 1: CLIENT RUNTIMES, LOCAL DASHBOARD & MCP HOST INTERFACES]",
      "[VIEW 2: CONTROLCENTER SOVEREIGN CORE ENGINE & RESOLUTION SUBSYSTEMS]",
      "[VIEW 3: POLICY-GATED GATEWAY, EPHEMERAL DISPATCH & HARDENED SECRET SCRUBBER]",
      "[VIEW 4: GOVERNANCE MIRROR, MULTI-AGENT LOCK BOUNDARIES & SYSTEM PERIMETER]",
    ];
    for (const view of viewsEn) {
      expect(readmeEn).toContain(view);
    }

    const viewsDe = [
      "[SICHT 1: CLIENT-LAUFZEITEN, LOKALES DASHBOARD & MCP-HOST-SCHNITTSTELLEN]",
      "[SICHT 2: CONTROLCENTER SOVERÄNE KERN-ENGINE & AUFLÖSUNGS-SUBSYSTEME]",
      "[SICHT 3: POLICY-GESTEUERTES GATEWAY, EPHEMERE DISPATCH-LOGIK & GEHÄRTETER SECRET-SCRUBBER]",
      "[SICHT 4: GOVERNANCE-SPIEGEL, MULTI-AGENTEN-LOCK-GRENZEN & SYSTEM-PERIMETER]",
    ];
    for (const view of viewsDe) {
      expect(readmeDe).toContain(view);
    }
  });

  it("keeps the Level 1 SBOM badge present and the verification date identical across surfaces", () => {
    const badgeEn = /verified-(\d{4})--(\d{2})--(\d{2})-blue\.svg/.exec(readmeEn);
    const badgeDe = /verified-(\d{4})--(\d{2})--(\d{2})-blue\.svg/.exec(readmeDe);
    const checked = /Last-checked: (\d{4}-\d{2}-\d{2})/.exec(llmsTxt);
    expect(badgeEn).toBeTruthy();
    expect(badgeDe?.[0]).toBe(badgeEn?.[0]);
    expect(checked).toBeTruthy();
    // One date, three surfaces -- the badge is derived from the same check as llms.txt.
    expect(`${badgeEn?.[1]}-${badgeEn?.[2]}-${badgeEn?.[3]}`).toBe(checked?.[1]);
    expect(readmeEn).toContain("Level%201%20SBOM");
    expect(readmeDe).toContain("Level%201%20SBOM");
    expect(readmeEn).toContain("THIRD_PARTY_LICENSES.txt");
    expect(readmeDe).toContain("THIRD_PARTY_LICENSES.txt");
    expect(llmsTxt).toContain("THIRD_PARTY_LICENSES.txt");
  });

  it("keeps the published test count identical across both README badges and llms.txt", () => {
    const badge = /Vitest-(\d+)%20passed/.exec(readmeEn)?.[1];
    const badgeDe = /Vitest-(\d+)%20passed/.exec(readmeDe)?.[1];
    const status = /Test status: (\d+)\/(\d+) Vitest tests passing/.exec(llmsTxt);
    const prose = /\((\d+) tests passing in the full suite\)/.exec(llmsTxt)?.[1];
    expect(badge).toBeTruthy();
    expect(badgeDe).toBe(badge);
    expect(status?.[1]).toBe(badge);
    expect(status?.[2]).toBe(badge);
    // The prose figure drifted to a third, different number before this test existed.
    expect(prose).toBe(badge);
  });

  it("ensures bilingual CONTRIBUTING.md exists with 10 invariants, a contributor workflow, and the statutory notice", () => {
    expect(contributingMd).toContain("# Contributing to ellmos-controlcenter-mcp / Mitwirken an ellmos-controlcenter-mcp");
    expect(contributingMd).toContain("[English](#english)");
    expect(contributingMd).toContain("[Deutsch](#deutsch)");
    expect(contributingMd).toContain("INV-LOCAL-01");
    expect(contributingMd).toContain("INV-GATE-02");
    expect(contributingMd).toContain("INV-SUB-03");
    expect(contributingMd).toContain("INV-SCRUB-04");
    expect(contributingMd).toContain("INV-PRIV-05");
    expect(contributingMd).toContain("INV-LOCK-06");
    expect(contributingMd).toContain("INV-PERM-07");
    expect(contributingMd).toContain("INV-GOV-08");
    expect(contributingMd).toContain("INV-SYNC-09");
    expect(contributingMd).toContain("INV-SLA-10");
    expect(contributingMd).toContain("RunAsInvoker");
    expect(contributingMd).toContain("Local Development Workflow");
    expect(contributingMd).toContain("Lokaler Entwicklungsworkflow");
    // Guard turned around: the public contributor guide must not pin a maintainer-local path.
    expect(contributingMd).not.toMatch(/C:[/\\](?:Users|_Local_DEV)[/\\]/);
    expect(contributingMd).toContain("521 BGB");
    expect(contributingMd).toContain("Gefälligkeitsrecht");
    expect(contributingMd).toContain("security@open-bricks.org");
    expect(contributingMd).toContain("security@ellmos.ai");
  });

  it("ensures CI workflows auto-assign.yml and label-sync.yml are provisioned with least privilege and concurrency", () => {
    expect(autoAssignYml).toContain("actions/github-script@v7");
    expect(autoAssignYml).toContain("timeout-minutes: 5");
    expect(autoAssignYml).toContain("cancel-in-progress: true");
    expect(autoAssignYml).toContain("pull-requests: write");
    expect(autoAssignYml).toContain("issues: write");

    expect(labelSyncYml).toContain("EndBug/label-sync@v2");
    expect(labelSyncYml).toContain("timeout-minutes: 5");
    expect(labelSyncYml).toContain("cancel-in-progress: true");
    expect(labelSyncYml).toContain("issues: write");
    expect(labelSyncYml).toContain(".github/labels.yml");

    expect(labelsYml).toContain("name: bug");
    expect(labelsYml).toContain("name: enhancement");
    expect(labelsYml).toContain("name: 'priority: high'");
    expect(labelsYml).toContain("name: 'priority: low'");
    expect(labelsYml).toContain("name: needs-triage");
    expect(labelsYml).toContain("name: stale");
  });

  it("ensures .gitignore defends against additional multi-host tokens, taskplans, and scoped locks", () => {
    expect(gitignore).toContain("*-IDEAPAD-GEI*");
    expect(gitignore).toContain("TASKPLAN_*.md");
    expect(gitignore).toContain("*-TASKPLAN*");
    expect(gitignore).toContain("LOCK.dev.*");
    expect(gitignore).toContain("LOCK.antigravity.*");
    expect(gitignore).toContain("LOCK.bugsearch.*");
    expect(gitignore).toContain("Desktop.ini");
    expect(gitignore).toContain("ehthumbs.db");
  });

  it("ensures CHANGELOG.md documents the repository hygiene milestone under a dated Unreleased heading", () => {
    const changelog = fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf-8");
    // Format instead of literal: refreshing the date must not turn the suite red.
    expect(changelog).toMatch(/## \[Unreleased\] - \d{4}-\d{2}-\d{2}/);
    expect(changelog).toContain("Repository Hygiene, CI Lifecycle Workflows, Multi-Host Sync Defense");
  });

  it("ensures Contributing badges exist in README.md and README_de.md", () => {
    expect(readmeEn).toContain("Contributing-Guide-blue.svg");
    expect(readmeDe).toContain("Mitwirken-Leitfaden-blue.svg");
    expect(readmeEn).toContain("[CONTRIBUTING.md](./CONTRIBUTING.md)");
    expect(readmeDe).toContain("[CONTRIBUTING.md](./CONTRIBUTING.md)");
  });

  it("ensures dependency overrides protect against supply-chain CVEs in package.json", () => {
    expect(packageJson.overrides["fast-uri"]).toBe("^3.1.8");
    expect(packageJson.overrides["ip-address"]).toBe("^10.7.2");
    expect(packageJson.overrides["hono"]).toBe("^4.13.8");
    expect(packageJson.overrides["@hono/node-server"]).toBe("^2.0.12");
    expect(packageJson.overrides["qs"]).toBe("^6.16.0");
    expect(packageJson.overrides["proxy-addr"]).toBe("^2.0.8");
    expect(packageJson.overrides["source-map-js"]).toBe("^1.2.2");
    expect(packageJson.dependencies["@modelcontextprotocol/sdk"]).toBe("^1.31.0");
  });

  it("ensures .gitignore defends against credentials, secrets, tokens, keys, certs, and conflict review logs", () => {
    const requiredPatterns = [
      ".env",
      ".env.local",
      ".env.*",
      ".npmrc",
      ".pypirc",
      "*.key",
      "*.pem",
      "*.p12",
      "*.pfx",
      "*.crt",
      "*.cert",
      "*.csr",
      "*.token",
      "*.secret",
      "credentials.json",
      "secrets.json",
      "*secret*.json",
      "*token*.json",
      "token.json",
      "tokens.json",
      "id_rsa*",
      "id_ed25519*",
      "id_ecdsa*",
      "id_dsa*",
      "*_recovery_codes.txt",
      "*recovery*codes*.txt",
      "CONFLICT_REVIEW_LOG*",
    ];
    for (const pat of requiredPatterns) {
      expect(gitignore).toContain(pat);
    }
  });

  it("ensures binding 30-day remediation SLA commitment (INV-SLA-10) in SECURITY.md and Level 1 SBOM", () => {
    expect(securityMd).toContain("remediating confirmed vulnerabilities within 30 calendar days (`INV-SLA-10`)");
    expect(securityMd).toContain("bestätigte Sicherheitslücken innerhalb von 30 Kalendertagen zu beheben (`INV-SLA-10`)");

    const thirdPartyMd = fs.readFileSync(path.join(root, "THIRD_PARTY_LICENSES.md"), "utf-8");
    expect(thirdPartyMd).toContain("Re-Audit (Security & Dependency Audit):");
    expect(thirdPartyMd).toContain("30-day remediation SLA");

    const thirdPartyTxt = fs.readFileSync(path.join(root, "THIRD_PARTY_LICENSES.txt"), "utf-8");
    expect(thirdPartyTxt).toContain("30-day remediation SLA");
  });

  it("ensures zero hardcoded secrets and maintainer-local paths across every published text file", () => {
    // Scope lesson: a guard limited to src/ and to one hard-coded user name reported
    // "zero personal developer paths" while CONTRIBUTING.md and an internal log carried
    // the maintainer's clone path -- and both were in the npm files manifest.
    // The tracked set is what readers get -- an untracked file in the working tree is not
    // published, and a working-tree walk would both miss nothing and flag local scratch files.
    const EXTS = [".ts", ".js", ".mjs", ".json", ".md", ".txt", ".yml", ".yaml", ".py"];
    const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf-8" })
      .split("\0")
      .filter(Boolean);
    const files = tracked
      .filter((rel) => EXTS.some((e) => rel.endsWith(e)))
      .filter((rel) => fs.existsSync(path.join(root, rel)));
    expect(files.length).toBeGreaterThan(40);

    const secretRegex = /(?:sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{30,}|AKIA[0-9A-Z]{16}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----)/;
    // Concrete profiles include Test-prefixed names, spaces and Unicode; templates stay exempt.
    const homePathRegex = /C:[/\\]+Users[/\\]+(?![<%{$])[^/\\\r\n]+[/\\]/;
    // Exercise concrete profiles at runtime so the tracked-file scan needs no name exemption.
    const windowsHome = (name: string) => ["C:", "Users", name, "fixture"].join("\\");
    for (const name of ["Test", "Tester", "TestUser", "Test-runner", "Test.User", "Test Person", "Müller", "alice"]) {
      expect(windowsHome(name), name).toMatch(homePathRegex);
    }
    for (const placeholder of ["<user>", "%USER%", "${user}", "{user}"]) {
      expect(windowsHome(placeholder), placeholder).not.toMatch(homePathRegex);
    }

    // The maintainer's local development root is never a published path.
    const localDevRegex = /C:[/\\]+_Local_DEV[/\\]/;

    for (const rel of files) {
      const content = fs.readFileSync(path.join(root, rel), "utf-8");
      // The scrubber fixtures under test/ carry synthetic secrets on purpose.
      if (!rel.startsWith("test/")) {
        expect(content, rel).not.toMatch(secretRegex);
      }
      expect(content, rel).not.toMatch(homePathRegex);
      expect(content, rel).not.toMatch(localDevRegex);
    }
  });

  it("ensures CHANGELOG.md documents the security and dependency audit milestone", () => {
    const changelog = fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf-8");
    expect(changelog).toContain("AI Security, Supply-Chain & Dependency Audit");
  });
});
