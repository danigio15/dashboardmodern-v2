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
  const FLOW_IDS = Object.freeze([
    "v-solar-month",
    "v-home-month",
    "v-grid-month",
    "v-battery-month",
  ]);
  const state = {
    installed: true,
    version: "0.15.0",
    attempts: 0,
    ownerInstalled: false,
    temperatureOwner: false,
    temperatureRenderOwners: Object.create(null),
    temperatureTabOwner: false,
    temperatureSaving: false,
    alertOwner: false,
    dispatchOwner: false,
    values: Object.create(null),
    pending: Object.create(null),
  };

  const clean = (value) => String(value ?? "").trim();
  const finite = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const readJson = (key, fallback) => {
    try {
      return JSON.parse(root.localStorage?.getItem(key) || "") ?? fallback;
    } catch (_error) {
      return fallback;
    }
  };
  const writeJson = (key, value) =>
    root.localStorage?.setItem(key, JSON.stringify(value));

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

  function installTemperatureOwner() {
    const store = root.DashboardModernModules?.store;
    const current = store?.updateItem;
    if (typeof current !== "function") return false;
    if (current.__dmFinalTemperatureOwner0150) {
      state.temperatureOwner = true;
      return true;
    }
    async function updateItemFinal0150(section, id, patch) {
      const validTemperature =
        section === "rooms" &&
        patch &&
        Object.prototype.hasOwnProperty.call(patch, "temp") &&
        clean(patch.temp).includes(".");
      if (!validTemperature) return current.call(this, section, id, patch);
      const sync = store.syncAdapter;
      store.syncAdapter = async () => {};
      try {
        return await current.call(this, section, id, patch);
      } finally {
        store.syncAdapter = sync;
      }
    }
    updateItemFinal0150.__dmFinalTemperatureOwner0150 = true;
    updateItemFinal0150.__dmPrevious = current;
    store.updateItem = updateItemFinal0150;
    state.temperatureOwner = true;
    return true;
  }

  function normalizeTemperatureIcons() {
    root.document?.querySelectorAll("#temp-grid .temp-room-icon").forEach((icon) => {
      if (clean(icon.textContent)) return;
      const token = clean(icon.dataset.roomIcon) || clean(icon.getAttribute("aria-label"));
      icon.append(token && !token.startsWith("mdi:") ? token : "🏠");
    });
  }

  function installTemperatureRenderOwner(name) {
    if (state.temperatureRenderOwners[name]) return true;
    const current = root[name];
    if (typeof current !== "function") return false;
    let delegate = current;
    function temperatureRenderFinal0150() {
      const result = delegate.apply(this, arguments);
      const finish = () => normalizeTemperatureIcons();
      if (result && typeof result.finally === "function") return result.finally(finish);
      finish();
      return result;
    }
    temperatureRenderFinal0150.__dmFinalOwner0150 = true;
    temperatureRenderFinal0150.__dmReleaseOwnerV3 = true;
    temperatureRenderFinal0150.__dmFinalTemperatureRender0150 = true;
    try {
      Object.defineProperty(root, name, {
        configurable: true,
        enumerable: true,
        get: () => temperatureRenderFinal0150,
        set(next) {
          if (
            typeof next === "function" &&
            next !== temperatureRenderFinal0150 &&
            next.__dmPrevious !== temperatureRenderFinal0150
          ) {
            delegate = next;
          }
        },
      });
    } catch (_error) {
      root[name] = temperatureRenderFinal0150;
    }
    state.temperatureRenderOwners[name] = true;
    normalizeTemperatureIcons();
    return true;
  }

  function installTemperatureTabOwner() {
    if (state.temperatureTabOwner) return true;
    const tab = root.document?.querySelector('.tab[data-tab="temp"]');
    if (!tab) return false;
    const finish = () => {
      normalizeTemperatureIcons();
      root.queueMicrotask?.(normalizeTemperatureIcons);
      [0, 30, 80, 160].forEach((delay) => root.setTimeout?.(normalizeTemperatureIcons, delay));
    };
    tab.addEventListener("click", finish);
    tab.dataset.dmTemperatureIconOwner = "true";
    state.temperatureTabOwner = true;
    return true;
  }

  async function saveTemperatureForm() {
    if (state.temperatureSaving) return false;
    const store = root.DashboardModernModules?.store;
    const roomId = clean(root.document?.getElementById("dm-temperature-room")?.value);
    const temp = clean(root.document?.getElementById("ed-pl-temp")?.value);
    const hum = clean(root.document?.getElementById("dm-humidity-new")?.value);
    if (!roomId || !temp.includes(".") || typeof store?.updateItem !== "function") return false;
    state.temperatureSaving = true;
    const sync = store.syncAdapter;
    store.syncAdapter = async () => {};
    try {
      await store.updateItem("rooms", roomId, { temp, hum });
      root.buildTempCards?.();
      root.renderTemperature?.();
      normalizeTemperatureIcons();
      return true;
    } finally {
      store.syncAdapter = sync;
      state.temperatureSaving = false;
    }
  }

  function alertFormValues() {
    return {
      group: clean(root.document?.getElementById("ed-avv-grp")?.value),
      entity: clean(root.document?.getElementById("ed-avv-ent")?.value),
      name: clean(root.document?.getElementById("ed-avv-name")?.value),
    };
  }

  function writeAlertForm() {
    const { group, entity, name } = alertFormValues();
    if (!group || !entity.includes(".")) return false;
    const groups = readJson("cd_gruppi_extra", {});
    const names = readJson("cd_avvisi_names_extra", {});
    Object.keys(groups).forEach((key) => {
      if (Array.isArray(groups[key])) groups[key] = groups[key].filter((id) => id !== entity);
    });
    groups[group] ||= [];
    if (!groups[group].includes(entity)) groups[group].push(entity);
    if (name) names[entity] = name;
    else delete names[entity];
    writeJson("cd_gruppi_extra", groups);
    writeJson("cd_avvisi_names_extra", names);
    return true;
  }

  function protectAlertForm() {
    const values = alertFormValues();
    if (!values.group || !values.entity.includes(".")) return false;
    const restore = () => {
      const groups = readJson("cd_gruppi_extra", {});
      const names = readJson("cd_avvisi_names_extra", {});
      Object.keys(groups).forEach((key) => {
        if (Array.isArray(groups[key])) groups[key] = groups[key].filter((id) => id !== values.entity);
      });
      groups[values.group] ||= [];
      if (!groups[values.group].includes(values.entity)) groups[values.group].push(values.entity);
      if (values.name) names[values.entity] = values.name;
      else delete names[values.entity];
      writeJson("cd_gruppi_extra", groups);
      writeJson("cd_avvisi_names_extra", names);
    };
    restore();
    [0, 20, 60, 140, 300, 700, 1200].forEach((delay) => root.setTimeout?.(restore, delay));
    return true;
  }

  function installAlertOwner() {
    if (state.alertOwner) return true;
    const current = root.edAddAvviso;
    if (typeof current !== "function") return false;
    let delegate = current;
    function addAlertFinal0150() {
      if (writeAlertForm()) {
        root.cdMarkDirty?.();
        root.cdSyncPush?.();
        root.editorSwitch?.("avvisi");
        return true;
      }
      return delegate.apply(this, arguments);
    }
    addAlertFinal0150.__dmFinalAlertOwner0150 = true;
    addAlertFinal0150.__dmReleaseOwnerAlertV3 = true;
    try {
      Object.defineProperty(root, "edAddAvviso", {
        configurable: true,
        enumerable: true,
        get: () => addAlertFinal0150,
        set(next) {
          if (
            typeof next === "function" &&
            next !== addAlertFinal0150 &&
            next.__dmPrevious !== addAlertFinal0150
          ) {
            delegate = next;
          }
        },
      });
    } catch (_error) {
      root.edAddAvviso = addAlertFinal0150;
    }
    state.alertOwner = true;
    return true;
  }

  function captureFlowText() {
    return Object.fromEntries(
      FLOW_IDS.map((id) => [id, root.document?.getElementById(id)?.textContent ?? null]),
    );
  }

  function restoreFlowText(snapshot) {
    Object.entries(snapshot || {}).forEach(([id, value]) => {
      const node = root.document?.getElementById(id);
      if (node && value != null && node.textContent !== value) node.textContent = value;
    });
  }

  function installDispatchOwner() {
    const current = root.dispatchEvent;
    if (typeof current !== "function") return false;
    if (current.__dmFinalLegacyDispatch0150) {
      state.dispatchOwner = true;
      return true;
    }
    function dispatchFinal0150(event) {
      const energyEvent = event?.type === "dashboardmodern:energy-periods-0154";
      const snapshot = energyEvent ? captureFlowText() : null;
      const result = current.call(this, event);
      if (energyEvent) {
        root.queueMicrotask?.(() => restoreFlowText(snapshot));
        [0, 20, 60, 140, 260, 300, 340, 500, 700].forEach((delay) =>
          root.setTimeout?.(() => restoreFlowText(snapshot), delay),
        );
      }
      return result;
    }
    dispatchFinal0150.__dmFinalLegacyDispatch0150 = true;
    dispatchFinal0150.__dmPrevious = current;
    root.dispatchEvent = dispatchFinal0150;
    state.dispatchOwner = true;
    return true;
  }

  function normalizeHomePrecision() {
    const node = root.document?.getElementById("v-home-month");
    if (!node) return false;
    const value = node.textContent || "";
    const normalized = value
      .replace(/(\d+\.\d*?[1-9])0+(?=\s*kWh)/g, "$1")
      .replace(/(\d+)\.0+(?=\s*kWh)/g, "$1");
    if (normalized !== value) node.textContent = normalized;
    return true;
  }

  function installReportLayoutStyle() {
    if (root.document?.getElementById("dm-final-report-layout-0150")) return;
    const style = root.document?.createElement("style");
    if (!style) return;
    style.id = "dm-final-report-layout-0150";
    style.textContent = `
      #editor-modal [data-energy-panel="report"] .dm-report-row[data-real-report-layout="true"]{
        display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;
        grid-template-areas:"toggle actions" "fields fields"!important;
        gap:12px!important;align-items:center!important
      }
      #editor-modal [data-energy-panel="report"] .dm-report-row[data-real-report-layout="true"]>.dm-report-toggle{grid-area:toggle!important}
      #editor-modal [data-energy-panel="report"] .dm-report-row[data-real-report-layout="true"]>.dm-report-fields{
        grid-area:fields!important;display:grid!important;
        grid-template-columns:minmax(150px,.75fr) minmax(130px,.45fr) minmax(240px,1.3fr)!important;
        gap:10px!important;align-items:end!important;width:100%!important;min-width:0!important
      }
      #editor-modal [data-energy-panel="report"] .dm-report-row[data-real-report-layout="true"]>.dm-report-actions{grid-area:actions!important}
      #editor-modal [data-energy-panel="report"] .dm-report-fields>*{min-width:0!important;margin:0!important}
      #editor-modal [data-energy-panel="report"] .dm-report-fields>[data-report-label],
      #editor-modal [data-energy-panel="report"] .dm-report-fields>[data-entity-field],
      #editor-modal [data-energy-panel="report"] .dm-report-fields>[data-icon-field]{width:100%!important}
      @media(max-width:700px){
        #editor-modal [data-energy-panel="report"] .dm-report-row[data-real-report-layout="true"]>.dm-report-fields{
          grid-template-columns:1fr!important
        }
      }
    `;
    root.document.head.append(style);
  }

  function normalizeReportRows() {
    installReportLayoutStyle();
    root.document?.querySelectorAll('[data-energy-panel="report"] .dm-report-row').forEach((row) => {
      row.dataset.realReportLayout = "true";
      let toggle = row.querySelector(":scope > .dm-report-toggle");
      if (!toggle) {
        toggle = [...row.children].find((child) => child.querySelector?.("[data-report-toggle]"));
        toggle?.classList.add("dm-report-toggle");
      }
      let actions = row.querySelector(":scope > .dm-report-actions");
      if (!actions) {
        actions = [...row.children].find((child) =>
          child.querySelector?.("[data-report-up],[data-report-down],[data-report-delete]"),
        );
        actions?.classList.add("dm-report-actions");
      }
      let fields = row.querySelector(":scope > .dm-report-fields");
      if (!fields) {
        fields = root.document.createElement("div");
        fields.className = "dm-report-fields";
        [...row.children]
          .filter(
            (child) =>
              child !== toggle &&
              child !== actions &&
              !child.matches?.('input[type="hidden"]'),
          )
          .forEach((child) => fields.append(child));
        if (actions) row.insertBefore(fields, actions);
        else row.append(fields);
      }
    });
  }

  function installFinalOwners() {
    installTemperatureOwner();
    installTemperatureRenderOwner("buildTempCards");
    installTemperatureRenderOwner("renderTemperature");
    installTemperatureTabOwner();
    installAlertOwner();
    installDispatchOwner();
    normalizeTemperatureIcons();
    normalizeHomePrecision();
    normalizeReportRows();
  }

  function project() {
    if (!installOwner()) return false;
    projectBundle();
    projectDerivedStates();
    installFinalOwners();
    return true;
  }
  api.project = project;

  function scheduleProject() {
    [0, 30, 80, 160, 320, 650, 1100, 1800].forEach((delay) =>
      root.setTimeout?.(() => {
        project();
        normalizeTemperatureIcons();
        normalizeHomePrecision();
        normalizeReportRows();
      }, delay),
    );
  }

  function settle() {
    state.attempts += 1;
    const ready = project();
    const finalOwners =
      state.temperatureOwner &&
      state.temperatureRenderOwners.buildTempCards &&
      state.temperatureRenderOwners.renderTemperature &&
      state.temperatureTabOwner &&
      state.alertOwner &&
      state.dispatchOwner;
    if ((!ready || !finalOwners) && state.attempts < 300) root.requestAnimationFrame?.(settle);
    else scheduleProject();
  }

  function handleIntent(event) {
    const target = event.target?.closest?.("button");
    if (!target) return;
    if (target.matches("[data-temperature-submit]")) {
      saveTemperatureForm().catch((error) => root.console?.warn?.("Temperature save", error));
      return;
    }
    if (/edAddAvviso/.test(target.getAttribute("onclick") || "")) protectAlertForm();
  }

  root.addEventListener?.("dashboardmodern:runtime-ready", scheduleProject);
  root.addEventListener?.("dashboardmodern:period-bundle", (event) => {
    projectBundle(event.detail);
    scheduleProject();
  });
  root.addEventListener?.("dashboardmodern:energy-statistics", scheduleProject);
  root.addEventListener?.("pageshow", scheduleProject);
  root.addEventListener?.("click", () => root.queueMicrotask?.(installFinalOwners), true);
  root.addEventListener?.("pointerdown", handleIntent, true);
  root.addEventListener?.("touchstart", handleIntent, true);
  root.addEventListener?.("mousedown", handleIntent, true);
  root.dispatchEvent?.(new CustomEvent("dashboardmodern:legacy-period-bridge-ready"));
  settle();
})(globalThis);
