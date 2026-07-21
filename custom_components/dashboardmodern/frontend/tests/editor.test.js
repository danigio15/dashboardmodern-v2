import assert from "node:assert/strict";
import test from "node:test";
import * as c from "../src/editor/commands.js";
import { DashboardModernStore } from "../src/state.js";
import { EditorController } from "../src/editor/editor-controller.js";

const base = () => ({ id:"dash", title:"Dash", description:"D", views:[{id:"v1",title:"V1",section_ids:["s1"]},{id:"v2",title:"V2",section_ids:[]}], sections:[{id:"s1",title:"S1",card_ids:["c1"]}], cards:[{id:"c1",title:"C1",type:"unknown",config:{a:1}}] });

test("entering edit mode creates an independent draft and cancel discards changes", async () => {
  const store = new DashboardModernStore({}, {entryIdResolver: async()=>"e"});
  store.setState({activeDashboard:base(),activeDashboardId:"dash"});
  const ec = new EditorController(store);
  ec.enter(); ec.updateDashboard({title:"Draft"});
  assert.equal(store.state.activeDashboard.title,"Dash");
  assert.equal(store.state.editor.dirty,true);
  await ec.cancel();
  assert.equal(store.state.editor.draftDashboard,null);
  assert.equal(store.state.activeDashboard.title,"Dash");
});

test("successful save commits backend response and failed save preserves dirty draft", async () => {
  let fail=false;
  const api={ replaceDashboard: async (_e,d)=>{ if(fail) throw new Error("nope"); return {...d,title:"Backend"}; }, listDashboards:async()=>[{id:"dash",title:"Backend"}], getDashboard:async()=>({...base(),title:"Backend"}) };
  const store = new DashboardModernStore(api, {entryIdResolver: async()=>"e"}); store.setState({entryId:"e",activeDashboard:base(),activeDashboardId:"dash",dashboards:[base()]});
  const ec = new EditorController(store); ec.enter(); ec.updateDashboard({title:"Draft"}); await ec.save();
  assert.equal(store.state.activeDashboard.title,"Backend"); assert.equal(store.state.editor.dirty,false);
  fail=true; ec.enter(); ec.updateDashboard({title:"Dirty"}); await ec.save();
  assert.equal(store.state.editor.dirty,true); assert.equal(store.state.editor.draftDashboard.title,"Dirty");
});

test("add update remove move view section card and cascade integrity", () => {
  const gen=c.createIdGenerator("id", [1]); let d=base();
  d=c.addView(d,{title:"New"},gen); assert.equal(d.views.at(-1).id,"id-1");
  d=c.updateView(d,"id-1",{title:"Renamed"}); assert.equal(d.views.at(-1).title,"Renamed");
  d=c.moveView(d,"id-1",-1); assert.equal(d.views[1].id,"id-1");
  d=c.addSection(d,"id-1",{},gen); assert.equal(d.views[1].section_ids[0],"id-2");
  d=c.updateSection(d,"id-2",{title:"Sec"}); d=c.moveSection(d,"id-1","id-2",-1); assert.equal(d.sections.find(s=>s.id==="id-2").title,"Sec");
  d=c.addCard(d,"id-2",{type:"mystery",config:{x:1}},gen); assert.equal(d.cards.at(-1).type,"mystery");
  d=c.updateCard(d,"id-3",{title:"Card"}); d=c.moveCard(d,"id-2","id-3",-1); assert.equal(d.cards.find(x=>x.id==="id-3").title,"Card");
  d=c.removeView(d,"id-1"); assert.equal(d.sections.some(s=>s.id==="id-2"),false); assert.equal(d.cards.some(card=>card.id==="id-3"),false);
  d=c.removeSection(d,"s1"); assert.equal(d.cards.some(card=>card.id==="c1"),false);
});

test("duplicate id prevention and deterministic id generation", () => {
  const gen = () => "v1";
  assert.throws(()=>c.addView(base(),{},gen), /Duplicate id/);
  const seq=c.createIdGenerator("safe",[7]); assert.equal(seq(new Set()),"safe-7");
});

test("card config rejects invalid JSON arrays primitives but unknown types remain editable", () => {
  assert.throws(()=>c.parseCardConfig("[1]"), /object/); assert.throws(()=>c.parseCardConfig("1"), /object/); assert.deepEqual(c.parseCardConfig('{"ok":true}'),{ok:true});
  const d=c.updateCard(base(),"c1",{type:"whatever"}); assert.equal(d.cards[0].type,"whatever");
});

test("unsaved-change guard on dashboard switch and cancel mode switch", async () => {
  const api={getDashboard:async()=>({...base(),id:"other"})}; const store=new DashboardModernStore(api,{entryIdResolver:async()=>"e"}); store.setState({entryId:"e",activeDashboard:base(),activeDashboardId:"dash"});
  let asked=0; const ec=new EditorController(store,{confirmUnsaved:async()=>{asked++; return false;}}); ec.enter(); ec.updateDashboard({title:"Dirty"}); store.confirmUnsaved=ec.confirmUnsaved;
  await store.loadDashboard("other"); assert.equal(store.state.activeDashboardId,"dash"); await ec.cancel(); assert.equal(store.state.editor.dirty,true); assert.equal(asked,2);
});

test("Edit and Debug JSON share draft and invalid debug JSON does not corrupt it", () => {
  const store=new DashboardModernStore({},{}); store.setState({activeDashboard:base(),activeDashboardId:"dash"}); const ec=new EditorController(store); ec.enter();
  ec.updateDebugJson('{"id":"dash","title":"Json","views":[],"sections":[],"cards":[]}'); assert.equal(store.state.editor.draftDashboard.title,"Json");
  ec.updateDebugJson('{bad'); assert.equal(store.state.editor.draftDashboard.title,"Json"); assert.ok(store.state.editor.debugError);
});
