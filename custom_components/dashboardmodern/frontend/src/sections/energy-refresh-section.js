import { doc, root } from "./shared.js";

const KEY = "__DASHBOARDMODERN_ENERGY_REFRESH_SECTION__";
const LIVE_WINDOW_MS = 10 * 60 * 1000;
const state = (root[KEY] ||= {
  installed: false,
  refreshQueued: false,
  liveStatisticsInstalled: false,
});

export function initializeEnergyPeriodControls(now = new Date(), documentRef = doc) {
  const month = documentRef?.getElementById("ed-sel-month");
  const year = documentRef?.getElementById("ed-sel-year");
  if (!month || !year) return false;

  // The legacy HTML starts with January selected and only changes it later in
  // renderEnergyDashboard(). The canonical runtime can schedule its first
  // Recorder request before that legacy initialization, leaving January data
  // behind an August label until the user manually changes month.
  if (!month.dataset.init) {
    month.value = String(now.getMonth() + 1);
    year.value = String(now.getFullYear());
    month.dataset.init = "1";
    year.dataset.dmPeriodInit = "current";
  }
  return true;
}

export function liveStatisticsPeriod(period, end, now = Date.now()) {
  if (period !== "hour") return period;
  const endMs = new Date(end).getTime();
  if (!Number.isFinite(endMs) || Math.abs(now - endMs) > LIVE_WINDOW_MS) return period;
  // Current-day totals previously used hourly Recorder buckets. During the open
  // hour that can leave Solar/Grid/Battery almost one hour behind the live
  // inverter. Short-term 5-minute statistics keep the same reset-aware `sum`
  // contract while reducing that live gap to one short-statistics interval.
  return "5minute";
}

export function installLiveStatisticsGranularity(service = root.DashboardModernEnergyService) {
  const broker = service?.broker;
  if (!broker?.statistics || broker.__dmLiveStatisticsGranularity) return false;
  const original = broker.statistics.bind(broker);
  broker.statistics = (ids, start, end, period = "day") =>
    original(ids, start, end, liveStatisticsPeriod(period, end));
  Object.defineProperty(broker, "__dmLiveStatisticsGranularity", {
    value: true,
    configurable: true,
  });
  state.liveStatisticsInstalled = true;
  return true;
}

function energyVisible() {
  return Boolean(
    doc?.querySelector("#page-energy.active,#page-energy-main.active") ||
      doc?.querySelector(".tab[data-tab='energy'].active"),
  );
}

function queueRefresh({ force = true } = {}) {
  initializeEnergyPeriodControls();
  installLiveStatisticsGranularity();
  if (state.refreshQueued) return;
  state.refreshQueued = true;
  root.queueMicrotask?.(() => {
    state.refreshQueued = false;
    const service = root.DashboardModernEnergyService;
    if (!service?.refresh) return;
    if (force || energyVisible()) service.refresh();
  });
}

export function installEnergyRefreshSection() {
  if (!doc || state.installed) return;
  state.installed = true;

  // Synchronous on purpose: this runs in the same module turn as Energy and
  // therefore beats the setTimeout(0) used by its first scheduled refresh.
  initializeEnergyPeriodControls();
  installLiveStatisticsGranularity();

  root.addEventListener?.("dashboardmodern:states-ready", () => queueRefresh({ force: true }));
  root.addEventListener?.("dashboardmodern:legacy-ready", () => queueRefresh({ force: true }));
  root.addEventListener?.("pageshow", () => queueRefresh({ force: true }));

  doc.addEventListener(
    "click",
    (event) => {
      const target = event.target?.closest?.(
        "[data-tab='energy'],.sub-tab-btn,[data-energy-tab],#view-panoramica,#view-month",
      );
      if (!target) return;
      // Let the legacy click handler finish selecting the view first.
      root.setTimeout?.(() => queueRefresh({ force: true }), 0);
    },
    true,
  );

  doc.addEventListener("change", (event) => {
    if (!event.target?.matches?.("#ed-sel-month,#ed-sel-year")) return;
    const month = doc.getElementById("ed-sel-month");
    const year = doc.getElementById("ed-sel-year");
    if (month) month.dataset.init = "1";
    if (year) year.dataset.dmPeriodInit = "user";
  });
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installEnergyRefreshSection, { once: true });
else installEnergyRefreshSection();
