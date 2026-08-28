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
import { createApplianceViewModel, onRunHoldExpiry } from "../core/appliance-view-model.js";
import { canonicalClimateType } from "../core/device-model.js";
import {
  coverEntries,
  coverKindLabel,
  coverPositionChoices,
  coverPresetPosition,
  isRelayEntity,
  relayCoverCommands,
} from "../core/cover-kind.js";
import { doorOpenCall, normalizeSecurityDoors } from "../core/security-door-model.js";
import { normalizeRobots, robotStateLabel, robotView } from "../core/robot-model.js";
import { configuredLightGroups } from "./lights-alerts-section.js";
import { floodEntities, floodIsWet } from "./flood-alerts-section.js";
import { loadCameraFrame } from "./live-ui-section.js";
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
export const WIDGETS_CONFIG_KEY = "cd_widgets";
const STALE_MS = 30000;
/* Quanto si aspetta prima di richiedere le voci a una lista che ha appena
 * risposto con un errore — o non ha risposto affatto. */
const RETRY_MS = 20000;
const MAX_VISIBLE_ITEMS = 8;
const MAX_DETAIL_ROWS = 14;

const state = (root[KEY] ||= {
  installed: false,
  frame: 0,
  expanded: "",
  signature: "",
  escape: false,
  lists: new Map(), // entity -> { items, fetchedAt, inflight }
  cameraTimer: 0,
  cameraUrls: new Map(), // entity -> object URL della tessera, MAI quelli del muro
  /* Quali righe hanno il pannello della rotella aperto. Sta qui e non nel
   * documento perche' il corpo della finestra si ridisegna a ogni giro di
   * stati: se lo stato dell'apertura stesse solo nel documento, il pannello si
   * richiuderebbe da solo appena un termostato manda un grado nuovo. */
  aperti: new Set(),
  /* Quello che si sta scrivendo nella riga «aggiungi», per lista. Il corpo
   * della finestra si riscrive a ogni valore che cambia — e con dieci liste
   * aperte cambia spesso: se la parola a meta' stesse solo nel documento,
   * sparirebbe sotto le dita. */
  bozze: new Map(),
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
    value = { items: null, fetchedAt: 0, inflight: false, failedAt: 0 };
    state.lists.set(entity, value);
  }
  return value;
}

async function fetchItems(entity, { force = false } = {}) {
  const cache = record(entity);
  const now = Date.now();
  if (cache.inflight) return;
  if (!force && cache.items && now - cache.fetchedAt < STALE_MS) return;
  /* Una richiesta fallita non ha lasciato voci, e senza voci la guardia dello
   * scaduto non ferma nessuno: col socket giu' il disegno richiedeva, la
   * richiesta falliva, il fallimento faceva ridisegnare, e il giro ripartiva
   * a ogni fotogramma. Dopo un errore si aspetta prima di riprovare. */
  if (!force && !cache.items && now - cache.failedAt < RETRY_MS) return;
  cache.inflight = true;
  let riuscita = false;
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
    cache.failedAt = 0;
    riuscita = true;
  } catch (error) {
    cache.failedAt = Date.now();
    root.console?.warn?.("[DashboardModern] todo items", error);
  }
  cache.inflight = false;
  // Un fallimento non ha cambiato niente da disegnare: ridisegnare lo stesso
  // vorrebbe dire richiedere di nuovo, subito.
  if (riuscita) schedule();
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

/* Una voce nuova.
 *
 * Ottimista come la spunta: compare subito in fondo alla lista, e la
 * rilettura da Home Assistant qualche istante dopo la conferma — o la toglie,
 * se la chiamata non e' andata. Senza, fra il dito e la comparsa passavano i
 * secondi della rilettura, e sembrava che il tasto non avesse fatto niente. */
async function addItem(list, summary) {
  const testo = clean(summary);
  if (!testo) return;
  const cache = record(list.entity);
  cache.items = [
    ...(cache.items || []),
    { uid: "", summary: testo, status: "needs_action", due: "", localNew: true },
  ];
  state.bozze.delete(list.id);
  schedule();
  const esito = await callHa("todo", "add_item", { entity_id: list.entity, item: testo });
  if (esito === undefined) {
    cache.items = (cache.items || []).filter((voce) => !voce.localNew || voce.summary !== testo);
    schedule();
    return;
  }
  root.setTimeout?.(() => fetchItems(list.entity, { force: true }), 1200);
}

/* Togliere una voce e basta: non e' «fatta», e' «non c'entrava». */
async function removeItem(list, uid, summary) {
  const cache = record(list.entity);
  const voce = (cache.items || []).find(
    (value) => (uid && value.uid === uid) || (!uid && value.summary === summary),
  );
  if (!voce) return;
  const prima = cache.items;
  cache.items = (cache.items || []).filter((value) => value !== voce);
  schedule();
  const esito = await callHa("todo", "remove_item", {
    entity_id: list.entity,
    item: voce.uid || voce.summary,
  });
  if (esito === undefined) {
    cache.items = prima;
    schedule();
    return;
  }
  root.setTimeout?.(() => fetchItems(list.entity, { force: true }), 1200);
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
  const lists = configuredTodoLists().filter((list) => widgetIncludes(list.entity));
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
  const fuori = widgetExcludedEntities();
  const rows = groups.flatMap((group) =>
    group.entities.filter((entity) => widgetIncludes(entity, fuori)).map((entity) => ({
      entity,
      room: group.room,
      name: clean(group.lights?.[entity]) || entity.split(".")[1]?.replaceAll("_", " ") || entity,
      on: clean(stateOf(states, entity)?.state).toLowerCase() === "on",
    })),
  );
  if (!rows.length) return null;
  const on = rows.filter((row) => row.on);
  return { key: "luci", accent: "#f59e0b", icon: "💡", label: t("Luci", "Lights"),
    value: String(on.length),
    caption: nomiAccesi(on, () => true, t(`${on.length} accese`, `${on.length} on`)),
    ring: Math.round((on.length / rows.length) * 100), rows, on };
}

