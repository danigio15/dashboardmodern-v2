/* DashboardModern 0.14.14: isolate the new period engine from legacy refresh events. */
const LEGACY_EVENT = "dashboardmodern:energy-statistics";
const KEY = "__DASHBOARDMODERN_RELEASE_0154_PRELUDE__";

if (!globalThis[KEY] && typeof globalThis.addEventListener === "function") {
  const original = globalThis.addEventListener;
  const state = {
    original,
    skippedLegacyListener: false,
  };

  globalThis.addEventListener = function addEventListener0154(type, listener, options) {
    if (type === LEGACY_EVENT && !state.skippedLegacyListener) {
      state.skippedLegacyListener = true;
      return undefined;
    }
    return original.call(this, type, listener, options);
  };
  globalThis[KEY] = state;
}
