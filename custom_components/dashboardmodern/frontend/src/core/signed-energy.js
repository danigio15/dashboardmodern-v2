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

/* Due sensori di potenza, uno per verso — issue #184.
 *
 * La casella della potenza e' una per gruppo, perche' il modello ne tiene un
 * numero solo, col segno a dire il verso. Molti impianti pero' pubblicano due
 * sensori separati, sempre positivi: prelievo e immissione, carica e scarica.
 * Chi li aveva non sapeva dove mettere il secondo — nel riquadro del verso
 * opposto c'era soltanto il rimando «e' una sola, si imposta in...», che
 * sembrava la spunta della sorgente unica ancora accesa.
 *
 * Qui si dichiara il secondo sensore, e il numero col segno si ricava:
 * prelievo meno immissione per la rete, scarica meno carica per la batteria —
 * i versi che il runtime considera positivi. La casella di sempre prende il
 * verso del riquadro in cui sta: prelievo per la rete, carica per la
 * batteria. La sorgente unica con segno, quando e' dichiarata, vince: sono
 * due modi di dire la stessa cosa, e non possono valere insieme. */
export const POWER_PAIRS = Object.freeze({
  // La casella di sempre e' il prelievo (il verso positivo del runtime):
  // il derivato e' power - power_export.
  grid: Object.freeze({ opposite: "power_export", oppositeIsRuntimePositive: false }),
  // La casella di sempre sta nel riquadro «carica», il runtime vuole positiva
  // la scarica: il derivato e' power_discharge - power.
  battery: Object.freeze({ opposite: "power_discharge", oppositeIsRuntimePositive: true }),
});

