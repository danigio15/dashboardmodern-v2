/* La configurazione del robot aspirapolvere.
 *
 * La scheda non esiste nel documento vendorizzato: si aggiunge qui, accanto
 * alle altre, e si comporta come le altre — l'interruttore verde della
 * sezione in cima, l'elenco di cio' che c'e', un unico salvataggio in fondo.
 *
 * La stanza si sceglie da una tendina, non si scrive: era una casella di
 * testo, e chi scriveva «salone» dove la stanza si chiama «Salone» vedeva il
 * robot sparire dalla sezione Stanze senza che nessuno dicesse perche'.
 *
 * Un robot chiede due entita': quella del robot — un `vacuum` per gli
 * aspirapolvere, un `lawn_mower` per i tagliaerba — e quella della mappa, che
 * invece non ha un tipo suo: chi ce l'ha la pubblica come telecamera o come
 * immagine, ed e' per questo che il campo accetta tutte e due invece di
 * pretenderne una. La batteria e' un terzo campo, facoltativo: molti
 * tagliaerba la espongono come sensore a parte, e chi lo indica la vede al
 * posto di quella (spesso assente) dell'entita' del robot.
 */
import { normalizeRobots, robotSpecies } from "../core/robot-model.js";
import { clean, dashboardStore, doc, esc, installStyle, onEditorRedraw, readJson, root, roomOptionsMarkup, t, wrapFunction, writeJsonIfChanged } from "./shared.js";

const KEY = "__DASHBOARDMODERN_ROBOT_EDITOR__";
const state = (root[KEY] ||= { installed: false, aperto: -1 });

export const ROBOT_EDITOR_TAB = "robot";

function lista() {
  const store = dashboardStore();
  const canonical = store?.getSection ? store.getSection("robots") : null;
  if (Array.isArray(canonical) && canonical.length) return normalizeRobots(canonical);
  return normalizeRobots(readJson("cd_robot", []));
}

async function salva(robots) {
  const valore = normalizeRobots(robots);
  const store = dashboardStore();
  if (store?.replaceSection) {
    try {
      await store.replaceSection("robots", valore);
      return;
    } catch (error) {
      root.console?.warn?.("[DashboardModern] robot save", error);
    }
  }
  writeJsonIfChanged("cd_robot", valore);
}

function activeTab() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

function nomeDi(robot, index) {
  return clean(robot.name) || clean(robot.entity) || `${t("Robot", "Robot")} ${index + 1}`;
}

function campo(id, label, value, placeholder, hint) {
  return `<label class="ed-slot dm-robot-field"><span class="ed-slot-lbl">${esc(label)}</span>
    <span class="ed-form-row"><input id="${esc(id)}" class="ed-input mono" data-robot-field="${esc(id.split("-").at(-1))}" value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="off" spellcheck="false"><button type="button" class="dm-robot-pick" data-robot-pick="${esc(id)}" aria-label="${t("Scegli entità", "Choose entity")}">🔍</button></span>
    ${hint ? `<small>${esc(hint)}</small>` : ""}</label>`;
}

function rigaMarkup(robot, index) {
  const aperto = state.aperto === index;
  /* L'icona della riga dice la specie: chi ha un aspirapolvere e un tagliaerba
   * li distingue dall'elenco, senza aprire le righe. */
  const icona = robotSpecies(robot.entity) === "lawn_mower" ? "🌱" : "🤖";
  return `<article class="ed-row dm-robot-row" data-robot-index="${index}" data-open="${aperto}">
    <div class="dm-robot-row-head">
      <span class="dm-robot-row-icon" aria-hidden="true">${icona}</span>
      <span class="ed-row-main"><strong class="ed-row-new">${esc(nomeDi(robot, index))}</strong><small class="ed-row-old mono">${esc(clean(robot.entity) || t("nessuna entità", "no entity"))}</small></span>
      <button type="button" class="ed-del dm-robot-edit" data-robot-edit aria-label="${t("Modifica", "Edit")}">✏️</button>
      <button type="button" class="ed-del dm-robot-del" data-robot-del aria-label="${t("Elimina", "Remove")}">🗑️</button>
    </div>
    <div class="dm-robot-row-body"${aperto ? "" : " hidden"}>
      <label class="ed-slot dm-robot-field"><span class="ed-slot-lbl">${t("Nome", "Name")}</span><span class="ed-form-row"><input id="dm-robot-${index}-name" class="ed-input" data-robot-field="name" value="${esc(clean(robot.name))}" placeholder="${t("Robot del piano terra", "Ground floor robot")}"></span></label>
      ${campo(`dm-robot-${index}-entity`, t("Entità del robot", "Robot entity"), robot.entity, "vacuum.robot", t("È l'entità vacuum.* (aspirapolvere) o lawn_mower.* (tagliaerba) che Home Assistant espone per il robot.", "The vacuum.* (vacuum) or lawn_mower.* (lawn mower) entity Home Assistant exposes for the robot."))}
      ${campo(`dm-robot-${index}-mapEntity`, t("Entità della mappa", "Map entity"), robot.mapEntity, "camera.robot_map", t("La mappa arriva da una telecamera o da un'immagine: camera.* o image.*. Lasciala vuota se il tuo robot non ne pubblica una.", "The map comes from a camera or an image: camera.* or image.*. Leave it empty if your robot does not publish one."))}
      ${campo(`dm-robot-${index}-battery`, t("Batteria", "Battery"), robot.battery, "sensor.robot_batteria", t("Facoltativa: il sensore che dice la carica, se il robot la pubblica a parte — capita spesso coi tagliaerba. Se indicata, vince sulla batteria dell'entità del robot.", "Optional: the sensor reporting the charge, when the robot publishes it separately — common with lawn mowers. When set, it wins over the robot entity's own battery."))}
      <label class="ed-slot dm-robot-field"><span class="ed-slot-lbl">${t("Stanza", "Room")}</span><span class="ed-form-row"><select id="dm-robot-${index}-room" class="ed-input" data-robot-field="room">${roomOptionsMarkup(clean(robot.room), t("Nessuna stanza", "No room"))}</select></span></label>
      <output class="dm-robot-error" data-robot-error></output>
      <button type="button" class="ed-save-btn" data-robot-save>💾 ${t("Salva robot", "Save robot")}</button>
    </div>
  </article>`;
}

