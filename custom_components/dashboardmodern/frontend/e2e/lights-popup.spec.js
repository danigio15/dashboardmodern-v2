/* The Gestione Luci popup on a real page, with a real Home Assistant socket
 * behind it: what each light offers, and what Home Assistant is actually asked
 * to do when the user touches it. */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const seed = {
  schema_version: 4,
  sections: {
    rooms: [
      { id: "room-salone", name: "Salone", icon: "mdi:sofa" },
      { id: "room-garage", name: "Garage", icon: "mdi:garage" },
    ],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true },
};

async function boot(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(() => {
    class MockBridgeSocket extends EventTarget {
      static OPEN = 1;
      readyState = 1;
      onopen = null;
      onmessage = null;
      onclose = null;
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
        if (message.type === "get_states") result = [];
        if (message.type === "frontend/get_user_data") result = { value: null };
        globalThis.__DM_SERVICE_CALLS__ ||= [];
        if (message.type === "call_service") globalThis.__DM_SERVICE_CALLS__.push(message);
        queueMicrotask(() =>
          this.onmessage?.({
            data: JSON.stringify({ id: message.id, type: "result", success: true, result }),
          }),
        );
      }
      close() {}
    }
    window.WebSocket = MockBridgeSocket;
  });
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
}

async function openLights(page) {
  await page.evaluate(() => {
    localStorage.setItem(
      "cd_luci",
      JSON.stringify({
        "light.strip": "Strip TV",
        "light.faretti": "Faretti",
        "switch.garage": "Lampada garage",
      }),
    );
    localStorage.setItem(
      "cd_luci_rooms",
      JSON.stringify({
        "light.strip": "room-salone",
        "light.faretti": "room-salone",
        "switch.garage": "room-garage",
      }),
    );
    window.eval(`
      _RAW_STATES['light.strip'] = { state: 'on', attributes: {
        friendly_name: 'Strip TV', supported_color_modes: ['hs','color_temp'], color_mode: 'hs',
        brightness: 128, rgb_color: [255, 0, 0],
        min_color_temp_kelvin: 2202, max_color_temp_kelvin: 6535,
        effect_list: ['Arcobaleno','Fuoco'], effect: 'Fuoco' } };
      _RAW_STATES['light.faretti'] = { state: 'on', attributes: {
        friendly_name: 'Faretti', supported_color_modes: ['brightness'], brightness: 255 } };
      _RAW_STATES['switch.garage'] = { state: 'off', attributes: { friendly_name: 'Lampada garage' } };
      Object.assign(STATES, _RAW_STATES);
    `);
    globalThis.__DM_SERVICE_CALLS__ = [];
    window.apriGestioneLuci(true);
  });
  await expect(page.locator('#details-list [data-dm-light="light.strip"]')).toBeVisible();
}

const calls = (page) => page.evaluate(() => globalThis.__DM_SERVICE_CALLS__ || []);

test("every light in the popup gets the controls its entity declares", async ({
  page,
}, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await boot(page, testInfo);
  await openLights(page);

  const strip = page.locator('#details-list [data-dm-light="light.strip"]');
  const spots = page.locator('#details-list [data-dm-light="light.faretti"]');
  const relay = page.locator('#details-list [data-dm-light="switch.garage"]');

  // The card is painted with the colour the lamp is emitting, not with the
  // dashboard's amber.
  await expect(strip).toHaveAttribute("style", /--dm-light-color:#ff0000/);
  await expect(strip.locator(".lgx-state")).toHaveText("ACCESA · 50%");
  await expect(strip.locator('.dm-lightx-badge[data-kind="rgb"]')).toBeVisible();

  // A dimmer gets its dimmer on the card; a relay gets neither a dimmer nor a
  // controls button, because it has nothing to tune.
  await expect(strip.locator("[data-dm-light-brightness]")).toHaveCount(1);
  await expect(spots.locator("[data-dm-light-brightness]")).toHaveCount(1);
  await expect(relay.locator("[data-dm-light-brightness]")).toHaveCount(0);
  await expect(relay.locator("[data-dm-light-open]")).toHaveCount(0);
  await expect(relay.locator('.dm-lightx-badge[data-kind="switch"]')).toBeVisible();
  await expect(relay.locator(".lgx-state")).toHaveText("SPENTA");

  // The room heading counts its own lights and can switch them as a group.
  const salone = page.locator('#details-list [data-dm-light-group="Salone"]');
  await expect(salone.locator(".dm-lightx-room-count")).toHaveText("2/2");
  await expect(salone.locator("[data-dm-light-room]")).toHaveText("Spegni");
});

test("a switch configured as a light is switched, never dimmed", async ({ page }, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await boot(page, testInfo);
  await openLights(page);

  await page.locator('[data-dm-light="switch.garage"] [data-dm-light-toggle]').click();
  await expect
    .poll(async () => (await calls(page)).at(-1))
    .toMatchObject({
      domain: "switch",
      service: "turn_on",
      service_data: { entity_id: "switch.garage" },
    });
});

test("the control sheet sends brightness, colour and white the lamp accepts", async ({
  page,
}, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await boot(page, testInfo);
  await openLights(page);

  await page.locator('[data-dm-light="light.strip"] [data-dm-light-open]').click();
  const sheet = page.locator("#dm-light-control-modal");
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('[data-block="brightness"]')).toBeVisible();
  await expect(sheet.locator('[data-block="color"]')).toBeVisible();
  await expect(sheet.locator('[data-block="white"]')).toBeVisible();
  await expect(sheet.locator('[data-block="effect"] select')).toHaveValue("Fuoco");

  await sheet.locator('[data-dm-light-color="#2f7bff"]').click();
  await expect
    .poll(async () => (await calls(page)).at(-1))
    .toMatchObject({
      domain: "light",
      service: "turn_on",
      service_data: { entity_id: "light.strip", rgb_color: [47, 123, 255] },
    });

  await sheet.locator("[data-dm-light-brightness-preset='25']").click();
  await expect
    .poll(async () => (await calls(page)).at(-1))
    .toMatchObject({
      domain: "light",
      service: "turn_on",
      service_data: { entity_id: "light.strip", brightness_pct: 25 },
    });
  // The value the user just asked for stays on screen while Home Assistant
  // still reports the old one.
  await expect(sheet.locator("[data-dm-light-level]")).toHaveText("25%");

  await sheet.locator("[data-dm-light-kelvin-preset='2700']").click();
  await expect
    .poll(async () => (await calls(page)).at(-1))
    .toMatchObject({
      domain: "light",
      service: "turn_on",
      service_data: { entity_id: "light.strip", color_temp_kelvin: 2700 },
    });

  await sheet.locator("[data-close]").click();
  await expect(page.locator("#dm-light-control-modal")).toHaveCount(0);
});

test("the popup keeps the slider the user is holding while the runtime ticks", async ({
  page,
}, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await boot(page, testInfo);
  await openLights(page);

  const range = page.locator('[data-dm-light="light.strip"] [data-dm-light-brightness]');
  await range.evaluate((node) => {
    node.value = "12";
    node.dispatchEvent(new Event("input", { bubbles: true }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect
    .poll(async () => (await calls(page)).at(-1))
    .toMatchObject({
      domain: "light",
      service: "turn_on",
      service_data: { entity_id: "light.strip", brightness_pct: 12 },
    });

  // Home Assistant is still reporting 50%: the repaint must not drag the
  // handle back under the finger.
  await page.evaluate(() => window.updateGestioneLuci());
  await expect(range).toHaveValue("12");
  await expect(page.locator('[data-dm-light="light.strip"] .lgx-state')).toHaveText("ACCESA · 12%");
});
