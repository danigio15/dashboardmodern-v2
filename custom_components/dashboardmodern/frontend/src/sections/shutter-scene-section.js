import { allStates, clean, doc, esc, installStyle, root, t } from "./shared.js";

// Single paint owner for the Tapparelle page.
//
// The legacy runtime keeps every entity, service call and timer: this module
// only replaces renderTapparelle so the page draws a summary header, per-room
// headings and a card that carries a real position track next to the window,
// instead of a flat grid of windows with three arrow buttons. Commands still
// travel through the legacy cdTappCmd handler, which is what keeps the service
// domain and the vibration feedback identical to before.
//
// The window itself is skinned by shutter-section.js, which stays the owner of
// the first-paint geometry and of every legacy class this module reuses
// (.tapp-card, .tapp-win, .tapp-shutter, .tapp-state, .tapp-pos, .tapp-btn).
// That split is deliberate: if this owner never installs — an older runtime
// without renderTapparelle, for instance — the legacy markup still paints with
// the same skin instead of falling back to the raw 2015 stylesheet.
//
// The legacy loop repaints the page every 2s while it is visible. Rewriting
// innerHTML on each tick would fight the position track under the user's
// finger, so markup is built once per structural signature and afterwards only
// the values that changed are written.
const KEY = "__DASHBOARDMODERN_SHUTTER_SCENE_SECTION__";
const MARKER = "__dmShutterSceneOwner";
const STYLE_ID = "dm-shutter-scene-style";
const SUPPORT_SET_POSITION = 4;
const SLAT_COUNT = 8;
// How long a card keeps the position the user just asked for. Home Assistant
// reports the old position until the motor reaches the new one, so without this
// the track would snap back under the finger on the very next 2s repaint.
const GRAB_MS = 8000;

const state = (root[KEY] ||= {
  installed: false,
  frame: 0,
  signature: "",
  grabbed: new Map(),
});

/* ──────────────────────────────── model ─────────────────────────────────── */

function configuredCovers() {
  const legacy = root.getTapparelle?.();
  if (Array.isArray(legacy)) return legacy;
  const stored = root.dashboardStore?.()?.getSection?.("covers");
  return Array.isArray(stored) ? stored : [];
}

function floorOrder() {
  const names = root.cdFloorNames?.();
  return Array.isArray(names) ? names : [];
}

function coverView(item = {}) {
  const entity = clean(item.entity || item.entities?.[0]);
  if (!entity) return null;
  const current = allStates()[entity];
  const status = clean(current?.state).toLowerCase() || "unknown";
  const raw = current?.attributes?.current_position;
  const reported = raw == null ? null : Math.max(0, Math.min(100, Number(raw)));
  const hasPosition = Number.isFinite(reported);
  const features = Number(current?.attributes?.supported_features) || 0;
  const grab = state.grabbed.get(entity);
  const position = grab ? grab.position : hasPosition ? reported : status === "open" ? 100 : status === "closed" ? 0 : 50;
  const room = clean(item.room);
  return {
    entity,
    name: clean(item.name) || clean(current?.attributes?.friendly_name) || entity,
    room,
    floor: clean(root.cdRoomFloorOf?.(room)),
    status,
    position: Math.round(position),
    hasPosition: hasPosition || Boolean(grab),
    settable: Boolean(features & SUPPORT_SET_POSITION),
    moving: status === "opening" || status === "closing",
  };
}

function coverList() {
  const views = configuredCovers().map(coverView).filter(Boolean);
  const floors = floorOrder();
  const rank = (floor) => {
    const index = floors.indexOf(floor);
    return index < 0 ? Number.MAX_SAFE_INTEGER : index;
  };
  if (!views.some((view) => view.room)) return views;
  return views.sort((a, b) => {
    if (rank(a.floor) !== rank(b.floor)) return rank(a.floor) - rank(b.floor);
    const left = a.room || "￿";
    const right = b.room || "￿";
    return left === right ? 0 : left < right ? -1 : 1;
  });
}

