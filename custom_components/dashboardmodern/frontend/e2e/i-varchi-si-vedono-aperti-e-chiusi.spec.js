/* «In verde dovrebbe segnare i sensori contact chiusi e in rosso quelli aperti
 * … almeno a colpo d'occhio so quante finestre sono aperte in questo momento»
 * (#367) e «una sezione porte … magari che la card principale come per le luci
 * mostri solo il numero di porte aperte» (#377).
 *
 * Qui si guarda quello che vede chi ha tre contatti in casa: la tessera in Home
 * col numero degli aperti, e la pagina con una carta per contatto — rossa
 * aperta, verde chiusa, smorta quella che non risponde.
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
    lights: [{ entity: "light.salotto", name: "Salotto" }],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, varchi: true },
};

const STATI = {
  "light.salotto": {
    entity_id: "light.salotto",
    state: "off",
    attributes: { friendly_name: "Salotto" },
  },
  "binary_sensor.porta_ingresso": {
    entity_id: "binary_sensor.porta_ingresso",
    state: "on",
    attributes: { friendly_name: "Porta ingresso", device_class: "door" },
  },
  "binary_sensor.finestra_cucina": {
    entity_id: "binary_sensor.finestra_cucina",
    state: "off",
    attributes: { friendly_name: "Finestra cucina", device_class: "window" },
  },
  "binary_sensor.portone_garage": {
    entity_id: "binary_sensor.portone_garage",
    state: "unavailable",
    attributes: { friendly_name: "Portone garage", device_class: "garage_door" },
  },
};

async function avvia(page, testInfo) {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate((stati) => {
    window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...stati } };
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, stati);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    window.renderHomeWidgets?.();
  }, STATI);
}

test("la tessera dice quanti sono aperti, e quali", async ({ page }, testInfo) => {
  await avvia(page, testInfo);

  const tessera = page.locator('.dm-tile[data-dm-widget="varchi"]').first();
  await expect(tessera).toBeVisible({ timeout: 20_000 });
  /* Uno aperto: la porta d'ingresso. Il garage non risponde e non conta né di
   * qua né di là — contarlo chiuso sarebbe una bugia tranquillizzante. */
  await expect(tessera.locator("[data-dm-tile-value]")).toHaveText("1");
  await expect(tessera.locator("[data-dm-tile-caption]")).toContainText("Porta ingresso");
  /* Rossa in cima, perché qualcosa è aperto. */
  await expect(tessera).toHaveAttribute("data-alert", "true");

  /* Aprendola, le pastiglie: rossa l'aperta, verde la chiusa. */
  await tessera.click();
  const aperta = page.locator("#dm-widget-popup .dm-w-pillola", { hasText: "Porta ingresso" });
  const chiusa = page.locator("#dm-widget-popup .dm-w-pillola", { hasText: "Finestra cucina" });
  await expect(aperta).toHaveAttribute("data-tono", "allarme");
  await expect(chiusa).toHaveAttribute("data-tono", "quiete");
});

test("la pagina Varchi elenca i contatti col loro colore", async ({ page }, testInfo) => {
  await avvia(page, testInfo);

  const voce = page.locator('.tab[data-tab="varchi"]');
  await expect(voce).toBeVisible({ timeout: 20_000 });
  await voce.click();

  const pagina = page.locator("#page-varchi");
  await expect(pagina).toHaveClass(/active/);
  await expect(pagina.locator(".dm-varchi-testa strong")).toHaveText(/1 aperto/i);

  const carte = pagina.locator(".dm-varco");
  await expect(carte).toHaveCount(3);
  /* Prima gli aperti: è la risposta alla domanda che si fa aprendo la pagina. */
  await expect(carte.first()).toHaveAttribute("data-varco", "aperto");
  await expect(carte.first()).toContainText("Porta ingresso");
  await expect(
    pagina.locator('.dm-varco[data-varco="chiuso"]', { hasText: "Finestra cucina" }),
  ).toHaveCount(1);
  await expect(
    pagina.locator('.dm-varco[data-varco="muto"]', { hasText: "Portone garage" }),
  ).toHaveCount(1);
});

test("la scheda di configurazione elenca i contatti e ne toglie uno", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  await page.evaluate(() => window.apriConfigEntita());
  await page.evaluate(() => window.editorSwitch?.("varchi"));

  const righe = page.locator("#ed-body .dm-varco-ed-riga");
  await expect(righe).toHaveCount(3, { timeout: 20_000 });

  /* Il sensore che varco non è si toglie dai conti, e la configurazione se lo
   * ricorda. */
  /* Si filtra per l'entity_id e non per il nome: il nome sta dentro un
   * `<input>`, e il valore di una casella non e' testo della pagina. */
  await righe
    .filter({ hasText: "binary_sensor.portone_garage" })
    .locator("[data-dm-varco-escludi]")
    .click();
  await expect
    .poll(
      async () =>
        page.evaluate(
          () => JSON.parse(window.localStorage.getItem("cd_varchi") || "{}")?.escluse || [],
        ),
      { timeout: 10_000 },
    )
    .toEqual(["binary_sensor.portone_garage"]);
  await expect(page.locator("#ed-body .dm-varco-ed-riga")).toHaveCount(2);
});
