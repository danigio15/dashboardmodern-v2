import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { clickBottomTab } from "./helpers/navigation.js";

const customImage =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 80'%3E%3Crect width='120' height='80' rx='14' fill='%230f2942'/%3E%3Ccircle cx='60' cy='40' r='25' fill='%2322b8f0'/%3E%3C/svg%3E";

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
    entity_id: "sensor.frigo_energy",
    state: "410.4",
    attributes: {
      friendly_name: "Energia totale frigo",
      unit_of_measurement: "kWh",
      device_class: "energy",
      state_class: "total_increasing",
    },
  },
  {
    entity_id: "sensor.boiler_energy",
    state: "216.2",
    attributes: {
      friendly_name: "Energia totale scaldabagno",
      unit_of_measurement: "kWh",
      device_class: "energy",
      state_class: "total_increasing",
    },
  },
  {
    entity_id: "sensor.custom_energy",
    state: "88.7",
    attributes: {
      friendly_name: "Energia totale dispositivo custom",
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
    entity_id: "switch.boiler",
    state: "on",
    attributes: { friendly_name: "Scaldabagno" },
  },
  {
    entity_id: "switch.custom",
    state: "off",
    attributes: { friendly_name: "Dispositivo custom" },
  },
];

const seed = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "room-cucina", name: "Cucina", icon: "mdi:countertop" }],
    appliances: [
      {
        id: "appliance-frigo",
        section: "appliances",
        name: "Frigo",
        device_type: "frigo",
        visual_type: "asset",
        visual_key: "frigo",
        room_id: "room-cucina",
        control_entity: "switch.frigo",
        total_energy_entity: "sensor.frigo_energy",
        entities: ["switch.frigo", "sensor.frigo_energy"],
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
        room_id: "room-cucina",
        control_entity: "switch.boiler",
        total_energy_entity: "sensor.boiler_energy",
        entities: ["switch.boiler", "sensor.boiler_energy"],
        show_in_dashboard: true,
        show_in_report: true,
      },
      {
        id: "appliance-custom",
        section: "appliances",
        name: "Dispositivo custom",
        device_type: "forno",
        image: customImage,
        room_id: "room-cucina",
        control_entity: "switch.custom",
        total_energy_entity: "sensor.custom_energy",
        entities: ["switch.custom", "sensor.custom_energy"],
        show_in_dashboard: true,
        show_in_report: true,
      },
    ],
    loads: [],
    energy: {
      house: {},
      grid: { total_import_energy: "sensor.total_grid_energy" },
      solar: {},
      battery: {},
      metadata: {},
    },
  },
  visibility: { energy: true, appliances: true },
};

const changes = {
  "sensor.total_grid_energy": 42.6,
  "sensor.frigo_energy": 7.4,
  "sensor.boiler_energy": 3.2,
  "sensor.custom_energy": 1.8,
};

