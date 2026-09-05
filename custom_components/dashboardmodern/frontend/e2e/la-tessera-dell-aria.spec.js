/* La tessera dell'aria in Home (#321).
 *
 * «Mi piacerebbe ci fosse un widget come quello luci che segni la qualita'
 * dell'aria relativa a un sensore.» Come il fumo e gli allagamenti, non si
 * configura: chi ha un sensore dell'aria se lo ritrova in Home.
 *
 * Qui si guarda quello che vede chi apre la plancia: la tessera con la misura
 * messa peggio in copertina, e dentro la finestra tutte le letture, ognuna
 * con la sua unita'.
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
    /* Una luce qualunque: serve solo a garantire che la striscia dei widget in
     * Home ci sia, cosi' l'assenza della tessera dell'aria voglia dire
     * qualcosa. */
    lights: [{ entity: "light.salotto", name: "Salotto" }],
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

async function boot(page, testInfo, letture) {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true, null, {
    timeout: 60000,
  });
  await page.evaluate((elenco) => {
    const stati = eval("_RAW_STATES");
    for (const voce of elenco)
      stati[voce.entity_id] = {
        entity_id: voce.entity_id,
        state: String(voce.state),
        attributes: {
          friendly_name: voce.name,
          device_class: voce.device_class,
          unit_of_measurement: voce.unit,
        },
      };
    window.applyStates?.();
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, letture);
  await page.waitForTimeout(1200);
}

test("la tessera dice com'e' l'aria, e la finestra tutte le misure", async ({ page }, testInfo) => {
  await boot(page, testInfo, [
    {
      entity_id: "sensor.salotto_co2",
      name: "Salotto CO₂",
      state: 1200,
      device_class: "carbon_dioxide",
      unit: "ppm",
    },
    {
      entity_id: "sensor.salotto_pm25",
      name: "Salotto PM2.5",
      state: 6,
      device_class: "pm25",
      unit: "µg/m³",
    },
  ]);

  const tessera = page.locator('#dm-widgets .dm-tile[data-dm-widget="aria"]');
  await expect(tessera).toBeVisible();
  /* In copertina la misura messa peggio — l'anidride carbonica a 1200 — non
   * la media con le polveri, che sono a posto. Il numero si scrive come lo
   * scrive la lingua di casa, quindi si guarda quello che c'e' dentro. */
  await expect(tessera.locator("[data-dm-tile-value]")).toHaveText(/1[.,]?200/);
  await expect(tessera.locator("[data-dm-tile-unit]")).toHaveText("ppm");
  await expect(tessera).toContainText("Scarsa · Anidride carbonica");

  await tessera.click();
  const finestra = page.locator("#dm-widget-popup");
  await expect(finestra).toBeVisible();
  /* In cima il giudizio dell'aria, non quello generico delle cose accese. */
  await expect(finestra.locator(".dm-w-verdetto")).toHaveText("Scarsa");
  await expect(finestra.locator(".dm-w-frase")).toContainText("Anidride carbonica");
  await expect(finestra.locator(".dm-w-frase")).toContainText("Aprire una finestra");
  /* E sotto tutte e due le misure, ognuna con la sua unita'. Il numero si
   * scrive come lo scrive la lingua di casa. */
  await expect(finestra).toContainText("ppm");
  await expect(finestra).toContainText("µg/m³");
  await expect(finestra).toContainText("Salotto CO₂");
  await expect(finestra).toContainText("Salotto PM2.5");
});

test("senza sensori dell'aria la tessera non c'e'", async ({ page }, testInfo) => {
  /* Una tessera che dice «buona» senza aver letto niente e' peggio di una
   * tessera che non c'e'. */
  await boot(page, testInfo, [
    { entity_id: "light.salotto", name: "Salotto", state: "on", device_class: "", unit: "" },
    {
      entity_id: "sensor.salotto_temp",
      name: "Salotto temperatura",
      state: 21,
      device_class: "temperature",
      unit: "°C",
    },
  ]);
  /* La striscia c'e' — la luce ce la mette — e la tessera dell'aria no. */
  await expect(page.locator('#dm-widgets .dm-tile[data-dm-widget="luci"]')).toBeVisible();
  await expect(page.locator('#dm-widgets .dm-tile[data-dm-widget="aria"]')).toHaveCount(0);
});
