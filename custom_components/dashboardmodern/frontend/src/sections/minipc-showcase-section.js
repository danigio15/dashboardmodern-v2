// DM-FIX-20260818A
/* MiniPC section redesign — "Sala macchine".
 *
 * `#page-server` becomes a small 3D scene plus a two column board. The machine
 * is a real CSS box — six faces in one perspective, vents and a turning fan on
 * the top face, LEDs on the front — and CPU, RAM and Disk stand next to it as
 * three prisms that grow with the load, each casting its own shadow on the
 * floor. Under the scene runs a live curve of the CPU load. Below, the page is
 * a board rather than a stack: thermal on the left, telemetry on the right,
 * network across the bottom. The page follows the theme: light on a light
 * dashboard, deep navy only when the theme is dark.
 *
 * Contracts preserved on purpose — the legacy runtime keeps owning every value:
 * - the three metric bars `#srv-fill-cpu` / `#srv-fill-ram` / `#srv-fill-disk`
 *   stay in the DOM and keep being the only writers of the load: each prism
 *   reads the width of its bar instead of parsing a sensor again, and takes the
 *   colour that bar was configured with;
 * - `#v-srv-cpu`, `#v-srv-ram` + `#u-srv-ram` and `#v-srv-disk` are placed by
 *   the scene, never copied into a second node, so the dynamic RAM unit (%, GB)
 *   the render loop writes still lands on screen;
 * - `#srv-temp-circle` keeps its `stroke-dasharray` and its `stroke`: the
 *   threshold colour stays the legacy one and the thermal scale reads the arc
 *   the runtime drew rather than re-deriving it from the sensor;
 * - `#v-srv-temp-status` stays the owner of the status wording; the badge next
 *   to the ring mirrors it and takes its level from the 🟢/🟡/🔴 marker the
 *   runtime already put in that text, so no threshold is duplicated here;
 * - `#waw-net-badge` / `#waw-inv-badge` keep the `srv-status-badge online` and
 *   `offline` class the render loop rewrites on every tick; the page mirrors the
 *   connectivity one onto `#page-server` as `data-dm-srv-net`, which is what
 *   turns the scene, the LEDs and the curve red when the machine drops off the
 *   network;
 * - every card keeps its `onclick`, so `apriStorico()` and `apriSrvHistory()`
 *   still open the history popups, and no `display` is forced with `!important`
 *   on a card `cdAutoHide()` shows or hides by writing an inline `display`. When
 *   the thermal card is the one hidden, the board is told through
 *   `data-dm-srvx-thermal` so telemetry widens instead of leaving a hole.
 *
 * The live curve is the one thing drawn from more than the current tick: it
 * keeps the last readings of `#srv-fill-cpu` in memory for the session, so it is
 * a picture of what the page already showed rather than a second history engine.
 *
 * The only numbers in this module are presentational: the 65 / 85 pair the
 * legacy `setRing()` already uses to colour these three gauges, and the 20-100
 * window plus the 75 °C notch the runtime itself draws the temperature arc in.
 */
import { clean, doc, installStyle, lexicalGlobal, root, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_MINIPC_SHOWCASE__";
const STYLE_ID = "dm-minipc-showcase-style";
const state = (root[KEY] ||= {
  installed: false,
  listeners: false,
  frame: 0,
  trace: [],
  watched: null,
  observer: null,
});
if (!Array.isArray(state.trace)) state.trace = [];

/* Same pair as the legacy setRing(): above 85% the prism is red, above 65%
   amber, below that it keeps the colour the card was configured with. */
const WARN_LEVEL = 65;
const ALERT_LEVEL = 85;
const WARN_COLOUR = "#f59e0b";
const ALERT_COLOUR = "#ef4444";

/* The prisms follow the order of the cards in the hero, which is the order the
   legacy markup writes the bars in: CPU, RAM, Disk. */
const METRIC_BARS = Object.freeze(["srv-fill-cpu", "srv-fill-ram", "srv-fill-disk"]);
/* Height of a prism at 100%, in the units the scene is laid out with. */
const BAR_MAX = 168;

/* Readings kept for the curve: about ten minutes of a dashboard that ticks
   every few seconds, and short enough to stay a glance rather than a chart. */
const TRACE_SAMPLES = 96;
const TRACE_WIDTH = 300;
const TRACE_HEIGHT = 56;

const ICONS = Object.freeze({
  cpu: '<rect x="8.4" y="8.4" width="7.2" height="7.2" rx="1.6"/><rect x="4.6" y="4.6" width="14.8" height="14.8" rx="3"/><path d="M9 2.6v2M15 2.6v2M9 19.4v2M15 19.4v2M2.6 9h2M2.6 15h2M19.4 9h2M19.4 15h2"/>',
  ram: '<rect x="2.6" y="7" width="18.8" height="10" rx="2.2"/><path d="M6.6 17v3M12 17v3M17.4 17v3M6.8 10.4h2.6v3.2H6.8zM14.6 10.4h2.6v3.2h-2.6z"/>',
  disk: '<circle cx="12" cy="12" r="8.8"/><circle cx="12" cy="12" r="2.6"/><path d="M17.4 17.4 14 14"/>',
  bolt: '<path d="M13.2 2.8 5.6 13.4h5.3l-.9 7.8 8.4-10.6h-5.3l.1-7.8Z"/>',
  clock: '<circle cx="12" cy="12" r="8.6"/><path d="M12 6.9V12l3.4 2"/>',
  down: '<path d="M12 3.6v13M6.8 11.4 12 16.6l5.2-5.2M4.6 20.4h14.8"/>',
  up: '<path d="M12 20.4v-13M6.8 12.6 12 7.4l5.2 5.2M4.6 3.6h14.8"/>',
  wifi: '<path d="M2.6 8.8a14 14 0 0 1 18.8 0M5.8 12.4a9.4 9.4 0 0 1 12.4 0M9 16a4.8 4.8 0 0 1 6 0"/><circle cx="12" cy="19.4" r="1.1" fill="currentColor" stroke="none"/>',
  grid: '<path d="M12 2.6 4 8.4V21h16V8.4L12 2.6Z"/><path d="M12.8 10.2 9.4 15.4h3l-.8 4 3.8-5.6h-2.8l.2-3.6Z"/>',
});

/* The telemetry tiles are static markup: their emoji is decoration, so it can be
   swapped for a line icon keyed on the entity the tile opens in the history. */
const TELEMETRY_ICONS = Object.freeze({
  "dm.server_potenza_raspberry_server": "bolt",
  "dm.server_uptime_home_assistant": "clock",
  "dm.server_speedtest_download": "down",
  "dm.server_speedtest_upload": "up",
});

/* Download and upload get a stream that runs the way the bytes go. */
const TELEMETRY_FLOW = Object.freeze({
  "dm.server_speedtest_download": "in",
  "dm.server_speedtest_upload": "out",
});

const METRIC_ICONS = Object.freeze({
  "dm.server_cpu": "cpu",
  "dm.server_ram": "ram",
  "dm.server_disco": "disk",
});

function icon(name, size = 20) {
  const body = ICONS[name];
  if (!body) return "";
  return `<svg class="dm-srvx-ico" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

/** The `dm.*` entity a card opens in the history popup, "" when it opens none. */
function cardEntity(node) {
  return clean(node?.getAttribute?.("onclick")).match(/dm\.[a-z0-9_]+/)?.[0] || "";
}

/* ── readers ──────────────────────────────────────────────────────────── */

/** Load of one gauge, read from the bar the legacy render loop writes. */
export function metricLevel(barId, scope = doc) {
  const width = Number.parseFloat(clean(scope?.getElementById?.(barId)?.style?.width));
  if (!Number.isFinite(width)) return null;
  return Math.max(0, Math.min(100, width));
}

/** Height of a prism for that load, so a reading of 0 still shows a base. */
export function barHeight(level, max = BAR_MAX) {
  const value = Number.isFinite(level) ? Math.max(0, Math.min(100, level)) : 0;
  return Math.round((6 + (value / 100) * (max - 6)) * 10) / 10;
}

/** Colour of a prism: the card's own colour until the legacy thresholds bite. */
export function levelColour(level, colour) {
  if (Number.isFinite(level) && level > ALERT_LEVEL) return ALERT_COLOUR;
  if (Number.isFinite(level) && level > WARN_LEVEL) return WARN_COLOUR;
  return colour;
}

/** How loaded a gauge reads, for the styling of its label and value. */
export function levelName(level) {
  if (!Number.isFinite(level)) return "";
  if (level > ALERT_LEVEL) return "alert";
  if (level > WARN_LEVEL) return "warn";
  return "ok";
}

/**
 * Fraction of the temperature ring the legacy runtime drew, 0 when it has not
 * drawn one yet. The scale follows the arc instead of re-deriving the reading.
 */
export function tempFraction(scope = doc) {
  const dash = clean(scope?.getElementById?.("srv-temp-circle")?.getAttribute?.("stroke-dasharray"));
  const [drawn, gap] = dash.split(/[\s,]+/).map(Number);
  if (!Number.isFinite(drawn) || !Number.isFinite(gap) || drawn + gap <= 0) return 0;
  return Math.max(0, Math.min(1, drawn / (drawn + gap)));
}

/**
 * Level of the CPU temperature, taken from the marker the legacy status text
 * carries. Keeping the classification there means one owner for the thresholds.
 */
export function tempLevel(text) {
  const value = clean(text);
  if (value.includes("🔴")) return "hot";
  if (value.includes("🟡")) return "warm";
  if (value.includes("🟢")) return "ok";
  return "";
}

/** The same wording without its marker, so the badge can draw its own dot. */
export function tempWording(text) {
  return clean(clean(text).replace(/^[🔴🟡🟢]\s*/u, ""));
}

/** Connectivity, read from the badge class the render loop rewrites per tick. */
export function networkState(scope = doc) {
  const badge = scope?.getElementById?.("waw-net-badge");
  if (badge?.classList?.contains("offline")) return "off";
  if (badge?.classList?.contains("online")) return "on";
  return "";
}

/** Height of one reading inside the curve band, as a share of the band. */
export function traceOffset(value, height = TRACE_HEIGHT) {
  const level = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  return (height - 3 - (level / 100) * (height - 6)) / height;
}

/**
 * A Catmull-Rom spline through the readings, as cubic segments. The controls
 * are clamped inside the band, so a spike cannot bow the curve out of the card.
 */
export function smoothPath(points, height = TRACE_HEIGHT) {
  if (!points.length) return "";
  const at = (index) => points[Math.max(0, Math.min(points.length - 1, index))];
  const clamp = (y) => Math.max(1, Math.min(height - 1, y));
  const round = (value) => value.toFixed(1);
  let path = `M${round(points[0].x)} ${round(points[0].y)}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = at(index - 1);
    const start = at(index);
    const end = at(index + 1);
    const next = at(index + 2);
    const firstX = start.x + (end.x - previous.x) / 6;
    const firstY = clamp(start.y + (end.y - previous.y) / 6);
    const secondX = end.x - (next.x - start.x) / 6;
    const secondY = clamp(end.y - (next.y - start.y) / 6);
    path += ` C${round(firstX)} ${round(firstY)} ${round(secondX)} ${round(secondY)} ${round(end.x)} ${round(end.y)}`;
  }
  return path;
}

