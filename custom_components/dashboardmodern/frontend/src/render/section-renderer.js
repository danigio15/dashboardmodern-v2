import { renderCard } from "./card-renderer.js";
import { el, emptyState, safeDomId } from "./dom.js";

export function renderSection(section, cards = [], context = {}) {
  const wrapper = el("section", {
    className: "dashboardmodern-section",
    attrs: { id: safeDomId("section", section?.id), "data-section-id": section?.id ?? "" },
  });
  wrapper.append(el("h3", { text: section?.title || "Untitled section" }));
  if (section?.description) wrapper.append(el("p", { className: "dashboardmodern-section-description", text: section.description }));
  const grid = el("div", { className: "dashboardmodern-card-grid" });
  if (!cards.length) grid.append(emptyState("This section has no cards yet."));
  for (const card of cards) grid.append(renderCard(card, context));
  wrapper.append(grid);
  return wrapper;
}
