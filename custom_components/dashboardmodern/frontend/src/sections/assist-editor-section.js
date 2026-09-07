/* Dove si accende e si regola Assist (#360).
 *
 * Sta fra le Impostazioni e non in una scheda sua, perche' non e' una sezione
 * della casa: e' un modo di parlarle, come la lingua e' un modo di leggerla.
 * Tre righe e nient'altro — quale assistente, se leggere la risposta ad alta
 * voce, e se il tasto deve galleggiare in Home — perche' tutto il resto lo sa
 * gia' Home Assistant e chiederglielo due volte sarebbe una configurazione da
 * tenere allineata a mano.
 */
import { CHIAVE_ASSIST, normalizzaAssist } from "../core/assist-model.js";
import { siPuoParlare } from "./assist-section.js";
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

const KEY = "__DASHBOARDMODERN_ASSIST_EDITOR__";
const state = (root[KEY] ||= { installed: false });

const SCHEDA = "visib";

function schedaAttiva() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

function configurazione() {
  return normalizzaAssist(readJson(CHIAVE_ASSIST, {}));
}

function salva(cambio) {
  const pulita = normalizzaAssist({ ...configurazione(), ...cambio });
  writeJsonIfChanged(CHIAVE_ASSIST, pulita);
  try {
    root.cdMarkDirty?.();
    root.cdSyncPush?.();
  } catch (_error) {}
  try {
    root.dispatchEvent?.(new CustomEvent("dashboardmodern:config-changed"));
  } catch (_error) {}
}

function rigaMarkup() {
  const config = configurazione();
  const senzaVoce = !siPuoParlare();
  return `<div class="ed-slot dm-assist-ed" data-dm-assist-ed>
    <div class="ed-slot-lbl">🗣️ Assist</div>
    <div class="dm-assist-ed-nota">${esc(
      t(
        "Un tasto che apre l'assistente di Home Assistant: si scrive la domanda, oppure si tocca il microfono e si parla. Le frasi le capisce Home Assistant — la plancia gliele passa e basta.",
        "A button that opens the Home Assistant assistant: type the question, or tap the microphone and speak. Home Assistant understands the sentences — the dashboard just passes them along.",
      ),
    )}</div>
    <label class="dm-assist-ed-riga">
      <input type="checkbox" data-dm-assist-tasto${config.tasto ? " checked" : ""}>
      <span>${esc(t("Il tasto in basso a destra", "The button in the bottom right"))}</span>
    </label>
    <label class="dm-assist-ed-riga">
      <input type="checkbox" data-dm-assist-voce${config.voce ? " checked" : ""}>
      <span>${esc(t("Leggi la risposta ad alta voce", "Read the answer out loud"))}</span>
    </label>
    <label class="dm-assist-ed-campo">
      <span>${esc(t("Assistente (vuoto = quello di serie)", "Assistant (empty = the default one)"))}</span>
      <input class="ed-input mono" data-dm-assist-agente value="${esc(config.agente)}" placeholder="conversation.home_assistant" autocomplete="off" spellcheck="false">
    </label>
    ${
      senzaVoce
        ? `<small class="dm-assist-ed-avviso">${esc(
            t(
              "Questo browser non sa trascrivere la voce: il microfono non compare, ma la domanda si può scrivere. Su Chrome, Edge e Safari funziona.",
              "This browser cannot transcribe speech: the microphone does not appear, but you can still type the question. It works on Chrome, Edge and Safari.",
            ),
          )}</small>`
        : ""
    }
  </div>`;
}

export function ensureAssistEditor() {
  const corpo = doc?.getElementById?.("ed-body");
  if (!corpo || schedaAttiva() !== SCHEDA) return false;
  if (corpo.querySelector("[data-dm-assist-ed]")) return true;
  const guscio = doc.createElement("div");
  guscio.innerHTML = rigaMarkup();
  const riga = guscio.firstElementChild;
  if (!riga) return false;
  /* Sotto la lingua, che e' la preferenza che le somiglia di piu': tutte e due
   * dicono come la plancia parla a chi la guarda. */
  const lingua = corpo.querySelector("[data-dm-lingua]");
  if (lingua) lingua.after(riga);
  else corpo.prepend(riga);
  return true;
}

function onCambio(evento) {
  const riga = evento.target?.closest?.("[data-dm-assist-ed]");
  if (!riga) return;
  if (evento.target.matches("[data-dm-assist-tasto]"))
    salva({ tasto: evento.target.checked === true });
  else if (evento.target.matches("[data-dm-assist-voce]"))
    salva({ voce: evento.target.checked === true });
  else if (evento.target.matches("[data-dm-assist-agente]"))
    salva({ agente: clean(evento.target.value) });
}

export function installAssistEditor() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyle(
    "dm-assist-editor-style",
    `
    #ed-body .dm-assist-ed{display:grid;gap:8px}
    #ed-body .dm-assist-ed-nota{font-size:11.5px;line-height:1.45;color:var(--text-dim,#64748b)}
    #ed-body .dm-assist-ed-riga{display:flex;align-items:center;gap:9px;font-size:13px;font-weight:750;cursor:pointer}
    #ed-body .dm-assist-ed-riga input{width:18px;height:18px;margin:0;flex:0 0 auto}
    #ed-body .dm-assist-ed-campo{display:grid;gap:4px;font-size:11.5px;font-weight:800;color:var(--text-dim,#64748b)}
    #ed-body .dm-assist-ed-avviso{display:block;font-size:11px;line-height:1.45;color:#b45309}
    `,
  );
  doc.addEventListener("change", onCambio);
  onEditorRedraw("__dmAssistEditor", () => root.queueMicrotask?.(ensureAssistEditor));
  for (const evento of [
    "dashboardmodern:editor-rendered",
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
  ])
    root.addEventListener?.(evento, () => root.queueMicrotask?.(ensureAssistEditor));
  ensureAssistEditor();
  return true;
}