function climateModel(states) {
  let units = [];
  try {
    units = readClimateUnits();
  } catch (_error) {
    return null;
  }
  const fuori = widgetExcludedEntities();
  const rows = units
    .map((unit) => {
      const entity = clean(unit?.entity || unit?.entity_id || unit?.entities?.[0]);
      if (!entity || !widgetIncludes(entity, fuori)) return null;
      const current = stateOf(states, entity);
      const raw = clean(current?.state).toLowerCase();
      const attributi = current?.attributes || {};
      const elenco = (valori) =>
        Array.isArray(valori) ? valori.map(clean).filter(Boolean) : [];
      const numero = (valore, difetto = null) =>
        Number.isFinite(Number(valore)) ? Number(valore) : difetto;
      return {
        entity,
        name: clean(unit?.name) || entity,
        on: Boolean(current) && raw !== "off" && raw !== "unavailable" && raw !== "unknown",
        mode: raw,
        ambient: numero(attributi.current_temperature),
        target: numero(attributi.temperature),
        /* Quello che serve al pannello della rotella: cosa l'unita' accetta, e
         * dove sta adesso. Sono attributi che Home Assistant pubblica gia' —
         * il modello si limita a portarli in riga invece di farli cercare a
         * chi disegna. */
        modi: elenco(attributi.hvac_modes),
        ventole: elenco(attributi.fan_modes),
        ventola: clean(attributi.fan_mode),
        minima: numero(attributi.min_temp, 5),
        massima: numero(attributi.max_temp, 35),
        passo: numero(attributi.target_temp_step, 0.5) || 0.5,
        umidita: numero(attributi.current_humidity),
        azione: clean(attributi.hvac_action),
        /* Che macchina e', non solo cosa sta facendo adesso: un termosifone
         * spento resta un termosifone, e il fiocco di neve sopra un
         * radiatore era il disegno di un'altra casa. */
        tipo: canonicalClimateType(unit?.type),
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
    caption: nomiAccesi(on, () => true, t(`${on.length} accese`, `${on.length} on`)),
    ring: Math.round((on.length / rows.length) * 100), rows };
}

/* La riga del Clima di quell'entita', ricalcolata al momento: serve al passo
 * della temperatura, che deve sapere dove sta l'obiettivo adesso e fin dove
 * quell'unita' lo lascia andare. */
function climateRow(entity) {
  try {
    return climateModel(allStates())?.rows?.find((riga) => riga.entity === entity) || null;
  } catch (_error) {
    return null;
  }
}

function coversModel(states) {
  const values = root.getTapparelle?.() || readJson("cd_tapparelle", []);
  if (!Array.isArray(values) || !values.length) return null;
  const fuori = widgetExcludedEntities();
  /* Una riga puo' portare tapparella, tenda e tenda da sole insieme: la
   * tessera ne mostrava solo la prima, e chi ha le tende in Home non le
   * vedeva. Adesso ogni copertura della riga e' una voce, col suo nome e col
   * suo rele' di discesa. */
  const rows = values
    .flatMap((item) =>
      coverEntries(item).map((voce) => ({
        item,
        voce,
        etichetta:
          coverEntries(item).length > 1 && voce.kind
            ? `${clean(item?.name) || voce.entity} · ${coverKindLabel(voce.kind)}`
            : clean(item?.name) || voce.entity,
      })),
    )
    .map(({ item, voce, etichetta }) => {
      const entity = clean(voce.entity);
      if (!entity || !widgetIncludes(entity, fuori)) return null;
      const current = stateOf(states, entity);
      const raw = clean(current?.state).toLowerCase();
      const position = Number(current?.attributes?.current_position);
      const open = raw === "open" || raw === "opening" || (Number.isFinite(position) && position > 0);
      return {
        entity,
        name: etichetta,
        open,
        position: Number.isFinite(position) ? Math.round(position) : null,
        isCover: /^cover\./i.test(entity),
        // Chi accetta `set_cover_position` (bit 4) si ferma dove gli si dice.
        settable: Boolean(Number(current?.attributes?.supported_features) & 4),
        preset: coverPresetPosition(item),
        /* Una tapparella dietro uno o due rele' (#194): la pagina la comanda
         * gia', e da qui doveva restare a guardare. Le frecce sono le stesse,
         * cambia solo la lingua in cui parlano. */
        relay: isRelayEntity(entity),
        down: clean(voce.down),
      };
    })
    .filter(Boolean);
  if (!rows.length) return null;
  const open = rows.filter((row) => row.open);
  return { key: "tapparelle", accent: "#8b5cf6", icon: "🪟", label: t("Tapparelle", "Shutters"),
    value: String(open.length),
    caption: nomiAccesi(open, () => true, t(`${open.length} aperte`, `${open.length} open`)),
    ring: Math.round((open.length / rows.length) * 100), rows };
}

function securityModel(states) {
  const fuori = widgetExcludedEntities();
  const alarm = stateOf(states, "dm.security_centrale_allarme");
  const doors = normalizeSecurityDoors(readJson("cd_security_doors", [])).filter((door) =>
    widgetIncludes(door.entity, fuori),
  );
  // Senza antifurto e senza aperture non c'e' una sicurezza da raccontare: le
  // telecamere, da sole, sono gia' la loro tessera.
  if (!alarm && !doors.length) return null;
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
  // La didascalia parla di quello che questa tessera comanda — l'antifurto e
  // le aperture — non delle telecamere: quelle hanno la loro tessera, con le
  // miniature, e dirle due volte era dire due volte la stessa cosa.
  return { key: "sicurezza", accent: triggered ? "#e11d48" : "#10b981", icon: "🛡️", alert: triggered,
    label: t("Sicurezza", "Security"), value,
    caption: doors.length ? clean(doors[0].name) || clean(doors[0].entity) : "",
    ring: armed || triggered ? 100 : 0, doors,
    alarm: Boolean(alarm), armed, triggered, mode: raw };
}

/* Watt leggibili: sotto il migliaio il numero intero, sopra i kW con due
 * decimali — «1.240 W» non sta in una tessera, «1,24 kW» si'. */
function formatWatts(value) {
  if (value == null) return "—";
  const absolute = Math.abs(value);
  if (absolute >= 1000) return `${formatNumber(value / 1000, 2)} kW`;
  return `${formatNumber(value, 0)} W`;
}

function camerasModel() {
  let cameras = [];
  try {
    cameras = root.getCameras?.() || [];
  } catch (_error) {}
  const rows = (Array.isArray(cameras) ? cameras : [])
    .map((camera) => ({
      entity: clean(camera?.entity),
      name: clean(camera?.name) || clean(camera?.entity),
    }))
    .filter((row) => row.entity && widgetIncludes(row.entity));
  if (!rows.length) return null;
  return { key: "telecamere", accent: "#0284c7", icon: "📹", label: t("Telecamere", "Cameras"),
    value: String(rows.length), caption: rows[0].name, ring: null, rows };
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
  const fuori = widgetExcludedEntities();
  const rows = devices
    .filter((device) => device?.enabled !== false)
    .filter((device) =>
      widgetIncludes(clean(device?.power_entity || device?.entity || device?.entities?.[0]), fuori),
    )
    .map((device) => {
      const model = createApplianceViewModel(device, states, [], "it");
      return {
        id: model.id || clean(device.id),
        name: model.name,
        mode: model.mode,
        watts: model.watts,
        type: clean(root.cdApplianceType?.(device)) || "generico",
      };
    });
  if (!rows.length) return null;
  const running = rows.filter((row) => row.mode === "running");
  return { key: "elettrodomestici", accent: "#06b6d4", icon: "🫧",
    label: t("Elettrodomestici", "Appliances"), value: String(running.length),
    caption: nomiAccesi(running, () => true, t("in funzione", "running")),
    ring: Math.round((running.length / rows.length) * 100), rows, running };
}

function temperatureModel(states) {
  const rooms = root.getStanze?.() || readJson("cd_stanze", []);
  if (!Array.isArray(rooms)) return null;
  const fuori = widgetExcludedEntities();
  const rows = rooms
    .filter((room) => clean(room?.temp) && widgetIncludes(room.temp, fuori))
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

/* ── le sezioni che mancavano al ponte ────────────────────────────────── */

/* «Lo switch per widget non e' presente in tutte le sezioni: EV, solare
 * termico, eccetera.» L'interruttore accanto a un'entita' dice se quel dato
 * va in Home, e non aveva senso dove una tessera non esisteva. Quindi
 * esistono: l'auto, il solare termico, la piscina e l'irrigazione hanno la
 * loro, con lo stesso mestiere delle altre — un numero, un anello, una
 * parola — e al tocco il dettaglio. */

/* Il riferimento di una entita' mappata, se la scelta la lascia passare. */
function refValue(states, ref, fuori) {
  const risolto = clean(root.resolveEntity?.(ref) || ref);
  if (!risolto || risolto === ref) return null;
  if (!widgetIncludes(risolto, fuori)) return null;
  return { entity: risolto, value: numOf(states, risolto), state: clean(states?.[risolto]?.state) };
}

/* La carica dell'auto sa rispondere a tre nomi.
 *
 * La sezione EV li accetta tutti e tre — quello storico in italiano e i due
 * piu' recenti — e la tessera guardava solo il primo: con una mappatura
 * moderna e senza autonomia configurata, la tessera dell'auto spariva del
 * tutto. Chi legge la stessa cosa deve conoscere gli stessi nomi. */
const RIF_BATTERIA_EV = Object.freeze(["dm.ev_batteria_auto", "dm.ev_battery", "dm.ev_soc"]);

/* Le vetture configurate, ognuna con la SUA mappatura.
 *
 * Il riferimento `dm.ev_batteria_auto` ne indica una sola: quella in uso. E'
 * giusto per la pagina EV — li' si guarda un'auto per volta e si sceglie quale
 * — ma la tessera in Home e' un colpo d'occhio sulla casa, e una casa con due
 * auto ne ha due da guardare. Chi ha due vetture vedeva sempre e solo quella
 * che aveva messo in uso per ultima, senza nessun modo di accorgersi che
 * l'altra era a secco.
 *
 * La mappatura di ciascuna sta nel suo profilo — e' la stessa che «Usa» copia
 * nelle chiavi globali — quindi si legge di li', senza toccare niente. */
function vetture() {
  const elenco = section("ev", readJson("cd_ev_cars", []));
  return (Array.isArray(elenco) ? elenco : []).filter(
    (auto) => auto && typeof auto === "object",
  );
}

function letturaVettura(states, auto, fuori, indice) {
  const mappa = (auto?.ov || auto?.overrides || {}) || {};
  const misura = (riferimento) => {
    const entity = clean(mappa[riferimento]);
    if (!entity || !widgetIncludes(entity, fuori)) return null;
    return { entity, value: numOf(states, entity), state: clean(states?.[entity]?.state) };
  };
  let carica = null;
  for (const riferimento of RIF_BATTERIA_EV) {
    carica = misura(riferimento);
    if (carica) break;
  }
  const autonomia = misura("dm.ev_autonomia");
  const stato = misura("dm.ev_stato_ricarica");
  if (!carica && !autonomia) return null;
  const percentuale = carica?.value == null ? null : Math.max(0, Math.min(100, carica.value));
  return {
    nome: clean(auto?.name) || clean(auto?.model) || `${t("Auto", "Car")} ${indice + 1}`,
    percentuale,
    km: autonomia?.value == null ? null : autonomia.value,
    ricarica: stato?.state || "",
  };
}

/* La lettura dell'auto in uso, dalle chiavi globali: e' la strada di sempre, e
 * resta quella per chi di auto ne ha una sola o non ne ha profilate. */
function letturaAttiva(states, fuori) {
  let carica = null;
  for (const riferimento of RIF_BATTERIA_EV) {
    carica = refValue(states, riferimento, fuori);
    if (carica) break;
  }
  const autonomia = refValue(states, "dm.ev_autonomia", fuori);
  const stato = refValue(states, "dm.ev_stato_ricarica", fuori);
  if (!carica && !autonomia) return null;
  return {
    nome: "",
    percentuale: carica?.value == null ? null : Math.max(0, Math.min(100, carica.value)),
    km: autonomia?.value == null ? null : autonomia.value,
    ricarica: stato?.state || "",
  };
}

function righeVettura(lettura, conNome) {
  const righe = [];
  const prefisso = conNome && lettura.nome ? `${lettura.nome} · ` : "";
  if (lettura.percentuale != null)
    righe.push({
      glyph: "🔋",
      name: `${prefisso}${t("Carica", "Charge")}`,
      value: `${Math.round(lettura.percentuale)}%`,
    });
  if (lettura.km != null)
    righe.push({
      glyph: "🛣️",
      name: `${prefisso}${t("Autonomia", "Range")}`,
      value: `${formatNumber(lettura.km, 0)} km`,
    });
  if (lettura.ricarica)
    righe.push({
      glyph: "🔌",
      name: `${prefisso}${t("Ricarica", "Charging")}`,
      value: lettura.ricarica,
    });
  return righe;
}

function evModel(states) {
  const fuori = widgetExcludedEntities();
  const profilate = vetture()
    .map((auto, indice) => letturaVettura(states, auto, fuori, indice))
    .filter(Boolean);
  /* Con una sola vettura leggibile dai profili la tessera non cambia: e'
   * quella che si vede da sempre, e nominarla sarebbe rumore. */
  const letture = profilate.length > 1 ? profilate : [letturaAttiva(states, fuori)].filter(Boolean);
  if (!letture.length) return null;
  const piu = letture.length > 1;
  const rows = letture.flatMap((lettura) => righeVettura(lettura, piu));
  if (!rows.length) return null;

  /* Con piu' auto la tessera mostra la piu' scarica: e' quella che chiede
   * qualcosa, ed e' la ragione per cui uno guarda la Home di sfuggita. */
  const cariche = letture.map((lettura) => lettura.percentuale).filter((valore) => valore != null);
  const percentuale = cariche.length ? Math.min(...cariche) : null;
  const kmTotali = letture.map((lettura) => lettura.km).filter((valore) => valore != null);
  const primaKm = kmTotali.length ? Math.min(...kmTotali) : null;
  const didascalia = piu
    ? letture
        .map(
          (lettura) =>
            `${lettura.nome}${lettura.percentuale == null ? "" : ` ${Math.round(lettura.percentuale)}%`}`,
        )
        .join(" · ")
    : percentuale != null && primaKm != null
      ? `${formatNumber(primaKm, 0)} km`
      : "";
  return {
    key: "ev", accent: "#06b6d4", icon: "🚗", label: t("Auto", "Car"),
    value: percentuale == null ? `${formatNumber(primaKm, 0)} km` : `${Math.round(percentuale)}%`,
    caption: didascalia,
    ring: percentuale, rows,
  };
}

/* La tessera degli aspirapolvere.
 *
 * Il ponte ha una tessera per ogni sezione — luci, clima, tapparelle,
 * telecamere, energia, piscina, irrigazione — e per gli aspirapolvere no: la
 * sezione e' arrivata dopo, e nessuno gliel'ha data. Chi ha un robot lo vedeva
 * in Home solo scendendo fino alla sua pagina.
 *
 * Cosa dice: quanti stanno pulendo, o la carica del piu' scarico quando sono
 * tutti fermi — che e' la domanda che si fa guardando la Home di sfuggita. */
function robotsModel(states) {
  const salvati = section("robots", null);
  const robots = normalizeRobots(
    Array.isArray(salvati) && salvati.length ? salvati : readJson("cd_robot", []),
  );
  const fuori = widgetExcludedEntities();
  const viste = robots
    .filter((robot) => clean(robot.entity) && widgetIncludes(clean(robot.entity), fuori))
    .map((robot) => robotView(robot, states));
  if (!viste.length) return null;

  const attivi = viste.filter((vista) => vista.cleaning);
  const cariche = viste.map((vista) => vista.battery).filter((carica) => carica != null);
  const piuScarico = cariche.length ? Math.min(...cariche) : null;
  return {
    key: "robot",
    accent: "#7c3aed",
    icon: "🤖",
    label: t("Aspirapolvere", "Vacuums"),
    value: attivi.length
      ? `${attivi.length}`
      : piuScarico == null
        ? `${viste.length}`
        : `${Math.round(piuScarico)}%`,
    caption: attivi.length
      ? t("in pulizia", "cleaning")
      : piuScarico == null
        ? t("configurati", "configured")
        : t("carica più bassa", "lowest charge"),
    /* L'anello racconta la carica solo quando nessuno sta lavorando: mentre
     * puliscono la notizia e' che stanno pulendo. */
    ring: attivi.length ? null : piuScarico,
    rows: viste.map((vista) => ({
      glyph: vista.cleaning ? "🧹" : vista.charging ? "🔌" : "🤖",
      name: vista.name,
      value: vista.battery == null
        ? robotStateLabel(vista.state)
        : `${robotStateLabel(vista.state)} · ${Math.round(vista.battery)}%`,
    })),
  };
}

/* Quello che il solare termico ha da dire, casella per casella.
 *
 * Prima erano tre righe fisse — le sonde — chiamate «Sonda 1, 2, 3». Due cose
 * sbagliate in una. La prima: «Sonda 2» non e' il nome di niente, e chi ha il
 * pannello sopra e il boiler sotto quei numeri se li deve ricordare a memoria;
 * il nome vero ce l'ha l'entita', e si legge di li'. La seconda: tutto il
 * resto del solare — le pompe, il delta, la pressione — non entrava mai, e
 * allora l'interruttore «nel widget» acceso su quelle righe non portava
 * niente in Home. Un interruttore che si accende e non fa succedere niente e'
 * peggio di un interruttore che non c'e'.
 *
 * Adesso ogni casella mappata puo' arrivare in Home, e a decidere quali resta
 * l'interruttore. Le temperature portano il loro numero; le pompe e gli
 * interruttori portano acceso o spento, perche' di una pompa quello si
 * guarda. */
const CASELLE_SOLARE = Object.freeze([
  { ref: "dm.boiler_sonda_temperatura_1", glyph: "🌡️", unita: "°", cifre: 1 },
  { ref: "dm.boiler_sonda_temperatura_2", glyph: "🌡️", unita: "°", cifre: 1 },
  { ref: "dm.boiler_sonda_temperatura_3", glyph: "🌡️", unita: "°", cifre: 1 },
  { ref: "dm.boiler_temperatura", glyph: "🌡️", unita: "°", cifre: 1 },
  { ref: "dm.boiler_delta_temperatura", glyph: "📐", unita: "°", cifre: 1 },
  { ref: "dm.boiler_pressione_acqua", glyph: "💧", unita: " bar", cifre: 1 },
  { ref: "dm.boiler_potenza_resistenza_boiler", glyph: "⚡", unita: " W", cifre: 0 },
  { ref: "dm.boiler_potenza", glyph: "⚡", unita: " W", cifre: 0 },
  { ref: "dm.boiler_stato_pompa_solare", glyph: "🔄", acceso: true },
  { ref: "dm.boiler_sensore_pompa_solare", glyph: "🔄", acceso: true },
  { ref: "dm.boiler_pompa_solare", glyph: "🔄", acceso: true },
  { ref: "dm.boiler_centralina_solare_termico", glyph: "🎛️", acceso: true },
  { ref: "dm.boiler_interruttore_solare_termico", glyph: "🔌", acceso: true },
  { ref: "dm.boiler_interruttore_boiler", glyph: "🔌", acceso: true },
  { ref: "dm.boiler_valvola_di_sicurezza", glyph: "🛡️", acceso: true },
]);

const STATI_ACCESI = /^(on|true|1|running|attiva|attivo|open|aperta|heat|heating)$/i;
/* «unknown» e «unavailable» sono il modo in cui Home Assistant dice «adesso
 * questa entita' non risponde», non «e' spenta». Scriverli come «Spento»
 * significherebbe raccontare per certo il contrario di quello che si sa: una
 * pompa staccata dalla rete verrebbe data per ferma, e una riga che nessuno
 * puo' leggere farebbe comunque numero. Una riga che non sa cosa dire non la
 * si scrive. */
const STATI_MUTI = /^(unknown|unavailable|none|)$/i;

function solarThermalModel(states) {
  const fuori = widgetExcludedEntities();
  const righe = [];
  const visti = new Set();
  let primaSonda = null;
  let pompa = null;
  for (const casella of CASELLE_SOLARE) {
    const dato = refValue(states, casella.ref, fuori);
    if (!dato || visti.has(dato.entity)) continue;
    if (casella.acceso) {
      if (STATI_MUTI.test(dato.state)) continue;
      const attivo = STATI_ACCESI.test(dato.state);
      if (pompa == null && casella.ref.includes("pompa")) pompa = attivo;
      visti.add(dato.entity);
      righe.push({
        glyph: casella.glyph,
        name: friendlyName(states, dato.entity),
        value: attivo ? t("Acceso", "On") : t("Spento", "Off"),
      });
      continue;
    }
    if (dato.value == null) continue;
    if (primaSonda == null && casella.ref.startsWith("dm.boiler_sonda")) primaSonda = dato.value;
    visti.add(dato.entity);
    righe.push({
      glyph: casella.glyph,
      name: friendlyName(states, dato.entity),
      value: `${formatNumber(dato.value, casella.cifre)}${casella.unita}`,
    });
  }
  if (!righe.length) return null;
  return {
    key: "solare", accent: "#f59e0b", icon: "🌞", label: t("Solare termico", "Solar thermal"),
    value: primaSonda == null ? t("Attivo", "Active") : `${formatNumber(primaSonda, 1)}°`,
    caption: pompa == null ? "" : pompa ? t("Pompa in funzione", "Pump running") : t("Pompa ferma", "Pump idle"),
    ring: null,
    rows: righe,
  };
}

function poolModel(states) {
  const config = root.getPool?.() || readJson("cd_piscina", {});
  if (!config || typeof config !== "object") return null;
  const fuori = widgetExcludedEntities();
  const leggi = (chiave, etichetta, glyph, unita = "") => {
    const entity = clean(config[chiave]);
    if (!entity || !widgetIncludes(entity, fuori)) return null;
    const valore = numOf(states, entity);
    if (valore == null) return null;
    return { glyph, name: etichetta, value: `${formatNumber(valore, 1)}${unita}`, raw: valore };
  };
  const rows = [
    leggi("tempEnt", t("Acqua", "Water"), "🌡️", "°"),
    leggi("phEnt", "pH", "🧪"),
    leggi("clEnt", t("Cloro", "Chlorine"), "💧"),
  ].filter(Boolean);
  if (!rows.length) return null;
  const acqua = rows.find((riga) => riga.name === t("Acqua", "Water"));
  return {
    key: "piscina", accent: "#0ea5e9", icon: "🏊", label: t("Piscina", "Pool"),
    value: acqua ? acqua.value : rows[0].value,
    caption: acqua && rows.length > 1 ? `pH ${rows.find((r) => r.name === "pH")?.value || "—"}` : "",
    ring: null, rows,
  };
}

const IRRIGAZIONE_ATTIVA = /^(on|true|open|opening|running|attiva)$/;

/** Se questa zona sta bagnando, comunque la sua entita' lo dica. */
function zonaInFunzione(states, zona) {
  const stato = clean(states?.[clean(zona?.entity)]?.state).toLowerCase();
  return IRRIGAZIONE_ATTIVA.test(stato);
}

function irrigationModel(states) {
  const config = root.getIrr?.() || readJson("cd_irrigazione", {});
  const zones = Array.isArray(config?.zones) ? config.zones : [];
  const fuori = widgetExcludedEntities();
  const attive = zones.filter((zona) => {
    const entity = clean(zona?.entity);
    return entity && widgetIncludes(entity, fuori);
  });
  if (!attive.length) return null;
  /* Una zona che irriga non dice sempre «on».
   *
   * Le zone su una valvola — `valve.*`, che la plancia accetta — dicono «open»
   * mentre stanno bagnando, e «opening» mentre si aprono. Guardando solo «on»
   * la tessera diceva che non stava irrigando niente proprio mentre l'acqua
   * usciva. */
  const inFunzione = attive.filter((zona) => zonaInFunzione(states, zona));
  const terreno = clean(config.soilEnt || config.soil_entity);
  const umidita = terreno && widgetIncludes(terreno, fuori) ? numOf(states, terreno) : null;
  return {
    key: "irrigazione", accent: "#10b981", icon: "💧", label: t("Irrigazione", "Irrigation"),
    value: inFunzione.length ? `${inFunzione.length}` : umidita == null ? `${attive.length}` : `${Math.round(umidita)}%`,
    caption: inFunzione.length
      ? t("zone in funzione", "zones running")
      : umidita == null
        ? t("zone configurate", "zones configured")
        : t("umidità terreno", "soil moisture"),
    ring: inFunzione.length ? null : umidita,
    rows: attive.map((zona) => ({
      glyph: "🌱",
      name: clean(zona.name) || clean(zona.entity),
      value: zonaInFunzione(states, zona)
        ? t("in funzione", "running")
        : t("ferma", "idle"),
    })),
  };
}

/* Le quattro tessere nuove condividono lo stesso dettaglio: righe con
 * un'icona, un nome e un valore. */
function rowsDetail(widget) {
  return (widget.rows || [])
    .map((row) =>
      rowShell(
        `<span class="dm-w-glyph" aria-hidden="true">${row.glyph || "•"}</span>
         <span class="dm-w-name">${esc(row.name)}</span>
         <b class="dm-w-val">${esc(row.value)}</b>`,
      ),
    )
    .join("");
}

/* ── i widget del Quadro Avvisi ───────────────────────────────────────── */

/* Il ponte ha preso il posto del Quadro Avvisi, che dalla Home e' uscito del
 * tutto: le sue liste sorvegliate — aperture, batterie, allagamenti, avvisi
 * personalizzati — sono queste tessere, che come le card di prima compaiono
 * solo quando hanno qualcosa da dire. Le liste e le regole di conteggio sono
 * LE STESSE del runtime (`GRUPPI_MONITORAGGIO`, il matcher degli avvisi
 * custom), cosi' numero e voci combaciano sempre. */

function gruppoEntita(chiave) {
  try {
    const gruppi = lexicalGlobal("GRUPPI_MONITORAGGIO");
    const lista = gruppi?.[chiave];
    if (!Array.isArray(lista)) return [];
    const fuori = widgetExcludedEntities();
    return lista.map(clean).filter((entity) => entity && widgetIncludes(entity, fuori));
  } catch (_error) {
    return [];
  }
}

function friendlyName(states, entity) {
  return (
    clean(stateOf(states, entity)?.attributes?.friendly_name) ||
    entity.split(".")[1]?.replaceAll("_", " ") ||
    entity
  );
}

function openingsModel(states) {
  const entities = gruppoEntita("win");
  if (!entities.length) return null;
  const rows = entities.map((entity) => ({
    entity,
    name: friendlyName(states, entity),
    on: clean(stateOf(states, entity)?.state).toLowerCase() === "on",
  }));
  const open = rows.filter((row) => row.on);
  if (!open.length) return null;
  return { key: "aperture", accent: "#dc2626", icon: "🚪", alert: true, label: t("Aperture", "Openings"),
    value: String(open.length), caption: open[0] ? open[0].name : "",
    ring: Math.round((open.length / rows.length) * 100), rows, open };
}

function batteriesModel(states) {
  const entities = gruppoEntita("batt");
  if (!entities.length) return null;
  const rows = entities
    .map((entity) => {
      const level = Number(stateOf(states, entity)?.state);
      return { entity, name: friendlyName(states, entity), level: Number.isFinite(level) ? level : null };
    })
    .filter((row) => row.level != null)
    .sort((a, b) => a.level - b.level);
  const low = rows.filter((row) => row.level <= 20);
  if (!low.length) return null;
  return { key: "batterie", accent: "#eab308", icon: "🔋", alert: true, label: t("Batterie", "Batteries"),
    value: String(low.length), caption: low[0] ? `${low[0].name} ${Math.round(low[0].level)}%` : "",
    ring: Math.round((low.length / rows.length) * 100), rows, low };
}

function floodModel(states) {
  let entities = [];
  try {
    entities = floodEntities(readJson("cd_gruppi_extra", {}), readJson("cd_gruppi_removed", {}), states, true);
  } catch (_error) {
    return null;
  }
  if (!Array.isArray(entities) || !entities.length) return null;
  const fuori = widgetExcludedEntities();
  const rows = entities
    .filter((entity) => widgetIncludes(entity, fuori))
    .map((entity) => ({
      entity,
      name: friendlyName(states, entity),
      on: Boolean(floodIsWet(stateOf(states, entity))),
    }));
  const wet = rows.filter((row) => row.on);
  if (!wet.length) return null;
  return { key: "allagamenti", accent: "#38bdf8", icon: "💧", alert: true, label: t("Allagamenti", "Floods"),
    value: String(wet.length), caption: wet[0] ? wet[0].name : "",
    ring: 100, rows: wet };
}

/* Le stesse condizioni del runtime, riga per riga: un avviso personalizzato
 * deve contare qui quello che il suo popup elenca la'. */
function avvisoAttivo(avviso, current) {
  const raw = String(current?.state ?? "");
  const stato = raw.toLowerCase();
  const numero = Number.parseFloat(raw);
  const soglia = Number.parseFloat(avviso?.value);
  switch (clean(avviso?.cond)) {
    case "off":
      return ["off", "closed", "false", "no", "0", "unavailable", "unknown", "idle", "standby"].includes(stato);
    case "eq":
      return stato === String(avviso?.value ?? "").toLowerCase();
    case "neq":
      return stato !== String(avviso?.value ?? "").toLowerCase();
    case "gt":
      return !Number.isNaN(numero) && !Number.isNaN(soglia) && numero > soglia;
    case "lt":
      return !Number.isNaN(numero) && !Number.isNaN(soglia) && numero < soglia;
    default:
      return ["on", "open", "opened", "true", "yes", "home", "detected", "heat", "heating", "cool",
        "cooling", "playing", "active", "armed", "wet", "motion", "occupied", "running"].includes(stato);
  }
}

function customAlertModels(states) {
  const avvisi = readJson("cd_avvisi_custom", []);
  if (!Array.isArray(avvisi)) return [];
  return avvisi
    .map((avviso, index) => {
      const entities = Array.isArray(avviso?.entities)
        ? avviso.entities
        : avviso?.entity
          ? [avviso.entity]
          : [];
      const fuori = widgetExcludedEntities();
      const rows = entities
        .map(clean)
        .filter((entity) => entity && widgetIncludes(entity, fuori))
        .filter((entity) => {
          const current = stateOf(states, entity);
          return current && avvisoAttivo(avviso, current);
        })
        .map((entity) => ({
          entity,
          name: friendlyName(states, entity),
          state: clean(stateOf(states, entity)?.state),
        }));
      if (!rows.length) return null;
      return { key: `custom-${index}`, accent: "#f59e0b", icon: clean(avviso?.icon) || "⚠️", alert: true,
        label: clean(avviso?.name) || t("Avviso", "Alert"), value: String(rows.length),
        caption: rows[0]?.name || "", ring: null, rows };
    })
    .filter(Boolean);
}

/* ── la personalizzazione (cd_widgets) ────────────────────────────────── */

export function widgetPreferences() {
  const stored = readJson(WIDGETS_CONFIG_KEY, {});
  const hidden = Array.isArray(stored?.hidden) ? stored.hidden.map(clean).filter(Boolean) : [];
  const order = Array.isArray(stored?.order) ? stored.order.map(clean).filter(Boolean) : [];
  const excluded = Array.isArray(stored?.excluded)
    ? stored.excluded.map(clean).filter(Boolean)
    : [];
  return { hidden, order, excluded };
}

/* Le entita' che restano fuori dai widget.
 *
 * Ogni tessera legge la configurazione della sua sezione, tutta: senza una
 * parola in contrario, quello che c'e' nella sezione finisce nel widget. La
 * parola in contrario e' questa — l'interruttore accanto a ogni entita' negli
 * editor — e si tiene in `cd_widgets`, insieme all'ordine e alle tessere
 * nascoste. Chi non e' nell'elenco e' dentro: cosi' chi non tocca niente
 * vede quello che vedeva prima. */
export function widgetExcludedEntities() {
  return new Set(widgetPreferences().excluded);
}

export function widgetIncludes(entity, excluded = widgetExcludedEntities()) {
  const id = clean(entity);
  return !id || !excluded.has(id);
}

/** L'ordine scelto prima, poi quello naturale; le tessere nascoste non escono.
 * Gli avvisi personalizzati si governano insieme, sotto la chiave `custom`. */
export function applyWidgetPreferences(models, preferences = widgetPreferences()) {
  const hidden = new Set(preferences.hidden);
  const chiave = (widget) => (widget.key.startsWith("custom-") ? "custom" : widget.key);
  const rank = (widget) => {
    const index = preferences.order.indexOf(chiave(widget));
    return index < 0 ? preferences.order.length + models.indexOf(widget) : index;
  };
  return models.filter((widget) => !hidden.has(chiave(widget))).sort((a, b) => rank(a) - rank(b));
}

function widgetModels(states) {
  return applyWidgetPreferences(
    [
      todoModel(states),
      lightsModel(states),
      climateModel(states),
      coversModel(states),
      securityModel(states),
      camerasModel(states),
      energyModel(states),
      appliancesModel(states),
      temperatureModel(states),
      evModel(states),
      robotsModel(states),
      solarThermalModel(states),
      poolModel(states),
      irrigationModel(states),
      openingsModel(states),
      batteriesModel(states),
      floodModel(states),
      ...customAlertModels(states),
    ].filter(Boolean),
  );
}

/* Cosa e' acceso, per nome.
 *
 * «Metti il testo che scorre dentro la card, cosi' anche da fuori mostra cosa
 * e' acceso»: la didascalia diceva «3 accese», che e' un numero, non una
 * risposta. Adesso porta i nomi — e se non ci stanno scorrono, invece di
 * finire in tre puntini. */
function nomiAccesi(rows, quali = (row) => row.on, fallback = "") {
  const nomi = (rows || [])
    .filter((row) => {
      try {
        return quali(row);
      } catch (_error) {
        return false;
      }
    })
    .map((row) => clean(row?.name))
    .filter(Boolean);
  return nomi.length ? nomi.join(" · ") : fallback;
}

/* ── markup: le tessere ───────────────────────────────────────────────── */

/* Le tessere gia' viste non rientrano in scena.
 *
 * L'ingresso e' un'animazione con lo sfalsamento: bella la prima volta, un
 * tremolio se si ripete. E si ripeteva a ogni rifacimento del markup — che
 * capita da solo, perche' le tessere degli avvisi compaiono e spariscono con
 * i valori. Chi c'era gia' nasce «vista» e sta ferma; anima solo chi arriva
 * adesso. */
const viste = () => (state.viste ||= new Set());

/* Quanto e' lungo il numero grande, per deciderne la misura.
 *
 * Sulla tessera ci va di solito un numero corto — «26,3°», «2,98 kW» — e
 * ventitre pixel gli stanno bene. Ma la Sicurezza al posto del numero ci mette
 * una parola: «Disinserito» a ventitre pixel non ci sta, e si leggeva
 * «Disinse...» — cioe' nulla, perche' «disinserito» e «disinserimento in
 * corso» cominciano uguale. Il numero grande resta grande finche' e' corto; a
 * una parola si da' la misura che la fa entrare intera.
 *
 * Sta qui, a livello di modulo, e non dentro chi disegna la tessera: la misura
 * serve anche al giro che riscrive i valori, che vive in un'altra funzione. */
function misuraValore(valore) {
  const quanto = String(valore ?? "").length;
  if (quanto <= 7) return "corto";
  return quanto <= 11 ? "medio" : "lungo";
}

function tileMarkup(widget, index = 0) {
  const open = state.expanded === widget.key;
  const giaVista = viste().has(widget.key) ? ' data-dm-seen="true"' : "";
  const quota = widget.ring == null ? null : Math.max(0, Math.min(100, widget.ring));
  return `<button type="button" class="dm-tile" data-dm-widget="${widget.key}" data-open="${open}"${giaVista}
      data-alert="${Boolean(widget.alert)}"
      style="--dm-widget-accent:${widget.accent};--dm-tile-i:${index}" aria-expanded="${open}" aria-label="${esc(widget.label)}">
      <span class="dm-tile-chip" aria-hidden="true">${widget.icon}</span>
      <span class="dm-tile-copy">
        <b class="dm-tile-value" data-dm-tile-value data-dm-len="${misuraValore(widget.value)}">${esc(widget.value)}</b>
        <span class="dm-tile-under">
          <span class="dm-tile-label">${esc(widget.label)}</span>
          <small class="dm-tile-caption"><span class="dm-tile-scroll" data-dm-tile-caption>${esc(widget.caption)}</span></small>
        </span>
      </span>
      <span class="dm-tile-go" aria-hidden="true">›</span>
      <span class="dm-tile-bar" aria-hidden="true"${quota == null ? " hidden" : ""}><i style="--dm-quota:${quota == null ? 0 : quota}%"></i></span>
      <span class="dm-tile-shine" aria-hidden="true"></span>
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
      <button type="button" class="dm-todo-del" data-dm-todo-del data-dm-todo-list="${esc(list.id)}"
        data-dm-todo-uid="${esc(item.uid)}" data-dm-todo-summary="${esc(item.summary)}"
        title="${esc(t("Togli dalla lista", "Remove from the list"))}"
        aria-label="${esc(t(`Togli dalla lista: ${item.summary}`, `Remove from the list: ${item.summary}`))}">🗑️</button>
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
      /* La riga per scrivere sta in fondo alla lista a cui appartiene: con
       * piu' liste aperte, una casella sola in cima non direbbe in quale
       * finisce quello che si scrive. */
      const scrivi = `<div class="dm-todo-add">
        <input type="text" class="dm-todo-new" data-dm-todo-new="${esc(list.id)}"
          value="${esc(state.bozze.get(list.id) || "")}" maxlength="200"
          placeholder="${esc(t("Aggiungi una cosa da fare…", "Add something to do…"))}"
          aria-label="${esc(t(`Aggiungi a ${clean(list.name) || list.entity}`, `Add to ${clean(list.name) || list.entity}`))}">
        <button type="button" class="dm-todo-plus" data-dm-todo-add="${esc(list.id)}"
          title="${esc(t("Aggiungi", "Add"))}" aria-label="${esc(t("Aggiungi", "Add"))}">＋</button>
      </div>`;
      return `<div class="dm-w-block"><span class="dm-w-block-title">${esc(clean(list.name) || list.entity)}</span>${body}${scrivi}</div>`;
    })
    .join("");
}

function lightsDetail(widget) {
  if (!widget.on.length && !widget.rows.length) return "";
  const rows = [...widget.rows].sort((a, b) => Number(b.on) - Number(a.on)).slice(0, 14);
  return rows
    .map((row) =>
      rowShell(
        `<span class="dm-w-glyph" data-on="${row.on}" aria-hidden="true">💡</span>
         <span class="dm-w-name">${esc(row.name)}<small>${esc(row.room)}</small></span>
         <button type="button" class="dm-w-switch" data-dm-w-light="${esc(row.entity)}" data-on="${row.on}"
           aria-label="${esc(row.name)}"><i></i></button>`,
      ),
    )
    .join("");
}

/* L'icona racconta cosa sta facendo l'unita': fiamma quando scalda, fiocco
 * quando raffresca — la stessa lingua della pagina Clima. */
/* Il disegno di una riga del clima: prima cosa sta facendo, poi cos'e'.
 *
 * Prima guardava soltanto lo stato, e chiudeva con il fiocco di neve per
 * tutto quello che non riconosceva: «off», «auto», «heat_cool». In una casa
 * dove il clima sono i termosifoni voleva dire tutte le righe col fiocco,
 * anche d'inverno a caldaia accesa. Quando lo stato non lo dice, lo dice il
 * tipo scelto in configurazione — lo stesso che le Stanze disegnano gia'. */
const ICONE_CLIMA = Object.freeze({ termo: "🔥", pompa: "♨️", clima: "❄️" });

function climateGlyph(mode, tipo = "clima") {
  if (mode.includes("heat") && mode.includes("cool")) return ICONE_CLIMA[tipo] || "❄️";
  if (mode.includes("heat")) return "🔥";
  if (mode.includes("cool")) return "❄️";
  if (mode.includes("dry")) return "💧";
  if (mode.includes("fan")) return "🌀";
  return ICONE_CLIMA[tipo] || "❄️";
}

/* I nomi delle modalita', gli stessi che usa la scheda del Clima rapido in
 * configurazione: «cool» in faccia a chi guarda non lo dice nessuno. */
/* Il simbolo di accensione, disegnato invece che scritto.
 *
 * Il carattere «⏻» (U+23FB) sta in un blocco che i font di sistema di Android
 * non coprono: sul telefono al posto del tasto usciva il quadratino vuoto del
 * carattere che manca — un comando che non si capisce e' un comando che non si
 * preme. Due tratti in SVG non dipendono da nessun font, prendono il colore
 * della riga come tutto il resto e restano nitidi a qualunque misura. */
const GLIFO_ACCENSIONE =
  '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" focusable="false" fill="none" ' +
  'stroke="currentColor" stroke-width="2.3" stroke-linecap="round">' +
  '<path d="M12 3v8"/><path d="M6.8 6.6a7.5 7.5 0 1 0 10.4 0"/></svg>';

const NOMI_MODO = () => ({
  off: t("Spento", "Off"),
  cool: t("Raffrescamento", "Cooling"),
  heat: t("Riscaldamento", "Heating"),
  heat_cool: t("Automatico caldo/freddo", "Heat/cool"),
  auto: t("Automatico", "Auto"),
  dry: t("Deumidificazione", "Dry"),
  fan_only: t("Solo ventola", "Fan only"),
});

const NOMI_AZIONE = () => ({
  heating: t("sta scaldando", "heating"),
  cooling: t("sta raffrescando", "cooling"),
  drying: t("sta deumidificando", "drying"),
  fan: t("sta ventilando", "fanning"),
  idle: t("in attesa", "idle"),
  off: t("spento", "off"),
});

/* Il pannello che si apre sotto la riga, con la rotella.
 *
 * Sulla riga ci stanno il nome, la temperatura e l'acceso/spento: tutto il
 * resto — in che modalita' sta, a che velocita' gira la ventola, di quanto
 * alzare l'obiettivo — prima si poteva vedere solo andando nella pagina Clima.
 * Adesso e' qui sotto, e ci sono soltanto le modalita' e le velocita' che
 * quell'unita' dichiara di accettare: un tasto che l'unita' non sa eseguire e'
 * peggio di un tasto che non c'e'. */
function climatePanel(row) {
  const nomi = NOMI_MODO();
  const modi = row.modi?.length ? row.modi : [];
  const modiMarkup = modi.length
    ? `<div class="dm-w-panel-row">
        <span class="dm-w-panel-lbl">${esc(t("Modalità", "Mode"))}</span>
        <div class="dm-w-chips">${modi
          .map(
            (modo) =>
              `<button type="button" class="dm-w-chip" data-dm-w-mode="${esc(modo)}"
                 data-dm-w-target="${esc(row.entity)}" data-on="${modo === row.mode}">${esc(
                   nomi[modo] || modo,
                 )}</button>`,
          )
          .join("")}</div>
      </div>`
    : "";
  const gradi = row.target == null ? null : formatNumber(row.target, 1);
  const temperaturaMarkup =
    row.target == null
      ? ""
      : `<div class="dm-w-panel-row">
          <span class="dm-w-panel-lbl">${esc(t("Temperatura", "Temperature"))}</span>
          <div class="dm-w-stepper">
            <button type="button" data-dm-w-temp="-1" data-dm-w-target="${esc(row.entity)}"
              aria-label="${esc(t("Abbassa", "Lower"))}">−</button>
            <b>${gradi}°</b>
            <button type="button" data-dm-w-temp="1" data-dm-w-target="${esc(row.entity)}"
              aria-label="${esc(t("Alza", "Raise"))}">+</button>
          </div>
        </div>`;
  const ventoleMarkup = row.ventole?.length
    ? `<div class="dm-w-panel-row">
        <span class="dm-w-panel-lbl">${esc(t("Ventola", "Fan"))}</span>
        <div class="dm-w-chips">${row.ventole
          .map(
            (voce) =>
              `<button type="button" class="dm-w-chip" data-dm-w-fan="${esc(voce)}"
                 data-dm-w-target="${esc(row.entity)}" data-on="${voce === row.ventola}">${esc(
                   voce,
                 )}</button>`,
          )
          .join("")}</div>
      </div>`
    : "";
  const azione = NOMI_AZIONE()[row.azione] || "";
  const noteMarkup =
    azione || row.umidita != null
      ? `<p class="dm-w-panel-note">${[
          azione,
          row.umidita == null ? "" : `${t("umidità", "humidity")} ${Math.round(row.umidita)}%`,
        ]
          .filter(Boolean)
          .map(esc)
          .join(" · ")}</p>`
      : "";
  const dentro = `${modiMarkup}${temperaturaMarkup}${ventoleMarkup}${noteMarkup}`;
  if (!dentro) return "";
  return `<div class="dm-w-panel" data-dm-w-panel="${esc(row.entity)}"${
    state.aperti.has(row.entity) ? "" : " hidden"
  }>${dentro}</div>`;
}

function climateDetail(widget) {
  return widget.rows
    .map((row) => {
      const pannello = climatePanel(row);
      const aperto = pannello && state.aperti.has(row.entity);
      /* Il pannello sta FUORI dalla riga, subito sotto, e le si ricuce addosso
       * con un margine negativo e gli angoli aperti.
       *
       * Dentro non poteva stare: la riga e' una fila flessibile, e una fila
       * che va a capo, dentro una griglia, viene misurata come se non andasse
       * a capo — la griglia le dava l'altezza di una riga sola e il pannello
       * usciva sopra a quella dopo. Fuori e' un elemento come gli altri, alto
       * quanto gli serve. */
      return rowShell(
        `<span class="dm-w-glyph" data-on="${row.on}" aria-hidden="true">${climateGlyph(row.mode || "", row.tipo)}</span>
         <span class="dm-w-name">${esc(row.name)}<small>${
           row.ambient == null ? "" : `${formatNumber(row.ambient, 1)}°`
         }${row.on && row.target != null ? ` → ${formatNumber(row.target, 1)}°` : ""}</small></span>
         ${
           pannello
             ? `<button type="button" class="dm-w-more" data-dm-w-more="${esc(row.entity)}"
                  aria-expanded="${Boolean(aperto)}"
                  aria-label="${esc(t("Altre impostazioni", "More settings"))}"
                  title="${esc(t("Altre impostazioni", "More settings"))}">⚙️</button>`
             : ""
         }
         <button type="button" class="dm-w-power" data-dm-w-clima="${esc(row.entity)}" data-on="${row.on}"
           aria-label="${esc(row.name)}">${GLIFO_ACCENSIONE}</button>`,
        `data-dm-w-open="${Boolean(aperto)}"`,
      ) + pannello;
    })
    .join("");
}

/* La tendina della posizione, la stessa della pagina Tapparelle (#200): la
 * card «Tapparelle aperte» della Home non c'e' piu', e quello che offriva —
 * fermare la tapparella a una percentuale scelta — vive qui, dove ora si
 * guardano le tapparelle dalla Home. Solo per chi accetta una posizione. */
function positionSelectMarkup(row) {
  if (!row.settable) return "";
  const invito = t("Scegli la posizione", "Choose the position");
  const voci = coverPositionChoices(row.preset)
    .map((value) => {
      const coda = value === 100 ? t("Aperta", "Open") : value === 0 ? t("Chiusa", "Closed") : "";
      return `<option value="${value}">${value === row.preset ? "⭐ " : ""}${value}%${coda ? ` · ${esc(coda)}` : ""}</option>`;
    })
    .join("");
  return `<select class="dm-w-position" data-dm-w-position="${esc(row.entity)}"
      aria-label="${esc(invito)}" title="${esc(invito)}"><option value="">↕</option>${voci}</select>`;
}

function coversDetail(widget) {
  return widget.rows
    .map((row) =>
      rowShell(
        `<span class="dm-w-glyph" data-on="${row.open}" aria-hidden="true">🪟</span>
         <span class="dm-w-name">${esc(row.name)}<small>${
           row.position == null ? "" : `${row.position}%`
         }</small></span>
         ${
           row.isCover || row.relay
             ? `<span class="dm-w-arrows">
                 <button type="button" data-dm-w-cover="${esc(row.entity)}" data-dm-w-down="${esc(row.down)}" data-svc="open_cover" aria-label="▲">▲</button>
                 <button type="button" data-dm-w-cover="${esc(row.entity)}" data-dm-w-down="${esc(row.down)}" data-svc="stop_cover" aria-label="■">■</button>
                 <button type="button" data-dm-w-cover="${esc(row.entity)}" data-dm-w-down="${esc(row.down)}" data-svc="close_cover" aria-label="▼">▼</button>
               </span>${positionSelectMarkup(row)}`
             : ""
         }`,
      ),
    )
    .join("");
}

function securityDetail(widget, states) {
  const parts = [];
  if (widget.alarm) {
    // L'antifurto si comanda da qui: gli stessi servizi e lo stesso tastierino
    // PIN della pagina Sicurezza (`promptPinAndSet`), solo in formato tessera.
    const comando = (service, on, icon, label) =>
      `<button type="button" data-dm-w-alarm="${service}" data-on="${on}"
         title="${esc(label)}" aria-label="${esc(label)}">${icon}</button>`;
    parts.push(
      rowShell(
        `<span class="dm-w-glyph" data-on="${widget.armed || widget.triggered}" aria-hidden="true">🛡️</span>
         <span class="dm-w-name">${esc(t("Antifurto", "Alarm"))}<small>${esc(widget.value)}</small></span>
         <span class="dm-w-alarm">
           ${comando("alarm_arm_away", widget.mode === "armed_away", "🏠", t("Fuori", "Away"))}
           ${comando("alarm_arm_night", widget.mode === "armed_night", "🌙", t("Notte", "Night"))}
           ${comando("alarm_disarm", !widget.armed && !widget.triggered, "🔓", t("Sblocca", "Disarm"))}
         </span>`,
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
    /* La porta si apre anche da qui.
     *
     * La riga la disegnava e basta: nome, stato, e un lucchetto che diceva
     * soltanto «questa vuole il PIN». Dalla pagina Sicurezza la stessa porta
     * si apre, e chi arriva dalla tessera non capisce perche' qui no.
     *
     * Il tasto porta lo stesso `data-dm-door` dei tasti di quella pagina, e
     * quel gesto lo ascolta il documento intero: e' la stessa mano che apre —
     * stessa conferma, stesso tastierino del PIN, stessa chiamata. Qui non si
     * ricopia niente, si chiede a chi lo sa gia' fare. */
    const apre = doorOpenCall(door.entity, stateOf(states, door.entity));
    const invito = door.pin
      ? t("Apri, col PIN", "Open, with the PIN")
      : t("Apri", "Open");
    parts.push(
      rowShell(
        `<span class="dm-w-glyph" aria-hidden="true">${esc(door.icon)}</span>
         <span class="dm-w-name">${esc(door.name || door.entity)}<small>${esc(label)}</small></span>
         ${
           apre
             ? `<button type="button" class="dm-w-door" data-dm-door="${esc(door.id)}"
                  title="${esc(invito)}" aria-label="${esc(`${invito}: ${door.name || door.entity}`)}">${
                    door.pin ? "🔐" : "🔓"
                  }</button>`
             : door.pin
               ? '<span class="dm-w-glyph" aria-hidden="true">🔒</span>'
               : ""
         }`,
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
    .map((row) => {
      // L'icona e' quella vera dell'elettrodomestico — la lavatrice ha
      // l'oblo', il forno lo sportello: lo stesso tratto della sua pagina.
      const disegno = root.cdApplianceIcon?.(row.type, 20);
      const icona = disegno
        ? `<span class="dm-w-appl-ic" aria-hidden="true">${disegno}</span>`
        : `<span class="dm-w-glyph" data-on="true" aria-hidden="true">🫧</span>`;
      return rowShell(
        `${icona}
         <span class="dm-w-name">${esc(row.name)}</span>
         <b class="dm-w-val">${row.watts == null ? "" : formatWatts(row.watts)}</b>`,
      );
    })
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

function openingsDetail(widget) {
  const rows = [...widget.rows].sort((a, b) => Number(b.on) - Number(a.on)).slice(0, MAX_DETAIL_ROWS);
  return rows
    .map((row) =>
      rowShell(
        `<span class="dm-w-glyph" data-on="${row.on}" aria-hidden="true">${
          /porta|cancell|door|gate/i.test(row.name) ? "🚪" : "🪟"
        }</span>
         <span class="dm-w-name">${esc(row.name)}</span>
         <b class="dm-w-val">${esc(row.on ? t("Aperta", "Open") : t("Chiusa", "Closed"))}</b>`,
      ),
    )
    .join("");
}

function batteriesDetail(widget) {
  return widget.rows
    .slice(0, MAX_DETAIL_ROWS)
    .map((row) =>
      rowShell(
        `<span class="dm-w-glyph" data-on="true" aria-hidden="true">${row.level <= 20 ? "🪫" : "🔋"}</span>
         <span class="dm-w-name">${esc(row.name)}</span>
         <b class="dm-w-val">${Math.round(row.level)}%</b>`,
      ),
    )
    .join("");
}

function floodDetail(widget) {
  return widget.rows
    .map((row) =>
      rowShell(
        `<span class="dm-w-glyph" data-on="true" aria-hidden="true">💧</span>
         <span class="dm-w-name">${esc(row.name)}</span>`,
      ),
    )
    .join("");
}

function customDetail(widget) {
  return widget.rows
    .slice(0, MAX_DETAIL_ROWS)
    .map((row) =>
      rowShell(
        `<span class="dm-w-glyph" data-on="true" aria-hidden="true">${esc(widget.icon)}</span>
         <span class="dm-w-name">${esc(row.name)}</span>
         <b class="dm-w-val">${esc(row.state)}</b>`,
      ),
    )
    .join("");
}

/* Le miniature: i fotogrammi non stanno nel markup — li posa
 * `aggiornaTelecamere()` sulla stessa strada del muro della Sicurezza, cosi'
 * il diff del corpo non li tocca e il riquadro non lampeggia mai. */
function camerasDetail(widget) {
  return `<div class="dm-w-cams">${widget.rows
    .map(
      (row) => `<figure class="dm-w-cam" data-dm-w-cam="${esc(row.entity)}">
        <img alt="" decoding="async" data-dm-camera-state="loading">
        <figcaption><i class="dm-w-cam-live" aria-hidden="true"></i>${esc(row.name)}</figcaption>
      </figure>`,
    )
    .join("")}</div>`;
}

/* Il riepilogo in cima alla finestra.
 *
 * La tessera in Home dice un numero solo — la media, quante ne sono accese —
 * e aprendola quel numero spariva: restava la lista, che il conto lo fa fare a
 * chi legge. Qui sopra restano tre numeri, quelli che si guardano prima di
 * mettersi a leggere le righe, e sono ricavati dalle righe stesse: non c'e'
 * niente di nuovo da tenere aggiornato.
 */
function summaryChips(widget) {
  const righe = Array.isArray(widget.rows) ? widget.rows : [];
  if (righe.length < 2) return [];
  const media = (valori) =>
    valori.length ? valori.reduce((somma, valore) => somma + valore, 0) / valori.length : null;
  const numeri = (chiave) =>
    righe.map((riga) => Number(riga?.[chiave])).filter((valore) => Number.isFinite(valore));
  const accesi = righe.filter((riga) => riga?.on).length;
  if (widget.key === "clima") {
    const ambiente = media(numeri("ambient"));
    const obiettivi = righe.filter((riga) => riga?.on).map((riga) => Number(riga?.target));
    const obiettivo = media(obiettivi.filter((valore) => Number.isFinite(valore)));
    return [
      [t("in funzione", "running"), `${accesi}/${righe.length}`],
      ambiente == null ? null : [t("in casa", "indoors"), `${formatNumber(ambiente, 1)}°`],
      obiettivo == null ? null : [t("obiettivo", "target"), `${formatNumber(obiettivo, 1)}°`],
    ].filter(Boolean);
  }
  if (widget.key === "luci")
    return [
      [t("accese", "on"), String(accesi)],
      [t("spente", "off"), String(righe.length - accesi)],
    ];
  if (widget.key === "tapparelle") {
    const posizioni = numeri("position");
    const aperte = righe.filter((riga) => Number(riga?.position) > 0).length;
    return [
      [t("aperte", "open"), `${aperte}/${righe.length}`],
      posizioni.length ? [t("apertura media", "average"), `${Math.round(media(posizioni))}%`] : null,
    ].filter(Boolean);
  }
  if (widget.key === "batterie") {
    const livelli = numeri("level");
    if (!livelli.length) return [];
    return [
      [t("la più bassa", "lowest"), `${Math.round(Math.min(...livelli))}%`],
      [t("media", "average"), `${Math.round(media(livelli))}%`],
    ];
  }
  if (widget.key === "temperatura") {
    const gradi = numeri("temperature");
    if (!gradi.length) return [];
    return [
      [t("media", "average"), `${formatNumber(media(gradi), 1)}°`],
      [t("la più fredda", "coldest"), `${formatNumber(Math.min(...gradi), 1)}°`],
      [t("la più calda", "warmest"), `${formatNumber(Math.max(...gradi), 1)}°`],
    ];
  }
  if (widget.key === "aperture") {
    const aperte = righe.filter((riga) => riga?.on).length;
    return [
      [t("aperte", "open"), String(aperte)],
      [t("chiuse", "closed"), String(righe.length - aperte)],
    ];
  }
  return [];
}

function summaryMarkup(widget) {
  const voci = summaryChips(widget);
  if (voci.length < 2) return "";
  return `<div class="dm-w-summary">${voci
    .map(
      ([etichetta, valore]) =>
        `<div class="dm-w-stat"><b>${esc(valore)}</b><span>${esc(etichetta)}</span></div>`,
    )
    .join("")}</div>`;
}

function detailBody(widget, states) {
  return `${summaryMarkup(widget)}${detailRows(widget, states)}`;
}

function detailRows(widget, states) {
  if (widget.key === "todo") return todoDetail(widget);
  if (widget.key === "luci") return lightsDetail(widget);
  if (widget.key === "clima") return climateDetail(widget);
  if (widget.key === "tapparelle") return coversDetail(widget);
  if (widget.key === "sicurezza") return securityDetail(widget, states);
  if (widget.key === "telecamere") return camerasDetail(widget);
  if (widget.key === "energia") return energyDetail(widget);
  if (widget.key === "elettrodomestici") return appliancesDetail(widget);
  if (widget.key === "temperatura") return temperatureDetail(widget);
  if (["ev", "solare", "piscina", "irrigazione", "robot"].includes(widget.key))
    return rowsDetail(widget);
  if (widget.key === "aperture") return openingsDetail(widget);
  if (widget.key === "batterie") return batteriesDetail(widget);
  if (widget.key === "allagamenti") return floodDetail(widget);
  if (widget.key.startsWith("custom-")) return customDetail(widget);
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
  /* Il titolo e' un titolo di sezione, come «Azioni rapide» e come
   * «Persone»: sulla Home i blocchi si annunciano tutti allo stesso modo, e
   * una fascia con l'alone di colore in mezzo agli altri due faceva sembrare
   * i Widget un'altra cosa. Sotto, la riga che dice come sta la casa. */
  host.innerHTML = `<h3 class="section-title dm-widgets-title"></h3>
    <p class="dm-widgets-sub"></p>
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
/* La struttura e' QUALI tessere ci sono, e quale e' aperta. Nient'altro.
 *
 * Ci stava dentro anche il fatto che una tessera avesse o no la barra, e la
 * barra dipende da un valore: un sensore che per un giro dice «non
 * disponibile» faceva sparire la barra, cambiare la firma, e riscrivere in
 * blocco tutte le tessere della Home. Da fuori si vede un tremolio, e
 * capitava a ogni evento di stato che passasse di li'.
 *
 * La barra adesso sta sempre nel markup e si accende e si spegne da sola,
 * come i valori: cambia quello che c'e' scritto, non quello che c'e'. */
function structureSignature(models) {
  return [state.expanded, models.map((widget) => widget.key).join("|")].join("§");
}

export function renderHomeWidgets() {
  const states = allStates();
  const models = widgetModels(states);
  const host = doc?.getElementById?.("dm-widgets");
  if (!models.length) {
    host?.remove();
    state.signature = "";
    /* Il popup del dettaglio sta attaccato al corpo della pagina, non alle
     * tessere: togliendo le tessere — l'ultima telecamera cancellata, una
     * configurazione azzerata — restava li' aperto sopra una Home vuota, coi
     * comandi di una cosa che non esiste piu', e lo scorrimento della pagina
     * bloccato da lui. Se ne va con quello che raccontava. */
    if (state.expanded || doc?.documentElement?.classList?.contains("dm-widget-popup-open"))
      chiudiPopup();
    else fermaTimerTelecamere();
    return false;
  }
  const mounted = host || ensureHost();
  if (!mounted) return false;
  const title = mounted.querySelector(".dm-widgets-title");
  if (title) title.textContent = t("Widget", "Widgets");
  /* La riga sotto il titolo diceva come si usa una tessera. Lo si capisce da
   * solo la prima volta, e da li' in poi e' una riga sprecata in cima alla
   * Home: adesso dice quante sezioni ci sono e quante chiedono attenzione,
   * che e' la sola cosa che si vuole sapere senza aprire niente. */
  const sub = mounted.querySelector(".dm-widgets-sub");
  if (sub) {
    const quante = models.length;
    const avvisi = models.filter((widget) => widget.alert).length;
    const sezioni = quante === 1 ? t("1 sezione", "1 section") : t(`${quante} sezioni`, `${quante} sections`);
    /* Non basta dire QUANTE chiedono attenzione: bisogna dire QUALI.
     *
     * «2 chiedono attenzione» sopra otto tessere obbliga a guardarle tutte per
     * scoprire chi sono, che e' esattamente il lavoro che una riga di
     * riepilogo dovrebbe risparmiare. I nomi in larghezza ci stanno di rado, e
     * allora la riga scorre: la stessa andatura delle didascalie delle
     * tessere, e solo quando serve davvero. */
    const nomi = models.filter((widget) => widget.alert).map((widget) => widget.label).join(", ");
    const attenzione = avvisi
      ? avvisi === 1
        ? `${t("1 chiede attenzione", "1 needs attention")}: ${nomi}`
        : `${t(`${avvisi} chiedono attenzione`, `${avvisi} need attention`)}: ${nomi}`
      : t("tutto tranquillo", "all quiet");
    const testo = `${sezioni} · ${attenzione}`;
    /* Si rimisura anche a parole ferme.
     *
     * La decisione «ci sta o non ci sta» dipende dalla larghezza, non solo dal
     * testo: girando il telefono, o entrando in schermo diviso, una riga che
     * prima ci stava viene tagliata e una che scorreva continua a scorrere di
     * una distanza che non esiste piu'. Misurare costa un conto
     * d'impaginazione, quindi lo si fa solo quando la larghezza e' cambiata
     * davvero. */
    const cambiatoTesto = sub.textContent !== testo;
    if (cambiatoTesto) sub.textContent = testo;
    const larghezza = Math.round(sub.clientWidth);
    if (cambiatoTesto || sub.dataset.dmLarghezza !== String(larghezza)) {
      sub.dataset.dmLarghezza = String(larghezza);
      scorriUnaRiga(sub);
    }
    const stato = avvisi ? "avviso" : "quiete";
    if (mounted.dataset.dmMood !== stato) mounted.dataset.dmMood = stato;
  }

  if (state.expanded && !models.some((widget) => widget.key === state.expanded)) state.expanded = "";
  const grid = mounted.querySelector(".dm-widgets-grid");
  if (!grid) return false;

  const signature = structureSignature(models);
  /* Si misura il testo solo se qualcosa e' cambiato davvero.
   *
   * `scorriDidascalie` legge `scrollWidth`, e leggerlo obbliga il browser a
   * rifare i conti dell'impaginazione: farlo a ogni evento di stato — che in
   * una casa vera vuol dire piu' volte al secondo — e' esattamente la Home che
   * «si riaggiorna» sotto le dita. */
  let cambiato = false;
  if (state.signature !== signature || !grid.firstElementChild) {
    state.signature = signature;
    /* Prima si disegna, poi si segna.
     *
     * Il segno «gia' vista» serve a non far rientrare in scena una tessera che
     * c'era gia'. Ma si metteva PRIMA di stampare il markup, e `tileMarkup` lo
     * legge: ogni tessera nasceva marcata, compresa quella appena arrivata.
     * L'ingresso non partiva mai per nessuno — l'animazione c'era, scritta e
     * mantenuta, e non si e' mai vista.
     *
     * L'ordine giusto e' quello del racconto: si stampa leggendo chi c'era
     * prima, e solo dopo si prende nota di chi c'e' adesso. */
    grid.innerHTML = models.map((widget, index) => tileMarkup(widget, index)).join("");
    for (const widget of models) viste().add(widget.key);
    cambiato = true;
    /* Le tessere sono nuove: chi le decora deve saperlo.
     *
     * Il movimento dell'avviso — la porta che si apre, la goccia che cade —
     * lo disegna un altro modulo, che si sveglia sugli eventi di stato. Se le
     * tessere nascono DOPO l'ultima passata di quel modulo, restano ferme
     * finche' non capita un altro evento: per un avviso appena scattato puo'
     * volerci parecchio. Cosi' invece si annuncia, e chi ascolta ripassa. */
    try {
      root.dispatchEvent?.(new CustomEvent("dashboardmodern:widgets-painted"));
    } catch (_errore) {}
  } else {
    // Solo i valori: la tessera resta dov'e', l'apertura non riparte.
    for (const widget of models) {
      const tile = grid.querySelector(`[data-dm-widget="${CSS.escape(widget.key)}"]`);
      if (!tile) continue;
      tile.style.setProperty("--dm-widget-accent", widget.accent);
      const value = tile.querySelector("[data-dm-tile-value]");
      if (value && value.textContent !== widget.value) {
        value.textContent = widget.value;
        value.dataset.dmLen = misuraValore(widget.value);
        cambiato = true;
      }
      const caption = tile.querySelector("[data-dm-tile-caption]");
      if (caption && caption.textContent !== widget.caption) {
        caption.textContent = widget.caption;
        cambiato = true;
      }
      /* L'avviso non fa piu' parte della struttura: si accende qui, come tutto
       * il resto che cambia da un momento all'altro.
       *
       * E chi decora la pastiglia col movimento dell'avviso — la porta che si
       * apre, la goccia che cade — va avvisato che deve riguardare: si tiene
       * un segno di cosa ha gia' disegnato, e finche' quel segno resta crede
       * che non ci sia niente da rifare. Prima la tessera veniva riscritta da
       * capo a ogni avviso che si accendeva, e il segno spariva col nodo
       * vecchio; adesso il nodo resta, quindi il segno lo si toglie qui. */
      const avviso = String(Boolean(widget.alert));
      if (tile.dataset.alert !== avviso) {
        tile.dataset.alert = avviso;
        const pastiglia = tile.querySelector(".dm-tile-chip");
        if (pastiglia) delete pastiglia.dataset.dmAlertMotion;
      }
      const cornice = tile.querySelector(".dm-tile-bar");
      const barra = cornice?.querySelector("i");
      if (cornice) {
        const senza = widget.ring == null;
        if (cornice.hidden !== senza) cornice.hidden = senza;
        if (barra && !senza)
          barra.style.setProperty("--dm-quota", `${Math.max(0, Math.min(100, widget.ring))}%`);
      }
      if (state.expanded === widget.key) {
        const captionDetail = doc.querySelector("#dm-widget-popup [data-dm-detail-caption]");
        if (captionDetail && captionDetail.textContent !== widget.caption)
          captionDetail.textContent = widget.caption;
        const body = doc.querySelector("#dm-widget-popup .dm-w-body");
        const markup = detailBody(widget, states);
        if (body && body.innerHTML !== markup) {
          /* Il corpo si riscrive a ogni valore che cambia: se le righe
           * rientrassero in scena ogni volta, la card aperta tremerebbe da
           * sola. L'ingresso e' solo del primo disegno — quello che segue
           * l'apertura. */
          const primoDisegno = body.dataset.dmPainted !== "true";
          body.innerHTML = markup;
          body.dataset.dmPainted = "true";
          body.dataset.dmFresh = primoDisegno ? "true" : "false";
        }
      }
    }
  }

  if (cambiato) scorriDidascalie(grid);
  sincronizzaPopup(models, states);

  for (const list of configuredTodoLists()) fetchItems(list.entity);
  // La tessera delle telecamere appena disegnata (o ridisegnata) chiede i suoi
  // fotogrammi; chiusa, restituisce timer e object URL.
  if (state.expanded === "telecamere") aggiornaTelecamere();
  else fermaTimerTelecamere();
  return true;
}

/* Il dettaglio e' un popup, non una tendina.
 *
 * «Anziche' aprire tendina sui widget non e' piu' bello un popup stilizzato
 * fatto bene»: la tendina spingeva giu' mezza Home a ogni tocco e la tessera
 * aperta finiva sotto il pollice. Adesso la tessera resta al suo posto e il
 * dettaglio sale al centro, con lo sfondo sfocato — la stessa lingua degli
 * altri popup della plancia. Si chiude col tasto, toccando fuori, o con Esc. */
function popupHost() {
  let host = doc?.getElementById?.("dm-widget-popup");
  if (host) return host;
  if (!doc?.body) return null;
  host = doc.createElement("div");
  host.id = "dm-widget-popup";
  host.hidden = true;
  host.addEventListener("click", (event) => {
    if (event.target === host || event.target?.closest?.("[data-dm-widget-close]")) chiudiPopup();
  });
  doc.body.append(host);
  return host;
}

function chiudiPopup() {
  state.expanded = "";
  const host = doc?.getElementById?.("dm-widget-popup");
  if (host) {
    host.hidden = true;
    host.replaceChildren();
  }
  doc?.documentElement?.classList?.remove("dm-widget-popup-open");
  fermaTimerTelecamere();
  schedule();
}

function sincronizzaPopup(models, states) {
  const aperto = models.find((widget) => widget.key === state.expanded);
  const host = popupHost();
  if (!host) return false;
  if (!aperto) {
    if (!host.hidden) {
      host.hidden = true;
      host.replaceChildren();
      doc?.documentElement?.classList?.remove("dm-widget-popup-open");
    }
    return false;
  }
  /* Il segno di chi sta raccontando NON si chiama come quello delle tessere.
   *
   * Si chiamava `data-dm-widget`, lo stesso nome che porta ogni tessera della
   * griglia, e in fondo a chi ascolta i tocchi c'e' la riga che dice: se sotto
   * il dito c'e' un `[data-dm-widget]`, apri o chiudi quella tessera. Dentro
   * la finestra aperta quel nome lo portava la finestra stessa: qualunque
   * tocco che non fosse gia' stato preso da un comando — la casella della
   * lista, il tasto piu', una riga qualsiasi — risaliva fino a lei e la
   * chiudeva. Nelle prove non si vedeva perche' toccavano coi comandi, e i
   * comandi tornano indietro prima. */
  if (host.dataset.dmPopupOf !== aperto.key || host.hidden) {
    host.dataset.dmPopupOf = aperto.key;
    host.hidden = false;
    host.innerHTML = detailMarkup(aperto, states);
    doc?.documentElement?.classList?.add("dm-widget-popup-open");
    const body = host.querySelector(".dm-w-body");
    if (body) {
      body.dataset.dmPainted = "true";
      body.dataset.dmFresh = "true";
    }
  }
  return true;
}

/* Il testo che non ci sta scorre, invece di finire in tre puntini.
 *
 * Si misura dopo il disegno: se il nastro e' piu' largo della finestra, va
 * avanti e indietro piano — la distanza da percorrere e la durata sono quelle
 * del testo, cosi' due parole scorrono in fretta e una fila di nomi con
 * calma. Chi ci sta resta fermo: niente da leggere in movimento senza
 * motivo. */
/* Una riga sola che scorre, quando non ci sta.
 *
 * Il nastro delle tessere misura il figlio dentro il padre; qui il testo sta
 * gia' nell'elemento, quindi lo si avvolge una volta sola e da li' in poi si
 * rimisura quello. Se ci sta, non si muove niente: una riga che scorre senza
 * bisogno e' solo una riga che non si riesce a leggere. */
function scorriUnaRiga(riga) {
  if (!riga) return false;
  let nastro = riga.querySelector(":scope > .dm-sub-scroll");
  if (!nastro) {
    const testo = riga.textContent;
    riga.textContent = "";
    nastro = doc.createElement("span");
    nastro.className = "dm-sub-scroll";
    nastro.textContent = testo;
    riga.append(nastro);
  }
  const eccesso = nastro.scrollWidth - riga.clientWidth;
  if (eccesso > 4) {
    nastro.dataset.dmScroll = "true";
    nastro.style.setProperty("--dm-scroll-x", `${-eccesso - 2}px`);
    nastro.style.setProperty("--dm-scroll-dur", `${Math.min(22, Math.max(7, eccesso / 11))}s`);
    return true;
  }
  delete nastro.dataset.dmScroll;
  nastro.style.removeProperty("--dm-scroll-x");
  nastro.style.removeProperty("--dm-scroll-dur");
  return false;
}

function scorriDidascalie(grid) {
  if (!grid?.querySelectorAll) return 0;
  let mossi = 0;
  for (const nastro of grid.querySelectorAll("[data-dm-tile-caption]")) {
    const finestra = nastro.parentElement;
    if (!finestra) continue;
    const eccesso = nastro.scrollWidth - finestra.clientWidth;
    if (eccesso > 4) {
      nastro.dataset.dmScroll = "true";
      nastro.style.setProperty("--dm-scroll-x", `${-eccesso - 2}px`);
      nastro.style.setProperty("--dm-scroll-dur", `${Math.min(18, Math.max(6, eccesso / 12))}s`);
      mossi += 1;
    } else if (nastro.dataset.dmScroll) {
      delete nastro.dataset.dmScroll;
      nastro.style.removeProperty("--dm-scroll-x");
      nastro.style.removeProperty("--dm-scroll-dur");
    }
  }
  return mossi;
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

/* ── le miniature delle telecamere ────────────────────────────────────── */

/* Un fotogramma e' un'immagine ferma chiesta di nuovo: niente in Home
 * Assistant la spinge. Dieci secondi, e SOLO mentre la tessera e' aperta
 * sulla Home di uno schermo visibile: chiusa la tessera, il timer muore e gli
 * object URL vengono restituiti. La stessa disciplina del muro della
 * Sicurezza, che di secondi ne usa quattro perche' li' le telecamere sono la
 * pagina intera. */
const CAMERA_WIDGET_REFRESH_MS = 10000;

function homeVisible() {
  return Boolean(doc?.getElementById?.("page-home")?.classList?.contains("active"));
}

function cameraWidgetOnScreen() {
  return state.expanded === "telecamere" && homeVisible() && doc?.visibilityState !== "hidden";
}

function fermaTimerTelecamere() {
  if (state.cameraTimer) {
    root.clearInterval?.(state.cameraTimer);
    state.cameraTimer = 0;
  }
  for (const url of state.cameraUrls.values()) {
    if (typeof url === "string" && url.startsWith("blob:")) {
      try {
        root.URL?.revokeObjectURL?.(url);
      } catch (_error) {}
    }
  }
  state.cameraUrls.clear();
}

async function aggiornaTelecamere() {
  if (!cameraWidgetOnScreen()) {
    fermaTimerTelecamere();
    return false;
  }
  /* Le miniature vivono dove vive il dettaglio, e il dettaglio si e' spostato
   * nel popup: cercarle solo sotto le tessere voleva dire non trovarne
   * nessuna, e un timer che si sveglia ogni tanto per non fare niente mentre
   * le telecamere restano nere. Si guarda in tutti e due i posti. */
  const figures =
    doc?.querySelectorAll?.(
      "#dm-widgets [data-dm-w-cam],#dm-widget-popup [data-dm-w-cam]",
    ) || [];
  await Promise.all(
    [...figures].map((figure) =>
      loadCameraFrame(
        { entity: clean(figure.dataset.dmWCam) },
        figure.querySelector("img"),
        state.cameraUrls,
      ),
    ),
  );
  sincronizzaTimerTelecamere();
  return true;
}

function sincronizzaTimerTelecamere() {
  if (!cameraWidgetOnScreen()) {
    fermaTimerTelecamere();
    return false;
  }
  if (state.cameraTimer) return true;
  state.cameraTimer =
    root.setInterval?.(() => {
      if (!cameraWidgetOnScreen()) {
        fermaTimerTelecamere();
        return;
      }
      aggiornaTelecamere();
    }, CAMERA_WIDGET_REFRESH_MS) || 0;
  return Boolean(state.cameraTimer);
}

/* ── interazione ──────────────────────────────────────────────────────── */

function toggleExpand(key) {
  const prossimo = state.expanded === key ? "" : clean(key);
  state.expanded = prossimo;
  /* La griglia non cambia: il dettaglio vive nel popup. Azzerare la firma
   * rifarebbe tutte le tessere — e sarebbe il tremolio di prima. */
  schedule();
}

/* Esc chiude, come ogni altro popup della plancia. */
function bindEscape() {
  if (state.escape) return;
  state.escape = true;
  doc?.addEventListener?.("keydown", (event) => {
    if (event.key === "Escape" && state.expanded) chiudiPopup();
  });
}

/* La posizione scelta parte subito, e la tendina torna alla sua freccia: e'
 * un comando, non lo specchio di dov'e' la tapparella. */
function onChange(event) {
  const position = event.target?.closest?.("[data-dm-w-position]");
  if (!position) return;
  const scelta = clean(position.value);
  position.value = "";
  if (scelta === "") return;
  callHa("cover", "set_cover_position", {
    entity_id: clean(position.dataset.dmWPosition),
    position: Math.max(0, Math.min(100, Math.round(Number(scelta) || 0))),
  });
}

/* La lista di quel riferimento, presa dalla configurazione. */
function listaTodo(id) {
  return configuredTodoLists().find((value) => value.id === clean(id)) || null;
}

/* Quello che si sta scrivendo si ricorda qui, non nel documento: il corpo
 * della finestra si riscrive da solo a ogni valore che cambia. */
function onInput(event) {
  const casella = event.target?.closest?.("[data-dm-todo-new]");
  if (!casella) return;
  const id = clean(casella.dataset.dmTodoNew);
  if (casella.value) state.bozze.set(id, casella.value);
  else state.bozze.delete(id);
}

/* Invio aggiunge, come in ogni casella in cui si scrive una riga. */
function onKeydown(event) {
  if (event.key !== "Enter") return;
  const casella = event.target?.closest?.("[data-dm-todo-new]");
  if (!casella) return;
  event.preventDefault();
  const lista = listaTodo(casella.dataset.dmTodoNew);
  if (lista) addItem(lista, casella.value);
}

function onClick(event) {
  const aggiungi = event.target?.closest?.("[data-dm-todo-add]");
  if (aggiungi) {
    event.preventDefault();
    const id = clean(aggiungi.dataset.dmTodoAdd);
    const lista = listaTodo(id);
    const casella = aggiungi.parentElement?.querySelector?.("[data-dm-todo-new]");
    if (lista) addItem(lista, casella?.value || state.bozze.get(id) || "");
    return;
  }
  const cestino = event.target?.closest?.("[data-dm-todo-del]");
  if (cestino) {
    event.preventDefault();
    const lista = listaTodo(cestino.dataset.dmTodoList);
    if (lista) removeItem(lista, clean(cestino.dataset.dmTodoUid), clean(cestino.dataset.dmTodoSummary));
    return;
  }
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
  /* La rotella apre e chiude il pannello della riga. Non passa da un
   * ridisegno: si tocca il documento e si segna la scelta, cosi' l'apertura e'
   * immediata e il prossimo ridisegno la ritrova. */
  const rotella = event.target?.closest?.("[data-dm-w-more]");
  if (rotella) {
    event.preventDefault();
    const entity = clean(rotella.dataset.dmWMore);
    const pannello = doc?.querySelector?.(
      `[data-dm-w-panel="${entity.replace(/["\\]/g, "\\$&")}"]`,
    );
    const apri = !state.aperti.has(entity);
    if (apri) state.aperti.add(entity);
    else state.aperti.delete(entity);
    if (pannello) pannello.hidden = !apri;
    rotella.setAttribute("aria-expanded", String(apri));
    rotella.closest(".dm-w-row")?.setAttribute("data-dm-w-open", String(apri));
    return;
  }
  const modo = event.target?.closest?.("[data-dm-w-mode]");
  if (modo) {
    event.preventDefault();
    callHa("climate", "set_hvac_mode", {
      entity_id: clean(modo.dataset.dmWTarget),
      hvac_mode: clean(modo.dataset.dmWMode),
    });
    root.setTimeout?.(schedule, 500);
    return;
  }
  const ventola = event.target?.closest?.("[data-dm-w-fan]");
  if (ventola) {
    event.preventDefault();
    callHa("climate", "set_fan_mode", {
      entity_id: clean(ventola.dataset.dmWTarget),
      fan_mode: clean(ventola.dataset.dmWFan),
    });
    root.setTimeout?.(schedule, 500);
    return;
  }
  const gradi = event.target?.closest?.("[data-dm-w-temp]");
  if (gradi) {
    event.preventDefault();
    const entity = clean(gradi.dataset.dmWTarget);
    const riga = climateRow(entity);
    if (riga && riga.target != null) {
      const passo = (Number(gradi.dataset.dmWTemp) || 0) * (riga.passo || 0.5);
      const voluta = Math.min(riga.massima, Math.max(riga.minima, riga.target + passo));
      /* Il numero si aggiorna subito sotto il dito: la conferma vera arriva
       * col prossimo giro di stati. */
      const casella = gradi.parentElement?.querySelector?.("b");
      if (casella) casella.textContent = `${formatNumber(voluta, 1)}°`;
      callHa("climate", "set_temperature", { entity_id: entity, temperature: voluta });
      root.setTimeout?.(schedule, 700);
    }
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
    const entity = clean(cover.dataset.dmWCover);
    const servizio = clean(cover.dataset.svc);
    /* Un servizio cover.* su un rele' cadrebbe nel vuoto: si traduce, con la
     * stessa regola della pagina Tapparelle — discesa prima, salita poi. */
    const comandi = relayCoverCommands(servizio, entity, clean(cover.dataset.dmWDown));
    if (comandi.length) {
      for (const { entity: bersaglio, service } of comandi)
        callHa("switch", service, { entity_id: bersaglio });
      return;
    }
    if (isRelayEntity(entity)) return; // fermare un rele' solo non vuol dire niente
    callHa("cover", servizio, { entity_id: entity });
    return;
  }
  // La tendina della posizione si apre da sola: un click sulla tessera che la
  // ospita la richiuderebbe prima di poterci scegliere qualcosa.
  if (event.target?.closest?.("[data-dm-w-position]")) return;
  const alarm = event.target?.closest?.("[data-dm-w-alarm]");
  if (alarm) {
    event.preventDefault();
    // Stessa strada della pagina Sicurezza: il tastierino PIN dell'antifurto
    // chiede il codice e poi chiama lui il servizio scelto.
    root.promptPinAndSet?.(clean(alarm.dataset.dmWAlarm));
    return;
  }
  if (event.target?.closest?.("[data-dm-widget-close]")) {
    event.preventDefault();
    toggleExpand(state.expanded);
    return;
  }
  /* Solo le tessere della griglia si aprono e si chiudono col tocco: quello
   * che sta dentro la finestra ha gia' avuto le sue occasioni qui sopra. */
  const tile = event.target?.closest?.("#dm-widgets [data-dm-widget]");
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
/* ── il popup del dettaglio ───────────────────────────────────────────────
 *
 * Le stesse forme dei popup che la plancia ha gia': il velo chiaro sfocato
 * del modal-wrapper, la card con l'angolo largo e l'ombra profonda del
 * modal-card. Sempre al centro — anche sul telefono: un foglio che sale dal
 * fondo e' un'altra lingua, e qui si parla quella di casa. */
#dm-widget-popup{
  position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;
  padding:20px;
  background:color-mix(in srgb,var(--bg-sculpted,#e6ebf1) 62%,rgba(15,23,42,.34));
  backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
  animation:dmWidgetPopupIn .2s ease-out}
:root:is([data-theme="dark"]) #dm-widget-popup,
html[data-theme="dark"] #dm-widget-popup{background:color-mix(in srgb,#060a14 74%,rgba(2,6,15,.9))}
#dm-widget-popup[hidden]{display:none}
@keyframes dmWidgetPopupIn{from{opacity:0}to{opacity:1}}
html.dm-widget-popup-open{overflow:hidden}
/* La stessa veste delle altre finestre della plancia.
 *
 * Non passa dal foglio dei popup — questa finestra e' roba di questo modulo, e
 * la disegna lui — quindi la veste va ripetuta qui: angolo piu' misurato,
 * un'ombra che scende invece dell'alone, e il filo di colore sul bordo alto,
 * dipinto nello sfondo perche' la finestra e' lei stessa il contenitore che
 * scorre e un elemento appoggiato scorrerebbe via col contenuto.
 *
 * Via anche l'anello bianco cucito dentro il bordo: valeva solo sul tema
 * chiaro, e sullo scuro era una riga luminosa in mezzo al buio. */
#dm-widget-popup .dm-widget-detail{
  /* Chi scorre e' il corpo, non la finestra.
   *
   * La finestra deve restare a contenuto tagliato — glielo chiede la regola che
   * condivide con la tessera aperta in griglia, che sta piu' in basso in questo
   * foglio e quindi vince a parita' di peso: dirle qui di farsi scorrere non
   * ha mai avuto effetto, e la Clima con dodici termostati finiva tagliata a
   * meta' senza modo di arrivare in fondo. Cosi' invece la card e' una colonna
   * alta al massimo quanto lo schermo, l'intestazione sta ferma in cima e la
   * lista sotto scorre da sola. */
  display:flex;flex-direction:column;
  width:min(560px,100%);max-height:min(80dvh,760px);margin:0;
  border:1px solid var(--card-border,#e8edf3);border-radius:28px;
  background:var(--card-bg,#fff);
  box-shadow:0 32px 64px -28px rgba(2,6,23,.45),0 6px 18px -12px rgba(2,6,23,.25);
  animation:dmWidgetPopupCard .28s cubic-bezier(.16,1,.3,1)}
@keyframes dmWidgetPopupCard{from{opacity:0;transform:scale(.96) translateY(12px)}to{opacity:1;transform:none}}
/* Chi ha chiesto meno movimento non lo riceve: la finestra c'e' o non c'e'. */
@media(prefers-reduced-motion:reduce){
  #dm-widget-popup,#dm-widget-popup .dm-widget-detail{animation:none}
}
/* L'intestazione parla come le altre della plancia: maiuscoletto spaziato,
 * riga di separazione, il tondo per chiudere. Il velo colorato era un
 * gradiente che partiva dall'angolo e sbiadiva a meta': adesso e' un fondo
 * appena tinto, che non contende la scena al titolo. */
/* La testata della finestra e' la stessa fascia che aprono le pagine.
 *
 * Ci sono passate due versioni sbagliate per lo stesso motivo: erano tutte e
 * due invenzioni. Il filo di tre pixel sul bordo alto era il colore detto a
 * mezza voce, e da lontano tutte le finestre erano la stessa finestra bianca;
 * la fascia di colore pieno si vedeva benissimo, ma non somigliava a niente
 * del resto della plancia.
 *
 * La forma giusta la plancia ce l'ha gia', ed e' la fascia che apre ogni
 * pagina: fondo della card, un alone del colore che entra dall'angolo in alto
 * a destra, il titolo in Oswald maiuscolo nel colore della sezione, il
 * sottotitolo in piccolo maiuscoletto spaziato, e in fondo alla fascia una
 * riga di due pixel che sfuma. Qui e' quella, con l'aggiunta della pastiglia
 * dell'icona — la stessa della tessera da cui si e' arrivati, perche' la
 * finestra e' quella tessera che si apre.
 *
 * Titolo e sottotitolo vanno incolonnati, non affiancati: affiancati, il
 * sottotitolo di una sezione con sei voci finiva sempre coi puntini. */
#dm-widget-popup .dm-widget-detail .dm-w-head{
  flex:0 0 auto;position:relative;overflow:hidden;
  display:grid;grid-template-columns:auto minmax(0,1fr) auto;grid-template-rows:auto auto;
  column-gap:15px;row-gap:5px;align-items:center;
  padding:20px 22px 19px;color:var(--text,#0f172a);border-bottom:0;box-shadow:none;
  /* Il testo a sinistra: questa e' un <header>, e da telefono il foglio della
     plancia centra il testo di ogni <header> — quello suo, in cima alla
     pagina. Qui centrava titolo e sottotitolo lasciando l'icona da una parte. */
  text-align:left;
  background:
    radial-gradient(130% 190% at 88% -60%,
      color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 22%,transparent),
      transparent 58%),
    var(--card-bg,#fff)}
/* La riga in fondo alla fascia: due pixel che partono dal colore e sfumano,
   come in cima a ogni pagina. */
#dm-widget-popup .dm-widget-detail .dm-w-head::after{
  content:"";position:absolute;inset:auto 0 0 0;height:2px;opacity:.7;
  background:linear-gradient(90deg,
    var(--dm-widget-accent,#0ea5e9),
    color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 45%,transparent) 62%,transparent)}
/* La pastiglia dell'icona: la tinta della sezione, appena posata, con l'anello
 * sottile che hanno tutte le pastiglie della plancia. */
#dm-widget-popup .dm-widget-detail .dm-w-head-ic{
  grid-row:1/3;flex:0 0 48px;width:48px;height:48px;display:grid;place-items:center;
  border-radius:16px;font-size:23px;
  background:linear-gradient(140deg,
    color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 17%,var(--card-bg,#fff)),
    color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 7%,var(--card-bg,#fff)));
  box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 24%,transparent),
    0 6px 14px -8px color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 55%,transparent)}
/* Il selettore e' lungo apposta: le stesse righe le riscrive piu' in basso la
 * regola condivisa con la tessera aperta in griglia, che a parita' di peso
 * vincerebbe perche' viene dopo. */
#dm-widget-popup .dm-widget-detail .dm-w-head strong{
  grid-column:2;grid-row:1;
  font-family:'Oswald',system-ui,sans-serif;font-weight:700;
  font-size:clamp(19px,2.4vw,25px);line-height:1.05;letter-spacing:2px;text-transform:uppercase;
  color:color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 78%,#0f172a)}
#dm-widget-popup .dm-widget-detail .dm-w-head small{
  grid-column:2;grid-row:2;flex:none;
  font-size:11px;font-weight:800;letter-spacing:1.3px;text-transform:uppercase;
  color:var(--text-dim,#64748b);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#dm-widget-popup .dm-widget-detail .dm-w-close{
  grid-column:3;grid-row:1/3;
  flex:0 0 38px;width:38px;height:38px;border-radius:50%;
  display:grid;place-items:center;font-size:15px;font-weight:800;
  background:var(--card-bg,#fff);border:1px solid var(--card-border,#e2e8f0);
  color:var(--text-dim,#64748b);box-shadow:0 6px 16px -10px rgba(15,23,42,.5);
  transition:background .18s ease,border-color .18s ease,color .18s ease}
#dm-widget-popup .dm-widget-detail .dm-w-close:hover{
  background:#fee2e2;border-color:#fecaca;color:#dc2626}
html[data-theme="dark"] #dm-widget-popup .dm-widget-detail .dm-w-close:hover{
  background:rgba(220,38,38,.22);border-color:rgba(248,113,113,.45);color:#fca5a5}
/* E la finestra non ha piu' bisogno del filo di colore sul bordo alto: adesso
 * il colore ce l'ha la fascia. */
#dm-widget-popup .dm-widget-detail::before{display:none}
#dm-widget-popup .dm-w-body{
  padding:16px 18px 20px;display:grid;gap:9px;
  /* L'altezza minima azzerata perche' un figlio di colonna flex, per difetto,
     non scende sotto il proprio contenuto: senza, la lista non si accorcia mai
     e non c'e' niente da scorrere. */
  flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;
  -webkit-overflow-scrolling:touch;
  /* Una barra sottile del colore della tessera: senza, su un portatile che
     nasconde le barre finche' non si scorre, una lista lunga sembrava finire
     dove finisce la finestra. */
  scrollbar-width:thin;
  scrollbar-color:color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 42%,transparent) transparent}
#dm-widget-popup .dm-w-body::-webkit-scrollbar{width:9px}
#dm-widget-popup .dm-w-body::-webkit-scrollbar-track{background:transparent}
#dm-widget-popup .dm-w-body::-webkit-scrollbar-thumb{
  border-radius:100px;border:2px solid transparent;background-clip:padding-box;
  background:color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 38%,transparent)}
/* Ogni riga e' una tessera coricata.
 *
 * La lista era una fila di pastiglie tutte uguali: un'emoji da quindici pixel,
 * un nome, e a destra il comando. Chi era acceso e chi era spento lo diceva
 * soltanto il comando, in fondo alla riga — per sapere quante luci erano
 * accese bisognava leggere gli interruttori uno per uno. E la tessera da cui
 * si arrivava, in Home, era fatta in tutt'altro modo: pastiglia dell'icona
 * tinta, valore grande, nome sotto.
 *
 * Adesso la riga e' quella tessera messa in orizzontale. L'icona sta nella
 * stessa pastiglia — tinta del colore della sezione quando la cosa e' accesa,
 * neutra quando e' spenta — il nome e' piu' grosso di quello che ha sotto, il
 * valore e' in Oswald come tutti i numeri della plancia, e la riga intera si
 * vela appena del colore quando e' accesa: da un metro di distanza si contano
 * gli accesi senza leggere niente. */
/* Il riepilogo in cima: tre numeri grandi, quelli che si guardano prima di
 * mettersi a leggere le righe. Stessa aria delle tessere della Home — numero
 * in Oswald, etichetta minuscola sotto — dentro un vassoio appena tinto del
 * colore della sezione. */
#dm-widget-popup .dm-w-summary{
  display:flex;margin:0 0 4px;border-radius:18px;
  border:1px solid color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 22%,transparent);
  background:color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 5%,var(--card-bg,#fff))}
#dm-widget-popup .dm-w-stat{
  flex:1;min-width:0;display:grid;gap:2px;justify-items:center;padding:11px 8px 10px}
/* Le colonne le separa una riga, non un buco nello sfondo: il vassoio a
   griglia con la fessura da un pixel veniva misurato piu' corto di quello che
   e' e tagliava le etichette. */
#dm-widget-popup .dm-w-stat+.dm-w-stat{
  border-left:1px solid color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 18%,transparent)}
#dm-widget-popup .dm-w-stat b{
  font-family:'Oswald',system-ui,sans-serif;font-size:21px;font-weight:600;line-height:1;
  font-variant-numeric:tabular-nums;
  color:color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 72%,#0f172a)}
#dm-widget-popup .dm-w-stat span{
  font-size:10px;font-weight:800;letter-spacing:.9px;text-transform:uppercase;
  color:var(--text-dim,#94a3b8);text-align:center}
/* La rotella: apre il pannello della riga, e quando e' aperto si tinge —
 * altrimenti, con il pannello sotto, non si capiva quale riga l'aveva
 * aperto. */
#dm-widget-popup .dm-w-row .dm-w-more{
  flex:0 0 32px;width:32px;height:32px;display:grid;place-items:center;
  border-radius:11px;font-size:14px;cursor:pointer;
  border:1px solid var(--card-border,#e8edf3);background:var(--surface-2,#f8fafc);
  transition:background .18s ease,border-color .18s ease,transform .25s ease}
#dm-widget-popup .dm-w-row[data-dm-w-open="true"] .dm-w-more{
  background:color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 14%,transparent);
  border-color:color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 40%,transparent);
  transform:rotate(60deg)}
/* Il pannello si accoda alla riga: margine negativo per chiudere lo spazio
 * fra le righe, angoli alti squadrati e nessun bordo in cima. Le due cose
 * diventano una card sola. */
#dm-widget-popup .dm-w-panel{
  display:grid;gap:10px;margin:-9px 0 0;padding:14px 14px 15px;
  border:1px solid color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 40%,transparent);
  border-top:0;border-radius:0 0 18px 18px;
  background:color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 5%,var(--card-bg,#fff));
  box-shadow:0 14px 30px -22px color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 90%,transparent)}