/**
 * The curve, as the two paths that draw it: the line and the area under it.
 * A single reading is drawn flat across the band instead of as a lone dot.
 */
export function tracePaths(values, width = TRACE_WIDTH, height = TRACE_HEIGHT) {
  const levels = (values || []).filter((value) => Number.isFinite(value));
  if (!levels.length) return { line: "", area: "" };
  const span = levels.length > 1 ? width / (levels.length - 1) : width;
  const points = levels.map((value, index) => ({
    x: levels.length === 1 ? 0 : index * span,
    y: traceOffset(value, height) * height,
  }));
  if (levels.length === 1) points.push({ x: width, y: points[0].y });
  const line = smoothPath(points, height);
  return { line, area: `${line} L${width} ${height} L0 ${height} Z` };
}

/**
 * Keep the reading the page is showing. Sampling happens on every state event,
 * page open or not, so the curve is already drawn when the section is opened.
 */
export function sampleCpu(scope = doc, samples = state.trace) {
  const level = metricLevel("srv-fill-cpu", scope);
  if (level === null) return samples;
  samples.push(level);
  while (samples.length > TRACE_SAMPLES) samples.shift();
  return samples;
}

/* ── the scene ────────────────────────────────────────────────────────── */

/* One CSS box, six faces, laid out by the stylesheet from --w / --h / --d. */
const BOX_FACES = ["front", "back", "left", "right", "top", "bottom"]
  .map((face) => `<span class="dm-srvx-f dm-srvx-f-${face}"></span>`)
  .join("");

/** The machine: a real box in the scene, with vents, a fan and its LEDs. */
function mountMachine(scene) {
  let machine = scene.querySelector(":scope > .dm-srvx-machine");
  if (machine) return machine;
  machine = doc.createElement("div");
  machine.className = "dm-srvx-machine";
  machine.setAttribute("aria-hidden", "true");
  machine.innerHTML = `
    <span class="dm-srvx-drop"></span>
    <div class="dm-srvx-box">
      ${BOX_FACES}
      <span class="dm-srvx-panel">
        <i class="dm-srvx-led dm-srvx-led-pwr"></i>
        <i class="dm-srvx-led dm-srvx-led-act"></i>
        <i class="dm-srvx-slot"></i>
      </span>
    </div>`;
  scene.prepend(machine);
  return machine;
}

/** The floor the machine and the prisms stand on. */
function mountFloor(scene) {
  if (scene.querySelector(":scope > .dm-srvx-floor")) return;
  const floor = doc.createElement("div");
  floor.className = "dm-srvx-floor";
  floor.setAttribute("aria-hidden", "true");
  scene.prepend(floor);
}

/**
 * Turn one metric card into a prism standing on the floor: the bar, its shadow
 * and the two legacy nodes — label and value — placed around it. Nothing is
 * copied: the card keeps its own reading and its own click.
 */
function mountPrism(card, index) {
  if (card.dataset.dmSrvxPrism) return;
  card.dataset.dmSrvxPrism = "true";
  card.style.setProperty("--dm-srvx-slot", String(index));
  const bar = doc.createElement("div");
  bar.className = "dm-srvx-bar";
  bar.setAttribute("aria-hidden", "true");
  bar.innerHTML = BOX_FACES;
  card.prepend(bar);
  const shadow = doc.createElement("span");
  shadow.className = "dm-srvx-drop";
  shadow.setAttribute("aria-hidden", "true");
  card.prepend(shadow);
  const glyph = card.querySelector(".srv-metric-icon");
  const name = METRIC_ICONS[cardEntity(card)];
  if (glyph && name) glyph.innerHTML = icon(name, 14);
}

/** Move the three cards into the scene so they share one perspective. */
function mountScene(page) {
  const scene = page.querySelector(".srv-hero-metrics");
  if (!scene) return null;
  mountFloor(scene);
  mountMachine(scene);
  // The hero slot is emptied: the machine is a box now, not a glyph.
  const slot = page.querySelector(".srv-hero-icon");
  if (slot && !slot.dataset.dmSrvxRetired) {
    slot.dataset.dmSrvxRetired = "true";
    slot.textContent = "";
  }
  return scene;
}

/**
 * The band under the scene: the readings this page has already shown, kept for
 * the session so the machine has a shape over time and not just a number.
 */
