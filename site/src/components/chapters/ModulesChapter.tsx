import { isQuantityOnlyDocument } from "@kit/core/document-kinds";
import type { DocumentInput } from "@kit/core/types";
import type { ReactNode } from "react";
import { fn, join, key, lines, literal, note, seq } from "../../demo/code";
import { MODULES, type DemoState, type DocumentKind, type ModuleKey } from "../../demo/document";
import { FINANCIAL_ONLY, MODULE_LABELS } from "../../demo/options";
import { cx } from "../../lib/cx";
import { Code } from "../ui";
import { Chapter, Lead } from "./Chapter";

// Long values are shortened to their first entry so the sample stays readable.
const summary = (name: string, value: unknown): ReactNode => {
  if (name === "items" && Array.isArray(value)) return seq("[", note(`/* ${value.length} items */`), "]");
  if (typeof value === "object" && value !== null && !(value instanceof Date) && !Array.isArray(value)) {
    const [firstKey, firstValue] = Object.entries(value)[0] ?? [];
    const rest = Object.keys(value).length - 1;
    if (firstKey && rest > 0) {
      return seq("{ ", key(firstKey), ": ", literal(firstValue), ", ", note(`/* ${rest} more */`), " }");
    }
  }
  return literal(value, 2, 200);
};

interface ModulesChapterProps {
  state: DemoState;
  kind: DocumentKind;
  input: DocumentInput;
  onToggle: (name: ModuleKey, on: boolean) => void;
}

export const ModulesChapter = ({ state, kind, input, onToggle }: ModulesChapterProps) => {
  const quantityOnly = isQuantityOnlyDocument(state.type);
  const fields = Object.entries(input).filter(([name]) => name !== "colors");

  return (
    <Chapter name="modules" title="Leave a field out and it leaves the page">
      <Lead>
        Every top-level field is optional. The library prints what you give it and closes the gap around what you
        don't: no placeholder client, no empty bank box. Skip the footer and the title and number take its place on the
        bottom edge.
      </Lead>
      <fieldset className="grid min-w-0 grid-cols-[repeat(auto-fill,minmax(9.75rem,1fr))] gap-x-5 gap-y-[0.15rem] border-y-[1.5px] border-ink py-[0.6rem]">
        <legend className="sr-only">Fields passed to the factory</legend>
        {MODULES.map((name) => {
          const unavailable =
            (quantityOnly && FINANCIAL_ONLY.has(name)) ||
            (name === "logo" && !state.modules.issuer) ||
            (name === "title" && state.type === "priceRequest");
          return (
            <label
              key={name}
              className={cx(
                "flex items-center gap-[0.65rem] py-[0.42rem] text-[0.86rem]",
                unavailable ? "cursor-not-allowed text-ink-soft" : "cursor-pointer"
              )}
            >
              <input
                className="peer absolute opacity-0"
                type="checkbox"
                checked={state.modules[name]}
                disabled={unavailable}
                onChange={(event) => onToggle(name, event.target.checked)}
              />
              <span
                className={cx(
                  "relative size-[1.1rem] flex-none rounded-xs border-[1.5px] border-ink bg-lift transition-colors duration-150 peer-checked:bg-ink",
                  "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink",
                  "after:absolute after:top-[0.12rem] after:right-[0.3rem] after:bottom-[0.26rem] after:left-[0.3rem] after:scale-50 after:rotate-[42deg] after:border-r-2 after:border-b-2 after:border-lift after:opacity-0 after:[transition:opacity_0.15s,scale_0.25s_var(--ease-out)] after:content-['']",
                  "peer-checked:after:scale-100 peer-checked:after:opacity-100",
                  unavailable && "opacity-40"
                )}
                aria-hidden="true"
              />
              <code className={cx(unavailable && "line-through")}>{MODULE_LABELS[name]}</code>
            </label>
          );
        })}
      </fieldset>
      <Code label="Input object for the selected fields">
        {fields.length > 0
          ? lines(
              seq(fn(kind.factory), "({"),
              join(fields.map(([name, value]) => seq("  ", key(name), ": ", summary(name, value))), ",\n"),
              "});"
            )
          : lines(seq(fn(kind.factory), "({});"), note("// Valid. It renders a blank A4 page."))}
      </Code>
    </Chapter>
  );
};
