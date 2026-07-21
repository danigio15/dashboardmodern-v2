import { cloneDashboard, reorderCard } from "./commands.js";

export const REORDER_INSTRUCTIONS = "Press Space or Enter to pick up this card, arrow keys to choose a new position, then Space or Enter to place it. Press Escape to cancel.";
const THRESHOLD = 6;

function cardTitle(card) { return card?.title || card?.id || "Untitled card"; }
function idsEqual(a = [], b = []) { return a.length === b.length && a.every((id, index) => id === b[index]); }
function cssEscape(value) { return globalThis.CSS?.escape ? CSS.escape(value) : String(value).replaceAll('"', '\\"'); }
function indexFromSection(section, cardId) { return (section?.card_ids || []).indexOf(cardId); }
function setDatasetFlag(node, name, value) { if (node?.dataset) node.dataset[name] = value; else node?.setAttribute?.(`data-${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`, value); }

export function finalIndexToInsertionIndex(finalIndex, fromIndex) {
  if (!Number.isInteger(finalIndex) || !Number.isInteger(fromIndex) || finalIndex < 0 || fromIndex < 0) throw new Error("Invalid reorder index.");
  return finalIndex > fromIndex ? finalIndex + 1 : finalIndex;
}

export function insertionIndexToFinalIndex(insertionIndex, fromIndex) {
  if (!Number.isInteger(insertionIndex) || !Number.isInteger(fromIndex) || insertionIndex < 0 || fromIndex < 0) throw new Error("Invalid reorder index.");
  return insertionIndex > fromIndex ? insertionIndex - 1 : insertionIndex;
}

export function insertionIndexFromNode(target) {
  const marker = target?.closest?.("[data-reorder-index]");
  const value = Number(marker?.dataset?.reorderIndex);
  return Number.isInteger(value) ? value : null;
}

