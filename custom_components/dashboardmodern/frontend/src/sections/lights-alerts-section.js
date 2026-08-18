import { LIGHT_DOMAINS, isLightEntity, lightView } from "../core/light-model.js";
import {
  allStates,
  clean,
  doc,
  english,
  esc,
  installStyle,
  readJson,
  root,
  section,
  t,
  wrapFunction,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_LIGHTS_ALERTS_SECTION__";
const state = (root[KEY] ||= {
  installed: false,
  listeners: false,
  syncing: false,
});

function slug(value) {
  return clean(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function canonicalRooms() {
  const values = section("rooms", readJson("cd_stanze", []));
  return (Array.isArray(values) ? values : [])
    .map((room, index) => {
      const name = clean(room?.name || room?.id || `room-${index + 1}`);
      return {
        ...room,
        id: clean(room?.id) || `room-${slug(name) || index + 1}`,
        name,
      };
    })
    .filter((room) => room.name);
}

function resolveRoom(value, rooms = canonicalRooms()) {
  const raw = clean(value);
  if (!raw) return null;
  const lower = raw.toLowerCase();
  const token = slug(raw).replace(/^room-/, "");
  return (
    rooms.find((room) => clean(room.id) === raw) ||
    rooms.find((room) => clean(room.id).toLowerCase() === lower) ||
    rooms.find((room) => clean(room.name).toLowerCase() === lower) ||
    rooms.find((room) => slug(room.name) === token) ||
    rooms.find((room) => slug(room.id).replace(/^room-/, "") === token) ||
    null
  );
}

function roomLabel(value, rooms = canonicalRooms()) {
  return resolveRoom(value, rooms)?.name || clean(value) || t("Altre zone", "Other areas");
}

export function configuredLightGroups() {
  const lights = readJson("cd_luci", {});
  const assignments = readJson("cd_luci_rooms", {});
  const order = readJson("cd_luci_order", {});
  const preferredRooms = readJson("cd_luci_room_order", []);
  const rooms = canonicalRooms();
  const ids = Object.keys(lights).filter((id) => id.includes("."));
  const grouped = new Map();
  ids.forEach((id) => {
    const label = roomLabel(assignments[id], rooms);
    if (!grouped.has(label)) grouped.set(label, []);
    grouped.get(label).push(id);
  });
  const preferredLabels = preferredRooms.map((room) => roomLabel(room, rooms));
  const roomNames = [
    ...preferredLabels.filter((room, index) => grouped.has(room) && preferredLabels.indexOf(room) === index),
    ...[...grouped.keys()].filter((room) => !preferredLabels.includes(room)),
  ];
  return roomNames.map((room) => {
    const current = grouped.get(room) || [];
    const saved = Array.isArray(order[room]) ? order[room] : [];
    const entities = [
      ...saved.filter((id) => current.includes(id)),
      ...current.filter((id) => !saved.includes(id)),
    ];
    return { room, entities, lights };
  });
}

function roomOptions(selected) {
  const rooms = canonicalRooms();
  const target = resolveRoom(selected, rooms);
  return [
    `<option value="">— ${t("Altre zone", "Other areas")} —</option>`,
    ...rooms.map(
      (room) =>
        `<option value="${esc(room.id)}" ${target?.id === room.id ? "selected" : ""}>${clean(room.icon) && !clean(room.icon).startsWith("mdi:") ? `${esc(room.icon)} ` : ""}${esc(room.name)}</option>`,
    ),
  ].join("");
}

/* What the Luci tab shows about an entity beyond its name: whether it is a
 * lamp or a relay, and what Home Assistant says it can do. A light that only
 * turns on and off, a dimmer and an RGB strip are configured identically here,
 * so the badge is the only place the difference is visible before opening the
 * controls. */
function lightMeta(id) {
  const view = lightView(id, { state: allStates()?.[id] });
  const badges = [];
  if (!view.available) badges.push({ kind: "off", label: t("NON DISPONIBILE", "UNAVAILABLE") });
  if (view.colorful) badges.push({ kind: "rgb", label: "RGB" });
  if (view.tunable) badges.push({ kind: "white", label: t("BIANCO", "WHITE") });
  if (view.dimmable && !view.colorful && !view.tunable)
    badges.push({ kind: "dim", label: t("DIMMER", "DIMMER") });
  if (!view.dimmable && !view.colorful && !view.tunable)
    badges.push({ kind: "onoff", label: t("ON/OFF", "ON/OFF") });
  if (view.domain !== "light") badges.push({ kind: "domain", label: view.domain.toUpperCase() });
  return {
    view,
    glyph: view.domain === "light" ? "💡" : "🔌",
    badges: badges
      .map(
        (badge) =>
          `<span class="dm-light-badge" data-kind="${badge.kind}">${esc(badge.label)}</span>`,
      )
      .join(""),
  };
}

export function renderCanonicalLightsEditor() {
  const groups = configuredLightGroups();
  const assignments = readJson("cd_luci_rooms", {});
  const add = `<form class="ed-form dm-light-add-form" data-light-add-form onsubmit="event.preventDefault();cdLuceAdd()">
    <div class="ed-sec-title">＋ ${t("AGGIUNGI LUCE", "ADD LIGHT")}</div>
    <div class="ed-form-row"><input id="luce-add-ent" class="ed-input mono" data-entity-input data-light-add-entity data-domain="${LIGHT_DOMAINS.join(" ")}" placeholder="light.salone · switch.lampada"><button type="button" class="dm-entity-picker" data-entity-target="luce-add-ent" onclick="wzPickEntity(document.getElementById('luce-add-ent'))" aria-label="${t("Seleziona entità luce", "Select light entity")}">🔍</button></div>
    <input id="luce-add-name" class="ed-input" placeholder="${t("Nome luce", "Light name")}">
    <div class="dm-light-add-hint">${t("Una luce può essere un'entità light.* oppure uno switch.*: una lampada dietro un relè si aggiunge esattamente allo stesso modo.", "A light can be a light.* entity or a switch.*: a lamp behind a relay is added in exactly the same way.")}</div>
    <button type="submit" class="ed-btn-add">＋ ${t("Aggiungi luce", "Add light")}</button>
  </form>`;
  if (!groups.length)
    return `<div class="ed-empty">${t("Nessuna luce configurata.", "No configured lights.")}</div>${add}`;
  const body = groups
    .map((group, groupIndex) => {
      const rows = group.entities
        .map((id, index) => {
          const name = group.lights[id] || allStates()?.[id]?.attributes?.friendly_name || id;
          const meta = lightMeta(id);
          return `<article class="ed-row dm-light-row" data-light-entity="${esc(id)}">
            <span class="dm-light-order"><button type="button" class="ed-del" ${index === 0 ? "disabled" : ""} onclick="dmLightMove('${esc(id)}',-1)" aria-label="${t("Sposta su", "Move up")}">▲</button><button type="button" class="ed-del" ${index === group.entities.length - 1 ? "disabled" : ""} onclick="dmLightMove('${esc(id)}',1)" aria-label="${t("Sposta giù", "Move down")}">▼</button></span>
            <div class="ed-row-main"><div class="ed-row-new">${meta.glyph} ${esc(name)}</div><div class="ed-row-old mono">${esc(id)}</div><div class="dm-light-badges">${meta.badges}</div></div>
            <select class="ed-input dm-light-room" data-light-entity="${esc(id)}" onchange="dmLightSetRoom('${esc(id)}',this.value)">${roomOptions(assignments[id])}</select>
            <button type="button" class="ed-del dm-light-edit" onclick="dmOpenLightEditor('${esc(id)}')" aria-label="${t("Modifica luce", "Edit light")}">✏️</button>
            <button type="button" class="ed-del" onclick="cdLuceDel('${esc(id)}')" aria-label="${t("Elimina luce", "Delete light")}">🗑️</button>
          </article>`;
        })
        .join("");
      return `<section class="dm-light-group" data-light-room="${esc(group.room)}"><header class="ed-acc-head"><span>🏠 ${esc(group.room)} · ${group.entities.length}</span><span class="dm-light-room-order"><button type="button" class="ed-del" ${groupIndex === 0 ? "disabled" : ""} onclick="dmLightRoomMove('${esc(group.room)}',-1)">▲</button><button type="button" class="ed-del" ${groupIndex === groups.length - 1 ? "disabled" : ""} onclick="dmLightRoomMove('${esc(group.room)}',1)">▼</button></span></header><div class="ed-list">${rows}</div></section>`;
    })
    .join("");
  return `<div class="ed-intro">${t("Sono mostrate solo le stanze che contengono almeno una luce. Modifica apre tutti i dati della luce, non una finestra del browser. Le pastiglie dicono cosa sa fare ogni luce — RGB, bianco regolabile, dimmer o solo acceso/spento — ed è quello che comanda i controlli nel popup.", "Only rooms containing a light are shown. Edit opens all light fields, not a browser prompt. The pills say what each light can do — RGB, tunable white, dimmer or plain on/off — and that is what drives the controls in the popup.")}</div>${body}${add}`;
}

function persistLightOrder(groups, { sync = true } = {}) {
  const changedOrder = writeJsonIfChanged(
    "cd_luci_order",
    Object.fromEntries(groups.map((group) => [group.room, group.entities])),
    { sync: false },
  );
  const changedRooms = writeJsonIfChanged(
    "cd_luci_room_order",
    groups.map((group) => group.room),
    { sync: false },
  );
  if (sync && (changedOrder || changedRooms)) {
    root.cdMarkDirty?.();
    root.cdSyncPush?.();
  }
  return changedOrder || changedRooms;
}

function rerenderLights() {
  const body = doc?.getElementById("ed-body");
  if (body && doc.querySelector(".ed-tab.active")?.dataset?.tab === "luci") {
    body.innerHTML = renderCanonicalLightsEditor();
    return;
  }
  root.editorSwitch?.("luci");
}

function replaceEntity(value, oldId, newId) {
  if (Array.isArray(value)) return value.map((item) => replaceEntity(item, oldId, newId));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key === oldId ? newId : key, replaceEntity(item, oldId, newId)]),
    );
  }
  return value === oldId ? newId : value;
}

