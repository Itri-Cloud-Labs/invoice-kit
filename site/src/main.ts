import "@fontsource-variable/besley/wght.css";
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource/fragment-mono/latin-400.css";
import "./styles/site.css";
import "./styles/sheet.css";

import { isQuantityOnlyDocument } from "@kit/core/document-kinds";
import type { DocumentColors, DocumentType, PdfSpacingOptions } from "@kit/core/types";
import { validateDocumentInput } from "@kit/core/validation";
import kitPackage from "../../packages/typescript/package.json";
import { fn, key, kw, literal, note, plain, str } from "./demo/code";
import {
  KINDS,
  MODULES,
  buildInput,
  createDocumentData,
  createInitialState,
  kindOf,
  type DemoState,
  type ModuleKey
} from "./demo/document";
import { swapPage } from "./demo/flip";
import * as sample from "./demo/sample-data.js";
import { DEFAULT_COLORS, PAGE, renderSheet, spacingDefaults } from "./demo/sheet";

const PACKAGE = "@ic-labs/invoice-kit";
const LOGO = `${import.meta.env.BASE_URL}demo-logo.svg`;

const $ = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node as T;
};

const html = (markup: string): HTMLElement => {
  const template = document.createElement("template");
  template.innerHTML = markup.trim();
  return template.content.firstElementChild as HTMLElement;
};

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const wide = window.matchMedia("(min-width: 68.75rem)");

type Chapter = "hero" | "types" | "totals" | "modules" | "colors" | "spacing";

const state: DemoState = createInitialState();
let chapter: Chapter = "hero";
let activeGap: keyof PdfSpacingOptions = "headerToParties";

const sheetHost = $("sheet");
const frame = $("frame");
const camera = $("camera");
const dims = $("dims");

/* ---------- Static option tables ---------- */

const VARIABLES: Record<DocumentType, string> = {
  invoice: "facture",
  quote: "devis",
  purchaseOrder: "commande",
  deliveryNote: "livraison",
  returnNote: "retour",
  priceRequest: "demande"
};

const MODULE_LABELS: Record<ModuleKey, string> = {
  title: "title",
  number: "number",
  issueDate: "issueDate",
  dueDate: "dueDate",
  issuer: "issuer",
  logo: "issuer.logo",
  seller: "seller",
  client: "client",
  items: "items",
  discounts: "discounts",
  paymentTerms: "paymentTerms",
  bankInfo: "bankInfo",
  notes: "notes",
  footer: "footer"
};

const FINANCIAL_ONLY: ReadonlySet<ModuleKey> = new Set(["dueDate", "discounts", "paymentTerms", "bankInfo"]);

const PALETTES: ReadonlyArray<{ name: string; colors: DocumentColors }> = [
  { name: "Default navy", colors: {} },
  { name: "Terracotta", colors: { primary: "#9f3d1b", mutedText: "#8a5a47", border: "#e7cfc4", footerText: "#b08e80" } },
  { name: "Cedar", colors: { primary: "#1f5a43", mutedText: "#4f7566", border: "#cfe0d8", footerText: "#8aa69a" } },
  { name: "Plum", colors: { primary: "#6b2456", mutedText: "#84607a", border: "#e3d0dd", footerText: "#a98fa2" } },
  { name: "Graphite", colors: { primary: "#111827", mutedText: "#4b5563", border: "#9ca3af", footerText: "#6b7280" } }
];

const SLOTS: ReadonlyArray<{ slot: keyof DocumentColors; hint: string }> = [
  { slot: "primary", hint: "Accent" },
  { slot: "onPrimary", hint: "Text on accent" },
  { slot: "text", hint: "Body text" },
  { slot: "metaText", hint: "Number and dates" },
  { slot: "mutedText", hint: "Section labels" },
  { slot: "border", hint: "Table lines" },
  { slot: "footerText", hint: "Footer" }
];

