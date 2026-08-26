// DM-FIX-20260812B
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalClimateType, normalizeDevice } from "../src/core/device-model.js";
import { readClimateUnits, root } from "../src/sections/shared.js";
import { migrateClimateTypes } from "../src/sections/unified-editors-section.js";

test("canonicalClimateType maps only heat aliases to termo", () => {
  for (const value of ["termostato", "thermostat", "heat", "heating", "caldo", "TERMO"])
    assert.equal(canonicalClimateType(value), "termo");
  for (const value of ["clima", "", undefined, "condizionatore"])
    assert.equal(canonicalClimateType(value), "clima");
});

test("heat pump aliases become the third canonical type, pompa", () => {
  for (const value of ["pompa", "pompa_di_calore", "heat_pump", "heatpump", "both", "POMPA"])
    assert.equal(canonicalClimateType(value), "pompa");
  // And it survives the round trips that used to flatten everything to clima.
  assert.equal(normalizeDevice({ type: "heat_pump" }, "climate").type, "pompa");
  const previous = root.localStorage;
  root.localStorage = { getItem: () => JSON.stringify([{ id: "one", type: "pompa" }]) };
  assert.deepEqual(readClimateUnits(), [{ id: "one", type: "pompa" }]);
  root.localStorage = previous;
});

test("normalizeDevice always emits a canonical climate type", () => {
  assert.equal(normalizeDevice({ type: "thermostat" }, "climate").type, "termo");
  assert.equal(normalizeDevice({ type: "other" }, "climate").type, "clima");
});

test("readClimateUnits canonicalizes persisted values", () => {
  const previous = root.localStorage;
  root.localStorage = { getItem: () => JSON.stringify([{ id: "one", type: "caldo" }]) };
  assert.deepEqual(readClimateUnits(), [{ id: "one", type: "termo" }]);
  root.localStorage = previous;
});

test("migrateClimateTypes preserves fields, converges and is idempotent", () => {
  const previous = root.localStorage;
  let stored = JSON.stringify([{ id: "one", name: "Sala", type: "termostato" }]);
  root.localStorage = {
    getItem: () => stored,
    setItem: (_key, value) => { stored = value; },
  };
  assert.equal(migrateClimateTypes(), true);
  assert.deepEqual(JSON.parse(stored), [{ id: "one", name: "Sala", type: "termo" }]);
  assert.equal(migrateClimateTypes(), false);
  root.localStorage = previous;
});
