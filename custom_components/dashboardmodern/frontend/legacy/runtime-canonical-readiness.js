/* DashboardModern 0.15.0 — bounded canonical model readiness repair. */
(function installCanonicalReadiness0150(root) {
  "use strict";

  const KEY = "__DASHBOARDMODERN_CANONICAL_READINESS_0150__";
  if (root[KEY]?.installed) return;
  const doc = root.document;
  if (!doc) return;

  const state = (root[KEY] = {
    installed: true,
    version: "0.15.0",
    energyRepaired: false,
    appliancesRepaired: false,
    refreshing: false,
    attempts: 0,
  });
  const clean = (value) => String(value || "").trim();
  const store = () => root.DashboardModernModules?.store || null;
  const runtime = () => root.DashboardModernRuntime0150 || null;
  const allStates = () => ({ ...(root._RAW_STATES || {}), ...(root.STATES || {}) });

  function cumulativeEntity(entityId) {
    const id = clean(entityId);
    if (!id) return false;
    const entity = allStates()[id];
    const attributes = entity?.attributes || {};
    const stateClass = clean(attributes.state_class).toLowerCase();
    if (stateClass === "total" || stateClass === "total_increasing") return true;
    const text = `${id} ${clean(attributes.friendly_name)}`.toLowerCase();
    return /(^|[._ -])(total|totale|lifetime|counter|contatore|meter)([._ -]|$)/.test(text);
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
    state.energyRepaired = true;
    return true;
  }

  function metadata(id, states) {
    const entityId = clean(id);
    const attributes = states[entityId]?.attributes || {};
    return {
      id: entityId,
      domain: entityId.split(".")[0],
      unit: clean(attributes.unit_of_measurement).toLowerCase().replace(/\s+/g, ""),
      deviceClass: clean(attributes.device_class).toLowerCase(),
      text: `${entityId} ${clean(attributes.friendly_name)}`.toLowerCase(),
    };
  }

  function repairAppliance(item, states) {
    const ids = [...new Set([
      item.control_entity,
      item.power_entity,
      item.energy_entity,
      item.daily_energy_entity,
      item.monthly_energy_entity,
      item.total_energy_entity,
      item.report_entity,
      item.history_entity,
      ...(item.entities || []),
    ].map(clean).filter(Boolean))];
    const list = ids.map((id) => metadata(id, states));
    const control = list.find((entry) => /^(switch|light|input_boolean|fan)$/.test(entry.domain))?.id || "";
    const power = list.find((entry) =>
      /^(w|kw)$/.test(entry.unit) ||
      entry.deviceClass === "power" ||
      /(?:^|[._ -])(power|potenza|watt)([._ -]|$)/.test(entry.text),
    )?.id || "";
    const energies = list.filter((entry) =>
      /^(wh|kwh|mwh)$/.test(entry.unit) ||
      entry.deviceClass === "energy" ||
      /(?:^|[._ -])(energy|energia|kwh)([._ -]|$)/.test(entry.text),
    );
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
    if (!dashboardStore?.getSection || !dashboardStore?.replaceSection) return false;
    const current = dashboardStore.getSection("appliances") || [];
    if (!Array.isArray(current) || !current.length) {
      state.appliancesRepaired = true;
      return true;
    }
    const states = allStates();
    const repaired = current.map((item) => repairAppliance(item, states));
    const signature = (item) => JSON.stringify({
      entities: item.entities || [],
      control_entity: item.control_entity || "",
      power_entity: item.power_entity || "",
      energy_entity: item.energy_entity || "",
      daily_energy_entity: item.daily_energy_entity || "",
      monthly_energy_entity: item.monthly_energy_entity || "",
      total_energy_entity: item.total_energy_entity || "",
      report_entity: item.report_entity || "",
      history_entity: item.history_entity || "",
      show_in_report: item.show_in_report !== false,
    });
    if (!current.every((item, index) => signature(item) === signature(repaired[index]))) {
      await dashboardStore.replaceSection("appliances", repaired);
    }
    state.appliancesRepaired = repaired.every((item) =>
      !(item.entities || []).length || Boolean(item.power_entity || item.energy_entity || item.control_entity),
    );
    return true;
  }

  async function refresh() {
    if (state.refreshing || !runtime()?.refreshSelectedPeriod) return false;
    state.refreshing = true;
    try {
      await repairEnergy();
      await repairAppliances();
      return Boolean(await runtime().refreshSelectedPeriod());
    } catch (error) {
      root.console?.warn?.("[DashboardModern 0.15.0] canonical readiness", error);
      return false;
    } finally {
      state.refreshing = false;
    }
  }

  function settle() {
    state.attempts += 1;
    if (store() && runtime()) {
      refresh();
      // State metadata can arrive immediately after the store. Keep the retry
      // bounded to the first two animation frames; no permanent polling exists.
      if ((!state.energyRepaired || !state.appliancesRepaired) && state.attempts < 120) {
        root.requestAnimationFrame?.(settle);
      }
      return;
    }
    if (state.attempts < 120) root.requestAnimationFrame?.(settle);
  }

  root.addEventListener?.("dashboardmodern:legacy-ready", () => root.queueMicrotask?.(settle));
  root.addEventListener?.("dashboardmodern:runtime-ready", () => root.queueMicrotask?.(settle));
  root.addEventListener?.("pageshow", () => root.queueMicrotask?.(settle));
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", settle, { once: true });
  else settle();
})(globalThis);
