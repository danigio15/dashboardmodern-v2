/* La scheda delle stampanti in configurazione (#469).
 *
 * Una stampante si aggiunge scrivendo una cosa sola: l'entita' che dice se e'
 * pronta — quella che l'integrazione IPP, quella HP o CUPS creano col nome
 * della stampante. Le cartucce NON si scrivono: si cercano da sole partendo da
 * quel nome, perche' chi ha una stampante a colori dovrebbe scriverne quattro,
 * e sbagliarne una vuol dire una barra che non c'e'.
 *
 * Chi ha una stampante che le nasconde puo' comunque scriverle a mano, una per
 * riga: quelle vincono sull'indovinello. Sotto ogni riga la scheda dice quante
 * ne ha trovate, cosi' non serve aprire la pagina per sapere se ha funzionato.
 *
 * Ogni gesto si salva subito, come nelle altre schede: chi tocca queste
 * caselle sta rispondendo a una domanda, e aspettare un tasto vorrebbe dire
 * perdere la risposta chiudendo la scheda.
 */
import {
  CHIAVE_STAMPANTI,
  MASSIMO_STAMPANTI,
  bozzaDelleStampanti,
  cartucceTrovate,
  letturaDellaStampante,
} from "../core/stampanti-model.js";
import { disegnoDelCatalogo } from "../core/catalogo-disegni.js";
import { STAMPANTI_TAB, parolaDellaStampante, renderStampanti } from "./stampanti-section.js";
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

const KEY = "__DASHBOARDMODERN_STAMPANTI_EDITOR__";
const state = (root[KEY] ||= { installed: false, contatore: 0 });

export const STAMPANTI_EDITOR_TAB = STAMPANTI_TAB;

/* La scheda legge la BOZZA, non l'elenco pulito: una riga appena aggiunta non
 * ha ancora l'entita', e l'elenco pulito la butterebbe — il tasto «Aggiungi»
 * non farebbe niente. */
function configurazione() {
  return bozzaDelleStampanti(readJson(CHIAVE_STAMPANTI, []));
}

function salva(righe) {
  writeJsonIfChanged(CHIAVE_STAMPANTI, righe);
  renderStampanti();
  ridisegna();
}

function activeTab() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

function ridisegna() {
  const body = doc?.getElementById("ed-body");
  if (body) delete body.dataset.dmStampantiEditor;
  ensureStampantiEditor();
}

/* ── il disegno della scheda ──────────────────────────────────────────── */

/* Quante cartucce ha trovato, detto sotto la riga. E' la sola cosa che dice a
 * chi configura se l'entita' che ha scritto e' quella giusta, senza andare a
 * vedere la pagina. */
function trovateTesto(riga, states) {
  if (riga.cartucce.length)
    return t(
      `${riga.cartucce.length} cartucce scritte a mano`,
      `${riga.cartucce.length} cartridges written by hand`,
    );
  const trovate = cartucceTrovate(riga.entity, states);
  if (!trovate.length)
    return t("Nessuna cartuccia trovata", "No cartridge found");
  return trovate.length === 1
    ? t("1 cartuccia trovata", "1 cartridge found")
    : t(`${trovate.length} cartucce trovate`, `${trovate.length} cartridges found`);
}

