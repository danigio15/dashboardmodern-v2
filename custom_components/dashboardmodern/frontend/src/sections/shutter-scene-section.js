import {
  coverClosedPercent,
  coverEntries,
  coverIsAwning,
  coverIsSideways,
  coverKind,
  coverDownRelay,
  coverKindLabel,
  coverPositionChoices,
  coverPresetPosition,
  relayCoverCommands,
} from "../core/cover-kind.js";
import { contactEntity, isWindowOnly, windowOpenFromState } from "../core/shutter-window.js";
import { allStates, clean, doc, esc, installStyle, root, roomLabel, roomRank, t } from "./shared.js";

// Single paint owner for the Tapparelle page.
//
// The legacy runtime keeps every entity, service call and timer: this module
// only replaces renderTapparelle so the page draws a summary header, per-room
// headings and a card that carries a real position track next to the window,
// instead of a flat grid of windows with three arrow buttons. Commands still
// travel through the legacy cdTappCmd handler, which is what keeps the service
// domain and the vibration feedback identical to before.
//
// The window itself is skinned by shutter-section.js, which stays the owner of
// the first-paint geometry and of every legacy class this module reuses
// (.tapp-card, .tapp-win, .tapp-shutter, .tapp-state, .tapp-pos, .tapp-btn).
// That split is deliberate: if this owner never installs — an older runtime
// without renderTapparelle, for instance — the legacy markup still paints with
// the same skin instead of falling back to the raw 2015 stylesheet.
//
// The legacy loop repaints the page every 2s while it is visible. Rewriting
// innerHTML on each tick would fight the position track under the user's
// finger, so markup is built once per structural signature and afterwards only
// the values that changed are written.
const KEY = "__DASHBOARDMODERN_SHUTTER_SCENE_SECTION__";
const MARKER = "__dmShutterSceneOwner";
const STYLE_ID = "dm-shutter-scene-style";
const SUPPORT_SET_POSITION = 4;
const SLAT_COUNT = 8;
// How long a card keeps the position the user just asked for. Home Assistant
// reports the old position until the motor reaches the new one, so without this
// the track would snap back under the finger on the very next 2s repaint.
const GRAB_MS = 8000;

const state = (root[KEY] ||= {
  installed: false,
  frame: 0,
  signature: "",
  grabbed: new Map(),
});

/* ──────────────────────────────── model ─────────────────────────────────── */

function configuredCovers() {
  const legacy = root.getTapparelle?.();
  if (Array.isArray(legacy)) return legacy;
  const stored = root.dashboardStore?.()?.getSection?.("covers");
  return Array.isArray(stored) ? stored : [];
}

function floorOrder() {
  const names = root.cdFloorNames?.();
  return Array.isArray(names) ? names : [];
}

/* Un rele' che comanda la tapparella: on la apre, off la chiude. */
const eUnoSwitch = (entity) => /^switch\./i.test(clean(entity));

function coverView(item = {}, distingui = false) {
  const entity = clean(item.entity || item.entities?.[0]);
  if (!entity) return null;
  const current = allStates()[entity];
  const giu = coverDownRelay(item);
  let status = clean(current?.state).toLowerCase() || "unknown";
  /* Lo switch parla on/off: tradotto nella lingua delle coperture, cosi' la
   * pastiglia, il conteggio e il disegno non devono saperne niente.
   *
   * Con due rele' (#194) il discorso cambia: acceso non vuol dire «aperta»
   * ma «sta salendo», e l'altro rele' acceso vuol dire «sta scendendo». A
   * rele' spenti dove sia arrivata non lo sa nessuno — un motore a due fili
   * non lo racconta — e dirlo per finta sarebbe peggio che tacere. */
  if (eUnoSwitch(entity) && giu) {
    const su = status === "on";
    const scende = clean(allStates()[giu]?.state).toLowerCase() === "on";
    status = su ? "opening" : scende ? "closing" : "unknown";
  } else if (eUnoSwitch(entity)) {
    status = status === "on" ? "open" : status === "off" ? "closed" : status;
  }
  const raw = eUnoSwitch(entity) ? null : current?.attributes?.current_position;
  const reported = raw == null ? null : Math.max(0, Math.min(100, Number(raw)));
  const hasPosition = Number.isFinite(reported);
  const features = Number(current?.attributes?.supported_features) || 0;
  const grab = state.grabbed.get(entity);
  const position = grab ? grab.position : hasPosition ? reported : status === "open" ? 100 : status === "closed" ? 0 : 50;
  const room = roomLabel(clean(item.room));
  return {
    entity,
    kind: coverKind(item, current),
    /* Con piu' di una copertura sullo stesso infisso il nome da solo non
     * basta: tre card «Camera» non si distinguono. */
    name: nomeCopertura(item, current, entity, distingui),
    room,
    floor: clean(root.cdRoomFloorOf?.(room)),
    status,
    position: Math.round(position),
    hasPosition: hasPosition || Boolean(grab),
    settable: Boolean(features & SUPPORT_SET_POSITION),
    moving: status === "opening" || status === "closing",
    preset: coverPresetPosition(item),
    down: giu,
  };
}

function nomeCopertura(item, current, entity, distingui) {
  const base = clean(item.name) || clean(current?.attributes?.friendly_name) || entity;
  if (!distingui) return base;
  return `${base} · ${coverKindLabel(coverKind(item, current))}`;
}

/* Una riga di configurazione e' UNA finestra, anche con tre coperture.
 *
 * Le caselle in piu' — tenda, tenda da sole — uscivano come card separate: tre
 * riquadri per lo stesso infisso, e sotto la foto della finestra il cursore
 * era sempre uno solo. Chiesto piu' volte, con le stesse parole: «i 3 cursori,
 * uno per ogni entita', sotto la foto della finestra». La card adesso e' una:
 * la finestra disegna tutti i teli insieme, e sotto c'e' un cursore per
 * copertura, ciascuno con la sua etichetta e la sua percentuale. */
/* Una finestra senza motori.
 *
 * Persiane manuali, un contatto sull'anta e nient'altro: la riga non comanda
 * niente, ma sa dire se la finestra e' aperta. La vista che ne esce e' una
 * copertura per modo di dire — `soloInfisso` la tiene fuori dal conteggio in
 * cima e le toglie i comandi — e il disegno resta quello di sempre: l'infisso
 * visto dalla stanza, con le ante che si scostano quando il contatto lo dice.
 */
