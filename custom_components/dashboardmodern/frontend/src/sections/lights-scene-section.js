import {
  hexToRgb,
  hsvToRgb,
  kelvinToHex,
  lightColorHex,
  lightCommand,
  lightSummary,
  lightView,
  lightsSignature,
  readableInk,
  rgbToHex,
  rgbToHsv,
} from "../core/light-model.js";
import { configuredLightGroups } from "./lights-alerts-section.js";
import { roomOrderRank } from "../core/room-overview.js";
import { allStates, clean, doc, esc, installStyle, readJson, root, scriviSeCambia, section, t } from "./shared.js";

/* Single paint owner for the Gestione Luci popup and for the controls of one
 * light.
 *
 * The legacy popup could do exactly one thing: tap a card, the light toggles.
 * A dimmer had no dimmer, an RGB strip had no colour, a tunable white had no
 * white, and every card was painted the same amber whatever the lamp was
 * actually emitting. This module keeps the popup's bookkeeping in the legacy
 * runtime — `apriGestioneLuci` still owns `currentPopupType`, which is a
 * lexical binding this module cannot reach, and the tick still calls
 * `updateGestioneLuci` through it — and takes over the two things that are
 * about the lights themselves: what the list looks like, and what a light can
 * be asked to do.
 *
 * What each light can be asked to do is decided by the entity, never by the
 * domain: a lamp behind a relay is configured as a `switch.` and gets a power
 * button, a dimmer gets a brightness track on the card, and a colour lamp gets
 * the swatches, the hue/saturation pair and the white-point track in the
 * control sheet. `core/light-model.js` is the single place that reads those
 * capabilities and builds the service call.
 *
 * The list is rebuilt only when its shape changes — a new light, a rename, a
 * room move, a lamp that starts reporting a colour. On/off, brightness and
 * colour are written into the existing cards, because the legacy tick repaints
 * every two seconds and rewriting innerHTML would drop the slider under the
 * user's finger.
 */

const KEY = "__DASHBOARDMODERN_LIGHTS_SCENE_SECTION__";
const MARKER = "__dmLightsSceneOwner";
const STYLE_ID = "dm-lights-scene-style";
const CONTROL_ID = "dm-light-control-modal";
const LIST_ID = "details-list";

/* How long a value the user just set wins over what Home Assistant reports.
 * A lamp keeps reporting its previous brightness until the transition ends, so
 * without this the slider would snap back under the finger on the next tick. */
const HOLD_MS = 6000;

/* A drag emits an event per pixel. The lamp gets one call every so often while
 * the finger moves, and the exact value on release. */
const LIVE_MS = 320;

const state = (root[KEY] ||= {
  installed: false,
  listeners: false,
  signature: "",
  holds: new Map(),
  live: 0,
  liveAt: 0,
});

const SWATCHES = Object.freeze([
  { hex: "#ff2d2d", it: "Rosso", en: "Red" },
  { hex: "#ff6b1a", it: "Arancione", en: "Orange" },
  { hex: "#ffb300", it: "Ambra", en: "Amber" },
  { hex: "#ffe066", it: "Giallo", en: "Yellow" },
  { hex: "#7bd94a", it: "Verde", en: "Green" },
  { hex: "#18c39a", it: "Verde acqua", en: "Teal" },
  { hex: "#25d3ee", it: "Ciano", en: "Cyan" },
  { hex: "#2f7bff", it: "Blu", en: "Blue" },
  { hex: "#6d4bff", it: "Indaco", en: "Indigo" },
  { hex: "#b64bff", it: "Viola", en: "Violet" },
  { hex: "#ff4bd8", it: "Magenta", en: "Magenta" },
  { hex: "#ffd9c2", it: "Bianco caldo", en: "Warm white" },
]);

const KELVIN_PRESETS = Object.freeze([
  { kelvin: 2200, it: "Candela", en: "Candle" },
  { kelvin: 2700, it: "Caldo", en: "Warm" },
  { kelvin: 4000, it: "Neutro", en: "Neutral" },
  { kelvin: 5500, it: "Freddo", en: "Cool" },
  { kelvin: 6500, it: "Luce diurna", en: "Daylight" },
]);

const BRIGHTNESS_PRESETS = Object.freeze([1, 25, 50, 75, 100]);

/* ──────────────────────────────── model ─────────────────────────────────── */

function popupFilter() {
  const filter = root._luciPopupFilter;
  return Array.isArray(filter) && filter.length ? new Set(filter.map(clean)) : null;
}

function heldValue(id, field) {
  const hold = state.holds.get(`${id}:${field}`);
  if (!hold) return null;
  if (hold.expires <= Date.now()) {
    state.holds.delete(`${id}:${field}`);
    return null;
  }
  return hold.value;
}

function holdValue(id, field, value) {
  state.holds.set(`${id}:${field}`, { value, expires: Date.now() + HOLD_MS });
}

function releaseHolds(id) {
  for (const key of [...state.holds.keys()]) {
    if (key.startsWith(`${id}:`)) state.holds.delete(key);
  }
}

/**
 * Every configured light, in the order the Luci tab put it, plus the lights the
 * legacy runtime monitors without them being configured. A light whose entity
 * is missing is kept and marked unavailable: dropping it would make a broken
 * integration look like a deleted light.
 */
function lightViews() {
  const names = readJson("cd_luci", {});
  const states = allStates();
  const allowed = popupFilter();
  const seen = new Set();
  const entries = [];
  for (const group of configuredLightGroups()) {
    for (const id of group.entities) {
      if (seen.has(id)) continue;
      seen.add(id);
      entries.push({ id, room: group.room });
    }
  }
  const monitored = root.cdLightList?.();
  for (const id of Array.isArray(monitored) ? monitored.map(clean) : []) {
    if (!id.includes(".") || seen.has(id)) continue;
    seen.add(id);
    entries.push({ id, room: t("Altre zone", "Other areas") });
  }
  return entries
    .filter(({ id }) => !allowed || allowed.has(id))
    .map(({ id, room }) =>
      lightView(id, {
        name: names[id],
        state: states[id],
        room,
        floor: clean(root.cdRoomFloorOf?.(room)),
      }),
    );
}

/**
 * The legacy grouping, kept as it was: a room with two or more lights gets its
 * own heading, a room with one is merged into the closing group where the card
 * carries the room as its title. Rooms follow the floor order the user set.
 */
/* Quale stanza viene prima, secondo la configurazione.
 *
 * L'ordine lo decide chi ci abita, nella scheda Stanze, e la risposta la da'
 * il nucleo: qui si legge soltanto l'elenco salvato. La domanda la fanno tre
 * pagine, e per un po' era passata da `shared` — che pero' e' la base che
 * ogni sezione carica per prima, e farle crescere una dipendenza per comodita'
 * di tre chiamanti sposta l'ordine in cui si avvia tutto il resto. */
