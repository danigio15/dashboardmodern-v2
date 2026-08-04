/* DashboardModern 0.15.0 — final deterministic E2E/release guard. */
(function installReleaseE2EGuard0150(root) {
  "use strict";

  const KEY = "__DASHBOARDMODERN_RELEASE_E2E_GUARD_0150__";
  if (root[KEY]?.installed || !root.document) return;

  const doc = root.document;
  const state = (root[KEY] = {
    installed: true,
    version: "0.15.0",
    currentMonth: Object.create(null),
  });

  const MONTH_SLOTS = Object.freeze({
    "dm.energy_consumo_casa_mese": "house",
    "dm.energy_produzione_solare_mese": "solar",
    "dm.energy_rete_acquistata_mese": "gridImport",
    "dm.energy_rete_venduta_mese": "gridExport",
    "dm.energy_batteria_caricata_mese": "batteryCharged",
    "dm.energy_batteria_usata_mese": "batteryDischarged",
  });

  const clean = (value) => String(value ?? "").trim();
  const store = () => root.DashboardModernModules?.store || null;
  const bundle = () => root.__DASHBOARDMODERN_RUNTIME_0150__?.bundle || null;

  function isCurrentPeriod(value) {
    if (!value?.period) return false;
    const now = new Date();
    return (
      Number(value.period.month) === now.getMonth() + 1 &&
      Number(value.period.year) === now.getFullYear()
    );
  }

  function periodRegistries() {
    const targets = [];
    if (root.CD_PERIOD && typeof root.CD_PERIOD === "object") targets.push(root.CD_PERIOD);
    try {
      const lexical = root.eval?.("typeof CD_PERIOD !== 'undefined' ? CD_PERIOD : null");
      if (lexical && typeof lexical === "object") targets.push(lexical);
    } catch (_error) {}
    return [...new Set(targets)];
  }

  function captureCurrent(value = bundle()) {
    if (!isCurrentPeriod(value) || !value?.month) return false;
    Object.entries(MONTH_SLOTS).forEach(([slot, key]) => {
      const amount = Number(value.month[key]);
      if (Number.isFinite(amount)) state.currentMonth[slot] = Math.max(0, amount);
    });
    return Object.keys(state.currentMonth).length > 0;
  }

  function restoreCurrent() {
    if (!Object.keys(state.currentMonth).length) return false;

    const releaseOwner = root.__DASHBOARDMODERN_RELEASE_OWNER_0150__;
    if (releaseOwner?.currentMonth) {
      Object.entries(state.currentMonth).forEach(([slot, amount]) => {
        releaseOwner.currentMonth[slot] = amount;
      });
    }

    root.__DASHBOARDMODERN_LEGACY_PERIOD_BRIDGE__?.merge?.(state.currentMonth);
    root.__DASHBOARDMODERN_LEGACY_PERIOD_BRIDGE_V2__?.merge?.(state.currentMonth);

    periodRegistries().forEach((registry) => {
      Object.entries(state.currentMonth).forEach(([slot, amount]) => {
        try {
          registry[slot] = amount;
        } catch (_error) {}
      });
    });
    return true;
  }

  function onBundle(value) {
    if (isCurrentPeriod(value)) {
      captureCurrent(value);
      restoreCurrent();
      return;
    }
    restoreCurrent();
    root.queueMicrotask?.(restoreCurrent);
    [0, 40, 140].forEach((delay) => root.setTimeout?.(restoreCurrent, delay));
  }

  function section(name, fallback) {
    try {
      return store()?.getSection?.(name) ?? fallback;
    } catch (_error) {
      return fallback;
    }
  }

  function configuredEntityText() {
    const names = ["energy", "ev", "loads", "appliances", "climate", "rooms"];
    return JSON.stringify(
      Object.fromEntries(names.map((name) => [name, section(name, name === "energy" ? {} : [])])),
    ).toLowerCase();
  }

  function nodeAvailability() {
    const energy = section("energy", {}) || {};
    const configText = configuredEntityText();
    const hasGroup = (group) =>
      Object.values(energy?.[group] || {}).some((value) => clean(value).includes("."));
    return {
      solar: hasGroup("solar"),
      grid: hasGroup("grid"),
      battery: hasGroup("battery"),
      home: hasGroup("house"),
      wb: /wallbox|evcc|charge[_ -]?power|charging[_ -]?power/.test(configText),
      boiler: /boiler|scaldabagno|water[_ -]?heater/.test(configText),
      clima: /climate\.|condizion|air[_ -]?condition/.test(configText),
      lav: /lavatrice|washer|washing[_ -]?machine|asciugatrice|dryer/.test(configText),
      cuc: /forno|oven|microonde|microwave|frigo|fridge|dishwasher|lavastoviglie|cooktop/.test(
        configText,
      ),
    };
  }

  function flowEndpoints(pathId) {
    return String(pathId || "")
      .replace(/^m-/, "")
      .replace(/^line-/, "")
      .replace(/-(ist|day|month)$/, "")
      .split("-")
      .filter(Boolean)
      .slice(0, 2);
  }

  function applyOptionalFlowVisibility() {
    const available = nodeAvailability();
    for (const view of ["ist", "day", "month"]) {
      const suffix = view === "ist" ? "" : `-${view}`;
      Object.entries(available).forEach(([token, present]) => {
        const node = doc.getElementById(`n-${token}${suffix}`);
        if (!node) return;
        node.hidden = !present;
        node.style.display = present ? "" : "none";
      });
      doc.querySelectorAll(`#view-${view} .flow-line`).forEach((path) => {
        const visible = flowEndpoints(path.id).every((token) => available[token] !== false);
        path.hidden = !visible;
        path.style.display = visible ? "" : "none";
      });
    }
    return true;
  }

  function publish() {
    const compatibility = root.__DASHBOARDMODERN_RUNTIME_COMPATIBILITY_0150__;
    if (compatibility) compatibility.applyOptionalFlowVisibility = applyOptionalFlowVisibility;
    captureCurrent();
    if (!isCurrentPeriod(bundle())) restoreCurrent();
    applyOptionalFlowVisibility();
  }

  root.addEventListener?.("dashboardmodern:period-bundle", (event) => {
    onBundle(event.detail);
    publish();
  });
  root.addEventListener?.("dashboardmodern:runtime-ready", () => root.queueMicrotask?.(publish));
  root.addEventListener?.("dashboardmodern:legacy-ready", () => root.queueMicrotask?.(publish));
  root.addEventListener?.("pageshow", () => root.queueMicrotask?.(publish));

  root.queueMicrotask?.(publish);
  [50, 180].forEach((delay) => root.setTimeout?.(publish, delay));
})(globalThis);
