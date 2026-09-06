/* La colonnina e evcc si collegano tutti e due, e restano collegati.
 *
 * «Devo collegare sia wallbox che evcc e cmq non salva nulla.»
 *
 * Sono due dispositivi diversi e portano cose diverse: evcc e' il regolatore e
 * pubblica la modalita' di ricarica, l'energia della sessione e la quota di
 * sole; la colonnina pubblica quello che misura — potenza, energia di oggi,
 * tensione, temperatura. Chi ha tutti e due li collega uno dopo l'altro, e il
 * secondo non deve portare via le caselle del primo.
 *
 * E quello che si collega deve restare li' dopo un ricaricamento: e' la meta'
 * della frase — «non salva nulla» — e senza ricaricare non si vede.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const ent = (entity_id, device_id, name, extra = {}) => ({
  entity_id,
  device_id,
  platform: device_id === "evcc-1" ? "evcc" : "goecharger",
  name,
  translation_key: "",
  device_class: "",
  unit: "",
  state_class: "",
  category: "",
  disabled: false,
  ...extra,
});

const CATALOGO = {
  integrations: [
    {
      domain: "evcc",
      name: "evcc",
      custom: true,
      devices: 1,
      entries: [{ entry_id: "evcc-entry", title: "evcc", state: "loaded" }],
    },
    {
      domain: "goecharger",
      name: "go-eCharger",
      custom: true,
      devices: 1,
      entries: [{ entry_id: "goe-entry", title: "go-eCharger", state: "loaded" }],
    },
  ],
  devices: [
    {
      id: "evcc-1",
      name: "evcc loadpoint 1",
      manufacturer: "evcc",
      model: "loadpoint",
      integration: "evcc",
      integrations: ["evcc"],
      area_id: "",
      area: "",
      entities: 4,
      disabled: false,
    },
    {
      id: "goe-1",
      name: "go-eCharger",
      manufacturer: "go-e",
      model: "HOME+",
      integration: "goecharger",
      integrations: ["goecharger"],
      area_id: "",
      area: "",
      entities: 4,
      disabled: false,
    },
  ],
  entities: [
    ent("select.evcc_loadpoint_1_charge_mode", "evcc-1", "Charge mode"),
    ent("number.evcc_loadpoint_1_limit_soc", "evcc-1", "Limit SoC", { unit: "%" }),
    ent("sensor.evcc_loadpoint_1_charged_energy", "evcc-1", "Charged energy", {
      device_class: "energy",
      unit: "kWh",
    }),
    ent("sensor.evcc_loadpoint_1_session_solar_percentage", "evcc-1", "Session solar percentage", {
      unit: "%",
    }),
    ent("sensor.evcc_loadpoint_1_charge_power", "evcc-1", "Charge power", {
      device_class: "power",
      unit: "W",
    }),
    ent("sensor.go_echarger_power", "goe-1", "go-eCharger power", {
      device_class: "power",
      unit: "W",
    }),
    ent("sensor.go_echarger_energy_today", "goe-1", "Energy today", {
      device_class: "energy",
      unit: "kWh",
    }),
    ent("sensor.go_echarger_voltage_l1", "goe-1", "Voltage L1", {
      device_class: "voltage",
      unit: "V",
    }),
    ent("sensor.go_echarger_temperature", "goe-1", "Temperature", {
      device_class: "temperature",
      unit: "°C",
    }),
  ],
};

const STATI = CATALOGO.entities.map((voce) => ({
  entity_id: voce.entity_id,
  state: voce.entity_id.startsWith("select.") ? "pv" : "7",
  attributes: {
    friendly_name: voce.name,
    ...(voce.device_class ? { device_class: voce.device_class } : {}),
    ...(voce.unit ? { unit_of_measurement: voce.unit } : {}),
    ...(voce.entity_id.startsWith("select.") ? { options: ["off", "pv", "minpv", "now"] } : {}),
  },
}));

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
    energy: {},
    entityOverrides: {},
  },
  visibility: { ev: true },
};

async function apriLaSchedaAuto(page) {
  await page.evaluate(() => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
  });
  await page.locator('.ed-tab[data-tab="sez2"]').click();
  /* Due tasti, non uno: «devono essere due per selezionare le cose». */
  await expect(page.locator('#ed-body [data-wallbox-integ="colonnina"]')).toBeVisible();
  await expect(page.locator('#ed-body [data-wallbox-integ="evcc"]')).toBeVisible();
}

