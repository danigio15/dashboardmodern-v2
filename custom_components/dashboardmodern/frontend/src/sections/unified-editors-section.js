import {
  clean,
  doc,
  esc,
  readJson,
  root,
  t,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_UNIFIED_EDITORS_SECTION__";
const state = (root[KEY] ||= { installed: false });

const ACTION_TYPES = Object.freeze([
  ["builtin_luci", "💡", "Gestione Luci", "Lights control"],
  ["builtin_clima", "❄️", "Clima", "Climate"],
  ["builtin_antifurto", "🛡️", "Antifurto", "Alarm"],
  ["builtin_lavatrice", "🧺", "Lavatrice", "Washing machine"],
  ["toggle", "⚡", "Toggle entità", "Toggle entity"],
  ["script", "▶️", "Script", "Script"],
  ["scene", "🎬", "Scena", "Scene"],
]);

function canonicalClimateType(value) {
  const token = clean(value).toLowerCase();
  if (["termo", "termostato", "thermostat", "heat", "heating", "caldo"].includes(token)) return "termo";
  return "clima";
}

function normalizeClimateList(values) {
  return (Array.isArray(values) ? values : []).map((item) => ({
    ...item,
    type: canonicalClimateType(item?.type),
  }));
}

function migrateClimateTypes() {
  const stored = readJson("cd_clima_units", []);
  if (!Array.isArray(stored) || !stored.length) return false;
  const normalized = normalizeClimateList(stored);
  const changed = normalized.some((item, index) => clean(item.type) !== clean(stored[index]?.type));
  if (!changed) return false;
  writeJsonIfChanged("cd_clima_units", normalized);
  root.buildClimaCards?.();
  root.buildDeviceCards?.();
  return true;
}

function listFor(kind) {
  if (kind === "action") return root.getQuickActions?.().slice?.() || readJson("cd_quick_actions", []);
  if (kind === "climate") {
    const values = root.getClimaUnits?.().slice?.() || readJson("cd_clima_units", []);
    return normalizeClimateList(values);
  }
  if (kind === "shutter") return root.getTapparelle?.().slice?.() || readJson("cd_tapparelle", []);
  if (kind === "room") return root.getStanze?.().slice?.() || readJson("cd_stanze", []);
  return [];
}

function roomsOptions(selected) {
  const rooms = readJson("cd_stanze", []);
  return [
    `<option value="">— ${t("Nessuna stanza", "No room")} —</option>`,
    ...rooms.map((room) => {
      const value = clean(room.id || room.name);
      return `<option value="${esc(value)}" ${[room.id, room.name].map(clean).includes(clean(selected)) ? "selected" : ""}>${esc(room.icon || "🏠")} ${esc(room.name || value)}</option>`;
    }),
  ].join("");
}

function actionTypeValue(item) {
  return item.type === "builtin" ? `builtin_${item.builtin || "luci"}` : item.type || "toggle";
}

function actionTypeIcon(value) {
  return ACTION_TYPES.find(([type]) => type === clean(value))?.[1] || "⚡";
}

function actionTypeOptions(item) {
  const selected = actionTypeValue(item);
  return ACTION_TYPES
    .map(([value, icon, it, en]) => `<option value="${value}" ${value === selected ? "selected" : ""}>${icon} ${t(it, en)}</option>`)
    .join("");
}

function iconMarkup(value, fallback = "🔘", size = 34) {
  const icon = clean(value) || fallback;
  try {
    const markup = root.cdIconMarkup?.(icon, size);
    if (markup) return markup;
  } catch (_error) {}
  return esc(icon.startsWith("mdi:") ? fallback : icon);
}

function modalShell(kind, title, body, headerIcon = "✏️") {
  const modal = doc.createElement("div");
  modal.id = `dm-${kind}-editor-modal`;
  modal.className = "dm-section-modal";
  modal.innerHTML = `<section class="dm-section-dialog" role="dialog" aria-modal="true" aria-labelledby="dm-${kind}-editor-title">
    <header><strong id="dm-${kind}-editor-title"><span class="dm-editor-header-icon" aria-hidden="true">${headerIcon}</span> ${title}</strong><button type="button" data-close aria-label="${t("Chiudi", "Close")}">✕</button></header>
    <form data-form>${body}<output data-error></output><footer><button type="button" class="ed-btn-add" data-cancel>${t("Annulla", "Cancel")}</button><button type="submit" class="ed-save-btn">💾 ${t("Salva modifiche", "Save changes")}</button></footer></form>
  </section>`;
  doc.body.append(modal);
  const close = () => modal.remove();
  modal.querySelectorAll("[data-close],[data-cancel]").forEach((button) => button.addEventListener("click", close));
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });
  return { modal, form: modal.querySelector("[data-form]"), close };
}

