// Beta 26 follow-up for real-device configuration contracts:
// - saving configured data automatically exposes the related public section;
// - Temperature room tabs keep their filter after delayed card repaints;
// - Temperature editor room icons are rendered once with a stable canonical glyph;
// - Energy > Loads becomes a root-flow -> child-load editor while preserving legacy loads.
//
// The only MutationObserver in this module is scoped to #temp-grid and #ed-body.

import { VISIBILITY_SECTION, hasConfiguredData } from "../core/dashboard-store.js";
import { directEmoji, roomGlyph } from "../core/personalization-catalog.js";
import {
  allStates,
  clean,
  dashboardStore,
  doc,
  english,
  esc,
  installStyle,
  root,
  section,
  wrapFunction,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_BETA26_CONFIG_FOLLOWUP__";
const FLOW_ROOT_LIMIT = 5;
const DEFAULT_FLOW_COLOR = "#f97316";
const state = (root[KEY] ||= {
  installed: false,
  listeners: false,
  frame: 0,
  store: null,
  storeUnsubscribe: null,
  observer: null,
  observedGrid: null,
  observedEditor: null,
  editorDraft: null,
  popupParentId: "",
});

const loadList = () => {
  const values = section("loads", []);
  return Array.isArray(values) ? values : [];
};
const applianceList = () => {
  const values = section("appliances", []);
  return Array.isArray(values) ? values : [];
};
const roomList = () => {
  const values = section("rooms", []);
  return Array.isArray(values) ? values : [];
};
const flowMetadata = (load = {}) =>
  load?.metadata && typeof load.metadata === "object" && !Array.isArray(load.metadata)
    ? load.metadata
    : {};

export function flowParentId(load = {}) {
  return clean(flowMetadata(load).flow_parent_id);
}

export function flowRootLoads(loads = []) {
  return (Array.isArray(loads) ? loads : [])
    .filter((load) => load && load.category !== "manual-report" && !flowParentId(load))
    .slice()
    .sort((left, right) => (Number(left.order) || 0) - (Number(right.order) || 0));
}

export function flowChildren(loads = [], parentId = "") {
  const parent = clean(parentId);
  return (Array.isArray(loads) ? loads : [])
    .filter(
      (load) =>
        load &&
        load.category !== "manual-report" &&
        parent &&
        flowParentId(load) === parent,
    )
    .slice()
    .sort((left, right) => (Number(left.order) || 0) - (Number(right.order) || 0));
}

export function flowPeriodEntity(load = {}, period = "instant") {
  if (period === "day") return clean(load.daily_energy_entity);
  if (period === "month")
    return clean(load.monthly_energy_entity || load.history_entity || load.total_energy_entity);
  return clean(load.power_entity);
}

function stateNumber(entity, states = allStates()) {
  const source = states?.[clean(entity)];
  const value = Number.parseFloat(source?.state ?? source);
  return Number.isFinite(value) ? value : null;
}

function linkedAppliance(load = {}, appliances = applianceList()) {
  const linkedId = clean(flowMetadata(load).linked_appliance_id);
  return linkedId
    ? (Array.isArray(appliances) ? appliances : []).find((item) => clean(item.id) === linkedId) || null
    : null;
}

export function resolveFlowLoad(load = {}, appliances = []) {
  const linked = linkedAppliance(load, appliances);
  if (!linked) return { ...load };
  const resolved = { ...linked, ...load };
  for (const key of [
    "name",
    "icon",
    "emoji_icon",
    "room_id",
    "power_entity",
    "daily_energy_entity",
    "monthly_energy_entity",
    "total_energy_entity",
    "history_entity",
    "state_entity",
    "control_entity",
    "visual_type",
    "visual_key",
    "device_type",
  ]) {
    if (!clean(load[key])) resolved[key] = linked[key] || "";
  }
  resolved.metadata = { ...(linked.metadata || {}), ...(load.metadata || {}) };
  return resolved;
}

export function aggregateFlowValue(
  parent = {},
  loads = [],
  period = "instant",
  states = {},
  appliances = [],
) {
  const mode = clean(flowMetadata(parent).flow_aggregate || "sensor").toLowerCase();
  if (mode !== "children") {
    return stateNumber(flowPeriodEntity(resolveFlowLoad(parent, appliances), period), states);
  }
  const values = flowChildren(loads, parent.id)
    .filter((child) => child.enabled !== false)
    .map((child) => resolveFlowLoad(child, appliances))
    .map((child) => stateNumber(flowPeriodEntity(child, period), states))
    .filter((value) => value !== null);
  return values.length ? values.reduce((total, value) => total + value, 0) : null;
}

export function roomFilterMatches(cardRoomId = "", filter = "all") {
  const selected = clean(filter) || "all";
  return selected === "all" || clean(cardRoomId) === selected;
}

export function shouldAutoShowAfterSave(sectionName, value, visibility = {}) {
  const name = clean(sectionName);
  if (!name || name === "visibility" || name === "entityOverrides") return false;
  const key = VISIBILITY_SECTION[name] || name;
  return Boolean(key && hasConfiguredData(name, value) && visibility?.[key] !== true);
}

async function ensureVisibilityAfterSave(store, sectionName) {
  if (!store?.getState || !store?.getSection || !store?.transact) return false;
  const name = clean(sectionName);
  if (!shouldAutoShowAfterSave(name, store.getSection(name), store.getState().visibility))
    return false;
  await store.transact(name, "auto-visible-after-save", () => store.getSection(name));
  root.cdApplyNavVis?.();
  return true;
}

export function installVisibilitySaveContract(store = dashboardStore()) {
  if (!store) return false;
  let wrapped = false;
  for (const methodName of ["addItem", "updateItem", "replaceSection"]) {
    const current = store[methodName];
    if (typeof current !== "function" || current.__dmBeta26AutoVisibility) continue;
    async function autoVisibleWrite(...args) {
      const result = await current.apply(this, args);
      await ensureVisibilityAfterSave(this, args[0]);
      return result;
    }
    Object.assign(autoVisibleWrite, current);
    autoVisibleWrite.__dmBeta26AutoVisibility = true;
    autoVisibleWrite.__dmPrevious = current;
    store[methodName] = autoVisibleWrite;
    wrapped = true;
  }
  return wrapped;
}

function safeColor(value, fallback = DEFAULT_FLOW_COLOR) {
  const token = clean(value);
  return /^#[0-9a-f]{6}$/i.test(token) ? token : fallback;
}

function flowIcon(load = {}, size = 28) {
  const token = clean(load.emoji_icon || load.icon || load.visual_key || load.device_type || "🔌");
  const artworkKey = clean(load.visual_key || load.device_type);
  if (artworkKey && typeof root.cdApplianceIcon === "function") {
    const artwork = root.cdApplianceIcon(artworkKey, size);
    if (artwork) return artwork;
  }
  const markup = root.DashboardModernIconEngine?.markup?.("action", token, { size });
  if (markup) return markup;
  if (/^mdi:/i.test(token) && typeof root.cdIconMarkup === "function")
    return root.cdIconMarkup(token, size);
  return esc(token || "🔌");
}

function metricText(value, period) {
  if (value === null || !Number.isFinite(Number(value))) return "—";
  const locale = english() ? "en-GB" : "it-IT";
  const digits = period === "instant" ? 0 : 1;
  return `${Number(value).toLocaleString(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} ${period === "instant" ? "W" : "kWh"}`;
}

function entityField(id, label, value = "", placeholder = "sensor.entity") {
  return `<label class="ed-slot dm-flow-entity-field"><span class="ed-slot-lbl">${esc(label)} <span class="ed-acc-n">${english() ? "Optional" : "Facoltativo"}</span></span><span class="ed-form-row"><input id="${id}" class="ed-input ed-slot-in mono" value="${esc(value)}" placeholder="${esc(placeholder)}"><button type="button" class="dm-entity-picker" data-dm-flow-pick="${id}" aria-label="${english() ? "Select entity" : "Seleziona entità"}">🔍</button></span></label>`;
}

function roomOptions(selected = "") {
  const current = clean(selected);
  return `<option value="">— ${english() ? "No room" : "Nessuna stanza"} —</option>${roomList()
    .map((room) => {
      const id = clean(room.id || room.name);
      const glyph = directEmoji(room.icon) || roomGlyph(room.icon);
      return `<option value="${esc(id)}" ${id === current ? "selected" : ""}>${esc(glyph)} ${esc(clean(room.name) || id)}</option>`;
    })
    .join("")}`;
}

function applianceOptions(selected = "") {
  const current = clean(selected);
  return `<option value="">— ${english() ? "Manual load" : "Carico manuale"} —</option>${applianceList()
    .map((device) => {
      const id = clean(device.id);
      const name = clean(device.name) || clean(device.device_type) || (english() ? "Appliance" : "Elettrodomestico");
      return `<option value="${esc(id)}" ${id === current ? "selected" : ""}>${esc(name)}</option>`;
    })
    .join("")}`;
}

function childSummary(child, appliances) {
  const resolved = resolveFlowLoad(child, appliances);
  const source = clean(resolved.power_entity) || (english() ? "No power sensor" : "Nessun sensore potenza");
  return `${esc(source)}${flowMetadata(child).linked_appliance_id ? ` · 🔗 ${english() ? "appliance" : "elettrodomestico"}` : ""}`;
}

function childRow(child, index, count, appliances) {
  const resolved = resolveFlowLoad(child, appliances);
  const name = clean(resolved.name) || (english() ? "Child load" : "Sottocarico");
  const color = safeColor(flowMetadata(child).flow_color, DEFAULT_FLOW_COLOR);
  return `<div class="dm-flow-child-row" data-dm-flow-child="${esc(child.id)}" style="--dm-flow-item-color:${color}"><span class="dm-flow-list-icon">${flowIcon(resolved, 30)}</span><span class="dm-flow-list-main"><strong>${esc(name)}</strong><small>${childSummary(child, appliances)}</small></span><span class="dm-flow-row-actions"><button type="button" data-dm-flow-up="${esc(child.id)}" ${index === 0 ? "disabled" : ""} aria-label="${english() ? "Move up" : "Sposta su"}">↑</button><button type="button" data-dm-flow-down="${esc(child.id)}" ${index === count - 1 ? "disabled" : ""} aria-label="${english() ? "Move down" : "Sposta giù"}">↓</button><button type="button" data-dm-flow-edit="${esc(child.id)}" aria-label="${english() ? "Edit" : "Modifica"}">✏️</button><button type="button" data-dm-flow-delete="${esc(child.id)}" aria-label="${english() ? "Delete" : "Elimina"}">🗑️</button></span></div>`;
}

function rootCard(parent, index, roots, loads, appliances) {
  const children = flowChildren(loads, parent.id);
  const resolved = resolveFlowLoad(parent, appliances);
  const name = clean(resolved.name) || (english() ? "Flow" : "Flow");
  const meta = flowMetadata(parent);
  const color = safeColor(meta.flow_color);
  const aggregate = clean(meta.flow_aggregate || "sensor") === "children";
  const visible = parent.show_in_dashboard !== false && index < FLOW_ROOT_LIMIT;
  const source = aggregate
    ? `${english() ? "Sum of child loads" : "Somma sottocarichi"} · ${children.length}`
    : clean(resolved.power_entity) || (english() ? "No aggregate power sensor" : "Nessun sensore potenza aggregata");
  return `<article class="dm-flow-root-card" data-dm-flow-root-card="${esc(parent.id)}" style="--dm-flow-item-color:${color}"><header><span class="dm-flow-slot-number">${index + 1}</span><span class="dm-flow-list-icon">${flowIcon(resolved, 34)}</span><span class="dm-flow-list-main"><strong>${esc(name)}</strong><small>${esc(source)}</small></span><span class="dm-flow-root-status ${visible ? "is-visible" : "is-hidden"}">${visible ? (english() ? "FLOW" : "FLOW") : english() ? "HIDDEN" : "NASCOSTO"}</span></header><div class="dm-flow-root-actions"><button type="button" data-dm-flow-up="${esc(parent.id)}" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" data-dm-flow-down="${esc(parent.id)}" ${index === roots.length - 1 ? "disabled" : ""}>↓</button><button type="button" data-dm-flow-edit="${esc(parent.id)}">✏️ ${english() ? "Edit flow" : "Modifica flow"}</button><button type="button" data-dm-flow-delete="${esc(parent.id)}">🗑️</button></div><div class="dm-flow-children"><div class="dm-flow-children-head"><strong>${english() ? "Loads inside this flow" : "Carichi dentro questo flow"}</strong><span>${children.length}</span></div>${children.length ? children.map((child, childIndex) => childRow(child, childIndex, children.length, appliances)).join("") : `<div class="ed-empty">${english() ? "No child loads yet." : "Nessun sottocarico configurato."}</div>`}<button type="button" class="ed-btn-add dm-flow-add-child" data-dm-flow-add-child="${esc(parent.id)}">＋ ${english() ? "Add load inside" : "Aggiungi carico dentro"} ${esc(name)}</button></div></article>`;
}

function orphanRows(loads, roots, appliances) {
  const rootIds = new Set(roots.map((item) => clean(item.id)));
  const orphans = loads.filter((item) => flowParentId(item) && !rootIds.has(flowParentId(item)));
  if (!orphans.length) return "";
  return `<details class="ed-acc dm-flow-orphans" open><summary class="ed-acc-head">⚠️ ${english() ? "Loads to reassign" : "Carichi da riassegnare"} <span class="ed-acc-n">${orphans.length}</span></summary><div class="ed-acc-body">${orphans.map((child, index) => childRow(child, index, orphans.length, appliances)).join("")}</div></details>`;
}

function editorFormMarkup(loads, roots, appliances) {
  const draft = state.editorDraft;
  if (!draft) return "";
  const current = loads.find((item) => clean(item.id) === clean(draft.editId)) || {};
  const editing = Boolean(draft.editId);
  const child = draft.kind === "child";
  const metadata = flowMetadata(current);
  const parentId = child ? clean(draft.parentId || metadata.flow_parent_id) : "";
  const parent = roots.find((item) => clean(item.id) === parentId);
  const linkedId = child ? clean(metadata.linked_appliance_id) : "";
  const resolved = resolveFlowLoad(current, appliances);
  const color = safeColor(metadata.flow_color, safeColor(flowMetadata(parent).flow_color));
  const aggregate = clean(metadata.flow_aggregate || (editing ? "sensor" : "children"));
  const columns = Math.min(3, Math.max(1, Number(metadata.flow_popup_columns) || 2));
  const reportChecked = editing ? current.show_in_report !== false : child;
  const dashboardChecked = editing ? current.show_in_dashboard !== false : true;
  const enabledChecked = editing ? current.enabled !== false : true;
  return `<form class="ed-form dm-flow-editor-form" data-dm-flow-form data-dm-flow-kind="${child ? "child" : "root"}" data-dm-flow-edit-id="${esc(draft.editId || "")}"><div class="ed-sec-title">${editing ? "✏️" : "＋"} ${child ? (english() ? "Child load" : "Sottocarico") : english() ? "Flow circle" : "Cerchio flow"}</div>${child ? `<label class="ed-slot"><span class="ed-slot-lbl">${english() ? "Parent flow" : "Flow padre"}</span><select id="dm-flow-parent" class="ed-input" required>${roots.map((item) => `<option value="${esc(item.id)}" ${clean(item.id) === parentId ? "selected" : ""}>${esc(clean(item.name) || "Flow")}</option>`).join("")}</select></label><label class="ed-slot"><span class="ed-slot-lbl">🔗 ${english() ? "Link an existing appliance" : "Collega un elettrodomestico esistente"} <span class="ed-acc-n">${english() ? "Optional" : "Facoltativo"}</span></span><select id="dm-flow-linked-appliance" class="ed-input">${applianceOptions(linkedId)}</select><span class="ed-hint">${english() ? "Selecting one pre-fills its sensors; every field can still be overridden." : "Selezionandolo vengono precompilati i sensori; ogni campo resta comunque modificabile."}</span></label>` : ""}<div class="dm-flow-basic-grid"><label class="ed-slot"><span class="ed-slot-lbl">${english() ? "Name" : "Nome"}</span><input id="dm-flow-name" class="ed-input" value="${esc(clean(current.name) || (linkedId ? clean(resolved.name) : ""))}" placeholder="${child ? (english() ? "e.g. Oven" : "es. Forno") : english() ? "e.g. Kitchen" : "es. Cucina"}"></label><label class="ed-slot"><span class="ed-slot-lbl">${english() ? "Icon" : "Icona"}</span><span class="ed-form-row"><input id="dm-flow-icon" class="ed-input ed-icon-input" value="${esc(clean(current.emoji_icon || current.icon || current.visual_key))}" placeholder="mdi:power-plug / 🔌"><button type="button" class="dm-icon-picker" data-dm-flow-icon-picker>🎨</button></span></label><label class="ed-slot"><span class="ed-slot-lbl">${english() ? "Room" : "Stanza"} <span class="ed-acc-n">${english() ? "Optional" : "Facoltativo"}</span></span><select id="dm-flow-room" class="ed-input">${roomOptions(current.room_id)}</select></label><label class="ed-slot"><span class="ed-slot-lbl">${english() ? "Color" : "Colore"}</span><input id="dm-flow-color" class="ed-input dm-flow-color-input" type="color" value="${color}"></label></div>${child ? "" : `<div class="dm-flow-basic-grid"><label class="ed-slot"><span class="ed-slot-lbl">${english() ? "Circle value" : "Valore del cerchio"}</span><select id="dm-flow-aggregate" class="ed-input"><option value="children" ${aggregate === "children" ? "selected" : ""}>${english() ? "Automatic sum of child loads" : "Somma automatica dei sottocarichi"}</option><option value="sensor" ${aggregate !== "children" ? "selected" : ""}>${english() ? "Dedicated aggregate sensor" : "Sensore aggregato dedicato"}</option></select></label><label class="ed-slot"><span class="ed-slot-lbl">${english() ? "Popup columns" : "Colonne popup"}</span><select id="dm-flow-columns" class="ed-input"><option value="1" ${columns === 1 ? "selected" : ""}>1</option><option value="2" ${columns === 2 ? "selected" : ""}>2</option><option value="3" ${columns === 3 ? "selected" : ""}>3</option></select></label></div>`}<details class="ed-acc dm-flow-advanced" open><summary class="ed-acc-head">⚙️ ${english() ? "Sensors and controls" : "Sensori e controlli"}</summary><div class="ed-acc-body">${entityField("dm-flow-power", english() ? "Instant power" : "Potenza istantanea", current.power_entity, "sensor.load_power")}${entityField("dm-flow-day", english() ? "Daily energy" : "Energia giornaliera", current.daily_energy_entity)}${entityField("dm-flow-month", english() ? "Monthly energy" : "Energia mensile", current.monthly_energy_entity)}${entityField("dm-flow-total", english() ? "Total energy" : "Energia totale", current.total_energy_entity)}${entityField("dm-flow-history", english() ? "History" : "Storico", current.history_entity)}${entityField("dm-flow-state", english() ? "State" : "Stato", current.state_entity)}${entityField("dm-flow-control", english() ? "On/off control" : "Comando ON/OFF", current.control_entity, "switch.load")}</div></details><div class="dm-flow-checks">${child ? "" : `<label><input id="dm-flow-dashboard" type="checkbox" ${dashboardChecked ? "checked" : ""}> ${english() ? "Show this circle below Home" : "Mostra questo cerchio sotto Casa"}</label>`}<label><input id="dm-flow-report" type="checkbox" ${reportChecked ? "checked" : ""}> ${english() ? "Visible in Energy Report" : "Visibile nel Report Energia"}</label><label><input id="dm-flow-enabled" type="checkbox" ${enabledChecked ? "checked" : ""}> ${child ? (english() ? "Enabled inside popup" : "Abilitato nel popup") : english() ? "Enabled" : "Abilitato"}</label></div><div class="dm-flow-form-actions"><button type="submit" class="ed-btn-add">💾 ${editing ? (english() ? "Save changes" : "Salva modifiche") : english() ? "Add" : "Aggiungi"}</button><button type="button" class="ed-btn-secondary" data-dm-flow-cancel>${english() ? "Cancel" : "Annulla"}</button></div></form>`;
}

function renderHierarchyEditor(panel) {
  if (!panel) return false;
  const loads = loadList();
  const appliances = applianceList();
  const roots = flowRootLoads(loads);
  panel.dataset.dmHierarchyOwner = "beta26-followup";
  panel.innerHTML = `<div class="dm-flow-editor" data-dm-flow-editor><div class="dm-flow-editor-intro"><strong>⚡ ${english() ? "Loads flow structure" : "Struttura flow dei carichi"}</strong><p>${english() ? "Level 1 configures the circles below Home. Level 2 configures what opens inside each circle, for example Kitchen → Oven, Fridge, Microwave. Existing loads remain valid as level-1 circles." : "Il livello 1 configura i cerchi sotto Casa. Il livello 2 configura cosa si apre dentro ogni cerchio, ad esempio Cucina → Forno, Frigo, Microonde. I carichi già esistenti restano validi come cerchi di livello 1."}</p><div class="dm-flow-editor-steps"><span><b>1</b>${english() ? "FLOW CIRCLES" : "CERCHI FLOW"}</span><span><b>2</b>${english() ? "LOADS INSIDE" : "CARICHI INTERNI"}</span><span><b>3</b>${english() ? "SENSORS / STYLE" : "SENSORI / STILE"}</span></div></div><section class="dm-flow-root-list"><div class="dm-flow-list-heading"><div><strong>${english() ? "Circles below Home" : "Cerchi sotto Casa"}</strong><small>${english() ? `The current flow layout exposes up to ${FLOW_ROOT_LIMIT} circles.` : `Il layout flow attuale espone fino a ${FLOW_ROOT_LIMIT} cerchi.`}</small></div><span>${roots.filter((item) => item.show_in_dashboard !== false).slice(0, FLOW_ROOT_LIMIT).length}/${FLOW_ROOT_LIMIT}</span></div>${roots.length ? roots.map((parent, index) => rootCard(parent, index, roots, loads, appliances)).join("") : `<div class="ed-empty">${english() ? "No flow circle configured yet." : "Nessun cerchio flow configurato."}</div>`}<button type="button" class="ed-btn-add dm-flow-add-root" data-dm-flow-add-root ${roots.length >= FLOW_ROOT_LIMIT ? "disabled" : ""}>＋ ${english() ? "New flow circle" : "Nuovo cerchio flow"}</button></section>${orphanRows(loads, roots, appliances)}<details class="ed-acc dm-flow-appliance-help"><summary class="ed-acc-head">🧺 ${english() ? "Existing appliances" : "Elettrodomestici esistenti"} <span class="ed-acc-n">${appliances.length}</span></summary><div class="ed-acc-body"><div class="ed-hint">${english() ? "When adding a child load you can link one of these appliances and reuse its configured entities, or create a completely independent load." : "Quando aggiungi un sottocarico puoi collegare uno di questi elettrodomestici e riutilizzarne le entità configurate, oppure creare un carico completamente indipendente."}</div></div></details>${editorFormMarkup(loads, roots, appliances)}</div>`;
  mountHierarchyEditor(panel);
  return true;
}

function value(panel, id) {
  return clean(panel.querySelector(`#${id}`)?.value);
}

async function reorderLoad(id, direction) {
  const store = dashboardStore();
  const loads = store?.getSection?.("loads") || [];
  const item = loads.find((entry) => clean(entry.id) === clean(id));
  if (!item) return;
  const parent = flowParentId(item);
  const peers = (parent ? flowChildren(loads, parent) : flowRootLoads(loads)).filter(
    (entry) => clean(entry.id) !== "",
  );
  const index = peers.findIndex((entry) => clean(entry.id) === clean(id));
  const targetIndex = index + direction;
  if (index < 0 || targetIndex < 0 || targetIndex >= peers.length) return;
  const left = peers[index];
  const right = peers[targetIndex];
  const leftOrder = Number(left.order) || index;
  const rightOrder = Number(right.order) || targetIndex;
  const next = loads.map((entry) => {
    if (entry.id === left.id) return { ...entry, order: rightOrder };
    if (entry.id === right.id) return { ...entry, order: leftOrder };
    return entry;
  });
  await store.replaceSection("loads", next);
}

async function deleteLoad(id) {
  const store = dashboardStore();
  const loads = store?.getSection?.("loads") || [];
  const item = loads.find((entry) => clean(entry.id) === clean(id));
  if (!item) return;
  const children = flowChildren(loads, item.id);
  const message = children.length
    ? english()
      ? `Delete this flow and its ${children.length} child loads?`
      : `Eliminare questo flow e i suoi ${children.length} sottocarichi?`
    : english()
      ? "Delete this load?"
      : "Eliminare questo carico?";
  if (root.confirm?.(message) === false) return;
  if (children.length) {
    const removed = new Set([clean(item.id), ...children.map((child) => clean(child.id))]);
    await store.replaceSection(
      "loads",
      loads.filter((entry) => !removed.has(clean(entry.id))),
    );
  } else await store.removeItem("loads", item.id);
  state.editorDraft = null;
}

function prefillLinkedAppliance(panel, device) {
  if (!device) return;
  const fill = (id, next) => {
    const input = panel.querySelector(`#${id}`);
    if (input && !clean(input.value) && clean(next)) input.value = clean(next);
  };
  fill("dm-flow-name", device.name || device.device_type);
  fill("dm-flow-icon", device.emoji_icon || device.icon || device.visual_key || device.device_type);
  fill("dm-flow-room", device.room_id);
  fill("dm-flow-power", device.power_entity);
  fill("dm-flow-day", device.daily_energy_entity);
  fill("dm-flow-month", device.monthly_energy_entity);
  fill("dm-flow-total", device.total_energy_entity || device.energy_entity);
  fill("dm-flow-history", device.history_entity);
  fill("dm-flow-state", device.state_entity);
  fill("dm-flow-control", device.control_entity);
}

function mountHierarchyEditor(panel) {
  panel.querySelector("[data-dm-flow-add-root]")?.addEventListener("click", () => {
    state.editorDraft = { kind: "root", editId: "", parentId: "" };
    renderHierarchyEditor(panel);
    panel.querySelector("[data-dm-flow-form]")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  });
  panel.querySelectorAll("[data-dm-flow-add-child]").forEach((button) =>
    button.addEventListener("click", () => {
      state.editorDraft = { kind: "child", editId: "", parentId: button.dataset.dmFlowAddChild };
      renderHierarchyEditor(panel);
      panel.querySelector("[data-dm-flow-form]")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    }),
  );
  panel.querySelectorAll("[data-dm-flow-edit]").forEach((button) =>
    button.addEventListener("click", () => {
      const item = loadList().find((entry) => clean(entry.id) === clean(button.dataset.dmFlowEdit));
      state.editorDraft = {
        kind: flowParentId(item) ? "child" : "root",
        editId: clean(item?.id),
        parentId: flowParentId(item),
      };
      renderHierarchyEditor(panel);
      panel.querySelector("[data-dm-flow-form]")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    }),
  );
  panel.querySelectorAll("[data-dm-flow-delete]").forEach((button) =>
    button.addEventListener("click", async () => {
      await deleteLoad(button.dataset.dmFlowDelete);
      renderHierarchyEditor(panel);
    }),
  );
  panel.querySelectorAll("[data-dm-flow-up]").forEach((button) =>
    button.addEventListener("click", async () => {
      await reorderLoad(button.dataset.dmFlowUp, -1);
      renderHierarchyEditor(panel);
    }),
  );
  panel.querySelectorAll("[data-dm-flow-down]").forEach((button) =>
    button.addEventListener("click", async () => {
      await reorderLoad(button.dataset.dmFlowDown, 1);
      renderHierarchyEditor(panel);
    }),
  );
  panel.querySelector("[data-dm-flow-cancel]")?.addEventListener("click", () => {
    state.editorDraft = null;
    renderHierarchyEditor(panel);
  });
  panel.querySelectorAll("[data-dm-flow-pick]").forEach((button) =>
    button.addEventListener("click", () => root.wzPickEntity?.(panel.querySelector(`#${button.dataset.dmFlowPick}`))),
  );
  panel.querySelector("[data-dm-flow-icon-picker]")?.addEventListener("click", (event) => {
    root.dmIconPicker?.("#dm-flow-icon", "action", event.currentTarget);
  });
  panel.querySelector("#dm-flow-linked-appliance")?.addEventListener("change", (event) => {
    const device = applianceList().find((item) => clean(item.id) === clean(event.target.value));
    prefillLinkedAppliance(panel, device);
  });

  panel.querySelector("[data-dm-flow-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    const form = event.currentTarget;
    const child = form.dataset.dmFlowKind === "child";
    const editId = clean(form.dataset.dmFlowEditId);
    const store = dashboardStore();
    const loads = store?.getSection?.("loads") || [];
    const current = loads.find((item) => clean(item.id) === editId) || {};
    const parentId = child ? value(panel, "dm-flow-parent") : "";
    const linkedId = child ? value(panel, "dm-flow-linked-appliance") : "";
    const linked = applianceList().find((item) => clean(item.id) === linkedId) || null;
    const name = value(panel, "dm-flow-name") || clean(linked?.name || linked?.device_type);
    if (!name) {
      root.alert?.(english() ? "Enter a name or link an appliance." : "Inserisci un nome oppure collega un elettrodomestico.");
      return;
    }
    if (child && !parentId) {
      root.alert?.(english() ? "Select the parent flow." : "Seleziona il flow padre.");
      return;
    }
    if (!child && !editId && flowRootLoads(loads).length >= FLOW_ROOT_LIMIT) {
      root.alert?.(english() ? `The current layout supports up to ${FLOW_ROOT_LIMIT} flow circles.` : `Il layout attuale supporta fino a ${FLOW_ROOT_LIMIT} cerchi flow.`);
      return;
    }

    const metadata = { ...(current.metadata || {}) };
    metadata.flow_kind = child ? "child" : "root";
    metadata.flow_color = safeColor(value(panel, "dm-flow-color"), safeColor(flowMetadata(current).flow_color));
    if (child) {
      metadata.flow_parent_id = parentId;
      if (linkedId) metadata.linked_appliance_id = linkedId;
      else delete metadata.linked_appliance_id;
      delete metadata.flow_aggregate;
      delete metadata.flow_popup_columns;
    } else {
      delete metadata.flow_parent_id;
      delete metadata.linked_appliance_id;
      metadata.flow_aggregate = value(panel, "dm-flow-aggregate") === "children" ? "children" : "sensor";
      metadata.flow_popup_columns = Math.min(3, Math.max(1, Number(value(panel, "dm-flow-columns")) || 2));
    }

    const icon = value(panel, "dm-flow-icon") || clean(linked?.emoji_icon || linked?.icon || linked?.visual_key);
    const item = {
      ...current,
      name,
      icon,
      room_id: value(panel, "dm-flow-room") || clean(linked?.room_id),
      power_entity: value(panel, "dm-flow-power") || clean(linked?.power_entity),
      daily_energy_entity: value(panel, "dm-flow-day") || clean(linked?.daily_energy_entity),
      monthly_energy_entity: value(panel, "dm-flow-month") || clean(linked?.monthly_energy_entity),
      total_energy_entity: value(panel, "dm-flow-total") || clean(linked?.total_energy_entity || linked?.energy_entity),
      history_entity: value(panel, "dm-flow-history") || clean(linked?.history_entity),
      state_entity: value(panel, "dm-flow-state") || clean(linked?.state_entity),
      control_entity: value(panel, "dm-flow-control") || clean(linked?.control_entity),
      visual_type: clean(current.visual_type || linked?.visual_type),
      visual_key: clean(current.visual_key || linked?.visual_key),
      device_type: clean(current.device_type || linked?.device_type || (child ? "flow-child" : "flow-group")),
      category: child ? "flow-child" : "flow-group",
      enabled: Boolean(panel.querySelector("#dm-flow-enabled")?.checked),
      show_in_report: Boolean(panel.querySelector("#dm-flow-report")?.checked),
      show_in_dashboard: child ? false : Boolean(panel.querySelector("#dm-flow-dashboard")?.checked),
      order: Number.isFinite(Number(current.order)) ? Number(current.order) : loads.length,
      metadata,
    };
    try {
      if (editId) await store.updateItem("loads", editId, item);
      else await store.addItem("loads", item);
      state.editorDraft = null;
      renderHierarchyEditor(panel);
      schedule();
    } catch (error) {
      root.console?.error?.("[DashboardModern] hierarchical load save", error);
      root.alert?.(error?.message || String(error));
    }
  });
}

