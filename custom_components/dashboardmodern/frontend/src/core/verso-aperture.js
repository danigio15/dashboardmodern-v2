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

/* E lo STATO che la copertura dichiara, girato con lo stesso verso (#353).
 *
 * «Il flag per invertire le tapparelle aperte/chiuse non sembra funzionare.
 *  Slider al 100% rimane cosi' se invertito per tapparella aperta.» Il verso si
 * applicava alla sola `current_position`, e una tapparella che quella posizione
 * non la pubblica — ce ne sono, e sono proprio quelle montate al contrario —
 * restava esattamente com'era: la spunta non cambiava niente, ne' la pastiglia,
 * ne' il cursore che dalla parola «aperta» ricava il suo cento per cento.
 *
 * Aperto e chiuso si scambiano, e con loro i due versi del movimento: una
 * tapparella girata che «sta aprendo» secondo Home Assistant sta scendendo.
 * Tutto il resto — sconosciuto, non disponibile, il fermo di due rele' — resta
 * quello che e': girare una cosa che non si sa non la fa sapere.
 */
const GIRATI = Object.freeze({
  open: "closed",
  closed: "open",
  opening: "closing",
  closing: "opening",
});

export function statoSecondoVerso(stato, invertita) {
  const testo = clean(stato).toLowerCase();
  if (!invertita) return testo;
  return GIRATI[testo] || testo;
}

/** Il flag della riga di una tapparella. */
export function versoInvertito(item) {
  return item?.invertita === true || item?.invertita === "on" || item?.inverted === true;
}