function mountTrace(page) {
  const hero = page.querySelector(".srv-hero");
  const scene = hero?.querySelector(".srv-hero-metrics");
  if (!scene) return null;
  let trace = hero.querySelector(":scope > .dm-srvx-trace");
  if (trace) return trace;
  trace = doc.createElement("div");
  trace.className = "dm-srvx-trace";
  trace.dataset.dmSrvxTrace = "empty";
  trace.innerHTML = `
    <div class="dm-srvx-trace-head">
      <span class="dm-srvx-trace-lbl">${t("Carico CPU · live", "CPU load · live")}</span>
      <span class="dm-srvx-trace-peak"></span>
    </div>
    <div class="dm-srvx-trace-plot">
      <svg class="dm-srvx-trace-svg" viewBox="0 0 ${TRACE_WIDTH} ${TRACE_HEIGHT}" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="dmSrvxTraceFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="currentColor" stop-opacity=".38"/>
            <stop offset="1" stop-color="currentColor" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path class="dm-srvx-trace-mid" d="M0 ${(TRACE_HEIGHT / 2).toFixed(1)} H${TRACE_WIDTH}" fill="none"/>
        <path class="dm-srvx-trace-area" d=""/>
        <path class="dm-srvx-trace-line" d="" fill="none"/>
      </svg>
      <span class="dm-srvx-trace-dot"></span>
    </div>`;
  scene.insertAdjacentElement("afterend", trace);
  return trace;
}

/* Headings that name the three blocks of the board. Each one is tied to the
   block it labels, so a block emptied by cdAutoHide() drops its title too. */
const GROUPS = Object.freeze([
  { block: ".srv-temp-card", card: ".srv-temp-card", it: "Termica", en: "Thermal" },
  { block: ".srv-tel-grid", card: ".srv-tel-card", it: "Telemetria", en: "Telemetry" },
  { block: ".srv-status-grid", card: ".srv-status-card", it: "Rete e impianto", en: "Network & plant" },
]);

function mountHeadings(page) {
  for (const group of GROUPS) {
    const block = page.querySelector(group.block);
    if (!block || block.previousElementSibling?.classList?.contains("dm-srvx-head")) continue;
    const heading = doc.createElement("div");
    heading.className = "dm-srvx-head";
    heading.dataset.dmSrvxHead = group.block;
    heading.innerHTML = `<span>${t(group.it, group.en)}</span>`;
    block.insertAdjacentElement("beforebegin", heading);
  }
}

/**
 * Hide a heading whose whole block the auto-hide has taken off the page, and
 * tell the board when the thermal column is gone so telemetry can widen.
 */
function syncHeadings(page) {
  for (const group of GROUPS) {
    const block = page.querySelector(group.block);
    const heading = block?.previousElementSibling;
    if (!heading?.classList?.contains("dm-srvx-head")) continue;
    const cards = block.matches(group.card) ? [block] : [...block.querySelectorAll(group.card)];
    const empty = cards.length > 0 && cards.every((card) => card.style.display === "none");
    const display = empty ? "none" : "";
    if (heading.style.display !== display) heading.style.display = display;
    if (group.block === ".srv-temp-card") {
      const value = empty ? "off" : "on";
      if (page.dataset.dmSrvxThermal !== value) page.dataset.dmSrvxThermal = value;
    }
  }
}

/* The two cards of "Rete e impianto" read a mapped entity each, but their
 * onclick opens a history popup and names no `dm.*` slot — so the auto-hide,
 * which reads those names out of the onclick, never saw them. An impianto with
 * no inverter mapped kept a card saying OFF-GRID · ALERT that nothing in the
 * configuration could take away, because the slot lives in Energia and not in
 * this page. They now follow the same rule as every other card: gone while
 * their entity is unmapped, back the moment it is mapped. */
const STATUS_CARD_SLOTS = Object.freeze([
  { id: "waw-net-badge", slot: "dm.server_raggiungibilita_google" },
  { id: "waw-inv-badge", slot: "dm.energy_stato_rete" },
]);

function slotIsMapped(slot) {
  const overrides = lexicalGlobal("ENTITY_OVERRIDES");
  if (!overrides || typeof overrides !== "object") return true;
  return Boolean(clean(overrides[slot]));
}

function syncStatusCards(page) {
  for (const { id, slot } of STATUS_CARD_SLOTS) {
    const card = page.querySelector(`#${id}`)?.closest(".srv-status-card");
    if (!card) continue;
    const display = slotIsMapped(slot) ? "" : "none";
    if (card.style.display !== display) card.style.display = display;
  }
}

/** Thermal scale and mirrored status badge next to the temperature ring. */
function mountThermal(page) {
  const card = page.querySelector(".srv-temp-card");
  const info = card?.querySelector(".srv-temp-info");
  if (!info || info.dataset.dmSrvxThermal) return null;
  info.dataset.dmSrvxThermal = "true";
  const badge = doc.createElement("div");
  badge.className = "dm-srvx-temp-badge";
  badge.innerHTML = '<span class="dm-srvx-temp-dot"></span><span class="dm-srvx-temp-txt"></span>';
  info.querySelector(".srv-temp-status")?.insertAdjacentElement("afterend", badge);
  const scale = doc.createElement("div");
  scale.className = "dm-srvx-scale";
  /* The scale spans the 20-100 °C window the legacy arc is drawn in, and the
     notch marks the 75 °C the runtime calls "alta" in the status line. */
  scale.innerHTML = `
    <div class="dm-srvx-scale-track"><span class="dm-srvx-scale-limit"></span><span class="dm-srvx-scale-pin"></span></div>
    <div class="dm-srvx-scale-ends"><span>20°</span><span class="dm-srvx-scale-mark">${t("limite 75°", "75° limit")}</span><span>100°</span></div>`;
  info.append(scale);
  return card;
}

/** Line icons on the telemetry tiles, and a stream on the two speed tiles. */
function mountTelemetry(page) {
  for (const tile of page.querySelectorAll(".srv-tel-card")) {
    const entity = cardEntity(tile);
    const glyph = tile.querySelector(".srv-tel-icon");
    const name = TELEMETRY_ICONS[entity];
    if (glyph && name && !glyph.dataset.dmSrvxIcon) {
      glyph.dataset.dmSrvxIcon = name;
      glyph.innerHTML = icon(name, 19);
    }
    const flow = TELEMETRY_FLOW[entity];
    if (flow && !tile.dataset.dmSrvxFlow) {
      tile.dataset.dmSrvxFlow = flow;
      const stream = doc.createElement("span");
      stream.className = "dm-srvx-stream";
      stream.setAttribute("aria-hidden", "true");
      tile.append(stream);
    }
  }
}

/** A leading icon for the two status rows, so they read as a pair of channels. */
function mountStatusIcons(page) {
  const names = ["wifi", "grid"];
  const cards = [...page.querySelectorAll(".srv-status-card")];
  cards.forEach((card, index) => {
    if (card.dataset.dmSrvxIcon) return;
    card.dataset.dmSrvxIcon = "true";
    const slot = doc.createElement("div");
    slot.className = "dm-srvx-status-ico";
    slot.innerHTML = icon(names[index] || "wifi", 18);
    card.prepend(slot);
  });
}

/* ── render ───────────────────────────────────────────────────────────── */

/** Draw the samples collected so far; an empty curve keeps the band hidden. */
function renderTrace(trace) {
  if (!trace) return;
  const samples = state.trace;
  const mode = samples.length ? "on" : "empty";
  if (trace.dataset.dmSrvxTrace !== mode) trace.dataset.dmSrvxTrace = mode;
  if (!samples.length) return;
  const { line, area } = tracePaths(samples);
  const linePath = trace.querySelector(".dm-srvx-trace-line");
  const areaPath = trace.querySelector(".dm-srvx-trace-area");
  if (linePath?.getAttribute("d") !== line) linePath?.setAttribute("d", line);
  if (areaPath?.getAttribute("d") !== area) areaPath?.setAttribute("d", area);
  const offset = `${(traceOffset(samples[samples.length - 1]) * 100).toFixed(1)}%`;
  if (clean(trace.style.getPropertyValue("--dm-srvx-last")) !== offset) {
    trace.style.setProperty("--dm-srvx-last", offset);
  }
  const peak = trace.querySelector(".dm-srvx-trace-peak");
  const value = `${t("picco", "peak")} ${Math.round(Math.max(...samples))}%`;
  if (peak && peak.textContent !== value) peak.textContent = value;
}

