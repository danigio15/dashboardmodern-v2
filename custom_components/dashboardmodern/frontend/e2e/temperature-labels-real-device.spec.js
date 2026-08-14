import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { clickBottomTab } from "./helpers/navigation.js";

const seed = {
  schema_version: 4,
  sections: {
    rooms: [
      {
        id: "room-cameretta",
        name: "Cameretta",
        icon: "mdi:bed",
        temp: "sensor.temperatura_cameretta_temperature",
        hum: "sensor.temperatura_cameretta_humidity",
        temp_name: "Temperatura cameretta",
        hum_name: "Umidità cameretta",
      },
    ],
  },
  visibility: {},
};

const states = [
  {
    entity_id: "sensor.temperatura_cameretta_temperature",
    state: "22.4",
    attributes: { unit_of_measurement: "°C", device_class: "temperature" },
  },
  {
    entity_id: "sensor.temperatura_cameretta_humidity",
    state: "51",
    attributes: { unit_of_measurement: "%", device_class: "humidity" },
  },
];

for (const variant of ["dashboard.html", "dashboard-en.html"]) {
  test(`${variant}: configured Temperature keeps room name and custom entity names`, async ({
    page,
  }, testInfo) => {
    await page.route("https://**", (route) =>
      route.fulfill({ status: 200, body: "" }),
    );
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
          } else {
            this.onmessage?.({
              data: JSON.stringify({
                id: message.id,
                type: "result",
                success: true,
                result: message.type === "get_states" ? haStates : [],
              }),
            });
          }
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
        _RAW_STATES[state.entity_id] = state;
        STATES[state.entity_id] = state;
      });
      apriConfigEntita();
      editorSwitch("sez7");
    }, states);

    const row = page.locator(
      '[data-temperature-room][data-room-id="room-cameretta"]',
    );
    await expect(row).toBeVisible();
    await expect(
      row.locator(":scope > .ed-row-main > .ed-row-new"),
    ).toHaveText("Cameretta");
    await expect(row).toContainText("Temperatura cameretta");
    await expect(row).toContainText("Umidità cameretta");

    await row.locator("[data-temperature-edit]").click();
    await expect(page.locator("#dm-temperature-name")).toHaveValue(
      "Temperatura cameretta",
    );
    await expect(page.locator("#dm-humidity-name")).toHaveValue(
      "Umidità cameretta",
    );

    await page.locator("#editor-modal .ed-head-close").last().click();
    await clickBottomTab(page, "temp", testInfo);
    const card = page.locator(
      '#temp-grid .temp-card[data-room-id="room-cameretta"]',
    );
    await expect(card).toContainText("Cameretta");
    await expect(card.locator(".cp-temp-current-lbl")).toHaveText(
      "Temperatura cameretta",
    );
    await expect(card.locator(".cp-temp-target .lbl")).toContainText(
      "Umidità cameretta",
    );
  });
}
