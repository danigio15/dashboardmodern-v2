import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const hotfixUrl = new URL("../legacy/runtime-real-ha-hotfix-v2.js", import.meta.url);
const entryUrl = new URL("../legacy/report-mobile-fixes.js", import.meta.url);

test("0.15.1 loads the bounded real Home Assistant owner last", async () => {
  const entry = await readFile(entryUrl, "utf8");
  assert.match(entry, /import "\.\/release-0152-fixes\.js";/);
  assert.match(entry, /import "\.\/runtime-real-ha-hotfix-v2\.js";/);
  assert.ok(
    entry.indexOf("runtime-real-ha-hotfix-v2.js") > entry.indexOf("release-0152-fixes.js"),
    "the real-HA owner must execute after the consolidated owners",
  );
});

test("0.15.1 owns real theme, canonical flows, total-meter saving, flames and alerts", async () => {
  const source = await readFile(hotfixUrl, "utf8");
  assert.match(source, /applyDashboardPalette/);
  assert.match(source, /applyCanonicalFlow/);
  assert.match(source, /saveEnergy/);
  assert.match(source, /replaceAll\("🔥", ""\)/);
  assert.match(source, /synchronizeAlerts/);
  assert.match(source, /data-alert-edit-0151|alertEdit0151/);
  assert.doesNotMatch(source, /setInterval\s*\(/);
  assert.doesNotMatch(source, /new\s+MutationObserver\s*\(/);
  assert.doesNotMatch(source, /wrapFunction|wrapOwnerApply/);
});
