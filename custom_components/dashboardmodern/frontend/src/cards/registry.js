import { renderLegacyPanelCard, renderLegacyPanelEditor, validateLegacyPanelConfig, LEGACY_PANEL_TYPE } from "./legacy-panel.js";
import { HOME_SUMMARY_TYPE, defaultHomeSummaryConfig, renderHomeSummaryCard, renderHomeSummaryEditor, validateHomeSummaryConfig } from "./home-summary.js";
import { WEATHER_CURRENT_TYPE, WEATHER_FORECAST_TYPE, defaultWeatherCurrentConfig, defaultWeatherForecastConfig, renderWeatherCurrentCard, renderWeatherCurrentEditor, renderWeatherForecastCard, renderWeatherForecastEditor, validateWeatherCurrentConfig, validateWeatherForecastConfig } from "./weather.js";
import { BATTERY_STATUS_TYPE, ENERGY_FLOWS_TYPE, ENERGY_OVERVIEW_TYPE, GRID_STATUS_TYPE, SOLAR_PRODUCTION_TYPE, defaultBatteryStatusConfig, defaultEnergyFlowsConfig, defaultEnergyOverviewConfig, defaultGridStatusConfig, defaultSolarProductionConfig, renderBatteryStatusCard, renderBatteryStatusEditor, renderEnergyFlowsCard, renderEnergyFlowsEditor, renderEnergyOverviewCard, renderEnergyOverviewEditor, renderGridStatusCard, renderGridStatusEditor, renderSolarProductionCard, renderSolarProductionEditor, validateBatteryStatusConfig, validateEnergyFlowsConfig, validateEnergyOverviewConfig, validateGridStatusConfig, validateSolarProductionConfig } from "./energy.js";
import { el, emptyState } from "../render/dom.js";
import { CAMERA_STATUS_TYPE, FAN_CONTROL_TYPE, MEDIA_PLAYER_CONTROL_TYPE, VACUUM_CONTROL_TYPE, defaultCameraStatusConfig, defaultFanControlConfig, defaultMediaPlayerControlConfig, defaultVacuumControlConfig, renderCameraStatusCard, renderCameraStatusEditor, renderFanControlCard, renderFanControlEditor, renderMediaPlayerControlCard, renderMediaPlayerControlEditor, renderVacuumControlCard, renderVacuumControlEditor, validateCameraStatusConfig, validateFanControlConfig, validateMediaPlayerControlConfig, validateVacuumControlConfig } from "./media-device-parity.js";
import { AUTOMATION_CONTROL_TYPE, BUTTON_CONTROL_TYPE, INPUT_BOOLEAN_CONTROL_TYPE, INPUT_NUMBER_CONTROL_TYPE, INPUT_SELECT_CONTROL_TYPE, SCENE_CONTROL_TYPE, SCRIPT_CONTROL_TYPE, defaultAutomationControlConfig, defaultButtonControlConfig, defaultInputBooleanControlConfig, defaultInputNumberControlConfig, defaultInputSelectControlConfig, defaultSceneControlConfig, defaultScriptControlConfig, renderAutomationControlCard, renderAutomationControlEditor, renderButtonControlCard, renderButtonControlEditor, renderInputBooleanControlCard, renderInputBooleanControlEditor, renderInputNumberControlCard, renderInputNumberControlEditor, renderInputSelectControlCard, renderInputSelectControlEditor, renderSceneControlCard, renderSceneControlEditor, renderScriptControlCard, renderScriptControlEditor, validateAutomationControlConfig, validateButtonControlConfig, validateInputBooleanControlConfig, validateInputNumberControlConfig, validateInputSelectControlConfig, validateSceneControlConfig, validateScriptControlConfig } from "./action-controls.js";
import { CLIMATE_CONTROL_TYPE, COVER_CONTROL_TYPE, LIGHT_CONTROL_TYPE, SENSOR_STATUS_TYPE, SWITCH_CONTROL_TYPE, defaultClimateControlConfig, defaultCoverControlConfig, defaultLightControlConfig, defaultSensorStatusConfig, defaultSwitchControlConfig, renderClimateControlCard, renderClimateControlEditor, renderCoverControlCard, renderCoverControlEditor, renderLightControlCard, renderLightControlEditor, renderSensorStatusCard, renderSensorStatusEditor, renderSwitchControlCard, renderSwitchControlEditor, validateClimateControlConfig, validateCoverControlConfig, validateLightControlConfig, validateSensorStatusConfig, validateSwitchControlConfig } from "./device-controls.js";

