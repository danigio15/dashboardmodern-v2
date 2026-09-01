/* Il popup del cerchio e la carta dell'elettrodomestico dicono la stessa parola.
 *
 * Nel filmato la finestra del cerchio Elettrodomestici segna «8/8 IN FUNZIONE»
 * con sei apparecchi a zero watt: lavatrice, lavastoviglie, forno, microonde…
 * tutti «in funzione», tutti a 0 W. Le prese sono accese, gli apparecchi no.
 *
 * La carta dello stesso apparecchio, due schermate piu' in la', diceva la cosa
 * giusta — STANDBY — perche' la sezione Elettrodomestici ha sempre saputo che
 * un interruttore generico acceso significa «c'e' corrente», non «sta
 * lavorando». Erano due regole per la stessa domanda, e quindi due risposte
 * diverse sulla stessa casa.
 *
 * Adesso la domanda la fa una funzione sola. Questa prova mette le due
 * schermate una accanto all'altra e pretende la stessa parola, sullo stesso
 * apparecchio e con gli stessi stati.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [
      {
        id: "app-lavatrice",
        name: "Lavatrice",
        type: "lavatrice",
        power_entity: "sensor.lavatrice_w",
        control_entity: "switch.presa_lavatrice",
        metadata: { beta27_subload_group: "elettro" },
      },
      {
        id: "app-forno",
        name: "Forno",
        type: "generico",
        power_entity: "sensor.forno_w",
        metadata: { beta27_subload_group: "elettro" },
      },
    ],
    loads: [{ id: "elettro", name: "Elettrodomestici", icon: "🔌", order: 0 }],
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: { grid: { power: "sensor.rete_w" }, house: { power: "sensor.casa_w" } },
    entityOverrides: {},
  },
  visibility: { home: true, energy: true, appliances: true },
};

/* La presa della lavatrice e' accesa e l'apparecchio consuma zero: e' il caso
 * del filmato. Il forno invece sta davvero lavorando. */
const LETTURE = {
  "switch.presa_lavatrice": { state: "on" },
  "sensor.lavatrice_w": { state: "0", attributes: { unit_of_measurement: "W" } },
  "sensor.forno_w": { state: "1800", attributes: { unit_of_measurement: "W" } },
  "sensor.rete_w": { state: "1800", attributes: { unit_of_measurement: "W" } },
  "sensor.casa_w": { state: "1800", attributes: { unit_of_measurement: "W" } },
};

test("la stessa parola sulla carta e nella finestra del cerchio", async ({ page }, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate((letture) => {
    const raw = eval("_RAW_STATES");
    for (const [id, stato] of Object.entries(letture)) raw[id] = { entity_id: id, ...stato };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, LETTURE);
  await page.waitForTimeout(1500);

  // Quel che dice la carta, nella sezione Elettrodomestici.
  await page
    .locator('.tab[data-tab="appliances"], .tab[data-tab="appliances-main"]')
    .first()
    .evaluate((nodo) => nodo.click());
  await page.waitForTimeout(1500);
  const dallaCarta = await page.evaluate(() => {
    const carte = [...document.querySelectorAll("[data-appliance-state]")];
    const dette = {};
    for (const carta of carte) {
      const nome = (carta.textContent || "").toLowerCase();
      if (nome.includes("lavatrice")) dette.lavatrice = carta.dataset.applianceState;
      if (nome.includes("forno")) dette.forno = carta.dataset.applianceState;
    }
    return dette;
  });
  expect(dallaCarta.lavatrice, "la carta della lavatrice non si trova").toBeTruthy();

  // Quel che dice la finestra del cerchio.
  await page
    .locator('.tab[data-tab="energy"]')
    .first()
    .evaluate((nodo) => nodo.click());
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.apriSubLoads?.("elettro"));
  await expect(page.locator(".dm-subload-card")).toHaveCount(2);
  const dallaFinestra = await page.evaluate(() => ({
    lavatrice: document.querySelector('[data-dm-subload-card="app-lavatrice"]')?.dataset
      .dmSubloadState,
    forno: document.querySelector('[data-dm-subload-card="app-forno"]')?.dataset.dmSubloadState,
  }));

  expect(
    dallaFinestra.lavatrice,
    "la presa e' accesa e l'apparecchio consuma zero: e' standby, non «in funzione»",
  ).toBe("standby");
  expect(dallaFinestra.lavatrice, "la finestra dice una parola, la carta un'altra").toBe(
    dallaCarta.lavatrice,
  );
  expect(dallaFinestra.forno, "chi consuma davvero resta in funzione").toBe("running");
  expect(dallaFinestra.forno).toBe(dallaCarta.forno);

  // E la fascia del totale conta quelli in funzione, non le prese accese.
  await expect(page.locator(".dm-subload-total-count")).toContainText("1/2");
});
