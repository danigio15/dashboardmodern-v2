/* Il popup dell'Auto sul documento vero: l'ora accanto al tempo e i codici
 * in parole (la frase d'analisi sta nel popup widget, non qui).
 *
 * Il guscio scrive «2H 15M RIM.» e riscrive quel nodo a ogni giro: il
 * modulo deve rimettere l'ora ogni volta, leggendola da quel testo — la
 * formula resta una sola. E dove il codice del cavo arriva in un dialetto
 * che il guscio non conosce («c» minuscolo), la casella lo riceve in
 * parole.
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
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    ev: [
      {
        name: "B10",
        ov: {
          "dm.ev_batteria_auto": "sensor.leap_soc",
          "dm.ev_stato_ricarica": "sensor.leap_stato",
          "dm.ev_potenza_wallbox": "sensor.leap_w",
        },
      },
    ],
    entityOverrides: {},
  },
  visibility: { home: true },
};

const STATI = {
  "sensor.leap_soc": {
    entity_id: "sensor.leap_soc",
    state: "53",
    attributes: { unit_of_measurement: "%" },
  },
  "sensor.leap_stato": { entity_id: "sensor.leap_stato", state: "C", attributes: {} },
  "sensor.leap_w": {
    entity_id: "sensor.leap_w",
    state: "1610",
    attributes: { unit_of_measurement: "W" },
  },
};

test("l'ora accanto al tempo, e torna dopo ogni riscrittura", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate((stati) => {
    window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...stati } };
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, stati);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, STATI);
  await page.waitForTimeout(1200);

  /* Il guscio scrive il tempo che manca: il modulo ci mette l'ora. */
  const tempo = page.locator("#v-ev-remain-popup");
  await page.evaluate(() => {
    document.getElementById("v-ev-remain-popup").textContent = "2H 15M RIM.";
  });
  await expect(tempo).toContainText("verso le", { timeout: 10000 });

  /* La frase d'analisi NON sta qui: «l'analisi non va nel popup auto ma nel
   * popup widget» — la' c'e' gia', e questo popup non ne fa una copia. */
  await expect(page.locator("#ev-popup [data-dm-ev-frase]")).toHaveCount(0);

  /* Il guscio riscrive il nodo al giro dopo: l'ora torna da sola. */
  await page.evaluate(() => {
    document.getElementById("v-ev-remain-popup").textContent = "1H 05M RIM.";
  });
  await expect(tempo).toContainText("verso le", { timeout: 10000 });
  await expect(tempo).toContainText("1H 05M");
});

test("il codice del cavo che il guscio non conosce esce in parole", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate((stati) => {
    stati["sensor.leap_stato"].state = "c";
    window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...stati } };
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, stati);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, STATI);
  await page.waitForTimeout(800);

  /* Il guscio, con un codice fuori mappa, stampa la lettera nuda nella sua
   * casella (che nasce col disegno della pagina Auto: qui la si mette come
   * la metterebbe lui). */
  await page.evaluate(() => {
    const nodo = document.createElement("span");
    nodo.className = "v-ev-stato-all";
    nodo.textContent = "c";
    document.body.append(nodo);
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed"));
  });
  await expect(page.locator(".v-ev-stato-all").first()).toHaveText("In carica", {
    timeout: 10000,
  });
});