async function boot(page, testInfo) {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 150_000 : 90_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(
    ({ haStates, catalogo }) => {
      class PonteFinto extends EventTarget {
        static OPEN = 1;
        readyState = 1;
        onopen = null;
        onmessage = null;
        onclose = null;
        constructor() {
          super();
          queueMicrotask(() => {
            this.onopen?.({});
            this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
          });
        }
        send(grezzo) {
          const messaggio = JSON.parse(grezzo);
          if (messaggio.type === "auth") return;
          let risultato = null;
          if (messaggio.type === "get_states") risultato = haStates;
          else if (messaggio.type === "frontend/get_user_data") risultato = { value: null };
          else if (messaggio.type === "dashboardmodern/integrations/catalog") {
            const volute = Array.isArray(messaggio.device_ids) ? messaggio.device_ids : [];
            risultato = {
              integrations: catalogo.integrations,
              devices: catalogo.devices,
              entities: catalogo.entities.filter((voce) => volute.includes(voce.device_id)),
            };
          } else if (messaggio.type === "call_service") risultato = {};
          queueMicrotask(() =>
            this.onmessage?.({
              data: JSON.stringify({
                id: messaggio.id,
                type: "result",
                success: true,
                result: risultato,
              }),
            }),
          );
        }
        close() {
          this.readyState = 3;
          this.onclose?.({});
        }
      }
      window.__DASHBOARDMODERN_BRIDGE_WS__ = PonteFinto;
      window.WebSocket = PonteFinto;
    },
    { haStates: STATI, catalogo: CATALOGO },
  );
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate((haStates) => {
    haStates.forEach((voce) => {
      _RAW_STATES[voce.entity_id] = structuredClone(voce);
      STATES[voce.entity_id] = structuredClone(voce);
    });
  }, STATI);
  await apriLaSchedaAuto(page);
}

async function collega(page, dominio, deviceId) {
  /* Il tasto di evcc apre un menu con evcc e basta; quello della colonnina,
   * le colonnine e basta. */
  const tasto = dominio === "evcc" ? "evcc" : "colonnina";
  await page.locator(`#ed-body [data-wallbox-integ="${tasto}"]`).click();
  const menu = page.locator("#dm-integ-menu");
  await expect(menu).toBeVisible();
  await expect(menu.locator(".dm-integ-item")).toHaveCount(1);
  await menu.locator(`.dm-integ-item[data-domain="${dominio}"]`).click();
  await menu.locator(`.dm-integ-device[data-device-id="${deviceId}"]`).click();
  await menu.locator("[data-preview] [data-confirm]").click();
  await expect(menu).toHaveCount(0);
}

const caselle = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("cd_entity_overrides") || "{}"));

test("evcc e la colonnina si collegano tutti e due, e nessuno scalza l'altro", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo);

  /* Prima evcc: la modalita', la sessione e la quota di sole sono sue e solo
   * sue — una colonnina nuda non le ha. */
  await collega(page, "evcc", "evcc-1");
  await expect
    .poll(() => caselle(page))
    .toMatchObject({
      "dm.ev_modalita_ricarica_evcc": "select.evcc_loadpoint_1_charge_mode",
      "dm.ev_energia_sessione": "sensor.evcc_loadpoint_1_charged_energy",
      "dm.ev_percentuale_solare_sessione": "sensor.evcc_loadpoint_1_session_solar_percentage",
      "dm.ev_potenza_wallbox": "sensor.evcc_loadpoint_1_charge_power",
    });

  /* Poi la colonnina, che porta quello che misura lei. Il secondo dispositivo
   * NON deve portare via le caselle del primo: sono due pezzi dello stesso
   * impianto, non due impianti che si contendono le stesse caselle. */
  await collega(page, "goecharger", "goe-1");
  await expect
    .poll(() => caselle(page))
    .toMatchObject({
      "dm.ev_modalita_ricarica_evcc": "select.evcc_loadpoint_1_charge_mode",
      "dm.ev_energia_sessione": "sensor.evcc_loadpoint_1_charged_energy",
      "dm.ev_percentuale_solare_sessione": "sensor.evcc_loadpoint_1_session_solar_percentage",
      "dm.ev_energia_wallbox_oggi": "sensor.go_echarger_energy_today",
      "dm.ev_tensione_wallbox": "sensor.go_echarger_voltage_l1",
      "dm.ev_temperatura_wallbox": "sensor.go_echarger_temperature",
      /* La potenza la sanno dire tutti e due, e resta di chi l'aveva: il
       * secondo dispositivo si aggiunge, non scalza. */
      "dm.ev_potenza_wallbox": "sensor.evcc_loadpoint_1_charge_power",
    });
});

