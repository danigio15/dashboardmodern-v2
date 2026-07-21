import { DEFAULT_CARD_REGISTRY, getCardType } from "../cards/registry.js";
import { layoutPatch, validateCardLayout } from "../layout.js";
import { replaceCardConfigErrors, validateRegisteredCardConfigs } from "./card-validation.js";
import { validateNavigationConfig } from "../navigation/navigation.js";
import * as commands from "./commands.js";
import { clearEditorState, enterEditor, hasBlockingLocalErrors, markDraft, validateDraft } from "./editor-state.js";

export class EditorController {
  constructor(store, { idGenerator = commands.createIdGenerator("editor"), confirmUnsaved = async () => true, cardRegistry = DEFAULT_CARD_REGISTRY } = {}) {
    this.store = store;
    this.idGenerator = idGenerator;
    this.confirmUnsaved = confirmUnsaved;
    this.cardRegistry = cardRegistry;
  }

  get state() {
    return this.store.state.editor;
  }

  async guard() {
    return !this.state?.dirty || await this.confirmUnsaved();
  }

  async enter() {
    if (!this.store.state.activeDashboard) return false;
    if (this.state?.editing) {
      this.store.setMode("edit");
      return true;
    }
    if (this.state?.dirty && !(await this.guard())) return false;
    this.store.setState({ mode: "edit", editor: enterEditor(this.state, this.store.state.activeDashboard) });
    return true;
  }

  async setMode(mode) {
    if (mode === "edit") return this.enter();
    if (mode === "debug" && this.state?.editing) {
      this.store.setMode("debug");
      return true;
    }
    if (!(await this.guard())) return false;
    this.store.setState({ mode: mode === "debug" ? "debug" : "visual", editor: clearEditorState(this.state), renderError: null });
    return true;
  }

  async cancel() {
    return this.setMode("visual");
  }

  async loadDashboard(dashboardId) {
    if (!(await this.guard())) return false;
    await this.store.loadDashboard(dashboardId);
    return true;
  }

  async deleteDashboard(dashboardId = this.store.state.activeDashboardId) {
    if (!(await this.guard())) return false;
    await this.store.deleteDashboard(dashboardId);
    return true;
  }

  select(node) {
    this.store.setState({ editor: { ...this.state, selectedNode: { ...this.state.selectedNode, ...node } } });
  }

  clearFieldState(prefixes) {
    const fieldText = Object.fromEntries(Object.entries(this.state.fieldText || {}).filter(([field]) => !prefixes.some((prefix) => field.startsWith(prefix))));
    const validationErrors = (this.state.validationErrors || []).filter((error) => !prefixes.some((prefix) => error.field?.startsWith(prefix)));
    this.store.setState({ editor: { ...this.state, fieldText, validationErrors } });
  }

  apply(command, select) {
    const draft = command(this.state.draftDashboard);
    this.store.setState({ editor: markDraft(this.state, draft, select?.(draft) || this.state.selectedNode) });
  }

