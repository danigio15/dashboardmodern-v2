/* Aprire una telecamera senza far aspettare, e senza rifare ogni volta la fila.
 *
 * Dal campo: «vanno riviste completamente le connessioni che avvengono con le
 * telecamere, sono lentissime e non carica immediatamente immagine.» E' la
 * stessa cosa che aveva portato la #385 e la #395 sulle Arlo, guardata dal
 * lato giusto: non «quale strada regge», ma «quanto ci mette a comparire
 * qualcosa».
 *
 * Aprire una telecamera vuol dire provare piu' strade — WebRTC, HLS, MJPEG,
 * istantanee — e si provano IN FILA, una dopo l'altra, ognuna col suo permesso
 * di tempo. Due conseguenze, e sono tutte e due quello che si e' segnalato:
 *
 *   · finche' una strada non vince non c'e' niente da guardare. La prima che
 *     scrive qualcosa nel popup e' quella che riesce: prima di allora il
 *     riquadro e' vuoto, e sopra c'e' scritto «Connessione…». Su una
 *     telecamera che dorme il permesso e' venticinque secondi per il solo HLS;
 *   · la fila si rifa' identica a ogni apertura. La telecamera del salone che
 *     ieri, l'altroieri e cinque minuti fa e' andata in HLS, si ripiglia i tre
 *     secondi di WebRTC prima di ricominciare da capo.
 *
 * Questo modulo tiene i due conti che servono a togliere l'attesa. Non apre
 * niente e non disegna niente: dice quale strada ha funzionato l'ultima volta
 * per quella telecamera e quanto vale la pena aspettarla, e quando quel ricordo
 * non vale piu' la pena di crederci.
 *
 * Il ricordo sta su QUESTO dispositivo e non viaggia con la casa: la strada
 * buona non e' una proprieta' della telecamera, e' una proprieta' della strada
 * di rete fra chi guarda e la telecamera. Dal divano si passa in HLS, dal
 * telefono fuori casa magari no, e scrivere la scelta di uno sull'altro
 * vorrebbe dire far sbagliare strada a tutti e due.
 *
 * Per la stessa ragione un ricordo vale poco tempo, e chi lo usa gli concede
 * poco: se sbaglia, si e' perso quel poco e si riparte con la fila intera.
 */

const pulito = (valore) => String(valore ?? "").trim();

/** Dove si scrive quale strada ha funzionato. Non e' roba della casa. */
export const CHIAVE_STRADE_TELECAMERE = "cd_cam_strade";

/* Quanto vale un ricordo. Una settimana e' il tempo in cui una casa non cambia
 * ne' rete ne' telecamere; oltre, meglio riprovare tutto che insistere su una
 * strada che nel frattempo potrebbe non esserci piu'. */
export const VALIDITA_DEL_RICORDO_MS = 7 * 24 * 60 * 60 * 1000;

/* Quanto si concede alla strada ricordata: quello che ci mise, piu' un
 * margine, fino a un tetto.
 *
 * Il margine e' anche il minimo — una strada che ieri aggancio' in mezzo
 * secondo oggi ha comunque quattro secondi, perche' la rete di oggi non e'
 * quella di ieri — e il tetto e' basso apposta: un ricordo sbagliato deve
 * costare pochissimo, perche' subito dopo c'e' la fila intera da rifare. */
export const MARGINE_DEL_RICORDO_MS = 4_000;
export const ATTESA_MASSIMA_DEL_RICORDO_MS = 20_000;

/** Le strade che si sanno aprire, col nome che porta la strategia. */
export const STRADE_NOTE = Object.freeze(["WebRTC", "HLS", "MJPEG", "Istantanee"]);

