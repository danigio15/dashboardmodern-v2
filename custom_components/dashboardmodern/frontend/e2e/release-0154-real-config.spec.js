import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { clickBottomTab } from "./helpers/navigation.js";

const lifetime = {
  "sensor.solar_total": 11919.4,
  "sensor.house_total": 5672.4,
  "sensor.grid_import_total": 1388.3,
  "sensor.grid_export_total": 4442,
  "sensor.battery_charge_total": 3195.5,
  "sensor.battery_discharge_total": 2.2,
};

const monthly = {
  "sensor.solar_total": 42.6,
  "sensor.house_total": 30.6,
  "sensor.grid_import_total": 10,
  "sensor.grid_export_total": 20,
  "sensor.battery_charge_total": 5,
  "sensor.battery_discharge_total": 3,
};

const states = [
  ...Object.entries(lifetime).map(([entity_id, state]) => ({
    entity_id,
    state: String(state),
    attributes: {
      friendly_name: entity_id.replace("sensor.", "").replaceAll("_", " "),
      unit_of_measurement: "kWh",
      device_class: "energy",
      state_class: "total_increasing",
    },
  })),
  ...["oven", "fridge", "microwave", "boiler"].map((name) => ({
    entity_id: `switch.${name}`,
    state: "on",
    attributes: { friendly_name: name },
  })),
];

const seed = {
  schema_version: 4,
  sections: {
    rooms: [
      { id: "room-salone", name: "Salone", icon: "mdi:sofa" },
      { id: "room-terrazza", name: "Terrazza", icon: "mdi:balcony" },
    ],
    appliances: [
      {
        id: "appliance-oven",
        section: "appliances",
        name: "Forno",
        device_type: "forno",
        visual_type: "asset",
        visual_key: "forno",
        room_id: "room-salone",
        control_entity: "switch.oven",
        entities: ["switch.oven"],
        show_in_dashboard: true,
        show_in_report: true,
      },
      {
        id: "appliance-fridge",
        section: "appliances",
        name: "Frigo",
        device_type: "frigo",
        visual_type: "asset",
        visual_key: "frigo",
        room_id: "room-salone",
        control_entity: "switch.fridge",
        entities: ["switch.fridge"],
        show_in_dashboard: true,
        show_in_report: true,
      },
      {
        id: "appliance-microwave",
        section: "appliances",
        name: "Microonde",
        device_type: "microonde",
        visual_type: "asset",
        visual_key: "microonde",
        room_id: "room-salone",
        control_entity: "switch.microwave",
        entities: ["switch.microwave"],
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
        entities: ["switch.boiler"],
        show_in_dashboard: true,
        show_in_report: true,
      },
    ],
    loads: [],
    energy: {
      house: { monthly_energy: "sensor.house_total" },
      grid: {
        monthly_import_energy: "sensor.grid_import_total",
        monthly_export_energy: "sensor.grid_export_total",
      },
      solar: { monthly_energy: "sensor.solar_total" },
      battery: {
        monthly_charged_energy: "sensor.battery_charge_total",
        monthly_discharged_energy: "sensor.battery_discharge_total",
      },
      metadata: {},
    },
  },
  visibility: { energy: true, appliances: true },
};

