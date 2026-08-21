/* La sezione del robot aspirapolvere.
 *
 * La plancia non ne aveva una: un robot finiva fra gli elettrodomestici, dove
 * si accende e si spegne, e di lui non si vedeva ne' cosa stesse facendo, ne'
 * quanta batteria gli restasse, ne' dove fosse arrivato. Un robot pero' e'
 * fatto di quelle tre cose.
 *
 * La pagina e la sua voce nella barra non esistono nel documento vendorizzato e
 * non si possono aggiungere li': si costruiscono qui, accanto alle altre, con
 * le stesse classi — cosi' la barra, le intestazioni e la visibilita' delle
 * sezioni le trattano come trattano tutte le altre, senza sapere che sono
 * arrivate dopo.
 */
import {
  drawableRobots,
  robotActions,
  robotCommand,
  robotFanCommand,
  robotStateLabel,
  robotView,
} from "../core/robot-model.js";
import {
  allStates,
  clean,
  dashboardStore,
  doc,
  esc,
  installStyle,
  readJson,
  root,
  section,
  t,
  wrapFunction,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_ROBOT__";
const state = (root[KEY] ||= {
  installed: false,
  frame: 0,
  signature: "",
  mapUrls: new Map(),
  mapPictures: new Map(),
});

export const ROBOT_PAGE_ID = "page-robot";
export const ROBOT_TAB = "robot";

function english() {
  return doc?.documentElement?.lang === "en";
}

/** I robot configurati: dal modello canonico, o dalla chiave di sempre. */
export function configuredRobots() {
  const canonical = section("robots", []);
  if (Array.isArray(canonical) && canonical.length) return drawableRobots(canonical);
  return drawableRobots(readJson("cd_robot", []));
}

/* ── la pagina e la sua voce nella barra ─────────────────────────────────── */

/* La pagina va dove stanno le altre pagine.
 *
 * In fondo al documento c'e' altro — la barra, le finestre, il piede — e una
 * sezione messa li' esiste, e' larga, e' alta, e non si vede: sta fuori da
 * dove le pagine vengono mostrate. Si aggancia all'ultima sorella, che e'
 * l'unico posto in cui una pagina e' una pagina. */
function lastPage() {
  const pages = doc?.querySelectorAll?.(".page");
  return pages?.length ? pages[pages.length - 1] : null;
}

export function ensureRobotPage() {
  if (!doc) return null;
  let page = doc.getElementById(ROBOT_PAGE_ID);
  if (page) return page;
  const sorella = lastPage();
  if (!sorella?.parentElement) return null;
  page = doc.createElement("section");
  page.className = "page";
  page.id = ROBOT_PAGE_ID;
  page.innerHTML = `<div class="dm-robot-wrap" id="robot-wrap"></div>`;
  sorella.after(page);
  return page;
}

export function ensureRobotTab() {
  if (!doc) return null;
  let tab = doc.querySelector(`.tab[data-tab="${ROBOT_TAB}"]`);
  if (tab) return tab;
  const nav = doc.querySelector("nav.tabs");
  const before = nav?.querySelector('.tab[data-tab="security"]') || nav?.querySelector('.tab[data-tab="config"]');
  if (!nav) return null;
  tab = doc.createElement("button");
  tab.className = "tab";
  tab.dataset.tab = ROBOT_TAB;
  tab.id = `tab-${ROBOT_TAB}`;
  tab.innerHTML = `<span class="icon">🤖</span><span class="text">${esc(t("Aspirapolvere", "Vacuum"))}</span>`;
  /* Il gestore che il runtime lega alle voci lo lega una volta sola, al
   * caricamento: questa arriva dopo, e il suo tocco se lo deve gestire da se'.
   * Fa la stessa identica cosa, perche' due modi di cambiare pagina sarebbero
   * due pagine attive quando non tornano. */
  tab.addEventListener("click", () => {
    for (const node of doc.querySelectorAll(".tab")) node.classList.remove("active");
    for (const node of doc.querySelectorAll(".page")) node.classList.remove("active");
    tab.classList.add("active");
    ensureRobotPage()?.classList.add("active");
    if (root.navigator?.vibrate) root.navigator.vibrate(5);
    schedule();
  });
  if (before) before.before(tab);
  else nav.append(tab);
  return tab;
}

/* La voce si nasconde come tutte le altre.
 *
 * `cdApplyNavVis` accende e spegne le voci leggendo `cd_sections`, e sa quali
 * esistono da una mappa sua. Una voce che non e' in quella mappa resta sempre
 * accesa, qualunque cosa dica la configurazione: si aggiunge alla mappa,
 * invece di nasconderla per conto nostro e avere due padroni sulla stessa
 * voce. */
function teachNavVisibility() {
  const previous = root.cdNavVisMap;
  if (typeof previous !== "function" || previous.__dmRobot) return;
  const wrapped = function cdNavVisMap(...args) {
    const map = previous.apply(this, args) || {};
    return { ...map, [ROBOT_TAB]: ROBOT_TAB };
  };
  wrapped.__dmRobot = true;
  wrapped.__dmPrevious = previous;
  root.cdNavVisMap = wrapped;
}

/* ── il disegno ──────────────────────────────────────────────────────────── */

function batteryMarkup(view) {
  if (view.battery === null) return "";
  const livello = Math.max(0, Math.min(100, Math.round(view.battery)));
  return `<span class="dm-robot-batt" data-dm-robot-battery data-low="${livello <= 20}" data-charging="${view.charging}">
    <span class="dm-robot-batt-shell"><b style="width:${livello}%"></b></span>
    <span class="dm-robot-batt-num">${livello}%</span>
  </span>`;
}

function fanMarkup(view) {
  if (!view.fanSpeeds.length) return "";
  const options = view.fanSpeeds
    .map((speed) => `<option value="${esc(speed)}"${speed === view.fanSpeed ? " selected" : ""}>${esc(speed)}</option>`)
    .join("");
  return `<label class="dm-robot-fan"><span>${esc(t("Aspirazione", "Suction"))}</span>
    <select data-dm-robot-fan aria-label="${esc(t("Potenza di aspirazione", "Suction power"))}">${options}</select></label>`;
}

function mapMarkup(view) {
  if (!view.mapEntity)
    return `<div class="dm-robot-map dm-vuota" data-dm-robot-map><span class="dm-robot-map-hint">${esc(t("Nessuna mappa collegata", "No map linked"))}</span></div>`;
  return `<div class="dm-robot-map" data-dm-robot-map data-dm-map-state="loading">
    <img alt="${esc(t(`Mappa di ${view.name}`, `Map of ${view.name}`))}" data-dm-robot-map-image decoding="async">
    <span class="dm-robot-map-hint">${esc(t("Mappa non disponibile", "Map unavailable"))}</span>
  </div>`;
}

function cardMarkup(view) {
  const actions = robotActions(view)
    .map(
      (action) =>
        `<button type="button" class="dm-robot-btn" data-dm-robot-act="${esc(action.act)}" title="${esc(english() ? action.en : action.it)}">
          <span aria-hidden="true">${action.glyph}</span><span class="dm-robot-btn-tx">${esc(english() ? action.en : action.it)}</span>
        </button>`,
    )
    .join("");
  return `<article class="dm-robot-card" data-dm-robot="${esc(view.entity)}" data-dm-robot-state="${esc(view.state)}">
    <div class="dm-robot-head">
      <span class="dm-robot-icon" aria-hidden="true">🤖</span>
      <span class="dm-robot-title">
        <strong>${esc(view.name)}</strong>
        ${view.room ? `<small>${esc(view.room)}</small>` : ""}
      </span>
      <span class="dm-robot-state" data-dm-robot-label>${esc(robotStateLabel(view.state, english()))}</span>
    </div>
    ${mapMarkup(view)}
    <div class="dm-robot-meta">
      ${batteryMarkup(view)}
      ${fanMarkup(view)}
    </div>
    <p class="dm-robot-error" data-dm-robot-error${view.error ? "" : " hidden"}>${esc(view.error)}</p>
    <div class="dm-robot-actions">${actions}</div>
  </article>`;
}

function emptyMarkup() {
  return `<div class="ed-empty dm-robot-empty">${esc(t("Nessun robot configurato", "No vacuum configured"))}</div>`;
}

function signatureOf(views) {
  return views
    .map((view) => [view.entity, view.name, view.room, view.features, view.mapEntity, view.fanSpeeds.join("+")].join("~"))
    .join("|");
}

function syncCard(card, view) {
  card.dataset.dmRobotState = view.state;
  const label = card.querySelector("[data-dm-robot-label]");
  if (label) label.textContent = robotStateLabel(view.state, english());

  const battery = card.querySelector("[data-dm-robot-battery]");
  if (battery && view.battery !== null) {
    const livello = Math.max(0, Math.min(100, Math.round(view.battery)));
    battery.dataset.low = String(livello <= 20);
    battery.dataset.charging = String(view.charging);
    const bar = battery.querySelector("b");
    if (bar) bar.style.width = `${livello}%`;
    const num = battery.querySelector(".dm-robot-batt-num");
    if (num) num.textContent = `${livello}%`;
  }

  const fan = card.querySelector("[data-dm-robot-fan]");
  // Mai riscrivere una scelta mentre la si sta facendo.
  if (fan && fan !== doc.activeElement && view.fanSpeed && fan.value !== view.fanSpeed) fan.value = view.fanSpeed;

  const error = card.querySelector("[data-dm-robot-error]");
  if (error) {
    error.textContent = view.error;
    error.hidden = !view.error;
  }
  loadMap(card, view);
}

export function renderRobots() {
  const page = ensureRobotPage();
  const wrap = page?.querySelector("#robot-wrap");
  if (!wrap) return false;
  /* Il giro di disegno passa di qui ogni tre secondi, perche' e' quello che
   * tiene allineate le voci della barra. Rifare le schede di una pagina che
   * nessuno sta guardando e' lavoro buttato — e su un telefono si sente. */
  if (!page.classList.contains("active")) return true;
  const views = configuredRobots().map((robot) => robotView(robot, allStates()));

  if (!views.length) {
    if (state.signature !== "empty") {
      state.signature = "empty";
      wrap.innerHTML = emptyMarkup();
    }
    return true;
  }

  const current = signatureOf(views);
  if (state.signature !== current || !wrap.querySelector("[data-dm-robot]")) {
    state.signature = current;
    wrap.innerHTML = views.map(cardMarkup).join("");
  }
  for (const view of views) {
    const card = wrap.querySelector(`[data-dm-robot="${CSS.escape(view.entity)}"]`);
    if (card) syncCard(card, view);
  }
  return true;
}

/* ── la mappa ────────────────────────────────────────────────────────────── */

function authToken() {
  const values = [
    root.DASHBOARDMODERN_AUTH_TOKEN,
    root.__DASHBOARDMODERN_REAL_TOKEN__,
    root.LONG_LIVED_TOKEN,
    root.HA_TOKEN,
  ];
  try {
    const connection = readJson("cd_connection", {});
    values.push(connection.token, connection.access_token);
  } catch (_error) {}
  return values.map(clean).find((value) => value && value !== "__dashboardmodern_hosted__") || "";
}

/* La mappa e' un disegno che cambia mentre il robot gira.
 *
 * Home Assistant la pubblica come telecamera o come immagine, e in tutti e due
 * i casi cambia l'indirizzo in `entity_picture` a ogni aggiornamento. Si
 * ridisegna quando quell'indirizzo cambia, e mai piu' spesso: chiedere di
 * nuovo lo stesso disegno vuol dire far lavorare Home Assistant per niente. */
async function loadMap(card, view) {
  const host = card.querySelector("[data-dm-robot-map]");
  const image = card.querySelector("[data-dm-robot-map-image]");
  if (!host || !image) return;
  const picture = clean(view.mapPicture);
  if (!picture) {
    host.dataset.dmMapState = "missing";
    return;
  }
  /* Si ricorda il disegno gia' preso, per non richiederlo uguale a ogni giro.
   * Ci si ricorda pero' solo di quelli arrivati: un disegno che non e' arrivato
   * — un momento di rete, un token non ancora pronto — deve poter essere
   * richiesto di nuovo, altrimenti la mappa resta rotta per sempre. */
  if (state.mapPictures.get(view.entity) === picture) return;

  const token = authToken();
  if (typeof root.fetch === "function" && token) {
    try {
      const response = await root.fetch(picture, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (response.ok) {
        const objectUrl = root.URL?.createObjectURL?.(await response.blob());
        if (objectUrl) {
          releaseMap(view.entity, objectUrl);
          image.src = objectUrl;
          host.dataset.dmMapState = "ready";
          state.mapPictures.set(view.entity, picture);
          return;
        }
      }
    } catch (_error) {}
  }
  image.onload = () => {
    host.dataset.dmMapState = "ready";
    state.mapPictures.set(view.entity, picture);
  };
  image.onerror = () => {
    host.dataset.dmMapState = "missing";
    state.mapPictures.delete(view.entity);
  };
  releaseMap(view.entity, picture);
  image.src = picture;
}

/* Un disegno tenuto in memoria e mai liberato e' una perdita che si vede solo
 * dopo un'ora di plancia aperta. */
function releaseMap(entity, next) {
  const previous = state.mapUrls.get(entity);
  if (previous && previous !== next && previous.startsWith("blob:")) root.URL?.revokeObjectURL?.(previous);
  state.mapUrls.set(entity, next);
}

/* ── i comandi ───────────────────────────────────────────────────────────── */

function callService(command) {
  if (!command) return false;
  try {
    if (typeof root.cdCallServiceJson === "function") {
      root.cdCallServiceJson(command.domain, command.service, command.data);
      return true;
    }
    if (typeof root.dmCallHaService === "function") {
      root.dmCallHaService(command.domain, command.service, command.data);
      return true;
    }
    if (typeof root.callService === "function") {
      root.callService(command.domain, command.service, command.data);
      return true;
    }
  } catch (_error) {}
  return false;
}

export function handleRobotClick(event) {
  const button = event.target?.closest?.("[data-dm-robot-act]");
  if (!button) return false;
  const card = button.closest("[data-dm-robot]");
  const entity = clean(card?.dataset.dmRobot);
  const view = configuredRobots()
    .map((robot) => robotView(robot, allStates()))
    .find((item) => item.entity === entity);
  if (!view) return false;
  event.preventDefault();
  if (root.navigator?.vibrate) root.navigator.vibrate(12);
  callService(robotCommand(button.dataset.dmRobotAct, view));
  schedule();
  return true;
}

function handleFanChange(event) {
  const select = event.target?.closest?.("[data-dm-robot-fan]");
  if (!select) return;
  const entity = clean(select.closest("[data-dm-robot]")?.dataset.dmRobot);
  const view = configuredRobots()
    .map((robot) => robotView(robot, allStates()))
    .find((item) => item.entity === entity);
  if (!view) return;
  callService(robotFanCommand(view, select.value));
  schedule();
}

/* ── installazione ───────────────────────────────────────────────────────── */

function paint() {
  state.frame = 0;
  ensureRobotTab();
  teachNavVisibility();
  renderRobots();
}

function schedule() {
  if (state.frame) return;
  state.frame = root.requestAnimationFrame?.(paint) || root.setTimeout?.(paint, 0) || 0;
}

function installStyles() {
  installStyle(
    "dm-robot-section-style",
    `
      /* La larghezza non se la sceglie questa sezione: sta in un posto solo,
       * --dm-page-room, e tutte le pagine la seguono insieme. Qui era scritto
       * 1040 a mano — la vecchia misura della piscina — e il robot si apriva
       * quattrocento pixel piu' stretto di tutti gli altri. */
      #page-robot .dm-robot-wrap{box-sizing:border-box;width:100%;max-width:var(--dm-page-room,none);margin:0 auto;padding:0 4px 18px;display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}
      #page-robot .dm-robot-card{display:grid;align-content:start;gap:12px;padding:14px;border:1px solid var(--divider-color,#dbe4ee);border-radius:20px;background:var(--card-bg,#fff);box-shadow:0 18px 34px -28px rgba(15,23,42,.55)}
      #page-robot .dm-robot-head{display:flex;align-items:center;gap:10px;min-width:0}
      #page-robot .dm-robot-icon{font-size:22px;flex:0 0 auto}
      #page-robot .dm-robot-title{display:grid;min-width:0;flex:1 1 auto}
      #page-robot .dm-robot-title strong{font-size:15px;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      #page-robot .dm-robot-title small{color:var(--secondary-text-color,#64748b);font-size:11.5px;font-weight:700}
      #page-robot .dm-robot-state{flex:0 0 auto;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:900;letter-spacing:.02em;text-transform:uppercase;background:var(--secondary-background-color,#eef3f8);color:var(--secondary-text-color,#64748b)}
      #page-robot [data-dm-robot-state="cleaning"] .dm-robot-state{background:color-mix(in srgb,#0ea5e9 18%,transparent);color:#0369a1}
      #page-robot [data-dm-robot-state="returning"] .dm-robot-state{background:color-mix(in srgb,#8b5cf6 18%,transparent);color:#6d28d9}
      #page-robot [data-dm-robot-state="docked"] .dm-robot-state{background:color-mix(in srgb,#10b981 18%,transparent);color:#047857}
      #page-robot [data-dm-robot-state="error"] .dm-robot-state,
      #page-robot [data-dm-robot-state="unavailable"] .dm-robot-state{background:color-mix(in srgb,#dc2626 16%,transparent);color:#b91c1c}
      /* La mappa tiene il suo posto anche mentre non c'e': senza un'altezza la
         scheda salterebbe su e giu' a ogni aggiornamento del disegno. */
      #page-robot .dm-robot-map{position:relative;aspect-ratio:4/3;border-radius:16px;overflow:hidden;background:var(--secondary-background-color,#eef3f8);display:grid;place-items:center}
      #page-robot .dm-robot-map img{display:block;width:100%;height:100%;object-fit:contain}
      #page-robot .dm-robot-map[data-dm-map-state="ready"] .dm-robot-map-hint{display:none}
      #page-robot .dm-robot-map:not([data-dm-map-state="ready"]) img{visibility:hidden}
      /* Senza una mappa collegata non si tiene in piedi un riquadro grande e
         vuoto: la riga dice cosa manca e basta. */
      #page-robot .dm-robot-map.dm-vuota{aspect-ratio:auto;min-height:0;padding:16px 12px;position:static}
      #page-robot .dm-robot-map.dm-vuota .dm-robot-map-hint{position:static}
      #page-robot .dm-robot-map-hint{position:absolute;color:var(--secondary-text-color,#94a3b8);font-size:12px;font-weight:700;text-align:center;padding:0 12px}
      #page-robot .dm-robot-meta{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
      #page-robot .dm-robot-batt{display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:800}
      #page-robot .dm-robot-batt-shell{position:relative;width:38px;height:15px;border:1.5px solid var(--secondary-text-color,#94a3b8);border-radius:4px;padding:2px}
      #page-robot .dm-robot-batt-shell::after{content:"";position:absolute;right:-4px;top:4px;width:3px;height:5px;border-radius:0 2px 2px 0;background:var(--secondary-text-color,#94a3b8)}
      #page-robot .dm-robot-batt-shell b{display:block;height:100%;border-radius:2px;background:#10b981;transition:width .4s ease}
      #page-robot .dm-robot-batt[data-low="true"] .dm-robot-batt-shell b{background:#dc2626}
      #page-robot .dm-robot-batt[data-charging="true"] .dm-robot-batt-shell b{background:#0ea5e9}
      #page-robot .dm-robot-fan{display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:800;margin-left:auto}
      #page-robot .dm-robot-fan select{padding:5px 8px;border:1px solid var(--divider-color,#dbe4ee);border-radius:9px;background:var(--card-bg,#fff);font:inherit;font-size:12px}
      #page-robot .dm-robot-error{margin:0;color:#b91c1c;font-size:12px;font-weight:800}
      #page-robot .dm-robot-error[hidden]{display:none}
      #page-robot .dm-robot-actions{display:grid;grid-template-columns:repeat(auto-fit,minmax(84px,1fr));gap:8px}
      #page-robot .dm-robot-btn{display:inline-flex;flex-direction:column;align-items:center;gap:3px;padding:9px 6px;border:1px solid var(--divider-color,#dbe4ee);border-radius:13px;background:var(--card-bg,#fff);font:inherit;font-size:11px;font-weight:800;cursor:pointer;color:var(--text,#0f172a)}
      #page-robot .dm-robot-btn:hover{border-color:#0ea5e9}
      #page-robot .dm-robot-btn span[aria-hidden]{font-size:16px}
      #page-robot .dm-robot-empty{grid-column:1/-1}
      @media(prefers-reduced-motion:reduce){#page-robot .dm-robot-batt-shell b{transition:none}}
    `,
  );
}

export function installRobotSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  ensureRobotPage();
  ensureRobotTab();
  teachNavVisibility();
  doc.addEventListener("click", handleRobotClick);
  doc.addEventListener("change", handleFanChange);
  for (const name of ["render", "cdApplyNavVis"]) wrapFunction(name, "__dmRobotSection", schedule);
  for (const event of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:state-changed",
    "dashboardmodern:persistence-restored",
  ])
    root.addEventListener?.(event, schedule);
  try {
    dashboardStore()?.subscribe?.((change) => {
      if (change?.section === "robots") schedule();
    });
  } catch (_error) {}
  schedule();
}
