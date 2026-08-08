import { clean, doc, root, section } from "./shared.js";

const KEY = "__DASHBOARDMODERN_ENERGY_STABILITY_SECTION__";
const state = (root[KEY] ||= {
  installed: false,
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
  return true;
}

function synchronizeStability() {
  return releaseStableEnergy() || holdEnergyUntilStable();
}

export function installEnergyStabilitySection() {
  if (!doc || state.installed) return;
  state.installed = true;

  // energy-section.js is the sole owner of Recorder requests, retries and
  // refresh scheduling. This module only reflects that canonical state in the
  // UI; it must never start a second refresh pipeline during bootstrap.
  synchronizeStability();
  root.addEventListener?.("dashboardmodern:energy-stable", releaseStableEnergy);
  root.addEventListener?.("dashboardmodern:period-bundle", releaseStableEnergy);
  for (const event of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:bridge-ready",
    "pageshow",
  ]) {
    root.addEventListener?.(event, synchronizeStability);
  }
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installEnergyStabilitySection, { once: true });
else installEnergyStabilitySection();
