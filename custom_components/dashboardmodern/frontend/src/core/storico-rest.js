/* Lo storico chiesto via REST, servito dal socket.
 *
 * Il guscio chiede lo storico con `fetch` a `/api/history/period/...` e un
 * `Authorization: Bearer <gettone>`. Dentro il pannello di Home Assistant — e
 * quindi da Nabu Casa — la plancia non possiede nessun gettone: l'autenticazione
 * sta tutta nella connessione del pannello, e ogni chiamata REST del browser
 * risponde 401. Home Assistant, a ogni 401, scrive «Login attempt or request
 * with invalid authentication from 127.0.0.1»: una campanella ogni dieci minuti,
 * per una derivazione dei totali che non arrivava mai, e niente storico nel
 * Report dell'energia, nella connettivita', nei dettagli degli apparecchi.
 *
 * Il socket invece e' autenticato, e sa rispondere alla stessa domanda:
 * `history/history_during_period`. Qui c'e' la traduzione, nelle due direzioni
 * — dall'indirizzo REST alla domanda per il socket, e dalla risposta del
 * socket alla forma che il REST avrebbe dato — cosi' il guscio riceve quello
 * che aspettava senza sapere da dove e' arrivato. Niente rete e niente DOM:
 * stringhe e oggetti, che si provano da soli.
 */

import { periodoDelleStatistiche, vuoleLeStatistiche } from "./storico-lungo.js";

const pulito = (valore) => String(valore ?? "").trim();

