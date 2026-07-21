import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultCardRegistry, renderUnknownCard } from "../src/cards/registry.js";
import * as cards from "../src/cards/action-controls.js";

class Node { constructor(tag){this.tagName=tag;this.children=[];this.attributes={};this.dataset={};this._text="";this.value="";this.checked=false;this.className="";} append(...i){this.children.push(...i);} setAttribute(k,v){this.attributes[k]=String(v); if(k==="value")this.value=String(v); if(k==="disabled")this.disabled=true;} addEventListener(t,f){this[`on${t}`]=f;} click(){this.onclick?.({target:this});} get textContent(){return this._text+this.children.map(c=>c.textContent).join("");} set textContent(v){this._text=String(v);this.children=[];} querySelectorAll(sel){const out=[];const m=n=>sel.startsWith(".")?n.className?.split?.(" ").includes(sel.slice(1)):n.tagName===sel; const w=n=>{if(m(n))out.push(n);n.children.forEach(w)}; w(this); return out;} }
globalThis.document={createElement:(t)=>new Node(t)};
const ent=(state,attributes={},last_changed="2026-07-21T00:00:00Z")=>({state,attributes,last_changed});
function rt(states={}, svc=true){return {calls:[], getEntityState:id=>states[id]||null, callService: svc ? function(d,s,data){this.calls.push([d,s,data]);}: undefined};}

test("action control defaults validators registry ordering and unknown fallback",()=>{
 const reg=createDefaultCardRegistry();
 for(const t of ["button-control","scene-control","script-control","automation-control","input-boolean-control","input-number-control","input-select-control"]) assert(reg.get(t));
 assert.deepEqual(cards.defaultButtonControlConfig(),{entityId:"",showLastChanged:true});
 assert.deepEqual(cards.defaultSceneControlConfig(),{entityId:"",showLastChanged:true});
 assert.deepEqual(cards.defaultInputNumberControlConfig(),{entityId:""});
 assert(cards.validateButtonControlConfig({entityId:"{{bad}}",showLastChanged:true}).some(e=>/templates/.test(e.message)));
 assert(cards.validateSceneControlConfig({entityId:"scene.good",showLastChanged:"yes"}).some(e=>e.field==="config.showLastChanged"));
 assert.deepEqual(reg.list().map(d=>d.displayName),[...reg.list().map(d=>d.displayName)].sort((a,b)=>a.localeCompare(b)));
 assert.match(renderUnknownCard({type:"future",config:{x:1}}).textContent,/Configuration required/);
});

test("general invalid entities and missing callService disable controls",()=>{
 for(const render of [cards.renderButtonControlCard,cards.renderSceneControlCard,cards.renderScriptControlCard,cards.renderAutomationControlCard,cards.renderInputBooleanControlCard]){
  assert.equal(render({config:{entityId:"button.x"}},rt({})).querySelectorAll("button")[0].disabled,true);
  assert.equal(render({config:{entityId:"button.x"}},rt({"button.x":ent("unavailable") })).querySelectorAll("button")[0].disabled,true);
  assert.equal(render({config:{entityId:"button.x"}},rt({"button.x":ent("unknown") })).querySelectorAll("button")[0].disabled,true);
  assert.match(render({config:{entityId:"button.x"}},rt({"button.x":{state:1,attributes:{}}})).textContent,/malformed entity state/);
  assert.match(render({config:{entityId:"button.x"}},rt({"button.x":{state:"on",attributes:[]}})).textContent,/malformed attributes/);
  assert.equal(render({config:{entityId:"button.x"}},rt({"button.x":ent("on")},false)).querySelectorAll("button")[0].disabled,true);
 }
});

test("button and scene call fixed payloads",()=>{
 let r=rt({"button.restart":ent("idle",{friendly_name:"Restart"})}); let n=cards.renderButtonControlCard({config:{entityId:"button.restart",showLastChanged:true}},r); assert.match(n.textContent,/Restart.*State idle/); n.querySelectorAll("button")[0].click(); assert.deepEqual(r.calls,[["button","press",{entity_id:"button.restart"}]]);
 r=rt({"scene.movie":ent("scening")}); cards.renderSceneControlCard({config:{entityId:"scene.movie",showLastChanged:false}},r).querySelectorAll("button")[0].click(); assert.deepEqual(r.calls,[["scene","turn_on",{entity_id:"scene.movie"}]]);
});

test("script executions and run stop payloads",()=>{
 assert.equal(cards.normalizeScriptControl(rt({"script.a":ent("off",{})}),{entityId:"script.a"}).current.status,"missing");
 assert.equal(cards.normalizeScriptControl(rt({"script.a":ent("off",{current:0})}),{entityId:"script.a"}).current.value,0);
 assert.equal(cards.normalizeScriptControl(rt({"script.a":ent("off",{current:"many"})}),{entityId:"script.a"}).current.status,"malformed");
 const r=rt({"script.a":ent("on",{current:1})}); const btns=cards.renderScriptControlCard({config:{entityId:"script.a"}},r).querySelectorAll("button"); btns[0].click(); btns[1].click(); assert.deepEqual(r.calls,[["script","turn_on",{entity_id:"script.a"}],["script","turn_off",{entity_id:"script.a"}]]);
});

