import { readFileSync } from "node:fs";
import type { PdfFontSource } from "../core/types.js";
import bidiFactory from "../vendor/bidi.cjs";
import bundledFontBase64 from "../vendor/dejavu-fonts.cjs";

export type TextDirection = "ltr" | "rtl";
export type PdfFontPair = { regular: PdfFontSource; bold: PdfFontSource };

type TextAlign = "left" | "right" | "center";
type TextBlockOptions = { width?: number | undefined; align?: string | undefined; lineGap?: number | undefined };

interface Piece {
  text: string;
  width: number;
  font: string;
}

interface Line {
  pieces: Piece[];
  width: number;
}

interface TextState {
  direction: TextDirection;
  font: string;
  bold: boolean;
  registered: Map<PdfFontSource, string>;
  pieces: Map<string, Piece>;
}

// pdfkit does not expose the active font, but shaping decisions depend on it.
interface ActiveFont {
  ascender: number;
  font?: {
    layout?: (text: string) => { direction?: string };
    hasGlyphForCodePoint?: (codePoint: number) => boolean;
  };
}

const STANDARD_PDF_FONTS = new Set([
  "Courier",
  "Courier-Bold",
  "Courier-Oblique",
  "Courier-BoldOblique",
  "Helvetica",
  "Helvetica-Bold",
  "Helvetica-Oblique",
  "Helvetica-BoldOblique",
  "Times-Roman",
  "Times-Bold",
  "Times-Italic",
  "Times-BoldItalic",
  "Symbol",
  "ZapfDingbats"
]);

const RTL_CHARACTERS = /[֐-ࣿיִ-﷿ﹰ-ﻼ]/;
const BIDI_CONTROLS = /[‎‏‪-‮⁦-⁩]/g;
const FIRST_STRONG_ISOLATE = "⁨";
const POP_DIRECTIONAL_ISOLATE = "⁩";
const FALLBACK_FONT_NAMES = { regular: "InvoiceKit-Fallback", bold: "InvoiceKit-Fallback-Bold" };

const bidi = bidiFactory();
const states = new WeakMap<PDFKit.PDFDocument, TextState>();

let bundledArabicFonts: PdfFontPair | undefined;

export const resolveBundledArabicFonts = (): PdfFontPair => {
  bundledArabicFonts ??= {
    regular: Buffer.from(bundledFontBase64.regular, "base64"),
    bold: Buffer.from(bundledFontBase64.bold, "base64")
  };

  return bundledArabicFonts;
};

const getState = (doc: PDFKit.PDFDocument): TextState => {
  let state = states.get(doc);

  if (!state) {
    state = { direction: "ltr", font: "Helvetica", bold: false, registered: new Map(), pieces: new Map() };
    states.set(doc, state);
  }

  return state;
};

const activeFont = (doc: PDFKit.PDFDocument): ActiveFont => (doc as unknown as { _font: ActiveFont })._font;

export const hasRtlText = (text: string): boolean => RTL_CHARACTERS.test(text);

const stripBidiControls = (text: string): string => text.replace(BIDI_CONTROLS, "");

// Wraps a value so its direction comes from its own first strong character and its
// content cannot reorder against the surrounding text. Without this, digit groups such
// as a RIB or a phone number swap places inside a right-to-left line.
export const isolate = (value: string): string =>
  value
    .split("\n")
    .map((line) => (line.length > 0 ? `${FIRST_STRONG_ISOLATE}${line}${POP_DIRECTIONAL_ISOLATE}` : line))
    .join("\n");

export const formatLabelValue = (label: string, value: string): string => isolate(`${label}: ${isolate(value)}`);

export const setTextDirection = (doc: PDFKit.PDFDocument, direction: TextDirection): void => {
  getState(doc).direction = direction;
};

