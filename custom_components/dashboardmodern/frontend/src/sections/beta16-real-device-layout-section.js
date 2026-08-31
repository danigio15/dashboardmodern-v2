// DM-FIX-20260812C
import {
  clean,
  dashboardStore,
  doc,
  english,
  installStyle,
  readClimateUnits,
  readJson,
  root,
  t,
  wrapFunction,
  writeJsonIfChanged,
} from "./shared.js";

globalThis.__DM_20260815C__ = true;
const KEY = "__DASHBOARDMODERN_BETA16_REAL_DEVICE_LAYOUT__";
const state = (root[KEY] ||= {
  installed: false,
  frame: 0,
  listeners: false,
  storeUnsubscribe: null,
  climateMigration: "",
});

export function matchCanonicalRoom(rooms, reference, fallbackName = "") {
  const values = Array.isArray(rooms) ? rooms : [];
  const ref = clean(reference);
  const name = clean(fallbackName).toLowerCase();
  return (
    values.find((room) => ref && clean(room?.id) === ref) ||
    values.find((room) => ref && clean(room?.name).toLowerCase() === ref.toLowerCase()) ||
    values.find((room) => name && clean(room?.name).toLowerCase() === name) ||
    null
  );
}

function canonicalRooms() {
  try {
    const values = dashboardStore()?.getSection?.("rooms");
    if (Array.isArray(values) && values.length) return values;
  } catch (_error) {}
  const legacy = readJson("cd_stanze", []);
  return Array.isArray(legacy) ? legacy : [];
}

function configuredActions() {
  const persisted = readJson("cd_quick_actions", []);
  if (Array.isArray(persisted) && persisted.length) return persisted;
  try {
    const values = root.getQuickActions?.();
    return Array.isArray(values) ? values : [];
  } catch (_error) {
    return [];
  }
}

function roomLabel(reference, fallbackName = "") {
  const room = matchCanonicalRoom(canonicalRooms(), reference, fallbackName);
  return clean(room?.name || fallbackName || reference);
}

function climateRoomMigration() {
  const rooms = canonicalRooms();
  const units = readClimateUnits();
  if (!rooms.length || !units.length) return false;

  let changed = false;
  const next = units.map((unit) => {
    const room = matchCanonicalRoom(rooms, unit?.room || unit?.room_id, unit?.name);
    if (!room) return unit;
    const id = clean(room.id || room.name);
    if (!id || clean(unit?.room) === id) return unit;
    changed = true;
    return { ...unit, room: id };
  });
  if (!changed) return false;

  const signature = JSON.stringify(next.map((item) => [item.entity, item.room]));
  if (signature === state.climateMigration) return false;
  state.climateMigration = signature;
  writeJsonIfChanged("cd_clima_units", next, { sync: false });
  root.cdMarkDirty?.();
  root.cdSyncPush?.();
  root.queueMicrotask?.(() => root.buildClimaCards?.());
  return true;
}

function ensureRowMain(row, anchor = null) {
  if (!row) return null;
  let main = row.querySelector(":scope > .ed-row-main");
  if (!main) {
    main = doc.createElement("div");
    main.className = "ed-row-main";
    if (anchor?.parentElement === row) anchor.after(main);
    else row.prepend(main);
  }
  let primary = main.querySelector(".ed-row-new");
  if (!primary) {
    primary = doc.createElement("div");
    primary.className = "ed-row-new";
    main.prepend(primary);
  }
  let secondary = main.querySelector(".ed-row-old");
  if (!secondary) {
    secondary = doc.createElement("div");
    secondary.className = "ed-row-old";
    main.append(secondary);
  }
  main.dataset.dmBeta16Readable = "true";
  return { main, primary, secondary };
}

