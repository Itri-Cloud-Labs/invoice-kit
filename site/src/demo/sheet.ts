import { isQuantityOnlyDocument } from "@kit/core/document-kinds";
import type { BusinessDocumentData, DocumentColors, Party, PdfSpacingOptions, TemplateLabels } from "@kit/core/types";
import { getLabels } from "@kit/locales/index";
import { formatDate, formatMoney } from "@kit/utils/formatting";

// A browser stand-in for packages/typescript/src/renderers/pdf.ts. One CSS pixel is one
// PDF point; every offset, column and default below is copied from that renderer.

export const PAGE = { width: 595.28, height: 841.89, margin: 48, headerTop: 42 };

export const DEFAULT_COLORS: Required<DocumentColors> = {
  primary: "#173d73",
  onPrimary: "#ffffff",
  text: "#111827",
  metaText: "#4b5563",
  mutedText: "#6b7280",
  border: "#d1d5db",
  footerText: "#9ca3af"
};

export const spacingDefaults = (quantityOnly: boolean): Required<PdfSpacingOptions> => ({
  issuerNameToDetails: 10,
  titleToMetadata: 10,
  metadataRowGap: 7,
  headerToParties: quantityOnly ? 34 : 30,
  partyLabelToDetails: 22,
  partiesToTable: 24,
  headerToTable: quantityOnly ? 24 : 20,
  tableToSummary: 20,
  bankLabelToDetails: 18,
  bankToNotes: 16,
  notesLabelToDetails: 18,
  detailLineGap: 2,
  tableHeaderHeight: 28,
  tableRowMinHeight: 30,
  tableRowVerticalPadding: 16,
  tableTextTopPadding: 9,
  summaryRowHeight: 26,
  summaryBottomGap: 16
});

type Child = Node | string | null | undefined | false;

const el = (
  tag: string,
  className: string,
  style: Record<string, string | number> = {},
  children: Child[] = []
): HTMLElement => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  for (const [property, value] of Object.entries(style)) {
    node.style.setProperty(property, typeof value === "number" ? `${value}px` : value);
  }
  for (const child of children) {
    if (child) node.append(child);
  }
  return node;
};

// PDFKit lays Helvetica out on a 1.156em line and adds lineGap after each line.
const LINE = 1.156;

const text = (
  value: string,
  size: number,
  options: { gap?: number; bold?: boolean; color?: string; align?: string; width?: number; key?: string; top?: number } = {}
): HTMLElement => {
  const node = el("div", "tx", { "--fs": String(size), "--lg": String(options.gap ?? 0) }, [value]);
  if (options.bold) node.classList.add("tx--bold");
  if (options.color) node.style.color = options.color;
  if (options.align) node.style.textAlign = options.align;
  if (options.width !== undefined) node.style.width = `${options.width}px`;
  if (options.top !== undefined) node.style.setProperty("--top", String(options.top));
  if (options.key) node.dataset.key = options.key;
  return node;
};

const textHeight = (lines: number, size: number, gap = 0): number => lines * (size * LINE + gap);

