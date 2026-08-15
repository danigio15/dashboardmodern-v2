import { allStates, clean, dashboardStore, doc, installStyle, root, t } from "./shared.js";

globalThis.__DM_20260815C__ = true;
const KEY = "__DASHBOARDMODERN_SHUTTER_SECTION__";
const state = (root[KEY] ||= {
  installed: false,
  frame: 0,
  storeUnsubscribe: null,
  busy: new Map(),
  createdContainer: false,
});

function covers() {
  const values = dashboardStore()?.getSection?.("covers") || [];
  return Array.isArray(values) ? values : [];
}

function coverEntity(cover = {}) {
  return clean(cover.entity || cover.entities?.[0]);
}

function eventEntityIds(event) {
  const values = event?.detail?.entity_ids || [event?.detail?.entity_id];
  return new Set((Array.isArray(values) ? values : [values]).map(clean).filter(Boolean));
}

function configuredCoverEntityIds() {
  return new Set(covers().map(coverEntity).filter(Boolean));
}

export function stateChangeAffectsShutters(event) {
  const changed = eventEntityIds(event);
  if (!changed.size) return false;
  const configured = configuredCoverEntityIds();
  return [...changed].some((id) => configured.has(id));
}

function openCovers() {
  const states = allStates();
  const rooms = dashboardStore()?.getSection?.("rooms") || [];
  return covers().flatMap((cover) => {
    const entity = coverEntity(cover);
    const current = states[entity];
    if (!entity || !current) return [];
    const status = clean(current.state).toLowerCase();
    const rawPosition = current.attributes?.current_position;
    const position = rawPosition == null ? null : Number(rawPosition);
    const open =
      status === "open" ||
      status === "opening" ||
      status === "closing" ||
      (Number.isFinite(position) && position > 0);
    if (!open) return [];
    const roomValue = clean(cover.room_id || cover.room);
    const room = rooms.find(
      (item) => clean(item.id) === roomValue || clean(item.name) === roomValue,
    );
    return [{
      entity,
      status,
      position: Number.isFinite(position) ? position : null,
      room,
      name: clean(cover.name) || clean(current.attributes?.friendly_name) || entity,
      icon: clean(cover.icon || current.attributes?.icon),
    }];
  });
}

function ensureAlertContainer() {
  let container = doc?.getElementById("tapp-avvisi");
  if (container) return container;
  const anchor =
    doc?.getElementById("glance-luci") ||
    doc?.querySelector("#page-home .glance-card,#home .glance-card,.dm-home-summary .glance-card");
  const parent =
    anchor?.parentElement ||
    doc?.querySelector("#page-home .glance-grid,#home .glance-grid,.dm-home-summary .glance-grid");
  if (!parent) return null;
  container = doc.createElement("div");
  container.id = "tapp-avvisi";
  container.className = "dm-shutter-alert-host";
  parent.append(container);
  state.createdContainer = true;
  return container;
}

function closePopup() {
  const popup = doc?.getElementById("dm-shutter-popup");
  if (!popup) return;
  popup.classList.remove("show");
  popup.remove();
}

function statusLabel(item) {
  if (item.status === "opening") return t("In apertura", "Opening");
  if (item.status === "closing") return t("In chiusura", "Closing");
  return t("Aperta", "Open");
}

function actionLabel(service, busy = false) {
  if (busy) {
    if (service === "close_cover") return t("Chiusura…", "Closing…");
    if (service === "open_cover") return t("Apertura…", "Opening…");
    return t("Arresto…", "Stopping…");
  }
  if (service === "close_cover") return t("Chiudi", "Close");
  if (service === "open_cover") return t("Apri", "Open");
  return t("Ferma", "Stop");
}

function clearBusy(entity) {
  const pending = state.busy.get(entity);
  if (!pending) return false;
  if (pending.timeout) root.clearTimeout?.(pending.timeout);
  state.busy.delete(entity);
  return true;
}

async function callCoverService(entity, service) {
  if (!entity || state.busy.has(entity)) return;
  const pending = { service, timeout: 0 };
  state.busy.set(entity, pending);
  scheduleShutterSync();
  try {
    await root.dmCallHaService?.("cover", service, { entity_id: entity });
    pending.timeout = root.setTimeout?.(() => {
      if (state.busy.get(entity) !== pending) return;
      state.busy.delete(entity);
      scheduleShutterSync();
    }, 10000) || 0;
  } catch (error) {
    clearBusy(entity);
    scheduleShutterSync();
    root.console?.error?.("[DashboardModern] shutter service", error);
  }
}

