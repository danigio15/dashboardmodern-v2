/* L'icona mdi:* di una porta si DISEGNA, non si legge.
 *
 * Dal campo (con scatto): l'editor Aperture mostrava «mdi:gate»,
 * «mdi:door-closed», «mdi:window-shutter» scritti come testo accanto al nome
 * — il catalogo di casa scrive token mdi e chi disegnava li stampava grezzi.
 * Ora il motore delle icone li disegna: nell'editor, nella pagina Sicurezza
 * e nel widget.
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

test("niente «mdi:» scritto nelle righe: l'icona e' un disegno", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate(() => {
    window.localStorage.setItem(
      "cd_security_doors",
      JSON.stringify([
        { id: "d1", name: "Cancello", entity: "switch.cancello", icon: "mdi:gate", pin: "" },
        { id: "d2", name: "Portoncino", entity: "switch.porta", icon: "mdi:door-closed", pin: "" },
      ]),
    );
    window.apriConfigEntita();
  });
  await page.waitForTimeout(800);
  await page.evaluate(() => window.editorSwitch?.("doors"));
  const righe = page.locator("#ed-body [data-door-index]");
  await expect(righe).toHaveCount(2, { timeout: 20000 });
  /* Il token non si legge da nessuna parte... */
  await expect(page.locator("#ed-body")).not.toContainText("mdi:gate");
  await expect(page.locator("#ed-body")).not.toContainText("mdi:door-closed");
  /* ...perche' dentro la pastiglia c'e' un disegno del motore. */
  const disegni = await page.evaluate(
    () =>
      [...document.querySelectorAll("#ed-body .dm-door-ed-icon")].filter((nodo) =>
        nodo.querySelector("svg, img, .dm-icon-engine-glyph"),
      ).length,
  );
  expect(disegni).toBe(2);
});
