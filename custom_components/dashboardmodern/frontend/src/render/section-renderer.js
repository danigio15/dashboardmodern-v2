import { renderCard } from "./card-renderer.js";
import { el, emptyState, safeDomId } from "./dom.js";
import { DEFAULT_SECTION_REGISTRY } from "../sections/registry.js";

function insertionMarker(section, index, active) {
  return el("div", {
    className: "dashboardmodern-reorder-insertion",
    text: "Insert here",
    attrs: { "data-section-id": section?.id ?? "", "data-reorder-index": String(index), "aria-hidden": active ? "false" : "true" },
  });
}

export function renderBuiltInSection(section, cards = [], context = {}) {
  const wrapper = el("section", {
    className: "dashboardmodern-section",
    attrs: { id: safeDomId("section", section?.id), "data-section-id": section?.id ?? "" },
  });
  wrapper.append(el("h3", { text: section?.title || "Untitled section" }));
  if (section?.description) wrapper.append(el("p", { className: "dashboardmodern-section-description", text: section.description }));
  const grid = el("div", { className: "dashboardmodern-card-grid" });
  const reorderActive = Boolean(context.editMode);
  if (!cards.length) grid.append(emptyState("This section has no cards yet."));
  cards.forEach((card, index) => {
    if (reorderActive) grid.append(insertionMarker(section, index, reorderActive));
    grid.append(renderCard(card, context, { registry: context.cardRegistry }));
  });
  if (reorderActive) grid.append(insertionMarker(section, cards.length, reorderActive));
  wrapper.append(grid);
  if (reorderActive && !wrapper.querySelector?.("[data-reorder-live]")) {
    wrapper.append(el("p", { className: "dashboardmodern-reorder-error", attrs: { "data-reorder-error": "", role: "status", hidden: "" } }));
    wrapper.append(el("div", { className: "dashboardmodern-reorder-live", attrs: { "aria-live": "polite", "aria-atomic": "true", "data-reorder-live": "" } }));
  }
  return wrapper;
}

export function renderSection(section, cards = [], context = {}) {
  const registry = context.sectionRegistry || DEFAULT_SECTION_REGISTRY;
  const explicitType = typeof section?.type === "string" && section.type.trim();
  const definition = explicitType ? registry.resolve(section.type) : registry.get("custom");
  const errors = definition?.validator?.(section?.config || {}, section) || [];
  if (errors.length && context.sectionValidationErrors) context.sectionValidationErrors.set(section?.id, errors);
  if (definition?.renderer) return definition.renderer(section, cards, context);
  if (explicitType && definition?.type === "unknown-section") return definition.renderer(section, cards, context);
  return renderBuiltInSection(section, cards, context);
}
