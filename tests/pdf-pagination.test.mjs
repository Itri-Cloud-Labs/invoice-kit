import assert from "node:assert/strict";
import test from "node:test";
import { createInvoice } from "../dist/index.js";

const countPdfPages = (bytes) => {
  const pageMatches = Buffer.from(bytes).toString("latin1").match(/\/Type \/Page\b/g);
  return pageMatches?.length ?? 0;
};

test("a detailed two-item invoice keeps its summary on one page", async () => {
  const document = createInvoice({
    number: "FAC-2026-0001",
    issueDate: new Date("2026-05-20T09:00:00Z"),
    dueDate: new Date("2026-06-19T09:00:00Z"),
    issuer: {
      name: "IC Labs SARL",
      addressLines: ["201 Boulevard Zerktouni", "5eme etage"],
      city: "Casablanca",
      country: "Maroc",
      phone: "+212600000000",
      email: "contact@iclabs.ma",
      taxId: "TAX-MA-7788",
      ice: "001234567890123",
      if: "12345678",
      rc: "56789"
    },
    seller: {
      name: "IC Distribution",
      addressLines: ["Parc logistique Sidi Maarouf", "Batiment C2"],
      city: "Casablanca",
      country: "Maroc",
      phone: "+212522000111",
      email: "sales@icdistribution.ma",
      taxId: "SELLER-TAX-0099",
      ice: "009876543210987",
      if: "87654321",
      rc: "112233"
    },
    client: {
      name: "Atlas Trading",
      addressLines: ["45 Avenue Mohammed V", "3eme etage"],
      city: "Rabat",
      country: "Maroc",
      phone: "+212500000000",
      email: "finance@atlas-trading.ma",
      taxId: "CLIENT-TAX-4455"
    },
    items: [
      {
        name: "Audit comptable",
        description: "Mission de cadrage et restitution avec synthese detaillee sur plusieurs chantiers",
        quantity: 1,
        price: 2500
      },
      {
        name: "Implementation ERP multi-societes",
        description: "Parametrage, reprise des donnees et documentation operationnelle detaillee pour les equipes finance et support",
        quantity: 2,
        price: 1800
      }
    ],
    paymentTerms: {
      label: "Paiement sous 30 jours",
      notes: "Virement bancaire sur reception de facture."
    },
    bankInfo: {
      type: "international",
      bankName: "BMCI Corporate",
      holderName: "IC Labs SARL",
      swiftCode: "BMCIMAMC",
      iban: "MA64001122000001234567890123"
    },
    notes: "Merci pour votre confiance."
  });

  const pdfBytes = await document.toPDF();

  assert.equal(countPdfPages(pdfBytes), 1);
});

test("item tables continue on a new page when there are many rows", async () => {
  const document = createInvoice({
    title: "Facture multi-pages",
    footer: "IC Labs SARL",
    items: Array.from({ length: 80 }, (_, index) => ({
      name: `Ligne ${index + 1}`,
      description: "Prestation recurrente",
      quantity: 1,
      price: 100,
      unit: "service"
    }))
  });

  const pdfBytes = await document.toPDF();

  assert.ok(countPdfPages(pdfBytes) > 1, "expected the PDF to span multiple pages");
});
