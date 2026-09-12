/* Quando una cosa di casa è «accesa».
 *
 * Sembra una domanda da una riga — `state === "on"` — e lo è soltanto per gli
 * interruttori. Una cassa accesa dice `playing`, un condizionatore acceso dice
 * `heat` o `cool`, un robot al lavoro dice `cleaning`, una persona in casa dice
 * `home`, una serratura aperta dice `unlocked`. Chi conta «quante cose sono
 * accese» confrontando con la parola `on` conta gli interruttori e basta, e
 * scrive zero sopra una stanza con la musica accesa e il termosifone che va.
 *
 * Le parole stanno qui, in un posto solo, perché la stessa domanda la fanno
 * posti diversi — le sezioni che uno si fa, le stanze in plancia — e due
 * elenchi della stessa cosa diventano due elenchi diversi al primo dominio
 * nuovo. Sono quelle che Home Assistant pubblica davvero, non inventate.
 */

const pulito = (valore) =>
  String(valore ?? "")
    .trim()
    .toLowerCase();

/* Gli stati che valgono «sta facendo qualcosa».
 *
 * `idle` non c'è: un lettore fermo è acceso per Home Assistant, ma per chi
 * guarda una stanza non è una cosa «in funzione» — contarlo vorrebbe dire che
 * una casa con le casse accese e mute risulta piena di roba accesa. */
export const STATI_ACCESI = Object.freeze(
  new Set([
    "on",
    "open",
    "unlocked",
    "playing",
    "buffering",
    "home",
    "heat",
    "cool",
    "heat_cool",
    "auto",
    "dry",
    "fan_only",
    "cleaning",
    "returning",
    "active",
    "running",
  ]),
);

/** Se questo stato vuol dire che quella cosa sta facendo qualcosa. */
export function eAcceso(stato) {
  return STATI_ACCESI.has(pulito(stato?.state ?? stato));
}
