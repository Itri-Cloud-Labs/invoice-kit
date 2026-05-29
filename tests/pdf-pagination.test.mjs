import assert from "node:assert/strict";
import test from "node:test";
import { createInvoice } from "../dist/index.js";

const countPdfPages = (bytes) => {
  const pageMatches = Buffer.from(bytes).toString("latin1").match(/\/Type \/Page\b/g);
  return pageMatches?.length ?? 0;
};

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
