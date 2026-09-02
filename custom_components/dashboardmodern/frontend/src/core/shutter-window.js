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

/* Il secondo contatto: quello che sta FUORI (#254).
 *
 * «Non ho le tapparelle: sarebbe possibile una card che consideri due sensori
 * di contatto, uno per le inferriate esterne e uno per gli infissi interni?»
 * L'inferriata sta davanti al vetro e si apre di lato; l'infisso sta dietro e
 * rientra verso i cardini. Sono due cose diverse e vanno dette separate: una
 * finestra chiusa dietro una grata aperta e' una casa arieggiata, una finestra
 * aperta dietro una grata chiusa e' tutt'altra faccenda.
 *
 * Chi ha una tapparella non riempie questa casella e non vede niente di nuovo:
 * la grata compare solo se qualcuno l'ha dichiarata. */
export const INFERRIATA_KEYS = Object.freeze([
  "inferriata",
  "inferriata_entity",
  "grate_entity",
  "outer_contact",
]);

export function inferriataEntity(cover = {}) {
  for (const key of INFERRIATA_KEYS) {
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
  return letturaContatto(contactEntity(cover), states, resolve);
}

/* Un contatto qualunque della riga, letto col suo verso.
 *
 * Sta fuori da `shutterWindowModel` perche' adesso i contatti sono due e la
 * lettura e' la stessa: cambia solo quale casella si guarda. */
function letturaContatto(reference, states, resolve) {
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

/* I quattro modi in cui un serramento a due contatti puo' stare.
 *
 * «Un'immagine che consideri i vari stati: inferriata aperta e finestra
 * chiusa, inferriata chiusa e finestra aperta, o tutto chiuso.» Sono
 * esattamente questi, piu' il caso che non si puo' evitare: un sensore che non
 * risponde. Quello non diventa «chiuso» — sarebbe raccontare per certo il
 * contrario di quel che si sa — ma nemmeno blocca la lettura dell'altro: se
 * l'infisso e' aperto e la grata e' muta, «aperta» va detto lo stesso. */
export const STATI_SERRAMENTO = Object.freeze(["chiuso", "grata", "infisso", "aperto", "ignoto"]);

export function statoDelSerramento(inferriata, infisso) {
  /* Senza la grata il serramento e' quello di sempre: parla solo l'infisso. */
  if (inferriata == null && infisso == null) return "ignoto";
  if (inferriata == null) return infisso ? "infisso" : "chiuso";
  if (infisso == null) return inferriata ? "grata" : "chiuso";
  if (inferriata && infisso) return "aperto";
  if (inferriata) return "grata";
  if (infisso) return "infisso";
  return "chiuso";
}

/**
 * Il serramento intero: la grata davanti, l'infisso dietro, e come stanno.
 *
 * `invertiti` e' l'insieme dei sensori girati (#244): il verso si applica a
 * entrambi i contatti, perche' chi ha un filo al contrario ce l'ha sul
 * sensore, non sul tipo di apertura.
 */
export function serramentoModel(cover = {}, states = {}, resolve = (value) => value, invertiti) {
  const giraSe = (entity, aperta) => {
    if (!invertiti || aperta == null) return aperta;
    return invertiti.has(clean(entity)) ? !aperta : aperta;
  };
  const infisso = letturaContatto(contactEntity(cover), states, resolve);
  const inferriata = letturaContatto(inferriataEntity(cover), states, resolve);
  infisso.open = giraSe(infisso.entity, infisso.open);
  inferriata.open = giraSe(inferriata.entity, inferriata.open);
  return {
    infisso,
    inferriata,
    /* Con la sola grata configurata lo stato lo dice lei; con la sola finestra
     * lo dice la finestra. Chiedere entrambe sarebbe pretendere una casella
     * che meta' delle case non ha. */
    stato: statoDelSerramento(
      inferriata.configured ? inferriata.open : null,
      infisso.configured ? infisso.open : null,
    ),
  };
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
  /* Anche la sola inferriata basta: chi ha le grate e nient'altro ha
   * comunque qualcosa da guardare, ed e' lo stesso motivo per cui bastava il
   * solo contatto dell'infisso. */
  return (
    Boolean(contactEntity(cover) || inferriataEntity(cover)) && coverEntries(cover).length === 0
  );
}
