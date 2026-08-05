/* DashboardModern 0.15.4 — readiness and historical detail projection for the single Energy owner. */
import { applyAtomicEnergyBundle } from "../../legacy/runtime-consolidated.js";

const root = globalThis;
const doc = root.document;
const KEY = "__DASHBOARDMODERN_ENERGY_TOTAL_SOURCE__";
const state = (root[KEY] ||= {});
Object.assign(state, {
  installed: true,
  version: "0.15.4",
  attempts: 0,
  timer: 0,
  detailTimer: 0,
  done: false,
  readyGateInstalled: false,
  appliedGeneration: 0,
  error: "",
});

const clean = (value) => String(value ?? "").trim();
const finite = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const valueFrom = (values, entity) =>
  values instanceof Map ? finite(values.get(entity)) : finite(values?.[entity]);

function energyModel() {
  return root.DashboardModernModules?.store?.getSection?.("energy") || {};
}
function configuredSource() {
  const energy = energyModel();
  return clean(
    energy.house?.daily_energy ||
      energy.house?.monthly_energy ||
      energy.house?.annual_energy ||
      energy.house?.total_energy,
  );
}
function runtimeRoot() {
  const runtime = root.__DASHBOARDMODERN_RUNTIME_ROOT__ || null;
  if (runtime) root.__DASHBOARDMODERN_RUNTIME_0150__ = runtime;
  return runtime;
}

function installReadyGate() {
  const runtime = runtimeRoot();
  if (!runtime || runtime.__dmEnergyReadyGate0154 || !configuredSource()) return false;
  let ownerReady = Boolean(runtime.ready);
  try {
    Object.defineProperty(runtime, "ready", {
      configurable: true,
      enumerable: true,
      get() {
        return state.done === true && ownerReady === true;
      },
      set(value) {
        ownerReady = Boolean(value);
      },
    });
    Object.defineProperty(runtime, "__dmEnergyReadyGate0154", {
      configurable: true,
      value: true,
    });
    state.readyGateInstalled = true;
    return true;
  } catch (error) {
    state.error = clean(error?.message || error);
    return false;
  }
}

function setText(id, value) {
  const element = doc?.getElementById(id);
  if (element) element.textContent = value;
}
function rate(key) {
  const configured = root.cdCfg?.(key);
  const raw = configured !== undefined && configured !== null && configured !== ""
    ? configured
    : root.localStorage?.getItem(key);
  return finite(raw);
}
function splitFor(period, value) {
  const house = finite(period?.house);
  const grid = finite(period?.gridImport);
  const gridShare = house > 0 ? Math.max(0, Math.min(1, grid / house)) : 1;
  return { grid: value * gridShare, solar: value * (1 - gridShare) };
}

