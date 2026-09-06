/* «Da mobile il radar non compare, da desktop sì» (#351).
 *
 * Il blocco nasceva su un TOCCO: qualunque clic sul documento faceva riguardare
 * la finestra un decimo di secondo dopo. Basta che quel tocco si fermi per
 * strada — e sul telefono, fra la testata e i gestori della navigazione, si
 * ferma — perché il radar non nasca mai. Qui la finestra si apre come la apre
 * il guscio, `apriMeteo()`, senza nessun clic: il radar deve esserci lo stesso.
 *
 * E si guardano le misure: sul telefono la mappa veniva disegnata più bassa
 * della scatola che la contiene, scentrata rispetto al mirino.
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

async function boot(page, testInfo, radar) {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  /* Nessuna tessera arriva davvero: qui si guarda che il radar NASCA e con che
   * misure, non che piova. */
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript((configurazione) => {
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

const blocco = (page) => page.locator("#weather-modal .dm-radar-blocco");

test("la finestra del meteo si apre e il radar c'è, senza che nessuno abbia toccato niente", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo, { servizio: "rainviewer", lat: "41.9", lon: "12.5" });
  /* Come la apre il guscio quando si tocca il meteo: nessun clic sul
   * documento, che è esattamente il caso che sul telefono non funzionava. */
  await page.evaluate(() => window.apriMeteo?.());
  await expect(blocco(page)).toHaveAttribute("data-dm-modo", "mappa", { timeout: 15_000 });
  await expect(blocco(page)).toBeVisible();

  /* E la riga sotto dice dove si guarda, quanto largo e a che ingrandimento —
   * anche quando il servizio non risponde, che è il momento in cui è l'unica
   * cosa che spiega (#323). */
  const nota = blocco(page).locator(".dm-radar-nota");
  await expect(nota).toContainText("30 km");
  await expect(nota).toContainText(/z\d+/);
  await expect(nota).toContainText("RainViewer");
});

test("sul telefono la mappa riempie la sua scatola", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "è la misura del telefono");
  await boot(page, testInfo, { servizio: "rainviewer", lat: "41.9", lon: "12.5" });
  await page.evaluate(() => window.apriMeteo?.());
  await expect(blocco(page)).toHaveAttribute("data-dm-modo", "mappa", { timeout: 15_000 });
  /* Il riquadro non scende sotto i 240 px del foglio, e il disegno si fa per
   * quell'altezza: prima si calcolava per 213 e il mirino cadeva fuori dal
   * centro della mappa. */
  const misure = await page.evaluate(() => {
    const quadro = document.querySelector("#weather-modal .dm-radar-quadro");
    return {
      dipinto: quadro.getBoundingClientRect().height,
      calcolato: Number.parseFloat(quadro.style.height) || 0,
    };
  });
  /* Il conto non scende sotto il minimo del foglio… */
  expect(misure.calcolato).toBeGreaterThanOrEqual(240);
  /* …e la scatola è alta quanto il disegno che ci sta dentro: la differenza
   * che resta è il bordo, non una fascia vuota di ventisette pixel. */
  expect(Math.abs(misure.dipinto - misure.calcolato)).toBeLessThanOrEqual(2);
});
