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
import { COVERS_MODULE, normalizeCover, coverCapabilities, renderCoverTile, renderCoverGroup, renderCoversOverview, openCoverDetailPanel } from "../src/modules/covers.js";
import { CLIMATE_MODULE, normalizeClimate, climateCapabilities, renderClimateTile, renderClimateGroup, renderClimateOverview, renderClimatePanel, openClimateDetailPanel } from "../src/modules/climate.js";
import { ENERGY_MODULE, deriveHomeLoad, gridDirection, batteryDirection, renderEnergyFlow } from "../src/modules/energy.js";
import { APPLIANCES_MODULE, normalizeAppliance, renderAppliancesOverview } from "../src/modules/appliances.js";
import { normalizeMeasurement } from "../src/modules/shared-measurements.js";

class Node { constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.attributes={};this.listeners={};this.style={};this._text="";this.disabled=false;this.value="";this.checked=false;this.focusCount=0;} append(...c){this.children.push(...c); for(const x of c) if(x) x.parentNode=this;} remove(){ if(this.parentNode) this.parentNode.children=this.parentNode.children.filter(c=>c!==this); } replaceChildren(...c){ this.children=[]; this.append(...c); } getAttribute(k){return this.attributes[k];} setAttribute(k,v){this.attributes[k]=String(v); if(k==="disabled")this.disabled=true; if(k==="value")this.value=String(v); if(k.startsWith("data-")) this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(v);} addEventListener(t,f){this.listeners[t]=f;} focus(){ globalThis.document.activeElement=this; this.focused=true; this.focusCount++; } querySelector(sel){return this.querySelectorAll(sel)[0]||null;} querySelectorAll(sel){const tags=sel.split(",").map(x=>x.trim()); const out=[]; const walk=n=>{if(tags.includes(n.tagName)||tags.includes(`[${Object.keys(n.attributes)[0]}]`))out.push(n); for(const c of n.children)walk(c)}; walk(this); return out;} get textContent(){return this._text+this.children.map(c=>c.textContent).join("");} set textContent(v){this._text=String(v);this.children=[];} }
const body = new Node("body");
globalThis.document = { body, activeElement:null, listeners:{}, createElement: (tag) => new Node(tag), addEventListener(t,f){this.listeners[t]=f;}, removeEventListener(t){delete this.listeners[t];}, querySelector(sel){ return sel==="[data-light-detail-host]" ? body.children.find(c=>"lightDetailHost" in c.dataset) || null : null; } };
const runtime = { hass: { states: {} }, getEntityState(id){ return this.hass.states[id] || null; }, calls: [], callService(d,s,data){ this.calls.push([d,s,data]); return Promise.resolve(); } };

test("Home and Lights modules register independently with deterministic contributions", () => {
  const manager = createPluginManager({ sectionRegistry: createSectionRegistry(), cardRegistry: createCardRegistry(), widgetRegistry: createWidgetRegistry() });
  registerBuiltInModules({ pluginManager: manager });
  assert.deepEqual(manager.listModules().map(m=>m.id), ["appliances", "climate", "covers", "energy", "home", "lights"]);
  assert.equal(manager.contributions().widgets.length, 32);
  assert.throws(()=>manager.registerModule(HOME_MODULE), /already registered/);
  assert.throws(()=>manager.registerModule(COVERS_MODULE), /already registered/);
  assert.throws(()=>manager.registerModule(CLIMATE_MODULE), /already registered/);
  assert.equal(LIGHTS_MODULE.defaultLayouts[0].widgets[0], "lights-overview");
  assert.equal(COVERS_MODULE.defaultLayouts[0].widgets[0], "covers-overview");
  assert.equal(CLIMATE_MODULE.defaultLayouts[0].widgets[0], "climate-overview");
});



