import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const extractReleaseNotes = (changelog, version) => {
  if (typeof version !== "string" || version.trim().length === 0) {
    throw new Error("A non-empty release version is required.");
  }

  const headings = [...changelog.matchAll(/^##[ \t]+(.+?)[ \t]*$/gm)];
  const matches = headings.filter((heading) => heading[1] === version);

  if (matches.length === 0) {
    throw new Error(`CHANGELOG.md does not contain a \"## ${version}\" section.`);
  }

  if (matches.length > 1) {
    throw new Error(`CHANGELOG.md contains more than one \"## ${version}\" section.`);
  }

  const heading = matches[0];
  const headingIndex = headings.indexOf(heading);
  const nextHeading = headings[headingIndex + 1];
  const start = (heading.index ?? 0) + heading[0].length;
  const end = nextHeading?.index ?? changelog.length;
  const notes = changelog.slice(start, end).trim();

  if (notes.length === 0) {
    throw new Error(`The \"## ${version}\" section in CHANGELOG.md is empty.`);
  }

  return notes;
};

const run = async () => {
  const [, , version, outputPath] = process.argv;

  if (!version || !outputPath) {
    throw new Error("Usage: node scripts/release-notes.mjs <version> <output-path>");
  }

  const changelog = await readFile(new URL("../CHANGELOG.md", import.meta.url), "utf8");
  const notes = extractReleaseNotes(changelog, version);
  await writeFile(outputPath, `${notes}\n`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await run();
}
