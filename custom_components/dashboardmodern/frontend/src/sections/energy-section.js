import {
  HomeAssistantBroker,
  PERIOD_SOURCES,
  periodConsumption,
  recorderBucketConsumptions,
  sourcePlans,
  isCumulativeEnergyEntity,
} from "../core/period-service.js";
import { reconcileEnergyBundle } from "./energy-calculations-section.js";
import {
  DEFAULT_EXPORT_RATE,
  DEFAULT_IMPORT_RATE,
  importRateEntity,
  resolveRate,
} from "../core/energy-calculations.js";
import {
  allStates,
  clean,
  dashboardStore,
  doc,
  english,
  esc,
  finite,
  formatNumber,
  installStyle,
  onEditorRedraw,
  readJson,
  root,
  scriviSeCambia,
  scriviTestoSeCambia,
  section,
  selectedPeriod,
  t,
  wrapFunction,
} from "./shared.js";
import {
  isHostedDashboard,
  sanitizeHostedCredentials,
  waitForHostedBridge,
} from "../transport/hosted-bridge-guard.js";
import {
  IMPIANTO_SCELTO_KEY,
  PLANT_GROUPS,
  pickPlant,
  plantList,
  plantModel,
} from "../core/energy-plants.js";
import { persistEnergyField as writeEnergyField } from "../core/energy-writer.js";
import { runtimeMetrics } from "../core/runtime-metrics.js";
import { BUILD_INFO } from "../../legacy/build-info.js";

root.__DM_20260815C__ = true;
const KEY = "__DASHBOARDMODERN_RUNTIME_ROOT__";
const VERSION = BUILD_INFO.dashboardVersion || BUILD_INFO.integrationVersion || "UNBUILT";
const state = (root[KEY] ||= {});
Object.assign(state, {
  installed: true,
  version: VERSION,
  ready: Boolean(state.ready),
  generation: Number(state.generation) || 0,
  bundle: state.bundle || null,
  selected: state.selected || null,
  lastRefreshAt: Number(state.lastRefreshAt) || 0,
  refreshTimer: state.refreshTimer || 0,
  retryCount: Number(state.retryCount) || 0,
  projectionFrame: state.projectionFrame || 0,
  applying: false,
  brokerStarted: Boolean(state.brokerStarted),
  observer: state.observer || null,
  listeners: Boolean(state.listeners),
  wrappers: state.wrappers || new Set(),
  storeUnsubscribe: state.storeUnsubscribe || null,
  lastError: "",
});
root.__DASHBOARDMODERN_RUNTIME_0150__ = state;

const PLACEHOLDER = "__dashboardmodern_hosted__";

class SafeHomeAssistantBroker extends HomeAssistantBroker {
  token() {
    const token = clean(super.token());
    return token === PLACEHOLDER ? "" : token;
  }

  async connect() {
    if (isHostedDashboard()) {
      sanitizeHostedCredentials();
      await waitForHostedBridge({ timeout: 5000, interval: 25 });
    }
    return super.connect();
  }

  handleMessage(event, resolveConnection, rejectConnection) {
    let message = null;
    try {
      message = JSON.parse(event?.data || event);
    } catch (_error) {}
    if (message?.type === "auth_required" && isHostedDashboard()) {
      const error = new Error("Hosted DashboardModern transport requested native authentication");
      try {
        this.socket?.close?.();
      } catch (_error) {}
      rejectConnection(error);
      return;
    }
    return super.handleMessage(event, resolveConnection, rejectConnection);
  }
}

const broker = new SafeHomeAssistantBroker({
  timeout: 12000,
  cacheCurrentMs: 10000,
  cacheHistoricalMs: 600000,
});
root.DashboardModernEnergyService = Object.freeze({
  statistics: (ids, start, end, period) => broker.statistics(ids, start, end, period),
  async statisticsWithGrowth(ids, start, end, period = "day") {
    const boundary = new Date(start);
    const baselineStart = new Date(boundary);
    if (period === "hour") baselineStart.setHours(baselineStart.getHours() - 2);
    else if (period === "month") baselineStart.setMonth(baselineStart.getMonth() - 1);
    else baselineStart.setDate(baselineStart.getDate() - 2);
    const result = await broker.statistics(ids, baselineStart, end, period);
    return Object.fromEntries(
      ids.map((id) => {
        const ordered = (result[id] || [])
          .slice()
          .sort((a, b) => new Date(a.start) - new Date(b.start));
        const before = ordered.filter((row) => new Date(row.start) < boundary);
        const within = ordered.filter(
          (row) => new Date(row.start) >= boundary && new Date(row.start) < new Date(end),
        );
        return [id, recorderBucketConsumptions(within, before.at(-1) || null)];
      }),
    );
  },
  consumption: periodConsumption,
  buckets: recorderBucketConsumptions,
  broker,
  refresh: () => scheduleEnergyRefresh(true),
});

const ENERGY_KEYS = PERIOD_SOURCES.map((item) => item.key);
const FLOW_IDS = Object.freeze([
  "v-solar-day",
  "v-home-day",
  "v-grid-day",
  "v-battery-day",
  "v-solar-month",
  "v-home-month",
  "v-grid-month",
  "v-battery-month",
  "ed-kpi-prod",
  "ed-kpi-cons",
]);
const ENTITY_ID = /^[a-z_][a-z0-9_]*\.[a-z0-9_]+$/i;

/* Dove si tiene l'impianto che si sta guardando: la casella la nomina il core,
 * qui si ri-espone per chi la conosceva da questo indirizzo. */
export { IMPIANTO_SCELTO_KEY };

/* La casa che si sta guardando.
 *
 * «Io ho una casa che e' l'unione di due appartamenti, quindi ho 2 misuratori
 * di consumo»: da qui in giu' tutta la sezione legge i quattro gruppi di UN
 * impianto, non del documento intero. Con un impianto solo — che e' il caso di
 * chiunque non abbia chiesto il contrario — l'impianto e' il primo, i suoi
 * gruppi sono quelli scritti al primo livello, e da qui esce esattamente
 * l'oggetto che usciva prima. */
/** L'impianto aperto adesso, se ce n'e' piu' d'uno. */
export const impiantoScelto = () => clean(root.localStorage?.getItem(IMPIANTO_SCELTO_KEY));

function energyModel() {
  return plantModel(section("energy", {}), impiantoScelto());
}

/* La configurazione com'e' stata scritta, per la maschera che la mostra.
 *
 * Il modello che leggono le pagine esce filtrato: con un contatore totale
 * valido i campi di periodo ne restano fuori, perche' i periodi si ricavano dal
 * totale. La maschera di configurazione pero' deve mostrare cio' che c'e'
 * scritto: leggendo il modello filtrato mostrerebbe quei campi vuoti, e il
 * primo salvataggio riscriverebbe quel vuoto sopra le entita' che la persona
 * aveva messo — cancellandole per sempre. */
