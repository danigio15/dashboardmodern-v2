/* Dove si dichiara la ventilazione meccanica (#371).
 *
 * «Sarebbe bellissimo avere nei climate la possibilita' di inserire i dati
 * delle 4 temperature delle macchine VMC.» La scheda sta nella configurazione
 * del Clima, sotto le unita' e la caldaia: e' li' che uno cerca l'aria di
 * casa, e non in una scheda tutta sua per una macchina sola.
 *
 * Le caselle sono quelle della card che ha allegato la segnalazione, con i
 * nomi che usa chi ce l'ha: aria esterna, immissione, ripresa, espulsione, e
 * poi bypass, estate, filtri e le ventole. Ogni casella e' un'entita' e basta:
 * la macchina la comanda gia' l'integrazione, qui si dice solo dove guardare.
 */
import {
  CAMPI_VMC,
  CHIAVE_VMC,
  INTERRUTTORI,
  MASSIMO_VMC,
  NUMERI,
  TEMPERATURE,
  normalizzaVmcTutte,
} from "../core/vmc-model.js";
import { renderClimate } from "./climate-thermal-section.js";
import {
  clean,
  doc,
  esc,
  installStyle,
  onEditorRedraw,
  readJson,
  root,
  t,
  writeJsonIfChanged,
} from "./shared.js";
import { MARCHIO_TESSERA } from "../core/fuori-dai-widget.js";

const KEY = "__DASHBOARDMODERN_VMC_EDITOR__";
const state = (root[KEY] ||= { installed: false, contatore: 0 });

const ANCORA = "dm-vmc-ed";

function configurate() {
  return normalizzaVmcTutte(readJson(CHIAVE_VMC, []));
}

function salva(elenco) {
  const pulita = normalizzaVmcTutte(elenco);
  writeJsonIfChanged(CHIAVE_VMC, pulita);
  try {
    renderClimate({ rebuild: true });
  } catch (_error) {}
  try {
    root.cdMarkDirty?.();
    root.cdSyncPush?.();
  } catch (_error) {}
}

/* Dove va appesa la scheda: DENTRO il Clima, non in fondo al corpo.
 *
 * «Ma perche' ventilazione meccanica e' inserito nella sezione sicurezza? E
 * dentro minipc.» Perche' le sezioni del Config non sono linguette separate:
 * stanno tutte nello STESSO `ed-body`, una sotto l'altra a fisarmonica. Questa
 * scheda si appendeva in fondo al corpo — e il fondo del corpo, per chi ha
 * aperto la Sicurezza o il MiniPC, e' sotto la Sicurezza o sotto il MiniPC.
 * Non era finita nella sezione sbagliata: era finita in fondo a tutto, che da
 * dove si guarda e' la stessa cosa.
 *
 * L'ancora e' il tasto che aggiunge un'unita' del Clima: e' lo stesso appiglio
 * che usa il blocco del Clima rapido, che infatti non e' mai scappato. Il
 * campo dell'entita' resta la prova che il Clima c'e', ma non basta a dire
 * DOVE: nel corpo c'e' sempre, anche mentre si guarda un'altra sezione. */
function tastoAggiungiClima() {
  const body = doc?.getElementById?.("ed-body");
  return body?.querySelector?.('[onclick*="edAddClima"]') || null;
}

function nellaSchedaClima() {
  const body = doc?.getElementById?.("ed-body");
  return Boolean(body?.querySelector?.("#ed-cl-ent")) && Boolean(tastoAggiungiClima());
}

function etichetta(chiave) {
  switch (chiave) {
    case "clima":
      return t("Entità climate della macchina", "The machine's climate entity");
    case "esterna":
      return t("Aria esterna", "Outside air");
    case "immissione":
      return t("Immissione (in casa)", "Supply (into the house)");
    case "ripresa":
      return t("Ripresa (da casa)", "Return (from the house)");
    case "espulsione":
      return t("Espulsione (fuori)", "Exhaust (outside)");
    case "bypass":
      return t("Bypass aperto", "Bypass open");
    case "estate":
      return t("Modalità estate", "Summer mode");
    case "filtri":
      return t("Filtri da cambiare", "Filters need changing");
    case "ventola_immissione":
      return t("Ventola immissione (giri)", "Supply fan (rpm)");
    case "ventola_espulsione":
      return t("Ventola espulsione (giri)", "Exhaust fan (rpm)");
    case "livello_immissione":
      return t("Livello immissione", "Supply level");
    default:
      return t("Livello ripresa", "Return level");
  }
}

