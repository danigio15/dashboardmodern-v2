// DM-FIX-20260814D
// Targeted Temperature editor companion. The canonical card/row renderer stays
// in temperature-section.js; this module only owns optional display-name fields
// and their persistence lifecycle.
import {
  clean,
  dashboardStore,
  doc,
  english,
  installStyle,
  root,
  wrapFunction,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_TEMPERATURE_LABEL_EDITOR__";
const state = (root[KEY] ||= {
  installed: false,
  frame: 0,
  storeUnsubscribe: null,
  pendingLabels: new Map(),
  flushing: false,
  clearing: false,
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

function createNameField(id, label) {
  const field = doc.createElement("label");
  field.className = "ed-slot dm-temperature-name-field";
  field.dataset.temperatureNameField = id;
  const title = doc.createElement("span");
  title.className = "ed-slot-lbl";
  title.textContent = label;
  const input = doc.createElement("input");
  input.id = id;
  input.type = "text";
  input.autocomplete = "off";
  input.className = "ed-input ed-slot-in";
  input.placeholder = english() ? "Optional display name" : "Nome visualizzato facoltativo";
  field.append(title, input);
  return field;
}

function formMode(form) {
  if (clean(form?.dataset?.dmOriginalRoom)) return "edit";
  if (form?.dataset?.dmTemperatureMode) return form.dataset.dmTemperatureMode;
  const title = clean(form?.querySelector("[data-temperature-form-title]")?.textContent);
  return /^(modifica|edit)\b/i.test(title) ? "edit" : "add";
}

export function ensureTemperatureNameFields(
  form = doc?.querySelector?.("#editor-modal [data-temperature-form]"),
) {
  if (!form) return false;
  let temp = form.querySelector("#dm-temperature-name");
  if (!temp) {
    const field = createNameField(
      "dm-temperature-name",
      english() ? "Temperature display name" : "Nome visualizzato temperatura",
    );
    const anchor = form.querySelector("#ed-pl-temp")?.closest("[data-entity-field],label.ed-slot");
    if (anchor) anchor.before(field);
    else form.append(field);
    temp = field.querySelector("input");
  }
  let hum = form.querySelector("#dm-humidity-name");
  if (!hum) {
    const field = createNameField(
      "dm-humidity-name",
      english() ? "Humidity display name" : "Nome visualizzato umidità",
    );
    const anchor = form
      .querySelector("#dm-humidity-new")
      ?.closest("[data-entity-field],label.ed-slot");
    if (anchor) anchor.before(field);
    else form.append(field);
    hum = field.querySelector("input");
  }

  const roomId = clean(form.querySelector("#dm-temperature-room")?.value);
  const context = `${formMode(form)}|${roomId}`;
  if (form.dataset.dmTemperatureLabelContext !== context) {
    const room = roomById(roomId);
    temp.value = room ? clean(room.temp_name || room.temperature_name) : "";
    hum.value = room ? clean(room.hum_name || room.humidity_name) : "";
    form.dataset.dmTemperatureLabelContext = context;
  }
  form.dataset.dmTemperatureDisplayNames = "true";
  return true;
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
  root.queueMicrotask?.(flushPendingLabels);
  root.setTimeout?.(flushPendingLabels, 0);
}

async function flushPendingLabels() {
  if (state.flushing || !state.pendingLabels.size) return;
  const store = dashboardStore();
  if (!store?.updateItem) return;
  state.flushing = true;
  try {
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
      await store.updateItem("rooms", id, patch);
    }
  } catch (error) {
    root.console?.error?.("[DashboardModern] Temperature display names", error);
  } finally {
    state.flushing = false;
  }
}

async function clearOrphanLabels() {
  if (state.clearing) return;
  const store = dashboardStore();
  if (!store?.updateItem) return;
  const orphan = rooms().find(
    (room) =>
      !clean(room.temp) &&
      !clean(room.hum) &&
      (clean(room.temp_name) || clean(room.hum_name)),
  );
  if (!orphan) return;
  state.clearing = true;
  try {
    await store.updateItem("rooms", orphan.id, { temp_name: "", hum_name: "" });
  } catch (error) {
    root.console?.error?.("[DashboardModern] clear Temperature display names", error);
  } finally {
    state.clearing = false;
  }
}

function run() {
  state.frame = 0;
  ensureTemperatureNameFields();
  flushPendingLabels();
  clearOrphanLabels();
}

function schedule() {
  if (state.frame) return;
  const execute = () => {
    run();
    root.requestAnimationFrame?.(() => ensureTemperatureNameFields());
  };
  state.frame = root.requestAnimationFrame?.(execute) || root.setTimeout?.(execute, 0) || 0;
}

function installOwners() {
  wrapFunction("editorSwitch", "__dmTemperatureDisplayNamesEditor", schedule);
}

function subscribeStore() {
  if (state.storeUnsubscribe) return;
  const store = dashboardStore();
  if (typeof store?.subscribe !== "function") return;
  state.storeUnsubscribe = store.subscribe((change) => {
    if (change?.section !== "rooms" && change?.section !== "snapshot") return;
    flushPendingLabels();
    clearOrphanLabels();
    schedule();
  });
}

function installStyles() {
  installStyle(
    "dm-temperature-display-name-fields",
    `
      #editor-modal [data-temperature-form] .dm-temperature-name-field{
        display:grid!important;gap:6px!important;min-width:0!important
      }
      #editor-modal [data-temperature-form] .dm-temperature-name-field>.ed-input{
        box-sizing:border-box!important;width:100%!important;min-width:0!important
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
  doc.addEventListener(
    "click",
    (event) => {
      if (
        event.target?.closest?.(
          "[data-temperature-edit],.ed-tab[data-tab='sez7'],[data-tab='temp'],[data-tab='temperature']",
        )
      ) {
        root.queueMicrotask?.(schedule);
      }
    },
    true,
  );
  doc.addEventListener(
    "change",
    (event) => {
      if (event.target?.closest?.("[data-temperature-form]")) schedule();
    },
    true,
  );
  for (const eventName of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:persistence-restored",
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
