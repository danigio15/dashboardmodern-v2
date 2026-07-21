import { el, emptyState } from "../render/dom.js";
import { fieldError, textInput, textareaInput } from "../editor/dashboard-form.js";
import { APPLIANCE_TYPES, applianceConfig, defaultAction } from "../contracts.js";
import { renderIcon } from "./icon-registry.js";

export const WEATHER_HERO_TYPE = "weather-hero";
export const ALERT_SUMMARY_TYPE = "alert-summary";
export const QUICK_ACTION_TYPE = "quick-action";
export const GENERIC_APPLIANCE_TYPE = "generic-appliance";

const BAD_STATES = new Set(["unknown", "unavailable", ""]);
const UNSAFE_TEXT_PATTERN = /\{\{|\}\}|\{%|%\}|<script|javascript:/i;

function isSafeText(value) {
  return typeof value === "string" && !UNSAFE_TEXT_PATTERN.test(value);
}

function entityState(runtime, entityId) {
  return entityId ? runtime?.getEntityState?.(entityId) || null : null;
}

function isAvailable(state) {
  return state && !BAD_STATES.has(String(state.state ?? ""));
}

function configurationState(message = "Configuration required") {
  return emptyState(message);
}

function normalizedAction(action = {}) {
  return {
    ...defaultAction(),
    ...action,
    target: { ...(action.target || {}) },
    serviceData: { ...(action.serviceData || {}) },
  };
}

function parseJsonObject(text) {
  const parsed = JSON.parse(text || "{}");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected a JSON object.");
  }
  return parsed;
}

function parseAlertArray(text) {
  const parsed = JSON.parse(text || "[]");
  if (!Array.isArray(parsed)) {
    throw new Error("Alerts JSON must be an array.");
  }
  return parsed;
}

function nestedPatch(source, path, value) {
  const keys = path.split(".");
  if (keys.length === 1) return { ...source, [path]: value };
  const [head, ...tail] = keys;
  return {
    ...source,
    [head]: nestedPatch(source?.[head] || {}, tail.join("."), value),
  };
}

function updateNestedConfig(controller, card, path, value) {
  controller.updateCardConfigPatch(card.id, nestedPatch(card.config || {}, path, value));
}

function clearControllerField(controller, field) {
  if (!controller.store?.setState || !controller.state) return;
  const { [field]: _cleared, ...fieldText } = controller.state.fieldText || {};
  controller.store.setState({
    editor: {
      ...controller.state,
      fieldText,
      validationErrors: (controller.state.validationErrors || []).filter((item) => item.field !== field),
    },
  });
}

function setControllerFieldError(controller, field, text, message) {
  controller.store?.setState?.({
    editor: {
      ...controller.state,
      dirty: true,
      fieldText: { ...(controller.state?.fieldText || {}), [field]: text },
      validationErrors: [
        ...(controller.state?.validationErrors || []).filter((item) => item.field !== field),
        { field, message },
      ],
    },
  });
}

function checkboxInput(documentRef, labelText, checked, onChange, fieldId) {
  const label = documentRef.createElement("label");
  label.textContent = labelText;
  const input = documentRef.createElement("input");
  input.type = "checkbox";
  input.checked = Boolean(checked);
  input.dataset.editorField = fieldId;
  input.addEventListener("change", () => onChange(Boolean(input.checked)));
  label.append(input);
  return label;
}

function selectInput(documentRef, labelText, value, options, onChange, fieldId) {
  const label = documentRef.createElement("label");
  label.textContent = labelText;
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

export function defaultWeatherHeroConfig() {
  return {
    weatherEntityId: "",
    temperatureEntityId: "",
    humidityEntityId: "",
    windEntityId: "",
    title: "",
    subtitle: "",
    showHumidity: true,
    showWind: true,
    showForecast: true,
    forecastMode: "daily",
    tapAction: defaultAction(),
    layout: { variant: "hero" },
  };
}

export function validateWeatherHeroConfig(config = {}) {
  const errors = [];
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return [{ field: "config", message: "Config must be an object." }];
  }
  for (const key of ["weatherEntityId", "temperatureEntityId", "humidityEntityId", "windEntityId", "title", "subtitle", "forecastMode"]) {
    if (config[key] !== undefined && typeof config[key] !== "string") {
      errors.push({ field: `config.${key}`, message: `${key} must be a string.` });
    }
    if (typeof config[key] === "string" && !isSafeText(config[key])) {
      errors.push({ field: `config.${key}`, message: `${key} contains unsupported markup or templates.` });
    }
  }
  for (const key of ["showHumidity", "showWind", "showForecast"]) {
    if (config[key] !== undefined && typeof config[key] !== "boolean") {
      errors.push({ field: `config.${key}`, message: `${key} must be a boolean.` });
    }
  }
  return errors;
}