function createPopupRow(item) {
  const row = doc.createElement("article");
  row.className = "detail-row dm-shutter-popup-row";
  row.dataset.shutterEntity = item.entity;
  row.innerHTML = `<div class="d-icon dm-shutter-row-icon" aria-hidden="true">🪟</div><div class="d-info dm-shutter-details"><div class="d-name"></div><div class="d-state"></div></div><div class="dm-shutter-actions"></div>`;
  const actions = row.querySelector(".dm-shutter-actions");
  for (const service of ["open_cover", "stop_cover", "close_cover"]) {
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "dm-shutter-action";
    button.dataset.shutterService = service;
    button.addEventListener("click", () => callCoverService(item.entity, service));
    actions.append(button);
  }
  return row;
}

function updatePopupRow(row, item) {
  const icon = row.querySelector(".dm-shutter-row-icon");
  if (icon) {
    icon.dataset.icon = item.icon || "mdi:window-shutter";
    icon.textContent = "🪟";
  }
  const name = row.querySelector(".dm-shutter-details .d-name");
  if (name) name.textContent = item.name;
  const detail = [item.room?.name, statusLabel(item)];
  if (item.position != null) detail.push(`${Math.round(item.position)}%`);
  const status = row.querySelector(".dm-shutter-details .d-state");
  if (status) status.textContent = detail.filter(Boolean).join(" · ");

  const pending = state.busy.get(item.entity);
  row.querySelectorAll("[data-shutter-service]").forEach((button) => {
    const service = button.dataset.shutterService;
    const busy = pending?.service === service;
    button.disabled = Boolean(pending);
    button.textContent = actionLabel(service, busy);
  });
}

function renderPopupRows(popup, items) {
  const list = popup?.querySelector("[data-shutter-list]");
  if (!list) return;
  const existing = new Map(
    [...list.querySelectorAll(".dm-shutter-popup-row")].map((row) => [row.dataset.shutterEntity, row]),
  );
  const rows = items.map((item) => {
    const row = existing.get(item.entity) || createPopupRow(item);
    updatePopupRow(row, item);
    existing.delete(item.entity);
    return row;
  });
  existing.forEach((row) => row.remove());
  list.replaceChildren(...rows);
}

function openPopup() {
  const items = openCovers();
  if (!items.length) return;
  let popup = doc.getElementById("dm-shutter-popup");
  if (!popup) {
    popup = doc.createElement("div");
    popup.id = "dm-shutter-popup";
    popup.className = "modal-wrapper dm-shutter-popup";
    popup.setAttribute("role", "presentation");
    popup.innerHTML = `<div class="modal-card details-content dm-shutter-popup-card" role="dialog" aria-modal="true" aria-labelledby="dm-shutter-popup-title"><div class="ev-waw-header dm-shutter-popup-header"><h3 class="ev-waw-title" id="dm-shutter-popup-title"><span class="dm-shutter-title-icon" aria-hidden="true">🪟</span><span>${t("Tapparelle aperte", "Open shutters")}</span></h3><button type="button" class="ev-waw-close dm-shutter-popup-close" data-shutter-popup-close aria-label="${t("Chiudi", "Close")}">✕</button></div><div class="details-list dm-shutter-popup-list" data-shutter-list></div></div>`;
    doc.body.append(popup);
    popup.querySelector("[data-shutter-popup-close]")?.addEventListener("click", closePopup);
    popup.addEventListener("click", (event) => {
      if (event.target === popup) closePopup();
    });
    popup.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closePopup();
    });
  }
  renderPopupRows(popup, items);
  popup.classList.add("show");
  popup.querySelector("[data-shutter-popup-close]")?.focus?.({ preventScroll: true });
}

