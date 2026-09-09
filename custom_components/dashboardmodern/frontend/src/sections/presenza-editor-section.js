/* La scheda della presenza in configurazione (#432).
 *
 * Non c'è niente da compilare per cominciare: un sensore di movimento o di
 * presenza lo dichiara Home Assistant col suo `device_class`, e la pagina
 * Presenza compare da sola. Questa scheda serve alle tre cose che il
 * rilevamento non può sapere:
 *
 *   · un sensore etichettato «motion» che la casa non la guarda — quello del
 *     cortile, quello del vialetto — e non deve contare fra le stanze;
 *   · un rilevatore che nessuno ha etichettato, e che quindi non viene trovato;
 *   · un nome. «Motion 3C» non dice a nessuno di quale stanza si parla, ed è
 *     esattamente la cosa che quella pagina esiste per dire.
 *
 * È la stessa forma della scheda dei Varchi, perché è lo stesso problema:
 * l'elenco lo fa Home Assistant, e qui si corregge. Ogni gesto si salva
 * subito — chi tocca queste caselle sta rispondendo a una domanda, e aspettare
 * un tasto vorrebbe solo dire perdere la risposta chiudendo la scheda.
 */
import { CHIAVE_PRESENZA, normalizzaPresenza, presenzaDiCasa } from "../core/presenza-in-casa.js";
import { PRESENZA_TAB, renderPresenza } from "./presenza-section.js";
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
import { nomeDaHomeAssistant } from "./editor-slots-section.js";

const KEY = "__DASHBOARDMODERN_PRESENZA_EDITOR__";
const state = (root[KEY] ||= { installed: false });

export const PRESENZA_EDITOR_TAB = PRESENZA_TAB;

function configurazione() {
  return normalizzaPresenza(readJson(CHIAVE_PRESENZA, {}));
}

function salva(prossima) {
  writeJsonIfChanged(CHIAVE_PRESENZA, prossima);
  renderPresenza();
  ridisegna();
}

function activeTab() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

function ridisegna() {
  const body = doc?.getElementById("ed-body");
  if (body) delete body.dataset.dmPresenzaEditor;
  ensurePresenzaEditor();
}

/* ── il disegno della scheda ──────────────────────────────────────────── */

function rigaMarkup(riga, scelte) {
  const aggiunto = scelte.aggiunte.includes(riga.entity);
  return `<article class="ed-row dm-presenza-ed-riga" data-presenza="${esc(riga.stato || "muto")}">
    <span class="dm-presenza-ed-ic" aria-hidden="true">${esc(riga.glifo)}</span>
    <div class="ed-row-main dm-presenza-ed-testo">
      <input class="ed-input dm-presenza-ed-nome" value="${esc(riga.name)}"
        data-dm-presenza-nome="${esc(riga.entity)}" aria-label="${esc(t("Nome", "Name"))}">
      <small class="ed-row-old mono">${esc(riga.entity)}${aggiunto ? ` · ${esc(t("aggiunto a mano", "added by hand"))}` : ""}</small>
    </div>
    <button type="button" class="ed-del dm-presenza-ed-togli" data-dm-presenza-escludi="${esc(riga.entity)}"
      title="${esc(t("Togli dall'elenco", "Drop from the list"))}"
      aria-label="${esc(t("Togli dall'elenco", "Drop from the list"))}">🗑️</button>
  </article>`;
}

function fuoriMarkup(scelte) {
  if (!scelte.escluse.length) return "";
  return `<div class="dm-presenza-ed-elenco">${scelte.escluse
    .map(
      (entity) =>
        `<span class="dm-presenza-ed-fuori">${esc(entity)}<button type="button" class="ed-del" data-dm-presenza-riprendi="${esc(entity)}" aria-label="${esc(t("Rimetti", "Put back"))}">✕</button></span>`,
    )
    .join("")}</div>`;
}

