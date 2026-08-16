import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const seed = {
  schema_version: 4,
  sections: {
    rooms: [
      {
        id: "room-cameretta",
        name: "Cameretta",
        icon: "🛏️",
        floor: "Primo piano",
        temp: "sensor.cameretta_temperature",
        hum: "sensor.cameretta_humidity",
        metadata: {},
      },
    ],
    cameras: [],
    appliances: [
      {
        id: "appliance-dishwasher",
        name: "Lavastoviglie",
        visual_type: "asset",
        visual_key: "lavastoviglie",
        device_type: "lavastoviglie",
        icon: "lavastoviglie",
        image: "/local/stale-washer.png",
        image_url: "/local/stale-washer.png",
        power_entity: "sensor.dishwasher_power",
        entities: ["sensor.dishwasher_power"],
        show_in_dashboard: true,
      },
    ],
    loads: [],
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    energyLoads: [],
    entityOverrides: {},
  },
  visibility: { home: true, appliances: true, temperature: true },
};

async function boot(page, variant, testInfo) {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 150_000 : 90_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(() => {
    class MockBridgeSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;
      readyState = 1;
      onopen = null;
      onmessage = null;
      onclose = null;
      onerror = null;

      constructor() {
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
        if (message.type === "frontend/set_user_data") result = null;
        queueMicrotask(() =>
          this.onmessage?.({
            data: JSON.stringify({ id: message.id, type: "result", success: true, result }),
          }),
        );
      }

      close() {
        this.readyState = 3;
        this.onclose?.({});
      }
    }
    window.__DASHBOARDMODERN_HOSTED__ = true;
    window.__DASHBOARDMODERN_BRIDGE_WS__ = MockBridgeSocket;
    window.WebSocket = MockBridgeSocket;
  });

  await bootNamespacedDashboard(page, variant, testInfo, seed);
  await page
    .locator("#setup-wizard")
    .evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  await expect
    .poll(() => page.evaluate(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true))
    .toBe(true);
}

for (const variant of ["dashboard.html", "dashboard-en.html"]) {
  test(`${variant}: beta25 allows a second temperature association for the same room`, async ({
    page,
  }, testInfo) => {
    await boot(page, variant, testInfo);
    await page.evaluate(() => {
      if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
      editorSwitch("sez7");
    });

    const editor = page.locator("[data-beta25-temperature-editor]");
    await expect(editor).toBeVisible();
    const room = page.locator("#dm-temperature-room");
    await expect(room.locator('option[value="room-cameretta"]')).toBeEnabled();
    await room.selectOption("room-cameretta");
    await page.locator("#dm-temperature-name").fill("Comodino");
    await page.locator("#ed-pl-temp").fill("sensor.cameretta_temperature_2");
    await page.locator("#dm-humidity-new").fill("sensor.cameretta_humidity_2");
    await page.locator("[data-beta25-temperature-submit]").click();

    await expect
      .poll(() =>
        page.evaluate(() => {
          const stored = DashboardModernModules.store.getSection("rooms")[0];
          return {
            primary: stored.temp,
            extras: stored.metadata?.temperature_entries || [],
          };
        }),
      )
      .toMatchObject({
        primary: "sensor.cameretta_temperature",
        extras: [
          {
            name: "Comodino",
            temp: "sensor.cameretta_temperature_2",
            hum: "sensor.cameretta_humidity_2",
          },
        ],
      });

    await page.evaluate(() => buildTempCards?.());
    await expect(page.locator('#temp-grid .temp-card[data-room-id="room-cameretta"]')).toHaveCount(
      2,
    );
  });

  test(`${variant}: beta25 standard dishwasher artwork removes a stale washer image`, async ({
    page,
  }, testInfo) => {
    await boot(page, variant, testInfo);

    await expect
      .poll(() =>
        page.evaluate(() => {
          const device = DashboardModernModules.store.getSection("appliances")[0];
          return {
            visual_type: device.visual_type,
            visual_key: device.visual_key,
            image: device.image,
            image_url: device.image_url,
          };
        }),
      )
      .toEqual({
        visual_type: "asset",
        visual_key: "lavastoviglie",
        image: "",
        image_url: "",
      });

    await page.evaluate(() => {
      document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
      document.getElementById("page-appliances-main")?.classList.add("active");
      renderAppliances?.();
      renderApplianceSection?.(true);
    });
    const card = page.locator('[data-appliance-id="appliance-dishwasher"]').first();
    await expect(card).toBeVisible();
    await expect(card.locator('.dm-appliance-art[data-dm-art="dishwasher"]')).toHaveCount(1);
    await expect(card.locator(".dm-appliance-image")).toHaveCount(0);
  });
}
