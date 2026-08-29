/* La sezione Luci della plancia.
 *
 * Le luci si comandavano solo dal popup "Gestione Luci" sopra la Home: comodo
 * per un tocco al volo, ma una casa con molte stanze ci sta stretta. Questa e'
 * la pagina intera: la stessa configurazione — le luci della scheda Luci
 * dell'editor, le stanze e l'ordinamento che l'utente ha gia' scelto — con in
 * alto il conto delle accese e i due comandi per tutta la casa, come Clima e
 * Tapparelle, e sotto una card per luce con il suo colore vero, il dimmer
 * sulla card e i controlli pieni (colore, bianco, effetti) nella scheda che il
 * popup gia' possiede.
 *
 * La pagina e la sua voce nella barra non esistono nel documento vendorizzato
 * e non si possono aggiungere li': si costruiscono qui, accanto alle altre,
 * con le stesse classi — come fa la sezione del robot aspirapolvere — cosi' la
 * barra e la visibilita' delle sezioni le trattano come tutte le altre.
 *
 * Cosa una luce sa fare lo decide l'entita', mai il dominio: la logica sta in
 * core/light-model.js, i gruppi per stanza in configuredLightGroups, la scheda
 * dei controlli in lights-scene-section. Qui c'e' solo la pagina.
 */
import {
  kelvinToHex,
  lightColorHex,
  lightCommand,
  lightSummary,
  lightView,
  lightsSignature,
  readableInk,
} from "../core/light-model.js";
import { configuredLightGroups } from "./lights-alerts-section.js";
import { openLightControl } from "./lights-scene-section.js";
import { allStates, clean, doc, esc, installStyle, readJson, root, scriviSeCambia, t, wrapFunction } from "./shared.js";

const KEY = "__DASHBOARDMODERN_LIGHTS_PAGE__";
const state = (root[KEY] ||= {
  installed: false,
  frame: 0,
  signature: "",
  holds: new Map(),
  live: 0,
  liveAt: 0,
});

export const LIGHTS_PAGE_ID = "page-luci";
export const LIGHTS_TAB = "luci";

/* Un valore appena impostato vince sul riporto di Home Assistant finche' la
 * transizione della lampada non finisce: senza, il cursore scatterebbe
 * indietro sotto il dito al giro di sincronizzazione successivo. */
const HOLD_MS = 6000;

/* Un trascinamento emette un evento per pixel: alla lampada ne arriva uno ogni
 * tanto mentre il dito si muove, e quello esatto al rilascio. */
const LIVE_MS = 320;

/* ─────────────────────────────── modello ────────────────────────────────── */

function heldValue(id, field) {
  const hold = state.holds.get(`${id}:${field}`);
  if (!hold) return null;
  if (hold.expires <= Date.now()) {
    state.holds.delete(`${id}:${field}`);
    return null;
  }
  return hold.value;
}

function holdValue(id, field, value) {
  state.holds.set(`${id}:${field}`, { value, expires: Date.now() + HOLD_MS });
}

function releaseHolds(id) {
  for (const key of [...state.holds.keys()]) {
    if (key.startsWith(`${id}:`)) state.holds.delete(key);
  }
}

/**
 * I gruppi della pagina: le stanze nell'ordine scelto nella scheda Luci
 * dell'editor, ognuna con le sue viste, piu' le luci che il runtime monitora
 * senza che siano configurate. Una luce la cui entita' manca resta, segnata
 * non disponibile: buttarla via farebbe sembrare cancellata una integrazione
 * rotta.
 */
export function pageLightGroups() {
  const names = readJson("cd_luci", {});
  const states = allStates();
  const seen = new Set();
  const groups = [];
  for (const group of configuredLightGroups()) {
    const views = [];
    for (const id of group.entities) {
      if (seen.has(id)) continue;
      seen.add(id);
      views.push(lightView(id, { name: names[id], state: states[id], room: group.room }));
    }
    if (views.length) groups.push({ room: group.room, views });
  }
  const monitored = root.cdLightList?.();
  const extra = [];
  for (const id of Array.isArray(monitored) ? monitored.map(clean) : []) {
    if (!id.includes(".") || seen.has(id)) continue;
    seen.add(id);
    const room = t("Altre zone", "Other areas");
    extra.push(lightView(id, { name: names[id], state: states[id], room }));
  }
  if (extra.length) groups.push({ room: t("Altre zone", "Other areas"), views: extra });
  return groups;
}

function groupViews(groups) {
  return groups.flatMap((group) => group.views);
}

function cardColor(view) {
  const hex = heldValue(view.id, "hex");
  if (hex && view.on) return hex;
  const kelvin = heldValue(view.id, "kelvin");
  if (kelvin && view.on) return kelvinToHex(kelvin);
  return lightColorHex(view);
}

function cardLevel(view) {
  if (!view.on) return 0;
  const held = heldValue(view.id, "brightness");
  if (held != null) return held;
  return view.brightness == null ? 100 : view.brightness;
}

function stateText(view) {
  if (!view.available) return t("NON DISPONIBILE", "UNAVAILABLE");
  if (!view.on) return t("SPENTA", "OFF");
  const level = cardLevel(view);
  return view.dimmable ? `${t("ACCESA", "ON")} · ${level}%` : t("ACCESA", "ON");
}

/* Una spilla sola, la piu' forte: su una card due righe di pastiglie spingono
 * fuori tutto il resto, e a colpo d'occhio serve il massimo che questa luce sa
 * fare. L'elenco pieno sta nella scheda Luci dell'editor. */
function capabilityBadge(view) {
  if (view.domain !== "light") return { kind: "switch", label: "SWITCH" };
  if (view.colorful) return { kind: "rgb", label: "RGB" };
  if (view.tunable) return { kind: "white", label: t("BIANCO", "WHITE") };
  if (view.dimmable) return { kind: "dim", label: t("DIMMER", "DIMMER") };
  return null;
}