function esempio(chiave) {
  const nomi = {
    clima: "climate.comfoair",
    esterna: "sensor.comfoair_outside_air_temperature",
    immissione: "sensor.comfoair_supply_air_temperature",
    ripresa: "sensor.comfoair_return_air_temperature",
    espulsione: "sensor.comfoair_exhaust_air_temperature",
    bypass: "binary_sensor.comfoair_bypass_valve_open",
    estate: "binary_sensor.comfoair_summer_mode",
    filtri: "binary_sensor.comfoair_external_filter_switch",
    ventola_immissione: "sensor.comfoair_intake_fan_speed_rpm",
    ventola_espulsione: "sensor.comfoair_exhaust_fan_speed_rpm",
    livello_immissione: "sensor.comfoair_intake_fan_speed",
    livello_ripresa: "sensor.comfoair_return_air_level",
  };
  return nomi[chiave] || "sensor.vmc";
}

function campoMarkup(unita, indice, chiave) {
  const id = `dm-vmc-${indice}-${chiave}`;
  return `<label class="ed-slot dm-vmc-ed-campo"><span class="ed-slot-lbl">${esc(etichetta(chiave))}</span>
    <span class="ed-form-row"><input id="${esc(id)}" class="ed-input mono" data-dm-vmc-campo="${esc(chiave)}" value="${esc(unita[chiave])}" placeholder="${esc(esempio(chiave))}" autocomplete="off" spellcheck="false"><button type="button" class="dm-entity-picker" data-dm-vmc-pick="${esc(id)}" aria-label="${esc(t("Scegli entità", "Choose entity"))}">🔍</button></span></label>`;
}

function fasciaMarkup(unita, indice, titolo, chiavi) {
  return `<div class="dm-vmc-ed-fascia">
    <span class="dm-vmc-ed-fascia-lbl">${esc(titolo)}</span>
    ${chiavi.map((chiave) => campoMarkup(unita, indice, chiave)).join("")}
  </div>`;
}

function unitaMarkup(unita, indice) {
  return `<article class="ed-row dm-vmc-ed-unita" data-dm-vmc-unita="${esc(unita.id)}">
    <div class="dm-vmc-ed-testa">
      <span aria-hidden="true">🔄</span>
      <input class="ed-input" data-dm-vmc-campo="nome" value="${esc(unita.nome)}" placeholder="${esc(t("Nome (es. Comfoair)", "Name (e.g. Comfoair)"))}">
      <button type="button" class="ed-del" data-dm-vmc-togli="${esc(unita.id)}" title="${esc(t("Togli", "Remove"))}" aria-label="${esc(t("Togli", "Remove"))}">🗑️</button>
    </div>
    ${fasciaMarkup(unita, indice, t("🌡️ Le quattro temperature", "🌡️ The four temperatures"), TEMPERATURE.map((voce) => voce.chiave))}
    ${fasciaMarkup(unita, indice, t("🔀 Come sta lavorando", "🔀 How it is working"), INTERRUTTORI.map((voce) => voce.chiave))}
    ${fasciaMarkup(unita, indice, t("🌀 Ventole e livelli", "🌀 Fans and levels"), NUMERI.map((voce) => voce.chiave))}
    ${fasciaMarkup(unita, indice, t("🎛️ La macchina", "🎛️ The machine"), ["clima"])}
  </article>`;
}

function corpoMarkup() {
  const elenco = configurate();
  const piene = elenco.length >= MASSIMO_VMC;
  return `<div class="ed-sec-title">🔄 ${esc(t("Ventilazione meccanica", "Mechanical ventilation"))}</div>
  <div class="ed-intro">${esc(
    t(
      "Le quattro temperature di una VMC dicono da sole se la macchina sta lavorando: l'aria entra da fuori, si scalda con quella che esce, e la differenza fra le due è il recupero. La pagina del Clima le mostra incrociate come i due flussi, con il bypass, la stagione e i filtri.",
      "The four temperatures of a heat-recovery unit tell you on their own whether the machine is doing its job: air comes in from outside, warms up with the air going out, and the difference between the two is the recovery. The Climate page shows them crossed like the two flows, with the bypass, the season and the filters.",
    ),
  )}</div>
  <div class="ed-list dm-vmc-ed-lista">
    ${elenco.map(unitaMarkup).join("")}
    <button type="button" class="ed-btn-add" data-dm-vmc-aggiungi${piene ? " disabled" : ""}>＋ ${esc(t("Aggiungi una VMC", "Add a ventilation unit"))}</button>
    <button type="button" class="ed-save-btn" data-dm-vmc-salva>💾 ${esc(t("Salva ventilazione", "Save ventilation"))}</button>
  </div>`;
}

