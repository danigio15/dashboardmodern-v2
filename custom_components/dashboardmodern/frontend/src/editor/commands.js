export class EditorCommandError extends Error {
  constructor(message) {
    super(message);
    this.name = "EditorCommandError";
  }
}

function clone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, clone(child)]));
  return value;
}

export function cloneDashboard(dashboard) {
  return clone(dashboard);
}

export function collectIds(dashboard) {
  return new Set([dashboard?.id, ...(dashboard?.views || []).map((item) => item.id), ...(dashboard?.sections || []).map((item) => item.id), ...(dashboard?.cards || []).map((item) => item.id)].filter(Boolean));
}

export function createIdGenerator(prefix = "node", sequence = [1]) {
  return (used = new Set()) => {
    let id;
    do {
      id = `${prefix}-${sequence[0]++}`;
    } while (used.has(id));
    return id;
  };
}

function assertUniqueId(dashboard, id) {
  if (!id || typeof id !== "string") throw new EditorCommandError("Editor node id must be a non-empty string.");
  if (collectIds(dashboard).has(id)) throw new EditorCommandError(`Duplicate editor node id: ${id}`);
  return id;
}

function nextId(dashboard, patch, generator) {
  return assertUniqueId(dashboard, patch.id || generator(collectIds(dashboard)));
}

function assertView(dashboard, viewId) {
  if (!(dashboard?.views || []).some((view) => view.id === viewId)) throw new EditorCommandError(`Cannot add section because view does not exist: ${viewId}`);
}

function assertSection(dashboard, sectionId) {
  if (!(dashboard?.sections || []).some((section) => section.id === sectionId)) throw new EditorCommandError(`Cannot add card because section does not exist: ${sectionId}`);
}

function move(items, id, delta) {
  const ordered = [...items];
  const from = ordered.indexOf(id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= ordered.length) return ordered;
  [ordered[from], ordered[to]] = [ordered[to], ordered[from]];
  return ordered;
}

function fields(item, patch, names) {
  const next = { ...item };
  for (const name of names) if (Object.hasOwn(patch, name)) next[name] = patch[name];
  return next;
}

export function updateDashboardMetadata(dashboard, patch) {
  return fields(clone(dashboard), patch, ["title", "description", "config"]);
}

export function addView(dashboard, patch = {}, generator = createIdGenerator("view")) {
  const id = nextId(dashboard, patch, generator);
  const draft = clone(dashboard);
  draft.views = [...(draft.views || []), { id, title: patch.title || "New view", description: patch.description || "", section_ids: [] }];
  return draft;
}

export function updateView(dashboard, id, patch) {
  const draft = clone(dashboard);
  draft.views = (draft.views || []).map((view) => view.id === id ? fields(view, patch, ["title", "description"]) : view);
  return draft;
}

export function removeView(dashboard, id) {
  const draft = clone(dashboard);
  const view = (draft.views || []).find((item) => item.id === id);
  const sectionIds = new Set(view?.section_ids || []);
  const cardIds = new Set((draft.sections || []).filter((section) => sectionIds.has(section.id)).flatMap((section) => section.card_ids || []));
  draft.views = (draft.views || []).filter((item) => item.id !== id);
  draft.sections = (draft.sections || []).filter((section) => !sectionIds.has(section.id));
  draft.cards = (draft.cards || []).filter((card) => !cardIds.has(card.id));
  return draft;
}

export function moveView(dashboard, id, direction) {
  const draft = clone(dashboard);
  const ids = move((draft.views || []).map((view) => view.id), id, direction);
  draft.views = ids.map((viewId) => draft.views.find((view) => view.id === viewId));
  return draft;
}

