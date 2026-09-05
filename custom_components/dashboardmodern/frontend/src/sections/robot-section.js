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
  comandoDelRobot,
  drawableRobots,
  robotActions,
  robotCommand,
  robotFanCommand,
  robotStateLabel,
  robotView,
  SPECIES_LABELS,
} from "../core/robot-model.js";
import {
allStates,
  clean,
  dashboardStore,
  doc,
  esc,
  gettoneDiAccesso,
  installStyle,
  readJson,
  root,
  roomLabel,
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
  const before =
    nav?.querySelector('.tab[data-tab="security"]') ||
    nav?.querySelector('.tab[data-tab="config"]');
  if (!nav) return null;
  tab = doc.createElement("button");
  tab.className = "tab";
  tab.dataset.tab = ROBOT_TAB;
  tab.id = `tab-${ROBOT_TAB}`;
  /* La voce si chiama «Robot», non «Aspirapolvere»: da quando la sezione
   * accoglie anche i tagliaerba, il nome vecchio mentirebbe a meta' dei robot. */
  tab.innerHTML = `<span class="icon">🤖</span><span class="text">${esc(t("Robot", "Robots"))}</span>`;
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
    .map(
      (speed) =>
        `<option value="${esc(speed)}"${speed === view.fanSpeed ? " selected" : ""}>${esc(speed)}</option>`,
    )
    .join("");
  return `<label class="dm-robot-fan"><span>${esc(t("Aspirazione", "Suction"))}</span>
    <select data-dm-robot-fan aria-label="${esc(t("Potenza di aspirazione", "Suction power"))}">${options}</select></label>`;
}

/* I comandi a parte del robot (#306): i tasti e gli interruttori sotto ai
 * comandi di sempre, le tendine accanto a quella dell'aspirazione. «Da solo la
 * modalita' aspirazione»: un robot che lava ha anche i suoi programmi, e sono
 * entita' a parte che la scheda non vedeva. */
function comandiTastiMarkup(view) {
  const voci = (view.comandi || []).filter((voce) => voce.genere !== "tendina");
  if (!voci.length) return "";
  return voci
    .map((voce) => {
      const interruttore = voce.genere === "interruttore";
      const premuto = interruttore ? ` aria-pressed="${voce.acceso === true}"` : "";
      const glifo = interruttore ? "⏻" : "✦";
      return `<button type="button" class="dm-robot-btn dm-robot-cmd" data-dm-robot-cmd="${esc(voce.entity)}" data-dm-robot-cmd-genere="${esc(voce.genere)}"${premuto}${voce.available ? "" : " disabled"} title="${esc(voce.name)}">
          <span aria-hidden="true">${glifo}</span><span class="dm-robot-btn-tx">${esc(voce.name)}</span>
        </button>`;
    })
    .join("");
}

function comandiTendineMarkup(view) {
  const voci = (view.comandi || []).filter((voce) => voce.genere === "tendina");
  return voci
    .map((voce) => {
      const opzioni = voce.opzioni.length ? voce.opzioni : voce.scelta ? [voce.scelta] : [];
      if (!opzioni.length) return "";
      const options = opzioni
        .map(
          (opzione) =>
            `<option value="${esc(opzione)}"${opzione === voce.scelta ? " selected" : ""}>${esc(opzione)}</option>`,
        )
        .join("");
      return `<label class="dm-robot-fan dm-robot-tendina"><span>${esc(voce.name)}</span>
    <select data-dm-robot-tendina="${esc(voce.entity)}" aria-label="${esc(voce.name)}"${voce.available ? "" : " disabled"}>${options}</select></label>`;
    })
    .join("");
}

function mapMarkup(view) {
  if (!view.mapEntity)
    return `<div class="dm-robot-map dm-vuota" data-dm-robot-map><span class="dm-robot-map-hint">${esc(t("Nessuna mappa collegata", "No map linked"))}</span></div>`;
  return `<div class="dm-robot-map" data-dm-robot-map data-dm-map-state="loading"
      role="button" tabindex="0" data-dm-robot-map-open="${esc(view.entity)}"
      title="${esc(t("Apri la mappa", "Open the map"))}">
    <img alt="${esc(t(`Mappa di ${view.name}`, `Map of ${view.name}`))}" data-dm-robot-map-image decoding="async">
    <span class="dm-robot-map-hint">${esc(t("Mappa non disponibile", "Map unavailable"))}</span>
    <span class="dm-robot-map-zoom" aria-hidden="true">⤢</span>
  </div>`;
}

