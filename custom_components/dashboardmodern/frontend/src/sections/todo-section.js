/* Le cose da fare, in Home (#201).
 *
 * Ogni lista `todo.*` configurata in `cd_todo` ha la sua card sotto le persone
 * di casa: le voci ancora da fare, ognuna col suo cerchietto, e spuntarla
 * chiama `todo.update_item` — la lista e' di Home Assistant, la card e' solo
 * il posto dove la si vede senza andarla a cercare.
 *
 * Lo stato dell'entita' `todo.*` e' il solo numero delle voci aperte: le voci
 * arrivano da `todo.get_items` con `return_response`, sulla stessa presa
 * WebSocket della plancia (lo stesso giro del meteo e del selettore dei file).
 * Niente polling: si rilegge quando lo stato dell'entita' cambia, quando la
 * configurazione cambia e quando si torna sulla Home.
 */
import {
  normalizeTodoLists,
  parseTodoItemsResponse,
  pendingTodoItems,
} from "../core/todo-model.js";
import {
  allStates,
  clean,
  doc,
  esc,
  installStyle,
  lexicalGlobal,
  readJson,
  root,
  t,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_TODO_SECTION__";
const STYLE_ID = "dm-todo-style";
export const TODO_CONFIG_KEY = "cd_todo";
const STALE_MS = 30000;
const MAX_VISIBLE_ITEMS = 8;

const state = (root[KEY] ||= {
  installed: false,
  frame: 0,
  lists: new Map(), // entity -> { items, fetchedAt, inflight }
});

export function configuredTodoLists() {
  return normalizeTodoLists(readJson(TODO_CONFIG_KEY, []));
}

/* ── the wire ─────────────────────────────────────────────────────────── */

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
  try {
    if (typeof root.dmCallHaService === "function") {
      await root.dmCallHaService("todo", "update_item", payload);
    } else if (typeof root.callService === "function") {
      await root.callService("todo", "update_item", payload);
    } else {
      await (root.hass || root._hass)?.callService?.("todo", "update_item", payload);
    }
  } catch (error) {
    item.status = "needs_action";
    item.localDone = false;
    root.console?.error?.("[DashboardModern] todo update", error);
    schedule();
    return;
  }
  root.setTimeout?.(() => fetchItems(list.entity, { force: true }), 4000);
}

/* ── markup ───────────────────────────────────────────────────────────── */

function listTitle(list, states) {
  return (
    clean(list.name) ||
    clean(states[list.entity]?.attributes?.friendly_name) ||
    list.entity.split(".")[1].replaceAll("_", " ")
  );
}

function itemMarkup(list, item) {
  const done = item.status === "completed";
  const due = item.due ? `<small class="dm-todo-due">📅 ${esc(item.due.slice(0, 10))}</small>` : "";
  return `<li class="dm-todo-item${done ? " is-done" : ""}">
      <button type="button" class="dm-todo-check" data-dm-todo-check data-dm-todo-list="${esc(list.id)}"
        data-dm-todo-uid="${esc(item.uid)}" data-dm-todo-summary="${esc(item.summary)}"
        aria-label="${esc(t(`Segna fatta: ${item.summary}`, `Mark done: ${item.summary}`))}"${done ? " disabled" : ""}></button>
      <span class="dm-todo-text">${esc(item.summary)}${due}</span>
    </li>`;
}

function cardMarkup(list, states) {
  const cache = record(list.entity);
  const items = cache.items;
  const pending = pendingTodoItems(items || []);
  const shown = (items || [])
    .filter((item) => item.status !== "completed" || item.localDone)
    .slice(0, MAX_VISIBLE_ITEMS);
  const extra = pending.length - shown.filter((item) => item.status !== "completed").length;
  let body;
  if (items === null) body = `<p class="dm-todo-empty">${esc(t("Caricamento…", "Loading…"))}</p>`;
  else if (!pending.length && !shown.length)
    body = `<p class="dm-todo-empty">✨ ${esc(t("Tutto fatto", "All done"))}</p>`;
  else
    body = `<ul class="dm-todo-items">${shown.map((item) => itemMarkup(list, item)).join("")}</ul>${
      extra > 0 ? `<p class="dm-todo-more">${esc(t(`+${extra} altre voci`, `+${extra} more items`))}</p>` : ""
    }`;
  return `<article class="dm-todo-card" data-dm-todo="${esc(list.id)}">
      <header class="dm-todo-head">
        <span class="dm-todo-ic" aria-hidden="true">✅</span>
        <strong class="dm-todo-title">${esc(listTitle(list, states))}</strong>
        <span class="dm-todo-count">${pending.length}</span>
      </header>
      ${body}
    </article>`;
}

/* ── rendering ────────────────────────────────────────────────────────── */

