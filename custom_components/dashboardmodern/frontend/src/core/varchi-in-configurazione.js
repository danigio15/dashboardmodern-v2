/* Aperto o chiuso, a colpo d'occhio, dentro la configurazione (#367).
 *
 * «In verde dovrebbe segnare i sensori contact chiusi e in rosso quelli
 * aperti … almeno a colpo d'occhio so quante finestre sono aperte in questo
 * momento.»
 *
 * In configurazione un contatto porta-finestra e' una riga con dentro un
 * entity_id e basta: dice come si chiama, non come sta. Per sapere quante
 * finestre sono aperte bisognava uscire, andare in Finestre, e tornare.
 *
 * Qui c'e' solo il giudizio — aperto, chiuso, o non lo so — perche' e' l'unica
 * parte che si puo' sbagliare in silenzio. Il verso lo dice `verso-aperture.js`,
 * che e' dove sta gia': ci sono contatti che stanno a ON quando l'infisso e'
 * CHIUSO, e chi li ha girati li' ha detto quali sono. Averne una seconda
 * regola qui vorrebbe dire che prima o poi le due si contraddicono, e la
 * configurazione direbbe il contrario della plancia.
 */
import { apertaSecondoVerso } from "./verso-aperture.js";

const clean = (value) => String(value ?? "").trim();

/* Le classi che Home Assistant usa per un varco: una porta, una finestra, un
 * portone, un'apertura qualunque. La stessa lista che usa il rilevamento
 * automatico, e non una copia scritta a mano: se una nasce, nasce li'. */
export const CLASSI_DEL_VARCO = Object.freeze(["door", "window", "opening", "garage_door"]);

/** Se questa entita' e' un varco che ha senso colorare. */
export function eUnVarco(entity, stato) {
  const id = clean(entity);
  if (!id.startsWith("binary_sensor.")) return false;
  return CLASSI_DEL_VARCO.includes(clean(stato?.attributes?.device_class));
}

/* Muti sono muti: un sensore che non risponde non e' una finestra chiusa. */
const MUTI = new Set(["unavailable", "unknown", "none", ""]);

/**
 * Come sta questo varco: `"aperto"`, `"chiuso"`, o `""` quando non si sa.
 *
 * `invertiti` e' l'insieme dei contatti girati — quelli che stanno a ON con
 * l'infisso chiuso. Senza, si legge il verso di Home Assistant.
 */
export function comeStaIlVarco(entity, stato, invertiti) {
  const grezzo = clean(stato?.state).toLowerCase();
  if (MUTI.has(grezzo)) return "";
  const acceso = grezzo === "on" || grezzo === "open" || grezzo === "true";
  const chiuso = grezzo === "off" || grezzo === "closed" || grezzo === "false";
  if (!acceso && !chiuso) return "";
  const aperta = apertaSecondoVerso(acceso, invertiti?.has?.(clean(entity)) === true);
  return aperta ? "aperto" : "chiuso";
}

/**
 * Quanti varchi sono aperti, fra quelli che si sanno leggere.
 *
 * E' la domanda vera di chi ha chiesto questo: «almeno a colpo d'occhio so
 * quante finestre sono aperte in questo momento». Chi non risponde non conta
 * ne' fra gli aperti ne' fra i chiusi: contarlo chiuso sarebbe una bugia
 * tranquillizzante.
 */
export function contaIVarchi(entities = [], states = {}, invertiti) {
  let aperti = 0;
  let chiusi = 0;
  let muti = 0;
  for (const entity of entities) {
    const stato = states?.[clean(entity)];
    if (!eUnVarco(entity, stato)) continue;
    const come = comeStaIlVarco(entity, stato, invertiti);
    if (come === "aperto") aperti += 1;
    else if (come === "chiuso") chiusi += 1;
    else muti += 1;
  }
  return { aperti, chiusi, muti, totale: aperti + chiusi + muti };
}
