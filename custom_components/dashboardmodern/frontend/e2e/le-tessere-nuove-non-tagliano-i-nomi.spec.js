/* Le tessere rifatte: tre righe, l'oggetto disegnato, e i nomi che entrano.
 *
 * Il nome divideva la riga con la misura, e la misura vinceva sempre: con
 * «Temperatura» al nome restavano zero pixel, e finiva coi puntini — si vedeva
 * a occhio nudo sulla Home. Adesso la tessera e' in tre righe (pastiglia e
 * nome, il numero, dettaglio e misura) e chi non entra si stringe invece di
 * farsi tagliare.
 *
 * La prova gira su tutti i formati che la configurazione elenca: quello che
 * conta e' che a nessuna larghezza resti una scritta troncata.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

/* Una casa con abbastanza roba da riempire la griglia di tessere, e con i nomi
 * lunghi veri del prodotto: «Solare termico», «Elettrodomestici». */
const SEME = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "r1", name: "Salone", icon: "mdi:sofa" }],
    cameras: [],
    appliances: [
      { id: "a1", name: "Lavatrice", entity: "sensor.lavatrice_w", device_type: "washer" },
      {
        id: "a2",
        name: "Lavastoviglie",
        entity: "sensor.lavastoviglie_w",
        device_type: "dishwasher",
      },
    ],
    loads: [],
    lights: [
      { id: "l1", name: "Lampadario Salone", entity: "light.salone" },
      { id: "l2", name: "Faretti Cucina", entity: "light.cucina" },
      { id: "l3", name: "Piantana", entity: "light.piantana" },
      { id: "l4", name: "Bagno", entity: "light.bagno" },
    ],
    climate: [
      { id: "cl1", name: "Termosifone Salone", entity: "climate.salone" },
      { id: "cl2", name: "Cameretta", entity: "climate.cameretta" },
    ],
    ev: [],
    covers: [
      { id: "c1", name: "Tapparella Salone", entity: "cover.salone" },
      { id: "c2", name: "Tapparella Cucina", entity: "cover.cucina" },
    ],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    solar_thermal: { probes: [{ id: "s1", name: "Mandata", entity: "sensor.solare_mandata" }] },
    entityOverrides: {
      "dm.solar_thermal_collector": "sensor.solare_mandata",
      "dm.home_temp": "sensor.temperatura_casa",
      "dm.home_humidity": "sensor.umidita_casa",
    },
  },
  visibility: { home: true, climate: true, lights: true, covers: true, appliances: true },
};

const VALORI = {
  "light.salone": "on",
  "light.cucina": "on",
  "light.piantana": "off",
  "light.bagno": "off",
  "cover.salone": "open",
  "cover.cucina": "closed",
  "sensor.lavatrice_w": "1200",
  "sensor.lavastoviglie_w": "0",
  "sensor.solare_mandata": "29.8",
  "sensor.temperatura_casa": "27.6",
  "sensor.umidita_casa": "58",
};

async function avvia(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate((valori) => {
    const grezzi = eval("_RAW_STATES");
    for (const [entity, state] of Object.entries(valori))
      grezzi[entity] = {
        entity_id: entity,
        state,
        attributes: {
          friendly_name: entity.split(".")[1].replaceAll("_", " "),
          ...(entity.startsWith("climate.")
            ? { current_temperature: 20.5, temperature: 21.5 }
            : {}),
          ...(entity.endsWith("_w") ? { unit_of_measurement: "W" } : {}),
        },
      };
    grezzi["climate.salone"] = {
      entity_id: "climate.salone",
      state: "heat",
      attributes: {
        friendly_name: "Termosifone Salone",
        current_temperature: 20.5,
        temperature: 21.5,
      },
    };
    grezzi["climate.cameretta"] = {
      entity_id: "climate.cameretta",
      state: "off",
      attributes: { friendly_name: "Cameretta", current_temperature: 19.4, temperature: 20 },
    };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, VALORI);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await expect(page.locator("#dm-widgets .dm-tile").first()).toBeVisible();
  // Il giro che stringe i nomi gira dopo il disegno: gli si lascia il tempo.
  await page.waitForTimeout(600);
}

test("nessun nome e nessuna scritta della tessera esce tagliata", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  const tagliate = await page.evaluate(() => {
    const fuori = [];
    for (const nodo of document.querySelectorAll(
      "#dm-widgets .dm-tile-label, #dm-widgets .dm-tile-value, #dm-widgets .dm-tile-unit",
    )) {
      if (nodo.scrollWidth > nodo.clientWidth + 1 || nodo.scrollHeight > nodo.clientHeight + 1)
        fuori.push(`${nodo.className}: ${nodo.textContent.trim()}`);
    }
    return fuori;
  });
  expect(tagliate, `scritte tagliate: ${tagliate.join(" | ")}`).toEqual([]);
});

test("niente esce dai bordi della propria tessera", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  const sbordi = await page.evaluate(() => {
    const fuori = [];
    for (const tessera of document.querySelectorAll("#dm-widgets .dm-tile")) {
      const bordo = tessera.getBoundingClientRect();
      for (const nodo of tessera.querySelectorAll(
        ".dm-tile-cima, .dm-tile-val, .dm-tile-fondo, .dm-tile-misura",
      )) {
        const suo = nodo.getBoundingClientRect();
        if (!suo.width) continue;
        if (suo.right > bordo.right + 1 || suo.left < bordo.left - 1)
          fuori.push(`${tessera.dataset.dmWidget}/${nodo.className}`);
      }
    }
    return fuori;
  });
  expect(sbordi, `pezzi fuori dalla tessera: ${sbordi.join(" | ")}`).toEqual([]);
});

test("ogni tessera porta il suo oggetto disegnato, e le tre righe", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  const conti = await page.evaluate(() => {
    const tessere = [...document.querySelectorAll("#dm-widgets .dm-tile")];
    return {
      quante: tessere.length,
      senzaOggetto: tessere
        .filter((n) => !n.querySelector(".dm-tile-chip .dm-oggetto"))
        .map((n) => n.dataset.dmWidget),
      senzaRighe: tessere
        .filter(
          (n) =>
            !n.querySelector(".dm-tile-cima") ||
            !n.querySelector(".dm-tile-val") ||
            !n.querySelector(".dm-tile-fondo"),
        )
        .map((n) => n.dataset.dmWidget),
    };
  });
  expect(conti.quante).toBeGreaterThan(2);
  // Le tessere che uno si costruisce da se' tengono il simbolo scelto in
  // configurazione: qui non ce ne sono, quindi devono avere tutte il disegno.
  expect(conti.senzaOggetto, "tessere rimaste senza disegno").toEqual([]);
  expect(conti.senzaRighe, "tessere senza le tre righe").toEqual([]);
});

test("il numero e la sua unita' stanno in due pezzi", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  const clima = page.locator('#dm-widgets .dm-tile[data-dm-widget="clima"]');
  await expect(clima).toBeVisible();
  // Il numero puo' essere spezzato in cifre dal contatore: si legge il testo
  // vero, non quello che il browser impagina.
  const numero = await clima.locator(".dm-tile-value").evaluate((n) => n.textContent);
  const unita = await clima.locator(".dm-tile-unit").evaluate((n) => n.textContent);
  expect(numero.trim()).toMatch(/^[\d.,]+$/);
  expect(unita.trim()).not.toBe("");
});