/* ─────────────────────────────── markup ─────────────────────────────────── */

const BULB = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1h6c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2Z"/></svg>`;
const PLUG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-6 6 6 6 0 0 1-6-6V8ZM12 17v5"/></svg>`;
const SLIDERS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2.2"/><circle cx="10" cy="17" r="2.2"/></svg>`;

/** Il conto in alto: quante accese su quante, o tutte spente. */
export function pageSummaryMarkup(summary) {
  if (!summary.on) return `<span>${t("Tutte spente", "All off")}</span>`;
  const word = summary.on === 1 ? t("accesa", "on") : t("accese", "on");
  return `<b>${summary.on}/${summary.total}</b><span>${word}</span>`;
}

/**
 * La fascia in alto, nella forma che Clima e Tapparelle usano: la lettura a
 * sinistra, poi un controllo segmentato con i due comandi per tutta la casa.
 */
export function renderLightsHeroMarkup(views) {
  const summary = lightSummary(views);
  return `<section class="dm-lucip-hero" role="group" aria-label="${esc(t("Luci", "Lights"))}">
    <div class="dm-lucip-kpi">
      <span>${esc(t("Stato", "State"))}</span>
      <span class="dm-lucip-count ${summary.on ? "is-on" : ""}" data-dm-lucip-summary>${pageSummaryMarkup(summary)}</span>
    </div>
    <div class="dm-lucip-bulk">
      <button type="button" data-dm-lucip-all="on">💡 ${esc(t("Accendi tutte", "Turn all on"))}</button>
      <span class="dm-lucip-bulk-div" aria-hidden="true"></span>
      <button type="button" data-dm-lucip-all="off">${esc(t("Spegni tutte", "Turn all off"))}</button>
    </div>
  </section>`;
}

export function pageCardMarkup(view) {
  const badge = capabilityBadge(view);
  const level = cardLevel(view);
  const color = cardColor(view);
  const dimmer = view.dimmable
    ? `<label class="dm-lucip-dim"><span class="dm-lucip-dim-head"><span>${t("Luminosità", "Brightness")}</span><b data-dm-lucip-level>${view.on ? `${level}%` : "—"}</b></span><input class="dm-lucip-range" type="range" min="0" max="100" step="1" value="${level}" data-dm-lucip-brightness aria-label="${t("Luminosità", "Brightness")} ${esc(view.name)}"></label>`
    : "";
  const tools =
    view.colorful || view.tunable || view.effects.length
      ? `<button type="button" class="dm-lucip-tune" data-dm-lucip-open aria-label="${t("Controlli di", "Controls for")} ${esc(view.name)}">${SLIDERS}</button>`
      : "";
  return `<article class="dm-lucip-card ${view.on ? "is-on" : ""}" data-dm-lucip="${esc(view.id)}" data-dm-lucip-available="${view.available}" style="--dm-light-color:${esc(color)};--dm-light-ink:${readableInk(color)};--dm-light-level:${view.on ? Math.max(12, level) : 0}%">
    <span class="dm-lucip-glow" aria-hidden="true"></span>
    <button type="button" class="dm-lucip-main" data-dm-lucip-toggle aria-pressed="${view.on}">
      <span class="dm-lucip-orb" aria-hidden="true">${view.domain === "light" ? BULB : PLUG}</span>
      <span class="dm-lucip-title">
        <strong>${esc(view.name)}</strong>
        <span class="dm-lucip-meta">
          <small class="dm-lucip-state" data-dm-lucip-state>${stateText(view)}</small>
          ${badge ? `<span class="dm-lucip-badge" data-kind="${badge.kind}">${badge.label}</span>` : ""}
        </span>
      </span>
      <span class="dm-lucip-led" aria-hidden="true"></span>
    </button>
    ${dimmer || tools ? `<div class="dm-lucip-tools">${dimmer}${tools}</div>` : ""}
  </article>`;
}

function roomMarkup(group) {
  const summary = lightSummary(group.views);
  const action = summary.on ? "off" : "on";
  const label = summary.on ? t("Spegni", "All off") : t("Accendi", "All on");
  return `<div class="dm-lucip-room" data-dm-lucip-group="${esc(group.room)}" role="heading" aria-level="3">
      <span class="dm-lucip-room-name">${esc(group.room.toUpperCase())}</span>
      <span class="dm-lucip-room-count" data-on="${summary.on > 0}">${summary.on}/${summary.total}</span>
      <button type="button" class="dm-lucip-room-btn" data-dm-lucip-room="${action}" data-dm-lucip-room-name="${esc(group.room)}">${label}</button>
    </div>
    <div class="dm-lucip-grid">${group.views.map((view) => pageCardMarkup(view)).join("")}</div>`;
}

/** L'intera pagina per un insieme di gruppi, asseribile senza un browser. */
export function renderLightsPageMarkup(groups) {
  const views = groupViews(groups);
  if (!views.length) {
    return `<div class="ed-empty dm-lucip-empty">${t(
      "Nessuna luce configurata. Aggiungile dalla scheda Luci dell'editor: accetta sia entità light.* sia switch.*.",
      "No configured lights. Add them from the editor's Lights tab: both light.* and switch.* entities are accepted.",
    )}</div>`;
  }
  return `${renderLightsHeroMarkup(views)}${groups.map((group) => roomMarkup(group)).join("")}`;
}

/* ── la pagina e la sua voce nella barra ─────────────────────────────────── */

/* La pagina va dove stanno le altre pagine: agganciata all'ultima sorella,
 * l'unico posto in cui una pagina e' una pagina. */
function lastPage() {
  const pages = doc?.querySelectorAll?.(".page");
  return pages?.length ? pages[pages.length - 1] : null;
}