#dm-widget-popup .dm-w-panel[hidden]{display:none}
#dm-widget-popup .dm-w-panel-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
#dm-widget-popup .dm-w-panel-lbl{
  flex:0 0 82px;font-size:10px;font-weight:800;letter-spacing:.9px;
  text-transform:uppercase;color:var(--text-dim,#94a3b8)}
#dm-widget-popup .dm-w-chips{display:flex;flex-wrap:wrap;gap:6px;flex:1;min-width:0}
#dm-widget-popup .dm-w-chip{
  padding:6px 11px;border-radius:999px;cursor:pointer;
  border:1px solid var(--card-border,#e8edf3);background:var(--card-bg,#fff);
  font:inherit;font-size:11.5px;font-weight:800;color:var(--text-dim,#64748b);
  transition:background .18s ease,border-color .18s ease,color .18s ease}
#dm-widget-popup .dm-w-chip:hover{
  border-color:color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 45%,transparent)}
#dm-widget-popup .dm-w-chip[data-on="true"]{
  background:var(--dm-widget-accent,#0ea5e9);border-color:transparent;color:#fff;
  box-shadow:0 6px 14px -9px color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 90%,transparent)}
/* Il passo della temperatura: meno, il numero, piu'. */
#dm-widget-popup .dm-w-stepper{
  display:inline-flex;align-items:center;gap:2px;padding:2px;border-radius:12px;
  background:var(--card-bg,#fff);box-shadow:inset 0 0 0 1px var(--card-border,#e8edf3)}
#dm-widget-popup .dm-w-stepper button{
  width:30px;height:28px;display:grid;place-items:center;border:0;border-radius:10px;
  background:transparent;color:var(--text,#0f172a);
  font:inherit;font-size:16px;font-weight:800;line-height:1;cursor:pointer;
  transition:background .15s ease}
#dm-widget-popup .dm-w-stepper button:hover{
  background:color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 14%,transparent)}
