import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { fillEntityFieldByHand } from "./helpers/entity-field.js";
import { PRIMARY } from "./helpers/variants.js";

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
        image: "",
        image_url: "",
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

/* Il popup "in funzione" mostrava un'altra icona, e ferma.
 *
 * La riga del popup disegnava l'illustrazione piatta: una sagoma azzurra quasi
 * uguale per ogni elettrodomestico, immobile anche mentre l'elettrodomestico
 * lavorava, mentre la scheda accanto mostrava il disegno con le parti mobili.
 * Adesso e' lo stesso disegno e lo stesso stato: se lavora, si muove. */
for (const variant of PRIMARY) {
  test(`${variant}: the running popup shows the card artwork, moving`, async ({
    page,
  }, testInfo) => {
    await boot(page, variant, testInfo);

    await page.evaluate(() => {
      const states =
        window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null") ||
        window._RAW_STATES;
      states["sensor.dishwasher_power"] = {
        entity_id: "sensor.dishwasher_power",
        state: "1800",
        attributes: { unit_of_measurement: "W", device_class: "power" },
      };
      document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
      document.getElementById("page-appliances-main")?.classList.add("active");
      window.renderAppliances?.();
      window.renderApplianceSection?.(true);
    });

    const card = page.locator('[data-appliance-id="appliance-dishwasher"].dm-ap-card');
    await expect(card).toHaveClass(/is-run/);

    // The card the user taps to see what is running right now.
    const kpi = page.locator('[data-dm-appliance-kpi="running"]').first();
    await expect(kpi).toBeVisible();
    await kpi.click();
    const row = page.locator("#dm-appliance-running-popup .dm-appliance-kpi-row").first();
    await expect(row).toHaveCount(1);

    // The same drawing the card uses, not the flat silhouette.
    await expect(row.locator('.dm-hero-art[data-dm-hero="dishwasher"]')).toHaveCount(1);
    await expect(row.locator(".dm-appliance-art")).toHaveCount(0);

    // And its mechanism runs, because the row carries the running state.
    const moving = await row.evaluate((node) =>
      [...node.querySelectorAll("*")]
        .map((el) => getComputedStyle(el).animationName)
        .filter((name) => name && name !== "none"),
    );
    expect(moving).toContain("dmJets");
  });
}
