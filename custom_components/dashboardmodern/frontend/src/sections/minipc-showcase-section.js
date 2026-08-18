// DM-FIX-20260818A
/* MiniPC section redesign — "Sala macchine".
 *
 * Reskins `#page-server` around the machine itself: the hero becomes the panel
 * of the machine, with the mini PC drawn in isometry, its LEDs and its fan, and
 * a live trace of the CPU load under it. CPU / RAM / Disk turn from flat bars
 * into ring gauges, the CPU temperature gets a thermal scale next to its ring,
 * the telemetry tiles trade emoji for line icons and three headings split the
 * page into thermal, telemetry and network. The panel follows the theme: it is
 * light on a light dashboard and deep navy only when the theme is dark.
 *
 * Contracts preserved on purpose — the legacy runtime keeps owning every value:
 * - the three metric bars `#srv-fill-cpu` / `#srv-fill-ram` / `#srv-fill-disk`
 *   stay in the DOM and keep being the only writers of the load: the rings read
 *   their width instead of parsing a sensor again;
 * - `#v-srv-cpu`, `#v-srv-ram` + `#u-srv-ram` and `#v-srv-disk` are moved into
 *   the middle of their ring, never copied, so the dynamic RAM unit (%, GB) the
 *   render loop writes still lands on screen;
 * - `#srv-temp-circle` keeps its `stroke-dasharray` and its `stroke`: the
 *   threshold colour stays the legacy one and the thermal scale reads the arc
 *   the runtime drew rather than re-deriving it from the sensor;
 * - `#v-srv-temp-status` stays the owner of the status wording; the badge next
 *   to the ring mirrors it and takes its level from the 🟢/🟡/🔴 marker the
 *   runtime already put in that text, so no threshold is duplicated here;
 * - `#waw-net-badge` / `#waw-inv-badge` keep the `srv-status-badge online` and
 *   `offline` class the render loop rewrites on every tick; the page mirrors the
 *   connectivity one onto `#page-server` as `data-dm-srv-net`, which is what
 *   turns the panel, the LEDs and the trace red when the machine drops off the
 *   network;
 * - every card keeps its `onclick`, so `apriStorico()` and `apriSrvHistory()`
 *   still open the history popups, and no `display` is forced with `!important`
 *   on a card `cdAutoHide()` shows or hides by writing an inline `display`.
 *
 * The live CPU trace is the one thing drawn from more than the current tick: it
 * keeps the last readings of `#srv-fill-cpu` in memory for the session, so it is
 * a picture of what the page already showed rather than a second history engine.
 *
 * The only numbers in this module are presentational: the 65 / 85 pair the
 * legacy `setRing()` already uses to colour these three gauges, and the 20-100
 * window plus the 75 °C notch the runtime itself draws the temperature arc in.
 */
import { clean, doc, installStyle, root, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_MINIPC_SHOWCASE__";
const STYLE_ID = "dm-minipc-showcase-style";
const state = (root[KEY] ||= { installed: false, listeners: false, frame: 0, trace: [] });
if (!Array.isArray(state.trace)) state.trace = [];

const RING_RADIUS = 52;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
/* Same pair as the legacy setRing(): above 85% the gauge is red, above 65%
   amber, below that it keeps the colour configured on the card. */
const WARN_LEVEL = 65;
const ALERT_LEVEL = 85;
const WARN_COLOUR = "#f59e0b";
const ALERT_COLOUR = "#ef4444";

/* Readings kept for the trace: about ten minutes of a dashboard that ticks
   every few seconds, and short enough to stay a glance rather than a chart. */
const TRACE_SAMPLES = 96;
const TRACE_WIDTH = 300;
const TRACE_HEIGHT = 56;

/* The gauges follow the order of the cards in the hero, which is the order the
   legacy markup writes the bars in. */
const METRIC_BARS = Object.freeze(["srv-fill-cpu", "srv-fill-ram", "srv-fill-disk"]);

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
  thermo: '<path d="M14 14.4V5.2a2 2 0 1 0-4 0v9.2a3.9 3.9 0 1 0 4 0Z"/>',
});

/* The telemetry tiles are static markup: their emoji is decoration, so it can be
   swapped for a line icon keyed on the entity the tile opens in the history. */
