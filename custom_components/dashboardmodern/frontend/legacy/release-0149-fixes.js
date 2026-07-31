/* DashboardModern 0.14.9: room fidelity, report visuals and adaptive layouts. */
const RELEASE_0149_FLAG = "__DASHBOARDMODERN_RELEASE_0149__";

const ICON_BY_TYPE = Object.freeze({
  forno: "mdi:stove",
  oven: "mdi:stove",
  frigo: "mdi:fridge-outline",
  frigorifero: "mdi:fridge-outline",
  fridge: "mdi:fridge-outline",
  congelatore: "mdi:fridge-bottom",
  freezer: "mdi:fridge-bottom",
  lavatrice: "mdi:washing-machine",
  washer: "mdi:washing-machine",
  lavastoviglie: "mdi:dishwasher",
  dishwasher: "mdi:dishwasher",
  asciugatrice: "mdi:tumble-dryer",
  dryer: "mdi:tumble-dryer",
  microonde: "mdi:microwave",
  microwave: "mdi:microwave",
  boiler: "mdi:water-boiler",
  scaldabagno: "mdi:water-boiler",
  tv: "mdi:television",
  condizionatore: "mdi:air-conditioner",
  ventilatore: "mdi:fan",
  robot: "mdi:robot-vacuum",
  aspirapolvere: "mdi:vacuum",
});

