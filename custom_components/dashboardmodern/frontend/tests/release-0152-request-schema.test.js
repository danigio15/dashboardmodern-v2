import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const fixesUrl = new URL("../legacy/release-0152-runtime.js", import.meta.url);

test("statistics request omits the invalid types list", async () => {
  const source = await readFile(fixesUrl, "utf8");
  const request = source.slice(source.indexOf("async function statisticsForRange"), source.indexOf("async function requestPeriod"));
  assert.match(request, /recorder\/statistics_during_period/);
  assert.doesNotMatch(request, /types\s*:/);
});
