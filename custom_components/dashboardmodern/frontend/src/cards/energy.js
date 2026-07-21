import { fieldError, textInput } from "../editor/dashboard-form.js";
import { el } from "../render/dom.js";
import { renderIcon } from "./icon-registry.js";

export const ENERGY_OVERVIEW_TYPE = "energy-overview";
export const ENERGY_FLOWS_TYPE = "energy-flows";
export const BATTERY_STATUS_TYPE = "battery-status";
export const SOLAR_PRODUCTION_TYPE = "solar-production";
export const GRID_STATUS_TYPE = "grid-status";

export const POWER_UNITS = Object.freeze(["W", "kW"]);
export const ENERGY_UNITS = Object.freeze(["Wh", "kWh"]);
export const SOC_UNITS = Object.freeze(["%"]);
export const BATTERY_POSITIVE_DIRECTIONS = Object.freeze(["charging", "discharging"]);

const BAD_STATES = new Set(["", "unknown", "unavailable"]);
const TEMPLATE_PATTERN = /\{\{|\}\}|\{%|%\}|<script|javascript:/i;
const CANONICAL_POWER_UNIT = "kW";
const CANONICAL_ENERGY_UNIT = "kWh";
const CANONICAL_SOC_UNIT = "%";

const ENTITY_LABELS = Object.freeze({
  productionEntityId: "PV current production",
  houseConsumptionEntityId: "House consumption",
  gridImportEntityId: "Grid import",
  gridExportEntityId: "Grid export",
  batterySocEntityId: "Battery SOC",
  batteryPowerEntityId: "Battery power",
  batteryCapacityEntityId: "Battery remaining capacity",
  dailyProductionEntityId: "Daily solar production",
  peakProductionEntityId: "Peak solar production",
  dailyImportEntityId: "Daily import total",
  dailyExportEntityId: "Daily export total",
});

const ENTITY_FIELDS = Object.freeze(Object.keys(ENTITY_LABELS));

function baseConfig() {
  return {
    productionEntityId: "",
    houseConsumptionEntityId: "",
    gridImportEntityId: "",
    gridExportEntityId: "",
    batterySocEntityId: "",
    batteryPowerEntityId: "",
    batteryCapacityEntityId: "",
    dailyProductionEntityId: "",
    peakProductionEntityId: "",
    dailyImportEntityId: "",
    dailyExportEntityId: "",
    batteryPositiveDirection: "charging",
    powerUnit: CANONICAL_POWER_UNIT,
    energyUnit: CANONICAL_ENERGY_UNIT,
    socUnit: CANONICAL_SOC_UNIT,
  };
}

export const defaultEnergyOverviewConfig = baseConfig;
export const defaultEnergyFlowsConfig = baseConfig;
export function defaultBatteryStatusConfig() {
  return {
    batterySocEntityId: "",
    batteryPowerEntityId: "",
    batteryCapacityEntityId: "",
    batteryPositiveDirection: "charging",
    powerUnit: CANONICAL_POWER_UNIT,
    energyUnit: CANONICAL_ENERGY_UNIT,
    socUnit: CANONICAL_SOC_UNIT,
  };
}
export function defaultSolarProductionConfig() {
  return {
    productionEntityId: "",
    dailyProductionEntityId: "",
    peakProductionEntityId: "",
    powerUnit: CANONICAL_POWER_UNIT,
    energyUnit: CANONICAL_ENERGY_UNIT,
  };
}
export function defaultGridStatusConfig() {
  return {
    gridImportEntityId: "",
    gridExportEntityId: "",
    dailyImportEntityId: "",
    dailyExportEntityId: "",
    powerUnit: CANONICAL_POWER_UNIT,
    energyUnit: CANONICAL_ENERGY_UNIT,
  };
}

