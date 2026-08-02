/* DashboardModern 0.14.14: suppress identical forced appliance rerenders. */
const FLAG = "__DASHBOARDMODERN_RELEASE_0154_RENDER_STABILITY__";

function applianceItems0154() {
  try {
    const items = globalThis.DashboardModernModules?.store?.getSection?.("appliances");
    return Array.isArray(items) ? items : [];
  } catch (_error) {
    return [];
  }
}

function entityIds0154(item = {}) {
  return [...new Set([
    ...(Array.isArray(item.entities) ? item.entities : []),
    item.control_entity,
    item.power_entity,
    item.total_energy_entity,
    item.daily_energy_entity,
    item.history_entity,
  ].map((value) => typeof value === "string" ? value : value?.entity).filter(Boolean))];
}

function stateSignature0154(entityId) {
  const state = globalThis.STATES?.[entityId] || globalThis._RAW_STATES?.[entityId];
  if (!state) return `${entityId}:`;
  const attributes = state.attributes || {};
  return [
    entityId,
    state.state,
    attributes.unit_of_measurement,
    attributes.device_class,
    attributes.state_class,
  ].join(":");
}

function renderSignature0154() {
  const items = applianceItems0154();
  const active = globalThis.document?.querySelector?.(".appl-main-view.active")?.id || "";
  return JSON.stringify({
    language: globalThis.document?.documentElement?.lang || "",
    room: globalThis._dmApplRoom || "all",
    active,
    items: items.map((item) => ({
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
      entities: entityIds0154(item),
      states: entityIds0154(item).map(stateSignature0154),
    })),
  });
}

function cardsReady0154() {
  const grid = globalThis.document?.getElementById?.("appl-grid-overview");
  if (!grid) return false;
  const expected = applianceItems0154().length;
  return grid.querySelectorAll(".appl-wide-card[data-appliance-id]").length === expected;
}

function install0154() {
  const current = globalThis.renderApplianceSection;
  if (typeof current !== "function" || current.__dm0154StableRenderGate) return false;
  const state = (globalThis[FLAG] ||= { signature: "" });
  if (cardsReady0154()) state.signature = renderSignature0154();

  function stableRenderApplianceSection0154(...args) {
    const signature = renderSignature0154();
    if (signature === state.signature && cardsReady0154()) return false;
    state.signature = signature;
    try {
      const result = current.apply(this, args);
      if (result && typeof result.catch === "function") {
        result.catch(() => {
          state.signature = "";
        });
      }
      return result;
    } catch (error) {
      state.signature = "";
      throw error;
    }
  }

  stableRenderApplianceSection0154.__dm0154StableRenderGate = true;
  stableRenderApplianceSection0154.__dmPrevious = current;
  globalThis.renderApplianceSection = stableRenderApplianceSection0154;
  return true;
}

function installUntilStable0154() {
  install0154();
  globalThis.queueMicrotask?.(install0154);
  globalThis.setTimeout?.(install0154, 0);
  globalThis.setTimeout?.(install0154, 120);
  globalThis.setTimeout?.(install0154, 500);
}

if (typeof globalThis.document !== "undefined") {
  installUntilStable0154();
  globalThis.addEventListener?.("dashboardmodern:legacy-ready", installUntilStable0154);
  if (globalThis.document.readyState === "loading") {
    globalThis.document.addEventListener("DOMContentLoaded", installUntilStable0154, { once: true });
  }
}
