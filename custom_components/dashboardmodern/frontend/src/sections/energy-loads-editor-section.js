// DM-FIX-20260817B
/* The Loads editor, rebuilt around the stage it configures.
 *
 * The old panel asked for the same load twice: once as one of five fixed
 * "circles under Home" (name, icon, colour, and a dropdown pointing at a
 * group), and once as the group holding its appliances. Keeping the two halves
 * pointing at each other was manual, and the flow only ever had room for five.
 *
 * The stage is now drawn from the loads, so this panel is the same list: one
 * card per circle, in the order they appear under Home, each one carrying its
 * own appliances. The card opens with a preview of the bubble it draws — same
 * icon, same name, same colour — so the config and the picture read alike.
 *
 * Every write goes through the canonical `loads` section; the legacy popup keys
 * are re-derived from it on save. Event driven: no polling, no observer.
 */
import { createEntityPickerField } from "../core/renderers.js";
import {
  MAX_FLOW_LOADS,
  MAX_SUBLOADS,
  emptyLoad,
  emptySubload,
  loadConfigSummary,
  loadConfigWarnings,
  loadsConfigModel,
  loadsConfigToSections,
  moveLoad,
} from "../core/energy-loads-config.js";
import {
  clean,
  dashboardStore,
  doc,
  english,
  installStyle,
  readJson,
  root,
  section,
  writeJsonIfChanged,
} from "./shared.js";

root.__DM_20260817B__ = true;
const KEY = "__DASHBOARDMODERN_ENERGY_LOADS_EDITOR__";
const state = (root[KEY] ||= { installed: false, model: null, open: new Set(), dirty: false });

const PANEL = '[data-energy-panel="loads"]';
const t = (it, en) => (english() ? en : it);

function configuredLoads() {
  const value = section("loads", null);
  if (Array.isArray(value)) return value;
  const stored = readJson("cd_loads", []);
  return Array.isArray(stored) ? stored : [];
}

/* Read once, from wherever the configuration currently lives, and keep editing
 * that model until it is saved. */
function readModel() {
  return loadsConfigModel({
    loads: configuredLoads(),
    flowNodes: readJson("cd_flow_nodes", null),
    groups: readJson("cd_subload_groups", []),
    subloads: readJson("cd_subloads_extra", null),
  });
}

function model() {
  if (!state.model) state.model = readModel();
  return state.model;
}

function markDirty(panel) {
  state.dirty = true;
  render(panel);
}

async function persist(panel) {
  const previous = configuredLoads();
  const { loads, groups, subloads, flowNodes } = loadsConfigToSections(model(), previous);
  const store = dashboardStore();
  if (store?.replaceSection) await store.replaceSection("loads", loads);
  else writeJsonIfChanged("cd_loads", loads, { sync: false });
  // Derived mirrors: the hosted subload popup reads these directly.
  writeJsonIfChanged("cd_subload_groups", groups, { sync: false });
  writeJsonIfChanged("cd_subloads_extra", subloads, { sync: false });
  writeJsonIfChanged("cd_flow_nodes", flowNodes);
  state.dirty = false;
  state.model = null;
  root.dmRefreshEnergyFlows?.();
  root.render?.();
  render(panel);
  return true;
}

