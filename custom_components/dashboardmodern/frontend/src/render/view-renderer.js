import { renderSection } from "./section-renderer.js";
import { el, emptyState, safeDomId } from "./dom.js";

function orderedByIds(items, ids = []) {
  const byId = new Map((Array.isArray(items) ? items : []).map((item) => [item?.id, item]));
  return (Array.isArray(ids) ? ids : []).map((id) => byId.get(id)).filter(Boolean);
}

export function renderView(view, dashboard, context = {}) {
  const wrapper = el("section", {
    className: "dashboardmodern-view",
    attrs: { id: safeDomId("view", view?.id), "data-view-id": view?.id ?? "" },
  });
  wrapper.append(el("h2", { text: view?.title || "Untitled view" }));
  if (view?.description) wrapper.append(el("p", { className: "dashboardmodern-view-description", text: view.description }));
  const sections = orderedByIds(dashboard?.sections, view?.section_ids);
  if (!sections.length) {
    wrapper.append(emptyState("This view has no sections yet."));
    return wrapper;
  }
  for (const section of sections) {
    const cards = orderedByIds(dashboard?.cards, section.card_ids);
    wrapper.append(renderSection(section, cards, context));
  }
  return wrapper;
}
