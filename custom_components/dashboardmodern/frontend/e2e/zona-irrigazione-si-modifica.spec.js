/* Una zona d'irrigazione si modifica, senza rifarla da capo.
 *
 * Segnalato con una schermata: nelle zone c'era solo il cestino. Per cambiare
 * il nome o la durata di una zona bisognava cancellarla e riaggiungerla — e
 * riaggiungendola si perdeva il posto nella sequenza, che e' l'ordine in cui il
 * programma le avvia, quindi non e' un dettaglio estetico.
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
    climate: [],
    ev: [],
    covers: [],
    lights: [],
    pool: {},
    irrigation: {
      zones: [
        { name: "Prato Spa", entity: "switch.zona1", mins: 15 },
        { name: "Prato Chiosco 1", entity: "switch.zona2", mins: 15 },
        { name: "Prato Chiosco 2", entity: "switch.zona3", mins: 15 },
      ],
    },
    energy: {},
  },
  visibility: { irrigazione: true },
};

test("la zona si modifica e resta al suo posto nella sequenza", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_SECTION_RUNTIME__?.installed, null, {
    timeout: 60000,
  });

  await page.evaluate(() => {
    localStorage.setItem(
      "cd_irrigazione",
      JSON.stringify({
        rainThr: 60,
        time: "06:30",
        zones: [
          { name: "Prato Spa", entity: "switch.zona1", mins: 15 },
          { name: "Prato Chiosco 1", entity: "switch.zona2", mins: 15 },
          { name: "Prato Chiosco 2", entity: "switch.zona3", mins: 15 },
        ],
      }),
    );
    if (!document.getElementById("editor-modal")?.classList.contains("show"))
      window.apriConfigEntita();
    window.editorSwitch("irr");
  });
  await page.waitForTimeout(400);

  /* La matita c'e', una per zona. */
  const matite = page.locator('#ed-body [data-dm-edit-kind="irrigation"]');
  await expect(matite).toHaveCount(3);

  /* Si apre la seconda, si cambia nome e durata, si salva. */
  await matite.nth(1).click();
  await page.waitForTimeout(250);
  await expect(page.locator("#ed-irr-name")).toHaveValue("Prato Chiosco 1");
  await expect(page.locator("#ed-irr-ent")).toHaveValue("switch.zona2");
  await page.locator("#ed-irr-name").fill("Prato Chiosco Nord");
  await page.locator("#ed-irr-min").fill("22");
  await page.evaluate(() => window.edIrrAddZone());
  await page.waitForTimeout(400);

  const zone = await page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem("cd_irrigazione") || "{}").zones || [];
    } catch (errore) {
      return [];
    }
  });
  /* Tre zone come prima — non una quarta — e la modificata e' ancora seconda. */
  expect(zone.map((zona) => zona.name)).toEqual([
    "Prato Spa",
    "Prato Chiosco Nord",
    "Prato Chiosco 2",
  ]);
  expect(zone[1].mins).toBe(22);
  expect(zone[1].entity).toBe("switch.zona2");
});
