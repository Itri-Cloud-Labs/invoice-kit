import assert from "node:assert/strict";
import test from "node:test";
import { createInvoice, getLabels } from "../dist/index.js";
import { buildBankLines, buildPartyLines, resolvePdfFonts } from "../dist/renderers/pdf-support.js";
import {
  formatLabelValue,
  isolate,
  layoutVisualLines,
  measureTextWidth,
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

test("French invoices accept Arabic values without custom fonts", async () => {
  const invoice = createInvoice({
    title: "Facture",
    client: { name: "شركة الأطلس للتجارة" },
    items: [{ name: "خدمة استضافة", quantity: 1, price: 100 }]
  });

  assert.ok((await invoice.toPDF()).length > 0);
});
