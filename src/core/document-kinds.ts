import type { DocumentType } from "./types.js";

const quantityOnlyDocumentTypes: ReadonlySet<DocumentType> = new Set([
  "deliveryNote",
  "returnNote",
  "priceRequest"
]);

export const isQuantityOnlyDocument = (type: DocumentType): boolean =>
  quantityOnlyDocumentTypes.has(type);