async function boot(page, variant, testInfo) {
  await page.route("https://**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
  await page.addInitScript(
    ({ haStates, periodChanges }) => {
      window.DASHBOARDMODERN_AUTH_TOKEN = "e2e-token";
      window.__dmStatisticsRequests = [];
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
            if (message.types !== undefined) {
              this.emit({
                id: message.id,
                type: "result",
                success: false,
                error: { message: "types is not accepted by this Recorder endpoint" },
              });
              return;
            }
            const result = Object.fromEntries(
              (message.statistic_ids || []).map((id) => [
                id,
                [
                  {
                    start: message.start_time,
                    change: periodChanges[id] ?? 0.5,
                    sum: 1000 + (periodChanges[id] ?? 0.5),
                    state: 1000 + (periodChanges[id] ?? 0.5),
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
    },
    { haStates: states, periodChanges: changes },
  );

  await bootNamespacedDashboard(page, variant, testInfo, seed);
  await page.locator("#setup-wizard").evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  await page.evaluate((haStates) => {
    haStates.forEach((state) => {
      _RAW_STATES[state.entity_id] = structuredClone(state);
      STATES[state.entity_id] = structuredClone(state);
    });
    render?.();
    renderApplianceSection?.(true);
    cdRebuildReportDevices?.();
    buildReportSelect?.();
  }, states);
  await page.waitForFunction(
    () => window.__DASHBOARDMODERN_ENERGY_REPORT_MEDIA_FIX__?.installed,
  );
}

for (const variant of ["dashboard.html", "dashboard-en.html"]) {
  test(`${variant}: monthly totals, Report and appliance media use the real safe runtime`, async ({
    page,
  }, testInfo) => {
    if (testInfo.project.name.includes("webkit")) test.slow(true);
    await boot(page, variant, testInfo);

    const helperResult = await page.evaluate(async () => {
      const start = new Date();
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      const runtime = await import("./energy-monthly-report-media-fixes.js");
      const stats = await runtime.fetchHAStatistics0153(
        ["sensor.total_grid_energy", "sensor.frigo_energy"],
        start.toISOString(),
        new Date().toISOString(),
        "day",
      );
      return {
        grid: stats["sensor.total_grid_energy"]?.[0]?.change,
        fridge: stats["sensor.frigo_energy"]?.[0]?.change,
      };
    });
    expect(helperResult).toEqual({ grid: 42.6, fridge: 7.4 });

    await clickBottomTab(page, "energy", testInfo);
    await page.evaluate(async () => {
      cdRebuildReportDevices?.();
      buildReportSelect?.();
      const now = new Date();
      await renderEdDeviceList?.(
        now.getMonth() + 1,
        now.getFullYear(),
        true,
        42.6,
        10,
        50,
      );
    });

    await expect
      .poll(() =>
        page.evaluate(() => ({
          fridge: CD_PERIOD["sensor.frigo_energy"],
          boiler: CD_PERIOD["sensor.boiler_energy"],
          custom: CD_PERIOD["sensor.custom_energy"],
          unsafe: window.__dmStatisticsRequests.some(
            (request) =>
              request.type === "recorder/statistics_during_period" &&
              request.types !== undefined,
          ),
        })),
      )
      .toEqual({ fridge: 7.4, boiler: 3.2, custom: 1.8, unsafe: false });

    const report = page.locator("#ed-device-list");
    await expect(report).toContainText(/Frigo|Fridge/i);
    await expect(report).toContainText(/7[,.]4/);

    await clickBottomTab(page, "appliances", testInfo);
    const overview = page.locator("#appl-grid-overview");
    const fridgeCard = overview.locator('[data-appliance-id="appliance-frigo"]');
    const customCard = overview.locator('[data-appliance-id="appliance-custom"]');
    await expect(fridgeCard).toHaveAttribute("data-dm-media-kind", "asset");
    await expect(customCard).toHaveAttribute("data-dm-media-kind", "image");
    await expect(customCard.locator("img.dm-appliance-image-0153")).toBeVisible();

    const layout = await page.evaluate(() =>
      ["appliance-frigo", "appliance-boiler", "appliance-custom"].map((id) => {
        const card = document.querySelector(`#appl-grid-overview [data-appliance-id="${id}"]`);
        const visual = card.querySelector(".appl-visual").getBoundingClientRect();
        const media = card.querySelector("[data-dm-art] svg, img.dm-appliance-image-0153");
        const rect = media.getBoundingClientRect();
        return {
          id,
          inside:
            rect.left >= visual.left - 1 &&
            rect.right <= visual.right + 1 &&
            rect.top >= visual.top - 1 &&
            rect.bottom <= visual.bottom + 1,
          widthRatio: rect.width / visual.width,
          heightRatio: rect.height / visual.height,
          objectFit: media instanceof HTMLImageElement ? getComputedStyle(media).objectFit : "svg",
        };
      }),
    );

    for (const item of layout) {
      expect(item.inside).toBe(true);
      expect(item.widthRatio).toBeGreaterThan(0.5);
      expect(item.widthRatio).toBeLessThanOrEqual(1);
      expect(item.heightRatio).toBeGreaterThan(0.5);
      expect(item.heightRatio).toBeLessThanOrEqual(1);
      if (item.id === "appliance-custom") expect(item.objectFit).toBe("contain");
    }
  });
}
