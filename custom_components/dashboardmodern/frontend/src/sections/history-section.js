import { clean, doc, installStyle, locale, root, section, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_HISTORY_SECTION__";
const state = (root[KEY] ||= {
  installed: false,
  currentEntity: "",
  currentName: "",
  chart: null,
  generation: 0,
  zoom: null,
  gesture: null,
});

function resolvedEntity(reference) {
  const original = clean(reference);
  if (!original) return "";
  try {
    return clean(root.resolveEntity?.(original) || original);
  } catch (_error) {
    return original;
  }
}

function configuredEntity(entry) {
  return clean(typeof entry === "string" ? entry : entry?.entity || entry?.entity_id);
}

/**
 * Pick the entity used by the 1/6/12/24 hour appliance popup.
 *
 * Short-term history is a usage graph, therefore instantaneous power is the
 * canonical source. Lifetime/total energy belongs to Report and month/year
 * reconstruction and is only a last-resort history source when the appliance
 * has no power/state entity at all.
 */
export function applianceHistorySource(device = {}, states = {}) {
  const entries = (device.entities || []).map(configuredEntity).filter(Boolean);
  const explicitPower = resolvedEntity(device.power_entity);
  if (explicitPower) return explicitPower;

  const powerFromEntities = entries
    .map(resolvedEntity)
    .find((id) => /^(w|kw)$/i.test(clean(states?.[id]?.attributes?.unit_of_measurement)));
  if (powerFromEntities) return powerFromEntities;

  for (const value of [device.state_entity, device.status_entity, device.control_entity]) {
    const id = resolvedEntity(value);
    if (id) return id;
  }

  const namedPower = entries.map(resolvedEntity).find((id) => /power|potenza|watt/i.test(id));
  if (namedPower) return namedPower;

  for (const value of [
    device.history_entity,
    device.total_energy_entity,
    device.energy_entity,
    device.monthly_energy_entity,
    device.daily_energy_entity,
  ]) {
    const id = resolvedEntity(value);
    if (id) return id;
  }
  return entries.map(resolvedEntity).find(Boolean) || "";
}

function rowState(row) {
  return row?.state ?? row?.s ?? null;
}

function rowTime(row) {
  const raw = row?.last_changed ?? row?.last_updated ?? row?.lc ?? row?.lu ?? row?.timestamp;
  if (typeof raw === "number") return raw < 1_000_000_000_000 ? raw * 1000 : raw;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeHistoryRows(result, entityId) {
  const entity = clean(entityId);
  const rows = Array.isArray(result)
    ? (Array.isArray(result[0]) ? result[0] : result)
    : result?.[entity] || [];
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({ state: rowState(row), time: rowTime(row) }))
    .filter((row) => row.state != null && row.time > 0)
    .sort((left, right) => left.time - right.time);
}

function historyValue(raw) {
  const text = clean(raw).toLowerCase();
  if (!text || text === "unknown" || text === "unavailable") return null;
  const numeric = Number(text);
  if (Number.isFinite(numeric)) return { value: numeric, categorical: false };
  return {
    value: ["on", "open", "opening", "armed_away", "armed_night", "home", "heat", "cool"].includes(text) ? 1 : 0,
    categorical: true,
  };
}

function setLoading(kind, message = "") {
  const loading = doc?.getElementById("hist-loading");
  const container = doc?.getElementById("hist-canvas-container");
  if (!loading || !container) return;
  if (kind === "loading") {
    loading.style.display = "flex";
    loading.innerHTML = `<div class="hist-spinner"></div>${t("Sincronizzazione dati…", "Synchronizing data…")}`;
    container.style.display = "none";
    return;
  }
  if (kind === "empty") {
    loading.style.display = "flex";
    loading.innerHTML = `<div style="font-size:32px;margin-bottom:6px">📭</div>${message || t("Nessun dato registrato", "No recorded data")}`;
    container.style.display = "none";
    return;
  }
  if (kind === "error") {
    loading.style.display = "flex";
    loading.innerHTML = `<div style="font-size:32px;margin-bottom:6px;color:#e11d48">⚠️</div>${message || t("Errore caricamento storico", "History loading error")}`;
    container.style.display = "none";
    return;
  }
  loading.style.display = "none";
  container.style.display = "block";
}


/* ─────────────────────── pinch to shorten the range ────────────────────────
 *
 * Home Assistant's own history chart can be pinched open to look at a shorter
 * stretch of time, and dragged along it. The popup here had four fixed buttons
 * and nothing else: on a phone the only way to read a five-minute spike inside
 * a 24-hour line was to reload the whole chart at one hour and hope the spike
 * was inside it.
 *
 * The chart's x axis is a category axis, so a window over it is a pair of
 * indices into the labels — no data is refetched and no request is made. Two
 * fingers change the width of that window around whatever is between them, one
 * finger slides it, a double tap puts it back, and the wheel does the same
 * thing for a mouse.
 */
const MIN_VISIBLE_POINTS = 4;

function labelCount() {
  return state.chart?.data?.labels?.length || 0;
}

function clampWindow(min, max) {
  const total = labelCount();
  if (!total) return null;
  let span = Math.max(MIN_VISIBLE_POINTS - 1, Math.min(total - 1, max - min));
  let start = Math.max(0, Math.min(total - 1 - span, min));
  return { min: Math.round(start), max: Math.round(start + span) };
}

function paintZoomBadge() {
  const container = doc?.getElementById("hist-canvas-container");
  if (!container) return;
  // Cercata anche fuori: una pastiglia lasciata li' da una versione precedente
  // va ritrovata e riusata, non moltiplicata a ogni ridisegno.
  let badge =
    container.querySelector?.(".dm-hist-zoom") ||
    container.parentElement?.querySelector?.(".dm-hist-zoom") ||
    null;
  const view = state.zoom;
  if (!view) {
    badge?.remove();
    return;
  }
  if (!badge) {
    badge = doc.createElement("div");
    badge.className = "dm-hist-zoom";
    badge.innerHTML =
      `<span data-dm-hist-range></span><button type="button" data-dm-hist-reset>↺ ${t("Tutto", "All")}</button>`;
    badge.querySelector("[data-dm-hist-reset]").addEventListener("click", (event) => {
      event.stopPropagation();
      resetZoom();
    });
    // Dentro al contenitore, non prima: appoggiata sopra il grafico non gli
    // toglie altezza. Messa prima, spingeva il grafico giu' di una riga e gli
    // orari sotto all'asse finivano fuori dal riquadro del popup — bastava
    // pizzicare per non vedere piu' l'ora di cio' che si stava guardando.
    container.style.position = container.style.position || "relative";
    container.appendChild(badge);
  }
  const labels = state.chart?.data?.labels || [];
  const range = badge.querySelector("[data-dm-hist-range]");
  const text = `${clean(labels[view.min])} – ${clean(labels[view.max])}`;
  if (range && range.textContent !== text) range.textContent = text;
}

function applyWindow(window) {
  const chart = state.chart;
  if (!chart?.options?.scales?.x) return;
  const view = window && clampWindow(window.min, window.max);
  const total = labelCount();
  // A window that covers everything is no window at all: drop it so the axis
  // goes back to its own bounds and the badge disappears with it.
  state.zoom = view && (view.min > 0 || view.max < total - 1) ? view : null;
  chart.options.scales.x.min = state.zoom ? state.zoom.min : undefined;
  chart.options.scales.x.max = state.zoom ? state.zoom.max : undefined;
  chart.update("none");
  paintZoomBadge();
}

export function resetZoom() {
  applyWindow(null);
}

function currentWindow() {
  return state.zoom || { min: 0, max: Math.max(0, labelCount() - 1) };
}

/** The data index under a client x coordinate, whatever the current window. */
function indexAt(clientX) {
  const chart = state.chart;
  const canvas = chart?.canvas;
  if (!canvas) return 0;
  const rect = canvas.getBoundingClientRect();
  const area = chart.chartArea;
  const view = currentWindow();
  const span = Math.max(1, view.max - view.min);
  const ratio = (clientX - rect.left - area.left) / Math.max(1, area.right - area.left);
  return view.min + Math.max(0, Math.min(1, ratio)) * span;
}

function pointerDistance(points) {
  const [a, b] = points;
  return Math.hypot(a.x - b.x, a.y - b.y) || 1;
}

function installGestures(canvas) {
  if (!canvas || canvas.dataset.dmHistoryZoom === "true") return;
  canvas.dataset.dmHistoryZoom = "true";
  const pointers = new Map();

  const begin = () => {
    const points = [...pointers.values()];
    const view = currentWindow();
    if (points.length >= 2) {
      const midpoint = (points[0].x + points[1].x) / 2;
      state.gesture = {
        kind: "pinch",
        distance: pointerDistance(points),
        anchor: indexAt(midpoint),
        view,
      };
      return;
    }
    state.gesture = { kind: "pan", x: points[0].x, view };
  };

  canvas.addEventListener("pointerdown", (event) => {
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    // Capture keeps a finger that slides off the canvas on the same gesture.
    // It throws for a pointer the browser no longer tracks, which must not
    // take the gesture down with it.
    try {
      canvas.setPointerCapture?.(event.pointerId);
    } catch (_error) {}
    begin();
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const gesture = state.gesture;
    if (!gesture) return;
    const points = [...pointers.values()];

    if (gesture.kind === "pinch" && points.length >= 2) {
      event.preventDefault();
      const scale = pointerDistance(points) / gesture.distance;
      const startSpan = Math.max(1, gesture.view.max - gesture.view.min);
      const span = Math.max(
        MIN_VISIBLE_POINTS - 1,
        Math.min(labelCount() - 1, startSpan / Math.max(0.05, scale)),
      );
      const fraction = (gesture.anchor - gesture.view.min) / startSpan;
      const min = gesture.anchor - fraction * span;
      applyWindow({ min, max: min + span });
      return;
    }

    // One finger only pans a window that is already shorter than the whole
    // range; otherwise the popup would swallow the page's own scrolling.
    if (gesture.kind === "pan" && state.zoom) {
      event.preventDefault();
      const area = state.chart?.chartArea;
      const width = Math.max(1, (area?.right || 1) - (area?.left || 0));
      const span = gesture.view.max - gesture.view.min;
      const shift = ((gesture.x - points[0].x) / width) * span;
      applyWindow({ min: gesture.view.min + shift, max: gesture.view.max + shift });
    }
  });

  const release = (event) => {
    pointers.delete(event.pointerId);
    state.gesture = null;
    // Lifting one of two fingers hands the gesture over to the one still down,
    // so the chart keeps following it instead of jumping.
    if (pointers.size) begin();
  };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);

  canvas.addEventListener("dblclick", (event) => {
    event.preventDefault();
    resetZoom();
  });

  canvas.addEventListener(
    "wheel",
    (event) => {
      if (!labelCount()) return;
      event.preventDefault();
      const view = currentWindow();
      const anchor = indexAt(event.clientX);
      const startSpan = Math.max(1, view.max - view.min);
      const span = Math.max(
        MIN_VISIBLE_POINTS - 1,
        Math.min(labelCount() - 1, startSpan * (event.deltaY > 0 ? 1.25 : 0.8)),
      );
      const fraction = (anchor - view.min) / startSpan;
      const min = anchor - fraction * span;
      applyWindow({ min, max: min + span });
    },
    { passive: false },
  );
}

