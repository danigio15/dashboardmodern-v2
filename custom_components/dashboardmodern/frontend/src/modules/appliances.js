import { el, emptyState } from "../render/dom.js";
import { renderWidgetLayout } from "../widgets/runtime.js";
import { normalizeMeasurement, ENTITY_RE, formatNumber, evaluateTimestamp } from "./shared-measurements.js";
import { openSharedDetailPanel } from "./detail-panel-controller.js";
import { createActionState } from "./action-state.js";

export const APPLIANCE_WIDGET_TYPES = ["appliance-tile", "appliance-group", "appliances-overview", "appliance-usage", "appliance-control-panel"];
export const CATEGORIES = ["washer", "dryer", "dishwasher", "oven", "cooktop", "refrigerator", "freezer", "water heater", "pump", "vacuum", "dehumidifier", "fan", "generic"];
const STATUS_KEYS = ["active", "idle", "paused", "completed", "error", "unavailable"];
const TOGGLE_DOMAINS = new Set(["switch", "input_boolean", "light", "fan"]);
const list = (v) => Array.isArray(v) ? v.map(String) : [];
const has = (v, values = []) => list(values).includes(String(v));
const txt = (v) => String(v ?? "").trim();
const article = (w, cls) => { const n = el("article", { className: `dm-widget ${cls}` }); n.append(el("h3", { text: w.title || w.config?.title || w.type })); return n; };
const configuredAppliances = (w) => (w.config?.appliances || (w.config?.appliance ? [w.config.appliance] : [])).filter((a) => a.enabled !== false);

export function applianceStatus(state, mappings = {}) {
  if (state === undefined || state === null) return "missing";
  const value = txt(state);
  if (["unknown", "unavailable", ""].includes(value)) return "unavailable";
  if (has(value, mappings.errorStates)) return "error";
  if (has(value, mappings.pausedStates)) return "paused";
  if (has(value, mappings.completedStates)) return "completed";
  if (has(value, mappings.activeStates)) return "active";
  if (has(value, mappings.idleStates) || value === "off") return "idle";
  return "malformed";
}

export function normalizeRemainingTime(runtime = {}, entityId, { unit, precision = 0, staleAfterMs, now = Date.now(), futureToleranceMs = 5000 } = {}) {
  const entity = ENTITY_RE.test(entityId || "") ? runtime.getEntityState?.(entityId) : null;
  const sourceUnit = entity?.attributes?.unit_of_measurement || unit || "";
  const base = { entityId, rawValue: entity?.state, sourceUnit, normalizedUnit: unit || sourceUnit, unit: unit || sourceUnit, precision, lastUpdated: entity?.last_updated || entity?.lastUpdated || null, available: false, missing: false, unavailable: false, malformed: false, stale: false, reason: "not-evaluated", normalizedValue: null, displayValue: "Unavailable" };
  if (!entityId) return { ...base, missing: true, reason: "missing-entity-id" };
  if (!ENTITY_RE.test(entityId)) return { ...base, malformed: true, reason: "invalid-entity-id" };
  if (!entity) return { ...base, missing: true, reason: "entity-missing" };
  const rawText = txt(entity.state);
  if (["unknown", "unavailable", ""].includes(rawText)) return { ...base, unavailable: true, reason: rawText || "empty" };
  const numeric = Number(rawText);
  if (Number.isFinite(numeric)) {
    const m = normalizeMeasurement(runtime, entityId, { kind: "duration", unit: base.normalizedUnit, precision, staleAfterMs, futureToleranceMs, now, locale: runtime.locale });
    return { ...base, available: m.available, missing: m.missing, unavailable: m.unavailable, malformed: m.malformed, stale: m.stale, reason: m.reason, normalizedValue: m.normalizedValue, sourceUnit: m.sourceUnit, normalizedUnit: m.normalizedUnit, unit: m.normalizedUnit || base.unit, lastUpdated: m.lastUpdated, displayValue: m.displayValue };
  }
  const timestamp = evaluateTimestamp(base.lastUpdated, staleAfterMs, now, futureToleranceMs);
  if (timestamp.invalid || timestamp.future) return { ...base, malformed: true, reason: timestamp.reason };
  const validText = /^\d{1,2}:\d{2}(:\d{2})?$/.test(rawText) || /^\d+h(\s+\d+m)?$/i.test(rawText) || /^\d+m$/i.test(rawText);
  if (!validText) return { ...base, malformed: true, reason: "malformed-duration" };
  return { ...base, available: !timestamp.stale, stale: timestamp.stale, reason: timestamp.stale ? timestamp.reason : "text-duration", displayValue: rawText };
}

