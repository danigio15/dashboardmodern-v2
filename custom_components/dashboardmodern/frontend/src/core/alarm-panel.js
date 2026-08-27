/* Cosa sa fare davvero la centrale antifurto, e cosa chiede prima di farlo.
 *
 * La plancia mostrava sempre gli stessi tre tasti — Fuori, Notte, Sblocca —
 * qualunque centrale ci fosse dietro. Con Ring (ring-mqtt) il tasto Notte non
 * si accendeva mai e premendolo non succedeva niente: Ring quella modalita'
 * non ce l'ha, e il servizio finiva nel vuoto. Nello stesso momento lo stato
 * diceva ARMATO · CASA mentre il tasto acceso era Fuori, perche' `armed_home`
 * veniva letto come se fosse `armed_away`.
 *
 * Home Assistant lo dichiara: `supported_features` e' una maschera di bit e
 * dice quali inserimenti la centrale accetta. Un tasto che non corrisponde a
 * un bit e' un tasto che non fa niente, e non deve esistere.
 *
 * Lo stesso vale per il codice. `code_format` dice se un codice esiste, e
 * `code_arm_required` se serve anche per inserire — non solo per disinserire.
 * Ring non ne pubblica nessuno: il tastierino chiedeva un PIN che non veniva
 * verificato da nessuno, e premere OK a vuoto funzionava. Chiederlo quando non
 * c'e' non e' sicurezza, e' un passaggio in piu' che non protegge niente.
 *
 * Il modulo e' puro: prende l'oggetto di stato come Home Assistant lo manda e
 * risponde. Non tocca il documento e non chiama servizi.
 */

/* I bit di alarm_control_panel, come li definisce Home Assistant. */
export const ALARM_FEATURES = Object.freeze({
  home: 1,
  away: 2,
  night: 4,
  trigger: 8,
  custom: 16,
  vacation: 32,
});

/* Le modalita' di inserimento, nell'ordine in cui si leggono: dalla piu' vicina
 * a casa alla piu' lontana. Il disinserimento non e' una modalita' fra queste —
 * c'e' sempre, e sta in fondo. */
export const ALARM_MODES = Object.freeze([
  Object.freeze({
    mode: "home",
    bit: ALARM_FEATURES.home,
    service: "alarm_arm_home",
    state: "armed_home",
    icon: "🏡",
  }),
  Object.freeze({
    mode: "away",
    bit: ALARM_FEATURES.away,
    service: "alarm_arm_away",
    state: "armed_away",
    icon: "🏠",
  }),
  Object.freeze({
    mode: "night",
    bit: ALARM_FEATURES.night,
    service: "alarm_arm_night",
    state: "armed_night",
    icon: "🌙",
  }),
  Object.freeze({
    mode: "vacation",
    bit: ALARM_FEATURES.vacation,
    service: "alarm_arm_vacation",
    state: "armed_vacation",
    icon: "✈️",
  }),
  Object.freeze({
    mode: "custom",
    bit: ALARM_FEATURES.custom,
    service: "alarm_arm_custom_bypass",
    state: "armed_custom_bypass",
    icon: "🎚️",
  }),
]);

export const ALARM_DISARM = Object.freeze({
  mode: "disarm",
  bit: 0,
  service: "alarm_disarm",
  state: "disarmed",
  icon: "🔓",
});

/* Le modalita' da mostrare quando la centrale non dichiara niente.
 *
 * Succede con le centrali finte dei template e con qualche integrazione
 * vecchia. Si tengono i due inserimenti che la plancia ha sempre avuto: meglio
 * un tasto in piu' che una pagina senza tasti. */
const SENZA_DICHIARAZIONE = Object.freeze(["away", "night"]);

const numero = (valore) => {
  const n = Number(valore);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
};

/** La maschera dichiarata dalla centrale, o `null` se non ne dichiara una. */
export function alarmFeatures(stateObj) {
  const attributi = stateObj?.attributes;
  if (!attributi || typeof attributi !== "object") return null;
  return numero(attributi.supported_features);
}

/**
 * I tasti da disegnare per questa centrale: gli inserimenti che accetta, piu'
 * il disinserimento che accetta sempre.
 *
 * @returns {Array<{mode:string,bit:number,service:string,state:string,icon:string}>}
 */
