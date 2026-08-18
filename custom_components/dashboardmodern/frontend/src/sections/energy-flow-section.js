import {
  flowPeriodEntity,
  flowRecorderEntity,
  flowStageModel,
} from "../core/energy-flow-topology.js";
import {
  allStates,
  clean,
  dashboardStore,
  doc,
  installStyle,
  readJson,
  root,
  section,
  wrapFunction,
  writeIconGlyph,
} from "./shared.js";

root.__DM_20260817A__ = true;
const KEY = "__DASHBOARDMODERN_ENERGY_FLOW_SECTION__";
const state = (root[KEY] ||= { installed: false, frame: 0 });

const COLORS = Object.freeze({
  solar: "#ff9f0a",
  grid: "#2563eb",
  battery: "#14b8a6",
  home: "#2563eb",
});

/* Beta 30 owns every load bubble below Home. The five hand-authored circles in
 * the legacy stage stay in the document — other owners still address them — but
 * they are hidden and replaced by one computed bubble per configured Load. */
const FLOW_VIEWS = Object.freeze([
  { period: "instant", id: "view-ist", suffix: "" },
  { period: "day", id: "view-day", suffix: "-day" },
  { period: "month", id: "view-month", suffix: "-month" },
]);

const LEGACY_LOAD_SELECTOR = ".node.n-load,[id^='line-home-'],[id^='m-line-home-']";
const SVG_NS = "http://www.w3.org/2000/svg";

function stateNumber(states, entity) {
  const value = states?.[entity]?.state ?? states?.[entity];
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function renderBatterySoc(targetDocument, energy = {}, states = {}) {
  const node = targetDocument?.getElementById?.("v-battery-soc");
  if (!node) return "—";
  const entity = clean(
    energy?.battery?.soc ||
      energy?.battery?.battery_soc_entity ||
      energy?.battery?.battery_soc,
  );
  const value = stateNumber(states, entity);
  const text = entity && value !== null ? `${Math.round(value)}%` : "—";
  node.textContent = text;
  node.dataset.entity = entity;
  return text;
}

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
  if (
    style &&
    (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0)
  )
    return false;
  return true;
}

/* Saved per-slot flow-node customization (Beta 26/27). Only the values the user
 * actually stored are read: the normalized editor model would otherwise hand
 * back legacy defaults and rename the canonical Load. */
function flowNodeOverrides() {
  const raw = readJson("cd_flow_nodes", null);
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : null;
}

/* The hosted dashboard can render before the store exists; the legacy mirror in
 * localStorage is the same document. */
function configuredLoads() {
  const value = section("loads", null);
  if (Array.isArray(value)) return value;
  const stored = readJson("cd_loads", []);
  return Array.isArray(stored) ? stored : [];
}

/* The Recorder bundle is keyed by the meter entity, not by load id. Resolve it
 * once here so the pure model keeps taking a plain id -> value map. Day and
 * month are both available: a load metered only by its lifetime counter gets a
 * real figure for today, not just for the month. */
function recorderValuesFor(loads, period) {
  const bundle = period === "day" ? state.bundle?.deviceDay : state.bundle?.deviceMonth;
  const devices = bundle?.devices || [];
  const values = bundle?.values;
  if (!values?.get || !devices.length) return null;
  const resolved = {};
  for (const load of loads) {
    const device = devices.find(
      (item) =>
        clean(item.id) === clean(load.id) ||
        clean(item.key) === clean(load.id) ||
        clean(item.name) === clean(load.name),
    );
    const source =
      clean(device?.history || device?.entity) ||
      flowRecorderEntity(load) ||
      flowPeriodEntity(load, period);
    const value = Number(values.get(source));
    if (Number.isFinite(value)) resolved[clean(load.id) || clean(load.name)] = value;
  }
  return Object.keys(resolved).length ? resolved : null;
}

function configuredAppliances() {
  const value = section("appliances", null);
  if (Array.isArray(value)) return value;
  const stored = readJson("cd_appliances", []);
  return Array.isArray(stored) ? stored : [];
}

function stageModel(period) {
  const loads = configuredLoads();
  return flowStageModel({
    loads,
    appliances: configuredAppliances(),
    flowNodes: flowNodeOverrides(),
    states: allStates(),
    period,
    recorderValues: period === "instant" ? null : recorderValuesFor(loads, period),
    locale: doc?.documentElement?.lang === "en" ? "en-GB" : "it-IT",
  });
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
  ])
    delete node.dataset[key];
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
  node.dataset.dmFlowAnimated = active ? "true" : "false";
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