function loadsPanel() {
  return doc?.querySelector?.('#editor-modal [data-energy-panel="loads"],#ed-body [data-energy-panel="loads"]');
}

function ensureHierarchyEditor() {
  const panel = loadsPanel();
  if (!panel || panel.dataset.dmHierarchyOwner === "beta26-followup") return false;
  return renderHierarchyEditor(panel);
}

function temperatureFilter() {
  const tabs = doc?.getElementById?.("dm-beta16-temperature-tabs");
  const active = tabs?.querySelector?.(
    'button[data-room-filter].active,button[data-room-filter][aria-pressed="true"]',
  );
  return clean(active?.dataset?.roomFilter) || "all";
}

export function applyTemperatureRoomFilter() {
  const grid = doc?.getElementById?.("temp-grid");
  if (!grid) return false;
  const filter = temperatureFilter();
  grid.querySelectorAll(".temp-card[data-room-id],.dm-temperature-card[data-room-id]").forEach((card) => {
    const visible = roomFilterMatches(card.dataset.roomId, filter);
    card.hidden = !visible;
    if (visible) card.style.removeProperty("display");
    else card.style.setProperty("display", "none", "important");
  });
  return true;
}

export function stabilizeTemperatureEditorIcons() {
  const rooms = new Map(roomList().map((room) => [clean(room.id), room]));
  let changed = false;
  doc
    ?.querySelectorAll?.(
      "#editor-modal [data-beta25-temperature-row][data-room-id] .dm-temperature-card-icon,#editor-modal [data-temperature-room][data-room-id] .dm-temperature-card-icon",
    )
    .forEach((icon) => {
      const row = icon.closest("[data-room-id]");
      const room = rooms.get(clean(row?.dataset?.roomId));
      if (!room) return;
      const token = clean(room.icon || "mdi:home");
      const glyph = directEmoji(token) || roomGlyph(token);
      if (
        icon.dataset.dmStableRoomIcon === token &&
        icon.querySelector(":scope > .dm-beta26-stable-room-glyph")?.textContent === glyph
      )
        return;
      const span = doc.createElement("span");
      span.className = "dm-beta26-stable-room-glyph";
      span.textContent = glyph;
      icon.replaceChildren(span);
      icon.dataset.dmStableRoomIcon = token;
      changed = true;
    });
  return changed;
}

