import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL("../src/sections/shutter-section.js", import.meta.url);

test("shutter popup reuses the standard alert modal structure", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /className = "modal-wrapper dm-shutter-popup"/);
  assert.match(source, /modal-card details-content dm-shutter-popup-card/);
  assert.match(source, /class="ev-waw-header"/);
  assert.match(source, /class="ev-waw-title"/);
  assert.match(source, /class="ev-waw-close"/);
  assert.match(source, /class="details-list dm-shutter-popup-list"/);
  assert.match(source, /row\.className = "detail-row dm-shutter-popup-row"/);
});

test("shutter popup does not ship an independent backdrop or dialog skin", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.doesNotMatch(source, /dm-shutter-popup-backdrop/);
  assert.doesNotMatch(source, /dm-shutter-popup-dialog/);
  assert.doesNotMatch(source, /background:rgba\(2,6,23/);
  assert.doesNotMatch(source, /box-shadow:0 28px 90px/);
});