function rigaMarkup(riga, indice, states) {
  const lettura = letturaDellaStampante(riga, states, root.resolveEntity);
  const id = `dm-stampante-${indice}`;
  return `<article class="ed-row dm-todo-ed-row dm-stampante-ed-riga" data-open="true"
    data-dm-stampante-riga="${esc(riga.id)}" data-stato="${esc(lettura.stato)}">
    <div class="dm-stampante-ed-testa">
      <span class="dm-stampante-ed-ic" aria-hidden="true">${disegnoDelCatalogo("printer", 32)}</span>
      <input class="ed-input dm-stampante-ed-nome" data-dm-stampante-campo="nome" value="${esc(riga.nome)}"
        placeholder="${esc(t("Stampante", "Printer"))}" aria-label="${esc(t("Nome", "Name"))}">
      <b class="dm-stampante-ed-stato">${
        /* Una riga appena aggiunta non e' una stampante che non risponde: e'
         * una riga da scrivere, e dirle «non risponde» sembra un guasto. */
        riga.entity ? esc(parolaDellaStampante(lettura)) : "—"
      }</b>
      <button type="button" class="ed-del" data-dm-stampante-togli="${esc(riga.id)}"
        title="${esc(t("Togli", "Remove"))}" aria-label="${esc(t("Togli", "Remove"))}">🗑️</button>
    </div>
    <div class="dm-todo-ed-body">
      <label class="ed-slot dm-todo-ed-field"><span class="ed-slot-lbl">${esc(t("Entità dello stato", "State entity"))}</span>
        <span class="ed-form-row"><input id="${id}" class="ed-input mono" data-dm-stampante-campo="entity"
          value="${esc(riga.entity)}" placeholder="sensor.stampante_ufficio" autocomplete="off"
          spellcheck="false"><button type="button" class="dm-entity-picker" data-dm-stampante-pick="${id}"
          aria-label="${esc(t("Scegli entità", "Choose entity"))}">🔍</button></span>
        <small>${esc(
          t(
            "Quella che dice pronta, in stampa o ferma — la crea l'integrazione della stampante col suo nome.",
            "The one that says ready, printing or stopped — the printer integration creates it with its name.",
          ),
        )}</small>
      </label>
      <label class="ed-slot dm-todo-ed-field"><span class="ed-slot-lbl">${esc(t("Cartucce (facoltativo)", "Cartridges (optional)"))}</span>
        <span class="ed-form-row"><input class="ed-input mono" data-dm-stampante-campo="cartucce"
          value="${esc(riga.cartucce.join(", "))}" placeholder="sensor.stampante_nero, sensor.stampante_ciano"
          autocomplete="off" spellcheck="false"></span>
        <small>${esc(trovateTesto(riga, states))} · ${esc(
          t(
            "lasciale vuote e le cerca da sole; scrivendole, vincono queste.",
            "leave empty and they are found on their own; if you write them, yours win.",
          ),
        )}</small>
      </label>
      <label class="ed-slot dm-todo-ed-field"><span class="ed-slot-lbl">${esc(t("Pagine stampate (facoltativo)", "Pages printed (optional)"))}</span>
        <span class="ed-form-row"><input id="${id}-pag" class="ed-input mono" data-dm-stampante-campo="pagine"
          value="${esc(riga.pagine)}" placeholder="sensor.stampante_pagine" autocomplete="off"
          spellcheck="false"><button type="button" class="dm-entity-picker" data-dm-stampante-pick="${id}-pag"
          aria-label="${esc(t("Scegli entità", "Choose entity"))}">🔍</button></span>
      </label>
    </div>
  </article>`;
}

function schedaMarkup() {
  const righe = configurazione();
  const states = allStates();
  const piene = righe.length >= MASSIMO_STAMPANTI;
  return `<div class="ed-intro">${esc(
    t(
      "Della stampante servono due risposte: se è pronta, e quanto inchiostro le resta. Scrivi l'entità che dice come sta — la crea l'integrazione della stampante — e le cartucce si cercano da sole partendo da quel nome. La pagina Stampanti compare da sé appena ce n'è una.",
      "A printer needs two answers: whether it is ready, and how much ink is left. Write the entity that says how it is doing — the printer integration creates it — and the cartridges are found on their own from that name. The Printers page appears by itself as soon as there is one.",
    ),
  )}</div>
  ${
    righe.length
      ? `<div class="ed-list dm-stampante-ed-lista">${righe
          .map((riga, indice) => rigaMarkup(riga, indice, states))
          .join("")}</div>`
      : `<div class="ed-empty">${esc(t("Nessuna stampante", "No printer"))}</div>`
  }
  <button type="button" class="ed-btn-add dm-stampante-ed-aggiungi" data-dm-stampante-aggiungi${
    piene ? " disabled" : ""
  }>＋ ${esc(t("Aggiungi stampante", "Add printer"))}</button>`;
}

export function ensureStampantiEditor() {
  const body = doc?.getElementById("ed-body");
  if (!body || activeTab() !== STAMPANTI_EDITOR_TAB) return false;
  if (body.dataset.dmStampantiEditor === "true") return false;
  body.dataset.dmStampantiEditor = "true";
  body.innerHTML = `<div class="dm-stampante-ed">${schedaMarkup()}</div>`;
  return true;
}

export function ensureStampantiEditorTab() {
  const tabs = doc?.querySelector(".ed-tab")?.parentElement;
  if (!tabs || tabs.querySelector(`.ed-tab[data-tab="${STAMPANTI_EDITOR_TAB}"]`)) return false;
  const tab = doc.createElement("button");
  tab.className = "ed-tab";
  tab.dataset.tab = STAMPANTI_EDITOR_TAB;
  tab.textContent = `🖨️ ${t("Stampanti", "Printers")}`;
  tab.addEventListener("click", () => root.editorSwitch?.(STAMPANTI_EDITOR_TAB));
  const prima = tabs.querySelector('.ed-tab[data-tab="runtime"]');
  if (prima) prima.before(tab);
  else tabs.append(tab);
  return true;
}

/* ── i gesti ──────────────────────────────────────────────────────────── */

