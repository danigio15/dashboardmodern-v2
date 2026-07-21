import { fieldError, textInput } from "../editor/dashboard-form.js";
import { el } from "../render/dom.js";

export const CLIMATE_CONTROL_TYPE = "climate-control";
export const LIGHT_CONTROL_TYPE = "light-control";
export const SWITCH_CONTROL_TYPE = "switch-control";
export const COVER_CONTROL_TYPE = "cover-control";
export const SENSOR_STATUS_TYPE = "sensor-status";

const ENTITY_RE = /^[a-z0-9_]+\.[a-z0-9_]+$/;
const UNSAFE_RE = /\{\{|\}\}|\{%|%\}|<script|javascript:|data:text\/html|\bon\w+\s*=|<iframe/i;
const BAD = new Set(["", "unknown", "unavailable"]);
const HVAC_MODES = Object.freeze(["off", "heat", "cool", "heat_cool", "auto", "dry", "fan_only"]);
const SECONDARY = Object.freeze(["none", "friendly_name", "last_changed"]);

function defaultEntityConfig(extra = {}) { return { entityId: "", ...extra }; }
export const defaultClimateControlConfig = () => defaultEntityConfig({ temperatureStep: 1 });
export const defaultLightControlConfig = () => defaultEntityConfig({ showBrightness: true });
export const defaultSwitchControlConfig = () => defaultEntityConfig({ secondaryInfo: "none" });
export const defaultCoverControlConfig = () => defaultEntityConfig({ showPosition: true });
export const defaultSensorStatusConfig = () => defaultEntityConfig({ secondaryInfo: "none" });

function configErrors(config, { booleans = [], numbers = {}, enums = {} } = {}) {
  const errors = [];
  if (!config || typeof config !== "object" || Array.isArray(config)) return [{ field: "config", message: "Config must be an object." }];
  if (typeof config.entityId !== "string") errors.push({ field: "config.entityId", message: "entityId must be a string." });
  else if (!config.entityId.trim()) errors.push({ field: "config.entityId", message: "entityId is required." });
  else if (UNSAFE_RE.test(config.entityId)) errors.push({ field: "config.entityId", message: "entityId cannot contain templates or executable expressions." });
  else if (!ENTITY_RE.test(config.entityId)) errors.push({ field: "config.entityId", message: "entityId must be a plain Home Assistant entity ID." });
  for (const key of booleans) if (typeof config[key] !== "boolean") errors.push({ field: `config.${key}`, message: `${key} must be a boolean.` });
  for (const [key, [min, max]] of Object.entries(numbers)) if (typeof config[key] !== "number" || !Number.isFinite(config[key]) || config[key] < min || config[key] > max) errors.push({ field: `config.${key}`, message: `${key} must be a number from ${min} to ${max}.` });
  for (const [key, allowed] of Object.entries(enums)) if (typeof config[key] !== "string" || !allowed.includes(config[key])) errors.push({ field: `config.${key}`, message: `${key} must be one of: ${allowed.join(", ")}.` });
  return errors;
}
export const validateClimateControlConfig = (config) => configErrors(config, { numbers: { temperatureStep: [0.1, 10] } });
export const validateLightControlConfig = (config) => configErrors(config, { booleans: ["showBrightness"] });
export const validateSwitchControlConfig = (config) => configErrors(config, { enums: { secondaryInfo: SECONDARY } });
export const validateCoverControlConfig = (config) => configErrors(config, { booleans: ["showPosition"] });
export const validateSensorStatusConfig = (config) => configErrors(config, { enums: { secondaryInfo: SECONDARY } });

function stateObj(runtime, entityId) {
  if (!entityId || !ENTITY_RE.test(entityId) || UNSAFE_RE.test(entityId)) return { status: "missing-config", entity: null, raw: "" };
  const entity = runtime.getEntityState?.(entityId);
  if (!entity || typeof entity !== "object" || Array.isArray(entity)) return { status: "missing-entity", entity: null, raw: "" };
  const raw = String(entity.state ?? "").trim();
  if (BAD.has(raw)) return { status: raw || "unavailable", entity, raw };
  return { status: "ok", entity, raw };
}
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function unit(entity) { return String(entity?.attributes?.unit_of_measurement || entity?.attributes?.temperature_unit || "").trim(); }
function fmt(runtime, value, suffix = "") { return value === null ? "Unavailable" : `${new Intl.NumberFormat(runtime.locale || "en-US", { maximumFractionDigits: 1 }).format(value)}${suffix ? ` ${suffix}` : ""}`; }
function button(label, disabled, fn) { const b = el("button", { text: label, attrs: { type: "button", "aria-label": label, disabled: disabled ? "" : null } }); if (!disabled) b.addEventListener("click", fn); return b; }
function call(runtime, domain, service, data) { if (typeof runtime.callService !== "function") return; runtime.callService(domain, service, data); }
function card(kind, title, status) { const a = el("article", { className: `dashboardmodern-card dm-device-card dm-${kind}`, attrs: { "data-card-kind": kind, "data-status": status } }); a.append(el("h3", { className: "section-title", text: title })); return a; }
function unavailableText(status) { return status === "ok" ? "" : status.replace("-", " "); }

