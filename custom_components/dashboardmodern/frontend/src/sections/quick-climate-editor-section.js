/* I parametri del tasto «Clima» rapido, scelti unita' per unita'.
 *
 * Il popup della Home accende una stanza in tre passi — modalita', temperatura,
 * ventola — e quei tre passi erano scritti nel codice; poi sono diventati
 * configurabili, ma con un blocco solo, globale, sopra le unita': «come e'
 * impostato ora viene attribuito quel valore a tutto». La cameretta che vuole
 * 24 gradi e il salone che ne vuole 26 non ci stavano.
 *
 * Adesso i tre campi stanno DOVE si configura l'unita': nel form di aggiunta,
 * prima di «Aggiungi unita' clima», e nella finestra della matita. Ogni unita'
 * ha i suoi passi; la chiave globale storica resta il ripiego di chi non ha
 * mai specificato niente.
 *
 * Le tendine offrono solo quello che l'unita' dichiara di accettare; quando
 * non dichiara nulla — integrazioni lente o senza attributi — si offrono le
 * modalita' e le quattro velocita' standard di Home Assistant, perche' una
 * scheda senza scelte e' peggio di una scheda con una scelta in piu'.
 */
import {
  QUICK_CLIMATE_DEFAULT,
  QUICK_CLIMATE_FAN_FALLBACK,
  QUICK_CLIMATE_KEY,
  QUICK_CLIMATE_MODES,
  QUICK_CLIMATE_UNITS_KEY,
  normalizeQuickClimate,
  quickClimateForUnit,
  quickClimateHint,
  quickClimateSteps,
} from "../core/quick-climate.js";
import { climateUnits } from "./climate-thermal-section.js";
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
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_QUICK_CLIMATE_EDITOR__";
const STYLE_ID = "dm-quick-climate-style";
const BLOCK_ID = "dm-quick-climate";
const state = (root[KEY] ||= { installed: false, osservato: null, osservatore: null });

const NOMI = () => ({
  cool: t("Raffrescamento", "Cooling"),
  heat: t("Riscaldamento", "Heating"),
  heat_cool: t("Automatico caldo/freddo", "Heat/cool"),
  auto: t("Automatico", "Auto"),
  dry: t("Deumidificazione", "Dry"),
  fan_only: t("Solo ventola", "Fan only"),
});

/* I nomi delle velocita' comuni: i valori restano quelli che l'unita' accetta,
 * ma «medium» a chi legge dice meno di «Media». Le velocita' fuori elenco
 * escono col loro nome grezzo, che e' l'unico che hanno. */
const NOMI_VENTOLA = () => ({
  auto: t("Automatica", "Auto"),
  low: t("Bassa", "Low"),
  medium: t("Media", "Medium"),
  high: t("Alta", "High"),
});

function impostazione() {
  return normalizeQuickClimate(readJson(QUICK_CLIMATE_KEY, QUICK_CLIMATE_DEFAULT));
}

function presetDi(entita) {
  return quickClimateForUnit(entita, readJson(QUICK_CLIMATE_UNITS_KEY, {}), impostazione());
}

function salvaPresetDi(entita, scelta) {
  const chiave = clean(entita);
  if (!chiave) return false;
  const tutti = readJson(QUICK_CLIMATE_UNITS_KEY, {});
  const mappa = tutti && typeof tutti === "object" && !Array.isArray(tutti) ? { ...tutti } : {};
  mappa[chiave] = normalizeQuickClimate(scelta);
  return writeJsonIfChanged(QUICK_CLIMATE_UNITS_KEY, mappa);
}

/* Cosa accetta QUESTA unita' — o l'unione di tutte, quando non si sa ancora
 * quale entita' si sta scrivendo (il form di aggiunta prima della scelta). */