function flowView(period) {
  if (period === "day") return { id: "view-day", suffix: "-day" };
  if (period === "month") return { id: "view-month", suffix: "-month" };
  return { id: "view-ist", suffix: "" };
}

function flowValueNode(scope, node, period) {
  const slot = clean(node?.dataset?.dmFlowSlot);
  const id =
    period === "instant" ? `v-${slot}-p` : period === "day" ? `v-${slot}-day` : `v-${slot}-month`;
  return scope?.querySelector?.(`#${id}`) || node?.querySelector?.(".node-value,[data-node-value],.n-value") || null;
}

function decorateFlowNode(scope, node, parent, loads, appliances, period, suffix) {
  const metadata = flowMetadata(parent);
  const color = safeColor(metadata.flow_color);
  const children = flowChildren(loads, parent.id).filter((child) => child.enabled !== false);
  node.dataset.dmFlowRoot = "true";
  node.style.setProperty("--dm-flow-color", color);
  const slot = clean(node.dataset.dmFlowSlot);
  for (const id of [`line-home-${slot}${suffix}`, `m-line-home-${slot}${suffix}`]) {
    const connector = scope?.querySelector?.(`#${id}`) || doc?.getElementById?.(id);
    if (!connector) continue;
    connector.style.setProperty("--dm-flow-color", color);
    connector.style.setProperty("stroke", color, "important");
  }
  let badge = node.querySelector(":scope > .dm-flow-child-count");
  if (children.length) {
    if (!badge) {
      badge = doc.createElement("span");
      badge.className = "dm-flow-child-count";
      node.append(badge);
    }
    badge.textContent = String(children.length);
    badge.hidden = false;
    node.dataset.dmFlowHasChildren = "true";
  } else {
    badge?.remove();
    delete node.dataset.dmFlowHasChildren;
  }
  if (clean(metadata.flow_aggregate) === "children") {
    const value = aggregateFlowValue(parent, loads, period, allStates(), appliances);
    const target = flowValueNode(scope, node, period);
    if (target) target.textContent = metricText(value, period);
  }
}