function schedaMarkup() {
  const scelte = configurazione();
  const states = allStates();
  /* Le escluse si tolgono DOPO, non prima: chieste senza, il modello le
   * riporta con nome e stato, e qui sotto compaiono nella riga dei tolti con
   * il loro identificativo. Chiedendo l'elenco già filtrato non ci sarebbe
   * modo di rimetterle dentro. */
  const righe = presenzaDiCasa(states, { ...scelte, escluse: [] }, (entity) =>
    nomeDaHomeAssistant(entity, states),
  ).filter((riga) => !scelte.escluse.includes(riga.entity));
  return `<div class="ed-intro">${esc(
    t(
      "I sensori di movimento e di presenza li dichiara Home Assistant da sé, e la pagina Presenza compare da sola: in cima in quante stanze c'è qualcuno, sotto una carta per rilevatore con da quanto sta così. Qui si corregge quel rilevamento — si toglie il sensore del cortile che la casa non la guarda, si aggiunge uno che non viene trovato, e si dà un nome a chi si chiama «Motion 3C».",
      "Home Assistant declares motion and presence sensors itself, and the Presence page appears on its own: how many rooms have someone in them on top, and one card per detector below with how long it has been that way. Here you correct that — drop the yard sensor that is not watching the house, add one that is not found, and give a name to whatever is called “Motion 3C”.",
    ),
  )}</div>

  <label class="ed-slot dm-presenza-ed-campo"><span class="ed-slot-lbl">${esc(t("Aggiungi un rilevatore che non viene trovato", "Add a detector that is not found"))}</span>
    <span class="ed-form-row"><input id="dm-presenza-aggiungi" class="ed-input mono" placeholder="binary_sensor.movimento_salone"
      autocomplete="off" spellcheck="false"><button type="button" class="dm-entity-picker"
      data-dm-presenza-pick="dm-presenza-aggiungi" aria-label="${esc(t("Scegli entità", "Choose entity"))}">🔍</button>
      <button type="button" class="ed-btn-add" data-dm-presenza-aggiungi>${esc(t("Aggiungi", "Add"))}</button></span>
    <small>${esc(t("Un rilevatore che Home Assistant non ha etichettato — un template fatto in casa, un varco usato come sentinella — non viene trovato: qui gli si dice che guarda una stanza.", "A detector Home Assistant has not labelled — a template of your own, an opening used as a tripwire — is not found: here you say it watches a room."))}</small>
  </label>

  <div class="ed-slot-lbl dm-presenza-ed-titolo">${esc(t("I rilevatori di casa", "The detectors at home"))}</div>
  ${
    righe.length
      ? `<div class="ed-list dm-presenza-ed-lista">${righe.map((riga) => rigaMarkup(riga, scelte)).join("")}</div>`
      : `<div class="ed-empty">${esc(t("Nessun rilevatore trovato", "No detector found"))}</div>`
  }
  ${scelte.escluse.length ? `<div class="ed-slot-lbl dm-presenza-ed-titolo">${esc(t("Tolti dai conti", "Dropped from the count"))}</div>` : ""}
  ${fuoriMarkup(scelte)}`;
}

export function ensurePresenzaEditor() {
  const body = doc?.getElementById("ed-body");
  if (!body || activeTab() !== PRESENZA_EDITOR_TAB) return false;
  if (body.dataset.dmPresenzaEditor === "true") return false;
  body.dataset.dmPresenzaEditor = "true";
  body.innerHTML = `<div class="dm-presenza-ed">${schedaMarkup()}</div>`;
  return true;
}

export function ensurePresenzaEditorTab() {
  const tabs = doc?.querySelector(".ed-tab")?.parentElement;
  if (!tabs || tabs.querySelector(`.ed-tab[data-tab="${PRESENZA_EDITOR_TAB}"]`)) return false;
  const tab = doc.createElement("button");
  tab.className = "ed-tab";
  tab.dataset.tab = PRESENZA_EDITOR_TAB;
  tab.textContent = `🏃 ${t("Presenza", "Presence")}`;
  tab.addEventListener("click", () => root.editorSwitch?.(PRESENZA_EDITOR_TAB));
  const prima = tabs.querySelector('.ed-tab[data-tab="runtime"]');
  if (prima) prima.before(tab);
  else tabs.append(tab);
  return true;
}

/* ── i gesti ──────────────────────────────────────────────────────────── */

