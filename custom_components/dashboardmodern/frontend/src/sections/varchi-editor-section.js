/* La scheda dei varchi in configurazione (#367, #377).
 *
 * Non c'è niente da compilare per cominciare: un contatto porta-finestra lo
 * dichiara Home Assistant col suo `device_class`, e la pagina Varchi compare da
 * sola. Questa scheda serve alle tre cose che il rilevamento non può sapere:
 *
 *   · un sensore etichettato «door» che porta non è — quello del frigorifero,
 *     quello della cassetta della posta — e non deve contare fra i varchi;
 *   · un contatto che nessuno ha etichettato, e che quindi non viene trovato;
 *   · un nome. «Contact 4B» non dice a nessuno quale porta è.
 *
 * È la stessa forma della scheda dell'aria, perché è lo stesso problema:
 * l'elenco lo fa Home Assistant, e qui si corregge. Ogni gesto si salva
 * subito — chi tocca queste caselle sta rispondendo a una domanda, e aspettare
 * un tasto vorrebbe solo dire perdere la risposta chiudendo la scheda.
 */
import { CHIAVE_VERSI, insiemeInvertiti } from "../core/verso-aperture.js";
import { CHIAVE_VARCHI, normalizzaVarchi, varchiDiCasa } from "../core/varchi-di-casa.js";
import { VARCHI_TAB, renderVarchi } from "./varchi-section.js";
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

const KEY = "__DASHBOARDMODERN_VARCHI_EDITOR__";
const state = (root[KEY] ||= { installed: false });

export const VARCHI_EDITOR_TAB = VARCHI_TAB;

function configurazione() {
  return normalizzaVarchi(readJson(CHIAVE_VARCHI, {}));
}

function salva(prossima) {
  writeJsonIfChanged(CHIAVE_VARCHI, prossima);
  renderVarchi();
  ridisegna();
}

function activeTab() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

function ridisegna() {
  const body = doc?.getElementById("ed-body");
  if (body) delete body.dataset.dmVarchiEditor;
  ensureVarchiEditor();
}

/* ── il disegno della scheda ──────────────────────────────────────────── */

function rigaMarkup(riga, scelte) {
  const aggiunto = scelte.aggiunte.includes(riga.entity);
  return `<article class="ed-row dm-varco-ed-riga" data-varco="${esc(riga.stato || "muto")}">
    <span class="dm-varco-ed-ic" aria-hidden="true">${esc(riga.glifo)}</span>
    <div class="ed-row-main dm-varco-ed-testo">
      <input class="ed-input dm-varco-ed-nome" value="${esc(riga.name)}"
        data-dm-varco-nome="${esc(riga.entity)}" aria-label="${esc(t("Nome", "Name"))}">
      <small class="ed-row-old mono">${esc(riga.entity)}${aggiunto ? ` · ${esc(t("aggiunto a mano", "added by hand"))}` : ""}</small>
    </div>
    <button type="button" class="ed-del dm-varco-ed-togli" data-dm-varco-escludi="${esc(riga.entity)}"
      title="${esc(t("Non contare questo contatto", "Do not count this contact"))}"
      aria-label="${esc(t("Non contare questo contatto", "Do not count this contact"))}">🚫</button>
  </article>`;
}

function fuoriMarkup(scelte) {
  if (!scelte.escluse.length) return "";
  return `<div class="dm-varco-ed-elenco">${scelte.escluse
    .map(
      (entity) =>
        `<span class="dm-varco-ed-fuori">${esc(entity)}<button type="button" class="ed-del" data-dm-varco-riprendi="${esc(entity)}" aria-label="${esc(t("Rimetti", "Put back"))}">✕</button></span>`,
    )
    .join("")}</div>`;
}