/** Stand one prism at the height of the bar the legacy loop keeps writing. */
function renderPrism(card, index) {
  const level = metricLevel(METRIC_BARS[index] || "", doc);
  const height = `${barHeight(level)}px`;
  if (clean(card.style.getPropertyValue("--dm-srvx-h")) !== height) {
    card.style.setProperty("--dm-srvx-h", height);
  }
  // The bar carries the colour the markup configured for this metric.
  const own = clean(card.querySelector(".srv-metric-fill")?.style?.background) || "#94a3b8";
  const colour = levelColour(level, own);
  if (clean(card.style.getPropertyValue("--dm-srvx-col")) !== colour) {
    card.style.setProperty("--dm-srvx-col", colour);
  }
  const name = levelName(level);
  if (card.dataset.dmSrvxLevel !== name) card.dataset.dmSrvxLevel = name;
}

export function renderMinipcShowcase() {
  const page = doc?.getElementById?.("page-server");
  if (!page) return false;
  page.classList.add("dm-srvx");
  page.querySelector(".srv-hero")?.parentElement?.classList.add("dm-srvx-shell");
  mountScene(page);
  mountTelemetry(page);
  mountStatusIcons(page);
  mountHeadings(page);
  syncStatusCards(page);
  syncHeadings(page);
  renderTrace(mountTrace(page));
  const thermal = mountThermal(page) || page.querySelector(".srv-temp-card");

  [...page.querySelectorAll(".srv-hero-metrics .srv-metric")].forEach((card, index) => {
    mountPrism(card, index);
    renderPrism(card, index);
  });

  if (thermal) {
    const source = doc.getElementById("v-srv-temp-status");
    const level = tempLevel(source?.textContent);
    if (thermal.dataset.dmSrvxTemp !== level) thermal.dataset.dmSrvxTemp = level;
    const wording = tempWording(source?.textContent);
    const mirror = thermal.querySelector(".dm-srvx-temp-txt");
    if (mirror && mirror.textContent !== wording) mirror.textContent = wording;
    const pin = `${(tempFraction(doc) * 100).toFixed(1)}%`;
    if (clean(thermal.style.getPropertyValue("--dm-srvx-temp")) !== pin) {
      thermal.style.setProperty("--dm-srvx-temp", pin);
    }
  }

  const net = networkState(doc);
  if (page.dataset.dmSrvNet !== net) page.dataset.dmSrvNet = net;
  return true;
}

/* The auto-hide is what empties a block, and all it does is write an inline
 * `display` on the cards. It is called from inside the runtime, not through the
 * global, so wrapping the name would never see it — and when it lands after the
 * last pass, the title of an emptied column stays on the board on its own.
 *
 * So the page is watched instead, and only for that: the inline styles of the
 * blocks under `#page-server`. Nothing else is observed, and the document never
 * is. The pass writes an inline `display` on the headings, which wakes this
 * once more and then finds nothing left to change. */
function bindAutoHide() {
  const page = doc?.getElementById?.("page-server");
  if (!page || state.watched === page) return;
  if (typeof root.MutationObserver !== "function") return;
  state.observer?.disconnect?.();
  state.observer = new root.MutationObserver(() => scheduleMinipcShowcase());
  state.observer.observe(page, { attributes: true, attributeFilter: ["style"], subtree: true });
  state.watched = page;
}

export function scheduleMinipcShowcase() {
  if (state.frame) return;
  const run = () => {
    state.frame = 0;
    renderMinipcShowcase();
  };
  state.frame = root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 0) || 0;
}

function pageVisible() {
  return Boolean(doc?.getElementById("page-server")?.classList.contains("active"));
}

export function installMinipcShowcaseSection() {
  if (!doc) return;
  installStyle(STYLE_ID, minipcShowcaseCss());
  if (!state.listeners) {
    state.listeners = true;
    for (const eventName of [
      "dashboardmodern:legacy-ready",
      "dashboardmodern:runtime-ready",
      "pageshow",
    ]) {
      root.addEventListener?.(eventName, () => {
        bindAutoHide();
        scheduleMinipcShowcase();
      });
    }
    // The bars, the temperature arc and the badges repaint through the legacy
    // render loop, so the scene follows the same events instead of a timer.
    root.addEventListener?.("dashboardmodern:state-changed", () => {
      // Sampling is three DOM reads, so it runs on every tick; the repaint only
      // happens while the page is the one on screen.
      sampleCpu();
      if (pageVisible()) scheduleMinipcShowcase();
    });
    doc.addEventListener(
      "click",
      (event) => {
        if (event.target?.closest?.('[data-tab="server"],[data-page="server"]')) {
          root.queueMicrotask?.(scheduleMinipcShowcase);
        }
      },
      true,
    );
  }
  state.installed = true;
  bindAutoHide();
  sampleCpu();
  renderMinipcShowcase();
}

/* ── styles ───────────────────────────────────────────────────────────── */

