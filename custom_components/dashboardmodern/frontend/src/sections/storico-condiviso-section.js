/* Un padrone solo per lo storico chiesto a Recorder.
 *
 * Chi vuole sapere cos'ha fatto un'entita' nelle ultime ore lo chiede qui, e
 * qui c'e' una cache: la stessa entita' chiesta due volte nello stesso giro
 * non produce due domande.
 *
 * Perche' esiste. Il grafico delle temperature aveva il suo modo di chiedere
 * lo storico, con la sua cache. Quando anche la finestra di una tessera ha
 * avuto bisogno della stessa cosa — il modello nel tempo vuole le letture di
 * prima per dire se quella di adesso e' normale — la strada breve era
 * copiarne il codice. Sarebbero stati due padroni dello stesso traffico verso
 * Recorder: due cache che non si parlano, quindi due domande per la stessa
 * entita', e la certezza che prima o poi una delle due scada con una regola
 * diversa dall'altra. E' il difetto che si sta togliendo dappertutto in questi
 * giorni; qui si evitava di crearne uno nuovo.
 *
 * Come si usa. `serieDi` non aspetta: torna quello che ha, e `null` se non ha
 * ancora niente. La domanda parte per conto suo e, quando la risposta arriva,
 * chiama chi si era iscritto. Chi disegna deve poter disegnare subito — il
 * numero grande della finestra c'e' gia', la storia arriva dopo — perche' una
 * finestra che aspetta la rete per aprirsi e' una finestra che su una casa
 * senza Recorder non si apre.
 */

import { normalizeHistoryRows } from "./history-section.js";
import { clean, root } from "./shared.js";

const KEY = "__dmStoricoCondiviso";
const state = (root[KEY] ||= {
  cache: new Map(),
  inCorso: new Map(),
  iscritti: new Set(),
});

/* Quanto vale una risposta prima di richiederla. Nove minuti: lo storico di
 * un'ora non cambia faccia in nove minuti, e chi apre e chiude una finestra
 * tre volte di fila non deve produrre tre domande. */
const BUONA_PER = 9 * 60_000;

/* Dopo un errore si riprova presto ma non subito: una casa senza Recorder
 * risponderebbe «no» a ogni giro di disegno, e sarebbero decine al minuto. */
const RIPROVA_DOPO = 25_000;

async function chiedi(entity, ore) {
  const broker = root.DashboardModernEnergyService?.broker;
  if (typeof broker?.request !== "function") throw new Error("storico non raggiungibile");
  const fine = new Date();
  const inizio = new Date(fine.getTime() - ore * 3600_000);
  const risposta = await broker.request({
    type: "history/history_during_period",
    start_time: inizio.toISOString(),
    end_time: fine.toISOString(),
    entity_ids: [entity],
    include_start_time_state: true,
    significant_changes_only: false,
    minimal_response: true,
    no_attributes: true,
  });
  return normalizeHistoryRows(risposta, entity);
}

/**
 * Le letture di un'entita' nelle ultime ore, se ci sono gia'.
 *
 * Torna `null` finche' non c'e' niente, e un elenco — anche vuoto — quando la
 * risposta e' arrivata. Il `null` va letto come «non lo so ancora», che non e'
 * «non c'e' storia»: chi disegna, sul `null`, non deve scrivere «nessun dato».
 */
export function serieDi(entity, ore = 3) {
  const nome = clean(entity);
  if (!nome) return null;
  const chiave = `${nome}@${ore}`;
  const avuta = state.cache.get(chiave);
  const adesso = Date.now();
  const valeFino = avuta?.fallita ? RIPROVA_DOPO : BUONA_PER;
  if (avuta && adesso - avuta.quando < valeFino) return avuta.righe;
  if (state.inCorso.has(chiave)) return avuta?.righe ?? null;

  state.inCorso.set(
    chiave,
    chiedi(nome, ore)
      .then((righe) => {
        state.cache.set(chiave, { righe, quando: Date.now(), fallita: !righe.length });
        return righe;
      })
      .catch(() => {
        state.cache.set(chiave, { righe: [], quando: Date.now(), fallita: true });
        return [];
      })
      .finally(() => {
        state.inCorso.delete(chiave);
        for (const avvisa of state.iscritti) {
          try {
            avvisa(nome, ore);
          } catch (_errore) {
            /* Un iscritto che si rompe non ferma gli altri. */
          }
        }
      }),
  );
  return avuta?.righe ?? null;
}

/** Chiamami quando arriva una risposta. Torna la funzione per disiscriversi. */
export function quandoArrivaLoStorico(avvisa) {
  if (typeof avvisa !== "function") return () => {};
  state.iscritti.add(avvisa);
  return () => state.iscritti.delete(avvisa);
}

/* Le letture nella forma che vuole il modello nel tempo: quando e quanto.
 *
 * Lo storico normalizzato le da' come «{ state, time }», dove lo stato e'
 * ancora il testo che ha mandato Home Assistant — «21.4», ma anche «on» o
 * «unavailable». Qui passa solo cio' che e' un numero: il modello misura, e su
 * «unavailable» non c'e' niente da misurare. Buttarli e' meglio che contarli
 * zero, che farebbe sembrare spento un sensore che era solo irraggiungibile. */
export function puntiDi(entity, ore = 3, { adesso = null } = {}) {
  const righe = serieDi(entity, ore);
  if (!righe) return null;
  const punti = [];
  for (const riga of righe) {
    const valore = Number(riga?.state);
    const quando = Number(riga?.time);
    if (Number.isFinite(valore) && Number.isFinite(quando) && quando > 0)
      punti.push({ quando, valore });
  }
  /* La lettura di adesso si appende in coda, se chi chiama ce l'ha.
   *
   * La risposta vale nove minuti, e in quei nove minuti la coda della serie
   * resta ferma a com'era: chi legge l'ultimo punto come «il valore di adesso»
   * — ed e' quello che fa il modello — poteva raccontare una stranezza che
   * contraddiceva il numero grande della stessa finestra, per nove minuti. Il
   * valore vivo lo sa gia' chi disegna: lo passa, e la coda e' vera. */
  const vivo = Number(adesso?.valore);
  const quandoVivo = Number(adesso?.quando);
  if (Number.isFinite(vivo) && Number.isFinite(quandoVivo)) {
    const ultimo = punti[punti.length - 1];
    if (!ultimo || quandoVivo > ultimo.quando) punti.push({ quando: quandoVivo, valore: vivo });
  }
  return punti;
}
