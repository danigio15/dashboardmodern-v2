/* Gli stati di Home Assistant, detti in italiano (e in inglese vero).
 *
 * «Posizione auto da nome non tradotto not_home»: nella finestra della tessera
 * Auto, sotto «RAV4 luogo di parcheggio», c'era scritto `not_home`. Non è una
 * parola: è il nome che Home Assistant dà a uno stato, con l'underscore in
 * mezzo, e in una plancia non ci va mai.
 *
 * Questa tabella esisteva già — due volte. Una in `entita-mie-section.js` e una
 * in `sezioni-mie-section.js`, quasi uguali: la seconda conosceva quattro
 * parole in più (la base del robot, la carica, il caldo e il freddo) e la prima
 * no, senza che nessuna delle due sapesse dell'altra. E la finestra delle
 * tessere, che è dove è saltata fuori la segnalazione, non ne aveva nessuna:
 * scriveva lo stato grezzo così come arrivava.
 *
 * Tre strade per la stessa domanda, e due si erano già allontanate. Adesso è
 * una: chi deve scrivere uno stato passa di qui.
 *
 * Sta in `sections` e non nel nucleo per una ragione meccanica, non di gusto:
 * il raccoglitore delle traduzioni legge le `t()` solo da `src/sections`, e una
 * scritta dentro `src/core` non finirebbe nei tredici cataloghi.
 *
 * Quello che non c'è in tabella si mostra come Home Assistant l'ha mandato:
 * meglio una parola inglese vera che un trattino al posto di un'informazione
 * che c'è. E il nome di una zona — «Lavoro», «Palestra» — è già una parola
 * scritta da qualcuno, quindi passa intatta proprio perché in tabella non c'è.
 */
import { clean, t } from "./shared.js";

/** Le parole di stato che la plancia sa dire. */
export function tabellaDegliStati() {
  return {
    on: t("Acceso", "On"),
    off: t("Spento", "Off"),
    open: t("Aperto", "Open"),
    closed: t("Chiuso", "Closed"),
    home: t("In casa", "Home"),
    not_home: t("Fuori", "Away"),
    idle: t("Fermo", "Idle"),
    playing: t("In riproduzione", "Playing"),
    paused: t("In pausa", "Paused"),
    docked: t("Alla base", "Docked"),
    cleaning: t("Al lavoro", "Cleaning"),
    charging: t("In carica", "Charging"),
    heat: t("Riscalda", "Heating"),
    cool: t("Raffresca", "Cooling"),
    locked: t("Chiuso a chiave", "Locked"),
    unlocked: t("Sbloccato", "Unlocked"),
  };
}

/**
 * Uno stato di Home Assistant, in parole.
 *
 * La tabella si costruisce a ogni chiamata e non una volta sola: le parole
 * dipendono dalla lingua attiva, e una tabella congelata al primo caricamento
 * resterebbe nella lingua di allora anche dopo averla cambiata.
 */
export function parolaDiStato(grezzo) {
  const voce = clean(grezzo);
  return tabellaDegliStati()[voce.toLowerCase()] || voce;
}

/* ── le porte, che sono femmine ────────────────────────────────────────────
 *
 * Le stesse quattro serrature dette al femminile, piu' i due stati di mezzo
 * che solo una porta ha. Non e' un secondo elenco per la stessa domanda: e'
 * la stessa domanda posta su un sostantivo noto. Fuori di qui l'entita' non si
 * sa che cosa sia — un sensore, un robot, un tracciatore — e il maschile e'
 * l'unica scelta che non sbaglia; su una porta sbaglierebbe sempre, perche'
 * «chiuso a chiave» sotto il nome di una porta e' italiano storto.
 *
 * Per questo stanno vicine e non sparse: chi cambia una parola vede l'altra.
 */
export function tabellaDelleParoleDellaPorta() {
  return {
    locked: t("Chiusa a chiave", "Locked"),
    unlocked: t("Sbloccata", "Unlocked"),
    open: t("Aperta", "Open"),
    opening: t("In apertura", "Opening"),
    closing: t("In chiusura", "Closing"),
    closed: t("Chiusa", "Closed"),
  };
}

/**
 * Lo stato di una porta, in parole — o niente.
 *
 * Vuoto, e non lo stato grezzo, quando la parola non si conosce: chi chiama
 * sa gia' cosa scriverci al posto — la sezione invita a toccare, la tessera
 * lascia la riga senza sottotitolo — e un `locked` crudo li' sotto sarebbe
 * peggio di uno spazio bianco.
 */
export function parolaDellaPorta(grezzo) {
  return tabellaDelleParoleDellaPorta()[clean(grezzo).toLowerCase()] || "";
}