function groupKey(view) {
  return `${view.floor}|${view.room}`;
}

function groupLabel(view) {
  if (!view.room) return t("Senza stanza", "No room");
  return view.floor ? `${view.floor} · ${view.room}` : view.room;
}

/**
 * Everything that changes the shape of the page, as opposed to a value inside
 * it. A new cover, a rename, a room move or a cover that starts reporting a
 * settable position rebuilds the markup; a position or a state change does not.
 */
function signature(views) {
  return views
    .map((view) => [view.entity, view.name, view.floor, view.room, view.settable].join("~"))
    .join("|");
}

function statusLabel(view) {
  if (view.status === "opening") return t("In apertura", "Opening");
  if (view.status === "closing") return t("In chiusura", "Closing");
  if (view.status === "open") return t("Aperta", "Open");
  if (view.status === "closed") return t("Chiusa", "Closed");
  return t("Sconosciuta", "Unknown");
}

function summaryText(views) {
  const moving = views.filter((view) => view.moving).length;
  const open = views.filter((view) => !view.moving && view.position > 0).length;
  const closed = views.length - moving - open;
  const parts = [];
  if (open) parts.push(open === 1 ? t("1 aperta", "1 open") : t(`${open} aperte`, `${open} open`));
  if (closed) parts.push(closed === 1 ? t("1 chiusa", "1 closed") : t(`${closed} chiuse`, `${closed} closed`));
  if (moving) parts.push(moving === 1 ? t("1 in movimento", "1 moving") : t(`${moving} in movimento`, `${moving} moving`));
  return parts.join(" · ");
}

/* ─────────────────────────────── markup ─────────────────────────────────── */

/**
 * The way back home, kept identical to the button the legacy runtime injects
 * into every other page — same class, same label, same behaviour, so it looks
 * and acts like the one on Clima or Temperature.
 *
 * It is rendered as the first item of the grid rather than left where the
 * legacy runtime puts it, which is as a direct child of the page section. That
 * position sits against the left edge of the viewport while the cards sit in a
 * centred column: on a 1440px screen the two were 180px apart. As a grid item
 * it lines up with the header and the cards at every width and column count.
 */
function backHomeMarkup() {
  return `<button type="button" class="back-home-btn dm-tapp-back" onclick="document.querySelector('[data-tab=&quot;home&quot;]').click(); if(navigator.vibrate)navigator.vibrate(5);">
    <span class="bh-icon">←</span><span>${esc(t("Home", "Home"))}</span>
  </button>`;
}

/** The legacy runtime's own copy, which would otherwise show up twice. */
function dropLegacyBackHome() {
  doc?.getElementById("page-tapparelle")
    ?.querySelectorAll(":scope > .back-home-btn")
    .forEach((button) => button.remove());
}

function heroMarkup() {
  return `<section class="dm-tapp-hero" data-dm-tapp-hero role="group" aria-labelledby="dm-tapp-hero-title">
    <div class="dm-tapp-hero-icon" aria-hidden="true">🪟</div>
    <div class="dm-tapp-hero-text">
      <div class="dm-tapp-hero-title" id="dm-tapp-hero-title" role="heading" aria-level="2">${esc(t("Tapparelle", "Shutters"))}</div>
      <div class="dm-tapp-hero-sub" data-dm-tapp-summary></div>
    </div>
    <div class="dm-tapp-hero-actions">
      <button type="button" class="tapp-btn dm-tapp-all" data-all="1" data-svc="open_cover" onclick="cdTappCmd(this)">▲ ${esc(t("Apri tutte", "Open all"))}</button>
      <button type="button" class="tapp-btn dm-tapp-all" data-all="1" data-svc="close_cover" onclick="cdTappCmd(this)">▼ ${esc(t("Chiudi tutte", "Close all"))}</button>
    </div>
  </section>`;
}

