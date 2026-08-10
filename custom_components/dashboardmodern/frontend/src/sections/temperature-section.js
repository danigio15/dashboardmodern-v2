import {
  allStates,
  clean,
  doc,
  english,
  installStyle,
  root,
  section,
  wrapFunction,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_TEMPERATURE_SECTION__";
const state = (root[KEY] ||= {
  installed: false,
  observer: null,
  listeners: false,
  normalizing: false,
});

const ROOM_GLYPHS = Object.freeze({
  "mdi:sofa": "🛋️",
  "mdi:balcony": "🌿",
  "mdi:bed": "🛏️",
  "mdi:bed-king-outline": "🛏️",
  "mdi:chef-hat": "🍳",
  "mdi:stove": "🍳",
  "mdi:shower": "🚿",
  "mdi:bathtub-outline": "🛁",
  "mdi:desk": "🖥️",
  "mdi:garage": "🚗",
  "mdi:home": "🏠",
  "mdi:home-outline": "🏠",
  "mdi:thermometer": "🌡️",
});

function glyph(icon) {
  const value = clean(icon);
  const key = value.toLowerCase();
  if (ROOM_GLYPHS[key]) return ROOM_GLYPHS[key];
  if (!value || key.startsWith("mdi:")) return "🏠";
  return value;
}

function rooms() {
  const values = section("rooms", []);
  return Array.isArray(values) ? values : [];
}

function eventEntityIds(event) {
  const values = event?.detail?.entity_ids || [event?.detail?.entity_id];
  return new Set((Array.isArray(values) ? values : [values]).map(clean).filter(Boolean));
}

function temperatureEntityIds() {
  const ids = new Set();
  rooms().forEach((room) => {
    const temperature = clean(room.temp);
    const humidity = clean(room.hum || temperature.replace("_temperature", "_humidity"));
    if (temperature) ids.add(temperature);
    if (humidity) ids.add(humidity);
  });
  return ids;
}

export function stateChangeAffectsTemperature(event) {
  const changed = eventEntityIds(event);
  if (!changed.size) return false;
  const configured = temperatureEntityIds();
  return [...changed].some((id) => configured.has(id));
}

function exactState(entity) {
  return allStates()[clean(entity)] || null;
}

function numericState(entity) {
  const value = Number.parseFloat(exactState(entity)?.state);
  return Number.isFinite(value) ? value : null;
}

function roomForCard(card, configuredRooms) {
  const roomId = clean(card.dataset.roomId);
  if (roomId) {
    const byId = configuredRooms.find((room) => clean(room.id) === roomId);
    if (byId) return byId;
  }
  const title = clean(card.querySelector(".cp-name,.temp-room-name")?.textContent).toLowerCase();
  return configuredRooms.find((room) => clean(room.name).toLowerCase() === title) || null;
}

function comfortLabel(temperature) {
  if (temperature == null) return english() ? "Unavailable" : "Non disponibile";
  if (temperature < 18) return english() ? "Cold" : "Freddo";
  if (temperature > 26) return english() ? "Hot" : "Caldo";
  return "Comfort";
}

export function normalizeTemperatureCards() {
  if (!doc || state.normalizing) return false;
  const cards = [...doc.querySelectorAll("#temp-grid .temp-card")];
  if (!cards.length) return false;
  state.normalizing = true;
  try {
    const configuredRooms = rooms();
    cards.forEach((card, index) => {
      const room = roomForCard(card, configuredRooms) || configuredRooms.filter((item) => item.temp)[index];
      if (!room) return;
      card.dataset.roomId = clean(room.id);
      card.dataset.dmTemperatureAligned = "true";

      const icon = card.querySelector(".cp-icon,.temp-room-icon");
      if (icon) {
        icon.dataset.roomIcon = clean(room.icon || "mdi:home");
        let fallback = icon.querySelector(".dm-temperature-icon-fallback");
        if (!fallback) {
          fallback = doc.createElement("span");
          fallback.className = "dm-temperature-icon-fallback";
          fallback.setAttribute("aria-hidden", "true");
          icon.replaceChildren(fallback);
        }
        const iconGlyph = glyph(room.icon);
        if (fallback.textContent !== iconGlyph) fallback.textContent = iconGlyph;
      }

      const temperature = numericState(room.temp);
      const humidityEntity = clean(room.hum || clean(room.temp).replace("_temperature", "_humidity"));
      const humidity = numericState(humidityEntity);
      const temperatureId = clean(room.temp).replace(/[.\-]/g, "_");
      const humidityId = humidityEntity.replace(/[.\-]/g, "_");
      const value = doc.getElementById(`tv_${temperatureId}`) || card.querySelector(".temp-value");
      const humidityValue = doc.getElementById(`hv_${humidityId}`) || card.querySelector(".temp-hum-val");
      const comfort = doc.getElementById(`tc_${temperatureId}`) || card.querySelector(".temp-comfort-badge");
      const temperatureText = temperature == null ? "—" : temperature.toFixed(1);
      const humidityText = humidity == null ? "—%" : `${humidity.toFixed(0)}%`;
      if (value && value.textContent !== temperatureText) value.textContent = temperatureText;
      if (humidityValue && humidityValue.textContent !== humidityText)
        humidityValue.textContent = humidityText;
      if (comfort) {
        const label = comfortLabel(temperature);
        if (comfort.textContent !== label) comfort.textContent = label;
        comfort.title = label;
        comfort.setAttribute("aria-label", label);
        comfort.dataset.comfort = label.toLowerCase().replaceAll(" ", "-");
      }
    });
    return true;
  } finally {
    state.normalizing = false;
  }
}

function temperatureEditMode(form) {
  const title = clean(form?.querySelector("[data-temperature-form-title]")?.textContent).toLowerCase();
  return /^(modifica|edit)\b/.test(title);
}

function syncEditRoomPresentation(form, roomId) {
  const room = rooms().find((item) => clean(item.id) === clean(roomId));
  const floor = form?.querySelector("[data-temperature-floor]");
  const icon = form?.querySelector("#dm-temperature-icon");
  if (floor) floor.textContent = room?.floor ? `🏢 ${room.floor}` : "";
  if (icon) icon.value = clean(room?.icon || "mdi:thermometer");
}

function resetTemperatureReassignment(form) {
  if (!form) return;
  delete form.dataset.dmOriginalRoom;
  const select = form.querySelector("#dm-temperature-room");
  if (select) delete select.dataset.dmTemperatureRoomEditable;
}

function bindTemperatureRoomReassignment(form) {
  const select = form?.querySelector("#dm-temperature-room");
  if (!select) return false;

  if (temperatureEditMode(form)) {
    form.dataset.dmOriginalRoom ||= clean(select.value);
    select.disabled = false;
    select.dataset.dmTemperatureRoomEditable = "true";
  } else if (form.dataset.dmOriginalRoom) {
    resetTemperatureReassignment(form);
  }

  if (select.dataset.dmTemperatureReassignBound !== "true") {
    select.dataset.dmTemperatureReassignBound = "true";
    // The legacy editor switches back to add mode on every select change. In
    // edit mode stop that handler and keep the current sensor values intact.
    select.addEventListener("change", (event) => {
      if (!form.dataset.dmOriginalRoom) return;
      event.stopImmediatePropagation();
      syncEditRoomPresentation(form, select.value);
    }, true);
  }

  if (form.dataset.dmTemperatureReassignSubmit !== "true") {
    form.dataset.dmTemperatureReassignSubmit = "true";
    form.addEventListener("submit", async (event) => {
      const originalId = clean(form.dataset.dmOriginalRoom);
      if (!originalId) return;
      event.preventDefault();
      event.stopImmediatePropagation();

      const targetId = clean(select.value);
      const temp = clean(form.querySelector("#ed-pl-temp")?.value);
      const hum = clean(form.querySelector("#dm-humidity-new")?.value);
      if (!targetId || !temp.includes(".")) {
        root.alert?.(english() ? "Select a room and a valid temperature entity." : "Seleziona una stanza e un'entità temperatura valida.");
        return;
      }

      const store = root.DashboardModernModules?.store;
      const currentRooms = store?.getSection?.("rooms") || [];
      const target = currentRooms.find((room) => clean(room.id) === targetId);
      if (!target) return;
      const conflict = targetId !== originalId && (clean(target.temp) || clean(target.hum));
      if (conflict) {
        root.alert?.(english() ? "The selected room already has temperature sensors configured." : "La stanza selezionata ha già sensori temperatura configurati.");
        return;
      }

      const next = currentRooms.map((room) => {
        const id = clean(room.id);
        if (id === originalId && originalId !== targetId) return { ...room, temp: "", hum: "" };
        if (id === targetId) return { ...room, temp, hum };
        return room;
      });
      try {
        if (typeof store?.replaceSection === "function") await store.replaceSection("rooms", next);
        else {
          if (originalId !== targetId) await store?.updateItem?.("rooms", originalId, { temp: "", hum: "" });
          await store?.updateItem?.("rooms", targetId, { temp, hum });
        }
        resetTemperatureReassignment(form);
        root.buildTempCards?.();
        root.setTimeout?.(() => root.editorSwitch?.("sez7"), 0);
      } catch (error) {
        root.console?.error?.("[DashboardModern] temperature room reassignment", error);
      }
    }, true);
  }
  return true;
}

function normalizeTemperatureEditor() {
  const form = doc?.querySelector("#editor-modal [data-temperature-form]");
  if (!form) return false;
  const intro = form.parentElement?.querySelector("[data-temperature-editor]");
  if (intro) {
    intro.textContent = english()
      ? "Select an existing room and associate its temperature and humidity sensors. You can also move the sensors to another room while editing. Edit room name and icon in Rooms."
      : "Seleziona una stanza esistente e associa i sensori di temperatura e umidità. In modifica puoi anche spostare i sensori in un'altra stanza. Nome e icona si modificano in Stanze.";
  }
  const iconInput = form.querySelector("#dm-temperature-icon");
  if (iconInput) {
    iconInput.type = "hidden";
    iconInput.hidden = true;
    const field = iconInput.closest("label.ed-slot") || iconInput.closest("[data-icon-field]");
    if (field && field !== form) {
      iconInput.remove();
      field.remove();
      form.append(iconInput);
    }
    const sync = () => {
      const roomId = clean(form.querySelector("#dm-temperature-room")?.value);
      const room = rooms().find((item) => clean(item.id) === roomId);
      iconInput.value = clean(room?.icon || "mdi:thermometer");
    };
    if (form.dataset.dmTemperatureIconBound !== "true") {
      form.dataset.dmTemperatureIconBound = "true";
      form.querySelector("#dm-temperature-room")?.addEventListener("change", sync);
      form.addEventListener("submit", sync, true);
    }
    sync();
  }
  bindTemperatureRoomReassignment(form);
  return true;
}

function installStyles() {
  installStyle(
    "dm-temperature-section-style",
    `
      #temp-grid .temp-card{
        position:relative!important;box-sizing:border-box!important;min-height:144px!important;height:auto!important;
        padding:18px 14px 14px!important;background:var(--ha-card-background,var(--card-bg,#fff))!important;
        color:var(--primary-text-color,var(--text,#0f172a))!important;overflow:hidden!important
      }
      #temp-grid .temp-card .cp-icon,#temp-grid .temp-card .temp-room-icon{
        position:absolute!important;left:16px!important;top:18px!important;width:42px!important;height:42px!important;
        display:grid!important;place-items:center!important;margin:0!important;color:var(--info-color,#0ea5e9)!important;
        font-family:Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif!important;line-height:1!important
      }
      #temp-grid .temp-card .cp-name,#temp-grid .temp-card .temp-room-name{
        box-sizing:border-box!important;display:flex!important;align-items:center!important;min-height:42px!important;
        margin:0 72px 10px 54px!important;padding:0!important;color:var(--primary-text-color,var(--text,#0f172a))!important;
        white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important
      }
      #temp-grid .temp-card .temp-comfort-badge{
        position:absolute!important;top:18px!important;right:12px!important;display:flex!important;align-items:center!important;
        justify-content:center!important;box-sizing:border-box!important;min-width:58px!important;max-width:70px!important;
        min-height:26px!important;margin:0!important;padding:4px 8px!important;border-radius:999px!important;
        font-size:10px!important;font-weight:900!important;line-height:1!important;text-align:center!important
      }
      #temp-grid .temp-card .temp-comfort-badge[data-comfort="freddo"],
      #temp-grid .temp-card .temp-comfort-badge[data-comfort="cold"]{background:color-mix(in srgb,var(--info-color,#0ea5e9) 16%,transparent)!important;color:var(--info-color,#0284c7)!important}
      #temp-grid .temp-card .temp-comfort-badge[data-comfort="comfort"]{background:color-mix(in srgb,var(--success-color,#10b981) 16%,transparent)!important;color:var(--success-color,#047857)!important}
      #temp-grid .temp-card .temp-comfort-badge[data-comfort="caldo"],
      #temp-grid .temp-card .temp-comfort-badge[data-comfort="hot"]{background:color-mix(in srgb,var(--error-color,#ef4444) 14%,transparent)!important;color:var(--error-color,#dc2626)!important}
      #temp-grid .temp-card .dm-temperature-icon-fallback{display:block!important;font-size:23px!important;line-height:1!important}
      #temp-grid .temp-card .temp-value,#temp-grid .temp-card .temp-hum-val{
        color:var(--primary-text-color,var(--text,#0f172a))!important;line-height:.95!important;vertical-align:baseline!important
      }
      #temp-grid .temp-card .temp-hum-val{color:var(--secondary-text-color,#64748b)!important}
      #editor-modal [data-temperature-form] #dm-temperature-icon,
      #editor-modal [data-temperature-form] [data-icon-field],
      #editor-modal [data-temperature-form] label.ed-slot:has(#dm-temperature-icon){display:none!important}
      #editor-modal [data-temperature-form] #dm-temperature-room[data-dm-temperature-room-editable="true"]{border-color:var(--primary-color,#0ea5e9)!important;box-shadow:0 0 0 3px color-mix(in srgb,var(--primary-color,#0ea5e9) 10%,transparent)!important}
      @media(max-width:520px){
        #temp-grid .temp-card{min-height:138px!important;padding-inline:12px!important}
        #temp-grid .temp-card .cp-name,#temp-grid .temp-card .temp-room-name{margin-right:66px!important;margin-left:50px!important}
      }
    `,
  );
}

function installObserver() {
  if (!doc || state.observer || typeof root.MutationObserver !== "function") return;
  const grid = doc.getElementById("temp-grid");
  if (!grid) return;
  state.observer = new root.MutationObserver(() => root.queueMicrotask?.(normalizeTemperatureCards));
  state.observer.observe(grid, { childList: true, subtree: true });
}

function installWrappers() {
  wrapFunction("buildTempCards", "__dmTemperatureSection", normalizeTemperatureCards);
  wrapFunction("renderTemperature", "__dmTemperatureSection", normalizeTemperatureCards);
  wrapFunction("editorSwitch", "__dmTemperatureEditorSection", normalizeTemperatureEditor);
}

export function installTemperatureSection() {
  if (!doc) return;
  installStyles();
  installWrappers();
  installObserver();
  normalizeTemperatureCards();
  normalizeTemperatureEditor();
  if (!state.listeners) {
    state.listeners = true;
    root.addEventListener?.("dashboardmodern:state-changed", (event) => {
      if (stateChangeAffectsTemperature(event)) normalizeTemperatureCards();
    });
    root.addEventListener?.("dashboardmodern:legacy-ready", () => {
      installWrappers();
      installObserver();
      normalizeTemperatureCards();
    });
    doc.addEventListener(
      "click",
      (event) => {
        const cancel = event.target?.closest?.("[data-temperature-cancel]");
        if (cancel) resetTemperatureReassignment(cancel.closest("[data-temperature-form]"));
        if (event.target?.closest?.("[data-tab='temp'],[data-tab='temperature'],.ed-tab[data-tab='sez7'],[data-temperature-edit]"))
          root.queueMicrotask?.(() => {
            normalizeTemperatureCards();
            normalizeTemperatureEditor();
          });
      },
      true,
    );
  }
  state.installed = true;
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installTemperatureSection, { once: true });
else installTemperatureSection();