function repairQuickActionRows() {
  const actions = configuredActions();
  const edits = [...(doc?.querySelectorAll?.('#editor-modal #ed-body [data-dm-edit-kind="action"][data-dm-edit-index]') || [])];
  edits.forEach((edit) => {
    const index = Number.parseInt(edit.dataset.dmEditIndex || "-1", 10);
    const action = index >= 0 ? actions[index] : null;
    const row = edit.closest(".ed-row");
    if (!action || !row) return;
    const anchor = row.querySelector(":scope > .dm-beta7-existing-action-icon,:scope > .dm-room-list-icon");
    const nodes = ensureRowMain(row, anchor);
    if (!nodes) return;
    const type = clean(action.builtin || action.type).replace(/^builtin_/, "");
    /* Un popup nativo senza nome scritto dice COSA apre, non «Azione rapida»:
     * quattro righe uguali non si distinguevano in niente. */
    const titoli = {
      luci: t("Luci", "Lights"),
      clima: t("Clima", "Climate"),
      antifurto: t("Antifurto", "Alarm"),
      lavatrice: t("Lavatrice", "Washing machine"),
    };
    const name = clean(action.name) || titoli[type] || (t("Azione rapida", "Quick action"));
    nodes.primary.textContent = name;
    nodes.primary.title = name;
    nodes.secondary.textContent = clean(action.entity) || type;
    row.dataset.dmBeta16ActionName = "true";
  });
  return edits.length > 0;
}

function repairClimateEditorRows() {
  const units = readClimateUnits();
  const edits = [...(doc?.querySelectorAll?.('#editor-modal #ed-body [data-dm-edit-kind="climate"][data-dm-edit-index]') || [])];
  edits.forEach((edit) => {
    const index = Number.parseInt(edit.dataset.dmEditIndex || "-1", 10);
    const unit = index >= 0 ? units[index] : null;
    const row = edit.closest(".ed-row");
    if (!unit || !row) return;
    const anchor = row.querySelector(":scope > .dm-room-list-icon,:scope > .dm-beta7-existing-action-icon");
    const nodes = ensureRowMain(row, anchor);
    if (!nodes) return;
    const name = clean(unit.name) || clean(unit.entity) || (t("Clima", "Climate"));
    const room = roomLabel(unit.room || unit.room_id, unit.name);
    nodes.primary.textContent = name;
    nodes.primary.title = name;
    nodes.secondary.textContent = [clean(unit.entity), room ? `🏠 ${room}` : ""].filter(Boolean).join(" · ");
    nodes.secondary.title = nodes.secondary.textContent;
    row.dataset.dmBeta16ClimateName = "true";
  });
  return edits.length > 0;
}

function repairTemperatureEditorRows() {
  const rooms = canonicalRooms();
  const rows = [...(doc?.querySelectorAll?.("#editor-modal #ed-body [data-temperature-room][data-room-id]") || [])];
  rows.forEach((row) => {
    const room = matchCanonicalRoom(rooms, row.dataset.roomId);
    if (!room) return;
    const anchor = row.querySelector(":scope > .dm-temperature-card-icon");
    const nodes = ensureRowMain(row, anchor);
    if (!nodes) return;
    const name = clean(room.name) || clean(room.id) || (t("Stanza", "Room"));
    const sensors = [clean(room.temp), clean(room.hum)].filter(Boolean).join(" · ");
    nodes.primary.textContent = name;
    nodes.primary.title = name;
    nodes.secondary.textContent = sensors;
    nodes.secondary.title = sensors;
    row.dataset.dmBeta16TemperatureName = "true";
  });
  return rows.length > 0;
}

function replaceRoomOptions(select, { temperature = false } = {}) {
  if (!select) return false;
  const rooms = canonicalRooms();
  if (!rooms.length) return false;
  const current = clean(select.value);
  const form = select.closest("[data-temperature-form]");
  const editing = Boolean(form?.dataset?.dmOriginalRoom) || /^(modifica|edit)\b/i.test(clean(form?.querySelector?.("[data-temperature-form-title]")?.textContent));
  const placeholder = doc.createElement("option");
  placeholder.value = "";
  placeholder.textContent = `— ${t("Seleziona stanza", "Select room")} —`;
  const options = [placeholder];
  rooms.forEach((room) => {
    const option = doc.createElement("option");
    option.value = clean(room.id || room.name);
    /* Solo il nome: l'emoji davanti veniva dal catalogo di sistema — «il
     * catalogo non nostro» — e in un option nativo il disegno di casa non si
     * puo' mettere. Meglio nessuna icona che quella sbagliata. */
    option.textContent = clean(room.name) || option.value;
    if (temperature && !editing && (clean(room.temp) || clean(room.hum)) && option.value !== current) option.disabled = true;
    options.push(option);
  });
  select.replaceChildren(...options);
  if ([...select.options].some((option) => option.value === current)) select.value = current;
  select.dataset.dmBeta16CanonicalRooms = "true";
  return true;
}

