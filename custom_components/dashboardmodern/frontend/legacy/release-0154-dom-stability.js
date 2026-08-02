/* DashboardModern 0.14.14: final ownership gates for appliance cards and editor DOM. */
const DOM_STABILITY_KEY = "__DASHBOARDMODERN_RELEASE_0154_DOM_STABILITY__";
const LEGACY_COMPAT_OBSERVER_KEY = "__DASHBOARDMODERN_0147_DOM_COMPAT_OBSERVER__";

function now0154Dom() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function domState0154() {
  return (globalThis[DOM_STABILITY_KEY] ||= {
    applianceSignature: "",
    allowAlertRenderUntil: 0,
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

function installFinalApplianceGate0154() {
  const current = globalThis.renderApplianceSection;
  if (typeof current !== "function" || current.__dm0154FinalTopGate) return false;
  const state = domState0154();
  if (applianceCardsReady0154Dom()) state.applianceSignature = applianceSignature0154Dom();

  function finalApplianceRender0154(...args) {
    const signature = applianceSignature0154Dom();
    const forced = args[0] === true;
    if (!forced && applianceCardsReady0154Dom() && signature === state.applianceSignature) {
      return false;
    }
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

  finalApplianceRender0154.__dm0154FinalTopGate = true;
  finalApplianceRender0154.__dm0154StableRenderGate = true;
  finalApplianceRender0154.__dm0154SingleArtworkOwner = true;
  finalApplianceRender0154.__dm0154MetricHook = true;
  finalApplianceRender0154.__dm0147AssetMarkers = true;
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

function allowAlertEditorRender0154() {
  domState0154().allowAlertRenderUntil = now0154Dom() + 1200;
}

function installAlertActionGuard0154(name) {
  const current = globalThis[name];
  if (typeof current !== "function" || functionChainHas0154Dom(current, "__dm0154AlertAction")) {
    return false;
  }
  function alertAction0154(...args) {
    allowAlertEditorRender0154();
    return current.apply(this, args);
  }
  alertAction0154.__dm0154AlertAction = true;
  alertAction0154.__dmPrevious = current;
  globalThis[name] = alertAction0154;
  return true;
}

function installEditorSwitchGuard0154() {
  const current = globalThis.editorSwitch;
  if (typeof current !== "function" || functionChainHas0154Dom(current, "__dm0154EditorSwitchGuard")) {
    return false;
  }

  function stableEditorSwitch0154(tab, ...args) {
    const target = String(tab || "");
    if (target === "avvisi") {
      const active = globalThis.document?.querySelector?.(".ed-tab.active")?.dataset?.tab || "";
      const modal = globalThis.document?.getElementById?.("editor-modal");
      const body = globalThis.document?.getElementById?.("ed-body");
      const sameMountedTab =
        active === "avvisi" &&
        modal?.classList?.contains("show") &&
        Boolean(body?.children?.length);
      if (sameMountedTab && now0154Dom() > domState0154().allowAlertRenderUntil) return false;
    }
    return current.call(this, tab, ...args);
  }

  stableEditorSwitch0154.__dm0154EditorSwitchGuard = true;
  stableEditorSwitch0154.__dmPrevious = current;
  globalThis.editorSwitch = stableEditorSwitch0154;
  return true;
}

function markCompatibilityOwner0154() {
  const current = globalThis.renderApplianceSection;
  if (!functionChainHas0154Dom(current, "__dm0147AssetMarkers")) return false;
  if (!current.__dm0147AssetMarkers) current.__dm0147AssetMarkers = true;
  return true;
}

function installDomStability0154() {
  narrowLegacyCompatibilityObserver0154();
  installFinalApplianceGate0154();
  markCompatibilityOwner0154();
  [
    "dmRealEditAlert",
    "edEditAvvisoStandard",
    "edAddAvviso",
    "edDelAvviso",
    "edEditAvvisoCustom",
    "edDelAvvisoCustom",
    "edAvvCancelEdit",
  ].forEach(installAlertActionGuard0154);
  installEditorSwitchGuard0154();
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