function saveAllLightMaps({ oldId, entity, name, roomId }) {
  const keys = [
    "cd_luci",
    "cd_luci_rooms",
    "cd_luci_order",
    "cd_luci_room_order",
    "cd_gruppi_extra",
    "cd_gruppi_removed",
    "cd_avvisi_names_extra",
    "cd_quick_actions",
  ];
  const values = Object.fromEntries(
    keys.map((key) => [
      key,
      readJson(key, key === "cd_luci_room_order" || key === "cd_quick_actions" ? [] : {}),
    ]),
  );
  const lights = values.cd_luci && typeof values.cd_luci === "object" ? values.cd_luci : {};
  const assignments = values.cd_luci_rooms && typeof values.cd_luci_rooms === "object" ? values.cd_luci_rooms : {};
  if (entity !== oldId) {
    delete lights[oldId];
    delete assignments[oldId];
    for (const key of keys.slice(2)) values[key] = replaceEntity(values[key], oldId, entity);
  }
  lights[entity] = name;
  if (roomId) assignments[entity] = roomId;
  else delete assignments[entity];
  values.cd_luci = lights;
  values.cd_luci_rooms = assignments;
  if (values.cd_avvisi_names_extra && typeof values.cd_avvisi_names_extra === "object")
    values.cd_avvisi_names_extra[entity] = name;

  let changed = false;
  for (const key of keys) changed = writeJsonIfChanged(key, values[key], { sync: false }) || changed;
  if (changed) {
    root.cdMarkDirty?.();
    root.cdSyncPush?.();
  }
  synchronizeLightAlerts();
}

