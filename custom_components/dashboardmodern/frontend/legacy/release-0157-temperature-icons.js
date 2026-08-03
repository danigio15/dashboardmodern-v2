/* DashboardModern 0.14.17: local fallbacks for room icons when MDI is unavailable. */
const ICON_STATE_0157 = "__DASHBOARDMODERN_RELEASE_0157_TEMPERATURE_ICONS__";

const ROOM_GLYPHS_0157 = Object.freeze({
  "mdi:sofa": "🛋️",
  "mdi:balcony": "🌿",
  "mdi:bed": "🛏️",
  "mdi:bed-king-outline": "🛏️",
  "mdi:chef-hat": "🍳",
  "mdi:stove": "🍳",
  "mdi:shower": "🚿",
  "mdi:bathtub-outline": "🛁",
  "mdi:desk": "🖥️",
  "mdi:garage": "🚗",
  "mdi:home": "🏠",
  "mdi:home-outline": "🏠",
  "mdi:thermometer": "🌡️"
});

function glyph0157(icon) {
  const key = String(icon || "").trim().toLowerCase();
  return ROOM_GLYPHS_0157[key] || (key.startsWith("mdi:") ? "🏠" : key || "🏠");
}

function ensureTemperatureIcons0157(root = document) {
  root.querySelectorAll?.(".temp-room-icon[data-room-icon]").forEach((node) => {
    if (String(node.textContent || "").trim()) return;
    if (node.querySelector("svg,img,ha-icon")) return;
    const fallback = document.createElement("span");
    fallback.className = "dm-temperature-icon-fallback-0157";
    fallback.setAttribute("aria-hidden", "true");
    fallback.textContent = glyph0157(node.getAttribute("data-room-icon"));
    node.append(fallback);
  });
}

function wrapTemperatureRenderer0157(name) {
  const original = globalThis[name];
  if (typeof original !== "function" || original.__dm0157TemperatureIcons) return false;
  function wrappedTemperatureRenderer0157(...args) {
    const result = original.apply(this, args);
    if (result && typeof result.finally === "function") {
      return result.finally(() => queueMicrotask(() => ensureTemperatureIcons0157()));
    }
    queueMicrotask(() => ensureTemperatureIcons0157());
    return result;
  }
  wrappedTemperatureRenderer0157.__dm0157TemperatureIcons = true;
  wrappedTemperatureRenderer0157.__dmPrevious = original;
  globalThis[name] = wrappedTemperatureRenderer0157;
  return true;
}

function settleTemperatureIcons0157() {
  const wrapped = ["buildTempCards", "renderTemperature"].map(wrapTemperatureRenderer0157).some(Boolean);
  ensureTemperatureIcons0157();
  return wrapped || ["buildTempCards", "renderTemperature"].some(
    (name) => globalThis[name]?.__dm0157TemperatureIcons
  );
}

function retryTemperatureIcons0157(attempt = 0) {
  const state = (globalThis[ICON_STATE_0157] ||= { retry: 0 });
  if (settleTemperatureIcons0157() || attempt >= 20) return;
  clearTimeout(state.retry);
  state.retry = setTimeout(() => retryTemperatureIcons0157(attempt + 1), 75);
}

function installTemperatureIcons0157() {
  document.addEventListener("click", (event) => {
    if (!event.target?.closest?.('.tab[data-tab="temp"],.tab[data-tab="temperature"]')) return;
    queueMicrotask(() => ensureTemperatureIcons0157());
    setTimeout(() => ensureTemperatureIcons0157(), 0);
  }, true);
  globalThis.addEventListener?.("dashboardmodern:legacy-ready", () => retryTemperatureIcons0157(0));
  globalThis.addEventListener?.("pageshow", () => retryTemperatureIcons0157(0));
  retryTemperatureIcons0157(0);
}

globalThis.__DASHBOARDMODERN_RELEASE_0157_ENSURE_TEMPERATURE_ICONS__ = ensureTemperatureIcons0157;

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installTemperatureIcons0157, { once: true });
  } else {
    installTemperatureIcons0157();
  }
}
