// Beta 25 real-device fixes: multi-sensor temperatures and appliance artwork ownership.
import { applianceArtwork, canonicalArtworkType } from "../core/appliance-artwork.js";
import { directEmoji, roomGlyph } from "../core/personalization-catalog.js";
import {
  allStates,
  applyTemperatureReading,
  clean,
  comfortBadgeText,
  dashboardStore,
  doc,
  english,
  esc,
  root,
  section,
  t,
  temperatureCardLabels,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_BETA25_REAL_DEVICE_FIXES__";
const state = (root[KEY] ||= {
  installed: false,
  listeners: false,
  storeUnsubscribe: null,
  repairingAppliances: false,
});
const PRIMARY_ID = "primary";

function glyph(icon) {
  return directEmoji(icon) || roomGlyph(icon);
}

function roomList() {
  const value = section("rooms", []);
  return Array.isArray(value) ? value : [];
}

function applianceList() {
  const value = section("appliances", []);
  return Array.isArray(value) ? value : [];
}

function normalizeExtraEntry(entry = {}, index = 0) {
  return {
    id: clean(entry.id) || `temperature-extra-${index + 1}`,
    name: clean(entry.name || entry.label),
    temp: clean(entry.temp || entry.temperature_entity || entry.entity),
    hum: clean(entry.hum || entry.humidity_entity),
  };
}

/** Return every temperature association for one canonical room. */
export function temperatureEntries(room = {}) {
  const entries = [];
  const primaryTemp = clean(room.temp);
  const primaryHum = clean(room.hum);
  if (primaryTemp || primaryHum) {
    entries.push({
      id: PRIMARY_ID,
      name: clean(room.temp_name),
      temp: primaryTemp,
      hum: primaryHum,
    });
  }
  const extras = Array.isArray(room?.metadata?.temperature_entries)
    ? room.metadata.temperature_entries
    : [];
  extras
    .map(normalizeExtraEntry)
    .filter((entry) => entry.temp || entry.hum)
    .forEach((entry) => entries.push(entry));
  return entries;
}

/**
 * Keep the first association projected to legacy room.temp/hum so old cards and
 * exports remain compatible; additional associations live in room metadata.
 */
export function projectTemperatureEntries(room = {}, entries = []) {
  const normalized = (Array.isArray(entries) ? entries : [])
    .map(normalizeExtraEntry)
    .filter((entry) => entry.temp || entry.hum);
  const primary = normalized[0] || null;
  const metadata = { ...(room.metadata || {}) };
  const extras = normalized.slice(1).map((entry, index) => ({
    id: clean(entry.id) && entry.id !== PRIMARY_ID ? clean(entry.id) : `temperature-extra-${index + 1}`,
    name: clean(entry.name),
    temp: clean(entry.temp),
    hum: clean(entry.hum),
  }));
  if (extras.length) metadata.temperature_entries = extras;
  else delete metadata.temperature_entries;

  return {
    ...room,
    temp: clean(primary?.temp),
    hum: clean(primary?.hum),
    temp_name: clean(primary?.name),
    metadata,
  };
}

export function upsertTemperatureEntry(room = {}, entry = {}, editingId = "") {
  const entries = temperatureEntries(room).map((item) => ({ ...item }));
  const next = normalizeExtraEntry(entry, entries.length);
  const target = clean(editingId);
  if (target) {
    const index = entries.findIndex((item) => item.id === target);
    if (index >= 0) entries[index] = { ...next, id: target };
    else entries.push(next);
  } else {
    if (!clean(next.id) || next.id === PRIMARY_ID)
      next.id = `temperature-${Date.now().toString(36)}`;
    entries.push(next);
  }
  return projectTemperatureEntries(room, entries);
}

export function removeTemperatureEntry(room = {}, entryId = "") {
  const target = clean(entryId);
  const entries = temperatureEntries(room).filter((entry) => entry.id !== target);
  return projectTemperatureEntries(room, entries);
}

function temperatureRecords() {
  return roomList().flatMap((room) =>
    temperatureEntries(room)
      .filter((entry) => clean(entry.temp) || clean(entry.hum))
      .map((entry) => ({ room, entry })),
  );
}

function humidityEntity(entry) {
  const temp = clean(entry?.temp);
  return clean(entry?.hum || temp.replace("_temperature", "_humidity"));
}

function numericState(entity) {
  const value = Number.parseFloat(allStates()[clean(entity)]?.state);
  return Number.isFinite(value) ? value : null;
}

function comfortLabel(value) {
  if (value == null) return t("Non disponibile", "Unavailable");
  if (value < 18) return t("Freddo", "Cold");
  if (value > 26) return t("Caldo", "Hot");
  return "Comfort";
}

function cardName(room, entry) {
  const roomName = clean(room?.name) || (t("Stanza", "Room"));
  const label = clean(entry?.name);
  return label ? `${roomName} · ${label}` : roomName;
}

function makeText(className, value) {
  const node = doc.createElement("span");
  node.className = className;
  node.textContent = value;
  return node;
}

function createTemperatureCard(record) {
  const { room, entry } = record;
  const card = doc.createElement("article");
  card.className = "temp-card cp-card dm-temperature-card";
  card.dataset.roomId = clean(room.id);
  card.dataset.temperatureId = clean(entry.id);
  card.dataset.dmTemperatureCanonical = "true";
  card.style.setProperty("--cp-rgb", "148, 163, 184");
  card.addEventListener("click", (event) =>
    root.apriStorico?.(event, clean(entry.temp), cardName(room, entry)),
  );

  const header = doc.createElement("div");
  header.className = "cp-header temp-card-header";
  const title = doc.createElement("div");
  title.className = "cp-title-wrap";
  const icon = doc.createElement("div");
  icon.className = "cp-icon temp-room-icon";
  icon.dataset.roomIcon = clean(room.icon || "mdi:home");
  icon.append(makeText("dm-temperature-icon-fallback", glyph(room.icon)));
  const name = doc.createElement("div");
  name.className = "cp-name temp-room-name";
  name.textContent = cardName(room, entry);
  title.append(icon, name);
  const badge = doc.createElement("div");
  badge.className = "cp-badge temp-comfort-badge";
  header.append(title, badge);

  const body = doc.createElement("div");
  body.className = "cp-body temp-card-body";
  const current = doc.createElement("div");
  current.className = "cp-temp-current-wrap";
  const labels = temperatureCardLabels(room, entry);
  current.append(
    makeText("cp-temp-current-lbl", labels.temperature),
    makeText("cp-temp-current temp-value", "—"),
  );
  const humidity = doc.createElement("div");
  humidity.className = "cp-temp-target";
  humidity.append(
    makeText("lbl", `💧 ${labels.humidity}`),
    makeText("val temp-hum-val", "—%"),
  );
  humidity.addEventListener("click", (event) => {
    event.stopPropagation();
    const entity = humidityEntity(entry);
    if (entity) root.apriStorico?.(event, entity, `${cardName(room, entry)} · ${t("Umidità", "Humidity")}`);
  });
  body.append(current, humidity);
  card.append(header, body);
  return card;
}

function updateTemperatureCard(card, record) {
  const { room, entry } = record;
  const temperature = numericState(entry.temp);
  const humidity = numericState(humidityEntity(entry));
  const value = card.querySelector(".temp-value");
  const hum = card.querySelector(".temp-hum-val");
  const comfort = card.querySelector(".temp-comfort-badge");
  const name = card.querySelector(".temp-room-name");
  if (value) value.textContent = temperature == null ? "—" : temperature.toFixed(1);
  if (hum) hum.textContent = humidity == null ? "—%" : `${humidity.toFixed(0)}%`;
  applyTemperatureReading(card, temperature, humidity);
  if (comfort) {
    const label = comfortLabel(temperature);
    comfort.textContent = comfortBadgeText(label);
    comfort.title = label;
    comfort.setAttribute("aria-label", label);
    comfort.dataset.comfort = label.toLowerCase().replaceAll(" ", "-");
  }
  if (name) name.textContent = cardName(room, entry);
}

export function renderBeta25TemperatureCards() {
  const grid = doc?.getElementById?.("temp-grid");
  if (!grid) return false;
  const records = temperatureRecords();
  if (!records.length) {
    const empty = doc.createElement("div");
    empty.className = "dm-temperature-empty";
    empty.textContent = t("Nessun sensore temperatura configurato.", "No temperature sensor configured yet.");
    grid.replaceChildren(empty);
    return false;
  }
  const cards = records.map((record) => {
    const card = createTemperatureCard(record);
    updateTemperatureCard(card, record);
    return card;
  });
  grid.replaceChildren(...cards);
  /* Both markers in the same render turn, as the stable Beta 26 owner already
   * does. Stamping only "beta25-multi" and leaving the rename to the
   * compatibility pass opened a window in which the grid claimed a renderer
   * nobody owns: the pass is wired to a different trigger, so whichever ran
   * last won, and on a slow boot that was this render. */
  grid.dataset.beta25TemperatureRenderer = "multi";
  grid.dataset.dmTemperatureRenderer = "canonical";
  return true;
}

/* Riempie un campo entita' e lo fa sapere a chi lo disegna. */
function scriviCampoEntita(input, valore) {
  if (!input) return false;
  input.value = valore;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function entityField(id, label, value = "", optional = true) {
  return `<label class="ed-slot"><span class="ed-slot-lbl">${esc(label)}${optional ? ` <span class="ed-acc-n">${t("Facoltativo", "Optional")}</span>` : ""}</span><span class="ed-form-row"><input id="${id}" class="ed-input ed-slot-in mono" value="${esc(value)}" placeholder="sensor.entity"><button type="button" class="dm-entity-picker" data-beta25-pick="${id}" aria-label="${t("Seleziona entità", "Select entity")}">🔍</button></span></label>`;
}

function temperatureRowsMarkup() {
  return temperatureRecords()
    .map(({ room, entry }) => {
      const sensors = [clean(entry.temp), humidityEntity(entry)].filter(Boolean).join(" · ");
      const detail = [clean(entry.name), sensors].filter(Boolean).join(" · ");
      return `<article class="ed-row dm-temperature-card" data-beta25-temperature-row data-room-id="${esc(room.id)}" data-temperature-id="${esc(entry.id)}"><div class="dm-temperature-card-icon">${root.cdIconMarkup?.(room.icon || "🌡️", 28) || esc(glyph(room.icon))}</div><div class="ed-row-main"><div class="ed-row-new">${esc(clean(room.name) || (t("Stanza", "Room")))}</div><div class="ed-row-old">${esc(detail)}</div></div><button type="button" class="ed-del" data-beta25-temperature-edit>✏️</button><button type="button" class="ed-del" data-beta25-temperature-delete>🗑️</button></article>`;
    })
    .join("");
}

function roomOptions() {
  return roomList()
    .map((room) => `<option value="${esc(room.id)}">${esc(clean(room.name) || clean(room.id))}</option>`)
    .join("");
}

function renderBeta25TemperatureEditor() {
  const active = doc?.querySelector?.(".ed-tab.active")?.dataset?.tab;
  if (active && active !== "sez7" && active !== "temperature" && active !== "temp") return false;
  const target = doc?.getElementById?.("ed-body");
  if (!target || !roomList().length) return false;
  const rows = temperatureRowsMarkup();
  target.innerHTML = `<div class="ed-intro" data-beta25-temperature-editor>${t("La stessa stanza può essere selezionata più volte. Ogni associazione può avere un nome e sensori temperatura/umidità propri.", "The same room can be selected multiple times. Each association can have its own name, temperature entity and humidity entity.")}</div><div class="ed-list" data-beta25-temperature-list>${rows || `<div class="ed-empty">${t("Nessuna temperatura configurata.", "No temperature configured.")}</div>`}</div><form class="ed-form dm-temperature-form" data-beta25-temperature-form><div class="ed-sec-title" data-beta25-temperature-title>＋ ${t("Aggiungi temperatura", "Add temperature")}</div><label class="ed-slot"><span class="ed-slot-lbl">${t("Stanza", "Room")}</span><select id="dm-temperature-room" class="ed-input" required><option value="">— ${t("Seleziona stanza", "Select room")} —</option>${roomOptions()}</select></label><label class="ed-slot"><span class="ed-slot-lbl">${t("Nome temperatura", "Temperature name")} <span class="ed-acc-n">${t("Facoltativo", "Optional")}</span></span><input id="dm-temperature-name" class="ed-input" placeholder="${t("Nome visualizzato facoltativo", "Optional display name")}"></label>${entityField("ed-pl-temp", t("Entità temperatura", "Temperature entity"), "", false)}${entityField("dm-humidity-new", t("Entità umidità", "Humidity entity"))}<div class="dm-temperature-actions"><button type="submit" class="ed-btn-add" data-beta25-temperature-submit>${t("Aggiungi", "Add")}</button><button type="button" class="ed-btn-secondary" data-beta25-temperature-cancel hidden>${t("Annulla", "Cancel")}</button></div></form>`;

  const form = target.querySelector("[data-beta25-temperature-form]");
  const select = form.querySelector("#dm-temperature-room");
  const nameInput = form.querySelector("#dm-temperature-name");
  let editingRoomId = "";
  let editingEntryId = "";
  let temperatureNameDraft = clean(nameInput?.value);

  nameInput?.addEventListener("input", () => {
    temperatureNameDraft = nameInput.value;
  });

  const reset = () => {
    editingRoomId = "";
    editingEntryId = "";
    temperatureNameDraft = "";
    delete form.dataset.beta25EditingId;
    form.reset();
    select.disabled = false;
    target.querySelector("[data-beta25-temperature-title]").textContent = `＋ ${t("Aggiungi temperatura", "Add temperature")}`;
    target.querySelector("[data-beta25-temperature-submit]").textContent = t("Aggiungi", "Add");
    target.querySelector("[data-beta25-temperature-cancel]").hidden = true;
  };

  target.querySelectorAll("[data-beta25-pick]").forEach((button) =>
    button.addEventListener("click", () => root.wzPickEntity?.(target.querySelector(`#${button.dataset.beta25Pick}`))),
  );

  target.querySelectorAll("[data-beta25-temperature-edit]").forEach((button) =>
    button.addEventListener("click", () => {
      const row = button.closest("[data-beta25-temperature-row]");
      const room = roomList().find((item) => clean(item.id) === clean(row.dataset.roomId));
      const entry = temperatureEntries(room).find((item) => item.id === row.dataset.temperatureId);
      if (!room || !entry) return;
      editingRoomId = clean(room.id);
      editingEntryId = clean(entry.id);
      form.dataset.beta25EditingId = editingEntryId;
      select.value = editingRoomId;
      select.disabled = true;
      nameInput.value = clean(entry.name);
      temperatureNameDraft = nameInput.value;
      /* Il valore si scrive, e si dice a chi lo disegna che e' cambiato.
       *
       * Il campo dell'entita' non e' piu' una casella nuda: davanti gli sta la
       * pastiglia che dice quale entita' e' scelta, e la casella vera resta
       * dietro la matita. Scrivendo `input.value` e basta, la pastiglia non
       * riceveva niente e continuava a dire «scegli un'entita'» sopra un campo
       * che invece era pieno — e quel campo, essendo nascosto, non si vedeva
       * neanche. In una temperatura aperta con la matita spariva tutto quello
       * che c'era gia', e infatti non si riusciva piu' a modificarla.
       *
       * Chi scrive avvisa: e' lo stesso evento che la pastiglia ascolta gia'
       * dal suo tasto «Elimina». */
      scriviCampoEntita(form.querySelector("#ed-pl-temp"), clean(entry.temp));
      scriviCampoEntita(form.querySelector("#dm-humidity-new"), clean(entry.hum));
      target.querySelector("[data-beta25-temperature-title]").textContent = `${t("Modifica", "Edit")} ${clean(room.name)}`;
      target.querySelector("[data-beta25-temperature-submit]").textContent = t("Salva modifiche", "Save changes");
      target.querySelector("[data-beta25-temperature-cancel]").hidden = false;
    }),
  );

  target.querySelectorAll("[data-beta25-temperature-delete]").forEach((button) =>
    button.addEventListener("click", async () => {
      const row = button.closest("[data-beta25-temperature-row]");
      const store = dashboardStore();
      const room = store?.getSection?.("rooms")?.find((item) => clean(item.id) === clean(row.dataset.roomId));
      if (!room) return;
      await store.updateItem("rooms", room.id, removeTemperatureEntry(room, row.dataset.temperatureId));
      root.queueMicrotask?.(renderBeta25TemperatureEditor);
    }),
  );

  target.querySelector("[data-beta25-temperature-cancel]")?.addEventListener("click", reset);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    const roomId = editingRoomId || clean(select.value);
    const temp = clean(form.querySelector("#ed-pl-temp")?.value);
    if (!roomId || !temp.includes(".")) {
      root.alert?.(t("Seleziona una stanza e un'entità temperatura valida.", "Select a room and a valid temperature entity."));
      return;
    }
    const store = dashboardStore();
    const room = store?.getSection?.("rooms")?.find((item) => clean(item.id) === roomId);
    if (!room) return;
    const next = upsertTemperatureEntry(
      room,
      {
        id: editingEntryId || `temperature-${Date.now().toString(36)}`,
        name: clean(temperatureNameDraft),
        temp,
        hum: clean(form.querySelector("#dm-humidity-new")?.value),
      },
      editingEntryId,
    );
    await store.updateItem("rooms", roomId, next);
    reset();
    renderBeta25TemperatureCards();
    root.queueMicrotask?.(renderBeta25TemperatureEditor);
  });
  target.dataset.renderer = "temperature-beta25";
  return true;
}

