/* Il meteo sceso in pagina diventa una card; in testata resta la striscia.
 *
 * «Nel caso in cui il meteo viene spostato da sotto all'intestazione crea una
 * card più bella: la striscia così piccola e sottile non mi piace.»
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
    entityOverrides: { "dm.home_meteo": "weather.casa" },
  },
  visibility: { home: true },
};

const GIORNO = 24 * 60 * 60 * 1000;

async function avvia(page, testInfo, { ordine } = {}) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  if (ordine)
    await page.evaluate(
      (fila) => localStorage.setItem("cd_home_blocchi", JSON.stringify(fila)),
      ordine,
    );
  await page.evaluate(
    ({ giorno }) => {
      const mappa = { "dm.home_meteo": "weather.casa" };
      localStorage.setItem("cd_entity_overrides", JSON.stringify(mappa));
      window.cdApplyCanonicalOverrides?.(mappa);
      const stati = eval("_RAW_STATES");
      stati["weather.casa"] = {
        entity_id: "weather.casa",
        state: "partlycloudy",
        attributes: {
          friendly_name: "Casa",
          temperature: 21,
          humidity: 38,
          pressure: 1016,
          wind_speed: 8,
        },
      };
      stati["sun.sun"] = {
        entity_id: "sun.sun",
        state: "above_horizon",
        attributes: { next_setting: new Date(Date.now() + 5 * 3600_000).toISOString() },
      };
      /* Le previsioni arrivano solo a chi le chiede, e in prova Home Assistant
         non c'è: la presa si sostituisce con una che risponde. */
      const adesso = Date.now();
      const previsioni = [0, 1, 2, 3, 4].map((salto) => ({
        datetime: new Date(adesso + salto * giorno).toISOString(),
        condition: ["partlycloudy", "sunny", "rainy", "cloudy", "windy"][salto],
        temperature: 24 + salto,
        templow: 13 + salto,
      }));
      window.__presaFinta = {
        readyState: 1,
        send(dato) {
          const messaggio = JSON.parse(dato);
          const rispondi = eval("pendingWsCallbacks")[messaggio.id];
          if (!rispondi) return;
          setTimeout(
            () =>
              rispondi({
                success: true,
                result: { response: { "weather.casa": { forecast: previsioni } } },
              }),
            0,
          );
        },
      };
      eval("ws = window.__presaFinta");
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    },
    { giorno: GIORNO },
  );
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
}

test("in testata il meteo resta la striscia di sempre", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  const riga = page.locator(".dm-testata-riga");
  await expect(riga).toBeVisible();
  await expect(riga).not.toHaveAttribute("data-dm-meteo", "card");
  await expect(page.locator(".dm-meteo-giorni")).toHaveCount(0);
});

test("sceso in pagina diventa una card, coi giorni che vengono", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo, {
    ordine: ["persone", "meteo", "widget", "azioni", "stanze", "dispositivi"],
  });
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} })),
  );
  const riga = page.locator("#page-home > .dm-testata-riga");
  await expect(riga).toHaveAttribute("data-dm-meteo", "card");
  /* I quattro giorni dopo oggi: oggi sta già in cima alla card. */
  await expect(riga.locator(".dm-meteo-giorno")).toHaveCount(4);
  await expect(riga.locator(".dm-meteo-oggi")).toContainText("24°");
  /* E le misure che una striscia non aveva spazio di dire. */
  await expect(riga.locator('[data-dm-meteo-extra="pressione"]')).toContainText("1016 hPa");
  await expect(riga.locator('[data-dm-meteo-extra="tramonto"]')).toBeVisible();
  /* La card è alta come una card, non come una riga. */
  const altezza = await riga.evaluate((nodo) => nodo.getBoundingClientRect().height);
  expect(altezza).toBeGreaterThan(180);
});
