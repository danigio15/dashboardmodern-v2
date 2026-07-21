import assert from "node:assert/strict";
import test from "node:test";
import { createCardRegistry, registerBuiltInCardTypes, renderUnknownCard } from "../src/cards/registry.js";
import * as cards from "../src/cards/security-access-presence.js";

class Node { constructor(tag){this.tagName=tag;this.children=[];this.attributes={};this.dataset={};this._text="";this.value="";this.checked=false;this.className="";} append(...i){this.children.push(...i);} setAttribute(k,v){this.attributes[k]=String(v); if(k==="disabled")this.disabled=true; if(k==="value")this.value=String(v);} addEventListener(t,f){this[`on${t}`]=f;} click(){this.onclick?.({target:this});} get textContent(){return this._text+this.children.map(c=>c.textContent).join("");} set textContent(v){this._text=String(v);this.children=[];} querySelectorAll(sel){const out=[];const m=n=>sel.startsWith(".")?n.className?.split?.(" ").includes(sel.slice(1)):n.tagName===sel; const w=n=>{if(m(n))out.push(n);n.children.forEach(w)}; w(this); return out;} }
globalThis.document={createElement:t=>new Node(t)};
const ent=(state,attributes={},last_changed="2026-07-21T00:00:00Z")=>({state,attributes,last_changed});
function rt(states={}, svc=true){return {calls:[], getEntityState:id=>states[id]||null, callService: svc ? function(d,s,data){this.calls.push([d,s,data]);}: undefined};}

const defs = [
 [cards.LOCK_CONTROL_TYPE,cards.defaultLockControlConfig,cards.validateLockControlConfig,cards.renderLockControlEditor,"lock.front"],
 [cards.ALARM_CONTROL_TYPE,cards.defaultAlarmControlConfig,cards.validateAlarmControlConfig,cards.renderAlarmControlEditor,"alarm_control_panel.home"],
 [cards.BINARY_SENSOR_STATUS_TYPE,cards.defaultBinarySensorStatusConfig,cards.validateBinarySensorStatusConfig,cards.renderBinarySensorStatusEditor,"binary_sensor.door"],
 [cards.PERSON_STATUS_TYPE,cards.defaultPersonStatusConfig,cards.validatePersonStatusConfig,cards.renderPersonStatusEditor,"person.alice"],
 [cards.DEVICE_TRACKER_STATUS_TYPE,cards.defaultDeviceTrackerStatusConfig,cards.validateDeviceTrackerStatusConfig,cards.renderDeviceTrackerStatusEditor,"device_tracker.phone"],
];

test("security access presence defaults validators registry fallback and editors",()=>{
 const reg=registerBuiltInCardTypes(createCardRegistry());
 for (const [type,def,validate,editor,entityId] of defs) {
  assert(reg.get(type)); assert.equal(def().entityId,""); assert.equal(validate({entityId}).length,0); assert(validate({entityId:"sensor.bad"}).some(e=>/domain/.test(e.message)));
  const patches=[]; const form=editor(globalThis.document,{id:"c",config:{entityId}},{updateCardConfigPatch:(id,p)=>patches.push([id,p])},[]);
  assert.equal(form.querySelectorAll("textarea").length,0); assert.doesNotMatch(form.textContent,/service|code|pin|json|template|html/i);
  const inputs=form.querySelectorAll("input"); inputs[0].value=entityId; inputs[0].oninput?.(); inputs[0].onchange?.(); if(inputs[1]){inputs[1].checked=true; inputs[1].onchange();} assert(patches.length>=1);
 }
 assert.deepEqual(reg.list().map(d=>d.displayName),[...reg.list().map(d=>d.displayName)].sort((a,b)=>a.localeCompare(b)));
 assert.throws(()=>reg.register({type:cards.LOCK_CONTROL_TYPE,displayName:"Again",renderer(){}}),/already registered/);
 assert.match(renderUnknownCard({type:"future",config:{safe:true}}).textContent,/Configuration required/);
});

