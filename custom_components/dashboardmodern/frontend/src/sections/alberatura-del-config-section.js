/* Le linguette del Config messe in ordine, e le insegne delle famiglie.
 *
 * «Per cortesia mi organizzi le sezioni del config con criterio, vedo cose
 * mischiate in sezioni che non c'entrano nulla.»
 *
 * L'ordine delle trentadue linguette non lo decideva nessuno: diciotto le
 * scrive il guscio storico in fila, e le altre quattordici se le infilano i
 * moduli subito prima di «Runtime», ognuno quando gli capita di installarsi.
 * Il risultato era Rifiuti fra Backup e Varchi, l'Agenda dopo i Robot, e
 * nessuna ragione per cui.
 *
 * Qui l'ordine c'è, e sta scritto in un posto solo — `core/alberatura-del-
 * config.js`. Questo modulo lo applica: rimette le linguette nell'ordine
 * dell'albero e mette un'insegna davanti a ogni famiglia, così si vede dove
 * finisce una e comincia l'altra. Sopra, una fila di famiglie che porta dove
 * si vuole andare.
 *
 * ── Perché nessuna linguetta si nasconde ─────────────────────────────────
 *
 * La tentazione era la seconda fila: la famiglia sopra, e sotto solo le sue
 * schede. Ma una linguetta nascosta non si può cliccare — non dal dito e non
 * dalle prove, e in questo progetto le prove che aprono una scheda cliccandola
 * sono una quarantina. Rompere quaranta punti per un'insegna sarebbe stato
 * pagare il riordino con la sicurezza di sapere che tutto il resto funziona.
 *
 * Quindi tutte restano dove sono, visibili e premibili, e la fila delle
 * famiglie fa da indice: porta lì, non toglie il resto. Chi arriva vede sette
 * insegne invece di trentadue nomi in fila, che era il punto.
 *
 * ── Perché si riordina a ogni giro ───────────────────────────────────────
 *
 * Perché i moduli continuano a infilarsi prima di «Runtime» quando si
 * installano, e non gli si può chiedere di sapere l'ordine — sapere l'ordine
 * è il mestiere dell'elenco, non il loro. Rimettere in fila trentadue nodi
 * costa niente, e farlo dopo ogni ridisegno vuol dire che una scheda nuova
 * trova il suo posto senza che nessuno la registri da nessuna parte.
 */
