/* Con tante stanze, dal computer le ultime non si raggiungevano.
 *
 * Il nastro delle linguette e' una fila che scorre di lato, con la barra di
 * scorrimento nascosta apposta: su un telefono si spinge col dito e funziona.
 * Su un computer il dito non c'e', la barra e' invisibile, e la rotella sopra
 * una fila orizzontale scorre la pagina in giu', non la fila di lato. Le
 * stanze oltre il bordo destro si vedevano a meta' e non c'era modo di
 * arrivarci: «nella pagina stanze, sul pc, se sono tante, come nel mio caso,
 * le ultime sono» irraggiungibili.
 *
 * Dove si punta col mouse la fila va a capo: lo spazio in verticale c'e', e
 * una linguetta che sta a schermo non ha bisogno di nessun gesto da scoprire.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const NOMI = [
  "Soggiorno",
  "Cucina",
  "Camera Matrimoniale",
  "Cameretta Bambini",
  "Bagno Grande",
  "Bagnetto",
  "Ingresso",
  "Corridoio",
  "Studio",
  "Lavanderia",
  "Garage",
  "Taverna",
  "Mansarda",
  "Giardino",
];

const SEME = {
  schema_version: 4,
  sections: {
    rooms: NOMI.map((name, index) => ({ id: `r${index + 1}`, name, icon: "mdi:door" })),
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
  visibility: { home: true, stanze: true },
};

test("dal computer si arriva anche all'ultima stanza", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  test.skip(testInfo.project.name !== "desktop", "e' il caso del computer");
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  });
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  /* La voce «Stanze» se lo gestisce da se', il tocco: si preme la sua. */
  await page.locator('.tab[data-tab="stanze"]').click();
  const nastro = page.locator("#page-stanze .dm-stanze-tabs");
  await expect(nastro).toBeVisible();

  const esito = await page.evaluate(() => {
    const strip = document.querySelector("#page-stanze .dm-stanze-tabs");
    const box = strip.getBoundingClientRect();
    const tabs = [...strip.querySelectorAll(".dm-stanze-tab")];
    const fuori = tabs.filter((tab) => {
      const t = tab.getBoundingClientRect();
      // Fuori dal riquadro visibile del nastro, in orizzontale.
      return t.right > box.right + 1 || t.left < box.left - 1;
    });
    return {
      quante: tabs.length,
      fuori: fuori.map((tab) => tab.textContent.trim().slice(0, 24)),
      nascoste: strip.scrollWidth > strip.clientWidth + 1,
    };
  });

  expect(esito.quante, "le linguette non ci sono").toBeGreaterThan(10);
  expect(
    esito.fuori,
    `queste stanze restano oltre il bordo e col mouse non si raggiungono: ${esito.fuori.join(", ")}`,
  ).toEqual([]);
  expect(esito.nascoste, "il nastro nasconde ancora delle stanze di lato").toBe(false);
});