export function normalizeAppliance(runtime = {}, appliance = {}) {
  let primaryEntityProblem = null;
  if (!appliance.entityId) primaryEntityProblem = "missing-primary-entity-id";
  else if (!ENTITY_RE.test(appliance.entityId)) primaryEntityProblem = "invalid-primary-entity-id";
  const primary = !primaryEntityProblem ? runtime.getEntityState?.(appliance.entityId) : null;
  if (appliance.entityId && !primaryEntityProblem && !primary) primaryEntityProblem = "primary-entity-missing";
  let raw = primary?.state;
  let statusEntityState = null;
  let statusEntityProblem = null;
  if (appliance.statusEntityId) {
    if (!ENTITY_RE.test(appliance.statusEntityId)) statusEntityProblem = "invalid-status-entity-id";
    else {
      statusEntityState = runtime.getEntityState?.(appliance.statusEntityId) || null;
      if (!statusEntityState) statusEntityProblem = "status-entity-missing";
      else raw = statusEntityState.state;
    }
  }
  let status = primaryEntityProblem === "invalid-primary-entity-id" ? "malformed" : primaryEntityProblem ? "missing" : applianceStatus(raw, appliance.statusMappings || appliance);
  if (statusEntityProblem) status = "malformed";
  const power = appliance.powerEntityId ? normalizeMeasurement(runtime, appliance.powerEntityId, { kind: "power", unit: appliance.powerUnit || "W", precision: appliance.precision ?? 0, staleAfterMs: appliance.staleAfterMs, futureToleranceMs: appliance.futureToleranceMs, locale: runtime.locale }) : null;
  const energy = appliance.energyEntityId ? normalizeMeasurement(runtime, appliance.energyEntityId, { kind: "energy", unit: appliance.energyUnit || "kWh", precision: appliance.precision ?? 1, staleAfterMs: appliance.staleAfterMs, futureToleranceMs: appliance.futureToleranceMs, locale: runtime.locale }) : null;
  const progress = appliance.progressEntityId ? normalizeMeasurement(runtime, appliance.progressEntityId, { kind: "percent", precision: 0, staleAfterMs: appliance.staleAfterMs, futureToleranceMs: appliance.futureToleranceMs, locale: runtime.locale }) : null;
  const remainingTime = appliance.remainingTimeEntityId ? normalizeRemainingTime(runtime, appliance.remainingTimeEntityId, { unit: appliance.remainingTimeUnit, staleAfterMs: appliance.staleAfterMs, futureToleranceMs: appliance.futureToleranceMs }) : null;
  return {
    id: appliance.id, title: appliance.title || appliance.entityId || "Appliance", icon: appliance.icon || "", category: appliance.category || "generic", primaryEntityState: primary?.state, primaryState: raw, primaryEntityProblem, statusEntityProblem,
    normalizedStatus: status, available: !["missing", "unavailable", "malformed"].includes(status), active: status === "active", idle: status === "idle", paused: status === "paused", completed: status === "completed", error: status === "error", hasError: status === "error", missing: status === "missing", unavailable: status === "unavailable", malformed: status === "malformed",
    on: list(appliance.onStates).includes(String(raw)) || status === "active", currentPower: power, accumulatedEnergy: energy, progressPercent: progress, remainingTime, room: appliance.room || "", tags: list(appliance.tags), enabled: appliance.enabled !== false, displayFields: list(appliance.displayFields),
    actions: [appliance.primaryAction, appliance.secondaryAction, appliance.startAction, appliance.stopAction, appliance.pauseAction].filter(Boolean), primaryAction: appliance.primaryAction, secondaryAction: appliance.secondaryAction, switchEntityId: appliance.switchEntityId, missingPolicy: appliance.missingPolicy || "show", unavailablePolicy: appliance.unavailablePolicy || "show"
  };
}

