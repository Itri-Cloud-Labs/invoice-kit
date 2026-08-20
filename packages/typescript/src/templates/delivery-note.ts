import type { LocaleCode, TemplateDefinition } from "../core/types.js";

const titles: Record<LocaleCode, string> = {
  "fr-MA": "Bon de livraison",
  "ar-MA": "وصل تسليم"
};

export const deliveryNoteTemplate: TemplateDefinition = {
  type: "deliveryNote",
  getTitle(locale) {
    return titles[locale];
  }
};