function windowOnlyView(item = {}) {
  const contatto = clean(contactEntity(item));
  if (!contatto) return null;
  const aperta = windowOpenFromState(allStates()[contatto]?.state);
  const room = roomLabel(clean(item.room));
  return {
    entity: contatto,
    soloInfisso: true,
    kind: "",
    name: clean(item.name) || clean(allStates()[contatto]?.attributes?.friendly_name) || contatto,
    room,
    floor: clean(root.cdRoomFloorOf?.(room)),
    status: aperta === true ? "open" : aperta === false ? "closed" : "unknown",
    /* Il vano si vede solo quando la finestra e' aperta: senza tapparella
     * davanti la posizione non esiste, e il disegno non deve fingerla. */
    position: 100,
    hasPosition: false,
    settable: false,
    moving: false,
    preset: null,
    down: "",
  };
}

function viewsFor(item = {}) {
  const entries = coverEntries(item);
  if (isWindowOnly(item)) return [windowOnlyView(item)].filter(Boolean);
  if (!entries.length) return [coverView(item)].filter(Boolean);
  const viste = entries
    .map(({ entity, kind, down }) => coverView({ ...item, entity, kind, down }, false))
    .filter(Boolean);
  if (viste.length <= 1) return viste;
  const [principale, ...altre] = viste;
  return [{ ...principale, extra: altre }];
}

/** Tutte le coperture di una view, la principale per prima. */
function coperture(view) {
  return [view, ...(view.extra || [])];
}

function coverList() {
  const views = configuredCovers().flatMap(viewsFor).filter(Boolean);
  const floors = floorOrder();
  const rank = (floor) => {
    const index = floors.indexOf(floor);
    return index < 0 ? Number.MAX_SAFE_INTEGER : index;
  };
  if (!views.some((view) => view.room)) return views;
  /* Le stanze nell'ordine scelto in configurazione, non in ordine alfabetico.
   * Chi ha messo il bagnetto in cima se lo ritrovava comunque fra la B e la C:
   * l'ordinamento c'era, ma qui non arrivava. Chi non e' fra le stanze
   * configurate resta in fondo, come prima. */
  const stanza = roomRank();
  return views.sort((a, b) => {
    if (rank(a.floor) !== rank(b.floor)) return rank(a.floor) - rank(b.floor);
    const left = stanza(a.room);
    const right = stanza(b.room);
    if (left !== right) return left - right;
    const nomeSinistra = a.room || "￿";
    const nomeDestra = b.room || "￿";
    return nomeSinistra === nomeDestra ? 0 : nomeSinistra < nomeDestra ? -1 : 1;
  });
}

function groupKey(view) {
  return `${view.floor}|${view.room}`;
}

function groupLabel(view) {
  if (!view.room) return t("Senza stanza", "No room");
  return view.floor ? `${view.floor} · ${view.room}` : view.room;
}

/**
 * Everything that changes the shape of the page, as opposed to a value inside
 * it. A new cover, a rename, a room move or a cover that starts reporting a
 * settable position rebuilds the markup; a position or a state change does not.
 */
function signature(views) {
  return views
    .map((view) =>
      coperture(view)
        .map((c) =>
          [c.entity, c.name, view.floor, view.room, c.settable, c.kind, c.preset, c.down].join("~"),
        )
        .join("+"),
    )
    .join("|");
}

/* La pastiglia dice quello che si vede.
 *
 * Diceva lo stato che manda Home Assistant, mentre il disegno e il conteggio in
 * cima partono dalla posizione. Le due cose non sempre coincidono: certe
 * coperture restano su `open` anche a zero per cento, e allora il riquadro
 * diceva «1 chiusa» e la card accanto «Aperta» sulla stessa tapparella, con la
 * finestra disegnata tutta coperta. Dove una posizione c'e', comanda lei: e'
 * quella che si sta guardando.
 */
function statoVisibile(view) {
  if (view.moving) return view.status;
  if (view.hasPosition) return view.position > 0 ? "open" : "closed";
  return view.status;
}

function statusLabel(view) {
  const stato = statoVisibile(view);
  if (stato === "opening") return t("In apertura", "Opening");
  if (stato === "closing") return t("In chiusura", "Closing");
  if (stato === "open") return t("Aperta", "Open");
  if (stato === "closed") return t("Chiusa", "Closed");
  /* Due rele' fermi non vogliono dire «non lo so»: vogliono dire che il
   * motore non sta girando. Dove sia arrivata non lo racconta nessuno — il
   * disegno la mette a meta', che e' il modo di non inventarlo — ma dire
   * «Sconosciuta» su una tapparella che sta benissimo sembra un guasto. */
  if (view.down) return t("Ferma", "Stopped");
  return t("Sconosciuta", "Unknown");
}

function summaryText(views) {
  /* Una finestra senza motori non e' una copertura: contarla fra le aperte
   * direbbe che c'e' una tapparella su, e non c'e'. Ha un conto suo, in coda,
   * e solo quando qualcuna e' davvero aperta. */
  const tutte = views.flatMap(coperture).filter((view) => !view.soloInfisso);
  const moving = tutte.filter((view) => view.moving).length;
  const open = tutte.filter((view) => !view.moving && view.position > 0).length;
  const closed = tutte.length - moving - open;
  const parts = [];
  if (open) parts.push(open === 1 ? t("1 aperta", "1 open") : t(`${open} aperte`, `${open} open`));
  if (closed) parts.push(closed === 1 ? t("1 chiusa", "1 closed") : t(`${closed} chiuse`, `${closed} closed`));
  if (moving) parts.push(moving === 1 ? t("1 in movimento", "1 moving") : t(`${moving} in movimento`, `${moving} moving`));
  const infissi = views.filter((view) => view.soloInfisso && view.status === "open").length;
  if (infissi)
    parts.push(
      infissi === 1
        ? t("1 finestra aperta", "1 window open")
        : t(`${infissi} finestre aperte`, `${infissi} windows open`),
    );
  return parts.join(" · ");
}

/* ─────────────────────────────── markup ─────────────────────────────────── */

