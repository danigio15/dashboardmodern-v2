// DM-FIX-20260824A
import { pick } from "./i18n.js";
import { getDeviceDisplayName, getDeviceVisual } from "./device-model.js";

const clean = (value) => String(value || "").trim();
const entityId = (entry) =>
  clean(typeof entry === "string" ? entry : entry?.entity || entry?.entity_id);
const explicitCandidates = (device, keys) =>
  keys
    .map((key) => device?.[key])
    .map(entityId)
    .filter(Boolean);
const candidates = (device, keys) =>
  [...explicitCandidates(device, keys), ...(device?.entities || [])].map(entityId).filter(Boolean);
const numeric = (states, entity) => {
  const value = Number(states?.[entity]?.state);
  return Number.isFinite(value) ? value : null;
};
const unit = (states, entity) =>
  clean(states?.[entity]?.attributes?.unit_of_measurement).toLowerCase();
const isCumulativeEnergy = (states, entity) => {
  const id = clean(entity);
  if (!id) return false;
  const attributes = states?.[id]?.attributes || {};
  const stateClass = clean(attributes.state_class).toLowerCase();
  if (stateClass === "total" || stateClass === "total_increasing") return true;
  return /(?:^|[._-])(total|totale|lifetime|meter|contatore)(?:[._-]|$)/i.test(id);
};

/* Il ritardo di fine ciclo (#195).
 *
 * La lavastoviglie che asciuga consuma 0 W ma il ciclo non e' finito: la sola
 * potenza direbbe «spenta» a meta' lavoro. Con `off_delay_minutes` configurato
 * la card resta IN FUNZIONE per quei minuti dopo l'ultimo campione sopra
 * soglia; una lettura di nuovo sopra soglia riparte da capo, e lo spegnimento
 * esplicito — lo stato dice off, o l'interruttore viene spento — vince subito,
 * perche' li' non c'e' niente da indovinare. La memoria vive qui e non nello
 * stato di Home Assistant: e' l'unico posto che tutti e sei i consumatori del
 * modello attraversano, quindi badge, card, KPI e tracker raccontano lo stesso
 * ciclo. */
const runHolds = new Map();

/* La scadenza del ritardo va annunciata, non aspettata.
 *
 * Il ritardo finisce da se' solo alla prossima chiamata del modello, e un
 * elettrodomestico che ha smesso di consumare non manda piu' nessun cambio di
 * stato: senza qualcuno che lo dica, la card resta IN FUNZIONE fino al primo
 * ridisegno che capita per altri motivi — che puo' non arrivare per ore. Qui
 * si tiene una sola sveglia, sulla scadenza piu' vicina, e chi disegna si
 * iscrive per rileggere il modello quando suona. */
const scadenzaAscoltatori = new Set();
let scadenzaTimer = 0;
let scadenzaAt = 0;

export function onRunHoldExpiry(callback) {
  if (typeof callback !== "function") return () => {};
  scadenzaAscoltatori.add(callback);
  return () => scadenzaAscoltatori.delete(callback);
}

/** Solo per le prove: dimentica sveglia e ritardi in corso. */
export function resetRunHolds() {
  runHolds.clear();
  if (scadenzaTimer) globalThis.clearTimeout?.(scadenzaTimer);
  scadenzaTimer = 0;
  scadenzaAt = 0;
}

function pianificaScadenza(quando, now) {
  if (typeof globalThis.setTimeout !== "function") return;
  // Una sveglia sola: se ce n'e' gia' una che suona prima, basta quella.
  if (scadenzaTimer && scadenzaAt <= quando) return;
  if (scadenzaTimer) globalThis.clearTimeout?.(scadenzaTimer);
  scadenzaAt = quando;
  scadenzaTimer = globalThis.setTimeout(
    () => {
      scadenzaTimer = 0;
      scadenzaAt = 0;
      for (const ascoltatore of scadenzaAscoltatori) {
        try {
          ascoltatore();
        } catch (_error) {}
      }
    },
    // Un pelo dopo la scadenza: al risveglio il confronto dev'essere gia'
    // passato, altrimenti si ripianifica per lo stesso istante all'infinito.
    Math.max(0, quando - now) + 250,
  );
}

