import { de } from "./de.js";
import { en } from "./en.js";
import { es } from "./es.js";
import { ja } from "./ja.js";
import { ru } from "./ru.js";
import { zh } from "./zh.js";
import { SUPPORTED_LANGUAGES, type Lang, type Translations } from "./types.js";

const translations: Record<Lang, Translations> = { de, en, es, zh, ja, ru };

function normalizeLanguageCode(value: string | undefined): Lang | null {
  if (!value || value.trim().length === 0) {
    return null;
  }
  const normalized = value.trim().toLowerCase().replace("_", "-").split("-")[0];
  return isSupportedLanguage(normalized) ? normalized : null;
}

let currentLanguage: Lang =
  normalizeLanguageCode(process.env.CONTROLCENTER_LANGUAGE) ??
  normalizeLanguageCode(process.env.ELLMOS_CONTROLCENTER_LANGUAGE) ??
  normalizeLanguageCode(process.env.LANG) ??
  "de";

export function isSupportedLanguage(value: string): value is Lang {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

export function t(lang: Lang = currentLanguage): Translations {
  return translations[lang];
}

export function setLanguage(lang: Lang): Lang {
  currentLanguage = lang;
  return currentLanguage;
}

export function getLanguage(): Lang {
  return currentLanguage;
}

export function getSupportedLanguages(): Lang[] {
  return [...SUPPORTED_LANGUAGES];
}

export function getLanguageName(lang: Lang): string {
  return translations[lang].language.name;
}

export function describeSupportedLanguages(): string {
  return getSupportedLanguages()
    .map((lang) => `${lang}=${getLanguageName(lang)}`)
    .join(", ");
}

export { SUPPORTED_LANGUAGES };
export type { Lang, Translations };
