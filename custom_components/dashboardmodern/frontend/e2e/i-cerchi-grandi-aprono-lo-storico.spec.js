/* Anche i cerchi grandi aprono il loro storico, in Giornaliera e Mensile.
 *
 * «Nella sezione energia giornaliera e mensile non si apre, sui cerchi che non
 * sono i carichi, i dati storici.»
 *
 * Nella vista Istantanea Solare, Rete, Batteria e Casa hanno il loro
 * `apriStorico`; nelle altre due il documento vendorizzato li disegna senza, e
 * i carichi sotto invece ce l'hanno. Si tocca la Casa e non succede niente.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const ENTITA = {
  "dm.energy_produzione_solare_oggi": "sensor.solare_oggi",
  "dm.energy_consumo_casa_oggi": "sensor.casa_oggi",
  "dm.energy_energia_prelevata_oggi": "sensor.prelevata_oggi",
  "dm.energy_batteria_caricata_oggi": "sensor.batteria_caricata_oggi",
  "dm.energy_produzione_solare_mese": "sensor.solare_mese",
  "dm.energy_consumo_casa_mese": "sensor.casa_mese",
  "dm.energy_rete_acquistata_mese": "sensor.acquistata_mese",
  "dm.energy_batteria_caricata_mese": "sensor.batteria_caricata_mese",
};

const seed = {
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
    entityOverrides: { ...ENTITA },
  },
  visibility: { home: true, energy: true },
};

async function boot(page, testInfo) {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 150_000 : 90_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate((mappa) => {
    /* La mappatura delle caselle vive in `cd_entity_overrides` — e' il posto
     * da cui `resolveEntity` la legge — e in questa prova la memoria e'
     * intestata alla sessione, come fa il guscio quando ne convivono piu' di
     * una. Si scrive dove la legge lui, non dove farebbe comodo a noi. */
    const ns = window.__DASHBOARDMODERN_STORAGE_NS__ || "";
    localStorage.setItem(`${ns}cd_entity_overrides`, JSON.stringify(mappa));
    const stati = eval("_RAW_STATES");
    for (const entita of Object.values(mappa))
      stati[entita] = {
        entity_id: entita,
        state: "12.5",
        attributes: {
          friendly_name: entita,
          unit_of_measurement: "kWh",
          device_class: "energy",
          state_class: "total_increasing",
        },
      };
    /* Si segna chi apre lo storico, invece di aspettare che una finestra vera
     * si disegni: qui si prova il collegamento, non il grafico. */
    window.__STORICO__ = [];
    window.apriStorico = (_evento, ref, nome) => window.__STORICO__.push({ ref, nome });
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, ENTITA);
  await page.evaluate(() => {
    document.querySelectorAll(".page").forEach((n) => n.classList.remove("active"));
    document.getElementById("page-energy")?.classList.add("active");
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  });
  await page.waitForTimeout(900);
}

const CASI = [
  ["n-solar-day", "dm.energy_produzione_solare_oggi"],
  ["n-home-day", "dm.energy_consumo_casa_oggi"],
  ["n-grid-day", "dm.energy_energia_prelevata_oggi"],
  ["n-battery-day", "dm.energy_batteria_caricata_oggi"],
  ["n-solar-month", "dm.energy_produzione_solare_mese"],
  ["n-home-month", "dm.energy_consumo_casa_mese"],
  ["n-grid-month", "dm.energy_rete_acquistata_mese"],
  ["n-battery-month", "dm.energy_batteria_caricata_mese"],
];

test("i cerchi grandi aprono ognuno il suo storico", async ({ page }, testInfo) => {
  await boot(page, testInfo);
  const visti = [];
  for (const [id, ref] of CASI) {
    const cerchio = page.locator(`#${id}`);
    await expect(cerchio, `${id} deve esistere`).toHaveCount(1);
    await expect(cerchio, `${id} deve dirsi toccabile`).toHaveClass(/hist-clickable/);
    await cerchio.dispatchEvent("click");
    visti.push(ref);
  }
  const aperti = await page.evaluate(() => window.__STORICO__.map((voce) => voce.ref));
  expect(aperti).toEqual(visti);
  /* E il nome dice di che periodo si parla, o nella finestra non si capisce
   * se il grafico e' del giorno o del mese. */
  const nomi = await page.evaluate(() => window.__STORICO__.map((voce) => voce.nome));
  expect(nomi.filter((nome) => /oggi/i.test(nome)).length).toBe(4);
  expect(nomi.filter((nome) => /mese/i.test(nome)).length).toBe(4);
});
