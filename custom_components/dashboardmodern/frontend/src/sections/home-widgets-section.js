/* «In primo piano»: il ponte dei widget della Home (#201).
 *
 * Una parte della Home dedicata ai widget: tessere piccole ed eleganti — un
 * numero, un anello, una parola — una per sezione della plancia, e al tocco
 * la tessera si espande in una card larga con il dettaglio vivo di quella
 * sezione: le luci accese con l'interruttore, le zone clima col loro tasto,
 * le tapparelle con le frecce, le cose da fare con la spunta.
 *
 * Ogni widget legge la configurazione che la sua sezione ha gia' — le luci da
 * `cd_luci`, il clima da `cd_clima_units`, l'energia dal modello Energia — e
 * compare solo se quella sezione e' configurata: niente da configurare due
 * volte, niente tessere vuote.
 *
 * Le liste ToDo restano il widget che ha aperto la strada: le voci arrivano
 * da `todo.get_items` con `return_response` sulla presa WebSocket della
 * plancia, spuntarle chiama `todo.update_item`, e la configurazione viaggia
 * in `cd_todo`. Niente polling: si ridisegna sugli eventi di stato, e il
 * markup si rifa' solo quando cambia la struttura — i valori si aggiornano al
 * loro posto, cosi' l'apertura di una tessera non riparte mai da sola.
 */
import {
  normalizeTodoLists,
  parseTodoItemsResponse,
  pendingTodoItems,
} from "../core/todo-model.js";
import { createApplianceViewModel } from "../core/appliance-view-model.js";
import { normalizeSecurityDoors } from "../core/security-door-model.js";
import { configuredLightGroups } from "./lights-alerts-section.js";
import {
  allStates,
  clean,
  doc,
  esc,
  formatNumber,
  installStyle,
  lexicalGlobal,
  readClimateUnits,
  readJson,
  root,
  section,
  t,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_HOME_WIDGETS__";
const STYLE_ID = "dm-widgets-style";
export const TODO_CONFIG_KEY = "cd_todo";
const STALE_MS = 30000;
const MAX_VISIBLE_ITEMS = 8;

const state = (root[KEY] ||= {
  installed: false,
  frame: 0,
  expanded: "",
  signature: "",
  lists: new Map(), // entity -> { items, fetchedAt, inflight }
});

export function configuredTodoLists() {
  return normalizeTodoLists(readJson(TODO_CONFIG_KEY, []));
}

/* ── letture ──────────────────────────────────────────────────────────── */

function stateOf(states, entity) {
  const id = clean(entity);
  if (!id) return null;
  let resolved = id;
  try {
    resolved = clean(root.resolveEntity?.(id) || id);
  } catch (_error) {}
  return states[id] || states[resolved] || null;
}

function numOf(states, entity) {
  const value = Number(stateOf(states, entity)?.state);
  return Number.isFinite(value) ? value : null;
}

/* ── il filo delle liste ToDo ─────────────────────────────────────────── */

function askHomeAssistant(payload, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const socket = lexicalGlobal("ws");
    const pending = lexicalGlobal("pendingWsCallbacks");
    if (!socket || socket.readyState !== 1 || !pending) {
      reject(new Error("socket"));
      return;
    }
    let id = 0;
    try {
      id = root.eval("msgId++");
    } catch (_error) {
      reject(new Error("msgId"));
      return;
    }
    const timer = root.setTimeout?.(() => {
      delete pending[id];
      reject(new Error("timeout"));
    }, timeout);
    pending[id] = (message) => {
      root.clearTimeout?.(timer);
      if (message?.success === false) reject(new Error(clean(message?.error?.message) || "todo"));
      else resolve(message?.result);
    };
    try {
      socket.send(JSON.stringify({ ...payload, id }));
    } catch (error) {
      root.clearTimeout?.(timer);
      delete pending[id];
      reject(error);
    }
  });
}

function record(entity) {
  let value = state.lists.get(entity);
  if (!value) {
    value = { items: null, fetchedAt: 0, inflight: false };
    state.lists.set(entity, value);
  }
  return value;
}

async function fetchItems(entity, { force = false } = {}) {
  const cache = record(entity);
  const now = Date.now();
  if (cache.inflight) return;
  if (!force && cache.items && now - cache.fetchedAt < STALE_MS) return;
  cache.inflight = true;
  try {
    const result = await askHomeAssistant({
      type: "call_service",
      domain: "todo",
      service: "get_items",
      target: { entity_id: entity },
      return_response: true,
    });
    cache.items = parseTodoItemsResponse(result, entity);
    cache.fetchedAt = Date.now();
  } catch (error) {
    root.console?.warn?.("[DashboardModern] todo items", error);
  }
  cache.inflight = false;
  schedule();
}

async function callHa(domain, servizio, payload) {
  try {
    if (typeof root.dmCallHaService === "function")
      return await root.dmCallHaService(domain, servizio, payload);
    if (typeof root.callService === "function")
      return await root.callService(domain, servizio, payload);
    return await (root.hass || root._hass)?.callService?.(domain, servizio, payload);
  } catch (error) {
    root.console?.error?.("[DashboardModern] widget service", error);
    return undefined;
  }
}

async function completeItem(list, uid, summary) {
  const cache = record(list.entity);
  const item = (cache.items || []).find(
    (value) => (uid && value.uid === uid) || (!uid && value.summary === summary),
  );
  if (!item || item.status === "completed") return;
  // Ottimista: la voce si barra subito e resta visibile qualche secondo, poi
  // la rilettura la fa sparire con la verita' di Home Assistant.
  item.status = "completed";
  item.localDone = true;
  schedule();
  const payload = { entity_id: list.entity, item: item.uid || item.summary, status: "completed" };
  const esito = await callHa("todo", "update_item", payload);
  if (esito === undefined) {
    item.status = "needs_action";
    item.localDone = false;
    schedule();
    return;
  }
  root.setTimeout?.(() => fetchItems(list.entity, { force: true }), 4000);
}