function accettate(entita = "") {
  const states = allStates();
  const chiave = clean(entita);
  const modi = new Set();
  const ventole = new Set();
  for (const unita of climateUnits()) {
    if (chiave && clean(unita?.entity) !== chiave) continue;
    const stato = states?.[clean(unita?.entity)];
    for (const voce of stato?.attributes?.hvac_modes || [])
      if (QUICK_CLIMATE_MODES.includes(clean(voce).toLowerCase()))
        modi.add(clean(voce).toLowerCase());
    for (const voce of stato?.attributes?.fan_modes || []) if (clean(voce)) ventole.add(clean(voce));
  }
  if (chiave && !ventole.size && !modi.size) {
    /* Entita' scritta a mano e non ancora fra le unita': si legge direttamente. */
    const stato = states?.[chiave];
    for (const voce of stato?.attributes?.hvac_modes || [])
      if (QUICK_CLIMATE_MODES.includes(clean(voce).toLowerCase()))
        modi.add(clean(voce).toLowerCase());
    for (const voce of stato?.attributes?.fan_modes || []) if (clean(voce)) ventole.add(clean(voce));
  }
  return {
    modi: modi.size ? QUICK_CLIMATE_MODES.filter((voce) => modi.has(voce)) : [...QUICK_CLIMATE_MODES],
    /* Prima la ventola restava SENZA scelte quando nessuna unita' dichiarava le
     * sue: solo «Non toccare», e nessun posto dove dire «alta». */
    ventole: ventole.size ? [...ventole] : [...QUICK_CLIMATE_FAN_FALLBACK],
  };
}

/* I tre campi, pronti da mettere in un form. `scelta` e' il preset da mostrare,
 * `entita` restringe le tendine a quello che quell'unita' accetta. */
export function quickClimateFieldsMarkup(entita = "", scelta = null) {
  const preset = scelta ? normalizeQuickClimate(scelta) : presetDi(entita);
  const { modi, ventole } = accettate(entita);
  const nomi = NOMI();
  const nomiVentola = NOMI_VENTOLA();
  const opzioniModo = modi
    .map(
      (voce) =>
        `<option value="${esc(voce)}"${voce === preset.mode ? " selected" : ""}>${esc(nomi[voce] || voce)}</option>`,
    )
    .join("");
  const opzioniVentola = [
    `<option value=""${preset.fan ? "" : " selected"}>— ${esc(t("Non toccare", "Leave alone"))} —</option>`,
    ...ventole.map(
      (voce) =>
        `<option value="${esc(voce)}"${voce === preset.fan ? " selected" : ""}>${esc(nomiVentola[voce.toLowerCase()] || voce)}</option>`,
    ),
  ].join("");
  return `<div class="dm-quick-climate-row">
      <label>
        <span>${esc(t("Modalità", "Mode"))}</span>
        <select class="ed-input" data-dm-quick-climate="mode">${opzioniModo}</select>
      </label>
      <label>
        <span>${esc(t("Temperatura", "Temperature"))}</span>
        <input class="ed-input" type="number" min="5" max="35" step="0.5"
          inputmode="decimal" data-dm-quick-climate="temperature"
          placeholder="${esc(t("Non toccare", "Leave alone"))}"
          value="${preset.temperature == null ? "" : esc(String(preset.temperature))}">
      </label>
      <label>
        <span>${esc(t("Ventola", "Fan"))}</span>
        <select class="ed-input" data-dm-quick-climate="fan">${opzioniVentola}</select>
      </label>
    </div>`;
}

/* Legge i tre campi da un form (o da un pezzo di documento) e li salva per
 * l'entita' detta. Torna la scelta letta, che il chiamante puo' mostrare. */
export function salvaQuickClimateDaCampi(contenitore, entita) {
  const campo = (quale) => contenitore?.querySelector?.(`[data-dm-quick-climate="${quale}"]`);
  const grezza = {
    mode: clean(campo("mode")?.value),
    temperature: clean(campo("temperature")?.value) === "" ? null : campo("temperature")?.value,
    fan: clean(campo("fan")?.value),
  };
  const scelta = normalizeQuickClimate(grezza);
  salvaPresetDi(entita, scelta);
  return scelta;
}

function anteprima(scelta) {
  return quickClimateHint(scelta, {
    tap: t("Toccando una stanza", "Tapping a room"),
    fan: t("ventola", "fan"),
    modes: NOMI(),
  });
}

/* Il blocco sta NEL form di aggiunta, prima del tasto «Aggiungi unita' clima»:
 * i passi si dicono quando si configura l'entita', non in un blocco globale
 * sopra che vale per tutto. */
function tastoAggiungi() {
  const body = doc?.getElementById?.("ed-body");
  return body?.querySelector?.('[onclick*="edAddClima"]') || null;
}