export function assertCardDefinition(definition) {
  if (!definition || typeof definition !== "object") throw new Error("Card definition is required.");
  if (typeof definition.type !== "string" || !definition.type.trim()) throw new Error("Card definition type must be a non-empty string.");
  if (typeof definition.displayName !== "string" || !definition.displayName.trim()) throw new Error(`Card definition ${definition.type} needs a display name.`);
  if (typeof definition.renderer !== "function") throw new Error(`Card definition ${definition.type} needs a renderer.`);
  for (const [name, value] of Object.entries({ editor: definition.editor, defaultConfig: definition.defaultConfig, validateConfig: definition.validateConfig })) {
    if (value !== undefined && typeof value !== "function") throw new Error(`Card definition ${definition.type} ${name} must be a function.`);
  }
}

export function createCardRegistry() {
  const definitions = new Map();
  return {
    register(definition) {
      assertCardDefinition(definition);
      if (definitions.has(definition.type)) throw new Error(`Card type already registered: ${definition.type}`);
      definitions.set(definition.type, Object.freeze({ ...definition }));
      return definition;
    },
    get(type) { return definitions.get(type) || null; },
    list() { return [...definitions.values()].sort((a, b) => a.displayName.localeCompare(b.displayName)); },
    types() { return [...definitions.keys()].sort(); },
    clear() { definitions.clear(); },
  };
}

export function registerBuiltInCardTypes(registry) {
  registry.register({ type: AUTOMATION_CONTROL_TYPE, displayName: "Automation control", renderer: renderAutomationControlCard, editor: renderAutomationControlEditor, defaultConfig: defaultAutomationControlConfig, validateConfig: validateAutomationControlConfig });
  registry.register({ type: BUTTON_CONTROL_TYPE, displayName: "Button control", renderer: renderButtonControlCard, editor: renderButtonControlEditor, defaultConfig: defaultButtonControlConfig, validateConfig: validateButtonControlConfig });
  registry.register({ type: INPUT_BOOLEAN_CONTROL_TYPE, displayName: "Input boolean control", renderer: renderInputBooleanControlCard, editor: renderInputBooleanControlEditor, defaultConfig: defaultInputBooleanControlConfig, validateConfig: validateInputBooleanControlConfig });
  registry.register({ type: INPUT_NUMBER_CONTROL_TYPE, displayName: "Input number control", renderer: renderInputNumberControlCard, editor: renderInputNumberControlEditor, defaultConfig: defaultInputNumberControlConfig, validateConfig: validateInputNumberControlConfig });
  registry.register({ type: INPUT_SELECT_CONTROL_TYPE, displayName: "Input select control", renderer: renderInputSelectControlCard, editor: renderInputSelectControlEditor, defaultConfig: defaultInputSelectControlConfig, validateConfig: validateInputSelectControlConfig });
  registry.register({ type: SCENE_CONTROL_TYPE, displayName: "Scene control", renderer: renderSceneControlCard, editor: renderSceneControlEditor, defaultConfig: defaultSceneControlConfig, validateConfig: validateSceneControlConfig });
  registry.register({ type: SCRIPT_CONTROL_TYPE, displayName: "Script control", renderer: renderScriptControlCard, editor: renderScriptControlEditor, defaultConfig: defaultScriptControlConfig, validateConfig: validateScriptControlConfig });
  registry.register({ type: LEGACY_PANEL_TYPE, displayName: "Legacy panel", renderer: renderLegacyPanelCard, editor: renderLegacyPanelEditor, defaultConfig: () => ({ accent: "primary", subtitle: "", status: "", body: "" }), validateConfig: validateLegacyPanelConfig });
  registry.register({ type: HOME_SUMMARY_TYPE, displayName: "Home summary", renderer: renderHomeSummaryCard, editor: renderHomeSummaryEditor, defaultConfig: defaultHomeSummaryConfig, validateConfig: validateHomeSummaryConfig });
  registry.register({ type: WEATHER_CURRENT_TYPE, displayName: "Weather current", renderer: renderWeatherCurrentCard, editor: renderWeatherCurrentEditor, defaultConfig: defaultWeatherCurrentConfig, validateConfig: validateWeatherCurrentConfig });
  registry.register({ type: WEATHER_FORECAST_TYPE, displayName: "Weather forecast", renderer: renderWeatherForecastCard, editor: renderWeatherForecastEditor, defaultConfig: defaultWeatherForecastConfig, validateConfig: validateWeatherForecastConfig });
  registry.register({ type: ENERGY_OVERVIEW_TYPE, displayName: "Energy overview", renderer: renderEnergyOverviewCard, editor: renderEnergyOverviewEditor, defaultConfig: defaultEnergyOverviewConfig, validateConfig: validateEnergyOverviewConfig });
  registry.register({ type: ENERGY_FLOWS_TYPE, displayName: "Energy flows", renderer: renderEnergyFlowsCard, editor: renderEnergyFlowsEditor, defaultConfig: defaultEnergyFlowsConfig, validateConfig: validateEnergyFlowsConfig });
  registry.register({ type: BATTERY_STATUS_TYPE, displayName: "Battery status", renderer: renderBatteryStatusCard, editor: renderBatteryStatusEditor, defaultConfig: defaultBatteryStatusConfig, validateConfig: validateBatteryStatusConfig });
  registry.register({ type: SOLAR_PRODUCTION_TYPE, displayName: "Solar production", renderer: renderSolarProductionCard, editor: renderSolarProductionEditor, defaultConfig: defaultSolarProductionConfig, validateConfig: validateSolarProductionConfig });
  registry.register({ type: GRID_STATUS_TYPE, displayName: "Grid status", renderer: renderGridStatusCard, editor: renderGridStatusEditor, defaultConfig: defaultGridStatusConfig, validateConfig: validateGridStatusConfig });
  registry.register({ type: CLIMATE_CONTROL_TYPE, displayName: "Climate control", renderer: renderClimateControlCard, editor: renderClimateControlEditor, defaultConfig: defaultClimateControlConfig, validateConfig: validateClimateControlConfig });
  registry.register({ type: LIGHT_CONTROL_TYPE, displayName: "Light control", renderer: renderLightControlCard, editor: renderLightControlEditor, defaultConfig: defaultLightControlConfig, validateConfig: validateLightControlConfig });
  registry.register({ type: SWITCH_CONTROL_TYPE, displayName: "Switch control", renderer: renderSwitchControlCard, editor: renderSwitchControlEditor, defaultConfig: defaultSwitchControlConfig, validateConfig: validateSwitchControlConfig });
  registry.register({ type: COVER_CONTROL_TYPE, displayName: "Cover control", renderer: renderCoverControlCard, editor: renderCoverControlEditor, defaultConfig: defaultCoverControlConfig, validateConfig: validateCoverControlConfig });
  registry.register({ type: SENSOR_STATUS_TYPE, displayName: "Sensor status", renderer: renderSensorStatusCard, editor: renderSensorStatusEditor, defaultConfig: defaultSensorStatusConfig, validateConfig: validateSensorStatusConfig });
  registry.register({ type: MEDIA_PLAYER_CONTROL_TYPE, displayName: "Media player control", renderer: renderMediaPlayerControlCard, editor: renderMediaPlayerControlEditor, defaultConfig: defaultMediaPlayerControlConfig, validateConfig: validateMediaPlayerControlConfig });
  registry.register({ type: CAMERA_STATUS_TYPE, displayName: "Camera status", renderer: renderCameraStatusCard, editor: renderCameraStatusEditor, defaultConfig: defaultCameraStatusConfig, validateConfig: validateCameraStatusConfig });
  registry.register({ type: FAN_CONTROL_TYPE, displayName: "Fan control", renderer: renderFanControlCard, editor: renderFanControlEditor, defaultConfig: defaultFanControlConfig, validateConfig: validateFanControlConfig });
  registry.register({ type: VACUUM_CONTROL_TYPE, displayName: "Vacuum control", renderer: renderVacuumControlCard, editor: renderVacuumControlEditor, defaultConfig: defaultVacuumControlConfig, validateConfig: validateVacuumControlConfig });
  return registry;
}