const PERCORSO = /\/api\/history\/period\/?([^?#]*)/i;

/** Se un indirizzo chiede lo storico REST di Home Assistant. */
export function eUnoStoricoRest(indirizzo) {
  return PERCORSO.test(pulito(indirizzo));
}

function istante(testo) {
  const voce = pulito(testo);
  if (!voce) return null;
  const data = new Date(voce);
  return Number.isFinite(data.getTime()) ? data.toISOString() : null;
}

/* Un parametro «di presenza»: `&minimal_response` vale si', `=false` vale no. */
function bandiera(parametri, nome, seManca) {
  if (!parametri.has(nome)) return seManca;
  const valore = pulito(parametri.get(nome)).toLowerCase();
  return !(valore === "false" || valore === "0" || valore === "no");
}

/**
 * La domanda per il socket, dall'indirizzo REST. `null` se l'indirizzo non e'
 * uno storico o non dice quali entita' vuole: in quel caso non c'e' niente da
 * tradurre, e la richiesta va per la sua strada.
 */
export function domandaDallIndirizzo(indirizzo) {
  const voce = pulito(indirizzo);
  const trovato = PERCORSO.exec(voce);
  if (!trovato) return null;
  let parametri;
  try {
    parametri = new URLSearchParams(voce.slice(voce.indexOf("?") + 1 || voce.length));
  } catch (_errore) {
    return null;
  }
  const entita = pulito(parametri.get("filter_entity_id")).split(",").map(pulito).filter(Boolean);
  if (!entita.length) return null;
  let inizio = null;
  try {
    inizio = istante(decodeURIComponent(trovato[1]));
  } catch (_errore) {
    inizio = istante(trovato[1]);
  }
  /* Senza inizio il REST parte da un giorno fa: si fa lo stesso. */
  const start_time = inizio || new Date(Date.now() - 86400000).toISOString();
  const domanda = {
    type: "history/history_during_period",
    start_time,
    entity_ids: entita,
    include_start_time_state: true,
    /* Il REST li tratta da presenza: `&minimal_response` senza valore e' si'. */
    minimal_response: bandiera(parametri, "minimal_response", false),
    no_attributes: bandiera(parametri, "no_attributes", false),
    significant_changes_only: bandiera(parametri, "significant_changes_only", true),
  };
  const fine = istante(parametri.get("end_time"));
  if (fine) domanda.end_time = fine;
  return domanda;
}

/* ── i periodi lunghi passano dalle statistiche (dal campo: la CPU) ─────
 *
 * La derivazione dei totali del guscio chiede la storia grezza di un sensore
 * di energia DALL'INIZIO DELL'ANNO, ogni dieci minuti. Un contatore che
 * scrive ogni dieci secondi sono decine di migliaia di righe da leggere dal
 * database e da serializzare: un picco del processore del server a ogni giro,
 * per ricavarne due numeri — il valore all'inizio del periodo e quello di
 * adesso. Dentro il pannello quella chiamata prima falliva con 401 e non
 * costava niente; ora che passa dal socket deve costare poco.
 *
 * Oltre tre giorni si chiedono le statistiche del Recorder — un'ora fino a due
 * mesi, un giorno oltre — e si rispondono come righe di storia: lo stato di
 * fine periodo, datato alla fine del periodo, che e' una lettura vera presa
 * in quel momento. La domanda parte un periodo prima dell'inizio chiesto,
 * cosi' la prima riga cade esattamente sull'inizio e chi cerca «la prima
 * lettura del periodo» la trova li'. Un'entita' senza statistiche — un
 * contatto, un testo — non ha righe, e chi chiede torna alla storia. */
const DURATA_PERIODO = Object.freeze({ hour: 3_600_000, day: 86_400_000 });

/** Da quando a quando chiede una domanda di storia, in millisecondi. */
export function intervalloDellaDomanda(domanda, adesso = Date.now()) {
  const start = Date.parse(pulito(domanda?.start_time));
  const end = domanda?.end_time ? Date.parse(pulito(domanda.end_time)) : adesso;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return { start, end };
}

/**
 * La domanda delle statistiche al posto di quella di storia, se il periodo e'
 * lungo; `null` se e' corto, e allora la storia va bene com'e'.
 */
export function domandaStatisticheDallaDomanda(domanda, adesso = Date.now()) {
  const intervallo = intervalloDellaDomanda(domanda, adesso);
  if (!intervallo || !vuoleLeStatistiche(intervallo)) return null;
  const entita = Array.isArray(domanda?.entity_ids)
    ? domanda.entity_ids.map(pulito).filter(Boolean)
    : [];
  if (!entita.length) return null;
  const period = periodoDelleStatistiche(intervallo);
  return {
    type: "recorder/statistics_during_period",
    start_time: new Date(intervallo.start - DURATA_PERIODO[period]).toISOString(),
    end_time: new Date(intervallo.end).toISOString(),
    statistic_ids: entita,
    period,
    types: ["state", "mean"],
  };
}

function numeroOMeno(valore) {
  if (valore === null || valore === undefined || valore === "") return null;
  const n = Number(valore);
  return Number.isFinite(n) ? n : null;
}

function inizioMs(valore) {
  if (typeof valore === "number") return valore < 1_000_000_000_000 ? valore * 1000 : valore;
  const letto = Date.parse(String(valore ?? ""));
  return Number.isFinite(letto) ? letto : null;
}

/**
 * Le statistiche nella forma del REST: per ogni entita' le sue righe, ognuna
 * con lo stato di fine periodo datato alla fine del periodo (mai nel futuro).
 * Solo le entita' che hanno almeno una riga, come fa il REST.
 */
export function rispostaDalleStatistiche(
  risultato,
  entityIds = [],
  period = "hour",
  adesso = Date.now(),
) {
  const perEntita =
    risultato && typeof risultato === "object" && !Array.isArray(risultato) ? risultato : {};
  const durata = DURATA_PERIODO[period] || DURATA_PERIODO.hour;
  const fuori = [];
  for (const entity of entityIds.length ? entityIds : Object.keys(perEntita)) {
    const voci = (Array.isArray(perEntita[entity]) ? perEntita[entity] : [])
      .map((voce) => ({
        inizio: inizioMs(voce?.start),
        valore: numeroOMeno(voce?.state) ?? numeroOMeno(voce?.mean),
      }))
      .filter((voce) => voce.inizio !== null && voce.valore !== null)
      .sort((a, b) => a.inizio - b.inizio);
    const righe = voci
      .map((voce, indice) => {
        const fine = Math.min(voci[indice + 1]?.inizio ?? voce.inizio + durata, adesso);
        return rigaComeRest({ s: String(voce.valore), lu: fine / 1000 }, entity);
      })
      .filter(Boolean);
    if (righe.length) fuori.push(righe);
  }
  return fuori;
}

function isoDaSecondi(secondi) {
  const n = Number(secondi);
  if (!Number.isFinite(n)) return "";
  return new Date(n * 1000).toISOString();
}

/* Una riga come la darebbe il REST: `state`, `last_changed`, `last_updated`,
 * `entity_id`, `attributes`. Il socket la scrive compressa — `s`, `lu`, `lc`
 * (solo se diverso da `lu`), `a` (solo dove ci sono) — e il guscio legge la
 * forma lunga. */
function rigaComeRest(riga, entity) {
  if (!riga || typeof riga !== "object") return null;
  const stato = riga.s ?? riga.state;
  if (stato === undefined || stato === null) return null;
  const aggiornata = riga.lu !== undefined ? isoDaSecondi(riga.lu) : pulito(riga.last_updated);
  const cambiata =
    riga.lc !== undefined ? isoDaSecondi(riga.lc) : pulito(riga.last_changed) || aggiornata;
  return {
    entity_id: entity,
    state: String(stato),
    last_changed: cambiata || aggiornata,
    last_updated: aggiornata || cambiata,
    attributes:
      riga.a && typeof riga.a === "object"
        ? riga.a
        : riga.attributes && typeof riga.attributes === "object"
          ? riga.attributes
          : {},
  };
}

/**
 * La risposta del socket nella forma del REST: un elenco per entita', nell'ordine
 * chiesto, e solo le entita' che hanno almeno una riga — e' quello che il REST
 * fa, e il guscio legge `json[0]` per l'unica entita' che ha chiesto.
 */
export function rispostaComeRest(risultato, entityIds = []) {
  const perEntita =
    risultato && typeof risultato === "object" && !Array.isArray(risultato) ? risultato : {};
  const ordine = entityIds.length ? entityIds : Object.keys(perEntita);
  const fuori = [];
  for (const entity of ordine) {
    const righe = Array.isArray(perEntita[entity]) ? perEntita[entity] : [];
    const tradotte = righe.map((riga) => rigaComeRest(riga, entity)).filter(Boolean);
    if (tradotte.length) fuori.push(tradotte);
  }
  return fuori;
}
