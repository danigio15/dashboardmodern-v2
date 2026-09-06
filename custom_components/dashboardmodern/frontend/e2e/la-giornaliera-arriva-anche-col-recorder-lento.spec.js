/* La Giornaliera arriva anche con un Recorder lento e i watt che si muovono.
 *
 * «Tolto il velo ma i dati non si aggiornano.» Dopo la 1.4.11 il pacchetto
 * dei periodi non arrivava mai: ogni richiesta nuova — il guscio a ogni giro,
 * uno stato che cambia — scavalcava quella in corso, e a risposta arrivata la
 * si buttava via. Con le domande al Recorder in fila il giro durava di piu' e
 * veniva scavalcato sempre: i cerchi restavano sui numeri del guscio, «—» e
 * «0 kWh», senza una riga che lo dicesse.
 *
 * Qui il Recorder risponde con calma e la casa cambia i watt ogni quattro
 * decimi: la finestra dice a che punto e' quando il velo se ne va, i kWh del
 * giorno arrivano lo stesso, e una lettura in corso non nasconde quello che
 * cambia sotto — la configurazione, il mese scelto.
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
  stato("sensor.fv_nuovo_tot", "9876.5", KWH),
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

/* Il contatore «nuovo» cresce sette volte piu' in fretta degli altri: chi lo
 * legge davvero lo riconosce dal numero, qualunque sia l'ora del giorno. */
const CONTATORE_NUOVO = "sensor.fv_nuovo_tot";
const CRESCITA_A_SECCHIELLO_KWH = 0.5;
const CRESCITA_DEL_NUOVO_KWH = 3.5;

/* La plancia con un Recorder che risponde dopo `ritardo` millisecondi, la
 * pagina dell'Energia aperta e la casa che cambia i watt di continuo. */
async function avviaConRecorderLento(page, testInfo, ritardo) {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 150_000 : 120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(
    ({ haStates, ritardo, contatoreNuovo, crescita, crescitaDelNuovo }) => {
      window.__domande = [];
      window.__statistiche = [];
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
            /* Un Recorder lento: secchielli veri, con la somma che cresce a
             * ogni secchiello — e almeno due secchielli, anche a mezzanotte
             * appena passata. */
            attesa = ritardo;
            window.__statistiche.push(m.statistic_ids);
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
                somma += id === contatoreNuovo ? crescitaDelNuovo : crescita;
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
    {
      haStates: STATI,
      ritardo,
      contatoreNuovo: CONTATORE_NUOVO,
      crescita: CRESCITA_A_SECCHIELLO_KWH,
      crescitaDelNuovo: CRESCITA_DEL_NUOVO_KWH,
    },
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
  return { agita };
}

const contaLeStatistiche = (page) =>
  page.evaluate(
    () => window.__domande.filter((tipo) => tipo === "recorder/statistics_during_period").length,
  );

const kwhScritti = async (locator) =>
  Number((await locator.textContent()).replace(/[^\d,]/g, "").replace(",", "."));

test("i kWh del giorno arrivano, e nell'attesa la finestra dice a che punto e'", async ({
  page,
}, testInfo) => {
  const { agita } = await avviaConRecorderLento(page, testInfo, 7000);

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
   * nessuna ripetuta per una richiesta scavalcata. Erano sette per giro (fino
   * a sei qui, perche' senza dispositivi configurati due restavano vuote);
   * adesso un aggiornamento sono tre archi di tempo — il giorno, il mese, i
   * mesi chiusi dell'anno — piu' l'ora aperta, che sono dodici righe. */
  expect(await contaLeStatistiche(page)).toBeLessThanOrEqual(4);
});

test("la configurazione cambiata a meta' lettura vince sul pacchetto vecchio", async ({
  page,
}, testInfo) => {
  /* Osservazione della review: una lettura in corso teneva la configurazione
   * con cui era partita, e chi la cambiava nel frattempo — un contatore
   * nuovo nella maschera — riceveva quel pacchetto, coi numeri del contatore
   * di prima, fino al giro successivo. */
  const { agita } = await avviaConRecorderLento(page, testInfo, 3000);
  await expect.poll(() => contaLeStatistiche(page), { timeout: 15_000 }).toBeGreaterThan(0);

  /* A lettura in corso, il fotovoltaico cambia contatore. (Il cerchio della
   * casa non farebbe da testimone: il suo numero e' il bilancio di sole e
   * rete, non il contatore di casa.) */
  await page.evaluate((contatoreNuovo) => {
    const energia = structuredClone(DashboardModernModules.store.getSection("energy"));
    energia.solar.total_energy = contatoreNuovo;
    return DashboardModernModules.store.replaceSection("energy", energia);
  }, CONTATORE_NUOVO);

  const giorno = page.locator("#view-day");
  await expect(giorno).toHaveAttribute("data-dm-energy-bundle", /\d/, { timeout: 30_000 });
  /* Il pacchetto che arriva e' quello del contatore nuovo: il sole cresce
   * sette volte la rete, letta dagli stessi secchielli. */
  const rete = await page.evaluate(
    () => window.__DASHBOARDMODERN_RUNTIME_0150__.bundle.day.gridImport,
  );
  expect(rete).toBeGreaterThan(0);
  const rapporto = CRESCITA_DEL_NUOVO_KWH / CRESCITA_A_SECCHIELLO_KWH;
  await expect
    .poll(() => kwhScritti(page.locator("#v-solar-day")), { timeout: 5_000 })
    .toBeGreaterThanOrEqual(rete * (rapporto - 1));
  expect(await page.evaluate(() => window.__statistiche.flat())).toContain(CONTATORE_NUOVO);
  await agita;
});

test("cambiando mese a meta' lettura il conto dell'attesa non sfora", async ({
  page,
}, testInfo) => {
  /* Osservazione della review: due letture in corso — il mese cambiato prima
   * che il primo pacchetto arrivasse — contavano nello stesso conto, e la riga
   * arrivava a dire «10/7». */
  const { agita } = await avviaConRecorderLento(page, testInfo, 7000);
  const giorno = page.locator("#view-day");
  await expect(giorno).toHaveAttribute("data-dm-energy-ragione", /Recorder/, { timeout: 25_000 });

  const meseScelto = await page.evaluate(() => {
    const tendina = document.getElementById("ed-sel-month");
    const adesso = Number(tendina.value);
    const altro = adesso > 1 ? adesso - 1 : 12;
    tendina.value = String(altro);
    tendina.dispatchEvent(new Event("change", { bubbles: true }));
    return altro;
  });

  const conti = [];
  await expect
    .poll(
      async () => {
        const ragione = await giorno.getAttribute("data-dm-energy-ragione");
        const conto = /(\d+)\/(\d+)/.exec(ragione || "");
        if (conto) conti.push([Number(conto[1]), Number(conto[2])]);
        return giorno.getAttribute("data-dm-energy-bundle");
      },
      { timeout: 40_000, intervals: [100] },
    )
    .toMatch(/\d/);
  expect(conti.length).toBeGreaterThan(0);
  for (const [fatte, totali] of conti) expect(fatte).toBeLessThanOrEqual(totali);
  /* E il pacchetto arrivato e' del mese scelto, non di quello di prima. */
  expect(await page.evaluate(() => window.__DASHBOARDMODERN_RUNTIME_0150__.selected.month)).toBe(
    meseScelto,
  );
  await agita;
});
