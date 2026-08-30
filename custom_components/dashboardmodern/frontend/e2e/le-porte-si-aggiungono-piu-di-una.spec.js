/* Il + delle Aperture aggiunge sempre, anche dopo la prima porta.
 *
 * «Non ne fa aggiungere piu' di una, il + non va»: questa prova preme il
 * tasto come lo preme un dito — la linguetta vera, poi il + due volte — e
 * pretende che ogni pressione faccia nascere una riga e che tutte finiscano
 * salvate con il loro id. Prima di lei il + delle porte non aveva nessuna
 * guardia: quella storica delle «aperture» copre i gruppi degli avvisi, che
 * sono un'altra scheda. */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
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

test("il + aggiunge una seconda porta dopo la prima", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_SECTION_RUNTIME__?.installed, null, {
    timeout: 60000,
  });
  await page.evaluate(() => {
    localStorage.setItem(
      "cd_security_doors",
      JSON.stringify([
        { id: "door-a", name: "Portone", entity: "lock.portone", icon: "🚪", pin: "" },
      ]),
    );
    window.apriConfigEntita();
  });
  await page.waitForTimeout(400);
  await page.locator('.ed-tab[data-tab="doors"]').click();
  await page.waitForTimeout(400);
  await expect(page.locator("#ed-body .dm-door-ed-row")).toHaveCount(1);
  await page.locator("[data-door-add]").click();
  await page.waitForTimeout(400);
  await expect(page.locator("#ed-body .dm-door-ed-row")).toHaveCount(2);
  // e una terza, per buona misura
  await page.locator("[data-door-add]").click();
  await page.waitForTimeout(400);
  await expect(page.locator("#ed-body .dm-door-ed-row")).toHaveCount(3);
  const salvate = await page.evaluate(() => JSON.parse(localStorage.getItem("cd_security_doors")));
  console.log("SALVATE:", salvate.length, JSON.stringify(salvate.map((d) => d.id)));

  /* Il 🎨 apre il catalogo delle icone e NIENT'ALTRO. Col vestito della lente
   * (.dm-entity-picker) la guardia dei selettori marcava il campo dell'icona
   * come campo entita', e sopra al catalogo si apriva la ricerca delle
   * entita': premuto col dito, si sceglieva un'entita' invece di un'icona. */
  await page.locator("#ed-body .dm-door-ed-row").first().locator("[data-door-edit]").click();
  await page.waitForTimeout(400);
  const iconaInput = page.locator('#ed-body input[data-door-field="icon"]').first();
  await expect(iconaInput).not.toHaveAttribute("data-entity-input", "true");
  await page.locator("[data-door-icon-pick]").first().click();
  await page.waitForTimeout(400);
  await expect(page.locator(".dm-beta11-alert-dialog")).toBeVisible();
  await expect(page.locator("#cd-entpick")).toHaveCount(0);
});