/* Il segno della specie: il tagliaerba non e' un aspirapolvere e non si
 * traveste da lui — l'icona e l'etichetta piccola lo dicono a colpo d'occhio. */
function speciesIcon(view) {
  return view.species === "lawn_mower" ? "🌱" : "🤖";
}

/* La stanza del robot, scritta come si legge.
 *
 * La configurazione salva l'ID della stanza — e' l'unica cosa che regge un
 * rinominamento — e da quando il robot nasce dall'integrazione quell'id lo
 * scrive il legame col dispositivo, prendendolo dall'area di Home Assistant.
 * La card pero' stampava quello che trovava, e quello che trovava era
 * «room-salone». `roomLabel` fa questa conversione per tutte le sezioni: qui
 * si usa la stessa, non una seconda.
 *
 * Vale anche per la firma del disegno: se la firma guardasse l'id e la card
 * il nome, rinominare una stanza non farebbe ridisegnare niente. */
function stanzaDelRobot(view) {
  return roomLabel(view?.room);
}

function speciesTag(view) {
  if (view.species !== "lawn_mower") return "";
  return t(SPECIES_LABELS.lawn_mower[0], SPECIES_LABELS.lawn_mower[1]);
}

function cardMarkup(view) {
  const actions = robotActions(view)
    .map(
      (action) =>
        `<button type="button" class="dm-robot-btn" data-dm-robot-act="${esc(action.act)}" title="${esc(t(action.it, action.en))}">
          <span aria-hidden="true">${action.glyph}</span><span class="dm-robot-btn-tx">${esc(t(action.it, action.en))}</span>
        </button>`,
    )
    .join("");
  const sotto = [speciesTag(view), stanzaDelRobot(view)].filter(Boolean).join(" · ");
  return `<article class="dm-robot-card" data-dm-robot="${esc(view.entity)}" data-dm-robot-state="${esc(view.state)}" data-dm-robot-species="${esc(view.species)}">
    <div class="dm-robot-head">
      <span class="dm-robot-icon" aria-hidden="true">${speciesIcon(view)}</span>
      <span class="dm-robot-title">
        <strong>${esc(view.name)}</strong>
        ${sotto ? `<small>${esc(sotto)}</small>` : ""}
      </span>
      <span class="dm-robot-state" data-dm-robot-label>${esc(robotStateLabel(view.state))}</span>
    </div>
    ${mapMarkup(view)}
    <div class="dm-robot-meta">
      ${batteryMarkup(view)}
      ${fanMarkup(view)}
      ${comandiTendineMarkup(view)}
    </div>
    <p class="dm-robot-error" data-dm-robot-error${view.error ? "" : " hidden"}>${esc(view.error)}</p>
    <div class="dm-robot-actions">${actions}</div>
    ${
      comandiTastiMarkup(view)
        ? `<div class="dm-robot-actions dm-robot-comandi" data-dm-robot-comandi>${comandiTastiMarkup(view)}</div>`
        : ""
    }
  </article>`;
}

function emptyMarkup() {
  return `<div class="ed-empty dm-robot-empty">${esc(t("Nessun robot configurato", "No robot configured"))}</div>`;
}

function signatureOf(views) {
  return views
    .map((view) =>
      [
        view.entity,
        view.species,
        view.name,
        stanzaDelRobot(view),
        view.features,
        view.mapEntity,
        view.fanSpeeds.join("+"),
        /* La presenza della batteria decide se la sua casella esiste nel
         * markup: quando compare — il sensore a parte che arriva dopo — la
         * scheda va rifatta, non solo aggiornata. */
        view.battery === null ? "" : "batt",
        /* I comandi a parte (#306): quali sono, come si chiamano, che opzioni
         * hanno e se rispondono. Lo stato di un interruttore e la scelta di
         * una tendina invece si aggiornano sul posto. */
        (view.comandi || [])
          .map((voce) => `${voce.entity}:${voce.name}:${voce.available}:${voce.opzioni.join("/")}`)
          .join("+"),
      ].join("~"),
    )
    .join("|");
}

