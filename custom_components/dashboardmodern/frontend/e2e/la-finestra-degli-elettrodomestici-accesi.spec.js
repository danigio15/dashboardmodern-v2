/* La finestra del widget quando le macchine accese sono piu' di una.
 *
 * Dal campo: «il popup deve mostrare una icona piccola dell'elettrodomestico
 * in funzione, perche' puo' essere piu' di uno; quando clicco sopra si espande
 * e mostra tutta la card completa». Tre macchine accese sono tre card alte una
 * pagina l'una, e in una finestra si scorre e non si trova piu' niente: qui ci
 * sono le pastiglie, e una card alla volta.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const st = (entity_id, state, attributes = {}) => ({ entity_id, state, attributes });
const n = (entity_id, state, unit, extra = {}) =>
  st(entity_id, state, { unit_of_measurement: unit, ...extra });

const STATI = [
  st("sensor.lavatrice_machine_status", "running", { friendly_name: "Lavatrice Machine Status" }),
  st("sensor.lavatrice_fase", "washing", { friendly_name: "Lavatrice Fase" }),
  n("sensor.lavatrice_tempo_rimanente", "50", "min", {
    friendly_name: "Lavatrice Tempo rimanente",
  }),
  n("sensor.lavatrice_temperatura", "30", "°C", { friendly_name: "Lavatrice Temperatura" }),
  n("sensor.lavatrice_centrifuga", "800", "rpm", { friendly_name: "Lavatrice Centrifuga" }),
  st("select.lavatrice_programma", "All in One 59’", { friendly_name: "Lavatrice Programma" }),
  n("sensor.lavatrice_power", "1180", "W", {
    friendly_name: "Lavatrice Potenza",
    device_class: "power",
  }),
  n("sensor.lavatrice_energy", "115.5", "kWh", {
    friendly_name: "Lavatrice Energia",
    device_class: "energy",
    state_class: "total_increasing",
  }),
  st("switch.lavatrice_lavatrice", "on", { friendly_name: "Lavatrice Lavatrice" }),

  st("sensor.lavastoviglie_machine_status", "running", {
    friendly_name: "Lavastoviglie Machine Status",
  }),
  st("sensor.lavastoviglie_fase", "drying", { friendly_name: "Lavastoviglie Fase" }),
  n("sensor.lavastoviglie_tempo_rimanente", "18", "min", {
    friendly_name: "Lavastoviglie Tempo rimanente",
  }),
  n("sensor.lavastoviglie_temperatura", "50", "°C", { friendly_name: "Lavastoviglie Temperatura" }),
  st("select.lavastoviglie_programma", "eco_50", { friendly_name: "Lavastoviglie Programma" }),
  n("sensor.lavastoviglie_power", "35", "W", {
    friendly_name: "Lavastoviglie Potenza",
    device_class: "power",
  }),
  st("switch.lavastoviglie_lavastoviglie", "on", { friendly_name: "Lavastoviglie Lavastoviglie" }),

  n("sensor.forno_power", "0.3", "W", { friendly_name: "Forno Potenza", device_class: "power" }),
  st("switch.forno", "off", { friendly_name: "Forno" }),
];

const appl = (id, nome, tipo, prefisso, extra = {}) => ({
  id,
  name: nome,
  icon: tipo,
  visual_key: tipo,
  device_type: tipo,
  visual_type: "asset",
  room_id: "room-lavanderia",
  threshold_run: 5,
  threshold_standby: 1,
  state_entity: `sensor.${prefisso}_machine_status`,
  remaining_entity: `sensor.${prefisso}_tempo_rimanente`,
  power_entity: `sensor.${prefisso}_power`,
  control_entity: `switch.${prefisso}_${prefisso}`,
  integration: "hon",
  integration_name: "Haier hOn Revived",
  device_id: `${prefisso}-1`,
  device_name: nome,
  device_entities: STATI.map((s) => s.entity_id).filter((e) => e.includes(prefisso)),
  entities: [`switch.${prefisso}_${prefisso}`, `sensor.${prefisso}_power`],
  metadata: { dm_campi_scelti: true },
  ...extra,
});

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "room-lavanderia", name: "Lavanderia", icon: "mdi:washing-machine" }],
    appliances: [
      appl("a-lav", "Lavatrice", "lavatrice", "lavatrice", {
        total_energy_entity: "sensor.lavatrice_energy",
        history_entity: "sensor.lavatrice_energy",
      }),
      appl("a-lst", "Lavastoviglie", "lavastoviglie", "lavastoviglie"),
      {
        id: "a-forno",
        name: "Forno",
        icon: "forno",
        visual_key: "forno",
        device_type: "forno",
        visual_type: "asset",
        room_id: "room-lavanderia",
        threshold_run: 5,
        power_entity: "sensor.forno_power",
        control_entity: "switch.forno",
        entities: ["switch.forno", "sensor.forno_power"],
      },
    ],
    loads: [],
  },
  visibility: { home: true, appliances: true },
};

test("le pastiglie degli accesi, e una card alla volta", async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript((haStates) => {
    class MockSocket extends EventTarget {
      static OPEN = 1;
      readyState = 1;
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
        const m = JSON.parse(raw);
        if (m.type === "auth") return;
        let result = null;
        if (m.type === "get_states") result = haStates;
        else if (m.type === "frontend/get_user_data") result = { value: null };
        else if (m.type === "dashboardmodern/integrations/catalog")
          result = { integrations: [], devices: [], entities: [] };
        else if (m.type === "call_service") result = {};
        this.onmessage?.({
          data: JSON.stringify({ id: m.id, type: "result", success: true, result }),
        });
      }
      close() {
        this.onclose?.({});
      }
    }
    window.__DASHBOARDMODERN_BRIDGE_WS__ = MockSocket;
    window.WebSocket = MockSocket;
  }, STATI);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((x) => x.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate(
    (s) =>
      s.forEach((i) => {
        _RAW_STATES[i.entity_id] = structuredClone(i);
        STATES[i.entity_id] = structuredClone(i);
      }),
    STATI,
  );
  await page.waitForTimeout(2500);

  const tessera = page.locator('#dm-widgets [data-dm-widget="elettrodomestici"]');
  await expect(tessera).toBeVisible({ timeout: 15000 });
  await tessera.click();
  const popup = page.locator("#dm-widget-popup");
  await expect(popup).toBeVisible();
  await expect(popup.locator(".dm-w-appl-chip")).toHaveCount(2);
  await page.waitForTimeout(600);

  await popup.locator('[data-dm-appl-chip="a-lav"]').click();
  await expect(popup.locator(".dm-w-appl-card .dm-ap-card")).toHaveCount(1);
  await expect(popup.locator(".dm-w-appl-card .dm-ap-phase")).toContainText(/Lavaggio|Washing/);
  await page.waitForTimeout(700);

  await popup.locator('[data-dm-appl-chip="a-lst"]').click();
  await expect(popup.locator(".dm-w-appl-card .dm-ap-phase")).toContainText(/Asciugatura|Drying/);

  /* Riaperta la stessa pastiglia, la card si richiude: e' un interruttore. */
  await popup.locator('[data-dm-appl-chip="a-lst"]').click();
  await expect(popup.locator(".dm-w-appl-card .dm-ap-card")).toHaveCount(0);

  /* Il forno e' spento e non ha una pastiglia: la finestra parla di chi
   * lavora adesso, non di tutto quello che si possiede. */
  await expect(popup.locator('[data-dm-appl-chip="a-forno"]')).toHaveCount(0);
});