const GAPS: ReadonlyArray<{ name: keyof PdfSpacingOptions; label: string; min: number; max: number }> = [
  { name: "headerToParties", label: "Header to seller and client", min: 0, max: 72 },
  { name: "partiesToTable", label: "Seller and client to table", min: 0, max: 72 },
  { name: "tableHeaderHeight", label: "Table header height", min: 22, max: 48 },
  { name: "tableRowMinHeight", label: "Minimum row height", min: 30, max: 56 },
  { name: "tableToSummary", label: "Table to totals", min: 0, max: 72 },
  { name: "summaryRowHeight", label: "Totals row height", min: 26, max: 40 }
];

const VAT_RATES = [0, 0.07, 0.1, 0.14, 0.2];

/* ---------- Rendering the sheet ---------- */

const currentData = () => createDocumentData(state.type, buildInput(state));

const render = (animate = false): void => {
  const data = currentData();
  const page = renderSheet(data, { spacing: state.spacing, logoSrc: LOGO });
  swapPage(sheetHost, page, animate && !reducedMotion.matches);

  const kind = kindOf(state.type);
  document.documentElement.dataset.kind = kind.slug;
  sheetHost.setAttribute(
    "aria-label",
    `Preview of the ${kind.english.toLowerCase()} (${kind.title}) PDF that invoice-kit generates for the current settings`
  );

  syncControls();
  renderCode(data);
  drawGap();
  frameCamera();
};

