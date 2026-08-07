import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const stateGate = await readFile(new URL("../src/core/state-event-gate.js", import.meta.url), "utf8");
const editorContracts = await readFile(new URL("../src/sections/editor-contracts-section.js", import.meta.url), "utf8");

test("live HA event gate filters against configured dashboard entities", () => {
  assert.match(stateGate, /configuredEntities/);
  assert.match(stateGate, /configured\.size && !configured\.has\(id\)/);
});

test("editor contract work is scheduled only for editor mutations", () => {
  assert.match(editorContracts, /if \(mutationTouchesEditor\(records\)\) schedule\(\)/);
});
