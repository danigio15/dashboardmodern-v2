import { carBrandVisual, roomVisual } from "../core/personalization-catalog.js";
import {
  clean,
  dashboardStore,
  doc,
  esc,
  installStyle,
  readJson,
  root,
  wrapFunction,
} from "./shared.js";

// Real-device follow-up after beta.10. This module deliberately stays small and
// event-driven: it reconciles only the three visual contracts reproduced in the
// Home Assistant mobile WebView (EV brand sizing/selection, alert icon picker,
// room icon + label rows). No MutationObserver and no permanent polling.
const KEY = "__DASHBOARDMODERN_BETA11_REAL_DEVICE_POLISH__";
const state = (root[KEY] ||= {
  installed: false,
  frame: 0,
  listeners: false,
  storeUnsubscribe: null,
  lastVehicleSignature: "",
});

const ALERT_ICON_CATALOG = Object.freeze([
  ["🔔", "Avviso", "Alert", "avviso alert notifica notification campana bell"],
  ["⚠️", "Attenzione", "Warning", "attenzione warning pericolo caution"],
  ["🚨", "Allarme", "Alarm", "allarme alarm sirena emergency emergenza"],
  ["ℹ️", "Informazione", "Information", "informazione info information"],
  ["✅", "OK / Risolto", "OK / Resolved", "ok risolto resolved success"],
  ["❌", "Errore", "Error", "errore error guasto fault"],
  ["🛡️", "Sicurezza", "Security", "sicurezza security antifurto alarm shield"],
  ["🔒", "Bloccato", "Locked", "bloccato locked lock serratura"],
  ["🔓", "Sbloccato", "Unlocked", "sbloccato unlocked unlock"],
  ["🚪", "Porta / Apertura", "Door / Opening", "porta door apertura ingresso entrance"],
  ["🪟", "Finestra / Tapparella", "Window / Shutter", "finestra window tapparella shutter"],
  ["👣", "Movimento", "Motion", "movimento motion presenza presence passi"],
  ["📷", "Telecamera", "Camera", "telecamera camera cctv video"],
  ["🔥", "Incendio / Calore", "Fire / Heat", "incendio fire calore heat fiamma"],
  ["💨", "Fumo / Aria", "Smoke / Air", "fumo smoke aria air vento"],
  ["💧", "Perdita acqua", "Water leak", "perdita acqua water leak goccia"],
  ["🌊", "Allagamento", "Flood", "allagamento flood acqua water"],
  ["🌡️", "Temperatura", "Temperature", "temperatura temperature termometro"],
  ["☀️", "Caldo", "Hot", "caldo hot sole sun"],
  ["❄️", "Freddo / Clima", "Cold / Climate", "freddo cold clima climate neve"],
  ["🔋", "Batteria", "Battery", "batteria battery scarica low"],
  ["⚡", "Energia", "Energy", "energia energy corrente power"],
  ["🔌", "Alimentazione", "Power supply", "alimentazione power presa plug"],
  ["💡", "Luce", "Light", "luce light lampadina"],
  ["🧺", "Elettrodomestico", "Appliance", "elettrodomestico appliance lavatrice laundry"],
  ["🚗", "Auto", "Vehicle", "auto car vehicle ev macchina"],
  ["🚧", "Cancello / Accesso", "Gate / Access", "cancello gate accesso access"],
  ["🏠", "Casa", "Home", "casa home abitazione"],
  ["👤", "Persona", "Person", "persona person utente user presenza"],
  ["🐾", "Animale", "Pet", "animale pet cane gatto dog cat"],
  ["📦", "Pacco", "Package", "pacco package consegna delivery"],
  ["✉️", "Posta", "Mail", "posta mail lettera mailbox"],
  ["📱", "Telefono", "Phone", "telefono phone smartphone mobile"],
  ["📶", "Rete / Wi-Fi", "Network / Wi-Fi", "rete network wifi internet connessione"],
  ["🖥️", "Server", "Server", "server pc minipc computer sistema"],
  ["⏰", "Timer", "Timer", "timer ora clock sveglia"],
  ["📅", "Scadenza", "Schedule", "scadenza schedule calendario calendar"],
  ["⭐", "Preferito", "Favorite", "preferito favorite star stella"],
]);

