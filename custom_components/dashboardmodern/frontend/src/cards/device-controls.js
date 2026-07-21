import { fieldError, textInput } from "../editor/dashboard-form.js";
import { el } from "../render/dom.js";

export const CLIMATE_CONTROL_TYPE = "climate-control";
export const LIGHT_CONTROL_TYPE = "light-control";
export const SWITCH_CONTROL_TYPE = "switch-control";
export const COVER_CONTROL_TYPE = "cover-control";
export const SENSOR_STATUS_TYPE = "sensor-status";

const ENTITY_RE = /^[a-z0-9_]+\.[a-z0-9_]+$/;
const UNSAFE_RE = /\{\{|\}\}|\{%|%\}|<script|javascript:|data:text\/html|\bon\w+\s*=|<iframe/i;
const BAD_STATES = new Set(["", "unknown", "unavailable"]);
const HVAC_MODES = Object.freeze(["off", "heat", "cool", "heat_cool", "auto", "dry", "fan_only"]);
const SECONDARY_OPTIONS = Object.freeze(["none", "friendly_name", "last_changed"]);
const COVER_FEATURES = Object.freeze({
  open: 1,
  close: 2,
  setPosition: 4,
  stop: 8,
});

function defaultEntityConfig(extra = {}) {
  return { entityId: "", ...extra };
}

export const defaultClimateControlConfig = () => defaultEntityConfig({ temperatureStep: 1 });
export const defaultLightControlConfig = () => defaultEntityConfig({ showBrightness: true });
export const defaultSwitchControlConfig = () => defaultEntityConfig({ secondaryInfo: "none" });
export const defaultCoverControlConfig = () => defaultEntityConfig({ showPosition: true });
export const defaultSensorStatusConfig = () => defaultEntityConfig({ secondaryInfo: "none" });

function configErrors(config, { booleans = [], numbers = {}, enums = {} } = {}) {
  const errors = [];
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return [{ field: "config", message: "Config must be an object." }];
  }

  if (typeof config.entityId !== "string") {
    errors.push({ field: "config.entityId", message: "entityId must be a string." });
  } else if (!config.entityId.trim()) {
    errors.push({ field: "config.entityId", message: "entityId is required." });
  } else if (UNSAFE_RE.test(config.entityId)) {
    errors.push({ field: "config.entityId", message: "entityId cannot contain templates or executable expressions." });
  } else if (!ENTITY_RE.test(config.entityId)) {
    errors.push({ field: "config.entityId", message: "entityId must be a plain Home Assistant entity ID." });
  }

  for (const key of booleans) {
    if (typeof config[key] !== "boolean") {
      errors.push({ field: `config.${key}`, message: `${key} must be a boolean.` });
    }
  }

  for (const [key, [min, max]] of Object.entries(numbers)) {
    if (typeof config[key] !== "number" || !Number.isFinite(config[key]) || config[key] < min || config[key] > max) {
      errors.push({ field: `config.${key}`, message: `${key} must be a number from ${min} to ${max}.` });
    }
  }

  for (const [key, allowed] of Object.entries(enums)) {
    if (typeof config[key] !== "string" || !allowed.includes(config[key])) {
      errors.push({ field: `config.${key}`, message: `${key} must be one of: ${allowed.join(", ")}.` });
    }
  }

  return errors;
}

export const validateClimateControlConfig = (config) => configErrors(config, { numbers: { temperatureStep: [0.1, 10] } });
export const validateLightControlConfig = (config) => configErrors(config, { booleans: ["showBrightness"] });
export const validateSwitchControlConfig = (config) => configErrors(config, { enums: { secondaryInfo: SECONDARY_OPTIONS } });
export const validateCoverControlConfig = (config) => configErrors(config, { booleans: ["showPosition"] });
export const validateSensorStatusConfig = (config) => configErrors(config, { enums: { secondaryInfo: SECONDARY_OPTIONS } });

function entityState(runtime, entityId) {
  if (!entityId || !ENTITY_RE.test(entityId) || UNSAFE_RE.test(entityId)) {
    return { status: "missing-config", entity: null, raw: "" };
  }

  const entity = runtime.getEntityState?.(entityId);
  if (!entity || typeof entity !== "object" || Array.isArray(entity)) {
    return { status: "missing-entity", entity: null, raw: "" };
  }

  const raw = String(entity.state ?? "").trim();
  if (BAD_STATES.has(raw)) {
    return { status: raw || "unavailable", entity, raw };
  }

  return { status: "ok", entity, raw };
}