export function aggregateMeasurements(appliances, key, unit) {
  let value = 0, included = 0, excluded = 0, malformed = 0, unavailable = 0, missing = 0, stale = 0, mixedUnit = 0;
  for (const appliance of appliances) {
    const measurement = appliance[key];
    if (!measurement) { excluded++; missing++; continue; }
    if (measurement.available && Number.isFinite(measurement.normalizedValue) && (!unit || measurement.normalizedUnit === unit)) { value += measurement.normalizedValue; included++; continue; }
    excluded++; if (unit && measurement.normalizedUnit && measurement.normalizedUnit !== unit) mixedUnit++; else if (measurement.malformed) malformed++; if (measurement.missing) missing++; if (measurement.unavailable) unavailable++; if (measurement.stale) stale++;
  }
  return { value, included, excluded, missing, unavailable, malformed, stale, mixedUnit, complete: excluded === 0, partial: excluded > 0, unit, displayValue: included ? formatNumber(value, { unit, precision: unit === "W" ? 0 : 1 }) : "Unavailable" };
}

export function validateApplianceAction(action = {}) {
  const allowed = new Set(["toggle", "switch-on", "switch-off", "service", "script", "scene", "navigation", "detail"]);
  if (!allowed.has(action.type)) return { ok: false, reason: "unsupported-action" };
  if (action.visible === false) return { ok: false, reason: "hidden" };
  if (action.disabled) return { ok: false, reason: "disabled" };
  if (action.type === "toggle") {
    if (!ENTITY_RE.test(action.entityId || "")) return { ok: false, reason: "invalid-entity-id" };
    const [domain] = action.entityId.split(".");
    if (!TOGGLE_DOMAINS.has(domain)) return { ok: false, reason: "toggle-domain-not-approved" };
    if (action.domain && action.domain !== domain) return { ok: false, reason: "invalid-domain" };
    if (action.service && action.service !== "toggle") return { ok: false, reason: "invalid-service" };
  }
  if (["switch-on", "switch-off", "script", "scene"].includes(action.type) && !ENTITY_RE.test(action.entityId || "")) return { ok: false, reason: "invalid-entity-id" };
  if (["switch-on", "switch-off"].includes(action.type) && !String(action.entityId).startsWith("switch.")) return { ok: false, reason: "invalid-domain" };
  if (action.type === "service" && (!/^[a-z0-9_]+$/.test(action.domain || "") || !/^[a-z0-9_]+$/.test(action.service || ""))) return { ok: false, reason: "invalid-service" };
  if (action.target && typeof action.target !== "object") return { ok: false, reason: "invalid-target" };
  if (action.data && typeof action.data !== "object") return { ok: false, reason: "invalid-service-data" };
  if (action.type === "navigation") { const targets = [action.sectionId, action.viewId].filter(Boolean); if (targets.length !== 1) return { ok: false, reason: "navigation-target-required" }; }
  return { ok: true };
}

export function dispatchApplianceAction(action = {}, runtime = {}, appliance = {}, trigger = null) {
  const valid = validateApplianceAction(action);
  if (!valid.ok) return Promise.reject(new Error(valid.reason));
  const requireCall = () => { if (typeof runtime.callService !== "function") throw new Error("runtime-call-service-unavailable"); };
  if (action.type === "detail") { if(!appliance || (!appliance.title && !appliance.entityId && !appliance.id)) return Promise.reject(new Error("detail-appliance-required")); openApplianceDetailPanel(appliance, runtime, trigger); return Promise.resolve(true); }
  if (action.type === "navigation") {
    if (action.sectionId) { if (typeof runtime.navigateToSection !== "function") return Promise.reject(new Error("runtime-navigation-unavailable")); return Promise.resolve(runtime.navigateToSection(action.sectionId)); }
    if (typeof runtime.navigateToView !== "function") return Promise.reject(new Error("runtime-navigation-unavailable")); return Promise.resolve(runtime.navigateToView(action.viewId));
  }
  try { requireCall(); } catch (error) { return Promise.reject(error); }
  if (action.type === "toggle") { const [domain] = String(action.entityId).split("."); return runtime.callService(action.domain || domain, action.service || "toggle", { entity_id: action.entityId }); }
  if (action.type === "switch-on") return runtime.callService("switch", "turn_on", { entity_id: action.entityId });
  if (action.type === "switch-off") return runtime.callService("switch", "turn_off", { entity_id: action.entityId });
  if (action.type === "service") return runtime.callService(action.domain, action.service, { ...(action.target || {}), ...(action.data || {}) });
  if (action.type === "script") return runtime.callService("script", "turn_on", { entity_id: action.entityId });
  if (action.type === "scene") return runtime.callService("scene", "turn_on", { entity_id: action.entityId });
  return Promise.reject(new Error("unsupported-action"));
}

