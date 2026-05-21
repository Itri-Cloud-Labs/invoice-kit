import type { DocumentType, TemplateDefinition } from "../core/types.js";
import { deliveryNoteTemplate } from "./delivery-note.js";
import { invoiceTemplate } from "./invoice.js";
import { purchaseOrderTemplate } from "./purchase-order.js";
import { quoteTemplate } from "./quote.js";

const templates: Record<DocumentType, TemplateDefinition> = {
  invoice: invoiceTemplate,
  quote: quoteTemplate,
  purchaseOrder: purchaseOrderTemplate,
  deliveryNote: deliveryNoteTemplate
};

export const createTemplateDefinition = (type: DocumentType): TemplateDefinition => templates[type];