function schedaMarkup() {
  const scelte = configurazione();
  const states = allStates();
  const righe = varchiDiCasa(
    states,
    { ...scelte, escluse: [] },
    insiemeInvertiti(readJson(CHIAVE_VERSI, {})),
    (entity) => nomeDaHomeAssistant(entity, states),
  ).filter((riga) => !scelte.escluse.includes(riga.entity));
  return `<div class="ed-intro">${esc(
    t(
      "I contatti di porte e finestre li dichiara Home Assistant da sé, e la pagina Varchi compare da sola: verde chiuso, rosso aperto, e in cima quanti sono aperti adesso. Qui si corregge quel rilevamento — si toglie un sensore che varco non è, si aggiunge uno che non viene trovato, e si dà un nome a chi si chiama «Contact 4B».",
      "Home Assistant declares door and window contacts itself, and the Openings page appears on its own: green closed, red open, and how many are open right now on top. Here you correct that — drop a sensor that is not an opening, add one that is not found, and give a name to whatever is called “Contact 4B”.",
    ),
  )}</div>

  <label class="ed-slot dm-varco-ed-campo"><span class="ed-slot-lbl">${esc(t("Aggiungi un contatto che non viene trovato", "Add a contact that is not found"))}</span>
    <span class="ed-form-row"><input id="dm-varco-aggiungi" class="ed-input mono" placeholder="binary_sensor.porta_cantina"
      autocomplete="off" spellcheck="false"><button type="button" class="dm-entity-picker"
      data-dm-varco-pick="dm-varco-aggiungi" aria-label="${esc(t("Scegli entità", "Choose entity"))}">🔍</button>
      <button type="button" class="ed-btn-add" data-dm-varco-aggiungi>${esc(t("Aggiungi", "Add"))}</button></span>
    <small>${esc(t("Un contatto che Home Assistant non ha etichettato — un template fatto in casa — non viene trovato: qui gli si dice che è un varco.", "A contact Home Assistant has not labelled — a template of your own — is not found: here you say it is an opening."))}</small>
  </label>

  <div class="ed-slot-lbl dm-varco-ed-titolo">${esc(t("I contatti di casa", "The contacts at home"))}</div>
  ${
    righe.length
      ? `<div class="ed-list dm-varco-ed-lista">${righe.map((riga) => rigaMarkup(riga, scelte)).join("")}</div>`
      : `<div class="ed-empty">${esc(t("Nessun contatto trovato", "No contact found"))}</div>`
  }
  ${scelte.escluse.length ? `<div class="ed-slot-lbl dm-varco-ed-titolo">${esc(t("Tolti dai conti", "Dropped from the count"))}</div>` : ""}
  ${fuoriMarkup(scelte)}`;
}

export function ensureVarchiEditor() {
  const body = doc?.getElementById("ed-body");
  if (!body || activeTab() !== VARCHI_EDITOR_TAB) return false;
  if (body.dataset.dmVarchiEditor === "true") return false;
  body.dataset.dmVarchiEditor = "true";
  body.innerHTML = `<div class="dm-varchi-ed">${schedaMarkup()}</div>`;
  return true;
}

export function ensureVarchiEditorTab() {
  const tabs = doc?.querySelector(".ed-tab")?.parentElement;
  if (!tabs || tabs.querySelector(`.ed-tab[data-tab="${VARCHI_EDITOR_TAB}"]`)) return false;
  const tab = doc.createElement("button");
  tab.className = "ed-tab";
  tab.dataset.tab = VARCHI_EDITOR_TAB;
  tab.textContent = `🚪 ${t("Varchi", "Openings")}`;
  tab.addEventListener("click", () => root.editorSwitch?.(VARCHI_EDITOR_TAB));
  const prima = tabs.querySelector('.ed-tab[data-tab="runtime"]');
  if (prima) prima.before(tab);
  else tabs.append(tab);
  return true;
}

/* ── i gesti ──────────────────────────────────────────────────────────── */

