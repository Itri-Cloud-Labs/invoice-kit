import { isQuantityOnlyDocument } from "@kit/core/document-kinds";
import type { DocumentType } from "@kit/core/types";
import { fn, kw, lines, seq, str } from "../../demo/code";
import { KINDS, type DocumentKind } from "../../demo/document";
import { PACKAGE, STOCK, VARIABLES } from "../../demo/options";
import { cx } from "../../lib/cx";
import { Code, TEXTLINK } from "../ui";
import { Chapter, Lead } from "./Chapter";

interface TypesChapterProps {
  kind: DocumentKind;
  onType: (type: DocumentType) => void;
}

export const TypesChapter = ({ kind, onType }: TypesChapterProps) => {
  const variable = VARIABLES[kind.type];
  return (
    <Chapter name="types" title="One input, six documents">
      <Lead>
        Six factories share one input shape. Invoices, quotes and purchase orders carry prices and totals. Delivery
        notes, return notes and price requests take the same items and print quantities only: no unit price, no TVA, no
        bank details.
      </Lead>
      {/* A ruled list, like the options on a printed form. */}
      <fieldset className="min-w-0 border-t-[1.5px] border-ink">
        <legend className="sr-only">Document type</legend>
        {KINDS.map((entry) => {
          const selected = entry.type === kind.type;
          return (
            <label
              key={entry.type}
              className={cx(
                "grid cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-x-[0.9rem] gap-y-[0.2rem] border-b border-line py-[0.62rem] pr-[0.6rem] pl-[0.35rem] transition-colors duration-200 max-sm:grid-cols-[auto_1fr]",
                "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink",
                selected ? "bg-lift" : "hover:bg-lift/55"
              )}
            >
              <input
                className="absolute opacity-0"
                type="radio"
                name="kind"
                value={entry.type}
                checked={selected}
                onChange={() => onType(entry.type)}
              />
              <span
                className={cx(
                  "size-[1.05rem] rounded-full border-[1.5px] border-ink transition-shadow duration-200",
                  selected && "shadow-[inset_0_0_0_0.28rem_var(--color-ink)]",
                  STOCK[entry.slug]
                )}
                aria-hidden="true"
              />
              <span className="font-display text-[1.12rem] leading-tight font-[640]">{entry.title}</span>
              <span className="flex flex-wrap items-baseline justify-end gap-x-[0.8rem] gap-y-[0.1rem] text-right text-[0.82rem] text-ink-soft max-sm:col-start-2 max-sm:justify-start max-sm:text-left">
                <code className="text-[0.78rem] text-ink">{entry.factory}</code>
                {isQuantityOnlyDocument(entry.type) ? "Quantities only" : "Prices and totals"}
              </span>
            </label>
          );
        })}
      </fieldset>
      <Code label="Code for the selected document">
        {lines(
          seq(kw("import"), " { ", fn(kind.factory), " } ", kw("from"), " ", str(PACKAGE), ";"),
          "",
          seq(kw("const"), ` ${variable} = `, fn(kind.factory), "(input);"),
          seq(kw("await"), ` ${variable}.`, fn("toPDF"), "(", str(`./${kind.file}.pdf`), ");")
        )}
      </Code>
      <p className="flex flex-col gap-1 text-[0.95rem]">
        <a className={TEXTLINK} href={`${import.meta.env.BASE_URL}samples/${kind.file}.pdf`} download>
          Download the sample {kind.title} as a PDF
        </a>
        <span className="text-[0.88rem] text-ink-soft">
          The file comes from the library itself, built from the same sample input.
        </span>
      </p>
    </Chapter>
  );
};
