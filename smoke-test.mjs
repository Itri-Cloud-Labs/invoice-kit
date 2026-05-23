import { createServer } from "node:http";
import {
  createDeliveryNote,
  createInvoice,
  createPurchaseOrder,
  createQuote
} from "./dist/index.js";

const logoPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7i0AAAAASUVORK5CYII=";

const startLogoServer = async () => {
  const logoBuffer = Buffer.from(logoPngBase64, "base64");

  const server = createServer((request, response) => {
    if (request.url === "/logo.png") {
      response.writeHead(200, { "Content-Type": "image/png" });
      response.end(logoBuffer);
      return;
    }

    response.writeHead(404);
    response.end();
  });

  await new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => resolve(undefined));
    server.on("error", reject);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to determine smoke test logo server address.");
  }

  return {
    close: async () => new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(undefined);
      });
    }),
    logoUrl: `http://127.0.0.1:${address.port}/logo.png`
  };
};

const { close, logoUrl } = await startLogoServer();

try {
  const baseIssuer = {
    name: "IC Labs SARL",
    logo: logoUrl,
    addressLines: ["201 Boulevard Zerktouni", "5eme etage"],
    city: "Casablanca",
    country: "Maroc",
    taxId: "TAX-MA-7788",
    ice: "001234567890123",
    if: "12345678",
    rc: "56789",
    email: "contact@iclabs.ma",
    phone: "+212600000000"
  };

  const client = {
    name: "Atlas Trading",
    addressLines: ["45 Avenue Mohammed V", "3eme etage"],
    city: "Rabat",
    country: "Maroc",
    taxId: "CLIENT-TAX-4455",
    email: "finance@atlas-trading.ma",
    phone: "+212500000000"
  };

  const seller = {
    name: "IC Distribution",
    addressLines: ["Parc logistique Sidi Maarouf", "Batiment C2"],
    city: "Casablanca",
    country: "Maroc",
    taxId: "SELLER-TAX-0099",
    ice: "009876543210987",
    if: "87654321",
    rc: "112233",
    email: "sales@icdistribution.ma",
    phone: "+212522000111"
  };

  const invoice = createInvoice({
    number: "FAC-2026-0001",
    title: "Facture ",
    locale: "fr-MA",
    issueDate: new Date("2026-05-20T09:00:00Z"),
    dueDate: new Date("2026-06-19T09:00:00Z"),
    currency: "MAD",
    vatRate: 0.2,
    issuer: baseIssuer,
    seller,
    client,
    items: [
      {
        name: "Audit comptable",
        description: "Mission de cadrage et restitution avec synthese detaillee sur plusieurs chantiers",
        quantity: 1,
        unitPrice: 2500,
        unit: "mission",
        discountRate: 0.1
      },
      {
        name: "Implementation ERP multi-societes",
        description: "Phase 1 de parametrage, accompagnement utilisateurs clefs, reprise des donnees et documentation operationnelle detaillee pour les equipes finance et support",
        quantity: 2,
        price: 1800,
        unit: "journee d'intervention sur site",
        discountRate: 0.05
      }
    ],
    discounts: [
      { type: "fixed", value: 150, label: "Remise commerciale" },
      { type: "percentage", value: 0.02, label: "Escompte" }
    ],
    paymentTerms: {
      label: "Paiement sous 30 jours",
      dueDate: new Date("2026-06-19T09:00:00Z"),
      notes: "Virement bancaire sur reception de facture."
    },
    footer: "IC Labs SARL\n+212 6 00 00 00 00\ncontact@iclabs.ma",
    bankInfo: {
      type: "international",
      bankName: "BMCI Corporate",
      holderName: "IC Labs SARL",
      swiftCode: "BMCIMAMC",
      iban: "MA64001122000001234567890123"
    },
    notes: "Merci pour votre confiance."
  });

  const quote = createQuote({
    number: "DEV-2026-0012",
    title: "Proposition commerciale ",
    locale: "fr-MA",
    issueDate: new Date("2026-05-21T10:30:00Z"),
    dueDate: new Date("2026-05-31T10:30:00Z"),
    currency: "MAD",
    vatRate: 0.2,
    issuer: baseIssuer,
    seller,
    client: {
      ...client,
      name: "Noxel SAS",
      city: "Paris",
      country: "France"
    },
    items: [
      {
        name: "Atelier discovery",
        description: "Preparation feuille de route et matrice des besoins",
        quantity: 3,
        unitPrice: 1200,
        unit: "atelier",
        discountRate: 0
      }
    ],
    discounts: [{ type: "percentage", value: 0.05, label: "Remise devis" }],
    paymentTerms: {
      label: "50% a la commande",
      dueDate: new Date("2026-05-31T10:30:00Z"),
      notes: "Validite du devis: 10 jours."
    },
    footer: "IC Labs SARL\nwww.iclabs.ma",
    bankInfo: {
      type: "local",
      bankName: "Attijariwafa Bank",
      holderName: "IC Labs SARL",
      rib: "007 810 000123456789012345"
    },
    notes: "Sous reserve de validation du perimetre."
  });

  const purchaseOrder = createPurchaseOrder({
    number: "BDC-2026-0004",
    title: "Bon de commande ",
    locale: "fr-MA",
    issueDate: new Date("2026-05-22T08:15:00Z"),
    dueDate: new Date("2026-06-05T08:15:00Z"),
    currency: "MAD",
    vatRate: 0.2,
    issuer: baseIssuer,
    seller,
    client: {
      ...client,
      name: "Fournisseur Equipement Pro",
      addressLines: ["Zone industrielle Bouskoura"],
      city: "Bouskoura"
    },
    items: [
      {
        name: "Ordinateur portable",
        description: "16Go RAM / 512Go SSD / garantie 3 ans sur site / configuration standardisee pour les equipes projet et deploiement terrain",
        quantity: 4,
        price: 9500,
        unit: "unite",
        discountRate: 0.03
      },
      {
        name: "Ecran 27 pouces",
        description: "IPS QHD reglable en hauteur",
        quantity: 4,
        unitPrice: 2700,
        unit: "unite",
        discountRate: 0
      }
    ],
    discounts: [{ type: "fixed", value: 500, label: "Remise fournisseur" }],
    paymentTerms: {
      label: "Paiement a 45 jours",
      dueDate: new Date("2026-07-06T08:15:00Z"),
      notes: "Livraison au siege de Casablanca."
    },
    footer: "Service achats IC Labs\nCasablanca - Maroc",
    bankInfo: {
      type: "local",
      bankName: "Banque Populaire",
      holderName: "Fournisseur Equipement Pro",
      rib: "144 780 000000123456789012"
    },
    notes: "Commande validee par la direction achats."
  });

  const deliveryNote = createDeliveryNote({
    number: "BL-2026-0015",
    title: "Bon de livraison ",
    locale: "fr-MA",
    issueDate: new Date("2026-05-23T07:45:00Z"),
    dueDate: new Date("2026-05-23T17:00:00Z"),
    currency: "MAD",
    vatRate: 0.2,
    issuer: baseIssuer,
    seller,
    client,
    items: [
      {
        name: "Laptop",
        description: "Serie A-445 configuration chantier avec accessoires et etiquetage inventaire",
        quantity: 2,
        unit: "piece"
      },
      {
        name: "Mouse",
        description: "Sans fil avec recepteur USB",
        quantity: 3,
        unit: "piece"
      }
    ],
    discounts: [
      { type: "fixed", value: 999, label: "Ignored for delivery note" },
      { type: "percentage", value: 0.25, label: "Ignored too" }
    ],
    paymentTerms: {
      label: "Ignored for delivery note",
      dueDate: new Date("2026-05-24T12:00:00Z"),
      notes: "This should not appear in the delivery note PDF."
    },
    footer: "Reception marchandise\nSignature et cachet",
    bankInfo: {
      type: "international",
      bankName: "Ignored Bank",
      holderName: "Ignored Holder",
      swiftCode: "IGNRMA00",
      iban: "MA00000000000000000000000000"
    },
    notes: "Marchandise remise au responsable du site."
  });

  const sparseInvoice = createInvoice({
    title: "Facture simplifiee",
    footer: "IC Labs SARL"
  });

  await invoice.toPDF({ outputPath: "./sample-invoice.pdf" });
  await quote.toPDF({ outputPath: "./sample-quote.pdf" });
  await purchaseOrder.toPDF({ outputPath: "./sample-purchase-order.pdf" });
  await deliveryNote.toPDF({ outputPath: "./sample-delivery-note.pdf" });
  await sparseInvoice.toPDF({ outputPath: "./sample-sparse-invoice.pdf" });

  console.log({
    invoice: invoice.toJSON(),
    quote: quote.toJSON(),
    purchaseOrder: purchaseOrder.toJSON(),
    deliveryNote: deliveryNote.toJSON(),
    sparseInvoice: sparseInvoice.toJSON()
  });
} finally {
  await close();
}
