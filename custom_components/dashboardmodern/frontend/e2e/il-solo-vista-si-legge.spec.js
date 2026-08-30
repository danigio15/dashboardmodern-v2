/* Il blocco «Si vede ma non si comanda» del modale luce e' impaginato.
 *
 * Dal campo: la spiegazione compariva schiacciata in una colonnina sul bordo
 * destro, una parola per riga, col checkbox abbandonato a sinistra — il
 * guscio dei modali detta ai .ed-form-row una griglia «campo + 48px» che qui
 * non c'entra. La prova apre il modale vero e MISURA: la spiegazione deve
 * essere larga, e stare sulla stessa riga del checkbox.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "cucina", name: "Cucina", icon: "mdi:stove" }],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [{ entity: "light.faretti_cucina", name: "Faretti centrali", room: "cucina" }],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, luci: true },
};

test("la spiegazione e' larga e affiancata al checkbox", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate(() => {
    window.apriConfigEntita();
    window.editorSwitch("luci");
  });
  await page.waitForTimeout(1200);
  await page
    .locator(
      '#ed-body [data-dm-edit-kind="light"], #ed-body .dm-light-row button:has-text("✏️"), #ed-body [data-dm-edit-index]',
    )
    .first()
    .click({ timeout: 15000 });
  const riga = page.locator(".dm-section-modal .dm-solo-lettura-riga");
  await expect(riga).toBeVisible({ timeout: 10000 });
  const misura = await page.evaluate(() => {
    const riga = document.querySelector(".dm-section-modal .dm-solo-lettura-riga");
    const casella = riga?.querySelector('input[type="checkbox"]');
    const testo = riga?.querySelector("small");
    if (!casella || !testo) return null;
    const c = casella.getBoundingClientRect();
    const s = testo.getBoundingClientRect();
    return {
      larghezzaTesto: Math.round(s.width),
      stessaRiga: Math.abs(c.top - s.top) < 24,
      parole: testo.textContent.slice(0, 30),
    };
  });
  console.log("MISURA:", JSON.stringify(misura));
  expect(misura).not.toBeNull();
  expect(misura.larghezzaTesto).toBeGreaterThan(300);
  expect(misura.stessaRiga).toBe(true);
});