/* ---------- Camera: fits the page, or one region of it, into the frame ---------- */

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const pageRectOf = (name: string): Rect | null => {
  const page = sheetHost.firstElementChild as HTMLElement | null;
  const node = page?.querySelector<HTMLElement>(`[data-key="${name}"]`);
  if (!page || !node) return null;
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

const focusFor = (name: Chapter, aspect: number): Rect => {
  const full: Rect = { x: 0, y: 0, w: PAGE.width, h: PAGE.height };
  if (wide.matches) return full;

  const band = (top: number): Rect => {
    const h = Math.min(PAGE.height, PAGE.width * aspect);
    return { x: 0, y: Math.max(0, Math.min(top, PAGE.height - h)), w: PAGE.width, h };
  };

  if (name === "modules") return full;
  if (name === "totals") {
    const totals = pageRectOf("totals");
    if (totals) {
      const w = 290;
      const h = w * aspect;
      return { x: PAGE.width - w - 16, y: Math.max(0, totals.y + totals.h + 18 - h), w, h };
    }
  }
  if (name === "spacing") {
    const header = pageRectOf("header");
    return band(header ? header.y + header.h - 24 : 0);
  }
  return band(0);
};

const applyCamera = (target: HTMLElement, holder: HTMLElement, focus: Rect): void => {
  const width = holder.clientWidth;
  const height = holder.clientHeight;
  if (width === 0 || height === 0) return;
  const scale = Math.min(width / focus.w, height / focus.h);
  const x = (width - focus.w * scale) / 2 - focus.x * scale;
  const y = (height - focus.h * scale) / 2 - focus.y * scale;
  target.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${scale.toFixed(4)})`;
};

const frameCamera = (): void => {
  const aspect = frame.clientHeight / Math.max(1, frame.clientWidth);
  applyCamera(camera, frame, focusFor(chapter, aspect));
};

/* ---------- Spacing chapter: mark the gap being adjusted on the sheet ---------- */

const drawGap = (): void => {
  dims.replaceChildren();
  if (chapter !== "spacing") return;

  const between = (above: string, below: string): Rect | null => {
    const a = pageRectOf(above);
    const b = pageRectOf(below);
    if (!a || !b) return null;
    return { x: PAGE.margin, y: a.y + a.h, w: PAGE.width - PAGE.margin * 2, h: b.y - (a.y + a.h) };
  };

  const marks: Partial<Record<keyof PdfSpacingOptions, () => Rect | null>> = {
    headerToParties: () => between("header", "parties"),
    partiesToTable: () => between("parties", "table"),
    tableHeaderHeight: () => pageRectOf("thead"),
    tableRowMinHeight: () => pageRectOf("row-0"),
    tableToSummary: () => between("table", "trailing"),
    summaryRowHeight: () => pageRectOf("total-0")
  };

  const rect = marks[activeGap]?.();
  if (!rect || rect.h < 0) return;
  const value = state.spacing[activeGap] ?? spacingDefaults(isQuantityOnlyDocument(state.type))[activeGap];
  const mark = html(`<div class="gap"><span class="gap__label">${value} pt</span></div>`);
  mark.style.left = `${rect.x}px`;
  mark.style.top = `${rect.y}px`;
  mark.style.width = `${rect.w}px`;
  mark.style.height = `${Math.max(rect.h, 0.75)}px`;
  dims.append(mark);
};

/* ---------- Code samples ---------- */

const setCode = (id: string, markup: string): void => {
  $(id).innerHTML = `<code>${markup}</code>`;
};

const renderCode = (data: ReturnType<typeof currentData>): void => {
  const kind = kindOf(state.type);
  const variable = VARIABLES[state.type];
  const input = buildInput(state);

  setCode(
    "code-types",
    [
      `${kw("import")} { ${fn(kind.factory)} } ${kw("from")} ${str(PACKAGE)};`,
      "",
      `${kw("const")} ${variable} = ${fn(kind.factory)}(input);`,
      `${kw("await")} ${variable}.${fn("toPDF")}(${str(`./${kind.file}.pdf`)});`
    ].join("\n")
  );

  setCode(
    "code-totals",
    [
      `${variable}.${fn("toJSON")}().totals`,
      data.totals
        ? `${note("// =>")} ${literal(data.totals, 0, 0)}`
        : note(`// => undefined: a ${kind.title.toLowerCase()} carries no amounts`)
    ].join("\n")
  );

  const summary = (name: string, value: unknown): string => {
    if (name === "items" && Array.isArray(value)) return `[${note(`/* ${value.length} items */`)}]`;
    if (typeof value === "object" && value !== null && !(value instanceof Date) && !Array.isArray(value)) {
      const [firstKey, firstValue] = Object.entries(value)[0] ?? [];
      const rest = Object.keys(value).length - 1;
      if (firstKey && rest > 0) {
        return `{ ${key(firstKey)}: ${literal(firstValue)}, ${note(`/* ${rest} more */`)} }`;
      }
    }
    return literal(value, 2, 200);
  };
  const fields = Object.entries(input).filter(([name]) => name !== "colors");
  setCode(
    "code-modules",
    fields.length > 0
      ? [`${fn(kind.factory)}({`, fields.map(([name, value]) => `  ${key(name)}: ${summary(name, value)}`).join(",\n"), "});"].join("\n")
      : `${fn(kind.factory)}({});\n${note("// Valid. It renders a blank A4 page.")}`
  );

  setCode(
    "code-colors",
    input.colors
      ? [`${fn(kind.factory)}({`, `  ${note("// ...")}`, `  ${key("colors")}: ${literal(input.colors, 2, 30)}`, "});"].join("\n")
      : [`${fn(kind.factory)}({`, `  ${note("// No colors given: the default palette applies.")}`, "});"].join("\n")
  );

  const spacing = Object.keys(state.spacing).length > 0 ? state.spacing : null;
  setCode(
    "code-spacing",
    [
      `${kw("await")} ${variable}.${fn("toPDF")}({`,
      `  ${key("outputPath")}: ${str(`./${kind.file}.pdf`)}${spacing ? "," : ""}`,
      ...(spacing ? [`  ${key("spacing")}: ${literal(spacing, 2, 30)}`] : [`  ${note("// spacing omitted: defaults apply")}`]),
      "});"
    ].join("\n")
  );
};

/* ---------- Controls ---------- */