function applyRunHold({ key, mode, delayMinutes, explicitOff, now, holds }) {
  if (!key) return mode;
  if (mode === "running") {
    holds.set(key, now);
    return mode;
  }
  if (mode === "unavailable") return mode;
  const lastRun = holds.get(key);
  if (lastRun == null) return mode;
  if (explicitOff || !(delayMinutes > 0) || now - lastRun > delayMinutes * 60000) {
    holds.delete(key);
    return mode;
  }
  pianificaScadenza(lastRun + delayMinutes * 60000, now);
  return "running";
}

/* Le parole con cui un elettrodomestico dice cosa sta facendo.
 *
 * Dal campo: «prevedi che se non viene messo il sensore potenza, il cambio
 * stato acceso e in funzione lo devi capire dagli stati dei programmi».
 * Aveva ragione, ed era rotto: il vocabolario conosceva «running» e basta,
 * cosi' una lavatrice hOn a meta' lavaggio — che dice «washing», poi
 * «rinse», poi «spin» — cadeva in fondo alla scala e usciva SPENTA. Con la
 * presa smart non si notava, perche' i watt rispondevano al posto suo; senza,
 * la card era muta per tutto il ciclo.
 *
 * Le parole non se le inventa nessuno: sono quelle che le integrazioni vere
 * pubblicano. hOn dice `running` sul modo macchina e `washing`, `rinse`,
 * `spin`, `drying` sulla fase; Home Connect dice `run`, `ready`, `finished`,
 * `delayedstart`; Miele `in_use`, `programmed`, `waiting_to_start`,
 * `program_ended`; SmartThings `wash`, `rinse`, `spin`, `weightsensing`; LG
 * ThinQ `power_off`, `initial`, `end`. Il confronto ignora trattini,
 * underscore e spazi, che sono l'unica cosa su cui non vanno mai d'accordo.
 *
 * Tre elenchi e non due, perche' le parole dicono tre cose diverse:
 * — LAVORA: il ciclo sta girando, e la card dice IN FUNZIONE;
 * — ASPETTA: la macchina e' accesa ma ferma — in pausa, con l'avvio
 *   ritardato, programmata e non ancora partita — e la card dice STANDBY,
 *   che e' la verita': spento sarebbe una bugia, in funzione pure;
 * — FERMA: pronta, finita, spenta, e la card dice SPENTO.
 * Una parola che non sta in nessuno dei tre non decide niente e lascia
 * parlare i watt, com'e' sempre stato.
 */
const senzaSeparatori = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[\s_\-.]+/g, "");

const PAROLE_CHE_LAVORANO = Object.freeze([
  // Il modo macchina, come lo dicono le integrazioni.
  "running",
  "run",
  "inuse",
  "active",
  "started",
  "start",
  "inprogress",
  "operating",
  "working",
  "aborting",
  "cancelling",
  // Le fasi di un ciclo: lavaggio, risciacquo, centrifuga, asciugatura.
  "washing",
  "wash",
  "mainwash",
  "prewash",
  "rinse",
  "rinsing",
  "spin",
  "spinning",
  "spinrinse",
  "drying",
  "dry",
  "tumbling",
  "tumble",
  "steam",
  "soak",
  "soaking",
  "airwash",
  "refresh",
  "weighting",
  "weightsensing",
  "sensing",
  "detecting",
  // Quelle che scaldano o raffreddano: forno, lavastoviglie, pompa di calore.
  "heating",
  "heat",
  "preheat",
  "preheating",
  "cooking",
  "baking",
  "roasting",
  "grilling",
  "boiling",
  "cooling",
  "cool",
  "freezing",
  "defrosting",
  // Le due che c'erano gia', di altri due mondi: il lettore e l'aspirapolvere.
  "playing",
  "cleaning",
  "opening",
  "open",
  // In italiano, per chi rinomina gli stati o usa un template.
  "infunzione",
  "incorso",
  "avviato",
  "attivo",
  "funzionamento",
  "lavaggio",
  "prelavaggio",
  "risciacquo",
  "centrifuga",
  "asciugatura",
  "ammollo",
  "riscaldamento",
  "cottura",
  "raffreddamento",
  "inlavaggio",
]);

const PAROLE_CHE_ASPETTANO = Object.freeze([
  /* «Standby» dice esattamente STANDBY: la macchina e' accesa e non sta
   * lavorando. Stava fra le parole ferme, e una lavastoviglie che lo dichiara
   * usciva SPENTA. */
  "standby",
  "pause",
  "paused",
  "pausing",
  "hold",
  "onhold",
  "rinsehold",
  "suspended",
  "scheduled",
  "programmed",
  "delayedstart",
  "delayed",
  "waitingtostart",
  "waiting",
  "queued",
  "dooropen",
  "doorisopen",
  "setprogram",
  "selected",
  "inpausa",
  "pausa",
  "sospeso",
  "programmato",
  "avvioritardato",
  "inattesa",
  "attesa",
  "portaaperta",
  "differita",
]);