/** La scheda, appesa in fondo alla configurazione del Clima. */
export function ensureVmcEditor() {
  const body = doc?.getElementById?.("ed-body");
  if (!body) return false;
  let scheda = doc?.getElementById?.(ANCORA);
  if (!nellaSchedaClima()) {
    scheda?.remove();
    return false;
  }
  const aggiungi = tastoAggiungiClima();
  if (!aggiungi) {
    scheda?.remove();
    return false;
  }
  const firma = JSON.stringify(configurate());
  if (!scheda) {
    scheda = doc.createElement("section");
    scheda.id = ANCORA;
    scheda.className = "ed-form dm-vmc-ed";
    /* La scheda sta dentro il Clima ma la tessera in Home e' un'altra: senza
     * dirlo, l'interruttore «nel widget» accanto a una sonda della VMC
     * scriverebbe una scelta a nome del Clima. */
    scheda.setAttribute(MARCHIO_TESSERA, "vmc");
    aggiungi.before(scheda);
  } else if (scheda.nextElementSibling !== aggiungi) {
    /* Il guscio ridisegna il Clima e la scheda resta dov'era, cioe' fuori
     * posto: si rimette accanto alla sua ancora invece di restare orfana. */
    aggiungi.before(scheda);
  } else if (scheda.dataset.dmVmcFirma === firma && scheda.firstElementChild) {
    return true;
  }
  scheda.dataset.dmVmcFirma = firma;
  scheda.innerHTML = corpoMarkup();
  return true;
}

function ridisegna() {
  const scheda = doc?.getElementById?.(ANCORA);
  if (scheda) delete scheda.dataset.dmVmcFirma;
  ensureVmcEditor();
}

/** Le macchine come stanno nella scheda adesso, lette dai campi. */
function raccogli(scheda) {
  return [...scheda.querySelectorAll("[data-dm-vmc-unita]")].map((nodo, indice) => {
    const unita = { id: clean(nodo.dataset.dmVmcUnita) || `vmc-${indice + 1}` };
    unita.nome = clean(nodo.querySelector('[data-dm-vmc-campo="nome"]')?.value);
    for (const chiave of CAMPI_VMC)
      unita[chiave] = clean(nodo.querySelector(`[data-dm-vmc-campo="${chiave}"]`)?.value);
    return unita;
  });
}

function onClick(evento) {
  const scheda = doc?.getElementById?.(ANCORA);
  if (!scheda || !scheda.contains(evento.target)) return;

  const lente = evento.target.closest("[data-dm-vmc-pick]");
  if (lente) {
    evento.preventDefault();
    const casella = doc.getElementById(lente.dataset.dmVmcPick);
    if (casella) root.wzPickEntity?.(casella);
    return;
  }

  const togli = evento.target.closest("[data-dm-vmc-togli]");
  if (togli) {
    evento.preventDefault();
    const id = clean(togli.dataset.dmVmcTogli);
    salva(raccogli(scheda).filter((unita) => unita.id !== id));
    ridisegna();
    return;
  }

  if (evento.target.closest("[data-dm-vmc-aggiungi]")) {
    evento.preventDefault();
    const elenco = raccogli(scheda);
    if (elenco.length >= MASSIMO_VMC) return;
    /* Il contatore, e non la lunghezza dell'elenco: togliendo la seconda di
     * tre e aggiungendone un'altra, la lunghezza darebbe un id gia' usato. */
    state.contatore += 1;
    salva([...elenco, { id: `vmc-${Date.now()}-${state.contatore}`, nome: "" }]);
    ridisegna();
    return;
  }

  if (evento.target.closest("[data-dm-vmc-salva]")) {
    evento.preventDefault();
    salva(raccogli(scheda));
    try {
      root.edToast?.(t("Ventilazione salvata", "Ventilation saved"));
    } catch (_error) {}
    ridisegna();
  }
}

export function installVmcEditor() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyle(
    "dm-vmc-editor-style",
    `
    #ed-body #${ANCORA}{margin-top:14px}
    #ed-body .dm-vmc-ed-unita{display:block}
    #ed-body .dm-vmc-ed-testa{display:flex;align-items:center;gap:8px;margin:0 0 8px}
    #ed-body .dm-vmc-ed-testa input{flex:1 1 auto;min-width:0;margin:0}
    #ed-body .dm-vmc-ed-fascia{display:grid;gap:6px;margin:0 0 10px;padding:9px 10px;border:1px solid var(--divider-color,#dbe4ee);border-radius:13px}
    #ed-body .dm-vmc-ed-fascia-lbl{font-size:10.5px;font-weight:900;letter-spacing:.05em;text-transform:uppercase;color:var(--text-dim,#64748b)}
    #ed-body .dm-vmc-ed-lista > .ed-btn-add{width:100%;margin:6px 0}
    `,
  );
  doc.addEventListener("click", onClick);
  onEditorRedraw("__dmVmcEditor", () => root.queueMicrotask?.(ensureVmcEditor));
  for (const evento of [
    "dashboardmodern:editor-rendered",
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
  ])
    root.addEventListener?.(evento, () => root.queueMicrotask?.(ensureVmcEditor));
  ensureVmcEditor();
  return true;
}
