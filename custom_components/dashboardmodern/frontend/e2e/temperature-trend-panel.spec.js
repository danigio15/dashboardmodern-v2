import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

/* The Temperature page says how a room is now; the panel under the cards says
 * how it has been. It reads the room selection from the tab strip — the single
 * owner of that state — so picking a room draws that room's probes, and "all"
 * compares the rooms. The history comes from the same
 * history/history_during_period the card popup already uses. */

const seed = {
  schema_version: 4,
  sections: {
    rooms: [
      {
        id: "r1",
        name: "Cameretta",
        icon: "🛏️",
        temp: "sensor.a_temperature",
        hum: "sensor.a_humidity",
        temp_name: "Cameretta",
        metadata: {
          temperature_entries: [
            {
              id: "temperature-extra-1",
              name: "Seconda sonda",
              temp: "sensor.b_temperature",
              hum: "sensor.b_humidity",
            },
          ],
        },
      },
      {
        id: "r2",
        name: "Matrimoniale",
        icon: "🛏️",
        temp: "sensor.c_temperature",
        hum: "sensor.c_humidity",
        temp_name: "Pippo",
      },
    ],
  },
  visibility: { temp: true },
};
const states = [
  { entity_id: "sensor.a_temperature", state: "31.4", attributes: { unit_of_measurement: "°C" } },
  { entity_id: "sensor.a_humidity", state: "54", attributes: { unit_of_measurement: "%" } },
  { entity_id: "sensor.c_temperature", state: "30.8", attributes: { unit_of_measurement: "°C" } },
];
test("the trend panel follows the room tabs", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.route("https://**", (r) => r.fulfill({ status: 200, body: "" }));
  await page.addInitScript((haStates) => {
    window.WebSocket = class extends EventTarget {
      static OPEN = 1;
      readyState = 1;
      constructor() {
        super();
        queueMicrotask(() => this.onmessage?.({ data: JSON.stringify({ type: "auth_required" }) }));
      }
      send(raw) {
        const m = JSON.parse(raw);
        if (m.type === "auth") {
          this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
          return;
        }
        let result = [];
        if (m.type === "get_states") result = haStates;
        if (m.type === "history/history_during_period") {
          const entity = m.entity_ids?.[0];
          const end = Date.now();
          const rows = [];
          for (let i = 96; i >= 0; i -= 1)
            rows.push({
              s: (24 + Math.sin(i / 8) * 4).toFixed(1),
              lu: (end - i * 15 * 60 * 1000) / 1000,
            });
          result = { [entity]: rows };
        }
        this.onmessage?.({
          data: JSON.stringify({ id: m.id, type: "result", success: true, result }),
        });
      }
      close() {}
    };
  }, states);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
  await page.locator("#setup-wizard").evaluateAll((n) => n.forEach((x) => x.remove()));
  await page.evaluate((haStates) => {
    haStates.forEach((s) => {
      _RAW_STATES[s.entity_id] = s;
      STATES[s.entity_id] = s;
    });
    document.querySelectorAll(".page").forEach((n) => n.classList.remove("active"));
    document.getElementById("page-temp")?.classList.add("active");
    window.render?.();
    window.buildTempCards?.();
  }, states);
  const panel = page.locator("#dm-temperature-trend");
  await expect(panel).toHaveAttribute("data-state", "ready", { timeout: 8000 });
  await expect(panel.locator(".dm-trend-title")).toHaveText("Tutte le stanze");
  expect(await panel.locator(".dm-trend-series").count()).toBe(2);
  await page.locator('#dm-beta16-temperature-tabs button[data-room-filter="r1"]').click();
  await expect(panel.locator(".dm-trend-title")).toHaveText("Cameretta");
  await expect.poll(() => panel.locator(".dm-trend-series").count()).toBe(2);
  await expect
    .poll(() => panel.locator(".dm-trend-chip-name").allTextContents())
    .toEqual(["Cameretta", "Seconda sonda"]);
});