/**
 * The way back home, kept identical to the button the legacy runtime injects
 * into every other page — same class, same label, same behaviour, so it looks
 * and acts like the one on Clima or Temperature.
 *
 * It is rendered as the first item of the grid rather than left where the
 * legacy runtime puts it, which is as a direct child of the page section. That
 * position sits against the left edge of the viewport while the cards sit in a
 * centred column: on a 1440px screen the two were 180px apart. As a grid item
 * it lines up with the header and the cards at every width and column count.
 */
function backHomeMarkup() {
  return `<button type="button" class="back-home-btn dm-tapp-back" onclick="document.querySelector('[data-tab=&quot;home&quot;]').click(); if(navigator.vibrate)navigator.vibrate(5);">
    <span class="bh-icon">←</span><span>${esc(t("Home", "Home"))}</span>
  </button>`;
}

/** The legacy runtime's own copy, which would otherwise show up twice. */
function dropLegacyBackHome() {
  doc?.getElementById("page-tapparelle")
    ?.querySelectorAll(":scope > .back-home-btn")
    .forEach((button) => button.remove());
}

/**
 * The page's summary and its two "all at once" commands, in the shape the
 * Climate page uses: a reading on the left, then one segmented control holding
 * both commands. Tapparelle used to say the same things through a title, a
 * subtitle and two filled buttons, which made two pages doing the same job look
 * unrelated. The page title is no longer printed here either — the section
 * heading above the page owns it now.
 */
function heroMarkup() {
  return `<section class="dm-tapp-hero" data-dm-tapp-hero role="group" aria-label="${esc(t("Tapparelle e tende", "Shutters and curtains"))}">
    <div class="dm-tapp-kpi">
      <span>${esc(t("Stato", "State"))}</span>
      <b data-dm-tapp-summary>—</b>
    </div>
    <div class="dm-tapp-bulk">
      <button type="button" class="dm-tapp-all" data-all="1" data-svc="open_cover" onclick="cdTappCmd(this)">▲ ${esc(t("Apri tutto", "Open all"))}</button>
      <span class="dm-tapp-bulk-div" aria-hidden="true"></span>
      <button type="button" class="dm-tapp-all" data-all="1" data-svc="close_cover" onclick="cdTappCmd(this)">▼ ${esc(t("Chiudi tutto", "Close all"))}</button>
    </div>
  </section>`;
}

function groupMarkup(view, count) {
  const suffix = count === 1 ? t("tapparella", "shutter") : t("tapparelle", "shutters");
  return `<div class="dm-tapp-group" role="heading" aria-level="3">
    <span class="dm-tapp-group-label">${esc(groupLabel(view))}</span>
    <span class="dm-tapp-group-count">${count} ${esc(suffix)}</span>
  </div>`;
}

/**
 * The track sits under the window, across the whole card, so the window itself
 * is never narrowed to make room for it. It is always drawn, so a cover that
 * cannot be sent to a position still shows where it stands; only a cover that
 * reports SET_POSITION gets the input that makes it draggable.
 */
function trackMarkup(view, { entity = "", etichetta = "" } = {}) {
  const attr = entity ? ` data-dm-entity="${esc(entity)}"` : "";
  if (!view.settable)
    return `<div class="dm-tapp-track" data-dm-static aria-hidden="true"${attr}></div>`;
  const label = t(`Posizione di ${view.name}`, `Position of ${view.name}`);
  return `<div class="dm-tapp-track"${attr}>
    <input class="dm-tapp-range" type="range" min="0" max="100" step="1" value="${view.position}"
      aria-label="${esc(etichetta || label)}"${attr} data-dm-position>
  </div>`;
}

/* La barra di una copertura: etichetta (solo quando ce n'e' piu' d'una),
 * cursore e percentuale, ciascuno legato alla propria entita'. */
function barMarkup(cover, conEtichetta) {
  const nome = coverKindLabel(cover.kind || "tapparella");
  return `<div class="dm-tapp-bar" data-dm-bar="${esc(cover.entity)}">
    ${conEtichetta ? `<span class="dm-tapp-bar-label">${esc(nome)}</span>` : ""}
    ${trackMarkup(cover, { entity: cover.entity, etichetta: t(`Posizione di ${nome}`, `Position of ${nome}`) })}
    <div class="tapp-pos" data-dm-readout data-dm-entity="${esc(cover.entity)}"></div>
  </div>`;
}

/* Il telo, o i due teli.
 *
 * Una tapparella e' una fascia che scende dall'alto; una tenda sono due teli
 * che si scostano dal centro. Il disegno e' lo stesso serramento — vetro,
 * cornice, luce che entra — e cambia cosa lo copre. */
function panelMarkup(view) {
  /* Il telo della tenda da sole e' uno solo, e il bordo ondulato e' un pezzo a
   * parte: sta sotto il telo, non dentro, perche' deve poter sporgere. */
  if (coverIsAwning(view.kind)) {
    return `<div class="dm-tendasole" data-dm-panel>
      <span class="dm-tendasole-telo"></span>
      <span class="dm-tendasole-bordo"></span>
    </div>`;
  }
  if (!coverIsSideways(view.kind)) return `<div class="tapp-shutter" data-dm-panel>${`<i></i>`.repeat(SLAT_COUNT)}</div>`;
  return `<div class="dm-tenda" data-dm-panel>
    <span class="dm-tenda-telo dm-sinistra"></span>
    <span class="dm-tenda-telo dm-destra"></span>
  </div>`;
}

/* Il menu della posizione (#200).
 *
 * «Non voglio la chiusura completa ma tipo al 95%, per lasciar passare un po'
 * d'aria»: sotto Apri/Ferma/Chiudi c'e' una tendina che le percentuali le fa
 * scegliere li' per li', dal 100% aperta allo 0% chiusa di cinque in cinque —
 * non una sola percentuale fissa decisa in configurazione. La posizione
 * preferita, se c'e', resta nell'elenco segnata con la stella: e' la
 * scorciatoia di casa, non piu' l'unica scelta, e sta nel suo posto in scala
 * anche quando non cade sui passi da cinque. La tendina compare quando almeno
 * una copertura della card accetta `set_cover_position`. */
