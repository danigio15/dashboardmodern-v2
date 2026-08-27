/* I parametri del tasto «Clima» rapido, scelti da chi lo usa.
 *
 * Il popup della Home accende una stanza in tre passi — modalita', temperatura,
 * ventola — e quei tre passi erano scritti nel codice: freddo, ventisei gradi,
 * ventola automatica. Chi voleva altro non aveva nessun posto dove dirlo.
 *
 * Il blocco sta nella scheda Clima, sotto le unita', e offre solo quello che le
 * unita' configurate dichiarano di accettare: una modalita' che il
 * condizionatore non ha e' un tasto che non fa niente, ed e' la stessa regola
 * dell'antifurto. La temperatura e la ventola si possono lasciare vuote, e
 * vuoto vuol dire «non toccare» — chi la temperatura la governa dal termostato
 * non vuole che il tasto gliela riscriva.
 *
 * La regola di cosa vuol dire un'impostazione sta nel modello puro; qui c'e'
 * solo il modo di dirla, e la porta che il runtime storico attraversa per
 * leggerla.
 */
import {
  QUICK_CLIMATE_DEFAULT,
  QUICK_CLIMATE_KEY,
  QUICK_CLIMATE_MODES,
  normalizeQuickClimate,
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

function impostazione() {
  return normalizeQuickClimate(readJson(QUICK_CLIMATE_KEY, QUICK_CLIMATE_DEFAULT));
}

/* Cosa accettano le unita' configurate: l'unione di quello che dichiarano.
 *
 * Si chiede alle entita', non a un elenco scritto qui: un condizionatore che
 * domani impara una modalita' in piu' la offre da solo. Se non ne dichiara
 * nessuna — capita alle integrazioni che rispondono tardi — si mostrano tutte,
 * perche' una scheda senza scelte e' peggio di una scheda con una scelta in
 * piu'. */
function accettate() {
  const states = allStates();
  const modi = new Set();
  const ventole = new Set();
  for (const unita of climateUnits()) {
    const stato = states?.[clean(unita?.entity)];
    for (const voce of stato?.attributes?.hvac_modes || [])
      if (QUICK_CLIMATE_MODES.includes(clean(voce).toLowerCase()))
        modi.add(clean(voce).toLowerCase());
    for (const voce of stato?.attributes?.fan_modes || []) if (clean(voce)) ventole.add(clean(voce));
  }
  return {
    modi: modi.size ? QUICK_CLIMATE_MODES.filter((voce) => modi.has(voce)) : [...QUICK_CLIMATE_MODES],
    ventole: [...ventole],
  };
}

function markup() {
  const scelta = impostazione();
  const { modi, ventole } = accettate();
  const nomi = NOMI();
  const opzioniModo = modi
    .map(
      (voce) =>
        `<option value="${esc(voce)}"${voce === scelta.mode ? " selected" : ""}>${esc(nomi[voce] || voce)}</option>`,
    )
    .join("");
  const opzioniVentola = [
    `<option value=""${scelta.fan ? "" : " selected"}>— ${esc(t("Non toccare", "Leave alone"))} —</option>`,
    ...ventole.map(
      (voce) =>
        `<option value="${esc(voce)}"${voce === scelta.fan ? " selected" : ""}>${esc(voce)}</option>`,
    ),
  ].join("");
  return `<div class="ed-slot dm-quick-climate-slot">
      <span class="ed-slot-lbl">${esc(t("Tasto Clima rapido", "Quick climate button"))}</span>
      <p class="ed-intro dm-quick-climate-intro">${esc(
        t(
          "È quello che succede quando si tocca una stanza nel popup Clima della Home. Ci sono solo le modalità che le unità configurate accettano davvero; temperatura e ventola si possono lasciare vuote, e vuoto vuol dire che il tasto non le tocca.",
          "This is what happens when you tap a room in the Home climate popup. Only the modes your configured units actually accept are listed; temperature and fan can be left empty, and empty means the button leaves them alone.",
        ),
      )}</p>
      <div class="dm-quick-climate-row">
        <label>
          <span>${esc(t("Modalità", "Mode"))}</span>
          <select class="ed-input" data-dm-quick-climate="mode">${opzioniModo}</select>
        </label>
        <label>
          <span>${esc(t("Temperatura", "Temperature"))}</span>
          <input class="ed-input" type="number" min="5" max="35" step="0.5"
            inputmode="decimal" data-dm-quick-climate="temperature"
            placeholder="${esc(t("Non toccare", "Leave alone"))}"
            value="${scelta.temperature == null ? "" : esc(String(scelta.temperature))}">
        </label>
        <label>
          <span>${esc(t("Ventola", "Fan"))}</span>
          <select class="ed-input" data-dm-quick-climate="fan">${opzioniVentola}</select>
        </label>
      </div>
      <output class="dm-quick-climate-eco">${esc(anteprima(scelta))}</output>
    </div>`;
}

function anteprima(scelta) {
  return quickClimateHint(scelta, {
    tap: t("Toccando una stanza", "Tapping a room"),
    fan: t("ventola", "fan"),
    modes: NOMI(),
  });
}

/* La casella delle unita' clima e' quella che dice che siamo nella scheda
 * giusta. Si guarda quella, non quale linguetta risulta accesa: chi disegna la
 * scheda annuncia di averla rifatta prima di accendere la linguetta. */
function ancora() {
  const body = doc?.getElementById?.("ed-body");
  if (!body) return null;
  return body.querySelector("#ed-cl-ent, [data-clima-list], .ed-list") || null;
}

export function ensureQuickClimateBlock() {
  const body = doc?.getElementById?.("ed-body");
  const dentroClima = Boolean(body?.querySelector?.("#ed-cl-ent"));
  let blocco = doc?.getElementById?.(BLOCK_ID);
  if (!dentroClima) {
    blocco?.remove();
    return false;
  }
  const scelta = impostazione();
  const { modi, ventole } = accettate();
  const firma = `${scelta.mode}|${scelta.temperature}|${scelta.fan}§${modi.join(",")}§${ventole.join(",")}`;
  if (!blocco) {
    blocco = doc.createElement("section");
    blocco.id = BLOCK_ID;
    blocco.className = "dm-quick-climate";
    const posto = ancora();
    if (posto) posto.after(blocco);
    else body.prepend(blocco);
  }
  if (blocco.dataset.firma === firma) return false;
  blocco.dataset.firma = firma;
  blocco.innerHTML = markup();
  return true;
}

function onChange(event) {
  const campo = event.target?.closest?.("[data-dm-quick-climate]");
  if (!campo || !doc?.getElementById?.(BLOCK_ID)?.contains(campo)) return;
  event.stopPropagation();
  const quale = clean(campo.getAttribute("data-dm-quick-climate"));
  const scelta = { ...impostazione() };
  if (quale === "temperature") scelta.temperature = clean(campo.value) === "" ? null : campo.value;
  else scelta[quale] = campo.value;
  const pulita = normalizeQuickClimate(scelta);
  writeJsonIfChanged(QUICK_CLIMATE_KEY, pulita);
  const eco = doc.getElementById(BLOCK_ID)?.querySelector(".dm-quick-climate-eco");
  if (eco) eco.textContent = anteprima(pulita);
  root.edToast?.(t("❄️ Tasto Clima aggiornato", "❄️ Quick climate updated"));
}

/* La porta per il runtime storico, che e' uno script normale e non puo'
 * importare un modulo: gli si consegnano i passi gia' tradotti, cosi' la regola
 * resta una sola e sta nel modello. */
function publishQuickClimate() {
  root.dmQuickClimateSteps = () => quickClimateSteps(impostazione());
  root.dmQuickClimateHint = (parole) => anteprima(impostazione()) || parole;
}

function css() {
  return `
      #ed-body .dm-quick-climate-slot{display:flex;flex-direction:column;gap:8px}
      #ed-body .dm-quick-climate-intro{margin:0}
      #ed-body .dm-quick-climate-row{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}
      #ed-body .dm-quick-climate-row label{display:flex;flex-direction:column;gap:4px;min-width:0}
      #ed-body .dm-quick-climate-row label>span{
        font-size:11.5px;font-weight:700;color:var(--text-dim,#64748b)}
      #ed-body .dm-quick-climate-eco{
        font-size:12px;font-weight:700;color:var(--primary-color,#0284c7);
        background:color-mix(in srgb,var(--primary-color,#0ea5e9) 10%,transparent);
        border-radius:12px;padding:8px 11px}
    `;
}

function aggancia() {
  onEditorRedraw("dmQuickClimate", ensureQuickClimateBlock);
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
  doc.addEventListener("change", onChange, true);
  doc.addEventListener("click", () => root.queueMicrotask?.(aggancia), true);
  aggancia();
  ensureQuickClimateBlock();
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", installQuickClimateEditorSection, { once: true });
} else {
  installQuickClimateEditorSection();
}