export class CardReorderController {
  constructor(store, editorController, root) {
    this.store = store; this.editorController = editorController; this.root = root;
    this.drag = null; this.keyboard = null; this.lastAnnouncement = ""; this.lastError = "";
    root.addEventListener("pointerdown", (event) => this.onPointerDown(event));
    root.addEventListener("pointermove", (event) => this.onPointerMove(event));
    root.addEventListener("pointerup", (event) => this.onPointerUp(event));
    root.addEventListener("pointercancel", () => this.cancel("Move canceled."));
    root.addEventListener("lostpointercapture", () => { if (this.drag) this.cancel("Move canceled."); });
    root.addEventListener("keydown", (event) => this.onKeyDown(event));
  }
  isEdit() { return this.store.state.mode === "edit" && this.store.state.editor?.editing; }
  dashboard() { return this.store.state.editor?.draftDashboard; }
  section(id) { return (this.dashboard()?.sections || []).find((section) => section.id === id); }
  card(id) { return (this.dashboard()?.cards || []).find((card) => card.id === id); }
  announce(text) { this.lastAnnouncement = text; const region = this.root.querySelector("[data-reorder-live]"); if (region) region.textContent = text; }
  showError(text) { this.lastError = text; const status = this.root.querySelector("[data-reorder-error]"); if (status) { status.hidden = !text; status.textContent = text; } }
  clearUi() {
    for (const node of this.root.querySelectorAll("[data-reorder-active],[data-reorder-target],[data-keyboard-moving]")) {
      delete node.dataset.reorderActive; delete node.dataset.reorderTarget; delete node.dataset.keyboardMoving;
      node.removeAttribute?.("data-reorder-active"); node.removeAttribute?.("data-reorder-target"); node.removeAttribute?.("data-keyboard-moving");
    }
    this.root.querySelector("[data-reorder-preview]")?.remove();
  }
  clear() { this.drag = null; this.keyboard = null; this.clearUi(); }
  validate(sectionId, cardId, insertionIndex) {
    if (!this.isEdit()) throw new Error("Unable to move card.");
    const section = this.section(sectionId); if (!section) throw new Error("Unable to move card.");
    const ids = section.card_ids || []; if (ids.filter((id) => id === cardId).length !== 1) throw new Error("Unable to move card.");
    const fromIndex = ids.indexOf(cardId); if (fromIndex < 0) throw new Error("Unable to move card.");
    if (!Number.isInteger(insertionIndex) || insertionIndex < 0 || insertionIndex > ids.length) throw new Error("Unable to move card.");
    const card = this.card(cardId); if (!card) throw new Error("Unable to move card.");
    return { section, ids, fromIndex, card };
  }
  safeValidate(sectionId, cardId, insertionIndex) { try { return this.validate(sectionId, cardId, insertionIndex); } catch { this.announce("Unable to move card."); this.showError("Unable to move card."); this.clear(); return null; } }
  restoreDraft(previousDraft, previousDirty, selectedNode, proposedDraft, sectionId) {
    const current = this.dashboard();
    const proposedIds = (proposedDraft?.sections || []).find((section) => section.id === sectionId)?.card_ids || [];
    const currentIds = (current?.sections || []).find((section) => section.id === sectionId)?.card_ids || [];
    if (idsEqual(currentIds, proposedIds)) {
      this.store.setState({ mode: "edit", editor: { ...this.store.state.editor, editing: true, draftDashboard: cloneDashboard(previousDraft), dirty: previousDirty, selectedNode, saving: false, saveError: this.store.state.editor?.saveError, debugText: JSON.stringify(previousDraft, null, 2) } });
    }
  }
  async commit(sectionId, cardId, insertionIndex, focus = true) {
    const latest = this.safeValidate(sectionId, cardId, insertionIndex); if (!latest) return false;
    const finalIndex = insertionIndexToFinalIndex(insertionIndex, latest.fromIndex);
    if (finalIndex === latest.fromIndex) { this.announce("Move canceled."); this.clear(); return false; }
    const title = cardTitle(latest.card); const total = latest.ids.length; const destinationPosition = finalIndex + 1; const previousDraft = cloneDashboard(this.dashboard()); const previousDirty = Boolean(this.store.state.editor?.dirty); const selectedNode = this.store.state.editor?.selectedNode;
    let proposedDraft;
    try {
      proposedDraft = reorderCard(this.dashboard(), sectionId, cardId, insertionIndex);
      this.editorController.apply(() => proposedDraft);
      const ok = await this.editorController.save({ remainEditing: true });
      if (!ok) throw new Error("Unable to move card.");
      this.clear(); this.showError(""); this.announce(`${title} placed at position ${destinationPosition} of ${total}.`);
      if (focus) queueMicrotask(() => this.root.querySelector(`[data-reorder-handle][data-card-id="${cssEscape(cardId)}"]`)?.focus?.());
      return true;
    } catch {
      this.restoreDraft(previousDraft, previousDirty, selectedNode, proposedDraft, sectionId);
      this.clear(); this.showError("Unable to move card."); this.announce("Unable to move card."); return false;
    }
  }
  onPointerDown(event) {
    if (!this.isEdit()) return;
    const handle = event.target?.closest?.("[data-reorder-handle]"); if (!handle) return;
    try {
      event.preventDefault?.(); const cardId = handle.dataset.cardId; const sectionId = handle.closest("[data-section-id]")?.dataset.sectionId;
      const startIndex = indexFromSection(this.section(sectionId), cardId); const result = this.safeValidate(sectionId, cardId, startIndex); if (!result) return;
      this.drag = { status: "pending", pointerId: event.pointerId, cardId, sectionId, originalIndex: result.fromIndex, proposedIndex: result.fromIndex, x: event.clientX, y: event.clientY };
      handle.setPointerCapture?.(event.pointerId);
    } catch { this.announce("Unable to move card."); this.clear(); }
  }
  onPointerMove(event) {
    if (!this.drag || event.pointerId !== this.drag.pointerId) return;
    const dx = event.clientX - this.drag.x; const dy = event.clientY - this.drag.y;
    if (this.drag.status === "pending" && Math.hypot(dx, dy) < THRESHOLD) return;
    if (this.drag.status === "pending") { this.drag.status = "dragging"; this.root.querySelector(`[data-card-id="${cssEscape(this.drag.cardId)}"]`)?.setAttribute("data-reorder-active", "true"); this.announce(`Picked up ${cardTitle(this.card(this.drag.cardId))}.`); }
    const index = insertionIndexFromNode(event.target); if (index === null) return;
    if (!this.safeValidate(this.drag.sectionId, this.drag.cardId, index)) return;
    this.drag.proposedIndex = index;
    for (const node of this.root.querySelectorAll("[data-reorder-target]")) delete node.dataset.reorderTarget;
    setDatasetFlag(event.target.closest("[data-reorder-index]"), "reorderTarget", "true");
  }
  onPointerUp(event) { if (!this.drag || event.pointerId !== this.drag.pointerId) return; const state = this.drag; if (state.status !== "dragging") { this.clear(); return; } return this.commit(state.sectionId, state.cardId, state.proposedIndex); }
  cancel(message = "Move canceled.") { if (this.drag || this.keyboard) this.announce(message); this.clear(); }
  onKeyDown(event) {
    if (!this.isEdit()) return; const handle = event.target?.closest?.("[data-reorder-handle]");
    if (event.key === "Escape" && (this.drag || this.keyboard)) { event.preventDefault?.(); this.cancel(); return; }
    if (!handle) return;
    const cardId = handle.dataset.cardId; const sectionId = handle.closest("[data-section-id]")?.dataset.sectionId; const startIndex = indexFromSection(this.section(sectionId), cardId);
    if (!this.keyboard && [" ", "Enter"].includes(event.key)) {
      event.preventDefault?.(); const result = this.safeValidate(sectionId, cardId, startIndex); if (!result) return;
      this.keyboard = { cardId, sectionId, originalIndex: result.fromIndex, finalIndex: result.fromIndex }; setDatasetFlag(handle, "keyboardMoving", "true"); this.announce(`Picked up ${cardTitle(result.card)}, position ${result.fromIndex + 1} of ${result.ids.length}.`); return;
    }
    if (!this.keyboard || this.keyboard.cardId !== cardId) return;
    const currentInsertion = finalIndexToInsertionIndex(this.keyboard.finalIndex, startIndex); const result = this.safeValidate(sectionId, cardId, currentInsertion); if (!result) return;
    let next = this.keyboard.finalIndex;
    if (["ArrowUp", "ArrowLeft"].includes(event.key)) next = Math.max(0, next - 1);
    else if (["ArrowDown", "ArrowRight"].includes(event.key)) next = Math.min(result.ids.length - 1, next + 1);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = result.ids.length - 1;
    else if ([" ", "Enter"].includes(event.key)) { event.preventDefault?.(); return this.commit(sectionId, cardId, finalIndexToInsertionIndex(this.keyboard.finalIndex, result.fromIndex), true); }
    else return;
    event.preventDefault?.(); this.keyboard.finalIndex = next; this.announce(`${cardTitle(result.card)} moved to position ${next + 1} of ${result.ids.length}.`);
  }
}
