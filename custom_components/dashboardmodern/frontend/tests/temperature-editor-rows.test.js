import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

function row() {
  return {
    dataset: {},
    querySelector() {
      return null;
    },
  };
}

test("Temperature configured rows are tagged in store order, including numeric legacy ids", async () => {
  const temperatureRows = [row(), row()];
  const unrelatedRow = row();
  globalThis.document = {
    readyState: "loading",
    addEventListener() {},
    querySelectorAll(selector) {
      assert.equal(
        selector,
        "#editor-modal #ed-body .ed-list > .ed-row:has(> .dm-temperature-card-icon)",
      );
      return temperatureRows;
    },
  };
  globalThis.DashboardModernModules = {
    store: {
      getSection(name) {
        assert.equal(name, "rooms");
        return [
          { id: 17, name: "Cucina", temp: "sensor.cucina_temp", hum: "sensor.cucina_hum" },
          { id: "room-studio", name: "Studio", temp: "sensor.studio_temp", hum: "sensor.studio_hum" },
        ];
      },
    },
  };

  const { tagTemperatureEditorRows } = await import(
    `../src/sections/temperature-section.js?temperature-row-tagger=${Date.now()}`
  );
  assert.equal(tagTemperatureEditorRows(), true);
  assert.deepEqual(temperatureRows[0].dataset, {
    temperatureRoom: "true",
    roomId: "17",
    dmTemperatureNameVisible: "true",
  });
  assert.deepEqual(temperatureRows[1].dataset, {
    temperatureRoom: "true",
    roomId: "room-studio",
    dmTemperatureNameVisible: "true",
  });
  assert.deepEqual(unrelatedRow.dataset, {});

  const consumers = await Promise.all([
    readFile(new URL("../src/sections/beta17-final-icon-polish-section.js", import.meta.url), "utf8"),
    readFile(new URL("../src/sections/beta16-real-device-layout-section.js", import.meta.url), "utf8"),
  ]);
  assert.match(consumers[0], /ensureTemperatureRowMain\(row, room\)/);
  assert.match(consumers[1], /ensureRowMain\(row, anchor\)/);
  assert.match(consumers.join("\n"), /\.ed-row-main/);
  assert.match(consumers.join("\n"), /room\.name/);
  assert.match(consumers.join("\n"), /room\.temp/);
  assert.match(consumers.join("\n"), /room\.hum/);
});
