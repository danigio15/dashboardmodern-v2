// DM-FIX-20260814C
import {
  ROOM_CATALOG,
  ROOM_GLYPHS,
  actionCatalogMatch,
  directEmoji,
  roomGlyph,
} from "../core/personalization-catalog.js";
import { clean, dashboardStore, doc, root, t } from "./shared.js";

root.__DM_20260815C__ = true;
const KEY = "__DASHBOARDMODERN_BETA17_FINAL_ICON_POLISH__";
const state = (root[KEY] ||= {
  installed: false,
  temperaturePage: null,
  temperatureObserver: null,
  temperatureEditorFrame: 0,
  storeUnsubscribe: null,
  pendingLabels: new Map(),
  flushingLabels: false,
  clearingLabels: false,
});

// Kept as public compatibility exports for diagnostics/tests. Picker ownership
// moved to icon-engine-section in Beta18.
export const ROOM_ICON_CHOICES = Object.freeze(
  ROOM_CATALOG.map((item) =>
    Object.freeze([ROOM_GLYPHS[item.id] || roomGlyph(item.mdi), item.keywords, item.mdi]),
  ),
);

export function isTemperatureProgressText(value) {
  const text = clean(value).replaceAll("…", "...").toLowerCase();
  return /^(?:aggiornamento in corso|update in progress|updating)(?:\s*\.*)?$/.test(text);
}

export function actionPickerGlyph(value) {
  const token = clean(value);
  return directEmoji(token) || actionCatalogMatch(token)?.glyph || "⭐";
}

function temperatureRooms() {
  try {
    const values = dashboardStore()?.getSection?.("rooms");
    return Array.isArray(values) ? values : [];
  } catch (_error) {
    return [];
  }
}

function temperatureRoom(id) {
  const token = clean(id);
  return temperatureRooms().find((room) => clean(room?.id) === token) || null;
}

function temperatureLabel(room) {
  return clean(room?.temp_name || room?.temperature_name) || t("Temperatura", "Temperature");
}

function humidityLabel(room) {
  return clean(room?.hum_name || room?.humidity_name) || t("Umidità", "Humidity");
}

function hideTemperatureProgressCopy() {
  const page = doc?.getElementById("page-temp");
  if (!page) return false;
  let hidden = false;
  page.querySelectorAll("div,span,p,small").forEach((node) => {
    if (!isTemperatureProgressText(node.textContent)) {
      if (node.dataset.dmBeta17TemperatureProgressHidden === "true") {
        delete node.dataset.dmBeta17TemperatureProgressHidden;
        node.hidden = false;
        node.removeAttribute("aria-hidden");
        node.style.removeProperty("display");
      }
      return;
    }
    node.dataset.dmBeta17TemperatureProgressHidden = "true";
    node.hidden = true;
    node.setAttribute("aria-hidden", "true");
    node.style.setProperty("display", "none", "important");
    hidden = true;
  });
  return hidden;
}

function bindTemperatureProgressGuard() {
  const page = doc?.getElementById("page-temp");
  if (!page) return false;
  hideTemperatureProgressCopy();
  if (state.temperaturePage === page && state.temperatureObserver) return true;
  state.temperatureObserver?.disconnect?.();
  state.temperaturePage = page;
  if (typeof root.MutationObserver === "function") {
    /* Un giro per fotogramma, non uno per mutazione: la pagina si riscrive a
     * raffiche, e rileggere ogni volta tutti i suoi nodi era uno dei
     * rallentamenti sul telefono (#304). */
    const unGiroPerFotogramma = () => {
      if (state.temperatureFrame) return;
      state.temperatureFrame = root.requestAnimationFrame?.(() => {
        state.temperatureFrame = 0;
        hideTemperatureProgressCopy();
      }) || 0;
      if (!state.temperatureFrame) hideTemperatureProgressCopy();
    };
    state.temperatureObserver = new root.MutationObserver(unGiroPerFotogramma);
    state.temperatureObserver.observe(page, {
      subtree: true,
      childList: true,
      characterData: true,
    });
  }
  return true;
}

