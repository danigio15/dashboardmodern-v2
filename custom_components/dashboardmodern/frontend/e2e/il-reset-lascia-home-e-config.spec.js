/* Dopo il reset totale in barra restano Home e Config.
 *
 * «Ho effettuato un reset totale ma le sezioni risultano ancora visibili»:
 * il reset svuotava davvero tutto — chiavi locali, store canonico, store
 * condiviso — ma le linguette nate dai moduli moderni (Stanze, Luci, Prese,
 * Aspirapolvere) comparivano comunque, perche' nessuna di loro guardava se
 * la propria sezione avesse qualcosa da mostrare. Questa prova avvia la
 * plancia con la configurazione vuota — che e' esattamente lo stato in cui
 * il reset la lascia — e pretende che le voci visibili siano Home e Config
 * e basta.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME_VUOTO = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    climate: [],
    ev: [],
    covers: [],
    lights: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
  },
  visibility: {},
};

test("a configurazione vuota le voci in barra sono Home e Config", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME_VUOTO);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_SECTION_RUNTIME__?.installed, null, {
    timeout: 60000,
  });
  /* Il giro di visibilita' della barra passa piu' volte (subito, a 1.5s, ogni
   * 3s): si aspetta che abbia detto la sua prima di fotografare. */
  await page.waitForTimeout(4000);
  const visibili = await page.evaluate(() =>
    [...document.querySelectorAll("nav.tabs .tab")]
      .filter((tab) => {
        const style = getComputedStyle(tab);
        return style.display !== "none" && style.visibility !== "hidden";
      })
      .map((tab) => tab.dataset.tab),
  );
  console.log("VISIBILI:", JSON.stringify(visibili));
  expect(visibili.sort()).toEqual(["config", "home"]);
});
