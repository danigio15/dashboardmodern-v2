/* Il popup dell'elettrodomestico parla come i widget: verdetto, caselle, comandi.
 *
 * «Quando clicco su un elettrodomestico si apre questo popup orrendo: crealo
 * piu' bello stile widget che ti fa anche analisi.» Il guscio elencava ogni
 * entita' con lo slug sotto il nome; ora la finestra apre col verdetto e la
 * frase, le letture a caselle, gli acceso/spento a pillole e i comandi veri.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    loads: [],
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    appliances: [
      {
        name: "Condizionatori",
        type: "condizionatore",
        entities: [
          "switch.condizionatori",
          "sensor.condizionatori_power",
          "sensor.energy_oggi_condizionatori",
          "script.condizionatore_cucina",
        ],
      },
    ],
    entityOverrides: {},
  },
  visibility: { home: true, appliances: true },
};

const STATI = {
  "switch.condizionatori": { entity_id: "switch.condizionatori", state: "on", attributes: {} },
  "sensor.condizionatori_power": {
    entity_id: "sensor.condizionatori_power",
    state: "1105",
    attributes: { unit_of_measurement: "W", friendly_name: "Condizionatori Potenza" },
  },
  "sensor.energy_oggi_condizionatori": {
    entity_id: "sensor.energy_oggi_condizionatori",
    state: "10.24",
    attributes: { unit_of_measurement: "kWh", friendly_name: "Energia oggi condizionatori" },
  },
  "script.condizionatore_cucina": {
    entity_id: "script.condizionatore_cucina",
    state: "off",
    attributes: { friendly_name: "Condizionatore Cucina" },
  },
};

test("verdetto, caselle e comandi al posto dell'elenco di slug", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate((stati) => {
    window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...stati } };
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, stati);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, STATI);
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.apriApplianceDetail(0));
  const lista = page.locator("#details-list");
  await expect(lista.locator(".dm-apde-racconto")).toBeVisible({ timeout: 10000 });
  /* La frase dice chi e cosa: in funzione, coi watt. */
  await expect(lista.locator(".dm-apde-frase")).toContainText("Condizionatori");
  await expect(lista.locator(".dm-apde-frase")).toContainText("in funzione");
  /* Le letture sono caselle, non righe con lo slug sotto. */
  await expect(lista.locator(".dm-apde-casella")).not.toHaveCount(0);
  expect(await lista.locator(".detail-row").count()).toBe(0);
  const slug = await lista.evaluate((nodo) => nodo.textContent.includes("sensor."));
  expect(slug).toBe(false);
  /* L'interruttore e lo script stanno sotto Comandi, col loro tasto. */
  await expect(lista.locator(".dm-apde-comando")).not.toHaveCount(0);
  await expect(
    lista.locator('.dm-apde-comando[data-dm-apde-entity="switch.condizionatori"] .dm-apde-tasto'),
  ).toHaveText("OFF");
  await expect(
    lista.locator(
      '.dm-apde-comando[data-dm-apde-entity="script.condizionatore_cucina"] .dm-apde-tasto',
    ),
  ).toHaveText("▶");
});
