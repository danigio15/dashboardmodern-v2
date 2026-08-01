/* DashboardModern 0.14.14: keep a single owner for final appliance style order. */
const LEGACY_STYLE_OBSERVER_KEY = "__DASHBOARDMODERN_MEDIA_STYLE_OBSERVER_0153__";
const GUARD_KEY = "__DASHBOARDMODERN_RELEASE_0154_STYLE_OBSERVER_GUARD__";

function disableLegacyStyleObserver0154() {
  const existing = globalThis[LEGACY_STYLE_OBSERVER_KEY];
  try {
    existing?.disconnect?.();
  } catch (_error) {}

  // Keep a truthy sentinel so the legacy installer does not recreate the
  // observer during its delayed retries or the legacy-ready event.
  globalThis[LEGACY_STYLE_OBSERVER_KEY] = Object.freeze({
    disconnect() {},
    dashboardmodern_disabled: true,
  });
  globalThis[GUARD_KEY] = true;
}

disableLegacyStyleObserver0154();
globalThis.queueMicrotask?.(disableLegacyStyleObserver0154);
globalThis.setTimeout?.(disableLegacyStyleObserver0154, 0);
globalThis.setTimeout?.(disableLegacyStyleObserver0154, 250);
globalThis.addEventListener?.("dashboardmodern:legacy-ready", disableLegacyStyleObserver0154);