export function ensureLightsPage() {
  if (!doc) return null;
  let page = doc.getElementById(LIGHTS_PAGE_ID);
  if (page) return page;
  const sorella = lastPage();
  if (!sorella?.parentElement) return null;
  page = doc.createElement("section");
  page.className = "page";
  page.id = LIGHTS_PAGE_ID;
  page.innerHTML = `<div class="dm-lucip-wrap" id="lucip-wrap"></div>`;
  sorella.after(page);
  return page;
}

export function ensureLightsTab() {
  if (!doc) return null;
  let tab = doc.querySelector(`.tab[data-tab="${LIGHTS_TAB}"]`);
  if (tab) return tab;
  const nav = doc.querySelector("nav.tabs");
  if (!nav) return null;
  /* La voce nasce accanto a Tapparelle, la sezione sorella di casa; dove
   * quella manca si ripiega sulle voci che il documento ha sempre avuto. */
  const before =
    nav.querySelector('.tab[data-tab="tapparelle"]') ||
    nav.querySelector('.tab[data-tab="security"]') ||
    nav.querySelector('.tab[data-tab="config"]');
  tab = doc.createElement("button");
  tab.className = "tab";
  tab.dataset.tab = LIGHTS_TAB;
  tab.id = `tab-${LIGHTS_TAB}`;
  tab.innerHTML = `<span class="icon">💡</span><span class="text">${esc(t("Luci", "Lights"))}</span>`;
  /* Il gestore che il runtime lega alle voci lo lega una volta sola, al
   * caricamento: questa arriva dopo, e il suo tocco se lo deve gestire da
   * se', facendo la stessa identica cosa. */
  tab.addEventListener("click", () => {
    for (const node of doc.querySelectorAll(".tab")) node.classList.remove("active");
    for (const node of doc.querySelectorAll(".page")) node.classList.remove("active");
    tab.classList.add("active");
    ensureLightsPage()?.classList.add("active");
    if (root.navigator?.vibrate) root.navigator.vibrate(5);
    schedule();
  });
  if (before) before.before(tab);
  else nav.append(tab);
  return tab;
}

/* La voce si nasconde come tutte le altre: `cdApplyNavVis` legge `cd_sections`
 * e conosce le voci da una mappa sua. Una voce fuori mappa resterebbe sempre
 * accesa: si insegna alla mappa, invece di avere due padroni sulla voce. */
function teachNavVisibility() {
  const previous = root.cdNavVisMap;
  if (typeof previous !== "function" || previous.__dmLightsPage) return;
  const wrapped = function cdNavVisMap(...args) {
    const map = previous.apply(this, args) || {};
    return { ...map, [LIGHTS_TAB]: LIGHTS_TAB };
  };
  wrapped.__dmLightsPage = true;
  wrapped.__dmPrevious = previous;
  root.cdNavVisMap = wrapped;
}

/* ─────────────────────────────── disegno ────────────────────────────────── */

function wrapNode() {
  return doc?.getElementById("lucip-wrap") || null;
}

function paint() {
  const page = ensureLightsPage();
  const wrap = wrapNode();
  if (!wrap) return false;
  /* Il giro di disegno passa di qui a ogni aggiornamento di stato. Rifare una
   * pagina che nessuno guarda e' lavoro buttato — e su un telefono si sente. */
  if (!page.classList.contains("active")) return true;
  const groups = pageLightGroups();
  const views = groupViews(groups);
  const signature = lightsSignature(views);
  if (state.signature !== signature || !wrap.querySelector("[data-dm-lucip]")) {
    state.signature = signature;
    const scrollTop = wrap.scrollTop;
    wrap.innerHTML = renderLightsPageMarkup(groups);
    wrap.scrollTop = scrollTop;
    return true;
  }
  syncValues(wrap, groups, views);
  return true;
}

/* Riallinea OGNI card della luce del documento, dovunque sia disegnata.
 *
 * La card e' di questo modulo, ma non la disegna solo questo modulo: la pagina
 * Stanze si prende `pageCardMarkup` da qui, perche' una seconda card per la
 * stessa luce vorrebbe dire mantenerne due. Il riallineamento pero' era rimasto
 * chiuso dentro `#lucip-wrap`, e `paint` per giunta si fermava subito se la
 * pagina Luci non era quella aperta. Risultato: nelle Stanze si accendeva la
 * luce, Home Assistant la accendeva davvero, e la card restava «SPENTA»
 * finche' non si passava dalla pagina Luci — «se accendo una luce non cambia
 * stato, non c'e' il refresh».
 *
 * Un padrone solo, quindi, ma con lo sguardo lungo: chi possiede il disegno
 * possiede anche l'aggiornamento, e lo fa per tutte le sue card. Le Stanze non
 * ne tengono una copia — due modi di aggiornare la stessa card sono due
 * padroni, che e' il difetto da cui veniamo. */
export function riallineaLeCardDelleLuci() {
  if (!doc) return 0;
  let quante = 0;
  for (const card of doc.querySelectorAll("[data-dm-lucip]")) {
    const entity = clean(card.getAttribute("data-dm-lucip"));
    const view = entity ? viewOf(entity) : null;
    if (!view) continue;
    syncCard(card, view);
    quante += 1;
  }
  return quante;
}

function syncCard(card, view) {
  card.classList.toggle("is-on", view.on);
  card.dataset.dmLucipAvailable = String(view.available);
  const color = cardColor(view);
  card.style.setProperty("--dm-light-color", color);
  card.style.setProperty("--dm-light-ink", readableInk(color));
  const level = cardLevel(view);
  card.style.setProperty("--dm-light-level", view.on ? `${Math.max(12, level)}%` : "0%");
  card.querySelector("[data-dm-lucip-toggle]")?.setAttribute("aria-pressed", String(view.on));
  const label = card.querySelector("[data-dm-lucip-state]");
  const text = stateText(view);
  if (label && label.textContent !== text) label.textContent = text;
  const range = card.querySelector("[data-dm-lucip-brightness]");
  /* Mai riscrivere un cursore mentre lo si sta trascinando. */
  if (range && doc.activeElement !== range) range.value = String(level);
  const readout = card.querySelector("[data-dm-lucip-level]");
  if (readout) {
    const value = view.on ? `${level}%` : "—";
    if (readout.textContent !== value) readout.textContent = value;
  }
}

