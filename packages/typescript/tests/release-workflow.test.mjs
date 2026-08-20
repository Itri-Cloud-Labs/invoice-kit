import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the release workflow leaves npm authentication to trusted publishing", async () => {
  const workflow = await readFile(new URL("../../../.github/workflows/publish.yml", import.meta.url), "utf8");
  const setupNodeStep = workflow.match(/      - name: Setup Node\.js\n[\s\S]*?(?=\n      - name:)/)?.[0];

  assert.ok(setupNodeStep, "expected the release workflow to configure Node.js");
  assert.doesNotMatch(
    setupNodeStep,
    /registry-url:/,
    "setup-node registry configuration injects token auth that takes precedence over npm OIDC"
  );
  assert.match(workflow, /id-token: write/);
  assert.match(workflow, /npm publish .* --provenance/);
});
