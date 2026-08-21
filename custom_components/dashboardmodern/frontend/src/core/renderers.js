// DM-FIX-20260812B
import { getDeviceDisplayName, getDeviceVisual } from "./device-model.js";
import { pick } from "./i18n.js";
import { runtimeMetrics } from "./runtime-metrics.js";

function metric(states, entity, expectedUnit) {
  const state = entity && states[entity];
  const value = Number(state?.state);
  return {
    entity: entity || "",
    value: Number.isFinite(value) ? value : null,
    unit: state?.attributes?.unit_of_measurement || expectedUnit,
  };
}

export function createEnergyReportRows(
  appliances = [],
  states = {},
  rooms = [],
  costPerKwh = 0,
  locale = "it",
) {
  return appliances.map((device) => {
    const daily = metric(states, device.daily_energy_entity, "kWh");
    const monthly = metric(states, device.monthly_energy_entity, "kWh");
    return {
      id: device.id,
      name: getDeviceDisplayName(device, states, locale),
      visual: getDeviceVisual(device),
      category: device.device_type || pick("Elettrodomestico", "Appliance", locale),
      room: rooms.find((room) => room.id === device.room_id) || null,
      power: metric(states, device.power_entity, "W"),
      daily,
      monthly,
      total: metric(states, device.total_energy_entity || device.energy_entity, "kWh"),
      cost: monthly.value == null ? null : monthly.value * Number(costPerKwh || 0),
      state:
        metric(states, device.control_entity, "").value ??
        states[device.control_entity]?.state ??
        "unknown",
      historyEntity: device.history_entity || device.energy_entity || device.power_entity || "",
    };
  });
}

export function createRenderCoordinator(store, renderers = {}) {
  const call = (name, ...args) => typeof renderers[name] === "function" && renderers[name](...args);
  return store.subscribe((change) => {
    if (change.status !== "optimistic" && change.status !== "rollback") return;
    call("renderSection", change.section, change);
    const names = {
      appliances: "renderAppliances",
      cameras: "renderCameras",
      lights: "renderLights",
      climate: "renderClimate",
      covers: "renderCovers",
      pool: "renderPool",
      irrigation: "renderIrrigation",
      rooms: "renderRooms",
      ev: "renderEvProfiles",
      energy: "renderEnergy",
    };
    call(names[change.section], change);
    if (["appliances", "loads", "energy", "report"].includes(change.section))
      call("renderEnergyReport", change);
    if (change.section === "rooms") {
      call("renderRoomSelectors", change);
      call("renderLights", change);
      call("renderAppliances", change);
    }
    // Keep the open editor in step with the optimistic model (and with a
    // rollback).  Previously only dashboard renderers were called here, so
    // the stale editor DOM survived until editorSwitch() happened to rebuild it.
    call("renderCurrentEditor", change.section, change);
    call("renderDropdowns", change.section, change);
    runtimeMetrics.increment("globalRenders");
    call("renderDashboard", change.section, change);
    if (change.visibilityChanged) call("renderNavbar", change);
  });
}

export function renderDeviceCard(document, target, device, states = {}, rooms = [], locale = "it") {
  const root = typeof target === "string" ? document.querySelector(target) : target;
  if (!root) return null;
  const visual = getDeviceVisual(device);
  const card = document.createElement("article");
  card.className = "ed-row";
  card.dataset.deviceId = device.id;
  const room = rooms.find((value) => value.id === device.room_id);
  const media = document.createElement(visual.kind === "image" ? "img" : "span");
  media.className = "appl-ic";
  if (visual.kind === "image") {
    media.src = visual.value;
    media.alt = "";
  } else if (visual.kind === "asset") {
    media.dataset.asset = visual.value;
    media.innerHTML = globalThis.cdApplianceIcon?.(visual.value, 28) || visual.value;
  } else media.dataset.icon = visual.value;
  const title = document.createElement("strong");
  title.textContent = getDeviceDisplayName(device, states, locale);
  const category = document.createElement("small");
  category.textContent = device.device_type || device.section;
  const roomLabel = document.createElement("small");
  roomLabel.textContent = room?.name || "";
  card.append(media, title, category, roomLabel);
  root.append(card);
  return card;
}

