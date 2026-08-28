/* I flussi seguono la casa appena la casa cambia.
 *
 * La scena si ridisegnava solo agli eventi grossi: l'avvio, i pacchetti dello
 * storico, il tocco su una linguetta, un salvataggio. Le potenze istantanee
 * pero' le legge dagli stati vivi, che cambiano di continuo, e questa pagina
 * esiste per mostrarli.
 *
 * Misurato prima e dopo, sullo stesso cambio: la bolla della batteria ci
 * metteva 3127 millesimi ad accorgersene, adesso 308. Non era ferma per
 * sempre — un altro giro la raggiungeva — ma tre secondi su una lettura
 * istantanea sono un'eternita', e chi guarda vede un numero che non e' piu'
 * vero. Qui si fissa che il ridisegno sia PRONTO, non soltanto che prima o
 * poi arrivi: con la soglia a un secondo e mezzo questa prova cade sul
 * comportamento di prima.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { clickBottomTab } from "./helpers/navigation.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    lights: [],
    appliances: [],
    climate: [],
    ev: [],
    loads: [],
    energy: {
      house: { power: "sensor.casa_power" },
      battery: { power: "sensor.batteria_power" },
      solar: { power: "sensor.solare_power" },
    },
  },
  visibility: { home: true, energy: true },
};

const potenza = (entity, state) => ({
  entity_id: entity,
  state,
  attributes: { unit_of_measurement: "W", device_class: "power" },
});

async function avvia(page, testInfo, iniziali) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate((letture) => {
    const raw = eval("_RAW_STATES");
    for (const s of letture) raw[s.entity_id] = s;
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, iniziali);
  await clickBottomTab(page, "energy", testInfo);
  await page.waitForTimeout(1200);
}

/* Un cambio come lo annuncia Home Assistant: gli stati cambiano e parte il
 * solo evento che il filtro degli stati produce. Nessun ricaricamento. */
async function cambia(page, letture) {
  await page.evaluate((nuove) => {
    const raw = eval("_RAW_STATES");
    for (const s of nuove) raw[s.entity_id] = s;
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  }, letture);
}

const bolla = (page) => page.evaluate(() => document.getElementById("v-battery")?.textContent);

/* Quanti millesimi passano prima che la bolla dica la cosa nuova. */
async function quantoCiMette(page, atteso) {
  const inizio = Date.now();
  for (let giro = 0; giro < 60; giro += 1) {
    if (String(await bolla(page)).includes(atteso)) return Date.now() - inizio;
    await page.waitForTimeout(100);
  }
  return Number.POSITIVE_INFINITY;
}

/* Tre secondi era il tempo di prima. Un secondo e mezzo lascia aria a una
 * macchina carica e resta ben sotto quella soglia. */
const PRONTO = 1500;

test("la batteria segue la casa senza ricaricare", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo, [
    potenza("sensor.casa_power", "1380"),
    potenza("sensor.batteria_power", "-201"),
  ]);
  await expect.poll(() => bolla(page)).toContain("201");
  await cambia(page, [potenza("sensor.batteria_power", "-1500")]);
  const attesa = await quantoCiMette(page, "1500");
  expect(attesa, `la bolla ci ha messo ${attesa} millesimi a dire la cosa nuova`).toBeLessThan(
    PRONTO,
  );
});

test("quello che nasce spento compare quando arriva, senza ricaricare", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  /* La prima passata capita mentre le entita' non sanno ancora dire niente:
   * e' quello che succede a ogni riavvio di Home Assistant. */
  await avvia(page, testInfo, [
    potenza("sensor.casa_power", "unavailable"),
    potenza("sensor.batteria_power", "unavailable"),
    potenza("sensor.solare_power", "unavailable"),
  ]);
  const spenta = await bolla(page);

  // Poi la casa torna a parlare, e la scena deve accorgersene da sola.
  await cambia(page, [
    potenza("sensor.casa_power", "1380"),
    potenza("sensor.batteria_power", "-201"),
    potenza("sensor.solare_power", "4220"),
  ]);
  const attesa = await quantoCiMette(page, "201");
  expect(attesa, `la scena ci ha messo ${attesa} millesimi a risvegliarsi`).toBeLessThan(PRONTO);
  expect(await bolla(page), `la bolla e' rimasta com'era: «${spenta}»`).not.toBe(spenta);
});