/* Escaping an id for a CSS attribute selector: ids come from persisted config
 * and are not guaranteed to be identifier-safe. */
const cssEscape = (value) => String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"');

function hideLegacyLoadTopology(stage) {
  stage?.querySelectorAll?.(LEGACY_LOAD_SELECTOR).forEach((node) => {
    if (node.dataset.dmFlowNode || node.dataset.dmFlowArc) return;
    node.hidden = true;
    node.style.setProperty("display", "none", "important");
    node.dataset.dmLegacyEnergyLoad = "replaced";
  });
}

function writeIcon(target, icon) {
  if (!target || target.dataset.dmFlowIcon === icon) return;
  target.dataset.dmFlowIcon = icon;
  writeIconGlyph(target, icon, { size: 28, kind: "load" });
}

function bindNodeClick(element, node, period) {
  const click = node.click;
  const signature = click ? `${click.kind}:${click.target || click.entity}` : "";
  if (element.dataset.dmFlowClick === signature) return;
  element.dataset.dmFlowClick = signature;
  element.classList.toggle("hist-clickable", Boolean(click));
  element.onclick = click
    ? (event) => {
        if (click.kind === "subloads") root.apriSubLoads?.(click.target);
        else root.apriStorico?.(event, click.entity, click.title);
      }
    : null;
  if (click) element.dataset.dmFlowClickPeriod = period;
}

function ensureBubble(stage, node, period, scale) {
  let element = stage.querySelector(`[data-dm-flow-node="${cssEscape(node.id)}"]`);
  if (!element) {
    element = doc.createElement("div");
    element.className = "node n-load dm-flow-node";
    element.dataset.dmFlowNode = node.id;
    for (const [tag, className] of [
      ["div", "node-label"],
      ["div", "node-icon"],
      ["span", "dm-flow-value"],
    ]) {
      const child = doc.createElement(tag);
      child.className = className;
      element.append(child);
    }
    stage.append(element);
  }
  element.style.left = `${node.desktop.left}%`;
  element.style.top = `${node.desktop.top}%`;
  element.style.setProperty("--n-color", node.color);
  element.style.setProperty("--dm-flow-color", node.color);
  element.style.setProperty("--dm-flow-scale", String(scale));
  element.style.setProperty("--dm-flow-mobile-left", `${node.mobile.left}%`);
  element.style.setProperty("--dm-flow-mobile-top", `${node.mobile.top}%`);
  const label = element.querySelector(".node-label");
  if (label && label.textContent !== node.name) label.textContent = node.name;
  writeIcon(element.querySelector(".node-icon"), node.icon);
  const value = element.querySelector(".dm-flow-value");
  if (value && value.textContent !== node.text) value.textContent = node.text;
  element.dataset.dmCanonicalLoad = node.id;
  element.dataset.dmFlowPeriod = period;
  element.dataset.dmFlowActive = node.active ? "true" : "false";
  bindNodeClick(element, node, period);
  return element;
}

function ensureArc(svg, node, variant) {
  if (!svg) return null;
  let path = svg.querySelector(`[data-dm-flow-arc="${cssEscape(node.id)}"]`);
  if (!path) {
    path = doc.createElementNS(SVG_NS, "path");
    path.dataset.dmFlowArc = node.id;
    path.classList.add("flow-line", "dm-flow-arc");
    svg.append(path);
  }
  const geometry = variant === "mobile" ? node.mobile : node.desktop;
  if (path.getAttribute("d") !== geometry.path) path.setAttribute("d", geometry.path);
  path.style.setProperty("--line-color", node.color);
  path.style.setProperty("--dm-flow-width", `${node.intensity.width}px`);
  path.style.setProperty("--dm-flow-duration", `${node.intensity.duration}s`);
  path.dataset.dmFlowValue = String(node.value ?? "");
  colorNode(path, node.color, node.active);
  return path;
}

function pruneStale(stage, keep) {
  stage.querySelectorAll("[data-dm-flow-node],[data-dm-flow-arc]").forEach((node) => {
    const id = node.dataset.dmFlowNode || node.dataset.dmFlowArc;
    if (!keep.has(id)) node.remove();
  });
}

/* Recovered from the Beta 22 dynamic renderer and adapted: it now replaces the
 * fixed topology instead of doubling it, covers the month view as well, and
 * draws its connectors in both the desktop and the mobile viewBox. */
