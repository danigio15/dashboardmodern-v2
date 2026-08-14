// DM-FIX-20260814B
// Temperature presentation/label companion. The canonical renderer remains in
// temperature-section.js; this module only hardens the real-device editor DOM
// and stores optional user-facing names for the two associated entities.
import {
  clean,
  dashboardStore,
  doc,
  english,
  installStyle,
  root,
  wrapFunction,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_TEMPERATURE_LAYOUT_SECTION__";
const state = (root[KEY] ||= {
  installed: false,
  frame: 0,
  storeUnsubscribe: null,
  pendingLabels: new Map(),
  pendingClear: new Set(),
});

function rooms() {
  try {
    const values = dashboardStore()?.getSection?.("rooms");
    return Array.isArray(values) ? values : [];
  } catch (_error) {
    return [];
  }
}

function roomById(id) {
  const token = clean(id);
  return rooms().find((room) => clean(room?.id) === token) || null;
}

function defaultTemperatureName() {
  return english() ? "Temperature" : "Temperatura";
}

function defaultHumidityName() {
  return english() ? "Humidity" : "Umidità";
}

function temperatureName(room) {
  return clean(room?.temp_name || room?.temperature_name) || defaultTemperatureName();
}

function humidityName(room) {
  return clean(room?.hum_name || room?.humidity_name) || defaultHumidityName();
}

function ensureRowText(row, room) {
  if (!row || !room) return false;
  const icon = row.querySelector(":scope > .dm-temperature-card-icon");
  let main = row.querySelector(":scope > .ed-row-main");
  if (!main) {
    main = doc.createElement("div");
    main.className = "ed-row-main";
    if (icon?.parentElement === row) icon.after(main);
    else row.prepend(main);
  }
  let primary = main.querySelector(":scope > .ed-row-new");
  if (!primary) {
    primary = doc.createElement("div");
    primary.className = "ed-row-new";
    main.prepend(primary);
  }
  let secondary = main.querySelector(":scope > .ed-row-old");
  if (!secondary) {
    secondary = doc.createElement("div");
    secondary.className = "ed-row-old";
    main.append(secondary);
  }

  const name = clean(room.name) || clean(room.id) || (english() ? "Room" : "Stanza");
  const details = [];
  if (clean(room.temp)) details.push(`${temperatureName(room)}: ${clean(room.temp)}`);
  if (clean(room.hum)) details.push(`${humidityName(room)}: ${clean(room.hum)}`);
  primary.textContent = name;
  primary.title = name;
  secondary.textContent = details.join(" · ");
  secondary.title = secondary.textContent;
  main.dataset.dmTemperatureReadable = "true";
  row.dataset.dmTemperatureRoomName = name;
  row.dataset.dmTemperatureNameVisible = "true";
  return true;
}

function repairConfiguredRows() {
  let changed = false;
  doc
    ?.querySelectorAll?.("#editor-modal #ed-body [data-temperature-room][data-room-id]")
    .forEach((row) => {
      const room = roomById(row.dataset.roomId);
      if (room) changed = ensureRowText(row, room) || changed;
    });
  return changed;
}

function makeNameField(id, label) {
  const field = doc.createElement("label");
  field.className = "ed-slot dm-temperature-name-field";
  field.dataset.temperatureNameField = id;
  const title = doc.createElement("span");
  title.className = "ed-slot-lbl";
  title.textContent = label;
  const input = doc.createElement("input");
  input.id = id;
  input.className = "ed-input ed-slot-in";
  input.type = "text";
  input.autocomplete = "off";
  input.placeholder = english() ? "Optional display name" : "Nome visualizzato facoltativo";
  field.append(title, input);
  return field;
}

function ensureNameFields(form) {
  if (!form) return false;
  let tempInput = form.querySelector("#dm-temperature-name");
  if (!tempInput) {
    const field = makeNameField(
      "dm-temperature-name",
      english() ? "Temperature name" : "Nome temperatura",
    );
    const anchor = form.querySelector("#ed-pl-temp")?.closest("[data-entity-field],label.ed-slot");
    if (anchor) anchor.before(field);
    else form.append(field);
    tempInput = field.querySelector("input");
  }

  let humInput = form.querySelector("#dm-humidity-name");
  if (!humInput) {
    const field = makeNameField(
      "dm-humidity-name",
      english() ? "Humidity name" : "Nome umidità",
    );
    const anchor = form.querySelector("#dm-humidity-new")?.closest("[data-entity-field],label.ed-slot");
    if (anchor) anchor.before(field);
    else form.append(field);
    humInput = field.querySelector("input");
  }

  const select = form.querySelector("#dm-temperature-room");
  const roomId = clean(select?.value);
  const editing =
    form.dataset.dmTemperatureMode === "edit" ||
    /^(modifica|edit)\b/i.test(
      clean(form.querySelector("[data-temperature-form-title]")?.textContent),
    );
  const context = `${editing ? "edit" : "add"}|${roomId}`;
  if (form.dataset.dmTemperatureLabelContext !== context) {
    const room = roomById(roomId);
    tempInput.value = room ? clean(room.temp_name || room.temperature_name) : "";
    humInput.value = room ? clean(room.hum_name || room.humidity_name) : "";
    form.dataset.dmTemperatureLabelContext = context;
  }
  return true;
}

function repairEditorForm() {
  const form = doc?.querySelector?.("#editor-modal [data-temperature-form]");
  if (!form) return false;
  return ensureNameFields(form);
}

function repairDashboardCards() {
  let changed = false;
  doc?.querySelectorAll?.("#temp-grid .temp-card[data-room-id]").forEach((card) => {
    const room = roomById(card.dataset.roomId);
    if (!room) return;
    const tempLabel = card.querySelector(".cp-temp-current-lbl");
    const humLabel = card.querySelector(".cp-temp-target .lbl");
    if (tempLabel) {
      tempLabel.textContent = temperatureName(room);
      tempLabel.title = temperatureName(room);
    }
    if (humLabel) {
      humLabel.textContent = `💧 ${humidityName(room)}`;
      humLabel.title = humidityName(room);
    }
    card.dataset.dmTemperatureEntityLabels = "true";
    changed = true;
  });
  return changed;
}

async function applyPendingLabels() {
  const store = dashboardStore();
  if (!store?.updateItem) return;
  for (const [id, labels] of [...state.pendingLabels.entries()]) {
    const room = roomById(id);
    if (!room || (!clean(room.temp) && !clean(room.hum))) continue;
    state.pendingLabels.delete(id);
    const patch = {
      temp_name: clean(labels.temp_name),
      hum_name: clean(labels.hum_name),
    };
    if (
      clean(room.temp_name) === patch.temp_name &&
      clean(room.hum_name) === patch.hum_name
    ) {
      continue;
    }
    try {
      await store.updateItem("rooms", id, patch);
    } catch (error) {
      root.console?.error?.("[DashboardModern] temperature entity labels", error);
    }
  }
}

async function applyPendingClear() {
  const store = dashboardStore();
  if (!store?.updateItem) return;
  for (const id of [...state.pendingClear]) {
    const room = roomById(id);
    if (!room || clean(room.temp) || clean(room.hum)) continue;
    state.pendingClear.delete(id);
    if (!clean(room.temp_name) && !clean(room.hum_name)) continue;
    try {
      await store.updateItem("rooms", id, { temp_name: "", hum_name: "" });
    } catch (error) {
      root.console?.error?.("[DashboardModern] clear temperature entity labels", error);
    }
  }
}

function captureSubmit(event) {
  const form = event.target?.closest?.("[data-temperature-form]");
  if (!form) return;
  const id = clean(form.querySelector("#dm-temperature-room")?.value);
  if (!id) return;
  state.pendingLabels.set(id, {
    temp_name: clean(form.querySelector("#dm-temperature-name")?.value),
    hum_name: clean(form.querySelector("#dm-humidity-name")?.value),
  });
  root.queueMicrotask?.(() => {
    applyPendingLabels();
    schedule();
  });
}

function captureDelete(event) {
  const button = event.target?.closest?.("[data-temperature-delete]");
  if (!button) return;
  const id = clean(button.closest("[data-room-id]")?.dataset?.roomId);
  if (!id) return;
  state.pendingClear.add(id);
  root.setTimeout?.(() => {
    applyPendingClear();
    schedule();
  }, 0);
}

function run() {
  state.frame = 0;
  repairConfiguredRows();
  repairEditorForm();
  repairDashboardCards();
  applyPendingLabels();
  applyPendingClear();
}

function schedule() {
  if (state.frame) return;
  state.frame = root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 0) || 0;
}

