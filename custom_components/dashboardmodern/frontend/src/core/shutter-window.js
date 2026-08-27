/* Quando l'infisso dietro la tapparella e' aperto.
 *
 * La tapparella sta fuori; l'infisso — telaio, ante, maniglia — sta dentro, ed
 * e' quello che si vede dalla stanza. Un contatto sull'anta dice se e' aperta,
 * e la card lo disegna. Qui non c'e' DOM: solo la lettura del contatto, cosi'
 * la regola si puo' provare senza aprire un browser.
 */

import { coverEntries } from "./cover-kind.js";

const clean = (value) => String(value ?? "").trim();

/* I nomi che il contatto puo' avere nella configurazione della tapparella.
 * `contact` e' quello che scrive l'editor; gli altri esistono perche' chi
 * arriva da una configurazione scritta a mano puo' aver usato i suoi. */
export const CONTACT_KEYS = Object.freeze([
  "contact",
  "contact_entity",
  "window_entity",
  "opening_entity",
]);

export function contactEntity(cover = {}) {
  for (const key of CONTACT_KEYS) {
    const value = clean(cover[key]);
    if (value) return value;
  }
  return "";
}

/* Aperto, chiuso, o non lo sappiamo.
 *
 * Un contatto porta e finestra in Home Assistant sta a `on` quando e' aperto e
 * `off` quando e' chiuso — al contrario di quasi tutto il resto, ed e' il motivo
 * per cui vale la pena scriverlo una volta sola qui. Un sensore che non risponde
 * non e' una finestra chiusa: e' una finestra di cui non sappiamo niente, e la
 * card in quel caso non inventa nulla. */
const APERTO = /^(on|open|opening|aperto|aperta|true|detected)$/i;
const CHIUSO = /^(off|closed|closing|chiuso|chiusa|false|clear)$/i;

export function windowOpenFromState(state) {
  const value = clean(state);
  if (APERTO.test(value)) return true;
  if (CHIUSO.test(value)) return false;
  return null;
}

/** Il contatto di questa tapparella e cosa sta dicendo adesso. */
export function shutterWindowModel(cover = {}, states = {}, resolve = (value) => value) {
  const reference = contactEntity(cover);
  if (!reference) return { entity: "", open: null, configured: false };
  let entity = reference;
  try {
    entity = clean(resolve(reference)) || reference;
  } catch (_error) {
    entity = reference;
  }
  const snapshot = states?.[entity] || states?.[reference] || null;
  return { entity, open: windowOpenFromState(snapshot?.state), configured: true };
}

/* Una finestra che non si comanda: c'e' solo il contatto.
 *
 * «Io non ho le tapparelle, ho le persiane e sono manuali, pero' ho sensori di
 * apertura, volevo inserirli ma chiede obbligatoriamente l'entita' tapparella».
 * Aveva ragione: il modulo offre la casella del contatto e poi rifiuta di
 * salvare la riga che contiene solo quello. Una riga cosi' non comanda niente,
 * ma ha qualcosa da dire — se la finestra e' aperta o chiusa — e quello e'
 * esattamente cio' che la card sa gia' disegnare.
 */
export function isWindowOnly(cover = {}) {
  return Boolean(contactEntity(cover)) && coverEntries(cover).length === 0;
}
