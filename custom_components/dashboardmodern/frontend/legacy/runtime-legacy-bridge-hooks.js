/* DashboardModern 0.15.0 — scoped, non-invasive legacy bridge hooks. */
(function installLegacyBridgeHooks0150(root) {
  "use strict";

  const KEY = "__DASHBOARDMODERN_LEGACY_BRIDGE_HOOKS__";
  if (root[KEY]?.installed) return;
  const doc = root.document;
  if (!doc) return;

  const state = (root[KEY] = {
    installed: true,
    version: "0.15.0",
    attempts: 0,
    brokerWrapped: false,
    editorObserver: null,
    editorBody: null,
    applianceObserver: null,
    applianceGrid: null,
    temperatureSaving: false,
  });
  const clean = (value) => String(value ?? "").trim();
  const english = () =>
    clean(doc.documentElement.lang).toLowerCase().startsWith("en") ||
    /dashboard-en\.html/i.test(root.location?.pathname || "");
  const bridge = () => root.__DASHBOARDMODERN_LEGACY_PERIOD_BRIDGE__ || null;
  const runtimeState = () => root.__DASHBOARDMODERN_RUNTIME_0150__ || null;
  const runtimeApi = () => root.DashboardModernRuntime0150 || null;
  const store = () => root.DashboardModernModules?.store || null;

  function isCurrent(value = new Date()) {
    const date = new Date(value);
    const now = new Date();
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }

  function projectBundle(bundle = runtimeState()?.bundle) {
    if (!bridge()?.project || !bundle?.period) return false;
    return bridge().project(bundle);
  }

  function projectDerivedStates() {
    if (!bridge()?.set) return false;
    const states = { ...(root._RAW_STATES || {}), ...(root.STATES || {}) };
    Object.entries(states).forEach(([slot, item]) => {
      if (!item?.attributes?.dashboardmodern_derived) return;
      const kind = item.attributes.dashboardmodern_period;
      const selected = item.attributes.dashboardmodern_selected;
      if (kind === "month" && selected && !isCurrent(selected)) return;
      bridge().set(slot, item.state);
    });
    return true;
  }

  function installBrokerHook() {
    const broker = runtimeApi()?.broker;
    const current = broker?.ingestState;
    if (typeof current !== "function") return false;
    if (current.__dmLegacyBridgeHooksV2) {
      state.brokerWrapped = true;
      return true;
    }
    function ingestLegacyBridgeHooks0150(item) {
      const result = current.call(this, item);
      if (item?.attributes?.dashboardmodern_derived && bridge()?.set) {
        const kind = item.attributes.dashboardmodern_period;
        const selected = item.attributes.dashboardmodern_selected;
        if (kind !== "month" || !selected || isCurrent(selected)) {
          bridge().set(clean(item.entity_id), item.state);
        }
      }
      return result;
    }
    ingestLegacyBridgeHooks0150.__dmLegacyBridgeHooksV2 = true;
    ingestLegacyBridgeHooks0150.__dmPrevious = current;
    broker.ingestState = ingestLegacyBridgeHooks0150;
    state.brokerWrapped = true;
    return true;
  }

  function decorateIrrigationEditor() {
    const body = doc.getElementById("ed-body");
    if (!body || doc.querySelector(".ed-tab.active")?.dataset?.tab !== "irr") return false;
    body.classList.add("dm-irrigation-form");
    const placeholders = {
      "ed-irr-ent": "switch.irrigazione_zona1",
      "ed-irr-rain": "sensor.prob_pioggia_oggi",
      "ed-irr-weather": "weather.casa",
    };
    Object.entries(placeholders).forEach(([id, placeholder]) => {
      const input = doc.getElementById(id);
      if (!input) return;
      input.placeholder = placeholder;
      input.value = clean(input.value).replace(/[\\"]/g, "");
      const holder = input.closest("label,.ed-slot") || input.parentElement;
      if (holder) holder.dataset.entityField = "";
      let button = input.nextElementSibling;
      if (!button?.matches?.("button")) button = holder?.querySelector?.("button");
      if (!button) {
        button = doc.createElement("button");
        input.insertAdjacentElement("afterend", button);
      }
      button.type = "button";
      button.classList.add("dm-entity-picker");
      button.dataset.entityTarget = id;
      if (!clean(button.textContent)) button.textContent = "🔍";
    });
    root.DashboardModernModules?.render?.mountEntityPickers?.(body);
    return true;
  }

  function normalizeApplianceCards() {
    doc.querySelectorAll("#page-appliances-main .appl-wide-card").forEach((card) => {
      const mini = card.querySelector(".appl-mini");
      if (!mini) return;
      const amount = (mini.textContent.match(/[\d.,]+\s*kWh/i) || [""])[0].trim();
      const expected = `${english() ? "Total" : "Totale"}${amount ? ` ${amount}` : ""}`;
      if (mini.textContent.trim() !== expected) mini.textContent = expected;
    });
  }

  function installScopedObservers() {
    const body = doc.getElementById("ed-body");
    if (body && state.editorBody !== body) {
      state.editorObserver?.disconnect?.();
      state.editorBody = body;
      state.editorObserver = new MutationObserver(() => root.queueMicrotask?.(decorateIrrigationEditor));
      state.editorObserver.observe(body, { childList: true, subtree: true });
      decorateIrrigationEditor();
    }
    const grid = doc.getElementById("appl-grid-overview");
    if (grid && state.applianceGrid !== grid) {
      state.applianceObserver?.disconnect?.();
      state.applianceGrid = grid;
      state.applianceObserver = new MutationObserver(() => root.queueMicrotask?.(normalizeApplianceCards));
      state.applianceObserver.observe(grid, { childList: true, subtree: true });
      normalizeApplianceCards();
    }
  }

  async function saveTemperatureFromForm() {
    if (state.temperatureSaving) return;
    const dashboardStore = store();
    const roomId = clean(doc.getElementById("dm-temperature-room")?.value);
    const temp = clean(doc.getElementById("ed-pl-temp")?.value);
    const hum = clean(doc.getElementById("dm-humidity-new")?.value);
    if (!dashboardStore?.updateItem || !roomId || (!temp && !hum)) return;
    state.temperatureSaving = true;
    try {
      await dashboardStore.updateItem("rooms", roomId, { temp, hum });
    } catch (_error) {
    } finally {
      state.temperatureSaving = false;
    }
  }

  function apply() {
    installBrokerHook();
    installScopedObservers();
    decorateIrrigationEditor();
    normalizeApplianceCards();
    projectBundle();
    projectDerivedStates();
    return true;
  }
  state.project = apply;

  function scheduleApply() {
    [0, 30, 80, 160, 320, 650, 1100, 1800, 2600].forEach((delay) =>
      root.setTimeout?.(apply, delay),
    );
  }

  function settle() {
    state.attempts += 1;
    apply();
    const ready = Boolean(bridge()?.ready?.() && runtimeState()?.ready && runtimeState()?.bundle);
    if (!ready && state.attempts < 300) root.requestAnimationFrame?.(settle);
    else scheduleApply();
  }

  doc.addEventListener(
    "click",
    (event) => {
      if (event.target?.closest?.("[data-temperature-submit]")) saveTemperatureFromForm();
      root.queueMicrotask?.(apply);
    },
    true,
  );
  doc.addEventListener("change", () => root.queueMicrotask?.(apply), true);
  root.addEventListener?.("dashboardmodern:runtime-ready", scheduleApply);
  root.addEventListener?.("dashboardmodern:period-bundle", scheduleApply);
  root.addEventListener?.("dashboardmodern:energy-statistics", scheduleApply);
  root.addEventListener?.("dashboardmodern:legacy-period-bridge-ready", scheduleApply);
  root.addEventListener?.("pageshow", scheduleApply);
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", settle, { once: true });
  else settle();
})(globalThis);