const PAROLE_CHE_STANNO_FERME = Object.freeze([
  "off",
  "poweroff",
  "poweredoff",
  "poweroffed",
  "closed",
  "stopped",
  "stop",
  "idle",
  "ready",
  "readytostart",
  "inactive",
  "initial",
  "sleep",
  "none",
  "nostate",
  "notconnected",
  "disconnected",
  "end",
  "ended",
  "finish",
  "finished",
  "complete",
  "completed",
  "done",
  "programended",
  "endprogrammed",
  "programmeended",
  "drycomplete",
  "abort",
  "aborted",
  "spento",
  "fermo",
  "pronta",
  "pronto",
  "inattivo",
  "finito",
  "terminato",
  "completato",
  "fine",
  "concluso",
  "scollegato",
]);

const insieme = (parole) => new Set(parole.map(senzaSeparatori));
const LAVORANO = insieme(PAROLE_CHE_LAVORANO);
const ASPETTANO = insieme(PAROLE_CHE_ASPETTANO);
const FERME = insieme(PAROLE_CHE_STANNO_FERME);

/** Cosa dice una parola di stato: `running`, `standby`, `off` o niente. */
export function letturaDelloStato(value) {
  const parola = senzaSeparatori(value);
  if (!parola) return "";
  if (LAVORANO.has(parola)) return "running";
  if (ASPETTANO.has(parola)) return "standby";
  if (FERME.has(parola)) return "off";
  return "";
}

/* Quali sensori possono fare da stato quando nessuno l'ha scelto: quelli che
 * si chiamano stato, fase o simili E che in questo momento dicono una parola
 * che il vocabolario conosce. Il nome da solo non basta — `sensor.stato_wifi`
 * si chiama stato e non parla di cicli — e la parola da sola nemmeno. */
const semanticStateValues = new Set([...LAVORANO, ...ASPETTANO, ...FERME]);

function inferSemanticStateEntity(device = {}, states = {}) {
  const entries = (device?.entities || []).map(entityId).filter(Boolean);

  // Prefer explicit state/status-like sensors whose current value already has
  // a clear semantic meaning (e.g. sensor.lavasciuga_state = "running").
  const semanticSensor = entries.find((id) => {
    if (!/^(sensor|binary_sensor)\./.test(id)) return false;
    if (!/(?:^|[._-])(state|status|phase|fase)(?:[._-]|$)/i.test(id)) return false;
    return semanticStateValues.has(senzaSeparatori(states?.[id]?.state));
  });
  if (semanticSensor) return semanticSensor;

  // Smart appliances often expose a dedicated binary activity sensor such as
  // binary_sensor.<device>_running. This is safe to infer because the entity
  // name itself describes activity, unlike a generic control switch.
  return (
    entries.find(
      (id) =>
        /^binary_sensor\./.test(id) &&
        /(?:^|[._-])(running|active|activity|operating|working)(?:[._-]|$)/i.test(id) &&
        ["on", "off"].includes(clean(states?.[id]?.state).toLowerCase()),
    ) || ""
  );
}

