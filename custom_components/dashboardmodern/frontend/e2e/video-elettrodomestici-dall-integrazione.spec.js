/* Il giro guidato degli elettrodomestici presi da un'integrazione, registrato.
 *
 * Non e' una prova: e' il filmato che si manda a chi la plancia la usa. Il giro
 * e' quello vero — la scheda vuota, il menu delle integrazioni, la lavatrice
 * che nasce gia' compilata, la card che dice a che punto e' il ciclo, il
 * dettaglio col dispositivo intero, la finestra della tessera in Home — e la
 * didascalia in sovrimpressione dice cosa si sta guardando.
 *
 * Il backend e' finto e risponde al catalogo con una hOn (da HACS) e una Shelly
 * (ufficiale), come sul deposito di chi ha chiesto la funzione.
 *
 * Si registra a mano, perche' dura due minuti e in CI non serve a nessuno:
 *
 *   DM_VIDEO=1 npx playwright test e2e/video-elettrodomestici-dall-integrazione.spec.js --project=desktop
 *
 * Il filmato esce in `test-results/<nome-della-prova>/video.webm`.
 */
import { test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

test.use({ video: { mode: "on", size: { width: 1440, height: 900 } } });
test.describe.configure({ timeout: 12 * 60 * 1000 });

/* ── la casa finta, quella del filmato ──────────────────────────────────── */

const ent = (entity_id, name, extra = {}) => ({
  entity_id,
  device_id: "wm-1",
  platform: "hon",
  name,
  translation_key: "",
  device_class: "",
  unit: "",
  state_class: "",
  category: "",
  disabled: false,
  hidden: false,
  ...extra,
});

const CATALOGO = {
  integrations: [
    { domain: "shelly", name: "Shelly", custom: false, devices: 2, entries: [] },
    { domain: "hue", name: "Philips Hue", custom: false, devices: 6, entries: [] },
    {
      domain: "hon",
      name: "Haier hOn Revived",
      custom: true,
      devices: 2,
      entries: [{ entry_id: "hon-1", title: "Hoover", state: "loaded" }],
    },
  ],
  devices: [
    {
      id: "plug-1",
      name: "Presa lavastoviglie",
      manufacturer: "Shelly",
      model: "Plus Plug S",
      integration: "shelly",
      integrations: ["shelly"],
      area_id: "a2",
      area: "Cucina",
      entities: 3,
      disabled: false,
    },
    {
      id: "wm-1",
      name: "Lavatrice",
      manufacturer: "Hoover",
      model: "H-WASH 500",
      integration: "hon",
      integrations: ["hon"],
      area_id: "a1",
      area: "Lavanderia",
      entities: 11,
      disabled: false,
    },
    {
      id: "td-1",
      name: "Asciugatrice",
      manufacturer: "Hoover",
      model: "H-DRY 500",
      integration: "hon",
      integrations: ["hon"],
      area_id: "a1",
      area: "Lavanderia",
      entities: 4,
      disabled: false,
    },
  ],
  entities: [
    ent("sensor.lavatrice_machine_status", "Machine status", { translation_key: "washing_modes" }),
    ent("sensor.lavatrice_fase", "Fase", { translation_key: "program_phases_wm" }),
    ent("sensor.lavatrice_tempo_rimanente", "Tempo rimanente", {
      translation_key: "remaining_time",
      unit: "min",
      device_class: "duration",
    }),
    ent("sensor.lavatrice_temperatura", "Temperatura", { unit: "°C", device_class: "temperature" }),
    ent("sensor.lavatrice_centrifuga", "Centrifuga", { unit: "rpm" }),
    ent("sensor.lavatrice_power", "Power", { unit: "W", device_class: "power" }),
    ent("sensor.lavatrice_energy", "Energy", {
      unit: "kWh",
      device_class: "energy",
      state_class: "total_increasing",
    }),
    ent("binary_sensor.lavatrice_oblo", "Oblò", { device_class: "door" }),
    ent("switch.lavatrice_lavatrice", "Lavatrice", { translation_key: "wash" }),
    ent("switch.lavatrice_pausa", "Pausa", { translation_key: "pause" }),
    ent("select.lavatrice_programma", "Programma", { category: "config" }),
    ent("sensor.lavatrice_rssi", "RSSI", { category: "diagnostic", unit: "dBm" }),
    ent("sensor.asciugatrice_machine_status", "Machine status", {
      device_id: "td-1",
      translation_key: "washing_modes",
    }),
    ent("sensor.asciugatrice_fase", "Fase", {
      device_id: "td-1",
      translation_key: "program_phases_wm",
    }),
    ent("sensor.asciugatrice_tempo_rimanente", "Tempo rimanente", {
      device_id: "td-1",
      translation_key: "remaining_time",
      unit: "min",
      device_class: "duration",
    }),
    ent("switch.asciugatrice_asciugatrice", "Asciugatrice", {
      device_id: "td-1",
      translation_key: "dry",
    }),
  ],
};

const stato = (entity_id, state, attributes = {}) => ({ entity_id, state, attributes });

const STATI = [
  stato("sensor.lavatrice_machine_status", "running", {
    friendly_name: "Lavatrice Machine status",
  }),
  stato("sensor.lavatrice_fase", "washing", { friendly_name: "Lavatrice Fase" }),
  stato("sensor.lavatrice_tempo_rimanente", "50", {
    friendly_name: "Lavatrice Tempo rimanente",
    unit_of_measurement: "min",
  }),
  stato("sensor.lavatrice_temperatura", "40", {
    friendly_name: "Lavatrice Temperatura",
    unit_of_measurement: "°C",
  }),
  stato("sensor.lavatrice_centrifuga", "1200", {
    friendly_name: "Lavatrice Centrifuga",
    unit_of_measurement: "rpm",
  }),
  stato("sensor.lavatrice_power", "1180", {
    friendly_name: "Lavatrice Power",
    unit_of_measurement: "W",
  }),
  stato("sensor.lavatrice_energy", "115.5", {
    friendly_name: "Lavatrice Energy",
    unit_of_measurement: "kWh",
    state_class: "total_increasing",
  }),
  stato("binary_sensor.lavatrice_oblo", "off", {
    friendly_name: "Lavatrice Oblò",
    device_class: "door",
  }),
  stato("switch.lavatrice_lavatrice", "on", { friendly_name: "Lavatrice Lavatrice" }),
  stato("switch.lavatrice_pausa", "off", { friendly_name: "Lavatrice Pausa" }),
  stato("select.lavatrice_programma", "cotone", {
    friendly_name: "Lavatrice Programma",
    options: ["cotone", "sintetici", "rapido_14"],
  }),
  stato("sensor.lavatrice_rssi", "-58", {
    friendly_name: "Lavatrice RSSI",
    unit_of_measurement: "dBm",
  }),
  /* L'asciugatrice non ha nessuna presa sotto: niente watt, e a dire che sta
   * lavorando resta la sola parola della fase. E' la scena 6. */
  stato("sensor.asciugatrice_machine_status", "running", {
    friendly_name: "Asciugatrice Machine status",
  }),
  stato("sensor.asciugatrice_fase", "drying", { friendly_name: "Asciugatrice Fase" }),
  stato("sensor.asciugatrice_tempo_rimanente", "35", {
    friendly_name: "Asciugatrice Tempo rimanente",
    unit_of_measurement: "min",
  }),
  stato("switch.asciugatrice_asciugatrice", "on", { friendly_name: "Asciugatrice Asciugatrice" }),
];

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "room-lavanderia", name: "Lavanderia", icon: "🧺" }],
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
  visibility: { home: true, appliances: true },
};

