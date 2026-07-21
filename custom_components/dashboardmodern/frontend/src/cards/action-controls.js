import { fieldError, textInput } from "../editor/dashboard-form.js";
import { el } from "../render/dom.js";

export const BUTTON_CONTROL_TYPE = "button-control";
export const SCENE_CONTROL_TYPE = "scene-control";
export const SCRIPT_CONTROL_TYPE = "script-control";
export const AUTOMATION_CONTROL_TYPE = "automation-control";
export const INPUT_BOOLEAN_CONTROL_TYPE = "input-boolean-control";
export const INPUT_NUMBER_CONTROL_TYPE = "input-number-control";
export const INPUT_SELECT_CONTROL_TYPE = "input-select-control";

const ENTITY_RE = /^[a-z0-9_]+\.[a-z0-9_]+$/;
const UNSAFE_RE = /\{\{|\}\}|\{%|%\}|<script|javascript:|data:text\/html|\bon\w+\s*=|<iframe/i;
const BAD = new Set(["", "unknown", "unavailable"]);
const SERVICE = Object.freeze({
  [BUTTON_CONTROL_TYPE]: ["button", "press", "Press"],
  [SCENE_CONTROL_TYPE]: ["scene", "turn_on", "Activate"],
});

export const defaultButtonControlConfig = () => ({ entityId: "", showLastChanged: true });
export const defaultSceneControlConfig = () => ({ entityId: "", showLastChanged: true });
export const defaultScriptControlConfig = () => ({ entityId: "" });
export const defaultAutomationControlConfig = () => ({ entityId: "" });
export const defaultInputBooleanControlConfig = () => ({ entityId: "" });
export const defaultInputNumberControlConfig = () => ({ entityId: "" });
export const defaultInputSelectControlConfig = () => ({ entityId: "" });

export function isPlainObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
export function parseOptionalString(value) {
  if (value === undefined || value === null) return { status: "missing", value: "" };
  if (typeof value !== "string") return { status: "malformed", value: "" };
  if (!value.trim()) return { status: "missing", value: "" };
  return { status: "valid", value };
}
export function parseOptionalBoolean(value) {
  if (value === undefined || value === null) return { status: "missing", value: null };
  if (typeof value !== "boolean") return { status: "malformed", value: null };
  return { status: "valid", value };
}
export function parseOptionalNumber(value) {
  if (value === undefined || value === null) return { status: "missing", value: null };
  if (typeof value === "string" && !value.trim()) return { status: "missing", value: null };
  const parsed = typeof value === "number" ? value : Number(String(value).trim().replace(",", "."));
  if (!Number.isFinite(parsed)) return { status: "malformed", value: null };
  return { status: "valid", value: parsed };
}
export function parseTimestampString(value) {
  const parsed = parseOptionalString(value);
  if (parsed.status !== "valid") return parsed;
  return Number.isNaN(Date.parse(parsed.value)) ? { status: "malformed", value: "" } : parsed;
}
export function parseFriendlyName(attributes, fallback) {
  const parsed = parseOptionalString(attributes.friendly_name);
  return { parsed, value: parsed.status === "valid" ? parsed.value : fallback || "Unnamed entity" };
}
export function lookupEntity(runtime = {}, entityId = "") {
  if (!entityId || !ENTITY_RE.test(entityId) || UNSAFE_RE.test(entityId)) return { status: "missing", entity: null, raw: "", attributes: {} };
  const entity = runtime.getEntityState?.(entityId);
  if (!isPlainObject(entity)) return { status: "missing", entity: null, raw: "", attributes: {} };
  const attributes = entity.attributes === undefined || entity.attributes === null ? {} : entity.attributes;
  if (!isPlainObject(attributes)) return { status: "malformed", reason: "malformed attributes", entity, raw: "", attributes: {} };
  if (typeof entity.state !== "string") return { status: "malformed", reason: "malformed entity state", entity, raw: "", attributes };
  const raw = entity.state.trim();
  if (BAD.has(raw)) return { status: raw === "unknown" ? "unknown" : "unavailable", entity, raw, attributes };
  return { status: "valid", entity, raw, attributes };
}

