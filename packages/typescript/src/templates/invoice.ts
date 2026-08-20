import type { LocaleCode, TemplateDefinition } from "../core/types.js";

const titles: Record<LocaleCode, string> = {
  "fr-MA": "Facture",
  "ar-MA": "فاتورة"
};

export const invoiceTemplate: TemplateDefinition = {
  type: "invoice",
  getTitle(locale) {
    return titles[locale];
  }
};
