/* L'ordine delle stanze lo decide chi ci abita.
 *
 * L'elenco della scheda Stanze e' l'ordine in cui le stanze sono state
 * aggiunte, e quello stesso ordine si ritrova in ogni tendina che chiede «in
 * che stanza sta questa cosa» — elettrodomestici, clima, telecamere — e nelle
 * linguette della pagina Stanze. Chi ha aggiunto il bagnetto per ultimo se lo
 * ritrova per ultimo dappertutto, e l'unico modo di spostarlo era cancellarlo
 * e riscriverlo, perdendo tutto quello che gli era stato attribuito.
 *
 * Qui si aggiungono due frecce per riga. Non riscrivono niente: scambiano due
 * posizioni nell'elenco e lo salvano, che e' esattamente quello che l'ordine
 * e'. La riga non ha bisogno di un salvataggio a parte — l'ordine e' gia'
 * scritto quando la freccia torna su.
 *
 * La scheda la disegna il documento vendorizzato, e non si tocca: le frecce si
 * appoggiano alle righe che disegna lui, riconoscendo la scheda dalle stanze
 * che ci sono scritte. Quando la scheda si ridisegna — e si ridisegna a ogni
 * spostamento — la passata rimette le frecce dov'erano.
 */
import { clean, doc, installStyle, onEditorRedraw, readJson, root, t, writeJsonIfChanged } from "./shared.js";

const KEY = "__DASHBOARDMODERN_ROOMS_ORDER__";
const STYLE_ID = "dm-rooms-order-style";
const MARKER = "dmRoomsOrder";
const ROOMS_KEY = "cd_stanze";
const state = (root[KEY] ||= { installed: false });

function stanze() {
  const valori = readJson(ROOMS_KEY, []);
  return Array.isArray(valori) ? valori : [];
}

function schedaStanze() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab) === "stanze";
}

/* Le righe delle stanze, nell'ordine in cui il documento le disegna — che e'
 * l'ordine dell'elenco salvato. Si guarda solo il primo elenco della scheda:
 * sotto, la scheda ne ha un altro per i piani. */
function righe() {
  const elenco = doc?.querySelector?.("#ed-body .ed-list");
  if (!elenco) return [];
  return [...elenco.querySelectorAll(":scope > .ed-row")];
}

function freccia(direzione, posizione, disabilitata) {
  const su = direzione === -1;
  const invito = su ? t("Più in alto", "Move up") : t("Più in basso", "Move down");
  return (
    `<button type="button" class="ed-del dm-room-move" data-dm-room-move="${direzione}"` +
    ` data-dm-room-at="${posizione}" title="${invito}" aria-label="${invito}"` +
    `${disabilitata ? " disabled" : ""}>${su ? "▲" : "▼"}</button>`
  );
}

/** Attacca le due frecce a ogni riga della scheda Stanze. */
export function ensureRoomsOrder() {
  if (!schedaStanze()) return false;
  const elenco = righe();
  const quante = stanze().length;
  /* Se le righe non sono tante quante le stanze si e' capitati su un'altra
   * lista — o la scheda non ha finito di disegnarsi — e allora si aspetta: una
   * freccia che sposta la riga sbagliata e' peggio di nessuna freccia. */
  if (!elenco.length || elenco.length !== quante) return false;
  allineaOrdine();
  let messe = 0;
  elenco.forEach((riga, posizione) => {
    if (riga.querySelector("[data-dm-room-move]")) return;
    const cestino = riga.querySelector(".ed-del");
    const markup = freccia(-1, posizione, posizione === 0) + freccia(1, posizione, posizione === quante - 1);
    if (cestino) cestino.insertAdjacentHTML("beforebegin", markup);
    else riga.insertAdjacentHTML("beforeend", markup);
    messe += 1;
  });
  return messe > 0;
}

/* L'ordine non e' solo l'elenco: e' anche il numero scritto su ogni stanza.
 *
 * Qui c'era scritto «l'ordine e' l'elenco: non c'e' altro da scrivere», e non
 * era piu' vero. Il modello canonico porta su ogni stanza un campo `order`, e
 * chi lo trova gia' scritto se lo tiene (`migrateRooms`): quel numero nasce
 * alla prima migrazione e vale la posizione di ALLORA. Le pagine che
 * raggruppano per stanza — Luci, Tapparelle, Clima, Elettrodomestici —
 * ordinano su quel campo, non sull'elenco.
 *
 * Il risultato lo si vedeva e non si capiva: le frecce spostavano la riga, la
 * scheda Stanze si ridisegnava nell'ordine nuovo — la scheda l'elenco lo legge
 * davvero — e tutte le altre pagine restavano nell'ordine in cui le stanze
 * erano state create. Chi ha messo l'Ingresso per primo continuava a vedere
 * il Soggiorno in cima alle tapparelle.
 *
 * Adesso quando l'elenco cambia si riscrive anche il numero, uno per riga.
 * Elenco e campo dicono la stessa cosa, e non c'e' piu' un secondo padrone. */