function installOwners() {
  for (const name of ["editorSwitch", "buildTempCards", "renderTemperature", "render"]) {
    wrapFunction(name, `__dmTemperatureLabels_${name}`, schedule);
  }
}

function subscribeStore() {
  if (state.storeUnsubscribe) return;
  const store = dashboardStore();
  if (typeof store?.subscribe !== "function") return;
  state.storeUnsubscribe = store.subscribe((change) => {
    if (["rooms", "snapshot"].includes(change?.section)) {
      applyPendingLabels();
      applyPendingClear();
      schedule();
    }
  });
}

function installStyles() {
  installStyle(
    "dm-temperature-labels-style",
    `
      #editor-modal #ed-body [data-temperature-room][data-room-id]>.ed-row-main{
        display:block!important;visibility:visible!important;opacity:1!important;
        position:static!important;width:auto!important;height:auto!important;min-width:0!important;
        overflow:hidden!important;color:var(--primary-text-color,var(--text,#0f172a))!important;
      }
      #editor-modal #ed-body [data-temperature-room][data-room-id]>.ed-row-main>.ed-row-new{
        display:block!important;visibility:visible!important;opacity:1!important;
        margin:0!important;color:var(--primary-text-color,var(--text,#0f172a))!important;
        font-size:14px!important;font-weight:900!important;line-height:1.25!important;
        white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;
      }
      #editor-modal #ed-body [data-temperature-room][data-room-id]>.ed-row-main>.ed-row-old{
        display:block!important;visibility:visible!important;opacity:1!important;
        margin-top:3px!important;color:var(--secondary-text-color,var(--text-dim,#64748b))!important;
        font-size:10.5px!important;line-height:1.3!important;white-space:nowrap!important;
        overflow:hidden!important;text-overflow:ellipsis!important;
      }
      #editor-modal .dm-temperature-name-field{display:grid!important;gap:6px!important;min-width:0!important}
      #editor-modal .dm-temperature-name-field>.ed-input{box-sizing:border-box!important;width:100%!important}
      @media(max-width:760px){
        #editor-modal #ed-body [data-temperature-room][data-room-id]>.ed-row-main>.ed-row-new{font-size:13px!important}
        #editor-modal #ed-body [data-temperature-room][data-room-id]>.ed-row-main>.ed-row-old{font-size:9.5px!important}
      }
    `,
  );
}

export function installTemperatureLayoutSection() {
  installOwners();
  subscribeStore();
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  doc.addEventListener("submit", captureSubmit, true);
  doc.addEventListener("click", captureDelete, true);
  doc.addEventListener("click", (event) => {
    if (event.target?.closest?.("#editor-modal [data-temperature-edit],#page-temp")) schedule();
  }, true);
  doc.addEventListener("change", (event) => {
    if (event.target?.closest?.("#editor-modal [data-temperature-form]")) schedule();
  }, true);
  for (const eventName of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:states-ready",
  ]) {
    root.addEventListener?.(eventName, () => {
      installOwners();
      subscribeStore();
      schedule();
    });
  }
  schedule();
  return true;
}