function configuredEnergyModel() {
  const store = dashboardStore();
  const value = store?.getSection?.("energy");
  const grezzo = value && typeof value === "object" && !Array.isArray(value) ? value : null;
  if (!grezzo) return energyModel();
  /* E la maschera mostra l'impianto che si sta configurando, non sempre il
   * primo: con due misuratori sotto lo stesso tetto, aprire la scheda del
   * secondo e vedere le entita' del primo vorrebbe dire riscriverle addosso al
   * primo salvataggio. */
  const impianto = pickPlant(plantList(grezzo), impiantoScelto());
  if (!impianto) return grezzo;
  return {
    ...grezzo,
    ...Object.fromEntries(PLANT_GROUPS.map((gruppo) => [gruppo, impianto[gruppo]])),
  };
}

function entityOverrides() {
  const current = section("entityOverrides", null);
  return current && typeof current === "object"
    ? current
    : readJson("cd_entity_overrides", root.ENTITY_OVERRIDES || {});
}

function hasConfiguredEnergy() {
  const energy = energyModel();
  return PERIOD_SOURCES.some((definition) => {
    const group = energy?.[definition.group] || {};
    return Boolean(
      clean(group[definition.totalKey]) ||
      Object.values(definition.periodKeys).some((key) => clean(group[key])),
    );
  });
}

function collectEntityIds(value, output, depth = 0) {
  if (depth > 10 || value == null) return;
  if (typeof value === "string") {
    const id = clean(value);
    if (ENTITY_ID.test(id)) output.add(id);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectEntityIds(entry, output, depth + 1));
    return;
  }
  if (typeof value === "object")
    Object.values(value).forEach((entry) => collectEntityIds(entry, output, depth + 1));
}

function eventEntityIds(event) {
  const values = event?.detail?.entity_ids || [event?.detail?.entity_id];
  return new Set((Array.isArray(values) ? values : [values]).map(clean).filter(Boolean));
}

function energyRefreshEntityIds() {
  const ids = new Set();
  collectEntityIds(energyModel(), ids);
  canonicalDevices().forEach((device) => {
    for (const value of [device.entity, device.history, device.total_energy_entity]) {
      const id = clean(value);
      if (ENTITY_ID.test(id)) ids.add(id);
    }
  });
  return ids;
}

export function stateChangeAffectsEnergy(event) {
  const changed = eventEntityIds(event);
  if (!changed.size) return false;
  const configured = energyRefreshEntityIds();
  return [...changed].some((id) => configured.has(id));
}

function selectedDate(period = selectedPeriod()) {
  return new Date(period.year, period.month - 1, 1);
}

function emptyPeriod() {
  return Object.freeze(Object.fromEntries(ENERGY_KEYS.map((key) => [key, 0])));
}

function buildPeriodRecord(plans, values) {
  const byKey = new Map(plans.map((plan) => [plan.key, plan]));
  const missing = plans.filter((plan) => !values.has(plan.key));
  const data = {};
  ENERGY_KEYS.forEach((key) => {
    data[key] = byKey.has(key) ? finite(values.get(key)) : 0;
  });
  return {
    data: Object.freeze(data),
    plans,
    values,
    complete: missing.length === 0,
    missing,
  };
}

async function loadEnergyPeriod(kind, date) {
  const plans = sourcePlans(
    energyModel(),
    kind,
    allStates(),
    entityOverrides(),
    root.resolveEntity || ((value) => value),
  );
  if (!plans.length) {
    return { data: emptyPeriod(), plans, values: new Map(), complete: true, missing: [] };
  }
  const values = await broker.valuesForPlans(plans, date, allStates());
  return buildPeriodRecord(plans, values);
}

function canonicalDevices() {
  const build = root.DashboardModernModules?.data?.canonicalReportDevices;
  if (typeof build === "function") {
    return build(section("appliances", []), section("loads", []), allStates());
  }
  return [...section("appliances", []), ...section("loads", [])]
    .filter((item) => item?.show_in_report !== false)
    .map((item) => ({
      ...item,
      entity:
        clean(item.total_energy_entity) ||
        clean(item.report_entity) ||
        clean(item.history_entity) ||
        clean(item.energy_entity) ||
        clean(item.monthly_energy_entity),
    }))
    .filter((item) => item.entity);
}

async function loadEnergyLoadsDay(date) {
  const loads = section("energyLoads", []);
  const plans = loads.flatMap((load) => {
    const entity = clean(load.energy_entity);
    return entity ? [{ key: load.id, entity, source: entity, kind: "day", direct: false }] : [];
  });
  if (!plans.length) return new Map();
  return broker.valuesForPlans(plans, date, allStates());
}

function pianiPerIDispositivi(elenco, kind, prefisso = "report-device") {
  return elenco.flatMap((item, index) => {
    const history = clean(item.history);
    const entity = clean(item.entity);
    const key = clean(item.key) ? `${prefisso}:${clean(item.key)}` : `${prefisso}-${index}`;
    if (history && item.cumulative !== false) {
      return [{ key, entity: history, source: history, kind, direct: false }];
    }
    // A period helper (for example sensor.energy_mese_microonde) is useful only
    // for the current month. HomeAssistantBroker.valuesForPlans intentionally
    // refuses direct values for past months, and annual history requires a real
    // cumulative meter instead of reusing a monthly measurement.
    if (kind === "month" && entity) {
      return [{ key, entity, source: entity, kind, direct: true }];
    }
    return [];
  });
}

/* Gli apparecchi che il Report non mostra, ma un cerchio del flusso puo'
 * contenere (segnalato in revisione).
 *
 * `show_in_report: false` dice «non voglio vederlo nel Report», e per il
 * Report va benissimo. Ma un apparecchio nascosto li' puo' stare lo stesso
 * dentro un cerchio di gruppo del flusso, e se il suo unico strumento e' un
 * contatore di vita il periodo glielo puo' dare solo il Recorder: senza questi
 * piani, quell'apparecchio al suo cerchio non porta niente.
 *
 * Il Report resta esattamente com'era. Quello che si allarga sono i **valori**,
 * che il paniere indicizza per entita'; l'elenco `devices` — quello che il
 * Report disegna — non li vede passare. Erano due domande diverse infilate in
 * una risposta sola, e tenerle separate costa una passata in piu' del Recorder
 * soltanto a chi ha davvero apparecchi nascosti.
 *
 * Si passa dalla stessa `canonicalReportDevices`, con il permesso forzato: la
 * risoluzione dell'entita' e del contatore di vita e' delicata, e riscriverla
 * qui accanto vorrebbe dire due regole che un giorno divergono. */
