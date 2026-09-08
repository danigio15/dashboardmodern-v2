/* «Le batterie quelle cariche non le fa vedere? Sarebbe carino che le batterie
 * stessero nel config come le altre cose configurazioni.» (#398)
 *
 * Qui si guarda la plancia vera: la voce nella barra, la pagina che elenca
 * tutte le batterie — non solo quelle da cambiare — e la scheda del Config
 * dove si sceglie la soglia. E soprattutto la cosa che lega le due: cambiare
 * la soglia deve cambiare quello che la pagina colora, o sono due numeri per
 * la stessa domanda.
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
    lights: [{ entity: "light.salotto", name: "Salotto" }],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, batterie: true },
};

const batteria = (livello, nome) => ({
  state: String(livello),
  attributes: { device_class: "battery", unit_of_measurement: "%", friendly_name: nome },
});

async function avvia(page, testInfo) {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  /* Tre batterie di casa: una scarica, una a metà strada, una piena. Le
   * entità sorvegliate si scrivono dopo l'avvio, come tutte le chiavi del
   * guscio: prima di allora la memoria non ha ancora il prefisso dell'istanza. */
  await page.evaluate(
    ({ stati }) => {
      window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...stati } };
      const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
      if (raw) Object.assign(raw, stati);
      /* Le batterie sorvegliate sono un gruppo di avvisi: si dichiarano lì. */
      localStorage.setItem("cd_gruppi_extra", JSON.stringify({ batt: Object.keys(stati) }));
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    },
    {
      stati: {
        "sensor.serratura_batteria": batteria(12, "Serratura"),
        "sensor.sonda_batteria": batteria(31, "Sonda"),
        "sensor.telecomando_batteria": batteria(88, "Telecomando"),
      },
    },
  );
}

/* Il Config è una finestra sopra la plancia: finché è aperta copre la barra in
 * basso, e la voce della pagina non si può premere. */
async function chiudiIlConfig(page) {
  await page.evaluate(() => document.getElementById("editor-modal")?.remove());
}

test("la pagina elenca TUTTE le batterie, non solo quelle da cambiare", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);

  await page.locator('.tab[data-tab="batterie"]').click();
  const carte = page.locator("#page-batterie .dm-batt");
  await expect(carte).toHaveCount(3, { timeout: 15_000 });
  /* È il punto della segnalazione: la piena si vede, e prima non c'era nessun
   * posto dove vederla. */
  await expect(
    page.locator('#page-batterie [data-dm-entita="sensor.telecomando_batteria"]'),
  ).toHaveAttribute("data-batt", "carica");
  await expect(
    page.locator('#page-batterie [data-dm-entita="sensor.serratura_batteria"]'),
  ).toHaveAttribute("data-batt", "scarica");
  /* Dalla più scarica alla più piena. */
  const ordine = await page.evaluate(() =>
    [...document.querySelectorAll("#page-batterie .dm-batt")].map((n) => n.dataset.dmEntita),
  );
  expect(ordine).toEqual([
    "sensor.serratura_batteria",
    "sensor.sonda_batteria",
    "sensor.telecomando_batteria",
  ]);
});

test("la scheda del Config esiste, e la soglia che si scrive è quella che colora", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);

  await page.evaluate(() => window.apriConfigEntita?.());
  await page.locator('#editor-modal .ed-tab[data-tab="batterie"]').click();
  const soglia = page.locator("#ed-body [data-dm-batt-soglia]");
  await expect(soglia).toHaveValue("20", { timeout: 15_000 });

  /* Alzandola al trentacinque anche la sonda al 31% diventa da cambiare: è
   * esattamente la cosa che prima non si poteva dire. */
  await soglia.fill("35");
  await soglia.dispatchEvent("change");

  await chiudiIlConfig(page);
  await page.locator('.tab[data-tab="batterie"]').click();
  await expect(
    page.locator('#page-batterie [data-dm-entita="sensor.sonda_batteria"]'),
  ).toHaveAttribute("data-batt", "scarica");
  await expect(
    page.locator('#page-batterie [data-dm-entita="sensor.telecomando_batteria"]'),
  ).toHaveAttribute("data-batt", "carica");
});

test("una batteria tolta dalla scheda sparisce anche dalla pagina", async ({ page }, testInfo) => {
  await avvia(page, testInfo);

  await page.evaluate(() => window.apriConfigEntita?.());
  await page.locator('#editor-modal .ed-tab[data-tab="batterie"]').click();
  await expect(page.locator("#ed-body .dm-batt-ed-riga")).toHaveCount(3, { timeout: 15_000 });

  /* La batteria del telefono è una percentuale ma non è una pila da comprare:
   * si toglie, e deve sparire da tutte le parti — se la pagina continuasse a
   * contarla, chi l'ha tolta penserebbe che la plancia non l'ha sentito. */
  await page.locator('[data-dm-batt-escludi="sensor.telecomando_batteria"]').click();
  await expect(page.locator("#ed-body .dm-batt-ed-riga")).toHaveCount(2);

  await chiudiIlConfig(page);
  await page.locator('.tab[data-tab="batterie"]').click();
  await expect(page.locator("#page-batterie .dm-batt")).toHaveCount(2);
  await expect(
    page.locator('#page-batterie [data-dm-entita="sensor.telecomando_batteria"]'),
  ).toHaveCount(0);
});