/** Solo i valori: il markup resta, cosi' un cursore non rinasce a meta' corsa. */
function syncValues(wrap, groups, views) {
  const byId = new Map(views.map((view) => [view.id, view]));
  for (const card of wrap.querySelectorAll("[data-dm-lucip]")) {
    const view = byId.get(card.dataset.dmLucip);
    if (view) syncCard(card, view);
  }
  const byRoom = new Map(groups.map((group) => [group.room, group.views]));
  for (const heading of wrap.querySelectorAll("[data-dm-lucip-group]")) {
    const summary = lightSummary(byRoom.get(heading.dataset.dmLucipGroup) || []);
    const count = heading.querySelector(".dm-lucip-room-count");
    const text = `${summary.on}/${summary.total}`;
    if (count) {
      if (count.textContent !== text) count.textContent = text;
      count.dataset.on = String(summary.on > 0);
    }
    const button = heading.querySelector("[data-dm-lucip-room]");
    if (button) {
      button.dataset.dmLucipRoom = summary.on ? "off" : "on";
      const label = summary.on ? t("Spegni", "All off") : t("Accendi", "All on");
      if (button.textContent !== label) button.textContent = label;
    }
  }
  const summary = lightSummary(views);
  const counter = wrap.querySelector("[data-dm-lucip-summary]");
  if (counter) {
    const markup = pageSummaryMarkup(summary);
    scriviSeCambia(counter, markup);
    counter.classList.toggle("is-on", summary.on > 0);
  }
}

/* ─────────────────────────────── comandi ────────────────────────────────── */

/* La lettura di una luce, col pegno del tocco davanti allo stato.
 *
 * Il pegno e' quello che l'utente ha appena chiesto e Home Assistant non ha
 * ancora confermato: dura pochi secondi e serve perche' la card si muova
 * all'istante invece di restare ferma per tutto il giro del comando. Scaduto
 * il pegno — o arrivato uno stato che dice il contrario — comanda lo stato,
 * che e' la verita'. Un comando che non arriva a destinazione non lascia
 * quindi una card che mente: torna da sola com'era. */
function viewOf(id) {
  const entity = clean(id);
  if (!entity) return null;
  const names = readJson("cd_luci", {});
  const stato = allStates()[entity];
  const view = lightView(entity, { name: names[entity], state: stato });
  const promesso = heldValue(entity, "power");
  if (promesso == null || !view.available) return view;
  if (promesso === view.on) {
    // lo stato ha confermato: il pegno ha finito il suo mestiere
    releaseHolds(entity);
    return view;
  }
  return { ...view, on: promesso };
}

function callService(command) {
  if (!command) return false;
  try {
    if (typeof root.cdCallServiceJson === "function") {
      root.cdCallServiceJson(command.domain, command.service, command.data);
      return true;
    }
    if (typeof root.dmCallHaService === "function") {
      const result = root.dmCallHaService(command.domain, command.service, command.data);
      result?.catch?.(() => {});
      return true;
    }
    if (typeof root.callService === "function") {
      root.callService(command.domain, command.service, command.data);
      return true;
    }
  } catch (_error) {}
  return false;
}

function send(view, change) {
  callService(lightCommand(view, change));
}

function feedback(pattern = 10) {
  try {
    root.navigator?.vibrate?.(pattern);
  } catch (_error) {}
}

/**
 * Un valore che l'utente sta ancora scegliendo: applicato subito alla card
 * perche' il cursore segua il dito, trattenuto perche' il giro successivo non
 * lo disfi, e inviato a Home Assistant al piu' ogni LIVE_MS.
 */
function live(view, change, field, value, { commit = false } = {}) {
  holdValue(view.id, field, value);
  const card = wrapNode()?.querySelector(`[data-dm-lucip="${CSS.escape(view.id)}"]`);
  if (card) syncCard(card, { ...view, on: value > 0, brightness: value });
  const now = Date.now();
  if (state.live) {
    root.clearTimeout?.(state.live);
    state.live = 0;
  }
  if (commit || now - state.liveAt >= LIVE_MS) {
    state.liveAt = now;
    send(view, change);
  } else {
    state.live = root.setTimeout?.(() => {
      state.live = 0;
      state.liveAt = Date.now();
      send(view, change);
    }, LIVE_MS);
  }
}

/* Il tocco si vede subito, e lo stato vero poi conferma o corregge.
 *
 * Prima si aspettava il giro completo — comando a Home Assistant, stato di
 * ritorno, ridisegno — e in quel mezzo secondo la card non faceva niente: chi
 * tocca non sa se ha toccato. Adesso la card si muove all'istante e il valore
 * si trattiene per il tempo del giro; quando lo stato arriva, se dice il
 * contrario vince lui. Il pegno scade da solo, cosi' un comando che non arriva
 * a destinazione non lascia una card che mente per sempre. */
function toggleLight(id) {
  const view = viewOf(id);
  if (!view) return;
  const acceso = !view.on;
  feedback();
  releaseHolds(view.id);
  holdValue(view.id, "power", acceso);
  send(view, { power: acceso });
  schedule();
}

function setRoomPower(room, on) {
  feedback(15);
  const group = pageLightGroups().find((item) => item.room === room);
  for (const view of group?.views || []) {
    if (view.on === on || !view.available) continue;
    releaseHolds(view.id);
    send(view, { power: on });
  }
  schedule();
}

function setAllPower(on) {
  feedback(15);
  for (const view of groupViews(pageLightGroups())) {
    if (view.on === on || !view.available) continue;
    releaseHolds(view.id);
    send(view, { power: on });
  }
  schedule();
}

