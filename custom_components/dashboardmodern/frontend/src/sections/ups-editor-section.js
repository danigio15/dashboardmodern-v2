/* Dove si dichiara il gruppo di continuita' (#256).
 *
 * «Chiedo se c'e' la possibilita' di gestire un UPS: vedere se c'e' tensione o
 * no, lo stato della batteria e il carico.»
 *
 * Le caselle avevano una coda della scheda «Energia», perche' un UPS e' la
 * corrente di casa. Adesso hanno una scheda loro, e non per ordine: la
 * Continuita' ha una pagina sua nella barra, e una pagina senza una scheda e'
 * una voce che non si puo' nascondere — la fascia verde di «Energia» e' di
 * Energia, e toccarla spegneva l'altra. In cima a questa c'e' la sua.
 *
 * Nella scheda dei widget si sceglie SE mostrare la tessera; qui si dice COSA
 * guardare — che sono due domande diverse e vanno in due posti diversi.
 *
 * Nessuna casella e' obbligatoria e nemmeno tutte insieme servono. Chi ha NUT
 * ne compila una — lo stato — e quella stringa dice gia' rete e batteria
 * scarica; chi ha un UPS letto da un'integrazione qualunque compila le sonde
 * che ha. Quello che manca non si disegna.
 */
import {
  CASELLE_UPS,
  CAMPO_UID_UPS,
  CHIAVE_META_UPS,
  CHIAVE_UPS,
  elencoUps,
  nuovoUps,
  togliUps,
  upsDaSalvare,
} from "../core/ups-model.js";
import { renderHomeWidgets } from "./home-widgets-section.js";
import {
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

const KEY = "__DASHBOARDMODERN_UPS_EDITOR__";
const state = (root[KEY] ||= { installed: false, firma: "" });

export const UPS_EDITOR_TAB = "ups";

/* La chiave con cui la sezione si accende e si spegne: la stessa che legge la
 * pagina della continuita', o si scriverebbe una preferenza che nessuno
 * guarda. */
const CHIAVE_SEZIONE = "ups";

function schedaAttiva() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

/* Le caselle, in ordine di quanto servono.
 *
 * La prima da sola basta a chi ha NUT: quella stringa — «OL», «OB DISCHRG» —
 * dice gia' se la rete c'e' e se la batteria e' scarica, e non c'e' niente da
 * tradurre a mano. Le altre sono per chi l'UPS lo legge da un'integrazione che
 * espone un sensore per cosa. */
const CAMPI_UPS = Object.freeze({
  stato: [
    ["Stato dell'UPS", "UPS status"],
    "sensor.ups_status",
    [
      "Da sola basta: le sigle di NUT — OL in linea, OB a batteria, LB batteria scarica — le legge lei.",
      "Enough on its own: it reads the NUT codes — OL on line, OB on battery, LB low battery.",
    ],
  ],
  rete: [
    ["Presenza rete", "Mains present"],
    "binary_sensor.ups_rete",
    [
      "Un sensore acceso/spento, se ce l'hai separato dallo stato.",
      "An on/off sensor, if you have one separate from the status.",
    ],
  ],
  batteria: [["Carica della batteria (%)", "Battery charge (%)"], "sensor.ups_battery_charge"],
  carico: [["Carico (%)", "Load (%)"], "sensor.ups_load"],
  autonomia: [
    ["Autonomia (minuti)", "Runtime (minutes)"],
    "sensor.ups_runtime",
    [
      "Quando la rete cade è il numero grande della tessera: è il tempo che resta.",
      "When mains drops this is the tile's big number: it is the time left.",
    ],
  ],
  tensione: [["Tensione di rete (V)", "Input voltage (V)"], "sensor.ups_input_voltage"],
  potenza: [["Potenza assorbita (W)", "Power draw (W)"], "sensor.ups_power"],
  temperatura: [["Temperatura", "Temperature"], "sensor.ups_temperature"],
});

/* I gruppi configurati. Ne esisteva uno solo, scritto come un oggetto: chi lo
 * ha se lo ritrova primo della fila, senza dover toccare niente. */
function configurazione() {
  return elencoUps(readJson(CHIAVE_UPS, {}));
}

const metadati = () => {
  const salvato = readJson(CHIAVE_META_UPS, {});
  return salvato && typeof salvato === "object" && !Array.isArray(salvato) ? salvato : {};
};

/** L'unico modo di scrivere l'elenco: da qui passa anche il segno che sale. */
function salva(elenco) {
  const { gruppi, metadata } = upsDaSalvare(elenco, metadati());
  writeJsonIfChanged(CHIAVE_UPS, gruppi);
  writeJsonIfChanged(CHIAVE_META_UPS, metadata, { sync: false });
  try {
    renderHomeWidgets();
  } catch (_error) {}
  return gruppi;
}

function campiMarkup(config) {
  return CASELLE_UPS.map(({ campo }) => {
    const [etichetta, esempio, aiuto] = CAMPI_UPS[campo];
    /* L'id porta l'uid del gruppo: con due schede aperte due caselle con lo
     * stesso id sarebbero la stessa casella, e il cercatore di entita' — che
     * lavora per id — scriverebbe nell'altra. */
    const id = `dm-ups-${config[CAMPO_UID_UPS]}-${campo}`;
    return `<label class="ed-slot dm-todo-ed-field"><span class="ed-slot-lbl">${esc(t(...etichetta))}</span>
      <span class="ed-form-row"><input id="${id}" class="ed-input mono" data-dm-ups-field="${esc(campo)}"
        value="${esc(config[campo])}" placeholder="${esc(esempio)}" autocomplete="off" spellcheck="false"><button
        type="button" class="dm-entity-picker" data-dm-ups-pick="${id}"
        aria-label="${t("Scegli entità", "Choose entity")}">🔍</button></span>${
          aiuto ? `<small>${esc(t(...aiuto))}</small>` : ""
        }</label>`;
  }).join("");
}

/* ── l'interruttore della sezione ─────────────────────────────────────────
 *
 * E' la fascia del guscio, non una nostra: stesso disegno, stesso gestore,
 * stessa chiave. Averne una nostra vorrebbe dire due interruttori per la
 * stessa decisione, e due modi di scriverla. */
function fasciaMarkup() {
  try {
    return root.cdSecToggleHtml?.(CHIAVE_SEZIONE) || "";
  } catch (_error) {
    return "";
  }
}

function sezioneNascosta() {
  try {
    return root.cdCfg?.("cd_sections")?.[CHIAVE_SEZIONE] === false;
  } catch (_error) {
    return false;
  }
}

/* Una scheda per gruppo. Il nome in cima, le caselle sotto, e il cestino
 * accanto al nome: e' la stessa forma delle vetture e dei carichi, cosi' chi
 * ha gia' configurato quelle sa gia' come si fa. */
function gruppoMarkup(config, posizione) {
  const uid = config[CAMPO_UID_UPS];
  const titolo = clean(config.name) || `${t("Gruppo", "Unit")} ${posizione + 1}`;
  return `<article class="ed-row dm-todo-ed-row dm-ups-ed-gruppo" data-open="true" data-dm-ups-gruppo="${esc(uid)}">
      <div class="dm-todo-ed-body">
        <label class="ed-slot dm-todo-ed-field"><span class="ed-slot-lbl">${esc(t("Nome", "Name"))}</span><span class="ed-form-row"><input id="dm-ups-${esc(uid)}-name" class="ed-input" data-dm-ups-field="name" value="${esc(config.name)}" placeholder="${esc(t("UPS del rack", "Rack UPS"))}"><button type="button" class="ed-btn-add dm-ups-ed-togli" data-dm-ups-togli="${esc(uid)}" aria-label="${esc(t("Togli", "Remove"))} ${esc(titolo)}" title="${esc(t("Togli questo gruppo", "Remove this unit"))}">🗑️</button></span></label>
        ${campiMarkup(config)}
        <label class="ed-slot dm-todo-ed-field dm-ups-ed-verso">
          <span class="ed-form-row"><input type="checkbox" id="dm-ups-${esc(uid)}-invertita" data-dm-ups-flag="invertita"${
            config.invertita ? " checked" : ""
          }><span class="ed-slot-lbl">${esc(t("Il sensore dice il contrario", "The sensor means the opposite"))}</span></span>
          <small>${esc(
            t(
              "Da spuntare se la casella «presenza rete» è un sensore di mancanza rete: acceso quando la corrente NON c'è.",
              "Tick this if the mains field is a power-failure sensor: on when the power is OUT.",
            ),
          )}</small>
        </label>
      </div>
    </article>`;
}

function corpoMarkup() {
  const elenco = configurazione();
  /* Senza nessun gruppo si apre comunque una scheda vuota: e' la prima volta
   * di chiunque, e una pagina con un solo tasto «Aggiungi» sarebbe un giro in
   * piu' per arrivare dove si voleva arrivare. */
  const schede = elenco.length ? elenco : [nuovoUps([], "", metadati())];
  return `${fasciaMarkup()}<div class="dm-ups-ed">
  <div class="ed-sec-title">🔌 ${esc(t("Gruppi di continuità (UPS)", "Uninterruptible power supplies"))}</div>
  <div class="ed-intro">${esc(
    t(
      "A rete presente la tessera mostra la carica della batteria; quando la corrente cade mostra i minuti che restano e si accende. Nessuna casella è obbligatoria: con il solo stato di NUT la tessera sa già dire se c'è tensione. Se ne hai più di uno, aggiungili qui sotto: ognuno ha la sua scena nella pagina Continuità.",
      "With mains present the tile shows the battery charge; when power drops it shows the minutes left and lights up. No field is required: with the NUT status alone the tile already knows whether there is power. If you have more than one, add them below: each gets its own scene on the Backup power page.",
    ),
  )}</div>
  <div class="ed-list dm-todo-ed-list">
    ${schede.map((config, posizione) => gruppoMarkup(config, posizione)).join("")}
  </div>
  <button type="button" class="ed-btn-add dm-ups-ed-aggiungi" data-dm-ups-aggiungi>＋ ${esc(t("Aggiungi un UPS", "Add a UPS"))}</button>
  <button type="button" class="ed-save-btn" data-dm-ups-save>💾 ${esc(t("Salva UPS", "Save UPS"))}</button>
</div>`;
}

export function ensureUpsEditor() {
  const body = doc?.getElementById("ed-body");
  if (!body || schedaAttiva() !== UPS_EDITOR_TAB) return false;
  /* La fascia fa parte della firma: toccandola la preferenza cambia davvero,
   * ma senza il suo valore qui niente sarebbe cambiato da ridisegnare e la
   * fascia resterebbe verde fino al cambio di linguetta. */
  const firma = `${JSON.stringify(configurazione())}|${sezioneNascosta()}`;
  if (body.dataset.dmUpsEditor === firma && body.querySelector(".dm-ups-ed")) return true;
  body.dataset.dmUpsEditor = firma;
  body.innerHTML = corpoMarkup();
  body.dataset.renderer = "ups";
  return true;
}

function ridisegna() {
  const body = doc?.getElementById("ed-body");
  if (body) delete body.dataset.dmUpsEditor;
  ensureUpsEditor();
}

function onClick(event) {
  const body = doc?.getElementById("ed-body");
  if (!body || schedaAttiva() !== UPS_EDITOR_TAB || !body.contains(event.target)) return;
  const pick = event.target.closest("[data-dm-ups-pick]");
  if (pick) {
    event.preventDefault();
    const input = body.querySelector(`#${CSS.escape(clean(pick.dataset.dmUpsPick))}`);
    if (input) root.wzPickEntity?.(input);
    return;
  }
  const togli = event.target.closest("[data-dm-ups-togli]");
  if (togli) {
    event.preventDefault();
    /* Si toglie quello che c'e' scritto adesso, non quello salvato: chi ha
     * riempito due schede e ne butta una non deve perdere l'altra. */
    salva(togliUps(schedeAperte(body), clean(togli.dataset.dmUpsTogli)));
    ridisegna();
    root.edToast?.(t("🗑️ UPS tolto", "🗑️ UPS removed"));
    return;
  }
  if (event.target.closest("[data-dm-ups-aggiungi]")) {
    event.preventDefault();
    /* Il ＋ apre una scheda, non scrive niente.
     *
     * Un gruppo senza nome e senza caselle non e' un gruppo: `elencoUps` lo
     * lascia fuori, ed e' giusto — se lo salvasse, chi preme ＋ e cambia idea
     * si ritroverebbe una scheda vuota per sempre. Quindi la scheda nuova
     * nasce qui, nel documento, e diventa un gruppo quando si salva con
     * qualcosa dentro. */
    const elenco = body.querySelector(".dm-todo-ed-list");
    if (!elenco) return;
    const adesso = schedeAperte(body);
    elenco.insertAdjacentHTML(
      "beforeend",
      gruppoMarkup(nuovoUps(adesso, "", metadati()), adesso.length),
    );
    elenco.lastElementChild?.querySelector('[data-dm-ups-field="name"]')?.focus();
    return;
  }
  if (event.target.closest("[data-dm-ups-save]")) {
    event.preventDefault();
    salva(schedeAperte(body));
    ridisegna();
    root.edToast?.(t("💾 UPS salvato", "💾 UPS saved"));
  }
}

/* Quello che c'e' scritto nelle schede in questo momento.
 *
 * Ogni scheda porta l'uid del suo gruppo, e ogni casella appartiene alla
 * scheda che la contiene: senza quel radicamento le caselle di due gruppi
 * finirebbero tutte nel primo, che e' la stessa forma del difetto delle foto
 * delle auto — un contenitore che non sa di chi sta parlando. */
function schedeAperte(body) {
  const salvate = configurazione();
  return [...body.querySelectorAll("[data-dm-ups-gruppo]")].map((scheda, posizione) => {
    const uid = clean(scheda.dataset.dmUpsGruppo);
    const partenza = salvate.find((gruppo) => gruppo[CAMPO_UID_UPS] === uid) || { [CAMPO_UID_UPS]: uid };
    const fuori = { ...partenza, [CAMPO_UID_UPS]: uid || `ups-${posizione + 1}` };
    for (const campo of scheda.querySelectorAll("[data-dm-ups-field]"))
      fuori[clean(campo.dataset.dmUpsField)] = clean(campo.value);
    for (const flag of scheda.querySelectorAll("[data-dm-ups-flag]"))
      fuori[clean(flag.dataset.dmUpsFlag)] = flag.checked === true;
    return fuori;
  });
}

export function ensureUpsEditorTab() {
  const linguette = doc?.querySelector(".ed-tab")?.parentElement;
  if (!linguette || linguette.querySelector(`.ed-tab[data-tab="${UPS_EDITOR_TAB}"]`)) return false;
  const linguetta = doc.createElement("button");
  linguetta.className = "ed-tab";
  linguetta.dataset.tab = UPS_EDITOR_TAB;
  linguetta.textContent = `🔌 ${t("Continuità", "Backup power")}`;
  linguetta.addEventListener("click", () => root.editorSwitch?.(UPS_EDITOR_TAB));
  const prima = linguette.querySelector('.ed-tab[data-tab="runtime"]');
  if (prima) prima.before(linguetta);
  else linguette.append(linguetta);
  return true;
}

function installStyles() {
  installStyle(
    "dm-ups-editor-style",
    `
      /* La spunta del verso girato sta su una riga sua, con la scritta accanto
         alla casella e non sopra: e' una domanda si'/no, non un campo. */
      #ed-body .dm-ups-ed-verso .ed-form-row{align-items:center;gap:10px}
      #ed-body .dm-ups-ed-verso input[type="checkbox"]{width:18px;height:18px;flex:0 0 18px}
      #ed-body .dm-ups-ed-verso .ed-slot-lbl{margin:0}
      /* Il cestino sta accanto al nome del gruppo, non in fondo alla scheda:
         e' il nome che dice quale gruppo si sta per togliere. */
      #ed-body .dm-ups-ed-togli{flex:0 0 auto;padding:6px 10px;line-height:1}
      #ed-body .dm-ups-ed-gruppo + .dm-ups-ed-gruppo{margin-top:14px}
      #ed-body .dm-ups-ed-aggiungi{display:block;width:100%;margin:12px 0 8px}
    `,
  );
}

export function installUpsEditor() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  doc.addEventListener("click", onClick);
  /* La linguetta si mette appena il pannello nasce, non al primo ridisegno:
   * chi apre la configurazione e chiede subito questa scheda la troverebbe
   * altrimenti assente, e resterebbe su nessuna scheda. */
  wrapFunction("apriConfigEntita", "__dmUpsEditor", () => {
    ensureUpsEditorTab();
    ensureUpsEditor();
  });
  ensureUpsEditorTab();
  onEditorRedraw("__dmUpsEditor", () => {
    root.queueMicrotask?.(() => {
      ensureUpsEditorTab();
      ensureUpsEditor();
    });
  });
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:editor-rendered"])
    root.addEventListener?.(evento, () => {
      root.queueMicrotask?.(() => {
        ensureUpsEditorTab();
        ensureUpsEditor();
      });
    });
  ensureUpsEditor();
  return true;
}

installUpsEditor();
