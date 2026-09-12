/* I tre difetti della sezione Auto, nella plancia vera.
 *
 * «Inoltre sezione ev non calcola il tempo di fine.»
 * «Non mostra i kwh della sessione pur avendo configurato entità.»
 * «Menu di scelta percentuale non è quello dell'entità: per questo va in
 *  errore e non mi cambia la percentuale.»
 *
 * La casa di prova è quella del campo: una colonnina che dice «charging»
 * invece della lettera C, che pubblica i kilowatt invece dei watt, un
 * contatore di sessione in wattora, e un limite di carica che sale di cinque
 * in cinque da cinquantacinque.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const MAPPA = {
  "dm.ev_batteria_auto": "sensor.auto_soc",
  "dm.ev_stato_ricarica": "sensor.wallbox_stato",
  "dm.ev_potenza_wallbox": "sensor.wallbox_potenza",
  "dm.ev_energia_sessione": "sensor.wallbox_sessione",
  "dm.ev_target_soc": "select.evcc_limite",
};

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [],
    ev: [{ id: "auto1", name: "La mia auto", kwh: "40", ov: { ...MAPPA } }],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: { ...MAPPA },
  },
  visibility: { home: true, ev: true },
};

const LIMITI = ["55", "60", "65", "70", "75", "80", "85", "90", "95", "100"];

const VALORI = {
  /* Trenta per cento, e la colonnina che dice «charging» — non la lettera C. */
  "sensor.auto_soc": { state: "30", attributes: { unit_of_measurement: "%" } },
  "sensor.wallbox_stato": { state: "charging", attributes: {} },
  /* 10 kW dichiarati in kW: letti come watt sarebbero dieci watt, cioè fermo. */
  "sensor.wallbox_potenza": { state: "10", attributes: { unit_of_measurement: "kW" } },
  /* Il contatore della sessione in wattora: 4200 Wh sono 4,2 kWh. */
  "sensor.wallbox_sessione": { state: "4200", attributes: { unit_of_measurement: "Wh" } },
  "select.evcc_limite": { state: "80", attributes: { options: LIMITI } },
};

async function avvia(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate(
    ({ mappa, valori }) => {
      localStorage.setItem("cd_entity_overrides", JSON.stringify(mappa));
      window.cdApplyCanonicalOverrides?.(mappa);
      const stati = eval("_RAW_STATES");
      for (const [entity, dato] of Object.entries(valori))
        stati[entity] = {
          entity_id: entity,
          state: dato.state,
          attributes: { friendly_name: entity.split(".")[1], ...dato.attributes },
        };
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    },
    { mappa: MAPPA, valori: VALORI },
  );
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.locator('.tab[data-tab="ev"]').click();
  await expect(page.locator("#page-ev")).toHaveClass(/active/);
}

test("il tempo di fine si calcola anche se la colonnina non parla la norma", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  /* Da 30 a 80 su una batteria da 40 kWh sono 20 kWh: a 10 kW, due ore. */
  await expect(page.locator("#page-ev .v-ev-remain").first()).toHaveText("2H 0M RIM.");
  /* E nel popup c'è anche l'ora dell'orologio. */
  await page.locator("#lm-hero-card").click();
  await expect(page.locator("#v-ev-remain-popup")).toContainText("2H 0M RIM.");
  await expect(page.locator("#v-ev-remain-popup .dm-ev-verso")).toContainText("verso le");
});

test("i kWh della sessione escono, nell'unità giusta", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  /* 4200 Wh sono 4,2 kWh — non 4200. */
  await expect(page.locator("#page-ev .v-ev-energy-all").first()).toHaveText("4.2 kWh");
});

test("il menù della percentuale è quello dell'entità", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  const tendina = page.locator("#sel-target-soc");
  await expect
    .poll(async () => tendina.evaluate((nodo) => [...nodo.options].map((o) => o.value)))
    .toEqual(LIMITI);
  await expect(tendina).toHaveValue("80");
  /* E il cinquanta, che non è fra le opzioni dell'entità, non c'è più. */
  const valori = await tendina.evaluate((nodo) => [...nodo.options].map((o) => o.value));
  expect(valori).not.toContain("50");
});
