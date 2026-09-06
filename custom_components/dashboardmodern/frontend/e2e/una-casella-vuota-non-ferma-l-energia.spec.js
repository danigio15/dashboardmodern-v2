/* Una casella vuota non ferma l'Energia, e non fa una tempesta di domande.
 *
 * Dal campo (la 333, su 1.4.8): «nella plancia energia, quando seleziono
 * report ricevo l'avviso "home assistant non ha risposto in tempo alle
 * statistiche: il recorder è lento o la connessione è occupata. Si riprova da
 * solo", tutti i valori rimangono a zero».
 *
 * Bastava UN contatore configurato senza statistiche a lungo termine perche'
 * l'intero pacchetto — giorno, mese, anno, dispositivi, carichi — venisse
 * buttato via e rifatto da capo: quaranta volte di fila, e poi ogni minuto
 * per sempre. Il Recorder non poteva rispondere meglio, perche' quella
 * casella non dipende da lui.
 *
 * Qui il Recorder risponde a tutti tranne che al fotovoltaico: i numeri che
 * ci sono si vedono, sopra c'e' scritto quale sensore manca e cosa gli serve,
 * e le domande al Recorder non si moltiplicano.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const stato = (entity_id, state, attributes = {}) => ({ entity_id, state, attributes });
const KWH = { unit_of_measurement: "kWh", device_class: "energy", state_class: "total_increasing" };
const MUTO = "sensor.fv_tot";
const STATI = [
  stato("sensor.casa_w", "2060", { unit_of_measurement: "W", device_class: "power" }),
  stato("sensor.casa_tot", "1234.5", KWH),
  stato(MUTO, "5678.9", KWH),
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
      solar: { total_energy: MUTO },
      grid: {
        total_import_energy: "sensor.rete_imp_tot",
        total_export_energy: "sensor.rete_exp_tot",
      },
    },
    entityOverrides: {},
  },
  visibility: { home: true, energy: true },
};

const conteggio = (page) =>
  page.evaluate(
    () => window.__domande.filter((tipo) => tipo === "recorder/statistics_during_period").length,
  );

test("un contatore senza statistiche: i numeri arrivano, la riga lo dice, le domande non si moltiplicano", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(
    ({ haStates, muto }) => {
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
              /* Il fotovoltaico non ha statistiche a lungo termine: Home
               * Assistant risponde, ma per lui non c'e' nessuna riga. */
              if (id === muto) {
                risultato[id] = [];
                continue;
              }
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
    { haStates: STATI, muto: MUTO },
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
  /* Il pacchetto arriva lo stesso: e' meta', ed e' quella buona. */
  await expect(giorno).toHaveAttribute("data-dm-energy-bundle", /\d/, { timeout: 40_000 });
  await expect(page.locator("#v-grid-day")).toContainText(/\d+,\d kWh/);
  /* E sopra i numeri c'e' scritto QUALE sensore manca e cosa gli serve. */
  await expect(giorno).toHaveAttribute("data-dm-energy-ragione", new RegExp(MUTO), {
    timeout: 10_000,
  });
  await expect(giorno).toHaveAttribute("data-dm-energy-ragione", /state_class/);

  /* E non riparte una tempesta: il fatto che una casella non abbia
   * statistiche non si aggiusta richiedendolo quattro volte al secondo. */
  const prima = await conteggio(page);
  await page.waitForTimeout(8000);
  const dopo = await conteggio(page);
  expect(dopo - prima).toBeLessThanOrEqual(1);
  /* Il velo se n'e' andato: sotto ci sono i numeri, non l'attesa. */
  await expect(giorno).not.toHaveClass(/dm-energy-awaiting/);
});