export function renderDynamicFlowLoads(period, model = stageModel(period)) {
  const view = FLOW_VIEWS.find((entry) => entry.period === period);
  const scope = view ? doc?.getElementById(view.id) : null;
  const stage = scope?.querySelector?.(".flow-stage");
  if (!stage) return 0;
  hideLegacyLoadTopology(stage);
  const desktopSvg = stage.querySelector("svg.desktop-svg") || stage.querySelector("svg");
  const mobileSvg = stage.querySelector("svg.mobile-svg");
  const keep = new Set();
  for (const node of model.nodes) {
    keep.add(node.id);
    ensureBubble(stage, node, period, model.scale);
    ensureArc(desktopSvg, node, "desktop");
    ensureArc(mobileSvg, node, "mobile");
  }
  pruneStale(stage, keep);
  stage.dataset.dmFlowLoads = String(model.count);
  // Beta 5's secondary-flow completer stands down on a stage that already has a
  // canonical owner; keep publishing the count it looks for.
  scope.dataset.dmCanonicalLoadCount = String(model.count);
  scope.dataset.dmFlowOwner = "beta30";
  return model.count;
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
  if (node?.dataset?.dmFlowArc) return true;
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
  const parts = [...(node.querySelectorAll?.("span") || [])].filter(nodeVisible);
  const index = direction === "import" || direction === "charge" ? 0 : 1;
  const part = parts[index];
  return part ? numberFrom(part) : null;
}

function directionalEndpointValue(kind, node, period) {
  const valueNode = mainValueNode(kind, period);
  if (!valueNode || !nodeVisible(valueNode)) return null;
  const id = String(node?.id || "").toLowerCase();

  if (kind === "grid") {
    if (period)
      return periodDirectionalValue(valueNode, id.includes("solar-grid") ? "export" : "import");
    const signed = parseNumber(valueNode);
    return id.includes("solar-grid") ? Math.max(0, -signed) : Math.max(0, signed);
  }

  if (kind === "battery") {
    if (period)
      return periodDirectionalValue(
        valueNode,
        id.includes("solar-battery") ? "charge" : "discharge",
      );
    const signed = parseNumber(valueNode);
    return id.includes("solar-battery") ? Math.max(0, -signed) : Math.max(0, signed);
  }

  return numberFrom(valueNode);
}

function directionalMainFlowValue(node, period) {
  const id = String(node?.id || "").toLowerCase();
  if (id.includes("solar-grid")) return directionalEndpointValue("grid", node, period);
  if (id.includes("solar-battery")) return directionalEndpointValue("battery", node, period);
  if (id.includes("grid-home")) return directionalEndpointValue("grid", node, period);
  if (id.includes("battery-home")) return directionalEndpointValue("battery", node, period);
  if (id.includes("solar-home")) return directionalEndpointValue("solar", node, period);

  const kinds = mainKinds(node);
  for (const kind of kinds) {
    if (kind === "home") continue;
    const value = directionalEndpointValue(kind, node, period);
    if (value !== null) return value;
  }
  return kinds.includes("home") ? directionalEndpointValue("home", node, period) : null;
}

function displayedMainFlow(node, period) {
  const threshold = period ? 0.0005 : 0.5;
  const value = directionalMainFlowValue(node, period);
  return value === null ? null : value > threshold;
}

function mirrorLegacyMainFlows(scope, period) {
  if (!scope) return false;
  let touched = false;
  scope
    .querySelectorAll(".flow-line,path[id*='line-' i],line[id*='line-' i],polyline[id*='line-' i]")
    .forEach((node) => {
      if (!/^(path|line|polyline)$/i.test(node.tagName) || isLoadLine(node)) return;
      const legacyActive = node.classList.contains("active");
      const displayedActive = displayedMainFlow(node, period);
      const active = displayedActive === null ? legacyActive : displayedActive;
      colorNode(node, mainLineColor(node), active);
      const kinds = mainKinds(node);
      node.dataset.dmMainFlow = kinds.join("-");
      node.dataset.dmFlowPeriod = period || "instant";
      const value = directionalMainFlowValue(node, period);
      if (value !== null) node.dataset.dmFlowValue = String(value);
      touched = true;
    });
  return touched;
}

