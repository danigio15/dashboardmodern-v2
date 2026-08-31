/* «Continua a scomparire la scritta in alto: si vede solo il meteo» — e «il
 * meteo in alto si vede male, margini sballati».
 *
 * Il guscio nasconde la testata di Home con uno stile inline quando si apre
 * un'altra sezione e la rimostra SOLO al clic sulla linguetta Home: ogni
 * strada che riporta alla Home senza quel clic la lascia invisibile per
 * sempre. E se la classe della fascia si perde col meteo gia' dentro, il
 * meteo torna alla taglia da card intera e sfonda i margini. Qui si mettono
 * la plancia nei due stati rotti fotografati dal campo e si guarda il
 * guardiano ripararli.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const seme = {
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

const batteDiStato = (page) =>
  page.evaluate(() =>
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} })),
  );

test("la testata nascosta sulla Home torna visibile, col meteo vestito", async ({
  page,
}, testInfo) => {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);

  const testata = page.locator("body > header");

  /* Il meteo finisce nella fascia al primo giro di vita della pagina. */
  await batteDiStato(page);
  await expect(testata).toHaveClass(/dm-testata-col-meteo/, { timeout: 20000 });
  await expect(page.locator("body > header .weather-widget")).toBeAttached();

  /* STATO ROTTO 1: la testata resta col display inline spento mentre la Home
   * e' attiva — com'e' quando si torna alla Home senza passare dal clic. */
  await page.evaluate(() => {
    document.querySelector("body > header").style.display = "none";
  });
  await batteDiStato(page);
  await expect(testata).toBeVisible({ timeout: 10000 });

  /* STATO ROTTO 2: la classe della fascia si perde col meteo gia' dentro —
   * il meteo tornerebbe alla taglia da card intera dentro la fascia. */
  await page.evaluate(() => {
    document
      .querySelector("header:not(.dm-page-mast)")
      .classList.remove("dm-testata-col-meteo");
  });
  await batteDiStato(page);
  await expect(testata).toHaveClass(/dm-testata-col-meteo/, { timeout: 10000 });

  /* E su un'altra sezione la testata nascosta RESTA nascosta: la riparazione
   * non deve rimettere la fascia dove non va. */
  await page.locator('.tab[data-tab="energy"]').evaluate((nodo) => nodo.click());
  await batteDiStato(page);
  await expect(testata).toBeHidden();
});