async function boot(page, variant, testInfo) {
  await page.route("https://**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
  await page.addInitScript(
    ({ haStates, periodChanges }) => {
      window.__dm0154Requests = [];
      window.WebSocket = class extends EventTarget {
        static OPEN = 1;
        readyState = 1;
        constructor() {
          super();
          queueMicrotask(() => this.emit({ type: "auth_ok" }));
        }
        emit(message) {
          const event = new MessageEvent("message", { data: JSON.stringify(message) });
          this.dispatchEvent(event);
          this.onmessage?.(event);
        }
        send(raw) {
          const message = JSON.parse(raw);
          if (message.type === "auth") return;
          if (message.type === "recorder/statistics_during_period") {
            window.__dm0154Requests.push(structuredClone(message));
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
    { haStates: states, periodChanges: monthly },
  );

  await bootNamespacedDashboard(page, variant, testInfo, seed);
  await page.locator("#setup-wizard").evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RELEASE_0154__?.installed);
}

for (const variant of ["dashboard.html", "dashboard-en.html"]) {
  test(`${variant}: real cumulative monthly fields never display lifetime totals`, async ({ page }, testInfo) => {
    if (testInfo.project.name.includes("webkit")) test.slow(true);
    await boot(page, variant, testInfo);
    await clickBottomTab(page, "energy", testInfo);
    await page.locator('button[onclick*="switchEnergyView(\'month\')"]').click();

    await expect.poll(() => page.locator("#v-solar-month").textContent()).toMatch(/42[,.]6/);
    await expect(page.locator("#v-grid-month")).toContainText(/10/);
    await expect(page.locator("#v-grid-month")).toContainText(/20/);
    await expect(page.locator("#v-battery-month")).toContainText(/5/);
    await expect(page.locator("#v-battery-month")).toContainText(/3/);

    const result = await page.evaluate((lifetimeValues) => {
      const text = document.getElementById("view-month")?.textContent || "";
      return {
        text,
        requests: window.__dm0154Requests,
        registry: {
          solar: CD_PERIOD["dm.energy_produzione_solare_mese"],
          house: CD_PERIOD["dm.energy_consumo_casa_mese"],
          import: CD_PERIOD["dm.energy_rete_acquistata_mese"],
          export: CD_PERIOD["dm.energy_rete_venduta_mese"],
        },
        leakedLifetime: Object.values(lifetimeValues).some((value) =>
          text.includes(String(value)),
        ),
      };
    }, lifetime);

    expect(result.registry).toEqual({ solar: 42.6, house: 30.6, import: 10, export: 20 });
    expect(result.leakedLifetime).toBe(false);
    expect(result.requests.length).toBeGreaterThan(0);
    expect(result.requests.every((request) => request.types === undefined)).toBe(true);
  });

  test(`${variant}: built-in appliance artwork is one theme-aware visual family`, async ({ page }, testInfo) => {
    await boot(page, variant, testInfo);
    await clickBottomTab(page, "appliances-main", testInfo);

    const cards = page.locator("#appl-grid-overview .appl-wide-card[data-appliance-id]");
    await expect(cards).toHaveCount(4);
    await expect.poll(() =>
      cards.evaluateAll((nodes) => nodes.map((node) => node.dataset.dmArtStyle)),
    ).toEqual(["panel", "panel", "panel", "panel"]);

    const visuals = await cards.evaluateAll((nodes) =>
      nodes.map((card) => {
        const viewport = card.querySelector(".appl-visual").getBoundingClientRect();
        const svg = card.querySelector(".dm-appliance-art-0154 > svg").getBoundingClientRect();
        return {
          kind: card.dataset.dmArtwork,
          style: card.dataset.dmArtStyle,
          ratio: Math.round((svg.width / viewport.width) * 1000) / 1000,
          panel: Boolean(card.querySelector('[data-dm-art-style="panel"] .dm-art-panel')),
        };
      }),
    );

    expect(visuals.map((item) => item.kind)).toEqual(["oven", "fridge", "microwave", "boiler"]);
    expect(visuals.every((item) => item.style === "panel" && item.panel)).toBe(true);
    expect(Math.max(...visuals.map((item) => item.ratio)) - Math.min(...visuals.map((item) => item.ratio))).toBeLessThan(0.04);
    expect(visuals.every((item) => item.ratio >= 0.74 && item.ratio <= 0.9)).toBe(true);

    const palettes = await page.evaluate(() => {
      document.documentElement.setAttribute("data-theme", "light");
      const light = getComputedStyle(document.documentElement).getPropertyValue("--dm-art-panel").trim();
      document.documentElement.setAttribute("data-theme", "dark");
      const dark = getComputedStyle(document.documentElement).getPropertyValue("--dm-art-panel").trim();
      return { light, dark };
    });
    expect(palettes.light).not.toBe("");
    expect(palettes.dark).not.toBe("");
    expect(palettes.dark).not.toBe(palettes.light);
  });
}