test("general entity validation keeps missing unavailable unknown malformed distinct",()=>{
 assert.equal(cards.normalizeLockControl(rt({}),{entityId:"lock.a"}).category,"missing");
 assert.equal(cards.normalizeLockControl(rt({"lock.a":ent("unavailable")}),{entityId:"lock.a"}).category,"unavailable");
 assert.equal(cards.normalizeLockControl(rt({"lock.a":ent("unknown")}),{entityId:"lock.a"}).category,"unknown");
 assert.equal(cards.normalizeLockControl(rt({"lock.a":{state:{},attributes:{}}}),{entityId:"lock.a"}).category,"malformed");
 assert.equal(cards.normalizeLockControl(rt({"lock.a":{state:"locked",attributes:[]}}),{entityId:"lock.a"}).category,"malformed");
 assert.doesNotMatch(cards.renderLockControlCard({config:{entityId:"lock.a"}},rt({"lock.a":{state:{},attributes:{}}})).textContent,/\[object Object\]/);
});

test("lock control states controls and service payloads",()=>{
 let r=rt({"lock.a":ent("locked",{friendly_name:"Front",changed_by:"Alice"})}); let n=cards.renderLockControlCard({config:{entityId:"lock.a",showChangedBy:true}},r); assert.match(n.textContent,/Front|locked|Changed by/); n.querySelectorAll("button")[0].click(); assert.deepEqual(r.calls,[["lock","unlock",{entity_id:"lock.a"}]]);
 r=rt({"lock.a":ent("unlocked")}); n=cards.renderLockControlCard({config:{entityId:"lock.a"}},r); assert.match(n.textContent,/unlocked/); n.querySelectorAll("button")[0].click(); assert.deepEqual(r.calls,[["lock","lock",{entity_id:"lock.a"}]]);
 r=rt({"lock.a":ent("open")}); cards.renderLockControlCard({config:{entityId:"lock.a"}},r).querySelectorAll("button")[0].click(); assert.deepEqual(r.calls,[["lock","lock",{entity_id:"lock.a"}]]);
 for (const s of ["locking","unlocking","opening","jammed","bad"]) { const node=cards.renderLockControlCard({config:{entityId:"lock.a",showChangedBy:true}},rt({"lock.a":ent(s,{changed_by:{}})})); assert.equal(node.querySelectorAll("button").some(b=>!b.disabled),false); if(s==="jammed") assert.match(node.textContent,/JAMMED/); }
 assert.equal(cards.renderLockControlCard({config:{entityId:"lock.a"}},rt({"lock.a":ent("locked")},false)).querySelectorAll("button")[0].disabled,true);
});

test("alarm supported features safe actions payloads no code and disabled states",()=>{
 assert.equal(cards.normalizeAlarmControl(rt({"alarm_control_panel.a":ent("disarmed",{supported_features:7})}),{entityId:"alarm_control_panel.a"}).features.value,7);
 for (const v of [-1,1.5,"7",{}]) assert.equal(cards.normalizeAlarmControl(rt({"alarm_control_panel.a":ent("disarmed",{supported_features:v})}),{entityId:"alarm_control_panel.a"}).category,"malformed");
 const r=rt({"alarm_control_panel.a":ent("armed_away",{supported_features:55,changed_by:"Bob"})}); const btns=cards.renderAlarmControlCard({config:{entityId:"alarm_control_panel.a",showChangedBy:true}},r).querySelectorAll("button"); btns.forEach(b=>b.click());
 assert.deepEqual(r.calls,[["alarm_control_panel","alarm_disarm",{entity_id:"alarm_control_panel.a"}],["alarm_control_panel","alarm_arm_home",{entity_id:"alarm_control_panel.a"}],["alarm_control_panel","alarm_arm_away",{entity_id:"alarm_control_panel.a"}],["alarm_control_panel","alarm_arm_night",{entity_id:"alarm_control_panel.a"}],["alarm_control_panel","alarm_arm_vacation",{entity_id:"alarm_control_panel.a"}],["alarm_control_panel","alarm_arm_custom_bypass",{entity_id:"alarm_control_panel.a"}]]);
 assert.doesNotMatch(JSON.stringify(r.calls),/code|pin/i);
 for (const s of ["pending","arming","disarming","triggered"]) { const node=cards.renderAlarmControlCard({config:{entityId:"alarm_control_panel.a",showChangedBy:true}},rt({"alarm_control_panel.a":ent(s,{supported_features:3,changed_by:{}})})); assert.equal(node.querySelectorAll("button").some(b=>!b.disabled),false); if(s==="triggered") assert.match(node.textContent,/TRIGGERED/); }
 assert.equal(cards.renderAlarmControlCard({config:{entityId:"alarm_control_panel.a"}},rt({"alarm_control_panel.a":ent("disarmed",{supported_features:1})},false)).querySelectorAll("button")[0].disabled,true);
});

