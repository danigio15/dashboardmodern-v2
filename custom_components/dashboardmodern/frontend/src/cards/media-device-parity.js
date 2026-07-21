import { fieldError, textInput } from "../editor/dashboard-form.js";
import { el } from "../render/dom.js";

export const MEDIA_PLAYER_CONTROL_TYPE = "media-player-control";
export const CAMERA_STATUS_TYPE = "camera-status";
export const FAN_CONTROL_TYPE = "fan-control";
export const VACUUM_CONTROL_TYPE = "vacuum-control";

const ENTITY_RE = /^[a-z0-9_]+\.[a-z0-9_]+$/;
const UNSAFE_RE = /\{\{|\}\}|\{%|%\}|<script|javascript:|data:text\/html|\bon\w+\s*=|<iframe/i;
const BAD_STATES = new Set(["", "unknown", "unavailable"]);

const MEDIA_FEATURES = Object.freeze({
  pause: 1,
  volumeSet: 4,
  volumeMute: 8,
  previous: 16,
  next: 32,
  play: 16384,
});

const FAN_FEATURES = Object.freeze({
  oscillate: 2,
  presetMode: 8,
  setPercentage: 16,
});

const VACUUM_FEATURES = Object.freeze({
  pause: 4,
  stop: 8,
  returnHome: 16,
  locate: 512,
  start: 8192,
});

export const defaultMediaPlayerControlConfig = () => ({ entityId: "" });
export const defaultCameraStatusConfig = () => ({ entityId: "", showLastChanged: true });
export const defaultFanControlConfig = () => ({ entityId: "" });
export const defaultVacuumControlConfig = () => ({ entityId: "" });

function configErrors(config, booleans = []) {
  const errors = [];

  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return [{ field: "config", message: "Config must be an object." }];
  }

  if (typeof config.entityId !== "string") {
    errors.push({ field: "config.entityId", message: "entityId must be a string." });
  } else if (!config.entityId.trim()) {
    errors.push({ field: "config.entityId", message: "entityId is required." });
  } else if (UNSAFE_RE.test(config.entityId)) {
    errors.push({ field: "config.entityId", message: "entityId cannot contain templates or executable expressions." });
  } else if (!ENTITY_RE.test(config.entityId)) {
    errors.push({ field: "config.entityId", message: "entityId must be a plain Home Assistant entity ID." });
  }

  for (const key of booleans) {
    if (typeof config[key] !== "boolean") {
      errors.push({ field: `config.${key}`, message: `${key} must be a boolean.` });
    }
  }

  return errors;
}

export const validateMediaPlayerControlConfig = (config) => configErrors(config);
export const validateCameraStatusConfig = (config) => configErrors(config, ["showLastChanged"]);
export const validateFanControlConfig = (config) => configErrors(config);
export const validateVacuumControlConfig = (config) => configErrors(config);

function parseOptionalString(value) {
  if (value === undefined || value === null) {
    return { status: "missing", value: "" };
  }
  if (typeof value !== "string") {
    return { status: "malformed", value: "" };
  }
  if (!value.trim()) {
    return { status: "missing", value: "" };
  }
  return { status: "ok", value };
}

function parseOptionalBoolean(value) {
  if (value === undefined || value === null) {
    return { status: "missing", value: null };
  }
  if (typeof value !== "boolean") {
    return { status: "malformed", value: null };
  }
  return { status: "ok", value };
}

function parseOptionalNumber(value, { min = -Infinity, max = Infinity } = {}) {
  if (value === undefined || value === null) {
    return { status: "missing", value: null };
  }
  if (typeof value === "string" && !value.trim()) {
    return { status: "missing", value: null };
  }

  const parsed = typeof value === "number" ? value : Number(String(value).trim().replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return { status: "malformed", value: null };
  }

  return { status: "ok", value: parsed };
}

