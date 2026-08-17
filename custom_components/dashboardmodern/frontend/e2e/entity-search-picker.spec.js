/* The entity picker on an instance that is big enough to hurt.
 *
 * Three hundred entities is a modest real house and was already enough for the
 * old picker to rebuild three hundred rows on every keystroke. These tests hold
 * the two properties that replaced it: the list paints one page and grows on
 * demand, and the field's own label decides what is proposed first.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const ROOMS = ["kitchen", "living", "bathroom", "garage", "garden"];

function buildStates() {
  const states = [];
  const push = (entity_id, state, attributes) => states.push({ entity_id, state, attributes });
  for (const room of ROOMS) {
    push(`sensor.${room}_temperature`, "21.5", {
      friendly_name: `${room} temperature`,
      unit_of_measurement: "°C",
      device_class: "temperature",
    });
    push(`sensor.${room}_humidity`, "48", {
      friendly_name: `${room} humidity`,
      unit_of_measurement: "%",
      device_class: "humidity",
    });
  }
  for (let index = 0; index < 120; index += 1) {
    push(`light.lamp_${index}`, index % 2 ? "on" : "off", { friendly_name: `Lamp ${index}` });
  }
  for (let index = 0; index < 120; index += 1) {
    push(`switch.socket_${index}`, "off", { friendly_name: `Socket ${index}` });
  }
  for (let index = 0; index < 60; index += 1) {
    push(`automation.routine_${index}`, "on", { friendly_name: `Routine ${index}` });
  }
  return states;
}

const STATES = buildStates();

const seed = {
  schema_version: 4,
  sections: {
    rooms: [
      { id: "room-kitchen", name: "Kitchen", icon: "mdi:sofa", floor: "Ground", temp: "", hum: "" },
    ],
  },
  visibility: {},
};

async function openTemperaturePicker(page) {
  await page.locator('.dm-entity-picker[data-entity-target="ed-pl-temp"]').click();
  await expect(page.locator("#cd-entpick")).toBeVisible();
  await expect(page.locator("#cd-ep-list .dm-ep-row").first()).toBeVisible();
}

const rowIds = (page) =>
  page
    .locator("#cd-ep-list .dm-ep-row")
    .evaluateAll((rows) => rows.map((row) => row.dataset.entity));

test.describe("entity picker search", () => {
  test.beforeEach(async ({ page }) => {
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
    }, STATES);
  });

  for (const variant of ["dashboard.html", "dashboard-en.html"]) {
    test(`${variant}: one page of rows, field-aware ranking, chips and keyboard`, async ({
      page,
    }, testInfo) => {
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
      }, STATES);
      await expect(page.locator("#ed-pl-temp")).toBeVisible();

      await openTemperaturePicker(page);

      // One page in the DOM, the whole inventory in the counter.
      const first = await rowIds(page);
      expect(first.length).toBeGreaterThan(10);
      expect(first.length).toBeLessThanOrEqual(60);
      await expect(page.locator("#dm-ep-status")).toContainText(String(STATES.length));

      // The field says "temperature", so temperature sensors are proposed and
      // marked before anything else — with no query typed at all.
      expect(first[0]).toMatch(/^sensor\.\w+_temperature$/);
      await expect(page.locator("#cd-ep-list .dm-ep-row").first()).toHaveAttribute(
        "data-hinted",
        "true",
      );

      // Scrolling extends the same result set instead of re-rendering it.
      await page.locator("#cd-ep-list").evaluate((list) => {
        list.scrollTop = list.scrollHeight;
      });
      await expect.poll(async () => (await rowIds(page)).length).toBeGreaterThan(first.length);

      // Typing narrows to the two matches, temperature first because that is
      // what this field is for.
      await page.locator("#cd-ep-search").fill("kitchen");
      await expect
        .poll(async () => await rowIds(page))
        .toEqual(["sensor.kitchen_temperature", "sensor.kitchen_humidity"]);

      // A domain chip filters the same match set.
      await page.locator("#cd-ep-search").fill("");
      await page.locator('#dm-ep-chips [data-dm-domain="light"]').click();
      const lights = await rowIds(page);
      expect(lights.length).toBeGreaterThan(0);
      expect(lights.every((id) => id.startsWith("light."))).toBe(true);
      await page.locator('#dm-ep-chips [data-dm-domain="*"]').click();

      // Keyboard: first row without touching the list.
      await page.locator("#cd-ep-search").fill("kitchen temperature");
      await page.locator("#cd-ep-search").press("ArrowDown");
      await page.locator("#cd-ep-search").press("Enter");
      await expect(page.locator("#cd-entpick")).toHaveCount(0);
      await expect(page.locator("#ed-pl-temp")).toHaveValue("sensor.kitchen_temperature");

      // Clicking a row still writes the field, which is the contract the
      // vendored `cdEpChoose` has always had.
      await page.locator('.dm-entity-picker[data-entity-target="dm-humidity-new"]').click();
      await page.locator("#cd-ep-search").fill("kitchen humidity");
      await page.locator("#cd-ep-list .dm-ep-row").first().click();
      await expect(page.locator("#dm-humidity-new")).toHaveValue("sensor.kitchen_humidity");
    });
  }
});
