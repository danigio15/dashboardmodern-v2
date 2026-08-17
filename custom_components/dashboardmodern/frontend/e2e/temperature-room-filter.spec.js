import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

/* The room tabs above the Temperature cards used to have two owners: this layer
 * (beta26/27) and the beta16 layout repair pass. Whichever built the buttons
 * last decided which module state the click updated, and the other one then
 * reset the active pill and re-showed every card at the next render — so the
 * filter looked broken on a real device, where sensor updates repaint the grid
 * continuously. These tests pin the single-owner behaviour: the selection has to
 * survive a repaint, and it has to survive a foreign renderer rebuilding the
 * grid from scratch. */

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
        hum: "sensor.matrimoniale_humidity",
        temp_name: "Pippo",
      },
    ],
  },
  visibility: { temp: true },
};

const states = [
  {
    entity_id: "sensor.cameretta_temperature",
    state: "31.3",
    attributes: { unit_of_measurement: "°C", device_class: "temperature" },
  },
  {
    entity_id: "sensor.cameretta_humidity",
    state: "54",
    attributes: { unit_of_measurement: "%", device_class: "humidity" },
  },
  {
    entity_id: "sensor.cameretta_seconda_temperature",
    state: "30.1",
    attributes: { unit_of_measurement: "°C", device_class: "temperature" },
  },
  {
    entity_id: "sensor.matrimoniale_temperature",
    state: "30.8",
    attributes: { unit_of_measurement: "°C", device_class: "temperature" },
  },
  {
    entity_id: "sensor.matrimoniale_humidity",
    state: "51",
    attributes: { unit_of_measurement: "%", device_class: "humidity" },
  },
];

async function bootTemperaturePage(page, testInfo) {
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
}

function visibleRooms(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("#temp-grid .temp-card[data-room-id]")]
      .filter((card) => card.getBoundingClientRect().height > 0)
      .map((card) => card.dataset.roomId),
  );
}

test("Temperature room tabs filter the cards and keep the selection", async ({
  page,
}, testInfo) => {
  await bootTemperaturePage(page, testInfo);

  const tabs = page.locator("#dm-beta16-temperature-tabs");
  await expect(tabs).toBeVisible();
  expect(
    await tabs
      .locator("button[data-room-filter]")
      .evaluateAll((nodes) => nodes.map((node) => node.dataset.roomFilter)),
  ).toEqual(["all", "room-cameretta", "room-matrimoniale"]);
  // Both Cameretta associations plus Matrimoniale are on screen unfiltered.
  expect(await visibleRooms(page)).toEqual([
    "room-cameretta",
    "room-cameretta",
    "room-matrimoniale",
  ]);

  const matrimoniale = tabs.locator('button[data-room-filter="room-matrimoniale"]');
  await matrimoniale.click();
  await expect(matrimoniale).toHaveClass(/active/);
  await expect(matrimoniale).toHaveAttribute("aria-pressed", "true");
  await expect(tabs.locator('button[data-room-filter="all"]')).not.toHaveClass(/active/);
  await expect.poll(() => visibleRooms(page)).toEqual(["room-matrimoniale"]);

  // A live sensor update repaints the grid. The selection must survive it — this
  // is what made the filter look broken on a real device.
  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent("dashboardmodern:state-changed", {
        detail: { entity_ids: ["sensor.matrimoniale_temperature"] },
      }),
    );
    window.buildTempCards?.();
    window.renderTemperature?.();
  });
  await expect(matrimoniale).toHaveClass(/active/);
  expect(await visibleRooms(page)).toEqual(["room-matrimoniale"]);

  // Same contract when another owner rebuilds the grid from scratch.
  await page.evaluate(() => {
    const grid = document.getElementById("temp-grid");
    const cards = [...grid.children].map((card) => card.cloneNode(true));
    cards.forEach((card) => {
      card.hidden = false;
      card.style.removeProperty("display");
    });
    grid.replaceChildren(...cards);
  });
  await expect.poll(() => visibleRooms(page)).toEqual(["room-matrimoniale"]);

  const all = tabs.locator('button[data-room-filter="all"]');
  await all.click();
  await expect(all).toHaveClass(/active/);
  await expect
    .poll(() => visibleRooms(page))
    .toEqual(["room-cameretta", "room-cameretta", "room-matrimoniale"]);
});

test("Temperature room tabs have a single owner", async ({ page }, testInfo) => {
  await bootTemperaturePage(page, testInfo);
  // One nav, and every button belongs to the owner that also renders the cards.
  expect(
    await page.evaluate(() =>
      [
        ...document.querySelectorAll(
          '#page-temp nav[aria-label="Stanze temperatura"],#page-temp nav[aria-label="Temperature rooms"]',
        ),
      ].map((node) => node.id),
    ),
  ).toEqual(["dm-beta16-temperature-tabs"]);
  expect(
    await page
      .locator("#dm-beta16-temperature-tabs button")
      .evaluateAll((nodes) =>
        nodes.every((node) => node.classList.contains("dm-beta27-temperature-tab")),
      ),
  ).toBe(true);
});
