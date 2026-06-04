import { en } from "./en.js";
import type { Translations } from "./types.js";

export const zh: Translations = {
  ...en,
  language: {
    ...en.language,
    name: "中文",
    fallbackNote: "中文 is registered as a fallback language and currently uses the English text set."
  }
};
