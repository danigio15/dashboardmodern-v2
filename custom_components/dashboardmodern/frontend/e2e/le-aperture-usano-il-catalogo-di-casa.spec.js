/* Il catalogo icone delle Aperture e' quello del progetto.
 *
 * Dal campo: «il catalogo icone delle Aperture non e' quello del progetto:
 * agganciare il catalogo di casa». La lente degli avvisi/aperture apriva una
 * griglia di emoji nata a parte: ora apre il motore delle icone — porte,
 * cancelli e serrature disegnati coi tratti di casa.
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
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true },
};

test("la lente dell'icona avviso apre il motore di casa, non la griglia emoji", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate(() => window.apriConfigEntita());
  await page.evaluate(() => window.editorSwitch?.("avvisi"));
  const campo = page.locator("#ed-avv-icon");
  await expect(campo).toBeAttached({ timeout: 20000 });

  /* L'anteprima e' il menu: la si preme e deve uscire il catalogo di casa.
   * L'anteprima nasce in un requestAnimationFrame DOPO editorSwitch: su
   * webkit-ipad un click sparato subito la mancava (optional chaining =
   * no-op muto) e il catalogo non usciva mai. Prima si aspetta che ci sia. */
  const anteprima = page.locator(".dm-beta11-alert-preview");
  await expect(anteprima).toBeAttached({ timeout: 20000 });
  await anteprima.evaluate((el) => el.click());
  await expect(page.locator("#dm-visual-picker")).toBeVisible({ timeout: 10000 });
  await expect(page.locator("#dm-beta11-alert-picker")).toHaveCount(0);
  /* E dentro ci sono i disegni, non solo emoji. */
  await expect(page.locator("#dm-visual-picker .dm-picker-option").first()).toBeVisible();
});