test("le caselle della colonnina non spariscono al salvataggio dell'auto", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo);
  await collega(page, "evcc", "evcc-1");

  /* I campi della scheda le mostrano: e' la meta' visibile di «collegato».
   * Senza, la colonnina non si vede da nessuna parte — e il salvataggio qui
   * sotto se la porta via, perche' rilegge proprio questi campi. */
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.fromEntries(
          [...document.querySelectorAll('#ed-body input.ed-slot-in[data-ref^="dm.ev_"]')].map(
            (campo) => [campo.dataset.ref, campo.value],
          ),
        ),
      ),
    )
    .toMatchObject({
      "dm.ev_modalita_ricarica_evcc": "select.evcc_loadpoint_1_charge_mode",
      "dm.ev_energia_sessione": "sensor.evcc_loadpoint_1_charged_energy",
    });

  /* E ora il gesto che le cancellava: si da' un nome all'auto e si salva.
   *
   * «Si collega ma faccio salva e non vedo le entita'.» Il salvataggio
   * dell'auto rilegge OGNI campo `dm.ev_*` del modulo e cancella la casella di
   * quelli vuoti: le caselle della colonnina, appena collegate, erano vuote
   * nei campi e sparivano tutte insieme. */
  await page.locator("#ed-evcar-name").fill("Leapmotor B10");
  await page.locator('#ed-body button[onclick*="edEvCarAdd"]').first().click();
  await expect
    .poll(() => caselle(page))
    .toMatchObject({
      "dm.ev_modalita_ricarica_evcc": "select.evcc_loadpoint_1_charge_mode",
      "dm.ev_energia_sessione": "sensor.evcc_loadpoint_1_charged_energy",
      "dm.ev_percentuale_solare_sessione": "sensor.evcc_loadpoint_1_session_solar_percentage",
      /* Il target e' dell'auto, ma lo porta evcc: anche lui deve sopravvivere
       * al salvataggio, che rilegge i campi della scheda. */
      "dm.ev_target_soc": "number.evcc_loadpoint_1_limit_soc",
    });

  /* E rimettendo in uso quell'auto, la colonnina di casa resta quella di
   * casa: e' il giro che la riportava indietro. */
  await page.evaluate(() => window.cdEvApplyCar?.(0));
  await expect
    .poll(() => caselle(page))
    .toMatchObject({
      "dm.ev_modalita_ricarica_evcc": "select.evcc_loadpoint_1_charge_mode",
      "dm.ev_energia_sessione": "sensor.evcc_loadpoint_1_charged_energy",
    });

  /* E dopo un ricaricamento sono ancora li'. */
  await page.reload();
  await page.waitForFunction(
    () => window.__DASHBOARDMODERN_LEGACY_READY__ && window.DashboardModernModules,
  );
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await expect
    .poll(() => caselle(page))
    .toMatchObject({
      "dm.ev_modalita_ricarica_evcc": "select.evcc_loadpoint_1_charge_mode",
      "dm.ev_energia_sessione": "sensor.evcc_loadpoint_1_charged_energy",
    });

  /* E la copia canonica le ha prese: e' quella che viaggia col salvataggio, e
   * se resta indietro le caselle tornano com'erano al primo giro. */
  const canoniche = await page.evaluate(
    () => DashboardModernModules.store.getState().sections.entityOverrides || {},
  );
  expect(canoniche["dm.ev_modalita_ricarica_evcc"]).toBe("select.evcc_loadpoint_1_charge_mode");
});