function presetOptions(preferita) {
  return coverPositionChoices(preferita)
    .map((value) => {
      // La coda passa fuori da esc(): clean() mangerebbe lo spazio davanti.
      const coda = value === 100 ? t("Aperta", "Open") : value === 0 ? t("Chiusa", "Closed") : "";
      const stella = value === preferita ? "⭐ " : "";
      return `<option value="${value}">${stella}${value}%${coda ? ` · ${esc(coda)}` : ""}</option>`;
    })
    .join("");
}

function presetSelectMarkup(view, tutte) {
  if (!tutte.some((cover) => cover.settable)) return "";
  const label = t("Scegli la posizione", "Choose the position");
  return `<span class="tapp-btn dm-tapp-preset">
      <select data-dm-preset aria-label="${esc(label)}" title="${esc(label)}">
        <option value="">↕ ${esc(label)}</option>
        ${presetOptions(view.preset)}
      </select>
    </span>`;
}

/* La card di una finestra che non si comanda.
 *
 * Stesso serramento, stessa intestazione, stessa pastiglia: cambia che sotto
 * non c'e' niente da toccare. Mettere Apri/Ferma/Chiudi su una persiana
 * manuale sarebbe promettere un comando che non arriva da nessuna parte, e
 * lasciare il cursore della posizione sarebbe peggio: direbbe una posizione
 * che nessuno misura.
 */
function windowOnlyCardMarkup(view) {
  return `<article class="tapp-card dm-tapp-card dm-tapp-solo" data-tapp="${esc(view.entity)}" data-dm-shutter-card data-dm-solo-infisso="true">
    <div class="tapp-head dm-tapp-head">
      <span class="dm-tapp-title">
        <span class="tapp-name">${esc(view.name)}</span>
        ${view.room ? `<span class="dm-tapp-room">${esc(view.room)}</span>` : ""}
      </span>
      <span class="tapp-state" data-dm-state></span>
    </div>
    <div class="dm-tapp-stage">
      <div class="tapp-win">
        <div class="tapp-glass"></div>
      </div>
    </div>
    <div class="dm-tapp-spill" aria-hidden="true"></div>
    <p class="dm-tapp-solo-nota">${esc(t("Solo sensore di apertura: nessun comando.", "Opening sensor only: nothing to command."))}</p>
  </article>`;
}

function cardMarkup(view) {
  if (view.soloInfisso) return windowOnlyCardMarkup(view);
  const tutte = coperture(view);
  const multiple = tutte.length > 1;
  return `<article class="tapp-card dm-tapp-card" data-tapp="${esc(view.entity)}" data-dm-cover-kind="${esc(view.kind)}" data-dm-shutter-card${multiple ? ` data-dm-covers="${tutte.length}"` : ""}>
    <div class="tapp-head dm-tapp-head">
      <span class="dm-tapp-title">
        <span class="tapp-name">${esc(view.name)}</span>
        ${view.room ? `<span class="dm-tapp-room">${esc(view.room)}</span>` : ""}
      </span>
      <span class="tapp-state" data-dm-state></span>
    </div>
    <div class="dm-tapp-stage">
      <div class="tapp-win">
        <div class="tapp-glass"></div>
        ${tutte.map((cover) => `<span data-dm-cover="${esc(cover.entity)}" class="dm-tapp-layer">${panelMarkup(cover)}</span>`).join("")}
      </div>
    </div>
    <div class="dm-tapp-spill" aria-hidden="true"></div>
    ${tutte.map((cover) => barMarkup(cover, multiple)).join("")}
    <div class="tapp-ctl">
      <button type="button" class="tapp-btn" data-svc="open_cover" onclick="cdTappCmd(this)" aria-label="${esc(t("Apri", "Open"))}">▲</button>
      <button type="button" class="tapp-btn" data-svc="stop_cover" onclick="cdTappCmd(this)" aria-label="${esc(t("Ferma", "Stop"))}">■</button>
      <button type="button" class="tapp-btn" data-svc="close_cover" onclick="cdTappCmd(this)" aria-label="${esc(t("Chiudi", "Close"))}">▼</button>
      ${presetSelectMarkup(view, tutte)}
    </div>
  </article>`;
}

function gridMarkup(views) {
  const grouped = views.some((view) => view.room);
  let markup = backHomeMarkup() + heroMarkup();
  let lastKey = null;
  views.forEach((view) => {
    if (grouped && groupKey(view) !== lastKey) {
      lastKey = groupKey(view);
      markup += groupMarkup(view, views.filter((other) => groupKey(other) === lastKey).length);
    }
    markup += cardMarkup(view);
  });
  return markup;
}

/* ──────────────────────────────── paint ─────────────────────────────────── */

/* Lo stato della card intera: la pastiglia parla per tutte le coperture.
 *
 * Con la tapparella chiusa e la tenda in apertura la pastiglia diceva
 * «Chiusa», leggendo solo la principale. Il movimento vince su tutto — sta
 * succedendo adesso — poi basta una copertura aperta perche' la finestra non
 * sia «chiusa». */
function statoCarta(view) {
  const tutte = coperture(view);
  const inMoto = tutte.find((cover) => cover.moving);
  if (inMoto) return { stato: statoVisibile(inMoto), testo: statusLabel(inMoto) };
  const aperta = tutte.find((cover) => statoVisibile(cover) === "open");
  if (aperta) return { stato: "open", testo: statusLabel(aperta) };
  return { stato: statoVisibile(view), testo: statusLabel(view) };
}

function syncCard(card, view) {
  card.style.setProperty("--tapp-open", String(view.position / 100));

  const badge = card.querySelector("[data-dm-state]");
  if (badge) {
    /* Il colore viene dalla stessa risposta della scritta.
     *
     * La classe la dava lo stato grezzo mentre la scritta veniva dalla
     * posizione: la pastiglia restava verde da «aperta» con scritto «Chiusa».
     * Meta' correzione e' peggio di nessuna, perche' la contraddizione resta e
     * sembra risolta. */
    const { stato, testo } = statoCarta(view);
    badge.className = `tapp-state tapp-st-${stato}`;
    badge.textContent = testo;
  }

  /* Una finestra senza motori non ha teli, ne' cursori, ne' percentuali: qui
   * non c'e' niente da aggiornare oltre alla pastiglia. */
  if (view.soloInfisso) return;
  for (const cover of coperture(view)) syncCover(card, cover);
}