function element(tag, className = "", text = "") {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function iconInto(target, icon) {
  if (/^mdi:/i.test(icon) && typeof root.cdIconMarkup === "function")
    target.innerHTML = root.cdIconMarkup(icon, 24);
  else target.textContent = icon || "🔌";
}

/* The bubble this card will draw. Same icon, name and colour as the stage, so
 * a change here is recognisable there without saving first. */
function preview(load, index) {
  const node = element("div", "dm-loads-preview");
  node.style.setProperty("--dm-loads-color", load.color);
  node.dataset.dmLoadsVisible = load.visible ? "true" : "false";
  const bubble = element("span", "dm-loads-preview-bubble");
  iconInto(bubble, load.icon);
  const text = element("span", "dm-loads-preview-text");
  text.append(
    element("b", "", load.name),
    element("small", "", loadConfigSummary(load, english() ? "en" : "it")),
  );
  node.append(element("span", "dm-loads-preview-index", String(index + 1)), bubble, text);
  return node;
}

function textField(label, value, onChange, { className = "ed-input", type = "text", hook = "" } = {}) {
  const field = element("label", "ed-slot");
  field.append(element("span", "ed-slot-lbl", label));
  const input = doc.createElement("input");
  input.className = className;
  input.type = type;
  if (hook) input.dataset[hook] = "true";
  input.value = value || "";
  input.addEventListener("change", () => onChange(clean(input.value)));
  field.append(input);
  return field;
}

function entityField(id, label, value, hint, onChange) {
  const field = element("label", "ed-slot");
  const caption = element("span", "ed-slot-lbl", label);
  field.append(caption);
  if (hint) field.append(element("span", "ed-hint", hint));
  const { field: picker } = createEntityPickerField(doc, {
    id,
    value,
    label,
    locale: english() ? "en" : "it",
    placeholder: "sensor.entity",
    onPick: (input) => root.wzPickEntity?.(input),
    onChange,
  });
  field.append(picker);
  return field;
}

function warnings(load) {
  const messages = loadConfigWarnings(load, english() ? "en" : "it");
  if (!messages.length) return null;
  const list = element("ul", "dm-loads-warnings");
  for (const message of messages) list.append(element("li", "", message));
  return list;
}

function subloadRow(panel, load, child, index) {
  const row = element("article", "ed-row dm-loads-subload");
  row.dataset.dmSubload = child.id;
  const main = element("div", "ed-row-main");
  const title = element("div", "ed-row-new");
  title.textContent = `${child.icon || "🔌"} ${child.name}`;
  const detail = element("div", "ed-row-old mono");
  detail.textContent =
    [child.power, child.daily, child.monthly, child.total].filter(Boolean).join(" · ") ||
    t("nessuna entità", "no entity yet");
  main.append(title, detail);
  row.append(main);

  const edit = element("button", "ed-del", "✏️");
  edit.type = "button";
  edit.dataset.dmSubloadEdit = "true";
  edit.title = t("Modifica", "Edit");
  edit.addEventListener("click", () => {
    state.editing = state.editing === child.id ? "" : child.id;
    render(panel);
  });
  const remove = element("button", "ed-del", "🗑️");
  remove.type = "button";
  remove.dataset.dmSubloadDelete = "true";
  remove.title = t("Elimina", "Delete");
  remove.addEventListener("click", () => {
    load.children.splice(index, 1);
    markDirty(panel);
  });
  row.append(edit, remove);

  if (state.editing !== child.id) return [row];

  const form = element("div", "ed-form dm-loads-subload-form");
  form.append(
    textField(
      t("Nome", "Name"),
      child.name,
      (value) => {
        child.name = value;
        markDirty(panel);
      },
      { hook: "dmSubloadName" },
    ),
    textField(
      t("Icona", "Icon"),
      child.icon,
      (value) => {
        child.icon = value;
        markDirty(panel);
      },
      { className: "ed-input ed-icon-input" },
    ),
    entityField(`dm-loads-${child.id}-power`, t("Potenza", "Power"), child.power, "", (value) => {
      child.power = value;
      state.dirty = true;
    }),
    entityField(
      `dm-loads-${child.id}-total`,
      t("Contatore totale", "Total meter"),
      child.total,
      t(
        "Da qui si calcolano giorno e mese.",
        "Day and month are calculated from this one.",
      ),
      (value) => {
        child.total = value;
        state.dirty = true;
      },
    ),
  );
  const done = element("button", "ed-btn-secondary", t("Chiudi", "Close"));
  done.type = "button";
  done.dataset.dmSubloadDone = "true";
  done.addEventListener("click", () => {
    state.editing = "";
    render(panel);
  });
  form.append(done);
  return [row, form];
}

function loadCard(panel, load, index, total) {
  const card = element("details", "ed-acc dm-loads-card");
  card.dataset.dmLoad = load.id;
  card.open = state.open.has(load.id);
  card.addEventListener("toggle", () => {
    if (card.open) state.open.add(load.id);
    else state.open.delete(load.id);
  });

  const head = element("summary", "ed-acc-head");
  head.append(preview(load, index));
  const controls = element("span", "dm-loads-card-controls");
  for (const [symbol, delta, label] of [
    ["▲", -1, t("Sposta su", "Move up")],
    ["▼", 1, t("Sposta giù", "Move down")],
  ]) {
    const button = element("button", "ed-del", symbol);
    button.type = "button";
    button.title = label;
    button.disabled = (delta < 0 && index === 0) || (delta > 0 && index === total - 1);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      state.model = moveLoad(model(), load.id, delta);
      markDirty(panel);
    });
    controls.append(button);
  }
  const remove = element("button", "ed-del", "🗑️");
  remove.type = "button";
  remove.title = t("Elimina carico", "Delete load");
  remove.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    state.model = model().filter((item) => clean(item.id) !== clean(load.id));
    markDirty(panel);
  });
  controls.append(remove);
  head.append(controls);
  card.append(head);

  const body = element("div", "ed-acc-body");

  const identity = element("div", "ed-form-row dm-loads-identity");
  const name = doc.createElement("input");
  name.className = "ed-input";
  name.value = load.name;
  name.setAttribute("aria-label", t("Nome del carico", "Load name"));
  name.addEventListener("change", () => {
    load.name = clean(name.value);
    markDirty(panel);
  });
  const icon = doc.createElement("input");
  icon.className = "ed-input ed-icon-input";
  icon.value = load.icon;
  icon.placeholder = "🍳 / mdi:stove";
  icon.setAttribute("aria-label", t("Icona", "Icon"));
  icon.addEventListener("change", () => {
    load.icon = clean(icon.value);
    markDirty(panel);
  });
  const color = doc.createElement("input");
  color.className = "dm-loads-color";
  color.type = "color";
  color.value = load.color;
  color.setAttribute("aria-label", t("Colore", "Colour"));
  color.addEventListener("change", () => {
    load.color = clean(color.value);
    markDirty(panel);
  });
  identity.append(name, icon, color);
  body.append(identity);

  const visible = element("label", "dm-loads-switch");
  const toggle = doc.createElement("input");
  toggle.type = "checkbox";
  toggle.checked = load.visible;
  toggle.dataset.dmLoadVisible = "true";
  toggle.addEventListener("change", () => {
    load.visible = toggle.checked;
    markDirty(panel);
  });
  visible.append(toggle, element("span", "", t("Mostra nel flusso", "Show in the flow")));
  body.append(visible);

  body.append(
    entityField(
      `dm-loads-${load.id}-power`,
      t("Potenza istantanea", "Instant power"),
      load.power,
      t("Il valore della vista Istantaneo.", "What the Instant view shows."),
      (value) => {
        load.power = value;
        state.dirty = true;
      },
    ),
    entityField(
      `dm-loads-${load.id}-total`,
      t("Contatore energia totale", "Total energy meter"),
      load.total,
      t(
        "Cumulativo. Giorno e Mese si calcolano da qui come differenza Recorder, quindi non serve un sensore per periodo.",
        "Cumulative. Day and Month are calculated from it as a Recorder difference, so no per-period sensor is needed.",
      ),
      (value) => {
        load.total = value;
        state.dirty = true;
      },
    ),
  );

  const optional = element("details", "ed-acc dm-loads-optional");
  const optionalHead = element("summary", "ed-acc-head");
  optionalHead.append(
    element("span", "", t("Sensori di periodo (facoltativi)", "Period sensors (optional)")),
  );
  optional.append(optionalHead);
  const optionalBody = element("div", "ed-acc-body");
  optionalBody.append(
    element(
      "div",
      "ed-hint",
      t(
        "Solo se hai già un helper che misura il periodo. Senza, il periodo viene dal contatore totale.",
        "Only if you already have a helper measuring the period. Without one, the period comes from the total meter.",
      ),
    ),
    entityField(
      `dm-loads-${load.id}-daily`,
      t("Energia oggi", "Energy today"),
      load.daily,
      "",
      (value) => {
        load.daily = value;
        state.dirty = true;
      },
    ),
    entityField(
      `dm-loads-${load.id}-monthly`,
      t("Energia mese", "Energy this month"),
      load.monthly,
      "",
      (value) => {
        load.monthly = value;
        state.dirty = true;
      },
    ),
  );
  optional.append(optionalBody);
  body.append(optional);

  const notes = warnings(load);
  if (notes) body.append(notes);

  const children = element("section", "dm-loads-children");
  children.append(
    element("div", "ed-sec-title", t("Dispositivi dentro il carico", "Appliances inside the load")),
    element(
      "div",
      "ed-hint",
      t(
        "Sono le card del popup che si apre cliccando il cerchio nel flusso.",
        "These are the cards of the popup opened by clicking the circle in the flow.",
      ),
    ),
  );
  const list = element("div", "ed-list");
  if (!load.children.length)
    list.append(element("div", "ed-empty", t("Nessun dispositivo.", "No appliance yet.")));
  load.children.forEach((child, childIndex) =>
    list.append(...subloadRow(panel, load, child, childIndex)),
  );
  children.append(list);
  const addChild = element(
    "button",
    "ed-btn-add",
    `＋ ${t("Aggiungi dispositivo", "Add appliance")}`,
  );
  addChild.type = "button";
  addChild.dataset.dmSubloadAdd = "true";
  addChild.disabled = load.children.length >= MAX_SUBLOADS;
  addChild.addEventListener("click", () => {
    const child = emptySubload(load, english() ? "en" : "it");
    load.children.push(child);
    state.editing = child.id;
    markDirty(panel);
  });
  children.append(addChild);
  body.append(children);

  card.append(body);
  return card;
}

