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

const resolveSpacing = (value: number | undefined, fallback: number, name: string): number => {
  if (value === undefined) {
    return fallback;
  }

  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`options.spacing.${name} must be a non-negative finite number.`);
  }

  return value;
};

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
  const spacing = options?.spacing;
  const logoFit: [number, number] = isStockMovementDocument ? [80, 80] : [72, 72];
  const issuerNameOffsetY = isStockMovementDocument ? 3 : 1;
  const issuerNameGapY = resolveSpacing(spacing?.issuerNameToDetails, 10, "issuerNameToDetails");
  const configuredTitleMetaGapY = resolveSpacing(spacing?.titleToMetadata, 10, "titleToMetadata");
  const titleMetaGapY = document.title ? configuredTitleMetaGapY : 0;
  const metaRowGapY = resolveSpacing(spacing?.metadataRowGap, 7, "metadataRowGap");
  const sectionGapY = resolveSpacing(
    spacing?.headerToParties,
    isStockMovementDocument ? 34 : 30,
    "headerToParties"
  );
  const sectionBodyOffsetY = resolveSpacing(spacing?.partyLabelToDetails, 22, "partyLabelToDetails");
  const sectionAfterGapY = resolveSpacing(spacing?.partiesToTable, 24, "partiesToTable");
  const bankDetailsBodyOffsetY = resolveSpacing(spacing?.bankLabelToDetails, 18, "bankLabelToDetails");
  const bankNotesGapY = resolveSpacing(spacing?.bankToNotes, 16, "bankToNotes");
  const tableTopGapY = resolveSpacing(
    spacing?.headerToTable,
    isStockMovementDocument ? 24 : 20,
    "headerToTable"
  );
  const trailingSectionGapY = resolveSpacing(spacing?.tableToSummary, 20, "tableToSummary");
  const notesBodyOffsetY = resolveSpacing(spacing?.notesLabelToDetails, 18, "notesLabelToDetails");
  const trailingBottomGapY = resolveSpacing(spacing?.summaryBottomGap, 16, "summaryBottomGap");
  const detailLineGapY = resolveSpacing(spacing?.detailLineGap, 2, "detailLineGap");
  const tableHeaderHeight = resolveSpacing(spacing?.tableHeaderHeight, 28, "tableHeaderHeight");
  const tableRowMinHeight = resolveSpacing(spacing?.tableRowMinHeight, 30, "tableRowMinHeight");
  const tableRowVerticalPadding = resolveSpacing(
    spacing?.tableRowVerticalPadding,
    16,
    "tableRowVerticalPadding"
  );
  const tableTextOffsetY = resolveSpacing(spacing?.tableTextTopPadding, 9, "tableTextTopPadding");
  const summaryRowHeight = resolveSpacing(spacing?.summaryRowHeight, 26, "summaryRowHeight");
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
    return PAGE.margin + tableHeaderHeight;
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
      lineGap: detailLineGapY
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
  if (sellerLines.length > 0 || clientLines.length > 0) {
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
        lineGap: detailLineGapY
      });
    }

    let clientBottomY = sectionsTopY;
    if (clientLines.length > 0) {
      clientBottomY = drawFixedText(doc, clientLines.join("\n"), rightColumnX, sectionsTopY + sectionBodyOffsetY, {
        width: columnWidth,
        align,
        lineGap: detailLineGapY
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
        doc.fillColor(colors.primary).rect(tableX, headerY, tableWidth, tableHeaderHeight).fill();
        useFont(doc, fonts?.bold, "Helvetica-Bold");
        doc.fillColor(colors.onPrimary).fontSize(10);
        drawFixedText(doc, labels.item, columns.itemX, headerY + 8, { width: columns.itemWidth, align });
        drawFixedText(doc, labels.quantity, columns.quantityX, headerY + 8, { width: columns.quantityWidth, align: "right" });
      };

      if (y + tableHeaderHeight > contentBottomY) {
        doc.addPage();
        y = PAGE.margin;
      }
      drawHeader(y);
      y += tableHeaderHeight;
      useFont(doc, fonts?.regular, "Helvetica");
      for (const item of items) {
        const itemLabel = item.description ? `${item.name} - ${item.description}` : item.name;
        const quantityLabel = `${item.quantity}${item.unit ? ` ${item.unit}` : ""}`;
        const rowHeight = getMaxRowHeight(doc, [
          { text: itemLabel, width: columns.itemWidth, options: { align, lineGap: 1 } },
          { text: quantityLabel, width: columns.quantityWidth, options: { align: "right", lineGap: 1 } }
        ], tableRowMinHeight, tableRowVerticalPadding);
        y = ensureTableRowSpace(y, rowHeight, drawHeader);
        doc.strokeColor(colors.border).lineWidth(1).rect(tableX, y, tableWidth, rowHeight).stroke();
        doc.fillColor(colors.text).fontSize(10);
        drawFixedText(doc, truncateText(doc, itemLabel, columns.itemWidth), columns.itemX, y + tableTextOffsetY, {
          width: columns.itemWidth,
          align
        });
        drawFixedText(doc, quantityLabel, columns.quantityX, y + tableTextOffsetY, {
          width: columns.quantityWidth,
          align: "right",
          lineGap: detailLineGapY
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
        doc.fillColor(colors.primary).rect(tableX, headerY, tableWidth, tableHeaderHeight).fill();
        useFont(doc, fonts?.bold, "Helvetica-Bold");
        doc.fillColor(colors.onPrimary).fontSize(10);
        drawFixedText(doc, labels.item, columns.itemX, headerY + 8, { width: columns.itemWidth, align });
        drawFixedText(doc, labels.quantity, columns.quantityX, headerY + 8, { width: columns.quantityWidth, align: "right" });
        drawFixedText(doc, labels.unitPrice, columns.unitPriceX, headerY + 8, { width: columns.unitPriceWidth, align: "right" });
        drawFixedText(doc, labels.amount, columns.amountX, headerY + 8, { width: columns.amountWidth, align: "right" });
      };

      if (y + tableHeaderHeight > contentBottomY) {
        doc.addPage();
        y = PAGE.margin;
      }
      drawHeader(y);
      y += tableHeaderHeight;
      useFont(doc, fonts?.regular, "Helvetica");
      for (const item of items) {
        const itemLabel = item.description ? `${item.name} - ${item.description}` : item.name;
        const quantityLabel = `${item.quantity}${item.unit ? ` ${item.unit}` : ""}`;
        const rowHeight = getMaxRowHeight(doc, [
          { text: itemLabel, width: columns.itemWidth, options: { align, lineGap: 1 } },
          { text: quantityLabel, width: columns.quantityWidth, options: { align: "right", lineGap: 1 } }
        ], tableRowMinHeight, tableRowVerticalPadding);
        y = ensureTableRowSpace(y, rowHeight, drawHeader);
        doc.strokeColor(colors.border).lineWidth(1).rect(tableX, y, tableWidth, rowHeight).stroke();
        doc.fillColor(colors.text).fontSize(10);
        drawFixedText(doc, itemLabel, columns.itemX, y + tableTextOffsetY, {
          width: columns.itemWidth,
          align,
          lineGap: detailLineGapY
        });
        drawFixedText(doc, quantityLabel, columns.quantityX, y + tableTextOffsetY, {
          width: columns.quantityWidth,
          align: "right",
          lineGap: detailLineGapY
        });
        drawFixedText(doc, truncateText(doc, formatMoney(item.unitPrice, document.locale, document.currency ?? "MAD"), columns.unitPriceWidth), columns.unitPriceX, y + tableTextOffsetY, {
          width: columns.unitPriceWidth,
          align: "right"
        });
        drawFixedText(doc, truncateText(doc, formatMoney(item.lineTotal, document.locale, document.currency ?? "MAD"), columns.amountWidth), columns.amountX, y + tableTextOffsetY, {
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

  const bankText = bankLines?.join("\n");
  const leftDetailsWidth = tableWidth - 236;
  useFont(doc, fonts?.regular, "Helvetica");
  doc.fontSize(9);
  const bankDetailsHeight = bankText
    ? bankDetailsBodyOffsetY + doc.heightOfString(bankText, {
      width: leftDetailsWidth,
      align,
      lineGap: detailLineGapY
    })
    : 0;
  const notesHeight = notes.length > 0
    ? notesBodyOffsetY + doc.heightOfString(notes.join("\n"), {
      width: leftDetailsWidth,
      align,
      lineGap: 1
    })
    : 0;
  const leftDetailsHeight = bankDetailsHeight
    + (bankText && notes.length > 0 ? bankNotesGapY : 0)
    + notesHeight;
  const drawLeftDetails = (startY: number): number => {
    let leftBottomY = startY;

    if (bankText) {
      useFont(doc, fonts?.bold, "Helvetica-Bold");
      doc.fillColor(colors.mutedText).fontSize(9);
      drawFixedText(doc, labels.bankDetails, tableX, startY, { width: leftDetailsWidth, align });

      useFont(doc, fonts?.regular, "Helvetica");
      doc.fillColor(colors.text).fontSize(9);
      leftBottomY = drawFixedText(doc, bankText, tableX, startY + bankDetailsBodyOffsetY, {
        width: leftDetailsWidth,
        align,
        lineGap: detailLineGapY
      });
    }

    if (notes.length > 0) {
      const notesTopY = bankText ? leftBottomY + bankNotesGapY : startY;
      useFont(doc, fonts?.bold, "Helvetica-Bold");
      doc.fillColor(colors.mutedText).fontSize(10);
      drawFixedText(doc, labels.notes, tableX, notesTopY, { width: leftDetailsWidth, align });

      useFont(doc, fonts?.regular, "Helvetica");
      doc.fillColor(colors.text).fontSize(9);
      leftBottomY = drawFixedText(doc, notes.join("\n"), tableX, notesTopY + notesBodyOffsetY, {
        width: leftDetailsWidth,
        align,
        lineGap: 1
      });
    }

    return leftBottomY;
  };

  if (!isStockMovementDocument && document.totals) {
    const totalsHeight = summaryRowHeight * 5;
    y = ensureSectionSpace(doc, y + trailingSectionGapY, Math.max(totalsHeight, leftDetailsHeight)) - trailingSectionGapY;
    const totalsX = PAGE.width - PAGE.margin - 220;
    const totals = [
      [labels.subtotal, formatMoney(document.totals.subtotal, document.locale, document.currency ?? "MAD")],
      [labels.discount, formatMoney(document.totals.discountTotal, document.locale, document.currency ?? "MAD")],
      [labels.taxableBase, formatMoney(document.totals.taxableBase, document.locale, document.currency ?? "MAD")],
      [`${labels.vat} (${((document.vatRate ?? 0) * 100).toFixed(0)}%)`, formatMoney(document.totals.vatAmount, document.locale, document.currency ?? "MAD")],
      [labels.total, formatMoney(document.totals.total, document.locale, document.currency ?? "MAD")]
    ] as const;

    y += trailingSectionGapY;
    const trailingBottomY = drawLeftDetails(y);

    let totalsY = y;
    totals.forEach(([label, value], index) => {
      const isTotal = index === totals.length - 1;
      doc.fillColor(isTotal ? colors.primary : "white").rect(totalsX, totalsY, 220, summaryRowHeight).fill();
      doc.strokeColor(colors.border).lineWidth(1).rect(totalsX, totalsY, 220, summaryRowHeight).stroke();

      useFont(doc, isTotal ? fonts?.bold : fonts?.regular, isTotal ? "Helvetica-Bold" : "Helvetica");
      doc.fillColor(isTotal ? colors.onPrimary : colors.text).fontSize(10);
      drawFixedText(doc, label, totalsX + 10, totalsY + 9, { width: 105, align: "left" });
      drawFixedText(doc, truncateText(doc, value, 85), totalsX + 125, totalsY + 9, { width: 85, align: "right" });
      totalsY += summaryRowHeight;
    });
    y = Math.max(totalsY, trailingBottomY + trailingBottomGapY);
  } else if (leftDetailsHeight > 0) {
    y = ensureSectionSpace(doc, y + trailingSectionGapY, leftDetailsHeight) - trailingSectionGapY;
    y += trailingSectionGapY;
    y = drawLeftDetails(y);
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
