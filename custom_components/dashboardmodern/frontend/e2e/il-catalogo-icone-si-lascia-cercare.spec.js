/* Il catalogo icone si lascia cercare, e l'anteprima dice il disegno di casa.
 *
 * Dal campo, nello stesso giro di editor: l'anteprima del form Stanze diceva
 * l'emoji di sistema mentre righe salvate e catalogo dicono il disegno di
 * casa; e nel catalogo, cercando, l'icona trovata restava in fondo a una
 * finestra ad altezza fissa con un vuoto enorme sopra — il guscio dei
 * dialoghi da' la riga elastica al secondo figlio, che qui e' la ricerca,
 * non la griglia. Questa prova apre l'editor vero e misura.
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
  },
  visibility: { home: true },
};

test("anteprima col disegno di casa e ricerca che porta i risultati in testa", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate(() => {
    window.apriConfigEntita();
    window.editorSwitch("stanze");
  });
  const icona = page.locator("#ed-body #ed-room-icon");
  await expect(icona).toBeAttached({ timeout: 20000 });

  /* L'anteprima della doccia e' il disegno di casa, non l'emoji 🚿. */
  await page.evaluate(() => {
    const input = document.querySelector("#ed-body #ed-room-icon");
    input.value = "mdi:shower";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  const trigger = page.locator("#ed-body .dm-beta5-room-icon-trigger");
  await expect(trigger).toBeVisible({ timeout: 10000 });
  await expect(trigger.locator('[data-dm-disegno="casa"]')).toHaveCount(1, { timeout: 10000 });

  /* Il catalogo si apre e la griglia sta SOTTO la ricerca, non in fondo. */
  await trigger.click();
  const dialogo = page.locator(".dm-visual-picker .dm-picker-dialog");
  await expect(dialogo).toBeVisible({ timeout: 10000 });
  const ricerca = page.locator(".dm-visual-picker [data-search]");
  const distanza = () =>
    page.evaluate(() => {
      const cerca = document.querySelector(".dm-visual-picker [data-search]");
      const prima = [...document.querySelectorAll(".dm-visual-picker .dm-picker-option")].find(
        (nodo) => !nodo.hidden && nodo.getBoundingClientRect().height > 0,
      );
      if (!cerca || !prima) return null;
      return Math.round(prima.getBoundingClientRect().top - cerca.getBoundingClientRect().bottom);
    });
  const daFermo = await distanza();
  console.log("GRIGLIA SOTTO LA RICERCA (senza filtro):", daFermo);
  expect(daFermo).not.toBeNull();
  expect(daFermo).toBeLessThan(120);

  /* Cercando, il risultato sale in testa: subito sotto la ricerca. */
  await ricerca.fill("bagn");
  await page.waitForTimeout(300);
  const visibili = await page.evaluate(
    () =>
      [...document.querySelectorAll(".dm-visual-picker .dm-picker-option")].filter(
        (nodo) => !nodo.hidden && nodo.getBoundingClientRect().height > 0,
      ).length,
  );
  console.log("RISULTATI VISIBILI:", visibili);
  expect(visibili).toBeGreaterThan(0);
  const filtrata = await distanza();
  console.log("GRIGLIA SOTTO LA RICERCA (con filtro):", filtrata);
  expect(filtrata).toBeLessThan(120);
});