function onClick(event) {
  const body = doc?.getElementById("ed-body");
  if (!body || activeTab() !== PRESENZA_EDITOR_TAB || !body.contains(event.target)) return;
  const scelte = configurazione();

  const lente = event.target.closest("[data-dm-presenza-pick]");
  if (lente) {
    event.preventDefault();
    const campo = body.querySelector(`#${CSS.escape(clean(lente.dataset.dmPresenzaPick))}`);
    if (campo) root.wzPickEntity?.(campo);
    return;
  }

  if (event.target.closest("[data-dm-presenza-aggiungi]")) {
    event.preventDefault();
    const entity = clean(body.querySelector("#dm-presenza-aggiungi")?.value);
    if (!entity.includes(".")) return;
    salva({
      ...scelte,
      aggiunte: [...new Set([...scelte.aggiunte, entity])],
      escluse: scelte.escluse.filter((voce) => voce !== entity),
    });
    root.edToast?.(t("🏃 Rilevatore aggiunto alla presenza", "🏃 Detector added to presence"));
    return;
  }

  const togli = event.target.closest("[data-dm-presenza-escludi]");
  if (togli) {
    event.preventDefault();
    const entity = clean(togli.dataset.dmPresenzaEscludi);
    salva({
      ...scelte,
      escluse: [...new Set([...scelte.escluse, entity])],
      aggiunte: scelte.aggiunte.filter((voce) => voce !== entity),
    });
    return;
  }

  const rimetti = event.target.closest("[data-dm-presenza-riprendi]");
  if (rimetti) {
    event.preventDefault();
    const entity = clean(rimetti.dataset.dmPresenzaRiprendi);
    salva({ ...scelte, escluse: scelte.escluse.filter((voce) => voce !== entity) });
    return;
  }
}

/* Il nome si salva mentre lo si scrive, e la scheda NON si ridisegna: un
 * ridisegno a ogni lettera porterebbe via il cursore dalla casella. */
function onInput(event) {
  const campo = event.target?.closest?.("[data-dm-presenza-nome]");
  if (!campo) return;
  const entity = clean(campo.dataset.dmPresenzaNome);
  if (!entity) return;
  const scelte = configurazione();
  const nomi = { ...scelte.nomi };
  const scritto = clean(campo.value);
  if (scritto) nomi[entity] = scritto;
  else delete nomi[entity];
  writeJsonIfChanged(CHIAVE_PRESENZA, { ...scelte, nomi });
  renderPresenza();
}

function installStyles() {
  installStyle(
    "dm-presenza-editor-style",
    `
    #ed-body .dm-presenza-ed{display:grid!important;gap:12px!important}
    #ed-body .dm-presenza-ed-titolo{margin-top:6px!important}
    #ed-body .dm-presenza-ed-lista{display:grid!important;gap:8px!important}
    #ed-body .dm-presenza-ed-riga{
      display:grid!important;grid-template-columns:40px minmax(0,1fr) 40px!important;
      align-items:center!important;gap:10px!important;
      border-left:4px solid var(--dm-presenza,#94a3b8)!important}
    #ed-body .dm-presenza-ed-riga[data-presenza="attivo"]{--dm-presenza:#2563eb}
    #ed-body .dm-presenza-ed-riga[data-presenza="libero"]{--dm-presenza:#16a34a}
    #ed-body .dm-presenza-ed-riga[data-presenza="muto"]{--dm-presenza:#94a3b8}
    #ed-body .dm-presenza-ed-ic{
      display:grid!important;place-items:center!important;width:40px!important;height:40px!important;
      border-radius:12px!important;font-size:18px!important;
      background:color-mix(in srgb,var(--dm-presenza,#94a3b8) 20%,transparent)!important}
    #ed-body .dm-presenza-ed-testo{display:grid!important;gap:4px!important;min-width:0!important}
    #ed-body .dm-presenza-ed-nome{width:100%!important;min-width:0!important}
    #ed-body .dm-presenza-ed-elenco{display:flex!important;flex-wrap:wrap!important;gap:8px!important}
    #ed-body .dm-presenza-ed-fuori{
      display:inline-flex!important;align-items:center!important;gap:6px!important;
      padding:4px 6px 4px 12px!important;border-radius:999px!important;font-size:11.5px!important;
      font-weight:800!important;font-family:ui-monospace,monospace!important;
      background:var(--secondary-background-color,#eef2f7)!important;color:var(--text,#0f172a)!important}
    `,
  );
}

export function installPresenzaEditor() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  ensurePresenzaEditorTab();
  onEditorRedraw("__dmPresenzaEditor", () => {
    root.queueMicrotask?.(() => {
      ensurePresenzaEditorTab();
      ensurePresenzaEditor();
    });
  });
  doc.addEventListener("click", onClick);
  doc.addEventListener("input", onInput);
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:editor-rendered"])
    root.addEventListener?.(evento, () => {
      root.queueMicrotask?.(() => {
        ensurePresenzaEditorTab();
        ensurePresenzaEditor();
      });
    });
  return true;
}

installPresenzaEditor();
