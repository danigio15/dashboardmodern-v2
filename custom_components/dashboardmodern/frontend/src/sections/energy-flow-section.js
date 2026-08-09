import { doc, installStyle, root, wrapFunction } from "./shared.js";

const KEY = "__DASHBOARDMODERN_ENERGY_FLOW_SECTION__";
const state = (root[KEY] ||= { installed: false, frame: 0 });

const COLORS = Object.freeze({
  solar: "#ff9f0a",
  grid: "#2563eb",
  battery: "#14b8a6",
  home: "#8b5cf6",
  load: "#e11d48",
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
  const words = key === "grid"
    ? ["grid", "rete"]
    : key === "solar"
      ? ["solar", "solare", "pv"]
      : key === "battery"
        ? ["battery", "batteria"]
        : key === "load"
          ? ["load", "carico", "clima", "lavander", "cucina", "boiler"]
          : ["home", "house", "casa"];
  const selector = words.flatMap((word) => [
    `[id*="${word}" i]`,
    `[class*="${word}" i]`,
    `[data-flow*="${word}" i]`,
    `[data-source*="${word}" i]`,
    `[data-target*="${word}" i]`,
  ]).join(",");
  return [...scope.querySelectorAll(selector)].filter((node) => /^(path|line|polyline|circle|g|div|span)$/i.test(node.tagName));
}

function nodeVisible(node) {
  if (!node || node.hidden) return false;
  const style = root.getComputedStyle?.(node);
  if (style && (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0)) return false;
  return true;
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

function genericFlowLines(scope) {
  return [...scope.querySelectorAll(".flow-line,path[id*='line-' i],line[id*='line-' i],polyline[id*='line-' i],[data-flow-line]")]
    .filter((node) => /^(path|line|polyline)$/i.test(node.tagName));
}

function colorForLine(node) {
  const token = `${node.id || ""} ${node.className?.baseVal || node.className || ""} ${node.dataset?.source || ""} ${node.dataset?.target || ""}`.toLowerCase();
  if (/solar|solare|pv/.test(token)) return COLORS.solar;
  if (/battery|batteria/.test(token)) return COLORS.battery;
  if (/grid|rete/.test(token)) return COLORS.grid;
  if (/home|house|casa/.test(token) && !/load|carico|clima|lavander|cucina|boiler/.test(token)) return COLORS.home;
  return COLORS.load;
}

export function refreshEnergyFlows() {
  if (!doc) return false;
  const scopes = [
    doc.getElementById("view-day"),
    doc.getElementById("view-month"),
    doc.getElementById("view-ist"),
    doc.getElementById("page-energy-day"),
    doc.getElementById("page-energy-month"),
    doc.getElementById("dp-day"),
    doc.getElementById("dp-month"),
    ...doc.querySelectorAll(".energy-flow,.energy-diagram,[data-energy-flow],.flow-diagram,.flow-view"),
  ].filter((node, index, values) => node && values.indexOf(node) === index);
  if (!scopes.length) return false;

  for (const scope of scopes) {
    const period = /day|giorn/i.test(`${scope.id} ${scope.className}`) ? "day" : "month";
    for (const key of ["solar", "grid", "battery", "home"]) {
      const active = periodActive(period, key);
      candidates(scope, key).forEach((node) => colorNode(node, COLORS[key], active && nodeVisible(node)));
    }

    // Legacy and custom load paths do not all carry a stable source class. Any
    // visible path left on the diagram represents an active rendered flow and
    // must animate instead of becoming a static orphan line.
    genericFlowLines(scope).forEach((node) => {
      if (node.classList.contains("dm-energy-flow-active")) return;
      const active = nodeVisible(node);
      colorNode(node, colorForLine(node), active);
    });
    candidates(scope, "load").forEach((node) => {
      if (/^(path|line|polyline)$/i.test(node.tagName)) colorNode(node, colorForLine(node), nodeVisible(node));
    });
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
    .flow-line.dm-energy-flow-active,path.dm-energy-flow-active,line.dm-energy-flow-active,polyline.dm-energy-flow-active{stroke-dasharray:10 12!important;animation:dmEnergyFlowDash 1.45s linear infinite!important}
    @keyframes dmEnergyFlowDash{to{stroke-dashoffset:-44}}
    @media(prefers-reduced-motion:reduce){.flow-line.dm-energy-flow-active,path.dm-energy-flow-active,line.dm-energy-flow-active,polyline.dm-energy-flow-active{animation:none!important}}
  `);
}

export function installEnergyFlowSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  for (const name of ["renderEnergyMonth", "renderEnergyDay", "renderEnergyDashboard", "applyAtomicEnergyBundle"]) wrapFunction(name, `__dmEnergyFlow_${name}`, schedule);
  root.addEventListener?.("dashboardmodern:period-bundle", schedule);
  root.addEventListener?.("dashboardmodern:energy-bundle", schedule);
  root.addEventListener?.("dashboardmodern:energy-stable", schedule);
  root.addEventListener?.("dashboardmodern:runtime-ready", schedule);
  root.addEventListener?.("dashboardmodern:legacy-ready", schedule);
  doc.addEventListener("click", (event) => {
    if (event.target?.closest?.("[data-energy-tab],.energy-tab,.sub-tab-btn")) schedule();
  }, true);
  schedule();
}

if (doc?.readyState === "loading") doc.addEventListener("DOMContentLoaded", installEnergyFlowSection, { once: true });
else installEnergyFlowSection();