/* ── i modelli dei widget ─────────────────────────────────────────────── */

function localToday() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

function todoModel() {
  const lists = configuredTodoLists();
  if (!lists.length) return null;
  let pending = 0;
  let total = 0;
  const blocks = lists.map((list) => {
    const items = record(list.entity).items;
    const open = pendingTodoItems(items || []);
    pending += open.length;
    total += (items || []).length;
    return { list, items };
  });
  const percent = total ? Math.round(((total - pending) / total) * 100) : 0;
  return { key: "todo", accent: "#059669", icon: "✅", label: t("Da fare", "To-do"),
    value: String(pending), caption: t(`${pending} da fare`, `${pending} to do`),
    ring: percent, blocks };
}

function lightsModel(states) {
  let groups = [];
  try {
    groups = configuredLightGroups();
  } catch (_error) {
    return null;
  }
  const rows = groups.flatMap((group) =>
    group.entities.map((entity) => ({
      entity,
      room: group.room,
      name: clean(group.lights?.[entity]) || entity.split(".")[1]?.replaceAll("_", " ") || entity,
      on: clean(stateOf(states, entity)?.state).toLowerCase() === "on",
    })),
  );
  if (!rows.length) return null;
  const on = rows.filter((row) => row.on);
  return { key: "luci", accent: "#f59e0b", icon: "💡", label: t("Luci", "Lights"),
    value: String(on.length), caption: t(`${on.length} accese`, `${on.length} on`),
    ring: Math.round((on.length / rows.length) * 100), rows, on };
}

function climateModel(states) {
  let units = [];
  try {
    units = readClimateUnits();
  } catch (_error) {
    return null;
  }
  const rows = units
    .map((unit) => {
      const entity = clean(unit?.entity || unit?.entity_id || unit?.entities?.[0]);
      if (!entity) return null;
      const current = stateOf(states, entity);
      const raw = clean(current?.state).toLowerCase();
      return {
        entity,
        name: clean(unit?.name) || entity,
        on: Boolean(current) && raw !== "off" && raw !== "unavailable" && raw !== "unknown",
        mode: raw,
        ambient: Number.isFinite(Number(current?.attributes?.current_temperature))
          ? Number(current.attributes.current_temperature)
          : null,
        target: Number.isFinite(Number(current?.attributes?.temperature))
          ? Number(current.attributes.temperature)
          : null,
      };
    })
    .filter(Boolean);
  if (!rows.length) return null;
  const on = rows.filter((row) => row.on);
  const ambient = rows.map((row) => row.ambient).filter((value) => value !== null);
  const average = ambient.length
    ? ambient.reduce((sum, value) => sum + value, 0) / ambient.length
    : null;
  return { key: "clima", accent: "#0ea5e9", icon: "❄️", label: t("Clima", "Climate"),
    value: average == null ? String(on.length) : `${formatNumber(average, 1)}°`,
    caption: t(`${on.length} accese`, `${on.length} on`),
    ring: Math.round((on.length / rows.length) * 100), rows };
}

function coversModel(states) {
  const values = root.getTapparelle?.() || readJson("cd_tapparelle", []);
  if (!Array.isArray(values) || !values.length) return null;
  const rows = values
    .map((item) => {
      const entity = clean(item?.entity || item?.entities?.[0]);
      if (!entity) return null;
      const current = stateOf(states, entity);
      const raw = clean(current?.state).toLowerCase();
      const position = Number(current?.attributes?.current_position);
      const open = raw === "open" || raw === "opening" || (Number.isFinite(position) && position > 0);
      return {
        entity,
        name: clean(item?.name) || entity,
        open,
        position: Number.isFinite(position) ? Math.round(position) : null,
        isCover: /^cover\./i.test(entity),
      };
    })
    .filter(Boolean);
  if (!rows.length) return null;
  const open = rows.filter((row) => row.open);
  return { key: "tapparelle", accent: "#8b5cf6", icon: "🪟", label: t("Tapparelle", "Shutters"),
    value: String(open.length), caption: t(`${open.length} aperte`, `${open.length} open`),
    ring: Math.round((open.length / rows.length) * 100), rows };
}

function securityModel(states) {
  const alarm = stateOf(states, "dm.security_centrale_allarme");
  const doors = normalizeSecurityDoors(readJson("cd_security_doors", []));
  let cameras = [];
  try {
    cameras = root.getCameras?.() || [];
  } catch (_error) {}
  if (!alarm && !doors.length && !cameras.length) return null;
  const raw = clean(alarm?.state).toLowerCase();
  const triggered = raw === "triggered" || raw === "pending";
  const armed = raw.startsWith("armed");
  const value = !alarm
    ? "—"
    : triggered
      ? t("Allarme!", "Alarm!")
      : armed
        ? t("Inserito", "Armed")
        : t("Disinserito", "Disarmed");
  return { key: "sicurezza", accent: triggered ? "#e11d48" : "#10b981", icon: "🛡️",
    label: t("Sicurezza", "Security"), value,
    caption: cameras.length ? t(`${cameras.length} telecamere`, `${cameras.length} cameras`) : "",
    ring: armed || triggered ? 100 : 0, doors, cameras: cameras.length, alarm: Boolean(alarm), armed, triggered };
}

