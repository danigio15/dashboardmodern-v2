import { el, emptyState } from "../render/dom.js";
import { fieldError, textInput } from "../editor/dashboard-form.js";
import { ICON_IDS, isIconId, renderIcon } from "./icon-registry.js";

export const HOME_SUMMARY_TYPE = "home-summary";
export const HOME_SUMMARY_MAX_ITEMS = 8;
export const SUMMARY_ACCENTS = Object.freeze(["solar", "ev", "load", "battery", "green", "accent", "warning", "danger"]);
const DEFAULT_ITEMS = Object.freeze([
  { key: "lights", label: "Luci Accese", entityId: "", icon: "lights", accent: "solar", suffix: "", fallbackText: "Configura" },
  { key: "climate", label: "Clima Attivi", entityId: "", icon: "climate", accent: "ev", suffix: "", fallbackText: "Configura" },
  { key: "heating", label: "Riscaldamento", entityId: "", icon: "heating", accent: "load", suffix: "", fallbackText: "Configura" },
  { key: "openings", label: "Aperture", entityId: "", icon: "door", accent: "danger", suffix: "", fallbackText: "Configura" },
  { key: "batteries", label: "Batt. Scariche", entityId: "", icon: "battery", accent: "battery", suffix: "", fallbackText: "Configura" },
]);
const TEMPLATE_PATTERN = /\{\{|\}\}|\{%|%\}|<script|javascript:/i;
export function defaultHomeSummaryConfig() { return { title: "Quadro Avvisi", items: DEFAULT_ITEMS.map((item) => ({ ...item })) }; }
function isAccent(value) { return SUMMARY_ACCENTS.includes(value); }
function cleanItem(item = {}, index = 0) { return { key: typeof item.key === "string" && item.key.trim() ? item.key : `item-${index + 1}`, label: typeof item.label === "string" ? item.label : "", entityId: typeof item.entityId === "string" ? item.entityId : "", icon: isIconId(item.icon) ? item.icon : "alert", accent: isAccent(item.accent) ? item.accent : "green", suffix: typeof item.suffix === "string" ? item.suffix : "", fallbackText: typeof item.fallbackText === "string" ? item.fallbackText : "—" }; }
export function nextHomeSummaryItemKey(items = []) { const keys = new Set((Array.isArray(items) ? items : []).map((item) => item?.key).filter((key) => typeof key === "string")); let index = 1; while (keys.has(`item-${index}`)) index += 1; return `item-${index}`; }
export function normalizeSummaryMetric(state, { locale = "it-IT", suffix = "", fallbackText = "—", missingConfig = false } = {}) {
  if (missingConfig) return { status: "missing-config", display: fallbackText, available: false };
  if (!state) return { status: "missing-entity", display: fallbackText, available: false };
  const raw = String(state.state ?? "").trim();
  if (raw === "unknown") return { status: "unknown", display: fallbackText, available: false };
  if (raw === "unavailable" || raw === "") return { status: "unavailable", display: fallbackText, available: false };
  const value = Number(raw.replace(",", "."));
  if (!Number.isFinite(value)) return { status: "malformed", display: fallbackText, available: false };
  return { status: "ok", value, display: `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)}${suffix}`, available: true };
}
export function normalizeHomeSummaryItems(runtime = {}, config = {}) {
  const locale = runtime.locale || "it-IT";
  return (Array.isArray(config.items) ? config.items : []).map((rawItem, index) => {
    const item = cleanItem(rawItem, index);
    const metric = normalizeSummaryMetric(runtime.getEntityState?.(item.entityId), { locale, suffix: item.suffix, fallbackText: item.fallbackText, missingConfig: !item.entityId.trim() });
    return { ...item, ...metric };
  });
}
export function validateHomeSummaryConfig(c = {}) {
  const errors = [];
  if (!c || typeof c !== "object" || Array.isArray(c)) return [{ field: "config", message: "Config must be an object." }];
  if (c.title !== undefined && typeof c.title !== "string") errors.push({ field: "config.title", message: "title must be a string." });
  if (!Array.isArray(c.items)) return [...errors, { field: "config.items", message: "items must be an array." }];
  if (c.items.length > HOME_SUMMARY_MAX_ITEMS) errors.push({ field: "config.items", message: `items can contain at most ${HOME_SUMMARY_MAX_ITEMS} entries.` });
  const seenKeys = new Set();
  c.items.forEach((item, i) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) { errors.push({ field: `config.items.${i}`, message: "item must be an object." }); return; }
    for (const key of ["key", "label", "entityId"]) if (typeof item[key] !== "string" || !item[key].trim()) errors.push({ field: `config.items.${i}.${key}`, message: `${key} is required.` });
    if (typeof item.key === "string" && item.key.trim()) { if (seenKeys.has(item.key)) errors.push({ field: `config.items.${i}.key`, message: "key must be unique." }); else seenKeys.add(item.key); }
    for (const key of ["key", "label", "entityId", "suffix", "fallbackText"]) if (item[key] !== undefined && typeof item[key] === "string" && TEMPLATE_PATTERN.test(item[key])) errors.push({ field: `config.items.${i}.${key}`, message: `${key} cannot contain templates or executable expressions.` });
    if (!isIconId(item.icon)) errors.push({ field: `config.items.${i}.icon`, message: `icon must be one of: ${ICON_IDS.join(", ")}.` });
    if (!isAccent(item.accent)) errors.push({ field: `config.items.${i}.accent`, message: `accent must be one of: ${SUMMARY_ACCENTS.join(", ")}.` });
    for (const key of ["suffix", "fallbackText"]) if (item[key] !== undefined && typeof item[key] !== "string") errors.push({ field: `config.items.${i}.${key}`, message: `${key} must be text.` });
  });
  return errors;
}
function patchItems(card, controller, items) { controller.updateCardConfigPatch(card.id, { items }); }
function itemEditor(documentRef, card, controller, item, index, count) {
  const row = documentRef.createElement("fieldset"); row.className = "dm-summary-editor-row";
  const legend = documentRef.createElement("legend"); legend.textContent = `Summary item ${index + 1}`; row.append(legend);
  const update = (patch) => { const items = [...(card.config?.items || [])]; items[index] = { ...items[index], ...patch }; patchItems(card, controller, items); };
  row.append(textInput(documentRef, "Key", item.key || "", (key) => update({ key }), `card:${card.id}:config.items.${index}.key`));
  row.append(textInput(documentRef, "Label", item.label || "", (label) => update({ label }), `card:${card.id}:config.items.${index}.label`));
  row.append(textInput(documentRef, "Entity id", item.entityId || "", (entityId) => update({ entityId }), `card:${card.id}:config.items.${index}.entityId`));
  row.append(textInput(documentRef, "Suffix", item.suffix || "", (suffix) => update({ suffix }), `card:${card.id}:config.items.${index}.suffix`));
  const icon = documentRef.createElement("select"); icon.dataset.editorField = `card:${card.id}:config.items.${index}.icon`; for (const id of ICON_IDS) { const opt = documentRef.createElement("option"); opt.value = id; opt.textContent = id; opt.selected = (item.icon || "alert") === id; icon.append(opt); } icon.addEventListener("change", () => update({ icon: icon.value })); const iconLabel = documentRef.createElement("label"); iconLabel.textContent = "Icon "; iconLabel.append(icon); row.append(iconLabel);
  const accent = documentRef.createElement("select"); accent.dataset.editorField = `card:${card.id}:config.items.${index}.accent`; for (const id of SUMMARY_ACCENTS) { const opt = documentRef.createElement("option"); opt.value = id; opt.textContent = id; opt.selected = (item.accent || "green") === id; accent.append(opt); } accent.addEventListener("change", () => update({ accent: accent.value })); const accentLabel = documentRef.createElement("label"); accentLabel.textContent = "Accent "; accentLabel.append(accent); row.append(accentLabel);
  const actions = documentRef.createElement("div"); actions.className = "dm-summary-editor-actions";
  const buttons = [["↑", () => { if (index > 0) { const items = [...card.config.items]; [items[index - 1], items[index]] = [items[index], items[index - 1]]; patchItems(card, controller, items); } }, index === 0], ["↓", () => { if (index < count - 1) { const items = [...card.config.items]; [items[index + 1], items[index]] = [items[index], items[index + 1]]; patchItems(card, controller, items); } }, index === count - 1], ["Remove", () => patchItems(card, controller, card.config.items.filter((_, i) => i !== index)), false]];
  for (const [label, onClick, disabled] of buttons) { const button = documentRef.createElement("button"); button.type = "button"; button.textContent = label; button.disabled = disabled; button.addEventListener("click", onClick); actions.append(button); }
  row.append(actions); return row;
}
export function renderHomeSummaryEditor(documentRef, card, controller, errors = []) {
  const form = documentRef.createElement("section"); form.className = "dashboardmodern-plugin-editor";
  const items = Array.isArray(card.config?.items) ? card.config.items : [];
  form.append(textInput(documentRef, "Title", card.config?.title || "", (title) => controller.updateCardConfigPatch(card.id, { title }), `card:${card.id}:config.title`));
  items.forEach((item, index) => form.append(itemEditor(documentRef, card, controller, item, index, items.length)));
  const add = documentRef.createElement("button"); add.type = "button"; add.textContent = "Add item"; add.addEventListener("click", () => patchItems(card, controller, [...items, { key: nextHomeSummaryItemKey(items), label: "", entityId: "", icon: "alert", accent: "green", suffix: "", fallbackText: "—" }])); form.append(add);
  for (const error of errors) form.append(fieldError(documentRef, error.message));
  return form;
}
export function renderHomeSummaryCard(card, runtime = {}) {
  const c = { ...defaultHomeSummaryConfig(), ...(card.config || {}) };
  const shell = el("article", { className: "dashboardmodern-card legacy-card dm-home-summary", attrs: { "data-card-kind": HOME_SUMMARY_TYPE } });
  shell.append(el("h3", { className: "section-title", text: c.title || card.title || "Quadro Avvisi" }));
  const grid = el("div", { className: "glance-grid" });
  const items = normalizeHomeSummaryItems(runtime, c);
  for (const item of items) {
    const gc = el("button", { className: "glance-card", attrs: { type: "button", "aria-label": `${item.label}: ${item.display}`, "data-status": item.status, "data-accent": item.accent } });
    gc.append(el("div", { className: "g-info" }, [el("span", { className: "g-name", text: item.label }), el("span", { className: "g-val", text: item.display })]));
    const iconWrap = el("div", { className: "g-icon-wrap anim-ping" }); iconWrap.append(renderIcon(item.icon, { label: item.label })); gc.append(iconWrap);
    if (item.available) gc.addEventListener("click", () => runtime.interactions?.openHistory?.(item.entityId, item.label));
    grid.append(gc);
  }
  if (!items.length) grid.append(emptyState("Configura almeno un indicatore Home."));
  shell.append(grid); return shell;
}
