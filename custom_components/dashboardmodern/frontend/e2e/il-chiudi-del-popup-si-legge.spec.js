/* Il Chiudi della finestra widget si legge intero.
 *
 * Dal campo: «popup widget: la x con chiudi ancora sballato» — la regola del
 * tondino da 28px delle tessere schiacciava anche la pillola scritta della
 * testata, e la scritta traboccava tagliata («✕ CH…»).
 *
 * La prova nasceva sulla tessera delle Aperture, che non c'e' piu': la sua
 * notizia la da' Finestre, che le aperte le NOMINA nella didascalia. Il Chiudi
 * pero' e' della finestra, non di quella tessera — si apre da qualunque
 * tessera — e allora la prova si sposta sulle Batterie.
 *
 * Con la tessera se n'e' andata anche la seconda meta': «dice due porte aperte
 * ma sotto ne mostra una», cioe' le aperte in testa alle pillole dello stato.
 * Quell'ordine lo metteva il modello delle Aperture, e nessuna tessera lo
 * promette piu'. La garanzia che resta e' piu' forte e sta altrove: la
 * didascalia di Finestre non conta le aperte, le chiama per nome — ed e'
 * sorvegliata da `i-nomi-delle-aperture-si-distinguono.test.js`.
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
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true },
};

const STATI = {};
for (let i = 1; i <= 12; i++) {
  STATI[`sensor.pila_${i}`] = {
    entity_id: `sensor.pila_${i}`,
    /* Due sotto soglia: bastano ad accendere la tessera, che e' tutto quello
     * che serve per avere una finestra da aprire. */
    state: i === 5 || i === 11 ? "8" : "84",
    last_changed: "2026-08-31T06:00:00Z",
    attributes: {
      friendly_name: `Pila ${i}`,
      device_class: "battery",
      unit_of_measurement: "%",
    },
  };
}

test("la pillola Chiudi e' intera e sta dentro la carta", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate((stati) => {
    window.localStorage.setItem("cd_gruppi_extra", JSON.stringify({ batt: Object.keys(stati) }));
    const grp = window.eval(
      "typeof GRUPPI_MONITORAGGIO !== 'undefined' ? GRUPPI_MONITORAGGIO : null",
    );
    if (grp) grp.batt = Object.keys(stati);
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, stati);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, STATI);
  const tessera = page.locator('[data-dm-widget="batterie"]');
  await expect(tessera).toBeVisible({ timeout: 20000 });
  await tessera.click();
  const finestra = page.locator("#dm-widget-popup .dm-widget-detail");
  await expect(finestra).toBeVisible({ timeout: 10000 });

  /* La pillola col ✕ e la parola, larga quanto serve e dentro la carta. */
  const chiudi = finestra.locator(".dm-w-close");
  await expect(chiudi).toBeVisible();
  const [pillola, carta] = await Promise.all([chiudi.boundingBox(), finestra.boundingBox()]);
  expect(pillola.width).toBeGreaterThan(60);
  expect(pillola.x + pillola.width).toBeLessThanOrEqual(carta.x + carta.width + 1);
});