export function syncHierarchicalFlowRuntime() {
  if (!doc) return false;
  const loads = loadList();
  const appliances = applianceList();
  const roots = flowRootLoads(loads).filter((item) => item.show_in_dashboard !== false).slice(0, FLOW_ROOT_LIMIT);
  const byId = new Map(roots.map((item) => [clean(item.id), item]));
  let synced = false;
  for (const period of ["instant", "day", "month"]) {
    const { id, suffix } = flowView(period);
    const scope = doc.getElementById(id);
    if (!scope) continue;
    scope.querySelectorAll(".node.n-load[data-dm-canonical-load]").forEach((node) => {
      const parent = byId.get(clean(node.dataset.dmCanonicalLoad));
      if (!parent) return;
      decorateFlowNode(scope, node, parent, loads, appliances, period, suffix);
      synced = true;
    });
  }
  return synced;
}

function childIsOn(child, states = allStates()) {
  const resolved = resolveFlowLoad(child, applianceList());
  const entity = clean(resolved.state_entity || resolved.control_entity);
  const raw = clean(states?.[entity]?.state).toLowerCase();
  if (["on", "open", "playing", "heat", "cool", "heating", "running"].includes(raw)) return true;
  if (["off", "closed", "idle", "unavailable", "unknown"].includes(raw)) return false;
  const power = stateNumber(resolved.power_entity, states);
  return power !== null && power > 1;
}

