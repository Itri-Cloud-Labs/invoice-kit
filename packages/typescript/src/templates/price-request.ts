import type { LocaleCode, TemplateDefinition } from "../core/types.js";

const titles: Record<LocaleCode, string> = {
  "fr-MA": "Demande de prix",
  "ar-MA": "طلب عرض أسعار"
};

export const priceRequestTemplate: TemplateDefinition = {
  type: "priceRequest",
  getTitle(locale) {
    return titles[locale];
  }
};
