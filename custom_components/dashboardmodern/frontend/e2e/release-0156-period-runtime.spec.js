import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { clickBottomTab } from "./helpers/navigation.js";

const states = [
  {
    entity_id: "sensor.terrace_temperature",
    state: "22.4",
    attributes: {
      friendly_name: "Terrace temperature",
      unit_of_measurement: "°C",
      device_class: "temperature",
    },
  },
  {
    entity_id: "sensor.terrace_humidity",
    state: "51",
    attributes: {
      friendly_name: "Terrace humidity",
      unit_of_measurement: "%",
      device_class: "humidity",
    },
  },
  ...[
    "house_total",
    "solar_total",
    "grid_import_total",
    "grid_export_total",
    "battery_charge_total",
    "battery_discharge_total",
    "fridge_total",
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

const seed = {
  schema_version: 4,
  sections: {
    rooms: [
      {
        id: "room-terrace",
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
        room_id: "room-terrace",
        total_energy_entity: "sensor.fridge_total",
        entities: ["sensor.fridge_total"],
        show_in_dashboard: true,
        show_in_report: true,
      },
    ],
    loads: [],
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
  visibility: { energy: true, temperature: true, temp: true, appliances: true },
};

async function boot(page, variant, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(
    ({ haStates }) => {
      window.DASHBOARDMODERN_AUTH_TOKEN = "e2e-token";
      window.__dmSocketInstances = 0;
      window.__dmStatisticsRequests = [];
      const current = new Date();
      const currentMonth = current.getMonth() + 1;
      const currentYear = current.getFullYear();
      const previousDate = new Date(currentYear, currentMonth - 2, 1);
      const previousMonth = previousDate.getMonth() + 1;
      const previousYear = previousDate.getFullYear();
      window.__dmPeriods = { currentMonth, currentYear, previousMonth, previousYear };

      const currentValues = {
        "sensor.house_total": 39.9,
        "sensor.solar_total": 50.2,
        "sensor.grid_import_total": 0,
        "sensor.grid_export_total": 7.2,
        "sensor.battery_charge_total": 8.6,
        "sensor.battery_discharge_total": 5.5,
        "sensor.fridge_total": 10.4,
      };
      const previousValues = {
        "sensor.house_total": 511.6,
        "sensor.solar_total": 305.4,
        "sensor.grid_import_total": 224,
        "sensor.grid_export_total": 8.8,
        "sensor.battery_charge_total": 152,
        "sensor.battery_discharge_total": 143,
        "sensor.fridge_total": 44.7,
      };
      const base = Object.fromEntries(Object.keys(currentValues).map((id, index) => [id, 1000 + index * 100]));

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
            const isBaseline = end.getDate() === 1 && end.getHours() === 0;
            const periodMonth = isBaseline ? end.getMonth() + 1 : start.getMonth() + 1;
            const periodYear = isBaseline ? end.getFullYear() : start.getFullYear();
            const selected =
              periodMonth === previousMonth && periodYear === previousYear
                ? previousValues
                : currentValues;
            const result = Object.fromEntries(
              (message.statistic_ids || []).map((id) => {
                const sum = base[id] + (isBaseline ? 0 : selected[id] || 0);
                return [id, [{ start: message.start_time, sum, state: sum }]];
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
    { haStates: states },
  );

  await bootNamespacedDashboard(page, variant, testInfo, seed);
  await page.locator("#setup-wizard").evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RELEASE_0156_PERIOD_RUNTIME__?.installed);
}

for (const variant of ["dashboard.html", "dashboard-en.html"]) {
  test(`${variant}: previous Report month does not overwrite the current monthly Energy period`, async ({
    page,
  }, testInfo) => {
    await boot(page, variant, testInfo);

    await page.evaluate(() => {
      buildTempCards?.();
      renderTemperature?.();
    });
    await expect(page.locator("#temp-grid .temp-value").first()).toContainText("22.4");

    await expect
      .poll(() =>
        page.evaluate(() => ({
          solar: Number(CD_PERIOD["dm.energy_produzione_solare_mese"]),
          home: Number(CD_PERIOD["dm.energy_consumo_casa_mese"]),
        })),
      )
      .toEqual({ solar: 50.2, home: 39.9 });

    await clickBottomTab(page, "energy", testInfo);
    await page.evaluate(() => {
      const { previousMonth, previousYear } = window.__dmPeriods;
      const month = document.getElementById("ed-sel-month");
      const year = document.getElementById("ed-sel-year");
      if (month) month.value = String(previousMonth);
      if (year) year.value = String(previousYear);
      month?.dispatchEvent(new Event("change", { bubbles: true }));
      year?.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await expect(page.locator("#ed-kpi-prod")).toContainText("305.4");
    await expect(page.locator("#ed-kpi-cons")).toContainText("511.6");

    await page.evaluate(async () => {
      const { previousMonth, previousYear } = window.__dmPeriods;
      cdRebuildReportDevices?.();
      buildReportSelect?.();
      await renderEdDeviceList?.(previousMonth, previousYear, false, 511.6, 224, 305.4);
    });
    await expect(page.locator("#ed-device-list")).toContainText(/44[,.]7/);

    const periodsAfterReport = await page.evaluate(() => ({
      solar: Number(CD_PERIOD["dm.energy_produzione_solare_mese"]),
      home: Number(CD_PERIOD["dm.energy_consumo_casa_mese"]),
      polling: window.__DASHBOARDMODERN_RELEASE_0155_PUBLIC_RUNTIME__?.sampleTimer || 0,
    }));
    expect(periodsAfterReport).toEqual({ solar: 50.2, home: 39.9, polling: 0 });

    const sockets = await page.evaluate(() => window.__dmSocketInstances);
    await page.waitForTimeout(1200);
    await expect.poll(() => page.evaluate(() => window.__dmSocketInstances)).toBe(sockets);

    const hasBaseline = await page.evaluate(() =>
      window.__dmStatisticsRequests.some((request) => {
        const end = new Date(request.end_time);
        return end.getDate() === 1 && end.getHours() === 0;
      }),
    );
    expect(hasBaseline).toBe(true);
  });
}