/* Watt leggibili: sotto il migliaio il numero intero, sopra i kW con due
 * decimali — «1.240 W» non sta in una tessera, «1,24 kW» si'. */
function formatWatts(value) {
  if (value == null) return "—";
  const absolute = Math.abs(value);
  if (absolute >= 1000) return `${formatNumber(value / 1000, 2)} kW`;
  return `${formatNumber(value, 0)} W`;
}

const ENERGY_SLOTS = Object.freeze([
  ["house", "power", "dm.energy_potenza_consumo_casa"],
  ["solar", "power", "dm.energy_potenza_fotovoltaico"],
  ["grid", "power", "dm.energy_potenza_scambio_rete"],
  ["battery", "power", "dm.energy_potenza_batteria"],
]);

function energyModel(states) {
  const model = section("energy", {}) || {};
  const readings = ENERGY_SLOTS.map(([group, field, slot]) => ({
    group,
    watts: numOf(states, clean(model?.[group]?.[field]) || slot),
  }));
  const house = readings.find((row) => row.group === "house")?.watts ?? null;
  const today = numOf(states, clean(model?.house?.daily_energy) || "dm.energy_consumo_casa_oggi");
  const rows = readings.filter((row) => row.watts != null);
  if (house == null && !rows.length) return null;
  return { key: "energia", accent: "#f97316", icon: "⚡", label: t("Energia", "Energy"),
    value: formatWatts(house),
    caption: today == null ? t("potenza di casa", "home power") : `${t("Oggi", "Today")} ${formatNumber(today, 1)} kWh`,
    ring: null, rows, today };
}

function appliancesModel(states) {
  const devices = section("appliances", readJson("cd_appliances", []));
  if (!Array.isArray(devices) || !devices.length) return null;
  const rows = devices
    .filter((device) => device?.enabled !== false)
    .map((device) => {
      const model = createApplianceViewModel(device, states, [], "it");
      return { id: model.id || clean(device.id), name: model.name, mode: model.mode, watts: model.watts };
    });
  if (!rows.length) return null;
  const running = rows.filter((row) => row.mode === "running");
  return { key: "elettrodomestici", accent: "#06b6d4", icon: "🫧",
    label: t("Elettrodomestici", "Appliances"), value: String(running.length),
    caption: t("in funzione", "running"),
    ring: Math.round((running.length / rows.length) * 100), rows, running };
}

function temperatureModel(states) {
  const rooms = root.getStanze?.() || readJson("cd_stanze", []);
  if (!Array.isArray(rooms)) return null;
  const rows = rooms
    .filter((room) => clean(room?.temp))
    .map((room) => {
      const temperature = numOf(states, room.temp);
      const humidity = numOf(states, clean(room.hum) || clean(room.temp).replace("_temperature", "_humidity"));
      return { name: clean(room.name) || clean(room.id), temperature, humidity };
    })
    .filter((row) => row.temperature != null);
  if (!rows.length) return null;
  const average = rows.reduce((sum, row) => sum + row.temperature, 0) / rows.length;
  const humidities = rows.map((row) => row.humidity).filter((value) => value != null);
  const humidity = humidities.length
    ? Math.round(humidities.reduce((sum, value) => sum + value, 0) / humidities.length)
    : null;
  return { key: "temperatura", accent: "#ef4444", icon: "🌡️",
    label: t("Temperatura", "Temperature"), value: `${formatNumber(average, 1)}°`,
    caption: humidity == null ? "" : `${t("Umidità", "Humidity")} ${humidity}%`,
    ring: null, rows };
}

function widgetModels(states) {
  return [
    todoModel(states),
    lightsModel(states),
    climateModel(states),
    coversModel(states),
    securityModel(states),
    energyModel(states),
    appliancesModel(states),
    temperatureModel(states),
  ].filter(Boolean);
}

/* ── markup: le tessere ───────────────────────────────────────────────── */

function ringMarkup(widget) {
  if (widget.ring == null)
    return `<span class="dm-tile-ic" aria-hidden="true">${widget.icon}</span>`;
  return `<span class="dm-tile-ring" style="--dm-ring-pct:${widget.ring}" aria-hidden="true"><i>${widget.icon}</i></span>`;
}

function tileMarkup(widget) {
  const open = state.expanded === widget.key;
  return `<button type="button" class="dm-tile" data-dm-widget="${widget.key}" data-open="${open}"
      style="--dm-widget-accent:${widget.accent}" aria-expanded="${open}" aria-label="${esc(widget.label)}">
      ${ringMarkup(widget)}
      <span class="dm-tile-copy">
        <b class="dm-tile-value" data-dm-tile-value>${esc(widget.value)}</b>
        <span class="dm-tile-label">${esc(widget.label)}</span>
        <small class="dm-tile-caption" data-dm-tile-caption>${esc(widget.caption)}</small>
      </span>
      <span class="dm-tile-chevron" aria-hidden="true">⌄</span>
    </button>`;
}

/* ── markup: i dettagli ───────────────────────────────────────────────── */

function rowShell(inner, attrs = "") {
  return `<div class="dm-w-row" ${attrs}>${inner}</div>`;
}