function groupMarkup(view, count) {
  const suffix = count === 1 ? t("tapparella", "shutter") : t("tapparelle", "shutters");
  return `<div class="dm-tapp-group" role="heading" aria-level="3">
    <span class="dm-tapp-group-label">${esc(groupLabel(view))}</span>
    <span class="dm-tapp-group-count">${count} ${esc(suffix)}</span>
  </div>`;
}

/**
 * The track is always drawn, so a cover that cannot be sent to a position still
 * shows one and every card in a row keeps the same window width. Only a cover
 * that reports SET_POSITION gets the input that makes it draggable.
 */
function trackMarkup(view) {
  if (!view.settable) return `<div class="dm-tapp-track" data-dm-static aria-hidden="true"></div>`;
  const label = t(`Posizione di ${view.name}`, `Position of ${view.name}`);
  return `<div class="dm-tapp-track">
    <input class="dm-tapp-range" type="range" min="0" max="100" step="1" value="${view.position}"
      aria-label="${esc(label)}" data-dm-position>
  </div>`;
}

function cardMarkup(view) {
  const slats = `<i></i>`.repeat(SLAT_COUNT);
  return `<article class="tapp-card dm-tapp-card" data-tapp="${esc(view.entity)}" data-dm-shutter-card>
    <div class="tapp-head dm-tapp-head">
      <span class="dm-tapp-title">
        <span class="tapp-name">${esc(view.name)}</span>
        ${view.room ? `<span class="dm-tapp-room">${esc(view.room)}</span>` : ""}
      </span>
      <span class="tapp-state" data-dm-state></span>
    </div>
    <div class="dm-tapp-stage">
      <div class="tapp-win">
        <div class="tapp-glass"></div>
        <div class="tapp-shutter" data-dm-panel>${slats}</div>
      </div>
      ${trackMarkup(view)}
    </div>
    <div class="dm-tapp-spill" aria-hidden="true"></div>
    <div class="tapp-pos" data-dm-readout></div>
    <div class="tapp-ctl">
      <button type="button" class="tapp-btn" data-svc="open_cover" onclick="cdTappCmd(this)" aria-label="${esc(t("Apri", "Open"))}">▲</button>
      <button type="button" class="tapp-btn" data-svc="stop_cover" onclick="cdTappCmd(this)" aria-label="${esc(t("Ferma", "Stop"))}">■</button>
      <button type="button" class="tapp-btn" data-svc="close_cover" onclick="cdTappCmd(this)" aria-label="${esc(t("Chiudi", "Close"))}">▼</button>
    </div>
  </article>`;
}

function gridMarkup(views) {
  const grouped = views.some((view) => view.room);
  let markup = backHomeMarkup() + heroMarkup();
  let lastKey = null;
  views.forEach((view) => {
    if (grouped && groupKey(view) !== lastKey) {
      lastKey = groupKey(view);
      markup += groupMarkup(view, views.filter((other) => groupKey(other) === lastKey).length);
    }
    markup += cardMarkup(view);
  });
  return markup;
}

/* ──────────────────────────────── paint ─────────────────────────────────── */

function syncCard(card, view) {
  card.style.setProperty("--tapp-open", String(view.position / 100));

  const badge = card.querySelector("[data-dm-state]");
  if (badge) {
    badge.className = `tapp-state tapp-st-${view.status}`;
    badge.textContent = statusLabel(view);
  }

  const panel = card.querySelector("[data-dm-panel]");
  if (panel) {
    panel.className = `tapp-shutter${view.status === "opening" ? " opening" : ""}${view.status === "closing" ? " closing" : ""}`;
    panel.style.height = `${100 - view.position}%`;
  }

  const readout = card.querySelector("[data-dm-readout]");
  if (readout) readout.textContent = view.hasPosition ? `${view.position}%` : "";

  const range = card.querySelector("[data-dm-position]");
  // Never write over a track the user is holding: doc.activeElement covers the
  // keyboard and the in-flight drag, the grab window covers the seconds the
  // motor needs before Home Assistant reports the position that was asked for.
  if (range && range !== doc.activeElement && !state.grabbed.has(view.entity)) {
    range.value = String(view.position);
  }
}