function installZoomStyles() {
  installStyle(
    "dm-history-zoom-style",
    `
    #hist-canvas{touch-action:none!important}
    #hist-canvas-container{position:relative}
    .dm-hist-zoom{
      position:absolute;top:6px;left:6px;right:6px;z-index:3;
      display:flex;align-items:center;justify-content:space-between;gap:10px;
      margin:0;padding:6px 8px 6px 12px;border-radius:999px;
      box-shadow:0 6px 16px rgba(15,23,42,.14);
      border:1px solid var(--divider-color,#dbe4ee);background:var(--card-bg,#fff);
      font-size:11px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;
      color:var(--text-dim,#64748b)
    }
    .dm-hist-zoom button{
      border:0;border-radius:999px;padding:5px 12px;cursor:pointer;font:inherit;
      background:var(--accent,#0284c7);color:#fff
    }
  `,
  );
}

function destroyChart(canvas) {
  try {
    state.chart?.destroy?.();
  } catch (_error) {}
  state.chart = null;
  try {
    root.Chart?.getChart?.(canvas)?.destroy?.();
  } catch (_error) {}
}

function renderChart(entity, name, rows) {
  const canvas = doc?.getElementById("hist-canvas");
  if (!canvas || typeof root.Chart !== "function") throw new Error("Chart.js unavailable");
  const labels = [];
  const values = [];
  let categorical = false;
  rows.forEach((row) => {
    const normalized = historyValue(row.state);
    if (!normalized) return;
    const date = new Date(row.time);
    labels.push(
      date.toLocaleTimeString(locale(), {
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
    values.push(normalized.value);
    categorical ||= normalized.categorical;
  });
  if (!values.length) return false;

  destroyChart(canvas);
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 0, 320);
  gradient.addColorStop(0, "rgba(2,132,199,.6)");
  gradient.addColorStop(1, "rgba(2,132,199,0)");
  state.chart = new root.Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: name || entity,
          data: values,
          borderColor: "#0284c7",
          backgroundColor: gradient,
          borderWidth: 3,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 7,
          tension: categorical ? 0 : 0.35,
          stepped: categorical,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      scales: {
        x: { ticks: { maxTicksLimit: 8 }, grid: { color: "rgba(0,0,0,.04)" } },
        y: { grid: { color: "rgba(0,0,0,.04)" } },
      },
      plugins: { legend: { display: false } },
    },
  });
  // A fresh chart starts unzoomed: the window belonged to the previous entity
  // or to the previous time range, and both are gone.
  state.zoom = null;
  state.gesture = null;
  paintZoomBadge();
  installGestures(canvas);
  return true;
}

