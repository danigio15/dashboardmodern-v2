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

class Node { constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.attributes={};this.listeners={};this.style={};this._text="";this.disabled=false;this.value="";this.checked=false;this.focusCount=0;} append(...c){this.children.push(...c); for(const x of c) if(x) x.parentNode=this;} remove(){ if(this.parentNode) this.parentNode.children=this.parentNode.children.filter(c=>c!==this); } replaceChildren(...c){ this.children=[]; this.append(...c); } getAttribute(k){return this.attributes[k];} setAttribute(k,v){this.attributes[k]=String(v); if(k==="disabled")this.disabled=true; if(k==="value")this.value=String(v); if(k.startsWith("data-")) this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(v);} addEventListener(t,f){this.listeners[t]=f;} focus(){ globalThis.document.activeElement=this; this.focused=true; this.focusCount++; } querySelector(sel){return this.querySelectorAll(sel)[0]||null;} querySelectorAll(sel){const tags=sel.split(",").map(x=>x.trim()); const out=[]; const walk=n=>{if(tags.includes(n.tagName)||tags.includes(`[${Object.keys(n.attributes)[0]}]`))out.push(n); for(const c of n.children)walk(c)}; walk(this); return out;} get textContent(){return this._text+this.children.map(c=>c.textContent).join("");} set textContent(v){this._text=String(v);this.children=[];} }
const body = new Node("body");
globalThis.document = { body, activeElement:null, listeners:{}, createElement: (tag) => new Node(tag), addEventListener(t,f){this.listeners[t]=f;}, removeEventListener(t){delete this.listeners[t];}, querySelector(sel){ return sel==="[data-light-detail-host]" ? body.children.find(c=>"lightDetailHost" in c.dataset) || null : null; } };
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
import { filteredLights, normalizeColorTemperature, supportedLightData, renderLightGroup, renderLightsOverview, openLightDetailPanel, renderLightTile, createLightActionState } from "../src/modules/lights.js";
import { renderWidgetSpecificEditor } from "../src/editor/widget-editor.js";

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


test("structured editors expose distinct fields and collision-safe row IDs", () => {
  const updates=[]; const controller={ state:{ validationErrors:[], fieldText:{} }, store:{ setState(s){ controller.state=s.editor; } }, updateWidget(s,w,p){ updates.push(p); } };
  const section={ id:"s" };
  const alertEditor=renderWidgetSpecificEditor(document,section,{ id:"alerts", type:"alerts-summary", config:{ rules:[{ id:"rules-1", title:"Door", operator:"on", entityId:"binary_sensor.door", severity:"warning" }] } },controller);
  assert.match(alertEditor.textContent, /Operator/); assert.match(alertEditor.textContent, /Severity/);
  const favEditor=renderWidgetSpecificEditor(document,section,{ id:"fav", type:"favorites", config:{ items:[{ id:"items-1", kind:"view", targetId:"v" }] } },controller);
  assert.match(favEditor.textContent, /Type/);
  const add = favEditor.querySelectorAll("button")[0]; add.listeners.click();
  assert.notEqual(updates.at(-1).config.items.at(-1).id, "items-1");
});

test("Lights overview runtime controls update local filters", () => {
  runtime.hass.states = { "light.a": { state:"on", attributes:{ friendly_name:"Kitchen", supported_color_modes:["brightness"] } }, "light.b": { state:"off", attributes:{ friendly_name:"Bedroom", supported_color_modes:[] } } };
  const node = renderLightsOverview({ id:"ov", type:"lights-overview", config:{ entityIds:["light.a","light.b"], rooms:{"light.a":"Kitchen","light.b":"Bedroom"}, tags:{"light.a":["main"]}, sort:"name" } }, runtime);
  const search = node.querySelectorAll("input").find(i=>i.attributes.type==="search"); search.value="bed"; search.listeners.input();
  assert.match(node.textContent, /Bedroom/); assert.doesNotMatch(node.textContent, /Kitchen: on/);
});

