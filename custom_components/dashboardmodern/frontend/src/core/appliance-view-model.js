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

const semanticStateValues = new Set([
  "playing",
  "heat",
  "cool",
  "open",
  "opening",
  "running",
  "active",
  "off",
  "closed",
  "stopped",
  "idle",
  "standby",
  "ready",
  "pronta",
  "pronto",
]);

function inferSemanticStateEntity(device = {}, states = {}) {
  const entries = (device?.entities || []).map(entityId).filter(Boolean);

  // Prefer explicit state/status-like sensors whose current value already has
  // a clear semantic meaning (e.g. sensor.lavasciuga_state = "running").
  const semanticSensor = entries.find((id) => {
    if (!/^(sensor|binary_sensor)\./.test(id)) return false;
    if (!/(?:^|[._-])(state|status|phase|fase)(?:[._-]|$)/i.test(id)) return false;
    const value = clean(states?.[id]?.state).toLowerCase();
    return semanticStateValues.has(value);
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

  const explicitRunning =
    ["playing", "heat", "cool", "open", "opening", "running", "active"].includes(configuredState) ||
    (activityBinary && configuredState === "on");

  const explicitlyOff =
    Boolean(stateEntity) &&
    (["off", "closed", "stopped", "idle"].includes(configuredState) ||
      (activityBinary && configuredState === "off"));
  const genericOn = configuredState === "on" || controlState === "on";
  const sampledMode =
    unavailable && watts == null
      ? "unavailable"
      : explicitlyOff && !(watts != null && watts >= run)
        ? "off"
        : explicitRunning || (watts != null && watts >= run)
          ? "running"
          : genericOn || (watts != null && watts >= standby)
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
  const canControl = Boolean(controlEntity);
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
