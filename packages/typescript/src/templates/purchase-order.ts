import type { LocaleCode, TemplateDefinition } from "../core/types.js";

const titles: Record<LocaleCode, string> = {
  "fr-MA": "Bon de commande",
  "ar-MA": "طلب شراء"
};

export const purchaseOrderTemplate: TemplateDefinition = {
  type: "purchaseOrder",
  getTitle(locale) {
    return titles[locale];
  }
};
