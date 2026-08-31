/* Il verso di un'apertura, quando il sensore lo dice al contrario (#244).
 *
 * Certi contatti porta/finestra stanno a ON quando l'infisso e' CHIUSO — e
 * certe tapparelle dichiarano 100 quando sono giu'. La plancia leggeva tutti
 * col verso di Home Assistant e per quelle case diceva sempre il contrario.
 * Come nelle card Lovelace, il verso si puo' invertire: per i sensori c'e'
 * una lista di entita' girate (`cd_stati_invertiti`, sincronizzata); per le
 * tapparelle un flag sulla riga (`invertita` in cd_tapparelle).
 *
 * Qui non c'e' DOM ne' localStorage: solo il conto, cosi' si prova a secco.
 */

const clean = (value) => String(value ?? "").trim();

/** La chiave della lista dei sensori girati. */
export const CHIAVE_VERSI = "cd_stati_invertiti";

/** La lista grezza diventa un insieme interrogabile. */
export function insiemeInvertiti(raw) {
  return new Set((Array.isArray(raw) ? raw : []).map(clean).filter(Boolean));
}

/* Aperta, chiusa o non lo sappiamo — col verso giusto.
 *
 * Il `null` resta `null`: un sensore muto non diventa una finestra chiusa
 * per il solo fatto d'essere girato. */
export function apertaSecondoVerso(aperta, invertita) {
  if (aperta == null) return aperta;
  return invertita ? !aperta : Boolean(aperta);
}

/* La posizione col verso giusto: per la tapparella girata 100 vuol dire
 * chiusa, e la plancia — che ragiona con 100 = aperta — la legge come 0.
 * Vale in entrambe le direzioni: la stessa funzione traduce quello che si
 * legge E quello che si scrive. */
export function posizioneSecondoVerso(posizione, invertita) {
  const numero = Number(posizione);
  if (posizione == null || !Number.isFinite(numero)) return null;
  const dentro = Math.max(0, Math.min(100, numero));
  return invertita ? 100 - dentro : dentro;
}

/** Il flag della riga di una tapparella. */
export function versoInvertito(item) {
  return item?.invertita === true || item?.invertita === "on" || item?.inverted === true;
}