function minipcShowcaseCss() {
  return `
#page-server.dm-srvx{
  --srvx-surface:var(--card-bg,#fff);
  --srvx-surface-2:var(--surface-2,#f8fafc);
  --srvx-text:var(--text,#0f172a);
  --srvx-dim:var(--text-dim,#64748b);
  --srvx-r:26px;--srvx-r-s:20px;
  --srvx-shadow:0 20px 38px -26px rgba(10,26,44,.55),0 2px 6px -3px rgba(10,26,44,.12);
  --srvx-shadow-s:0 16px 30px -24px rgba(10,26,44,.6),0 2px 5px -3px rgba(10,26,44,.12);
  --srvx-live:#10b981;--srvx-live-rgb:16,185,129;
  /* the scene follows the theme: light surfaces on a light dashboard */
  --srvx-hero-bg:linear-gradient(170deg,#fdfeff 0%,#eef4fb 52%,#e2ebf6 100%);
  --srvx-hero-text:var(--srvx-text);
  --srvx-hero-dim:var(--srvx-dim);
  --srvx-hero-line:rgba(15,23,42,.09);
  --srvx-hero-shadow:0 24px 44px -30px rgba(10,26,44,.55),0 2px 6px -3px rgba(10,26,44,.1);
  --srvx-hero-inset:inset 0 0 0 1px rgba(15,23,42,.05);
  --srvx-floor:rgba(15,23,42,.07);
  --srvx-floor-line:rgba(15,23,42,.09);
  --srvx-drop:rgba(15,32,56,.4);
  --srvx-case:#dfe7f1;--srvx-case-top:#f2f6fb;--srvx-case-side:#b9c6d6;
  --srvx-case-front:#cfd9e6;--srvx-case-edge:rgba(255,255,255,.75);
  --srvx-ink:rgba(15,23,42,.45);--srvx-vane:rgba(15,23,42,.3);
}
#page-server.dm-srvx[data-dm-srv-net="off"]{--srvx-live:#ef4444;--srvx-live-rgb:239,68,68}
#page-server.dm-srvx .dm-srvx-ico{display:block;flex:0 0 auto}

/* ── the board ────────────────────────────────────────────────────────── */
#page-server.dm-srvx .dm-srvx-shell{
  display:grid;gap:14px 16px;align-content:start;
  grid-template-columns:minmax(0,1.02fr) minmax(0,1fr)
}
/* Le righe sono contate a mano, e vanno contate tutte.
 *
 * Questa numerazione e' stata scritta quando la pagina cominciava con la sua
 * scena: intestazioni di sezione non ce n'erano. Adesso ogni sezione ne ha una,
 * e quella si prende la prima riga — l'unica libera, visto che la seconda e la
 * terza sono assegnate qui sotto. La scena finiva cosi' in coda alla pagina,
 * sotto la telemetria: il pezzo piu' grosso della sezione, in fondo.
 *
 * Ora ogni pezzo ha la sua riga dichiarata, nell'ordine in cui si legge. */
#page-server.dm-srvx .dm-page-mast{grid-column:1 / -1;grid-row:1}
#page-server.dm-srvx .srv-hero,
#page-server.dm-srvx .srv-status-grid,
#page-server.dm-srvx .dm-srvx-head[data-dm-srvx-head=".srv-status-grid"]{grid-column:1 / -1}
#page-server.dm-srvx .srv-hero{grid-row:2}
#page-server.dm-srvx .dm-srvx-head[data-dm-srvx-head=".srv-temp-card"],
#page-server.dm-srvx .srv-temp-card{grid-column:1}
#page-server.dm-srvx .dm-srvx-head[data-dm-srvx-head=".srv-tel-grid"],
#page-server.dm-srvx .srv-tel-grid{grid-column:2}
#page-server.dm-srvx .dm-srvx-head[data-dm-srvx-head=".srv-temp-card"],
#page-server.dm-srvx .dm-srvx-head[data-dm-srvx-head=".srv-tel-grid"]{grid-row:3}
#page-server.dm-srvx .srv-temp-card,
#page-server.dm-srvx .srv-tel-grid{grid-row:4}
#page-server.dm-srvx .dm-srvx-head[data-dm-srvx-head=".srv-status-grid"]{grid-row:5}
#page-server.dm-srvx .srv-status-grid{grid-row:6}
/* the thermal card hidden by the auto-hide: telemetry takes the whole row */
#page-server.dm-srvx[data-dm-srvx-thermal="off"] .dm-srvx-head[data-dm-srvx-head=".srv-tel-grid"],
#page-server.dm-srvx[data-dm-srvx-thermal="off"] .srv-tel-grid{grid-column:1 / -1}
/* A tutta larghezza le pastiglie sono tre su due colonne, e la terza restava da
 * sola su una riga sua, larga mezza pagina. Riempiono la riga, quante che
 * siano. */
#page-server.dm-srvx[data-dm-srvx-thermal="off"] .srv-tel-grid{
  grid-template-columns:repeat(auto-fit,minmax(230px,1fr))!important}

/* ── the panel that holds the scene ───────────────────────────────────── */
#page-server.dm-srvx .srv-hero{
  margin-bottom:0!important;padding:20px 22px 22px!important;border:0!important;
  border-radius:var(--srvx-r)!important;
  background:var(--srvx-hero-bg)!important;
  box-shadow:var(--srvx-hero-shadow),var(--srvx-hero-inset)!important;
  color:var(--srvx-hero-text)!important;
  perspective:1250px;perspective-origin:50% 34%
}
#page-server.dm-srvx .srv-hero::before{
  top:-40%!important;right:-10%!important;width:340px!important;height:340px!important;
  background:radial-gradient(circle,rgba(var(--srvx-live-rgb),.13) 0%,transparent 68%)!important
}
#page-server.dm-srvx .srv-hero::after{
  bottom:-30%!important;left:-6%!important;width:280px!important;height:280px!important;
  background:radial-gradient(circle,rgba(56,189,248,.13) 0%,transparent 70%)!important
}
#page-server.dm-srvx .srv-hero-top{margin-bottom:8px!important;z-index:3}
#page-server.dm-srvx .srv-hero-brand{gap:0!important}
/* the glyph slot is retired: the machine below is the real one */
#page-server.dm-srvx .srv-hero-icon{display:none!important}
#page-server.dm-srvx .srv-hero-title{color:var(--srvx-hero-text)!important;font-size:23px!important;letter-spacing:.06em!important}
#page-server.dm-srvx .srv-hero-sub{color:var(--srvx-hero-dim)!important;letter-spacing:.14em!important}
#page-server.dm-srvx .srv-hero-pill{
  background:rgba(var(--srvx-live-rgb),.12)!important;
  border:1px solid rgba(var(--srvx-live-rgb),.32)!important;
  color:var(--srvx-live)!important;padding:8px 15px!important
}
#page-server.dm-srvx .srv-hero-dot{
  background:var(--srvx-live)!important;
  box-shadow:0 0 0 4px rgba(var(--srvx-live-rgb),.16)!important
}

/* ── the 3D scene ─────────────────────────────────────────────────────── */
#page-server.dm-srvx .srv-hero-metrics{
  --srvx-scene-h:300px;--srvx-bar-w:54px;--srvx-bar-d:54px;--srvx-gap:84px;
  display:block!important;position:relative;height:var(--srvx-scene-h);
  transform-style:preserve-3d;transform:rotateX(-20deg) rotateY(-17deg) translateY(-6px);
  margin:0 auto!important;max-width:680px
}
#page-server.dm-srvx .dm-srvx-floor{
  position:absolute;left:-30%;right:-30%;top:calc(var(--srvx-scene-h) - 56px);height:520px;
  transform-origin:top center;transform:translateZ(-14px) rotateX(-90deg);
  background:
    linear-gradient(to bottom,var(--srvx-floor) 0%,transparent 70%),
    repeating-linear-gradient(90deg,var(--srvx-floor-line) 0 1px,transparent 1px 54px),
    repeating-linear-gradient(0deg,var(--srvx-floor-line) 0 1px,transparent 1px 54px);
  -webkit-mask-image:radial-gradient(62% 58% at 50% 4%,#000 0%,transparent 76%);
  mask-image:radial-gradient(62% 58% at 50% 4%,#000 0%,transparent 76%)
}
/* the soft contact shadow every object drops on that floor */
#page-server.dm-srvx .dm-srvx-drop{
  position:absolute;left:50%;top:100%;width:var(--srvx-drop-w,130%);height:var(--srvx-drop-h,120px);
  transform-origin:top center;
  transform:translateX(-50%) rotateX(-90deg) translateY(calc(var(--srvx-drop-h,120px) / -2 + 10px));
  background:radial-gradient(ellipse 44% 40% at center,var(--srvx-drop) 0%,transparent 74%);
  filter:blur(5px);pointer-events:none
}

/* the machine: one box, six faces */
#page-server.dm-srvx .dm-srvx-machine{
  --w:206px;--h:48px;--d:132px;--srvx-drop-w:120%;--srvx-drop-h:150px;
  position:absolute;left:6px;bottom:60px;width:var(--w);height:var(--h);
  transform-style:preserve-3d
}
#page-server.dm-srvx .dm-srvx-box,
#page-server.dm-srvx .dm-srvx-bar{position:absolute;inset:0;transform-style:preserve-3d}
#page-server.dm-srvx .dm-srvx-f{position:absolute;left:50%;top:50%;background:var(--srvx-case)}
#page-server.dm-srvx .dm-srvx-f-front,
#page-server.dm-srvx .dm-srvx-f-back{
  width:var(--w);height:var(--h);margin:calc(var(--h) / -2) 0 0 calc(var(--w) / -2)
}
#page-server.dm-srvx .dm-srvx-f-front{transform:translateZ(calc(var(--d) / 2));background:var(--srvx-case-front)}
#page-server.dm-srvx .dm-srvx-f-back{transform:rotateY(180deg) translateZ(calc(var(--d) / 2));background:var(--srvx-case-side)}
#page-server.dm-srvx .dm-srvx-f-left,
#page-server.dm-srvx .dm-srvx-f-right{
  width:var(--d);height:var(--h);margin:calc(var(--h) / -2) 0 0 calc(var(--d) / -2)
}
#page-server.dm-srvx .dm-srvx-f-right{transform:rotateY(90deg) translateZ(calc(var(--w) / 2));background:var(--srvx-case-side)}
#page-server.dm-srvx .dm-srvx-f-left{transform:rotateY(-90deg) translateZ(calc(var(--w) / 2));background:var(--srvx-case-side)}
#page-server.dm-srvx .dm-srvx-f-top,
#page-server.dm-srvx .dm-srvx-f-bottom{
  width:var(--w);height:var(--d);margin:calc(var(--d) / -2) 0 0 calc(var(--w) / -2)
}
#page-server.dm-srvx .dm-srvx-f-top{
  transform:rotateX(90deg) translateZ(calc(var(--h) / 2));backface-visibility:visible;
  background:linear-gradient(150deg,var(--srvx-case-top),var(--srvx-case));
  box-shadow:inset 0 0 0 1px var(--srvx-case-edge)
}
#page-server.dm-srvx .dm-srvx-f-front,
#page-server.dm-srvx .dm-srvx-f-right,
#page-server.dm-srvx .dm-srvx-f-left{box-shadow:inset 0 0 0 1px rgba(15,23,42,.06)}
#page-server.dm-srvx .dm-srvx-f-bottom{transform:rotateX(-90deg) translateZ(calc(var(--h) / 2));background:var(--srvx-case-side)}
/* the lid of the machine, with its vent grille and its fan drawn into it: one
   plane, painted, because a child element does not follow a rotated face */
#page-server.dm-srvx .dm-srvx-machine .dm-srvx-f-top{
  border-radius:3px;
  background-image:
    repeating-linear-gradient(0deg,var(--srvx-ink) 0 2px,transparent 2px 9px),
    radial-gradient(circle,transparent 0 22%,var(--srvx-ink) 22% 24%,transparent 25%),
    conic-gradient(from 0deg,var(--srvx-vane) 0 26deg,transparent 26deg 72deg,
      var(--srvx-vane) 72deg 98deg,transparent 98deg 144deg,
      var(--srvx-vane) 144deg 170deg,transparent 170deg 216deg,
      var(--srvx-vane) 216deg 242deg,transparent 242deg 288deg,
      var(--srvx-vane) 288deg 314deg,transparent 314deg 360deg),
    linear-gradient(150deg,var(--srvx-case-top),var(--srvx-case));
  background-size:34% 52%,40% 62%,32% 50%,cover;
  background-position:76% 42%,17% 44%,18.6% 44%,0 0;
  background-repeat:no-repeat,no-repeat,no-repeat,no-repeat
}

/* the front panel: LEDs and a slot, on the front face */
#page-server.dm-srvx .dm-srvx-panel{
  position:absolute;left:50%;top:50%;width:var(--w);height:var(--h);
  margin:calc(var(--h) / -2) 0 0 calc(var(--w) / -2);
  transform:translateZ(calc(var(--d) / 2 + .4px));
  display:flex;align-items:center;gap:9px;padding:0 16px
}
#page-server.dm-srvx .dm-srvx-led{width:7px;height:7px;border-radius:50%;background:var(--srvx-live)}
#page-server.dm-srvx .dm-srvx-led-pwr{box-shadow:0 0 9px 1px rgba(var(--srvx-live-rgb),.85)}
#page-server.dm-srvx .dm-srvx-led-act{background:#38bdf8;animation:dmSrvxBlink 2.6s steps(1,end) infinite}
#page-server.dm-srvx[data-dm-srv-net="off"] .dm-srvx-led-act{background:#94a3b8;animation:none}
#page-server.dm-srvx .dm-srvx-slot{
  margin-left:auto;width:52px;height:6px;border-radius:99px;background:var(--srvx-ink);opacity:.35
}

/* the three prisms */
#page-server.dm-srvx .srv-hero-metrics .srv-metric{
  position:absolute;bottom:60px;
  left:calc(292px + var(--dm-srvx-slot,0) * var(--srvx-gap));
  width:var(--srvx-bar-w);height:var(--dm-srvx-h,6px);
  background:none!important;border:0!important;box-shadow:none!important;padding:0!important;
  transform-style:preserve-3d;cursor:pointer;
  transition:height .9s cubic-bezier(.2,.8,.25,1)
}
#page-server.dm-srvx .dm-srvx-bar{--w:var(--srvx-bar-w);--h:100%;--d:var(--srvx-bar-d)}
#page-server.dm-srvx .dm-srvx-bar .dm-srvx-f{background:var(--dm-srvx-col,#94a3b8)}
#page-server.dm-srvx .dm-srvx-bar .dm-srvx-f-front,
#page-server.dm-srvx .dm-srvx-bar .dm-srvx-f-back{
  width:var(--srvx-bar-w);height:100%;margin:0;left:0;top:0
}
#page-server.dm-srvx .dm-srvx-bar .dm-srvx-f-front{transform:translateZ(calc(var(--srvx-bar-d) / 2))}
#page-server.dm-srvx .dm-srvx-bar .dm-srvx-f-back{
  transform:rotateY(180deg) translateZ(calc(var(--srvx-bar-d) / 2));filter:brightness(.7)
}
#page-server.dm-srvx .dm-srvx-bar .dm-srvx-f-left,
#page-server.dm-srvx .dm-srvx-bar .dm-srvx-f-right{
  width:var(--srvx-bar-d);height:100%;margin:0;left:0;top:0;filter:brightness(.78)
}
#page-server.dm-srvx .dm-srvx-bar .dm-srvx-f-right{
  transform:rotateY(90deg) translateZ(calc(var(--srvx-bar-w) - var(--srvx-bar-d) / 2))
}
#page-server.dm-srvx .dm-srvx-bar .dm-srvx-f-left{transform:rotateY(-90deg) translateZ(calc(var(--srvx-bar-d) / 2))}
#page-server.dm-srvx .dm-srvx-bar .dm-srvx-f-top,
#page-server.dm-srvx .dm-srvx-bar .dm-srvx-f-bottom{
  width:var(--srvx-bar-w);height:var(--srvx-bar-d);margin:0;left:0;top:0
}
#page-server.dm-srvx .dm-srvx-bar .dm-srvx-f-top{
  transform:translateY(calc(var(--srvx-bar-d) / -2)) rotateX(90deg);
  backface-visibility:visible;filter:brightness(1.16)
}
#page-server.dm-srvx .dm-srvx-bar .dm-srvx-f-bottom,
#page-server.dm-srvx .dm-srvx-bar .dm-srvx-f-back,
#page-server.dm-srvx .dm-srvx-bar .dm-srvx-f-left{display:none}
#page-server.dm-srvx .srv-hero-metrics .srv-metric .dm-srvx-drop{--srvx-drop-w:190%;--srvx-drop-h:150px}
/* label under the prism and value above it, both turned back to the viewer */
#page-server.dm-srvx .srv-metric-top{
  position:absolute;left:50%;top:100%;width:120px;margin:30px 0 0 -60px;
  display:flex!important;align-items:center!important;justify-content:center!important;
  gap:6px!important;transform:rotateY(17deg) rotateX(20deg)
}
#page-server.dm-srvx .srv-metric>div:not(.srv-metric-top):not(.dm-srvx-bar):not(.srv-metric-bar){
  position:absolute;left:50%;bottom:100%;width:120px;margin:0 0 18px -60px;
  display:flex;align-items:baseline;justify-content:center;gap:2px;
  transform:rotateY(17deg) rotateX(20deg)
}
#page-server.dm-srvx .srv-metric-lbl{
  font-size:10px!important;letter-spacing:.14em!important;color:var(--srvx-hero-dim)!important
}
#page-server.dm-srvx .srv-metric-icon{
  display:grid!important;place-items:center!important;font-size:0!important;
  color:var(--srvx-hero-dim)!important;opacity:.5!important
}
#page-server.dm-srvx .srv-metric-val{
  font-size:25px!important;font-weight:300!important;letter-spacing:-.03em!important;
  color:var(--srvx-hero-text)!important;line-height:1!important
}
#page-server.dm-srvx .srv-metric-unit{
  font-size:12px!important;font-weight:700!important;color:var(--srvx-hero-dim)!important
}
#page-server.dm-srvx .srv-metric[data-dm-srvx-level="alert"] .srv-metric-val,
#page-server.dm-srvx .srv-metric[data-dm-srvx-level="alert"] .srv-metric-lbl{color:#dc2626!important}
#page-server.dm-srvx .srv-metric:hover .dm-srvx-bar{filter:brightness(1.06)}
/* the bar stays: it is the value the prisms read, so it is hidden, not removed */
#page-server.dm-srvx .srv-metric-bar{display:none!important}

/* ── the live curve ───────────────────────────────────────────────────── */
#page-server.dm-srvx .dm-srvx-trace{position:relative;z-index:2;margin:14px 0 0;display:grid;gap:6px}
#page-server.dm-srvx .dm-srvx-trace[data-dm-srvx-trace="empty"]{display:none}
#page-server.dm-srvx .dm-srvx-trace-head{
  display:flex;align-items:baseline;justify-content:space-between;gap:10px;
  font-size:9.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase
}
#page-server.dm-srvx .dm-srvx-trace-lbl{color:var(--srvx-hero-dim)}
#page-server.dm-srvx .dm-srvx-trace-peak{color:var(--srvx-live);letter-spacing:.1em}
#page-server.dm-srvx .dm-srvx-trace-plot{position:relative}
#page-server.dm-srvx .dm-srvx-trace-svg{
  display:block;width:100%;height:46px;color:var(--srvx-live);
  border-bottom:1px solid var(--srvx-hero-line)
}
#page-server.dm-srvx .dm-srvx-trace-mid{
  stroke:var(--srvx-hero-line);stroke-width:1;stroke-dasharray:3 5;vector-effect:non-scaling-stroke
}
#page-server.dm-srvx .dm-srvx-trace-area{fill:url(#dmSrvxTraceFill)}
#page-server.dm-srvx .dm-srvx-trace-line{
  stroke:var(--srvx-live);stroke-width:2;stroke-linejoin:round;stroke-linecap:round;
  vector-effect:non-scaling-stroke
}
#page-server.dm-srvx .dm-srvx-trace-dot{
  position:absolute;right:0;top:var(--dm-srvx-last,50%);
  width:8px;height:8px;margin:-4px -4px 0 0;border-radius:50%;background:var(--srvx-live);
  box-shadow:0 0 0 3px rgba(var(--srvx-live-rgb),.2);
  transition:top .6s cubic-bezier(.2,.8,.25,1)
}

/* ── section headings ─────────────────────────────────────────────────── */
#page-server.dm-srvx .dm-srvx-head{
  display:flex;align-items:center;gap:12px;margin:6px 2px -4px;
  font-size:9.5px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;
  color:var(--srvx-dim)
}
#page-server.dm-srvx .dm-srvx-head::after{
  content:"";flex:1;height:1px;
  background:linear-gradient(90deg,color-mix(in srgb,var(--srvx-dim) 32%,transparent),transparent)
}

/* ── CPU temperature ──────────────────────────────────────────────────── */
#page-server.dm-srvx .srv-temp-card{
  gap:18px!important;padding:20px!important;margin-bottom:0!important;border:0!important;
  border-radius:var(--srvx-r)!important;background:var(--srvx-surface)!important;
  box-shadow:var(--srvx-shadow)!important;align-items:center!important
}
#page-server.dm-srvx .srv-temp-ring{width:112px!important;height:112px!important}
#page-server.dm-srvx .srv-temp-ring svg{width:100%!important;height:100%!important}
/* only the track: #srv-temp-circle keeps the stroke the legacy loop writes */
#page-server.dm-srvx .srv-temp-ring circle:not([id]){stroke:var(--srvx-surface-2)!important;stroke-width:8!important}
#page-server.dm-srvx #srv-temp-circle{stroke-width:8!important}
#page-server.dm-srvx .srv-temp-num{font-size:29px!important;font-weight:300!important;letter-spacing:-.04em!important}
#page-server.dm-srvx .srv-temp-unit{font-size:10px!important;letter-spacing:.12em!important;margin-top:2px!important}
#page-server.dm-srvx .srv-temp-title{font-size:9.5px!important;letter-spacing:.18em!important;margin-bottom:8px!important}
/* the legacy line stays the owner of the wording; the badge shows it */
#page-server.dm-srvx .srv-temp-status{display:none!important}
#page-server.dm-srvx .dm-srvx-temp-badge{
  display:inline-flex;align-items:center;gap:8px;padding:6px 13px 6px 10px;border-radius:999px;
  background:var(--srvx-surface-2);font-size:13px;font-weight:800;color:var(--srvx-text)
}
#page-server.dm-srvx .dm-srvx-temp-dot{width:9px;height:9px;border-radius:50%;background:#94a3b8}
#page-server.dm-srvx [data-dm-srvx-temp="ok"] .dm-srvx-temp-dot{background:#10b981;box-shadow:0 0 0 4px rgba(16,185,129,.16)}
#page-server.dm-srvx [data-dm-srvx-temp="warm"] .dm-srvx-temp-dot{background:#f59e0b;box-shadow:0 0 0 4px rgba(245,158,11,.18)}
#page-server.dm-srvx [data-dm-srvx-temp="hot"] .dm-srvx-temp-dot{background:#ef4444;box-shadow:0 0 0 4px rgba(239,68,68,.2)}
#page-server.dm-srvx .srv-temp-sublbl{margin-top:8px!important;font-size:10px!important;letter-spacing:.04em!important}
#page-server.dm-srvx .dm-srvx-scale{margin-top:12px;display:grid;gap:5px}
#page-server.dm-srvx .dm-srvx-scale-track{
  position:relative;height:7px;border-radius:99px;
  background:linear-gradient(90deg,#38bdf8 0%,#34d399 34%,#fbbf24 68%,#ef4444 100%);
  opacity:.85
}
#page-server.dm-srvx .dm-srvx-scale-limit{
  position:absolute;left:68.75%;top:-3px;bottom:-3px;width:2px;border-radius:2px;
  background:var(--srvx-surface);opacity:.85
}
#page-server.dm-srvx .dm-srvx-scale-pin{
  position:absolute;top:50%;left:var(--dm-srvx-temp,0%);width:14px;height:14px;margin:-7px 0 0 -7px;
  border-radius:50%;background:var(--srvx-surface);border:3px solid var(--srvx-text);
  box-shadow:0 4px 10px -3px rgba(10,26,44,.6);
  transition:left 1.1s cubic-bezier(.2,.8,.25,1)
}
#page-server.dm-srvx .dm-srvx-scale-ends{
  position:relative;display:flex;justify-content:space-between;font-size:9px;font-weight:800;
  letter-spacing:.08em;color:var(--srvx-dim);text-transform:uppercase
}
#page-server.dm-srvx .dm-srvx-scale-mark{
  position:absolute;left:68.75%;transform:translateX(-50%);white-space:nowrap;opacity:.75
}

/* ── telemetry ────────────────────────────────────────────────────────── */
#page-server.dm-srvx .srv-tel-grid{
  grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px!important;margin-bottom:0!important;
  perspective:800px
}
#page-server.dm-srvx .srv-tel-card{
  padding:15px 15px 18px!important;border:0!important;border-radius:var(--srvx-r-s)!important;
  background:var(--srvx-surface)!important;box-shadow:var(--srvx-shadow-s)!important;gap:8px!important;
  transition:transform .35s cubic-bezier(.2,.8,.25,1),box-shadow .35s ease!important
}
#page-server.dm-srvx .srv-tel-card::before{
  width:120px!important;height:120px!important;
  background:radial-gradient(circle at top right,rgba(var(--tc-rgb,14,165,233),.14) 0%,transparent 68%)!important
}
#page-server.dm-srvx .srv-tel-card:hover{
  transform:translateY(-4px) rotateX(6deg)!important;
  box-shadow:0 26px 38px -22px rgba(10,26,44,.62)!important
}
#page-server.dm-srvx .srv-tel-icon{
  width:30px!important;height:30px!important;border-radius:10px!important;font-size:0!important;
  background:rgba(var(--tc-rgb,14,165,233),.13)!important;border:0!important;
  color:rgb(var(--tc-rgb,14,165,233))!important
}
#page-server.dm-srvx .srv-tel-lbl{font-size:9.5px!important;letter-spacing:.12em!important}
#page-server.dm-srvx .srv-tel-val{font-size:24px!important;letter-spacing:-.02em!important}
#page-server.dm-srvx .srv-tel-sub{font-size:9.5px!important;color:var(--srvx-dim)!important}
/* download and upload run their own stream along the foot of the tile */
#page-server.dm-srvx .dm-srvx-stream{
  position:absolute;left:15px;right:15px;bottom:11px;height:2px;border-radius:2px;overflow:hidden;
  background:rgba(var(--tc-rgb,14,165,233),.14)
}
#page-server.dm-srvx .dm-srvx-stream::after{
  content:"";position:absolute;top:0;bottom:0;left:0;width:52%;
  background:linear-gradient(90deg,transparent,rgb(var(--tc-rgb,14,165,233)),transparent);
  opacity:.75
}
#page-server.dm-srvx [data-dm-srvx-flow="in"] .dm-srvx-stream::after{animation:dmSrvxFlowIn 2.6s linear infinite}
#page-server.dm-srvx [data-dm-srvx-flow="out"] .dm-srvx-stream::after{animation:dmSrvxFlowOut 2.6s linear infinite}

/* ── connectivity and inverter ────────────────────────────────────────── */
#page-server.dm-srvx .srv-status-grid{gap:12px!important}
#page-server.dm-srvx .srv-status-card{
  padding:15px 17px!important;border:0!important;border-radius:var(--srvx-r-s)!important;
  background:var(--srvx-surface)!important;box-shadow:var(--srvx-shadow-s)!important;gap:12px!important
}
#page-server.dm-srvx .srv-status-card:hover{transform:translateY(-3px)!important;box-shadow:0 22px 34px -22px rgba(10,26,44,.6)!important}
#page-server.dm-srvx .dm-srvx-status-ico{
  width:36px;height:36px;border-radius:13px;display:grid;place-items:center;flex:0 0 auto;
  background:var(--srvx-surface-2);color:var(--srvx-dim)
}
#page-server.dm-srvx .srv-status-left{flex:1;min-width:0}
#page-server.dm-srvx .srv-status-lbl{font-size:9.5px!important;letter-spacing:.12em!important}
#page-server.dm-srvx .srv-status-val{font-size:19px!important}
#page-server.dm-srvx .srv-status-badge{padding:7px 13px!important;border-radius:999px!important;border:0!important}
#page-server.dm-srvx .srv-status-badge.online{background:rgba(16,185,129,.13)!important}
#page-server.dm-srvx .srv-status-badge.offline{background:rgba(239,68,68,.13)!important}
#page-server.dm-srvx .srv-status-indicator{width:7px;height:7px;border-radius:50%}
#page-server.dm-srvx .srv-status-card:has(.srv-status-badge.online) .dm-srvx-status-ico{
  background:rgba(16,185,129,.13);color:#059669
}

@keyframes dmSrvxSpin{to{transform:rotate(360deg)}}
@keyframes dmSrvxBlink{0%,44%{opacity:.25}50%,58%{opacity:1}64%,100%{opacity:.25}}
@keyframes dmSrvxFlowIn{from{transform:translateX(-100%)}to{transform:translateX(192%)}}
@keyframes dmSrvxFlowOut{from{transform:translateX(192%)}to{transform:translateX(-100%)}}

/* ── responsive ───────────────────────────────────────────────────────── */
@media(max-width:900px){
  #page-server.dm-srvx .srv-hero-metrics{--srvx-gap:70px;--srvx-bar-w:46px;--srvx-bar-d:46px}
  #page-server.dm-srvx .dm-srvx-machine{--w:160px;--d:104px}
  #page-server.dm-srvx .srv-hero-metrics .srv-metric{left:calc(200px + var(--dm-srvx-slot,0) * var(--srvx-gap))}
}
@media(max-width:820px){
  #page-server.dm-srvx .dm-srvx-shell{grid-template-columns:minmax(0,1fr)}
  #page-server.dm-srvx .dm-srvx-head,
  #page-server.dm-srvx .srv-temp-card,
  #page-server.dm-srvx .srv-tel-grid{grid-column:1 / -1!important;grid-row:auto!important}
}
@media(max-width:620px){
  #page-server.dm-srvx{--srvx-r:22px;--srvx-r-s:17px}
  #page-server.dm-srvx .srv-hero{padding:16px 14px 18px!important;perspective:900px}
  #page-server.dm-srvx .srv-hero-metrics{
    --srvx-scene-h:250px;--srvx-gap:clamp(52px,17vw,68px);--srvx-bar-w:40px;--srvx-bar-d:40px;
    transform:rotateX(-18deg) rotateY(-15deg)
  }
  #page-server.dm-srvx .dm-srvx-machine{--w:126px;--h:36px;--d:84px;left:2px;bottom:46px}
  #page-server.dm-srvx .dm-srvx-panel{gap:7px;padding:0 11px}
  #page-server.dm-srvx .dm-srvx-slot{width:34px;height:5px}
  #page-server.dm-srvx .srv-hero-metrics .srv-metric{
    bottom:46px;left:calc(148px + var(--dm-srvx-slot,0) * var(--srvx-gap))
  }
  #page-server.dm-srvx .srv-metric-top{width:86px;margin:12px 0 0 -43px;gap:5px!important}
  #page-server.dm-srvx .srv-metric>div:not(.srv-metric-top):not(.dm-srvx-bar):not(.srv-metric-bar){
    width:86px;margin:0 0 10px -43px
  }
  #page-server.dm-srvx .srv-metric-val{font-size:20px!important}
  #page-server.dm-srvx .srv-metric-lbl{font-size:9px!important;letter-spacing:.1em!important}
  #page-server.dm-srvx .srv-hero-top{margin-bottom:2px!important;flex-direction:row!important;align-items:center!important;gap:10px!important}
  #page-server.dm-srvx .srv-hero-pill{padding:6px 11px!important;font-size:10px!important;letter-spacing:.08em!important;flex-shrink:0!important}
  #page-server.dm-srvx .srv-hero-brand{min-width:0!important}
  #page-server.dm-srvx .srv-hero-title,
  #page-server.dm-srvx .srv-hero-sub{
    white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important
  }
  #page-server.dm-srvx .dm-srvx-trace-svg{height:42px}
  #page-server.dm-srvx .srv-temp-card{
    flex-direction:row!important;text-align:left!important;gap:14px!important;padding:16px!important
  }
  #page-server.dm-srvx .srv-temp-ring{width:92px!important;height:92px!important}
  #page-server.dm-srvx .srv-temp-num{font-size:24px!important}
  #page-server.dm-srvx .dm-srvx-temp-badge{font-size:12px!important;padding:5px 11px 5px 9px!important}
  #page-server.dm-srvx .dm-srvx-scale-ends{font-size:8px!important}
  #page-server.dm-srvx .srv-tel-val{font-size:21px!important}
  #page-server.dm-srvx .srv-status-grid{grid-template-columns:1fr!important}
}

/* ── dark theme ───────────────────────────────────────────────────────── */
html[data-theme="dark"] #page-server.dm-srvx{
  --srvx-shadow:0 22px 40px -26px rgba(0,0,0,.78),0 2px 6px -3px rgba(0,0,0,.5);
  --srvx-shadow-s:0 16px 30px -24px rgba(0,0,0,.72),0 2px 5px -3px rgba(0,0,0,.45);
  --srvx-live:#34d399;--srvx-live-rgb:52,211,153;
  --srvx-hero-bg:linear-gradient(170deg,#1c2842 0%,#111a2c 54%,#0a111e 100%);
  --srvx-hero-text:#f2f6ff;
  --srvx-hero-dim:rgba(198,214,240,.74);
  --srvx-hero-line:rgba(255,255,255,.1);
  --srvx-hero-shadow:0 28px 48px -28px rgba(0,0,0,.85),0 2px 6px -3px rgba(0,0,0,.5);
  --srvx-hero-inset:inset 0 1px 0 rgba(255,255,255,.06);
  --srvx-floor:rgba(148,197,255,.08);
  --srvx-floor-line:rgba(148,197,255,.09);
  --srvx-drop:rgba(0,0,0,.5);
  --srvx-case:#33415c;--srvx-case-top:#4a5c7e;--srvx-case-side:#1d2740;
  --srvx-case-front:#28344c;--srvx-case-edge:rgba(214,232,255,.22);
  --srvx-ink:rgba(198,224,255,.4);--srvx-vane:rgba(198,224,255,.28)
}
html[data-theme="dark"] #page-server.dm-srvx[data-dm-srv-net="off"]{--srvx-live:#f87171;--srvx-live-rgb:248,113,113}
html[data-theme="dark"] #page-server.dm-srvx .dm-srvx-scale-pin{border-color:#dbe6f7!important}
html[data-theme="dark"] #page-server.dm-srvx .dm-srvx-status-ico{background:rgba(255,255,255,.06)}

/* ── motion ───────────────────────────────────────────────────────────── */
@media (prefers-reduced-motion:reduce){
  #page-server.dm-srvx *,#page-server.dm-srvx *::before,#page-server.dm-srvx *::after{
    animation:none!important;transition:none!important
  }
}
`;
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", installMinipcShowcaseSection, { once: true });
} else {
  installMinipcShowcaseSection();
}
