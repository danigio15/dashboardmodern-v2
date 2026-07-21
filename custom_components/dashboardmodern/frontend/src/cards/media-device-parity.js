import { fieldError, textInput } from "../editor/dashboard-form.js";
import { el } from "../render/dom.js";

export const MEDIA_PLAYER_CONTROL_TYPE = "media-player-control";
export const CAMERA_STATUS_TYPE = "camera-status";
export const FAN_CONTROL_TYPE = "fan-control";
export const VACUUM_CONTROL_TYPE = "vacuum-control";

const ENTITY_RE = /^[a-z0-9_]+\.[a-z0-9_]+$/;
const UNSAFE_RE = /\{\{|\}\}|\{%|%\}|<script|javascript:|data:text\/html|\bon\w+\s*=|<iframe/i;
const BAD_STATES = new Set(["", "unknown", "unavailable"]);
const MEDIA = { pause: 1, volumeSet: 4, volumeMute: 8, previous: 16, next: 32, play: 16384 };
const FAN = { oscillate: 2, presetMode: 8, setPercentage: 16 };
const VACUUM = { pause: 4, stop: 8, returnHome: 16, locate: 512, start: 8192 };

export const defaultMediaPlayerControlConfig = () => ({ entityId: "" });
export const defaultCameraStatusConfig = () => ({ entityId: "", showLastChanged: true });
export const defaultFanControlConfig = () => ({ entityId: "" });
export const defaultVacuumControlConfig = () => ({ entityId: "" });

function configErrors(config, booleans = []) {
  const errors = [];
  if (!config || typeof config !== "object" || Array.isArray(config)) return [{ field: "config", message: "Config must be an object." }];
  if (typeof config.entityId !== "string") errors.push({ field: "config.entityId", message: "entityId must be a string." });
  else if (!config.entityId.trim()) errors.push({ field: "config.entityId", message: "entityId is required." });
  else if (UNSAFE_RE.test(config.entityId)) errors.push({ field: "config.entityId", message: "entityId cannot contain templates or executable expressions." });
  else if (!ENTITY_RE.test(config.entityId)) errors.push({ field: "config.entityId", message: "entityId must be a plain Home Assistant entity ID." });
  for (const key of booleans) if (typeof config[key] !== "boolean") errors.push({ field: `config.${key}`, message: `${key} must be a boolean.` });
  return errors;
}

export const validateMediaPlayerControlConfig = (config) => configErrors(config);
export const validateCameraStatusConfig = (config) => configErrors(config, ["showLastChanged"]);
export const validateFanControlConfig = (config) => configErrors(config);
export const validateVacuumControlConfig = (config) => configErrors(config);

