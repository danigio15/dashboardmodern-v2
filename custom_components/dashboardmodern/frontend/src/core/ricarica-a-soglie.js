/* Il tablet a muro, e le due soglie con cui si ricarica (#408).
 *
 * «Sarebbe carina una scheda che mostri la percentuale del nostro tablet che
 * usiamo a muro, e magari che schiacciando mostri le impostazioni per attivare
 * la ricarica, tipo soglia bassa 20% soglia alta 80%.»
 *
 * La percentuale c'era gia': un tablet a muro pubblica un sensore di batteria,
 * e la pagina Batterie lo trova da se' senza configurare niente. Quello che
 * mancava e' l'altra meta' — le due soglie — che una batteria normale non ha:
 * una stilo non decide quando smettere di caricarsi, un tablet appeso al muro
 * si'. Sono due entita' a parte, `number.*` o `input_number.*`, e si dicono una
 * volta: quale batteria, quale soglia bassa, quale alta.
 *
 * Il modulo e' puro: entra quello che c'e' salvato e uno stato di Home
 * Assistant, esce come si legge e cosa si chiama per cambiarlo. Non tocca ne'
 * il documento ne' la memoria.
 */

const pulito = (valore) => String(valore ?? "").trim();

/** Dove stanno le soglie: una riga per batteria che ne ha. */
export const CHIAVE_RICARICA = "cd_batterie_ricarica";

/* Chi sa dire un numero e farselo cambiare. Un `sensor.*` no: dice e basta, e
 * offrire un cursore che non muove niente e' peggio che non offrirlo. */
export const DOMINI_SOGLIA = Object.freeze(["number", "input_number"]);

/** Se questa entita' puo' fare da soglia. */
export function eSogliaDiRicarica(valore) {
  const testo = pulito(valore).toLowerCase();
  const dominio = testo.split(".")[0];
  return /^[a-z0-9_]+\.[a-z0-9_]+$/.test(testo) && DOMINI_SOGLIA.includes(dominio);
}

/** Se questa entita' puo' essere la batteria di una riga. */
export function eBatteriaDiRicarica(valore) {
  return /^(sensor|number|input_number)\.[a-z0-9_]+$/.test(pulito(valore).toLowerCase());
}

function normalizzata(voce, indice) {
  const battery = pulito(voce?.battery || voce?.batteria || voce?.entity);
  return {
    id: pulito(voce?.id) || `ricarica-${indice + 1}`,
    battery,
    /* Le due soglie sono facoltative una per una: c'e' chi ha solo il limite
     * alto — quello che serve davvero a non tenere una batteria al cento per
     * cento tutto il giorno — e nessun limite basso. */
    bassa: pulito(voce?.bassa || voce?.low),
    alta: pulito(voce?.alta || voce?.high),
  };
}

/**
 * Le righe salvate, ripulite: senza batteria non e' una riga, e senza nemmeno
 * una soglia non c'e' niente da mostrare — sarebbe una batteria come le altre.
 */
export function normalizzaRicariche(grezzo) {
  const voci = Array.isArray(grezzo) ? grezzo.filter(Boolean) : [];
  return voci
    .map((voce, indice) => normalizzata(voce, indice))
    .filter((riga) => eBatteriaDiRicarica(riga.battery))
    .filter((riga) => eSogliaDiRicarica(riga.bassa) || eSogliaDiRicarica(riga.alta));
}

/** La riga di questa batteria, se ne ha una. */
export function ricaricaDellaBatteria(entity, righe = []) {
  const chiave = pulito(entity).toLowerCase();
  if (!chiave) return null;
  return (
    (Array.isArray(righe) ? righe : []).find(
      (riga) => pulito(riga?.battery).toLowerCase() === chiave,
    ) || null
  );
}

const numero = (valore) => {
  const n = Number(valore);
  return Number.isFinite(n) ? n : null;
};

/**
 * Come si legge una soglia, e fin dove la si puo' muovere.
 *
 * I limiti li dichiara Home Assistant — `min`, `max`, `step` — e si prendono da
 * li': inventarli qui vorrebbe dire offrire un cursore che chiede un valore che
 * l'entita' rifiuta. Senza dichiarazione si sta su zero-cento a passo di uno,
 * che e' quello che una soglia di carica e' quasi sempre.
 *
 * Una soglia che non risponde torna `null`: non e' una soglia a zero.
 */
export function letturaDellaSoglia(entity, stato) {
  if (!eSogliaDiRicarica(entity)) return null;
  const valore = numero(stato?.state);
  if (valore === null) return null;
  const attributi = stato?.attributes || {};
  const min = numero(attributi.min) ?? 0;
  const dichiarato = numero(attributi.max);
  const passo = numero(attributi.step);
  return Object.freeze({
    entity: pulito(entity),
    valore,
    min,
    max: dichiarato !== null && dichiarato > min ? dichiarato : Math.max(min + 1, 100),
    passo: passo !== null && passo > 0 ? passo : 1,
    unita: pulito(attributi.unit_of_measurement) || "%",
  });
}

/**
 * La chiamata che sposta una soglia. Il servizio lo decide il dominio: sono due
 * entita' diverse con due servizi diversi, e chiamare quello sbagliato non da'
 * errore — non fa niente, che da fuori e' un cursore rotto.
 */
export function comandoDellaSoglia(entity, valore) {
  if (!eSogliaDiRicarica(entity)) return null;
  const n = numero(valore);
  if (n === null) return null;
  const domain = pulito(entity).toLowerCase().split(".")[0];
  return { domain, service: "set_value", data: { entity_id: pulito(entity), value: n } };
}

/**
 * Le due soglie di una riga, lette: quella che manca o non risponde non esce.
 *
 * Escono in quest'ordine perche' e' l'ordine in cui si leggono: prima da dove
 * riparte, poi dove si ferma.
 */
export function sogliePronte(riga, states = {}) {
  if (!riga) return [];
  return [
    ["bassa", riga.bassa],
    ["alta", riga.alta],
  ]
    .map(([quale, entity]) => {
      const lettura = letturaDellaSoglia(entity, states?.[pulito(entity)]);
      return lettura ? { quale, ...lettura } : null;
    })
    .filter(Boolean);
}
