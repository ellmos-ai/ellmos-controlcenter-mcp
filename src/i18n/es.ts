import { en } from "./en.js";
import type { Translations } from "./types.js";

export const es: Translations = {
  ...en,
  language: {
    ...en.language,
    name: "Español",
    fallbackNote: "Español is registered as a fallback language and currently uses the English text set."
  }
};
