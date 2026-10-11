import { isQuantityOnlyDocument } from "@kit/core/document-kinds";
import type { DocumentTotals, LineItemInput } from "@kit/core/types";
import { fn, lines, literal, note, seq } from "../../demo/code";
import type { DemoState, DocumentKind } from "../../demo/document";
import { VARIABLES, VAT_RATES } from "../../demo/options";
import { cx } from "../../lib/cx";
import { Code, LABEL } from "../ui";
import { Chapter, Lead } from "./Chapter";
import { NumberField } from "./NumberField";

const ROW =
  "grid grid-cols-[minmax(0,1fr)_4.4rem_6rem_5.2rem] items-center gap-[0.8rem] max-sm:grid-cols-[minmax(0,1fr)_3.4rem_4.6rem_4.2rem] max-sm:gap-[0.45rem]";

const percent = (ratio: number): number => Math.round(ratio * 10000) / 100;

interface TotalsChapterProps {
  state: DemoState;
  kind: DocumentKind;
  totals: DocumentTotals | undefined;
  onChange: (patch: (state: DemoState) => DemoState) => void;
}

export const TotalsChapter = ({ state, kind, totals, onChange }: TotalsChapterProps) => {
  const quantityOnly = isQuantityOnlyDocument(state.type);
  const setItem = (index: number, patch: (item: LineItemInput) => LineItemInput): void =>
    onChange((current) => ({
      ...current,
      items: current.items.map((item, position) => (position === index ? patch(item) : item))
    }));

  return (
    <Chapter name="totals" title="The arithmetic is already done">
      <Lead>
        Line discounts come off first, then document discounts. What is left is the taxable base. TVA is 20% unless you
        pass another rate, and every figure is rounded to the centime. Change a number and read the sheet.
      </Lead>
      <div className="flex flex-col gap-5">
        <div role="group" aria-label="Line items">
          <div className={cx(ROW, LABEL, "border-b-[1.5px] border-ink pb-2 max-sm:text-[0.66rem]")} aria-hidden="true">
            <span>Item</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Unit price</span>
            <span className="text-right">Discount</span>
          </div>
          {state.items.map((item, index) => (
            <div key={item.name} className={cx(ROW, "border-b border-line py-[0.4rem]")}>
              <span className="truncate font-[540] max-sm:text-[0.92rem]">{item.name}</span>
              <NumberField
                label={`${item.name}: quantity`}
                value={item.quantity}
                min={1}
                max={999}
                step={1}
                onChange={(quantity) => setItem(index, (current) => ({ ...current, quantity }))}
              />
              <NumberField
                label={`${item.name}: unit price in dirhams`}
                value={item.unitPrice ?? 0}
                min={0}
                max={99999}
                step={0.5}
                disabled={quantityOnly}
                onChange={(unitPrice) => setItem(index, (current) => ({ ...current, unitPrice }))}
              />
              <NumberField
                label={`${item.name}: line discount in percent`}
                value={percent(item.discountRate ?? 0)}
                min={0}
                max={100}
                step={1}
                suffix="%"
                disabled={quantityOnly}
                onChange={(value) =>
                  setItem(index, ({ discountRate: _discountRate, ...rest }) =>
                    value > 0 ? { ...rest, discountRate: value / 100 } : rest
                  )
                }
              />
            </div>
          ))}
        </div>

        <div className={cx("flex flex-wrap items-end gap-x-10 gap-y-4", quantityOnly && "opacity-45")}>
          <div className="flex flex-col gap-[0.45rem]">
            <span className={LABEL}>Document discount</span>
            <NumberField
              className="w-24"
              label="Document discount in percent"
              value={percent(state.escompte)}
              min={0}
              max={100}
              step={0.5}
              suffix="%"
              disabled={quantityOnly}
              onChange={(value) => onChange((current) => ({ ...current, escompte: value / 100 }))}
            />
          </div>
          <fieldset className="flex min-w-0 flex-col gap-[0.45rem]">
            <legend className={cx(LABEL, "mb-[0.45rem] px-0.5")}>TVA rate</legend>
            <div className="flex">
              {VAT_RATES.map((rate, index) => {
                const checked = rate === state.vatRate;
                return (
                  <label key={rate}>
                    <input
                      className="peer absolute opacity-0"
                      type="radio"
                      name="vat"
                      value={rate}
                      checked={checked}
                      disabled={quantityOnly}
                      onChange={() => onChange((current) => ({ ...current, vatRate: rate }))}
                    />
                    <span
                      className={cx(
                        "block min-w-[3.1rem] cursor-pointer border-[1.5px] border-ink px-[0.6rem] py-[0.4rem] text-center font-mono text-[0.88rem] transition-colors duration-150",
                        "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink",
                        index === 0 ? "rounded-l-sm" : "-ml-[1.5px]",
                        index === VAT_RATES.length - 1 && "rounded-r-sm",
                        checked ? "bg-ink text-lift" : "hover:bg-lift"
                      )}
                    >
                      {Math.round(rate * 100)}%
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </div>
      </div>
      <Code label="Totals returned by toJSON">
        {lines(
          seq(`${VARIABLES[state.type]}.`, fn("toJSON"), "().totals"),
          totals
            ? seq(note("// =>"), " ", literal(totals, 0, 0))
            : note(`// => undefined: a ${kind.title.toLowerCase()} carries no amounts`)
        )}
      </Code>
    </Chapter>
  );
};
