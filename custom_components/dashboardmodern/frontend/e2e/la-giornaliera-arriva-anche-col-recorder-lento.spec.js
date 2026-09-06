/* La Giornaliera arriva anche con un Recorder lento e i watt che si muovono.
 *
 * «Tolto il velo ma i dati non si aggiornano.» Dopo la 1.4.11 il pacchetto
 * dei periodi non arrivava mai: ogni richiesta nuova — il guscio a ogni giro,
 * uno stato che cambia — scavalcava quella in corso, e a risposta arrivata la
 * si buttava via. Con le domande al Recorder in fila il giro durava di piu' e
 * veniva scavalcato sempre: i cerchi restavano sui numeri del guscio, «—» e
 * «0 kWh», senza una riga che lo dicesse.
 *
 * Qui il Recorder risponde in sette secondi e la casa cambia i watt ogni
 * quattro decimi: la finestra dice a che punto e' quando il velo se ne va, e
 * i kWh del giorno arrivano lo stesso.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const stato = (entity_id, state, attributes = {}) => ({ entity_id, state, attributes });
const KWH = { unit_of_measurement: "kWh", device_class: "energy", state_class: "total_increasing" };
const STATI = [
  stato("sensor.casa_w", "2060", { unit_of_measurement: "W", device_class: "power" }),
  stato("sensor.fv_w", "2880", { unit_of_measurement: "W", device_class: "power" }),
  stato("sensor.rete_w", "0", { unit_of_measurement: "W", device_class: "power" }),
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
      solar: { power: "sensor.fv_w", total_energy: "sensor.fv_tot" },
      grid: {
        power: "sensor.rete_w",
        total_import_energy: "sensor.rete_imp_tot",
        total_export_energy: "sensor.rete_exp_tot",
      },
    },
    entityOverrides: {},
  },
  visibility: { home: true, energy: true },
};

const RITARDO_DEL_RECORDER_MS = 7000;

test("i kWh del giorno arrivano, e nell'attesa la finestra dice a che punto e'", async ({
  page,
}, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 150_000 : 120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(
    ({ haStates, ritardo }) => {
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
          let attesa = 0;
          window.__domande.push(m.type);
          if (m.type === "get_states") risultato = haStates;
          else if (m.type === "frontend/get_user_data") risultato = { value: null };
          else if (m.type === "recorder/statistics_during_period") {
            /* Un Recorder lento: secchielli veri, con la somma che cresce di
             * mezzo chilowattora a secchiello. */
            attesa = ritardo;
            const inizio = Date.parse(m.start_time);
            const fine = Math.min(Date.parse(m.end_time), Date.now());
            const passo =
              m.period === "5minute"
                ? 300e3
                : m.period === "hour"
                  ? 3600e3
                  : m.period === "day"
                    ? 86400e3
                    : 30 * 86400e3;
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
          setTimeout(
            () =>
              this.onmessage?.({
                data: JSON.stringify({
                  id: m.id,
                  type: "result",
                  success: true,
                  result: risultato,
                }),
              }),
            attesa,
          );
        }
        close() {
          this.readyState = 3;
          this.onclose?.({});
        }
      }
      window.__DASHBOARDMODERN_BRIDGE_WS__ = PonteFinto;
      window.WebSocket = PonteFinto;
    },
    { haStates: STATI, ritardo: RITARDO_DEL_RECORDER_MS },
  );
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForTimeout(3000);
  await page.evaluate((haStates) => {
    for (const voce of haStates) {
      _RAW_STATES[voce.entity_id] = structuredClone(voce);
      STATES[voce.entity_id] = structuredClone(voce);
    }
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    document.querySelector('[data-tab="energy"]')?.click();
  }, STATI);

  /* La casa cambia i watt di continuo: e' cosi' che il pacchetto veniva
   * scavalcato. */
  const agita = page.evaluate(async () => {
    for (let giro = 0; giro < 70; giro += 1) {
      const w = 1900 + Math.round(Math.random() * 300);
      _RAW_STATES["sensor.casa_w"].state = String(w);
      STATES["sensor.casa_w"].state = String(w);
      window.dispatchEvent(
        new CustomEvent("dashboardmodern:state-changed", {
          detail: { entity_id: "sensor.casa_w" },
        }),
      );
      await new Promise((r) => setTimeout(r, 400));
    }
  });

  const giorno = page.locator("#view-day");
  /* Il velo dura dodici secondi; dopo, senza pacchetto, si dice a che punto
   * si e' — non «—» e basta. */
  await expect(giorno).toHaveAttribute("data-dm-energy-ragione", /Recorder/, { timeout: 25_000 });
  /* E il pacchetto arriva: tre domande su due corsie, due giri del Recorder. */
  await expect(giorno).toHaveAttribute("data-dm-energy-bundle", /\d/, { timeout: 40_000 });
  await expect(page.locator("#v-home-day")).toHaveText(/\d+,\d kWh/);
  await expect(page.locator("#v-solar-day")).toHaveText(/\d+,\d kWh/);
  await expect(giorno).not.toHaveAttribute("data-dm-energy-ragione", /.+/);
  await agita;
  /* Le domande al Recorder non sono una tempesta: quelle del pacchetto, e
   * nessuna ripetuta per una richiesta scavalcata. */
  const statistiche = await page.evaluate(
    () => window.__domande.filter((tipo) => tipo === "recorder/statistics_during_period").length,
  );
  expect(statistiche).toBeLessThanOrEqual(6);
});
