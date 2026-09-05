/* Anche i cerchi grandi aprono il loro storico, in Giornaliera e Mensile.
 *
 * «Nella sezione energia giornaliera e mensile non si apre, sui cerchi che non
 * sono i carichi, i dati storici.»
 *
 * Nella vista Istantanea tutti e quattro i cerchi grandi — Solare, Rete,
 * Batteria, Casa — hanno il loro `apriStorico`. Nelle altre due no: il
 * documento vendorizzato li disegna senza `onclick` e senza la classe che dice
 * «questo si tocca», e i carichi sotto invece ce l'hanno. Chi tocca la Casa
 * nella Giornaliera non ottiene niente, e non c'e' modo di capire che quel
 * cerchio non e' fatto per essere toccato mentre i suoi vicini lo sono.
 *
 * Qui si aggiunge quello che manca, senza toccare il documento: ogni cerchio
 * prende l'entita' che sta gia' mostrando in quella vista — il totale del
 * giorno o quello del mese, non la potenza istantanea, che sarebbe lo storico
 * di un'altra cosa.
 *
 * Rete e Batteria hanno due numeri, non uno: prelevata e immessa, caricata e
 * scaricata. Lo storico si apre su quello che si legge per primo — quanto e'
 * entrato — perche' e' la domanda che uno si fa guardando quel cerchio.
 */
import { doc, installStyle, onEditorRedraw, root, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_CERCHI_STORICO__";
const state = (root[KEY] ||= { installed: false });

/* Per ogni cerchio: dove sta, cosa mostra, e come si chiama nello storico.
 * I riferimenti sono gli stessi che il guscio scrive dentro quel cerchio. */
const CERCHI = Object.freeze([
  {
    id: "n-solar-day",
    ref: "dm.energy_produzione_solare_oggi",
    nome: () => t("Produzione solare · Oggi", "Solar production · Today"),
  },
  {
    id: "n-home-day",
    ref: "dm.energy_consumo_casa_oggi",
    nome: () => t("Consumo casa · Oggi", "Home consumption · Today"),
  },
  {
    id: "n-grid-day",
    ref: "dm.energy_energia_prelevata_oggi",
    nome: () => t("Prelevata dalla rete · Oggi", "Taken from the grid · Today"),
  },
  {
    id: "n-battery-day",
    ref: "dm.energy_batteria_caricata_oggi",
    nome: () => t("Batteria caricata · Oggi", "Battery charged · Today"),
  },
  {
    id: "n-solar-month",
    ref: "dm.energy_produzione_solare_mese",
    nome: () => t("Produzione solare · Mese", "Solar production · Month"),
  },
  {
    id: "n-home-month",
    ref: "dm.energy_consumo_casa_mese",
    nome: () => t("Consumo casa · Mese", "Home consumption · Month"),
  },
  {
    id: "n-grid-month",
    ref: "dm.energy_rete_acquistata_mese",
    nome: () => t("Acquistata dalla rete · Mese", "Bought from the grid · Month"),
  },
  {
    id: "n-battery-month",
    ref: "dm.energy_batteria_caricata_mese",
    nome: () => t("Batteria caricata · Mese", "Battery charged · Month"),
  },
]);

export function collegaICerchiAlloStorico() {
  if (!doc) return 0;
  let quanti = 0;
  for (const cerchio of CERCHI) {
    const nodo = doc.getElementById(cerchio.id);
    if (!nodo) continue;
    /* Si collega e basta, come fa la vista Istantanea con gli stessi quattro
     * cerchi: li' l'`onclick` c'e' sempre, configurato o no. Mettere qui una
     * condizione che li' non c'e' vorrebbe dire inventare un terzo
     * comportamento — toccabile, non toccabile, e toccabile solo a volte — su
     * cerchi che sono gli stessi nelle tre viste. Uno storico senza dati si
     * comporta come si e' sempre comportato. */
    if (nodo.dataset.dmStoricoRef === cerchio.ref) continue;
    nodo.dataset.dmStoricoRef = cerchio.ref;
    nodo.classList.add("hist-clickable");
    nodo.setAttribute("title", `${t("Apri lo storico", "Open the history")} — ${cerchio.nome()}`);
    nodo.setAttribute("role", "button");
    nodo.setAttribute("tabindex", "0");
    quanti += 1;
  }
  return quanti;
}

/* Un ascoltatore solo sul documento, invece di uno per cerchio: i cerchi li
 * ridisegna il guscio, e un ascoltatore appeso al nodo se ne andrebbe con lui. */
function apri(nodo, event) {
  const cerchio = CERCHI.find((voce) => voce.id === nodo.id);
  if (!cerchio) return;
  try {
    root.apriStorico?.(event, cerchio.ref, cerchio.nome());
  } catch (_error) {}
}

function onClick(event) {
  const nodo = event.target?.closest?.("[data-dm-storico-ref]");
  if (!nodo || !nodo.dataset.dmStoricoRef) return;
  apri(nodo, event);
}

function onKey(event) {
  if (event.key !== "Enter" && event.key !== " ") return;
  const nodo = event.target?.closest?.("[data-dm-storico-ref]");
  if (!nodo || !nodo.dataset.dmStoricoRef) return;
  event.preventDefault();
  apri(nodo, event);
}

function installStyles() {
  installStyle(
    "dm-cerchi-storico-style",
    `
      /* Il cerchio collegato si comporta come i carichi che gli stanno sotto:
         stessa mano del mouse, stesso anello quando si arriva col tasto di
         tabulazione. La classe «hist-clickable» il foglio del guscio la
         conosce gia'; qui si aggiunge solo quello che le manca. */
      #page-energy .node[data-dm-storico-ref]{cursor:pointer}
      #page-energy .node[data-dm-storico-ref]:focus-visible{
        outline:2px solid var(--primary-color,#0ea5e9);outline-offset:3px}
    `,
  );
}

export function installEnergiaCerchiStorico() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  doc.addEventListener("click", onClick);
  doc.addEventListener("keydown", onKey);
  onEditorRedraw("__dmCerchiStorico", () => root.queueMicrotask?.(collegaICerchiAlloStorico));
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:persistence-restored",
    "dashboardmodern:state-changed",
  ])
    root.addEventListener?.(evento, () => root.queueMicrotask?.(collegaICerchiAlloStorico));
  collegaICerchiAlloStorico();
}
