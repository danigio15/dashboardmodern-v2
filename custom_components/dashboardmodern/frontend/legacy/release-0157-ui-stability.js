/* DashboardModern 0.14.17: atomic Energy periods, room-aware appliances and clearer temperature cards. */
const UI_0157_KEY = "__DASHBOARDMODERN_RELEASE_0157_UI_STABILITY__";
const FINAL_RUNTIME_0156_KEY = "__DASHBOARDMODERN_RELEASE_0156_FINAL_RUNTIME__";
const KPI_IDS_0157 = Object.freeze(["ed-kpi-prod", "ed-kpi-cons", "ed-kpi-auto"]);
const ENERGY_SOURCES_0157 = Object.freeze([
  ["prod", "solar", "total_energy", "monthly_energy"],
  ["cons", "house", "total_energy", "monthly_energy"],
  ["grid", "grid", "total_import_energy", "monthly_import_energy"],
]);

function state0157() {
  return (globalThis[UI_0157_KEY] ||= {
    installed: false,
    generation: 0,
    refreshTimer: 0,
    finishTimer: 0,
    decorateTimer: 0,
    wrapperTimer: 0,
    kpiObserver: null,
    pageObserver: null,
    snapshots: new Map(),
    selectedRoomId: "",
    decorating: false,
    restoring: false,
  });
}

function english0157() {
  return globalThis.document?.documentElement?.lang === "en";
}

function t0157(it, en) {
  return english0157() ? en : it;
}

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
  const month = Number(globalThis.document?.getElementById?.("ed-sel-month")?.value);
  const year = Number(globalThis.document?.getElementById?.("ed-sel-year")?.value);
  return {
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : now.getMonth() + 1,
    year: Number.isInteger(year) && year >= 2000 ? year : now.getFullYear(),
  };
}

function energyConfig0157() {
  try {
    return globalThis.DashboardModernModules?.store?.getSection?.("energy") || {};
  } catch (_error) {
    return {};
  }
}

function energySources0157() {
  const energy = energyConfig0157();
  return ENERGY_SOURCES_0157.map(([key, group, totalKey, monthlyKey]) => ({
    key,
    entity: String(energy?.[group]?.[totalKey] || energy?.[group]?.[monthlyKey] || "").trim(),
  })).filter((source) => source.entity);
}

function captureKpis0157() {
  const runtime = state0157();
  runtime.snapshots.clear();
  KPI_IDS_0157.forEach((id) => {
    const node = globalThis.document?.getElementById?.(id);
    if (node) runtime.snapshots.set(id, node.innerHTML);
  });
}

function refreshKpiSnapshots0157() {
  const runtime = state0157();
  KPI_IDS_0157.forEach((id) => {
    const node = globalThis.document?.getElementById?.(id);
    if (node) runtime.snapshots.set(id, node.innerHTML);
  });
}

function restoreKpis0157() {
  const runtime = state0157();
  if (runtime.restoring) return;
  runtime.restoring = true;
  try {
    runtime.snapshots.forEach((html, id) => {
      const node = globalThis.document?.getElementById?.(id);
      if (node && node.innerHTML !== html) node.innerHTML = html;
    });
  } finally {
    runtime.restoring = false;
  }
}

function observeKpis0157() {
  const runtime = state0157();
  runtime.kpiObserver?.disconnect?.();
  if (typeof globalThis.MutationObserver !== "function") return;
  runtime.kpiObserver = new globalThis.MutationObserver(() => {
    if (!runtime.restoring) globalThis.queueMicrotask?.(restoreKpis0157);
  });
  KPI_IDS_0157.forEach((id) => {
    const node = globalThis.document?.getElementById?.(id);
    if (node) runtime.kpiObserver.observe(node, { childList: true, subtree: true, characterData: true });
  });
}

function energyPage0157() {
  return globalThis.document?.getElementById?.("view-panoramica") || null;
}

