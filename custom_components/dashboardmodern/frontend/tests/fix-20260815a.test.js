// DM-FIX-20260815A
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("appliance room tab normalization replaces an MDI prefix once", async () => {
  const button = { textContent: "mdi:bed-king-outline Cameretta" };
  globalThis.document = {
    documentElement: { lang: "it" },
    querySelectorAll: (selector) =>
      selector === "#page-appliances-main .sub-tabs-energy .appl-section-tab" ? [button] : [],
    getElementById: () => null,
    querySelector: () => null,
    addEventListener: () => {},
  };
  const module = await import(`../src/sections/appliances-section.js?fix=${Date.now()}`);
  assert.equal(module.normalizeApplianceRoomTabs(), true);
  assert.equal(button.textContent, "🛏️ Cameretta");
  assert.equal(module.normalizeApplianceRoomTabs(), false);
  assert.equal(button.textContent, "🛏️ Cameretta");
  button.textContent = "📊 Panoramica";
  assert.equal(module.normalizeApplianceRoomTabs(), false);
  assert.equal(button.textContent, "📊 Panoramica");
});

test("temperature row normalizer owns missing label nodes and fallback order", async () => {
  const source = await readFile(
    new URL("../src/sections/temperature-section.js", import.meta.url),
    "utf8",
  );
  assert.match(
    source,
    /clean\(room\?\.name\).*clean\(row\.dataset\.roomName\).*clean\(row\.dataset\.roomId\)/s,
  );
  assert.match(source, /if \(!main\).*doc\.createElement\("div"\)/s);
  assert.match(source, /if \(!primary\).*primary\.className = "ed-row-new"/s);
  assert.match(source, /if \(!secondary\).*secondary\.className = "ed-row-old"/s);
  const entry = await readFile(new URL("../legacy/modules-entry.js", import.meta.url), "utf8");
  assert.match(entry, /room\.name \|\| "".*room\.id \|\| ""/s);
});
