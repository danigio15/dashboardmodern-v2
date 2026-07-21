import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultCardRegistry } from "../src/cards/registry.js";
import { normalizeClimate, normalizeLight, normalizeCover, renderClimateControlCard, renderLightControlCard, renderSwitchControlCard, renderCoverControlCard, renderSensorStatusCard, validateClimateControlConfig, validateLightControlConfig, validateSwitchControlConfig, validateCoverControlConfig, validateSensorStatusConfig, defaultClimateControlConfig, defaultLightControlConfig, defaultSwitchControlConfig, defaultCoverControlConfig, defaultSensorStatusConfig, renderLightControlEditor, renderSwitchControlEditor } from "../src/cards/device-controls.js";

class Node { constructor(tag){ this.tagName=tag; this.children=[]; this.attributes={}; this.dataset={}; this._text=""; this.value=""; this.checked=false; } append(...i){this.children.push(...i)} setAttribute(k,v){this.attributes[k]=String(v); if(k==="value") this.value=String(v); if(k==="disabled") this.disabled=true;} addEventListener(t,l){this[`on${t}`]=l;} click(){this.onclick?.({target:this});} get textContent(){return this._text+this.children.map(c=>c.textContent).join("");} set textContent(v){this._text=String(v); this.children=[];} querySelectorAll(sel){const out=[]; const m=n=> sel.startsWith(".")? n.className?.split?.(" ").includes(sel.slice(1)) : n.tagName===sel; const w=n=>{ if(m(n)) out.push(n); n.children.forEach(w);}; w(this); return out;} }
globalThis.document = { createElement: (tag) => new Node(tag) };
const ent=(state, attributes={})=>({state, attributes});
const rt=(states={})=>({ locale:"en-US", calls:[], getEntityState:id=>states[id]||null, callService(domain, service, data){ this.calls.push([domain, service, data]); }});

test("device card plugins register and default configs keep empty entity IDs", () => {
  const reg = createDefaultCardRegistry();
  for (const t of ["climate-control","light-control","switch-control","cover-control","sensor-status"]) assert(reg.get(t));
  assert.deepEqual(defaultClimateControlConfig().entityId, "");
  assert.deepEqual(defaultLightControlConfig().entityId, "");
  assert.deepEqual(defaultSwitchControlConfig().entityId, "");
  assert.deepEqual(defaultCoverControlConfig().entityId, "");
  assert.deepEqual(defaultSensorStatusConfig().entityId, "");
});

test("validators reject malformed, arrays, invalid booleans/numbers/enums and executable strings", () => {
  assert.equal(validateClimateControlConfig([])[0].field, "config");
  assert(validateClimateControlConfig({entityId:"{{ states }}", temperatureStep:1}).some(e=>/templates/.test(e.message)));
  assert(validateClimateControlConfig({entityId:"sensor.ok", temperatureStep:99}).some(e=>e.field==="config.temperatureStep"));
  assert(validateLightControlConfig({entityId:"light.k", showBrightness:"yes"}).some(e=>e.field==="config.showBrightness"));
  assert(validateSwitchControlConfig({entityId:"switch.k", secondaryInfo:"script"}).some(e=>e.field==="config.secondaryInfo"));
  assert(validateCoverControlConfig({entityId:"cover.k", showPosition:1}).some(e=>e.field==="config.showPosition"));
  assert(validateSensorStatusConfig({entityId:"sensor.k", secondaryInfo:"html"}).some(e=>e.field==="config.secondaryInfo"));
});

test("climate normalizes temperatures, units, humidity, bad states and interactions", () => {
  const r=rt({"climate.home":ent("heat",{current_temperature:"68",temperature:70,temperature_unit:"°F",current_humidity:45,hvac_action:"heating",hvac_modes:["off","heat"]})});
  const n=normalizeClimate(r,{entityId:"climate.home",temperatureStep:0.5});
  assert.equal(n.unit,"°F"); assert.equal(n.humidity.value,45); assert.equal(n.target.value,70);
  const card=renderClimateControlCard({title:"Thermostat",config:{entityId:"climate.home",temperatureStep:0.5}},r);
  assert.match(card.textContent,/68 °F/); assert.match(card.textContent,/Humidity 45 %/);
  card.querySelectorAll("button")[1].click(); assert.deepEqual(r.calls[0],["climate","set_temperature",{entity_id:"climate.home",temperature:70.5}]);
  assert.equal(normalizeClimate(rt({"climate.bad":ent("heat",{current_temperature:"bad"})}),{entityId:"climate.bad",temperatureStep:1}).malformed,true);
  assert.equal(normalizeClimate(rt({"climate.u":ent("unavailable")}),{entityId:"climate.u",temperatureStep:1}).status,"unavailable");
});