export function openLightEditor(entityId) {
  const oldId = clean(entityId);
  const names = readJson("cd_luci", {});
  if (!oldId || !names[oldId]) return;
  doc?.getElementById("dm-light-editor-modal")?.remove();
  const assignments = readJson("cd_luci_rooms", {});
  const meta = lightMeta(oldId);
  const modal = doc.createElement("div");
  modal.id = "dm-light-editor-modal";
  modal.className = "dm-section-modal";
  modal.innerHTML = `<section class="dm-section-dialog" role="dialog" aria-modal="true" aria-labelledby="dm-light-editor-title">
    <header><strong id="dm-light-editor-title">${meta.glyph} ${t("Modifica luce", "Edit light")}</strong><button type="button" data-close aria-label="${t("Chiudi", "Close")}">✕</button></header>
    <form data-form>
      <label class="ed-slot"><span class="ed-slot-lbl">${t("Nome", "Name")}</span><input class="ed-input" name="name" value="${esc(names[oldId])}" required></label>
      <label class="ed-slot"><span class="ed-slot-lbl">${t("Entità Home Assistant", "Home Assistant entity")}</span><span class="ed-form-row"><input class="ed-input mono" name="entity" value="${esc(oldId)}" required data-domain="${LIGHT_DOMAINS.join(" ")}"><button type="button" class="dm-entity-picker" data-pick>🔍</button></span></label>
      <div class="ed-slot"><span class="dm-light-caps-lbl">${t("Cosa sa fare", "What it can do")}</span><div class="dm-light-caps"><div class="dm-light-badges" data-capabilities>${meta.badges}</div><button type="button" class="dm-light-caps-try" data-controls>${t("Prova i controlli", "Try the controls")}</button></div><small class="dm-light-caps-note">${t("Letto da Home Assistant. Una luce dietro uno switch accende e spegne soltanto; luminosità e colore compaiono nel popup solo se l'entità li dichiara.", "Read from Home Assistant. A light behind a switch only turns on and off; brightness and colour appear in the popup only when the entity declares them.")}</small></div>
      <label class="ed-slot"><span class="ed-slot-lbl">${t("Stanza", "Room")}</span><select class="ed-input" name="room">${roomOptions(assignments[oldId])}</select></label>
      <output data-error></output>
      <footer><button type="button" class="ed-btn-add" data-cancel>${t("Annulla", "Cancel")}</button><button type="submit" class="ed-save-btn">💾 ${t("Salva modifiche", "Save changes")}</button></footer>
    </form>
  </section>`;
  doc.body.append(modal);
  const form = modal.querySelector("[data-form]");
  const entityInput = form.elements.entity;
  const close = () => modal.remove();
  modal.querySelectorAll("[data-close],[data-cancel]").forEach((button) => button.addEventListener("click", close));
  modal.querySelector("[data-pick]").addEventListener("click", () => root.wzPickEntity?.(entityInput));
  /* The badges describe the entity in the field, not the one the modal opened
   * with: pointing a light at another entity changes what it can do, and the
   * controls the popup will offer change with it. */
  const capabilities = modal.querySelector("[data-capabilities]");
  const describe = () => {
    if (capabilities) capabilities.innerHTML = lightMeta(clean(entityInput.value)).badges;
  };
  entityInput.addEventListener("input", describe);
  entityInput.addEventListener("change", describe);
  modal
    .querySelector("[data-controls]")
    .addEventListener("click", () => root.dmOpenLightControl?.(clean(entityInput.value)));
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const entity = clean(form.elements.entity.value);
    const name = clean(form.elements.name.value);
    const roomId = clean(form.elements.room.value);
    const error = form.querySelector("[data-error]");
    if (!isLightEntity(entity) || !name) {
      error.textContent = t(
        `Inserisci un nome e un'entità valida (${LIGHT_DOMAINS.map((domain) => `${domain}.*`).join(", ")}).`,
        `Enter a name and a valid entity (${LIGHT_DOMAINS.map((domain) => `${domain}.*`).join(", ")}).`,
      );
      return;
    }
    const existing = readJson("cd_luci", {});
    if (entity !== oldId && existing[entity]) {
      error.textContent = t("Questa entità è già configurata.", "This entity is already configured.");
      return;
    }
    saveAllLightMaps({ oldId, entity, name, roomId });
    close();
    rerenderLights();
  });
}