function parseNumberValue(value) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return { status: "missing", value: null };
  }

  const parsed = Number(String(value).trim().replace(",", "."));
  if (!Number.isFinite(parsed)) {
    return { status: BAD_STATES.has(String(value).trim()) ? String(value).trim() : "malformed", value: null };
  }

  return { status: "ok", value: parsed };
}

function formatValue(runtime, value, suffix = "") {
  if (value === null) return "Unavailable";
  const formatted = new Intl.NumberFormat(runtime.locale || "en-US", { maximumFractionDigits: 1 }).format(value);
  return suffix ? `${formatted} ${suffix}` : formatted;
}

function unit(entity) {
  return String(entity?.attributes?.unit_of_measurement || entity?.attributes?.temperature_unit || "").trim();
}

function hasService(runtime) {
  return typeof runtime.callService === "function";
}

function serviceButton(label, disabled, handler) {
  const node = el("button", {
    text: label,
    attrs: { type: "button", "aria-label": label, disabled: disabled ? "" : null },
  });
  if (!disabled) node.addEventListener("click", handler);
  return node;
}

function call(runtime, domain, service, data) {
  if (!hasService(runtime)) return;
  runtime.callService(domain, service, data);
}

function card(kind, title, status) {
  const node = el("article", {
    className: `dashboardmodern-card dm-device-card dm-${kind}`,
    attrs: { "data-card-kind": kind, "data-status": status },
  });
  node.append(el("h3", { className: "section-title", text: title }));
  return node;
}

function unavailableText(status) {
  return status === "ok" ? "" : status.replace("-", " ");
}

function secondaryInfoNode(entity, secondaryInfo) {
  if (secondaryInfo === "friendly_name") {
    return el("p", { className: "dm-device-secondary", text: String(entity?.attributes?.friendly_name || "") });
  }
  if (secondaryInfo === "last_changed") {
    return el("p", { className: "dm-device-secondary", text: `Last changed: ${String(entity?.last_changed || "Unavailable")}` });
  }
  return null;
}

export function normalizeClimate(runtime = {}, config = {}) {
  const state = entityState(runtime, config.entityId);
  const attributes = state.entity?.attributes || {};
  const current = parseNumberValue(attributes.current_temperature);
  const target = parseNumberValue(attributes.temperature);
  const humidity = parseNumberValue(attributes.current_humidity ?? attributes.humidity);
  const modes = Array.isArray(attributes.hvac_modes)
    ? attributes.hvac_modes.filter((mode) => HVAC_MODES.includes(mode))
    : [];
  const configuredStep = parseNumberValue(config.temperatureStep);
  const attributeStep = parseNumberValue(attributes.target_temp_step);
  const step = configuredStep.status === "ok" ? configuredStep.value : attributeStep.status === "ok" ? attributeStep.value : 1;
  const malformed = state.status === "ok" && (current.status === "malformed" || target.status === "malformed" || humidity.status === "malformed");

  return {
    ...state,
    entityId: config.entityId,
    current,
    target,
    humidity,
    unit: unit(state.entity),
    mode: state.raw,
    action: String(attributes.hvac_action || ""),
    modes,
    step,
    malformed,
  };
}

export function renderClimateControlCard(cardDef, runtime = {}) {
  const normalized = normalizeClimate(runtime, cardDef.config);
  const unavailable = normalized.status !== "ok" || normalized.malformed;
  const serviceUnavailable = !hasService(runtime);
  const disabled = unavailable || serviceUnavailable;
  const shell = card(CLIMATE_CONTROL_TYPE, cardDef.title || "Climate", unavailable ? (normalized.malformed ? "malformed" : normalized.status) : "ok");

  if (unavailable) {
    shell.append(el("p", { text: `Unavailable: ${normalized.malformed ? "malformed" : unavailableText(normalized.status)}` }));
  } else {
    shell.append(el("p", {
      text: `Current ${formatValue(runtime, normalized.current.value, normalized.unit)} · Target ${formatValue(runtime, normalized.target.value, normalized.unit)} · Mode ${normalized.mode} · Action ${normalized.action || "none"}${normalized.humidity.status === "ok" ? ` · Humidity ${formatValue(runtime, normalized.humidity.value, "%")}` : ""}`,
    }));
  }

  const controls = el("div", { className: "dm-device-controls" });
  const modeSelect = el("select", {
    attrs: {
      "aria-label": `HVAC mode for ${cardDef.config.entityId}`,
      disabled: disabled || !normalized.modes.length ? "" : null,
    },
  });
  for (const mode of normalized.modes) {
    const option = el("option", { text: mode, attrs: { value: mode } });
    if (mode === normalized.mode) option.selected = true;
    modeSelect.append(option);
  }
  if (!disabled && normalized.modes.length) {
    modeSelect.addEventListener("change", () => call(runtime, "climate", "set_hvac_mode", { entity_id: normalized.entityId, hvac_mode: modeSelect.value }));
  }

  controls.append(
    modeSelect,
    serviceButton("Decrease target temperature", disabled || normalized.target.status !== "ok", () => call(runtime, "climate", "set_temperature", { entity_id: normalized.entityId, temperature: normalized.target.value - normalized.step })),
    serviceButton("Increase target temperature", disabled || normalized.target.status !== "ok", () => call(runtime, "climate", "set_temperature", { entity_id: normalized.entityId, temperature: normalized.target.value + normalized.step })),
  );
  shell.append(controls);
  return shell;
}

