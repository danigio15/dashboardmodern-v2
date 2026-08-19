import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { saveSection, showRawEntityFields } from "./helpers/entity-field.js";
import { clickBottomTab } from "./helpers/navigation.js";
import { PRIMARY } from "./helpers/variants.js";

const haStates = [
  {
    entity_id: "switch.lavatrice",
    state: "off",
    attributes: { friendly_name: "Lavatrice" },
  },
  {
    entity_id: "sensor.lavatrice_power",
    state: "0",
    attributes: {
      friendly_name: "Lavatrice power",
      unit_of_measurement: "W",
      device_class: "power",
    },
  },
  {
    entity_id: "sensor.solarman_total_load_consumption",
    state: "4123.4",
    attributes: {
      friendly_name: "Total load consumption",
      unit_of_measurement: "kWh",
      device_class: "energy",
      state_class: "total_increasing",
    },
  },
];

const dashboardSeed = {
  schema_version: 4,
  sections: {
    rooms: [
      {
        id: "room-matrimoniale",
        name: "Matrimoniale",
        icon: "mdi:bed-king-outline",
        floor: "Piano 1",
      },
    ],
    appliances: [],
    loads: [],
    energy: {
      house: {},
      grid: {},
      solar: {},
      battery: {},
      metadata: { semantics_version: 4 },
    },
    entityOverrides: {},
  },
  visibility: { appliances: false, energy: false },
};

async function boot(page, variant, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript((states) => {
    window.__haUserData = new Map();
    class MockBridgeSocket extends EventTarget {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;
      readyState = MockBridgeSocket.OPEN;
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
        if (message.type === "get_states") result = states;
        else if (message.type === "frontend/get_user_data") {
          result = { value: window.__haUserData.get(message.key) ?? null };
        } else if (message.type === "frontend/set_user_data") {
          window.__haUserData.set(message.key, structuredClone(message.value));
          result = null;
        }
        this.onmessage?.({
          data: JSON.stringify({
            id: message.id,
            type: "result",
            success: true,
            result,
          }),
        });
      }
      close() {
        this.readyState = MockBridgeSocket.CLOSED;
        this.onclose?.({});
      }
    }
    window.__DASHBOARDMODERN_BRIDGE_WS__ = MockBridgeSocket;
    window.WebSocket = MockBridgeSocket;
  }, haStates);

  await bootNamespacedDashboard(page, variant, testInfo, structuredClone(dashboardSeed));
  await page
    .locator("#setup-wizard")
    .evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate(
    (states) =>
      states.forEach((state) => {
        _RAW_STATES[state.entity_id] = structuredClone(state);
        STATES[state.entity_id] = structuredClone(state);
      }),
    haStates,
  );
  await expect
    .poll(() => page.evaluate(() => Boolean(window.edSecSave?.__dmCanonicalSaveEngine)))
    .toBe(true);
}

async function openEditor(page, tab) {
  await page.locator(".ha-menu-btn").click();
  await page.locator("#cd-app-menu button", { hasText: /Configurazione|Configuration/ }).click();
  await page.locator(`.ed-tab[data-tab="${tab}"]`).click();
}

for (const variant of PRIMARY) {
  test(`${variant}: Save section commits a pending appliance, enables visibility and survives reload`, async ({
    page,
  }, testInfo) => {
    if (testInfo.project.name === "webkit-ipad") test.slow();
    await boot(page, variant, testInfo);
    await openEditor(page, "appliances");

    // The entity fields are readable rows now; the id itself is behind the
    // pencil on each row, so the form is put into manual mode first.
    await showRawEntityFields(page);
    await page.locator("#appl-name").fill("Lavatrice");
    await page.locator("#appl-room").selectOption("room-matrimoniale");
    for (const entity of ["switch.lavatrice", "sensor.lavatrice_power"]) {
      await page.locator("#appl-ent").fill(entity);
      await page.locator("#ed-body .ed-btn-add", { hasText: /questa entità|this entity/i }).click();
    }

    // This is the exact real-device flow that was broken: the user filled the
    // pending appliance and pressed Save section instead of the separate Add
    // appliance button. The old implementation only displayed a success toast.
    // The per-panel button is behind the single section save now.
    await saveSection(page);

    await expect
      .poll(() =>
        page.evaluate(() =>
          DashboardModernModules.store
            .getSection("appliances")
            .find((item) => item.name === "Lavatrice"),
        ),
      )
      .toMatchObject({
        room_id: "room-matrimoniale",
        entities: ["switch.lavatrice", "sensor.lavatrice_power"],
      });
    await expect
      .poll(() =>
        page.evaluate(() => DashboardModernModules.store.getState().visibility.appliances),
      )
      .toBe(true);

    await page.locator("#editor-modal .ed-head-close").last().click();
    await clickBottomTab(page, "appliances-main", testInfo);
    await expect(page.locator("#page-appliances-main")).toContainText("Lavatrice");

    await page.reload();
    await page.waitForFunction(
      () => window.__DASHBOARDMODERN_LEGACY_READY__ && window.DashboardModernModules,
    );
    await expect
      .poll(() =>
        page.evaluate(() =>
          DashboardModernModules.store
            .getSection("appliances")
            .some((item) => item.name === "Lavatrice"),
        ),
      )
      .toBe(true);
    await expect
      .poll(() =>
        page.evaluate(() => DashboardModernModules.store.getState().visibility.appliances),
      )
      .toBe(true);
  });

  test(`${variant}: Energy total meter is dirty, saved canonically, visible and survives reload`, async ({
    page,
  }, testInfo) => {
    if (testInfo.project.name === "webkit-ipad") test.slow();
    await boot(page, variant, testInfo);
    await openEditor(page, "sez1");

    await showRawEntityFields(page);
    const total = page.locator("#dm-energy-house-total_energy");
    await total.fill("sensor.solarman_total_load_consumption");
    await expect(page.locator("[data-energy-actions]")).toHaveAttribute("data-state", "dirty");
    await expect(page.locator("[data-energy-save]")).toBeEnabled();
    await saveSection(page);

    await expect
      .poll(() =>
        page.evaluate(
          () => DashboardModernModules.store.getSection("energy").house?.total_energy || "",
        ),
      )
      .toBe("sensor.solarman_total_load_consumption");
    await expect
      .poll(() => page.evaluate(() => DashboardModernModules.store.getState().visibility.energy))
      .toBe(true);
    await expect(page.locator("[data-energy-actions]")).toHaveAttribute("data-state", "success");

    await page.reload();
    await page.waitForFunction(
      () => window.__DASHBOARDMODERN_LEGACY_READY__ && window.DashboardModernModules,
    );
    await expect
      .poll(() =>
        page.evaluate(
          () => DashboardModernModules.store.getSection("energy").house?.total_energy || "",
        ),
      )
      .toBe("sensor.solarman_total_load_consumption");
    await expect
      .poll(() => page.evaluate(() => DashboardModernModules.store.getState().visibility.energy))
      .toBe(true);
  });
}
