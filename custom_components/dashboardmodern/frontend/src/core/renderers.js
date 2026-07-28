import { getDeviceDisplayName, getDeviceVisual } from "./device-model.js";

export function createRenderCoordinator(store, renderers = {}) {
  const call = (name, ...args) => typeof renderers[name] === "function" && renderers[name](...args);
  return store.subscribe((change) => {
    call("renderSection", change.section, change);
    const names = { appliances: "renderAppliances", cameras: "renderCameras", lights: "renderLights" };
    call(names[change.section], change);
    if (change.section === "appliances" || change.section === "energy") call("renderEnergyReport", change);
    if (change.section === "rooms") {
      call("renderRoomSelectors", change); call("renderLights", change); call("renderAppliances", change);
    }
    if (change.visibilityChanged) call("renderNavbar", change);
  });
}

export function renderDeviceCard(document, target, device, states = {}, rooms = [], locale = "it") {
  const root = typeof target === "string" ? document.querySelector(target) : target;
  if (!root) return null;
  const visual = getDeviceVisual(device); const card = document.createElement("article");
  card.className = "dm-device-card"; card.dataset.deviceId = device.id;
  const room = rooms.find((value) => value.id === device.room_id);
  const media = document.createElement(visual.kind === "image" ? "img" : "span");
  media.className = "dm-device-visual";
  if (visual.kind === "image") { media.src = visual.value; media.alt = ""; } else media.dataset.icon = visual.value;
  const title = document.createElement("strong"); title.textContent = getDeviceDisplayName(device, states, locale);
  const category = document.createElement("small"); category.textContent = device.device_type || device.section;
  const roomLabel = document.createElement("small"); roomLabel.textContent = room?.name || "";
  card.append(media, title, category, roomLabel); root.append(card); return card;
}

const ENERGY_GROUPS = [
  ["Casa", [["power", "Potenza istantanea", "W", "sensor.casa_power"], ["daily_energy", "Energia giornaliera", "kWh", "sensor.casa_oggi"], ["monthly_energy", "Energia mensile", "kWh", "sensor.casa_mese"], ["total_energy", "Energia totale", "kWh", "sensor.casa_totale"]]],
  ["Rete", [["import_power", "Potenza prelevata", "W", "sensor.rete_prelievo"], ["export_power", "Potenza immessa", "W", "sensor.rete_immissione"], ["import_energy", "Energia prelevata", "kWh", "sensor.rete_energia"], ["export_energy", "Energia immessa", "kWh", "sensor.rete_resa"]]],
  ["Fotovoltaico", [["solar_power", "Potenza", "W", "sensor.fv_power"], ["solar_daily", "Energia giornaliera", "kWh", "sensor.fv_oggi"], ["solar_monthly", "Energia mensile", "kWh", "sensor.fv_mese"], ["solar_total", "Energia totale", "kWh", "sensor.fv_totale"]]],
  ["Batteria", [["battery_power", "Potenza", "W", "sensor.batteria_power"], ["battery_soc", "SOC", "%", "sensor.batteria_soc"], ["battery_charged", "Energia caricata", "kWh", "sensor.batteria_caricata"], ["battery_discharged", "Energia scaricata", "kWh", "sensor.batteria_scaricata"]]],
];

export function renderEnergyEditor(document, target, model = {}, appliances = [], states = {}, locale = "it") {
  const root = typeof target === "string" ? document.querySelector(target) : target; if (!root) return;
  root.replaceChildren(); root.classList.add("dm-energy-editor");
  for (const [title, fields] of ENERGY_GROUPS) {
    const block = document.createElement("section"); block.className = "dm-energy-block";
    const heading = document.createElement("h3"); heading.textContent = title; block.append(heading);
    for (const [key, label, unit, example] of fields) {
      const field = document.createElement("label"); field.className = "dm-energy-field";
      field.innerHTML = `<span>${label} <small>Facoltativo · ${unit}</small></span><em>Entità Home Assistant, es. ${example}</em>`;
      const row = document.createElement("span"); row.className = "dm-energy-input";
      const input = document.createElement("input"); input.name = key; input.value = model[key] || ""; input.placeholder = example;
      input.dataset.validation = !input.value || states[input.value] ? "valid" : "invalid";
      const preview = document.createElement("output"); preview.textContent = states[input.value]?.state ?? "—";
      const pick = document.createElement("button"); pick.type = "button"; pick.textContent = "🔍"; pick.setAttribute("aria-label", `Seleziona ${label}`);
      row.append(input, pick, preview); field.append(row); block.append(field);
    } root.append(block);
  }
  const appliancesBlock = document.createElement("section"); appliancesBlock.className = "dm-energy-block";
  const heading = document.createElement("h3"); heading.textContent = locale === "it" ? "Elettrodomestici" : "Appliances"; appliancesBlock.append(heading);
  appliances.forEach((device) => renderDeviceCard(document, appliancesBlock, device, states, [], locale)); root.append(appliancesBlock);
}
