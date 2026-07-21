import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createDefaultCardRegistry } from "../src/cards/registry.js";
import { createDashboardPayload } from "../src/app.js";
import { normalizeCardLayout } from "../src/layout.js";
import { defaultBrandingConfig, PLUGIN_SCHEMA_FIELDS, THEME_TOKENS } from "../src/contracts.js";
import { buildQuickActionServicePayload, calculateAlertSummary, defaultWeatherHeroConfig, mapApplianceStatus, renderGenericApplianceCard, renderWeatherHeroCard } from "../src/cards/home-foundation.js";

function installDom(){global.document={createElement(tag){return {tagName:tag.toUpperCase(),children:[],dataset:{},style:{setProperty(k,v){this[k]=v}},attributes:{},className:"",_text:"",append(...n){this.children.push(...n)},get textContent(){return this._text+this.children.map(c=>c.textContent).join("")},set textContent(v){this._text=String(v);this.children=[]},prepend(...n){this.children.unshift(...n)},setAttribute(k,v){this.attributes[k]=String(v)},addEventListener(){}}}}}

test("legacy parity inventory exists and covers required components",()=>{const doc=readFileSync(new URL("../../../../docs/LEGACY_PARITY_INVENTORY.md",import.meta.url),"utf8"); for(const term of ["weather hero","alert summary","quick actions","generic-appliance","EV/wallbox","setup wizard","multilingual support"]) assert.match(doc,new RegExp(term,"i"));});
test("default first dashboard uses registered card types only and no placeholder",()=>{const reg=createDefaultCardRegistry(); const d=createDashboardPayload({id:"main",title:"Home"}); assert.equal(JSON.stringify(d).includes("dashboardmodern-placeholder"),false); for(const c of d.cards) assert.ok(reg.get(c.type), c.type);});
test("branding and theme contracts are persistable config",()=>{const c=defaultBrandingConfig("Casa"); assert.equal(c.branding.title,"Casa"); assert.ok(PLUGIN_SCHEMA_FIELDS.genericAppliance.includes("primaryStateEntityId")); assert.equal(THEME_TOKENS.green,"#22c55e");});
test("weather card configuration states are polished",()=>{installDom(); let node=renderWeatherHeroCard({title:"Weather",config:defaultWeatherHeroConfig()},{getEntityState(){return null}}); assert.equal(node.textContent.includes("Card type"),false); node=renderWeatherHeroCard({title:"Weather",config:{weatherEntityId:"weather.home"}},{getEntityState(){return null}}); assert.equal(node.textContent.includes("not found"),true);});
test("alert summary calculations",()=>{const rt={getEntityState:id=>({a:{state:"on"},b:{state:"off"},bat:{state:"15"}}[id]||null)}; const rows=calculateAlertSummary(rt,{alerts:[{title:"Lights",entityIds:["a","b"],condition:"on"},{title:"Battery",entityIds:["bat"],condition:"below",value:20}]}); assert.deepEqual(rows.map(r=>r.count),[1,1]);});
test("quick action service payload",()=>{const p=buildQuickActionServicePayload({action:{domain:"light",service:"turn_on",target:{entity_id:"light.kitchen"},serviceData:{brightness:100}}}); assert.deepEqual(p.data,{brightness:100,entity_id:"light.kitchen"});});
test("generic appliance status mapping and unavailable state",()=>{assert.equal(mapApplianceStatus("run",{run:"Running"}),"Running"); installDom(); const n=renderGenericApplianceCard({title:"Washer",config:{primaryStateEntityId:"sensor.washer"}},{getEntityState(){return {state:"unavailable"}}}); assert.equal(n.textContent.includes("unavailable"),true);});
test("responsive layout contract and safe unknown fallback/editor schema",()=>{const reg=createDefaultCardRegistry(); assert.ok(reg.get("weather-hero").editor); assert.ok(reg.get("alert-summary").editor); const layout=normalizeCardLayout({layout:{desktop:{columns:6,rows:2},tablet:{columns:4,rows:2},mobile:{columns:2,rows:2}}}); assert.equal(layout.status,"valid");});
