/* «Non fa inserire altri tasti oltre al primo» (#431).
 *
 * Aggiungere un tasto d'inserimento su misura salva; salvare rifà la scheda; e
 * il blocco se ne andava con lei — il secondo «＋» non c'era più da premere.
 * Qui si premono tre volte, sulla scheda vera.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const CENTRALE = "alarm_control_panel.casa";

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
    energy: {},
    entityOverrides: { "dm.security_centrale_allarme": CENTRALE },
  },
  visibility: { home: true, security: true },
};

test("il «＋» si può premere più di una volta", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate((id) => {
    const stati = {
      [id]: {
        entity_id: id,
        state: "disarmed",
        attributes: { friendly_name: "Casa", supported_features: 63 },
      },
    };
    window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...stati } };
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, stati);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, CENTRALE);

  await page.evaluate(() => window.apriConfigEntita());
  /* La linguetta si PREME, non si chiama: il blocco si riaggancia al corpo
   * della scheda quando la scheda cambia, e il corpo cambia sotto le dita di
   * chi tocca. Chiamando `editorSwitch` a mano si prova una plancia che
   * nessuno usa. */
  await page.locator('.ed-tab[data-tab="sez4"]').first().click();

  /* Il blocco compare da sé: si aggancia alla casella della centrale. */
  const piu = page.locator("#dm-antifurto-su-misura [data-suo-add]");
  await expect(piu).toHaveCount(1, { timeout: 20_000 });

  const righe = page.locator("#dm-antifurto-su-misura [data-suo-index]");
  for (const quante of [1, 2, 3]) {
    await piu.first().click();
    /* Dopo ogni «＋» il blocco deve essere ancora lì, col tasto in più: prima
     * sparivano entrambi, e il secondo non si poteva nemmeno tentare. */
    await expect(righe).toHaveCount(quante, { timeout: 10_000 });
    await expect(page.locator("#dm-antifurto-su-misura [data-suo-add]")).toHaveCount(1);
  }

  /* E i tre restano scritti, non solo disegnati. */
  const salvati = await page.evaluate(() => {
    try {
      return JSON.parse(window.localStorage.getItem("cd_antifurto_su_misura") || "[]").length;
    } catch (_errore) {
      return -1;
    }
  });
  expect(salvati).toBe(3);
});
