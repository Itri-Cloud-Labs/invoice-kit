import assert from "node:assert/strict";
import test from "node:test";
import { createDeliveryNote, createInvoice, computeLineItem, computeTotals } from "../dist/index.js";
import { resolvePdfFonts } from "../dist/renderers/pdf-support.js";

test("computeTotals clamps oversized discounts to zero taxable base", () => {
  const items = [computeLineItem({ name: "Audit", quantity: 1, price: 100 })];
  const totals = computeTotals(items, [{ type: "fixed", value: 500 }], 0.2);

  assert.deepEqual(totals, {
    subtotal: 100,
    discountTotal: 100,
    taxableBase: 0,
    vatAmount: 0,
    total: 0
  });
});

test("computeTotals supports zero VAT", () => {
  const items = [computeLineItem({ name: "Support", quantity: 2, price: 125 })];
  const totals = computeTotals(items, [], 0);

  assert.equal(totals.subtotal, 250);
  assert.equal(totals.taxableBase, 250);
  assert.equal(totals.vatAmount, 0);
  assert.equal(totals.total, 250);
});

test("document colors must use hex values", () => {
  assert.throws(
    () => createInvoice({ colors: { primary: "purple" } }),
    /colors\.primary must be a valid hex color/
  );
});

test("issuer logo must be a valid http or https URL", () => {
  assert.throws(
    () => createInvoice({ issuer: { name: "IC Labs", logo: "ftp://example.com/logo.png" } }),
    /issuer\.logo must be a valid http or https URL/
  );
});

test("sparse invoices preserve omitted top-level modules", () => {
  const invoice = createInvoice({ title: "Facture simplifiee" }).toJSON();

  assert.deepEqual(invoice, {
    type: "invoice",
    locale: "fr-MA",
    title: "Facture simplifiee"
  });
});

test("delivery notes omit financial summaries from document data", () => {
  const deliveryNote = createDeliveryNote({
    title: "Bon de livraison",
    vatRate: 0.2,
    discounts: [{ type: "fixed", value: 100 }],
    items: [{ name: "Produit", quantity: 2, unit: "piece" }]
  }).toJSON();

  assert.equal(deliveryNote.type, "deliveryNote");
  assert.equal(deliveryNote.locale, "fr-MA");
  assert.ok(!("vatRate" in deliveryNote));
  assert.ok(!("discounts" in deliveryNote));
  assert.ok(!("totals" in deliveryNote));
});

test("Arabic rendering reuses a single explicit font path when only one is provided", () => {
  const fonts = resolvePdfFonts(
    { type: "quote", locale: "ar-MA" },
    { fonts: { regular: "./fonts/NotoSansArabic-Regular.ttf" } }
  );

  assert.deepEqual(fonts, {
    regular: "./fonts/NotoSansArabic-Regular.ttf",
    bold: "./fonts/NotoSansArabic-Regular.ttf"
  });
});