test("group brightness uses shared pending/error state and mixed aggregate", async () => {
  runtime.calls=[]; runtime.hass.states = { "light.a": { state:"on", attributes:{ brightness:64, supported_color_modes:["brightness"] } }, "light.b": { state:"on", attributes:{ brightness:200, supported_color_modes:["brightness"] } } };
  const node = renderLightGroup({ id:"g", type:"light-group", config:{ entityIds:["light.a","light.b"], showBrightness:true } }, runtime);
  const slider = node.querySelectorAll("input")[0]; assert.equal(slider.dataset.mixed, "true"); slider.value="50"; await slider.listeners.change();
  assert.deepEqual(runtime.calls.map(c=>c[2].brightness), [128,128]);
});

test("light detail panel focus trap Escape restoration and color bounds", () => {
  const trigger = new Node("button"); runtime.hass.states = { "light.rgbww": { state:"on", attributes:{ friendly_name:"RGBWW", supported_color_modes:["rgbww","hs"], rgbww_color:[1,2,3,4,5], hs_color:[10,50] } } };
  const panel = openLightDetailPanel("light.rgbww", runtime, trigger);
  assert.match(panel.textContent, /RGBWW color/);
  const inputs = panel.querySelectorAll("input"); assert.ok(inputs.some(i=>i.attributes["aria-label"]==="WW"));
  globalThis.document.listeners.keydown({ key:"Escape" });
  assert.equal(trigger.focused, true);
  assert.equal(globalThis.document.listeners.keydown, undefined);
});


test("distinct editors update schema-specific fields without conflating type kind and operator", () => {
  const updates=[]; const controller={ state:{ validationErrors:[], fieldText:{} }, store:{ setState(s){ controller.state=s.editor; } }, updateWidget(s,w,p){ updates.push(p); } };
  const section={ id:"s" };
  const metric=renderWidgetSpecificEditor(document,section,{ id:"status", type:"home-status", config:{ metrics:[{ id:"m1", title:"Temp", entityIds:["sensor.temp"], operator:"equals", expected:"72" }] } },controller);
  assert.match(metric.textContent, /Entity IDs/); assert.match(metric.textContent, /Expected/);
  const metricSelect=metric.querySelectorAll("select")[0]; metricSelect.value="numeric-above"; metricSelect.listeners.change();
  assert.equal(updates.at(-1).config.metrics[0].operator, "numeric-above"); assert.equal(updates.at(-1).config.metrics[0].type, undefined);
  const alert=renderWidgetSpecificEditor(document,section,{ id:"alerts", type:"alerts-summary", config:{ rules:[{ id:"r1", entityId:"binary_sensor.door", operator:"on", severity:"warning", action:{type:"service"}, navigationTarget:{} }] } },controller);
  assert.match(alert.textContent, /Icon/); assert.match(alert.textContent, /Message/); assert.match(alert.textContent, /Navigation section/);
  const quick=renderWidgetSpecificEditor(document,section,{ id:"qa", type:"quick-actions", config:{ actions:[{ id:"a1", type:"service", title:"Run", domain:"light", service:"turn_on", badge:"!", accent:"blue", confirm:true }] } },controller);
  assert.match(quick.textContent, /Domain/); assert.match(quick.textContent, /Service data/); assert.match(quick.textContent, /Badge/);
  const favorite=renderWidgetSpecificEditor(document,section,{ id:"fav", type:"favorites", config:{ items:[{ id:"f1", kind:"view", targetId:"view-1", primaryAction:{ type:"navigate-view", viewId:"view-1" } }] } },controller);
  assert.match(favorite.textContent, /Target ID/); assert.match(favorite.textContent, /Missing policy/);
});

test("editor validation marks invalid entity fields and repeated add IDs do not collide", () => {
  const updates=[]; const controller={ state:{ validationErrors:[], fieldText:{} }, store:{ setState(s){ controller.state=s.editor; } }, updateWidget(s,w,p){ updates.push(p); } };
  const section={ id:"s" }, widget={ id:"status", type:"home-status", config:{ metrics:[] } };
  const editor=renderWidgetSpecificEditor(document,section,widget,controller); const add=editor.querySelectorAll("button")[0]; add.listeners.click(); add.listeners.click();
  assert.notEqual(updates[0].config.metrics[0].id, updates[1].config.metrics[0].id);
  const withRow=renderWidgetSpecificEditor(document,section,{...widget,config:updates.at(-1).config},controller);
  for (const inp of withRow.querySelectorAll("input")) { inp.value="invalid, light.ok"; inp.listeners.input?.(); if (controller.state.validationErrors.length) break; }
  assert.equal(controller.state.validationErrors.length, 1);
});

