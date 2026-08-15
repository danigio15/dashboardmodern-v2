/* Beta 23 release guard.
 *
 * The historical beta5 polish still runs after normal Energy renders and used
 * to force every day/month load node visible while also rewriting values from
 * fixed legacy slots. Beta 23 moved ownership to the canonical `loads` section,
 * so this final event-driven pass restores that ownership after legacy polish.
 *
 * No polling and no global MutationObserver are used here.
 */

import { clean, doc, root } from "./shared.js";

const KEY = "__DASHBOARDMODERN_BETA23_RELEASE_GUARD__";
const SLOT_KEYS = Object.freeze(["boiler", "wb", "clima", "lav", "cuc"]);
const state = (root[KEY] ||= { installed: false, frame: 0, timer: 0, storeBound: false });

function dashboardStore() {
  return root.DashboardModernModules?.store || null;
}

function configuredLoads() {
  let loads = [];
  try {
    loads = dashboardStore()?.getSection?.("loads") || [];
  } catch (_error) {
    loads = [];
  }
  return (Array.isArray(loads) ? loads : [])
    .filter(
      (item) =>
        item &&
        item.category !== "manual-report" &&
        item.show_in_dashboard !== false &&
        (clean(item.name) ||
          clean(item.power_entity) ||
          clean(item.daily_energy_entity) ||
          clean(item.monthly_energy_entity) ||
          clean(item.total_energy_entity) ||
          clean(item.history_entity)),
    )
    .slice()
    .sort((left, right) => (Number(left.order) || 0) - (Number(right.order) || 0))
    .slice(0, SLOT_KEYS.length);
}

function allStates() {
  return root.STATES || root._RAW_STATES || root.hass?.states || root.__HASS__?.states || {};
}

function numericState(entity) {
  const id = clean(entity);
  if (!id) return null;
  const source = allStates()?.[id];
  const value = Number(source?.state ?? source);
  return Number.isFinite(value) ? Math.max(0, value) : null;
}

function periodEntity(load, period) {
  if (period === "day") return clean(load?.daily_energy_entity);
  if (period === "month")
    return clean(load?.monthly_energy_entity || load?.history_entity || load?.total_energy_entity);
  return clean(load?.power_entity);
}

function formatValue(value, period) {
  const locale = doc?.documentElement?.lang === "en" ? "en-GB" : "it-IT";
  const digits = period === "instant" ? 0 : 1;
  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)} ${period === "instant" ? "W" : "kWh"}`;
}

function periodSuffix(period) {
  if (period === "day") return "-day";
  if (period === "month") return "-month";
  return "";
}

function valueId(slot, period) {
  if (period === "instant") return `v-${slot}-p`;
  return `v-${slot}-${period}`;
}

function setNodeVisible(node, visible) {
  if (!node) return;
  node.hidden = !visible;
  if (visible) {
    node.style.removeProperty("display");
    node.style.setProperty("visibility", "visible", "important");
    node.style.setProperty("opacity", "1", "important");
  } else {
    node.style.setProperty("display", "none", "important");
    node.style.setProperty("visibility", "hidden", "important");
  }
}

function setLineVisible(line, visible, loadId = "") {
  if (!line) return;
  line.hidden = !visible;
  if (visible) {
    if (line.style.getPropertyValue("display") === "none") line.style.removeProperty("display");
    line.style.setProperty("visibility", "visible", "important");
    line.dataset.dmCanonicalLoad = loadId;
  } else {
    line.style.setProperty("display", "none", "important");
    line.style.setProperty("visibility", "hidden", "important");
    delete line.dataset.dmCanonicalLoad;
  }
}

export function reconcileBeta23LoadOwnership() {
  if (!doc) return false;
  const loads = configuredLoads();
  let touched = false;

  for (const period of ["instant", "day", "month"]) {
    const suffix = periodSuffix(period);
    SLOT_KEYS.forEach((slot, index) => {
      const load = loads[index] || null;
      const visible = Boolean(load);
      const node = doc.getElementById(`n-${slot}${suffix}`);
      setNodeVisible(node, visible);
      if (node) {
        node.dataset.dmFlowSlot = slot;
        node.dataset.dmBeta5FlowComplete = "true";
        if (load) node.dataset.dmCanonicalLoad = clean(load.id) || clean(load.name);
        else delete node.dataset.dmCanonicalLoad;
        touched = true;
      }

      for (const id of [`line-home-${slot}${suffix}`, `m-line-home-${slot}${suffix}`]) {
        const line = doc.getElementById(id);
        if (!line) continue;
        setLineVisible(line, visible, clean(load?.id));
        touched = true;
      }

      if (!load) return;
      const entity = periodEntity(load, period);
      const value = numericState(entity);
      const target = doc.getElementById(valueId(slot, period));
      if (target && value !== null) {
        target.textContent = formatValue(value, period);
        target.dataset.dmCanonicalLoad = clean(load.id) || clean(load.name);
        target.dataset.dmCanonicalEntity = entity;
      }
    });
  }

  for (const period of ["instant", "day", "month"]) {
    const viewId = period === "instant" ? "view-ist" : `view-${period}`;
    const view = doc.getElementById(viewId);
    if (view) view.dataset.dmCanonicalLoadCount = String(loads.length);
  }
  return touched;
}

function schedule() {
  if (!doc || state.frame) return;
  const run = () => {
    state.frame = 0;
    reconcileBeta23LoadOwnership();
  };
  state.frame = root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 0);
}

function scheduleSettled() {
  schedule();
  if (state.timer) root.clearTimeout?.(state.timer);
  state.timer = root.setTimeout?.(() => {
    state.timer = 0;
    schedule();
  }, 120);
}

function wrapAfter(name) {
  const current = root[name];
  const marker = `__dmBeta23ReleaseGuard_${name}`;
  if (typeof current !== "function" || current[marker]) return false;
  const wrapped = function (...args) {
    const result = current.apply(this, args);
    if (result && typeof result.finally === "function") result.finally(scheduleSettled);
    else scheduleSettled();
    return result;
  };
  wrapped[marker] = true;
  wrapped.__dmWrappedOriginal = current;
  root[name] = wrapped;
  return true;
}

function bindStore() {
  if (state.storeBound) return;
  const current = dashboardStore();
  if (!current?.subscribe) return;
  state.storeBound = true;
  current.subscribe((change) => {
    if (change?.section === "loads") scheduleSettled();
  });
}

function install() {
  if (!doc || state.installed) return;
  state.installed = true;
  for (const name of [
    "render",
    "renderEnergyDashboard",
    "renderEnergyDay",
    "renderEnergyMonth",
    "switchEnergyView",
    "dmRefreshEnergyFlows",
  ])
    wrapAfter(name);
  bindStore();
  for (const eventName of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:energy-stable",
    "dashboardmodern:energy-bundle",
    "dashboardmodern:period-bundle",
  ])
    root.addEventListener?.(eventName, scheduleSettled);
  scheduleSettled();
  root.setTimeout?.(() => {
    for (const name of [
      "render",
      "renderEnergyDashboard",
      "renderEnergyDay",
      "renderEnergyMonth",
      "switchEnergyView",
      "dmRefreshEnergyFlows",
    ])
      wrapAfter(name);
    bindStore();
    scheduleSettled();
  }, 250);
}

if (doc?.readyState === "loading") doc.addEventListener("DOMContentLoaded", install, { once: true });
else install();
