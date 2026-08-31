/* Il tasto Accendi/Spegni della card si toglie per apparecchio.
 *
 * «Aggiungere la possibilita' di disabilitare lo switch on/off per singolo
 * elettrodomestico»: chi mappa l'interruttore del frigo per leggere lo stato
 * non vuole spegnerlo da una card. Col flag la card perde il tasto e tiene
 * la lettura; senza flag resta tutto com'era.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    loads: [],
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    appliances: [
      {
        id: "frigo",
        name: "Frigorifero",
        type: "frigo",
        control_entity: "switch.frigo",
        power_entity: "sensor.frigo_w",
        switch_disabled: true,
      },
      {
        id: "lavatrice",
        name: "Lavatrice",
        type: "lavatrice",
        control_entity: "switch.lavatrice",
        power_entity: "sensor.lavatrice_w",
      },
    ],
    entityOverrides: {},
  },
  visibility: { home: true, appliances: true },
};

const STATI = {
  "switch.frigo": { entity_id: "switch.frigo", state: "on", attributes: {} },
  "sensor.frigo_w": {
    entity_id: "sensor.frigo_w",
    state: "86",
    attributes: { unit_of_measurement: "W" },
  },
  "switch.lavatrice": { entity_id: "switch.lavatrice", state: "on", attributes: {} },
  "sensor.lavatrice_w": {
    entity_id: "sensor.lavatrice_w",
    state: "300",
    attributes: { unit_of_measurement: "W" },
  },
};

test("il frigo col flag non offre il tasto, la lavatrice si'", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate((stati) => {
    window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...stati } };
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, stati);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed"));
  }, STATI);
  await page.evaluate(() => document.querySelector('.tab[data-tab="appliances-main"]')?.click());

  const cardFrigo = page.locator('[data-appliance-id="frigo"]').first();
  const cardLavatrice = page.locator('[data-appliance-id="lavatrice"]').first();
  await expect(cardLavatrice).toBeVisible({ timeout: 15000 });
  await expect(cardFrigo).toBeVisible();

  /* La lettura resta — la card del frigo dice che e' in funzione — ma il
   * tasto di accensione c'e' solo dove non e' stato tolto. */
  await expect(cardLavatrice.locator(".dm-ap-power")).toHaveCount(1);
  await expect(cardFrigo.locator(".dm-ap-power")).toHaveCount(0);
});