test("Energy and Appliances modules register independently with safe default layouts", () => {
  const manager = createPluginManager({ sectionRegistry: createSectionRegistry(), cardRegistry: createCardRegistry(), widgetRegistry: createWidgetRegistry() });
  manager.registerModule(ENERGY_MODULE); manager.registerModule(APPLIANCES_MODULE);
  assert.deepEqual(manager.listModules().map(m=>m.id), ["appliances", "energy"]);
  assert.equal(manager.contributions().widgets.length, 13);
  assert.throws(()=>manager.registerModule(ENERGY_MODULE), /already registered/);
  assert.equal(ENERGY_MODULE.defaultLayouts[0].widgets[0], "energy-flow");
  assert.equal(APPLIANCES_MODULE.defaultLayouts[0].widgets[0], "appliances-overview");
});

test("shared measurement and energy calculations validate units states and directions", () => {
  runtime.hass.states = { "sensor.power": { state:"1500", attributes:{ unit_of_measurement:"W", friendly_name:"Power" }, last_updated:"2026-07-22T00:00:00Z" }, "sensor.bad": { state:"NaN", attributes:{ unit_of_measurement:"W" } }, "sensor.energy": { state:"2", attributes:{ unit_of_measurement:"kWh" } } };
  assert.equal(normalizeMeasurement(runtime,"sensor.power",{kind:"power",unit:"kW",precision:2}).displayValue, "1.50 kW");
  assert.equal(normalizeMeasurement(runtime,"sensor.bad",{kind:"power",unit:"kW"}).malformed, true);
  assert.equal(normalizeMeasurement(runtime,"sensor.missing",{kind:"power"}).missing, true);
  assert.equal(gridDirection(0.01,{deadband:0.1}), "idle");
  assert.equal(gridDirection(-2,{signConvention:"positive-export"}), "importing");
  assert.equal(batteryDirection(-2,{signConvention:"positive-charge"}), "discharging");
  const derived=deriveHomeLoad({solarProduction:{value:5,unit:"kW"},gridImport:{value:1,unit:"kW"},batteryDischarge:{value:0.5,unit:"kW"},gridExport:{value:2,unit:"kW"},batteryCharge:{value:0.5,unit:"kW"}});
  assert.deepEqual({complete:derived.complete,value:derived.value,unit:derived.unit}, {complete:true,value:4,unit:"kW"});
});

