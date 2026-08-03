/* DashboardModern 0.15.0 — classic bridge for the real lexical CD_PERIOD registry. */
(function installLegacyPeriodBridge0150(root) {
  "use strict";

  const KEY = "__DASHBOARDMODERN_LEGACY_PERIOD_BRIDGE_V2__";
  if (root[KEY]?.installed) return;

  const MONTH_SLOTS = Object.freeze({
    "dm.energy_consumo_casa_mese": "house",
    "dm.energy_produzione_solare_mese": "solar",
    "dm.energy_rete_acquistata_mese": "gridImport",
    "dm.energy_rete_venduta_mese": "gridExport",
    "dm.energy_batteria_caricata_mese": "batteryCharged",
    "dm.energy_batteria_usata_mese": "batteryDischarged",
  });
  const state = {
    installed: true,
    version: "0.15.0",
    attempts: 0,
    ownerInstalled: false,
    values: Object.create(null),
    pending: Object.create(null),
  };

  const finite = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  function registry() {
    try {
      if (typeof CD_PERIOD !== "undefined" && CD_PERIOD) return CD_PERIOD;
    } catch (_error) {}
    return null;
  }

  function isCurrent(value = new Date()) {
    const selected = new Date(value);
    const now = new Date();
    return (
      selected.getFullYear() === now.getFullYear() &&
      selected.getMonth() === now.getMonth()
    );
  }

  function installOwner() {
    if (state.ownerInstalled) return true;
    const target = registry();
    if (!target) return false;
    Object.keys(MONTH_SLOTS).forEach((slot) => {
      const initial = finite(target[slot]);
      state.values[slot] = {
        value: initial == null ? 0 : Math.max(0, initial),
        owned: false,
      };
      const descriptor = Object.getOwnPropertyDescriptor(target, slot);
      if (descriptor?.configurable === false) return;
      try {
        Object.defineProperty(target, slot, {
          configurable: true,
          enumerable: true,
          get() {
            return state.values[slot].value;
          },
          set(raw) {
            const value = finite(raw);
            if (value == null || state.values[slot].owned) return;
            state.values[slot].value = Math.max(0, value);
          },
        });
      } catch (_error) {}
    });
    state.ownerInstalled = true;
    Object.entries(state.pending).forEach(([slot, value]) => api.set(slot, value));
    state.pending = Object.create(null);
    return true;
  }

  const api = {
    installed: true,
    version: "0.15.0",
    ready() {
      return installOwner();
    },
    get(slot) {
      const target = registry();
      return target?.[slot];
    },
    set(slot, raw) {
      const value = finite(raw);
      if (!slot || value == null) return false;
      if (!installOwner()) {
        state.pending[slot] = Math.max(0, value);
        return false;
      }
      if (state.values[slot]) {
        state.values[slot].value = Math.max(0, value);
        state.values[slot].owned = true;
      } else {
        const target = registry();
        if (!target) {
          state.pending[slot] = Math.max(0, value);
          return false;
        }
        target[slot] = Math.max(0, value);
      }
      return true;
    },
    merge(values) {
      Object.entries(values || {}).forEach(([slot, value]) => api.set(slot, value));
      return registry();
    },
  };

  root[KEY] = api;
  root.__DASHBOARDMODERN_LEGACY_PERIOD_BRIDGE__ = api;

  function projectBundle(bundle = root.__DASHBOARDMODERN_RUNTIME_0150__?.bundle) {
    if (!bundle?.period || !bundle?.month) return false;
    const selected = new Date(Number(bundle.period.year), Number(bundle.period.month) - 1, 1);
    if (!isCurrent(selected)) return false;
    Object.entries(MONTH_SLOTS).forEach(([slot, key]) => api.set(slot, bundle.month[key]));
    return true;
  }

  function projectDerivedStates() {
    const states = { ...(root._RAW_STATES || {}), ...(root.STATES || {}) };
    Object.entries(states).forEach(([slot, item]) => {
      if (!item?.attributes?.dashboardmodern_derived) return;
      const kind = item.attributes.dashboardmodern_period;
      const selected = item.attributes.dashboardmodern_selected;
      if (kind === "month" && selected && !isCurrent(selected)) return;
      api.set(slot, item.state);
    });
  }

  function project() {
    if (!installOwner()) return false;
    projectBundle();
    projectDerivedStates();
    return true;
  }
  api.project = project;

  function scheduleProject() {
    [0, 30, 80, 160, 320, 650, 1100, 1800].forEach((delay) =>
      root.setTimeout?.(project, delay),
    );
  }

  function settle() {
    state.attempts += 1;
    const ready = project();
    if (!ready && state.attempts < 300) root.requestAnimationFrame?.(settle);
    else scheduleProject();
  }

  root.addEventListener?.("dashboardmodern:runtime-ready", scheduleProject);
  root.addEventListener?.("dashboardmodern:period-bundle", (event) => {
    projectBundle(event.detail);
    scheduleProject();
  });
  root.addEventListener?.("dashboardmodern:energy-statistics", scheduleProject);
  root.addEventListener?.("pageshow", scheduleProject);
  root.dispatchEvent?.(new CustomEvent("dashboardmodern:legacy-period-bridge-ready"));
  settle();
})(globalThis);
