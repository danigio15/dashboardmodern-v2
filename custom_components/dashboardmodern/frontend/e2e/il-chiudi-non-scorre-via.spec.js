/* Il Chiudi dei popup resta in cima anche a lista scorsa.
 *
 * Dal campo: «il tasto Chiudi sta troppo in fondo e non si legge» — nei
 * popup lunghi (il Clima rapido con tante stanze) l'intestazione scorreva
 * via col contenuto e per uscire bisognava risalire tutto. Ora e' incollata
 * al bordo alto del foglio che scorre.
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
    climate: Array.from({ length: 14 }, (_ignora, i) => ({
      id: `c${i}`,
      name: `Stanza ${i + 1}`,
      entity: `climate.stanza_${i + 1}`,
      type: "clima",
    })),
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true },
};

test("scorrendo il popup Clima rapido, il Chiudi resta in vista", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 390, height: 600 });
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate(() => window.apriQuickClima?.());
  const carta = page.locator("#quick-clima-modal .modal-card");
  await expect(carta).toBeVisible({ timeout: 10000 });

  /* La lista e' piu' alta del foglio: c'e' davvero qualcosa da scorrere. */
  const scorre = await carta.evaluate((nodo) => nodo.scrollHeight - nodo.clientHeight);
  expect(scorre).toBeGreaterThan(60);

  await carta.evaluate((nodo) => {
    nodo.scrollTop = nodo.scrollHeight;
  });
  await page.waitForTimeout(250);

  const chiudi = page.locator("#quick-clima-modal .ev-waw-close");
  await expect(chiudi).toBeVisible();
  const geometrie = await page.evaluate(() => {
    const carta = document.querySelector("#quick-clima-modal .modal-card");
    const chiudi = document.querySelector("#quick-clima-modal .ev-waw-close");
    return { carta: carta.getBoundingClientRect(), chiudi: chiudi.getBoundingClientRect() };
  });
  /* Incollato in cima al foglio, non scomparso sopra ne' finito in fondo. */
  expect(geometrie.chiudi.top).toBeGreaterThanOrEqual(geometrie.carta.top - 1);
  expect(geometrie.chiudi.bottom).toBeLessThan(geometrie.carta.top + 120);

  /* E il foglio non sfora mai lo schermo. */
  expect(geometrie.carta.height).toBeLessThanOrEqual(600 * 0.95 + 1);
});
