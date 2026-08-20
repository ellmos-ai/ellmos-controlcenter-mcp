import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("metadata & manifest parity", () => {
  const root = path.resolve(__dirname, "..");
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf-8"));
  const serverJson = JSON.parse(fs.readFileSync(path.join(root, "server.json"), "utf-8"));
  const glamaJson = JSON.parse(fs.readFileSync(path.join(root, "glama.json"), "utf-8"));
  const llmsTxt = fs.readFileSync(path.join(root, "llms.txt"), "utf-8");
  const readmeEn = fs.readFileSync(path.join(root, "README.md"), "utf-8");
  const readmeDe = fs.readFileSync(path.join(root, "README_de.md"), "utf-8");
  const indexTs = fs.readFileSync(path.join(root, "src", "index.ts"), "utf-8");
  const securityMd = fs.readFileSync(path.join(root, "SECURITY.md"), "utf-8");
  const license = fs.readFileSync(path.join(root, "LICENSE"), "utf-8");
  const ciYml = fs.readFileSync(path.join(root, ".github", "workflows", "ci.yml"), "utf-8");

  it("ensures version parity across package.json, server.json, and glama.json", () => {
    expect(packageJson.version).toBe(serverJson.version);
    expect(packageJson.version).toBe(glamaJson.version);
    expect(serverJson.packages[0].version).toBe(packageJson.version);
  });

  it("ensures tool count matches across index.ts, glama.json, and llms.txt", () => {
    const toolMatches = indexTs.match(/server\.registerTool\(\s*["']([^"']+)["']/g) || [];
    const toolNames = toolMatches.map((m) => {
      const exec = /server\.registerTool\(\s*["']([^"']+)["']/.exec(m);
      return exec ? exec[1] : "";
    }).filter(Boolean);

    expect(toolNames.length).toBe(31);
    expect(glamaJson.tools.count).toBe(toolNames.length);

    for (const name of toolNames) {
      expect(llmsTxt).toContain(name);
      expect(readmeEn).toContain(`\`${name}\``);
      expect(readmeDe).toContain(`\`${name}\``);
    }
  });

  it("ensures llms.txt contains required metadata and ecosystem links", () => {
    expect(llmsTxt).toContain("Last-checked: 2026-08-20");
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

  it("ensures README.md and README_de.md contain ecosystem and umbrella badges", () => {
    expect(readmeEn).toContain("Ecosystem-ellmos--ai-blue.svg");
    expect(readmeEn).toContain("Umbrella-open--bricks-blueviolet.svg");
    expect(readmeEn).toContain("LLM--Ready-llms.txt-success.svg");
    expect(readmeEn).toContain("README_de.md");

    expect(readmeDe).toContain("Ecosystem-ellmos--ai-blue.svg");
    expect(readmeDe).toContain("Umbrella-open--bricks-blueviolet.svg");
    expect(readmeDe).toContain("LLM--Ready-llms.txt-success.svg");
    expect(readmeDe).toContain("README.md");
  });

  it("ensures core required documents exist", () => {
    const required = ["README.md", "README_de.md", "SECURITY.md", "LICENSE", "llms.txt", "CHANGELOG.md", "server.json", "glama.json"];
    for (const file of required) {
      expect(fs.existsSync(path.join(root, file))).toBe(true);
    }
  });

  it("ensures SECURITY.md documents key security boundaries and gateway hardening", () => {
    expect(securityMd).toContain("Current Safety Model");
    expect(securityMd).toContain("controlcenter_invoke");
    expect(securityMd).toContain("gateway-audit.jsonl");
    expect(securityMd).toContain("https://github.com/ellmos-ai/ellmos-controlcenter-mcp/issues");
  });

  it("ensures CI workflow is properly configured with Node.js matrix strategy", () => {
    expect(ciYml).toContain("actions/checkout@v4");
    expect(ciYml).toContain("actions/setup-node@v4");
    expect(ciYml).toContain("matrix:");
    expect(ciYml).toContain("node-version: [18.x, 20.x, 22.x]");
    expect(ciYml).toContain("npm run test");
    expect(ciYml).toContain("npm run build");
  });
});
