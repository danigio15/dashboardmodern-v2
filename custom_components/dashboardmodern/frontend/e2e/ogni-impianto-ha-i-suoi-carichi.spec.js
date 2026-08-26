import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

/* Due impianti, due gruppi di cerchi.
 *
 * «Io ho una casa che e' l'unione di due appartamenti, quindi ho 2 misuratori
 * di consumo»: le linguette in cima all'Energia scelgono di quale casa si sta
 * parlando, e da li' in giu' tutto la segue — il misuratore, il fotovoltaico,
 * la batteria. I carichi restavano fuori dal patto, ed erano gli unici a
 * comparire in tutti e due i flussi: la lavatrice dell'altra casa in mezzo
 * alla propria, e nessun modo di toglierla.
 */
const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [
      { id: "forno", name: "Forno", icon: "🔥", power_entity: "sensor.forno_w", order: 0 },
      {
        id: "lavatrice",
        name: "Lavatrice",
        icon: "🌀",
        power_entity: "sensor.lavatrice_w",
        order: 1,
        plant: "impianto-2",
      },
    ],
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {
      grid: { power: "sensor.rete_w" },
      solar: { power: "sensor.fv_w" },
      plants: [
        {
          id: "impianto-2",
          name: "Casa Donato",
          grid: { power: "sensor.rete2_w" },
          solar: { power: "sensor.fv2_w" },
        },
      ],
      metadata: { plant_seq: 2 },
    },
    entityOverrides: {},
  },
  visibility: { home: true, energy: true },
};

/* I nomi dei cerchi disegnati sotto Casa, senza ripetizioni: le viste sono
 * tre — istante, giorno, mese — e ognuna ha la sua tela. Prenderli tutti
 * insieme e chiedere l'insieme dice due cose in una: quali cerchi ci sono, e
 * che le tre viste dicono la stessa cosa. */
const cerchi = (page) =>
  page.evaluate(() =>
    [
      ...new Set(
        [...document.querySelectorAll("#page-energy [data-dm-flow-node]")]
          .map((nodo) => (nodo.querySelector(".node-label")?.textContent || "").trim())
          .filter(Boolean),
      ),
    ].sort(),
  );

test("ogni impianto ha i suoi cerchi, e cambiare linguetta li cambia", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate(() => {
    window.__HASS__ = {
      states: {
        "sensor.forno_w": { entity_id: "sensor.forno_w", state: "800" },
        "sensor.lavatrice_w": { entity_id: "sensor.lavatrice_w", state: "1200" },
      },
    };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    window.showPage?.("energy");
  });

  /* Casa Giovanni e' il primo impianto: il forno e' suo, e la lavatrice —
   * scritta sull'altra casa — non la vede. */
  await expect.poll(() => cerchi(page)).toEqual(["Forno"]);

  // Si passa a Casa Donato dalla linguetta, come farebbe un dito.
  // Click diretto: la riga delle linguette si ridisegna, e l'attesa di
  // stabilita' non arriverebbe mai.
  await page
    .locator('#page-energy [data-dm-impianto="impianto-2"]')
    .evaluate((pillola) => pillola.click());
  await expect.poll(() => cerchi(page)).toEqual(["Lavatrice"]);

  // E tornando indietro si ritrova il proprio, non la somma dei due.
  await page
    .locator('#page-energy [data-dm-impianto="impianto"]')
    .evaluate((pillola) => pillola.click());
  await expect.poll(() => cerchi(page)).toEqual(["Forno"]);
});