function persist(kind, list) {
  const keys = {
    action: "cd_quick_actions",
    climate: "cd_clima_units",
    shutter: "cd_tapparelle",
    room: "cd_stanze",
  };
  const values = kind === "climate" ? normalizeClimateList(list) : list;
  if (!writeJsonIfChanged(keys[kind], values)) return;
  if (kind === "action") root.buildQuickActions?.();
  if (kind === "climate") {
    root.buildClimaCards?.();
    root.buildDeviceCards?.();
  }
  if (kind === "shutter") root.renderTapparelle?.();
  if (kind === "room") {
    root.buildTempCards?.();
    root.cdFillRoomSelects?.();
  }
}

function currentTab(kind) {
  return { action: "sezioni", climate: "sezioni", shutter: "tapp", room: "stanze" }[kind];
}

function syncActionEditor(form) {
  const type = clean(form.elements.type.value) || "toggle";
  const builtin = type.startsWith("builtin_");
  const canonical = actionTypeIcon(type);
  const icon = form.elements.icon;
  const previousCanonical = clean(icon.dataset.canonicalIcon);
  if (!clean(icon.value) || clean(icon.value) === previousCanonical) icon.value = canonical;
  icon.dataset.canonicalIcon = canonical;
  icon.readOnly = false;
  icon.closest("label")?.classList.remove("dm-canonical-icon");
  const entityField = form.querySelector("[data-action-entity-field]");
  if (entityField) entityField.hidden = builtin;
  const preview = form.querySelector("[data-action-icon-preview]");
  if (preview) preview.innerHTML = iconMarkup(icon.value, canonical, 36);
  const header = form.closest(".dm-section-dialog")?.querySelector(".dm-editor-header-icon");
  if (header) header.textContent = canonical;
}

function openActionEditor(item, index) {
  if (item.type === "luci_group" && typeof root.edEditLightGroup === "function") {
    root.edEditLightGroup(index);
    return;
  }
  const selectedType = actionTypeValue(item);
  const initialIcon = clean(item.icon) || actionTypeIcon(selectedType);
  const { form, close } = modalShell(
    "action",
    t("Modifica azione", "Edit action"),
    `<label class="ed-slot"><span class="ed-slot-lbl">${t("Tipo", "Type")}</span><select class="ed-input" name="type">${actionTypeOptions(item)}</select></label>
     <label class="ed-slot"><span class="ed-slot-lbl">${t("Nome", "Name")}</span><input class="ed-input" name="name" value="${esc(item.name)}" required></label>
     <label class="ed-slot"><span class="ed-slot-lbl">${t("Icona", "Icon")}</span><span class="dm-unified-icon-row"><span class="dm-unified-icon-preview" data-action-icon-preview aria-hidden="true">${iconMarkup(initialIcon, actionTypeIcon(selectedType), 36)}</span><input class="ed-input" name="icon" value="${esc(initialIcon)}"></span><small>${t("L’icona è personalizzabile anche per le azioni integrate e viene mostrata nella Home.", "The icon is customizable for built-in actions too and is shown on Home.")}</small></label>
     <label class="ed-slot" data-action-entity-field><span class="ed-slot-lbl">${t("Entità Home Assistant", "Home Assistant entity")}</span><span class="ed-form-row"><input class="ed-input mono" name="entity" value="${esc(item.entity)}"><button type="button" class="dm-entity-picker" data-pick>🔍</button></span></label>
     <label class="ed-slot"><span class="ed-slot-lbl">${t("Conferma opzionale", "Optional confirmation")}</span><textarea class="ed-input" name="confirm">${esc(item.confirm || item.confirmation)}</textarea></label>`,
    actionTypeIcon(selectedType),
  );
  form.querySelector("[data-pick]").addEventListener("click", () => root.wzPickEntity?.(form.elements.entity));
  form.elements.type.addEventListener("change", () => syncActionEditor(form));
  form.elements.icon.addEventListener("input", () => {
    const preview = form.querySelector("[data-action-icon-preview]");
    if (preview) preview.innerHTML = iconMarkup(form.elements.icon.value, actionTypeIcon(form.elements.type.value), 36);
  });
  syncActionEditor(form);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = clean(form.elements.name.value);
    const type = clean(form.elements.type.value);
    if (!name) {
      form.querySelector("[data-error]").textContent = t("Inserisci un nome.", "Enter a name.");
      return;
    }
    const list = listFor("action");
    const builtin = type.startsWith("builtin_");
    const next = {
      ...item,
      name,
      icon: clean(form.elements.icon.value) || actionTypeIcon(type),
      confirm: clean(form.elements.confirm.value),
    };
    if (builtin) {
      next.type = "builtin";
      next.builtin = type.slice(8);
      delete next.entity;
    } else {
      next.type = type;
      next.entity = clean(form.elements.entity.value);
      delete next.builtin;
    }
    list[index] = next;
    persist("action", list);
    close();
    root.editorSwitch?.(currentTab("action"));
  });
}

