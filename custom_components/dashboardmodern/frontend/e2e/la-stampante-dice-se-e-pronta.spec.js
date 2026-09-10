import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

/* «Volevo chiedere se c'era la possibilità del controllo delle tv e
 * stampanti» (#469).
 *
 * La strada intera, con le mani di una persona: si apre la scheda Stampanti, si
 * scrive l'entità dello stato, e la pagina compare da sola — col bidone… no,
 * col disegno della stampante, la pastiglia «Pronta» e le barre delle cartucce
 * che nessuno ha scritto.
 */
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
  visibility: { home: true, stampanti: true },
};

const STATI = {
  "sensor.laser_ufficio": {
    entity_id: "sensor.laser_ufficio",
    state: "idle",
    attributes: { friendly_name: "Laser ufficio" },
  },
  "sensor.laser_ufficio_nero": {
    entity_id: "sensor.laser_ufficio_nero",
    state: "8",
    attributes: { unit_of_measurement: "%", friendly_name: "Nero" },
  },
  "sensor.laser_ufficio_ciano": {
    entity_id: "sensor.laser_ufficio_ciano",
    state: "64",
    attributes: { unit_of_measurement: "%", friendly_name: "Ciano" },
  },
};

test("si scrive l'entità, e la stampante compare con le sue cartucce", async ({
  page,
}, testInfo) => {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript((stati) => {
    window.__DM_STAMPANTI_STATI__ = stati;
  }, STATI);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
  /* Gli stati come li vede la plancia: `allStates()` legge `__HASS__.states`
   * prima di ogni altra cosa, ed e' l'unico posto che una prova puo' riempire
   * senza una connessione vera. */
  await page.evaluate((stati) => {
    window.__HASS__ = { ...(window.__HASS__ || {}), states: { ...stati } };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready"));
  }, STATI);

  await page.evaluate(() => window.apriConfigEntita());
  await page.locator('.ed-tab[data-tab="stampanti"]').click();
  await page.locator("#ed-body [data-dm-stampante-aggiungi]").click();
  /* Il campo dell'entità la configurazione lo veste da tasto «Scegli entità»:
   * l'input vero resta lì sotto, e si riempie come lo riempie la lente. */
  await page.evaluate(() => {
    const campo = document.querySelector('#ed-body [data-dm-stampante-campo="entity"]');
    campo.value = "sensor.laser_ufficio";
    campo.dispatchEvent(new Event("change"));
  });

  /* La riga sa già com'è messa: la scheda dice quante cartucce ha trovato
   * senza che si apra la pagina. */
  await expect(page.locator("#ed-body .dm-stampante-ed-riga").first()).toContainText(
    /cartucce|cartridges/i,
  );

  await expect
    .poll(() =>
      page.evaluate(() => {
        try {
          return JSON.parse(window.localStorage.getItem("cd_stampanti") || "[]").length;
        } catch (_errore) {
          return 0;
        }
      }),
    )
    .toBeGreaterThan(0);

  /* La scheda dice già tutto quello per cui serve: lo stato letto e le due
   * cartucce che nessuno ha scritto. */
  const riga = page.locator("#ed-body .dm-stampante-ed-riga").first();
  await expect(riga.locator(".dm-stampante-ed-stato")).toHaveText(/Pronta|Ready/i);
  await expect(riga).toContainText(/2 cartucce|2 cartridges/i);
});

test("con una stampante scritta, la pagina la disegna con le sue barre", async ({
  page,
}, testInfo) => {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
  await page.evaluate((stati) => {
    window.__HASS__ = { ...(window.__HASS__ || {}), states: { ...stati } };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready"));
  }, STATI);

  /* La configurazione si scrive con la penna della plancia, non a mano nel
   * magazzino: le chiavi viaggiano sotto il prefisso dell'istanza e passano da
   * una memoria che una scrittura di fuori non aggiorna. */
  await page.evaluate(async () => {
    const shared = await import("/src/sections/shared.js");
    shared.writeJsonIfChanged("cd_stampanti", [
      { id: "s1", nome: "Laser ufficio", entity: "sensor.laser_ufficio" },
    ]);
    const sezione = await import("/src/sections/stampanti-section.js");
    sezione.renderStampanti();
  });

  await page.locator('.tab[data-tab="stampanti"]').click();
  const carta = page.locator("#page-stampanti .dm-stampante").first();
  await expect(carta).toBeVisible();
  await expect(carta).toContainText("Laser ufficio");
  /* Il disegno è il nostro, non un'emoji di sistema. */
  await expect(carta.locator('[data-dm-art="printer"]')).toHaveCount(1);
  /* Le due cartucce nessuno le ha scritte: le ha trovate il modello. */
  await expect(carta.locator(".dm-stampante-cart")).toHaveCount(2);
  await expect(carta).toContainText("8%");
});