export function preferredApplianceVisual(device = {}) {
  const selected = clean(device.visual_key || device.device_type || device.type || device.icon || device.name);
  const kind = canonicalArtworkType(selected);
  if (clean(device.visual_type).toLowerCase() === "asset" && kind)
    return { kind: "asset", value: selected, artwork: kind };
  const image = clean(device.image || device.image_url);
  if (image) return { kind: "image", value: image, artwork: "" };
  return kind ? { kind: "asset", value: selected, artwork: kind } : null;
}

export async function repairStoredApplianceVisuals() {
  if (state.repairingAppliances) return false;
  const store = dashboardStore();
  if (!store?.getSection || !store?.updateItem) return false;
  const repairs = store
    .getSection("appliances")
    .filter((device) => {
      const visual = preferredApplianceVisual(device);
      return visual?.kind === "asset" && (clean(device.image) || clean(device.image_url));
    });
  if (!repairs.length) return false;
  state.repairingAppliances = true;
  try {
    for (const device of repairs)
      await store.updateItem("appliances", device.id, { image: "", image_url: "" });
    return true;
  } finally {
    state.repairingAppliances = false;
  }
}

export function repairApplianceCards() {
  const configured = applianceList();
  if (!configured.length) return false;
  const byId = new Map(configured.map((device) => [clean(device.id), device]));
  let repaired = false;
  doc
    ?.querySelectorAll?.("#page-appliances-main .appl-wide-card[data-appliance-id],#appl-grid-overview .appl-wide-card[data-appliance-id]")
    .forEach((card, index) => {
      const device = byId.get(clean(card.dataset.applianceId)) || configured[index];
      const visual = preferredApplianceVisual(device);
      if (visual?.kind !== "asset" || !visual.artwork) return;
      const media = card.querySelector(".appl-visual .appl-ic");
      if (!media) return;
      const current = media.querySelector(":scope>.dm-appliance-art");
      if (!current || current.dataset.dmArt !== visual.artwork) media.innerHTML = applianceArtwork(visual.artwork, 96);
      card.dataset.dmArtwork = visual.artwork;
      card.dataset.dmMediaKind = "asset";
      repaired = true;
    });
  return repaired;
}

