import {
  clean,
  doc,
  english,
  installStyle,
  readJson,
  root,
  t,
  wrapFunction,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_EDITOR_CRUD_SECTION__";
const state = (root[KEY] ||= { installed: false, listeners: false, editing: null });

function syncEditorTheme() {
  const modal = doc?.getElementById("editor-modal");
  if (!modal) return;
  const explicit = clean(doc.documentElement?.dataset?.theme || doc.body?.dataset?.theme).toLowerCase();
  let dark = explicit === "dark";
  if (!explicit) {
    const scheme = clean(root.getComputedStyle?.(doc.documentElement)?.colorScheme).toLowerCase();
    dark = scheme.includes("dark") && !scheme.includes("light");
  }
  modal.dataset.dmEditorTheme = dark ? "dark" : "light";
}

function cumulativeEntity(entity) {
  const id = clean(entity);
  if (!id) return false;
  const current = root.STATES?.[id] || root._RAW_STATES?.[id] || null;
  const stateClass = clean(current?.attributes?.state_class).toLowerCase();
  return (
    stateClass === "total" ||
    stateClass === "total_increasing" ||
    /(?:^|[._-])(total|totale|lifetime|meter|contatore)(?:[._-]|$)/i.test(id)
  );
}

function normalizeReportEditor() {
  const panel = doc?.querySelector("#editor-modal [data-energy-panel='report']");
  if (!panel) return false;
  panel.dataset.dmReportEditor = "canonical";
  panel.querySelectorAll(".dm-report-row").forEach((row) => {
    const primary = row.querySelector("[data-entity-field]");
    if (!primary) return;
    const label = primary.querySelector(".ed-slot-lbl");
    if (label?.childNodes?.[0])
      label.childNodes[0].nodeValue = t("Entità totale per lo storico ", "Lifetime total entity ");
    const input = primary.querySelector("input");
    let helper = row.querySelector(".dm-report-history-help");
    if (!helper) {
      helper = doc.createElement("div");
      helper.className = "dm-report-history-help";
      row.append(helper);
    }
    const valid = !input?.value || cumulativeEntity(input.value);
    row.dataset.historyValid = String(valid);
    helper.textContent = valid
      ? t(
          "Contatore cumulativo kWh: abilita mese selezionato, mesi precedenti e anno.",
          "Cumulative kWh meter: enables selected month, previous months and year.",
        )
      : t(
          "L’entità non sembra cumulativa: seleziona il contatore totale lifetime del dispositivo.",
          "This entity does not look cumulative: select the device lifetime total meter.",
        );
  });
  return true;
}

function listFor(kind) {
  if (kind === "action") return root.getQuickActions?.().slice?.() || readJson("cd_quick_actions", []);
  if (kind === "climate") return root.getClimaUnits?.().slice?.() || readJson("cd_clima_units", []);
  if (kind === "shutter") return root.getTapparelle?.().slice?.() || readJson("cd_tapparelle", []);
  if (kind === "room") return root.getStanze?.().slice?.() || readJson("cd_stanze", []);
  return [];
}

function editButton(kind, index) {
  const button = doc.createElement("button");
  button.type = "button";
  button.className = "ed-del dm-edit-existing";
  button.dataset.dmEditKind = kind;
  button.dataset.dmEditIndex = String(index);
  button.textContent = "✏️";
  button.title = t("Modifica", "Edit");
  button.setAttribute("aria-label", button.title);
  return button;
}

function rowsBeforeForm(container, selector) {
  const field = container?.querySelector(selector);
  if (!container || !field) return [];
  return [...container.querySelectorAll(".ed-row")].filter((row) => {
    if (row.contains(field) || row.querySelector("[data-dm-edit-kind]")) return false;
    return Boolean(row.querySelector(".ed-del")) && Boolean(row.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
}

function ensureEditButtons() {
  const body = doc?.getElementById("ed-body");
  if (!body) return false;
  const definitions = [
    ["action", body.querySelector("#ed-qa-type")?.closest("details") || body, "#ed-qa-type"],
    ["climate", body.querySelector("#ed-cl-type")?.closest("details") || body, "#ed-cl-type"],
    ["shutter", body, "#ed-tp-name"],
    ["room", body, "#ed-room-name"],
  ];
  definitions.forEach(([kind, container, selector]) => {
    if (!container?.querySelector(selector)) return;
    rowsBeforeForm(container, selector).forEach((row, index) => {
      const remove = [...row.querySelectorAll(".ed-del")].at(-1);
      remove?.before(editButton(kind, index));
    });
  });
  return Boolean(body.querySelector("[data-dm-edit-kind]"));
}

function formFor(kind) {
  const selectors = {
    action: "#ed-qa-type",
    climate: "#ed-cl-type",
    shutter: "#ed-tp-name",
    room: "#ed-room-name",
  };
  const field = doc?.querySelector(selectors[kind]);
  return field?.closest(".ed-form") || field?.parentElement || null;
}

function setField(id, value) {
  const field = doc?.getElementById(id);
  if (!field) return;
  field.value = value ?? "";
  field.dispatchEvent(new Event("change", { bubbles: true }));
}

function addCancel(kind) {
  const form = formFor(kind);
  if (!form || form.querySelector(".dm-edit-cancel")) return;
  const cancel = doc.createElement("button");
  cancel.type = "button";
  cancel.className = "ed-btn-add dm-edit-cancel";
  cancel.textContent = t("Annulla modifica", "Cancel edit");
  cancel.addEventListener("click", () => {
    state.editing = null;
    root.editorSwitch?.(doc.querySelector(".ed-tab.active")?.dataset?.tab || "sezioni");
  });
  form.append(cancel);
}

function beginEdit(kind, index) {
  const item = listFor(kind)[index];
  if (!item) return;
  if (kind === "action" && item.type === "luci_group" && typeof root.edEditLightGroup === "function") {
    root.edEditLightGroup(index);
    return;
  }
  state.editing = { kind, index };
  formFor(kind)?.setAttribute("data-dm-editing", "true");
  if (kind === "action") {
    setField("ed-qa-type", item.type === "builtin" ? `builtin_${item.builtin}` : item.type || "toggle");
    setField("ed-qa-icon", item.icon || "");
    setField("ed-qa-name", item.name || "");
    setField("ed-qa-ent", item.entity || "");
    setField("ed-qa-confirm", item.confirm || item.confirmation || "");
    root.edQaTypeChanged?.();
  } else if (kind === "climate") {
    setField("ed-cl-type", item.type || "clima");
    setField("ed-cl-name", item.name || "");
    setField("ed-cl-ent", item.entity || "");
    setField("ed-cl-room", item.room || item.room_id || "");
  } else if (kind === "shutter") {
    setField("ed-tp-name", item.name || "");
    setField("ed-tp-ent", item.entity || "");
    setField("ed-tp-room", item.room || item.room_id || "");
  } else if (kind === "room") {
    setField("ed-room-name", item.name || "");
    setField("ed-room-icon", item.icon || "🏠");
    setField("ed-room-floor", item.floor || "");
    const preview = doc.getElementById("ed-room-icon-preview");
    if (preview) preview.innerHTML = root.cdIconMarkup?.(item.icon || "🏠", 26) || item.icon || "🏠";
  }
  const add = formFor(kind)?.querySelector(".ed-btn-add:not(.dm-edit-cancel)");
  if (add) add.textContent = t("💾 Salva modifiche", "💾 Save changes");
  addCancel(kind);
}

function finishEdit(kind) {
  state.editing = null;
  root.editorSwitch?.({ action: "sezioni", climate: "sezioni", shutter: "tapp", room: "stanze" }[kind]);
}

function installAddWrappers() {
  const wrap = (name, kind, saveEdit) => {
    const current = root[name];
    if (typeof current !== "function" || current.__dmEditableSection) return;
    function editableOwner(...args) {
      if (state.editing?.kind !== kind) return current.apply(this, args);
      saveEdit(state.editing.index);
      finishEdit(kind);
    }
    editableOwner.__dmEditableSection = true;
    editableOwner.__dmPrevious = current;
    root[name] = editableOwner;
  };

  wrap("edAddQA", "action", (index) => {
    const list = listFor("action");
    const previous = list[index] || {};
    const selected = clean(doc.getElementById("ed-qa-type")?.value);
    const next = {
      ...previous,
      icon: clean(doc.getElementById("ed-qa-icon")?.value),
      name: clean(doc.getElementById("ed-qa-name")?.value),
      confirm: clean(doc.getElementById("ed-qa-confirm")?.value),
    };
    if (selected.startsWith("builtin_")) {
      next.type = "builtin";
      next.builtin = selected.slice(8);
      delete next.entity;
      delete next.lights;
    } else {
      next.type = selected;
      next.entity = clean(doc.getElementById("ed-qa-ent")?.value);
      delete next.builtin;
    }
    list[index] = next;
    writeJsonIfChanged("cd_quick_actions", list);
    root.buildQuickActions?.();
  });

  wrap("edAddClima", "climate", (index) => {
    const list = listFor("climate");
    list[index] = {
      ...(list[index] || {}),
      type: clean(doc.getElementById("ed-cl-type")?.value) || "clima",
      name: clean(doc.getElementById("ed-cl-name")?.value),
      entity: clean(doc.getElementById("ed-cl-ent")?.value),
      room: clean(doc.getElementById("ed-cl-room")?.value),
    };
    writeJsonIfChanged("cd_clima_units", list);
    root.buildClimaCards?.();
    root.buildDeviceCards?.();
  });

  wrap("edTappAdd", "shutter", (index) => {
    const list = listFor("shutter");
    list[index] = {
      ...(list[index] || {}),
      name: clean(doc.getElementById("ed-tp-name")?.value),
      entity: clean(doc.getElementById("ed-tp-ent")?.value),
      room: clean(doc.getElementById("ed-tp-room")?.value),
    };
    writeJsonIfChanged("cd_tapparelle", list);
    root.renderTapparelle?.();
  });

  wrap("edStanzaRoomAdd", "room", (index) => {
    const list = listFor("room");
    list[index] = {
      ...(list[index] || {}),
      name: clean(doc.getElementById("ed-room-name")?.value),
      icon: clean(doc.getElementById("ed-room-icon")?.value) || "🏠",
      floor: clean(doc.getElementById("ed-room-floor")?.value),
    };
    if (!list[index].floor) delete list[index].floor;
    writeJsonIfChanged("cd_stanze", list);
    root.buildTempCards?.();
  });
}

function runContracts() {
  syncEditorTheme();
  normalizeReportEditor();
  ensureEditButtons();
  installAddWrappers();
}

function installStyles() {
  installStyle(
    "dm-editor-crud-section-style",
    `
      #editor-modal[data-dm-editor-theme="dark"]{--dm-editor-shell:#161f36;--dm-editor-panel:#1b2540;--dm-editor-control:#212d4c;--dm-editor-border:#31405f;--dm-editor-text:#edf4ff;--dm-editor-muted:#a8b7cf;background:rgba(3,7,18,.76)!important;color-scheme:dark}
      #editor-modal[data-dm-editor-theme="dark"] .ed-shell,#editor-modal[data-dm-editor-theme="dark"] .ed-head,#editor-modal[data-dm-editor-theme="dark"] .ed-body{background:var(--dm-editor-shell)!important;color:var(--dm-editor-text)!important;border-color:var(--dm-editor-border)!important}
      #editor-modal[data-dm-editor-theme="dark"] .ed-tabs,#editor-modal[data-dm-editor-theme="dark"] .ed-inner-tabs,#editor-modal[data-dm-editor-theme="dark"] .sub-tabs-energy,#editor-modal[data-dm-editor-theme="dark"] .ed-row,#editor-modal[data-dm-editor-theme="dark"] .dm-report-row,#editor-modal[data-dm-editor-theme="dark"] .ed-acc,#editor-modal[data-dm-editor-theme="dark"] .ed-acc-body{background:var(--dm-editor-panel)!important;color:var(--dm-editor-text)!important;border-color:var(--dm-editor-border)!important}
      #editor-modal[data-dm-editor-theme="dark"] input,#editor-modal[data-dm-editor-theme="dark"] select,#editor-modal[data-dm-editor-theme="dark"] textarea,#editor-modal[data-dm-editor-theme="dark"] .ed-input{background:var(--dm-editor-control)!important;color:var(--dm-editor-text)!important;border-color:var(--dm-editor-border)!important}
      #editor-modal[data-dm-editor-theme="dark"] .ed-row-old,#editor-modal[data-dm-editor-theme="dark"] .ed-intro,#editor-modal[data-dm-editor-theme="dark"] .ed-hint,#editor-modal[data-dm-editor-theme="dark"] .ed-empty{color:var(--dm-editor-muted)!important}
      #editor-modal [data-energy-panel="report"] .dm-report-row{display:grid!important;grid-template-columns:minmax(120px,.8fr) minmax(150px,1.25fr) minmax(110px,.6fr) minmax(220px,1.8fr) auto!important;gap:10px!important;align-items:end!important;padding:14px!important;border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:16px!important;background:var(--ha-card-background,var(--card-bg,#fff))!important}
      #editor-modal [data-energy-panel="report"] .dm-report-row .dm-entity-field{min-width:0!important;margin:0!important}
      #editor-modal .dm-report-history-help{grid-column:1/-1;color:var(--secondary-text-color,#64748b);font-size:11px;line-height:1.4}
      #editor-modal .dm-report-row[data-history-valid="false"] .dm-report-history-help{color:var(--warning-color,#b45309);font-weight:800}
      #editor-modal .dm-edit-existing{background:color-mix(in srgb,var(--info-color,#0ea5e9) 14%,transparent)!important;color:var(--info-color,#0369a1)!important}
      #editor-modal .dm-edit-cancel{width:100%;margin-top:7px;background:var(--secondary-background-color,#e8eef5)!important;color:var(--primary-text-color,#0f172a)!important}
      #editor-modal [data-dm-editing="true"]{outline:2px solid color-mix(in srgb,var(--info-color,#0ea5e9) 45%,transparent);outline-offset:2px}
      @media(max-width:900px){#editor-modal [data-energy-panel="report"] .dm-report-row{grid-template-columns:1fr 1fr!important}#editor-modal [data-energy-panel="report"] .dm-report-row .dm-entity-field,#editor-modal .dm-report-history-help{grid-column:1/-1!important}}
      @media(max-width:560px){#editor-modal [data-energy-panel="report"] .dm-report-row{grid-template-columns:1fr!important}#editor-modal [data-energy-panel="report"] .dm-report-row>*{grid-column:1!important}}
    `,
  );
}

function installWrappers() {
  wrapFunction("editorSwitch", "__dmCrudEditorSection", runContracts);
}

export function installEditorCrudSection() {
  if (!doc) return;
  installStyles();
  installWrappers();
  runContracts();
  if (!state.listeners) {
    state.listeners = true;
    doc.addEventListener(
      "click",
      (event) => {
        const edit = event.target?.closest?.("[data-dm-edit-kind]");
        if (edit) {
          event.preventDefault();
          event.stopPropagation();
          beginEdit(edit.dataset.dmEditKind, Number(edit.dataset.dmEditIndex));
          return;
        }
        if (event.target?.closest?.(".ed-tab,.sub-tab-btn,[data-energy-tab],[data-report-add]"))
          root.queueMicrotask?.(runContracts);
      },
      true,
    );
    root.addEventListener?.("dashboardmodern:legacy-ready", () => {
      installWrappers();
      runContracts();
    });
    root.addEventListener?.("pageshow", runContracts);
  }
  state.installed = true;
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installEditorCrudSection, { once: true });
else installEditorCrudSection();
