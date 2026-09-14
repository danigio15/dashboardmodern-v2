/* «Il flow dovrebbe essere dal FV verso casa ed è corretto, ma poi dovrebbe
 *  anche caricare la batteria mentre in questo momento sembra scaricarsi
 *  perché il flow tratteggiato va dalla batteria verso casa» (#434), e poi
 * «adesso ho il flusso, ma è sempre da batteria verso casa, ho provato anche a
 *  cambiare il senso ma non cambia» (#435).
 *
 * La mappa ha una convenzione sola — positivo = scarica — e metà dei sensori
 * scrive positivo quando la batteria si CARICA. Il verso lo dichiara la casa,
 * una volta sola, nella scheda Energia: «I valori positivi sono». Qui si
 * accende la plancia con un sensore di quella famiglia e si guardano le due
 * cose che la segnalazione nomina — la freccia della bolla e la LINEA — prima
 * e dopo averlo detto.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const BATTERIA = "sensor.batteria_potenza";
const SOLARE = "sensor.fv_potenza";
const RETE = "sensor.rete_potenza";

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
    /* Le entità dell'Energia stanno nel documento della sezione, non fra le
     * caselle sciolte: in schema 4 l'impianto è il primo livello di `energy`.
     *
     * E il sensore della batteria sta nella casella «Potenza» di sempre, non
     * in quella della sorgente unica con segno: è il posto ovvio, è quello che
     * la plancia stessa consiglia, ed è esattamente la configurazione in cui
     * cambiare il verso non cambiava niente. */
    energy: {
      battery: { power: BATTERIA },
      solar: { power: SOLARE },
      grid: { power: RETE },
    },
    entityOverrides: {},
  },
  visibility: { home: true, energy: true },
};

const watt = (id, valore) => ({
  entity_id: id,
  state: String(valore),
  attributes: { unit_of_measurement: "W", device_class: "power", friendly_name: id },
});

/* Il fotovoltaico produce, la casa consuma meno di quello che arriva, e la
 * batteria si sta caricando — il suo sensore lo scrive positivo. */
const STATI = {
  [SOLARE]: watt(SOLARE, 4000),
  [RETE]: watt(RETE, -200),
  [BATTERIA]: watt(BATTERIA, 1500),
};

const bolla = (page) => page.locator("#v-battery");
const versoCasa = (page) => page.locator("#line-battery-home");
const inCarica = (page) => page.locator("#line-solar-battery");

async function avvia(page, testInfo) {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate((stati) => {
    window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...stati } };
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, stati);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, STATI);
  await page.locator('.tab[data-tab="energy"]').first().click();
}

test("dicendo da che parte scrive, la batteria smette di alimentare la casa", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);

  /* Com'era: positivo letto come scarica. La freccia esce dalla batteria e la
   * linea va verso casa, mentre in realtà la batteria si sta caricando. Sono
   * le due bugie segnalate, la seconda è quella della #435. */
  await expect(bolla(page)).toHaveText(/▲/, { timeout: 20_000 });
  await expect(versoCasa(page)).toHaveClass(/\bactive\b/);
  await expect(inCarica(page)).not.toHaveClass(/\bactive\b/);

  /* Si dice alla casa da che parte scrive il suo sensore — una riga sola nella
   * scheda Energia, e vale per la potenza dovunque sia stata scritta. */
  await page.evaluate(async () => {
    const store = window.DashboardModernModules?.store;
    await store.transact("energy", "update", () => {
      const energia = store.getSection("energy") || {};
      energia.battery = { ...(energia.battery || {}), signed: { positive: "charge" } };
      store.state.sections.energy = energia;
      return energia;
    });
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    window.render?.();
  });

  /* E adesso la batteria si carica, e tutt'e due lo dicono: la freccia entra,
   * la linea verso casa si spegne e si accende quella dal sole. */
  await expect(bolla(page)).toHaveText(/▼/, { timeout: 20_000 });
  await expect(bolla(page)).toContainText("1500");
  await expect(inCarica(page)).toHaveClass(/\bactive\b/, { timeout: 20_000 });
  await expect(versoCasa(page)).not.toHaveClass(/\bactive\b/);
});
