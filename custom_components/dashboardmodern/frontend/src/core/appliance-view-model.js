// DM-FIX-20260812B
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
  return "running";
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
  // A generic entry in device.entities must never silently become the semantic
  // state/status entity. In particular a control switch left ON at 0 W was
  // previously interpreted as an explicit running state.
  const stateEntity =
    explicitCandidates(device, ["state_entity", "status_entity"]).find((id) =>
      Boolean(states?.[id]),
    ) || "";
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
  const explicitRunning = [
    "playing",
    "heat",
    "cool",
    "open",
    "opening",
    "running",
    "active",
  ].includes(configuredState);
  const explicitlyOff =
    Boolean(stateEntity) && ["off", "closed", "stopped", "idle"].includes(configuredState);
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
