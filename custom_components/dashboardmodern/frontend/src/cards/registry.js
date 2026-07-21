import { renderLegacyPanelCard, renderLegacyPanelEditor, validateLegacyPanelConfig, LEGACY_PANEL_TYPE } from "./legacy-panel.js";
import { HOME_SUMMARY_TYPE, defaultHomeSummaryConfig, renderHomeSummaryCard, renderHomeSummaryEditor, validateHomeSummaryConfig } from "./home-summary.js";
import { WEATHER_CURRENT_TYPE, WEATHER_FORECAST_TYPE, defaultWeatherCurrentConfig, defaultWeatherForecastConfig, renderWeatherCurrentCard, renderWeatherCurrentEditor, renderWeatherForecastCard, renderWeatherForecastEditor, validateWeatherCurrentConfig, validateWeatherForecastConfig } from "./weather.js";
import { el, emptyState } from "../render/dom.js";

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
  registry.register({ type: LEGACY_PANEL_TYPE, displayName: "Legacy panel", renderer: renderLegacyPanelCard, editor: renderLegacyPanelEditor, defaultConfig: () => ({ accent: "primary", subtitle: "", status: "", body: "" }), validateConfig: validateLegacyPanelConfig });
  registry.register({ type: HOME_SUMMARY_TYPE, displayName: "Home summary", renderer: renderHomeSummaryCard, editor: renderHomeSummaryEditor, defaultConfig: defaultHomeSummaryConfig, validateConfig: validateHomeSummaryConfig });
  registry.register({ type: WEATHER_CURRENT_TYPE, displayName: "Weather current", renderer: renderWeatherCurrentCard, editor: renderWeatherCurrentEditor, defaultConfig: defaultWeatherCurrentConfig, validateConfig: validateWeatherCurrentConfig });
  registry.register({ type: WEATHER_FORECAST_TYPE, displayName: "Weather forecast", renderer: renderWeatherForecastCard, editor: renderWeatherForecastEditor, defaultConfig: defaultWeatherForecastConfig, validateConfig: validateWeatherForecastConfig });
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
