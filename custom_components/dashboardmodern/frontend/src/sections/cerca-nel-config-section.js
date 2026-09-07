/* La riga per cercare, in cima alla configurazione.
 *
 * «Implementa una funzione cerca che possa cercare all'interno di tutto il
 * config quella parola, così da velocizzare le modifiche e le
 * configurazioni.»
 *
 * Le schede sono venti e ognuna si disegna solo quando la si apre: per sapere
 * dove sta scritto un sensore bisognava aprirle tutte. Qui si scrive la parola
 * una volta e si vede subito ogni posto in cui compare — la scheda, la riga, il
 * campo e cosa c'e' scritto. Un tocco sul risultato apre quella scheda.
 *
 * Non si cerca nel disegno: si cerca nel magazzino, che e' JSON e si cammina
 * (vedi `core/cerca-nel-config.js`). Cercare aprendo le schede vorrebbe dire
 * ridisegnarle tutte, e un modulo aperto a meta' perde quello che si stava
 * scrivendo dentro.
 */
import { cercaNelConfig } from "../core/cerca-nel-config.js";
import { SECTION_KEYS } from "../core/migrations.js";
import { CONFIG_KEYS } from "./config-persistence-section.js";
import { clean, doc, esc, installStyle, onEditorRedraw, readJson, root, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_CERCA_CONFIG__";
const state = (root[KEY] ||= { installed: false, parola: "", aperta: false });

const BARRA = "dm-cerca-config";
const STILE = "dm-cerca-config-style";

/* Dove si va a mettere le mani, casella per casella.
 *
 * Il nome della scheda non si scrive qui: si legge dalla linguetta, che ce
 * l'ha gia' nella lingua giusta. Qui c'e' solo la corrispondenza fra la
 * casella del magazzino e la linguetta che la governa. Una casella che non
 * compare in questa tabella si trova lo stesso — il risultato esce col nome
 * della casella e senza salto — perche' non trovare e' peggio che non saper
 * saltare. */
const SCHEDA_DELLA_CASELLA = Object.freeze({
  cd_stanze: "stanze",
  cd_stanze_entita: "stanze",
  cd_floors: "stanze",
  cd_luci: "luci",
  cd_luci_rooms: "luci",
  cd_luci_order: "luci",
  cd_appliances: "appliances",
  cd_lavatrice_programmi: "appliances",
  cd_loads: "sez1",
  cd_energy_model: "sez1",
  cd_flow_nodes: "sez1",
  cd_subloads_extra: "sez1",
  cd_subload_groups: "sez1",
  cd_gruppi_extra: "sez1",
  cd_costo_kwh: "sez1",
  cd_prezzo_immissione: "sez1",
  cd_ev_cars: "sez2",
  cd_ev_visual: "sez2",
  cd_solari: "sez3",
  cd_solare_scelto: "sez3",
  cd_cameras: "sez4",
  cd_centrali: "sez4",
  cd_centrale_scelta: "sez4",
  cd_antifurto_modi: "sez4",
  cd_security_doors: "doors",
  cd_clima_units: "sez9",
  cd_termico_caldo: "sez9",
  cd_clima_rapido: "sez9",
  cd_clima_rapido_unita: "sez9",
  cd_caldaia: "sez9",
  cd_scaldabagni: "sez9",
  cd_impianti_termici: "sez9",
  cd_quick_actions: "sez8",
  cd_tapparelle: "tapp",
  cd_tapparelle_soglia: "tapp",
  cd_umidita_soglia: "tapp",
  cd_piscina: "pool",
  cd_irrigazione: "irr",
  cd_avvisi_custom: "avvisi",
  cd_avvisi_icone: "avvisi",
  cd_avvisi_names_extra: "avvisi",
  cd_stati_invertiti: "avvisi",
  cd_allerte: "allerte",
  cd_animali: "animali",
  cd_robot: "robot",
  cd_prese: "prese",
  cd_people: "people",
  cd_todo: "todo",
  cd_ups: "ups",
  cd_calendari: "agenda",
  cd_rifiuti: "rifiuti",
  cd_media_player: "media",
  cd_sezioni_mie: "mie",
  cd_entita_mie: "entita",
  cd_widgets: "sez0",
  cd_home_blocchi: "sez0",
  cd_barra_casa: "sez0",
  cd_evidenza: "sez0",
  cd_entity_overrides: "sez6",
  cd_meteo_entita_proprie: "sez0",
  cd_radar_meteo: "sez0",
  cd_sections: "visib",
  cd_section_names: "visib",
  cd_branding: "visib",
});

/* Le sezioni dentro `dm_dashboard_state`, e la scheda che le governa.
 *
 * Quasi tutta la configurazione non sta piu' nelle caselle vecchie: sta nel
 * magazzino dei moduli, tutta insieme, sotto `sections`. Li' la scheda non si
 * ricava dal nome della casella — e' sempre la stessa — ma dal nome della
 * sezione in cui si e' finiti camminando. */
const SCHEDA_DELLA_SEZIONE = Object.freeze({
  rooms: "stanze",
  lights: "luci",
  appliances: "appliances",
  loads: "sez1",
  energy: "sez1",
  energyLoads: "sez1",
  ev: "sez2",
  cameras: "sez4",
  climate: "sez9",
  covers: "tapp",
  pool: "pool",
  irrigation: "irr",
  robots: "robot",
  sockets: "prese",
  entityOverrides: "sez6",
});

/* Le caselle vecchie che il magazzino dei moduli rispecchia.
 *
 * Le sezioni stanno in tutti e due i posti: in `dm_dashboard_state`, che e' la
 * fonte, e nella casella storica che il guscio continua a scrivere. Leggerle
 * tutte e due vorrebbe dire ogni elettrodomestico due volte nell'elenco dei
 * risultati. Si tiene la fonte. */
const RISPECCHIATE = new Set(Object.values(SECTION_KEYS));

/* Il magazzino, letto una volta per ricerca. */
function magazzino() {
  const fuori = {};
  const canonico = readJson("dm_dashboard_state", null);
  if (canonico) fuori.dm_dashboard_state = canonico;
  for (const chiave of CONFIG_KEYS) {
    if (chiave === "dm_dashboard_state") continue;
    if (canonico && RISPECCHIATE.has(chiave)) continue;
    const valore = readJson(chiave, null);
    if (valore !== null && valore !== undefined) fuori[chiave] = valore;
  }
  return fuori;
}

/* Quale scheda apre questo risultato.
 *
 * Dal magazzino dei moduli la dice la sezione in cui si e' finiti — il pezzo
 * di strada subito dopo `sections` — e dalle caselle vecchie la dice la
 * tabella qui sopra. Se nessuno dei due la sa, il risultato esce lo stesso
 * senza salto: non trovare e' peggio che non saper saltare. */
function schedaDelRisultato(esito) {
  if (esito.chiave === "dm_dashboard_state") {
    const dopo = esito.percorso?.indexOf?.("sections");
    const sezione = dopo >= 0 ? clean(esito.percorso[dopo + 1]) : "";
    return SCHEDA_DELLA_SEZIONE[sezione] || "";
  }
  return SCHEDA_DELLA_CASELLA[esito.chiave] || "";
}

/** Il nome della scheda come lo legge chi guarda: sta scritto sulla linguetta. */
function nomeDellaScheda(scheda) {
  const linguetta = scheda && doc?.querySelector?.(`.ed-tab[data-tab="${CSS.escape(scheda)}"]`);
  return clean(linguetta?.textContent) || "";
}

function linguette() {
  return doc?.querySelector?.(".ed-tab")?.parentElement || null;
}

function installaLoStile() {
  installStyle(
    STILE,
    `
    .${BARRA}{display:grid!important;gap:8px!important;padding:10px 12px!important;border-bottom:1px solid var(--divider-color,#e2e8f0)!important;background:var(--card-background-color,#fff)!important}
    .${BARRA}-riga{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:8px!important;align-items:center!important}
    .${BARRA}-in{width:100%!important;min-height:42px!important;box-sizing:border-box!important;padding:9px 12px!important;border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:12px!important;background:var(--secondary-background-color,#f8fafc)!important;color:inherit!important;font:inherit!important}
    .${BARRA}-via{min-height:42px!important;padding:0 14px!important;border:0!important;border-radius:12px!important;background:#94a3b8!important;color:#fff!important;font-weight:800!important;cursor:pointer!important}
    .${BARRA}-esiti{display:grid!important;gap:6px!important;max-height:44dvh!important;overflow-y:auto!important}
    /* Un display con l'important vince sull'attributo hidden: nascondere si
       dice qui, o l'elenco resta in pagina anche quando nessuno cerca. */
    .${BARRA} [hidden]{display:none!important}
    .${BARRA}-vuoto{padding:6px 2px!important;font-size:12.5px!important;color:var(--secondary-text-color,#64748b)!important}
    .${BARRA}-esito{display:grid!important;gap:2px!important;width:100%!important;padding:9px 12px!important;border:1px solid var(--divider-color,#e2e8f0)!important;border-radius:12px!important;background:var(--secondary-background-color,#f8fafc)!important;color:inherit!important;font:inherit!important;text-align:left!important;cursor:pointer!important}
    .${BARRA}-esito[data-salta="no"]{cursor:default!important}
    .${BARRA}-dove{font-size:11px!important;font-weight:800!important;letter-spacing:.02em!important;color:var(--secondary-text-color,#64748b)!important}
    .${BARRA}-testo{font-size:13.5px!important;font-weight:750!important;overflow-wrap:anywhere!important}
    .${BARRA}-testo mark{padding:0 1px!important;border-radius:3px!important;background:#fde68a!important;color:#0f172a!important}
    html[data-theme="dark"] .${BARRA}{background:var(--card-background-color,#111827)!important}
    `,
  );
}

/* La parola, evidenziata dentro il risultato: si vede subito perche' quella
 * riga e' uscita. */
function conLaParolaAccesa(testo, parola) {
  const dove = testo.toLowerCase().indexOf(parola.toLowerCase());
  if (dove < 0) return esc(testo);
  return `${esc(testo.slice(0, dove))}<mark>${esc(testo.slice(dove, dove + parola.length))}</mark>${esc(
    testo.slice(dove + parola.length),
  )}`;
}

function disegnaGliEsiti(contenitore, parola) {
  contenitore.textContent = "";
  if (clean(parola).length < 2) {
    contenitore.innerHTML = `<p class="${BARRA}-vuoto">${esc(
      t(
        "Scrivi almeno due lettere: si cerca in tutte le schede insieme.",
        "Type at least two letters: it searches every tab at once.",
      ),
    )}</p>`;
    return 0;
  }
  const esiti = cercaNelConfig(parola, magazzino());
  if (!esiti.length) {
    contenitore.innerHTML = `<p class="${BARRA}-vuoto">${esc(
      t("Nessuna configurazione contiene questa parola.", "No configuration contains this word."),
    )}</p>`;
    return 0;
  }
  for (const esito of esiti.slice(0, 60)) {
    const scheda = schedaDelRisultato(esito);
    const nome = nomeDellaScheda(scheda) || esito.chiave;
    const riga = doc.createElement("button");
    riga.type = "button";
    riga.className = `${BARRA}-esito`;
    riga.dataset.salta = scheda ? "si" : "no";
    /* «sections» e il nome inglese della sezione sono roba del magazzino: chi
     * legge vuole il nome della scheda, che la linguetta dice gia'. */
    const strada = clean(esito.dove)
      .split(" · ")
      .filter(
        (pezzo, indice, tutti) =>
          pezzo &&
          pezzo !== "sections" &&
          !(indice === tutti.indexOf("sections") + 1 && tutti.includes("sections")),
      )
      .join(" · ");
    const dove = [nome, strada, esito.campo].filter(Boolean).join(" · ");
    riga.innerHTML = `<span class="${BARRA}-dove">${esc(dove)}</span><span class="${BARRA}-testo">${conLaParolaAccesa(
      esito.testo,
      clean(parola),
    )}</span>`;
    if (scheda)
      riga.addEventListener("click", () => {
        try {
          root.editorSwitch?.(scheda);
        } catch (_errore) {}
      });
    contenitore.append(riga);
  }
  return esiti.length;
}

/* La barra sta sopra il corpo e sotto le linguette: e' della configurazione
 * intera, non della scheda aperta, quindi non se ne va quando si cambia
 * scheda. */
export function ensureBarraDiRicerca() {
  const strisce = linguette();
  const corpo = doc?.getElementById?.("ed-body");
  if (!strisce || !corpo) return false;
  installaLoStile();
  let barra = strisce.parentElement?.querySelector?.(`:scope > .${BARRA}`);
  if (barra) {
    /* Il guscio ridisegna il corpo a ogni cambio di scheda: la barra resta
     * dov'e', e con lei quello che si stava cercando. */
    if (barra.nextElementSibling !== corpo) corpo.before(barra);
    return false;
  }
  barra = doc.createElement("div");
  barra.className = BARRA;
  const campo = doc.createElement("input");
  campo.type = "search";
  campo.className = `${BARRA}-in`;
  campo.placeholder = t("Cerca in tutta la configurazione…", "Search the whole configuration…");
  campo.setAttribute("aria-label", t("Cerca nella configurazione", "Search the configuration"));
  campo.value = state.parola;
  const via = doc.createElement("button");
  via.type = "button";
  via.className = `${BARRA}-via`;
  via.textContent = t("Pulisci", "Clear");
  via.hidden = !state.parola;
  const riga = doc.createElement("div");
  riga.className = `${BARRA}-riga`;
  riga.append(campo, via);
  const esiti = doc.createElement("div");
  esiti.className = `${BARRA}-esiti`;
  esiti.hidden = !state.parola;
  barra.append(riga, esiti);
  corpo.before(barra);

  const ridisegna = () => {
    state.parola = clean(campo.value);
    via.hidden = !state.parola;
    esiti.hidden = !state.parola;
    if (state.parola) disegnaGliEsiti(esiti, state.parola);
  };
  campo.addEventListener("input", ridisegna);
  via.addEventListener("click", () => {
    campo.value = "";
    ridisegna();
    campo.focus();
  });
  if (state.parola) disegnaGliEsiti(esiti, state.parola);
  return true;
}

export function installCercaNelConfigSection() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installaLoStile();
  ensureBarraDiRicerca();
  /* La configurazione nasce quando la si apre, e si ridisegna a ogni cambio di
   * scheda: ci si rimette in coda a quel giro, che e' la strada con cui tutti
   * i moduli stanno dietro al guscio. */
  onEditorRedraw("__dmCercaNelConfig", () => ensureBarraDiRicerca());
  return true;
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", installCercaNelConfigSection, { once: true });
} else {
  installCercaNelConfigSection();
}
