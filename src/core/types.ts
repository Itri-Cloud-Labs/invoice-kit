export type DocumentType = "invoice" | "quote" | "purchaseOrder" | "deliveryNote";

export type LocaleCode = "fr-MA" | "ar-MA";

export interface Party {
  name?: string;
  addressLines?: string[];
  email?: string;
  phone?: string;
  city?: string;
  country?: string;
  taxId?: string;
  ice?: string;
  if?: string;
  rc?: string;
}

export interface Issuer extends Party {
  logo?: string;
}

export interface LineItemInput {
  name: string;
  description?: string;
  quantity: number;
  unitPrice?: number;
  price?: number;
  unit?: string;
  discountRate?: number;
}

export interface LineItem extends Omit<LineItemInput, "unitPrice" | "price"> {
  unitPrice: number;
  lineSubtotal: number;
  lineDiscountAmount: number;
  lineTotal: number;
}

export interface DiscountInput {
  type: "percentage" | "fixed";
  value: number;
  label?: string;
}

export interface PaymentTerms {
  label: string;
  dueDate?: Date;
  notes?: string;
}

export interface LocalBankInfo {
  type: "local";
  bankName: string;
  holderName: string;
  rib: string;
}

export interface InternationalBankInfo {
  type: "international";
  bankName: string;
  holderName: string;
  swiftCode: string;
  iban: string;
}

export type BankInfo = LocalBankInfo | InternationalBankInfo;

export interface DocumentColors {
  primary?: string;
  onPrimary?: string;
  text?: string;
  metaText?: string;
  mutedText?: string;
  border?: string;
  footerText?: string;
}

export interface DocumentInput {
  number?: string;
  issuer?: Issuer;
  seller?: Party;
  client?: Party;
  items?: LineItemInput[];
  issueDate?: Date;
  dueDate?: Date;
  currency?: string;
  vatRate?: number;
  discounts?: DiscountInput[];
  notes?: string;
  footer?: string;
  paymentTerms?: PaymentTerms;
  bankInfo?: BankInfo;
  colors?: DocumentColors;
  locale?: LocaleCode;
  title?: string;
}

export interface DocumentTotals {
  subtotal: number;
  discountTotal: number;
  taxableBase: number;
  vatAmount: number;
  total: number;
}

export interface BusinessDocumentData {
  type: DocumentType;
  title?: string;
  number?: string;
  issueDate?: Date;
  dueDate?: Date;
  issuer?: Issuer;
  seller?: Party;
  client?: Party;
  items?: LineItem[];
  currency?: string;
  vatRate?: number;
  discounts?: DiscountInput[];
  paymentTerms?: PaymentTerms;
  bankInfo?: BankInfo;
  notes?: string;
  footer?: string;
  colors?: DocumentColors;
  locale: LocaleCode;
  totals?: DocumentTotals;
}

export interface PdfRenderOptions {
  outputPath?: string;
  fonts?: {
    regular?: string;
    bold?: string;
  };
}

export interface TemplateLabels {
  documentTitle: string;
  seller: string;
  client: string;
  number: string;
  issueDate: string;
  dueDate: string;
  item: string;
  description: string;
  quantity: string;
  unitPrice: string;
  amount: string;
  subtotal: string;
  discount: string;
  taxableBase: string;
  vat: string;
  total: string;
  paymentTerms: string;
  bankDetails: string;
  notes: string;
  currency: string;
  bankName: string;
  holderName: string;
  rib: string;
  swiftCode: string;
  iban: string;
  ice: string;
  if: string;
  rc: string;
}

export interface TemplateDefinition {
  type: DocumentType;
  getTitle(locale: LocaleCode): string;
}

export interface CreateDocumentOptions extends DocumentInput {
  type: DocumentType;
}