/* ── il cartello in sovrimpressione ─────────────────────────────────────── */

async function scena(page, numero, titolo, testo, attesa = 2800) {
  await page.evaluate(
    ({ numero, titolo, testo }) => {
      let cartello = document.getElementById("dm-video-scena");
      if (!cartello) {
        const foglio = document.createElement("style");
        foglio.textContent = `
          #dm-video-scena{
            position:fixed;left:22px;right:22px;bottom:26px;z-index:2147483647;pointer-events:none;
            display:flex;align-items:center;gap:15px;padding:15px 20px;border-radius:22px;
            font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
            background:linear-gradient(120deg,rgba(4,12,24,.95),rgba(9,25,44,.93));
            box-shadow:0 26px 60px -28px rgba(2,8,20,.95);color:#f8fafc;
            opacity:0;transform:translateY(12px);transition:opacity .45s ease,transform .45s ease}
          #dm-video-scena[data-on="true"]{opacity:1;transform:none}
          #dm-video-scena b{
            display:grid;place-items:center;flex:0 0 auto;width:44px;height:44px;border-radius:15px;
            background:linear-gradient(150deg,#38bdf8,#0369a1);font-size:18px;font-weight:900;
            box-shadow:0 14px 30px -14px rgba(56,189,248,.9)}
          #dm-video-scena div{display:grid;gap:2px;min-width:0;flex:1 1 auto}
          #dm-video-scena h4{margin:0;font-size:22px;font-weight:900;letter-spacing:-.4px}
          #dm-video-scena p{margin:0;font-size:14px;font-weight:600;color:#cbd5f5;letter-spacing:.1px}
          #dm-video-scena i{
            flex:0 0 auto;padding:6px 12px;border-radius:999px;font-style:normal;
            background:rgba(148,197,255,.16);color:#bfdbfe;font-size:10.5px;font-weight:900;letter-spacing:1.5px}`;
        document.head.append(foglio);
        cartello = document.createElement("aside");
        cartello.id = "dm-video-scena";
        cartello.innerHTML = "<b></b><div><h4></h4><p></p></div><i>DASHBOARD MODERN · 1.4.7</i>";
        document.body.append(cartello);
      }
      cartello.querySelector("b").textContent = String(numero);
      cartello.querySelector("h4").textContent = titolo;
      cartello.querySelector("p").textContent = testo;
      cartello.setAttribute("data-on", "true");
    },
    { numero, titolo, testo },
  );
  await page.waitForTimeout(attesa);
}

