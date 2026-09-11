/* L'inserimento quando la centrale non e' una centrale (#413).
 *
 * «Possibilita' di configurare i comandi di inserimento e modalita' sia nel
 * comando da lanciare che nel nome icona. Utilizzando un dispositivo tramite
 * esphome non ho il classico control_panel_alarm.»
 *
 * La sezione Sicurezza sa leggere una centrale vera: `supported_features` dice
 * quali inserimenti accetta, `code_format` se chiede un codice, e i tasti
 * chiamano i servizi di `alarm_control_panel`. Chi si e' fatto l'antifurto con
 * ESPHome quell'entita' non ce l'ha: ha uno script che inserisce, un
 * `input_select` con le modalita', un paio di `switch`. Tutta roba che Home
 * Assistant sa comandare benissimo — solo che nessuno la dichiara come una
 * centrale, e la fila di tasti restava quella finta di ripiego, che chiamava
 * servizi che non esistono.
 *
 * Qui i tasti li descrive chi ha la casa: un nome, un'icona, l'entita' da
 * chiamare, e — se serve — dove leggere se quella modalita' e' inserita adesso.
 * Non si indovina niente: il servizio si ricava dal dominio dell'entita',
 * perche' quello Home Assistant lo dichiara, e il resto e' scritto.
 *
 * Il modulo e' puro: dice cosa chiamare e chi e' acceso, e non chiama niente.
 */

import { actionCatalogMatch } from "./personalization-catalog.js";
import { ilCodiceCombacia, ilCodiceServe, normalizzaIlCodice } from "./codice-a-tastierino.js";

const pulito = (valore) => String(valore ?? "").trim();
const minuscolo = (valore) => pulito(valore).toLowerCase();

/** Dove si scrivono i modi su misura. */
export const CHIAVE_ANTIFURTO_SU_MISURA = "cd_antifurto_su_misura";

/* Che cosa sa eseguire ogni dominio quando gli si dice «inserisci cosi'».
 *
 * Solo domini che un antifurto fatto in casa usa davvero. Chiamare `turn_on`
 * su un `button` non da' errore a schermo — Home Assistant risponde che quel
 * servizio non c'e', il messaggio resta nella console e non succede niente —
 * ed e' esattamente il tasto rotto che questa tabella evita. */
const SERVIZI = Object.freeze({
  script: "turn_on",
  scene: "turn_on",
  button: "press",
  input_button: "press",
  automation: "trigger",
  switch: "turn_on",
  input_boolean: "turn_on",
  light: "turn_on",
  select: "select_option",
  input_select: "select_option",
  alarm_control_panel: "alarm_arm_away",
});

/** Il dominio di un'entita', o "" se non e' un'entita'. */
function dominioDi(entity) {
  const id = pulito(entity);
  const punto = id.indexOf(".");
  return punto > 0 ? id.slice(0, punto).toLowerCase() : "";
}

/** I domini che si possono mettere su un tasto dell'antifurto. */
export const DOMINI_SU_MISURA = Object.freeze(Object.keys(SERVIZI));

/** Se questa entita' e' una di quelle che chiedono anche l'opzione. */
export function vuoleUnOpzione(entity) {
  return ["select", "input_select"].includes(dominioDi(entity));
}

/**
 * Un modo su misura ripulito, o `null` se non ha niente da premere.
 *
 * Senza entita' il tasto non farebbe niente, e un tasto che non fa niente non
 * deve esistere: e' la stessa regola dei tasti della centrale vera.
 *
 * E un menu senza la voce da scegliere e' la stessa cosa detta in un altro
 * modo: `select_option` senza l'opzione non e' una chiamata, e il tasto
 * sarebbe li' a farsi premere senza fare niente. Capita alla prima riga
 * appena scritta, dove il campo dell'opzione compare solo dopo che l'entita'
 * c'e': meglio un tasto che non compare ancora di uno che compare e tace.
 */
export function normalizzaModoSuMisura(grezzo, indice = 0) {
  if (!grezzo || typeof grezzo !== "object") return null;
  const entita = pulito(grezzo.entita);
  if (!entita.includes(".") || !SERVIZI[dominioDi(entita)]) return null;
  const id = pulito(grezzo.id) || `su-misura-${indice + 1}`;
  const opzione = pulito(grezzo.opzione);
  if (vuoleUnOpzione(entita) && !opzione) return null;
  return Object.freeze({
    id,
    nome: pulito(grezzo.nome),
    icona: pulito(grezzo.icona),
    entita,
    opzione,
    /* Dove si legge se e' inserito adesso. In mancanza si guarda l'entita'
     * stessa: per uno `switch` o un `input_select` e' gia' la risposta, per
     * uno `script` non lo e' — e allora nessun tasto resta acceso, che e'
     * meglio di uno acceso a caso. */
    stato: pulito(grezzo.stato) || entita,
    valore: pulito(grezzo.valore) || opzione,
    /* Il codice che questo tasto chiede prima di partire (#336).
     *
     * «Oltre a scegliere l'entita' si possa inserire un pin ed esca il
     * tastierino, come succede gia' nella sezione aperture mettendo una
     * serratura.» Una centrale vera il codice lo dichiara lei e lo verifica
     * Home Assistant; uno script e un interruttore un codice non lo
     * accettano, quindi l'unico posto dove chiederlo e' qui, prima di
     * mandare il comando — esattamente come per le aperture.
     *
     * Facoltativo: chi non lo scrive preme e basta, come ha sempre fatto. */
    pin: normalizzaIlCodice(grezzo.pin),
  });
}

