import { expect } from "@playwright/test";
import { bootNamespacedDashboard } from "./namespaced-dashboard.js";

export const consolidatedStates = [
  {
    entity_id: "sensor.terrace_temperature",
    state: "22.4",
    attributes: { unit_of_measurement: "°C", device_class: "temperature" },
  },
  {
    entity_id: "sensor.terrace_humidity",
    state: "51",
    attributes: { unit_of_measurement: "%", device_class: "humidity" },
  },
  {
    entity_id: "sensor.fridge_power",
    state: "82",
    attributes: { unit_of_measurement: "W", device_class: "power" },
  },
  { entity_id: "sensor.boiler_power", state: "2", attributes: { unit_of_measurement: "W", device_class: "power" } },
  { entity_id: "sensor.microwave_power", state: "0", attributes: { unit_of_measurement: "W", device_class: "power" } },
  { entity_id: "switch.microwave", state: "on", attributes: { friendly_name: "Microwave plug" } },
  ...[
    "house_total",
    "solar_total",
    "grid_import_total",
    "grid_export_total",
    "battery_charge_total",
    "battery_discharge_total",
    "fridge_total",
    "boiler_total",
    "microwave_total",
    "oven_total",
  ].map((name) => ({
    entity_id: `sensor.${name}`,
    state: "5000",
    attributes: {
      friendly_name: name,
      unit_of_measurement: "kWh",
      device_class: "energy",
      state_class: "total_increasing",
    },
  })),
];

export const consolidatedSeed = {
  schema_version: 4,
  sections: {
    rooms: [
      { id: "room-salone", name: "Salone", icon: "mdi:sofa" },
      {
        id: "room-terrazza",
        name: "Terrazza",
        icon: "mdi:balcony",
        temp: "sensor.terrace_temperature",
        hum: "sensor.terrace_humidity",
      },
    ],
    appliances: [
      {
        id: "appl-fridge",
        name: "Frigo",
        device_type: "fridge",
        visual_type: "asset",
        visual_key: "fridge",
        room_id: "room-salone",
        power_entity: "sensor.fridge_power",
        total_energy_entity: "sensor.fridge_total",
        entities: ["sensor.fridge_power", "sensor.fridge_total"],
        show_in_dashboard: true,
        show_in_report: true,
      },
      {
        id: "appl-boiler",
        name: "Scaldabagno",
        device_type: "water_heater",
        visual_type: "asset",
        visual_key: "boiler",
        room_id: "room-terrazza",
        total_energy_entity: "sensor.boiler_total",
        power_entity: "sensor.boiler_power",
        entities: ["sensor.boiler_power", "sensor.boiler_total"],
        show_in_dashboard: true,
        show_in_report: true,
      },
      {
        id: "appl-microwave",
        name: "Microonde",
        device_type: "microwave",
        visual_type: "asset",
        visual_key: "microwave",
        room_id: "room-salone",
        total_energy_entity: "sensor.microwave_total",
        power_entity: "sensor.microwave_power",
        control_entity: "switch.microwave",
        threshold_standby: 1,
        threshold_run: 5,
        entities: ["switch.microwave", "sensor.microwave_power", "sensor.microwave_total"],
        show_in_dashboard: true,
        show_in_report: true,
      },
      {
        id: "appl-no-history",
        name: "Ventola",
        device_type: "fan",
        room_id: "room-salone",
        entities: [],
        show_in_dashboard: true,
        show_in_report: false,
      },
      {
        id: "appl-oven",
        name: "Forno",
        device_type: "oven",
        visual_type: "asset",
        visual_key: "oven",
        room_id: "room-salone",
        total_energy_entity: "sensor.oven_total",
        entities: ["sensor.oven_total"],
        show_in_dashboard: true,
        show_in_report: true,
      },
    ],
    loads: [],
    ev: [],
    energy: {
      house: { total_energy: "sensor.house_total" },
      solar: { total_energy: "sensor.solar_total" },
      grid: {
        total_import_energy: "sensor.grid_import_total",
        total_export_energy: "sensor.grid_export_total",
      },
      battery: {
        total_charged_energy: "sensor.battery_charge_total",
        total_discharged_energy: "sensor.battery_discharge_total",
      },
      metadata: {},
    },
  },
  visibility: { energy: true, appliances: true, temperature: true, temp: true },
};

const dayValues = {
  "sensor.house_total": 5.7,
  "sensor.solar_total": 7.3,
  "sensor.grid_import_total": 0.8,
  "sensor.grid_export_total": 1.1,
  "sensor.battery_charge_total": 1.4,
  "sensor.battery_discharge_total": 0.9,
  "sensor.fridge_total": 0.7,
  "sensor.boiler_total": 0.3,
  "sensor.microwave_total": 0.1,
  "sensor.oven_total": 0,
};

