/* «In primo piano»: la zona dei widget della Home (#201).
 *
 * Non una card sciolta ma una parte della Home dedicata ai widget, con la sua
 * testata — il riquadro col gradiente, il titolo, la pastiglia col totale — e
 * una griglia disegnata per ospitarne anche di futuri. Oggi la abitano le
 * liste ToDo di Home Assistant: ogni lista e' una card con l'anello di
 * avanzamento (fatte su totale), le voci da spuntare e la scadenza; spuntarne
 * una chiama `todo.update_item` — la lista resta di Home Assistant, qui e'
 * solo sempre sott'occhio.
 *
 * Lo stato di un'entita' `todo.*` e' il solo numero delle voci aperte: le voci
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
const STYLE_ID = "dm-widgets-style";
export const TODO_CONFIG_KEY = "cd_todo";
const STALE_MS = 30000;
const MAX_VISIBLE_ITEMS = 8;
/* Un accento per card, a rotazione: gli stessi colori che la plancia usa per
 * le sue sezioni, cosi' la zona dei widget e' colorata senza essere un'altra
 * tavolozza. */
const ACCENTS = Object.freeze(["#0ea5e9", "#8b5cf6", "#059669", "#f59e0b"]);

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

/* La data di oggi nella scala delle scadenze, in ora locale: `toISOString`
 * sarebbe UTC, e a mezzanotte meno un quarto una voce di domani risulterebbe
 * scaduta. */
function localToday() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

