import PDFDocument from "../vendor/pdfkit.cjs";
import type { BusinessDocumentData, PdfRenderOptions } from "../core/types.js";
import { getLabels } from "../locales/index.js";
import { formatDate, formatMoney } from "../utils/formatting.js";
import {
  PAGE,
  buildBankLines,
  buildPartyLines,
  collectPdf,
  drawFixedText,
  drawLabelValue,
  ensureSectionSpace,
  fetchLogo,
  getMaxRowHeight,
  normalizeFooterText,
  resolveColors,
  resolvePdfFonts,
  truncateText,
  useFont
} from "./pdf-support.js";

export const renderDocumentPdf = async (
  document: BusinessDocumentData,
  options?: PdfRenderOptions
): Promise<Uint8Array> => {
  const labels = getLabels(document.locale);
  const colors = resolveColors(document.colors);
  const fonts = resolvePdfFonts(document, options);
  const isArabic = document.locale === "ar-MA";
  const isStockMovementDocument = document.type === "deliveryNote" || document.type === "returnNote";
  const align: "left" | "right" = isArabic ? "right" : "left";
  const leftColumnX = PAGE.margin;
  const rightColumnX = PAGE.margin + 275;
  const columnWidth = 224;
  const metaTopX = rightColumnX;
  const tableX = PAGE.margin;
  const tableWidth = PAGE.width - PAGE.margin * 2;
  const logoFit: [number, number] = isStockMovementDocument ? [80, 80] : [72, 72];
  const issuerNameOffsetY = isStockMovementDocument ? 3 : 1;
  const issuerNameGapY = isStockMovementDocument ? 8 : 6;
  const titleMetaGapY = document.title ? 6 : 0;
  const metaRowGapY = 4;
  const sectionGapY = isStockMovementDocument ? 22 : 14;
  const sectionBodyOffsetY = isStockMovementDocument ? 20 : 16;
  const sectionAfterGapY = isStockMovementDocument ? 20 : 14;
  const bankSectionGapY = isStockMovementDocument ? 16 : 10;
  const bankSectionBodyOffsetY = isStockMovementDocument ? 26 : 22;
  const tableTopGapY = isStockMovementDocument ? 18 : 12;
  const trailingSectionGapY = 14;
  const notesBodyOffsetY = 14;
  const trailingBottomGapY = 10;
  const contentBottomY = PAGE.height - PAGE.margin - 8;

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
  const ensureTableRowSpace = (currentY: number, rowHeight: number, drawHeader: (headerY: number) => void): number => {
    if (currentY + rowHeight <= contentBottomY) {
      return currentY;
    }

    doc.addPage();
    drawHeader(PAGE.margin);
    return PAGE.margin + 24;
  };

  if (logoBuffer) {
    doc.image(logoBuffer, leftColumnX, PAGE.headerTop, {
      fit: logoFit
    });
  }

  let issuerHeaderBottomY = PAGE.headerTop;
  const issuerName = document.issuer?.name;
  const issuerLines = buildPartyLines(document.issuer, labels, false);

  if (issuerName) {
    useFont(doc, fonts?.bold, "Helvetica-Bold");
    doc.fillColor(colors.primary).fontSize(17);
    issuerHeaderBottomY = drawFixedText(doc, issuerName, issuerTextX, PAGE.headerTop + issuerNameOffsetY, {
      width: issuerTextWidth,
      align
    });
  }

  if (issuerLines.length > 0) {
    useFont(doc, fonts?.regular, "Helvetica");
    doc.fillColor(colors.text).fontSize(9);
    issuerHeaderBottomY = drawFixedText(doc, issuerLines.join("\n"), issuerTextX, issuerName ? issuerHeaderBottomY + issuerNameGapY : PAGE.headerTop, {
      width: issuerTextWidth,
      align,
      lineGap: 1
    });
  }

  const sellerLines = buildPartyLines(document.seller, labels);
  const clientLines = buildPartyLines(document.client, labels);
  const bankLines = !isStockMovementDocument && document.bankInfo ? buildBankLines(document.bankInfo, labels) : null;

  let titleBottomY = PAGE.headerTop;
  if (document.title) {
    useFont(doc, fonts?.bold, "Helvetica-Bold");
    doc.fillColor(colors.text).fontSize(20);
    titleBottomY = drawFixedText(doc, document.title, rightColumnX, PAGE.headerTop, {
      width: columnWidth,
      align,
      lineBreak: true
    });
  }

  let metaBottomY = titleBottomY;
  if (document.number) {
    useFont(doc, fonts?.regular, "Helvetica");
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
  if (!isStockMovementDocument && document.currency) {
    metaBottomY = Math.max(metaBottomY, drawLabelValue(doc, metaTopX, metaBottomY + metaRowGapY, labels.currency, document.currency, columnWidth, align, colors.metaText));
  }

  const minimumHeaderBottomY = PAGE.headerTop + (isStockMovementDocument ? 72 : 48);
  const headerBottomY = Math.max(metaBottomY, issuerHeaderBottomY, minimumHeaderBottomY);
  let y = headerBottomY + tableTopGapY;
  if (sellerLines.length > 0 || clientLines.length > 0 || bankLines) {
    const sectionsTopY = headerBottomY + sectionGapY;

    useFont(doc, fonts?.bold, "Helvetica-Bold");
    doc.fillColor(colors.mutedText).fontSize(10);
    if (sellerLines.length > 0) {
      drawFixedText(doc, labels.seller, leftColumnX, sectionsTopY, { width: columnWidth, align });
    }
    if (clientLines.length > 0) {
      drawFixedText(doc, labels.client, rightColumnX, sectionsTopY, { width: columnWidth, align });
    }

    useFont(doc, fonts?.regular, "Helvetica");
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
      useFont(doc, fonts?.bold, "Helvetica-Bold");
      doc.fillColor(colors.mutedText).fontSize(9);
      drawFixedText(doc, labels.bankDetails, leftColumnX, leftSectionBottomY + bankSectionGapY, { width: columnWidth, align });
      useFont(doc, fonts?.regular, "Helvetica");
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
    if (isStockMovementDocument) {
      const columns = {
        itemX: tableX + 12,
        itemWidth: 350,
        quantityX: tableX + 400,
        quantityWidth: 50
      };

      const drawHeader = (headerY: number): void => {
        doc.fillColor(colors.primary).rect(tableX, headerY, tableWidth, 24).fill();
        useFont(doc, fonts?.bold, "Helvetica-Bold");
        doc.fillColor(colors.onPrimary).fontSize(10);
        drawFixedText(doc, labels.item, columns.itemX, headerY + 7, { width: columns.itemWidth, align });
        drawFixedText(doc, labels.quantity, columns.quantityX, headerY + 7, { width: columns.quantityWidth, align: "right" });
      };

      if (y + 24 > contentBottomY) {
        doc.addPage();
        y = PAGE.margin;
      }
      drawHeader(y);
      y += 24;
      useFont(doc, fonts?.regular, "Helvetica");
      for (const item of items) {
        const itemLabel = item.description ? `${item.name} - ${item.description}` : item.name;
        const quantityLabel = `${item.quantity}${item.unit ? ` ${item.unit}` : ""}`;
        const rowHeight = getMaxRowHeight(doc, [
          { text: itemLabel, width: columns.itemWidth, options: { align, lineGap: 1 } },
          { text: quantityLabel, width: columns.quantityWidth, options: { align: "right", lineGap: 1 } }
        ], 24);
        y = ensureTableRowSpace(y, rowHeight, drawHeader);
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

      const drawHeader = (headerY: number): void => {
        doc.fillColor(colors.primary).rect(tableX, headerY, tableWidth, 24).fill();
        useFont(doc, fonts?.bold, "Helvetica-Bold");
        doc.fillColor(colors.onPrimary).fontSize(10);
        drawFixedText(doc, labels.item, columns.itemX, headerY + 7, { width: columns.itemWidth, align });
        drawFixedText(doc, labels.quantity, columns.quantityX, headerY + 7, { width: columns.quantityWidth, align: "right" });
        drawFixedText(doc, labels.unitPrice, columns.unitPriceX, headerY + 7, { width: columns.unitPriceWidth, align: "right" });
        drawFixedText(doc, labels.amount, columns.amountX, headerY + 7, { width: columns.amountWidth, align: "right" });
      };

      if (y + 24 > contentBottomY) {
        doc.addPage();
        y = PAGE.margin;
      }
      drawHeader(y);
      y += 24;
      useFont(doc, fonts?.regular, "Helvetica");
      for (const item of items) {
        const itemLabel = item.description ? `${item.name} - ${item.description}` : item.name;
        const quantityLabel = `${item.quantity}${item.unit ? ` ${item.unit}` : ""}`;
        const rowHeight = getMaxRowHeight(doc, [
          { text: itemLabel, width: columns.itemWidth, options: { align, lineGap: 1 } },
          { text: quantityLabel, width: columns.quantityWidth, options: { align: "right", lineGap: 1 } }
        ], 24);
        y = ensureTableRowSpace(y, rowHeight, drawHeader);
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
  if (!isStockMovementDocument && document.paymentTerms?.label) {
    notes.push(`${labels.paymentTerms}: ${document.paymentTerms.label}`);
  }
  if (!isStockMovementDocument && document.paymentTerms?.notes) {
    notes.push(document.paymentTerms.notes);
  }
  if (document.notes) {
    notes.push(`${labels.notes}: ${document.notes}`);
  }

  if (!isStockMovementDocument && document.totals) {
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
      useFont(doc, fonts?.bold, "Helvetica-Bold");
      doc.fillColor(colors.mutedText).fontSize(10);
      drawFixedText(doc, labels.notes, PAGE.margin, y, { width: notesWidth, align });
      useFont(doc, fonts?.regular, "Helvetica");
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

      useFont(doc, isTotal ? fonts?.bold : fonts?.regular, isTotal ? "Helvetica-Bold" : "Helvetica");
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
    useFont(doc, fonts?.bold, "Helvetica-Bold");
    doc.fillColor(colors.mutedText).fontSize(10);
    drawFixedText(doc, labels.notes, PAGE.margin, y, { width: tableWidth, align });
    useFont(doc, fonts?.regular, "Helvetica");
    doc.fillColor(colors.text).fontSize(9);
    drawFixedText(doc, notes.join("\n"), PAGE.margin, y + notesBodyOffsetY, { width: tableWidth, align, lineGap: 1 });
  }

  useFont(doc, fonts?.regular, "Helvetica");
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
