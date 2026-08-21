/* Una sola entita' con il segno, per rete e batteria.
 *
 * Molti inverter non pubblicano due sensori — prelievo e immissione, carica e
 * scarica — ma uno solo che diventa negativo quando il verso si inverte. La
 * maschera di configurazione, che chiede i due versi in due pagine distinte,
 * non lasciava modo di dirlo: si finiva per mettere la stessa entita' nelle due
 * caselle, e la mappa sommava il prelievo all'immissione.
 *
 * Qui l'entita' si dichiara una volta sola, insieme a cosa vogliono dire i
 * valori positivi. Da quella coppia si ricavano due letture — la parte positiva
 * e la parte negativa — che prendono il posto delle due entita' separate senza
 * che nulla, a valle, debba sapere da dove arrivano.
 *
 * Il modulo e' puro: non legge lo stato globale, non tocca il DOM e non scrive
 * nulla. Chi lo usa gli passa il modello Energia e la mappa degli stati.
 */

/** Dominio riservato alle letture ricavate: non esiste in Home Assistant. */
export const DERIVED_DOMAIN = "dm_derived";

const clean = (value) => String(value ?? "").trim();

/* Il verso che il runtime considera positivo.
 *
 * La mappa dei flussi legge un solo numero per la rete e uno per la batteria:
 * `pwrGri > 0` disegna la linea rete → casa, `pwrBat > 0` quella batteria →
 * casa. Sono queste due convenzioni, non una scelta nuova, a dire quale verso
 * va lasciato positivo e quale va ribaltato. */
export const SIGNED_GROUPS = Object.freeze({
  grid: Object.freeze({
    positiveDefault: "import",
    directions: Object.freeze(["import", "export"]),
    /* La direzione che il runtime si aspetta col segno positivo. */
    runtimePositive: "import",
    powerField: "power",
    periods: Object.freeze([
      Object.freeze({
        key: "daily",
        positive: "daily_import_energy",
        negative: "daily_export_energy",
      }),
      Object.freeze({
        key: "monthly",
        positive: "monthly_import_energy",
        negative: "monthly_export_energy",
      }),
      Object.freeze({
        key: "annual",
        positive: "annual_import_energy",
        negative: "annual_export_energy",
      }),
    ]),
  }),
  battery: Object.freeze({
    positiveDefault: "discharge",
    directions: Object.freeze(["discharge", "charge"]),
    runtimePositive: "discharge",
    powerField: "power",
    periods: Object.freeze([
      Object.freeze({
        key: "daily",
        positive: "daily_discharged_energy",
        negative: "daily_charged_energy",
      }),
      Object.freeze({
        key: "monthly",
        positive: "monthly_discharged_energy",
        negative: "monthly_charged_energy",
      }),
      Object.freeze({
        key: "annual",
        positive: "annual_discharged_energy",
        negative: "annual_charged_energy",
      }),
    ]),
  }),
});

/** Le misure che accettano una sorgente unica: la potenza e i tre periodi. */
export const SIGNED_MEASURES = Object.freeze(["power", "daily", "monthly", "annual"]);

/** Id della lettura ricavata per un campo del modello. */
export const derivedEntityId = (group, field) => `${DERIVED_DOMAIN}.${group}_${field}`;

/** Vero quando l'id e' una lettura ricavata e non un'entita' di Home Assistant. */
export const isDerivedEntity = (entity) => clean(entity).startsWith(`${DERIVED_DOMAIN}.`);

/**
 * La dichiarazione di sorgente unica di un gruppo, normalizzata.
 * Restituisce null quando il gruppo non ne ha nessuna.
 */
export function signedSource(energy = {}, group = "") {
  const definition = SIGNED_GROUPS[group];
  if (!definition) return null;
  const declared = energy?.[group]?.signed;
  if (!declared || typeof declared !== "object") return null;
  const entities = {};
  for (const measure of SIGNED_MEASURES) {
    const entity = clean(declared[measure]);
    if (entity) entities[measure] = entity;
  }
  if (!Object.keys(entities).length) return null;
  const positive = definition.directions.includes(clean(declared.positive))
    ? clean(declared.positive)
    : definition.positiveDefault;
  return { group, entities, positive, inverted: positive !== definition.runtimePositive };
}

