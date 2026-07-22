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
import { ENERGY_MODULE, deriveHomeLoad, gridDirection, batteryDirection, renderEnergyFlow, normalizeGrid, normalizeBattery, homeLoad, selfConsumptionPercentage, selfSufficiencyPercentage } from "../src/modules/energy.js";
import { APPLIANCES_MODULE, normalizeAppliance, renderAppliancesOverview } from "../src/modules/appliances.js";
import { MEDIA_MODULE, defaultMediaSectionConfig, filteredMedia, getMediaArtworkSource, mediaEditor, normalizeMediaPlayer, normalizeMediaState, renderMediaGroup, renderMediaFavorites, renderMediaQueue, renderMediaNowPlaying, renderMediaOverview, renderMediaProgress, validateMediaAction } from "../src/modules/media.js";
import { normalizeMeasurement } from "../src/modules/shared-measurements.js";

class Node { constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.attributes={};this.listeners={};this.style={};this._text="";this.disabled=false;this.value="";this.checked=false;this.focusCount=0;} append(...c){this.children.push(...c); for(const x of c) if(x) x.parentNode=this;} remove(){ if(this.parentNode) this.parentNode.children=this.parentNode.children.filter(c=>c!==this); } replaceChildren(...c){ this.children=[]; this.append(...c); } getAttribute(k){return this.attributes[k];} setAttribute(k,v){this.attributes[k]=String(v); if(k==="disabled")this.disabled=true; if(k==="value")this.value=String(v); if(k.startsWith("data-")) this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(v);} addEventListener(t,f){this.listeners[t]=f;} focus(){ globalThis.document.activeElement=this; this.focused=true; this.focusCount++; } querySelector(sel){return this.querySelectorAll(sel)[0]||null;} querySelectorAll(sel){const tags=sel.split(",").map(x=>x.trim()); const out=[]; const walk=n=>{if(tags.includes(n.tagName)||tags.includes(`[${Object.keys(n.attributes)[0]}]`))out.push(n); for(const c of n.children)walk(c)}; walk(this); return out;} get textContent(){return this._text+this.children.map(c=>c.textContent).join("");} set textContent(v){this._text=String(v);this.children=[];} }
const body = new Node("body");
globalThis.document = { body, activeElement:null, listeners:{}, createElement: (tag) => new Node(tag), addEventListener(t,f){this.listeners[t]=f;}, removeEventListener(t){delete this.listeners[t];}, querySelector(sel){ return sel==="[data-light-detail-host]" ? body.children.find(c=>"lightDetailHost" in c.dataset) || null : null; } };
const runtime = { hass: { states: {} }, getEntityState(id){ return this.hass.states[id] || null; }, calls: [], callService(d,s,data){ this.calls.push([d,s,data]); return Promise.resolve(); } };