const ENERGY_GROUPS = [
  [
    "house",
    "Casa",
    [
      ["power", "Potenza istantanea", "W", "sensor.casa_power"],
      ["daily_energy", "Energia giornaliera", "kWh", "sensor.casa_oggi"],
      ["monthly_energy", "Energia mensile", "kWh", "sensor.casa_mese"],
      ["annual_energy", "Energia annuale", "kWh", "sensor.casa_anno"],
      ["total_energy", "Contatore energia totale", "kWh", "sensor.casa_totale"],
    ],
  ],
  [
    "grid",
    "Rete · prelievo",
    [
      ["power", "Potenza rete", "W", "sensor.rete_power"],
      ["daily_import_energy", "Energia prelevata giornaliera", "kWh", "sensor.rete_prelievo_oggi"],
      ["monthly_import_energy", "Energia prelevata mensile", "kWh", "sensor.rete_prelievo_mese"],
      ["annual_import_energy", "Energia prelevata annuale", "kWh", "sensor.rete_prelievo_anno"],
      ["total_import_energy", "Contatore energia totale", "kWh", "sensor.rete_prelievo_totale"],
    ],
  ],
  [
    "grid",
    "Rete · immissione",
    [
      ["power", "Potenza", "W", "sensor.rete_power"],
      ["daily_export_energy", "Energia immessa giornaliera", "kWh", "sensor.rete_immissione_oggi"],
      ["monthly_export_energy", "Energia immessa mensile", "kWh", "sensor.rete_immissione_mese"],
      ["annual_export_energy", "Energia immessa annuale", "kWh", "sensor.rete_immissione_anno"],
      ["total_export_energy", "Contatore energia totale", "kWh", "sensor.rete_immissione_totale"],
    ],
  ],
  [
    "solar",
    "Fotovoltaico",
    [
      ["power", "Potenza", "W", "sensor.fv_power"],
      ["daily_energy", "Energia giornaliera", "kWh", "sensor.fv_oggi"],
      ["monthly_energy", "Energia mensile", "kWh", "sensor.fv_mese"],
      ["annual_energy", "Energia annuale", "kWh", "sensor.fv_anno"],
      ["total_energy", "Contatore energia totale", "kWh", "sensor.fv_totale"],
    ],
  ],
  [
    "battery",
    "Batteria · carica",
    [
      ["power", "Potenza", "W", "sensor.batteria_power"],
      ["soc", "Stato di carica", "%", "sensor.batteria_soc"],
      ["daily_charged_energy", "Caricata oggi", "kWh", "sensor.batteria_caricata_oggi"],
      ["monthly_charged_energy", "Caricata questo mese", "kWh", "sensor.batteria_caricata_mese"],
      ["annual_charged_energy", "Caricata questo anno", "kWh", "sensor.batteria_caricata_anno"],
      [
        "total_charged_energy",
        "Contatore energia totale",
        "kWh",
        "sensor.batteria_caricata_totale",
      ],
    ],
  ],
  [
    "battery",
    "Batteria · scarica",
    [
      ["power", "Potenza", "W", "sensor.batteria_power"],
      ["daily_discharged_energy", "Scaricata oggi", "kWh", "sensor.batteria_scaricata_oggi"],
      [
        "monthly_discharged_energy",
        "Scaricata questo mese",
        "kWh",
        "sensor.batteria_scaricata_mese",
      ],
      [
        "annual_discharged_energy",
        "Scaricata questo anno",
        "kWh",
        "sensor.batteria_scaricata_anno",
      ],
      [
        "total_discharged_energy",
        "Contatore energia totale",
        "kWh",
        "sensor.batteria_scaricata_totale",
      ],
    ],
  ],
];

const ENERGY_ICONS = { house: "🏠", grid: "🔌", solar: "☀️", battery: "🔋" };
const ENERGY_EN = Object.freeze({
  Casa: "Home",
  Rete: "Grid",
  "Rete · prelievo": "Grid · import",
  "Rete · immissione": "Grid · export",
  Fotovoltaico: "Solar",
  Batteria: "Battery",
  "Batteria · carica": "Battery · charge",
  "Batteria · scarica": "Battery · discharge",
  "Potenza istantanea": "Instant power",
  "Energia giornaliera": "Daily energy",
  "Energia mensile": "Monthly energy",
  "Energia annuale": "Annual energy",
  "Energia totale": "Total energy",
  "Contatore energia totale": "Total energy meter",
  "Energia prelevata annuale": "Annual imported energy",
  "Energia immessa annuale": "Annual exported energy",
  "Caricata oggi": "Charged today",
  "Caricata questo mese": "Charged this month",
  "Caricata questo anno": "Charged this year",
  "Scaricata oggi": "Discharged today",
  "Scaricata questo mese": "Discharged this month",
  "Scaricata questo anno": "Discharged this year",
  "Potenza rete": "Grid power",
  "Potenza prelevata": "Import power",
  "Potenza immessa": "Export power",
  "Energia prelevata giornaliera": "Daily imported energy",
  "Energia immessa giornaliera": "Daily exported energy",
  "Energia prelevata mensile": "Monthly imported energy",
  "Energia immessa mensile": "Monthly exported energy",
  "Energia totale prelevata": "Total imported energy",
  "Energia totale immessa": "Total exported energy",
  Potenza: "Power",
  SOC: "State of charge",
  "Stato di carica": "State of charge",
  "Energia caricata": "Charged energy",
  "Energia scaricata": "Discharged energy",
});

