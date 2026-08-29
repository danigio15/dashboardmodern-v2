/* La fascia della plancia si vede sulla Home, e su nient'altro.
 *
 * Chi decideva era l'ultimo che aveva cliccato: il guscio accende e spegne
 * quella fascia dentro il gestore delle voci in basso, e quel gestore lo lega
 * una volta sola al caricamento. Le tre pagine nate dopo — Stanze, Luci,
 * Aspirapolvere — hanno ciascuna il proprio ascolto, che di quella fascia non
 * sa niente: la portavano avanti com'era.
 *
 * Da Home a Stanze restava accesa, e sulla stessa pagina si vedevano due
 * intestazioni. Peggio nell'altro verso: chi arrivava alla Home lasciando la
 * fascia spenta se la ritrovava spenta, cioe' la Home senza la sua testata —
 * il nome della casa e il menu spariti, senza aver toccato niente.
 *
 * Adesso a dirlo e' la pagina che sta aperta, e questa prova gira il giro che
 * prima non reggeva: una pagina del guscio, una pagina di un modulo, e il
 * ritorno alla Home da tutt'e due le strade.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [
      { name: "Salotto", order: 0 },
      { name: "Cucina", order: 1 },
    ],
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
  },
  visibility: {},
};

test("la fascia della plancia si vede solo sulla Home", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);

  const fascia = () =>
    page.evaluate(() => {
      const h = document.querySelector("header:not(.dm-page-mast)");
      return {
        pagina: document.querySelector(".page.active")?.id || "",
        vista: h ? getComputedStyle(h).display !== "none" : false,
      };
    });

  /* La voce va aspettata prima di premerla: le Stanze, le Luci e
   * l'Aspirapolvere sono pagine nate da un modulo, e la loro voce compare
   * quando quel modulo si e' installato — piu' tardi dell'avvio. Chi premeva
   * subito trovava `null`, il `?.` si mangiava il tocco senza dire niente, e
   * la prova cadeva su una pagina che non era mai stata chiesta. */
  const voce = async (tab) => {
    await page
      .locator(`[data-tab="${tab}"]`)
      .first()
      .waitFor({ state: "attached", timeout: 20_000 });
    await page.evaluate((quale) => document.querySelector(`[data-tab="${quale}"]`)?.click(), tab);
    await expect.poll(async () => (await fascia()).pagina, { timeout: 15_000 }).toBe(`page-${tab}`);
  };

  /* Una pagina del guscio: la fascia si spegne, e tornando si riaccende. */
  await voce("energy");
  await expect
    .poll(async () => (await fascia()).vista, {
      message: "la fascia della plancia resta accesa sull'Energia",
    })
    .toBe(false);

  await voce("home");
  await expect
    .poll(async () => (await fascia()).vista, {
      message: "la testata della Home non e' tornata",
    })
    .toBe(true);

  /* Una pagina nata da un modulo: prima restava accesa, e si vedevano due
   * intestazioni sulla stessa pagina. */
  await voce("stanze");
  await expect
    .poll(async () => (await fascia()).vista, {
      message: "sulle Stanze si vedono due intestazioni",
    })
    .toBe(false);

  /* E il ritorno alla Home dal tasto della sezione, non dalla voce in basso:
   * e' la strada che lasciava la Home senza testata. */
  await page.evaluate(() =>
    document.querySelector("#page-stanze .dm-mast-back, #page-stanze .back-home-btn")?.click(),
  );
  await expect.poll(async () => (await fascia()).pagina).toBe("page-home");
  await expect
    .poll(async () => (await fascia()).vista, {
      message: "tornando dalle Stanze la Home resta senza testata",
    })
    .toBe(true);
});