function closeFlowPopup() {
  doc?.getElementById?.("dm-flow-group-backdrop")?.remove();
  state.popupParentId = "";
}

function popupChildCard(child, parentColor, states) {
  const resolved = resolveFlowLoad(child, applianceList());
  const name = clean(resolved.name) || (english() ? "Load" : "Carico");
  const color = safeColor(flowMetadata(child).flow_color, parentColor);
  const on = childIsOn(child, states);
  const power = stateNumber(resolved.power_entity, states);
  return `<button type="button" class="dm-flow-popup-child ${on ? "is-on" : "is-off"}" data-dm-flow-popup-child="${esc(child.id)}" style="--dm-child-color:${color}"><span class="dm-flow-popup-child-top"><span class="dm-flow-popup-icon">${flowIcon(resolved, 42)}</span><strong>${esc(name)}</strong><small>${on ? (english() ? "ON" : "ACCESO") : english() ? "OFF" : "SPENTO"}</small></span><span class="dm-flow-popup-value">${metricText(power, "instant")}</span></button>`;
}

export function openFlowGroupPopup(parentId) {
  const loads = loadList();
  const parent = loads.find((item) => clean(item.id) === clean(parentId));
  const children = flowChildren(loads, parentId).filter((child) => child.enabled !== false);
  if (!parent || !children.length || !doc?.body) return false;
  closeFlowPopup();
  state.popupParentId = clean(parentId);
  const color = safeColor(flowMetadata(parent).flow_color);
  const columns = Math.min(3, Math.max(1, Number(flowMetadata(parent).flow_popup_columns) || 2));
  const backdrop = doc.createElement("div");
  backdrop.id = "dm-flow-group-backdrop";
  backdrop.className = "dm-flow-group-backdrop";
  backdrop.innerHTML = `<section class="dm-flow-group-popup" role="dialog" aria-modal="true" aria-labelledby="dm-flow-popup-title" style="--dm-flow-color:${color};--dm-flow-popup-columns:${columns}"><header><div><span class="dm-flow-popup-parent-icon">${flowIcon(resolveFlowLoad(parent, applianceList()), 34)}</span><h2 id="dm-flow-popup-title">${esc(clean(parent.name) || "Flow")} <small>${english() ? "INSTANT" : "ISTANTANEO"}</small></h2></div><button type="button" data-dm-flow-popup-close>✕ ${english() ? "CLOSE" : "CHIUDI"}</button></header><div class="dm-flow-popup-grid">${children.map((child) => popupChildCard(child, color, allStates())).join("")}</div></section>`;
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop || event.target.closest?.("[data-dm-flow-popup-close]")) {
      closeFlowPopup();
      return;
    }
    const childButton = event.target.closest?.("[data-dm-flow-popup-child]");
    if (!childButton) return;
    const child = children.find((item) => clean(item.id) === clean(childButton.dataset.dmFlowPopupChild));
    const resolved = resolveFlowLoad(child, applianceList());
    const history = clean(resolved.history_entity || resolved.power_entity);
    if (history) root.apriStorico?.(event, history, clean(resolved.name));
  });
  doc.body.append(backdrop);
  return true;
}

