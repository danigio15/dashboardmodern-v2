/* La configurazione del ponte dei widget (#201).
 *
 * La scheda «🧩 Widget» non esiste nel documento vendorizzato: si aggiunge
 * accanto alle altre, come quella delle persone. Sopra ci sono le tessere del
 * ponte — quali vedere in Home e in che ordine, scritte in `cd_widgets` — e
 * sotto le liste ToDo: ogni riga e' una lista `todo.*` col nome con cui
 * mostrarla, e «Rileva da Home Assistant» riempie l'elenco con le liste che
 * esistono gia', perche' cio' che Home Assistant sa non si riscrive a mano.
 */
import { isTodoEntity, suggestTodoLists } from "../core/todo-model.js";
import { normalizeAlertsEditor } from "./alerts-section.js";
import { refreshFloodAlerts } from "./flood-alerts-section.js";
import {
  WIDGETS_CONFIG_KEY,
  renderHomeWidgets,
  widgetPreferences,
} from "./home-widgets-section.js";
import {
  allStates,
  clean,
  doc,
  esc,
  installStyle,
  onEditorRedraw,
  readJson,
  root,
  t,
  wrapFunction,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_TODO_EDITOR__";
const state = (root[KEY] ||= { installed: false, aperto: -1 });

export const TODO_EDITOR_TAB = "todo";
const LEGACY_ALERTS_TAB = "avvisi";
const CONFIG_KEY = "cd_todo";

/* L'editor lavora sulle righe grezze: una lista appena aggiunta e' vuota, e la
 * normalizzazione la scarterebbe prima che la si possa compilare. */
function grezze() {
  const stored = readJson(CONFIG_KEY, []);
  return Array.isArray(stored) ? stored : [];
}

function salva(lists) {
  writeJsonIfChanged(CONFIG_KEY, lists);
  try {
    renderHomeWidgets();
  } catch (_error) {}
}

function activeTab() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

function nomeDi(list, index) {
  return clean(list?.name) || clean(list?.entity) || `${t("Lista", "List")} ${index + 1}`;
}

/* ── le tessere del ponte ─────────────────────────────────────────────── */

/* Il catalogo delle tessere, con le stesse parole delle tessere stesse. Gli
 * avvisi personalizzati sono una voce sola: si governano insieme. */
function catalogoTessere() {
  return [
    ["todo", "✅", t("Da fare", "To-do")],
    ["luci", "💡", t("Luci", "Lights")],
    ["clima", "❄️", t("Clima", "Climate")],
    ["tapparelle", "🪟", t("Tapparelle", "Shutters")],
    ["sicurezza", "🛡️", t("Sicurezza", "Security")],
    ["telecamere", "📹", t("Telecamere", "Cameras")],
    ["energia", "⚡", t("Energia", "Energy")],
    ["elettrodomestici", "🫧", t("Elettrodomestici", "Appliances")],
    ["temperatura", "🌡️", t("Temperatura", "Temperature")],
    ["ev", "🚗", t("Auto", "Car")],
    ["robot", "🤖", t("Aspirapolvere", "Vacuums")],
    ["solare", "🌞", t("Solare termico", "Solar thermal")],
    ["piscina", "🏊", t("Piscina", "Pool")],
    ["prese", "🔌", t("Prese", "Sockets")],
    ["irrigazione", "💧", t("Irrigazione", "Irrigation")],
    ["aperture", "🚪", t("Aperture", "Openings")],
    ["batterie", "🔋", t("Batterie", "Batteries")],
    ["allagamenti", "💧", t("Allagamenti", "Floods")],
    ["custom", "⚠️", t("Avvisi personalizzati", "Custom alerts")],
  ];
}

/** Il catalogo nell'ordine salvato: e' la lista che le frecce riordinano. */
function tessereOrdinate() {
  const preferences = widgetPreferences();
  const catalogo = catalogoTessere();
  const rank = (key) => {
    const index = preferences.order.indexOf(key);
    return index < 0 ? preferences.order.length + catalogo.findIndex(([k]) => k === key) : index;
  };
  return {
    hidden: new Set(preferences.hidden),
    rows: [...catalogo].sort((a, b) => rank(a[0]) - rank(b[0])),
  };
}

function salvaTessere(rows, hidden) {
  writeJsonIfChanged(WIDGETS_CONFIG_KEY, {
    order: rows.map(([key]) => key),
    hidden: [...hidden],
  });
  try {
    renderHomeWidgets();
  } catch (_error) {}
}

function tessereMarkup() {
  const { hidden, rows } = tessereOrdinate();
  return `<div class="ed-intro">${t(
    "Scegli quali tessere vedere in Home e in che ordine. Le tessere degli avvisi — aperture, batterie, allagamenti e avvisi personalizzati — compaiono da sole solo quando hanno qualcosa da dire.",
    "Choose which tiles show on Home and in what order. The alert tiles — openings, batteries, floods and custom alerts — only appear on their own when they have something to say.",
  )}</div>
  <div class="ed-list dm-widget-pref-list">${rows
    .map(
      ([key, icon, label], index) => `<div class="ed-row dm-widget-pref" data-widget-key="${esc(key)}">
        <span class="dm-widget-pref-icon" aria-hidden="true">${icon}</span>
        <span class="ed-row-main"><strong class="ed-row-new">${esc(label)}</strong></span>
        <button type="button" class="ed-del dm-widget-move" data-widget-up aria-label="${t("Più in alto", "Move up")}"${index === 0 ? " disabled" : ""}>▲</button>
        <button type="button" class="ed-del dm-widget-move" data-widget-down aria-label="${t("Più in basso", "Move down")}"${index === rows.length - 1 ? " disabled" : ""}>▼</button>
        <button type="button" class="dm-widget-shown" data-widget-shown data-on="${!hidden.has(key)}" aria-label="${t("Visibile in Home", "Shown on Home")}"><i></i></button>
      </div>`,
    )
    .join("")}</div>`;
}

function rigaMarkup(list, index) {
  const aperto = state.aperto === index;
  return `<article class="ed-row dm-todo-ed-row" data-todo-index="${index}" data-open="${aperto}">
    <div class="dm-todo-ed-head">
      <span class="dm-todo-ed-icon" aria-hidden="true">✅</span>
      <span class="ed-row-main"><strong class="ed-row-new">${esc(nomeDi(list, index))}</strong><small class="ed-row-old mono">${esc(clean(list?.entity) || t("nessuna entità", "no entity"))}</small></span>
      <button type="button" class="ed-del dm-todo-ed-edit" data-todo-edit aria-label="${t("Modifica", "Edit")}">✏️</button>
      <button type="button" class="ed-del dm-todo-ed-del" data-todo-del aria-label="${t("Elimina", "Remove")}">🗑️</button>
    </div>
    <div class="dm-todo-ed-body"${aperto ? "" : " hidden"}>
      <label class="ed-slot dm-todo-ed-field"><span class="ed-slot-lbl">${t("Nome", "Name")}</span><span class="ed-form-row"><input id="dm-todo-${index}-name" class="ed-input" data-todo-field="name" value="${esc(clean(list?.name))}" placeholder="${t("Spesa", "Groceries")}"></span></label>
      <label class="ed-slot dm-todo-ed-field"><span class="ed-slot-lbl">${t("Entità della lista", "List entity")}</span>
        <span class="ed-form-row"><input id="dm-todo-${index}-entity" class="ed-input mono" data-todo-field="entity" value="${esc(clean(list?.entity))}" placeholder="todo.spesa" autocomplete="off" spellcheck="false"><button type="button" class="dm-entity-picker" data-todo-pick="dm-todo-${index}-entity" aria-label="${t("Scegli entità", "Choose entity")}">🔍</button></span>
        <small>${t("È l'entità todo.* di Home Assistant: la card in Home elenca le sue voci da spuntare.", "The todo.* entity from Home Assistant: the Home card lists its items to tick off.")}</small></label>
      <output class="dm-todo-ed-error" data-todo-error></output>
      <button type="button" class="ed-save-btn" data-todo-save>💾 ${t("Salva lista", "Save list")}</button>
    </div>
  </article>`;
}

function bodyMarkup(lists) {
  return `${tessereMarkup()}
  <div class="ed-intro dm-todo-ed-intro">${t(
    "Le liste ToDo di Home Assistant, in Home: le attività giornaliere sempre in primo piano, da spuntare direttamente dalla card.",
    "Home Assistant to-do lists, on the Home page: daily tasks always in sight, ticked off straight from the card.",
  )}</div>
  <div class="ed-list dm-todo-ed-list">${
    lists.length
      ? lists.map((list, index) => rigaMarkup(list, index)).join("")
      : `<div class="ed-empty">${t("Nessuna lista configurata", "No list configured")}</div>`
  }</div>
  <button type="button" class="ed-btn-add" data-todo-add>＋ ${t("Aggiungi lista", "Add list")}</button>
  <button type="button" class="ed-btn-add" data-todo-detect>🪄 ${t("Rileva da Home Assistant", "Detect from Home Assistant")}</button>
  ${avvisiMarkup()}`;
}

/* Gli avvisi, dove sono finiti quelli del Quadro. La scheda la disegna il
 * runtime: e' la stessa di prima, con i suoi accordion e i suoi pulsanti —
 * qui cambia solo la stanza in cui vive. */
function avvisiMarkup() {
  let markup = "";
  try {
    const disegnata = root.editorRenderAvvisi?.();
    markup = typeof disegnata === "string" ? disegnata : "";
  } catch (_error) {
    return "";
  }
  if (!markup) return "";
  return `<div class="ed-sec-title dm-widget-ed-sep">🔔 ${esc(
    t("Widget di avviso", "Alert widgets"),
  )}</div>${markup}`;
}

function leggiRiga(riga, list) {
  const next = { ...list };
  for (const input of riga.querySelectorAll("[data-todo-field]"))
    next[clean(input.dataset.todoField)] = clean(input.value);
  return next;
}

export function ensureTodoEditor() {
  const body = doc?.getElementById("ed-body");
  if (!body || activeTab() !== TODO_EDITOR_TAB) return false;
  const lists = grezze();
  const preferences = widgetPreferences();
  const firma = [
    state.aperto,
    preferences.order.join(","),
    preferences.hidden.join(","),
    ...lists.map((list) => `${list?.id}~${list?.name}~${list?.entity}`),
  ].join("|");
  if (body.dataset.dmTodoEditor === firma && body.querySelector(".dm-todo-ed-list")) {
    /* Il corpo e' gia' quello giusto e non si rifa': le rifiniture degli
     * avvisi vanno rimesse lo stesso, perche' chi le posa non passa piu' dal
     * cambio di linguetta e questa e' l'unica occasione che ha. */
    rifinisciAvvisi(body);
    return true;
  }
  body.dataset.dmTodoEditor = firma;
  body.innerHTML = bodyMarkup(lists);
  body.dataset.renderer = "todo";
  // L'elenco entita' degli avvisi lo riempie il runtime a markup appena
  // posato, come faceva quando la scheda era sua. Solo qui: rifarlo a ogni
  // giro cancellerebbe le entita' che si stanno aggiungendo a mano.
  try {
    root.edAvvRenderEnts?.();
  } catch (_error) {}
  rifinisciAvvisi(body);
  return true;
}

/* Le rifiniture della scheda avvisi, che adesso e' ospite di questa.
 *
 * La matita sulle righe la mette chi degli avvisi si occupa, le righe degli
 * allagamenti chi degli allagamenti si occupa, e i gruppi orfani se ne vanno:
 * tutte cose che prima chiedeva il cambio di linguetta, che qui non passa
 * piu'. Sono tutte idempotenti — riconoscono il proprio lavoro — percio' si
 * possono rimettere a ogni passata senza che nessuno se ne accorga. */
function rifinisciAvvisi(body) {
  potaGruppiOrfani(body);
  try {
    normalizeAlertsEditor();
  } catch (_error) {}
  try {
    refreshFloodAlerts();
  } catch (_error) {}
}

/* I gruppi sorvegliati che non alimentano piu' niente.
 *
 * Il Quadro Avvisi aveva una card per le luci accese, una per il clima, una
 * per il riscaldamento: erano conteggi di entita' elencate qui a mano. Quelle
 * card non ci sono piu' e le tessere che le hanno sostituite leggono la
 * sezione vera — le luci sono quelle della scheda Luci, il clima quelle della
 * scheda Clima — percio' elencarle di nuovo qui non serviva a nessuno: era
 * una lista che si poteva riempire senza che cambiasse niente da nessuna
 * parte. Restano i gruppi che una tessera ce l'hanno ancora: aperture,
 * batterie e gli avvisi personalizzati.
 *
 * Il gruppo di un accordion si legge dal suo stesso cestino — `edDelAvviso`
 * porta la chiave come primo argomento — cosi' non serve indovinarlo dal
 * titolo, che cambia con la lingua. */
const GRUPPI_ORFANI = Object.freeze(["luci", "clima", "risc", "tapp"]);

function potaGruppiOrfani(body) {
  for (const gruppo of GRUPPI_ORFANI) {
    for (const accordion of body.querySelectorAll(".ed-acc")) {
      if (accordion.innerHTML.includes(`edDelAvviso('${gruppo}'`)) accordion.remove();
    }
    body.querySelector(`#ed-avv-grp option[value="${gruppo}"]`)?.remove();
  }
  // La spiegazione parlava del Quadro Avvisi, che non c'e' piu': dice dove
  // vanno a finire davvero questi sensori.
  const intro = body.querySelector(".dm-widget-ed-sep ~ .ed-intro");
  if (intro)
    intro.textContent = t(
      "Le tessere d'avviso della Home — aperture, batterie, allagamenti — si accendono da sole solo quando hanno qualcosa da dire. Qui scegli quali sensori sorvegliano, con un nome pulito, oppure crei un avviso personalizzato su una o più entità, con condizione, stato a mano e icona a scelta.",
      "The Home alert tiles — openings, batteries, floods — light up on their own only when they have something to say. Here you choose which sensors they watch, with a clean name, or you create a custom alert on one or more entities, with a condition, a hand-written state and an icon of your choice.",
    );
}

function ridisegna() {
  const body = doc?.getElementById("ed-body");
  if (body) delete body.dataset.dmTodoEditor;
  ensureTodoEditor();
}

function onClick(event) {
  const body = doc?.getElementById("ed-body");
  if (!body || activeTab() !== TODO_EDITOR_TAB || !body.contains(event.target)) return;

  const rigaTessera = event.target.closest("[data-widget-key]");
  if (rigaTessera) {
    event.preventDefault();
    const key = clean(rigaTessera.dataset.widgetKey);
    const { hidden, rows } = tessereOrdinate();
    const index = rows.findIndex(([k]) => k === key);
    if (index < 0) return;
    if (event.target.closest("[data-widget-shown]")) {
      if (hidden.has(key)) hidden.delete(key);
      else hidden.add(key);
    } else if (event.target.closest("[data-widget-up]") && index > 0) {
      [rows[index - 1], rows[index]] = [rows[index], rows[index - 1]];
    } else if (event.target.closest("[data-widget-down]") && index < rows.length - 1) {
      [rows[index], rows[index + 1]] = [rows[index + 1], rows[index]];
    } else {
      return;
    }
    salvaTessere(rows, hidden);
    ridisegna();
    return;
  }

  const lists = grezze();

  if (event.target.closest("[data-todo-add]")) {
    event.preventDefault();
    state.aperto = lists.length;
    writeJsonIfChanged(CONFIG_KEY, [
      ...lists,
      { id: `todo-${Date.now().toString(36)}`, name: "", entity: "" },
    ]);
    ridisegna();
    return;
  }
  if (event.target.closest("[data-todo-detect]")) {
    event.preventDefault();
    const found = suggestTodoLists(allStates(), lists);
    if (!found.length) {
      root.edToast?.(t("Nessuna lista todo.* trovata", "No todo.* list found"));
      return;
    }
    state.aperto = -1;
    salva([
      ...lists,
      ...found.map((item, index) => ({
        id: `todo-${Date.now().toString(36)}-${index}`,
        name: item.name,
        entity: item.entity,
      })),
    ]);
    ridisegna();
    root.edToast?.(t(`Aggiunte ${found.length} liste`, `Added ${found.length} lists`));
    return;
  }
  const pick = event.target.closest("[data-todo-pick]");
  if (pick) {
    event.preventDefault();
    const input = body.querySelector(`#${CSS.escape(clean(pick.dataset.todoPick))}`);
    if (input) root.wzPickEntity?.(input);
    return;
  }
  const riga = event.target.closest("[data-todo-index]");
  if (!riga) return;
  const index = Number(riga.dataset.todoIndex);
  if (!Number.isFinite(index) || !lists[index]) return;

  if (event.target.closest("[data-todo-edit]")) {
    event.preventDefault();
    state.aperto = state.aperto === index ? -1 : index;
    ridisegna();
    return;
  }
  if (event.target.closest("[data-todo-del]")) {
    event.preventDefault();
    const nome = nomeDi(lists[index], index);
    const domanda = t(`Elimino "${nome}"?`, `Remove "${nome}"?`);
    if (root.confirm && !root.confirm(domanda)) return;
    state.aperto = -1;
    salva(lists.filter((_list, position) => position !== index));
    ridisegna();
    return;
  }
  if (event.target.closest("[data-todo-save]")) {
    event.preventDefault();
    const next = lists.slice();
    next[index] = leggiRiga(riga, lists[index]);
    const errore = riga.querySelector("[data-todo-error]");
    if (!isTodoEntity(next[index].entity)) {
      if (errore) errore.textContent = t("Serve un'entità todo.* valida.", "A valid todo.* entity is required.");
      return;
    }
    if (errore) errore.textContent = "";
    salva(next);
    ridisegna();
    root.edToast?.(t("💾 Lista salvata", "💾 List saved"));
  }
}

/* La linguetta «🔔 Avvisi» non ha piu' una sezione dietro: il Quadro Avvisi
 * dalla Home e' uscito, e quegli avvisi adesso sono tessere del ponte. Quello
 * che c'era da configurare — quali sensori sorvegliare e gli avvisi
 * personalizzati — sta qui, sotto le tessere che governa. */
function togliLinguettaAvvisi(tabs) {
  const avvisi = tabs?.querySelector?.(`.ed-tab[data-tab="${LEGACY_ALERTS_TAB}"]`);
  if (avvisi) avvisi.remove();
}

/* Chi chiedeva la scheda degli avvisi arriva qui: i pulsanti del runtime
 * (aggiungi, elimina, modifica) si richiamano da soli con
 * `editorSwitch('avvisi')` a lavoro fatto, e devono ritrovare la loro roba. */
function dirottaSchedaAvvisi() {
  const current = root.editorSwitch;
  if (typeof current !== "function" || current.__dmAvvisiNelWidget) return false;
  function wrapped(tab, ...rest) {
    const scelta = clean(tab) === LEGACY_ALERTS_TAB ? TODO_EDITOR_TAB : tab;
    /* La linguetta dei widget non e' nel documento: la aggiungiamo noi a
     * pannello disegnato. Chi arriva qui subito dopo `apriConfigEntita()` —
     * il runtime, o una prova — la troverebbe ancora assente, e il pannello
     * resterebbe su nessuna scheda. Prima si mette, poi ci si va. */
    if (scelta === TODO_EDITOR_TAB) ensureTodoEditorTab();
    const esito = current.call(this, scelta, ...rest);
    if (scelta === TODO_EDITOR_TAB) root.queueMicrotask?.(ridisegna);
    return esito;
  }
  Object.assign(wrapped, current);
  wrapped.__dmAvvisiNelWidget = true;
  wrapped.__dmPrevious = current;
  root.editorSwitch = wrapped;
  return true;
}

export function ensureTodoEditorTab() {
  const tabs = doc?.querySelector(".ed-tab")?.parentElement;
  if (!tabs) return false;
  togliLinguettaAvvisi(tabs);
  dirottaSchedaAvvisi();
  if (tabs.querySelector(`.ed-tab[data-tab="${TODO_EDITOR_TAB}"]`)) return false;
  const tab = doc.createElement("button");
  tab.className = "ed-tab";
  tab.dataset.tab = TODO_EDITOR_TAB;
  tab.textContent = `🧩 ${t("Widget", "Widgets")}`;
  tab.addEventListener("click", () => root.editorSwitch?.(TODO_EDITOR_TAB));
  const prima = tabs.querySelector('.ed-tab[data-tab="runtime"]');
  if (prima) prima.before(tab);
  else tabs.append(tab);
  return true;
}

function installStyles() {
  installStyle(
    "dm-todo-editor-style",
    `
      #ed-body .dm-todo-ed-list{display:grid;gap:8px;margin-bottom:10px}
      #ed-body .dm-todo-ed-row{display:block!important;padding:0!important;overflow:hidden}
      #ed-body .dm-todo-ed-head{display:flex;align-items:center;gap:10px;padding:10px 12px}
      #ed-body .dm-todo-ed-icon{font-size:18px}
      #ed-body .dm-todo-ed-body{display:grid;gap:8px;padding:0 12px 12px}
      #ed-body .dm-todo-ed-body[hidden]{display:none!important}
      #ed-body .dm-todo-ed-field{display:grid;gap:4px;margin:0}
      #ed-body .dm-todo-ed-field .ed-form-row{display:flex;gap:8px;min-width:0}
      #ed-body .dm-todo-ed-field .ed-form-row>input{flex:1 1 auto;min-width:0}
      #ed-body .dm-todo-ed-error:not(:empty){color:var(--error-color,#dc2626);font-size:12px;font-weight:800}
      #ed-body .dm-todo-ed-intro{margin-top:14px}
      #ed-body .dm-widget-ed-sep{margin-top:22px;padding-top:16px;border-top:1px solid var(--card-border,#e2e8f0)}
      #ed-body .dm-widget-pref-list{display:grid;gap:6px;margin-bottom:10px}
      #ed-body .dm-widget-pref{display:flex!important;align-items:center;gap:10px;padding:8px 12px!important}
      #ed-body .dm-widget-pref-icon{font-size:17px}
      #ed-body .dm-widget-move[disabled]{opacity:.3;pointer-events:none}
      #ed-body .dm-widget-shown{
        flex:0 0 40px;width:40px;height:23px;position:relative;border:0;border-radius:999px;cursor:pointer;
        background:color-mix(in srgb,var(--text-dim,#94a3b8) 32%,transparent);transition:background .25s ease}
      #ed-body .dm-widget-shown i{
        position:absolute;top:2.5px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;
        box-shadow:0 2px 6px rgba(15,23,42,.25);transition:transform .25s cubic-bezier(.16,1,.3,1)}
      #ed-body .dm-widget-shown[data-on="true"]{background:#059669}
      #ed-body .dm-widget-shown[data-on="true"] i{transform:translateX(16px)}
    `,
  );
}

export function installTodoEditorSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  /* Il dirottamento della scheda avvisi si mette subito, non quando il
   * pannello esiste: chi apre la configurazione e chiede «avvisi» nello
   * stesso respiro — il runtime, o una prova — non deve trovarlo a meta'.
   * Se il runtime non c'e' ancora, ci si riprova quando arriva. */
  dirottaSchedaAvvisi();
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:runtime-ready"])
    root.addEventListener?.(evento, dirottaSchedaAvvisi);
  /* La linguetta si mette appena il pannello nasce.
   *
   * Prima la mettevamo al primo ridisegno, che arriva un giro dopo: chi apriva
   * la configurazione e chiedeva subito una scheda — il runtime dopo un
   * salvataggio, o una prova — trovava un pannello senza la nostra linguetta,
   * e restava su nessuna scheda. `apriConfigEntita` e' il momento esatto in
   * cui il pannello esiste, e wrapFunction non perde per strada i segni di
   * chi ha gia' avvolto qualcosa. */
  wrapFunction("apriConfigEntita", "__dmTodoEditorTab", () => {
    ensureTodoEditorTab();
    ensureTodoEditor();
  });
  ensureTodoEditorTab();
  doc.addEventListener("click", onClick);
  onEditorRedraw("__dmTodoEditor", () => {
    root.queueMicrotask?.(() => {
      ensureTodoEditorTab();
      ensureTodoEditor();
    });
  });
  for (const event of ["dashboardmodern:legacy-ready", "dashboardmodern:editor-rendered"])
    root.addEventListener?.(event, () => {
      root.queueMicrotask?.(() => {
        ensureTodoEditorTab();
        ensureTodoEditor();
      });
    });
  ensureTodoEditor();
}

installTodoEditorSection();
