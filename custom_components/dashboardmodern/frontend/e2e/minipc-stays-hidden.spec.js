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
    entityOverrides: {
      "dm.server_cpu": "sensor.minipc_cpu",
      "dm.server_ram": "sensor.minipc_ram",
    },
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

/* Nascosta a mano vuol dire nascosta.
 *
 * Nella mappa delle visibilita' un `false` puo' voler dire due cose opposte:
 * "non l'ho ancora configurata", che ci scrive la procedura iniziale, oppure
 * "non la voglio vedere", che ci scrive chi preme il pulsante. La passata che
 * accende le sezioni configurate le trattava allo stesso modo, e il MiniPC —
 * che ha delle entita' mappate — tornava su ogni volta.
 */
for (const variant of PRIMARY) {
  test(`${variant}: hiding the MiniPC keeps it hidden`, async ({ page }, testInfo) => {
    await boot(page, variant, testInfo);

    await page.evaluate(() => {
      if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
      const tab = [...document.querySelectorAll("#editor-modal .ed-tab")].find((node) =>
        /minipc/i.test(node.textContent),
      );
      tab?.click();
    });

    const banner = page.locator('#ed-body button[data-key="server"]');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(/visibile|visible/i);
    await banner.click();
    await expect(banner).toContainText(/nascosta|hidden/i);

    // La passata che accende le sezioni configurate gira su ogni salvataggio e
    // su ogni cambio di stato: qui la si sveglia dalle stesse porte.
    await page.evaluate(() => {
      window.DashboardModernModules?.store?.replaceSection?.("entityOverrides", {
        "dm.server_cpu": "sensor.minipc_cpu",
        "dm.server_ram": "sensor.minipc_ram",
        "dm.server_disco": "sensor.minipc_disk",
      });
      document.dispatchEvent(new Event("submit", { bubbles: true }));
      window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
    });

    await expect
      .poll(
        () => page.evaluate(() => JSON.parse(localStorage.getItem("cd_sections") || "{}").server),
        { message: "il MiniPC resta nascosto", timeout: 8000 },
      )
      .toBe(false);
    await expect(page.locator('.tab[data-tab="server"]')).toBeHidden();
  });
}