function todoItemMarkup(list, item, today) {
  const done = item.status === "completed";
  const dueDay = item.due ? item.due.slice(0, 10) : "";
  const overdue = !done && dueDay && dueDay < today;
  const due = dueDay
    ? `<span class="dm-todo-due"${overdue ? ' data-overdue="true"' : ""}>${overdue ? "⚠️" : "📅"} ${esc(dueDay)}</span>`
    : "";
  return `<li class="dm-todo-item${done ? " is-done" : ""}">
      <button type="button" class="dm-todo-check" data-dm-todo-check data-dm-todo-list="${esc(list.id)}"
        data-dm-todo-uid="${esc(item.uid)}" data-dm-todo-summary="${esc(item.summary)}"
        aria-label="${esc(t(`Segna fatta: ${item.summary}`, `Mark done: ${item.summary}`))}"${done ? " disabled" : ""}></button>
      <span class="dm-todo-text">${esc(item.summary)}${due}</span>
    </li>`;
}

function todoDetail(widget) {
  const today = localToday();
  return widget.blocks
    .map(({ list, items }) => {
      const open = pendingTodoItems(items || []);
      const shown = (items || [])
        .filter((item) => item.status !== "completed" || item.localDone)
        .slice(0, MAX_VISIBLE_ITEMS);
      const extra = open.length - shown.filter((item) => item.status !== "completed").length;
      let body;
      if (items === null) body = `<p class="dm-w-empty">${esc(t("Caricamento…", "Loading…"))}</p>`;
      else if (!shown.length) body = `<p class="dm-w-empty">✨ ${esc(t("Tutto fatto", "All done"))}</p>`;
      else
        body = `<ul class="dm-todo-items">${shown.map((item) => todoItemMarkup(list, item, today)).join("")}</ul>${
          extra > 0 ? `<p class="dm-w-empty">${esc(t(`+${extra} altre voci`, `+${extra} more items`))}</p>` : ""
        }`;
      return `<div class="dm-w-block"><span class="dm-w-block-title">${esc(clean(list.name) || list.entity)}</span>${body}</div>`;
    })
    .join("");
}

function lightsDetail(widget) {
  if (!widget.on.length && !widget.rows.length) return "";
  const rows = [...widget.rows].sort((a, b) => Number(b.on) - Number(a.on)).slice(0, 14);
  return rows
    .map((row) =>
      rowShell(
        `<span class="dm-w-dot" data-on="${row.on}" aria-hidden="true"></span>
         <span class="dm-w-name">${esc(row.name)}<small>${esc(row.room)}</small></span>
         <button type="button" class="dm-w-switch" data-dm-w-light="${esc(row.entity)}" data-on="${row.on}"
           aria-label="${esc(row.name)}"><i></i></button>`,
      ),
    )
    .join("");
}

function climateDetail(widget) {
  return widget.rows
    .map((row) =>
      rowShell(
        `<span class="dm-w-dot" data-on="${row.on}" aria-hidden="true"></span>
         <span class="dm-w-name">${esc(row.name)}<small>${
           row.ambient == null ? "" : `${formatNumber(row.ambient, 1)}°`
         }${row.on && row.target != null ? ` → ${formatNumber(row.target, 1)}°` : ""}</small></span>
         <button type="button" class="dm-w-power" data-dm-w-clima="${esc(row.entity)}" data-on="${row.on}"
           aria-label="${esc(row.name)}">⏻</button>`,
      ),
    )
    .join("");
}

function coversDetail(widget) {
  return widget.rows
    .map((row) =>
      rowShell(
        `<span class="dm-w-dot" data-on="${row.open}" aria-hidden="true"></span>
         <span class="dm-w-name">${esc(row.name)}<small>${
           row.position == null ? "" : `${row.position}%`
         }</small></span>
         ${
           row.isCover
             ? `<span class="dm-w-arrows">
                 <button type="button" data-dm-w-cover="${esc(row.entity)}" data-svc="open_cover" aria-label="▲">▲</button>
                 <button type="button" data-dm-w-cover="${esc(row.entity)}" data-svc="stop_cover" aria-label="■">■</button>
                 <button type="button" data-dm-w-cover="${esc(row.entity)}" data-svc="close_cover" aria-label="▼">▼</button>
               </span>`
             : ""
         }`,
      ),
    )
    .join("");
}

function securityDetail(widget, states) {
  const parts = [];
  if (widget.alarm) {
    parts.push(
      rowShell(
        `<span class="dm-w-dot" data-on="${widget.armed || widget.triggered}" aria-hidden="true"></span>
         <span class="dm-w-name">${esc(t("Antifurto", "Alarm"))}<small>${esc(widget.value)}</small></span>`,
      ),
    );
  }
  for (const door of widget.doors) {
    const raw = clean(stateOf(states, door.entity)?.state).toLowerCase();
    const label =
      raw === "locked"
        ? t("Chiusa a chiave", "Locked")
        : raw === "unlocked"
          ? t("Sbloccata", "Unlocked")
          : raw === "open"
            ? t("Aperta", "Open")
            : "";
    parts.push(
      rowShell(
        `<span class="dm-w-glyph" aria-hidden="true">${esc(door.icon)}</span>
         <span class="dm-w-name">${esc(door.name || door.entity)}<small>${esc(label)}</small></span>
         ${door.pin ? '<span class="dm-w-glyph" aria-hidden="true">🔒</span>' : ""}`,
      ),
    );
  }
  return parts.join("");
}

function energyDetail(widget) {
  const names = {
    house: t("Casa", "House"),
    solar: t("Solare", "Solar"),
    grid: t("Rete", "Grid"),
    battery: t("Batteria", "Battery"),
  };
  const glyphs = { house: "🏠", solar: "☀️", grid: "🔌", battery: "🔋" };
  return widget.rows
    .map((row) =>
      rowShell(
        `<span class="dm-w-glyph" aria-hidden="true">${glyphs[row.group]}</span>
         <span class="dm-w-name">${esc(names[row.group])}</span>
         <b class="dm-w-val">${formatWatts(row.watts)}</b>`,
      ),
    )
    .join("");
}