import {
  famigliaDellaScheda,
  famiglieConSchede,
  inOrdine,
} from "../core/alberatura-del-config.js";
import { clean, doc, esc, installStyle, onEditorRedraw, root, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_ALBERATURA__";
const state = (root[KEY] ||= { installed: false, riordinando: false });

const FILA = "dm-alberatura-famiglie";
const INSEGNA = "dm-alberatura-insegna";

function fila() {
  return doc?.querySelector?.(".ed-tab")?.parentElement || null;
}

function linguette(dentro) {
  return [...(dentro?.querySelectorAll?.(":scope > .ed-tab") || [])];
}

function schedaAttiva() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

/** Come si chiama una famiglia adesso, nella lingua di chi guarda. */
function nomeDellaFamiglia(voce) {
  return t(voce.it, voce.en);
}

/* ── il riordino ──────────────────────────────────────────────────────── */

/* Le insegne sono figlie della stessa fila delle linguette, e non sono
 * linguette: niente `ed-tab`, niente `data-tab`, niente da cliccare. Chi cerca
 * una scheda per identificativo non le trova, ed è giusto così. */
function insegna(dentro, voce) {
  let nodo = dentro.querySelector(`:scope > .${INSEGNA}[data-famiglia="${CSS.escape(voce.chiave)}"]`);
  if (!nodo) {
    nodo = doc.createElement("span");
    nodo.className = INSEGNA;
    nodo.dataset.famiglia = voce.chiave;
    nodo.setAttribute("aria-hidden", "true");
  }
  const testo = `${voce.glifo} ${nomeDellaFamiglia(voce)}`;
  if (nodo.textContent !== testo) nodo.textContent = testo;
  return nodo;
}

/**
 * Rimette la fila delle linguette nell'ordine dell'albero.
 *
 * Nessuna sparisce e nessuna nasce: si spostano, e basta. Le insegne che non
 * hanno più una famiglia sotto se ne vanno — succede quando si spegne l'ultima
 * sezione di una famiglia.
 */
export function riordinaLeLinguette() {
  const dentro = fila();
  if (!dentro || state.riordinando) return false;
  const bottoni = new Map(
    linguette(dentro).map((nodo) => [clean(nodo.dataset.tab), nodo]).filter(([id]) => id),
  );
  if (!bottoni.size) return false;
  const gruppi = famiglieConSchede([...bottoni.keys()]);
  state.riordinando = true;
  try {
    /* Si costruisce la fila giusta e poi la si appende in ordine: `append` su
     * un nodo che è già dentro lo sposta, non lo duplica. */
    const vive = new Set();
    for (const voce of gruppi) {
      dentro.append(insegna(dentro, voce));
      vive.add(voce.chiave);
      for (const id of voce.schede) dentro.append(bottoni.get(id));
    }
    for (const vecchia of dentro.querySelectorAll(`:scope > .${INSEGNA}`))
      if (!vive.has(clean(vecchia.dataset.famiglia))) vecchia.remove();
  } finally {
    state.riordinando = false;
  }
  return true;
}

/* ── la fila delle famiglie ───────────────────────────────────────────── */

function apriLaFamiglia(chiave) {
  const dentro = fila();
  if (!dentro) return;
  const ids = linguette(dentro)
    .map((nodo) => clean(nodo.dataset.tab))
    .filter((id) => id && famigliaDellaScheda(id) === chiave);
  if (!ids.length) return;
  const attiva = schedaAttiva();
  /* Se si è già dentro quella famiglia non si cambia scheda: chi tocca
   * «Casa» mentre sta configurando le Luci vuole vedere dov'è, non perdere
   * il posto. */
  const dove = ids.includes(attiva) ? attiva : inOrdine(ids)[0];
  if (dove !== attiva) {
    try {
      root.editorSwitch?.(dove);
    } catch (_error) {}
  }
  const bottone = dentro.querySelector(`:scope > .ed-tab[data-tab="${CSS.escape(dove)}"]`);
  try {
    bottone?.scrollIntoView?.({ block: "nearest", inline: "start", behavior: "smooth" });
  } catch (_error) {
    bottone?.scrollIntoView?.(true);
  }
}

function ensureFila() {
  const tabs = fila();
  if (!tabs) return false;
  const bottoni = linguette(tabs)
    .map((nodo) => clean(nodo.dataset.tab))
    .filter(Boolean);
  if (!bottoni.length) return false;
  const gruppi = famiglieConSchede(bottoni);
  let riga = doc.getElementById(FILA);
  if (!riga) {
    riga = doc.createElement("div");
    riga.id = FILA;
    riga.className = FILA;
    tabs.before(riga);
  } else if (riga.nextElementSibling !== tabs) {
    tabs.before(riga);
  }
  const attiva = famigliaDellaScheda(schedaAttiva());
  const markup = gruppi
    .map(
      (voce) =>
        `<button type="button" class="dm-alberatura-famiglia${voce.chiave === attiva ? " active" : ""}" data-dm-famiglia="${esc(voce.chiave)}"><span aria-hidden="true">${esc(voce.glifo)}</span>${esc(nomeDellaFamiglia(voce))}</button>`,
    )
    .join("");
  if (riga.innerHTML !== markup) riga.innerHTML = markup;
  return true;
}

/** Un giro solo: prima l'ordine, poi l'indice che lo racconta. */
export function ensureAlberatura() {
  const fatto = riordinaLeLinguette();
  ensureFila();
  return fatto;
}

/* ── i gesti ──────────────────────────────────────────────────────────── */

function onClick(evento) {
  const chip = evento.target?.closest?.("[data-dm-famiglia]");
  if (!chip) return;
  evento.preventDefault();
  apriLaFamiglia(clean(chip.dataset.dmFamiglia));
  /* L'insegna attiva cambia con la scheda, e la scheda l'abbiamo appena
   * cambiata noi: il ridisegno del guscio arriva dopo. */
  root.queueMicrotask?.(ensureFila);
}

function installStili() {
  installStyle(
    "dm-alberatura-style",
    `
    #${FILA}{display:flex;flex-wrap:wrap;gap:6px;padding:10px 12px 0}
    #${FILA} .dm-alberatura-famiglia{
      display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;cursor:pointer;
      border:1px solid var(--divider-color,#dbe4ee);background:var(--secondary-background-color,#eef2f7);
      color:var(--text-dim,#64748b);font:inherit;font-size:11.5px;font-weight:900;letter-spacing:.03em}
    #${FILA} .dm-alberatura-famiglia:hover{border-color:var(--primary-color,#0ea5e9)}
    #${FILA} .dm-alberatura-famiglia.active{
      background:var(--primary-color,#0ea5e9);border-color:var(--primary-color,#0ea5e9);color:#fff}
    #${FILA} .dm-alberatura-famiglia:focus-visible{outline:3px solid color-mix(in srgb,var(--primary-color,#0ea5e9) 40%,transparent);outline-offset:2px}
    /* L'insegna sta nella fila delle linguette e non è una linguetta: non si
       preme, non si sceglie, dice soltanto dove comincia una famiglia. */
    .${INSEGNA}{
      align-self:center;flex:0 0 auto;padding:0 8px 0 4px;
      font-size:9.5px;font-weight:900;letter-spacing:.09em;text-transform:uppercase;
      color:var(--text-dim,#94a3b8);white-space:nowrap;pointer-events:none;user-select:none}
    .${INSEGNA}:first-child{padding-left:0}
    @media(max-width:640px){
      #${FILA}{padding:8px 10px 0}
      #${FILA} .dm-alberatura-famiglia{padding:5px 10px;font-size:11px}
      .${INSEGNA}{font-size:9px;padding:0 6px 0 2px}
    }
    `,
  );
}

export function installAlberatura() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStili();
  doc.addEventListener("click", onClick);
  /* Due passate: una subito e una dopo i microtask, perché è in quelli che i
   * quattordici moduli si aggiungono la loro linguetta. La seconda costa il
   * riordino di trentadue nodi che sono già in ordine — cioè niente. */
  const giro = () => {
    ensureAlberatura();
    root.setTimeout?.(ensureAlberatura, 0);
  };
  onEditorRedraw("__dmAlberatura", () => root.queueMicrotask?.(giro));
  for (const evento of [
    "dashboardmodern:editor-rendered",
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
  ])
    root.addEventListener?.(evento, () => root.queueMicrotask?.(giro));
  giro();
  return true;
}

installAlberatura();
