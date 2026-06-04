import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { t } from "./i18n/index.js";

export const DEFAULT_PROFILE_ROOT =
  process.env.ELLMOS_PROFILE_ROOT ?? path.join(os.homedir(), ".claude", "profiles");

export interface ClaudeProfileSummary {
  name: string;
  filePath: string;
  extendsProfile: string | null;
  extendsProfiles: string[];
  serverCount: number;
  servers: string[];
}

export interface ProfileSuggestion {
  profile: string;
  score: number;
  matchedKeywords: string[];
  rationale: string;
}

export interface ResolvedProfile {
  name: string;
  profileRoot: string;
  sourceFiles: string[];
  serverCount: number;
  servers: string[];
  config: {
    mcpServers: Record<string, unknown>;
  };
}

export interface ProfileSwitchPlan extends ResolvedProfile {
  outputPath: string;
  command: string;
  written: boolean;
  backupPath: string | null;
}

type ProfileJsonShape = {
  extends?: unknown;
  mcpServers?: unknown;
  add?: unknown;
  servers?: unknown;
  remove?: unknown;
  disabled?: unknown;
  disabledServers?: unknown;
  [key: string]: unknown;
};

export class ProfileConfigError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "ProfileConfigError";
  }
}

const PROFILE_HINTS: Record<string, string[]> = {
  "ai-lab": ["mcp", "agent", "llm", "prompt", "ollama", "automation", "n8n", "anthropic", "openai", "gemini"],
  software: ["code", "repo", "debug", "test", "build", "typescript", "python", "api", "bug", "git", "entwickl"],
  research: ["paper", "studie", "literatur", "zitation", "citation", "pubmed", "arxiv", "latex", "forschung", "zenodo"],
  umbruch: ["website", "astro", "seo", "umbruch", "landingpage", "blog", "content"],
  base: ["mail", "gmail", "calendar", "termin", "meeting"]
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function assertValidProfileName(profileName: string): void {
  if (!/^[a-zA-Z0-9_-]+$/.test(profileName)) {
    throw new ProfileConfigError(
      `Invalid profile name '${profileName}'. Use only letters, numbers, underscores, and hyphens.`,
      "invalid-profile-name",
      { profileName }
    );
  }
}

async function readProfileJson(profileRoot: string, profileName: string): Promise<{ filePath: string; profile: ProfileJsonShape }> {
  assertValidProfileName(profileName);
  const filePath = path.join(profileRoot, `${profileName}.json`);
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf-8");
  } catch (error) {
    const code = typeof (error as NodeJS.ErrnoException).code === "string"
      ? (error as NodeJS.ErrnoException).code
      : "read-error";
    if (code === "ENOENT") {
      throw new ProfileConfigError(
        `Claude profile '${profileName}' was not found. Expected file: ${filePath}`,
        "profile-not-found",
        { profileName, filePath, profileRoot }
      );
    }
    throw new ProfileConfigError(
      `Claude profile '${profileName}' could not be read from ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
      "profile-read-failed",
      { profileName, filePath, profileRoot, code }
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new ProfileConfigError(
      `Claude profile '${profileName}' contains invalid JSON at ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
      "profile-json-invalid",
      { profileName, filePath }
    );
  }

  if (!isRecord(parsed) || Array.isArray(parsed)) {
    throw new ProfileConfigError(
      `Claude profile '${profileName}' must be a JSON object at ${filePath}.`,
      "profile-schema-invalid",
      { profileName, filePath, actualType: Array.isArray(parsed) ? "array" : typeof parsed }
    );
  }

  return { filePath, profile: parsed as ProfileJsonShape };
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function timestampForFileName(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function backupFileIfExists(filePath: string, backupDirectory: string): Promise<string | null> {
  if (!await pathExists(filePath)) {
    return null;
  }

  await fs.mkdir(backupDirectory, { recursive: true });
  const backupPath = path.join(
    backupDirectory,
    `${path.basename(filePath)}.${timestampForFileName()}.bak`
  );
  await fs.copyFile(filePath, backupPath);
  return backupPath;
}

export async function readEditableProfile(profileName: string, profileRoot: string = DEFAULT_PROFILE_ROOT): Promise<{ filePath: string; profile: ProfileJsonShape }> {
  return readProfileJson(profileRoot, profileName);
}

export async function writeEditableProfile(
  profileName: string,
  profile: ProfileJsonShape,
  profileRoot: string = DEFAULT_PROFILE_ROOT
): Promise<{ filePath: string; backupPath: string | null }> {
  assertValidProfileName(profileName);
  const filePath = path.join(profileRoot, `${profileName}.json`);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const backupPath = await backupFileIfExists(filePath, path.join(profileRoot, "_backups"));
  await fs.writeFile(filePath, `${JSON.stringify(profile, null, 2)}\n`, "utf-8");
  return { filePath, backupPath };
}

function extractServerMap(profile: ProfileJsonShape): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const buckets = [profile.mcpServers, profile.add, profile.servers];
  for (const bucket of buckets) {
    if (!isRecord(bucket)) continue;
    for (const [key, value] of Object.entries(bucket)) {
      result[key] = value;
    }
  }
  return result;
}

function extractStringList(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function uniqueInOrder(values: string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) === index);
}

