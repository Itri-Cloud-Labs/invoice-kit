// Renders the demo input with the real library so the site can offer
// the exact PDFs its previews stand in for. Run after building packages/typescript.
import { createServer } from "node:http";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as kit from "../../packages/typescript/dist/index.js";
import * as sample from "../src/demo/sample-data.js";

const outDir = fileURLToPath(new URL("../public/samples/", import.meta.url));
const logoPath = fileURLToPath(new URL("../public/demo-logo.svg", import.meta.url));

const logo = await readFile(logoPath).catch(() => null);
const server = createServer((_request, response) => {
  response.writeHead(200, { "Content-Type": "image/svg+xml" });
  response.end(logo);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const logoUrl = `http://127.0.0.1:${server.address().port}/logo.svg`;

const base = (type) => ({
  number: sample.numbers[type],
  issueDate: new Date(sample.issueDate),
  issuer: { ...sample.issuer, ...(logo ? { logo: logoUrl } : {}) },
  seller: sample.seller,
  client: sample.client,
  items: sample.items,
  notes: sample.notes,
  footer: sample.footer
});

const financial = (type) => ({
  ...base(type),
  dueDate: new Date(sample.dueDate),
  discounts: sample.discounts,
  paymentTerms: sample.paymentTerms,
  bankInfo: sample.bankInfo
});

const documents = {
  "facture": kit.createInvoice({ ...financial("invoice"), title: "Facture" }),
  "devis": kit.createQuote({ ...financial("quote"), title: "Devis" }),
  "bon-de-commande": kit.createPurchaseOrder({ ...financial("purchaseOrder"), title: "Bon de commande" }),
  "bon-de-livraison": kit.createDeliveryNote({ ...base("deliveryNote"), title: "Bon de livraison" }),
  "bon-de-retour": kit.createReturnNote({ ...base("returnNote"), title: "Bon de retour" }),
  "demande-de-prix": kit.createPriceRequest(base("priceRequest")),
  "facture-invoice-kit": kit.createInvoice(sample.receipt)
};

try {
  await mkdir(outDir, { recursive: true });
  for (const [name, document] of Object.entries(documents)) {
    await document.toPDF(`${outDir}${name}.pdf`);
    console.log(`samples/${name}.pdf`);
  }
} finally {
  server.close();
}