function refreshOpenPopup() {
  const id = clean(state.popupParentId);
  if (!id || !doc?.getElementById?.("dm-flow-group-backdrop")) return false;
  return openFlowGroupPopup(id);
}

function bindScopedObserver() {
  if (!doc || typeof root.MutationObserver !== "function") return false;
  if (!state.observer) state.observer = new root.MutationObserver(() => schedule());
  const grid = doc.getElementById("temp-grid");
  if (grid && state.observedGrid !== grid) {
    state.observer.observe(grid, { childList: true, subtree: true });
    state.observedGrid = grid;
  }
  const editor = doc.getElementById("ed-body");
  if (editor && state.observedEditor !== editor) {
    state.observer.observe(editor, { childList: true, subtree: true });
    state.observedEditor = editor;
  }
  return Boolean(grid || editor);
}

function bindStore() {
  const store = dashboardStore();
  if (!store) return false;
  installVisibilitySaveContract(store);
  if (state.store === store) return true;
  state.storeUnsubscribe?.();
  state.store = store;
  state.storeUnsubscribe = store.subscribe((change) => {
    if (["loads", "appliances", "rooms", "snapshot"].includes(change?.section)) schedule();
  });
  return true;
}

function installRuntimeWrappers() {
  for (const name of [
    "render",
    "editorSwitch",
    "renderEnergyDashboard",
    "renderEnergyDay",
    "renderEnergyMonth",
    "switchEnergyView",
    "buildTempCards",
    "renderTemperature",
  ])
    wrapFunction(name, `__dmBeta26ConfigFollowup_${name}`, schedule);
}

