/* Le tessere stanno ferme: all'apertura del popup, e sotto la tempesta.
 *
 * «I widget continuano a tremare all'apertura»: gia' due volte il tremolio e'
 * stato un rifacimento di tutta la griglia travestito da aggiornamento — la
 * firma che cambiava con l'apertura, la firma che cambiava con un valore.
 * Questa prova inchioda il contratto dall'esterno, come lo vede l'occhio:
 * si prendono i rettangoli veri delle tessere (getBoundingClientRect) e
 * l'identita' vera dei nodi, si apre il popup, si scatena una tempesta di
 * eventi di stato con valori che cambiano, si chiude — e le tessere devono
 * essere SEMPRE gli stessi nodi, negli stessi pixel. Un solo ridisegno della
 * griglia, o una sola animazione d'ingresso ripartita, e la prova e' rossa.
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
    entityOverrides: {},
  },
  visibility: { home: true },
};

async function avvia(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate(() => {
    localStorage.setItem(
      "cd_todo",
      JSON.stringify([{ id: "l1", name: "Spesa", entity: "todo.spesa" }]),
    );
    localStorage.setItem(
      "cd_prese",
      JSON.stringify([
        { entity: "switch.presa_forno", name: "Forno" },
        { entity: "switch.presa_lavatrice", name: "Lavatrice" },
      ]),
    );
    const states = eval("_RAW_STATES");
    states["todo.spesa"] = {
      entity_id: "todo.spesa",
      state: "2",
      attributes: { friendly_name: "Spesa" },
    };
    for (const presa of ["switch.presa_forno", "switch.presa_lavatrice"])
      states[presa] = { entity_id: presa, state: "off", attributes: {} };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  });
  await page.waitForTimeout(1600);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await expect(page.locator("#dm-widgets .dm-tile")).toHaveCount(2);
}

/* La fotografia della griglia: per ogni tessera il rettangolo vero e un segno
 * privato sul nodo — se la griglia viene rifatta, i nodi nuovi il segno non
 * ce l'hanno. */
const fotografa = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("#dm-widgets .dm-tile")].map((tile) => {
      const r = tile.getBoundingClientRect();
      const marcato = tile.__dmSegno === true;
      tile.__dmSegno = true;
      return {
        chiave: tile.dataset.dmWidget,
        marcato,
        vista: tile.hasAttribute("data-dm-seen"),
        rect: [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 2) / 2),
      };
    }),
  );

function stessaScena(dopo, prima, momento) {
  expect(
    dopo.map((t) => t.chiave),
    `${momento}: le tessere sono cambiate`,
  ).toEqual(prima.map((t) => t.chiave));
  for (const [indice, tessera] of dopo.entries()) {
    expect(tessera.marcato, `${momento}: la tessera "${tessera.chiave}" e' un nodo nuovo`).toBe(
      true,
    );
    /* `data-dm-seen` si scrive solo alla stampa: chi e' nato al primo giro non
     * ce l'ha, e va bene — un nodo che persiste non rifa' l'ingresso. Quello
     * che non deve succedere e' che l'attributo CAMBI: sparito = nodo rifatto
     * prima che `viste()` sapesse di lui. */
    expect(tessera.vista, `${momento}: "${tessera.chiave}" ha cambiato pelle`).toBe(
      prima[indice].vista,
    );
    expect(tessera.rect, `${momento}: la tessera "${tessera.chiave}" si e' mossa`).toEqual(
      prima[indice].rect,
    );
  }
}

test("apertura, tempesta di stati e chiusura non muovono una tessera", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);

  const prima = await fotografa(page);
  expect(prima.map((t) => t.chiave)).toEqual(["todo", "prese"]);

  // 1. L'apertura: il popup sale, la griglia non si accorge di niente.
  await page.locator('#dm-widgets .dm-tile[data-dm-widget="prese"]').click();
  await expect(page.locator("#dm-widget-popup .dm-w-body")).toBeVisible();
  await page.waitForTimeout(400);
  stessaScena(await fotografa(page), prima, "dopo l'apertura");

  // 2. La tempesta: trenta giri di valori che cambiano davvero, a raffica —
  //    la casa viva che l'utente ha in mano quando dice «trema tutto».
  await page.evaluate(async () => {
    const states = eval("_RAW_STATES");
    for (let giro = 0; giro < 30; giro += 1) {
      states["switch.presa_forno"].state = giro % 2 ? "on" : "off";
      states["todo.spesa"] = { ...states["todo.spesa"], state: String(2 + (giro % 3)) };
      window.dispatchEvent(
        new CustomEvent("dashboardmodern:state-changed", {
          detail: { entity_id: "switch.presa_forno" },
        }),
      );
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
      await new Promise((va) => requestAnimationFrame(va));
    }
  });
  await page.waitForTimeout(400);
  stessaScena(await fotografa(page), prima, "sotto la tempesta");

  // Il popup e' rimasto lui, aggiornato senza rinascere: il corpo non e'
  // «fresco» — l'ingresso delle righe appartiene solo al primo disegno.
  const popup = await page.evaluate(() => {
    const body = document.querySelector("#dm-widget-popup .dm-w-body");
    return {
      aperto: !document.getElementById("dm-widget-popup").hidden,
      fresco: body?.dataset.dmFresh,
    };
  });
  expect(popup.aperto, "la tempesta ha chiuso il popup").toBe(true);
  expect(popup.fresco, "il corpo del popup e' rinato invece di aggiornarsi").toBe("false");

  // 3. La chiusura: si esce toccando il velo, e la griglia non si e' mossa.
  await page.mouse.click(5, 5);
  await expect(page.locator("#dm-widget-popup")).toBeHidden();
  await page.waitForTimeout(400);
  stessaScena(await fotografa(page), prima, "dopo la chiusura");
});