function parseNumber(raw) {
  const value = Number(String(raw ?? "").trim().replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function unitFromState(state, fallbackUnit) {
  return String(state?.attributes?.unit_of_measurement || fallbackUnit || "").trim();
}

function convertValue(value, sourceUnit, kind) {
  if (kind === "power") {
    if (sourceUnit === "W") return { value: value / 1000, canonicalUnit: CANONICAL_POWER_UNIT };
    if (sourceUnit === "kW") return { value, canonicalUnit: CANONICAL_POWER_UNIT };
  }
  if (kind === "energy") {
    if (sourceUnit === "Wh") return { value: value / 1000, canonicalUnit: CANONICAL_ENERGY_UNIT };
    if (sourceUnit === "kWh") return { value, canonicalUnit: CANONICAL_ENERGY_UNIT };
  }
  if (kind === "soc" && sourceUnit === "%") return { value, canonicalUnit: CANONICAL_SOC_UNIT };
  return null;
}

function formatValue(value, locale, unit) {
  if (value === null) return "Unavailable";
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)} ${unit}`;
}

function unavailableMetric(label, status, entityId = "", sourceUnit = "") {
  return {
    label,
    status,
    available: false,
    value: null,
    canonicalValue: null,
    canonicalUnit: "",
    sourceUnit,
    display: status === "not-configured" ? "Optional" : "Unavailable",
    entityId,
  };
}

function metric(runtime, entityId, fallbackUnit, label, kind, { optional = false } = {}) {
  if (!entityId?.trim()) return unavailableMetric(label, optional ? "not-configured" : "missing-config", entityId);

  const state = runtime.getEntityState?.(entityId);
  if (!state) return unavailableMetric(label, "missing-entity", entityId);

  const raw = String(state.state ?? "").trim();
  const sourceUnit = unitFromState(state, fallbackUnit);
  if (BAD_STATES.has(raw)) return unavailableMetric(label, raw || "unavailable", entityId, sourceUnit);

  const rawValue = parseNumber(raw);
  if (rawValue === null) return unavailableMetric(label, "malformed", entityId, sourceUnit);

  const converted = convertValue(rawValue, sourceUnit, kind);
  if (!converted) return unavailableMetric(label, "unsupported-unit", entityId, sourceUnit);

  return {
    label,
    status: "ok",
    available: true,
    value: converted.value,
    canonicalValue: converted.value,
    canonicalUnit: converted.canonicalUnit,
    sourceValue: rawValue,
    sourceUnit,
    display: formatValue(converted.value, runtime.locale || "it-IT", converted.canonicalUnit),
    entityId,
  };
}

function derivedMetric(label, value, unit, locale) {
  return {
    label,
    status: value === null ? "unavailable" : "ok",
    available: value !== null,
    derived: true,
    value,
    canonicalValue: value,
    canonicalUnit: unit,
    display: formatValue(value, locale, unit),
    entityId: "",
  };
}

function batteryMode(powerMetric, positiveDirection) {
  if (!powerMetric.available) return "unavailable";
  if (powerMetric.value === 0) return "idle";
  const positiveMeansCharging = positiveDirection === "charging";
  return powerMetric.value > 0 === positiveMeansCharging ? "charging" : "discharging";
}

export function normalizeEnergy(runtime = {}, config = {}) {
  const c = { ...baseConfig(), ...config };
  const locale = runtime.locale || "it-IT";
  const metrics = {
    production: metric(runtime, c.productionEntityId, c.powerUnit, "Production", "power"),
    house: metric(runtime, c.houseConsumptionEntityId, c.powerUnit, "House", "power"),
    import: metric(runtime, c.gridImportEntityId, c.powerUnit, "Import", "power"),
    export: metric(runtime, c.gridExportEntityId, c.powerUnit, "Export", "power"),
    soc: metric(runtime, c.batterySocEntityId, c.socUnit, "SOC", "soc"),
    batteryPower: metric(runtime, c.batteryPowerEntityId, c.powerUnit, "Battery power", "power"),
    capacity: metric(runtime, c.batteryCapacityEntityId, c.energyUnit, "Remaining capacity", "energy", { optional: true }),
    dailyProduction: metric(runtime, c.dailyProductionEntityId, c.energyUnit, "Daily production", "energy", { optional: true }),
    peak: metric(runtime, c.peakProductionEntityId, c.powerUnit, "Peak", "power", { optional: true }),
    dailyImport: metric(runtime, c.dailyImportEntityId, c.energyUnit, "Daily import", "energy", { optional: true }),
    dailyExport: metric(runtime, c.dailyExportEntityId, c.energyUnit, "Daily export", "energy", { optional: true }),
  };
  const selfConsumptionValue = metrics.production.available && metrics.house.available
    ? Math.max(0, Math.min(metrics.production.value, metrics.house.value))
    : null;

  return {
    metrics,
    selfConsumption: derivedMetric("Self-consumption", selfConsumptionValue, CANONICAL_POWER_UNIT, locale),
    batteryMode: batteryMode(metrics.batteryPower, c.batteryPositiveDirection),
    batteryPositiveDirection: c.batteryPositiveDirection,
    flowMetrics: [
      { label: "PV production", metric: metrics.production },
      { label: "House consumption", metric: metrics.house },
      { label: "Grid import", metric: metrics.import },
      { label: "Grid export", metric: metrics.export },
      { label: "Battery power", metric: metrics.batteryPower },
    ],
  };
}

function validateAllowed(errors, config, key, allowed) {
  if (typeof config[key] !== "string" || !allowed.includes(config[key])) {
    errors.push({ field: `config.${key}`, message: `${key} must be one of: ${allowed.join(", ")}.` });
  }
}

export function validateEnergyConfig(config = {}, required = [], unitFields = ["powerUnit", "energyUnit", "socUnit"]) {
  const errors = [];
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return [{ field: "config", message: "Config must be an object." }];
  }

  for (const key of ENTITY_FIELDS) {
    if (config[key] !== undefined && typeof config[key] !== "string") {
      errors.push({ field: `config.${key}`, message: `${key} must be a string.` });
    }
    if (typeof config[key] === "string" && TEMPLATE_PATTERN.test(config[key])) {
      errors.push({ field: `config.${key}`, message: `${key} cannot contain templates or executable expressions.` });
    }
  }
  for (const key of required) {
    if (typeof config[key] !== "string" || !config[key].trim()) {
      errors.push({ field: `config.${key}`, message: `${key} is required.` });
    }
  }

  if (unitFields.includes("powerUnit")) validateAllowed(errors, config, "powerUnit", POWER_UNITS);
  if (unitFields.includes("energyUnit")) validateAllowed(errors, config, "energyUnit", ENERGY_UNITS);
  if (unitFields.includes("socUnit")) validateAllowed(errors, config, "socUnit", SOC_UNITS);
  if (unitFields.includes("batteryPositiveDirection")) validateAllowed(errors, config, "batteryPositiveDirection", BATTERY_POSITIVE_DIRECTIONS);
  return errors;
}

const OVERVIEW_REQUIRED = ["productionEntityId", "houseConsumptionEntityId", "gridImportEntityId", "gridExportEntityId", "batterySocEntityId", "batteryPowerEntityId"];
export const validateEnergyOverviewConfig = (config) => validateEnergyConfig(config, OVERVIEW_REQUIRED, ["powerUnit", "energyUnit", "socUnit", "batteryPositiveDirection"]);
export const validateEnergyFlowsConfig = (config) => validateEnergyConfig(config, ["productionEntityId", "houseConsumptionEntityId", "gridImportEntityId", "gridExportEntityId", "batteryPowerEntityId"], ["powerUnit", "batteryPositiveDirection"]);
export const validateBatteryStatusConfig = (config) => validateEnergyConfig(config, ["batterySocEntityId", "batteryPowerEntityId"], ["powerUnit", "energyUnit", "socUnit", "batteryPositiveDirection"]);
export const validateSolarProductionConfig = (config) => validateEnergyConfig(config, ["productionEntityId"], ["powerUnit", "energyUnit"]);
export const validateGridStatusConfig = (config) => validateEnergyConfig(config, ["gridImportEntityId", "gridExportEntityId"], ["powerUnit", "energyUnit"]);

function statusAttrs(metric) {
  return { "data-status": metric.status, "aria-label": `${metric.label}: ${metric.display}` };
}

function metricTile(icon, metric, accent = "energy", runtime = {}) {
  const attrs = { "data-accent": accent, ...statusAttrs(metric) };
  const children = [
    renderIcon(icon, { label: metric.label }),
    el("span", { className: "dm-energy-label", text: metric.label }),
    el("strong", { text: metric.display }),
  ];
  const canOpenHistory = metric.available && metric.entityId && runtime.interactions?.openHistory;
  const node = canOpenHistory
    ? el("button", { className: "dm-energy-tile", attrs: { ...attrs, type: "button" } }, children)
    : el("div", { className: "dm-energy-tile", attrs }, children);
  if (canOpenHistory) node.addEventListener("click", () => runtime.interactions.openHistory(metric.entityId, metric.label));
  return node;
}

export function renderEnergyOverviewCard(card, runtime = {}) {
  const normalized = normalizeEnergy(runtime, card.config);
  const shell = el("article", { className: "dashboardmodern-card dm-energy-card dm-energy-overview", attrs: { "data-card-kind": ENERGY_OVERVIEW_TYPE } });
  shell.append(el("h3", { className: "section-title", text: card.title || "Energy overview" }));
  const grid = el("div", { className: "dm-energy-grid" });
  [
    ["sun", normalized.metrics.production, "solar"],
    ["heating", normalized.metrics.house, "load"],
    ["grid", normalized.metrics.import, "grid"],
    ["grid", normalized.metrics.export, "grid"],
    ["battery", normalized.metrics.soc, "battery"],
    ["battery", normalized.metrics.batteryPower, "battery"],
    ["sun", normalized.selfConsumption, "green"],
  ].forEach(([icon, metricItem, accent]) => grid.append(metricTile(icon, metricItem, accent, runtime)));
  shell.append(grid);
  return shell;
}

export function renderEnergyFlowsCard(card, runtime = {}) {
  const normalized = normalizeEnergy(runtime, card.config);
  const shell = el("article", { className: "dashboardmodern-card dm-energy-card dm-energy-flows", attrs: { "data-card-kind": ENERGY_FLOWS_TYPE } });
  shell.append(el("h3", { className: "section-title", text: card.title || "Energy flows" }));
  shell.append(el("p", { className: "dm-energy-flow-note", text: "Neutral direct metrics; no inferred source-to-destination allocation." }));
  normalized.flowMetrics.forEach(({ label, metric: metricItem }) => {
    shell.append(el("div", { className: "dm-energy-flow", attrs: { "data-status": metricItem.status } }, [
      el("span", { text: label }),
      el("b", { className: "dm-flow-arrow", text: "↔" }),
      el("strong", { text: metricItem.display }),
    ]));
  });
  return shell;
}

export function renderBatteryStatusCard(card, runtime = {}) {
  const normalized = normalizeEnergy(runtime, card.config);
  const shell = el("article", { className: "dashboardmodern-card dm-energy-card", attrs: { "data-card-kind": BATTERY_STATUS_TYPE, "data-mode": normalized.batteryMode } });
  shell.append(
    el("h3", { className: "section-title", text: card.title || "Battery status" }),
    metricTile("battery", normalized.metrics.soc, "battery", runtime),
    metricTile("battery", { ...normalized.metrics.batteryPower, label: `Power (${normalized.batteryMode})` }, "battery", runtime),
    metricTile("battery", normalized.metrics.capacity, "battery", runtime),
  );
  return shell;
}

export function renderSolarProductionCard(card, runtime = {}) {
  const normalized = normalizeEnergy(runtime, card.config);
  const shell = el("article", { className: "dashboardmodern-card dm-energy-card", attrs: { "data-card-kind": SOLAR_PRODUCTION_TYPE } });
  shell.append(
    el("h3", { className: "section-title", text: card.title || "Solar production" }),
    metricTile("sun", normalized.metrics.production, "solar", runtime),
    metricTile("sun", normalized.metrics.dailyProduction, "solar", runtime),
    metricTile("sun", normalized.metrics.peak, "solar", runtime),
  );
  return shell;
}

export function renderGridStatusCard(card, runtime = {}) {
  const normalized = normalizeEnergy(runtime, card.config);
  const shell = el("article", { className: "dashboardmodern-card dm-energy-card", attrs: { "data-card-kind": GRID_STATUS_TYPE } });
  shell.append(
    el("h3", { className: "section-title", text: card.title || "Grid status" }),
    metricTile("grid", normalized.metrics.import, "grid", runtime),
    metricTile("grid", normalized.metrics.export, "grid", runtime),
    metricTile("grid", normalized.metrics.dailyImport, "grid", runtime),
    metricTile("grid", normalized.metrics.dailyExport, "grid", runtime),
  );
  return shell;
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

function energyEditor(entityFields, unitFields) {
  return (documentRef, card, controller, errors = []) => {
    const form = documentRef.createElement("section");
    form.className = "dashboardmodern-plugin-editor";
    entityFields.forEach((key) => {
      form.append(textInput(documentRef, ENTITY_LABELS[key] || key, card.config?.[key] || "", (value) => controller.updateCardConfigPatch(card.id, { [key]: value }), `card:${card.id}:config.${key}`));
    });
    if (unitFields.includes("powerUnit")) {
      form.append(selectInput(documentRef, "Power unit", card.config?.powerUnit || CANONICAL_POWER_UNIT, POWER_UNITS, (powerUnit) => controller.updateCardConfigPatch(card.id, { powerUnit }), `card:${card.id}:config.powerUnit`));
    }
    if (unitFields.includes("energyUnit")) {
      form.append(selectInput(documentRef, "Energy unit", card.config?.energyUnit || CANONICAL_ENERGY_UNIT, ENERGY_UNITS, (energyUnit) => controller.updateCardConfigPatch(card.id, { energyUnit }), `card:${card.id}:config.energyUnit`));
    }
    if (unitFields.includes("socUnit")) {
      form.append(selectInput(documentRef, "SOC unit", card.config?.socUnit || CANONICAL_SOC_UNIT, SOC_UNITS, (socUnit) => controller.updateCardConfigPatch(card.id, { socUnit }), `card:${card.id}:config.socUnit`));
    }
    if (unitFields.includes("batteryPositiveDirection")) {
      form.append(selectInput(documentRef, "Battery positive direction", card.config?.batteryPositiveDirection || "charging", BATTERY_POSITIVE_DIRECTIONS, (batteryPositiveDirection) => controller.updateCardConfigPatch(card.id, { batteryPositiveDirection }), `card:${card.id}:config.batteryPositiveDirection`));
    }
    errors.forEach((error) => form.append(fieldError(documentRef, error.message)));
    return form;
  };
}

export const renderEnergyOverviewEditor = energyEditor(OVERVIEW_REQUIRED.concat(["batteryCapacityEntityId", "dailyProductionEntityId", "peakProductionEntityId", "dailyImportEntityId", "dailyExportEntityId"]), ["powerUnit", "energyUnit", "socUnit", "batteryPositiveDirection"]);
export const renderEnergyFlowsEditor = energyEditor(["productionEntityId", "houseConsumptionEntityId", "gridImportEntityId", "gridExportEntityId", "batteryPowerEntityId"], ["powerUnit", "batteryPositiveDirection"]);
export const renderBatteryStatusEditor = energyEditor(["batterySocEntityId", "batteryPowerEntityId", "batteryCapacityEntityId"], ["powerUnit", "energyUnit", "socUnit", "batteryPositiveDirection"]);
export const renderSolarProductionEditor = energyEditor(["productionEntityId", "dailyProductionEntityId", "peakProductionEntityId"], ["powerUnit", "energyUnit"]);
export const renderGridStatusEditor = energyEditor(["gridImportEntityId", "gridExportEntityId", "dailyImportEntityId", "dailyExportEntityId"], ["powerUnit", "energyUnit"]);