function configErrors(config, booleans = []) {
  if (!isPlainObject(config)) return [{ field: "config", message: "Config must be an object." }];
  const errors = [];
  if (typeof config.entityId !== "string") errors.push({ field: "config.entityId", message: "entityId must be a string." });
  else if (!config.entityId.trim()) errors.push({ field: "config.entityId", message: "entityId is required." });
  else if (UNSAFE_RE.test(config.entityId)) errors.push({ field: "config.entityId", message: "entityId cannot contain templates or executable expressions." });
  else if (!ENTITY_RE.test(config.entityId)) errors.push({ field: "config.entityId", message: "entityId must be a plain Home Assistant entity ID." });
  for (const key of booleans) if (typeof config[key] !== "boolean") errors.push({ field: `config.${key}`, message: `${key} must be a boolean.` });
  return errors;
}
export const validateButtonControlConfig = (c) => configErrors(c, ["showLastChanged"]);
export const validateSceneControlConfig = (c) => configErrors(c, ["showLastChanged"]);
export const validateScriptControlConfig = (c) => configErrors(c);
export const validateAutomationControlConfig = (c) => configErrors(c);
export const validateInputBooleanControlConfig = (c) => configErrors(c);
export const validateInputNumberControlConfig = (c) => configErrors(c);
export const validateInputSelectControlConfig = (c) => configErrors(c);

const hasSvc = (r) => typeof r.callService === "function";
const call = (r, d, s, data) => { if (hasSvc(r)) r.callService(d, s, data); };
const badText = (n) => n.reason || n.status;
const malformed = (items) => Object.entries(items).filter(([, v]) => v.status === "malformed").map(([k]) => k);
function shell(kind, title, status) { const n = el("article", { className: `dashboardmodern-card dm-action-card dm-${kind}`, attrs: { "data-card-kind": kind, "data-status": status } }); n.append(el("h3", { className: "section-title", text: title })); return n; }
function button(label, disabled, fn) { const b = el("button", { text: label, attrs: { type: "button", "aria-label": label, disabled: disabled ? "" : null } }); if (!disabled) b.addEventListener("click", fn); return b; }
function entityBase(runtime, config) { const e = lookupEntity(runtime, config?.entityId); const name = parseFriendlyName(e.attributes, config?.entityId); return { ...e, entityId: config?.entityId, name: name.value, friendlyName: name.parsed, lastChanged: parseTimestampString(e.entity?.last_changed) }; }

export const normalizeButtonControl = entityBase;
export const normalizeSceneControl = entityBase;
export function renderButtonScene(kind, cardDef, runtime = {}) {
  const n = entityBase(runtime, cardDef.config); const [domain, service, label] = SERVICE[kind]; const bad = n.status !== "valid" || n.friendlyName.status === "malformed"; const node = shell(kind, cardDef.title || n.name, bad ? "malformed" : n.status);
  node.append(el("p", { text: bad ? `Unavailable: ${n.friendlyName.status === "malformed" ? "malformed friendly_name" : badText(n)}` : `${n.name} · State ${n.raw}` }));
  if (cardDef.config?.showLastChanged) node.append(el("p", { className: "dm-device-secondary", text: `Last changed: ${n.lastChanged.value || (n.lastChanged.status === "malformed" ? "Malformed timestamp" : "Unavailable")}` }));
  node.append(button(`${label} ${n.entityId}`, bad || !hasSvc(runtime), () => call(runtime, domain, service, { entity_id: n.entityId })));
  return node;
}
export const renderButtonControlCard = (c, r) => renderButtonScene(BUTTON_CONTROL_TYPE, c, r);
export const renderSceneControlCard = (c, r) => renderButtonScene(SCENE_CONTROL_TYPE, c, r);

export function normalizeScriptControl(runtime = {}, config = {}) { const n = entityBase(runtime, config); const current = parseOptionalNumber(n.attributes.current); return { ...n, current, malformed: malformed({ friendly_name: n.friendlyName, current }) }; }
export function renderScriptControlCard(cardDef, runtime = {}) { const n = normalizeScriptControl(runtime, cardDef.config); const bad = n.status !== "valid" || n.malformed.length; const node = shell(SCRIPT_CONTROL_TYPE, cardDef.title || n.name, bad ? "malformed" : n.status); node.append(el("p", { text: bad ? `Unavailable: ${n.malformed.length ? `malformed ${n.malformed.join(", ")}` : badText(n)}` : `${n.name} · State ${n.raw}` })); if (n.current.status === "valid") node.append(el("p", { text: `Current executions: ${n.current.value}` })); node.append(button(`Run ${n.entityId}`, bad || !hasSvc(runtime), () => call(runtime, "script", "turn_on", { entity_id: n.entityId }))); if (n.current.status === "valid" && n.current.value > 0) node.append(button(`Stop ${n.entityId}`, bad || !hasSvc(runtime), () => call(runtime, "script", "turn_off", { entity_id: n.entityId }))); return node; }