test("automation state last_triggered and payloads",()=>{
 assert.equal(cards.normalizeAutomationControl(rt({"automation.a":ent("on",{last_triggered:{}})}),{entityId:"automation.a"}).lastTriggered.status,"malformed");
 let r=rt({"automation.a":ent("on",{last_triggered:"2026-07-21T00:00:00Z"})}); let b=cards.renderAutomationControlCard({config:{entityId:"automation.a"}},r).querySelectorAll("button"); b[0].click(); b[1].click(); assert.deepEqual(r.calls,[["automation","turn_off",{entity_id:"automation.a"}],["automation","trigger",{entity_id:"automation.a"}]]);
 r=rt({"automation.a":ent("off")}); cards.renderAutomationControlCard({config:{entityId:"automation.a"}},r).querySelectorAll("button")[0].click(); assert.deepEqual(r.calls,[["automation","turn_on",{entity_id:"automation.a"}]]);
});

test("input boolean accepts only on off and calls matching service",()=>{
 assert.equal(cards.normalizeInputBooleanControl(rt({"input_boolean.a":ent("maybe")}),{entityId:"input_boolean.a"}).on,null);
 let r=rt({"input_boolean.a":ent("on")}); cards.renderInputBooleanControlCard({config:{entityId:"input_boolean.a"}},r).querySelectorAll("button")[0].click(); assert.deepEqual(r.calls,[["input_boolean","turn_off",{entity_id:"input_boolean.a"}]]);
 r=rt({"input_boolean.a":ent("off")}); cards.renderInputBooleanControlCard({config:{entityId:"input_boolean.a"}},r).querySelectorAll("button")[0].click(); assert.deepEqual(r.calls,[["input_boolean","turn_on",{entity_id:"input_boolean.a"}]]);
});

test("input number parsing validation and set_value",()=>{
 const n=(state,attrs)=>cards.normalizeInputNumberControl(rt({"input_number.a":ent(state,attrs)}),{entityId:"input_number.a"});
 assert.equal(n("5",{min:null,max:10,step:1}).min.status,"missing"); assert.equal(n("",{min:0,max:10,step:1}).value.status,"missing"); assert.equal(n("0",{min:0,max:10,step:1}).value.value,0);
 assert(n("bad",{min:0,max:10,step:1}).problems.includes("value")); assert(n("5",{min:"low",max:10,step:1}).problems.includes("min")); assert(n("5",{min:0,max:"high",step:1}).problems.includes("max")); assert(n("5",{min:0,max:10,step:0}).problems.includes("step")); assert(n("5",{min:6,max:4,step:1}).problems.includes("min greater than max")); assert(n("11",{min:0,max:10,step:1}).problems.includes("current value outside bounds"));
 const r=rt({"input_number.a":ent("5",{min:0,max:10,step:1})}); const range=cards.renderInputNumberControlCard({config:{entityId:"input_number.a"}},r).querySelectorAll("input")[0]; range.value="7"; range.onchange(); assert.deepEqual(r.calls,[["input_number","set_value",{entity_id:"input_number.a",value:7}]]);
});

test("input select options validation and select_option",()=>{
 const n=(state,options)=>cards.normalizeInputSelectControl(rt({"input_select.a":ent(state,{options})}),{entityId:"input_select.a"});
 assert.equal(n("A",["A","B"]).options.status,"valid"); assert(n("A",[]).problems.includes("empty options")); assert.equal(n("A","A").options.status,"malformed"); assert.equal(n("A",["A",""]).options.status,"malformed"); assert.equal(n("A",["A","A"]).options.status,"malformed"); assert(n("C",["A","B"]).problems.includes("current option absent from options"));
 const r=rt({"input_select.a":ent("A",{options:["A","B"]})}); const s=cards.renderInputSelectControlCard({config:{entityId:"input_select.a"}},r).querySelectorAll("select")[0]; s.value="B"; s.onchange(); assert.deepEqual(r.calls,[["input_select","select_option",{entity_id:"input_select.a",option:"B"}]]); assert.equal(cards.renderInputSelectControlCard({config:{entityId:"input_select.a"}},rt({"input_select.a":ent("A",{options:["A"]})},false)).querySelectorAll("select")[0].disabled,true);
});

test("editors expose only structured fields and emit patches",()=>{
 for(const render of [cards.renderButtonControlEditor,cards.renderSceneControlEditor,cards.renderScriptControlEditor,cards.renderAutomationControlEditor,cards.renderInputBooleanControlEditor,cards.renderInputNumberControlEditor,cards.renderInputSelectControlEditor]){
  const patches=[]; const form=render(globalThis.document,{id:"c1",config:{entityId:"button.a",showLastChanged:false}},{updateCardConfigPatch:(id,p)=>patches.push([id,p])},[]);
  assert.equal(form.querySelectorAll("textarea").length,0); assert.doesNotMatch(form.textContent,/template|service data|html/i);
  const inputs=form.querySelectorAll("input"); inputs[0].value="button.b"; inputs[0].oninput?.(); inputs[0].onchange?.(); if(inputs[1]){inputs[1].checked=true; inputs[1].onchange();}
  assert(patches.length>=1);
 }
});
