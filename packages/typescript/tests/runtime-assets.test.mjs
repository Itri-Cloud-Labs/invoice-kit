import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

test("the PDF runtime and fallback fonts are self-contained", async () => {
  const [renderer, support, pdfkitRuntime, bundledFonts, regularFont, boldFont] = await Promise.all([
    readFile(new URL("../dist/renderers/pdf.js", import.meta.url), "utf8"),
    readFile(new URL("../dist/renderers/pdf-support.js", import.meta.url), "utf8"),
    readFile(new URL("../dist/vendor/pdfkit.cjs", import.meta.url), "utf8"),
    import("../dist/vendor/dejavu-fonts.cjs").then((module) => module.default),
    stat(new URL("../node_modules/dejavu-fonts-ttf/ttf/DejaVuSans.ttf", import.meta.url)),
    stat(new URL("../node_modules/dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf", import.meta.url))
  ]);

  assert.match(renderer, /\.\.\/vendor\/pdfkit\.cjs/);
  assert.doesNotMatch(renderer, /from ["']pdfkit["']/);
  assert.doesNotMatch(support, /createRequire|require\.resolve|dejavu-fonts-ttf/);
  assert.doesNotMatch(pdfkitRuntime, /__dirname/);
  assert.match(pdfkitRuntime, /StartFontMetrics 4\.1/);
  assert.equal(Buffer.from(bundledFonts.regular, "base64").length, regularFont.size);
  assert.equal(Buffer.from(bundledFonts.bold, "base64").length, boldFont.size);
});