function appliancesDetail(widget) {
  if (!widget.running.length)
    return `<p class="dm-w-empty">✨ ${esc(t("Tutto spento", "Everything off"))}</p>`;
  return widget.running
    .map((row) =>
      rowShell(
        `<span class="dm-w-dot" data-on="true" aria-hidden="true"></span>
         <span class="dm-w-name">${esc(row.name)}</span>
         <b class="dm-w-val">${row.watts == null ? "" : formatWatts(row.watts)}</b>`,
      ),
    )
    .join("");
}

function temperatureDetail(widget) {
  return widget.rows
    .map((row) =>
      rowShell(
        `<span class="dm-w-glyph" aria-hidden="true">🌡️</span>
         <span class="dm-w-name">${esc(row.name)}</span>
         <b class="dm-w-val">${formatNumber(row.temperature, 1)}°${
           row.humidity == null ? "" : ` · ${Math.round(row.humidity)}%`
         }</b>`,
      ),
    )
    .join("");
}

function detailBody(widget, states) {
  if (widget.key === "todo") return todoDetail(widget);
  if (widget.key === "luci") return lightsDetail(widget);
  if (widget.key === "clima") return climateDetail(widget);
  if (widget.key === "tapparelle") return coversDetail(widget);
  if (widget.key === "sicurezza") return securityDetail(widget, states);
  if (widget.key === "energia") return energyDetail(widget);
  if (widget.key === "elettrodomestici") return appliancesDetail(widget);
  if (widget.key === "temperatura") return temperatureDetail(widget);
  return "";
}

function detailMarkup(widget, states) {
  return `<article class="dm-widget-detail" data-dm-widget-detail="${widget.key}"
      style="--dm-widget-accent:${widget.accent}">
      <header class="dm-w-head">
        <span class="dm-w-head-ic" aria-hidden="true">${widget.icon}</span>
        <strong>${esc(widget.label)}</strong>
        <small data-dm-detail-caption>${esc(widget.caption)}</small>
        <button type="button" class="dm-w-close" data-dm-widget-close aria-label="${esc(t("Chiudi", "Close"))}">✕</button>
      </header>
      <div class="dm-w-body">${detailBody(widget, states)}</div>
    </article>`;
}

/* ── rendering ────────────────────────────────────────────────────────── */

function ensureHost() {
  const page = doc?.getElementById?.("page-home");
  if (!page) return null;
  let host = doc.getElementById("dm-widgets");
  if (host) return host;
  host = doc.createElement("section");
  host.id = "dm-widgets";
  host.innerHTML = `<div class="dm-widgets-head">
      <span class="dm-widgets-ic" aria-hidden="true">🧩</span>
      <div class="dm-widgets-copy">
        <h3 class="dm-widgets-title"></h3>
        <p class="dm-widgets-sub"></p>
      </div>
    </div>
    <div class="dm-widgets-grid"></div>`;
  // Sotto le persone di casa quando ci sono, altrimenti sotto le pastiglie:
  // sempre prima del Quadro Avvisi.
  const people = doc.getElementById("dm-people");
  const pills = doc.getElementById("dashboard-pills-row");
  if (people?.parentElement === page) people.after(host);
  else if (pills?.parentElement === page) pills.after(host);
  else page.prepend(host);
  return host;
}

/* La struttura e' cio' che c'e', non quanto vale: quali tessere, quale e'
 * aperta. Cambia lei → si rifa' il markup, ed e' l'unico momento in cui
 * l'apertura anima; cambiano i valori → si scrivono al loro posto, e il corpo
 * del dettaglio si riscrive da dentro senza rifare la card — o l'ingresso
 * ripartirebbe a ogni evento di stato. */
function structureSignature(models) {
  return [
    state.expanded,
    models.map((widget) => `${widget.key}:${widget.ring == null ? "flat" : "ring"}`).join("|"),
  ].join("§");
}

export function renderHomeWidgets() {
  const states = allStates();
  const models = widgetModels(states);
  const host = doc?.getElementById?.("dm-widgets");
  if (!models.length) {
    host?.remove();
    state.signature = "";
    return false;
  }
  const mounted = host || ensureHost();
  if (!mounted) return false;
  const title = mounted.querySelector(".dm-widgets-title");
  if (title) title.textContent = t("In primo piano", "At a glance");
  const sub = mounted.querySelector(".dm-widgets-sub");
  if (sub) sub.textContent = t("I widget della tua giornata", "Your day's widgets");

  if (state.expanded && !models.some((widget) => widget.key === state.expanded)) state.expanded = "";
  const grid = mounted.querySelector(".dm-widgets-grid");
  if (!grid) return false;

  const signature = structureSignature(models);
  if (state.signature !== signature || !grid.firstElementChild) {
    state.signature = signature;
    grid.innerHTML = models
      .map((widget) => {
        const tile = tileMarkup(widget);
        return state.expanded === widget.key ? tile + detailMarkup(widget, states) : tile;
      })
      .join("");
  } else {
    // Solo i valori: la tessera resta dov'e', l'apertura non riparte.
    for (const widget of models) {
      const tile = grid.querySelector(`[data-dm-widget="${CSS.escape(widget.key)}"]`);
      if (!tile) continue;
      tile.style.setProperty("--dm-widget-accent", widget.accent);
      const value = tile.querySelector("[data-dm-tile-value]");
      if (value && value.textContent !== widget.value) value.textContent = widget.value;
      const caption = tile.querySelector("[data-dm-tile-caption]");
      if (caption && caption.textContent !== widget.caption) caption.textContent = widget.caption;
      const ring = tile.querySelector(".dm-tile-ring");
      if (ring && widget.ring != null) ring.style.setProperty("--dm-ring-pct", String(widget.ring));
      if (state.expanded === widget.key) {
        const captionDetail = grid.querySelector("[data-dm-detail-caption]");
        if (captionDetail && captionDetail.textContent !== widget.caption)
          captionDetail.textContent = widget.caption;
        const body = grid.querySelector(".dm-w-body");
        const markup = detailBody(widget, states);
        if (body && body.innerHTML !== markup) body.innerHTML = markup;
      }
    }
  }

  for (const list of configuredTodoLists()) fetchItems(list.entity);
  return true;
}

