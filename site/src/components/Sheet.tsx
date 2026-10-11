import type { CSSProperties, ReactNode, Ref } from "react";
import { isQuantityOnlyDocument } from "@kit/core/document-kinds";
import type { BusinessDocumentData, Party, PdfSpacingOptions, TemplateLabels } from "@kit/core/types";
import { getLabels } from "@kit/locales/index";
import { formatDate, formatMoney } from "@kit/utils/formatting";
import { DEFAULT_COLORS, PAGE, spacingDefaults } from "../demo/sheet";
import { cx } from "../lib/cx";

// A browser stand-in for packages/typescript/src/renderers/pdf.ts. Every offset and
// column below is copied from that renderer. Blocks carry a data-key so the stage can
// measure them and carry them across renders.

// PDFKit lays Helvetica out on a 1.156em line and adds lineGap after each line.
const LINE = 1.156;

const textHeight = (lineCount: number, size: number, gap = 0): number => lineCount * (size * LINE + gap);

interface TxProps {
  value: string;
  size: number;
  gap?: number;
  bold?: boolean;
  clip?: boolean;
  color?: string;
  align?: "right" | "center";
  width?: number;
  top?: number;
  column?: number;
  name?: string;
  className?: string;
}

const Tx = ({ value, size, gap = 0, bold, clip, color, align, width, top, column, name, className }: TxProps) => (
  <div
    className={cx("tx", bold && "tx--bold", clip && "tx--clip", className)}
    data-key={name}
    style={
      {
        "--fs": size,
        "--lg": gap,
        ...(top !== undefined ? { "--top": top } : {}),
        color,
        textAlign: align,
        width,
        gridColumn: column
      } as CSSProperties
    }
  >
    {value}
  </div>
);

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

interface SheetProps {
  data: BusinessDocumentData;
  spacing?: PdfSpacingOptions;
  logoSrc?: string;
  ref?: Ref<HTMLDivElement>;
  ghostsRef?: Ref<HTMLDivElement>;
}

