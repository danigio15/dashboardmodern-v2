import {
  allStates,
  clean,
  dashboardStore,
  doc,
  installStyle,
  root,
  t,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_SHUTTER_SECTION__";
const state = (root[KEY] ||= {
  installed: false,
  timer: 0,
  storeUnsubscribe: null,
  busy: new Map(),
  createdContainer: false,
});

function configuredOpenCovers() {
  const states = allStates();
  const covers = dashboardStore()?.getSection?.("covers") || [];
  const rooms = dashboardStore()?.getSection?.("rooms") || [];
  return covers.flatMap((cover) => {
    const entity = clean(cover.entity || cover.entities?.[0]);
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
    const name =
      clean(cover.name) ||
      clean(current.attributes?.friendly_name) ||
      entity;
    return [
      {
        cover,
        entity,
        current,
        status,
        position: Number.isFinite(position) ? position : null,
        room,
        name,
      },
    ];
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

function closePopup(popup) {
  if (!popup) return;
  popup.classList.remove("show");
  popup.remove();
}

function openPopup() {
  const items = configuredOpenCovers();
  if (!items.length) return;
  let popup = doc.getElementById("dm-shutter-popup");
  if (!popup) {
    popup = doc.createElement("div");
    popup.id = "dm-shutter-popup";
    popup.className = "modal-wrapper dm-shutter-popup";
    popup.setAttribute("role", "presentation");
    popup.innerHTML = `<div class="modal-card details-content dm-shutter-popup-card" role="dialog" aria-modal="true" aria-labelledby="dm-shutter-popup-title">
      <div class="ev-waw-header">
        <h3 class="ev-waw-title" id="dm-shutter-popup-title">🪟 ${t("TAPPARELLE APERTE", "OPEN SHUTTERS")}</h3>
        <div class="ev-waw-close" role="button" tabindex="0" data-shutter-popup-close aria-label="${t("Chiudi", "Close")}">✕ ${t("CHIUDI", "CLOSE")}</div>
      </div>
      <div class="details-list dm-shutter-popup-list" data-shutter-list></div>
    </div>`;
    doc.body.append(popup);
    const close = () => closePopup(popup);
    const closeButton = popup.querySelector("[data-shutter-popup-close]");
    closeButton.addEventListener("click", close);
    closeButton.addEventListener("keydown", (event) => {
      if (!["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      close();
    });
    popup.addEventListener("click", (event) => {
      if (event.target === popup) close();
    });
    popup.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
    });
  }
  renderPopupRows(popup, items);
  popup.classList.add("show");
  popup.querySelector("[data-shutter-popup-close]")?.focus?.({ preventScroll: true });
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

async function callCoverService(button, entity, service) {
  const busyKey = `${entity}:${service}`;
  state.busy.set(busyKey, true);
  button.disabled = true;
  button.textContent = actionLabel(service, true);
  try {
    await root.dmCallHaService?.("cover", service, { entity_id: entity });
  } catch (error) {
    state.busy.delete(busyKey);
    button.disabled = false;
    button.textContent = actionLabel(service, false);
    root.console?.error?.("[DashboardModern] shutter service", error);
  }
}

function createPopupRow(item) {
  const row = doc.createElement("article");
  row.className = "detail-row dm-shutter-popup-row";
  row.dataset.shutterEntity = item.entity;
  row.innerHTML = `<div class="d-info dm-shutter-details"><div class="d-name"></div><div class="d-state"></div></div><div class="dm-shutter-actions"></div>`;
  const actions = row.querySelector(".dm-shutter-actions");
  for (const service of ["open_cover", "stop_cover", "close_cover"]) {
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "ed-ord-btn dm-shutter-action";
    button.dataset.shutterService = service;
    button.addEventListener("click", () => callCoverService(button, item.entity, service));
    actions.append(button);
  }
  return row;
}

function updatePopupRow(row, item) {
  row.querySelector(".dm-shutter-details .d-name").textContent = item.name;
  const detail = [item.room?.name, statusLabel(item)];
  if (item.position != null) detail.push(`${Math.round(item.position)}%`);
  row.querySelector(".dm-shutter-details .d-state").textContent = detail.filter(Boolean).join(" · ");
  row.querySelectorAll("[data-shutter-service]").forEach((button) => {
    const service = button.dataset.shutterService;
    const busy = state.busy.has(`${item.entity}:${service}`);
    button.disabled = busy;
    button.textContent = actionLabel(service, busy);
  });
}

function renderPopupRows(popup, items) {
  const list = popup?.querySelector("[data-shutter-list]");
  if (!list) return;
  const byEntity = new Map(
    [...list.querySelectorAll(".dm-shutter-popup-row")].map((row) => [row.dataset.shutterEntity, row]),
  );
  const ordered = items.map((item) => {
    const row = byEntity.get(item.entity) || createPopupRow(item);
    updatePopupRow(row, item);
    byEntity.delete(item.entity);
    return row;
  });
  byEntity.forEach((row) => row.remove());
  list.replaceChildren(...ordered);
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
  alert.querySelector(".g-name").textContent =
    items.length === 1
      ? t("TAPPARELLA APERTA", "SHUTTER OPEN")
      : t("TAPPARELLE APERTE", "SHUTTERS OPEN");
  alert.querySelector(".g-val").textContent = String(items.length);
  return true;
}

export function syncShutterSection() {
  if (!doc) return false;
  const items = configuredOpenCovers();
  if (!items.length) {
    doc.querySelector("#tapp-avvisi .dm-shutter-alert")?.remove();
    doc.getElementById("dm-shutter-popup")?.remove();
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

function schedule(delay = 0) {
  root.clearTimeout?.(state.timer);
  state.timer = root.setTimeout?.(() => {
    state.timer = 0;
    const active = syncShutterSection();
    schedule(active || doc?.getElementById("dm-shutter-popup") ? 120 : 350);
  }, delay);
}

function subscribeStore() {
  const store = dashboardStore();
  if (state.storeUnsubscribe || !store?.subscribe) return;
  state.storeUnsubscribe = store.subscribe((change) => {
    if (["covers", "rooms"].includes(change.section)) schedule(0);
  });
}

function installStyles() {
  installStyle(
    "dm-shutter-section-style",
    `
      .dm-shutter-alert-host{display:contents!important}
      .dm-shutter-alert{box-sizing:border-box!important;width:100%!important;min-width:0!important;cursor:pointer!important;--g-rgb:225,29,72}
      .dm-shutter-alert:focus-visible{outline:3px solid var(--accent-color,var(--accent,#0ea5e9))!important;outline-offset:3px!important}
      .dm-shutter-popup-card{box-sizing:border-box!important;width:min(760px,100%)!important;max-width:760px!important}
      .dm-shutter-popup-list{display:grid!important;gap:10px!important;max-height:min(68dvh,620px)!important;overflow:auto!important;padding-right:4px!important}
      .dm-shutter-popup-row{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(250px,360px)!important;align-items:center!important;gap:14px!important}
      .dm-shutter-details{min-width:0!important}.dm-shutter-details .d-name,.dm-shutter-details .d-state{overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
      .dm-shutter-actions{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important}
      .dm-shutter-actions button{box-sizing:border-box!important;width:100%!important;min-width:0!important;min-height:42px!important;margin:0!important;padding:8px 10px!important;font-weight:850!important}
      .dm-shutter-actions button:disabled{cursor:wait!important;opacity:.72!important}
      @media(max-width:640px){.dm-shutter-popup-card{width:100%!important;max-height:92dvh!important}.dm-shutter-popup-row{grid-template-columns:1fr!important}.dm-shutter-actions{grid-template-columns:repeat(3,minmax(0,1fr))!important}}
    `,
  );
}

export function installShutterSection() {
  if (!doc) return;
  installStyles();
  subscribeStore();
  schedule(0);
  if (!state.installed) {
    state.installed = true;
    for (const event of ["dashboardmodern:legacy-ready", "dashboardmodern:runtime-ready", "dashboardmodern:state-changed", "pageshow"]) {
      root.addEventListener?.(event, () => {
        subscribeStore();
        schedule(0);
      });
    }
  }
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installShutterSection, { once: true });
else installShutterSection();
