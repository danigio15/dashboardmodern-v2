/* DashboardModern 0.14.14: final ownership gates for appliance cards and DOM observers. */
const DOM_STABILITY_KEY = "__DASHBOARDMODERN_RELEASE_0154_DOM_STABILITY__";
const LEGACY_COMPAT_OBSERVER_KEY = "__DASHBOARDMODERN_0147_DOM_COMPAT_OBSERVER__";

function domState0154() {
  return (globalThis[DOM_STABILITY_KEY] ||= {
    applianceSignature: "",
    monitor: null,
    monitorTicks: 0,
  });
}

function functionChainHas0154Dom(fn, marker) {
  const seen = new Set();
  let current = fn;
  while (typeof current === "function" && !seen.has(current)) {
    if (current[marker]) return true;
    seen.add(current);
    current = current.__dmPrevious;
  }
  return false;
}

function applianceItems0154Dom() {
  try {
    const items = globalThis.DashboardModernModules?.store?.getSection?.("appliances");
    return Array.isArray(items) ? items : [];
  } catch (_error) {
    return [];
  }
}

function entityIds0154Dom(item = {}) {
  return [...new Set([
    ...(Array.isArray(item.entities) ? item.entities : []),
    item.control_entity,
    item.power_entity,
    item.energy_entity,
    item.total_energy_entity,
    item.daily_energy_entity,
    item.history_entity,
  ].map((value) => (typeof value === "string" ? value : value?.entity)).filter(Boolean))];
}

function stateSignature0154Dom(entity) {
  const state = globalThis._RAW_STATES?.[entity] || globalThis.STATES?.[entity];
  const attributes = state?.attributes || {};
  return [
    entity,
    state?.state ?? "",
    attributes.unit_of_measurement ?? "",
    attributes.device_class ?? "",
    attributes.state_class ?? "",
  ].join(":");
}

function applianceSignature0154Dom() {
  const items = applianceItems0154Dom();
  return JSON.stringify({
    language: globalThis.document?.documentElement?.lang || "",
    room: globalThis._dmApplRoom || "all",
    active: globalThis.document?.querySelector?.(".appl-main-view.active")?.id || "",
    items: items.map((item) => {
      const entities = entityIds0154Dom(item);
      return {
        id: item.id,
        name: item.name,
        room_id: item.room_id,
        room: item.room,
        visual_type: item.visual_type,
        visual_key: item.visual_key,
        device_type: item.device_type,
        type: item.type,
        icon: item.icon,
        threshold_run: item.threshold_run,
        entities,
        states: entities.map(stateSignature0154Dom),
      };
    }),
  });
}

function applianceCardsReady0154Dom() {
  const grid = globalThis.document?.getElementById?.("appl-grid-overview");
  if (!grid) return false;
  const expected = applianceItems0154Dom().length;
  return grid.querySelectorAll(".appl-wide-card[data-appliance-id]").length === expected;
}

function markFinalOwner0154(fn) {
  if (typeof fn !== "function") return;
  fn.__dm0154FinalTopGate = true;
  fn.__dm0154StableRenderGate = true;
  fn.__dm0154SingleArtworkOwner = true;
  fn.__dm0154MetricHook = true;
  fn.__dm0147AssetMarkers = true;
}

function installFinalApplianceGate0154() {
  const current = globalThis.renderApplianceSection;
  if (typeof current !== "function") return false;
  if (functionChainHas0154Dom(current, "__dm0154FinalTopGate")) {
    markFinalOwner0154(current);
    return true;
  }

  const state = domState0154();
  if (applianceCardsReady0154Dom()) state.applianceSignature = applianceSignature0154Dom();

  function finalApplianceRender0154(...args) {
    const signature = applianceSignature0154Dom();
    if (applianceCardsReady0154Dom() && signature === state.applianceSignature) return false;
    state.applianceSignature = signature;
    try {
      const result = current.apply(this, args);
      if (result && typeof result.catch === "function") {
        result.catch(() => {
          state.applianceSignature = "";
        });
      }
      return result;
    } catch (error) {
      state.applianceSignature = "";
      throw error;
    }
  }

  markFinalOwner0154(finalApplianceRender0154);
  finalApplianceRender0154.__dmPrevious = current;
  globalThis.renderApplianceSection = finalApplianceRender0154;
  return true;
}

function narrowLegacyCompatibilityObserver0154() {
  const observer = globalThis[LEGACY_COMPAT_OBSERVER_KEY];
  if (!observer?.disconnect || !observer?.observe || observer.__dm0154Narrowed) return false;
  try {
    observer.disconnect();
    const root = globalThis.document?.body || globalThis.document?.documentElement;
    if (!root) return false;
    observer.observe(root, { childList: true, subtree: true });
    observer.__dm0154Narrowed = true;
    return true;
  } catch (_error) {
    return false;
  }
}

function installDomStability0154() {
  narrowLegacyCompatibilityObserver0154();
  installFinalApplianceGate0154();
}

function monitorDomStability0154() {
  const state = domState0154();
  if (state.monitor || typeof globalThis.setInterval !== "function") return;
  state.monitorTicks = 0;
  state.monitor = globalThis.setInterval(() => {
    state.monitorTicks += 1;
    installDomStability0154();
    if (state.monitorTicks >= 40) {
      globalThis.clearInterval?.(state.monitor);
      state.monitor = null;
    }
  }, 100);
}

if (typeof globalThis.document !== "undefined") {
  installDomStability0154();
  monitorDomStability0154();
  globalThis.queueMicrotask?.(installDomStability0154);
  globalThis.setTimeout?.(installDomStability0154, 0);
  globalThis.setTimeout?.(installDomStability0154, 120);
  globalThis.setTimeout?.(installDomStability0154, 500);
  globalThis.setTimeout?.(installDomStability0154, 1600);
  globalThis.setTimeout?.(installDomStability0154, 15600);
  globalThis.addEventListener?.("dashboardmodern:legacy-ready", installDomStability0154);
  globalThis.addEventListener?.("pageshow", installDomStability0154);
}
