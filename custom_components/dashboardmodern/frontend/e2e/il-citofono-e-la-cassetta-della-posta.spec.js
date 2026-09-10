/* «Avendo un intercom ho un button.cancello per aprire, inoltre volevo chiedere
 * una sezione per la cassetta della posta» (#449).
 *
 * Qui si guarda quello che vede chi ha un citofono al cancello e un Vallhorn
 * dentro la cassetta: la tessera in Home, la pagina con la risposta grande in
 * cima, e il tasto che apre — l'unica cosa di questa sezione che si comanda.
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
  visibility: { home: true, citofono: true },
  cd_citofono: {
    citofoni: [
      {
        id: "cancello",
        nome: "Cancello",
        apri: "button.cancello",
        campanello: "binary_sensor.citofono_ding",
      },
    ],
    cassette: [
      {
        id: "cassetta",
        nome: "Cassetta",
        posta: "binary_sensor.vallhorn_motion",
        ritiro: "sensor.vallhorn_illuminance",
      },
    ],
  },
};

/* Mezz'ora fa e sei ore fa: il movimento in cassetta è più recente
 * dell'ultima apertura, quindi la posta è ancora dentro. */
const MEZZORA_FA = () => new Date(Date.now() - 1_800_000).toISOString();
const SEI_ORE_FA = () => new Date(Date.now() - 21_600_000).toISOString();

const STATI = () => ({
  "light.salotto": {
    entity_id: "light.salotto",
    state: "off",
    attributes: { friendly_name: "Salotto" },
  },
  "button.cancello": {
    entity_id: "button.cancello",
    state: "unknown",
    attributes: { friendly_name: "Cancello" },
  },
  "binary_sensor.citofono_ding": {
    entity_id: "binary_sensor.citofono_ding",
    state: "off",
    last_changed: SEI_ORE_FA(),
    attributes: { friendly_name: "Citofono ding", device_class: "occupancy" },
  },
  "binary_sensor.vallhorn_motion": {
    entity_id: "binary_sensor.vallhorn_motion",
    state: "off",
    last_changed: MEZZORA_FA(),
    attributes: { friendly_name: "Vallhorn movimento", device_class: "motion" },
  },
  "sensor.vallhorn_illuminance": {
    entity_id: "sensor.vallhorn_illuminance",
    state: "0",
    last_changed: SEI_ORE_FA(),
    attributes: {
      friendly_name: "Vallhorn luminosità",
      device_class: "illuminance",
      unit_of_measurement: "lx",
    },
  },
});

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
  }, STATI());
}

test("la tessera dice che c'è posta in cassetta", async ({ page }, testInfo) => {
  await avvia(page, testInfo);

  const tessera = page.locator('.dm-tile[data-dm-widget="citofono"]').first();
  await expect(tessera).toBeVisible({ timeout: 20_000 });
  await expect(tessera.locator("[data-dm-tile-value]")).toHaveText("1");
  await expect(tessera.locator("[data-dm-tile-caption]")).toContainText(/posta/i);
});

test("la pagina apre il cancello, e il tasto chiama il servizio giusto", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);

  const voce = page.locator('.tab[data-tab="citofono"]');
  await expect(voce).toBeVisible({ timeout: 20_000 });
  await voce.click();

  const pagina = page.locator("#page-citofono");
  await expect(pagina).toHaveClass(/active/);
  /* Nessuno sta suonando, ma in cassetta c'è qualcosa: è quella la risposta. */
  await expect(pagina.locator(".dm-citofono-testa strong")).toHaveText(/C'è posta/i);

  const cassetta = pagina.locator(".dm-cassetta").first();
  await expect(cassetta).toHaveAttribute("data-stato", "piena");
  await expect(cassetta).toContainText(/Ultimo movimento/i);

  /* Il tasto che apre: si guarda il servizio che parte, non quello che la
   * pagina scrive. */
  await page.evaluate(() => {
    window.__CHIAMATE__ = [];
    window.cdCallServiceJson = (domain, service, data) => {
      window.__CHIAMATE__.push([domain, service, data?.entity_id]);
    };
  });
  await pagina.locator("[data-dm-citofono-apri]").first().click();
  await expect
    .poll(() => page.evaluate(() => window.__CHIAMATE__ || []))
    .toEqual([["button", "press", "button.cancello"]]);

  await pagina.screenshot({ path: testInfo.outputPath("pagina-citofono.png") });
  await testInfo.attach("pagina-citofono", {
    path: testInfo.outputPath("pagina-citofono.png"),
    contentType: "image/png",
  });
});
