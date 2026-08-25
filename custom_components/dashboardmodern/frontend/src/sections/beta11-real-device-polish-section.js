import { clean, dashboardStore, doc, installStyle, readJson, root, t, wrapFunction } from "./shared.js";

// Compatibility owner kept temporarily while EV and Alerts are absorbed by their
// canonical sections. Room/Temperature icon DOM is single-owner: this module may
// decorate metadata and labels, but it must never repaint icon children.
globalThis.__DM_20260815C__ = true;
const KEY = "__DASHBOARDMODERN_BETA11_REAL_DEVICE_POLISH__";
const state = (root[KEY] ||= {
  installed: false,
  frame: 0,
  listeners: false,
  storeUnsubscribe: null,
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

function activeTab() {
  return clean(doc?.querySelector(".ed-tab.active")?.dataset?.tab);
}

function queueMicrotaskSafe(callback) {
  if (typeof root.queueMicrotask === "function") root.queueMicrotask(callback);
  else Promise.resolve().then(callback);
}

function vehicles() {
  const legacy = readJson("cd_ev_cars", []);
  if (Array.isArray(legacy) && legacy.length) return legacy;
  try {
    const canonical = dashboardStore()?.getSection?.("ev");
    return Array.isArray(canonical) ? canonical : [];
  } catch (_error) {
    return [];
  }
}

function activeVehicleIndex(cars = vehicles()) {
  if (!cars.length) return -1;
  const raw = Number.parseInt(root.localStorage?.getItem("cd_ev_car_active") || "0", 10);
  const index = Number.isFinite(raw) ? raw : 0;
  return Math.max(0, Math.min(cars.length - 1, index));
}

function hasOption(select, value) {
  const wanted = clean(value);
  return Boolean(wanted) && [...(select?.options || [])].some((option) => clean(option.value) === wanted);
}

function dispatchValue(input, value, { force = false } = {}) {
  if (!input) return false;
  const changed = clean(input.value) !== clean(value);
  if (changed) input.value = value;
  if (changed || force) {
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }
  return changed || force;
}

function normalizeEvPreview(panel) {
  const preview = panel?.querySelector?.("[data-brand-preview]");
  const brandSelect = panel?.querySelector?.("select[data-brand]");
  const modelSelect = panel?.querySelector?.("select[data-model]");
  if (!preview || !brandSelect || !modelSelect) return false;
  preview.dataset.dmBeta11EvPreview = "true";
  preview.dataset.dmBeta11Brand = clean(brandSelect.value).toLowerCase();
  preview
    .querySelector(".dm-car-brand,.dm-leapmotor-mark")
    ?.setAttribute?.("data-dm-beta11-logo", "true");
  const copy = preview.querySelector(".dm-ev-brand-copy");
  if (copy) {
    copy.dataset.dmBeta11Copy = "true";
    copy.querySelector("b")?.setAttribute("title", clean(brandSelect.value));
    copy.querySelector("small")?.setAttribute("title", clean(modelSelect.value));
  }
  return true;
}

function syncEvPanelToActiveVehicle() {
  if (activeTab() !== "sez2") return false;
  const panel = doc?.querySelector?.("#ed-body [data-ev-appearance]");
  const brandSelect = panel?.querySelector?.("select[data-brand]");
  const modelSelect = panel?.querySelector?.("select[data-model]");
  if (!panel || !brandSelect || !modelSelect) return false;

  const cars = vehicles();
  const index = activeVehicleIndex(cars);
  const car = index >= 0 ? cars[index] : null;
  if (!car) return false;
  const brand = clean(car.brand);
  const model = clean(car.model || car.vehicle_model || car.name);
  const identity = clean(car.id || car.entity || car.name || index);
  const signature = `${index}|${identity}|${brand}|${model}`;
  const sameVehicle = panel.dataset.dmBeta11VehicleIndex === String(index);

  // A manual brand/model choice belongs to the editor draft. Do not let the
  // compatibility synchronizer overwrite it until the active vehicle changes.
  if (panel.dataset.dmBeta11ManualEdit === "true" && sameVehicle) {
    normalizeEvPreview(panel);
    return true;
  }
  if (panel.dataset.dmBeta11ManualEdit === "true" && !sameVehicle) {
    delete panel.dataset.dmBeta11ManualEdit;
  }
  if (panel.dataset.dmBeta11VehicleSignature === signature) {
    normalizeEvPreview(panel);
    return true;
  }

  panel.dataset.dmBeta11Syncing = "true";
  if (brand && hasOption(brandSelect, brand)) {
    dispatchValue(brandSelect, brand, { force: true });
  }
  queueMicrotaskSafe(() => {
    if (model && hasOption(modelSelect, model)) dispatchValue(modelSelect, model);
    panel.dataset.dmBeta11VehicleSignature = signature;
    panel.dataset.dmBeta11VehicleIndex = String(index);
    delete panel.dataset.dmBeta11ManualEdit;
    delete panel.dataset.dmBeta11Syncing;
    normalizeEvPreview(panel);
  });
  return true;
}

function markManualEvEdit(event) {
  const input = event.target;
  if (!input?.matches?.("[data-ev-appearance] select[data-brand],[data-ev-appearance] select[data-model]")) {
    return false;
  }
  const panel = input.closest("[data-ev-appearance]");
  if (!panel || panel.dataset.dmBeta11Syncing === "true") return false;
  panel.dataset.dmBeta11ManualEdit = "true";
  normalizeEvPreview(panel);
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
    const fallback =
      canonical.find((candidate) => id && clean(candidate?.id) === id) ||
      canonical.find((candidate) => name && clean(candidate?.name).toLowerCase() === name) ||
      canonical[index] ||
      {};
    return { ...fallback, ...room };
  });
}

