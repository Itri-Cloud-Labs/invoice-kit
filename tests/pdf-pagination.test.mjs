import assert from "node:assert/strict";
import test from "node:test";
import { inflateSync } from "node:zlib";
import {
  createDeliveryNote,
  createInvoice,
  createPriceRequest,
  createPurchaseOrder,
  createQuote,
  createReturnNote
} from "../dist/index.js";

const countPdfPages = (bytes) => {
  const pageMatches = Buffer.from(bytes).toString("latin1").match(/\/Type \/Page\b/g);
  return pageMatches?.length ?? 0;
};

const readPdfContentStreams = (bytes) => {
  const pdf = Buffer.from(bytes);
  const streamMarker = Buffer.from("stream\n");
  const endMarker = Buffer.from("\nendstream");
  const streams = [];
  let offset = 0;

  while (offset < pdf.length) {
    const start = pdf.indexOf(streamMarker, offset);
    if (start === -1) break;
    const contentStart = start + streamMarker.length;
    const end = pdf.indexOf(endMarker, contentStart);
    if (end === -1) break;

    try {
      streams.push(inflateSync(pdf.subarray(contentStart, end)).toString("latin1"));
    } catch {
      // Ignore non-Flate streams such as embedded images and fonts.
    }
    offset = end + endMarker.length;
  }

  return streams;
};

const readPdfTextBlocks = (bytes) =>
  readPdfContentStreams(bytes).flatMap((stream) =>
    [...stream.matchAll(/BT\s+([\s\S]*?)\s+ET/g)].map(([, body]) => {
      const matrix = body.match(/1 0 0 1 ([\d.-]+) ([\d.-]+) Tm/);
      const text = [...body.matchAll(/<([\da-f]+)>/gi)]
        .map(([, hex]) => Buffer.from(hex, "hex").toString("latin1"))
        .join("");
      return {
        text,
        x: matrix ? Number(matrix[1]) : undefined,
        y: matrix ? Number(matrix[2]) : undefined
      };
    })
  );

const readTableRectangles = (bytes) =>
  readPdfContentStreams(bytes).flatMap((stream) =>
    [...stream.matchAll(/^48 ([\d.]+) 499\.28 ([\d.]+) re$/gm)].map(([, y, height]) => ({
      y: Number(y),
      height: Number(height)
    }))
  );

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

test("long item names wrap without ellipses in every supported document type", async () => {
  const longName =
    "LEGAL PRODUCT NAME START ROYAL SUPER ENGINE OIL PETROL SAE 5W-30 API SN/CF CARTON 12x1L COMPLETE PRODUCT DESIGNATION END";
  const followingName = "FOLLOWING ROW MUST NOT OVERLAP";
  const factories = [
    ["invoice", createInvoice],
    ["quote", createQuote],
    ["purchase order", createPurchaseOrder],
    ["delivery note", createDeliveryNote],
    ["return note", createReturnNote],
    ["price request", createPriceRequest]
  ];

  for (const [documentType, createDocument] of factories) {
    const pdfBytes = await createDocument({
      items: [
        { name: longName, quantity: 1, price: 100 },
        { name: followingName, quantity: 2, price: 50 }
      ]
    }).toPDF();
    const blocks = readPdfTextBlocks(pdfBytes);
    const renderedText = blocks.map(({ text }) => text).join("");
    const followingRow = blocks.find(({ text }) => text.includes(followingName));
    const itemStart = renderedText.indexOf(longName);
    let textOffset = 0;
    const itemLines = blocks.filter(({ text }) => {
      const blockStart = textOffset;
      const blockEnd = textOffset + text.length;
      textOffset = blockEnd;
      return blockEnd > itemStart && blockStart < itemStart + longName.length;
    });

    assert.ok(renderedText.includes(longName), `${documentType} must render the complete item name`);
    assert.ok(!renderedText.includes("..."), `${documentType} must not insert an ellipsis`);
    assert.ok(itemLines.length > 1, `${documentType} must wrap the item name across lines`);
    assert.notEqual(
      itemLines[0].y,
      itemLines.at(-1).y,
      `${documentType} must render wrapped lines at different vertical positions`
    );
    assert.ok(followingRow, `${documentType} must render the subsequent row`);
    assert.ok(
      followingRow.y < itemLines.at(-1).y,
      `${documentType} must place the subsequent row below the wrapped item name`
    );

    if (
      documentType === "delivery note"
      || documentType === "return note"
      || documentType === "price request"
    ) {
      const rowRectangles = readTableRectangles(pdfBytes).filter(({ height }) => height !== 28);
      assert.ok(
        rowRectangles.some(({ height }) => height > 30),
        `${documentType} must expand the row beyond its minimum height`
      );
    }
  }
});
