/* Si dipinge la pagina che si guarda, non tutte e nove.
 *
 * Le pagine restano nel documento: il guscio le nasconde, non le toglie. Le
 * sezioni che si ridisegnavano a ogni mazzetto di stati — due volte al secondo
 * in una casa vera — lavoravano quindi anche per le otto pagine che nessuno
 * aveva davanti: la pagina delle Prese rifaceva l'impronta di ogni presa e
 * riscriveva i suoi gruppi, chiusa, per sempre. E' il calore del mini PC
 * segnalato dal campo.
 *
 * Qui si guarda dall'esterno: con la pagina chiusa il suo pezzo di documento
 * non si tocca piu'; arrivandoci si dipinge subito, senza aspettare che in
 * casa cambi qualcosa; e da li' in poi segue gli stati come prima.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "r1", name: "Salone", icon: "mdi:sofa" }],
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
    entityOverrides: {},
  },
  visibility: { home: true, prese: true },
};

const PRESE = [
  { entity: "switch.presa_tv", name: "TV", room: "r1" },
  { entity: "switch.presa_lampada", name: "Lampada", room: "r1" },
];

async function contaLeModifiche(page) {
  return page.evaluate(() => {
    window.__modifiche = 0;
    window.__osservatore?.disconnect();
    window.__osservatore = new MutationObserver((voci) => {
      window.__modifiche += voci.length;
    });
    window.__osservatore.observe(document.getElementById("page-prese"), {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    });
    return true;
  });
}

/* Le prese si accendono davvero: cambia lo stato di tutte e due, cosi' quello
 * che la pagina disegnerebbe e' diverso da quello che c'e' scritto. */
async function laCasaParla(page, stato) {
  await page.evaluate((valore) => {
    const stati = eval("_RAW_STATES");
    for (const entity of ["switch.presa_tv", "switch.presa_lampada"]) {
      stati[entity] = { entity_id: entity, state: valore, attributes: { friendly_name: entity } };
      window.dispatchEvent(
        new CustomEvent("dashboardmodern:state-changed", {
          detail: { entity_id: entity, entity_ids: [entity], coalesced: true },
        }),
      );
    }
  }, stato);
  await page.waitForTimeout(400);
}

test("la pagina chiusa non si ridisegna, e arrivandoci si trova quella di adesso", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate((prese) => {
    /* Le prese vivono nella loro chiave storica, e la si scrive col nome
     * semplice: dentro la plancia il deposito e' gia' quello con il prefisso
     * della sua istanza. */
    localStorage.setItem("cd_prese", JSON.stringify(prese));
    const stati = eval("_RAW_STATES");
    for (const presa of prese)
      stati[presa.entity] = {
        entity_id: presa.entity,
        state: "off",
        attributes: { friendly_name: presa.name },
      };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, PRESE);
  await expect(page.locator("#page-prese")).toBeAttached();
  await page.waitForTimeout(400);

  /* Si resta sulla Home, e la casa parla. */
  await page.evaluate(() => {
    document.querySelectorAll(".page").forEach((pagina) => pagina.classList.remove("active"));
    document.getElementById("page-home")?.classList.add("active");
  });
  await contaLeModifiche(page);
  await laCasaParla(page, "on");
  expect(
    await page.evaluate(() => window.__modifiche),
    "la pagina chiusa si e' ridisegnata lo stesso",
  ).toBe(0);

  /* Si arriva sulle Prese: la pagina si riempie subito, senza aspettare il
   * prossimo cambio di stato — e con lo stato di adesso, non con quello di
   * quando la si era lasciata. */
  await page.locator('.tab[data-tab="prese"]').click();
  await expect(page.locator("#page-prese")).toHaveClass(/active/);
  await expect(page.locator("#prese-wrap [data-dm-lucip]").first()).toBeVisible();
  await expect(page.locator("#prese-wrap")).toContainText("TV");

  /* E da qui in poi segue la casa come prima. */
  await contaLeModifiche(page);
  await laCasaParla(page, "off");
  expect(
    await page.evaluate(() => window.__modifiche),
    "la pagina aperta ha smesso di seguire gli stati",
  ).toBeGreaterThan(0);
});