export function ensureQuickClimateBlock() {
  const body = doc?.getElementById?.("ed-body");
  const dentroClima = Boolean(body?.querySelector?.("#ed-cl-ent"));
  let blocco = doc?.getElementById?.(BLOCK_ID);
  if (!dentroClima) {
    blocco?.remove();
    return false;
  }
  const aggiungi = tastoAggiungi();
  if (!aggiungi) return false;
  const { modi, ventole } = accettate();
  const firma = `form§${modi.join(",")}§${ventole.join(",")}`;
  if (!blocco) {
    blocco = doc.createElement("section");
    blocco.id = BLOCK_ID;
    blocco.className = "dm-quick-climate";
    aggiungi.before(blocco);
  } else if (blocco.nextElementSibling !== aggiungi) {
    aggiungi.before(blocco);
  }
  if (blocco.dataset.firma === firma) return false;
  blocco.dataset.firma = firma;
  blocco.innerHTML = `<div class="ed-slot dm-quick-climate-slot">
      <span class="ed-slot-lbl">${esc(t("Tasto Clima rapido", "Quick climate button"))}</span>
      <p class="ed-intro dm-quick-climate-intro">${esc(
        t(
          "È quello che fa il tasto di QUESTA unità nel popup Clima della Home. Ogni unità ha i suoi passi, modificabili anche dalla matita; temperatura e ventola vuote vuol dire che il tasto non le tocca.",
          "This is what THIS unit's button does in the Home climate popup. Each unit keeps its own steps, editable from the pencil too; empty temperature and fan mean the button leaves them alone.",
        ),
      )}</p>
      ${quickClimateFieldsMarkup("", impostazione())}
    </div>`;
  return true;
}

/* Quando il guscio aggiunge l'unita', i tre campi del form diventano i passi
 * di QUELLA unita': la si riconosce perche' e' l'ultima della lista. */
function agganciaAggiunta() {
  const originale = root.edAddClima;
  if (typeof originale !== "function" || originale.__dmQuickClimatePerUnita) return;
  function conPreset(...args) {
    const prima = climateUnits().length;
    const esito = originale.apply(this, args);
    try {
      const unita = climateUnits();
      if (unita.length > prima) {
        const nuova = unita[unita.length - 1];
        const blocco = doc?.getElementById?.(BLOCK_ID);
        if (nuova?.entity && blocco) salvaQuickClimateDaCampi(blocco, nuova.entity);
      }
    } catch (_error) {}
    return esito;
  }
  Object.assign(conPreset, originale);
  conPreset.__dmQuickClimatePerUnita = true;
  conPreset.__dmPrevious = originale;
  root.edAddClima = conPreset;
}

/* La porta per il runtime storico: i passi di UNA entita'. Senza entita' — o
 * per chi chiama ancora alla vecchia maniera — escono quelli globali. */
function publishQuickClimate() {
  root.dmQuickClimateSteps = (entita) => quickClimateSteps(presetDi(entita));
  root.dmQuickClimateHint = (parole) => {
    /* Con preset per unita' una riga sola non puo' dire i passi di tutte:
     * si dice la verita' generica invece del dettaglio di una sola. */
    const perUnita = readJson(QUICK_CLIMATE_UNITS_KEY, {});
    if (perUnita && typeof perUnita === "object" && Object.keys(perUnita).length) {
      return t(
        "Tocca una stanza: ogni unità accende con i suoi passi",
        "Tap a room: each unit starts with its own steps",
      );
    }
    return anteprima(impostazione()) || parole;
  };
}

function css() {
  return `
      #ed-body .dm-quick-climate{display:block;margin:10px 0}
      #ed-body .dm-quick-climate-slot{display:flex;flex-direction:column;gap:8px}
      #ed-body .dm-quick-climate-intro{margin:0}
      .dm-quick-climate-row{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}
      .dm-quick-climate-row label{display:flex;flex-direction:column;gap:4px;min-width:0}
      .dm-quick-climate-row label>span{
        font-size:11.5px;font-weight:700;color:var(--text-dim,#64748b)}
    `;
}

function aggancia() {
  onEditorRedraw("dmQuickClimate", () => {
    agganciaAggiunta();
    return ensureQuickClimateBlock();
  });
  const body = doc?.getElementById?.("ed-body");
  if (!body || state.osservato === body) return;
  state.osservato = body;
  state.osservatore?.disconnect?.();
  if (typeof root.MutationObserver !== "function") return;
  state.osservatore = new root.MutationObserver(() => {
    root.queueMicrotask?.(ensureQuickClimateBlock);
  });
  state.osservatore.observe(body, { childList: true });
}

export function installQuickClimateEditorSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyle(STYLE_ID, css());
  publishQuickClimate();
  agganciaAggiunta();
  doc.addEventListener("click", () => root.queueMicrotask?.(aggancia), true);
  aggancia();
  ensureQuickClimateBlock();
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", installQuickClimateEditorSection, { once: true });
} else {
  installQuickClimateEditorSection();
}
