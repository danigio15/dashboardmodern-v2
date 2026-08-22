import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

/* «Il cambio visibilita' del pulsante non si vede in tempo reale.»
 *
 * La fascia in cima alla scheda Aspirapolvere dice se la sezione si vede o no,
 * e toccandola si cambia idea. La preferenza cambiava davvero — la barra in
 * basso perdeva la voce — ma la fascia restava verde: la scheda si ridisegna
 * solo quando qualcosa nella sua firma e' cambiato, e la firma diceva soltanto
 * quali robot fossero configurati. Per vedere «nascosta» bisognava uscire dalla
 * linguetta e rientrarci.
 */
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
    robots: [{ id: "r1", name: "Rosetta", entity: "vacuum.rosetta" }],
  },
  visibility: { home: true, robot: true },
};

test("la fascia diventa grigia appena la si tocca", async ({ page }, testInfo) => {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);

  await page.evaluate(() => window.apriConfigEntita());
  await page.locator('.ed-tab[data-tab="robot"]').click();

  const fascia = page.locator('#ed-body [data-key="robot"]').first();
  await expect(fascia).toHaveCount(1);
  await expect(fascia).toHaveText(/visibile/i);

  await fascia.click();

  // Subito, senza cambiare linguetta.
  await expect(page.locator('#ed-body [data-key="robot"]').first()).toHaveText(/nascosta/i);
  expect(await page.evaluate(() => window.cdCfg("cd_sections")?.robot)).toBe(false);

  // E si torna indietro allo stesso modo.
  await page.locator('#ed-body [data-key="robot"]').first().click();
  await expect(page.locator('#ed-body [data-key="robot"]').first()).toHaveText(/visibile/i);
});
