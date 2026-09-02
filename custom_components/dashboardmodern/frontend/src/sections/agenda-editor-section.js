/* Dove si configurano l'agenda e le cose da fare (#259).
 *
 * «Calendario, per configurarlo devi toglierlo dalla parte widget: crea una
 * sezione a se' nel menu e metti calendario e cose da fare. Nei widget deve
 * esserci solo l'interruttore.»
 *
 * Aveva ragione. I calendari e le liste ToDo stavano nella scheda «Widget»
 * perche' li' era nata la tessera che li racconta, ma quella scheda risponde a
 * una domanda sola — quali tessere vedere in Home e in che ordine — e le
 * entita' di Home Assistant non sono quella domanda. Adesso l'Agenda ha una
 * pagina sua nella barra, e come tutte le pagine ha la sua scheda: qui si dice
 * COSA guardare, di la' si dice SE mostrare la tessera.
 *
 * Le due meta' stanno insieme perche' sono la stessa pagina: un impegno
 * succede a un'ora e non si spunta, una cosa da fare si spunta e un'ora non ce
 * l'ha, ma chi le configura le pensa nello stesso momento.
 *
 * La fascia verde in cima e' quella del guscio, con il suo stesso gestore: la
 * sezione «Agenda» era l'unica voce della barra — insieme alla Continuita' —
 * che non si poteva nascondere, perche' non aveva nessuna scheda dove
 * l'interruttore potesse stare.
 */
import { isTodoEntity, suggestTodoLists } from "../core/todo-model.js";
import {
  CALENDARI_KEY,
  isCalendarEntity,
  suggerisciCalendari,
} from "../core/calendario-model.js";
import { renderCalendarioSection } from "./calendario-section.js";
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
  wrapFunction,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_AGENDA_EDITOR__";
const state = (root[KEY] ||= { installed: false, calAperto: -1, todoAperto: -1 });

export const AGENDA_EDITOR_TAB = "agenda";

/* La chiave con cui la sezione si accende e si spegne: la stessa che legge la
 * pagina dell'agenda, o si scriverebbe una preferenza che nessuno guarda. */
const CHIAVE_SEZIONE = "calendario";
const CONFIG_TODO = "cd_todo";

function schedaAttiva() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

/* Le righe grezze: una riga appena aggiunta e' vuota, e la normalizzazione la
 * scarterebbe prima che la si possa compilare. */
function calendariGrezzi() {
  const stored = readJson(CALENDARI_KEY, []);
  return Array.isArray(stored) ? stored : [];
}

function listeGrezze() {
  const stored = readJson(CONFIG_TODO, []);
  return Array.isArray(stored) ? stored : [];
}

function salvaCalendari(voci) {
  writeJsonIfChanged(CALENDARI_KEY, voci);
  avvisaChiDisegna();
}

function salvaListe(voci) {
  writeJsonIfChanged(CONFIG_TODO, voci);
  avvisaChiDisegna();
}

/* La tessera in Home e la pagina dell'agenda leggono queste stesse chiavi:
 * cambiandole qui, si ridisegnano tutte e due subito. */
function avvisaChiDisegna() {
  try {
    renderHomeWidgets();
  } catch (_error) {}
  try {
    renderCalendarioSection();
  } catch (_error) {}
}

function nomeDelCalendario(voce, index) {
  return clean(voce?.name) || clean(voce?.entity) || `${t("Calendario", "Calendar")} ${index + 1}`;
}

function nomeDellaLista(voce, index) {
  return clean(voce?.name) || clean(voce?.entity) || `${t("Lista", "List")} ${index + 1}`;
}

/* ── l'interruttore della sezione ─────────────────────────────────────────
 *
 * E' la fascia del guscio, non una nostra: stesso disegno, stesso gestore,
 * stessa chiave. Averne una nostra vorrebbe dire due interruttori per la
 * stessa decisione, e due modi di scriverla. */
function fasciaMarkup() {
  try {
    return root.cdSecToggleHtml?.(CHIAVE_SEZIONE) || "";
  } catch (_error) {
    return "";
  }
}

