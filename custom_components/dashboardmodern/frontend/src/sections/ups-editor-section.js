/* Dove si dichiara il gruppo di continuita' (#256).
 *
 * «Chiedo se c'e' la possibilita' di gestire un UPS: vedere se c'e' tensione o
 * no, lo stato della batteria e il carico.»
 *
 * Le caselle stanno nella scheda «Energia» e non fra le tessere della Home,
 * perche' un UPS non e' un widget: e' la corrente di casa, ed e' li' che chi
 * configura va a cercarla. Nella scheda dei widget si sceglie SE mostrarlo;
 * qui si dice COSA guardare — che sono due domande diverse e vanno in due
 * posti diversi.
 *
 * Nessuna casella e' obbligatoria e nemmeno tutte insieme servono. Chi ha NUT
 * ne compila una — lo stato — e quella stringa dice gia' rete e batteria
 * scarica; chi ha un UPS letto da un'integrazione qualunque compila le sonde
 * che ha. Quello che manca non si disegna.
 */
import {
  CASELLE_UPS,
  CHIAVE_UPS,
  normalizzaUps,
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

/* La scheda «Energia» del guscio: la corrente di casa si configura li'. */
const SCHEDA = "sez1";

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

function configurazione() {
  return normalizzaUps(readJson(CHIAVE_UPS, {}));
}

function salva(config) {
  writeJsonIfChanged(CHIAVE_UPS, config);
  try {
    renderHomeWidgets();
  } catch (_error) {}
}

function campiMarkup(config) {
  return CASELLE_UPS.map(({ campo }) => {
    const [etichetta, esempio, aiuto] = CAMPI_UPS[campo];
    const id = `dm-ups-${campo}`;
    return `<label class="ed-slot dm-todo-ed-field"><span class="ed-slot-lbl">${esc(t(...etichetta))}</span>
      <span class="ed-form-row"><input id="${id}" class="ed-input mono" data-dm-ups-field="${esc(campo)}"
        value="${esc(config[campo])}" placeholder="${esc(esempio)}" autocomplete="off" spellcheck="false"><button
        type="button" class="dm-entity-picker" data-dm-ups-pick="${id}"
        aria-label="${t("Scegli entità", "Choose entity")}">🔍</button></span>${
          aiuto ? `<small>${esc(t(...aiuto))}</small>` : ""
        }</label>`;
  }).join("");
}

function corpoMarkup() {
  const config = configurazione();
  return `<div class="dm-ups-ed">
  <div class="ed-sec-title dm-ups-ed-sep">🔌 ${esc(t("Gruppo di continuità (UPS)", "Uninterruptible power supply"))}</div>
  <div class="ed-intro">${esc(
    t(
      "A rete presente la tessera mostra la carica della batteria; quando la corrente cade mostra i minuti che restano e si accende. Nessuna casella è obbligatoria: con il solo stato di NUT la tessera sa già dire se c'è tensione.",
      "With mains present the tile shows the battery charge; when power drops it shows the minutes left and lights up. No field is required: with the NUT status alone the tile already knows whether there is power.",
    ),
  )}</div>
  <div class="ed-list dm-todo-ed-list">
    <article class="ed-row dm-todo-ed-row" data-open="true">
      <div class="dm-todo-ed-body">
        <label class="ed-slot dm-todo-ed-field"><span class="ed-slot-lbl">${esc(t("Nome", "Name"))}</span><span class="ed-form-row"><input id="dm-ups-name" class="ed-input" data-dm-ups-field="name" value="${esc(config.name)}" placeholder="${esc(t("UPS del rack", "Rack UPS"))}"></span></label>
        ${campiMarkup(config)}
        <label class="ed-slot dm-todo-ed-field dm-ups-ed-verso">
          <span class="ed-form-row"><input type="checkbox" id="dm-ups-invertita" data-dm-ups-flag="invertita"${
            config.invertita ? " checked" : ""
          }><span class="ed-slot-lbl">${esc(t("Il sensore dice il contrario", "The sensor means the opposite"))}</span></span>
          <small>${esc(
            t(
              "Da spuntare se la casella «presenza rete» è un sensore di mancanza rete: acceso quando la corrente NON c'è.",
              "Tick this if the mains field is a power-failure sensor: on when the power is OUT.",
            ),
          )}</small>
        </label>
        <button type="button" class="ed-save-btn" data-dm-ups-save>💾 ${esc(t("Salva UPS", "Save UPS"))}</button>
      </div>
    </article>
  </div></div>`;
}

export function ensureUpsEditor() {
  const body = doc?.getElementById("ed-body");
  if (!body || schedaAttiva() !== SCHEDA) return false;
  const firma = JSON.stringify(configurazione());
  let blocco = body.querySelector(":scope > .dm-ups-ed");
  if (blocco && firma === state.firma) return true;
  state.firma = firma;
  const guscio = doc.createElement("div");
  guscio.innerHTML = corpoMarkup();
  const nuovo = guscio.firstElementChild;
  if (blocco) blocco.replaceWith(nuovo);
  /* In fondo alla scheda: sopra restano i consumi, che sono quello per cui
   * questa scheda si apre tutti i giorni. L'UPS si compila una volta sola. */
  else body.append(nuovo);
  return true;
}

function ridisegna() {
  state.firma = "";
  ensureUpsEditor();
}

function onClick(event) {
  const body = doc?.getElementById("ed-body");
  if (!body || !body.contains(event.target)) return;
  const pick = event.target.closest("[data-dm-ups-pick]");
  if (pick) {
    event.preventDefault();
    const input = body.querySelector(`#${CSS.escape(clean(pick.dataset.dmUpsPick))}`);
    if (input) root.wzPickEntity?.(input);
    return;
  }
  if (event.target.closest("[data-dm-ups-save]")) {
    event.preventDefault();
    const next = { ...configurazione() };
    for (const campo of body.querySelectorAll("[data-dm-ups-field]"))
      next[clean(campo.dataset.dmUpsField)] = clean(campo.value);
    for (const flag of body.querySelectorAll("[data-dm-ups-flag]"))
      next[clean(flag.dataset.dmUpsFlag)] = flag.checked === true;
    salva(next);
    ridisegna();
    root.edToast?.(t("💾 UPS salvato", "💾 UPS saved"));
  }
}

function installStyles() {
  installStyle(
    "dm-ups-editor-style",
    `
      #ed-body .dm-ups-ed-sep{margin-top:24px;padding-top:16px;
        border-top:1px solid var(--card-border,#e2e8f0)}
      /* La spunta del verso girato sta su una riga sua, con la scritta accanto
         alla casella e non sopra: e' una domanda si'/no, non un campo. */
      #ed-body .dm-ups-ed-verso .ed-form-row{align-items:center;gap:10px}
      #ed-body .dm-ups-ed-verso input[type="checkbox"]{width:18px;height:18px;flex:0 0 18px}
      #ed-body .dm-ups-ed-verso .ed-slot-lbl{margin:0}
    `,
  );
}

export function installUpsEditor() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  doc.addEventListener("click", onClick);
  wrapFunction("apriConfigEntita", "__dmUpsEditor", () => ensureUpsEditor());
  onEditorRedraw("__dmUpsEditor", () => {
    root.queueMicrotask?.(() => ensureUpsEditor());
  });
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:editor-rendered"])
    root.addEventListener?.(evento, () => {
      root.queueMicrotask?.(() => ensureUpsEditor());
    });
  ensureUpsEditor();
  return true;
}

installUpsEditor();