function energyStatus0157() {
  const page = energyPage0157();
  if (!page) return null;
  let status = page.querySelector("[data-dm-period-loading-0157]");
  if (!status) {
    status = globalThis.document.createElement("div");
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
  const page = energyPage0157();
  if (!page) return false;
  captureKpis0157();
  observeKpis0157();
  page.classList.add("dm-period-loading-active-0157");
  page.setAttribute("aria-busy", "true");
  const status = energyStatus0157();
  if (status) status.hidden = false;
  return true;
}

function finishEnergyTransition0157(generation) {
  const runtime = state0157();
  globalThis.clearTimeout?.(runtime.finishTimer);
  runtime.finishTimer = globalThis.setTimeout?.(() => {
    if (generation !== runtime.generation) return;
    runtime.kpiObserver?.disconnect?.();
    runtime.kpiObserver = null;
    const page = energyPage0157();
    page?.classList.remove("dm-period-loading-active-0157");
    page?.removeAttribute("aria-busy");
    const status = page?.querySelector?.("[data-dm-period-loading-0157]");
    if (status) status.hidden = true;
    runtime.snapshots.clear();
  }, 700);
}

function commitEnergy0157(values, generation) {
  const runtime = state0157();
  if (generation !== runtime.generation) return false;
  runtime.kpiObserver?.disconnect?.();

  const production = values.get("prod");
  const consumption = values.get("cons");
  const imported = values.get("grid");
  const autonomy =
    Number.isFinite(consumption) && consumption > 0 && Number.isFinite(imported)
      ? Math.max(0, Math.min(100, Math.round(((consumption - imported) / consumption) * 100)))
      : null;

  const productionNode = globalThis.document?.getElementById?.("ed-kpi-prod");
  const consumptionNode = globalThis.document?.getElementById?.("ed-kpi-cons");
  const autonomyNode = globalThis.document?.getElementById?.("ed-kpi-auto");
  if (productionNode && Number.isFinite(production)) {
    productionNode.innerHTML = `${format0157(production)} <small>kWh</small>`;
  }
  if (consumptionNode && Number.isFinite(consumption)) {
    consumptionNode.innerHTML = `${format0157(consumption)} <small>kWh</small>`;
  }
  if (autonomyNode && Number.isFinite(autonomy)) {
    autonomyNode.innerHTML = `${autonomy} <small>%</small>`;
  }

  refreshKpiSnapshots0157();
  observeKpis0157();
  return true;
}

function nextFrame0157() {
  return new Promise((resolve) => {
    if (typeof globalThis.requestAnimationFrame === "function") globalThis.requestAnimationFrame(resolve);
    else resolve();
  });
}

async function refreshEnergy0157(generation) {
  const runtime = globalThis[FINAL_RUNTIME_0156_KEY];
  if (generation !== state0157().generation || typeof runtime?.monthValues !== "function") {
    finishEnergyTransition0157(generation);
    return false;
  }
  const selected = selectedPeriod0157();
  const sources = energySources0157();
  if (!sources.length) {
    finishEnergyTransition0157(generation);
    return false;
  }
  try {
    const periodValues = await runtime.monthValues(
      sources.map((source) => source.entity),
      selected.month,
      selected.year,
    );
    if (generation !== state0157().generation) return false;
    const values = new Map();
    sources.forEach((source) => {
      const value = periodValues.get(source.entity);
      if (Number.isFinite(value)) values.set(source.key, value);
    });
    await nextFrame0157();
    commitEnergy0157(values, generation);
    finishEnergyTransition0157(generation);
    return true;
  } catch (error) {
    globalThis.console?.warn?.("[DashboardModern] stable period refresh", error);
    restoreKpis0157();
    finishEnergyTransition0157(generation);
    return false;
  }
}

function scheduleEnergyRefresh0157() {
  const runtime = state0157();
  const generation = ++runtime.generation;
  globalThis.clearTimeout?.(runtime.refreshTimer);
  beginEnergyTransition0157();
  runtime.refreshTimer = globalThis.setTimeout?.(() => refreshEnergy0157(generation), 80);
}

function rooms0157() {
  try {
    const rooms = globalThis.DashboardModernModules?.store?.getSection?.("rooms");
    return Array.isArray(rooms) ? rooms : [];
  } catch (_error) {
    return [];
  }
}

function appliances0157() {
  try {
    const items = globalThis.DashboardModernModules?.store?.getSection?.("appliances");
    return Array.isArray(items) ? items : [];
  } catch (_error) {
    return [];
  }
}

function roomForAppliance0157(item, rooms = rooms0157()) {
  const references = [item?.room_id, item?.roomId, item?.room]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  for (const reference of references) {
    const lower = reference.toLowerCase();
    const token = slug0157(reference).replace(/^room-/, "");
    const room = rooms.find((candidate) =>
      String(candidate?.id || "") === reference ||
      String(candidate?.id || "").toLowerCase() === lower ||
      String(candidate?.name || "").toLowerCase() === lower ||
      slug0157(candidate?.name).replace(/^room-/, "") === token ||
      slug0157(candidate?.id).replace(/^room-/, "") === token,
    );
    if (room) return room;
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
  return [...new Set(
    [
      item?.power_entity,
      item?.power,
      item?.energy_entity,
      item?.total_energy_entity,
      item?.monthly_energy_entity,
      item?.report_entity,
      ...(Array.isArray(item?.entities) ? item.entities : []),
    ]
      .map((value) => (typeof value === "string" ? value : value?.entity))
      .filter(Boolean),
  )];
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
  const match = values.at(-1)?.match(/(-?\d+(?:[.,]\d+)?)\s*(kwh|mwh|wh)/i);
  return match ? `${match[1]} ${match[2]}` : "";
}

function decorateApplianceCard0157(card, item) {
  if (!card || !item) return;
  const room = roomForAppliance0157(item);
  card.dataset.applianceId = String(item.id || card.dataset.applianceId || "");
  card.dataset.roomId = String(room?.id || "");
  card.dataset.roomName = String(room?.name || "");

  const roomLabel = card.querySelector(".appl-wide-cat");
  const roomText = room ? `🏠 ${room.name}` : t0157("Senza stanza", "No room");
  if (roomLabel && roomLabel.textContent !== roomText) roomLabel.textContent = roomText;

  const live = card.querySelector(".appl-live") || card.querySelector(".appl-wide-info") || card;
  const energyEntity = metricEntity0157(item, "energy");
  const powerEntity = metricEntity0157(item, "power");
  const energyValue = energyEntity
    ? metricValue0157(energyEntity, "energy")
    : existingEnergyValue0157(card) || "—";
  const powerValue = powerEntity ? metricValue0157(powerEntity, "power") : "";

  card.querySelectorAll(".appl-mini").forEach((node) => {
    node.classList.add("dm-legacy-appliance-metric-0157");
    node.setAttribute("aria-hidden", "true");
  });

  let metrics = card.querySelector(".dm-appliance-metrics-0157");
  if (!metrics) {
    metrics = globalThis.document.createElement("div");
    metrics.className = "dm-appliance-metrics-0157";
    live.append(metrics);
  }
  const signature = `${energyValue}|${powerValue}`;
  if (metrics.dataset.signature === signature) return;
  metrics.dataset.signature = signature;
  metrics.innerHTML = `<span class="dm-appliance-metric-0157 dm-appliance-energy-0157"><small>${t0157("Consumo totale", "Total energy")}</small><strong>${energyValue}</strong></span>${powerValue ? `<span class="dm-appliance-metric-0157"><small>${t0157("Adesso", "Now")}</small><strong>${powerValue}</strong></span>` : ""}`;
}

function roomFilterMatch0157(card, selectedRoomId) {
  if (!selectedRoomId) return true;
  if (selectedRoomId === "__unassigned__") return !String(card.dataset.roomId || "");
  return String(card.dataset.roomId || "") === selectedRoomId;
}

function applyRoomFilter0157() {
  const runtime = state0157();
  const page = globalThis.document?.getElementById?.("page-appliances-main");
  if (!page) return;
  page.querySelectorAll(".appl-wide-card[data-appliance-id]").forEach((card) => {
    card.hidden = !roomFilterMatch0157(card, runtime.selectedRoomId);
  });
  page.querySelectorAll("[data-dm-appliance-room-0157]").forEach((button) => {
    const active = String(button.dataset.dmApplianceRoom0157 || "") === runtime.selectedRoomId;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function exactOverviewNode0157(page) {
  return [...page.querySelectorAll("button,a,[role='button']")].find((node) =>
    /^(?:📊\s*)?(panoramica|overview)$/i.test(String(node.textContent || "").trim()),
  ) || null;
}

function roomNav0157(page) {
  let nav = page.querySelector(".dm-appliance-room-nav-0157");
  if (nav) return nav;

  const overview = exactOverviewNode0157(page);
  const legacyHost = overview?.parentElement;
  const legacyLooksLikeRoomNav = Boolean(
    legacyHost && [...legacyHost.querySelectorAll("button,a,[role='button']")].some((node) =>
      /nessuna stanza|no room|stanza|room/i.test(String(node.textContent || "")),
    ),
  );

  if (legacyLooksLikeRoomNav) {
    nav = legacyHost;
    nav.classList.add("dm-appliance-room-nav-0157");
    [...nav.querySelectorAll(":scope > button,:scope > a,:scope > [role='button']")].forEach((node) => {
      if (node !== overview) node.remove();
    });
  } else {
    nav = globalThis.document.createElement("nav");
    nav.className = "dm-appliance-room-nav-0157";
    const home = [...page.querySelectorAll("button,a,[role='button']")].find((node) =>
      /^(?:←\s*)?home$/i.test(String(node.textContent || "").trim()),
    );
    if (home?.parentElement) home.parentElement.insertAdjacentElement("afterend", nav);
    else page.prepend(nav);
  }

  nav.setAttribute("aria-label", t0157("Filtra per stanza", "Filter by room"));
  let overviewButton = overview && overview.closest(".dm-appliance-room-nav-0157") ? overview : null;
  if (!overviewButton) {
    overviewButton = globalThis.document.createElement("button");
    overviewButton.type = "button";
    overviewButton.textContent = `📊 ${t0157("Panoramica", "Overview")}`;
    nav.prepend(overviewButton);
  }
  overviewButton.dataset.dmApplianceRoom0157 = "";
  overviewButton.removeAttribute("onclick");
  if (overviewButton.dataset.dm0157Bound !== "true") {
    overviewButton.dataset.dm0157Bound = "true";
    overviewButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      state0157().selectedRoomId = "";
      applyRoomFilter0157();
    }, true);
  }
  return nav;
}

function rebuildRoomNav0157(items) {
  const page = globalThis.document?.getElementById?.("page-appliances-main");
  if (!page) return;
  const rooms = rooms0157();
  const groups = rooms
    .map((room) => ({
      room,
      count: items.filter((item) => roomForAppliance0157(item, rooms)?.id === room.id).length,
    }))
    .filter((group) => group.count > 0);
  const unassigned = items.filter((item) => !roomForAppliance0157(item, rooms));
  const nav = roomNav0157(page);
  const signature = `${groups.map(({ room, count }) => `${room.id}:${room.name}:${count}`).join("|")}|unassigned:${unassigned.length}`;
  if (nav.dataset.dm0157RoomSignature === signature) {
    applyRoomFilter0157();
    return;
  }
  nav.dataset.dm0157RoomSignature = signature;

  nav.querySelectorAll("[data-dm-appliance-room-0157]:not([data-dm0157-bound])").forEach((node) => node.remove());
  const existingOverview = nav.querySelector("[data-dm-appliance-room-0157='']");
  [...nav.children].forEach((node) => {
    if (node !== existingOverview && node.matches?.("[data-dm-appliance-room-0157]")) node.remove();
  });

  const append = (roomId, label, count) => {
    const button = globalThis.document.createElement("button");
    button.type = "button";
    button.dataset.dmApplianceRoom0157 = roomId;
    button.innerHTML = `<span>${label}</span><small>${count}</small>`;
    button.addEventListener("click", () => {
      state0157().selectedRoomId = roomId;
      applyRoomFilter0157();
    });
    nav.append(button);
  };

  groups.forEach(({ room, count }) => append(String(room.id || ""), `🏠 ${room.name}`, count));
  if (unassigned.length) {
    append("__unassigned__", `❔ ${t0157("Senza stanza", "No room")}`, unassigned.length);
  }

  const validIds = new Set(["", "__unassigned__", ...groups.map(({ room }) => String(room.id || ""))]);
  if (!validIds.has(state0157().selectedRoomId)) state0157().selectedRoomId = "";
  applyRoomFilter0157();
}

function decorateAppliances0157() {
  const page = globalThis.document?.getElementById?.("page-appliances-main");
  if (!page) return false;
  const items = appliances0157();
  const byId = new Map(items.map((item) => [String(item.id || ""), item]));
  page.querySelectorAll(".appl-wide-card").forEach((card, index) => {
    const id = String(card.dataset.applianceId || "");
    const name = String(card.querySelector(".appl-wide-name")?.textContent || "").trim().toLowerCase();
    const item =
      byId.get(id) ||
      items.find((candidate) => String(candidate.name || "").trim().toLowerCase() === name) ||
      items[index];
    if (item) decorateApplianceCard0157(card, item);
  });
  rebuildRoomNav0157(items);
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
  const name = String(card.querySelector(".cp-name")?.textContent || "").trim().toLowerCase();
  return (
    rooms.find((room) => String(room.id || "") === id) ||
    rooms.find((room) => String(room.name || "").trim().toLowerCase() === name) ||
    rooms[index] ||
    null
  );
}

function temperatureValue0157(card) {
  return number0157(card.querySelector("[id^='tv_'],.temp-value")?.textContent);
}

function humidityValue0157(card) {
  return number0157(card.querySelector("[id^='hv_'],.humidity-value,.hum-value")?.textContent);
}

function temperatureIcon0157(card, room) {
  const stable = card.querySelector(".dm-room-icon-0151");
  if (stable?.innerHTML) return stable.innerHTML;
  try {
    const markup = globalThis.cdIconMarkup?.(room?.icon || "mdi:home-thermometer", 32);
    if (markup) return markup;
  } catch (_error) {}
  return "🏠";
}

function decorateTemperatureCard0157(card, room) {
  if (!card || !room) return;
  const temperature = temperatureValue0157(card);
  const humidity = humidityValue0157(card);
  const comfort = comfort0157(temperature);
  card.dataset.roomId = String(room.id || "");
  card.classList.add("dm-temperature-card-0157-ready");

  let content = card.querySelector(":scope > .dm-temperature-card-0157");
  if (!content) {
    content = globalThis.document.createElement("div");
    content.className = "dm-temperature-card-0157";
    card.append(content);
  }
  const signature = `${room.id}|${temperature}|${humidity}|${comfort.key}|${room.icon || ""}`;
  if (content.dataset.signature !== signature) {
    content.dataset.signature = signature;
    content.innerHTML = `<header><span class="dm-temperature-room-icon-0157">${temperatureIcon0157(card, room)}</span><span class="dm-temperature-room-title-0157"><strong>${room.name}</strong><small>${t0157("Clima ambiente", "Room climate")}</small></span><span class="dm-temperature-status-0157" data-status="${comfort.key}">${comfort.label}</span></header><div class="dm-temperature-values-0157"><span><small>${t0157("Temperatura", "Temperature")}</small><strong>${temperature == null ? "—" : format0157(temperature)}<em>°C</em></strong></span><span><small>${t0157("Umidità", "Humidity")}</small><strong>${humidity == null ? "—" : format0157(humidity, 0)}<em>%</em></strong></span></div>`;
  }

  const aria = `${room.name}, ${t0157("temperatura", "temperature")} ${temperature == null ? "—" : format0157(temperature)} °C, ${t0157("umidità", "humidity")} ${humidity == null ? "—" : format0157(humidity, 0)}%`;
  if (card.getAttribute("aria-label") !== aria) card.setAttribute("aria-label", aria);
  const legacyComfort = card.querySelector("[id^='tc_']");
  if (legacyComfort) {
    if (legacyComfort.textContent !== comfort.label) legacyComfort.textContent = comfort.label;
    if (legacyComfort.getAttribute("title") !== comfort.label) legacyComfort.setAttribute("title", comfort.label);
    if (legacyComfort.getAttribute("aria-label") !== comfort.label) legacyComfort.setAttribute("aria-label", comfort.label);
  }
}

function decorateTemperatures0157() {
  const grid = globalThis.document?.getElementById?.("temp-grid");
  if (!grid) return false;
  grid.querySelectorAll(".temp-card").forEach((card, index) => {
    const room = roomForTemperatureCard0157(card, index);
    if (room) decorateTemperatureCard0157(card, room);
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

function functionChainHas0157(fn, marker) {
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
  if (typeof current !== "function" || functionChainHas0157(current, marker)) return false;
  function wrapped0157(...args) {
    const result = current.apply(this, args);
    const finish = () => {
      if (typeof globalThis.queueMicrotask === "function") globalThis.queueMicrotask(callback);
      else callback();
    };
    if (result && typeof result.finally === "function") return result.finally(finish);
    finish();
    return result;
  }
  wrapped0157[marker] = true;
  wrapped0157.__dmPrevious = current;
  globalThis[name] = wrapped0157;
  return true;
}

function installApplianceProjection0157() {
  const current = globalThis.getAppliances;
  if (functionChainHas0157(current, "__dm0157RoomProjection")) return true;
  function projected0157() {
    const canonical = appliances0157();
    if (!canonical.length && typeof current === "function") return current.apply(this, arguments);
    const rooms = rooms0157();
    return canonical.map((item) => {
      const room = roomForAppliance0157(item, rooms);
      return {
        ...item,
        room_id: room?.id || item.room_id || "",
        room: room?.name || item.room || "",
      };
    });
  }
  projected0157.__dm0157RoomProjection = true;
  projected0157.__dmPrevious = current;
  globalThis.getAppliances = projected0157;
  return true;
}

function injectStyles0157() {
  if (globalThis.document?.getElementById?.("dm-release-0157-styles")) return;
  const style = globalThis.document.createElement("style");
  style.id = "dm-release-0157-styles";
  style.textContent = `
    #view-panoramica { position: relative; }
    .dm-period-loading-0157 { position: sticky; top: 10px; z-index: 8; width: fit-content; margin: 0 auto 12px; display: inline-flex; align-items: center; gap: 9px; padding: 9px 14px; border: 1px solid rgba(14,165,233,.22); border-radius: 999px; color: #0369a1; background: rgba(240,249,255,.96); box-shadow: 0 8px 24px rgba(14,165,233,.14); font-size: 12px; letter-spacing: .06em; text-transform: uppercase; }
    .dm-period-loading-0157[hidden] { display: none !important; }
    .dm-period-loading-0157 > span { width: 13px; height: 13px; border: 2px solid rgba(14,165,233,.25); border-top-color: #0ea5e9; border-radius: 50%; animation: dm-period-spin-0157 .75s linear infinite; }
    .dm-period-loading-active-0157 #ed-kpi-prod, .dm-period-loading-active-0157 #ed-kpi-cons, .dm-period-loading-active-0157 #ed-kpi-auto { opacity: .72; transition: opacity .18s ease; }
    @keyframes dm-period-spin-0157 { to { transform: rotate(360deg); } }

    #page-appliances-main .dm-legacy-appliance-metric-0157 { display: none !important; }
    #page-appliances-main .dm-appliance-metrics-0157 { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 9px; }
    #page-appliances-main .dm-appliance-metric-0157 { min-width: 118px; display: grid; gap: 2px; padding: 8px 12px; border: 1px solid rgba(148,163,184,.28); border-radius: 14px; background: linear-gradient(145deg, rgba(248,250,252,.95), rgba(240,249,255,.88)); box-shadow: inset 0 1px 0 rgba(255,255,255,.9); }
    #page-appliances-main .dm-appliance-metric-0157 small { color: #64748b; font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    #page-appliances-main .dm-appliance-metric-0157 strong { color: #0f172a; font-size: 15px; font-weight: 900; line-height: 1.2; }
    #page-appliances-main .dm-appliance-energy-0157 { border-color: rgba(14,165,233,.25); background: linear-gradient(145deg, rgba(240,249,255,.98), rgba(224,242,254,.72)); }
    #page-appliances-main .dm-appliance-room-nav-0157 { display: flex; align-items: center; gap: 10px; overflow-x: auto; scrollbar-width: none; padding: 4px 0 12px; }
    #page-appliances-main .dm-appliance-room-nav-0157::-webkit-scrollbar { display: none; }
    #page-appliances-main .dm-appliance-room-nav-0157 > button, #page-appliances-main .dm-appliance-room-nav-0157 > a { flex: 0 0 auto; min-height: 46px; display: inline-flex; align-items: center; gap: 9px; padding: 10px 16px; border: 1px solid rgba(148,163,184,.28); border-radius: 999px; color: #334155; background: rgba(255,255,255,.88); box-shadow: 0 8px 22px rgba(15,23,42,.07); font: inherit; font-weight: 850; text-decoration: none; cursor: pointer; }
    #page-appliances-main .dm-appliance-room-nav-0157 > button small, #page-appliances-main .dm-appliance-room-nav-0157 > a small { display: grid; place-items: center; min-width: 22px; height: 22px; padding: 0 6px; border-radius: 999px; color: #0369a1; background: #e0f2fe; font-size: 11px; }
    #page-appliances-main .dm-appliance-room-nav-0157 > .active { color: #075985; border-color: rgba(14,165,233,.4); background: linear-gradient(135deg, #e0f2fe, #bae6fd); box-shadow: 0 10px 28px rgba(14,165,233,.18); }
    #page-appliances-main .appl-wide-card[hidden] { display: none !important; }

    #temp-grid .temp-card.dm-temperature-card-0157-ready { position: relative; padding: 0 !important; overflow: hidden; border: 1px solid rgba(148,163,184,.18); background: linear-gradient(145deg, rgba(255,255,255,.98), rgba(248,250,252,.96)); box-shadow: 0 20px 48px rgba(15,23,42,.10); }
    #temp-grid .temp-card.dm-temperature-card-0157-ready > :not(.dm-temperature-card-0157) { position: absolute !important; width: 1px !important; height: 1px !important; overflow: hidden !important; clip: rect(0 0 0 0) !important; clip-path: inset(50%) !important; white-space: nowrap !important; }
    #temp-grid .dm-temperature-card-0157 { display: grid; gap: 18px; padding: 22px; }
    #temp-grid .dm-temperature-card-0157 header { display: grid; grid-template-columns: auto minmax(0,1fr) auto; align-items: center; gap: 13px; }
    #temp-grid .dm-temperature-room-icon-0157 { width: 54px; height: 54px; display: grid; place-items: center; border-radius: 18px; color: #0369a1; background: linear-gradient(145deg, #e0f2fe, #dbeafe); box-shadow: inset 0 1px 0 rgba(255,255,255,.9); font-size: 28px; }
    #temp-grid .dm-temperature-room-title-0157 { display: grid; gap: 3px; min-width: 0; }
    #temp-grid .dm-temperature-room-title-0157 strong { overflow: hidden; color: #0f172a; font-size: clamp(21px,4vw,27px); font-weight: 950; text-overflow: ellipsis; white-space: nowrap; }
    #temp-grid .dm-temperature-room-title-0157 small { color: #64748b; font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    #temp-grid .dm-temperature-status-0157 { justify-self: end; padding: 8px 11px; border-radius: 999px; color: #166534; background: #dcfce7; font-size: 11px; font-weight: 900; letter-spacing: .04em; text-transform: uppercase; white-space: nowrap; }
    #temp-grid .dm-temperature-status-0157[data-status="warm"] { color: #92400e; background: #fef3c7; }
    #temp-grid .dm-temperature-status-0157[data-status="hot"], #temp-grid .dm-temperature-status-0157[data-status="very-hot"] { color: #b91c1c; background: #fee2e2; }
    #temp-grid .dm-temperature-status-0157[data-status="cool"], #temp-grid .dm-temperature-status-0157[data-status="cold"] { color: #1d4ed8; background: #dbeafe; }
    #temp-grid .dm-temperature-values-0157 { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12px; }
    #temp-grid .dm-temperature-values-0157 > span { min-width: 0; display: grid; gap: 5px; padding: 16px; border: 1px solid rgba(148,163,184,.18); border-radius: 18px; background: rgba(248,250,252,.88); }
    #temp-grid .dm-temperature-values-0157 > span:first-child { background: linear-gradient(145deg, rgba(240,249,255,.95), rgba(224,242,254,.7)); }
    #temp-grid .dm-temperature-values-0157 small { color: #64748b; font-size: 10px; font-weight: 850; letter-spacing: .09em; text-transform: uppercase; }
    #temp-grid .dm-temperature-values-0157 strong { color: #0f172a; font-size: clamp(32px,8vw,46px); font-weight: 950; line-height: 1; font-variant-numeric: tabular-nums; }
    #temp-grid .dm-temperature-values-0157 em { margin-left: 4px; color: #64748b; font-size: .43em; font-style: normal; font-weight: 850; }
    @media (max-width: 560px) {
      #page-appliances-main .dm-appliance-metrics-0157 { gap: 6px; }
      #page-appliances-main .dm-appliance-metric-0157 { min-width: 108px; padding: 7px 10px; }
      #temp-grid .dm-temperature-card-0157 { padding: 18px; }
      #temp-grid .dm-temperature-card-0157 header { grid-template-columns: auto minmax(0,1fr); }
      #temp-grid .dm-temperature-status-0157 { grid-column: 1 / -1; justify-self: start; }
    }
  `;
  globalThis.document.head.append(style);
}

function installWrappers0157() {
  installApplianceProjection0157();
  wrapAfterRender0157("renderApplianceSection", decorateAppliances0157, "__dm0157ApplianceUi");
  wrapAfterRender0157("renderAppliances", decorateAppliances0157, "__dm0157ApplianceUi");
  wrapAfterRender0157("buildTempCards", decorateTemperatures0157, "__dm0157TemperatureUi");
  wrapAfterRender0157("renderTemperature", decorateTemperatures0157, "__dm0157TemperatureUi");
}

function scheduleDecoration0157() {
  const runtime = state0157();
  if (runtime.decorating) return;
  globalThis.clearTimeout?.(runtime.decorateTimer);
  runtime.decorateTimer = globalThis.setTimeout?.(decorateAll0157, 25);
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

    globalThis.document.addEventListener("change", (event) => {
      if (event.target?.matches?.("#ed-sel-month, #ed-sel-year")) scheduleEnergyRefresh0157();
    }, true);

    if (typeof globalThis.MutationObserver === "function") {
      runtime.pageObserver = new globalThis.MutationObserver(scheduleDecoration0157);
      runtime.pageObserver.observe(globalThis.document.documentElement, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }

    globalThis.addEventListener?.("dashboardmodern:legacy-ready", () => {
      installWrappers0157();
      scheduleDecoration0157();
    });
    globalThis.addEventListener?.("pageshow", () => {
      installWrappers0157();
      scheduleDecoration0157();
    });
  }

  decorateAll0157();
  globalThis.clearInterval?.(runtime.wrapperTimer);
  let attempts = 0;
  runtime.wrapperTimer = globalThis.setInterval?.(() => {
    attempts += 1;
    installWrappers0157();
    scheduleDecoration0157();
    if (
      attempts >= 80 ||
      (globalThis.renderApplianceSection?.__dm0157ApplianceUi &&
        globalThis.renderTemperature?.__dm0157TemperatureUi &&
        globalThis[FINAL_RUNTIME_0156_KEY]?.monthValues)
    ) {
      globalThis.clearInterval?.(runtime.wrapperTimer);
      runtime.wrapperTimer = 0;
    }
  }, 100);
}

if (typeof globalThis.document !== "undefined") {
  if (globalThis.document.readyState === "loading") {
    globalThis.document.addEventListener("DOMContentLoaded", install0157, { once: true });
  } else {
    install0157();
  }
}
