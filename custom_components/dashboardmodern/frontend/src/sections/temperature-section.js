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
        fallback.textContent = glyph(room.icon);
      }

      const temperature = numericState(room.temp);
      const humidityEntity = clean(room.hum || clean(room.temp).replace("_temperature", "_humidity"));
      const humidity = numericState(humidityEntity);
      const temperatureId = clean(room.temp).replace(/[.\-]/g, "_");
      const humidityId = humidityEntity.replace(/[.\-]/g, "_");
      const value = doc.getElementById(`tv_${temperatureId}`) || card.querySelector(".temp-value");
      const humidityValue = doc.getElementById(`hv_${humidityId}`) || card.querySelector(".temp-hum-val");
      const comfort = doc.getElementById(`tc_${temperatureId}`) || card.querySelector(".temp-comfort-badge");
      if (value) value.textContent = temperature == null ? "—" : temperature.toFixed(1);
      if (humidityValue) humidityValue.textContent = humidity == null ? "—%" : `${humidity.toFixed(0)}%`;
      if (comfort) {
        const label = comfortLabel(temperature);
        comfort.textContent = label;
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

function normalizeTemperatureEditor() {
  const form = doc?.querySelector("#editor-modal [data-temperature-form]");
  if (!form) return false;
  const intro = form.parentElement?.querySelector("[data-temperature-editor]");
  if (intro) {
    intro.textContent = english()
      ? "Select an existing room and associate its temperature and humidity sensors. Edit its name and icon in Rooms."
      : "Seleziona una stanza esistente e associa i sensori di temperatura e umidità. Nome e icona si modificano in Stanze.";
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
    root.addEventListener?.("dashboardmodern:state-changed", normalizeTemperatureCards);
    root.addEventListener?.("dashboardmodern:legacy-ready", () => {
      installWrappers();
      installObserver();
      normalizeTemperatureCards();
    });
    doc.addEventListener(
      "click",
      (event) => {
        if (event.target?.closest?.("[data-tab='temp'],[data-tab='temperature'],.ed-tab[data-tab='sez7']"))
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