function onClick(event) {
  const body = doc?.getElementById("ed-body");
  if (!body || activeTab() !== VARCHI_EDITOR_TAB || !body.contains(event.target)) return;
  const scelte = configurazione();

  const lente = event.target.closest("[data-dm-varco-pick]");
  if (lente) {
    event.preventDefault();
    const campo = body.querySelector(`#${CSS.escape(clean(lente.dataset.dmVarcoPick))}`);
    if (campo) root.wzPickEntity?.(campo);
    return;
  }

  if (event.target.closest("[data-dm-varco-aggiungi]")) {
    event.preventDefault();
    const entity = clean(body.querySelector("#dm-varco-aggiungi")?.value);
    if (!entity.includes(".")) return;
    salva({
      ...scelte,
      aggiunte: [...new Set([...scelte.aggiunte, entity])],
      escluse: scelte.escluse.filter((voce) => voce !== entity),
    });
    root.edToast?.(t("🚪 Contatto aggiunto ai varchi", "🚪 Contact added to the openings"));
    return;
  }

  const togli = event.target.closest("[data-dm-varco-escludi]");
  if (togli) {
    event.preventDefault();
    const entity = clean(togli.dataset.dmVarcoEscludi);
    salva({
      ...scelte,
      escluse: [...new Set([...scelte.escluse, entity])],
      aggiunte: scelte.aggiunte.filter((voce) => voce !== entity),
    });
    return;
  }

  const rimetti = event.target.closest("[data-dm-varco-riprendi]");
  if (rimetti) {
    event.preventDefault();
    const entity = clean(rimetti.dataset.dmVarcoRiprendi);
    salva({ ...scelte, escluse: scelte.escluse.filter((voce) => voce !== entity) });
    return;
  }
}

/* Il nome si salva mentre lo si scrive, e la scheda NON si ridisegna: un
 * ridisegno a ogni lettera porterebbe via il cursore dalla casella. */
function onInput(event) {
  const campo = event.target?.closest?.("[data-dm-varco-nome]");
  if (!campo) return;
  const entity = clean(campo.dataset.dmVarcoNome);
  if (!entity) return;
  const scelte = configurazione();
  const nomi = { ...scelte.nomi };
  const scritto = clean(campo.value);
  if (scritto) nomi[entity] = scritto;
  else delete nomi[entity];
  writeJsonIfChanged(CHIAVE_VARCHI, { ...scelte, nomi });
  renderVarchi();
}

function installStyles() {
  installStyle(
    "dm-varchi-editor-style",
    `
    #ed-body .dm-varchi-ed{display:grid!important;gap:12px!important}
    #ed-body .dm-varco-ed-titolo{margin-top:6px!important}
    #ed-body .dm-varco-ed-lista{display:grid!important;gap:8px!important}
    #ed-body .dm-varco-ed-riga{
      display:grid!important;grid-template-columns:40px minmax(0,1fr) 40px!important;
      align-items:center!important;gap:10px!important;
      border-left:4px solid var(--dm-varco,#94a3b8)!important}
    #ed-body .dm-varco-ed-riga[data-varco="aperto"]{--dm-varco:#dc2626}
    #ed-body .dm-varco-ed-riga[data-varco="chiuso"]{--dm-varco:#16a34a}
    #ed-body .dm-varco-ed-riga[data-varco="muto"]{--dm-varco:#94a3b8}
    #ed-body .dm-varco-ed-ic{
      display:grid!important;place-items:center!important;width:40px!important;height:40px!important;
      border-radius:12px!important;font-size:18px!important;
      background:color-mix(in srgb,var(--dm-varco,#94a3b8) 20%,transparent)!important}
    #ed-body .dm-varco-ed-testo{display:grid!important;gap:4px!important;min-width:0!important}
    #ed-body .dm-varco-ed-nome{width:100%!important;min-width:0!important}
    #ed-body .dm-varco-ed-elenco{display:flex!important;flex-wrap:wrap!important;gap:8px!important}
    #ed-body .dm-varco-ed-fuori{
      display:inline-flex!important;align-items:center!important;gap:6px!important;
      padding:4px 6px 4px 12px!important;border-radius:999px!important;font-size:11.5px!important;
      font-weight:800!important;font-family:ui-monospace,monospace!important;
      background:var(--secondary-background-color,#eef2f7)!important;color:var(--text,#0f172a)!important}
    `,
  );
}

export function installVarchiEditor() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  ensureVarchiEditorTab();
  onEditorRedraw("__dmVarchiEditor", () => {
    root.queueMicrotask?.(() => {
      ensureVarchiEditorTab();
      ensureVarchiEditor();
    });
  });
  doc.addEventListener("click", onClick);
  doc.addEventListener("input", onInput);
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:editor-rendered"])
    root.addEventListener?.(evento, () => {
      root.queueMicrotask?.(() => {
        ensureVarchiEditorTab();
        ensureVarchiEditor();
      });
    });
  return true;
}

installVarchiEditor();
