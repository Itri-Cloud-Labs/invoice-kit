# @ic-labs/invoice-kit

TypeScript library for generating Moroccan business documents as PDFs.

It is designed for real business usage, not a demo. The package provides typed document factories, business calculations, French and Arabic labels, Moroccan invoice defaults, and PDF generation for:

- `Facture` / invoice
- `Devis` / quote
- `Bon de commande` / purchase order
- `Bon de livraison` / delivery note

## Features

- Strict TypeScript API
- Node.js 18+
- Lightweight runtime based on `pdfkit`
- Clean factories for all document types
- Automatic subtotal, discount, VAT, taxable base, and total calculations
- Moroccan defaults:
  - currency: `MAD`
  - VAT label: `TVA`
  - date format: `dd/MM/yyyy`
  - company identifiers: `ICE`, `IF`, `RC`
- French labels by default
- Arabic labels with `locale: "ar-MA"`
- Bank details support:
  - local transfer: bank name, holder name, RIB
  - international transfer: bank name, holder name, SWIFT, IBAN
- Remote logo URL support in PDF headers
- Optional multiline footer rendered at the extreme bottom of the page
- Delivery notes rendered without pricing information

## Installation

```bash
npm install @ic-labs/invoice-kit
```

## Quick Start

```ts
import { createInvoice } from "@ic-labs/invoice-kit";

const invoice = createInvoice({
  number: "FAC-2026-0001",
  issuer: {
    name: "IC Labs SARL",
    logo: "https://example.com/assets/logo.png",
    addressLines: ["Casablanca, Maroc"],
    ice: "001234567890123",
    if: "12345678",
    rc: "56789"
  },
  seller: {
    name: "IC Distribution SARL",
    addressLines: ["Casablanca, Maroc"],
    ice: "001234567890123",
    if: "12345678",
    rc: "56789"
  },
  client: {
    name: "Client Demo",
    addressLines: ["Rabat, Maroc"]
  },
  items: [
    {
      name: "Service de conseil",
      quantity: 1,
      price: 1000
    }
  ],
  vatRate: 0.2,
  paymentTerms: {
    label: "Paiement sous 30 jours"
  },
  footer: "IC Labs SARL\ncontact@iclabs.ma\n+212600000000",
  bankInfo: {
    type: "local",
    bankName: "Attijariwafa Bank",
    holderName: "IC Labs SARL",
    rib: "007 810 000123456789012345"
  }
});

await invoice.toPDF("./invoice.pdf");
```

## Public API

```ts
import {
  createDeliveryNote,
  createInvoice,
  createPurchaseOrder,
  createQuote
} from "@ic-labs/invoice-kit";
```

Each factory returns a `BusinessDocument` instance.

### `BusinessDocument`

- `toJSON(): BusinessDocumentData`
- `toPDF(outputPathOrOptions?): Promise<Uint8Array>`

Examples:

```ts
const bytes = await invoice.toPDF();
```

```ts
await invoice.toPDF("./invoice.pdf");
```

```ts
await invoice.toPDF({
  outputPath: "./invoice.pdf"
});
```

## Document Factories

### `createInvoice(input)`

Creates a financial invoice with totals, discounts, VAT, bank details, and payment terms.

### `createQuote(input)`

Creates a quote/devis with the same financial model as invoices.

### `createPurchaseOrder(input)`

Creates a purchase order with pricing and totals.

### `createDeliveryNote(input)`

Creates a delivery note without pricing display in the PDF.

Important behavior for delivery notes:

- item prices are not required
- pricing columns are hidden in the PDF
- totals are hidden in the PDF
- `discounts`, `vatRate`, `paymentTerms`, and `bankInfo` may exist in input but are not rendered as financial output
- internal totals are normalized to zero for delivery notes

## Input Reference

All document factories accept a typed object shaped like `DocumentInput`.

### Required fields

- `number: string`
- `issuer: Issuer`
- `seller: Party`
- `client: Party`
- `items: LineItemInput[]`

### Common optional fields

- `issueDate?: Date`
- `dueDate?: Date`
- `currency?: string`
- `vatRate?: number`
- `discounts?: DiscountInput[]`
- `notes?: string`
- `footer?: string`
- `paymentTerms?: PaymentTerms`
- `bankInfo?: BankInfo`
- `locale?: "fr-MA" | "ar-MA"`
- `title?: string`

### `footer`

- `footer` is an optional string rendered centered at the extreme bottom of the PDF
- multiline strings are supported with `\n`
- when multiple lines are provided, rendering starts higher so the last line ends at the bottom edge
- if `footer` is omitted, the PDF falls back to the document title and number in the footer area

