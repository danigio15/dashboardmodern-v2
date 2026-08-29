/* Il modello nel tempo arriva davvero fin dentro la finestra.
 *
 * Le prove senza browser dicono gia' che il modello conta giusto e che il
 * motore ne ricava le frasi. Quello che non possono dire e' se quelle letture
 * arrivano fin li': in mezzo ci sono la domanda a Recorder, la sua cache, la
 * forma delle righe che Home Assistant restituisce e il ridisegno che deve
 * scattare quando la risposta atterra — quattro punti in cui la catena si
 * spezza in silenzio, lasciando una finestra che sta in piedi e non dice
 * niente di piu' di prima.
 *
 * Lo storico qui e' finto ma nella forma vera — «{ state, last_changed }», come
 * lo manda Home Assistant — e va installato prima che la plancia parta: il
 * servizio si costruisce all'avvio, e un broker messo dopo non lo sostituisce.
 * Tre giorni a 300 W a quest'ora, e adesso 900: il modello deve accorgersene.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "r1", name: "Salone", icon: "mdi:sofa" }],
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
      house: { power: "sensor.casa_w" },
      solar: { power: "sensor.solare_w" },
      battery: { power: "sensor.batteria_w", soc: "sensor.batteria_soc" },
      grid: { power: "sensor.rete_w" },
    },
  },
  visibility: { energy: true, rooms: true },
};

test("le letture di prima arrivano fin dentro la finestra", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));

  await page.addInitScript(() => {
    const adesso = Date.now();
    const righe = [];
    for (let giorno = 0; giorno < 3; giorno += 1)
      for (let i = 0; i < 10; i += 1)
        righe.push({
          state: "300",
          last_changed: new Date(adesso - giorno * 86_400_000 - i * 300_000).toISOString(),
        });
    righe.push({ state: "900", last_changed: new Date(adesso).toISOString() });
    const broker = {
      request: async (messaggio) =>
        messaggio?.type === "history/history_during_period" ? [righe] : null,
    };
    /* Si lascia che la plancia assegni il suo servizio — glielo si impedisce e
     * l'avvio muore, perche' in un modulo l'assegnazione a una proprieta' di
     * sola lettura lancia — ma il broker resta il nostro. */
    let vero = null;
    Object.defineProperty(window, "DashboardModernEnergyService", {
      configurable: true,
      get: () => ({ ...(vero || {}), broker }),
      set: (valore) => {
        vero = valore;
      },
    });
  });

  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_SECTION_RUNTIME__?.installed, null, {
    timeout: 60_000,
  });

  const esito = await page.evaluate(async () => {
    const storico = await import("/src/sections/storico-condiviso-section.js");
    const analisi = await import("/src/core/analisi-sezione.js");
    /* La prima domanda torna «non lo so ancora»: e' apposta, la finestra si
     * apre lo stesso col numero che ha gia'. */
    const prima = storico.puntiDi("sensor.casa_w", 3);
    await new Promise((risolvi) => setTimeout(risolvi, 600));
    const punti = storico.puntiDi("sensor.casa_w", 3);
    const finestra = analisi.analisiDellaSezione(
      { key: "energia", rows: [{ group: "house", watts: 900 }] },
      (italiano) => italiano,
      Date.now(),
      punti,
    );
    return { prima, quanti: punti?.length ?? null, frase: finestra?.frase, punti: finestra?.punti };
  });

  console.log("FINESTRA:", JSON.stringify(esito, null, 1));
  expect(esito.prima, "la prima domanda non aspetta: torna «non lo so ancora»").toBe(null);
  expect(esito.quanti, "le letture devono arrivare").toBeGreaterThan(20);
  expect(
    esito.punti.join(" | "),
    "il modello deve accorgersi che 900 W non sono i soliti 300 di quest'ora",
  ).toMatch(/Piu' alto del solito per quest'ora/);
});
