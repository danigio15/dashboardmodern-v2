// DM-FIX-20260817D
/* EV section redesign — "Vetrina".
 *
 * Reskins the EV page around the vehicle photo: the hero becomes a framed
 * showcase card with soft corners and a coloured shadow, the battery moves out
 * of the photo into a charge ring, and every block below turns into a floating
 * card on the light surface the rest of the dashboard already uses.
 *
 * Contracts preserved on purpose — the legacy runtime keeps owning behaviour:
 * - the photo is still `#ev-mod-car-img` inside `#lm-hero-card`, so the image
 *   resolver in `ev-section.js` and the idle/plugged swap keep working;
 * - `#ev-mod-batt-fill` keeps its width, its `--batt-col` and its
 *   `low` / `mid` classes: the ring reads that element instead of recomputing
 *   the state of charge, so there is one owner of the battery value;
 * - `#lm-charge-badge` stays inside the hero with `#lm-dot` and
 *   `#lm-stato-txt`, so the inline colours the render loop writes per EVSE
 *   state (grey / amber / cyan / red) still land, and `.lm-charging` on the
 *   hero keeps meaning what it meant;
 * - the mode buttons keep the `.evcc-mode-btn` + `m-btn-*` contract and their
 *   `setEVMode()` calls, and keep the four inline colours already configured in
 *   the markup (#e11d48, #059669, #d97706, #0284c7);
 * - the rows added next to the ring carry the legacy value classes
 *   (`v-ev-pow`, `v-ev-remain`, `v-auto-limite`), which the render loop fills
 *   through `querySelectorAll`, so no value is computed here;
 * - the vehicle picker is still built by `renderVehicleSelector()` in
 *   `ev-section.js` and filled by `applyEvAppearance()` in
 *   `personalization-section.js`: this module only restyles the cards.
 *
 * The page accent stays green; only the target card and the mode buttons take
 * the colour of the active EVCC mode, mirrored onto `#page-ev` as
 * `data-dm-ev-mode` from whichever `.evcc-mode-btn` carries `.active`.
 */
