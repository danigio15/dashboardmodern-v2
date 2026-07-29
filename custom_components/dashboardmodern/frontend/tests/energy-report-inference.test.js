import assert from "node:assert/strict";
import test from "node:test";

import { canonicalReportDevices, reportEntityForDevice } from "../src/core/energy-projection.js";
import { inferApplianceEntity, isGeneratedRoomName } from "../legacy/mobile-ui-fixes.js";

test("infers a report entity from a generic kWh appliance entity", () => {
  const states = {
    "sensor.forno_consumo": {
      state: "12.4",
      attributes: { unit_of_measurement: "kWh" },
    },
  };
  const appliance = {
    id: "appliance-forno",
    name: "Forno",
    entities: ["sensor.forno_consumo"],
    show_in_report: true,
  };

  assert.equal(reportEntityForDevice(appliance, states), "sensor.forno_consumo");
  assert.deepEqual(canonicalReportDevices([appliance], [], states), [
    {
      key: "appliance-forno",
      name: "Forno",
      icon: "⚡",
      entity: "sensor.forno_consumo",
      history: "sensor.forno_consumo",
    },
  ]);
});

test("prefers an explicit monthly report entity", () => {
  const appliance = {
    id: "appliance-forno",
    name: "Forno",
    entities: ["sensor.forno_power", "sensor.forno_totale"],
    monthly_energy_entity: "sensor.forno_mese",
    show_in_report: true,
  };

  assert.equal(reportEntityForDevice(appliance, {}), "sensor.forno_mese");
});

test("uses entity naming as fallback when HA state metadata is not loaded", () => {
  const appliance = {
    id: "appliance-forno",
    name: "Forno",
    entities: ["sensor.forno_energia_totale"],
    show_in_report: true,
  };

  assert.equal(reportEntityForDevice(appliance, {}), "sensor.forno_energia_totale");
});

test("does not expose a power-only appliance as an energy report item", () => {
  const states = {
    "sensor.forno_power": {
      state: "850",
      attributes: { unit_of_measurement: "W" },
    },
  };
  const appliance = {
    id: "appliance-forno",
    name: "Forno",
    entities: ["sensor.forno_power"],
    show_in_report: true,
  };

  assert.equal(reportEntityForDevice(appliance, states), "");
  assert.deepEqual(canonicalReportDevices([appliance], [], states), []);
});

test("Forno in Salone selects kWh and never W for the canonical Report", () => {
  const states = {
    "sensor.forno_power": {
      state: "1850",
      attributes: { unit_of_measurement: "W" },
    },
    "sensor.forno_energy": {
      state: "3.7",
      attributes: { unit_of_measurement: "kWh" },
    },
  };
  const forno = {
    id: "appliance-forno",
    name: "Forno",
    room_id: "room-salone",
    device_type: "forno",
    report_entity: "sensor.forno_power",
    energy_entity: "sensor.forno_energy",
    entities: ["sensor.forno_power", "sensor.forno_energy"],
    show_in_report: true,
    report_icon: "mdi:stove",
  };

  assert.equal(reportEntityForDevice(forno, states), "sensor.forno_energy");
  const report = canonicalReportDevices([forno], [], states);
  assert.equal(report.length, 1);
  assert.equal(report[0].name, "Forno");
  assert.equal(report[0].icon, "mdi:stove");
  assert.equal(report[0].entity, "sensor.forno_energy");
});

test("show_in_report defaults to enabled for migrated appliances", () => {
  const appliance = {
    id: "appliance-forno",
    name: "Forno",
    entities: ["sensor.forno_kwh"],
  };

  assert.equal(canonicalReportDevices([appliance], [], {})[0].entity, "sensor.forno_kwh");
});

test("mobile runtime identifies generated ghost room labels", () => {
  assert.equal(isGeneratedRoomName("ROOM_MS4FXRS8"), true);
  assert.equal(isGeneratedRoomName("room-ms4fxrs8"), true);
  assert.equal(isGeneratedRoomName("Salone"), false);
});

test("appliance entity inference distinguishes energy from power", () => {
  const device = { entities: ["sensor.forno_assorbimento", "sensor.forno_totale"] };
  const states = {
    "sensor.forno_assorbimento": { attributes: { unit_of_measurement: "W" } },
    "sensor.forno_totale": { attributes: { unit_of_measurement: "kWh" } },
  };
  assert.equal(inferApplianceEntity(device, states, "power"), "sensor.forno_assorbimento");
  assert.equal(inferApplianceEntity(device, states, "energy"), "sensor.forno_totale");
});