#dm-widget-popup .dm-w-stepper b{
  min-width:52px;text-align:center;
  font-family:'Oswald',system-ui,sans-serif;font-size:17px;font-weight:600;
  font-variant-numeric:tabular-nums}
#dm-widget-popup .dm-w-panel-note{
  margin:0;font-size:11px;font-weight:700;color:var(--text-dim,#94a3b8)}
/* Sul telefono l'etichetta va sopra: ottantadue pixel di colonna, su
   trecentonovanta, lasciavano alle modalita' una pastiglia per riga. */
@media(max-width:600px){
  #dm-widget-popup .dm-w-panel-row{flex-direction:column;align-items:stretch;gap:6px}
  #dm-widget-popup .dm-w-panel-lbl{flex:none}
  #dm-widget-popup .dm-w-stepper{align-self:flex-start}
}
#dm-widget-popup .dm-w-row{
  position:relative;display:flex;align-items:center;gap:12px;
  padding:10px 12px;border-radius:18px;
  border:1px solid var(--card-border,#eef2f7);
  background:var(--card-bg,#fff);margin:0;
  box-shadow:0 1px 2px rgba(15,23,42,.03);
  transition:border-color .18s ease,background .18s ease,box-shadow .18s ease}
/* Il binario di colore sul fianco non serve piu': il colore ce l'ha la
   pastiglia, e due cose colorate sulla stessa riga erano una di troppo. */
#dm-widget-popup .dm-w-row::before{display:none}
#dm-widget-popup .dm-w-row:hover{
  border-color:color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 32%,transparent);
  box-shadow:0 6px 16px -10px color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 60%,transparent)}
