import { cloneDashboard } from "./commands.js";

export function createEditorState() {
  return { editing: false, dirty: false, draftDashboard: null, selectedNode: { dashboardId: null, viewId: null, sectionId: null, cardId: null }, validationErrors: [], saveError: null, saving: false, debugText: "", debugError: null, fieldText: {} };
}

export function enterEditor(state, dashboard) {
  const draft = cloneDashboard(dashboard);
  return { ...state, editing: true, dirty: false, draftDashboard: draft, selectedNode: { dashboardId: draft?.id || null, viewId: draft?.views?.[0]?.id || null, sectionId: null, cardId: null }, validationErrors: [], saveError: null, saving: false, debugText: JSON.stringify(draft, null, 2), debugError: null, fieldText: {} };
}

export function clearEditorState(state) {
  return { ...state, ...createEditorState() };
}

export function markDraft(state, draft, selectedNode = state.selectedNode) {
  return { ...state, draftDashboard: draft, dirty: true, selectedNode, debugText: JSON.stringify(draft, null, 2), debugError: null, saveError: null };
}

function addError(errors, message, field = "draft") {
  errors.push({ field, message });
}

function assertArray(errors, value, field) {
  if (value !== undefined && !Array.isArray(value)) addError(errors, `${field} must be an array.`, field);
}

function trackId(errors, ids, id, field) {
  if (!id || typeof id !== "string") {
    addError(errors, `${field} id must be a non-empty string.`, field);
    return;
  }
  if (ids.has(id)) addError(errors, `Duplicate editor node id: ${id}`, field);
  ids.add(id);
}

function duplicateReferences(values = []) {
  const seen = new Set();
  return values.filter((value) => {
    if (seen.has(value)) return true;
    seen.add(value);
    return false;
  });
}

export function hasBlockingLocalErrors(editor) {
  return Boolean((editor?.validationErrors || []).length || Object.keys(editor?.fieldText || {}).length);
}

export function validateDraft(draft) {
  const errors = [];
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) {
    addError(errors, "Dashboard draft must be an object.");
    return errors;
  }

  assertArray(errors, draft.views, "views");
  assertArray(errors, draft.sections, "sections");
  assertArray(errors, draft.cards, "cards");
  if (errors.length) return errors;

  const views = draft.views || [];
  const sections = draft.sections || [];
  const cards = draft.cards || [];
  const allIds = new Set();
  trackId(errors, allIds, draft.id, "dashboard");
  for (const view of views) trackId(errors, allIds, view?.id, "view");
  for (const section of sections) trackId(errors, allIds, section?.id, "section");
  for (const card of cards) trackId(errors, allIds, card?.id, "card");

  const sectionIds = new Set(sections.map((section) => section?.id).filter(Boolean));
  const cardIds = new Set(cards.map((card) => card?.id).filter(Boolean));
  const referencedSections = new Set();
  const sectionOwners = new Map();
  const referencedCards = new Set();
  const cardOwners = new Map();

  for (const view of views) {
    assertArray(errors, view?.section_ids, `view:${view?.id}:section_ids`);
    for (const duplicate of duplicateReferences(view?.section_ids || [])) addError(errors, `Duplicate section reference: ${duplicate}`, `view:${view?.id}:section_ids`);
    for (const sectionId of view?.section_ids || []) {
      if (!sectionIds.has(sectionId)) addError(errors, `View references missing section: ${sectionId}`, `view:${view?.id}:section_ids`);
      if (sectionOwners.has(sectionId) && sectionOwners.get(sectionId) !== view?.id) addError(errors, `Section is referenced by multiple views: ${sectionId}`, `view:${view?.id}:section_ids`);
      sectionOwners.set(sectionId, view?.id);
      referencedSections.add(sectionId);
    }
  }

  for (const section of sections) {
    assertArray(errors, section?.card_ids, `section:${section?.id}:card_ids`);
    for (const duplicate of duplicateReferences(section?.card_ids || [])) addError(errors, `Duplicate card reference: ${duplicate}`, `section:${section?.id}:card_ids`);
    for (const cardId of section?.card_ids || []) {
      if (!cardIds.has(cardId)) addError(errors, `Section references missing card: ${cardId}`, `section:${section?.id}:card_ids`);
      if (cardOwners.has(cardId) && cardOwners.get(cardId) !== section?.id) addError(errors, `Card is referenced by multiple sections: ${cardId}`, `section:${section?.id}:card_ids`);
      cardOwners.set(cardId, section?.id);
      referencedCards.add(cardId);
    }
  }

  for (const section of sections) if (!referencedSections.has(section.id)) addError(errors, `Orphan section is not referenced by a view: ${section.id}`, `section:${section.id}`);
  for (const card of cards) {
    if (!referencedCards.has(card.id)) addError(errors, `Orphan card is not referenced by a section: ${card.id}`, `card:${card.id}`);
    if (!card.config || typeof card.config !== "object" || Array.isArray(card.config)) addError(errors, "Card config must be a JSON object.", `card:${card.id}:config`);
  }
  return errors;
}
