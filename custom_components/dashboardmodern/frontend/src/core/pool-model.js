/* Piu' di una piscina.
 *
 * La configurazione ne ha sempre tenuta una sola: `cd_piscina` e' un oggetto
 * con dentro i sensori e i comandi di quella vasca, e tutto il programma —
 * l'anteprima, i comandi, il conteggio della filtrazione — parla di quella.
 * Chi ne ha due non aveva modo di dirlo.
 *
 * La forma salvata non cambia per chi ne ha una: la prima piscina resta dov'e'
 * sempre stata, in cima all'oggetto, e le altre si aggiungono in un elenco
 * accanto. Cosi' una configurazione esistente non va migrata, il runtime
 * vendorizzato continua a leggere la prima vasca come ha sempre fatto, e nessun
 * dato finisce scritto in due posti.
 *
 * Il modulo e' puro: mette in ordine oggetti, non legge lo stato e non tocca
 * il DOM.
 */

const clean = (value) => String(value ?? "").trim();

const numero = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/** I campi di una vasca, con gli stessi nomi che la configurazione usa da sempre. */
export const POOL_FIELDS = Object.freeze([
  "name",
  "tempEnt",
  "pumpEnt",
  "heatEnt",
  "lightEnt",
  "phEnt",
  "clEnt",
  "phMin",
  "phMax",
  "clMin",
  "clMax",
  "autoHours",
  "filterHours",
  "filterStart",
  "enabled",
]);

/* Gli stessi valori di partenza del runtime: cambiarli qui vorrebbe dire due
 * idee diverse di cosa sia una piscina appena configurata. */
export const POOL_DEFAULTS = Object.freeze({
  phMin: 7.0,
  phMax: 7.6,
  filterStart: "09:00",
  filterHours: 8,
  autoHours: true,
});

/** Le entita' che rendono una vasca degna di essere disegnata. */
export function poolIsConfigured(pool = {}) {
  return Boolean(
    clean(pool.tempEnt) ||
    clean(pool.pumpEnt) ||
    clean(pool.phEnt) ||
    clean(pool.clEnt) ||
    clean(pool.heatEnt) ||
    clean(pool.lightEnt),
  );
}

function normalizzata(source = {}, index = 0) {
  const pool = { id: clean(source.id) || (index === 0 ? "piscina" : `piscina-${index + 1}`) };
  for (const field of POOL_FIELDS) {
    if (source[field] !== undefined && source[field] !== null) pool[field] = source[field];
    else if (POOL_DEFAULTS[field] !== undefined) pool[field] = POOL_DEFAULTS[field];
  }
  pool.name = clean(source.name);
  return pool;
}

/**
 * Tutte le vasche, la prima per prima.
 *
 * La prima sta in cima all'oggetto salvato — dove il runtime la cerca — e le
 * altre nell'elenco `pools` accanto.
 */
export function poolList(stored = {}) {
  /* Una configurazione scritta gia' come elenco (un'esportazione, un ripristino
   * da un'altra plancia) non deve perdere la prima vasca: qui si riconosce e si
   * riporta nella forma buona. */
  if (Array.isArray(stored)) return stored.map((item, index) => normalizzata(item, index));
  const source = stored && typeof stored === "object" ? stored : {};
  const extra = Array.isArray(source.pools) ? source.pools : [];
  return [normalizzata(source, 0), ...extra.map((item, index) => normalizzata(item, index + 1))];
}

/** Le vasche che vale la pena mostrare, con l'indice che avevano nell'elenco. */
export function configuredPools(stored = {}) {
  return poolList(stored)
    .map((pool, index) => ({ ...pool, index }))
    .filter((pool) => poolIsConfigured(pool));
}

/**
 * L'oggetto da salvare, nella forma che il runtime sa gia' leggere.
 *
 * Quello che non appartiene alle vasche — per esempio una chiave aggiunta da
 * una versione futura — resta dov'e': riscrivere l'oggetto da zero vorrebbe
 * dire buttare via cio' che non si conosce.
 */
export function storedPools(list = [], previous = {}) {
  const pools = (Array.isArray(list) ? list : []).map((item, index) => normalizzata(item, index));
  const base = previous && typeof previous === "object" && !Array.isArray(previous) ? previous : {};
  const result = { ...base };
  delete result.pools;
  for (const field of POOL_FIELDS) delete result[field];
  const [prima, ...altre] = pools;
  if (prima) {
    result.id = prima.id;
    for (const field of POOL_FIELDS) if (prima[field] !== undefined) result[field] = prima[field];
  }
  if (altre.length) result.pools = altre;
  return result;
}

/**
 * Dove si contano i secondi di filtrazione di una vasca.
 *
 * La prima continua a usare la chiave di sempre, cosi' lo storico di chi ha
 * gia' una piscina non riparte da zero.
 */
export function poolRunKey(pool = {}, index = 0) {
  return index === 0 ? "cd_pool_run" : `cd_pool_run_${clean(pool.id) || index}`;
}

/**
 * Le ore di filtrazione che la vasca deve fare oggi.
 *
 * In automatico sono la meta' della temperatura dell'acqua, mai meno di due e
 * mai piu' di dodici, arrotondate alla mezz'ora: e' la stessa regola del
 * runtime, scritta una volta sola perche' due regole diverse darebbero due
 * numeri diversi sulla stessa vasca.
 */
export function poolTargetHours(pool = {}, temperature = null) {
  if (pool.autoHours) {
    const temp = numero(temperature);
    if (temp !== null) return Math.round(Math.min(12, Math.max(2, temp / 2)) * 2) / 2;
  }
  const hours = numero(pool.filterHours);
  return hours === null || hours <= 0 ? 8 : hours;
}

/** Il conteggio di oggi, azzerato quando cambia il giorno. */
export function poolRunToday(stored = {}, today = "") {
  const value = stored && typeof stored === "object" ? stored : {};
  return value.d === today ? { d: today, s: Number(value.s) || 0 } : { d: today, s: 0 };
}
