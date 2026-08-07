import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL("../src/sections/shutter-section.js", import.meta.url);
const runtimeUrl = new URL("../src/sections/section-runtime.js", import.meta.url);

test("shutter popup uses the standard modal shell with its own real selectors", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /className = "modal-wrapper dm-shutter-popup"/);
  assert.match(source, /modal-card details-content dm-shutter-popup-card/);
  assert.match(source, /ev-waw-header dm-shutter-popup-header/);
  assert.match(source, /class="ev-waw-title"/);
  assert.match(source, /ev-waw-close dm-shutter-popup-close/);
  assert.match(source, /class="details-list dm-shutter-popup-list"/);
  assert.match(source, /row\.className = "detail-row dm-shutter-popup-row"/);
  assert.match(source, /d-icon dm-shutter-row-icon/);
  assert.match(source, /dm-shutter-title-icon/);
});

test("shutter popup has one visual owner and no legacy polling skin", async () => {
  const [source, runtime] = await Promise.all([
    readFile(sourceUrl, "utf8"),
    readFile(runtimeUrl, "utf8"),
  ]);

  assert.doesNotMatch(source, /dm-shutter-popup-backdrop/);
  assert.doesNotMatch(source, /dm-shutter-popup-dialog/);
  assert.doesNotMatch(source, /120\s*:\s*350/);
  assert.doesNotMatch(runtime, /shutter-alert-layout-section/);
  assert.match(source, /stateChangeAffectsShutters/);
});
