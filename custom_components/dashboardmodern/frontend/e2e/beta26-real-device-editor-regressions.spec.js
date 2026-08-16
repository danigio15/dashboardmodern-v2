import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const seed = {
  schema_version: 4,
  sections: {
    rooms: [
      {
        id: "room-cameretta",
        name: "Cameretta",
        icon: "🛏️",
        temp: "sensor.cameretta_temperature",
        hum: "sensor.cameretta_humidity",
        metadata: {},
      },
      {
        id: "room-matrimoniale",
        name: "Matrimoniale",
        icon: "🛏️",
        temp: "sensor.matrimoniale_temperature",
        hum: "sensor.matrimoniale_humidity",
        metadata: {},
      },
    ],
    cameras: [],
    appliances: [
      {
        id: "appliance-dishwasher",
        name: "Lavastoviglie",
        visual_type: "asset",
        visual_key: "lavastoviglie",
        device_type: "lavastoviglie",
        icon: "lavastoviglie",
        power_entity: "sensor.dishwasher_power",
        entities: ["sensor.dishwasher_power"],
        show_in_dashboard: true,
      },
    ],
    loads: [
      {
        id: "load-boiler",
        name: "Boiler",
        icon: "mdi:power-plug",
        category: "secondary",
        power_entity: "sensor.boiler_power",
        show_in_dashboard: true,
      },
    ],
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    energyLoads: [],
    entityOverrides: {},
  },
  visibility: { home: true, appliances: true, temperature: true, energy: true },
};

async function boot(page, variant, testInfo) {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 150_000 : 90_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(() => {
    class MockBridgeSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;
      readyState = 1;
      onopen = null;
      onmessage = null;
      onclose = null;
      onerror = null;

      constructor() {
        queueMicrotask(() => {
          this.onopen?.({});
          this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
        });
      }

      send(raw) {
        const message = JSON.parse(raw);
        if (message.type === "auth") return;
        let result = null;
        if (message.type === "get_states") result = [];
        if (message.type === "frontend/get_user_data") result = { value: null };
        if (message.type === "frontend/set_user_data") result = null;
        queueMicrotask(() =>
          this.onmessage?.({
            data: JSON.stringify({
              id: message.id,
              type: "result",
              success: true,
              result,
            }),
          }),
        );
      }

      close() {
        this.readyState = 3;
        this.onclose?.({});
      }
    }
    window.__DASHBOARDMODERN_HOSTED__ = true;
    window.__DASHBOARDMODERN_BRIDGE_WS__ = MockBridgeSocket;
    window.WebSocket = MockBridgeSocket;
  });

  await bootNamespacedDashboard(page, variant, testInfo, seed);
  await page
    .locator("#setup-wizard")
    .evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  await expect
    .poll(() => page.evaluate(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true))
    .toBe(true);
}

for (const variant of ["dashboard.html", "dashboard-en.html"]) {
  test(`${variant}: beta26 keeps configured rooms reusable and aligns editor icons`, async ({
    page,
  }, testInfo) => {
    await boot(page, variant, testInfo);

    // Real mobile regression: a late legacy pass can disable already-configured
    // rooms after Beta25 rendered. The capture owner must repair them before the
    // native Android/iOS select UI opens.
    await page.evaluate(() => {
      if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
      editorSwitch("sez7");
    });
    await expect(page.locator("[data-beta25-temperature-editor]")).toBeVisible();
    await page.waitForTimeout(320);
    await page.evaluate(() => {
      const select = document.getElementById("dm-temperature-room");
      for (const option of select?.options || []) {
        if (option.value) option.disabled = true;
      }
      select?.dispatchEvent(new Event("pointerdown", { bubbles: true, cancelable: true }));
    });
    await expect(page.locator('#dm-temperature-room option[value="room-cameretta"]')).toBeEnabled();
    await expect(
      page.locator('#dm-temperature-room option[value="room-matrimoniale"]'),
    ).toBeEnabled();

    // Loads use the same canonical searchable icon picker as the other editor
    // surfaces instead of exposing only a raw text field.
    await page.evaluate(() => {
      const body = document.getElementById("ed-body");
      DashboardModernModules.render.mountLoadsEditor(body, "load-boiler");
      window.dispatchEvent(new CustomEvent("dashboardmodern:runtime-ready"));
    });
    const loadIcon = page.locator("#dm-load-icon");
    const loadPicker = page.locator(".dm-beta26-load-icon-picker");
    await expect(loadIcon).toHaveValue("mdi:power-plug");
    await expect(loadPicker).toBeVisible();
    await loadPicker.click();
    await expect(page.locator("#dm-visual-picker")).toBeVisible();
    await page
      .locator('#dm-visual-picker .dm-picker-option:has([data-token="mdi:lightbulb"])')
      .click();
    await expect(loadIcon).toHaveValue("mdi:lightbulb");

    // Appliance configuration must show the exact canonical artwork already
    // used by the dashboard cards, both in the list and in the real edit modal.
    await page.evaluate(() => {
      const body = document.getElementById("ed-body");
      body.innerHTML = window.editorRenderAppliances();
      DashboardModernModules.render.mountCurrentEditor("appliances", body);
      window.dispatchEvent(new CustomEvent("dashboardmodern:runtime-ready"));
    });
    await expect(
      page.locator(
        '.ed-list .dm-beta26-appliance-row-art .dm-appliance-art[data-dm-art="dishwasher"]',
      ),
    ).toHaveCount(1);
    await page.locator(".ed-list .ed-row .ed-del").first().click();
    const applianceDialog = page.locator("#dm-appliance-editor-modal");
    await expect(applianceDialog).toBeVisible();
    await expect(
      applianceDialog.locator('[data-icon-preview] .dm-appliance-art[data-dm-art="dishwasher"]'),
    ).toHaveCount(1);
    await expect(
      applianceDialog.locator('[data-type-trigger] .dm-appliance-art[data-dm-art="dishwasher"]'),
    ).toHaveCount(1);
  });
}