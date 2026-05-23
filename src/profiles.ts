import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";

export const DEFAULT_PROFILE_ROOT =
  process.env.ELLMOS_PROFILE_ROOT ?? path.join(os.homedir(), ".claude", "profiles");

export interface ClaudeProfileSummary {
  name: string;
  filePath: string;
  extendsProfile: string | null;
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
  [key: string]: unknown;
};

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
    throw new Error(`Invalid profile name: ${profileName}`);
  }
}

async function readProfileJson(profileRoot: string, profileName: string): Promise<{ filePath: string; profile: ProfileJsonShape }> {
  assertValidProfileName(profileName);
  const filePath = path.join(profileRoot, `${profileName}.json`);
  const raw = await fs.readFile(filePath, "utf-8");
  return { filePath, profile: JSON.parse(raw) as ProfileJsonShape };
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

export function extractServerNames(profile: ProfileJsonShape): string[] {
  return Object.keys(extractServerMap(profile)).sort((a, b) => a.localeCompare(b));
}

export function summarizeProfile(name: string, filePath: string, profile: ProfileJsonShape): ClaudeProfileSummary {
  const servers = extractServerNames(profile);
  return {
    name,
    filePath,
    extendsProfile: typeof profile.extends === "string" ? profile.extends : null,
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
  const seen = new Set<string>();
  const sourceFiles: string[] = [];

  async function resolveRecursive(name: string): Promise<Record<string, unknown>> {
    if (seen.has(name)) {
      throw new Error(`Profile inheritance cycle detected at '${name}'`);
    }
    seen.add(name);

    const { filePath, profile } = await readProfileJson(profileRoot, name);
    sourceFiles.push(filePath);

    const baseServers =
      typeof profile.extends === "string"
        ? await resolveRecursive(profile.extends)
        : {};
    const ownServers = extractServerMap(profile);
    return { ...baseServers, ...ownServers };
  }

  const mcpServers = await resolveRecursive(profileName);
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
  const normalizedTask = task.toLowerCase();
  const priority = ["ai-lab", "software", "research", "umbruch", "base"];

  let best: ProfileSuggestion = {
    profile: "base",
    score: 0,
    matchedKeywords: [],
    rationale: "Keine starken Keywords erkannt. Base-Profil als sichere Standardempfehlung."
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
        rationale: `Empfohlen wegen ${matchedKeywords.length} passender Keywords: ${matchedKeywords.join(", ")}`
      };
    }
  }

  return best;
}