/** La coppia di potenze di un gruppo, se il secondo sensore e' dichiarato. */
export function powerPairSource(energy = {}, group = "") {
  const pair = POWER_PAIRS[group];
  if (!pair) return null;
  /* La sorgente unica con segno vince solo se la potenza ce l'ha davvero.
   *
   * Una dichiarazione puo' esistere col solo verso scelto, o con i soli campi
   * dei periodi: in quei momenti la sorgente con segno non produce nessuna
   * potenza, e spegnere la coppia avrebbe lasciato passare il sensore del
   * prelievo cosi' com'era — 1200 W al posto di 900. La coppia si fa da parte
   * quando l'entita' di potenza con segno e' scritta, non prima. */
  if (signedSource(energy, group)?.entities?.power) return null;
  const opposite = clean(energy?.[group]?.[pair.opposite]);
  if (!opposite) return null;
  return {
    group,
    main: clean(energy?.[group]?.power),
    opposite,
    oppositeIsRuntimePositive: pair.oppositeIsRuntimePositive,
  };
}

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
  /* Il verso da solo basta a dire che la dichiarazione c'e'.
   *
   * Prima serviva almeno un'entita', e chi apriva la scheda e sceglieva il
   * verso prima di scrivere il sensore — che e' l'ordine in cui la scheda
   * stessa li mette — non aveva ancora dichiarato niente: la scheda si
   * richiudeva e il verso tornava a quello di partenza. Con la batteria si
   * vedeva, perche' «in carica» non e' il verso di partenza; con la rete e
   * «prelievo» la scheda si richiudeva lo stesso, ma sembrava solo un
   * lampeggio. Una sorgente senza entita' non ricava niente — tutti i giri qui
   * sotto chiedono l'entita' prima di fare qualcosa — ma resta dichiarata, e
   * la scheda resta aperta con dentro quello che hai scelto. */
  const dichiarato = definition.directions.includes(clean(declared.positive));
  if (!Object.keys(entities).length && !dichiarato) return null;
  const positive = dichiarato ? clean(declared.positive) : definition.positiveDefault;
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
  for (const group of Object.keys(POWER_PAIRS)) {
    if (!powerPairSource(energy, group)) continue;
    own(group)[SIGNED_GROUPS[group].powerField] = derivedEntityId(
      group,
      SIGNED_GROUPS[group].powerField,
    );
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

/* Una lettura di potenza portata in watt.
 *
 * I due sensori di una coppia possono dichiarare unita' diverse — 1200 W di
 * prelievo e 0.3 kW di immissione — e sottrarre i numeri grezzi avrebbe
 * prodotto 1199.7 spacciati per kW. Un'unita' che non si riconosce non si
 * indovina: la lettura diventa muta, non un numero sbagliato. */
/* Il prefisso SI distingue per maiuscola: mW e MW stanno a nove ordini di
 * grandezza, e schiacciarli col lowercase li avrebbe confusi. */
const POWER_UNIT_FACTORS = Object.freeze({
  W: 1,
  w: 1,
  kW: 1000,
  KW: 1000,
  kw: 1000,
  MW: 1000000,
  mW: 0.001,
});

/* I watt di un'entita' di potenza, qualunque unita' dichiari.
 *
 * Un contatore che pubblica in kW e' normale quanto uno che pubblica in W, e
 * chi legge il numero e basta si sbaglia di mille: 0,27 kW letti come watt
 * diventano «0 W», cioe' una casa spenta mentre sta consumando duecentosettanta
 * watt. La domanda «quanti watt sono» aveva quattro risposte sparse per la
 * plancia — una completa, due a meta' e una che non se la poneva. Questa e'
 * quella completa, e adesso e' anche l'unica.
 *
 * Senza unita' dichiarata si assumono i watt, come ha sempre fatto il runtime:
 * cambiare quella regola qui vorrebbe dire cambiare cosa mostrano le case che
 * funzionano gia'. */
export function wattsFromState(snapshot) {
  if (!snapshot) return null;
  const valore = Number.parseFloat(String(snapshot.state ?? "").replace(",", "."));
  if (!Number.isFinite(valore)) return null;
  const unit = clean(snapshot.attributes?.unit_of_measurement);
  if (!unit) return valore;
  const factor = POWER_UNIT_FACTORS[unit] ?? POWER_UNIT_FACTORS[unit.toLowerCase()];
  return factor === undefined ? valore : valore * factor;
}

function watts(reading) {
  if (!reading || reading.value === null || reading.value === undefined) return null;
  const unit = clean(reading.source?.attributes?.unit_of_measurement);
  if (!unit) return reading.value; // senza unita' si assume il watt, come fa il runtime
  const factor = POWER_UNIT_FACTORS[unit];
  return factor === undefined ? null : reading.value * factor;
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
  for (const group of Object.keys(POWER_PAIRS)) {
    const pair = powerPairSource(energy, group);
    if (!pair) continue;
    const oppositeReading = readingFrom(states, pair.opposite);
    /* Senza la casella principale il verso mancante vale zero: chi dichiara la
     * sola immissione ha un impianto che non preleva mai da quel sensore. */
    const mainReading = pair.main ? readingFrom(states, pair.main) : null;
    const mainValue = pair.main ? watts(mainReading) : 0;
    const oppositeValue = watts(oppositeReading);
    const id = derivedEntityId(group, SIGNED_GROUPS[group].powerField);
    const value =
      mainValue === null || oppositeValue === null
        ? null
        : pair.oppositeIsRuntimePositive
          ? oppositeValue - mainValue
          : mainValue - oppositeValue;
    /* L'unita' si dichiara, non si eredita: i due sensori possono usarne due
     * diverse, e il numero qui sopra e' gia' stato portato in watt. */
    result[id] = derivedState(id, oppositeReading?.source || mainReading?.source, value, "W");
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
  for (const group of Object.keys(POWER_PAIRS)) {
    const pair = powerPairSource(energy, group);
    if (!pair) continue;
    if (pair.main) ids.add(pair.main);
    ids.add(pair.opposite);
  }
  return [...ids];
}
