import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL("../src/sections/live-ui-section.js", import.meta.url);
const source = await readFile(sourceUrl, "utf8");
const {
  activeLightIds,
  configuredLightIds,
  lightIsOn,
  liveUiEventTargets,
} = await import(sourceUrl.href);

function withRuntime({ storage = {}, states = {} }, callback) {
  const previousStorage = globalThis.localStorage;
  const previousStates = globalThis.STATES;
  const previousRawStates = globalThis._RAW_STATES;
  const values = new Map(Object.entries(storage));
  globalThis.localStorage = {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
  globalThis.STATES = states;
  globalThis._RAW_STATES = states;
  try {
    return callback();
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
    if (previousStates === undefined) delete globalThis.STATES;
    else globalThis.STATES = previousStates;
    if (previousRawStates === undefined) delete globalThis._RAW_STATES;
    else globalThis._RAW_STATES = previousRawStates;
  }
}

test("configured lights use the same persisted registry as the editor and honor removals", () => {
  withRuntime(
    {
      storage: {
        cd_luci: JSON.stringify({
          "light.salone": "Salone",
          "switch.camera": "Camera",
        }),
        cd_gruppi_extra: JSON.stringify({ luci: ["light.corridoio", "light.salone"] }),
        cd_gruppi_removed: JSON.stringify({ luci: ["switch.camera"] }),
      },
    },
    () => {
      assert.deepEqual(configuredLightIds().sort(), ["light.corridoio", "light.salone"]);
    },
  );
});

test("light alert state reacts immediately to the ingested Home Assistant state", () => {
  withRuntime(
    {
      storage: {
        cd_luci: JSON.stringify({
          "light.salone": "Salone",
          "light.camera": "Camera",
        }),
      },
      states: {
        "light.salone": { state: "on", attributes: {} },
        "light.camera": { state: "off", attributes: {} },
      },
    },
    () => {
      assert.equal(lightIsOn("light.salone"), true);
      assert.equal(lightIsOn("light.camera"), false);
      assert.deepEqual(activeLightIds(), ["light.salone"]);
    },
  );
});

test("live UI filters unrelated Home Assistant events", () => {
  withRuntime(
    {
      storage: {
        cd_luci: JSON.stringify({ "light.salone": "Salone" }),
        cd_cameras: JSON.stringify([{ entity: "camera.salone", name: "Salone" }]),
      },
    },
    () => {
      assert.deepEqual(
        liveUiEventTargets({ detail: { entity_id: "sensor.unrelated" } }),
        { lights: false, cameras: false },
      );
      assert.deepEqual(
        liveUiEventTargets({ detail: { entity_id: "light.salone" } }),
        { lights: true, cameras: false },
      );
      assert.deepEqual(
        liveUiEventTargets({ detail: { entity_id: "camera.salone" } }),
        { lights: false, cameras: true },
      );
    },
  );
});

test("canonical live UI owns camera refresh without introducing another polling loop", () => {
  assert.doesNotMatch(source, /setInterval\s*\(/);
  assert.match(source, /root\.clearInterval\?\.\(root\.camInterval\)/);
  assert.match(source, /root\.refreshCameras = refreshCamerasCanonical/);
  assert.match(source, /dashboardmodern:state-changed/);
});
