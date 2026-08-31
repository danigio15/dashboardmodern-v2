/* «Popup azioni rapide clima: icone non si vedono bene, troppo piccole;
 * Bagno e Camera da Letto non sono congrue, esce la fiamma; le card sono
 * troppo grandi.»
 *
 * Tre difetti in una finestra: la griglia del guscio senza tetto faceva
 * quadrati da un quarto di schermo; il disegno di casa usciva a 34 pixel
 * sbiadito dal grigio dello spento; e l'unita' senza stanza configurata
 * cadeva sull'emoji nuda del modo — la fiamma gigante. Ora le stanze sono
 * pastiglie con un tetto, il disegno e' a 46 e resta leggibile, la stanza si
 * trova anche per NOME quando il legame non e' configurato, e chi resta
 * orfano prende il termosifone del catalogo, non la fiamma di sistema.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const seme = {
  schema_version: 4,
  sections: {
    rooms: [
      { id: "r-bagno", name: "Bagno", icon: "mdi:shower" },
      { id: "r-camera", name: "Camera da Letto", icon: "mdi:bed" },
    ],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [
      /* Termosifone legato alla stanza per id. */
      {
        id: "c1",
        name: "Bagno",
        entity: "input_boolean.termo_bagno",
        room: "r-bagno",
        type: "termo",
      },
      /* Termosifone SENZA legame: la stanza si deve trovare per nome. */
      { id: "c2", name: "Camera da Letto", entity: "input_boolean.termo_camera", type: "termo" },
      /* Orfano vero: niente stanza, nome suo — ripiego sul termosifone. */
      { id: "c3", name: "Taverna", entity: "input_boolean.termo_taverna", type: "termo" },
    ],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true },
};

test("le stanze del Caldo vestono i disegni di casa, in pastiglie con un tetto", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1248, height: 900 });
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);

  await page.evaluate(() => {
    window.apriQuickClima?.();
    window.setQuickClimaMode?.("caldo");
  });

  const tasti = page.locator("#quick-clima-grid .ns-clima-btn");
  await expect(tasti).toHaveCount(3, { timeout: 20000 });

  /* Pastiglie, non quadrati da un quarto di schermo. */
  for (const tasto of await tasti.all()) {
    const larghezza = (await tasto.boundingBox())?.width || 0;
    expect(larghezza, "una stanza del popup non si stira").toBeLessThanOrEqual(170);
  }

  /* Ognuna col suo disegno: doccia per il Bagno (legame per id), letto per
   * la Camera (trovata per NOME), termosifone per l'orfana — mai la fiamma
   * nuda di sistema. */
  for (const nome of ["Bagno", "Camera da Letto", "Taverna"]) {
    const icona = page
      .locator("#quick-clima-grid .ns-clima-btn", { hasText: nome })
      .locator(".ns-clima-btn-icon");
    await expect(icona, `${nome} ha un disegno, non l'emoji`).not.toHaveText(/🔥/);
    await expect
      .poll(() => icona.evaluate((nodo) => nodo.querySelectorAll("svg").length), {
        timeout: 15000,
      })
      .toBeGreaterThan(0);
  }
});
