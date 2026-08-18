import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

/* The small label above the reading used to have three writers: the renderers
 * wrote the generic word at creation, the Beta 17 repair pass wrote the room's
 * custom name on every card of that room, and the Beta 27 sync wrote it per
 * association. They disagreed, so the label flipped between "Temperatura" and
 * the custom name on every repaint — and a real install repaints on every
 * sensor update. This pins one value per association, across repaints. */

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
        temp_name: "Cameretta",
        metadata: {
          temperature_entries: [
            {
              id: "temperature-extra-1",
              name: "Seconda sonda",
              temp: "sensor.cameretta_seconda_temperature",
            },
          ],
        },
      },
      {
        id: "room-matrimoniale",
        name: "Matrimoniale",
        icon: "🛏️",
        temp: "sensor.matrimoniale_temperature",
        temp_name: "Pippo",
      },
    ],
  },
  visibility: { temp: true },
};

const states = [
  {
    entity_id: "sensor.cameretta_temperature",
    state: "31.4",
    attributes: { unit_of_measurement: "°C", device_class: "temperature" },
  },
  {
    entity_id: "sensor.cameretta_humidity",
    state: "54",
    attributes: { unit_of_measurement: "%", device_class: "humidity" },
  },
  {
    entity_id: "sensor.matrimoniale_temperature",
    state: "30.8",
    attributes: { unit_of_measurement: "°C", device_class: "temperature" },
  },
];

test("the label above each reading never changes on its own", async ({ page }, testInfo) => {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript((haStates) => {
    window.WebSocket = class extends EventTarget {
      static OPEN = 1;
      readyState = 1;
      constructor() {
        super();
        queueMicrotask(() => this.onmessage?.({ data: JSON.stringify({ type: "auth_required" }) }));
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

  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
  await page
    .locator("#setup-wizard")
    .evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  await page.evaluate((haStates) => {
    haStates.forEach((state) => {
      _RAW_STATES[state.entity_id] = state;
      STATES[state.entity_id] = state;
    });
    document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
    document.getElementById("page-temp")?.classList.add("active");
    window.render?.();
    window.buildTempCards?.();
  }, states);
  await expect(page.locator("#temp-grid .temp-card").first()).toBeVisible();

  // Sample every association while forcing the repaints a live install produces.
  const seen = await page.evaluate(async () => {
    const values = {};
    for (let round = 0; round < 100; round += 1) {
      for (const card of document.querySelectorAll("#temp-grid .temp-card[data-room-id]")) {
        const key = `${card.dataset.roomId}::${card.dataset.temperatureId || "primary"}`;
        const label = card.querySelector(".cp-temp-current-lbl")?.textContent || "";
        values[key] = values[key] || [];
        if (!values[key].includes(label)) values[key].push(label);
      }
      if (round % 8 === 0) {
        window.dispatchEvent(
          new CustomEvent("dashboardmodern:state-changed", {
            detail: { entity_ids: ["sensor.cameretta_temperature"] },
          }),
        );
        window.buildTempCards?.();
        window.renderTemperature?.();
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    return values;
  });

  // The first association carries the room's custom name, an extra probe its
  // own, and each one keeps exactly that value for the whole session.
  expect(seen).toEqual({
    "room-cameretta::primary": ["Cameretta"],
    "room-cameretta::temperature-extra-1": ["Seconda sonda"],
    "room-matrimoniale::primary": ["Pippo"],
  });
});
