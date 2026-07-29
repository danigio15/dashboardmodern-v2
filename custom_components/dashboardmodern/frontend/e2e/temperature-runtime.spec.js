import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { clickBottomTab } from "./helpers/navigation.js";

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

const temperatureSeed = {
  schema_version: 4,
  sections: {
    rooms: [
      {
        id: "room-kitchen",
        name: "Kitchen",
        icon: "mdi:sofa",
        floor: "Ground",
        order: 3,
        metadata: { source: "e2e" },
        rgb: "12,34,56",
        temp: "",
        hum: "",
      },
      {
        id: "room-bathroom",
        name: "Bathroom",
        icon: "mdi:shower",
        floor: "First",
        temp: "",
        hum: "",
      },
    ],
  },
  visibility: {},
};

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
    }, states);
    await bootNamespacedDashboard(page, variant, testInfo, temperatureSeed);
    await expect
      .poll(() =>
        page.evaluate(() =>
          DashboardModernModules.store.getSection("rooms").map((room) => room.id),
        ),
      )
      .toEqual(["room-kitchen", "room-bathroom"]);
    // A fresh E2E profile intentionally has not completed onboarding.  The
    // production wizard is therefore expected here, but Config must receive
    // real pointer events for this editor-focused scenario.
    await page
      .locator("#setup-wizard")
      .evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
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
    await page.locator("#dm-temperature-room").selectOption("room-kitchen");
    await page.locator("#dm-humidity-new").fill("sensor.kitchen_humidity");
    await page.locator("[data-temperature-submit]").click();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const room = DashboardModernModules.store
            .getSection("rooms")
            .find((item) => item.id === "room-kitchen");
          return { temp: room?.temp, hum: room?.hum };
        }),
      )
      .toEqual({
        temp: "sensor.kitchen_temperature",
        hum: "sensor.kitchen_humidity",
      });
    await expect(
      page.locator('[data-temperature-room][data-room-id="room-kitchen"]'),
    ).toContainText("sensor.kitchen_temperature");
    await page.evaluate(() => editorSwitch("sez1"));
    await page.evaluate(() => editorSwitch("sez7"));
    await expect(
      page.locator('[data-temperature-room][data-room-id="room-kitchen"]'),
    ).toContainText("sensor.kitchen_temperature");
    await page.screenshot({
      path: `test-results/${testInfo.project.name}-${variant}-temperature-saved.png`,
    });
    await page.locator("#editor-modal .ed-head-close").last().click();
    await expect(page.locator("#editor-modal")).toHaveCount(0);
    await clickBottomTab(page, "temp");
    await expect(page.locator("#page-temp")).toHaveClass(/active/);
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
    const roomBeforeDelete = await page.evaluate(() => {
      const {
        temp: _temp,
        hum: _hum,
        ...room
      } = DashboardModernModules.store.getSection("rooms")[0];
      return room;
    });
    await page.evaluate(() => {
      apriConfigEntita();
      editorSwitch("sez7");
    });
    await page
      .locator('[data-temperature-room][data-room-id="room-kitchen"] [data-temperature-delete]')
      .click();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const room = DashboardModernModules.store
            .getSection("rooms")
            .find((value) => value.id === "room-kitchen");
          const { temp, hum, ...preserved } = room;
          return {
            preserved,
            temp,
            hum,
            roomCount: DashboardModernModules.store.getSection("rooms").length,
          };
        }),
      )
      .toEqual({ preserved: roomBeforeDelete, temp: "", hum: "", roomCount: 2 });
  });
}