function dipingiPannello(panel, cover) {
  const moto = `${cover.status === "opening" ? " opening" : ""}${cover.status === "closing" ? " closing" : ""}`;
  const chiuso = coverClosedPercent(cover.position);
  if (coverIsAwning(cover.kind)) {
    // Un'estensione: posizione 0 ritratta (non visibile), 100 estesa (visibile).
    panel.className = `dm-tendasole${moto}`;
    panel.style.height = `${cover.position}%`;
  } else if (coverIsSideways(cover.kind)) {
    panel.className = `dm-tenda${moto}`;
    // I due teli si dividono la parte coperta: meta' per uno, dal centro.
    panel.style.setProperty("--tenda-chiusa", `${chiuso / 2}%`);
  } else {
    panel.className = `tapp-shutter${moto}`;
    panel.style.height = `${chiuso}%`;
  }
}

/* Ogni copertura della card aggiorna il SUO telo, il SUO cursore e la SUA
 * percentuale: e' il selettore per entita' a tenerli separati. */
function syncCover(card, cover) {
  const scope = `[data-dm-entity="${CSS.escape(cover.entity)}"]`;
  /* Il ripiego senza selettore serve solo alla card a copertura singola, dove
   * il markup non porta l'entita'. Su una card composita agganciarsi "al
   * primo che c'e'" scriveva la posizione di una copertura ferma sul cursore
   * di un'altra. */
  const multipla = card.hasAttribute("data-dm-covers");
  const layer = card.querySelector(`[data-dm-cover="${CSS.escape(cover.entity)}"] [data-dm-panel]`);
  const panel = layer || (multipla ? null : card.querySelector("[data-dm-panel]"));
  if (panel) dipingiPannello(panel, cover);

  const readout =
    card.querySelector(`[data-dm-readout]${scope}`) ||
    (multipla ? null : card.querySelector("[data-dm-readout]"));
  if (readout) readout.textContent = cover.hasPosition ? `${cover.position}%` : "";

  const range =
    card.querySelector(`[data-dm-position]${scope}`) ||
    (multipla ? null : card.querySelector("[data-dm-position]"));
  // Never write over a track the user is holding: doc.activeElement covers the
  // keyboard and the in-flight drag, the grab window covers the seconds the
  // motor needs before Home Assistant reports the position that was asked for.
  if (range && range !== doc.activeElement && !state.grabbed.has(cover.entity)) {
    range.value = String(cover.position);
  }
  /* Il riempimento colorato della barra legge --tapp-open: ereditata dalla
   * card, tutte le barre coloravano la posizione della principale. Scritta
   * sulla barra, ognuna colora la sua. */
  const barra = card.querySelector(`[data-dm-bar="${CSS.escape(cover.entity)}"] .dm-tapp-track`);
  if (barra) barra.style.setProperty("--tapp-open", String(cover.position / 100));
}

/* «Apri tutto» deve aprire davvero tutto.
 *
 * Il comando di gruppo lo esegue il runtime, che scorre le righe configurate e
 * manda il servizio a `t.entity`: la sola tapparella. Da quando un infisso ne
 * puo' portare tre, tende e tende da sole restavano ferme mentre le tapparelle
 * si muovevano — e chi guarda vede meta' casa rispondere.
 *
 * Non si riscrive la chiamata al servizio: si riusa la sua, una volta per
 * copertura, passandole un bottone come quello che si preme su una card. Cosi'
 * il servizio, il dominio e la gestione degli errori restano i suoi. */
function insegnaComandoDiGruppo() {
  const originale = root.cdTappCmd;
  if (typeof originale !== "function" || originale.__dmTutteLeCoperture) return false;
  /* Il runtime manda servizi cover.*: a un rele' vanno tradotti. Apri e'
   * turn_on, chiudi e' turn_off, e lo stop per uno switch non esiste. */
  const releSwitch = (entity, service) => {
    try {
      root.dmCallHaService?.("switch", service, { entity_id: entity })?.catch?.(() => {});
    } catch (_error) {}
  };

  /* Il rele' di discesa di una copertura, se la sua riga ne dichiara uno. */
  /* Il rele' di discesa di QUESTA copertura.
   *
   * Una riga puo' averne tre — tapparella, tenda, tenda da sole — e ognuna
   * col suo verso di discesa: cercare solo nella prima casella lasciava le
   * tende a meta' comando, che e' la segnalazione «ho due tende su due Shelly
   * 2PM». */
  const releGiuDi = (entity) => {
    const id = clean(entity);
    if (!id) return "";
    for (const item of configuredCovers()) {
      for (const voce of coverEntries(item)) {
        if (clean(voce.entity) !== id) continue;
        return clean(voce.down);
      }
    }
    return "";
  };

  const comandaSwitch = (entity, servizio) => {
    const comandi = relayCoverCommands(servizio, entity, releGiuDi(entity));
    /* Con un rele' solo, fermare non ha un comando: l'elenco esce vuoto ed e'
     * giusto che il tasto non faccia niente. */
    for (const { entity: bersaglio, service } of comandi) releSwitch(bersaglio, service);
    return true;
  };

  const avvolta = function cdTappCmd(button, ...resto) {
    /* Un bottone la cui destinazione e' un rele' non passa dal runtime: i
     * servizi cover su uno switch cadrebbero nel vuoto. */
    const cartaSingola = button?.closest?.("[data-tapp]");
    const entitaSingola = clean(cartaSingola?.getAttribute?.("data-tapp"));
    if (!button?.getAttribute?.("data-all") && eUnoSwitch(entitaSingola) && !cartaSingola?.hasAttribute?.("data-dm-covers")) {
      return comandaSwitch(entitaSingola, button.getAttribute("data-svc")) ? undefined : originale.call(this, button, ...resto);
    }
    /* Sui bottoni di una card con piu' coperture, "apri" apre la finestra
     * intera: il comando parte una volta per copertura, con la stessa
     * chiamata di servizio del runtime. */
    const cardMulti = button?.closest?.("[data-dm-shutter-card][data-dm-covers]");
    if (cardMulti && !button?.getAttribute?.("data-all")) {
      const servizio = button.getAttribute("data-svc");
      for (const barra of cardMulti.querySelectorAll("[data-dm-bar]")) {
        try {
          const bersaglio = barra.getAttribute("data-dm-bar");
          if (eUnoSwitch(bersaglio)) {
            comandaSwitch(bersaglio, servizio);
            continue;
          }
          const carta = doc.createElement("div");
          carta.setAttribute("data-tapp", bersaglio);
          const finto = doc.createElement("button");
          finto.setAttribute("data-svc", servizio);
          carta.append(finto);
          originale.call(this, finto);
        } catch (_error) {}
      }
      return undefined;
    }
    if (!button?.getAttribute?.("data-all")) return originale.call(this, button, ...resto);
    const servizio = button.getAttribute("data-svc");
    for (const { entity } of configuredCovers().flatMap((item) => coverEntries(item))) {
      try {
        if (eUnoSwitch(entity)) {
          comandaSwitch(entity, servizio);
          continue;
        }
        const carta = doc.createElement("div");
        carta.setAttribute("data-tapp", entity);
        const finto = doc.createElement("button");
        finto.setAttribute("data-svc", servizio);
        carta.append(finto);
        originale.call(this, finto);
      } catch (_error) {}
    }
    return undefined;
  };
  avvolta.__dmTutteLeCoperture = true;
  avvolta.__dmPrevious = originale;
  root.cdTappCmd = avvolta;
  return true;
}

