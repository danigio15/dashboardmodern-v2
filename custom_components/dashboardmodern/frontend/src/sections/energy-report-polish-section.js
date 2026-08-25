import { applianceArtwork } from "../core/appliance-artwork.js";
import { applianceArtworkType } from "../core/appliance-card-view-model.js";
import { clean, doc, formatNumber, installStyle, root, t, wrapFunction } from "./shared.js";

const KEY = "__DASHBOARDMODERN_ENERGY_REPORT_POLISH__";
const state = (root[KEY] ||= { installed: false, frame: 0, dailyChart: null, legacyDailyChart: null, subscribed: false });

function model() {
  try { return root.DashboardModernModules?.store?.getSection?.("energy") || {}; } catch (_error) { return {}; }
}

function appliances() {
  try {
    const store = root.DashboardModernModules?.store;
    // Le voci del Report arrivano da tre elenchi: gli elettrodomestici, i
    // carichi secondari e le voci aggiunte a mano. Cercandole solo nei primi
    // due, le ultime non venivano riconosciute e restavano con la faccina.
    return [
      ...(store?.getSection?.("appliances") || []),
      ...(store?.getSection?.("loads") || []),
      ...(store?.getSection?.("reportDevices") || []),
    ];
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
    if (typeof state.legacyDailyChart === "function") {
      try {
        destroyDailyChart(canvas);
        loading.style.display = "none";
        canvas.style.display = "block";
        await state.legacyDailyChart(daysInMonth, selMonth, selYear);
        canvas.dataset.dmHistoryFallback = "legacy-compatible";
        return true;
      } catch (fallbackError) {
        root.console?.warn?.("[DashboardModern] compatible daily chart fallback unavailable", fallbackError);
      }
    }
    chartMessage(t("Storico Home Assistant non raggiungibile per il periodo selezionato.", "Home Assistant history is unavailable for the selected period."));
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
    /* Lo stesso disegno che si vede in Elettrodomestici, per tutti.
     *
     * Il tipo si leggeva da quattro campi a caso e, se nessuno di quelli diceva
     * qualcosa di riconoscibile — un carico chiamato "Wallbox", una voce
     * aggiunta a mano — il disegno non usciva e la riga restava con la faccina:
     * nello stesso elenco convivevano due stili. Adesso il tipo lo decide la
     * stessa funzione della scheda, che quando non riconosce niente risponde
     * "generico" invece di non rispondere. Cosi' tutte le voci del catalogo
     * sono disegnate allo stesso modo, e le altre pure. */
    const artwork = applianceArtwork(applianceArtworkType(item), 56);
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

function rateValue(key) {
  const configured = root.cdCfg?.(key);
  const raw = configured !== undefined && configured !== null && configured !== ""
    ? configured
    : root.localStorage?.getItem(key);
  const value = Number(String(raw ?? "").replace(",", "."));
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function money(value) {
  return `${formatNumber(Math.max(0, Number(value) || 0), 2)} €`;
}

export function applyFinancialOverview(bundle) {
  if (!bundle?.month) return false;
  const importPrice = rateValue("cd_costo_kwh");
  const exportPrice = rateValue("cd_prezzo_immissione");
  const data = bundle.month;
  const importCost = Math.max(0, Number(data.gridImport) || 0) * importPrice;
  const withoutSolar = Math.max(0, Number(data.house) || 0) * importPrice;
  const exportIncome = Math.max(0, Number(data.gridExport) || 0) * exportPrice;
  // "Venduto" is already reported separately. Subtracting that income from
  // purchase cost made COSTO REALE collapse to zero whenever export revenue was
  // higher than the bill. Real cost is therefore strictly imported kWh × rate.
  const realCost = importCost;
  const saved = Math.max(0, withoutSolar - importCost);

  const set = (id, value) => {
    const node = doc?.getElementById(id);
    if (node) node.textContent = value;
  };
  set("ed-fin-pagato", money(withoutSolar));
  set("ed-fin-pagato-sub", `${formatNumber(data.house, 1)} kWh`);
  set("ed-fin-costo", money(realCost));
  set("ed-fin-costo-sub", `${formatNumber(data.gridImport, 1)} kWh ${t("dalla rete", "from grid")}`);
  set("ed-fin-risp", money(saved));
  set("ed-fin-imm", money(exportIncome));

  if (bundle.year) {
    const annualImport = Math.max(0, Number(bundle.year.gridImport) || 0) * importPrice;
    const annualWithoutSolar = Math.max(0, Number(bundle.year.house) || 0) * importPrice;
    set("ed-year-pagato", money(annualImport));
    set("ed-year-risparmio", money(Math.max(0, annualWithoutSolar - annualImport)));
  }
  const overview = doc?.getElementById("view-panoramica");
  if (overview) {
    overview.dataset.dmFinancialFormula = "gridImport*importPrice";
    overview.dataset.dmImportPrice = String(importPrice);
    overview.dataset.dmExportPrice = String(exportPrice);
  }
  return true;
}

function installCostSettingsOwner() {
  const current = root.edSaveCosti;
  if (typeof current === "function" && current.__dmCanonicalEnergyRates) return true;
  function saveCanonicalEnergyRates() {
    const importInput = doc?.getElementById("ed-costo-kwh");
    const exportInput = doc?.getElementById("ed-prezzo-imm");
    const normalize = (input) => {
      const parsed = Number(String(input?.value ?? "").replace(",", "."));
      return Number.isFinite(parsed) && parsed >= 0 ? String(parsed) : "0";
    };
    const importRate = normalize(importInput);
    const exportRate = normalize(exportInput);
    root.localStorage?.setItem("cd_costo_kwh", importRate);
    root.localStorage?.setItem("cd_prezzo_immissione", exportRate);
    root.cdMarkDirty?.();
    root.cdSyncPush?.();
    root.DashboardModernEnergyService?.refresh?.();
    const runtimeBundle = root.__DASHBOARDMODERN_RUNTIME_ROOT__?.bundle;
    if (runtimeBundle) root.setTimeout?.(() => applyFinancialOverview(runtimeBundle), 0);
    return true;
  }
  saveCanonicalEnergyRates.__dmCanonicalEnergyRates = true;
  saveCanonicalEnergyRates.__dmPrevious = current;
  root.edSaveCosti = saveCanonicalEnergyRates;
  return true;
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
    installCostSettingsOwner();
    const bundle = root.__DASHBOARDMODERN_RUNTIME_ROOT__?.bundle;
    if (bundle?.month) applyFinancialOverview(bundle);
  }) || root.setTimeout?.(() => {
    state.frame = 0;
    removeWeeklyDash();
    applyReportArtwork();
    installDailyChartOverride();
    installCostSettingsOwner();
    const bundle = root.__DASHBOARDMODERN_RUNTIME_ROOT__?.bundle;
    if (bundle?.month) applyFinancialOverview(bundle);
  }, 0);
}

function subscribeStore() {
  if (state.subscribed) return;
  const store = root.DashboardModernModules?.store;
  if (typeof store?.subscribe !== "function") return;
  state.subscribed = true;
  store.subscribe((change) => {
    if (["appliances", "loads", "energy", "report", "snapshot"].includes(change?.section)) schedule();
  });
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
  installCostSettingsOwner();
  root.addEventListener?.("dashboardmodern:legacy-ready", () => {
    installDailyChartOverride();
    installCostSettingsOwner();
    for (const name of ["renderEnergyDashboard", "renderEdDeviceList"]) wrapFunction(name, `__dmEnergyReport_${name}`, schedule);
    subscribeStore();
    schedule();
  });
  root.addEventListener?.("dashboardmodern:runtime-ready", () => { subscribeStore(); installCostSettingsOwner(); schedule(); });
  root.addEventListener?.("dashboardmodern:period-bundle", (event) => { applyAutonomy(event.detail); applyFinancialOverview(event.detail); schedule(); });
  root.addEventListener?.("dashboardmodern:energy-stable", (event) => { applyAutonomy(event.detail); applyFinancialOverview(event.detail); schedule(); });
  doc.addEventListener("click", (event) => {
    if (event.target?.closest?.("[data-energy-tab],.energy-tab,.sub-tab-btn,.ed-tab")) root.setTimeout?.(schedule, 0);
  }, true);
  schedule();
}

installEnergyReportPolishSection();