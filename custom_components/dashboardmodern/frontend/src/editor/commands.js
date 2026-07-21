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
  return fields(clone(dashboard), patch, ["title", "description"]);
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
  draft.sections = [...(draft.sections || []), { id, title: patch.title || "New section", description: patch.description || "", card_ids: [] }];
  draft.views = (draft.views || []).map((view) => view.id === viewId ? { ...view, section_ids: [...(view.section_ids || []), id] } : view);
  return draft;
}

export function updateSection(dashboard, id, patch) {
  const draft = clone(dashboard);
  draft.sections = (draft.sections || []).map((section) => section.id === id ? fields(section, patch, ["title", "description"]) : section);
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

export function parseCardConfig(text) {
  const value = JSON.parse(text || "{}");
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new EditorCommandError("Card config must be a JSON object.");
  return value;
}