const buildKinds = (): void => {
  const tabs = $("tabs");
  const kinds = $("kinds");
  for (const kind of KINDS) {
    const quantityOnly = isQuantityOnlyDocument(kind.type);

    const tab = html(
      `<button class="tab" type="button" data-kind="${kind.slug}" data-type="${kind.type}"><span>${kind.title}</span></button>`
    );
    tab.addEventListener("click", () => setType(kind.type));
    tabs.append(tab);

    const option = html(`
      <label class="kind" data-kind="${kind.slug}">
        <input type="radio" name="kind" value="${kind.type}" />
        <span class="kind__swatch" aria-hidden="true"></span>
        <span class="kind__name">${kind.title}</span>
        <span class="kind__meta"><code>${kind.factory}</code>${quantityOnly ? "Quantities only" : "Prices and totals"}</span>
      </label>
    `);
    option.querySelector("input")?.addEventListener("change", () => setType(kind.type));
    kinds.append(option);
  }
};

const setType = (type: DocumentType): void => {
  if (state.type === type) return;
  state.type = type;
  render(true);
};

const numberField = (
  label: string,
  value: number,
  options: { min: number; max?: number; step: number; suffix?: string },
  onChange: (value: number) => void
): HTMLElement => {
  const field = html(`
    <label class="blank">
      <span class="sr-only">${label}</span>
      <input type="number" inputmode="decimal" min="${options.min}" ${options.max !== undefined ? `max="${options.max}"` : ""} step="${options.step}" value="${value}" />
      ${options.suffix ? `<span class="blank__suffix" aria-hidden="true">${options.suffix}</span>` : ""}
    </label>
  `);
  const input = field.querySelector("input") as HTMLInputElement;
  input.addEventListener("input", () => {
    const parsed = Number.parseFloat(input.value);
    if (!Number.isFinite(parsed)) return;
    const clamped = Math.min(options.max ?? Number.POSITIVE_INFINITY, Math.max(options.min, parsed));
    onChange(clamped);
  });
  input.addEventListener("blur", () => {
    const parsed = Number.parseFloat(input.value);
    const clamped = Number.isFinite(parsed)
      ? Math.min(options.max ?? Number.POSITIVE_INFINITY, Math.max(options.min, parsed))
      : value;
    input.value = String(clamped);
  });
  return field;
};

const percent = (ratio: number): number => Math.round(ratio * 10000) / 100;

const buildLedger = (): void => {
  const ledger = $("ledger");
  const table = html(`
    <div class="ledger__table" role="group" aria-label="Line items">
      <div class="ledger__head" aria-hidden="true">
        <span>Item</span><span>Qty</span><span>Unit price</span><span>Discount</span>
      </div>
    </div>
  `);
  state.items.forEach((item, index) => {
    const row = html(`<div class="ledger__row"><span class="ledger__name">${item.name}</span></div>`);
    row.append(
      numberField(`${item.name}: quantity`, item.quantity, { min: 1, max: 999, step: 1 }, (value) => {
        state.items[index] = { ...state.items[index]!, quantity: value };
        render();
      }),
      numberField(`${item.name}: unit price in dirhams`, item.unitPrice ?? 0, { min: 0, max: 99999, step: 0.5 }, (value) => {
        state.items[index] = { ...state.items[index]!, unitPrice: value };
        render();
      }),
      numberField(`${item.name}: line discount in percent`, percent(item.discountRate ?? 0), { min: 0, max: 100, step: 1, suffix: "%" }, (value) => {
        const { discountRate: _discountRate, ...rest } = state.items[index]!;
        state.items[index] = value > 0 ? { ...rest, discountRate: value / 100 } : rest;
        render();
      })
    );
    table.append(row);
  });
  ledger.append(table);

  const extras = html(`
    <div class="ledger__extras">
      <div class="ledger__extra">
        <span class="label" id="escompte-label">Document discount</span>
      </div>
      <fieldset class="ledger__extra rates">
        <legend class="label">TVA rate</legend>
        <div class="rates__options"></div>
      </fieldset>
    </div>
  `);
  extras.firstElementChild?.append(
    numberField("Document discount in percent", percent(state.escompte), { min: 0, max: 100, step: 0.5, suffix: "%" }, (value) => {
      state.escompte = value / 100;
      render();
    })
  );
  const rates = extras.querySelector(".rates__options") as HTMLElement;
  for (const rate of VAT_RATES) {
    const option = html(`
      <label class="rate">
        <input type="radio" name="vat" value="${rate}" ${rate === state.vatRate ? "checked" : ""} />
        <span>${Math.round(rate * 100)}%</span>
      </label>
    `);
    option.querySelector("input")?.addEventListener("change", () => {
      state.vatRate = rate;
      render();
    });
    rates.append(option);
  }
  ledger.append(extras);
};

