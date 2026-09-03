/* Le domande a Home Assistant partono da casa, anche dentro la cornice.
 *
 * «Storico internet dà errore»: nella finestra della connettività, al posto
 * della cronologia, «❌ Storico non disponibile — Failed to fetch».
 *
 * Il perché sta in `core/indirizzo-di-casa.js`, e in breve è questo: la
 * plancia ospitata vive in una cornice `srcdoc`, il cui `location` è
 * `about:srcdoc` e il cui `location.host` è vuoto. Il guscio costruisce
 * `HA_HTTP_URL` da lì e, non sapendo dove sta, indovina: ne esce
 * `http://homeassistant.local:8123`, che è un host che quasi nessuno ha — e
 * che comunque parla in chiaro a una pagina che viaggia in https. La richiesta
 * muore prima di arrivare da qualche parte. Gli indirizzi relativi invece
 * funzionano — si risolvono contro la base del padre — ed è per questo che
 * tutto il resto della plancia va.
 *
 * Il guscio non si tocca: si rigenera. E la riga sbagliata sta DENTRO la
 * funzione che apre la finestra, quindi avvolgerla per nome non servirebbe a
 * niente — quando la si chiama, l'indirizzo è già stato costruito.
 *
 * Allora si sta un gradino sotto, su `fetch`, dove la richiesta passa comunque.
 *
 * Lì si riparano tre cose, che sono tre guasti diversi sulla stessa richiesta
 * e ognuno da solo bastava a non far vedere niente:
 *
 *   - l'indirizzo, che punta a un host indovinato invece che a casa;
 *   - l'autorizzazione, perché la plancia ospitata non ha un gettone ma un
 *     segnale che dice «i cookie bastano», e spedirlo come `Bearer` si prende
 *     un 401 su una richiesta che sarebbe passata da sola;
 *   - il nome dell'entità, perché la domanda nomina una casella della plancia
 *     e non l'entità che ci sta dentro, e il Recorder quella casella non la
 *     conosce.
 *
 * È il motivo per cui si riparano tutti e tre qui, dove la richiesta passa,
 * invece che in tre posti diversi.
 *
 * Tutto il resto passa senza essere guardato due volte, e un documento che sa
 * dove sta non si tocca: dirottare una richiesta che qualcuno ha voluto
 * sarebbe peggio del difetto che si sta correggendo.
 */
import {
  autorizzazioneInutile,
  conLEntitaVera,
  indirizzoRiparato,
  versoLApi,
} from "../core/indirizzo-di-casa.js";
import { doc, root } from "./shared.js";

const KEY = "__DASHBOARDMODERN_INDIRIZZO_DI_CASA__";
const state = (root[KEY] ||= { installed: false });

const DA_RETE = /^https?:\/\//i;

/** La base contro cui risolvere: dentro la cornice è il documento del padre.
 *
 * Solo `http` e `https`. Una base `about:`, `file:` o `blob:` non è un posto
 * da cui chiedere qualcosa a Home Assistant, e prenderla per buona vorrebbe
 * dire trasformare un indirizzo sbagliato in un altro indirizzo sbagliato. */
export function baseDelDocumento() {
  const base = String(doc?.baseURI ?? "").trim();
  if (DA_RETE.test(base)) return base;
  const qui = String(root.location?.href ?? "").trim();
  return DA_RETE.test(qui) ? qui : "";
}

/** L'host di chi sta chiedendo: vuoto dentro una cornice `srcdoc`. */
export function hostDelDocumento() {
  return String(root.location?.host ?? "").trim();
}

/* L'intestazione, qualunque forma abbia: `Headers`, array di coppie, oggetto
 * semplice. Si torna sempre un oggetto semplice, che è quello che `fetch`
 * accetta in ogni caso. */
function intestazioniSemplici(init) {
  const grezze = init?.headers;
  if (!grezze) return null;
  if (typeof grezze.forEach === "function" && typeof grezze.get === "function") {
    const uscita = {};
    grezze.forEach((valore, nome) => {
      uscita[nome] = valore;
    });
    return uscita;
  }
  if (Array.isArray(grezze)) return Object.fromEntries(grezze);
  if (typeof grezze === "object") return { ...grezze };
  return null;
}

function nomeDellAutorizzazione(intestazioni) {
  return Object.keys(intestazioni).find((nome) => nome.toLowerCase() === "authorization") || "";
}

/** L'`init` da usare: `null` quando non c'è niente da cambiare. */
export function initRiparato(init) {
  const intestazioni = intestazioniSemplici(init);
  if (!intestazioni) return null;
  const nome = nomeDellAutorizzazione(intestazioni);
  if (!nome || !autorizzazioneInutile(intestazioni[nome])) return null;
  delete intestazioni[nome];
  return { ...(init || {}), headers: intestazioni };
}

export function installIndirizzoDiCasa() {
  if (state.installed) return false;
  const originale = root.fetch;
  if (typeof originale !== "function" || originale.__dmIndirizzoDiCasa) return false;
  state.installed = true;

  const nostra = function fetch(risorsa, init) {
    /* Solo le stringhe: una `Request` gia' costruita porta con se' il suo
     * indirizzo risolto, e rifarla vorrebbe dire ricopiarne ogni pezzo. Il
     * guscio passa stringhe. */
    if (typeof risorsa !== "string" || !versoLApi(risorsa))
      return originale.call(this, risorsa, init);
    const riparato =
      indirizzoRiparato(risorsa, baseDelDocumento(), hostDelDocumento()) || risorsa;
    /* La mappatura si legge adesso e non all'installazione: la plancia parte
       prima che la configurazione sia arrivata, e una copia presa allora
       sarebbe vuota per sempre. */
    const conNome = conLEntitaVera(riparato, (nome) => root.resolveEntity?.(nome));
    const initNuovo = initRiparato(init);
    return originale.call(this, conNome || riparato, initNuovo || init);
  };
  nostra.__dmIndirizzoDiCasa = true;
  nostra.__dmPrevious = originale;
  root.fetch = nostra;
  return true;
}