function schedule() {
  if (state.frame) return;
  const run = () => {
    state.frame = 0;
    try {
      renderHomeWidgets();
    } catch (error) {
      root.console?.warn?.("[DashboardModern] home widgets", error);
    }
  };
  state.frame = root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 0) || 0;
}

/* ── interazione ──────────────────────────────────────────────────────── */

function toggleExpand(key) {
  state.expanded = state.expanded === key ? "" : clean(key);
  state.signature = "";
  schedule();
}

function onClick(event) {
  const check = event.target?.closest?.("[data-dm-todo-check]");
  if (check && !check.disabled) {
    event.preventDefault();
    const list = configuredTodoLists().find((value) => value.id === clean(check.dataset.dmTodoList));
    if (list) completeItem(list, clean(check.dataset.dmTodoUid), clean(check.dataset.dmTodoSummary));
    return;
  }
  const light = event.target?.closest?.("[data-dm-w-light]");
  if (light) {
    event.preventDefault();
    const entity = clean(light.dataset.dmWLight);
    // Ottimista: l'interruttore scatta subito, lo stato vero arriva col
    // prossimo evento e conferma o corregge.
    light.dataset.on = String(light.dataset.on !== "true");
    callHa(entity.split(".")[0] || "light", "toggle", { entity_id: entity });
    return;
  }
  const clima = event.target?.closest?.("[data-dm-w-clima]");
  if (clima) {
    event.preventDefault();
    root.toggleClima?.(clean(clima.dataset.dmWClima));
    root.setTimeout?.(schedule, 400);
    return;
  }
  const cover = event.target?.closest?.("[data-dm-w-cover]");
  if (cover) {
    event.preventDefault();
    callHa("cover", clean(cover.dataset.svc), { entity_id: clean(cover.dataset.dmWCover) });
    return;
  }
  if (event.target?.closest?.("[data-dm-widget-close]")) {
    event.preventDefault();
    toggleExpand(state.expanded);
    return;
  }
  const tile = event.target?.closest?.("[data-dm-widget]");
  if (tile) {
    event.preventDefault();
    toggleExpand(tile.dataset.dmWidget);
  }
}

function stateChangeTouchesTodo(event) {
  const values = event?.detail?.entity_ids || [event?.detail?.entity_id];
  const changed = new Set((Array.isArray(values) ? values : [values]).map(clean).filter(Boolean));
  if (!changed.size) return false;
  return configuredTodoLists().some((list) => changed.has(list.entity));
}

/* ── stile ────────────────────────────────────────────────────────────── */