export function renderWeatherHeroCard(card, runtime = {}) {
  const config = { ...defaultWeatherHeroConfig(), ...(card.config || {}) };
  const shell = el("article", {
    className: "dashboardmodern-card legacy-card dm-home-card dm-weather-hero",
    attrs: { "data-card-kind": WEATHER_HERO_TYPE },
  });
  const weather = entityState(runtime, config.weatherEntityId);
  if (!config.weatherEntityId) {
    shell.append(el("h3", { text: card.title || "Weather" }), configurationState("Configuration required: choose a weather entity."));
    return shell;
  }
  if (!weather) {
    shell.append(el("h3", { text: card.title || "Weather" }), configurationState("Weather entity not found."));
    return shell;
  }
  if (!isAvailable(weather)) {
    shell.append(el("h3", { text: card.title || "Weather" }), configurationState("Weather is currently unavailable."));
    return shell;
  }

  const attributes = weather.attributes || {};
  const temperature = isAvailable(entityState(runtime, config.temperatureEntityId))
    ? entityState(runtime, config.temperatureEntityId).state
    : attributes.temperature;
  shell.append(el("div", { className: "dm-hero-copy" }, [
    el("p", { className: "dm-kicker", text: config.subtitle || "Home weather" }),
    el("h3", { text: config.title || card.title || "Weather" }),
    el("strong", { className: "dm-hero-temp", text: `${temperature ?? "--"}${attributes.temperature_unit || "°"}` }),
    el("span", { className: "dm-hero-state", text: String(weather.state).replaceAll("-", " ") }),
  ]));
  const chips = el("div", { className: "dm-chip-row" });
  if (config.showHumidity) {
    const humidity = isAvailable(entityState(runtime, config.humidityEntityId))
      ? entityState(runtime, config.humidityEntityId).state
      : attributes.humidity ?? "--";
    chips.append(el("span", { className: "legacy-pill", text: `Humidity ${humidity}%` }));
  }
  if (config.showWind) {
    const wind = isAvailable(entityState(runtime, config.windEntityId))
      ? entityState(runtime, config.windEntityId).state
      : attributes.wind_speed ?? "--";
    chips.append(el("span", { className: "legacy-pill", text: `Wind ${wind} ${attributes.wind_speed_unit || ""}` }));
  }
  shell.append(chips);
  return shell;
}

export const ALERT_PRESETS = Object.freeze({
  lights: { title: "Lights on", icon: "light", condition: "on" },
  climate: { title: "Active climate", icon: "climate", condition: "not_off" },
  openings: { title: "Openings", icon: "door", condition: "on" },
  batteries: { title: "Low batteries", icon: "battery", condition: "below", value: 20 },
});

export function defaultAlertSummaryConfig() {
  return {
    alerts: Object.entries(ALERT_PRESETS).map(([id, preset]) => ({
      id,
      entityIds: [],
      activeColor: "#22c55e",
      visibility: { enabled: true },
      ...preset,
    })),
    layout: { variant: "tiles" },
  };
}

function isAlertActive(state, alert) {
  if (!isAvailable(state)) return false;
  if (alert.condition === "below") return Number(state.state) < Number(alert.value);
  if (alert.condition === "not_off") return !["off", "idle"].includes(String(state.state));
  if (alert.condition === "equals") return String(state.state) === String(alert.value);
  return String(state.state) === String(alert.condition || "on");
}

export function calculateAlertSummary(runtime, config = {}) {
  return (config.alerts || []).map((alert) => ({
    ...alert,
    count: (alert.entityIds || []).filter((entityId) => isAlertActive(entityState(runtime, entityId), alert)).length,
  }));
}

export function validateAlertSummaryConfig(config = {}) {
  const errors = [];
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return [{ field: "config", message: "Config must be an object." }];
  }
  if (!Array.isArray(config.alerts)) {
    return [{ field: "config.alerts", message: "alerts must be an array." }];
  }
  config.alerts.forEach((alert, index) => {
    if (!alert || typeof alert !== "object" || Array.isArray(alert)) {
      errors.push({ field: `config.alerts.${index}`, message: "Alert must be an object." });
      return;
    }
    if (typeof alert.title !== "string" || !alert.title.trim()) {
      errors.push({ field: `config.alerts.${index}.title`, message: "Alert title is required." });
    }
    if (!Array.isArray(alert.entityIds)) {
      errors.push({ field: `config.alerts.${index}.entityIds`, message: "entityIds must be an array." });
    }
  });
  return errors;
}