function decorateRoomRows() {
  if (activeTab() !== "stanze") return false;
  const rooms = mergedRooms();
  const rows = [
    ...(doc?.querySelectorAll?.(
      '#ed-body .ed-row:has([data-dm-edit-kind="room"][data-dm-edit-index])',
    ) || []),
  ];
  rows.forEach((row) => {
    const edit = row.querySelector('[data-dm-edit-kind="room"][data-dm-edit-index]');
    const index = Number.parseInt(edit?.dataset?.dmEditIndex || "-1", 10);
    const room = index >= 0 ? rooms[index] : null;
    if (!room) return;
    const name = clean(room.name || room.id || `Stanza ${index + 1}`);
    row.classList.add("dm-room-config-row", "dm-beta11-room-row");
    row.dataset.dmRoomId = clean(room.id);

    const icon = row.querySelector(":scope > .dm-room-list-icon");
    if (icon) {
      icon.dataset.roomIcon = clean(room.icon || icon.dataset.roomIcon || "mdi:home");
      icon.setAttribute("aria-label", name);
      icon.setAttribute("title", name);
    }

    const label = row.querySelector(".ed-row-new");
    if (label) {
      const main = label.closest(".ed-row-main");
      if (main) {
        main.hidden = false;
        main.removeAttribute("hidden");
        main.removeAttribute("aria-hidden");
      }
      label.hidden = false;
      label.removeAttribute("hidden");
      label.removeAttribute("aria-hidden");
      label.textContent = name;
      label.dataset.dmRoomName = "true";
      label.setAttribute("title", name);
    }
  });
  root.DashboardModernIconEngine?.syncEditor?.();
  return rows.length > 0;
}

function closeAlertPicker() {
  doc?.getElementById("dm-beta11-alert-picker")?.remove();
}

function openAlertPicker(input) {
  if (!input || !doc) return false;
  closeAlertPicker();
  const modal = doc.createElement("div");
  modal.id = "dm-beta11-alert-picker";
  modal.className = "dm-section-modal dm-beta11-alert-picker";
  modal.innerHTML = `<section class="dm-section-dialog dm-beta11-alert-dialog" role="dialog" aria-modal="true"><header><strong>🔔 ${t("Scegli icona avviso", "Choose alert icon")}</strong><button type="button" data-close>✕</button></header><div class="dm-beta11-alert-search"><input class="ed-input" type="search" data-search placeholder="🔎 ${t("Cerca icona…", "Search icons…")}"></div><div class="dm-beta11-alert-grid">${ALERT_ICON_CATALOG.map(([glyph, it, en, keywords]) => `<button type="button" class="dm-beta11-alert-option" data-alert-icon="${glyph}" data-search-text="${`${it} ${en} ${keywords}`.toLowerCase()}"><span class="dm-beta11-alert-glyph" aria-hidden="true">${glyph}</span><b>${t(it, en)}</b></button>`).join("")}</div></section>`;
  doc.body.append(modal);
  const close = () => modal.remove();
  modal.querySelector("[data-close]")?.addEventListener("click", close);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });
  modal.querySelector("[data-search]")?.addEventListener("input", (event) => {
    const query = clean(event.target.value).toLowerCase();
    modal.querySelectorAll(".dm-beta11-alert-option").forEach((button) => {
      button.hidden = Boolean(query) && !clean(button.dataset.searchText).includes(query);
    });
  });
  modal.querySelectorAll(".dm-beta11-alert-option").forEach((button) =>
    button.addEventListener("click", () => {
      input.value = button.dataset.alertIcon || "🔔";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      close();
    }),
  );
  return true;
}