function syncCard(card, view) {
  card.dataset.dmRobotState = view.state;
  const label = card.querySelector("[data-dm-robot-label]");
  if (label) label.textContent = robotStateLabel(view.state);

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
  if (fan && fan !== doc.activeElement && view.fanSpeed && fan.value !== view.fanSpeed)
    fan.value = view.fanSpeed;
  /* I comandi a parte (#306): l'interruttore segue il suo stato, la tendina
   * la sua scelta — con la stessa cura per chi la sta toccando. */
  for (const voce of view.comandi || []) {
    if (voce.genere === "interruttore") {
      const tasto = card.querySelector(`[data-dm-robot-cmd="${CSS.escape(voce.entity)}"]`);
      if (tasto) tasto.setAttribute("aria-pressed", String(voce.acceso === true));
    } else if (voce.genere === "tendina") {
      const tendina = card.querySelector(`[data-dm-robot-tendina="${CSS.escape(voce.entity)}"]`);
      if (tendina && tendina !== doc.activeElement && voce.scelta && tendina.value !== voce.scelta)
        tendina.value = voce.scelta;
    }
  }

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

/* ── la mappa aperta ──────────────────────────────────────────────────────
 *
 * Nella card la mappa sta in un riquadro quattro terzi: ci sta tutta — e'
 * disegnata `contain`, non ritagliata — ma di una casa intera dentro trecento
 * pixel non si legge niente, e non c'era modo di guardarla piu' da vicino.
 *
 * Qui si apre a schermo pieno, e si puo' spostare e ingrandire: la rotella e
 * il pizzico ingrandiscono attorno al punto che si sta guardando — non al
 * centro del riquadro, che e' il modo in cui si perde sempre quello che si
 * cercava — il dito la trascina, e un tocco doppio la rimette com'era.
 *
 * Il disegno e' lo stesso della card: si prende la sorgente da li'. Non si
 * chiede niente in piu' a Home Assistant per aprirla.
 */
const VISORE_ID = "dm-robot-map-view";
/* Sotto la misura d'apertura SI PUO' andare. Il divieto («la mappa
 * diventerebbe un francobollo») presumeva che a misura si vedesse tutta; dal
 * campo e' arrivato il contrario — «zoom in avanti ma non indietro, e non si
 * apre completa» — e quando la misura tradisce, rimpicciolire e' l'unica via
 * d'uscita che l'utente ha in mano. Sotto l'uno la mappa resta centrata. */
const INGRANDIMENTO_MIN = 0.4;
const INGRANDIMENTO_MAX = 8;

function vista() {
  return (state.vista ||= { scala: 1, x: 0, y: 0, trascina: null, pizzico: null });
}

/* Fin dove si puo' spostare la mappa.
 *
 * Quello che avanza del disegno oltre il riquadro, meta' per lato: e' la
 * distanza oltre la quale trascinare vorrebbe solo dire portarsi via la mappa.
 * Un po' di aria in piu' — un decimo del riquadro — perche' arrivare esatti al
 * bordo sembra un muro; oltre, la mappa tornerebbe a scappare in un angolo. */
function limiteDelloSpostamento(figura) {
  const riquadro = figura?.parentElement?.getBoundingClientRect?.();
  if (!riquadro) return { x: 0, y: 0 };
  const v = vista();
  const largo = (figura.clientWidth || riquadro.width) * v.scala;
  const alto = (figura.clientHeight || riquadro.height) * v.scala;
  const aria = 0.1;
  return {
    x: Math.max(0, (largo - riquadro.width) / 2) + riquadro.width * aria,
    y: Math.max(0, (alto - riquadro.height) / 2) + riquadro.height * aria,
  };
}

const dentro = (valore, limite) => Math.min(limite, Math.max(-limite, valore));

function applicaVista(figura) {
  const v = vista();
  const limite = limiteDelloSpostamento(figura);
  v.x = dentro(v.x, limite.x);
  v.y = dentro(v.y, limite.y);
  figura.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.scala})`;
  figura.dataset.dmZoom = v.scala > 1.01 ? "true" : "false";
}

function azzeraVista(figura) {
  const v = vista();
  v.scala = 1;
  v.x = 0;
  v.y = 0;
  if (figura) applicaVista(figura);
}

/* Ingrandisce tenendo fermo il punto sotto il dito: senza, la mappa scappa
 * verso il centro a ogni scatto di rotella. */
function ingrandisci(figura, fattore, puntoX, puntoY) {
  const v = vista();
  const prima = v.scala;
  const dopo = Math.min(INGRANDIMENTO_MAX, Math.max(INGRANDIMENTO_MIN, prima * fattore));
  if (dopo === prima) return;
  const riquadro = figura.parentElement?.getBoundingClientRect?.();
  const cx = riquadro ? puntoX - riquadro.left - riquadro.width / 2 : 0;
  const cy = riquadro ? puntoY - riquadro.top - riquadro.height / 2 : 0;
  v.x = cx - ((cx - v.x) * dopo) / prima;
  v.y = cy - ((cy - v.y) * dopo) / prima;
  v.scala = dopo;
  /* Rimpicciolendo fin sotto la misura d'apertura la mappa torna in mezzo:
   * li' ci sta tutta, e uno spostamento residuo la lascerebbe in un angolo,
   * piccola e fuori asse. Sopra la misura invece lo spostamento e' il gesto
   * di chi sta guardando: lo tiene, e a fermarlo c'e' il limite. */
  if (dopo < 1) {
    v.x = 0;
    v.y = 0;
  }
  applicaVista(figura);
}

function chiudiVisore() {
  const visore = doc?.getElementById?.(VISORE_ID);
  if (!visore) return false;
  visore.hidden = true;
  doc.documentElement?.classList?.remove("dm-robot-map-open");
  return true;
}

function creaVisore() {
  let visore = doc.getElementById(VISORE_ID);
  if (visore) return visore;
  visore = doc.createElement("div");
  visore.id = VISORE_ID;
  visore.hidden = true;
  visore.innerHTML = `<div class="dm-robot-map-sheet" role="dialog" aria-modal="true">
      <header class="dm-robot-map-head">
        <strong data-dm-map-title></strong>
        <span class="dm-robot-map-tip">${esc(t("Trascina per spostare · rotella o pizzico per ingrandire", "Drag to move · wheel or pinch to zoom"))}</span>
        <button type="button" class="dm-robot-map-btn" data-dm-map-out aria-label="${esc(t("Rimpicciolisci", "Zoom out"))}">−</button>
        <button type="button" class="dm-robot-map-btn" data-dm-map-in aria-label="${esc(t("Ingrandisci", "Zoom in"))}">+</button>
        <button type="button" class="dm-robot-map-btn" data-dm-map-reset aria-label="${esc(t("Rimetti com'era", "Reset"))}">⟳</button>
        <button type="button" class="dm-robot-map-btn dm-robot-map-close" data-dm-map-close aria-label="${esc(t("Chiudi", "Close"))}">✕</button>
      </header>
      <div class="dm-robot-map-stage" data-dm-map-stage>
        <img alt="" data-dm-map-big decoding="async">
      </div>
    </div>`;
  doc.body?.append(visore);
  installaGestiVisore(visore);
  return visore;
}

function installaGestiVisore(visore) {
  const palco = visore.querySelector("[data-dm-map-stage]");
  const figura = visore.querySelector("[data-dm-map-big]");
  if (!palco || !figura) return;
  const v = vista();

  visore.addEventListener("click", (event) => {
    if (event.target === visore || event.target.closest("[data-dm-map-close]")) {
      chiudiVisore();
      return;
    }
    if (event.target.closest("[data-dm-map-in]")) ingrandisci(figura, 1.4, ...centro(palco));
    else if (event.target.closest("[data-dm-map-out]"))
      ingrandisci(figura, 1 / 1.4, ...centro(palco));
    else if (event.target.closest("[data-dm-map-reset]")) azzeraVista(figura);
  });

  palco.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      ingrandisci(figura, event.deltaY < 0 ? 1.18 : 1 / 1.18, event.clientX, event.clientY);
    },
    { passive: false },
  );

  /* Il dito e il puntatore fanno la stessa cosa: si trascina. Due dita
   * ingrandiscono, come ovunque. */
  const dita = new Map();
  palco.addEventListener("pointerdown", (event) => {
    palco.setPointerCapture?.(event.pointerId);
    dita.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (dita.size === 1) v.trascina = { x: event.clientX - v.x, y: event.clientY - v.y };
    if (dita.size === 2) {
      v.trascina = null;
      v.pizzico = distanza(dita);
    }
  });
  palco.addEventListener("pointermove", (event) => {
    if (!dita.has(event.pointerId)) return;
    dita.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (dita.size === 2 && v.pizzico) {
      const adesso = distanza(dita);
      const [px, py] = medio(dita);
      if (adesso > 0) ingrandisci(figura, adesso / v.pizzico, px, py);
      v.pizzico = adesso;
      return;
    }
    /* La mappa si scorre sempre, non solo da ingrandita.
     *
     * «Nella mappa devi aggiungere anche lo scrollo sia da smartphone che da
     * desktop.» Il trascinamento era chiuso dietro «solo se sei oltre il
     * cento per cento»: a misura d'apertura la mappa non si muoveva di un
     * pixel, e su una planimetria lunga — o su un telefono in verticale — la
     * meta' che non ci stava non c'era modo di guardarla. Adesso si trascina
     * a qualsiasi ingrandimento, col dito o col mouse, e a fermarla c'e' il
     * limite qui sopra invece di un divieto. */
    if (!v.trascina) return;
    v.x = event.clientX - v.trascina.x;
    v.y = event.clientY - v.trascina.y;
    applicaVista(figura);
  });
  const molla = (event) => {
    dita.delete(event.pointerId);
    if (dita.size < 2) v.pizzico = null;
    if (!dita.size) v.trascina = null;
  };
  palco.addEventListener("pointerup", molla);
  palco.addEventListener("pointercancel", molla);
  palco.addEventListener("dblclick", () => azzeraVista(figura));
}

const centro = (palco) => {
  const r = palco.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2];
};

function distanza(dita) {
  const [a, b] = [...dita.values()];
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function medio(dita) {
  const [a, b] = [...dita.values()];
  return [(a.x + b.x) / 2, (a.y + b.y) / 2];
}

/** Apre la mappa di quel robot, con il disegno che la card ha gia' preso. */
export function apriMappaRobot(entity) {
  const card = doc?.querySelector?.(
    `[data-dm-robot-map-open="${clean(entity).replace(/["\\]/g, "\\$&")}"]`,
  );
  const sorgente = clean(card?.querySelector?.("[data-dm-robot-map-image]")?.getAttribute?.("src"));
  if (!sorgente) return false;
  const visore = creaVisore();
  const figura = visore.querySelector("[data-dm-map-big]");
  const titolo = visore.querySelector("[data-dm-map-title]");
  if (titolo)
    titolo.textContent =
      clean(
        card?.closest?.("[data-dm-robot-card]")?.querySelector?.(".dm-robot-name")?.textContent,
      ) || t("Mappa", "Map");
  if (figura) {
    figura.src = sorgente;
    azzeraVista(figura);
  }
  visore.hidden = false;
  doc.documentElement?.classList?.add("dm-robot-map-open");
  return true;
}

