/* Il popup dei widget parla a carte, e l'auto dice quando finisce.
 *
 * Dal progetto approvato: sotto l'analisi niente elenco di righe — le letture
 * sono caselle sotto «Le misure», gli acceso/spento pillole sotto «Lo stato».
 * E l'auto in carica dice l'ora del pieno («verso le»), con la stessa formula
 * della pagina EV. Il tasto Chiudi sta a destra, come negli altri popup.
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
    ev: [
      {
        name: "B10",
        ov: {
          "dm.ev_batteria_auto": "sensor.leap_soc",
          "dm.ev_stato_ricarica": "sensor.leap_stato",
          "dm.ev_potenza_ricarica": "sensor.leap_kw",
          "dm.ev_autonomia": "sensor.leap_km",
        },
      },
    ],
    entityOverrides: {},
  },
  visibility: { home: true },
};

const STATI = {
  "sensor.leap_soc": {
    entity_id: "sensor.leap_soc",
    state: "53",
    attributes: { unit_of_measurement: "%" },
  },
  "sensor.leap_stato": { entity_id: "sensor.leap_stato", state: "C", attributes: {} },
  "sensor.leap_kw": {
    entity_id: "sensor.leap_kw",
    state: "1.61",
    attributes: { unit_of_measurement: "kW" },
  },
  "sensor.leap_km": {
    entity_id: "sensor.leap_km",
    state: "201",
    attributes: { unit_of_measurement: "km" },
  },
};

test("carte sotto l'analisi, Chiudi a destra, e l'ora del pieno", async ({ page }, testInfo) => {
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
  const tessera = page.locator('[data-dm-widget="ev"]');
  await expect(tessera).toBeVisible({ timeout: 20000 });
  await tessera.click();
  const finestra = page.locator("#dm-widget-popup .dm-widget-detail");
  await expect(finestra).toBeVisible({ timeout: 10000 });

  /* La frase predittiva: in carica, e dice VERSO LE che ora finisce. */
  await expect(finestra.locator(".dm-w-frase")).toContainText("In carica al 53%", {
    timeout: 10000,
  });
  await expect(finestra.locator(".dm-w-frase")).toContainText("verso le");

  /* Le misure a caselle — carica, autonomia — e NESSUNA riga di sola lettura. */
  await expect(finestra.locator(".dm-w-caselle .dm-w-casella")).not.toHaveCount(0);
  const righeDiLettura = await finestra.locator(".dm-w-row .dm-w-val").count();
  expect(righeDiLettura).toBe(0);

  /* Il Chiudi sta a destra della finestra, non addosso alla testata. */
  const posizioni = await page.evaluate(() => {
    const chiudi = document.querySelector("#dm-widget-popup .dm-w-close");
    const scatola = document.querySelector("#dm-widget-popup .dm-widget-detail");
    if (!chiudi || !scatola) return null;
    const c = chiudi.getBoundingClientRect();
    const s = scatola.getBoundingClientRect();
    return { centroChiudi: c.x + c.width / 2, centroScatola: s.x + s.width / 2 };
  });
  expect(posizioni).not.toBeNull();
  expect(posizioni.centroChiudi).toBeGreaterThan(posizioni.centroScatola);
});
