import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { clickBottomTab, clickStableButton } from "./helpers/navigation.js";

const states = [
  {
    entity_id: "sensor.salone_temperature",
    state: "29.0",
    attributes: {
      friendly_name: "Temperatura salone",
      unit_of_measurement: "°C",
      device_class: "temperature",
      state_class: "measurement",
    },
  },
  {
    entity_id: "sensor.salone_humidity",
    state: "29",
    attributes: {
      friendly_name: "Umidità salone",
      unit_of_measurement: "%",
      device_class: "humidity",
      state_class: "measurement",
    },
  },
  {
    entity_id: "sensor.forno_totale",
    state: "412.8",
    attributes: {
      friendly_name: "Forno energia totale",
      unit_of_measurement: "kWh",
      device_class: "energy",
      state_class: "total_increasing",
    },
  },
  {
    entity_id: "sensor.solarman_total_grid_energy",
    state: "9842.2",
    attributes: {
      friendly_name: "Energia totale rete",
      unit_of_measurement: "kWh",
      device_class: "energy",
      state_class: "total_increasing",
    },
  },
];

const seed = {
  schema_version: 4,
  sections: {
    rooms: [
      {
        id: "room-salone",
        name: "Salone",
        icon: "mdi:sofa",
        temp: "sensor.salone_temperature",
        hum: "sensor.salone_humidity",
      },
    ],
    appliances: [
      {
        id: "appliance-forno",
        section: "appliances",
        name: "Forno",
        icon: "mdi:stove",
        device_type: "forno",
        room_id: "room-salone",
        entities: ["sensor.forno_totale"],
        total_energy_entity: "sensor.forno_totale",
        show_in_report: true,
        show_in_dashboard: true,
      },
    ],
    loads: [],
    lights: [],
    energy: { house: {}, grid: {}, solar: {}, battery: {}, metadata: {} },
  },
  visibility: { temp: true, energy: true, appliances: true },
};

async function boot(page, variant, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript((haStates) => {
    window.WebSocket = class extends EventTarget {
      static OPEN = 1;
      readyState = 1;
      constructor() {
        super();
        queueMicrotask(() =>
          this.onmessage?.({ data: JSON.stringify({ type: "auth_required" }) }),
        );
      }
      send(raw) {
        const message = JSON.parse(raw);
        if (message.type === "auth") {
          this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
          return;
        }
        let result = [];
        if (message.type === "get_states") result = haStates;
        else if (message.type === "frontend/get_user_data") result = { value: null };
        else if (message.type === "recorder/statistics_during_period") {
          result = Object.fromEntries(
            (message.statistic_ids || []).map((id) => [
              id,
              [
                {
                  start: new Date().toISOString(),
                  change: id.includes("forno") ? 12.4 : 42.6,
                  sum: id.includes("forno") ? 412.8 : 9842.2,
                  state: id.includes("forno") ? 412.8 : 9842.2,
                },
              ],
            ]),
          );
        }
        this.onmessage?.({
          data: JSON.stringify({
            id: message.id,
            type: "result",
            success: true,
            result,
          }),
        });
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
    cdRebuildReportDevices?.();
    buildReportSelect?.();
  }, states);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RELEASE_0150__?.installed);
}

async function openEnergyAnalysis(page, testInfo) {
  await clickBottomTab(page, "energy", testInfo);
  const energyPage = page.locator("#page-energy.active");
  await clickStableButton(
    page,
    energyPage.getByRole("button", { name: /^📊?\s*Report$/i }),
    testInfo,
  );
  await clickStableButton(
    page,
    energyPage.getByRole("button", { name: /Analisi|Analysis/i }),
    testInfo,
  );
  await expect(page.locator("#ed-pane-analisi")).toBeVisible();
}

for (const variant of ["dashboard.html", "dashboard-en.html"]) {
  test(`${variant}: cumulative Energy, report icon and Temperature structure`, async ({
    page,
  }, testInfo) => {
    if (testInfo.project.name === "webkit-ipad") test.slow(true);
    await boot(page, variant, testInfo);

    await page.evaluate(() => {
      apriConfigEntita();
      editorSwitch("energy");
    });
    await expect(page.locator('[data-editor="energy"]')).toBeVisible();
    const grid = page.locator('[data-editor="energy"] details.ed-acc', {
      hasText: /Rete|Grid/,
    });
    await grid.locator("summary").click();
    const total = page.locator("#dm-energy-grid-total_import_energy");
    await expect(total).toBeVisible();
    await total.fill("sensor.solarman_total_grid_energy");
    await expect(total).toHaveAttribute("data-validation", "valid");
    await page.locator("[data-energy-save]").click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          DashboardModernModules.store.getSection("energy").grid?.total_import_energy,
        ),
      )
      .toBe("sensor.solarman_total_grid_energy");
    await expect
      .poll(() =>
        page.evaluate(() => {
          const overrides = JSON.parse(localStorage.getItem("cd_entity_overrides") || "{}");
          return {
            total: overrides["dm.core_045"],
            day: overrides["dm.energy_energia_prelevata_oggi"],
            month: overrides["dm.energy_rete_acquistata_mese"],
          };
        }),
      )
      .toEqual({
        total: "sensor.solarman_total_grid_energy",
        day: "sensor.solarman_total_grid_energy",
        month: "sensor.solarman_total_grid_energy",
      });
    await page.locator("#editor-modal .ed-head-close").last().click();

    await clickBottomTab(page, "temp", testInfo);
    const card = page.locator("#temp-grid .temp-card").first();
    await expect(card).toContainText("Salone");
    await expect(card).toContainText("29.0");
    const layout = await card.evaluate((node) => {
      const nameNode = node.querySelector(".cp-name");
      const valuesNode = node.querySelector(".temp-values, .temp-card-body");
      const infoNode = node.querySelector(".cp-info, .temp-card-body");
      if (!nameNode || !valuesNode || !infoNode) {
        throw new Error("Temperature card is missing its name, values or info structure");
      }
      const name = nameNode.getBoundingClientRect();
      const values = valuesNode.getBoundingClientRect();
      const info = infoNode.getBoundingClientRect();
      const cardBox = node.getBoundingClientRect();
      return {
        nameBottom: name.bottom,
        valuesTop: values.top,
        infoLeft: info.left,
        infoRight: info.right,
        cardLeft: cardBox.left,
        cardRight: cardBox.right,
        height: cardBox.height,
      };
    });
    expect(layout.nameBottom).toBeLessThanOrEqual(layout.valuesTop + 1);
    expect(layout.infoLeft).toBeGreaterThanOrEqual(layout.cardLeft);
    expect(layout.infoRight).toBeLessThanOrEqual(layout.cardRight + 1);
    expect(layout.height).toBeGreaterThan(90);

    await clickBottomTab(page, "appliances", testInfo);
    await expect(page.locator(".appl-wide-card")).toContainText("Forno");
    await expect(page.locator(".appl-wide-card .appl-mini")).toContainText(/Totale|Total/);
    await expect(page.locator(".appl-wide-card .appl-mini")).not.toContainText("🔋");

    await openEnergyAnalysis(page, testInfo);
    const option = page.locator("#ed-dev-selector option", { hasText: "Forno" });
    await expect(option).toHaveAttribute("value", "sensor.forno_totale");
    await expect(option).not.toContainText("mdi:");
    await expect(option).toContainText("♨️");
    await expect(page.locator("#ed-pane-analisi")).not.toContainText("mdi:stove");

    await page.screenshot({
      path: `test-results/${testInfo.project.name}-${variant}-release-0150-structural.png`,
      fullPage: true,
    });
  });
}
