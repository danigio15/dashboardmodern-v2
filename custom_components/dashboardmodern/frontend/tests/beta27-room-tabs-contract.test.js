import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { temperatureRoomTabsModel } from "../src/sections/beta26-real-device-stability-section.js";

test("beta27 room tabs use stable room ids rather than display names", () => {
  const tabs = temperatureRoomTabsModel([
    { id: "room-1", name: "Camera", temp: "sensor.one" },
    { id: "room-2", name: "Camera", temp: "sensor.two" },
  ]);
  assert.deepEqual(
    tabs.slice(1).map((tab) => tab.id),
    ["room-1", "room-2"],
  );
});

test("the temperature room filter has a single owner", async () => {
  const beta16 = await readFile(
    new URL("../src/sections/beta16-real-device-layout-section.js", import.meta.url),
    "utf8",
  );
  const beta26 = await readFile(
    new URL("../src/sections/beta26-real-device-stability-section.js", import.meta.url),
    "utf8",
  );

  // beta16 kept a second set of tabs with its own filter state. Both layers wrote
  // to the same nav, so the click landed in one module's state while the other
  // reset the active pill and re-showed every card at the next render.
  assert.doesNotMatch(beta16, /data-room-filter|roomFilter/);
  assert.doesNotMatch(beta16, /temperatureFilter|repairTemperatureTabs/);
  // The tab styling stays here; only the behaviour moved.
  assert.match(beta16, /dm-temperature-room-tabs/);

  assert.match(beta26, /button\.dataset\.roomFilter = tab\.id/);
  // The tab icon uses the shared painter, so an `mdi:` room icon renders through
  // the icon engine instead of `ha-icon` markup this document cannot resolve.
  assert.match(beta26, /writeIconGlyph\(button\.querySelector\(/);
});

test("the temperature filter outranks the card layout owners and survives repaints", async () => {
  const source = await readFile(
    new URL("../src/sections/beta26-real-device-stability-section.js", import.meta.url),
    "utf8",
  );

  // The card owners declare `display:grid!important`, so hiding by attribute
  // alone is one cascade tweak away from being outranked.
  assert.match(source, /setProperty\?\.\("display", "none", "important"\)/);
  assert.match(source, /#dm-beta16-temperature-tabs\[hidden\]\{display:none!important\}/);
  // Every renderer that rebuilds #temp-grid drops the per-card filter state, so
  // the owner restores it from the grid itself instead of trusting the renderer.
  assert.match(source, /new root\.MutationObserver/);
  assert.match(source, /observer\.observe\(grid, \{ childList: true \}\)/);
});