function ordineStanze() {
  try {
    return roomOrderRank(section("rooms", readJson("cd_stanze", [])) || []);
  } catch (_error) {
    return () => Number.MAX_SAFE_INTEGER;
  }
}

function lightGroups(views) {
  const floors = root.cdFloorNames?.();
  const order = Array.isArray(floors) ? floors : [];
  const rank = (floor) => {
    const index = order.indexOf(floor);
    return index < 0 ? Number.MAX_SAFE_INTEGER : index;
  };
  const others = t("Altre zone", "Other areas");
  const rooms = new Map();
  for (const view of views) {
    const room = view.room || others;
    if (!rooms.has(room)) rooms.set(room, []);
    rooms.get(room).push(view);
  }
  const groups = [];
  const singles = [];
  for (const [room, members] of rooms) {
    if (room !== others && members.length === 1) {
      singles.push(members[0]);
      continue;
    }
    if (room === others) {
      singles.push(...members);
      continue;
    }
    groups.push({ room, floor: members[0].floor, views: members, merged: false });
  }
  /* Dentro il piano, le stanze nell'ordine scelto in configurazione. Prima
   * qui non si ordinava affatto: le stanze uscivano nell'ordine in cui le luci
   * erano state configurate, che non e' un ordine che qualcuno abbia scelto. */
  const stanza = ordineStanze();
  groups.sort(
    (left, right) => rank(left.floor) - rank(right.floor) || stanza(left.room) - stanza(right.room),
  );
  if (singles.length) groups.push({ room: others, floor: "", views: singles, merged: true });
  return groups;
}

function cardColor(view) {
  const hex = heldValue(view.id, "hex");
  if (hex && view.on) return hex;
  const kelvin = heldValue(view.id, "kelvin");
  if (kelvin && view.on) return kelvinToHex(kelvin);
  return lightColorHex(view);
}

function cardLevel(view) {
  if (!view.on) return 0;
  const held = heldValue(view.id, "brightness");
  if (held != null) return held;
  return view.brightness == null ? 100 : view.brightness;
}

function stateText(view) {
  if (!view.available) return t("NON DISPONIBILE", "UNAVAILABLE");
  if (!view.on) return t("SPENTA", "OFF");
  const level = cardLevel(view);
  return view.dimmable ? `${t("ACCESA", "ON")} · ${level}%` : t("ACCESA", "ON");
}

/* One badge, not a list of them: on a card two lines of pills push the status
 * LED off the row, and what the user needs at a glance is the strongest thing
 * this light can do. The full set stays in the Luci tab, where there is room
 * for it. */
function capabilityBadges(view) {
  if (view.domain !== "light") return [{ kind: "switch", label: "SWITCH" }];
  if (view.colorful) return [{ kind: "rgb", label: "RGB" }];
  if (view.tunable) return [{ kind: "white", label: t("BIANCO", "WHITE") }];
  if (view.dimmable) return [{ kind: "dim", label: t("DIMMER", "DIMMER") }];
  return [];
}

/* ──────────────────────────────── markup ────────────────────────────────── */

const BULB = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1h6c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2Z"/></svg>`;
const PLUG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-6 6 6 6 0 0 1-6-6V8ZM12 17v5"/></svg>`;
/* The controls button carries a drawn slider rather than an emoji: the control
 * knobs glyph renders as a grey box on the platforms this dashboard runs on. */
const SLIDERS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2.2"/><circle cx="10" cy="17" r="2.2"/></svg>`;

function cardMarkup(view, showRoom) {
  const title = showRoom && view.room ? view.room : view.name;
  const subtitle = showRoom && view.room && view.room !== view.name ? view.name : "";
  const badges = capabilityBadges(view)
    .map((badge) => `<span class="dm-lightx-badge" data-kind="${badge.kind}">${badge.label}</span>`)
    .join("");
  const level = cardLevel(view);
  const dimmer = view.dimmable
    ? `<label class="dm-lightx-dim"><span class="dm-lightx-dim-lbl">${t("Luminosità", "Brightness")}</span><input class="dm-lightx-range" type="range" min="0" max="100" step="1" value="${level}" data-dm-light-brightness aria-label="${t("Luminosità", "Brightness")} ${esc(view.name)}"></label>`
    : "";
  const tools =
    view.dimmable || view.colorful || view.tunable || view.effects.length
      ? `<button type="button" class="dm-lightx-tune" data-dm-light-open aria-label="${t("Controlli di", "Controls for")} ${esc(view.name)}">${SLIDERS}</button>`
      : "";
  return `<article class="lgx-card dm-lightx-card ${view.on ? "is-on" : ""}" data-luce="${esc(view.id)}" data-dm-light="${esc(view.id)}" data-dm-light-available="${view.available}" style="--dm-light-color:${esc(cardColor(view))};--dm-light-ink:${readableInk(cardColor(view))};--dm-light-level:${view.on ? Math.max(12, level) : 0}%">
    <div class="lgx-glow"></div>
    <button type="button" class="dm-lightx-main" data-dm-light-toggle aria-pressed="${view.on}">
      <span class="lgx-row-top">
        <span class="lgx-orb dm-lightx-orb">${view.domain === "light" ? BULB : PLUG}</span>
        <span class="dm-lightx-badges">${badges}</span>
        <span class="lgx-led ${view.on ? "on" : ""}"></span>
      </span>
      <span class="lgx-name">${esc(title)}</span>
      ${subtitle ? `<span class="lgx-sub">${esc(subtitle)}</span>` : ""}
      <span class="lgx-state" data-dm-light-state>${stateText(view)}</span>
    </button>
    ${dimmer || tools ? `<div class="dm-lightx-tools">${dimmer}${tools}</div>` : ""}
  </article>`;
}

function groupMarkup(group, previousFloor) {
  const summary = lightSummary(group.views);
  const floorHeading =
    group.floor && group.floor !== previousFloor
      ? `<div class="lgx-zona dm-lightx-floor">🏢 ${esc(group.floor.toUpperCase())}</div>`
      : "";
  const action = summary.on ? "off" : "on";
  const label = summary.on ? t("Spegni", "All off") : t("Accendi", "All on");
  return `${floorHeading}<div class="dm-lightx-room" data-dm-light-group="${esc(group.room)}">
      <span class="lgx-zona dm-lightx-room-name">${esc(group.room.toUpperCase())}</span>
      <span class="dm-lightx-room-count">${summary.on}/${summary.total}</span>
      <button type="button" class="dm-lightx-room-btn" data-dm-light-room="${action}" data-dm-light-room-name="${esc(group.room)}">${label}</button>
    </div>
    <div class="lgx-grid">${group.views.map((view) => cardMarkup(view, group.merged)).join("")}</div>`;
}

/** The whole popup list for a set of views. Exported so the shape of the list
 * — which light gets a dimmer, which gets the controls button, what the empty
 * state says — can be asserted without a browser. */
