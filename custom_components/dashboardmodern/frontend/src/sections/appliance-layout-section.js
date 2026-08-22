import { createApplianceViewModel } from "../core/appliance-view-model.js";
import {
  activeLocale,
  allStates,
  clean,
  doc,
  english,
  installStyle,
  root,
  section,
  t,
  wrapFunction,
} from "./shared.js";

globalThis.__DM_20260815C__ = true;
const KEY = "__DASHBOARDMODERN_APPLIANCE_LAYOUT_SECTION__";
const state = (globalThis[KEY] ||= {
  installed: false,
  listeners: false,
  frame: 0,
  wrappers: false,
});

function configuredEntity(value) {
  return clean(typeof value === "string" ? value : value?.entity || value?.entity_id);
}

function applianceEntities(device = {}) {
  return new Set(
    [
      device.daily_energy_entity,
      device.energy_today,
      device.daily_energy,
      device.total_energy_entity,
      device.history_entity,
      device.report_entity,
      device.energy_entity,
      device.energy,
      ...(device.entities || []),
    ]
      .map(configuredEntity)
      .filter(Boolean),
  );
}

function popupDeviceForRow(row, appliances) {
  const entity = clean(row?.dataset?.dmDailyEntity);
  if (entity) {
    const direct = appliances.find((device) => applianceEntities(device).has(entity));
    if (direct) return direct;
  }
  const name = clean(
    row?.querySelector?.(".dm-appliance-daily-row-main strong")?.textContent,
  ).toLowerCase();
  if (!name) return null;
  return appliances.find((device) => clean(device?.name).toLowerCase() === name) || null;
}

function cardArtworkForDevice(device) {
  const id = clean(device?.id);
  const cards = [
    ...(doc?.querySelectorAll?.(
      "#page-appliances-main .appl-wide-card[data-appliance-id],#appl-grid-overview .appl-wide-card[data-appliance-id]",
    ) || []),
  ];
  let card = id ? cards.find((candidate) => clean(candidate.dataset.applianceId) === id) : null;
  if (!card) {
    const name = clean(device?.name).toLowerCase();
    card = cards.find(
      (candidate) =>
        clean(candidate.querySelector(".appl-wide-name")?.textContent).toLowerCase() === name,
    );
  }
  return (
    card?.querySelector?.(".appl-visual .appl-ic") ||
    // Showcase card: the artwork lives in the hero — the photorealistic hero
    // SVG, the shared flat artwork or the user's custom image.
    card?.querySelector?.(
      ".dm-ap-hero > .dm-hero-art, .dm-ap-hero > .dm-appliance-art, .dm-ap-hero > .dm-ap-img",
    ) ||
    null
  );
}

function syncDailyPopupArtwork() {
  const list = doc?.querySelector?.(
    "#dm-appliance-daily-popup [data-dm-daily-popup-list]",
  );
  if (!list) return false;
  const appliances = section("appliances", []);
  if (!Array.isArray(appliances) || !appliances.length) return false;

  list.querySelectorAll(".dm-appliance-daily-row").forEach((row) => {
    const device = popupDeviceForRow(row, appliances);
    if (!device) return;
    const source = cardArtworkForDevice(device);
    if (!source) return;

    let visual = row.querySelector(":scope > .dm-appliance-daily-visual");
    if (!visual) {
      visual = doc.createElement("span");
      visual.className = "dm-appliance-daily-visual";
      row.prepend(visual);
    }
    const deviceId = clean(device.id);
    if (visual.dataset.applianceId === deviceId && visual.firstElementChild) return;
    const clone = source.cloneNode(true);
    clone.removeAttribute("id");
    visual.replaceChildren(clone);
    visual.dataset.applianceId = deviceId;
  });
  return true;
}

function syncAfterDailyPopupRefresh() {
  syncDailyPopupArtwork();
  const pending = root.__DASHBOARDMODERN_APPLIANCES_SECTION__?.dailyPromise;
  if (pending?.then) pending.then(() => syncDailyPopupArtwork()).catch(() => {});
}

function installPopupArtworkBridge() {
  if (!doc || state.listeners) return;
  state.listeners = true;
  doc.addEventListener("click", (event) => {
    if (
      !event.target?.closest?.(
        '#appl-kpi-grid [data-dm-appliance-daily-total="true"]',
      )
    )
      return;
    root.queueMicrotask?.(syncAfterDailyPopupRefresh);
  });
  doc.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (
      !event.target?.closest?.(
        '#appl-kpi-grid [data-dm-appliance-daily-total="true"]',
      )
    )
      return;
    root.queueMicrotask?.(syncAfterDailyPopupRefresh);
  });
  root.addEventListener?.("dashboardmodern:state-changed", () => {
    const popup = doc.getElementById("dm-appliance-daily-popup");
    if (!popup || popup.hidden) return;
    root.requestAnimationFrame?.(syncAfterDailyPopupRefresh);
  });
}

