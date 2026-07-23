import assert from "node:assert/strict";
import test from "node:test";

globalThis.HTMLElement = class {};
globalThis.customElements = { get() {}, define() {} };
globalThis.window = { location: { search: "", href: "https://example.local/dashboardmodern" } };

const { createConnectionAdapter, entryIdsFromPanel, shouldNotifyHassSubscribers } = await import("../panel.js");

test("missing connection during bootstrap is reported by the adapter", () => {
  assert.throws(() => createConnectionAdapter({}), /connection is unavailable/i);
});

test("successful bootstrap uses the supported hass connection adapter", () => {
  const connection = { sendMessagePromise() {} };
  assert.equal(createConnectionAdapter({ connection }), connection);
});

test("missing config entry id yields no entry ids", () => {
  assert.deepEqual(entryIdsFromPanel({ config: {} }), []);
});

test("multiple entry selection behavior reads deterministic panel config", () => {
  assert.deepEqual(entryIdsFromPanel({ config: { entry_ids: ["b", "a"] } }), ["b", "a"]);
});

test("Home Assistant updates notify the app when the create form is closed", () => {
  assert.equal(shouldNotifyHassSubscribers({ querySelector: () => null }), true);
});

test("Home Assistant updates preserve the open create form and its focus", () => {
  assert.equal(shouldNotifyHassSubscribers({ querySelector: () => ({}) }), false);
});
