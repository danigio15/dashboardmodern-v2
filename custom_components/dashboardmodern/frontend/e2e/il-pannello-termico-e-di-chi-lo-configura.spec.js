/* Il pannello termico del popup Caldo, sul documento vero.
 *
 * Le tre righe cablate del guscio — Caldaia, Pompa termocamino, Aspiratore
 * canna fumaria — per chiunque non avesse QUELLE entita' dicevano «N/D» per
 * sempre. Ora le voci vivono in `cd_termico_caldo`: senza voci il pannello
 * sparisce, con una voce compare quella e solo quella.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const seme = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [{ id: "c1", name: "Bagno", entity: "input_boolean.termo_bagno", type: "termo" }],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true },
};

test("senza voci il pannello sparisce, con una voce compare quella sola", async ({
  page,
}, testInfo) => {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);

  await page.evaluate(() => {
    window.apriQuickClima?.();
    window.setQuickClimaMode?.("caldo");
  });

  /* Questa casa non ha ne' switch.caldaia ne' i vecchi slot: il pannello
   * non ha niente da dire, e non dice niente. */
  const pannello = page.locator("#ns-thermal-panel");
  await expect(pannello).toBeHidden({ timeout: 20000 });
  await expect(page.locator("#quick-clima-modal")).not.toContainText("Pompa termocamino");

  /* Una voce configurata: compare lei, e solo lei. */
  await page.evaluate(() => {
    window.localStorage.setItem(
      "cd_termico_caldo",
      JSON.stringify([{ name: "Pompa pellet", entity: "switch.pellet", icon: "♨️" }]),
    );
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed"));
  });
  await expect(pannello).toBeVisible({ timeout: 10000 });
  await expect(pannello.locator(".ns-thermal-row")).toHaveCount(1);
  await expect(pannello).toContainText("Pompa pellet");
  await expect(pannello).not.toContainText("Caldaia");

  /* E la scheda Clima della configurazione porta il campo libero. */
  await page.evaluate(() => window.apriConfigEntita());
  await page.evaluate(() => {
    const clima = [...document.querySelectorAll(".ed-tab")].find((tab) =>
      /clima/i.test(tab.textContent || ""),
    );
    clima?.click();
  });
  const carta = page.locator("#editor-modal [data-dm-termico-caldo]");
  await expect(carta).toBeVisible({ timeout: 20000 });
  await expect(carta.locator(".dm-termico-riga")).toHaveCount(1);
});

/* ── la caldaia a pellet, sulla pagina vera (#346) ───────────────────────
 *
 * «Nella sezione caldaia vorrei inserire: temperatura caldaia, temperatura
 * alta e bassa del boiler, temperatura fumi, comando ventilatore fumi,
 * ossigeno residuo, livello riempimento pellet, temperatura mandata
 * calcolata, ecc.»
 *
 * Qui si prova quello che le prove unitarie non possono vedere: che le
 * letture arrivino davvero sulla scena quando sono mappate, che spariscano
 * quando non lo sono — senza lasciare targhette vuote al loro posto — e che
 * le caselle per mapparle siano nella scheda, sotto il loro titolo.
 */

const SEME_CALDAIA = {
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

/* Una PE15 come la racconta l'integrazione: la fase in inglese, il
 * ventilatore in percentuale, il pellet in percentuale. */
const STATI_PELLET = {
  "sensor.caldaia_stato": { entity_id: "sensor.caldaia_stato", state: "Heating" },
  "sensor.caldaia_mandata": {
    entity_id: "sensor.caldaia_mandata",
    state: "64",
    attributes: { unit_of_measurement: "°C" },
  },
  "sensor.caldaia_temperatura": {
    entity_id: "sensor.caldaia_temperatura",
    state: "78",
    attributes: { unit_of_measurement: "°C" },
  },
  "sensor.caldaia_fumi": {
    entity_id: "sensor.caldaia_fumi",
    state: "148",
    attributes: { unit_of_measurement: "°C" },
  },
  "sensor.caldaia_ossigeno": {
    entity_id: "sensor.caldaia_ossigeno",
    state: "8.4",
    attributes: { unit_of_measurement: "%" },
  },
  "fan.caldaia_ventilatore_fumi": {
    entity_id: "fan.caldaia_ventilatore_fumi",
    state: "on",
    attributes: { percentage: 58 },
  },
  "sensor.caldaia_pellet": {
    entity_id: "sensor.caldaia_pellet",
    state: "62",
    attributes: { unit_of_measurement: "%" },
  },
  "sensor.caldaia_boiler_alto": {
    entity_id: "sensor.caldaia_boiler_alto",
    state: "56",
    attributes: { unit_of_measurement: "°C" },
  },
  "sensor.caldaia_boiler_basso": {
    entity_id: "sensor.caldaia_boiler_basso",
    state: "41",
    attributes: { unit_of_measurement: "°C" },
  },
  "sensor.caldaia_mandata_calcolata": {
    entity_id: "sensor.caldaia_mandata_calcolata",
    state: "68",
    attributes: { unit_of_measurement: "°C" },
  },
};

const CALDAIA_PELLET = [
  {
    id: "pe15",
    name: "Fröling PE15",
    stato: "sensor.caldaia_stato",
    mandata: "sensor.caldaia_mandata",
    uscita: "boiler",
    temperaturaCaldaia: "sensor.caldaia_temperatura",
    boilerAlto: "sensor.caldaia_boiler_alto",
    boilerBasso: "sensor.caldaia_boiler_basso",
    fumi: "sensor.caldaia_fumi",
    ventilatoreFumi: "fan.caldaia_ventilatore_fumi",
    ossigeno: "sensor.caldaia_ossigeno",
    pellet: "sensor.caldaia_pellet",
    mandataCalcolata: "sensor.caldaia_mandata_calcolata",
  },
];

/* La caldaia a gas di sempre: le stesse due caselle di prima e nient'altro. */
const CALDAIA_GAS = [
  {
    id: "pe15",
    name: "Fröling PE15",
    stato: "sensor.caldaia_stato",
    mandata: "sensor.caldaia_mandata",
    uscita: "boiler",
  },
];

async function apriGestioneTermica(page, testInfo, caldaie) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME_CALDAIA);
  await page.evaluate(
    ({ stati, righe }) => {
      const raw = eval("_RAW_STATES");
      Object.assign(raw, stati);
      window.localStorage.setItem(
        "cd_impianti_termici",
        JSON.stringify({ solare: false, scaldabagno: false, caldaia: true }),
      );
      window.localStorage.setItem("cd_caldaia", JSON.stringify(righe));
      document.querySelectorAll(".page").forEach((nodo) => nodo.classList.remove("active"));
      document.getElementById("page-boiler")?.classList.add("active");
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    },
    { stati: STATI_PELLET, righe: caldaie },
  );
}