function openClimateEditor(item, index) {
  const selectedType = canonicalClimateType(item.type);
  const { form, close } = modalShell(
    "climate",
    t("Modifica clima", "Edit climate"),
    `<label class="ed-slot"><span class="ed-slot-lbl">${t("Tipo", "Type")}</span><select class="ed-input" name="type"><option value="clima" ${selectedType === "clima" ? "selected" : ""}>❄️ ${t("Clima", "Climate")}</option><option value="termo" ${selectedType === "termo" ? "selected" : ""}>🌡️ ${t("Termostato", "Thermostat")}</option></select></label>
     <label class="ed-slot"><span class="ed-slot-lbl">${t("Nome", "Name")}</span><input class="ed-input" name="name" value="${esc(item.name)}" required></label>
     <label class="ed-slot"><span class="ed-slot-lbl">${t("Entità Home Assistant", "Home Assistant entity")}</span><span class="ed-form-row"><input class="ed-input mono" name="entity" value="${esc(item.entity)}" required><button type="button" class="dm-entity-picker" data-pick>🔍</button></span></label>
     <label class="ed-slot"><span class="ed-slot-lbl">${t("Stanza", "Room")}</span><select class="ed-input" name="room">${roomsOptions(item.room || item.room_id)}</select></label>`,
    selectedType === "termo" ? "🌡️" : "❄️",
  );
  form.querySelector("[data-pick]").addEventListener("click", () => root.wzPickEntity?.(form.elements.entity));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const list = listFor("climate");
    list[index] = {
      ...item,
      type: canonicalClimateType(form.elements.type.value),
      name: clean(form.elements.name.value),
      entity: clean(form.elements.entity.value),
      room: clean(form.elements.room.value),
    };
    if (!list[index].name || !list[index].entity) {
      form.querySelector("[data-error]").textContent = t("Nome ed entità sono obbligatori.", "Name and entity are required.");
      return;
    }
    persist("climate", list);
    close();
    root.editorSwitch?.(currentTab("climate"));
  });
}

function openShutterEditor(item, index) {
  const { form, close } = modalShell(
    "shutter",
    t("Modifica tapparella", "Edit shutter"),
    `<label class="ed-slot"><span class="ed-slot-lbl">${t("Nome", "Name")}</span><input class="ed-input" name="name" value="${esc(item.name)}" required></label>
     <label class="ed-slot"><span class="ed-slot-lbl">${t("Entità Home Assistant", "Home Assistant entity")}</span><span class="ed-form-row"><input class="ed-input mono" name="entity" value="${esc(item.entity)}" required><button type="button" class="dm-entity-picker" data-pick>🔍</button></span></label>
     <label class="ed-slot"><span class="ed-slot-lbl">${t("Stanza", "Room")}</span><select class="ed-input" name="room">${roomsOptions(item.room || item.room_id)}</select></label>`,
    "🪟",
  );
  form.querySelector("[data-pick]").addEventListener("click", () => root.wzPickEntity?.(form.elements.entity));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const list = listFor("shutter");
    list[index] = {
      ...item,
      name: clean(form.elements.name.value),
      entity: clean(form.elements.entity.value),
      room: clean(form.elements.room.value),
    };
    if (!list[index].name || !/^cover\./i.test(list[index].entity)) {
      form.querySelector("[data-error]").textContent = t("Inserisci un nome e un'entità cover.* valida.", "Enter a name and a valid cover.* entity.");
      return;
    }
    persist("shutter", list);
    close();
    root.editorSwitch?.(currentTab("shutter"));
  });
}