function bodyMarkup(robots) {
  const banner = (() => {
    try {
      return root.cdSecToggleHtml?.("robot") || "";
    } catch (_error) {
      return "";
    }
  })();
  return `${banner}
    <div class="ed-intro">${t(
      "I robot di casa — aspirapolvere e tagliaerba: stato, batteria, comandi e mappa. Ogni robot ha la sua scheda nella sezione Robot.",
      "The home robots — vacuums and lawn mowers: state, battery, controls and map. Each robot gets its own card in the Robot section.",
    )}</div>
    <div class="ed-list dm-robot-list">${
      robots.length
        ? robots.map((robot, index) => rigaMarkup(robot, index)).join("")
        : `<div class="ed-empty">${t("Nessun robot configurato", "No robot configured")}</div>`
    }</div>
    <button type="button" class="ed-btn-add" data-robot-add>＋ ${t("Aggiungi robot", "Add robot")}</button>`;
}

function leggiRiga(riga, robot) {
  const next = { ...robot };
  for (const input of riga.querySelectorAll("[data-robot-field]"))
    next[clean(input.dataset.robotField)] = clean(input.value);
  return next;
}

export function ensureRobotEditor() {
  const body = doc?.getElementById("ed-body");
  if (!body || activeTab() !== ROBOT_EDITOR_TAB) return false;
  const robots = lista();
  /* La fascia della visibilita' fa parte della scheda.
   *
   * La firma diceva solo quali robot ci sono: toccando «Sezione visibile in
   * dashboard» la preferenza cambiava davvero, ma qui non era cambiato niente
   * da ridisegnare e la fascia restava verde. Per vederla diventare grigia
   * bisognava uscire dalla linguetta e rientrarci — cioe' proprio il «non si
   * vede in tempo reale» che e' stato segnalato. */
  const nascosta = (() => {
    try {
      return root.cdCfg?.("cd_sections")?.robot === false;
    } catch (_error) {
      return false;
    }
  })();
  const firma = [
    state.aperto,
    nascosta,
    ...robots.map((robot) => `${robot.id}~${robot.name}~${robot.entity}`),
  ].join("|");
  if (body.dataset.dmRobotEditor === firma && body.querySelector(".dm-robot-list")) return true;
  body.dataset.dmRobotEditor = firma;
  body.innerHTML = bodyMarkup(robots);
  body.dataset.renderer = "robot";
  return true;
}

