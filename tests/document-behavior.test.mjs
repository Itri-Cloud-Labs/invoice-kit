import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { createDeliveryNote, createInvoice } from "../dist/index.js";

const startTestServer = async (handler) => {
  const server = createServer(handler);

  await new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => resolve(undefined));
    server.on("error", reject);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to determine test server address.");
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    close: async () => new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(undefined);
      });
    })
  };
};

test("financial documents default to Moroccan VAT only when priced items exist", () => {
  const withItems = createInvoice({
    items: [{ name: "Audit", quantity: 1, price: 100 }]
  }).toJSON();
  const withoutItems = createInvoice({ title: "Facture vide" }).toJSON();

  assert.equal(withItems.vatRate, 0.2);
  assert.equal(withItems.totals?.total, 120);
  assert.ok(!("vatRate" in withoutItems));
  assert.ok(!("totals" in withoutItems));
});

test("delivery notes accept quantity-only items and normalize prices to zero", () => {
  const deliveryNote = createDeliveryNote({
    items: [{ name: "Laptop", quantity: 2, unit: "piece" }]
  }).toJSON();

  assert.equal(deliveryNote.items?.[0]?.unitPrice, 0);
  assert.equal(deliveryNote.items?.[0]?.lineTotal, 0);
  assert.ok(!("totals" in deliveryNote));
});

test("empty footer is rejected", () => {
  assert.throws(
    () => createInvoice({ footer: "   " }),
    /footer must be a non-empty string/
  );
});

test("local bank details require a RIB", () => {
  assert.throws(
    () => createInvoice({ bankInfo: { type: "local", bankName: "Bank", holderName: "IC Labs" } }),
    /bankInfo\.rib/
  );
});

test("remote logos reject unsupported formats during PDF generation", async () => {
  const { url, close } = await startTestServer((request, response) => {
    if (request.url === "/logo.svg") {
      response.writeHead(200, { "Content-Type": "image/svg+xml" });
      response.end('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>');
      return;
    }

    response.writeHead(404);
    response.end();
  });

  try {
    const invoice = createInvoice({
      issuer: {
        name: "IC Labs SARL",
        logo: `${url}/logo.svg`
      },
      items: [{ name: "Audit", quantity: 1, price: 100 }]
    });

    await assert.rejects(
      () => invoice.toPDF(),
      /Remote logos currently support PNG and JPEG only/
    );
  } finally {
    await close();
  }
});
