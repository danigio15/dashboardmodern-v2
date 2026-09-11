/* Le stanze in plancia (#493).
 *
 * «Have the option to display a block on the home screen — like a widget or a
 * quick action — showing the rooms or areas of the house (such as the garden,
 * garage, etc.). It should also be possible to choose which rooms or areas
 * appear on the home screen.»
 *
 * Le stanze la plancia le ha già tutte: la loro pagina, le loro entità, la loro
 * icona. Quello che non aveva è il pezzo di casa da cui si guardano senza
 * aprire niente — una fila di stanze in plancia, con dentro la temperatura e
 * quante cose sono accese, e il tocco che porta dentro la stanza.
 *
 * Il blocco non c'è finché nessuno sceglie una stanza: una plancia non deve
 * riempirsi da sola di roba che nessuno ha chiesto. Chi ne sceglie una lo vede
 * comparire, e da lì in poi si sposta con gli altri blocchi — le persone, le
 * tessere, le azioni rapide — perché è un blocco come loro.
 *
 * Chi decide sta nel modulo puro `core/stanze-in-plancia.js`; qui c'è la mano
 * che disegna e il tocco che porta nella stanza.
 */
import {
  CHIAVE_STANZE_IN_PLANCIA,
  idDellaStanza,
  stanzeInPlancia,
} from "../core/stanze-in-plancia.js";
import { allStates, clean, doc, esc, installStyle, readJson, root, t } from "./shared.js";
import { apriLaStanza, roomPages } from "./rooms-page-section.js";

const KEY = "__DASHBOARDMODERN_STANZE_IN_PLANCIA__";
const STYLE_ID = "dm-stanze-plancia-style";
export const BLOCCO_ID = "dm-stanze-home";
const state = (root[KEY] ||= { installed: false, frame: 0, firma: "" });

export function stanzeScelte() {
  const scritto = readJson(CHIAVE_STANZE_IN_PLANCIA, []);
  return Array.isArray(scritto) ? scritto : [];
}

/* Il disegno della stanza, dal catalogo di casa: è lo stesso che la stanza
 * porta nella sua pagina e nel Clima, e prenderne un altro qui vorrebbe dire
 * la stessa stanza con due facce. */
function disegnoDellaStanza(icona) {
  if (!clean(icona)) return "";
  try {
    return root.DashboardModernIconEngine?.markup?.("room", clean(icona), { size: 34 }) || "";
  } catch (_error) {
    return "";
  }
}

const numero = (entity, states) => {
  const grezzo = clean(states?.[clean(entity)]?.state).replace(",", ".");
  const valore = Number.parseFloat(grezzo);
  return Number.isFinite(valore) ? valore : null;
};

/**
 * Cosa dice la card di una stanza: i gradi, l'umidità, e quante cose accese.
 *
 * Le cose accese si contano su quello che la stanza ha davvero dentro — le
 * stesse voci che la sua pagina elenca — e non su un elenco parallelo: due
 * conti della stessa cosa diventano due conti diversi al primo blocco nuovo.
 */
export function riassuntoDellaStanza(pagina, states = allStates()) {
  const gradi = numero(pagina?.temp, states);
  const umidita = numero(pagina?.hum, states);
  let accese = 0;
  for (const blocco of pagina?.blocchi || [])
    for (const voce of blocco?.voci || []) {
      const entity = clean(voce?.entity || voce?.entity_id);
      if (entity && clean(states?.[entity]?.state).toLowerCase() === "on") accese += 1;
    }
  return { gradi, umidita, accese, quante: Number(pagina?.count) || 0 };
}

function cardMarkup(pagina, states) {
  const { gradi, umidita, accese } = riassuntoDellaStanza(pagina, states);
  const disegno = disegnoDellaStanza(pagina.icon);
  const misure = [
    gradi === null ? "" : `${Math.round(gradi)}°`,
    umidita === null ? "" : `${Math.round(umidita)}%`,
  ]
    .filter(Boolean)
    .join(" · ");
  const acceso = accese > 0;
  return `<button type="button" class="dm-stanza-plancia" data-dm-stanza-plancia="${esc(pagina.id)}"
      data-accesa="${acceso}" aria-label="${esc(pagina.name)}">
    <span class="dm-stanza-plancia-ic" aria-hidden="true">${disegno || esc(pagina.icon || "🛋️")}</span>
    <span class="dm-stanza-plancia-testo">
      <b>${esc(pagina.name)}</b>
      <small>${esc(misure)}</small>
    </span>
    ${
      acceso
        ? `<span class="dm-stanza-plancia-accese">${esc(
            accese === 1 ? t("1 accesa", "1 on") : `${accese} ${t("accese", "on")}`,
          )}</span>`
        : ""
    }
  </button>`;
}

function host(pagina) {
  let nodo = doc?.getElementById?.(BLOCCO_ID);
  if (nodo) return nodo;
  if (!pagina) return null;
  nodo = doc.createElement("section");
  nodo.id = BLOCCO_ID;
  nodo.className = "dm-stanze-plancia";
  pagina.append(nodo);
  return nodo;
}