// Intentionally inconsistent direct Home total (28.2) versus HA-style flows
// (50.2 + 0 + 5.5 - 7.2 - 8.6 = 39.9). The browser test must prove that
// DashboardModern displays the flow-derived value rather than trusting the
// inverter-specific direct meter.
const currentMonthValues = {
  "sensor.house_total": 28.2,
  "sensor.solar_total": 50.2,
  "sensor.grid_import_total": 0,
  "sensor.grid_export_total": 7.2,
  "sensor.battery_charge_total": 8.6,
  "sensor.battery_discharge_total": 5.5,
  "sensor.fridge_total": 4.4,
  "sensor.boiler_total": 1.2,
  "sensor.microwave_total": 0.2,
  "sensor.oven_total": 0,
};

const monthValues = {
  "sensor.house_total": 86,
  "sensor.solar_total": 90,
  "sensor.grid_import_total": 10,
  "sensor.grid_export_total": 4,
  "sensor.battery_charge_total": 8,
  "sensor.battery_discharge_total": 5,
  "sensor.fridge_total": 10.5,
  "sensor.boiler_total": 2.1,
  "sensor.microwave_total": 0.5,
  "sensor.oven_total": 0,
};

const yearValues = {
  "sensor.house_total": 760,
  "sensor.solar_total": 900,
  "sensor.grid_import_total": 100,
  "sensor.grid_export_total": 40,
  "sensor.battery_charge_total": 95,
  "sensor.battery_discharge_total": 72,
  "sensor.fridge_total": 121.5,
  "sensor.boiler_total": 28.1,
  "sensor.microwave_total": 6.5,
  "sensor.oven_total": 3,
};

export async function bootConsolidatedDashboard(page, variant, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(
    ({ haStates, daily, currentMonthly, monthly, annual }) => {
      window.DASHBOARDMODERN_AUTH_TOKEN = "e2e-token";
      window.__dmSocketInstances = 0;
      window.__dmStatisticsRequests = [];
      const now = new Date();
      const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      window.__dmCurrentPeriod = { month: now.getMonth() + 1, year: now.getFullYear() };
      window.__dmSelectedPeriod = {
        month: previous.getMonth() + 1,
        year: previous.getFullYear(),
      };
      const base = Object.fromEntries(
        Object.keys({ ...daily, ...currentMonthly, ...monthly, ...annual }).map((id, index) => [
          id,
          1000 + index * 100,
        ]),
      );

      window.WebSocket = class extends EventTarget {
        static OPEN = 1;
        readyState = 1;
        constructor() {
          super();
          window.__dmSocketInstances += 1;
          queueMicrotask(() => this.emit({ type: "auth_required" }));
        }
        emit(message) {
          const event = new MessageEvent("message", { data: JSON.stringify(message) });
          this.dispatchEvent(event);
          this.onmessage?.(event);
        }
        send(raw) {
          const message = JSON.parse(raw);
          if (message.type === "auth") {
            this.emit({ type: "auth_ok" });
            return;
          }
          if (message.type === "get_states") {
            this.emit({ id: message.id, type: "result", success: true, result: haStates });
            return;
          }
          if (message.type === "subscribe_events") {
            this.emit({ id: message.id, type: "result", success: true, result: null });
            return;
          }
          if (message.type === "recorder/statistics_during_period") {
            window.__dmStatisticsRequests.push(structuredClone(message));
            const start = new Date(message.start_time);
            const end = new Date(message.end_time);
            const previousPeriod = window.__dmSelectedPeriod;
            const isPreviousMonth =
              start.getMonth() + 1 === previousPeriod.month && start.getFullYear() === previousPeriod.year;
            const selected =
              message.period === "hour"
                ? daily
                : message.period === "month"
                  ? annual
                  : isPreviousMonth
                    ? monthly
                    : currentMonthly;
            const result = Object.fromEntries(
              (message.statistic_ids || []).map((id) => {
                const initial = base[id];
                const final = initial + (selected[id] || 0);
                return [id, [
                  { start: message.start_time, sum: initial, state: initial },
                  { start: new Date(end.getTime() - 1).toISOString(), sum: final, state: final },
                ]];
              }),
            );
            this.emit({ id: message.id, type: "result", success: true, result });
            return;
          }
          this.emit({ id: message.id, type: "result", success: true, result: [] });
        }
        close() {
          this.readyState = 3;
        }
      };
    },
    {
      haStates: consolidatedStates,
      daily: dayValues,
      currentMonthly: currentMonthValues,
      monthly: monthValues,
      annual: yearValues,
    },
  );

  await bootNamespacedDashboard(page, variant, testInfo, consolidatedSeed);
  await page.locator("#setup-wizard").evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_0150__?.ready === true);
  await expect
    .poll(() => page.evaluate(() => window.__DASHBOARDMODERN_RUNTIME_0150__?.bundle?.month?.house))
    .toBe(39.9);
}
