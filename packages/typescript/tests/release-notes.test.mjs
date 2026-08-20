import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { extractReleaseNotes } from "../scripts/release-notes.mjs";

test("extracts notes for the current changelog version", async () => {
  const changelog = await readFile(new URL("../CHANGELOG.md", import.meta.url), "utf8");
  const notes = extractReleaseNotes(changelog, "0.3.0");

  assert.match(notes, /createPriceRequest/);
  assert.doesNotMatch(notes, /^## /m);
});

test("extracts the oldest section through the end of the changelog", () => {
  const changelog = "# Changelog\n\n## 2.0.0\n\n- New\n\n## 1.0.0\n\n- Initial\n";

  assert.equal(extractReleaseNotes(changelog, "1.0.0"), "- Initial");
});

test("rejects a missing changelog section", () => {
  assert.throws(
    () => extractReleaseNotes("# Changelog\n\n## 1.0.0\n\n- Initial\n", "2.0.0"),
    /does not contain/
  );
});

test("rejects duplicate changelog sections", () => {
  const changelog = "## 1.0.0\n\n- First\n\n## 1.0.0\n\n- Second\n";

  assert.throws(() => extractReleaseNotes(changelog, "1.0.0"), /more than one/);
});

test("rejects an empty changelog section", () => {
  const changelog = "## 2.0.0\n\n## 1.0.0\n\n- Initial\n";

  assert.throws(() => extractReleaseNotes(changelog, "2.0.0"), /is empty/);
});
