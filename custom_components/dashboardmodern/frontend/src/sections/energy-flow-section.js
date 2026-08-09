import { doc, installStyle, root, wrapFunction } from "./shared.js";

const KEY = "__DASHBOARDMODERN_ENERGY_FLOW_SECTION__";
const state = (root[KEY] ||= { installed: false, frame: 0 });

const COLORS = Object.freeze({
  solar: "#f59e0b",
  grid: "#1e40af",
  battery: "#15803d",
  home: "#2563eb",
  boiler: "#ea580c",
  wb: "#06b6d4",
  clima: "#0ea5e9",
  lav: "#7c3aed",
  cuc: "#e11d48",
});

const LOADS = Object.freeze([
  { key: "boiler", instant: "v-boiler-p" },
  { key: "wb", instant: "v-wb-p" },
  { key: "clima", instant: "v-clima-p" },
  { key: "lav", instant: "v-lav-p" },
  { key: "cuc", instant: "v-cuc-p" },
]);

function numberFrom(node) {
  const source = String(node?.textContent || "").trim();
  const match = source.match(/-?\d[\d.,]*/);
  if (!match) return 0;
  let token = match[0];
  const comma = token.lastIndexOf(",");
  const dot = token.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    if (comma > dot) token = token.replaceAll(".", "").replace(",", ".");
    else token = token.replaceAll(",", "");
  } else if (comma >= 0) token = token.replace(",", ".");
  const value = Number(token);
  return Number.isFinite(value) ? Math.abs(value) : 0;
}

function nodeVisible(node) {
  if (!node || node.hidden) return false;
  const style = root.getComputedStyle?.(node);
  if (style && (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0)) return false;
  return true;
}

function colorNode(node, color, active) {
  if (!node) return;
  node.classList.toggle("active", active);
  node.classList.toggle("dm-energy-flow-active", active);
  node.classList.toggle("dm-energy-flow-idle", !active);
  node.style.setProperty("--dm-flow-color", color);
  if (/^(path|line|polyline|circle)$/i.test(node.tagName)) {
    node.style.stroke = active ? color : "var(--divider-color,#dbe4ee)";
    if (node.getAttribute("fill") && node.getAttribute("fill") !== "none")
      node.style.fill = active ? color : "var(--divider-color,#dbe4ee)";
  }
}

function scopeFor(period) {
  if (period === "day") return doc?.getElementById("view-day");
  if (period === "month") return doc?.getElementById("view-month");
  return doc?.getElementById("view-ist");
}

function loadValueId(load, period) {
  return period ? `v-${load.key}-${period}` : load.instant;
}

function loadLineIds(load, period) {
  const suffix = period ? `-${period}` : "";
  return [
    `line-home-${load.key}${suffix}`,
    `m-line-home-${load.key}${suffix}`,
  ];
}

function syncLoadFlows(period) {
  const scope = scopeFor(period);
  if (!scope) return false;
  let touched = false;
  for (const load of LOADS) {
    const valueNode = doc.getElementById(loadValueId(load, period));
    const threshold = period ? 0.0005 : 0.5;
    const active = nodeVisible(valueNode) && numberFrom(valueNode) > threshold;
    for (const id of loadLineIds(load, period)) {
      const line = doc.getElementById(id);
      if (!line) continue;
      colorNode(line, COLORS[load.key], active && nodeVisible(line));
      line.dataset.dmFlowValue = String(numberFrom(valueNode));
      touched = true;
    }
  }
  return touched;
}

function mainLineColor(node) {
  const id = String(node?.id || "").toLowerCase();
  if (id.includes("solar")) return COLORS.solar;
  if (id.includes("battery")) return COLORS.battery;
  if (id.includes("grid")) return COLORS.grid;
  if (id.includes("home")) return COLORS.home;
  return "var(--line-color,#64748b)";
}