function dispositiviFuoriDalReport(devices) {
  const build = root.DashboardModernModules?.data?.canonicalReportDevices;
  if (typeof build !== "function") return [];
  const nascosti = section("appliances", []).filter((item) => item?.show_in_report === false);
  if (!nascosti.length) return [];
  const gia = new Set(devices.map((item) => clean(item.entity)).filter(Boolean));
  return build(
    nascosti.map((item) => ({ ...item, show_in_report: true })),
    [],
    allStates(),
  ).filter((item) => clean(item.entity) && !gia.has(clean(item.entity)));
}

async function loadDevicePeriod(kind, date) {
  const devices = canonicalDevices();
  const plans = [
    ...pianiPerIDispositivi(devices, kind),
    ...pianiPerIDispositivi(dispositiviFuoriDalReport(devices), kind, "flow-hidden"),
  ];
  if (!plans.length) return { devices, values: new Map() };
  const byKey = await broker.valuesForPlans(plans, date, allStates());
  const values = new Map();
  plans.forEach((plan) => {
    const value = byKey.get(plan.key);
    if (!Number.isFinite(value)) return;
    values.set(plan.entity, value);
    values.set(plan.source, value);
  });
  return { devices, values };
}

function rates() {
  const read = (key) => {
    const configured = root.cdCfg?.(key);
    if (configured !== undefined && configured !== null && configured !== "") return configured;
    return root.localStorage?.getItem(key);
  };
  /* I default del guscio vivono in `resolveRate`, e solo la': il modulo
   * partiva da zero, il guscio dai suoi numeri, e nel Report gli euro si
   * alternavano tra calcolati e «0,00». Chi salva un costo suo lo vince
   * comunque; lo zero esplicito il salvataggio non lo scrive. Il prezzo di
   * acquisto puo' anche essere un'entita' scelta nel modello canonico: in
   * quel caso si legge il suo stato, che si aggiorna da solo. */
  const states = allStates();
  const entita = importRateEntity(section("energy", {}));
  let sorgente = read("cd_costo_kwh");
  if (entita) {
    try {
      sorgente = clean(root.resolveEntity?.(entita) || entita);
    } catch (_error) {
      sorgente = entita;
    }
  }
  return {
    importPrice: resolveRate(sorgente, states, DEFAULT_IMPORT_RATE),
    exportPrice: resolveRate(read("cd_prezzo_immissione"), states, DEFAULT_EXPORT_RATE),
  };
}

function incompleteMessage(results) {
  return results
    .flatMap(([kind, result]) =>
      result.missing.map((plan) => `${kind}:${plan.group}.${plan.key}:${plan.entity}`),
    )
    .join(", ");
}

export async function loadAtomicEnergyBundle(period = selectedPeriod()) {
  runtimeMetrics.increment("energyRefreshes");
  const generation = ++state.generation;
  const monthDate = selectedDate(period);
  const today = new Date();
  const [dayResult, monthResult, yearResult, deviceDay, deviceMonth, deviceYear, energyLoadsDay] =
    await Promise.all([
      loadEnergyPeriod("day", today),
      loadEnergyPeriod("month", monthDate),
      loadEnergyPeriod("year", monthDate),
      // Today's per-device delta, so a device metered only by its lifetime
      // counter has a daily figure too instead of only a monthly one.
      loadDevicePeriod("day", today),
      loadDevicePeriod("month", monthDate),
      loadDevicePeriod("year", monthDate),
      loadEnergyLoadsDay(today),
    ]);
  if (generation !== state.generation) return null;

  const results = [
    ["day", dayResult],
    ["month", monthResult],
    ["year", yearResult],
  ];
  if (results.some(([, result]) => !result.complete)) {
    throw new Error(`Incomplete Home Assistant statistics: ${incompleteMessage(results)}`);
  }

  return reconcileEnergyBundle(
    Object.freeze({
      generation,
      period: Object.freeze({ ...period }),
      day: dayResult.data,
      month: monthResult.data,
      year: yearResult.data,
      sources: Object.freeze({ day: dayResult, month: monthResult, year: yearResult }),
      deviceDay,
      deviceMonth,
      deviceYear,
      energyLoadsDay,
      rates: Object.freeze(rates()),
    }),
  );
}

function writeDerived(plan, value, kind, date) {
  if (!Number.isFinite(value) || !plan?.slot) return;
  const rounded = Math.round(Math.max(0, value) * 1000) / 1000;
  root.CD_PERIOD ||= {};
  root.CD_PERIOD[plan.slot] = rounded;
  broker.ingestState({
    entity_id: plan.slot,
    state: String(rounded),
    attributes: {
      unit_of_measurement: "kWh",
      device_class: "energy",
      state_class: "measurement",
      dashboardmodern_derived: true,
      dashboardmodern_period: kind,
      dashboardmodern_source: plan.entity,
      dashboardmodern_version: VERSION,
    },
    last_changed: date.toISOString(),
    last_updated: new Date().toISOString(),
  });
}

function commitDerived(bundle) {
  const dates = {
    day: new Date(),
    month: selectedDate(bundle.period),
    year: new Date(bundle.period.year, 0, 1),
  };
  for (const kind of ["day", "month", "year"]) {
    const result = bundle.sources[kind];
    result.plans.forEach((plan) =>
      writeDerived(plan, result.values.get(plan.key), kind, dates[kind]),
    );
  }
}

function setText(id, value) {
  return scriviTestoSeCambia(doc?.getElementById(id), value);
}

function setHtml(id, value) {
  return scriviSeCambia(doc?.getElementById(id), value);
}

function kwh(value, digits = 1) {
  return `${formatNumber(value, digits)} kWh`;
}

function dual(imported, exported, battery = false) {
  const down = battery ? "var(--success-color,#10b981)" : "var(--error-color,#e11d48)";
  const up = battery ? "var(--error-color,#e11d48)" : "var(--success-color,#10b981)";
  return `<span style="color:${down}">↓ ${formatNumber(imported, 1)} kWh</span><br><span style="color:${up}">↑ ${formatNumber(exported, 1)} kWh</span>`;
}

function applyFlow(kind, data) {
  const suffix = kind === "day" ? "day" : "month";
  setText(`v-solar-${suffix}`, kwh(data.solar));
  setText(`v-home-${suffix}`, kwh(data.house));
  setHtml(`v-grid-${suffix}`, dual(data.gridImport, data.gridExport));
  setHtml(`v-battery-${suffix}`, dual(data.batteryCharged, data.batteryDischarged, true));
  for (const key of ["solar", "home", "grid", "battery"]) {
    const node = doc?.getElementById(`n-${key}-${suffix}`);
    if (node) node.dataset.dmPeriodOwner = VERSION;
  }
}