export function normalizeLight(runtime = {}, config = {}) {
  const state = entityState(runtime, config.entityId);
  const brightness = parseNumberValue(state.entity?.attributes?.brightness);
  const brightnessStatus = brightness.status === "ok" && (brightness.value < 0 || brightness.value > 255)
    ? "malformed"
    : brightness.status;

  return {
    ...state,
    entityId: config.entityId,
    on: state.raw === "on",
    brightness: brightnessStatus === "ok" ? brightness.value : null,
    brightnessStatus,
  };
}

export function renderLightControlCard(cardDef, runtime = {}) {
  const normalized = normalizeLight(runtime, cardDef.config);
  const unavailable = normalized.status !== "ok" || normalized.brightnessStatus === "malformed";
  const disabled = unavailable || !hasService(runtime);
  const shell = card(LIGHT_CONTROL_TYPE, cardDef.title || "Light", unavailable ? (normalized.brightnessStatus === "malformed" ? "malformed" : normalized.status) : "ok");

  shell.append(el("p", { text: unavailable ? `Unavailable: ${normalized.brightnessStatus === "malformed" ? "malformed" : unavailableText(normalized.status)}` : `State ${normalized.on ? "on" : "off"}` }));
  shell.append(serviceButton(`Toggle ${cardDef.config.entityId}`, disabled, () => call(runtime, "light", "toggle", { entity_id: normalized.entityId })));

  if (cardDef.config.showBrightness && normalized.brightnessStatus === "ok") {
    const range = el("input", {
      attrs: {
        type: "range",
        min: "0",
        max: "255",
        value: String(normalized.brightness),
        "aria-label": `Brightness for ${normalized.entityId}`,
        disabled: disabled ? "" : null,
      },
    });
    if (!disabled) {
      range.addEventListener("change", () => call(runtime, "light", "turn_on", { entity_id: normalized.entityId, brightness: Number(range.value) }));
    }
    shell.append(range, el("p", { text: `Brightness ${Math.round((normalized.brightness / 255) * 100)}%` }));
  }

  return shell;
}

export function renderSwitchControlCard(cardDef, runtime = {}) {
  const state = entityState(runtime, cardDef.config.entityId);
  const disabled = state.status !== "ok" || !hasService(runtime);
  const shell = card(SWITCH_CONTROL_TYPE, cardDef.title || "Switch", state.status);

  shell.append(el("p", { text: state.status === "ok" ? `State ${state.raw}` : `Unavailable: ${unavailableText(state.status)}` }));
  const secondary = secondaryInfoNode(state.entity, cardDef.config.secondaryInfo);
  if (secondary) shell.append(secondary);
  shell.append(serviceButton(`Toggle ${cardDef.config.entityId}`, disabled, () => call(runtime, "switch", "toggle", { entity_id: cardDef.config.entityId })));
  return shell;
}

function supportedFeatures(entity) {
  const value = Number(entity?.attributes?.supported_features);
  return Number.isFinite(value) ? value : 0;
}

function hasFeature(entity, feature) {
  return (supportedFeatures(entity) & feature) === feature;
}

export function normalizeCover(runtime = {}, config = {}) {
  const state = entityState(runtime, config.entityId);
  const position = parseNumberValue(state.entity?.attributes?.current_position);
  const positionStatus = position.status === "ok" && (position.value < 0 || position.value > 100)
    ? "malformed"
    : position.status;

  return {
    ...state,
    entityId: config.entityId,
    position: positionStatus === "ok" ? position.value : null,
    positionStatus,
    canOpen: hasFeature(state.entity, COVER_FEATURES.open),
    canClose: hasFeature(state.entity, COVER_FEATURES.close),
    canStop: hasFeature(state.entity, COVER_FEATURES.stop),
  };
}

