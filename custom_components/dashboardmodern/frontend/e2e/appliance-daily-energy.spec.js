import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { clickBottomTab } from "./helpers/navigation.js";

const states = [
  {
    entity_id: "switch.fridge",
    state: "on",
    attributes: { friendly_name: "Frigorifero", device_class: "outlet" },
  },
  {
    entity_id: "sensor.fridge_power",
    state: "85",
    attributes: { friendly_name: "Frigorifero power", unit_of_measurement: "W" },
  },
  {
    entity_id: "sensor.fridge_today",
    state: "0.81",
    attributes: {
      friendly_name: "Frigorifero oggi",
      unit_of_measurement: "kWh",
      device_class: "energy",
      state_class: "total_increasing",
    },
  },
  {
    entity_id: "sensor.fridge_total",
    state: "120.4",
    attributes: {
      friendly_name: "Frigorifero totale",
      unit_of_measurement: "kWh",
      device_class: "energy",
      state_class: "total_increasing",
    },
  },
  {
    entity_id: "sensor.microwave_total",
    state: "20.0",
    attributes: {
      friendly_name: "Microonde totale",
      unit_of_measurement: "kWh",
      device_class: "energy",
      state_class: "total_increasing",
    },
  },
];

const seed = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "room-home", name: "Casa", icon: "mdi:home" }],
    appliances: [
      {
        id: "fridge",
        name: "Frigorifero",
        device_type: "frigo",
        visual_key: "frigo",
        room_id: "room-home",
        control_entity: "switch.fridge",
        power_entity: "sensor.fridge_power",
        daily_energy_entity: "sensor.fridge_today",
        total_energy_entity: "sensor.fridge_total",
        entities: ["switch.fridge", "sensor.fridge_power", "sensor.fridge_total"],
      },
      {
        id: "microwave",
        name: "Microonde",
        device_type: "microonde",
        visual_key: "microonde",
        room_id: "room-home",
        total_energy_entity: "sensor.microwave_total",
        entities: ["sensor.microwave_total"],
      },
    ],
    loads: [],
  },
  visibility: { appliances: true },
};

async function boot(page, variant, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript((haStates) => {
    window.__dmStatisticsPeriods = [];
    class MockSocket extends EventTarget {
      static OPEN = 1;
      readyState = MockSocket.OPEN;
      onopen = null;
      onmessage = null;
      onclose = null;
      onerror = null;
      constructor() {
        super();
        queueMicrotask(() => {
          this.onopen?.({});
          this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
        });
      }
      send(raw) {
        const message = JSON.parse(raw);
        if (message.type === "auth") return;
        let result = null;
        if (message.type === "get_states") result = haStates;
        else if (message.type === "frontend/get_user_data") result = { value: null };
        else if (message.type === "subscribe_events") result = null;
        else if (message.type === "recorder/statistics_during_period") {
          window.__dmStatisticsPeriods.push(message.period);
          const requestStart = new Date(message.start_time).getTime();
          const requestEnd = new Date(message.end_time).getTime();
          result = {};
          for (const entity of message.statistic_ids || []) {
            if (entity !== "sensor.microwave_total") {
              result[entity] = [];
              continue;
            }
            result[entity] = [
              { start: new Date(requestStart + 30 * 60 * 1000).toISOString(), sum: 100 },
              { start: new Date(requestEnd - 60 * 1000).toISOString(), sum: 100.05 },
            ];
          }
        }
        this.onmessage?.({
          data: JSON.stringify({ id: message.id, type: "result", success: true, result }),
        });
      }
      close() {
        this.onclose?.({});
      }
    }
    window.__DASHBOARDMODERN_BRIDGE_WS__ = MockSocket;
    window.WebSocket = MockSocket;
  }, states);

  await bootNamespacedDashboard(page, variant, testInfo, seed);
  await page.locator("#setup-wizard").evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate(
    (haStates) => haStates.forEach((item) => {
      _RAW_STATES[item.entity_id] = structuredClone(item);
      STATES[item.entity_id] = structuredClone(item);
    }),
    states,
  );
  await clickBottomTab(page, "appliances", testInfo);
}

for (const variant of ["dashboard.html", "dashboard-en.html"]) {
  test(`${variant}: daily appliance KPI opens dashboard-style breakdown without visible entity labels`, async ({ page }, testInfo) => {
    if (testInfo.project.name === "webkit-ipad") test.slow(true, "Recorder-backed popup is slower on WebKit/iPad");
    await boot(page, variant, testInfo);

    const dailyCard = page.locator('#appl-kpi-grid [data-dm-appliance-daily-total="true"]');
    await expect(dailyCard).toBeVisible();
    await expect.poll(async () => dailyCard.locator(".g-val").textContent()).toMatch(/0[.,]86 kWh/i);
    await expect(dailyCard.locator(".g-val")).not.toContainText("20.0");

    await dailyCard.click();
    const popup = page.locator("#dm-appliance-daily-popup");
    await expect(popup).toBeVisible();
    await expect(popup.locator("[data-dm-daily-popup-total]")).toContainText(/0[.,]86 kWh/i);
    await expect(popup.locator("[data-dm-daily-entity]")).toHaveCount(2);
    await expect(popup.locator(".dm-appliance-daily-row-main strong")).toHaveText(["Frigorifero", "Microonde"]);
    await expect(popup.locator(".dm-appliance-daily-row-main small").first()).toBeHidden();
    await expect(popup.locator(".dm-appliance-daily-note")).toBeHidden();
    await expect(popup).toContainText(/0[.,]81 kWh/i);
    await expect(popup).toContainText(/0[.,]05 kWh/i);

    const visibleCopy = await popup.evaluate((node) => node.innerText);
    expect(visibleCopy).not.toContain("sensor.fridge_today");
    expect(visibleCopy).not.toContain("sensor.microwave_total");
    expect(visibleCopy).not.toMatch(/Recorder|Sensore giornaliero|Daily sensor|Total meter/i);

    const dialog = popup.locator(".dm-appliance-daily-dialog");
    const row = popup.locator(".dm-appliance-daily-row").first();
    await expect
      .poll(async () => dialog.evaluate((node) => getComputedStyle(node).borderRadius))
      .toMatch(/3[24]px/);
    await expect
      .poll(async () => row.evaluate((node) => getComputedStyle(node).borderRadius))
      .toMatch(/2[14]px/);

    const periods = await page.evaluate(() => window.__dmStatisticsPeriods);
    expect(periods).toContain("5minute");
  });
}
