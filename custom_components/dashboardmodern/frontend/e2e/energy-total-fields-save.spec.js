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

async function openEnergy(page) {
  await page.evaluate(() => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
    const tab = [...document.querySelectorAll("#editor-modal .ed-tab")].find((node) =>
      /energ/i.test(node.textContent),
    );
    tab?.click();
  });
  // Il campo vive dentro una fisarmonica che puo' essere chiusa: qui conta che
  // ci sia e sia collegato, non che sia sotto gli occhi.
  await expect(page.locator("#dm-energy-grid-total_import_energy")).toHaveCount(1);
}

for (const variant of PRIMARY) {
  /* La maschera mostra cio' che c'e' scritto.
   *
   * Il modello che leggono le pagine esce filtrato: con un contatore totale i
   * campi di periodo ne restano fuori, perche' i periodi si ricavano dal
   * totale. Se la maschera leggesse quello mostrerebbe quei campi vuoti, e il
   * primo salvataggio riscriverebbe il vuoto sopra le entita' configurate.
   */
  test(`${variant}: the energy editor shows the configuration as written`, async ({
    page,
  }, testInfo) => {
    await boot(page, variant, testInfo);
    await page.evaluate(async () => {
      const states =
        window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null") ||
        window._RAW_STATES;
      for (const id of ["sensor.casa_totale", "sensor.casa_giorno", "sensor.casa_mese"]) {
        states[id] = {
          entity_id: id,
          state: "10",
          attributes: {
            unit_of_measurement: "kWh",
            device_class: "energy",
            state_class: "total_increasing",
          },
        };
      }
      await window.DashboardModernModules.store.replaceSection("energy", {
        house: {
          total_energy: "sensor.casa_totale",
          daily_energy: "sensor.casa_giorno",
          monthly_energy: "sensor.casa_mese",
        },
      });
    });
    await openEnergy(page);

    await expect
      .poll(() =>
        page.evaluate(() => ({
          total: document.getElementById("dm-energy-house-total_energy")?.value || "",
          daily: document.getElementById("dm-energy-house-daily_energy")?.value || "",
          monthly: document.getElementById("dm-energy-house-monthly_energy")?.value || "",
        })),
      )
      .toEqual({
        total: "sensor.casa_totale",
        daily: "sensor.casa_giorno",
        monthly: "sensor.casa_mese",
      });
  });
}