/* Aperta, la riga apre gli angoli in basso e lascia entrare il pannello. */
#dm-widget-popup .dm-w-row[data-dm-w-open="true"]{
  border-color:color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 40%,transparent);
  border-bottom-color:transparent;
  border-bottom-left-radius:0;border-bottom-right-radius:0;
  box-shadow:none}
/* Accesa: la velatura sulla riga. Lo stato lo dice il comando o l'icona, a
   seconda di cosa quella sezione mette in riga — si guardano tutti e tre. */
#dm-widget-popup .dm-w-row:is(
  :has(.dm-w-glyph[data-on="true"]),
  :has(.dm-w-switch[data-on="true"]),
  :has(.dm-w-power[data-on="true"])){
  background:color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 5%,var(--card-bg,#fff));
  border-color:color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 22%,var(--card-border,#eef2f7))}
/* La pastiglia dell'icona: la stessa della tessera in Home. */
#dm-widget-popup .dm-w-row .dm-w-glyph{
  flex:0 0 38px;width:38px;height:38px;display:grid;place-items:center;
  border-radius:13px;font-size:18px;filter:none;opacity:1;
  background:var(--surface-2,#f8fafc);
  box-shadow:inset 0 0 0 1px var(--card-border,#e8edf3);
  transition:background .2s ease,box-shadow .2s ease,filter .2s ease}
#dm-widget-popup .dm-w-row .dm-w-glyph[data-on="true"]{
  background:linear-gradient(150deg,
    color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 20%,#fff),
    color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 11%,#fff));
  box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 26%,transparent)}
/* Spenta: il grigio sta sulla pastiglia intera, ma il fondo e' gia' quasi
   grigio — a cambiare e' solo l'emoji, che e' quello che si vuole. */
#dm-widget-popup .dm-w-row .dm-w-glyph[data-on="false"]{filter:grayscale(1);opacity:.5}
/* Il nome pesa piu' di quello che ha sotto: prima erano quasi uguali e la riga
   si leggeva tutta insieme, senza un ordine. */
#dm-widget-popup .dm-w-row .dm-w-name{
  gap:2px;font-size:14px;font-weight:800;letter-spacing:.1px}
#dm-widget-popup .dm-w-row .dm-w-name small{
  font-size:11px;font-weight:700;letter-spacing:.2px;color:var(--text-dim,#94a3b8)}
/* I numeri in Oswald, come tutti i numeri della plancia, e incolonnabili. */
#dm-widget-popup .dm-w-row .dm-w-val{
  font-family:'Oswald',system-ui,sans-serif;font-size:18px;font-weight:600;
  font-variant-numeric:tabular-nums;color:var(--text,#0f172a)}
/* Il tasto di accensione: pastiglia quadrata come le altre, non un cerchio
   con l'alone — l'alone era l'unica cosa che si vedeva della riga. */
#dm-widget-popup .dm-w-row .dm-w-power{
  flex:0 0 36px;width:36px;height:36px;border-radius:12px;font-size:15px;
  border:1px solid var(--card-border,#e8edf3);background:var(--surface-2,#f8fafc);
  color:var(--text-dim,#94a3b8);box-shadow:none}
#dm-widget-popup .dm-w-row .dm-w-power[data-on="true"]{
  border-color:transparent;background:var(--dm-widget-accent,#0ea5e9);color:#fff;
  box-shadow:0 6px 14px -8px color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 85%,transparent)}
/* L'interruttore: un filo piu' largo, e da spento un grigio che si vede senza
   gridare. */
#dm-widget-popup .dm-w-row .dm-w-switch{
  flex:0 0 44px;width:44px;height:26px;
  background:color-mix(in srgb,var(--text-dim,#94a3b8) 26%,transparent)}
#dm-widget-popup .dm-w-row .dm-w-switch i{top:3px;left:3px;width:20px;height:20px}
#dm-widget-popup .dm-w-row .dm-w-switch[data-on="true"] i{transform:translateX(18px)}
/* I comandi minori — la tendina della posizione, le frecce — prendono la
   stessa forma della pastiglia, cosi' la riga ha un solo raggio. */
#dm-widget-popup .dm-w-row :is(.dm-w-position,.dm-w-arrows button,.dm-w-alarm button){
  border-radius:11px;background:var(--surface-2,#f8fafc);
  border:1px solid var(--card-border,#e8edf3)}
#dm-widget-popup .dm-w-row .dm-w-position{height:30px;width:38px}
#dm-widget-popup .dm-w-row .dm-w-arrows button{width:32px;height:32px}
/* Il titolo di un gruppo dentro la lista: maiuscoletto spaziato con la sua
   riga sottile, come le altre separazioni della plancia. */
/* Il tasto che apre una porta: la stessa pastiglia quadrata degli altri
 * comandi di riga, in verde perche' apre. */
#dm-widget-popup .dm-w-row .dm-w-door{
  flex:0 0 36px;width:36px;height:36px;display:grid;place-items:center;
  border-radius:12px;font-size:16px;cursor:pointer;
  border:1px solid var(--card-border,#e8edf3);background:var(--surface-2,#f8fafc);
  transition:background .18s ease,border-color .18s ease,transform .15s ease}
#dm-widget-popup .dm-w-row .dm-w-door:hover{
  background:color-mix(in srgb,var(--dm-widget-accent,#10b981) 14%,transparent);
  border-color:color-mix(in srgb,var(--dm-widget-accent,#10b981) 45%,transparent)}
#dm-widget-popup .dm-w-row .dm-w-door:active{transform:scale(.94)}
@media(prefers-reduced-motion:reduce){
  #dm-widget-popup .dm-w-row .dm-w-door{transition:none}
  #dm-widget-popup .dm-w-row .dm-w-door:active{transform:none}
}
/* La riga per scrivere: una casella e un piu', larghi quanto la lista. */
#dm-widget-popup .dm-todo-add{
  display:flex;gap:8px;margin:9px 0 2px}
#dm-widget-popup .dm-todo-new{
  flex:1 1 auto;min-width:0;height:38px;padding:0 13px;border-radius:13px;
  border:1px solid var(--card-border,#e8edf3);background:var(--card-bg,#fff);
  font:inherit;font-size:13px;font-weight:700;color:var(--text,#0f172a);
  transition:border-color .18s ease,box-shadow .18s ease}
#dm-widget-popup .dm-todo-new::placeholder{color:var(--text-dim,#94a3b8);font-weight:600}
#dm-widget-popup .dm-todo-new:focus{
  outline:none;border-color:var(--dm-widget-accent,#0ea5e9);
  box-shadow:0 0 0 3px color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 18%,transparent)}
#dm-widget-popup .dm-todo-plus{
  flex:0 0 38px;width:38px;height:38px;display:grid;place-items:center;
  border:0;border-radius:13px;cursor:pointer;
  background:var(--dm-widget-accent,#0ea5e9);color:#fff;
  font:inherit;font-size:19px;font-weight:800;line-height:1;
  box-shadow:0 8px 18px -10px color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 90%,transparent);
  transition:transform .15s ease,filter .18s ease}
#dm-widget-popup .dm-todo-plus:hover{filter:brightness(1.06)}
#dm-widget-popup .dm-todo-plus:active{transform:scale(.94)}
/* Il cestino sta in fondo alla riga e si fa vedere quando serve: sempre sul
   telefono, dove non c'e' un puntatore da avvicinare. */
#dm-widget-popup .dm-todo-del{
  flex:0 0 30px;width:30px;height:30px;display:grid;place-items:center;
  margin-left:auto;border:0;border-radius:10px;cursor:pointer;
  background:transparent;font-size:14px;line-height:1;opacity:.35;
  transition:opacity .18s ease,background .18s ease}
#dm-widget-popup .dm-todo-item:hover .dm-todo-del{opacity:1}
#dm-widget-popup .dm-todo-del:hover{background:#fee2e2;opacity:1}
@media(hover:none){#dm-widget-popup .dm-todo-del{opacity:.7}}
@media(prefers-reduced-motion:reduce){
  #dm-widget-popup .dm-todo-plus:active{transform:none}
}
#dm-widget-popup .dm-w-block-title{
  padding:10px 4px 8px;font-size:10.5px;letter-spacing:1.2px;
  border-bottom:1px solid var(--card-border,#eef2f7);margin-bottom:2px}
#dm-widget-popup .dm-w-empty{margin:6px 4px;font-size:13px}
/* Le miniature delle telecamere: lo stesso angolo delle righe. */
#dm-widget-popup .dm-w-cam{border-radius:16px}
@media(prefers-reduced-motion:reduce){
  #dm-widget-popup .dm-w-row,#dm-widget-popup .dm-w-close,
  #dm-widget-popup .dm-w-row .dm-w-more{transition:none}
  #dm-widget-popup .dm-w-row[data-dm-w-open="true"] .dm-w-more{transform:none}
  #dm-widget-popup .dm-w-close:hover{transform:none}
}
#dm-widget-popup .dm-w-name{font-size:13.5px;font-weight:800}
#dm-widget-popup .dm-w-val{font-size:14.5px;font-weight:900}
#dm-widget-popup .dm-w-glyph{font-size:17px}
@media(max-width:600px){
  #dm-widget-popup{padding:16px}
  #dm-widget-popup .dm-widget-detail{border-radius:22px;max-height:82dvh}
  #dm-widget-popup .dm-widget-detail .dm-w-head{padding:16px 16px 15px;column-gap:12px}
  #dm-widget-popup .dm-w-body{padding:13px 15px 18px}
}
/* ── «In primo piano»: il ponte dei widget della Home ─────────────────── */
#dm-widgets{display:block;margin:16px 0 6px}
/* L'intestazione e' un titolo di sezione, uguale a «Azioni rapide» e a
   «Persone»: sulla Home i blocchi si annunciano tutti allo stesso modo. Sotto,
   la riga che dice come sta la casa, e che si tinge quando qualcosa chiede
   attenzione. */
/* Come «Azioni rapide»: solo la parola, senza disegni davanti. Il simbolo che
 * c'era faceva di questa scritta un'altra cosa dalle sue sorelle. */
#dm-widgets .dm-widgets-title{
  margin:15px 0 0;font-family:'Inter',sans-serif;font-size:12px;font-weight:800;
  letter-spacing:2px;text-transform:uppercase;color:var(--text-dim,#64748b)}
#dm-widgets .dm-widgets-sub{
  margin:4px 0 14px;font-size:12px;font-weight:700;letter-spacing:.2px;color:var(--text-dim,#64748b)}
#dm-widgets[data-dm-mood="avviso"] .dm-widgets-sub{color:#b45309}

/* Le tessere: piccole, quiete, con l'anello che racconta e la freccia che
   promette. L'accento vive nei dettagli — l'anello, il fianco, il bagliore
   all'apertura — mai su tutta la tessera. */
:is(#dm-widgets,#dm-widget-popup) .dm-widgets-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(196px,1fr));gap:11px}
:is(#dm-widgets,#dm-widget-popup) .dm-tile{
  position:relative;overflow:hidden;display:flex;align-items:center;gap:12px;
  min-height:84px;padding:13px 14px 18px;
  border:1px solid var(--card-border,#e8edf3);border-radius:21px;
  /* Un velo del colore della sezione, non una tessera colorata: si riconosce
     di che cosa parla anche prima di leggerla, e resta una card chiara. */
  background:
    radial-gradient(120% 90% at 100% 0%,
      color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 11%,transparent),
      transparent 62%),
    var(--card-bg,#fff);
  color:var(--text,#0f172a);font:inherit;text-align:left;cursor:pointer;
  box-shadow:0 4px 14px rgba(15,23,42,.06),inset 0 1px 0 rgba(255,255,255,.6);
  transition:transform .26s cubic-bezier(.16,1,.3,1),box-shadow .26s ease,border-color .26s ease}
/* Il fianco della sezione: un filo di colore, non un bordo intero. */
:is(#dm-widgets,#dm-widget-popup) .dm-tile::before{
  content:'';position:absolute;left:0;top:14px;bottom:14px;width:3px;border-radius:0 3px 3px 0;
  background:var(--dm-widget-accent,#0ea5e9);opacity:.55}
/* L'ingresso e' per chi entra adesso: una tessera gia' vista non rianima. */
:is(#dm-widgets,#dm-widget-popup) .dm-tile:not([data-dm-seen]){
  animation:dmTileIn .4s cubic-bezier(.16,1,.3,1) both;
  animation-delay:calc(var(--dm-tile-i,0) * 40ms)}
@keyframes dmTileIn{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}
:is(#dm-widgets,#dm-widget-popup) .dm-tile:hover{
  transform:translateY(-2px);box-shadow:0 12px 26px rgba(15,23,42,.11);
  border-color:color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 34%,transparent)}
:is(#dm-widgets,#dm-widget-popup) .dm-tile:active{transform:none}
/* La pastiglia del simbolo: e' l'unico punto di colore pieno. */
:is(#dm-widgets,#dm-widget-popup) .dm-tile-chip{
  flex:0 0 40px;width:40px;height:40px;display:grid;place-items:center;border-radius:14px;font-size:19px;
  background:linear-gradient(150deg,
    color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 20%,#fff),
    color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 11%,#fff));
  box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 24%,transparent)}
:is(#dm-widgets,#dm-widget-popup) .dm-tile-copy{
  flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:1px}
:is(#dm-widgets,#dm-widget-popup) .dm-tile-value{
  font-size:23px;font-weight:900;line-height:1.05;letter-spacing:-.4px;font-variant-numeric:tabular-nums;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* Una parola al posto di un numero si rimpicciolisce quanto basta a entrare
   intera: meglio leggerla tutta che leggerne meta' in grande. */
:is(#dm-widgets,#dm-widget-popup) .dm-tile-value[data-dm-len="medio"]{font-size:18px;letter-spacing:-.2px}
:is(#dm-widgets,#dm-widget-popup) .dm-tile-value[data-dm-len="lungo"]{font-size:15px;letter-spacing:0}
:is(#dm-widgets,#dm-widget-popup) .dm-tile-under{
  /* Una riga per uno.
   *
   * Nome e didascalia stavano affiancati, e su un telefono il nome si prende
   * quasi tutta la tessera: della didascalia restava una coda tagliata a
   * meta' — «idita' 61%», «tra Bagno Pic» — che scorreva senza mai leggersi.
   * In colonna la didascalia ha la larghezza intera della tessera. */
  display:grid;gap:1px;min-width:0}
:is(#dm-widgets,#dm-widget-popup) .dm-tile-label{
  /* Il nome della sezione non si abbrevia: e' l'unica parola che dice di che
   * cosa si sta parlando. A stringersi e' semmai la didascalia accanto. */
  flex:0 0 auto;font-size:10px;font-weight:900;letter-spacing:.5px;text-transform:uppercase;
  color:var(--text-dim,#64748b);white-space:nowrap}
:is(#dm-widgets,#dm-widget-popup) .dm-tile-caption{
  min-width:0;font-size:10.5px;font-weight:700;color:var(--text-dim,#94a3b8);
  white-space:nowrap;overflow:hidden;
  /* Sfuma sul bordo invece di tagliare: si capisce che il testo continua. */
  mask-image:linear-gradient(90deg,#000 84%,transparent);
  -webkit-mask-image:linear-gradient(90deg,#000 84%,transparent)}
:is(#dm-widgets,#dm-widget-popup) .dm-tile-scroll{display:inline-block;white-space:nowrap}
:is(#dm-widgets,#dm-widget-popup) .dm-tile-scroll[data-dm-scroll="true"]{
  animation:dmTileScroll var(--dm-scroll-dur,10s) ease-in-out infinite alternate;
  animation-delay:1.2s}
@keyframes dmTileScroll{
  0%,12%{transform:translateX(0)}
  88%,100%{transform:translateX(var(--dm-scroll-x,0))}}
@media(prefers-reduced-motion:reduce){
  :is(#dm-widgets,#dm-widget-popup) .dm-tile-scroll[data-dm-scroll="true"]{animation:none}
}
:is(#dm-widgets) .dm-widgets-sub{
  overflow:hidden;white-space:nowrap;text-overflow:clip}
:is(#dm-widgets) .dm-sub-scroll{display:inline-block;will-change:transform}
:is(#dm-widgets) .dm-sub-scroll[data-dm-scroll="true"]{
  animation:dmTileScroll var(--dm-scroll-dur,12s) ease-in-out infinite alternate;
  animation-delay:1.6s}
@media(prefers-reduced-motion:reduce){
  :is(#dm-widgets) .dm-sub-scroll[data-dm-scroll="true"]{animation:none}
}

:is(#dm-widgets,#dm-widget-popup) .dm-tile-go{
  flex:0 0 auto;color:color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 65%,var(--text-dim,#94a3b8));
  font-size:17px;font-weight:900;line-height:1;opacity:.75;
  transition:transform .26s cubic-bezier(.16,1,.3,1),opacity .26s ease}
:is(#dm-widgets,#dm-widget-popup) .dm-tile:hover .dm-tile-go{transform:translateX(2px);opacity:1}
/* La quota: un filo sul bordo basso, largo quanto la tessera. */
/* La quota: un filo dentro la tessera, con gli angoli tondi come lei — non
 * una riga che sborda dal bordo. */
:is(#dm-widgets,#dm-widget-popup) .dm-tile-bar{
  position:absolute;left:13px;right:13px;bottom:7px;height:3px;border-radius:99px;overflow:hidden;
  background:color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 14%,transparent)}
:is(#dm-widgets,#dm-widget-popup) .dm-tile-bar i{
  display:block;height:100%;width:var(--dm-quota,0%);border-radius:99px;
  background:var(--dm-widget-accent,#0ea5e9);
  transition:width .5s cubic-bezier(.16,1,.3,1)}
:is(#dm-widgets,#dm-widget-popup) .dm-tile .dm-tile-shine{
  position:absolute;top:-20%;bottom:-20%;width:34%;left:-60%;pointer-events:none;
  background:linear-gradient(105deg,transparent,rgba(255,255,255,.5),transparent);
  transform:skewX(-14deg);transition:left .55s cubic-bezier(.16,1,.3,1)}
:is(#dm-widgets,#dm-widget-popup) .dm-tile:hover .dm-tile-shine{left:120%}
/* Una tessera che chiede attenzione si riconosce senza leggerla: il fianco e
   il bordo si scaldano, e la pastiglia pulsa. */
:is(#dm-widgets,#dm-widget-popup) .dm-tile[data-alert="true"]{
  border-color:color-mix(in srgb,#f59e0b 42%,var(--card-border,#e8edf3))}
:is(#dm-widgets,#dm-widget-popup) .dm-tile[data-alert="true"]::before{background:#f59e0b;opacity:.9}
/* Un avviso non sta fermo: la pastiglia pulsa, come faceva l'anello prima. */
:is(#dm-widgets,#dm-widget-popup) .dm-tile[data-alert="true"] .dm-tile-chip{
  position:relative;
  background:linear-gradient(150deg,
    color-mix(in srgb,var(--dm-widget-accent,#ef4444) 34%,#fff),
    color-mix(in srgb,var(--dm-widget-accent,#ef4444) 18%,#fff))}
:is(#dm-widgets,#dm-widget-popup) .dm-tile[data-alert="true"] .dm-tile-chip::after{
  content:"";position:absolute;inset:-3px;border-radius:15px;pointer-events:none;
  border:2px solid color-mix(in srgb,var(--dm-widget-accent,#ef4444) 55%,transparent);
  animation:dmWidgetPing 2.2s ease-out infinite}
@keyframes dmWidgetPing{
  0%{opacity:.75;transform:scale(.92)}
  70%{opacity:0;transform:scale(1.35)}
  100%{opacity:0;transform:scale(1.35)}}
@media(prefers-reduced-motion:reduce){
  :is(#dm-widgets,#dm-widget-popup) .dm-tile[data-alert="true"] .dm-tile-chip::after{animation:none}
}
:is(#dm-widgets,#dm-widget-popup) .dm-widget-detail{
  grid-column:1/-1;position:relative;overflow:hidden;
  border:1px solid color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 26%,var(--card-border,#e8edf3));
  border-radius:20px;background:var(--card-bg,#fff);
  box-shadow:0 16px 36px rgba(15,23,42,.10);
  animation:dmWidgetIn .32s cubic-bezier(.16,1,.3,1)}
:is(#dm-widgets,#dm-widget-popup) .dm-widget-detail::before{
  content:"";position:absolute;top:0;left:0;right:0;height:3px;
  background:linear-gradient(90deg,transparent,var(--dm-widget-accent,#0ea5e9) 30%,var(--dm-widget-accent,#0ea5e9) 70%,transparent)}
@keyframes dmWidgetIn{from{opacity:0;transform:translateY(-7px) scale(.985)}to{opacity:1;transform:none}}
:is(#dm-widgets,#dm-widget-popup) .dm-w-head{display:flex;align-items:center;gap:9px;padding:13px 16px 10px}
:is(#dm-widgets,#dm-widget-popup) .dm-w-head-ic{font-size:16px}
:is(#dm-widgets,#dm-widget-popup) .dm-w-head strong{
  font-size:12.5px;font-weight:900;letter-spacing:1px;text-transform:uppercase}
:is(#dm-widgets,#dm-widget-popup) .dm-w-head small{flex:1;min-width:0;font-size:11px;font-weight:700;color:var(--text-dim,#94a3b8);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
:is(#dm-widgets,#dm-widget-popup) .dm-w-close{
  flex:0 0 28px;width:28px;height:28px;display:grid;place-items:center;border:0;border-radius:9px;
  background:var(--surface-3,#f1f5f9);color:var(--text-dim,#64748b);font-size:12px;cursor:pointer}
:is(#dm-widgets,#dm-widget-popup) .dm-w-body{display:grid;gap:2px;padding:0 10px 12px}
:is(#dm-widgets,#dm-widget-popup) .dm-w-row{
  display:flex;align-items:center;gap:11px;min-height:42px;padding:5px 8px;border-radius:12px;
  animation:none;
  transition:background .2s ease}
/* Le righe entrano una volta sola: al primo disegno dopo l'apertura. */
:is(#dm-widgets,#dm-widget-popup) .dm-w-body[data-dm-fresh="true"] .dm-row{
  animation:dmRowIn .32s cubic-bezier(.16,1,.3,1) both}
@keyframes dmRowIn{from{opacity:0;transform:translateX(-7px)}to{opacity:1;transform:none}}
:is(#dm-widgets,#dm-widget-popup) .dm-w-row:nth-child(1){animation-delay:30ms}
:is(#dm-widgets,#dm-widget-popup) .dm-w-row:nth-child(2){animation-delay:60ms}
:is(#dm-widgets,#dm-widget-popup) .dm-w-row:nth-child(3){animation-delay:90ms}
:is(#dm-widgets,#dm-widget-popup) .dm-w-row:nth-child(4){animation-delay:120ms}
:is(#dm-widgets,#dm-widget-popup) .dm-w-row:nth-child(5){animation-delay:150ms}
:is(#dm-widgets,#dm-widget-popup) .dm-w-row:nth-child(6){animation-delay:180ms}
:is(#dm-widgets,#dm-widget-popup) .dm-w-row:nth-child(n+7){animation-delay:210ms}
:is(#dm-widgets,#dm-widget-popup) .dm-w-row:hover{background:var(--surface-3,#f1f5f9)}
:is(#dm-widgets,#dm-widget-popup) .dm-w-glyph{flex:0 0 auto;font-size:15px;transition:filter .25s ease,opacity .25s ease}
:is(#dm-widgets,#dm-widget-popup) .dm-w-glyph[data-on="false"]{filter:grayscale(1);opacity:.4}
:is(#dm-widgets,#dm-widget-popup) .dm-w-appl-ic{
  flex:0 0 auto;display:grid;place-items:center;width:24px;height:24px;
  color:var(--dm-widget-accent,#06b6d4)}
:is(#dm-widgets,#dm-widget-popup) .dm-w-appl-ic svg{width:20px;height:20px;display:block;stroke:currentColor;fill:none}
:is(#dm-widgets,#dm-widget-popup) .dm-w-appl-ic svg [stroke],:is(#dm-widgets,#dm-widget-popup) .dm-w-appl-ic svg path,
:is(#dm-widgets,#dm-widget-popup) .dm-w-appl-ic svg rect,:is(#dm-widgets,#dm-widget-popup) .dm-w-appl-ic svg circle,
:is(#dm-widgets,#dm-widget-popup) .dm-w-appl-ic svg line{stroke:currentColor}
:is(#dm-widgets,#dm-widget-popup) .dm-w-appl-ic svg [fill="currentColor"]{fill:currentColor}
:is(#dm-widgets,#dm-widget-popup) .dm-w-alarm{display:inline-flex;gap:6px;margin-left:auto}
:is(#dm-widgets,#dm-widget-popup) .dm-w-alarm button{
  width:32px;height:28px;border-radius:9px;border:1px solid var(--card-border,#e2e8f0);
  background:var(--surface-2,#f8fafc);font-size:13px;line-height:1;cursor:pointer;
  transition:transform .15s ease,background .2s ease,border-color .2s ease,box-shadow .2s ease}
:is(#dm-widgets,#dm-widget-popup) .dm-w-alarm button:hover{transform:translateY(-1px)}
:is(#dm-widgets,#dm-widget-popup) .dm-w-alarm button[data-on="true"]{
  background:color-mix(in srgb,var(--dm-widget-accent,#10b981) 16%,transparent);
  border-color:var(--dm-widget-accent,#10b981);
  box-shadow:0 0 0 3px color-mix(in srgb,var(--dm-widget-accent,#10b981) 14%,transparent)}
:is(#dm-widgets,#dm-widget-popup) .dm-w-name{min-width:0;flex:1;display:grid;gap:0;font-size:13px;font-weight:700;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
:is(#dm-widgets,#dm-widget-popup) .dm-w-name small{font-size:10.5px;font-weight:700;color:var(--text-dim,#94a3b8)}
:is(#dm-widgets,#dm-widget-popup) .dm-w-val{flex:0 0 auto;font-family:'Oswald',sans-serif;font-size:14px;font-weight:600}
:is(#dm-widgets,#dm-widget-popup) .dm-w-empty{margin:4px 8px;font-size:12.5px;font-weight:700;color:var(--text-dim,#64748b)}
:is(#dm-widgets,#dm-widget-popup) .dm-w-block{padding:4px 6px 6px}
:is(#dm-widgets,#dm-widget-popup) .dm-w-block-title{
  display:block;padding:4px 2px 7px;font-size:10.5px;font-weight:900;letter-spacing:1px;
  text-transform:uppercase;color:var(--text-dim,#64748b)}

/* L'interruttore delle luci: una pillola che scatta. */
:is(#dm-widgets,#dm-widget-popup) .dm-w-switch{
  flex:0 0 40px;width:40px;height:23px;position:relative;border:0;border-radius:999px;cursor:pointer;
  background:color-mix(in srgb,var(--text-dim,#94a3b8) 32%,transparent);transition:background .25s ease}
:is(#dm-widgets,#dm-widget-popup) .dm-w-switch i{
  position:absolute;top:2.5px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;
  box-shadow:0 2px 6px rgba(15,23,42,.25);transition:transform .25s cubic-bezier(.16,1,.3,1)}
:is(#dm-widgets,#dm-widget-popup) .dm-w-switch[data-on="true"]{background:var(--dm-widget-accent,#f59e0b)}
:is(#dm-widgets,#dm-widget-popup) .dm-w-switch[data-on="true"] i{transform:translateX(16px)}
:is(#dm-widgets,#dm-widget-popup) .dm-w-power{
  flex:0 0 32px;width:32px;height:32px;display:grid;place-items:center;border-radius:50%;cursor:pointer;
  border:1.5px solid var(--card-border,#e8edf3);background:transparent;color:var(--text-dim,#94a3b8);
  font-size:14px;transition:all .25s ease}
:is(#dm-widgets,#dm-widget-popup) .dm-w-power[data-on="true"]{
  border-color:transparent;background:var(--dm-widget-accent,#0ea5e9);color:#fff;
  box-shadow:0 4px 12px color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 40%,transparent)}
/* Il disegno dell'accensione sta al centro e prende il colore del tasto. */
:is(#dm-widgets,#dm-widget-popup) .dm-w-power svg{display:block;width:17px;height:17px}
#dm-widget-popup .dm-w-row .dm-w-power{display:grid;place-items:center}
:is(#dm-widgets,#dm-widget-popup) .dm-w-position{
  appearance:none;-webkit-appearance:none;flex:0 0 auto;margin-left:5px;height:26px;
  width:34px;text-align:center;text-align-last:center;
  padding:0;border:1px solid var(--card-border,#e2e8f0);border-radius:9px;
  background:var(--surface-2,#f8fafc);color:var(--text,#0f172a);
  font:inherit;font-size:12px;font-weight:800;line-height:1;cursor:pointer;
  transition:border-color .2s ease,background .2s ease}
:is(#dm-widgets,#dm-widget-popup) .dm-w-position:hover{border-color:var(--dm-widget-accent,#8b5cf6)}
:is(#dm-widgets,#dm-widget-popup) .dm-w-arrows{display:inline-flex;gap:5px}
:is(#dm-widgets,#dm-widget-popup) .dm-w-arrows button{
  width:29px;height:29px;display:grid;place-items:center;border-radius:9px;cursor:pointer;
  border:1px solid var(--card-border,#e8edf3);background:var(--surface-3,#f1f5f9);
  color:var(--text,#0f172a);font-size:11px;transition:all .2s ease}
:is(#dm-widgets,#dm-widget-popup) .dm-w-arrows button:hover{
  background:var(--dm-widget-accent,#8b5cf6);border-color:transparent;color:#fff}

/* Le miniature delle telecamere: il letterbox scuro del muro, in piccolo. */
:is(#dm-widgets,#dm-widget-popup) .dm-w-cams{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;padding:2px 6px 4px}
:is(#dm-widgets,#dm-widget-popup) .dm-w-cam{position:relative;margin:0;border-radius:14px;overflow:hidden;background:#0b1220;aspect-ratio:16/9}
:is(#dm-widgets,#dm-widget-popup) .dm-w-cam img{width:100%;height:100%;object-fit:cover;display:block;opacity:0;
  transition:opacity .4s ease,transform .6s cubic-bezier(.16,1,.3,1)}
:is(#dm-widgets,#dm-widget-popup) .dm-w-cam:hover img{transform:scale(1.06)}
:is(#dm-widgets,#dm-widget-popup) .dm-w-cam-live{
  display:inline-block;width:6px;height:6px;margin-right:6px;border-radius:50%;
  background:#f87171;vertical-align:1px;animation:dmWidgetLive 1.6s steps(1) infinite}
@keyframes dmWidgetLive{0%,100%{opacity:1}50%{opacity:.25}}
:is(#dm-widgets,#dm-widget-popup) .dm-w-cam img[data-dm-camera-state="ready"]{opacity:1}
:is(#dm-widgets,#dm-widget-popup) .dm-w-cam figcaption{
  position:absolute;left:0;right:0;bottom:0;padding:5px 9px;
  font-size:10.5px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:#e2eefb;
  background:linear-gradient(0deg,rgba(2,6,15,.72),transparent)}

/* Le voci ToDo dentro il dettaglio. */
:is(#dm-widgets,#dm-widget-popup) .dm-todo-items{list-style:none;margin:0;padding:0 2px;display:grid;gap:8px}
:is(#dm-widgets,#dm-widget-popup) .dm-todo-item{display:flex;align-items:flex-start;gap:10px;min-width:0}
:is(#dm-widgets,#dm-widget-popup) .dm-todo-check{
  position:relative;flex:0 0 21px;width:21px;height:21px;margin-top:1px;border-radius:50%;cursor:pointer;
  border:2px solid color-mix(in srgb,var(--text-dim,#94a3b8) 55%,transparent);background:transparent;padding:0;
  transition:border-color .2s ease,background .25s ease,transform .15s ease}
:is(#dm-widgets,#dm-widget-popup) .dm-todo-check:hover{border-color:var(--dm-widget-accent,#059669);transform:scale(1.08)}
:is(#dm-widgets,#dm-widget-popup) .dm-todo-check::after{
  content:"✓";position:absolute;inset:0;display:grid;place-items:center;
  color:#fff;font-size:12px;font-weight:900;opacity:0;transform:scale(.4);
  transition:opacity .2s ease,transform .25s cubic-bezier(.16,1,.3,1)}
:is(#dm-widgets,#dm-widget-popup) .dm-todo-item.is-done .dm-todo-check{
  border-color:var(--dm-widget-accent,#059669);background:var(--dm-widget-accent,#059669)}
:is(#dm-widgets,#dm-widget-popup) .dm-todo-item.is-done .dm-todo-check::after{opacity:1;transform:scale(1)}
:is(#dm-widgets,#dm-widget-popup) .dm-todo-text{min-width:0;font-size:13.5px;font-weight:600;line-height:1.4;overflow-wrap:anywhere}
:is(#dm-widgets,#dm-widget-popup) .dm-todo-item.is-done .dm-todo-text{color:var(--text-dim,#94a3b8);text-decoration:line-through}
:is(#dm-widgets,#dm-widget-popup) .dm-todo-due{
  display:inline-flex;align-items:center;gap:3px;margin-left:7px;padding:1px 7px;border-radius:999px;
  background:var(--surface-3,#f1f5f9);border:1px solid var(--card-border,#e8edf3);
  font-size:10.5px;font-weight:800;color:var(--text-dim,#64748b);white-space:nowrap;vertical-align:1px}
:is(#dm-widgets,#dm-widget-popup) .dm-todo-due[data-overdue="true"]{
  background:rgba(244,63,94,.10);border-color:rgba(244,63,94,.30);color:#be123c}

@media (prefers-reduced-motion:reduce){
  :is(#dm-widgets,#dm-widget-popup) .dm-tile,:is(#dm-widgets,#dm-widget-popup) .dm-tile-chevron,:is(#dm-widgets,#dm-widget-popup) .dm-todo-check,
  :is(#dm-widgets,#dm-widget-popup) .dm-todo-check::after,:is(#dm-widgets,#dm-widget-popup) .dm-w-switch,:is(#dm-widgets,#dm-widget-popup) .dm-w-switch i,
  :is(#dm-widgets,#dm-widget-popup) .dm-tile-chip,:is(#dm-widgets,#dm-widget-popup) .dm-w-cam img,
  :is(#dm-widgets,#dm-widget-popup) .dm-tile .dm-tile-shine{transition:none}
  :is(#dm-widgets,#dm-widget-popup) .dm-widget-detail,:is(#dm-widgets,#dm-widget-popup) .dm-tile,:is(#dm-widgets,#dm-widget-popup) .dm-w-row,
  :is(#dm-widgets,#dm-widget-popup) .dm-tile[data-alert="true"] .dm-tile-chip::after,
  :is(#dm-widgets,#dm-widget-popup) .dm-w-cam-live{animation:none}
}
@media (max-width:520px){
  :is(#dm-widgets,#dm-widget-popup) .dm-widgets-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
}
`);
}

export function installHomeWidgetsSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  doc.addEventListener("click", onClick);
  bindEscape();
  doc.addEventListener("change", onChange);
  doc.addEventListener("input", onInput);
  doc.addEventListener("keydown", onKeydown);
  for (const eventName of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:persistence-restored",
    "dashboardmodern:config-reset",
    "dashboardmodern:state-changed",
    // Una tapparella appena aggiunta in configurazione deve avere la sua
    // tessera subito, non al prossimo evento di stato.
    "dashboardmodern:editor-rendered",
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
  /* Il ritardo di fine ciclo scade in silenzio: l'elettrodomestico ha smesso
   * di consumare, e nessun cambio di stato arriva ad avvisare la tessera. */
  onRunHoldExpiry(() => schedule());
  schedule();
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", () => installHomeWidgetsSection(), { once: true });
} else {
  installHomeWidgetsSection();
}
