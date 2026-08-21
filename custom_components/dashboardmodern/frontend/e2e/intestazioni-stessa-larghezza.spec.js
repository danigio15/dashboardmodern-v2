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

  const pagine = await page.evaluate(() =>
    [...document.querySelectorAll(".page")].map((nodo) => nodo.id).filter(Boolean),
  );
  const misure = [];
  for (const id of pagine) {
    await page.evaluate((pid) => {
      document.querySelectorAll(".page").forEach((nodo) => nodo.classList.remove("active"));
      document.getElementById(pid)?.classList.add("active");
      window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
    }, id);
    /* L'intestazione la monta il modulo un fotogramma dopo che la sezione si
     * apre, e la sua larghezza si assesta quando il contenuto ha finito di
     * disegnarsi: si aspetta che il numero smetta di cambiare, invece di
     * sperare che un'attesa a caso sia lunga abbastanza. */
    const larghezzaDi = () =>
      page.evaluate((pid) => {
        const testa = document.getElementById(pid)?.querySelector(".dm-page-mast");
        return testa ? Math.round(testa.getBoundingClientRect().width) : -1;
      }, id);
    // Prima che compaia: su un browser lento l'intestazione puo' farsi
    // attendere, e una sezione saltata falserebbe il conto.
    let larghezza = await larghezzaDi();
    for (let attesa = 0; attesa < 80 && larghezza < 0; attesa += 1) {
      await page.waitForTimeout(150);
      larghezza = await larghezzaDi();
    }
    // Poi che si assesti: la misura buona e' quella che smette di cambiare.
    let precedente = -2;
    for (let attesa = 0; attesa < 40 && larghezza !== precedente; attesa += 1) {
      precedente = larghezza;
      await page.waitForTimeout(150);
      larghezza = await larghezzaDi();
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
  expect(
    scarto,
    `larghezze diverse fra le sezioni: ${misure.map((m) => `${m.id}=${m.larghezza}`).join(", ")}`,
  ).toBeLessThanOrEqual(8);
});
