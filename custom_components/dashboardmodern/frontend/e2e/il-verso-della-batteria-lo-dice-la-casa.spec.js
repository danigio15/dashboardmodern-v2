/* «Il flow dovrebbe essere dal FV verso casa ed è corretto, ma poi dovrebbe
 *  anche caricare la batteria mentre in questo momento sembra scaricarsi
 *  perché il flow tratteggiato va dalla batteria verso casa» (#434).
 *
 * La mappa ha una convenzione sola — positivo = scarica — e metà dei sensori
 * scrive positivo quando la batteria si CARICA. Qui si accende la plancia con
 * un sensore di quella famiglia e si guarda la freccia della bolla, che è lo
 * stesso numero da cui la mappa decide dove vanno le linee: prima punta in su
 * (scarica), e dopo aver detto alla casa da che parte scrive, punta in giù.
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
     * caselle sciolte: in schema 4 l'impianto è il primo livello di `energy`. */
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

test("dicendo da che parte scrive, la freccia della batteria si gira", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);

  /* Com'era: positivo letto come scarica, e la freccia esce dalla batteria
   * mentre in realtà la batteria si sta caricando. È la bugia segnalata. */
  await expect(bolla(page)).toHaveText(/▲/, { timeout: 20_000 });

  /* Si dice alla casa da che parte scrive il suo sensore. */
  await page.evaluate(() => {
    window.localStorage.setItem("cd_batteria_verso", JSON.stringify({ girata: true }));
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    window.render?.();
  });

  /* E adesso la freccia entra: la batteria si carica, e lo dice. */
  await expect(bolla(page)).toHaveText(/▼/, { timeout: 20_000 });
  await expect(bolla(page)).toContainText("1500");
});
