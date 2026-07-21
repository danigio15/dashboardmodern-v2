import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultCardRegistry, renderUnknownCard } from "../src/cards/registry.js";
import {
  defaultCameraStatusConfig,
  defaultFanControlConfig,
  defaultMediaPlayerControlConfig,
  defaultVacuumControlConfig,
  normalizeCamera,
  normalizeFan,
  normalizeMediaPlayer,
  normalizeVacuum,
  renderCameraStatusCard,
  renderCameraStatusEditor,
  renderFanControlCard,
  renderMediaPlayerControlCard,
  renderVacuumControlCard,
  validateCameraStatusConfig,
  validateFanControlConfig,
  validateMediaPlayerControlConfig,
  validateVacuumControlConfig,
} from "../src/cards/media-device-parity.js";

class Node {
  constructor(tag) {
    this.tagName = tag;
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this._text = "";
    this.value = "";
    this.checked = false;
    this.className = "";
  }

  append(...items) {
    this.children.push(...items);
  }

  setAttribute(key, value) {
    this.attributes[key] = String(value);
    if (key === "value") this.value = String(value);
    if (key === "disabled") this.disabled = true;
  }

  addEventListener(type, listener) {
    this[`on${type}`] = listener;
  }

  click() {
    this.onclick?.({ target: this });
  }

  get textContent() {
    return this._text + this.children.map((child) => child.textContent).join("");
  }

  set textContent(value) {
    this._text = String(value);
    this.children = [];
  }

  querySelectorAll(selector) {
    const out = [];
    const matches = (node) => (selector.startsWith(".") ? node.className?.split?.(" ").includes(selector.slice(1)) : node.tagName === selector);
    const walk = (node) => {
      if (matches(node)) out.push(node);
      node.children.forEach(walk);
    };
    walk(this);
    return out;
  }
}

globalThis.document = { createElement: (tag) => new Node(tag) };

function ent(state, attributes = {}, lastChanged = "2026-07-21T00:00:00Z") {
  return { state, attributes, last_changed: lastChanged };
}

function rt(states = {}, service = true) {
  return {
    calls: [],
    getEntityState: (id) => states[id] || null,
    callService: service
      ? function callService(domain, serviceName, data) {
          this.calls.push([domain, serviceName, data]);
        }
      : undefined,
  };
}

test("media, camera, fan and vacuum card plugins register with deterministic ordering and defaults", () => {
  const registry = createDefaultCardRegistry();

  for (const type of ["media-player-control", "camera-status", "fan-control", "vacuum-control"]) {
    assert(registry.get(type));
  }

  assert.deepEqual(defaultMediaPlayerControlConfig(), { entityId: "" });
  assert.deepEqual(defaultCameraStatusConfig(), { entityId: "", showLastChanged: true });
  assert.deepEqual(defaultFanControlConfig(), { entityId: "" });
  assert.deepEqual(defaultVacuumControlConfig(), { entityId: "" });
  assert.deepEqual(
    registry.list().map((definition) => definition.displayName),
    [...registry.list().map((definition) => definition.displayName)].sort((a, b) => a.localeCompare(b)),
  );
  assert.match(renderUnknownCard({ type: "missing-card", config: { safe: true } }).textContent, /not registered/);
});

test("validators reject invalid, missing and executable card config", () => {
  for (const validate of [validateMediaPlayerControlConfig, validateFanControlConfig, validateVacuumControlConfig]) {
    assert.equal(validate([])[0].field, "config");
    assert(validate({ entityId: "" }).some((error) => error.field === "config.entityId"));
    assert(validate({ entityId: "{{ states }}" }).some((error) => /templates/.test(error.message)));
  }

  assert(validateCameraStatusConfig({ entityId: "camera.front", showLastChanged: "yes" }).some((error) => error.field === "config.showLastChanged"));
});

