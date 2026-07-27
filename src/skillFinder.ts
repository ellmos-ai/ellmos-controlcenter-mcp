import type { SkillSummary } from "./skills.js";

/**
 * Skill recognition / skill-finder.
 *
 * Matches a task/intent against a scanned skill catalogue and returns ranked
 * candidates with the trigger reason (which intent terms matched in which
 * fields). The matching is LEXICAL at its core — keyword/alias overlap over
 * name + aliases + tags + category + description — which is zero-dependency and
 * deterministic, consistent with the credential-/dependency-free design of the
 * ellmos servers.
 *
 * CALLERS MUST PASS KEYWORDS, NOT WHOLE SENTENCES. Because scoring is lexical and
 * currently has no stop-word filter, a natural-language sentence contributes its
 * filler words to the score and can outrank the correct hit. Measured 2026-07-25:
 * "Mein Programm stürzt beim Speichern ab und ich weiß nicht warum" ranked
 * `mcp-config-sync` first at score 6 (matched on "beim"/"nicht"/"warum"), while
 * "Bug systematisch debuggen Testfehler" correctly ranked `bugfix-protocol` at
 * only score 5 — i.e. scores are comparable WITHIN one query, never across
 * queries. Stop-word filtering + score normalisation are tracked in TODO.md (P1).
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
  /** Score normalized relative to the number of content terms in the query. */
  normalizedScore: number;
  /** Intent terms that matched somewhere in the skill. */
  matchedTerms: string[];
  /** Skill fields that contributed matches (name, aliases, tags, category, description). */
  matchedFields: string[];
  /** Language-neutral, structured trigger explanation. */
  reason: string;
}

// Multi-language stopword set (de, en, es, ja, ru, zh) so common filler words do not create noise.
const STOPWORDS = new Set([
  // English
  "the", "a", "an", "and", "or", "to", "of", "for", "in", "on", "with", "my", "me",
  "is", "it", "this", "that", "how", "do", "can", "please", "need", "want", "help",
  "use", "using", "set", "make", "get", "create", "from", "by", "as", "at",
  // German
  "der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem", "einer",
  "und", "oder", "aber", "zu", "fuer", "für", "im", "in", "mit", "mein", "meine",
  "ich", "du", "er", "sie", "es", "wir", "ihr", "ist", "sind", "war", "wie", "bitte",
  "brauche", "braucht", "will", "hilf", "hilft", "nutze", "nutz", "mach", "machen",
  "macht", "soll", "auf", "aus", "bei", "beim", "vom", "von", "an", "als", "am", "um",
  "ueber", "über", "vor", "nach", "durch", "ohne", "gegen", "unter", "bis", "zum",
  "zur", "nicht", "warum", "ab", "weiss", "weiß",
  // Spanish
  "el", "la", "los", "las", "un", "una", "unos", "unas", "y", "o", "pero", "a", "de",
  "en", "para", "por", "favor", "con", "sin", "su", "sus", "mi", "mis", "yo", "es", "son",
  "fue", "como", "necesito", "quiero", "ayuda", "usar", "hace", "hacer", "sobre",
  // Japanese (romaji & common transliterated particles)
  "no", "wa", "ga", "de", "ni", "wo", "to", "ka", "mo", "kara", "node", "desu", "masu",
  "kudasai", "suru", "shite",
  // Russian (Cyrillic & transliterated)
  "и", "в", "не", "на", "я", "с", "что", "это", "как", "для", "по", "но", "из", "к",
  "у", "за", "от", "о", "мы", "вы", "да", "так", "если", "или", "а", "мне", "меня",
  "мой", "моя", "мое", "моим", "пожалуйста", "помоги", "нужно",
  // Chinese (structural/filler characters)
  "的", "了", "和", "是", "就", "都", "而", "及", "與", "著", "或", "一", "在", "我",
  "你", "他", "她", "它", "這", "那", "有", "也", "為", "上", "個", "用", "請", "幫",
  "需", "要"
]);

/** Lowercase, split on non-alphanumeric (keeping German umlauts, CJK, Cyrillic), drop stopwords and 1-char latin tokens. */
export function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9äöüß\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\u0400-\u04ff]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length > 0 && !STOPWORDS.has(token) && (token.length >= 2 || /[\u3400-\u4dbf\u4e00-\u9fff]/.test(token)));
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
 * matches are excluded. Ties break by normalized score, raw score, matched terms,
 * deployed status, then name.
 */
export function findSkills(intent: string, skills: SkillSummary[], limit = 5): SkillMatch[] {
  const intentTokens = tokenize(intent);
  if (intentTokens.length === 0) return [];

  const matches: SkillMatch[] = [];
  for (const skill of skills) {
    const { score, matchedTerms, matchedFields } = scoreSkill(intentTokens, skill);
    if (score <= 0) continue;
    const normalizedScore = Number((score / intentTokens.length).toFixed(2));
    matches.push({
      skill,
      score,
      normalizedScore,
      matchedTerms,
      matchedFields,
      reason: buildReason(matchedTerms, matchedFields)
    });
  }

  matches.sort(
    (a, b) =>
      b.normalizedScore - a.normalizedScore ||
      b.score - a.score ||
      b.matchedTerms.length - a.matchedTerms.length ||
      Number(b.skill.deployed) - Number(a.skill.deployed) ||
      a.skill.name.localeCompare(b.skill.name)
  );

  return matches.slice(0, Math.max(1, limit));
}