function english() {
  return clean(doc?.documentElement?.lang).toLowerCase().startsWith("en");
}

function activeTab() {
  return clean(doc?.querySelector(".ed-tab.active")?.dataset?.tab);
}

function legacyVehicles() {
  const values = readJson("cd_ev_cars", []);
  return Array.isArray(values) ? values : [];
}

function canonicalVehicles() {
  try {
    const values = dashboardStore()?.getSection?.("ev");
    return Array.isArray(values) ? values : [];
  } catch (_error) {
    return [];
  }
}

function vehicles() {
  const legacy = legacyVehicles();
  return legacy.length ? legacy : canonicalVehicles();
}

function activeVehicleIndex(cars = vehicles()) {
  if (!cars.length) return -1;
  const raw = Number.parseInt(root.localStorage?.getItem("cd_ev_car_active") || "0", 10);
  const index = Number.isFinite(raw) ? raw : 0;
  return Math.max(0, Math.min(cars.length - 1, index));
}

function vehicleBrand(car = {}) {
  return clean(car.brand);
}

function vehicleModel(car = {}) {
  return clean(car.model || car.vehicle_model || car.name);
}

function dispatchValue(input, value) {
  if (!input || clean(input.value) === clean(value)) return false;
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function syncEvPanelToActiveVehicle() {
  if (activeTab() !== "sez2") return false;
  const body = doc?.getElementById("ed-body");
  const panel = body?.querySelector?.("[data-ev-appearance]");
  const brandSelect = panel?.querySelector?.("select[data-brand]");
  const modelSelect = panel?.querySelector?.("select[data-model]");
  if (!panel || !brandSelect || !modelSelect) return false;

  const cars = vehicles();
  const index = activeVehicleIndex(cars);
  const car = index >= 0 ? cars[index] : null;
  if (!car) return false;
  const brand = vehicleBrand(car);
  const model = vehicleModel(car);
  const identity = clean(car.id || car.entity || car.name || index);
  const signature = `${index}|${identity}|${brand}|${model}`;

  // Do not overwrite a user's unsaved dropdown choice while they remain on the
  // same vehicle. Re-sync only when the configured/edited vehicle identity moves.
  if (panel.dataset.dmBeta11VehicleSignature !== signature) {
    const brandExists = [...brandSelect.options].some((option) => option.value === brand);
    if (brand && brandExists) dispatchValue(brandSelect, brand);
    const applyModel = () => {
      const modelExists = [...modelSelect.options].some((option) => option.value === model);
      if (model && modelExists) dispatchValue(modelSelect, model);
      panel.dataset.dmBeta11VehicleSignature = signature;
      panel.dataset.dmBeta11VehicleIndex = String(index);
      state.lastVehicleSignature = signature;
      normalizeEvPreview(panel);
    };
    // Existing beta9 listeners rebuild model options synchronously on change;
    // the microtask also covers integrations that schedule that rebuild.
    applyModel();
    root.queueMicrotask?.(applyModel);
  } else {
    normalizeEvPreview(panel);
  }
  return true;
}

function normalizeEvPreview(panel) {
  const preview = panel?.querySelector?.("[data-brand-preview]");
  const brandSelect = panel?.querySelector?.("select[data-brand]");
  const modelSelect = panel?.querySelector?.("select[data-model]");
  if (!preview || !brandSelect || !modelSelect) return false;
  preview.dataset.dmBeta11EvPreview = "true";
  preview.dataset.dmBeta11Brand = clean(brandSelect.value).toLowerCase();
  const logo = preview.querySelector(".dm-car-brand,.dm-leapmotor-mark");
  logo?.setAttribute?.("data-dm-beta11-logo", "true");
  const copy = preview.querySelector(".dm-ev-brand-copy");
  if (copy) {
    copy.dataset.dmBeta11Copy = "true";
    copy.querySelector("b")?.setAttribute?.("title", clean(brandSelect.value));
    copy.querySelector("small")?.setAttribute?.("title", clean(modelSelect.value));
  }
  return true;
}

function mergedRooms() {
  let canonical = [];
  try {
    const values = dashboardStore()?.getSection?.("rooms");
    if (Array.isArray(values)) canonical = values;
  } catch (_error) {}
  const legacy = readJson("cd_stanze", []);
  if (!Array.isArray(legacy) || !legacy.length) return canonical;
  return legacy.map((room, index) => {
    const id = clean(room?.id);
    const name = clean(room?.name).toLowerCase();
    const fallback = canonical.find((candidate) => id && clean(candidate?.id) === id)
      || canonical.find((candidate) => name && clean(candidate?.name).toLowerCase() === name)
      || canonical[index]
      || {};
    // cd_stanze is the form the user just edited; its icon/name must win over a
    // canonical snapshot that may still be one render behind.
    return { ...fallback, ...room };
  });
}

function roomMarkup(room, size = 38) {
  const value = clean(room?.icon || room?.name || "mdi:home");
  try {
    return roomVisual(value, size) || root.cdIconMarkup?.(value, size) || esc(value);
  } catch (_error) {
    return esc(value.startsWith("mdi:") ? "🏠" : value || "🏠");
  }
}

function repairRoomRows() {
  if (activeTab() !== "stanze") return false;
  const body = doc?.getElementById("ed-body");
  if (!body) return false;
  const rooms = mergedRooms();
  const rows = [...body.querySelectorAll('.ed-row:has([data-dm-edit-kind="room"][data-dm-edit-index])')];
  rows.forEach((row) => {
    const edit = row.querySelector('[data-dm-edit-kind="room"][data-dm-edit-index]');
    const index = Number.parseInt(edit?.dataset?.dmEditIndex || "-1", 10);
    const room = index >= 0 && index < rooms.length ? rooms[index] : null;
    if (!room) return;
    const name = clean(room.name || room.id || `Stanza ${index + 1}`);
    row.classList.add("dm-room-config-row", "dm-beta11-room-row");
    row.dataset.dmRoomId = clean(room.id);

    let icon = row.querySelector(":scope > .dm-room-list-icon");
    if (!icon) {
      icon = doc.createElement("span");
      icon.className = "dm-room-list-icon";
      row.prepend(icon);
    }
    icon.innerHTML = roomMarkup(room, 38);
    icon.dataset.roomIcon = clean(room.icon || "mdi:home");
    icon.setAttribute("aria-label", name);
    icon.setAttribute("title", name);

    let main = row.querySelector(":scope > .ed-row-main");
    if (!main) {
      main = doc.createElement("div");
      main.className = "ed-row-main";
      icon.after(main);
    }
    let label = main.querySelector(".ed-row-new");
    if (!label) {
      label = doc.createElement("div");
      label.className = "ed-row-new";
      main.prepend(label);
    }
    // Icon and text are separate visual columns. Keeping the glyph out of the
    // label prevents the old emoji from hiding/truncating the configured name.
    label.textContent = name;
    label.dataset.dmRoomName = "true";
    label.setAttribute("title", name);
    const floor = clean(room.floor);
    let floorNode = main.querySelector(".ed-row-old");
    if (floor) {
      if (!floorNode) {
        floorNode = doc.createElement("div");
        floorNode.className = "ed-row-old";
        main.append(floorNode);
      }
      floorNode.textContent = `🏢 ${floor}`;
    }
  });
  return rows.length > 0;
}

function repairRoomCards() {
  const rooms = mergedRooms();
  if (!rooms.length) return false;
  doc?.querySelectorAll?.(".dm-temperature-card[data-room-id]").forEach((card) => {
    const room = rooms.find((item) => clean(item.id) === clean(card.dataset.roomId));
    const target = card.querySelector(".dm-temperature-card-icon");
    if (!room || !target) return;
    target.innerHTML = roomMarkup(room, 42);
    target.dataset.roomIcon = clean(room.icon || "mdi:home");
  });
  return true;
}

function closeAlertPicker() {
  doc?.getElementById("dm-beta11-alert-picker")?.remove();
}

function openAlertPicker(input) {
  if (!input) return;
  closeAlertPicker();
  const modal = doc.createElement("div");
  modal.id = "dm-beta11-alert-picker";
  modal.className = "dm-section-modal dm-beta11-alert-picker";
  const isEnglish = english();
  modal.innerHTML = `<section class="dm-section-dialog dm-beta11-alert-dialog" role="dialog" aria-modal="true" aria-labelledby="dm-beta11-alert-title">
    <header><strong id="dm-beta11-alert-title">🔔 ${isEnglish ? "Choose alert icon" : "Scegli icona avviso"}</strong><button type="button" data-close aria-label="${isEnglish ? "Close" : "Chiudi"}">✕</button></header>
    <div class="dm-beta11-alert-search"><input class="ed-input" type="search" data-search placeholder="🔎 ${isEnglish ? "Search icons…" : "Cerca icona…"}"></div>
    <div class="dm-beta11-alert-grid">${ALERT_ICON_CATALOG.map(([glyph, it, en, keywords]) => `<button type="button" class="dm-beta11-alert-option" data-alert-icon="${esc(glyph)}" data-search-text="${esc(`${it} ${en} ${keywords}`.toLowerCase())}"><span class="dm-beta11-alert-glyph" aria-hidden="true">${esc(glyph)}</span><b>${esc(isEnglish ? en : it)}</b></button>`).join("")}</div>
  </section>`;
  doc.body.append(modal);
  modal.querySelector("[data-close]")?.addEventListener("click", closeAlertPicker);
  modal.addEventListener("click", (event) => { if (event.target === modal) closeAlertPicker(); });
  modal.querySelector("[data-search]")?.addEventListener("input", (event) => {
    const query = clean(event.target.value).toLowerCase();
    modal.querySelectorAll(".dm-beta11-alert-option").forEach((button) => {
      button.hidden = Boolean(query) && !clean(button.dataset.searchText).includes(query);
    });
  });
  modal.querySelectorAll(".dm-beta11-alert-option").forEach((button) => button.addEventListener("click", () => {
    input.value = button.dataset.alertIcon || "🔔";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    decorateAlertIconField();
    closeAlertPicker();
  }));
  root.setTimeout?.(() => modal.querySelector("[data-search]")?.focus(), 20);
}

function decorateAlertIconField() {
  if (activeTab() !== "avvisi") return false;
  const input = doc?.getElementById("ed-avv-icon");
  if (!input) return false;
  const row = input.parentElement;
  if (!row) return false;
  row.classList.add("dm-beta11-alert-icon-row");
  let preview = row.querySelector(".dm-beta11-alert-preview");
  if (!preview) {
    preview = doc.createElement("button");
    preview.type = "button";
    preview.className = "dm-beta11-alert-preview";
    preview.setAttribute("aria-label", english() ? "Choose alert icon" : "Scegli icona avviso");
    row.prepend(preview);
    preview.addEventListener("click", () => openAlertPicker(input));
  }
  preview.textContent = clean(input.value) || "🔔";
  preview.dataset.alertIcon = clean(input.value) || "🔔";
  if (input.dataset.dmBeta11Bound !== "true") {
    input.dataset.dmBeta11Bound = "true";
    input.addEventListener("input", decorateAlertIconField);
    input.addEventListener("change", decorateAlertIconField);
  }
  row.querySelectorAll(".dm-beta5-alert-icon-trigger").forEach((button) => {
    button.dataset.dmBeta11AlertPicker = "true";
    button.textContent = "🎨";
    button.setAttribute("aria-label", english() ? "Open expanded alert icons" : "Apri icone avviso ampliate");
  });
  return true;
}

function normalizeAlertEditModal() {
  const modal = doc?.getElementById("dm-alert-editor-modal");
  if (!modal) return false;
  const preview = modal.querySelector("[data-alert-group-preview]");
  if (preview) preview.classList.add("dm-beta11-alert-group-preview");
  return Boolean(preview);
}

function run() {
  state.frame = 0;
  ensureOwners();
  syncEvPanelToActiveVehicle();
  repairRoomRows();
  repairRoomCards();
  decorateAlertIconField();
  normalizeAlertEditModal();
}

function schedule() {
  if (state.frame) return;
  state.frame = root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 0) || 0;
}