import { evccPresence } from "../core/ev-console.js";
import { allStates, clean, doc, installStyle, root, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_EV_SHOWCASE__";
const STYLE_ID = "dm-ev-showcase-style";
const state = (root[KEY] ||= { installed: false, listeners: false, frame: 0 });

const ARC_RADIUS = 50;
const ARC_LENGTH = 2 * Math.PI * ARC_RADIUS;
const MODE_IDS = Object.freeze(["off", "pv", "minpv", "now"]);

const ICONS = Object.freeze({
  bolt: '<path d="M13.2 2.8 5.6 13.4h5.3l-.9 7.8 8.4-10.6h-5.3l.1-7.8Z"/>',
  clock: '<circle cx="12" cy="12" r="8.6"/><path d="M12 6.9V12l3.4 2"/>',
  target: '<circle cx="12" cy="12" r="8.4"/><circle cx="12" cy="12" r="4.4"/><circle cx="12" cy="12" r="1"/>',
  plug: '<path d="M9 2.8v5.4M15 2.8v5.4M6.6 8.2h10.8v3a5.4 5.4 0 0 1-10.8 0v-3ZM12 16.6v4.6"/>',
  route: '<circle cx="12" cy="12" r="9"/><path d="M15.6 8.4 13 13l-4.6 2.6L11 11l4.6-2.6Z"/>',
  road: '<path d="M6.4 21 8.6 3M17.6 21 15.4 3M12 4.4v3M12 10.6v3M12 16.8v3"/>',
  batt: '<rect x="2.4" y="7.4" width="16.4" height="9.2" rx="2.4"/><path d="M21.6 10.6v2.8M5.6 10.6v2.8M9 10.6v2.8"/>',
  thermo: '<path d="M14 14.4V5.2a2 2 0 1 0-4 0v9.2a3.9 3.9 0 1 0 4 0Z"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.2M12 19.2v2.2M4.2 12H2M22 12h-2.2M6.3 6.3 4.8 4.8M19.2 19.2l-1.5-1.5M17.7 6.3l1.5-1.5M4.8 19.2l1.5-1.5"/>',
  cloudsun:
    '<circle cx="8.4" cy="8" r="3.2"/><path d="M8.4 2.4v1.4M3.6 8H2.2M4.9 4.5 3.9 3.5M12.9 4.5l1-1M11.2 14.6a3.4 3.4 0 0 1 6.6-1 2.9 2.9 0 0 1-.5 5.8h-6.4a2.4 2.4 0 0 1 .3-4.8Z"/>',
  rocket:
    '<path d="M12.6 3.4c3.4 1.4 5.6 4.6 6 8.4l-4.4 4.4-4.4-4.4 2.8-8.4Z"/><path d="M9.8 11.8 5.4 13l2 2M14.2 16.2 13 20.6l-2-2M9 18c-1 1-3 1.6-3 1.6s.6-2 1.6-3"/>',
  stop: '<circle cx="12" cy="12" r="8.6"/><path d="M9 9h6v6H9z"/>',
});

/* Stat tiles are static markup: the emoji is decoration, so it can be swapped
   for a line icon keyed on the entity the tile opens in the history popup. */
const STAT_ICONS = Object.freeze({
  "dm.ev_tensione_wallbox": "plug",
  "dm.ev_km_dall_ultima_ricarica": "route",
  "dm.ev_odometro": "road",
  "dm.ev_prelievo_ac_totale_auto": "batt",
  "dm.ev_temperatura_wallbox": "thermo",
});

const MODE_ICONS = Object.freeze({ off: "stop", pv: "sun", minpv: "cloudsun", now: "rocket" });

function icon(name, size = 20) {
  const body = ICONS[name];
  if (!body) return "";
  return `<svg class="dm-evv-ico" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

/* ── readers ──────────────────────────────────────────────────────────── */

/** Mode currently marked active by the legacy runtime, "" when none is. */
export function evActiveMode(scope = doc) {
  const active = scope?.querySelector?.(".evcc-mode-btn.active");
  const id = clean(active?.id);
  const mode = id.startsWith("m-btn-") ? id.slice(6) : "";
  return MODE_IDS.includes(mode) ? mode : "";
}

/** State of charge, read from the bar the legacy render loop already writes. */
export function batteryLevel(scope = doc) {
  const fill = scope?.getElementById?.("ev-mod-batt-fill");
  const width = Number.parseFloat(clean(fill?.style?.width));
  if (!Number.isFinite(width)) return null;
  return Math.max(0, Math.min(100, width));
}

/** Dash pair drawing `level` percent of the ring. */
export function arcDash(level, circumference = ARC_LENGTH) {
  const value = Number.isFinite(level) ? Math.max(0, Math.min(100, level)) : 0;
  const drawn = (value / 100) * circumference;
  return `${drawn.toFixed(1)} ${(circumference - drawn).toFixed(1)}`;
}

/* ── mount ────────────────────────────────────────────────────────────── */

function powerMarkup() {
  return `
    <div class="dm-evv-gauge">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle class="dm-evv-arc-track" cx="60" cy="60" r="${ARC_RADIUS}" fill="none" stroke-width="9"/>
        <circle class="dm-evv-arc" cx="60" cy="60" r="${ARC_RADIUS}" fill="none" stroke-width="9" stroke-linecap="round" stroke-dasharray="0 ${ARC_LENGTH.toFixed(1)}"/>
      </svg>
    </div>
    <div class="dm-evv-rows">
      <div class="dm-evv-row">${icon("bolt", 17)}<span class="dm-evv-row-lbl">${t("Potenza", "Power")}</span><span class="dm-evv-row-val v-ev-pow">—</span></div>
      <div class="dm-evv-row">${icon("clock", 17)}<span class="dm-evv-row-lbl">${t("Tempo stimato", "Time left")}</span><span class="dm-evv-row-val v-ev-remain">—</span></div>
      <div class="dm-evv-row">${icon("target", 17)}<span class="dm-evv-row-lbl">${t("Autonomia al target", "Range at target")}</span><span class="dm-evv-row-val v-auto-limite">—</span></div>
    </div>`;
}

/**
 * Move the battery block out of the photo and into the charge ring. The node is
 * moved, never copied, so `#ev-mod-batt-fill` keeps its single owner.
 */
function mountPower(hero) {
  const shell = hero.parentElement;
  if (!shell) return null;
  let power = shell.querySelector(":scope > .dm-evv-power");
  if (power) return power;
  power = doc.createElement("div");
  power.className = "dm-evv-power";
  power.innerHTML = powerMarkup();
  hero.insertAdjacentElement("afterend", power);
  const battery = hero.querySelector(":scope > .lm-batt-section");
  if (battery) power.querySelector(".dm-evv-gauge")?.append(battery);
  // Seed each row from the value the page already shows, so the card does not
  // flash "—" while waiting for the next pass of the legacy render loop.
  for (const value of power.querySelectorAll(".dm-evv-row-val")) {
    const twin = [...doc.querySelectorAll(`.${[...value.classList].pop()}`)].find(
      (node) => node !== value && clean(node.textContent),
    );
    if (twin) value.textContent = twin.textContent;
  }
  return power;
}

function mountStatIcons(page) {
  for (const tile of page.querySelectorAll(".lm-stat-card")) {
    const glyph = tile.querySelector(".lm-stat-icon");
    if (!glyph || glyph.dataset.dmEvvIcon) continue;
    const call = clean(tile.getAttribute("onclick"));
    const entity = call.match(/dm\.ev_[a-z0-9_]+/)?.[0] || "";
    const name = STAT_ICONS[entity] || (tile.querySelector(".v-auto-limite") ? "target" : "");
    if (!name) continue;
    glyph.dataset.dmEvvIcon = name;
    glyph.innerHTML = icon(name, 18);
  }
}

function mountModeButtons(page) {
  for (const mode of MODE_IDS) {
    const button = page.querySelector(`#m-btn-${mode}`);
    if (!button || button.dataset.dmEvvMode) continue;
    button.dataset.dmEvvMode = mode;
    const glyph = button.querySelector(".ev-ic");
    if (glyph) glyph.innerHTML = icon(MODE_ICONS[mode], 21);
    const effect = doc.createElement("span");
    effect.className = "dm-evv-fx";
    effect.setAttribute("aria-hidden", "true");
    button.prepend(effect);
  }
}

/**
 * Mark the frame from the photo that actually loaded. `data-ev-image` only says
 * whether a URL is configured, so a broken URL used to leave an empty slab.
 */
/* La foto dell'auto sta in una cornice larga e bassa, e una foto d'auto non ha
 * quelle proporzioni: ritagliandola per riempire — che e' quello che faceva —
 * su uno schermo largo si perdevano il tetto e le ruote, e restava una fascia
 * di fiancata. Adesso la foto ci sta dentro TUTTA, e il vuoto ai lati lo
 * riempie una copia sfocata di se stessa: e' il modo in cui lo fanno i player
 * video, e funziona con qualunque proporzione senza dover sapere quale sia.
 */
function sfondoSfocato(hero, image) {
  let copia = hero.querySelector(":scope > .dm-evv-hero-blur");
  const src = clean(image.getAttribute("src"));
  if (!src) { copia?.remove(); return; }
  if (!copia) {
    copia = doc.createElement("img");
    copia.className = "dm-evv-hero-blur";
    copia.alt = "";
    copia.setAttribute("aria-hidden", "true");
    hero.prepend(copia);
  }
  if (copia.getAttribute("src") !== src) copia.setAttribute("src", src);
}

function syncPhoto(hero) {
  const image = doc.getElementById("ev-mod-car-img");
  if (!image) return;
  sfondoSfocato(hero, image);
  if (!image.dataset.dmEvvWatched) {
    image.dataset.dmEvvWatched = "true";
    for (const eventName of ["load", "error"]) {
      image.addEventListener(eventName, () => scheduleEvShowcase());
    }
  }
  const broken = image.dataset.evFailed === "1" || Boolean(image.dataset.evImageError);
  const loaded = Boolean(clean(image.getAttribute("src"))) && !broken && image.naturalWidth > 0;
  const value = loaded ? "on" : "off";
  if (hero.dataset.dmEvvPhoto !== value) hero.dataset.dmEvvPhoto = value;
  /* La cornice prende la forma della foto.
   *
   * Era alta un numero fisso e larga quanto lo schermo: da telefono combaciava
   * quasi, da desktop diventava un nastro di millequattrocento per
   * duecentonovanta, e dentro una foto sedici a nove ci sta alta al massimo
   * duecentonovanta — cioe' cinquecento pixel di macchina in mezzo a un mare
   * sfocato. Intera, ma minuscola.
   *
   * La proporzione la sa solo la foto, e si sa solo dopo averla caricata:
   * quindi si scrive qui, dove la si e' appena guardata. La cornice ci si
   * adatta e la foto la riempie tutta, senza tagliarne niente.
   *
   * Fra 1,15 e 2,4: una panoramica non deve schiacciare la cornice in una
   * fessura, e un ritratto non deve farne una torre. Fuori da quei due
   * estremi si accetta un po' di margine ai lati — che e' sempre meglio di
   * una pagina sfondata. */
  if (loaded) {
    const forma = image.naturalWidth / image.naturalHeight;
    const dentro = Math.max(1.15, Math.min(2.4, forma));
    const scritta = dentro.toFixed(3);
    if (hero.style.getPropertyValue("--dm-evv-hero-ratio") !== scritta)
      hero.style.setProperty("--dm-evv-hero-ratio", scritta);
  } else hero.style.removeProperty("--dm-evv-hero-ratio");
}

/* ── render ───────────────────────────────────────────────────────────── */

/* Quello che regge la ricarica con evcc, quando evcc non c'e'.
 *
 * Il target di carica con la sua percentuale, l'autonomia calcolata su quel
 * target e i quattro tasti delle modalita' esistono solo per chi la ricarica la
 * governa da evcc. A chi la macchina la attacca e basta restavano davanti un
 * target fermo su "—" e quattro tasti che non fanno niente: adesso ognuno dei
 * tre sparisce insieme all'entita' che lo regge, sulla pagina e nel popup.
 *
 * L'attributo `hidden` e' quello che dice "questo non c'e'": lo capiscono anche
 * chi legge lo schermo ad alta voce e la ricerca dentro la pagina, e chi lo ha
 * nascosto resta uno solo. */
export function paintEvccConsole(scope = doc) {
  if (!scope?.querySelectorAll) return null;
  let resolve = (value) => value;
  try {
    if (typeof root.resolveEntity === "function") resolve = root.resolveEntity;
  } catch (_error) {}
  const presente = evccPresence(allStates(), resolve);
  /* Si scrive solo quando cambia.
   *
   * Questa passata gira a ogni evento di stato, e riscrivere un attributo con
   * il valore che ha gia' e' comunque una modifica al documento: chi guarda le
   * modifiche per rifare il suo pezzo si rimette in coda per niente, a ogni
   * giro. */
  const segna = (node, visibile) => {
    const nascosto = node.hasAttribute("hidden");
    if (visibile && nascosto) node.removeAttribute("hidden");
    else if (!visibile && !nascosto) node.setAttribute("hidden", "hidden");
    const stato = visibile ? "configurato" : "assente";
    if (node.dataset.dmEvcc !== stato) node.dataset.dmEvcc = stato;
  };
  const mostra = (selector, visibile) => {
    for (const node of scope.querySelectorAll(selector)) segna(node, visibile);
  };
  mostra(".lm-target-card,.ev-popup-target", presente.target);
  // L'autonomia al target e' il target detto in chilometri: senza target non e'
  // una riga vuota, e' una riga che non ha piu' senso.
  for (const value of scope.querySelectorAll(".v-auto-limite")) {
    const riga = value.closest(".lm-stat-card,.dm-evv-row,.ev-popup-session-row,.ev-popup-stat");
    if (riga) segna(riga, presente.target);
  }
  mostra(".lm-evcc-card,.ev-popup-modes", presente.mode);
  return presente;
}

export function renderEvShowcase() {
  const page = doc?.getElementById?.("page-ev");
  const hero = doc?.getElementById?.("lm-hero-card");
  if (!page || !hero) return false;
  page.classList.add("dm-evv");
  hero.parentElement?.classList.add("dm-evv-shell");
  const power = mountPower(hero);
  mountStatIcons(page);
  mountModeButtons(page);

  const mode = evActiveMode(doc);
  if (page.dataset.dmEvMode !== mode) page.dataset.dmEvMode = mode;
  syncPhoto(hero);
  paintEvccConsole();

  const arc = power?.querySelector(".dm-evv-arc");
  if (arc) {
    const level = batteryLevel(doc);
    const dash = arcDash(level ?? 0);
    if (arc.getAttribute("stroke-dasharray") !== dash) arc.setAttribute("stroke-dasharray", dash);
    const fill = doc.getElementById("ev-mod-batt-fill");
    const colour = clean(fill?.style?.getPropertyValue("--batt-col")) || "#16a34a";
    if (arc.getAttribute("stroke") !== colour) arc.setAttribute("stroke", colour);
  }
  return true;
}

export function scheduleEvShowcase() {
  if (state.frame) return;
  const run = () => {
    state.frame = 0;
    renderEvShowcase();
  };
  state.frame = root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 0) || 0;
}

function evVisible() {
  return Boolean(doc?.getElementById("page-ev")?.classList.contains("active"));
}

export function installEvShowcaseSection() {
  if (!doc) return;
  installStyle(STYLE_ID, evShowcaseCss());
  if (!state.listeners) {
    state.listeners = true;
    for (const eventName of [
      "dashboardmodern:legacy-ready",
      "dashboardmodern:runtime-ready",
      "pageshow",
    ]) {
      root.addEventListener?.(eventName, scheduleEvShowcase);
    }
    // The mode buttons repaint through the legacy render loop, so the mirrored
    // attribute is refreshed on the same events instead of on a timer.
    root.addEventListener?.("dashboardmodern:state-changed", () => {
      if (evVisible()) scheduleEvShowcase();
    });
    doc.addEventListener(
      "click",
      (event) => {
        if (event.target?.closest?.('.evcc-mode-btn,[data-tab="ev"],[data-page="ev"]')) {
          root.queueMicrotask?.(scheduleEvShowcase);
        }
      },
      true,
    );
  }
  state.installed = true;
  renderEvShowcase();
}

/* ── styles ───────────────────────────────────────────────────────────── */

function evShowcaseCss() {
  return `
#page-ev.dm-evv{
  --evv-surface:var(--card-bg,#fff);
  --evv-surface-2:var(--surface-2,#f8fafc);
  --evv-text:var(--text,#0c1420);
  --evv-dim:var(--text-dim,#64748b);
  --evv-green:#16a34a;--evv-green-rgb:22,163,74;--evv-green-deep:#15803d;
  --evv-r:26px;--evv-r-s:18px;
  --evv-shadow:0 20px 38px -26px rgba(10,26,44,.55),0 2px 6px -3px rgba(10,26,44,.12);
  --evv-shadow-s:0 16px 30px -24px rgba(10,26,44,.6),0 2px 5px -3px rgba(10,26,44,.12);
  --evv-mode:#94a3b8;--evv-mode-rgb:148,163,184;
}
/* the four EVCC colours already configured on the buttons */
#page-ev.dm-evv[data-dm-ev-mode="off"]{--evv-mode:#e11d48;--evv-mode-rgb:225,29,72}
#page-ev.dm-evv[data-dm-ev-mode="pv"]{--evv-mode:#059669;--evv-mode-rgb:5,150,105}
#page-ev.dm-evv[data-dm-ev-mode="minpv"]{--evv-mode:#d97706;--evv-mode-rgb:217,119,6}
#page-ev.dm-evv[data-dm-ev-mode="now"]{--evv-mode:#0284c7;--evv-mode-rgb:2,132,199}
#page-ev.dm-evv .dm-evv-shell{display:grid!important;gap:14px!important}
#page-ev.dm-evv .dm-evv-ico{display:block;flex:0 0 auto}

/* ── vehicle picker ───────────────────────────────────────────────────── */
#page-ev.dm-evv #ev-car-picker.dm-vehicle-profile-host{
  width:auto!important;max-width:1000px!important;margin:0 auto 12px!important;
  display:grid!important;gap:10px!important
}
#page-ev.dm-evv .dm-ev-brand-badge{
  display:flex!important;align-items:center!important;gap:11px!important;
  padding:0 2px!important;color:var(--evv-text)!important
}
#page-ev.dm-evv .dm-ev-brand-badge .dm-car-brand{
  width:44px!important;max-width:44px!important;height:34px!important;
  padding:5px!important;border-radius:12px!important;background:var(--evv-surface-2)!important;
  box-shadow:var(--evv-shadow-s)!important
}
#page-ev.dm-evv .dm-ev-brand-copy{display:grid!important;gap:1px!important;min-width:0!important}
#page-ev.dm-evv .dm-ev-brand-copy b{font-size:16px!important;font-weight:700!important;letter-spacing:-.02em!important}
#page-ev.dm-evv .dm-ev-brand-copy small{font-size:11px!important;font-weight:600!important;color:var(--evv-dim)!important}
#page-ev.dm-evv .dm-vehicle-profile-tabs{
  display:flex!important;flex-wrap:nowrap!important;justify-content:flex-start!important;
  gap:9px!important;overflow-x:auto!important;padding:2px 2px 6px!important;scrollbar-width:none!important
}
#page-ev.dm-evv .dm-vehicle-profile-tabs::-webkit-scrollbar{display:none!important}
#page-ev.dm-evv .dm-vehicle-profile-card{
  grid-template-columns:44px minmax(0,max-content) 18px!important;
  align-items:center!important;gap:10px!important;min-height:0!important;
  padding:8px 12px 8px 8px!important;border:1.5px solid transparent!important;
  border-radius:var(--evv-r-s)!important;background:var(--evv-surface)!important;
  box-shadow:var(--evv-shadow-s)!important;
  transition:transform .25s cubic-bezier(.34,1.4,.5,1),border-color .25s ease,box-shadow .25s ease!important
}
#page-ev.dm-evv .dm-vehicle-profile-card:hover{transform:translateY(-2px)!important}
#page-ev.dm-evv .dm-vehicle-profile-icon{
  width:44px!important;min-width:44px!important;height:34px!important;
  border-radius:11px!important;background:var(--evv-surface-2)!important;place-items:center!important
}
#page-ev.dm-evv .dm-vehicle-profile-icon .dm-car-brand{width:34px!important;max-width:34px!important;height:24px!important;margin:0!important}
#page-ev.dm-evv .dm-vehicle-profile-copy{align-content:center!important;padding:0!important}
#page-ev.dm-evv .dm-vehicle-profile-copy strong{font-size:13px!important;font-weight:700!important;letter-spacing:-.012em!important}
#page-ev.dm-evv .dm-vehicle-profile-copy small{font-size:10.5px!important;font-weight:600!important}
#page-ev.dm-evv .dm-vehicle-profile-card.active{
  border-color:var(--evv-green)!important;background:var(--evv-surface)!important;
  box-shadow:0 14px 24px -14px rgba(var(--evv-green-rgb),.75)!important
}
#page-ev.dm-evv .dm-vehicle-profile-card.active .dm-vehicle-profile-icon{background:rgba(var(--evv-green-rgb),.12)!important}
#page-ev.dm-evv .dm-vehicle-profile-check{width:18px!important;height:18px!important;background:var(--evv-green)!important;font-size:10px!important}

/* ── da schermo largo ─────────────────────────────────────────────────────
 *
 * Due cose cambiano quando c'e' spazio, e sono le due che il piccolo non ha:
 *
 *  - la cornice della foto si alza. Su un telefono e' larga quanto lo schermo
 *    e bassa, e va bene; su un monitor resta larga uguale ma la stessa altezza
 *    la rende una feritoia, e l'auto dentro diventa un francobollo;
 *  - le linguette delle auto si stringono. Sono nate per il pollice — icona
 *    grande, due righe di testo, tanta aria — e in cima a una pagina larga
 *    diventano una fascia che spinge tutto il resto sotto la piega. Col mouse
 *    bastano molto piu' piccole, e in fila con la marca invece che sopra.
 */
@media(min-width:900px){
  #page-ev.dm-evv .lm-hero{height:clamp(300px,26vw,420px)!important}
  #page-ev.dm-evv #ev-car-picker.dm-vehicle-profile-host{
    display:flex!important;flex-direction:row!important;align-items:center!important;
    justify-content:center!important;gap:12px!important;
    width:100%!important;max-width:100%!important;margin:2px auto 8px!important
  }
  #page-ev.dm-evv .dm-ev-brand-badge{margin-right:0!important;flex:0 0 auto!important}
  #page-ev.dm-evv .dm-vehicle-profile-tabs{flex-wrap:nowrap!important;gap:7px!important}
  #page-ev.dm-evv .dm-vehicle-profile-card{
    min-height:0!important;padding:5px 10px 5px 6px!important;border-radius:12px!important;
    grid-template-columns:40px minmax(0,max-content) 16px!important;gap:7px!important;align-items:center!important
  }
  #page-ev.dm-evv .dm-vehicle-profile-icon{width:40px!important;min-width:40px!important;height:24px!important}
  #page-ev.dm-evv .dm-vehicle-profile-icon .dm-car-brand{width:36px!important;max-width:36px!important;height:20px!important}
  #page-ev.dm-evv .dm-vehicle-profile-copy strong{font-size:12px!important;line-height:1.15!important}
  #page-ev.dm-evv .dm-vehicle-profile-copy small{font-size:9px!important;line-height:1.1!important}
  #page-ev.dm-evv .dm-vehicle-profile-check{width:15px!important;height:15px!important;font-size:9px!important}
}

/* ── hero: the photo in its frame ─────────────────────────────────────── */
#page-ev.dm-evv .lm-hero{
  min-height:0!important;height:clamp(212px,44vw,290px)!important;
  border-radius:var(--evv-r)!important;margin-bottom:0!important;
  background:linear-gradient(180deg,#fff,#eaf1f8)!important;
  box-shadow:0 26px 44px -28px rgba(10,26,44,.6),0 2px 6px -3px rgba(10,26,44,.14)!important
}
/* Da schermo largo la cornice della foto e' una card come le altre.
 *
 * Andava da bordo a bordo mentre tutto il resto della pagina sta dentro un
 * margine, e restava alta duecentonovanta: una foto sedici a nove ci entrava
 * larga cinquecento pixel, in mezzo a novecento di sfocato. Adesso prende la
 * larghezza delle altre card e la FORMA della foto — che il giro di disegno
 * scrive dopo averla caricata — cosi' la riempie tutta, intera. */
@media(min-width:900px){
  #page-ev.dm-evv .lm-hero{
    box-sizing:border-box!important;
    /* La larghezza si dice cosi', e non con la misura della pagina: quella
       variabile non e' definita ovunque, e dove manca il minimo fra le due
       non calcola niente — la cornice diventava un francobollo da ottanta
       pixel. */
    width:100%!important;
    /* Non piu' larga di una card, e non piu' alta di mezzo schermo: il tetto
       si mette sulla larghezza, moltiplicando l'altezza massima per la forma
       della foto. Se lo si mettesse sull'altezza, la cornice resterebbe larga
       860 e alta 440 quando la foto ne vuole 484 — cioe' di nuovo due bande
       ai lati. Cosi' invece la cornice E' la foto. */
    max-width:min(860px,calc(min(52vh,440px) * var(--dm-evv-hero-ratio,1.778)))!important;
    margin-inline:auto!important;
    height:auto!important;
    aspect-ratio:var(--dm-evv-hero-ratio,1.778)!important
  }
  /* Senza foto non c'e' una forma da seguire: resta la fascia bassa e quieta
     del segnaposto, che non deve diventare un quadrato vuoto grande cosi'. */
  #page-ev.dm-evv .lm-hero[data-dm-evv-photo="off"]{
    aspect-ratio:auto!important;height:clamp(150px,18vw,196px)!important
  }
}
#page-ev.dm-evv .lm-hero::after,#page-ev.dm-evv .lm-hero.lm-charging::after{
  background:linear-gradient(to bottom,rgba(6,14,22,.16) 0%,rgba(6,14,22,0) 34%,rgba(6,14,22,.12) 100%)!important;
  animation:none!important
}
/* The badge lives inside .lm-hero-top, so the row stays and only the brand
   caption goes: the photo already sits under the brand badge of the picker. */
#page-ev.dm-evv .lm-hero-top{padding:13px 13px 0!important}
#page-ev.dm-evv .lm-brand{display:none!important}
#page-ev.dm-evv .lm-hero-bg{
  object-fit:contain!important;object-position:center center!important;
  z-index:1!important;filter:drop-shadow(0 18px 28px rgba(6,14,22,.35))!important
}
/* La copia sfocata: sta sotto, riempie la cornice e non si guarda. */
#page-ev.dm-evv .dm-evv-hero-blur{
  position:absolute!important;inset:-8%!important;width:116%!important;height:116%!important;
  object-fit:cover!important;z-index:0!important;
  filter:blur(26px) saturate(1.25) brightness(.86)!important;pointer-events:none!important
}
/* the badge keeps the inline colours the render loop writes per EVSE state */
#page-ev.dm-evv .lm-charge-badge{
  opacity:1!important;transform:none!important;padding:7px 13px!important;border-radius:999px!important;
  font-size:11px!important;letter-spacing:.04em!important;backdrop-filter:blur(8px)!important;
  box-shadow:0 8px 20px rgba(6,14,22,.28)!important
}
/* no photo on screen — missing or broken URL: a quiet placeholder, not a slab */
#page-ev.dm-evv .lm-hero[data-dm-evv-photo="off"]{
  height:clamp(150px,30vw,196px)!important;
  background:
    radial-gradient(120% 90% at 50% 118%,rgba(var(--evv-green-rgb),.13) 0%,transparent 62%),
    linear-gradient(180deg,#fff,#eef4f9)!important
}
#page-ev.dm-evv .lm-hero[data-dm-evv-photo="off"]::before{
  content:"";position:absolute;inset:0;z-index:1;opacity:.16;
  background:no-repeat center/auto 42% url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%230c1420' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 13.4 4.9 8.5A3 3 0 0 1 7.7 6.6h8.6a3 3 0 0 1 2.8 1.9l1.9 4.9M3 13.4h18M3 13.4V17h3.2v-3.6M20.8 13.4V17h-3.2v-3.6'/%3E%3C/svg%3E")
}

/* ── charge ring ──────────────────────────────────────────────────────── */
#page-ev.dm-evv .dm-evv-power{
  display:flex;align-items:center;gap:16px;padding:16px;
  background:var(--evv-surface);border-radius:var(--evv-r);box-shadow:var(--evv-shadow)
}
#page-ev.dm-evv .dm-evv-gauge{position:relative;width:116px;height:116px;flex:0 0 116px}
#page-ev.dm-evv .dm-evv-gauge>svg{width:100%;height:100%;transform:rotate(-90deg)}
#page-ev.dm-evv .dm-evv-arc-track{stroke:color-mix(in srgb,var(--evv-text) 10%,transparent)}
#page-ev.dm-evv .dm-evv-arc{transition:stroke-dasharray 1s cubic-bezier(.2,.8,.25,1),stroke .4s ease}
/* the battery block, moved here from inside the photo */
#page-ev.dm-evv .dm-evv-gauge .lm-batt-section{
  position:absolute!important;inset:0!important;z-index:1!important;padding:0!important;
  display:grid!important;place-content:center!important;text-align:center!important
}
#page-ev.dm-evv .dm-evv-gauge .lm-batt-header{
  display:flex!important;flex-direction:column-reverse!important;align-items:center!important;
  justify-content:center!important;gap:2px!important;margin:0!important
}
#page-ev.dm-evv .dm-evv-gauge .lm-batt-lbl{
  font-size:9px!important;font-weight:800!important;letter-spacing:.14em!important;color:var(--evv-dim)!important
}
#page-ev.dm-evv .dm-evv-gauge .lm-batt-soc{
  font-family:inherit!important;font-size:34px!important;font-weight:300!important;
  letter-spacing:-.045em!important;color:var(--evv-text)!important;line-height:1!important
}
#page-ev.dm-evv .dm-evv-gauge .lm-batt-soc small{font-size:15px!important;color:var(--evv-dim)!important;opacity:1!important}
#page-ev.dm-evv .dm-evv-gauge .lm-batt-track{display:none!important}
#page-ev.dm-evv .dm-evv-rows{flex:1;min-width:0;display:grid;gap:10px}
#page-ev.dm-evv .dm-evv-row{display:flex;align-items:center;gap:9px}
#page-ev.dm-evv .dm-evv-row .dm-evv-ico{color:var(--evv-green-deep)}
#page-ev.dm-evv .dm-evv-row-lbl{font-size:11.5px;font-weight:600;color:var(--evv-dim)}
#page-ev.dm-evv .dm-evv-row-val{
  margin-left:auto;font-family:'Oswald',sans-serif;font-size:17px;font-weight:700;
  color:var(--evv-text);white-space:nowrap
}
#page-ev.dm-evv .dm-evv-row:first-child .dm-evv-row-val{color:var(--evv-green-deep)}

/* ── KPI tiles ────────────────────────────────────────────────────────── */
#page-ev.dm-evv .lm-kpi-row{gap:12px!important;margin-bottom:0!important}
#page-ev.dm-evv .lm-kpi-card{
  padding:14px 13px!important;border:0!important;border-radius:var(--evv-r-s)!important;
  background:var(--evv-surface)!important;box-shadow:var(--evv-shadow-s)!important;gap:0!important
}
#page-ev.dm-evv .lm-kpi-card:hover{transform:translateY(-3px)!important;box-shadow:0 22px 34px -22px rgba(10,26,44,.6)!important}
#page-ev.dm-evv .lm-kpi-icon{display:none!important}
#page-ev.dm-evv .lm-kpi-lbl{order:-1!important;font-size:9.5px!important;letter-spacing:.07em!important}
#page-ev.dm-evv .lm-kpi-val{margin-top:9px!important;font-size:22px!important;font-weight:700!important;letter-spacing:-.02em!important}

/* ── session ──────────────────────────────────────────────────────────── */
#page-ev.dm-evv .lm-session-card,
#page-ev.dm-evv .lm-evcc-card{
  padding:16px!important;border:0!important;border-radius:var(--evv-r)!important;
  background:var(--evv-surface)!important;box-shadow:var(--evv-shadow)!important;margin-bottom:0!important
}
#page-ev.dm-evv .lm-session-title,#page-ev.dm-evv .lm-evcc-title{
  font-size:9.5px!important;letter-spacing:.16em!important;margin-bottom:14px!important
}
#page-ev.dm-evv .lm-sess-kpi{
  border:0!important;border-radius:var(--evv-r-s)!important;background:var(--evv-surface-2)!important;padding:13px!important
}
#page-ev.dm-evv .lm-sess-kpi-val{font-size:24px!important}
#page-ev.dm-evv .lm-solar-track{height:6px!important;background:var(--evv-surface-2)!important}
#page-ev.dm-evv .lm-solar-pct{color:var(--evv-green-deep)!important}

/* ── stats ────────────────────────────────────────────────────────────── */
#page-ev.dm-evv .lm-stats-grid{gap:12px!important;margin-bottom:0!important}
#page-ev.dm-evv .lm-stat-card{
  padding:12px!important;border:0!important;border-radius:var(--evv-r-s)!important;
  background:var(--evv-surface)!important;box-shadow:var(--evv-shadow-s)!important
}
#page-ev.dm-evv .lm-stat-card:hover{transform:translateY(-3px)!important;box-shadow:0 22px 34px -22px rgba(10,26,44,.6)!important}
#page-ev.dm-evv .lm-stat-icon{
  width:32px!important;height:32px!important;border:0!important;border-radius:12px!important;
  background:rgba(var(--evv-green-rgb),.13)!important;color:var(--evv-green-deep)!important
}
#page-ev.dm-evv .lm-stat-lbl{font-size:9.5px!important;letter-spacing:.05em!important}
#page-ev.dm-evv .lm-stat-val{font-size:16px!important}

/* Quello che non c'e' non occupa posto: le regole della pagina fissano il
   riquadro a display:flex, che da solo batte il significato dell'attributo. */
#page-ev.dm-evv .lm-target-card[hidden],#page-ev.dm-evv .lm-evcc-card[hidden],
#page-ev.dm-evv .lm-stat-card[hidden],#page-ev.dm-evv .dm-evv-row[hidden],
#ev-popup .ev-popup-target[hidden],#ev-popup .ev-popup-modes[hidden],
#ev-popup .ev-popup-session-row[hidden],#ev-popup .ev-popup-stat[hidden]{display:none!important}

/* ── target: takes the colour of the active mode ──────────────────────── */
#page-ev.dm-evv .lm-target-card{
  padding:15px 16px!important;border:0!important;border-radius:var(--evv-r)!important;margin-bottom:0!important;
  background:linear-gradient(120deg,var(--evv-mode),color-mix(in srgb,var(--evv-mode) 58%,#0b1a2a))!important;
  box-shadow:0 22px 34px -22px rgba(var(--evv-mode-rgb),.95)!important;
  transition:background .55s ease,box-shadow .55s ease!important
}
#page-ev.dm-evv .lm-target-icon{display:none!important}
#page-ev.dm-evv .lm-target-lbl{color:rgba(255,255,255,.82)!important;font-size:10.5px!important}
#page-ev.dm-evv .lm-target-val{color:#fff!important;font-size:20px!important}
#page-ev.dm-evv .lm-target-select{
  min-width:88px!important;border:1px solid rgba(255,255,255,.38)!important;border-radius:13px!important;
  background:rgba(255,255,255,.22)!important;color:#fff!important;padding:9px 12px!important;
  font-size:13px!important;text-align:center!important
}
#page-ev.dm-evv .lm-target-select option{color:#0c1420!important}

/* ── EVCC console ─────────────────────────────────────────────────────── */
#page-ev.dm-evv .lm-evcc-grid{gap:8px!important}
#page-ev.dm-evv .lm-evcc-btn{
  position:relative!important;overflow:hidden!important;
  padding:14px 4px 12px!important;border-radius:var(--evv-r-s)!important;
  border:1.5px solid rgba(0,0,0,0)!important;
  background:var(--btn-bg,var(--evv-surface-2))!important;color:var(--btn-col,var(--evv-dim))!important;
  box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--btn-col,#94a3b8) 32%,transparent)!important
}
#page-ev.dm-evv .lm-evcc-btn .ev-ic{
  display:grid!important;place-items:center!important;font-size:0!important;color:inherit!important
}
#page-ev.dm-evv .lm-evcc-btn .ev-lbl{color:inherit!important;font-size:9.5px!important;letter-spacing:.04em!important}
#page-ev.dm-evv .lm-evcc-btn.active{
  background:var(--btn-col)!important;color:#fff!important;
  box-shadow:0 16px 26px -14px color-mix(in srgb,var(--btn-col) 95%,transparent)!important
}
#page-ev.dm-evv .lm-evcc-btn.active .ev-ic,#page-ev.dm-evv .lm-evcc-btn.active .ev-lbl{color:#fff!important}
#page-ev.dm-evv .lm-evcc-btn.active .ev-ic{filter:none!important}
#page-ev.dm-evv .dm-evv-fx{position:absolute;inset:0;z-index:0;opacity:0;pointer-events:none;transition:opacity .4s ease}
#page-ev.dm-evv .lm-evcc-btn.active .dm-evv-fx{opacity:1}
#page-ev.dm-evv .lm-evcc-btn .ev-ic,#page-ev.dm-evv .lm-evcc-btn .ev-lbl{position:relative;z-index:1}
/* off — a ring that widens and fades: stopped, not broken */
#page-ev.dm-evv #m-btn-off .dm-evv-fx::before{
  content:"";position:absolute;left:50%;top:42%;width:52px;height:52px;margin:-26px 0 0 -26px;
  border-radius:50%;border:2px solid rgba(255,255,255,.6);opacity:0
}
#page-ev.dm-evv #m-btn-off.active .dm-evv-fx::before{animation:dmEvvOffRing 3.4s ease-out infinite}
/* pv — sun rays turning slowly behind the icon */
#page-ev.dm-evv #m-btn-pv .dm-evv-fx::before{
  content:"";position:absolute;left:50%;top:42%;width:104px;height:104px;margin:-52px 0 0 -52px;
  background:repeating-conic-gradient(rgba(255,255,255,.34) 0deg 12deg,transparent 12deg 45deg);
  -webkit-mask-image:radial-gradient(circle,transparent 16px,#000 20px,#000 36px,transparent 42px);
  mask-image:radial-gradient(circle,transparent 16px,#000 20px,#000 36px,transparent 42px)
}
#page-ev.dm-evv #m-btn-pv.active .dm-evv-fx::before{animation:dmEvvSpin 11s linear infinite}
/* minpv — a cloud crossing the sun: the grid minimum backing the solar */
#page-ev.dm-evv #m-btn-minpv .dm-evv-fx::before{
  content:"";position:absolute;top:24%;left:-45%;width:44px;height:14px;border-radius:999px;
  background:rgba(255,255,255,.5);
  box-shadow:11px -6px 0 -2px rgba(255,255,255,.5),-12px -3px 0 -4px rgba(255,255,255,.45);opacity:0
}
#page-ev.dm-evv #m-btn-minpv.active .dm-evv-fx::before{animation:dmEvvCloud 6.5s linear infinite}
/* now — two speed trails */
#page-ev.dm-evv #m-btn-now .dm-evv-fx::before,
#page-ev.dm-evv #m-btn-now .dm-evv-fx::after{
  content:"";position:absolute;left:-32%;width:34px;height:2px;border-radius:2px;opacity:0;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.85),transparent)
}
#page-ev.dm-evv #m-btn-now .dm-evv-fx::before{top:32%}
#page-ev.dm-evv #m-btn-now .dm-evv-fx::after{top:58%}
#page-ev.dm-evv #m-btn-now.active .dm-evv-fx::before{animation:dmEvvZoom 1.5s linear infinite}
#page-ev.dm-evv #m-btn-now.active .dm-evv-fx::after{animation:dmEvvZoom 1.5s linear infinite .45s}

@keyframes dmEvvOffRing{0%{transform:scale(.5);opacity:.85}70%{opacity:0}100%{transform:scale(1.5);opacity:0}}
@keyframes dmEvvSpin{to{transform:rotate(360deg)}}
@keyframes dmEvvCloud{0%{left:-45%;opacity:0}12%{opacity:1}80%{opacity:1}100%{left:115%;opacity:0}}
@keyframes dmEvvZoom{0%{left:-32%;opacity:0}20%{opacity:1}75%{opacity:1}100%{left:104%;opacity:0}}

/* ── responsive ───────────────────────────────────────────────────────── */
@media(max-width:620px){
  #page-ev.dm-evv{--evv-r:22px;--evv-r-s:16px}
  #page-ev.dm-evv .dm-evv-power{gap:13px;padding:14px}
  #page-ev.dm-evv .dm-evv-gauge{width:96px;height:96px;flex:0 0 96px}
  #page-ev.dm-evv .dm-evv-gauge .lm-batt-soc{font-size:28px!important}
  #page-ev.dm-evv .dm-evv-row-lbl{font-size:11px}
  #page-ev.dm-evv .dm-evv-row-val{font-size:15.5px}
  #page-ev.dm-evv .lm-kpi-val{font-size:19px!important}
}

/* ── dark theme ───────────────────────────────────────────────────────── */
[data-theme="dark"] #page-ev.dm-evv{
  --evv-shadow:0 22px 40px -26px rgba(0,0,0,.75),0 2px 6px -3px rgba(0,0,0,.5);
  --evv-shadow-s:0 16px 30px -24px rgba(0,0,0,.7),0 2px 5px -3px rgba(0,0,0,.45);
}
[data-theme="dark"] #page-ev.dm-evv .lm-hero{background:linear-gradient(180deg,#16202c,#0d1620)!important}
[data-theme="dark"] #page-ev.dm-evv .dm-evv-gauge .lm-batt-soc{color:#e9f0f7!important}
[data-theme="dark"] #page-ev.dm-evv .lm-stat-icon{background:rgba(var(--evv-green-rgb),.2)!important;color:#4ade80!important}
[data-theme="dark"] #page-ev.dm-evv .dm-evv-row .dm-evv-ico,
[data-theme="dark"] #page-ev.dm-evv .dm-evv-row:first-child .dm-evv-row-val,
[data-theme="dark"] #page-ev.dm-evv .lm-solar-pct{color:#4ade80!important}

/* ── motion ───────────────────────────────────────────────────────────── */
@media (prefers-reduced-motion:reduce){
  #page-ev.dm-evv *,#page-ev.dm-evv *::before,#page-ev.dm-evv *::after{animation:none!important;transition:none!important}
}
`;
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", installEvShowcaseSection, { once: true });
} else {
  installEvShowcaseSection();
}