function autonomy(data) {
  if (data.house <= 0) return 0;
  return Math.max(
    0,
    Math.min(100, Math.round(((data.house - data.gridImport) / data.house) * 100)),
  );
}

function financial(data, bundle) {
  const importCost = data.gridImport * bundle.rates.importPrice;
  const exportIncome = data.gridExport * bundle.rates.exportPrice;
  const withoutSolar = data.house * bundle.rates.importPrice;
  const realCost = importCost;
  return {
    importCost,
    exportIncome,
    withoutSolar,
    realCost,
    saved: Math.max(0, withoutSolar - importCost),
  };
}

function applyReportOverview(bundle) {
  const data = bundle.month;
  const auto = autonomy(data);
  setHtml("ed-kpi-prod", `${formatNumber(data.solar)} <small>kWh</small>`);
  setHtml("ed-kpi-cons", `${formatNumber(data.house)} <small>kWh</small>`);
  setHtml("ed-kpi-auto", `${auto} <small>%</small>`);
  const chips = doc?.getElementById("ed-yoy-chips");
  if (chips) {
    const value = [
      `<span class="ed-yoy-chip">☀️ ${kwh(data.solar)}</span>`,
      `<span class="ed-yoy-chip">🏠 ${kwh(data.house)}</span>`,
      `<span class="ed-yoy-chip">⚡ ${kwh(data.gridImport)} ${t("da Rete", "from Grid")}</span>`,
    ].join("");
    scriviSeCambia(chips, value);
  }
  const money = financial(data, bundle);
  setText("ed-fin-pagato", `${formatNumber(money.withoutSolar, 2)} €`);
  setText("ed-fin-pagato-sub", kwh(data.house));
  setText("ed-fin-costo", `${formatNumber(money.realCost, 2)} €`);
  setText("ed-fin-costo-sub", `${kwh(data.gridImport)} ${t("dalla rete", "from grid")}`);
  setText("ed-fin-risp", `${formatNumber(money.saved, 2)} €`);
  setText("ed-fin-imm", `${formatNumber(money.exportIncome, 2)} €`);
  setText("ed-auto-big", `${auto}%`);
  setText("ed-auto-ring-val", `${auto}%`);
  /* L'anello e' lo stesso numero disegnato: se lo riempie il guscio col SUO
   * calcolo, la geometria dice 81 mentre il testo dice 84. Lo scrive chi
   * scrive il testo, col cartello che ferma la mano del guscio. */
  const cerchio = doc?.getElementById("ed-auto-circle");
  if (cerchio) {
    if (cerchio.dataset && cerchio.dataset.dmPadrone !== "moduli")
      cerchio.dataset.dmPadrone = "moduli";
    const giro = 2 * Math.PI * 32;
    cerchio.setAttribute(
      "stroke-dasharray",
      `${((auto / 100) * giro).toFixed(1)} ${giro.toFixed(1)}`,
    );
  }
  const circle = doc?.getElementById("ed-auto-circle");
  if (circle) circle.setAttribute("stroke-dasharray", `${(201 * auto) / 100} 201`);
}

function applyAnnual(bundle) {
  const data = bundle.year;
  const money = financial(data, bundle);
  setText("ed-year-summary-year", String(bundle.period.year));
  setText("ed-year-pagato", `${formatNumber(money.importCost, 2)} €`);
  setText("ed-year-pagato-sub", `${kwh(data.gridImport)} ${t("dalla rete", "from grid")}`);
  setText("ed-year-risparmio", `${formatNumber(money.saved, 2)} €`);
  setText("ed-year-risparmio-sub", `${t("su", "on")} ${kwh(data.house)}`);
  setText("ed-dkpi-year-lbl", String(bundle.period.year));
}

function applyDeviceRows(bundle) {
  const list = doc?.getElementById("ed-device-list");
  if (!list) return;
  const { devices, values } = bundle.deviceMonth;
  const available = devices
    .map((device) => values.get(device.history || device.entity))
    .filter((value) => Number.isFinite(value));
  const maximum = Math.max(0.001, ...available);
  let total = 0;
  list.querySelectorAll(".ed-device-row").forEach((row) => {
    const direct = clean(row.dataset.entity || row.dataset.sensor);
    const name = clean(row.querySelector(".ed-dev-name")?.childNodes?.[0]?.textContent);
    const device = devices.find(
      (item) => clean(item.name) === name || clean(item.entity) === direct,
    );
    const entity = clean(device?.history || device?.entity || direct);
    const value = values.get(entity) ?? values.get(root.resolveEntity?.(entity) || entity);
    if (!Number.isFinite(value)) return;
    total += value;
    row.dataset.entity = entity;
    row.dataset.dmPeriodOwner = VERSION;
    const valueNode = row.querySelector(".ed-dev-kwh");
    if (valueNode) valueNode.innerHTML = `${formatNumber(value)} <small>kWh</small>`;
    const eur = row.querySelector(".ed-dev-eur");
    if (eur) eur.textContent = `${formatNumber(value * bundle.rates.importPrice, 2)} €`;
    const fill = row.querySelector(".ed-dev-bar-fill,.ed-dev-bar");
    if (fill) fill.style.width = `${Math.min(100, (value / maximum) * 100)}%`;
    scriviLaQuota(row, splitFor(bundle.month, value));
    row.querySelectorAll(".ed-dev-live,.ed-dev-total-live,.ed-dev-name small").forEach((node) => {
      node.hidden = true;
    });
  });
  setText("ed-dev-total", kwh(total));
}

/* La riga di sotto — «☀️ tot kWh 🔌 tot kWh» — parla dello stesso numero.
 *
 * «Valori wallbox nel report sballati»: sulla riga della Wallbox c'era scritto
 * «☀️ 1188.7 kWh 🔌 184.0 kWh» e, tre centimetri a destra, «0,0 kWh». Due
 * numeri sulla stessa riga che si contraddicono, e uno dei due era il
 * contatore di vita della colonnina.
 *
 * La ragione e' che questa funzione si prendeva meta' riga. Il guscio disegna
 * il numero a destra e la quota qui sotto dallo stesso valore, e finche' li
 * scrive lui sono d'accordo; poi si passa di qui e si riscrive il numero a
 * destra col valore del Recorder — che e' quello giusto, perche' il guscio nel
 * mese corrente si perde il delta quando la sua chiamata allo storico
 * fallisce. La quota pero' restava quella di prima, cioe' calcolata sul
 * contatore intero.
 *
 * Chi possiede il numero possiede la riga: la quota si rifa' con la stessa
 * spartizione che usa la scheda del dispositivo, sullo stesso valore. */
