import { getDeviceDisplayName, getDeviceVisual } from "./device-model.js";

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
      category: device.device_type || (locale === "it" ? "Elettrodomestico" : "Appliance"),
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
    if (["appliances", "loads", "energy"].includes(change.section))
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
      ["total_energy", "Energia totale", "kWh", "sensor.casa_totale"],
    ],
  ],
  [
    "grid",
    "Rete",
    [
      ["power", "Potenza rete", "W", "sensor.rete_power"],
      ["import_power", "Potenza prelevata", "W", "sensor.rete_prelievo"],
      ["export_power", "Potenza immessa", "W", "sensor.rete_immissione"],
      ["daily_import_energy", "Energia prelevata giornaliera", "kWh", "sensor.rete_prelievo_oggi"],
      ["daily_export_energy", "Energia immessa giornaliera", "kWh", "sensor.rete_immissione_oggi"],
      ["monthly_import_energy", "Energia prelevata mensile", "kWh", "sensor.rete_prelievo_mese"],
      ["monthly_export_energy", "Energia immessa mensile", "kWh", "sensor.rete_immissione_mese"],
      ["total_import_energy", "Energia totale prelevata", "kWh", "sensor.rete_prelievo_totale"],
      ["total_export_energy", "Energia totale immessa", "kWh", "sensor.rete_immissione_totale"],
    ],
  ],
  [
    "solar",
    "Fotovoltaico",
    [
      ["power", "Potenza", "W", "sensor.fv_power"],
      ["daily_energy", "Energia giornaliera", "kWh", "sensor.fv_oggi"],
      ["monthly_energy", "Energia mensile", "kWh", "sensor.fv_mese"],
      ["total_energy", "Energia totale", "kWh", "sensor.fv_totale"],
    ],
  ],
  [
    "battery",
    "Batteria",
    [
      ["power", "Potenza", "W", "sensor.batteria_power"],
      ["soc", "SOC", "%", "sensor.batteria_soc"],
      ["charged_energy", "Energia caricata", "kWh", "sensor.batteria_caricata"],
      ["discharged_energy", "Energia scaricata", "kWh", "sensor.batteria_scaricata"],
      ["daily_charged_energy", "Caricata oggi", "kWh", "sensor.batteria_caricata_oggi"],
      ["monthly_charged_energy", "Caricata questo mese", "kWh", "sensor.batteria_caricata_mese"],
    ],
  ],
];

const ENERGY_ICONS = { house: "🏠", grid: "🔌", solar: "☀️", battery: "🔋" };

export function createEntityPickerField(
  document,
  { value = "", placeholder = "", label = "Entità", state, unit = "", onPick, onChange } = {},
) {
  const field = document.createElement("span");
  field.className = "dm-entity-field";
  const row = document.createElement("span");
  row.className = "ed-form-row";
  const input = document.createElement("input");
  input.className = "ed-input ed-slot-in mono";
  input.value = value;
  input.placeholder = placeholder;
  const picker = document.createElement("button");
  picker.type = "button";
  picker.className = "dm-entity-picker";
  picker.textContent = "🔍";
  picker.setAttribute("aria-label", `Seleziona ${label}`);
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
  flowsButton.textContent = locale === "it" ? "FLUSSI ED ENTITÀ" : "FLOWS & ENTITIES";
  const settingsButton = document.createElement("button");
  settingsButton.className = "ed-inner-tab";
  settingsButton.type = "button";
  settingsButton.textContent = locale === "it" ? "IMPOSTAZIONI" : "SETTINGS";
  const loadsButton = document.createElement("button");
  loadsButton.className = "ed-inner-tab";
  loadsButton.type = "button";
  loadsButton.textContent = locale === "it" ? "CARICHI" : "LOADS";
  const reportButton = document.createElement("button");
  reportButton.className = "ed-inner-tab";
  reportButton.type = "button";
  reportButton.textContent = "REPORT";
  const flows = document.createElement("section");
  flows.dataset.energyPanel = "flows";
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
    heading.innerHTML = `<span>${ENERGY_ICONS[group]} ${title}</span><small>${configured}/${fields.length} configurati</small>`;
    block.append(heading);
    const body = document.createElement("div");
    body.className = "ed-acc-body";
    for (const [key, label, unit, example] of fields) {
      const field = document.createElement("label");
      field.className = "ed-slot";
      field.innerHTML = `<span class="ed-slot-lbl">${label} <span class="ed-acc-n">${unit}</span> <span class="ed-acc-n">Facoltativo</span></span><span class="ed-hint">Entità Home Assistant, es. ${example}</span>`;
      const { field: entity, input } = createEntityPickerField(document, {
        value: model[group]?.[key] || "",
        placeholder: example,
        label,
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
  handlers.renderLoads?.(loads);
  handlers.renderReport?.(report);
  handlers.renderSettings?.(settings);
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