async function websocketHistory(entity, hours) {
  const broker = root.DashboardModernEnergyService?.broker;
  if (!broker?.request) throw new Error("Home Assistant WebSocket broker unavailable");
  const end = new Date();
  const start = new Date(end.getTime() - hours * 60 * 60 * 1000);
  return broker.request({
    type: "history/history_during_period",
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    entity_ids: [entity],
    include_start_time_state: true,
    significant_changes_only: false,
    minimal_response: true,
    no_attributes: true,
  });
}

export async function openHistory(event, entityId, name, hours = 24) {
  event?.stopPropagation?.();
  if (event && root.navigator?.vibrate) root.navigator.vibrate(15);

  const entity = resolvedEntity(entityId);
  const current = root.STATES?.[entity] || root._RAW_STATES?.[entity];
  if (!entity || current?.entity_id === "dm.unmapped") return false;

  state.currentEntity = entity;
  state.currentName = clean(name) || current?.attributes?.friendly_name || entity;
  const generation = ++state.generation;

  const modal = doc?.getElementById("history-modal");
  if (!modal) return false;
  modal.classList.add("show");
  modal.dataset.dmHistoryTransport = "websocket";
  modal.dataset.dmHistoryEntity = entity;
  delete modal.dataset.dmHistoryError;
  const title = doc.getElementById("hist-title");
  if (title) title.textContent = state.currentName;
  doc.querySelectorAll(".hist-time-btn").forEach((button) =>
    button.classList.toggle("active", Number(button.dataset.hours) === Number(hours)),
  );
  setLoading("loading");

  try {
    const result = await websocketHistory(entity, Number(hours) || 24);
    if (generation !== state.generation) return false;
    const rows = normalizeHistoryRows(result, entity);
    if (!rows.length) {
      modal.dataset.dmHistoryLoaded = "empty";
      setLoading("empty");
      return true;
    }
    if (!renderChart(entity, state.currentName, rows)) {
      modal.dataset.dmHistoryLoaded = "empty";
      setLoading("empty");
      return true;
    }
    setLoading("ready");
    modal.dataset.dmHistoryLoaded = "true";
    return true;
  } catch (error) {
    if (generation !== state.generation) return false;
    root.console?.warn?.("[DashboardModern] WebSocket history failed", error);
    modal.dataset.dmHistoryLoaded = "false";
    modal.dataset.dmHistoryError = clean(error?.message || error);
    setLoading("error");
    return false;
  }
}

