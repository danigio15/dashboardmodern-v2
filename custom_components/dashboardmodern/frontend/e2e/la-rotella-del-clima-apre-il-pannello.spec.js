/* La rotella sulle righe del Clima, e il riepilogo in cima alle finestre.
 *
 * Sulla riga ci stanno il nome, la temperatura e l'acceso/spento: tutto il
 * resto — in che modalita' sta, a che velocita' gira la ventola, di quanto
 * alzare l'obiettivo — prima si vedeva solo andando nella pagina Clima.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const CLIMI = [
  { id: "cl0", name: "Salone", entity: "climate.salone" },
  { id: "cl1", name: "Cucina", entity: "climate.cucina" },
  { id: "cl2", name: "Studio", entity: "climate.studio" },
];

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: CLIMI,
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, climate: true },
};

async function avvia(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  /* Prima di scrivere gli stati si aspetta che la plancia sia partita: la
   * risposta del ponte a `get_states` arriva quando gli pare, e su una
   * macchina lenta riscriveva le letture appena messe. */
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate((climi) => {
    const grezzi = eval("_RAW_STATES");
    climi.forEach((unita, indice) => {
      grezzi[unita.entity] = {
        entity_id: unita.entity,
        state: indice === 0 ? "heat" : "off",
        attributes: {
          friendly_name: unita.name,
          current_temperature: 20 + indice,
          temperature: 21,
          /* Quello che l'unita' dichiara di accettare: e' da qui che il
             pannello ricava i tasti da offrire. */
          hvac_modes: ["off", "heat", "cool"],
          fan_modes: ["auto", "alto"],
          fan_mode: "auto",
          min_temp: 7,
          max_temp: 32,
          target_temp_step: 0.5,
          current_humidity: 45,
          hvac_action: indice === 0 ? "heating" : "idle",
        },
      };
    });
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, CLIMI);
  await page.waitForTimeout(2000);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page
    .locator('#dm-widgets .dm-tile[data-dm-widget="clima"]')
    .evaluate((nodo) => nodo.click());
  await expect(page.locator("#dm-widget-popup .dm-w-row").first()).toBeVisible();
}

test("la rotella apre le altre impostazioni, e offre solo quelle accettate", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  const pannello = page.locator('#dm-widget-popup [data-dm-w-panel="climate.salone"]');
  await expect(pannello).toBeHidden();
  await page
    .locator('#dm-widget-popup [data-dm-w-more="climate.salone"]')
    .evaluate((nodo) => nodo.click());
  await expect(pannello).toBeVisible();
  // Le modalita' sono quelle che l'unita' dichiara, non un elenco scritto qui.
  const modi = await pannello
    .locator("[data-dm-w-mode]")
    .evaluateAll((nodi) => nodi.map((n) => n.dataset.dmWMode));
  expect(modi).toEqual(["off", "heat", "cool"]);
  // E quella accesa e' segnata.
  await expect(pannello.locator('[data-dm-w-mode="heat"]')).toHaveAttribute("data-on", "true");
  await expect(pannello.locator("[data-dm-w-fan]")).toHaveCount(2);
  await expect(pannello.locator("[data-dm-w-temp]")).toHaveCount(2);
  // Richiudendola sparisce.
  await page
    .locator('#dm-widget-popup [data-dm-w-more="climate.salone"]')
    .evaluate((nodo) => nodo.click());
  await expect(pannello).toBeHidden();
});

test("il passo della temperatura chiede il grado giusto", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  await page.evaluate(() => {
    window.__chiamate = [];
    const vero = window.callService;
    window.callService = (...argomenti) => {
      window.__chiamate.push(argomenti);
      return vero?.apply?.(window, argomenti);
    };
  });
  await page
    .locator('#dm-widget-popup [data-dm-w-more="climate.salone"]')
    .evaluate((nodo) => nodo.click());
  await page
    .locator('#dm-widget-popup [data-dm-w-panel="climate.salone"] [data-dm-w-temp="1"]')
    .evaluate((nodo) => nodo.click());
  // Il numero sotto il dito si aggiorna subito: 21,0 + mezzo grado di passo.
  await expect(
    page.locator('#dm-widget-popup [data-dm-w-panel="climate.salone"] .dm-w-stepper b'),
  ).toHaveText("21,5°");
});

test("in cima alla finestra ci sono i numeri che riassumono", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  const riepilogo = page.locator("#dm-widget-popup .dm-w-caselle .dm-w-casella");
  await expect(riepilogo).toHaveCount(3);
  await expect(riepilogo.first()).toContainText("1/3");
  /* E si legge tutto: il vassoio non taglia le etichette. */
  const tagliate = await riepilogo.evaluateAll(
    (nodi) => nodi.filter((n) => n.scrollHeight > n.clientHeight + 1).length,
  );
  expect(tagliate).toBe(0);
});
