import { BusinessDocument } from "./document.js";
import type { CreateDocumentOptions, DocumentInput, DocumentType } from "./types.js";
import { validateDocumentInput } from "./validation.js";
import { computeLineItem, computeTotals, MOROCCO_DEFAULT_VAT_RATE } from "../utils/taxes.js";

const createBusinessDocument = (options: CreateDocumentOptions): BusinessDocument => {
  validateDocumentInput(options);

  const locale = options.locale ?? "fr-MA";
  const isDeliveryNote = options.type === "deliveryNote";
  const items = (options.items ?? []).map(computeLineItem);
  const discounts = isDeliveryNote ? [] : (options.discounts ?? []);
  const vatRate = isDeliveryNote ? 0 : (options.vatRate ?? MOROCCO_DEFAULT_VAT_RATE);
  const totals = !isDeliveryNote && items.length > 0 ? computeTotals(items, discounts, vatRate) : undefined;

  const data = {
    type: options.type,
    locale,
    ...(options.title ? { title: options.title } : {}),
    ...(options.number ? { number: options.number } : {}),
    ...(options.issueDate ? { issueDate: options.issueDate } : {}),
    ...(options.issuer ? { issuer: options.issuer } : {}),
    ...(options.seller ? { seller: options.seller } : {}),
    ...(options.client ? { client: options.client } : {}),
    ...(items.length > 0 ? { items } : {}),
    ...(options.currency ? { currency: options.currency } : {}),
    ...(!isDeliveryNote && items.length > 0 ? { vatRate } : {}),
    ...(discounts.length > 0 ? { discounts } : {}),
    ...(totals ? { totals } : {})
  };

  return new BusinessDocument({
    ...data,
    ...(options.dueDate ? { dueDate: options.dueDate } : {}),
    ...(options.paymentTerms ? { paymentTerms: options.paymentTerms } : {}),
    ...(options.bankInfo ? { bankInfo: options.bankInfo } : {}),
    ...(options.notes ? { notes: options.notes } : {}),
    ...(options.footer ? { footer: options.footer } : {}),
    ...(options.colors ? { colors: options.colors } : {})
  });
};

const withType = (type: DocumentType) => (input: DocumentInput): BusinessDocument =>
  createBusinessDocument({ ...input, type });

export const createInvoice = withType("invoice");
export const createQuote = withType("quote");
export const createPurchaseOrder = withType("purchaseOrder");
export const createDeliveryNote = withType("deliveryNote");
