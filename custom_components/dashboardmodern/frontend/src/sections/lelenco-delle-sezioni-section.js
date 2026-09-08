/* L'elenco unico delle sezioni, dentro ⚙️ Impostazioni.
 *
 * «Per cortesia mi organizzi le sezioni del config con criterio.»
 * «Dove posso inserire i binary sensor di porte e finestre? Non trovo più la
 *  sezione dove inserirli.» (#399)
 *
 * L'interruttore di ogni sezione stava dentro la scheda di quella sezione: una
 * fascia verde in cima, che il guscio disegna con `cdSecToggleHtml`. Va benone
 * quando si sta configurando quella cosa lì — è dove la mano è già — ma vuol
 * dire che per sapere quali sezioni esistono bisogna aprirle tutte, e per
 * sapere quali sono accese anche. Ventiquattro schede da aprire per rispondere
 * a «cosa c'è», che è la domanda che si fa per prima.
 *
 * Qui c'è la risposta in un colpo solo: tutte le sezioni, raggruppate nelle
 * stesse sette famiglie delle linguette, ognuna col suo interruttore e con la
 * scritta che porta alla sua scheda.
 *
 * ── Perché le fasce dentro le schede restano ─────────────────────────────
 *
 * Perché non sono un doppione: sono lo stesso interruttore visto da dove si
 * sta lavorando. Chi sta configurando i Rifiuti e decide di spegnerli non deve
 * uscire, andare in Impostazioni e cercarli. Quello che era sbagliato non è
 * che ci fossero là: è che ci fossero SOLO là.
 *
 * Entrambe leggono e scrivono la stessa cosa — `cd_sections` — e la scrittura
 * la fa il guscio, con la sua `edSecTog`. Qui non si salva niente per conto
 * proprio: una preferenza scritta due volte è una preferenza che prima o poi
 * si contraddice.
 */