function renderShutters() {
  const grid = doc?.getElementById("tapp-grid");
  if (!grid) return;
  dropLegacyBackHome();
  const views = coverList();

  if (!views.length) {
    state.signature = "";
    grid.innerHTML = `${backHomeMarkup()}<div class="ed-empty dm-tapp-empty">${esc(t("Nessuna tapparella configurata", "No shutter configured"))}</div>`;
    return;
  }

  const current = signature(views);
  if (state.signature !== current || !grid.querySelector("[data-dm-shutter-card]")) {
    state.signature = current;
    grid.innerHTML = gridMarkup(views);
  }

  const summary = grid.querySelector("[data-dm-tapp-summary]");
  if (summary) summary.textContent = summaryText(views);

  views.forEach((view) => {
    const card = grid.querySelector(`[data-dm-shutter-card][data-tapp="${CSS.escape(view.entity)}"]`);
    if (card) syncCard(card, view);
  });
}

function paint() {
  state.frame = 0;
  installRenderOwner();
  renderShutters();
}

function schedule() {
  if (state.frame) return;
  state.frame = root.requestAnimationFrame?.(paint) || root.setTimeout?.(paint, 0) || 0;
}

function installRenderOwner() {
  const current = root.renderTapparelle;
  if (typeof current === "function" && current[MARKER]) return;
  function owned(...args) {
    renderShutters(...args);
  }
  owned[MARKER] = true;
  owned.__dmPrevious = current;
  root.renderTapparelle = owned;
}

/* ───────────────────────────── interaction ──────────────────────────────── */

function grab(entity, position) {
  const previous = state.grabbed.get(entity);
  if (previous?.timeout) root.clearTimeout?.(previous.timeout);
  const pending = { position };
  pending.timeout = root.setTimeout?.(() => {
    if (state.grabbed.get(entity) !== pending) return;
    state.grabbed.delete(entity);
    schedule();
  }, GRAB_MS) || 0;
  state.grabbed.set(entity, pending);
}

function cardOf(node) {
  return node?.closest?.("[data-dm-shutter-card]");
}

/**
 * Dragging repaints the card straight away instead of waiting for Home
 * Assistant, so the shutter follows the finger. Only the release sends the
 * command.
 */
function previewPosition(range) {
  const card = cardOf(range);
  if (!card) return;
  const position = Math.max(0, Math.min(100, Math.round(Number(range.value) || 0)));
  grab(clean(card.dataset.tapp), position);
  card.style.setProperty("--tapp-open", String(position / 100));
  const panel = card.querySelector("[data-dm-panel]");
  if (panel) panel.style.height = `${100 - position}%`;
  const readout = card.querySelector("[data-dm-readout]");
  if (readout) readout.textContent = `${position}%`;
}

async function commitPosition(range) {
  const card = cardOf(range);
  const entity = clean(card?.dataset.tapp);
  if (!entity) return;
  const position = Math.max(0, Math.min(100, Math.round(Number(range.value) || 0)));
  grab(entity, position);
  try {
    await root.dmCallHaService?.("cover", "set_cover_position", {
      entity_id: entity,
      position,
    });
  } catch (error) {
    root.console?.error?.("[DashboardModern] shutter position", error);
  }
  schedule();
}

function installListeners() {
  if (!doc) return;
  doc.addEventListener("input", (event) => {
    const range = event.target?.closest?.("[data-dm-position]");
    if (range) previewPosition(range);
  });
  doc.addEventListener("change", (event) => {
    const range = event.target?.closest?.("[data-dm-position]");
    if (range) commitPosition(range);
  });
  doc.addEventListener("click", (event) => {
    if (event.target?.closest?.("#page-tapparelle .tapp-btn")) root.queueMicrotask?.(schedule);
  });
  for (const eventName of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:persistence-restored",
    "dashboardmodern:config-reset",
    "dashboardmodern:state-changed",
  ]) {
    root.addEventListener?.(eventName, schedule);
  }
}

