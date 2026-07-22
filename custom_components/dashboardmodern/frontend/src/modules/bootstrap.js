import { DEFAULT_CARD_REGISTRY } from "../cards/registry.js";
import { DEFAULT_PLUGIN_MANAGER, createPluginManager } from "../plugins/registry.js";
import { DEFAULT_SECTION_REGISTRY } from "../sections/registry.js";
import { DEFAULT_WIDGET_REGISTRY } from "../widgets/registry.js";
import { HOME_MODULE } from "./home.js";
import { LIGHTS_MODULE } from "./lights.js";

export function registerBuiltInModules({ pluginManager = DEFAULT_PLUGIN_MANAGER, sectionRegistry = DEFAULT_SECTION_REGISTRY, widgetRegistry = DEFAULT_WIDGET_REGISTRY, cardRegistry = DEFAULT_CARD_REGISTRY } = {}) {
  const manager = pluginManager || createPluginManager({ sectionRegistry, widgetRegistry, cardRegistry });
  manager.registerModule(LIGHTS_MODULE);
  manager.registerModule(HOME_MODULE);
  return manager.contributions();
}
