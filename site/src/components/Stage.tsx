import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { isQuantityOnlyDocument } from "@kit/core/document-kinds";
import type { BusinessDocumentData, DocumentType, PdfSpacingOptions } from "@kit/core/types";
import { KINDS, type DocumentKind } from "../demo/document";
import { animateSwap, measure, type Box } from "../demo/flip";
import { LOGO, STOCK, type Chapter, type GapName } from "../demo/options";
import { PAGE, spacingDefaults } from "../demo/sheet";
import { cx } from "../lib/cx";
import { Sheet } from "./Sheet";
import { CAMERA, FRAME } from "./ui";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const FULL_PAGE: Rect = { x: 0, y: 0, w: PAGE.width, h: PAGE.height };

const rectOf = (page: HTMLElement, name: string): Rect | null => {
  const node = page.querySelector<HTMLElement>(`[data-key="${name}"]`);
  if (!node) return null;
  const origin = page.getBoundingClientRect();
  const scale = origin.width / page.offsetWidth || 1;
  const rect = node.getBoundingClientRect();
  return {
    x: (rect.left - origin.left) / scale,
    y: (rect.top - origin.top) / scale,
    w: rect.width / scale,
    h: rect.height / scale
  };
};

// Fits the page, or one region of it, into the holder.
export const applyCamera = (target: HTMLElement, holder: HTMLElement, focus: Rect = FULL_PAGE): void => {
  const width = holder.clientWidth;
  const height = holder.clientHeight;
  if (width === 0 || height === 0) return;
  const scale = Math.min(width / focus.w, height / focus.h);
  const x = (width - focus.w * scale) / 2 - focus.x * scale;
  const y = (height - focus.h * scale) / 2 - focus.y * scale;
  target.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${scale.toFixed(4)})`;
};

// On a wide screen the whole page shows. On a narrow one the window follows the chapter.
const focusFor = (page: HTMLElement, chapter: Chapter, aspect: number, wide: boolean): Rect => {
  if (wide || chapter === "modules") return FULL_PAGE;

  const band = (top: number): Rect => {
    const h = Math.min(PAGE.height, PAGE.width * aspect);
    return { x: 0, y: Math.max(0, Math.min(top, PAGE.height - h)), w: PAGE.width, h };
  };

  if (chapter === "totals") {
    const totals = rectOf(page, "totals");
    if (totals) {
      const w = 290;
      const h = w * aspect;
      return { x: PAGE.width - w - 16, y: Math.max(0, totals.y + totals.h + 18 - h), w, h };
    }
  }
  if (chapter === "spacing") {
    const header = rectOf(page, "header");
    return band(header ? header.y + header.h - 24 : 0);
  }
  return band(0);
};

// The strip of the page that one spacing value controls.
const gapRect = (page: HTMLElement, gap: GapName): Rect | null => {
  const between = (above: string, below: string): Rect | null => {
    const a = rectOf(page, above);
    const b = rectOf(page, below);
    if (!a || !b) return null;
    return { x: PAGE.margin, y: a.y + a.h, w: PAGE.width - PAGE.margin * 2, h: b.y - (a.y + a.h) };
  };

  switch (gap) {
    case "headerToParties":
      return between("header", "parties");
    case "partiesToTable":
      return between("parties", "table");
    case "tableHeaderHeight":
      return rectOf(page, "thead");
    case "tableRowMinHeight":
      return rectOf(page, "row-0");
    case "tableToSummary":
      return between("table", "trailing");
    case "summaryRowHeight":
      return rectOf(page, "total-0");
    default:
      return null;
  }
};

interface StageProps {
  data: BusinessDocumentData;
  kind: DocumentKind;
  spacing: PdfSpacingOptions;
  chapter: Chapter;
  activeGap: GapName;
  wide: boolean;
  // Bumped by changes that should carry the page's blocks across instead of cutting.
  flip: number;
  onType: (type: DocumentType) => void;
}

export const Stage = ({ data, kind, spacing, chapter, activeGap, wide, flip, onType }: StageProps) => {
  const frame = useRef<HTMLDivElement>(null);
  const camera = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const ghosts = useRef<HTMLDivElement>(null);
  const mark = useRef<HTMLDivElement>(null);
  const boxes = useRef<Map<string, Box> | null>(null);
  const lastFlip = useRef(flip);
  const [ready, setReady] = useState(false);

  // Layout is read back from the DOM, so the camera and the gap mark are placed by hand.
  const place = (): void => {
    if (!frame.current || !camera.current || !page.current || !mark.current) return;
    const aspect = frame.current.clientHeight / Math.max(1, frame.current.clientWidth);
    applyCamera(camera.current, frame.current, focusFor(page.current, chapter, aspect, wide));

    const rect = chapter === "spacing" ? gapRect(page.current, activeGap) : null;
    const shown = rect !== null && rect.h >= 0;
    mark.current.hidden = !shown;
    if (shown) {
      mark.current.style.left = `${rect.x}px`;
      mark.current.style.top = `${rect.y}px`;
      mark.current.style.width = `${rect.w}px`;
      mark.current.style.height = `${Math.max(rect.h, 0.75)}px`;
    }
  };
  const latestPlace = useRef(place);

  useLayoutEffect(() => {
    latestPlace.current = place;
    if (!page.current || !ghosts.current) return;
    const after = measure(page.current);
    place();
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (flip !== lastFlip.current && boxes.current && !still) animateSwap(ghosts.current, boxes.current, after);
    lastFlip.current = flip;
    boxes.current = after;
  });

  useEffect(() => {
    if (!frame.current) return;
    const observer = new ResizeObserver(() => latestPlace.current());
    observer.observe(frame.current);
    // The camera only starts gliding once its first position is on screen.
    setReady(true);
    return () => observer.disconnect();
  }, []);

  const gapValue = spacing[activeGap] ?? spacingDefaults(isQuantityOnlyDocument(data.type))[activeGap];

  return (
    <aside
      className={cx(
        "sticky top-0 z-10 col-start-2 row-span-2 row-start-1 flex h-svh flex-col justify-center-safe gap-[0.9rem] self-start",
        "max-wide:col-start-1 max-wide:row-start-2 max-wide:row-end-4 max-wide:-mx-gutter max-wide:h-[44svh] max-wide:border-y-[1.5px] max-wide:border-ink max-wide:bg-well"
      )}
      aria-label="Live document preview"
    >
      <div className="flex items-start max-wide:size-full">
        <div
          ref={frame}
          className={cx(
            FRAME,
            "h-[min(100svh_-_8.5rem,58rem)] wide:motion-safe:animate-feed",
            "max-wide:aspect-auto max-wide:size-full max-wide:overflow-hidden max-wide:bg-transparent max-wide:shadow-none"
          )}
        >
          <div ref={camera} className={cx(CAMERA, ready && "transition-transform duration-[800ms] ease-out")}>
            <div
              role="img"
              aria-label={`Preview of the ${kind.english.toLowerCase()} (${kind.title}) PDF that invoice-kit generates for the current settings`}
            >
              <Sheet ref={page} ghostsRef={ghosts} data={data} spacing={spacing} logoSrc={LOGO} />
            </div>
            <div className="pointer-events-none absolute inset-0" aria-hidden="true">
              <div ref={mark} hidden className="absolute bg-signal/22 shadow-[0_0_0_0.75px_var(--color-signal)]">
                <span className="absolute top-1/2 left-[calc(100%+5px)] -translate-y-1/2 rounded-xs bg-signal px-[3px] py-px font-sans text-[8.5px] leading-[1.3] font-[650] whitespace-nowrap text-white">
                  {gapValue} pt
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Divider tabs down the edge of the sheet, one stock colour per document. */}
        <div
          className="flex flex-col gap-[3px] pt-7 max-wide:hidden wide:motion-safe:animate-rise-late short:gap-0.5 short:pt-[0.6rem]"
          role="group"
          aria-label="Document type"
        >
          {KINDS.map((entry) => (
            <button
              key={entry.type}
              type="button"
              aria-pressed={entry.type === data.type}
              onClick={() => onType(entry.type)}
              className={cx(
                "cursor-pointer rounded-r-[5px] border border-l-0 pt-[0.85rem] pb-[0.85rem] pl-2 text-[0.72rem] leading-[1.2] font-[650] font-stretch-[84%] tracking-[0.05em] whitespace-nowrap uppercase [writing-mode:vertical-rl]",
                "[transition:padding_0.25s_var(--ease-out),background-color_0.25s]",
                // Physical sides throughout: in vertical writing mode px-* and py-* swap axes.
                "short:pl-[0.4rem] short:tracking-normal short:normal-case short:font-stretch-[78%]",
                entry.type === data.type
                  ? "border-ink/16 bg-white pr-[0.72rem]"
                  : cx("border-line pr-[0.42rem] hover:pr-[0.72rem] short:pr-[0.4rem] short:hover:pr-[0.72rem]", STOCK[entry.slug])
              )}
            >
              <span>{entry.title}</span>
            </button>
          ))}
        </div>
      </div>
      <p className="max-w-[34rem] pr-10 text-[0.82rem] leading-[1.4] text-ink-soft max-wide:hidden">
        <code className="mr-[0.35em] text-[0.78rem] text-ink">{kind.factory}()</code> {kind.title}, A4. Previewed in HTML
        at the PDF renderer's measurements.
      </p>
    </aside>
  );
};