export function renderEnergyLoadsEditor(panel = doc?.querySelector?.(PANEL)) {
  if (!panel || !doc) return false;
  if (state.rendering) return false;
  state.rendering = true;
  try {
    panel.dataset.dmLoadsEditor = "true";
    let host = panel.querySelector(":scope > [data-dm-loads-host]");
    if (!host) {
      host = doc.createElement("section");
      host.dataset.dmLoadsHost = "true";
      panel.append(host);
    }
    host.replaceChildren();

    const values = model();
    host.append(
      element(
        "div",
        "ed-intro",
        t(
          "Ogni carico è un cerchio sotto Casa, nell'ordine di questa lista. Quello che scrivi qui è quello che vedi nel flusso.",
          "Every load is a circle under Home, in the order of this list. What you write here is what the flow shows.",
        ),
      ),
    );

    if (!values.length)
      host.append(
        element(
          "div",
          "ed-empty",
          t(
            "Nessun carico configurato: il flusso mostra solo Casa, Solare, Rete e Batteria.",
            "No load configured: the flow only shows Home, Solar, Grid and Battery.",
          ),
        ),
      );

    const list = element("div", "ed-list dm-loads-list");
    values.forEach((load, index) => list.append(loadCard(panel, load, index, values.length)));
    host.append(list);

    const add = element("button", "ed-btn-add", `＋ ${t("Aggiungi carico", "Add load")}`);
    add.type = "button";
    add.disabled = values.length >= MAX_FLOW_LOADS;
    add.dataset.dmLoadAdd = "true";
    add.addEventListener("click", () => {
      if (model().length >= MAX_FLOW_LOADS) return;
      const load = emptyLoad(model(), english() ? "en" : "it");
      state.model = [...model(), load];
      state.open.add(load.id);
      markDirty(panel);
    });
    host.append(add);
    if (values.length >= MAX_FLOW_LOADS)
      host.append(
        element(
          "div",
          "ed-hint",
          t(
            `Massimo ${MAX_FLOW_LOADS} carichi nel flusso.`,
            `At most ${MAX_FLOW_LOADS} loads fit in the flow.`,
          ),
        ),
      );

    const actions = element("div", "ed-action-bar");
    actions.dataset.state = state.dirty ? "dirty" : "clean";
    const save = element("button", "ed-save-btn", `💾 ${t("Salva carichi", "Save loads")}`);
    save.type = "button";
    save.dataset.dmLoadsSave = "true";
    save.disabled = !state.dirty;
    const status = doc.createElement("output");
    status.dataset.dmLoadsStatus = "true";
    status.textContent = state.dirty
      ? t("Modifiche non salvate", "Unsaved changes")
      : t("Tutto salvato", "All saved");
    save.addEventListener("click", () => {
      void persist(panel).catch((error) => {
        status.textContent = t("Salvataggio non riuscito", "Save failed");
        console.error("[DashboardModern] unable to save loads", error);
      });
    });
    actions.append(save, status);
    host.append(actions);
  } finally {
    state.rendering = false;
  }
  return true;
}