export function changeHistoryRange(hours) {
  if (!state.currentEntity) return false;
  openHistory(null, state.currentEntity, state.currentName, hours);
  return true;
}

function appliances() {
  const values = section("appliances", []);
  return Array.isArray(values) ? values : [];
}

function interceptApplianceHistory(event) {
  const button = event.target?.closest?.(
    "#page-appliances-main .appl-wide-card button,#appl-grid-overview .appl-wide-card button",
  );
  if (!button || button.disabled) return;
  if (!/storico|history/i.test(clean(button.textContent || button.getAttribute("aria-label")))) return;

  const card = button.closest(".appl-wide-card[data-appliance-id]");
  const id = clean(card?.dataset.applianceId);
  if (!card || !id) return;
  const device = appliances().find((item) => clean(item.id) === id);
  if (!device) return;
  const states = { ...(root._RAW_STATES || {}), ...(root.STATES || {}) };
  const entity = applianceHistorySource(device, states);
  if (!entity) return;

  // Capture phase: stop the legacy inline onclick before it can reopen history
  // with total_energy_entity. The canonical popup owns short-term history.
  event.preventDefault();
  event.stopImmediatePropagation();
  openHistory(event, entity, device.name || id, 24);
}

function installOwner() {
  root.apriStorico = openHistory;
  root.cambiaTempoStorico = changeHistoryRange;
}

export function installHistorySection() {
  if (!doc) return;
  installOwner();
  installZoomStyles();
  if (state.installed) return;
  state.installed = true;
  doc.addEventListener("click", interceptApplianceHistory, true);
  root.addEventListener?.("dashboardmodern:legacy-ready", installOwner);
  root.addEventListener?.("pageshow", installOwner);
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installHistorySection, { once: true });
else installHistorySection();
