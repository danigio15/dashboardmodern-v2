/* Acceso o spento, quando a dirlo sono i watt (#490).
 *
 * «Il condizionatore da spento mi dà 7 W di consumo e quindi mi risulta acceso.
 * È messo sotto una presa smart. Si potrebbe indicare un valore in W, dopo il
 * quale diventa acceso? Oppure aggiungere nel setting del condizionatore
 * l'entità di consumo e un valore minimo che indichi lo stato di off. Credo che
 * ci sia su elettrodomestici.»
 *
 * C'è, e da un pezzo: un elettrodomestico ha la sua soglia in watt, perché una
 * lavatrice spenta consuma lo stesso qualcosa. Un climatizzatore comandato da
 * una presa ha esattamente lo stesso problema — il suo `climate.*` dice una
 * cosa, la presa ne dice un'altra, e quella dei due che ha ragione è la presa.
 *
 * Questo modulo decide, e basta: entrano l'unità come l'ha configurata chi la
 * possiede e gli stati di Home Assistant, esce `true`, `false`, oppure `null`.
 *
 * `null` non è un caso da niente: vuol dire «io non ho niente da dire», e
 * succede quando la soglia non è configurata, quando l'entità del consumo non
 * c'è, o quando non risponde. Allora decide come sempre lo stato dell'unità.
 * Restituire `false` in quei casi vorrebbe dire spegnere una card per un
 * sensore che non ha risposto, che è il difetto opposto e peggiore.
 *
 * Il modulo è puro: non parla con Home Assistant e non tocca il DOM.
 */

const clean = (valore) => String(valore ?? "").trim();

/* Un consumo si misura in watt. Chi pubblica i kilowatt — succede sulle prese
 * che riportano kW — non va letto come se fossero watt, o mille volte meno
 * corrente sembrerebbe mille volte meno di niente. */
const MILLE = Object.freeze({ kw: 1000, kilowatt: 1000 });

/** L'entità del consumo di questa unità, o "". */
export function entitaDelConsumo(unita) {
  return clean(unita?.consumo);
}

/**
 * La soglia in watt oltre la quale l'unità è accesa, o `null`.
 *
 * Zero è una soglia scritta: vuol dire «qualunque consumo è acceso», ed è
 * diverso dal non averla messa. Un numero negativo o una parola non lo sono.
 */
export function sogliaDelConsumo(unita) {
  const scritto = unita?.soglia_consumo;
  if (scritto === null || scritto === undefined || clean(scritto) === "") return null;
  const valore = Number(String(scritto).replace(",", "."));
  return Number.isFinite(valore) && valore >= 0 ? valore : null;
}

/** I watt che quell'entità sta leggendo adesso, o `null` se non ne legge. */
export function wattDellUnita(unita, states = {}) {
  const entity = entitaDelConsumo(unita);
  if (!entity) return null;
  const stato = states?.[entity];
  if (!stato) return null;
  const grezzo = clean(stato.state).toLowerCase();
  if (["unavailable", "unknown", "none", ""].includes(grezzo)) return null;
  const valore = Number(grezzo.replace(",", "."));
  if (!Number.isFinite(valore)) return null;
  const unitaDiMisura = clean(stato.attributes?.unit_of_measurement).toLowerCase();
  return valore * (MILLE[unitaDiMisura] || 1);
}

/**
 * Il verdetto dei watt: `true` acceso, `false` spento, `null` non lo so.
 *
 * Sopra la soglia è acceso, sotto è spento, esattamente sopra è acceso — una
 * soglia è il punto in cui si passa, e chi scrive 10 vuol dire «da dieci in su
 * sta lavorando».
 */
export function accesoPerIlConsumo(unita, states = {}) {
  const soglia = sogliaDelConsumo(unita);
  if (soglia === null) return null;
  const watt = wattDellUnita(unita, states);
  if (watt === null) return null;
  return watt >= soglia;
}