export function renderLightsPopupMarkup(views) {
  const summary = lightSummary(views);
  const counter = summary.on
    ? `<b>${summary.on}</b><span>${summary.on === 1 ? t("accesa", "on") : t("accese", "on")}</span>`
    : `<span>${t("Tutte spente", "All off")}</span>`;
  const bar = `<div class="lgx-bar dm-lightx-bar">
      <div class="lgx-bar-l"><span class="lgx-dot ${summary.on ? "active" : ""}"></span>${counter}</div>
      ${summary.on ? `<div class="lgx-alloff" data-dm-light-all="off">${t("Spegni tutte", "Turn all off")}</div>` : ""}
    </div>`;
  if (!views.length)
    return `${bar}<div class="dm-lightx-empty">${t("Nessuna luce configurata. Aggiungile dalla scheda Luci dell'editor: accetta sia entità light.* sia switch.*.", "No configured lights. Add them from the editor's Lights tab: both light.* and switch.* entities are accepted.")}</div>`;
  let floor = "";
  const body = lightGroups(views)
    .map((group) => {
      const markup = groupMarkup(group, floor);
      if (group.floor) floor = group.floor;
      return markup;
    })
    .join("");
  return `${bar}${body}`;
}

/* ─────────────────────────────── painting ───────────────────────────────── */

function listNode() {
  return doc?.getElementById(LIST_ID) || null;
}

function paint() {
  const list = listNode();
  if (!list) return false;
  const views = lightViews();
  const scrollTop = list.scrollTop;
  list.innerHTML = renderLightsPopupMarkup(views);
  list.scrollTop = scrollTop;
  state.signature = lightsSignature(views);
  return true;
}

function syncCard(card, view) {
  card.classList.toggle("is-on", view.on);
  card.dataset.dmLightAvailable = String(view.available);
  const color = cardColor(view);
  card.style.setProperty("--dm-light-color", color);
  card.style.setProperty("--dm-light-ink", readableInk(color));
  const level = cardLevel(view);
  card.style.setProperty("--dm-light-level", view.on ? `${Math.max(12, level)}%` : "0%");
  card.querySelector(".lgx-led")?.classList.toggle("on", view.on);
  card.querySelector("[data-dm-light-toggle]")?.setAttribute("aria-pressed", String(view.on));
  const label = card.querySelector("[data-dm-light-state]");
  const text = stateText(view);
  if (label && label.textContent !== text) label.textContent = text;
  const range = card.querySelector("[data-dm-light-brightness]");
  if (range && doc.activeElement !== range) range.value = String(level);
}

function popupShowing() {
  return Boolean(doc?.getElementById("details-modal")?.classList?.contains("show"));
}

function sync() {
  const list = listNode();
  if (!list) return false;
  const views = lightViews();
  const painted = Boolean(list.querySelector("[data-dm-light]"));
  /* The list is shared with the other popups of the runtime. Repainting it
   * without our own cards in it is only ever right while this popup is the one
   * on screen; the sheet opened from the editor keeps updating either way. */
  if (!painted && !popupShowing()) {
    syncControl();
    return false;
  }
  if (!painted || lightsSignature(views) !== state.signature) return paint();
  const byId = new Map(views.map((view) => [view.id, view]));
  for (const card of list.querySelectorAll("[data-dm-light]")) {
    const view = byId.get(card.dataset.dmLight);
    if (view) syncCard(card, view);
  }
  const groups = new Map(lightGroups(views).map((group) => [group.room, group.views]));
  for (const heading of list.querySelectorAll("[data-dm-light-group]")) {
    const summary = lightSummary(groups.get(heading.dataset.dmLightGroup) || []);
    const count = heading.querySelector(".dm-lightx-room-count");
    const text = `${summary.on}/${summary.total}`;
    if (count && count.textContent !== text) count.textContent = text;
    const button = heading.querySelector("[data-dm-light-room]");
    if (button) {
      button.dataset.dmLightRoom = summary.on ? "off" : "on";
      const label = summary.on ? t("Spegni", "All off") : t("Accendi", "All on");
      if (button.textContent !== label) button.textContent = label;
    }
  }
  const summary = lightSummary(views);
  const bar = list.querySelector(".dm-lightx-bar");
  if (bar) {
    const counter = summary.on
      ? `<b>${summary.on}</b><span>${summary.on === 1 ? t("accesa", "on") : t("accese", "on")}</span>`
      : `<span>${t("Tutte spente", "All off")}</span>`;
    const markup = `<div class="lgx-bar-l"><span class="lgx-dot ${summary.on ? "active" : ""}"></span>${counter}</div>${summary.on ? `<div class="lgx-alloff" data-dm-light-all="off">${t("Spegni tutte", "Turn all off")}</div>` : ""}`;
    scriviSeCambia(bar, markup);
  }
  syncControl();
  return true;
}

/* ─────────────────────────────── commands ───────────────────────────────── */

function viewOf(id) {
  const entity = clean(id);
  if (!entity) return null;
  const names = readJson("cd_luci", {});
  return lightView(entity, { name: names[entity], state: allStates()[entity] });
}

function send(view, change) {
  const command = lightCommand(view, change);
  if (!command) return;
  try {
    if (typeof root.dmCallHaService === "function") {
      const result = root.dmCallHaService(command.domain, command.service, command.data);
      result?.catch?.(() => {});
      return;
    }
    if (command.service === "toggle") root.toggle?.(view.id);
  } catch (_error) {}
}

function feedback(pattern = 10) {
  try {
    root.navigator?.vibrate?.(pattern);
  } catch (_error) {}
}

/**
 * Paint one requested value without rebuilding anything.
 *
 * A drag emits an event per pixel: recomputing every light on each of them
 * would read storage and the whole state registry dozens of times per second,
 * so only the card and the sheet of this one light are written.
 */
function applyLive(view, field, value) {
  const color = field === "hex" ? value : field === "kelvin" ? kelvinToHex(value) : cardColor(view);
  const level = field === "brightness" ? value : cardLevel(view);
  /* Any of these changes lights the lamp: asking an unlit strip for a colour
   * turns it on with that colour, so the card lights up with it instead of
   * waiting for the state to come back. */
  const on = field !== "brightness" || value > 0;
  const card = listNode()?.querySelector(`[data-dm-light="${view.id}"]`) || null;
  const dialog = controlNode()?.querySelector(".dm-lightctl-dialog") || null;
  for (const node of [card, dialog]) {
    if (!node) continue;
    node.style.setProperty("--dm-light-color", color);
    node.style.setProperty("--dm-light-ink", readableInk(color));
    node.style.setProperty("--dm-light-level", on ? `${Math.max(12, level)}%` : "0%");
  }
  if (card) {
    card.classList.toggle("is-on", on);
    card.querySelector(".lgx-led")?.classList.toggle("on", on);
    const label = card.querySelector("[data-dm-light-state]");
    if (label) label.textContent = view.dimmable ? `${t("ACCESA", "ON")} · ${level}%` : t("ACCESA", "ON");
  }
  const modal = controlNode();
  if (!modal) return;
  const hero = modal.querySelector("[data-dm-light-hero-state]");
  if (hero) hero.textContent = view.dimmable ? `${t("ACCESA", "ON")} · ${level}%` : t("ACCESA", "ON");
  const percent = modal.querySelector("[data-dm-light-level]");
  if (percent) percent.textContent = `${level}%`;
  const kelvin = modal.querySelector("[data-dm-light-kelvin-value]");
  if (kelvin && field === "kelvin") kelvin.textContent = `${value} K`;
  const preview = modal.querySelector("[data-dm-light-hex]");
  if (preview && field === "hex" && doc.activeElement !== preview) preview.value = value;
}