export function alarmModes(stateObj) {
  const maschera = alarmFeatures(stateObj);
  const inserimenti =
    maschera === null || maschera === 0
      ? ALARM_MODES.filter((voce) => SENZA_DICHIARAZIONE.includes(voce.mode))
      : ALARM_MODES.filter((voce) => (maschera & voce.bit) === voce.bit);
  /* Una maschera che non contiene nessun inserimento e' una centrale che sa
   * solo disinserire: capita alle centrali in sola lettura. Si mostra quello. */
  return [...inserimenti, ALARM_DISARM];
}

/**
 * Il tasto che corrisponde allo stato attuale.
 *
 * `disponibili` sono le modalita' che la pagina ha davvero disegnato: se la
 * centrale e' in `armed_home` ma il tasto Casa non c'e' — perche' non lo
 * dichiara — si accende quello dell'inserimento totale, che e' il piu' vicino,
 * invece di lasciare la fila spenta.
 */
export function alarmActiveMode(state, disponibili = null) {
  const valore = String(state ?? "")
    .trim()
    .toLowerCase();
  if (!valore) return "";
  const elenco = Array.isArray(disponibili) && disponibili.length ? disponibili.map(String) : null;
  const disegnato = (mode) => !elenco || elenco.includes(mode);
  if (valore === ALARM_DISARM.state) return ALARM_DISARM.mode;
  const esatto = ALARM_MODES.find((voce) => voce.state === valore);
  if (esatto) {
    if (disegnato(esatto.mode)) return esatto.mode;
    if (esatto.mode !== "away" && disegnato("away")) return "away";
    return "";
  }
  return "";
}

/**
 * Se il tastierino deve comparire prima di chiamare questo servizio.
 *
 * `code_format` vuoto vuol dire che un codice non esiste: chiederlo sarebbe
 * teatro. `code_arm_required: false` vuol dire che il codice serve solo per
 * disinserire — inserire si puo' senza.
 */
export function alarmCodeNeeded(stateObj, service) {
  const attributi = stateObj?.attributes;
  if (!attributi || typeof attributi !== "object") return false;
  const formato = String(attributi.code_format ?? "")
    .trim()
    .toLowerCase();
  if (!formato || formato === "none" || formato === "null") return false;
  if (String(service ?? "") === ALARM_DISARM.service) return true;
  return attributi.code_arm_required !== false;
}

/* ── quali dei tasti accettati si vogliono davvero vedere ───────────────────
 *
 * La centrale dice cosa ACCETTA; chi la usa decide cosa gli serve. Una Ring
 * accetta Casa, Fuori, Notte, Vacanza e Parziale: chi in vacanza non ci va mai
 * si ritrova due tasti che non premera' mai, e in fondo alla fila il tasto che
 * usa ogni sera. La scelta si tiene qui, in una casella sola, e vale solo per
 * quello che si vede: un tasto tolto non cambia niente di cosa la centrale sa
 * fare, e lo sblocco non si toglie mai — e' l'unico che deve esserci sempre.
 *
 * La casella tiene solo le modalita' TOLTE: cosi' una centrale che domani
 * dichiara un inserimento in piu' lo mostra da sola, senza che nessuno debba
 * aggiornare un elenco. */
export const ALARM_MODE_CHOICE_KEY = "cd_antifurto_modi";

/** L'elenco pulito delle modalita' tolte, da qualunque cosa ci sia in memoria. */
export function alarmHiddenModes(stored) {
  const validi = new Set(ALARM_MODES.map((voce) => voce.mode));
  const grezzo = Array.isArray(stored)
    ? stored
    : stored && typeof stored === "object"
      ? Object.entries(stored)
          .filter(([, valore]) => valore === false)
          .map(([chiave]) => chiave)
      : [];
  return grezzo
    .map((voce) =>
      String(voce ?? "")
        .trim()
        .toLowerCase(),
    )
    .filter((voce) => validi.has(voce));
}

/**
 * I tasti da disegnare davvero: quelli che la centrale accetta, meno quelli
 * che si e' scelto di non vedere.
 */
export function alarmVisibleModes(stateObj, stored) {
  const tolte = new Set(alarmHiddenModes(stored));
  const tutte = alarmModes(stateObj);
  const restano = tutte.filter((voce) => voce.mode === ALARM_DISARM.mode || !tolte.has(voce.mode));
  /* Toglierli tutti lascerebbe la fila con il solo sblocco, e una centrale che
   * si puo' solo spegnere non e' quello che uno voleva chiedere: se la scelta
   * cancella ogni inserimento la si ignora. */
  return restano.length > 1 ? restano : tutte;
}
