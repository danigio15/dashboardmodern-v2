/* La sezione dell'auto su uno schermo largo.
 *
 * Segnalato: «da desktop la foto non entra, e i tag dei modelli occupano
 * troppo spazio e scendono troppo giu'». Due cose diverse con la stessa
 * causa — una pagina disegnata col pollice in mente:
 *
 *  - la cornice della foto e' larga quanto lo schermo e bassa uguale a come
 *    sarebbe su un telefono, e una foto d'auto ritagliata per riempirla
 *    perdeva tetto e ruote;
 *  - le linguette delle auto sono grandi come bersagli per il dito, e in cima
 *    a una pagina larga diventano una fascia che spinge tutto sotto la piega.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const FOTO =
  "data:image/svg+xml;base64," +
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="640"><rect width="1536" height="640" fill="#12305a"/><rect x="180" y="230" width="1180" height="230" rx="90" fill="#9fc4e8"/></svg>`,
  ).toString("base64");

const seme = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [],
    ev: [
      { name: "B10", ov: {} },
      { name: "Y03", ov: {} },
    ],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, ev: true },
};

test("la foto ci sta tutta e i tag stanno su una riga", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "e' il caso dello schermo largo");
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);
  await page.evaluate((foto) => {
    localStorage.setItem("cd_ev_image", JSON.stringify(foto));
    localStorage.setItem(
      "cd_ev_cars",
      JSON.stringify([
        { uid: "a", name: "B10", enabled: true, ov: {}, img: foto },
        { uid: "b", name: "Y03", enabled: true, ov: {}, img: foto },
      ]),
    );
    localStorage.setItem("cd_ev_car_active", "1");
    document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
    document.getElementById("page-ev")?.classList.add("active");
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready"));
  }, FOTO);
  await page.waitForTimeout(700);

  /* La foto ci sta dentro tutta: ritagliarla per riempire vuol dire perderne
   * dei pezzi, e di un'auto si perdono proprio il tetto e le ruote. */
  const foto = page.locator("#ev-mod-car-img");
  await expect(foto).toHaveCSS("object-fit", "contain");
  /* E il vuoto ai lati lo riempie una copia sfocata di se stessa. */
  await expect(page.locator("#page-ev .dm-evv-hero-blur")).toHaveCount(1);

  /* Le linguette: una riga sola, bassa. Se tornassero a impilarsi, l'altezza
   * qui salirebbe e il resto della pagina ripartirebbe piu' sotto. */
  const alto = await page
    .locator("#ev-car-picker")
    .evaluate((n) => n.getBoundingClientRect().height);
  expect(alto).toBeLessThan(72);
  const righe = await page
    .locator("#ev-car-picker .dm-vehicle-profile-card")
    .evaluateAll(
      (nodi) => new Set(nodi.map((n) => Math.round(n.getBoundingClientRect().top))).size,
    );
  expect(righe).toBe(1);
});