/**
 * A change the user is still making. The value is applied at once so the slider
 * tracks the finger, held so the next tick does not undo it, and sent to Home
 * Assistant at most every LIVE_MS until the drag ends.
 */
function live(view, change, field, value, { commit = false } = {}) {
  holdValue(view.id, field, value);
  applyLive(view, field, value);
  const now = Date.now();
  if (state.live) {
    root.clearTimeout?.(state.live);
    state.live = 0;
  }
  if (commit || now - state.liveAt >= LIVE_MS) {
    state.liveAt = now;
    send(view, change);
  } else {
    state.live = root.setTimeout?.(() => {
      state.live = 0;
      state.liveAt = Date.now();
      send(view, change);
    }, LIVE_MS);
  }
}

function toggleLight(id) {
  const view = viewOf(id);
  if (!view) return;
  feedback();
  releaseHolds(view.id);
  send(view, { power: !view.on });
  sync();
}

function setRoomPower(room, on) {
  feedback(15);
  const group = lightGroups(lightViews()).find((item) => item.room === room);
  for (const view of group?.views || []) {
    if (view.on === on) continue;
    releaseHolds(view.id);
    send(view, { power: on });
  }
  sync();
}

function allOff() {
  feedback(15);
  for (const view of lightViews()) {
    if (!view.on) continue;
    releaseHolds(view.id);
    send(view, { power: false });
  }
  sync();
}

/* ───────────────────────── control sheet for one light ──────────────────── */

function controlNode() {
  return doc?.getElementById(CONTROL_ID) || null;
}

function hueFrom(view) {
  const hex = heldValue(view.id, "hex") || (view.rgb ? rgbToHex(view.rgb) : "");
  return hex ? rgbToHsv(hexToRgb(hex)) : [40, 60, 100];
}

/** The control sheet for one light, built from what that light declares. */
export function renderLightControlMarkup(view) {
  const level = cardLevel(view);
  const [hue, saturation] = hueFrom(view);
  const color = cardColor(view);
  const kelvin = heldValue(view.id, "kelvin") || view.kelvin || Math.round((view.minKelvin + view.maxKelvin) / 2);
  const brightness = view.dimmable
    ? `<section class="dm-lightctl-block" data-block="brightness">
        <div class="dm-lightctl-block-head"><span>${t("Luminosità", "Brightness")}</span><b data-dm-light-level>${level}%</b></div>
        <input class="dm-lightctl-range dm-lightctl-dim" type="range" min="0" max="100" step="1" value="${level}" data-dm-light-brightness aria-label="${t("Luminosità", "Brightness")}">
        <div class="dm-lightctl-presets">${BRIGHTNESS_PRESETS.map((value) => `<button type="button" data-dm-light-brightness-preset="${value}">${value}%</button>`).join("")}</div>
      </section>`
    : "";
  const colorBlock = view.colorful
    ? `<section class="dm-lightctl-block" data-block="color">
        <div class="dm-lightctl-block-head"><span>${t("Colore", "Colour")}</span><span class="dm-lightctl-preview" data-dm-light-preview></span></div>
        <div class="dm-lightctl-swatches">${SWATCHES.map((swatch) => `<button type="button" class="dm-lightctl-swatch" data-dm-light-color="${swatch.hex}" style="--dm-swatch:${swatch.hex}" title="${t(swatch.it, swatch.en)}" aria-label="${t(swatch.it, swatch.en)}"></button>`).join("")}</div>
        <label class="dm-lightctl-slot"><span>${t("Tinta", "Hue")}</span><input class="dm-lightctl-range dm-lightctl-hue" type="range" min="0" max="360" step="1" value="${hue}" data-dm-light-hue aria-label="${t("Tinta", "Hue")}"></label>
        <label class="dm-lightctl-slot"><span>${t("Saturazione", "Saturation")}</span><input class="dm-lightctl-range dm-lightctl-sat" type="range" min="0" max="100" step="1" value="${saturation}" data-dm-light-saturation aria-label="${t("Saturazione", "Saturation")}"></label>
        <label class="dm-lightctl-exact"><span>${t("Colore esatto", "Exact colour")}</span><input type="color" value="${esc(color)}" data-dm-light-hex aria-label="${t("Colore esatto", "Exact colour")}"></label>
      </section>`
    : "";
  const whiteBlock = view.tunable
    ? `<section class="dm-lightctl-block" data-block="white">
        <div class="dm-lightctl-block-head"><span>${t("Bianco", "White")}</span><b data-dm-light-kelvin-value>${kelvin} K</b></div>
        <input class="dm-lightctl-range dm-lightctl-kelvin" type="range" min="${view.minKelvin}" max="${view.maxKelvin}" step="50" value="${kelvin}" data-dm-light-kelvin aria-label="${t("Temperatura colore", "Colour temperature")}">
        <div class="dm-lightctl-presets">${KELVIN_PRESETS.filter((preset) => preset.kelvin >= view.minKelvin && preset.kelvin <= view.maxKelvin)
          .map(
            (preset) =>
              `<button type="button" data-dm-light-kelvin-preset="${preset.kelvin}" style="--dm-swatch:${kelvinToHex(preset.kelvin)}">${t(preset.it, preset.en)}</button>`,
          )
          .join("")}</div>
      </section>`
    : "";
  const effectBlock = view.effects.length
    ? `<section class="dm-lightctl-block" data-block="effect">
        <div class="dm-lightctl-block-head"><span>${t("Effetto", "Effect")}</span></div>
        <select class="dm-lightctl-select" data-dm-light-effect aria-label="${t("Effetto", "Effect")}">${view.effects
          .map(
            (effect) =>
              `<option value="${esc(effect)}" ${effect === view.effect ? "selected" : ""}>${esc(effect)}</option>`,
          )
          .join("")}</select>
      </section>`
    : "";
  const plain =
    !view.dimmable && !view.colorful && !view.tunable && !view.effects.length
      ? `<p class="dm-lightctl-note">${
          view.domain === "light"
            ? t(
                "Questa luce dichiara solo acceso e spento: Home Assistant non espone né luminosità né colore.",
                "This light only reports on and off: Home Assistant exposes neither brightness nor colour.",
              )
            : t(
                "Questa luce è collegata a uno switch: accende e spegne soltanto.",
                "This light is wired to a switch: it only turns on and off.",
              )
        }</p>`
      : "";
  return `<section class="dm-section-dialog dm-lightctl-dialog" role="dialog" aria-modal="true" aria-labelledby="dm-lightctl-title" style="--dm-light-color:${esc(color)};--dm-light-ink:${readableInk(color)};--dm-light-level:${view.on ? Math.max(12, level) : 0}%">
    <header><strong id="dm-lightctl-title">${view.domain === "light" ? "💡" : "🔌"} ${esc(view.name)}</strong><button type="button" data-close aria-label="${t("Chiudi", "Close")}">✕</button></header>
    <div class="dm-lightctl-body">
      <div class="dm-lightctl-hero">
        <span class="dm-lightctl-orb">${view.domain === "light" ? BULB : PLUG}</span>
        <span class="dm-lightctl-hero-text">
          <b data-dm-light-hero-state>${stateText(view)}</b>
          <small class="mono">${esc(view.id)}</small>
          ${view.room ? `<small>${esc(view.room)}</small>` : ""}
        </span>
        ${
          view.comandabile === false
            ? `<span class="dm-lightctl-bloccata">🔒 ${esc(t("Solo lettura", "Read only"))}</span>`
            : `<button type="button" class="dm-lightctl-power" data-dm-light-power aria-pressed="${view.on}">${view.on ? t("Spegni", "Turn off") : t("Accendi", "Turn on")}</button>`
        }
      </div>
      ${
        view.comandabile === false
          ? `<p class="dm-lightctl-note">${t(
              "Questa presa è configurata come «si vede ma non si comanda»: la finestra la racconta, ma non la accende né la spegne.",
              "This socket is configured as shown but not controllable: this window reports it, it never switches it.",
            )}</p>`
          : ""
      }
      ${view.available ? "" : `<p class="dm-lightctl-note">${t("Entità non disponibile in Home Assistant.", "Entity unavailable in Home Assistant.")}</p>`}
      ${brightness}${colorBlock}${whiteBlock}${effectBlock}${plain}
    </div>
  </section>`;
}

