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
    if (change.section === "appliances" || change.section === "energy")
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
      ["import_power", "Potenza prelevata", "W", "sensor.rete_prelievo"],
      ["export_power", "Potenza immessa", "W", "sensor.rete_immissione"],
      ["import_energy", "Energia prelevata", "kWh", "sensor.rete_energia"],
      ["export_energy", "Energia immessa", "kWh", "sensor.rete_resa"],
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
    ],
  ],
];

const ENERGY_ICONS = { house: "🏠", grid: "🔌", solar: "☀️", battery: "🔋" };

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
  root.classList.add("ed-list", "dm-energy-editor");
  ENERGY_GROUPS.forEach(([group, title, fields], groupIndex) => {
    const block = document.createElement("details");
    block.className = "dm-energy-editor__group";
    block.open = groupIndex === 0;
    const heading = document.createElement("summary");
    heading.className = "dm-energy-editor__heading";
    const configured = fields.filter(([key]) => Boolean(model[group]?.[key])).length;
    heading.innerHTML = `<span>${ENERGY_ICONS[group]} ${title}</span><small>${configured}/${fields.length} configurati</small>`;
    block.append(heading);
    const body = document.createElement("div");
    body.className = "dm-energy-editor__body";
    for (const [key, label, unit, example] of fields) {
      const field = document.createElement("label");
      field.className = "dm-energy-editor__field";
      field.innerHTML = `<span class="dm-energy-editor__label">${label}<span class="dm-energy-editor__badges"><small>${unit}</small><small>Facoltativo</small></span></span><em>Entità Home Assistant, es. ${example}</em>`;
      const row = document.createElement("span");
      row.className = "dm-energy-editor__input-row";
      const input = document.createElement("input");
      input.name = `${group}.${key}`;
      input.value = model[group]?.[key] || "";
      input.placeholder = example;
      input.dataset.validation = !input.value || states[input.value] ? "valid" : "invalid";
      const preview = document.createElement("output");
      preview.textContent = `${locale === "it" ? "Valore" : "Value"}: ${states[input.value]?.state ?? "—"}${states[input.value]?.state != null ? ` ${unit}` : ""}`;
      const pick = document.createElement("button");
      pick.type = "button";
      pick.textContent = "🔍";
      pick.setAttribute("aria-label", `Seleziona ${label}`);
      input.addEventListener("change", () => handlers.onChange?.(group, key, input.value));
      pick.addEventListener("click", () => handlers.onPick?.(input));
      row.append(input, pick, preview);
      field.append(row);
      body.append(field);
    }
    block.append(body);
    root.append(block);
  });
  const appliancesBlock = document.createElement("section");
  appliancesBlock.className = "dm-energy-editor__report";
  const heading = document.createElement("h3");
  heading.textContent = locale === "it" ? "Elettrodomestici" : "Appliances";
  appliancesBlock.append(heading);
  appliances.forEach((device) =>
    renderDeviceCard(document, appliancesBlock, device, states, [], locale),
  );
  root.append(appliancesBlock);
}
