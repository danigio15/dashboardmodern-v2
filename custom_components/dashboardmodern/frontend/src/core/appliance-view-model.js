import { getDeviceDisplayName, getDeviceVisual } from "./device-model.js";

const clean = (value) => String(value || "").trim();
const entityId = (entry) => clean(typeof entry === "string" ? entry : entry?.entity || entry?.entity_id);
const candidates = (device, keys) => [...keys.map((key) => device?.[key]), ...(device?.entities || [])].map(entityId).filter(Boolean);
const numeric = (states, entity) => {
  const value = Number(states?.[entity]?.state);
  return Number.isFinite(value) ? value : null;
};
const unit = (states, entity) => clean(states?.[entity]?.attributes?.unit_of_measurement).toLowerCase();

export function createApplianceViewModel(device = {}, states = {}, rooms = [], locale = "it") {
  const powerEntity = candidates(device, ["power_entity", "power", "power_sensor"])
    .find((id) => /^(w|kw|mw|watt|watts)$/.test(unit(states, id).replaceAll(" ", ""))) || "";
  const controlEntity = candidates(device, ["control_entity", "switch_entity", "switch", "light", "fan"])
    .find((id) => /^(switch|light|input_boolean|fan)\./.test(id)) || "";
  const stateEntity = candidates(device, ["state_entity", "status_entity"])
    .find((id) => Boolean(states?.[id])) || "";
  const inferredEnergy = candidates(device, ["total_energy_entity", "energy_entity", "monthly_energy_entity", "daily_energy_entity"])
    .find((id) => /^(wh|kwh|mwh)$/.test(unit(states, id))) || "";
  const historyEntity = clean(device.history_entity || device.total_energy_entity || device.energy_entity || device.monthly_energy_entity || inferredEnergy || powerEntity);
  const rawPower = numeric(states, powerEntity);
  const watts = rawPower == null ? null : unit(states, powerEntity) === "kw" ? rawPower * 1000 : unit(states, powerEntity) === "mw" ? rawPower * 1_000_000 : rawPower;
  const controlState = clean(states?.[controlEntity]?.state).toLowerCase();
  const configuredState = clean(states?.[stateEntity]?.state).toLowerCase();
  const effectiveState = configuredState || controlState;
  const unavailable = [powerEntity, controlEntity, stateEntity].filter(Boolean).some((id) => ["unknown", "unavailable"].includes(clean(states?.[id]?.state).toLowerCase()));
  const run = Number.isFinite(Number(device.threshold_run)) ? Number(device.threshold_run) : 5;
  const standby = Number.isFinite(Number(device.threshold_standby)) ? Number(device.threshold_standby) : 1;
  const operational = ["playing", "heat", "cool", "open", "opening", "running", "active"].includes(effectiveState)
    || (Boolean(stateEntity) && configuredState === "on");
  const explicitlyOff = Boolean(stateEntity) && ["off", "closed", "stopped"].includes(configuredState);
  const mode = unavailable && watts == null
    ? "unavailable"
    : explicitlyOff
      ? "off"
      : operational || (watts != null && watts >= run)
        ? "running"
        : controlState === "on" || (watts != null && watts >= standby)
          ? "standby"
          : "off";
  const labels = locale === "en"
    ? { running: "RUNNING", standby: "STANDBY", off: "OFF", unavailable: "UNAVAILABLE" }
    : { running: "IN FUNZIONE", standby: "STANDBY", off: "SPENTO", unavailable: "NON DISPONIBILE" };
  const canControl = Boolean(controlEntity);
  const controlOn = controlState === "on";
  return Object.freeze({
    id: clean(device.id), device, name: getDeviceDisplayName(device, states, locale),
    room: rooms.find((room) => room.id === device.room_id) || null,
    visual: getDeviceVisual(device), mode, label: labels[mode], badge: mode,
    watts, powerEntity, controlEntity, stateEntity, historyEntity,
    action: Object.freeze({ visible: canControl, entity: controlEntity, service: controlOn ? "turn_off" : "turn_on", pressed: controlOn, label: locale === "en" ? (controlOn ? "Turn off" : "Turn on") : (controlOn ? "Spegni" : "Accendi") }),
    summary: Object.freeze({ mode, label: labels[mode], watts, historyEntity }),
  });
}
