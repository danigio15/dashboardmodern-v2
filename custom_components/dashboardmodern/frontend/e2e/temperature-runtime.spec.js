import { expect, test } from "@playwright/test";

const states = [
  {
    entity_id: "sensor.kitchen_temperature",
    state: "21.5",
    attributes: {
      friendly_name: "Kitchen temperature",
      unit_of_measurement: "°C",
      device_class: "temperature",
    },
  },
  {
    entity_id: "sensor.kitchen_humidity",
    state: "48",
    attributes: {
      friendly_name: "Kitchen humidity",
      unit_of_measurement: "%",
      device_class: "humidity",
    },
  },
];

for (const variant of ["dashboard.html", "dashboard-en.html"]) {
  test(`${variant}: Temperature editor, HA picker, persistence and live dashboard`, async ({
    page,
  }, testInfo) => {
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
          if (message.type === "auth")
            this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
          else
            this.onmessage?.({
              data: JSON.stringify({
                id: message.id,
                type: "result",
                success: true,
                result: message.type === "get_states" ? haStates : [],
              }),
            });
        }
        close() {}
      };
      localStorage.setItem(
        "cd_connection",
        JSON.stringify({ token: "e2e-token", ws_url: "ws://home-assistant.test/api/websocket" }),
      );
      localStorage.setItem(
        "dm_dashboard_state",
        JSON.stringify({ schema_version: 4, sections: { rooms: [] }, visibility: {} }),
      );
    }, states);
    await page.goto(`/legacy/${variant}`);
    await page.waitForFunction(
      () => window.__DASHBOARDMODERN_LEGACY_READY__ && window.DashboardModernModules,
    );
    await page.evaluate((haStates) => {
      haStates.forEach((state) => {
        _RAW_STATES[state.entity_id] = state;
        STATES[state.entity_id] = state;
      });
      apriConfigEntita();
      editorSwitch("sez7");
    }, states);
    await expect(page.locator('#ed-body[data-renderer="temperature"]')).toBeVisible();
    await expect(page.locator("#ed-pl-temp")).toBeVisible();
    for (let index = 0; index < 20; index++) await page.evaluate(() => editorSwitch("sez7"));
    expect(
      await page.locator("#ed-body").evaluate((body) => ({
        inputs: body.querySelectorAll("[data-entity-input]").length,
        pickers: body.querySelectorAll(".dm-entity-picker").length,
        targets: new Set(
          [...body.querySelectorAll(".dm-entity-picker")].map(
            (button) => button.dataset.entityTarget,
          ),
        ).size,
      })),
    ).toEqual({ inputs: 2, pickers: 2, targets: 2 });
    await page.screenshot({
      path: `test-results/${testInfo.project.name}-${variant}-temperature-config.png`,
    });
    await page.locator('.dm-entity-picker[data-entity-target="ed-pl-temp"]').click();
    await expect(page.locator("#cd-entpick")).toBeVisible();
    await page.locator("#cd-ep-search").fill("kitchen temperature");
    await expect(page.locator("#cd-ep-list")).toContainText("sensor.kitchen_temperature");
    await page.screenshot({
      path: `test-results/${testInfo.project.name}-${variant}-temperature-picker.png`,
    });
    await page
      .locator("#cd-ep-list", { hasText: "sensor.kitchen_temperature" })
      .locator("div[onclick]")
      .click();
    await page.locator("#dm-temperature-new-name").fill("Kitchen");
    await page.locator("[data-temperature-add]").click();
    await expect(page.locator('[data-temperature-room] input[id^="dm-temperature-"]')).toHaveValue(
      "sensor.kitchen_temperature",
    );
    await page.evaluate(() => editorSwitch("sez1"));
    await page.evaluate(() => editorSwitch("sez7"));
    await expect(page.locator('[data-temperature-room] input[id^="dm-temperature-"]')).toHaveValue(
      "sensor.kitchen_temperature",
    );
    await page.screenshot({
      path: `test-results/${testInfo.project.name}-${variant}-temperature-saved.png`,
    });
    await page.evaluate(() => {
      document.getElementById("editor-modal")?.remove();
      showPage("temp");
      buildTempCards();
      renderTemperature();
    });
    await expect(page.locator("#temp-grid .cp-card")).toContainText("Kitchen");
    await expect(page.locator("#temp-grid .temp-value")).toContainText("21.5");
    await page.evaluate(() => {
      _RAW_STATES["sensor.kitchen_temperature"].state = "23.7";
      STATES["sensor.kitchen_temperature"].state = "23.7";
      renderTemperature();
    });
    await expect(page.locator("#temp-grid .temp-value")).toContainText("23.7");
    await page.screenshot({
      path: `test-results/${testInfo.project.name}-${variant}-temperature-dashboard.png`,
      fullPage: true,
    });
  });
}