function decorateAlertIconField() {
  // Gli avvisi vivono in fondo alla scheda dei widget: quello che conta e'
  // che la loro casella sia in scena, non da che linguetta ci si arriva.
  const input = doc?.getElementById("ed-avv-icon");
  const row = input?.parentElement;
  if (!input || !row) return false;
  row.classList.add("dm-beta11-alert-icon-row");
  let preview = row.querySelector(".dm-beta11-alert-preview");
  if (!preview) {
    preview = doc.createElement("button");
    preview.type = "button";
    preview.className = "dm-beta11-alert-preview";
    preview.setAttribute("aria-label", t("Scegli icona avviso", "Choose alert icon"));
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
  });
  return true;
}

function run() {
  state.frame = 0;
  ensureOwners();
  syncEvPanelToActiveVehicle();
  decorateRoomRows();
  decorateAlertIconField();
}

function schedule() {
  if (state.frame) return;
  state.frame = root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 0) || 0;
}

function ensureOwners() {
  for (const name of ["editorSwitch", "cdEvApplyCar", "cdEvCarsRefresh"])
    wrapFunction(name, "__dmBeta11Compatibility", schedule);
}

function subscribeStore() {
  if (state.storeUnsubscribe) return;
  const store = dashboardStore();
  if (typeof store?.subscribe !== "function") return;
  state.storeUnsubscribe = store.subscribe((change) => {
    if (["rooms", "ev", "snapshot"].includes(change?.section)) schedule();
  });
}

