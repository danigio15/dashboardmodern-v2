/* Due cose che la Home non diceva, viste su una casa vera.
 *
 * La prima: «io ho solo i sensori di apertura dell'infisso, sarebbe carino
 * nella home vedere quali sono aperte». La pagina Tapparelle quelle finestre
 * le disegna da tempo — persiane manuali, un contatto sull'anta, nessun
 * comando — ma la tessera chiedeva alla riga le sue COPERTURE, e di coperture
 * quella riga non ne ha nessuna: in Home non arrivava niente.
 *
 * La seconda: «ho i misuratori che escono in kW, quindi ora ho un assorbimento
 * di 0,27 kW ma il widget mi mostra 0 W, in realta' sarebbero 270 W». La
 * tessera leggeva il numero e ignorava l'unita', e 0,27 arrotondato all'intero
 * e' zero — col flusso che nella stessa pagina scriveva 0,27 kW.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "r1", name: "Bagnetto" }],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [],
    ev: [],
    /* Due finestre senza motori: solo il contatto sull'anta. */
    covers: [
      { id: "c1", name: "Bagnetto", room: "Bagnetto", contact: "binary_sensor.finestra_bagnetto" },
      { id: "c2", name: "Cucina", room: "Cucina", contact: "binary_sensor.finestra_cucina" },
    ],
    pool: {},
    irrigation: { zones: [] },
    energy: { house: { power: "sensor.potenza_casa" } },
    entityOverrides: {},
  },
  visibility: { home: true, covers: true, energy: true },
};

async function avvia(page, testInfo, stati) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate((letture) => {
    const raw = eval("_RAW_STATES");
    for (const [id, voce] of Object.entries(letture))
      raw[id] = { entity_id: id, state: voce.state, attributes: voce.attributes || {} };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, stati);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForTimeout(1500);
}

const tessera = (page, chiave) =>
  page.locator(`#dm-widgets .dm-tile[data-dm-widget="${chiave}"]`).first();

test("le finestre col solo contatto si contano in Home", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo, {
    "binary_sensor.finestra_bagnetto": { state: "on", attributes: { device_class: "window" } },
    "binary_sensor.finestra_cucina": { state: "off", attributes: { device_class: "window" } },
  });

  const tapparelle = tessera(page, "tapparelle");
  await expect(tapparelle, "la tessera delle tapparelle non c'e'").toBeVisible();
  // Una aperta su due: il numero grande della tessera e' quello.
  await expect(tapparelle).toContainText("1");

  // E aprendola si vedono tutte e due, con quello che sanno dire.
  await tapparelle.evaluate((nodo) => nodo.click());
  const dettaglio = page.locator('[data-dm-widget-detail="tapparelle"]').first();
  await expect(dettaglio).toBeVisible();
  await expect(dettaglio).toContainText("Bagnetto");
  await expect(dettaglio).toContainText("Cucina");
  await expect(dettaglio).toContainText("Aperta");
  await expect(dettaglio).toContainText("Chiusa");

  /* Una finestra che non si comanda non offre i comandi: le frecce sono una
   * promessa, e su un contatto sarebbe una promessa che nessuno mantiene. */
  const frecce = await dettaglio.locator("[data-dm-w-cover]").count();
  expect(frecce, "una finestra col solo sensore non deve avere le frecce").toBe(0);
});

test("un contatore in kW non fa una casa da zero watt", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo, {
    "sensor.potenza_casa": { state: "0.27", attributes: { unit_of_measurement: "kW" } },
    "binary_sensor.finestra_bagnetto": { state: "off", attributes: {} },
    "binary_sensor.finestra_cucina": { state: "off", attributes: {} },
  });

  const energia = tessera(page, "energia");
  await expect(energia, "la tessera dell'energia non c'e'").toBeVisible();
  const scritto = (await energia.innerText()).replace(/\s+/g, " ");
  expect(scritto, `la tessera dice «${scritto}»`).toMatch(/270\s*W/);
  expect(scritto, "la tessera dice ancora zero watt").not.toMatch(/(^|[^\d])0\s*W/);
});
