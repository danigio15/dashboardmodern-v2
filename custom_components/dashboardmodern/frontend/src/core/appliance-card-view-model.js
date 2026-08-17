// DM-FIX-20260816A
/* Pure view-model for the appliance showcase card.
 *
 * Everything the new Elettrodomestici card renders — countdown ring,
 * temperature strip, power meter, "ultimo ciclo" footer, alarm flag — is
 * computed here from the persisted device config, the states snapshot and an
 * optional tracked cycle record. No DOM access, so the whole contract is unit
 * testable and shared verbatim by the Italian and English dashboards.
 */
import { canonicalArtworkType } from "./appliance-artwork.js";
import { createApplianceViewModel } from "./appliance-view-model.js";

const clean = (value) => String(value ?? "").trim();
const entityRef = (value) =>
  clean(typeof value === "string" ? value : value?.entity || value?.entity_id);
const finiteOrNull = (value) => {
  if (value === "" || value == null) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};
const clamp01 = (value) => Math.min(1, Math.max(0, value));

/* Typical peak draw per appliance type: used to scale the power bar when the
 * user has not configured an explicit max_power. */
export const APPLIANCE_DEFAULT_MAX_WATTS = Object.freeze({
  washer: 2200,
  dishwasher: 2200,
  dryer: 2600,
  oven: 2800,
  microwave: 1200,
  fridge: 300,
  boiler: 1500,
  cooktop: 3500,
  television: 250,
  hood: 300,
  iron: 2400,
  vacuum: 900,
  "robot-vacuum": 80,
  "air-conditioner": 2200,
  fan: 120,
  coffee: 1400,
  toaster: 1000,
  kettle: 2200,
  generic: 2000,
});

const HEAT_TYPES = new Set(["oven", "cooktop", "boiler", "iron", "toaster", "kettle", "coffee"]);
const COLD_TYPES = new Set(["fridge", "air-conditioner", "fan"]);
const WATER_TYPES = new Set(["washer", "dishwasher"]);

export function applianceAccent(artworkType) {
  const type = clean(artworkType);
  if (HEAT_TYPES.has(type) || type === "dryer") return "heat";
  if (COLD_TYPES.has(type)) return "cold";
  if (WATER_TYPES.has(type)) return "water";
  return "neutral";
}

export function isFreezerDevice(device = {}) {
  return /congel|freez/i.test(
    [device.visual_key, device.device_type, device.type, device.icon, device.name]
      .map(clean)
      .join(" "),
  );
}

export function isContinuousDevice(artworkType, device = {}) {
  return clean(artworkType) === "fridge" || isFreezerDevice(device);
}

/* ── parsing ─────────────────────────────────────────────────────────── */

export function parseDurationSeconds(value, unit = "") {
  const raw = clean(value);
  if (!raw || /^(unknown|unavailable|none|null|idle)$/i.test(raw)) return null;
  let match = raw.match(/^(\d{1,3}):(\d{2}):(\d{2})$/);
  if (match) return +match[1] * 3600 + +match[2] * 60 + +match[3];
  match = raw.match(/^(\d{1,3}):(\d{2})$/);
  if (match) return +match[1] * 3600 + +match[2] * 60;
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return null;
  const normalizedUnit = clean(unit).toLowerCase();
  if (/^(s|sec|secs|second|seconds)$/.test(normalizedUnit)) return Math.max(0, Math.round(numeric));
  if (/^(h|hr|hrs|hour|hours)$/.test(normalizedUnit))
    return Math.max(0, Math.round(numeric * 3600));
  if (/^(ms|millisecond|milliseconds)$/.test(normalizedUnit))
    return Math.max(0, Math.round(numeric / 1000));
  return Math.max(0, Math.round(numeric * 60));
}

export function parseTimestampMs(value) {
  const raw = clean(value);
  if (!raw || /^(unknown|unavailable|none|null)$/i.test(raw)) return null;
  if (/^\d{10}(\.\d+)?$/.test(raw)) return Math.round(Number(raw) * 1000);
  if (/^\d{13}$/.test(raw)) return Number(raw);
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/* ── formatting (dot decimals, as the reference design) ──────────────── */

export function formatClockDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.round((total - hours * 3600) / 60);
  if (minutes === 60) return `${hours + 1}:00`;
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

export function formatMinutesLabel(minutes, locale = "it") {
  const value = finiteOrNull(minutes);
  if (value == null || value < 0) return "—";
  const rounded = Math.round(value);
  if (rounded < 60) return `${rounded}min`;
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  if (!rest) return locale === "en" ? `${hours}h` : `${hours}h`;
  return `${hours}h ${rest}min`;
}

export function formatPowerLabel(watts) {
  const numeric = Number(watts);
  if (!Number.isFinite(numeric)) return "0 W";
  const value = Math.max(0, numeric);
  if (value >= 1000) {
    const digits = value >= 10000 ? 1 : 2;
    return `${(value / 1000).toFixed(digits).replace(/0+$/, "").replace(/\.$/, "")} kW`;
  }
  if (value > 0 && value < 10) return `${value.toFixed(1).replace(/\.0$/, "")} W`;
  return `${Math.round(value)} W`;
}

export function formatKwhLabel(kwh) {
  const value = finiteOrNull(kwh);
  if (value == null) return "—";
  if (value >= 10) return `${value.toFixed(1)} kWh`;
  return `${value.toFixed(2)} kWh`;
}

export function formatCostLabel(cost) {
  const value = finiteOrNull(cost);
  if (value == null) return "—";
  return `${value.toFixed(2)} €`;
}

export function formatStartLabel(startMs, now, locale = "it") {
  const start = finiteOrNull(startMs);
  const reference = finiteOrNull(now);
  if (start == null || reference == null) return "—";
  const startDate = new Date(start);
  const nowDate = new Date(reference);
  const dayStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate());
  const clock = `${String(startDate.getHours()).padStart(2, "0")}:${String(
    startDate.getMinutes(),
  ).padStart(2, "0")}`;
  if (start >= dayStart.getTime()) return `${locale === "en" ? "today" : "oggi"} ${clock}`;
  if (start >= dayStart.getTime() - 86400000)
    return `${locale === "en" ? "yesterday" : "ieri"} ${clock}`;
  const day = String(startDate.getDate()).padStart(2, "0");
  const month = String(startDate.getMonth() + 1).padStart(2, "0");
  return `${day}/${month} ${clock}`;
}