test("Home and Lights modules register independently with deterministic contributions", () => {
  const manager = createPluginManager({ sectionRegistry: createSectionRegistry(), cardRegistry: createCardRegistry(), widgetRegistry: createWidgetRegistry() });
  registerBuiltInModules({ pluginManager: manager });
  assert.deepEqual(manager.listModules().map(m=>m.id), ["appliances", "cameras", "climate", "covers", "energy", "home", "lights", "media", "vehicles"]);
  assert.equal(manager.contributions().widgets.length, 68);
  assert.throws(()=>manager.registerModule(HOME_MODULE), /already registered/);
  assert.throws(()=>manager.registerModule(COVERS_MODULE), /already registered/);
  assert.throws(()=>manager.registerModule(CLIMATE_MODULE), /already registered/);
  assert.equal(LIGHTS_MODULE.defaultLayouts[0].widgets[0], "lights-overview");
  assert.equal(COVERS_MODULE.defaultLayouts[0].widgets[0], "covers-overview");
  assert.equal(CLIMATE_MODULE.defaultLayouts[0].widgets[0], "climate-overview");
  assert.equal(MEDIA_MODULE.defaultLayouts[0].widgets[0], "media-overview");
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

test("production measurement handles all units percentages currency carbon and timestamps", () => {
  runtime.hass.states = {
    "sensor.w": { state:"1000", attributes:{ unit_of_measurement:"W" }, last_updated:"2026-07-22T00:00:00Z" },
    "sensor.mw": { state:"0.002", attributes:{ unit_of_measurement:"MW" }, last_updated:"bad-date" },
    "sensor.wh": { state:"500", attributes:{ unit_of_measurement:"Wh" } },
    "sensor.mwh": { state:"0.003", attributes:{ unit_of_measurement:"MWh" } },
    "sensor.pct": { state:"101", attributes:{ unit_of_measurement:"%" } },
    "sensor.usd": { state:"12.5", attributes:{ unit_of_measurement:"USD" } },
    "sensor.carbon": { state:"383", attributes:{ unit_of_measurement:"gCO2/kWh" } },
    "sensor.future": { state:"1", attributes:{ unit_of_measurement:"kW" }, last_updated:"2099-01-01T00:00:00Z" },
    "sensor.old": { state:"1", attributes:{ unit_of_measurement:"kW" }, last_updated:"2020-01-01T00:00:00Z" }
  };
  assert.equal(normalizeMeasurement(runtime,"sensor.w",{kind:"power",unit:"kW",now:Date.parse("2026-07-22T00:00:01Z")}).normalizedValue, 1);
  assert.equal(normalizeMeasurement(runtime,"sensor.mw",{kind:"power",unit:"kW"}).reason, "timestamp-invalid");
  assert.equal(normalizeMeasurement(runtime,"sensor.wh",{kind:"energy",unit:"kWh"}).normalizedValue, 0.5);
  assert.equal(normalizeMeasurement(runtime,"sensor.mwh",{kind:"energy",unit:"kWh"}).normalizedValue, 3);
  assert.equal(normalizeMeasurement(runtime,"sensor.pct",{kind:"percent"}).reason, "percent-out-of-range");
  assert.equal(normalizeMeasurement(runtime,"sensor.usd",{kind:"currency"}).normalizedUnit, "USD");
  assert.equal(normalizeMeasurement(runtime,"sensor.carbon",{kind:"carbon"}).normalizedUnit, "gCO2/kWh");
  assert.equal(normalizeMeasurement(runtime,"sensor.future",{kind:"power"}).reason, "timestamp-future");
  assert.equal(normalizeMeasurement(runtime,"sensor.old",{kind:"power",staleAfterMs:1000,now:Date.parse("2026-07-22T00:00:00Z")}).stale, true);
});

test("production energy source models render signed separate derived failures summaries gauges and history", () => {
  runtime.hass.states = {
    "sensor.grid": { state:"-2", attributes:{ unit_of_measurement:"kW" } },
    "sensor.import": { state:"500", attributes:{ unit_of_measurement:"W" } },
    "sensor.export": { state:"0.1", attributes:{ unit_of_measurement:"kW" } },
    "sensor.battery": { state:"0.02", attributes:{ unit_of_measurement:"kW" } },
    "sensor.soc": { state:"80", attributes:{ unit_of_measurement:"%" } },
    "sensor.solar": { state:"4", attributes:{ unit_of_measurement:"kW" } },
    "sensor.home": { state:"2.5", attributes:{ unit_of_measurement:"kW" } },
    "sensor.daily": { state:"7", attributes:{ unit_of_measurement:"kWh" } }
  };
  const flow = renderEnergyFlow({ id:"f", type:"energy-flow", config:{ gridEntityId:"sensor.grid", gridSignConvention:"positive-import", batteryEntityId:"sensor.battery", batterySignConvention:"positive-discharge", batterySocEntityId:"sensor.soc", solarEntityId:"sensor.solar", homeLoadMode:"direct", homeEntityId:"sensor.home", displayUnit:"kW", deadband:0.05 } }, { ...runtime, reducedMotion:true });
  assert.match(flow.textContent, /Grid: 2.0 kW · exporting/);
  assert.match(flow.textContent, /Battery: 0.0 kW · idle/);
  assert.equal(flow.querySelector("svg").attributes["data-reduced-motion"], "true");
  const fail = deriveHomeLoad({ solarProduction:{value:1,unit:"kW"}, gridImport:{value:1,unit:"bad"}, batteryDischarge:{value:0,unit:"kW"}, gridExport:{value:0,unit:"kW"}, batteryCharge:{value:0,unit:"kW"} });
  assert.equal(fail.reason, "incompatible-unit");
  assert.equal(deriveHomeLoad({ solarProduction:{value:0,unit:"kW"} }).reason, "missing-input");
  assert.match(renderEnergySummary({ type:"energy-summary", config:{ metrics:[{id:"m",metricType:"self-sufficiency",title:"Self",values:{solarProduction:2,batteryDischarge:1,homeConsumption:2},thresholds:{warning:90}}] } }, runtime).textContent, /100.0 % · warning/);
  assert.match(renderPowerGauge({ type:"power-gauge", config:{ entityId:"sensor.solar", min:0, max:5, warning:3, critical:4, unit:"kW" } }, runtime).textContent, /critical/);
  assert.match(renderEnergyHistory({ type:"energy-history", config:{ series:[{id:"s",title:"Solar",unit:"kW",points:[{timestamp:"2026-07-22T00:00:00Z",value:1},{timestamp:"bad",value:2}]}] } }, runtime).textContent, /Solar/);
  assert.match(ENERGY_MODULE.sections[0].defaultConfig().widgets.map(w=>w.type).join(","), /energy-flow,energy-summary/);
});

import { renderEnergySummary, renderPowerGauge, renderEnergyHistory, renderBatterySummary, renderGridSummary, renderSolarSummary, openEnergyDetailPanel } from "../src/modules/energy.js";
import { renderApplianceTile, renderApplianceGroup, renderApplianceUsage, openApplianceDetailPanel, validateApplianceAction, dispatchApplianceAction, normalizeRemainingTime, aggregateMeasurements, filterAppliances } from "../src/modules/appliances.js";

test("production battery grid solar summaries and detail panels expose production fields", () => {
  const trigger = new Node("button");
  runtime.hass.states = { "sensor.soc":{state:"55",attributes:{unit_of_measurement:"%"}}, "sensor.p":{state:"2",attributes:{unit_of_measurement:"kW"}}, "sensor.e":{state:"3",attributes:{unit_of_measurement:"kWh"}}, "sensor.cost":{state:"1.2",attributes:{unit_of_measurement:"USD"}} };
  assert.match(renderBatterySummary({type:"battery-summary",config:{socEntityId:"sensor.soc",powerEntityId:"sensor.p",capacity:10,usableCapacity:8,minReserve:20}}, runtime).textContent, /reserve 20/);
  assert.match(renderGridSummary({type:"grid-summary",config:{powerEntityId:"sensor.p",dailyImportEntityId:"sensor.e",dailyExportEntityId:"sensor.e",costEntityId:"sensor.cost",tariff:"peak"}}, runtime).textContent, /Tariff: peak/);
  assert.match(renderSolarSummary({type:"solar-summary",config:{powerEntityId:"sensor.p",dailyProductionEntityId:"sensor.e",capacity:4}}, runtime).textContent, /50 %/);
  const panel = openEnergyDetailPanel({ title:"Solar", entityId:"sensor.p", displayValue:"2 kW", direction:"producing", normalizedUnit:"kW", reason:"ok" }, runtime, trigger);
  panel.querySelectorAll("button")[0].listeners.click();
  assert.equal(trigger.focused, true);
});

test("production appliances validate actions normalize states render widgets and detail cleanup", async () => {
  const trigger = new Node("button"); runtime.calls = [];
  runtime.hass.states = { "switch.washer":{state:"done",attributes:{}}, "sensor.power":{state:"400",attributes:{unit_of_measurement:"W"}}, "sensor.energy":{state:"1.5",attributes:{unit_of_measurement:"kWh"}}, "sensor.progress":{state:"bad",attributes:{unit_of_measurement:"%"}}, "sensor.remaining":{state:"12 min",attributes:{}} };
  const appliance = { id:"washer", title:"Washer", entityId:"switch.washer", powerEntityId:"sensor.power", energyEntityId:"sensor.energy", progressEntityId:"sensor.progress", remainingTimeEntityId:"sensor.remaining", completedStates:["done"], activeStates:["running"], room:"Laundry", tags:["clean"], primaryAction:{type:"switch-off",entityId:"switch.washer",title:"Off",confirm:true} };
  const normalized = normalizeAppliance(runtime, appliance);
  assert.equal(normalized.normalizedStatus, "completed");
  assert.equal(normalized.active, false);
  assert.equal(normalized.progressPercent.malformed, true);
  assert.deepEqual(validateApplianceAction({type:"switch-on",entityId:"light.bad"}), {ok:false,reason:"invalid-domain"});
  assert.equal(validateApplianceAction({type:"service",domain:"light",service:"turn_on",target:{entity_id:"light.a"},data:{brightness:1}}).ok, true);
  globalThis.confirm = () => true;
  const tile = renderApplianceTile({type:"appliance-tile",config:{appliance}}, runtime);
  await tile.querySelectorAll("button")[0].listeners.click();
  assert.deepEqual(runtime.calls[0], ["switch", "turn_off", { entity_id:"switch.washer" }]);
  assert.match(renderApplianceGroup({type:"appliance-group",config:{appliances:[appliance],groupAction:{type:"navigation",sectionId:"x",title:"Go"}}}, runtime).textContent, /completed 1/);
  assert.match(renderApplianceUsage({type:"appliance-usage",config:{appliance,costEntityId:"sensor.energy",threshold:2,series:[{points:[]}] }}, runtime).textContent, /Current power/);
  const panel = openApplianceDetailPanel(appliance, runtime, trigger);
  assert.match(panel.textContent, /Washer/);
  panel.querySelectorAll("button")[0].listeners.click();
  assert.equal(trigger.focused, true);
});

test("production appliances overview filters sorts labels and partial aggregates are local", () => {
  runtime.hass.states = {
    "switch.washer": { state:"running", attributes:{} }, "sensor.washer_power": { state:"500", attributes:{unit_of_measurement:"W"} }, "sensor.washer_energy": { state:"1", attributes:{unit_of_measurement:"kWh"} },
    "switch.dryer": { state:"off", attributes:{} }, "sensor.dryer_power": { state:"bad", attributes:{unit_of_measurement:"W"} }, "sensor.dryer_energy": { state:"2", attributes:{unit_of_measurement:"kWh"} },
    "switch.fridge": { state:"unavailable", attributes:{} }, "sensor.fridge_power": { state:"100", attributes:{unit_of_measurement:"W"} }
  };
  const appliances = [
    { id:"washer", title:"Washer", category:"washer", room:"Laundry", tags:["clean"], entityId:"switch.washer", powerEntityId:"sensor.washer_power", energyEntityId:"sensor.washer_energy", activeStates:["running"] },
    { id:"dryer", title:"Dryer", category:"dryer", room:"Laundry", tags:["dry"], entityId:"switch.dryer", powerEntityId:"sensor.dryer_power", energyEntityId:"sensor.dryer_energy" },
    { id:"fridge", title:"Fridge", category:"refrigerator", room:"Kitchen", tags:["cold"], entityId:"switch.fridge", powerEntityId:"sensor.fridge_power" }
  ];
  const normalized = appliances.map(a => normalizeAppliance(runtime, a));
  assert.deepEqual(filterAppliances(normalized,{room:"Laundry",sort:"energy",showUnavailable:true}).map(a=>a.title), ["Dryer","Washer"]);
  assert.deepEqual(filterAppliances(normalized,{tag:"clean",activeOnly:true,showUnavailable:true}).map(a=>a.id), ["washer"]);
  assert.deepEqual(filterAppliances(normalized,{category:"refrigerator",status:"unavailable",showUnavailable:true}).map(a=>a.id), ["fridge"]);
  const node = renderAppliancesOverview({type:"appliances-overview",config:{appliances,showLabels:true,showUnavailable:true,sort:"name"}}, runtime);
  assert.match(node.textContent, /Current power: 600 W · partial excluded 1/);
  assert.match(node.textContent, /Aggregate energy: 3.0 kWh · partial excluded 1/);
  const search = node.querySelectorAll("input").find(i=>i.attributes.type==="search"); search.value="washer"; search.listeners.input();
  assert.match(node.textContent, /Washer/); assert.doesNotMatch(node.textContent, /Dryer:/);
  node.querySelectorAll("button").find(b=>b.textContent==="Clear filters").listeners.click();
  assert.match(node.textContent, /Dryer/);
});

test("production appliance group bulk off filters compatible members and reports partial aggregates", async () => {
  runtime.calls = []; let confirms = 0; globalThis.confirm = () => { confirms++; return true; };
  runtime.hass.states = { "switch.a":{state:"running",attributes:{}}, "switch.b":{state:"off",attributes:{}}, "sensor.a_p":{state:"200",attributes:{unit_of_measurement:"W"}}, "sensor.b_p":{state:"bad",attributes:{unit_of_measurement:"W"}}, "sensor.a_e":{state:"1",attributes:{unit_of_measurement:"kWh"}} };
  const appliances = [{id:"a",title:"A",entityId:"switch.a",switchEntityId:"switch.a",powerEntityId:"sensor.a_p",energyEntityId:"sensor.a_e",activeStates:["running"]},{id:"b",title:"B",entityId:"switch.b",switchEntityId:"light.not_switch",powerEntityId:"sensor.b_p"}];
  const node = renderApplianceGroup({type:"appliance-group",config:{appliances,confirmBulk:true}}, runtime);
  assert.match(node.textContent, /active 1 idle 1/);
  assert.match(node.textContent, /Aggregate power: 200 W · partial excluded 1/);
  const off = node.querySelectorAll("button").find(b=>b.textContent==="Turn off compatible switches"); assert.equal(off.dataset.structuralDisabled, "false");
  await off.listeners.click();
  assert.equal(confirms, 1);
  assert.deepEqual(runtime.calls[0], ["switch", "turn_off", { entity_id:["switch.a"] }]);
});

test("production appliance tile policies display fields detail action and action errors", async () => {
  runtime.calls = []; runtime.hass.states = { "switch.a":{state:"unavailable",attributes:{}}, "sensor.p":{state:"5",attributes:{unit_of_measurement:"W"}}, "sensor.r":{state:"15",attributes:{unit_of_measurement:"min"}} };
  const hidden = renderApplianceTile({type:"appliance-tile",config:{appliance:{title:"Hidden",entityId:"switch.a",unavailablePolicy:"hide"}}}, runtime);
  assert.equal(hidden.getAttribute("hidden"), ""); assert.equal(hidden.dataset.hiddenByPolicy, "unavailable");
  const app = { title:"Tile", category:"washer", icon:"wash", entityId:"switch.a", powerEntityId:"sensor.p", remainingTimeEntityId:"sensor.r", displayFields:["power","remainingTime"], primaryAction:{type:"service",domain:"bad",service:"bad",title:"Run"} };
  const node = renderApplianceTile({type:"appliance-tile",config:{appliance:app,detailAction:true}}, {});
  assert.match(node.textContent, /Power:/); assert.doesNotMatch(node.textContent, /Energy:/); assert.match(node.textContent, /Remaining:/);
  const run = node.querySelectorAll("button").find(b=>b.textContent==="Run"); await run.listeners.click();
  assert.match(node.textContent, /runtime-call-service-unavailable/);
  const detail = node.querySelectorAll("button").find(b=>b.textContent==="Open detail"); await detail.listeners.click();
  assert.match(globalThis.document.body.textContent, /Tile/);
});

test("production appliance actions validate navigation detail toggle status entity and remaining time", async () => {
  assert.deepEqual(validateApplianceAction({type:"navigation"}), {ok:false,reason:"navigation-target-required"});
  assert.deepEqual(validateApplianceAction({type:"navigation",viewId:"v",sectionId:"s"}), {ok:false,reason:"navigation-target-required"});
  assert.deepEqual(validateApplianceAction({type:"toggle",entityId:"media_player.tv"}), {ok:false,reason:"toggle-domain-not-approved"});
  await assert.rejects(() => dispatchApplianceAction({type:"navigation",viewId:"v"}, {}), /runtime-navigation-unavailable/);
  const navCalls=[]; await dispatchApplianceAction({type:"navigation",sectionId:"s"}, { navigateToSection:id=>navCalls.push(id) }); assert.deepEqual(navCalls, ["s"]);
  runtime.hass.states = { "switch.a":{state:"on",attributes:{}}, "sensor.remaining":{state:"25",attributes:{unit_of_measurement:"min"}} };
  const badStatus = normalizeAppliance(runtime, {title:"A",entityId:"switch.a",statusEntityId:"sensor.missing"});
  assert.equal(badStatus.statusEntityProblem, "status-entity-missing"); assert.equal(badStatus.malformed, true);
  assert.equal(normalizeRemainingTime(runtime,"sensor.remaining",{unit:"min"}).displayValue, "25 min");
  const trigger = new Node("button"); await dispatchApplianceAction({type:"detail"}, runtime, {title:"Detail",entityId:"switch.a"}, trigger); assert.match(globalThis.document.body.textContent, /Detail/);
});

test("production appliance usage history thresholds and energy section defaults avoid collisions", () => {
  runtime.hass.states = { "switch.a":{state:"running",attributes:{}}, "sensor.p":{state:"600",attributes:{unit_of_measurement:"W"}}, "sensor.daily":{state:"2",attributes:{unit_of_measurement:"kWh"}}, "sensor.cycle":{state:"0.5",attributes:{unit_of_measurement:"kWh"}}, "sensor.cost":{state:"1.25",attributes:{unit_of_measurement:"USD"}} };
  const usage = renderApplianceUsage({type:"appliance-usage",config:{appliance:{title:"A",entityId:"switch.a",powerEntityId:"sensor.p",activeStates:["running"]},dailyEnergyEntityId:"sensor.daily",cycleEnergyEntityId:"sensor.cycle",costEntityId:"sensor.cost",threshold:500,points:[{timestamp:"2026-07-22T00:00:00Z",value:1},{timestamp:"bad",value:2}]}}, runtime);
  assert.match(usage.textContent, /Threshold: exceeded/); assert.match(usage.textContent, /Daily energy: 2.0 kWh/); assert.match(usage.textContent, /1.3 USD/);
  const dash={id:"d",views:[{id:"v",section_ids:[]}],sections:[],cards:[]}, gen=createIdGenerator("section");
  const eCfg=ENERGY_MODULE.sections[0].defaultConfig(), aCfg=APPLIANCES_MODULE.sections[0].defaultConfig();
  const d1=addSection(dash,"v",{type:"energy",config:eCfg},gen), d2=addSection(d1,"v",{type:"energy",config:eCfg},gen), d3=addSection(d2,"v",{type:"appliances",config:aCfg},gen), d4=addSection(d3,"v",{type:"appliances",config:aCfg},gen);
  assert.deepEqual(d4.sections.map(s=>s.id), ["section-1","section-2","section-3","section-4"]);
  const widgetIds=d4.sections.flatMap(s=>s.config.widgets.map(w=>w.id)); assert.equal(widgetIds.length, new Set(widgetIds).size); assert.equal(widgetIds.length, 6);
});

test("production energy history timeframe chart and power gauge peak validation", () => {
  runtime.hass.states = { "sensor.p":{state:"1",attributes:{unit_of_measurement:"kW"}} };
  const hist = renderEnergyHistory({type:"energy-history",config:{chartType:"bar",timeframes:["today","week"],defaultTimeframe:"today",series:[{id:"s",title:"Solar",unit:"kW",points:[{timestamp:"2026-07-22T00:00:00Z",value:1,timeframe:"today"},{timestamp:"2026-07-21T00:00:00Z",value:2,timeframe:"week"},{timestamp:"bad",value:3,timeframe:"today"}]}]}}, runtime);
  assert.equal(hist.querySelector("svg").attributes["data-chart-type"], "bar"); assert.match(hist.textContent, /Solar: bar axis left kW/); assert.doesNotMatch(hist.textContent, /2.0 kW/);
  const sel=hist.querySelectorAll("select")[0]; sel.value="week"; sel.listeners.change(); assert.match(hist.textContent, /2.0 kW/);
  assert.match(renderPowerGauge({type:"power-gauge",config:{entityId:"sensor.p",unit:"kW",peakValue:1000,peakUnit:"W"}}, runtime).textContent, /Peak: 1.0 kW/);
  assert.match(renderPowerGauge({type:"power-gauge",config:{entityId:"sensor.p",unit:"kW",peakValue:"bad",peakUnit:"W"}}, runtime).textContent, /Peak unavailable/);
});

test("final energy separate branch completeness active values and unconfigured flow", () => {
  runtime.hass.states = { "sensor.import":{state:"3",attributes:{unit_of_measurement:"kW"}}, "sensor.export":{state:"5",attributes:{unit_of_measurement:"kW"}}, "sensor.charge":{state:"4",attributes:{unit_of_measurement:"kW"}}, "sensor.discharge":{state:"1",attributes:{unit_of_measurement:"kW"}}, "sensor.bad":{state:"bad",attributes:{unit_of_measurement:"kW"}} };
  let grid = normalizeGrid(runtime,{gridModel:"separate",gridImportEntityId:"sensor.import",separateFlowPolicy:"net"});
  assert.equal(grid.complete, false); assert.deepEqual(grid.missingInputs, ["gridExport"]); assert.equal(grid.direction, "incomplete");
  grid = normalizeGrid(runtime,{gridModel:"separate",gridImportEntityId:"sensor.import",gridExportEntityId:"sensor.export",separateFlowPolicy:"net"});
  assert.equal(grid.direction, "exporting"); assert.equal(grid.activeMeasurement.entityId, "sensor.export"); assert.equal(grid.value, 2);
  const flow = renderEnergyFlow({type:"energy-flow",config:{gridModel:"separate",gridImportEntityId:"sensor.import",gridExportEntityId:"sensor.export",separateFlowPolicy:"net",displayUnit:"kW"}}, runtime);
  assert.match(flow.textContent, /Grid: 5.0 kW · exporting/);
  const batteryMissing = normalizeBattery(runtime,{batteryModel:"separate",batteryChargeEntityId:"sensor.charge"});
  assert.equal(batteryMissing.complete, false); assert.deepEqual(batteryMissing.missingInputs, ["batteryDischarge"]);
  const battery = normalizeBattery(runtime,{batteryModel:"separate",batteryChargeEntityId:"sensor.charge",batteryDischargeEntityId:"sensor.discharge",separateFlowPolicy:"net"});
  assert.equal(battery.direction, "charging"); assert.equal(battery.activeMeasurement.entityId, "sensor.charge");
  const malformed = normalizeGrid(runtime,{gridModel:"separate",gridImportEntityId:"sensor.bad",gridExportEntityId:"sensor.export",separateFlowPolicy:"net"});
  assert.equal(malformed.excludedInputs[0].reason, "malformed");
  assert.match(renderEnergyFlow({type:"energy-flow",config:{}}, runtime).textContent, /No energy entities configured/);
});

test("final energy signed derived home load and percentage physics", () => {
  runtime.hass.states = { "sensor.grid":{state:"-2",attributes:{unit_of_measurement:"kW"}}, "sensor.battery":{state:"1",attributes:{unit_of_measurement:"kW"}}, "sensor.solar":{state:"6",attributes:{unit_of_measurement:"kW"}} };
  const home = homeLoad(runtime,{homeLoadMode:"derived",solarEntityId:"sensor.solar",gridEntityId:"sensor.grid",gridSignConvention:"positive-import",batteryEntityId:"sensor.battery",batterySignConvention:"positive-charge",displayUnit:"kW"});
  assert.equal(home.complete, true); assert.equal(home.value, 3);
  assert.equal(selfConsumptionPercentage({solarProduction:5,gridExport:6}).reason, "grid-export-exceeds-solar");
  assert.equal(selfConsumptionPercentage({solarProduction:-1,gridExport:0}).reason, "invalid-solar-production");
  assert.equal(selfSufficiencyPercentage({solarProduction:1,batteryDischarge:-1,homeConsumption:2}).reason, "invalid-battery-discharge");
  assert.equal(selfSufficiencyPercentage({solarProduction:1,batteryDischarge:0,homeConsumption:0}).reason, "invalid-home-consumption");
});

test("final history structured timeframe timestamp semantics toggle/detail labels and aggregate buckets", async () => {
  runtime.hass.states = { "sensor.future":{state:"1",attributes:{unit_of_measurement:"kW"},last_updated:"2099-01-01T00:00:00Z"}, "sensor.invalid_time":{state:"1",attributes:{unit_of_measurement:"kW"},last_updated:"bad"}, "switch.a":{state:"on",attributes:{}}, "sensor.p":{state:"1",attributes:{unit_of_measurement:"W"}}, "sensor.e":{state:"1",attributes:{unit_of_measurement:"Wh"}}, "sensor.mixed":{state:"1",attributes:{unit_of_measurement:"kW"}}, "sensor.stale":{state:"1",attributes:{unit_of_measurement:"W"},last_updated:"2020-01-01T00:00:00Z"}, "sensor.bad":{state:"bad",attributes:{unit_of_measurement:"W"}} };
  const future = normalizeMeasurement(runtime,"sensor.future",{kind:"power",unit:"kW"}); assert.equal(future.available, false); assert.equal(future.malformed, true);
  const invalid = normalizeMeasurement(runtime,"sensor.invalid_time",{kind:"power",unit:"kW"}); assert.equal(invalid.reason, "timestamp-invalid"); assert.equal(invalid.available, false);
  const hist = renderEnergyHistory({type:"energy-history",config:{timeframes:["today","week"],defaultTimeframe:"today",series:[{id:"s",ranges:{today:[{timestamp:"2026-07-22T00:00:00Z",value:1}],week:[{timestamp:"2026-07-21T00:00:00Z",value:2}]},unit:"kW"}]}}, { ...runtime, datasets:{alt:{today:[{timestamp:"2026-07-22T00:00:00Z",value:4}]}} });
  assert.match(hist.textContent, /1.0 kW/); const sel = hist.querySelectorAll("select")[0]; sel.value="week"; sel.listeners.change(); assert.match(hist.textContent, /2.0 kW/); assert.doesNotMatch(hist.textContent, /1.0 kW/);
  assert.equal(validateApplianceAction({type:"toggle",entityId:"switch.a"}).ok, true);
  assert.deepEqual(validateApplianceAction({type:"toggle",entityId:"media_player.tv",domain:"media_player"}), {ok:false,reason:"toggle-domain-not-approved"});
  assert.equal(validateApplianceAction({type:"service",domain:"media_player",service:"toggle",target:{entity_id:"media_player.tv"}}).ok, true);
  await assert.rejects(() => dispatchApplianceAction({type:"detail"}, runtime, {}), /detail-appliance-required/);
  const tile = renderApplianceTile({type:"appliance-tile",config:{appliance:{title:"Labels",entityId:"switch.a",secondaryAction:{type:"navigation",sectionId:"s"}},detailAction:true}}, {navigateToSection(){}});
  assert.match(tile.textContent, /Navigate/); assert.match(tile.textContent, /Open detail/);
  const agg = aggregateMeasurements([normalizeAppliance(runtime,{entityId:"switch.a",powerEntityId:"sensor.p"}), normalizeAppliance(runtime,{entityId:"switch.a",powerEntityId:"sensor.missing"}), normalizeAppliance(runtime,{entityId:"switch.a",powerEntityId:"sensor.bad"}), normalizeAppliance(runtime,{entityId:"switch.a",powerEntityId:"sensor.stale",staleAfterMs:1000}), normalizeAppliance(runtime,{entityId:"switch.a",powerEntityId:"sensor.mixed",powerUnit:"kW"})], "currentPower", "W");
  assert.deepEqual({included:agg.included,missing:agg.missing,malformed:agg.malformed,stale:agg.stale,mixedUnit:agg.mixedUnit,partial:agg.partial}, {included:1,missing:1,malformed:1,stale:1,mixedUnit:1,partial:true});
});

test("cleanup remaining time timestamp tolerance signed values partial flow and explicit home mode", async () => {
  const now = Date.parse("2026-07-22T00:00:00Z");
  runtime.hass.states = {
    "sensor.remaining_ok": { state:"12", attributes:{ unit_of_measurement:"min" }, last_updated:"2026-07-22T00:00:03Z" },
    "sensor.remaining_future": { state:"12", attributes:{ unit_of_measurement:"min" }, last_updated:"2026-07-22T00:00:10Z" },
    "sensor.remaining_stale": { state:"12", attributes:{ unit_of_measurement:"min" }, last_updated:"2026-07-21T00:00:00Z" },
    "sensor.remaining_bad_time": { state:"12", attributes:{ unit_of_measurement:"min" }, last_updated:"bad" },
    "sensor.grid_signed": { state:"-2", attributes:{ unit_of_measurement:"kW" } },
    "sensor.battery_signed": { state:"-3", attributes:{ unit_of_measurement:"kW" } },
    "sensor.import": { state:"5", attributes:{ unit_of_measurement:"kW" } }
  };
  const ok = normalizeRemainingTime(runtime, "sensor.remaining_ok", { unit:"min", now, futureToleranceMs:5000 });
  assert.deepEqual({available:ok.available, malformed:ok.malformed, normalizedValue:ok.normalizedValue, displayValue:ok.displayValue, unit:ok.unit}, {available:true, malformed:false, normalizedValue:12, displayValue:"12 min", unit:"min"});
  const future = normalizeRemainingTime(runtime, "sensor.remaining_future", { unit:"min", now, futureToleranceMs:5000 });
  assert.deepEqual({available:future.available, malformed:future.malformed, reason:future.reason, normalizedValue:future.normalizedValue}, {available:false, malformed:true, reason:"timestamp-future", normalizedValue:null});
  const stale = normalizeRemainingTime(runtime, "sensor.remaining_stale", { unit:"min", now, staleAfterMs:1000 });
  assert.equal(stale.stale, true); assert.equal(stale.available, false);
  const badTime = normalizeRemainingTime(runtime, "sensor.remaining_bad_time", { unit:"min", now });
  assert.equal(badTime.reason, "timestamp-invalid"); assert.equal(badTime.malformed, true);
  const grid = normalizeGrid(runtime, { gridEntityId:"sensor.grid_signed", gridSignConvention:"positive-import", displayUnit:"kW" });
  assert.equal(grid.direction, "exporting"); assert.equal(grid.rawSignedValue, -2); assert.equal(grid.activeMeasurement.normalizedValue, 2); assert.equal(grid.activeMeasurement.displayValue, "2.0 kW");
  const battery = normalizeBattery(runtime, { batteryEntityId:"sensor.battery_signed", batterySignConvention:"positive-charge", displayUnit:"kW" });
  assert.equal(battery.direction, "discharging"); assert.equal(battery.rawSignedValue, -3); assert.equal(battery.activeMeasurement.displayValue, "3.0 kW");
  const partialFlow = renderEnergyFlow({type:"energy-flow",config:{gridModel:"separate",gridImportEntityId:"sensor.import",separateFlowPolicy:"allow-partial-zero",displayUnit:"kW"}}, runtime);
  assert.match(partialFlow.textContent, /partial/); assert.equal(partialFlow.querySelector("g").attributes["data-status"], "partial");
  assert.equal(homeLoad(runtime, { homeEntityId:"sensor.import" }).mode, "none");
  const direct = homeLoad(runtime, { homeMode:"direct" });
  assert.equal(direct.complete, false); assert.deepEqual(direct.missingInputs, ["homeLoad"]);
  assert.equal(validateApplianceAction({type:"detail", appliance:{}}).ok, true);
  await assert.rejects(() => dispatchApplianceAction({type:"detail", appliance:{}}, runtime, {}), /detail-appliance-required/);
});

test("cleanup invalid primary entity and minimal hidden appliance tile", () => {
  runtime.hass.states = { "switch.unavailable":{state:"unavailable",attributes:{}}, "switch.ok":{state:"off",attributes:{}} };
  const invalid = normalizeAppliance(runtime, { title:"Bad", entityId:"not valid" });
  assert.equal(invalid.primaryEntityProblem, "invalid-primary-entity-id"); assert.equal(invalid.malformed, true); assert.equal(invalid.missing, false);
  const missing = normalizeAppliance(runtime, { title:"Missing", entityId:"switch.missing" });
  assert.equal(missing.primaryEntityProblem, "primary-entity-missing"); assert.equal(missing.missing, true);
  const unavailable = normalizeAppliance(runtime, { title:"Unavailable", entityId:"switch.unavailable" });
  assert.equal(unavailable.unavailable, true); assert.equal(unavailable.primaryEntityProblem, null);
  const hidden = renderApplianceTile({type:"appliance-tile",config:{appliance:{title:"Hidden",entityId:"switch.unavailable",unavailablePolicy:"hide",powerEntityId:"sensor.never"}}}, runtime);
  assert.equal(hidden.getAttribute("hidden"), ""); assert.equal(hidden.children.length, 0); assert.equal(hidden.dataset.hiddenByPolicy, "unavailable"); assert.equal(hidden.textContent, "");
});

test("blocker textual durations metadata policies mutation future editor and toggle restriction", () => {
  const now = Date.parse("2026-07-22T00:00:00Z");
  runtime.hass.states = {
    "sensor.text_hms": { state:"01:25:00", attributes:{}, last_updated:"2026-07-22T00:00:00Z" },
    "sensor.text_hm": { state:"1h 25m", attributes:{}, last_updated:"2026-07-22T00:00:00Z" },
    "sensor.text_short": { state:"00:42", attributes:{}, last_updated:"2026-07-22T00:00:00Z" },
    "sensor.text_bad": { state:"soon", attributes:{}, last_updated:"2026-07-22T00:00:00Z" },
    "sensor.past": { state:"7", attributes:{unit_of_measurement:"min"}, last_updated:"2026-07-22T00:00:03Z" },
    "sensor.future": { state:"8", attributes:{unit_of_measurement:"kW"}, last_updated:new Date(Date.now()+3000).toISOString() },
    "sensor.import": { state:"9", attributes:{unit_of_measurement:"kW"}, last_updated:"2026-07-22T00:00:03Z" },
    "sensor.export": { state:"2", attributes:{unit_of_measurement:"kW"}, last_updated:"2026-07-22T00:00:03Z" }
  };
  const textual = normalizeRemainingTime(runtime, "sensor.text_hms", { now });
  assert.deepEqual({available:textual.available, reason:textual.reason, rawValue:textual.rawValue, normalizedValue:textual.normalizedValue, displayValue:textual.displayValue, sourceUnit:textual.sourceUnit, normalizedUnit:textual.normalizedUnit, lastUpdated:textual.lastUpdated}, {available:true, reason:"text-duration", rawValue:"01:25:00", normalizedValue:null, displayValue:"01:25:00", sourceUnit:"", normalizedUnit:"", lastUpdated:"2026-07-22T00:00:00Z"});
  assert.equal(normalizeRemainingTime(runtime, "sensor.text_hm", { now }).displayValue, "1h 25m");
  assert.equal(normalizeRemainingTime(runtime, "sensor.text_short", { now }).displayValue, "00:42");
  assert.equal(normalizeRemainingTime(runtime, "sensor.text_bad", { now }).reason, "malformed-duration");
  const numeric = normalizeRemainingTime(runtime, "sensor.past", { unit:"min", precision:0, now, futureToleranceMs:5000 });
  assert.equal(numeric.normalizedValue, 7); assert.equal(numeric.unit, "min");
  const tolerant = normalizeGrid(runtime, { gridEntityId:"sensor.future", displayUnit:"kW", futureToleranceMs:5000 });
  assert.equal(tolerant.signed.available, true); assert.equal(tolerant.signed.reason, "timestamp-ok-clock-skew");
  const strictFuture = normalizeGrid(runtime, { gridEntityId:"sensor.future", displayUnit:"kW", futureToleranceMs:1000 });
  assert.equal(strictFuture.signed.malformed, true); assert.equal(strictFuture.signed.reason, "timestamp-future");
  const strict = normalizeGrid(runtime, { gridModel:"separate", gridImportEntityId:"sensor.import", separateFlowPolicy:"strict" });
  assert.equal(strict.direction, "incomplete"); assert.equal(strict.complete, false);
  const before = normalizeGrid(runtime, { gridModel:"separate", gridImportEntityId:"sensor.import", separateFlowPolicy:"allow-partial-zero", displayUnit:"kW", futureToleranceMs:5000 });
  assert.equal(before.import.partial, undefined); assert.equal(before.activeMeasurement.partial, true); assert.equal(before.import.reason, "timestamp-ok");
  const net = normalizeGrid(runtime, { gridModel:"separate", gridImportEntityId:"sensor.import", gridExportEntityId:"sensor.export", separateFlowPolicy:"net", displayUnit:"kW", futureToleranceMs:5000 });
  assert.equal(net.complete, true); assert.equal(net.value, 7); assert.equal(net.direction, "importing");
  assert.deepEqual(validateApplianceAction({type:"toggle",entityId:"media_player.tv",domain:"media_player",service:"toggle"}), {ok:false,reason:"toggle-domain-not-approved"});
  assert.equal(validateApplianceAction({type:"service",domain:"media_player",service:"toggle",target:{entity_id:"media_player.tv"}}).ok, true);
  const updates = [], section = {id:"s"}, controller = { state:{fieldText:{},validationErrors:[]}, store:{setState(v){controller.state=v.editor;}}, updateWidget(id,wid,patch){updates.push({id,wid,...patch});} };
  const editor = renderWidgetSpecificEditor(document, section, {id:"ef",type:"energy-flow",config:{separateFlowPolicy:"strict",futureToleranceMs:5000}}, controller);
  assert.match(editor.textContent, /Future tolerance ms/); assert.match(editor.textContent, /Separate flow policy/);
  const appEditor = renderWidgetSpecificEditor(document, section, {id:"at",type:"appliance-tile",config:{appliances:[{id:"a",title:"A"}]}}, controller);
  assert.match(appEditor.textContent, /Future tolerance ms/);
});

test("cleanup shared invalid entity semantics and direct home status contract", () => {
  runtime.hass.states = {
    "sensor.available_home": { state:"1.5", attributes:{unit_of_measurement:"kW"} },
    "sensor.unavailable_home": { state:"unavailable", attributes:{unit_of_measurement:"kW"} },
    "sensor.stale_home": { state:"2", attributes:{unit_of_measurement:"kW"}, last_updated:"2026-07-21T00:00:00Z" }
  };
  const invalidMeasurement = normalizeMeasurement(runtime, "not valid", { kind:"power", unit:"kW" });
  assert.equal(invalidMeasurement.malformed, true); assert.equal(invalidMeasurement.missing, false); assert.equal(invalidMeasurement.reason, "invalid-entity-id");
  const missingMeasurement = normalizeMeasurement(runtime, "", { kind:"power", unit:"kW" });
  assert.equal(missingMeasurement.missing, true); assert.equal(missingMeasurement.reason, "missing-entity-id");
  const notFound = normalizeMeasurement(runtime, "sensor.not_found", { kind:"power", unit:"kW" });
  assert.equal(notFound.missing, true); assert.equal(notFound.reason, "entity-missing");
  const unavailableMeasurement = normalizeMeasurement(runtime, "sensor.unavailable_home", { kind:"power", unit:"kW" });
  assert.equal(unavailableMeasurement.unavailable, true); assert.equal(unavailableMeasurement.reason, "unavailable");
  const directAvailable = homeLoad(runtime, { homeMode:"direct", homeEntityId:"sensor.available_home", displayUnit:"kW" });
  assert.deepEqual({complete:directAvailable.complete, partial:directAvailable.partial, missing:directAvailable.missing, unavailable:directAvailable.unavailable, malformed:directAvailable.malformed, stale:directAvailable.stale, reason:directAvailable.reason}, {complete:true, partial:false, missing:false, unavailable:false, malformed:false, stale:false, reason:"ok"});
  const directInvalid = homeLoad(runtime, { homeMode:"direct", homeEntityId:"not valid", displayUnit:"kW" });
  assert.equal(directInvalid.malformed, true); assert.equal(directInvalid.missing, false); assert.equal(directInvalid.reason, "invalid-entity-id"); assert.equal(directInvalid.excludedInputs[0].status, "malformed");
  const directMissing = homeLoad(runtime, { homeMode:"direct", homeEntityId:"sensor.not_found", displayUnit:"kW" });
  assert.equal(directMissing.missing, true); assert.deepEqual(directMissing.missingInputs, ["homeLoad"]);
  const directUnavailable = homeLoad(runtime, { homeMode:"direct", homeEntityId:"sensor.unavailable_home", displayUnit:"kW" });
  assert.equal(directUnavailable.unavailable, true); assert.equal(directUnavailable.reason, "unavailable");
  const directStale = homeLoad(runtime, { homeMode:"direct", homeEntityId:"sensor.stale_home", displayUnit:"kW", staleAfterMs:1000, futureToleranceMs:5000 });
  assert.equal(directStale.stale, true); assert.equal(directStale.partial, true); assert.equal(directStale.reason, "timestamp-stale");
});

test("production media registers defaults unique IDs and normalizes explicit source model", () => {
  const manager = createPluginManager({ sectionRegistry: createSectionRegistry(), cardRegistry: createCardRegistry(), widgetRegistry: createWidgetRegistry() });
  manager.registerModule(MEDIA_MODULE);
  assert.equal(manager.listModules()[0].id, "media");
  assert.deepEqual(manager.contributions().widgets.map(w=>w.type), ["media-player-tile","media-now-playing","media-controls","media-volume","media-source","media-group","media-group-overview","media-favorites","media-queue","media-progress","media-artwork","media-overview","media-control-panel"]);
  const cfg = defaultMediaSectionConfig("living");
  assert.equal(cfg.widgets[0].id, "living-media-overview");
  assert.equal(cfg.widgets[1].id, "living-media-now-playing");
  assert.notEqual(cfg.widgets[0].id, cfg.widgets[1].id);
  runtime.hass.states = {
    "media_player.living": { state:"playing", attributes:{ media_title:"Song", media_artist:"Artist", media_album_name:"Album", media_duration:200, media_position:50, volume_level:0.25, is_volume_muted:false, source:"Radio" }, last_updated:"2026-07-22T00:00:00Z" },
    "sensor.title": { state:"Configured title", attributes:{}, last_updated:"2026-07-22T00:00:00Z" },
    "sensor.future": { state:"3", attributes:{}, last_updated:"2999-01-01T00:00:00Z" },
  };
  const n = normalizeMediaPlayer(runtime, { primaryEntity:"media_player.living", title:"Living", room:"Lounge", tags:["music"], mediaTitleEntity:"sensor.title", mediaPositionEntity:"sensor.future", futureToleranceMs:1 });
  assert.equal(n.primaryAvailable, true);
  assert.equal(n.operational, false);
  assert.equal(n.health, "malformed");
  assert.equal(n.sources.title.displayValue, "Configured title");
  assert.equal(n.sources.position.reason, "timestamp-future");
  assert.equal(n.sources.album.configured, true);
  assert.equal(n.progress.normalizedValue, null);
  assert.equal(normalizeMediaState("BUFFERING"), "buffering");
  assert.equal(normalizeMediaState("custom_raw"), "custom_raw");
});

test("production media handles stale optional sources progress clamping actions artwork and cleanup", async () => {
  let cleared = 0, mounted = 0, cleaned = 0;
  globalThis.setInterval = () => 7; globalThis.clearInterval = (id) => { if (id === 7) cleared++; };
  runtime.hass.states = { "media_player.den": { state:"playing", attributes:{ media_duration:100, media_position:150, volume_level:2, is_volume_muted:"off" }, last_updated:"2026-07-22T00:00:00Z" } };
  runtime.getMediaArtworkSource = () => ({ ref:"safe-art", lastUpdated:"2026-07-22T00:00:00Z" });
  runtime.mountMediaArtwork = () => { mounted++; return { cleanup(){ cleaned++; } }; };
  assert.equal(getMediaArtworkSource(runtime, { primaryEntity:"media_player.den" }).available, true);
  assert.equal(getMediaArtworkSource({ getMediaArtworkSource:()=>({ url:"https://example.invalid/x" }) }, {}).malformed, true);
  const p = renderMediaProgress({ config:{ primaryEntity:"media_player.den", interpolate:true } }, runtime);
  assert.equal(p.textContent.includes("100%"), true);
  p.cleanup(); assert.equal(cleared, 1);
  const art = renderMediaNowPlaying({ config:{ primaryEntity:"media_player.den", playbackActions:[{ type:"service", domain:"media_player", service:"explicit_play", entityId:"media_player.den" }] } }, runtime);
  assert.equal(mounted, 1); art.querySelectorAll("button").at(-1).listeners.click();
  assert.equal(runtime.calls.at(-1)[1], "explicit_play");
  assert.equal(validateMediaAction({ type:"service", domain:"media_player" }, runtime)[0].field, "service");
  assert.equal(validateMediaAction({ type:"service", domain:"media_player", service:"x" }, {}).some(e=>e.field==="runtime"), true);
  art.children.find(c=>c.className?.includes?.("dm-media-artwork"))?.cleanup?.(); assert.equal(cleaned, 1);
});

test("production media overview groups favorites queue editor detail and explicit empty states", () => {
  runtime.hass.states = {
    "media_player.a": { state:"playing", attributes:{ friendly_name:"A", volume_level:.4, is_volume_muted:true, media_title:"Alpha" }, last_updated:"2026-07-22T00:00:00Z" },
    "media_player.b": { state:"paused", attributes:{ friendly_name:"B", volume_level:.1, is_volume_muted:false, media_title:"Beta" }, last_updated:"2026-07-21T00:00:00Z" },
  };
  const cfg = { players:[{ primaryEntity:"media_player.a", title:"A", room:"Kitchen", tags:["x"], groupLeader:"media_player.a" }, { primaryEntity:"media_player.b", title:"B", room:"Den", tags:["y"] }], showUnavailable:true };
  const xs = filteredMedia({ config:{ ...cfg, roomFilter:"Kitchen", playingOnly:true, groupedOnly:true, mutedOnly:true, sort:"volume" } }, runtime);
  assert.equal(xs.length, 1); assert.equal(xs.counts.configured, 2); assert.equal(xs.counts.playing, 1); assert.equal(xs.counts.paused, 1); assert.equal(xs.counts.grouped, 1); assert.equal(xs.counts.muted, 1);
  assert.match(renderMediaOverview({ config:cfg }, runtime).textContent, /2 shown/);
  assert.match(renderMediaOverview({ config:{ players:[], showUnavailable:true } }, runtime).textContent, /No media players match/);
  assert.match(renderMediaGroup({ config:{ ...cfg.players[0], groupingActions:[] } }, runtime).textContent, /grouped/);
  assert.match(renderMediaFavorites({ config:{ favoriteRows:[{ id:"fav1", title:"Jazz", subtitle:"Late", tags:["music"], primaryAction:{ type:"navigate-view", viewId:"music" } }] } }, runtime).textContent, /Jazz/);
  assert.match(renderMediaQueue({ config:{ queueSourceMapping:{ current:{ title:"Now" }, items:[{ title:"Next", artist:"Artist", duration:12, source:"runtime" }] } } }, runtime).textContent, /Next/);
  let changed = null; const ed = mediaEditor({ players:[{ id:"stable", title:"Old" }], invalidText:"{" }, v=>{ changed=v; });
  assert.equal(ed.textContent.includes("structured editor"), true);
  ed.querySelectorAll("button").find(b=>b.textContent==="Duplicate").listeners.click();
  assert.equal(changed.players.length, 2); assert.equal(changed.players[0].id, "stable");
  ed.querySelectorAll("button").find(b=>b.textContent==="Add player").listeners.click();
  assert.equal(changed.players.at(-1).invalidText, "{");
});
