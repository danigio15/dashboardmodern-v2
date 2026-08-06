import {
  allStates,
  clean,
  dashboardStore,
  doc,
  root,
  section,
  t,
} from "./shared.js";
import { scheduleApplianceNormalization } from "./appliances-section.js";

const KEY = "__DASHBOARDMODERN_RUNTIME_HOTFIX_0159__";
const state = (root[KEY] ||= { installed: false, migrating: false, listeners: false });

function isCumulative(entityId) {
  const id = clean(entityId);
  if (!id) return false;
  const item = allStates()[id];
  const stateClass = clean(item?.attributes?.state_class).toLowerCase();
  if (["total", "total_increasing"].includes(stateClass)) return true;
  const text = `${id} ${clean(item?.attributes?.friendly_name)}`.toLowerCase();
  return /(^|[\s._-])(total|totale|lifetime|counter|contatore|meter)([\s._-]|$)/.test(text);
}

function migratedEnergyModel(model) {
  const next = structuredClone(model || {});
  let changed = false;
  for (const groupName of ["house", "solar"]) {
    const group = (next[groupName] ||= {});
    const annual = clean(group.annual_energy);
    if (!clean(group.total_energy) && annual && isCumulative(annual)) {
      group.total_energy = annual;
      changed = true;
    }
  }
  const grid = (next.grid ||= {});
  for (const [totalKey, annualKey] of [
    ["total_import_energy", "annual_import_energy"],
    ["total_export_energy", "annual_export_energy"],
  ]) {
    const annual = clean(grid[annualKey]);
    if (!clean(grid[totalKey]) && annual && isCumulative(annual)) {
      grid[totalKey] = annual;
      changed = true;
    }
  }
  const battery = (next.battery ||= {});
  for (const [totalKey, annualKey] of [
    ["total_charged_energy", "annual_charged_energy"],
    ["total_discharged_energy", "annual_discharged_energy"],
  ]) {
    const annual = clean(battery[annualKey]);
    if (!clean(battery[totalKey]) && annual && isCumulative(annual)) {
      battery[totalKey] = annual;
      changed = true;
    }
  }
  return { next, changed };
}

export async function migrateLegacyEnergyTotals() {
  if (state.migrating) return false;
  const store = dashboardStore();
  if (!store?.replaceSection) return false;
  const current = section("energy", {});
  const { next, changed } = migratedEnergyModel(current);
  if (!changed) return false;
  state.migrating = true;
  try {
    await store.replaceSection("energy", next);
    root.__DASHBOARDMODERN_RUNTIME_ROOT__?.broker?.cache?.clear?.();
    root.refreshEnergy?.();
    return true;
  } finally {
    state.migrating = false;
  }
}

function relabelLegacyTotalFields() {
  const editor = doc?.querySelector('#editor-modal [data-editor="energy"],#ed-body[data-editor="energy"]');
  if (!editor) return false;
  for (const group of ["house", "solar"]) {
    const input = editor.querySelector(`[name="${group}.annual_energy"]`);
    if (!input || !isCumulative(input.value)) continue;
    const slot = input.closest(".ed-slot");
    const label = slot?.querySelector(".ed-slot-lbl");
    if (label) {
      label.innerHTML = `${t("Contatore energia totale", "Total energy meter")} <span class="ed-acc-n">kWh</span> <span class="dm-total-required">${t("STORICO E REPORT", "HISTORY & REPORT")}</span>`;
    }
    const hint = slot?.querySelector(".ed-hint");
    if (hint) hint.textContent = t(
      "Sensore cumulativo total/total_increasing. Da questo valore vengono calcolati giorno, mese, anno e mesi precedenti.",
      "Cumulative total/total_increasing sensor used for day, month, year and previous months.",
    );
    slot?.classList.add("dm-legacy-total-promoted");
  }
  return true;
}

function configuredApplianceEntities() {
  const result = new Set();
  const devices = section("appliances", []);
  for (const device of Array.isArray(devices) ? devices : []) {
    for (const value of [
      device.control_entity,
      device.power_entity,
      device.daily_energy_entity,
      device.monthly_energy_entity,
      device.total_energy_entity,
      ...(device.entities || []),
    ]) {
      const id = clean(typeof value === "string" ? value : value?.entity || value?.entity_id);
      if (id) result.add(id);
    }
  }
  return result;
}

function applianceStateChanged(event) {
  const id = clean(
    event?.detail?.entity_id ||
      event?.detail?.new_state?.entity_id ||
      event?.detail?.data?.new_state?.entity_id,
  );
  if (!id || !configuredApplianceEntities().has(id)) return;
  scheduleApplianceNormalization();
}