export function extractExtendsProfiles(profile: ProfileJsonShape): string[] {
  return uniqueInOrder(extractStringList(profile.extends));
}

export function extractRemovedServerNames(profile: ProfileJsonShape): string[] {
  return uniqueSorted([
    ...extractStringList(profile.remove),
    ...extractStringList(profile.disabled),
    ...extractStringList(profile.disabledServers)
  ]);
}

export function extractServerNames(profile: ProfileJsonShape): string[] {
  return Object.keys(extractServerMap(profile)).sort((a, b) => a.localeCompare(b));
}

export function summarizeProfile(name: string, filePath: string, profile: ProfileJsonShape): ClaudeProfileSummary {
  const servers = extractServerNames(profile);
  const extendsProfiles = extractExtendsProfiles(profile);
  return {
    name,
    filePath,
    extendsProfile: extendsProfiles[0] ?? null,
    extendsProfiles,
    serverCount: servers.length,
    servers
  };
}

export async function listClaudeProfiles(profileRoot: string = DEFAULT_PROFILE_ROOT): Promise<ClaudeProfileSummary[]> {
  let entries;
  try {
    entries = await fs.readdir(profileRoot, { withFileTypes: true });
  } catch {
    return [];
  }

  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const profiles: ClaudeProfileSummary[] = [];
  for (const fileName of files) {
    const filePath = path.join(profileRoot, fileName);
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const parsed = JSON.parse(raw) as ProfileJsonShape;
      profiles.push(summarizeProfile(path.basename(fileName, ".json"), filePath, parsed));
    } catch {
      continue;
    }
  }
  return profiles;
}

export async function resolveClaudeProfile(profileName: string, profileRoot: string = DEFAULT_PROFILE_ROOT): Promise<ResolvedProfile> {
  const resolvedCache = new Map<string, Record<string, unknown>>();
  const sourceFileSet = new Set<string>();
  const sourceFiles: string[] = [];

  function addSourceFile(filePath: string): void {
    if (!sourceFileSet.has(filePath)) {
      sourceFileSet.add(filePath);
      sourceFiles.push(filePath);
    }
  }

  async function resolveRecursive(name: string, stack: string[]): Promise<Record<string, unknown>> {
    if (stack.includes(name)) {
      throw new ProfileConfigError(
        `Profile inheritance cycle detected: ${[...stack, name].join(" -> ")}`,
        "profile-inheritance-cycle",
        { profileName: name, chain: [...stack, name] }
      );
    }
    const cached = resolvedCache.get(name);
    if (cached) {
      return cached;
    }

    const { filePath, profile } = await readProfileJson(profileRoot, name);
    addSourceFile(filePath);

    const baseServers: Record<string, unknown> = {};
    for (const baseProfile of extractExtendsProfiles(profile)) {
      Object.assign(baseServers, await resolveRecursive(baseProfile, [...stack, name]));
    }

    for (const serverName of extractRemovedServerNames(profile)) {
      delete baseServers[serverName];
    }

    const ownServers = extractServerMap(profile);
    const resolved = { ...baseServers, ...ownServers };
    resolvedCache.set(name, resolved);
    return resolved;
  }

  const mcpServers = await resolveRecursive(profileName, []);
  const servers = Object.keys(mcpServers).sort((a, b) => a.localeCompare(b));

  return {
    name: profileName,
    profileRoot,
    sourceFiles,
    serverCount: servers.length,
    servers,
    config: { mcpServers }
  };
}

function quoteCommandPath(value: string): string {
  return value.includes(" ") ? `"${value}"` : value;
}

export async function prepareProfileSwitch(
  profileName: string,
  options: {
    profileRoot?: string;
    outputPath?: string;
    write?: boolean;
  } = {}
): Promise<ProfileSwitchPlan> {
  const profileRoot = options.profileRoot ?? DEFAULT_PROFILE_ROOT;
  const resolved = await resolveClaudeProfile(profileName, profileRoot);
  const outputPath =
    options.outputPath ??
    path.join(profileRoot, "_generated", `${profileName}.mcp.json`);
  const command = `claude --mcp-config ${quoteCommandPath(outputPath)}`;
  let backupPath: string | null = null;

  if (options.write === true) {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    backupPath = await backupFileIfExists(outputPath, path.join(path.dirname(outputPath), "_backups"));
    await fs.writeFile(outputPath, JSON.stringify(resolved.config, null, 2), "utf-8");
  }

  return {
    ...resolved,
    outputPath,
    command,
    written: options.write === true,
    backupPath
  };
}

export function suggestProfile(task: string): ProfileSuggestion {
  const labels = t();
  const normalizedTask = task.toLowerCase();
  const priority = ["ai-lab", "software", "research", "umbruch", "base"];

  let best: ProfileSuggestion = {
    profile: "base",
    score: 0,
    matchedKeywords: [],
    rationale: labels.messages.noStrongProfileKeywords
  };

  for (const profile of priority) {
    const hints = PROFILE_HINTS[profile];
    const matchedKeywords = hints.filter((hint) => normalizedTask.includes(hint));
    const score = matchedKeywords.length;
    if (score > best.score) {
      best = {
        profile,
        score,
        matchedKeywords,
        rationale: labels.messages.profileRationale(matchedKeywords.length, matchedKeywords.join(", "))
      };
    }
  }

  return best;
}