function itemMarkup(list, item, today) {
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

function cardMarkup(list, states, index) {
  const cache = record(list.entity);
  const items = cache.items;
  const pending = pendingTodoItems(items || []);
  const total = (items || []).length;
  const doneCount = total - pending.length;
  const percent = total ? Math.round((doneCount / total) * 100) : 0;
  const today = localToday();
  const shown = (items || [])
    .filter((item) => item.status !== "completed" || item.localDone)
    .slice(0, MAX_VISIBLE_ITEMS);
  const extra = pending.length - shown.filter((item) => item.status !== "completed").length;
  let body;
  if (items === null) body = `<p class="dm-todo-empty">${esc(t("Caricamento…", "Loading…"))}</p>`;
  else if (!pending.length && !shown.length)
    body = `<p class="dm-todo-empty dm-todo-done-all">✨ ${esc(t("Tutto fatto", "All done"))}</p>`;
  else
    body = `<ul class="dm-todo-items">${shown.map((item) => itemMarkup(list, item, today)).join("")}</ul>${
      extra > 0 ? `<p class="dm-todo-more">${esc(t(`+${extra} altre voci`, `+${extra} more items`))}</p>` : ""
    }`;
  const accent = ACCENTS[index % ACCENTS.length];
  return `<article class="dm-widget dm-todo-card" data-dm-todo="${esc(list.id)}" style="--dm-widget-accent:${accent}">
      <header class="dm-todo-head">
        <span class="dm-todo-ring" style="--dm-ring-pct:${percent}" aria-hidden="true"><b>${pending.length}</b></span>
        <div class="dm-todo-titles">
          <strong class="dm-todo-title">${esc(listTitle(list, states))}</strong>
          ${total ? `<small class="dm-todo-progress">${doneCount}/${total}</small>` : ""}
        </div>
        <span class="dm-todo-glyph" aria-hidden="true">✅</span>
      </header>
      ${body}
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
      <span class="dm-widgets-pill" data-dm-widgets-count hidden><i aria-hidden="true"></i><b></b></span>
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

export function renderTodoSection() {
  const lists = configuredTodoLists();
  const host = doc?.getElementById?.("dm-widgets");
  if (!lists.length) {
    host?.remove();
    return false;
  }
  const mounted = host || ensureHost();
  if (!mounted) return false;
  const states = allStates();
  const title = mounted.querySelector(".dm-widgets-title");
  if (title) title.textContent = t("In primo piano", "At a glance");
  const sub = mounted.querySelector(".dm-widgets-sub");
  if (sub) sub.textContent = t("I widget della tua giornata", "Your day's widgets");
  const grid = mounted.querySelector(".dm-widgets-grid");
  if (grid)
    grid.innerHTML = lists.map((list, index) => cardMarkup(list, states, index)).join("");
  const pill = mounted.querySelector("[data-dm-widgets-count]");
  if (pill) {
    const totale = lists.reduce(
      (sum, list) => sum + pendingTodoItems(record(list.entity).items || []).length,
      0,
    );
    const known = lists.some((list) => record(list.entity).items !== null);
    pill.hidden = !known;
    const label = pill.querySelector("b");
    if (label) label.textContent = t(`${totale} da fare`, `${totale} to do`);
    pill.dataset.clear = String(totale === 0);
  }
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
/* ── «In primo piano»: la zona dei widget della Home ─────────────────── */
#dm-widgets{display:block;margin:16px 0 6px}

/* La testata: il riquadro col gradiente, il titolo Oswald, la pastiglia col
   totale — la stessa grammatica delle testate di Sicurezza e Clima. */
#dm-widgets .dm-widgets-head{display:flex;align-items:center;gap:12px;padding:0 4px 12px}
#dm-widgets .dm-widgets-ic{
  width:46px;height:46px;flex:0 0 46px;display:grid;place-items:center;font-size:22px;
  border-radius:15px;background:linear-gradient(140deg,#dbeafe,#ede9fe 55%,#dcfce7);
  box-shadow:inset 0 0 0 1px rgba(59,130,246,.14)}
#dm-widgets .dm-widgets-copy{min-width:0;flex:1}
#dm-widgets .dm-widgets-title{
  margin:0;font-family:'Oswald',sans-serif;font-weight:700;
  font-size:clamp(18px,2.4vw,23px);line-height:1.05;letter-spacing:1.8px;
  text-transform:uppercase;color:var(--text,#0f172a)}
#dm-widgets .dm-widgets-sub{margin:2px 0 0;font-size:12px;font-weight:600;color:var(--text-dim,#64748b)}
#dm-widgets .dm-widgets-pill{
  display:inline-flex;align-items:center;gap:8px;height:32px;padding:0 13px;border-radius:999px;
  border:1px solid var(--card-border,#e8edf3);background:var(--surface-3,#f1f5f9);
  color:var(--text-dim,#64748b);font-size:11px;font-weight:800;
  letter-spacing:1px;text-transform:uppercase;white-space:nowrap}
#dm-widgets .dm-widgets-pill i{width:7px;height:7px;border-radius:50%;background:#f59e0b;flex:0 0 7px}
#dm-widgets .dm-widgets-pill[data-clear="true"] i{background:#059669}

#dm-widgets .dm-widgets-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(265px,1fr));gap:14px}

/* La card di un widget: il nastro d'accento in alto, il sollevamento al
   passaggio — la stessa fisica delle card delle telecamere. */
#dm-widgets .dm-widget{
  position:relative;overflow:hidden;display:flex;flex-direction:column;gap:11px;
  padding:15px 16px 14px;border:1px solid var(--card-border,#e8edf3);border-radius:20px;
  background:var(--card-bg,#fff);color:var(--text,#0f172a);
  box-shadow:0 10px 26px rgba(15,23,42,.06);
  transition:transform .3s cubic-bezier(.16,1,.3,1),box-shadow .3s ease,border-color .3s ease}
#dm-widgets .dm-widget::before{
  content:"";position:absolute;top:0;left:0;right:0;height:3px;
  background:linear-gradient(90deg,transparent,var(--dm-widget-accent,#0ea5e9) 30%,var(--dm-widget-accent,#0ea5e9) 70%,transparent);
  opacity:.75}
#dm-widgets .dm-widget:hover{
  transform:translateY(-3px);border-color:color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 34%,transparent);
  box-shadow:0 18px 38px rgba(15,23,42,.12)}

#dm-widgets .dm-todo-head{display:flex;align-items:center;gap:11px;min-width:0}
/* L'anello: la parte fatta della lista, con le voci aperte nel centro — lo
   stesso conic-gradient dell'anello di filtrazione della piscina. */
#dm-widgets .dm-todo-ring{
  width:44px;height:44px;flex:0 0 44px;display:grid;place-items:center;border-radius:50%;
  background:conic-gradient(from -90deg,var(--dm-widget-accent,#0ea5e9) 0 calc(var(--dm-ring-pct,0) * 1%),var(--surface-3,#e2e8f0) 0);
  transition:background .6s linear}
#dm-widgets .dm-todo-ring b{
  display:grid;place-items:center;width:34px;height:34px;border-radius:50%;
  background:var(--card-bg,#fff);box-shadow:inset 0 0 0 1px var(--card-border,#e8edf3);
  font-family:'Oswald',sans-serif;font-size:16px;font-weight:700;color:var(--text,#0f172a)}
#dm-widgets .dm-todo-titles{min-width:0;flex:1;display:grid;gap:1px}
#dm-widgets .dm-todo-title{
  font-size:13px;font-weight:900;letter-spacing:.7px;text-transform:uppercase;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#dm-widgets .dm-todo-progress{font-size:11px;font-weight:800;color:var(--text-dim,#64748b);letter-spacing:.4px}
#dm-widgets .dm-todo-glyph{flex:0 0 auto;font-size:15px;opacity:.55}

#dm-widgets .dm-todo-items{list-style:none;margin:0;padding:0;display:grid;gap:9px}
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
#dm-widgets .dm-todo-text{
  min-width:0;font-size:13.5px;font-weight:600;line-height:1.4;overflow-wrap:anywhere;
  transition:color .25s ease}
#dm-widgets .dm-todo-item.is-done .dm-todo-text{color:var(--text-dim,#94a3b8);text-decoration:line-through}
#dm-widgets .dm-todo-due{
  display:inline-flex;align-items:center;gap:3px;margin-left:7px;padding:1px 7px;border-radius:999px;
  background:var(--surface-3,#f1f5f9);border:1px solid var(--card-border,#e8edf3);
  font-size:10.5px;font-weight:800;color:var(--text-dim,#64748b);white-space:nowrap;vertical-align:1px}
#dm-widgets .dm-todo-due[data-overdue="true"]{
  background:rgba(244,63,94,.10);border-color:rgba(244,63,94,.30);color:#be123c}
#dm-widgets .dm-todo-empty{margin:0;font-size:12.5px;font-weight:700;color:var(--text-dim,#64748b)}
#dm-widgets .dm-todo-done-all{
  display:grid;place-items:center;padding:14px 0 10px;font-size:13.5px;letter-spacing:.3px}
#dm-widgets .dm-todo-more{margin:0;font-size:11.5px;font-weight:700;color:var(--text-dim,#64748b)}

@media (prefers-reduced-motion:reduce){
  #dm-widgets .dm-widget,#dm-widgets .dm-todo-check,#dm-widgets .dm-todo-check::after{transition:none}
}
@media (max-width:520px){
  #dm-widgets .dm-widgets-grid{grid-template-columns:1fr;gap:11px}
}
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