/* Authored as it/en pairs so any locale resolves through the shared catalog
 * instead of picking one of two hard-coded columns. */
const ENERGY_UI_SOURCE = Object.freeze({
  select: ["Seleziona", "Select"],
  optional: ["Facoltativo", "Optional"],
  entityHint: ["Entità Home Assistant, es.", "Home Assistant entity, e.g."],
  configured: ["configurati", "configured"],
  save: ["💾 Salva Energia", "💾 Save Energy"],
  clean: ["Nessuna modifica non salvata", "No unsaved changes"],
  dirty: ["Modifiche non salvate", "Unsaved changes"],
});

function energyCopy(locale) {
  const copy = {};
  for (const [key, [it, en]] of Object.entries(ENERGY_UI_SOURCE)) copy[key] = pick(it, en, locale);
  return copy;
}

/* An Energy source label is authored in Italian; `ENERGY_EN` is its English
 * pivot, which is what the catalogs are keyed by. */
function energyLabel(italian, locale) {
  return pick(italian, ENERGY_EN[italian] || italian, locale);
}

export function createEntityPickerField(
  document,
  {
    id = "dm-energy-entity",
    value = "",
    placeholder = "",
    label = "Entità",
    locale = "it",
    state,
    unit = "",
    onPick,
    onChange,
  } = {},
) {
  const copy = energyCopy(locale);
  const field = document.createElement("span");
  field.className = "dm-entity-field";
  field.dataset.entityField = "";
  const row = document.createElement("span");
  row.className = "ed-form-row";
  const input = document.createElement("input");
  input.id = id;
  input.className = "ed-input ed-slot-in mono";
  input.dataset.entityInput = "true";
  input.value = value;
  input.placeholder = placeholder;
  const picker = document.createElement("button");
  picker.type = "button";
  picker.className = "dm-entity-picker";
  picker.dataset.entityTarget = input.id;
  picker.dataset.pickerMounted = "true";
  picker.textContent = "🔍";
  picker.setAttribute("aria-label", `${copy.select} ${label}`);
  picker.addEventListener("click", () => onPick?.(input));
  input.addEventListener("change", () => onChange?.(input.value, input));
  row.append(input, picker);
  field.append(row);
  if (value && state != null) {
    const preview = document.createElement("output");
    preview.className = "ed-row-old dm-entity-preview";
    preview.textContent = `${state}${unit ? ` ${unit}` : ""}`;
    field.append(preview);
  }
  return { field, input, picker };
}