function openRoomEditor(item, index) {
  const initialIcon = clean(item.icon) || "mdi:home";
  const { form, close } = modalShell(
    "room",
    t("Modifica stanza", "Edit room"),
    `<label class="ed-slot"><span class="ed-slot-lbl">${t("Nome", "Name")}</span><input class="ed-input" name="name" value="${esc(item.name)}" required></label>
     <label class="ed-slot"><span class="ed-slot-lbl">${t("Icona", "Icon")}</span><span class="dm-unified-icon-row"><span class="dm-unified-icon-preview" data-room-icon-preview aria-hidden="true">${iconMarkup(initialIcon, "🏠", 36)}</span><input class="ed-input" name="icon" value="${esc(initialIcon)}"></span><small>${t("L’anteprima usa lo stesso renderer dell’icona stanza nella dashboard.", "The preview uses the same room-icon renderer as the dashboard.")}</small></label>
     <label class="ed-slot"><span class="ed-slot-lbl">${t("Piano", "Floor")}</span><input class="ed-input" name="floor" value="${esc(item.floor)}"></label>`,
    "🏠",
  );
  form.elements.icon.addEventListener("input", () => {
    const preview = form.querySelector("[data-room-icon-preview]");
    if (preview) preview.innerHTML = iconMarkup(form.elements.icon.value, "🏠", 36);
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const list = listFor("room");
    list[index] = {
      ...item,
      name: clean(form.elements.name.value),
      icon: clean(form.elements.icon.value) || "mdi:home",
      floor: clean(form.elements.floor.value),
    };
    if (!list[index].name) {
      form.querySelector("[data-error]").textContent = t("Inserisci il nome della stanza.", "Enter the room name.");
      return;
    }
    if (!list[index].floor) delete list[index].floor;
    persist("room", list);
    close();
    root.editorSwitch?.(currentTab("room"));
  });
}

function installStyles() {
  if (doc?.getElementById("dm-unified-editor-visual-style")) return;
  const style = doc.createElement("style");
  style.id = "dm-unified-editor-visual-style";
  style.textContent = `.dm-unified-icon-row{display:grid!important;grid-template-columns:72px minmax(0,1fr)!important;gap:12px!important;align-items:center!important}.dm-unified-icon-preview{display:grid!important;place-items:center!important;width:72px!important;height:72px!important;border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:18px!important;background:var(--secondary-background-color,#eef3f8)!important;font-size:34px!important;overflow:hidden!important}.dm-unified-icon-preview ha-icon{--mdc-icon-size:36px!important}.dm-canonical-icon input{opacity:.78!important}.dm-editor-header-icon ha-icon{--mdc-icon-size:28px!important}`;
  doc.head.append(style);
}

export function openUnifiedEditor(kind, index) {
  const item = listFor(kind)[index];
  if (!item) return false;
  doc?.querySelectorAll("#dm-action-editor-modal,#dm-climate-editor-modal,#dm-shutter-editor-modal,#dm-room-editor-modal").forEach((node) => node.remove());
  if (kind === "action") openActionEditor(item, index);
  else if (kind === "climate") openClimateEditor(item, index);
  else if (kind === "shutter") openShutterEditor(item, index);
  else if (kind === "room") openRoomEditor(item, index);
  else return false;
  return true;
}

export function installUnifiedEditorsSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  migrateClimateTypes();
  installStyles();
  doc.addEventListener(
    "click",
    (event) => {
      const edit = event.target?.closest?.("[data-dm-edit-kind]");
      if (!edit) return;
      const kind = clean(edit.dataset.dmEditKind);
      if (!["action", "climate", "shutter", "room"].includes(kind)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openUnifiedEditor(kind, Number(edit.dataset.dmEditIndex));
    },
    true,
  );
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installUnifiedEditorsSection, { once: true });
else installUnifiedEditorsSection();