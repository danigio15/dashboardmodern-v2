/* La barra scansa i tasti del telefono, e solo dove ci sono. #249
 *
 * Dal campo: «nello smartphone la barra inferiore e' parzialmente coperta dai
 * tasti Android. Se fosse possibile alzarla leggermente sarebbe perfetto».
 * Alzarla di un tanto fisso l'avrebbe lasciata sospesa per niente su un
 * telefono a gesti, su un tablet e su un computer: quanto alzarla lo dice il
 * dispositivo — e' la fascia che il sistema si tiene in fondo allo schermo, e
 * vale zero dove non c'e' niente da scansare.
 *
 * Qui quella fascia si finge, perche' un browser di prova non ha i tasti di
 * Android: la plancia la legge da una variabile sola, e la prova le dice
 * quanto vale.
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
  visibility: { home: true, energy: true },
};

/** Quanti pixel restano fra il fondo della barra e il fondo dello schermo. */
const altezzaDalFondo = (page, selettore) =>
  page.evaluate((sel) => {
    const nodo = document.querySelector(sel);
    if (!nodo) return null;
    const riquadro = nodo.getBoundingClientRect();
    return Math.round(window.innerHeight - riquadro.bottom);
  }, selettore);

async function fingiIlFondoDiSistema(page, pixel) {
  await page.evaluate((quanti) => {
    document.documentElement.style.setProperty("--dm-fondo-di-sistema", `${quanti}px`);
  }, pixel);
  await page.waitForTimeout(600);
}

test("la barra si alza esattamente di quello che il sistema si prende", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  /* La barra ferma: e' come parte, e su un telefono e' quella che si vede. */
  await page.evaluate(() => document.body.classList.add("cd-nav-fixed"));
  await expect(page.locator("nav.tabs.bottom-nav-bar")).toBeVisible({ timeout: 20_000 });

  /* Senza niente da scansare la barra sta dov'e' sempre stata: chi non ha i
   * tasti non deve vedersela sollevata per un difetto che non ha. */
  await fingiIlFondoDiSistema(page, 0);
  const aRiposo = await altezzaDalFondo(page, "nav.tabs.bottom-nav-bar");
  expect(aRiposo).toBe(18);

  /* Con i tasti di sistema — qui quarantotto pixel, la misura tipica di un
   * Android a tre tasti — sale esattamente di quei quarantotto. */
  await fingiIlFondoDiSistema(page, 48);
  const coiTasti = await altezzaDalFondo(page, "nav.tabs.bottom-nav-bar");
  expect(coiTasti).toBe(aRiposo + 48);

  /* E torna giu' quando la fascia sparisce: e' un adattamento, non uno
   * spostamento una volta per tutte. */
  await fingiIlFondoDiSistema(page, 0);
  expect(await altezzaDalFondo(page, "nav.tabs.bottom-nav-bar")).toBe(aRiposo);
});

test("anche la maniglia che tira fuori la barra sta sopra i tasti", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));

  /* La maniglia esiste solo con la barra a scomparsa: con la barra ferma non
   * c'e' niente da tirare fuori, e infatti sparisce. */
  await page.evaluate(() => {
    localStorage.setItem("cd_navbar_mode", "auto");
    document.body.classList.remove("cd-nav-fixed", "nav-visible");
    document.querySelector("nav.tabs.bottom-nav-bar")?.classList.remove("visible");
    window.cdApplyNavMode?.();
  });
  const maniglia = "#bottomNavHandle";
  if (
    !(await page
      .locator(maniglia)
      .isVisible()
      .catch(() => false))
  )
    test.skip(true, "questo schermo non ha la maniglia");

  await fingiIlFondoDiSistema(page, 0);
  const aRiposo = await altezzaDalFondo(page, maniglia);
  await fingiIlFondoDiSistema(page, 48);
  expect(await altezzaDalFondo(page, maniglia)).toBe(aRiposo + 48);
});