const buildChecks = (): void => {
  const checks = $("checks");
  for (const name of MODULES) {
    const option = html(`
      <label class="check" data-module="${name}">
        <input type="checkbox" checked />
        <span class="check__box" aria-hidden="true"></span>
        <code>${MODULE_LABELS[name]}</code>
      </label>
    `);
    option.querySelector("input")?.addEventListener("change", (event) => {
      state.modules[name] = (event.target as HTMLInputElement).checked;
      render(true);
    });
    checks.append(option);
  }
};

const buildColors = (): void => {
  const palettes = $("palettes");
  PALETTES.forEach((palette, index) => {
    const primary = palette.colors.primary ?? DEFAULT_COLORS.primary;
    const button = html(`
      <button class="palette" type="button" data-palette="${index}">
        <span class="palette__chip" style="background:${primary}" aria-hidden="true"></span>
        ${palette.name}
      </button>
    `);
    button.addEventListener("click", () => {
      state.colors = { ...palette.colors };
      render();
    });
    palettes.append(button);
  });

  const slots = $("slots");
  for (const { slot, hint } of SLOTS) {
    const field = html(`
      <label class="slot">
        <input type="color" data-slot="${slot}" value="${DEFAULT_COLORS[slot]}" />
        <span class="slot__text"><code>${slot}</code><span>${hint}</span></span>
        <output class="slot__value"></output>
      </label>
    `);
    field.querySelector("input")?.addEventListener("input", (event) => {
      const value = (event.target as HTMLInputElement).value;
      if (value === DEFAULT_COLORS[slot]) {
        const { [slot]: _removed, ...rest } = state.colors;
        state.colors = rest;
      } else {
        state.colors = { ...state.colors, [slot]: value };
      }
      render();
    });
    slots.append(field);
  }
};

const buildSliders = (): void => {
  const sliders = $("sliders");
  for (const gap of GAPS) {
    const field = html(`
      <label class="slider" data-gap="${gap.name}">
        <span class="slider__text"><code>${gap.name}</code><span>${gap.label}</span></span>
        <input type="range" min="${gap.min}" max="${gap.max}" step="1" />
        <output class="slider__value"></output>
      </label>
    `);
    const input = field.querySelector("input") as HTMLInputElement;
    const focus = (): void => {
      activeGap = gap.name;
      syncControls();
      drawGap();
    };
    input.addEventListener("input", () => {
      const value = Number(input.value);
      const fallback = spacingDefaults(isQuantityOnlyDocument(state.type))[gap.name];
      activeGap = gap.name;
      if (value === fallback) {
        const { [gap.name]: _removed, ...rest } = state.spacing;
        state.spacing = rest;
      } else {
        state.spacing = { ...state.spacing, [gap.name]: value };
      }
      render();
    });
    input.addEventListener("focus", focus);
    field.addEventListener("pointerenter", focus);
    sliders.append(field);
  }
  const reset = html(`<button class="reset" type="button">Reset to the default layout</button>`);
  reset.addEventListener("click", () => {
    state.spacing = {};
    render(true);
  });
  sliders.append(reset);
};

