/* DashboardModern 0.14.17: stable Energy periods and focused UI decorators. */
const UI_0157_KEY = "__DASHBOARDMODERN_RELEASE_0157_UI_STABILITY__";
const FINAL_RUNTIME_0156_KEY = "__DASHBOARDMODERN_RELEASE_0156_FINAL_RUNTIME__";
const KPI_IDS_0157 = ["ed-kpi-prod", "ed-kpi-cons", "ed-kpi-auto"];
const ENERGY_SOURCES_0157 = [
  ["prod", "solar", "total_energy", "monthly_energy"],
  ["cons", "house", "total_energy", "monthly_energy"],
  ["grid", "grid", "total_import_energy", "monthly_import_energy"],
];

function state0157() {
  return (globalThis[UI_0157_KEY] ||= {
    installed: false,
    generation: 0,
    refreshTimer: 0,
    finishTimer: 0,
    wrapperTimer: 0,
    kpiObserver: null,
    snapshots: new Map(),
    selectedRoomId: "",
    transitioning: false,
    committing: false,
    decorating: false,
  });
}

const english0157 = () => globalThis.document?.documentElement?.lang === "en";
const t0157 = (it, en) => (english0157() ? en : it);

function slug0157(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function number0157(value) {
  const parsed = Number.parseFloat(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function format0157(value, digits = 1) {
  return new Intl.NumberFormat(english0157() ? "en-GB" : "it-IT", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function selectedPeriod0157() {
  const now = new Date();
  const month = Number(document.getElementById("ed-sel-month")?.value);
  const year = Number(document.getElementById("ed-sel-year")?.value);
  return {
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : now.getMonth() + 1,
    year: Number.isInteger(year) && year >= 2000 ? year : now.getFullYear(),
  };
}

function section0157(name, fallback) {
  try {
    const value = globalThis.DashboardModernModules?.store?.getSection?.(name);
    return value ?? fallback;
  } catch (_error) {
    return fallback;
  }
}

const rooms0157 = () => {
  const value = section0157("rooms", []);
  return Array.isArray(value) ? value : [];
};
const appliances0157 = () => {
  const value = section0157("appliances", []);
  return Array.isArray(value) ? value : [];
};

function energySources0157() {
  const energy = section0157("energy", {});
  return ENERGY_SOURCES_0157.map(([key, group, totalKey, monthlyKey]) => ({
    key,
    entity: String(energy?.[group]?.[totalKey] || energy?.[group]?.[monthlyKey] || "").trim(),
  })).filter(({ entity }) => entity);
}

function kpiNode0157(id) {
  return document.getElementById(id);
}

function captureKpis0157() {
  const runtime = state0157();
  runtime.snapshots.clear();
  KPI_IDS_0157.forEach((id) => {
    const node = kpiNode0157(id);
    if (node) runtime.snapshots.set(id, node.innerHTML);
  });
}

function restoreKpis0157() {
  const runtime = state0157();
  if (!runtime.transitioning || runtime.committing) return;
  runtime.committing = true;
  try {
    runtime.snapshots.forEach((html, id) => {
      const node = kpiNode0157(id);
      if (node && node.innerHTML !== html) node.innerHTML = html;
    });
  } finally {
    runtime.committing = false;
  }
}

function observeKpis0157() {
  const runtime = state0157();
  runtime.kpiObserver?.disconnect?.();
  if (typeof MutationObserver !== "function") return;
  runtime.kpiObserver = new MutationObserver(() => {
    if (!runtime.committing) queueMicrotask(restoreKpis0157);
  });
  KPI_IDS_0157.forEach((id) => {
    const node = kpiNode0157(id);
    if (node) runtime.kpiObserver.observe(node, { childList: true, subtree: true, characterData: true });
  });
}

function energyPage0157() {
  const overview = document.getElementById("view-panoramica");
  if (overview) return overview;
  return (
    kpiNode0157("ed-kpi-prod")?.closest?.(".flow-view,.page") ||
    document.getElementById("page-energy") ||
    document.getElementById("page-energia") ||
    null
  );
}

function energyStatus0157() {
  const page = energyPage0157();
  if (!page) return null;
  let status = page.querySelector("[data-dm-period-loading-0157]");
  if (!status) {
    status = document.createElement("div");
    status.className = "dm-period-loading-0157";
    status.dataset.dmPeriodLoading0157 = "";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.innerHTML = `<span aria-hidden="true"></span><strong>${t0157("Aggiornamento mese…", "Updating month…")}</strong>`;
    page.prepend(status);
  }
  return status;
}

function beginEnergyTransition0157() {
  const runtime = state0157();
  const page = energyPage0157();
  if (!page) return false;
  if (!runtime.transitioning) {
    runtime.transitioning = true;
    captureKpis0157();
  }
  observeKpis0157();
  page.classList.add("dm-period-loading-active-0157");
  page.setAttribute("aria-busy", "true");
  const status = energyStatus0157();
  if (status) status.hidden = false;
  return true;
}

function finishEnergyTransition0157(generation) {
  const runtime = state0157();
  clearTimeout(runtime.finishTimer);
  runtime.finishTimer = setTimeout(() => {
    if (generation !== runtime.generation) return;
    runtime.kpiObserver?.disconnect?.();
    runtime.kpiObserver = null;
    runtime.transitioning = false;
    runtime.snapshots.clear();
    const page = energyPage0157();
    page?.classList.remove("dm-period-loading-active-0157");
    page?.removeAttribute("aria-busy");
    const status = page?.querySelector?.("[data-dm-period-loading-0157]");
    if (status) status.hidden = true;
  }, 240);
}

function commitEnergy0157(values, generation) {
  const runtime = state0157();
  if (generation !== runtime.generation) return false;
  const production = values.get("prod");
  const consumption = values.get("cons");
  const imported = values.get("grid");
  const autonomy =
    Number.isFinite(consumption) && consumption > 0 && Number.isFinite(imported)
      ? Math.max(0, Math.min(100, Math.round(((consumption - imported) / consumption) * 100)))
      : null;

  runtime.kpiObserver?.disconnect?.();
  runtime.committing = true;
  try {
    if (Number.isFinite(production) && kpiNode0157("ed-kpi-prod")) {
      kpiNode0157("ed-kpi-prod").innerHTML = `${format0157(production)} <small>kWh</small>`;
    }
    if (Number.isFinite(consumption) && kpiNode0157("ed-kpi-cons")) {
      kpiNode0157("ed-kpi-cons").innerHTML = `${format0157(consumption)} <small>kWh</small>`;
    }
    if (Number.isFinite(autonomy) && kpiNode0157("ed-kpi-auto")) {
      kpiNode0157("ed-kpi-auto").innerHTML = `${autonomy} <small>%</small>`;
    }
    captureKpis0157();
  } finally {
    runtime.committing = false;
  }
  observeKpis0157();
  return true;
}

async function refreshEnergy0157(generation) {
  const runtime0156 = globalThis[FINAL_RUNTIME_0156_KEY];
  if (generation !== state0157().generation || typeof runtime0156?.monthValues !== "function") {
    finishEnergyTransition0157(generation);
    return false;
  }
  const sources = energySources0157();
  if (!sources.length) {
    restoreKpis0157();
    finishEnergyTransition0157(generation);
    return false;
  }
  const { month, year } = selectedPeriod0157();
  try {
    const periodValues = await runtime0156.monthValues(
      sources.map(({ entity }) => entity),
      month,
      year,
    );
    if (generation !== state0157().generation) return false;
    const values = new Map();
    sources.forEach(({ key, entity }) => {
      const value = periodValues.get(entity);
      if (Number.isFinite(value)) values.set(key, value);
    });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    commitEnergy0157(values, generation);
    finishEnergyTransition0157(generation);
    return true;
  } catch (error) {
    console.warn("[DashboardModern] stable period refresh", error);
    restoreKpis0157();
    finishEnergyTransition0157(generation);
    return false;
  }
}

function scheduleEnergyRefresh0157() {
  const runtime = state0157();
  const generation = ++runtime.generation;
  clearTimeout(runtime.refreshTimer);
  beginEnergyTransition0157();
  runtime.refreshTimer = setTimeout(() => refreshEnergy0157(generation), 90);
}

function roomForAppliance0157(item, rooms = rooms0157()) {
  const references = [item?.room_id, item?.roomId, item?.room]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  for (const reference of references) {
    const lower = reference.toLowerCase();
    const token = slug0157(reference).replace(/^room-/, "");
    const found = rooms.find((room) =>
      String(room?.id || "") === reference ||
      String(room?.id || "").toLowerCase() === lower ||
      String(room?.name || "").toLowerCase() === lower ||
      slug0157(room?.id).replace(/^room-/, "") === token ||
      slug0157(room?.name).replace(/^room-/, "") === token,
    );
    if (found) return found;
  }
  return null;
}

function rawState0157(entity) {
  const id = String(entity || "").trim();
  if (!id) return null;
  try {
    if (typeof _RAW_STATES !== "undefined" && _RAW_STATES?.[id]) return _RAW_STATES[id];
  } catch (_error) {}
  return globalThis._RAW_STATES?.[id] || globalThis.STATES?.[id] || null;
}

function itemEntities0157(item) {
  return [...new Set([
    item?.power_entity,
    item?.power,
    item?.energy_entity,
    item?.total_energy_entity,
    item?.monthly_energy_entity,
    item?.report_entity,
    ...(Array.isArray(item?.entities) ? item.entities : []),
  ].map((value) => (typeof value === "string" ? value : value?.entity)).filter(Boolean))];
}

function metricEntity0157(item, kind) {
  return itemEntities0157(item).find((entity) => {
    const state = rawState0157(entity);
    const unit = String(state?.attributes?.unit_of_measurement || "").trim().toLowerCase().replaceAll(" ", "");
    const deviceClass = String(state?.attributes?.device_class || "").toLowerCase();
    return kind === "energy"
      ? deviceClass === "energy" || /^(wh|kwh|mwh)$/.test(unit)
      : deviceClass === "power" || /^(w|kw|mw)$/.test(unit);
  }) || "";
}

function metricValue0157(entity, kind) {
  const state = rawState0157(entity);
  const value = number0157(state?.state);
  if (value == null) return "—";
  const rawUnit = String(state?.attributes?.unit_of_measurement || (kind === "energy" ? "kWh" : "W")).trim();
  let normalized = value;
  let unit = rawUnit;
  if (kind === "energy" && rawUnit.toLowerCase() === "wh") {
    normalized = value / 1000;
    unit = "kWh";
  }
  if (kind === "power" && rawUnit.toLowerCase() === "kw") {
    normalized = value * 1000;
    unit = "W";
  }
  const digits = kind === "energy" ? 2 : normalized >= 100 ? 0 : 1;
  return `${format0157(normalized, digits)} ${unit}`;
}

function existingEnergyValue0157(card) {
  const values = [...card.querySelectorAll(".appl-mini")]
    .map((node) => String(node.textContent || "").trim())
    .filter((value) => /(?:wh|kwh|mwh)(?:\s|$)/i.test(value));
  const match = values[values.length - 1]?.match(/(-?\d+(?:[.,]\d+)?)\s*(kwh|mwh|wh)/i);
  return match ? `${match[1]} ${match[2]}` : "";
}

function decorateApplianceCard0157(card, item) {
  if (!card || !item) return;
  const room = roomForAppliance0157(item);
  card.dataset.applianceId = String(item.id || card.dataset.applianceId || "");
  card.dataset.roomId = String(room?.id || "");
  const roomLabel = card.querySelector(".appl-wide-cat");
  const roomText = room ? `🏠 ${room.name}` : t0157("Senza stanza", "No room");
  if (roomLabel && roomLabel.textContent !== roomText) roomLabel.textContent = roomText;

  const host = card.querySelector(".appl-live") || card.querySelector(".appl-wide-info") || card;
  const energyEntity = metricEntity0157(item, "energy");
  const powerEntity = metricEntity0157(item, "power");
  const energyValue = energyEntity ? metricValue0157(energyEntity, "energy") : existingEnergyValue0157(card) || "—";
  const powerValue = powerEntity ? metricValue0157(powerEntity, "power") : "";
  card.querySelectorAll(".appl-mini").forEach((node) => {
    node.classList.add("dm-legacy-appliance-metric-0157");
    node.setAttribute("aria-hidden", "true");
  });
  let metrics = card.querySelector(".dm-appliance-metrics-0157");
  if (!metrics) {
    metrics = document.createElement("div");
    metrics.className = "dm-appliance-metrics-0157";
    host.append(metrics);
  }
  const signature = `${energyValue}|${powerValue}`;
  if (metrics.dataset.signature !== signature) {
    metrics.dataset.signature = signature;
    metrics.innerHTML = `<span class="dm-appliance-metric-0157"><small>${t0157("Consumo totale", "Total energy")}</small><strong>${energyValue}</strong></span>${powerValue ? `<span class="dm-appliance-metric-0157"><small>${t0157("Adesso", "Now")}</small><strong>${powerValue}</strong></span>` : ""}`;
  }
}

function applyRoomFilter0157() {
  const runtime = state0157();
  const page = document.getElementById("page-appliances-main");
  if (!page) return;
  page.querySelectorAll(".appl-wide-card[data-appliance-id]").forEach((card) => {
    card.hidden = runtime.selectedRoomId === "__unassigned__"
      ? Boolean(card.dataset.roomId)
      : Boolean(runtime.selectedRoomId) && card.dataset.roomId !== runtime.selectedRoomId;
  });
  page.querySelectorAll("[data-dm-appliance-room-0157]").forEach((button) => {
    const active = button.dataset.dmApplianceRoom0157 === runtime.selectedRoomId;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function roomNav0157(page) {
  const existing = [...page.querySelectorAll("#dm-appliance-room-nav-0157,.dm-appliance-room-nav-0157")];
  const nav = existing.shift();
  existing.forEach((node) => node.remove());
  if (nav) return nav;
  const created = document.createElement("nav");
  created.id = "dm-appliance-room-nav-0157";
  created.className = "dm-appliance-room-nav-0157";
  created.setAttribute("aria-label", t0157("Filtra per stanza", "Filter by room"));
  const cards = page.querySelector(".appl-wide-card");
  if (cards) cards.before(created);
  else page.prepend(created);
  return created;
}

function rebuildRoomNav0157(items) {
  const page = document.getElementById("page-appliances-main");
  if (!page) return;
  const rooms = rooms0157();
  const groups = rooms.map((room) => ({
    room,
    count: items.filter((item) => roomForAppliance0157(item, rooms)?.id === room.id).length,
  })).filter(({ count }) => count > 0);
  const unassigned = items.filter((item) => !roomForAppliance0157(item, rooms)).length;
  const nav = roomNav0157(page);
  const signature = `${groups.map(({ room, count }) => `${room.id}:${count}`).join("|")}|${unassigned}`;
  if (nav.dataset.signature === signature) {
    applyRoomFilter0157();
    return;
  }
  nav.dataset.signature = signature;
  nav.replaceChildren();
  const add = (roomId, label, count) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.dmApplianceRoom0157 = roomId;
    button.innerHTML = `<span>${label}</span><small>${count}</small>`;
    button.addEventListener("click", () => {
      state0157().selectedRoomId = roomId;
      applyRoomFilter0157();
    });
    nav.append(button);
  };
  add("", `📊 ${t0157("Panoramica", "Overview")}`, items.length);
  groups.forEach(({ room, count }) => add(String(room.id || ""), `🏠 ${room.name}`, count));
  if (unassigned) add("__unassigned__", `❔ ${t0157("Senza stanza", "No room")}`, unassigned);
  const valid = new Set(["", "__unassigned__", ...groups.map(({ room }) => String(room.id || ""))]);
  if (!valid.has(state0157().selectedRoomId)) state0157().selectedRoomId = "";
  applyRoomFilter0157();
}

function decorateAppliances0157() {
  const page = document.getElementById("page-appliances-main");
  if (!page) return false;
  const items = appliances0157();
  const byId = new Map(items.map((item) => [String(item.id || ""), item]));
  page.querySelectorAll(".appl-wide-card").forEach((card, index) => {
    const id = String(card.dataset.applianceId || "");
    const name = String(card.querySelector(".appl-wide-name")?.textContent || "").trim().toLowerCase();
    const item = byId.get(id) || items.find((candidate) => String(candidate.name || "").trim().toLowerCase() === name) || items[index];
    if (item) decorateApplianceCard0157(card, item);
  });
  if (page.querySelector(".appl-wide-card")) rebuildRoomNav0157(items);
  return true;
}

function comfort0157(temperature) {
  if (temperature == null) return { key: "unknown", label: "—" };
  if (temperature < 16) return { key: "cold", label: t0157("Freddo", "Cold") };
  if (temperature < 19) return { key: "cool", label: t0157("Fresco", "Cool") };
  if (temperature <= 24) return { key: "comfort", label: "Comfort" };
  if (temperature <= 27) return { key: "warm", label: t0157("Tiepido", "Warm") };
  if (temperature <= 32) return { key: "hot", label: t0157("Caldo", "Hot") };
  return { key: "very-hot", label: t0157("Molto caldo", "Very hot") };
}

function roomForTemperatureCard0157(card, index) {
  const rooms = rooms0157();
  const id = String(card.dataset.roomId || "");
  const name = String(card.querySelector(".cp-name,.temp-room-name")?.textContent || "").trim().toLowerCase();
  return rooms.find((room) => String(room.id || "") === id) ||
    rooms.find((room) => String(room.name || "").trim().toLowerCase() === name) ||
    rooms[index] || null;
}

function temperatureIcon0157(card, room) {
  const original = card.querySelector(".temp-room-icon,.dm-room-icon-0151");
  if (original?.innerHTML) return original.innerHTML;
  try {
    const markup = globalThis.cdIconMarkup?.(room?.icon || "mdi:home-thermometer", 32);
    if (markup) return markup;
  } catch (_error) {}
  return "🏠";
}

function decorateTemperatures0157() {
  const grid = document.getElementById("temp-grid");
  if (!grid) return false;
  grid.querySelectorAll(".temp-card").forEach((card, index) => {
    const room = roomForTemperatureCard0157(card, index);
    if (!room) return;
    const temperature = number0157(card.querySelector("[id^='tv_'],.temp-value")?.textContent);
    const humidity = number0157(card.querySelector("[id^='hv_'],.humidity-value,.hum-value")?.textContent);
    const comfort = comfort0157(temperature);
    card.dataset.roomId = String(room.id || "");
    card.classList.add("dm-temperature-card-0157-ready");
    const legacyComfort = card.querySelector("[id^='tc_']");
    if (legacyComfort) legacyComfort.textContent = comfort.label;
    let content = card.querySelector(":scope > .dm-temperature-card-0157");
    if (!content) {
      content = document.createElement("div");
      content.className = "dm-temperature-card-0157";
      card.append(content);
    }
    const signature = `${room.id}|${temperature}|${humidity}|${comfort.key}`;
    if (content.dataset.signature !== signature) {
      content.dataset.signature = signature;
      content.innerHTML = `<header><span class="dm-temperature-room-icon-0157">${temperatureIcon0157(card, room)}</span><span class="dm-temperature-room-title-0157"><strong>${room.name}</strong><small>${t0157("Clima ambiente", "Room climate")}</small></span><span class="dm-temperature-status-0157" data-status="${comfort.key}">${comfort.label}</span></header><div class="dm-temperature-values-0157"><span><small>${t0157("Temperatura", "Temperature")}</small><strong>${temperature == null ? "—" : format0157(temperature)}<em>°C</em></strong></span><span><small>${t0157("Umidità", "Humidity")}</small><strong>${humidity == null ? "—" : format0157(humidity, 0)}<em>%</em></strong></span></div>`;
    }
  });
  return true;
}

function decorateAll0157() {
  const runtime = state0157();
  if (runtime.decorating) return;
  runtime.decorating = true;
  try {
    decorateAppliances0157();
    decorateTemperatures0157();
  } finally {
    runtime.decorating = false;
  }
}

function chainHas0157(fn, marker) {
  const seen = new Set();
  let current = fn;
  while (typeof current === "function" && !seen.has(current)) {
    if (current[marker]) return true;
    seen.add(current);
    current = current.__dmPrevious;
  }
  return false;
}

function wrapAfterRender0157(name, callback, marker) {
  const current = globalThis[name];
  if (typeof current !== "function" || chainHas0157(current, marker)) return false;
  function wrapped0157(...args) {
    const result = current.apply(this, args);
    const finish = () => queueMicrotask(callback);
    if (result && typeof result.finally === "function") return result.finally(finish);
    finish();
    return result;
  }
  wrapped0157[marker] = true;
  wrapped0157.__dmPrevious = current;
  globalThis[name] = wrapped0157;
  return true;
}

function installWrappers0157() {
  const appliance =
    wrapAfterRender0157("renderApplianceSection", decorateAppliances0157, "__dm0157ApplianceUi") ||
    wrapAfterRender0157("renderAppliances", decorateAppliances0157, "__dm0157ApplianceUi");
  const temperature =
    wrapAfterRender0157("buildTempCards", decorateTemperatures0157, "__dm0157TemperatureUi") ||
    wrapAfterRender0157("renderTemperature", decorateTemperatures0157, "__dm0157TemperatureUi");
  return appliance && temperature;
}

function injectStyles0157() {
  if (document.getElementById("dm-release-0157-styles")) return;
  const style = document.createElement("style");
  style.id = "dm-release-0157-styles";
  style.textContent = `
    #view-panoramica { position: relative; }
    .dm-period-loading-0157 { position: sticky; top: 10px; z-index: 8; width: fit-content; margin: 0 auto 12px; display: inline-flex; align-items: center; gap: 9px; padding: 9px 14px; border: 1px solid rgba(14,165,233,.22); border-radius: 999px; color: #0369a1; background: rgba(240,249,255,.96); box-shadow: 0 8px 24px rgba(14,165,233,.14); font-size: 12px; font-weight: 800; }
    .dm-period-loading-0157[hidden] { display: none !important; }
    .dm-period-loading-0157 > span { width: 13px; height: 13px; border: 2px solid rgba(14,165,233,.25); border-top-color: #0ea5e9; border-radius: 50%; animation: dm-period-spin-0157 .75s linear infinite; }
    .dm-period-loading-active-0157 #ed-kpi-prod,.dm-period-loading-active-0157 #ed-kpi-cons,.dm-period-loading-active-0157 #ed-kpi-auto { opacity: .72; }
    @keyframes dm-period-spin-0157 { to { transform: rotate(360deg); } }
    #page-appliances-main .dm-legacy-appliance-metric-0157 { display: none !important; }
    #page-appliances-main .dm-appliance-metrics-0157 { width: 100%; display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 6px; margin-top: 8px; }
    #page-appliances-main .dm-appliance-metric-0157 { min-width: 0; display: grid; gap: 2px; padding: 7px 9px; border: 1px solid rgba(14,165,233,.22); border-radius: 12px; background: rgba(240,249,255,.9); }
    #page-appliances-main .dm-appliance-metric-0157 small { overflow: hidden; color: #64748b; font-size: 9px; font-weight: 800; text-overflow: ellipsis; text-transform: uppercase; white-space: nowrap; }
    #page-appliances-main .dm-appliance-metric-0157 strong { overflow: hidden; color: #0f172a; font-size: 13px; font-weight: 900; text-overflow: ellipsis; white-space: nowrap; }
    #page-appliances-main .dm-appliance-room-nav-0157 { display: flex; gap: 8px; overflow-x: auto; padding: 4px 0 10px; }
    #page-appliances-main .dm-appliance-room-nav-0157 button { flex: 0 0 auto; min-height: 40px; display: inline-flex; align-items: center; gap: 7px; padding: 8px 12px; border: 1px solid rgba(148,163,184,.28); border-radius: 999px; background: #fff; font: inherit; font-weight: 800; }
    #page-appliances-main .dm-appliance-room-nav-0157 button.active { color: #075985; border-color: #38bdf8; background: #e0f2fe; }
    #page-appliances-main .appl-wide-card[hidden] { display: none !important; }
    #temp-grid .temp-card.dm-temperature-card-0157-ready { position: relative; padding: 0 !important; overflow: hidden; }
    #temp-grid .temp-card.dm-temperature-card-0157-ready > :not(.dm-temperature-card-0157) { position: absolute !important; width: 1px !important; height: 1px !important; overflow: hidden !important; clip-path: inset(50%) !important; white-space: nowrap !important; }
    #temp-grid .dm-temperature-card-0157 { display: grid; gap: 16px; padding: 20px; }
    #temp-grid .dm-temperature-card-0157 header { display: grid; grid-template-columns: auto minmax(0,1fr) auto; align-items: center; gap: 12px; }
    #temp-grid .dm-temperature-room-icon-0157 { width: 50px; height: 50px; display: grid; place-items: center; border-radius: 16px; background: #e0f2fe; font-size: 26px; }
    #temp-grid .dm-temperature-room-title-0157 { display: grid; gap: 2px; min-width: 0; }
    #temp-grid .dm-temperature-room-title-0157 strong { overflow: hidden; font-size: 22px; font-weight: 900; text-overflow: ellipsis; white-space: nowrap; }
    #temp-grid .dm-temperature-room-title-0157 small { color: #64748b; font-size: 10px; font-weight: 800; text-transform: uppercase; }
    #temp-grid .dm-temperature-status-0157 { padding: 7px 10px; border-radius: 999px; color: #166534; background: #dcfce7; font-size: 10px; font-weight: 900; text-transform: uppercase; }
    #temp-grid .dm-temperature-status-0157[data-status="hot"],#temp-grid .dm-temperature-status-0157[data-status="very-hot"] { color: #b91c1c; background: #fee2e2; }
    #temp-grid .dm-temperature-status-0157[data-status="cold"],#temp-grid .dm-temperature-status-0157[data-status="cool"] { color: #1d4ed8; background: #dbeafe; }
    #temp-grid .dm-temperature-values-0157 { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; }
    #temp-grid .dm-temperature-values-0157 > span { min-width: 0; display: grid; gap: 4px; padding: 14px; border-radius: 16px; background: #f8fafc; }
    #temp-grid .dm-temperature-values-0157 small { color: #64748b; font-size: 9px; font-weight: 800; text-transform: uppercase; }
    #temp-grid .dm-temperature-values-0157 strong { font-size: clamp(28px,7vw,42px); font-weight: 950; line-height: 1; }
    #temp-grid .dm-temperature-values-0157 em { margin-left: 3px; color: #64748b; font-size: .43em; font-style: normal; }
    @media (max-width:560px) { #temp-grid .dm-temperature-card-0157 header { grid-template-columns:auto minmax(0,1fr); } #temp-grid .dm-temperature-status-0157 { grid-column:1/-1; justify-self:start; } }
  `;
  document.head.append(style);
}

function install0157() {
  const runtime = state0157();
  injectStyles0157();
  installWrappers0157();
  if (!runtime.installed) {
    runtime.installed = true;
    runtime.refreshEnergy = scheduleEnergyRefresh0157;
    runtime.decorateAppliances = decorateAppliances0157;
    runtime.decorateTemperatures = decorateTemperatures0157;
    document.addEventListener("change", (event) => {
      if (event.target?.matches?.("#ed-sel-month,#ed-sel-year")) scheduleEnergyRefresh0157();
    }, true);
    globalThis.addEventListener?.("dashboardmodern:legacy-ready", () => {
      installWrappers0157();
      setTimeout(decorateAll0157, 0);
    });
    globalThis.addEventListener?.("pageshow", () => {
      installWrappers0157();
      setTimeout(decorateAll0157, 0);
    });
  }
  decorateAll0157();
  clearInterval(runtime.wrapperTimer);
  let attempts = 0;
  runtime.wrapperTimer = setInterval(() => {
    attempts += 1;
    if (installWrappers0157() || attempts >= 40) {
      clearInterval(runtime.wrapperTimer);
      runtime.wrapperTimer = 0;
      decorateAll0157();
    }
  }, 100);
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install0157, { once: true });
  else install0157();
}
