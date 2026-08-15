import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { CONFIG_KEYS } from "../src/sections/config-persistence-section.js";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// These are intentionally not shared dashboard configuration:
// - connection can contain credentials/endpoint data;
// - navbar mode/theme are per-device presentation preferences;
// - sync bookkeeping and irrigation/pool run markers are runtime state.
const DEVICE_LOCAL_OR_RUNTIME = new Set([
  "cd_connection",
  "cd_theme",
  "cd_navbar_mode",
  "cd_nav_mode",
  "cd_sync_ts",
  "cd_sync_dirty",
  "cd_irr_lastrun",
  "cd_pool_run",
  "cd_pool_lastrun",
]);

function literalStorageWrites(source) {
  return new Set(
    [...source.matchAll(/localStorage\.setItem\(\s*["']((?:cd|dm)_[a-z0-9_]+)["']/gi)].map(
      (match) => match[1],
    ),
  );
}

test("every literal legacy dashboard config write is either synced or explicitly device-local", async () => {
  for (const variant of ["it", "en"]) {
    const source = await readFile(
      path.join(frontendRoot, "legacy", `dashboard-runtime-${variant}.js`),
      "utf8",
    );
    const unknown = [...literalStorageWrites(source)]
      .filter((key) => !CONFIG_KEYS.includes(key) && !DEVICE_LOCAL_OR_RUNTIME.has(key))
      .sort();
    assert.deepEqual(
      unknown,
      [],
      `${variant} runtime has unclassified localStorage writes that can diverge across devices:\n${unknown.join("\n")}`,
    );
  }
});

test("the cross-device snapshot includes the legacy editor fields previously omitted", () => {
  for (const key of [
    "cd_floor_icons",
    "cd_subload_groups",
    "cd_flow_nodes",
    "cd_report_devices",
    "cd_avvisi_custom",
    "cd_text_overrides",
    "cd_hidden_elements",
  ]) {
    assert.equal(CONFIG_KEYS.includes(key), true, `${key} must be shared across devices`);
  }
});