export const useFont = (doc: PDFKit.PDFDocument, fontSource: PdfFontSource | undefined, fallback: "Helvetica" | "Helvetica-Bold"): void => {
  const state = getState(doc);
  let name: string;

  if (!fontSource) {
    name = fallback;
  } else if (typeof fontSource === "string" && STANDARD_PDF_FONTS.has(fontSource)) {
    name = fontSource;
  } else {
    let registeredName = state.registered.get(fontSource);

    if (!registeredName) {
      registeredName = `InvoiceKit-Font-${state.registered.size + 1}`;
      doc.registerFont(registeredName, (typeof fontSource === "string" ? readFileSync(fontSource) : fontSource) as Buffer);
      state.registered.set(fontSource, registeredName);
    }

    name = registeredName;
  }

  doc.font(name);
  state.font = name;
  state.bold = fallback === "Helvetica-Bold";
};

const useFallbackFont = (doc: PDFKit.PDFDocument, state: TextState): string => {
  const weight = state.bold ? "bold" : "regular";
  const name = FALLBACK_FONT_NAMES[weight];
  const source = resolveBundledArabicFonts()[weight];

  if (!state.registered.has(source)) {
    doc.registerFont(name, source as Buffer);
    state.registered.set(source, name);
  }

  doc.font(name);
  return name;
};

const reverseCharacters = (text: string): string => Array.from(text).reverse().join("");

// Shapes one directional run. The run is handed to the font engine as a whole so Arabic
// letters join across spaces, and the engine's own direction guess is corrected when it
// disagrees with the bidi algorithm (digits, punctuation, or fonts without shaping).
const shapePiece = (doc: PDFKit.PDFDocument, state: TextState, logicalText: string, rtl: boolean): Piece => {
  const key = `${state.font}|${(doc as unknown as { _fontSize: number })._fontSize}|${rtl ? "r" : "l"}|${logicalText}`;
  const cached = state.pieces.get(key);

  if (cached) {
    return cached;
  }

  let font = state.font;
  const rtlCharacter = RTL_CHARACTERS.exec(logicalText)?.[0];

  if (rtlCharacter && activeFont(doc).font?.hasGlyphForCodePoint?.(rtlCharacter.codePointAt(0) ?? 0) !== true) {
    font = useFallbackFont(doc, state);
  }

  const engineDirection = activeFont(doc).font?.layout?.(logicalText).direction ?? "ltr";
  const text = (engineDirection === "rtl") === rtl ? logicalText : reverseCharacters(logicalText);
  const piece: Piece = { text, font, width: doc.widthOfString(text, { features: [] }) };

  if (font !== state.font) {
    doc.font(state.font);
  }

  state.pieces.set(key, piece);
  return piece;
};

// Builds the visual (left-to-right) pieces for the characters [start, end) of a paragraph.
const buildLine = (
  doc: PDFKit.PDFDocument,
  state: TextState,
  text: string,
  embedding: bidiFactory.EmbeddingLevels,
  mirrored: Map<number, string>,
  start: number,
  end: number
): Line => {
  const pieces: Piece[] = [];
  let run: { first: number; last: number; rtl: boolean } | undefined;

  const flush = (): void => {
    if (run) {
      const from = Math.min(run.first, run.last);
      const to = Math.max(run.first, run.last);
      pieces.push(shapePiece(doc, state, text.slice(from, to + 1), run.rtl));
      run = undefined;
    }
  };

  if (end > start) {
    // bidi-js returns indices for the whole string; only [start, end) is reordered.
    for (const index of bidi.getReorderedIndices(text, embedding, start, end - 1).slice(start, end)) {
      const character = text.charAt(index);

      if (stripBidiControls(character).length === 0) {
        continue;
      }

      const rtl = ((embedding.levels[index] ?? 0) & 1) === 1;
      const mirror = mirrored.get(index);

      if (mirror !== undefined) {
        flush();
        pieces.push(shapePiece(doc, state, mirror, false));
      } else if (run && run.rtl === rtl && index === run.last + (rtl ? -1 : 1)) {
        run.last = index;
      } else {
        flush();
        run = { first: index, last: index, rtl };
      }
    }

    flush();
  }

  return { pieces, width: pieces.reduce((total, piece) => total + piece.width, 0) };
};

