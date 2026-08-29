/* La finestra della Piscina, con tutte le vasche e la luce che si accende.
 *
 * Due cose segnalate insieme: «le altre piscine non compaiono nel popup della
 * home» e «la luce della piscina non può essere accesa dal popup».
 *
 * Venivano dallo stesso posto. La finestra leggeva la configurazione così com'è
 * — che sono le caselle della PRIMA vasca — e le altre, che stanno in un elenco
 * accanto, non le ha mai viste. E ogni riga era una scritta: «Luce · Acceso»,
 * da guardare e basta. Chi apre una finestra che dice «Acceso» si aspetta di
 * poterla toccare.
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
    irrigation: { zones: [] },
    energy: {},
  },
  visibility: { home: true, piscina: true },
};

const DUE_VASCHE = {
  name: "Grande",
  tempEnt: "sensor.piscina_temp",
  lightEnt: "light.piscina",
  pools: [{ name: "Idromassaggio", tempEnt: "sensor.spa_temp", lightEnt: "light.spa" }],
};

test("la finestra mostra tutte le vasche, e la luce si accende", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true, null, {
    timeout: 60000,
  });

  await page.evaluate((vasche) => {
    const stati = eval("_RAW_STATES");
    const misura = (id, valore) => {
      stati[id] = {
        entity_id: id,
        state: String(valore),
        attributes: { unit_of_measurement: "°C", friendly_name: id },
      };
    };
    misura("sensor.piscina_temp", 27.4);
    misura("sensor.spa_temp", 34.7);
    for (const id of ["light.piscina", "light.spa"])
      stati[id] = { entity_id: id, state: "off", attributes: { friendly_name: id } };
    localStorage.setItem("cd_piscina", JSON.stringify(vasche));
    /* I comandi non escono di casa: si contano. Il ponte dei widget passa da
     * `dmCallHaService`. */
    window.__comandi = [];
    window.dmCallHaService = (dominio, servizio, dati) => {
      window.__comandi.push(`${dominio}.${servizio} ${dati?.entity_id || ""}`);
      return Promise.resolve(true);
    };
    window.applyStates?.();
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, DUE_VASCHE);
  await page.waitForTimeout(1600);

  await page.locator('#dm-widgets .dm-tile[data-dm-widget="piscina"]').click();
  await page.waitForTimeout(400);

  const finestra = page.locator('#dm-widget-popup [data-dm-widget-detail="piscina"]');
  await expect(finestra).toBeVisible();
  const testo = await finestra.innerText();
  /* Tutte e due le vasche, ciascuna col suo nome davanti. */
  expect(testo).toContain("Grande");
  expect(testo).toContain("Idromassaggio");

  /* E la luce di ognuna e' un interruttore, non una scritta. */
  const interruttori = page.locator(
    '#dm-widget-popup [data-dm-w-light="light.piscina"],#dm-widget-popup [data-dm-w-light="light.spa"]',
  );
  await expect(interruttori).toHaveCount(2);

  await page.locator('#dm-widget-popup [data-dm-w-light="light.spa"]').click();
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.__comandi)).toEqual(["light.toggle light.spa"]);
});
