import { EditorCommandError, reorderCard } from "./commands.js";

export const REORDER_INSTRUCTIONS = "Press Space or Enter to pick up this card, arrow keys to choose a new position, then Space or Enter to place it. Press Escape to cancel.";
const THRESHOLD = 6;

function cardTitle(card) { return card?.title || card?.id || "Untitled card"; }
export function insertionIndexFromNode(target) {
  const marker = target?.closest?.("[data-reorder-index]");
  const value = Number(marker?.dataset?.reorderIndex);
  return Number.isInteger(value) ? value : null;
}

export class CardReorderController {
  constructor(store, editorController, root) {
    this.store = store; this.editorController = editorController; this.root = root;
    this.drag = null; this.keyboard = null; this.lastAnnouncement = "";
    root.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    root.addEventListener("pointermove", (e) => this.onPointerMove(e));
    root.addEventListener("pointerup", (e) => this.onPointerUp(e));
    root.addEventListener("pointercancel", () => this.cancel("Move canceled."));
    root.addEventListener("lostpointercapture", () => { if (this.drag?.status === "dragging") this.cancel("Move canceled."); });
    root.addEventListener("keydown", (e) => this.onKeyDown(e));
  }
  isEdit() { return this.store.state.mode === "edit" && this.store.state.editor?.editing; }
  dashboard() { return this.store.state.editor?.draftDashboard; }
  section(id) { return (this.dashboard()?.sections || []).find((s) => s.id === id); }
  card(id) { return (this.dashboard()?.cards || []).find((c) => c.id === id); }
  announce(text) { this.lastAnnouncement = text; const region = this.root.querySelector("[data-reorder-live]"); if (region) region.textContent = text; }
  clearUi() { for (const n of this.root.querySelectorAll("[data-reorder-active],[data-reorder-target],[data-keyboard-moving]")) { delete n.dataset.reorderActive; delete n.dataset.reorderTarget; delete n.dataset.keyboardMoving; } this.root.querySelector("[data-reorder-preview]")?.remove(); }
  clear() { this.drag = null; this.keyboard = null; this.clearUi(); }
  position(sectionId, cardId) { const ids = this.section(sectionId)?.card_ids || []; return { ids, index: ids.indexOf(cardId) }; }
  validate(sectionId, cardId, targetIndex) {
    const section = this.section(sectionId); if (!section) throw new Error("Unable to move card.");
    const ids = section.card_ids || []; if (ids.filter((id) => id === cardId).length > 1) throw new Error("Unable to move card.");
    const index = ids.indexOf(cardId); if (index < 0) throw new Error("Unable to move card.");
    if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex > ids.length) throw new Error("Unable to move card.");
    return { ids, index };
  }
  async commit(sectionId, cardId, targetIndex, focus = true) {
    try {
      const { index } = this.validate(sectionId, cardId, targetIndex);
      const effective = targetIndex > index ? targetIndex - 1 : targetIndex;
      if (effective === index) { this.announce("Move canceled."); this.clear(); return false; }
      this.editorController.apply((draft) => reorderCard(draft, sectionId, cardId, targetIndex));
      const ok = await this.editorController.save();
      if (!ok) throw new Error("Unable to move card.");
      this.announce(`${cardTitle(this.card(cardId))} placed at position ${effective + 1} of ${this.section(sectionId)?.card_ids?.length || 0}.`);
      this.clear();
      if (focus) queueMicrotask(() => this.root.querySelector(`[data-reorder-handle][data-card-id="${CSS.escape(cardId)}"]`)?.focus());
      return true;
    } catch (error) {
      this.announce("Unable to move card."); this.clear(); return false;
    }
  }
  onPointerDown(event) {
    if (!this.isEdit()) return; const handle = event.target?.closest?.("[data-reorder-handle]"); if (!handle) return;
    event.preventDefault(); const cardId = handle.dataset.cardId; const sectionId = handle.closest("[data-section-id]")?.dataset.sectionId;
    const startIndex = indexFromSection(this.section(sectionId), cardId);
    const { ids, index } = this.validate(sectionId, cardId, startIndex);
    this.drag = { status:"pending", pointerId:event.pointerId, cardId, sectionId, originalIndex:index, proposedIndex:index, x:event.clientX, y:event.clientY };
    handle.setPointerCapture?.(event.pointerId);
  }
  onPointerMove(event) {
    if (!this.drag || event.pointerId !== this.drag.pointerId) return;
    const dx = event.clientX - this.drag.x, dy = event.clientY - this.drag.y;
    if (this.drag.status === "pending" && Math.hypot(dx, dy) < THRESHOLD) return;
    if (this.drag.status === "pending") { this.drag.status = "dragging"; this.root.querySelector(`[data-card-id="${CSS.escape(this.drag.cardId)}"]`)?.setAttribute("data-reorder-active", "true"); this.announce(`Picked up ${cardTitle(this.card(this.drag.cardId))}.`); }
    const idx = insertionIndexFromNode(event.target); if (idx !== null) { this.drag.proposedIndex = idx; for (const n of this.root.querySelectorAll("[data-reorder-target]")) delete n.dataset.reorderTarget; event.target.closest("[data-reorder-index]").dataset.reorderTarget="true"; }
  }
  onPointerUp(event) { if (!this.drag || event.pointerId !== this.drag.pointerId) return; const d = this.drag; if (d.status !== "dragging") { this.clear(); return; } this.commit(d.sectionId, d.cardId, d.proposedIndex); }
  cancel(message="Move canceled.") { if (this.drag || this.keyboard) this.announce(message); this.clear(); }
  onKeyDown(event) {
    if (!this.isEdit()) return; const handle = event.target?.closest?.("[data-reorder-handle]");
    if (event.key === "Escape" && (this.drag || this.keyboard)) { event.preventDefault(); this.cancel(); return; }
    if (!handle) return; const cardId = handle.dataset.cardId; const sectionId = handle.closest("[data-section-id]")?.dataset.sectionId; const card = this.card(cardId);
    if (!this.keyboard && [" ", "Enter"].includes(event.key)) { event.preventDefault(); const startIndex = indexFromSection(this.section(sectionId), cardId);
    const { ids, index } = this.validate(sectionId, cardId, startIndex); this.keyboard = { cardId, sectionId, originalIndex:index, proposedIndex:index }; handle.dataset.keyboardMoving="true"; this.announce(`Picked up ${cardTitle(card)}, position ${index + 1} of ${ids.length}.`); return; }
    if (!this.keyboard || this.keyboard.cardId !== cardId) return;
    const { ids } = this.validate(sectionId, cardId, this.keyboard.proposedIndex); let next = this.keyboard.proposedIndex;
    if (["ArrowUp","ArrowLeft"].includes(event.key)) next = Math.max(0, next - 1); else if (["ArrowDown","ArrowRight"].includes(event.key)) next = Math.min(ids.length - 1, next + 1); else if (event.key === "Home") next = 0; else if (event.key === "End") next = ids.length - 1; else if ([" ","Enter"].includes(event.key)) { event.preventDefault(); this.commit(sectionId, cardId, this.keyboard.proposedIndex, true); return; } else return;
    event.preventDefault(); this.keyboard.proposedIndex = next; this.announce(`${cardTitle(card)} moved to position ${next + 1} of ${ids.length}.`);
  }
}
function indexFromSection(section, cardId) { return (section?.card_ids || []).indexOf(cardId); }
