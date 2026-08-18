import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  trendGeometry,
  trendSeriesModel,
} from "../src/sections/temperature-trend-section.js";

const rooms = [
  {
    id: "room-cameretta",
    name: "Cameretta",
    temp: "sensor.cameretta_temperature",
    temp_name: "Cameretta",
    metadata: {
      temperature_entries: [
        { id: "temperature-extra-1", name: "Seconda sonda", temp: "sensor.seconda_temperature" },
      ],
    },
  },
  { id: "room-salone", name: "Salone", temp: "sensor.salone_temperature" },
  { id: "room-vuota", name: "Ripostiglio" },
];

test("a room draws its own probes, all rooms draw one line each", () => {
  const room = trendSeriesModel(rooms, "room-cameretta");
  assert.equal(room.title, "Cameretta");
  assert.deepEqual(
    room.series.map((item) => [item.name, item.entity]),
    [
      ["Cameretta", "sensor.cameretta_temperature"],
      ["Seconda sonda", "sensor.seconda_temperature"],
    ],
  );

  const all = trendSeriesModel(rooms, "all");
  assert.equal(all.title, "Tutte le stanze");
  // One line per configured room — the extra probe belongs to the room view —
  // and a room without sensors is not a line with nothing in it.
  assert.deepEqual(
    all.series.map((item) => [item.name, item.entity]),
    [
      ["Cameretta", "sensor.cameretta_temperature"],
      ["Salone", "sensor.salone_temperature"],
    ],
  );
  assert.deepEqual(trendSeriesModel(rooms, "room-inesistente").series, []);
});

function series(values, window) {
  const step = (window.end - window.start) / (values.length - 1);
  return [
    {
      id: "s",
      name: "s",
      colour: "14,165,233",
      rows: values.map((value, index) => ({
        state: String(value),
        time: window.start + index * step,
      })),
    },
  ];
}

test("the chart scales to the readings and keeps the comfort band honest", () => {
  const end = 1_760_000_000_000;
  const window = { start: end - 24 * 60 * 60 * 1000, end, hours: 24 };
  const view = { width: 600, height: 250, left: 38, right: 54, top: 14, bottom: 24 };

  // A room that spent the day between 26° and 32° gets the whole height, and the
  // comfort band is then only partly in view instead of squashing the curve.
  const hot = trendGeometry(series([26, 29, 32], window), window, view);
  assert.ok(hot.min > 24 && hot.max < 34, `${hot.min}..${hot.max}`);
  assert.equal(hot.band.visible, true);
  assert.ok(hot.band.top >= view.top);

  // A cellar far below the band never draws it at all.
  const cold = trendGeometry(series([9, 9.4, 9.2], window), window, view);
  assert.equal(cold.band.visible, false);

  // A flat day still gets a readable line instead of collapsing onto an edge.
  const flat = trendGeometry(series([21, 21, 21], window), window, view);
  // 0.4 of padding on each side, give or take floating point
  assert.ok(flat.max - flat.min > 0.75, String(flat.max - flat.min));
  assert.ok(flat.series[0].line.startsWith("M"));
  assert.equal(flat.series[0].low, 21);
  assert.equal(flat.series[0].high, 21);

  // Nothing to draw with a single sample, and nothing to crash on either.
  assert.equal(trendGeometry(series([21], window), window, view), null);
  assert.equal(trendGeometry([], window, view), null);
});

test("the panel is one owner that reads the selection instead of copying it", async () => {
  const source = await readFile(
    new URL("../src/sections/temperature-trend-section.js", import.meta.url),
    "utf8",
  );
  // The tab strip owns the room selection; a second copy of that state is how
  // the filter broke in the first place.
  assert.match(source, /dm-beta16-temperature-tabs .dm-beta27-temperature-tab.active/);
  assert.doesNotMatch(source, /setInterval|MutationObserver/);
  // The history transport is the one the card popup already uses.
  assert.match(source, /history\/history_during_period/);
  assert.match(source, /normalizeHistoryRows/);
});