function defaultActionLabel(action = {}) { return action.title || ({toggle:"Toggle","switch-on":"Turn on","switch-off":"Turn off",service:"Run service",script:"Run script",scene:"Run scene",navigation:"Navigate",detail:"Open detail"}[action.type] || "Action"); }
function actionButton(action, runtime, label = defaultActionLabel(action), appliance, host) {
  const b = el("button", { text: label, attrs: { type: "button", "aria-busy": "false", disabled: action.disabled ? "" : null } });
  b.dataset.structuralDisabled = String(Boolean(action.disabled));
  const state = createActionState(b, host, async () => { if (action.confirm && globalThis.confirm && !globalThis.confirm(action.confirmText || `Run ${label}?`)) return; await dispatchApplianceAction(action, runtime, appliance, b); }, { label, prefix: "appliance-action" });
  b.addEventListener("click", state.execute);
  return b;
}
const shouldShow = (appliance, field) => !appliance.displayFields.length || appliance.displayFields.includes(field);
const hiddenByPolicy = (a) => (a.missing && a.missingPolicy === "hide") || (a.unavailable && a.unavailablePolicy === "hide");
export function renderApplianceTile(w, runtime = {}) {
  const config = w.config || {}, source = config.appliance || configuredAppliances(w)[0] || {}, appliance = normalizeAppliance(runtime, source);
  if (hiddenByPolicy(appliance)) { const hidden = el("article", { className: "dm-widget dm-appliance-tile", attrs: { hidden: "", "data-status": appliance.normalizedStatus, "data-hidden-by-policy": appliance.normalizedStatus } }); return hidden; }
  const n = article(w, "dm-appliance-tile");
  n.dataset.status = appliance.normalizedStatus;
  n.append(el("p", { text: `${appliance.icon || appliance.category} ${appliance.title}: ${appliance.normalizedStatus}` }));
  if (shouldShow(appliance, "power")) n.append(el("p", { text: `Power: ${appliance.currentPower?.displayValue || "Unavailable"}` }));
  if (shouldShow(appliance, "energy")) n.append(el("p", { text: `Energy: ${appliance.accumulatedEnergy?.displayValue || "Unavailable"}` }));
  if (shouldShow(appliance, "progress") && appliance.progressPercent) n.append(el("p", { text: `Progress: ${appliance.progressPercent.displayValue}${appliance.progressPercent.reason ? ` · ${appliance.progressPercent.reason}` : ""}` }));
  if (shouldShow(appliance, "remainingTime") && appliance.remainingTime) n.append(el("p", { text: `Remaining: ${appliance.remainingTime.displayValue}` }));
  if (shouldShow(appliance, "labels")) n.append(el("p", { text: `Room ${appliance.room || "none"} · Tags ${appliance.tags.join(", ") || "none"}` }));
  if (appliance.primaryAction) n.append(actionButton(appliance.primaryAction, runtime, defaultActionLabel(appliance.primaryAction), source, n));
  if (appliance.secondaryAction) n.append(actionButton(appliance.secondaryAction, runtime, defaultActionLabel(appliance.secondaryAction), source, n));
  if (config.detailAction) n.append(actionButton({ type: "detail" }, runtime, "Open detail", source, n));
  return n;
}

