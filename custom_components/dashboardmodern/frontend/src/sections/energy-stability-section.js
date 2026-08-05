import { refreshEnergy } from "./energy-section.js";
import { waitForHostedBridge } from "../transport/hosted-bridge-guard.js";
import { clean, doc, root, section } from "./shared.js";

const KEY = "__DASHBOARDMODERN_ENERGY_STABILITY_SECTION__";
const state = (root[KEY] ||= {
  installed: false,
  running: false,
  retryTimer: 0,
  attempts: 0,
});

function configuredEnergy() {
  const model = section("energy", {});
  return ["house", "grid", "solar", "battery"].some((group) =>
    Object.values(model?.[group] || {}).some((value) => clean(value)),
  );
}

function views() {
  return [...(doc?.querySelectorAll("#view-day,#view-month,#view-panoramica") || [])];
}

export function holdEnergyUntilStable() {
  if (!configuredEnergy() || root.__DASHBOARDMODERN_RUNTIME_ROOT__?.bundle) return false;
  views().forEach((node) => {
    node.classList.add("dm-energy-awaiting", "dm-energy-loading");
    node.setAttribute("aria-busy", "true");
  });
  return true;
}

export function releaseStableEnergy() {
  if (!root.__DASHBOARDMODERN_RUNTIME_ROOT__?.bundle) return false;
  views().forEach((node) => {
    node.classList.remove("dm-energy-awaiting", "dm-energy-loading");
    node.removeAttribute("aria-busy");
  });
  state.attempts = 0;
  root.clearTimeout?.(state.retryTimer);
  state.retryTimer = 0;
  return true;
}

function scheduleRecovery(delay = 200) {
  if (state.retryTimer || state.attempts >= 24 || root.__DASHBOARDMODERN_RUNTIME_ROOT__?.bundle)
    return;
  state.retryTimer = root.setTimeout?.(() => {
    state.retryTimer = 0;
    recoverEnergyAfterBridge();
  }, delay);
}

export async function recoverEnergyAfterBridge() {
  if (state.running || !configuredEnergy()) return false;
  if (root.__DASHBOARDMODERN_RUNTIME_ROOT__?.bundle) return releaseStableEnergy();
  state.running = true;
  holdEnergyUntilStable();
  try {
    await waitForHostedBridge({ timeout: 8000, interval: 25 });
    const applied = await refreshEnergy();
    if (applied) return releaseStableEnergy();
    state.attempts += 1;
    scheduleRecovery(Math.min(2000, 250 + state.attempts * 100));
    return false;
  } catch (error) {
    state.attempts += 1;
    root.console?.warn?.("[DashboardModern] Energy bridge recovery deferred", error);
    scheduleRecovery(Math.min(2000, 250 + state.attempts * 100));
    return false;
  } finally {
    state.running = false;
  }
}

export function installEnergyStabilitySection() {
  if (!doc || state.installed) return;
  state.installed = true;
  holdEnergyUntilStable();
  root.addEventListener?.("dashboardmodern:energy-stable", releaseStableEnergy);
  root.addEventListener?.("dashboardmodern:period-bundle", releaseStableEnergy);
  for (const event of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:bridge-ready",
    "pageshow",
  ]) {
    root.addEventListener?.(event, () => {
      if (!releaseStableEnergy()) recoverEnergyAfterBridge();
    });
  }
  recoverEnergyAfterBridge();
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installEnergyStabilitySection, { once: true });
else installEnergyStabilitySection();