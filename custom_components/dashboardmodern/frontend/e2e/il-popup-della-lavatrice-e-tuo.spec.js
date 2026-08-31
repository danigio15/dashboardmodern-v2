/* Il popup della lavatrice sul documento vero.
 *
 * I quattro programmi cablati nel guscio diventano `cd_lavatrice_programmi`:
 * senza programmi la griglia sparisce, con uno configurato compare quello e
 * solo quello. E l'immagine e' quella della sezione Elettrodomestici — il
 * disegno di casa, non il file /local che quasi nessuno ha.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [{ id: "lav", name: "Lavatrice", type: "lavatrice" }],
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

test("senza programmi niente griglia; configurato uno, compare quello solo", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate(() => window.apriPopupLavatrice?.());
  const modal = page.locator("#lavatrice-modal");
  await expect(modal).toHaveClass(/show/, { timeout: 10000 });

  /* Questa casa non ha gli script storici mappati: griglia sparita, e via
   * anche i quattro tasti cablati del guscio. */
  const griglia = modal.locator(".lav-preset-grid");
  await expect(griglia).toBeHidden();
  await expect(modal).not.toContainText("Rapido 59");

  /* L'immagine e' il disegno della sezione Elettrodomestici. */
  await expect(modal.locator(".dm-lav-veste .dm-appliance-art svg")).toHaveCount(1);
  await expect(modal.locator("#img-lavatrice")).toBeHidden();

  /* Un programma configurato: compare lui, e il tocco esegue la SUA entita'. */
  await page.evaluate(() => {
    window.localStorage.setItem(
      "cd_lavatrice_programmi",
      JSON.stringify([{ name: "Eco 40", entity: "script.lavatrice_eco", icon: "🌿" }]),
    );
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed"));
  });
  await expect(griglia).toBeVisible({ timeout: 10000 });
  await expect(griglia.locator(".lav-preset-btn")).toHaveCount(1);
  await expect(griglia).toContainText("Eco 40");

  await page.evaluate(() => {
    window.__DM_TOGGLE__ = [];
    window.toggle = (entity) => window.__DM_TOGGLE__.push(entity);
  });
  await griglia.locator(".lav-preset-btn").click();
  expect(await page.evaluate(() => window.__DM_TOGGLE__)).toEqual(["script.lavatrice_eco"]);
});
