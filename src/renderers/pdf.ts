import PDFDocument from "pdfkit";
import type { BankInfo, BusinessDocumentData, PdfRenderOptions } from "../core/types.js";
import { getLabels } from "../locales/index.js";
import { formatDate, formatMoney } from "../utils/formatting.js";

const PAGE = {
  margin: 48,
  width: 595.28,
  footerOffset: 64,
  headerTop: 48,
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

const drawLabelValue = (
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  label: string,
  value: string,
  width: number,
  align: "left" | "right"
): void => {
  doc.fillColor("#1b2430").fontSize(10).text(`${label}: ${value}`, x, y, { width, align });
};

const buildSellerLines = (document: BusinessDocumentData, labels: ReturnType<typeof getLabels>): string[] => [
  ...document.seller.addressLines,
  [document.seller.city, document.seller.country].filter(Boolean).join(", "),
  document.seller.phone ? `Tel: ${document.seller.phone}` : "",
  document.seller.email ? `Email: ${document.seller.email}` : "",
  document.seller.taxId ? `Tax ID: ${document.seller.taxId}` : "",
  document.seller.ice ? `${labels.ice}: ${document.seller.ice}` : "",
  document.seller.if ? `${labels.if}: ${document.seller.if}` : "",
  document.seller.rc ? `${labels.rc}: ${document.seller.rc}` : ""
].filter((line) => line.length > 0);

const buildClientLines = (document: BusinessDocumentData): string[] => [
  document.client.name,
  ...document.client.addressLines,
  [document.client.city, document.client.country].filter(Boolean).join(", "),
  document.client.phone ? `Tel: ${document.client.phone}` : "",
  document.client.email ? `Email: ${document.client.email}` : "",
  document.client.taxId ? `Tax ID: ${document.client.taxId}` : ""
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
  const tableX = PAGE.margin;
  const tableWidth = PAGE.width - PAGE.margin * 2;

  // pdfkit is chosen because it stays lightweight while supporting custom TTF/OTF fonts,
  // which is necessary for Arabic-capable PDF output in a Node-only library.
  const doc = new PDFDocument({
    size: "A4",
    margin: PAGE.margin,
    info: {
      Title: `${document.title} ${document.number}`,
      Author: document.seller.name,
      Subject: document.title,
      Keywords: `${document.type}, morocco, invoice-kit`
    }
  });

  const pdfBytesPromise = collectPdf(doc);
  const logoBuffer = document.logo ? await fetchLogo(document.logo) : null;

  if (logoBuffer) {
    doc.image(logoBuffer, leftColumnX, PAGE.headerTop, {
      fit: [72, 72]
    });
  }

  useFont(doc, options?.fonts?.bold, "Helvetica-Bold");
  doc.fillColor("#173d73").fontSize(18).text(document.seller.name, leftColumnX + (logoBuffer ? 84 : 0), PAGE.headerTop, {
    width: logoBuffer ? 156 : 240,
    align
  });

  const sellerLines = buildSellerLines(document, labels);
  const clientLines = buildClientLines(document);

  useFont(doc, options?.fonts?.bold, "Helvetica-Bold");
  doc.fillColor("#111827").fontSize(22).text(document.title, rightColumnX, PAGE.headerTop, {
    width: columnWidth,
    align,
    lineBreak: true
  });
  const titleBottomY = doc.y;

  useFont(doc, options?.fonts?.regular, "Helvetica");
  doc.fillColor("#4b5563").fontSize(10).text(`${labels.number}: ${document.number}`, rightColumnX, titleBottomY + 6, {
    width: columnWidth,
    align
  });

  const headerBottomY = Math.max(titleBottomY + 22, PAGE.headerTop + 28);
  const sectionsTopY = headerBottomY + 28;

  useFont(doc, options?.fonts?.bold, "Helvetica-Bold");
  doc.fillColor("#6b7280").fontSize(11).text(labels.seller, leftColumnX, sectionsTopY, { width: columnWidth, align });
  doc.text(labels.client, rightColumnX, sectionsTopY, { width: columnWidth, align });

  useFont(doc, options?.fonts?.regular, "Helvetica");
  doc.fillColor("#111827").fontSize(10).text([document.seller.name, ...sellerLines].join("\n"), leftColumnX, sectionsTopY + 18, {
    width: columnWidth,
    align,
    lineGap: 2
  });
  const sellerBottomY = doc.y;

  doc.text(clientLines.join("\n"), rightColumnX, sectionsTopY + 18, {
    width: columnWidth,
    align,
    lineGap: 2
  });
  const clientBottomY = doc.y;

  let y = Math.max(sellerBottomY, clientBottomY) + 20;

  doc
    .lineWidth(1)
    .strokeColor("#d1d5db")
    .rect(PAGE.margin, y, tableWidth, 44)
    .stroke();

  useFont(doc, options?.fonts?.regular, "Helvetica");
  drawLabelValue(doc, PAGE.margin + 12, y + 14, labels.issueDate, formatDate(document.issueDate, document.locale), 145, align);

  if (document.dueDate) {
    drawLabelValue(doc, PAGE.margin + 170, y + 14, labels.dueDate, formatDate(document.dueDate, document.locale), 145, align);
  }

  if (!isDeliveryNote) {
    drawLabelValue(doc, PAGE.margin + 328, y + 14, labels.currency, document.currency, 110, align);
  }

  y += 68;

  if (!isDeliveryNote && document.bankInfo) {
    const bankLines = buildBankLines(document.bankInfo, labels);
    useFont(doc, options?.fonts?.bold, "Helvetica-Bold");
    doc.fillColor("#6b7280").fontSize(10).text(labels.bankDetails, leftColumnX, y, { width: 240, align });
    useFont(doc, options?.fonts?.regular, "Helvetica");
    doc.fillColor("#111827").fontSize(10).text(bankLines.join("\n"), leftColumnX, y + 14, { width: 270, align, lineGap: 2 });
    y = doc.y + 18;
  }

  doc.fillColor("#173d73").rect(tableX, y, tableWidth, 24).fill();
  useFont(doc, options?.fonts?.bold, "Helvetica-Bold");
  if (isDeliveryNote) {
    const columns = {
      itemX: tableX + 12,
      itemWidth: 350,
      quantityX: tableX + 400,
      quantityWidth: 50
    };

    doc.fillColor("white").fontSize(10).text(labels.item, columns.itemX, y + 7, { width: columns.itemWidth, align });
    doc.text(labels.quantity, columns.quantityX, y + 7, { width: columns.quantityWidth, align: "right" });

    y += 24;
    useFont(doc, options?.fonts?.regular, "Helvetica");
    for (const item of document.items) {
      doc.strokeColor("#d1d5db").lineWidth(1).rect(tableX, y, tableWidth, 26).stroke();
      const itemLabel = item.description ? `${item.name} - ${item.description}` : item.name;
      doc.fillColor("#111827").fontSize(10).text(truncateText(doc, itemLabel, columns.itemWidth), columns.itemX, y + 8, {
        width: columns.itemWidth,
        align
      });
      doc.text(`${item.quantity}${item.unit ? ` ${item.unit}` : ""}`, columns.quantityX, y + 8, {
        width: columns.quantityWidth,
        align: "right"
      });
      y += 26;
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

    doc.fillColor("white").fontSize(10).text(labels.item, columns.itemX, y + 7, { width: columns.itemWidth, align });
    doc.text(labels.quantity, columns.quantityX, y + 7, { width: columns.quantityWidth, align: "right" });
    doc.text(labels.unitPrice, columns.unitPriceX, y + 7, { width: columns.unitPriceWidth, align: "right" });
    doc.text(labels.amount, columns.amountX, y + 7, { width: columns.amountWidth, align: "right" });

    y += 24;
    useFont(doc, options?.fonts?.regular, "Helvetica");
    for (const item of document.items) {
      doc.strokeColor("#d1d5db").lineWidth(1).rect(tableX, y, tableWidth, 26).stroke();
      const itemLabel = item.description ? `${item.name} - ${item.description}` : item.name;
      doc.fillColor("#111827").fontSize(10).text(truncateText(doc, itemLabel, columns.itemWidth), columns.itemX, y + 8, {
        width: columns.itemWidth,
        align
      });
      doc.text(`${item.quantity}${item.unit ? ` ${item.unit}` : ""}`, columns.quantityX, y + 8, {
        width: columns.quantityWidth,
        align: "right"
      });
      doc.text(truncateText(doc, formatMoney(item.unitPrice, document.locale, document.currency), columns.unitPriceWidth), columns.unitPriceX, y + 8, {
        width: columns.unitPriceWidth,
        align: "right"
      });
      doc.text(truncateText(doc, formatMoney(item.lineTotal, document.locale, document.currency), columns.amountWidth), columns.amountX, y + 8, {
        width: columns.amountWidth,
        align: "right"
      });
      y += 26;
    }
  }

  if (!isDeliveryNote) {
    const totalsX = PAGE.width - PAGE.margin - 220;
    const totals = [
      [labels.subtotal, formatMoney(document.totals.subtotal, document.locale, document.currency)],
      [labels.discount, formatMoney(document.totals.discountTotal, document.locale, document.currency)],
      [labels.taxableBase, formatMoney(document.totals.taxableBase, document.locale, document.currency)],
      [`${labels.vat} (${(document.vatRate * 100).toFixed(0)}%)`, formatMoney(document.totals.vatAmount, document.locale, document.currency)],
      [labels.total, formatMoney(document.totals.total, document.locale, document.currency)]
    ] as const;

    y += 12;
    totals.forEach(([label, value], index) => {
      const isTotal = index === totals.length - 1;
      doc.fillColor(isTotal ? "#173d73" : "white").rect(totalsX, y, 220, 24).fill();
      doc.strokeColor("#d1d5db").lineWidth(1).rect(totalsX, y, 220, 24).stroke();

      useFont(doc, isTotal ? options?.fonts?.bold : options?.fonts?.regular, isTotal ? "Helvetica-Bold" : "Helvetica");
      doc.fillColor(isTotal ? "white" : "#111827").fontSize(10).text(label, totalsX + 10, y + 7, { width: 105, align: "left" });
      doc.text(truncateText(doc, value, 85), totalsX + 125, y + 7, { width: 85, align: "right" });
      y += 24;
    });
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

  if (notes.length > 0) {
    y += 24;
    useFont(doc, options?.fonts?.bold, "Helvetica-Bold");
    doc.fillColor("#6b7280").fontSize(11).text(labels.notes, PAGE.margin, y, { width: tableWidth, align });
    useFont(doc, options?.fonts?.regular, "Helvetica");
    doc.fillColor("#111827").fontSize(10).text(notes.join("\n"), PAGE.margin, y + 16, { width: tableWidth, align, lineGap: 2 });
  }

  useFont(doc, options?.fonts?.regular, "Helvetica");
  const actualPageHeight = doc.page.height ?? 841.89;
  doc.fillColor("#9ca3af").fontSize(8).text(
    `${document.title} ${document.number}`,
    PAGE.margin,
    actualPageHeight - PAGE.footerOffset,
    { width: tableWidth, align: isArabic ? "right" : "left" }
  );

  doc.end();
  return pdfBytesPromise;
};
