import { DEFAULT_CARD_REGISTRY } from "../cards/registry.js";
import { DEFAULT_PLUGIN_MANAGER, createPluginManager } from "../plugins/registry.js";
import { DEFAULT_SECTION_REGISTRY } from "../sections/registry.js";
import { DEFAULT_WIDGET_REGISTRY } from "../widgets/registry.js";
import { HOME_MODULE } from "./home.js";
import { LIGHTS_MODULE } from "./lights.js";
import { COVERS_MODULE } from "./covers.js";
import { CLIMATE_MODULE } from "./climate.js";
import { ENERGY_MODULE } from "./energy.js";
import { APPLIANCES_MODULE } from "./appliances.js";
import { VEHICLES_MODULE } from "./vehicles.js";
import { CAMERAS_MODULE } from "./cameras.js";
import { MEDIA_MODULE } from "./media.js";
import { SECURITY_MODULE } from "./security.js";

export function registerBuiltInModules({ pluginManager = DEFAULT_PLUGIN_MANAGER, sectionRegistry = DEFAULT_SECTION_REGISTRY, widgetRegistry = DEFAULT_WIDGET_REGISTRY, cardRegistry = DEFAULT_CARD_REGISTRY } = {}) {
  const manager = pluginManager || createPluginManager({ sectionRegistry, widgetRegistry, cardRegistry });
  manager.registerModule(LIGHTS_MODULE);
  manager.registerModule(HOME_MODULE);
  manager.registerModule(COVERS_MODULE);
  manager.registerModule(CLIMATE_MODULE);
  manager.registerModule(ENERGY_MODULE);
  manager.registerModule(APPLIANCES_MODULE);
  manager.registerModule(VEHICLES_MODULE);
  manager.registerModule(CAMERAS_MODULE);
  manager.registerModule(MEDIA_MODULE);
  manager.registerModule(SECURITY_MODULE);
  return manager.contributions();
}