function installTemperatureOwners() {
  for (const name of ["buildTempCards", "renderTemperature"]) {
    const current = root[name];
    if (current?.__dmBeta25TemperatureOwner) continue;
    const owner = function beta25TemperatureOwner() {
      return renderBeta25TemperatureCards();
    };
    owner.__dmBeta25TemperatureOwner = true;
    owner.__dmPrevious = current;
    root[name] = owner;
  }
}

function subscribeStore() {
  if (state.storeUnsubscribe || !dashboardStore()?.subscribe) return;
  state.storeUnsubscribe = dashboardStore().subscribe((change) => {
    if (change?.section === "rooms" || change?.section === "snapshot") {
      installTemperatureOwners();
      renderBeta25TemperatureCards();
      const active = doc?.querySelector?.(".ed-tab.active")?.dataset?.tab;
      if (active === "sez7" || active === "temperature" || active === "temp")
        root.queueMicrotask?.(renderBeta25TemperatureEditor);
    }
    if (change?.section === "appliances") {
      root.queueMicrotask?.(() => {
        repairStoredApplianceVisuals();
        repairApplianceCards();
      });
    }
  });
}

function scheduleTemperatureEditor() {
  root.queueMicrotask?.(() => {
    installTemperatureOwners();
    renderBeta25TemperatureCards();
    renderBeta25TemperatureEditor();
  });
}

