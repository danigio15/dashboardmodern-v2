/* La stessa lavatrice, disegnata allo stesso modo dappertutto.
 *
 * Nella sezione Elettrodomestici ogni apparecchio ha il suo ritratto — il
 * disegno del catalogo, quello che si vede anche in plancia. Nella maschera
 * dei Carichi, dove gli stessi apparecchi si assegnano ai cerchi del flusso,
 * usciva invece il carattere scritto nel campo: un'emoji. La stessa lavatrice
 * aveva due facce a seconda di dove la si guardava, e chi configura non ha
 * modo di sapere che sono la stessa cosa.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [
      {
        id: "lav",
        name: "Lavatrice",
        type: "washer",
        visual_key: "washer",
        power_entity: "sensor.lav_w",
        metadata: { beta27_subload_group: "cucina" },
      },
    ],
    loads: [
      {
        id: "cucina",
        name: "Cucina",
        icon: "🍽️",
        power_entity: "sensor.cucina_w",
        order: 0,
        metadata: { flow_group: "cucina" },
      },
    ],
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, energy: true, appliances: true },
};

test("l'elettrodomestico nei Carichi porta il ritratto del suo catalogo", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate(() => {
    window.apriConfigEntita();
    window.editorSwitch("sez1");
  });
  await page.waitForTimeout(2000);
  const linguette = page.locator(
    "#ed-body .sub-tab-btn,#ed-body .ed-inner-tab,#ed-body [data-energy-tab]",
  );
  const quante = await linguette.count();
  for (let i = 0; i < quante; i += 1) {
    const testo = (await linguette.nth(i).textContent()) || "";
    if (/carich|load/i.test(testo)) {
      await linguette.nth(i).evaluate((nodo) => nodo.click());
      break;
    }
  }
  await page.waitForTimeout(2000);
  // La scheda del cerchio si apre, e dentro c'e' la riga dell'elettrodomestico.
  await page
    .locator("#ed-body .dm-loads-card")
    .first()
    .evaluate((card) => {
      card.open = true;
    });
  const riga = page.locator('#ed-body .dm-loads-subload:has-text("Lavatrice")').first();
  await expect(riga).toBeVisible();
  /* Il ritratto e' quello del catalogo — lo stesso segno che la sezione
     Elettrodomestici disegna — non un carattere qualsiasi. */
  await expect(riga.locator(".dm-appliance-art")).toHaveCount(1);
  await expect(riga.locator('.dm-appliance-art[data-dm-art="washer"]')).toHaveCount(1);
});