### `Issuer`

```ts
interface Issuer extends Party {
  logo?: string;
}
```

`issuer` is the document emitter and the source of header branding.

- `issuer.logo` is the logo rendered in the PDF header
- `issuer.name` is rendered in the header brand block
- issuer address and business identifiers render directly below the issuer name in the header

### `seller`

`seller` is the commercial party shown in the document body.

- `seller` remains separate from `issuer`
- use `issuer` for brand/emitter identity and header logo
- use `seller` for the legal or operational selling entity shown in the document sections

### `Party`

```ts
interface Party {
  name: string;
  addressLines: string[];
  email?: string;
  phone?: string;
  city?: string;
  country?: string;
  taxId?: string;
  ice?: string;
  if?: string;
  rc?: string;
}
```

Notes:

- `addressLines` must contain at least one line
- issuer identifiers `ICE`, `IF`, and `RC` are rendered directly inside issuer details
- seller identifiers `ICE`, `IF`, and `RC` are rendered in the seller section when provided

### `LineItemInput`

```ts
interface LineItemInput {
  name: string;
  description?: string;
  quantity: number;
  unitPrice?: number;
  price?: number;
  unit?: string;
  discountRate?: number;
}
```

Notes:

- financial documents require either `unitPrice` or `price`
- delivery notes do not require pricing
- `discountRate` is a decimal ratio, for example:
  - `0.1` for 10%
  - `0.05` for 5%

### `DiscountInput`

```ts
interface DiscountInput {
  type: "percentage" | "fixed";
  value: number;
  label?: string;
}
```

Examples:

```ts
{ type: "fixed", value: 150, label: "Remise commerciale" }
```

```ts
{ type: "percentage", value: 0.02, label: "Escompte" }
```

### `PaymentTerms`

```ts
interface PaymentTerms {
  label: string;
  dueDate?: Date;
  notes?: string;
}
```

### `BankInfo`

#### Local transfer

```ts
{
  type: "local",
  bankName: "Attijariwafa Bank",
  holderName: "IC Labs SARL",
  rib: "007 810 000123456789012345"
}
```

#### International transfer

```ts
{
  type: "international",
  bankName: "BMCI Corporate",
  holderName: "IC Labs SARL",
  swiftCode: "BMCIMAMC",
  iban: "MA64001122000001234567890123"
}
```

## Financial Model

For invoices, quotes, and purchase orders, the package calculates:

- line subtotal
- line discount amount
- line total
- subtotal
- document discount total
- taxable base
- VAT amount
- grand total

### VAT

- default VAT rate is `0.2`
- VAT is displayed as `TVA`
- rate input uses decimal form:
  - `0.2` = 20%
  - `0.1` = 10%
  - `0` = 0%

### Currency

- default currency is `MAD`
- amounts are formatted with two decimals

## Moroccan Business Context

The package is tailored for Morocco:

- `MAD` default currency
- `TVA` terminology
- issuer company fields:
- seller company fields:
  - `ICE`
  - `IF`
  - `RC`
- French-first labels
- Arabic labels available via locale
- date formatting in `dd/MM/yyyy`

## Localization

Supported locales:

- `fr-MA`
- `ar-MA`

Example:

```ts
const quote = createQuote({
  number: "DEV-2026-0012",
  locale: "ar-MA",
  issuer: {
    name: "IC Labs SARL",
    addressLines: ["Casablanca"]
  },
  seller: {
    name: "IC Distribution SARL",
    addressLines: ["Casablanca"]
  },
  client: {
    name: "Client",
    addressLines: ["Rabat"]
  },
  items: [{ name: "Audit", quantity: 1, price: 1200 }]
});
```

### Arabic PDF rendering

Arabic labels are supported, but Arabic PDFs require Arabic-capable font files when calling `toPDF()`.

```ts
await quote.toPDF({
  outputPath: "./devis-ar.pdf",
  fonts: {
    regular: "./fonts/NotoSansArabic-Regular.ttf",
    bold: "./fonts/NotoSansArabic-Bold.ttf"
  }
});
```

Without custom fonts, Arabic glyph rendering is not reliable in PDF output.

## Remote Logo Support

You can pass a remote image URL through `issuer.logo`.

```ts
issuer: {
  name: "IC Labs SARL",
  logo: "https://example.com/assets/logo.png",
  addressLines: ["Casablanca"]
}
```

Behavior:

- the library fetches `issuer.logo` itself during `toPDF()`
- the user only provides the URL
- the logo is rendered in the document header

