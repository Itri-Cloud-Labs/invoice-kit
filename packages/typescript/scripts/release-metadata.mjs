import { appendFile, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const TAG_PREFIX = "typescript-v";

export const resolveReleaseMetadata = (tag, manifest) => {
  if (typeof tag !== "string" || !tag.startsWith(TAG_PREFIX) || tag.length === TAG_PREFIX.length) {
    throw new Error("Expected a tag named typescript-v<version>.");
  }

  const version = manifest?.version;
  const packageName = manifest?.name;
  if (typeof version !== "string" || version.length === 0) {
    throw new Error("package.json must define a non-empty version.");
  }
  if (typeof packageName !== "string" || packageName.length === 0) {
    throw new Error("package.json must define a non-empty name.");
  }

  const tagVersion = tag.slice(TAG_PREFIX.length);
  if (tagVersion !== version) {
    throw new Error(`Tag version ${tagVersion} does not match package version ${version}.`);
  }

  const prerelease = version.includes("-");
  return {
    version,
    packageName,
    npmTag: prerelease ? "next" : "latest",
    prerelease
  };
};

const run = async () => {
  const [, , tag, outputPath] = process.argv;
  if (!tag || !outputPath) {
    throw new Error("Usage: node scripts/release-metadata.mjs <tag> <github-output-path>");
  }

  const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const metadata = resolveReleaseMetadata(tag, manifest);
  await appendFile(outputPath, [
    `version=${metadata.version}`,
    `package_name=${metadata.packageName}`,
    `npm_tag=${metadata.npmTag}`,
    `prerelease=${metadata.prerelease}`,
    ""
  ].join("\n"));
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await run();
}
