import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import {
  createDeliveryNote,
  createInvoice,
  createPriceRequest,
  createReturnNote
} from "../dist/index.js";
import { createTemplateDefinition } from "../dist/templates/definitions.js";

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

test("return notes accept quantity-only items and normalize prices to zero", () => {
  const returnNote = createReturnNote({
    items: [{ name: "Laptop", quantity: 2, unit: "piece" }],
    discounts: [{ type: "fixed", value: 100 }],
    vatRate: 0.2
  }).toJSON();

  assert.equal(returnNote.type, "returnNote");
  assert.equal(returnNote.items?.[0]?.unitPrice, 0);
  assert.equal(returnNote.items?.[0]?.lineTotal, 0);
  assert.ok(!("vatRate" in returnNote));
  assert.ok(!("discounts" in returnNote));
  assert.ok(!("totals" in returnNote));
});

test("price requests use a localized title and quantity-only items", () => {
  const priceRequest = createPriceRequest({
    items: [{
      name: "Laptop",
      quantity: 10,
      unit: "piece",
      price: 900,
      discountRate: 0.1
    }],
    discounts: [{ type: "fixed", value: 100 }],
    vatRate: 0.2,
    paymentTerms: { label: "30 jours" },
    bankInfo: {
      type: "local",
      bankName: "Bank",
      holderName: "IC Labs",
      rib: "001 002 003"
    }
  }).toJSON();

  assert.equal(priceRequest.type, "priceRequest");
  assert.equal(priceRequest.title, "Demande de prix");
  assert.equal(priceRequest.items?.[0]?.unitPrice, 0);
  assert.equal(priceRequest.items?.[0]?.lineSubtotal, 0);
  assert.equal(priceRequest.items?.[0]?.lineDiscountAmount, 0);
  assert.equal(priceRequest.items?.[0]?.lineTotal, 0);
  assert.ok(!("vatRate" in priceRequest));
  assert.ok(!("discounts" in priceRequest));
  assert.ok(!("totals" in priceRequest));
  assert.equal(createTemplateDefinition("priceRequest").getTitle("fr-MA"), "Demande de prix");
  assert.equal(createTemplateDefinition("priceRequest").getTitle("ar-MA"), "طلب عرض أسعار");
});

test("price requests use the Arabic default title and preserve custom titles", () => {
  assert.equal(
    createPriceRequest({ locale: "ar-MA" }).toJSON().title,
    "طلب عرض أسعار"
  );
  assert.equal(
    createPriceRequest({ title: "Consultation fournisseurs" }).toJSON().title,
    "Consultation fournisseurs"
  );
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

test("Arabic PDFs render without explicit fonts thanks to the bundled fallback", async () => {
  const invoice = createInvoice({
    locale: "ar-MA",
    title: "فاتورة",
    issuer: { name: "مختبرات آي سي" },
    client: { name: "عميل تجريبي" },
    items: [{ name: "خدمة", quantity: 1, price: 100 }]
  });

  const pdfBytes = await invoice.toPDF();

  assert.ok(pdfBytes.length > 0);
});

test("PDF spacing can be customized per render", async () => {
  const invoice = createInvoice({
    issuer: { name: "IC Labs SARL" },
    seller: { name: "IC Distribution" },
    client: { name: "Atlas Trading" },
    items: [{ name: "Audit", quantity: 1, price: 100 }],
    bankInfo: {
      type: "local",
      bankName: "Bank",
      holderName: "IC Labs SARL",
      rib: "001 002 003"
    }
  });

  const pdfBytes = await invoice.toPDF({
    spacing: {
      headerToParties: 40,
      partiesToTable: 30,
      tableToSummary: 26,
      detailLineGap: 3,
      tableRowMinHeight: 34
    }
  });

  assert.ok(pdfBytes.length > 0);
});

test("PDF spacing rejects negative and non-finite values", async () => {
  const invoice = createInvoice({
    items: [{ name: "Audit", quantity: 1, price: 100 }]
  });

  await assert.rejects(
    invoice.toPDF({ spacing: { headerToParties: -1 } }),
    /options\.spacing\.headerToParties must be a non-negative finite number/
  );
  await assert.rejects(
    invoice.toPDF({ spacing: { titleToMetadata: Number.POSITIVE_INFINITY } }),
    /options\.spacing\.titleToMetadata must be a non-negative finite number/
  );
});

test("explicit font file paths work with the self-contained PDF runtime", async () => {
  const regularFont = fileURLToPath(new URL(
    "../node_modules/dejavu-fonts-ttf/ttf/DejaVuSans.ttf",
    import.meta.url
  ));
  const invoice = createInvoice({
    locale: "ar-MA",
    title: "فاتورة",
    items: [{ name: "خدمة", quantity: 1, price: 100 }]
  });

  const pdfBytes = await invoice.toPDF({ fonts: { regular: regularFont } });

  assert.ok(pdfBytes.length > 0);
});

test("remote SVG logos are converted and rendered", async () => {
  const { url, close } = await startTestServer((request, response) => {
    if (request.url === "/logo.svg") {
      response.writeHead(200, { "Content-Type": "image/svg+xml" });
      response.end('<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><rect width="12" height="12" fill="#7c3aed" /></svg>');
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

    const pdfBytes = await invoice.toPDF();

    assert.ok(pdfBytes.length > 0);
  } finally {
    await close();
  }
});

test("remote WEBP logos are converted and rendered", async () => {
  const webpBuffer = await sharp({
    create: {
      width: 12,
      height: 12,
      channels: 4,
      background: { r: 23, g: 61, b: 115, alpha: 1 }
    }
  }).webp().toBuffer();

  const { url, close } = await startTestServer((request, response) => {
    if (request.url === "/logo.webp") {
      response.writeHead(200, { "Content-Type": "image/webp" });
      response.end(webpBuffer);
      return;
    }

    response.writeHead(404);
    response.end();
  });

  try {
    const invoice = createInvoice({
      issuer: {
        name: "IC Labs SARL",
        logo: `${url}/logo.webp`
      },
      items: [{ name: "Audit", quantity: 1, price: 100 }]
    });

    const pdfBytes = await invoice.toPDF();

    assert.ok(pdfBytes.length > 0);
  } finally {
    await close();
  }
});
