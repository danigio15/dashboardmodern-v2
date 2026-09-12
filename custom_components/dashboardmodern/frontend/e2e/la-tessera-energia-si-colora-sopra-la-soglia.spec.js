/* La tessera dell'Energia si colora quando la casa tira troppo (#508).
 *
 * «Possibilità di avere un campo dove inserire un valore massimo di potenza
 * che fa colorare di color ambra o rosso la card per capire un sovraccarico.»
 *
 * Qui si prova quello che si vede: la stessa casa, con la stessa corrente, e
 * la tessera che cambia colore solo quando la soglia lo dice. E si prova il
 * caso che una soglia sul carico di RETE deve saper distinguere: sei
 * chilowatt che ESCONO verso la rete sono una bella giornata di sole, non un
 * sovraccarico.
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
    energy: {
      house: { power: "sensor.casa_w" },
      grid: { power: "sensor.rete_w" },
    },
    entityOverrides: {},
  },
  visibility: { home: true, energy: true },
};

/* Quanto consuma la casa e quanto passa dal contatore, adesso. */
async function laCasaTira(page, { casa, rete }) {
  await page.evaluate(
    ({ casa: consumo, rete: scambio }) => {
      const stati = eval("_RAW_STATES");
      stati["sensor.casa_w"] = {
        entity_id: "sensor.casa_w",
        state: String(consumo),
        attributes: { unit_of_measurement: "W", friendly_name: "Consumo casa" },
      };
      stati["sensor.rete_w"] = {
        entity_id: "sensor.rete_w",
        state: String(scambio),
        attributes: { unit_of_measurement: "W", friendly_name: "Scambio rete" },
      };
      window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed"));
    },
    { casa, rete },
  );
}

/* La soglia, com'è salvata quando la si scrive nelle impostazioni. */
async function laSogliaE(page, soglia) {
  await page.evaluate((scritta) => {
    localStorage.setItem("cd_energia_soglia", JSON.stringify(scritta));
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed"));
  }, soglia);
}

const tessera = (page) => page.locator('[data-dm-widget="energia"]');
const colore = (page) =>
  tessera(page).evaluate((nodo) => nodo.style.getPropertyValue("--dm-widget-accent").trim());

async function avvia(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate(() => {
    const mappa = {
      "dm.energy_potenza_consumo_casa": "sensor.casa_w",
      "dm.energy_potenza_scambio_rete": "sensor.rete_w",
    };
    localStorage.setItem("cd_entity_overrides", JSON.stringify(mappa));
    window.cdApplyCanonicalOverrides?.(mappa);
  });
}

test("senza soglia la tessera resta dell'arancione di sempre", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  await laCasaTira(page, { casa: 6200, rete: 6000 });
  await expect(tessera(page)).toHaveCount(1);
  /* Chi non ha chiesto niente non deve accorgersi che questa riga è cambiata:
     seimiladuecento watt senza una soglia scritta non sono un sovraccarico. */
  await expect.poll(() => colore(page)).toBe("#f97316");
  await expect(tessera(page)).toHaveAttribute("data-alert", "false");
});

test("sopra l'ambra la tessera diventa ambra, sopra la rossa diventa rossa", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  await laSogliaE(page, { sorgente: "casa", ambra: 3000, rossa: 3300 });

  await laCasaTira(page, { casa: 2400, rete: 2400 });
  await expect.poll(() => colore(page)).toBe("#f97316");

  await laCasaTira(page, { casa: 3100, rete: 3100 });
  await expect.poll(() => colore(page)).toBe("#f59e0b");
  await expect(tessera(page)).toHaveAttribute("data-alert", "true");
  // E dice perché: quale carico, quanto tira e oltre quale numero.
  await expect(tessera(page).locator("[data-dm-tile-caption]")).toContainText("Sovraccarico");

  await laCasaTira(page, { casa: 4200, rete: 4200 });
  await expect.poll(() => colore(page)).toBe("#dc2626");
});

test("l'energia immessa in rete non fa scattare la soglia della rete", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  await laSogliaE(page, { sorgente: "rete", rossa: 3300 });

  /* Mezzogiorno d'agosto: la casa consuma poco e il fotovoltaico manda sei
     chilowatt FUORI. Col valore assoluto la tessera sarebbe diventata rossa
     nel momento migliore della giornata. */
  await laCasaTira(page, { casa: 700, rete: -6000 });
  await expect.poll(() => colore(page)).toBe("#f97316");

  // Lo stesso numero, ma in entrata, è il sovraccarico che si voleva vedere.
  await laCasaTira(page, { casa: 6700, rete: 6000 });
  await expect.poll(() => colore(page)).toBe("#dc2626");
});

test("la soglia si scrive nelle impostazioni dell'Energia", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  await laCasaTira(page, { casa: 4200, rete: 4200 });
  await page.evaluate(() => {
    window.apriConfigEntita();
    window.editorSwitch("energy");
  });
  // Sta dentro il pannello IMPOSTAZIONI, dove abita il costo del kWh: finché
  // quella linguetta non è aperta il pannello è nascosto, com'è giusto.
  const scheda = page.locator(
    '[data-editor="energy"] [data-energy-panel="settings"] #dm-energia-soglia',
  );
  await expect(scheda).toHaveCount(1);
  await expect(scheda).toBeHidden();
  await page
    .locator('[data-editor="energy"] .ed-inner-tabs .ed-inner-tab')
    .filter({ hasText: "IMPOSTAZIONI" })
    .click();
  await expect(scheda).toBeVisible();

  // Si sceglie il carico e si scrivono i due numeri, poi si salva.
  await scheda.locator('[data-dm-soglia-sorgente="casa"]').click();
  await scheda.locator('[data-dm-soglia="ambra"]').fill("3000");
  await scheda.locator('[data-dm-soglia="rossa"]').fill("3300");
  await scheda.locator("[data-dm-soglia-salva]").click();

  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("cd_energia_soglia")))
    .toContain("3300");
  // E la tessera, che tira 4200 W, è già rossa.
  await expect.poll(() => colore(page)).toBe("#dc2626");
});
