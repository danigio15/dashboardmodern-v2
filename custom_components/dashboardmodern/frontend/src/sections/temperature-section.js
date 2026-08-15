// DM-FIX-20260815A
import { directEmoji, roomGlyph } from "../core/personalization-catalog.js";
import {
  allStates,
  clean,
  dashboardStore,
  doc,
  english,
  installStyle,
  root,
  section,
} from "./shared.js";

root.__DM_20260815C__ = true;
const KEY = "__DASHBOARDMODERN_TEMPERATURE_SECTION__";
const state = (root[KEY] ||= {
  installed: false,
  listeners: false,
  storeUnsubscribe: null,
  signature: "",
});
root.__DM_FIX_20260815A__ = true;

function glyph(icon) {
  return directEmoji(icon) || roomGlyph(icon);
}

function rooms() {
  const values = section("rooms", []);
  return Array.isArray(values) ? values : [];
}

function configuredRooms() {
  return rooms().filter((room) => clean(room?.temp));
}

function eventEntityIds(event) {
  const values = event?.detail?.entity_ids || [event?.detail?.entity_id];
  return new Set((Array.isArray(values) ? values : [values]).map(clean).filter(Boolean));
}

function temperatureEntityIds() {
  const ids = new Set();
  configuredRooms().forEach((room) => {
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

function comfortLabel(temperature) {
  if (temperature == null) return english() ? "Unavailable" : "Non disponibile";
  if (temperature < 18) return english() ? "Cold" : "Freddo";
  if (temperature > 26) return english() ? "Hot" : "Caldo";
  return "Comfort";
}

function safeId(entity) {
  return clean(entity).replace(/[.\-]/g, "_");
}

function roomHumidity(room) {
  const temp = clean(room?.temp);
  return clean(room?.hum || temp.replace("_temperature", "_humidity"));
}

function cardSignature(values = configuredRooms()) {
  return values
    .map((room) =>
      [
        clean(room.id),
        clean(room.name),
        clean(room.icon),
        clean(room.floor),
        clean(room.temp),
        roomHumidity(room),
      ].join("|"),
    )
    .join(";");
}

function makeText(className, value) {
  const node = doc.createElement("span");
  node.className = className;
  node.textContent = value;
  return node;
}

function openHistory(event, entity, name) {
  if (!entity) return;
  root.apriStorico?.(event, entity, name);
}

function createTemperatureCard(room) {
  const temperature = clean(room.temp);
  const humidity = roomHumidity(room);
  const tid = safeId(temperature);
  const hid = safeId(humidity);

  const card = doc.createElement("article");
  card.className = "temp-card cp-card dm-temperature-card";
  card.dataset.roomId = clean(room.id);
  card.dataset.dmTemperatureCanonical = "true";
  card.style.setProperty("--cp-rgb", "148, 163, 184");
  card.addEventListener("click", (event) => openHistory(event, temperature, clean(room.name)));

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
  name.textContent = clean(room.name) || (english() ? "Room" : "Stanza");
  title.append(icon, name);
  const badge = doc.createElement("div");
  badge.className = "cp-badge temp-comfort-badge";
  badge.id = `tc_${tid}`;
  header.append(title, badge);

  const body = doc.createElement("div");
  body.className = "cp-body temp-card-body";
  const current = doc.createElement("div");
  current.className = "cp-temp-current-wrap";
  current.append(
    makeText("cp-temp-current-lbl", english() ? "Temperature" : "Temperatura"),
    makeText("cp-temp-current temp-value", "—"),
  );
  current.lastElementChild.id = `tv_${tid}`;

  const humidityBox = doc.createElement("div");
  humidityBox.className = "cp-temp-target";
  humidityBox.append(
    makeText("lbl", `💧 ${english() ? "Humidity" : "Umidità"}`),
    makeText("val temp-hum-val", "—%"),
  );
  humidityBox.lastElementChild.id = `hv_${hid}`;
  humidityBox.addEventListener("click", (event) => {
    event.stopPropagation();
    openHistory(event, humidity, `${clean(room.name)} ${english() ? "Humidity" : "Umidità"}`);
  });
  body.append(current, humidityBox);
  card.append(header, body);
  return card;
}

function updateCard(card, room) {
  if (!card || !room) return;
  const temperature = numericState(room.temp);
  const humidity = numericState(roomHumidity(room));
  const value = card.querySelector(".temp-value");
  const humidityValue = card.querySelector(".temp-hum-val");
  const comfort = card.querySelector(".temp-comfort-badge");
  const icon = card.querySelector(".cp-icon,.temp-room-icon");
  const name = card.querySelector(".cp-name,.temp-room-name");

  if (value) value.textContent = temperature == null ? "—" : temperature.toFixed(1);
  if (humidityValue)
    humidityValue.textContent = humidity == null ? "—%" : `${humidity.toFixed(0)}%`;
  if (comfort) {
    const label = comfortLabel(temperature);
    comfort.textContent = label;
    comfort.title = label;
    comfort.setAttribute("aria-label", label);
    comfort.dataset.comfort = label.toLowerCase().replaceAll(" ", "-");
  }
  if (icon) {
    icon.dataset.roomIcon = clean(room.icon || "mdi:home");
    const fallback =
      icon.querySelector(".dm-temperature-icon-fallback") ||
      makeText("dm-temperature-icon-fallback", "");
    fallback.textContent = glyph(room.icon);
    if (!fallback.parentElement) icon.replaceChildren(fallback);
  }
  if (name) name.textContent = clean(room.name) || (english() ? "Room" : "Stanza");
}

export function normalizeTemperatureCards() {
  const grid = doc?.getElementById("temp-grid");
  if (!grid) return false;
  const values = configuredRooms();
  for (const card of grid.querySelectorAll(".temp-card[data-room-id]")) {
    const room = values.find((item) => clean(item.id) === clean(card.dataset.roomId));
    if (room) updateCard(card, room);
  }
  return values.length > 0;
}

export function renderTemperatureCards({ force = false } = {}) {
  const grid = doc?.getElementById("temp-grid");
  if (!grid) return false;
  const values = configuredRooms();
  const signature = cardSignature(values);

  if (
    !force &&
    signature === state.signature &&
    grid.querySelectorAll(".temp-card[data-dm-temperature-canonical='true']").length ===
      values.length
  ) {
    normalizeTemperatureCards();
    return values.length > 0;
  }

  state.signature = signature;
  if (!values.length) {
    const empty = doc.createElement("div");
    empty.className = "dm-temperature-empty";
    empty.textContent = english()
      ? "No room has a temperature sensor configured yet."
      : "Nessuna stanza ha ancora un sensore temperatura configurato.";
    grid.replaceChildren(empty);
    return false;
  }

  const cards = values.map((room) => {
    const card = createTemperatureCard(room);
    updateCard(card, room);
    return card;
  });
  grid.replaceChildren(...cards);
  grid.dataset.dmTemperatureRenderer = "canonical";
  return true;
}

function temperatureEditMode(form) {
  const title = clean(
    form?.querySelector("[data-temperature-form-title]")?.textContent,
  ).toLowerCase();
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
    select.addEventListener(
      "change",
      (event) => {
        if (!form.dataset.dmOriginalRoom) return;
        event.stopImmediatePropagation();
        syncEditRoomPresentation(form, select.value);
      },
      true,
    );
  }

  if (form.dataset.dmTemperatureReassignSubmit !== "true") {
    form.dataset.dmTemperatureReassignSubmit = "true";
    form.addEventListener(
      "submit",
      async (event) => {
        const originalId = clean(form.dataset.dmOriginalRoom);
        if (!originalId) return;
        event.preventDefault();
        event.stopImmediatePropagation();

        const targetId = clean(select.value);
        const temp = clean(form.querySelector("#ed-pl-temp")?.value);
        const hum = clean(form.querySelector("#dm-humidity-new")?.value);
        if (!targetId || !temp.includes(".")) {
          root.alert?.(
            english()
              ? "Select a room and a valid temperature entity."
              : "Seleziona una stanza e un'entità temperatura valida.",
          );
          return;
        }

        const store = dashboardStore();
        const currentRooms = store?.getSection?.("rooms") || [];
        const target = currentRooms.find((room) => clean(room.id) === targetId);
        if (!target) return;
        const conflict = targetId !== originalId && (clean(target.temp) || clean(target.hum));
        if (conflict) {
          root.alert?.(
            english()
              ? "The selected room already has temperature sensors configured."
              : "La stanza selezionata ha già sensori temperatura configurati.",
          );
          return;
        }

        const next = currentRooms.map((room) => {
          const id = clean(room.id);
          if (id === originalId && originalId !== targetId) return { ...room, temp: "", hum: "" };
          if (id === targetId) return { ...room, temp, hum };
          return room;
        });
        try {
          await store?.replaceSection?.("rooms", next);
          resetTemperatureReassignment(form);
          state.signature = "";
          renderTemperatureCards({ force: true });
          root.setTimeout?.(() => root.editorSwitch?.("sez7"), 0);
        } catch (error) {
          root.console?.error?.("[DashboardModern] temperature room reassignment", error);
        }
      },
      true,
    );
  }
  return true;
}

export function normalizeTemperatureConfiguredRows() {
  const values = rooms();
  let normalized = false;
  doc?.querySelectorAll?.("#editor-modal [data-temperature-room][data-room-id]").forEach((row) => {
    const room = values.find((item) => clean(item?.id) === clean(row.dataset.roomId));
    const name =
      clean(room?.name) ||
      clean(row.dataset.roomName) ||
      clean(row.dataset.roomId) ||
      (english() ? "Room" : "Stanza");
    let main = row.querySelector(".ed-row-main");
    if (!main) {
      main = doc.createElement("div");
      main.className = "ed-row-main";
      row.querySelector(".dm-temperature-card-icon")?.after(main);
      if (!main.parentElement) row.prepend(main);
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
    primary.textContent = name;
    primary.title = name;
    normalized = true;
    if (room) {
      const sensors = [clean(room.temp), clean(room.hum)].filter(Boolean).join(" · ");
      if (sensors) {
        secondary.textContent = sensors;
        secondary.title = sensors;
      }
    }
    row.dataset.dmTemperatureNameVisible = "true";
  });
  return normalized;
}

function normalizeTemperatureEditor() {
  normalizeTemperatureConfiguredRows();
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
    const label = iconInput.closest("label.ed-slot");
    if (label && label !== form) {
      iconInput.remove();
      label.remove();
      form.append(iconInput);
    } else {
      iconInput.closest("[data-icon-field]")?.remove();
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

function installRenderOwner(name) {
  const current = root[name];
  if (current?.__dmCanonicalTemperatureOwner) return false;
  function canonicalTemperatureRender() {
    return renderTemperatureCards();
  }
  canonicalTemperatureRender.__dmCanonicalTemperatureOwner = true;
  canonicalTemperatureRender.__dmPrevious = current;
  root[name] = canonicalTemperatureRender;
  return true;
}

function installEditorNormalizerOwner() {
  const current = root.editorSwitch;
  if (typeof current !== "function" || current.__dmCanonicalTemperatureEditor) return false;
  function canonicalTemperatureEditorSwitch(...args) {
    const result = current.apply(this, args);
    normalizeTemperatureEditor();
    return result;
  }
  canonicalTemperatureEditorSwitch.__dmCanonicalTemperatureEditor = true;
  canonicalTemperatureEditorSwitch.__dmPrevious = current;
  root.editorSwitch = canonicalTemperatureEditorSwitch;
  return true;
}

function installOwners() {
  installRenderOwner("buildTempCards");
  installRenderOwner("renderTemperature");
  installEditorNormalizerOwner();
}

function subscribeStore() {
  if (state.storeUnsubscribe) return;
  const store = dashboardStore();
  if (typeof store?.subscribe !== "function") return;
  state.storeUnsubscribe = store.subscribe((change) => {
    if (change?.section !== "rooms" && change?.section !== "snapshot") return;
    state.signature = "";
    renderTemperatureCards({ force: true });
    root.queueMicrotask?.(normalizeTemperatureConfiguredRows);
  });
}

function installStyles() {
  installStyle(
    "dm-temperature-section-style",
    `
    #page-temp #temp-grid,.temp-grid{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(250px,310px))!important;justify-content:start!important;align-items:start!important;gap:14px!important;width:100%!important;margin:14px 0 0!important;padding:0 18px 26px!important}
    #page-temp .temp-card,#temp-grid .temp-card{position:relative!important;display:grid!important;box-sizing:border-box!important;aspect-ratio:auto!important;width:100%!important;max-width:310px!important;min-height:126px!important;margin:0!important;padding:14px 15px!important;border:1px solid color-mix(in srgb,var(--primary-color,#0ea5e9) 14%,var(--divider-color,#e2e8f0))!important;border-radius:19px!important;gap:11px!important;overflow:hidden!important;background:linear-gradient(145deg,var(--ha-card-background,var(--card-bg,#fff)) 0%,color-mix(in srgb,var(--primary-color,#0ea5e9) 4%,var(--ha-card-background,#fff)) 100%)!important;box-shadow:0 10px 24px rgba(15,23,42,.08)!important}
    #page-temp .temp-card::before,#temp-grid .temp-card::before{content:""!important;position:absolute!important;inset:0 auto 0 0!important;width:3px!important;background:linear-gradient(180deg,var(--primary-color,#0ea5e9),color-mix(in srgb,var(--primary-color,#0ea5e9) 35%,transparent))!important;opacity:.72!important}
    #page-temp .temp-card-header,#temp-grid .temp-card-header{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;min-height:36px!important;margin:0!important;padding:0!important}
    #page-temp .cp-title-wrap,#temp-grid .cp-title-wrap{display:flex!important;align-items:center!important;gap:9px!important;min-width:0!important;flex:1 1 auto!important}
    #page-temp .cp-icon,#temp-grid .cp-icon{display:grid!important;place-items:center!important;flex:0 0 36px!important;width:36px!important;height:36px!important;margin:0!important;border:1px solid color-mix(in srgb,var(--primary-color,#0ea5e9) 12%,transparent)!important;border-radius:12px!important;background:color-mix(in srgb,var(--primary-color,#0ea5e9) 8%,var(--ha-card-background,#fff))!important;box-shadow:0 4px 12px rgba(15,23,42,.05)!important;font-family:Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif!important}
    #page-temp .cp-name,#temp-grid .cp-name{min-width:0!important;margin:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;font-size:16px!important;font-weight:900!important;line-height:1.15!important;color:var(--text,#0f172a)!important}
    #page-temp .temp-comfort-badge,#temp-grid .temp-comfort-badge{position:static!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;flex:0 0 auto!important;min-width:48px!important;max-width:82px!important;min-height:24px!important;padding:4px 8px!important;border-radius:999px!important;font-size:8.5px!important;font-weight:900!important;line-height:1!important;white-space:nowrap!important;transform:none!important}
    #temp-grid .temp-comfort-badge[data-comfort="freddo"],#temp-grid .temp-comfort-badge[data-comfort="cold"]{background:color-mix(in srgb,var(--info-color,#0ea5e9) 16%,transparent)!important;color:var(--info-color,#0284c7)!important}
    #temp-grid .temp-comfort-badge[data-comfort="comfort"]{background:color-mix(in srgb,var(--success-color,#10b981) 16%,transparent)!important;color:var(--success-color,#047857)!important}
    #temp-grid .temp-comfort-badge[data-comfort="caldo"],#temp-grid .temp-comfort-badge[data-comfort="hot"]{background:color-mix(in srgb,var(--error-color,#ef4444) 14%,transparent)!important;color:var(--error-color,#dc2626)!important}
    #page-temp .temp-card-body,#temp-grid .temp-card-body{display:grid!important;grid-template-columns:minmax(0,1.18fr) minmax(82px,.82fr)!important;align-items:end!important;gap:11px!important;width:100%!important;margin:0!important;padding:0!important}
    #page-temp .cp-temp-current-wrap,#temp-grid .cp-temp-current-wrap{display:grid!important;gap:2px!important;min-width:0!important}.cp-temp-current-lbl{margin:0!important;font-size:8px!important;font-weight:900!important;letter-spacing:.10em!important;line-height:1.2!important;text-transform:uppercase!important;color:var(--secondary-text-color,var(--text-dim,#64748b))!important}
    #page-temp .cp-temp-current,#temp-grid .cp-temp-current{display:block!important;margin:0!important;font-size:36px!important;font-weight:850!important;line-height:.94!important;letter-spacing:-1px!important;white-space:nowrap!important;color:var(--text,#0f172a)!important}
    #page-temp .cp-temp-target,#temp-grid .cp-temp-target{display:grid!important;align-content:end!important;gap:4px!important;min-width:0!important;margin:0!important;padding:5px 0 1px 11px!important;border-left:1px solid color-mix(in srgb,var(--primary-color,#0ea5e9) 18%,var(--divider-color,#dbe4ee))!important;text-align:left!important}.cp-temp-target .lbl{font-size:8px!important;font-weight:900!important;letter-spacing:.05em!important;text-transform:uppercase!important;white-space:nowrap!important;color:var(--secondary-text-color,var(--text-dim,#64748b))!important}.cp-temp-target .val{font-size:22px!important;font-weight:850!important;line-height:1!important;white-space:nowrap!important;color:var(--secondary-text-color,var(--text-dim,#64748b))!important}
    #temp-grid .dm-temperature-icon-fallback{display:block!important;font-size:23px!important;line-height:1!important}
    #temp-grid .dm-temperature-empty{grid-column:1/-1!important;box-sizing:border-box!important;width:100%!important;padding:28px 20px!important;border:1px dashed var(--divider-color,#dbe4ee)!important;border-radius:20px!important;background:var(--ha-card-background,var(--card-bg,#fff))!important;color:var(--secondary-text-color,#64748b)!important;text-align:center!important;font-weight:750!important}
    #editor-modal [data-temperature-room][data-dm-temperature-name-visible="true"]>.ed-row-main{display:block!important;visibility:visible!important;opacity:1!important;min-width:0!important;align-self:center!important;overflow:hidden!important}
    #editor-modal [data-temperature-room][data-dm-temperature-name-visible="true"]>.ed-row-main>.ed-row-new{display:block!important;visibility:visible!important;opacity:1!important;color:var(--text,#0f172a)!important;font-weight:900!important;line-height:1.25!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    #editor-modal [data-temperature-room][data-dm-temperature-name-visible="true"]>.ed-row-main>.ed-row-old{display:block!important;visibility:visible!important;opacity:1!important;margin-top:3px!important;color:var(--secondary-text-color,var(--text-dim,#64748b))!important;line-height:1.25!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    #editor-modal [data-temperature-form] #dm-temperature-icon,#editor-modal [data-temperature-form] [data-icon-field],#editor-modal [data-temperature-form] label.ed-slot:has(#dm-temperature-icon){display:none!important}
    #editor-modal [data-temperature-form] .dm-temperature-actions button{min-height:44px!important}
    #editor-modal [data-temperature-form] #dm-temperature-room[data-dm-temperature-room-editable="true"]{border-color:var(--primary-color,#0ea5e9)!important;box-shadow:0 0 0 3px color-mix(in srgb,var(--primary-color,#0ea5e9) 10%,transparent)!important}
    @media(max-width:680px){#page-temp #temp-grid,.temp-grid{grid-template-columns:minmax(0,350px)!important;justify-content:center!important;gap:12px!important;margin-top:12px!important;padding:0 14px 22px!important}#page-temp .temp-card,#temp-grid .temp-card{width:100%!important;max-width:350px!important;min-height:118px!important;padding:12px 13px!important;border-radius:18px!important;gap:9px!important}#page-temp .cp-temp-current,#temp-grid .cp-temp-current{font-size:34px!important}.cp-temp-target .val{font-size:21px!important}}
  `,
  );
}

export function installTemperatureSection() {
  if (!doc) return;
  installStyles();
  installOwners();
  subscribeStore();
  renderTemperatureCards();
  normalizeTemperatureEditor();
  if (!state.listeners) {
    state.listeners = true;
    root.addEventListener?.("dashboardmodern:state-changed", (event) => {
      if (stateChangeAffectsTemperature(event)) normalizeTemperatureCards();
    });
    for (const eventName of [
      "dashboardmodern:legacy-ready",
      "dashboardmodern:runtime-ready",
      "dashboardmodern:persistence-restored",
      "dashboardmodern:temperature-editor-rendered",
    ]) {
      root.addEventListener?.(eventName, () => {
        installOwners();
        subscribeStore();
        state.signature = "";
        renderTemperatureCards({ force: true });
        normalizeTemperatureConfiguredRows();
      });
    }
    root.addEventListener?.("dashboardmodern:config-reset", () => {
      state.signature = "";
      renderTemperatureCards({ force: true });
    });
    doc.addEventListener(
      "click",
      (event) => {
        const cancel = event.target?.closest?.("[data-temperature-cancel]");
        if (cancel) resetTemperatureReassignment(cancel.closest("[data-temperature-form]"));
        if (
          event.target?.closest?.(
            "[data-tab='temp'],[data-tab='temperature'],.ed-tab[data-tab='sez7'],[data-temperature-edit]",
          )
        )
          root.queueMicrotask?.(() => {
            installOwners();
            renderTemperatureCards();
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
