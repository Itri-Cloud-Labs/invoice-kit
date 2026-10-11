// Shared demo input. The site previews it in the browser and
// scripts/generate-samples.mjs feeds the same objects to the real library.

export const issuer = {
  name: "Atlas Papeterie",
  addressLines: ["27 Rue Ibnou Mounir, Maarif"],
  city: "Casablanca",
  country: "Maroc",
  phone: "+212 522 00 01 27",
  email: "bonjour@atlaspapeterie.ma",
  ice: "002734610000058",
  if: "40219377",
  rc: "381204"
};

export const seller = {
  name: "Atlas Papeterie SARL",
  addressLines: ["Depot 4, Zone industrielle Sidi Maarouf"],
  city: "Casablanca",
  country: "Maroc",
  ice: "002734610000058",
  if: "40219377",
  rc: "381204"
};

export const client = {
  name: "Librairie Al Manar",
  addressLines: ["112 Avenue Mohammed V"],
  city: "Rabat",
  country: "Maroc",
  phone: "+212 537 00 04 12",
  ice: "001598420000031"
};

/** @type {import("@kit/core/types").LineItemInput[]} */
export const items = [
  { name: "Papier A4 80 g", description: "rame de 500 feuilles", quantity: 40, unitPrice: 38, unit: "rame" },
  { name: "Carnet autocopiant", description: "50 feuillets, triplicata", quantity: 25, unitPrice: 22.5, unit: "carnet", discountRate: 0.1 },
  { name: "Tampon encreur bleu", quantity: 6, unitPrice: 145, unit: "piece" },
  { name: "Livraison Casablanca - Rabat", quantity: 1, unitPrice: 250 }
];

/** @type {import("@kit/core/types").DiscountInput[]} */
export const discounts = [{ type: "percentage", value: 0.02, label: "Escompte" }];

export const paymentTerms = { label: "Paiement sous 30 jours" };

/** @type {import("@kit/core/types").BankInfo} */
export const bankInfo = {
  type: "local",
  bankName: "Attijariwafa Bank",
  holderName: "Atlas Papeterie SARL",
  rib: "007 780 0002734610000058 41"
};

export const notes = "Merci pour votre confiance.";

export const footer = "Atlas Papeterie SARL\nbonjour@atlaspapeterie.ma\n+212 522 00 01 27";

export const issueDate = "2026-10-05T09:00:00";
export const dueDate = "2026-11-04T09:00:00";

export const numbers = {
  invoice: "FAC-2026-0412",
  quote: "DEV-2026-0127",
  purchaseOrder: "BDC-2026-0058",
  deliveryNote: "BL-2026-0391",
  returnNote: "BR-2026-0014",
  priceRequest: "DP-2026-0033"
};

// The closing invoice on the site: what the library costs.
export const receipt = {
  title: "Facture",
  number: "MIT-0001",
  issuer: {
    name: "Itri Cloud Labs",
    addressLines: ["github.com/Itri-Cloud-Labs/invoice-kit"]
  },
  client: { name: "Vous" },
  items: [
    { name: "createInvoice", description: "Facture", quantity: 1, unitPrice: 0 },
    { name: "createQuote", description: "Devis", quantity: 1, unitPrice: 0 },
    { name: "createPurchaseOrder", description: "Bon de commande", quantity: 1, unitPrice: 0 },
    { name: "createDeliveryNote", description: "Bon de livraison", quantity: 1, unitPrice: 0 },
    { name: "createReturnNote", description: "Bon de retour", quantity: 1, unitPrice: 0 },
    { name: "createPriceRequest", description: "Demande de prix", quantity: 1, unitPrice: 0 }
  ],
  paymentTerms: { label: "Aucun paiement attendu" },
  notes: "Licence MIT.",
  footer: "@ic-labs/invoice-kit\nnpm install @ic-labs/invoice-kit"
};