function removeRedundantApplianceHooks() {
  root.removeEventListener?.("dashboardmodern:state-changed", scheduleApplianceNormalization);
  if (!state.listeners) {
    state.listeners = true;
    root.addEventListener?.("dashboardmodern:state-changed", applianceStateChanged);
  }
}

function stopEnergyRetryStorm() {
  const stability = root.__DASHBOARDMODERN_ENERGY_STABILITY_SECTION__;
  if (!stability) return false;
  root.clearTimeout?.(stability.retryTimer);
  stability.retryTimer = 0;
  if (root.__DASHBOARDMODERN_RUNTIME_ROOT__?.bundle) stability.attempts = 0;
  return true;
}

function fixApplianceStatusPresentation() {
  const devices = section("appliances", []);
  const states = allStates();
  const byId = new Map((Array.isArray(devices) ? devices : []).map((item) => [clean(item.id), item]));
  doc?.querySelectorAll("#page-appliances-main .appl-wide-card[data-appliance-id],#appl-grid-overview .appl-wide-card[data-appliance-id]").forEach((card) => {
    const device = byId.get(clean(card.dataset.applianceId));
    if (!device) return;
    const powerEntity = clean(device.power_entity);
    const power = Number(states[powerEntity]?.state);
    if (!powerEntity || !Number.isFinite(power)) return;
    const threshold = Number.isFinite(Number(device.threshold_run)) ? Number(device.threshold_run) : 5;
    const running = power > threshold;
    const control = clean(device.control_entity || device.switch_entity);
    const enabled = states[control]?.state === "on";
    const badge = card.querySelector(".appl-wide-status,.appl-status,.appl-state,[data-appliance-state],.appl-badge");
    if (!badge) return;
    const label = running
      ? t("IN FUNZIONE", "RUNNING")
      : enabled
        ? t("STANDBY", "STANDBY")
        : t("SPENTO", "OFF");
    badge.textContent = label;
    badge.dataset.state = running ? "on" : enabled ? "standby" : "off";
    card.dataset.applianceState = badge.dataset.state;
  });
}

function installStyles() {
  if (!doc?.head || doc.getElementById("dm-runtime-hotfix-0159-style")) return;
  const style = doc.createElement("style");
  style.id = "dm-runtime-hotfix-0159-style";
  style.textContent = `
    .dm-total-required{display:inline-flex!important;margin-left:7px!important;padding:3px 7px!important;border-radius:999px!important;background:rgba(16,185,129,.13)!important;color:#047857!important;font-size:9px!important;font-weight:900!important}
    .dm-legacy-total-promoted{border:2px solid color-mix(in srgb,var(--success-color,#10b981) 45%,transparent)!important;border-radius:14px!important;padding:10px!important}
    [data-appliance-state][data-state="standby"],.appl-wide-status[data-state="standby"],.appl-status[data-state="standby"]{background:rgba(245,158,11,.14)!important;color:#b45309!important}
    @media(max-width:560px){
      #page-appliances-main .appl-wide-actions button,#appl-grid-overview .appl-wide-actions button,
      #page-appliances-main .appl-actions button,#appl-grid-overview .appl-actions button,
      #page-appliances-main .dm-appliance-power-toggle,#appl-grid-overview .dm-appliance-power-toggle{min-width:0!important;padding:8px 10px!important;font-size:12px!important}
    }
  `;
  doc.head.append(style);
}

function refreshHotfix() {
  removeRedundantApplianceHooks();
  stopEnergyRetryStorm();
  relabelLegacyTotalFields();
  fixApplianceStatusPresentation();
}

export function installRuntimeHotfix0159Section() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  removeRedundantApplianceHooks();
  stopEnergyRetryStorm();
  migrateLegacyEnergyTotals();
  refreshHotfix();
  root.addEventListener?.("dashboardmodern:legacy-ready", refreshHotfix);
  root.addEventListener?.("dashboardmodern:runtime-ready", refreshHotfix);
  root.addEventListener?.("dashboardmodern:period-bundle", refreshHotfix);
  doc.addEventListener("click", (event) => {
    if (event.target?.closest?.(".ed-tab,.ed-inner-tab,[data-energy-tab]")) root.queueMicrotask?.(refreshHotfix);
  }, true);
}

if (doc?.readyState === "loading") doc.addEventListener("DOMContentLoaded", installRuntimeHotfix0159Section, { once: true });
else installRuntimeHotfix0159Section();
