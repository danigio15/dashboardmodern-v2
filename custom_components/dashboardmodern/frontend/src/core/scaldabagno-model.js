/* Lo scaldabagno elettrico, che non e' un pannello solare (#253).
 *
 * «Ho un impianto fotovoltaico ed ho sfruttato uno scaldabagno per l'acqua
 * calda sanitaria. La card attuale e' fantastica ma pensata per il solare
 * termico. Le entita' potrebbero essere switch di accensione, temperatura
 * attuale dell'acqua, target (preso dall'entita' del termostato) e consumo?»
 *
 * Sono quattro caselle, e sono quelle. La differenza col solare non e' la
 * forma della card: e' che li' il calore arriva dal sole e si guarda il salto
 * fra le sonde, qui arriva da una resistenza che si paga e si guarda quanto
 * manca all'acqua calda. Percio' la misura che conta non e' una temperatura
 * qualunque: e' la distanza dall'obiettivo.
 *
 * Chi ha un `water_heater.*` di Home Assistant non compila niente: stato,
 * temperatura e obiettivo li dichiara l'entita' stessa, e la casella
 * dell'interruttore diventa il suo acceso/spento. Le altre restano per chi lo
 * scaldabagno se l'e' messo insieme da un rele' e due sonde, che e' esattamente
 * il caso di chi ha scritto.
 *
 * Qui non c'e' DOM e non si chiama nessun servizio: solo la lettura e il conto.
 */

/** La chiave in cui vive l'elenco. */
export const SCALDABAGNI_KEY = "cd_scaldabagni";

/* Da dove parte la corsa della barra quando nessuno dichiara un minimo.
 *
 * La barra dice quanto manca all'acqua calda, e per dirlo le serve sapere da
 * dove si e' partiti: senza un fondo, cinquanta gradi su sessanta sarebbero
 * l'83% anche appena aperta la rete. Quindici gradi e' l'acqua di rete di una
 * casa italiana — non e' un numero esatto per nessuno, ma e' onesto per tutti,
 * e chi ha un termostato che dichiara il suo minimo usa quello. */
export const BASE_ACQUA = 15;

/* Quanto vicino all'obiettivo si smette di dire «sta scaldando».
 *
 * Mezzo grado: sotto quella soglia la resistenza sta gia' spegnendosi da sola
 * e la card direbbe «scalda» su un'acqua che e' calda. */
const TOLLERANZA = 0.5;

const clean = (value) => String(value ?? "").trim();

const numero = (valore) => {
  if (valore === null || valore === undefined || valore === "") return null;
  const dato = Number(valore);
  return Number.isFinite(dato) ? dato : null;
};

export const WATER_HEATER_RE = /^water_heater\.[a-z0-9_]+$/i;

export function isWaterHeaterEntity(value) {
  return WATER_HEATER_RE.test(clean(value));
}

const ACCESI = /^(on|true|1|heat|heating|eco|performance|high_demand|electric|gas|heat_pump)$/i;
const SPENTI = /^(off|false|0|standby|idle|none)$/i;

/** Acceso, spento, o non lo sappiamo. */
export function accesoDalloStato(state) {
  const valore = clean(state);
  if (ACCESI.test(valore)) return true;
  if (SPENTI.test(valore)) return false;
  return null;
}

/* Una riga dell'elenco, ripulita da quello che c'e' in memoria.
 *
 * L'editor lavora sulle righe grezze e una riga appena aggiunta e' vuota:
 * qui si scartano solo quelle che non hanno proprio niente da leggere, o la
 * card mostrerebbe una scheda senza numeri. */
export function normalizeScaldabagni(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map((item, index) => ({
      id: clean(item?.id) || `scaldabagno-${index + 1}`,
      name: clean(item?.name),
      room: clean(item?.room || item?.room_id),
      /* L'entita' intera di Home Assistant, quando c'e': si porta dietro
       * stato, temperatura e obiettivo tutti insieme. */
      entity: clean(item?.entity || item?.entity_id),
      interruttore: clean(item?.interruttore || item?.switch),
      temperatura: clean(item?.temperatura || item?.temperature),
      obiettivo: clean(item?.obiettivo || item?.target),
      potenza: clean(item?.potenza || item?.power),
      energia: clean(item?.energia || item?.energy),
    }))
    .filter(
      (item) =>
        item.entity ||
        item.interruttore ||
        item.temperatura ||
        item.obiettivo ||
        item.potenza ||
        item.energia,
    );
}

/** Le entita' che una riga tiene d'occhio: serve all'interruttore «nel widget». */
export function entitaDiUnoScaldabagno(row) {
  return [
    row?.entity,
    row?.interruttore,
    row?.temperatura,
    row?.obiettivo,
    row?.potenza,
    row?.energia,
  ]
    .map(clean)
    .filter(Boolean);
}