test("light action state reads current disabled state and restores structural disabled correctly", async () => {
  const host = new Node("div"), control = new Node("button"); let calls=0; const state=createLightActionState(control,host,async()=>{calls++;});
  control.disabled=true; assert.equal(await state.execute(), false); assert.equal(calls, 0);
  control.disabled=false; assert.equal(await state.execute(), true); assert.equal(control.disabled, false);
  control.dataset.structuralDisabled="true"; assert.equal(await state.execute(), false); assert.equal(control.disabled, false);
  assert.match(host.textContent, /^$/);
});

test("Lights overview respects labels clear-sort policy and all-off disabled updates", () => {
  runtime.hass.states = { "light.a": { state:"off", attributes:{ friendly_name:"Kitchen", supported_color_modes:[] } } };
  const node = renderLightsOverview({ id:"ov2", type:"lights-overview", config:{ entityIds:["light.a"], rooms:{"light.a":"Kitchen"}, tags:{"light.a":["main"]}, showLabels:false, sort:"room", search:"Kitchen" } }, runtime);
  assert.doesNotMatch(node.textContent, /Room Kitchen/);
  const buttons=node.querySelectorAll("button"), allOff=buttons.find(b=>b.textContent==="Turn all off"), clear=buttons.find(b=>b.textContent==="Clear filters (keep sort)");
  assert.equal(allOff.disabled, true); clear.listeners.click();
  assert.equal(node.querySelectorAll("select").find(s=>s.attributes["aria-label"]==="Sort lights").value, "room");
});

test("color previews include white channels with accessible labels", () => {
  runtime.hass.states = { "light.rgbw": { state:"on", attributes:{ friendly_name:"RGBW", supported_color_modes:["rgbw"], rgbw_color:[1,2,3,4] } }, "light.rgbww": { state:"on", attributes:{ friendly_name:"RGBWW", supported_color_modes:["rgbww"], rgbww_color:[5,6,7,8,9] } } };
  const rgbw=renderLightTile({ id:"w", type:"light-tile", config:{ entityId:"light.rgbw" } }, runtime);
  const rgbww=renderLightTile({ id:"ww", type:"light-tile", config:{ entityId:"light.rgbww" } }, runtime);
  assert.match(rgbw.textContent, /W 4/); assert.match(rgbww.textContent, /CW 8/); assert.match(rgbww.textContent, /WW 9/);
});

test("detail panel traps Tab in both directions skips disabled and cleanup is idempotent", () => {
  body.replaceChildren(); const trigger = new Node("button"); runtime.hass.states = { "light.rgb": { state:"on", attributes:{ friendly_name:"RGB", supported_color_modes:["rgb"], rgb_color:[1,2,3] } } };
  const panel = openLightDetailPanel("light.rgb", runtime, trigger); const focusables=panel.querySelectorAll("button,input,select").filter(x=>!x.disabled);
  globalThis.document.activeElement=focusables.at(-1); let prevented=0; panel.listeners.keydown({ key:"Tab", preventDefault(){prevented++;} }); assert.equal(globalThis.document.activeElement, focusables[0]);
  globalThis.document.activeElement=focusables[0]; panel.listeners.keydown({ key:"Tab", shiftKey:true, preventDefault(){prevented++;} }); assert.equal(globalThis.document.activeElement, focusables.at(-1));
  globalThis.document.listeners.keydown({ key:"Escape" }); globalThis.document.listeners.keydown?.({ key:"Escape" });
  assert.equal(trigger.focusCount, 1); assert.equal(globalThis.document.listeners.keydown, undefined); assert.equal(body.children.length, 0); assert.equal(prevented, 2);
});
