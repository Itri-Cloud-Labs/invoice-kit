import { createRequire } from "node:module";
import type { BankInfo, BusinessDocumentData, DocumentColors, Party, PdfRenderOptions } from "../core/types.js";
import { getLabels } from "../locales/index.js";

const require = createRequire(import.meta.url);

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

const normalizeFontPair = (regular?: string, bold?: string): { regular: string; bold: string } | undefined => {
  if (!regular && !bold) {
    return undefined;
  }

  return {
    regular: regular ?? bold!,
    bold: bold ?? regular!
  };
};

const resolveBundledArabicFonts = (): { regular: string; bold: string } => {
  try {
    return {
      regular: require.resolve("dejavu-fonts-ttf/ttf/DejaVuSans.ttf"),
      bold: require.resolve("dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf")
    };
  } catch {
    throw new Error(
      "Unable to resolve the bundled Arabic font fallback. Reinstall dependencies or provide options.fonts.regular/options.fonts.bold explicitly."
    );
  }
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

export const fetchLogo = async (logoUrl: string): Promise<Buffer> => {
  const response = await fetch(logoUrl);

  if (!response.ok) {
    throw new Error(`Unable to fetch logo from ${logoUrl}: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = response.headers.get("content-type") ?? "";

  if (isPngBuffer(buffer) || isJpegBuffer(buffer)) {
    return buffer;
  }

  try {
    const { default: sharp } = await import("sharp");
    const pipeline = contentType.includes("svg") ? sharp(buffer, { density: 300 }) : sharp(buffer);
    return await pipeline.png().toBuffer();
  } catch {
    throw new Error(
      `Unsupported logo format at ${logoUrl}. Remote logos currently support PNG, JPEG, SVG, and WEBP.`
    );
  }
};

export const useFont = (doc: PDFKit.PDFDocument, fontPath: string | undefined, fallback: "Helvetica" | "Helvetica-Bold"): void => {
  if (fontPath) {
    doc.font(fontPath);
    return;
  }

  doc.font(fallback);
};

export const resolvePdfFonts = (
  document: BusinessDocumentData,
  options?: PdfRenderOptions
): { regular?: string; bold?: string } | undefined => {
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
  if (doc.widthOfString(value) <= width) {
    return value;
  }

  let truncated = value;
  while (truncated.length > 0 && doc.widthOfString(`${truncated}...`) > width) {
    truncated = truncated.slice(0, -1);
  }

  return truncated.length > 0 ? `${truncated}...` : "...";
};

export const drawFixedText = (
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  options: PDFKit.Mixins.TextOptions
): number => {
  const previousX = doc.x;
  const previousY = doc.y;

  doc.x = x;
  doc.y = y;
  doc.text(text, x, y, options);
  doc.x = previousX;
  doc.y = previousY;

  return y + doc.heightOfString(text, options);
};

export const normalizeFooterText = (footer: string): string =>
  footer
    .split(/\r?\n/)
    .map((line) => line.trim())
    .join("\n");

export const ensureSectionSpace = (doc: PDFKit.PDFDocument, y: number, requiredHeight: number): number => {
  const contentBottom = PAGE.height - PAGE.margin - 8;

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
  return drawFixedText(doc, `${label}: ${value}`, x, y, { width, align });
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
  options: PDFKit.Mixins.TextOptions
): number => {
  const textHeight = doc.heightOfString(text, { ...options, width });
  return Math.max(minHeight, Math.ceil(textHeight + 12));
};

export const getMaxRowHeight = (
  doc: PDFKit.PDFDocument,
  cells: Array<{ text: string; width: number; options: PDFKit.Mixins.TextOptions }>,
  minHeight: number
): number => cells.reduce((maxHeight, cell) => (
  Math.max(maxHeight, getWrappedRowHeight(doc, cell.text, cell.width, minHeight, cell.options))
), minHeight);

export const buildPartyLines = (party: Party | undefined, labels: ReturnType<typeof getLabels>, includeName = true): string[] => {
  if (!party) {
    return [];
  }

  return [
    includeName ? (party.name ?? "") : "",
    ...(party.addressLines ?? []),
    [party.city, party.country].filter(Boolean).join(", "),
    party.phone ? `Tel: ${party.phone}` : "",
    party.email ? `Email: ${party.email}` : "",
    party.taxId ? `${labels.if}: ${party.taxId}` : "",
    party.ice ? `${labels.ice}: ${party.ice}` : "",
    party.if ? `${labels.if}: ${party.if}` : "",
    party.rc ? `${labels.rc}: ${party.rc}` : ""
  ].filter((line) => line.length > 0);
};

export const buildBankLines = (bankInfo: BankInfo, labels: ReturnType<typeof getLabels>): string[] => {
  const baseLines = [
    `${labels.bankName}: ${bankInfo.bankName}`,
    `${labels.holderName}: ${bankInfo.holderName}`
  ];

  if (bankInfo.type === "local") {
    return [...baseLines, `${labels.rib}: ${bankInfo.rib}`];
  }

  return [...baseLines, `${labels.swiftCode}: ${bankInfo.swiftCode}`, `${labels.iban}: ${bankInfo.iban}`];
};