/**
 * Il modello Energia con le sorgenti uniche gia' risolte nei due versi.
 *
 * Il resto del programma continua a leggere `daily_import_energy` e compagnia:
 * qui quei campi vengono riempiti con le letture ricavate, cosi' proiezione,
 * mappa e conteggi non hanno un secondo modo di funzionare da mantenere.
 */
export function applySignedSources(energy = {}) {
  let result = energy;
  const own = (group) => {
    if (result === energy) result = { ...energy };
    if (result[group] === energy?.[group]) result[group] = { ...(energy?.[group] || {}) };
    else if (!result[group]) result[group] = {};
    return result[group];
  };
  for (const group of Object.keys(SIGNED_GROUPS)) {
    const source = signedSource(energy, group);
    if (!source) continue;
    const definition = SIGNED_GROUPS[group];
    if (source.entities.power) {
      /* Col verso gia' giusto l'entita' vale direttamente: nessuna lettura
       * ricavata da tenere aggiornata per un numero identico all'originale. */
      own(group)[definition.powerField] = source.inverted
        ? derivedEntityId(group, definition.powerField)
        : source.entities.power;
    }
    for (const period of definition.periods) {
      if (!source.entities[period.key]) continue;
      const target = own(group);
      target[period.positive] = derivedEntityId(group, period.positive);
      target[period.negative] = derivedEntityId(group, period.negative);
    }
  }
  return result;
}

const numeric = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/** La parte positiva e quella negativa di una lettura con segno. */
export function splitSignedReading(value) {
  const parsed = numeric(value);
  if (parsed === null) return { positive: null, negative: null };
  return { positive: Math.max(parsed, 0), negative: Math.max(-parsed, 0) };
}

function readingFrom(states, entity) {
  const source = states?.[entity];
  if (!source) return null;
  const raw = clean(source.state);
  if (!raw || raw === "unknown" || raw === "unavailable") return { source, value: null };
  return { source, value: numeric(raw) };
}

function derivedState(id, source, value, unit) {
  return {
    entity_id: id,
    state: value === null ? "unavailable" : String(value),
    last_changed: source?.last_changed,
    last_updated: source?.last_updated,
    attributes: {
      ...(source?.attributes || {}),
      friendly_name: id,
      unit_of_measurement: unit ?? source?.attributes?.unit_of_measurement,
    },
  };
}

/**
 * Le letture ricavate da pubblicare, per id.
 *
 * Sono stati completi come quelli di Home Assistant, cosi' chi le legge non
 * distingue una lettura ricavata da un sensore vero.
 */
export function derivedEnergyStates(energy = {}, states = {}) {
  const result = {};
  for (const group of Object.keys(SIGNED_GROUPS)) {
    const source = signedSource(energy, group);
    if (!source) continue;
    const definition = SIGNED_GROUPS[group];
    if (source.entities.power && source.inverted) {
      const reading = readingFrom(states, source.entities.power);
      const id = derivedEntityId(group, definition.powerField);
      result[id] = derivedState(
        id,
        reading?.source,
        reading?.value === null || reading?.value === undefined ? null : -reading.value,
      );
    }
    for (const period of definition.periods) {
      const entity = source.entities[period.key];
      if (!entity) continue;
      const reading = readingFrom(states, entity);
      const split = splitSignedReading(reading?.value);
      /* Chi tiene il verso opposto legge la stessa entita' al contrario: la
       * parte positiva del sensore e' il verso che l'utente ha dichiarato. */
      const forPositive = source.inverted ? split.negative : split.positive;
      const forNegative = source.inverted ? split.positive : split.negative;
      const positiveId = derivedEntityId(group, period.positive);
      const negativeId = derivedEntityId(group, period.negative);
      result[positiveId] = derivedState(positiveId, reading?.source, forPositive);
      result[negativeId] = derivedState(negativeId, reading?.source, forNegative);
    }
  }
  return result;
}

/** Gli id delle entita' vere da cui dipendono le letture ricavate. */
export function signedSourceEntities(energy = {}) {
  const ids = new Set();
  for (const group of Object.keys(SIGNED_GROUPS)) {
    const source = signedSource(energy, group);
    if (!source) continue;
    for (const entity of Object.values(source.entities)) ids.add(entity);
  }
  return [...ids];
}