function sezioneNascosta() {
  try {
    return root.cdCfg?.("cd_sections")?.[CHIAVE_SEZIONE] === false;
  } catch (_error) {
    return false;
  }
}

/* ── i calendari ──────────────────────────────────────────────────────────── */

function rigaCalendarioMarkup(voce, index) {
  const aperto = state.calAperto === index;
  const colore = clean(voce?.colore);
  return `<article class="ed-row dm-todo-ed-row dm-cal-ed-row" data-cal-index="${index}" data-open="${aperto}">
    <div class="dm-todo-ed-head">
      <span class="dm-todo-ed-icon" aria-hidden="true">📅</span>
      <span class="ed-row-main"><strong class="ed-row-new">${esc(nomeDelCalendario(voce, index))}</strong><small class="ed-row-old mono">${esc(clean(voce?.entity) || t("nessuna entità", "no entity"))}</small></span>
      <button type="button" class="ed-del dm-todo-ed-edit" data-cal-edit aria-label="${t("Modifica", "Edit")}">✏️</button>
      <button type="button" class="ed-del dm-todo-ed-del" data-cal-del aria-label="${t("Elimina", "Remove")}">🗑️</button>
    </div>
    <div class="dm-todo-ed-body"${aperto ? "" : " hidden"}>
      <label class="ed-slot dm-todo-ed-field"><span class="ed-slot-lbl">${t("Nome", "Name")}</span><span class="ed-form-row"><input id="dm-cal-${index}-name" class="ed-input" data-cal-field="name" value="${esc(clean(voce?.name))}" placeholder="${t("Famiglia", "Family")}"></span></label>
      <label class="ed-slot dm-todo-ed-field"><span class="ed-slot-lbl">${t("Entità del calendario", "Calendar entity")}</span>
        <span class="ed-form-row"><input id="dm-cal-${index}-entity" class="ed-input mono" data-cal-field="entity" value="${esc(clean(voce?.entity))}" placeholder="calendar.famiglia" autocomplete="off" spellcheck="false"><button type="button" class="dm-entity-picker" data-cal-pick="dm-cal-${index}-entity" aria-label="${t("Scegli entità", "Choose entity")}">🔍</button></span>
        <small>${t("È l'entità calendar.* di Home Assistant: la tessera mostra i prossimi due impegni, la sezione l'agenda giorno per giorno.", "The calendar.* entity from Home Assistant: the tile shows the next two appointments, the section the day-by-day agenda.")}</small></label>
      <label class="ed-slot dm-todo-ed-field"><span class="ed-slot-lbl">${t("Colore", "Colour")}</span>
        <span class="ed-form-row dm-cal-ed-colore"><input type="color" id="dm-cal-${index}-colore" class="dm-cal-ed-swatch" data-cal-field="colore" value="${esc(colore || "#6366f1")}"><button type="button" class="ed-del" data-cal-colore-via>${t("Automatico", "Automatic")}</button></span>
        <small>${t("Serve a distinguere due agende nello stesso giorno. Lasciandolo automatico ne riceve uno suo, sempre lo stesso.", "It tells two agendas apart on the same day. Left automatic it gets one of its own, always the same.")}</small></label>
      <output class="dm-todo-ed-error" data-cal-error></output>
      <button type="button" class="ed-save-btn" data-cal-save>💾 ${t("Salva calendario", "Save calendar")}</button>
    </div>
  </article>`;
}

