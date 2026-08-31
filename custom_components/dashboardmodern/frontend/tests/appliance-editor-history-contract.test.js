import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../src/sections/appliance-editor-section.js", import.meta.url), "utf8");

test("appliance editor never copies monthly energy into lifetime history", () => {
  assert.match(source, /history_entity:\s*total,/);
  assert.doesNotMatch(source, /history_entity:\s*total\s*\|\|\s*clean\(values\.monthly_energy_entity\)/);
});

test("editing the lifetime meter preserves an independent current-period Report source", () => {
  assert.match(source, /const existingReport = clean\(device\.report_entity\)/);
  assert.match(source, /report_entity:\s*existingReport\s*\|\|\s*total,/);
  assert.doesNotMatch(source, /report_entity:\s*total,/);
});

test("legacy history only prefills Total energy when it is actually cumulative", () => {
  /* Prettier puo' andare a capo dopo l'uguale: la sentinella guarda la
   * sostanza — le tre caselle, in quest'ordine — non l'impaginazione. */
  assert.match(
    source,
    /const totalInitial =\s*\[device\.total_energy_entity, device\.history_entity, device\.report_entity\]/,
  );
  assert.match(source, /\.find\(cumulativeEntity\)/);
  assert.doesNotMatch(source, /device\.total_energy_entity \|\| device\.history_entity/);
});

test("total-energy help explicitly rejects the monthly sensor role", () => {
  assert.match(source, /Non usare qui il sensore mensile/);
  assert.match(source, /state_class total o total_increasing/);
});
