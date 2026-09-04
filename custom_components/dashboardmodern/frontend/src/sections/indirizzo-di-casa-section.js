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
import {
  domandaDallIndirizzo,
  domandaStatisticheDallaDomanda,
  entitaSenzaRighe,
  eUnoStoricoRest,
  intervalloDellaDomanda,
  rispostaComeRest,
  rispostaDalleStatistiche,
  unisciRisposte,
} from "../core/storico-rest.js";
import { chiediAHomeAssistant, doc, gettoneDiAccesso, lexicalGlobal, root } from "./shared.js";

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

/* ─── Lo storico REST passa dal socket ────────────────────────────────────
 *
 * Riparato l'indirizzo, la chiamata REST allo storico ha ancora un modo di
 * fallire, ed e' il piu' rumoroso: dentro il pannello di Home Assistant la
 * plancia non ha nessun gettone, il `Bearer` finto viene tolto qui sopra, e la
 * richiesta parte nuda. Home Assistant risponde 401 e suona la campanella —
 * «Login attempt or request with invalid authentication from 127.0.0.1», che
 * da Nabu Casa e' l'indirizzo di tutti. Il guscio lo storico lo chiede in dieci
 * posti, uno dei quali ogni dieci minuti (la derivazione dei totali): dieci
 * campanelle e nessun dato.
 *
 * Il socket del guscio e' autenticato e conosce la stessa domanda. Allora la
 * si traduce: l'indirizzo REST diventa `history/history_during_period`, e la
 * risposta torna nella forma del REST, in una `Response` vera. Il guscio non
 * se ne accorge. Chi ha un gettone vero (la pagina fuori dal pannello) e vede
 * il socket chiuso continua col REST; chi non ce l'ha riceve un 502 pulito, che
 * il guscio gia' tratta come «niente dati», e nessuna campanella. */
export const ATTESA_STORICO_MS = 30_000;

function socketPronto() {
  const socket = lexicalGlobal("ws");
  return Boolean(socket && socket.readyState === 1 && lexicalGlobal("pendingWsCallbacks"));
}

function rispostaJson(corpo, status = 200) {
  const testo = JSON.stringify(corpo);
  if (typeof root.Response === "function") {
    return new root.Response(testo, {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => corpo,
    text: async () => testo,
  };
}

/** Lo storico REST servito dal socket; `null` se questa richiesta non e' uno storico. */
export function storicoViaSocket(indirizzo, ripiego) {
  if (!eUnoStoricoRest(indirizzo)) return null;
  const domanda = domandaDallIndirizzo(indirizzo);
  if (!domanda) return null;
  if (!socketPronto()) return gettoneDiAccesso() ? ripiego() : Promise.resolve(rispostaJson([], 502));
  const dallaStoria = () =>
    chiediAHomeAssistant(domanda, ATTESA_STORICO_MS).then((risultato) =>
      rispostaComeRest(risultato, domanda.entity_ids),
    );
  /* Un periodo lungo — la derivazione dei totali dall'inizio dell'anno, i
   * popup di una settimana — pesa sul server se lo si chiede come storia
   * grezza: si chiedono le statistiche, e alla storia si torna solo per le
   * entita' che non ne hanno (dal campo: la CPU del mini PC). */
  const statistiche = domandaStatisticheDallaDomanda(domanda);
  const fine = intervalloDellaDomanda(domanda)?.end;
  const righe = statistiche
    ? chiediAHomeAssistant(statistiche, ATTESA_STORICO_MS).then((risultato) => {
        /* L'ultima riga si ferma alla fine chiesta, non a adesso: un periodo
         * storico finisce dove finisce. */
        const tradotte = rispostaDalleStatistiche(
          risultato,
          domanda.entity_ids,
          statistiche.period,
          fine,
        );
        /* Alla storia torna solo chi non ha statistiche — un contatto in mezzo
         * ai contatori — e le altre entita' tengono le loro righe; se la storia
         * non arriva, resta quello che c'e'. */
        const mancanti = entitaSenzaRighe(domanda.entity_ids, tradotte);
        if (!mancanti.length) return tradotte;
        return chiediAHomeAssistant({ ...domanda, entity_ids: mancanti }, ATTESA_STORICO_MS)
          .then((risultatoStoria) =>
            unisciRisposte(domanda.entity_ids, tradotte, rispostaComeRest(risultatoStoria, mancanti)),
          )
          .catch(() => tradotte);
      })
    : dallaStoria();
  return righe
    .then((elenco) => rispostaJson(elenco))
    .catch(() => (gettoneDiAccesso() ? ripiego() : rispostaJson([], 502)));
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
    const finale = conNome || riparato;
    const viaSocket = storicoViaSocket(finale, () =>
      originale.call(this, finale, initNuovo || init),
    );
    if (viaSocket) return viaSocket;
    return originale.call(this, finale, initNuovo || init);
  };
  nostra.__dmIndirizzoDiCasa = true;
  nostra.__dmPrevious = originale;
  root.fetch = nostra;
  return true;
}