root.dmLightMove = (id, direction) => {
  const groups = configuredLightGroups();
  const group = groups.find((item) => item.entities.includes(id));
  if (!group) return;
  const index = group.entities.indexOf(id);
  const next = index + Number(direction);
  if (next < 0 || next >= group.entities.length) return;
  [group.entities[index], group.entities[next]] = [group.entities[next], group.entities[index]];
  persistLightOrder(groups);
  rerenderLights();
};

root.dmLightRoomMove = (room, direction) => {
  const groups = configuredLightGroups();
  const index = groups.findIndex((item) => item.room === room);
  const next = index + Number(direction);
  if (index < 0 || next < 0 || next >= groups.length) return;
  [groups[index], groups[next]] = [groups[next], groups[index]];
  persistLightOrder(groups);
  rerenderLights();
};

root.dmLightSetRoom = (id, roomId) => {
  const assignments = readJson("cd_luci_rooms", {});
  if (clean(roomId)) assignments[id] = clean(roomId);
  else delete assignments[id];
  const assignmentChanged = writeJsonIfChanged("cd_luci_rooms", assignments, { sync: false });
  const groups = configuredLightGroups();
  const orderChanged = persistLightOrder(groups, { sync: false });
  if (assignmentChanged || orderChanged) {
    root.cdMarkDirty?.();
    root.cdSyncPush?.();
  }
  rerenderLights();
};
root.dmOpenLightEditor = openLightEditor;