function ensureTemperatureRowMain(row, room) {
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

  const name = clean(room.name) || clean(room.id) || t("Stanza", "Room");
  const details = [];
  if (clean(room.temp)) details.push(`${temperatureLabel(room)}: ${clean(room.temp)}`);
  if (clean(room.hum)) details.push(`${humidityLabel(room)}: ${clean(room.hum)}`);
  primary.textContent = name;
  primary.title = name;
  secondary.textContent = details.join(" · ");
  secondary.title = secondary.textContent;
  row.dataset.dmTemperatureNameVisible = "true";
  row.dataset.dmBeta20TemperatureRoomName = name;

  for (const node of [main, primary, secondary]) {
    node.style.setProperty("display", "block", "important");
    node.style.setProperty("visibility", "visible", "important");
    node.style.setProperty("opacity", "1", "important");
    node.style.setProperty("min-width", "0", "important");
  }
  main.style.setProperty("overflow", "hidden", "important");
  primary.style.setProperty("color", "var(--text,#0f172a)", "important");
  primary.style.setProperty("font-size", "14px", "important");
  primary.style.setProperty("font-weight", "900", "important");
  primary.style.setProperty("line-height", "1.25", "important");
  secondary.style.setProperty(
    "color",
    "var(--secondary-text-color,var(--text-dim,#64748b))",
    "important",
  );
  secondary.style.setProperty("font-size", "10px", "important");
  secondary.style.setProperty("line-height", "1.3", "important");
  for (const node of [primary, secondary]) {
    node.style.setProperty("white-space", "nowrap", "important");
    node.style.setProperty("overflow", "hidden", "important");
    node.style.setProperty("text-overflow", "ellipsis", "important");
  }
  return true;
}

function repairTemperatureConfiguredRows() {
  const body = doc?.getElementById("ed-body");
  if (!body) return false;
  let repaired = false;
  body.querySelectorAll("[data-temperature-room][data-room-id]").forEach((row) => {
    if (
      row.matches?.("[data-beta25-temperature-row]") &&
      clean(row.dataset.temperatureId) !== "primary"
    )
      return;
    const room = temperatureRoom(row.dataset.roomId);
    if (room) repaired = ensureTemperatureRowMain(row, room) || repaired;
  });
  return repaired;
}

function makeTemperatureNameField(id, label) {
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
  input.placeholder = t("Nome visualizzato facoltativo", "Optional display name");
  field.append(title, input);
  return field;
}

function temperatureLabelSourceRoom(form) {
  const original = clean(form?.dataset?.dmOriginalRoom);
  const selected = clean(form?.querySelector("#dm-temperature-room")?.value);
  return temperatureRoom(original || selected);
}

function beta25TemperatureAssociationMode(form) {
  if (!form?.matches?.("[data-beta25-temperature-form]")) return "legacy";
  const editingId = clean(form.dataset.beta25EditingId);
  if (editingId) return editingId === "primary" ? "primary" : "extra";
  const room = temperatureLabelSourceRoom(form);
  return room && (clean(room.temp) || clean(room.hum)) ? "extra" : "primary";
}

