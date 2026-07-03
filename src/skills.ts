import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";

export const DEFAULT_SKILLS_ROOT =
  process.env.ELLMOS_SKILLS_ROOT ?? path.join(os.homedir(), ".claude", "skills");

export const DEFAULT_SOURCE_SKILLS_ROOT =
  process.env.ELLMOS_SOURCE_SKILLS_ROOT ?? getDefaultSourceSkillsRoot();

export function getDefaultSourceSkillsRoot(
  env: NodeJS.ProcessEnv = process.env,
  homeDirectory: string = os.homedir()
): string {
  const oneDriveRoot =
    firstNonEmptyPath(env.OneDrive, env.ONEDRIVE) ??
    path.join(homeDirectory, "OneDrive");
  return path.join(oneDriveRoot, ".TOPICS", ".AI", ".SKILLS", "skills");
}

function firstNonEmptyPath(...values: Array<string | undefined>): string | null {
  for (const value of values) {
    if (value && value.trim().length > 0) {
      return value;
    }
  }
  return null;
}

export interface SkillSummary {
  name: string;
  description: string;
  version: string | null;
  type: string | null;
  category: string | null;
  status: string | null;
  tags: string[];
  aliases: string[];
  absolutePath: string;
  deployed: boolean;
  hasSkillMd: boolean;
}

/**
 * Parses an inline YAML list value such as "[mcp, skills, sync]" or a plain
 * comma-separated string into a string array. Strips brackets and quotes.
 * Returns [] for empty/undefined input. Used for `tags` and `aliases`.
 */
export function parseInlineList(value: string | undefined): string[] {
  if (!value) return [];
  let inner = value.trim();
  if (inner.startsWith("[") && inner.endsWith("]")) {
    inner = inner.slice(1, -1);
  }
  return inner
    .split(",")
    .map((item) => item.trim().replace(/^["']|["']$/g, "").trim())
    .filter((item) => item.length > 0);
}

/**
 * Parses YAML frontmatter between the first pair of "---" delimiters.
 * Returns a Record<string, string> of key-value pairs.
 * Handles folded scalar (">") and literal block ("|") as single-line strings (first line only).
 * Does not crash on malformed input — returns empty record.
 */
export function parseFrontmatter(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  // Find the opening "---" line (must be the very first line or preceded only by BOM/whitespace)
  const lines = content.split(/\r?\n/);
  let startIndex = -1;
  for (let i = 0; i < Math.min(lines.length, 3); i++) {
    if (lines[i].trim() === "---") {
      startIndex = i;
      break;
    }
  }
  if (startIndex < 0) return result;

  let endIndex = -1;
  for (let i = startIndex + 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      endIndex = i;
      break;
    }
  }
  if (endIndex < 0) return result;

  const frontmatterLines = lines.slice(startIndex + 1, endIndex);
  let i = 0;
  while (i < frontmatterLines.length) {
    const line = frontmatterLines[i];
    // Match "key: value" or "key:" at start of line (not indented — top-level keys only)
    const match = /^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/.exec(line);
    if (!match) {
      i++;
      continue;
    }
    const key = match[1];
    const rawValue = match[2].trim();

    // Folded block (>) or literal block (|): collect indented continuation lines
    if (rawValue === ">" || rawValue === "|") {
      const parts: string[] = [];
      i++;
      while (i < frontmatterLines.length && /^\s+/.test(frontmatterLines[i])) {
        parts.push(frontmatterLines[i].trim());
        i++;
      }
      result[key] = parts.join(" ");
      continue;
    }

    // Inline value — strip optional quotes
    const unquoted = /^["'](.*)["']$/.exec(rawValue);
    result[key] = unquoted ? unquoted[1] : rawValue;
    i++;
  }

  return result;
}

async function readSkillMd(dirPath: string): Promise<SkillSummary | null> {
  const skillMdPath = path.join(dirPath, "SKILL.md");
  let content: string;
  try {
    content = await fs.readFile(skillMdPath, "utf-8");
  } catch {
    return null;
  }
  const fm = parseFrontmatter(content);
  return {
    name: fm["name"] ?? path.basename(dirPath),
    description: fm["description"] ?? "",
    version: fm["version"] ?? null,
    type: fm["type"] ?? null,
    category: fm["category"] ?? null,
    status: fm["status"] ?? null,
    tags: parseInlineList(fm["tags"]),
    aliases: parseInlineList(fm["aliases"]),
    absolutePath: dirPath,
    deployed: false, // will be overwritten by caller
    hasSkillMd: true
  };
}

async function scanSkillsRoot(
  root: string,
  deployed: boolean
): Promise<SkillSummary[]> {
  let entries: import("fs").Dirent[];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }

  const dirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => !name.startsWith(".") && name !== "node_modules");

  const results = await Promise.all(
    dirs.map(async (name) => {
      const dirPath = path.join(root, name);
      const summary = await readSkillMd(dirPath);
      if (summary) {
        summary.deployed = deployed;
        return summary;
      }
      // Directory exists but has no SKILL.md — return minimal entry
      return {
        name,
        description: "",
        version: null,
        type: null,
        category: null,
        status: null,
        tags: [],
        aliases: [],
        absolutePath: dirPath,
        deployed,
        hasSkillMd: false
      } satisfies SkillSummary;
    })
  );

  return results;
}

/**
 * Scans source skills root (organised in category subdirectories).
 * Returns flat list across all categories.
 */
async function scanSourceSkillsRoot(root: string): Promise<SkillSummary[]> {
  let categoryEntries: import("fs").Dirent[];
  try {
    categoryEntries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }

  const categories = categoryEntries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => !name.startsWith(".") && name !== "node_modules" && name !== "_templates");

  const perCategory = await Promise.all(
    categories.map(async (category) => {
      const categoryPath = path.join(root, category);
      const skills = await scanSkillsRoot(categoryPath, false);
      // Overwrite category if not already set from frontmatter
      return skills.map((s) => ({
        ...s,
        category: s.category ?? category
      }));
    })
  );

  return perCategory.flat();
}

export async function scanSkills(
  deployedRoot: string = DEFAULT_SKILLS_ROOT,
  sourceRoot: string = DEFAULT_SOURCE_SKILLS_ROOT
): Promise<SkillSummary[]> {
  const [deployed, source] = await Promise.all([
    scanSkillsRoot(deployedRoot, true),
    scanSourceSkillsRoot(sourceRoot)
  ]);

  // Merge: deployed wins; source entries that are NOT already deployed are added as undeployed
  const deployedNames = new Set(deployed.map((s) => s.name));
  const sourceOnlySkills = source.filter((s) => !deployedNames.has(s.name));

  return [...deployed, ...sourceOnlySkills];
}