function parseSupportedFeatures(value) {
  const parsed = parseOptionalNumber(value, { min: 0 });
  if (parsed.status !== "ok") {
    return { ...parsed, value: 0 };
  }
  return { status: "ok", value: Math.trunc(parsed.value) };
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function entityState(runtime, entityId) {
  if (!entityId || !ENTITY_RE.test(entityId) || UNSAFE_RE.test(entityId)) {
    return { status: "missing-config", entity: null, raw: "", attributes: {} };
  }

  const entity = runtime.getEntityState?.(entityId);
  if (!isPlainObject(entity)) {
    return { status: "missing-entity", entity: null, raw: "", attributes: {} };
  }

  const attributes = entity.attributes === undefined || entity.attributes === null ? {} : entity.attributes;
  if (!isPlainObject(attributes)) {
    return { status: "malformed-entity-attributes", entity, raw: "", attributes: {} };
  }

  if (entity.state !== undefined && typeof entity.state !== "string") {
    return { status: "malformed-entity-state", entity, raw: "", attributes };
  }

  const raw = (entity.state || "").trim();
  if (BAD_STATES.has(raw)) {
    return { status: raw || "unavailable", entity, raw, attributes };
  }

  return { status: "ok", entity, raw, attributes };
}

function hasFeature(featureSet, feature) {
  return (featureSet.value & feature) === feature;
}

function hasService(runtime) {
  return typeof runtime.callService === "function";
}

function call(runtime, domain, service, data) {
  if (hasService(runtime)) {
    runtime.callService(domain, service, data);
  }
}

function displayName(name, fallback) {
  return name.status === "ok" ? name.value : fallback || "Unnamed entity";
}

function shell(kind, title, status) {
  const node = el("article", {
    className: `dashboardmodern-card dm-device-card dm-${kind}`,
    attrs: { "data-card-kind": kind, "data-status": status },
  });
  node.append(el("h3", { className: "section-title", text: title }));
  return node;
}

function button(label, disabled, handler) {
  const node = el("button", {
    text: label,
    attrs: { type: "button", "aria-label": label, disabled: disabled ? "" : null },
  });
  if (!disabled) {
    node.addEventListener("click", handler);
  }
  return node;
}

function statusText(status) {
  return status === "ok" ? "ok" : status.replaceAll("-", " ");
}

function malformedLabels(items) {
  return Object.entries(items)
    .filter(([, result]) => result.status === "malformed")
    .map(([label]) => label);
}

function presetModes(value) {
  if (value === undefined || value === null) {
    return { status: "missing", value: [] };
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    return { status: "malformed", value: [] };
  }
  return { status: "ok", value };
}

export function normalizeMediaPlayer(runtime = {}, config = {}) {
  const state = entityState(runtime, config.entityId);
  const attributes = state.attributes;
  const featureSet = parseSupportedFeatures(attributes.supported_features);
  const friendlyName = parseOptionalString(attributes.friendly_name);
  const title = parseOptionalString(attributes.media_title);
  const artist = parseOptionalString(attributes.media_artist);
  const volume = parseOptionalNumber(attributes.volume_level, { min: 0, max: 1 });
  const muted = parseOptionalBoolean(attributes.is_volume_muted);

  return {
    ...state,
    entityId: config.entityId,
    name: displayName(friendlyName, config.entityId),
    friendlyName,
    title,
    artist,
    volume,
    muted,
    featureSet,
    malformed: malformedLabels({ friendly_name: friendlyName, media_title: title, media_artist: artist, volume_level: volume, is_volume_muted: muted, supported_features: featureSet }),
    canPlayPause: hasFeature(featureSet, MEDIA_FEATURES.play) || hasFeature(featureSet, MEDIA_FEATURES.pause),
    canPrevious: hasFeature(featureSet, MEDIA_FEATURES.previous),
    canNext: hasFeature(featureSet, MEDIA_FEATURES.next),
    canVolume: hasFeature(featureSet, MEDIA_FEATURES.volumeSet) && volume.status === "ok",
    canMute: hasFeature(featureSet, MEDIA_FEATURES.volumeMute),
  };
}

export function normalizeCamera(runtime = {}, config = {}) {
  const state = entityState(runtime, config.entityId);
  const attributes = state.attributes;
  const friendlyName = parseOptionalString(attributes.friendly_name);
  const lastChanged = parseOptionalString(state.entity?.last_changed);

  return {
    ...state,
    entityId: config.entityId,
    name: displayName(friendlyName, config.entityId),
    friendlyName,
    lastChanged,
    malformed: malformedLabels({ friendly_name: friendlyName, last_changed: lastChanged }),
  };
}

export function normalizeFan(runtime = {}, config = {}) {
  const state = entityState(runtime, config.entityId);
  const attributes = state.attributes;
  const featureSet = parseSupportedFeatures(attributes.supported_features);
  const friendlyName = parseOptionalString(attributes.friendly_name);
  const percentage = parseOptionalNumber(attributes.percentage, { min: 0, max: 100 });
  const modes = presetModes(attributes.preset_modes);
  const preset = parseOptionalString(attributes.preset_mode);
  const oscillating = parseOptionalBoolean(attributes.oscillating);
  const presetNotInModes = preset.status === "ok" && modes.status === "ok" && !modes.value.includes(preset.value);

  return {
    ...state,
    entityId: config.entityId,
    name: displayName(friendlyName, config.entityId),
    friendlyName,
    percentage,
    presets: modes,
    preset,
    presetNotInModes,
    oscillating,
    featureSet,
    malformed: malformedLabels({ friendly_name: friendlyName, percentage, preset_modes: modes, preset_mode: preset, oscillating, supported_features: featureSet }),
    canPercentage: hasFeature(featureSet, FAN_FEATURES.setPercentage) && percentage.status === "ok",
    canPreset: hasFeature(featureSet, FAN_FEATURES.presetMode) && modes.status === "ok" && modes.value.length > 0,
    canOscillate: hasFeature(featureSet, FAN_FEATURES.oscillate),
  };
}

export function normalizeVacuum(runtime = {}, config = {}) {
  const state = entityState(runtime, config.entityId);
  const attributes = state.attributes;
  const featureSet = parseSupportedFeatures(attributes.supported_features);
  const friendlyName = parseOptionalString(attributes.friendly_name);

  return {
    ...state,
    entityId: config.entityId,
    name: displayName(friendlyName, config.entityId),
    friendlyName,
    featureSet,
    malformed: malformedLabels({ friendly_name: friendlyName, supported_features: featureSet }),
    canStart: hasFeature(featureSet, VACUUM_FEATURES.start),
    canPause: hasFeature(featureSet, VACUUM_FEATURES.pause),
    canStop: hasFeature(featureSet, VACUUM_FEATURES.stop),
    canReturn: hasFeature(featureSet, VACUUM_FEATURES.returnHome),
    canLocate: hasFeature(featureSet, VACUUM_FEATURES.locate),
  };
}

export function renderMediaPlayerControlCard(cardDef, runtime = {}) {
  const normalized = normalizeMediaPlayer(runtime, cardDef.config);
  const malformed = normalized.malformed.length > 0;
  const unavailable = normalized.status !== "ok" || malformed;
  const disabled = unavailable || !hasService(runtime);
  const node = shell(MEDIA_PLAYER_CONTROL_TYPE, cardDef.title || normalized.name, malformed ? "malformed" : normalized.status);

  node.append(el("p", {
    text: unavailable ? `Unavailable: ${malformed ? `malformed ${normalized.malformed.join(", ")}` : statusText(normalized.status)}` : `${normalized.name} · State ${normalized.raw}`,
  }));

  const metadata = [normalized.title.value, normalized.artist.value].filter(Boolean).join(" — ");
  if (!unavailable && metadata) {
    node.append(el("p", { className: "dm-device-secondary", text: metadata }));
  }

  const controls = el("div", { className: "dm-device-controls" });
  if (normalized.canPrevious) {
    controls.append(button(`Previous ${normalized.entityId}`, disabled, () => call(runtime, "media_player", "media_previous_track", { entity_id: normalized.entityId })));
  }
  if (normalized.canPlayPause) {
    controls.append(button(`Play pause ${normalized.entityId}`, disabled, () => call(runtime, "media_player", "media_play_pause", { entity_id: normalized.entityId })));
  }
  if (normalized.canNext) {
    controls.append(button(`Next ${normalized.entityId}`, disabled, () => call(runtime, "media_player", "media_next_track", { entity_id: normalized.entityId })));
  }
  if (normalized.canMute) {
    const muted = normalized.muted.status === "ok" ? normalized.muted.value : false;
    controls.append(button(`${muted ? "Unmute" : "Mute"} ${normalized.entityId}`, disabled, () => call(runtime, "media_player", "volume_mute", { entity_id: normalized.entityId, is_volume_muted: !muted })));
  }
  node.append(controls);

  if (normalized.canVolume) {
    const range = el("input", {
      attrs: {
        type: "range",
        min: "0",
        max: "1",
        step: "0.01",
        value: String(normalized.volume.value),
        "aria-label": `Volume for ${normalized.entityId}`,
        disabled: disabled ? "" : null,
      },
    });
    if (!disabled) {
      range.addEventListener("change", () => call(runtime, "media_player", "volume_set", { entity_id: normalized.entityId, volume_level: Number(range.value) }));
    }
    node.append(range);
  }

  return node;
}

export function renderCameraStatusCard(cardDef, runtime = {}) {
  const normalized = normalizeCamera(runtime, cardDef.config);
  const malformed = normalized.malformed.length > 0;
  const node = shell(CAMERA_STATUS_TYPE, cardDef.title || normalized.name, malformed ? "malformed" : normalized.status);

  node.append(
    el("p", { text: normalized.status === "ok" && !malformed ? `${normalized.name} · State ${normalized.raw}` : `Unavailable: ${malformed ? `malformed ${normalized.malformed.join(", ")}` : statusText(normalized.status)}` }),
    el("div", { className: "dm-camera-placeholder", text: "Camera preview unavailable in this card. Use Home Assistant authenticated views for imagery." }),
  );

  if (cardDef.config?.showLastChanged) {
    node.append(el("p", { className: "dm-device-secondary", text: `Last changed: ${normalized.lastChanged.value || "Unavailable"}` }));
  }

  return node;
}

export function renderFanControlCard(cardDef, runtime = {}) {
  const normalized = normalizeFan(runtime, cardDef.config);
  const malformed = normalized.malformed.length > 0;
  const unavailable = normalized.status !== "ok" || malformed;
  const disabled = unavailable || !hasService(runtime);
  const node = shell(FAN_CONTROL_TYPE, cardDef.title || normalized.name, malformed ? "malformed" : normalized.status);

  node.append(el("p", {
    text: unavailable ? `Unavailable: ${malformed ? `malformed ${normalized.malformed.join(", ")}` : statusText(normalized.status)}` : `${normalized.name} · State ${normalized.raw}`,
  }));

  if (!unavailable && normalized.presetNotInModes) {
    node.append(el("p", { className: "dm-device-secondary", text: `Preset ${normalized.preset.value} is not in preset modes.` }));
  }

  node.append(button(`Toggle ${normalized.entityId}`, disabled, () => call(runtime, "fan", "toggle", { entity_id: normalized.entityId })));

  if (normalized.canPercentage) {
    const range = el("input", {
      attrs: {
        type: "range",
        min: "0",
        max: "100",
        value: String(normalized.percentage.value),
        "aria-label": `Fan percentage for ${normalized.entityId}`,
        disabled: disabled ? "" : null,
      },
    });
    if (!disabled) {
      range.addEventListener("change", () => call(runtime, "fan", "set_percentage", { entity_id: normalized.entityId, percentage: Number(range.value) }));
    }
    node.append(range);
  }

  if (normalized.canPreset) {
    const select = el("select", {
      attrs: { "aria-label": `Fan preset for ${normalized.entityId}`, disabled: disabled ? "" : null },
    });
    for (const mode of normalized.presets.value) {
      const option = el("option", { text: mode, attrs: { value: mode } });
      option.selected = mode === normalized.preset.value;
      select.append(option);
    }
    if (!disabled) {
      select.addEventListener("change", () => call(runtime, "fan", "set_preset_mode", { entity_id: normalized.entityId, preset_mode: select.value }));
    }
    node.append(select);
  }

  if (normalized.canOscillate) {
    const oscillating = normalized.oscillating.status === "ok" ? normalized.oscillating.value : false;
    node.append(button(`${oscillating ? "Stop oscillation" : "Start oscillation"} ${normalized.entityId}`, disabled, () => call(runtime, "fan", "oscillate", { entity_id: normalized.entityId, oscillating: !oscillating })));
  }

  return node;
}

export function renderVacuumControlCard(cardDef, runtime = {}) {
  const normalized = normalizeVacuum(runtime, cardDef.config);
  const malformed = normalized.malformed.length > 0;
  const disabled = normalized.status !== "ok" || malformed || !hasService(runtime);
  const node = shell(VACUUM_CONTROL_TYPE, cardDef.title || normalized.name, malformed ? "malformed" : normalized.status);

  node.append(el("p", {
    text: normalized.status === "ok" && !malformed ? `${normalized.name} · State ${normalized.raw}` : `Unavailable: ${malformed ? `malformed ${normalized.malformed.join(", ")}` : statusText(normalized.status)}`,
  }));

  const controls = el("div", { className: "dm-device-controls" });
  if (normalized.canStart) {
    controls.append(button(`Start ${normalized.entityId}`, disabled, () => call(runtime, "vacuum", "start", { entity_id: normalized.entityId })));
  }
  if (normalized.canPause) {
    controls.append(button(`Pause ${normalized.entityId}`, disabled, () => call(runtime, "vacuum", "pause", { entity_id: normalized.entityId })));
  }
  if (normalized.canStop) {
    controls.append(button(`Stop ${normalized.entityId}`, disabled, () => call(runtime, "vacuum", "stop", { entity_id: normalized.entityId })));
  }
  if (normalized.canReturn) {
    controls.append(button(`Return ${normalized.entityId} to base`, disabled, () => call(runtime, "vacuum", "return_to_base", { entity_id: normalized.entityId })));
  }
  if (normalized.canLocate) {
    controls.append(button(`Locate ${normalized.entityId}`, disabled, () => call(runtime, "vacuum", "locate", { entity_id: normalized.entityId })));
  }
  node.append(controls);
  return node;
}

function boolInput(documentRef, labelText, value, onChange, fieldId) {
  const label = documentRef.createElement("label");
  label.textContent = `${labelText} `;
  const input = documentRef.createElement("input");
  input.type = "checkbox";
  input.checked = Boolean(value);
  input.dataset.editorField = fieldId;
  input.addEventListener("change", () => onChange(input.checked));
  label.append(input);
  return label;
}

function editor(extra = []) {
  return (documentRef, cardDef, controller, errors = []) => {
    const form = documentRef.createElement("section");
    form.className = "dashboardmodern-plugin-editor";
    form.append(textInput(documentRef, "Entity ID", cardDef.config?.entityId || "", (entityId) => controller.updateCardConfigPatch(cardDef.id, { entityId }), `card:${cardDef.id}:config.entityId`));
    for (const field of extra) {
      form.append(field(documentRef, cardDef, controller));
    }
    for (const error of errors) {
      form.append(fieldError(documentRef, error.message));
    }
    return form;
  };
}

export const renderMediaPlayerControlEditor = editor();
export const renderCameraStatusEditor = editor([
  (documentRef, cardDef, controller) => boolInput(documentRef, "Show last changed", cardDef.config?.showLastChanged, (showLastChanged) => controller.updateCardConfigPatch(cardDef.id, { showLastChanged }), `card:${cardDef.id}:config.showLastChanged`),
]);
export const renderFanControlEditor = editor();
export const renderVacuumControlEditor = editor();
