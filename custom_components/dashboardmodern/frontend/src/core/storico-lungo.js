/* Lo storico sui periodi lunghi (#302, dal campo).
 *
 * «Storico non funziona»: con «1 mese» il grafico della temperatura diceva
 * «Nessuno storico disponibile», e il popup «nessun dato». Non era vero: la
 * domanda al Recorder era la stessa delle ventiquattro ore — TUTTI i cambi di
 * stato, senza attributi — e su trenta giorni di un sensore che scrive ogni
 * minuto sono quarantamila righe. Da un Recorder su una scheda SD, attraverso
 * Nabu Casa, non arrivano in dodici secondi: la domanda scadeva, e la scadenza
 * si leggeva come «niente storico».
 *
 * Sui periodi lunghi Home Assistant ha gia' la risposta pronta: le statistiche
 * a lungo termine, una media per ogni ora (e per ogni giorno), che pesano un
 * centesimo e non scadono mai. Un grafico di un mese non ha bisogno di
 * quarantamila punti: settecentoventi medie orarie sono piu' di quante ne
 * possa mostrare. Chi non ha statistiche — un sensore senza `state_class` —
 * torna alla storia, ma ai soli cambi significativi e con piu' pazienza.
 *
 * Qui c'e' la regola: quando si passa alle statistiche, con che grana, e con
 * quanta pazienza; e la traduzione delle statistiche nelle righe che i grafici
 * gia' leggono. Niente rete: si decide e si traduce.
 */

const ORA = 3_600_000;

/** Oltre tre giorni la storia si chiede alle statistiche. */
export const SOGLIA_STATISTICHE_ORE = 72;

/** Le grane delle statistiche e fino a quante ore vale ognuna. */
export const GRANE = Object.freeze([
  Object.freeze({ periodo: "hour", fino: 24 * 62 }),
  Object.freeze({ periodo: "day", fino: Infinity }),
]);

function oreDi(intervallo) {
  const ore = Number(intervallo?.ore);
  if (Number.isFinite(ore) && ore > 0) return ore;
  const durata = Number(intervallo?.end) - Number(intervallo?.start);
  return Number.isFinite(durata) && durata > 0 ? durata / ORA : 0;
}

/** Se per questo intervallo si passa alle statistiche. */
export function vuoleLeStatistiche(intervallo) {
  return oreDi(intervallo) > SOGLIA_STATISTICHE_ORE;
}

/** La grana delle statistiche: un'ora fino a due mesi, poi un giorno. */
export function periodoDelleStatistiche(intervallo) {
  const ore = oreDi(intervallo);
  return (GRANE.find((grana) => ore <= grana.fino) || GRANE[GRANE.length - 1]).periodo;
}

/* Quanto si aspetta il Recorder. Le ventiquattro ore sono la domanda di sempre;
 * una settimana di cambi di stato pesa di piu', e oltre — quando le statistiche
 * non ci sono e si torna alla storia — pesa davvero. */
export function attesaPer(intervallo) {
  const ore = oreDi(intervallo);
  if (ore <= 48) return 12_000;
  if (ore <= 24 * 14) return 20_000;
  return 30_000;
}

/** La domanda delle statistiche, per una sola entita'. */
export function domandaStatistiche(entity, intervallo) {
  return {
    type: "recorder/statistics_during_period",
    start_time: new Date(intervallo.start).toISOString(),
    end_time: new Date(intervallo.end).toISOString(),
    statistic_ids: [String(entity)],
    period: periodoDelleStatistiche(intervallo),
    types: ["mean", "state", "min", "max"],
  };
}

/* La domanda di ripiego: la storia, ma dei soli cambi significativi. Per un
 * sensore numerico Home Assistant salta le variazioni minime, e un mese
 * diventa qualche migliaio di righe invece di quarantamila. */
export function domandaStoriaLeggera(entity, intervallo) {
  return {
    type: "history/history_during_period",
    start_time: new Date(intervallo.start).toISOString(),
    end_time: new Date(intervallo.end).toISOString(),
    entity_ids: [String(entity)],
    include_start_time_state: true,
    significant_changes_only: true,
    minimal_response: true,
    no_attributes: true,
  };
}

/* `Number(null)` fa zero, e uno zero e' una lettura: senza questa guardia una
 * media assente valeva zero gradi invece di cedere il posto allo stato. */
function numero(valore) {
  if (valore === null || valore === undefined || valore === "") return null;
  const n = Number(valore);
  return Number.isFinite(n) ? n : null;
}

/* Un istante delle statistiche: dal 2023 Home Assistant scrive `start` in
 * millisecondi, prima scriveva una data ISO. Si legge tutto. */
function istanteMs(valore) {
  if (typeof valore === "number") return valore < 1_000_000_000_000 ? valore * 1000 : valore;
  const letto = Date.parse(String(valore ?? ""));
  return Number.isFinite(letto) ? letto : null;
}

/**
 * Le statistiche come righe di storia — `{ s, lu }`, lo stato e il momento in
 * secondi — cosi' chi disegna non deve sapere da dove arrivano. Ogni riga vale
 * la media dell'ora (o del giorno); senza media, lo stato di fine periodo. Un
 * elenco vuoto vuol dire «questa entita' non ha statistiche», e chi chiede
 * torna alla storia.
 */
export function righeDalleStatistiche(risposta, entity) {
  const elenco = Array.isArray(risposta?.[entity]) ? risposta[entity] : [];
  return elenco
    .map((voce) => {
      const valore = numero(voce?.mean) ?? numero(voce?.state);
      const quando = istanteMs(voce?.start);
      if (valore === null || quando === null) return null;
      return { s: String(valore), lu: quando / 1000 };
    })
    .filter(Boolean)
    .sort((a, b) => a.lu - b.lu);
}
