import { clean, doc, root, section, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_HISTORY_SECTION__";
const state = (root[KEY] ||= {
  installed: false,
  currentEntity: "",
  currentName: "",
  chart: null,
  generation: 0,
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
      date.toLocaleTimeString(document.documentElement?.lang?.startsWith("en") ? "en-US" : "it-IT", {
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
  if (state.installed) return;
  state.installed = true;
  doc.addEventListener("click", interceptApplianceHistory, true);
  root.addEventListener?.("dashboardmodern:legacy-ready", installOwner);
  root.addEventListener?.("pageshow", installOwner);
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installHistorySection, { once: true });
else installHistorySection();
