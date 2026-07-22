import assert from "node:assert/strict";
import test from "node:test";
import { createPluginManager } from "../src/plugins/registry.js";
import { createSectionRegistry } from "../src/sections/registry.js";
import { createCardRegistry } from "../src/cards/registry.js";
import { createWidgetRegistry } from "../src/widgets/registry.js";
import { renderWidget } from "../src/widgets/runtime.js";
import { HOME_MODULE, evaluateAlertRule, aggregateHomeStatus } from "../src/modules/home.js";
import { LIGHTS_MODULE, lightCapabilities, normalizeLight, summarizeLights } from "../src/modules/lights.js";
import { registerBuiltInModules } from "../src/modules/bootstrap.js";

class Node { constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.attributes={};this.listeners={};this.style={};this._text="";} append(...c){this.children.push(...c);} setAttribute(k,v){this.attributes[k]=String(v); if(k.startsWith("data-")) this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(v);} addEventListener(t,f){this.listeners[t]=f;} querySelectorAll(sel){const out=[]; const walk=n=>{if(sel==="button"&&n.tagName==="button")out.push(n); for(const c of n.children)walk(c)}; walk(this); return out;} get textContent(){return this._text+this.children.map(c=>c.textContent).join("");} set textContent(v){this._text=String(v);this.children=[];} }
globalThis.document = { createElement: (tag) => new Node(tag) };
const runtime = { hass: { states: {} }, getEntityState(id){ return this.hass.states[id] || null; }, calls: [], callService(d,s,data){ this.calls.push([d,s,data]); return Promise.resolve(); } };

test("Home and Lights modules register independently with deterministic contributions", () => {
  const manager = createPluginManager({ sectionRegistry: createSectionRegistry(), cardRegistry: createCardRegistry(), widgetRegistry: createWidgetRegistry() });
  registerBuiltInModules({ pluginManager: manager });
  assert.deepEqual(manager.listModules().map(m=>m.id), ["home", "lights"]);
  assert.equal(manager.contributions().widgets.length, 11);
  assert.throws(()=>manager.registerModule(HOME_MODULE), /already registered/);
  assert.equal(LIGHTS_MODULE.defaultLayouts[0].widgets[0], "lights-overview");
});

test("widget runtime renders registered widgets and safe unknown fallback", () => {
  const registry = createWidgetRegistry(); registry.register({ type:"known", displayName:"Known", renderer:()=>{ const n=document.createElement("article"); n.textContent="Known rendered"; return n; }, defaultConfig:()=>({}) });
  assert.match(renderWidget({ id:"w", type:"known", config:{} }, {}, registry).textContent, /Known rendered/);
  assert.match(renderWidget({ id:"x", type:"missing", config:{ nested: { ok: true } } }, {}, registry).textContent, /Unsupported widget type/);
});

test("Home alerts operators and status aggregation are deterministic and safe", () => {
  runtime.hass.states = { "light.kitchen": { state:"on", attributes:{} }, "binary_sensor.door": { state:"off", attributes:{} }, "sensor.temp": { state:"72", attributes:{} } };
  assert.equal(evaluateAlertRule({ enabled:true, entityId:"light.kitchen", operator:"on" }, runtime), true);
  assert.equal(evaluateAlertRule({ enabled:true, entityId:"sensor.temp", operator:"numeric-above", expected:70 }, runtime), true);
  assert.equal(evaluateAlertRule({ enabled:true, entityId:"sensor.temp", operator:"numeric-below", expected:"bad" }, runtime), false);
  const metrics = aggregateHomeStatus({ metrics:[{ id:"lights", entityIds:["light.kitchen"] }, { id:"doors", entityIds:["binary_sensor.door"], inactiveState:"off" }] }, runtime);
  assert.equal(metrics.lights.count, 1); assert.equal(metrics.doors.count, 0);
});

test("Lights capabilities, malformed states, groups, and actions use runtime abstraction", async () => {
  runtime.calls = []; runtime.hass.states = { "light.rgbw": { state:"on", attributes:{ friendly_name:"RGBW", brightness:128, supported_color_modes:["rgbw"], rgbw_color:[1,2,3,4], effect_list:["rainbow"] } }, "light.ct": { state:"off", attributes:{ supported_color_modes:["color_temp"], color_temp:200 } }, "light.bad": { state:"on", attributes:null } };
  assert.equal(lightCapabilities(runtime.hass.states["light.rgbw"]).rgbw, true);
  assert.equal(lightCapabilities(runtime.hass.states["light.ct"]).colorTemp, true);
  assert.equal(normalizeLight(runtime,"light.bad").status, "malformed");
  assert.deepEqual(summarizeLights(runtime,["light.rgbw","light.ct","light.missing"]), { lights: summarizeLights(runtime,["light.rgbw","light.ct","light.missing"]).lights, total:3, active:1, unavailable:1 });
  const node = LIGHTS_MODULE.widgets.find(w=>w.type==="light-tile").renderer({ id:"w", type:"light-tile", config:{ entityId:"light.rgbw" } }, runtime);
  await node.querySelectorAll("button")[0].listeners.click();
  assert.deepEqual(runtime.calls[0], ["light", "turn_off", { entity_id:"light.rgbw" }]);
});