/* ── la mappa ────────────────────────────────────────────────────────────── */

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

  const token = gettoneDiAccesso();
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
  if (previous && previous !== next && previous.startsWith("blob:"))
    root.URL?.revokeObjectURL?.(previous);
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
  /* Il tocco sulla mappa la apre. Sta prima dei comandi perche' la mappa non
   * e' un comando: e' la cosa piu' grande della card, e chi la tocca vuole
   * guardarla da vicino. */
  const mappa = event.target?.closest?.("[data-dm-robot-map-open]");
  if (mappa) {
    event.preventDefault();
    return apriMappaRobot(mappa.dataset.dmRobotMapOpen);
  }
  /* Un comando a parte (#306): si preme, si accende o si inverte, secondo
   * cosa e'. Lo stato che ne segue arriva da Home Assistant col prossimo giro. */
  const comando = event.target?.closest?.("[data-dm-robot-cmd]");
  if (comando) {
    const voce = vistaDi(comando)?.comandi?.find(
      (item) => item.entity === clean(comando.dataset.dmRobotCmd),
    );
    if (!voce) return false;
    event.preventDefault();
    if (root.navigator?.vibrate) root.navigator.vibrate(12);
    if (voce.genere === "interruttore")
      comando.setAttribute("aria-pressed", String(voce.acceso !== true));
    callService(comandoDelRobot(voce));
    schedule();
    return true;
  }
  const button = event.target?.closest?.("[data-dm-robot-act]");
  if (!button) return false;
  const view = vistaDi(button);
  if (!view) return false;
  event.preventDefault();
  if (root.navigator?.vibrate) root.navigator.vibrate(12);
  callService(robotCommand(button.dataset.dmRobotAct, view));
  schedule();
  return true;
}

