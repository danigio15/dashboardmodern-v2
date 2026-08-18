import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const guardUrl = new URL("../src/sections/beta17-final-icon-polish-section.js", import.meta.url);
const layoutUrl = new URL("../src/sections/temperature-layout-section.js", import.meta.url);

test("configured Temperature rows restore the canonical room name beside the icon", async () => {
  const source = await readFile(guardUrl, "utf8");
  assert.match(source, /function ensureTemperatureRowMain\(row, room\)/);
  assert.match(source, /primary\.textContent = name/);
  assert.match(source, /data-temperature-room\]\[data-room-id\]/);
  assert.match(source, /dmTemperatureNameVisible/);
  assert.match(source, /style\.setProperty\("display", "block", "important"\)/);
});

test("Temperature editor exposes and persists custom display names for both entities", async () => {
  const source = await readFile(guardUrl, "utf8");
  assert.match(source, /dm-temperature-name/);
  assert.match(source, /dm-humidity-name/);
  assert.match(source, /temp_name/);
  assert.match(source, /hum_name/);
  assert.match(source, /pendingLabels/);
  assert.match(source, /store\.updateItem\("rooms", id, patch\)/);
});

test("custom Temperature entity names are projected onto live dashboard labels", async () => {
  const { temperatureCardLabels } = await import("../src/sections/shared.js");
  const room = {
    temp_name: "Temperatura Camera",
    hum_name: "Umidità Camera",
  };

  // The first association carries the room's custom names.
  assert.deepEqual(temperatureCardLabels(room), {
    temperature: "Temperatura Camera",
    humidity: "Umidità Camera",
  });
  assert.deepEqual(temperatureCardLabels(room, { id: "primary" }), {
    temperature: "Temperatura Camera",
    humidity: "Umidità Camera",
  });

  // An extra probe carries its own name, never the room's — that is what used
  // to make the label flip between the two on every repaint.
  assert.deepEqual(
    temperatureCardLabels(room, { id: "temperature-extra-1", name: "Seconda sonda" }),
    {
      temperature: "Seconda sonda",
      humidity: "Umidità",
    },
  );
  assert.deepEqual(temperatureCardLabels(room, { id: "temperature-extra-1" }), {
    temperature: "Temperatura",
    humidity: "Umidità",
  });
  assert.deepEqual(temperatureCardLabels({}), {
    temperature: "Temperatura",
    humidity: "Umidità",
  });
});

