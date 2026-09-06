/* Passare da Giornaliera a Mensile a Report non costa una lettura del Recorder.
 *
 * Ogni clic dentro l'Energia — la Panoramica, il Mese, una sotto-linguetta —
 * faceva partire un aggiornamento intero: sette letture delle statistiche,
 * oggi tre, anche a mezzo secondo dal precedente. Chi guarda i tre riquadri
 * uno dopo l'altro ne pagava uno per tocco, e sul mini PC quello e' proprio
 * il momento in cui il Recorder arranca.
 *
 * I numeri pero' sono gia' nel pacchetto: giorno, mese, anno e dispositivi
 * arrivano insieme. Cambiare linguetta cambia quali si guardano, non quali
 * sono — e infatti i riquadri si riempiono lo stesso.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const stato = (entity_id, state, attributes = {}) => ({ entity_id, state, attributes });
const KWH = { unit_of_measurement: "kWh", device_class: "energy", state_class: "total_increasing" };
const STATI = [
  stato("sensor.casa_w", "2060", { unit_of_measurement: "W", device_class: "power" }),
  stato("sensor.casa_tot", "1234.5", KWH),
  stato("sensor.fv_tot", "5678.9", KWH),
  stato("sensor.rete_imp_tot", "300.1", KWH),
  stato("sensor.rete_exp_tot", "200.2", KWH),
];
const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {
      house: { power: "sensor.casa_w", total_energy: "sensor.casa_tot" },
      solar: { total_energy: "sensor.fv_tot" },
      grid: {
        total_import_energy: "sensor.rete_imp_tot",
        total_export_energy: "sensor.rete_exp_tot",
      },
    },
    entityOverrides: {},
  },
  visibility: { home: true, energy: true },
};

/* Quante volte il pacchetto dei periodi e' stato riletto: e' il numero che
 * conta, perche' e' quello che costa tre domande al Recorder. Le domande
 * totali non direbbero la stessa cosa — il Report disegna anche il suo
 * grafico dello storico, che e' un'altra lettura e la vuole davvero. */
const generazione = (page) =>
  page.evaluate(() => window.__DASHBOARDMODERN_RUNTIME_0150__?.bundle?.generation ?? -1);

test("cambiare linguetta dentro l'Energia non chiede niente al Recorder", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(
    ({ haStates }) => {
      window.__domande = [];
      class PonteFinto extends EventTarget {
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
        send(grezzo) {
          const m = JSON.parse(grezzo);
          if (m.type === "auth") return;
          let risultato = {};
          window.__domande.push(m.type);
          if (m.type === "get_states") risultato = haStates;
          else if (m.type === "frontend/get_user_data") risultato = { value: null };
          else if (m.type === "recorder/statistics_during_period") {
            const passo =
              m.period === "5minute"
                ? 300e3
                : m.period === "hour"
                  ? 3600e3
                  : m.period === "day"
                    ? 86400e3
                    : 30 * 86400e3;
            const inizio = Date.parse(m.start_time);
            const fine = Math.max(Math.min(Date.parse(m.end_time), Date.now()), inizio + 2 * passo);
            for (const id of m.statistic_ids) {
              const righe = [];
              let somma = 1000;
              for (let t = inizio; t < fine; t += passo) {
                somma += 0.5;
                righe.push({ start: t, end: t + passo, sum: somma });
              }
              risultato[id] = righe;
            }
          }
          this.onmessage?.({
            data: JSON.stringify({ id: m.id, type: "result", success: true, result: risultato }),
          });
        }
        close() {
          this.readyState = 3;
          this.onclose?.({});
        }
      }
      window.__DASHBOARDMODERN_BRIDGE_WS__ = PonteFinto;
      window.WebSocket = PonteFinto;
    },
    { haStates: STATI },
  );
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate((haStates) => {
    for (const voce of haStates) {
      _RAW_STATES[voce.entity_id] = structuredClone(voce);
      STATES[voce.entity_id] = structuredClone(voce);
    }
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    document.querySelector('[data-tab="energy"]')?.click();
  }, STATI);

  const giorno = page.locator("#view-day");
  await expect(giorno).toHaveAttribute("data-dm-energy-bundle", /\d/, { timeout: 40_000 });
  await expect(page.locator("#v-home-day")).toHaveText(/\d+,\d kWh/);
  /* Il primo pacchetto e' arrivato: da qui si conta. */
  await page.waitForTimeout(1500);
  const prima = await generazione(page);
  expect(prima).toBeGreaterThan(0);

  const linguette = page.locator("#page-energy .sub-tab-btn");
  const quante = await linguette.count();
  expect(quante).toBeGreaterThan(2);
  for (let giro = 0; giro < 2; giro += 1) {
    for (let indice = 0; indice < quante; indice += 1) {
      await linguette.nth(indice).click();
      await page.waitForTimeout(120);
    }
  }
  /* E anche riaprendo la pagina dell'Energia dalla barra. */
  await page.locator('[data-tab="energy"]').first().click();
  await page.waitForTimeout(1500);

  expect(await generazione(page)).toBe(prima);
  /* I numeri restano quelli, perche' erano gia' nel pacchetto. */
  await expect(page.locator("#v-home-month")).toHaveText(/\d+,\d kWh/);
});