function applyDeviceDetail(bundle) {
  const selector = doc?.getElementById("ed-dev-selector");
  const entity = clean(selector?.value);
  if (!entity || !bundle?.deviceMonth || !bundle?.deviceYear) return false;
  const monthValue = valueFrom(bundle.deviceMonth.values, entity);
  const yearValue = valueFrom(bundle.deviceYear.values, entity);
  const selectedMonth = Number(bundle.period?.month) || new Date().getMonth() + 1;
  const selectedYear = Number(bundle.period?.year) || new Date().getFullYear();
  const days = new Date(selectedYear, selectedMonth, 0).getDate();
  const importPrice = finite(bundle.rates?.importPrice) || rate("cd_costo_kwh");
  const monthSplit = splitFor(bundle.month, monthValue);
  const yearSplit = splitFor(bundle.year, yearValue);

  setText("ed-dkpi-mese", `${monthValue.toFixed(1)} kWh`);
  setText("ed-dkpi-mese-eur", `€ ${(monthValue * importPrice).toFixed(2)}`);
  setText("ed-dkpi-media", `${(days ? monthValue / days : 0).toFixed(2)} kWh`);
  setText("ed-dkpi-media-sub", doc?.documentElement?.lang === "en" ? "Daily average" : "Media/giorno");
  setText("ed-dkpi-risp-eur", `+ ${(monthSplit.solar * importPrice).toFixed(2)} €`);
  setText("ed-dkpi-risp-kwh", `${monthSplit.solar.toFixed(1)} kWh da FV`);
  setText("ed-dkpi-costo-eur", `- ${(monthSplit.grid * importPrice).toFixed(2)} €`);
  setText("ed-dkpi-costo-kwh", `${monthSplit.grid.toFixed(1)} kWh dalla rete`);
  setText("ed-dkpi-year-lbl", String(selectedYear));
  setText("ed-dkpi-anno-risp-eur", `+ ${(yearSplit.solar * importPrice).toFixed(2)} €`);
  setText("ed-dkpi-anno-risp-kwh", `${yearSplit.solar.toFixed(1)} kWh da FV`);
  setText("ed-dkpi-anno-costo-eur", `- ${(yearSplit.grid * importPrice).toFixed(2)} €`);
  setText("ed-dkpi-anno-costo-kwh", `${yearSplit.grid.toFixed(1)} kWh dalla rete`);

  const message = doc?.getElementById("ed-dev-chart-msg");
  const canvas = doc?.getElementById("ed-dev-chart-canvas");
  if (message && monthValue > 0 && (!canvas || getComputedStyle(canvas).display === "none")) {
    message.style.display = "flex";
    message.textContent = doc?.documentElement?.lang === "en"
      ? `Selected month total: ${monthValue.toFixed(1)} kWh`
      : `Totale mese selezionato: ${monthValue.toFixed(1)} kWh`;
  }
  const panel = doc?.querySelector(".ed-device-detail,#ed-device-detail");
  if (panel) panel.dataset.dmCanonicalDevicePeriod = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}|${monthValue}`;
  return true;
}

function scheduleDeviceDetail(delay = 0) {
  root.clearTimeout?.(state.detailTimer);
  state.detailTimer = root.setTimeout?.(() => {
    state.detailTimer = 0;
    applyDeviceDetail(runtimeRoot()?.bundle);
  }, delay);
}

function complete(runtime) {
  const bundle = runtime?.bundle;
  if (!bundle?.day || !bundle?.month || !bundle?.year) return false;
  const generation = Number(bundle.generation) || Number(runtime.generation) || 0;
  if (generation && generation !== state.appliedGeneration) {
    applyAtomicEnergyBundle(bundle);
    state.appliedGeneration = generation;
  }
  applyDeviceDetail(bundle);
  state.done = true;
  runtime.ready = true;
  root.__DASHBOARDMODERN_RUNTIME_0150__ = runtime;
  if (doc?.documentElement) {
    doc.documentElement.dataset.dmEnergyTotalSource = configuredSource();
    doc.documentElement.dataset.dmRuntimeAlias = [
      bundle.day?.house,
      bundle.month?.house,
      bundle.year?.house,
    ].join("/");
  }
  return true;
}
function releaseWithoutEnergy(runtime) {
  state.done = true;
  if (runtime) runtime.ready = true;
  root.__DASHBOARDMODERN_RUNTIME_0150__ = runtime;
}
function tick() {
  state.timer = 0;
  if (state.done) return;
  state.attempts += 1;
  const runtime = runtimeRoot();
  installReadyGate();
  if (!configuredSource()) {
    releaseWithoutEnergy(runtime);
    return;
  }
  if (complete(runtime)) return;
  if (state.attempts >= 720) {
    state.error ||= "Canonical Energy bundle timeout";
    releaseWithoutEnergy(runtime);
    return;
  }
  state.timer = root.setTimeout?.(tick, 25);
}
function schedule() {
  if (!state.done && !state.timer) state.timer = root.setTimeout?.(tick, 0);
  scheduleDeviceDetail(0);
}

function wrapLegacyDetail() {
  const current = root.edCaricaDettaglio;
  if (typeof current !== "function" || current.__dmCanonicalDevice0154) return;
  function canonicalDeviceDetail(...args) {
    const result = current.apply(this, args);
    const finish = () => scheduleDeviceDetail(0);
    if (result && typeof result.finally === "function") return result.finally(finish);
    finish();
    return result;
  }
  canonicalDeviceDetail.__dmCanonicalDevice0154 = true;
  canonicalDeviceDetail.__dmPrevious = current;
  root.edCaricaDettaglio = canonicalDeviceDetail;
}

installReadyGate();
root.addEventListener?.("dashboardmodern:legacy-ready", () => {
  wrapLegacyDetail();
  schedule();
});
root.addEventListener?.("dashboardmodern:runtime-ready", schedule);
root.addEventListener?.("dashboardmodern:period-bundle", (event) => {
  const runtime = runtimeRoot();
  if (runtime && event?.detail) runtime.bundle = event.detail;
  applyDeviceDetail(event?.detail);
  schedule();
});
root.addEventListener?.("pageshow", schedule);
doc?.addEventListener("change", (event) => {
  if (event.target?.matches?.("#ed-dev-selector,#ed-month,#ed-year")) scheduleDeviceDetail(80);
});
root.queueMicrotask?.(() => {
  wrapLegacyDetail();
  schedule();
});