export function renderEnergyEditor(
  document,
  target,
  model = {},
  appliances = [],
  states = {},
  locale = "it",
  handlers = {},
) {
  const copy = energyCopy(locale);
  const root = typeof target === "string" ? document.querySelector(target) : target;
  if (!root) return;
  root.replaceChildren();
  root.classList.add("ed-list");
  root.dataset.editor = "energy";
  const tabs = document.createElement("div");
  tabs.className = "ed-inner-tabs";
  const flowsButton = document.createElement("button");
  flowsButton.className = "ed-inner-tab active";
  flowsButton.type = "button";
  flowsButton.textContent = pick("FLUSSI ED ENTITÀ", "FLOWS & ENTITIES", locale);
  const settingsButton = document.createElement("button");
  settingsButton.className = "ed-inner-tab";
  settingsButton.type = "button";
  settingsButton.textContent = pick("IMPOSTAZIONI", "SETTINGS", locale);
  const loadsButton = document.createElement("button");
  loadsButton.className = "ed-inner-tab";
  loadsButton.type = "button";
  // The panel configures the circles under Home and the devices inside each
  // one, so it is named after both rather than after the internal word "loads".
  loadsButton.textContent = pick("CARICHI E DISPOSITIVI", "LOADS & DEVICES", locale);
  const reportButton = document.createElement("button");
  reportButton.className = "ed-inner-tab";
  reportButton.type = "button";
  reportButton.textContent = "REPORT";
  const flows = document.createElement("section");
  flows.dataset.energyPanel = "flows";
  const intro = document.createElement("p");
  intro.className = "ed-intro dm-energy-recorder-explanation";
  intro.textContent = pick(
    "Per ogni sorgente, Contatore energia totale è il sensore cumulativo Recorder (normalmente state_class: total_increasing). Non è un valore di periodo: giorno, mese e anno sono calcolati come somma Recorder finale meno somma Recorder iniziale, preservando i reset. I sensori di periodo sono override facoltativi del periodo corrente.",
    "For every source, Total energy meter is the cumulative Recorder source (normally state_class: total_increasing). It is not a period value: day, month and year are calculated as final Recorder sum minus initial Recorder sum, so meter resets are preserved. Period sensors are optional current-period overrides.",
    locale,
  );
  flows.append(intro);
  const settings = document.createElement("section");
  settings.dataset.energyPanel = "settings";
  settings.hidden = true;
  const loads = document.createElement("section");
  loads.dataset.energyPanel = "loads";
  loads.hidden = true;
  const report = document.createElement("section");
  report.dataset.energyPanel = "report";
  report.hidden = true;
  const selectTab = (name) => {
    flows.hidden = name !== "flows";
    settings.hidden = name !== "settings";
    loads.hidden = name !== "loads";
    report.hidden = name !== "report";
    flowsButton.classList.toggle("active", name === "flows");
    settingsButton.classList.toggle("active", name === "settings");
    loadsButton.classList.toggle("active", name === "loads");
    reportButton.classList.toggle("active", name === "report");
    handlers.onTabChange?.(name);
  };
  flowsButton.addEventListener("click", () => selectTab("flows"));
  settingsButton.addEventListener("click", () => selectTab("settings"));
  loadsButton.addEventListener("click", () => selectTab("loads"));
  reportButton.addEventListener("click", () => selectTab("report"));
  tabs.append(flowsButton, loadsButton, reportButton, settingsButton);
  root.append(tabs, flows, loads, report, settings);
  ENERGY_GROUPS.forEach(([group, title, fields], groupIndex) => {
    const block = document.createElement("details");
    block.className = "ed-acc";
    block.open = groupIndex === 0;
    const heading = document.createElement("summary");
    heading.className = "ed-acc-head";
    const configured = fields.filter(([key]) => Boolean(model[group]?.[key])).length;
    heading.innerHTML = `<span>${ENERGY_ICONS[group]} ${energyLabel(title, locale)}</span><small>${configured}/${fields.length} ${copy.configured}</small>`;
    block.append(heading);
    const body = document.createElement("div");
    body.className = "ed-acc-body";
    for (const [key, sourceLabel, unit, example] of fields) {
      const label = energyLabel(sourceLabel, locale);
      const field = document.createElement("label");
      field.className = "ed-slot";
      field.innerHTML = `<span class="ed-slot-lbl">${label} <span class="ed-acc-n">${unit}</span> <span class="ed-acc-n">${copy.optional}</span></span><span class="ed-hint">${copy.entityHint} ${example}</span>`;
      if (key.startsWith("total_") || key === "total_energy")
        field.dataset.energyTotalField = "true";
      const { field: entity, input } = createEntityPickerField(document, {
        id:
          key === "power" && (groupIndex === 2 || groupIndex === 5)
            ? `dm-energy-${group}-${key}-${groupIndex}`
            : `dm-energy-${group}-${key}`,
        value: model[group]?.[key] || "",
        placeholder: example,
        label,
        locale,
        state: states[model[group]?.[key] || ""]?.state,
        unit,
        onPick: handlers.onPick,
        onChange: (value) => handlers.onChange?.(group, key, value),
      });
      input.name = `${group}.${key}`;
      input.dataset.validation = !input.value || states[input.value] ? "valid" : "invalid";
      field.append(entity);
      body.append(field);
    }
    block.append(body);
    flows.append(block);
  });
  const actions = document.createElement("div");
  actions.className = "ed-action-bar";
  actions.dataset.energyActions = "";
  actions.dataset.state = "clean";
  const save = document.createElement("button");
  save.type = "button";
  save.className = "ed-save-btn";
  save.dataset.energySave = "";
  save.disabled = true;
  save.textContent = copy.save;
  const status = document.createElement("output");
  status.dataset.energyStatus = "";
  status.textContent = copy.clean;
  actions.append(save, status);
  flows.append(actions);
  const dirty = () => {
    actions.dataset.state = "dirty";
    save.disabled = false;
    status.textContent = copy.dirty;
  };
  flows.addEventListener("input", dirty);
  flows.addEventListener("change", dirty);
  save.addEventListener("click", () => handlers.onSave?.({ actions, save, status }));
  handlers.renderLoads?.(loads);
  handlers.renderReport?.(report);
  handlers.renderSettings?.(settings);
  selectTab(handlers.initialTab || "flows");
}

export function loadPopupMetrics(load, states = {}, costPerKwh = 0) {
  const definitions = [
    ["power", load.power_entity, "W"],
    ["daily", load.daily_energy_entity, "kWh"],
    ["monthly", load.monthly_energy_entity, "kWh"],
    ["total", load.total_energy_entity, "kWh"],
  ];
  const values = definitions
    .filter(([, entity]) => entity)
    .map(([key, entity, unit]) => ({ key, ...metric(states, entity, unit) }));
  const monthly = values.find((value) => value.key === "monthly")?.value;
  if (monthly != null)
    values.push({ key: "cost", entity: "", value: monthly * Number(costPerKwh || 0), unit: "€" });
  return values;
}
