import type { LocaleCode, TemplateDefinition } from "../core/types.js";

const titles: Record<LocaleCode, string> = {
  "fr-MA": "Devis",
  "ar-MA": "عرض سعر"
};

export const quoteTemplate: TemplateDefinition = {
  type: "quote",
  getTitle(locale) {
    return titles[locale];
  }
};
