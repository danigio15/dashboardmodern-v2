import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { clickBottomTab } from "./helpers/navigation.js";

const states = [
  {
    entity_id: "sensor.total_grid_energy",
    state: "9842.2",
    attributes: {
      friendly_name: "Energia totale rete",
      unit_of_measurement: "kWh",
      device_class: "energy",
      state_class: "total_increasing",
    },
  },
  {
    entity_id: "switch.frigo",
    state: "on",
    attributes: { friendly_name: "Frigo" },
  },
  {
    entity_id: "sensor.frigo_power",
    state: "0",
    attributes: { unit_of_measurement: "W", device_class: "power" },
  },
  {
    entity_id: "sensor.frigo_energy",
    state: "10.47",
    attributes: {
      unit_of_measurement: "kWh",
      device_class: "energy",
      state_class: "total_increasing",
    },
  },
  {
    entity_id: "switch.boiler",
    state: "on",
    attributes: { friendly_name: "Scaldabagno" },
  },
  {
    entity_id: "sensor.boiler_power",
    state: "0",
    attributes: { unit_of_measurement: "W", device_class: "power" },
  },
  {
    entity_id: "sensor.boiler_energy",
    state: "2.06",
    attributes: {
      unit_of_measurement: "kWh",
      device_class: "energy",
      state_class: "total_increasing",
    },
  },
  {
    entity_id: "sensor.terrazza_temperature",
    state: "21.8",
    attributes: { unit_of_measurement: "°C", device_class: "temperature" },
  },
];

const seed = {
  schema_version: 4,
  sections: {
    rooms: [
      {
        id: "room-terrazza",
        name: "Terrazza",
        icon: "mdi:home",
        temp: "",
        hum: "",
      },
    ],
    appliances: [
      {
        id: "appliance-frigo",
        section: "appliances",
        name: "Frigo",
        device_type: "frigo",
        visual_type: "asset",
        visual_key: "frigo",
        room_id: "room-terrazza",
        control_entity: "switch.frigo",
        power_entity: "sensor.frigo_power",
        total_energy_entity: "sensor.frigo_energy",
        entities: ["switch.frigo", "sensor.frigo_power", "sensor.frigo_energy"],
        show_in_dashboard: true,
        show_in_report: true,
      },
      {
        id: "appliance-boiler",
        section: "appliances",
        name: "Scaldabagno",
        device_type: "scaldabagno",
        visual_type: "asset",
        visual_key: "scaldabagno",
        room_id: "room-terrazza",
        control_entity: "switch.boiler",
        power_entity: "sensor.boiler_power",
        total_energy_entity: "sensor.boiler_energy",
        entities: ["switch.boiler", "sensor.boiler_power", "sensor.boiler_energy"],
        show_in_dashboard: true,
        show_in_report: true,
      },
    ],
    loads: [],
    lights: [],
    energy: {
      house: {},
      grid: { total_import_energy: "sensor.total_grid_energy" },
      solar: {},
      battery: {},
      metadata: {},
    },
  },
  visibility: { temp: true, energy: true, appliances: true },
};

async function boot(page, variant, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript((haStates) => {
    window.__dmStatisticsRequests = [];
    window.__dmFailStatistics = false;
    window.WebSocket = class extends EventTarget {
      static OPEN = 1;
      readyState = 1;
      constructor() {
        super();
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
        if (message.type === "recorder/statistics_during_period") {
          window.__dmStatisticsRequests.push(structuredClone(message));
          if (window.__dmFailStatistics) {
            this.emit({
              id: message.id,
              type: "result",
              success: false,
              error: { message: "period unavailable" },
            });
            return;
          }
          const change = message.period === "hour" ? 1.25 : message.period === "day" ? 42.6 : 500.4;
          const result = Object.fromEntries(
            (message.statistic_ids || []).map((id) => [
              id,
              [
                {
                  start: message.start_time,
                  change,
                  sum: 9842.2,
                  state: 9842.2,
                },
              ],
            ]),
          );
          this.emit({ id: message.id, type: "result", success: true, result });
          return;
        }
        const result =
          message.type === "get_states"
            ? haStates
            : message.type === "frontend/get_user_data"
              ? { value: null }
              : [];
        this.emit({ id: message.id, type: "result", success: true, result });
      }
      close() {}
    };
  }, states);

  await bootNamespacedDashboard(page, variant, testInfo, seed);
  await page
    .locator("#setup-wizard")
    .evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  await page.evaluate((haStates) => {
    haStates.forEach((state) => {
      _RAW_STATES[state.entity_id] = structuredClone(state);
      STATES[state.entity_id] = structuredClone(state);
    });
    render?.();
    renderApplianceSection?.(true);
  }, states);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RELEASE_0152__?.installed);
}