function orderedLightIds() {
  return configuredLightGroups().flatMap((group) => group.entities);
}

export function openOrderedLightPicker(groupName, onDone, preselected = []) {
  doc?.getElementById("dm-light-picker-0152")?.remove();
  const names = readJson("cd_luci", {});
  const ordered = orderedLightIds();
  let selected = [...new Set(preselected.filter((id) => ordered.includes(id)))];
  const modal = doc.createElement("div");
  modal.id = "dm-light-picker-0152";
  modal.className = "dm-section-modal";
  modal.innerHTML = `<section class="dm-section-dialog dm-light-picker-dialog" role="dialog" aria-modal="true">
    <header><strong>💡 ${esc(groupName)}</strong><button type="button" data-close aria-label="${t("Chiudi", "Close")}">✕</button></header>
    <input class="ed-input" data-search placeholder="${t("Cerca luce", "Search light")}">
    <div class="ed-list dm-light-picker-list" data-list></div>
    <footer><button type="button" class="ed-btn-add" data-cancel>${t("Annulla", "Cancel")}</button><button type="button" class="ed-save-btn" data-save>💾 ${t("Salva selezione", "Save selection")}</button></footer>
  </section>`;
  doc.body.append(modal);
  const list = modal.querySelector("[data-list]");
  const render = () => {
    const query = clean(modal.querySelector("[data-search]").value).toLowerCase();
    const visible = ordered.filter((id) => `${names[id] || ""} ${id}`.toLowerCase().includes(query));
    list.innerHTML = visible
      .map((id) => {
        const checked = selected.includes(id);
        const index = selected.indexOf(id);
        return `<article class="ed-row dm-light-picker-row" data-pick-light="${esc(id)}"><input type="checkbox" ${checked ? "checked" : ""}><div class="ed-row-main"><div class="ed-row-new">${esc(names[id] || id)}</div><div class="ed-row-old mono">${esc(id)}</div></div><button type="button" class="ed-del" data-up ${!checked || index <= 0 ? "disabled" : ""}>▲</button><button type="button" class="ed-del" data-down ${!checked || index >= selected.length - 1 ? "disabled" : ""}>▼</button></article>`;
      })
      .join("");
    list.querySelectorAll("[data-pick-light]").forEach((row) => {
      const id = row.dataset.pickLight;
      row.querySelector("input").addEventListener("change", (event) => {
        selected = event.target.checked
          ? [...selected.filter((item) => item !== id), id]
          : selected.filter((item) => item !== id);
        render();
      });
      row.querySelector("[data-up]").addEventListener("click", () => {
        const index = selected.indexOf(id);
        if (index > 0) [selected[index - 1], selected[index]] = [selected[index], selected[index - 1]];
        render();
      });
      row.querySelector("[data-down]").addEventListener("click", () => {
        const index = selected.indexOf(id);
        if (index >= 0 && index < selected.length - 1)
          [selected[index + 1], selected[index]] = [selected[index], selected[index + 1]];
        render();
      });
    });
  };
  const close = () => modal.remove();
  modal.querySelector("[data-search]").addEventListener("input", render);
  modal.querySelectorAll("[data-close],[data-cancel]").forEach((button) => button.addEventListener("click", close));
  modal.querySelector("[data-save]").addEventListener("click", () => {
    onDone?.(selected);
    close();
  });
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });
  render();
}

