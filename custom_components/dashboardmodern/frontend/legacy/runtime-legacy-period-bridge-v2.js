/* DashboardModern 0.15.0 — classic bridge for lexical legacy period registries. */
(function installLegacyPeriodBridge0150(root) {
  "use strict";

  const KEY = "__DASHBOARDMODERN_LEGACY_PERIOD_BRIDGE_V2__";
  if (root[KEY]?.installed) return;
  const doc = root.document;
  if (!doc) return;

  const MONTH_SLOTS = Object.freeze({
    "dm.energy_consumo_casa_mese": "house",
    "dm.energy_produzione_solare_mese": "solar",
    "dm.energy_rete_acquistata_mese": "gridImport",
    "dm.energy_rete_venduta_mese": "gridExport",
    "dm.energy_batteria_caricata_mese": "batteryCharged",
    "dm.energy_batteria_usata_mese": "batteryDischarged",
  });
  const YEAR_SLOTS = Object.freeze({
    "dm.energy_consumo_casa_anno": "house",
    "dm.energy_produzione_solare_anno": "solar",
    "dm.energy_rete_acquistata_anno": "gridImport",
    "dm.energy_rete_venduta_anno": "gridExport",
    "dm.energy_batteria_caricata_anno": "batteryCharged",
    "dm.energy_batteria_usata_anno": "batteryDischarged",
  });

  const state = {
    installed: true,
    version: "0.15.0",
    attempts: 0,
    target: null,
    values: Object.create(null),
    brokerWrapped: false,
  };
  const clean = (value) => String(value ?? "").trim();
  const finite = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  function registry() {
    try {
      if (typeof CD_PERIOD !== "undefined" && CD_PERIOD) return CD_PERIOD;
    } catch (_error) {}
    return (root.CD_PERIOD ||= {});
  }

  function rawRegistry() {
    try {
      if (typeof _RAW_STATES !== "undefined" && _RAW_STATES) return _RAW_STATES;
    } catch (_error) {}
    return (root._RAW_STATES ||= {});
  }

  function visibleRegistry() {
    try {
      if (typeof STATES !== "undefined" && STATES) return STATES;
    } catch (_error) {}
    return (root.STATES ||= {});
  }

  function isCurrent(value = new Date()) {
    const date = new Date(value);
    const now = new Date();
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }

  function bindRegistry() {
    const target = registry();
    if (state.target === target) return true;
    state.target = target;
    Object.keys(MONTH_SLOTS).forEach((slot) => {
      const previous = state.values[slot]?.value;
      const initial = finite(target[slot]);
      const entry = (state.values[slot] ||= { value: 0, owned: false });
      if (!entry.owned) entry.value = initial == null ? previous ?? 0 : Math.max(0, initial);
      const descriptor = Object.getOwnPropertyDescriptor(target, slot);
      if (descriptor?.get?.__dmLegacyPeriodBridgeV2) return;
      if (descriptor && descriptor.configurable === false) return;
      function getLegacyPeriod0150() {
        return entry.value;
      }
      getLegacyPeriod0150.__dmLegacyPeriodBridgeV2 = true;
      try {
        Object.defineProperty(target, slot, {
          configurable: true,
          enumerable: true,
          get: getLegacyPeriod0150,
          set(raw) {
            const value = finite(raw);
            if (value == null || entry.owned) return;
            entry.value = Math.max(0, value);
          },
        });
      } catch (_error) {}
    });
    return true;
  }

  function set(slot, raw) {
    const value = finite(raw);
    if (!slot || value == null) return false;
    bindRegistry();
    const entry = (state.values[slot] ||= { value: 0, owned: false });
    entry.value = Math.max(0, value);
    entry.owned = true;
    if (!MONTH_SLOTS[slot]) {
      try {
        registry()[slot] = entry.value;
      } catch (_error) {}
    }
    return true;
  }

  function publish(slot, raw, key, kind, selected) {
    const value = finite(raw);
    if (!slot || value == null) return false;
    const stamp = new Date().toISOString();
    const item = {
      entity_id: slot,
      state: String(Math.max(0, value)),
      attributes: {
        unit_of_measurement: "kWh",
        device_class: "energy",
        state_class: "measurement",
        dashboardmodern_derived: true,
        dashboardmodern_source: key,
        dashboardmodern_period: kind,
        dashboardmodern_selected: selected.toISOString(),
        dashboardmodern_version: "0.15.0",
      },
      last_changed: stamp,
      last_updated: stamp,
    };
    rawRegistry()[slot] = item;
    try {
      visibleRegistry()[slot] = item;
    } catch (_error) {}
    if (kind !== "month" || isCurrent(selected)) set(slot, value);
    return true;
  }

  function project(bundle = root.__DASHBOARDMODERN_RUNTIME_0150__?.bundle) {
    bindRegistry();
    if (!bundle?.period) return false;
    const selected = new Date(Number(bundle.period.year), Number(bundle.period.month) - 1, 1);
    Object.entries(MONTH_SLOTS).forEach(([slot, key]) =>
      publish(slot, bundle.month?.[key], key, "month", selected),
    );
    Object.entries(YEAR_SLOTS).forEach(([slot, key]) =>
      publish(slot, bundle.year?.[key], key, "year", selected),
    );
    return true;
  }

  function installBrokerHook() {
    const broker = root.DashboardModernRuntime0150?.broker;
    const current = broker?.ingestState;
    if (typeof current !== "function") return false;
    if (current.__dmLegacyPeriodBridgeV2) {
      state.brokerWrapped = true;
      return true;
    }
    function ingestLegacyPeriodBridge0150(item) {
      const result = current.call(this, item);
      const attributes = item?.attributes || {};
      if (attributes.dashboardmodern_derived === true) {
        publish(
          clean(item.entity_id),
          item.state,
          attributes.dashboardmodern_source || clean(item.entity_id),
          attributes.dashboardmodern_period || "month",
          new Date(attributes.dashboardmodern_selected || Date.now()),
        );
      }
      return result;
    }
    ingestLegacyPeriodBridge0150.__dmLegacyPeriodBridgeV2 = true;
    ingestLegacyPeriodBridge0150.__dmPrevious = current;
    broker.ingestState = ingestLegacyPeriodBridge0150;
    state.brokerWrapped = true;
    return true;
  }

  const api = {
    installed: true,
    version: "0.15.0",
    get(slot) {
      bindRegistry();
      return registry()[slot];
    },
    set,
    merge(values) {
      Object.entries(values || {}).forEach(([slot, value]) => set(slot, value));
      return registry();
    },
    publish,
    project,
  };
  root[KEY] = api;
  root.__DASHBOARDMODERN_LEGACY_PERIOD_BRIDGE__ = api;

  function apply() {
    bindRegistry();
    installBrokerHook();
    project();
  }

  function settle() {
    state.attempts += 1;
    apply();
    const lexicalReady = registry() !== root.CD_PERIOD || typeof root.CD_PERIOD === "undefined";
    const ready = lexicalReady && Boolean(root.DashboardModernRuntime0150);
    if (!ready && state.attempts < 240) root.requestAnimationFrame?.(settle);
  }

  api.merge(root.__DASHBOARDMODERN_LEGACY_PERIOD_PENDING__ || {});
  root.__DASHBOARDMODERN_LEGACY_PERIOD_PENDING__ = {};
  root.addEventListener?.("dashboardmodern:legacy-ready", () => root.queueMicrotask?.(settle));
  root.addEventListener?.("dashboardmodern:runtime-ready", () => root.queueMicrotask?.(settle));
  root.addEventListener?.("dashboardmodern:period-bundle", (event) => project(event.detail));
  root.addEventListener?.("dashboardmodern:energy-statistics", () => root.queueMicrotask?.(apply));
  root.addEventListener?.("pageshow", () => root.queueMicrotask?.(settle));
  root.dispatchEvent?.(new CustomEvent("dashboardmodern:legacy-period-bridge-ready"));
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", settle, { once: true });
  else settle();
})(globalThis);
