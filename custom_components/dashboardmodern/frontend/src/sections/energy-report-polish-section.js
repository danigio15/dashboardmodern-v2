import { applianceArtwork } from "../core/appliance-artwork.js";
import { clean, doc, formatNumber, installStyle, root, t, wrapFunction } from "./shared.js";

const KEY = "__DASHBOARDMODERN_ENERGY_REPORT_POLISH__";
const state = (root[KEY] ||= { installed: false, observer: null, frame: 0, dailyChart: null, legacyDailyChart: null });

function model() {
  try { return root.DashboardModernModules?.store?.getSection?.("energy") || {}; } catch (_error) { return {}; }
}

function appliances() {
  try {
    const store = root.DashboardModernModules?.store;
    return [...(store?.getSection?.("appliances") || []), ...(store?.getSection?.("loads") || [])];
  } catch (_error) { return []; }
}

function resolved(value) {
  const id = clean(value);
  if (!id) return "";
  try { return clean(root.resolveEntity?.(id) || id); } catch (_error) { return id; }
}

function historySource(group) {
  if (!group) return "";
  return resolved(group.total_energy || group.total_import_energy || group.total_export_energy || group.total_charged_energy || group.total_discharged_energy || group.monthly_energy || group.annual_energy || group.daily_energy);
}

function sourceFor(kind) {
  const energy = model();
  return historySource(kind === "solar" ? energy.solar : energy.house);
}

function bucketMap(rows = [], daysInMonth = 31) {
  const values = Array.from({ length: daysInMonth }, () => 0);
  for (const row of Array.isArray(rows) ? rows : []) {
    const date = new Date(row?.start || row?.end || 0);
    const day = date.getDate();
    const change = Number(row?.change);
    if (!Number.isFinite(change) || day < 1 || day > daysInMonth) continue;
    values[day - 1] += Math.max(0, change);
  }
  return values;
}

function realDataPresent(values) {
  return values.some((value) => Number.isFinite(value) && value > 0);
}

function chartMessage(message) {
  const loading = doc?.getElementById("ed-chart-loading");
  const canvas = doc?.getElementById("ed-daily-canvas");
  if (canvas) canvas.style.display = "none";
  if (loading) {
    loading.style.display = "flex";
    loading.innerHTML = `<span aria-hidden="true">ℹ️</span> ${message}`;
  }
}

function destroyDailyChart(canvas) {
  try { root.Chart?.getChart?.(canvas)?.destroy?.(); } catch (_error) {}
  try { state.dailyChart?.destroy?.(); } catch (_error) {}
  state.dailyChart = null;
}