export function refreshEnergyFlows() {
  if (!doc) return false;
  let touched = false;
  for (const view of FLOW_VIEWS) {
    const period = view.period === "instant" ? "" : view.period;
    const scope = scopeFor(period);
    if (!scope) continue;
    touched = mirrorLegacyMainFlows(scope, period) || touched;
    touched = renderDynamicFlowLoads(view.period) > 0 || touched;
    scope.dataset.dmEnergyFlows = "directional-value-bound";
  }
  renderBatterySoc(doc, section("energy", {}), allStates());
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

/* Adding, renaming or removing a Load must redraw the stage immediately: the
 * topology itself changed, not just a reading. */
function bindStore() {
  if (state.storeBound) return;
  const store = dashboardStore();
  if (!store?.subscribe) return;
  state.storeBound = true;
  store.subscribe((change) => {
    if (["loads", "energy"].includes(change?.section)) scheduleSettled();
  });
}

function installStyles() {
  installStyle(
    "dm-energy-flow-section-style",
    `
    .dm-energy-flow-active{display:inline!important;visibility:visible!important;opacity:1!important;filter:drop-shadow(0 0 6px color-mix(in srgb,var(--dm-flow-color) 52%,transparent))!important;transition:stroke .18s ease,fill .18s ease,opacity .18s ease!important}
    .dm-energy-flow-idle{opacity:.30!important;filter:none!important;transition:stroke .18s ease,fill .18s ease,opacity .18s ease!important}
    .flow-line.dm-energy-flow-active,path.dm-energy-flow-active,line.dm-energy-flow-active,polyline.dm-energy-flow-active{stroke:var(--dm-flow-color)!important;stroke-dasharray:12 9!important;stroke-linecap:round!important;animation-name:dmEnergyFlowDash!important;animation-duration:.8s!important;animation-timing-function:linear!important;animation-iteration-count:infinite!important;animation-play-state:running!important;will-change:stroke-dashoffset!important}
    @keyframes dmEnergyFlowDash{from{stroke-dashoffset:0}to{stroke-dashoffset:-42}}
    @media(prefers-reduced-motion:reduce){.flow-line.dm-energy-flow-active,path.dm-energy-flow-active,line.dm-energy-flow-active,polyline.dm-energy-flow-active{animation:none!important}}
    /* An mdi icon resolved by the engine sits inside .node-icon, which already
       sizes the emoji of the hand-authored circles at every breakpoint: the
       glyph inherits it so a configured circle matches its neighbours. */
    .dm-flow-node .node-icon .dm-icon-engine-glyph{font-size:inherit!important;height:auto!important}
    /* Computed load bubbles. Width and speed of a connector follow the reading,
       so a wallbox at 7 kW is visibly heavier than a fridge at 60 W. */
    .flow-stage .node.dm-flow-node{display:flex!important;visibility:visible!important;transform:translate(-50%,-50%) scale(var(--dm-flow-scale,1))!important;transition:left .28s ease,top .28s ease,transform .28s ease!important}
    .flow-stage .node.dm-flow-node[data-dm-flow-active="false"]{opacity:.62!important}
    .flow-stage path.dm-flow-arc{stroke-width:var(--dm-flow-width,3px)!important;fill:none!important}
    .flow-stage path.dm-flow-arc.dm-energy-flow-active{animation-duration:var(--dm-flow-duration,.8s)!important}
    @media(max-width:820px){
      .flow-stage .node.dm-flow-node{left:var(--dm-flow-mobile-left,50%)!important;top:var(--dm-flow-mobile-top,83%)!important}
    }
  `,
  );
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
  ])
    wrapFunction(name, `__dmEnergyFlow_${name}`, scheduleSettled);
  root.addEventListener?.("dashboardmodern:period-bundle", (event) => {
    state.bundle = event?.detail || null;
    scheduleSettled();
  });
  root.addEventListener?.("dashboardmodern:energy-bundle", scheduleSettled);
  root.addEventListener?.("dashboardmodern:energy-stable", scheduleSettled);
  root.addEventListener?.("dashboardmodern:states-ready", scheduleSettled);
  root.addEventListener?.("dashboardmodern:runtime-ready", scheduleSettled);
  root.addEventListener?.("dashboardmodern:legacy-ready", scheduleSettled);
  doc.addEventListener(
    "click",
    (event) => {
      if (event.target?.closest?.("[data-energy-tab],.energy-tab,.sub-tab-btn")) scheduleSettled();
    },
    true,
  );
  bindStore();
  scheduleSettled();
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installEnergyFlowSection, { once: true });
else installEnergyFlowSection();
