import { BusinessDocument } from "./document.js";
import type { CreateDocumentOptions, DocumentInput, DocumentType } from "./types.js";
import { validateDocumentInput } from "./validation.js";
import { createTemplateDefinition } from "../templates/definitions.js";
import { getLabels } from "../locales/index.js";
import { computeLineItem, computeTotals, MOROCCO_DEFAULT_VAT_RATE } from "../utils/taxes.js";

const createBusinessDocument = (options: CreateDocumentOptions): BusinessDocument => {
  validateDocumentInput(options);

  const locale = options.locale ?? "fr-MA";
  const template = createTemplateDefinition(options.type);
  const isDeliveryNote = options.type === "deliveryNote";
  const items = options.items.map(computeLineItem);
  const discounts = isDeliveryNote ? [] : (options.discounts ?? []);
  const vatRate = isDeliveryNote ? 0 : (options.vatRate ?? MOROCCO_DEFAULT_VAT_RATE);
  const issueDate = options.issueDate ?? new Date();
  const labels = getLabels(locale);
  const data = {
    type: options.type,
    title: options.title ?? template.getTitle(locale) ?? labels.documentTitle,
    number: options.number,
    issueDate,
    issuer: options.issuer,
    seller: options.seller,
    client: options.client,
    items,
    currency: options.currency ?? "MAD",
    vatRate,
    discounts,
    locale,
    totals: computeTotals(items, discounts, vatRate)
  };

  return new BusinessDocument({
    ...data,
    ...(options.dueDate ? { dueDate: options.dueDate } : {}),
    ...(options.paymentTerms ? { paymentTerms: options.paymentTerms } : {}),
    ...(options.bankInfo ? { bankInfo: options.bankInfo } : {}),
    ...(options.notes ? { notes: options.notes } : {}),
    ...(options.footer ? { footer: options.footer } : {})
  });
};

const withType = (type: DocumentType) => (input: DocumentInput): BusinessDocument =>
  createBusinessDocument({ ...input, type });

export const createInvoice = withType("invoice");
export const createQuote = withType("quote");
export const createPurchaseOrder = withType("purchaseOrder");
export const createDeliveryNote = withType("deliveryNote");