  updateDashboard(patch) { this.apply((draft) => commands.updateDashboardMetadata(draft, patch)); }
  addView() { this.apply((draft) => commands.addView(draft, {}, this.idGenerator), (draft) => ({ dashboardId: draft.id, viewId: draft.views.at(-1).id, sectionId: null, cardId: null })); }
  updateView(id, patch) { this.apply((draft) => commands.updateView(draft, id, patch)); }
  removeView(id) {
    const view = (this.state.draftDashboard?.views || []).find((item) => item.id === id);
    const sectionIds = new Set(view?.section_ids || []);
    const cardIds = (this.state.draftDashboard?.sections || []).filter((section) => sectionIds.has(section.id)).flatMap((section) => section.card_ids || []);
    this.apply((draft) => commands.removeView(draft, id), (draft) => ({ dashboardId: draft.id, viewId: draft.views[0]?.id || null, sectionId: null, cardId: null }));
    this.clearFieldState([...cardIds.map((cardId) => `card:${cardId}:`), ...[...sectionIds].map((sectionId) => `section:${sectionId}:`), `view:${id}:`]);
  }
  moveView(id, direction) { this.apply((draft) => commands.moveView(draft, id, direction)); }
  addSection(viewId) { this.apply((draft) => commands.addSection(draft, viewId, {}, this.idGenerator), (draft) => ({ dashboardId: draft.id, viewId, sectionId: draft.sections.at(-1).id, cardId: null })); }
  updateSection(id, patch) { this.apply((draft) => commands.updateSection(draft, id, patch)); }
  removeSection(id) {
    const section = (this.state.draftDashboard?.sections || []).find((item) => item.id === id);
    const cardIds = section?.card_ids || [];
    this.apply((draft) => commands.removeSection(draft, id), (draft) => ({ dashboardId: draft.id, viewId: this.state.selectedNode.viewId, sectionId: null, cardId: null }));
    this.clearFieldState([...cardIds.map((cardId) => `card:${cardId}:`), `section:${id}:`]);
  }
  moveSection(viewId, id, direction) { this.apply((draft) => commands.moveSection(draft, viewId, id, direction)); }
  addCard(sectionId) { this.apply((draft) => commands.addCard(draft, sectionId, {}, this.idGenerator), (draft) => ({ dashboardId: draft.id, viewId: this.state.selectedNode.viewId, sectionId, cardId: draft.cards.at(-1).id })); }
  updateCard(id, patch) { this.apply((draft) => commands.updateCard(draft, id, patch)); }
  updateCardLayoutValue(id, breakpoint, field, rawValue) {
    const value = rawValue === "" ? "" : Number(rawValue);
    const card = this.state.draftDashboard.cards.find((item) => item.id === id);
    const fullField = `card:${id}:layout.${breakpoint}.${field}`;
    const result = layoutPatch(card?.layout, breakpoint, field, value);
    if (result.error) {
      this.store.setState({ editor: { ...this.state, dirty: true, validationErrors: [...(this.state.validationErrors || []).filter((error) => error.field !== fullField), { field: fullField, message: result.error.message }] } });
      return false;
    }
    this.updateCard(id, result.patch);
    const validationErrors = [...(this.state.validationErrors || []).filter((error) => !error.field?.startsWith(`card:${id}:layout`)), ...validateCardLayout(result.patch.layout, { cardId: id })];
    this.store.setState({ editor: { ...this.state, validationErrors } });
    return true;
  }
  changeCardType(id, type) {
    const definition = getCardType(type, this.cardRegistry);
    this.updateCard(id, { type, config: this.state.draftDashboard.cards.find((card) => card.id === id)?.config || definition?.defaultConfig?.() || {} });
    this.validateCardConfig(id);
  }
  updateCardConfigPatch(id, patch) {
    const card = this.state.draftDashboard.cards.find((item) => item.id === id);
    this.updateCard(id, { config: { ...(card?.config || {}), ...patch } });
    this.validateCardConfig(id);
  }
  validateCardConfig(id) {
    const card = this.state.draftDashboard.cards.find((item) => item.id === id);
    const fieldPrefix = `card:${id}:config`;
    const definition = getCardType(card?.type, this.cardRegistry);
    const pluginErrors = definition?.validateConfig?.(card?.config || {}) || [];
    const preservedSyntaxError = this.state.fieldText?.[fieldPrefix] !== undefined ? (this.state.validationErrors || []).find((error) => error.field === fieldPrefix) : null;
    const validationErrors = replaceCardConfigErrors(this.state.validationErrors || [], id, [...(preservedSyntaxError ? [preservedSyntaxError] : []), ...pluginErrors.map((error) => ({ field: `${fieldPrefix}${error.field === "config" || !error.field ? "" : error.field.startsWith("config.") ? `.${error.field.slice("config.".length)}` : `.${error.field}`}`, message: error.message }))]);
    this.store.setState({ editor: { ...this.state, validationErrors } });
  }
  removeCard(id) {
    this.apply((draft) => commands.removeCard(draft, id), (draft) => ({ dashboardId: draft.id, viewId: this.state.selectedNode.viewId, sectionId: this.state.selectedNode.sectionId, cardId: null }));
    this.clearFieldState([`card:${id}:`]);
  }
  moveCard(sectionId, id, direction) { this.apply((draft) => commands.moveCard(draft, sectionId, id, direction)); }
  reorderCard(sectionId, id, targetIndex) { this.apply((draft) => commands.reorderCard(draft, sectionId, id, targetIndex)); }

  updateCardConfig(id, text) {
    const field = `card:${id}:config`;
    try {
      const config = commands.parseCardConfig(text);
      this.updateCard(id, { config });
      const { [field]: _cleared, ...fieldText } = this.state.fieldText || {};
      this.store.setState({ editor: { ...this.state, fieldText } });
      this.validateCardConfig(id);
    } catch (error) {
      this.store.setState({ editor: { ...this.state, dirty: true, fieldText: { ...this.state.fieldText, [field]: text }, validationErrors: [...(this.state.validationErrors || []).filter((item) => item.field !== field), { field, message: error.message }] } });
    }
  }

  updateDebugJson(text) {
    try {
      const draft = JSON.parse(text);
      const validationErrors = [...validateDraft(draft), ...validateNavigationConfig(draft.config), ...validateRegisteredCardConfigs(draft, this.cardRegistry)];
      if (validationErrors.length) {
        this.store.setState({ editor: { ...this.state, debugText: text, debugError: validationErrors[0].message, validationErrors } });
        return false;
      }
      this.store.setState({ editor: { ...markDraft(this.state, draft), debugText: text, debugError: null, validationErrors: [], fieldText: {} } });
      return true;
    } catch (error) {
      this.store.setState({ editor: { ...this.state, debugText: text, debugError: error.message } });
      return false;
    }
  }

  async save({ remainEditing = false } = {}) {
    if (this.state?.saving) return false;
    if (this.state?.debugError) return false;
    if (Object.keys(this.state?.fieldText || {}).length) return false;
    const validationErrors = [...validateDraft(this.state.draftDashboard), ...validateNavigationConfig(this.state.draftDashboard?.config), ...validateRegisteredCardConfigs(this.state.draftDashboard, this.cardRegistry)];
    if (validationErrors.length) {
      this.store.setState({ editor: { ...this.state, validationErrors } });
      return false;
    }
    const draft = this.state.draftDashboard;
    const selectedNode = this.state.selectedNode;
    this.store.setState({ editor: { ...this.state, saving: true, saveError: null } });
    await this.store.replaceDashboard(draft);
    if (!this.store.state.error) {
      if (remainEditing) {
        const activeDashboard = this.store.state.activeDashboard;
        this.store.setState({ mode: "edit", editor: { ...this.store.state.editor, editing: true, dirty: false, draftDashboard: commands.cloneDashboard(activeDashboard), selectedNode, validationErrors: [], saveError: null, saving: false, debugText: JSON.stringify(activeDashboard, null, 2), debugError: null, fieldText: {} } });
        return true;
      }
      this.store.setState({ mode: "visual", editor: clearEditorState(this.store.state.editor) });
      return true;
    }
    this.store.setState({ editor: { ...this.store.state.editor, draftDashboard: draft, dirty: true, saving: false, saveError: this.store.state.error } });
    return false;
  }
}
