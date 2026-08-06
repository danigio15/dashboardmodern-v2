import { doc, installStyle, root, wrapFunction } from "./shared.js";

const KEY = "__DASHBOARDMODERN_ENERGY_FLOW_SECTION__";
const state = (root[KEY] ||= { installed: false, frame: 0 });

const COLORS = Object.freeze({
  solar: "#ff9f0a",
  grid: "#2563eb",
  battery: "#14b8a6",
  home: "#8b5cf6",
  export: "#7c3aed",
});

function numberFrom(node) {
  const text = String(node?.textContent || "").replace(/\./g, "").replace(",", ".");
  const match = text.match(/-?\d+(?:\.\d+)?/);
  return match ? Math.abs(Number(match[0])) : 0;
}

function periodActive(period, key) {
  const suffix = period === "day" ? "day" : "month";
  const id = key === "home" ? `v-home-${suffix}` : key === "solar" ? `v-solar-${suffix}` : key === "grid" ? `v-grid-${suffix}` : `v-battery-${suffix}`;
  return numberFrom(doc?.getElementById(id)) > 0.001;
}

function candidates(scope, key) {
  const words = key === "grid" ? ["grid", "rete"] : key === "solar" ? ["solar", "solare", "pv"] : key === "battery" ? ["battery", "batteria"] : ["home", "house", "casa"];
  const selector = words.flatMap((word) => [`[id*="${word}" i]`, `[class*="${word}" i]`, `[data-flow*="${word}" i]`, `[data-source*="${word}" i]`]).join(",");
  return [...scope.querySelectorAll(selector)].filter((node) => /^(path|line|polyline|circle|g|div|span)$/i.test(node.tagName));
}

function colorNode(node, color, active) {
  node.classList.toggle("dm-energy-flow-active", active);
  node.classList.toggle("dm-energy-flow-idle", !active);
  node.style.setProperty("--dm-flow-color", color);
  if (/^(path|line|polyline|circle)$/i.test(node.tagName)) {
    node.style.stroke = active ? color : "var(--divider-color,#dbe4ee)";
    if (node.getAttribute("fill") && node.getAttribute("fill") !== "none") node.style.fill = active ? color : "var(--divider-color,#dbe4ee)";
  }
}

export function refreshEnergyFlows() {
  if (!doc) return false;
  const scopes = [
    doc.getElementById("page-energy-month"),
    doc.getElementById("page-energy-day"),
    doc.getElementById("dp-month"),
    doc.getElementById("dp-day"),
    ...doc.querySelectorAll(".energy-flow,.energy-diagram,[data-energy-flow],.flow-diagram"),
  ].filter(Boolean);
  if (!scopes.length) return false;
  for (const scope of scopes) {
    const period = /day|giorn/i.test(`${scope.id} ${scope.className}`) ? "day" : "month";
    for (const [key, color] of Object.entries(COLORS)) {
      if (key === "export") continue;
      const active = periodActive(period, key);
      candidates(scope, key).forEach((node) => colorNode(node, color, active));
    }
    scope.dataset.dmEnergyFlows = "active";
  }
  return true;
}

function schedule() {
  if (state.frame) return;
  state.frame = root.requestAnimationFrame?.(() => {
    state.frame = 0;
    refreshEnergyFlows();
  }) || root.setTimeout?.(() => {
    state.frame = 0;
    refreshEnergyFlows();
  }, 0);
}

function installStyles() {
  installStyle("dm-energy-flow-section-style", `
    .dm-energy-flow-active{opacity:1!important;filter:drop-shadow(0 0 5px color-mix(in srgb,var(--dm-flow-color) 42%,transparent))!important;transition:stroke .2s ease,fill .2s ease,opacity .2s ease!important}
    .dm-energy-flow-idle{opacity:.35!important;filter:none!important;transition:stroke .2s ease,fill .2s ease,opacity .2s ease!important}
    .dm-energy-flow-active[stroke-dasharray],path.dm-energy-flow-active,line.dm-energy-flow-active,polyline.dm-energy-flow-active{animation:dmEnergyFlowDash 1.8s linear infinite!important}
    @keyframes dmEnergyFlowDash{to{stroke-dashoffset:-28}}
    @media(prefers-reduced-motion:reduce){.dm-energy-flow-active{animation:none!important}}
  `);
}

export function installEnergyFlowSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  for (const name of ["renderEnergyMonth", "renderEnergyDay", "renderEnergyDashboard", "applyAtomicEnergyBundle"]) wrapFunction(name, `__dmEnergyFlow_${name}`, schedule);
  root.addEventListener?.("dashboardmodern:energy-bundle", schedule);
  root.addEventListener?.("dashboardmodern:runtime-ready", schedule);
  root.addEventListener?.("dashboardmodern:legacy-ready", schedule);
  doc.addEventListener("click", (event) => {
    if (event.target?.closest?.("[data-energy-tab],.energy-tab,.sub-tab-btn")) schedule();
  }, true);
  schedule();
}

if (doc?.readyState === "loading") doc.addEventListener("DOMContentLoaded", installEnergyFlowSection, { once: true });
else installEnergyFlowSection();