import {
  SEZIONI,
  quanteAccese,
  sezioneAccesa,
  sezioniPerFamiglia,
} from "../core/lelenco-delle-sezioni.js";
import {
  ORDINE_IMPOSTAZIONI,
  clean,
  doc,
  dopoIGenerali,
  esc,
  inserisciInOrdine,
  installStyle,
  onEditorRedraw,
  readJson,
  root,
  t,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_ELENCO_SEZIONI__";
const state = (root[KEY] ||= { installed: false });

const SCHEDA = "visib";
const BLOCCO = "dm-elenco-sezioni";

function schedaAttiva() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

/** Le sezioni accese adesso, come le legge il guscio. */
function sezioniDiCasa() {
  return readJson("cd_sections", {}) || {};
}

/* ── il disegno ───────────────────────────────────────────────────────── */

function rigaMarkup(voce, sezioni) {
  const accesa = sezioneAccesa(sezioni, voce.chiave);
  const nome = t(voce.it, voce.en);
  return `<div class="dm-elenco-riga" data-dm-sezione="${esc(voce.chiave)}">
    <button type="button" class="dm-elenco-int" role="switch" aria-checked="${accesa ? "true" : "false"}"
      data-dm-sezione-int="${esc(voce.chiave)}"
      aria-label="${esc(accesa ? t("Nascondi", "Hide") : t("Mostra", "Show"))} ${esc(nome)}"><i aria-hidden="true"></i></button>
    <span class="dm-elenco-glifo" aria-hidden="true">${esc(voce.glifo)}</span>
    <span class="dm-elenco-nome">${esc(nome)}</span>
    <button type="button" class="dm-elenco-vai" data-dm-sezione-vai="${esc(voce.scheda)}">${esc(t("Configura", "Configure"))}</button>
  </div>`;
}

function corpoMarkup() {
  const sezioni = sezioniDiCasa();
  const { accese, tutte } = quanteAccese(sezioni, SEZIONI);
  const gruppi = sezioniPerFamiglia(SEZIONI)
    .map(
      (famiglia) => `<div class="dm-elenco-famiglia">
        <span class="dm-elenco-insegna"><span aria-hidden="true">${esc(famiglia.glifo)}</span>${esc(t(famiglia.it, famiglia.en))}</span>
        ${famiglia.sezioni.map((voce) => rigaMarkup(voce, sezioni)).join("")}
      </div>`,
    )
    .join("");
  /* Il conto sta fuori dalla frase da tradurre: un numero dentro una stringa
   * vuol dire una chiave diversa per ogni casa. */
  return `<div class="ed-slot ${BLOCCO}" id="${BLOCCO}">
    <span class="ed-slot-lbl">${esc(t("Le sezioni della plancia", "The dashboard sections"))} <b class="dm-elenco-conto">${esc(String(accese))}/${esc(String(tutte))}</b></span>
    <small>${esc(t("Tutto quello che la plancia sa fare, e se si vede. Lo stesso interruttore sta anche in cima alla scheda di ognuna: qui ci sono tutti insieme, per vedere cosa c'è senza aprirle una per una.", "Everything the dashboard can do, and whether it shows. The same switch is also at the top of each section's own tab: here they are all together, so you can see what exists without opening them one by one."))}</small>
    <div class="dm-elenco-corpo">${gruppi}</div>
  </div>`;
}

/** Ridisegna il blocco se è già a video, senza toccare il resto della scheda. */
function ridipingi() {
  const gia = doc?.getElementById(BLOCCO);
  if (!gia) return false;
  const foglio = doc.createElement("div");
  foglio.innerHTML = corpoMarkup();
  const nuovo = foglio.firstElementChild;
  if (!nuovo) return false;
  nuovo.setAttribute("data-dm-ordine", gia.getAttribute("data-dm-ordine") || "");
  gia.replaceWith(nuovo);
  return true;
}

export function ensureElencoDelleSezioni() {
  if (!doc || schedaAttiva() !== SCHEDA) return false;
  const corpo = doc.getElementById("ed-body");
  if (!corpo) return false;
  if (doc.getElementById(BLOCCO)) return true;
  const foglio = doc.createElement("div");
  foglio.innerHTML = corpoMarkup();
  const riga = foglio.firstElementChild;
  if (!riga) return false;
  inserisciInOrdine(corpo, riga, ORDINE_IMPOSTAZIONI.sezioni, dopoIGenerali);
  return true;
}

/* ── i gesti ──────────────────────────────────────────────────────────── */

/* L'interruttore è quello del guscio, chiamato per nome.
 *
 * `edSecTog` vuole un elemento che porti `data-key`: legge `cd_sections`, gira
 * la voce, salva, sincronizza, riapplica la visibilità della barra e ridisegna
 * la scheda. Passargli la nostra riga vuol dire una scrittura sola per una
 * preferenza sola — e vuol dire che il giorno in cui quella scrittura cambia,
 * cambia anche qui senza che nessuno se ne ricordi. */
function accendiOSpegni(chiave) {
  const finto = doc.createElement("span");
  finto.setAttribute("data-key", chiave);
  try {
    root.edSecTog?.(finto);
  } catch (_error) {}
  /* `edSecTog` ridisegna la scheda per conto suo, ma non sempre: se la scheda
   * attiva non è questa non fa niente, e quando la rifà il nostro blocco lo
   * rimette `onEditorRedraw`. Il ridisegno qui è per il caso in cui resti a
   * video così com'era. */
  ridipingi();
}

function onClick(evento) {
  const interruttore = evento.target?.closest?.("[data-dm-sezione-int]");
  if (interruttore) {
    evento.preventDefault();
    accendiOSpegni(clean(interruttore.dataset.dmSezioneInt));
    return;
  }
  const vai = evento.target?.closest?.("[data-dm-sezione-vai]");
  if (!vai) return;
  evento.preventDefault();
  try {
    root.editorSwitch?.(clean(vai.dataset.dmSezioneVai));
  } catch (_error) {}
}

function installStili() {
  installStyle(
    "dm-elenco-sezioni-style",
    `
    #${BLOCCO} .dm-elenco-conto{margin-left:6px;font-size:11px;font-weight:900;opacity:.6;font-variant-numeric:tabular-nums}
    #${BLOCCO} .dm-elenco-corpo{display:flex;flex-direction:column;gap:14px;margin-top:10px}
    #${BLOCCO} .dm-elenco-insegna{
      display:flex;align-items:center;gap:6px;margin-bottom:4px;
      font-size:9.5px;font-weight:900;letter-spacing:.09em;text-transform:uppercase;
      color:var(--text-dim,#94a3b8)}
    #${BLOCCO} .dm-elenco-riga{
      display:grid;grid-template-columns:auto auto minmax(0,1fr) auto;align-items:center;gap:10px;
      padding:7px 4px;border-top:1px solid var(--divider-color,rgba(0,0,0,.06))}
    #${BLOCCO} .dm-elenco-glifo{font-size:15px;line-height:1}
    #${BLOCCO} .dm-elenco-nome{
      font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    /* Una sezione spenta si legge lo stesso — serve a ritrovarla per
       riaccenderla — ma si vede che è spenta. */
    #${BLOCCO} .dm-elenco-riga:has([aria-checked="false"]) .dm-elenco-nome,
    #${BLOCCO} .dm-elenco-riga:has([aria-checked="false"]) .dm-elenco-glifo{opacity:.5}
    #${BLOCCO} .dm-elenco-int{
      position:relative;width:38px;height:22px;flex:0 0 auto;padding:0;cursor:pointer;
      border:0;border-radius:999px;background:var(--divider-color,#cbd5e1);transition:background .18s ease}
    #${BLOCCO} .dm-elenco-int[aria-checked="true"]{background:var(--success-color,#10b981)}
    #${BLOCCO} .dm-elenco-int i{
      position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;
      background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:transform .18s ease}
    #${BLOCCO} .dm-elenco-int[aria-checked="true"] i{transform:translateX(16px)}
    #${BLOCCO} .dm-elenco-int:focus-visible{outline:3px solid color-mix(in srgb,var(--primary-color,#0ea5e9) 40%,transparent);outline-offset:2px}
    #${BLOCCO} .dm-elenco-vai{
      padding:4px 11px;border-radius:999px;cursor:pointer;font:inherit;font-size:11px;font-weight:800;
      border:1px solid var(--divider-color,#dbe4ee);background:transparent;color:var(--text-dim,#64748b)}
    #${BLOCCO} .dm-elenco-vai:hover{border-color:var(--primary-color,#0ea5e9);color:var(--primary-color,#0ea5e9)}
    @media(max-width:520px){
      #${BLOCCO} .dm-elenco-vai{padding:4px 8px;font-size:10.5px}
      #${BLOCCO} .dm-elenco-riga{gap:8px}
    }
    `,
  );
}

export function installElencoDelleSezioni() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStili();
  doc.addEventListener("click", onClick);
  onEditorRedraw("__dmElencoSezioni", () => root.queueMicrotask?.(ensureElencoDelleSezioni));
  ensureElencoDelleSezioni();
  return true;
}

installElencoDelleSezioni();