const syncControls = (): void => {
  const quantityOnly = isQuantityOnlyDocument(state.type);
  const kind = kindOf(state.type);

  for (const tab of document.querySelectorAll<HTMLElement>(".tab")) {
    tab.setAttribute("aria-pressed", String(tab.dataset.type === state.type));
  }
  for (const input of document.querySelectorAll<HTMLInputElement>('input[name="kind"]')) {
    input.checked = input.value === state.type;
  }

  const download = $<HTMLAnchorElement>("download");
  download.href = `${import.meta.env.BASE_URL}samples/${kind.file}.pdf`;
  download.textContent = `Download the sample ${kind.title} as a PDF`;

  $("caption").innerHTML = `<code>${kind.factory}()</code> ${plain(kind.title)}, A4. Previewed in HTML at the PDF renderer's measurements.`;

  $("ledger").classList.toggle("is-muted", quantityOnly);
  for (const input of $("ledger").querySelectorAll<HTMLInputElement>(".ledger__row .blank:not(:first-of-type) input, .ledger__extras input")) {
    input.disabled = quantityOnly;
  }

  for (const check of document.querySelectorAll<HTMLElement>(".check")) {
    const name = check.dataset.module as ModuleKey;
    const input = check.querySelector("input") as HTMLInputElement;
    const unavailable =
      (quantityOnly && FINANCIAL_ONLY.has(name)) ||
      (name === "logo" && !state.modules.issuer) ||
      (name === "title" && state.type === "priceRequest");
    input.checked = state.modules[name];
    input.disabled = unavailable;
    check.classList.toggle("is-unavailable", unavailable);
  }

  const paletteIndex = PALETTES.findIndex((palette) => JSON.stringify(palette.colors) === JSON.stringify(state.colors));
  for (const button of document.querySelectorAll<HTMLElement>(".palette")) {
    button.setAttribute("aria-pressed", String(Number(button.dataset.palette) === paletteIndex));
  }
  for (const input of document.querySelectorAll<HTMLInputElement>(".slot input")) {
    const slot = input.dataset.slot as keyof DocumentColors;
    const value = state.colors[slot] ?? DEFAULT_COLORS[slot];
    input.value = value;
    const output = input.closest(".slot")?.querySelector("output");
    if (output) output.textContent = value;
  }

  const defaults = spacingDefaults(quantityOnly);
  for (const slider of document.querySelectorAll<HTMLElement>(".slider")) {
    const name = slider.dataset.gap as keyof PdfSpacingOptions;
    const value = state.spacing[name] ?? defaults[name];
    (slider.querySelector("input") as HTMLInputElement).value = String(value);
    (slider.querySelector("output") as HTMLOutputElement).textContent = `${value} pt`;
    slider.classList.toggle("is-active", name === activeGap);
  }
};

/* ---------- Scroll chapters ---------- */

const setChapter = (next: Chapter): void => {
  if (chapter === next) return;
  chapter = next;
  document.documentElement.dataset.chapter = next;

  if (next === "totals" && (isQuantityOnlyDocument(state.type) || !state.modules.items)) {
    state.type = isQuantityOnlyDocument(state.type) ? "invoice" : state.type;
    state.modules.items = true;
    render(true);
    return;
  }
  drawGap();
  frameCamera();
};

const watchChapters = (): void => {
  const sections = [
    document.querySelector<HTMLElement>(".hero"),
    ...document.querySelectorAll<HTMLElement>(".chapter")
  ].filter((node): node is HTMLElement => node !== null);

  let queued = false;
  const check = (): void => {
    queued = false;
    const probe = window.innerHeight * (wide.matches ? 0.5 : 0.72);
    let current: Chapter = "hero";
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= probe) {
        current = (section.dataset.chapter as Chapter | undefined) ?? "hero";
      }
    }
    setChapter(current);
  };
  const request = (): void => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(check);
  };
  window.addEventListener("scroll", request, { passive: true });
  window.addEventListener("resize", request);
  check();
};

/* ---------- Validation table ---------- */

