/* La bolla della batteria vive di potenza, non di stato di carica.
 *
 * «Se non metto l'entita' SoC ma solo la potenza non si crea il cerchio con
 * il flusso»: il cerchio della batteria deve nascere dall'entita' di potenza
 * — e' lei che alimenta il flusso — e lo stato di carica e' un di piu': la
 * sua riga compare solo se c'e', e quando c'e' dice la percentuale nuda,
 * senza la dicitura «SOC» davanti.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const seme = (battery) => ({
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
    energy: {
      solar: { power: "sensor.fv_w" },
      house: { power: "sensor.casa_w" },
      battery,
    },
    entityOverrides: {},
  },
  visibility: { home: true, energy: true },
});

const STATI = {
  "sensor.fv_w": {
    entity_id: "sensor.fv_w",
    state: "4100",
    attributes: { unit_of_measurement: "W" },
  },
  "sensor.casa_w": {
    entity_id: "sensor.casa_w",
    state: "3500",
    attributes: { unit_of_measurement: "W" },
  },
  "sensor.batt_w": {
    entity_id: "sensor.batt_w",
    state: "250",
    attributes: { unit_of_measurement: "W" },
  },
  "sensor.batt_soc": {
    entity_id: "sensor.batt_soc",
    state: "86",
    attributes: { unit_of_measurement: "%" },
  },
};

async function avvia(page, testInfo, battery) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme(battery));
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate((stati) => {
    window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...stati } };
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, stati);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, STATI);
  await page.waitForTimeout(2500);
}

test("con la sola potenza il cerchio c'e', e la riga del SoC no", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await avvia(page, testInfo, { power: "sensor.batt_w" });
  await expect
    .poll(() => page.evaluate(() => document.getElementById("n-battery")?.style.display ?? null))
    .not.toBe("none");
  const soc = await page.evaluate(() => {
    const nodo = document.getElementById("v-battery-soc");
    return nodo ? { hidden: nodo.hidden, testo: nodo.textContent } : null;
  });
  if (soc) expect(soc.hidden).toBe(true);
});

test("col SoC configurato si legge la percentuale nuda, senza la dicitura", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await avvia(page, testInfo, { power: "sensor.batt_w", soc: "sensor.batt_soc" });
  await expect
    .poll(() => page.evaluate(() => document.getElementById("v-battery-soc")?.textContent ?? null))
    .toBe("86%");
});
