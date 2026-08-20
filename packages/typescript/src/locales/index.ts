import type { LocaleCode, TemplateLabels } from "../core/types.js";
import { arLabels } from "./ar.js";
import { frLabels } from "./fr.js";

const locales: Record<LocaleCode, TemplateLabels> = {
  "fr-MA": frLabels,
  "ar-MA": arLabels
};

export const getLabels = (locale: LocaleCode): TemplateLabels => locales[locale] ?? frLabels;
