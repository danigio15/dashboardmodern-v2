import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../src/sections/appliance-editor-section.js", import.meta.url), "utf8");

test("appliance editor never copies monthly energy into history or Report", () => {
  assert.match(source, /history_entity:\s*total,/);
  assert.match(source, /report_entity:\s*total,/);
  assert.doesNotMatch(source, /history_entity:\s*total\s*\|\|\s*clean\(values\.monthly_energy_entity\)/);
  assert.doesNotMatch(source, /report_entity:\s*total\s*\|\|\s*clean\(values\.monthly_energy_entity\)/);
});

test("total-energy help explicitly rejects the monthly sensor role", () => {
  assert.match(source, /Non usare qui il sensore mensile/);
  assert.match(source, /state_class total o total_increasing/);
});