function ensureTemperatureNameFields(form) {
  if (!form) return false;
  let tempInput = form.querySelector("#dm-temperature-name");
  if (!tempInput) {
    const field = makeTemperatureNameField(
      "dm-temperature-name",
      t("Nome temperatura", "Temperature name"),
    );
    const anchor = form.querySelector("#ed-pl-temp")?.closest("[data-entity-field],label.ed-slot");
    if (anchor) anchor.before(field);
    else form.append(field);
    tempInput = field.querySelector("input");
  }

  let humInput = form.querySelector("#dm-humidity-name");
  if (!humInput) {
    const field = makeTemperatureNameField("dm-humidity-name", t("Nome umidità", "Humidity name"));
    const anchor = form
      .querySelector("#dm-humidity-new")
      ?.closest("[data-entity-field],label.ed-slot");
    if (anchor) anchor.before(field);
    else form.append(field);
    humInput = field.querySelector("input");
  }

  const selected = clean(form.querySelector("#dm-temperature-room")?.value);
  const mode = beta25TemperatureAssociationMode(form);
  if (mode === "extra") {
    form.dataset.dmBeta20TemperatureLabelContext = `beta25-extra|${selected}`;
    return true;
  }

  const original = clean(form.dataset.dmOriginalRoom);
  const editing =
    Boolean(original) ||
    /^(modifica|edit)\b/i.test(
      clean(form.querySelector("[data-temperature-form-title]")?.textContent),
    );
  const context = `${editing ? "edit" : "add"}|${original || selected}`;
  if (form.dataset.dmBeta20TemperatureLabelContext !== context) {
    const room = temperatureLabelSourceRoom(form);
    tempInput.value = room ? clean(room.temp_name || room.temperature_name) : "";
    humInput.value = room ? clean(room.hum_name || room.humidity_name) : "";
    form.dataset.dmBeta20TemperatureLabelContext = context;
  }
  return true;
}

function repairTemperatureEditor() {
  repairTemperatureConfiguredRows();
  const form = doc?.querySelector("#editor-modal [data-temperature-form]");
  if (!form) return false;
  return ensureTemperatureNameFields(form);
}

/* The dashboard labels are written by the layer that renders the cards, from
 * temperatureCardLabels() in shared.js. This pass used to rewrite them every
 * frame with the room's name — on every card of the room, extra probes
 * included — so the label flipped on each repaint. Editor repairs stay here. */

function runTemperatureRepair() {
  repairTemperatureEditor();
}

function scheduleTemperatureRepair() {
  if (state.temperatureEditorFrame) return;
  const run = () => {
    state.temperatureEditorFrame = 0;
    runTemperatureRepair();
    root.requestAnimationFrame?.(runTemperatureRepair);
  };
  state.temperatureEditorFrame =
    root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 0) || 0;
}

function captureTemperatureLabels(event) {
  const form = event.target?.closest?.("[data-temperature-form]");
  if (!form || beta25TemperatureAssociationMode(form) === "extra") return;
  const id = clean(form.querySelector("#dm-temperature-room")?.value);
  const temp = clean(form.querySelector("#ed-pl-temp")?.value);
  if (!id || !temp.includes(".")) return;
  state.pendingLabels.set(id, {
    temp_name: clean(form.querySelector("#dm-temperature-name")?.value),
    hum_name: clean(form.querySelector("#dm-humidity-name")?.value),
  });
}

async function flushPendingTemperatureLabels() {
  if (state.flushingLabels || !state.pendingLabels.size) return;
  const store = dashboardStore();
  if (!store?.updateItem) return;
  state.flushingLabels = true;
  try {
    for (const [id, labels] of [...state.pendingLabels.entries()]) {
      const room = temperatureRoom(id);
      if (!room || (!clean(room.temp) && !clean(room.hum))) continue;
      const patch = {
        temp_name: clean(labels.temp_name),
        hum_name: clean(labels.hum_name),
      };
      state.pendingLabels.delete(id);
      if (clean(room.temp_name) === patch.temp_name && clean(room.hum_name) === patch.hum_name) {
        continue;
      }
      await store.updateItem("rooms", id, patch);
    }
  } catch (error) {
    root.console?.error?.("[DashboardModern] temperature entity labels", error);
  } finally {
    state.flushingLabels = false;
  }
}

async function clearOrphanTemperatureLabels() {
  if (state.clearingLabels) return;
  const store = dashboardStore();
  if (!store?.updateItem) return;
  const orphan = temperatureRooms().find(
    (room) =>
      !clean(room.temp) && !clean(room.hum) && (clean(room.temp_name) || clean(room.hum_name)),
  );
  if (!orphan) return;
  state.clearingLabels = true;
  try {
    await store.updateItem("rooms", orphan.id, { temp_name: "", hum_name: "" });
  } catch (error) {
    root.console?.error?.("[DashboardModern] clear temperature entity labels", error);
  } finally {
    state.clearingLabels = false;
  }
}

