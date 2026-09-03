/* Dove si fanno le sezioni proprie (#262).
 *
 * «Una sezione chiamata Custom che permette di creare N sezioni con un titolo
 * e posizionarvi delle entità.»
 *
 * Una scheda, N sezioni, e dentro ognuna le righe. Il titolo e l'icona vanno
 * nella barra; le righe sono nome, entità e icona — il nome perche' senza si
 * legge un entity_id in mezzo alle parole, l'icona perche' una fila di righe
 * tutte uguali non si scorre con l'occhio.
 *
 * Le sezioni nascono aperte e vuote: si crea la sezione, e poi la si riempie.
 * Fare il contrario — chiedere tutto prima di creare qualcosa — e' il modo in
 * cui una finestra di configurazione diventa un modulo da compilare.
 */
import { MASSIMO_SEZIONI, normalizzaSezioni } from "../core/sezioni-mie.js";
import { CHIAVE_SEZIONI_MIE, ridisegnaSezioniMie, SEZIONI_MIE_TAB } from "./sezioni-mie-section.js";
import {
  clean,
  doc,
  esc,
  installStyle,
  onEditorRedraw,
  righeDelDocumento,
  readJson,
  root,
  t,
  wrapFunction,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_SEZIONI_MIE_EDITOR__";
const state = (root[KEY] ||= { installed: false, aperta: 0 });

export const SEZIONI_MIE_EDITOR_TAB = "mie";

/* La stessa chiave che legge la pagina, o la fascia scriverebbe una
 * preferenza che nessuno guarda. */
const CHIAVE_SEZIONE = SEZIONI_MIE_TAB;

function schedaAttiva() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

/* L'editor lavora sulle righe grezze: una sezione appena creata e' vuota, e la
 * normalizzazione — che le righe senza entita' le scarta — le farebbe sparire
 * le voci prima di poterle compilare. */
function sezioni() {
  const grezzo = readJson(CHIAVE_SEZIONI_MIE, []);
  return Array.isArray(grezzo) ? grezzo : [];
}

function salva(lista) {
  writeJsonIfChanged(CHIAVE_SEZIONI_MIE, lista);
  ridisegnaSezioniMie();
}

/* ── l'interruttore della sezione ─────────────────────────────────────────
 *
 * E' la fascia del guscio: stesso disegno, stesso gestore, stessa chiave.
 * Spegne tutte le voci di questa scheda in un colpo — quale sezione compare
 * nella barra e quale no lo dice la spunta sulla sua riga, che e' una
 * proprieta' della sezione e non una preferenza del guscio. */
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

/* ── il disegno della scheda ──────────────────────────────────────────── */

function vociDi(sezione) {
  return Array.isArray(sezione?.voci) ? sezione.voci : [];
}

/* La forma delle caselle e' quella delle altre schede — `ed-slot`,
 * `ed-form-row`, il cerca-entita' accanto al campo — e non per gusto: i moduli
 * che vestono la configurazione riconoscono quella forma, e una casella
 * scritta a modo mio se la trovava rifatta addosso di traverso. */
function rigaVoceMarkup(voce, sezione, riga) {
  const id = `dm-mia-${sezione}-${riga}`;
  return `<div class="dm-mia-ed-voce" data-mia-voce="${riga}">
    <div class="dm-mia-ed-voce-testa">
      <input class="ed-input dm-mia-ed-icona" data-mia-campo="icona" value="${esc(clean(voce?.icona))}"
        placeholder="⭐" aria-label="${esc(t("Icona", "Icon"))}" maxlength="4">
      <input class="ed-input" data-mia-campo="nome" value="${esc(clean(voce?.nome))}"
        placeholder="${esc(t("Nome (facoltativo)", "Name (optional)"))}">
      <button type="button" class="ed-del dm-mia-ed-via" data-mia-voce-del
        aria-label="${esc(t("Elimina", "Remove"))}">🗑️</button>
    </div>
    <label class="ed-slot dm-todo-ed-field">
      <span class="ed-form-row"><input id="${id}" class="ed-input mono" data-mia-campo="entity"
        value="${esc(clean(voce?.entity))}" placeholder="sensor.qualcosa" autocomplete="off"
        spellcheck="false"><button type="button" class="dm-entity-picker" data-mia-pick="${id}"
        aria-label="${esc(t("Scegli entità", "Choose entity"))}">🔍</button></span>
    </label>
  </div>`;
}

function rigaSezioneMarkup(sezione, indice) {
  const aperta = state.aperta === indice;
  const voci = vociDi(sezione);
  const titolo = clean(sezione?.titolo) || `${t("Sezione", "Section")} ${indice + 1}`;
  return `<article class="ed-row dm-todo-ed-row dm-mia-ed-riga" data-mia-sezione="${indice}" data-open="${aperta}">
    <div class="dm-todo-ed-head">
      <span class="dm-todo-ed-icon" aria-hidden="true">${esc(clean(sezione?.icona) || "⭐")}</span>
      <span class="ed-row-main">
        <strong class="ed-row-new">${esc(titolo)}</strong>
        <small class="ed-row-old">${voci.length} ${esc(
          voci.length === 1 ? t("entità", "entity") : t("entità", "entities"),
        )}${sezione?.mostra === false ? ` · ${esc(t("fuori dalla barra", "off the bar"))}` : ""}</small>
      </span>
      <button type="button" class="ed-del dm-todo-ed-edit" data-mia-edit
        aria-label="${esc(t("Modifica", "Edit"))}">✏️</button>
      <button type="button" class="ed-del dm-todo-ed-del" data-mia-del
        aria-label="${esc(t("Elimina", "Remove"))}">🗑️</button>
    </div>
    <div class="dm-todo-ed-body"${aperta ? "" : " hidden"}>
      <div class="dm-mia-ed-testa">
        <input class="ed-input dm-mia-ed-icona" data-mia-campo="icona" value="${esc(clean(sezione?.icona) || "⭐")}"
          placeholder="⭐" aria-label="${esc(t("Icona", "Icon"))}" maxlength="4">
        <input class="ed-input" data-mia-campo="titolo" value="${esc(clean(sezione?.titolo))}"
          placeholder="${esc(t("Titolo della sezione", "Section title"))}">
      </div>
      <label class="dm-mia-ed-spunta">
        <input type="checkbox" data-mia-campo="mostra"${sezione?.mostra === false ? "" : " checked"}>
        <span>${esc(t("Mostrala nella barra", "Show it in the bar"))}</span>
      </label>
      <div class="dm-mia-ed-titolo-voci">${esc(t("Le entità", "The entities"))}</div>
      <div class="dm-mia-ed-voci">${voci
        .map((voce, riga) => rigaVoceMarkup(voce, indice, riga))
        .join("")}</div>
      <button type="button" class="ed-btn-add" data-mia-voce-add>＋ ${esc(
        t("Aggiungi entità", "Add entity"),
      )}</button>
      <button type="button" class="ed-save-btn" data-mia-save>💾 ${esc(
        t("Salva sezione", "Save section"),
      )}</button>
    </div>
  </article>`;
}

function corpoMarkup() {
  const lista = sezioni();
  return `${fasciaMarkup()}<div class="dm-mia-ed">
  <div class="ed-sec-title">⭐ ${esc(t("Le tue sezioni", "Your sections"))}</div>
  <div class="ed-intro">${esc(
    t(
      "Una sezione tua è un titolo e le entità che ci metti dentro: compare nella barra come le altre, dice come stanno e accende quelle che si accendono. Serve quando hai in casa qualcosa che la plancia non disegna ancora — e non toglie niente: il giorno che arriva la sezione fatta apposta, questa la puoi togliere.",
      "A section of your own is a title and the entities you put in it: it shows up in the bar like the others, says how they are doing and switches the ones that switch. It is for the things this dashboard does not draw yet — and it takes nothing away: the day the proper section arrives, you can remove this one.",
    ),
  )}</div>
  <div class="ed-list dm-todo-ed-list">${lista
    .map((sezione, indice) => rigaSezioneMarkup(sezione, indice))
    .join("")}</div>
  ${
    lista.length >= MASSIMO_SEZIONI
      ? `<div class="dm-mia-ed-pieno">${esc(
          t(
            "Sono otto: la barra non ne tiene di più senza diventare illeggibile.",
            "That is eight: the bar cannot hold more without becoming unreadable.",
          ),
        )}</div>`
      : `<button type="button" class="ed-btn-add" data-mia-add>＋ ${esc(
          t("Aggiungi sezione", "Add section"),
        )}</button>`
  }
  </div>`;
}

export function ensureSezioniMieEditor() {
  const body = doc?.getElementById("ed-body");
  if (!body || schedaAttiva() !== SEZIONI_MIE_EDITOR_TAB) return false;
  const firma = `${JSON.stringify(sezioni())}|${state.aperta}|${sezioneNascosta()}`;
  if (body.dataset.dmMieEditor === firma && body.querySelector(".dm-mia-ed")) return true;
  body.dataset.dmMieEditor = firma;
  body.innerHTML = corpoMarkup();
  body.dataset.renderer = "mie";
  return true;
}

function ridisegna() {
  const body = doc?.getElementById("ed-body");
  if (body) delete body.dataset.dmMieEditor;
  ensureSezioniMieEditor();
}

/* Quello che c'e' scritto adesso nella riga aperta, letto dal documento: si
 * salva quello che si vede, non quello che era scritto quando la scheda e'
 * stata disegnata. */
function leggiLaRiga(riga) {
  const letto = { ...(sezioni()[Number(riga.dataset.miaSezione)] || {}) };
  const testa = riga.querySelector(".dm-mia-ed-testa");
  for (const campo of testa?.querySelectorAll("[data-mia-campo]") || [])
    letto[clean(campo.dataset.miaCampo)] = clean(campo.value);
  const spunta = riga.querySelector('[data-mia-campo="mostra"]');
  if (spunta) letto.mostra = spunta.checked === true;
  letto.voci = [...riga.querySelectorAll("[data-mia-voce]")].map((nodo) => {
    const voce = {};
    for (const campo of nodo.querySelectorAll("[data-mia-campo]"))
      voce[clean(campo.dataset.miaCampo)] = clean(campo.value);
    return voce;
  });
  return letto;
}

/* Tutte le righe della scheda come sono adesso nel documento.
 *
 * Il tasto «Salva sezione» in fondo preme il salvataggio di ogni riga uno
 * dopo l'altro: il primo scrive e ridisegna, e il ridisegno stacca gli altri
 * bottoni dal documento. Chi scrive per primo, quindi, scrive per tutti —
 * vedi `righeDelDocumento`. */
function sezioniDalDocumento(body) {
  return righeDelDocumento(body, "data-mia-sezione", sezioni(), (riga) => leggiLaRiga(riga));
}

function sostituisci(indice, voce) {
  const lista = sezioni().slice();
  lista[indice] = voce;
  salva(lista);
}

function onClick(event) {
  const body = doc?.getElementById("ed-body");
  if (!body || schedaAttiva() !== SEZIONI_MIE_EDITOR_TAB || !body.contains(event.target)) return;

  if (event.target.closest("[data-mia-add]")) {
    event.preventDefault();
    const lista = sezioni().slice();
    if (lista.length >= MASSIMO_SEZIONI) return;
    lista.push({
      id: `sezione-${Date.now().toString(36)}`,
      titolo: "",
      icona: "⭐",
      mostra: true,
      voci: [{}],
    });
    state.aperta = lista.length - 1;
    salva(lista);
    ridisegna();
    return;
  }

  const riga = event.target.closest("[data-mia-sezione]");
  if (!riga) return;
  const indice = Number(riga.dataset.miaSezione);

  const pick = event.target.closest("[data-mia-pick]");
  if (pick) {
    event.preventDefault();
    const input = body.querySelector(`#${CSS.escape(clean(pick.dataset.miaPick))}`);
    if (input) root.wzPickEntity?.(input);
    return;
  }

  if (event.target.closest("[data-mia-edit]")) {
    event.preventDefault();
    state.aperta = state.aperta === indice ? -1 : indice;
    ridisegna();
    return;
  }

  if (event.target.closest("[data-mia-del]")) {
    event.preventDefault();
    const lista = sezioni().slice();
    lista.splice(indice, 1);
    state.aperta = -1;
    salva(lista);
    ridisegna();
    return;
  }

  if (event.target.closest("[data-mia-voce-add]")) {
    event.preventDefault();
    /* Prima si tiene quello che c'e' scritto: aggiungere una riga senza
     * rileggere il documento cancellerebbe quello appena digitato. */
    const letto = leggiLaRiga(riga);
    letto.voci = [...(letto.voci || []), {}];
    sostituisci(indice, letto);
    ridisegna();
    return;
  }

  const via = event.target.closest("[data-mia-voce-del]");
  if (via) {
    event.preventDefault();
    const letto = leggiLaRiga(riga);
    const quale = Number(via.closest("[data-mia-voce]")?.dataset?.miaVoce);
    if (Number.isInteger(quale)) letto.voci = (letto.voci || []).filter((_, i) => i !== quale);
    sostituisci(indice, letto);
    ridisegna();
    return;
  }

  if (event.target.closest("[data-mia-save]")) {
    event.preventDefault();
    const lista = sezioniDalDocumento(body);
    lista[indice] = leggiLaRiga(riga);
    salva(lista);
    ridisegna();
    root.edToast?.(t("💾 Sezione salvata", "💾 Section saved"));
  }
}

export function ensureSezioniMieTab() {
  const linguette = doc?.querySelector(".ed-tab")?.parentElement;
  if (!linguette || linguette.querySelector(`.ed-tab[data-tab="${SEZIONI_MIE_EDITOR_TAB}"]`))
    return false;
  const linguetta = doc.createElement("button");
  linguetta.className = "ed-tab";
  linguetta.dataset.tab = SEZIONI_MIE_EDITOR_TAB;
  linguetta.textContent = `⭐ ${t("Le tue sezioni", "Your sections")}`;
  linguetta.addEventListener("click", () => root.editorSwitch?.(SEZIONI_MIE_EDITOR_TAB));
  const prima = linguette.querySelector('.ed-tab[data-tab="runtime"]');
  if (prima) prima.before(linguetta);
  else linguette.append(linguetta);
  return true;
}

function installStyles() {
  installStyle(
    "dm-sezioni-mie-editor",
    `
      #ed-body .dm-mia-ed-testa{display:grid;grid-template-columns:64px minmax(0,1fr);gap:8px;margin-bottom:8px}
      #ed-body .dm-mia-ed-icona{text-align:center;font-size:18px}
      #ed-body .dm-mia-ed-voci{display:grid;gap:14px}
      /* Ogni entita' e' un blocchetto: sopra chi e' — icona e nome — sotto da
         dove si legge. Le due domande sono diverse e vanno su due righe. */
      #ed-body .dm-mia-ed-voce{
        display:grid;gap:6px;padding:10px;border-radius:14px;
        background:var(--bg-sculpted,#f0f4f8)}
      #ed-body .dm-mia-ed-voce-testa{
        display:grid;grid-template-columns:56px minmax(0,1fr) 40px;gap:7px;align-items:center}
      #ed-body .dm-mia-ed-voce .ed-input{margin:0}
      #ed-body .dm-mia-ed-voce .ed-slot{margin:0}
      #ed-body .dm-mia-ed-via{justify-self:end}
      #ed-body .dm-mia-ed-titolo-voci{
        margin:12px 2px 6px;font-size:11px;font-weight:800;letter-spacing:.04em;
        text-transform:uppercase;color:var(--text-dim,#64748b)}
      /* La spunta non e' una casella da compilare: niente ed-slot-lbl, che il
         foglio del guscio ci appende una matita — e la matita dice «questo si
         rinomina», mentre qui non c'e' niente da rinominare. */
      #ed-body .dm-mia-ed-spunta{
        display:flex;align-items:center;gap:10px;margin:10px 2px;
        font-size:12.5px;font-weight:700;color:var(--text,#0f172a);cursor:pointer}
      #ed-body .dm-mia-ed-spunta input[type="checkbox"]{width:18px;height:18px;flex:0 0 18px}
      #ed-body .dm-mia-ed-pieno{margin:10px 2px 0;opacity:.75}
      /* Nome e conto incolonnati, come nelle altre liste della configurazione. */
      #ed-body .dm-mia-ed-riga .ed-row-main{display:block;min-width:0}
      #ed-body .dm-mia-ed-riga .ed-row-new,
      #ed-body .dm-mia-ed-riga .ed-row-old{display:block;overflow:hidden;text-overflow:ellipsis}
      #ed-body .dm-mia-ed-riga .ed-row-old{margin-top:3px;color:var(--text-dim,#64748b)}
      @media(max-width:560px){
        #ed-body .dm-mia-ed-voce-testa{grid-template-columns:48px minmax(0,1fr) 38px;gap:6px}
      }
    `,
  );
}

export function installSezioniMieEditor() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  doc.addEventListener("click", onClick);
  /* La linguetta si mette appena il pannello nasce, non al primo ridisegno:
   * chi apre la configurazione e chiede subito questa scheda la troverebbe
   * altrimenti assente. */
  wrapFunction("apriConfigEntita", "__dmSezioniMieEditor", () => {
    ensureSezioniMieTab();
    ensureSezioniMieEditor();
  });
  ensureSezioniMieTab();
  onEditorRedraw("__dmSezioniMieEditor", () => {
    root.queueMicrotask?.(() => {
      ensureSezioniMieTab();
      ensureSezioniMieEditor();
    });
  });
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:editor-rendered"])
    root.addEventListener?.(evento, () => {
      root.queueMicrotask?.(() => {
        ensureSezioniMieTab();
        ensureSezioniMieEditor();
      });
    });
  ensureSezioniMieEditor();
  return true;
}

export { normalizzaSezioni };