function calendariMarkup() {
  const voci = calendariGrezzi();
  return `<div class="ed-sec-title">📅 ${esc(t("Calendario", "Calendar"))}</div>
  <div class="ed-intro">${t(
    "I calendari che hai già in Home Assistant: la tessera in Home mostra i prossimi due impegni, e aprendola c'è l'elenco giorno per giorno. La sezione «Agenda» compare nella barra appena ne scegli uno.",
    "The calendars you already have in Home Assistant: the Home tile shows the next two appointments, and opening it gives the day-by-day list. The «Agenda» section appears in the bar as soon as you pick one.",
  )}</div>
  <div class="ed-list dm-todo-ed-list dm-cal-ed-list">${
    voci.length
      ? voci.map((voce, index) => rigaCalendarioMarkup(voce, index)).join("")
      : `<div class="ed-empty">${t("Nessun calendario configurato", "No calendar configured")}</div>`
  }</div>
  <button type="button" class="ed-btn-add" data-cal-add>＋ ${t("Aggiungi calendario", "Add calendar")}</button>
  <button type="button" class="ed-btn-add" data-cal-detect>🪄 ${t("Rileva da Home Assistant", "Detect from Home Assistant")}</button>`;
}

/* ── le cose da fare ──────────────────────────────────────────────────────── */

function rigaListaMarkup(list, index) {
  const aperto = state.todoAperto === index;
  return `<article class="ed-row dm-todo-ed-row" data-todo-index="${index}" data-open="${aperto}">
    <div class="dm-todo-ed-head">
      <span class="dm-todo-ed-icon" aria-hidden="true">✅</span>
      <span class="ed-row-main"><strong class="ed-row-new">${esc(nomeDellaLista(list, index))}</strong><small class="ed-row-old mono">${esc(clean(list?.entity) || t("nessuna entità", "no entity"))}</small></span>
      <button type="button" class="ed-del dm-todo-ed-edit" data-todo-edit aria-label="${t("Modifica", "Edit")}">✏️</button>
      <button type="button" class="ed-del dm-todo-ed-del" data-todo-del aria-label="${t("Elimina", "Remove")}">🗑️</button>
    </div>
    <div class="dm-todo-ed-body"${aperto ? "" : " hidden"}>
      <label class="ed-slot dm-todo-ed-field"><span class="ed-slot-lbl">${t("Nome", "Name")}</span><span class="ed-form-row"><input id="dm-todo-${index}-name" class="ed-input" data-todo-field="name" value="${esc(clean(list?.name))}" placeholder="${t("Spesa", "Groceries")}"></span></label>
      <label class="ed-slot dm-todo-ed-field"><span class="ed-slot-lbl">${t("Entità della lista", "List entity")}</span>
        <span class="ed-form-row"><input id="dm-todo-${index}-entity" class="ed-input mono" data-todo-field="entity" value="${esc(clean(list?.entity))}" placeholder="todo.spesa" autocomplete="off" spellcheck="false"><button type="button" class="dm-entity-picker" data-todo-pick="dm-todo-${index}-entity" aria-label="${t("Scegli entità", "Choose entity")}">🔍</button></span>
        <small>${t("È l'entità todo.* di Home Assistant: le voci con una scadenza finiscono nell'agenda, le altre restano nell'elenco.", "The todo.* entity from Home Assistant: items with a due date land in the agenda, the others stay in the list.")}</small></label>
      <output class="dm-todo-ed-error" data-todo-error></output>
      <button type="button" class="ed-save-btn" data-todo-save>💾 ${t("Salva lista", "Save list")}</button>
    </div>
  </article>`;
}

function listeMarkup() {
  const voci = listeGrezze();
  return `<div class="ed-sec-title dm-agenda-ed-sep">✅ ${esc(t("Cose da fare", "To-do"))}</div>
  <div class="ed-intro">${t(
    "Le liste ToDo di Home Assistant: si spuntano dalla tessera in Home e dalla sezione Agenda, e quelle con una scadenza compaiono nel giorno in cui scadono.",
    "Home Assistant to-do lists: tick them off from the Home tile and from the Agenda section, and the ones with a due date show up on the day they are due.",
  )}</div>
  <div class="ed-list dm-todo-ed-list">${
    voci.length
      ? voci.map((list, index) => rigaListaMarkup(list, index)).join("")
      : `<div class="ed-empty">${t("Nessuna lista configurata", "No list configured")}</div>`
  }</div>
  <button type="button" class="ed-btn-add" data-todo-add>＋ ${t("Aggiungi lista", "Add list")}</button>
  <button type="button" class="ed-btn-add" data-todo-detect>🪄 ${t("Rileva da Home Assistant", "Detect from Home Assistant")}</button>`;
}