function repairRoomSelects() {
  replaceRoomOptions(doc?.getElementById?.("ed-cl-room"));
  doc?.querySelectorAll?.('#dm-climate-editor-modal select[name="room"],#dm-shutter-editor-modal select[name="room"]')?.forEach((select) => replaceRoomOptions(select));
  replaceRoomOptions(doc?.getElementById?.("dm-temperature-room"), { temperature: true });
}

function repairClimateRoomHeadings() {
  const rooms = canonicalRooms();
  let repaired = false;
  for (const [gridId, glyph] of [
    ["clima-grid-freddo", "❄️"],
    ["clima-grid-caldo", "🔥"],
  ]) {
    const grid = doc?.getElementById?.(gridId);
    if (!grid) continue;
    let currentRoom = null;
    [...grid.children].forEach((node) => {
      if (node.classList.contains("cp-card")) {
        const icon = node.querySelector(".cp-icon");
        if (icon) icon.textContent = glyph;
        let badge = node.querySelector(":scope > .dm-beta16-climate-room");
        if (currentRoom) {
          if (!badge) {
            badge = doc.createElement("div");
            badge.className = "dm-beta16-climate-room";
            const header = node.querySelector(":scope > .cp-header");
            if (header) header.after(badge);
            else node.prepend(badge);
          }
          badge.textContent = `🏠 ${clean(currentRoom.name)}`;
          badge.title = clean(currentRoom.name);
          node.dataset.dmBeta16RoomId = clean(currentRoom.id || currentRoom.name);
        } else {
          badge?.remove();
          delete node.dataset.dmBeta16RoomId;
        }
        repaired = true;
        return;
      }

      const text = clean(node.textContent);
      if (!text.includes("🏠")) return;
      const roomReference = clean(text.split("🏠").pop());
      const room = matchCanonicalRoom(rooms, roomReference);
      const noRoom = /^(nessuna stanza|no room)$/i.test(roomReference);
      currentRoom = room || null;
      node.classList.add("clima-section-title", "dm-beta16-climate-group-heading");
      if (room) {
        const prefix = text.includes("🏢") ? `${clean(text.split("🏠")[0])} ` : "";
        const name = clean(room.name) || roomReference;
        node.textContent = `${prefix}🏠 ${name}`.trim();
        node.dataset.dmBeta16RoomLabel = clean(room.id || name);
        node.title = name;
      } else if (noRoom) {
        node.dataset.dmBeta16RoomLabel = "";
      }
      repaired = true;
    });
  }
  return repaired;
}

/* The temperature room tabs and their filter live in the Beta 27 stability
 * owner (beta26-real-device-stability-section.js), which also renders the cards
 * and therefore can restore the active room after every rebuild. This layer
 * only keeps the tab styling below; a second filter here used to fight that
 * owner, resetting the active pill and dropping the filter on every re-render.
 */

function run() {
  state.frame = 0;
  climateRoomMigration();
  repairQuickActionRows();
  repairClimateEditorRows();
  repairTemperatureEditorRows();
  repairRoomSelects();
  repairClimateRoomHeadings();
}

function schedule() {
  if (state.frame) return;
  state.frame = root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 0) || 0;
}

function installOwners() {
  for (const name of [
    "buildQuickActions",
    "editorSwitch",
    "edAddQA",
    "edAddClima",
    "buildTempCards",
    "renderTemperature",
    "buildClimaCards",
    "setClimaPageMode",
  ]) wrapFunction(name, `__dmBeta16_${name}`, schedule);
}

function subscribeStore() {
  if (state.storeUnsubscribe) return;
  const store = dashboardStore();
  if (typeof store?.subscribe !== "function") return;
  state.storeUnsubscribe = store.subscribe((change) => {
    if (["rooms", "snapshot"].includes(change?.section)) schedule();
  });
}

