import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createDeliveryNote, createInvoice, createPriceRequest } from "../dist/index.js";

const fixtureUrl = new URL("../../../fixtures/compatibility/documents.json", import.meta.url);
const fixtures = JSON.parse(await readFile(fixtureUrl, "utf8"));

test("TypeScript matches the shared financial fixture", () => {
  const source = fixtures.financial.input;
  const document = createInvoice({
    items: source.items.map(({ unit_price, discount_rate, ...item }) => ({
      ...item,
      ...(unit_price === undefined ? {} : { unitPrice: unit_price }),
      ...(discount_rate === undefined ? {} : { discountRate: discount_rate })
    })),
    discounts: source.discounts,
    vatRate: source.vat_rate,
    currency: source.currency
  }).toJSON();
  assert.deepEqual(document.totals, {
    subtotal: fixtures.financial.expected.subtotal,
    discountTotal: fixtures.financial.expected.discount_total,
    taxableBase: fixtures.financial.expected.taxable_base,
    vatAmount: fixtures.financial.expected.vat_amount,
    total: fixtures.financial.expected.total
  });
});

test("TypeScript matches shared quantity-only and localization fixtures", () => {
  const source = fixtures.quantity_only.input.items[0];
  const delivery = createDeliveryNote({
    items: [{ name: source.name, quantity: source.quantity, unitPrice: source.unit_price }]
  }).toJSON();
  assert.equal(delivery.items[0].unitPrice, 0);
  assert.equal(delivery.items[0].lineTotal, 0);
  assert.equal(createPriceRequest({}).toJSON().title, fixtures.localization["fr-MA"]);
  assert.equal(
    createPriceRequest({ locale: "ar-MA" }).toJSON().title,
    fixtures.localization["ar-MA"]
  );
});
