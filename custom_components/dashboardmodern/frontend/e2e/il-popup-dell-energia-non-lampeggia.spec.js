/* Il popup di un cerchio dell'Energia non lampeggia mentre lo si guarda.
 *
 * «mi devi risolvere questo continuo fleak sulla sezione energia nei popup»:
 * nel filmato la finestra ELETTRODOMESTICI e' aperta e ferma, e la griglia
 * delle carte sparisce per un fotogramma solo — un lampo bianco — e torna. Sei
 * volte in dieci secondi, a intervalli irregolari: il passo degli
 * aggiornamenti che arrivano da casa. Il foglio non cambia altezza: quello che
 * manca non e' lo spazio, e' il disegno.
 *
 * Quel lampo e' cio' che si vede in mezzo a un `replaceChildren` sulla lista.
 * La finestra sta dentro un velo sfocato (`backdrop-filter` sul
 * `.modal-wrapper`), che sul telefono e' un livello a se': tolte le carte il
 * livello va ridipinto, e finche' non e' pronto resta il bianco del foglio. Il
 * computer ridipinge in tempo e non lo mostra — ed e' per questo che il
 * difetto e' sempre sembrato «solo del telefono».
 *
 * A far rifare la lista bastava la riga dei kWh di oggi che appare o sparisce:
 * un contatore giornaliero che risponde «non disponibile» per un giro, e otto
 * carte venivano buttate via e ristampate.
 *
 * La prova marca i nodi delle carte e pretende di ritrovare GLI STESSI —
 * non copie appena stampate — dopo il battito degli stati, dopo che un
 * contatore giornaliero e' sparito, e dopo che e' tornato. Con la lista che si
 * rifaceva, i nodi marcati erano zero.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const APPARECCHI = [
  "Condizionatori",
  "Frigorifero",
  "Lavatrice",
  "Lavastoviglie",
  "Asciugatrice",
  "Forno",
  "Microonde",
  "Boiler",
];

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: APPARECCHI.map((nome, indice) => ({
      id: `app-${indice}`,
      name: nome,
      type: "generico",
      power_entity: `sensor.app_${indice}_w`,
      daily_energy_entity: `sensor.app_${indice}_kwh`,
      metadata: { beta27_subload_group: "elettro" },
    })),
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
  visibility: { home: true, energy: true },
};

/* Il segno sta sul nodo, non nel documento: un nodo ristampato lo perde. */
const marca = (page) =>
  page.evaluate(() => {
    const carte = [...document.querySelectorAll(".dm-subload-card")];
    carte.forEach((nodo) => {
      nodo.__dmStessaCarta = true;
    });
    return carte.length;
  });

const conta = (page) =>
  page.evaluate(() => {
    const lista = document.getElementById("subloads-list");
    const carte = [...document.querySelectorAll(".dm-subload-card")];
    return {
      quante: carte.length,
      stesse: carte.filter((nodo) => nodo.__dmStessaCarta === true).length,
      fascia: document.querySelectorAll(".dm-subload-summary").length,
      griglia: document.querySelectorAll(".dm-subload-grid").length,
      figli: lista ? lista.children.length : -1,
    };
  });

/* Il giro di stati vero della plancia, quello che a popup aperto richiama il
 * disegnatore del guscio: `render()`, non `applyStates()`. */
const unGiroDiStati = (page, letture) =>
  page.evaluate((valori) => {
    const raw = eval("_RAW_STATES");
    for (const [id, stato] of Object.entries(valori))
      raw[id] = { entity_id: id, state: String(stato), attributes: { unit_of_measurement: "W" } };
    window.render?.();
  }, letture);

test("le carte del popup restano gli stessi nodi mentre gli stati battono", async ({
  page,
}, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);

  const letture = {};
  APPARECCHI.forEach((_nome, indice) => {
    letture[`sensor.app_${indice}_w`] = 10 + indice * 7;
    letture[`sensor.app_${indice}_kwh`] = (indice / 3).toFixed(1);
  });
  letture["sensor.rete_w"] = 900;
  letture["sensor.casa_w"] = 1200;
  await page.evaluate((valori) => {
    const raw = eval("_RAW_STATES");
    for (const [id, stato] of Object.entries(valori))
      raw[id] = { entity_id: id, state: String(stato), attributes: { unit_of_measurement: "W" } };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, letture);

  await page
    .locator('.tab[data-tab="energy"]')
    .first()
    .evaluate((nodo) => nodo.click());
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.apriSubLoads?.("elettro"));
  await expect(page.locator("#subloads-modal")).toHaveClass(/show/);
  await expect(page.locator(".dm-subload-card")).toHaveCount(APPARECCHI.length);

  expect(await marca(page)).toBe(APPARECCHI.length);

  /* Il battito normale: i watt cambiano e basta. */
  for (let giro = 0; giro < 4; giro++) {
    const nuove = {};
    APPARECCHI.forEach((_nome, indice) => {
      nuove[`sensor.app_${indice}_w`] = 10 + indice * 7 + giro * 5;
    });
    await unGiroDiStati(page, nuove);
    await page.waitForTimeout(120);
  }
  expect(await conta(page)).toMatchObject({
    quante: APPARECCHI.length,
    stesse: APPARECCHI.length,
    fascia: 1,
    griglia: 1,
    figli: 2,
  });

  /* E adesso quello che faceva il lampo: un contatore giornaliero che smette
   * di rispondere per un giro. La riga dei kWh se ne va da UNA carta; le altre
   * sette non c'entrano niente, e nessuna delle otto va ristampata. */
  await unGiroDiStati(page, { "sensor.app_2_kwh": "unavailable" });
  await page.waitForTimeout(150);
  const senzaIlGiorno = await conta(page);
  expect(
    senzaIlGiorno,
    "un contatore sparito ha ristampato tutte le carte: e' il lampo",
  ).toMatchObject({
    quante: APPARECCHI.length,
    stesse: APPARECCHI.length,
    fascia: 1,
    griglia: 1,
    figli: 2,
  });
  await expect(page.locator(".dm-subload-daily")).toHaveCount(APPARECCHI.length - 1);

  /* E quando il dato torna, la riga si rimette senza rifare niente. */
  await unGiroDiStati(page, { "sensor.app_2_kwh": "0.7" });
  await page.waitForTimeout(150);
  expect(await conta(page), "al ritorno del dato le carte si sono rifatte").toMatchObject({
    quante: APPARECCHI.length,
    stesse: APPARECCHI.length,
    fascia: 1,
    griglia: 1,
    figli: 2,
  });
  await expect(page.locator(".dm-subload-daily")).toHaveCount(APPARECCHI.length);
});
