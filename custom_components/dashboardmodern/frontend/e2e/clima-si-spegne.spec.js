/* Spegnere il clima deve funzionare anche sugli impianti piu' vecchi.
 *
 * I due pulsanti chiedevano `climate.turn_off`, che in Home Assistant esiste
 * solo se l'integrazione dichiara di saperlo fare. Bticino MyHome non lo
 * dichiara: la chiamata cadeva nel vuoto e la zona restava accesa per sempre.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const seed = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [{ id: "cl-1", name: "Ufficio", entity: "climate.ufficio" }],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, clima: true },
};

async function avvia(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  // I due pulsanti li sostituisce un modulo, e lo fa quando la plancia e'
  // pronta: si aspetta quel momento invece di arrivarci prima.
  await page.waitForFunction(() => window.toggleClima?.__dmClimaPower === true);
  // Una zona come la dichiara un impianto Bticino: sa cambiare modalita', non
  // sa accendersi e spegnersi da sola.
  await page.evaluate(() => {
    const stati =
      window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null") || window._RAW_STATES;
    stati["climate.ufficio"] = {
      entity_id: "climate.ufficio",
      state: "heat",
      attributes: { hvac_modes: ["off", "heat"], friendly_name: "Ufficio" },
    };
    /* La presa vera della plancia e' `dmCallHaService`: e' quella che il
     * runtime definisce e che manda il servizio sul WebSocket. Qui si
     * ascoltava `cdCallServiceJson`, che non esiste da nessuna parte — e
     * infatti il tasto del clima non chiamava niente sulla plancia vera. */
    window.__chiamate = [];
    window.dmCallHaService = (dominio, servizio, dati) => {
      window.__chiamate.push({ dominio, servizio, dati });
      return Promise.resolve();
    };
  });
}

test("il pulsante della scheda spegne mettendo la zona in off", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await avvia(page, testInfo);

  const esito = await page.evaluate(() => {
    window.toggleClima("climate.ufficio");
    return window.__chiamate;
  });

  expect(esito).toHaveLength(1);
  expect(esito[0].dominio).toBe("climate");
  // Il difetto: qui c'era turn_off, e non succedeva niente.
  expect(esito[0].servizio).toBe("set_hvac_mode");
  expect(esito[0].dati).toMatchObject({ entity_id: "climate.ufficio", hvac_mode: "off" });
});

test("riaccendere rimette la modalita' che c'era", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await avvia(page, testInfo);

  const esito = await page.evaluate(() => {
    // La zona sta raffrescando, poi viene spenta: riaccendendola deve tornare a
    // raffrescare, non mettersi a scaldare.
    const stati =
      window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null") || window._RAW_STATES;
    stati["climate.ufficio"].attributes.hvac_modes = ["off", "heat", "cool"];
    stati["climate.ufficio"].state = "cool";
    window.toggleClima("climate.ufficio");
    stati["climate.ufficio"].state = "off";
    window.toggleClima("climate.ufficio");
    return window.__chiamate;
  });

  expect(esito).toHaveLength(2);
  expect(esito[0].dati.hvac_mode).toBe("off");
  expect(esito[1].dati.hvac_mode).toBe("cool");
});