export function scriviLaQuota(row, quota) {
  const riga = row.querySelector(".ed-dev-name div");
  if (!riga) return;
  const pezzi = riga.querySelectorAll("span");
  if (pezzi.length < 2) return;
  pezzi[0].textContent = `☀️ ${formatNumber(quota.solar, 1)} kWh`;
  pezzi[1].textContent = `🔌 ${formatNumber(quota.grid, 1)} kWh`;
  riga.dataset.dmQuota = VERSION;
}

function valueFrom(values, entity) {
  const value = values instanceof Map ? values.get(entity) : values?.[entity];
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

export function splitFor(period, value) {
  const house = finite(period?.house);
  const grid = finite(period?.gridImport);
  const gridShare = house > 0 ? Math.max(0, Math.min(1, grid / house)) : 1;
  return { grid: value * gridShare, solar: value * (1 - gridShare) };
}

function applyDeviceDetail(bundle) {
  const selector = doc?.getElementById("ed-dev-selector");
  const entity = clean(selector?.value);
  if (!entity || !bundle?.deviceMonth || !bundle?.deviceYear) return false;
  const device = bundle.deviceMonth.devices.find(
    (item) => item.entity === entity || item.history === entity,
  );
  const source = clean(device?.history || entity);
  const monthValue = valueFrom(bundle.deviceMonth.values, source);
  const yearValue = valueFrom(bundle.deviceYear.values, source);
  if (monthValue == null || yearValue == null) return false;
  const selectedMonth = Number(bundle.period?.month) || new Date().getMonth() + 1;
  const selectedYear = Number(bundle.period?.year) || new Date().getFullYear();
  const days = new Date(selectedYear, selectedMonth, 0).getDate();
  const importPrice = finite(bundle.rates?.importPrice);
  const monthSplit = splitFor(bundle.month, monthValue);
  const yearSplit = splitFor(bundle.year, yearValue);

  setText("ed-dkpi-mese", `${formatNumber(monthValue, 1)} kWh`);
  setText("ed-dkpi-mese-eur", `€ ${formatNumber(monthValue * importPrice, 2)}`);
  setText("ed-dkpi-media", `${formatNumber(days ? monthValue / days : 0, 2)} kWh`);
  setText("ed-dkpi-media-sub", t("Media/giorno", "Daily average"));
  setText("ed-dkpi-risp-eur", `+ ${formatNumber(monthSplit.solar * importPrice, 2)} €`);
  setText(
    "ed-dkpi-risp-kwh",
    `${formatNumber(monthSplit.solar, 1)} kWh ${t("da FV", "from solar")}`,
  );
  setText("ed-dkpi-costo-eur", `- ${formatNumber(monthSplit.grid * importPrice, 2)} €`);
  setText(
    "ed-dkpi-costo-kwh",
    `${formatNumber(monthSplit.grid, 1)} kWh ${t("dalla rete", "from grid")}`,
  );
  setText("ed-dkpi-year-lbl", String(selectedYear));
  setText("ed-dkpi-anno-risp-eur", `+ ${formatNumber(yearSplit.solar * importPrice, 2)} €`);
  setText(
    "ed-dkpi-anno-risp-kwh",
    `${formatNumber(yearSplit.solar, 1)} kWh ${t("da FV", "from solar")}`,
  );
  setText("ed-dkpi-anno-costo-eur", `- ${formatNumber(yearSplit.grid * importPrice, 2)} €`);
  setText(
    "ed-dkpi-anno-costo-kwh",
    `${formatNumber(yearSplit.grid, 1)} kWh ${t("dalla rete", "from grid")}`,
  );

  const panel = doc?.querySelector(".ed-device-detail,#ed-device-detail");
  if (panel)
    panel.dataset.dmCanonicalDevicePeriod = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}|${monthValue}`;
  return true;
}

export function applyAtomicEnergyBundle(bundle = state.bundle) {
  if (!bundle || !doc || state.applying) return false;
  state.applying = true;
  try {
    applyFlow("day", bundle.day);
    applyFlow("month", bundle.month);
    applyReportOverview(bundle);
    applyAnnual(bundle);
    applyDeviceRows(bundle);
    applyDeviceDetail(bundle);
    doc.querySelectorAll("#view-day,#view-month,#view-panoramica").forEach((node) => {
      node.dataset.dmEnergyBundle = String(bundle.generation);
      node.classList.remove("dm-energy-awaiting");
      node.removeAttribute("aria-busy");
    });
    return true;
  } finally {
    state.applying = false;
  }
}

function setEnergyLoading(active) {
  doc?.querySelectorAll("#view-day,#view-month,#view-panoramica").forEach((node) => {
    node.toggleAttribute("aria-busy", active);
    node.classList.toggle("dm-energy-loading", active);
    node.classList.toggle("dm-energy-awaiting", active && !state.bundle && hasConfiguredEnergy());
  });
}

export async function refreshEnergy(period = selectedPeriod()) {
  setEnergyLoading(true);
  try {
    const bundle = await loadAtomicEnergyBundle(period);
    if (!bundle) return false;
    commitDerived(bundle);
    state.bundle = bundle;
    state.selected = bundle.period;
    state.lastRefreshAt = Date.now();
    state.retryCount = 0;
    state.lastError = "";
    state.ready = true;
    applyAtomicEnergyBundle(bundle);
    root.dispatchEvent?.(new CustomEvent("dashboardmodern:period-bundle", { detail: bundle }));
    root.dispatchEvent?.(new CustomEvent("dashboardmodern:energy-stable", { detail: bundle }));
    return true;
  } catch (error) {
    state.lastError = clean(error?.message || error);
    root.console?.warn?.(
      "[DashboardModern] atomic energy refresh retained the last good bundle",
      error,
    );
    if (!state.bundle && state.retryCount < 40) {
      state.retryCount += 1;
      scheduleEnergyRefresh(true, 250);
    }
    return false;
  } finally {
    setEnergyLoading(false);
  }
}

function scheduleProjection() {
  if (!state.bundle || state.projectionFrame) return;
  const callback = () => {
    state.projectionFrame = 0;
    applyAtomicEnergyBundle(state.bundle);
  };
  state.projectionFrame = root.requestAnimationFrame?.(callback) || root.setTimeout?.(callback, 0);
}

/* Chiedere il ricalcolo dei periodi, da fuori.
 *
 * Serve a chi cambia la CONFIGURAZIONE dell'Energia senza che nessuna entita'
 * cambi stato — cambiare impianto e' il caso vero — perche' il giro che
 * ascolta gli stati chiede l'entita' cambiata, e li' non ce n'e' nessuna. */
export function scheduleEnergyRefresh(force = false, explicitDelay = null) {
  root.clearTimeout?.(state.refreshTimer);
  const elapsed = Date.now() - state.lastRefreshAt;
  const delay = explicitDelay ?? (force ? 0 : Math.max(250, 15000 - elapsed));
  state.refreshTimer = root.setTimeout?.(() => {
    state.refreshTimer = 0;
    refreshEnergy();
  }, delay);
}

const TOTAL_FIELDS = Object.freeze([
  [
    "house",
    "total_energy",
    "annual_energy",
    "Energia totale",
    "Total energy",
    "sensor.casa_totale",
  ],
  ["solar", "total_energy", "annual_energy", "Energia totale", "Total energy", "sensor.fv_totale"],
  [
    "grid",
    "total_import_energy",
    "monthly_import_energy",
    "Energia totale prelevata",
    "Total imported energy",
    "sensor.rete_prelievo_totale",
  ],
  [
    "grid",
    "total_export_energy",
    "monthly_export_energy",
    "Energia totale immessa",
    "Total exported energy",
    "sensor.rete_immissione_totale",
  ],
  [
    "battery",
    "daily_discharged_energy",
    "daily_charged_energy",
    "Scaricata oggi",
    "Discharged today",
    "sensor.batteria_scaricata_oggi",
  ],
  [
    "battery",
    "monthly_discharged_energy",
    "monthly_charged_energy",
    "Scaricata questo mese",
    "Discharged this month",
    "sensor.batteria_scaricata_mese",
  ],
  [
    "battery",
    "total_charged_energy",
    "monthly_charged_energy",
    "Energia totale caricata",
    "Total charged energy",
    "sensor.batteria_caricata_totale",
  ],
  [
    "battery",
    "total_discharged_energy",
    "monthly_discharged_energy",
    "Energia totale scaricata",
    "Total discharged energy",
    "sensor.batteria_scaricata_totale",
  ],
]);

function createTotalField(definition, value) {
  const [group, key, _after, italian, englishLabel, example] = definition;
  const label = t(italian, englishLabel);
  const wrap = doc.createElement("label");
  wrap.className = "ed-slot dm-energy-total-field";
  wrap.dataset.dmInjectedEnergyTotal = "true";
  wrap.dataset.energyGroup = group;
  wrap.dataset.energyKey = key;
  wrap.innerHTML = `<span class="ed-slot-lbl">${esc(label)} <span class="ed-acc-n">kWh</span> <span class="ed-acc-n">${t("Facoltativo", "Optional")}</span></span><span class="ed-hint">${t("Entità Home Assistant, es.", "Home Assistant entity, e.g.")} ${esc(example)}</span>`;
  const field = doc.createElement("span");
  field.className = "dm-entity-field";
  field.dataset.entityField = "";
  const row = doc.createElement("span");
  row.className = "ed-form-row";
  const input = doc.createElement("input");
  input.id = `dm-energy-${group}-${key}`;
  input.name = `${group}.${key}`;
  input.className = "ed-input ed-slot-in mono";
  input.dataset.entityInput = "true";
  input.value = clean(value);
  input.placeholder = example;
  const picker = doc.createElement("button");
  picker.type = "button";
  picker.className = "dm-entity-picker";
  picker.dataset.entityTarget = input.id;
  picker.textContent = "🔍";
  picker.setAttribute("aria-label", `${t("Seleziona", "Select")} ${label}`);
  picker.addEventListener("click", () => root.wzPickEntity?.(input));
  row.append(input, picker);
  field.append(row);
  const stateValue = allStates()[input.value];
  if (input.value && stateValue) {
    const preview = doc.createElement("output");
    preview.className = "ed-row-old dm-entity-preview";
    preview.textContent = `${stateValue.state} kWh`;
    field.append(preview);
  }
  const note = doc.createElement("small");
  note.className = "dm-energy-total-note dm-energy-total-help";
  note.textContent = t(
    "Contatore cumulativo kWh con state_class total o total_increasing.",
    "Cumulative kWh meter with state_class total or total_increasing.",
  );
  wrap.append(field, note);
  return { wrap, input };
}

/* Un campo alla volta, in fila, nella stessa coda di tutti gli altri.
 *
 * Ogni scrittura legge il modello, ci mette dentro il suo campo e lo riscrive
 * per intero. Due campi cambiati a poca distanza — cosa che succede appena si
 * compila la maschera scendendo — leggevano tutti e due lo stesso modello di
 * partenza, e l'ultimo a scrivere riportava indietro il campo dell'altro. La
 * coda vive in `energy-writer.js` perche' anche la maschera stampata dal
 * programma passa di li': due code separate sarebbero di nuovo due padroni. */
/* Si scrive nell'impianto aperto, non sempre nel primo.
 *
 * E' il gemello della lettura: la maschera mostra i campi dell'impianto scelto,
 * e senza questo il salvataggio li poserebbe sul primo — cancellando le entita'
 * di una casa con quelle di un'altra. */
const persistEnergyField = (group, key, value) =>
  writeEnergyField(dashboardStore(), group, key, value, impiantoScelto());

function entityField(label, key, value, placeholder) {
  const wrap = doc.createElement("label");
  wrap.className = "ed-slot dm-energy-load-field";
  wrap.innerHTML = `<span class="ed-slot-lbl">${esc(label)}</span>`;
  const row = doc.createElement("span");
  row.className = "ed-form-row";
  const input = doc.createElement("input");
  input.className = "ed-input ed-slot-in mono";
  input.name = key;
  input.value = clean(value);
  input.placeholder = placeholder;
  input.dataset.entityInput = "true";
  input.id = `dm-energy-${key}-${Math.random().toString(36).slice(2)}`;
  const picker = doc.createElement("button");
  picker.type = "button";
  picker.className = "dm-entity-picker";
  picker.textContent = "🔍";
  picker.addEventListener("click", () => root.wzPickEntity?.(input));
  row.append(input, picker);
  wrap.append(row);
  return { wrap, input };
}

function validSocEntity(entity) {
  if (!entity) return true;
  const attrs = allStates()[entity]?.attributes || {};
  return attrs.device_class === "battery" || attrs.unit_of_measurement === "%";
}

function installBatterySocField(editor, model) {
  if (editor.querySelector("#dm-energy-battery-soc")) return;
  const anchor = editor.querySelector("#dm-energy-battery-daily_discharged_energy");
  const body = anchor?.closest(".ed-acc-body");
  if (!body) return;
  const { wrap, input } = entityField(
    t("Entità SOC batteria", "Battery SOC entity"),
    "battery-soc",
    model.battery?.battery_soc_entity || model.battery?.battery_soc,
    "sensor.batteria_soc",
  );
  input.id = "dm-energy-battery-soc";
  input.addEventListener("change", async () => {
    const valid = validSocEntity(clean(input.value));
    input.dataset.validation = valid ? "valid" : "invalid";
    if (!valid) return;
    await persistEnergyField("battery", "battery_soc_entity", input.value);
    scheduleProjection();
  });
  body.prepend(wrap);
}

/* I carichi li disegna la sezione «Carichi e dispositivi», e nessun altro.
 *
 * Qui c'era un secondo editor dei carichi, con lo stesso nome di funzione di
 * quello vero. Cercava il pannello dei flussi e, se non lo trovava — cioe'
 * ogni volta che la configurazione era aperta su un'altra linguetta —
 * ripiegava sulla scheda intera. Cosi' quel blocco finiva appeso al corpo
 * della configurazione e ti seguiva ovunque: sotto Elettrodomestici, sotto
 * Aperture, sotto Backup compariva un «CARICHI / + Aggiungi carico» spoglio,
 * che li' non vuol dire niente. Segnalato esattamente cosi', ed era
 * esattamente questo: un padrone in piu' per una cosa che ne aveva gia' uno.
 *
 * Con lui se ne vanno il suo salvataggio e la sua maschera: la sezione
 * energy-loads-editor-section.js fa tutto, con le schede, gli impianti e il
 * tasto Salva. */

function updateConfiguredCount(body) {
  const counter = body?.closest("details.ed-acc")?.querySelector("summary small");
  if (!counter) return;
  const inputs = [...body.querySelectorAll("input[name]")];
  counter.textContent = `${inputs.filter((input) => clean(input.value)).length}/${inputs.length} ${t("configurati", "configured")}`;
}

function installEnergyEditorContracts() {
  const editor = doc?.querySelector(
    '#ed-body[data-editor="energy"],#editor-modal [data-editor="energy"]',
  );
  if (!editor) return false;
  editor
    .querySelectorAll(
      ".dm-energy-total-overview:not(.dm-energy-help-compact),.dm-energy-total-help:not(.dm-energy-total-note)",
    )
    .forEach((node) => node.remove());
  const flows = editor.querySelector('[data-energy-panel="flows"]') || editor;
  let overview = flows.querySelector(".dm-energy-help-compact");
  if (!overview) {
    overview = doc.createElement("div");
    overview.className = "dm-energy-help-compact dm-energy-total-overview";
    overview.innerHTML = t(
      "<strong>Storico Energia</strong><span>Per calcolare giorno, mese, anno e mesi precedenti usa un contatore cumulativo in kWh. I sensori giornalieri, mensili e annuali restano facoltativi.</span>",
      "<strong>Energy history</strong><span>Use a cumulative kWh meter to calculate day, month, year and previous months. Daily, monthly and annual sensors remain optional.</span>",
    );
    flows.prepend(overview);
  }

  const model = configuredEnergyModel();
  installBatterySocField(editor, model);
  TOTAL_FIELDS.forEach((definition) => {
    const [group, key, afterKey] = definition;
    /* Il campo puo' esserci gia': lo stampa il runtime, e in quel caso e' la
     * maschera canonica a possederlo — raccoglie il valore nella sua bozza e lo
     * scrive quando si preme Salva. Qui si costruisce solo cio' che manca:
     * aggiungere un secondo salvataggio su un campo che ne ha gia' uno vuol
     * dire due padroni sullo stesso dato, ed e' proprio cio' che rompe. */
    if (editor.querySelector(`#dm-energy-${group}-${key}`)) return;
    const anchor = editor.querySelector(`#dm-energy-${group}-${afterKey}`);
    const body = anchor?.closest(".ed-acc-body");
    if (!body) return;
    const { wrap, input } = createTotalField(definition, model[group]?.[key]);
    const anchorField = anchor.closest("label.ed-slot");
    if (anchorField?.parentElement === body) anchorField.after(wrap);
    else body.append(wrap);
    input.addEventListener("input", () => {
      const actions = editor.querySelector("[data-energy-actions]");
      const save = actions?.querySelector("[data-energy-save]");
      if (actions) actions.dataset.state = "dirty";
      if (save) save.disabled = false;
      updateConfiguredCount(body);
    });
    input.addEventListener("change", async () => {
      input.dataset.validation = !input.value || allStates()[input.value] ? "valid" : "invalid";
      try {
        await persistEnergyField(group, key, input.value);
        scheduleEnergyRefresh(true);
      } catch (error) {
        input.dataset.validation = "invalid";
        root.console?.error?.("[DashboardModern] total energy field", error);
      }
    });
    updateConfiguredCount(body);
  });
  return true;
}

