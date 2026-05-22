import PDFDocument from "pdfkit";
import type { BankInfo, BusinessDocumentData, PdfRenderOptions } from "../core/types.js";
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
  align: "left" | "right"
): number => {
  doc.fillColor("#1b2430").fontSize(10);
  return drawFixedText(doc, `${label}: ${value}`, x, y, { width, align });
};

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

const buildIssuerLines = (document: BusinessDocumentData, labels: ReturnType<typeof getLabels>): string[] => [
  ...document.issuer.addressLines,
  [document.issuer.city, document.issuer.country].filter(Boolean).join(", "),
  document.issuer.phone ? `Tel: ${document.issuer.phone}` : "",
  document.issuer.email ? `Email: ${document.issuer.email}` : "",
  document.issuer.taxId ? `${labels.if}: ${document.issuer.taxId}` : "",
  document.issuer.ice ? `${labels.ice}: ${document.issuer.ice}` : "",
  document.issuer.if ? `${labels.if}: ${document.issuer.if}` : "",
  document.issuer.rc ? `${labels.rc}: ${document.issuer.rc}` : ""
].filter((line) => line.length > 0);

const buildClientLines = (document: BusinessDocumentData, labels: ReturnType<typeof getLabels>): string[] => [
  document.client.name,
  ...document.client.addressLines,
  [document.client.city, document.client.country].filter(Boolean).join(", "),
  document.client.phone ? `Tel: ${document.client.phone}` : "",
  document.client.email ? `Email: ${document.client.email}` : "",
  document.client.taxId ? `${labels.if}: ${document.client.taxId}` : ""
].filter((line) => line.length > 0);

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
  const isArabic = document.locale === "ar-MA";
  const isDeliveryNote = document.type === "deliveryNote";
  const align: "left" | "right" = isArabic ? "right" : "left";
  const leftColumnX = PAGE.margin;
  const rightColumnX = PAGE.margin + 275;
  const columnWidth = 224;
  const metaTopX = rightColumnX;
  const tableX = PAGE.margin;
  const tableWidth = PAGE.width - PAGE.margin * 2;

  // pdfkit is chosen because it stays lightweight while supporting custom TTF/OTF fonts,
  // which is necessary for Arabic-capable PDF output in a Node-only library.
  const doc = new PDFDocument({
    size: "A4",
    margin: PAGE.margin,
    info: {
      Title: `${document.title} ${document.number}`,
      Author: document.issuer.name,
      Subject: document.title,
      Keywords: `${document.type}, morocco, @ic-labs/invoice-kit`
    }
  });

  const pdfBytesPromise = collectPdf(doc);
  const logoBuffer = document.issuer.logo ? await fetchLogo(document.issuer.logo) : null;

  if (logoBuffer) {
    doc.image(logoBuffer, leftColumnX, PAGE.headerTop, {
      fit: [72, 72]
    });
  }

  useFont(doc, options?.fonts?.bold, "Helvetica-Bold");
  doc.fillColor("#173d73").fontSize(17);
  const issuerTextX = leftColumnX + (logoBuffer ? 84 : 0);
  const issuerTextWidth = logoBuffer ? 156 : 240;
  drawFixedText(doc, document.issuer.name, issuerTextX, PAGE.headerTop, {
    width: issuerTextWidth,
    align
  });
  const issuerLines = buildIssuerLines(document, labels);
  useFont(doc, options?.fonts?.regular, "Helvetica");
  doc.fillColor("#111827").fontSize(9);
  const issuerHeaderBottomY = drawFixedText(doc, issuerLines.join("\n"), issuerTextX, PAGE.headerTop + 22, {
    width: issuerTextWidth,
    align,
    lineGap: 1
  });

  const clientLines = buildClientLines(document, labels);
  const bankLines = !isDeliveryNote && document.bankInfo ? buildBankLines(document.bankInfo, labels) : null;

  useFont(doc, options?.fonts?.bold, "Helvetica-Bold");
  doc.fillColor("#111827").fontSize(20);
  const titleBottomY = drawFixedText(doc, document.title, rightColumnX, PAGE.headerTop, {
    width: columnWidth,
    align,
    lineBreak: true
  });

  useFont(doc, options?.fonts?.regular, "Helvetica");
  doc.fillColor("#4b5563").fontSize(9);
  const numberBottomY = drawFixedText(doc, `${labels.number}: ${document.number}`, rightColumnX, titleBottomY + 4, {
    width: columnWidth,
    align
  });

  let metaBottomY = numberBottomY;
  metaBottomY = Math.max(metaBottomY, drawLabelValue(doc, metaTopX, numberBottomY + 2, labels.issueDate, formatDate(document.issueDate, document.locale), columnWidth, align));
  if (document.dueDate) {
    metaBottomY = Math.max(metaBottomY, drawLabelValue(doc, metaTopX, metaBottomY + 2, labels.dueDate, formatDate(document.dueDate, document.locale), columnWidth, align));
  }
  if (!isDeliveryNote) {
    metaBottomY = Math.max(metaBottomY, drawLabelValue(doc, metaTopX, metaBottomY + 2, labels.currency, document.currency, columnWidth, align));
  }

  const headerBottomY = Math.max(metaBottomY, issuerHeaderBottomY, PAGE.headerTop + 48);
  const sectionsTopY = headerBottomY + 10;

  useFont(doc, options?.fonts?.bold, "Helvetica-Bold");
  doc.fillColor("#6b7280").fontSize(10);
  if (bankLines) {
    drawFixedText(doc, labels.bankDetails, leftColumnX, sectionsTopY, { width: columnWidth, align });
  }
  drawFixedText(doc, labels.client, rightColumnX, sectionsTopY, { width: columnWidth, align });

  useFont(doc, options?.fonts?.regular, "Helvetica");
  doc.fillColor("#111827").fontSize(9);
  const leftSectionBottomY = bankLines
    ? drawFixedText(doc, bankLines.join("\n"), leftColumnX, sectionsTopY + 14, {
        width: 270,
        align,
        lineGap: 1
      })
    : sectionsTopY;

  const clientBottomY = drawFixedText(doc, clientLines.join("\n"), rightColumnX, sectionsTopY + 14, {
    width: columnWidth,
    align,
    lineGap: 1
  });

  let y = Math.max(leftSectionBottomY, clientBottomY) + 10;

  doc.fillColor("#173d73").rect(tableX, y, tableWidth, 24).fill();
  useFont(doc, options?.fonts?.bold, "Helvetica-Bold");
  if (isDeliveryNote) {
    const columns = {
      itemX: tableX + 12,
      itemWidth: 350,
      quantityX: tableX + 400,
      quantityWidth: 50
    };

    doc.fillColor("white").fontSize(10);
    drawFixedText(doc, labels.item, columns.itemX, y + 7, { width: columns.itemWidth, align });
    drawFixedText(doc, labels.quantity, columns.quantityX, y + 7, { width: columns.quantityWidth, align: "right" });

    y += 24;
    useFont(doc, options?.fonts?.regular, "Helvetica");
    for (const item of document.items) {
      const itemLabel = item.description ? `${item.name} - ${item.description}` : item.name;
      const rowHeight = getWrappedRowHeight(doc, itemLabel, columns.itemWidth, 24, { align, lineGap: 1 });
      doc.strokeColor("#d1d5db").lineWidth(1).rect(tableX, y, tableWidth, rowHeight).stroke();
      doc.fillColor("#111827").fontSize(10);
      drawFixedText(doc, truncateText(doc, itemLabel, columns.itemWidth), columns.itemX, y + 8, {
        width: columns.itemWidth,
        align
      });
      drawFixedText(doc, `${item.quantity}${item.unit ? ` ${item.unit}` : ""}`, columns.quantityX, y + 8, {
        width: columns.quantityWidth,
        align: "right"
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

    doc.fillColor("white").fontSize(10);
    drawFixedText(doc, labels.item, columns.itemX, y + 7, { width: columns.itemWidth, align });
    drawFixedText(doc, labels.quantity, columns.quantityX, y + 7, { width: columns.quantityWidth, align: "right" });
    drawFixedText(doc, labels.unitPrice, columns.unitPriceX, y + 7, { width: columns.unitPriceWidth, align: "right" });
    drawFixedText(doc, labels.amount, columns.amountX, y + 7, { width: columns.amountWidth, align: "right" });

    y += 24;
    useFont(doc, options?.fonts?.regular, "Helvetica");
    for (const item of document.items) {
      const itemLabel = item.description ? `${item.name} - ${item.description}` : item.name;
      const rowHeight = getWrappedRowHeight(doc, itemLabel, columns.itemWidth, 24, { align, lineGap: 1 });
      doc.strokeColor("#d1d5db").lineWidth(1).rect(tableX, y, tableWidth, rowHeight).stroke();
      doc.fillColor("#111827").fontSize(10);
      drawFixedText(doc, itemLabel, columns.itemX, y + 8, {
        width: columns.itemWidth,
        align,
        lineGap: 1
      });
      drawFixedText(doc, `${item.quantity}${item.unit ? ` ${item.unit}` : ""}`, columns.quantityX, y + 8, {
        width: columns.quantityWidth,
        align: "right"
      });
      drawFixedText(doc, truncateText(doc, formatMoney(item.unitPrice, document.locale, document.currency), columns.unitPriceWidth), columns.unitPriceX, y + 8, {
        width: columns.unitPriceWidth,
        align: "right"
      });
      drawFixedText(doc, truncateText(doc, formatMoney(item.lineTotal, document.locale, document.currency), columns.amountWidth), columns.amountX, y + 8, {
        width: columns.amountWidth,
        align: "right"
      });
      y += rowHeight;
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

  if (!isDeliveryNote) {
    const totalsHeight = (24 * 5) + 12;
    const notesWidth = tableWidth - 236;
    const notesHeight = notes.length > 0
      ? 12 + 12 + doc.heightOfString(notes.join("\n"), { width: notesWidth, align, lineGap: 1 }) + 8
      : 0;
    y = ensureSectionSpace(doc, y + 12, Math.max(totalsHeight, notesHeight)) - 12;
    const totalsX = PAGE.width - PAGE.margin - 220;
    const totals = [
      [labels.subtotal, formatMoney(document.totals.subtotal, document.locale, document.currency)],
      [labels.discount, formatMoney(document.totals.discountTotal, document.locale, document.currency)],
      [labels.taxableBase, formatMoney(document.totals.taxableBase, document.locale, document.currency)],
      [`${labels.vat} (${(document.vatRate * 100).toFixed(0)}%)`, formatMoney(document.totals.vatAmount, document.locale, document.currency)],
      [labels.total, formatMoney(document.totals.total, document.locale, document.currency)]
    ] as const;

    y += 12;
    let trailingBottomY = y;

    if (notes.length > 0) {
      useFont(doc, options?.fonts?.bold, "Helvetica-Bold");
      doc.fillColor("#6b7280").fontSize(10);
      drawFixedText(doc, labels.notes, PAGE.margin, y, { width: notesWidth, align });
      useFont(doc, options?.fonts?.regular, "Helvetica");
      doc.fillColor("#111827").fontSize(9);
      trailingBottomY = drawFixedText(doc, notes.join("\n"), PAGE.margin, y + 12, {
        width: notesWidth,
        align,
        lineGap: 1
      });
    }

    totals.forEach(([label, value], index) => {
      const isTotal = index === totals.length - 1;
      doc.fillColor(isTotal ? "#173d73" : "white").rect(totalsX, y, 220, 24).fill();
      doc.strokeColor("#d1d5db").lineWidth(1).rect(totalsX, y, 220, 24).stroke();

      useFont(doc, isTotal ? options?.fonts?.bold : options?.fonts?.regular, isTotal ? "Helvetica-Bold" : "Helvetica");
      doc.fillColor(isTotal ? "white" : "#111827").fontSize(10);
      drawFixedText(doc, label, totalsX + 10, y + 7, { width: 105, align: "left" });
      drawFixedText(doc, truncateText(doc, value, 85), totalsX + 125, y + 7, { width: 85, align: "right" });
      y += 24;
    });
    y = Math.max(y, trailingBottomY + 8);
  } else if (notes.length > 0) {
    const notesHeight = 12 + 12 + doc.heightOfString(notes.join("\n"), { width: tableWidth, align, lineGap: 1 }) + 8;
    y = ensureSectionSpace(doc, y + 12, notesHeight) - 12;
    y += 12;
    useFont(doc, options?.fonts?.bold, "Helvetica-Bold");
    doc.fillColor("#6b7280").fontSize(10);
    drawFixedText(doc, labels.notes, PAGE.margin, y, { width: tableWidth, align });
    useFont(doc, options?.fonts?.regular, "Helvetica");
    doc.fillColor("#111827").fontSize(9);
    drawFixedText(doc, notes.join("\n"), PAGE.margin, y + 12, { width: tableWidth, align, lineGap: 1 });
  }

  useFont(doc, options?.fonts?.regular, "Helvetica");
  const actualPageHeight = doc.page.height ?? 841.89;
  const footerText = normalizeFooterText(document.footer ?? `${document.title} ${document.number}`);
  const footerOptions = {
    width: tableWidth,
    align: "center" as const,
    lineGap: 1
  };
  const footerHeight = doc.heightOfString(footerText, footerOptions);
  doc.page.margins.bottom = 0;
  doc.fillColor("#9ca3af").fontSize(8);
  drawFixedText(doc, footerText, PAGE.margin, actualPageHeight - footerHeight, footerOptions);

  doc.end();
  return pdfBytesPromise;
};