export function normalizeClimate(runtime = {}, config = {}) {
  const s = stateObj(runtime, config.entityId); const a = s.entity?.attributes || {}; const current = num(a.current_temperature ?? s.raw); const target = num(a.temperature); const hum = num(a.current_humidity ?? a.humidity); const modes = Array.isArray(a.hvac_modes) ? a.hvac_modes.filter((m) => HVAC_MODES.includes(m)) : [];
  return { ...s, entityId: config.entityId, current, target, humidity: hum, unit: unit(s.entity), mode: s.raw, action: String(a.hvac_action || ""), modes, step: num(config.temperatureStep) || num(a.target_temp_step) || 1, malformed: s.status === "ok" && (current === null || (a.temperature !== undefined && target === null)) };
}
export function renderClimateControlCard(cardDef, runtime = {}) { const n = normalizeClimate(runtime, cardDef.config); const disabled = n.status !== "ok" || n.malformed; const shell = card(CLIMATE_CONTROL_TYPE, cardDef.title || "Climate", disabled ? (n.malformed ? "malformed" : n.status) : "ok"); shell.append(el("p", { text: disabled ? `Unavailable: ${n.malformed ? "malformed" : unavailableText(n.status)}` : `Current ${fmt(runtime, n.current, n.unit)} · Target ${fmt(runtime, n.target, n.unit)} · Mode ${n.mode} · Action ${n.action || "none"}${n.humidity === null ? "" : ` · Humidity ${fmt(runtime, n.humidity, "%")}`}` })); const controls = el("div", { className: "dm-device-controls" }); const sel = el("select", { attrs: { "aria-label": `HVAC mode for ${cardDef.config.entityId}`, disabled: disabled || !n.modes.length ? "" : null } }); n.modes.forEach((m) => { const o = el("option", { text: m, attrs: { value: m } }); if (m === n.mode) o.selected = true; sel.append(o); }); if (!disabled && n.modes.length) sel.addEventListener("change", () => call(runtime, "climate", "set_hvac_mode", { entity_id: n.entityId, hvac_mode: sel.value })); controls.append(sel, button("Decrease target temperature", disabled || n.target === null, () => call(runtime, "climate", "set_temperature", { entity_id: n.entityId, temperature: n.target - n.step })), button("Increase target temperature", disabled || n.target === null, () => call(runtime, "climate", "set_temperature", { entity_id: n.entityId, temperature: n.target + n.step }))); shell.append(controls); return shell; }

export function normalizeLight(runtime = {}, config = {}) { const s = stateObj(runtime, config.entityId); const b = num(s.entity?.attributes?.brightness); return { ...s, entityId: config.entityId, on: s.raw === "on", brightness: b !== null && b >= 0 && b <= 255 ? b : null, brightnessStatus: b === null ? "missing" : b < 0 || b > 255 ? "malformed" : "ok" }; }
export function renderLightControlCard(cardDef, runtime = {}) { const n = normalizeLight(runtime, cardDef.config); const disabled = n.status !== "ok"; const shell = card(LIGHT_CONTROL_TYPE, cardDef.title || "Light", disabled ? n.status : "ok"); shell.append(el("p", { text: disabled ? `Unavailable: ${unavailableText(n.status)}` : `State ${n.on ? "on" : "off"}` })); shell.append(button(`Toggle ${cardDef.config.entityId}`, disabled, () => call(runtime, "light", "toggle", { entity_id: n.entityId }))); if (cardDef.config.showBrightness && n.brightness !== null) { const r = el("input", { attrs: { type: "range", min: "0", max: "255", value: String(n.brightness), "aria-label": `Brightness for ${n.entityId}`, disabled: disabled ? "" : null } }); if (!disabled) r.addEventListener("change", () => call(runtime, "light", "turn_on", { entity_id: n.entityId, brightness: Number(r.value) })); shell.append(r, el("p", { text: `Brightness ${Math.round((n.brightness / 255) * 100)}%` })); } return shell; }