function installObserver() {
  if (!doc || state.observer || typeof root.MutationObserver !== "function") return;
  const nodes = FLOW_IDS.map((id) => doc.getElementById(id)).filter(Boolean);
  if (!nodes.length) return;
  state.observer = new root.MutationObserver(() => {
    if (!state.applying && state.bundle) scheduleProjection();
  });
  nodes.forEach((node) =>
    state.observer.observe(node, { childList: true, characterData: true, subtree: true }),
  );
}

function installStyles() {
  installStyle(
    "dm-energy-section-style",
    `
      .dm-energy-awaiting{position:relative!important}
      .dm-energy-awaiting #n-solar-day,.dm-energy-awaiting #n-home-day,.dm-energy-awaiting #n-grid-day,.dm-energy-awaiting #n-battery-day,
      .dm-energy-awaiting #n-solar-month,.dm-energy-awaiting #n-home-month,.dm-energy-awaiting #n-grid-month,.dm-energy-awaiting #n-battery-month{visibility:hidden!important}
      .dm-energy-awaiting::after{content:"${t("Caricamento dati Energia…", "Loading Energy data…")}";position:absolute;inset:0;display:grid;place-items:center;color:var(--secondary-text-color,#64748b);font-weight:800;letter-spacing:.04em;background:color-mix(in srgb,var(--card-bg,#fff) 88%,transparent);z-index:3}
      .dm-energy-loading:not(.dm-energy-awaiting){opacity:.92;transition:opacity .15s ease}
      .dm-energy-help-compact{display:grid;gap:4px;margin:0 0 14px;padding:12px 14px;border:1px solid var(--divider-color,rgba(15,23,42,.12));border-radius:14px;background:var(--secondary-background-color,rgba(14,165,233,.08));color:var(--text,#0f172a);font-size:13px;line-height:1.45}
      .dm-energy-help-compact strong{font-size:14px}
      .dm-energy-total-note{display:block;margin-top:6px;color:var(--secondary-text-color,#64748b);font-size:11px;line-height:1.35}
      .dm-energy-signed{margin:0 0 14px;padding:12px 14px;border:1px solid var(--divider-color,rgba(15,23,42,.14));border-radius:14px;background:color-mix(in srgb,var(--secondary-background-color,#f1f5f9) 70%,transparent)}
      .dm-energy-signed-head{display:flex;align-items:flex-start;gap:10px;cursor:pointer}
      .dm-energy-signed-head input{margin-top:3px;flex:0 0 auto;width:17px;height:17px}
      .dm-energy-signed-head span{display:grid;gap:2px}
      .dm-energy-signed-head strong{font-size:13.5px}
      .dm-energy-signed-head small{color:var(--secondary-text-color,#64748b);font-size:11.5px;line-height:1.35}
      .dm-energy-signed-body{display:grid;gap:10px;margin-top:12px}
      .dm-energy-signed-body[hidden]{display:none!important}
      .dm-energy-signed-hint{margin:0;font-size:11.5px;line-height:1.4}
      .dm-energy-signed-direction{display:grid;gap:6px}
      .dm-energy-signed-option{display:flex;align-items:center;gap:8px;font-size:12.5px}
      .dm-energy-signed-option input{width:16px;height:16px}
      .dm-energy-signed-note{display:block;margin-top:4px;color:var(--secondary-text-color,#64748b);font-size:11px;line-height:1.35}
      .ed-slot[data-dm-energy-signed-managed],.ed-slot[data-energy-signed-managed]{opacity:.62}
      .ed-slot[data-energy-signed-managed] input{pointer-events:none}
      .ed-slot[data-energy-signed-managed] .dm-entity-picker{display:none!important}
      #editor-modal[data-dm-editor-theme="dark"] .dm-energy-signed{background:var(--dm-editor-panel,#1b2540);border-color:var(--dm-editor-border,#263453);color:var(--dm-editor-text,#e6edf7)}
      #editor-modal[data-dm-editor-theme="dark"] .dm-energy-signed-head small,
      #editor-modal[data-dm-editor-theme="dark"] .dm-energy-signed-note{color:var(--dm-editor-muted,#92a4c2)}
      #editor-modal[data-dm-editor-theme="dark"] .dm-energy-help-compact{background:var(--dm-editor-panel,#1b2540);border-color:var(--dm-editor-border,#263453);color:var(--dm-editor-text,#e6edf7)}
      #editor-modal[data-dm-editor-theme="dark"] .dm-energy-total-note{color:var(--dm-editor-muted,#92a4c2)}
    `,
  );
}