export function renderApplianceGroup(w, runtime = {}) {
  const config = w.config || {}, members = configuredAppliances(w).filter((a) => !config.memberIds || config.memberIds.includes(a.id)).map((a) => ({ source: a, normalized: normalizeAppliance(runtime, a) })), normalized = members.map((m) => m.normalized), n = article(w, "dm-appliance-group");
  const counts = Object.fromEntries(STATUS_KEYS.map((key) => [key, normalized.filter((a) => a.normalizedStatus === key).length]));
  const power = aggregateMeasurements(normalized, "currentPower", config.powerUnit || "W"), energy = aggregateMeasurements(normalized, "accumulatedEnergy", config.energyUnit || "kWh");
  n.append(el("p", { text: `Total: ${normalized.length} · available: ${normalized.filter((a) => a.available).length} · unavailable: ${normalized.filter((a) => !a.available).length}` }), el("p", { text: `active ${counts.active} idle ${counts.idle} paused ${counts.paused} completed ${counts.completed} error ${counts.error} unavailable ${counts.unavailable}` }), el("p", { text: `Aggregate power: ${power.displayValue} · ${power.complete ? "complete" : `partial excluded ${power.excluded} missing ${power.missing} unavailable ${power.unavailable} malformed ${power.malformed} stale ${power.stale} mixed-unit ${power.mixedUnit}`}` }), el("p", { text: `Aggregate energy: ${energy.displayValue} · ${energy.complete ? "complete" : `partial excluded ${energy.excluded} missing ${energy.missing} unavailable ${energy.unavailable} malformed ${energy.malformed} stale ${energy.stale} mixed-unit ${energy.mixedUnit}`}` }));
  const compatible = members.filter(({ source, normalized: a }) => a.available && ENTITY_RE.test(source.switchEntityId || "") && source.switchEntityId.startsWith("switch."));
  n.append(actionButton({ type: "service", domain: "switch", service: "turn_off", target: { entity_id: compatible.map(({ source }) => source.switchEntityId) }, title: "Turn off compatible switches", disabled: compatible.length === 0, confirm: config.confirmBulk !== false }, runtime, "Turn off compatible switches", config, n));
  if (config.groupAction) n.append(actionButton(config.groupAction, runtime, defaultActionLabel(config.groupAction), config, n));
  return n;
}

function selectedValue(container, label, fallback) { return container.querySelectorAll?.("select").find((s) => s.attributes?.["aria-label"] === label)?.value || fallback || ""; }
export function filterAppliances(list, filters = {}) {
  let out = [...list];
  const search = txt(filters.search).toLowerCase();
  if (search) out = out.filter((a) => a.title.toLowerCase().includes(search));
  if (filters.room) out = out.filter((a) => a.room === filters.room);
  if (filters.tag) out = out.filter((a) => a.tags.includes(filters.tag));
  if (filters.category) out = out.filter((a) => a.category === filters.category);
  if (filters.status) out = out.filter((a) => a.normalizedStatus === filters.status);
  if (filters.activeOnly) out = out.filter((a) => a.active);
  if (!filters.showUnavailable) out = out.filter((a) => a.available);
  const by = filters.sort || "name";
  const value = (a) => by === "room" ? a.room : by === "category" ? a.category : by === "status" ? a.normalizedStatus : by === "currentPower" ? a.currentPower?.normalizedValue ?? -Infinity : by === "energy" ? a.accumulatedEnergy?.normalizedValue ?? -Infinity : a.title;
  out.sort((a, b) => typeof value(a) === "number" ? value(b) - value(a) : String(value(a)).localeCompare(String(value(b))));
  return out;
}