function bindControl(modal, id) {
  const current = () => viewOf(id);
  const close = () => modal.remove();
  modal.querySelector("[data-close]")?.addEventListener("click", close);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      close();
      return;
    }
    const swatch = event.target?.closest?.("[data-dm-light-color]");
    if (swatch) {
      const view = current();
      if (view) live(view, { hex: swatch.dataset.dmLightColor }, "hex", swatch.dataset.dmLightColor, { commit: true });
      return;
    }
    const brightnessPreset = event.target?.closest?.("[data-dm-light-brightness-preset]");
    if (brightnessPreset) {
      const view = current();
      const value = Number(brightnessPreset.dataset.dmLightBrightnessPreset);
      if (view) live(view, { brightnessPct: value }, "brightness", value, { commit: true });
      return;
    }
    const kelvinPreset = event.target?.closest?.("[data-dm-light-kelvin-preset]");
    if (kelvinPreset) {
      const view = current();
      const value = Number(kelvinPreset.dataset.dmLightKelvinPreset);
      if (view) live(view, { kelvin: value }, "kelvin", value, { commit: true });
      return;
    }
    if (event.target?.closest?.("[data-dm-light-power]")) {
      toggleLight(id);
      syncControl();
    }
  });
  const slide = (event, commit) => {
    const view = current();
    if (!view) return;
    const target = event.target;
    if (target?.matches?.("[data-dm-light-brightness]")) {
      const value = Number(target.value);
      if (value === 0) {
        releaseHolds(view.id);
        send(view, { power: false });
        sync();
        return;
      }
      live(view, { brightnessPct: value }, "brightness", value, { commit });
      return;
    }
    if (target?.matches?.("[data-dm-light-hue],[data-dm-light-saturation]")) {
      const hue = Number(modal.querySelector("[data-dm-light-hue]")?.value) || 0;
      const saturation = Number(modal.querySelector("[data-dm-light-saturation]")?.value) || 0;
      const hex = rgbToHex(hsvToRgb(hue, saturation, 100));
      live(view, { hex }, "hex", hex, { commit });
      return;
    }
    if (target?.matches?.("[data-dm-light-kelvin]")) {
      const value = Number(target.value);
      live(view, { kelvin: value }, "kelvin", value, { commit });
      return;
    }
    if (target?.matches?.("[data-dm-light-hex]")) {
      live(view, { hex: target.value }, "hex", target.value, { commit });
      return;
    }
    if (target?.matches?.("[data-dm-light-effect]")) {
      send(view, { effect: target.value, power: true });
    }
  };
  modal.addEventListener("input", (event) => slide(event, false));
  modal.addEventListener("change", (event) => slide(event, true));
  modal.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });
}

export function openLightControl(id) {
  if (!doc) return false;
  const view = lightViews().find((item) => item.id === clean(id)) || viewOf(id);
  if (!view) return false;
  controlNode()?.remove();
  const modal = doc.createElement("div");
  modal.id = CONTROL_ID;
  modal.className = "dm-section-modal dm-lightctl";
  modal.dataset.dmLightControl = view.id;
  modal.innerHTML = renderLightControlMarkup(view);
  doc.body.append(modal);
  bindControl(modal, view.id);
  syncControl();
  modal.querySelector("[data-close]")?.focus?.();
  return true;
}

/** Values only: the sheet keeps its markup so a slider is never rebuilt mid-drag. */
function syncControl() {
  const modal = controlNode();
  if (!modal) return false;
  const view = viewOf(modal.dataset.dmLightControl);
  if (!view) return false;
  const dialog = modal.querySelector(".dm-lightctl-dialog");
  const level = cardLevel(view);
  const color = cardColor(view);
  dialog?.style?.setProperty("--dm-light-color", color);
  dialog?.style?.setProperty("--dm-light-ink", readableInk(color));
  dialog?.style?.setProperty("--dm-light-level", view.on ? `${Math.max(12, level)}%` : "0%");
  const hero = modal.querySelector("[data-dm-light-hero-state]");
  const text = stateText(view);
  if (hero && hero.textContent !== text) hero.textContent = text;
  const power = modal.querySelector("[data-dm-light-power]");
  if (power) {
    power.setAttribute("aria-pressed", String(view.on));
    const label = view.on ? t("Spegni", "Turn off") : t("Accendi", "Turn on");
    if (power.textContent !== label) power.textContent = label;
  }
  const write = (selector, value) => {
    const node = modal.querySelector(selector);
    if (node && doc.activeElement !== node) node.value = String(value);
  };
  write("[data-dm-light-brightness]", level);
  const percent = modal.querySelector("[data-dm-light-level]");
  if (percent) percent.textContent = `${level}%`;
  if (view.colorful) {
    const [hue, saturation] = hueFrom(view);
    write("[data-dm-light-hue]", hue);
    write("[data-dm-light-saturation]", saturation);
    write("[data-dm-light-hex]", color);
  }
  if (view.tunable) {
    const kelvin = heldValue(view.id, "kelvin") || view.kelvin;
    if (kelvin) {
      write("[data-dm-light-kelvin]", kelvin);
      const readout = modal.querySelector("[data-dm-light-kelvin-value]");
      if (readout) readout.textContent = `${kelvin} K`;
    }
  }
  return true;
}

