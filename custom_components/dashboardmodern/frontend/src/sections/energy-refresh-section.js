import { clean, doc, root } from "./shared.js";

const KEY = "__DASHBOARDMODERN_ENERGY_REFRESH_SECTION__";
const state = (root[KEY] ||= { installed: false, refreshQueued: false });

export function initializeEnergyPeriodControls(now = new Date()) {
  const month = doc?.getElementById("ed-sel-month");
  const year = doc?.getElementById("ed-sel-year");
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

function energyVisible() {
  return Boolean(
    doc?.querySelector("#page-energy.active,#page-energy-main.active") ||
      doc?.querySelector(".tab[data-tab='energy'].active"),
  );
}

function queueRefresh({ force = true } = {}) {
  initializeEnergyPeriodControls();
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
