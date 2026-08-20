import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the release workflow follows npm's trusted publishing requirements", async () => {
  const workflow = await readFile(new URL("../../../.github/workflows/publish.yml", import.meta.url), "utf8");
  const setupNodeStep = workflow.match(/      - name: Setup Node\.js\n[\s\S]*?(?=\n      - name:)/)?.[0];
  const publishStep = workflow.match(/      - name: Publish to npm\n[\s\S]*?(?=\n      - name:)/)?.[0];

  assert.ok(setupNodeStep, "expected the release workflow to configure Node.js");
  assert.match(setupNodeStep, /uses: actions\/setup-node@v6/);
  assert.match(setupNodeStep, /node-version: 24/);
  assert.match(setupNodeStep, /registry-url: https:\/\/registry\.npmjs\.org/);
  assert.match(setupNodeStep, /package-manager-cache: false/);
  assert.ok(publishStep, "expected the release workflow to publish to npm");
  assert.match(publishStep, /working-directory: packages\/typescript/);
  assert.match(workflow, /id-token: write/);
  assert.match(workflow, /npm publish .* --provenance/);
});

test("the package repository matches the GitHub OIDC repository exactly", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8")
  );

  assert.equal(manifest.repository.url, "https://github.com/Itri-Cloud-Labs/invoice-kit");
});