const buildCases = (): void => {
  const priced = { name: "Papier A4", quantity: 40, price: 38 };
  const cases: ReadonlyArray<{ type: DocumentType; input: Record<string, unknown>; pass?: string }> = [
    { type: "invoice", input: { items: [{ ...priced, quantity: 0 }] } },
    { type: "invoice", input: { items: [{ name: "Papier A4", quantity: 40 }] } },
    {
      type: "deliveryNote",
      input: { items: [{ name: "Papier A4", quantity: 40 }] },
      pass: "No error. A delivery note prints quantities, so it never asks for a price."
    },
    { type: "quote", input: { items: [priced], vatRate: 20 } },
    { type: "invoice", input: { colors: { primary: "navy" } } },
    { type: "invoice", input: { issuer: { name: "Atlas Papeterie", logo: "./logo.png" } } },
    { type: "invoice", input: { bankInfo: { type: "local", bankName: "Attijariwafa Bank", holderName: "Atlas Papeterie SARL" } } }
  ];

  const body = $("cases");
  for (const entry of cases) {
    let message: string | null = null;
    try {
      validateDocumentInput({ ...entry.input, type: entry.type } as Parameters<typeof validateDocumentInput>[0]);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    const kind = kindOf(entry.type);
    const row = html(`
      <tr>
        <td><pre class="cases__code"><code>${fn(kind.factory)}(${literal(entry.input, 0, 52)})</code></pre></td>
        <td class="${message ? "cases__error" : "cases__pass"}"></td>
      </tr>
    `);
    const cell = row.lastElementChild as HTMLElement;
    cell.textContent = message ?? entry.pass ?? "No error.";
    if (message) cell.prepend(html(`<span class="cases__tag">Error</span>`));
    body.append(row);
  }
};

/* ---------- Quick start, closing invoice, copy buttons ---------- */

const buildQuickStart = (): void => {
  const input = {
    title: "Facture",
    number: sample.numbers.invoice,
    issuer: { name: sample.issuer.name, ice: sample.issuer.ice },
    client: { name: sample.client.name },
    items: [
      { name: "Papier A4 80 g", quantity: 40, unitPrice: 38 },
      { name: "Tampon encreur bleu", quantity: 6, unitPrice: 145 }
    ],
    bankInfo: sample.bankInfo
  };
  setCode(
    "code-start",
    [
      `${kw("import")} { ${fn("createInvoice")} } ${kw("from")} ${str(PACKAGE)};`,
      "",
      `${kw("const")} facture = ${fn("createInvoice")}(${literal(input, 0, 56)});`,
      "",
      `${kw("await")} facture.${fn("toPDF")}(${str("./facture.pdf")});`,
      "",
      note("// or keep the bytes and skip the file"),
      `${kw("const")} bytes = ${kw("await")} facture.${fn("toPDF")}();`
    ].join("\n")
  );
};

const buildBill = (): void => {
  const host = $("bill-sheet");
  const holder = $("bill-frame");
  const target = $("bill-camera");
  host.append(renderSheet(createDocumentData("invoice", sample.receipt)));
  const fit = (): void => applyCamera(target, holder, { x: 0, y: 0, w: PAGE.width, h: PAGE.height });
  new ResizeObserver(fit).observe(holder);
  fit();
};

const wireCopy = (): void => {
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-copy]")) {
    const label = button.querySelector<HTMLElement>("[data-copy-label]");
    let timer = 0;
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(button.dataset.copy ?? "");
        if (label) label.textContent = "Copied";
      } catch {
        if (label) label.textContent = "Select and copy";
      }
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (label) label.textContent = "Copy";
      }, 1800);
    });
  }
};

/* ---------- Boot ---------- */

for (const node of document.querySelectorAll<HTMLElement>("[data-version]")) node.textContent = kitPackage.version;
for (const node of document.querySelectorAll<HTMLElement>("[data-version-prefixed]")) node.textContent = `v${kitPackage.version}`;

buildKinds();
buildLedger();
buildChecks();
buildColors();
buildSliders();
buildCases();
buildQuickStart();
buildBill();
wireCopy();
render();
watchChapters();

new ResizeObserver(() => frameCamera()).observe(frame);
wide.addEventListener("change", () => frameCamera());
document.documentElement.classList.add("is-ready");
