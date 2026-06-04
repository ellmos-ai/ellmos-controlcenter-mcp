import { en } from "./en.js";
import type { Translations } from "./types.js";

export const ru: Translations = {
  ...en,
  language: {
    ...en.language,
    name: "Русский",
    fallbackNote: "Русский is registered as a fallback language and currently uses the English text set."
  }
};
