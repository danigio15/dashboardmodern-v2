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
import { ROOMS_MODULE } from "./rooms.js";

const BUILT_IN_MODULES = [
  LIGHTS_MODULE,
  HOME_MODULE,
  COVERS_MODULE,
  CLIMATE_MODULE,
  ENERGY_MODULE,
  APPLIANCES_MODULE,
  VEHICLES_MODULE,
  CAMERAS_MODULE,
  MEDIA_MODULE,
  SECURITY_MODULE,
  ROOMS_MODULE,
];

export function registerBuiltInModules({ pluginManager = DEFAULT_PLUGIN_MANAGER, sectionRegistry = DEFAULT_SECTION_REGISTRY, widgetRegistry = DEFAULT_WIDGET_REGISTRY, cardRegistry = DEFAULT_CARD_REGISTRY } = {}) {
  const manager = pluginManager || createPluginManager({ sectionRegistry, widgetRegistry, cardRegistry });
  for (const module of BUILT_IN_MODULES) {
    if (!manager.hasModule(module.id)) manager.registerModule(module);
  }
  return manager.contributions();
}