function run() {
  state.frame = 0;
  bindStore();
  bindScopedObserver();
  installRuntimeWrappers();
  ensureHierarchyEditor();
  stabilizeTemperatureEditorIcons();
  applyTemperatureRoomFilter();
  syncHierarchicalFlowRuntime();
}

function schedule() {
  if (!doc || state.frame) return;
  state.frame = root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 0) || 0;
}

function installStyles() {
  installStyle(
    "dm-beta26-config-followup-style",
    `
      #editor-modal .dm-beta26-stable-room-glyph{display:grid!important;place-items:center!important;width:100%!important;height:100%!important;font-family:Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif!important;font-size:30px!important;line-height:1!important;animation:none!important;transition:none!important;transform:none!important}
      #editor-modal .dm-temperature-card-icon,#editor-modal .dm-temperature-card-icon *{animation:none!important;transition:none!important;transform:none!important;will-change:auto!important}
      .dm-flow-editor{display:grid;gap:16px}.dm-flow-editor-intro{padding:16px;border:1px solid color-mix(in srgb,var(--primary-color,#0ea5e9) 18%,var(--divider-color,#dbe4ee));border-radius:18px;background:color-mix(in srgb,var(--primary-color,#0ea5e9) 5%,var(--ha-card-background,#fff))}.dm-flow-editor-intro p{margin:8px 0 0;color:var(--secondary-text-color,#64748b);line-height:1.45}.dm-flow-editor-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:14px}.dm-flow-editor-steps span{display:flex;align-items:center;gap:7px;padding:9px 10px;border-radius:12px;background:var(--ha-card-background,#fff);font-size:11px;font-weight:850}.dm-flow-editor-steps b{display:grid;place-items:center;width:22px;height:22px;border-radius:999px;background:var(--primary-color,#0ea5e9);color:#fff}
      .dm-flow-root-list{display:grid;gap:12px}.dm-flow-list-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.dm-flow-list-heading>div{display:grid;gap:3px}.dm-flow-list-heading small{color:var(--secondary-text-color,#64748b)}.dm-flow-list-heading>span{padding:6px 10px;border-radius:999px;background:color-mix(in srgb,var(--primary-color,#0ea5e9) 10%,transparent);font-weight:900}
      .dm-flow-root-card{display:grid;gap:12px;padding:14px;border:1px solid color-mix(in srgb,var(--dm-flow-item-color) 34%,var(--divider-color,#dbe4ee));border-radius:18px;background:linear-gradient(145deg,color-mix(in srgb,var(--dm-flow-item-color) 5%,var(--ha-card-background,#fff)),var(--ha-card-background,#fff));box-shadow:0 8px 20px rgba(15,23,42,.05)}.dm-flow-root-card>header{display:grid;grid-template-columns:auto auto minmax(0,1fr) auto;align-items:center;gap:10px}.dm-flow-slot-number{display:grid;place-items:center;width:27px;height:27px;border-radius:999px;background:var(--dm-flow-item-color);color:#fff;font-weight:900}.dm-flow-list-icon{display:grid;place-items:center;width:42px;height:42px;overflow:hidden}.dm-flow-list-icon .dm-appliance-art,.dm-flow-list-icon svg{max-width:40px;max-height:40px}.dm-flow-list-main{display:grid;min-width:0;gap:2px}.dm-flow-list-main strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dm-flow-list-main small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--secondary-text-color,#64748b)}.dm-flow-root-status{padding:5px 8px;border-radius:999px;font-size:9px;font-weight:900}.dm-flow-root-status.is-visible{background:color-mix(in srgb,var(--success-color,#10b981) 15%,transparent);color:var(--success-color,#047857)}.dm-flow-root-status.is-hidden{background:color-mix(in srgb,var(--secondary-text-color,#64748b) 12%,transparent);color:var(--secondary-text-color,#64748b)}
      .dm-flow-root-actions,.dm-flow-row-actions{display:flex;gap:6px;flex-wrap:wrap}.dm-flow-root-actions button,.dm-flow-row-actions button{min-height:34px;padding:6px 9px;border:1px solid var(--divider-color,#dbe4ee);border-radius:10px;background:var(--ha-card-background,#fff);color:var(--primary-text-color,#0f172a);font-weight:800}.dm-flow-root-actions button:disabled,.dm-flow-row-actions button:disabled{opacity:.35}.dm-flow-children{display:grid;gap:8px;padding:10px;border-radius:14px;background:color-mix(in srgb,var(--dm-flow-item-color) 4%,var(--secondary-background-color,#f8fafc))}.dm-flow-children-head{display:flex;justify-content:space-between;align-items:center}.dm-flow-children-head>span{font-weight:900}.dm-flow-child-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:9px;padding:9px;border-left:3px solid var(--dm-flow-item-color);border-radius:11px;background:var(--ha-card-background,#fff)}.dm-flow-child-row .dm-flow-list-icon{width:34px;height:34px}.dm-flow-child-row .dm-flow-list-icon .dm-appliance-art,.dm-flow-child-row .dm-flow-list-icon svg{max-width:32px;max-height:32px}.dm-flow-add-child{width:100%;margin-top:2px}.dm-flow-basic-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.dm-flow-color-input{min-height:48px;padding:5px}.dm-flow-checks{display:grid;gap:8px;padding:12px;border-radius:14px;background:var(--secondary-background-color,#f8fafc)}.dm-flow-checks label{display:flex;align-items:center;gap:8px;font-weight:700}.dm-flow-form-actions{display:flex;gap:10px;flex-wrap:wrap}.dm-flow-form-actions>*{flex:1 1 180px}.dm-flow-orphans{border-color:color-mix(in srgb,#f59e0b 45%,var(--divider-color,#dbe4ee))!important}
      .node.n-load[data-dm-flow-root="true"]{border-color:var(--dm-flow-color)!important;box-shadow:0 0 0 4px color-mix(in srgb,var(--dm-flow-color) 14%,transparent),0 12px 28px color-mix(in srgb,var(--dm-flow-color) 14%,transparent)!important}.node.n-load[data-dm-flow-has-children="true"]{cursor:pointer!important}.dm-flow-child-count{position:absolute;right:-5px;top:-5px;display:grid;place-items:center;min-width:22px;height:22px;padding:0 5px;border:2px solid var(--ha-card-background,#fff);border-radius:999px;background:var(--dm-flow-color);color:#fff;font-size:10px;font-weight:900;line-height:1;z-index:4}
      .dm-flow-group-backdrop{position:fixed;inset:0;z-index:100000;display:grid;place-items:center;padding:16px;background:rgba(15,23,42,.38);backdrop-filter:blur(10px)}.dm-flow-group-popup{box-sizing:border-box;width:min(920px,100%);max-height:min(88vh,900px);overflow:auto;padding:22px;border:1px solid color-mix(in srgb,var(--dm-flow-color) 28%,var(--divider-color,#dbe4ee));border-radius:28px;background:var(--ha-card-background,#fff);box-shadow:0 24px 70px rgba(15,23,42,.28)}.dm-flow-group-popup>header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-bottom:16px;border-bottom:3px solid color-mix(in srgb,var(--dm-flow-color) 22%,transparent)}.dm-flow-group-popup>header>div{display:flex;align-items:center;gap:11px;min-width:0}.dm-flow-popup-parent-icon{display:grid;place-items:center;width:52px;height:52px}.dm-flow-group-popup h2{margin:0;font-size:22px}.dm-flow-group-popup h2 small{display:block;margin-top:2px;color:var(--secondary-text-color,#64748b);font-size:10px;letter-spacing:.08em}.dm-flow-group-popup>header button{padding:10px 14px;border:1px solid var(--divider-color,#dbe4ee);border-radius:999px;background:var(--secondary-background-color,#f8fafc);font-weight:900}.dm-flow-popup-grid{display:grid;grid-template-columns:repeat(var(--dm-flow-popup-columns),minmax(0,1fr));gap:14px;margin-top:18px}.dm-flow-popup-child{display:grid;min-height:190px;padding:0;overflow:hidden;border:1px solid color-mix(in srgb,var(--dm-child-color) 20%,var(--divider-color,#dbe4ee));border-radius:24px;background:var(--secondary-background-color,#f8fafc);color:var(--primary-text-color,#0f172a);text-align:center}.dm-flow-popup-child-top{display:grid;place-items:center;align-content:center;gap:5px;padding:20px 12px;background:color-mix(in srgb,var(--dm-child-color) 90%,#ef4444);color:#fff}.dm-flow-popup-child.is-off .dm-flow-popup-child-top{background:color-mix(in srgb,var(--dm-child-color) 72%,#e11d48)}.dm-flow-popup-icon{display:grid;place-items:center;width:50px;height:50px}.dm-flow-popup-icon .dm-appliance-art,.dm-flow-popup-icon svg{max-width:48px;max-height:48px}.dm-flow-popup-child-top strong{font-size:18px}.dm-flow-popup-child-top small{font-weight:900}.dm-flow-popup-value{display:grid;place-items:center;min-height:72px;padding:12px;font-size:28px;font-weight:900}
      @media(max-width:700px){.dm-flow-editor-steps{grid-template-columns:1fr}.dm-flow-basic-grid{grid-template-columns:1fr}.dm-flow-root-card>header{grid-template-columns:auto auto minmax(0,1fr)}.dm-flow-root-status{grid-column:2/4;justify-self:start}.dm-flow-child-row{grid-template-columns:auto minmax(0,1fr)}.dm-flow-row-actions{grid-column:1/-1;justify-content:flex-end}.dm-flow-popup-grid{grid-template-columns:repeat(min(var(--dm-flow-popup-columns),2),minmax(0,1fr))}.dm-flow-group-popup{padding:16px;border-radius:22px}.dm-flow-group-popup h2{font-size:18px}.dm-flow-popup-child{min-height:170px}.dm-flow-popup-child-top strong{font-size:16px}.dm-flow-popup-value{font-size:24px}}
      @media(max-width:430px){.dm-flow-popup-grid{grid-template-columns:1fr}.dm-flow-group-popup>header{align-items:flex-start}.dm-flow-group-popup>header button{padding:8px 10px;font-size:11px}}
    `,
  );
}

