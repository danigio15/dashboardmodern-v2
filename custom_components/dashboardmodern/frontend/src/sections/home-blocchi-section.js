/* I blocchi della Home si mettono nell'ordine che si vuole.
 *
 * «Riordinare a piacere la Home.» Le tessere si riordinavano, le persone si
 * riordinavano, le azioni rapide si riordinavano — ma sempre dentro il loro
 * blocco. L'ordine dei blocchi FRA LORO era scritto nel codice, e ognuno lo
 * decideva per conto suo: le persone si attaccano sotto le pastiglie, i widget
 * si attaccano sotto le persone, le azioni rapide stanno dove le ha messe il
 * documento. Chi rientra in casa e vuole i tasti per primi non poteva averli.
 *
 * Qui non si disegna niente: i blocchi li fanno gli altri, questo li mette in
 * fila. E li mette in fila DOPO che sono nati, perche' un blocco puo' comparire
 * a meta' giro — le persone appena si configurano, i dispositivi appena ce n'e'
 * uno — e un ordine applicato una volta sola durerebbe fino al primo che nasce.
 *
 * Non si tocca la pagina quando non la guarda nessuno: e' la stessa regola del
 * resto della plancia, e qui vale doppio perche' spostare nodi costa
 * impaginazione.
 */
import { BLOCCHI_DELLA_HOME, ordineDeiBlocchi } from "../core/ordine-dei-blocchi.js";
import { doc, readJson, root } from "./shared.js";

const KEY = "__DASHBOARDMODERN_HOME_BLOCCHI__";
const state = (root[KEY] ||= { installed: false, inCoda: false });

export const CHIAVE_ORDINE_BLOCCHI = "cd_home_blocchi";

/** L'ordine salvato, ripulito. */
export function ordineSalvato() {
  return ordineDeiBlocchi(readJson(CHIAVE_ORDINE_BLOCCHI, null));
}

/* I nodi di un blocco, nell'ordine in cui stanno nella pagina.
 *
 * Un blocco puo' essere un nodo solo — le persone e i widget si portano dentro
 * il loro titolo — oppure due, perche' il documento vendorizzato stampa il
 * titolo e la griglia come fratelli. Spostare la griglia e lasciare indietro il
 * titolo e' il modo di ottenere una Home con le scritte staccate da quello che
 * annunciano, quindi un blocco e' sempre TUTTI i suoi pezzi. */
function pezziDelBlocco(nome, pagina) {
  const dentro = (nodo) => (nodo && nodo.parentElement === pagina ? nodo : null);
  if (nome === "persone") return [dentro(doc.getElementById("dm-people"))].filter(Boolean);
  if (nome === "widget") return [dentro(doc.getElementById("dm-widgets"))].filter(Boolean);
  if (nome === "dispositivi")
    return [dentro(doc.getElementById("dev-title")), dentro(doc.getElementById("dev-grid"))].filter(
      Boolean,
    );
  if (nome === "azioni") {
    const griglia = doc.getElementById("qa-grid");
    /* Il ripiano attorno ai tasti lo mette un altro modulo: quando c'e', il
     * blocco e' il ripiano; quando non c'e' ancora, e' la griglia nuda. */
    const vassoio = griglia?.closest?.("[data-dm-vassoio]");
    const corpo = dentro(vassoio) || dentro(griglia);
    if (!corpo) return [];
    const titolo = corpo.previousElementSibling;
    return titolo?.classList?.contains("section-title") && !titolo.id ? [titolo, corpo] : [corpo];
  }
  return [];
}

/* La Home e' quella che si sta guardando? Spostare nodi in una pagina chiusa e'
 * lavoro fatto per nessuno, e costa un'impaginazione per nodo. */
function laHomeSiGuarda() {
  const pagina = doc?.getElementById?.("page-home");
  return pagina?.classList?.contains("active") ? pagina : null;
}

/**
 * Mette i blocchi nell'ordine salvato.
 *
 * Torna `true` se ha spostato qualcosa. Non fa niente quando l'ordine c'e'
 * gia': il paragone costa un giro sui figli, spostare costa un'impaginazione.
 */
export function applicaLOrdineDeiBlocchi(pagina = laHomeSiGuarda()) {
  if (!pagina) return false;
  const fila = ordineSalvato();
  const gruppi = fila.map((nome) => pezziDelBlocco(nome, pagina)).filter((pezzi) => pezzi.length);
  if (gruppi.length < 2) return false;

  /* Si guarda com'e' adesso: se i primi nodi dei gruppi sono gia' in
   * quest'ordine dentro la pagina, non c'e' niente da fare. */
  const figli = [...pagina.children];
  const posizione = (pezzi) => figli.indexOf(pezzi[0]);
  const posizioni = gruppi.map(posizione);
  if (posizioni.every((dove, indice) => indice === 0 || dove > posizioni[indice - 1])) return false;

  /* Il punto da cui si riparte: subito dopo le pastiglie di stato, che restano
   * in cima perche' sono un avviso e non un blocco. Senza pastiglie, subito
   * dopo il primo nodo che non appartiene a nessun blocco — l'intestazione. */
  const miei = new Set(gruppi.flat());
  const pastiglie = doc.getElementById("dashboard-pills-row");
  let dopo =
    pastiglie?.parentElement === pagina
      ? pastiglie
      : figli.filter((nodo) => !miei.has(nodo)).pop() || null;

  for (const pezzi of gruppi)
    for (const nodo of pezzi) {
      if (dopo) dopo.after(nodo);
      else pagina.prepend(nodo);
      dopo = nodo;
    }
  return true;
}

/* Si rimette in fila al giro dopo, una volta sola: i blocchi nascono a momenti
 * diversi e ogni evento che li fa nascere chiamerebbe questa funzione. */
function inCoda() {
  if (state.inCoda) return;
  state.inCoda = true;
  root.queueMicrotask?.(() => {
    state.inCoda = false;
    try {
      applicaLOrdineDeiBlocchi();
    } catch (_error) {}
  });
}

export function installHomeBlocchiSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:persistence-restored",
    "dashboardmodern:state-changed",
    "dashboardmodern:editor-rendered",
    "dashboardmodern:plancia-dipinta",
  ])
    root.addEventListener?.(evento, inCoda);
  /* E quando si TORNA sulla Home.
   *
   * L'ordine si applica solo a pagina aperta — spostare nodi in una pagina
   * chiusa e' lavoro per nessuno — ma il guscio cambia pagina con un
   * ascoltatore scritto dentro il documento, che accende una classe e non
   * avvisa nessuno. Cosi' chi riordina stando su un'altra pagina, o chi torna
   * sulla Home dopo, la trovava com'era finche' non passava di li' un evento
   * di stato per tutt'altra ragione: funzionava per caso, non per costruzione.
   *
   * Questo ascoltatore sta sul documento e parte dopo il loro, che la classe
   * l'ha gia' accesa: al microtask seguente la Home e' quella attiva. */
  doc.addEventListener("click", (evento) => {
    if (evento.target?.closest?.(".tab,[data-tab]")) inCoda();
  });
  inCoda();
}

/* Quali blocchi esistono, per chi disegna la scheda che li riordina. */
export { BLOCCHI_DELLA_HOME };
