/* Il popup non riscrive quello che non e' cambiato.
 *
 * Secondo filmato, beta.4 installata: le carte restano al loro posto e gli
 * stati sono quelli giusti — «1/8 IN FUNZIONE», STANDBY su chi ha solo la presa
 * accesa — e il lampo bianco c'e' ancora. Sei volte in nove secondi, sempre di
 * un fotogramma solo.
 *
 * Ma stavolta i due fotogrammi ai lati del lampo sono IDENTICI: fra prima e
 * dopo non cambia un pixel. Non stava cambiando niente, e il livello si
 * ridipingeva lo stesso — perche' il popup RISCRIVEVA lo stesso. Al banco,
 * dieci giri di stati identici facevano cento scritture sul DOM: sessanta
 * spostamenti di nodi (la classifica veniva «rimessa in fila» spostando tutte
 * le carte a ogni giro, anche quando l'ordine era gia' quello) e quaranta
 * attributi riscritti col valore che avevano gia'.
 *
 * Assegnare lo stesso valore a `textContent`, a un `data-` o a una proprieta'
 * CSS non e' gratis: il browser non confronta, invalida. E dentro il velo
 * sfocato del modale ogni invalidazione e' un livello da ridipingere, che per
 * un fotogramma resta bianco.
 *
 * Questa prova conta le scritture con un vero MutationObserver. A stati fermi
 * devono essere ZERO: e' l'unica soglia che si difende da sola, perche' una
 * qualsiasi soglia piu' alta e' un invito a rimetterci dentro qualcosa.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const APPARECCHI = [
  "Condizionatori",
  "Lavatrice",
  "Lavastoviglie",
  "Asciugatrice",
  "Forno",
  "Frigorifero",
  "Microonde",
  "Boiler",
];

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: APPARECCHI.map((nome, indice) => ({
      id: `app-${indice}`,
      name: nome,
      type: "generico",
      power_entity: `sensor.app_${indice}_w`,
      daily_energy_entity: `sensor.app_${indice}_kwh`,
      metadata: { beta27_subload_group: "elettro" },
    })),
    loads: [{ id: "elettro", name: "Elettrodomestici", icon: "🔌", order: 0 }],
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: { grid: { power: "sensor.rete_w" }, house: { power: "sensor.casa_w" } },
    entityOverrides: {},
  },
  visibility: { home: true, energy: true },
};

test("a stati fermi il popup non tocca il DOM nemmeno una volta", async ({ page }, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);

  /* Una casa come quella del filmato: uno solo consuma, gli altri sette hanno
   * la presa accesa e zero watt. */
  await page.evaluate((quanti) => {
    const raw = eval("_RAW_STATES");
    const poni = (id, valore, unita = "W") =>
      (raw[id] = {
        entity_id: id,
        state: String(valore),
        attributes: { unit_of_measurement: unita },
      });
    for (let i = 0; i < quanti; i++) {
      poni(`sensor.app_${i}_w`, i === 0 ? 701 : 0);
      poni(`sensor.app_${i}_kwh`, (i / 3).toFixed(1), "kWh");
    }
    poni("sensor.rete_w", 701);
    poni("sensor.casa_w", 701);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, APPARECCHI.length);

  await page
    .locator('.tab[data-tab="energy"]')
    .first()
    .evaluate((nodo) => nodo.click());
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.apriSubLoads?.("elettro"));
  await expect(page.locator(".dm-subload-card")).toHaveCount(APPARECCHI.length);

  await page.evaluate(() => {
    window.__dmScritture = [];
    new MutationObserver((mutazioni) => {
      for (const mutazione of mutazioni)
        window.__dmScritture.push(
          mutazione.type === "attributes" ? `attributo:${mutazione.attributeName}` : mutazione.type,
        );
    }).observe(document.getElementById("subloads-list"), {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
  });

  /* Dieci giri del battito degli stati, senza che cambi un solo valore. */
  for (let giro = 0; giro < 10; giro++) {
    await page.evaluate(() => window.render?.());
    await page.waitForTimeout(60);
  }
  const aStatiFermi = await page.evaluate(() => {
    const scritte = window.__dmScritture.slice();
    window.__dmScritture = [];
    return scritte;
  });
  expect(
    aStatiFermi,
    `il popup riscrive ${aStatiFermi.length} volte una finestra che non e' cambiata: e' il lampo`,
  ).toEqual([]);

  /* E quando un valore cambia davvero, si scrive — poco, e solo li'. */
  await page.evaluate(() => {
    const id = "sensor.app_0_w";
    eval("_RAW_STATES")[id] = {
      entity_id: id,
      state: "888",
      attributes: { unit_of_measurement: "W" },
    };
    window.render?.();
  });
  await page.waitForTimeout(200);
  const conUnValoreNuovo = await page.evaluate(() => window.__dmScritture.slice());
  expect(conUnValoreNuovo.length, "un valore cambiato non ha scritto niente").toBeGreaterThan(0);
  expect(
    conUnValoreNuovo.length,
    `un solo watt cambiato ha fatto ${conUnValoreNuovo.length} scritture`,
  ).toBeLessThanOrEqual(6);
  await expect(page.locator('[data-dm-subload-card="app-0"] .dm-subload-power')).toHaveText(
    "888 W",
  );
});