for (const variant of ["dashboard.html", "dashboard-en.html"]) {
  test(`${variant}: Temperature, appliance artwork and total Energy work in the real DOM`, async ({
    page,
  }, testInfo) => {
    if (testInfo.project.name.includes("webkit")) test.slow(true);
    await boot(page, variant, testInfo);

    await page.evaluate(() => {
      apriConfigEntita();
      editorSwitch("sez7");
    });
    await expect(page.locator('#ed-body[data-renderer="temperature"]')).toBeVisible();
    const iconInput = page.locator("#dm-temperature-icon");
    await expect(iconInput).toHaveAttribute("type", "hidden");
    const iconField = iconInput.locator("xpath=ancestor::label[1]");
    await expect(iconField).toBeHidden();
    await expect(page.locator("[data-temperature-form]")).not.toContainText(/Simbolo|Icon\b/);
    await page.locator("#dm-temperature-room").selectOption("room-terrazza");
    await expect(iconInput).toHaveValue("mdi:home");
    await expect(page.locator("[data-temperature-submit]")).toContainText(/ASSOCIA|ASSOCIATE/);
    await page.locator("#editor-modal .ed-head-close").last().click();

    await clickBottomTab(page, "appliances", testInfo);
    await expect(
      page.locator('[data-appliance-id="appliance-frigo"][data-dm-artwork="fridge"] [data-dm-art="fridge"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-appliance-id="appliance-boiler"][data-dm-artwork="boiler"] [data-dm-art="boiler"]'),
    ).toBeVisible();
    const artworkLayout = await page.evaluate(() =>
      ["appliance-frigo", "appliance-boiler"].map((id) => {
        const card = document.querySelector(`[data-appliance-id="${id}"]`);
        const visual = card.querySelector(".appl-visual").getBoundingClientRect();
        const svg = card.querySelector("[data-dm-art] svg").getBoundingClientRect();
        return {
          id,
          inside: svg.left >= visual.left && svg.right <= visual.right && svg.top >= visual.top && svg.bottom <= visual.bottom,
          widthRatio: svg.width / visual.width,
          heightRatio: svg.height / visual.height,
        };
      }),
    );
    for (const artwork of artworkLayout) {
      expect(artwork.inside).toBe(true);
      expect(artwork.widthRatio).toBeGreaterThan(0.5);
      expect(artwork.widthRatio).toBeLessThan(0.9);
      expect(artwork.heightRatio).toBeGreaterThan(0.5);
      expect(artwork.heightRatio).toBeLessThan(0.9);
    }

    const refreshed = await page.evaluate(async () => {
      const release = await import("./release-0152-fixes.js");
      return release.refreshEnergyStatistics0152(new Date());
    });
    expect(refreshed).toBe(true);
    await expect
      .poll(() =>
        page.evaluate(() => ({
          day: CD_PERIOD["dm.energy_energia_prelevata_oggi"],
          month: CD_PERIOD["dm.energy_rete_acquistata_mese"],
          year: CD_PERIOD["dm.energy_rete_acquistata_anno"],
          requests: window.__dmStatisticsRequests
            .filter((request) => Number(request.id) >= 152000)
            .map((request) => ({ period: request.period, types: request.types })),
        })),
      )
      .toEqual({
        day: 1.25,
        month: 42.6,
        year: 500.4,
        requests: [
          { period: "hour", types: undefined },
          { period: "day", types: undefined },
          { period: "month", types: undefined },
        ],
      });

    const failure = await page.evaluate(async () => {
      window.__dmFailStatistics = true;
      const release = await import("./release-0152-fixes.js");
      const before = document.documentElement.className;
      const result = await release.refreshEnergyStatistics0152(new Date(2026, 5, 1));
      return {
        result,
        before,
        after: document.documentElement.className,
        message: document.querySelector("[data-dm-energy-statistics-status]")?.textContent || "",
      };
    });
    expect(failure.result).toBe(false);
    expect(failure.after).toBe(failure.before);
    expect(failure.message).toMatch(/non disponibili|unavailable/i);

    await page.screenshot({
      path: `test-results/${testInfo.project.name}-${variant}-release-0152-real-runtime.png`,
      fullPage: true,
    });
  });
}