test("the label above the reading has a single owner", async () => {
  const guard = await readFile(guardUrl, "utf8");
  for (const name of [
    "temperature-section.js",
    "beta25-real-device-fixes-section.js",
    "beta26-real-device-stability-section.js",
  ]) {
    const source = await readFile(new URL(`../src/sections/${name}`, import.meta.url), "utf8");
    assert.match(source, /temperatureCardLabels\(/, name);
    // No renderer may hard-code the generic word beside the reading any more.
    assert.doesNotMatch(source, /"cp-temp-current-lbl", english\(\)/, name);
  }
  // The Beta 17 pass keeps its editor repairs and no longer writes card labels.
  assert.doesNotMatch(guard, /repairTemperatureDashboardLabels/);
  assert.match(guard, /function repairTemperatureEditor\(\)/);
});

test("Beta20 label hardening reuses an existing scoped owner and keeps the layout shim passive", async () => {
  const source = await readFile(guardUrl, "utf8");
  const layout = await readFile(layoutUrl, "utf8");
  assert.doesNotMatch(source, /setInterval\s*\(/);
  assert.match(source, /store\.subscribe/);
  assert.match(source, /requestAnimationFrame/);
  assert.match(layout, /return false/);
  assert.doesNotMatch(layout, /installStyle|setInterval|MutationObserver|querySelector|innerHTML/);
});
test("the comfort pill carries a short unavailable label and keeps the full wording", async () => {
  const { comfortBadgeText } = await import("../src/sections/shared.js");
  // The pill is sized for a word like CALDO; "Non disponibile" is the only label
  // long enough to paint out of it and over the room name beside it.
  assert.equal(comfortBadgeText("Non disponibile"), "N/D");
  assert.equal(comfortBadgeText("Unavailable"), "N/D");
  for (const label of ["Caldo", "Comfort", "Freddo"]) assert.equal(comfortBadgeText(label), label);

  // Every renderer of the pill shows the short form while `title`, `aria-label`
  // and `data-comfort` keep the full label the badge colours key off.
  for (const name of [
    "temperature-section.js",
    "beta25-real-device-fixes-section.js",
    "beta26-real-device-stability-section.js",
  ]) {
    const source = await readFile(new URL(`../src/sections/${name}`, import.meta.url), "utf8");
    assert.match(source, /comfort\.textContent = comfortBadgeText\(label\)/, name);
    assert.match(source, /comfort\.title = label/, name);
    assert.match(source, /comfort\.dataset\.comfort = label\.toLowerCase\(\)/, name);
  }
});

test("Temperature cards are theme-safe and cannot spill out of their own box", async () => {
  const source = await readFile(
    new URL("../src/sections/temperature-section.js", import.meta.url),
    "utf8",
  );

  // --ha-card-background only exists inside Home Assistant. Mixing against it
  // with a #fff fallback painted white cards under light text in dark theme.
  assert.match(source, /--dm-temp-surface:var\(--ha-card-background,var\(--card-bg,#fff\)\)/);
  assert.doesNotMatch(source, /color-mix\([^)]*var\(--ha-card-background,#fff\)/);

  // A long room name grew the card's own grid track and pushed the state pill
  // past the border, so the track is capped and the name shrinks instead.
  assert.match(source, /grid-template-columns:minmax\(0,1fr\)!important/);
  assert.match(source, /\.cp-name[^{]*\{flex:1 1 0!important;min-width:0!important/);

  // The comfort state colours the tile, and the reading carries a degree mark
  // that goes away on a card with nothing to show.
  for (const state of ["freddo", "cold", "comfort", "caldo", "hot"])
    assert.match(source, new RegExp(`data-comfort="${state}"\\]\\)`), state);
  assert.match(source, /\.cp-temp-current::after\{content:"°"!important/);
  assert.match(source, /data-comfort="non-disponibile"\]\) \.cp-temp-current::after/);
});

test("the reading is projected onto the card so the sheet can draw it", async () => {
  const { applyTemperatureReading } = await import("../src/sections/shared.js");
  const card = {
    dataset: {},
    style: {
      values: {},
      setProperty(name, value) {
        this.values[name] = value;
      },
      removeProperty(name) {
        delete this.values[name];
      },
    },
  };

  // The comfort scale spans 10-32 °C, so 21 °C sits halfway along it.
  applyTemperatureReading(card, 21, 54);
  assert.equal(card.style.values["--dm-temp-pos"], "50.0");
  assert.equal(card.style.values["--dm-hum"], "54");
  assert.equal(card.dataset.dmReading, "on");
  assert.equal(card.dataset.dmHumidity, "on");

  // Readings outside the scale pin to its ends instead of running off the card.
  applyTemperatureReading(card, -4, 140);
  assert.equal(card.style.values["--dm-temp-pos"], "0.0");
  assert.equal(card.style.values["--dm-hum"], "100");
  applyTemperatureReading(card, 48, 0);
  assert.equal(card.style.values["--dm-temp-pos"], "100.0");

  // Nothing to draw when the sensor has nothing to say.
  applyTemperatureReading(card, null, null);
  assert.equal(card.style.values["--dm-temp-pos"], undefined);
  assert.equal(card.style.values["--dm-hum"], undefined);
  assert.equal(card.dataset.dmReading, "off");
  assert.equal(card.dataset.dmHumidity, "off");

  // Every renderer hands its reading to the same function.
  for (const name of [
    "temperature-section.js",
    "beta25-real-device-fixes-section.js",
    "beta26-real-device-stability-section.js",
  ]) {
    const source = await readFile(new URL(`../src/sections/${name}`, import.meta.url), "utf8");
    assert.match(source, /applyTemperatureReading\(card/, name);
  }
});
