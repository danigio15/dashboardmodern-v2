/* Il radar che «continua a non uscire», e adesso dice perche'.
 *
 * «Ho inserito il link con indirizzo e non lo legge nemmeno.» Era l'indirizzo
 * di una pagina di windy.com, non quello delle tessere: il radar non nasceva,
 * la tendina della scheda tornava su «Nessuno», e non c'era una riga che
 * spiegasse. Qui: la finestra delle previsioni mostra il blocco con la
 * spiegazione, e la scheda tiene la scelta e dice cosa non va.
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

const SITO = "https://www.windy.com/it/-Pioggia-neve-rain?rain,41.902,12.496,8";

async function boot(page, testInfo, radar) {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript((configurazione) => {
    /* La configurazione del radar sta in una chiave sua: si semina prima che
     * la plancia parta, com'e' quando si riapre la pagina. */
    const originale = Storage.prototype.getItem;
    Storage.prototype.getItem = function (chiave) {
      if (String(chiave).endsWith("cd_radar_meteo")) return JSON.stringify(configurazione);
      return originale.call(this, chiave);
    };
  }, radar);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
}

async function apriLePrevisioni(page) {
  await page.evaluate(() => {
    const modale = document.getElementById("weather-modal");
    modale?.classList.add("show");
    if (modale && !modale.querySelector("#weather-forecast-list")) {
      const elenco = document.createElement("div");
      elenco.id = "weather-forecast-list";
      modale.append(elenco);
    }
  });
  /* Il modulo riguarda la finestra quando la plancia si ridisegna: un tocco
   * sullo sfondo, invece, la chiuderebbe. */
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("dashboardmodern:editor-rendered", { detail: {} }));
  });
}

test("con l'indirizzo di un sito il blocco dice cosa correggere, invece di sparire", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo, { servizio: "modello", modello: SITO, lat: "41.9", lon: "12.5" });
  await apriLePrevisioni(page);
  const blocco = page.locator("#weather-modal .dm-radar-blocco");
  await expect(blocco).toHaveAttribute("data-dm-modo", "guasto", { timeout: 15_000 });
  await expect(blocco.locator(".dm-radar-nota")).toContainText(/\{z\}\/\{x\}\/\{y\}/);
  /* Niente quadro, niente «il radar non sta rispondendo»: non e' un radar che
   * tace, e' un indirizzo sbagliato. */
  await expect(blocco.locator(".dm-radar-quadro")).toBeHidden();
});

test("con «Nessuno» scelto apposta non c'e' niente da dire", async ({ page }, testInfo) => {
  await boot(page, testInfo, { servizio: "nessuno", lat: "41.9", lon: "12.5" });
  await apriLePrevisioni(page);
  await page.waitForTimeout(600);
  await expect(page.locator("#weather-modal .dm-radar-blocco")).toHaveCount(0);
});

test("la scheda tiene la scelta «Un indirizzo mio» e dice subito che e' una pagina", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo, { servizio: "modello", modello: SITO, lat: "41.9", lon: "12.5" });
  await page.evaluate(() => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
  });
  await page.locator('.ed-tab[data-tab="sez0"]').first().click();
  const tendina = page.locator('#ed-body [data-dm-radar-campo="servizio"]');
  await expect(tendina).toHaveCount(1, { timeout: 15_000 });
  /* Prima tornava su «Nessuno», e la scelta sembrava sparita. */
  await expect(tendina).toHaveValue("modello");
  await expect(page.locator("#ed-body #dm-radar-modello")).toBeVisible();
  const esito = page.locator("#ed-body [data-dm-radar-esito]");
  await expect(esito).toHaveAttribute("data-dm-esito", "male");
  await expect(esito).toContainText(/PAGINA|PAGE/);
  /* E il tetto dello zoom non dice «null». */
  const zoom = page.locator('#ed-body [data-dm-radar-campo="zoomPioggia"]');
  await expect(zoom).toHaveValue("");
  expect(await zoom.getAttribute("placeholder")).not.toMatch(/null|undefined|NaN/);

  /* Scelto un servizio, la riga torna quella di serie. */
  await tendina.selectOption("rainviewer");
  await expect(esito).not.toHaveAttribute("data-dm-esito", "male");
});