function installWrappers() {
  for (const name of ["render", "renderEnergyDashboard", "renderEdDeviceList"]) {
    wrapFunction(name, "__dmEnergySection", scheduleProjection);
  }
  wrapFunction("edCaricaDettaglio", "__dmEnergyDetailSection", scheduleProjection);
  onEditorRedraw("__dmEnergyEditorSection", installEnergyEditorContracts);
}

function bindEvents() {
  if (!doc || state.listeners) return;
  state.listeners = true;
  doc.addEventListener("change", (event) => {
    if (event.target?.matches?.("#ed-sel-month,#ed-sel-year")) scheduleEnergyRefresh(true);
  });
  doc.addEventListener(
    "click",
    (event) => {
      if (
        event.target?.closest?.(
          "[data-tab='energy'],.sub-tab-btn,.ed-tab[data-tab='sez1'],[data-energy-tab]",
        )
      ) {
        root.queueMicrotask?.(() => {
          installEnergyEditorContracts();
          scheduleProjection();
        });
      }
    },
    true,
  );
  root.addEventListener?.("dashboardmodern:state-changed", (event) => {
    if (stateChangeAffectsEnergy(event)) scheduleEnergyRefresh(false);
  });
  root.addEventListener?.("dashboardmodern:legacy-ready", () => {
    installWrappers();
    installObserver();
    installEnergyEditorContracts();
    scheduleEnergyRefresh(true);
    risvegliaReportDelGuscio();
  });
  root.addEventListener?.("dashboardmodern:runtime-ready", risvegliaReportDelGuscio);
  /* La maschera Energia si ridisegna anche da sola — dichiarare una sorgente
   * unica con segno spegne le caselle dei due versi — e i campi aggiunti qui
   * vanno rimessi sul nuovo albero. */
  root.addEventListener?.("dashboardmodern:energy-editor-rendered", () => {
    installEnergyEditorContracts();
  });
  root.addEventListener?.("pageshow", () => {
    installWrappers();
    installObserver();
    if (state.bundle) scheduleProjection();
    else scheduleEnergyRefresh(true);
  });
}