function entityState(runtime, entityId) {
  if (!entityId || !ENTITY_RE.test(entityId) || UNSAFE_RE.test(entityId)) return { status: "missing-config", entity: null, raw: "" };
  const entity = runtime.getEntityState?.(entityId);
  if (!entity || typeof entity !== "object" || Array.isArray(entity)) return { status: "missing-entity", entity: null, raw: "" };
  const raw = String(entity.state ?? "").trim();
  if (BAD_STATES.has(raw)) return { status: raw || "unavailable", entity, raw };
  return { status: "ok", entity, raw };
}
function features(entity) { const value = Number(entity?.attributes?.supported_features); return Number.isFinite(value) ? value : 0; }
function has(entity, feature) { return (features(entity) & feature) === feature; }
function number(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function pct(value) { const parsed = number(value); return parsed !== null && parsed >= 0 && parsed <= 100 ? parsed : null; }
function volume(value) { const parsed = number(value); return parsed !== null && parsed >= 0 && parsed <= 1 ? parsed : null; }
function hasService(runtime) { return typeof runtime.callService === "function"; }
function call(runtime, domain, service, data) { if (hasService(runtime)) runtime.callService(domain, service, data); }
function friendly(entity, fallback) { return String(entity?.attributes?.friendly_name || fallback || "Unnamed entity"); }
function shell(kind, title, status) { const node = el("article", { className: `dashboardmodern-card dm-device-card dm-${kind}`, attrs: { "data-card-kind": kind, "data-status": status } }); node.append(el("h3", { className: "section-title", text: title })); return node; }
function button(label, disabled, handler) { const node = el("button", { text: label, attrs: { type: "button", "aria-label": label, disabled: disabled ? "" : null } }); if (!disabled) node.addEventListener("click", handler); return node; }
function statusText(status) { return status === "ok" ? "ok" : status.replace("-", " "); }

export function normalizeMediaPlayer(runtime = {}, config = {}) {
  const state = entityState(runtime, config.entityId); const attrs = state.entity?.attributes || {}; const vol = volume(attrs.volume_level);
  return { ...state, entityId: config.entityId, name: friendly(state.entity, config.entityId), title: String(attrs.media_title || ""), artist: String(attrs.media_artist || ""), volume: vol, volumeMalformed: attrs.volume_level !== undefined && vol === null, muted: Boolean(attrs.is_volume_muted), canPlayPause: has(state.entity, MEDIA.play) || has(state.entity, MEDIA.pause), canPrevious: has(state.entity, MEDIA.previous), canNext: has(state.entity, MEDIA.next), canVolume: has(state.entity, MEDIA.volumeSet) && vol !== null, canMute: has(state.entity, MEDIA.volumeMute) };
}
export function normalizeCamera(runtime = {}, config = {}) { const state = entityState(runtime, config.entityId); return { ...state, entityId: config.entityId, name: friendly(state.entity, config.entityId), lastChanged: String(state.entity?.last_changed || "") }; }
export function normalizeFan(runtime = {}, config = {}) { const state = entityState(runtime, config.entityId); const attrs = state.entity?.attributes || {}; const percentage = pct(attrs.percentage); const presets = Array.isArray(attrs.preset_modes) ? attrs.preset_modes.filter((v) => typeof v === "string" && v.trim()) : []; return { ...state, entityId: config.entityId, name: friendly(state.entity, config.entityId), percentage, percentageMalformed: attrs.percentage !== undefined && percentage === null, preset: typeof attrs.preset_mode === "string" ? attrs.preset_mode : "", presetMalformed: attrs.preset_mode !== undefined && typeof attrs.preset_mode !== "string", presets, oscillating: Boolean(attrs.oscillating), canPercentage: has(state.entity, FAN.setPercentage) && percentage !== null, canPreset: has(state.entity, FAN.presetMode) && presets.length > 0, canOscillate: has(state.entity, FAN.oscillate) } }
export function normalizeVacuum(runtime = {}, config = {}) { const state = entityState(runtime, config.entityId); return { ...state, entityId: config.entityId, name: friendly(state.entity, config.entityId), canStart: has(state.entity, VACUUM.start), canPause: has(state.entity, VACUUM.pause), canStop: has(state.entity, VACUUM.stop), canReturn: has(state.entity, VACUUM.returnHome), canLocate: has(state.entity, VACUUM.locate) }; }

export function renderMediaPlayerControlCard(cardDef, runtime = {}) {
  const n = normalizeMediaPlayer(runtime, cardDef.config); const bad = n.status !== "ok" || n.volumeMalformed; const disabled = bad || !hasService(runtime); const node = shell(MEDIA_PLAYER_CONTROL_TYPE, cardDef.title || n.name, bad ? (n.volumeMalformed ? "malformed" : n.status) : "ok");
  node.append(el("p", { text: bad ? `Unavailable: ${n.volumeMalformed ? "malformed volume" : statusText(n.status)}` : `${n.name} · State ${n.raw}` }));
  if (!bad && (n.title || n.artist)) node.append(el("p", { className: "dm-device-secondary", text: [n.title, n.artist].filter(Boolean).join(" — ") }));
  const controls = el("div", { className: "dm-device-controls" });
  if (n.canPrevious) controls.append(button(`Previous ${n.entityId}`, disabled, () => call(runtime, "media_player", "media_previous_track", { entity_id: n.entityId })));
  if (n.canPlayPause) controls.append(button(`Play pause ${n.entityId}`, disabled, () => call(runtime, "media_player", "media_play_pause", { entity_id: n.entityId })));
  if (n.canNext) controls.append(button(`Next ${n.entityId}`, disabled, () => call(runtime, "media_player", "media_next_track", { entity_id: n.entityId })));
  if (n.canMute) controls.append(button(`${n.muted ? "Unmute" : "Mute"} ${n.entityId}`, disabled, () => call(runtime, "media_player", "volume_mute", { entity_id: n.entityId, is_volume_muted: !n.muted })));
  node.append(controls);
  if (n.canVolume) { const range = el("input", { attrs: { type: "range", min: "0", max: "1", step: "0.01", value: String(n.volume), "aria-label": `Volume for ${n.entityId}`, disabled: disabled ? "" : null } }); if (!disabled) range.addEventListener("change", () => call(runtime, "media_player", "volume_set", { entity_id: n.entityId, volume_level: Number(range.value) })); node.append(range); }
  return node;
}
export function renderCameraStatusCard(cardDef, runtime = {}) { const n = normalizeCamera(runtime, cardDef.config); const node = shell(CAMERA_STATUS_TYPE, cardDef.title || n.name, n.status); node.append(el("p", { text: n.status === "ok" ? `${n.name} · State ${n.raw}` : `Unavailable: ${statusText(n.status)}` }), el("div", { className: "dm-camera-placeholder", text: "Camera preview unavailable in this card. Use Home Assistant authenticated views for imagery." })); if (cardDef.config?.showLastChanged) node.append(el("p", { className: "dm-device-secondary", text: `Last changed: ${n.lastChanged || "Unavailable"}` })); return node; }
export function renderFanControlCard(cardDef, runtime = {}) { const n = normalizeFan(runtime, cardDef.config); const bad = n.status !== "ok" || n.percentageMalformed || n.presetMalformed; const disabled = bad || !hasService(runtime); const node = shell(FAN_CONTROL_TYPE, cardDef.title || n.name, bad ? "malformed" : "ok"); node.append(el("p", { text: bad ? `Unavailable: ${n.percentageMalformed ? "malformed percentage" : n.presetMalformed ? "malformed preset" : statusText(n.status)}` : `${n.name} · State ${n.raw}` })); node.append(button(`Toggle ${n.entityId}`, disabled, () => call(runtime, "fan", "toggle", { entity_id: n.entityId }))); if (n.canPercentage) { const range = el("input", { attrs: { type: "range", min: "0", max: "100", value: String(n.percentage), "aria-label": `Fan percentage for ${n.entityId}`, disabled: disabled ? "" : null } }); if (!disabled) range.addEventListener("change", () => call(runtime, "fan", "set_percentage", { entity_id: n.entityId, percentage: Number(range.value) })); node.append(range); } if (n.canPreset) { const select = el("select", { attrs: { "aria-label": `Fan preset for ${n.entityId}`, disabled: disabled ? "" : null } }); n.presets.forEach((p) => { const option = el("option", { text: p, attrs: { value: p } }); option.selected = p === n.preset; select.append(option); }); if (!disabled) select.addEventListener("change", () => call(runtime, "fan", "set_preset_mode", { entity_id: n.entityId, preset_mode: select.value })); node.append(select); } if (n.canOscillate) node.append(button(`${n.oscillating ? "Stop oscillation" : "Start oscillation"} ${n.entityId}`, disabled, () => call(runtime, "fan", "oscillate", { entity_id: n.entityId, oscillating: !n.oscillating }))); return node; }
export function renderVacuumControlCard(cardDef, runtime = {}) { const n = normalizeVacuum(runtime, cardDef.config); const disabled = n.status !== "ok" || !hasService(runtime); const node = shell(VACUUM_CONTROL_TYPE, cardDef.title || n.name, n.status); node.append(el("p", { text: n.status === "ok" ? `${n.name} · State ${n.raw}` : `Unavailable: ${statusText(n.status)}` })); const controls = el("div", { className: "dm-device-controls" }); if (n.canStart) controls.append(button(`Start ${n.entityId}`, disabled, () => call(runtime, "vacuum", "start", { entity_id: n.entityId }))); if (n.canPause) controls.append(button(`Pause ${n.entityId}`, disabled, () => call(runtime, "vacuum", "pause", { entity_id: n.entityId }))); if (n.canStop) controls.append(button(`Stop ${n.entityId}`, disabled, () => call(runtime, "vacuum", "stop", { entity_id: n.entityId }))); if (n.canReturn) controls.append(button(`Return ${n.entityId} to base`, disabled, () => call(runtime, "vacuum", "return_to_base", { entity_id: n.entityId }))); if (n.canLocate) controls.append(button(`Locate ${n.entityId}`, disabled, () => call(runtime, "vacuum", "locate", { entity_id: n.entityId }))); node.append(controls); return node; }

function boolInput(documentRef, labelText, value, onChange, fieldId) { const label = documentRef.createElement("label"); label.textContent = `${labelText} `; const input = documentRef.createElement("input"); input.type = "checkbox"; input.checked = Boolean(value); input.dataset.editorField = fieldId; input.addEventListener("change", () => onChange(input.checked)); label.append(input); return label; }
function editor(extra = []) { return (documentRef, cardDef, controller, errors = []) => { const form = documentRef.createElement("section"); form.className = "dashboardmodern-plugin-editor"; form.append(textInput(documentRef, "Entity ID", cardDef.config?.entityId || "", (entityId) => controller.updateCardConfigPatch(cardDef.id, { entityId }), `card:${cardDef.id}:config.entityId`)); extra.forEach((field) => form.append(field(documentRef, cardDef, controller))); errors.forEach((error) => form.append(fieldError(documentRef, error.message))); return form; }; }
export const renderMediaPlayerControlEditor = editor();
export const renderCameraStatusEditor = editor([(documentRef, cardDef, controller) => boolInput(documentRef, "Show last changed", cardDef.config?.showLastChanged, (showLastChanged) => controller.updateCardConfigPatch(cardDef.id, { showLastChanged }), `card:${cardDef.id}:config.showLastChanged`)]);
export const renderFanControlEditor = editor();
export const renderVacuumControlEditor = editor();
