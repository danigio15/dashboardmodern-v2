import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const loaderUrl = new URL("../legacy/report-mobile-fixes.js", import.meta.url);

test("the runtime loader replaces the broken 0.14.11 statistics layers", async () => {
  const source = await readFile(loaderUrl, "utf8");
  assert.match(source, /release-0152-fixes\.js/);
  assert.doesNotMatch(source, /import "\.\/release-0151-fixes\.js"/);
  assert.doesNotMatch(source, /import "\.\/release-0151-statistics-fallback\.js"/);
});
