// DM-FIX-20260817A
import assert from "node:assert/strict";
import test from "node:test";

import { ALLOWED_MESSAGE_TYPES } from "../src/legacy/bridge-socket.js";

globalThis.addEventListener = () => {};
const {
  configProfileFor,
  meaningfulConfigValues,
  normalizeSharedSnapshot,
  sanitizeProfile,
  sharedReconcileAction,
} = await import("../src/sections/config-persistence-section.js");

const configured = (name = "Cucina") => ({
  dm_dashboard_state: JSON.stringify({
    schema_version: 4,
    sections: { rooms: [{ id: "r1", name }] },
  }),
  cd_stanze: JSON.stringify([{ id: "r1", name, temp: "sensor.t" }]),
});

const emptyPlancia = () => ({
  dm_dashboard_state: JSON.stringify({
    schema_version: 4,
    sections: { rooms: [] },
    visibility: {},
  }),
  cd_sections: JSON.stringify({ temp: true }),
  cd_stanze: "[]",
});

const snapshotOf = (values, extra = {}) => ({
  revision: 3,
  updated_at: 5000,
  keys_revision: 2,
  values,
  ...extra,
});

test("the shared configuration transport is permitted through the hosted bridge", () => {
  for (const type of [
    "dashboardmodern/config/get",
    "dashboardmodern/config/set",
    "dashboardmodern/config/restore",
  ])
    assert.ok(ALLOWED_MESSAGE_TYPES.includes(type), `${type} must cross the bridge`);
});

test("the storage profile never contains the entry id and is never invented", () => {
  // The integration supplies it; the primary plancia has a fixed name.
  assert.equal(configProfileFor({ profile: "plancia-mare" }), "plancia-mare");
  assert.equal(configProfileFor({ profile: "", primary: true }), "primary");
  // A secondary plancia without an explicit profile keeps the historical
  // per-user transport instead of writing a guessed key.
  assert.equal(configProfileFor({ profile: "", primary: false }), "");
  assert.equal(sanitizeProfile("Casa / mare! 12"), "Casamare12");
});

test("visibility flags alone are not a configured plancia", () => {
  assert.equal(meaningfulConfigValues(configured()), true);
  assert.equal(meaningfulConfigValues(emptyPlancia()), false);
  assert.equal(meaningfulConfigValues({}), false);
});

test("a shared snapshot keeps only known string configuration keys", () => {
  const normalized = normalizeSharedSnapshot({
    revision: "7",
    updated_at: "1000",
    keys_revision: "2",
    reset: true,
    values: { cd_stanze: "[]", unknown_key: "x", cd_loads: 5 },
  });
  assert.deepEqual(normalized, {
    revision: 7,
    updated_at: 1000,
    keys_revision: 2,
    reset: true,
    values: { cd_stanze: "[]" },
  });
  assert.equal(normalizeSharedSnapshot(null), null);
  assert.equal(normalizeSharedSnapshot({ revision: 1 }), null);
});

test("a fresh device adopts the shared configuration instead of showing an empty plancia", () => {
  assert.equal(
    sharedReconcileAction({
      snapshot: snapshotOf(configured()),
      local: {},
      localConfigured: false,
    }),
    "restore-remote",
  );
});

test("an unconfigured device never pushes over the shared configuration", () => {
  // This is the wipe: pending local writes on a device that holds nothing.
  assert.notEqual(
    sharedReconcileAction({
      snapshot: snapshotOf(configured()),
      local: emptyPlancia(),
      localConfigured: false,
      pendingAt: Date.now(),
      syncedRevision: 3,
    }),
    "push-local",
  );
});

test("local edits win only when they were made on top of the stored revision", () => {
  const local = configured("Salotto");
  assert.equal(
    sharedReconcileAction({
      snapshot: snapshotOf(configured("Cucina")),
      local,
      localConfigured: true,
      pendingAt: 9000,
      syncedRevision: 3,
    }),
    "push-local",
  );
  // Another device wrote after this one last synchronized: its snapshot wins,
  // regardless of what this device's clock says.
  assert.equal(
    sharedReconcileAction({
      snapshot: snapshotOf(configured("Cucina")),
      local,
      localConfigured: true,
      pendingAt: Number.MAX_SAFE_INTEGER,
      syncedRevision: 2,
    }),
    "restore-remote",
  );
});

test("identical copies are left alone", () => {
  assert.equal(
    sharedReconcileAction({
      snapshot: snapshotOf(configured()),
      local: configured(),
      localConfigured: true,
      pendingAt: 9000,
      syncedRevision: 1,
    }),
    "in-sync",
  );
});

test("an already emptied installation is repaired from the kept revision", () => {
  assert.equal(
    sharedReconcileAction({
      snapshot: snapshotOf(emptyPlancia()),
      recoverable: [{ revision: 2, updated_at: 4000 }],
      local: emptyPlancia(),
      localConfigured: false,
    }),
    "auto-recover",
  );
});

test("an explicit reset is never undone behind the user's back", () => {
  assert.equal(
    sharedReconcileAction({
      snapshot: snapshotOf(emptyPlancia(), { reset: true }),
      recoverable: [{ revision: 2, updated_at: 4000 }],
      local: emptyPlancia(),
      localConfigured: false,
    }),
    "none",
  );
});

test("the first configured device seeds an empty shared store", () => {
  assert.equal(
    sharedReconcileAction({ snapshot: null, local: configured(), localConfigured: true }),
    "push-local",
  );
  assert.equal(sharedReconcileAction({ snapshot: null, localConfigured: false }), "none");
  // A shared store that exists but is empty is filled by a configured device.
  assert.equal(
    sharedReconcileAction({
      snapshot: snapshotOf(emptyPlancia()),
      local: configured(),
      localConfigured: true,
    }),
    "push-local",
  );
});
