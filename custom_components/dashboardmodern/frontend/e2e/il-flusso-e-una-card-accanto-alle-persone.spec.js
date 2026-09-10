/* «Deve essere una card più piccola e falla più bella. Inoltre deve uscire una
 *  sezione affianco a persone, non sotto.»
 *
 * La segnalazione #415 lo diceva già — «sulla home, accanto magari alle card
 * delle persone» — e la prima stesura ne aveva fatto un blocco intero, largo
 * quanto la pagina e sotto di loro: una cornice quasi vuota con dentro cinque
 * targhette piccole.
 *
 * Qui si guarda dove finisce davvero, e non lo si chiede alle classi ma ai
 * rettangoli, che sono quello che si vede: la card sta accanto alla griglia
 * delle persone, alla stessa altezza della prima — cioè accanto, non sotto — e
 * occupa una corsia stretta, non la pagina — una corsia di quella griglia, la
 * stessa dei widget, perché una card larga a caso stringe le persone e le
 * disallinea dalle tessere sotto. Su un telefono «accanto» non esiste e la
 * fila va in colonna: lì si pretende l'altro layout, non questo.
 *
 * Accanto alla griglia e non DENTRO, e la differenza si misura: dentro, una
 * card più alta di una persona alzava tutta la riga della griglia, e le
 * persone accanto si stiravano vuote per starle dietro. Fuori, ognuno tiene la
 * sua altezza — ed è quello che qui si tiene fermo.
 *
 * E si guarda che ci resti: chi disegna le persone rifà la sua griglia da capo
 * a ogni giro.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SOLARE = "sensor.fv_potenza";
const RETE = "sensor.rete_potenza";
const BATTERIA = "sensor.batteria_potenza";
const CARICA = "sensor.batteria_carica";
const CASA = "sensor.casa_potenza";

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
    /* In schema 4 le entità dell'impianto stanno dentro `energy`, non fra le
     * caselle sciolte. */
    energy: {
      solar: { power: SOLARE },
      grid: { power: RETE },
      battery: { power: BATTERIA, soc: CARICA },
      house: { power: CASA },
    },
    entityOverrides: {},
  },
  visibility: { home: true, energy: true },
};

const PERSONE = [
  { id: "person-giovanni", name: "Giovanni", entity: "person.giovanni" },
  { id: "person-anna", name: "Anna", entity: "person.anna", avatar: { emoji: "👩" } },
];

const misura = (id, valore, unita, classe) => ({
  entity_id: id,
  state: String(valore),
  attributes: { unit_of_measurement: unita, device_class: classe, friendly_name: id },
});

/* Una giornata di sole: il fotovoltaico alimenta la casa, carica la batteria e
 * il resto lo vende. È il caso in cui la mappa ha più archi da mostrare. */
const STATI = {
  [SOLARE]: misura(SOLARE, 4200, "W", "power"),
  [RETE]: misura(RETE, -900, "W", "power"),
  [BATTERIA]: misura(BATTERIA, -1500, "W", "power"),
  [CARICA]: misura(CARICA, 64, "%", "battery"),
  [CASA]: misura(CASA, 1800, "W", "power"),
};

async function avvia(page, testInfo) {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 150_000 : 90_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate(
    ({ stati, persone }) => {
      window.localStorage.setItem("cd_people", JSON.stringify(persone));
      window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...stati } };
      const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
      if (raw) Object.assign(raw, stati);
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    },
    { stati: STATI, persone: PERSONE },
  );
}

