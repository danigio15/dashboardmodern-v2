import { doc, installStyle, root, wrapFunction } from "./shared.js";

const KEY = "__DASHBOARDMODERN_ENERGY_FLOW_SECTION__";
const state = (root[KEY] ||= { installed: false, frame: 0 });

const COLORS = Object.freeze({
  solar: "#ff9f0a",
  grid: "#2563eb",
  battery: "#14b8a6",
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

function parseNumber(node) {
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
  return Number.isFinite(value) ? value : 0;
}

function numberFrom(node) {
  return Math.abs(parseNumber(node));
}

function nodeVisible(node) {
  if (!node || node.hidden) return false;
  const style = root.getComputedStyle?.(node);
  if (style && (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0)) return false;
  return true;
}

function rememberConnectorVisibility(node) {
  if (!node || node.dataset.dmFlowVisibilityCaptured === "true") return;
  node.dataset.dmFlowVisibilityCaptured = "true";
  node.dataset.dmFlowWasHidden = node.hidden ? "true" : "false";
  node.dataset.dmFlowDisplay = node.style.getPropertyValue("display") || "";
  node.dataset.dmFlowDisplayPriority = node.style.getPropertyPriority("display") || "";
  node.dataset.dmFlowVisibility = node.style.getPropertyValue("visibility") || "";
  node.dataset.dmFlowVisibilityPriority = node.style.getPropertyPriority("visibility") || "";
}

function restoreConnectorVisibility(node) {
  if (!node || node.dataset.dmFlowVisibilityCaptured !== "true") return;
  node.hidden = node.dataset.dmFlowWasHidden === "true";
  const display = node.dataset.dmFlowDisplay || "";
  const displayPriority = node.dataset.dmFlowDisplayPriority || "";
  const visibility = node.dataset.dmFlowVisibility || "";
  const visibilityPriority = node.dataset.dmFlowVisibilityPriority || "";
  if (display) node.style.setProperty("display", display, displayPriority);
  else node.style.removeProperty("display");
  if (visibility) node.style.setProperty("visibility", visibility, visibilityPriority);
  else node.style.removeProperty("visibility");
  for (const key of [
    "dmFlowVisibilityCaptured",
    "dmFlowWasHidden",
    "dmFlowDisplay",
    "dmFlowDisplayPriority",
    "dmFlowVisibility",
    "dmFlowVisibilityPriority",
  ]) delete node.dataset[key];
}

function exposeConnector(node, active) {
  if (!node) return;
  if (active) {
    if (node.dataset.dmFlowForcedVisible !== "true") rememberConnectorVisibility(node);
    node.hidden = false;
    node.style.setProperty("display", "inline", "important");
    node.style.setProperty("visibility", "visible", "important");
    node.dataset.dmFlowForcedVisible = "true";
  } else if (node.dataset.dmFlowForcedVisible === "true") {
    restoreConnectorVisibility(node);
    node.dataset.dmFlowForcedVisible = "false";
  }
}

function colorNode(node, color, active) {
  if (!node) return;
  exposeConnector(node, active);
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
      colorNode(line, COLORS[load.key], active);
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

function mainValueNode(kind, period) {
  const suffix = period ? `-${period}` : "";
  return doc?.getElementById(`v-${kind}${suffix}`) || null;
}

function mainKinds(node) {
  const id = String(node?.id || "").toLowerCase();
  return ["solar", "grid", "battery", "home"].filter((kind) => id.includes(kind));
}

function periodDirectionalValue(node, direction) {
  if (!nodeVisible(node)) return null;
  const parts = [...node.querySelectorAll?.("span") || []].filter(nodeVisible);
  const index = direction === "import" || direction === "charge" ? 0 : 1;
  const part = parts[index];
  return part ? numberFrom(part) : null;
}

function directionalEndpointValue(kind, node, period) {
  const valueNode = mainValueNode(kind, period);
  if (!valueNode || !nodeVisible(valueNode)) return null;
  const id = String(node?.id || "").toLowerCase();

  if (kind === "grid") {
    if (period) return periodDirectionalValue(valueNode, id.includes("solar-grid") ? "export" : "import");
    const signed = parseNumber(valueNode);
    return id.includes("solar-grid") ? Math.max(0, -signed) : Math.max(0, signed);
  }

  if (kind === "battery") {
    if (period) return periodDirectionalValue(valueNode, id.includes("solar-battery") ? "charge" : "discharge");
    const signed = parseNumber(valueNode);
    return id.includes("solar-battery") ? Math.max(0, -signed) : Math.max(0, signed);
  }

  return numberFrom(valueNode);
}

function displayedMainFlow(node, period) {
  const kinds = mainKinds(node);
  if (kinds.length < 2) return null;
  const threshold = period ? 0.0005 : 0.5;
  const values = kinds.map((kind) => directionalEndpointValue(kind, node, period));
  if (values.some((value) => value === null)) return null;
  return values.every((value) => value > threshold);
}

function mirrorLegacyMainFlows(scope, period) {
  if (!scope) return;
  scope
    .querySelectorAll(".flow-line,path[id*='line-' i],line[id*='line-' i],polyline[id*='line-' i]")
    .forEach((node) => {
      if (!/^(path|line|polyline)$/i.test(node.tagName) || isLoadLine(node)) return;
      // Visibility is an output of the flow renderer, not an input. Legacy
      // renderers often leave a valued connector at display:none; using
      // nodeVisible() here permanently prevented beta7 from reviving it.
      const legacyActive = node.classList.contains("active");
      const displayedActive = displayedMainFlow(node, period);
      const active = displayedActive === null ? legacyActive : displayedActive;
      colorNode(node, mainLineColor(node), active);
      const kinds = mainKinds(node);
      node.dataset.dmMainFlow = kinds.join("-");
      node.dataset.dmFlowPeriod = period || "instant";
    });
}

export function refreshEnergyFlows() {
  if (!doc) return false;
  let touched = false;
  for (const period of ["", "day", "month"]) {
    const scope = scopeFor(period);
    if (!scope) continue;
    mirrorLegacyMainFlows(scope, period);
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
    .dm-energy-flow-active{display:inline!important;visibility:visible!important;opacity:1!important;filter:drop-shadow(0 0 6px color-mix(in srgb,var(--dm-flow-color) 52%,transparent))!important;transition:stroke .18s ease,fill .18s ease,opacity .18s ease!important}
    .dm-energy-flow-idle{opacity:.30!important;filter:none!important;transition:stroke .18s ease,fill .18s ease,opacity .18s ease!important}
    .flow-line.dm-energy-flow-active,path.dm-energy-flow-active,line.dm-energy-flow-active,polyline.dm-energy-flow-active{stroke:var(--dm-flow-color)!important;stroke-dasharray:12 9!important;stroke-linecap:round!important;animation:dmEnergyFlowDash .8s linear infinite!important;will-change:stroke-dashoffset!important}
    @keyframes dmEnergyFlowDash{from{stroke-dashoffset:0}to{stroke-dashoffset:-42}}
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