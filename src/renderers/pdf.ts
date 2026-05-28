import PDFDocument from "pdfkit";
import type { BankInfo, BusinessDocumentData, DocumentColors, Party, PdfRenderOptions } from "../core/types.js";
import { getLabels } from "../locales/index.js";
import { formatDate, formatMoney } from "../utils/formatting.js";

const PAGE = {
  margin: 48,
  width: 595.28,
  height: 841.89,
  footerOffset: 64,
  headerTop: 42,
  lineGap: 14
};

const DEFAULT_COLORS: Required<DocumentColors> = {
  primary: "#173d73",
  onPrimary: "#ffffff",
  text: "#111827",
  metaText: "#4b5563",
  mutedText: "#6b7280",
  border: "#d1d5db",
  footerText: "#9ca3af"
};

const collectPdf = async (doc: PDFKit.PDFDocument): Promise<Uint8Array> =>
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

const fetchLogo = async (logoUrl: string): Promise<Buffer> => {
  const response = await fetch(logoUrl);

  if (!response.ok) {
    throw new Error(`Unable to fetch logo from ${logoUrl}: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (isPngBuffer(buffer) || isJpegBuffer(buffer)) {
    return buffer;
  }

  throw new Error(
    `Unsupported logo format at ${logoUrl}. Remote logos currently support PNG and JPEG only.`
  );
};

const useFont = (doc: PDFKit.PDFDocument, fontPath: string | undefined, fallback: "Helvetica" | "Helvetica-Bold"): void => {
  if (fontPath) {
    doc.font(fontPath);
    return;
  }

  doc.font(fallback);
};

const requireArabicFontsIfNeeded = (document: BusinessDocumentData, options?: PdfRenderOptions): void => {
  if (document.locale !== "ar-MA") {
    return;
  }

  if (!options?.fonts?.regular || !options.fonts.bold) {
    throw new Error(
      "Arabic PDF rendering requires options.fonts.regular and options.fonts.bold pointing to Arabic-capable TTF/OTF font files."
    );
  }
};

const truncateText = (doc: PDFKit.PDFDocument, value: string, width: number): string => {
  if (doc.widthOfString(value) <= width) {
    return value;
  }

  let truncated = value;
  while (truncated.length > 0 && doc.widthOfString(`${truncated}...`) > width) {
    truncated = truncated.slice(0, -1);
  }

  return truncated.length > 0 ? `${truncated}...` : "...";
};

const drawFixedText = (
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

const normalizeFooterText = (footer: string): string =>
  footer
    .split(/\r?\n/)
    .map((line) => line.trim())
    .join("\n");

const ensureSectionSpace = (doc: PDFKit.PDFDocument, y: number, requiredHeight: number): number => {
  const contentBottom = PAGE.height - PAGE.margin - 8;

  if (y + requiredHeight <= contentBottom) {
    return y;
  }

  doc.addPage();
  return PAGE.margin;
};

const drawLabelValue = (
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

const resolveColors = (colors?: DocumentColors): Required<DocumentColors> => ({
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

const getMaxRowHeight = (
  doc: PDFKit.PDFDocument,
  cells: Array<{ text: string; width: number; options: PDFKit.Mixins.TextOptions }>,
  minHeight: number
): number => {
  const tallestCell = cells.reduce((maxHeight, cell) => (
    Math.max(maxHeight, getWrappedRowHeight(doc, cell.text, cell.width, minHeight, cell.options))
  ), minHeight);

  return tallestCell;
};

const buildPartyLines = (party: Party | undefined, labels: ReturnType<typeof getLabels>, includeName = true): string[] => {
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

const buildBankLines = (bankInfo: BankInfo, labels: ReturnType<typeof getLabels>): string[] => {
  const baseLines = [
    `${labels.bankName}: ${bankInfo.bankName}`,
    `${labels.holderName}: ${bankInfo.holderName}`
  ];

  if (bankInfo.type === "local") {
    return [...baseLines, `${labels.rib}: ${bankInfo.rib}`];
  }

  return [...baseLines, `${labels.swiftCode}: ${bankInfo.swiftCode}`, `${labels.iban}: ${bankInfo.iban}`];
};

export const renderDocumentPdf = async (
  document: BusinessDocumentData,
  options?: PdfRenderOptions
): Promise<Uint8Array> => {
  requireArabicFontsIfNeeded(document, options);

  const labels = getLabels(document.locale);
  const colors = resolveColors(document.colors);
  const isArabic = document.locale === "ar-MA";
  const isDeliveryNote = document.type === "deliveryNote";
  const align: "left" | "right" = isArabic ? "right" : "left";
  const leftColumnX = PAGE.margin;
  const rightColumnX = PAGE.margin + 275;
  const columnWidth = 224;
  const metaTopX = rightColumnX;
  const tableX = PAGE.margin;
  const tableWidth = PAGE.width - PAGE.margin * 2;
  const logoFit: [number, number] = isDeliveryNote ? [80, 80] : [72, 72];
  const issuerNameOffsetY = isDeliveryNote ? 3 : 1;
  const issuerDetailsOffsetY = isDeliveryNote ? 30 : 24;
  const titleMetaGapY = document.title ? 6 : 0;
  const metaRowGapY = 4;
  const sectionGapY = isDeliveryNote ? 22 : 14;
  const sectionBodyOffsetY = isDeliveryNote ? 20 : 16;
  const sectionAfterGapY = isDeliveryNote ? 20 : 14;
  const bankSectionGapY = isDeliveryNote ? 16 : 10;
  const bankSectionBodyOffsetY = isDeliveryNote ? 26 : 22;
  const tableTopGapY = isDeliveryNote ? 18 : 12;
  const trailingSectionGapY = 14;
  const notesBodyOffsetY = 14;
  const trailingBottomGapY = 10;

  // pdfkit is chosen because it stays lightweight while supporting custom TTF/OTF fonts,
  // which is necessary for Arabic-capable PDF output in a Node-only library.
  const doc = new PDFDocument({
    size: "A4",
    margin: PAGE.margin,
    info: {
      Title: [document.title, document.number].filter(Boolean).join(" "),
      Author: document.issuer?.name ?? document.seller?.name ?? "",
      Subject: document.title ?? "",
      Keywords: `${document.type}, morocco, @ic-labs/invoice-kit`
    }
  });

  const pdfBytesPromise = collectPdf(doc);
  const logoBuffer = document.issuer?.logo ? await fetchLogo(document.issuer.logo) : null;
  const issuerTextX = leftColumnX + (logoBuffer ? 92 : 0);
  const issuerTextWidth = logoBuffer ? 148 : 240;

  if (logoBuffer) {
    doc.image(logoBuffer, leftColumnX, PAGE.headerTop, {
      fit: logoFit
    });
  }

  let issuerHeaderBottomY = PAGE.headerTop;
  const issuerName = document.issuer?.name;
  const issuerLines = buildPartyLines(document.issuer, labels, false);

  if (issuerName) {
    useFont(doc, options?.fonts?.bold, "Helvetica-Bold");
    doc.fillColor(colors.primary).fontSize(17);
    drawFixedText(doc, issuerName, issuerTextX, PAGE.headerTop + issuerNameOffsetY, {
      width: issuerTextWidth,
      align
    });
    issuerHeaderBottomY = PAGE.headerTop + issuerDetailsOffsetY - 2;
  }

  if (issuerLines.length > 0) {
    useFont(doc, options?.fonts?.regular, "Helvetica");
    doc.fillColor(colors.text).fontSize(9);
    issuerHeaderBottomY = drawFixedText(doc, issuerLines.join("\n"), issuerTextX, PAGE.headerTop + (issuerName ? issuerDetailsOffsetY : 0), {
      width: issuerTextWidth,
      align,
      lineGap: 1
    });
  }

  const sellerLines = buildPartyLines(document.seller, labels);
  const clientLines = buildPartyLines(document.client, labels);
  const bankLines = !isDeliveryNote && document.bankInfo ? buildBankLines(document.bankInfo, labels) : null;

  let titleBottomY = PAGE.headerTop;
  if (document.title) {
    useFont(doc, options?.fonts?.bold, "Helvetica-Bold");
    doc.fillColor(colors.text).fontSize(20);
    titleBottomY = drawFixedText(doc, document.title, rightColumnX, PAGE.headerTop, {
      width: columnWidth,
      align,
      lineBreak: true
    });
  }

  let metaBottomY = titleBottomY;
  if (document.number) {
    useFont(doc, options?.fonts?.regular, "Helvetica");
    doc.fillColor(colors.metaText).fontSize(9);
    metaBottomY = drawFixedText(doc, `${labels.number}: ${document.number}`, rightColumnX, titleBottomY + titleMetaGapY, {
      width: columnWidth,
      align
    });
  }

  if (document.issueDate) {
    metaBottomY = Math.max(metaBottomY, drawLabelValue(doc, metaTopX, metaBottomY + metaRowGapY, labels.issueDate, formatDate(document.issueDate, document.locale), columnWidth, align, colors.metaText));
  }
  if (document.dueDate) {
    metaBottomY = Math.max(metaBottomY, drawLabelValue(doc, metaTopX, metaBottomY + metaRowGapY, labels.dueDate, formatDate(document.dueDate, document.locale), columnWidth, align, colors.metaText));
  }
  if (!isDeliveryNote && document.currency) {
    metaBottomY = Math.max(metaBottomY, drawLabelValue(doc, metaTopX, metaBottomY + metaRowGapY, labels.currency, document.currency, columnWidth, align, colors.metaText));
  }

  const minimumHeaderBottomY = PAGE.headerTop + (isDeliveryNote ? 72 : 48);
  const headerBottomY = Math.max(metaBottomY, issuerHeaderBottomY, minimumHeaderBottomY);
  let y = headerBottomY + tableTopGapY;
  if (sellerLines.length > 0 || clientLines.length > 0 || bankLines) {
    const sectionsTopY = headerBottomY + sectionGapY;

    useFont(doc, options?.fonts?.bold, "Helvetica-Bold");
    doc.fillColor(colors.mutedText).fontSize(10);
    if (sellerLines.length > 0) {
      drawFixedText(doc, labels.seller, leftColumnX, sectionsTopY, { width: columnWidth, align });
    }
    if (clientLines.length > 0) {
      drawFixedText(doc, labels.client, rightColumnX, sectionsTopY, { width: columnWidth, align });
    }

    useFont(doc, options?.fonts?.regular, "Helvetica");
    doc.fillColor(colors.text).fontSize(9);
    let leftSectionBottomY = sectionsTopY;
    if (sellerLines.length > 0) {
      leftSectionBottomY = drawFixedText(doc, sellerLines.join("\n"), leftColumnX, sectionsTopY + sectionBodyOffsetY, {
        width: 270,
        align,
        lineGap: 1
      });
    }

    if (bankLines) {
      useFont(doc, options?.fonts?.bold, "Helvetica-Bold");
      doc.fillColor(colors.mutedText).fontSize(9);
      drawFixedText(doc, labels.bankDetails, leftColumnX, leftSectionBottomY + bankSectionGapY, { width: columnWidth, align });
      useFont(doc, options?.fonts?.regular, "Helvetica");
      doc.fillColor(colors.text).fontSize(9);
      leftSectionBottomY = drawFixedText(doc, bankLines.join("\n"), leftColumnX, leftSectionBottomY + bankSectionBodyOffsetY, {
        width: 270,
        align,
        lineGap: 1
      });
    }

    let clientBottomY = sectionsTopY;
    if (clientLines.length > 0) {
      clientBottomY = drawFixedText(doc, clientLines.join("\n"), rightColumnX, sectionsTopY + sectionBodyOffsetY, {
        width: columnWidth,
        align,
        lineGap: 1
      });
    }

    y = Math.max(leftSectionBottomY, clientBottomY) + sectionAfterGapY;
  }

  const items = document.items ?? [];
  const hasItems = items.length > 0;
  if (hasItems) {
    doc.fillColor(colors.primary).rect(tableX, y, tableWidth, 24).fill();
    useFont(doc, options?.fonts?.bold, "Helvetica-Bold");
    if (isDeliveryNote) {
      const columns = {
        itemX: tableX + 12,
        itemWidth: 350,
        quantityX: tableX + 400,
        quantityWidth: 50
      };

      doc.fillColor(colors.onPrimary).fontSize(10);
      drawFixedText(doc, labels.item, columns.itemX, y + 7, { width: columns.itemWidth, align });
      drawFixedText(doc, labels.quantity, columns.quantityX, y + 7, { width: columns.quantityWidth, align: "right" });

      y += 24;
      useFont(doc, options?.fonts?.regular, "Helvetica");
      for (const item of items) {
        const itemLabel = item.description ? `${item.name} - ${item.description}` : item.name;
        const quantityLabel = `${item.quantity}${item.unit ? ` ${item.unit}` : ""}`;
        const rowHeight = getMaxRowHeight(doc, [
          { text: itemLabel, width: columns.itemWidth, options: { align, lineGap: 1 } },
          { text: quantityLabel, width: columns.quantityWidth, options: { align: "right", lineGap: 1 } }
        ], 24);
        doc.strokeColor(colors.border).lineWidth(1).rect(tableX, y, tableWidth, rowHeight).stroke();
        doc.fillColor(colors.text).fontSize(10);
        drawFixedText(doc, truncateText(doc, itemLabel, columns.itemWidth), columns.itemX, y + 8, {
          width: columns.itemWidth,
          align
        });
        drawFixedText(doc, quantityLabel, columns.quantityX, y + 8, {
          width: columns.quantityWidth,
          align: "right",
          lineGap: 1
        });
        y += rowHeight;
      }
    } else {
      const columns = {
        itemX: tableX + 12,
        itemWidth: 220,
        quantityX: tableX + 240,
        quantityWidth: 45,
        unitPriceX: tableX + 300,
        unitPriceWidth: 78,
        amountX: tableX + 392,
        amountWidth: 95
      };

      doc.fillColor(colors.onPrimary).fontSize(10);
      drawFixedText(doc, labels.item, columns.itemX, y + 7, { width: columns.itemWidth, align });
      drawFixedText(doc, labels.quantity, columns.quantityX, y + 7, { width: columns.quantityWidth, align: "right" });
      drawFixedText(doc, labels.unitPrice, columns.unitPriceX, y + 7, { width: columns.unitPriceWidth, align: "right" });
      drawFixedText(doc, labels.amount, columns.amountX, y + 7, { width: columns.amountWidth, align: "right" });

      y += 24;
      useFont(doc, options?.fonts?.regular, "Helvetica");
      for (const item of items) {
        const itemLabel = item.description ? `${item.name} - ${item.description}` : item.name;
        const quantityLabel = `${item.quantity}${item.unit ? ` ${item.unit}` : ""}`;
        const rowHeight = getMaxRowHeight(doc, [
          { text: itemLabel, width: columns.itemWidth, options: { align, lineGap: 1 } },
          { text: quantityLabel, width: columns.quantityWidth, options: { align: "right", lineGap: 1 } }
        ], 24);
        doc.strokeColor(colors.border).lineWidth(1).rect(tableX, y, tableWidth, rowHeight).stroke();
        doc.fillColor(colors.text).fontSize(10);
        drawFixedText(doc, itemLabel, columns.itemX, y + 8, {
          width: columns.itemWidth,
          align,
          lineGap: 1
        });
        drawFixedText(doc, quantityLabel, columns.quantityX, y + 8, {
          width: columns.quantityWidth,
          align: "right",
          lineGap: 1
        });
        drawFixedText(doc, truncateText(doc, formatMoney(item.unitPrice, document.locale, document.currency ?? "MAD"), columns.unitPriceWidth), columns.unitPriceX, y + 8, {
          width: columns.unitPriceWidth,
          align: "right"
        });
        drawFixedText(doc, truncateText(doc, formatMoney(item.lineTotal, document.locale, document.currency ?? "MAD"), columns.amountWidth), columns.amountX, y + 8, {
          width: columns.amountWidth,
          align: "right"
        });
        y += rowHeight;
      }
    }
  }

  const notes: string[] = [];
  if (!isDeliveryNote && document.paymentTerms?.label) {
    notes.push(`${labels.paymentTerms}: ${document.paymentTerms.label}`);
  }
  if (!isDeliveryNote && document.paymentTerms?.notes) {
    notes.push(document.paymentTerms.notes);
  }
  if (document.notes) {
    notes.push(`${labels.notes}: ${document.notes}`);
  }

  if (!isDeliveryNote && document.totals) {
    const totalsHeight = (24 * 5) + 12;
    const notesWidth = tableWidth - 236;
    const notesHeight = notes.length > 0
      ? 12 + 12 + doc.heightOfString(notes.join("\n"), { width: notesWidth, align, lineGap: 1 }) + 8
      : 0;
    y = ensureSectionSpace(doc, y + trailingSectionGapY, Math.max(totalsHeight, notesHeight)) - trailingSectionGapY;
    const totalsX = PAGE.width - PAGE.margin - 220;
    const totals = [
      [labels.subtotal, formatMoney(document.totals.subtotal, document.locale, document.currency ?? "MAD")],
      [labels.discount, formatMoney(document.totals.discountTotal, document.locale, document.currency ?? "MAD")],
      [labels.taxableBase, formatMoney(document.totals.taxableBase, document.locale, document.currency ?? "MAD")],
      [`${labels.vat} (${((document.vatRate ?? 0) * 100).toFixed(0)}%)`, formatMoney(document.totals.vatAmount, document.locale, document.currency ?? "MAD")],
      [labels.total, formatMoney(document.totals.total, document.locale, document.currency ?? "MAD")]
    ] as const;

    y += trailingSectionGapY;
    let trailingBottomY = y;

    if (notes.length > 0) {
      useFont(doc, options?.fonts?.bold, "Helvetica-Bold");
      doc.fillColor(colors.mutedText).fontSize(10);
      drawFixedText(doc, labels.notes, PAGE.margin, y, { width: notesWidth, align });
      useFont(doc, options?.fonts?.regular, "Helvetica");
      doc.fillColor(colors.text).fontSize(9);
      trailingBottomY = drawFixedText(doc, notes.join("\n"), PAGE.margin, y + notesBodyOffsetY, {
        width: notesWidth,
        align,
        lineGap: 1
      });
    }

    totals.forEach(([label, value], index) => {
      const isTotal = index === totals.length - 1;
      doc.fillColor(isTotal ? colors.primary : "white").rect(totalsX, y, 220, 24).fill();
      doc.strokeColor(colors.border).lineWidth(1).rect(totalsX, y, 220, 24).stroke();

      useFont(doc, isTotal ? options?.fonts?.bold : options?.fonts?.regular, isTotal ? "Helvetica-Bold" : "Helvetica");
      doc.fillColor(isTotal ? colors.onPrimary : colors.text).fontSize(10);
      drawFixedText(doc, label, totalsX + 10, y + 7, { width: 105, align: "left" });
      drawFixedText(doc, truncateText(doc, value, 85), totalsX + 125, y + 7, { width: 85, align: "right" });
      y += 24;
    });
    y = Math.max(y, trailingBottomY + trailingBottomGapY);
  } else if (notes.length > 0) {
    const notesHeight = 12 + 12 + doc.heightOfString(notes.join("\n"), { width: tableWidth, align, lineGap: 1 }) + 8;
    y = ensureSectionSpace(doc, y + trailingSectionGapY, notesHeight) - trailingSectionGapY;
    y += trailingSectionGapY;
    useFont(doc, options?.fonts?.bold, "Helvetica-Bold");
    doc.fillColor(colors.mutedText).fontSize(10);
    drawFixedText(doc, labels.notes, PAGE.margin, y, { width: tableWidth, align });
    useFont(doc, options?.fonts?.regular, "Helvetica");
    doc.fillColor(colors.text).fontSize(9);
    drawFixedText(doc, notes.join("\n"), PAGE.margin, y + notesBodyOffsetY, { width: tableWidth, align, lineGap: 1 });
  }

  useFont(doc, options?.fonts?.regular, "Helvetica");
  const actualPageHeight = doc.page.height ?? 841.89;
  const fallbackFooter = [document.title, document.number].filter(Boolean).join(" ");
  const footerText = normalizeFooterText(document.footer ?? fallbackFooter);
  const footerOptions = {
    width: tableWidth,
    align: "center" as const,
    lineGap: 1
  };
  if (footerText.length > 0) {
    const footerHeight = doc.heightOfString(footerText, footerOptions);
    doc.page.margins.bottom = 0;
    doc.fillColor(colors.footerText).fontSize(8);
    drawFixedText(doc, footerText, PAGE.margin, actualPageHeight - footerHeight, footerOptions);
  }

  doc.end();
  return pdfBytesPromise;
};