export function synchronizeLightAlerts() {
  if (state.syncing) return false;
  state.syncing = true;
  try {
    const lights = Object.keys(readJson("cd_luci", {})).filter((id) => id.includes("."));
    const removed = readJson("cd_gruppi_removed", {});
    const extras = readJson("cd_gruppi_extra", {});
    const next = [...new Set([...(extras.luci || []), ...lights])].filter(
      (id) => !(removed.luci || []).includes(id),
    );
    if (JSON.stringify(extras.luci || []) === JSON.stringify(next)) return false;
    extras.luci = next;
    return writeJsonIfChanged("cd_gruppi_extra", extras);
  } finally {
    state.syncing = false;
  }
}

function normalizeAlertEditorDom() {
  const body = doc?.getElementById("ed-body");
  if (!body || doc.querySelector(".ed-tab.active")?.dataset?.tab !== "avvisi") return false;
  body.querySelectorAll(".ed-row").forEach((row) => {
    const label = clean(row.querySelector(".ed-row-new")?.textContent);
    const entity = clean(row.querySelector(".ed-row-old")?.textContent);
    if (!label && !entity) row.remove();
  });
  return true;
}

function installStyles() {
  installStyle(
    "dm-lights-alerts-section-style",
    `
      /* Modal shell/headers/forms/footers are owned only by editor-contracts-section.js. */
      .dm-section-dialog [data-error]{min-height:18px;color:var(--error-color,#dc2626);font-weight:800}
      .dm-light-picker-dialog{grid-template-rows:auto auto minmax(0,1fr) auto!important}
      .dm-light-picker-dialog>[data-search]{box-sizing:border-box!important;width:auto!important;margin:14px 16px 8px!important}
      .dm-light-picker-list{min-height:0!important;overflow:auto!important;padding:8px 16px 16px!important}
      .dm-light-picker-row{display:grid!important;grid-template-columns:auto minmax(0,1fr) 38px 38px!important;align-items:center!important;gap:10px!important;box-sizing:border-box!important;width:100%!important;min-width:0!important;margin:0 0 8px!important}
      .dm-light-picker-row input{width:18px!important;height:18px!important;margin:0!important}
      .dm-light-picker-row .ed-row-main{min-width:0!important}.dm-light-picker-row .ed-row-new,.dm-light-picker-row .ed-row-old{overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
      .dm-light-row{display:grid!important;grid-template-columns:auto minmax(140px,1fr) minmax(150px,260px) 42px 42px!important;align-items:center!important;gap:10px!important;min-width:0!important}
      .dm-light-order{display:grid!important;gap:3px!important}.dm-light-room-order{display:inline-flex!important;gap:4px!important}
      .dm-light-row .dm-light-room{width:100%!important;min-width:0!important}
      .dm-light-badges{display:flex!important;flex-wrap:wrap!important;gap:5px!important;margin-top:5px!important}
      .dm-light-badge{padding:2px 7px!important;border-radius:999px!important;border:1px solid color-mix(in srgb,var(--dm-light-badge,#0ea5e9) 30%,transparent)!important;background:color-mix(in srgb,var(--dm-light-badge,#0ea5e9) 13%,transparent)!important;color:color-mix(in srgb,var(--dm-light-badge,#0ea5e9) 62%,var(--text,#0f172a))!important;font-size:8.5px!important;font-weight:900!important;letter-spacing:.7px!important}
      .dm-light-badge[data-kind="rgb"]{--dm-light-badge:#a855f7}
      .dm-light-badge[data-kind="white"]{--dm-light-badge:#f59e0b}
      .dm-light-badge[data-kind="dim"]{--dm-light-badge:#0ea5e9}
      .dm-light-badge[data-kind="onoff"]{--dm-light-badge:#64748b}
      .dm-light-badge[data-kind="domain"]{--dm-light-badge:#475569}
      .dm-light-badge[data-kind="off"]{--dm-light-badge:#ef4444}
      /* Not an .ed-slot-lbl: the legacy stylesheet appends a pencil to that
         class, and this row is read from Home Assistant, not edited here. */
      .dm-light-caps-lbl{font-size:12px!important;font-weight:800!important;color:var(--secondary-text-color,#64748b)!important}
      .dm-light-caps{display:flex!important;align-items:center!important;flex-wrap:wrap!important;gap:8px!important}
      .dm-light-caps .dm-light-badges{margin-top:0!important}
      .dm-light-caps-try{margin-left:auto!important;min-height:36px!important;padding:8px 14px!important;border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:12px!important;background:var(--secondary-background-color,#f8fafc)!important;color:inherit!important;font-size:11.5px!important;font-weight:900!important;cursor:pointer!important}
      .dm-light-add-hint,.dm-light-caps-note{display:block!important;color:var(--secondary-text-color,#64748b)!important;font-size:11px!important;font-weight:600!important;line-height:1.45!important}
      @media(max-width:720px){
        .dm-light-row{grid-template-columns:auto minmax(0,1fr) 42px 42px!important}.dm-light-row .dm-light-room{grid-column:1/-1!important;grid-row:2!important}
        .dm-light-picker-row{grid-template-columns:auto minmax(0,1fr) 36px 36px!important;padding:10px!important}
      }
    `,
  );
}

