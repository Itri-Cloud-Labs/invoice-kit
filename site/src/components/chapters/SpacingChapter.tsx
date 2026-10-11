import { isQuantityOnlyDocument } from "@kit/core/document-kinds";
import type { DocumentType, PdfSpacingOptions } from "@kit/core/types";
import { fn, key, kw, lines, literal, note, seq, str } from "../../demo/code";
import type { DocumentKind } from "../../demo/document";
import { GAPS, VARIABLES, type GapName } from "../../demo/options";
import { spacingDefaults } from "../../demo/sheet";
import { cx } from "../../lib/cx";
import { Code } from "../ui";
import { Chapter, Lead } from "./Chapter";

interface SpacingChapterProps {
  type: DocumentType;
  kind: DocumentKind;
  spacing: PdfSpacingOptions;
  activeGap: GapName;
  onActiveGap: (gap: GapName) => void;
  onSpacing: (spacing: PdfSpacingOptions) => void;
  onReset: () => void;
}

export const SpacingChapter = ({ type, kind, spacing, activeGap, onActiveGap, onSpacing, onReset }: SpacingChapterProps) => {
  const defaults = spacingDefaults(isQuantityOnlyDocument(type));
  const overridden = Object.keys(spacing).length > 0;

  return (
    <Chapter name="spacing" title="Every gap, in points">
      <Lead>
        The roomy layout is the default. Eighteen spacing values can be overridden per render, in PDF points, 72 to the
        inch. Six of them are wired up here. In the real renderer, pushing them far enough moves sections onto a new
        page.
      </Lead>
      <div className="flex flex-col border-t-[1.5px] border-ink">
        {GAPS.map((gap) => {
          const value = spacing[gap.name] ?? defaults[gap.name];
          const active = gap.name === activeGap;
          return (
            <label
              key={gap.name}
              onPointerEnter={() => onActiveGap(gap.name)}
              className={cx(
                "grid grid-cols-[minmax(0,1.15fr)_minmax(6rem,1fr)_3.4rem] items-center gap-4 border-b border-line py-[0.55rem] pr-2 pl-[0.35rem] transition-colors duration-200 max-sm:grid-cols-[minmax(0,1fr)_3.4rem] max-sm:gap-y-[0.1rem]",
                active && "bg-lift"
              )}
            >
              <span className="flex min-w-0 flex-col leading-[1.3]">
                <code className="text-[0.84rem]">{gap.name}</code>
                <span className="text-[0.8rem] text-ink-soft">{gap.label}</span>
              </span>
              <input
                className="range max-sm:col-span-full max-sm:row-start-2"
                type="range"
                min={gap.min}
                max={gap.max}
                step={1}
                value={value}
                data-active={active || undefined}
                onFocus={() => onActiveGap(gap.name)}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  onActiveGap(gap.name);
                  if (next === defaults[gap.name]) {
                    const { [gap.name]: _removed, ...rest } = spacing;
                    onSpacing(rest);
                  } else {
                    onSpacing({ ...spacing, [gap.name]: next });
                  }
                }}
              />
              <output className="text-right font-mono text-[0.8rem]">{value} pt</output>
            </label>
          );
        })}
        <button
          type="button"
          onClick={onReset}
          className="mt-[0.9rem] cursor-pointer self-start text-[0.9rem] font-[560] underline decoration-[1.5px] underline-offset-[0.22em] hover:decoration-[3px]"
        >
          Reset to the default layout
        </button>
      </div>
      <Code label="Spacing option">
        {lines(
          seq(kw("await"), ` ${VARIABLES[type]}.`, fn("toPDF"), "({"),
          seq("  ", key("outputPath"), ": ", str(`./${kind.file}.pdf`), overridden ? "," : ""),
          overridden
            ? seq("  ", key("spacing"), ": ", literal(spacing, 2, 30))
            : seq("  ", note("// spacing omitted: defaults apply")),
          "});"
        )}
      </Code>
    </Chapter>
  );
};