/* ─────────────────────────────── listeners ──────────────────────────────── */

function installListeners() {
  const list = listNode();
  if (!list || list.dataset.dmLightsBound === "true") return false;
  list.dataset.dmLightsBound = "true";
  list.addEventListener("click", (event) => {
    const card = event.target?.closest?.("[data-dm-light]");
    if (event.target?.closest?.("[data-dm-light-all]")) {
      allOff();
      return;
    }
    const room = event.target?.closest?.("[data-dm-light-room]");
    if (room) {
      setRoomPower(room.dataset.dmLightRoomName, room.dataset.dmLightRoom === "on");
      return;
    }
    if (!card) return;
    if (event.target?.closest?.("[data-dm-light-open]")) {
      openLightControl(card.dataset.dmLight);
      return;
    }
    if (event.target?.closest?.("[data-dm-light-toggle]")) toggleLight(card.dataset.dmLight);
  });
  const slide = (event, commit) => {
    const card = event.target?.closest?.("[data-dm-light]");
    if (!card || !event.target?.matches?.("[data-dm-light-brightness]")) return;
    const view = viewOf(card.dataset.dmLight);
    if (!view) return;
    const value = Number(event.target.value);
    if (value === 0) {
      releaseHolds(view.id);
      send(view, { power: false });
      sync();
      return;
    }
    live(view, { brightnessPct: value }, "brightness", value, { commit });
  };
  list.addEventListener("input", (event) => slide(event, false));
  list.addEventListener("change", (event) => slide(event, true));
  return true;
}

function installOwners() {
  /* `apriGestioneLuci` keeps the bookkeeping — it is the only writer of the
   * runtime's lexical `currentPopupType`, which is what makes the tick call
   * `updateGestioneLuci` at all — and this module repaints the list it just
   * filled, in the same task, so the legacy markup is never shown. */
  const open = root.apriGestioneLuci;
  if (typeof open === "function" && !open[MARKER]) {
    function ownedOpen(...args) {
      const result = open.apply(this, args);
      installListeners();
      paint();
      return result;
    }
    ownedOpen[MARKER] = true;
    ownedOpen.__dmPrevious = open;
    root.apriGestioneLuci = ownedOpen;
  }
  const update = root.updateGestioneLuci;
  if (typeof update !== "function" || !update[MARKER]) {
    function ownedUpdate() {
      installListeners();
      return sync();
    }
    ownedUpdate[MARKER] = true;
    if (typeof update === "function") ownedUpdate.__dmPrevious = update;
    root.updateGestioneLuci = ownedUpdate;
  }
  root.dmOpenLightControl = openLightControl;
  return true;
}

/* ──────────────────────────────── styles ────────────────────────────────── */

