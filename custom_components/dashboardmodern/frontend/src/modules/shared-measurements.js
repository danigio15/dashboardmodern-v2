const BAD = new Set(["unknown", "unavailable", ""]);
export const ENTITY_RE = /^[a-z0-9_]+\.[a-z0-9_]+$/;
const POWER = { W: 1, kW: 1000, MW: 1000000 };
const ENERGY = { Wh: 1, kWh: 1000, MWh: 1000000 };
const PERCENT = new Set(["%", "percent"]);

export function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }
export function parseFiniteNumber(value) {
  if (value === null || value === undefined) return { ok: false, reason: "missing" };
  const text = String(value).trim();
  if (BAD.has(text)) return { ok: false, reason: text || "empty" };
  const numeric = Number(text);
  return Number.isFinite(numeric) ? { ok: true, value: numeric } : { ok: false, reason: "malformed" };
}
export function convertUnit(value, from, to, kind) {
  const table = kind === "energy" ? ENERGY : POWER;
  if (!Number.isFinite(value)) return { ok: false, reason: "malformed" };
  if (!table[from] || !table[to]) return { ok: false, reason: "incompatible-unit", from, to };
  return { ok: true, value: value * table[from] / table[to], unit: to };
}
export function safePercentage(part, total) {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return { ok: false, reason: "division-by-zero" };
  return { ok: true, value: clamp(part / total * 100, 0, 100) };
}
export function formatNumber(value, { locale = "en-US", precision = 1, unit = "" } = {}) {
  if (!Number.isFinite(value)) return "Unavailable";
  return `${value.toLocaleString(locale, { minimumFractionDigits: precision, maximumFractionDigits: precision })}${unit ? ` ${unit}` : ""}`;
}
export function evaluateTimestamp(lastUpdated, staleAfterMs, now = Date.now(), futureToleranceMs = 5000) {
  if (!lastUpdated) return { stale: false, future: false, invalid: false, reason: "timestamp-missing" };
  const time = new Date(lastUpdated).getTime();
  if (!Number.isFinite(time)) return { stale: false, future: false, invalid: true, reason: "timestamp-invalid" };
  if (time - now > Number(futureToleranceMs ?? 5000)) return { stale: false, future: true, invalid: false, reason: "timestamp-future" };
  if (Number.isFinite(staleAfterMs) && staleAfterMs > 0 && now - time > staleAfterMs) return { stale: true, future: false, invalid: false, reason: "timestamp-stale" };
  return { stale: false, future: false, invalid: false, reason: time > now ? "timestamp-ok-clock-skew" : "timestamp-ok" };
}
export const stale = (lastUpdated, maxAgeMs, now = Date.now()) => evaluateTimestamp(lastUpdated, maxAgeMs, now).stale;
function base(entityId, entity, { kind, unit, precision = 1 } = {}) {
  const sourceUnit = entity?.attributes?.unit_of_measurement || unit || "";
  return { entityId, friendlyName: entity?.attributes?.friendly_name || entityId || "", rawState: entity?.state, sourceUnit, normalizedUnit: unit || sourceUnit, deviceClass: entity?.attributes?.device_class || "", stateClass: entity?.attributes?.state_class || "", lastUpdated: entity?.last_updated || entity?.lastUpdated || null, available: false, missing: false, unavailable: false, malformed: false, stale: false, reason: "not-evaluated", normalizedValue: null, precision, displayValue: "Unavailable", kind };
}
export function normalizeMeasurement(runtime = {}, entityId, options = {}) {
  const { kind = "power", unit, precision = 1, staleAfterMs, locale = "en-US", now = Date.now(), futureToleranceMs = 5000 } = options;
  const entity = ENTITY_RE.test(entityId || "") ? runtime.getEntityState?.(entityId) : null;
  const result = base(entityId, entity, { kind, unit, precision });
  if (!entityId) return { ...result, missing: true, reason: "missing-entity-id" };
  if (!ENTITY_RE.test(entityId)) return { ...result, missing: true, reason: "invalid-entity-id" };
  if (!entity) return { ...result, missing: true, reason: "entity-missing" };
  if (BAD.has(String(entity.state ?? "").trim())) return { ...result, unavailable: true, reason: String(entity.state || "empty") };
  const parsed = parseFiniteNumber(entity.state);
  if (!parsed.ok) return { ...result, malformed: true, reason: parsed.reason };
  let value = parsed.value;
  if (kind === "power" || kind === "energy") {
    const converted = convertUnit(value, result.sourceUnit, result.normalizedUnit, kind);
    if (!converted.ok) return { ...result, malformed: true, reason: converted.reason };
    value = converted.value;
  } else if (kind === "percent") {
    if (result.sourceUnit && !PERCENT.has(result.sourceUnit)) return { ...result, normalizedUnit: "%", malformed: true, reason: "incompatible-unit" };
    result.normalizedUnit = "%";
    if (value < 0 || value > 100) return { ...result, normalizedUnit: "%", malformed: true, reason: "percent-out-of-range" };
  } else if (kind === "currency" || kind === "carbon") {
    result.normalizedUnit = unit || result.sourceUnit;
  }
  const timestamp = evaluateTimestamp(result.lastUpdated, staleAfterMs, now, futureToleranceMs);
  if (timestamp.invalid || timestamp.future) return { ...result, malformed: true, reason: timestamp.reason };
  return { ...result, available: !timestamp.stale, stale: timestamp.stale, reason: timestamp.reason, normalizedValue: value, displayValue: formatNumber(value, { locale, precision, unit: result.normalizedUnit }) };
}
