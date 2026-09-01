/* Le bolle del sole e della batteria seguono l'impianto scelto, sempre.
 *
 * Il guscio le nasconde e le rimostra in `cdApplyFlowMinimal`, guardando quali
 * entita' sono mappate. Ma quella funzione la chiama una volta sola, su un
 * timer all'avvio: cambiando impianto le entita' cambiano sotto i piedi e
 * nessuno la rifa'. Chi passava a una casa senza batteria e poi tornava alla
 * propria trovava la bolla della batteria sparita, e non tornava piu' finche'
 * la pagina non si ricaricava.
 *
 * E' il «improvvisamente scompare tutto» segnalato. E' anche il motivo per cui
 * la prova che gia' lo sorvegliava cadeva un giro su quattro: non stava
 * aspettando un ritardo, stava aspettando una passata che non sarebbe mai
 * arrivata. Qui la decisione la prende chi la sa — l'impianto scelto — a ogni
 * passata, e il giro avanti e indietro si fa tre volte di fila.
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
    energy: {
      name: "Casa Giovanni",
      grid: { power: "sensor.rete_w" },
      solar: { power: "sensor.fv_w" },
      house: { power: "sensor.casa_w" },
      battery: { power: "sensor.batt_w", soc: "sensor.batt_soc" },
      plants: [
        {
          id: "impianto-2",
          name: "Casa Donato",
          grid: { power: "sensor.rete2_w" },
          house: { power: "sensor.casa2_w" },
        },
      ],
      metadata: { plant_seq: 2 },
    },
    entityOverrides: {},
  },
  visibility: { home: true, energy: true },
};

const LETTURE = {
  "sensor.rete_w": "2100",
  "sensor.fv_w": "3400",
  "sensor.casa_w": "2470",
  "sensor.batt_w": "243",
  "sensor.batt_soc": "76",
  "sensor.rete2_w": "780",
  "sensor.casa2_w": "2300",
};

const visibile = (page, id) =>
  page.evaluate((quale) => {
    const nodo = document.getElementById(quale);
    if (!nodo) return false;
    const stile = getComputedStyle(nodo);
    return stile.display !== "none" && stile.visibility !== "hidden";
  }, id);

const scegliImpianto = async (page, id) => {
  await page.locator(`#page-energy [data-dm-impianto="${id}"]`).evaluate((p) => p.click());
  await page.evaluate(() => window.render?.());
};

test("andare e tornare fra due impianti non perde la bolla della batteria", async ({
  page,
}, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);

  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate((letture) => {
    const raw = eval("_RAW_STATES");
    for (const [id, valore] of Object.entries(letture))
      raw[id] = { entity_id: id, state: valore, attributes: { unit_of_measurement: "W" } };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, LETTURE);
  await page
    .locator('.tab[data-tab="energy"]')
    .first()
    .evaluate((b) => b.click());
  await page.evaluate(() => window.render?.());

  /* Tre volte avanti e indietro: una sola andata poteva riuscire per caso —
   * la prova di prima riusciva tre giri su quattro. */
  for (let giro = 1; giro <= 3; giro++) {
    await scegliImpianto(page, "impianto-2");
    await expect.poll(() => visibile(page, "n-battery"), { timeout: 15_000 }).toBe(false);

    await scegliImpianto(page, "impianto");
    await expect.poll(() => visibile(page, "n-battery"), { timeout: 15_000 }).toBe(true);
    // E il sole non se ne va per conto suo: ce l'hanno tutt'e due... no, solo
    // il primo. Torna con lui.
    expect(await visibile(page, "n-solar"), `giro ${giro}: il sole`).toBe(true);
  }
});