export function normalizeAutomationControl(runtime = {}, config = {}) { const n = entityBase(runtime, config); const lastTriggered = parseTimestampString(n.attributes.last_triggered); return { ...n, enabled: n.raw === "on" ? true : n.raw === "off" ? false : null, lastTriggered, malformed: malformed({ friendly_name: n.friendlyName, last_triggered: lastTriggered }) }; }
export function renderAutomationControlCard(cardDef, runtime = {}) { const n = normalizeAutomationControl(runtime, cardDef.config); const bad = n.status !== "valid" || n.enabled === null || n.malformed.length; const node = shell(AUTOMATION_CONTROL_TYPE, cardDef.title || n.name, bad ? "malformed" : n.status); node.append(el("p", { text: bad ? `Unavailable: ${n.malformed.length ? `malformed ${n.malformed.join(", ")}` : badText(n)}` : `${n.name} · State ${n.raw}` })); if (n.lastTriggered.status === "valid") node.append(el("p", { text: `Last triggered: ${n.lastTriggered.value}` })); node.append(button(`${n.enabled ? "Disable" : "Enable"} ${n.entityId}`, bad || !hasSvc(runtime), () => call(runtime, "automation", n.enabled ? "turn_off" : "turn_on", { entity_id: n.entityId }))); node.append(button(`Trigger ${n.entityId}`, bad || !hasSvc(runtime), () => call(runtime, "automation", "trigger", { entity_id: n.entityId }))); return node; }

export function normalizeInputBooleanControl(runtime = {}, config = {}) { const n = entityBase(runtime, config); return { ...n, on: n.raw === "on" ? true : n.raw === "off" ? false : null, malformed: malformed({ friendly_name: n.friendlyName }) }; }
export function renderInputBooleanControlCard(cardDef, runtime = {}) { const n = normalizeInputBooleanControl(runtime, cardDef.config); const bad = n.status !== "valid" || n.on === null || n.malformed.length; const node = shell(INPUT_BOOLEAN_CONTROL_TYPE, cardDef.title || n.name, bad ? "malformed" : n.status); node.append(el("p", { text: bad ? `Unavailable: ${n.malformed.length ? `malformed ${n.malformed.join(", ")}` : badText(n)}` : `${n.name} · ${n.on ? "on" : "off"}` })); node.append(button(`Turn ${n.on ? "off" : "on"} ${n.entityId}`, bad || !hasSvc(runtime), () => call(runtime, "input_boolean", n.on ? "turn_off" : "turn_on", { entity_id: n.entityId }))); return node; }

export function normalizeInputNumberControl(runtime = {}, config = {}) { const n = entityBase(runtime, config); const value = parseOptionalNumber(n.raw); const min = parseOptionalNumber(n.attributes.min); const max = parseOptionalNumber(n.attributes.max); const step = parseOptionalNumber(n.attributes.step); const problems = malformed({ friendly_name: n.friendlyName, value, min, max, step }); if (min.status === "valid" && max.status === "valid" && min.value > max.value) problems.push("min greater than max"); if (step.status === "valid" && step.value <= 0) problems.push("step"); if (value.status === "valid" && min.status === "valid" && max.status === "valid" && (value.value < min.value || value.value > max.value)) problems.push("current value outside bounds"); const canRange = n.status === "valid" && !problems.length && value.status === "valid" && min.status === "valid" && max.status === "valid" && step.status === "valid"; return { ...n, value, min, max, step, problems, canRange }; }
export function renderInputNumberControlCard(cardDef, runtime = {}) { const n = normalizeInputNumberControl(runtime, cardDef.config); const bad = n.status !== "valid" || n.problems.length; const node = shell(INPUT_NUMBER_CONTROL_TYPE, cardDef.title || n.name, bad ? "malformed" : n.status); node.append(el("p", { text: bad ? `Unavailable: ${n.problems.length ? `malformed ${n.problems.join(", ")}` : badText(n)}` : `${n.name} · ${n.value.value}` })); if (n.canRange) { const id = `range-${n.entityId}`; node.append(el("label", { text: `Value for ${n.entityId}`, attrs: { for: id } })); const range = el("input", { attrs: { id, type: "range", min: String(n.min.value), max: String(n.max.value), step: String(n.step.value), value: String(n.value.value), disabled: !hasSvc(runtime) ? "" : null } }); if (hasSvc(runtime)) range.addEventListener("change", () => call(runtime, "input_number", "set_value", { entity_id: n.entityId, value: Number(range.value) })); node.append(range); } return node; }

