/* La finestra del widget Energia non cambia faccia quando arriva la storia.
 *
 * «Ho aperto il widget Energia: prima mi ha mostrato una cosa, poi un'altra.
 * Sono convinto che ci siano sezioni vecchie che stanno sotto.» Non c'era
 * niente di vecchio sotto: la finestra si apre subito con i numeri di adesso,
 * e un secondo dopo arriva da Recorder la lettura nel tempo, che aggiunge un
 * punto sotto la frase. Quel punto in piu' cambiava la forma del corpo, e la
 * forma diversa faceva riscrivere il corpo INTERO: sul telefono, sotto il velo
 * sfocato, e' un lampo bianco e una finestra che sembra un'altra.
 *
 * La prova marca i nodi della finestra appena aperta e pretende di ritrovare
 * GLI STESSI — non copie ristampate — dopo che la storia e' arrivata e il
 * punto in piu' e' comparso.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const stato = (entity_id, state, attributes = {}) => ({ entity_id, state, attributes });

const STATI = [
  stato("sensor.casa_w", "480", { friendly_name: "Casa", unit_of_measurement: "W" }),
  stato("sensor.rete_w", "120", { friendly_name: "Rete", unit_of_measurement: "W" }),
  stato("sensor.fv_w", "360", { friendly_name: "Fotovoltaico", unit_of_measurement: "W" }),
  stato("sensor.batteria_w", "-320", { friendly_name: "Batteria", unit_of_measurement: "W" }),
  stato("sensor.batteria_soc", "78", {
    friendly_name: "Stato di carica",
    unit_of_measurement: "%",
  }),
  stato("sensor.casa_kwh_oggi", "6.4", { friendly_name: "Oggi", unit_of_measurement: "kWh" }),
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
      house: { power: "sensor.casa_w", daily_energy: "sensor.casa_kwh_oggi" },
      grid: { power: "sensor.rete_w" },
      solar: { power: "sensor.fv_w" },
      battery: { power: "sensor.batteria_w", soc: "sensor.batteria_soc" },
    },
    entityOverrides: {},
  },
  visibility: { home: true, energy: true },
};

/* Quanto aspetta Recorder prima di rispondere: abbastanza perche' la finestra
 * si apra prima, come succede in una casa vera. */
const RECORDER_DOPO_MS = 1500;

async function boot(page, testInfo) {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 150_000 : 90_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(
    ({ haStates, ritardo }) => {
      /* Tre ore di batteria intorno al 95%: con il 78% di adesso, la lettura
       * nel tempo ha qualcosa da dire, e lo dice in un punto in piu' — e
       * cambia anche il verdetto, che e' il caso in cui la finestra «cambiava
       * faccia». */
      const storia = () => {
        const fine = Date.now();
        const valori = [93, 95, 94, 96, 95, 93, 94, 96, 95, 94, 93, 95];
        return valori.map((valore, indice) => ({
          s: String(valore),
          lu: (fine - (valori.length - indice) * 15 * 60_000) / 1000,
        }));
      };
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
          const messaggio = JSON.parse(grezzo);
          if (messaggio.type === "auth") return;
          let risultato = {};
          let dopo = 0;
          if (messaggio.type === "get_states") risultato = haStates;
          else if (messaggio.type === "frontend/get_user_data") risultato = { value: null };
          else if (messaggio.type === "history/history_during_period") {
            for (const entita of messaggio.entity_ids || []) risultato[entita] = storia();
            dopo = ritardo;
            (window.__storieChieste ||= []).push(messaggio.entity_ids);
          }
          setTimeout(
            () =>
              this.onmessage?.({
                data: JSON.stringify({
                  id: messaggio.id,
                  type: "result",
                  success: true,
                  result: risultato,
                }),
              }),
            dopo,
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
    { haStates: STATI, ritardo: RECORDER_DOPO_MS },
  );
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate((haStates) => {
    for (const voce of haStates) {
      _RAW_STATES[voce.entity_id] = structuredClone(voce);
      STATES[voce.entity_id] = structuredClone(voce);
    }
    window.render?.();
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  }, STATI);
  await expect(page.locator('#dm-widgets [data-dm-widget="energia"]')).toHaveCount(1, {
    timeout: 15_000,
  });
}

/* Il segno sta sul nodo, non nel documento: un nodo ristampato lo perde. */
const NODI = ".dm-w-racconto, .dm-w-verdetto, .dm-w-frase, .dm-w-caselle, .dm-w-casella";
const marca = (page) =>
  page.evaluate((selettore) => {
    const nodi = [...document.querySelectorAll(`#dm-widget-popup .dm-w-body :is(${selettore})`)];
    nodi.forEach((nodo) => {
      nodo.__dmStessoNodo = true;
    });
    return nodi.length;
  }, NODI);
const conta = (page) =>
  page.evaluate((selettore) => {
    const nodi = [...document.querySelectorAll(`#dm-widget-popup .dm-w-body :is(${selettore})`)];
    return {
      quanti: nodi.length,
      stessi: nodi.filter((nodo) => nodo.__dmStessoNodo === true).length,
      punti: document.querySelectorAll("#dm-widget-popup .dm-w-punti li").length,
      caselle: document.querySelectorAll("#dm-widget-popup .dm-w-casella").length,
    };
  }, NODI);

test("la finestra si apre subito, e la storia aggiunge il suo punto senza rifare il resto", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo);
  await page.evaluate(() => {
    document.querySelector('#dm-widgets [data-dm-widget="energia"]')?.click();
  });
  const corpo = page.locator("#dm-widget-popup .dm-w-body");
  await expect(corpo).toBeVisible({ timeout: 10_000 });
  /* Subito, senza aspettare Recorder: i numeri di adesso e le caselle. */
  await expect(corpo).toContainText("480 W");
  await expect(corpo).toContainText("Batteria");
  await expect(corpo.locator(".dm-w-racconto")).toHaveCount(1);
  const prima = await conta(page);
  expect(prima.caselle).toBe(4);
  const marcati = await marca(page);
  expect(marcati).toBeGreaterThanOrEqual(8);

  /* Arriva la storia: un punto in piu' sotto la frase. */
  await expect
    .poll(() => page.evaluate(() => (window.__storieChieste || []).length), { timeout: 10_000 })
    .toBeGreaterThan(0);
  await expect
    .poll(async () => (await conta(page)).punti, { timeout: 15_000 })
    .toBeGreaterThan(prima.punti);

  /* E tutto il resto e' ancora lo stesso nodo di prima: niente ristampa. */
  const dopo = await conta(page);
  expect(dopo.caselle).toBe(4);
  expect(dopo.stessi, "i nodi della finestra sono stati ristampati").toBe(marcati);
  await expect(corpo).toContainText(/Piu' basso del solito|Lower than usual/);
});
