/* La configurazione delle liste ToDo (#201).
 *
 * La scheda non esiste nel documento vendorizzato: si aggiunge accanto alle
 * altre, come quella delle persone. Ogni riga e' una lista `todo.*` col nome
 * con cui mostrarla in Home; «Rileva da Home Assistant» riempie l'elenco con
 * le liste che esistono gia', perche' cio' che Home Assistant sa non si
 * riscrive a mano.
 */
import { isTodoEntity, suggestTodoLists } from "../core/todo-model.js";
import { renderHomeWidgets } from "./home-widgets-section.js";
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
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_TODO_EDITOR__";
const state = (root[KEY] ||= { installed: false, aperto: -1 });

export const TODO_EDITOR_TAB = "todo";
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
  return `<div class="ed-intro">${t(
    "Le liste ToDo di Home Assistant, in Home: le attività giornaliere sempre in primo piano, da spuntare direttamente dalla card.",
    "Home Assistant to-do lists, on the Home page: daily tasks always in sight, ticked off straight from the card.",
  )}</div>
  <div class="ed-list dm-todo-ed-list">${
    lists.length
      ? lists.map((list, index) => rigaMarkup(list, index)).join("")
      : `<div class="ed-empty">${t("Nessuna lista configurata", "No list configured")}</div>`
  }</div>
  <button type="button" class="ed-btn-add" data-todo-add>＋ ${t("Aggiungi lista", "Add list")}</button>
  <button type="button" class="ed-btn-add" data-todo-detect>🪄 ${t("Rileva da Home Assistant", "Detect from Home Assistant")}</button>`;
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
  const firma = [
    state.aperto,
    ...lists.map((list) => `${list?.id}~${list?.name}~${list?.entity}`),
  ].join("|");
  if (body.dataset.dmTodoEditor === firma && body.querySelector(".dm-todo-ed-list")) return true;
  body.dataset.dmTodoEditor = firma;
  body.innerHTML = bodyMarkup(lists);
  body.dataset.renderer = "todo";
  return true;
}

function ridisegna() {
  const body = doc?.getElementById("ed-body");
  if (body) delete body.dataset.dmTodoEditor;
  ensureTodoEditor();
}

function onClick(event) {
  const body = doc?.getElementById("ed-body");
  if (!body || activeTab() !== TODO_EDITOR_TAB || !body.contains(event.target)) return;
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

export function ensureTodoEditorTab() {
  const tabs = doc?.querySelector(".ed-tab")?.parentElement;
  if (!tabs || tabs.querySelector(`.ed-tab[data-tab="${TODO_EDITOR_TAB}"]`)) return false;
  const tab = doc.createElement("button");
  tab.className = "ed-tab";
  tab.dataset.tab = TODO_EDITOR_TAB;
  tab.textContent = `✅ ${t("ToDo", "To-do")}`;
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
    `,
  );
}

export function installTodoEditorSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
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
