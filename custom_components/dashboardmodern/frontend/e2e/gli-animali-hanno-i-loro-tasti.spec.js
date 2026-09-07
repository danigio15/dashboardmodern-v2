import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { clickBottomTab } from "./helpers/navigation.js";

/* «Sarebbe bello se la nuova sezione Animali avesse coerenza grafica con le
 * altre, attualmente l'header è totalmente diverso (anzi, assente)… sarebbe
 * utile avere i bottoni per avviare la pulizia manuale della lettiera… l'avviso
 * della lettiera deve essere quando questa scende sotto una percentuale,
 * attualmente è sopra.» (#373)
 */
const ANIMALI = [
  {
    id: "a1",
    nome: "Micio",
    specie: "gatto",
    cibo_livello: "sensor.food",
    cibo_eroga: "button.feed",
    lettiera_sabbia: "sensor.litter",
    lettiera_pulisci: "button.clean",
    lettiera_cestino: "binary_sensor.waste_bin",
  },
];

const STATI = [
  { entity_id: "sensor.food", state: "64", attributes: { unit_of_measurement: "%" } },
  { entity_id: "sensor.litter", state: "12", attributes: { unit_of_measurement: "%" } },
  { entity_id: "binary_sensor.waste_bin", state: "off", attributes: {} },
  { entity_id: "button.feed", state: "2026-09-07T08:00:00+00:00", attributes: {} },
  { entity_id: "button.clean", state: "2026-09-07T07:00:00+00:00", attributes: {} },
];

const seed = {
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
  visibility: { home: true, animali: true },
};

async function apriGliAnimali(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
  await page.evaluate((dato) => localStorage.setItem("cd_animali", JSON.stringify(dato)), ANIMALI);
  await page.evaluate(
    (haStati) =>
      haStati.forEach((voce) => {
        _RAW_STATES[voce.entity_id] = structuredClone(voce);
        STATES[voce.entity_id] = structuredClone(voce);
      }),
    STATI,
  );
  await page.evaluate(() => {
    window.__CHIAMATE__ = [];
    window.dmCallHaService = (dominio, servizio, dati) => {
      window.__CHIAMATE__.push([dominio, servizio, dati]);
      return Promise.resolve();
    };
  });
  await clickBottomTab(page, "animali", testInfo);
  await page.waitForSelector("#page-animali .dm-animale-card");
}

test("la pagina ha la sua intestazione, come tutte le altre", async ({ page }, testInfo) => {
  await apriGliAnimali(page, testInfo);
  const pagina = page.locator("#page-animali");
  await expect(pagina).toContainText(/Animali/i);
  await expect(pagina.locator(".back-home-btn")).toHaveCount(1);
});

test("ogni dispositivo ha la sua fascia, coi suoi tasti dentro", async ({ page }, testInfo) => {
  await apriGliAnimali(page, testInfo);
  const ciotola = page.locator('#page-animali [data-dm-animale-gruppo="ciotola"]');
  const lettiera = page.locator('#page-animali [data-dm-animale-gruppo="lettiera"]');
  await expect(ciotola).toHaveCount(1);
  await expect(lettiera).toHaveCount(1);
  // Il tasto della ciotola sta con la ciotola, non in fondo alla scheda.
  await expect(ciotola.locator("[data-dm-animale-azione]")).toHaveCount(1);
  await expect(lettiera.locator("[data-dm-animale-azione]")).toHaveCount(1);
});

test("premere un tasto chiede a Home Assistant il servizio giusto", async ({ page }, testInfo) => {
  await apriGliAnimali(page, testInfo);
  await page.locator('[data-dm-animale-azione="button.clean"]').click();
  await expect
    .poll(() => page.evaluate(() => window.__CHIAMATE__))
    .toEqual([["button", "press", { entity_id: "button.clean" }]]);
  /* Il tasto si spegne per un attimo: su una lettiera la pulizia parte e
   * finisce dopo minuti, e senza un segno uno preme tre volte. */
  await expect(page.locator('[data-dm-animale-azione="button.clean"]')).toBeDisabled();
});

test("la sabbia che sta finendo avvisa, e la sua barra è rossa", async ({ page }, testInfo) => {
  await apriGliAnimali(page, testInfo);
  await expect(page.locator("#page-animali .dm-animale-avvisi")).toContainText(/sabbia/i);
  const barra = page.locator(
    '#page-animali [data-dm-animale-lettura="lettiera_sabbia"] .dm-animale-barra',
  );
  await expect(barra).toHaveAttribute("data-male", "true");
  // Il cibo al 64% invece sta bene: la stessa barra, l'altro verso.
  await expect(
    page.locator('#page-animali [data-dm-animale-lettura="cibo_livello"] .dm-animale-barra'),
  ).toHaveAttribute("data-male", "false");
});
