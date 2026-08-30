/* La tessera dell'auto esce appena l'auto ha una lettura, foto o non foto.
 *
 * «Fino a quando non ho inserito la foto non compariva la sezione widget»:
 * con UNA vettura profilata la tessera ignorava il profilo e leggeva solo le
 * chiavi globali — che si riempiono ai salvataggi successivi, la foto
 * compresa. Un'auto con la batteria mappata nel SUO profilo e i globali
 * ancora vuoti restava invisibile in Home. Questa prova avvia esattamente
 * cosi' — un profilo con la batteria, nessuna chiave globale, nessuna foto —
 * e pretende la tessera.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    ev: [{ name: "Leapmotor B10", ov: { "dm.ev_batteria_auto": "sensor.leap_soc" } }],
    entityOverrides: {},
  },
  visibility: { home: true },
};

test("un profilo con la batteria basta a far uscire la tessera", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate(() => {
    const stati = {
      "sensor.leap_soc": { entity_id: "sensor.leap_soc", state: "86", attributes: { unit_of_measurement: "%" } },
    };
    window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...stati } };
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, stati);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  });
  await expect(page.locator('[data-dm-widget="ev"]')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('[data-dm-widget="ev"]')).toContainText("86");
});
