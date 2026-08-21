/* Una sola larghezza per tutte le sezioni.
 *
 * Ogni sezione si era scelta la sua: Energia, Elettrodomestici e Temperature
 * prendevano tutto lo schermo, Clima e Sicurezza si fermavano a 1250, Solare a
 * 1120, Tapparelle a 1100, Piscina a 1040, e Auto, Irrigazione e MiniPC a 1000.
 * Sette misure diverse, alcune scritte a mano dentro alla plancia, altre nei
 * moduli, una perfino nel foglio di stile del runtime. Passando da una sezione
 * all'altra il contenuto si stringeva e si allargava, e con lui l'intestazione,
 * che e' larga quanto quello che annuncia.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const seed = {
  schema_version: 4,
  sections: {
    rooms: [
      { id: "r1", name: "Salone", icon: "🛋️", temp: "sensor.t", hum: "sensor.h", metadata: {} },
    ],
    cameras: [],
    appliances: [
      {
        id: "a1",
        name: "Forno",
        device_type: "forno",
        power_entity: "sensor.forno",
        entities: ["sensor.forno"],
        show_in_dashboard: true,
      },
    ],
    loads: [],
    lights: [{ id: "l1", name: "Salone", entity: "light.salone" }],
    climate: [{ id: "c1", name: "Salotto", entity: "climate.salotto" }],
    ev: [{ id: "e1", name: "T03", brand: "Leapmotor" }],
    covers: [{ id: "t1", name: "Camera", entity: "cover.camera" }],
    pool: { pump: "switch.pompa" },
    irrigation: { zones: [{ id: "z1", name: "Prato", entity: "switch.prato" }] },
    energy: {},
    entityOverrides: { "dm.server_cpu": "sensor.cpu" },
  },
  visibility: {
    home: true,
    energy: true,
    ev: true,
    tapparelle: true,
    temp: true,
    temperature: true,
    clima: true,
    appliances: true,
    piscina: true,
    irrigazione: true,
    security: true,
    server: true,
    luci: true,
  },
};

test("ogni sezione apre alla stessa larghezza", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);

  const elencoPagine = () =>
    page.evaluate(() =>
      [...document.querySelectorAll(".page")].map((nodo) => nodo.id).filter(Boolean),
    );
  /* Non tutte le pagine ci sono gia'. Alcune sezioni si costruiscono la loro
   * poco dopo l'avvio, e chiedendo l'elenco subito se ne perdeva qualcuna: la
   * prova passava senza averla mai guardata, e una sezione rimasta indietro
   * usciva verde. Si aspetta che il conto smetta di crescere. */
  let pagine = await elencoPagine();
  for (let fermo = 0; fermo < 3;) {
    await page.waitForTimeout(300);
    const adesso = await elencoPagine();
    fermo = adesso.length === pagine.length ? fermo + 1 : 0;
    pagine = adesso;
  }
  const apri = async (id) => {
    await page.evaluate((pid) => {
      document.querySelectorAll(".page").forEach((nodo) => nodo.classList.remove("active"));
      document.getElementById(pid)?.classList.add("active");
      window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
    }, id);
  };
  const larghezzaDi = (id) =>
    page.evaluate((pid) => {
      const testa = document.getElementById(pid)?.querySelector(".dm-page-mast");
      return testa ? Math.round(testa.getBoundingClientRect().width) : -1;
    }, id);

  /* Prima si aprono tutte una volta: cosi' ogni sezione monta la sua
   * intestazione e la pagina finisce di assestarsi. Misurare mentre le cose
   * nascono vuol dire misurare il transitorio, ed e' quello che rendeva questa
   * prova ballerina su Safari. */
  for (const id of pagine) {
    await apri(id);
    await page.waitForTimeout(120);
  }

  const misure = [];
  for (const id of pagine) {
    await apri(id);
    let larghezza = await larghezzaDi(id);
    for (let attesa = 0; attesa < 60 && larghezza < 0; attesa += 1) {
      await page.waitForTimeout(150);
      larghezza = await larghezzaDi(id);
    }
    /* La misura buona e' quella che si ripete. Tre letture di fila a 150ms
     * coprivano meno di mezzo secondo, e su Safari una sezione lenta ad
     * assestarsi riusciva a starci dentro tutta: la misura era stabile e
     * sbagliata. Quattro letture a 200ms sono ottocento millisecondi di
     * immobilita', che nessun assestamento attraversa. */
    let uguali = 1;
    for (let attesa = 0; attesa < 40 && uguali < 4; attesa += 1) {
      await page.waitForTimeout(200);
      const adesso = await larghezzaDi(id);
      uguali = adesso === larghezza ? uguali + 1 : 1;
      larghezza = adesso;
    }
    if (larghezza > 0) misure.push({ id, larghezza });
  }

  /* Le sezioni con un'intestazione sono parecchie: se ne restassero due, questa
   * prova non direbbe niente. Il conto e' anche la spia di un'attesa troppo
   * corta, quindi dice quali sezioni ha visto. */
  expect(
    misure.length,
    `sezioni misurate: ${misure.map((m) => m.id).join(", ")}`,
  ).toBeGreaterThanOrEqual(8);
  const larghezze = misure.map((m) => m.larghezza);
  const scarto = Math.max(...larghezze) - Math.min(...larghezze);
  /* Il difetto erano sette misure diverse, dalla sezione ferma a mille pixel a
   * quella che ne prendeva millequattrocento: uno scarto di quattrocento. Qui
   * si tollera la ventina di pixel che separa un bordo di card da una barra di
   * scorrimento su un browser diverso, e non un dito in piu': una sezione
   * rimasta indietro si vede eccome. */
  expect(
    scarto,
    `larghezze diverse fra le sezioni: ${misure.map((m) => `${m.id}=${m.larghezza}`).join(", ")}`,
  ).toBeLessThanOrEqual(24);
});