/* Quanto manca all'acqua calda, da 0 a 1.
 *
 * `null` quando non si sa: senza obiettivo non c'e' una corsa da misurare, e
 * disegnare una barra piena a caso sarebbe peggio che non disegnarla. */
export function quotaVersoObiettivo(temperatura, obiettivo, base = BASE_ACQUA) {
  const ora = numero(temperatura);
  const meta = numero(obiettivo);
  if (ora === null || meta === null) return null;
  const fondo = numero(base) ?? BASE_ACQUA;
  const corsa = meta - fondo;
  /* Un obiettivo sotto il fondo non e' una corsa: e' un fondo sbagliato, e
   * l'unica risposta onesta e' «o ci sei o non ci sei». */
  if (corsa <= 0) return ora >= meta ? 1 : 0;
  return Math.min(1, Math.max(0, (ora - fondo) / corsa));
}

/** Cosa sta facendo: spento, scalda, pronto, o non lo sappiamo. */
export function statoScaldabagno({ acceso, temperatura, obiettivo } = {}) {
  if (acceso === false) return "spento";
  const ora = numero(temperatura);
  const meta = numero(obiettivo);
  if (acceso === null && ora === null) return "ignoto";
  if (ora === null || meta === null) return acceso === true ? "scalda" : "ignoto";
  return ora >= meta - TOLLERANZA ? "pronto" : "scalda";
}

/**
 * La lettura di una riga: cosa dicono adesso le sue caselle.
 *
 * `states` e' la mappa degli stati, `resolve` la traduzione delle caselle
 * mappate a mano (`dm.qualcosa`) verso l'entita' vera.
 */
export function letturaScaldabagno(row = {}, states = {}, resolve = (value) => value) {
  const leggi = (riferimento) => {
    const chiave = clean(riferimento);
    if (!chiave) return null;
    let entity = chiave;
    try {
      entity = clean(resolve(chiave)) || chiave;
    } catch (_error) {
      entity = chiave;
    }
    return states?.[entity] || states?.[chiave] || null;
  };

  const principale = leggi(row.entity);
  const attributi = principale?.attributes || {};
  /* L'entita' di Home Assistant risponde per prima, e le caselle sciolte
   * riempiono solo cio' che lei non dice: chi le ha mappate entrambe ha
   * evidentemente una ragione, ma il dato dell'entita' e' quello che il
   * dispositivo dichiara di se'. */
  const temperatura =
    numero(attributi.current_temperature) ?? numero(leggi(row.temperatura)?.state);
  const obiettivoAttributo = numero(attributi.temperature);
  const obiettivo =
    obiettivoAttributo ??
    numero(leggi(row.obiettivo)?.state) ??
    /* L'obiettivo puo' stare su un termostato — «target preso dall'entita' del
     * termostato» — e li' e' un attributo, non lo stato. */
    numero(leggi(row.obiettivo)?.attributes?.temperature);

  const interruttore = leggi(row.interruttore);
  const acceso =
    accesoDalloStato(interruttore?.state) ??
    (principale ? accesoDalloStato(principale.state) : null);

  const potenza = numero(leggi(row.potenza)?.state);
  const energia = numero(leggi(row.energia)?.state);
  /* Il fondo della barra: quello che l'entita' dichiara, se lo dichiara. */
  const base = numero(attributi.min_temp) ?? BASE_ACQUA;

  return {
    id: row.id,
    name: clean(row.name) || clean(attributi.friendly_name) || clean(row.entity),
    room: clean(row.room),
    entity: clean(row.entity),
    interruttore: clean(row.interruttore),
    /* Cosa si puo' comandare: l'interruttore se c'e', altrimenti l'entita'
     * intera quando e' un water_heater, che si accende e si spegne da se'. */
    comandabile: clean(row.interruttore) || (isWaterHeaterEntity(row.entity) ? row.entity : ""),
    acceso,
    temperatura,
    obiettivo,
    potenza,
    energia,
    quota: quotaVersoObiettivo(temperatura, obiettivo, base),
    stato: statoScaldabagno({ acceso, temperatura, obiettivo }),
  };
}

/** Le letture di tutte le righe configurate. */
export function lettureScaldabagni(values, states = {}, resolve = (value) => value) {
  return normalizeScaldabagni(values).map((row) => letturaScaldabagno(row, states, resolve));
}

/* Le entita' `water_heater.*` che Home Assistant ha gia' e l'elenco ancora no:
 * «Rileva da Home Assistant» le propone invece di farle scrivere a mano. */
export function suggerisciScaldabagni(states = {}, esistenti = []) {
  const noti = new Set(
    normalizeScaldabagni(esistenti)
      .map((item) => item.entity.toLowerCase())
      .filter(Boolean),
  );
  return Object.entries(states)
    .filter(([entity]) => isWaterHeaterEntity(entity) && !noti.has(entity.toLowerCase()))
    .map(([entity, state]) => ({
      entity,
      name: clean(state?.attributes?.friendly_name) || entity.split(".")[1].replaceAll("_", " "),
    }));
}