function bodyMarkup() {
  return `${fasciaMarkup()}
  <div class="dm-agenda-ed">
    <div class="ed-intro">${t(
      "Gli impegni e le cose da fare, nella stessa pagina: qui si dice quali calendari e quali liste guardare. Se la tessera in Home si vede o no si sceglie nella scheda Widget.",
      "Appointments and to-do items, on the same page: here you choose which calendars and which lists to watch. Whether the Home tile shows is chosen in the Widgets tab.",
    )}</div>
    ${calendariMarkup()}
    ${listeMarkup()}
  </div>`;
}

export function ensureAgendaEditor() {
  const body = doc?.getElementById("ed-body");
  if (!body || schedaAttiva() !== AGENDA_EDITOR_TAB) return false;
  /* La fascia fa parte della firma: toccandola la preferenza cambia davvero,
   * ma senza il suo valore qui niente sarebbe cambiato da ridisegnare e la
   * fascia resterebbe verde fino al cambio di linguetta. */
  const firma = [
    state.calAperto,
    state.todoAperto,
    sezioneNascosta(),
    ...calendariGrezzi().map((voce) => `📅${voce?.name}~${voce?.entity}~${voce?.colore}`),
    ...listeGrezze().map((voce) => `✅${voce?.id}~${voce?.name}~${voce?.entity}`),
  ].join("|");
  if (body.dataset.dmAgendaEditor === firma && body.querySelector(".dm-agenda-ed")) return true;
  body.dataset.dmAgendaEditor = firma;
  body.innerHTML = bodyMarkup();
  body.dataset.renderer = "agenda";
  return true;
}

function ridisegna() {
  const body = doc?.getElementById("ed-body");
  if (body) delete body.dataset.dmAgendaEditor;
  ensureAgendaEditor();
}