function installStyles() {
  installStyle(STYLE_ID, `
/* ── «In primo piano»: il ponte dei widget della Home ─────────────────── */
#dm-widgets{display:block;margin:16px 0 6px}
#dm-widgets .dm-widgets-head{display:flex;align-items:center;gap:12px;padding:0 4px 12px}
#dm-widgets .dm-widgets-ic{
  width:44px;height:44px;flex:0 0 44px;display:grid;place-items:center;font-size:21px;
  border-radius:14px;background:linear-gradient(140deg,#dbeafe,#ede9fe 55%,#dcfce7);
  box-shadow:inset 0 0 0 1px rgba(59,130,246,.14)}
#dm-widgets .dm-widgets-copy{min-width:0;flex:1}
#dm-widgets .dm-widgets-title{
  margin:0;font-family:'Oswald',sans-serif;font-weight:700;
  font-size:clamp(17px,2.2vw,22px);line-height:1.05;letter-spacing:1.8px;
  text-transform:uppercase;color:var(--text,#0f172a)}
#dm-widgets .dm-widgets-sub{margin:2px 0 0;font-size:12px;font-weight:600;color:var(--text-dim,#64748b)}

/* Le tessere: piccole, quiete, con l'anello che racconta e la freccia che
   promette. L'accento vive nei dettagli — l'anello, il fianco, il bagliore
   all'apertura — mai su tutta la tessera. */
#dm-widgets .dm-widgets-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(176px,1fr));gap:10px}
#dm-widgets .dm-tile{
  position:relative;display:flex;align-items:center;gap:11px;min-height:74px;
  padding:12px 13px;border:1px solid var(--card-border,#e8edf3);border-radius:18px;
  background:var(--card-bg,#fff);color:var(--text,#0f172a);font:inherit;text-align:left;cursor:pointer;
  box-shadow:0 6px 18px rgba(15,23,42,.05);
  transition:transform .3s cubic-bezier(.16,1,.3,1),box-shadow .3s ease,border-color .3s ease}
#dm-widgets .dm-tile::before{
  content:"";position:absolute;left:0;top:14px;bottom:14px;width:3px;border-radius:0 3px 3px 0;
  background:var(--dm-widget-accent,#0ea5e9);opacity:.55;transition:opacity .3s ease}
#dm-widgets .dm-tile:hover{transform:translateY(-2px);box-shadow:0 12px 26px rgba(15,23,42,.10)}
#dm-widgets .dm-tile:hover::before{opacity:1}
#dm-widgets .dm-tile[data-open="true"]{
  border-color:color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 45%,transparent);
  box-shadow:0 12px 30px color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 22%,rgba(15,23,42,.08))}
#dm-widgets .dm-tile-ic{
  width:40px;height:40px;flex:0 0 40px;display:grid;place-items:center;font-size:19px;border-radius:50%;
  background:color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 13%,var(--surface-3,#f1f5f9))}
#dm-widgets .dm-tile-ring{
  width:40px;height:40px;flex:0 0 40px;display:grid;place-items:center;border-radius:50%;
  background:conic-gradient(from -90deg,var(--dm-widget-accent,#0ea5e9) 0 calc(var(--dm-ring-pct,0) * 1%),var(--surface-3,#e2e8f0) 0);
  transition:background .6s linear}
#dm-widgets .dm-tile-ring i{
  display:grid;place-items:center;width:31px;height:31px;border-radius:50%;font-style:normal;font-size:14px;
  background:var(--card-bg,#fff);box-shadow:inset 0 0 0 1px var(--card-border,#e8edf3)}
#dm-widgets .dm-tile-copy{min-width:0;flex:1;display:grid;gap:0}
#dm-widgets .dm-tile-value{
  font-family:'Oswald',sans-serif;font-size:19px;font-weight:700;line-height:1.1;letter-spacing:.2px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#dm-widgets .dm-tile-label{
  font-size:9.5px;font-weight:900;letter-spacing:.8px;text-transform:uppercase;color:var(--text-dim,#64748b);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#dm-widgets .dm-tile-caption{
  font-size:10.5px;font-weight:700;color:var(--text-dim,#94a3b8);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#dm-widgets .dm-tile-chevron{
  flex:0 0 auto;font-size:13px;color:var(--text-dim,#94a3b8);
  transition:transform .3s cubic-bezier(.16,1,.3,1)}
#dm-widgets .dm-tile[data-open="true"] .dm-tile-chevron{transform:rotate(180deg);color:var(--dm-widget-accent,#0ea5e9)}

/* Il dettaglio: si apre sotto la tessera, largo quanto il ponte, col nastro
   d'accento e l'ingresso morbido. */
#dm-widgets .dm-widget-detail{
  grid-column:1/-1;position:relative;overflow:hidden;
  border:1px solid color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 26%,var(--card-border,#e8edf3));
  border-radius:20px;background:var(--card-bg,#fff);
  box-shadow:0 16px 36px rgba(15,23,42,.10);
  animation:dmWidgetIn .32s cubic-bezier(.16,1,.3,1)}
#dm-widgets .dm-widget-detail::before{
  content:"";position:absolute;top:0;left:0;right:0;height:3px;
  background:linear-gradient(90deg,transparent,var(--dm-widget-accent,#0ea5e9) 30%,var(--dm-widget-accent,#0ea5e9) 70%,transparent)}
@keyframes dmWidgetIn{from{opacity:0;transform:translateY(-7px) scale(.985)}to{opacity:1;transform:none}}
#dm-widgets .dm-w-head{display:flex;align-items:center;gap:9px;padding:13px 16px 10px}
#dm-widgets .dm-w-head-ic{font-size:16px}
#dm-widgets .dm-w-head strong{
  font-size:12.5px;font-weight:900;letter-spacing:1px;text-transform:uppercase}
#dm-widgets .dm-w-head small{flex:1;min-width:0;font-size:11px;font-weight:700;color:var(--text-dim,#94a3b8);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#dm-widgets .dm-w-close{
  flex:0 0 28px;width:28px;height:28px;display:grid;place-items:center;border:0;border-radius:9px;
  background:var(--surface-3,#f1f5f9);color:var(--text-dim,#64748b);font-size:12px;cursor:pointer}
#dm-widgets .dm-w-body{display:grid;gap:2px;padding:0 10px 12px}
#dm-widgets .dm-w-row{
  display:flex;align-items:center;gap:11px;min-height:42px;padding:5px 8px;border-radius:12px;
  transition:background .2s ease}
#dm-widgets .dm-w-row:hover{background:var(--surface-3,#f1f5f9)}
#dm-widgets .dm-w-dot{
  flex:0 0 8px;width:8px;height:8px;border-radius:50%;
  background:color-mix(in srgb,var(--text-dim,#94a3b8) 45%,transparent)}
#dm-widgets .dm-w-dot[data-on="true"]{
  background:var(--dm-widget-accent,#0ea5e9);
  box-shadow:0 0 0 3px color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 20%,transparent)}
#dm-widgets .dm-w-glyph{flex:0 0 auto;font-size:15px}
#dm-widgets .dm-w-name{min-width:0;flex:1;display:grid;gap:0;font-size:13px;font-weight:700;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#dm-widgets .dm-w-name small{font-size:10.5px;font-weight:700;color:var(--text-dim,#94a3b8)}
#dm-widgets .dm-w-val{flex:0 0 auto;font-family:'Oswald',sans-serif;font-size:14px;font-weight:600}
#dm-widgets .dm-w-empty{margin:4px 8px;font-size:12.5px;font-weight:700;color:var(--text-dim,#64748b)}
#dm-widgets .dm-w-block{padding:4px 6px 6px}
#dm-widgets .dm-w-block-title{
  display:block;padding:4px 2px 7px;font-size:10.5px;font-weight:900;letter-spacing:1px;
  text-transform:uppercase;color:var(--text-dim,#64748b)}

/* L'interruttore delle luci: una pillola che scatta. */
#dm-widgets .dm-w-switch{
  flex:0 0 40px;width:40px;height:23px;position:relative;border:0;border-radius:999px;cursor:pointer;
  background:color-mix(in srgb,var(--text-dim,#94a3b8) 32%,transparent);transition:background .25s ease}
#dm-widgets .dm-w-switch i{
  position:absolute;top:2.5px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;
  box-shadow:0 2px 6px rgba(15,23,42,.25);transition:transform .25s cubic-bezier(.16,1,.3,1)}
#dm-widgets .dm-w-switch[data-on="true"]{background:var(--dm-widget-accent,#f59e0b)}
#dm-widgets .dm-w-switch[data-on="true"] i{transform:translateX(16px)}
#dm-widgets .dm-w-power{
  flex:0 0 32px;width:32px;height:32px;display:grid;place-items:center;border-radius:50%;cursor:pointer;
  border:1.5px solid var(--card-border,#e8edf3);background:transparent;color:var(--text-dim,#94a3b8);
  font-size:14px;transition:all .25s ease}
#dm-widgets .dm-w-power[data-on="true"]{
  border-color:transparent;background:var(--dm-widget-accent,#0ea5e9);color:#fff;
  box-shadow:0 4px 12px color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 40%,transparent)}
#dm-widgets .dm-w-arrows{display:inline-flex;gap:5px}
#dm-widgets .dm-w-arrows button{
  width:29px;height:29px;display:grid;place-items:center;border-radius:9px;cursor:pointer;
  border:1px solid var(--card-border,#e8edf3);background:var(--surface-3,#f1f5f9);
  color:var(--text,#0f172a);font-size:11px;transition:all .2s ease}
#dm-widgets .dm-w-arrows button:hover{
  background:var(--dm-widget-accent,#8b5cf6);border-color:transparent;color:#fff}

/* Le voci ToDo dentro il dettaglio. */
#dm-widgets .dm-todo-items{list-style:none;margin:0;padding:0 2px;display:grid;gap:8px}
#dm-widgets .dm-todo-item{display:flex;align-items:flex-start;gap:10px;min-width:0}
#dm-widgets .dm-todo-check{
  position:relative;flex:0 0 21px;width:21px;height:21px;margin-top:1px;border-radius:50%;cursor:pointer;
  border:2px solid color-mix(in srgb,var(--text-dim,#94a3b8) 55%,transparent);background:transparent;padding:0;
  transition:border-color .2s ease,background .25s ease,transform .15s ease}
#dm-widgets .dm-todo-check:hover{border-color:var(--dm-widget-accent,#059669);transform:scale(1.08)}
#dm-widgets .dm-todo-check::after{
  content:"✓";position:absolute;inset:0;display:grid;place-items:center;
  color:#fff;font-size:12px;font-weight:900;opacity:0;transform:scale(.4);
  transition:opacity .2s ease,transform .25s cubic-bezier(.16,1,.3,1)}
#dm-widgets .dm-todo-item.is-done .dm-todo-check{
  border-color:var(--dm-widget-accent,#059669);background:var(--dm-widget-accent,#059669)}
#dm-widgets .dm-todo-item.is-done .dm-todo-check::after{opacity:1;transform:scale(1)}
#dm-widgets .dm-todo-text{min-width:0;font-size:13.5px;font-weight:600;line-height:1.4;overflow-wrap:anywhere}
#dm-widgets .dm-todo-item.is-done .dm-todo-text{color:var(--text-dim,#94a3b8);text-decoration:line-through}
#dm-widgets .dm-todo-due{
  display:inline-flex;align-items:center;gap:3px;margin-left:7px;padding:1px 7px;border-radius:999px;
  background:var(--surface-3,#f1f5f9);border:1px solid var(--card-border,#e8edf3);
  font-size:10.5px;font-weight:800;color:var(--text-dim,#64748b);white-space:nowrap;vertical-align:1px}
#dm-widgets .dm-todo-due[data-overdue="true"]{
  background:rgba(244,63,94,.10);border-color:rgba(244,63,94,.30);color:#be123c}

@media (prefers-reduced-motion:reduce){
  #dm-widgets .dm-tile,#dm-widgets .dm-tile-chevron,#dm-widgets .dm-todo-check,
  #dm-widgets .dm-todo-check::after,#dm-widgets .dm-w-switch,#dm-widgets .dm-w-switch i{transition:none}
  #dm-widgets .dm-widget-detail{animation:none}
}
@media (max-width:520px){
  #dm-widgets .dm-widgets-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
}
`);
}

export function installHomeWidgetsSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  doc.addEventListener("click", onClick);
  for (const eventName of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:persistence-restored",
    "dashboardmodern:config-reset",
    "dashboardmodern:state-changed",
  ])
    root.addEventListener?.(eventName, schedule);
  // Il numero delle voci aperte E' lo stato dell'entita': quando cambia, le
  // voci vanno rilette — la spunta fatta da un altro dispositivo arriva cosi'.
  root.addEventListener?.("dashboardmodern:state-changed", (event) => {
    if (!stateChangeTouchesTodo(event)) return;
    for (const list of configuredTodoLists()) fetchItems(list.entity, { force: true });
  });
  doc.addEventListener(
    "click",
    (event) => {
      if (event.target?.closest?.(".tab[data-tab]")) schedule();
    },
    true,
  );
  doc.addEventListener("visibilitychange", () => schedule());
  schedule();
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", () => installHomeWidgetsSection(), { once: true });
} else {
  installHomeWidgetsSection();
}
