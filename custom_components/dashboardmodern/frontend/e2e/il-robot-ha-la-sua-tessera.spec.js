/* Il ponte dei widget ha una tessera per ogni sezione, e per gli aspirapolvere
 * non ce l'aveva.
 *
 * Luci, clima, tapparelle, telecamere, energia, piscina, irrigazione: ognuna
 * ha la sua in «La casa adesso». La sezione degli aspirapolvere e' arrivata
 * dopo, e nessuno gliel'ha data — chi ha un robot lo vedeva in Home soltanto
 * scendendo fino alla sua pagina.
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
    robots: [
      { id: "rb1", name: "Robot piano terra", entity: "vacuum.terra" },
      { id: "rb2", name: "Robot piano primo", entity: "vacuum.primo" },
    ],
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, robot: true },
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
  await page.waitForTimeout(1500);
}

const tessera = (page) => page.locator('#dm-widgets .dm-tile[data-dm-widget="robot"]');

test("fermi, la tessera dice la carica piu' bassa", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo, {
    "vacuum.terra": { state: "docked", attributes: { battery_level: 100 } },
    "vacuum.primo": { state: "docked", attributes: { battery_level: 42 } },
  });
  await expect(tessera(page)).toBeVisible();
  await expect(tessera(page)).toContainText("42%");
  /* E aprendola si vedono tutti e due, con lo stato di ognuno — il dettaglio
     puo' aprirsi sotto la tessera o in una finestra, a seconda dello schermo. */
  await tessera(page).evaluate((nodo) => nodo.click());
  const dettaglio = page.locator('[data-dm-widget-detail="robot"]').first();
  await expect(dettaglio).toContainText("Robot piano terra");
  await expect(dettaglio).toContainText("Robot piano primo");
});

test("uno che pulisce vale piu' di una percentuale", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  /* Mentre lavorano — chi pulisce e chi taglia — la notizia e' che stanno
   * lavorando: la carica torna a essere la risposta quando sono tutti fermi. */
  await avvia(page, testInfo, {
    "vacuum.terra": { state: "cleaning", attributes: { battery_level: 88 } },
    "vacuum.primo": { state: "docked", attributes: { battery_level: 42 } },
  });
  await expect(tessera(page)).toBeVisible();
  await expect(tessera(page)).toContainText("1");
  await expect(tessera(page)).toContainText(/al lavoro/i);
});

test("senza robot configurati la tessera non c'e'", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, {
    ...SEME,
    sections: { ...SEME.sections, robots: [] },
  });
  await page.waitForTimeout(2000);
  await expect(tessera(page)).toHaveCount(0);
});
