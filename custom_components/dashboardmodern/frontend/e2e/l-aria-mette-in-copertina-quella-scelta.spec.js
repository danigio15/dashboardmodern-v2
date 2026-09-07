/* «Si potrebbe mettere per il controllo della qualità dell'aria un'entità sulla
 * scheda principale — io per esempio ho questa …_indoor_air_quality — e poi
 * aprendo la scheda qualche valore tipo monossido, polveri, composti
 * volatili?» (#375)
 *
 * Di serie in copertina va la misura messa peggio. Qui si sceglie l'indice
 * della centralina: il numero grande diventa il suo, le sostanze restano tutte
 * dentro la scheda, e il colore continua a dire il giudizio peggiore — un
 * indice che dice «buona» non deve coprire una polvere che dice «cattiva».
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
    lights: [{ entity: "light.salotto", name: "Salotto" }],
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
  "light.salotto": {
    entity_id: "light.salotto",
    state: "off",
    attributes: { friendly_name: "Salotto" },
  },
  "sensor.centralina_indice": {
    entity_id: "sensor.centralina_indice",
    state: "31",
    attributes: {
      friendly_name: "Centralina indice",
      unit_of_measurement: "",
      device_class: "aqi",
    },
  },
  "sensor.centralina_pm25": {
    entity_id: "sensor.centralina_pm25",
    state: "68",
    attributes: {
      friendly_name: "Centralina PM2.5",
      unit_of_measurement: "µg/m³",
      device_class: "pm25",
    },
  },
  "sensor.centralina_co2": {
    entity_id: "sensor.centralina_co2",
    state: "780",
    attributes: {
      friendly_name: "Centralina CO2",
      unit_of_measurement: "ppm",
      device_class: "carbon_dioxide",
    },
  },
};

async function avvia(page, testInfo, principale) {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate(
    ({ stati, scelta }) => {
      window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...stati } };
      const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
      if (raw) Object.assign(raw, stati);
      if (scelta)
        window.localStorage.setItem("cd_allerte", JSON.stringify({ aria: { principale: scelta } }));
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
      window.renderHomeWidgets?.();
    },
    { stati: STATI, scelta: principale },
  );
  const tessera = page.locator('.dm-tile[data-dm-widget="aria"]').first();
  await expect(tessera).toBeVisible({ timeout: 20_000 });
  return tessera;
}

test("senza scelta in copertina va la misura peggiore", async ({ page }, testInfo) => {
  const tessera = await avvia(page, testInfo, "");
  /* Il PM2.5 a 68 µg/m³ è la peggiore delle tre. */
  await expect(tessera.locator("[data-dm-tile-value]")).toHaveText("68,0");
  await expect(tessera.locator("[data-dm-tile-caption]")).toContainText("PM2.5");
});

test("scelta la centralina, il suo indice va in grande e il giudizio resta il peggiore", async ({
  page,
}, testInfo) => {
  const tessera = await avvia(page, testInfo, "sensor.centralina_indice");
  await expect(tessera.locator("[data-dm-tile-value]")).toHaveText("31,0");

  /* Le sostanze si leggono aprendo la scheda, tutte e tre. */
  await tessera.click();
  const caselle = page.locator("#dm-widget-popup .dm-w-caselle .dm-w-casella");
  await expect(caselle.first()).toBeVisible({ timeout: 10_000 });
  const testo = await caselle.allTextContents();
  expect(testo.join(" · ")).toContain("68");
  expect(testo.join(" · ")).toContain("780");

  /* E il verdetto della scheda continua a essere quello della misura peggiore,
   * non quello dell'indice. */
  await expect(page.locator("#dm-widget-popup .dm-w-verdetto")).not.toHaveText(/Buona|Good/);
});