function roomForDevice(device = {}, rooms = []) {
  const wanted = clean(device.room_id || device.room);
  if (!wanted) return null;
  return (
    rooms.find((room) => clean(room?.id) === wanted) ||
    rooms.find((room) => clean(room?.name).toLowerCase() === wanted.toLowerCase()) ||
    null
  );
}

function visualTypeFor(card) {
  const owned = clean(card?.dataset?.dmArtwork);
  return owned && owned !== "custom" ? owned : "generic";
}

function roomText(room) {
  if (!room) return t("Nessuna stanza", "No room");
  const icon = clean(room.icon);
  const glyph = icon && !icon.startsWith("mdi:") ? `${icon} ` : "";
  return `${glyph}${clean(room.name) || (t("Stanza", "Room"))}`;
}

function syncHeaderArtwork(card, device) {
  const heading = card.querySelector(".appl-heading");
  if (!heading) return false;
  // The large artwork inside .appl-visual is the single visual owner. Keeping a
  // cloned copy in the heading duplicated accessible/runtime artwork and made
  // the desktop card grow into a second poster.
  heading.querySelector(":scope > .dm-appliance-head-icon")?.remove();
  return true;
}

export function syncReferenceApplianceCards() {
  const appliances = section("appliances", []);
  if (!Array.isArray(appliances) || !appliances.length || !doc) return false;
  const rooms = section("rooms", []);
  const roomList = Array.isArray(rooms) ? rooms : [];
  const states = allStates();
  const locale = activeLocale();
  const byId = new Map(appliances.map((device) => [clean(device.id), device]));
  const cards = [
    ...doc.querySelectorAll(
      "#page-appliances-main .appl-wide-card[data-appliance-id],#appl-grid-overview .appl-wide-card[data-appliance-id]",
    ),
  ];
  if (!cards.length) return false;

  cards.forEach((card, index) => {
    const device = byId.get(clean(card.dataset.applianceId)) || appliances[index];
    if (!device) return;
    const model = createApplianceViewModel(device, states, roomList, locale);
    const room = model.room || roomForDevice(device, roomList);
    const type = visualTypeFor(card);

    card.dataset.dmBeta27ApplianceCard = "true";
    card.dataset.dmApplianceType = type;
    card.dataset.applianceState = model.mode;
    card.dataset.dmRoomId = clean(room?.id);

    const category = card.querySelector(".appl-wide-cat");
    if (category) {
      category.textContent = roomText(room);
      category.dataset.dmRoomLabel = "true";
      category.title = roomText(room);
    }

    const status = card.querySelector(
      ".appl-st,.appl-wide-status,.appl-status,.appl-state,[data-appliance-state],.appl-badge",
    );
    if (status) {
      status.dataset.state = model.mode;
      status.textContent = model.label;
    }

    syncHeaderArtwork(card, device);
  });
  return true;
}

function scheduleReferenceCards() {
  if (!doc || state.frame) return;
  const run = () => {
    state.frame = 0;
    syncReferenceApplianceCards();
  };
  state.frame = root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 0);
}

function installReferenceWrappers() {
  if (state.wrappers) return;
  state.wrappers = true;
  wrapFunction("renderAppliances", "__dmBeta27ApplianceReference_renderAppliances", scheduleReferenceCards);
  wrapFunction(
    "renderApplianceSection",
    "__dmBeta27ApplianceReference_renderApplianceSection",
    scheduleReferenceCards,
  );
  wrapFunction("render", "__dmBeta27ApplianceReference_render", scheduleReferenceCards);
}