/** Se questo tasto, prima di partire, chiede il codice. */
export function ilModoChiedeIlCodice(modo) {
  return ilCodiceServe(modo?.pin);
}

/** Il codice digitato fa partire questo tasto? Un tasto senza codice parte sempre. */
export function ilCodiceApreIlModo(modo, digitato) {
  return ilCodiceCombacia(modo?.pin, digitato);
}

/** L'elenco pulito, da qualunque cosa ci sia in memoria. */
export function normalizzaModiSuMisura(stored) {
  const grezzi = Array.isArray(stored) ? stored : [];
  const visti = new Set();
  const modi = [];
  for (const [indice, grezzo] of grezzi.entries()) {
    const modo = normalizzaModoSuMisura(grezzo, indice);
    if (!modo || visti.has(modo.id)) continue;
    visti.add(modo.id);
    modi.push(modo);
  }
  return modi;
}

/**
 * La chiamata da fare per questo tasto: dominio, servizio, entita' e dati.
 *
 * @returns {{domain:string,service:string,entity:string,data:object}|null}
 */
export function chiamataDelModo(modo) {
  const pulita = modo && modo.entita ? modo : normalizzaModoSuMisura(modo);
  if (!pulita) return null;
  const domain = dominioDi(pulita.entita);
  const service = SERVIZI[domain];
  if (!service) return null;
  const data = { entity_id: pulita.entita };
  if (service === "select_option") {
    if (!pulita.opzione) return null;
    data.option = pulita.opzione;
  }
  return Object.freeze({ domain, service, entity: pulita.entita, data: Object.freeze(data) });
}

/* Se questo valore vuol dire «inserito». Senza un valore scritto vale la
 * regola di Home Assistant: `on` e' acceso, tutto il resto no. */
function eAcceso(modo, stato) {
  const adesso = minuscolo(stato);
  if (!adesso || ["unavailable", "unknown", "none"].includes(adesso)) return false;
  const atteso = minuscolo(modo.valore);
  return atteso ? adesso === atteso : adesso === "on";
}

/**
 * Quale dei modi su misura e' inserito adesso, o "".
 *
 * Il primo che risponde di si'. Se due dicono di essere inseriti insieme
 * qualcosa non torna nella configurazione, e accendere il primo e' meglio che
 * accenderne due: su un antifurto una fila con due tasti accesi non si sa
 * leggere.
 */
export function modoSuMisuraAcceso(modi = [], states = {}) {
  for (const modo of modi) {
    const stato = states?.[modo.stato]?.state;
    if (eAcceso(modo, stato)) return modo.id;
  }
  return "";
}

/* Il prefisso che distingue un tasto su misura da un servizio della centrale.
 *
 * I tasti dell'antifurto — quelli della sezione e quelli della tessera in Home
 * — passano tutti da `promptPinAndSet`, che riceve il nome del servizio. Un
 * tasto su misura non ha un servizio di `alarm_control_panel` da mandare: manda
 * il proprio nome marcato cosi', e chi riceve sa di dover guardare qui invece
 * che nella centrale. Una porta sola, e le due file restano quello che sono. */
export const PREFISSO_SU_MISURA = "dm-su-misura:";

/** L'identificativo dentro un servizio marcato, o "" se non lo e'. */
export function modoDalServizio(servizio) {
  const testo = pulito(servizio);
  return testo.startsWith(PREFISSO_SU_MISURA) ? testo.slice(PREFISSO_SU_MISURA.length) : "";
}

/**
 * I modi su misura nella forma dei tasti dell'antifurto.
 *
 * Stessa forma di `ALARM_MODES`, cosi' da qui in poi sono tasti come gli altri:
 * la sezione e la tessera della Home li disegnano senza sapere da dove
 * arrivano, ed e' l'unico modo perche' le due file restino uguali.
 */
export function tastiSuMisura(stored) {
  return normalizzaModiSuMisura(stored).map((modo) =>
    Object.freeze({
      mode: modo.id,
      bit: 0,
      service: `${PREFISSO_SU_MISURA}${modo.id}`,
      state: "",
      icon: actionCatalogMatch(modo.icona)?.glyph || "\u{1F6E1}\u{FE0F}",
      /* Il nome dell'icona scelta, non il glifo: chi disegna lo passa al
       * motore delle icone, che il disegno lo trova da se'. */
      icona: modo.icona,
      label: modo.nome || modo.id,
      hint: modo.entita,
      suMisura: true,
    }),
  );
}
