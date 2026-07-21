import * as commands from "./commands.js";
import { enterEditor, clearEditorState, markDraft, validateDraft } from "./editor-state.js";
export class EditorController {
  constructor(store,{idGenerator=commands.createIdGenerator("editor"),confirmUnsaved=async()=>true}={}){ this.store=store; this.idGenerator=idGenerator; this.confirmUnsaved=confirmUnsaved; }
  get state(){ return this.store.state.editor; }
  enter(){ if(this.store.state.activeDashboard) this.store.setState({mode:"edit",editor:enterEditor(this.state,this.store.state.activeDashboard)}); }
  async guard(){ return !this.state?.dirty || await this.confirmUnsaved(); }
  async cancel(){ if(await this.guard()) this.store.setState({mode:"visual",editor:clearEditorState(this.state)}); }
  async setMode(mode){ if(mode==="edit") return this.enter(); if(await this.guard()) this.store.setMode(mode); }
  select(node){ this.store.setState({editor:{...this.state,selectedNode:{...this.state.selectedNode,...node}}}); }
  apply(fn, select){ const draft=fn(this.state.draftDashboard); this.store.setState({editor:markDraft(this.state,draft,select?.(draft)||this.state.selectedNode)}); }
  updateDashboard(p){ this.apply(d=>commands.updateDashboardMetadata(d,p)); }
  addView(){ this.apply(d=>commands.addView(d,{},this.idGenerator), d=>({dashboardId:d.id,viewId:d.views.at(-1).id,sectionId:null,cardId:null})); }
  updateView(id,p){ this.apply(d=>commands.updateView(d,id,p)); }
  removeView(id){ this.apply(d=>commands.removeView(d,id), d=>({dashboardId:d.id,viewId:d.views[0]?.id||null,sectionId:null,cardId:null})); }
  moveView(id,dir){ this.apply(d=>commands.moveView(d,id,dir)); }
  addSection(viewId){ this.apply(d=>commands.addSection(d,viewId,{},this.idGenerator), d=>({dashboardId:d.id,viewId,sectionId:d.sections.at(-1).id,cardId:null})); }
  updateSection(id,p){ this.apply(d=>commands.updateSection(d,id,p)); }
  removeSection(id){ this.apply(d=>commands.removeSection(d,id), d=>({dashboardId:d.id,viewId:this.state.selectedNode.viewId,sectionId:null,cardId:null})); }
  moveSection(viewId,id,dir){ this.apply(d=>commands.moveSection(d,viewId,id,dir)); }
  addCard(sectionId){ this.apply(d=>commands.addCard(d,sectionId,{},this.idGenerator), d=>({dashboardId:d.id,viewId:this.state.selectedNode.viewId,sectionId,cardId:d.cards.at(-1).id})); }
  updateCard(id,p){ this.apply(d=>commands.updateCard(d,id,p)); }
  updateCardConfig(id,text){ try{ this.updateCard(id,{config:commands.parseCardConfig(text)}); }catch(error){ this.store.setState({editor:{...this.state,validationErrors:[{field:"config",message:error.message}]}}); } }
  removeCard(id){ this.apply(d=>commands.removeCard(d,id), d=>({dashboardId:d.id,viewId:this.state.selectedNode.viewId,sectionId:this.state.selectedNode.sectionId,cardId:null})); }
  moveCard(sectionId,id,dir){ this.apply(d=>commands.moveCard(d,sectionId,id,dir)); }
  updateDebugJson(text){ try{ const draft=JSON.parse(text); this.store.setState({editor:{...markDraft(this.state,draft),debugText:text,debugError:null}}); }catch(error){ this.store.setState({editor:{...this.state,debugText:text,debugError:error.message}}); } }
  async save(){ const validationErrors=validateDraft(this.state.draftDashboard); if(validationErrors.length){ this.store.setState({editor:{...this.state,validationErrors}}); return; } await this.store.replaceDashboard(this.state.draftDashboard); if(!this.store.state.error) this.store.setState({mode:"visual",editor:clearEditorState(this.state)}); else this.store.setState({editor:{...this.state,saveError:this.store.state.error}}); }
}