export function createDefaultCardRegistry() { return registerBuiltInCardTypes(createCardRegistry()); }
export const DEFAULT_CARD_REGISTRY = createDefaultCardRegistry();

export function registerCardType(definition, registry = DEFAULT_CARD_REGISTRY) { return registry.register(definition); }
export function getCardType(type, registry = DEFAULT_CARD_REGISTRY) { return registry.get(type); }
export function listCardTypes(registry = DEFAULT_CARD_REGISTRY) { return registry.list(); }
export function clearCardRegistryForTests(registry = DEFAULT_CARD_REGISTRY) { registry.clear(); }

export function renderUnknownCard(card) {
  const shell = el("article", { className: "dashboardmodern-card legacy-card", attrs: { "data-card-kind": "unknown", "data-card-id": card?.id || "", "data-unsupported-card-type": card?.type || "" } });
  shell.append(el("h4", { text: card?.title || "Unsupported card" }));
  shell.append(el("p", { className: "dashboardmodern-card-type", text: `Card type: ${card?.type || "unknown"}` }));
  if (card?.config && typeof card.config === "object" && !Array.isArray(card.config)) {
    const keys = Object.keys(card.config).sort();
    shell.append(el("p", { text: keys.length ? `Configuration keys: ${keys.join(", ")}` : "No card configuration." }));
  }
  shell.append(emptyState("This card type is not registered yet. Its JSON config remains editable."));
  return shell;
}
