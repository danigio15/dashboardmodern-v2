// Compatibility shim retained while section-runtime still imports this module.
// Temperature layout and rendering are now owned entirely by temperature-section.js.
// This shim only preserves the two optional Temperature display-name fields
// through the canonical room normalizer; it does not render, style or observe DOM.
import { clean, dashboardStore, root } from "./shared.js";

const KEY = "__DASHBOARDMODERN_TEMPERATURE_LABEL_MODEL_COMPAT__";
const state = (root[KEY] ||= { patched: false });

function preserveTemperatureLabels(store) {
  if (!store || state.patched || typeof store._normalizeItem !== "function") return false;
  const current = store._normalizeItem.bind(store);
  store._normalizeItem = function normalizeItemWithTemperatureLabels(section, item, index) {
    const normalized = current(section, item, index);
    if (section !== "rooms" || !normalized) return normalized;
    normalized.temp_name = clean(item?.temp_name || item?.temperature_name);
    normalized.hum_name = clean(item?.hum_name || item?.humidity_name);
    return normalized;
  };
  state.patched = true;
  return true;
}

export function installTemperatureLayoutSection() {
  preserveTemperatureLabels(dashboardStore());
  return false;
}