const partyLines = (party: Party | undefined, labels: TemplateLabels, includeName = true): string[] => {
  if (!party) return [];
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

export interface RenderOptions {
  spacing?: PdfSpacingOptions;
  logoSrc?: string;
}

export const renderSheet = (data: BusinessDocumentData, options: RenderOptions = {}): HTMLElement => {
  const labels = getLabels(data.locale);
  const colors = { ...DEFAULT_COLORS, ...data.colors };
  const quantityOnly = isQuantityOnlyDocument(data.type);
  const sp = { ...spacingDefaults(quantityOnly), ...options.spacing };
  const currency = data.currency ?? "MAD";
  const money = (amount: number): string => formatMoney(amount, data.locale, currency);
  const tableWidth = PAGE.width - PAGE.margin * 2;

  const page = el("div", "pg", { color: colors.text, "--pg-border": colors.border });

  // Header: issuer brand block on the left, title and metadata on the right.
  const hasLogo = Boolean(data.issuer?.logo);
  const logoSize = quantityOnly ? 80 : 72;
  const issuerLines = partyLines(data.issuer, labels, false);
  const issuerName = data.issuer?.name;
  const issuerText = el("div", "pg-col", { width: hasLogo ? 148 : 240, "margin-left": hasLogo ? 92 : 0 }, [
    issuerName
      ? text(issuerName, 17, { bold: true, color: colors.primary, top: quantityOnly ? 3 : 1 })
      : null,
    issuerLines.length > 0
      ? text(issuerLines.join("\n"), 9, { gap: sp.detailLineGap, top: issuerName ? sp.issuerNameToDetails : 0 })
      : null
  ]);
  const brand = el("div", "pg-brand", { width: 275 }, [
    hasLogo
      ? el("img", "pg-logo", { width: logoSize, height: logoSize })
      : null,
    issuerText
  ]);
  brand.dataset.key = "issuer";
  const logo = brand.querySelector("img");
  if (logo) {
    logo.setAttribute("src", options.logoSrc ?? "");
    logo.setAttribute("alt", "");
  }

  const meta: Child[] = [];
  if (data.title) meta.push(text(data.title, 20, { bold: true }));
  if (data.number) {
    meta.push(text(`${labels.number}: ${data.number}`, 9, { color: colors.metaText, top: data.title ? sp.titleToMetadata : 0 }));
  }
  const metaRow = (label: string, value: string): HTMLElement =>
    text(`${label}: ${value}`, 10, { color: colors.metaText, top: sp.metadataRowGap });
  if (data.issueDate) meta.push(metaRow(labels.issueDate, formatDate(data.issueDate, data.locale)));
  if (data.dueDate) meta.push(metaRow(labels.dueDate, formatDate(data.dueDate, data.locale)));
  if (!quantityOnly && data.currency) meta.push(metaRow(labels.currency, data.currency));
  const metaColumn = el("div", "pg-col", { width: 224 }, meta);
  metaColumn.dataset.key = "meta";

  const header = el("div", "pg-header", { "min-height": quantityOnly ? 72 : 48 }, [brand, metaColumn]);
  header.dataset.key = "header";
  page.append(header);

  // Seller and client.
  const sellerLines = partyLines(data.seller, labels);
  const clientLines = partyLines(data.client, labels);
  const hasParties = sellerLines.length > 0 || clientLines.length > 0;
  if (hasParties) {
    const party = (label: string, lines: string[], width: number, key: string): HTMLElement => {
      const column = el("div", "pg-col", { width }, lines.length > 0
        ? [
            text(label, 10, { bold: true, color: colors.mutedText, key: `${key}-label` }),
            text(lines.join("\n"), 9, { gap: sp.detailLineGap, top: sp.partyLabelToDetails - textHeight(1, 10), key: `${key}-body` })
          ]
        : []);
      column.dataset.key = key;
      return column;
    };
    const parties = el("div", "pg-parties", { "margin-top": sp.headerToParties, "margin-bottom": sp.partiesToTable }, [
      el("div", "", { width: 275 }, [party(labels.seller, sellerLines, 270, "seller")]),
      party(labels.client, clientLines, 224, "client")
    ]);
    parties.dataset.key = "parties";
    page.append(parties);
  } else {
    page.append(el("div", "", { height: sp.headerToTable }));
  }

  // Item table. Quantity-only documents keep two columns and drop every amount.
  const items = data.items ?? [];
  if (items.length > 0) {
    const grid = quantityOnly ? "12px 350px 38px 50px" : "12px 220px 8px 45px 15px 78px 14px 95px";
    const cell = (value: string, column: number, options: { align?: string; wrap?: boolean; bold?: boolean } = {}): HTMLElement => {
      const node = text(value, 10, { gap: options.wrap ? sp.detailLineGap : 0, ...(options.bold ? { bold: true } : {}), ...(options.align ? { align: options.align } : {}) });
      node.style.gridColumn = String(column);
      if (options.wrap === false) node.classList.add("tx--clip");
      return node;
    };

    const head = el("div", "pg-thead", {
      height: sp.tableHeaderHeight,
      "grid-template-columns": grid,
      background: colors.primary,
      color: colors.onPrimary
    }, [
      cell(labels.item, 2, { bold: true }),
      cell(labels.quantity, 4, { bold: true, align: "right" }),
      ...(quantityOnly
        ? []
        : [cell(labels.unitPrice, 6, { bold: true, align: "right" }), cell(labels.amount, 8, { bold: true, align: "right" })])
    ]);
    head.dataset.key = "thead";

    const table = el("div", "pg-table", { width: tableWidth }, [head]);
    table.dataset.key = "table";
    items.forEach((item, index) => {
      const row = el("div", "pg-row", {
        "grid-template-columns": grid,
        "min-height": sp.tableRowMinHeight,
        "padding-top": sp.tableTextTopPadding,
        "padding-bottom": Math.max(0, sp.tableRowVerticalPadding - sp.tableTextTopPadding)
      }, [
        cell(item.description ? `${item.name} - ${item.description}` : item.name, 2, { wrap: true }),
        cell(`${item.quantity}${item.unit ? ` ${item.unit}` : ""}`, 4, { align: "right", wrap: true }),
        ...(quantityOnly
          ? []
          : [cell(money(item.unitPrice), 6, { align: "right", wrap: false }), cell(money(item.lineTotal), 8, { align: "right", wrap: false })])
      ]);
      row.dataset.key = `row-${index}`;
      table.append(row);
    });
    page.append(table);
  }

  // Bank details and notes on the left, totals on the right.
  const notes: string[] = [];
  if (!quantityOnly && data.paymentTerms?.label) notes.push(`${labels.paymentTerms}: ${data.paymentTerms.label}`);
  if (!quantityOnly && data.paymentTerms?.notes) notes.push(data.paymentTerms.notes);
  if (data.notes) notes.push(`${labels.notes}: ${data.notes}`);

  const bank = !quantityOnly && data.bankInfo
    ? [
        `${labels.bankName}: ${data.bankInfo.bankName}`,
        `${labels.holderName}: ${data.bankInfo.holderName}`,
        ...(data.bankInfo.type === "local"
          ? [`${labels.rib}: ${data.bankInfo.rib}`]
          : [`${labels.swiftCode}: ${data.bankInfo.swiftCode}`, `${labels.iban}: ${data.bankInfo.iban}`])
      ]
    : null;

  const left: Child[] = [];
  if (bank) {
    const block = el("div", "pg-col", {}, [
      text(labels.bankDetails, 9, { bold: true, color: colors.mutedText }),
      text(bank.join("\n"), 9, { gap: sp.detailLineGap, top: sp.bankLabelToDetails - textHeight(1, 9) })
    ]);
    block.dataset.key = "bank";
    left.push(block);
  }
  if (notes.length > 0) {
    const block = el("div", "pg-col", { "margin-top": bank ? sp.bankToNotes : 0 }, [
      text(labels.notes, 10, { bold: true, color: colors.mutedText }),
      text(notes.join("\n"), 9, { gap: 1, top: sp.notesLabelToDetails - textHeight(1, 10) })
    ]);
    block.dataset.key = "notes";
    left.push(block);
  }

  const totals = !quantityOnly && data.totals
    ? ([
        [labels.subtotal, money(data.totals.subtotal)],
        [labels.discount, money(data.totals.discountTotal)],
        [labels.taxableBase, money(data.totals.taxableBase)],
        [`${labels.vat} (${((data.vatRate ?? 0) * 100).toFixed(0)}%)`, money(data.totals.vatAmount)],
        [labels.total, money(data.totals.total)]
      ] as const)
    : null;

  if (left.length > 0 || totals) {
    const trailing = el("div", "pg-trailing", { "margin-top": sp.tableToSummary, width: tableWidth }, [
      el("div", "pg-col", { width: tableWidth - 236 }, left)
    ]);
    trailing.dataset.key = "trailing";
    if (totals) {
      const box = el("div", "pg-totals", { width: 220 });
      box.dataset.key = "totals";
      totals.forEach(([label, value], index) => {
        const isTotal = index === totals.length - 1;
        const row = el("div", "pg-total", {
          height: sp.summaryRowHeight,
          ...(isTotal ? { background: colors.primary, color: colors.onPrimary } : {})
        }, [
          text(label, 10, { bold: isTotal, width: 105 }),
          text(value, 10, { bold: isTotal, width: 85, align: "right" })
        ]);
        row.lastElementChild?.classList.add("tx--clip");
        row.dataset.key = `total-${index}`;
        box.append(row);
      });
      trailing.append(box);
    }
    page.append(trailing);
  }

  // The footer always sits on the bottom edge. Without one, the PDF falls back to title and number.
  const footer = (data.footer ?? [data.title, data.number].filter(Boolean).join(" "))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .join("\n");
  if (footer.length > 0) {
    const node = text(footer, 8, { gap: 1, color: colors.footerText, align: "center", width: tableWidth });
    node.classList.add("pg-footer");
    node.dataset.key = "footer";
    page.append(node);
  }

  return page;
};
