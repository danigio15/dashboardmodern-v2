/* Una plancia appena creata non racconta la casa di un'altra.
 *
 * Dal campo, con lo scatto della plancia nuova: «ho provato a cambiare nome,
 * effettivamente l'ha ritirata bene, ma erano presenti aperture». Sotto il
 * messaggio «non hai ancora collegato le tue entita', quindi le card sono
 * nascoste» compariva il ponte con «APERTURE 2», e dentro «2 aperte su 30» —
 * tutte le finestre della casa, che questa plancia non ha mai configurato.
 *
 * Le tessere degli avvisi nascono dal rilevamento, non dalla configurazione:
 * finche' qui non c'e' niente di configurato, il ponte tace.
 *
 * La tessera che leggeva tutta la casa senza che nessuno gliel'avesse chiesto
 * era proprio quella delle Aperture, e adesso non c'e' piu': «viene gia'
 * gestito da Finestre, se li si mette il sensore finestra dice quale e'
 * aperto, quindi e' un duplicato». Il difetto raccontato qui sopra non puo'
 * piu' capitare da quella parte — e queste prove restano a sorvegliare la
 * regola, con le tessere che sono rimaste.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const VUOTA = {
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
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true },
};

const STATI = {
  /* La sonda della stanza: e' la configurazione piu' piccola che abbia
   * qualcosa da dire, e senza il suo stato non c'e' niente da raccontare. */
  "sensor.bagno_t": {
    state: "21.4",
    attributes: {
      friendly_name: "Bagno Temperatura",
      device_class: "temperature",
      unit_of_measurement: "°C",
    },
  },
  "binary_sensor.bagno_finestra": {
    state: "on",
    attributes: { friendly_name: "Termosifone Bagno Stato finestra" },
  },
  "binary_sensor.bagno_piccolo_porta": {
    state: "on",
    attributes: { friendly_name: "Sensore Finestra Bagno Piccolo Porta" },
  },
  "binary_sensor.cucina_finestra": {
    state: "off",
    attributes: { friendly_name: "Termosifone cucina Stato finestra" },
  },
};

/* La casa vista da Home Assistant: le aperture le trova il rilevamento, e
 * questa plancia non ne ha configurata nessuna. */
async function laCasaEsiste(page) {
  await page.evaluate((valori) => {
    window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...valori } };
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, valori);
    window.eval(
      "try{ GRUPPI_MONITORAGGIO.win = ['binary_sensor.bagno_finestra','binary_sensor.bagno_piccolo_porta','binary_sensor.cucina_finestra']; }catch(e){}",
    );
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    window.renderHomeWidgets?.();
  }, STATI);
  await page.waitForTimeout(1200);
}

test("una plancia senza configurazione non mostra il ponte dei widget", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, VUOTA);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await laCasaEsiste(page);

  await expect(page.locator("#dm-widgets")).toHaveCount(0);
  await expect(page.locator("#dm-widgets .dm-tile")).toHaveCount(0);
});

test("basta una stanza perche' il ponte torni", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, VUOTA);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await laCasaEsiste(page);
  await expect(page.locator("#dm-widgets")).toHaveCount(0);

  /* Si configura qualcosa — una stanza, la prima cosa che chiunque fa — e la
   * plancia ricomincia a raccontare quello che ha in casa.
   *
   * Una stanza col solo nome non basta piu', ed e' giusto cosi': il ponte
   * tornava perche' le Aperture leggevano tutta la casa comunque, cioe' per lo
   * stesso motivo per cui questa prova esiste. Una stanza con la sua sonda e'
   * la configurazione piu' piccola che abbia qualcosa da dire, e il ponte
   * torna con lei. */
  await page.evaluate(async () => {
    await window.DashboardModernModules?.store?.replaceSection?.("rooms", [
      { id: "bagno", name: "Bagno", temp: "sensor.bagno_t" },
    ]);
  });
  await laCasaEsiste(page);
  await expect(page.locator('.dm-tile[data-dm-widget="temperatura"]')).toHaveCount(1, {
    timeout: 20_000,
  });
});

/* Qui stava una terza prova: le pillole della finestra portano il disegno di
 * casa e non l'emoji del telefono.
 *
 * Se n'e' andata con la tessera delle Aperture, e non per pigrizia: quel
 * disegno lo sceglieva la plancia, perche' le aperture le nominava lei. Le
 * pillole che restano — «In evidenza» e' l'unica che ne porta di proprie —
 * mostrano l'icona che l'utente ha scelto riga per riga, e sostituirgliela con
 * un disegno nostro sarebbe il difetto opposto.
 *
 * La stessa regola, sulle superfici dove vale ancora — il menu della
 * configurazione, il catalogo delle tessere, la barra in basso — la sorveglia
 * `il-config-porta-le-icone-di-casa.spec.js`.
 */