function render(panel) {
  renderEnergyLoadsEditor(panel);
}

function installStyles() {
  installStyle(
    "dm-energy-loads-editor-style",
    `
    [data-energy-panel="loads"][data-dm-loads-editor="true"]{display:block!important}
    .dm-loads-list{display:grid;gap:10px}
    .dm-loads-card>.ed-acc-head{display:flex;align-items:center;gap:10px;justify-content:space-between}
    .dm-loads-preview{display:flex;align-items:center;gap:10px;min-width:0}
    .dm-loads-preview-index{display:grid;place-items:center;width:22px;height:22px;border-radius:50%;background:var(--divider-color,#e2e8f0);color:var(--muted,#64748b);font-size:12px;font-weight:800}
    .dm-loads-preview-bubble{display:grid;place-items:center;width:42px;height:42px;border-radius:50%;font-size:21px;background:color-mix(in srgb,var(--dm-loads-color,#0ea5e9) 16%,transparent);border:2px solid var(--dm-loads-color,#0ea5e9)}
    .dm-loads-preview[data-dm-loads-visible="false"] .dm-loads-preview-bubble{opacity:.42;border-style:dashed}
    .dm-loads-preview-text{display:flex;flex-direction:column;min-width:0}
    .dm-loads-preview-text b{color:var(--text,#0f172a);font-size:15px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .dm-loads-preview-text small{color:var(--muted,#64748b);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .dm-loads-card-controls{display:flex;gap:6px;flex:none}
    .dm-loads-card-controls button[disabled]{opacity:.35;pointer-events:none}
    .dm-loads-identity{display:grid;grid-template-columns:minmax(0,1fr) 92px 52px;gap:10px;align-items:center}
    .dm-loads-color{width:52px;height:44px;padding:2px;border:1px solid var(--border,rgba(15,23,42,.14));border-radius:12px;background:var(--card-bg,#fff)}
    .dm-loads-switch{display:flex;align-items:center;gap:9px;margin:10px 0;color:var(--text,#0f172a);font-weight:700}
    .dm-loads-warnings{margin:10px 0 0;padding-left:18px;color:var(--muted,#64748b);font-size:13px;line-height:1.45}
    .dm-loads-children{margin-top:14px}
    .dm-loads-subload-form{margin:0 0 10px;padding:12px;border-radius:14px;background:color-mix(in srgb,var(--card-bg,#fff) 92%,var(--divider-color,#e2e8f0))}
    @media(max-width:640px){.dm-loads-identity{grid-template-columns:minmax(0,1fr) 72px 46px}}
  `,
  );
}

function panelNode() {
  return doc?.querySelector?.(PANEL) || null;
}

function scheduleRender() {
  root.queueMicrotask?.(() => {
    const panel = panelNode();
    // A pending edit must survive background re-renders triggered by unrelated
    // runtime work; only a clean panel is rebuilt from storage.
    if (panel && !state.dirty) {
      state.model = null;
      render(panel);
    } else if (panel) render(panel);
  });
}

export function installEnergyLoadsEditor() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  root.dmRenderEnergyLoadsEditor = () => renderEnergyLoadsEditor();
  doc.addEventListener(
    "click",
    (event) => {
      if (event.target?.closest?.("[data-energy-tab],.ed-inner-tab,[data-tab='sez1']"))
        scheduleRender();
    },
    true,
  );
  for (const name of ["dashboardmodern:runtime-ready", "dashboardmodern:legacy-ready"])
    root.addEventListener?.(name, scheduleRender);
  scheduleRender();
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installEnergyLoadsEditor, { once: true });
else installEnergyLoadsEditor();
