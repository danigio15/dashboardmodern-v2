import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultCardRegistry, renderUnknownCard } from "../src/cards/registry.js";
import { defaultCameraStatusConfig, defaultFanControlConfig, defaultMediaPlayerControlConfig, defaultVacuumControlConfig, normalizeCamera, normalizeFan, normalizeMediaPlayer, normalizeVacuum, renderCameraStatusCard, renderCameraStatusEditor, renderFanControlCard, renderMediaPlayerControlCard, renderVacuumControlCard, validateCameraStatusConfig, validateFanControlConfig, validateMediaPlayerControlConfig, validateVacuumControlConfig } from "../src/cards/media-device-parity.js";

class Node { constructor(tag){ this.tagName=tag; this.children=[]; this.attributes={}; this.dataset={}; this._text=""; this.value=""; this.checked=false; this.className=""; } append(...i){this.children.push(...i)} setAttribute(k,v){this.attributes[k]=String(v); if(k==="value") this.value=String(v); if(k==="disabled") this.disabled=true;} addEventListener(t,l){this[`on${t}`]=l;} click(){this.onclick?.({target:this});} get textContent(){return this._text+this.children.map(c=>c.textContent).join("");} set textContent(v){this._text=String(v); this.children=[];} querySelectorAll(sel){const out=[]; const m=n=> sel.startsWith(".")? n.className?.split?.(" ").includes(sel.slice(1)) : n.tagName===sel; const w=n=>{ if(m(n)) out.push(n); n.children.forEach(w);}; w(this); return out;} }
globalThis.document = { createElement: (tag) => new Node(tag) };
const ent=(state, attributes={})=>({state, attributes, last_changed:"2026-07-21T00:00:00Z"});
const rt=(states={}, service=true)=>({ calls:[], getEntityState:id=>states[id]||null, callService: service ? function(domain, serviceName, data){ this.calls.push([domain, serviceName, data]); } : undefined });

test("media, camera, fan and vacuum card plugins register with deterministic ordering and defaults", () => {
  const reg = createDefaultCardRegistry();
  for (const type of ["media-player-control", "camera-status", "fan-control", "vacuum-control"]) assert(reg.get(type));
  assert.deepEqual(defaultMediaPlayerControlConfig(), { entityId: "" });
  assert.deepEqual(defaultCameraStatusConfig(), { entityId: "", showLastChanged: true });
  assert.deepEqual(defaultFanControlConfig(), { entityId: "" });
  assert.deepEqual(defaultVacuumControlConfig(), { entityId: "" });
  assert.deepEqual(reg.list().map((d) => d.displayName), [...reg.list().map((d) => d.displayName)].sort((a,b)=>a.localeCompare(b)));
  assert.match(renderUnknownCard({type:"missing-card",config:{safe:true}}).textContent, /not registered/);
});

test("validators reject invalid, missing and executable card config", () => {
  for (const validate of [validateMediaPlayerControlConfig, validateFanControlConfig, validateVacuumControlConfig]) {
    assert.equal(validate([])[0].field, "config");
    assert(validate({ entityId: "" }).some((e) => e.field === "config.entityId"));
    assert(validate({ entityId: "{{ states }}" }).some((e) => /templates/.test(e.message)));
  }
  assert(validateCameraStatusConfig({entityId:"camera.front", showLastChanged:"yes"}).some((e)=>e.field === "config.showLastChanged"));
});

test("media renders metadata, filters supported controls, disables missing service and sends HA payloads", () => {
  const r = rt({"media_player.living": ent("playing", {friendly_name:"Living speaker", media_title:"Song", media_artist:"Artist", volume_level:0.25, is_volume_muted:false, supported_features:1|4|8|16|32|16384})});
  const n = normalizeMediaPlayer(r, {entityId:"media_player.living"});
  assert.equal(n.title, "Song"); assert.equal(n.canNext, true); assert.equal(n.volume, 0.25);
  const card = renderMediaPlayerControlCard({config:{entityId:"media_player.living"}}, r);
  assert.match(card.textContent, /Living speaker/); assert.match(card.textContent, /Song — Artist/);
  card.querySelectorAll("button").forEach((b)=>b.click());
  assert.deepEqual(r.calls.map((c)=>c[1]), ["media_previous_track", "media_play_pause", "media_next_track", "volume_mute"]);
  const range = card.querySelectorAll("input")[0]; range.value = "0.5"; range.onchange();
  assert.deepEqual(r.calls.at(-1), ["media_player", "volume_set", {entity_id:"media_player.living", volume_level:0.5}]);
  assert.equal(renderMediaPlayerControlCard({config:{entityId:"media_player.living"}}, rt({"media_player.living": ent("playing", {supported_features:1})}, false)).querySelectorAll("button")[0].disabled, true);
  assert.match(renderMediaPlayerControlCard({config:{entityId:"media_player.bad"}}, rt({"media_player.bad": ent("playing", {volume_level:2, supported_features:4})})).textContent, /malformed volume/);
});