export function addSection(dashboard, viewId, patch = {}, generator = createIdGenerator("section")) {
  assertView(dashboard, viewId);
  const id = nextId(dashboard, patch, generator);
  const draft = clone(dashboard);
  const config = clone(patch.config || {});
  if (Array.isArray(config.widgets)) { const used = new Set([...collectIds(dashboard), ...allWidgetIds(dashboard), id]); config.widgets = config.widgets.map((widget, index) => { let widgetId = `${id}-widget-${index + 1}`, suffix = 1; while (used.has(widgetId)) widgetId = `${id}-widget-${index + 1}-${++suffix}`; used.add(widgetId); return { ...widget, id: widgetId }; }); }
  draft.sections = [...(draft.sections || []), { id, title: patch.title || "New section", description: patch.description || "", type: patch.type, icon: patch.icon, config, card_ids: [] }];
  draft.views = (draft.views || []).map((view) => view.id === viewId ? { ...view, section_ids: [...(view.section_ids || []), id] } : view);
  return draft;
}

export function updateSection(dashboard, id, patch) {
  const draft = clone(dashboard);
  draft.sections = (draft.sections || []).map((section) => section.id === id ? fields(section, patch, ["title", "description", "type", "icon", "enabled", "visibleInNavbar", "order", "accent", "badge", "visibility", "navigation"]) : section);
  return draft;
}

export function removeSection(dashboard, id) {
  const draft = clone(dashboard);
  const section = (draft.sections || []).find((item) => item.id === id);
  const cardIds = new Set(section?.card_ids || []);
  draft.views = (draft.views || []).map((view) => ({ ...view, section_ids: (view.section_ids || []).filter((sectionId) => sectionId !== id) }));
  draft.sections = (draft.sections || []).filter((item) => item.id !== id);
  draft.cards = (draft.cards || []).filter((card) => !cardIds.has(card.id));
  return draft;
}

export function moveSection(dashboard, viewId, id, direction) {
  const draft = clone(dashboard);
  draft.views = (draft.views || []).map((view) => view.id === viewId ? { ...view, section_ids: move(view.section_ids || [], id, direction) } : view);
  return draft;
}

export function addCard(dashboard, sectionId, patch = {}, generator = createIdGenerator("card")) {
  assertSection(dashboard, sectionId);
  const id = nextId(dashboard, patch, generator);
  const config = patch.config && typeof patch.config === "object" && !Array.isArray(patch.config) ? clone(patch.config) : {};
  const draft = clone(dashboard);
  draft.cards = [...(draft.cards || []), { id, title: patch.title || "New card", type: patch.type || "custom", config }];
  draft.sections = (draft.sections || []).map((section) => section.id === sectionId ? { ...section, card_ids: [...(section.card_ids || []), id] } : section);
  return draft;
}

export function updateCard(dashboard, id, patch) {
  const draft = clone(dashboard);
  draft.cards = (draft.cards || []).map((card) => card.id === id ? fields(card, patch, ["title", "type", "config", "layout"]) : card);
  return draft;
}

export function removeCard(dashboard, id) {
  const draft = clone(dashboard);
  draft.sections = (draft.sections || []).map((section) => ({ ...section, card_ids: (section.card_ids || []).filter((cardId) => cardId !== id) }));
  draft.cards = (draft.cards || []).filter((card) => card.id !== id);
  return draft;
}

export function moveCard(dashboard, sectionId, id, direction) {
  const draft = clone(dashboard);
  draft.sections = (draft.sections || []).map((section) => section.id === sectionId ? { ...section, card_ids: move(section.card_ids || [], id, direction) } : section);
  return draft;
}

function assertNonEmptyString(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new EditorCommandError(`${name} must be a non-empty string.`);
}

function assertTargetIndex(value) {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) throw new EditorCommandError("targetIndex must be a non-negative finite integer.");
}

export function reorderCard(dashboard, sectionId, cardId, targetIndex) {
  assertNonEmptyString(sectionId, "sectionId");
  assertNonEmptyString(cardId, "cardId");
  assertTargetIndex(targetIndex);
  const section = (dashboard?.sections || []).find((item) => item.id === sectionId);
  if (!section) throw new EditorCommandError(`Cannot reorder card because section does not exist: ${sectionId}`);
  const ids = section.card_ids || [];
  if (ids.filter((id) => id === cardId).length > 1) throw new EditorCommandError(`Cannot reorder malformed section with duplicate card id: ${cardId}`);
  const from = ids.indexOf(cardId);
  if (from < 0) throw new EditorCommandError(`Cannot reorder card because card does not exist in section: ${cardId}`);
  if (targetIndex > ids.length) throw new EditorCommandError("targetIndex is beyond the destination length.");
  const to = targetIndex > from ? targetIndex - 1 : targetIndex;
  if (to === from) return clone(dashboard);
  const nextIds = ids.filter((id) => id !== cardId);
  nextIds.splice(to, 0, cardId);
  const draft = clone(dashboard);
  draft.sections = (draft.sections || []).map((item) => item.id === sectionId ? { ...item, card_ids: nextIds } : item);
  return draft;
}

