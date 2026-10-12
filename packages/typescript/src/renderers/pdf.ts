import PDFDocument from "../vendor/pdfkit.cjs";
import type { BusinessDocumentData, PdfRenderOptions } from "../core/types.js";
import { isQuantityOnlyDocument } from "../core/document-kinds.js";
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
  truncateText
} from "./pdf-support.js";
import {
  drawTextRun,
  formatLabelValue,
  isolate,
  layoutTextRun,
  measureTextHeight,
  measureTextWidth,
  setTextDirection,
  useFont
} from "./pdf-text.js";

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
  const isRtl = document.locale === "ar-MA";
  const isQuantityOnly = isQuantityOnlyDocument(document.type);
  // Right-to-left documents mirror the whole page: text starts on the right, numeric
  // columns end on the left, and every block swaps sides.
  const align: "left" | "right" = isRtl ? "right" : "left";
  const endAlign: "left" | "right" = isRtl ? "left" : "right";
  const mirrorX = (x: number, width: number): number => (isRtl ? PAGE.width - x - width : x);
  const leftColumnX = PAGE.margin;
  const rightColumnX = PAGE.margin + 275;
  const columnWidth = 224;
  const tableX = PAGE.margin;
  const tableWidth = PAGE.width - PAGE.margin * 2;
  const spacing = options?.spacing;
  const logoFit: [number, number] = isQuantityOnly ? [80, 80] : [72, 72];
  const issuerNameOffsetY = isQuantityOnly ? 3 : 1;
  const issuerNameGapY = resolveSpacing(spacing?.issuerNameToDetails, 10, "issuerNameToDetails");
  const configuredTitleMetaGapY = resolveSpacing(spacing?.titleToMetadata, 10, "titleToMetadata");
  const titleMetaGapY = document.title ? configuredTitleMetaGapY : 0;
  const metaRowGapY = resolveSpacing(spacing?.metadataRowGap, 7, "metadataRowGap");
  const sectionGapY = resolveSpacing(
    spacing?.headerToParties,
    isQuantityOnly ? 34 : 30,
    "headerToParties"
  );
  const sectionBodyOffsetY = resolveSpacing(spacing?.partyLabelToDetails, 22, "partyLabelToDetails");
  const sectionAfterGapY = resolveSpacing(spacing?.partiesToTable, 24, "partiesToTable");
  const bankDetailsBodyOffsetY = resolveSpacing(spacing?.bankLabelToDetails, 18, "bankLabelToDetails");
  const bankNotesGapY = resolveSpacing(spacing?.bankToNotes, 16, "bankToNotes");
  const tableTopGapY = resolveSpacing(
    spacing?.headerToTable,
    isQuantityOnly ? 24 : 20,
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
  setTextDirection(doc, isRtl ? "rtl" : "ltr");
  const logoBuffer = document.issuer?.logo ? await fetchLogo(document.issuer.logo) : null;
  const fallbackFooter = [document.title, document.number].filter(Boolean).join(" ");
  const footerText = isolate(normalizeFooterText(document.footer ?? fallbackFooter));
  const footerOptions = {
    width: tableWidth,
    align: "center" as const,
    lineGap: 1
  };
  useFont(doc, fonts?.regular, "Helvetica");
  doc.fontSize(8);
  const footerHeight = footerText.length > 0 ? measureTextHeight(doc, footerText, footerOptions) : 0;
  const contentBottomY = PAGE.height - Math.max(PAGE.margin + 8, footerHeight + 8);
  const pageRowCapacityY = contentBottomY - (PAGE.margin + tableHeaderHeight);
  const issuerTextWidth = logoBuffer ? 148 : 240;
  const issuerTextX = mirrorX(leftColumnX + (logoBuffer ? 92 : 0), issuerTextWidth);
  const titleX = mirrorX(rightColumnX, columnWidth);
  const ensureTableRowSpace = (currentY: number, rowHeight: number, drawHeader: (headerY: number) => void): number => {
    if (currentY + rowHeight <= contentBottomY) {
      return currentY;
    }

    doc.addPage();
    drawHeader(PAGE.margin);
    useFont(doc, fonts?.regular, "Helvetica");
    return PAGE.margin + tableHeaderHeight;
  };
  const rowTextBottomGapY = tableRowVerticalPadding - tableTextOffsetY;
  type TableCell = { text: string; x: number; width: number; align: "left" | "right" };
  const drawRowCells = (rowTopY: number, cells: TableCell[]): void => {
    doc.fillColor(colors.text).fontSize(10);

    for (const cell of cells) {
      drawFixedText(doc, cell.text, cell.x, rowTopY + tableTextOffsetY, {
        width: cell.width,
        align: cell.align,
        lineGap: detailLineGapY
      });
    }
  };
  // A row taller than a page cannot fit anywhere. Flow every cell across pages instead: draw
  // as many lines as fit on each page, repeat the table header, and close each page segment
  // at the footer-aware content limit so text never crosses its border.
  const flowOversizedRow = (cells: TableCell[], drawHeader: (headerY: number) => void, rowTopY: number): number => {
    const textLimitY = contentBottomY - rowTextBottomGapY;
    const entries = cells.map((cell) => ({
      cell,
      run: layoutTextRun(doc, cell.text, { width: cell.width, align: cell.align, lineGap: detailLineGapY }),
      nextLine: 0
    }));

    let segmentTopY = rowTopY;

    for (;;) {
      const textTopY = segmentTopY + tableTextOffsetY;
      let contentLimitingBottomY = textTopY;

      doc.fillColor(colors.text).fontSize(10);

      for (const entry of entries) {
        if (entry.nextLine >= entry.run.lineCount) {
          continue;
        }

        const { nextLine, bottomY } = drawTextRun(doc, entry.run, entry.cell.x, textTopY, entry.nextLine, textLimitY);
        entry.nextLine = nextLine;
        contentLimitingBottomY = Math.max(contentLimitingBottomY, bottomY);
      }

      const isComplete = entries.every((entry) => entry.nextLine >= entry.run.lineCount);
      const segmentBottomY = isComplete ? contentLimitingBottomY + rowTextBottomGapY : contentBottomY;

      doc.strokeColor(colors.border).lineWidth(1).rect(tableX, segmentTopY, tableWidth, segmentBottomY - segmentTopY).stroke();

      if (isComplete) {
        return segmentBottomY;
      }

      doc.addPage();
      drawHeader(PAGE.margin);
      useFont(doc, fonts?.regular, "Helvetica");
      segmentTopY = PAGE.margin + tableHeaderHeight;
    }
  };

  if (logoBuffer) {
    doc.image(logoBuffer, mirrorX(leftColumnX, logoFit[0]), PAGE.headerTop, {
      fit: logoFit,
      ...(isRtl ? { align: "right" as const } : {})
    });
  }

  let issuerHeaderBottomY = PAGE.headerTop;
  const issuerName = document.issuer?.name;
  const issuerLines = buildPartyLines(document.issuer, labels, false);

  if (issuerName) {
    useFont(doc, fonts?.bold, "Helvetica-Bold");
    doc.fillColor(colors.primary).fontSize(17);
    issuerHeaderBottomY = drawFixedText(doc, isolate(issuerName), issuerTextX, PAGE.headerTop + issuerNameOffsetY, {
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
  const bankLines = !isQuantityOnly && document.bankInfo ? buildBankLines(document.bankInfo, labels) : null;

  let titleBottomY = PAGE.headerTop;
  if (document.title) {
    useFont(doc, fonts?.bold, "Helvetica-Bold");
    doc.fillColor(colors.text).fontSize(20);
    titleBottomY = drawFixedText(doc, isolate(document.title), titleX, PAGE.headerTop, {
      width: columnWidth,
      align,
      lineBreak: true
    });
  }

  let metaBottomY = titleBottomY;
  if (document.number) {
    useFont(doc, fonts?.regular, "Helvetica");
    doc.fillColor(colors.metaText).fontSize(9);
    metaBottomY = drawFixedText(doc, formatLabelValue(labels.number, document.number), titleX, titleBottomY + titleMetaGapY, {
      width: columnWidth,
      align
    });
  }

  if (document.issueDate) {
    metaBottomY = Math.max(metaBottomY, drawLabelValue(doc, titleX, metaBottomY + metaRowGapY, labels.issueDate, formatDate(document.issueDate, document.locale), columnWidth, align, colors.metaText));
  }
  if (document.dueDate) {
    metaBottomY = Math.max(metaBottomY, drawLabelValue(doc, titleX, metaBottomY + metaRowGapY, labels.dueDate, formatDate(document.dueDate, document.locale), columnWidth, align, colors.metaText));
  }
  if (!isQuantityOnly && document.currency) {
    metaBottomY = Math.max(metaBottomY, drawLabelValue(doc, titleX, metaBottomY + metaRowGapY, labels.currency, document.currency, columnWidth, align, colors.metaText));
  }

  const minimumHeaderBottomY = PAGE.headerTop + (isQuantityOnly ? 72 : 48);
  const logoBottomY = logoBuffer ? PAGE.headerTop + logoFit[1] : PAGE.headerTop;
  const headerBottomY = Math.max(metaBottomY, issuerHeaderBottomY, logoBottomY, minimumHeaderBottomY);
  let y = headerBottomY + tableTopGapY;
  if (sellerLines.length > 0 || clientLines.length > 0) {
    const sectionsTopY = headerBottomY + sectionGapY;

    useFont(doc, fonts?.bold, "Helvetica-Bold");
    doc.fillColor(colors.mutedText).fontSize(10);
    if (sellerLines.length > 0) {
      drawFixedText(doc, labels.seller, mirrorX(leftColumnX, columnWidth), sectionsTopY, { width: columnWidth, align });
    }
    if (clientLines.length > 0) {
      drawFixedText(doc, labels.client, titleX, sectionsTopY, { width: columnWidth, align });
    }

    useFont(doc, fonts?.regular, "Helvetica");
    doc.fillColor(colors.text).fontSize(9);
    let leftSectionBottomY = sectionsTopY;
    if (sellerLines.length > 0) {
      leftSectionBottomY = drawFixedText(doc, sellerLines.join("\n"), mirrorX(leftColumnX, 270), sectionsTopY + sectionBodyOffsetY, {
        width: 270,
        align,
        lineGap: detailLineGapY
      });
    }

    let clientBottomY = sectionsTopY;
    if (clientLines.length > 0) {
      clientBottomY = drawFixedText(doc, clientLines.join("\n"), titleX, sectionsTopY + sectionBodyOffsetY, {
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
    if (isQuantityOnly) {
      const columns = {
        itemX: mirrorX(tableX + 12, 350),
        itemWidth: 350,
        quantityX: mirrorX(tableX + 400, 50),
        quantityWidth: 50
      };

      const drawHeader = (headerY: number): void => {
        doc.fillColor(colors.primary).rect(tableX, headerY, tableWidth, tableHeaderHeight).fill();
        useFont(doc, fonts?.bold, "Helvetica-Bold");
        doc.fillColor(colors.onPrimary).fontSize(10);
        drawFixedText(doc, labels.item, columns.itemX, headerY + 8, { width: columns.itemWidth, align });
        drawFixedText(doc, labels.quantity, columns.quantityX, headerY + 8, { width: columns.quantityWidth, align: endAlign });
      };

      if (y + tableHeaderHeight > contentBottomY) {
        doc.addPage();
        y = PAGE.margin;
      }
      drawHeader(y);
      y += tableHeaderHeight;
      useFont(doc, fonts?.regular, "Helvetica");
      let pageHasRow = false;

      for (const item of items) {
        const itemLabel = isolate(item.description ? `${item.name} - ${item.description}` : item.name);
        const quantityLabel = isolate(`${item.quantity}${item.unit ? ` ${item.unit}` : ""}`);
        const cells: TableCell[] = [
          { text: itemLabel, x: columns.itemX, width: columns.itemWidth, align },
          { text: quantityLabel, x: columns.quantityX, width: columns.quantityWidth, align: endAlign }
        ];
        const rowHeight = getMaxRowHeight(doc, [
          { text: itemLabel, width: columns.itemWidth, options: { align, lineGap: detailLineGapY } },
          { text: quantityLabel, width: columns.quantityWidth, options: { align: endAlign, lineGap: detailLineGapY } }
        ], tableRowMinHeight, tableRowVerticalPadding);

        if (rowHeight > pageRowCapacityY) {
          if (pageHasRow || contentBottomY - y < tableRowMinHeight) {
            doc.addPage();
            drawHeader(PAGE.margin);
            useFont(doc, fonts?.regular, "Helvetica");
            y = PAGE.margin + tableHeaderHeight;
          }

          y = flowOversizedRow(cells, drawHeader, y);
          pageHasRow = true;
          continue;
        }

        const nextY = ensureTableRowSpace(y, rowHeight, drawHeader);
        if (nextY !== y) {
          pageHasRow = false;
        }
        y = nextY;
        doc.strokeColor(colors.border).lineWidth(1).rect(tableX, y, tableWidth, rowHeight).stroke();
        drawRowCells(y, cells);
        pageHasRow = true;
        y += rowHeight;
      }
    } else {
      const columns = {
        itemX: mirrorX(tableX + 12, 220),
        itemWidth: 220,
        quantityX: mirrorX(tableX + 240, 45),
        quantityWidth: 45,
        unitPriceX: mirrorX(tableX + 300, 78),
        unitPriceWidth: 78,
        amountX: mirrorX(tableX + 392, 95),
        amountWidth: 95
      };

      const drawHeader = (headerY: number): void => {
        doc.fillColor(colors.primary).rect(tableX, headerY, tableWidth, tableHeaderHeight).fill();
        useFont(doc, fonts?.bold, "Helvetica-Bold");
        doc.fillColor(colors.onPrimary).fontSize(10);
        drawFixedText(doc, labels.item, columns.itemX, headerY + 8, { width: columns.itemWidth, align });
        drawFixedText(doc, labels.quantity, columns.quantityX, headerY + 8, { width: columns.quantityWidth, align: endAlign });
        drawFixedText(doc, labels.unitPrice, columns.unitPriceX, headerY + 8, { width: columns.unitPriceWidth, align: endAlign });
        drawFixedText(doc, labels.amount, columns.amountX, headerY + 8, { width: columns.amountWidth, align: endAlign });
      };

      if (y + tableHeaderHeight > contentBottomY) {
        doc.addPage();
        y = PAGE.margin;
      }
      drawHeader(y);
      y += tableHeaderHeight;
      useFont(doc, fonts?.regular, "Helvetica");
      let pageHasRow = false;

      for (const item of items) {
        const itemLabel = isolate(item.description ? `${item.name} - ${item.description}` : item.name);
        const quantityLabel = isolate(`${item.quantity}${item.unit ? ` ${item.unit}` : ""}`);
        const unitPriceLabel = isolate(truncateText(doc, formatMoney(item.unitPrice, document.locale, document.currency ?? "MAD"), columns.unitPriceWidth));
        const amountLabel = isolate(truncateText(doc, formatMoney(item.lineTotal, document.locale, document.currency ?? "MAD"), columns.amountWidth));
        const cells: TableCell[] = [
          { text: itemLabel, x: columns.itemX, width: columns.itemWidth, align },
          { text: quantityLabel, x: columns.quantityX, width: columns.quantityWidth, align: endAlign },
          { text: unitPriceLabel, x: columns.unitPriceX, width: columns.unitPriceWidth, align: endAlign },
          { text: amountLabel, x: columns.amountX, width: columns.amountWidth, align: endAlign }
        ];
        const rowHeight = getMaxRowHeight(doc, [
          { text: itemLabel, width: columns.itemWidth, options: { align, lineGap: detailLineGapY } },
          { text: quantityLabel, width: columns.quantityWidth, options: { align: endAlign, lineGap: detailLineGapY } }
        ], tableRowMinHeight, tableRowVerticalPadding);

        if (rowHeight > pageRowCapacityY) {
          if (pageHasRow || contentBottomY - y < tableRowMinHeight) {
            doc.addPage();
            drawHeader(PAGE.margin);
            useFont(doc, fonts?.regular, "Helvetica");
            y = PAGE.margin + tableHeaderHeight;
          }

          y = flowOversizedRow(cells, drawHeader, y);
          pageHasRow = true;
          continue;
        }

        const nextY = ensureTableRowSpace(y, rowHeight, drawHeader);
        if (nextY !== y) {
          pageHasRow = false;
        }
        y = nextY;
        doc.strokeColor(colors.border).lineWidth(1).rect(tableX, y, tableWidth, rowHeight).stroke();
        drawRowCells(y, cells);
        pageHasRow = true;
        y += rowHeight;
      }
    }
  }

  const notes: string[] = [];
  if (!isQuantityOnly && document.paymentTerms?.label) {
    notes.push(formatLabelValue(labels.paymentTerms, document.paymentTerms.label));
  }
  if (!isQuantityOnly && document.paymentTerms?.notes) {
    notes.push(isolate(document.paymentTerms.notes));
  }
  if (document.notes) {
    notes.push(formatLabelValue(labels.notes, document.notes));
  }

  const bankText = bankLines?.join("\n");
  const leftDetailsWidth = tableWidth - 236;
  const leftDetailsX = mirrorX(tableX, leftDetailsWidth);
  useFont(doc, fonts?.regular, "Helvetica");
  doc.fontSize(9);
  const bankDetailsHeight = bankText
    ? bankDetailsBodyOffsetY + measureTextHeight(doc, bankText, {
      width: leftDetailsWidth,
      align,
      lineGap: detailLineGapY
    })
    : 0;
  const notesHeight = notes.length > 0
    ? notesBodyOffsetY + measureTextHeight(doc, notes.join("\n"), {
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
      drawFixedText(doc, labels.bankDetails, leftDetailsX, startY, { width: leftDetailsWidth, align });

      useFont(doc, fonts?.regular, "Helvetica");
      doc.fillColor(colors.text).fontSize(9);
      leftBottomY = drawFixedText(doc, bankText, leftDetailsX, startY + bankDetailsBodyOffsetY, {
        width: leftDetailsWidth,
        align,
        lineGap: detailLineGapY
      });
    }

    if (notes.length > 0) {
      const notesTopY = bankText ? leftBottomY + bankNotesGapY : startY;
      useFont(doc, fonts?.bold, "Helvetica-Bold");
      doc.fillColor(colors.mutedText).fontSize(10);
      drawFixedText(doc, labels.notes, leftDetailsX, notesTopY, { width: leftDetailsWidth, align });

      useFont(doc, fonts?.regular, "Helvetica");
      doc.fillColor(colors.text).fontSize(9);
      leftBottomY = drawFixedText(doc, notes.join("\n"), leftDetailsX, notesTopY + notesBodyOffsetY, {
        width: leftDetailsWidth,
        align,
        lineGap: 1
      });
    }

    return leftBottomY;
  };

  if (!isQuantityOnly && document.totals) {
    const money = (amount: number): string => formatMoney(amount, document.locale, document.currency ?? "MAD");
    const totalsBoxWidth = 220;
    const totalsPadding = 10;
    const totalsX = mirrorX(PAGE.width - PAGE.margin - totalsBoxWidth, totalsBoxWidth);
    const totals = [
      [labels.subtotal, money(document.totals.subtotal)],
      [labels.discount, money(document.totals.discountTotal)],
      [labels.taxableBase, money(document.totals.taxableBase)],
      [`${labels.vat} (${((document.vatRate ?? 0) * 100).toFixed(0)}%)`, money(document.totals.vatAmount)],
      [labels.total, money(document.totals.total)]
    ] as const;
    const useTotalsFont = (isTotal: boolean): void => {
      useFont(doc, isTotal ? fonts?.bold : fonts?.regular, isTotal ? "Helvetica-Bold" : "Helvetica");
      doc.fontSize(10);
    };

    // The amount column grows to fit the widest amount, and rows grow with wrapped labels,
    // so wider fonts and longer translated labels are neither truncated nor clipped.
    const valueWidth = totals.reduce((widest, [, value], index) => {
      useTotalsFont(index === totals.length - 1);
      return Math.max(widest, Math.min(120, Math.ceil(measureTextWidth(doc, value))));
    }, 85);
    const labelWidth = totalsBoxWidth - totalsPadding * 3 - valueWidth;
    const totalsStartX = totalsX + totalsPadding;
    const labelX = isRtl ? totalsX + totalsBoxWidth - totalsPadding - labelWidth : totalsStartX;
    const valueX = isRtl ? totalsStartX : totalsX + totalsBoxWidth - totalsPadding - valueWidth;
    const rowHeights = totals.map(([label], index) => {
      useTotalsFont(index === totals.length - 1);
      const labelHeight = measureTextHeight(doc, label, { width: labelWidth, align });
      return Math.max(summaryRowHeight, labelHeight + summaryRowHeight - doc.currentLineHeight(true));
    });
    const totalsHeight = rowHeights.reduce((sum, rowHeight) => sum + rowHeight, 0);

    y = ensureSectionSpace(
      doc,
      y + trailingSectionGapY,
      Math.max(totalsHeight, leftDetailsHeight),
      contentBottomY
    ) - trailingSectionGapY;

    y += trailingSectionGapY;
    const trailingBottomY = drawLeftDetails(y);

    let totalsY = y;
    totals.forEach(([label, value], index) => {
      const isTotal = index === totals.length - 1;
      const rowHeight = rowHeights[index] ?? summaryRowHeight;
      doc.fillColor(isTotal ? colors.primary : "white").rect(totalsX, totalsY, totalsBoxWidth, rowHeight).fill();
      doc.strokeColor(colors.border).lineWidth(1).rect(totalsX, totalsY, totalsBoxWidth, rowHeight).stroke();

      useTotalsFont(isTotal);
      doc.fillColor(isTotal ? colors.onPrimary : colors.text);
      drawFixedText(doc, label, labelX, totalsY + 9, { width: labelWidth, align });
      drawFixedText(doc, isolate(truncateText(doc, value, valueWidth)), valueX, totalsY + 9, { width: valueWidth, align: endAlign });
      totalsY += rowHeight;
    });
    y = Math.max(totalsY, trailingBottomY + trailingBottomGapY);
  } else if (leftDetailsHeight > 0) {
    y = ensureSectionSpace(doc, y + trailingSectionGapY, leftDetailsHeight, contentBottomY) - trailingSectionGapY;
    y += trailingSectionGapY;
    y = drawLeftDetails(y);
  }

  useFont(doc, fonts?.regular, "Helvetica");
  const actualPageHeight = doc.page.height ?? 841.89;
  if (footerText.length > 0) {
    doc.fontSize(8);
    doc.page.margins.bottom = 0;
    doc.fillColor(colors.footerText);
    drawFixedText(doc, footerText, PAGE.margin, actualPageHeight - footerHeight, footerOptions);
  }

  doc.end();
  return pdfBytesPromise;
};