export function createApplianceViewModel(
  device = {},
  states = {},
  rooms = [],
  locale = "it",
  options = {},
) {
  const powerEntity =
    candidates(device, ["power_entity", "power", "power_sensor"]).find((id) =>
      /^(w|kw|mw|watt|watts)$/.test(unit(states, id).replaceAll(" ", "")),
    ) || "";
  const controlEntity =
    candidates(device, ["control_entity", "switch_entity", "switch", "light", "fan"]).find((id) =>
      /^(switch|light|input_boolean|fan)\./.test(id),
    ) || "";

  // Explicit configuration always wins. If none is configured, infer only
  // narrowly named semantic state/activity sensors. Generic switches remain
  // excluded so a control switch left ON at 0 W cannot masquerade as running.
  const stateEntity =
    explicitCandidates(device, ["state_entity", "status_entity"]).find((id) =>
      Boolean(states?.[id]),
    ) || inferSemanticStateEntity(device, states);
  const inferredEnergy =
    candidates(device, [
      "total_energy_entity",
      "energy_entity",
      "monthly_energy_entity",
      "daily_energy_entity",
    ]).find((id) => /^(wh|kwh|mwh)$/.test(unit(states, id))) || "";
  // History and previous-month Report data require a lifetime/cumulative meter.
  // A monthly measurement is useful for the current period but must never
  // silently enable the history button or masquerade as a total source.
  const historyEntity =
    [
      device.history_entity,
      device.total_energy_entity,
      device.report_entity,
      device.energy_entity,
      inferredEnergy,
    ]
      .map(entityId)
      .find((id) => isCumulativeEnergy(states, id)) || "";
  const rawPower = numeric(states, powerEntity);
  const watts =
    rawPower == null
      ? null
      : unit(states, powerEntity) === "kw"
        ? rawPower * 1000
        : unit(states, powerEntity) === "mw"
          ? rawPower * 1_000_000
          : rawPower;
  const controlState = clean(states?.[controlEntity]?.state).toLowerCase();
  const configuredState = clean(states?.[stateEntity]?.state).toLowerCase();
  const unavailable = [powerEntity, controlEntity, stateEntity]
    .filter(Boolean)
    .some((id) => ["unknown", "unavailable"].includes(clean(states?.[id]?.state).toLowerCase()));
  const run = Number.isFinite(Number(device.threshold_run)) ? Number(device.threshold_run) : 5;
  const standby = Number.isFinite(Number(device.threshold_standby))
    ? Number(device.threshold_standby)
    : 1;

  const activityBinary =
    /^binary_sensor\./.test(stateEntity) &&
    /(?:^|[._-])(running|active|activity|operating|working)(?:[._-]|$)/i.test(stateEntity);

  /* Cosa dice la parola dello stato, se ne dice una che conosciamo. */
  const dettoDalloStato = Boolean(stateEntity) ? letturaDelloStato(configuredState) : "";

  const explicitRunning =
    dettoDalloStato === "running" || (activityBinary && configuredState === "on");

  const explicitWaiting = dettoDalloStato === "standby";

  const explicitlyOff =
    Boolean(stateEntity) &&
    (dettoDalloStato === "off" || (activityBinary && configuredState === "off"));
  const genericOn = configuredState === "on" || controlState === "on";
  const sampledMode =
    unavailable && watts == null
      ? "unavailable"
      : explicitlyOff && !(watts != null && watts >= run)
        ? "off"
        : explicitRunning || (watts != null && watts >= run)
          ? "running"
          : /* «Acceso ma fermo» e' una risposta, e senza watt e' l'unica che
             * un ciclo in pausa o con l'avvio ritardato merita. */
            explicitWaiting || genericOn || (watts != null && watts >= standby)
            ? "standby"
            : "off";
  const mode = applyRunHold({
    key: clean(device.id) || powerEntity || controlEntity || stateEntity,
    mode: sampledMode,
    delayMinutes: Number(device.off_delay_minutes),
    explicitOff: explicitlyOff || (Boolean(controlEntity) && controlState === "off"),
    now: Number.isFinite(options.now) ? options.now : Date.now(),
    holds: options.holds instanceof Map ? options.holds : runHolds,
  });
  const labels = {
    running: pick("IN FUNZIONE", "RUNNING", locale),
    standby: pick("STANDBY", "STANDBY", locale),
    off: pick("SPENTO", "OFF", locale),
    unavailable: pick("NON DISPONIBILE", "UNAVAILABLE", locale),
  };
  /* L'interruttore mappato serve anche solo a leggere lo stato: chi ha
   * spuntato «senza interruttore» tiene la lettura e perde il tasto. */
  const canControl = Boolean(controlEntity) && device.switch_disabled !== true;
  const controlOn = controlState === "on";
  return Object.freeze({
    id: clean(device.id),
    device,
    name: getDeviceDisplayName(device, states, locale),
    room: rooms.find((room) => room.id === device.room_id) || null,
    visual: getDeviceVisual(device),
    mode,
    label: labels[mode],
    badge: mode,
    watts,
    powerEntity,
    controlEntity,
    stateEntity,
    historyEntity,
    action: Object.freeze({
      visible: canControl,
      entity: controlEntity,
      service: controlOn ? "turn_off" : "turn_on",
      pressed: controlOn,
      label: controlOn ? pick("Spegni", "Turn off", locale) : pick("Accendi", "Turn on", locale),
    }),
    summary: Object.freeze({ mode, label: labels[mode], watts, historyEntity }),
  });
}