export function renderCoverControlCard(cardDef, runtime = {}) {
  const normalized = normalizeCover(runtime, cardDef.config);
  const unavailable = normalized.status !== "ok";
  const serviceUnavailable = !hasService(runtime);
  const shell = card(COVER_CONTROL_TYPE, cardDef.title || "Cover", unavailable ? normalized.status : "ok");
  const positionText = cardDef.config.showPosition && normalized.positionStatus === "ok" ? ` · Position ${normalized.position}%` : "";

  shell.append(el("p", { text: unavailable ? `Unavailable: ${unavailableText(normalized.status)}` : `State ${normalized.raw}${positionText}` }));
  const controls = el("div", { className: "dm-device-controls" });
  if (normalized.canOpen) controls.append(serviceButton(`Open ${normalized.entityId}`, unavailable || serviceUnavailable, () => call(runtime, "cover", "open_cover", { entity_id: normalized.entityId })));
  if (normalized.canClose) controls.append(serviceButton(`Close ${normalized.entityId}`, unavailable || serviceUnavailable, () => call(runtime, "cover", "close_cover", { entity_id: normalized.entityId })));
  if (normalized.canStop) controls.append(serviceButton(`Stop ${normalized.entityId}`, unavailable || serviceUnavailable, () => call(runtime, "cover", "stop_cover", { entity_id: normalized.entityId })));
  if (controls.children.length) shell.append(controls);
  return shell;
}

export function renderSensorStatusCard(cardDef, runtime = {}) {
  const state = entityState(runtime, cardDef.config.entityId);
  const shell = card(SENSOR_STATUS_TYPE, cardDef.title || "Sensor", state.status);
  const value = state.status === "ok" ? String(state.raw) : "Unavailable";

  shell.append(el("p", { text: `${value}${state.status === "ok" && unit(state.entity) ? ` ${unit(state.entity)}` : ""}` }));
  const secondary = secondaryInfoNode(state.entity, cardDef.config.secondaryInfo);
  if (secondary) shell.append(secondary);
  return shell;
}

function boolInput(documentRef, labelText, value, onChange, fieldId) {
  const label = documentRef.createElement("label");
  label.textContent = `${labelText} `;
  const input = documentRef.createElement("input");
  input.type = "checkbox";
  input.checked = Boolean(value);
  input.dataset.editorField = fieldId;
  input.addEventListener("change", () => onChange(input.checked));
  label.append(input);
  return label;
}

function selectInput(documentRef, labelText, value, options, onChange, fieldId) {
  const label = documentRef.createElement("label");
  label.textContent = `${labelText} `;
  const select = documentRef.createElement("select");
  select.dataset.editorField = fieldId;
  for (const optionValue of options) {
    const option = documentRef.createElement("option");
    option.value = optionValue;
    option.textContent = optionValue;
    option.selected = optionValue === value;
    select.append(option);
  }
  select.addEventListener("change", () => onChange(select.value));
  label.append(select);
  return label;
}

function editor(extra = []) {
  return (documentRef, cardDef, controller, errors = []) => {
    const form = documentRef.createElement("section");
    form.className = "dashboardmodern-plugin-editor";
    form.append(textInput(documentRef, "Entity ID", cardDef.config?.entityId || "", (entityId) => controller.updateCardConfigPatch(cardDef.id, { entityId }), `card:${cardDef.id}:config.entityId`));
    for (const field of extra) form.append(field(documentRef, cardDef, controller));
    errors.forEach((error) => form.append(fieldError(documentRef, error.message)));
    return form;
  };
}

export const renderClimateControlEditor = editor([
  (documentRef, cardDef, controller) => textInput(documentRef, "Temperature step", String(cardDef.config?.temperatureStep ?? 1), (value) => controller.updateCardConfigPatch(cardDef.id, { temperatureStep: Number(value) }), `card:${cardDef.id}:config.temperatureStep`),
]);
export const renderLightControlEditor = editor([
  (documentRef, cardDef, controller) => boolInput(documentRef, "Show brightness", cardDef.config?.showBrightness, (showBrightness) => controller.updateCardConfigPatch(cardDef.id, { showBrightness }), `card:${cardDef.id}:config.showBrightness`),
]);
export const renderSwitchControlEditor = editor([
  (documentRef, cardDef, controller) => selectInput(documentRef, "Secondary info", cardDef.config?.secondaryInfo || "none", SECONDARY_OPTIONS, (secondaryInfo) => controller.updateCardConfigPatch(cardDef.id, { secondaryInfo }), `card:${cardDef.id}:config.secondaryInfo`),
]);
export const renderCoverControlEditor = editor([
  (documentRef, cardDef, controller) => boolInput(documentRef, "Show position", cardDef.config?.showPosition, (showPosition) => controller.updateCardConfigPatch(cardDef.id, { showPosition }), `card:${cardDef.id}:config.showPosition`),
]);
export const renderSensorStatusEditor = renderSwitchControlEditor;