function subscribeTemperatureLabels() {
  if (state.storeUnsubscribe) return;
  const store = dashboardStore();
  if (typeof store?.subscribe !== "function") return;
  state.storeUnsubscribe = store.subscribe((change) => {
    if (change?.section !== "rooms" && change?.section !== "snapshot") return;
    flushPendingTemperatureLabels();
    clearOrphanTemperatureLabels();
    scheduleTemperatureRepair();
  });
}

function bindCanonicalPreview(modal, kind, engine) {
  const selector = kind === "action" ? "[data-action-icon-preview]" : "[data-room-icon-preview]";
  const preview = modal.querySelector(selector);
  const input = modal.querySelector('input[name="icon"]');
  if (!preview || !input) return false;

  preview.classList.add("dm-visual-trigger");
  preview.setAttribute("role", "button");
  preview.setAttribute("tabindex", "0");
  preview.removeAttribute("aria-hidden");
  preview.setAttribute(
    "aria-label",
    kind === "action"
      ? t("Scegli icona azione", "Choose action icon")
      : t("Scegli icona stanza", "Choose room icon"),
  );

  if (preview.dataset.dmCanonicalPickerBound !== "true") {
    preview.dataset.dmCanonicalPickerBound = "true";
    const open = () => engine.openPicker?.(input, kind, { autofocus: false });
    preview.addEventListener("click", open);
    preview.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      open();
    });
  }
  return true;
}

// Beta18 owns Room/Action preview DOM through DashboardModernIconEngine. The
// unified editor is created by a document-capture listener that can stop
// propagation. Listen one level earlier (window capture), but defer the claim
// to the next task: by then the modal exists, while the legacy personalization
// repaint scheduled by that same click has not taken ownership of the preview.
function claimCanonicalModalIconOwner() {
  const engine = root.DashboardModernIconEngine;
  if (typeof engine?.syncEditor !== "function") return false;
  let claimed = false;
  for (const [id, kind] of [
    ["dm-action-editor-modal", "action"],
    ["dm-room-editor-modal", "room"],
  ]) {
    const modal = doc?.getElementById(id);
    if (!modal) continue;
    modal.dataset.dmPersonalized = "true";
    modal.dataset.dmSingleGlyphOwner = "true";
    bindCanonicalPreview(modal, kind, engine);
    claimed = true;
  }
  if (claimed) engine.syncEditor();
  return claimed;
}

function scheduleCanonicalModalClaim(event) {
  if (!event.target?.closest?.('[data-dm-edit-kind="action"],[data-dm-edit-kind="room"]')) return;
  root.setTimeout?.(claimCanonicalModalIconOwner, 0);
}

function scheduleTemperatureRepairFromEvent(event) {
  if (
    event.target?.closest?.(
      "#editor-modal,[data-tab='temp'],[data-tab='temperature'],.ed-tab[data-tab='sez7'],#page-temp",
    )
  ) {
    scheduleTemperatureRepair();
  }
}

function install() {
  if (!doc || state.installed) return;
  state.installed = true;
  for (const eventName of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:persistence-restored",
  ]) {
    root.addEventListener?.(eventName, () => {
      bindTemperatureProgressGuard();
      subscribeTemperatureLabels();
      scheduleTemperatureRepair();
    });
  }
  root.addEventListener?.("dashboardmodern:state-changed", () => {
    hideTemperatureProgressCopy();
  });
  root.addEventListener?.("click", scheduleCanonicalModalClaim, true);
  doc.addEventListener("click", scheduleTemperatureRepairFromEvent, true);
  doc.addEventListener("change", scheduleTemperatureRepairFromEvent, true);
  doc.addEventListener("submit", captureTemperatureLabels, true);
  if (doc.readyState === "loading") {
    doc.addEventListener(
      "DOMContentLoaded",
      () => {
        bindTemperatureProgressGuard();
        subscribeTemperatureLabels();
        scheduleTemperatureRepair();
      },
      { once: true },
    );
  } else {
    bindTemperatureProgressGuard();
    subscribeTemperatureLabels();
    scheduleTemperatureRepair();
  }
}

install();
