/* Il Chiudi della finestra widget si legge intero, e le aperte stanno in testa.
 *
 * Dal campo: «popup widget: la x con chiudi ancora sballato» — la regola del
 * tondino da 28px delle tessere schiacciava anche la pillola scritta della
 * testata, e la scritta traboccava tagliata («✕ CH…»). E «dice due porte
 * aperte ma sotto ne mostra una»: la seconda aperta stava sotto la piega, in
 * mezzo alle chiuse — ora le aperte vengono prima.
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
  STATI[`binary_sensor.finestra_${i}`] = {
    entity_id: `binary_sensor.finestra_${i}`,
    /* Le due aperte NON sono le prime del gruppo: e' proprio il caso che
     * finiva sotto la piega. */
    state: i === 5 || i === 11 ? "on" : "off",
    last_changed: "2026-08-31T06:00:00Z",
    attributes: { friendly_name: `Finestra ${i}` },
  };
}

test("la pillola Chiudi e' intera e le aperte vengono prima", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate((stati) => {
    window.localStorage.setItem("cd_gruppi_extra", JSON.stringify({ win: Object.keys(stati) }));
    const grp = window.eval(
      "typeof GRUPPI_MONITORAGGIO !== 'undefined' ? GRUPPI_MONITORAGGIO : null",
    );
    if (grp) grp.win = Object.keys(stati);
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, stati);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, STATI);
  const tessera = page.locator('[data-dm-widget="aperture"]');
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

  /* Le aperte in testa alle pillole dello stato. */
  const prime = await finestra
    .locator(".dm-w-pillola")
    .evaluateAll((nodi) => nodi.slice(0, 2).map((n) => n.dataset.acceso));
  expect(prime).toEqual(["true", "true"]);
});