function scheduleAfterLegacyWork() {
  schedule();
  root.setTimeout?.(schedule, 0);
  root.setTimeout?.(schedule, 80);
}

function ensureOwners() {
  for (const name of [
    "editorSwitch",
    "cdEvApplyCar",
    "cdEvCarsRefresh",
    "buildTempCards",
    "cdFillRoomSelects",
    "render",
  ]) wrapFunction(name, "__dmBeta11RealDevicePolish", scheduleAfterLegacyWork);
}

function subscribeStore() {
  if (state.storeUnsubscribe) return;
  const store = dashboardStore();
  if (typeof store?.subscribe !== "function") return;
  state.storeUnsubscribe = store.subscribe((change) => {
    if (["rooms", "ev", "snapshot"].includes(change?.section)) scheduleAfterLegacyWork();
  });
}

function installStyles() {
  installStyle("dm-beta11-real-device-polish-style", `
    /* EV: constrain both remote <img> brands and local inline SVG brands such as
       Leapmotor. Copy and logo use separate grid columns, so no mark can cover
       the selected brand/model text on narrow Home Assistant WebViews. */
    html body #editor-modal #ed-body [data-ev-appearance] .dm-brand-preview[data-dm-beta11-ev-preview="true"]{
      box-sizing:border-box!important;display:grid!important;grid-template-columns:112px minmax(0,1fr)!important;
      grid-template-rows:auto!important;align-items:center!important;justify-items:stretch!important;gap:12px!important;
      width:100%!important;min-height:88px!important;max-height:none!important;padding:12px!important;overflow:hidden!important;
      text-align:left!important
    }
    html body #editor-modal #ed-body [data-ev-appearance] .dm-brand-preview .dm-car-brand,
    html body #editor-modal #ed-body [data-ev-appearance] .dm-brand-preview .dm-leapmotor-mark{
      grid-column:1!important;grid-row:1!important;display:grid!important;place-items:center!important;
      box-sizing:border-box!important;width:108px!important;max-width:108px!important;min-width:0!important;
      height:48px!important;max-height:48px!important;min-height:0!important;margin:0!important;padding:2px 4px!important;
      overflow:hidden!important;transform:none!important
    }
    html body #editor-modal #ed-body [data-ev-appearance] .dm-brand-preview .dm-car-brand img,
    html body #editor-modal #ed-body [data-ev-appearance] .dm-brand-preview .dm-car-brand svg,
    html body #editor-modal #ed-body [data-ev-appearance] .dm-brand-preview .dm-leapmotor-mark svg{
      display:block!important;box-sizing:border-box!important;width:100%!important;max-width:100%!important;
      height:100%!important;max-height:100%!important;object-fit:contain!important;object-position:center!important;
      margin:0!important;padding:0!important;transform:none!important;overflow:hidden!important
    }
    html body #editor-modal #ed-body [data-ev-appearance] .dm-brand-preview .dm-ev-brand-copy{
      grid-column:2!important;grid-row:1!important;display:grid!important;align-content:center!important;gap:3px!important;
      min-width:0!important;max-width:100%!important;margin:0!important;padding:0!important;overflow:hidden!important
    }
    html body #editor-modal #ed-body [data-ev-appearance] .dm-brand-preview .dm-ev-brand-copy b,
    html body #editor-modal #ed-body [data-ev-appearance] .dm-brand-preview .dm-ev-brand-copy small{
      display:block!important;min-width:0!important;max-width:100%!important;visibility:visible!important;opacity:1!important;
      color:var(--primary-text-color,#0f172a)!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important
    }
    html body #editor-modal #ed-body [data-ev-appearance] .dm-brand-preview .dm-ev-brand-copy b{font-size:15px!important;font-weight:900!important;line-height:1.2!important}
    html body #editor-modal #ed-body [data-ev-appearance] .dm-brand-preview .dm-ev-brand-copy small{font-size:12px!important;font-weight:700!important;line-height:1.2!important;color:var(--secondary-text-color,#64748b)!important}
    #dm-visual-picker[data-kind="car"] .dm-leapmotor-mark{display:grid!important;place-items:center!important;width:82px!important;max-width:82px!important;height:44px!important;max-height:44px!important;overflow:hidden!important}
    #dm-visual-picker[data-kind="car"] .dm-leapmotor-mark svg{display:block!important;width:100%!important;max-width:100%!important;height:100%!important;max-height:100%!important;transform:none!important}

    /* Rooms: restore the configured SVG and the configured name as two explicit,
       visible columns. This overrides the blank-middle-column regression seen on
       Samsung/HA WebView while keeping edit/delete targets comfortably tappable. */
    #ed-body .ed-row.dm-room-config-row.dm-beta11-room-row{
      box-sizing:border-box!important;display:grid!important;grid-template-columns:58px minmax(0,1fr) 48px 48px!important;
      grid-template-rows:auto!important;gap:10px!important;align-items:center!important;width:100%!important;min-width:0!important;
      min-height:88px!important;padding:12px 14px!important;overflow:visible!important
    }
    #ed-body .dm-beta11-room-row>.dm-room-list-icon{
      grid-column:1!important;grid-row:1!important;display:grid!important;place-items:center!important;
      box-sizing:border-box!important;width:56px!important;height:56px!important;min-width:56px!important;min-height:56px!important;
      visibility:visible!important;opacity:1!important;border-radius:16px!important;
      background:color-mix(in srgb,var(--primary-color,#0ea5e9) 11%,transparent)!important;
      color:var(--primary-color,#0ea5e9)!important;overflow:hidden!important
    }
    #ed-body .dm-beta11-room-row>.dm-room-list-icon svg,
    #ed-body .dm-beta11-room-row>.dm-room-list-icon ha-icon{
      display:block!important;width:38px!important;max-width:38px!important;height:38px!important;max-height:38px!important;
      visibility:visible!important;opacity:1!important;color:inherit!important;transform:none!important
    }
    #ed-body .dm-beta11-room-row>.ed-row-main{
      grid-column:2!important;grid-row:1!important;display:grid!important;align-content:center!important;gap:4px!important;
      min-width:0!important;width:100%!important;max-width:100%!important;visibility:visible!important;opacity:1!important;
      color:var(--primary-text-color,#0f172a)!important;overflow:visible!important
    }
    #ed-body .dm-beta11-room-row>.ed-row-main>.ed-row-new{
      display:block!important;position:static!important;min-width:0!important;width:auto!important;max-width:100%!important;
      height:auto!important;visibility:visible!important;opacity:1!important;color:var(--primary-text-color,#0f172a)!important;
      font-size:16px!important;font-weight:850!important;line-height:1.25!important;text-align:left!important;
      white-space:normal!important;overflow:visible!important;text-overflow:clip!important;clip:auto!important;transform:none!important
    }
    #ed-body .dm-beta11-room-row>.ed-row-main>.ed-row-old{
      display:block!important;position:static!important;visibility:visible!important;opacity:1!important;
      color:var(--secondary-text-color,#64748b)!important;font-size:11px!important;line-height:1.2!important;
      white-space:normal!important;overflow:visible!important
    }
    #ed-body .dm-beta11-room-row>[data-dm-edit-kind="room"]{grid-column:3!important;grid-row:1!important}
    #ed-body .dm-beta11-room-row>.ed-del:last-child{grid-column:4!important;grid-row:1!important}

    /* Alerts: same rounded, airy visual language as the rest of the editor, but
       with a much larger semantic catalog than the old generic icon dialog. */
    #ed-body .dm-beta11-alert-icon-row{display:grid!important;grid-template-columns:64px minmax(0,1fr) 52px!important;gap:10px!important;align-items:center!important;min-width:0!important;width:100%!important}
    #ed-body .dm-beta11-alert-preview{
      display:grid!important;place-items:center!important;width:64px!important;height:64px!important;margin:0!important;padding:0!important;
      border:1px solid color-mix(in srgb,var(--info-color,#0ea5e9) 28%,var(--divider-color,#dbe4ee))!important;
      border-radius:18px!important;background:color-mix(in srgb,var(--info-color,#0ea5e9) 10%,var(--card-background-color,#fff))!important;
      color:var(--primary-text-color,#0f172a)!important;font-family:Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif!important;
      font-size:32px!important;line-height:1!important;cursor:pointer!important
    }
    #ed-body .dm-beta11-alert-icon-row>#ed-avv-icon{min-width:0!important;width:100%!important;grid-column:2!important}
    #ed-body .dm-beta11-alert-icon-row>.dm-beta5-alert-icon-trigger{grid-column:3!important;position:static!important;width:52px!important;height:52px!important;margin:0!important;transform:none!important}
    .dm-beta11-alert-dialog{width:min(720px,calc(100vw - 24px))!important;max-height:min(82vh,760px)!important;overflow:hidden!important}
    .dm-beta11-alert-search{padding:14px 16px 8px!important}
    .dm-beta11-alert-grid{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:10px!important;padding:8px 16px 18px!important;max-height:60vh!important;overflow:auto!important}
    .dm-beta11-alert-option{display:grid!important;grid-template-rows:48px auto!important;place-items:center!important;gap:7px!important;box-sizing:border-box!important;min-width:0!important;min-height:94px!important;padding:10px 7px!important;border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:16px!important;background:var(--card-background-color,#fff)!important;color:var(--primary-text-color,#0f172a)!important;cursor:pointer!important;text-align:center!important}
    .dm-beta11-alert-option:hover,.dm-beta11-alert-option:focus-visible{border-color:var(--info-color,#0ea5e9)!important;box-shadow:0 0 0 3px color-mix(in srgb,var(--info-color,#0ea5e9) 14%,transparent)!important;outline:none!important}
    .dm-beta11-alert-option[hidden]{display:none!important}
    .dm-beta11-alert-glyph{display:grid!important;place-items:center!important;width:48px!important;height:48px!important;border-radius:14px!important;background:color-mix(in srgb,var(--info-color,#0ea5e9) 9%,transparent)!important;font-family:Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif!important;font-size:31px!important;line-height:1!important}
    .dm-beta11-alert-option b{min-width:0!important;max-width:100%!important;font-size:11px!important;font-weight:800!important;line-height:1.15!important;white-space:normal!important;overflow-wrap:anywhere!important}
    #dm-alert-editor-modal .dm-alert-group-preview.dm-beta11-alert-group-preview{font-family:Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif!important;font-size:34px!important;background:color-mix(in srgb,var(--info-color,#0ea5e9) 10%,var(--card-background-color,#fff))!important}

    @media(max-width:620px){
      html body #editor-modal #ed-body [data-ev-appearance] .dm-brand-preview[data-dm-beta11-ev-preview="true"]{grid-template-columns:96px minmax(0,1fr)!important;gap:10px!important;min-height:82px!important;padding:10px!important}
      html body #editor-modal #ed-body [data-ev-appearance] .dm-brand-preview .dm-car-brand,
      html body #editor-modal #ed-body [data-ev-appearance] .dm-brand-preview .dm-leapmotor-mark{width:92px!important;max-width:92px!important;height:44px!important;max-height:44px!important}
      #ed-body .ed-row.dm-room-config-row.dm-beta11-room-row{grid-template-columns:54px minmax(0,1fr) 46px 46px!important;gap:8px!important;padding:10px 11px!important;min-height:82px!important}
      #ed-body .dm-beta11-room-row>.dm-room-list-icon{width:52px!important;height:52px!important;min-width:52px!important;min-height:52px!important}
      #ed-body .dm-beta11-room-row>.dm-room-list-icon svg,#ed-body .dm-beta11-room-row>.dm-room-list-icon ha-icon{width:35px!important;max-width:35px!important;height:35px!important;max-height:35px!important}
      .dm-beta11-alert-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important;padding:8px 12px 16px!important}
      .dm-beta11-alert-option{min-height:88px!important;padding:8px 5px!important}
    }
  `);
}

function install() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  ensureOwners();
  subscribeStore();
  if (!state.listeners) {
    state.listeners = true;
    doc.addEventListener("click", (event) => {
      const legacyAlertPicker = event.target?.closest?.(".dm-beta5-alert-icon-trigger[data-dm-beta11-alert-picker='true']");
      if (legacyAlertPicker) {
        const input = legacyAlertPicker.closest(".dm-beta11-alert-icon-row")?.querySelector("#ed-avv-icon");
        if (input) {
          event.preventDefault();
          event.stopImmediatePropagation();
          openAlertPicker(input);
          return;
        }
      }
      if (event.target?.closest?.(".ed-tab,.dm-vehicle-profile-card,[data-dm-alert-edit]")) scheduleAfterLegacyWork();
    }, true);
    doc.addEventListener("change", (event) => {
      if (event.target?.closest?.("#editor-modal,#ed-body")) scheduleAfterLegacyWork();
    }, true);
    root.addEventListener?.("dashboardmodern:legacy-ready", scheduleAfterLegacyWork);
  }
  scheduleAfterLegacyWork();
}

if (doc?.readyState === "loading") doc.addEventListener("DOMContentLoaded", install, { once: true });
else install();