const respira = (page, ms = 1400) => page.waitForTimeout(ms);

/* In un filmato una scena che non c'e' si salta, non ferma la registrazione. */
async function inVista(page, selettore, ms = 1100) {
  const bersaglio = page.locator(selettore).first();
  try {
    await bersaglio.waitFor({ state: "attached", timeout: 4000 });
    await bersaglio.evaluate((nodo) =>
      nodo.scrollIntoView({ block: "center", behavior: "smooth" }),
    );
  } catch (_errore) {
    return false;
  }
  await respira(page, ms);
  return true;
}

/* Un tocco con la sua scadenza. Senza, un click su una cosa coperta — una
 * finestra rimasta aperta sopra la pagina — riprova fino al tempo massimo
 * della prova: dieci minuti di filmato fermo sulla stessa schermata. */
async function tocca(page, selettore, attesa = 1400) {
  const bersaglio = page.locator(selettore).first();
  try {
    await bersaglio.waitFor({ state: "visible", timeout: 6000 });
    await bersaglio.click({ timeout: 5000 });
  } catch (_errore) {
    return false;
  }
  await respira(page, attesa);
  return true;
}

/* La finestra della configurazione si chiude col suo tasto, e ci si assicura
 * che sia andata: e' lei che copriva la Home nella prima registrazione. */
async function chiudiLaConfigurazione(page) {
  for (let giro = 0; giro < 3; giro += 1) {
    const aperta = await page.evaluate(() =>
      Boolean(document.getElementById("editor-modal")?.classList.contains("show")),
    );
    if (!aperta) return true;
    await page.evaluate(() => {
      /* Il tasto toglie la finestra dal documento: chiamare `forceClose` dopo
       * vorrebbe dire cercarla quando non c'e' piu', e quella solleva. Una
       * strada per volta, e la seconda solo se la prima non c'era. */
      const chiudi = document.querySelector("#editor-modal .ed-head-close");
      if (chiudi) {
        chiudi.click();
        return;
      }
      try {
        window.forceClose?.("editor-modal");
      } catch (_errore) {}
    });
    await respira(page, 700);
  }
  return false;
}

async function vaiA(page, tab) {
  const linguetta = page.locator(`.tab[data-tab="${tab}"]`).first();
  if (await linguetta.count()) await linguetta.evaluate((nodo) => nodo.click());
  else
    await page.evaluate((nome) => {
      document.querySelectorAll(".page").forEach((nodo) => nodo.classList.remove("active"));
      document.getElementById(`page-${nome}`)?.classList.add("active");
    }, tab);
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
    try {
      render();
    } catch (_errore) {
      /* il giro di disegno storico non c'e' su tutte le pagine */
    }
    window.scrollTo({ top: 0 });
  });
  await respira(page, 1400);
}

/* ── il giro ────────────────────────────────────────────────────────────── */