test("media parsing distinguishes missing malformed zero and optional metadata", () => {
  assert.equal(normalizeMediaPlayer(rt({ "media_player.null": ent("playing", { volume_level: null }) }), { entityId: "media_player.null" }).volume.status, "missing");
  assert.equal(normalizeMediaPlayer(rt({ "media_player.zero": ent("playing", { volume_level: "0" }) }), { entityId: "media_player.zero" }).volume.status, "ok");
  assert.equal(normalizeMediaPlayer(rt({ "media_player.bad": ent("playing", { volume_level: "loud" }) }), { entityId: "media_player.bad" }).volume.status, "malformed");
  assert.equal(normalizeMediaPlayer(rt({ "media_player.out": ent("playing", { volume_level: 2 }) }), { entityId: "media_player.out" }).volume.status, "malformed");
  assert.equal(normalizeMediaPlayer(rt({ "media_player.title": ent("playing", { media_title: { bad: true } }) }), { entityId: "media_player.title" }).title.status, "malformed");
  assert.equal(normalizeMediaPlayer(rt({ "media_player.artist": ent("playing", { media_artist: ["bad"] }) }), { entityId: "media_player.artist" }).artist.status, "malformed");
  assert.equal(normalizeMediaPlayer(rt({ "media_player.name": ent("playing", { friendly_name: [] }) }), { entityId: "media_player.name" }).friendlyName.status, "malformed");
  assert.equal(normalizeMediaPlayer(rt({ "media_player.mute": ent("playing", { is_volume_muted: "false" }) }), { entityId: "media_player.mute" }).muted.status, "malformed");
});

test("media renders metadata, filters supported controls, disables missing service and sends HA payloads", () => {
  const runtime = rt({
    "media_player.living": ent("playing", {
      friendly_name: "Living speaker",
      media_title: "Song",
      media_artist: "Artist",
      volume_level: 0.25,
      is_volume_muted: false,
      supported_features: 1 | 4 | 8 | 16 | 32 | 16384,
    }),
  });
  const card = renderMediaPlayerControlCard({ config: { entityId: "media_player.living" } }, runtime);

  assert.match(card.textContent, /Living speaker/);
  assert.match(card.textContent, /Song — Artist/);
  card.querySelectorAll("button").forEach((button) => button.click());
  assert.deepEqual(runtime.calls.map((call) => call[1]), ["media_previous_track", "media_play_pause", "media_next_track", "volume_mute"]);

  const range = card.querySelectorAll("input")[0];
  range.value = "0.5";
  range.onchange();
  assert.deepEqual(runtime.calls.at(-1), ["media_player", "volume_set", { entity_id: "media_player.living", volume_level: 0.5 }]);

  const noService = renderMediaPlayerControlCard({ config: { entityId: "media_player.living" } }, rt({ "media_player.living": ent("playing", { supported_features: 1 }) }, false));
  assert.equal(noService.querySelectorAll("button")[0].disabled, true);

  const noVolume = renderMediaPlayerControlCard({ config: { entityId: "media_player.null" } }, rt({ "media_player.null": ent("playing", { volume_level: null, supported_features: 4 }) }));
  assert.equal(noVolume.querySelectorAll("input").length, 0);
});

test("camera status avoids image fetching controls and surfaces malformed optional values", () => {
  const card = renderCameraStatusCard({ config: { entityId: "camera.front", showLastChanged: true } }, rt({ "camera.front": ent("idle", { friendly_name: "Front camera" }) }));
  assert.match(card.textContent, /Front camera/);
  assert.match(card.textContent, /Camera preview unavailable/);
  assert.match(card.textContent, /Last changed: 2026-07-21/);
  assert.equal(card.querySelectorAll("button").length, 0);
  assert.equal(card.querySelectorAll("iframe").length, 0);

  assert.equal(normalizeCamera(rt(), { entityId: "camera.missing" }).status, "missing-entity");
  assert.equal(normalizeCamera(rt({ "camera.bad_name": ent("idle", { friendly_name: {} }) }), { entityId: "camera.bad_name" }).friendlyName.status, "malformed");
  assert.equal(normalizeCamera(rt({ "camera.bad_changed": ent("idle", {}, ["bad"]) }), { entityId: "camera.bad_changed" }).lastChanged.status, "malformed");
  assert.match(renderCameraStatusCard({ config: { entityId: "camera.front", showLastChanged: false } }, rt({ "camera.front": ent("unavailable") })).textContent, /Unavailable: unavailable/);
});

