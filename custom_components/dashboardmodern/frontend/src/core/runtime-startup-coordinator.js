/* Bounded startup coordinator: the root runtime is refreshed once HA states exist. */
import { refreshEnergy } from "../../legacy/runtime-consolidated.js";

const root = globalThis;
const doc = root.document;
const KEY = "__DASHBOARDMODERN_STARTUP_COORDINATOR__";
const state = (root[KEY] ||= { installed: true, running: false, completed: false });
const clean = (value) => String(value ?? "").trim();

function configuredEnergyEntities() {
  const energy = root.DashboardModernModules?.store?.getSection?.("energy") || {};
  const output = [];
  for (const group of [energy.house, energy.solar, energy.grid, energy.battery]) {
    if (!group || typeof group !== "object") continue;
    Object.entries(group).forEach(([key, value]) => {
      if (/energy/i.test(key) && clean(value).includes(".")) output.push(clean(value));
    });
  }
  return [...new Set(output)];
}

function statesReady() {
  const ids = configuredEnergyEntities();
  if (!ids.length) return Boolean(root.DashboardModernModules?.store);
  const states = { ...(root._RAW_STATES || {}), ...(root.STATES || {}) };
  return ids.some((id) => states[id]);
}

function nextFrame() {
  return new Promise((resolve) => {
    if (typeof root.requestAnimationFrame === "function") root.requestAnimationFrame(resolve);
    else root.setTimeout?.(resolve, 16);
  });
}

export async function settleRuntimeStartup() {
  if (state.running || state.completed) return state.completed;
  state.running = true;
  try {
    for (let attempt = 0; attempt < 240 && !statesReady(); attempt += 1) {
      await nextFrame();
    }
    const applied = await refreshEnergy();
    state.completed = Boolean(applied);
    return state.completed;
  } finally {
    state.running = false;
  }
}

function schedule() {
  root.queueMicrotask?.(settleRuntimeStartup);
}

root.addEventListener?.("dashboardmodern:legacy-ready", schedule);
root.addEventListener?.("dashboardmodern:runtime-ready", schedule);
if (doc?.readyState === "loading") doc.addEventListener("DOMContentLoaded", schedule, { once: true });
else schedule();