function renderShutters() {
  const grid = doc?.getElementById("tapp-grid");
  if (!grid) return;
  dropLegacyBackHome();
  const views = coverList();

  if (!views.length) {
    state.signature = "";
    grid.innerHTML = `${backHomeMarkup()}<div class="ed-empty dm-tapp-empty">${esc(t("Nessuna tapparella o tenda configurata", "No shutter or curtain configured"))}</div>`;
    return;
  }

  const current = signature(views);
  if (state.signature !== current || !grid.querySelector("[data-dm-shutter-card]")) {
    state.signature = current;
    grid.innerHTML = gridMarkup(views);
  }

  const summary = grid.querySelector("[data-dm-tapp-summary]");
  if (summary) summary.textContent = summaryText(views);

  views.forEach((view) => {
    const card = grid.querySelector(`[data-dm-shutter-card][data-tapp="${CSS.escape(view.entity)}"]`);
    if (card) syncCard(card, view);
  });
}

function paint() {
  state.frame = 0;
  installRenderOwner();
  renderShutters();
}

function schedule() {
  if (state.frame) return;
  state.frame = root.requestAnimationFrame?.(paint) || root.setTimeout?.(paint, 0) || 0;
}

function installRenderOwner() {
  const current = root.renderTapparelle;
  if (typeof current === "function" && current[MARKER]) return;
  function owned(...args) {
    renderShutters(...args);
  }
  owned[MARKER] = true;
  owned.__dmPrevious = current;
  root.renderTapparelle = owned;
}

/* ───────────────────────────── interaction ──────────────────────────────── */

function grab(entity, position) {
  const previous = state.grabbed.get(entity);
  if (previous?.timeout) root.clearTimeout?.(previous.timeout);
  const pending = { position };
  pending.timeout = root.setTimeout?.(() => {
    if (state.grabbed.get(entity) !== pending) return;
    state.grabbed.delete(entity);
    schedule();
  }, GRAB_MS) || 0;
  state.grabbed.set(entity, pending);
}

function cardOf(node) {
  return node?.closest?.("[data-dm-shutter-card]");
}

/**
 * Dragging repaints the card straight away instead of waiting for Home
 * Assistant, so the shutter follows the finger. Only the release sends the
 * command.
 */
function previewPosition(range) {
  const card = cardOf(range);
  if (!card) return;
  const entity = clean(range.dataset.dmEntity) || clean(card.dataset.tapp);
  const position = Math.max(0, Math.min(100, Math.round(Number(range.value) || 0)));
  grab(entity, position);
  const scope = `[data-dm-entity="${CSS.escape(entity)}"]`;
  if (entity === clean(card.dataset.tapp)) card.style.setProperty("--tapp-open", String(position / 100));
  const barra = card.querySelector(`[data-dm-bar="${CSS.escape(entity)}"] .dm-tapp-track`);
  if (barra) barra.style.setProperty("--tapp-open", String(position / 100));
  const multipla = card.hasAttribute("data-dm-covers");
  const panel =
    card.querySelector(`[data-dm-cover="${CSS.escape(entity)}"] [data-dm-panel]`) ||
    (multipla ? null : card.querySelector("[data-dm-panel]"));
  if (panel && !panel.classList.contains("dm-tenda")) panel.style.height = `${100 - position}%`;
  else if (panel) panel.style.setProperty("--tenda-chiusa", `${(100 - position) / 2}%`);
  const readout =
    card.querySelector(`[data-dm-readout]${scope}`) ||
    (multipla ? null : card.querySelector("[data-dm-readout]"));
  if (readout) readout.textContent = `${position}%`;
}

async function commitPosition(range) {
  const card = cardOf(range);
  const entity = clean(range.dataset.dmEntity) || clean(card?.dataset.tapp);
  if (!entity) return;
  const position = Math.max(0, Math.min(100, Math.round(Number(range.value) || 0)));
  grab(entity, position);
  try {
    await root.dmCallHaService?.("cover", "set_cover_position", {
      entity_id: entity,
      position,
    });
  } catch (error) {
    root.console?.error?.("[DashboardModern] shutter position", error);
  }
  schedule();
}

/* La posizione scelta nella tendina passa dagli stessi cursori del
 * trascinamento: stesso grab, stessa anteprima, stessa chiamata. Su una card
 * composita muove ogni copertura che ha un cursore — cioe' ogni copertura che
 * accetta una posizione. Poi la tendina torna alla sua voce d'invito: e' un
 * comando, non lo specchio di dove sta la tapparella. */
function applyPreset(select) {
  const card = cardOf(select);
  const scelta = clean(select.value);
  if (!card || scelta === "") return;
  const position = Math.max(0, Math.min(100, Math.round(Number(scelta) || 0)));
  for (const range of card.querySelectorAll("[data-dm-position][data-dm-entity]")) {
    range.value = String(position);
    previewPosition(range);
    commitPosition(range);
  }
  select.value = "";
}

