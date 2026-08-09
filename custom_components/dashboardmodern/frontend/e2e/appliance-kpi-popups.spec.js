import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { clickBottomTab } from "./helpers/navigation.js";

const states = [
  {
    entity_id: "switch.microwave",
    state: "on",
    attributes: { friendly_name: "Microonde", device_class: "outlet" },
  },
  {
    entity_id: "sensor.microwave_power",
    state: "920",
    attributes: { friendly_name: "Microonde power", unit_of_measurement: "W" },
  },
  {
    entity_id: "switch.fridge",
    state: "on",
    attributes: { friendly_name: "Frigorifero", device_class: "outlet" },
  },
  {
    entity_id: "sensor.fridge_power",
    state: "2",
    attributes: { friendly_name: "Frigorifero power", unit_of_measurement: "W" },
  },
  {
    entity_id: "sensor.fridge_today",
    state: "0.98",
    attributes: {
      friendly_name: "Frigorifero oggi",
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
      { id: "room-bedroom", name: "Cameretta", icon: "mdi:home" },
      { id: "room-living", name: "Salone", icon: "mdi:sofa" },
    ],
    appliances: [
      {
        id: "microwave",
        name: "Microonde",
        device_type: "microonde",
        visual_key: "microonde",
        room_id: "room-bedroom",
        control_entity: "switch.microwave",
        power_entity: "sensor.microwave_power",
        entities: ["switch.microwave", "sensor.microwave_power"],
      },
      {
        id: "fridge",
        name: "Frigorifero",
        device_type: "frigo",
        visual_key: "frigo",
        room_id: "room-living",
        control_entity: "switch.fridge",
        power_entity: "sensor.fridge_power",
        daily_energy_entity: "sensor.fridge_today",
        entities: ["switch.fridge", "sensor.fridge_power", "sensor.fridge_today"],
      },
    ],
    loads: [],
  },
  visibility: { appliances: true },
};

async function boot(page, variant, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript((haStates) => {
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
        else if (message.type === "recorder/statistics_during_period") result = {};
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
  await page.waitForFunction(() => {
    const grid = document.getElementById("appl-kpi-grid");
    return Boolean(
      grid?.querySelector('[data-dm-appliance-kpi="running"]') &&
      grid?.querySelector('[data-dm-appliance-kpi="power"]'),
    );
  });
}

async function expectCentered(page, popup) {
  const delta = await popup.evaluate((node) => {
    const dialog = node.querySelector(".dm-appliance-kpi-dialog,.dm-appliance-daily-dialog");
    const rect = dialog.getBoundingClientRect();
    return {
      x: Math.abs(rect.left + rect.width / 2 - innerWidth / 2),
      y: Math.abs(rect.top + rect.height / 2 - innerHeight / 2),
      align: getComputedStyle(node).alignItems,
      justify: getComputedStyle(node).justifyContent,
    };
  });
  expect(delta.x).toBeLessThan(24);
  expect(delta.y).toBeLessThan(40);
  expect(delta.align).toBe("center");
  expect(delta.justify).toBe("center");
}

for (const variant of ["dashboard.html", "dashboard-en.html"]) {
  test(`${variant}: appliance KPI cards expose centered running/power popups and remove alerts`, async ({ page }, testInfo) => {
    await boot(page, variant, testInfo);

    const grid = page.locator("#appl-kpi-grid");
    const runningCard = grid.locator('[data-dm-appliance-kpi="running"]');
    const powerCard = grid.locator('[data-dm-appliance-kpi="power"]');
    const dailyCard = grid.locator('[data-dm-appliance-kpi="daily"]');

    await expect(runningCard).toBeVisible();
    await expect(runningCard).toContainText(variant === "dashboard.html" ? /IN FUNZIONE/i : /RUNNING/i);
    await expect(runningCard.locator(".g-val")).toHaveText("1");
    await expect(powerCard).toBeVisible();
    await expect(powerCard.locator(".g-val")).toContainText(/922 W/i);
    await expect(grid).not.toContainText(variant === "dashboard.html" ? /AVVISI/i : /ALERTS/i);

    await runningCard.click();
    const runningPopup = page.locator("#dm-appliance-running-popup");
    await expect(runningPopup).toBeVisible();
    await expect(runningPopup.locator("[data-dm-appliance-kpi-summary]")).toHaveText("1");
    await expect(runningPopup.locator(".dm-appliance-kpi-row")).toHaveCount(1);
    await expect(runningPopup).toContainText("Microonde");
    await expect(runningPopup).not.toContainText("Frigorifero");
    await expect(runningPopup.locator('[data-appliance-id="microwave"] [data-dm-art="microwave"]')).toBeVisible();
    await expectCentered(page, runningPopup);
    await runningPopup.locator("[data-dm-appliance-kpi-close]").click();

    await powerCard.click();
    const powerPopup = page.locator("#dm-appliance-power-popup");
    await expect(powerPopup).toBeVisible();
    await expect(powerPopup.locator("[data-dm-appliance-kpi-summary]")).toContainText(/922 W/i);
    await expect(powerPopup.locator(".dm-appliance-kpi-row")).toHaveCount(2);
    await expect(powerPopup.locator(".dm-appliance-kpi-row-main>strong")).toHaveText(["Microonde", "Frigorifero"]);
    await expect(powerPopup).toContainText(/920 W/i);
    await expect(powerPopup).toContainText(/2 W/i);
    await expect(powerPopup.locator('[data-appliance-id="fridge"] [data-dm-art="fridge"]')).toBeVisible();
    await expectCentered(page, powerPopup);
    await powerPopup.locator("[data-dm-appliance-kpi-close]").click();

    await dailyCard.click();
    const dailyPopup = page.locator("#dm-appliance-daily-popup");
    await expect(dailyPopup).toBeVisible();
    await expectCentered(page, dailyPopup);
  });
}