export function parseCardConfig(text) {
  const value = JSON.parse(text || "{}");
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new EditorCommandError("Card config must be a JSON object.");
  return value;
}

function widgetIds(section = {}) { return (section.config?.widgets || []).map((widget) => widget?.id).filter(Boolean); }
function allWidgetIds(dashboard = {}) { return new Set((dashboard.sections || []).flatMap(widgetIds)); }
function assertWidgetSection(dashboard, sectionId) { const section = (dashboard.sections || []).find((item) => item.id === sectionId); if (!section) throw new EditorCommandError(`Cannot edit widgets because section does not exist: ${sectionId}`); return section; }
function widgetId(dashboard, section, patch = {}, generator = createIdGenerator("widget")) { const used = new Set([...collectIds(dashboard), ...allWidgetIds(dashboard)]); const id = patch.id || generator(used); if (!id || typeof id !== "string") throw new EditorCommandError("Widget id must be a non-empty string."); if (used.has(id)) throw new EditorCommandError(`Duplicate widget id: ${id}`); return id; }
function updateSectionWidgets(dashboard, sectionId, updater) { const draft = clone(dashboard); draft.sections = (draft.sections || []).map((section) => section.id === sectionId ? { ...section, config: { ...(section.config || {}), widgets: updater([...(section.config?.widgets || [])]) } } : section); return draft; }
export function addWidget(dashboard, sectionId, patch = {}, generator = createIdGenerator("widget")) { const section = assertWidgetSection(dashboard, sectionId); const id = widgetId(dashboard, section, patch, generator); return updateSectionWidgets(dashboard, sectionId, (widgets) => [...widgets, { id, type: patch.type || "custom", title: patch.title || "New widget", enabled: patch.enabled !== false, layout: { size: patch.layout?.size || "medium" }, config: clone(patch.config || {}) }]); }
export function updateWidget(dashboard, sectionId, widgetIdValue, patch = {}) { assertWidgetSection(dashboard, sectionId); return updateSectionWidgets(dashboard, sectionId, (widgets) => widgets.map((widget) => widget.id === widgetIdValue ? { ...widget, ...fields(widget, patch, ["title", "type", "enabled", "layout", "config"]) } : widget)); }
export function removeWidget(dashboard, sectionId, widgetIdValue) { assertWidgetSection(dashboard, sectionId); return updateSectionWidgets(dashboard, sectionId, (widgets) => widgets.filter((widget) => widget.id !== widgetIdValue)); }
export function duplicateWidget(dashboard, sectionId, widgetIdValue, generator = createIdGenerator("widget")) { const section = assertWidgetSection(dashboard, sectionId); const widget = (section.config?.widgets || []).find((item) => item.id === widgetIdValue); if (!widget) throw new EditorCommandError(`Cannot duplicate missing widget: ${widgetIdValue}`); const id = widgetId(dashboard, section, {}, generator); return updateSectionWidgets(dashboard, sectionId, (widgets) => { const index = widgets.findIndex((item) => item.id === widgetIdValue); const copy = { ...clone(widget), id, title: `${widget.title || widget.type} copy` }; const next = [...widgets]; next.splice(index + 1, 0, copy); return next; }); }
export function moveWidget(dashboard, sectionId, widgetIdValue, direction) { assertWidgetSection(dashboard, sectionId); return updateSectionWidgets(dashboard, sectionId, (widgets) => move(widgets.map((w) => w.id), widgetIdValue, direction).map((id) => widgets.find((w) => w.id === id))); }