export async function renderActualDailyChart(daysInMonth, selMonth, selYear) {
  const loading = doc?.getElementById("ed-chart-loading");
  const canvas = doc?.getElementById("ed-daily-canvas");
  if (!loading || !canvas) return false;
  destroyDailyChart(canvas);
  loading.style.display = "flex";
  loading.textContent = t("Carico lo storico reale di Home Assistant…", "Loading real Home Assistant history…");
  canvas.style.display = "none";

  const solar = sourceFor("solar");
  const house = sourceFor("house");
  const ids = [...new Set([solar, house].filter(Boolean))];
  if (!ids.length || !root.DashboardModernEnergyService?.statisticsWithGrowth) {
    chartMessage(t("Storico giornaliero non disponibile: configura i contatori energia totali.", "Daily history unavailable: configure cumulative energy meters."));
    return false;
  }

  const year = Number(selYear) || new Date().getFullYear();
  const month = Math.max(1, Math.min(12, Number(selMonth) || new Date().getMonth() + 1));
  const days = Number(daysInMonth) || new Date(year, month, 0).getDate();
  const start = new Date(year, month - 1, 1);
  const next = new Date(year, month, 1);
  const now = new Date();
  const end = next > now ? now : next;
  if (end <= start) {
    chartMessage(t("Il periodo selezionato non contiene ancora dati.", "The selected period does not contain data yet."));
    return false;
  }

  try {
    const result = await root.DashboardModernEnergyService.statisticsWithGrowth(ids, start.toISOString(), end.toISOString(), "day");
    const production = bucketMap(result?.[solar] || [], days);
    const consumption = bucketMap(result?.[house] || [], days);
    if (!realDataPresent(production) && !realDataPresent(consumption)) {
      chartMessage(t("Nessuna statistica giornaliera reale disponibile per il periodo selezionato.", "No real daily statistics are available for the selected period."));
      return false;
    }
    if (!root.Chart) {
      chartMessage(t("Grafico non disponibile: Chart.js non è caricato.", "Chart unavailable: Chart.js is not loaded."));
      return false;
    }

    const labels = Array.from({ length: days }, (_, index) => String(index + 1));
    loading.style.display = "none";
    canvas.style.display = "block";
    canvas.dataset.dmActualHistory = `${year}-${String(month).padStart(2, "0")}`;
    state.dailyChart = new root.Chart(canvas.getContext("2d"), {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: t("Produzione", "Production"), data: production, borderColor: "#16a34a", backgroundColor: "rgba(22,163,74,.15)", fill: true, tension: .3, pointRadius: 0, borderWidth: 2 },
          { label: t("Consumo", "Consumption"), data: consumption, borderColor: "#0ea5e9", backgroundColor: "rgba(14,165,233,.08)", fill: true, tension: .3, pointRadius: 0, borderWidth: 2 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { intersect: false, mode: "index" },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatNumber(ctx.parsed.y, 2)} kWh` } } },
        scales: { y: { beginAtZero: true, title: { display: true, text: "kWh" } }, x: { grid: { display: false } } },
      },
    });
    return true;
  } catch (error) {
    root.console?.warn?.("[DashboardModern] real daily chart unavailable", error);
    chartMessage(t("Storico Home Assistant non raggiungibile: nessun dato stimato viene mostrato.", "Home Assistant history is unavailable: no estimated data is shown."));
    return false;
  }
}

function installDailyChartOverride() {
  const current = root.renderEdDailyChart;
  if (typeof current !== "function" || current.__dmActualHistory) return false;
  state.legacyDailyChart = current;
  const override = async (daysInMonth, selMonth, selYear) => renderActualDailyChart(daysInMonth, selMonth, selYear);
  override.__dmActualHistory = true;
  root.renderEdDailyChart = override;
  return true;
}

function deviceForRow(row, devices) {
  const direct = clean(row.dataset.entity || row.dataset.sensor);
  const name = clean(row.querySelector(".ed-dev-name")?.childNodes?.[0]?.textContent || row.querySelector(".ed-dev-name")?.textContent).toLowerCase();
  return devices.find((item) => {
    const refs = [item.entity, item.history, item.report_entity, item.history_entity, item.total_energy_entity, item.monthly_energy_entity, ...(item.entities || [])].map(clean);
    return (direct && refs.includes(direct)) || (name && clean(item.name).toLowerCase() === name);
  }) || null;
}

export function applyReportArtwork() {
  const rows = doc?.querySelectorAll?.("#ed-device-list .ed-device-row") || [];
  if (!rows.length) return false;
  const devices = appliances();
  rows.forEach((row) => {
    const item = deviceForRow(row, devices);
    if (!item) return;
    const artwork = applianceArtwork(item.type || item.category || item.appliance_type || item.name, 56);
    const icon = row.querySelector(".ed-dev-icon");
    if (!artwork || !icon) return;
    if (icon.dataset.dmArtwork === clean(item.id || item.name)) return;
    icon.innerHTML = artwork;
    icon.dataset.dmArtwork = clean(item.id || item.name);
    icon.removeAttribute("style");
  });
  return true;
}

function applyAutonomy(bundle) {
  const house = Number(bundle?.month?.house);
  const grid = Number(bundle?.month?.gridImport);
  if (!Number.isFinite(house) || house <= 0 || !Number.isFinite(grid)) return;
  const value = Math.max(0, Math.min(100, Math.round(((house - grid) / house) * 100)));
  for (const id of ["ed-auto-big", "ed-auto-ring-val"]) {
    const node = doc?.getElementById(id);
    if (node) node.textContent = `${value}%`;
  }
  const kpi = doc?.getElementById("ed-kpi-auto");
  if (kpi) kpi.innerHTML = `${value} <small>%</small>`;
  const circle = doc?.getElementById("ed-auto-circle");
  if (circle) circle.setAttribute("stroke-dasharray", `${(201 * value) / 100} 201`);
  const card = doc?.querySelector?.(".ed-auto-card,.ed-self-card");
  if (card) card.dataset.dmAutonomyFormula = "(house-gridImport)/house";
}

function removeWeeklyDash() {
  const diff = doc?.getElementById("ed-w-diff");
  if (diff) {
    diff.hidden = true;
    diff.setAttribute("aria-hidden", "true");
  }
}

function schedule() {
  if (state.frame) return;
  state.frame = root.requestAnimationFrame?.(() => {
    state.frame = 0;
    removeWeeklyDash();
    applyReportArtwork();
    installDailyChartOverride();
  }) || root.setTimeout?.(() => {
    state.frame = 0;
    removeWeeklyDash();
    applyReportArtwork();
    installDailyChartOverride();
  }, 0);
}

function installStyles() {
  installStyle("dm-energy-report-polish-style", `
    #ed-w-diff{display:none!important}
    #ed-device-list .ed-dev-icon[data-dm-artwork]{display:grid!important;place-items:center!important;width:58px!important;height:58px!important;min-width:58px!important;padding:0!important;border-radius:17px!important;background:transparent!important;overflow:hidden!important}
    #ed-device-list .ed-dev-icon[data-dm-artwork] .dm-appliance-art,#ed-device-list .ed-dev-icon[data-dm-artwork] svg{display:block!important;width:56px!important;height:56px!important;max-width:56px!important;max-height:56px!important}
    #ed-daily-canvas[data-dm-actual-history]{min-height:250px!important}
  `);
}

export function installEnergyReportPolishSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  root.addEventListener?.("dashboardmodern:legacy-ready", () => {
    installDailyChartOverride();
    for (const name of ["renderEnergyDashboard", "renderEdDeviceList"]) wrapFunction(name, `__dmEnergyReport_${name}`, schedule);
    schedule();
  });
  root.addEventListener?.("dashboardmodern:period-bundle", (event) => { applyAutonomy(event.detail); schedule(); });
  root.addEventListener?.("dashboardmodern:energy-stable", (event) => { applyAutonomy(event.detail); schedule(); });
  if (doc.body) {
    state.observer = new MutationObserver(schedule);
    state.observer.observe(doc.body, { childList: true, subtree: true });
  } else doc.addEventListener("DOMContentLoaded", () => {
    state.observer = new MutationObserver(schedule);
    state.observer.observe(doc.body, { childList: true, subtree: true });
  }, { once: true });
  schedule();
}

installEnergyReportPolishSection();