function installStyles() {
  installStyle("dm-beta16-real-device-layout-style", `
    #editor-modal #ed-body [data-dm-beta16-readable="true"]{display:block!important;min-width:0!important;overflow:hidden!important}
    #editor-modal #ed-body [data-dm-beta16-readable="true"]>.ed-row-new{display:block!important;color:var(--text,#0f172a)!important;font-weight:900!important;line-height:1.25!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    #editor-modal #ed-body [data-dm-beta16-readable="true"]>.ed-row-old{display:block!important;margin-top:3px!important;color:var(--secondary-text-color,var(--text-dim,#64748b))!important;line-height:1.25!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}

    #page-clima .dm-beta16-climate-room{display:none}

    #page-temp .dm-temperature-room-tabs{display:flex!important;align-items:center!important;gap:8px!important;width:100%!important;max-width:100%!important;margin:10px 0 4px!important;padding:4px 18px 6px!important;overflow-x:auto!important;scrollbar-width:none!important}
    #page-temp .dm-temperature-room-tabs::-webkit-scrollbar{display:none!important}
    #page-temp .dm-temperature-room-tabs>button{flex:0 0 auto!important;display:flex!important;align-items:center!important;gap:7px!important;min-height:42px!important;padding:8px 13px!important;border:1px solid var(--card-border,#e2e8f0)!important;border-radius:15px!important;background:var(--card-bg,#fff)!important;color:var(--text-dim,#64748b)!important;font:800 12px/1 Inter,system-ui,sans-serif!important;box-shadow:0 4px 12px rgba(15,23,42,.05)!important}
    #page-temp .dm-temperature-room-tabs>button>span{font-family:Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif!important;font-size:18px!important;line-height:1!important}
    #page-temp .dm-temperature-room-tabs>button.active{border-color:rgba(14,165,233,.28)!important;background:linear-gradient(135deg,#e0f7ff,#c9efff)!important;color:#036995!important;box-shadow:0 7px 18px rgba(14,165,233,.12)!important}


    @media(max-width:760px){
      #page-clima .clima-page-mode-switch[data-dm-beta12-climate="true"]{width:calc(100% - 12px)!important;margin:8px auto 14px!important;padding:4px!important;gap:3px!important;border-radius:20px!important}
      #page-clima .clima-page-mode-switch[data-dm-beta12-climate="true"] .clima-page-mode-btn{min-height:52px!important;padding:7px 6px!important;gap:6px!important;border-radius:16px!important;font-size:13px!important;letter-spacing:.8px!important}
      #page-clima .clima-page-mode-switch[data-dm-beta12-climate="true"] .clima-page-mode-btn .icon{font-size:21px!important}
      #page-clima .dm-beta16-climate-group-heading{display:none!important}
      #page-clima .dm-beta16-climate-room{display:flex!important;align-items:center!important;min-width:0!important;margin:-2px 0 0!important;padding:3px 6px!important;border-radius:9px!important;background:rgba(14,165,233,.08)!important;color:var(--text-dim,#64748b)!important;font-size:8px!important;font-weight:850!important;line-height:1.15!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}

      #page-temp .dm-temperature-room-tabs{padding-left:8px!important;padding-right:8px!important;margin-top:6px!important}
      #page-temp .dm-temperature-room-tabs>button{min-height:38px!important;padding:7px 10px!important;font-size:11px!important;border-radius:13px!important}

    }

    @media(max-width:360px){
      #page-clima .dm-beta16-climate-room{font-size:7.5px!important;padding:3px 5px!important}
    }
  `);
}

export function installBeta16RealDeviceLayout() {
  installOwners();
  subscribeStore();
  if (state.installed || !doc) return;
  state.installed = true;
  installStyles();
  for (const eventName of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:states-ready",
  ]) root.addEventListener?.(eventName, () => {
    installOwners();
    subscribeStore();
    schedule();
  });
  doc.addEventListener("click", (event) => {
    if (event.target?.closest?.("#editor-modal,#page-clima,#page-temp")) schedule();
  }, true);
  doc.addEventListener("change", (event) => {
    if (event.target?.closest?.("#editor-modal")) schedule();
  }, true);
  schedule();
}

if (doc?.readyState === "loading") doc.addEventListener("DOMContentLoaded", installBeta16RealDeviceLayout, { once: true });
else installBeta16RealDeviceLayout();