export function normalizedToken(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function applianceReportIcon(item = {}) {
  const explicit = item.report_icon || item.emoji_icon || item.icon;
  if (explicit) return explicit;
  const values = [item.visual_key, item.device_type, item.type, item.name].map(normalizedToken);
  for (const value of values) {
    if (ICON_BY_TYPE[value]) return ICON_BY_TYPE[value];
    const key = Object.keys(ICON_BY_TYPE).find((candidate) => value.includes(candidate));
    if (key) return ICON_BY_TYPE[key];
  }
  return "mdi:flash";
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch (_error) {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  try {
    globalThis.cdMarkDirty?.();
    globalThis.cdSyncPush?.();
  } catch (_error) {}
}

function store() {
  return globalThis.DashboardModernModules?.store;
}

function rooms() {
  return store()?.getSection?.("rooms") || readJson("cd_stanze", []);
}

function resolveRoom(reference) {
  const value = String(reference || "").trim();
  if (!value) return null;
  const target = normalizedToken(value).replace(/^room_/, "");
  return rooms().find((room) => {
    const id = normalizedToken(room.id).replace(/^room_/, "");
    const name = normalizedToken(room.name);
    return room.id === value || id === target || name === target;
  }) || null;
}

function lightEntity(light = {}) {
  return String(light.entity || light.entity_id || light.entities?.[0] || "").trim();
}

async function persistLightRoom(entityId, roomReference) {
  const room = resolveRoom(roomReference);
  if (!entityId || !room) return false;
  const assignments = readJson("cd_luci_rooms", {});
  if (assignments[entityId] !== room.id) {
    assignments[entityId] = room.id;
    writeJson("cd_luci_rooms", assignments);
  }

  const dataStore = store();
  if (!dataStore?.getSection || !dataStore?.updateItem) return true;
  const light = dataStore.getSection("lights").find((item) => lightEntity(item) === entityId);
  if (light && light.room_id !== room.id) {
    await dataStore.updateItem("lights", light.id, { ...light, room_id: room.id });
  }
  return true;
}

function repairLightAssignments() {
  const dataStore = store();
  if (!dataStore?.getSection) return;
  const assignments = readJson("cd_luci_rooms", {});
  let changed = false;
  for (const light of dataStore.getSection("lights") || []) {
    const entityId = lightEntity(light);
    const explicit = resolveRoom(light.room_id || light.room);
    if (entityId && explicit && assignments[entityId] !== explicit.id) {
      assignments[entityId] = explicit.id;
      changed = true;
    }
  }
  if (changed) writeJson("cd_luci_rooms", assignments);
}

function installLightRoomHook() {
  const original = globalThis.cdLuciSetRoom;
  if (typeof original !== "function" || original.__dm0149) return false;
  const wrapped = function cdLuciSetRoom0149(entityId, roomReference) {
    const result = original.apply(this, arguments);
    Promise.resolve(result)
      .then(() => persistLightRoom(entityId, roomReference))
      .then(() => {
        globalThis.renderLuci?.();
        globalThis.renderLights?.();
      })
      .catch((error) => console.warn("[DashboardModern] light room save", error));
    return result;
  };
  wrapped.__dm0149 = true;
  wrapped.__previous = original;
  globalThis.cdLuciSetRoom = wrapped;
  return true;
}

function hideEmptyLightRooms() {
  const root = document.getElementById("page-luci") || document.getElementById("page-lights");
  if (!root) return;
  const candidates = root.querySelectorAll(
    "[data-room-id], [data-light-room], .luci-room, .light-room, .room-section, .room-group",
  );
  candidates.forEach((section) => {
    const entities = section.querySelectorAll(
      "[data-entity-id], [data-light-entity], .light-card, .l-card, .luce-card, button[data-entity]",
    );
    const nestedRooms = section.querySelector("[data-room-id] [data-room-id]");
    if (!nestedRooms) section.hidden = entities.length === 0;
  });
}

function decorateReportIcons() {
  const appliances = store()?.getSection?.("appliances") || [];
  const loads = store()?.getSection?.("loads") || [];
  const byId = new Map([...appliances, ...loads].map((item) => [String(item.id), item]));
  document.querySelectorAll("[data-report-id]").forEach((row) => {
    const item = byId.get(String(row.dataset.reportId));
    if (!item) return;
    const icon = applianceReportIcon(item);
    const input = row.querySelector(".dm-icon-field input, [data-icon-field] input, [data-report-icon]");
    if (input && !input.value) {
      input.value = icon;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    row.dataset.reportIcon = icon;
    let preview = row.querySelector(".dm-report-icon-preview");
    if (!preview) {
      preview = document.createElement("span");
      preview.className = "dm-report-icon-preview";
      row.prepend(preview);
    }
    preview.innerHTML = globalThis.cdIconMarkup?.(icon, 24) || icon;
  });
}

function decorateTemperatureCards() {
  const configured = (store()?.getSection?.("rooms") || []).filter((room) => room.temp);
  document.querySelectorAll("#temp-grid .temp-card").forEach((card, index) => {
    const name = card.querySelector(".cp-name")?.textContent?.trim();
    const room = configured.find((item) => item.name === name) || configured[index];
    if (!room) return;
    card.classList.add("dm-temperature-card-0149");
    card.dataset.roomId = room.id || "";
    const icon = card.querySelector(".cp-icon");
    if (icon) {
      const value = room.icon || "mdi:thermometer";
      icon.classList.add("dm-temperature-room-icon");
      icon.innerHTML = globalThis.cdIconMarkup?.(value, 30) || "🌡️";
      icon.setAttribute("aria-label", room.name || "Temperature");
    }
  });
}

function installResponsiveClasses() {
  const root = document.documentElement;
  const apply = () => {
    const width = Math.round(globalThis.visualViewport?.width || root.clientWidth || innerWidth);
    root.dataset.dmViewport = width <= 420 ? "compact" : width <= 820 ? "fold" : "wide";
    root.style.setProperty("--dm-viewport-width", `${width}px`);
    requestAnimationFrame(() => {
      globalThis.renderTemperature?.();
      globalThis.renderApplianceSection?.();
      hideEmptyLightRooms();
      decorateTemperatureCards();
    });
  };
  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(apply);
    observer.observe(root);
  } else {
    globalThis.addEventListener("resize", apply, { passive: true });
  }
  globalThis.visualViewport?.addEventListener("resize", apply, { passive: true });
  globalThis.addEventListener("orientationchange", apply, { passive: true });
  apply();
}

function installStyles() {
  if (document.getElementById("dm-release-0149-styles")) return;
  const style = document.createElement("style");
  style.id = "dm-release-0149-styles";
  style.textContent = `
    html,body{max-width:100%;overflow-x:hidden}
    #app,.app,.page,.page-content{min-width:0;max-width:100%}
    #temp-grid{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))!important;gap:clamp(12px,2vw,22px)!important;align-items:stretch}
    #temp-grid .temp-card.dm-temperature-card-0149{box-sizing:border-box!important;width:100%!important;min-width:0!important;max-width:none!important;aspect-ratio:auto!important;display:grid!important;grid-template-columns:64px minmax(0,1fr)!important;grid-template-areas:"icon title" "icon values"!important;gap:6px 16px!important;align-items:center!important;padding:clamp(18px,3vw,26px)!important;border-radius:26px!important;background:linear-gradient(145deg,rgba(255,255,255,.98),rgba(246,250,255,.94))!important;box-shadow:0 18px 45px rgba(15,23,42,.12)!important}
    #temp-grid .dm-temperature-room-icon{grid-area:icon!important;width:58px!important;height:58px!important;border-radius:19px!important;display:grid!important;place-items:center!important;background:linear-gradient(145deg,#e0f2fe,#dbeafe)!important;color:#0284c7!important;overflow:hidden!important}
    #temp-grid .dm-temperature-room-icon ha-icon{width:32px!important;height:32px!important}
    #temp-grid .cp-name{grid-area:title!important;margin:0!important;font-size:clamp(16px,2vw,20px)!important;font-weight:800!important;text-transform:none!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    #temp-grid .temp-value,#temp-grid .cp-values,#temp-grid .temp-metrics{grid-area:values!important}
    .dm-report-row{grid-template-columns:auto minmax(120px,1fr) minmax(120px,.65fr) minmax(220px,1.4fr) auto!important;align-items:end!important}
    .dm-report-icon-preview{width:42px;height:42px;border-radius:14px;display:grid;place-items:center;background:#e0f2fe;color:#0369a1;align-self:end}
    .dm-appliance-art,.appl-main-view [data-appliance-asset],.appl-main-view img,.appl-main-view svg{max-width:clamp(86px,22vw,210px)!important;max-height:clamp(86px,22vw,210px)!important;width:auto!important;height:auto!important;object-fit:contain!important}
    [data-dm-viewport="fold"] .dashboard-grid,[data-dm-viewport="fold"] .cards-grid,[data-dm-viewport="fold"] .appl-grid{grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))!important}
    @media(max-width:820px){
      .main,.page,.page-content{padding-inline:clamp(10px,3vw,18px)!important}
      #temp-grid{grid-template-columns:1fr!important}
      #temp-grid .temp-card.dm-temperature-card-0149{grid-template-columns:54px minmax(0,1fr)!important;padding:16px!important;border-radius:22px!important}
      #temp-grid .dm-temperature-room-icon{width:50px!important;height:50px!important;border-radius:16px!important}
      #dp-report .dm-report-row,#dp-reports .dm-report-row,.dm-editor-report .dm-report-row{display:grid!important;grid-template-columns:44px minmax(0,1fr)!important;gap:10px!important}
      #dp-report .dm-report-row>label,#dp-report .dm-report-row>.dm-icon-field,#dp-report .dm-report-row>.dm-entity-field,#dp-report .dm-report-row>span,#dp-reports .dm-report-row>label,#dp-reports .dm-report-row>.dm-icon-field,#dp-reports .dm-report-row>.dm-entity-field,#dp-reports .dm-report-row>span,.dm-editor-report .dm-report-row>label,.dm-editor-report .dm-report-row>.dm-icon-field,.dm-editor-report .dm-report-row>.dm-entity-field,.dm-editor-report .dm-report-row>span{grid-column:2!important;width:100%!important;min-width:0!important}
      #dp-report .dm-report-row>.dm-report-icon-preview,#dp-reports .dm-report-row>.dm-report-icon-preview,.dm-editor-report .dm-report-row>.dm-report-icon-preview{grid-column:1!important;grid-row:1 / span 2!important}
      .dm-report-row{display:grid!important;grid-template-columns:44px minmax(0,1fr)!important;gap:10px!important}
      .dm-report-row>label,.dm-report-row>.dm-icon-field,.dm-report-row>.dm-entity-field,.dm-report-row>span{grid-column:2!important;width:100%!important;min-width:0!important}
      .dm-report-icon-preview{grid-column:1!important;grid-row:1 / span 2!important}
      .dm-appliance-art,.appl-main-view [data-appliance-asset],.appl-main-view img,.appl-main-view svg{max-width:clamp(72px,28vw,132px)!important;max-height:clamp(72px,28vw,132px)!important}
    }
    @media(max-width:420px){
      #temp-grid .temp-card.dm-temperature-card-0149{grid-template-columns:46px minmax(0,1fr)!important;gap:4px 12px!important;padding:14px!important}
      #temp-grid .dm-temperature-room-icon{width:44px!important;height:44px!important;border-radius:14px!important}
      .dm-appliance-art,.appl-main-view [data-appliance-asset],.appl-main-view img,.appl-main-view svg{max-width:96px!important;max-height:96px!important}
      .navbar,.bottom-nav{max-width:100vw!important;overflow-x:auto!important;scrollbar-width:none}
    }
  `;
  document.head.append(style);
}

function decorateAll() {
  installLightRoomHook();
  repairLightAssignments();
  hideEmptyLightRooms();
  decorateReportIcons();
  decorateTemperatureCards();
}

function install() {
  if (globalThis[RELEASE_0149_FLAG]?.installed) return;
  globalThis[RELEASE_0149_FLAG] = { installed: true };
  installStyles();
  installResponsiveClasses();
  let frame = 0;
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(decorateAll);
  };
  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "data-room-id"],
  });
  globalThis.addEventListener("dashboardmodern:legacy-ready", schedule);
  setInterval(decorateAll, 1200);
  schedule();
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
}