export function renderAppliancesOverview(w, runtime = {}) {
  const config = w.config || {}, all = configuredAppliances(w).map((a) => normalizeAppliance(runtime, a)), n = article(w, "dm-appliances-overview"), controls = el("div");
  const rooms = [...new Set(all.map((a) => a.room).filter(Boolean))], tags = [...new Set(all.flatMap((a) => a.tags))], cats = [...new Set(all.map((a) => a.category).filter(Boolean))];
  const input = el("input", { attrs: { type: "search", "aria-label": "Search appliances" } }); input.value = config.search || "";
  const makeSelect = (label, values, fallback = "") => { const s = el("select", { attrs: { "aria-label": label } }); for (const v of ["", ...values]) { const o = el("option", { text: v || "All", attrs: { value: v } }); if (v === fallback) o.selected = true; s.append(o); } return s; };
  const room = makeSelect("Room filter", rooms, config.room), tag = makeSelect("Tag filter", tags, config.tag), category = makeSelect("Category filter", cats, config.category), status = makeSelect("Status filter", STATUS_KEYS, config.status), sort = makeSelect("Sort appliances", ["name", "room", "category", "status", "currentPower", "energy"], config.sort || "name");
  const activeOnly = el("input", { attrs: { type: "checkbox", "aria-label": "Active only" } }); activeOnly.checked = config.activeOnly === true;
  const showUnavailable = el("input", { attrs: { type: "checkbox", "aria-label": "Show unavailable" } }); showUnavailable.checked = config.showUnavailable !== false;
  const render = () => { n.replaceChildren(el("h3", { text: w.title || "Appliances overview" }), controls); const filtered = filterAppliances(all, { search: input.value, room: selectedValue(controls, "Room filter", config.room), tag: selectedValue(controls, "Tag filter", config.tag), category: selectedValue(controls, "Category filter", config.category), status: selectedValue(controls, "Status filter", config.status), sort: selectedValue(controls, "Sort appliances", config.sort || "name"), activeOnly: activeOnly.checked, showUnavailable: showUnavailable.checked }); const power = aggregateMeasurements(filtered, "currentPower", config.powerUnit || "W"), energy = aggregateMeasurements(filtered, "accumulatedEnergy", config.energyUnit || "kWh"); n.append(el("p", { text: `Active: ${filtered.filter((a) => a.active).length} · Unavailable: ${filtered.filter((a) => !a.available).length} · Current power: ${power.displayValue} · ${power.partial ? `partial excluded ${power.excluded} missing ${power.missing} unavailable ${power.unavailable} malformed ${power.malformed} stale ${power.stale} mixed-unit ${power.mixedUnit}` : "complete"}` }), el("p", { text: `Aggregate energy: ${energy.displayValue} · ${energy.partial ? `partial excluded ${energy.excluded} missing ${energy.missing} unavailable ${energy.unavailable} malformed ${energy.malformed} stale ${energy.stale} mixed-unit ${energy.mixedUnit}` : "complete"}` })); filtered.forEach((a) => n.append(el("p", { text: `${a.title}: ${a.normalizedStatus}${config.showLabels === false ? "" : ` · Room ${a.room || "none"} · Tags ${a.tags.join(", ") || "none"}`}` }))); if (!filtered.length) n.append(emptyState("No appliances match the current filters.")); };
  for (const control of [input, room, tag, category, status, sort, activeOnly, showUnavailable]) control.addEventListener(control.tagName === "input" && control.attributes.type === "search" ? "input" : "change", render);
  const clear = el("button", { text: "Clear filters", attrs: { type: "button" } }); clear.addEventListener("click", () => { input.value = ""; room.value = tag.value = category.value = status.value = ""; sort.value = "name"; activeOnly.checked = false; showUnavailable.checked = true; render(); });
  controls.append(input, room, tag, category, status, activeOnly, showUnavailable, sort, clear); render(); return n;
}

export function renderApplianceUsage(w, runtime = {}) {
  const config = w.config || {}, appliance = normalizeAppliance(runtime, config.appliance || configuredAppliances(w)[0] || {}), n = article(w, "dm-appliance-usage"), table = el("table", { attrs: { "aria-label": "Appliance usage history" } });
  const daily = config.dailyEnergyEntityId ? normalizeMeasurement(runtime, config.dailyEnergyEntityId, { kind: "energy", unit: config.energyUnit || "kWh", locale: runtime.locale }) : appliance.accumulatedEnergy;
  const cycle = config.cycleEnergyEntityId ? normalizeMeasurement(runtime, config.cycleEnergyEntityId, { kind: "energy", unit: config.energyUnit || "kWh", locale: runtime.locale }) : null;
  const cost = config.costEntityId ? normalizeMeasurement(runtime, config.costEntityId, { kind: "currency", locale: runtime.locale }) : null;
  const threshold = Number(config.threshold), current = appliance.currentPower?.normalizedValue, thresholdState = Number.isFinite(threshold) && Number.isFinite(current) ? (current >= threshold ? "exceeded" : "normal") : "unavailable";
  let points = (config.points || runtime.history?.[config.datasetKey] || []).filter((p) => Number.isFinite(Number(p.value)) && Number.isFinite(new Date(p.timestamp).getTime()));
  for (const p of points) table.append(el("tr", {}, [el("td", { text: new Date(p.timestamp).toLocaleString(runtime.locale || "en-US") }), el("td", { text: String(p.value) })]));
  n.append(el("p", { text: `Current power: ${appliance.currentPower?.displayValue || "Unavailable"}` }), el("p", { text: `Daily energy: ${daily?.displayValue || "Unavailable"}` }), el("p", { text: `Cycle energy: ${cycle?.displayValue || "Unavailable"}` }), el("p", { text: `Cost: ${cost?.displayValue || "Unavailable"}` }), el("p", { text: `Threshold: ${thresholdState}` }), points.length ? table : emptyState("No usage history data configured."));
  return n;
}

