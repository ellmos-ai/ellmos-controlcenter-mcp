import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

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
  const ciYml = fs.readFileSync(path.join(root, ".github", "workflows", "ci.yml"), "utf-8");
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
    expect(llmsTxt).toContain("Last-checked: 2026-09-14");
    expect(llmsTxt).toContain("Test status: 252/252 Vitest tests passing (100% green)");
    expect(llmsTxt).toContain("io.github.ellmos-ai/ellmos-controlcenter-mcp");
    expect(llmsTxt).toContain("https://github.com/ellmos-ai/ellmos-controlcenter-mcp");
    expect(llmsTxt).toContain("MIT");
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
      "Vitest-252%20passed-brightgreen.svg",
      "verified-2026--09--14-blue.svg",
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
      "llms.txt",
      "CHANGELOG.md",
      "server.json",
      "glama.json",
      "THIRD_PARTY_LICENSES.md",
      "MARKETING-LOG.txt",
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

  it("ensures .gitignore is hardened against multi-host conflict files, canonical locks, and cache artifacts", () => {
    expect(gitignore).toContain("*.sync-conflict-*");
    expect(gitignore).toContain("*-CONFLIT-*");
    expect(gitignore).toContain("* (kopie)*");
    expect(gitignore).toContain("*-WORKSTATION*");
    expect(gitignore).toContain("LOCK");
    expect(gitignore).toContain("LOCK.*");
    expect(gitignore).toContain("!package-lock.json");
    expect(gitignore).toContain(".pytest_cache/");
    expect(gitignore).toContain(".coverage");
    expect(gitignore).toContain(".coverage.*");
    expect(gitignore).toContain(".nyc_output/");
    expect(gitignore).toContain(".turbo/");
    expect(gitignore).toContain("build/");
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
      "research-line",
    ];
    for (const token of siblingTokens) {
      expect(readmeEn).toContain(token);
      expect(readmeDe).toContain(token);
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
    expect(thirdParty).toContain("Permissive Open-Source Ratio");
    expect(thirdParty).toContain("100%");
  });

  it("ensures MARKETING-LOG.txt contains target personas, search terms, and governance invariants", () => {
    const marketingLog = fs.readFileSync(path.join(root, "MARKETING-LOG.txt"), "utf-8");
    expect(marketingLog).toContain("ellmos-controlcenter-mcp");
    expect(marketingLog).toContain("0.7.4");
    expect(marketingLog).toContain("TARGET PERSONAS");
    expect(marketingLog).toContain("CORE DISCOVERABILITY KEYWORDS & SEARCH PHRASES");
    expect(marketingLog).toContain("GOVERNANCE & RUNTIME INVARIANTS");
    expect(marketingLog).toContain("INV-LOCAL-01");
    expect(marketingLog).toContain("INV-SLA-10");
    expect(marketingLog).toContain("Pfad B Discoverability, Target Personas & Comparative Matrix Overhaul (v0.7.4)");
  });

  it("ensures package.json includes MARKETING-LOG.txt and THIRD_PARTY_LICENSES.md in files manifest", () => {
    expect(packageJson.files).toContain("THIRD_PARTY_LICENSES.md");
    expect(packageJson.files).toContain("MARKETING-LOG.txt");
  });

  it("ensures CHANGELOG.md documents latest 0.7.4 release with Pfad B discoverability details", () => {
    const changelog = fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf-8");
    expect(changelog).toContain("## 0.7.4 - 2026-09-13");
    expect(changelog).toContain("Discoverability, Target Personas, Comparative Matrix & 18-Anchor Nav Parity");
    expect(changelog).toContain("Target Personas & Discoverability Framework");
    expect(changelog).toContain("10-Dimension Comparative Matrix vs Alternatives");
  });
});