const numero = (valore) => {
  const n = Number(valore);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** La memoria ripulita, da qualunque cosa ci sia scritta. */
export function normalizzaMemoria(stored) {
  const dato = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  const memoria = {};
  for (const [entity, ricordo] of Object.entries(dato)) {
    const id = pulito(entity);
    const strada = pulito(ricordo?.strada);
    const quando = numero(ricordo?.quando);
    if (!id.includes(".") || !STRADE_NOTE.includes(strada) || quando === null) continue;
    memoria[id] = Object.freeze({ strada, quando, ms: numero(ricordo?.ms) ?? 0 });
  }
  return memoria;
}

/** Se questo ricordo e' ancora da credere. */
export function ricordoScaduto(ricordo, adesso = 0, validita = VALIDITA_DEL_RICORDO_MS) {
  const quando = numero(ricordo?.quando);
  if (quando === null) return true;
  /* Un orologio che va indietro — il fuso che cambia, il dispositivo che si
   * risincronizza — non deve far scadere niente: si scarta solo quello che e'
   * davvero vecchio, non quello che sembra venire dal futuro. */
  return adesso - quando > validita;
}

/** Quale strada ha funzionato l'ultima volta per questa telecamera, o `null`. */
export function ricordoDellaTelecamera(memoria, entity, adesso = 0) {
  const ricordo = normalizzaMemoria(memoria)[pulito(entity)];
  if (!ricordo || ricordoScaduto(ricordo, adesso)) return null;
  return ricordo;
}

/** La memoria con dentro questa strada, senza toccare le altre telecamere. */
export function conIlRicordo(memoria, entity, strada, ms, adesso = 0) {
  const pulita = normalizzaMemoria(memoria);
  const id = pulito(entity);
  const nome = pulito(strada);
  if (!id.includes(".") || !STRADE_NOTE.includes(nome)) return pulita;
  return Object.freeze({
    ...pulita,
    [id]: Object.freeze({ strada: nome, quando: adesso, ms: numero(ms) ?? 0 }),
  });
}

/** La memoria senza questa telecamera: la strada ricordata non regge piu'. */
export function senzaIlRicordo(memoria, entity) {
  const pulita = { ...normalizzaMemoria(memoria) };
  delete pulita[pulito(entity)];
  return Object.freeze(pulita);
}

/**
 * Quanto aspettare la strada ricordata.
 *
 * Quello che ci mise l'ultima volta piu' un margine: se ieri l'HLS ha
 * agganciato in due secondi, oggi non ha nessun motivo di metterci venti, e
 * concedergliene venti vuol dire venti secondi di riquadro vuoto quando
 * qualcosa e' cambiato.
 */
export function attesaDelRicordo(ricordo) {
  const speso = numero(ricordo?.ms) ?? 0;
  return Math.min(ATTESA_MASSIMA_DEL_RICORDO_MS, speso + MARGINE_DEL_RICORDO_MS);
}

/* Le istantanee non sono una scorciatoia.
 *
 * Sono l'ultima rete della fila — un fotogramma ogni tanto, niente video e
 * niente audio — e quel fotogramma la plancia lo mette gia' da se' appena si
 * apre il riquadro: saltare la fila per arrivare li' non fa guadagnare niente.
 * In cambio costa: chi salta la fila non passa dalla porta del guscio, e il
 * guscio resta senza sapere quale telecamera e' aperta — cioe' il tasto
 * «Attiva audio», che le istantanee disegnano e che di li' chiede il salto
 * all'HLS, non trova piu' niente da attivare. */
const STRADE_SENZA_SCORCIATOIA = Object.freeze(new Set(["Istantanee"]));

/**
 * La strada da provare per prima, con la sua attesa — o `null`.
 *
 * Non basta che il ricordo ci sia: quella strada deve essere ancora una di
 * quelle che ha senso provare. Una telecamera a cui hanno tolto il nome del
 * flusso go2rtc non puo' andare in WebRTC per quanto ci sia andata ieri, e
 * provarci sarebbe il tempo buttato che questo modulo esiste per togliere.
 */
export function scorciatoia(ricordo, strade = [], adesso = 0) {
  if (!ricordo || ricordoScaduto(ricordo, adesso)) return null;
  if (STRADE_SENZA_SCORCIATOIA.has(ricordo.strada)) return null;
  const voce = (Array.isArray(strade) ? strade : []).find(
    (strada) => pulito(strada?.nome) === ricordo.strada && !pulito(strada?.salta),
  );
  if (!voce) return null;
  return Object.freeze({ ...voce, attesa: attesaDelRicordo(ricordo), scorciatoia: true });
}
