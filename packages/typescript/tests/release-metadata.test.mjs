import assert from "node:assert/strict";
import test from "node:test";
import { resolveReleaseMetadata } from "../scripts/release-metadata.mjs";

test("resolves stable TypeScript release metadata", () => {
  assert.deepEqual(
    resolveReleaseMetadata("typescript-v1.2.3", { name: "@ic-labs/invoice-kit", version: "1.2.3" }),
    {
      version: "1.2.3",
      packageName: "@ic-labs/invoice-kit",
      npmTag: "latest",
      prerelease: false
    }
  );
});

test("resolves prereleases to the next npm tag", () => {
  assert.deepEqual(
    resolveReleaseMetadata("typescript-v2.0.0-beta.1", { name: "@ic-labs/invoice-kit", version: "2.0.0-beta.1" }),
    {
      version: "2.0.0-beta.1",
      packageName: "@ic-labs/invoice-kit",
      npmTag: "next",
      prerelease: true
    }
  );
});

test("rejects a tag and package version mismatch", () => {
  assert.throws(
    () => resolveReleaseMetadata("typescript-v1.2.4", { name: "@ic-labs/invoice-kit", version: "1.2.3" }),
    /does not match/
  );
});

test("rejects tags outside the TypeScript namespace", () => {
  assert.throws(
    () => resolveReleaseMetadata("python-v1.2.3", { name: "@ic-labs/invoice-kit", version: "1.2.3" }),
    /typescript-v<version>/
  );
});
