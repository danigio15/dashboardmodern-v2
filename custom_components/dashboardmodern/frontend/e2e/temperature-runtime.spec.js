// DM-FIX-20260815A
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
    // A fresh E2E profile intentionally has not completed onboarding. The
    // production wizard is expected here, but Config must receive pointer events.
    await page
      .locator("#setup-wizard")
      .evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
    await page.evaluate((haStates) => {
      haStates.forEach((state) => {
        _RAW_STATES[state.entity_id] = state;
        STATES[state.entity_id] = state;
      });
      document.documentElement.style.setProperty("--primary-text-color", "#ffffff");
      apriConfigEntita();
      editorSwitch("sez7");
    }, states);
    await expect(page.locator('#ed-body[data-renderer="temperature"]')).toBeVisible();
    await expect
      .poll(() =>
        page
          .locator("[data-temperature-room]")
          .evaluateAll((rows) =>
            rows.every((row) => Boolean(row.querySelector(".ed-row-new")?.textContent?.trim())),
          ),
      )
      .toBe(true);
    expect(
      await page.locator("[data-temperature-room] .ed-row-new").evaluateAll((nodes) =>
        nodes.every((node) => {
          const text = node.textContent?.trim();
          const color = getComputedStyle(node).color.replaceAll(" ", "");
          return Boolean(text) && color !== "rgb(255,255,255)" && color !== "rgba(255,255,255,1)";
        }),
      ),
    ).toBe(true);
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

    // The room owns its icon. Temperature must not expose the old duplicate
    // symbol editor that regressed in the real Home Assistant installation.
    await expect(page.locator("#dm-temperature-icon")).toBeHidden();
    await expect(page.locator("[data-temperature-form] [data-icon-field]")).toHaveCount(0);
    await expect(page.locator("[data-temperature-submit]")).toHaveText(
      variant === "dashboard-en.html" ? "ASSOCIATE SENSORS" : "ASSOCIA SENSORI",
    );

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
    await expect
      .poll(() =>
        page
          .locator("[data-temperature-room]")
          .evaluateAll((rows) =>
            rows.every((row) => Boolean(row.querySelector(".ed-row-new")?.textContent?.trim())),
          ),
      )
      .toBe(true);
    await page.evaluate(() => editorSwitch("sez1"));
    await page.evaluate(() => editorSwitch("sez7"));
    await expect(
      page.locator('[data-temperature-room][data-room-id="room-kitchen"]'),
    ).toContainText("sensor.kitchen_temperature");
    await expect(page.locator("#dm-temperature-icon")).toBeHidden();
    await page.screenshot({
      path: `test-results/${testInfo.project.name}-${variant}-temperature-saved.png`,
    });
    await page.locator("#editor-modal .ed-head-close").last().click();
    await expect(page.locator("#editor-modal")).toHaveCount(0);
    await clickBottomTab(page, "temp", testInfo);
    await expect(page.locator("#page-temp")).toHaveClass(/active/);
    const temperatureCard = page.locator("#temp-grid .temp-card");
    await expect(temperatureCard).toContainText("Kitchen");
    await expect(temperatureCard).toHaveCount(1);
    const temperatureLayout = await temperatureCard.evaluate((node) => {
      const style = getComputedStyle(node);
      const box = node.getBoundingClientRect();
      return {
        tag: node.tagName,
        aspectRatio: style.aspectRatio,
        width: box.width,
        height: box.height,
      };
    });
    expect(temperatureLayout.tag).toBe("ARTICLE");
    expect(temperatureLayout.aspectRatio).toBe("auto");
    expect(temperatureLayout.height).toBeLessThan(temperatureLayout.width * 1.25);

    // Do not depend on an external MDI renderer: a configured canonical room
    // must always have a visible local icon in the live dashboard.
    const roomIcon = temperatureCard.locator(".dm-temperature-icon-fallback");
    await expect(roomIcon).toBeVisible();
    await expect(roomIcon).toHaveText("🛋️");
    await expect(temperatureCard).not.toContainText("🔥");
    await expect(page.locator("#temp-grid .temp-value")).toContainText("21.5");
    await page.evaluate(() => {
      _RAW_STATES["sensor.kitchen_temperature"].state = "23.7";
      STATES["sensor.kitchen_temperature"].state = "23.7";
      renderTemperature();
    });
    await expect(page.locator("#temp-grid .temp-value")).toContainText("23.7");
    await expect(roomIcon).toBeVisible();
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
      document.documentElement.style.setProperty("--primary-text-color", "#ffffff");
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
