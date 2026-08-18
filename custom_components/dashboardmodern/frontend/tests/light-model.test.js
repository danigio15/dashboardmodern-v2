/* What a configured light can do, and what the dashboard asks Home Assistant
 * to do about it. The controls are built from these answers, so a wrong one is
 * a missing dimmer or a rejected service call on a real installation. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_MAX_KELVIN,
  DEFAULT_MIN_KELVIN,
  LIGHT_DOMAINS,
  brightnessToPercent,
  entityDomain,
  hexToRgb,
  hsvToRgb,
  isLightEntity,
  kelvinToHex,
  lightColorHex,
  lightCommand,
  lightControls,
  lightSummary,
  lightView,
  lightsSignature,
  readableInk,
  rgbToHex,
  rgbToHsv,
} from "../src/core/light-model.js";

const rgbLamp = {
  state: "on",
  attributes: {
    friendly_name: "Strip salone",
    supported_color_modes: ["hs", "color_temp"],
    color_mode: "hs",
    brightness: 128,
    rgb_color: [255, 0, 0],
    min_color_temp_kelvin: 2202,
    max_color_temp_kelvin: 6535,
    effect_list: ["Arcobaleno", "Fuoco"],
    effect: "Fuoco",
  },
};
const dimmer = {
  state: "on",
  attributes: { supported_color_modes: ["brightness"], brightness: 255 },
};
const relay = { state: "off", attributes: { friendly_name: "Lampada garage" } };

test("a light may be a light, a switch or anything the wizard has ever written", () => {
  assert.deepEqual(LIGHT_DOMAINS, ["light", "switch", "input_boolean", "fan", "group"]);
  assert.ok(isLightEntity("light.salone"));
  assert.ok(isLightEntity("switch.lampada_garage"));
  assert.ok(isLightEntity("input_boolean.luce_finta"));
  // The legacy wizard has always accepted these, so the editor cannot reject
  // a light that is already configured.
  assert.ok(isLightEntity("fan.ventola_luce"));
  assert.ok(isLightEntity("group.luci_piano_terra"));
  assert.equal(isLightEntity("sensor.lux"), false);
  assert.equal(isLightEntity("light."), false);
  assert.equal(isLightEntity("salone"), false);
  assert.equal(entityDomain("switch.x"), "switch");
  assert.equal(entityDomain("nonsense"), "");
});

test("capabilities come from the entity, never from the domain", () => {
  const rgb = lightView("light.strip", { state: rgbLamp });
  assert.deepEqual(
    { dimmable: rgb.dimmable, colorful: rgb.colorful, tunable: rgb.tunable },
    { dimmable: true, colorful: true, tunable: true },
  );
  assert.deepEqual(lightControls(rgb), ["power", "brightness", "color", "white", "effect"]);
  assert.equal(rgb.brightness, 50);
  assert.deepEqual(rgb.effects, ["Arcobaleno", "Fuoco"]);

  const dim = lightView("light.faretti", { state: dimmer });
  assert.deepEqual(lightControls(dim), ["power", "brightness"]);
  assert.equal(dim.brightness, 100);

  // A lamp behind a relay is a light on this dashboard and an on/off entity to
  // Home Assistant: it gets a power button and nothing that would be rejected.
  const plain = lightView("switch.lampada_garage", { state: relay });
  assert.deepEqual(lightControls(plain), ["power"]);
  assert.equal(plain.name, "Lampada garage");
  assert.equal(plain.on, false);
  assert.equal(plain.available, true);
});

test("a pre-2021 integration keeps its dimmer through the legacy feature bits", () => {
  const legacy = lightView("light.vecchia", {
    state: { state: "on", attributes: { supported_features: 1 | 2 | 16, brightness: 51 } },
  });
  assert.equal(legacy.dimmable, true);
  assert.equal(legacy.colorful, true);
  assert.equal(legacy.tunable, true);
  assert.equal(legacy.brightness, 20);
});

test("a configured light with no entity is unavailable, not absent", () => {
  const missing = lightView("light.staccata", { name: "Staccata" });
  assert.equal(missing.available, false);
  assert.equal(missing.on, false);
  assert.equal(missing.name, "Staccata");
  const unknown = lightView("light.x", { state: { state: "unavailable", attributes: {} } });
  assert.equal(unknown.available, false);
});

test("brightness is reported the way it is set: 1-100, and never 0 while lit", () => {
  assert.equal(brightnessToPercent(255), 100);
  assert.equal(brightnessToPercent(128), 50);
  assert.equal(brightnessToPercent(1), 1);
  assert.equal(brightnessToPercent(0), null);
  assert.equal(brightnessToPercent(undefined), null);
});

test("the kelvin range follows the lamp, in kelvin or in mireds", () => {
  const kelvin = lightView("light.a", {
    state: {
      state: "on",
      attributes: {
        supported_color_modes: ["color_temp"],
        min_color_temp_kelvin: 2700,
        max_color_temp_kelvin: 6500,
        color_temp_kelvin: 3000,
      },
    },
  });
  assert.deepEqual([kelvin.minKelvin, kelvin.maxKelvin, kelvin.kelvin], [2700, 6500, 3000]);

  const mireds = lightView("light.b", {
    state: {
      state: "on",
      attributes: {
        supported_color_modes: ["color_temp"],
        min_mireds: 153,
        max_mireds: 500,
        color_temp: 250,
      },
    },
  });
  assert.equal(mireds.minKelvin, 2000);
  assert.equal(mireds.maxKelvin, 6536);
  assert.equal(mireds.kelvin, 4000);

  const none = lightView("light.c", {
    state: { state: "on", attributes: { supported_color_modes: ["color_temp"] } },
  });
  assert.deepEqual([none.minKelvin, none.maxKelvin], [DEFAULT_MIN_KELVIN, DEFAULT_MAX_KELVIN]);
});

test("the card colour is the lamp's own, and amber only when there is none", () => {
  assert.equal(lightColorHex(lightView("light.strip", { state: rgbLamp })), "#ff0000");
  const white = lightView("light.w", {
    state: {
      state: "on",
      attributes: {
        supported_color_modes: ["color_temp"],
        color_mode: "color_temp",
        color_temp_kelvin: 2700,
      },
    },
  });
  assert.equal(lightColorHex(white), kelvinToHex(2700));
  assert.equal(lightColorHex(lightView("switch.x", { state: relay })), "#f59e0b");
});

test("colour conversions round-trip", () => {
  assert.equal(rgbToHex([255, 0, 0]), "#ff0000");
  assert.deepEqual(hexToRgb("#00ff80"), [0, 255, 128]);
  assert.deepEqual(hexToRgb("#0f8"), [0, 255, 136]);
  assert.deepEqual(hexToRgb("nonsense"), [255, 255, 255]);
  assert.deepEqual(hsvToRgb(0, 100, 100), [255, 0, 0]);
  assert.deepEqual(hsvToRgb(120, 100, 100), [0, 255, 0]);
  assert.deepEqual(hsvToRgb(240, 100, 100), [0, 0, 255]);
  assert.deepEqual(hsvToRgb(0, 0, 100), [255, 255, 255]);
  assert.deepEqual(rgbToHsv([255, 0, 0]), [0, 100, 100]);
  assert.deepEqual(rgbToHsv([0, 0, 255]), [240, 100, 100]);
  // The hue slider sets a colour, the sheet reads it back: what comes out has
  // to be the hue that went in, or the handle jumps on the next repaint.
  for (const hue of [0, 37, 120, 210, 300, 359]) {
    assert.equal(rgbToHsv(hsvToRgb(hue, 100, 100))[0], hue);
  }
  // Tungsten is warm and daylight is cold; both would be white without the
  // black-body curve.
  const warm = hexToRgb(kelvinToHex(2200));
  const cold = hexToRgb(kelvinToHex(6500));
  assert.ok(warm[0] > warm[2], "2200K must be redder than it is blue");
  assert.ok(cold[2] > warm[2], "6500K must be bluer than 2200K");
});

test("the ink on a coloured control follows the colour, not a constant", () => {
  // The power button and the glyph in the orb are painted on the lamp's own
  // colour: a deep blue lamp needs white ink, a pale amber one needs dark.
  assert.equal(readableInk("#2f7bff"), "#ffffff");
  assert.equal(readableInk("#ff0000"), "#ffffff");
  assert.equal(readableInk("#000000"), "#ffffff");
  assert.equal(readableInk("#f59e0b"), "#0f172a");
  assert.equal(readableInk("#ffe066"), "#0f172a");
  assert.equal(readableInk("#ffffff"), "#0f172a");
});

test("one requested change becomes one service call the entity accepts", () => {
  const rgb = lightView("light.strip", { state: rgbLamp });
  assert.deepEqual(lightCommand(rgb, { hex: "#00ff00" }), {
    domain: "light",
    service: "turn_on",
    data: { entity_id: "light.strip", rgb_color: [0, 255, 0] },
  });
  assert.deepEqual(lightCommand(rgb, { brightnessPct: 40 }), {
    domain: "light",
    service: "turn_on",
    data: { entity_id: "light.strip", brightness_pct: 40 },
  });
  assert.deepEqual(lightCommand(rgb, { effect: "Arcobaleno", power: true }), {
    domain: "light",
    service: "turn_on",
    data: { entity_id: "light.strip", effect: "Arcobaleno" },
  });
  // 0% is off, not a light burning at zero.
  assert.deepEqual(lightCommand(rgb, { brightnessPct: 0 }), {
    domain: "light",
    service: "turn_off",
    data: { entity_id: "light.strip" },
  });
  // A white point outside what the lamp reports is clamped rather than sent.
  assert.equal(lightCommand(rgb, { kelvin: 9000 }).data.color_temp_kelvin, 6535);
  assert.equal(lightCommand(rgb, { kelvin: 1000 }).data.color_temp_kelvin, 2202);
  assert.deepEqual(lightCommand(rgb, {}), {
    domain: "light",
    service: "toggle",
    data: { entity_id: "light.strip" },
  });
});

test("a switch is never asked for a colour or a brightness", () => {
  const plain = lightView("switch.lampada_garage", { state: relay });
  assert.deepEqual(lightCommand(plain, { power: true }), {
    domain: "switch",
    service: "turn_on",
    data: { entity_id: "switch.lampada_garage" },
  });
  assert.deepEqual(lightCommand(plain, { power: false }), {
    domain: "switch",
    service: "turn_off",
    data: { entity_id: "switch.lampada_garage" },
  });
  assert.deepEqual(lightCommand(plain, { hex: "#00ff00", brightnessPct: 50 }), {
    domain: "switch",
    service: "toggle",
    data: { entity_id: "switch.lampada_garage" },
  });
  // A light that reports only on/off is treated the same way: sending
  // brightness_pct to it is what makes Home Assistant refuse the call.
  const onoff = lightView("light.onoff", {
    state: { state: "on", attributes: { supported_color_modes: ["onoff"] } },
  });
  assert.deepEqual(lightCommand(onoff, { brightnessPct: 50 }).data, { entity_id: "light.onoff" });
  assert.equal(lightCommand(null, {}), null);
});

test("the popup counts what it shows and rebuilds only when its shape changes", () => {
  const views = [
    lightView("light.strip", { state: rgbLamp, room: "Salone" }),
    lightView("light.faretti", { state: dimmer, room: "Salone" }),
    lightView("switch.garage", { state: relay, room: "Garage" }),
    lightView("light.staccata", {}),
  ];
  assert.deepEqual(lightSummary(views), {
    total: 4,
    on: 2,
    unavailable: 1,
    dimmable: 2,
    colorful: 1,
  });
  const signature = lightsSignature(views);
  const dimmed = views.map((view) =>
    view.id === "light.strip" ? { ...view, brightness: 10, on: false } : view,
  );
  assert.equal(lightsSignature(dimmed), signature, "a value change must not rebuild the list");
  const renamed = views.map((view) =>
    view.id === "light.strip" ? { ...view, name: "Strip cucina" } : view,
  );
  assert.notEqual(lightsSignature(renamed), signature, "a rename must rebuild the list");
});
