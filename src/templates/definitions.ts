import type { DocumentType, TemplateDefinition } from "../core/types.js";
import { deliveryNoteTemplate } from "./delivery-note.js";
import { invoiceTemplate } from "./invoice.js";
import { purchaseOrderTemplate } from "./purchase-order.js";
import { priceRequestTemplate } from "./price-request.js";
import { quoteTemplate } from "./quote.js";
import { returnNoteTemplate } from "./return-note.js";

const templates: Record<DocumentType, TemplateDefinition> = {
  invoice: invoiceTemplate,
  quote: quoteTemplate,
  purchaseOrder: purchaseOrderTemplate,
  deliveryNote: deliveryNoteTemplate,
  returnNote: returnNoteTemplate,
  priceRequest: priceRequestTemplate
};

export const createTemplateDefinition = (type: DocumentType): TemplateDefinition => templates[type];