function ensureAlert(items) {
  const container = ensureAlertContainer();
  if (!container) return false;
  let alert = container.querySelector(".dm-shutter-alert");
  if (!alert) {
    alert = doc.createElement("article");
    alert.className = "glance-card dm-shutter-alert";
    alert.dataset.accent = "warning";
    alert.setAttribute("role", "button");
    alert.setAttribute("tabindex", "0");
    alert.innerHTML = `<div class="g-info"><div class="g-name"></div><div class="g-val"></div></div><div class="g-icon-wrap anim-ping" aria-hidden="true">🪟</div>`;
    const activate = (event) => {
      if (event.type === "keydown" && !["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      openPopup();
    };
    alert.addEventListener("click", activate);
    alert.addEventListener("keydown", activate);
    container.append(alert);
  }
  const title = alert.querySelector(".g-name");
  const count = alert.querySelector(".g-val");
  if (title) title.textContent =
    items.length === 1
      ? t("TAPPARELLA APERTA", "SHUTTER OPEN")
      : t("TAPPARELLE APERTE", "SHUTTERS OPEN");
  if (count) count.textContent = String(items.length);
  return true;
}

export function syncShutterSection() {
  if (!doc) return false;
  const items = openCovers();
  if (!items.length) {
    doc.querySelector("#tapp-avvisi .dm-shutter-alert")?.remove();
    closePopup();
    if (state.createdContainer && !doc.querySelector("#tapp-avvisi > *")) {
      doc.getElementById("tapp-avvisi")?.remove();
      state.createdContainer = false;
    }
    return false;
  }
  ensureAlert(items);
  const popup = doc.getElementById("dm-shutter-popup");
  if (popup) renderPopupRows(popup, items);
  return true;
}

export function scheduleShutterSync() {
  if (state.frame) return;
  const run = () => {
    state.frame = 0;
    syncShutterSection();
  };
  state.frame = root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 0) || 0;
}

function subscribeStore() {
  const store = dashboardStore();
  if (state.storeUnsubscribe || !store?.subscribe) return;
  state.storeUnsubscribe = store.subscribe((change) => {
    if (["covers", "rooms", "snapshot"].includes(change?.section)) scheduleShutterSync();
  });
}

function installStyles() {
  installStyle("dm-shutter-section-style", `
    .dm-shutter-alert-host{display:contents!important}
    .dm-shutter-alert{box-sizing:border-box!important;width:100%!important;min-width:0!important;cursor:pointer!important;--g-rgb:225,29,72}
    .dm-shutter-alert:focus-visible{outline:3px solid var(--accent-color,var(--accent,#0ea5e9))!important;outline-offset:3px!important}
    .dm-shutter-popup{display:flex!important;align-items:center!important;justify-content:center!important;padding:18px!important;background:rgba(15,23,42,.55)!important;backdrop-filter:blur(5px)!important}
    .dm-shutter-popup-card{box-sizing:border-box!important;width:min(680px,100%)!important;max-width:680px!important;max-height:min(760px,92dvh)!important;border-radius:24px!important;overflow:hidden!important;background:var(--ha-card-background,var(--card-bg,#fff))!important;box-shadow:0 24px 70px rgba(15,23,42,.30)!important}
    .dm-shutter-popup-header{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:14px!important;min-height:68px!important;padding:14px 18px!important;border-bottom:1px solid var(--divider-color,var(--card-border,#dbe4ee))!important}
    .dm-shutter-popup-header .ev-waw-title{display:flex!important;align-items:center!important;gap:10px!important;margin:0!important;font-size:20px!important;font-weight:900!important;text-transform:none!important;letter-spacing:0!important}
    .dm-shutter-title-icon{display:grid!important;place-items:center!important;width:38px!important;height:38px!important;border-radius:12px!important;background:color-mix(in srgb,var(--accent-color,var(--accent,#0ea5e9)) 14%,transparent)!important;font-size:21px!important}
    .dm-shutter-popup-close{display:grid!important;place-items:center!important;flex:0 0 42px!important;width:42px!important;height:42px!important;min-width:42px!important;margin:0!important;padding:0!important;border:1px solid var(--divider-color,var(--card-border,#dbe4ee))!important;border-radius:50%!important;background:var(--secondary-background-color,var(--surface-2,#f8fafc))!important;color:var(--text,#0f172a)!important;font-size:18px!important;cursor:pointer!important}
    .dm-shutter-popup-list{display:grid!important;gap:10px!important;max-height:min(68dvh,620px)!important;overflow:auto!important;padding:14px!important}
    .dm-shutter-popup-row{display:grid!important;grid-template-columns:48px minmax(0,1fr) minmax(210px,280px)!important;align-items:center!important;gap:12px!important;box-sizing:border-box!important;padding:12px!important;border:1px solid var(--divider-color,var(--card-border,#dbe4ee))!important;border-radius:16px!important;background:var(--secondary-background-color,var(--surface-2,#f8fafc))!important}
    .dm-shutter-row-icon{display:grid!important;place-items:center!important;width:44px!important;height:44px!important;border-radius:13px!important;background:color-mix(in srgb,var(--accent-color,var(--accent,#0ea5e9)) 13%,transparent)!important;font-size:22px!important}
    .dm-shutter-details{min-width:0!important}.dm-shutter-details .d-name,.dm-shutter-details .d-state{overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}.dm-shutter-details .d-name{font-weight:900!important}.dm-shutter-details .d-state{margin-top:3px!important;color:var(--secondary-text-color,var(--text-dim,#64748b))!important;font-size:12px!important}
    .dm-shutter-actions{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px!important}
    .dm-shutter-actions button{box-sizing:border-box!important;width:100%!important;min-width:0!important;min-height:38px!important;margin:0!important;padding:7px 9px!important;border:1px solid color-mix(in srgb,var(--accent-color,var(--accent,#0ea5e9)) 28%,var(--divider-color,#dbe4ee))!important;border-radius:10px!important;background:color-mix(in srgb,var(--accent-color,var(--accent,#0ea5e9)) 10%,var(--ha-card-background,#fff))!important;color:var(--text,#0f172a)!important;font-size:12px!important;font-weight:850!important;box-shadow:none!important;cursor:pointer!important}
    .dm-shutter-actions button[data-shutter-service="stop_cover"]{background:var(--ha-card-background,var(--card-bg,#fff))!important}
    .dm-shutter-actions button[data-shutter-service="close_cover"]{background:var(--accent-color,var(--accent,#0ea5e9))!important;color:#fff!important}
    .dm-shutter-actions button:disabled{cursor:wait!important;opacity:.65!important}

    /* First paint is already the final Beta9 geometry. This section no longer
       decorates or wraps renderTapparelle; these static rules only prevent the
       legacy base CSS from appearing underneath while Beta9's bounded polish
       applies the same values. */
    html body #page-tapparelle#page-tapparelle{animation:none!important;transform:none!important;opacity:1!important}
    html body #page-tapparelle#page-tapparelle #tapp-grid{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(280px,360px))!important;justify-content:center!important;align-items:start!important;gap:14px!important}
    html body #page-tapparelle#page-tapparelle .tapp-card{box-sizing:border-box!important;width:100%!important;max-width:360px!important;min-height:0!important;padding:14px!important;gap:10px!important;border-radius:20px!important;animation:none!important;transform:none!important}
    html body #page-tapparelle#page-tapparelle .tapp-win{box-sizing:border-box!important;height:132px!important;min-height:132px!important;max-height:132px!important;margin:0!important;border-radius:17px!important;animation:none!important;transform:none!important}
    html body #page-tapparelle#page-tapparelle .tapp-shutter{animation:none!important;filter:none!important;transition:height .55s cubic-bezier(.2,.8,.2,1)!important}
    html body #page-tapparelle#page-tapparelle .tapp-shutter i{animation:none!important;filter:none!important;transform:none!important}
    @media(max-width:560px){html body #page-tapparelle#page-tapparelle #tapp-grid{grid-template-columns:minmax(0,360px)!important;justify-content:center!important}html body #page-tapparelle#page-tapparelle .tapp-card{max-width:360px!important}}
    @media(max-width:640px){.dm-shutter-popup{padding:14px 12px!important}.dm-shutter-popup-card{width:calc(100% - 4px)!important;max-width:560px!important;max-height:84dvh!important;border-radius:22px!important}.dm-shutter-popup-header{min-height:60px!important;padding:10px 13px!important}.dm-shutter-popup-list{max-height:65dvh!important;padding:10px!important}.dm-shutter-popup-row{grid-template-columns:42px minmax(0,1fr)!important;gap:9px!important;padding:10px!important;border-radius:14px!important}.dm-shutter-actions{grid-column:1/-1!important;gap:5px!important}}
  `);
}

export function installShutterSection() {
  if (!doc) return;
  installStyles();
  subscribeStore();
  if (!state.installed) {
    state.installed = true;
    for (const eventName of ["dashboardmodern:legacy-ready", "dashboardmodern:runtime-ready", "pageshow", "dashboardmodern:persistence-restored"]) {
      root.addEventListener?.(eventName, () => {
        subscribeStore();
        scheduleShutterSync();
      });
    }
    root.addEventListener?.("dashboardmodern:config-reset", scheduleShutterSync);
    root.addEventListener?.("dashboardmodern:state-changed", (event) => {
      if (!stateChangeAffectsShutters(event)) return;
      for (const entity of eventEntityIds(event)) clearBusy(entity);
      scheduleShutterSync();
    });
  }
  scheduleShutterSync();
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", installShutterSection, { once: true });
} else {
  installShutterSection();
}
