import { DEFAULT_CARD_REGISTRY } from "../cards/registry.js";
import { DEFAULT_SECTION_REGISTRY } from "../sections/registry.js";
import { DEFAULT_WIDGET_REGISTRY } from "../widgets/registry.js";

export function normalizeModuleDefinition(module) {
  if (!module?.id || typeof module.id !== "string") throw new Error("Module id is required.");
  return {
    schemaVersion: 1,
    plugins: [],
    sections: [],
    cards: [],
    widgets: [],
    editorPanels: [],
    navigationEntries: [],
    badges: [],
    actions: [],
    detailPanels: [],
    defaultLayouts: [],
    discovery: {},
    ...module,
  };
}

export function createPluginManager({
  sectionRegistry = DEFAULT_SECTION_REGISTRY,
  cardRegistry = DEFAULT_CARD_REGISTRY,
  widgetRegistry = DEFAULT_WIDGET_REGISTRY,
} = {}) {
  const modules = new Map();

  return {
    registerModule(module) {
      const normalized = normalizeModuleDefinition(module);
      if (modules.has(normalized.id)) throw new Error(`Module already registered: ${normalized.id}`);

      for (const section of normalized.sections) {
        sectionRegistry.register({ ...section, owner: normalized.id });
      }
      for (const card of normalized.cards) {
        cardRegistry.register({ ...card, owner: normalized.id });
      }
      for (const widget of normalized.widgets) {
        widgetRegistry.register({ ...widget, owner: normalized.id });
      }

      const registered = Object.freeze(normalized);
      modules.set(normalized.id, registered);
      return registered;
    },

    listModules() {
      return [...modules.values()].sort((a, b) => a.id.localeCompare(b.id));
    },

    contributions() {
      const all = this.listModules();
      return {
        modules: all,
        sections: all.flatMap((m) => m.sections),
        cards: all.flatMap((m) => m.cards),
        widgets: all.flatMap((m) => m.widgets),
        editorPanels: all.flatMap((m) => m.editorPanels),
        navigationEntries: all.flatMap((m) => m.navigationEntries),
        badges: all.flatMap((m) => m.badges),
        actions: all.flatMap((m) => m.actions),
        detailPanels: all.flatMap((m) => m.detailPanels),
        defaultLayouts: all.flatMap((m) => m.defaultLayouts),
      };
    },

    clear() {
      modules.clear();
    },
  };
}

export const DEFAULT_PLUGIN_MANAGER = createPluginManager();