/* Il robot a cui appartiene un pezzo della scheda, come sta adesso. */
function vistaDi(nodo) {
  const entity = clean(nodo?.closest?.("[data-dm-robot]")?.dataset.dmRobot);
  if (!entity) return null;
  return (
    configuredRobots()
      .map((robot) => robotView(robot, allStates()))
      .find((item) => item.entity === entity) || null
  );
}

function handleFanChange(event) {
  /* Una tendina a parte (#306): la scelta va alla sua entita', non al robot. */
  const tendina = event.target?.closest?.("[data-dm-robot-tendina]");
  if (tendina) {
    const voce = vistaDi(tendina)?.comandi?.find(
      (item) => item.entity === clean(tendina.dataset.dmRobotTendina),
    );
    if (!voce) return;
    callService(comandoDelRobot(voce, tendina.value));
    schedule();
    return;
  }
  const select = event.target?.closest?.("[data-dm-robot-fan]");
  if (!select) return;
  const view = vistaDi(select);
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
      /* Il tagliaerba al lavoro si accende come l'aspirapolvere che pulisce,
         ma del colore del prato. */
      #page-robot [data-dm-robot-state="mowing"] .dm-robot-state{background:color-mix(in srgb,#16a34a 18%,transparent);color:#15803d}
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
      /* Il segno che la mappa si apre: si fa vedere quando c'e' un disegno. */
      #page-robot .dm-robot-map[data-dm-robot-map-open]{cursor:zoom-in}
      #page-robot .dm-robot-map-zoom{
        position:absolute;right:8px;bottom:8px;display:none;
        width:28px;height:28px;place-items:center;border-radius:9px;
        background:rgba(15,23,42,.55);color:#fff;font-size:13px;line-height:1}
      #page-robot .dm-robot-map[data-dm-map-state="ready"] .dm-robot-map-zoom{display:grid}
      #page-robot .dm-robot-map:focus-visible{outline:2px solid #0ea5e9;outline-offset:2px}
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
      /* La mappa aperta: una finestra come le altre della plancia, e dentro un
         palco che tiene il disegno e lo lascia spostare. */
      html.dm-robot-map-open{overflow:hidden}
      #dm-robot-map-view{
        position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;
        padding:16px;background:color-mix(in srgb,var(--bg-sculpted,#e6ebf1) 58%,rgba(15,23,42,.42));
        backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}
      #dm-robot-map-view[hidden]{display:none}
      #dm-robot-map-view .dm-robot-map-sheet{
        display:flex;flex-direction:column;width:min(1100px,100%);height:min(88dvh,900px);
        border:1px solid var(--card-border,#e8edf3);border-radius:26px;overflow:hidden;
        background:var(--card-bg,#fff);
        box-shadow:0 32px 64px -28px rgba(2,6,23,.45)}
      #dm-robot-map-view .dm-robot-map-head{
        display:flex;align-items:center;gap:10px;padding:13px 15px;
        border-bottom:1px solid var(--card-border,#e8edf3)}
      #dm-robot-map-view .dm-robot-map-head strong{
        font-family:'Oswald',system-ui,sans-serif;font-size:16px;letter-spacing:1.4px;
        text-transform:uppercase}
      #dm-robot-map-view .dm-robot-map-tip{
        flex:1;min-width:0;font-size:11px;font-weight:700;color:var(--text-dim,#94a3b8);
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #dm-robot-map-view .dm-robot-map-btn{
        flex:0 0 34px;width:34px;height:34px;display:grid;place-items:center;cursor:pointer;
        border:1px solid var(--card-border,#e8edf3);border-radius:11px;
        background:var(--surface-2,#f8fafc);font:inherit;font-size:15px;font-weight:800;
        color:var(--text,#0f172a)}
      #dm-robot-map-view .dm-robot-map-btn:hover{border-color:#0ea5e9}
      #dm-robot-map-view .dm-robot-map-close:hover{background:#fee2e2;border-color:#fecaca;color:#dc2626}
      #dm-robot-map-view .dm-robot-map-stage{
        flex:1;min-height:0;position:relative;overflow:hidden;touch-action:none;
        display:grid;place-items:center;background:var(--secondary-background-color,#eef3f8);
        cursor:grab}
      #dm-robot-map-view .dm-robot-map-stage img{
        max-width:100%;max-height:100%;display:block;transform-origin:center center;
        transition:transform .12s ease-out;will-change:transform}
      #dm-robot-map-view .dm-robot-map-stage img[data-dm-zoom="true"]{cursor:grab}
      @media(max-width:600px){
        #dm-robot-map-view{padding:10px}
        #dm-robot-map-view .dm-robot-map-sheet{height:min(92dvh,900px);border-radius:20px}
        #dm-robot-map-view .dm-robot-map-tip{display:none}
      }
      @media(prefers-reduced-motion:reduce){
        #dm-robot-map-view .dm-robot-map-stage img{transition:none}
      }
      #page-robot .dm-robot-error{margin:0;color:#b91c1c;font-size:12px;font-weight:800}
      #page-robot .dm-robot-error[hidden]{display:none}
      #page-robot .dm-robot-actions{display:grid;grid-template-columns:repeat(auto-fit,minmax(84px,1fr));gap:8px}
      #page-robot .dm-robot-btn{display:inline-flex;flex-direction:column;align-items:center;gap:3px;padding:9px 6px;border:1px solid var(--divider-color,#dbe4ee);border-radius:13px;background:var(--card-bg,#fff);font:inherit;font-size:11px;font-weight:800;cursor:pointer;color:var(--text,#0f172a)}
      #page-robot .dm-robot-btn:hover{border-color:#0ea5e9}
      #page-robot .dm-robot-btn span[aria-hidden]{font-size:16px}
      /* I comandi a parte (#306): una fila sotto quelli di sempre, separata da
         un filo; l'interruttore acceso si vede dal bordo e dal fondo. */
      #page-robot .dm-robot-comandi{margin-top:8px;padding-top:10px;border-top:1px dashed var(--divider-color,#dbe4ee)}
      #page-robot .dm-robot-cmd .dm-robot-btn-tx{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      #page-robot .dm-robot-cmd[aria-pressed="true"]{border-color:#0ea5e9;background:color-mix(in srgb,#0ea5e9 14%,var(--card-bg,#fff));color:#0369a1}
      #page-robot .dm-robot-cmd[disabled]{opacity:.45;cursor:not-allowed}
      #page-robot .dm-robot-tendina{margin-left:0}
      #page-robot .dm-robot-tendina select{max-width:160px}
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
  /* La mappa aperta si chiude con Esc, come ogni finestra della plancia, e col
   * tasto invio o barra si apre da tastiera — il riquadro e' un bottone. */
  doc.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      chiudiVisore();
      return;
    }
    if (event.key !== "Enter" && event.key !== " ") return;
    const mappa = event.target?.closest?.("[data-dm-robot-map-open]");
    if (!mappa) return;
    event.preventDefault();
    apriMappaRobot(mappa.dataset.dmRobotMapOpen);
  });
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
