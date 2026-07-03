import type { SkillSummary } from "./skills.js";

/**
 * Skill recognition / skill-finder.
 *
 * Matches a free-text task/intent against a scanned skill catalogue and returns
 * ranked candidates with the trigger reason (which intent terms matched in which
 * fields). The matching is LEXICAL at its core — keyword/alias overlap over
 * name + aliases + tags + category + description — which is zero-dependency and
 * deterministic, consistent with the credential-/dependency-free design of the
 * ellmos servers.
 *
 * SKILL.md `description` fields are authored as trigger phrases ("Aktiviert sich
 * bei …"), so they carry strong matching signal; `tags` and `aliases` add
 * precise hooks. An optional embedding/semantic ranking is a deliberate STRETCH
 * GOAL behind explicit configuration (it would require a local embedding model)
 * and is intentionally NOT part of this core implementation.
 */

export interface SkillMatch {
  skill: SkillSummary;
  score: number;
  /** Intent terms that matched somewhere in the skill. */
  matchedTerms: string[];
  /** Skill fields that contributed matches (name, aliases, tags, category, description). */
  matchedFields: string[];
  /** Language-neutral, structured trigger explanation. */
  reason: string;
}

// Small German + English stopword set so common filler words do not create noise.
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "to", "of", "for", "in", "on", "with", "my", "me",
  "is", "it", "this", "that", "how", "do", "can", "please", "need", "want", "help",
  "use", "using", "set", "make", "get", "create",
  "der", "die", "das", "und", "oder", "zu", "fuer", "für", "im", "mit", "mein",
  "meine", "ich", "ist", "es", "wie", "ein", "eine", "einen", "bitte", "brauche",
  "will", "hilf", "nutze", "mach", "machen", "soll", "den", "dem", "auf"
]);

/** Lowercase, split on non-alphanumeric (keeping German umlauts), drop stopwords and 1-char tokens. */
export function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9äöüß]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token));
}

interface WeightedField {
  field: string;
  weight: number;
  get: (skill: SkillSummary) => string;
}

// Name and aliases are the strongest signals; description is broad but lower weight.
const FIELD_WEIGHTS: WeightedField[] = [
  { field: "name", weight: 5, get: (s) => s.name.replace(/[-_]/g, " ") },
  { field: "aliases", weight: 4, get: (s) => s.aliases.join(" ") },
  { field: "tags", weight: 3, get: (s) => s.tags.join(" ") },
  { field: "description", weight: 2, get: (s) => s.description },
  { field: "category", weight: 1, get: (s) => s.category ?? "" }
];

export function scoreSkill(
  intentTokens: string[],
  skill: SkillSummary
): { score: number; matchedTerms: string[]; matchedFields: string[] } {
  const uniqueIntent = [...new Set(intentTokens)];
  const matchedTerms = new Set<string>();
  const matchedFields = new Set<string>();
  let score = 0;

  for (const { field, weight, get } of FIELD_WEIGHTS) {
    const fieldTokens = new Set(tokenize(get(skill)));
    if (fieldTokens.size === 0) continue;
    for (const term of uniqueIntent) {
      if (fieldTokens.has(term)) {
        score += weight;
        matchedTerms.add(term);
        matchedFields.add(field);
      }
    }
  }

  return { score, matchedTerms: [...matchedTerms], matchedFields: [...matchedFields] };
}

function buildReason(matchedTerms: string[], matchedFields: string[]): string {
  if (matchedTerms.length === 0) return "";
  return `matched [${matchedTerms.join(", ")}] in [${matchedFields.join(", ")}]`;
}

/**
 * Returns skills ranked by lexical relevance to the intent. Skills with zero
 * matches are excluded. Ties break by number of distinct matched terms, then
 * deployed status, then name.
 */
export function findSkills(intent: string, skills: SkillSummary[], limit = 5): SkillMatch[] {
  const intentTokens = tokenize(intent);
  if (intentTokens.length === 0) return [];

  const matches: SkillMatch[] = [];
  for (const skill of skills) {
    const { score, matchedTerms, matchedFields } = scoreSkill(intentTokens, skill);
    if (score <= 0) continue;
    matches.push({
      skill,
      score,
      matchedTerms,
      matchedFields,
      reason: buildReason(matchedTerms, matchedFields)
    });
  }

  matches.sort(
    (a, b) =>
      b.score - a.score ||
      b.matchedTerms.length - a.matchedTerms.length ||
      Number(b.skill.deployed) - Number(a.skill.deployed) ||
      a.skill.name.localeCompare(b.skill.name)
  );

  return matches.slice(0, Math.max(1, limit));
}
