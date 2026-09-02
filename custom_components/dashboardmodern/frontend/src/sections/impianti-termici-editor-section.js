/* Cosa c'e' nel locale caldaia, e come si dice (#253).
 *
 * La scheda si chiamava «Solare» e chiedeva le caselle di un impianto solo.
 * Ma l'acqua calda in casa la fanno tre macchine — il sole, una resistenza,
 * una caldaia a gas — e quasi nessuno ne ha una sola. Chi ha il fotovoltaico e
 * lo scaldabagno compilava caselle che parlavano di un pannello che non ha.
 *
 * La scheda comincia percio' da una domanda sola: cosa c'e'. Da li' in giu'
 * compaiono soltanto le caselle di quello che si e' spuntato — e la pagina, di
 * la', prende la stessa forma. Chi ne spunta due o tre trova in cima alla
 * pagina le linguette per passare dall'una all'altra.
 *
 * Le caselle del solare restano dove sono, nel guscio: sono quelle di sempre e
 * cambiarle di posto vorrebbe dire spostare la configurazione di chi ce l'ha
 * gia'. Qui si aggiunge quello che prima non c'era.
 *
 * E si aggiunge diviso. «La sezione solare termico non e' suddivisa con le
 * altre cose aggiunte, caldaia e scaldabagno: nel config voglio le
 * sottosezioni per configurare quelle, non creare confusione.» Era una colonna
 * sola: tredici caselle di pannelli solari, poi lo scaldabagno, poi la
 * caldaia, tutto di seguito, e chi cercava la sua macchina scorreva quelle
 * degli altri. Adesso in cima ci sono le stesse linguette che ha la pagina —
 * una per macchina scelta — e sotto c'e' soltanto quella accesa. Le caselle
 * del solare, che sono del guscio, vengono portate dentro la loro: restano le
 * sue, cambia la stanza.
 */