/* ── data extraction ─────────────────────────────────────────────────── */

function stateSnapshot(states, reference) {
  const entity = entityRef(reference);
  return entity ? states?.[entity] || null : null;
}

function numericState(states, reference) {
  const snapshot = stateSnapshot(states, reference);
  return snapshot ? finiteOrNull(snapshot.state) : null;
}

export function dailyEnergyKwh(device = {}, states = {}) {
  for (const reference of [device.daily_energy_entity, device.energy_today, device.daily_energy]) {
    const snapshot = stateSnapshot(states, reference);
    if (!snapshot) continue;
    const numeric = finiteOrNull(snapshot.state);
    if (numeric == null) continue;
    const unit = clean(snapshot.attributes?.unit_of_measurement).toLowerCase();
    if (unit === "wh") return Math.max(0, numeric / 1000);
    if (unit === "mwh") return Math.max(0, numeric * 1000);
    if (unit && unit !== "kwh") continue;
    return Math.max(0, numeric);
  }
  return null;
}

export function remainingInfo(device = {}, states = {}, now = 0, record = null) {
  const snapshot = stateSnapshot(states, device.remaining_entity);
  let seconds = null;
  if (snapshot) {
    const unit = clean(snapshot.attributes?.unit_of_measurement);
    const deviceClass = clean(snapshot.attributes?.device_class).toLowerCase();
    const raw = clean(snapshot.state);
    if (deviceClass === "timestamp" || /^\d{4}-\d{2}-\d{2}[T ]/.test(raw)) {
      const end = parseTimestampMs(raw);
      if (end != null && finiteOrNull(now) != null)
        seconds = Math.max(0, Math.round((end - now) / 1000));
    } else {
      seconds = parseDurationSeconds(raw, unit);
    }
  }
  let totalSeconds = null;
  const cycleMinutes = finiteOrNull(device.cycle_minutes);
  if (cycleMinutes != null && cycleMinutes > 0) totalSeconds = Math.round(cycleMinutes * 60);
  if (totalSeconds == null) {
    const durationSnapshot = stateSnapshot(states, device.cycle_duration_entity);
    if (durationSnapshot)
      totalSeconds = parseDurationSeconds(
        durationSnapshot.state,
        clean(durationSnapshot.attributes?.unit_of_measurement),
      );
  }
  if (totalSeconds == null && seconds != null) {
    const tracked = finiteOrNull(record?.active?.maxRemainingSeconds);
    if (tracked != null && tracked >= seconds) totalSeconds = tracked;
  }
  const fraction =
    seconds != null && totalSeconds != null && totalSeconds > 0
      ? clamp01(seconds / totalSeconds)
      : null;
  return {
    seconds,
    totalSeconds,
    fraction,
    label: seconds != null ? formatClockDuration(seconds) : "",
  };
}

export function temperatureInfo(device = {}, states = {}) {
  let snapshot = stateSnapshot(states, device.temperature_entity);
  if (!snapshot) {
    for (const reference of device.entities || []) {
      const candidate = stateSnapshot(states, reference);
      const unit = clean(candidate?.attributes?.unit_of_measurement);
      if (candidate && /^°?[CF]$/i.test(unit) && finiteOrNull(candidate.state) != null) {
        snapshot = candidate;
        break;
      }
    }
  }
  if (!snapshot) return null;
  const value = finiteOrNull(snapshot.state);
  if (value == null) return null;
  const unit = clean(snapshot.attributes?.unit_of_measurement) || "°C";
  const freezer = isFreezerDevice(device);
  const min = finiteOrNull(device.temp_min) ?? (freezer ? -25 : 0);
  const max = finiteOrNull(device.temp_max) ?? (freezer ? -10 : 10);
  const fraction = max > min ? clamp01((value - min) / (max - min)) : null;
  const rounded = Math.round(value * 10) / 10;
  return {
    value,
    unit,
    min,
    max,
    fraction,
    label: `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded} ${unit}`,
  };
}

