/* Il margine laterale c'e' su tutti i telefoni, chiosco compreso.
 *
 * La distanza dai bordi era scritta in due posti che non si parlavano: il
 * foglio delle fondamenta la metteva a 14px, e il foglio del chiosco — che
 * sui telefoni e' sempre acceso — la riscriveva col peso massimo come
 * `max(env(safe-area-inset-left),0px)!important`. Su un telefono senza tacca
 * laterale quella misura vale zero, e vinceva: la «P» di PERSONE nasceva sul
 * bordo e le tessere finivano tagliate contro il vetro.
 *
 * Adesso la misura ha un nome solo, `--dm-gutter`, e chi ha bisogno di
 * ripeterla ripete il nome.
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
    lights: [{ id: "l1", name: "Lampada", entity: "light.salone" }],
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

test("il corpo della pagina non parte a filo di schermo", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.waitForTimeout(1200);

  const misure = await page.evaluate(() => {
    const stile = getComputedStyle(document.body);
    return {
      sinistra: Number.parseFloat(stile.paddingLeft) || 0,
      destra: Number.parseFloat(stile.paddingRight) || 0,
      chiosco: document.documentElement.getAttribute("data-dm-ios-kiosk") === "true",
    };
  });
  expect(misure.sinistra, `margine sinistro (chiosco: ${misure.chiosco})`).toBeGreaterThanOrEqual(
    14,
  );
  expect(misure.destra, `margine destro (chiosco: ${misure.chiosco})`).toBeGreaterThanOrEqual(14);

  // E il titolo della sezione parte dopo il margine, non sopra.
  const titolo = page.locator("#dm-widgets .dm-widgets-title");
  await expect(titolo).toBeVisible();
  const scatola = await titolo.boundingBox();
  expect(scatola.x).toBeGreaterThanOrEqual(13.5);
});