export function openApplianceDetailPanel(appliance, runtime = {}, trigger) {
  return openSharedDetailPanel({ trigger, label: appliance.title || "Appliance detail", render: ({ close }) => { const normalized = normalizeAppliance(runtime, appliance), p = el("section", { attrs: { role: "dialog" } }), closeButton = el("button", { text: "Close", attrs: { type: "button" } }); closeButton.addEventListener("click", close); p.append(closeButton, el("h3", { text: `${normalized.title} (${normalized.category})` }), el("p", { text: `Status: ${normalized.normalizedStatus} · raw ${normalized.primaryState ?? "missing"}` }), el("p", { text: `Entities: primary ${appliance.entityId || "none"} · status ${appliance.statusEntityId || "none"} · power ${appliance.powerEntityId || "none"} · energy ${appliance.energyEntityId || "none"} · progress ${appliance.progressEntityId || "none"} · remaining ${appliance.remainingTimeEntityId || "none"} · switch ${appliance.switchEntityId || "none"}` }), el("p", { text: `Power ${normalized.currentPower?.displayValue || "Unavailable"} · Energy ${normalized.accumulatedEnergy?.displayValue || "Unavailable"} · Progress ${normalized.progressPercent?.displayValue || "Unavailable"} · Remaining ${normalized.remainingTime?.displayValue || "Unavailable"}` }), el("p", { text: `Room ${normalized.room || "none"} · Tags ${normalized.tags.join(", ") || "none"}` }), el("p", { text: `Explanation: ${normalized.statusEntityProblem || normalized.currentPower?.reason || normalized.accumulatedEnergy?.reason || normalized.progressPercent?.reason || "ok"}` })); for (const action of normalized.actions) p.append(actionButton(action, runtime, defaultActionLabel(action), appliance, p)); return p; } }).panel;
}
export function renderApplianceControlPanel(w, runtime = {}) { return renderApplianceTile({ ...w, type: "appliance-control-panel", config: { ...(w.config || {}), detailAction: true } }, runtime); }
const renderers = { "appliance-tile": renderApplianceTile, "appliance-group": renderApplianceGroup, "appliances-overview": renderAppliancesOverview, "appliance-usage": renderApplianceUsage, "appliance-control-panel": renderApplianceControlPanel };
export function appliancesSectionRenderer(section, cards, context) { const n = el("section", { className: "dashboardmodern-section dm-appliances-section", attrs: { "data-section-id": section.id } }); n.append(el("h3", { text: section.title || "Appliances" }), renderWidgetLayout(section.config?.widgets || [], context, context.widgetRegistry)); return n; }
export const APPLIANCES_MODULE = { id: "appliances", schemaVersion: 1, sections: [{ type: "appliances", displayName: "Appliances", icon: "appliances", renderer: appliancesSectionRenderer, supportedWidgets: APPLIANCE_WIDGET_TYPES, defaultConfig: () => ({ widgets: [{ type: "appliances-overview", config: { appliances: [] } }], card_ids: [] }) }], widgets: APPLIANCE_WIDGET_TYPES.map((type) => ({ type, displayName: type.split("-").map((x) => x[0].toUpperCase() + x.slice(1)).join(" "), renderer: renderers[type], defaultConfig: () => ({ appliances: [] }), schemaVersion: 1, supportedLayoutSizes: ["small", "medium", "large", "full"] })), editorPanels: [{ id: "appliances-editor", title: "Appliances editor" }], navigationEntries: [{ sectionType: "appliances", icon: "appliances", title: "Appliances" }], actions: ["entity.toggle", "switch.turn_on", "switch.turn_off", "service.call", "script.turn_on", "scene.turn_on", "navigate.view", "navigate.section", "detail.open"], detailPanels: [{ id: "appliance-detail", title: "Appliance detail" }], defaultLayouts: [{ sectionType: "appliances", widgets: ["appliances-overview"] }] };