/* Il Report del guscio parte a freddo: la sua lista (ED_DEVICES) nasce da
 * UNA chiamata all'avvio del runtime, e se quella corre prima che i moduli
 * esistano la lista resta vuota fino a un timer di cortesia di due secondi
 * e mezzo — sul campo un Report senza dispositivi, e sulla macchina lenta
 * della CI un rosso che va e viene. Il guscio pero' lascia un segno quando
 * fallisce (__DM_REPORT_RUNTIME_ERROR__): appena i moduli annunciano di
 * esserci, se il segno e' acceso si ricostruisce; quando il guscio ce
 * l'aveva gia' fatta, qui non si tocca niente. */
function risvegliaReportDelGuscio() {
  /* Le voci del selettore del Report sono NOMI dati dalla persona, piu'
   * un'emoji: il passaggio di traduzione del DOM non deve toccarle — un
   * «Forno» chiamato cosi' dal suo padrone resta «Forno» in ogni lingua. */
  doc?.getElementById?.("ed-dev-selector")?.setAttribute("data-dm-no-i18n", "");
  if (!root.__DM_REPORT_RUNTIME_ERROR__) return;
  if (typeof root.cdRebuildReportDevices !== "function") return;
  try {
    root.cdRebuildReportDevices();
    root.buildReportSelect?.();
  } catch (_error) {}
}

function subscribeStore() {
  if (state.storeUnsubscribe || !dashboardStore()?.subscribe) return;
  state.storeUnsubscribe = dashboardStore().subscribe((change) => {
    if (["energy", "appliances", "loads", "entityOverrides"].includes(change.section)) {
      scheduleEnergyRefresh(true);
    }
  });
}

async function startBroker() {
  if (state.brokerStarted) return;
  state.brokerStarted = true;
  try {
    await broker.startStateFeed();
    root.dispatchEvent?.(
      new CustomEvent("dashboardmodern:states-ready", {
        detail: { count: Object.keys(allStates()).length },
      }),
    );
  } catch (error) {
    state.brokerStarted = false;
    state.lastError = clean(error?.message || error);
    if (state.retryCount < 40) scheduleEnergyRefresh(true, 250);
  }
}

export function installEnergySection() {
  if (!doc) return;
  sanitizeHostedCredentials();
  installStyles();
  installWrappers();
  bindEvents();
  subscribeStore();
  installObserver();
  installEnergyEditorContracts();
  startBroker();
  if (hasConfiguredEnergy()) {
    if (state.bundle) applyAtomicEnergyBundle(state.bundle);
    else scheduleEnergyRefresh(true);
  } else {
    state.ready = true;
  }
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installEnergySection, { once: true });
else installEnergySection();