function ensureHost() {
  const page = doc?.getElementById?.("page-home");
  if (!page) return null;
  let host = doc.getElementById("dm-todo");
  if (host) return host;
  host = doc.createElement("div");
  host.id = "dm-todo";
  host.innerHTML = `<h3 class="section-title dm-todo-section-title"></h3><div class="dm-todo-grid"></div>`;
  // Sotto le persone di casa quando ci sono, altrimenti sotto le pastiglie:
  // sempre prima del Quadro Avvisi.
  const people = doc.getElementById("dm-people");
  const pills = doc.getElementById("dashboard-pills-row");
  if (people?.parentElement === page) people.after(host);
  else if (pills?.parentElement === page) pills.after(host);
  else page.prepend(host);
  return host;
}

export function renderTodoSection() {
  const lists = configuredTodoLists();
  const host = doc?.getElementById?.("dm-todo");
  if (!lists.length) {
    host?.remove();
    return false;
  }
  const mounted = host || ensureHost();
  if (!mounted) return false;
  const states = allStates();
  const title = mounted.querySelector(".dm-todo-section-title");
  if (title) title.textContent = t("Da fare", "To-do");
  const grid = mounted.querySelector(".dm-todo-grid");
  if (grid) grid.innerHTML = lists.map((list) => cardMarkup(list, states)).join("");
  for (const list of lists) fetchItems(list.entity);
  return true;
}

function schedule() {
  if (state.frame) return;
  const run = () => {
    state.frame = 0;
    try {
      renderTodoSection();
    } catch (error) {
      root.console?.warn?.("[DashboardModern] todo section", error);
    }
  };
  state.frame = root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 0) || 0;
}

/* ── wiring ───────────────────────────────────────────────────────────── */

function stateChangeTouchesTodo(event) {
  const values = event?.detail?.entity_ids || [event?.detail?.entity_id];
  const changed = new Set((Array.isArray(values) ? values : [values]).map(clean).filter(Boolean));
  if (!changed.size) return false;
  return configuredTodoLists().some((list) => changed.has(list.entity));
}

function onClick(event) {
  const check = event.target?.closest?.("[data-dm-todo-check]");
  if (!check || check.disabled) return;
  event.preventDefault();
  const list = configuredTodoLists().find((value) => value.id === clean(check.dataset.dmTodoList));
  if (!list) return;
  completeItem(list, clean(check.dataset.dmTodoUid), clean(check.dataset.dmTodoSummary));
}

function installStyles() {
  installStyle(STYLE_ID, `
#dm-todo{display:block;margin:14px 0 4px}
#dm-todo .dm-todo-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}
.dm-todo-card{
  border:1px solid var(--card-border,#e8edf3);border-radius:18px;padding:14px 16px;
  background:var(--card-bg,#fff);color:var(--text,#0f172a);
  box-shadow:0 10px 26px rgba(15,23,42,.06);display:flex;flex-direction:column;gap:10px}
.dm-todo-head{display:flex;align-items:center;gap:9px;min-width:0}
.dm-todo-ic{font-size:16px}
.dm-todo-title{
  flex:1;min-width:0;font-size:13px;font-weight:900;letter-spacing:.6px;text-transform:uppercase;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dm-todo-count{
  flex:0 0 auto;min-width:26px;padding:2px 8px;border-radius:999px;text-align:center;
  font-size:11px;font-weight:800;color:var(--text-dim,#64748b);
  background:var(--surface-3,#f1f5f9);border:1px solid var(--card-border,#e8edf3)}
.dm-todo-items{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.dm-todo-item{display:flex;align-items:flex-start;gap:10px;min-width:0}
.dm-todo-check{
  flex:0 0 20px;width:20px;height:20px;margin-top:1px;border-radius:50%;cursor:pointer;
  border:2px solid var(--text-dim,#94a3b8);background:transparent;padding:0;
  transition:border-color .2s ease,background .2s ease}
.dm-todo-check:hover{border-color:#059669}
.dm-todo-item.is-done .dm-todo-check{border-color:#059669;background:#059669}
.dm-todo-text{min-width:0;font-size:13.5px;font-weight:600;line-height:1.35;overflow-wrap:anywhere}
.dm-todo-item.is-done .dm-todo-text{color:var(--text-dim,#94a3b8);text-decoration:line-through}
.dm-todo-due{display:block;font-size:11px;font-weight:700;color:var(--text-dim,#64748b)}
.dm-todo-empty{margin:0;font-size:12.5px;font-weight:700;color:var(--text-dim,#64748b)}
.dm-todo-more{margin:0;font-size:11.5px;font-weight:700;color:var(--text-dim,#64748b)}
`);
}

export function installTodoSection() {
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
  doc.addEventListener("DOMContentLoaded", () => installTodoSection(), { once: true });
} else {
  installTodoSection();
}