function installStyles() {
  installStyle(
    STYLE_ID,
    `
    /* The popup cards keep every legacy .lgx- class, so the base skin still
       paints them; what changes here is that the colour is the lamp's own
       instead of a fixed amber, and that a dimmer has a track. */
    #details-list .dm-lightx-bar{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important;flex-wrap:wrap!important}
    #details-list .dm-lightx-room{display:flex!important;align-items:center!important;gap:9px!important;margin:14px 4px 8px!important}
    #details-list .dm-lightx-room:first-of-type{margin-top:2px!important}
    #details-list .dm-lightx-room .lgx-zona{margin:0!important;flex:0 1 auto!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
    #details-list .dm-lightx-room-count{flex:0 0 auto!important;padding:2px 9px!important;border:1px solid var(--card-border,rgba(148,163,184,.32))!important;border-radius:999px!important;font-size:10px!important;font-weight:800!important;letter-spacing:.6px!important;color:var(--text-dim,#94a3b8)!important}
    #details-list .dm-lightx-room-btn{margin-left:auto!important;flex:0 0 auto!important;padding:6px 13px!important;border:1px solid var(--card-border,rgba(148,163,184,.32))!important;border-radius:999px!important;background:transparent!important;color:var(--text-dim,#94a3b8)!important;font-size:10px!important;font-weight:800!important;letter-spacing:.7px!important;text-transform:uppercase!important;cursor:pointer!important}
    #details-list .dm-lightx-room-btn:active{transform:scale(.96)!important}
    #details-list .dm-lightx-floor{opacity:.7!important;font-size:12px!important;letter-spacing:1.2px!important}
    #details-list .dm-lightx-empty{padding:18px 4px!important;color:var(--text-dim,#94a3b8)!important;font-size:12.5px!important;font-weight:600!important;line-height:1.5!important}

    #details-list .dm-lightx-card{display:grid!important;gap:8px!important;padding:0!important;cursor:default!important}
    #details-list .dm-lightx-card:hover{transform:none!important}
    #details-list .dm-lightx-card:active{transform:none!important}
    #details-list .dm-lightx-card[data-dm-light-available="false"]{opacity:.55!important}
    /* The glow, the border and the LED all read the lamp's own colour. */
    #details-list .dm-lightx-card.is-on{border-color:color-mix(in srgb,var(--dm-light-color,#f59e0b) 55%,transparent)!important;box-shadow:0 6px 22px color-mix(in srgb,var(--dm-light-color,#f59e0b) 22%,transparent)!important}
    #details-list .dm-lightx-card.is-on .lgx-glow{background:radial-gradient(circle at 22% 20%,color-mix(in srgb,var(--dm-light-color,#f59e0b) 30%,transparent) 0%,transparent 64%)!important}
    #details-list .dm-lightx-card.is-on .lgx-led{background:var(--dm-light-color,#f59e0b)!important;box-shadow:0 0 10px color-mix(in srgb,var(--dm-light-color,#f59e0b) 70%,transparent)!important}
    #details-list .dm-lightx-card.is-on .dm-lightx-orb{background:radial-gradient(circle at 38% 32%,color-mix(in srgb,var(--dm-light-color,#f59e0b) 25%,#fff),var(--dm-light-color,#f59e0b))!important;color:var(--dm-light-ink,#0f172a)!important;box-shadow:0 3px 12px color-mix(in srgb,var(--dm-light-color,#f59e0b) 45%,transparent)!important}
    #details-list .dm-lightx-card.is-on .lgx-state{color:color-mix(in srgb,var(--dm-light-color,#f59e0b) 60%,var(--text,#0f172a))!important}

    #details-list .dm-lightx-main{display:grid!important;gap:1px!important;box-sizing:border-box!important;width:100%!important;margin:0!important;padding:12px 12px 4px!important;border:0!important;border-radius:18px 18px 0 0!important;background:transparent!important;color:inherit!important;font:inherit!important;text-align:left!important;cursor:pointer!important;-webkit-tap-highlight-color:transparent!important}
    #details-list .dm-lightx-main:active{transform:scale(.985)!important}
    #details-list .dm-lightx-main .lgx-row-top{display:flex!important;align-items:center!important;gap:8px!important;margin-bottom:10px!important}
    #details-list .dm-lightx-main .lgx-orb{display:flex!important;align-items:center!important;justify-content:center!important}
    #details-list .dm-lightx-badges{display:flex!important;flex-wrap:wrap!important;gap:4px!important;margin-left:auto!important}
    #details-list .dm-lightx-badge{padding:2px 6px!important;border-radius:999px!important;font-size:8.5px!important;font-weight:900!important;letter-spacing:.6px!important;background:color-mix(in srgb,var(--dm-light-color,#f59e0b) 16%,transparent)!important;color:color-mix(in srgb,var(--dm-light-color,#f59e0b) 55%,var(--text,#0f172a))!important;border:1px solid color-mix(in srgb,var(--dm-light-color,#f59e0b) 26%,transparent)!important}
    #details-list .dm-lightx-badge[data-kind="switch"]{background:rgba(148,163,184,.14)!important;color:var(--text-dim,#64748b)!important;border-color:rgba(148,163,184,.3)!important}

    #details-list .dm-lightx-tools{display:flex!important;align-items:center!important;gap:8px!important;padding:0 12px 11px!important}
    #details-list .dm-lightx-dim{display:grid!important;flex:1 1 auto!important;min-width:0!important;gap:2px!important}
    #details-list .dm-lightx-dim-lbl{font-size:8.5px!important;font-weight:800!important;letter-spacing:.7px!important;text-transform:uppercase!important;color:var(--text-dim,#94a3b8)!important}
    #details-list .dm-lightx-tune{display:grid!important;place-items:center!important;flex:0 0 auto!important;width:36px!important;height:36px!important;padding:0!important;border:1px solid var(--card-border,rgba(148,163,184,.3))!important;border-radius:12px!important;background:transparent!important;color:var(--text-dim,#94a3b8)!important;cursor:pointer!important}
    #details-list .dm-lightx-card.is-on .dm-lightx-tune{border-color:color-mix(in srgb,var(--dm-light-color,#f59e0b) 40%,transparent)!important;color:color-mix(in srgb,var(--dm-light-color,#f59e0b) 60%,var(--text,#0f172a))!important}
    #details-list .dm-lightx-tune svg{width:19px!important;height:19px!important}
    #details-list .dm-lightx-tune:active{transform:scale(.94)!important}

    /* One track shape for the card dimmer and for every slider in the sheet:
       the filled part is the light's colour, the rest is the empty groove. */
    #details-list .dm-lightx-range,.dm-lightctl .dm-lightctl-range{box-sizing:border-box!important;width:100%!important;height:26px!important;margin:0!important;padding:0!important;border:0!important;appearance:none!important;-webkit-appearance:none!important;background:transparent!important;cursor:pointer!important;touch-action:pan-y!important}
    #details-list .dm-lightx-range::-webkit-slider-runnable-track,.dm-lightctl .dm-lightctl-range::-webkit-slider-runnable-track{height:12px;border-radius:999px;background:linear-gradient(90deg,var(--dm-light-color,#f59e0b) 0 var(--dm-light-level,0%),rgba(148,163,184,.24) var(--dm-light-level,0%) 100%)}
    #details-list .dm-lightx-range::-moz-range-track,.dm-lightctl .dm-lightctl-range::-moz-range-track{height:12px;border-radius:999px;background:linear-gradient(90deg,var(--dm-light-color,#f59e0b) 0 var(--dm-light-level,0%),rgba(148,163,184,.24) var(--dm-light-level,0%) 100%)}
    #details-list .dm-lightx-range::-webkit-slider-thumb,.dm-lightctl .dm-lightctl-range::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;margin-top:-4px;border-radius:50%;border:2px solid #fff;background:var(--dm-light-color,#f59e0b);box-shadow:0 2px 6px rgba(15,23,42,.32)}
    #details-list .dm-lightx-range::-moz-range-thumb,.dm-lightctl .dm-lightctl-range::-moz-range-thumb{width:20px;height:20px;border-radius:50%;border:2px solid #fff;background:var(--dm-light-color,#f59e0b);box-shadow:0 2px 6px rgba(15,23,42,.32)}

    /* The control sheet reuses the canonical modal shell owned by
       editor-contracts-section.js; only its own height and inner blocks are
       declared here, so the two do not compete over the same rules. */
    .dm-lightctl .dm-lightctl-dialog{height:auto!important;max-height:min(760px,calc(100dvh - 32px))!important;grid-template-rows:auto minmax(0,1fr)!important}
    .dm-lightctl .dm-lightctl-body{min-height:0!important;overflow:auto!important;display:grid!important;align-content:start!important;gap:14px!important;padding:18px 20px 22px!important}
    .dm-lightctl .dm-lightctl-hero{display:flex!important;align-items:center!important;gap:14px!important;padding:14px!important;border:1px solid color-mix(in srgb,var(--dm-light-color,#f59e0b) 30%,var(--divider-color,#e2e8f0))!important;border-radius:20px!important;background:radial-gradient(120% 100% at 0% 0%,color-mix(in srgb,var(--dm-light-color,#f59e0b) 14%,transparent),transparent 70%)!important}
    .dm-lightctl .dm-lightctl-orb{display:grid!important;place-items:center!important;flex:0 0 auto!important;width:52px!important;height:52px!important;border-radius:50%!important;background:radial-gradient(circle at 38% 32%,color-mix(in srgb,var(--dm-light-color,#f59e0b) 25%,#fff),var(--dm-light-color,#f59e0b))!important;color:var(--dm-light-ink,#0f172a)!important;box-shadow:0 6px 18px color-mix(in srgb,var(--dm-light-color,#f59e0b) 40%,transparent)!important}
    .dm-lightctl .dm-lightctl-orb svg{width:26px!important;height:26px!important}
    .dm-lightctl .dm-lightctl-hero-text{display:grid!important;gap:2px!important;flex:1 1 auto!important;min-width:0!important}
    .dm-lightctl .dm-lightctl-hero-text b{font-size:14px!important;font-weight:900!important;letter-spacing:.6px!important}
    .dm-lightctl .dm-lightctl-hero-text small{font-size:11px!important;color:var(--secondary-text-color,#64748b)!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
    .dm-lightctl .dm-lightctl-bloccata{flex:0 0 auto!important;display:inline-flex!important;align-items:center!important;gap:6px!important;padding:11px 16px!important;border-radius:14px!important;border:1px dashed var(--card-border,#cbd5e1)!important;color:var(--text-dim,#64748b)!important;font-size:11px!important;font-weight:900!important;letter-spacing:.6px!important;text-transform:uppercase!important}
    .dm-lightctl .dm-lightctl-power{flex:0 0 auto!important;padding:11px 18px!important;border:0!important;border-radius:14px!important;background:var(--dm-light-color,#f59e0b)!important;color:var(--dm-light-ink,#0f172a)!important;font-size:12px!important;font-weight:900!important;letter-spacing:.6px!important;text-transform:uppercase!important;cursor:pointer!important}
    .dm-lightctl .dm-lightctl-power[aria-pressed="false"]{background:var(--secondary-background-color,#f1f5f9)!important;color:var(--secondary-text-color,#64748b)!important}
    .dm-lightctl .dm-lightctl-block{display:grid!important;gap:10px!important;padding:14px!important;border:1px solid var(--divider-color,#e2e8f0)!important;border-radius:18px!important}
    .dm-lightctl .dm-lightctl-block-head{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;font-size:11px!important;font-weight:900!important;letter-spacing:.9px!important;text-transform:uppercase!important;color:var(--secondary-text-color,#64748b)!important}
    .dm-lightctl .dm-lightctl-block-head b{font-size:14px!important;color:var(--text,#0f172a)!important}
    .dm-lightctl .dm-lightctl-preview{width:26px!important;height:26px!important;border-radius:50%!important;border:2px solid #fff!important;background:var(--dm-light-color,#f59e0b)!important;box-shadow:0 2px 8px rgba(15,23,42,.24)!important}
    .dm-lightctl .dm-lightctl-presets{display:flex!important;flex-wrap:wrap!important;gap:8px!important}
    .dm-lightctl .dm-lightctl-presets button{flex:1 1 auto!important;min-height:38px!important;padding:8px 12px!important;border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:12px!important;background:var(--secondary-background-color,#f8fafc)!important;color:inherit!important;font-size:11.5px!important;font-weight:800!important;cursor:pointer!important}
    .dm-lightctl .dm-lightctl-presets button[data-dm-light-kelvin-preset]{border-left:6px solid var(--dm-swatch,#fff)!important}
    .dm-lightctl .dm-lightctl-swatches{display:grid!important;grid-template-columns:repeat(6,minmax(0,1fr))!important;gap:8px!important}
    .dm-lightctl .dm-lightctl-swatch{aspect-ratio:1!important;min-height:34px!important;padding:0!important;border:2px solid #fff!important;border-radius:50%!important;background:var(--dm-swatch,#fff)!important;box-shadow:0 2px 8px rgba(15,23,42,.2)!important;cursor:pointer!important}
    .dm-lightctl .dm-lightctl-swatch:active{transform:scale(.92)!important}
    .dm-lightctl .dm-lightctl-slot{display:grid!important;gap:2px!important}
    .dm-lightctl .dm-lightctl-slot>span{font-size:10.5px!important;font-weight:800!important;letter-spacing:.6px!important;text-transform:uppercase!important;color:var(--secondary-text-color,#64748b)!important}
    .dm-lightctl .dm-lightctl-hue::-webkit-slider-runnable-track{background:linear-gradient(90deg,#ff0000,#ffff00,#00ff00,#00ffff,#0000ff,#ff00ff,#ff0000)!important}
    .dm-lightctl .dm-lightctl-hue::-moz-range-track{background:linear-gradient(90deg,#ff0000,#ffff00,#00ff00,#00ffff,#0000ff,#ff00ff,#ff0000)!important}
    .dm-lightctl .dm-lightctl-sat::-webkit-slider-runnable-track{background:linear-gradient(90deg,#ffffff,var(--dm-light-color,#f59e0b))!important}
    .dm-lightctl .dm-lightctl-sat::-moz-range-track{background:linear-gradient(90deg,#ffffff,var(--dm-light-color,#f59e0b))!important}
    .dm-lightctl .dm-lightctl-kelvin::-webkit-slider-runnable-track{background:linear-gradient(90deg,#ffb46b,#ffd7ae,#fff6ec,#f2f6ff,#cfe0ff)!important}
    .dm-lightctl .dm-lightctl-kelvin::-moz-range-track{background:linear-gradient(90deg,#ffb46b,#ffd7ae,#fff6ec,#f2f6ff,#cfe0ff)!important}
    .dm-lightctl .dm-lightctl-exact{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important;font-size:10.5px!important;font-weight:800!important;letter-spacing:.6px!important;text-transform:uppercase!important;color:var(--secondary-text-color,#64748b)!important}
    .dm-lightctl .dm-lightctl-exact input{width:56px!important;height:38px!important;padding:2px!important;border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:12px!important;background:transparent!important;cursor:pointer!important}
    .dm-lightctl .dm-lightctl-select{box-sizing:border-box!important;width:100%!important;min-height:44px!important;padding:10px 12px!important;border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:13px!important;background:var(--ha-card-background,var(--card-bg,#fff))!important;color:inherit!important}
    .dm-lightctl .dm-lightctl-note{margin:0!important;color:var(--secondary-text-color,#64748b)!important;font-size:12px!important;font-weight:600!important;line-height:1.5!important}

    @media(max-width:560px){
      #details-list .dm-lightx-main{padding:11px 11px 4px!important}
      #details-list .dm-lightx-tools{padding:0 11px 10px!important}
      .dm-lightctl .dm-lightctl-hero{flex-wrap:wrap!important}
      .dm-lightctl .dm-lightctl-power{flex:1 1 100%!important}
      .dm-lightctl .dm-lightctl-swatches{grid-template-columns:repeat(6,minmax(0,1fr))!important}
    }
  `,
  );
}

export function installLightsSceneSection() {
  if (!doc) return;
  installStyles();
  installOwners();
  installListeners();
  if (!state.listeners) {
    state.listeners = true;
    for (const eventName of [
      "dashboardmodern:legacy-ready",
      "dashboardmodern:runtime-ready",
      "dashboardmodern:persistence-restored",
    ]) {
      root.addEventListener?.(eventName, () => {
        installOwners();
        installListeners();
      });
    }
    root.addEventListener?.("dashboardmodern:state-changed", () => {
      if (controlNode() || (popupShowing() && listNode()?.querySelector("[data-dm-light]"))) sync();
    });
  }
  state.installed = true;
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", installLightsSceneSection, { once: true });
} else {
  installLightsSceneSection();
}