test("binary sensor labels malformed attributes last changed and no controls",()=>{
 for (const [dc,on,off] of [["door","Open","Closed"],["motion","Motion","Clear"],["smoke","Smoke","Clear"],["battery","Low","OK"],["weird","On","Off"]]) { assert.match(cards.renderBinarySensorStatusCard({config:{entityId:"binary_sensor.x"}},rt({"binary_sensor.x":ent("on",{device_class:dc})})).textContent,new RegExp(on)); assert.match(cards.renderBinarySensorStatusCard({config:{entityId:"binary_sensor.x"}},rt({"binary_sensor.x":ent("off",{device_class:dc})})).textContent,new RegExp(off)); }
 assert.equal(cards.normalizeBinarySensorStatus(rt({"binary_sensor.x":ent("active")}),{entityId:"binary_sensor.x"}).category,"malformed");
 assert.match(cards.renderBinarySensorStatusCard({config:{entityId:"binary_sensor.x",showLastChanged:true}},rt({"binary_sensor.x":ent("on",{device_class:{}})})).textContent,/Malformed device_class|Last changed/);
 assert.equal(cards.renderBinarySensorStatusCard({config:{entityId:"binary_sensor.x"}},rt({"binary_sensor.x":ent("on")})).querySelectorAll("button").length,0);
});

test("person status privacy coordinates optional values and no remote UI",()=>{
 const states={"person.a":ent("home",{latitude:0,longitude:0,gps_accuracy:0,source:{},user_id:{}}),"person.b":ent("not_home",{latitude:91,longitude:-181,gps_accuracy:-1}),"person.c":ent("Work",{latitude:null,longitude:null})};
 assert.match(cards.renderPersonStatusCard({config:{entityId:"person.a"}},rt(states)).textContent,/Home/); assert.doesNotMatch(cards.renderPersonStatusCard({config:{entityId:"person.a"}},rt(states)).textContent,/Latitude/);
 const shown=cards.renderPersonStatusCard({config:{entityId:"person.a",showCoordinates:true,showLastChanged:true}},rt(states)).textContent; assert.match(shown,/Latitude: 0/); assert.match(shown,/Longitude: 0/); assert.match(shown,/Malformed source|Malformed user id|GPS accuracy: 0|Last changed/);
 assert.match(cards.renderPersonStatusCard({config:{entityId:"person.b",showCoordinates:true}},rt(states)).textContent,/Latitude: malformed|Longitude: malformed|Malformed gps_accuracy/);
 assert.match(cards.renderPersonStatusCard({config:{entityId:"person.c",showCoordinates:true}},rt(states)).textContent,/Work|Latitude: missing|Longitude: missing/);
 assert.doesNotMatch(shown,/iframe|map|tile|geocod/i); assert.equal(cards.renderPersonStatusCard({config:{entityId:"person.a"}},rt(states)).querySelectorAll("button").length,0);
});

test("device tracker status source battery coordinates last seen and no controls",()=>{
 const states={"device_tracker.p":ent("home",{source_type:"gps",latitude:0,longitude:0,gps_accuracy:5,battery_level:0,last_seen:"2026-07-21T00:00:00Z"}),"device_tracker.q":ent("not_home",{battery_level:100}),"device_tracker.r":ent("School",{battery_level:101,latitude:"0",last_seen:{}})};
 let text=cards.renderDeviceTrackerStatusCard({config:{entityId:"device_tracker.p"}},rt(states)).textContent; assert.match(text,/Home|Source: gps|Battery: 0%/); assert.doesNotMatch(text,/Latitude/);
 text=cards.renderDeviceTrackerStatusCard({config:{entityId:"device_tracker.p",showCoordinates:true,showLastChanged:true}},rt(states)).textContent; assert.match(text,/Latitude: 0|Longitude: 0|Last seen|Last changed/);
 assert.match(cards.renderDeviceTrackerStatusCard({config:{entityId:"device_tracker.q"}},rt(states)).textContent,/Away|Battery: 100%/);
 assert.match(cards.renderDeviceTrackerStatusCard({config:{entityId:"device_tracker.r",showCoordinates:true}},rt(states)).textContent,/School|Battery: malformed|Latitude: malformed|Malformed last_seen/);
 assert.equal(cards.renderDeviceTrackerStatusCard({config:{entityId:"device_tracker.p"}},rt(states)).querySelectorAll("button").length,0); assert.doesNotMatch(text,/iframe|map|tile|geocod/i);
});