test("fan parsing distinguishes missing malformed zero preset modes and oscillation", () => {
  assert.equal(normalizeFan(rt({ "fan.null": ent("on", { percentage: null }) }), { entityId: "fan.null" }).percentage.status, "missing");
  assert.equal(normalizeFan(rt({ "fan.zero": ent("on", { percentage: "0" }) }), { entityId: "fan.zero" }).percentage.value, 0);
  assert.equal(normalizeFan(rt({ "fan.bad": ent("on", { percentage: "fast" }) }), { entityId: "fan.bad" }).percentage.status, "malformed");
  assert.equal(normalizeFan(rt({ "fan.out": ent("on", { percentage: 101 }) }), { entityId: "fan.out" }).percentage.status, "malformed");
  assert.equal(normalizeFan(rt({ "fan.modes": ent("on", { preset_modes: "eco" }) }), { entityId: "fan.modes" }).presets.status, "malformed");
  assert.equal(normalizeFan(rt({ "fan.entries": ent("on", { preset_modes: ["eco", ""] }) }), { entityId: "fan.entries" }).presets.status, "malformed");
  assert.equal(normalizeFan(rt({ "fan.osc": ent("on", { oscillating: "yes" }) }), { entityId: "fan.osc" }).oscillating.status, "malformed");
  assert.equal(normalizeFan(rt({ "fan.preset": ent("on", { preset_mode: "sleep", preset_modes: ["eco"] }) }), { entityId: "fan.preset" }).presetNotInModes, true);
});

test("fan respects supported features, flags malformed values and sends service payloads", () => {
  const runtime = rt({
    "fan.bed": ent("on", {
      percentage: 40,
      preset_mode: "eco",
      preset_modes: ["eco", "boost"],
      oscillating: false,
      supported_features: 2 | 8 | 16,
    }),
  });
  const card = renderFanControlCard({ config: { entityId: "fan.bed" } }, runtime);

  card.querySelectorAll("button")[0].click();
  card.querySelectorAll("button")[1].click();
  const range = card.querySelectorAll("input")[0];
  range.value = "55";
  range.onchange();
  const select = card.querySelectorAll("select")[0];
  select.value = "boost";
  select.onchange();

  assert.deepEqual(runtime.calls, [
    ["fan", "toggle", { entity_id: "fan.bed" }],
    ["fan", "oscillate", { entity_id: "fan.bed", oscillating: true }],
    ["fan", "set_percentage", { entity_id: "fan.bed", percentage: 55 }],
    ["fan", "set_preset_mode", { entity_id: "fan.bed", preset_mode: "boost" }],
  ]);

  const filtered = renderFanControlCard({ config: { entityId: "fan.basic" } }, rt({ "fan.basic": ent("on", { supported_features: 0 }) }));
  assert.equal(filtered.querySelectorAll("input").length, 0);
  assert.equal(filtered.querySelectorAll("select").length, 0);

  const noService = renderFanControlCard({ config: { entityId: "fan.bed" } }, rt({ "fan.bed": ent("on", { supported_features: 0 }) }, false));
  assert.equal(noService.querySelectorAll("button")[0].disabled, true);
});

test("vacuum renders only supported controls, parses features and disables without callService", () => {
  const runtime = rt({ "vacuum.bot": ent("docked", { supported_features: "8732" }) });
  const card = renderVacuumControlCard({ config: { entityId: "vacuum.bot" } }, runtime);

  assert.equal(normalizeVacuum(runtime, { entityId: "vacuum.bot" }).featureSet.value, 8732);
  card.querySelectorAll("button").forEach((button) => button.click());
  assert.deepEqual(runtime.calls.map((call) => call[1]), ["start", "pause", "stop", "return_to_base", "locate"]);
  assert.equal(normalizeVacuum(rt({ "vacuum.bot": ent("unknown") }), { entityId: "vacuum.bot" }).status, "unknown");

  const noService = renderVacuumControlCard({ config: { entityId: "vacuum.bot" } }, rt({ "vacuum.bot": ent("cleaning", { supported_features: 8192 }) }, false));
  assert.equal(noService.querySelectorAll("button")[0].disabled, true);

  const badFeatures = renderVacuumControlCard({ config: { entityId: "vacuum.bad" } }, rt({ "vacuum.bad": ent("cleaning", { supported_features: "many" }) }));
  assert.match(badFeatures.textContent, /malformed supported_features/);
});

test("camera editor uses safe structured fields and emits patches", () => {
  const patches = [];
  const controller = { updateCardConfigPatch: (id, patch) => patches.push([id, patch]) };
  const editor = renderCameraStatusEditor(globalThis.document, { id: "c", config: { entityId: "camera.front", showLastChanged: true } }, controller, []);

  assert.equal(editor.querySelectorAll("textarea").length, 0);
  editor.querySelectorAll("input")[0].value = "camera.back";
  editor.querySelectorAll("input")[0].oninput();
  editor.querySelectorAll("input")[1].checked = false;
  editor.querySelectorAll("input")[1].onchange();
  assert.deepEqual(patches, [["c", { entityId: "camera.back" }], ["c", { showLastChanged: false }]]);
});
