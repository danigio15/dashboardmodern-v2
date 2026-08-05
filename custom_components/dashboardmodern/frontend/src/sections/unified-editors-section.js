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

function listFor(kind) {
  if (kind === "action") return root.getQuickActions?.().slice?.() || readJson("cd_quick_actions", []);
  if (kind === "climate") return root.getClimaUnits?.().slice?.() || readJson("cd_clima_units", []);
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

function actionTypeOptions(item) {
  const selected = item.type === "builtin" ? `builtin_${item.builtin || "luci"}` : item.type || "toggle";
  const choices = [
    ["builtin_luci", "💡", "Gestione Luci", "Lights control"],
    ["builtin_clima", "❄️", "Clima", "Climate"],
    ["builtin_antifurto", "🛡️", "Antifurto", "Alarm"],
    ["builtin_lavatrice", "🧺", "Lavatrice", "Washing machine"],
    ["toggle", "⚡", "Toggle entità", "Toggle entity"],
    ["script", "▶️", "Script", "Script"],
    ["scene", "🎬", "Scena", "Scene"],
  ];
  return choices
    .map(([value, icon, it, en]) => `<option value="${value}" ${value === selected ? "selected" : ""}>${icon} ${t(it, en)}</option>`)
    .join("");
}

function modalShell(kind, title, body) {
  const modal = doc.createElement("div");
  modal.id = `dm-${kind}-editor-modal`;
  modal.className = "dm-section-modal";
  modal.innerHTML = `<section class="dm-section-dialog" role="dialog" aria-modal="true" aria-labelledby="dm-${kind}-editor-title">
    <header><strong id="dm-${kind}-editor-title">✏️ ${title}</strong><button type="button" data-close aria-label="${t("Chiudi", "Close")}">✕</button></header>
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
  if (!writeJsonIfChanged(keys[kind], list)) return;
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

function openActionEditor(item, index) {
  if (item.type === "luci_group" && typeof root.edEditLightGroup === "function") {
    root.edEditLightGroup(index);
    return;
  }
  const { form, close } = modalShell(
    "action",
    t("Modifica azione", "Edit action"),
    `<label class="ed-slot"><span class="ed-slot-lbl">${t("Tipo", "Type")}</span><select class="ed-input" name="type">${actionTypeOptions(item)}</select></label>
     <label class="ed-slot"><span class="ed-slot-lbl">${t("Nome", "Name")}</span><input class="ed-input" name="name" value="${esc(item.name)}" required></label>
     <label class="ed-slot"><span class="ed-slot-lbl">${t("Icona", "Icon")}</span><input class="ed-input" name="icon" value="${esc(item.icon)}"></label>
     <label class="ed-slot"><span class="ed-slot-lbl">${t("Entità Home Assistant", "Home Assistant entity")}</span><span class="ed-form-row"><input class="ed-input mono" name="entity" value="${esc(item.entity)}"><button type="button" class="dm-entity-picker" data-pick>🔍</button></span></label>
     <label class="ed-slot"><span class="ed-slot-lbl">${t("Conferma opzionale", "Optional confirmation")}</span><textarea class="ed-input" name="confirm">${esc(item.confirm || item.confirmation)}</textarea></label>`,
  );
  form.querySelector("[data-pick]").addEventListener("click", () => root.wzPickEntity?.(form.elements.entity));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = clean(form.elements.name.value);
    const type = clean(form.elements.type.value);
    if (!name) {
      form.querySelector("[data-error]").textContent = t("Inserisci un nome.", "Enter a name.");
      return;
    }
    const list = listFor("action");
    const next = { ...item, name, icon: clean(form.elements.icon.value), confirm: clean(form.elements.confirm.value) };
    if (type.startsWith("builtin_")) {
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
  const { form, close } = modalShell(
    "climate",
    t("Modifica clima", "Edit climate"),
    `<label class="ed-slot"><span class="ed-slot-lbl">${t("Tipo", "Type")}</span><select class="ed-input" name="type"><option value="clima" ${item.type !== "termostato" ? "selected" : ""}>❄️ ${t("Clima", "Climate")}</option><option value="termostato" ${item.type === "termostato" ? "selected" : ""}>🌡️ ${t("Termostato", "Thermostat")}</option></select></label>
     <label class="ed-slot"><span class="ed-slot-lbl">${t("Nome", "Name")}</span><input class="ed-input" name="name" value="${esc(item.name)}" required></label>
     <label class="ed-slot"><span class="ed-slot-lbl">${t("Entità Home Assistant", "Home Assistant entity")}</span><span class="ed-form-row"><input class="ed-input mono" name="entity" value="${esc(item.entity)}" required><button type="button" class="dm-entity-picker" data-pick>🔍</button></span></label>
     <label class="ed-slot"><span class="ed-slot-lbl">${t("Stanza", "Room")}</span><select class="ed-input" name="room">${roomsOptions(item.room || item.room_id)}</select></label>`,
  );
  form.querySelector("[data-pick]").addEventListener("click", () => root.wzPickEntity?.(form.elements.entity));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const list = listFor("climate");
    list[index] = {
      ...item,
      type: clean(form.elements.type.value) || "clima",
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
  const { form, close } = modalShell(
    "room",
    t("Modifica stanza", "Edit room"),
    `<label class="ed-slot"><span class="ed-slot-lbl">${t("Nome", "Name")}</span><input class="ed-input" name="name" value="${esc(item.name)}" required></label>
     <label class="ed-slot"><span class="ed-slot-lbl">${t("Icona", "Icon")}</span><input class="ed-input" name="icon" value="${esc(item.icon || "🏠")}"></label>
     <label class="ed-slot"><span class="ed-slot-lbl">${t("Piano", "Floor")}</span><input class="ed-input" name="floor" value="${esc(item.floor)}"></label>`,
  );
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const list = listFor("room");
    list[index] = {
      ...item,
      name: clean(form.elements.name.value),
      icon: clean(form.elements.icon.value) || "🏠",
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