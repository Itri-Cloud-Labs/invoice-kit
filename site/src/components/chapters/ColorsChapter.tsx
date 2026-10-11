import type { DocumentColors } from "@kit/core/types";
import { fn, key, lines, literal, note, seq } from "../../demo/code";
import type { DocumentKind } from "../../demo/document";
import { PALETTES, SLOTS } from "../../demo/options";
import { DEFAULT_COLORS } from "../../demo/sheet";
import { cx } from "../../lib/cx";
import { Chip, Code } from "../ui";
import { Chapter, Lead } from "./Chapter";

interface ColorsChapterProps {
  colors: DocumentColors;
  kind: DocumentKind;
  onColors: (colors: DocumentColors) => void;
}

export const ColorsChapter = ({ colors, kind, onColors }: ColorsChapterProps) => {
  const given = Object.keys(colors).length > 0;
  const paletteIndex = PALETTES.findIndex((palette) => JSON.stringify(palette.colors) === JSON.stringify(colors));

  return (
    <Chapter name="colors" title="Seven colour slots">
      <Lead>
        <Chip>primary</Chip> paints the issuer name, the table header and the total row. Six more slots cover the text
        on top of it, body text, metadata, section labels, borders and the footer. Give hex values for the ones you care
        about; the rest keep their defaults.
      </Lead>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Palette presets">
        {PALETTES.map((palette, index) => {
          const pressed = index === paletteIndex;
          return (
            <button
              key={palette.name}
              type="button"
              aria-pressed={pressed}
              onClick={() => onColors({ ...palette.colors })}
              className={cx(
                "inline-flex cursor-pointer items-center gap-2 rounded-full border-[1.5px] border-ink py-[0.4rem] pr-[0.8rem] pl-[0.45rem] text-[0.9rem] font-[540] transition-colors duration-150",
                pressed ? "bg-ink text-lift" : "hover:bg-lift"
              )}
            >
              <span
                className="size-[1.15rem] rounded-full shadow-[0_0_0_1.5px_#fff]"
                style={{ background: palette.colors.primary ?? DEFAULT_COLORS.primary }}
                aria-hidden="true"
              />
              {palette.name}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-x-6 border-t-[1.5px] border-ink">
        {SLOTS.map(({ slot, hint }) => {
          const value = colors[slot] ?? DEFAULT_COLORS[slot];
          return (
            <label
              key={slot}
              className="grid cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-[0.8rem] border-b border-line py-2"
            >
              <input
                className="swatch size-8 cursor-pointer rounded-sm border-[1.5px] border-ink bg-transparent p-0"
                type="color"
                value={value}
                onChange={(event) => {
                  const next = event.target.value;
                  if (next === DEFAULT_COLORS[slot]) {
                    const { [slot]: _removed, ...rest } = colors;
                    onColors(rest);
                  } else {
                    onColors({ ...colors, [slot]: next });
                  }
                }}
              />
              <span className="flex min-w-0 flex-col leading-[1.3]">
                <code className="text-[0.84rem]">{slot}</code>
                <span className="text-[0.8rem] text-ink-soft">{hint}</span>
              </span>
              <output className="font-mono text-[0.8rem]">{value}</output>
            </label>
          );
        })}
      </div>
      <Code label="Colors option">
        {lines(
          seq(fn(kind.factory), "({"),
          given
            ? lines(seq("  ", note("// ...")), seq("  ", key("colors"), ": ", literal(colors, 2, 30)))
            : seq("  ", note("// No colors given: the default palette applies.")),
          "});"
        )}
      </Code>
    </Chapter>
  );
};
