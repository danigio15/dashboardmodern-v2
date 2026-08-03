/* DashboardModern 0.15.0 — stateless compatibility facade, no runtime owner. */
(function installRuntimeCompatibility0150(root) {
  "use strict";

  var VERSION = "0.15.0";
  var HAS_DOCUMENT = typeof root.document !== "undefined";
  var states = new Map();
  var bootstrapped = false;
  var CURRENT_MONTH_SLOTS = [
    "dm.energy_consumo_casa_mese",
    "dm.energy_produzione_solare_mese",
    "dm.energy_rete_acquistata_mese",
    "dm.energy_rete_venduta_mese",
    "dm.energy_batteria_caricata_mese",
    "dm.energy_batteria_usata_mese",
  ];
  var CONFIG_SECTIONS = ["energy", "ev", "loads", "appliances", "climate", "rooms"];
  var COMPATIBILITY_KEYS = [
    "__DASHBOARDMODERN_RELEASE_0152__",
    "__DASHBOARDMODERN_RELEASE_0153_REPORT_RUNTIME__",
    "__DASHBOARDMODERN_RELEASE_0154__",
    "__DASHBOARDMODERN_RELEASE_0154_REAL_CONFIG__",
    "__DASHBOARDMODERN_RELEASE_0155_PUBLIC_RUNTIME__",
    "__DASHBOARDMODERN_RELEASE_0156_PERIOD_RUNTIME__",
    "__DASHBOARDMODERN_RELEASE_0156_FINAL_RUNTIME__",
    "__DASHBOARDMODERN_RELEASE_0157_UI_STABILITY__",
    "__DASHBOARDMODERN_RELEASE_0157_FINAL__",
  ];

  function runtimeApi() {
    return root.DashboardModernRuntime0150 || null;
  }

  function storeSection(name, fallback) {
    try {
      var store = root.DashboardModernModules && root.DashboardModernModules.store;
      return store && typeof store.getSection === "function" ? store.getSection(name) : fallback;
    } catch (_error) {
      return fallback;
    }
  }

  function historicalSelection() {
    if (!HAS_DOCUMENT) return false;
    var now = new Date();
    var monthNode = root.document.getElementById("ed-sel-month");
    var yearNode = root.document.getElementById("ed-sel-year");
    var month = Number(monthNode && monthNode.value);
    var year = Number(yearNode && yearNode.value);
    if (!Number.isInteger(month) || !Number.isInteger(year)) return false;
    return month !== now.getMonth() + 1 || year !== now.getFullYear();
  }

  function installCurrentMonthRegistryGuard() {
    var registry = (root.CD_PERIOD ||= {});
    CURRENT_MONTH_SLOTS.forEach(function guardSlot(slot) {
      var descriptor = Object.getOwnPropertyDescriptor(registry, slot);
      if (descriptor && descriptor.get && descriptor.get.__dm0150CurrentMonth) return;
      var value = Number(registry[slot]);
      function getCurrentMonth0150() {
        return value;
      }
      getCurrentMonth0150.__dm0150CurrentMonth = true;
      Object.defineProperty(registry, slot, {
        configurable: true,
        enumerable: true,
        get: getCurrentMonth0150,
        set: function setCurrentMonth0150(next) {
          if (historicalSelection()) return;
          var parsed = Number(next);
          if (Number.isFinite(parsed)) value = parsed;
        },
      });
    });
  }

  function installDerivedStateGuard() {
    var api = runtimeApi();
    var broker = api && api.broker;
    var original = broker && broker.ingestState;
    if (typeof original !== "function" || original.__dm0150CurrentMonth) return;
    function ingestStateCurrentMonth0150(state) {
      var attributes = (state && state.attributes) || {};
      var isHistoricalMonthly =
        attributes.dashboardmodern_derived === true &&
        attributes.dashboardmodern_period === "month" &&
        historicalSelection();
      if (isHistoricalMonthly) return true;
      return original.call(this, state);
    }
    ingestStateCurrentMonth0150.__dm0150CurrentMonth = true;
    ingestStateCurrentMonth0150.__dmPrevious = original;
    broker.ingestState = ingestStateCurrentMonth0150;
  }

  function configuredText() {
    var sections = {};
    CONFIG_SECTIONS.forEach(function readSection(name) {
      sections[name] = storeSection(name, name === "energy" ? {} : []);
    });
    return JSON.stringify(sections).toLowerCase();
  }

  function optionalAvailability() {
    var config = configuredText();
    return {
      wb: /wallbox|evcc|charge[_ -]?power|charging[_ -]?power|energia[_ -]?wallbox/.test(config),
      boiler: /boiler|scaldabagno|water[_ -]?heater/.test(config),
      clima: /climate\.|condizion|air[_ -]?condition/.test(config),
      lav: /lavatrice|washer|washing[_ -]?machine|asciugatrice|dryer/.test(config),
      cuc: /forno|oven|microonde|microwave|frigo|fridge|dishwasher|lavastoviglie|cooktop/.test(config),
    };
  }

  function lineBelongsToPeriod(id, suffix) {
    if (suffix === "") return !/-day$|-month$/.test(id);
    return id.endsWith(suffix);
  }

  function applyOptionalFlowVisibility() {
    var availability = optionalAvailability();
    if (!HAS_DOCUMENT) return availability;
    Object.keys(availability).forEach(function applyToken(token) {
      var visible = availability[token];
      ["", "-day", "-month"].forEach(function applyPeriod(suffix) {
        var node = root.document.getElementById("n-" + token + suffix);
        if (node) {
          node.hidden = !visible;
          node.style.display = visible ? "" : "none";
        }
        root.document
          .querySelectorAll('.flow-line[id*="-' + token + '"]')
          .forEach(function applyLine(line) {
            var id = String(line.id || "");
            if (!lineBelongsToPeriod(id, suffix)) return;
            line.hidden = !visible;
            line.style.display = visible ? "" : "none";
          });
      });
    });
    return availability;
  }

  function ingestState(state) {
    var id = String((state && state.entity_id) || "").trim();
    if (!id) return false;
    var copy = Object.assign({}, state, { attributes: Object.assign({}, state.attributes || {}) });
    states.set(id, copy);
    var api = runtimeApi();
    if (api && api.broker && typeof api.broker.ingestState === "function") {
      api.broker.ingestState(copy);
    }
    return true;
  }

  function ingestStates(list) {
    (Array.isArray(list) ? list : []).forEach(ingestState);
    return states.size;
  }

  function syncTemperature() {
    try {
      if (typeof root.buildTempCards === "function") root.buildTempCards();
      if (typeof root.renderTemperature === "function") root.renderTemperature();
      return true;
    } catch (_error) {
      return false;
    }
  }

  function syncAppliances() {
    try {
      if (typeof root.renderApplianceSection === "function") root.renderApplianceSection(true);
      return true;
    } catch (_error) {
      return false;
    }
  }

  function valuesForEntities(ids, kind, date) {
    var api = runtimeApi();
    var broker = api && api.broker;
    return broker && typeof broker.valuesForEntities === "function"
      ? broker.valuesForEntities(ids, kind, date)
      : Promise.resolve(new Map());
  }

  function refreshCurrent() {
    var api = runtimeApi();
    return api && typeof api.refreshEnergyStatistics0152 === "function"
      ? api.refreshEnergyStatistics0152(new Date())
      : Promise.resolve(false);
  }

  function refreshOverview() {
    var api = runtimeApi();
    return api && typeof api.refreshSelectedPeriod === "function"
      ? api.refreshSelectedPeriod()
      : Promise.resolve(false);
  }

  var shared = {
    installed: true,
    ready: true,
    version: VERSION,
    states: states,
    sampleTimer: 0,
    ingestState: ingestState,
    ingestStates: ingestStates,
    syncTemperature: syncTemperature,
    syncAppliances: syncAppliances,
    applyOptionalFlowVisibility: applyOptionalFlowVisibility,
    monthValues: function monthValues(ids, month, year) {
      return valuesForEntities(ids, "month", new Date(year, month - 1, 1));
    },
    yearValues: function yearValues(ids, year) {
      return valuesForEntities(ids, "year", new Date(year, 0, 1));
    },
    refreshCurrent: refreshCurrent,
    refreshOverview: refreshOverview,
    refreshEnergyStatistics0152: refreshCurrent,
    refreshEnergyPeriods0154: refreshCurrent,
  };

  function publishCompatibility() {
    var api = runtimeApi();
    shared.broker = api && api.broker;
    shared.statistics =
      shared.broker && typeof shared.broker.statistics === "function"
        ? shared.broker.statistics.bind(shared.broker)
        : undefined;
    COMPATIBILITY_KEYS.forEach(function publishKey(key) {
      root[key] = Object.assign({}, root[key] || {}, shared);
    });
    root.__DASHBOARDMODERN_RUNTIME_COMPATIBILITY_0150__ = shared;
  }

  function bootstrap() {
    if (bootstrapped || !HAS_DOCUMENT) {
      publishCompatibility();
      return;
    }
    bootstrapped = true;
    installCurrentMonthRegistryGuard();
    installDerivedStateGuard();
    publishCompatibility();
    applyOptionalFlowVisibility();

    root.addEventListener("dashboardmodern:runtime-ready", function onRuntimeReady() {
      installDerivedStateGuard();
      publishCompatibility();
      applyOptionalFlowVisibility();
    });
    root.addEventListener("dashboardmodern:period-bundle", applyOptionalFlowVisibility);
    root.addEventListener("pageshow", applyOptionalFlowVisibility);

    try {
      var store = root.DashboardModernModules && root.DashboardModernModules.store;
      if (store && typeof store.subscribe === "function") {
        store.subscribe(function onStoreChange(change) {
          if (change && CONFIG_SECTIONS.includes(change.section)) {
            root.queueMicrotask(applyOptionalFlowVisibility);
          }
        });
      }
    } catch (_error) {}
  }

  publishCompatibility();
  if (HAS_DOCUMENT) {
    if (root.document.readyState === "loading") {
      root.document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
    } else {
      root.queueMicrotask(bootstrap);
    }
  }
})(globalThis);