function installStyles() {
  installStyle(
    "dm-appliance-layout-section-style",
    `
      /* Legacy-card polish only: the showcase renderer (.dm-appl-grid / .dm-ap-card)
         owns its own layout and must not inherit these rules. */
      #appl-grid-overview:not(.dm-appl-grid),#page-appliances-main .appl-page-grid,#page-appliances-main .appl-grid,#page-appliances-main [data-appliance-grid]{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),350px))!important;justify-content:start!important;align-items:stretch!important;gap:18px!important}

      #page-appliances-main .appl-wide-card:not(.dm-ap-card),#appl-grid-overview .appl-wide-card:not(.dm-ap-card){position:relative!important;display:grid!important;box-sizing:border-box!important;width:100%!important;max-width:350px!important;min-width:0!important;min-height:390px!important;height:auto!important;padding:0!important;gap:0!important;grid-template-columns:minmax(0,1fr) auto!important;grid-template-rows:auto minmax(190px,1fr) auto!important;grid-template-areas:"head head" "visual visual" "live actions"!important;border:1px solid rgba(148,163,184,.20)!important;border-radius:22px!important;overflow:hidden!important;background:radial-gradient(circle at 18% 8%,rgba(125,211,252,.14),transparent 31%),linear-gradient(180deg,rgba(255,255,255,.99),rgba(248,250,252,.98))!important;color:var(--text,#0f172a)!important;box-shadow:0 18px 48px rgba(15,23,42,.12)!important;isolation:isolate!important;transition:border-color .22s ease,box-shadow .22s ease,transform .22s ease!important}
      #page-appliances-main .appl-wide-card:not(.dm-ap-card)::after,#appl-grid-overview .appl-wide-card:not(.dm-ap-card)::after{content:"";position:absolute;inset:auto -70px -85px auto;width:190px;height:190px;border-radius:50%;background:radial-gradient(circle,rgba(14,165,233,.11),transparent 67%);pointer-events:none;z-index:-1}
      #page-appliances-main .appl-wide-card[data-appliance-state="running"]:not(.dm-ap-card),#appl-grid-overview .appl-wide-card[data-appliance-state="running"]:not(.dm-ap-card){border-color:rgba(16,185,129,.32)!important;box-shadow:0 20px 54px rgba(15,23,42,.12),0 0 0 1px rgba(16,185,129,.05),0 0 38px rgba(16,185,129,.08)!important}
      #page-appliances-main .appl-wide-card[data-appliance-state="standby"]:not(.dm-ap-card),#appl-grid-overview .appl-wide-card[data-appliance-state="standby"]:not(.dm-ap-card){border-color:rgba(245,158,11,.27)!important;box-shadow:0 18px 48px rgba(15,23,42,.11),0 0 30px rgba(245,158,11,.06)!important}
      html[data-theme="dark"] #page-appliances-main .appl-wide-card:not(.dm-ap-card),html[data-theme="dark"] #appl-grid-overview .appl-wide-card:not(.dm-ap-card),body.dark #page-appliances-main .appl-wide-card:not(.dm-ap-card),body.dark #appl-grid-overview .appl-wide-card:not(.dm-ap-card){background:radial-gradient(circle at 16% 8%,rgba(14,165,233,.14),transparent 30%),linear-gradient(180deg,#172033,#111827)!important;color:#f8fafc!important;border-color:#2b3a58!important}

      #page-appliances-main .appl-wide-card>.appl-info,#appl-grid-overview .appl-wide-card>.appl-info{display:contents!important}
      #page-appliances-main .appl-heading,#appl-grid-overview .appl-heading{grid-area:head!important;display:grid!important;grid-template-columns:54px minmax(0,1fr) auto!important;align-items:center!important;gap:12px!important;min-width:0!important;margin:0!important;padding:20px 20px 8px!important;background:transparent!important}
      #page-appliances-main .dm-appliance-head-icon,#appl-grid-overview .dm-appliance-head-icon{display:grid!important;place-items:center!important;width:52px!important;height:52px!important;min-width:52px!important;min-height:52px!important;border-radius:50%!important;background:linear-gradient(145deg,#e0f2fe,#f0f9ff)!important;box-shadow:inset 0 0 0 1px rgba(14,165,233,.12),0 8px 22px rgba(14,165,233,.10)!important;overflow:hidden!important}
      #page-appliances-main .dm-appliance-head-icon>.dm-appliance-head-art,#appl-grid-overview .dm-appliance-head-icon>.dm-appliance-head-art{display:grid!important;place-items:center!important;width:48px!important;height:48px!important;min-width:48px!important;min-height:48px!important;margin:0!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important;overflow:hidden!important}
      #page-appliances-main .dm-appliance-head-icon svg,#appl-grid-overview .dm-appliance-head-icon svg,#page-appliances-main .dm-appliance-head-icon img,#appl-grid-overview .dm-appliance-head-icon img,#page-appliances-main .dm-appliance-head-icon ha-icon,#appl-grid-overview .dm-appliance-head-icon ha-icon{display:block!important;width:44px!important;height:44px!important;max-width:44px!important;max-height:44px!important;object-fit:contain!important;--mdc-icon-size:44px!important}
      #page-appliances-main .appl-heading>div,#appl-grid-overview .appl-heading>div{min-width:0!important;align-self:center!important}
      #page-appliances-main .appl-wide-name,#appl-grid-overview .appl-wide-name{min-width:0!important;margin:0!important;padding:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;color:inherit!important;font-size:20px!important;font-weight:950!important;line-height:1.12!important;letter-spacing:-.35px!important}
      #page-appliances-main .appl-wide-cat,#appl-grid-overview .appl-wide-cat{display:flex!important;align-items:center!important;min-width:0!important;width:max-content!important;max-width:100%!important;margin:5px 0 0!important;padding:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;color:var(--secondary-text-color,#64748b)!important;font-size:11.5px!important;font-weight:850!important;line-height:1.2!important}
      #page-appliances-main .appl-st,#appl-grid-overview .appl-st{display:inline-flex!important;align-items:center!important;justify-content:center!important;flex:0 0 auto!important;width:max-content!important;max-width:116px!important;min-height:31px!important;margin:0!important;padding:6px 10px!important;border-radius:11px!important;font-size:9.5px!important;font-weight:950!important;line-height:1!important;letter-spacing:.6px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;text-transform:uppercase!important}

      #page-appliances-main .appl-visual,#appl-grid-overview .appl-visual{grid-area:visual!important;display:grid!important;place-items:center!important;box-sizing:border-box!important;width:100%!important;min-width:0!important;height:100%!important;min-height:200px!important;margin:0!important;padding:8px 22px 4px!important;border:0!important;background:transparent!important;overflow:visible!important}
      #page-appliances-main .appl-wide-card .appl-visual>.appl-ic,#appl-grid-overview .appl-wide-card .appl-visual>.appl-ic{position:relative!important;display:grid!important;place-items:center!important;box-sizing:border-box!important;width:178px!important;height:178px!important;min-width:178px!important;min-height:178px!important;margin:0!important;padding:0!important;border:0!important;border-radius:38px!important;background:radial-gradient(circle at 48% 42%,rgba(255,255,255,.95),rgba(224,242,254,.62) 55%,rgba(186,230,253,.26))!important;box-shadow:inset 0 0 0 1px rgba(14,165,233,.09),0 18px 42px rgba(14,165,233,.10)!important;overflow:visible!important;transform:translateZ(0)!important}
      #page-appliances-main .appl-wide-card .appl-visual>.appl-ic::after,#appl-grid-overview .appl-wide-card .appl-visual>.appl-ic::after{content:"";position:absolute;inset:14px;border-radius:31px;border:1px solid rgba(255,255,255,.78);pointer-events:none}
      #page-appliances-main .appl-wide-card .appl-visual .dm-appliance-art,#appl-grid-overview .appl-wide-card .appl-visual .dm-appliance-art{display:grid!important;place-items:center!important;width:164px!important;height:164px!important;transform-origin:center!important;filter:drop-shadow(0 12px 18px rgba(15,23,42,.14))!important}
      #page-appliances-main .appl-wide-card .appl-visual svg,#appl-grid-overview .appl-wide-card .appl-visual svg{display:block!important;width:160px!important;height:160px!important;max-width:160px!important;max-height:160px!important;overflow:visible!important}
      #page-appliances-main .appl-wide-card .dm-appliance-image-wrap,#appl-grid-overview .appl-wide-card .dm-appliance-image-wrap{display:block!important;box-sizing:border-box!important;width:164px!important;height:164px!important;min-width:164px!important;min-height:164px!important;overflow:hidden!important;border-radius:34px!important}
      #page-appliances-main .appl-wide-card .dm-appliance-image,#appl-grid-overview .appl-wide-card .dm-appliance-image{display:block!important;width:100%!important;height:100%!important;object-fit:contain!important;object-position:center!important;filter:drop-shadow(0 12px 18px rgba(15,23,42,.14))!important}

      #page-appliances-main .appl-live,#appl-grid-overview .appl-live{grid-area:live!important;display:flex!important;align-items:center!important;align-self:end!important;flex-wrap:wrap!important;column-gap:9px!important;row-gap:3px!important;min-width:0!important;min-height:62px!important;margin:0!important;padding:8px 8px 18px 22px!important;border-top:1px solid rgba(148,163,184,.12)!important;background:linear-gradient(180deg,rgba(248,250,252,.18),rgba(248,250,252,.72))!important}
      #page-appliances-main .appl-primary,#appl-grid-overview .appl-primary{display:flex!important;align-items:baseline!important;gap:5px!important;min-width:0!important;margin:0!important;font-size:14px!important;line-height:1.2!important}
      #page-appliances-main .appl-primary::before,#appl-grid-overview .appl-primary::before{content:"⚡";font-size:18px!important;line-height:1!important}
      #page-appliances-main .appl-primary strong,#appl-grid-overview .appl-primary strong,#page-appliances-main .appl-pwr,#appl-grid-overview .appl-pwr{font-size:24px!important;font-weight:950!important;letter-spacing:-.6px!important;color:#0f172a!important}
      #page-appliances-main .appl-mini,#appl-grid-overview .appl-mini{display:inline-flex!important;align-items:center!important;gap:3px!important;min-width:0!important;margin:0!important;color:var(--secondary-text-color,#64748b)!important;font-size:10px!important;font-weight:800!important;line-height:1.2!important}
      #page-appliances-main .appl-spark,#appl-grid-overview .appl-spark{display:none!important}
      #page-appliances-main .appl-actions,#appl-grid-overview .appl-actions{grid-area:actions!important;display:flex!important;align-items:center!important;justify-content:flex-end!important;align-self:end!important;gap:7px!important;min-width:0!important;min-height:62px!important;margin:0!important;padding:8px 20px 18px 8px!important;border-top:1px solid rgba(148,163,184,.12)!important;background:linear-gradient(180deg,rgba(248,250,252,.18),rgba(248,250,252,.72))!important}
      #page-appliances-main .appl-actions button,#appl-grid-overview .appl-actions button,#page-appliances-main [data-dm-power-toggle="true"]:not(.dm-ap-power),#appl-grid-overview [data-dm-power-toggle="true"]:not(.dm-ap-power){display:inline-flex!important;align-items:center!important;justify-content:center!important;box-sizing:border-box!important;min-width:0!important;min-height:46px!important;height:46px!important;margin:0!important;padding:9px 13px!important;border-radius:15px!important;opacity:1!important;visibility:visible!important;font-size:11px!important;font-weight:950!important;line-height:1!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;box-shadow:none!important}
      #page-appliances-main .appl-actions .appl-action-btn,#appl-grid-overview .appl-actions .appl-action-btn{width:46px!important;max-width:46px!important;padding:0!important;background:rgba(14,165,233,.10)!important;color:#0369a1!important;border:1px solid rgba(14,165,233,.13)!important;font-size:0!important}
      #page-appliances-main .appl-actions .appl-action-btn::before,#appl-grid-overview .appl-actions .appl-action-btn::before{content:"↗";font-size:18px!important;font-weight:950!important}
      #page-appliances-main [data-dm-power-toggle="true"]:not(.dm-ap-power),#appl-grid-overview [data-dm-power-toggle="true"]:not(.dm-ap-power){min-width:105px!important;background:linear-gradient(135deg,#10b981,#059669)!important;color:#fff!important;border:0!important;box-shadow:0 9px 20px rgba(5,150,105,.20)!important}
      #page-appliances-main [data-dm-power-toggle="true"][data-state="on"]:not(.dm-ap-power),#appl-grid-overview [data-dm-power-toggle="true"][data-state="on"]:not(.dm-ap-power){background:linear-gradient(135deg,#ef4444,#dc2626)!important;box-shadow:0 9px 20px rgba(220,38,38,.17)!important}
      #page-appliances-main .appl-actions button[hidden],#appl-grid-overview .appl-actions button[hidden],#page-appliances-main [data-dm-power-toggle="true"][hidden],#appl-grid-overview [data-dm-power-toggle="true"][hidden]{display:none!important;visibility:hidden!important}

      html[data-theme="dark"] #page-appliances-main .appl-live,html[data-theme="dark"] #appl-grid-overview .appl-live,html[data-theme="dark"] #page-appliances-main .appl-actions,html[data-theme="dark"] #appl-grid-overview .appl-actions,body.dark #page-appliances-main .appl-live,body.dark #appl-grid-overview .appl-live,body.dark #page-appliances-main .appl-actions,body.dark #appl-grid-overview .appl-actions{background:rgba(15,23,42,.38)!important;border-color:#2b3a58!important}
      html[data-theme="dark"] #page-appliances-main .appl-wide-cat,html[data-theme="dark"] #appl-grid-overview .appl-wide-cat,html[data-theme="dark"] #page-appliances-main .appl-mini,html[data-theme="dark"] #appl-grid-overview .appl-mini,body.dark #page-appliances-main .appl-wide-cat,body.dark #appl-grid-overview .appl-wide-cat,body.dark #page-appliances-main .appl-mini,body.dark #appl-grid-overview .appl-mini{color:#cbd5e1!important}
      html[data-theme="dark"] #page-appliances-main .appl-primary strong,html[data-theme="dark"] #appl-grid-overview .appl-primary strong,html[data-theme="dark"] #page-appliances-main .appl-pwr,html[data-theme="dark"] #appl-grid-overview .appl-pwr,body.dark #page-appliances-main .appl-primary strong,body.dark #appl-grid-overview .appl-primary strong,body.dark #page-appliances-main .appl-pwr,body.dark #appl-grid-overview .appl-pwr{color:#f8fafc!important}

      /* Running motion: each appliance family gets a movement that makes sense
         for the physical device. Standby never plays the active mechanism; it
         only breathes softly so it is visually distinct from OFF. */
      #page-appliances-main [data-appliance-state="standby"] .appl-visual>.appl-ic,#appl-grid-overview [data-appliance-state="standby"] .appl-visual>.appl-ic{animation:dm-appliance-standby-breathe 3.6s ease-in-out infinite!important}
      #page-appliances-main [data-appliance-state="running"] .appl-visual>.appl-ic,#appl-grid-overview [data-appliance-state="running"] .appl-visual>.appl-ic{box-shadow:inset 0 0 0 1px rgba(16,185,129,.12),0 18px 42px rgba(16,185,129,.13),0 0 32px rgba(16,185,129,.08)!important}
      #page-appliances-main [data-appliance-state="running"][data-dm-appliance-type="washer"] .appl-visual .dm-appliance-art svg path:last-child,#appl-grid-overview [data-appliance-state="running"][data-dm-appliance-type="washer"] .appl-visual .dm-appliance-art svg path:last-child,#page-appliances-main [data-appliance-state="running"][data-dm-appliance-type="dryer"] .appl-visual .dm-appliance-art svg path:last-child,#appl-grid-overview [data-appliance-state="running"][data-dm-appliance-type="dryer"] .appl-visual .dm-appliance-art svg path:last-child{transform-box:fill-box!important;transform-origin:center!important;animation:dm-appliance-drum-spin 1.15s linear infinite!important}
      #page-appliances-main [data-appliance-state="running"][data-dm-appliance-type="fan"] .appl-visual .dm-appliance-art svg path:nth-of-type(2),#appl-grid-overview [data-appliance-state="running"][data-dm-appliance-type="fan"] .appl-visual .dm-appliance-art svg path:nth-of-type(2){transform-box:fill-box!important;transform-origin:center!important;animation:dm-appliance-drum-spin .72s linear infinite!important}
      #page-appliances-main [data-appliance-state="running"][data-dm-appliance-type="dishwasher"] .appl-visual .dm-appliance-art svg path:last-child,#appl-grid-overview [data-appliance-state="running"][data-dm-appliance-type="dishwasher"] .appl-visual .dm-appliance-art svg path:last-child,#page-appliances-main [data-appliance-state="running"][data-dm-appliance-type="boiler"] .appl-visual .dm-appliance-art svg path:nth-of-type(2),#appl-grid-overview [data-appliance-state="running"][data-dm-appliance-type="boiler"] .appl-visual .dm-appliance-art svg path:nth-of-type(2){animation:dm-appliance-water-wave 1.8s ease-in-out infinite!important}
      #page-appliances-main [data-appliance-state="running"][data-dm-appliance-type="hood"] .appl-visual .dm-appliance-art svg path:last-child,#appl-grid-overview [data-appliance-state="running"][data-dm-appliance-type="hood"] .appl-visual .dm-appliance-art svg path:last-child,#page-appliances-main [data-appliance-state="running"][data-dm-appliance-type="air-conditioner"] .appl-visual .dm-appliance-art svg path:last-child,#appl-grid-overview [data-appliance-state="running"][data-dm-appliance-type="air-conditioner"] .appl-visual .dm-appliance-art svg path:last-child{animation:dm-appliance-air-flow 1.45s ease-in-out infinite!important}
      #page-appliances-main [data-appliance-state="running"][data-dm-appliance-type="robot-vacuum"] .appl-visual .dm-appliance-art,#appl-grid-overview [data-appliance-state="running"][data-dm-appliance-type="robot-vacuum"] .appl-visual .dm-appliance-art{animation:dm-appliance-rover 2.3s ease-in-out infinite!important}
      #page-appliances-main [data-appliance-state="running"][data-dm-appliance-type="vacuum"] .appl-visual .dm-appliance-art,#appl-grid-overview [data-appliance-state="running"][data-dm-appliance-type="vacuum"] .appl-visual .dm-appliance-art,#page-appliances-main [data-appliance-state="running"][data-dm-appliance-type="iron"] .appl-visual .dm-appliance-art,#appl-grid-overview [data-appliance-state="running"][data-dm-appliance-type="iron"] .appl-visual .dm-appliance-art{animation:dm-appliance-sway 1.9s ease-in-out infinite!important}
      #page-appliances-main [data-appliance-state="running"][data-dm-appliance-type="oven"] .appl-visual .dm-appliance-art,#appl-grid-overview [data-appliance-state="running"][data-dm-appliance-type="oven"] .appl-visual .dm-appliance-art,#page-appliances-main [data-appliance-state="running"][data-dm-appliance-type="cooktop"] .appl-visual .dm-appliance-art,#appl-grid-overview [data-appliance-state="running"][data-dm-appliance-type="cooktop"] .appl-visual .dm-appliance-art,#page-appliances-main [data-appliance-state="running"][data-dm-appliance-type="toaster"] .appl-visual .dm-appliance-art,#appl-grid-overview [data-appliance-state="running"][data-dm-appliance-type="toaster"] .appl-visual .dm-appliance-art,#page-appliances-main [data-appliance-state="running"][data-dm-appliance-type="kettle"] .appl-visual .dm-appliance-art,#appl-grid-overview [data-appliance-state="running"][data-dm-appliance-type="kettle"] .appl-visual .dm-appliance-art,#page-appliances-main [data-appliance-state="running"][data-dm-appliance-type="coffee"] .appl-visual .dm-appliance-art,#appl-grid-overview [data-appliance-state="running"][data-dm-appliance-type="coffee"] .appl-visual .dm-appliance-art{animation:dm-appliance-heat 1.8s ease-in-out infinite!important}
      #page-appliances-main [data-appliance-state="running"][data-dm-appliance-type="microwave"] .appl-visual .dm-appliance-art,#appl-grid-overview [data-appliance-state="running"][data-dm-appliance-type="microwave"] .appl-visual .dm-appliance-art{animation:dm-appliance-microwave 1.05s ease-in-out infinite!important}
      #page-appliances-main [data-appliance-state="running"][data-dm-appliance-type="television"] .appl-visual .dm-appliance-art,#appl-grid-overview [data-appliance-state="running"][data-dm-appliance-type="television"] .appl-visual .dm-appliance-art,#page-appliances-main [data-appliance-state="running"][data-dm-appliance-type="fridge"] .appl-visual .dm-appliance-art,#appl-grid-overview [data-appliance-state="running"][data-dm-appliance-type="fridge"] .appl-visual .dm-appliance-art,#page-appliances-main [data-appliance-state="running"][data-dm-appliance-type="generic"] .appl-visual .dm-appliance-art,#appl-grid-overview [data-appliance-state="running"][data-dm-appliance-type="generic"] .appl-visual .dm-appliance-art{animation:dm-appliance-active-glow 2.2s ease-in-out infinite!important}
      #page-appliances-main [data-appliance-state="running"] .appl-visual .dm-appliance-image,#appl-grid-overview [data-appliance-state="running"] .appl-visual .dm-appliance-image{animation:dm-appliance-running-float 2.4s ease-in-out infinite!important}

      @keyframes dm-appliance-drum-spin{to{transform:rotate(360deg)}}
      @keyframes dm-appliance-standby-breathe{0%,100%{filter:saturate(.92);transform:scale(1)}50%{filter:saturate(1.08);transform:scale(1.018);box-shadow:inset 0 0 0 1px rgba(245,158,11,.13),0 18px 42px rgba(245,158,11,.11)}}
      @keyframes dm-appliance-water-wave{0%,100%{transform:translateX(-1.5px)}50%{transform:translateX(2.5px)}}
      @keyframes dm-appliance-air-flow{0%,100%{opacity:.55;transform:translateY(-2px)}50%{opacity:1;transform:translateY(4px)}}
      @keyframes dm-appliance-rover{0%,100%{transform:translateX(-4px) rotate(-1deg)}50%{transform:translateX(5px) rotate(1deg)}}
      @keyframes dm-appliance-sway{0%,100%{transform:rotate(-1.2deg) translateY(0)}50%{transform:rotate(1.2deg) translateY(-2px)}}
      @keyframes dm-appliance-heat{0%,100%{filter:drop-shadow(0 12px 18px rgba(15,23,42,.14)) saturate(1)}50%{filter:drop-shadow(0 14px 24px rgba(249,115,22,.30)) saturate(1.22);transform:translateY(-2px)}}
      @keyframes dm-appliance-microwave{0%,100%{transform:scale(1);filter:drop-shadow(0 12px 18px rgba(15,23,42,.14))}50%{transform:scale(1.025);filter:drop-shadow(0 14px 25px rgba(14,165,233,.30))}}
      @keyframes dm-appliance-active-glow{0%,100%{filter:drop-shadow(0 12px 18px rgba(15,23,42,.14))}50%{filter:drop-shadow(0 15px 25px rgba(14,165,233,.30));transform:translateY(-1px)}}
      @keyframes dm-appliance-running-float{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-3px) scale(1.015)}}

      /* The daily popup reuses the exact rendered artwork of each appliance
         card. This higher-specificity rule replaces the generic lightning
         pseudo-element installed by the dashboard-style popup layer. */
      html #dm-appliance-daily-popup .dm-appliance-daily-row::before{content:none!important;display:none!important}
      #dm-appliance-daily-popup .dm-appliance-daily-visual{position:absolute!important;left:18px!important;top:50%!important;width:54px!important;height:54px!important;transform:translateY(-50%)!important;display:grid!important;place-items:center!important;overflow:hidden!important;border-radius:18px!important;background:linear-gradient(145deg,#e0f2fe,#f0f9ff)!important;box-shadow:inset 0 0 0 1px rgba(14,165,233,.12),0 8px 22px rgba(14,165,233,.09)!important}
      #dm-appliance-daily-popup .dm-appliance-daily-visual>.appl-ic{display:grid!important;place-items:center!important;width:54px!important;height:54px!important;min-width:54px!important;min-height:54px!important;margin:0!important;padding:0!important;border:0!important;border-radius:17px!important;background:transparent!important;box-shadow:none!important;overflow:hidden!important}
      #dm-appliance-daily-popup .dm-appliance-daily-visual .dm-appliance-image-wrap,#dm-appliance-daily-popup .dm-appliance-daily-visual .dm-appliance-image{display:block!important;width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;border-radius:15px!important;object-fit:cover!important;object-position:center!important}
      #dm-appliance-daily-popup .dm-appliance-daily-visual svg,#dm-appliance-daily-popup .dm-appliance-daily-visual ha-icon{display:block!important;width:50px!important;height:50px!important;max-width:50px!important;max-height:50px!important;--mdc-icon-size:50px}
      #dm-appliance-daily-popup .dm-appliance-daily-visual .dm-appliance-art,#dm-appliance-daily-popup .dm-appliance-daily-visual .dm-hero-art{display:grid!important;place-items:center!important;width:100%!important;height:100%!important}
      #dm-appliance-daily-popup .dm-appliance-daily-visual .dm-ap-img{display:block!important;width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;border-radius:15px!important;object-fit:cover!important;object-position:center!important;padding:0!important}

      @media(max-width:520px){
        #appl-grid-overview:not(.dm-appl-grid),#page-appliances-main .appl-page-grid,#page-appliances-main .appl-grid,#page-appliances-main [data-appliance-grid]{grid-template-columns:minmax(0,370px)!important;justify-content:center!important;gap:12px!important;padding-inline:10px!important}
        #page-appliances-main .appl-wide-card:not(.dm-ap-card),#appl-grid-overview .appl-wide-card:not(.dm-ap-card){grid-template-columns:92px minmax(0,1fr)!important;grid-template-rows:auto minmax(0,1fr) auto!important;grid-template-areas:"visual head" "visual live" "visual actions"!important;width:100%!important;max-width:370px!important;min-height:126px!important;border-radius:18px!important}
        #page-appliances-main .appl-wide-card>.appl-info,#appl-grid-overview .appl-wide-card>.appl-info{min-height:126px!important}
        #page-appliances-main .appl-heading,#appl-grid-overview .appl-heading{grid-template-columns:minmax(0,1fr) auto!important;padding:11px 10px 4px!important;gap:7px!important}
        #page-appliances-main .dm-appliance-head-icon,#appl-grid-overview .dm-appliance-head-icon{display:none!important}
        #page-appliances-main .appl-wide-name,#appl-grid-overview .appl-wide-name{font-size:14.5px!important}
        #page-appliances-main .appl-st,#appl-grid-overview .appl-st{max-width:80px!important;min-height:24px!important;padding:4px 6px!important;font-size:8.5px!important}
        #page-appliances-main .appl-visual,#appl-grid-overview .appl-visual{min-width:92px!important;min-height:126px!important;height:126px!important;padding:5px!important;border-right:1px solid rgba(148,163,184,.12)!important}
        #page-appliances-main .appl-wide-card .appl-visual>.appl-ic,#appl-grid-overview .appl-wide-card .appl-visual>.appl-ic{width:84px!important;height:84px!important;min-width:84px!important;min-height:84px!important;border-radius:17px!important}
        #page-appliances-main .appl-wide-card .appl-visual .dm-appliance-art,#appl-grid-overview .appl-wide-card .appl-visual .dm-appliance-art,#page-appliances-main .appl-wide-card .dm-appliance-image-wrap,#appl-grid-overview .appl-wide-card .dm-appliance-image-wrap{width:80px!important;height:80px!important;min-width:80px!important;min-height:80px!important}
        #page-appliances-main .appl-wide-card .appl-visual svg,#appl-grid-overview .appl-wide-card .appl-visual svg{width:78px!important;height:78px!important;max-width:78px!important;max-height:78px!important}
        #page-appliances-main .appl-live,#appl-grid-overview .appl-live{min-height:0!important;padding:3px 8px 4px 10px!important;border-top:0!important;background:transparent!important}
        #page-appliances-main .appl-actions,#appl-grid-overview .appl-actions{min-height:0!important;padding:3px 10px 9px 8px!important;border-top:0!important;background:transparent!important}
        #page-appliances-main .appl-primary strong,#appl-grid-overview .appl-primary strong,#page-appliances-main .appl-pwr,#appl-grid-overview .appl-pwr{font-size:19px!important}
        #page-appliances-main .appl-actions button,#appl-grid-overview .appl-actions button,#page-appliances-main [data-dm-power-toggle="true"]:not(.dm-ap-power),#appl-grid-overview [data-dm-power-toggle="true"]:not(.dm-ap-power){min-height:31px!important;height:31px!important;border-radius:10px!important;padding:5px 7px!important;font-size:9.5px!important}
        #page-appliances-main [data-dm-power-toggle="true"]:not(.dm-ap-power),#appl-grid-overview [data-dm-power-toggle="true"]:not(.dm-ap-power){min-width:86px!important}
        #dm-appliance-daily-popup .dm-appliance-daily-visual{left:14px!important;width:50px!important;height:50px!important;border-radius:17px!important}
        #dm-appliance-daily-popup .dm-appliance-daily-visual>.appl-ic{width:50px!important;height:50px!important;min-width:50px!important;min-height:50px!important}
        #dm-appliance-daily-popup .dm-appliance-daily-visual svg,#dm-appliance-daily-popup .dm-appliance-daily-visual ha-icon{width:46px!important;height:46px!important;max-width:46px!important;max-height:46px!important;--mdc-icon-size:46px}
      }

      @media(prefers-reduced-motion:reduce){#page-appliances-main .appl-wide-card *,#appl-grid-overview .appl-wide-card *{animation:none!important;transition:none!important}}
    `,
  );
}

export function installApplianceLayoutSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  installPopupArtworkBridge();
  installReferenceWrappers();
  scheduleReferenceCards();
  root.addEventListener?.("dashboardmodern:legacy-ready", () => {
    installReferenceWrappers();
    scheduleReferenceCards();
  });
  root.addEventListener?.("dashboardmodern:runtime-ready", scheduleReferenceCards);
  root.addEventListener?.("dashboardmodern:state-changed", scheduleReferenceCards);
  doc.addEventListener(
    "click",
    (event) => {
      if (
        event.target?.closest?.(
          "[data-tab='appliances-main'],[data-tab='appliances'],.appl-section-tab",
        )
      )
        root.queueMicrotask?.(scheduleReferenceCards);
    },
    true,
  );
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installApplianceLayoutSection, { once: true });
else installApplianceLayoutSection();
