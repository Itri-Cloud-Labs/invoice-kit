import assert from "node:assert/strict";
import test from "node:test";
import { inflateSync } from "node:zlib";
import { createInvoice, getLabels } from "../dist/index.js";
import { PAGE, buildBankLines, buildPartyLines, resolvePdfFonts } from "../dist/renderers/pdf-support.js";
import {
  formatLabelValue,
  isolate,
  layoutVisualLines,
  measureTextWidth,
  resolveBundledArabicFonts,
  setTextDirection,
  useFont
} from "../dist/renderers/pdf-text.js";
import { formatDate } from "../dist/utils/formatting.js";
import PDFDocument from "../dist/vendor/pdfkit.cjs";

const createDoc = (direction, { bundledFont = true } = {}) => {
  const doc = new PDFDocument({ size: "A4" });
  setTextDirection(doc, direction);
  useFont(doc, bundledFont ? resolvePdfFonts({ type: "invoice", locale: "ar-MA" })?.regular : undefined, "Helvetica");
  doc.fontSize(10);
  return doc;
};

const countPdfPages = (bytes) => {
  const pageMatches = Buffer.from(bytes).toString("latin1").match(/\/Type \/Page\b/g);
  return pageMatches?.length ?? 0;
};

const readPdfContentStreams = (bytes) => {
  const pdf = Buffer.from(bytes);
  const streamMarker = Buffer.from("stream\n");
  const endMarker = Buffer.from("\nendstream");
  const streams = [];
  let offset = 0;

  while (offset < pdf.length) {
    const start = pdf.indexOf(streamMarker, offset);
    if (start === -1) break;
    const contentStart = start + streamMarker.length;
    const end = pdf.indexOf(endMarker, contentStart);
    if (end === -1) break;

    try {
      streams.push(inflateSync(pdf.subarray(contentStart, end)).toString("latin1"));
    } catch {
      // Ignore non-Flate streams such as embedded images and fonts.
    }
    offset = end + endMarker.length;
  }

  return streams;
};

const readPdfTextBlocks = (bytes) =>
  readPdfContentStreams(bytes).flatMap((stream) =>
    [...stream.matchAll(/BT\s+([\s\S]*?)\s+ET/g)].map(([, body]) => {
      const matrix = body.match(/1 0 0 1 ([\d.-]+) ([\d.-]+) Tm/);
      return {
        x: matrix ? Number(matrix[1]) : undefined,
        y: matrix ? Number(matrix[2]) : undefined
      };
    })
  );