function installListeners() {
  if (!doc) return;
  doc.addEventListener("input", (event) => {
    const range = event.target?.closest?.("[data-dm-position]");
    if (range) previewPosition(range);
  });
  doc.addEventListener("change", (event) => {
    const range = event.target?.closest?.("[data-dm-position]");
    if (range) commitPosition(range);
    const preset = event.target?.closest?.("[data-dm-preset]");
    if (preset) applyPreset(preset);
  });
  doc.addEventListener("click", (event) => {
    if (event.target?.closest?.("[data-dm-preset]")) return;
    if (event.target?.closest?.("#page-tapparelle .tapp-btn")) root.queueMicrotask?.(schedule);
  });
  for (const eventName of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:persistence-restored",
    "dashboardmodern:config-reset",
    "dashboardmodern:state-changed",
  ]) {
    root.addEventListener?.(eventName, schedule);
  }
}

/* ──────────────────────────────── styles ────────────────────────────────── */

function installStyles() {
  installStyle(STYLE_ID, `
    /* Structure only. Every legacy class this page reuses keeps its skin — and
       its first-paint geometry — in shutter-section.js. */
    html body #page-tapparelle#page-tapparelle .dm-tapp-hero{
      grid-column:1/-1!important;display:flex!important;align-items:stretch!important;gap:10px!important;flex-wrap:wrap!important;
      box-sizing:border-box!important;margin:0 0 4px!important;padding:0!important;
      border:0!important;background:none!important;box-shadow:none!important}
    html body #page-tapparelle#page-tapparelle .dm-tapp-kpi{
      display:flex!important;flex-direction:column!important;justify-content:center!important;gap:1px!important;
      min-width:96px!important;padding:9px 15px!important;border:1px solid var(--tapp-border)!important;
      border-radius:16px!important;background:var(--tapp-surface)!important;box-shadow:var(--tapp-shadow)!important}
    html body #page-tapparelle#page-tapparelle .dm-tapp-kpi span{
      font-size:9px!important;font-weight:800!important;letter-spacing:1.2px!important;
      text-transform:uppercase!important;color:var(--tapp-dim)!important}
    html body #page-tapparelle#page-tapparelle .dm-tapp-kpi b{
      color:var(--tapp-text)!important;font-size:15px!important;font-weight:800!important;letter-spacing:-.2px!important}
    html body #page-tapparelle#page-tapparelle .dm-tapp-bulk{
      display:flex!important;align-items:stretch!important;flex:1 1 240px!important;
      border:1px solid var(--tapp-border)!important;border-radius:16px!important;
      background:var(--tapp-surface)!important;box-shadow:var(--tapp-shadow)!important;overflow:hidden!important}
    html body #page-tapparelle#page-tapparelle .dm-tapp-bulk button{
      flex:1 1 0!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;
      gap:8px!important;padding:11px 16px!important;border:0!important;background:transparent!important;
      box-shadow:none!important;cursor:pointer!important;font:inherit!important;font-size:12px!important;
      font-weight:800!important;letter-spacing:.4px!important;color:var(--tapp-dim)!important;
      transition:color .25s ease,background .25s ease!important}
    html body #page-tapparelle#page-tapparelle .dm-tapp-bulk button:hover{
      color:var(--tapp-text)!important;background:var(--tapp-run-bg)!important}
    html body #page-tapparelle#page-tapparelle .dm-tapp-bulk-div{
      width:1px!important;margin:8px 0!important;background:var(--tapp-border)!important}

    html body #page-tapparelle#page-tapparelle .dm-tapp-group{
      grid-column:1/-1!important;display:flex!important;align-items:center!important;gap:10px!important;
      margin:10px 2px 0!important;padding:0!important;color:var(--tapp-dim)!important;
      font-size:11px!important;font-weight:900!important;letter-spacing:1.5px!important;text-transform:uppercase!important}
    html body #page-tapparelle#page-tapparelle .dm-tapp-group-count{
      flex:0 0 auto!important;padding:2px 9px!important;border:1px solid var(--tapp-pill-line)!important;border-radius:999px!important;
      background:var(--tapp-pill)!important;font-size:10px!important;letter-spacing:.6px!important}
    html body #page-tapparelle#page-tapparelle .dm-tapp-group::after{
      content:""!important;flex:1 1 auto!important;height:1px!important;order:9!important;
      background:linear-gradient(90deg,var(--tapp-border),transparent)!important}

    html body #page-tapparelle#page-tapparelle .dm-tapp-title{display:flex!important;flex-direction:column!important;gap:1px!important;min-width:0!important}
    html body #page-tapparelle#page-tapparelle .dm-tapp-room{
      overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;
      color:var(--tapp-dim)!important;font-size:10px!important;font-weight:900!important;letter-spacing:1px!important;text-transform:uppercase!important}

    /* Nothing shares the row with the window, so it runs the full width of the
       card and the panel closes across the whole opening. */
    html body #page-tapparelle#page-tapparelle .dm-tapp-stage{display:block!important;min-width:0!important}
    html body #page-tapparelle#page-tapparelle .dm-tapp-stage .tapp-win{width:100%!important;min-width:0!important}

    /* The position lives under the window instead of beside it: one rail the
       width of the card, filled from the left by however much light gets in,
       with the readout at its end. */
    html body #page-tapparelle#page-tapparelle .dm-tapp-bar{display:flex!important;align-items:center!important;gap:10px!important;min-width:0!important}
    html body #page-tapparelle#page-tapparelle .dm-tapp-bar>.tapp-pos{flex:0 0 auto!important;align-self:center!important}
    /* Con piu' coperture ogni barra dice di chi e': l'etichetta prende una
     * colonna fissa cosi' i tre cursori restano incolonnati. */
    html body #page-tapparelle#page-tapparelle .dm-tapp-bar-label{flex:0 0 108px!important;min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;font-size:10.5px!important;font-weight:800!important;letter-spacing:.3px!important;text-transform:uppercase!important;color:var(--tapp-dim)!important}
    html body #page-tapparelle#page-tapparelle [data-dm-covers] .dm-tapp-bar+.dm-tapp-bar{margin-top:6px!important}
    /* I teli convivono nella stessa finestra: lo strato e' trasparente al
     * layout, il CSS dei pannelli continua a vederli figli della finestra. */
    html body #page-tapparelle#page-tapparelle .dm-tapp-layer{display:contents!important}
    html body #page-tapparelle#page-tapparelle .dm-tapp-track{
      position:relative!important;flex:1 1 auto!important;box-sizing:border-box!important;height:26px!important;min-width:0!important;
      border:1px solid var(--tapp-pill-line)!important;border-radius:13px!important;overflow:hidden!important;
      background:linear-gradient(90deg,var(--tapp-track-sky) 0 calc(var(--tapp-open,0) * 100%),var(--tapp-slat-base) calc(var(--tapp-open,0) * 100%) 100%)!important;
      box-shadow:inset 0 1px 3px rgba(15,23,42,.28)!important;touch-action:none!important}
    html body #page-tapparelle#page-tapparelle .dm-tapp-track[data-dm-static]{opacity:.55!important}
    html body #page-tapparelle#page-tapparelle .dm-tapp-range{
      position:absolute!important;inset:0!important;box-sizing:border-box!important;
      width:100%!important;height:100%!important;margin:0!important;padding:0!important;border:0!important;
      appearance:none!important;-webkit-appearance:none!important;
      background:transparent!important;cursor:ew-resize!important}
    html body #page-tapparelle#page-tapparelle .dm-tapp-range::-webkit-slider-runnable-track{height:100%;background:transparent;border:0}
    html body #page-tapparelle#page-tapparelle .dm-tapp-range::-webkit-slider-thumb{
      -webkit-appearance:none;width:14px;height:22px;border-radius:5px;border:1px solid rgba(15,23,42,.35);
      background:linear-gradient(180deg,#fdfeff,#c9d3e0);box-shadow:0 2px 5px rgba(15,23,42,.4)}
    html body #page-tapparelle#page-tapparelle .dm-tapp-range::-moz-range-track{height:100%;background:transparent;border:0}
    html body #page-tapparelle#page-tapparelle .dm-tapp-range::-moz-range-thumb{
      width:14px;height:22px;border-radius:5px;border:1px solid rgba(15,23,42,.35);
      background:linear-gradient(180deg,#fdfeff,#c9d3e0);box-shadow:0 2px 5px rgba(15,23,42,.4)}
    html body #page-tapparelle#page-tapparelle .dm-tapp-range:focus-visible{outline:3px solid color-mix(in srgb,var(--tapp-accent) 55%,transparent)!important;outline-offset:2px!important}

    /* Daylight reaching the room, as much of it as the shutter lets through. */
    /* La tendina della posizione prende tutta la riga sotto i tre tasti: e'
       una scelta, non un tasto in piu' che avanza. */
    html body #page-tapparelle#page-tapparelle .dm-tapp-preset{
      grid-column:1/-1!important;position:relative!important;padding:0!important;
      border-color:var(--tapp-border)!important;background:var(--tapp-surface)!important;
      color:var(--tapp-text)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.6)!important}
    html body #page-tapparelle#page-tapparelle .dm-tapp-preset::after{
      content:""!important;position:absolute!important;right:14px!important;top:50%!important;
      width:11px!important;height:7px!important;margin-top:-3px!important;pointer-events:none!important;
      background:currentColor!important;opacity:.55!important;
      clip-path:polygon(0 0,50% 100%,100% 0,86% 0,50% 72%,14% 0)!important}
    html body #page-tapparelle#page-tapparelle .dm-tapp-preset select{
      appearance:none!important;-webkit-appearance:none!important;
      width:100%!important;height:100%!important;box-sizing:border-box!important;
      padding:0 30px 0 14px!important;border:0!important;border-radius:13px!important;
      background:none!important;color:inherit!important;font:inherit!important;
      font-size:13px!important;font-weight:800!important;letter-spacing:.2px!important;
      text-align:left!important;cursor:pointer!important}
    html body #page-tapparelle#page-tapparelle .dm-tapp-preset select:focus-visible{
      outline:3px solid color-mix(in srgb,var(--tapp-accent) 55%,transparent)!important;outline-offset:2px!important}
    html body #page-tapparelle#page-tapparelle .dm-tapp-preset option{
      color:#0f172a!important;font-size:13px!important;font-weight:700!important}

    html body #page-tapparelle#page-tapparelle .dm-tapp-spill{
      height:12px!important;margin:-6px 10px -4px!important;border-radius:0 0 16px 16px!important;
      background:radial-gradient(62% 100% at 50% 0,var(--tapp-spill),transparent 72%)!important;
      opacity:var(--tapp-open,0)!important;pointer-events:none!important}

    /* La finestra senza motori: nessun cursore, nessun tasto, e al loro posto
     * una riga che dice perche' non c'e' niente da toccare. Il vetro resta
     * scoperto — davanti non c'e' nessun telo — e la luce del fuori si vede
     * tutta, come e' giusto per una persiana lasciata aperta a mano. */
    html body #page-tapparelle#page-tapparelle .dm-tapp-solo{--tapp-open:1!important}
    html body #page-tapparelle#page-tapparelle .dm-tapp-solo-nota{
      margin:6px 12px 12px!important;color:var(--secondary-text-color,#94a3b8)!important;
      font-size:10.5px!important;font-weight:700!important;letter-spacing:.4px!important;
      text-align:center!important;line-height:1.35!important}

    html body #page-tapparelle#page-tapparelle .dm-tapp-empty{grid-column:1/-1!important}
    html body #page-tapparelle#page-tapparelle .back-home-btn.dm-tapp-back{grid-column:1/-1!important;justify-self:start!important;margin:0 0 4px!important}

    @media(max-width:560px){
      html body #page-tapparelle#page-tapparelle .dm-tapp-bulk{flex:1 1 100%!important}
      html body #page-tapparelle#page-tapparelle .dm-tapp-bulk button{padding:11px 10px!important}
    }
  `);
}

export function installShutterSceneSection() {
  if (!doc) return;
  installStyles();
  installRenderOwner();
  insegnaComandoDiGruppo();
  if (!state.installed) {
    state.installed = true;
    installListeners();
  }
  schedule();
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", installShutterSceneSection, { once: true });
} else {
  installShutterSceneSection();
}