export function powerInfo(device = {}, watts, artworkType) {
  const max =
    finiteOrNull(device.max_power) ??
    APPLIANCE_DEFAULT_MAX_WATTS[clean(artworkType)] ??
    APPLIANCE_DEFAULT_MAX_WATTS.generic;
  const value = finiteOrNull(watts);
  return {
    watts: value,
    max,
    fraction: value != null && max > 0 ? clamp01(value / max) : 0,
    label: formatPowerLabel(value ?? 0),
  };
}

export function lastCycleInfo(device = {}, states = {}, options = {}) {
  const { now = 0, locale = "it", record = null, priceKwh = null, dailyKwh = null } = options;
  const continuous = Boolean(options.continuous);
  const price = finiteOrNull(device.price_kwh) ?? finiteOrNull(priceKwh);

  const active = record?.active;
  const last = record?.last;
  const running = Boolean(options.running);
  const trackerStart = running && active ? active.startMs : last?.startMs;
  const trackerEnd = running && active ? finiteOrNull(now) : last?.endMs;

  let startMs = null;
  const startSnapshot = stateSnapshot(states, device.last_start_entity);
  if (startSnapshot) startMs = parseTimestampMs(startSnapshot.state);
  if (startMs == null) startMs = finiteOrNull(trackerStart);

  let durationMinutes = null;
  const durationSnapshot = stateSnapshot(states, device.last_duration_entity);
  if (durationSnapshot) {
    const seconds = parseDurationSeconds(
      durationSnapshot.state,
      clean(durationSnapshot.attributes?.unit_of_measurement),
    );
    if (seconds != null) durationMinutes = seconds / 60;
  }
  if (durationMinutes == null && !continuous) {
    const start = finiteOrNull(trackerStart);
    const end = finiteOrNull(trackerEnd);
    if (start != null && end != null && end >= start) durationMinutes = (end - start) / 60000;
  }

  let kwh = numericState(states, device.last_energy_entity);
  if (kwh == null) {
    if (running && active) {
      const dailyDelta =
        finiteOrNull(active.lastDailyKwh) != null && finiteOrNull(active.startDailyKwh) != null
          ? active.lastDailyKwh - active.startDailyKwh
          : null;
      kwh =
        dailyDelta != null && dailyDelta >= 0.0005
          ? dailyDelta
          : finiteOrNull(active.kwhIntegral) > 0.0005
            ? active.kwhIntegral
            : null;
    } else if (last) {
      kwh = finiteOrNull(last.kwh);
    }
  }
  if (kwh == null && continuous) kwh = finiteOrNull(dailyKwh);

  let cost = numericState(states, device.last_cost_entity);
  if (cost == null && kwh != null && price != null) cost = kwh * price;

  return {
    startMs,
    durationMinutes,
    kwh,
    cost,
    live: running && Boolean(active),
    startLabel: formatStartLabel(startMs, now, locale),
    durationLabel:
      continuous && durationMinutes == null ? "—" : formatMinutesLabel(durationMinutes, locale),
    energyLabel: formatKwhLabel(kwh),
    costLabel: formatCostLabel(cost),
  };
}

export function applianceAlarm(device = {}, states = {}, mode = "") {
  if (mode === "unavailable") return true;
  const snapshot = stateSnapshot(states, device.alert_entity);
  if (!snapshot) return false;
  return /^(on|problem|triggered|alert|alarm|fault|error|leak|open)$/i.test(clean(snapshot.state));
}

export function applianceArtworkType(device = {}) {
  return (
    canonicalArtworkType(
      clean(device.visual_key || device.device_type || device.type || device.icon || device.name),
    ) || "generic"
  );
}

/* ── card model ──────────────────────────────────────────────────────── */

export function applianceCardModel(device = {}, states = {}, options = {}) {
  const { rooms = [], locale = "it", now = 0, priceKwh = null, record = null, index = 0 } = options;
  const base = createApplianceViewModel(device, states, rooms, locale);
  const artworkType = applianceArtworkType(device);
  const continuous = isContinuousDevice(artworkType, device);
  const running = base.mode === "running";
  const remaining = running
    ? remainingInfo(device, states, now, record)
    : remainingInfo(device, states, now, null);
  const temperature = temperatureInfo(device, states);
  const daily = dailyEnergyKwh(device, states);
  return Object.freeze({
    ...base,
    index,
    artworkType,
    accent: applianceAccent(artworkType),
    freezer: isFreezerDevice(device),
    continuous,
    running,
    remaining: running ? remaining : { ...remaining, seconds: null, fraction: null, label: "" },
    temperature,
    power: powerInfo(device, base.watts, artworkType),
    cycle: lastCycleInfo(device, states, {
      now,
      locale,
      record,
      priceKwh,
      dailyKwh: daily,
      continuous,
      running,
    }),
    alarm: applianceAlarm(device, states, base.mode),
    dailyKwh: daily,
  });
}