export function renderStanzeInPlancia() {
  const pagina = doc?.getElementById?.("page-home");
  if (!pagina) return false;
  let pagine = [];
  try {
    pagine = stanzeInPlancia(stanzeScelte(), roomPages());
  } catch (_errore) {
    pagine = [];
  }
  const nodo = doc.getElementById(BLOCCO_ID);
  if (!pagine.length) {
    /* Nessuna stanza scelta: il blocco non c'è. Lasciarlo vuoto vorrebbe dire
     * un titolo che annuncia il nulla, che è peggio di niente. */
    nodo?.remove();
    return false;
  }
  const states = allStates();
  const firma = pagine
    .map((voce) => {
      const riassunto = riassuntoDellaStanza(voce, states);
      return [voce.id, voce.name, voce.icon, riassunto.gradi, riassunto.umidita, riassunto.accese].join(
        "|",
      );
    })
    .join("§");
  const casa = host(pagina);
  if (!casa) return false;
  if (state.firma === firma && casa.querySelector("[data-dm-stanza-plancia]")) return true;
  state.firma = firma;
  casa.innerHTML = `<div class="section-title">🛋️ ${esc(t("Stanze", "Rooms"))}</div>
    <div class="dm-stanze-plancia-griglia">${pagine
      .map((voce) => cardMarkup(voce, states))
      .join("")}</div>`;
  return true;
}

function onClick(evento) {
  const card = evento.target?.closest?.("[data-dm-stanza-plancia]");
  if (!card) return;
  evento.preventDefault();
  apriLaStanza(card.getAttribute("data-dm-stanza-plancia") || "");
}

function schedule() {
  if (state.frame) return;
  state.frame =
    root.requestAnimationFrame?.(() => {
      state.frame = 0;
      try {
        renderStanzeInPlancia();
      } catch (errore) {
        root.console?.warn?.("[DashboardModern] stanze in plancia", errore);
      }
    }) || 0;
}

/** Rifà il blocco adesso: lo chiama la scheda quando si spunta una stanza. */
export function ridisegnaStanzeInPlancia() {
  state.firma = "";
  schedule();
}

function stile() {
  installStyle(
    STYLE_ID,
    `
  #${BLOCCO_ID}{display:block;margin-top:18px}
  #${BLOCCO_ID} .dm-stanze-plancia-griglia{
    display:grid;gap:10px;
    grid-template-columns:repeat(auto-fit,minmax(min(190px,100%),1fr))}
  .dm-stanza-plancia{
    display:flex;align-items:center;gap:12px;min-width:0;width:100%;
    padding:13px 14px;border-radius:18px;cursor:pointer;font:inherit;text-align:left;
    color:var(--text,#0f172a);
    background:var(--card-background-color,var(--card-bg,#fff));
    border:1px solid var(--card-border,#e2e8f0);
    box-shadow:0 8px 18px -14px rgba(15,23,42,.85);
    transition:transform .13s ease,border-color .13s ease}
  @media(hover:hover){.dm-stanza-plancia:hover{transform:translateY(-2px)}}
  .dm-stanza-plancia:active{transform:translateY(1px) scale(.99)}
  .dm-stanza-plancia:focus-visible{outline:2px solid var(--accent,#0ea5e9);outline-offset:3px}
  /* Una stanza con qualcosa acceso si vede da lontano: è la ragione per cui
     uno guarda la plancia invece di aprire la pagina. */
  .dm-stanza-plancia[data-accesa="true"]{
    border-color:color-mix(in srgb,#f59e0b 52%,transparent)}
  .dm-stanza-plancia-ic{
    flex:0 0 auto;display:grid;place-items:center;width:42px;height:42px;
    border-radius:14px;font-size:22px;line-height:1;
    background:var(--bg-sculpted,#f0f4f8)}
  .dm-stanza-plancia-ic svg{width:26px;height:26px}
  .dm-stanza-plancia-testo{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
  .dm-stanza-plancia-testo b{
    font-size:13.5px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .dm-stanza-plancia-testo small{
    font-size:11.5px;font-weight:700;color:var(--text-dim,#64748b);
    font-variant-numeric:tabular-nums;white-space:nowrap}
  .dm-stanza-plancia-accese{
    flex:0 0 auto;padding:4px 9px;border-radius:999px;
    font-size:10.5px;font-weight:900;letter-spacing:.04em;text-transform:uppercase;
    color:#b45309;background:color-mix(in srgb,#f59e0b 20%,transparent)}
  `,
  );
}

export function installStanzeInPlancia() {
  if (!doc || state.installed) return false;
  state.installed = true;
  stile();
  doc.addEventListener("click", onClick);
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:state-changed",
    "dashboardmodern:persistence-restored",
  ])
    root.addEventListener?.(evento, schedule);
  schedule();
  return true;
}