/* Quello che c'e' scritto adesso nelle caselle, riga per riga: si legge dal
 * documento e non dalla memoria, cosi' una modifica non ancora salvata non si
 * perde quando se ne salva un'altra. */
function raccogli(body) {
  const righe = [];
  for (const nodo of body.querySelectorAll("[data-dm-stampante-riga]")) {
    const campo = (nome) => clean(nodo.querySelector(`[data-dm-stampante-campo="${nome}"]`)?.value);
    righe.push({
      id: clean(nodo.dataset.dmStampanteRiga),
      nome: campo("nome"),
      entity: campo("entity"),
      pagine: campo("pagine"),
      cartucce: campo("cartucce")
        .split(/[,\s]+/)
        .map(clean)
        .filter(Boolean),
    });
  }
  return righe;
}

function onClick(event) {
  const body = doc?.getElementById("ed-body");
  if (!body || activeTab() !== STAMPANTI_EDITOR_TAB || !body.contains(event.target)) return;

  const lente = event.target.closest("[data-dm-stampante-pick]");
  if (lente) {
    event.preventDefault();
    const campo = body.querySelector(`#${CSS.escape(clean(lente.dataset.dmStampantePick))}`);
    if (campo) root.wzPickEntity?.(campo);
    return;
  }

  if (event.target.closest("[data-dm-stampante-aggiungi]")) {
    event.preventDefault();
    const righe = raccogli(body);
    if (righe.length >= MASSIMO_STAMPANTI) return;
    state.contatore += 1;
    salva([...righe, { id: `stampante-nuova-${state.contatore}`, nome: "", entity: "" }]);
    return;
  }

  const togli = event.target.closest("[data-dm-stampante-togli]");
  if (togli) {
    event.preventDefault();
    const id = clean(togli.dataset.dmStampanteTogli);
    salva(raccogli(body).filter((riga) => riga.id !== id));
  }
}

/* Il cambio si prende in fase di CATTURA: il campo dell'entità lo riempie la
 * lente, che manda un `change` senza bolle — un ascoltatore normale non lo
 * sentirebbe mai, e l'entità scelta col dito resterebbe fuori dal salvataggio. */
function onChange(event) {
  const body = doc?.getElementById("ed-body");
  if (!body || activeTab() !== STAMPANTI_EDITOR_TAB) return;
  if (!event.target?.closest?.("[data-dm-stampante-campo]")) return;
  if (!body.contains(event.target)) return;
  salva(raccogli(body));
}

function installStyles() {
  installStyle(
    "dm-stampanti-editor-style",
    `
    #ed-body .dm-stampante-ed{display:grid!important;gap:12px!important}
    #ed-body .dm-stampante-ed-lista{display:grid!important;gap:10px!important}
    #ed-body .dm-stampante-ed-riga{border-left:4px solid var(--dm-st,#94a3b8)!important}
    #ed-body .dm-stampante-ed-riga[data-stato="pronta"]{--dm-st:#16a34a}
    #ed-body .dm-stampante-ed-riga[data-stato="stampa"]{--dm-st:#0ea5e9}
    #ed-body .dm-stampante-ed-riga[data-stato="ferma"]{--dm-st:#dc2626}
    #ed-body .dm-stampante-ed-testa{
      display:flex!important;align-items:center!important;gap:10px!important}
    #ed-body .dm-stampante-ed-ic{
      display:grid!important;place-items:center!important;width:32px!important;height:32px!important;
      flex:0 0 auto!important}
    #ed-body .dm-stampante-ed-ic .dm-appliance-art{display:block!important;line-height:0!important}
    #ed-body .dm-stampante-ed-nome{flex:1 1 auto!important;min-width:0!important;margin:0!important}
    #ed-body .dm-stampante-ed-stato{
      flex:0 0 auto!important;font-size:10.5px!important;font-weight:900!important;
      letter-spacing:.04em!important;text-transform:uppercase!important;
      color:color-mix(in srgb,var(--dm-st,#94a3b8) 80%,var(--text,#0f172a))!important}
    #ed-body .dm-stampante-ed-aggiungi{width:100%!important;margin:6px 0 12px!important}
    `,
  );
}

export function installStampantiEditor() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  ensureStampantiEditorTab();
  onEditorRedraw("__dmStampantiEditor", () => {
    root.queueMicrotask?.(() => {
      ensureStampantiEditorTab();
      ensureStampantiEditor();
    });
  });
  doc.addEventListener("click", onClick);
  doc.addEventListener("change", onChange, true);
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:editor-rendered"])
    root.addEventListener?.(evento, () => {
      root.queueMicrotask?.(() => {
        ensureStampantiEditorTab();
        ensureStampantiEditor();
      });
    });
  return true;
}

installStampantiEditor();