function installStyles() {
  installStyle(
    "dm-beta11-real-device-polish-style",
    `
    html body #editor-modal #ed-body [data-ev-appearance] .dm-brand-preview[data-dm-beta11-ev-preview="true"]{box-sizing:border-box!important;display:grid!important;grid-template-columns:112px minmax(0,1fr)!important;align-items:center!important;gap:12px!important;width:100%!important;min-height:88px!important;padding:12px!important;overflow:hidden!important;text-align:left!important}
    html body #editor-modal #ed-body [data-ev-appearance] .dm-brand-preview .dm-car-brand,html body #editor-modal #ed-body [data-ev-appearance] .dm-brand-preview .dm-leapmotor-mark{display:grid!important;place-items:center!important;box-sizing:border-box!important;width:108px!important;max-width:108px!important;height:48px!important;max-height:48px!important;overflow:hidden!important;transform:none!important}
    html body #editor-modal #ed-body [data-ev-appearance] .dm-brand-preview .dm-car-brand img,html body #editor-modal #ed-body [data-ev-appearance] .dm-brand-preview .dm-car-brand svg,html body #editor-modal #ed-body [data-ev-appearance] .dm-brand-preview .dm-leapmotor-mark svg{display:block!important;width:100%!important;max-width:100%!important;height:100%!important;max-height:100%!important;object-fit:contain!important;object-position:center!important;transform:none!important}
    #ed-body .ed-row.dm-room-config-row.dm-beta11-room-row{box-sizing:border-box!important;display:grid!important;grid-template-columns:58px minmax(0,1fr) 48px 48px!important;gap:10px!important;align-items:center!important;width:100%!important;min-height:88px!important;padding:12px 14px!important;overflow:visible!important}
    #ed-body .dm-beta11-room-row>.dm-room-list-icon{grid-column:1!important;grid-row:1!important;display:grid!important;place-items:center!important;width:56px!important;height:56px!important;min-width:56px!important;min-height:56px!important;visibility:visible!important;opacity:1!important;border-radius:16px!important;background:color-mix(in srgb,var(--primary-color,#0ea5e9) 11%,transparent)!important;overflow:hidden!important}
    #ed-body .dm-beta11-room-row>.ed-row-main{grid-column:2!important;grid-row:1!important;display:grid!important;position:static!important;align-content:center!important;gap:4px!important;min-width:0!important;width:100%!important;height:auto!important;max-height:none!important;visibility:visible!important;opacity:1!important;overflow:visible!important}
    #ed-body .dm-beta11-room-row .ed-row-new{display:block!important;position:static!important;min-width:0!important;width:auto!important;max-width:100%!important;height:auto!important;min-height:1em!important;visibility:visible!important;opacity:1!important;color:var(--text,#0f172a)!important;font-size:16px!important;font-weight:850!important;line-height:1.25!important;text-align:left!important;white-space:normal!important;overflow:visible!important;text-overflow:clip!important;clip:auto!important;clip-path:none!important;transform:none!important}
    #ed-body .dm-beta11-room-row>[data-dm-edit-kind="room"]{grid-column:3!important;grid-row:1!important}
    #ed-body .dm-beta11-room-row>.ed-del:last-child{grid-column:4!important;grid-row:1!important}
    #ed-body .dm-beta11-alert-icon-row{display:grid!important;grid-template-columns:64px minmax(0,1fr) 52px!important;gap:10px!important;align-items:center!important;min-width:0!important;width:100%!important}
    #ed-body .dm-beta11-alert-preview{display:grid!important;place-items:center!important;width:64px!important;height:64px!important;border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:18px!important;background:var(--card-background-color,#fff)!important;font-size:32px!important;cursor:pointer!important}
    #ed-body .dm-beta11-alert-icon-row>#ed-avv-icon{min-width:0!important;width:100%!important;grid-column:2!important}
    #ed-body .dm-beta11-alert-icon-row>.dm-beta5-alert-icon-trigger{grid-column:3!important;position:static!important;width:52px!important;height:52px!important;margin:0!important;transform:none!important}
    .dm-beta11-alert-dialog{width:min(720px,calc(100vw - 24px))!important;max-height:min(82vh,760px)!important;overflow:hidden!important}.dm-beta11-alert-search{padding:14px 16px 8px!important}.dm-beta11-alert-grid{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:10px!important;padding:8px 16px 18px!important;max-height:60vh!important;overflow:auto!important}.dm-beta11-alert-option{display:grid!important;grid-template-rows:48px auto!important;place-items:center!important;gap:7px!important;min-height:94px!important;padding:10px 7px!important;border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:16px!important;background:var(--card-background-color,#fff)!important;cursor:pointer!important}.dm-beta11-alert-option[hidden]{display:none!important}.dm-beta11-alert-glyph{font-size:31px!important}.dm-beta11-alert-option b{font-size:11px!important;text-align:center!important}
    @media(max-width:560px){html body #editor-modal #ed-body [data-ev-appearance] .dm-brand-preview[data-dm-beta11-ev-preview="true"]{grid-template-columns:92px minmax(0,1fr)!important;gap:9px!important;padding:10px!important}html body #editor-modal #ed-body [data-ev-appearance] .dm-brand-preview .dm-car-brand,html body #editor-modal #ed-body [data-ev-appearance] .dm-brand-preview .dm-leapmotor-mark{width:88px!important;max-width:88px!important;height:44px!important;max-height:44px!important}#ed-body .ed-row.dm-room-config-row.dm-beta11-room-row{grid-template-columns:56px minmax(0,1fr) 46px 46px!important;gap:8px!important;padding:11px 10px!important}.dm-beta11-alert-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important}}
  `,
  );
}

function install() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  ensureOwners();
  subscribeStore();
  if (!state.listeners) {
    state.listeners = true;
    doc.addEventListener(
      "click",
      (event) => {
        const trigger = event.target?.closest?.(
          ".dm-beta5-alert-icon-trigger[data-dm-beta11-alert-picker='true']",
        );
        if (trigger) {
          const input = trigger.closest(".dm-beta11-alert-icon-row")?.querySelector("#ed-avv-icon");
          if (input) {
            event.preventDefault();
            event.stopImmediatePropagation();
            openAlertPicker(input);
            return;
          }
        }
        if (event.target?.closest?.(".dm-vehicle-profile-card")) {
          const panel = doc.querySelector("#ed-body [data-ev-appearance]");
          if (panel) delete panel.dataset.dmBeta11ManualEdit;
        }
        if (event.target?.closest?.(".ed-tab,.dm-vehicle-profile-card")) schedule();
      },
      true,
    );
    doc.addEventListener(
      "change",
      (event) => {
        markManualEvEdit(event);
        if (event.target?.closest?.("#editor-modal,#ed-body")) schedule();
      },
      true,
    );
    root.addEventListener?.("dashboardmodern:legacy-ready", schedule);
  }
  schedule();
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", install, { once: true });
} else {
  install();
}