function numerate(elenco) {
  return elenco.map((stanza, posizione) =>
    Number(stanza?.order) === posizione ? stanza : { ...stanza, order: posizione },
  );
}

/** Vero se qualche stanza porta un numero che non e' la sua posizione. */
function daRinumerare(elenco) {
  return elenco.some((stanza, posizione) => Number(stanza?.order) !== posizione);
}

/* La stessa correzione, per chi l'ordine se l'era gia' scelto.
 *
 * Chi ha ordinato le stanze prima di questa versione ha in casa un elenco
 * giusto e dei numeri vecchi, e senza toccare piu' le frecce resterebbe cosi'
 * per sempre. La passata che attacca le frecce allinea i numeri all'elenco:
 * l'elenco e' quello che si vede e quello che si e' scelto, quindi e' lui ad
 * avere ragione. */
export function allineaOrdine() {
  const elenco = stanze();
  if (!elenco.length || !daRinumerare(elenco)) return false;
  return writeJsonIfChanged(ROOMS_KEY, numerate(elenco));
}

/** Scambia due stanze e salva, riscrivendo i numeri d'ordine. */
export function spostaStanza(posizione, direzione) {
  const elenco = stanze();
  const bersaglio = posizione + direzione;
  if (!Number.isInteger(posizione) || posizione < 0 || posizione >= elenco.length) return false;
  if (bersaglio < 0 || bersaglio >= elenco.length) return false;
  const prossimo = elenco.slice();
  [prossimo[posizione], prossimo[bersaglio]] = [prossimo[bersaglio], prossimo[posizione]];
  writeJsonIfChanged(ROOMS_KEY, numerate(prossimo));
  return true;
}

function onClick(event) {
  const freccia = event.target?.closest?.("[data-dm-room-move]");
  if (!freccia || freccia.disabled) return;
  event.preventDefault();
  const posizione = Number(freccia.dataset.dmRoomAt);
  const direzione = Number(freccia.dataset.dmRoomMove);
  if (!spostaStanza(posizione, direzione)) return;
  /* Si ridisegna la scheda con la stessa chiamata che usa il documento quando
   * si aggiunge o si toglie una stanza: le righe tornano nell'ordine nuovo, e
   * le frecce ci si riattaccano da sole. E le pagine che leggono le stanze si
   * ridisegnano anche loro, altrimenti l'ordine nuovo si vedrebbe solo qui. */
  try {
    root.editorSwitch?.("stanze");
  } catch (_error) {}
  try {
    root.buildTempCards?.();
  } catch (_error) {}
  try {
    root.render?.();
  } catch (_error) {}
  root.setTimeout?.(ensureRoomsOrder, 0);
}

export function installRoomsOrderEditor() {
  if (state.installed || !doc) return false;
  state.installed = true;
  installStyle(
    STYLE_ID,
    `
#ed-body .ed-row .dm-room-move{
  flex:0 0 30px;width:30px;height:30px;display:grid;place-items:center;
  font-size:12px;line-height:1;cursor:pointer;opacity:.75}
#ed-body .ed-row .dm-room-move:hover{opacity:1}
#ed-body .ed-row .dm-room-move[disabled]{opacity:.22;cursor:default}
`,
  );
  doc.addEventListener("click", onClick, true);
  onEditorRedraw("__dmRoomsOrder_editorSwitch", () => {
    /* La scheda si disegna in piu' fotogrammi: la prima passata puo' trovare
     * la lista ancora vuota. Si riprova qualche volta, come fa chi aggiunge un
     * pezzo alle schede vendorizzate. */
    ensureRoomsOrder();
    for (const attesa of [60, 220, 600]) root.setTimeout?.(ensureRoomsOrder, attesa);
  });
  /* Cambiare scheda non passa sempre da `editorSwitch`: un tocco su una
   * linguetta e' il momento in cui si arriva qui. */
  doc.addEventListener(
    "click",
    (event) => {
      if (event.target?.closest?.(".ed-tab")) for (const attesa of [0, 120, 400]) root.setTimeout?.(ensureRoomsOrder, attesa);
    },
    true,
  );
  ensureRoomsOrder();
  return true;
}

export { MARKER };
