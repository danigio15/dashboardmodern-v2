/* Repair appliance entity assignments that were lost by the previous editor. */
const DATA_REPAIR_FLAG = "__DASHBOARDMODERN_REAL_HA_0147_DATA_REPAIR__";

function normalizedToken(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function statesObject() {
  try {
    if (typeof STATES !== "undefined") return STATES;
  } catch (_error) {}
  return globalThis.STATES || {};
}

function stateInfo(entityId, state) {
  const attributes = state?.attributes || {};
  return {
    entityId,
    domain: entityId.split(".")[0],
    unit: String(attributes.unit_of_measurement || "").toLowerCase().replace(/\s+/g, ""),
    deviceClass: String(attributes.device_class || "").toLowerCase(),
    searchable: normalizedToken(`${entityId} ${attributes.friendly_name || ""}`),
  };
}

function deviceTokens(device) {
  const aliases = {
    forno: ["forno", "oven"],
    frigo: ["frigo", "frigorifero", "fridge", "refrigerator"],
    lavatrice: ["lavatrice", "washer", "washing_machine"],
    lavastoviglie: ["lavastoviglie", "dishwasher"],
    asciugatrice: ["asciugatrice", "dryer"],
    microonde: ["microonde", "microwave"],
    congelatore: ["congelatore", "freezer"],
    scaldabagno: ["scaldabagno", "boiler", "water_heater"],
  };
  const values = [device.name, device.visual_key, device.device_type, device.type]
    .map(normalizedToken)
    .filter((value) => value.length >= 3);
  values.forEach((value) => {
    (aliases[value] || []).forEach((alias) => values.push(normalizedToken(alias)));
  });
  return [...new Set(values)];
}

function belongsToDevice(info, tokens) {
  return tokens.some((token) =>
    info.searchable === token ||
    info.searchable.startsWith(`${token}_`) ||
    info.searchable.endsWith(`_${token}`) ||
    info.searchable.includes(`_${token}_`),
  );
}

function isEnergy(info) {
  return /^(wh|kwh|mwh)$/.test(info.unit) ||
    info.deviceClass === "energy" ||
    /(?:^|_)(energy|energia|kwh|consumo|consumi)(?:_|$)/.test(info.searchable);
}

function isPower(info) {
  return /^(w|kw)$/.test(info.unit) ||
    info.deviceClass === "power" ||
    /(?:^|_)(power|potenza|watt)(?:_|$)/.test(info.searchable);
}

function scoreEnergy(info) {
  let score = 0;
  if (info.deviceClass === "energy") score += 50;
  if (/^(wh|kwh|mwh)$/.test(info.unit)) score += 40;
  if (/(?:month|monthly|mese|mensile)/.test(info.searchable)) score += 20;
  if (/(?:total|totale|lifetime)/.test(info.searchable)) score += 15;
  if (/(?:day|daily|oggi|giorn)/.test(info.searchable)) score += 10;
  return score;
}

function repairCandidate(device, allStates) {
  const tokens = deviceTokens(device);
  const existing = [...new Set([
    ...(device.entities || []),
    device.control_entity,
    device.power_entity,
    device.energy_entity,
    device.daily_energy_entity,
    device.monthly_energy_entity,
    device.total_energy_entity,
    device.report_entity,
    device.history_entity,
  ].filter(Boolean))];

  const matching = Object.entries(allStates)
    .map(([entityId, state]) => stateInfo(entityId, state))
    .filter((info) => belongsToDevice(info, tokens));

  const energy = matching.filter(isEnergy).sort((a, b) => scoreEnergy(b) - scoreEnergy(a))[0]?.entityId || "";
  const power = matching.find(isPower)?.entityId || "";
  const control = matching.find((info) => /^(switch|light|input_boolean|fan)$/.test(info.domain))?.entityId || "";

  const result = {
    ...device,
    power_entity: device.power_entity || power,
    energy_entity: device.energy_entity || device.report_entity || energy,
    report_entity: device.report_entity || device.energy_entity || energy,
    history_entity: device.history_entity || device.report_entity || device.energy_entity || energy || power,
    control_entity: device.control_entity || control,
    show_in_report: device.show_in_report !== false,
  };
  result.entities = [...new Set([
    ...existing,
    result.power_entity,
    result.energy_entity,
    result.report_entity,
    result.control_entity,
  ].filter(Boolean))];
  return result;
}

function relevant(device) {
  return JSON.stringify({
    entities: device.entities || [],
    power_entity: device.power_entity || "",
    energy_entity: device.energy_entity || "",
    report_entity: device.report_entity || "",
    history_entity: device.history_entity || "",
    control_entity: device.control_entity || "",
    show_in_report: device.show_in_report !== false,
  });
}

async function repairLostApplianceEntities() {
  const store = globalThis.DashboardModernModules?.store;
  if (!store?.getSection || !store?.updateItem) return false;
  const appliances = store.getSection("appliances");
  if (!Array.isArray(appliances) || !appliances.length) return true;
  const allStates = statesObject();
  for (const device of appliances) {
    const repaired = repairCandidate(device, allStates);
    if (relevant(device) !== relevant(repaired)) {
      await store.updateItem("appliances", device.id, repaired);
    }
  }
  try {
    globalThis.cdRebuildReportDevices?.();
    globalThis.buildReportSelect?.();
  } catch (_error) {}
  return true;
}

function install() {
  if (globalThis[DATA_REPAIR_FLAG]?.installed) return;
  globalThis[DATA_REPAIR_FLAG] = { installed: true };
  let attempts = 0;
  const timer = setInterval(async () => {
    attempts += 1;
    try {
      await repairLostApplianceEntities();
    } catch (error) {
      globalThis.console?.warn?.("[DashboardModern] appliance data repair", error);
    }
    if (attempts >= 30) clearInterval(timer);
  }, 1000);
  repairLostApplianceEntities().catch(() => {});
}

if (typeof window !== "undefined") {
  install();
  window.addEventListener("dashboardmodern:legacy-ready", install);
}