import {
  CASELLE_CALDAIA,
  CHIAVE_CALDAIA,
  CHIAVE_IMPIANTI,
  ETICHETTE_TERMICHE,
  TIPI_TERMICI,
  normalizzaCaldaia,
  servonoLinguette,
} from "../core/impianti-termici.js";
import {
  SCALDABAGNI_KEY,
  isWaterHeaterEntity,
  suggerisciScaldabagni,
} from "../core/scaldabagno-model.js";
import { impiantiDiCasa, renderImpiantiTermici } from "./impianti-termici-section.js";
import { renderHomeWidgets } from "./home-widgets-section.js";
import {
  allStates,
  clean,
  doc,
  esc,
  installStyle,
  onEditorRedraw,
  readJson,
  root,
  t,
  wrapFunction,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_IMPIANTI_TERMICI_EDITOR__";
const state = (root[KEY] ||= { installed: false, aperto: -1, firma: "", linguetta: "" });

/* La scheda del solare del guscio: e' li' che questa roba deve comparire,
 * perche' e' li' che chi configura va a cercare l'acqua calda. */
const SCHEDA = "sez3";

function schedaAttiva() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

/* ── la domanda che viene prima di tutte ──────────────────────────────── */

const AIUTI = Object.freeze({
  solare: [
    "Pannelli sul tetto e accumulo: le caselle sono quelle qui sotto.",
    "Roof collectors and a tank: the fields are the ones below.",
  ],
  scaldabagno: [
    "Uno scaldabagno elettrico, anche alimentato dal fotovoltaico.",
    "An electric water heater, fed by the PV plant or not.",
  ],
  caldaia: [
    "Una caldaia a gas: mandata, ritorno e pressione del circuito.",
    "A gas boiler: flow, return and circuit pressure.",
  ],
});

function scelta() {
  const stored = readJson(CHIAVE_IMPIANTI, null);
  const scelti = new Set(impiantiDiCasa());
  return { stored, acceso: (tipo) => scelti.has(tipo) };
}

function salvaScelta(tipo, acceso) {
  const attuali = new Set(impiantiDiCasa());
  if (acceso) attuali.add(tipo);
  else attuali.delete(tipo);
  writeJsonIfChanged(
    CHIAVE_IMPIANTI,
    Object.fromEntries(TIPI_TERMICI.map((voce) => [voce, attuali.has(voce)])),
  );
  try {
    renderImpiantiTermici();
  } catch (_error) {}
  try {
    renderHomeWidgets();
  } catch (_error) {}
}

function sceltaMarkup() {
  const { acceso } = scelta();
  return `<div class="ed-sec-title dm-it-ed-sep">🔥 ${esc(t("Cosa c'è nel locale caldaia", "What is in the boiler room"))}</div>
  <div class="ed-intro">${esc(
    t(
      "Spunta quello che hai davvero: la pagina mostra solo quello, e con due o tre compaiono in alto le linguette per passare dall'uno all'altro.",
      "Tick what you actually have: the page shows only that, and with two or three the tabs appear at the top to switch between them.",
    ),
  )}</div>
  <div class="ed-list dm-it-ed-scelte">${TIPI_TERMICI.map(
    (tipo) => `<div class="ed-row dm-it-ed-scelta" data-dm-it-tipo="${esc(tipo)}">
      <span class="ed-row-main">
        <strong class="ed-row-new">${esc(t(...ETICHETTE_TERMICHE[tipo]))}</strong>
        <small class="ed-row-old">${esc(t(...AIUTI[tipo]))}</small>
      </span>
      <button type="button" class="dm-it-ed-lev" data-dm-it-scelta="${esc(tipo)}"
        data-on="${acceso(tipo)}" aria-pressed="${acceso(tipo)}"
        aria-label="${esc(t(...ETICHETTE_TERMICHE[tipo]))}"><i></i></button>
    </div>`,
  ).join("")}</div>`;
}

/* ── la caldaia ───────────────────────────────────────────────────────── */

const CAMPI_CALDAIA = Object.freeze({
  stato: [
    ["Stato della caldaia", "Boiler state"],
    "binary_sensor.caldaia",
    ["Da solo basta: acceso e spento, senza numeri.", "Enough on its own: on and off, no numbers."],
  ],
  fiamma: [["Bruciatore acceso", "Burner on"], "binary_sensor.caldaia_fiamma"],
  mandata: [["Temperatura di mandata", "Flow temperature"], "sensor.caldaia_mandata"],
  ritorno: [["Temperatura di ritorno", "Return temperature"], "sensor.caldaia_ritorno"],
  acquaCalda: [["Acqua calda sanitaria", "Domestic hot water"], "sensor.caldaia_acs"],
  pressione: [["Pressione del circuito (bar)", "Circuit pressure (bar)"], "sensor.caldaia_pressione"],
  modulazione: [["Modulazione (%)", "Modulation (%)"], "sensor.caldaia_modulazione"],
});

function caldaia() {
  return normalizzaCaldaia(readJson(CHIAVE_CALDAIA, {}));
}

function salvaCaldaia(config) {
  writeJsonIfChanged(CHIAVE_CALDAIA, config);
  try {
    renderImpiantiTermici();
  } catch (_error) {}
}

function caldaiaMarkup() {
  const config = caldaia();
  const campi = CASELLE_CALDAIA.map(({ campo }) => {
    const [etichetta, esempio, aiuto] = CAMPI_CALDAIA[campo];
    const id = `dm-caldaia-${campo}`;
    return `<label class="ed-slot dm-todo-ed-field"><span class="ed-slot-lbl">${esc(t(...etichetta))}</span>
      <span class="ed-form-row"><input id="${id}" class="ed-input mono" data-dm-caldaia-field="${esc(campo)}"
        value="${esc(config[campo])}" placeholder="${esc(esempio)}" autocomplete="off" spellcheck="false"><button
        type="button" class="dm-entity-picker" data-dm-caldaia-pick="${id}"
        aria-label="${t("Scegli entità", "Choose entity")}">🔍</button></span>${
          aiuto ? `<small>${esc(t(...aiuto))}</small>` : ""
        }</label>`;
  }).join("");
  return `<div class="ed-sec-title dm-it-ed-sep">🔥 ${esc(t("Caldaia", "Boiler"))}</div>
  <div class="ed-intro">${esc(
    t(
      "La differenza fra mandata e ritorno dice se l'impianto sta davvero cedendo calore; la pressione è l'unica cosa che ogni tanto va rabboccata a mano. Nessuna casella è obbligatoria: col solo stato la scheda mostra la caldaia accesa o spenta, senza numeri che non ha.",
      "The gap between flow and return says whether the circuit is really giving off heat; pressure is the one thing that occasionally needs topping up by hand. No field is required: with just the state the card shows the boiler on or off, without numbers it does not have.",
    ),
  )}</div>
  <div class="ed-list dm-todo-ed-list">
    <article class="ed-row dm-todo-ed-row" data-open="true">
      <div class="dm-todo-ed-body">
        <label class="ed-slot dm-todo-ed-field"><span class="ed-slot-lbl">${esc(t("Nome", "Name"))}</span><span class="ed-form-row"><input id="dm-caldaia-name" class="ed-input" data-dm-caldaia-field="name" value="${esc(config.name)}" placeholder="${esc(t("Caldaia a condensazione", "Condensing boiler"))}"></span></label>
        ${campi}
        <button type="button" class="ed-save-btn" data-dm-caldaia-save>💾 ${esc(t("Salva caldaia", "Save boiler"))}</button>
      </div>
    </article>
  </div>`;
}

/* ── lo scaldabagno elettrico (#253) ──────────────────────────────────── */

/* Le righe grezze: come per le altre, una riga appena aggiunta e' vuota e va
 * lasciata compilare prima di giudicarla. */
function scaldabagni() {
  const stored = readJson(SCALDABAGNI_KEY, []);
  return Array.isArray(stored) ? stored : [];
}

function salvaScaldabagni(voci) {
  writeJsonIfChanged(SCALDABAGNI_KEY, voci);
  try {
    renderHomeWidgets();
  } catch (_error) {}
}

/* Le sei caselle, in ordine di quanto servono.
 *
 * La prima da sola basta a chi ha un `water_heater.*`: quell'entita' dichiara
 * stato, temperatura e obiettivo tutti insieme. Le altre sono per chi lo
 * scaldabagno se l'e' messo insieme da un rele' e due sonde, che e' il caso di
 * chi ha aperto la segnalazione. Nessuna e' obbligatoria: la tessera mostra
 * quello che trova. */
function caselleScaldabagno(index, voce) {
  return [
    [
      "entity",
      t("Scaldabagno di Home Assistant", "Home Assistant water heater"),
      "water_heater.boiler",
      t(
        "Se ce l'hai, basta questa: stato, temperatura e obiettivo li dichiara lei.",
        "If you have one, this is enough: it declares state, temperature and target itself.",
      ),
    ],
    [
      "interruttore",
      t("Interruttore della resistenza", "Heating element switch"),
      "switch.scaldabagno",
      t(
        "Da solo basta: la scheda dice acceso e spento, e non finge di sapere i gradi.",
        "Enough on its own: the card says on and off, and does not pretend to know the degrees.",
      ),
    ],
    [
      "temperatura",
      t("Temperatura dell'acqua", "Water temperature"),
      "sensor.scaldabagno_temperatura",
      "",
    ],
    [
      "obiettivo",
      t("Obiettivo", "Target"),
      "number.scaldabagno_target",
      t(
        "Un number, un climate o un water_heater: dal termostato si legge il suo obiettivo.",
        "A number, a climate or a water_heater: the target is read from the thermostat.",
      ),
    ],
    ["potenza", t("Consumo (W)", "Power (W)"), "sensor.scaldabagno_potenza", ""],
    [
      "energia",
      t("Energia di oggi (kWh)", "Energy today (kWh)"),
      "sensor.scaldabagno_energia_oggi",
      "",
    ],
  ].map(([campo, etichetta, esempio, aiuto]) => {
    const id = `dm-scald-${index}-${campo}`;
    return `<label class="ed-slot dm-todo-ed-field"><span class="ed-slot-lbl">${esc(etichetta)}</span>
      <span class="ed-form-row"><input id="${id}" class="ed-input mono" data-scald-field="${campo}"
        value="${esc(clean(voce?.[campo]))}" placeholder="${esc(esempio)}" autocomplete="off" spellcheck="false"><button
        type="button" class="dm-entity-picker" data-scald-pick="${id}"
        aria-label="${t("Scegli entità", "Choose entity")}">🔍</button></span>${
          aiuto ? `<small>${esc(aiuto)}</small>` : ""
        }</label>`;
  }).join("");
}

function rigaScaldabagnoMarkup(voce, index) {
  const aperto = state.aperto === index;
  const nome =
    clean(voce?.name) ||
    clean(voce?.entity) ||
    `${t("Scaldabagno", "Water heater")} ${index + 1}`;
  const sotto =
    clean(voce?.entity) || clean(voce?.interruttore) || t("nessuna entità", "no entity");
  return `<article class="ed-row dm-todo-ed-row dm-scald-row" data-scald-index="${index}" data-open="${aperto}">
    <div class="dm-todo-ed-head">
      <span class="dm-todo-ed-icon" aria-hidden="true">🚿</span>
      <span class="ed-row-main"><strong class="ed-row-new">${esc(nome)}</strong><small class="ed-row-old mono">${esc(sotto)}</small></span>
      <button type="button" class="ed-del dm-todo-ed-edit" data-scald-edit aria-label="${t("Modifica", "Edit")}">✏️</button>
      <button type="button" class="ed-del dm-todo-ed-del" data-scald-del aria-label="${t("Elimina", "Remove")}">🗑️</button>
    </div>
    <div class="dm-todo-ed-body"${aperto ? "" : " hidden"}>
      <label class="ed-slot dm-todo-ed-field"><span class="ed-slot-lbl">${t("Nome", "Name")}</span><span class="ed-form-row"><input id="dm-scald-${index}-name" class="ed-input" data-scald-field="name" value="${esc(clean(voce?.name))}" placeholder="${t("Bagno grande", "Main bathroom")}"></span></label>
      ${caselleScaldabagno(index, voce)}
      <output class="dm-todo-ed-error" data-scald-error></output>
      <button type="button" class="ed-save-btn" data-scald-save>💾 ${t("Salva scaldabagno", "Save water heater")}</button>
    </div>
  </article>`;
}

function scaldabagnoMarkup() {
  const voci = scaldabagni();
  return `<div class="ed-sec-title dm-widget-ed-sep">🚿 ${esc(t("Scaldabagno", "Water heater"))}</div>
  <div class="ed-intro">${t(
    "Lo scaldabagno elettrico, per chi l'acqua calda non la fa col sole: la tessera dice a che punto è l'acqua e quanto manca all'obiettivo. Con un water_heater di Home Assistant basta la prima casella.",
    "The electric water heater, for whoever does not make hot water with the sun: the tile says where the water is and how far it is from the target. With a Home Assistant water_heater the first field is enough.",
  )}</div>
  <div class="ed-list dm-todo-ed-list dm-scald-list">${
    voci.length
      ? voci.map((voce, index) => rigaScaldabagnoMarkup(voce, index)).join("")
      : `<div class="ed-empty">${t("Nessuno scaldabagno configurato", "No water heater configured")}</div>`
  }</div>
  <button type="button" class="ed-btn-add" data-scald-add>＋ ${t("Aggiungi scaldabagno", "Add water heater")}</button>
  <button type="button" class="ed-btn-add" data-scald-detect>🪄 ${t("Rileva da Home Assistant", "Detect from Home Assistant")}</button>`;
}


/* ── il disegno della scheda ──────────────────────────────────────────── */

/* I disegnini delle linguette: gli stessi della pagina, perche' sono le stesse
 * tre macchine e riconoscerle due volte in due modi e' una cosa in piu' da
 * imparare. */
const ICONE_LINGUETTA = Object.freeze({
  solare: "🌞",
  scaldabagno: "🚿",
  caldaia: "🔥",
});

/* Quale macchina si sta configurando adesso.
 *
 * Quella scelta l'ultima volta, se e' ancora fra quelle che ci sono: chi toglie
 * la spunta alla macchina che stava guardando non deve restare su una scheda
 * vuota. Altrimenti la prima. */
function linguettaAttiva(scelti) {
  if (!scelti.length) return "";
  const scelta = clean(state.linguetta);
  return scelti.includes(scelta) ? scelta : scelti[0];
}

function linguetteMarkup(scelti, attiva) {
  if (!servonoLinguette(scelti)) return "";
  return `<div class="dm-it-ed-strip" role="tablist">${scelti
    .map(
      (tipo) => `<button type="button" class="dm-it-ed-tab" data-dm-it-ed-tab="${esc(tipo)}"
        role="tab" aria-selected="${tipo === attiva}"${tipo === attiva ? ' data-on="true"' : ""}>
        <span aria-hidden="true">${ICONE_LINGUETTA[tipo] || ""}</span>
        <span>${esc(t(...ETICHETTE_TERMICHE[tipo]))}</span>
      </button>`,
    )
    .join("")}</div>`;
}

/* Il pannello della macchina accesa. Il solare non ha markup suo: le sue
 * caselle sono quelle del guscio, e qui si prepara soltanto il posto dove
 * andranno a stare. */
function pannelloMarkup(attiva) {
  if (attiva === "solare") return `<div class="dm-it-ed-pannello" data-dm-it-ed-posto="solare"></div>`;
  if (attiva === "scaldabagno")
    return `<div class="dm-it-ed-pannello">${scaldabagnoMarkup()}</div>`;
  if (attiva === "caldaia") return `<div class="dm-it-ed-pannello">${caldaiaMarkup()}</div>`;
  return "";
}

function corpoMarkup() {
  const scelti = impiantiDiCasa();
  const attiva = linguettaAttiva(scelti);
  return `<div class="dm-it-ed">${sceltaMarkup()}${linguetteMarkup(scelti, attiva)}${pannelloMarkup(attiva)}</div>`;
}

/* Le caselle del solare, che il guscio disegna da se'.
 *
 * Sono l'unico accordion rimasto in piedi su questa scheda: `edFilterSez`
 * nasconde con uno stile in linea quelli delle altre sezioni, e chi tiene in
 * ordine la configurazione li porta via. Si riconosce percio' da quello che
 * NON ha addosso, e non dal titolo, che cambia con la lingua e col nome che la
 * sezione si e' presa. */
function caselleDelSolare(body) {
  return (
    [...body.querySelectorAll(":scope details.ed-acc")].find(
      (nodo) => nodo.style.display !== "none",
    ) || null
  );
}

export function ensureImpiantiTermiciEditor() {
  const body = doc?.getElementById("ed-body");
  if (!body || schedaAttiva() !== SCHEDA) return false;
  const scelti = impiantiDiCasa();
  const attiva = linguettaAttiva(scelti);
  const firma = JSON.stringify([scelti, attiva, state.aperto, scaldabagni(), caldaia()]);
  let blocco = body.querySelector(":scope > .dm-it-ed");
  const caselle = caselleDelSolare(body);
  if (blocco && firma === state.firma && (attiva !== "solare" || caselle?.closest(".dm-it-ed"))) {
    sistemaLeCaselleDelSolare(body, attiva);
    return true;
  }
  state.firma = firma;
  /* Le caselle del solare si mettono in salvo PRIMA di rifare il blocco.
   *
   * Sono un nodo del guscio che noi ospitiamo: quando la linguetta accesa era
   * il solare stavano dentro il blocco, e rifare il blocco le buttava via
   * insieme a lui — si passava a «Scaldabagno», si tornava indietro, e le
   * tredici caselle non c'erano piu'. Tornano figlie del corpo della scheda
   * per il tempo del ricambio, e da li' le riprende chi le sistema. */
  if (caselle && caselle.parentElement !== body) body.append(caselle);
  const guscio = doc.createElement("div");
  guscio.innerHTML = corpoMarkup();
  const nuovo = guscio.firstElementChild;
  if (blocco) blocco.replaceWith(nuovo);
  /* In fondo alla scheda: sopra resta la fascia della visibilita', che e' del
   * guscio e sta in cima a ogni scheda. */
  else body.append(nuovo);
  sistemaLeCaselleDelSolare(body, attiva);
  return true;
}

/* Le caselle del solare vanno dove sta la linguetta accesa.
 *
 * Sono un nodo del guscio, non un pezzo di markup nostro: non si copiano — si
 * spostano, o le si perderebbe la memoria di cosa c'e' scritto dentro mentre
 * lo si sta scrivendo. Quando la linguetta accesa e' un'altra, o il solare non
 * e' nemmeno fra le macchine scelte, restano nel documento ma non si vedono:
 * con `hidden` e non con uno stile in linea, perche' chi tiene in ordine la
 * configurazione porta via gli accordion che trova con `display:none` addosso,
 * e questo dovra' tornare. */
function sistemaLeCaselleDelSolare(body, attiva) {
  const caselle = caselleDelSolare(body) || body.querySelector(":scope details.ed-acc");
  if (!caselle) return false;
  const posto = body.querySelector('[data-dm-it-ed-posto="solare"]');
  if (posto) {
    if (caselle.parentElement !== posto) posto.append(caselle);
    caselle.hidden = false;
    caselle.open = true;
    return true;
  }
  caselle.hidden = true;
  return true;
}

function ridisegna() {
  state.firma = "";
  ensureImpiantiTermiciEditor();
}

function onClick(event) {
  const body = doc?.getElementById("ed-body");
  if (!body || !body.contains(event.target)) return;

  /* ── le linguette delle macchine ── */
  const linguetta = event.target.closest("[data-dm-it-ed-tab]");
  if (linguetta) {
    event.preventDefault();
    state.linguetta = clean(linguetta.dataset.dmItEdTab);
    ridisegna();
    return;
  }

  /* ── la scelta ── */
  const leva = event.target.closest("[data-dm-it-scelta]");
  if (leva) {
    event.preventDefault();
    const tipo = clean(leva.dataset.dmItScelta);
    salvaScelta(tipo, leva.dataset.on !== "true");
    ridisegna();
    return;
  }

  /* ── la caldaia ── */
  const pickCaldaia = event.target.closest("[data-dm-caldaia-pick]");
  if (pickCaldaia) {
    event.preventDefault();
    const input = body.querySelector(`#${CSS.escape(clean(pickCaldaia.dataset.dmCaldaiaPick))}`);
    if (input) root.wzPickEntity?.(input);
    return;
  }
  if (event.target.closest("[data-dm-caldaia-save]")) {
    event.preventDefault();
    const next = { ...caldaia() };
    for (const campo of body.querySelectorAll("[data-dm-caldaia-field]"))
      next[clean(campo.dataset.dmCaldaiaField)] = clean(campo.value);
    salvaCaldaia(next);
    ridisegna();
    root.edToast?.(t("💾 Caldaia salvata", "💾 Boiler saved"));
    return;
  }

  /* ── il blocco «Scaldabagno» (#253) ── */
  if (event.target.closest("[data-scald-add]")) {
    event.preventDefault();
    const voci = scaldabagni();
    state.aperto = voci.length;
    salvaScaldabagni([...voci, { name: "", entity: "" }]);
    ridisegna();
    return;
  }
  if (event.target.closest("[data-scald-detect]")) {
    event.preventDefault();
    /* Cio' che Home Assistant sa gia' non si riscrive a mano: le entita'
     * `water_heater.*` che non sono ancora nell'elenco entrano da sole, col
     * nome che hanno di la'. */
    const voci = scaldabagni();
    const trovati = suggerisciScaldabagni(allStates(), voci);
    if (!trovati.length) {
      root.edToast?.(t("Nessuno scaldabagno nuovo", "No new water heater"));
      return;
    }
    salvaScaldabagni([
      ...voci,
      ...trovati.map((trovato) => ({ name: trovato.name, entity: trovato.entity })),
    ]);
    ridisegna();
    root.edToast?.(t("🪄 Scaldabagni aggiunti", "🪄 Water heaters added"));
    return;
  }
  const pickScald = event.target.closest("[data-scald-pick]");
  if (pickScald) {
    event.preventDefault();
    const input = body.querySelector(`#${CSS.escape(clean(pickScald.dataset.scaldPick))}`);
    if (input) root.wzPickEntity?.(input);
    return;
  }
  const rigaScald = event.target.closest("[data-scald-index]");
  if (rigaScald) {
    const voci = scaldabagni();
    const index = Number(rigaScald.dataset.scaldIndex);
    if (!Number.isFinite(index) || !voci[index]) return;
    if (event.target.closest("[data-scald-edit]")) {
      event.preventDefault();
      state.aperto = state.aperto === index ? -1 : index;
      ridisegna();
      return;
    }
    if (event.target.closest("[data-scald-del]")) {
      event.preventDefault();
      const nome = clean(voci[index]?.name) || clean(voci[index]?.entity) || `${index + 1}`;
      const domanda = t(`Tolgo "${nome}"?`, `Remove "${nome}"?`);
      if (root.confirm && !root.confirm(domanda)) return;
      state.aperto = -1;
      salvaScaldabagni(voci.filter((_voce, position) => position !== index));
      ridisegna();
      return;
    }
    if (event.target.closest("[data-scald-save]")) {
      event.preventDefault();
      const next = voci.slice();
      const letta = { ...voci[index] };
      for (const campo of rigaScald.querySelectorAll("[data-scald-field]"))
        letta[clean(campo.dataset.scaldField)] = clean(campo.value);
      const errore = rigaScald.querySelector("[data-scald-error]");
      /* Una riga senza nemmeno una casella non ha niente da mostrare, e in
       * Home diventerebbe una tessera vuota. Basta UNA: quale, lo decide chi
       * configura — con un water_heater e' la prima, con un rele' e due sonde
       * sono le altre. */
      const caselle = ["entity", "interruttore", "temperatura", "obiettivo", "potenza", "energia"];
      if (!caselle.some((campo) => clean(letta[campo]))) {
        if (errore)
          errore.textContent = t("Serve almeno un'entità.", "At least one entity is required.");
        return;
      }
      /* La prima casella vuole proprio un water_heater: e' quella che si porta
       * dietro stato, temperatura e obiettivo insieme, e scriverci un sensore
       * qualunque darebbe una scheda che non risponde. */
      if (clean(letta.entity) && !isWaterHeaterEntity(letta.entity)) {
        if (errore)
          errore.textContent = t(
            "La prima casella vuole un water_heater.*; le sonde vanno nelle caselle sotto.",
            "The first field wants a water_heater.*; put probes in the fields below.",
          );
        return;
      }
      if (errore) errore.textContent = "";
      next[index] = letta;
      state.aperto = -1;
      salvaScaldabagni(next);
      ridisegna();
      root.edToast?.(t("💾 Scaldabagno salvato", "💾 Water heater saved"));
    }
    return;
  }

}

function installStyles() {
  installStyle(
    "dm-impianti-termici-editor-style",
    `
      #ed-body .dm-it-ed-sep{margin-top:24px;padding-top:16px;
        border-top:1px solid var(--card-border,#e2e8f0)}
      #ed-body .dm-it-ed-scelte{display:grid;gap:8px;margin-bottom:6px}
      #ed-body .dm-it-ed-scelta{display:flex!important;align-items:center;gap:12px;
        padding:12px 14px!important}
      #ed-body .dm-it-ed-scelta .ed-row-main{flex:1;min-width:0;display:grid;gap:2px}
      #ed-body .dm-it-ed-scelta .ed-row-old{opacity:1;color:var(--text-dim,#64748b);
        font-size:12px;font-weight:600;white-space:normal}
      /* La stessa levetta delle tessere in Home: e' lo stesso gesto — «questa
         cosa c'e' oppure no» — e due forme per lo stesso gesto sono una forma
         di troppo da imparare. */
      #ed-body .dm-it-ed-lev{
        flex:0 0 46px;width:46px;height:26px;position:relative;border:0;border-radius:999px;
        cursor:pointer;background:color-mix(in srgb,var(--text-dim,#94a3b8) 32%,transparent);
        transition:background .25s ease}
      #ed-body .dm-it-ed-lev i{
        position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;
        box-shadow:0 2px 6px rgba(15,23,42,.25);transition:transform .25s cubic-bezier(.16,1,.3,1)}
      #ed-body .dm-it-ed-lev[data-on="true"]{background:linear-gradient(135deg,#fb923c,#ea580c)}
      #ed-body .dm-it-ed-lev[data-on="true"] i{transform:translateX(20px)}
      /* ── le linguette delle macchine ──────────────────────────────────
         Stessa forma di quelle della pagina, in piccolo: e' lo stesso gesto
         sulla stessa scelta, e due forme per la stessa cosa sono una forma di
         troppo da imparare. */
      #ed-body .dm-it-ed-strip{
        display:flex;gap:6px;padding:5px;margin:16px 0 4px;border-radius:16px;
        background:var(--bg-sculpted,#f0f4f8);border:1px solid var(--card-border,#e2e8f0)}
      #ed-body .dm-it-ed-tab{
        flex:1 1 0;display:inline-flex;align-items:center;justify-content:center;gap:7px;
        padding:10px 10px;border:0;border-radius:12px;background:transparent;cursor:pointer;
        font:inherit;font-size:11.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
        color:var(--text-dim,#64748b);
        transition:background .25s ease,color .25s ease,box-shadow .25s ease}
      #ed-body .dm-it-ed-tab:hover{background:rgba(255,255,255,.7)}
      #ed-body .dm-it-ed-tab[data-on="true"]{
        background:linear-gradient(135deg,#fb923c,#ea580c);color:#fff;
        box-shadow:0 8px 20px -8px rgba(234,88,12,.75)}
      /* Il pannello della macchina accesa: il primo titolo non ha il filo
         sopra, perche' il filo separava due macchine incolonnate e adesso ce
         n'e' una sola alla volta. */
      /* Il primo titolo del blocco non ha il filo sopra: quel filo separava
         due macchine incolonnate, e adesso in colonna non c'e' piu' niente da
         separare — sopra c'e' solo la fascia della sezione. */
      #ed-body .dm-it-ed > .ed-sec-title:first-child,
      #ed-body .dm-it-ed-pannello > .ed-sec-title:first-child{
        margin-top:14px;padding-top:0;border-top:0}
      /* Le caselle del solare in riposo: sparite ma ancora nel documento.
         Con uno stile in linea le porterebbe via chi tiene in ordine la
         configurazione — toglie gli accordion che trova con display:none
         addosso — e quando la linguetta torna sul solare non ci sarebbe piu'
         niente da rimettere. L'attributo non lascia stile in linea; la regola
         serve perche' il vestito del guscio darebbe comunque un display a
         quel nodo, e vincerebbe lui. */
      #ed-body details.ed-acc[hidden]{display:none!important}
      @media(max-width:560px){
        #ed-body .dm-it-ed-tab{font-size:10.5px;padding:9px 6px;letter-spacing:.03em}
      }
    `,
  );
}

export function installImpiantiTermiciEditor() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  doc.addEventListener("click", onClick);
  wrapFunction("apriConfigEntita", "__dmImpiantiTermiciEditor", () => ensureImpiantiTermiciEditor());
  onEditorRedraw("__dmImpiantiTermiciEditor", () => {
    root.queueMicrotask?.(() => ensureImpiantiTermiciEditor());
  });
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:editor-rendered"])
    root.addEventListener?.(evento, () => {
      root.queueMicrotask?.(() => ensureImpiantiTermiciEditor());
    });
  ensureImpiantiTermiciEditor();
  return true;
}

installImpiantiTermiciEditor();