function installOwners() {
  if (typeof root.editorRenderLuci === "function") root.editorRenderLuci = renderCanonicalLightsEditor;
  root.cdPickLights = openOrderedLightPicker;
  root.cdLuceRen = openLightEditor;
  const alerts = root.editorRenderAvvisi;
  if (typeof alerts === "function" && !alerts.__dmLightsAlertsSection) {
    function canonicalAlerts(...args) {
      synchronizeLightAlerts();
      const result = alerts.apply(this, args);
      root.queueMicrotask?.(normalizeAlertEditorDom);
      return result;
    }
    canonicalAlerts.__dmLightsAlertsSection = true;
    canonicalAlerts.__dmPrevious = alerts;
    root.editorRenderAvvisi = canonicalAlerts;
  }
  wrapFunction("editorSwitch", "__dmLightsAlertsEditor", () => {
    installOwners();
    normalizeAlertEditorDom();
  });
}

export function installLightsAlertsSection() {
  if (!doc) return;
  installStyles();
  installOwners();
  synchronizeLightAlerts();
  if (!state.listeners) {
    state.listeners = true;
    root.addEventListener?.("dashboardmodern:legacy-ready", () => {
      installOwners();
      synchronizeLightAlerts();
    });
    doc.addEventListener(
      "click",
      (event) => {
        if (event.target?.closest?.(".ed-tab[data-tab='luci'],.ed-tab[data-tab='avvisi']"))
          root.queueMicrotask?.(() => {
            installOwners();
            synchronizeLightAlerts();
            normalizeAlertEditorDom();
          });
      },
      true,
    );
  }
  state.installed = true;
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installLightsAlertsSection, { once: true });
else installLightsAlertsSection();