export const Sheet = ({ data, spacing, logoSrc, ref, ghostsRef }: SheetProps) => {
  const labels = getLabels(data.locale);
  const colors = { ...DEFAULT_COLORS, ...data.colors };
  const quantityOnly = isQuantityOnlyDocument(data.type);
  const sp = { ...spacingDefaults(quantityOnly), ...spacing };
  const currency = data.currency ?? "MAD";
  const money = (amount: number): string => formatMoney(amount, data.locale, currency);
  const tableWidth = PAGE.width - PAGE.margin * 2;

  // Header: issuer brand block on the left, title and metadata on the right.
  const hasLogo = Boolean(data.issuer?.logo);
  const logoSize = quantityOnly ? 80 : 72;
  const issuerLines = partyLines(data.issuer, labels, false);
  const issuerName = data.issuer?.name;

  const metaRows: Array<[string, string]> = [];
  if (data.issueDate) metaRows.push([labels.issueDate, formatDate(data.issueDate, data.locale)]);
  if (data.dueDate) metaRows.push([labels.dueDate, formatDate(data.dueDate, data.locale)]);
  if (!quantityOnly && data.currency) metaRows.push([labels.currency, data.currency]);

  // Seller and client.
  const sellerLines = partyLines(data.seller, labels);
  const clientLines = partyLines(data.client, labels);
  const party = (label: string, partyText: string[], width: number, name: string): ReactNode => (
    <div className="pg-col" data-key={name} style={{ width }}>
      {partyText.length > 0 && (
        <>
          <Tx value={label} size={10} bold color={colors.mutedText} name={`${name}-label`} />
          <Tx
            value={partyText.join("\n")}
            size={9}
            gap={sp.detailLineGap}
            top={sp.partyLabelToDetails - textHeight(1, 10)}
            name={`${name}-body`}
          />
        </>
      )}
    </div>
  );

  // Item table. Quantity-only documents keep two columns and drop every amount.
  const items = data.items ?? [];
  const grid = quantityOnly ? "12px 350px 38px 50px" : "12px 220px 8px 45px 15px 78px 14px 95px";

  // Bank details and notes on the left, totals on the right.
  const notes: string[] = [];
  if (!quantityOnly && data.paymentTerms?.label) notes.push(`${labels.paymentTerms}: ${data.paymentTerms.label}`);
  if (!quantityOnly && data.paymentTerms?.notes) notes.push(data.paymentTerms.notes);
  if (data.notes) notes.push(`${labels.notes}: ${data.notes}`);

  const bank =
    !quantityOnly && data.bankInfo
      ? [
          `${labels.bankName}: ${data.bankInfo.bankName}`,
          `${labels.holderName}: ${data.bankInfo.holderName}`,
          ...(data.bankInfo.type === "local"
            ? [`${labels.rib}: ${data.bankInfo.rib}`]
            : [`${labels.swiftCode}: ${data.bankInfo.swiftCode}`, `${labels.iban}: ${data.bankInfo.iban}`])
        ]
      : null;

  const totals =
    !quantityOnly && data.totals
      ? ([
          [labels.subtotal, money(data.totals.subtotal)],
          [labels.discount, money(data.totals.discountTotal)],
          [labels.taxableBase, money(data.totals.taxableBase)],
          [`${labels.vat} (${((data.vatRate ?? 0) * 100).toFixed(0)}%)`, money(data.totals.vatAmount)],
          [labels.total, money(data.totals.total)]
        ] as const)
      : null;

  // The footer always sits on the bottom edge. Without one, the PDF falls back to title and number.
  const footer = (data.footer ?? [data.title, data.number].filter(Boolean).join(" "))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .join("\n");

  return (
    <div ref={ref} className="pg" style={{ color: colors.text, "--pg-border": colors.border } as CSSProperties}>
      <div className="pg-header" data-key="header" style={{ minHeight: quantityOnly ? 72 : 48 }}>
        <div className="pg-brand" data-key="issuer" style={{ width: 275 }}>
          {hasLogo && <img className="pg-logo" src={logoSrc} alt="" style={{ width: logoSize, height: logoSize }} />}
          <div className="pg-col" style={{ width: hasLogo ? 148 : 240, marginLeft: hasLogo ? 92 : 0 }}>
            {issuerName && <Tx value={issuerName} size={17} bold color={colors.primary} top={quantityOnly ? 3 : 1} />}
            {issuerLines.length > 0 && (
              <Tx
                value={issuerLines.join("\n")}
                size={9}
                gap={sp.detailLineGap}
                top={issuerName ? sp.issuerNameToDetails : 0}
              />
            )}
          </div>
        </div>
        <div className="pg-col" data-key="meta" style={{ width: 224 }}>
          {data.title && <Tx value={data.title} size={20} bold />}
          {data.number && (
            <Tx
              value={`${labels.number}: ${data.number}`}
              size={9}
              color={colors.metaText}
              top={data.title ? sp.titleToMetadata : 0}
            />
          )}
          {metaRows.map(([label, value]) => (
            <Tx key={label} value={`${label}: ${value}`} size={10} color={colors.metaText} top={sp.metadataRowGap} />
          ))}
        </div>
      </div>

      {sellerLines.length > 0 || clientLines.length > 0 ? (
        <div
          className="pg-parties"
          data-key="parties"
          style={{ marginTop: sp.headerToParties, marginBottom: sp.partiesToTable }}
        >
          <div style={{ width: 275 }}>{party(labels.seller, sellerLines, 270, "seller")}</div>
          {party(labels.client, clientLines, 224, "client")}
        </div>
      ) : (
        <div style={{ height: sp.headerToTable }} />
      )}

      {items.length > 0 && (
        <div className="pg-table" data-key="table" style={{ width: tableWidth }}>
          <div
            className="pg-thead"
            data-key="thead"
            style={{
              height: sp.tableHeaderHeight,
              gridTemplateColumns: grid,
              background: colors.primary,
              color: colors.onPrimary
            }}
          >
            <Tx value={labels.item} size={10} bold column={2} />
            <Tx value={labels.quantity} size={10} bold align="right" column={4} />
            {!quantityOnly && (
              <>
                <Tx value={labels.unitPrice} size={10} bold align="right" column={6} />
                <Tx value={labels.amount} size={10} bold align="right" column={8} />
              </>
            )}
          </div>
          {items.map((item, index) => (
            <div
              key={index}
              className="pg-row"
              data-key={`row-${index}`}
              style={{
                gridTemplateColumns: grid,
                minHeight: sp.tableRowMinHeight,
                paddingTop: sp.tableTextTopPadding,
                paddingBottom: Math.max(0, sp.tableRowVerticalPadding - sp.tableTextTopPadding)
              }}
            >
              <Tx
                value={item.description ? `${item.name} - ${item.description}` : item.name}
                size={10}
                gap={sp.detailLineGap}
                column={2}
              />
              <Tx
                value={`${item.quantity}${item.unit ? ` ${item.unit}` : ""}`}
                size={10}
                gap={sp.detailLineGap}
                align="right"
                column={4}
              />
              {!quantityOnly && (
                <>
                  <Tx value={money(item.unitPrice)} size={10} clip align="right" column={6} />
                  <Tx value={money(item.lineTotal)} size={10} clip align="right" column={8} />
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {(bank || notes.length > 0 || totals) && (
        <div className="pg-trailing" data-key="trailing" style={{ marginTop: sp.tableToSummary, width: tableWidth }}>
          <div className="pg-col" style={{ width: tableWidth - 236 }}>
            {bank && (
              <div className="pg-col" data-key="bank">
                <Tx value={labels.bankDetails} size={9} bold color={colors.mutedText} />
                <Tx
                  value={bank.join("\n")}
                  size={9}
                  gap={sp.detailLineGap}
                  top={sp.bankLabelToDetails - textHeight(1, 9)}
                />
              </div>
            )}
            {notes.length > 0 && (
              <div className="pg-col" data-key="notes" style={{ marginTop: bank ? sp.bankToNotes : 0 }}>
                <Tx value={labels.notes} size={10} bold color={colors.mutedText} />
                <Tx value={notes.join("\n")} size={9} gap={1} top={sp.notesLabelToDetails - textHeight(1, 10)} />
              </div>
            )}
          </div>
          {totals && (
            <div className="pg-totals" data-key="totals" style={{ width: 220 }}>
              {totals.map(([label, value], index) => {
                const isTotal = index === totals.length - 1;
                return (
                  <div
                    key={index}
                    className="pg-total"
                    data-key={`total-${index}`}
                    style={{
                      height: sp.summaryRowHeight,
                      ...(isTotal ? { background: colors.primary, color: colors.onPrimary } : {})
                    }}
                  >
                    <Tx value={label} size={10} bold={isTotal} width={105} />
                    <Tx value={value} size={10} bold={isTotal} clip width={85} align="right" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {footer.length > 0 && (
        <Tx
          value={footer}
          size={8}
          gap={1}
          color={colors.footerText}
          align="center"
          width={tableWidth}
          name="footer"
          className="pg-footer"
        />
      )}

      <div ref={ghostsRef} className="pg-ghosts" />
    </div>
  );
};
