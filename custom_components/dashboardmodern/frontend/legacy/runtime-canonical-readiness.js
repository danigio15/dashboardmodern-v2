/* DashboardModern 0.15.0 — bounded canonical data and editor readiness. */
(function installCanonicalReadiness0150(root) {
  "use strict";

  const KEY = "__DASHBOARDMODERN_CANONICAL_READINESS_0150__";
  if (root[KEY]?.installed) return;
  const doc = root.document;
  if (!doc) return;

  const state = (root[KEY] = {
    installed: true,
    version: "0.15.0",
    attempts: 0,
    refreshing: false,
    repairing: false,
    wrapped: false,
    temperatureSaving: false,
  });
  const clean = (value) => String(value ?? "").trim();
  const store = () => root.DashboardModernModules?.store || null;
  const runtime = () => root.DashboardModernRuntime0150 || null;
  const allStates = () => ({ ...(root._RAW_STATES || {}), ...(root.STATES || {}) });

  function installFinalStyle() {
    if (doc.getElementById("dm-release-0154-final-artwork-lock")) return;
    const style = doc.createElement("style");
    style.id = "dm-release-0154-final-artwork-lock";
    style.textContent = `
      :root,:root[data-theme="light"]{--dm-art-panel:#e0f2fe;--dm-art-shell:#0f2942;--dm-art-face:#f8fafc;--dm-art-window:#8be2ff;--dm-art-accent:#0ea5e9}
      :root[data-theme="dark"]{--dm-art-panel:#172554;--dm-art-shell:#dbeafe;--dm-art-face:#1e3a5f;--dm-art-window:#38bdf8;--dm-art-accent:#7dd3fc}
      label:has(#dm-temperature-icon){display:none!important}
      [data-report-manual][hidden]{display:none!important}
      #temp-grid .temp-card{aspect-ratio:auto!important;min-height:110px!important}
    `;
    doc.head.append(style);
  }

  function validateInput(input) {
    if (!input?.matches?.("input[data-entity-input]")) return;
    const value = clean(input.value);
    input.dataset.validation = value
      ? /^[a-z_]+\.[a-z0-9_]+$/i.test(value)
        ? "valid"
        : "invalid"
      : "empty";
  }

  function applyTemperatureEditor() {
    const input = doc.getElementById("dm-temperature-icon");
    if (input) {
      input.type = "hidden";
      input.tabIndex = -1;
      if (!clean(input.value)) input.value = "mdi:home";
      const label = input.closest("label,[data-icon-field]");
      if (label) {
        if (input.parentElement !== label || label.childNodes.length !== 1) label.replaceChildren(input);
        label.hidden = true;
        label.style.setProperty("display", "none", "important");
        label.setAttribute("aria-hidden", "true");
      }
    }
    const submit = doc.querySelector("[data-temperature-submit]");
    if (submit) submit.textContent = doc.documentElement.lang === "en" ? "ASSOCIATE" : "ASSOCIA";
  }

  function decorateTemperatureCards() {
    doc.querySelectorAll("#temp-grid .temp-room-icon").forEach((icon) => {
      let label = icon.querySelector("[data-room-icon-label]");
      if (!label) {
        label = doc.createElement("span");
        label.dataset.roomIconLabel = "";
        label.hidden = true;
        label.setAttribute("aria-hidden", "true");
        icon.append(label);
      }
      const source = clean(icon.dataset.roomIcon) || clean(icon.getAttribute("aria-label")) || "room";
      label.textContent = /^mdi:/i.test(source) ? "🏠" : source;
      if (!icon.getAttribute("aria-label")) icon.setAttribute("aria-label", source);
    });
  }

  function decorateIrrigationEditor() {
    const body = doc.getElementById("ed-body");
    if (!body || doc.querySelector(".ed-tab.active")?.dataset?.tab !== "irr") return;
    body.classList.add("dm-irrigation-form");
    const placeholders = {
      "ed-irr-ent": "switch.irrigazione_zona1",
      "ed-irr-rain": "sensor.prob_pioggia_oggi",
      "ed-irr-weather": "weather.casa",
    };
    Object.entries(placeholders).forEach(([id, placeholder]) => {
      const input = doc.getElementById(id);
      if (!input) return;
      input.dataset.entityInput = "true";
      input.placeholder = placeholder;
      input.value = clean(input.value).replace(/[\\"]/g, "");
      validateInput(input);
      const holder = input.closest("label,.ed-slot") || input.parentElement;
      if (holder) holder.dataset.entityField = "";
      let picker = holder?.querySelector(`.dm-entity-picker[data-entity-target="${id}"]`);
      if (!picker) {
        picker = doc.createElement("button");
        picker.type = "button";
        picker.className = "dm-entity-picker";
        picker.dataset.entityTarget = id;
        picker.setAttribute("aria-label", "Seleziona entity_id");
        picker.textContent = "🔍";
        input.insertAdjacentElement("afterend", picker);
      }
    });
  }

  function applyEditorContracts() {
    installFinalStyle();
    applyTemperatureEditor();
    decorateTemperatureCards();
    decorateIrrigationEditor();
    doc.querySelectorAll("input[data-entity-input]").forEach(validateInput);
  }

  async function saveTemperature(event) {
    if (state.temperatureSaving) return;
    const button = event.target?.closest?.("[data-temperature-submit]");
    if (!button) return;
    const dashboardStore = store();
    const roomId = clean(doc.getElementById("dm-temperature-room")?.value);
    const temp = clean(doc.getElementById("ed-pl-temp")?.value);
    const hum = clean(doc.getElementById("dm-humidity-new")?.value);
    if (!dashboardStore?.updateItem || !roomId) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    state.temperatureSaving = true;
    try {
      await dashboardStore.updateItem("rooms", roomId, { temp, hum });
      root.editorSwitch?.("sez7");
    } finally {
      state.temperatureSaving = false;
    }
  }

  function cumulativeEntity(entityId) {
    const id = clean(entityId);
    if (!id) return false;
    const attributes = allStates()[id]?.attributes || {};
    const stateClass = clean(attributes.state_class).toLowerCase();
    if (stateClass === "total" || stateClass === "total_increasing") return true;
    return /(^|[._ -])(total|totale|lifetime|counter|contatore|meter)([._ -]|$)/i.test(
      `${id} ${clean(attributes.friendly_name)}`,
    );
  }

  async function repairEnergy() {
    const dashboardStore = store();
    if (!dashboardStore?.getSection || !dashboardStore?.replaceSection) return false;
    const current = dashboardStore.getSection("energy") || {};
    const next = structuredClone(current);
    let changed = false;
    for (const group of ["house", "solar"]) {
      next[group] ||= {};
      const annual = clean(next[group].annual_energy);
      if (!clean(next[group].total_energy) && annual && cumulativeEntity(annual)) {
        next[group].total_energy = annual;
        changed = true;
      }
    }
    if (changed || next.metadata?.semantics_version !== 2) {
      next.metadata = { ...(next.metadata || {}), semantics_version: 2 };
      await dashboardStore.replaceSection("energy", next);
    }
    return true;
  }

  function metadata(id, states) {
    const attributes = states[id]?.attributes || {};
    return {
      id,
      domain: id.split(".")[0],
      unit: clean(attributes.unit_of_measurement).toLowerCase().replace(/\s+/g, ""),
      deviceClass: clean(attributes.device_class).toLowerCase(),
      text: `${id} ${clean(attributes.friendly_name)}`.toLowerCase(),
    };
  }

  function repairAppliance(item, states) {
    const tokens = [item.name, item.device_type, item.visual_key]
      .map((value) => clean(value).toLowerCase())
      .filter((value) => value.length >= 3);
    const explicit = [
      item.control_entity,
      item.power_entity,
      item.energy_entity,
      item.daily_energy_entity,
      item.monthly_energy_entity,
      item.total_energy_entity,
      item.report_entity,
      item.history_entity,
      ...(item.entities || []),
    ].map(clean).filter(Boolean);
    const discovered = Object.keys(states).filter((id) => {
      const text = `${id} ${clean(states[id]?.attributes?.friendly_name)}`.toLowerCase();
      return tokens.some((token) => text.includes(token));
    });
    const ids = [...new Set([...explicit, ...discovered])];
    const list = ids.map((id) => metadata(id, states));
    const control = list.find((entry) => /^(switch|light|input_boolean|fan)$/.test(entry.domain))?.id || "";
    const power = list.find((entry) => /^(w|kw)$/.test(entry.unit) || entry.deviceClass === "power" || /power|potenza|watt/.test(entry.text))?.id || "";
    const energies = list.filter((entry) => /^(wh|kwh|mwh)$/.test(entry.unit) || entry.deviceClass === "energy" || /energy|energia|kwh/.test(entry.text));
    const daily = energies.find((entry) => /oggi|today|daily|giorn|day/.test(entry.text))?.id || "";
    const monthly = energies.find((entry) => /mese|month|monthly/.test(entry.text))?.id || "";
    const total = energies.find((entry) => /totale|total|lifetime|counter|meter/.test(entry.text))?.id || "";
    const energy = clean(item.energy_entity) || monthly || total || daily || energies[0]?.id || "";
    const report = clean(item.report_entity) || monthly || total || daily || energy;
    return {
      ...item,
      entities: ids,
      control_entity: clean(item.control_entity) || control,
      power_entity: clean(item.power_entity) || power,
      energy_entity: energy,
      daily_energy_entity: clean(item.daily_energy_entity) || daily,
      monthly_energy_entity: clean(item.monthly_energy_entity) || monthly,
      total_energy_entity: clean(item.total_energy_entity) || total,
      report_entity: report,
      history_entity: clean(item.history_entity) || report || power,
      show_in_report: item.show_in_report !== false,
    };
  }

  async function repairAppliances() {
    const dashboardStore = store();
    if (!dashboardStore?.getSection || !dashboardStore?.replaceSection || state.repairing) return false;
    const current = dashboardStore.getSection("appliances") || [];
    if (!current.length) return true;
    const repaired = current.map((item) => repairAppliance(item, allStates()));
    const signature = (item) => JSON.stringify({
      entities: item.entities || [],
      control: item.control_entity || "",
      power: item.power_entity || "",
      energy: item.energy_entity || "",
      total: item.total_energy_entity || "",
      report: item.report_entity || "",
      history: item.history_entity || "",
    });
    if (!current.every((item, index) => signature(item) === signature(repaired[index]))) {
      state.repairing = true;
      try {
        await dashboardStore.replaceSection("appliances", repaired);
      } finally {
        state.repairing = false;
      }
    }
    root.__DASHBOARDMODERN_REAL_HA_0147_DATA_REPAIR__ = { installed: true, version: "0.15.0" };
    return true;
  }

  async function refresh() {
    if (state.refreshing || !runtime()?.refreshSelectedPeriod) return false;
    state.refreshing = true;
    try {
      await repairEnergy();
      await repairAppliances();
      const result = await runtime().refreshSelectedPeriod();
      root.__DASHBOARDMODERN_LEGACY_PERIOD_BRIDGE_V2__?.project?.(
        root.__DASHBOARDMODERN_RUNTIME_0150__?.bundle,
      );
      root.queueMicrotask?.(decorateTemperatureCards);
      return Boolean(result);
    } catch (error) {
      root.console?.warn?.("[DashboardModern 0.15.0] canonical readiness", error);
      return false;
    } finally {
      state.refreshing = false;
    }
  }

  function wrapTemperatureRenderer(name) {
    const current = root[name];
    if (typeof current !== "function" || current.__dmTemperatureLabels0150) return;
    function rendererWithTemperatureLabels0150(...args) {
      const result = current.apply(this, args);
      const finish = () => root.queueMicrotask?.(decorateTemperatureCards);
      if (result && typeof result.finally === "function") return result.finally(finish);
      finish();
      return result;
    }
    rendererWithTemperatureLabels0150.__dmTemperatureLabels0150 = true;
    rendererWithTemperatureLabels0150.__dmPrevious = current;
    root[name] = rendererWithTemperatureLabels0150;
  }

  function installWrappers() {
    if (!state.wrapped) {
      const current = root.editorSwitch;
      if (typeof current === "function") {
        function editorSwitchCanonical0150(...args) {
          const result = current.apply(this, args);
          root.queueMicrotask?.(applyEditorContracts);
          return result;
        }
        editorSwitchCanonical0150.__dmCanonicalReadiness = true;
        editorSwitchCanonical0150.__dmPrevious = current;
        editorSwitchCanonical0150.__dmRealFix = true;
        root.editorSwitch = editorSwitchCanonical0150;
        state.wrapped = true;
      }
    }
    wrapTemperatureRenderer("renderTemperature");
    wrapTemperatureRenderer("buildTempCards");
  }

  function settle() {
    state.attempts += 1;
    installFinalStyle();
    installWrappers();
    applyEditorContracts();
    decorateTemperatureCards();
    if (store() && runtime()) refresh();
    if ((!store() || !runtime() || !state.wrapped) && state.attempts < 180) {
      root.requestAnimationFrame?.(settle);
    }
  }

  doc.addEventListener("input", (event) => validateInput(event.target), true);
  doc.addEventListener("click", (event) => {
    saveTemperature(event).catch((error) => root.console?.warn?.("Temperature save", error));
    root.queueMicrotask?.(applyEditorContracts);
  }, true);
  doc.addEventListener("change", (event) => {
    if (event.target?.id === "dm-temperature-room") {
      const room = store()?.getSection?.("rooms")?.find((item) => clean(item.id) === clean(event.target.value));
      const icon = doc.getElementById("dm-temperature-icon");
      if (icon) icon.value = clean(room?.icon) || "mdi:home";
    }
    root.queueMicrotask?.(applyEditorContracts);
  }, true);
  root.addEventListener?.("dashboardmodern:legacy-ready", () => root.queueMicrotask?.(settle));
  root.addEventListener?.("dashboardmodern:runtime-ready", () => root.queueMicrotask?.(settle));
  root.addEventListener?.("pageshow", () => root.queueMicrotask?.(settle));
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", settle, { once: true });
  else settle();
})(globalThis);