async function onClick(event) {
  const body = doc?.getElementById("ed-body");
  if (!body || activeTab() !== ROBOT_EDITOR_TAB || !body.contains(event.target)) return;
  const robots = lista();

  if (event.target.closest("[data-robot-add]")) {
    event.preventDefault();
    state.aperto = robots.length;
    await salva([...robots, { id: `robot-${robots.length + 1}`, name: "", entity: "" }]);
    ridisegna();
    return;
  }
  const pick = event.target.closest("[data-robot-pick]");
  if (pick) {
    event.preventDefault();
    const input = body.querySelector(`#${CSS.escape(clean(pick.dataset.robotPick))}`);
    if (input) root.wzPickEntity?.(input);
    return;
  }
  const riga = event.target.closest("[data-robot-index]");
  if (!riga) return;
  const index = Number(riga.dataset.robotIndex);
  if (!Number.isFinite(index) || !robots[index]) return;

  if (event.target.closest("[data-robot-edit]")) {
    event.preventDefault();
    state.aperto = state.aperto === index ? -1 : index;
    ridisegna();
    return;
  }
  if (event.target.closest("[data-robot-del]")) {
    event.preventDefault();
    const domanda = t(`Elimino "${nomeDi(robots[index], index)}"?`, `Remove "${nomeDi(robots[index], index)}"?`);
    if (root.confirm && !root.confirm(domanda)) return;
    state.aperto = -1;
    await salva(robots.filter((_robot, position) => position !== index));
    ridisegna();
    return;
  }
  if (event.target.closest("[data-robot-save]")) {
    event.preventDefault();
    const next = robots.slice();
    next[index] = leggiRiga(riga, robots[index]);
    const errore = riga.querySelector("[data-robot-error]");
    /* Un'entita' che non e' un `vacuum` ne' un `lawn_mower` non e' un robot:
     * salvarla vorrebbe dire una scheda che non risponde a nessun comando,
     * senza dire perche'. */
    if (!/^(?:vacuum|lawn_mower)\.[a-z0-9_]+$/i.test(next[index].entity)) {
      if (errore) errore.textContent = t("Serve un'entità vacuum.* o lawn_mower.* valida.", "A valid vacuum.* or lawn_mower.* entity is required.");
      return;
    }
    if (errore) errore.textContent = "";
    await salva(next);
    ridisegna();
    root.edToast?.(t("💾 Robot salvato", "💾 Robot saved"));
  }
}

function ridisegna() {
  const body = doc?.getElementById("ed-body");
  if (body) delete body.dataset.dmRobotEditor;
  ensureRobotEditor();
}

/* La voce nella barra della configurazione.
 *
 * Le voci sono scritte nel documento vendorizzato e questa non c'e': si
 * aggiunge accanto alle altre, con lo stesso gestore, cosi' si comporta come
 * loro senza che nessuno debba sapere che e' arrivata dopo. */
export function ensureRobotEditorTab() {
  const tabs = doc?.querySelector(".ed-tab")?.parentElement;
  if (!tabs || tabs.querySelector(`.ed-tab[data-tab="${ROBOT_EDITOR_TAB}"]`)) return false;
  const tab = doc.createElement("button");
  tab.className = "ed-tab";
  tab.dataset.tab = ROBOT_EDITOR_TAB;
  tab.textContent = `🤖 ${t("Robot", "Robots")}`;
  tab.addEventListener("click", () => root.editorSwitch?.(ROBOT_EDITOR_TAB));
  const prima = tabs.querySelector('.ed-tab[data-tab="runtime"]');
  if (prima) prima.before(tab);
  else tabs.append(tab);
  return true;
}

function installStyles() {
  installStyle(
    "dm-robot-editor-style",
    `
      #ed-body .dm-robot-list{display:grid;gap:8px;margin-bottom:10px}
      #ed-body .dm-robot-row{display:block!important;padding:0!important;overflow:hidden}
      #ed-body .dm-robot-row-head{display:flex;align-items:center;gap:10px;padding:10px 12px}
      #ed-body .dm-robot-row-icon{font-size:18px}
      #ed-body .dm-robot-row-body{display:grid;gap:8px;padding:0 12px 12px}
      #ed-body .dm-robot-row-body[hidden]{display:none!important}
      #ed-body .dm-robot-field{display:grid;gap:4px;margin:0}
      #ed-body .dm-robot-field .ed-form-row{display:flex;gap:8px;min-width:0}
      #ed-body .dm-robot-field .ed-form-row>input{flex:1 1 auto;min-width:0}
      #ed-body .dm-robot-pick{flex:0 0 38px;height:38px;border:none;border-radius:10px;background:linear-gradient(135deg,#0ea5e9,#0369a1);color:#fff;font-size:14px;cursor:pointer}
      #ed-body .dm-robot-error:not(:empty){color:var(--error-color,#dc2626);font-size:12px;font-weight:800}
    `,
  );
}

export function installRobotEditorSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  ensureRobotEditorTab();
  doc.addEventListener("click", onClick);
  onEditorRedraw("__dmRobotEditor", () => {
    root.queueMicrotask?.(() => {
      ensureRobotEditorTab();
      ensureRobotEditor();
    });
  });
  for (const event of ["dashboardmodern:legacy-ready", "dashboardmodern:editor-rendered"])
    root.addEventListener?.(event, () => {
      root.queueMicrotask?.(() => {
        ensureRobotEditorTab();
        ensureRobotEditor();
      });
    });
  ensureRobotEditor();
}
