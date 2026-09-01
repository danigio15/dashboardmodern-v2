/* La configurazione nuova arrivata da Home Assistant si applica dov'e'.
 *
 * All'avvio la plancia chiede a HA la configurazione dell'utente. Se quella di
 * HA e' piu' recente, prima la applicava e poi RICARICAVA la pagina: nel
 * filmato, quattro secondi dopo l'apertura, lo schermo diventa bianco, il velo
 * di avvio torna su, e la plancia riparte sulla Home buttando via la pagina
 * Energia che si stava guardando. Due avvii invece di uno, ogni volta che si e'
 * toccata la configurazione da un'altra parte.
 *
 * Il ricaricamento c'era perche' applicare dal vivo lasciava indietro la barra:
 * `cd_sections` finiva in memoria, ma le linguette restavano quelle di prima.
 * Adesso si rilegge anche quella, e questa prova e' il paragone che lo dimostra:
 * una plancia che si applica addosso la configurazione nuova deve mostrare
 * esattamente lo schermo di una plancia avviata da zero con quella
 * configurazione — stesse linguette, stesse stanze, stessi cerchi del flusso.
 *
 * Il carico non e' inventato: e' `cdSyncCollect()` preso dalla plancia che ha
 * la configurazione nuova, cioe' esattamente cio' che viaggia su HA.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const semeCon = (stanze, apparecchi, carichi, visibilita) => ({
  schema_version: 4,
  sections: {
    rooms: stanze,
    cameras: [],
    appliances: apparecchi,
    loads: carichi,
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: { grid: { power: "sensor.rete_w" }, house: { power: "sensor.casa_w" } },
    entityOverrides: {},
  },
  visibility: visibilita,
});

const PRIMA = semeCon(
  [{ id: "room-salone", name: "Salone", icon: "🛋️", order: 0 }],
  [
    {
      id: "app-frigo",
      name: "Frigorifero",
      type: "generico",
      power_entity: "sensor.frigo_w",
      room_id: "room-salone",
    },
  ],
  [{ id: "elettro", name: "Elettrodomestici", icon: "🔌", order: 0 }],
  { home: true, energy: true, stanze: true },
);

const DOPO = semeCon(
  [
    { id: "room-salone", name: "Soggiorno", icon: "🛋️", order: 0 },
    { id: "room-cucina", name: "Cucina", icon: "🍳", order: 1 },
  ],
  [
    {
      id: "app-frigo",
      name: "Frigorifero",
      type: "generico",
      power_entity: "sensor.frigo_w",
      room_id: "room-cucina",
    },
    {
      id: "app-forno",
      name: "Forno",
      type: "generico",
      power_entity: "sensor.forno_w",
      room_id: "room-cucina",
    },
  ],
  [
    { id: "elettro", name: "Elettrodomestici", icon: "🔌", order: 0 },
    { id: "boiler", name: "Boiler", icon: "🚿", order: 1 },
  ],
  { home: true, energy: true, stanze: true, prese: true },
);

const LETTURE = {
  "sensor.frigo_w": 80,
  "sensor.forno_w": 1200,
  "sensor.rete_w": 900,
  "sensor.casa_w": 1280,
};

async function seminaStati(page) {
  await page.evaluate((valori) => {
    const raw = eval("_RAW_STATES");
    for (const [id, stato] of Object.entries(valori))
      raw[id] = { entity_id: id, state: String(stato), attributes: { unit_of_measurement: "W" } };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, LETTURE);
  await page.waitForTimeout(1200);
}

/* Quello che si vede: le linguette della barra, le stanze, i cerchi del flusso. */
const schermata = (page) =>
  page.evaluate(() => ({
    linguette: [...document.querySelectorAll("nav.tabs .tab")]
      .filter((nodo) => getComputedStyle(nodo).display !== "none")
      .map((nodo) => nodo.dataset.tab)
      .sort(),
    stanze: [
      ...document.querySelectorAll("#page-stanze [data-dm-room-card], #page-stanze .room-card"),
    ]
      .map((nodo) => (nodo.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40))
      .sort(),
    cerchi: [...document.querySelectorAll("#page-energy [data-dm-flow-node]")]
      .map((nodo) => (nodo.querySelector(".node-label")?.textContent || "").trim())
      .filter(Boolean)
      .sort(),
  }));

async function apriEnergia(page) {
  await page
    .locator('.tab[data-tab="energy"]')
    .first()
    .evaluate((nodo) => nodo.click());
  await page.waitForTimeout(1200);
}

test("applicare la configurazione di HA da' lo stesso schermo di un avvio pulito", async ({
  page,
}, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 180_000 : 120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));

  // La plancia che HA la configurazione nuova: da lei esce il carico vero.
  const seconda = await page.context().newPage();
  await seconda.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(seconda, "dashboard.html", testInfo, DOPO);
  await seminaStati(seconda);
  const carico = await seconda.evaluate(() => window.cdSyncCollect());
  await apriEnergia(seconda);
  const daAvvio = await schermata(seconda);

  // La plancia con la vecchia, che se lo applica addosso come fa il tiraggio.
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, PRIMA);
  await seminaStati(page);
  await page.evaluate(() => {
    window.__dmNonRicaricata = true;
  });
  const applicati = await page.evaluate((payload) => {
    const n = window.cdSyncApply(payload);
    try {
      window.cdApplyNavVis?.();
    } catch (_errore) {}
    window.render?.();
    return n;
  }, carico);
  expect(applicati, "il carico non ha cambiato niente: la prova non prova nulla").toBeGreaterThan(
    0,
  );
  await page.waitForTimeout(1800);
  await apriEnergia(page);
  const dalVivo = await schermata(page);

  expect(dalVivo.linguette, "la barra e' rimasta a quella di prima").toEqual(daAvvio.linguette);
  expect(dalVivo.stanze, "le stanze non sono quelle nuove").toEqual(daAvvio.stanze);
  expect(dalVivo.cerchi, "i cerchi del flusso non sono quelli nuovi").toEqual(daAvvio.cerchi);
  expect(
    await page.evaluate(() => window.__dmNonRicaricata === true),
    "la pagina si e' ricaricata: e' il salto bianco del filmato",
  ).toBe(true);
});

test("la stessa configurazione che c'e' gia' non fa muovere niente", async ({ page }, testInfo) => {
  /* Il timbro dell'ora si muove ogni volta che QUALSIASI dispositivo salva. Se
   * il carico e' identico a quello che c'e' gia' qui, non c'e' niente da
   * applicare e non si deve ridisegnare niente. */
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, DOPO);
  await seminaStati(page);
  const suo = await page.evaluate(() => window.cdSyncCollect());
  const applicati = await page.evaluate((payload) => window.cdSyncApply(payload), suo);
  expect(applicati, "riapplica una configurazione identica a quella che ha gia'").toBe(0);
});