const layoutParagraph = (doc: PDFKit.PDFDocument, state: TextState, text: string, width: number | undefined): Line[] => {
  const embedding = bidi.getEmbeddingLevels(text, state.direction);
  const mirrored = bidi.getMirroredCharactersMap(text, embedding.levels);
  const build = (start: number, end: number): Line => buildLine(doc, state, text, embedding, mirrored, start, end);

  if (width === undefined) {
    return [build(0, text.length)];
  }

  const lines: Line[] = [];
  const words = Array.from(text.matchAll(/\S+/g), (match) => {
    const start = match.index ?? 0;
    return { start, end: start + match[0].length };
  });
  let lineStart: number | undefined;
  let current: Line | undefined;

  for (const word of words) {
    if (lineStart !== undefined && current) {
      const candidate = build(lineStart, word.end);

      if (candidate.width <= width) {
        current = candidate;
        continue;
      }

      lines.push(current);
    }

    lineStart = word.start;
    current = build(lineStart, word.end);
  }

  lines.push(current ?? { pieces: [], width: 0 });
  return lines;
};

const layoutText = (doc: PDFKit.PDFDocument, text: string, width: number | undefined): Line[] => {
  const state = getState(doc);
  return text.split("\n").flatMap((paragraph) => layoutParagraph(doc, state, paragraph, width));
};

// The visual left-to-right pieces of each line, exposed so tests can assert on ordering.
export const layoutVisualLines = (doc: PDFKit.PDFDocument, text: string, width?: number): string[][] =>
  layoutText(doc, text, width).map((line) => line.pieces.map((piece) => piece.text));

const lineHeightOf = (doc: PDFKit.PDFDocument, options: TextBlockOptions): number =>
  doc.currentLineHeight(true) + (options.lineGap ?? 0);

export const measureTextWidth = (doc: PDFKit.PDFDocument, text: string): number => {
  if (!hasRtlText(text)) {
    return doc.widthOfString(stripBidiControls(text));
  }

  return Math.max(...layoutText(doc, text, undefined).map((line) => line.width));
};

export const measureTextHeight = (doc: PDFKit.PDFDocument, text: string, options: TextBlockOptions): number => {
  if (!hasRtlText(text)) {
    return doc.heightOfString(stripBidiControls(text), options as PDFKit.Mixins.TextOptions);
  }

  return layoutText(doc, text, options.width).length * lineHeightOf(doc, options);
};

// Draws a text block at a fixed position without moving the document cursor and returns
// the y coordinate just below it. Text without right-to-left characters goes straight to
// pdfkit; anything else is reordered and shaped line by line first.
export const drawText = (
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  options: PDFKit.Mixins.TextOptions
): number => {
  const previousX = doc.x;
  const previousY = doc.y;
  let bottomY: number;

  if (!hasRtlText(text)) {
    const plainText = stripBidiControls(text);
    doc.text(plainText, x, y, options);
    bottomY = y + doc.heightOfString(plainText, options);
  } else {
    const state = getState(doc);
    const lines = layoutText(doc, text, options.width);
    const lineHeight = lineHeightOf(doc, options);
    const baselineOffset = (activeFont(doc).ascender / 1000) * (doc as unknown as { _fontSize: number })._fontSize;
    const align = (options.align ?? "left") as TextAlign;

    lines.forEach((line, lineIndex) => {
      const freeWidth = (options.width ?? line.width) - line.width;
      let pieceX = x + (align === "right" ? freeWidth : align === "center" ? freeWidth / 2 : 0);

      for (const piece of line.pieces) {
        doc.font(piece.font);
        doc.text(piece.text, pieceX, y + lineIndex * lineHeight + baselineOffset, {
          lineBreak: false,
          baseline: "alphabetic",
          features: []
        });
        pieceX += piece.width;
      }
    });

    doc.font(state.font);
    bottomY = y + lines.length * lineHeight;
  }

  doc.x = previousX;
  doc.y = previousY;

  return bottomY;
};