test("il giro degli elettrodomestici presi da un'integrazione", async ({ page }, testInfo) => {
  test.skip(!process.env.DM_VIDEO, "si registra a mano: DM_VIDEO=1");
  test.skip(testInfo.project.name !== "desktop", "il filmato e' da schermo largo");
  test.setTimeout(10 * 60 * 1000);

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
  await respira(page, 1600);

  /* 1 — da dove si parte. */
  await vaiA(page, "appliances");
  await scena(
    page,
    1,
    "Gli elettrodomestici, prima",
    "Ogni apparecchio si compilava a mano, una casella per volta: quale entita' e' la potenza, quale il tempo rimanente, quale la fase.",
    3200,
  );

  /* 2 — il menu delle integrazioni. */
  await page.evaluate(() => {
    window.apriConfigEntita();
    window.editorSwitch("appliances");
  });
  await respira(page, 1600);
  await scena(
    page,
    2,
    "«Aggiungi da un'integrazione»",
    "In cima alla scheda Elettrodomestici c'e' il tasto nuovo. Le entita' non si cercano piu' una per una.",
    3000,
  );
  await inVista(page, "#ed-body [data-dm-integ-add]");
  await tocca(page, "#ed-body [data-dm-integ-add]", 1800);

  await scena(
    page,
    3,
    "Le integrazioni di casa",
    "A sinistra quelle installate: chi viene dal catalogo ufficiale e chi da HACS lo dice il suo segno. A destra i loro dispositivi.",
    3400,
  );

  /* 3 — hOn, e i suoi dispositivi. */
  await tocca(page, '#dm-integ-menu .dm-integ-item[data-domain="hon"]', 1800);
  await scena(
    page,
    4,
    "I dispositivi, con marca e stanza",
    "Hoover H-WASH 500, in Lavanderia, undici entita'. La stanza la sa gia' Home Assistant: non c'e' niente da scrivere.",
    3400,
  );

  /* 4 — l'anteprima. */
  await tocca(page, '#dm-integ-menu .dm-integ-device[data-device-id="wm-1"]', 1800);
  await scena(
    page,
    5,
    "Cosa ha capito, prima di confermare",
    "Tipo, stanza, e le caselle assegnate: potenza, tempo rimanente, fase, contatore, tasto d'avvio. Le entita' si riconoscono in qualunque lingua sia Home Assistant.",
    4200,
  );

  /* 5 — l'apparecchio nasce compilato. */
  await tocca(page, "#dm-integ-menu [data-preview] [data-confirm]", 2200);
  await scena(
    page,
    6,
    "L'apparecchio e' gia' fatto",
    "La finestra di modifica si apre da sola, col blocco del collegamento: da quale integrazione viene, quale dispositivo e', e cosa gli e' stato assegnato.",
    4000,
  );
  await inVista(page, "#dm-appliance-editor-modal [data-binding]", 1600);
  await tocca(page, "#dm-appliance-editor-modal [data-close]", 1400);

  /* 6 — la seconda, per la scena dei watt che non ci sono. */
  await tocca(page, "#ed-body [data-dm-integ-add]", 1600);
  await tocca(page, '#dm-integ-menu .dm-integ-item[data-domain="hon"]', 1400);
  await tocca(page, '#dm-integ-menu .dm-integ-device[data-device-id="td-1"]', 1600);
  await scena(
    page,
    7,
    "L'asciugatrice, che i watt non li ha",
    "Nessuna presa smart sotto: nessun sensore di potenza. Sara' la parola del programma a dire se sta lavorando.",
    3600,
  );
  await tocca(page, "#dm-integ-menu [data-preview] [data-confirm]", 2000);
  await tocca(page, "#dm-appliance-editor-modal [data-close]", 1200);
  await chiudiLaConfigurazione(page);
  await respira(page, 1600);

  /* 7 — le card. */
  await vaiA(page, "appliances");
  await scena(
    page,
    8,
    "La card dice a che punto e' il ciclo",
    "Sotto il ritratto la fase in parole — Lavaggio — e accanto i gradi, i giri e il programma. Sono le parole che l'integrazione pubblica davvero, tradotte.",
    4200,
  );
  await inVista(page, ".dm-appl-card", 1600);

  await scena(
    page,
    9,
    "Senza watt, decide il programma",
    "L'asciugatrice non ha un sensore di potenza: e' IN FUNZIONE perche' la sua fase dice che sta asciugando. Pausa e avvio ritardato sono STANDBY, non SPENTO.",
    4200,
  );

  /* 8 — il dettaglio. */
  await tocca(page, ".dm-appl-card", 2400);
  await scena(
    page,
    10,
    "Il dettaglio: il dispositivo intero",
    "Si apre con la stessa card della sezione, e sotto tutto il resto diviso per famiglie: lo stato, le letture, i comandi coi loro tasti veri, la diagnostica in fondo.",
    4400,
  );
  await inVista(page, "#details-list", 1800);
  await page.evaluate(() => window.forceClose?.("details-modal"));
  await respira(page, 1400);

  /* 9 — la tessera in Home. */
  await vaiA(page, "home");
  await inVista(page, '#dm-widgets .dm-tile[data-dm-widget="elettrodomestici"]', 1400);
  await scena(
    page,
    11,
    "E in Home, la tessera",
    "Una pastiglia per ogni apparecchio, acceso o spento. Toccandone una si apre la sua card intera, una alla volta.",
    3600,
  );
  await tocca(page, '#dm-widgets .dm-tile[data-dm-widget="elettrodomestici"]', 2000);
  await tocca(page, "#dm-widget-popup [data-dm-appl-chip]", 2600);
  await respira(page, 2200);

  await scena(
    page,
    12,
    "Tutto questo senza scrivere un'entita'",
    "Dal menu delle integrazioni all'apparecchio finito. Chi le caselle le aveva compilate a mano non perde niente: quelle scritte non si toccano mai.",
    4600,
  );
  await respira(page, 1800);
});
