import type { BankInfo, BusinessDocumentData, DocumentColors, Party, PdfFontSource, PdfRenderOptions } from "../core/types.js";
import { getLabels } from "../locales/index.js";
import {
  drawText,
  formatLabelValue,
  isolate,
  measureTextHeight,
  measureTextWidth,
  resolveBundledArabicFonts,
  type PdfFontPair
} from "./pdf-text.js";

export const PAGE = {
  margin: 48,
  width: 595.28,
  height: 841.89,
  footerOffset: 64,
  headerTop: 42,
  lineGap: 14
};

export const DEFAULT_COLORS: Required<DocumentColors> = {
  primary: "#173d73",
  onPrimary: "#ffffff",
  text: "#111827",
  metaText: "#4b5563",
  mutedText: "#6b7280",
  border: "#d1d5db",
  footerText: "#9ca3af"
};

const isPngBuffer = (buffer: Uint8Array): boolean =>
  buffer.length >= 8
  && buffer[0] === 0x89
  && buffer[1] === 0x50
  && buffer[2] === 0x4e
  && buffer[3] === 0x47;

const isJpegBuffer = (buffer: Uint8Array): boolean =>
  buffer.length >= 3
  && buffer[0] === 0xff
  && buffer[1] === 0xd8
  && buffer[2] === 0xff;

const normalizeFontPair = (regular?: PdfFontSource, bold?: PdfFontSource): PdfFontPair | undefined => {
  if (!regular && !bold) {
    return undefined;
  }

  return {
    regular: regular ?? bold!,
    bold: bold ?? regular!
  };
};

export const collectPdf = async (doc: PDFKit.PDFDocument): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    doc.on("end", () => {
      resolve(new Uint8Array(Buffer.concat(chunks)));
    });

    doc.on("error", reject);
  });

export const fetchLogo = async (logoUrl: string): Promise<ArrayBuffer> => {
  const response = await fetch(logoUrl);

  if (!response.ok) {
    throw new Error(`Unable to fetch logo from ${logoUrl}: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = response.headers.get("content-type") ?? "";

  if (isPngBuffer(buffer) || isJpegBuffer(buffer)) {
    return arrayBuffer;
  }

  try {
    const { default: sharp } = await import("sharp");
    const pipeline = contentType.includes("svg") ? sharp(buffer, { density: 300 }) : sharp(buffer);
    return new Uint8Array(await pipeline.png().toBuffer()).buffer;
  } catch {
    throw new Error(
      `Unsupported logo format at ${logoUrl}. Remote logos currently support PNG, JPEG, SVG, and WEBP.`
    );
  }
};

export const resolvePdfFonts = (
  document: BusinessDocumentData,
  options?: PdfRenderOptions
): { regular?: PdfFontSource; bold?: PdfFontSource } | undefined => {
  const explicitFonts = normalizeFontPair(options?.fonts?.regular, options?.fonts?.bold);

  if (document.locale !== "ar-MA") {
    return explicitFonts;
  }

  if (explicitFonts) {
    return explicitFonts;
  }

  return resolveBundledArabicFonts();
};

export const truncateText = (doc: PDFKit.PDFDocument, value: string, width: number): string => {
  if (measureTextWidth(doc, value) <= width) {
    return value;
  }

  let truncated = value;
  while (truncated.length > 0 && measureTextWidth(doc, `${truncated}...`) > width) {
    truncated = truncated.slice(0, -1);
  }

  return truncated.length > 0 ? `${truncated}...` : "...";
};

export const drawFixedText = drawText;

export const normalizeFooterText = (footer: string): string =>
  footer
    .split(/\r?\n/)
    .map((line) => line.trim())
    .join("\n");

export const ensureSectionSpace = (
  doc: PDFKit.PDFDocument,
  y: number,
  requiredHeight: number,
  contentBottom = PAGE.height - PAGE.margin - 8
): number => {
  if (y + requiredHeight <= contentBottom) {
    return y;
  }

  doc.addPage();
  return PAGE.margin;
};

export const drawLabelValue = (
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  label: string,
  value: string,
  width: number,
  align: "left" | "right",
  color: string
): number => {
  doc.fillColor(color).fontSize(10);
  return drawFixedText(doc, formatLabelValue(label, value), x, y, { width, align });
};

export const resolveColors = (colors?: DocumentColors): Required<DocumentColors> => ({
  ...DEFAULT_COLORS,
  ...colors
});

const getWrappedRowHeight = (
  doc: PDFKit.PDFDocument,
  text: string,
  width: number,
  minHeight: number,
  options: PDFKit.Mixins.TextOptions,
  verticalPadding: number
): number => {
  const textHeight = measureTextHeight(doc, text, { ...options, width });
  return Math.max(minHeight, Math.ceil(textHeight + verticalPadding));
};

export const getMaxRowHeight = (
  doc: PDFKit.PDFDocument,
  cells: Array<{ text: string; width: number; options: PDFKit.Mixins.TextOptions }>,
  minHeight: number,
  verticalPadding = 16
): number => cells.reduce((maxHeight, cell) => (
  Math.max(maxHeight, getWrappedRowHeight(doc, cell.text, cell.width, minHeight, cell.options, verticalPadding))
), minHeight);

export const buildPartyLines = (party: Party | undefined, labels: ReturnType<typeof getLabels>, includeName = true): string[] => {
  if (!party) {
    return [];
  }

  return [
    includeName ? isolate(party.name ?? "") : "",
    ...(party.addressLines ?? []).map(isolate),
    isolate([party.city, party.country].filter(Boolean).join(labels.listSeparator)),
    party.phone ? formatLabelValue(labels.phone, party.phone) : "",
    party.email ? formatLabelValue(labels.email, party.email) : "",
    party.taxId ? formatLabelValue(labels.if, party.taxId) : "",
    party.ice ? formatLabelValue(labels.ice, party.ice) : "",
    party.if ? formatLabelValue(labels.if, party.if) : "",
    party.rc ? formatLabelValue(labels.rc, party.rc) : ""
  ].filter((line) => line.length > 0);
};

export const buildBankLines = (bankInfo: BankInfo, labels: ReturnType<typeof getLabels>): string[] => {
  const baseLines = [
    formatLabelValue(labels.bankName, bankInfo.bankName),
    formatLabelValue(labels.holderName, bankInfo.holderName)
  ];

  if (bankInfo.type === "local") {
    return [...baseLines, formatLabelValue(labels.rib, bankInfo.rib)];
  }

  return [
    ...baseLines,
    formatLabelValue(labels.swiftCode, bankInfo.swiftCode),
    formatLabelValue(labels.iban, bankInfo.iban)
  ];
};