Currently supported remote image formats:

- `PNG`
- `JPEG` / `JPG`

Currently rejected remote image formats:

- `SVG`
- `WEBP`

Why:

- `pdfkit` does not natively embed `SVG` or `WEBP`
- this package intentionally keeps dependencies light and does not bundle image conversion tooling

## Validation Rules

The library validates document input before building the document model.

Examples of enforced rules:

- `number` must be present
- issuer and client names must be non-empty
- issuer, seller, and client must have at least one address line
- seller and client names must be non-empty
- `items` must contain at least one line item
- quantity must be greater than zero
- financial documents require `unitPrice` or `price`
- negative prices are rejected
- negative discounts are rejected
- `vatRate` must be between `0` and `1`
- `issuer.logo` must be a valid `http` or `https` URL
- bank fields must be present according to bank mode

## Rendering Behavior

### Financial documents

Invoices, quotes, and purchase orders render:

- issuer block
- seller block
- client block
- issue/due date
- currency
- item table with amount columns
- totals section
- payment terms
- bank details
- notes
- footer

### Delivery notes

Delivery notes render:

- issuer block
- seller block
- client block
- issue/due date
- item table with designation and quantity only
- notes
- footer

Delivery notes do not render:

- unit price
- amount
- subtotal
- discount
- VAT
- total
- bank details
- payment terms block

## Examples

### Invoice with international transfer info

```ts
import { createInvoice } from "@ic-labs/invoice-kit";

const invoice = createInvoice({
  number: "FAC-2026-0020",
  issuer: {
    name: "IC Labs SARL",
    addressLines: ["Casablanca"],
    ice: "001234567890123",
    if: "12345678",
    rc: "56789"
  },
  seller: {
    name: "IC Distribution SARL",
    addressLines: ["Casablanca"]
  },
  client: {
    name: "Noxel SAS",
    addressLines: ["Paris"]
  },
  items: [
    {
      name: "ERP Deployment",
      quantity: 3,
      price: 1800,
      unit: "jour"
    }
  ],
  vatRate: 0.2,
  footer: "IC Labs SARL\ncontact@iclabs.ma",
  bankInfo: {
    type: "international",
    bankName: "BMCI Corporate",
    holderName: "IC Labs SARL",
    swiftCode: "BMCIMAMC",
    iban: "MA64001122000001234567890123"
  }
});
```

### Quote with local bank details

```ts
import { createQuote } from "@ic-labs/invoice-kit";

const quote = createQuote({
  number: "DEV-2026-0012",
  issuer: {
    name: "IC Labs SARL",
    addressLines: ["Casablanca"]
  },
  seller: {
    name: "IC Distribution SARL",
    addressLines: ["Casablanca"]
  },
  client: {
    name: "Client",
    addressLines: ["Rabat"]
  },
  items: [
    {
      name: "Audit",
      quantity: 1,
      price: 1200
    }
  ],
  discounts: [{ type: "percentage", value: 0.05, label: "Remise devis" }],
  footer: "Validite 15 jours\nwww.iclabs.ma",
  bankInfo: {
    type: "local",
    bankName: "Attijariwafa Bank",
    holderName: "IC Labs SARL",
    rib: "007 810 000123456789012345"
  }
});
```

### Delivery note without pricing

```ts
import { createDeliveryNote } from "@ic-labs/invoice-kit";

const deliveryNote = createDeliveryNote({
  number: "BL-2026-0015",
  issuer: {
    name: "IC Labs SARL",
    addressLines: ["Casablanca"]
  },
  seller: {
    name: "IC Distribution SARL",
    addressLines: ["Casablanca"]
  },
  client: {
    name: "Client",
    addressLines: ["Rabat"]
  },
  items: [
    { name: "Laptop", quantity: 2, unit: "piece" },
    { name: "Mouse", quantity: 3, unit: "piece" }
  ],
  notes: "Marchandise remise au responsable du site.",
  footer: "Reception marchandise\nSignature et cachet"
});
```

## Development

Available scripts:

- `npm run typecheck`
- `npm run build`
- `npm run smoke`

## Publishing

The repository is configured for GitHub Actions based publishing.

Current release model:

- CI runs on pushes and pull requests
- publish workflow runs on pushes to `main`
- npm publish only happens if the current `package.json` version does not already exist on npm

That means a release requires a version bump before pushing to `main`.

## Limitations

- multi-page table layout is not implemented yet
- remote logos currently support PNG/JPEG only
- Arabic PDF output requires custom fonts
- delivery notes intentionally do not display financial values

## License

MIT