test("camera status avoids image fetching controls and surfaces missing/unavailable state", () => {
  const card = renderCameraStatusCard({config:{entityId:"camera.front", showLastChanged:true}}, rt({"camera.front": ent("idle", {friendly_name:"Front camera"})}));
  assert.match(card.textContent, /Front camera/); assert.match(card.textContent, /Camera preview unavailable/); assert.match(card.textContent, /Last changed: 2026-07-21/);
  assert.equal(card.querySelectorAll("button").length, 0); assert.equal(card.querySelectorAll("iframe").length, 0);
  assert.equal(normalizeCamera(rt(), {entityId:"camera.missing"}).status, "missing-entity");
  assert.match(renderCameraStatusCard({config:{entityId:"camera.front", showLastChanged:false}}, rt({"camera.front": ent("unavailable")})).textContent, /Unavailable: unavailable/);
});

test("fan respects supported features, flags malformed values and sends service payloads", () => {
  const r = rt({"fan.bed": ent("on", {percentage:40, preset_mode:"eco", preset_modes:["eco", "boost"], oscillating:false, supported_features:2|8|16})});
  const n = normalizeFan(r, {entityId:"fan.bed"}); assert.equal(n.canPercentage, true); assert.equal(n.canPreset, true);
  const card = renderFanControlCard({config:{entityId:"fan.bed"}}, r);
  card.querySelectorAll("button")[0].click(); card.querySelectorAll("button")[1].click();
  const range = card.querySelectorAll("input")[0]; range.value="55"; range.onchange();
  const select = card.querySelectorAll("select")[0]; select.value="boost"; select.onchange();
  assert.deepEqual(r.calls, [["fan","toggle",{entity_id:"fan.bed"}], ["fan","oscillate",{entity_id:"fan.bed", oscillating:true}], ["fan","set_percentage",{entity_id:"fan.bed", percentage:55}], ["fan","set_preset_mode",{entity_id:"fan.bed", preset_mode:"boost"}]]);
  assert.match(renderFanControlCard({config:{entityId:"fan.bad"}}, rt({"fan.bad": ent("on", {percentage:120, supported_features:16})})).textContent, /malformed percentage/);
  assert.equal(renderFanControlCard({config:{entityId:"fan.bed"}}, rt({"fan.bed": ent("on", {supported_features:0})}, false)).querySelectorAll("button")[0].disabled, true);
});

test("vacuum renders only supported controls and disables without callService", () => {
  const r = rt({"vacuum.bot": ent("docked", {supported_features:4|8|16|512|8192})});
  const card = renderVacuumControlCard({config:{entityId:"vacuum.bot"}}, r);
  card.querySelectorAll("button").forEach((b)=>b.click());
  assert.deepEqual(r.calls.map((c)=>c[1]), ["start", "pause", "stop", "return_to_base", "locate"]);
  assert.equal(normalizeVacuum(rt({"vacuum.bot": ent("unknown")}), {entityId:"vacuum.bot"}).status, "unknown");
  assert.equal(renderVacuumControlCard({config:{entityId:"vacuum.bot"}}, rt({"vacuum.bot": ent("cleaning", {supported_features:8192})}, false)).querySelectorAll("button")[0].disabled, true);
});

test("camera editor uses safe structured fields and emits patches", () => {
  const patches=[]; const ctl={updateCardConfigPatch:(id,p)=>patches.push([id,p])};
  const editor = renderCameraStatusEditor(globalThis.document, {id:"c", config:{entityId:"camera.front", showLastChanged:true}}, ctl, []);
  assert.equal(editor.querySelectorAll("textarea").length, 0);
  editor.querySelectorAll("input")[0].value = "camera.back"; editor.querySelectorAll("input")[0].oninput();
  editor.querySelectorAll("input")[1].checked = false; editor.querySelectorAll("input")[1].onchange();
  assert.deepEqual(patches, [["c", {entityId:"camera.back"}], ["c", {showLastChanged:false}]]);
});