// Rectangles are drawn in pdfkit's top-down page space while text matrices use PDF's
// bottom-up space, so callers convert with `PAGE.height` before comparing them.
const readPdfRectangles = (bytes) =>
  readPdfContentStreams(bytes).flatMap((stream) =>
    [...stream.matchAll(/([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+) re/g)].map(([, x, y, width, height]) => ({
      x: Number(x),
      y: Number(y),
      width: Number(width),
      height: Number(height)
    }))
  );

test("Arabic dates use Western digits", () => {
  assert.equal(formatDate(new Date(2026, 9, 12), "ar-MA"), "12/10/2026");
});

test("an Arabic phrase is shaped as one right-to-left run instead of word by word", () => {
  assert.deepEqual(layoutVisualLines(createDoc("rtl"), "طلب عرض أسعار"), [["طلب عرض أسعار"]]);
});

test("label and value keep their reading order in a right-to-left line", () => {
  const lines = layoutVisualLines(createDoc("rtl"), formatLabelValue("الرقم", "FAC-2026-0042"));

  // Visual order is left to right: the value sits to the left of its Arabic label.
  assert.deepEqual(lines, [["FAC-2026-0042", "الرقم: "]]);
});

test("digit groups in a RIB are not reordered", () => {
  const lines = layoutVisualLines(createDoc("rtl"), formatLabelValue("رقم الحساب", "007 780 0001234567890123 45"));

  assert.deepEqual(lines, [["007 780 0001234567890123 45", "رقم الحساب: "]]);
});

test("brackets are mirrored inside right-to-left text", () => {
  const [line] = layoutVisualLines(createDoc("rtl"), "شكرا (المرجع)");

  assert.deepEqual(line, ["(", "المرجع", ")", "شكرا "]);
});

test("wrapped Arabic text keeps the first words on the first line", () => {
  const doc = createDoc("rtl");
  const text = "خدمة استضافة سحابية مع دعم فني على مدار الساعة";
  const lines = layoutVisualLines(doc, text, measureTextWidth(doc, text) / 2);

  assert.ok(lines.length > 1);
  assert.ok(lines[0][0].startsWith("خدمة"));
  assert.equal(lines.flat().join(" "), text);
});

test("Arabic values in a left-to-right document fall back to the bundled font", () => {
  const doc = createDoc("ltr", { bundledFont: false });
  const lines = layoutVisualLines(doc, formatLabelValue("Banque", "التجاري وفا بنك"));

  assert.deepEqual(lines, [["Banque: ", "التجاري وفا بنك"]]);
  assert.ok(measureTextWidth(doc, isolate("بنك")) > 0);
});

test("a supplied font falls back when any character is missing, not only the first", () => {
  const doc = new PDFDocument({ size: "A4" });
  setTextDirection(doc, "rtl");
  // A copy gives the custom font its own registration, distinct from the bundled fallback.
  useFont(doc, Buffer.from(resolveBundledArabicFonts().regular), "Helvetica");

  const usedFonts = [];
  const applyFont = doc.font.bind(doc);
  doc.font = (name, ...rest) => {
    usedFonts.push(name);
    return applyFont(name, ...rest);
  };

  const text = "شكر";
  const coveredCodePoint = text.codePointAt(0);
  doc._font.font.hasGlyphForCodePoint = (codePoint) => codePoint === coveredCodePoint;

  usedFonts.length = 0;
  layoutVisualLines(doc, text);

  assert.ok(
    usedFonts.includes("InvoiceKit-Fallback"),
    "expected the fallback font when a later character in the run is missing"
  );
});

test("a missing glyph does not fail when the bundled font is already registered", () => {
  const doc = createDoc("rtl");
  doc._font.font.hasGlyphForCodePoint = () => false;

  assert.doesNotThrow(() => layoutVisualLines(doc, "شكر"));
});

test("party and bank lines use localized labels and separators", () => {
  const labels = getLabels("ar-MA");
  const plain = (line) => line.replace(/[⁦-⁩]/g, "");
  const partyLines = buildPartyLines({ name: "شركة", city: "الرباط", country: "المغرب", phone: "+212 522 123 456", email: "a@b.ma" }, labels);
  const bankLines = buildBankLines({ type: "local", bankName: "بنك", holderName: "شركة", rib: "007 780" }, labels);

  assert.deepEqual(partyLines.map(plain), ["شركة", "الرباط، المغرب", "الهاتف: +212 522 123 456", "البريد الإلكتروني: a@b.ma"]);
  assert.equal(plain(bankLines[2]), `${labels.rib}: 007 780`);
  assert.equal(getLabels("fr-MA").phone, "Tel");
});

test("Arabic invoices with mixed content, long labels, and bank details render", async () => {
  const invoice = createInvoice({
    locale: "ar-MA",
    title: "فاتورة",
    number: "FAC-2026-0042",
    issueDate: new Date(2026, 9, 12),
    issuer: { name: "مختبرات إتري كلاود", city: "الدار البيضاء", country: "المغرب", phone: "+212 522 123 456" },
    client: { name: "شركة الأطلس للتجارة SARL", ice: "009876543000021" },
    items: [{ name: "خدمة استضافة", description: "اشتراك سنوي لخادم Cloud VPS مع دعم فني", quantity: 2, unit: "شهر", price: 1500 }],
    bankInfo: { type: "local", bankName: "التجاري وفا بنك", holderName: "مختبرات إتري كلاود", rib: "007 780 0001234567890123 45" },
    notes: "شكرا لثقتكم (المرجع: REF-77).",
    footer: "مختبرات إتري كلاود\nICE: 001234567000089"
  });

  assert.ok((await invoice.toPDF()).length > 0);
});

test("an oversized unbroken run wraps inside its column instead of overflowing", () => {
  const doc = createDoc("rtl");
  const width = 60;
  const email = "verylongemailaddress@example-domain.com";
  const emailLines = layoutVisualLines(doc, email, width);

  assert.ok(emailLines.length > 1, "expected the long email to wrap");
  assert.equal(emailLines.flat().join(""), email, "splitting must preserve every character in order");
  for (const line of emailLines) {
    assert.ok(
      measureTextWidth(doc, line.join("")) <= width + 0.01,
      `line "${line.join("")}" exceeded the column width`
    );
  }

  const arabicWord = "استضافةسحابيةمتكاملةللشركات";
  const arabicLines = layoutVisualLines(doc, arabicWord, width);

  assert.ok(arabicLines.length > 1, "expected the long Arabic word to wrap");
  for (const line of arabicLines) {
    assert.ok(
      measureTextWidth(doc, line.join("")) <= width + 0.5,
      `line "${line.join("")}" exceeded the column width`
    );
  }
});

test("long Arabic notes continue on new pages instead of running off the page", async () => {
  const notes = Array.from(
    { length: 120 },
    (_, index) => `سطر ملاحظة رقم ${index + 1} مع نص عربي طويل للاختبار`
  ).join("\n");
  const pdfBytes = await createInvoice({
    locale: "ar-MA",
    title: "فاتورة",
    number: "FAC-1",
    items: [{ name: "خدمة", quantity: 1, price: 100 }],
    notes,
    footer: "IC Labs"
  }).toPDF();

  assert.ok(countPdfPages(pdfBytes) > 2, "expected the notes to span more than two pages");
  const offPage = readPdfTextBlocks(pdfBytes).filter(
    ({ y }) => y !== undefined && (y < 0 || y > PAGE.height)
  );
  assert.equal(offPage.length, 0, "expected no text to be drawn outside the page bounds");
});

test("an oversized Arabic item row repeats its header and border while flowing across pages", async () => {
  const description = Array.from(
    { length: 160 },
    (_, index) => `فقرة وصف طويلة رقم ${index + 1} للمنتج`
  ).join(" ");
  const pdfBytes = await createInvoice({
    locale: "ar-MA",
    title: "فاتورة",
    number: "FAC-1",
    items: [{ name: "منتج", description, quantity: 2, unit: "شهر", price: 1500 }]
  }).toPDF();

  const tableRectangles = readPdfRectangles(pdfBytes).filter(
    ({ x, width }) => Math.round(x) === 48 && Math.round(width) === 499
  );
  const headers = tableRectangles.filter(({ height }) => Math.round(height) === 28);
  const rowBorders = tableRectangles.filter(({ height }) => height > 28);

  assert.ok(countPdfPages(pdfBytes) >= 2, "expected the oversized row to span pages");
  assert.ok(rowBorders.length >= 2, "expected a border segment on each page the row spans");
  for (const { height } of rowBorders) {
    assert.ok(height <= PAGE.height, `row border of ${height} points is taller than a page`);
  }
  assert.ok(
    headers.length >= rowBorders.length,
    "expected a table header on every page the row spans"
  );
  const offPage = readPdfTextBlocks(pdfBytes).filter(
    ({ y }) => y !== undefined && (y < 0 || y > PAGE.height)
  );
  assert.equal(offPage.length, 0, "expected no text outside the page bounds");
});

test("Arabic documents mirror the totals box to the left while French keeps it on the right", async () => {
  const common = {
    number: "FAC-1",
    items: [{ name: "خدمة", quantity: 1, price: 999999999 }],
    vatRate: 0.2
  };
  const totalsX = (bytes) => {
    const boxes = [...new Set(
      readPdfRectangles(bytes)
        .filter(({ width }) => Math.round(width) === 220)
        .map(({ x }) => x)
    )];
    assert.equal(boxes.length, 1, "expected a single totals box");
    return boxes[0];
  };

  const arabicPdf = await createInvoice({ ...common, locale: "ar-MA", title: "فاتورة" }).toPDF();
  const frenchPdf = await createInvoice({ ...common, title: "Facture" }).toPDF();

  assert.equal(Math.round(totalsX(arabicPdf)), Math.round(PAGE.margin));
  assert.equal(Math.round(totalsX(frenchPdf)), Math.round(PAGE.width - PAGE.margin - 220));
  assert.ok(totalsX(arabicPdf) < totalsX(frenchPdf), "expected the Arabic totals box on the left");
});

test("wrapped Arabic totals labels grow their rows and stay inside the totals box", async () => {
  const pdfBytes = await createInvoice({
    locale: "ar-MA",
    title: "فاتورة",
    number: "FAC-1",
    items: [{ name: "خدمة", quantity: 1, price: 999999999 }],
    vatRate: 0.2
  }).toPDF();

  const bands = [...new Map(
    readPdfRectangles(pdfBytes)
      .filter(({ width }) => Math.round(width) === 220)
      .map((rectangle) => [rectangle.y, rectangle])
  ).values()];

  assert.equal(bands.length, 5, "expected one rectangle per totals row");
  assert.ok(
    bands.some(({ height }) => height > 26),
    "expected a wrapped label to grow its totals row beyond the minimum height"
  );

  const boxLeft = Math.min(...bands.map(({ x }) => x));
  const boxTop = PAGE.height - Math.min(...bands.map(({ y }) => y));
  const boxBottom = PAGE.height - Math.max(...bands.map(({ y, height }) => y + height));
  const labels = readPdfTextBlocks(pdfBytes).filter(({ x, y }) =>
    x !== undefined
    && y !== undefined
    && x >= boxLeft - 1
    && x <= boxLeft + 221
    && y >= boxBottom - 1
    && y <= boxTop + 1
  );

  assert.ok(labels.length >= bands.length, "expected a label or value in every totals row");
  for (const { y } of labels) {
    const inRow = bands.some(({ y: rowY, height }) =>
      y >= PAGE.height - rowY - height - 1 && y <= PAGE.height - rowY + 1
    );
    assert.ok(inRow, `totals text at y=${y} crossed a row border`);
  }
});

test("French invoices accept Arabic values without custom fonts", async () => {
  const invoice = createInvoice({
    title: "Facture",
    client: { name: "شركة الأطلس للتجارة" },
    items: [{ name: "خدمة استضافة", quantity: 1, price: 100 }]
  });

  assert.ok((await invoice.toPDF()).length > 0);
});