export function installBeta25RealDeviceFixes() {
  if (!doc) return false;
  installTemperatureOwners();
  subscribeStore();
  repairStoredApplianceVisuals();
  repairApplianceCards();
  renderBeta25TemperatureCards();
  if (!state.listeners) {
    state.listeners = true;
    for (const name of [
      "dashboardmodern:legacy-ready",
      "dashboardmodern:runtime-ready",
      "dashboardmodern:persistence-restored",
    ])
      root.addEventListener?.(name, () => {
        installTemperatureOwners();
        subscribeStore();
        renderBeta25TemperatureCards();
        repairStoredApplianceVisuals();
        repairApplianceCards();
      });
    root.addEventListener?.("dashboardmodern:temperature-editor-rendered", scheduleTemperatureEditor);
    root.addEventListener?.("dashboardmodern:state-changed", (event) => {
      const changed = new Set(
        (event?.detail?.entity_ids || [event?.detail?.entity_id]).map?.(clean) || [],
      );
      if (
        changed.size &&
        temperatureRecords().some(({ entry }) =>
          changed.has(clean(entry.temp)) || changed.has(humidityEntity(entry)),
        )
      )
        renderBeta25TemperatureCards();
    });
    doc.addEventListener(
      "click",
      (event) => {
        if (event.target?.closest?.(".ed-tab[data-tab='sez7'],[data-tab='temperature'],[data-tab='temp']"))
          root.setTimeout?.(scheduleTemperatureEditor, 0);
        if (event.target?.closest?.("#page-appliances-main,.appl-section-tab"))
          root.queueMicrotask?.(repairApplianceCards);
      },
      true,
    );
  }
  state.installed = true;
  return true;
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installBeta25RealDeviceFixes, { once: true });
else installBeta25RealDeviceFixes();

export const beta25RealDeviceFixes = Object.freeze({
  temperatureEntries,
  projectTemperatureEntries,
  upsertTemperatureEntry,
  removeTemperatureEntry,
  preferredApplianceVisual,
  repairStoredApplianceVisuals,
  repairApplianceCards,
});
