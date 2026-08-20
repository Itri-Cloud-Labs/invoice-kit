import type { LocaleCode, TemplateDefinition } from "../core/types.js";

const titles: Record<LocaleCode, string> = {
  "fr-MA": "Bon de retour",
  "ar-MA": "وصل إرجاع"
};

export const returnNoteTemplate: TemplateDefinition = {
  type: "returnNote",
  getTitle(locale) {
    return titles[locale];
  }
};
