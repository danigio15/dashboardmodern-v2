/* La valvola TRV nella scheda del clima (#300).
 *
 * «Nella sezione riscaldamento dare la possibilita' di inserire valvole TRV
 * mostrando percentuale apertura e percentuale chiusura valvola.» La valvola
 * e' dell'unita' `climate` che gia' si configura — stesso nome, stessa stanza
 * — quindi non e' una lista a parte: e' una casella in piu' nella scheda
 * dell'unita', nel form di aggiunta del guscio e nella matita. La casella si
 * mette qui, prima del tasto «Aggiungi unita' clima», e quando il guscio
 * aggiunge l'unita' il suo valore le si attacca; la card la disegna da
 * `core/valvola-trv.js`.
 */
import { climateUnits } from "./climate-thermal-section.js";
import { clean, doc, esc, installStyle, onEditorRedraw, readJson, root, t, writeJsonIfChanged } from "./shared.js";

const KEY = "__DASHBOARDMODERN_TRV_EDITOR__";
const state = (root[KEY] ||= { installed: false });
const CAMPO_ID = "ed-cl-valvola";

function tastoAggiungi() {
  const body = doc?.getElementById?.("ed-body");
  return body?.querySelector?.('[onclick*="edAddClima"]') || null;
}

/** La casella nel form di aggiunta, prima del tasto (e prima del tasto rapido). */
export function ensureTrvField() {
  const body = doc?.getElementById?.("ed-body");
  const dentroClima = Boolean(body?.querySelector?.("#ed-cl-ent"));
  let casella = doc?.getElementById?.(CAMPO_ID)?.closest?.(".dm-trv-slot");
  if (!dentroClima) {
    casella?.remove();
    return false;
  }
  if (casella) return true;
  const ancora = body.querySelector("#dm-quick-climate") || tastoAggiungi();
  if (!ancora) return false;
  /* La stessa forma del campo «Entita' clima» qui sopra: la casella nuda con la
   * lente accanto, e il nome glielo scrive la carta delle entita' (che lo
   * conosce per id). Con un'etichetta propria la carta lo trattava da campo
   * gia' intitolato: la matita finiva su una riga a se' sopra la casella, e il
   * campo non stava in riga con gli altri. */
  casella = doc.createElement("div");
  casella.className = "dm-trv-slot";
  casella.innerHTML = `<div class="dm-trv-campo" style="display:flex; gap:8px; margin-bottom:6px;"><input id="${CAMPO_ID}" class="ed-input mono" style="flex:1;" placeholder="sensor.trv_valve_position" autocomplete="off" spellcheck="false"><button type="button" class="dm-entity-picker" data-dm-trv-pick aria-label="${esc(t("Scegli entità", "Choose entity"))}">🔍</button></div>
    <small>${esc(
      t(
        "Il sensore o il number con la posizione della valvola termostatica, da 0 a 100: la card mostra quanto è aperta e quanto chiusa. Se l'unità climate espone già valve_position, non serve.",
        "The sensor or number with the thermostatic valve position, 0 to 100: the card shows how open and how closed it is. If the climate entity already exposes valve_position, you do not need it.",
      ),
    )}</small>`;
  ancora.before(casella);
  return true;
}

/* Quando il guscio aggiunge l'unita', la valvola scritta nella casella e' la
 * sua: la si riconosce perche' e' l'ultima della lista. */
function agganciaAggiunta() {
  const originale = root.edAddClima;
  if (typeof originale !== "function" || originale.__dmTrvPerUnita) return false;
  function conValvola(...args) {
    const valvola = clean(doc?.getElementById?.(CAMPO_ID)?.value);
    const prima = climateUnits().length;
    const esito = originale.apply(this, args);
    try {
      if (valvola && climateUnits().length > prima) {
        const lista = readJson("cd_clima_units", []);
        if (Array.isArray(lista) && lista.length) {
          lista[lista.length - 1] = { ...lista[lista.length - 1], valvola };
          writeJsonIfChanged("cd_clima_units", lista);
          root.buildClimaCards?.();
        }
        const casella = doc?.getElementById?.(CAMPO_ID);
        if (casella) casella.value = "";
      }
    } catch (_error) {}
    return esito;
  }
  Object.assign(conValvola, originale);
  conValvola.__dmTrvPerUnita = true;
  conValvola.__dmPrevious = originale;
  root.edAddClima = conValvola;
  return true;
}

function onClick(event) {
  if (!event.target?.closest?.("[data-dm-trv-pick]")) return;
  event.preventDefault();
  const casella = doc?.getElementById?.(CAMPO_ID);
  if (casella) root.wzPickEntity?.(casella);
}

export function installTrvEditor() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyle(
    "dm-trv-editor-style",
    `
    #ed-body .dm-trv-slot{display:block;margin:0 0 10px}
    #ed-body .dm-trv-slot small{display:block;margin:2px 2px 0;font-size:11px;line-height:1.45;color:var(--text-dim,#64748b)}
    `,
  );
  doc.addEventListener("click", onClick);
  const installa = () => {
    agganciaAggiunta();
    ensureTrvField();
  };
  onEditorRedraw("__dmTrvEditor", () => root.queueMicrotask?.(installa));
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:editor-rendered"])
    root.addEventListener?.(evento, () => root.queueMicrotask?.(installa));
  installa();
  return true;
}

installTrvEditor();