/* ─────────────────────────────── ascolto ────────────────────────────────── */

/* La card della luce si comanda ovunque sia disegnata.
 *
 * Il foglio di stile era gia' stato liberato dalla pagina Luci — «adesso la
 * card e' di chi la ospita» — ma il gesto no: qui si pretendeva che il tocco
 * arrivasse da dentro `#lucip-wrap`, e le stesse card disegnate nella pagina
 * Stanze finivano fuori da quel recinto. Si vedeva l'interruttore, si premeva,
 * e non succedeva niente: segnalato esattamente cosi'. Il cursore della
 * luminosita' invece funzionava gia' — il suo gestore guarda la card, non la
 * pagina — ed e' la prova che il recinto era di troppo.
 *
 * I due tasti «tutte» e «tutta la stanza» restano legati alla pagina Luci
 * perche' sono suoi: li' fuori non esistono, e leggere la stanza da un tasto
 * che non c'e' non vuol dire niente. */
function handleClick(event) {
  if (event.target?.closest?.("#lucip-wrap")) {
    const all = event.target?.closest?.("[data-dm-lucip-all]");
    if (all) {
      setAllPower(all.dataset.dmLucipAll === "on");
      return;
    }
    const room = event.target?.closest?.("[data-dm-lucip-room]");
    if (room) {
      setRoomPower(room.dataset.dmLucipRoomName, room.dataset.dmLucipRoom === "on");
      return;
    }
  }
  const card = event.target?.closest?.("[data-dm-lucip]");
  if (!card) return;
  if (event.target?.closest?.("[data-dm-lucip-open]")) {
    openLightControl(card.dataset.dmLucip);
    return;
  }
  if (event.target?.closest?.("[data-dm-lucip-toggle]")) toggleLight(card.dataset.dmLucip);
}

function handleSlide(event, commit) {
  const card = event.target?.closest?.("[data-dm-lucip]");
  if (!card || !event.target?.matches?.("[data-dm-lucip-brightness]")) return;
  const view = viewOf(card.dataset.dmLucip);
  if (!view) return;
  const value = Number(event.target.value);
  if (value === 0) {
    releaseHolds(view.id);
    send(view, { power: false });
    schedule();
    return;
  }
  live(view, { brightnessPct: value }, "brightness", value, { commit });
}

/* ─────────────────────────── installazione ──────────────────────────────── */

function repaint() {
  state.frame = 0;
  ensureLightsPage();
  ensureLightsTab();
  teachNavVisibility();
  paint();
  /* Dopo `paint`, che si ferma se la pagina Luci non e' quella aperta: le card
   * disegnate altrove — le Stanze — vanno riallineate lo stesso. */
  riallineaLeCardDelleLuci();
}

function schedule() {
  if (state.frame) return;
  state.frame = root.requestAnimationFrame?.(repaint) || root.setTimeout?.(repaint, 0) || 0;
}

