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
import { renderHomeHero, renderWeatherSummary, renderQuickActions, renderFavorites } from "../src/modules/home.js";
import { filteredLights, normalizeColorTemperature, supportedLightData } from "../src/modules/lights.js";

test("Home hero consumes showDate showTime greetingText and locale", () => {
  const node = renderHomeHero({ id:"hero", type:"home-hero", config:{ title:"Casa", greetingText:"Hola", showDate:true, showTime:true } }, { locale:"es-ES" });
  assert.match(node.textContent, /Casa/); assert.match(node.textContent, /Hola/);
});

test("Weather respects displayedFields and forecast rendering", () => {
  runtime.hass.states = { "weather.home": { state:"sunny", attributes:{ temperature: 21, apparent_temperature: 20, humidity: 44, temperature_unit:"°C", forecast:[{ datetime:"2026-07-22", condition:"rainy", temperature:19 }] } } };
  const node = renderWeatherSummary({ id:"w", type:"weather-summary", config:{ entityId:"weather.home", displayedFields:["condition","humidity","forecast"] } }, runtime);
  assert.match(node.textContent, /Condition: sunny/); assert.match(node.textContent, /Humidity: 44%/); assert.match(node.textContent, /rainy/); assert.doesNotMatch(node.textContent, /Feels like/);
});

test("Home Status supports all required operators", () => {
  runtime.hass.states = { "sensor.n": { state:"5", attributes:{} }, "person.a": { state:"home", attributes:{} }, "switch.a": { state:"off", attributes:{} }, "light.a": { state:"on", attributes:{} }, "sensor.u": { state:"unavailable", attributes:{} } };
  const metrics = aggregateHomeStatus({ metrics:[
    { id:"eq", entityIds:["sensor.n"], rules:[{ operator:"equals", expected:5 }] }, { id:"ne", entityIds:["sensor.n"], rules:[{ operator:"not-equals", expected:6 }] }, { id:"on", entityIds:["light.a"], rules:[{ operator:"on" }] }, { id:"off", entityIds:["switch.a"], rules:[{ operator:"off" }] }, { id:"home", entityIds:["person.a"], rules:[{ operator:"home" }] }, { id:"un", entityIds:["sensor.u"], rules:[{ operator:"unavailable" }] }, { id:"above", entityIds:["sensor.n"], rules:[{ operator:"numeric-above", expected:4 }] }, { id:"below", entityIds:["sensor.n"], rules:[{ operator:"numeric-below", expected:6 }] }
  ] }, runtime);
  assert.deepEqual(Object.values(metrics).map(m=>m.count), [1,1,1,1,1,1,1,1]);
});

test("Quick action failure preserves label and exposes live error", async () => {
  const node = renderQuickActions({ id:"qa", type:"quick-actions", config:{ actions:[{ title:"Fail", type:"service", domain:"x", service:"y" }] } }, { callService(){ return Promise.reject(new Error("boom")); } });
  const button = node.querySelectorAll("button")[0]; await button.listeners.click(); assert.equal(button.textContent, "Fail"); assert.match(node.textContent, /boom/);
});

test("Favorites render missing entity and non-entity targets", () => {
  runtime.hass.states = {}; const node = renderFavorites({ id:"fav", type:"favorites", config:{ items:[{ kind:"entity", entityId:"light.missing", title:"Missing" }, { kind:"view", targetId:"lights", title:"Lights view" }] } }, runtime);
  assert.match(node.textContent, /Missing/); assert.match(node.textContent, /Lights view/);
});

test("Lights overview search filters and sorting consume saved config", () => {
  runtime.hass.states = { "light.b": { state:"off", attributes:{ friendly_name:"Bedroom", area:"Room B" } }, "light.a": { state:"on", attributes:{ friendly_name:"Kitchen", area:"Room A" } } };
  const out = filteredLights({ config:{ entityIds:["light.b","light.a"], search:"kit", stateFilter:"on", sort:"name", rooms:{"light.a":"Kitchen"}, tags:{"light.a":["main"]}, tag:"main" } }, runtime);
  assert.deepEqual(out.map(l=>l.entityId), ["light.a"]);
});

test("Light service data covers RGBW RGBWW HS XY and Kelvin/mired color temperatures", () => {
  const base = { capabilities:{ brightness:true,colorTemp:true,rgb:true,rgbw:true,rgbww:true,hs:true,xy:true,effects:true,transition:true }, attributes:{ min_color_temp_kelvin:2000, max_color_temp_kelvin:6500, effect_list:["rainbow"] } };
  assert.equal(supportedLightData(base,{ brightnessPct:50 }).brightness, 128);
  assert.equal(supportedLightData(base,{ colorTemp:7000 }).color_temp_kelvin, 6500);
  assert.deepEqual(supportedLightData(base,{ rgbw:[1,2,3,4] }).rgbw_color, [1,2,3,4]);
  assert.deepEqual(supportedLightData(base,{ rgbww:[1,2,3,4,5] }).rgbww_color, [1,2,3,4,5]);
  assert.deepEqual(supportedLightData(base,{ hs:[370,120] }).hs_color, [360,100]);
  assert.deepEqual(supportedLightData(base,{ xy:[1.2,-1] }).xy_color, [1,0]);
  assert.deepEqual(normalizeColorTemperature({ attributes:{ min_mireds:153, max_mireds:500, color_temp:200 } }), { mode:"mired", field:"color_temp", min:153, max:500, value:200 });
});
