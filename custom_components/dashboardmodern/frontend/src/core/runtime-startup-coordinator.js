/*
 * DashboardModern 0.15.2 startup coordinator.
 *
 * The consolidated runtime remains the only production owner. This coordinator
 * waits for the real Home Assistant bridge, retries the initial atomic Energy
 * refresh, and restores the bounded DOM/store contracts required by the legacy
 * document without reintroducing numbered owners or unbounded observers/timers.
 */
import { refreshEnergy } from "../../legacy/runtime-consolidated.js";

const root = globalThis;
const doc = root.document;
const KEY = "__DASHBOARDMODERN_STARTUP_COORDINATOR__";
const ROOT_KEY = "__DASHBOARDMODERN_RUNTIME_ROOT__";
const VERSION = "0.15.2";
const state = (root[KEY] ||= {});
Object.assign(state, {
  installed: true,
  version: VERSION,
  running: Boolean(state.running),
  completed: Boolean(state.completed),
  repairing: Boolean(state.repairing),
  listeners: Boolean(state.listeners),
  storeUnsubscribe: state.storeUnsubscribe || null,
  shutterTimer: state.shutterTimer || 0,
});
state.pendingShutters ||= new Map();

const clean = (value) => String(value ?? "").trim();
const english = () => doc?.documentElement?.lang === "en";
const store = () => root.DashboardModernModules?.store || null;
const allStates = () => ({ ...(root._RAW_STATES || {}), ...(root.STATES || {}) });
const esc = (value) =>
  clean(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");

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

function nextFrame() {
  return new Promise((resolve) => {
    if (typeof root.requestAnimationFrame === "function") root.requestAnimationFrame(resolve);
    else root.setTimeout?.(resolve, 16);
  });
}

function activeSocketReady() {
  const SocketCtor = root.WebSocket;
  if (typeof SocketCtor !== "function") return false;
  if (SocketCtor.name === "StubSocket") return false;
  return true;
}

function ensureBrokerToken() {
  if (clean(root.DASHBOARDMODERN_AUTH_TOKEN)) return;
  const token = clean(
    root.__DASHBOARDMODERN_REAL_TOKEN__ ||
    root.__DASHBOARDMODERN_CONNECTION__?.token ||
    (root.__DASHBOARDMODERN_HOSTED__ ? "__dashboardmodern_hosted__" : ""),
  );
  if (token) root.DASHBOARDMODERN_AUTH_TOKEN = token;
}

function alignSocketConstants() {
  const SocketCtor = root.WebSocket;
  if (typeof SocketCtor !== "function") return;
  for (const [key, value] of Object.entries({ CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 })) {
    if (SocketCtor[key] == null) {
      try {
        Object.defineProperty(SocketCtor, key, { value, configurable: true });
      } catch (_error) {
        try {
          SocketCtor[key] = value;
        } catch (_ignored) {}
      }
    }
  }
}

function installStyles() {
  if (!doc || doc.getElementById("dm-startup-contracts-0152")) return;
  const style = doc.createElement("style");
  style.id = "dm-startup-contracts-0152";
  style.textContent = `
    #editor-modal[data-dm-editor-theme="dark"]{
      --dm-editor-shell:#161f36;--dm-editor-panel:#1b2540;--dm-editor-control:#212d4c;
      --dm-editor-border:#263453;--dm-editor-text:#e6edf7;--dm-editor-muted:#92a4c2;
      background:rgba(3,7,18,.76)!important;color-scheme:dark
    }
    #editor-modal[data-dm-editor-theme="dark"] .ed-shell,
    #editor-modal[data-dm-editor-theme="dark"] .ed-head,
    #editor-modal[data-dm-editor-theme="dark"] .ed-body{
      background:var(--dm-editor-shell)!important;color:var(--dm-editor-text)!important;
      border-color:var(--dm-editor-border)!important
    }
    #editor-modal[data-dm-editor-theme="dark"] .ed-tabs,
    #editor-modal[data-dm-editor-theme="dark"] .ed-inner-tabs,
    #editor-modal[data-dm-editor-theme="dark"] .sub-tabs-energy,
    #editor-modal[data-dm-editor-theme="dark"] .ed-row,
    #editor-modal[data-dm-editor-theme="dark"] .dm-report-row,
    #editor-modal[data-dm-editor-theme="dark"] .ed-acc,
    #editor-modal[data-dm-editor-theme="dark"] .ed-acc-body,
    #editor-modal[data-dm-editor-theme="dark"] [data-report-manual]:not([hidden]){
      background:var(--dm-editor-panel)!important;color:var(--dm-editor-text)!important;
      border-color:var(--dm-editor-border)!important
    }
    #editor-modal[data-dm-editor-theme="dark"] .ed-input,
    #editor-modal[data-dm-editor-theme="dark"] input,
    #editor-modal[data-dm-editor-theme="dark"] select,
    #editor-modal[data-dm-editor-theme="dark"] textarea{
      background-color:var(--dm-editor-control)!important;color:var(--dm-editor-text)!important;
      border-color:var(--dm-editor-border)!important
    }
    #editor-modal[data-dm-editor-theme="dark"] .ed-slot-lbl,
    #editor-modal[data-dm-editor-theme="dark"] .ed-row-old,
    #editor-modal[data-dm-editor-theme="dark"] .ed-intro,
    #editor-modal[data-dm-editor-theme="dark"] .ed-hint,
    #editor-modal[data-dm-editor-theme="dark"] .ed-empty{
      color:var(--dm-editor-muted)!important
    }
    #editor-modal[data-dm-editor-theme="dark"] .ed-row-new,
    #editor-modal[data-dm-editor-theme="dark"] .ed-sec-title,
    #editor-modal[data-dm-editor-theme="dark"] .ed-head-title{
      color:var(--dm-editor-text)!important
    }
    [data-report-manual][hidden]{display:none!important}
    html body #page-appliances-main .appl-wide-card{
      box-sizing:border-box!important;width:min(100%,410px)!important;max-width:410px!important;
      max-height:190px!important;overflow:hidden!important
    }
    html body #page-appliances-main .dm-appliance-image-wrap,
    html body #page-appliances-main .dm-appliance-image{
      display:block!important;box-sizing:border-box!important;width:100%!important;height:100%!important
    }
    html body #page-appliances-main .dm-appliance-image{object-fit:cover!important;object-position:50% 50%!important}
    #dm-shutter-popup{position:fixed;inset:0;z-index:10060;display:grid;place-items:center;
      padding:16px;background:rgba(2,6,23,.62)}
    #dm-shutter-popup>.dm-shutter-popup{box-sizing:border-box;width:min(680px,100%);max-height:min(760px,92dvh);
      overflow:auto;border-radius:22px;background:var(--card-bg,#fff);color:var(--text,#0f172a);
      border:1px solid var(--card-border,rgba(15,23,42,.12));box-shadow:0 24px 70px rgba(0,0,0,.32);padding:18px}
    #dm-shutter-popup header{position:relative;display:flex;flex-direction:row;align-items:center;
      justify-content:space-between;min-height:48px;padding-right:56px}
    #dm-shutter-popup header h2{margin:0;min-width:0}
    #dm-shutter-popup [data-shutter-popup-close]{position:absolute;right:10px;top:50%;transform:translateY(-50%);margin:0}
    #dm-shutter-popup [data-shutter-popup-list]{display:grid;gap:10px}
    #dm-shutter-popup .dm-shutter-popup-row{display:grid;grid-template-columns:auto minmax(0,1fr);gap:12px;
      align-items:center;padding:12px;border-radius:16px;background:var(--surface-2,rgba(148,163,184,.12))}
    #dm-shutter-popup .dm-shutter-details{display:grid;gap:3px;min-width:0}
    #dm-shutter-popup .dm-shutter-actions{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    #dm-shutter-popup .dm-shutter-actions button{box-sizing:border-box;width:100%;min-width:0;min-height:42px}
  `;
  doc.head.append(style);
}

function syncEditorTheme() {
  const modal = doc?.getElementById("editor-modal");
  if (!modal) return;
  const explicit = clean(doc.documentElement?.dataset?.theme || doc.body?.dataset?.theme).toLowerCase();
  let dark = explicit === "dark";
  if (!explicit) {
    const scheme = clean(root.getComputedStyle?.(doc.documentElement)?.colorScheme).toLowerCase();
    dark = scheme.includes("dark") && !scheme.includes("light");
  }
  modal.dataset.dmEditorTheme = dark ? "dark" : "light";
}

function setReportFormVisibility(form, expanded) {
  if (!form) return;
  form.hidden = !expanded;
  if (expanded) form.style.removeProperty("display");
  else form.style.setProperty("display", "none", "important");
}

function applyReportManualContracts() {
  doc?.querySelectorAll("[data-report-add]").forEach((button) => {
    if (!button.hasAttribute("aria-expanded")) button.setAttribute("aria-expanded", "false");
    const panel = button.closest('[data-energy-panel="report"]') || button.parentElement;
    setReportFormVisibility(panel?.querySelector("[data-report-manual]"), button.getAttribute("aria-expanded") === "true");
  });
}

function slug(value) {
  return clean(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function canonicalRooms() {
  const items = store()?.getSection?.("rooms") || readJson("cd_stanze", []);
  return (Array.isArray(items) ? items : [])
    .map((room, index) => {
      const name = clean(room?.name || room?.id || `room-${index + 1}`);
      return { ...room, id: clean(room?.id) || `room-${slug(name) || index + 1}`, name };
    })
    .filter((room) => room.name);
}

function resolveRoom(value, rooms = canonicalRooms()) {
  const raw = clean(value);
  if (!raw) return null;
  const lower = raw.toLowerCase();
  const token = slug(raw).replace(/^room-/, "");
  return (
    rooms.find((room) => clean(room.id) === raw) ||
    rooms.find((room) => clean(room.id).toLowerCase() === lower) ||
    rooms.find((room) => clean(room.name).toLowerCase() === lower) ||
    rooms.find((room) => slug(room.name) === token) ||
    rooms.find((room) => slug(room.id).replace(/^room-/, "") === token) ||
    null
  );
}

function exactRoomFromEntity(entityId, rooms = canonicalRooms()) {
  const token = slug(clean(entityId).split(".").pop()).replace(/^(light|cover)-/, "");
  return (
    rooms.find((room) => slug(room.name) === token) ||
    rooms.find((room) => slug(room.id).replace(/^room-/, "") === token) ||
    null
  );
}

function migrateLightAssignments() {
  const rooms = canonicalRooms();
  if (!rooms.length) return false;
  const assignments = readJson("cd_luci_rooms", {});
  const lights = Object.keys(readJson("cd_luci", {}));
  let changed = false;
  for (const entity of new Set([...lights, ...Object.keys(assignments)])) {
    const exact = exactRoomFromEntity(entity, rooms);
    const saved = resolveRoom(assignments[entity], rooms);
    if (exact && saved && exact.id !== saved.id && assignments[entity] !== exact.id) {
      assignments[entity] = exact.id;
      changed = true;
    }
  }
  if (changed) writeJson("cd_luci_rooms", assignments);
  return changed;
}

function normalizeLightsEditorDom() {
  const body = doc?.getElementById("ed-body");
  if (!body || doc.querySelector(".ed-tab.active")?.dataset?.tab !== "luci") return;
  migrateLightAssignments();
  const rooms = canonicalRooms();
  const assignments = readJson("cd_luci_rooms", {});
  const addInput = body.querySelector("#luce-add-ent");
  if (addInput) {
    addInput.dataset.lightAddEntity = "true";
    addInput.dataset.entityInput = "true";
    const picker = addInput.parentElement?.querySelector(".dm-entity-picker");
    if (picker) picker.dataset.entityTarget = addInput.id;
  }
  body.querySelectorAll(".dm-light-room,select[onchange*='dmLightSetRoom']").forEach((select) => {
    const handler = select.getAttribute("onchange") || "";
    const entity = clean(select.dataset.lightEntity || handler.match(/dmLightSetRoom\('([^']+)'/)?.[1]);
    if (!entity) return;
    select.dataset.lightEntity = entity;
    const target = resolveRoom(assignments[entity], rooms) || exactRoomFromEntity(entity, rooms);
    const empty = doc.createElement("option");
    empty.value = "";
    empty.textContent = english() ? "— Other areas —" : "— Altre zone —";
    const fragment = doc.createDocumentFragment();
    fragment.append(empty);
    rooms.forEach((room) => {
      const option = doc.createElement("option");
      option.value = room.id;
      option.textContent = `${clean(room.icon) && !clean(room.icon).startsWith("mdi:") ? `${clean(room.icon)} ` : ""}${room.name}`;
      fragment.append(option);
    });
    select.replaceChildren(fragment);
    select.value = target?.id || "";
  });
}

function metadata(id, states) {
  const entity = clean(id);
  const attributes = states[entity]?.attributes || {};
  return {
    id: entity,
    domain: entity.split(".")[0],
    unit: clean(attributes.unit_of_measurement).toLowerCase().replace(/\s+/g, ""),
    deviceClass: clean(attributes.device_class).toLowerCase(),
    text: `${entity} ${clean(attributes.friendly_name)}`.toLowerCase(),
  };
}

function deviceTokens(item) {
  return [...new Set([item?.name, item?.device_type, item?.visual_key, item?.type]
    .map((value) => slug(value).replaceAll("-", ""))
    .filter((value) => value.length >= 4))];
}

function repairItem(item, states) {
  const explicit = [
    item.control_entity,
    item.power_entity,
    item.energy_entity,
    item.daily_energy_entity,
    item.monthly_energy_entity,
    item.total_energy_entity,
    item.report_entity,
    item.history_entity,
    ...(item.entities || []),
  ].map(clean).filter(Boolean);
  const tokens = deviceTokens(item);
  const inferred = Object.keys(states).filter((id) => {
    if (!tokens.length) return false;
    const attributes = states[id]?.attributes || {};
    const haystack = slug(`${id} ${attributes.friendly_name || ""}`).replaceAll("-", "");
    return tokens.some((token) => haystack.includes(token));
  });
  const ids = [...new Set([...explicit, ...inferred])];
  const list = ids.map((id) => metadata(id, states));
  const control = list.find((entry) => /^(switch|light|input_boolean|fan)$/.test(entry.domain))?.id || "";
  const power = list.find((entry) => /^(w|kw)$/.test(entry.unit) || entry.deviceClass === "power" || /power|potenza|watt/.test(entry.text))?.id || "";
  const energies = list.filter((entry) => /^(wh|kwh|mwh)$/.test(entry.unit) || entry.deviceClass === "energy" || /energy|energia|kwh/.test(entry.text));
  const daily = energies.find((entry) => /oggi|today|daily|giorn|day/.test(entry.text))?.id || "";
  const monthly = energies.find((entry) => /mese|month|monthly/.test(entry.text))?.id || "";
  const total = energies.find((entry) => /totale|total|lifetime|counter|meter/.test(entry.text))?.id || "";
  const energy = clean(item.energy_entity) || monthly || total || daily || energies[0]?.id || "";
  const report = clean(item.report_entity) || monthly || total || daily || energy;
  return {
    ...item,
    entities: ids,
    control_entity: clean(item.control_entity) || control,
    power_entity: clean(item.power_entity) || power,
    energy_entity: energy,
    daily_energy_entity: clean(item.daily_energy_entity) || daily,
    monthly_energy_entity: clean(item.monthly_energy_entity) || monthly,
    total_energy_entity: clean(item.total_energy_entity) || total,
    report_entity: report,
    history_entity: clean(item.history_entity) || report || power,
    show_in_report: item.show_in_report !== false,
  };
}

function applianceSignature(item) {
  return JSON.stringify({
    entities: item.entities || [],
    control_entity: item.control_entity || "",
    power_entity: item.power_entity || "",
    energy_entity: item.energy_entity || "",
    daily_energy_entity: item.daily_energy_entity || "",
    monthly_energy_entity: item.monthly_energy_entity || "",
    total_energy_entity: item.total_energy_entity || "",
    report_entity: item.report_entity || "",
    history_entity: item.history_entity || "",
    show_in_report: item.show_in_report !== false,
  });
}

async function repairAppliances() {
  const dashboardStore = store();
  if (!dashboardStore?.getSection || !dashboardStore?.replaceSection || state.repairing) return false;
  const current = dashboardStore.getSection("appliances") || [];
  if (!current.length) return true;
  const repaired = current.map((item) => repairItem(item, allStates()));
  if (current.every((item, index) => applianceSignature(item) === applianceSignature(repaired[index]))) return true;
  state.repairing = true;
  try {
    await dashboardStore.replaceSection("appliances", repaired);
  } finally {
    state.repairing = false;
  }
  return true;
}

function ensurePowerToggle(card, device, states) {
  const entity = clean(device?.control_entity);
  if (!entity) return;
  card.classList.add("dm-control-device");
  let button = card.querySelector('[data-dm-power-toggle="true"]');
  if (!button) {
    button = doc.createElement("button");
    button.type = "button";
    button.className = "dm-appliance-power-toggle";
    button.dataset.dmPowerToggle = "true";
    (card.querySelector(".appl-wide-actions,.appl-actions,.appl-wide-body") || card).append(button);
    button.addEventListener("click", () => {
      const on = allStates()[entity]?.state === "on";
      root.dmCallHaService?.(entity.split(".")[0], on ? "turn_off" : "turn_on", { entity_id: entity });
    });
  }
  const on = states[entity]?.state === "on";
  button.dataset.entity = entity;
  button.dataset.state = on ? "on" : "off";
  button.textContent = on ? (english() ? "Turn off" : "Spegni") : (english() ? "Turn on" : "Accendi");
}

function normalizeApplianceCards() {
  const devices = store()?.getSection?.("appliances") || [];
  const byId = new Map(devices.map((item) => [clean(item.id), item]));
  const states = allStates();
  doc?.querySelectorAll("#page-appliances-main .appl-wide-card[data-appliance-id]").forEach((card, index) => {
    const device = byId.get(clean(card.dataset.applianceId)) || devices[index];
    if (!device) return;
    card.querySelectorAll(".appl-spark").forEach((node) => node.remove());
    const imageUrl = clean(device.image || device.image_url);
    if (imageUrl) {
      const icon = card.querySelector(".appl-ic");
      if (icon && icon.querySelector("img.dm-appliance-image")?.getAttribute("src") !== imageUrl) {
        icon.innerHTML = `<span class="dm-appliance-image-wrap"><img class="dm-appliance-image" alt="${esc(device.name)}"></span>`;
        const image = icon.querySelector("img");
        image.src = imageUrl;
        image.loading = "eager";
        image.decoding = "async";
      }
    }
    ensurePowerToggle(card, device, states);
  });
}

function coverItems() {
  return store()?.getSection?.("covers") || [];
}

function openShutters() {
  const states = allStates();
  const rooms = canonicalRooms();
  return coverItems().flatMap((cover) => {
    const entity = clean(cover?.entity || cover?.entities?.[0]);
    const current = states[entity];
    if (!entity || !current || /^(unknown|unavailable)$/.test(clean(current.state).toLowerCase())) return [];
    const positionValue = current.attributes?.current_position;
    const position = positionValue == null ? null : Number(positionValue);
    const status = clean(current.state).toLowerCase();
    const open = status === "open" || status === "opening" || (Number.isFinite(position) && position > 0);
    if (!open) return [];
    return [{
      ...cover,
      entity,
      state: status,
      position: Number.isFinite(position) ? position : null,
      room: resolveRoom(cover.room_id || cover.room, rooms),
    }];
  });
}

function shutterStateLabel(item) {
  if (item.state === "opening") return english() ? "Opening" : "In apertura";
  if (item.state === "open") return english() ? "Open" : "Aperta";
  return english() ? "Partially open" : "Parzialmente aperta";
}

function callShutterService(button, item, service) {
  const key = `${item.entity}:${service}`;
  state.pendingShutters.set(key, { entity: item.entity, service, startedAt: Date.now() });
  button.disabled = true;
  button.textContent = service === "close_cover" ? (english() ? "Closing…" : "Chiusura…") : "…";
  try {
    Promise.resolve(root.dmCallHaService?.("cover", service, { entity_id: item.entity })).catch(() => {
      state.pendingShutters.delete(key);
    });
  } catch (_error) {
    state.pendingShutters.delete(key);
  }
}

function shutterSignature(items, includePending = false) {
  return items.map((item) => [
    item.entity,
    item.state,
    item.position ?? "",
    item.room?.id || "",
    includePending
      ? [...state.pendingShutters.keys()].filter((key) => key.startsWith(`${item.entity}:`)).sort().join(",")
      : "",
  ].join(":" )).join("|");
}

function renderShutterPopup(items = openShutters()) {
  const popup = doc?.getElementById("dm-shutter-popup");
  if (!popup) return;
  if (!items.length) {
    popup.remove();
    return;
  }
  const list = popup.querySelector("[data-shutter-popup-list]");
  if (!list) return;
  const signature = shutterSignature(items, true);
  if (list.dataset.dmShutterSignature === signature) return;
  list.replaceChildren(...items.map((item) => {
    const row = doc.createElement("article");
    row.className = "dm-shutter-popup-row";
    row.innerHTML = `<span class="g-icon-wrap">🪟</span><span class="dm-shutter-details"><strong>${esc(item.name || item.entity)}</strong><small>${item.room ? `${esc(item.room.name)} · ` : ""}${shutterStateLabel(item)}${item.position == null ? "" : ` · ${Math.round(item.position)}%`}</small></span><span class="dm-shutter-actions"></span>`;
    const actions = row.querySelector(".dm-shutter-actions");
    const commands = item.position == null
      ? [["close_cover", english() ? "Close" : "Chiudi"]]
      : [
          ["open_cover", english() ? "Open" : "Apri"],
          ["stop_cover", "Stop"],
          ["close_cover", english() ? "Close" : "Chiudi"],
        ];
    commands.forEach(([service, label]) => {
      const button = doc.createElement("button");
      button.type = "button";
      button.dataset.shutterService = service;
      const pending = state.pendingShutters.has(`${item.entity}:${service}`);
      button.disabled = pending;
      button.textContent = pending
        ? service === "close_cover"
          ? english() ? "Closing…" : "Chiusura…"
          : "…"
        : label;
      button.addEventListener("click", () => callShutterService(button, item, service));
      actions.append(button);
    });
    return row;
  }));
  list.dataset.dmShutterSignature = signature;
}

function showShutterPopup() {
  doc?.getElementById("dm-shutter-popup")?.remove();
  const popup = doc.createElement("div");
  popup.id = "dm-shutter-popup";
  popup.innerHTML = `<section class="dm-shutter-popup" role="dialog" aria-modal="true" aria-labelledby="dm-shutter-popup-title"><header><h2 id="dm-shutter-popup-title">🪟 ${english() ? "Open shutters" : "Tapparelle aperte"}</h2><button type="button" data-shutter-popup-close aria-label="${english() ? "Close" : "Chiudi"}">×</button></header><div data-shutter-popup-list></div></section>`;
  popup.addEventListener("click", (event) => {
    if (event.target === popup || event.target.closest("[data-shutter-popup-close]")) popup.remove();
  });
  doc.body.append(popup);
  renderShutterPopup();
}

function renderShutterAlert() {
  const host = doc?.getElementById("glance-custom-wrap");
  if (!host) return;
  const items = openShutters();
  let wrapper = doc.getElementById("tapp-avvisi");
  if (!items.length) {
    wrapper?.remove();
    doc.getElementById("dm-shutter-popup")?.remove();
    return;
  }
  if (!wrapper) {
    wrapper = doc.createElement("div");
    wrapper.id = "tapp-avvisi";
    host.append(wrapper);
  }
  const signature = shutterSignature(items);
  if (wrapper.dataset.dmShutterSignature !== signature) {
    const title = items.length === 1
      ? english() ? "SHUTTER OPEN" : "TAPPARELLA APERTA"
      : english() ? "SHUTTERS OPEN" : "TAPPARELLE APERTE";
    wrapper.innerHTML = `<button type="button" class="glance-card dm-shutter-alert" style="--g-rgb:245,158,11;display:flex" aria-haspopup="dialog"><span class="g-info"><span class="g-name">${title}</span><span class="g-val">${items.length}</span></span><span class="g-icon-wrap">🪟</span></button>`;
    wrapper.querySelector("button").addEventListener("click", showShutterPopup);
    wrapper.dataset.dmShutterSignature = signature;
  }
  renderShutterPopup(items);
  scheduleShutterHeartbeat();
}

function scheduleShutterHeartbeat() {
  root.clearTimeout?.(state.shutterTimer);
  if (!coverItems().length && !doc?.getElementById("dm-shutter-popup")) {
    state.shutterTimer = 0;
    return;
  }
  state.shutterTimer = root.setTimeout?.(() => {
    renderShutterAlert();
  }, 250);
}

function normalizeAlertEditorDom() {
  const body = doc?.getElementById("ed-body");
  if (!body || doc.querySelector(".ed-tab.active")?.dataset?.tab !== "avvisi") return;
  body.querySelectorAll(".ed-row").forEach((row) => {
    const label = clean(row.querySelector(".ed-row-new")?.textContent);
    const entity = clean(row.querySelector(".ed-row-old")?.textContent);
    if (!label && !entity) row.remove();
  });
}

function applyContracts() {
  alignSocketConstants();
  installStyles();
  syncEditorTheme();
  applyReportManualContracts();
  normalizeLightsEditorDom();
  normalizeAlertEditorDom();
  root.__DASHBOARDMODERN_ALERTS_RUNTIME__?.apply?.();
  normalizeApplianceCards();
  renderShutterAlert();
}

function hasCoordinatorWrapper(fn) {
  let current = fn;
  for (let depth = 0; typeof current === "function" && depth < 12; depth += 1) {
    if (current.__dmStartupCoordinator0152) return true;
    current = current.__dmPrevious;
  }
  return false;
}

function wrapAfter(name, callback, before = null) {
  const current = root[name];
  if (typeof current !== "function" || hasCoordinatorWrapper(current)) return false;
  function coordinated() {
    before?.apply(this, arguments);
    const result = current.apply(this, arguments);
    const finish = () => root.queueMicrotask?.(callback);
    if (result && typeof result.finally === "function") return result.finally(finish);
    finish();
    return result;
  }
  Object.assign(coordinated, current);
  coordinated.__dmStartupCoordinator0152 = true;
  coordinated.__dmPrevious = current;
  root[name] = coordinated;
  return true;
}

function installWrappers() {
  wrapAfter("apriConfigEntita", applyContracts);
  wrapAfter("editorSwitch", applyContracts, (tab) => {
    if (tab === "luci") migrateLightAssignments();
  });
  [
    "render",
    "renderApplianceSection",
    "renderAppliances",
    "renderEnergy",
    "renderEnergyDashboard",
    "renderEdDeviceList",
    "buildTempCards",
    "renderTemperature",
  ].forEach((name) => wrapAfter(name, applyContracts));
}

function bindEvents() {
  if (!doc || state.listeners) return;
  state.listeners = true;
  doc.addEventListener("click", (event) => {
    const add = event.target?.closest?.("[data-report-add]");
    if (add) {
      event.preventDefault();
      event.stopPropagation();
      const panel = add.closest('[data-energy-panel="report"]') || add.parentElement;
      const form = panel?.querySelector("[data-report-manual]");
      if (form) {
        const expanded = add.getAttribute("aria-expanded") === "true";
        add.setAttribute("aria-expanded", String(!expanded));
        setReportFormVisibility(form, !expanded);
      }
      return;
    }
    root.queueMicrotask?.(applyContracts);
  }, true);
  root.addEventListener?.("dashboardmodern:state-changed", () => {
    root.queueMicrotask?.(applyContracts);
    repairAppliances().catch(() => {});
  });
  root.addEventListener?.("pageshow", () => root.queueMicrotask?.(() => {
    installWrappers();
    applyContracts();
  }));
}

function subscribeStore() {
  const dashboardStore = store();
  if (!dashboardStore?.subscribe || state.storeUnsubscribe) return;
  state.storeUnsubscribe = dashboardStore.subscribe((change) => {
    if (change?.section === "appliances") repairAppliances().catch(() => {});
    if (["appliances", "covers", "rooms", "lights", "report", "energy"].includes(change?.section)) {
      root.queueMicrotask?.(applyContracts);
    }
  });
}

function setupContracts() {
  ensureBrokerToken();
  installStyles();
  installWrappers();
  bindEvents();
  subscribeStore();
  applyContracts();
  repairAppliances().catch((error) => root.console?.warn?.("[DashboardModern] appliance repair", error));
}

export async function settleRuntimeStartup() {
  if (state.running) return state.completed;
  state.running = true;
  let postReadyFrames = 0;
  try {
    for (let attempt = 0; attempt < 360; attempt += 1) {
      setupContracts();
      const dashboardStore = store();
      if (dashboardStore && activeSocketReady() && (!state.completed || !root[ROOT_KEY]?.bundle)) {
        const applied = await refreshEnergy();
        if (applied && root[ROOT_KEY]?.bundle) {
          state.completed = true;
          applyContracts();
        }
      }
      if (state.completed) {
        postReadyFrames += 1;
        if (postReadyFrames >= 120) return true;
      }
      await nextFrame();
    }
    return state.completed;
  } finally {
    state.running = false;
  }
}

function schedule() {
  root.queueMicrotask?.(() => {
    setupContracts();
    settleRuntimeStartup().catch((error) => root.console?.warn?.("[DashboardModern] startup coordinator", error));
  });
}

root.addEventListener?.("dashboardmodern:legacy-ready", schedule);
root.addEventListener?.("dashboardmodern:runtime-ready", schedule);
if (doc?.readyState === "loading") doc.addEventListener("DOMContentLoaded", schedule, { once: true });
else schedule();