test("Energy flow and appliances overview render configured runtime data only", () => {
  runtime.hass.states = { "sensor.solar": { state:"2", attributes:{ unit_of_measurement:"kW" } }, "switch.washer": { state:"running", attributes:{} }, "sensor.washer_power": { state:"400", attributes:{ unit_of_measurement:"W" } } };
  assert.match(renderEnergyFlow({ id:"ef", type:"energy-flow", config:{ solarEntityId:"sensor.solar" } }, runtime).textContent, /Solar: 2.0 kW/);
  const app={ id:"washer", title:"Washer", entityId:"switch.washer", powerEntityId:"sensor.washer_power", activeStates:["running"] };
  assert.equal(normalizeAppliance(runtime,app).normalizedStatus, "active");
  const node=renderAppliancesOverview({ id:"ao", type:"appliances-overview", config:{ appliances:[app] } }, runtime);
  assert.match(node.textContent, /Washer: active/);
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
import { addSection, createIdGenerator } from "../src/editor/commands.js";
import { EditorController } from "../src/editor/editor-controller.js";

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


test("Covers module normalization actions groups and overview use runtime only", async () => {
  runtime.calls=[]; runtime.hass.states={
    "cover.door":{state:"open",attributes:{friendly_name:"Garage",device_class:"garage",supported_features:15,current_position:120,current_tilt_position:"bad"}},
    "cover.shade":{state:"closing",attributes:{friendly_name:"Shade",supported_features:255,current_position:50,current_tilt_position:-5}},
    "cover.bad":{state:"open",attributes:null}
  };
  assert.equal(coverCapabilities(runtime.hass.states["cover.shade"]).setTiltPosition,true);
  assert.equal(normalizeCover(runtime,"cover.door").currentPosition,100);
  assert.equal(normalizeCover(runtime,"cover.shade").currentTiltPosition,0);
  assert.equal(normalizeCover(runtime,"cover.bad").status,"malformed");
  assert.equal(normalizeCover(runtime,"cover.missing").status,"missing");
  const tile=renderCoverTile({type:"cover-tile",config:{entityId:"cover.door"}},runtime);
  await tile.querySelectorAll("button").find(b=>b.textContent==="Close").listeners.click();
  assert.deepEqual(runtime.calls.at(-1),["cover","close_cover",{entity_id:"cover.door"}]);
  const group=renderCoverGroup({type:"cover-group",config:{entityIds:["cover.door","cover.shade"],sharedPositionEnabled:true,sharedTiltEnabled:true,scenes:[{entityId:"scene.movie",title:"Movie"}]}},runtime);
  assert.match(group.textContent,/2 available/);
  const sliders=group.querySelectorAll("input"); sliders[0].value="33"; await sliders[0].listeners.change(); sliders[1].value="44"; await sliders[1].listeners.change();
  assert.ok(runtime.calls.some(c=>c[1]==="set_cover_position"&&c[2].position===33));
  assert.ok(runtime.calls.some(c=>c[1]==="set_cover_tilt_position"&&c[2].tilt_position===44));
  const ov=renderCoversOverview({type:"covers-overview",config:{entityIds:["cover.door","cover.shade"],search:"garage"}},runtime);
  assert.match(ov.textContent,/Garage/); assert.doesNotMatch(ov.textContent,/Shade: closing/);
});

test("Climate module normalization actions groups and overview use runtime only", async () => {
  runtime.calls=[]; runtime.hass.states={
    "climate.hall":{state:"heat",attributes:{friendly_name:"Hall",supported_features:123,hvac_modes:["off","heat","cool"],hvac_action:"heating",current_temperature:70,temperature:100,min_temp:50,max_temp:90,target_temp_step:0.5,current_humidity:45,fan_modes:["auto"],preset_modes:["eco"],swing_modes:["on"]}},
    "climate.bed":{state:"cool",attributes:{friendly_name:"Bed",supported_features:3,hvac_modes:["off","cool"],hvac_action:"cooling",current_temperature:75,target_temp_low:40,target_temp_high:120,min_temp:60,max_temp:80,target_temp_step:1}},
    "climate.bad":{state:"heat",attributes:null}
  };
  assert.equal(climateCapabilities(runtime.hass.states["climate.hall"]).presetMode,true);
  assert.equal(normalizeClimate(runtime,"climate.hall").targetTemperature,90);
  assert.equal(normalizeClimate(runtime,"climate.bed").targetLow,60);
  assert.equal(normalizeClimate(runtime,"climate.bad").status,"malformed");
  assert.equal(normalizeClimate(runtime,"climate.missing").status,"missing");
  const tile=renderClimateTile({type:"climate-tile",config:{entityId:"climate.hall"}},runtime);
  await tile.querySelectorAll("button").find(b=>b.textContent==="Turn off").listeners.click();
  assert.deepEqual(runtime.calls.at(-1),["climate","turn_off",{entity_id:"climate.hall"}]);
  const group=renderClimateGroup({type:"climate-group",config:{entityIds:["climate.hall","climate.bed"],permittedModes:["heat"]}},runtime);
  assert.match(group.textContent,/1 heating/); await group.querySelectorAll("button").find(b=>b.textContent==="Set heat").listeners.click();
  assert.deepEqual(runtime.calls.at(-1),["climate","set_hvac_mode",{entity_id:"climate.hall",hvac_mode:"heat"}]);
  const ov=renderClimateOverview({type:"climate-overview",config:{entityIds:["climate.hall","climate.bed"],search:"hall"}},runtime);
  assert.match(ov.textContent,/Hall/); assert.doesNotMatch(ov.textContent,/Bed: cool/);
});


test("Covers and Climate visual editors expose production fields and preserve invalid text", () => {
  const updates=[]; const controller={ state:{ validationErrors:[], fieldText:{} }, store:{ setState(s){ controller.state=s.editor; } }, updateWidget(s,w,p){ updates.push(p); } };
  const section={ id:"s" };
  const cover=renderWidgetSpecificEditor(document,section,{ id:"cw", type:"cover-tile", config:{ entityId:"cover.good", tags:["a"] } },controller);
  assert.match(cover.textContent,/Cover entity/); assert.match(cover.textContent,/Quick controls/);
  const coverInput=cover.querySelectorAll("input").find(i=>i.dataset.editorField==="widget:cw:entityId"); coverInput.value="climate.bad"; coverInput.listeners.input();
  assert.equal(controller.state.fieldText["widget:cw:entityId"],"climate.bad"); assert.match(controller.state.validationErrors[0].message,/cover/);
  const climate=renderWidgetSpecificEditor(document,section,{ id:"ct", type:"climate-control-panel", config:{ entityId:"climate.good", temperatureStep:0.5 } },controller);
  assert.match(climate.textContent,/Preferred temperature step/);
  const step=climate.querySelectorAll("input").find(i=>i.dataset.editorField==="widget:ct:temperatureStep"); step.value="0"; step.listeners.input();
  assert.equal(controller.state.fieldText["widget:ct:temperatureStep"],"0"); assert.ok(controller.state.validationErrors.some(e=>/positive/.test(e.message)));
});

test("generic section creation accepts registered types with default widget layout", () => {
  const dash={ id:"d", views:[{id:"v",section_ids:[]}], sections:[], cards:[] }, gen=createIdGenerator("section",[1]);
  const next=addSection(dash,"v",{type:"covers",title:"Covers",config:{widgets:[{id:"covers-overview-default",type:"covers-overview",config:{entityIds:[]},layout:{size:"full"}}]}},gen);
  assert.equal(next.sections[0].id,"section-1"); assert.equal(next.sections[0].type,"covers"); assert.deepEqual(next.sections[0].card_ids,[]); assert.equal(next.sections[0].config.widgets[0].type,"covers-overview"); assert.equal(next.sections[0].config.widgets[0].id,"section-1-widget-1");
  const standard=addSection(next,"v",{},gen); assert.equal(standard.sections[1].id,"section-2"); assert.equal(standard.sections[1].card_ids.length,0);
});

test("overview controls support local filters sorting disabled bulk and clear", async () => {
  runtime.calls=[]; runtime.hass.states={
    "cover.a":{state:"open",attributes:{friendly_name:"Awning",supported_features:15,current_position:80}},
    "cover.b":{state:"closed",attributes:{friendly_name:"Blind",supported_features:0,current_position:10}},
    "climate.a":{state:"off",attributes:{friendly_name:"Hall",supported_features:1,hvac_modes:["off","heat"],current_temperature:70,temperature:69}},
    "climate.b":{state:"heat",attributes:{friendly_name:"Bedroom",supported_features:1,hvac_modes:["off","heat"],hvac_action:"heating",current_temperature:65,temperature:66}}
  };
  const covers=renderCoversOverview({type:"covers-overview",config:{entityIds:["cover.a","cover.b"],rooms:{"cover.a":"Patio","cover.b":"Bedroom"},tags:{"cover.a":["shade"]},room:"Patio",confirmBulk:true}},runtime);
  assert.match(covers.textContent,/Awning/); assert.doesNotMatch(covers.textContent,/Blind/);
  const clear=covers.querySelectorAll("button").find(b=>b.textContent==="Clear filters"); clear.listeners.click(); assert.match(covers.textContent,/Blind/);
  const stop=covers.querySelectorAll("button").find(b=>b.textContent==="Stop all"); assert.equal(stop.disabled,true);
  globalThis.confirm=()=>true; await covers.querySelectorAll("button").find(b=>b.textContent==="Open all").listeners.click(); assert.ok(runtime.calls.some(c=>c[1]==="open_cover"));
  const climate=renderClimateOverview({type:"climate-overview",config:{entityIds:["climate.a","climate.b"],hvacAction:"heating",confirmAllOff:true}},runtime);
  assert.match(climate.textContent,/Bedroom/); assert.doesNotMatch(climate.textContent,/Hall: off/); await climate.querySelectorAll("button").find(b=>b.textContent==="Turn all off").listeners.click(); assert.ok(runtime.calls.some(c=>c[1]==="turn_off"&&c[2].entity_id==="climate.b"));
});


test("shared detail panel replaces across Lights Covers and Climate with exact focus restoration", () => {
  body.replaceChildren(); let removed=0; const originalRemove=globalThis.document.removeEventListener; globalThis.document.removeEventListener=function(t){removed++; originalRemove.call(this,t);};
  const lightTrigger=new Node("button"), coverTrigger=new Node("button"), climateTrigger=new Node("button");
  runtime.hass.states={
    "light.one":{state:"on",attributes:{friendly_name:"Light",supported_color_modes:[]}},
    "cover.one":{state:"open",attributes:{friendly_name:"Cover",supported_features:15}},
    "climate.one":{state:"heat",attributes:{friendly_name:"Climate",supported_features:1,hvac_modes:["off","heat"],temperature:70}}
  };
  const light=openLightDetailPanel("light.one",runtime,lightTrigger); assert.match(light.textContent,/Light detail/);
  const cover=openCoverDetailPanel("cover.one",runtime,coverTrigger); assert.match(cover.textContent,/Cover detail/); assert.equal(lightTrigger.focusCount,1);
  const climate=openClimateDetailPanel("climate.one",runtime,climateTrigger); assert.match(climate.textContent,/Climate detail/); assert.equal(coverTrigger.focusCount,1);
  globalThis.document.listeners.keydown({key:"Escape",preventDefault(){}}); globalThis.document.listeners.keydown?.({key:"Escape",preventDefault(){}});
  assert.equal(climateTrigger.focusCount,1); assert.ok(removed>=1); globalThis.document.removeEventListener=originalRemove;
});

test("bulk confirmations cover groups climate groups range and unique default widget ids", async () => {
  let confirms=0; globalThis.confirm=()=>{confirms++;return true;}; runtime.calls=[]; runtime.hass.states={
    "cover.a":{state:"opening",attributes:{supported_features:255,current_position:20,current_tilt_position:30}},"cover.b":{state:"closed",attributes:{supported_features:255,current_position:80,current_tilt_position:60}},
    "climate.a":{state:"heat",attributes:{supported_features:19,hvac_modes:["off","heat"],temperature:70,min_temp:60,max_temp:80,target_temp_step:0.5,temperature_unit:"°F",preset_modes:["eco"]}},
    "climate.b":{state:"heat",attributes:{supported_features:19,hvac_modes:["off","heat"],temperature:71,min_temp:65,max_temp:75,target_temp_step:1,temperature_unit:"°F",preset_modes:["eco"]}}
  };
  const cg=renderCoverGroup({type:"cover-group",config:{entityIds:["cover.a","cover.b"],sharedPositionEnabled:true,sharedTiltEnabled:true,confirmBulk:true}},runtime);
  assert.equal(cg.attributes["data-mixed-state"],"true"); assert.equal(cg.attributes["data-mixed-tilt"],"true");
  await cg.querySelectorAll("button").find(b=>b.textContent==="Open group").listeners.click();
  await cg.querySelectorAll("button").find(b=>b.textContent==="Stop moving").listeners.click();
  const sliders=cg.querySelectorAll("input"); assert.equal(sliders[0].value,"50"); assert.equal(sliders[1].value,"45"); await sliders[0].listeners.change(); await sliders[1].listeners.change();
  const ng=renderCoverGroup({type:"cover-group",config:{nativeEntityId:"cover.a"}},runtime); assert.equal(ng.attributes["data-native-mode"],"true"); assert.match(ng.textContent,/Native cover group/);
  const clg=renderClimateGroup({type:"climate-group",config:{entityIds:["climate.a","climate.b"],permittedModes:["heat"],permittedPresets:["eco"],bulkTemperatureEnabled:true,bulkRangeEnabled:true,confirmBulk:true}},runtime);
  await clg.querySelectorAll("button").find(b=>b.textContent==="Turn all off").listeners.click(); await clg.querySelectorAll("button").find(b=>b.textContent==="Set heat").listeners.click(); await clg.querySelectorAll("button").find(b=>b.textContent==="Preset eco").listeners.click();
  const nums=clg.querySelectorAll("input"); assert.equal(nums[0].attributes.min,"65"); assert.equal(nums[0].attributes.max,"75"); nums[0].value="70"; await nums[0].listeners.change(); nums[1].value="66"; nums[2].value="74"; await nums[2].listeners.change();
  assert.ok(confirms>=8); assert.ok(runtime.calls.some(c=>c[1]==="set_cover_tilt_position")); assert.ok(runtime.calls.some(c=>c[1]==="set_preset_mode")); assert.ok(runtime.calls.some(c=>c[2].target_temp_low===66&&c[2].target_temp_high===74));
  const dash={id:"d",views:[{id:"v",section_ids:[]}],sections:[],cards:[]},gen=createIdGenerator("section",[10]); const a=addSection(dash,"v",{type:"covers",config:{widgets:[{type:"covers-overview",config:{},layout:{size:"full"}}]}},gen); const b=addSection(a,"v",{type:"covers",config:{widgets:[{type:"covers-overview",config:{},layout:{size:"full"}}]}},gen); assert.notEqual(b.sections[0].config.widgets[0].id,b.sections[1].config.widgets[0].id);
});

test("climate derived filters current selectors aux and mixed-unit rejection", async () => {
  runtime.calls=[]; runtime.hass.states={
    "climate.x":{state:"eco_heat",attributes:{friendly_name:"X",supported_features:121,hvac_modes:["eco_heat"],hvac_action:"defrost",temperature:20,min_temp:10,max_temp:30,target_temp_step:0.1,temperature_unit:"°C",fan_modes:["auto","high"],fan_mode:"high",preset_modes:["away"],preset_mode:"away",swing_modes:["both"],swing_mode:"both",aux_heat:"on"}},
    "climate.y":{state:"heat",attributes:{supported_features:1,hvac_modes:["heat"],temperature:70,min_temp:60,max_temp:80,target_temp_step:1,temperature_unit:"°F"}}
  };
  const ov=renderClimateOverview({type:"climate-overview",config:{entityIds:["climate.x"],hvacMode:"eco_heat",hvacAction:"defrost"}},runtime);
  assert.ok(ov.querySelectorAll("option").some(o=>o.value==="eco_heat")); assert.ok(ov.querySelectorAll("option").some(o=>o.value==="defrost"));
  const panel=renderClimatePanel({type:"climate-control-panel",config:{entityId:"climate.x"}},runtime);
  const selects=panel.querySelectorAll("select"); assert.ok(selects.some(s=>s.children.some(o=>o.value==="eco_heat"&&o.selected))); assert.ok(selects.some(s=>s.children.some(o=>o.value==="high"&&o.selected))); assert.ok(selects.some(s=>s.children.some(o=>o.value==="away"&&o.selected))); assert.ok(selects.some(s=>s.children.some(o=>o.value==="both"&&o.selected)));
  assert.equal(panel.querySelectorAll("button").find(b=>b.textContent==="Aux heat on").disabled,true);
  const group=renderClimateGroup({type:"climate-group",config:{entityIds:["climate.x","climate.y"],bulkTemperatureEnabled:true}},runtime); const input=group.querySelectorAll("input")[0]; assert.equal(input.disabled,true); assert.match(group.textContent,/Mixed units/);
});

test("structured scene and mapping editors keep stable rows and validation blocking", () => {
  const updates=[]; const controller={state:{validationErrors:[],fieldText:{}},store:{setState(s){controller.state=s.editor;}},updateWidget(s,w,p){updates.push(p);}}; const section={id:"s"};
  const sceneEditor=renderWidgetSpecificEditor(document,section,{id:"g",type:"cover-group",config:{scenes:[{id:"scene-row",title:"Movie",entityId:"scene.movie"}]}},controller); assert.match(sceneEditor.textContent,/Scene row ID/); const badScene=sceneEditor.querySelectorAll("input").find(i=>i.dataset.editorField==="widget:g:scenes.0.entityId"); badScene.value="script.bad"; badScene.listeners.input(); assert.equal(controller.state.fieldText["widget:g:scenes.0.entityId"],"script.bad");
  const mapEditor=renderWidgetSpecificEditor(document,section,{id:"ov",type:"climate-overview",config:{rooms:{"climate.good":"Hall"},tags:{"climate.good":["main"]}}},controller); assert.match(mapEditor.textContent,/Mapping row ID/); const badMap=mapEditor.querySelectorAll("input").find(i=>i.dataset.editorField==="widget:ov:mappings.0.entityId"); badMap.value="cover.bad"; badMap.listeners.input(); assert.equal(controller.state.fieldText["widget:ov:mappings.0.entityId"],"cover.bad"); assert.ok(controller.state.validationErrors.length>=2);
});


test("bulk confirmation cancel paths skip services and confirm paths execute", async () => {
  let allow=false, confirms=0; globalThis.confirm=()=>{confirms++;return allow;}; runtime.calls=[]; runtime.hass.states={
    "cover.c":{state:"opening",attributes:{supported_features:255,current_position:10,current_tilt_position:20}},
    "climate.c":{state:"heat",attributes:{supported_features:19,hvac_modes:["off","heat"],temperature:70,min_temp:60,max_temp:80,target_temp_step:1,temperature_unit:"°F",preset_modes:["eco"]}}
  };
  const cov=renderCoverGroup({type:"cover-group",config:{entityIds:["cover.c"],sharedPositionEnabled:true,sharedTiltEnabled:true,confirmBulk:true,scenes:[{id:"s1",title:"Movie",entityId:"scene.movie"}]}},runtime);
  await cov.querySelectorAll("button").find(b=>b.textContent==="Open group").listeners.click(); await cov.querySelectorAll("button").find(b=>b.textContent==="Movie").listeners.click(); cov.querySelectorAll("input")[0].value="50"; await cov.querySelectorAll("input")[0].listeners.change(); assert.equal(runtime.calls.length,0);
  allow=true; await cov.querySelectorAll("button").find(b=>b.textContent==="Open group").listeners.click(); await cov.querySelectorAll("button").find(b=>b.textContent==="Movie").listeners.click(); assert.ok(runtime.calls.some(c=>c[1]==="open_cover")); assert.ok(runtime.calls.some(c=>c[0]==="scene"));
  allow=false; runtime.calls=[]; const overview=renderCoversOverview({type:"covers-overview",config:{entityIds:["cover.c"],confirmBulk:true}},runtime); await overview.querySelectorAll("button").find(b=>b.textContent==="Stop all").listeners.click(); assert.equal(runtime.calls.length,0); allow=true; await overview.querySelectorAll("button").find(b=>b.textContent==="Stop all").listeners.click(); assert.ok(runtime.calls.some(c=>c[1]==="stop_cover"));
  allow=false; runtime.calls=[]; const cl=renderClimateGroup({type:"climate-group",config:{entityIds:["climate.c"],permittedModes:["heat"],permittedPresets:["eco"],bulkTemperatureEnabled:true,bulkRangeEnabled:true,confirmBulk:true}},runtime);
  await cl.querySelectorAll("button").find(b=>b.textContent==="Set heat").listeners.click(); await cl.querySelectorAll("button").find(b=>b.textContent==="Preset eco").listeners.click(); const nums=cl.querySelectorAll("input"); nums[0].value="71"; await nums[0].listeners.change(); nums[1].value="65"; nums[2].value="75"; await nums[2].listeners.change(); assert.equal(runtime.calls.length,0); assert.ok(confirms>=7);
});

test("bulk range rejects mixed units and invalid low high with visible errors", async () => {
  runtime.calls=[]; runtime.hass.states={
    "climate.f":{state:"heat",attributes:{supported_features:2,hvac_modes:["heat"],target_temp_low:60,target_temp_high:75,min_temp:55,max_temp:80,target_temp_step:0.5,temperature_unit:"°F"}},
    "climate.c":{state:"heat",attributes:{supported_features:2,hvac_modes:["heat"],target_temp_low:18,target_temp_high:23,min_temp:10,max_temp:30,target_temp_step:0.1,temperature_unit:"°C"}}
  };
  const mixed=renderClimateGroup({type:"climate-group",config:{entityIds:["climate.f","climate.c"],bulkRangeEnabled:true}},runtime); assert.equal(mixed.querySelectorAll("input")[0].disabled,true); assert.match(mixed.textContent,/Mixed units/);
  runtime.hass.states["climate.c"].attributes.temperature_unit="°F"; runtime.hass.states["climate.c"].attributes.min_temp=60; runtime.hass.states["climate.c"].attributes.max_temp=80;
  const group=renderClimateGroup({type:"climate-group",config:{entityIds:["climate.f","climate.c"],bulkRangeEnabled:true}},runtime); const inputs=group.querySelectorAll("input"); assert.equal(inputs[0].attributes.min,"60"); assert.equal(inputs[0].attributes.max,"80"); assert.equal(inputs[0].attributes.step,"0.5"); inputs[0].value="78"; inputs[1].value="70"; await inputs[1].listeners.change(); assert.match(group.textContent,/Low target/); assert.equal(runtime.calls.length,0);
});

test("structured mappings persist IDs through edit reorder and migration", () => {
  const updates=[]; const controller={state:{validationErrors:[],fieldText:{}},store:{setState(s){controller.state=s.editor;}},updateWidget(s,w,p){updates.push(p);}}; const section={id:"s"};
  const editor=renderWidgetSpecificEditor(document,section,{id:"ovp",type:"covers-overview",config:{mappings:[{id:"row-a",entityId:"cover.a",room:"A",tags:["one"]},{id:"row-b",entityId:"cover.b",room:"B",tags:[]}] }},controller);
  editor.querySelectorAll("input").find(i=>i.dataset.editorField==="widget:ovp:mappings.0.room").value="AA"; editor.querySelectorAll("input").find(i=>i.dataset.editorField==="widget:ovp:mappings.0.room").listeners.input(); assert.equal(updates.at(-1).config.mappings[0].id,"row-a");
  editor.querySelectorAll("button").find(b=>b.textContent==="Down").listeners.click(); assert.deepEqual(updates.at(-1).config.mappings.map(m=>m.id),["row-b","row-a"]);
  const migrated=renderWidgetSpecificEditor(document,section,{id:"ovm",type:"covers-overview",config:{rooms:{"cover.x":"X"},tags:{"cover.x":["tag"]}}},controller); assert.match(migrated.textContent,/Mapping row ID/); migrated.querySelectorAll("button").find(b=>b.textContent==="Add mapping").listeners.click(); assert.ok(updates.at(-1).config.mappings.at(-1).id.startsWith("mapping-"));
});

test("registered section creation avoids widget collisions and save cancel semantics remain", async () => {
  const dash={id:"d",views:[{id:"v",section_ids:[]}],sections:[{id:"existing",config:{widgets:[{id:"section-1-widget-1"}]},card_ids:[]}],cards:[]},gen=createIdGenerator("section",[1]);
  const cfg={widgets:[{type:"covers-overview",config:{},layout:{size:"full"}},{type:"cover-tile",config:{entityId:""},layout:{size:"small"}}]}; const a=addSection(dash,"v",{type:"covers",config:cfg},gen); const b=addSection(a,"v",{type:"covers",config:cfg},gen); const c=addSection(b,"v",{type:"climate",config:{widgets:[{type:"climate-overview",config:{},layout:{size:"full"}}]}},gen); const d=addSection(c,"v",{type:"climate",config:{widgets:[{type:"climate-overview",config:{},layout:{size:"full"}}]}},gen);
  assert.deepEqual(d.sections.slice(1).map(s=>s.id),["section-1","section-2","section-3","section-4"]); assert.equal(new Set(d.sections.flatMap(s=>s.config?.widgets?.map(w=>w.id)||[])).size,7); assert.equal(d.sections[1].config.widgets.length,2);
  let active=d; const store={state:{activeDashboard:active,activeDashboardId:"d",editor:null,error:null},setState(p){this.state={...this.state,...p};},setMode(mode){this.state.mode=mode;},async replaceDashboard(next){active=next;this.state.activeDashboard=next;}}; const controller=new EditorController(store); await controller.enter(); controller.addSection("v",{type:"covers",config:cfg}); assert.equal(store.state.editor.dirty,true); await controller.cancel(); assert.equal(store.state.editor.editing,false); await controller.enter(); controller.addSection("v",{type:"covers",config:cfg}); assert.equal(store.state.editor.dirty,true); assert.ok(store.state.editor.draftDashboard.sections.some(s=>s.type==="covers"));
});