function onClick(event) {
  const body = doc?.getElementById("ed-body");
  if (!body || schedaAttiva() !== AGENDA_EDITOR_TAB || !body.contains(event.target)) return;

  /* ── i calendari ── */
  const calendari = calendariGrezzi();
  if (event.target.closest("[data-cal-add]")) {
    event.preventDefault();
    state.calAperto = calendari.length;
    salvaCalendari([...calendari, { id: `cal-${Date.now().toString(36)}`, name: "", entity: "" }]);
    ridisegna();
    return;
  }
  if (event.target.closest("[data-cal-detect]")) {
    event.preventDefault();
    /* Cio' che Home Assistant sa gia' non si riscrive a mano: le entita'
     * `calendar.*` che non sono ancora nell'elenco entrano da sole, col nome
     * che hanno di la'. */
    const trovati = suggerisciCalendari(allStates(), calendari);
    if (!trovati.length) {
      root.edToast?.(t("Nessun calendario nuovo", "No new calendar"));
      return;
    }
    state.calAperto = -1;
    salvaCalendari([
      ...calendari,
      ...trovati.map((voce, indice) => ({
        id: `cal-${Date.now().toString(36)}-${indice}`,
        name: voce.name,
        entity: voce.entity,
      })),
    ]);
    ridisegna();
    root.edToast?.(t(`Aggiunti ${trovati.length} calendari`, `Added ${trovati.length} calendars`));
    return;
  }
  const scegliCal = event.target.closest("[data-cal-pick]");
  if (scegliCal) {
    event.preventDefault();
    const input = body.querySelector(`#${CSS.escape(clean(scegliCal.dataset.calPick))}`);
    if (input) root.wzPickEntity?.(input);
    return;
  }
  const rigaCal = event.target.closest("[data-cal-index]");
  if (rigaCal) {
    const indice = Number(rigaCal.dataset.calIndex);
    if (!Number.isFinite(indice) || !calendari[indice]) return;
    if (event.target.closest("[data-cal-edit]")) {
      event.preventDefault();
      state.calAperto = state.calAperto === indice ? -1 : indice;
      ridisegna();
      return;
    }
    if (event.target.closest("[data-cal-del]")) {
      event.preventDefault();
      const nome = nomeDelCalendario(calendari[indice], indice);
      if (root.confirm && !root.confirm(t(`Tolgo "${nome}"?`, `Remove "${nome}"?`))) return;
      state.calAperto = -1;
      salvaCalendari(calendari.filter((_voce, posto) => posto !== indice));
      ridisegna();
      return;
    }
    if (event.target.closest("[data-cal-colore-via]")) {
      event.preventDefault();
      /* Tornare all'automatico e' togliere il colore, non sceglierne uno
       * grigio: chi non decide riceve quello del suo posto nell'elenco. */
      const prossimi = calendari.slice();
      prossimi[indice] = { ...calendari[indice], colore: "" };
      salvaCalendari(prossimi);
      ridisegna();
      return;
    }
    if (event.target.closest("[data-cal-save]")) {
      event.preventDefault();
      const prossimi = calendari.slice();
      const letta = { ...calendari[indice] };
      for (const campo of rigaCal.querySelectorAll("[data-cal-field]"))
        letta[clean(campo.dataset.calField)] = clean(campo.value);
      const errore = rigaCal.querySelector("[data-cal-error]");
      if (!isCalendarEntity(letta.entity)) {
        if (errore)
          errore.textContent = t(
            "Serve un'entità calendar.* valida.",
            "A valid calendar.* entity is required.",
          );
        return;
      }
      if (errore) errore.textContent = "";
      prossimi[indice] = letta;
      state.calAperto = -1;
      salvaCalendari(prossimi);
      ridisegna();
      root.edToast?.(t("💾 Calendario salvato", "💾 Calendar saved"));
    }
    return;
  }

  /* ── le cose da fare ── */
  const liste = listeGrezze();
  if (event.target.closest("[data-todo-add]")) {
    event.preventDefault();
    state.todoAperto = liste.length;
    salvaListe([...liste, { id: `todo-${Date.now().toString(36)}`, name: "", entity: "" }]);
    ridisegna();
    return;
  }
  if (event.target.closest("[data-todo-detect]")) {
    event.preventDefault();
    const trovate = suggestTodoLists(allStates(), liste);
    if (!trovate.length) {
      root.edToast?.(t("Nessuna lista todo.* trovata", "No todo.* list found"));
      return;
    }
    state.todoAperto = -1;
    salvaListe([
      ...liste,
      ...trovate.map((voce, indice) => ({
        id: `todo-${Date.now().toString(36)}-${indice}`,
        name: voce.name,
        entity: voce.entity,
      })),
    ]);
    ridisegna();
    root.edToast?.(t(`Aggiunte ${trovate.length} liste`, `Added ${trovate.length} lists`));
    return;
  }
  const scegliTodo = event.target.closest("[data-todo-pick]");
  if (scegliTodo) {
    event.preventDefault();
    const input = body.querySelector(`#${CSS.escape(clean(scegliTodo.dataset.todoPick))}`);
    if (input) root.wzPickEntity?.(input);
    return;
  }
  const rigaTodo = event.target.closest("[data-todo-index]");
  if (!rigaTodo) return;
  const indice = Number(rigaTodo.dataset.todoIndex);
  if (!Number.isFinite(indice) || !liste[indice]) return;
  if (event.target.closest("[data-todo-edit]")) {
    event.preventDefault();
    state.todoAperto = state.todoAperto === indice ? -1 : indice;
    ridisegna();
    return;
  }
  if (event.target.closest("[data-todo-del]")) {
    event.preventDefault();
    const nome = nomeDellaLista(liste[indice], indice);
    if (root.confirm && !root.confirm(t(`Elimino "${nome}"?`, `Remove "${nome}"?`))) return;
    state.todoAperto = -1;
    salvaListe(liste.filter((_voce, posto) => posto !== indice));
    ridisegna();
    return;
  }
  if (event.target.closest("[data-todo-save]")) {
    event.preventDefault();
    const prossime = liste.slice();
    const letta = { ...liste[indice] };
    for (const campo of rigaTodo.querySelectorAll("[data-todo-field]"))
      letta[clean(campo.dataset.todoField)] = clean(campo.value);
    const errore = rigaTodo.querySelector("[data-todo-error]");
    if (!isTodoEntity(letta.entity)) {
      if (errore)
        errore.textContent = t("Serve un'entità todo.* valida.", "A valid todo.* entity is required.");
      return;
    }
    if (errore) errore.textContent = "";
    prossime[indice] = letta;
    state.todoAperto = -1;
    salvaListe(prossime);
    ridisegna();
    root.edToast?.(t("💾 Lista salvata", "💾 List saved"));
  }
}

