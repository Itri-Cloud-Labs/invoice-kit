import { isQuantityOnlyDocument } from "@kit/core/document-kinds";
import type {
  BusinessDocumentData,
  DocumentColors,
  DocumentInput,
  DocumentType,
  LineItemInput,
  PdfSpacingOptions
} from "@kit/core/types";
import { validateDocumentInput } from "@kit/core/validation";
import { createTemplateDefinition } from "@kit/templates/definitions";
import { computeLineItem, computeTotals, MOROCCO_DEFAULT_VAT_RATE } from "@kit/utils/taxes";
import * as sample from "./sample-data.js";

export const MODULES = [
  "title",
  "number",
  "issueDate",
  "dueDate",
  "issuer",
  "logo",
  "seller",
  "client",
  "items",
  "discounts",
  "paymentTerms",
  "bankInfo",
  "notes",
  "footer"
] as const;

export type ModuleKey = (typeof MODULES)[number];

export interface DocumentKind {
  type: DocumentType;
  factory: string;
  title: string;
  english: string;
  file: string;
  slug: string;
}

export const KINDS: readonly DocumentKind[] = [
  { type: "invoice", factory: "createInvoice", title: "Facture", english: "Invoice", file: "facture", slug: "facture" },
  { type: "quote", factory: "createQuote", title: "Devis", english: "Quote", file: "devis", slug: "devis" },
  { type: "purchaseOrder", factory: "createPurchaseOrder", title: "Bon de commande", english: "Purchase order", file: "bon-de-commande", slug: "commande" },
  { type: "deliveryNote", factory: "createDeliveryNote", title: "Bon de livraison", english: "Delivery note", file: "bon-de-livraison", slug: "livraison" },
  { type: "returnNote", factory: "createReturnNote", title: "Bon de retour", english: "Return note", file: "bon-de-retour", slug: "retour" },
  { type: "priceRequest", factory: "createPriceRequest", title: "Demande de prix", english: "Price request", file: "demande-de-prix", slug: "prix" }
];

export const kindOf = (type: DocumentType): DocumentKind => KINDS.find((kind) => kind.type === type) ?? KINDS[0]!;

export interface DemoState {
  type: DocumentType;
  items: LineItemInput[];
  escompte: number;
  vatRate: number;
  modules: Record<ModuleKey, boolean>;
  colors: DocumentColors;
  spacing: PdfSpacingOptions;
}

export const createInitialState = (): DemoState => ({
  type: "invoice",
  items: sample.items.map((item) => ({ ...item })),
  escompte: sample.discounts[0]?.value ?? 0,
  vatRate: MOROCCO_DEFAULT_VAT_RATE,
  modules: Object.fromEntries(MODULES.map((key) => [key, true])) as Record<ModuleKey, boolean>,
  colors: {},
  spacing: {}
});

// The object a developer would hand to the factory for the current state.
export const buildInput = (state: DemoState): DocumentInput => {
  const on = state.modules;
  const kind = kindOf(state.type);
  const quantityOnly = isQuantityOnlyDocument(state.type);
  const input: DocumentInput = {};

  // createPriceRequest supplies its own localized title; the other factories print one only when given.
  if (on.title && state.type !== "priceRequest") input.title = kind.title;
  if (on.number) input.number = sample.numbers[state.type];
  if (on.issueDate) input.issueDate = new Date(sample.issueDate);
  if (on.dueDate && !quantityOnly) input.dueDate = new Date(sample.dueDate);
  if (on.issuer) {
    input.issuer = { ...sample.issuer, ...(on.logo ? { logo: "https://atlaspapeterie.ma/logo.svg" } : {}) };
  }
  if (on.seller) input.seller = sample.seller;
  if (on.client) input.client = sample.client;
  if (on.items) {
    input.items = state.items.map((item) => {
      if (!quantityOnly) return item;
      const { unitPrice: _unitPrice, discountRate: _discountRate, ...rest } = item;
      return rest;
    });
  }
  if (!quantityOnly) {
    if (state.vatRate !== MOROCCO_DEFAULT_VAT_RATE) input.vatRate = state.vatRate;
    if (on.discounts && state.escompte > 0) {
      input.discounts = [{ type: "percentage", value: state.escompte, label: "Escompte" }];
    }
    if (on.paymentTerms) input.paymentTerms = sample.paymentTerms;
    if (on.bankInfo) input.bankInfo = sample.bankInfo;
  }
  if (on.notes) input.notes = sample.notes;
  if (on.footer) input.footer = sample.footer;
  if (Object.keys(state.colors).length > 0) input.colors = state.colors;

  return input;
};

// Mirrors createBusinessDocument in packages/typescript/src/core/factories.ts. That module
// also pulls in the Node PDF renderer, so the browser repeats its few lines of assembly
// around the same validation and totals functions.
export const createDocumentData = (type: DocumentType, input: DocumentInput): BusinessDocumentData => {
  const options = {
    ...input,
    type,
    ...(type === "priceRequest"
      ? { title: input.title ?? createTemplateDefinition("priceRequest").getTitle(input.locale ?? "fr-MA") }
      : {})
  };
  validateDocumentInput(options);

  const locale = options.locale ?? "fr-MA";
  const quantityOnly = isQuantityOnlyDocument(type);
  const items = (options.items ?? []).map((item) =>
    computeLineItem(quantityOnly ? { ...item, unitPrice: 0, price: 0, discountRate: 0 } : item)
  );
  const discounts = quantityOnly ? [] : (options.discounts ?? []);
  const vatRate = quantityOnly ? 0 : (options.vatRate ?? MOROCCO_DEFAULT_VAT_RATE);
  const totals = !quantityOnly && items.length > 0 ? computeTotals(items, discounts, vatRate) : undefined;

  return {
    type,
    locale,
    ...(options.title ? { title: options.title } : {}),
    ...(options.number ? { number: options.number } : {}),
    ...(options.issueDate ? { issueDate: options.issueDate } : {}),
    ...(options.issuer ? { issuer: options.issuer } : {}),
    ...(options.seller ? { seller: options.seller } : {}),
    ...(options.client ? { client: options.client } : {}),
    ...(items.length > 0 ? { items } : {}),
    ...(options.currency ? { currency: options.currency } : {}),
    ...(!quantityOnly && items.length > 0 ? { vatRate } : {}),
    ...(discounts.length > 0 ? { discounts } : {}),
    ...(totals ? { totals } : {}),
    ...(options.dueDate ? { dueDate: options.dueDate } : {}),
    ...(options.paymentTerms ? { paymentTerms: options.paymentTerms } : {}),
    ...(options.bankInfo ? { bankInfo: options.bankInfo } : {}),
    ...(options.notes ? { notes: options.notes } : {}),
    ...(options.footer ? { footer: options.footer } : {}),
    ...(options.colors ? { colors: options.colors } : {})
  };
};
