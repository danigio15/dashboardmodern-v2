/* Una stanza si mostra col suo nome, mai col suo identificativo.
 *
 * «Verifica inoltre perché esce sotto room etc»: nella scheda delle Finestre,
 * sotto «Tapparella salone», c'era scritto «🏠 room_mt8vpz7m». Lo stesso nelle
 * zone dell'irrigazione, e sulla pagina dell'irrigazione nella riga che separa
 * i gruppi.
 *
 * La ragione è una sola e sta nel guscio vendorizzato. La tendina delle stanze
 * salva l'ID — ed è giusto: è l'unica cosa che regge un rinominamento — ma gli
 * elenchi che stampa il guscio scrivono quello che trovano, e quello che
 * trovano, da quando la tendina salva l'id, è l'id. Le pagine nate dopo
 * chiedono già il nome a `roomLabel`; quelle del guscio no, e quel guscio non
 * si tocca.
 *
 * Qui l'id torna il nome, dove si legge. È una riparazione di superficie, e lo
 * è per forza: il posto giusto sarebbe dentro chi stampa, e chi stampa è un
 * file che si rigenera. Perciò è scritta stretta — si guarda solo dove un id
 * può uscire, e solo se ce n'è davvero uno — invece di passare il documento al
 * setaccio a ogni disegno.
 *
 * E c'è la metà che non si vede: `cdRoomFloorOf` cerca la stanza per nome, e
 * con un id in mano tornava «nessun piano». Le tapparelle di una casa a due
 * piani finivano tutte insieme sotto lo stesso gruppo. Adesso quella domanda
 * accetta tutt'e due le scritture.
 */
import { clean, doc, onEditorRedraw, roomLabel, root, wrapFunction } from "./shared.js";

const KEY = "__DASHBOARDMODERN_STANZE_PER_NOME__";
const state = (root[KEY] ||= { installed: false, frame: 0 });

/* Un identificativo di stanza come lo scrive il guscio: `room_` e poi la
 * base36 del momento in cui è nata. Il minimo di quattro caratteri tiene fuori
 * una parola che cominci per «room_» e finisca lì. */
const ID_STANZA = /\broom_[a-z0-9]{4,}\b/gi;

/** Il testo con gli identificativi sostituiti dai nomi. */
export function testoConINomi(testo, nome = roomLabel) {
  return String(testo ?? "").replace(ID_STANZA, (id) => {
    const trovato = clean(nome(id));
    /* Una stanza cancellata non ha più un nome: l'id resta, che è brutto ma
     * vero — inventarle un nome sarebbe peggio. */
    return trovato && trovato !== id ? trovato : id;
  });
}

/* I nodi di testo di un sottoalbero, uno per volta. Si entra solo se in tutto
 * il sottoalbero c'è almeno un id: è una scansione di stringa sola, e nel caso
 * normale — che è «non ce n'è nessuno» — si esce subito. */
function raddrizza(radice) {
  if (!radice || !String(radice.textContent || "").includes("room_")) return 0;
  const passeggiata = doc.createTreeWalker(radice, root.NodeFilter?.SHOW_TEXT ?? 4);
  let cambiati = 0;
  const daCambiare = [];
  for (let nodo = passeggiata.nextNode(); nodo; nodo = passeggiata.nextNode()) {
    const testo = nodo.nodeValue || "";
    if (!testo.includes("room_")) continue;
    const nuovo = testoConINomi(testo);
    if (nuovo !== testo) daCambiare.push([nodo, nuovo]);
  }
  /* Prima si legge tutto, poi si scrive: scrivere dentro la passeggiata
   * significa camminare su un albero che cambia sotto i piedi. */
  for (const [nodo, nuovo] of daCambiare) {
    nodo.nodeValue = nuovo;
    cambiati += 1;
  }
  return cambiati;
}

/** Dove un id può uscire: la scheda aperta e la pagina che si sta guardando. */
export function raddrizzaLeStanze() {
  if (!doc) return 0;
  let cambiati = raddrizza(doc.getElementById("ed-body"));
  for (const pagina of doc.querySelectorAll(".page.active")) cambiati += raddrizza(pagina);
  return cambiati;
}

/* Il piano di una stanza, cercandola come è scritta.
 *
 * Il guscio la cerca solo per nome; con un id in mano tornava «nessun piano», e
 * i gruppi di una casa a due piani si schiacciavano in uno solo. Si chiede
 * prima come è arrivata, e se non si trova si richiede col nome. */
function insegnaIlPiano() {
  const originale = root.cdRoomFloorOf;
  if (typeof originale !== "function" || originale.__dmStanzePerNome) return false;
  const nostra = function cdRoomFloorOf(riferimento) {
    const suo = originale.call(this, riferimento);
    if (suo) return suo;
    const nome = clean(roomLabel(riferimento));
    return nome && nome !== clean(riferimento) ? originale.call(this, nome) : suo;
  };
  nostra.__dmStanzePerNome = true;
  nostra.__dmPrevious = originale;
  root.cdRoomFloorOf = nostra;
  return true;
}

function schedule() {
  if (state.frame) return;
  state.frame =
    root.requestAnimationFrame?.(() => {
      state.frame = 0;
      try {
        raddrizzaLeStanze();
      } catch (errore) {
        root.console?.warn?.("[DashboardModern] stanze per nome", errore);
      }
    }) || 0;
}

export function installStanzePerNome() {
  if (!doc || state.installed) return false;
  state.installed = true;
  insegnaIlPiano();
  /* Il piano si insegna appena il guscio esiste: alla prima installazione può
   * non esserci ancora. */
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:state-changed",
    "dashboardmodern:editor-rendered",
  ])
    root.addEventListener?.(evento, () => {
      insegnaIlPiano();
      schedule();
    });
  onEditorRedraw("__dmStanzePerNome", () => root.queueMicrotask?.(schedule));
  for (const nome of ["render", "buildTappCards", "buildIrrCards", "cdApplyNavVis"])
    wrapFunction(nome, "__dmStanzePerNome", schedule);
  schedule();
  return true;
}
