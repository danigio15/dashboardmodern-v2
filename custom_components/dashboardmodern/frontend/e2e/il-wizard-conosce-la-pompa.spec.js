/* La pompa di calore c'è anche alla prima configurazione.
 *
 * Il tipo «♨️ Pompa di calore» (#195) non sta nel markup vendored: la voce la
 * aggiunge la riparazione dei tipi clima, che però correva all'avvio e dopo i
 * giri dell'editor. `#wz-cl-type` nasce quando il wizard si apre — dopo
 * l'avvio, e fuori dall'editor — quindi la voce non gli arrivava mai: chi
 * configurava la casa la prima volta poteva scegliere solo fra condizionatore
 * e termosifone, e la pompa andava aggiunta dopo, dalla configurazione.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const seed = {
  schema_version: 4,
  sections: { rooms: [], lights: [], appliances: [], loads: [], covers: [] },
  visibility: { home: true },
};

test("il wizard offre la pompa di calore, con le stesse parole degli altri editor", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);

  // La scheda delle entità è il quinto passo, e l'accordion del clima c'è
  // quando la sezione non è stata spenta.
  await page.evaluate(() => window.eval("apriSetupWizard()"));
  await expect(page.locator("#wz-card")).toBeAttached();
  await page.evaluate(() => window.eval("WIZ.step = 5; WIZ.sections = {}; wzRender();"));

  const select = page.locator("#wz-cl-type");
  await expect(select).toBeAttached();
  await expect
    .poll(() =>
      select.evaluate((node) => [...node.options].map((option) => option.value).join("|")),
    )
    .toBe("clima|termo|pompa");
  // E le parole sono quelle degli altri due editor, non «Condizionatore».
  await expect(select.locator('option[value="pompa"]')).toHaveText(/Pompa di calore|Heat pump/);
  await expect(select.locator('option[value="clima"]')).toHaveText(/Freddo|Cool/);
  await expect(select.locator('option[value="termo"]')).toHaveText(/Caldo|Heat/);
});