export function installBeta26ConfigFollowup() {
  if (!doc) return false;
  installStyles();
  bindStore();
  bindScopedObserver();
  installRuntimeWrappers();
  schedule();
  if (!state.listeners) {
    state.listeners = true;
    for (const eventName of [
      "dashboardmodern:legacy-ready",
      "dashboardmodern:runtime-ready",
      "dashboardmodern:persistence-restored",
      "dashboardmodern:states-ready",
      "dashboardmodern:temperature-editor-rendered",
      "dashboardmodern:energy-stable",
    ])
      root.addEventListener?.(eventName, schedule);
    root.addEventListener?.("dashboardmodern:state-changed", () => {
      syncHierarchicalFlowRuntime();
      refreshOpenPopup();
    });
    doc.addEventListener(
      "click",
      (event) => {
        const flowNode = event.target?.closest?.(".node.n-load[data-dm-canonical-load]");
        if (flowNode) {
          const id = clean(flowNode.dataset.dmCanonicalLoad);
          if (flowChildren(loadList(), id).some((child) => child.enabled !== false)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            openFlowGroupPopup(id);
            return;
          }
        }
        if (
          event.target?.closest?.(
            "#dm-beta16-temperature-tabs button[data-room-filter],.ed-inner-tab,[data-energy-tab],[data-tab='sez1'],[data-tab='sez7']",
          )
        )
          root.queueMicrotask?.(schedule);
      },
      true,
    );
    doc.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && state.popupParentId) closeFlowPopup();
    });
  }
  state.installed = true;
  return true;
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installBeta26ConfigFollowup, { once: true });
else installBeta26ConfigFollowup();

export const beta26ConfigFollowup = Object.freeze({
  flowParentId,
  flowRootLoads,
  flowChildren,
  flowPeriodEntity,
  resolveFlowLoad,
  aggregateFlowValue,
  roomFilterMatches,
  shouldAutoShowAfterSave,
  installVisibilitySaveContract,
  applyTemperatureRoomFilter,
  stabilizeTemperatureEditorIcons,
  syncHierarchicalFlowRuntime,
  openFlowGroupPopup,
  installBeta26ConfigFollowup,
});
