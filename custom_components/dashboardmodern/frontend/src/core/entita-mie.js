/* Le entità che uno si aggiunge dove vuole (#271).
 *
 * «In alcune schede non è possibile inserire entità o sensori personalizzati.
 * Sarebbe carino avere la possibilità d'aggiungere le entità o sensori
 * personalizzati in ogni scheda del progetto, modificando il nome, icona,
 * stanza di destinazione.»
 *
 * Alcune sezioni sono elenchi — Luci, Prese, Telecamere, Robot — e lì aggiungere
 * un'entità si è sempre potuto: l'elenco è la sezione. Altre sono fatte di
 * caselle con un ruolo preciso — l'Energia ha una rete e un fotovoltaico, la
 * Sicurezza una centrale, il MiniPC una CPU — e lì non c'era posto per un
 * sensore in più: quello che non ha un ruolo non si poteva scrivere da nessuna
 * parte, e restava fuori dalla plancia anche se in casa c'era.
 *
 * Qui c'è quel posto. Una voce dice quattro cose: quale entità, in quale
 * sezione farla comparire, come chiamarla e con che icona — più la stanza,
 * facoltativa, che serve a farla comparire anche nella sua stanza.
 *
 * Il modulo è puro: entrano le voci scritte e gli stati di Home Assistant,
 * escono le righe da disegnare. Chi disegna non decide niente.
 */

const pulito = (valore) => String(valore ?? "").trim();

export const CHIAVE_ENTITA_MIE = "cd_entita_mie";

/* Un tetto, come per le sezioni proprie: dodici entità in più su una pagina
 * sono già un elenco, e oltre non è più «qualcosa in più», è un'altra
 * sezione — che infatti si può fare, ed è #262. */
export const MASSIMO_PER_SEZIONE = 12;

/* Le entità che si comandano col tocco, e quelle che si guardano e basta.
 * È lo stesso elenco delle sezioni proprie, e per la stessa ragione: un
 * interruttore sotto un sensore di temperatura è un tasto che non fa niente. */
const COMANDABILI = new Set([
  "switch",
  "light",
  "fan",
  "input_boolean",
  "scene",
  "script",
  "automation",
]);

/** Una voce, ripulita. Senza entità non è una voce. */
export function normalizzaVoce(stored, indice = 0) {
  const dato = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  const entity = pulito(dato.entity);
  return {
    id: pulito(dato.id) || `mia-${indice + 1}`,
    entity,
    nome: pulito(dato.nome || dato.name),
    icona: pulito(dato.icona || dato.icon),
    sezione: pulito(dato.sezione || dato.tab),
    room_id: pulito(dato.room_id || dato.room),
  };
}

/** Tutte le voci scritte, ripulite e senza quelle a metà. */
export function entitaMie(stored) {
  const righe = Array.isArray(stored) ? stored : [];
  return righe.map((riga, indice) => normalizzaVoce(riga, indice)).filter((riga) => riga.entity);
}

/** Le voci di una sezione, nell'ordine in cui sono scritte e col tetto. */
export function entitaDellaSezione(stored, sezione) {
  const quale = pulito(sezione);
  if (!quale) return [];
  return entitaMie(stored)
    .filter((riga) => riga.sezione === quale)
    .slice(0, MASSIMO_PER_SEZIONE);
}

/** Le sezioni che hanno almeno una voce. */
export function sezioniConEntita(stored) {
  return [
    ...new Set(
      entitaMie(stored)
        .map((riga) => riga.sezione)
        .filter(Boolean),
    ),
  ];
}

/** Tutte le entità nominate, per chi si iscrive agli aggiornamenti. */
export function entitaDaGuardare(stored) {
  return [...new Set(entitaMie(stored).map((riga) => riga.entity))];
}

const numero = (valore) => {
  if (valore === null || valore === undefined || pulito(valore) === "") return null;
  const n = Number(valore);
  return Number.isFinite(n) ? n : null;
};

/**
 * Cosa dice una voce adesso.
 *
 * `muto` vuol dire che Home Assistant non la conosce o non risponde: è una
 * cosa diversa da «spento», e dirla spenta sarebbe inventare una lettura.
 */
export function letturaDellaVoce(voce, states = {}, resolve = (valore) => valore) {
  const entity = pulito(voce?.entity);
  let risolta = entity;
  try {
    risolta = pulito(resolve(entity)) || entity;
  } catch (_error) {
    risolta = entity;
  }
  const stato = states?.[risolta] || states?.[entity] || null;
  const grezzo = pulito(stato?.state);
  const muto = !stato || grezzo === "" || grezzo === "unavailable" || grezzo === "unknown";
  const dominio = entity.split(".")[0];
  return {
    id: voce?.id || entity,
    entity,
    nome: pulito(voce?.nome) || pulito(stato?.attributes?.friendly_name) || entity,
    icona: pulito(voce?.icona),
    room_id: pulito(voce?.room_id),
    muto,
    stato: grezzo,
    numero: muto ? null : numero(grezzo),
    unita: pulito(stato?.attributes?.unit_of_measurement),
    acceso:
      !muto &&
      ["on", "open", "home", "playing", "heat", "cool", "unlocked"].includes(grezzo.toLowerCase()),
    comandabile: COMANDABILI.has(dominio),
  };
}

/** Le letture di una sezione, pronte da disegnare. */
export function lettureDellaSezione(stored, sezione, states = {}, resolve) {
  return entitaDellaSezione(stored, sezione).map((voce) => letturaDellaVoce(voce, states, resolve));
}