function parseOptions(value) { if (value === undefined || value === null) return { status: "missing", value: [] }; if (!Array.isArray(value)) return { status: "malformed", value: [] }; if (value.some((v) => typeof v !== "string" || !v.trim())) return { status: "malformed", value: [] }; if (new Set(value).size !== value.length) return { status: "malformed", value: [] }; return { status: "valid", value }; }
export function normalizeInputSelectControl(runtime = {}, config = {}) { const n = entityBase(runtime, config); const options = parseOptions(n.attributes.options); const problems = malformed({ friendly_name: n.friendlyName, options }); if (options.status === "valid" && options.value.length === 0) problems.push("empty options"); if (options.status === "valid" && !options.value.includes(n.raw)) problems.push("current option absent from options"); return { ...n, options, problems, canSelect: n.status === "valid" && options.status === "valid" && options.value.length > 0 }; }
export function renderInputSelectControlCard(cardDef, runtime = {}) { const n = normalizeInputSelectControl(runtime, cardDef.config); const bad = n.status !== "valid" || n.problems.length; const node = shell(INPUT_SELECT_CONTROL_TYPE, cardDef.title || n.name, bad ? "malformed" : n.status); node.append(el("p", { text: bad ? `Unavailable: ${n.problems.length ? `malformed ${n.problems.join(", ")}` : badText(n)}` : `${n.name} · ${n.raw}` })); if (n.canSelect) { const id = `select-${n.entityId}`; node.append(el("label", { text: `Option for ${n.entityId}`, attrs: { for: id } })); const s = el("select", { attrs: { id, disabled: !hasSvc(runtime) ? "" : null } }); for (const opt of n.options.value) { const o = el("option", { text: opt, attrs: { value: opt } }); o.selected = opt === n.raw; s.append(o); } if (hasSvc(runtime)) s.addEventListener("change", () => call(runtime, "input_select", "select_option", { entity_id: n.entityId, option: s.value })); node.append(s); } return node; }

function boolInput(documentRef, labelText, value, onChange, fieldId) { const label = documentRef.createElement("label"); label.textContent = `${labelText} `; const input = documentRef.createElement("input"); input.type = "checkbox"; input.checked = value === true; input.dataset.editorField = fieldId; input.addEventListener("change", () => onChange(input.checked)); label.append(input); return label; }
function editor(extra = []) { return (documentRef, cardDef, controller, errors = []) => { const form = documentRef.createElement("section"); form.className = "dashboardmodern-plugin-editor"; form.append(textInput(documentRef, "Entity ID", cardDef.config?.entityId || "", (entityId) => controller.updateCardConfigPatch(cardDef.id, { entityId }), `card:${cardDef.id}:config.entityId`)); for (const f of extra) form.append(f(documentRef, cardDef, controller)); for (const error of errors) form.append(fieldError(documentRef, error.message)); return form; }; }
export const renderButtonControlEditor = editor([(d, c, ctl) => boolInput(d, "Show last changed", c.config?.showLastChanged, (showLastChanged) => ctl.updateCardConfigPatch(c.id, { showLastChanged }), `card:${c.id}:config.showLastChanged`)]);
export const renderSceneControlEditor = editor([(d, c, ctl) => boolInput(d, "Show last changed", c.config?.showLastChanged, (showLastChanged) => ctl.updateCardConfigPatch(c.id, { showLastChanged }), `card:${c.id}:config.showLastChanged`)]);
export const renderScriptControlEditor = editor();
export const renderAutomationControlEditor = editor();
export const renderInputBooleanControlEditor = editor();
export const renderInputNumberControlEditor = editor();
export const renderInputSelectControlEditor = editor();
