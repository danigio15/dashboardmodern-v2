/* Il popup dell'Auto sul documento vero: quanto manca, l'ora a cui si arriva,
 * e i codici in parole (la frase d'analisi sta nel popup widget, non qui).
 *
 * Il tempo che manca lo conta la sezione: il guscio lo sbagliava — chiedeva la
 * lettera esatta della norma a colonnine che parlano altri dialetti, e leggeva
 * la potenza come numero nudo — e adesso il numero e l'ora li scrive chi sa
 * contarli. Il guscio pero' quel nodo continua a riscriverlo a ogni giro: il
 * modulo deve riprendersi la casella ogni volta. E dove il codice del cavo
 * arriva in un dialetto che il guscio non conosce («c» minuscolo), la casella
 * lo riceve in parole.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

/* Le caselle della casa: con una vettura sola la plancia legge la mappatura
   canonica — e' quella che «Usa» copia dal profilo — quindi la prova la scrive
   come farebbe lui. */
const MAPPA = {
  "dm.ev_batteria_auto": "sensor.leap_soc",
  "dm.ev_stato_ricarica": "sensor.leap_stato",
  "dm.ev_potenza_wallbox": "sensor.leap_w",
  "dm.ev_target_soc": "sensor.leap_target",
};

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
        ov: { ...MAPPA },
      },
    ],
    entityOverrides: { ...MAPPA },
  },
  visibility: { home: true },
};

/* Sessanta per cento, limite a ottanta, sette kilowatt nel cavo: sulla
   batteria di serie — settanta kilowattora, quella che si assume finche' la
   vettura non dichiara la sua — mancano 14 kWh, cioe' due ore tonde. */
const STATI = {
  "sensor.leap_soc": {
    entity_id: "sensor.leap_soc",
    state: "60",
    attributes: { unit_of_measurement: "%" },
  },
  "sensor.leap_stato": { entity_id: "sensor.leap_stato", state: "C", attributes: {} },
  "sensor.leap_w": {
    entity_id: "sensor.leap_w",
    state: "7000",
    attributes: { unit_of_measurement: "W" },
  },
  "sensor.leap_target": {
    entity_id: "sensor.leap_target",
    state: "80",
    attributes: { unit_of_measurement: "%" },
  },
};

test("l'ora accanto al tempo, e torna dopo ogni riscrittura", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate(
    ({ stati, mappa }) => {
      localStorage.setItem("cd_entity_overrides", JSON.stringify(mappa));
      window.cdApplyCanonicalOverrides?.(mappa);
      window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...stati } };
      const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
      if (raw) Object.assign(raw, stati);
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    },
    { stati: STATI, mappa: MAPPA },
  );
  await page.waitForTimeout(1200);

  /* Il tempo lo conta la sezione, e accanto ci mette l'ora dell'orologio. */
  const tempo = page.locator("#v-ev-remain-popup");
  await expect(tempo).toContainText("2H 0M RIM.", { timeout: 10000 });
  await expect(tempo).toContainText("verso le");

  /* La frase d'analisi NON sta qui: «l'analisi non va nel popup auto ma nel
   * popup widget» — la' c'e' gia', e questo popup non ne fa una copia. */
  await expect(page.locator("#ev-popup [data-dm-ev-frase]")).toHaveCount(0);

  /* Il guscio riscrive quel nodo a ogni giro, con le sue parole: al giro dopo
   * la casella torna nostra, numero e ora. */
  await page.evaluate(() => {
    document.getElementById("v-ev-remain-popup").textContent = "IN ATTESA";
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  });
  await expect(tempo).toContainText("2H 0M RIM.", { timeout: 10000 });
  await expect(tempo).toContainText("verso le");
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