const TELEMETRY_ICONS = Object.freeze({
  "dm.server_potenza_raspberry_server": "bolt",
  "dm.server_uptime_home_assistant": "clock",
  "dm.server_speedtest_download": "down",
  "dm.server_speedtest_upload": "up",
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

/** Dash pair drawing `level` percent of a ring. */
export function ringDash(level, circumference = RING_LENGTH) {
  const value = Number.isFinite(level) ? Math.max(0, Math.min(100, level)) : 0;
  const drawn = (value / 100) * circumference;
  return `${drawn.toFixed(1)} ${(circumference - drawn).toFixed(1)}`;
}

/** Colour of a gauge: the card's own colour until the legacy thresholds bite. */
export function ringColour(level, colour) {
  if (Number.isFinite(level) && level > ALERT_LEVEL) return ALERT_COLOUR;
  if (Number.isFinite(level) && level > WARN_LEVEL) return WARN_COLOUR;
  return colour;
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

/**
 * The trace, as the two paths that draw it: the line and the area under it.
 * A single reading is drawn flat across the band instead of as a lone dot.
 */
/** Height of one reading inside the band, as a share of the band. */
export function traceOffset(value, height = TRACE_HEIGHT) {
  const level = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  return (height - 3 - (level / 100) * (height - 6)) / height;
}

export function tracePaths(values, width = TRACE_WIDTH, height = TRACE_HEIGHT) {
  const points = (values || []).filter((value) => Number.isFinite(value));
  if (!points.length) return { line: "", area: "" };
  const span = points.length > 1 ? width / (points.length - 1) : width;
  const y = (value) => traceOffset(value, height) * height;
  const line =
    points.length === 1
      ? `M0 ${y(points[0]).toFixed(1)} L${width} ${y(points[0]).toFixed(1)}`
      : points.map((value, index) => `${index ? "L" : "M"}${(index * span).toFixed(1)} ${y(value).toFixed(1)}`).join(" ");
  return { line, area: `${line} L${width} ${height} L0 ${height} Z` };
}

/** Connectivity, read from the badge class the render loop rewrites per tick. */
export function networkState(scope = doc) {
  const badge = scope?.getElementById?.("waw-net-badge");
  if (badge?.classList?.contains("offline")) return "off";
  if (badge?.classList?.contains("online")) return "on";
  return "";
}

/**
 * Keep the reading the page is showing. Sampling happens on every state event,
 * page open or not, so the trace is already drawn when the section is opened.
 */
export function sampleCpu(scope = doc, samples = state.trace) {
  const level = metricLevel("srv-fill-cpu", scope);
  if (level === null) return samples;
  samples.push(level);
  while (samples.length > TRACE_SAMPLES) samples.shift();
  return samples;
}

/* ── mount ────────────────────────────────────────────────────────────── */

function ringMarkup() {
  return `
    <svg class="dm-srvx-ring" viewBox="0 0 120 120" aria-hidden="true">
      <circle class="dm-srvx-ring-track" cx="60" cy="60" r="${RING_RADIUS}" fill="none" stroke-width="8"/>
      <circle class="dm-srvx-ring-arc" cx="60" cy="60" r="${RING_RADIUS}" fill="none" stroke-width="8" stroke-linecap="round" stroke-dasharray="0 ${RING_LENGTH.toFixed(1)}"/>
    </svg>`;
}

/**
 * Turn one metric card into a ring gauge. The value nodes are moved into the
 * middle of the ring, never copied, so the render loop keeps one target.
 */
function mountGauge(card) {
  if (card.dataset.dmSrvxGauge) return;
  card.dataset.dmSrvxGauge = "true";
  const gauge = doc.createElement("div");
  gauge.className = "dm-srvx-gauge";
  gauge.innerHTML = `${ringMarkup()}<div class="dm-srvx-gauge-val"></div>`;
  const value = card.querySelector(".srv-metric-val")?.parentElement;
  card.prepend(gauge);
  if (value) gauge.querySelector(".dm-srvx-gauge-val")?.append(value);
  const glyph = card.querySelector(".srv-metric-icon");
  const name = METRIC_ICONS[cardEntity(card)];
  if (glyph && name) glyph.innerHTML = icon(name, 16);
}

/**
 * The machine itself: an isometric chassis drawn once in the slot the hero
 * already has. Only the LEDs and the fan move, and both stop when the badge
 * says the machine is off the network.
 */
function mountChassis(page) {
  const slot = page.querySelector(".srv-hero-icon");
  if (!slot || slot.dataset.dmSrvxChassis) return;
  slot.dataset.dmSrvxChassis = "true";
  slot.innerHTML = `
    <svg class="dm-srvx-box" viewBox="0 0 120 104" aria-hidden="true">
      <defs>
        <linearGradient id="dmSrvxTop" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style="stop-color:var(--srvx-case-top-a)"/>
          <stop offset="1" style="stop-color:var(--srvx-case-top-b)"/>
        </linearGradient>
        <linearGradient id="dmSrvxLeft" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style="stop-color:var(--srvx-case-left-a)"/>
          <stop offset="1" style="stop-color:var(--srvx-case-left-b)"/>
        </linearGradient>
        <linearGradient id="dmSrvxRight" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style="stop-color:var(--srvx-case-right-a)"/>
          <stop offset="1" style="stop-color:var(--srvx-case-right-b)"/>
        </linearGradient>
      </defs>
      <ellipse class="dm-srvx-box-glow" cx="60" cy="86" rx="40" ry="9"/>
      <g class="dm-srvx-box-body">
        <path d="M60 16 100 39 60 62 20 39Z" fill="url(#dmSrvxTop)"/>
        <path d="M20 39 60 62v20L20 59Z" fill="url(#dmSrvxLeft)"/>
        <path d="M100 39 60 62v20l40-23Z" fill="url(#dmSrvxRight)"/>
        <path class="dm-srvx-box-edge" d="M60 16 100 39 60 62 20 39Z" fill="none" stroke-width="1.1" stroke-linejoin="round"/>
        <path class="dm-srvx-box-edge dm-srvx-box-edge-soft" d="M20 39v20l40 23 40-23V39" fill="none" stroke-width="1.1" stroke-linejoin="round"/>
      </g>
      <g class="dm-srvx-vents" stroke-width="1.6" stroke-linecap="round">
        <path d="M74 34.5 87 42M70 37 83 44.5M66 39.5 79 47"/>
      </g>
      <g transform="rotate(-29.7 45 39)">
        <ellipse class="dm-srvx-fan-hole" cx="45" cy="39" rx="12.8" ry="12.8" stroke-width="1.2" transform="scale(1 .5)" transform-origin="45 39"/>
        <g class="dm-srvx-fan" transform="scale(1 .5)" transform-origin="45 39">
          <path d="M45 39c1.4-4.4 4.6-7.4 8.4-7.9.4 4.2-2.8 8.1-8.4 7.9Z" transform="rotate(0 45 39)"/>
          <path d="M45 39c1.4-4.4 4.6-7.4 8.4-7.9.4 4.2-2.8 8.1-8.4 7.9Z" transform="rotate(72 45 39)"/>
          <path d="M45 39c1.4-4.4 4.6-7.4 8.4-7.9.4 4.2-2.8 8.1-8.4 7.9Z" transform="rotate(144 45 39)"/>
          <path d="M45 39c1.4-4.4 4.6-7.4 8.4-7.9.4 4.2-2.8 8.1-8.4 7.9Z" transform="rotate(216 45 39)"/>
          <path d="M45 39c1.4-4.4 4.6-7.4 8.4-7.9.4 4.2-2.8 8.1-8.4 7.9Z" transform="rotate(288 45 39)"/>
          <circle class="dm-srvx-fan-hub" cx="45" cy="39" r="2.2" stroke-width="1"/>
        </g>
      </g>
      <g class="dm-srvx-front">
        <path class="dm-srvx-strip" d="M25.5 47.5 54 63.8"/>
        <circle class="dm-srvx-led dm-srvx-led-pwr" cx="28" cy="57" r="2.6"/>
        <circle class="dm-srvx-led dm-srvx-led-act" cx="35.5" cy="61.4" r="2.6"/>
        <path class="dm-srvx-port" d="M44 66.5 52 71" stroke-width="3.4" stroke-linecap="round"/>
      </g>
      <g class="dm-srvx-side" stroke-width="1.5" stroke-linecap="round">
        <path d="M70 63.5v9M76 60v9M82 56.5v9M88 53v9"/>
      </g>
    </svg>`;
}

/**
 * The band under the header: the readings this page has already shown, kept for
 * the session so the machine has a shape over time and not just a number.
 */
function mountTrace(page) {
  const hero = page.querySelector(".srv-hero");
  const top = hero?.querySelector(".srv-hero-top");
  if (!top) return null;
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
            <stop offset="0" stop-color="currentColor" stop-opacity=".42"/>
            <stop offset="1" stop-color="currentColor" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path class="dm-srvx-trace-mid" d="M0 ${(TRACE_HEIGHT / 2).toFixed(1)} H${TRACE_WIDTH}" fill="none"/>
        <path class="dm-srvx-trace-area" d=""/>
        <path class="dm-srvx-trace-line" d="" fill="none"/>
      </svg>
      <span class="dm-srvx-trace-dot"></span>
    </div>`;
  top.insertAdjacentElement("afterend", trace);
  return trace;
}

/* Headings that give the page its three blocks. Each one is tied to the block
   below it, so a block emptied by cdAutoHide() does not leave a title behind. */
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

/** Hide a heading whose whole block the auto-hide has taken off the page. */
function syncHeadings(page) {
  for (const group of GROUPS) {
    const block = page.querySelector(group.block);
    const heading = block?.previousElementSibling;
    if (!heading?.classList?.contains("dm-srvx-head")) continue;
    const cards = block.matches(group.card) ? [block] : [...block.querySelectorAll(group.card)];
    const empty = cards.length > 0 && cards.every((card) => card.style.display === "none");
    const display = empty ? "none" : "";
    if (heading.style.display !== display) heading.style.display = display;
  }
}

/** Aurora and sweep behind the chassis panel — decoration, not a reading. */
function mountHeroEffect(page) {
  const hero = page.querySelector(".srv-hero");
  if (!hero || hero.dataset.dmSrvxFx) return;
  hero.dataset.dmSrvxFx = "true";
  const effect = doc.createElement("div");
  effect.className = "dm-srvx-fx";
  effect.setAttribute("aria-hidden", "true");
  hero.prepend(effect);
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

function mountTelemetryIcons(page) {
  for (const tile of page.querySelectorAll(".srv-tel-card")) {
    const glyph = tile.querySelector(".srv-tel-icon");
    const name = TELEMETRY_ICONS[cardEntity(tile)];
    if (!glyph || !name || glyph.dataset.dmSrvxIcon) continue;
    glyph.dataset.dmSrvxIcon = name;
    glyph.innerHTML = icon(name, 19);
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

/** Draw the samples collected so far; an empty trace keeps the band hidden. */
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

export function renderMinipcShowcase() {
  const page = doc?.getElementById?.("page-server");
  if (!page) return false;
  page.classList.add("dm-srvx");
  page.querySelector(".srv-hero")?.parentElement?.classList.add("dm-srvx-shell");
  mountHeroEffect(page);
  mountChassis(page);
  mountTelemetryIcons(page);
  mountStatusIcons(page);
  mountHeadings(page);
  syncHeadings(page);
  renderTrace(mountTrace(page));
  const thermal = mountThermal(page) || page.querySelector(".srv-temp-card");

  const cards = [...page.querySelectorAll(".srv-hero-metrics .srv-metric")];
  cards.forEach((card, index) => {
    mountGauge(card);
    const arc = card.querySelector(".dm-srvx-ring-arc");
    if (!arc) return;
    const level = metricLevel(METRIC_BARS[index] || "", doc);
    const dash = ringDash(level ?? 0);
    if (arc.getAttribute("stroke-dasharray") !== dash) arc.setAttribute("stroke-dasharray", dash);
    // The bar carries the colour the markup configured for this metric.
    const own = clean(card.querySelector(".srv-metric-fill")?.style?.background) || "currentColor";
    const colour = ringColour(level, own);
    if (arc.getAttribute("stroke") !== colour) arc.setAttribute("stroke", colour);
    const loaded = level === null ? "" : level > ALERT_LEVEL ? "alert" : level > WARN_LEVEL ? "warn" : "ok";
    if (card.dataset.dmSrvxLevel !== loaded) card.dataset.dmSrvxLevel = loaded;
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
      root.addEventListener?.(eventName, scheduleMinipcShowcase);
    }
    // The bars, the temperature arc and the badges repaint through the legacy
    // render loop, so the gauges follow the same events instead of a timer.
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
  /* the hero follows the theme: light surfaces on a light dashboard */
  --srvx-hero-bg:linear-gradient(150deg,#fbfdff 0%,#edf3fa 55%,#e4ecf6 100%);
  --srvx-hero-text:var(--srvx-text);
  --srvx-hero-dim:var(--srvx-dim);
  --srvx-hero-tile:#ffffff;
  --srvx-hero-tile-shadow:0 12px 24px -18px rgba(10,26,44,.5);
  --srvx-hero-line:rgba(15,23,42,.08);
  --srvx-hero-shadow:0 24px 44px -30px rgba(10,26,44,.55),0 2px 6px -3px rgba(10,26,44,.1);
  --srvx-hero-inset:inset 0 0 0 1px rgba(15,23,42,.05);
  --srvx-track:rgba(15,23,42,.09);
  --srvx-case-top-a:#eef3fa;--srvx-case-top-b:#c3d0e0;
  --srvx-case-left-a:#a9b7ca;--srvx-case-left-b:#8b9bb1;
  --srvx-case-right-a:#93a2b8;--srvx-case-right-b:#76869d;
  --srvx-case-edge:rgba(255,255,255,.9);
  --srvx-case-ink:rgba(15,23,42,.34);
  --srvx-case-hole:rgba(15,23,42,.18);
  --srvx-case-blade:rgba(15,23,42,.3);
  --srvx-case-shadow:0 12px 16px rgba(15,32,56,.22);
}
#page-server.dm-srvx[data-dm-srv-net="off"]{--srvx-live:#ef4444;--srvx-live-rgb:239,68,68}
#page-server.dm-srvx .dm-srvx-shell{display:grid;gap:14px}
#page-server.dm-srvx .dm-srvx-ico{display:block;flex:0 0 auto}

/* ── the chassis panel ────────────────────────────────────────────────── */
#page-server.dm-srvx .srv-hero{
  margin-bottom:0!important;padding:20px!important;border:0!important;
  border-radius:var(--srvx-r)!important;
  background:var(--srvx-hero-bg)!important;
  box-shadow:var(--srvx-hero-shadow),var(--srvx-hero-inset)!important;
  color:var(--srvx-hero-text)!important
}
#page-server.dm-srvx .srv-hero::before{
  top:-46%!important;right:-12%!important;width:340px!important;height:340px!important;
  background:radial-gradient(circle,rgba(var(--srvx-live-rgb),.14) 0%,transparent 68%)!important
}
#page-server.dm-srvx .srv-hero::after{
  bottom:-34%!important;left:-8%!important;width:280px!important;height:280px!important;
  background:radial-gradient(circle,rgba(56,189,248,.14) 0%,transparent 70%)!important
}
/* faint board traces plus a sweep that crosses the panel */
#page-server.dm-srvx .dm-srvx-fx{
  position:absolute;inset:0;z-index:1;pointer-events:none;overflow:hidden;
  border-radius:inherit;opacity:.5;
  background-image:
    linear-gradient(var(--srvx-hero-line) 1px,transparent 1px),
    linear-gradient(90deg,var(--srvx-hero-line) 1px,transparent 1px);
  background-size:34px 34px,34px 34px;
  -webkit-mask-image:radial-gradient(120% 90% at 78% 8%,#000 0%,transparent 72%);
  mask-image:radial-gradient(120% 90% at 78% 8%,#000 0%,transparent 72%)
}
#page-server.dm-srvx .dm-srvx-fx::after{
  content:"";position:absolute;top:0;bottom:0;width:34%;left:-40%;
  background:linear-gradient(90deg,transparent,rgba(var(--srvx-live-rgb),.10),transparent);
  animation:dmSrvxSweep 9s ease-in-out infinite
}
#page-server.dm-srvx .srv-hero-top{margin-bottom:20px!important;z-index:2}
/* the machine stands on the panel instead of sitting in a chip */
#page-server.dm-srvx .srv-hero-icon{
  width:112px!important;height:100px!important;border:0!important;border-radius:0!important;
  background:none!important;box-shadow:none!important;padding:0!important;overflow:visible!important
}
#page-server.dm-srvx .dm-srvx-box{width:100%;height:100%;display:block;overflow:visible}
#page-server.dm-srvx .dm-srvx-box-body{filter:drop-shadow(var(--srvx-case-shadow))}
#page-server.dm-srvx .dm-srvx-box-glow{
  fill:rgba(var(--srvx-live-rgb),.20);filter:blur(7px);transition:fill .5s ease
}
#page-server.dm-srvx .dm-srvx-box-edge{stroke:var(--srvx-case-edge)}
#page-server.dm-srvx .dm-srvx-box-edge-soft{opacity:.45}
#page-server.dm-srvx .dm-srvx-vents{stroke:var(--srvx-case-ink)}
#page-server.dm-srvx .dm-srvx-side{stroke:var(--srvx-case-ink);opacity:.6}
#page-server.dm-srvx .dm-srvx-port{stroke:var(--srvx-case-ink);opacity:.55}
#page-server.dm-srvx .dm-srvx-fan-hole{fill:var(--srvx-case-hole);stroke:var(--srvx-case-edge);opacity:.9}
#page-server.dm-srvx .dm-srvx-fan-hub{fill:var(--srvx-case-hole);stroke:var(--srvx-case-edge)}
#page-server.dm-srvx .dm-srvx-fan{
  fill:var(--srvx-case-blade);transform-box:fill-box;transform-origin:center;
  animation:dmSrvxSpin 3.4s linear infinite
}
#page-server.dm-srvx .dm-srvx-strip{
  stroke:var(--srvx-live);stroke-width:2.4;stroke-linecap:round;opacity:.85;
  filter:drop-shadow(0 0 5px rgba(var(--srvx-live-rgb),.8))
}
#page-server.dm-srvx .dm-srvx-led{fill:var(--srvx-live)}
#page-server.dm-srvx .dm-srvx-led-pwr{filter:drop-shadow(0 0 5px rgba(var(--srvx-live-rgb),.95))}
#page-server.dm-srvx .dm-srvx-led-act{fill:#60a5fa;animation:dmSrvxBlink 2.6s steps(1,end) infinite}
#page-server.dm-srvx[data-dm-srv-net="off"] .dm-srvx-led-act{fill:#64748b;animation:none}
#page-server.dm-srvx[data-dm-srv-net="off"] .dm-srvx-fan{animation:none}
#page-server.dm-srvx .srv-hero-brand>div{min-width:0}
#page-server.dm-srvx .srv-hero-title{color:var(--srvx-hero-text)!important;font-size:23px!important;letter-spacing:.06em!important}
#page-server.dm-srvx .srv-hero-sub{color:var(--srvx-hero-dim)!important;letter-spacing:.14em!important}
#page-server.dm-srvx .srv-hero-pill{
  background:rgba(var(--srvx-live-rgb),.14)!important;
  border:1px solid rgba(var(--srvx-live-rgb),.34)!important;
  color:var(--srvx-live)!important;padding:8px 15px!important
}
#page-server.dm-srvx .srv-hero-dot{
  background:var(--srvx-live)!important;
  box-shadow:0 0 0 4px rgba(var(--srvx-live-rgb),.18)!important
}

/* ── the live CPU trace ───────────────────────────────────────────────── */
#page-server.dm-srvx .dm-srvx-trace{position:relative;z-index:2;margin:0 0 16px;display:grid;gap:6px}
#page-server.dm-srvx .dm-srvx-trace[data-dm-srvx-trace="empty"]{display:none}
#page-server.dm-srvx .dm-srvx-trace-head{
  display:flex;align-items:baseline;justify-content:space-between;gap:10px;
  font-size:9.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase
}
#page-server.dm-srvx .dm-srvx-trace-lbl{color:var(--srvx-hero-dim)}
#page-server.dm-srvx .dm-srvx-trace-peak{color:var(--srvx-live);letter-spacing:.1em}
#page-server.dm-srvx .dm-srvx-trace-plot{position:relative}
#page-server.dm-srvx .dm-srvx-trace-svg{
  display:block;width:100%;height:46px;
  border-bottom:1px solid var(--srvx-hero-line)
}
#page-server.dm-srvx .dm-srvx-trace-mid{
  stroke:var(--srvx-hero-line);stroke-width:1;stroke-dasharray:3 5;vector-effect:non-scaling-stroke
}
#page-server.dm-srvx .dm-srvx-trace-dot{
  position:absolute;right:0;top:var(--dm-srvx-last,50%);
  width:8px;height:8px;margin:-4px -4px 0 0;border-radius:50%;background:var(--srvx-live);
  box-shadow:0 0 0 3px rgba(var(--srvx-live-rgb),.22);
  transition:top .6s cubic-bezier(.2,.8,.25,1)
}
#page-server.dm-srvx .dm-srvx-trace-svg{color:var(--srvx-live)}
#page-server.dm-srvx .dm-srvx-trace-area{fill:url(#dmSrvxTraceFill)}
#page-server.dm-srvx .dm-srvx-trace-line{
  stroke:var(--srvx-live);stroke-width:2;stroke-linejoin:round;stroke-linecap:round;
  vector-effect:non-scaling-stroke
}

/* ── section headings ─────────────────────────────────────────────────── */
#page-server.dm-srvx .dm-srvx-head{
  display:flex;align-items:center;gap:12px;margin:6px 2px -2px;
  font-size:9.5px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;
  color:var(--srvx-dim)
}
#page-server.dm-srvx .dm-srvx-head::after{
  content:"";flex:1;height:1px;
  background:linear-gradient(90deg,color-mix(in srgb,var(--srvx-dim) 32%,transparent),transparent)
}

/* ── the three ring gauges ────────────────────────────────────────────── */
#page-server.dm-srvx .srv-hero-metrics{gap:14px!important}
/* no !important on display: cdAutoHide() writes it inline on unmapped cards */
#page-server.dm-srvx .srv-metric{
  display:grid;grid-template-rows:auto auto;justify-items:center;gap:10px;
  padding:16px 12px 14px!important;border-radius:var(--srvx-r-s)!important;
  background:var(--srvx-hero-tile)!important;border:1px solid var(--srvx-hero-line)!important;
  box-shadow:var(--srvx-hero-tile-shadow,none)!important;
  transition:transform .3s cubic-bezier(.34,1.4,.5,1),background .3s ease,border-color .3s ease,box-shadow .3s ease!important
}
#page-server.dm-srvx .srv-metric:hover{
  transform:translateY(-3px)!important;
  box-shadow:0 18px 28px -20px rgba(10,26,44,.45)!important
}
#page-server.dm-srvx .dm-srvx-gauge{position:relative;width:104px;height:104px}
#page-server.dm-srvx .dm-srvx-ring{width:100%;height:100%;transform:rotate(-90deg)}
#page-server.dm-srvx .dm-srvx-ring-track{stroke:var(--srvx-track)}
#page-server.dm-srvx .dm-srvx-ring-arc{transition:stroke-dasharray 1.1s cubic-bezier(.2,.8,.25,1),stroke .45s ease}
#page-server.dm-srvx .dm-srvx-gauge-val{
  position:absolute;inset:0;display:grid;place-content:center;text-align:center
}
#page-server.dm-srvx .srv-metric-val{
  font-size:30px!important;font-weight:300!important;letter-spacing:-.04em!important;
  color:var(--srvx-hero-text)!important;line-height:1!important
}
#page-server.dm-srvx .srv-metric-unit{
  font-size:13px!important;font-weight:700!important;color:var(--srvx-hero-dim)!important;margin-left:2px!important
}
#page-server.dm-srvx .srv-metric-top{width:100%;justify-content:center!important;gap:7px}
#page-server.dm-srvx .srv-metric-icon{order:-1}
#page-server.dm-srvx .srv-metric-lbl{
  font-size:10px!important;letter-spacing:.16em!important;color:var(--srvx-hero-dim)!important
}
#page-server.dm-srvx .srv-metric-icon{
  display:grid!important;place-items:center!important;font-size:0!important;
  color:var(--srvx-hero-dim)!important;opacity:.8!important
}
#page-server.dm-srvx .srv-metric[data-dm-srvx-level="alert"] .srv-metric-lbl{color:#dc2626!important}
#page-server.dm-srvx .srv-metric[data-dm-srvx-level="alert"]{border-color:rgba(239,68,68,.35)!important}
/* the bar stays: it is the value the rings read, so it is hidden, not removed */
#page-server.dm-srvx .srv-metric-bar{display:none!important}

/* ── CPU temperature ──────────────────────────────────────────────────── */
#page-server.dm-srvx .srv-temp-card{
  gap:24px!important;padding:20px 22px!important;margin-bottom:0!important;border:0!important;
  border-radius:var(--srvx-r)!important;background:var(--srvx-surface)!important;
  box-shadow:var(--srvx-shadow)!important
}
#page-server.dm-srvx .srv-temp-ring{width:116px!important;height:116px!important}
#page-server.dm-srvx .srv-temp-ring svg{width:100%!important;height:100%!important}
/* only the track: #srv-temp-circle keeps the stroke the legacy loop writes */
#page-server.dm-srvx .srv-temp-ring circle:not([id]){stroke:var(--srvx-surface-2)!important;stroke-width:8!important}
#page-server.dm-srvx #srv-temp-circle{stroke-width:8!important}
#page-server.dm-srvx .srv-temp-num{font-size:30px!important;font-weight:300!important;letter-spacing:-.04em!important}
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
#page-server.dm-srvx .dm-srvx-scale-pin{
  position:absolute;top:50%;left:var(--dm-srvx-temp,0%);width:14px;height:14px;margin:-7px 0 0 -7px;
  border-radius:50%;background:var(--srvx-surface);border:3px solid var(--srvx-text);
  box-shadow:0 4px 10px -3px rgba(10,26,44,.6);
  transition:left 1.1s cubic-bezier(.2,.8,.25,1)
}
#page-server.dm-srvx .dm-srvx-scale-limit{
  position:absolute;left:68.75%;top:-3px;bottom:-3px;width:2px;border-radius:2px;
  background:var(--srvx-surface);opacity:.85
}
#page-server.dm-srvx .dm-srvx-scale-ends{
  position:relative;display:flex;justify-content:space-between;font-size:9px;font-weight:800;
  letter-spacing:.08em;color:var(--srvx-dim);text-transform:uppercase
}
#page-server.dm-srvx .dm-srvx-scale-mark{
  position:absolute;left:68.75%;transform:translateX(-50%);white-space:nowrap;opacity:.75
}

/* ── telemetry ────────────────────────────────────────────────────────── */
#page-server.dm-srvx .srv-tel-grid{grid-template-columns:repeat(4,1fr)!important;gap:12px!important;margin-bottom:0!important}
#page-server.dm-srvx .srv-tel-card{
  padding:16px 15px!important;border:0!important;border-radius:var(--srvx-r-s)!important;
  background:var(--srvx-surface)!important;box-shadow:var(--srvx-shadow-s)!important;gap:10px!important
}
#page-server.dm-srvx .srv-tel-card::before{
  width:120px!important;height:120px!important;
  background:radial-gradient(circle at top right,rgba(var(--tc-rgb,14,165,233),.14) 0%,transparent 68%)!important
}
#page-server.dm-srvx .srv-tel-card:hover{transform:translateY(-4px)!important;box-shadow:0 24px 36px -22px rgba(10,26,44,.62)!important}
#page-server.dm-srvx .srv-tel-icon{
  width:32px!important;height:32px!important;border-radius:11px!important;font-size:0!important;
  background:rgba(var(--tc-rgb,14,165,233),.13)!important;border:0!important;
  color:rgb(var(--tc-rgb,14,165,233))!important
}
#page-server.dm-srvx .srv-tel-lbl{font-size:9.5px!important;letter-spacing:.12em!important}
#page-server.dm-srvx .srv-tel-val{font-size:26px!important;letter-spacing:-.02em!important}
#page-server.dm-srvx .srv-tel-sub{font-size:9.5px!important;color:var(--srvx-dim)!important}

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
@keyframes dmSrvxSweep{0%{left:-40%}55%{left:106%}100%{left:106%}}
@keyframes dmSrvxBlink{0%,44%{opacity:.25}50%,58%{opacity:1}64%,100%{opacity:.25}}

/* ── responsive ───────────────────────────────────────────────────────── */
@media(max-width:760px){
  #page-server.dm-srvx .srv-tel-grid{grid-template-columns:repeat(2,1fr)!important}
}
@media(max-width:620px){
  #page-server.dm-srvx{--srvx-r:22px;--srvx-r-s:17px}
  #page-server.dm-srvx .srv-hero{padding:16px!important}
  /* the legacy sheet stacks these two: the pill belongs next to the name and
     the temperature ring next to its scale, on a phone as much as on a desk */
  #page-server.dm-srvx .srv-hero-top{
    flex-direction:row!important;align-items:center!important;gap:10px!important;margin-bottom:16px!important
  }
  #page-server.dm-srvx .srv-hero-pill{padding:6px 11px!important;font-size:10px!important;letter-spacing:.08em!important;flex-shrink:0!important}
  #page-server.dm-srvx .srv-hero-brand{gap:11px!important;min-width:0!important}
  /* the subtitle gives way instead of pushing the pill onto its own line */
  #page-server.dm-srvx .srv-hero-title,
  #page-server.dm-srvx .srv-hero-sub{
    white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important
  }
  #page-server.dm-srvx .srv-temp-card{
    flex-direction:row!important;text-align:left!important;align-items:center!important
  }
  #page-server.dm-srvx .srv-temp-num{font-size:24px!important}
  #page-server.dm-srvx .dm-srvx-temp-badge{font-size:12px!important;padding:5px 11px 5px 9px!important}
  #page-server.dm-srvx .dm-srvx-scale-ends{font-size:8px!important}
  #page-server.dm-srvx .srv-hero-metrics{gap:9px!important}
  #page-server.dm-srvx .srv-metric{padding:13px 6px 11px!important}
  #page-server.dm-srvx .dm-srvx-gauge{width:82px;height:82px}
  #page-server.dm-srvx .srv-metric-val{font-size:23px!important}
  #page-server.dm-srvx .srv-metric-unit{font-size:11px!important}
  #page-server.dm-srvx .srv-hero-icon{width:78px!important;height:70px!important}
  #page-server.dm-srvx .dm-srvx-trace{margin-bottom:13px}
  #page-server.dm-srvx .dm-srvx-trace-svg{height:44px}
  #page-server.dm-srvx .dm-srvx-head{letter-spacing:.14em}
  #page-server.dm-srvx .srv-hero-title{font-size:19px!important}
  #page-server.dm-srvx .srv-temp-card{gap:15px!important;padding:16px!important}
  #page-server.dm-srvx .srv-temp-ring{width:92px!important;height:92px!important}
  #page-server.dm-srvx .srv-tel-val{font-size:22px!important}
  #page-server.dm-srvx .srv-status-grid{grid-template-columns:1fr!important}
}

/* ── dark theme ───────────────────────────────────────────────────────── */
html[data-theme="dark"] #page-server.dm-srvx{
  --srvx-shadow:0 22px 40px -26px rgba(0,0,0,.78),0 2px 6px -3px rgba(0,0,0,.5);
  --srvx-shadow-s:0 16px 30px -24px rgba(0,0,0,.72),0 2px 5px -3px rgba(0,0,0,.45);
  --srvx-live:#34d399;--srvx-live-rgb:52,211,153;
  --srvx-hero-bg:linear-gradient(150deg,#1b2740 0%,#111a2c 54%,#0a111e 100%);
  --srvx-hero-text:#f2f6ff;
  --srvx-hero-dim:rgba(198,214,240,.74);
  --srvx-hero-tile:rgba(255,255,255,.055);
  --srvx-hero-tile-shadow:inset 0 1px 0 rgba(255,255,255,.07);
  --srvx-hero-line:rgba(255,255,255,.10);
  --srvx-hero-shadow:0 28px 48px -28px rgba(0,0,0,.85),0 2px 6px -3px rgba(0,0,0,.5);
  --srvx-hero-inset:inset 0 1px 0 rgba(255,255,255,.06);
  --srvx-track:rgba(255,255,255,.10);
  --srvx-case-top-a:#6a80a8;--srvx-case-top-b:#2f3f5e;
  --srvx-case-left-a:#2b3a56;--srvx-case-left-b:#141d31;
  --srvx-case-right-a:#1b2540;--srvx-case-right-b:#0d1424;
  --srvx-case-edge:rgba(224,239,255,.38);
  --srvx-case-ink:rgba(190,220,255,.34);
  --srvx-case-hole:rgba(6,12,24,.6);
  --srvx-case-blade:rgba(198,224,255,.42);
  --srvx-case-shadow:0 14px 18px rgba(4,10,20,.55)
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
