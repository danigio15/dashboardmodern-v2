/* La Home si riempie anche con una presa lenta.
 *
 * Dal campo (screenshot del 6/9, 12:27, dal telefono): Home aperta, pallino
 * verde, meteo «--», tessere a zero — «sezione aperta ma i dati non si
 * caricano». Il broker dei moduli chiedeva un'istantanea intera della casa,
 * dopo quella che il guscio aveva gia' chiesto, con dodici secondi di tempo:
 * dal telefono scadeva, e con lei moriva la sottoscrizione agli eventi che
 * veniva dopo. Niente «stati pronti», niente eventi: le tessere restavano sui
 * numeri dell'avvio anche quando una luce si accendeva.
 *
 * Qui `get_states` risponde dopo quindici secondi. Le tessere si riempiono
 * lo stesso, una luce che si accende si conta, e la casa viene chiesta una
 * volta sola.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const stato = (entity_id, state, attributes = {}) => ({ entity_id, state, attributes });
const STATI = [
  stato("light.salone", "on", { friendly_name: "Salone" }),
  stato("light.cucina", "off", { friendly_name: "Cucina" }),
  stato("weather.casa", "sunny", {
    friendly_name: "Meteo",
    temperature: 21.5,
    humidity: 40,
    wind_speed: 9,
  }),
  stato("sensor.casa_w", "1200", { unit_of_measurement: "W", device_class: "power" }),
];
const SEME = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "r1", name: "Salone", icon: "mdi:sofa" }],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [
      { id: "l1", name: "Salone", entity: "light.salone" },
      { id: "l2", name: "Cucina", entity: "light.cucina" },
    ],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: { house: { power: "sensor.casa_w" } },
    entityOverrides: { "dm.home_meteo": "weather.casa" },
  },
  visibility: { home: true, lights: true, energy: true },
};

const RITARDO_DELL_ISTANTANEA_MS = 15_000;

test("le tessere si riempiono, la luce che si accende si conta, la casa si chiede una volta", async ({
  page,
}, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 150_000 : 120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(
    ({ haStates, ritardo }) => {
      window.__domande = [];
      window.__prese = [];
      class PonteFinto extends EventTarget {
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
          super();
          this.sottoscrizioni = [];
          window.__prese.push(this);
          queueMicrotask(() => {
            this.onopen?.({});
            this.consegna({ type: "auth_ok" });
          });
        }
        consegna(p) {
          this.onmessage?.({ data: JSON.stringify(p) });
        }
        send(grezzo) {
          const m = JSON.parse(grezzo);
          if (m.type === "auth") return;
          window.__domande.push(m.type);
          let risultato = {};
          let attesa = 0;
          if (m.type === "get_states") {
            risultato = haStates;
            attesa = ritardo;
          } else if (m.type === "frontend/get_user_data") risultato = { value: null };
          else if (m.type === "subscribe_events") {
            this.sottoscrizioni.push(m.id);
            risultato = null;
          }
          setTimeout(
            () => this.consegna({ id: m.id, type: "result", success: true, result: risultato }),
            attesa,
          );
        }
        close() {
          this.readyState = 3;
          this.onclose?.({});
        }
      }
      window.__evento = (nuovo) => {
        for (const presa of window.__prese)
          for (const id of presa.sottoscrizioni)
            presa.consegna({
              id,
              type: "event",
              event: {
                event_type: "state_changed",
                data: { entity_id: nuovo.entity_id, new_state: nuovo, old_state: null },
              },
            });
      };
      window.__DASHBOARDMODERN_BRIDGE_WS__ = PonteFinto;
      window.WebSocket = PonteFinto;
    },
    { haStates: STATI, ritardo: RITARDO_DELL_ISTANTANEA_MS },
  );
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));

  const luci = page.locator('[data-dm-widget="luci"]');
  /* L'istantanea arriva dopo quindici secondi, e le tessere la vedono. */
  await expect(luci).toContainText("1", { timeout: 30_000 });
  await expect(page.locator("#w-temp")).toHaveText("21.5°C");
  /* La sottoscrizione e' viva: una luce che si accende si conta. */
  await page.evaluate(() =>
    window.__evento({
      entity_id: "light.cucina",
      state: "on",
      attributes: { friendly_name: "Cucina" },
    }),
  );
  await expect(luci).toContainText("2", { timeout: 10_000 });
  /* E la casa intera si e' chiesta una volta sola: quella del guscio. */
  expect(await page.evaluate(() => window.__domande.filter((t) => t === "get_states").length)).toBe(
    1,
  );
  expect(
    await page.evaluate(() => window.DashboardModernEnergyService.broker.subscription),
  ).toBeGreaterThan(0);
});
