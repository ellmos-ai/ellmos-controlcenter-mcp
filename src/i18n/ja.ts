import { en } from "./en.js";
import type { Translations } from "./types.js";

export const ja: Translations = {
  ...en,
  language: {
    ...en.language,
    name: "日本語",
    fallbackNote: "日本語 is registered as a fallback language and currently uses the English text set."
  }
};