test("light and switch toggles, brightness boundaries and disabled unavailable states", () => {
  const r=rt({"light.kitchen":ent("on",{brightness:0}),"switch.fan":ent("off")});
  assert.equal(normalizeLight(r,{entityId:"light.kitchen"}).brightness,0);
  const light=renderLightControlCard({config:{entityId:"light.kitchen",showBrightness:true}},r); light.querySelectorAll("button")[0].click(); assert.equal(r.calls[0][1],"toggle");
  assert.equal(normalizeLight(rt({"light.bad":ent("on",{brightness:300})}),{entityId:"light.bad"}).brightnessStatus,"malformed");
  assert.equal(renderLightControlCard({config:{entityId:"light.bad",showBrightness:true}},rt({"light.bad":ent("on",{brightness:300})})).attributes["data-status"],"malformed");
  const sw=renderSwitchControlCard({config:{entityId:"switch.fan",secondaryInfo:"none"}},r); sw.querySelectorAll("button")[0].click(); assert.equal(r.calls[1][0],"switch");
  const unavailable=renderLightControlCard({config:{entityId:"light.none",showBrightness:true}},rt()); assert.equal(unavailable.querySelectorAll("button")[0].disabled,true);
  const noService=renderSwitchControlCard({config:{entityId:"switch.fan",secondaryInfo:"none"}},{locale:"en-US",getEntityState:id=>({state:"on",attributes:{}})}); assert.equal(noService.querySelectorAll("button")[0].disabled,true);
});

test("cover supports open close stop and valid optional position only", () => {
  const r=rt({"cover.garage":ent("opening",{current_position:50,supported_features:11})});
  assert.equal(normalizeCover(r,{entityId:"cover.garage"}).position,50);
  const c=renderCoverControlCard({config:{entityId:"cover.garage",showPosition:true}},r); assert.match(c.textContent,/opening/); assert.match(c.textContent,/Position 50%/);
  c.querySelectorAll("button").forEach(b=>b.click()); assert.deepEqual(r.calls.map(c=>c[1]),["open_cover","close_cover","stop_cover"]);
  assert.equal(normalizeCover(rt({"cover.bad":ent("open",{current_position:101})}),{entityId:"cover.bad"}).position,null);
  assert.equal(renderCoverControlCard({config:{entityId:"cover.position",showPosition:true}},rt({"cover.position":ent("open",{current_position:10,supported_features:4})})).querySelectorAll("button").length,0);
});

test("sensor is read only, preserves zero, and formats arbitrary units", () => {
  const s=renderSensorStatusCard({title:"Temp",config:{entityId:"sensor.temp",secondaryInfo:"none"}},rt({"sensor.temp":ent("0",{unit_of_measurement:"ppm"})}));
  assert.match(s.textContent,/0 ppm/); assert.equal(s.querySelectorAll("button").length,0);
  const u=renderSensorStatusCard({config:{entityId:"sensor.u",secondaryInfo:"none"}},rt({"sensor.u":ent("unknown",{unit_of_measurement:"W"})})); assert.match(u.textContent,/Unavailable/);
  const changed=renderSensorStatusCard({config:{entityId:"sensor.changed",secondaryInfo:"last_changed"}},rt({"sensor.changed":{state:"1",last_changed:"2026-07-21T00:00:00Z",attributes:{}}})); assert.match(changed.textContent,/Last changed: 2026-07-21/);
});

test("structured editors expose only controlled plugin fields", () => {
  const patches=[]; const ctl={updateCardConfigPatch:(id,p)=>patches.push([id,p])};
  const light=renderLightControlEditor(globalThis.document,{id:"l",config:{entityId:"light.a",showBrightness:true}},ctl,[]);
  assert.equal(light.querySelectorAll("input").length,2);
  const sw=renderSwitchControlEditor(globalThis.document,{id:"s",config:{entityId:"switch.a",secondaryInfo:"none"}},ctl,[]);
  assert.equal(sw.querySelectorAll("select").length,1);
});