export function renderAlertSummaryCard(card, runtime = {}) {
  const config = { ...defaultAlertSummaryConfig(), ...(card.config || {}) };
  const shell = el("article", {
    className: "dashboardmodern-card legacy-card dm-alert-summary",
    attrs: { "data-card-kind": ALERT_SUMMARY_TYPE },
  });
  shell.append(el("h3", { text: card.title || "Alerts" }));
  const grid = el("div", { className: "dm-alert-grid" });
  for (const alert of calculateAlertSummary(runtime, config)) {
    const tile = el("button", { className: "dm-alert-tile", attrs: { type: "button" } });
    tile.append(renderIcon(alert.icon || "alert"), el("strong", { text: String(alert.count) }), el("span", { text: alert.title || "Alert" }));
    grid.append(tile);
  }
  shell.append(grid);
  if (!config.alerts?.length) shell.append(emptyState("Everything looks calm."));
  return shell;
}

export function defaultQuickActionConfig() {
  return {
    title: "Action",
    icon: "bolt",
    imageRef: "",
    action: normalizedAction(),
    visibility: { enabled: true },
    layout: { variant: "compact" },
  };
}

export function buildQuickActionServicePayload(config = {}) {
  const action = normalizedAction(config.action || config);
  return {
    domain: action.domain,
    service: action.service,
    data: {
      ...(action.serviceData || {}),
      ...(action.target?.entity_id ? { entity_id: action.target.entity_id } : {}),
    },
    confirmation: Boolean(action.confirmation),
  };
}

export function validateQuickActionConfig(config = {}) {
  const payload = buildQuickActionServicePayload(config);
  return payload.domain && payload.service
    ? []
    : [{ field: "config.action", message: "Choose a Home Assistant service for this action." }];
}

export function renderQuickActionCard(card, runtime = {}) {
  const config = { ...defaultQuickActionConfig(), ...(card.config || {}) };
  const button = el("button", {
    className: "dashboardmodern-card legacy-card dm-quick-action",
    attrs: { type: "button", "data-card-kind": QUICK_ACTION_TYPE },
  });
  button.append(renderIcon(config.icon || "bolt"), el("strong", { text: config.title || card.title || "Action" }));
  button.addEventListener("click", () => {
    const payload = buildQuickActionServicePayload(config);
    if (payload.domain && payload.service) runtime.callService?.(payload.domain, payload.service, payload.data);
  });
  return button;
}

export function defaultGenericApplianceConfig() {
  return applianceConfig();
}

export function mapApplianceStatus(raw, mapping = {}) {
  return mapping?.[raw] || mapping?.[String(raw).toLowerCase()] || raw || "Not available";
}

export function validateGenericApplianceConfig(config = {}) {
  const errors = [];
  if (config.applianceType && !APPLIANCE_TYPES.includes(config.applianceType)) {
    errors.push({ field: "config.applianceType", message: "Unsupported appliance type." });
  }
  return errors;
}

export function renderGenericApplianceCard(card, runtime = {}) {
  const config = { ...defaultGenericApplianceConfig(), ...(card.config || {}) };
  const shell = el("article", {
    className: "dashboardmodern-card legacy-card dm-appliance",
    attrs: { "data-card-kind": GENERIC_APPLIANCE_TYPE },
  });
  shell.append(el("div", { className: "dm-appliance-head" }, [
    renderIcon(config.icon || "appliance"),
    el("div", {}, [
      el("h3", { text: config.title || card.title || "Appliance" }),
      el("p", { text: config.subtitle || config.applianceType }),
    ]),
  ]));
  if (!config.primaryStateEntityId) {
    shell.append(configurationState("Configuration required: choose a primary state entity."));
    return shell;
  }
  const primary = entityState(runtime, config.primaryStateEntityId);
  if (!primary) {
    shell.append(configurationState("Primary state entity not found."));
    return shell;
  }
  if (!isAvailable(primary)) {
    shell.append(configurationState("Appliance is currently unavailable."));
    return shell;
  }
  shell.append(el("strong", { className: "dm-appliance-status", text: mapApplianceStatus(String(primary.state), config.statusMapping) }));
  const meta = el("div", { className: "dm-chip-row" });
  for (const [entityId, label] of [
    [config.powerEntityId, "Power"],
    [config.energyEntityId, "Energy"],
    [config.progressEntityId, "Progress"],
    [config.remainingTimeEntityId, "Remaining"],
  ]) {
    if (isAvailable(entityState(runtime, entityId))) {
      meta.append(el("span", { className: "legacy-pill", text: `${label} ${entityState(runtime, entityId).state}` }));
    }
  }
  shell.append(meta);
  return shell;
}

