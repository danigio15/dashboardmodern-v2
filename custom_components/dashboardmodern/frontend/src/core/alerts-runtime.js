/* Canonical Alerts projection and bounded compatibility contracts for 0.15.2. */
import { refreshEnergy } from "../../legacy/runtime-consolidated.js";

const root = globalThis;
const doc = root.document;
const KEY = "__DASHBOARDMODERN_ALERTS_RUNTIME__";
const state = (root[KEY] ||= { installed: true, applying: false });
Object.assign(state, {
  installed: true,
  applying: Boolean(state.applying),
  energyRunning: Boolean(state.energyRunning),
  energyTimer: state.energyTimer || 0,
  maintenanceTimer: state.maintenanceTimer || 0,
  maintenanceAttempts: state.maintenanceAttempts || 0,
});

const clean = (value) => String(value ?? "").trim();
const esc = (value) =>
  clean(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");
const text = (it, en) => (doc?.documentElement?.lang === "en" ? en : it);
const dashboardStore = () => root.DashboardModernModules?.store || null;
const allStates = () => ({ ...(root._RAW_STATES || {}), ...(root.STATES || {}) });

function readJson(key, fallback) {
  try {
    return JSON.parse(root.localStorage?.getItem(key) || "") ?? fallback;
  } catch (_error) {
    return fallback;
  }
}

function writeJson(key, value) {
  root.localStorage?.setItem(key, JSON.stringify(value));
}

function configuredGroups() {
  const extras = readJson("cd_gruppi_extra", {});
  const removed = readJson("cd_gruppi_removed", {});
  const lights = Object.keys(readJson("cd_luci", {})).filter((id) => id.includes("."));
  const names = readJson("cd_avvisi_names_extra", {});
  extras.luci = [...new Set([...(extras.luci || []), ...lights])].filter(
    (id) => !(removed.luci || []).includes(id),
  );
  writeJson("cd_gruppi_extra", extras);
  return { extras, names };
}

function beginEdit(row) {
  const group = clean(row.dataset.alertGroup);
  const entity = clean(row.dataset.alertEntity);
  const name = clean(row.querySelector(".ed-row-new")?.textContent);
  const groupInput = doc.getElementById("ed-avv-grp");
  const entityInput = doc.getElementById("ed-avv-ent");
  const nameInput = doc.getElementById("ed-avv-name");
  if (groupInput) groupInput.value = group;
  if (entityInput) {
    entityInput.value = entity;
    entityInput.dispatchEvent(new Event("input", { bubbles: true }));
  }
  if (nameInput) {
    nameInput.value = name;
    nameInput.dispatchEvent(new Event("input", { bubbles: true }));
  }
  nameInput?.focus();
}

function rowFor(entity, group, names) {
  const friendly =
    clean(names[entity]) ||
    clean(root.STATES?.[entity]?.attributes?.friendly_name) ||
    clean(root._RAW_STATES?.[entity]?.attributes?.friendly_name) ||
    entity;
  const row = doc.createElement("div");
  row.className = "ed-row dm-alert-row";
  row.dataset.alertEntity = entity;
  row.dataset.alertGroup = group;
  row.innerHTML = `<div class="ed-row-main"><div class="ed-row-new">${esc(friendly)}</div><div class="ed-row-old mono">${esc(entity)}</div></div><button type="button" class="ed-del dm-alert-edit" data-dm-alert-edit aria-label="${text("Modifica", "Edit")}">✏️</button><button type="button" class="ed-del" data-dm-alert-delete aria-label="${text("Elimina", "Delete")}">🗑️</button>`;
  row.querySelector("[data-dm-alert-edit]").addEventListener("click", () => beginEdit(row));
  row.querySelector("[data-dm-alert-delete]").addEventListener("click", () => {
    root.edDelAvviso?.(group, entity);
    scheduleAlerts();
  });
  return row;
}

function locateOrCreateList(group) {
  const body = doc.getElementById("ed-body");
  if (!body) return null;
  const existing = [...body.querySelectorAll("details.ed-acc")].find((details) => {
    const summary = clean(details.querySelector("summary")?.textContent).toLowerCase();
    return group === "luci" ? /luci|lights/.test(summary) : false;
  });
  if (existing) {
    const list = existing.querySelector(".ed-list") || existing.querySelector(".ed-acc-body");
    if (list) return list;
  }
  const details = doc.createElement("details");
  details.className = "ed-acc dm-alert-group";
  details.open = true;
  details.dataset.alertGroup = group;
  details.innerHTML = `<summary class="ed-acc-head">💡 ${text("Luci", "Lights")} <span class="ed-acc-n">0</span></summary><div class="ed-acc-body"><div class="ed-list"></div></div>`;
  const firstForm = body.querySelector(".ed-form");
  body.insertBefore(details, firstForm || body.firstChild);
  return details.querySelector(".ed-list");
}

function normalizeExistingRows() {
  const body = doc.getElementById("ed-body");
  if (!body) return;
  body.querySelectorAll(".ed-row").forEach((row) => {
    const entity = clean(row.querySelector(".ed-row-old")?.textContent);
    const label = clean(row.querySelector(".ed-row-new")?.textContent);
    if (!entity && !label) row.remove();
  });
}

function alertsSignature(entities, names) {
  return entities
    .map((entity) => `${entity}:${clean(names[entity] || allStates()[entity]?.attributes?.friendly_name || entity)}`)
    .join("|");
}

export function applyCanonicalAlerts() {
  if (!doc || state.applying) return false;
  if (doc.querySelector(".ed-tab.active")?.dataset?.tab !== "avvisi") return false;
  state.applying = true;
  try {
    const { extras, names } = configuredGroups();
    normalizeExistingRows();
    const list = locateOrCreateList("luci");
    if (!list) return false;
    const expected = extras.luci || [];
    const signature = alertsSignature(expected, names);
    const rows = [...list.querySelectorAll(":scope > .dm-alert-row")];
    const stable =
      list.dataset.dmAlertsSignature === signature &&
      rows.length === expected.length &&
      rows.every((row, index) => row.dataset.alertEntity === expected[index]);
    if (!stable) {
      list.replaceChildren(...expected.map((entity) => rowFor(entity, "luci", names)));
      list.dataset.dmAlertsSignature = signature;
    }
    const details = list.closest("details");
    const count = details?.querySelector(".ed-acc-n");
    if (count) count.textContent = String(expected.length);
    if (!expected.length && details) details.remove();
    return true;
  } finally {
    state.applying = false;
  }
}

function constructDeferredSocket(raw) {
  function DeferredSocket(...args) {
    const inner = Reflect.construct(raw, args);
    Object.defineProperty(this, "__dmInnerSocket", { value: inner });
    for (const property of ["onopen", "onmessage", "onerror", "onclose"]) {
      let assigned = null;
      Object.defineProperty(this, property, {
        configurable: true,
        enumerable: true,
        get: () => assigned,
        set: (handler) => {
          assigned = typeof handler === "function" ? handler : null;
          inner[property] = assigned
            ? (event) => root.setTimeout?.(() => assigned.call(this, event), 0)
            : null;
        },
      });
    }
  }
  DeferredSocket.prototype = Object.create(raw.prototype || Object.prototype);
  DeferredSocket.prototype.constructor = DeferredSocket;
  DeferredSocket.prototype.send = function send(...args) {
    return this.__dmInnerSocket.send(...args);
  };
  DeferredSocket.prototype.close = function close(...args) {
    return this.__dmInnerSocket.close(...args);
  };
  DeferredSocket.prototype.addEventListener = function addEventListener(type, handler, options) {
    return this.__dmInnerSocket.addEventListener?.(
      type,
      (event) => root.setTimeout?.(() => handler.call(this, event), 0),
      options,
    );
  };
  DeferredSocket.prototype.removeEventListener = function removeEventListener() {};
  for (const property of ["readyState", "url", "protocol", "extensions", "bufferedAmount", "binaryType"]) {
    Object.defineProperty(DeferredSocket.prototype, property, {
      configurable: true,
      enumerable: true,
      get() { return this.__dmInnerSocket[property]; },
      set(value) { this.__dmInnerSocket[property] = value; },
    });
  }
  for (const [key, fallback] of Object.entries({ CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 })) {
    DeferredSocket[key] = raw[key] == null ? fallback : raw[key];
  }
  return DeferredSocket;
}

function activatePreloadedSocket() {
  const current = root.WebSocket;
  const raw = root.__DASHBOARDMODERN_PRELUDE_WS__;
  if (typeof current !== "function" || current.name !== "StubSocket" || typeof raw !== "function") {
    return current?.name !== "StubSocket";
  }
  state.deferredSocketCtor ||= constructDeferredSocket(raw);
  root.WebSocket = state.deferredSocketCtor;
  root.__DASHBOARDMODERN_BRIDGE_WS__ = state.deferredSocketCtor;
  return true;
}

async function repairEnergy() {
  if (state.energyRunning || root.__DASHBOARDMODERN_RUNTIME_ROOT__?.bundle) return;
  if (!activatePreloadedSocket() || !dashboardStore()) {
    scheduleEnergyRepair();
    return;
  }
  state.energyRunning = true;
  try {
    const applied = await refreshEnergy();
    if (!applied || !root.__DASHBOARDMODERN_RUNTIME_ROOT__?.bundle) scheduleEnergyRepair();
  } catch (_error) {
    scheduleEnergyRepair();
  } finally {
    state.energyRunning = false;
  }
}

function scheduleEnergyRepair(delay = 60) {
  if (state.energyTimer || root.__DASHBOARDMODERN_RUNTIME_ROOT__?.bundle) return;
  state.energyTimer = root.setTimeout?.(() => {
    state.energyTimer = 0;
    repairEnergy();
  }, delay);
}

function roomFor(value) {
  const raw = clean(value);
  const rooms = dashboardStore()?.getSection?.("rooms") || [];
  return rooms.find((room) => clean(room.id) === raw || clean(room.name) === raw) || null;
}

function populateLightRename(entityId) {
  const entity = clean(entityId);
  if (!entity) return;
  const input = doc?.getElementById("luce-add-ent");
  const name = doc?.getElementById("luce-add-name");
  if (input) {
    input.value = entity;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
  if (name) {
    name.value = clean(readJson("cd_luci", {})[entity]);
    name.dispatchEvent(new Event("input", { bubbles: true }));
  }
  const assignments = readJson("cd_luci_rooms", {});
  const room = roomFor(assignments[entity]);
  if (room && assignments[entity] !== room.name) {
    assignments[entity] = room.name;
    writeJson("cd_luci_rooms", assignments);
  }
}

function installLightRenameBridge() {
  const current = root.cdLuceRen;
  if (typeof current !== "function" || current.__dmStableLightRename0152) return;
  function stableLightRename(entity) {
    const result = current.apply(this, arguments);
    root.queueMicrotask?.(() => populateLightRename(entity));
    root.setTimeout?.(() => populateLightRename(entity), 0);
    return result;
  }
  Object.assign(stableLightRename, current);
  stableLightRename.__dmStableLightRename0152 = true;
  stableLightRename.__dmPrevious = current;
  root.cdLuceRen = stableLightRename;
}

function installLayoutContracts() {
  if (!doc || doc.getElementById("dm-alerts-layout-contracts-0152")) return;
  const style = doc.createElement("style");
  style.id = "dm-alerts-layout-contracts-0152";
  style.textContent = `
    html body #page-appliances-main .appl-wide-card{
      box-sizing:border-box!important;width:min(100%,408px)!important;max-width:408px!important;
      max-height:190px!important;overflow:hidden!important
    }
    html body #page-appliances-main .appl-ic:has(img.dm-appliance-image){
      box-sizing:border-box!important;width:80px!important;height:80px!important;
      min-width:80px!important;min-height:80px!important;flex:0 0 80px!important;overflow:hidden!important
    }
    html body #page-appliances-main .dm-appliance-image-wrap,
    html body #page-appliances-main img.dm-appliance-image{
      display:block!important;box-sizing:border-box!important;width:100%!important;height:100%!important;
      min-width:80px!important;min-height:80px!important;overflow:hidden!important;
      object-fit:cover!important;object-position:50% 50%!important
    }
  `;
  doc.head.append(style);
}

function openCovers() {
  const states = allStates();
  const covers = dashboardStore()?.getSection?.("covers") || [];
  const rooms = dashboardStore()?.getSection?.("rooms") || [];
  return covers.flatMap((cover) => {
    const entity = clean(cover.entity || cover.entities?.[0]);
    const current = states[entity];
    if (!entity || !current) return [];
    const positionRaw = current.attributes?.current_position;
    const position = positionRaw == null ? null : Number(positionRaw);
    const status = clean(current.state).toLowerCase();
    if (!(status === "open" || status === "opening" || (Number.isFinite(position) && position > 0))) return [];
    const roomValue = clean(cover.room_id || cover.room);
    const room = rooms.find((item) => clean(item.id) === roomValue || clean(item.name) === roomValue);
    return [{ cover, entity, status, position: Number.isFinite(position) ? position : null, room }];
  });
}

function syncShutterPopup() {
  const popup = doc?.getElementById("dm-shutter-popup");
  const alert = doc?.querySelector("#tapp-avvisi .dm-shutter-alert");
  const items = openCovers();
  if (!items.length) {
    popup?.remove();
    doc?.getElementById("tapp-avvisi")?.remove();
    return false;
  }
  const count = alert?.querySelector(".g-val");
  if (count) count.textContent = String(items.length);
  if (popup) {
    const rows = [...popup.querySelectorAll(".dm-shutter-popup-row")];
    rows.forEach((row, index) => {
      const item = items[index];
      if (!item) {
        row.remove();
        return;
      }
      const detail = row.querySelector(".dm-shutter-details small");
      if (!detail) return;
      const status = item.status === "opening"
        ? text("In apertura", "Opening")
        : text("Aperta", "Open");
      detail.textContent = `${item.room ? `${item.room.name} · ` : ""}${status}${item.position == null ? "" : ` · ${Math.round(item.position)}%`}`;
    });
  }
  return Boolean(popup || alert);
}

function scheduleAlerts() {
  root.queueMicrotask?.(applyCanonicalAlerts);
  root.setTimeout?.(applyCanonicalAlerts, 40);
}

function maintenanceTick() {
  state.maintenanceTimer = 0;
  state.maintenanceAttempts += 1;
  installLayoutContracts();
  installLightRenameBridge();
  activatePreloadedSocket();
  scheduleEnergyRepair(0);
  const activeShutters = syncShutterPopup();
  if (state.maintenanceAttempts < 480 || activeShutters || !root.__DASHBOARDMODERN_RUNTIME_ROOT__?.bundle) {
    scheduleMaintenance(activeShutters ? 120 : 50);
  }
}

function scheduleMaintenance(delay = 0) {
  if (state.maintenanceTimer) return;
  state.maintenanceTimer = root.setTimeout?.(maintenanceTick, delay);
}

function install() {
  if (!doc) return;
  if (doc.documentElement.dataset.dmAlertsRuntime !== "1") {
    doc.documentElement.dataset.dmAlertsRuntime = "1";
    doc.addEventListener(
      "click",
      (event) => {
        if (event.target?.closest?.('.ed-tab[data-tab="avvisi"]')) scheduleAlerts();
        scheduleMaintenance(0);
      },
      true,
    );
    root.addEventListener?.("dashboardmodern:state-changed", () => scheduleMaintenance(0));
    root.addEventListener?.("dashboardmodern:legacy-ready", () => {
      scheduleAlerts();
      scheduleMaintenance(0);
    });
    root.addEventListener?.("dashboardmodern:runtime-ready", () => {
      scheduleAlerts();
      scheduleMaintenance(0);
    });
    root.addEventListener?.("pageshow", () => scheduleMaintenance(0));
  }
  scheduleMaintenance(0);
}

state.apply = applyCanonicalAlerts;
state.schedule = scheduleAlerts;
state.maintenance = scheduleMaintenance;
if (doc?.readyState === "loading") doc.addEventListener("DOMContentLoaded", install, { once: true });
else install();
