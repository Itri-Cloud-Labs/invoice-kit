import type { DocumentColors, DocumentType, PdfSpacingOptions } from "@kit/core/types";
import type { ModuleKey } from "./document";

export const PACKAGE = "@ic-labs/invoice-kit";
export const REPO = "https://github.com/Itri-Cloud-Labs/invoice-kit";
export const NPM = "https://www.npmjs.com/package/@ic-labs/invoice-kit";
export const DOCS = `${REPO}/tree/main/packages/typescript#readme`;
export const LOGO = `${import.meta.env.BASE_URL}demo-logo.svg`;

export type Chapter = "hero" | "types" | "totals" | "modules" | "colors" | "spacing";
export type GapName = keyof PdfSpacingOptions;

export const VARIABLES: Record<DocumentType, string> = {
  invoice: "facture",
  quote: "devis",
  purchaseOrder: "commande",
  deliveryNote: "livraison",
  returnNote: "retour",
  priceRequest: "demande"
};

// Paper stock per document slug. Spelled out so Tailwind sees every class.
export const STOCK: Record<string, string> = {
  facture: "bg-stock-facture",
  devis: "bg-stock-devis",
  commande: "bg-stock-commande",
  livraison: "bg-stock-livraison",
  retour: "bg-stock-retour",
  prix: "bg-stock-prix"
};

export const MODULE_LABELS: Record<ModuleKey, string> = {
  title: "title",
  number: "number",
  issueDate: "issueDate",
  dueDate: "dueDate",
  issuer: "issuer",
  logo: "issuer.logo",
  seller: "seller",
  client: "client",
  items: "items",
  discounts: "discounts",
  paymentTerms: "paymentTerms",
  bankInfo: "bankInfo",
  notes: "notes",
  footer: "footer"
};

export const FINANCIAL_ONLY: ReadonlySet<ModuleKey> = new Set(["dueDate", "discounts", "paymentTerms", "bankInfo"]);

export const PALETTES: ReadonlyArray<{ name: string; colors: DocumentColors }> = [
  { name: "Default navy", colors: {} },
  { name: "Terracotta", colors: { primary: "#9f3d1b", mutedText: "#8a5a47", border: "#e7cfc4", footerText: "#b08e80" } },
  { name: "Cedar", colors: { primary: "#1f5a43", mutedText: "#4f7566", border: "#cfe0d8", footerText: "#8aa69a" } },
  { name: "Plum", colors: { primary: "#6b2456", mutedText: "#84607a", border: "#e3d0dd", footerText: "#a98fa2" } },
  { name: "Graphite", colors: { primary: "#111827", mutedText: "#4b5563", border: "#9ca3af", footerText: "#6b7280" } }
];

export const SLOTS: ReadonlyArray<{ slot: keyof DocumentColors; hint: string }> = [
  { slot: "primary", hint: "Accent" },
  { slot: "onPrimary", hint: "Text on accent" },
  { slot: "text", hint: "Body text" },
  { slot: "metaText", hint: "Number and dates" },
  { slot: "mutedText", hint: "Section labels" },
  { slot: "border", hint: "Table lines" },
  { slot: "footerText", hint: "Footer" }
];

export const GAPS: ReadonlyArray<{ name: GapName; label: string; min: number; max: number }> = [
  { name: "headerToParties", label: "Header to seller and client", min: 0, max: 72 },
  { name: "partiesToTable", label: "Seller and client to table", min: 0, max: 72 },
  { name: "tableHeaderHeight", label: "Table header height", min: 22, max: 48 },
  { name: "tableRowMinHeight", label: "Minimum row height", min: 30, max: 56 },
  { name: "tableToSummary", label: "Table to totals", min: 0, max: 72 },
  { name: "summaryRowHeight", label: "Totals row height", min: 26, max: 40 }
];

export const VAT_RATES = [0, 0.07, 0.1, 0.14, 0.2];