export function ensureAgendaEditorTab() {
  const tabs = doc?.querySelector(".ed-tab")?.parentElement;
  if (!tabs || tabs.querySelector(`.ed-tab[data-tab="${AGENDA_EDITOR_TAB}"]`)) return false;
  const linguetta = doc.createElement("button");
  linguetta.className = "ed-tab";
  linguetta.dataset.tab = AGENDA_EDITOR_TAB;
  linguetta.textContent = `📅 ${t("Agenda", "Agenda")}`;
  linguetta.addEventListener("click", () => root.editorSwitch?.(AGENDA_EDITOR_TAB));
  const prima = tabs.querySelector('.ed-tab[data-tab="runtime"]');
  if (prima) prima.before(linguetta);
  else tabs.append(linguetta);
  return true;
}

function installStyles() {
  installStyle(
    "dm-agenda-editor-style",
    `
      #ed-body .dm-agenda-ed-sep{margin-top:22px;padding-top:16px;
        border-top:1px solid var(--card-border,#e2e8f0)}
      /* Il colore di un calendario: la casella e il tasto che la rimette
         all'automatico stanno sulla stessa riga, perche' sono la stessa
         decisione presa in due modi. */
      #ed-body .dm-agenda-ed .dm-cal-ed-colore{display:flex;align-items:center;gap:10px}
      /* Il campione del colore e' un'eccezione alla regola che allarga ogni
         casella per tutta la riga: quella e' della scheda Widget, che possiede
         il vestito comune delle righe, e va vinta con piu' peso — o un colore
         largo tutta la riga sembra una barra invece di un campione. */
      #ed-body .dm-agenda-ed .dm-todo-ed-field .ed-form-row > input.dm-cal-ed-swatch{
        flex:0 0 58px;width:58px;min-width:0;height:38px;padding:3px;cursor:pointer;
        border:1px solid var(--card-border,#e2e8f0);border-radius:10px;background:var(--card-bg,#fff)}
      #ed-body .dm-agenda-ed .dm-cal-ed-colore .ed-del{flex:0 0 auto;width:auto;padding:0 12px;font-size:12px;font-weight:800}
    `,
  );
}

export function installAgendaEditorSection() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  /* La linguetta si mette appena il pannello nasce, non al primo ridisegno:
   * chi apre la configurazione e chiede subito questa scheda — il runtime dopo
   * un salvataggio, o una prova — la troverebbe altrimenti assente e
   * resterebbe su nessuna scheda. */
  wrapFunction("apriConfigEntita", "__dmAgendaEditorTab", () => {
    ensureAgendaEditorTab();
    ensureAgendaEditor();
  });
  ensureAgendaEditorTab();
  doc.addEventListener("click", onClick);
  onEditorRedraw("__dmAgendaEditor", () => {
    root.queueMicrotask?.(() => {
      ensureAgendaEditorTab();
      ensureAgendaEditor();
    });
  });
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:editor-rendered"])
    root.addEventListener?.(evento, () => {
      root.queueMicrotask?.(() => {
        ensureAgendaEditorTab();
        ensureAgendaEditor();
      });
    });
  ensureAgendaEditor();
  return true;
}

installAgendaEditorSection();