export function renderSwitchControlCard(cardDef, runtime = {}) { const n = stateObj(runtime, cardDef.config.entityId); const disabled = n.status !== "ok"; const shell = card(SWITCH_CONTROL_TYPE, cardDef.title || "Switch", disabled ? n.status : "ok"); shell.append(el("p", { text: disabled ? `Unavailable: ${unavailableText(n.status)}` : `State ${n.raw}` })); if (cardDef.config.secondaryInfo === "friendly_name") shell.append(el("p", { text: String(n.entity?.attributes?.friendly_name || "") })); shell.append(button(`Toggle ${cardDef.config.entityId}`, disabled, () => call(runtime, "switch", "toggle", { entity_id: cardDef.config.entityId }))); return shell; }

export function normalizeCover(runtime = {}, config = {}) { const s = stateObj(runtime, config.entityId); const p = num(s.entity?.attributes?.current_position); return { ...s, entityId: config.entityId, position: p !== null && p >= 0 && p <= 100 ? p : null }; }
export function renderCoverControlCard(cardDef, runtime = {}) { const n = normalizeCover(runtime, cardDef.config); const disabled = n.status !== "ok"; const shell = card(COVER_CONTROL_TYPE, cardDef.title || "Cover", disabled ? n.status : "ok"); shell.append(el("p", { text: disabled ? `Unavailable: ${unavailableText(n.status)}` : `State ${n.raw}${cardDef.config.showPosition && n.position !== null ? ` · Position ${n.position}%` : ""}` })); shell.append(button(`Open ${n.entityId}`, disabled, () => call(runtime, "cover", "open_cover", { entity_id: n.entityId })), button(`Close ${n.entityId}`, disabled, () => call(runtime, "cover", "close_cover", { entity_id: n.entityId })), button(`Stop ${n.entityId}`, disabled, () => call(runtime, "cover", "stop_cover", { entity_id: n.entityId }))); return shell; }

export function renderSensorStatusCard(cardDef, runtime = {}) { const n = stateObj(runtime, cardDef.config.entityId); const shell = card(SENSOR_STATUS_TYPE, cardDef.title || "Sensor", n.status); const v = n.status === "ok" ? String(n.raw) : "Unavailable"; shell.append(el("p", { text: `${v}${n.status === "ok" && unit(n.entity) ? ` ${unit(n.entity)}` : ""}` })); if (cardDef.config.secondaryInfo === "friendly_name") shell.append(el("p", { text: String(n.entity?.attributes?.friendly_name || "") })); return shell; }

function boolInput(documentRef, labelText, value, onChange, fieldId) { const l = documentRef.createElement("label"); l.textContent = `${labelText} `; const i = documentRef.createElement("input"); i.type = "checkbox"; i.checked = Boolean(value); i.dataset.editorField = fieldId; i.addEventListener("change", () => onChange(i.checked)); l.append(i); return l; }
function selectInput(documentRef, labelText, value, options, onChange, fieldId) { const l = documentRef.createElement("label"); l.textContent = `${labelText} `; const s = documentRef.createElement("select"); s.dataset.editorField = fieldId; options.forEach((v) => { const o = documentRef.createElement("option"); o.value = v; o.textContent = v; o.selected = v === value; s.append(o); }); s.addEventListener("change", () => onChange(s.value)); l.append(s); return l; }
function editor(extra = []) { return (documentRef, cardDef, controller, errors = []) => { const form = documentRef.createElement("section"); form.className = "dashboardmodern-plugin-editor"; form.append(textInput(documentRef, "Entity ID", cardDef.config?.entityId || "", (entityId) => controller.updateCardConfigPatch(cardDef.id, { entityId }), `card:${cardDef.id}:config.entityId`)); for (const field of extra) form.append(field(documentRef, cardDef, controller)); errors.forEach((e) => form.append(fieldError(documentRef, e.message))); return form; }; }
export const renderClimateControlEditor = editor([(d, c, ctl) => textInput(d, "Temperature step", String(c.config?.temperatureStep ?? 1), (v) => ctl.updateCardConfigPatch(c.id, { temperatureStep: Number(v) }), `card:${c.id}:config.temperatureStep`)]);
export const renderLightControlEditor = editor([(d, c, ctl) => boolInput(d, "Show brightness", c.config?.showBrightness, (showBrightness) => ctl.updateCardConfigPatch(c.id, { showBrightness }), `card:${c.id}:config.showBrightness`)]);
export const renderSwitchControlEditor = editor([(d, c, ctl) => selectInput(d, "Secondary info", c.config?.secondaryInfo || "none", SECONDARY, (secondaryInfo) => ctl.updateCardConfigPatch(c.id, { secondaryInfo }), `card:${c.id}:config.secondaryInfo`)]);
export const renderCoverControlEditor = editor([(d, c, ctl) => boolInput(d, "Show position", c.config?.showPosition, (showPosition) => ctl.updateCardConfigPatch(c.id, { showPosition }), `card:${c.id}:config.showPosition`)]);
export const renderSensorStatusEditor = renderSwitchControlEditor;