function installStyles() {
  /* La card della luce non appartiene a una pagina sola.
   *
   * La pagina Stanze mostra le stesse card, costruite da `pageCardMarkup`: se
   * il foglio restasse incatenato a `#page-luci` la' arriverebbero nude. Il
   * `:is()` tiene la stessa specificita' di prima — un id piu' una classe —
   * quindi per la pagina Luci non cambia niente: cambia solo che adesso la
   * card e' di chi la ospita. */
  installStyle(
    "dm-lights-page-style",
    `
      /* La larghezza non se la sceglie questa sezione: sta in --dm-page-room e
       * tutte le pagine la seguono insieme. */
      :is(#page-luci,#page-stanze) .dm-lucip-wrap{box-sizing:border-box;width:100%;max-width:var(--dm-page-room,none);margin:0 auto;padding:0 4px 18px;display:grid;gap:12px}

      /* La fascia in alto, nella forma di Clima e Tapparelle: la lettura a
       * sinistra, un solo controllo segmentato con i due comandi di casa. */
      :is(#page-luci,#page-stanze) .dm-lucip-hero{display:flex;align-items:stretch;gap:10px;flex-wrap:wrap;margin:0 0 4px}
      :is(#page-luci,#page-stanze) .dm-lucip-kpi{display:flex;flex-direction:column;justify-content:center;gap:2px;min-width:110px;padding:10px 17px;border:1px solid var(--divider-color,#dbe4ee);border-radius:18px;background:var(--card-bg,#fff);box-shadow:0 12px 28px -22px rgba(15,23,42,.5)}
      :is(#page-luci,#page-stanze) .dm-lucip-kpi>span{font-size:9px;font-weight:800;letter-spacing:1.3px;text-transform:uppercase;color:var(--secondary-text-color,#64748b)}
      :is(#page-luci,#page-stanze) .dm-lucip-count{display:inline-flex;align-items:baseline;gap:6px;color:var(--text,#0f172a);font-size:17px;font-weight:900;letter-spacing:-.2px}
      :is(#page-luci,#page-stanze) .dm-lucip-count span{font-size:11px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:var(--secondary-text-color,#64748b)}
      :is(#page-luci,#page-stanze) .dm-lucip-count.is-on b{color:#d97706}
      :is(#page-luci,#page-stanze) .dm-lucip-bulk{display:flex;align-items:stretch;flex:1 1 260px;border:1px solid var(--divider-color,#dbe4ee);border-radius:18px;background:var(--card-bg,#fff);box-shadow:0 12px 28px -22px rgba(15,23,42,.5);overflow:hidden}
      :is(#page-luci,#page-stanze) .dm-lucip-bulk button{flex:1 1 0;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 16px;border:0;background:transparent;cursor:pointer;font:inherit;font-size:12px;font-weight:800;letter-spacing:.5px;color:var(--secondary-text-color,#64748b);transition:color .25s ease,background .25s ease}
      :is(#page-luci,#page-stanze) .dm-lucip-bulk button[data-dm-lucip-all="on"]:hover{color:#b45309;background:color-mix(in srgb,#f59e0b 14%,transparent)}
      :is(#page-luci,#page-stanze) .dm-lucip-bulk button[data-dm-lucip-all="off"]:hover{color:var(--text,#0f172a);background:color-mix(in srgb,#64748b 12%,transparent)}
      :is(#page-luci,#page-stanze) .dm-lucip-bulk button:active{transform:scale(.97)}
      :is(#page-luci,#page-stanze) .dm-lucip-bulk-div{width:1px;margin:9px 0;background:var(--divider-color,#dbe4ee)}

      /* L'intestazione di una stanza: nome, conto e comando di gruppo, con la
       * riga che chiude come sulle Tapparelle. */
      :is(#page-luci,#page-stanze) .dm-lucip-room{display:flex;align-items:center;gap:10px;margin:8px 2px 0;color:var(--secondary-text-color,#64748b);font-size:11px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase}
      :is(#page-luci,#page-stanze) .dm-lucip-room-name{flex:0 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      :is(#page-luci,#page-stanze) .dm-lucip-room-count{flex:0 0 auto;padding:2px 9px;border:1px solid var(--divider-color,#dbe4ee);border-radius:999px;font-size:10px;letter-spacing:.6px;transition:color .25s ease,border-color .25s ease,background .25s ease}
      :is(#page-luci,#page-stanze) .dm-lucip-room-count[data-on="true"]{color:#b45309;border-color:color-mix(in srgb,#f59e0b 45%,transparent);background:color-mix(in srgb,#f59e0b 12%,transparent)}
      :is(#page-luci,#page-stanze) .dm-lucip-room::after{content:"";flex:1 1 auto;height:1px;background:linear-gradient(90deg,var(--divider-color,#dbe4ee),transparent)}
      :is(#page-luci,#page-stanze) .dm-lucip-room-btn{order:9;flex:0 0 auto;padding:6px 13px;border:1px solid var(--divider-color,#dbe4ee);border-radius:999px;background:transparent;color:var(--secondary-text-color,#64748b);font-size:10px;font-weight:800;letter-spacing:.7px;text-transform:uppercase;cursor:pointer;transition:color .2s ease,border-color .2s ease}
      :is(#page-luci,#page-stanze) .dm-lucip-room-btn:hover{color:var(--text,#0f172a);border-color:color-mix(in srgb,#f59e0b 45%,var(--divider-color,#dbe4ee))}
      :is(#page-luci,#page-stanze) .dm-lucip-room-btn:active{transform:scale(.96)}

      /* auto-fill lasciava le colonne vuote in piedi: quattro luci su uno
       * schermo largo restavano quattro tessere strette a sinistra e mezzo
       * metro di bianco a destra. Con auto-fit le colonne vuote spariscono e
       * le card si allargano fino al tetto — oltre il quale una luce sola non
       * diventa un cartellone. */
      :is(#page-luci,#page-stanze) .dm-lucip-grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(288px,1fr))}

      /* La card: la superficie, il bagliore, il bordo e il LED leggono il
       * colore della lampada stessa, mai un ambra fisso. */
      /* La card non e' una riga bianca: anche da spenta ha un respiro — un
       * velo di gradiente, l'angolo appena tinto, il binario in fondo — e da
       * accesa tutto prende il colore vero della lampada. */
      :is(#page-luci,#page-stanze) .dm-lucip-card{position:relative;display:grid;align-content:start;gap:0;overflow:hidden;border:1px solid var(--divider-color,#dbe4ee);border-radius:22px;background:radial-gradient(120% 90% at 100% 0%,color-mix(in srgb,#94a3b8 7%,transparent) 0%,transparent 55%),linear-gradient(180deg,var(--card-bg,#fff) 0%,color-mix(in srgb,#94a3b8 4%,var(--card-bg,#fff)) 100%);box-shadow:0 16px 32px -24px rgba(15,23,42,.45);transition:border-color .25s ease,box-shadow .25s ease,transform .15s ease}
      :is(#page-luci,#page-stanze) .dm-lucip-card::after{content:"";position:absolute;left:0;right:0;bottom:0;height:3px;background:linear-gradient(90deg,color-mix(in srgb,var(--dm-light-color,#f59e0b) 55%,transparent),transparent 70%);opacity:.25;transition:opacity .3s ease}
      :is(#page-luci,#page-stanze) .dm-lucip-card.is-on::after{opacity:1}
      :is(#page-luci,#page-stanze) .dm-lucip-card[data-dm-lucip-available="false"]{opacity:.55}
      :is(#page-luci,#page-stanze) .dm-lucip-card.is-on{border-color:color-mix(in srgb,var(--dm-light-color,#f59e0b) 55%,transparent);background:radial-gradient(120% 90% at 100% 0%,color-mix(in srgb,var(--dm-light-color,#f59e0b) 16%,transparent) 0%,transparent 60%),linear-gradient(150deg,color-mix(in srgb,var(--dm-light-color,#f59e0b) 9%,var(--card-bg,#fff)),var(--card-bg,#fff) 58%);box-shadow:0 8px 26px color-mix(in srgb,var(--dm-light-color,#f59e0b) 24%,transparent)}
      :is(#page-luci,#page-stanze) .dm-lucip-glow{position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .3s ease}
      :is(#page-luci,#page-stanze) .dm-lucip-card.is-on .dm-lucip-glow{opacity:1;background:radial-gradient(120% 90% at 14% 0%,color-mix(in srgb,var(--dm-light-color,#f59e0b) 24%,transparent) 0%,transparent 62%)}

      :is(#page-luci,#page-stanze) .dm-lucip-main{position:relative;display:flex;align-items:center;gap:12px;box-sizing:border-box;width:100%;margin:0;padding:14px;border:0;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;-webkit-tap-highlight-color:transparent}
      :is(#page-luci,#page-stanze) .dm-lucip-main:active{transform:scale(.985)}
      :is(#page-luci,#page-stanze) .dm-lucip-orb{display:grid;place-items:center;flex:0 0 auto;width:50px;height:50px;border-radius:17px;background:linear-gradient(160deg,var(--secondary-background-color,#eef3f8),color-mix(in srgb,#94a3b8 14%,var(--secondary-background-color,#eef3f8)));color:var(--secondary-text-color,#94a3b8);box-shadow:inset 0 1px 0 rgba(255,255,255,.7),inset 0 -1px 2px rgba(15,23,42,.06);transition:background .3s ease,color .3s ease,box-shadow .3s ease,border-radius .3s ease}
      :is(#page-luci,#page-stanze) .dm-lucip-orb svg{width:26px;height:26px}
      :is(#page-luci,#page-stanze) .dm-lucip-card.is-on .dm-lucip-orb{border-radius:50%;background:radial-gradient(circle at 38% 32%,color-mix(in srgb,var(--dm-light-color,#f59e0b) 25%,#fff),var(--dm-light-color,#f59e0b));color:var(--dm-light-ink,#0f172a);box-shadow:0 3px 16px color-mix(in srgb,var(--dm-light-color,#f59e0b) 50%,transparent),inset 0 1px 0 rgba(255,255,255,.55)}
      :is(#page-luci,#page-stanze) .dm-lucip-title{display:grid;gap:2px;min-width:0;flex:1 1 auto}
      /* «Lampadario C…» non dice quale lampadario e': il nome ha due righe
       * prima di arrendersi, e i trattini di «Salone - Faretti» sono un punto
       * dove andare a capo, non dove tagliare. */
      :is(#page-luci,#page-stanze) .dm-lucip-title strong{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;font-size:15.5px;font-weight:900;line-height:1.22;letter-spacing:-.2px;overflow-wrap:anywhere}
      /* Stato e pastiglia stanno sotto il nome, non accanto: prima si
         dividevano la riga con lui, e «Lampadario grande del salone» finiva a
         due lettere per riga. Il nome adesso ha tutta la larghezza. */
      :is(#page-luci,#page-stanze) .dm-lucip-meta{display:flex;align-items:center;gap:6px;min-width:0;flex-wrap:wrap}
      :is(#page-luci,#page-stanze) .dm-lucip-state{font-size:9.5px;font-weight:800;letter-spacing:1px;text-transform:uppercase;white-space:nowrap;color:var(--secondary-text-color,#94a3b8)}
      :is(#page-luci,#page-stanze) .dm-lucip-card.is-on .dm-lucip-state{color:color-mix(in srgb,var(--dm-light-color,#f59e0b) 60%,var(--text,#0f172a))}
      :is(#page-luci,#page-stanze) .dm-lucip-badge{flex:0 0 auto;padding:2px 7px;border-radius:999px;font-size:8.5px;font-weight:900;letter-spacing:.6px;background:color-mix(in srgb,var(--dm-light-color,#f59e0b) 16%,transparent);color:color-mix(in srgb,var(--dm-light-color,#f59e0b) 55%,var(--text,#0f172a));border:1px solid color-mix(in srgb,var(--dm-light-color,#f59e0b) 26%,transparent)}
      :is(#page-luci,#page-stanze) .dm-lucip-badge[data-kind="switch"]{background:rgba(148,163,184,.14);color:var(--secondary-text-color,#64748b);border-color:rgba(148,163,184,.3)}
      /* Il puntino grigio diceva poco: al suo posto un interruttore a
       * pillola, con la manopola che scorre e si tinge del colore della
       * lampada. E' decorativo — il gesto resta il tocco sulla card — ma
       * racconta lo stato a colpo d'occhio. */
      :is(#page-luci,#page-stanze) .dm-lucip-led{position:relative;flex:0 0 auto;width:38px;height:22px;border-radius:999px;background:rgba(148,163,184,.28);box-shadow:inset 0 1px 3px rgba(15,23,42,.18);transition:background .25s ease,box-shadow .25s ease}
      :is(#page-luci,#page-stanze) .dm-lucip-led::after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(15,23,42,.35);transition:transform .25s ease,background .25s ease}
      :is(#page-luci,#page-stanze) .dm-lucip-card.is-on .dm-lucip-led{background:color-mix(in srgb,var(--dm-light-color,#f59e0b) 75%,#fff);box-shadow:inset 0 1px 3px color-mix(in srgb,var(--dm-light-color,#f59e0b) 40%,rgba(15,23,42,.2)),0 0 12px color-mix(in srgb,var(--dm-light-color,#f59e0b) 45%,transparent)}
      :is(#page-luci,#page-stanze) .dm-lucip-card.is-on .dm-lucip-led::after{transform:translateX(16px)}

      :is(#page-luci,#page-stanze) .dm-lucip-tools{position:relative;display:flex;align-items:center;gap:10px;padding:0 14px 13px}
      :is(#page-luci,#page-stanze) .dm-lucip-dim{display:grid;flex:1 1 auto;min-width:0;gap:3px}
      :is(#page-luci,#page-stanze) .dm-lucip-dim-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;font-size:8.5px;font-weight:800;letter-spacing:.7px;text-transform:uppercase;color:var(--secondary-text-color,#94a3b8)}
      :is(#page-luci,#page-stanze) .dm-lucip-dim-head b{font-size:11px;letter-spacing:.3px;color:var(--text,#0f172a);font-variant-numeric:tabular-nums}
      :is(#page-luci,#page-stanze) .dm-lucip-card.is-on .dm-lucip-dim-head b{color:color-mix(in srgb,var(--dm-light-color,#f59e0b) 60%,var(--text,#0f172a))}
      :is(#page-luci,#page-stanze) .dm-lucip-tune{display:grid;place-items:center;flex:0 0 auto;width:36px;height:36px;padding:0;border:1px solid var(--divider-color,#dbe4ee);border-radius:12px;background:transparent;color:var(--secondary-text-color,#94a3b8);cursor:pointer}
      :is(#page-luci,#page-stanze) .dm-lucip-card.is-on .dm-lucip-tune{border-color:color-mix(in srgb,var(--dm-light-color,#f59e0b) 40%,transparent);color:color-mix(in srgb,var(--dm-light-color,#f59e0b) 60%,var(--text,#0f172a))}
      :is(#page-luci,#page-stanze) .dm-lucip-tune svg{width:19px;height:19px}
      :is(#page-luci,#page-stanze) .dm-lucip-tune:active{transform:scale(.94)}

      /* Il binario del dimmer: la parte piena e' il colore della lampada. */
      :is(#page-luci,#page-stanze) .dm-lucip-range{box-sizing:border-box;width:100%;height:26px;margin:0;padding:0;border:0;appearance:none;-webkit-appearance:none;background:transparent;cursor:pointer;touch-action:pan-y}
      :is(#page-luci,#page-stanze) .dm-lucip-range::-webkit-slider-runnable-track{height:12px;border-radius:999px;background:linear-gradient(90deg,var(--dm-light-color,#f59e0b) 0 var(--dm-light-level,0%),rgba(148,163,184,.24) var(--dm-light-level,0%) 100%)}
      :is(#page-luci,#page-stanze) .dm-lucip-range::-moz-range-track{height:12px;border-radius:999px;background:linear-gradient(90deg,var(--dm-light-color,#f59e0b) 0 var(--dm-light-level,0%),rgba(148,163,184,.24) var(--dm-light-level,0%) 100%)}
      :is(#page-luci,#page-stanze) .dm-lucip-range::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;margin-top:-4px;border-radius:50%;border:2px solid #fff;background:var(--dm-light-color,#f59e0b);box-shadow:0 2px 6px rgba(15,23,42,.32)}
      :is(#page-luci,#page-stanze) .dm-lucip-range::-moz-range-thumb{width:20px;height:20px;border-radius:50%;border:2px solid #fff;background:var(--dm-light-color,#f59e0b);box-shadow:0 2px 6px rgba(15,23,42,.32)}

      :is(#page-luci,#page-stanze) .dm-lucip-empty{color:var(--secondary-text-color,#94a3b8);font-size:12.5px;font-weight:600;line-height:1.5;padding:18px 4px}

      /* Da schermo largo la pagina cambia respiro, non impianto: la fascia in
       * alto smette di essere due bottoni lunghi mezzo metro, il comando della
       * stanza torna accanto al suo conteggio invece di finire all'altro capo
       * dello schermo, e la card si allarga quanto basta perche' il nome ci
       * stia davvero. */
      @media(min-width:900px){
        /* Da qui in su le tessere non stanno piu' su colonne fisse: crescono
         * fino a riempire la riga e si fermano a 384px, cosi' quattro luci
         * occupano la larghezza intera invece di lasciare mezzo metro di
         * bianco a destra, e una luce sola non diventa un cartellone. */
        :is(#page-luci,#page-stanze) .dm-lucip-grid{display:flex;flex-wrap:wrap}
        :is(#page-luci,#page-stanze) .dm-lucip-card{flex:1 1 306px;max-width:396px}
        :is(#page-luci,#page-stanze) .dm-lucip-bulk{flex:0 1 560px}
        :is(#page-luci,#page-stanze) .dm-lucip-kpi{min-width:132px}
        :is(#page-luci,#page-stanze) .dm-lucip-room{margin-top:14px}
        :is(#page-luci,#page-stanze) .dm-lucip-room-btn{order:0}
        :is(#page-luci,#page-stanze) .dm-lucip-room::after{order:1}
        :is(#page-luci,#page-stanze) .dm-lucip-main{gap:14px;padding:16px}
        :is(#page-luci,#page-stanze) .dm-lucip-orb{width:54px;height:54px;border-radius:18px}
        :is(#page-luci,#page-stanze) .dm-lucip-orb svg{width:28px;height:28px}
        :is(#page-luci,#page-stanze) .dm-lucip-title strong{font-size:15.5px}
        :is(#page-luci,#page-stanze) .dm-lucip-tools{padding:0 16px 15px}
        :is(#page-luci,#page-stanze) .dm-lucip-card:hover{transform:translateY(-2px);box-shadow:0 22px 40px -26px rgba(15,23,42,.55)}
        :is(#page-luci,#page-stanze) .dm-lucip-card.is-on:hover{box-shadow:0 14px 34px color-mix(in srgb,var(--dm-light-color,#f59e0b) 30%,transparent)}
      }
      @media(max-width:560px){
        :is(#page-luci,#page-stanze) .dm-lucip-grid{grid-template-columns:1fr}
        :is(#page-luci,#page-stanze) .dm-lucip-bulk button{padding:11px 10px}
      }
      @media(prefers-reduced-motion:reduce){
        :is(#page-luci,#page-stanze) .dm-lucip-card,:is(#page-luci,#page-stanze) .dm-lucip-glow,:is(#page-luci,#page-stanze) .dm-lucip-orb,:is(#page-luci,#page-stanze) .dm-lucip-led,:is(#page-luci,#page-stanze) .dm-lucip-led::after{transition:none}
      }
    `,
  );
}

export function installLightsPageSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  ensureLightsPage();
  ensureLightsTab();
  teachNavVisibility();
  doc.addEventListener("click", handleClick);
  doc.addEventListener("input", (event) => handleSlide(event, false));
  doc.addEventListener("change", (event) => handleSlide(event, true));
  for (const name of ["render", "cdApplyNavVis"]) wrapFunction(name, "__dmLightsPageSection", schedule);
  for (const event of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:state-changed",
    "dashboardmodern:persistence-restored",
    "dashboardmodern:config-reset",
  ])
    root.addEventListener?.(event, schedule);
  schedule();
}