test("le letture del pellet ci sono quando sono mappate, e se ne vanno quando non lo sono", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await apriGestioneTermica(page, testInfo, CALDAIA_PELLET);

  const scena = page.locator('#page-boiler .dm-it-scena[data-dm-it-scena="caldaia"]');
  await expect(scena).toBeVisible({ timeout: 30000 });

  /* La fase «Heating» della centralina è una caldaia che lavora: l'obló è
   * acceso e la pastiglia lo dice. */
  await expect(scena).toHaveAttribute("data-fiamma", "true");
  await expect(scena.locator(".dm-it-stato-caldaia")).toContainText("In funzione");

  /* La combustione, accanto alla fiamma: fumi, ossigeno e ventilatore. */
  const fuoco = scena.locator(".dm-it-fuoco");
  await expect(fuoco).toBeVisible();
  await expect(fuoco).toContainText("148");
  await expect(fuoco).toContainText(/8[.,]4/);
  await expect(fuoco).toContainText("58%");

  /* Il serbatoio del pellet: un riempimento, non una targhetta. */
  const pellet = scena.locator(".dm-it-pellet");
  await expect(pellet).toBeVisible();
  await expect(pellet).toHaveAttribute("data-scarso", "false");
  await expect(scena.locator(".dm-it-pellet-liv")).toHaveAttribute("style", /height:62%/);

  /* Le due sonde del sanitario, addosso al disegno del boiler. */
  await expect(scena.locator(".dm-it-sonde .dm-it-sonda")).toHaveCount(2);
  await expect(scena.locator(".dm-it-sonde")).toContainText("56");
  await expect(scena.locator(".dm-it-sonde")).toContainText("41");

  /* La mandata calcolata, sotto la mandata vera. */
  await expect(scena.locator(".dm-it-obiettivo")).toContainText("68");
  /* E il corpo della caldaia, che è una targhetta come le altre. */
  await expect(scena).toContainText("78");

  /* Adesso la stessa caldaia senza nessuna di quelle caselle — che è la
   * caldaia a gas di sempre: la scena resta, i pezzi del pellet no. Non
   * restano targhette con un trattino: proprio non nascono. */
  await page.evaluate((righe) => {
    window.localStorage.setItem("cd_caldaia", JSON.stringify(righe));
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  }, CALDAIA_GAS);

  await expect(scena.locator(".dm-it-fuoco")).toHaveCount(0, { timeout: 20000 });
  await expect(scena.locator(".dm-it-pellet")).toHaveCount(0);
  await expect(scena.locator(".dm-it-sonde")).toHaveCount(0);
  await expect(scena.locator(".dm-it-obiettivo")).toHaveCount(0);
  /* La caldaia di prima è ancora tutta lì. */
  await expect(scena.locator(".dm-it-caldaia")).toBeVisible();
  await expect(scena).toContainText("Mandata");
});

test("le caselle del pellet stanno nella scheda, sotto il loro titolo", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await apriGestioneTermica(page, testInfo, CALDAIA_PELLET);

  await page.evaluate(() => window.apriConfigEntita());
  await page.locator('.ed-tab[data-tab="sez3"]').click();
  const riga = page.locator("#ed-body .dm-caldaia-row").first();
  await expect(riga).toBeVisible({ timeout: 30000 });
  await riga.locator("[data-caldaia-edit]").click();

  /* Il titolo del gruppo, una volta sola: chi ha una caldaia a gas capisce a
   * colpo d'occhio che da lì in giù non c'è niente di suo. */
  const titolo = riga.locator(".dm-it-ed-pellet");
  await expect(titolo).toHaveCount(1);
  await expect(titolo).toContainText("Combustibile solido");

  /* E le otto caselle, con dentro quello che è già mappato. */
  for (const [campo, valore] of [
    ["temperaturaCaldaia", "sensor.caldaia_temperatura"],
    ["boilerAlto", "sensor.caldaia_boiler_alto"],
    ["boilerBasso", "sensor.caldaia_boiler_basso"],
    ["fumi", "sensor.caldaia_fumi"],
    ["ventilatoreFumi", "fan.caldaia_ventilatore_fumi"],
    ["ossigeno", "sensor.caldaia_ossigeno"],
    ["pellet", "sensor.caldaia_pellet"],
    ["mandataCalcolata", "sensor.caldaia_mandata_calcolata"],
  ]) {
    const casella = riga.locator(`[data-caldaia-field="${campo}"]`);
    await expect(casella).toHaveCount(1);
    await expect(casella).toHaveValue(valore);
  }

  /* Le caselle di sempre sono ancora prima, e nessuna si è persa per strada. */
  await expect(riga.locator("[data-caldaia-field]")).toHaveCount(20);
});