test("la card del flusso sta accanto alle persone, non sotto e non dentro", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);

  const card = page.locator("#dm-people .dm-people-fila > #dm-flusso-card");
  await expect(card).toBeVisible({ timeout: 20_000 });
  /* Il blocco largo quanto la pagina non c'è più: se ci fosse, la card
   * starebbe in due posti. */
  await expect(page.locator("#dm-flusso")).toHaveCount(0);

  const persone = page.locator("#dm-people .dm-person-card");
  const suo = await card.boundingBox();
  const sua = await persone.first().boundingBox();
  const suaSeconda = await persone.nth(1).boundingBox();

  /* «Accanto» vale anche sul telefono, ed è una correzione di questa prova.
   *
   * Prima diceva: sotto i 760px la card va SOTTO, perché accanto vorrebbe dire
   * schiacciare le persone in una corsia sola. Ed era una scelta mia, non una
   * richiesta: «la card deve uscire affianco a Giovanni», e sul telefono
   * finiva sotto, larga tutta la pagina — cioè esattamente quello che era
   * stato chiesto di non fare. Due corsie a 390px ci stanno: le persone ne
   * prendono una, la card l'altra, e ognuna è larga come una tessera dei
   * widget (quello lo tiene fermo `le-due-griglie-della-home-sono-allineate`).
   *
   * Sotto i 360px si torna in colonna: lì due corsie non tengono più né una
   * persona né un disegno, e quella è l'unica vista che pretende «sotto». */
  const larghezza = page.viewportSize()?.width ?? 0;
  if (larghezza <= 360) {
    /* Sotto la griglia, e tutta la riga: non una colonnina stretta in un
     * angolo, che è il modo in cui una card va a capo per sbaglio. */
    expect(suo.y).toBeGreaterThanOrEqual(sua.y + sua.height - 1);
    expect(suo.width).toBeGreaterThan(sua.width);
  } else {
    /* Le due caselle si sovrappongono in verticale — stessa riga — e la card è
     * a destra dell'ultima persona di quella riga. */
    expect(suo.y).toBeLessThan(sua.y + sua.height);
    expect(suo.y + suo.height).toBeGreaterThan(sua.y);
    const ultima = suo.x > suaSeconda.x ? suaSeconda : sua;
    expect(suo.x).toBeGreaterThan(ultima.x + ultima.width - 1);
    /* E stretta: una corsia sola, non la pagina. */
    expect(suo.width).toBeLessThan(260);
    /* La prova che sta FUORI dalla griglia e non dentro: la card è più alta di
     * una persona, e le persone non l'hanno seguita. Dentro la griglia si
     * sarebbero stirate fino a lei. */
    expect(suo.height).toBeGreaterThan(sua.height + 20);
  }

  /* In ogni caso le persone tengono la loro altezza: è la cosa che si rompeva
   * quando la card stava dentro la griglia. */
  expect(sua.height).toBeCloseTo(suaSeconda.height, 0);

  /* Il disegno c'è tutto: i cinque nodi e gli archi fra loro. La casa in mezzo
   * dice quanto sta usando — e il suo numero sta sotto il cerchio, non dentro:
   * dentro ci stava per un pelo e sopra i dieci kilowatt non ci stava. */
  await expect(card.locator('.dm-flusso-nodo[data-nodo="casa"] .dm-flusso-usa')).toHaveText(
    /1[.,]8 kW/,
  );
  /* E le cinque icone sono le NOSTRE, non le emoji del telefono: il catalogo
   * di casa le disegna, ed è la stessa regola per cui nella tendina del Report
   * l'emoji del guscio si stacca. */
  await expect(card.locator(".dm-flusso-glifo .dm-catalogo-art")).toHaveCount(5);
  await expect(card.locator(".dm-flusso-arco")).not.toHaveCount(0);
  /* Il titolo dice da dove arriva adesso quello che la casa usa. */
  await expect(card.locator(".dm-flusso-fonte")).toContainText(/Fotovoltaico|Solar/);

  await card.screenshot({ path: testInfo.outputPath("flusso-card.png") });
});

test("le persone si ridisegnano e la card resta al suo posto", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  const card = page.locator("#dm-people .dm-people-fila > #dm-flusso-card");
  await expect(card).toBeVisible({ timeout: 20_000 });

  /* Chi disegna le persone riscrive `innerHTML` della griglia: la card se ne
   * va insieme a loro, e deve tornare da sola. Una terza persona è il modo di
   * farlo succedere davvero, invece di chiederlo. */
  await page.evaluate((persone) => {
    window.localStorage.setItem(
      "cd_people",
      JSON.stringify([...persone, { id: "person-terzo", name: "Marco", entity: "person.marco" }]),
    );
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, PERSONE);

  await expect(page.locator("#dm-people .dm-person-card")).toHaveCount(3);
  await expect(card).toBeVisible();
  /* E una sola: rimetterla senza togliere quella di prima le farebbe due. */
  await expect(page.locator("#dm-flusso-card")).toHaveCount(1);
});