export function renderWeatherHeroEditor(documentRef, card, controller, errors = []) {
  const form = documentRef.createElement("section");
  form.className = "dashboardmodern-plugin-editor";
  for (const [key, label] of [
    ["weatherEntityId", "Weather entity"],
    ["temperatureEntityId", "Temperature entity"],
    ["humidityEntityId", "Humidity entity"],
    ["windEntityId", "Wind entity"],
    ["title", "Title override"],
    ["subtitle", "Subtitle override"],
  ]) {
    form.append(textInput(documentRef, label, card.config?.[key] || "", (value) => controller.updateCardConfigPatch(card.id, { [key]: value }), `card:${card.id}:config.${key}`));
  }
  for (const error of errors) form.append(fieldError(documentRef, error.message));
  return form;
}

export function renderAlertSummaryEditor(documentRef, card, controller, errors = [], fieldText = {}) {
  const form = documentRef.createElement("section");
  form.className = "dashboardmodern-plugin-editor";
  const field = `card:${card.id}:config.alerts`;
  form.append(textareaInput(
    documentRef,
    "Alerts JSON",
    fieldText[field] ?? JSON.stringify(card.config?.alerts || [], null, 2),
    (text) => {
      try {
        const alerts = parseAlertArray(text);
        controller.updateCardConfigPatch(card.id, { alerts });
        clearControllerField(controller, field);
      } catch (error) {
        setControllerFieldError(controller, field, text, error.message);
      }
    },
    field,
  ));
  for (const error of errors) form.append(fieldError(documentRef, error.message));
  return form;
}

export function renderQuickActionEditor(documentRef, card, controller, errors = []) {
  const form = documentRef.createElement("section");
  form.className = "dashboardmodern-plugin-editor";
  const config = { ...defaultQuickActionConfig(), ...(card.config || {}) };
  const action = normalizedAction(config.action);
  form.append(textInput(documentRef, "Title", config.title || "", (value) => controller.updateCardConfigPatch(card.id, { title: value }), `card:${card.id}:config.title`));
  form.append(textInput(documentRef, "Icon", config.icon || "", (value) => controller.updateCardConfigPatch(card.id, { icon: value }), `card:${card.id}:config.icon`));
  form.append(textInput(documentRef, "Domain", action.domain || "", (value) => updateNestedConfig(controller, card, "action.domain", value), `card:${card.id}:config.action.domain`));
  form.append(textInput(documentRef, "Service", action.service || "", (value) => updateNestedConfig(controller, card, "action.service", value), `card:${card.id}:config.action.service`));
  form.append(textInput(documentRef, "Target entity", action.target?.entity_id || "", (value) => updateNestedConfig(controller, card, "action.target.entity_id", value), `card:${card.id}:config.action.target.entity_id`));
  const serviceDataField = `card:${card.id}:config.action.serviceData`;
  form.append(textareaInput(
    documentRef,
    "Service data JSON",
    controller.state?.fieldText?.[serviceDataField] ?? JSON.stringify(action.serviceData || {}, null, 2),
    (text) => {
      try {
        updateNestedConfig(controller, card, "action.serviceData", parseJsonObject(text));
        clearControllerField(controller, serviceDataField);
      } catch (error) {
        setControllerFieldError(controller, serviceDataField, text, error.message);
      }
    },
    serviceDataField,
  ));
  form.append(checkboxInput(documentRef, "Require confirmation", action.confirmation, (value) => updateNestedConfig(controller, card, "action.confirmation", value), `card:${card.id}:config.action.confirmation`));
  for (const error of errors) form.append(fieldError(documentRef, error.message));
  return form;
}

export function renderGenericApplianceEditor(documentRef, card, controller, errors = []) {
  const form = documentRef.createElement("section");
  form.className = "dashboardmodern-plugin-editor";
  const config = { ...defaultGenericApplianceConfig(), ...(card.config || {}) };
  for (const [key, label] of [
    ["title", "Title"],
    ["subtitle", "Subtitle"],
    ["icon", "Icon"],
    ["primaryStateEntityId", "Primary state entity"],
    ["powerEntityId", "Power entity"],
    ["energyEntityId", "Energy entity"],
    ["progressEntityId", "Progress entity"],
    ["remainingTimeEntityId", "Remaining time entity"],
  ]) {
    form.append(textInput(documentRef, label, config[key] || "", (value) => controller.updateCardConfigPatch(card.id, { [key]: value }), `card:${card.id}:config.${key}`));
  }
  form.append(selectInput(documentRef, "Appliance type", config.applianceType || "generic-device", APPLIANCE_TYPES, (value) => controller.updateCardConfigPatch(card.id, { applianceType: value }), `card:${card.id}:config.applianceType`));
  for (const error of errors) form.append(fieldError(documentRef, error.message));
  return form;
}