function isLoadLine(node) {
  const id = String(node?.id || "");
  return /line-home-(?:boiler|wb|clima|lav|cuc)(?:-(?:day|month))?$/i.test(id);
}

function mirrorLegacyMainFlows(scope) {
  if (!scope) return;
  scope
    .querySelectorAll(".flow-line,path[id*='line-' i],line[id*='line-' i],polyline[id*='line-' i]")
    .forEach((node) => {
      if (!/^(path|line|polyline)$/i.test(node.tagName) || isLoadLine(node)) return;
      // The legacy energy engine owns directionality for grid/solar/battery.
      // Mirror its authoritative `.active` state instead of guessing from
      // visibility (the beta.1 implementation animated inactive orphan lines).
      const active = node.classList.contains("active") && nodeVisible(node);
      node.classList.toggle("dm-energy-flow-active", active);
      node.classList.toggle("dm-energy-flow-idle", !active);
      node.style.setProperty("--dm-flow-color", mainLineColor(node));
    });
}

export function refreshEnergyFlows() {
  if (!doc) return false;
  let touched = false;
  for (const period of ["", "day", "month"]) {
    const scope = scopeFor(period);
    if (!scope) continue;
    mirrorLegacyMainFlows(scope);
    touched = syncLoadFlows(period) || touched;
    scope.dataset.dmEnergyFlows = "value-bound";
  }
  return touched;
}

function schedule() {
  if (state.frame) return;
  const run = () => {
    state.frame = 0;
    refreshEnergyFlows();
  };
  state.frame = root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 0);
}

function scheduleSettled() {
  schedule();
  root.setTimeout?.(schedule, 80);
}

function installStyles() {
  installStyle("dm-energy-flow-section-style", `
    .dm-energy-flow-active{opacity:1!important;filter:drop-shadow(0 0 5px color-mix(in srgb,var(--dm-flow-color) 42%,transparent))!important;transition:stroke .2s ease,fill .2s ease,opacity .2s ease!important}
    .dm-energy-flow-idle{opacity:.3!important;filter:none!important;transition:stroke .2s ease,fill .2s ease,opacity .2s ease!important}
    .flow-line.dm-energy-flow-active,path.dm-energy-flow-active,line.dm-energy-flow-active,polyline.dm-energy-flow-active{stroke-dasharray:10 10!important;animation:dmEnergyFlowDash 1s linear infinite!important}
    @keyframes dmEnergyFlowDash{to{stroke-dashoffset:-40}}
    @media(prefers-reduced-motion:reduce){.flow-line.dm-energy-flow-active,path.dm-energy-flow-active,line.dm-energy-flow-active,polyline.dm-energy-flow-active{animation:none!important}}
  `);
}

export function installEnergyFlowSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  root.dmRefreshEnergyFlows = refreshEnergyFlows;
  for (const name of [
    "renderEnergyMonth",
    "renderEnergyDay",
    "renderEnergyDashboard",
    "applyAtomicEnergyBundle",
    "switchEnergyView",
    "render",
  ]) wrapFunction(name, `__dmEnergyFlow_${name}`, scheduleSettled);
  root.addEventListener?.("dashboardmodern:period-bundle", scheduleSettled);
  root.addEventListener?.("dashboardmodern:energy-bundle", scheduleSettled);
  root.addEventListener?.("dashboardmodern:energy-stable", scheduleSettled);
  root.addEventListener?.("dashboardmodern:states-ready", scheduleSettled);
  root.addEventListener?.("dashboardmodern:runtime-ready", scheduleSettled);
  root.addEventListener?.("dashboardmodern:legacy-ready", scheduleSettled);
  doc.addEventListener("click", (event) => {
    if (event.target?.closest?.("[data-energy-tab],.energy-tab,.sub-tab-btn")) scheduleSettled();
  }, true);
  scheduleSettled();
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installEnergyFlowSection, { once: true });
else installEnergyFlowSection();
