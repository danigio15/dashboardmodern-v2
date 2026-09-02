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

/* Una bolla che se ne va si porta dietro le sue linee.
 *
 * Nasconderla e basta lasciava i tratteggi appesi al vuoto: linee che partono
 * da dove non c'e' piu' niente. Il guscio, di suo, ne nascondeva sedici a mano;
 * qui se ne vanno per nome, e quindi anche quelle delle viste giorno e mese che
 * nell'elenco del guscio non c'erano. */
test("le linee se ne vanno con la bolla che nominano", async ({ page }, testInfo) => {
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

  const lineeVive = (sorgente) =>
    page.evaluate((quale) => {
      const nodi = [...document.querySelectorAll("#page-energy [id*='line-']")];
      return nodi
        .filter((n) => String(n.id).toLowerCase().includes(quale))
        .filter((n) => getComputedStyle(n).display !== "none")
        .map((n) => n.id);
    }, sorgente);

  // Sull'impianto che la batteria ce l'ha, le sue linee ci sono.
  await expect.poll(() => lineeVive("battery"), { timeout: 15_000 }).not.toHaveLength(0);

  // Sull'impianto che non ce l'ha, non ne resta nessuna appesa.
  await scegliImpianto(page, "impianto-2");
  await expect.poll(() => visibile(page, "n-battery"), { timeout: 15_000 }).toBe(false);
  await expect
    .poll(async () => (await lineeVive("battery")).join(","), { timeout: 15_000 })
    .toBe("");

  // E tornando indietro tornano tutte, non solo la bolla.
  await scegliImpianto(page, "impianto");
  await expect.poll(() => lineeVive("battery"), { timeout: 15_000 }).not.toHaveLength(0);
});

/* La potenza non e' sempre nella casella `power`.
 *
 * Chi ha dichiarato un sensore unico col segno — `battery.signed.power`, un
 * numero solo che dice carica e scarica col verso — la casella di sempre ce
 * l'ha vuota: la lettura buona la ricava il modello. Decidere dal campo grezzo
 * avrebbe nascosto la batteria a chi ce l'ha e funziona benissimo. */
test("la batteria dichiarata col sensore unico col segno resta in scena", async ({
  page,
}, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);

  const seme = JSON.parse(JSON.stringify(SEME));
  // Niente `power`: solo la sorgente unica col segno.
  seme.sections.energy.battery = {
    soc: "sensor.batt_soc",
    signed: { power: "sensor.batt_segno", positive: "carica" },
  };

  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);
  await page.evaluate((letture) => {
    const raw = eval("_RAW_STATES");
    for (const [id, valore] of Object.entries(letture))
      raw[id] = { entity_id: id, state: valore, attributes: { unit_of_measurement: "W" } };
    raw["sensor.batt_segno"] = {
      entity_id: "sensor.batt_segno",
      state: "-243",
      attributes: { unit_of_measurement: "W" },
    };
    raw["sensor.batt_soc"] = {
      entity_id: "sensor.batt_soc",
      state: "76",
      attributes: { unit_of_measurement: "%" },
    };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, LETTURE);
  await page
    .locator('.tab[data-tab="energy"]')
    .first()
    .evaluate((b) => b.click());
  await page.evaluate(() => window.render?.());

  await expect.poll(() => visibile(page, "n-battery"), { timeout: 15_000 }).toBe(true);
});