/* ──────────────────────────────── styles ────────────────────────────────── */

function installStyles() {
  installStyle(STYLE_ID, `
    /* Structure only. Every legacy class this page reuses keeps its skin — and
       its first-paint geometry — in shutter-section.js. */
    html body #page-tapparelle#page-tapparelle .dm-tapp-hero{
      grid-column:1/-1!important;display:flex!important;align-items:center!important;gap:14px!important;flex-wrap:wrap!important;
      box-sizing:border-box!important;margin:0 0 4px!important;padding:16px 18px!important;
      border:1px solid var(--tapp-border)!important;border-radius:22px!important;background:var(--tapp-surface)!important;
      box-shadow:var(--tapp-shadow)!important}
    html body #page-tapparelle#page-tapparelle .dm-tapp-hero-icon{
      display:grid!important;place-items:center!important;flex:0 0 auto!important;width:48px!important;height:48px!important;
      border-radius:16px!important;background:var(--tapp-run-bg)!important;border:1px solid var(--tapp-run-line)!important;font-size:24px!important}
    html body #page-tapparelle#page-tapparelle .dm-tapp-hero-text{flex:1 1 190px!important;min-width:0!important}
    html body #page-tapparelle#page-tapparelle .dm-tapp-hero-title{
      margin:0!important;color:var(--tapp-text)!important;font-size:19px!important;font-weight:950!important;letter-spacing:.2px!important}
    html body #page-tapparelle#page-tapparelle .dm-tapp-hero-sub{
      margin:3px 0 0!important;color:var(--tapp-dim)!important;font-size:12px!important;font-weight:800!important;letter-spacing:.5px!important}
    html body #page-tapparelle#page-tapparelle .dm-tapp-hero-actions{display:flex!important;gap:10px!important;flex:0 1 auto!important;flex-wrap:wrap!important}
    html body #page-tapparelle#page-tapparelle .dm-tapp-hero-actions .tapp-btn{flex:0 1 auto!important}

    html body #page-tapparelle#page-tapparelle .dm-tapp-group{
      grid-column:1/-1!important;display:flex!important;align-items:center!important;gap:10px!important;
      margin:10px 2px 0!important;padding:0!important;color:var(--tapp-dim)!important;
      font-size:11px!important;font-weight:900!important;letter-spacing:1.5px!important;text-transform:uppercase!important}
    html body #page-tapparelle#page-tapparelle .dm-tapp-group-count{
      flex:0 0 auto!important;padding:2px 9px!important;border:1px solid var(--tapp-pill-line)!important;border-radius:999px!important;
      background:var(--tapp-pill)!important;font-size:10px!important;letter-spacing:.6px!important}
    html body #page-tapparelle#page-tapparelle .dm-tapp-group::after{
      content:""!important;flex:1 1 auto!important;height:1px!important;order:9!important;
      background:linear-gradient(90deg,var(--tapp-border),transparent)!important}

    html body #page-tapparelle#page-tapparelle .dm-tapp-title{display:flex!important;flex-direction:column!important;gap:1px!important;min-width:0!important}
    html body #page-tapparelle#page-tapparelle .dm-tapp-room{
      overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;
      color:var(--tapp-dim)!important;font-size:10px!important;font-weight:900!important;letter-spacing:1px!important;text-transform:uppercase!important}

    html body #page-tapparelle#page-tapparelle .dm-tapp-stage{display:flex!important;align-items:stretch!important;gap:10px!important;min-width:0!important}
    html body #page-tapparelle#page-tapparelle .dm-tapp-stage .tapp-win{flex:1 1 auto!important;min-width:0!important}

    /* The track is the window in miniature: the shut part of the gradient is the
       panel, the open part is the sky, and the thumb rides the closing edge. */
    html body #page-tapparelle#page-tapparelle .dm-tapp-track{
      position:relative!important;flex:0 0 34px!important;box-sizing:border-box!important;height:132px!important;
      border:1px solid var(--tapp-pill-line)!important;border-radius:13px!important;overflow:hidden!important;
      background:linear-gradient(180deg,var(--tapp-slat-base) 0 calc((1 - var(--tapp-open,0)) * 100%),var(--tapp-track-sky) calc((1 - var(--tapp-open,0)) * 100%) 100%)!important;
      box-shadow:inset 0 1px 3px rgba(15,23,42,.28)!important;touch-action:none!important}
    html body #page-tapparelle#page-tapparelle .dm-tapp-track[data-dm-static]{opacity:.55!important}
    html body #page-tapparelle#page-tapparelle .dm-tapp-range{
      position:absolute!important;left:50%!important;top:50%!important;box-sizing:border-box!important;
      width:132px!important;height:34px!important;margin:0!important;padding:0!important;border:0!important;
      transform:translate(-50%,-50%) rotate(-90deg)!important;appearance:none!important;-webkit-appearance:none!important;
      background:transparent!important;cursor:ns-resize!important}
    html body #page-tapparelle#page-tapparelle .dm-tapp-range::-webkit-slider-runnable-track{height:34px;background:transparent;border:0}
    html body #page-tapparelle#page-tapparelle .dm-tapp-range::-webkit-slider-thumb{
      -webkit-appearance:none;width:22px;height:14px;border-radius:5px;border:1px solid rgba(15,23,42,.35);
      background:linear-gradient(180deg,#fdfeff,#c9d3e0);box-shadow:0 2px 5px rgba(15,23,42,.4)}
    html body #page-tapparelle#page-tapparelle .dm-tapp-range::-moz-range-track{height:34px;background:transparent;border:0}
    html body #page-tapparelle#page-tapparelle .dm-tapp-range::-moz-range-thumb{
      width:22px;height:14px;border-radius:5px;border:1px solid rgba(15,23,42,.35);
      background:linear-gradient(180deg,#fdfeff,#c9d3e0);box-shadow:0 2px 5px rgba(15,23,42,.4)}
    html body #page-tapparelle#page-tapparelle .dm-tapp-range:focus-visible{outline:3px solid color-mix(in srgb,var(--tapp-accent) 55%,transparent)!important;outline-offset:2px!important}

    /* Daylight reaching the room, as much of it as the shutter lets through. */
    html body #page-tapparelle#page-tapparelle .dm-tapp-spill{
      height:12px!important;margin:-6px 10px -4px!important;border-radius:0 0 16px 16px!important;
      background:radial-gradient(62% 100% at 50% 0,var(--tapp-spill),transparent 72%)!important;
      opacity:var(--tapp-open,0)!important;pointer-events:none!important}

    html body #page-tapparelle#page-tapparelle .dm-tapp-empty{grid-column:1/-1!important}
    html body #page-tapparelle#page-tapparelle .back-home-btn.dm-tapp-back{grid-column:1/-1!important;justify-self:start!important;margin:0 0 4px!important}

    @media(max-width:560px){
      html body #page-tapparelle#page-tapparelle .dm-tapp-hero{padding:14px!important;gap:12px!important}
      html body #page-tapparelle#page-tapparelle .dm-tapp-hero-actions{flex:1 1 100%!important}
      html body #page-tapparelle#page-tapparelle .dm-tapp-hero-actions .tapp-btn{flex:1 1 0!important}
    }
  `);
}

export function installShutterSceneSection() {
  if (!doc) return;
  installStyles();
  installRenderOwner();
  if (!state.installed) {
    state.installed = true;
    installListeners();
  }
  schedule();
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", installShutterSceneSection, { once: true });
} else {
  installShutterSceneSection();
}
