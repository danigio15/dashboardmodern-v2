// DM-FIX-20260817A
/* Appliance showcase section.
 *
 * Replaces the legacy Elettrodomestici page with the reference design:
 * header (title + grid/list toggle), a left
 * sidebar (Panoramica, rooms with counters, state counters, total consumption
 * card with sparkline), filter chips + power sort, and rich cards with the
 * animated artwork, countdown ring, power meter, fridge temperature strip and
 * the "ULTIMO CICLO" footer.
 *
 * Contracts preserved on purpose:
 * - cards keep `.appl-wide-card[data-appliance-id]` inside
 *   `#appl-grid-overview.appl-main-view.active` (e2e + layout sections);
 * - the sidebar total block is `#appl-kpi-grid` with `.glance-card` children,
 *   so the KPI popups (running / instant power) and the daily-energy popup
 *   from appliances-section keep working unchanged;
 * - detail popup, history popup and the config editor are reused via
 *   `apriApplianceDetail`, `apriStorico`, `apriConfigEntita`.
 */
import { applianceArtwork } from "../core/appliance-artwork.js";
import { applianceHeroArtwork } from "../core/appliance-hero-artwork.js";
import {
  applianceCardModel,
  dailyEnergyKwh,
  formatPowerLabel,
  remainingInfo,
} from "../core/appliance-card-view-model.js";
import { createApplianceViewModel } from "../core/appliance-view-model.js";
import { createCycleTracker } from "../core/appliance-cycle-tracker.js";
import { scheduleApplianceNormalization } from "./appliances-section.js";
import { iconGlyph } from "./icon-engine-section.js";
import {
  activeLocale,
  allStates,
  clean,
  doc,
  english,
  esc,
  finiteOrNull,
  installStyle,
  readJson,
  root,
  section,
  t,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_APPLIANCE_SHOWCASE__";
const STYLE_ID = "dm-appliance-showcase-style";
const SPARK_SAMPLE_MS = 20000;
const SPARK_MAX_SAMPLES = 48;
const state = (root[KEY] ||= {
  installed: false,
  listeners: false,
  tracker: null,
  signature: "",
  spark: [],
  sparkTs: 0,
  ui: { filter: "all", room: "all", sort: "power-desc", view: "grid" },
});

const copy = () => ({
  title: t("Elettrodomestici", "Appliances"),
  subtitle: t(
    "Monitora e controlla tutti i tuoi elettrodomestici in tempo reale",
    "Monitor and control all your appliances in real time",
  ),
  gridView: t("Vista griglia", "Grid view"),
  listView: t("Vista elenco", "List view"),
  /* Il gruppo aveva per nome le due voci incollate — «Vista griglia / Vista
   * elenco» — che e' una stringa che nessun catalogo ha e che quindi restava
   * nella lingua del guscio. Ne ha una sua. */
  viewToggle: t("Vista griglia o elenco", "Grid or list view"),
  overview: t("Panoramica", "Overview"),
  rooms: t("Stanze", "Rooms"),
  allRooms: t("Tutte le stanze", "All rooms"),
  noRoom: t("Senza stanza", "No room"),
  stateCap: t("Stato", "State"),
  running: t("In funzione", "Running"),
  standby: "Standby",
  off: t("Spenti", "Off"),
  alarm: t("Allarme", "Alarm"),
  total: t("Consumo totale", "Total consumption"),
  totalHidden: t("Consumo istantaneo", "Instant power"),
  active: t("elettrodomestici attivi", "appliances running"),
  activeHidden: t("In funzione", "Running"),
  today: t("Oggi", "Today"),
  todayHidden: t("Energia giornaliera", "Daily energy"),
  all: t("Tutti", "All"),
  sortPowerDesc: t("Potenza (alta → bassa)", "Power (high → low)"),
  sortPowerAsc: t("Potenza (bassa → alta)", "Power (low → high)"),
  sortName: t("Nome (A–Z)", "Name (A–Z)"),
  sortRoom: t("Stanza", "Room"),
  sortState: t("Stato", "State"),
  power: t("Potenza attuale", "Current power"),
  temperature: t("Temperatura", "Temperature"),
  temperature1: t("Temperatura 1", "Temperature 1"),
  temperature2: t("Temperatura 2", "Temperature 2"),
  left: t("RIMANENTI", "LEFT"),
  lastCycle: t("Ultimo ciclo", "Last cycle"),
  start: t("Avvio", "Start"),
  duration: t("Durata", "Duration"),
  energy: t("Consumo", "Energy"),
  cost: t("Costo", "Cost"),
  history: t("Storico", "History"),
  toggle: t("Accendi/Spegni", "Turn on/off"),
  empty: t(
    "Nessun elettrodomestico configurato. Usa il menu Impostazioni per aggiungerne uno.",
    "No appliance configured. Use the Settings menu to add one.",
  ),
  emptyFilter: t(
    "Nessun elettrodomestico corrisponde ai filtri selezionati.",
    "No appliance matches the selected filters.",
  ),
});

/* ── data helpers ────────────────────────────────────────────────────── */

function devices() {
  const values = section("appliances", readJson("cd_appliances", []));
  return Array.isArray(values) ? values : [];
}

function roomList() {
  const values = section("rooms", readJson("cd_stanze", []));
  if (!Array.isArray(values)) return [];
  return values
    .map((room, index) => ({
      id: String(room?.id || room?.room_id || `room-${index}`),
      name: clean(room?.name),
      icon: clean(room?.icon),
    }))
    .filter((room) => room.name);
}

function globalPriceKwh() {
  const configured = root.cdCfg?.("cd_costo_kwh");
  const direct = finiteOrNull(configured);
  if (direct != null) return direct;
  try {
    return finiteOrNull(root.localStorage?.getItem?.("cd_costo_kwh"));
  } catch (_error) {
    return null;
  }
}

function tracker() {
  if (!state.tracker) {
    state.tracker = createCycleTracker({ storage: root.localStorage });
  }
  return state.tracker;
}

function deviceKey(device, index) {
  return clean(device?.id) || `appl-idx-${index}`;
}

/* ── pure helpers (unit tested) ──────────────────────────────────────── */

export function showcaseCounts(models = []) {
  const counts = {
    total: models.length,
    running: 0,
    standby: 0,
    off: 0,
    alarm: 0,
    watts: 0,
    rooms: new Map(),
    unassigned: 0,
  };
  for (const model of models) {
    if (model.mode === "running") counts.running += 1;
    else if (model.mode === "standby") counts.standby += 1;
    else counts.off += 1;
    if (model.alarm) counts.alarm += 1;
    const watts = finiteOrNull(model.watts);
    if (watts != null) counts.watts += Math.max(0, watts);
    const roomId = model.room?.id ? String(model.room.id) : "";
    if (roomId) counts.rooms.set(roomId, (counts.rooms.get(roomId) || 0) + 1);
    else counts.unassigned += 1;
  }
  return counts;
}

export function filterShowcaseModels(models = [], ui = {}) {
  const filter = ui.filter || "all";
  const room = ui.room || "all";
  const sort = ui.sort || "power-desc";
  const stateRank = { running: 0, standby: 1, off: 2, unavailable: 3 };
  const watts = (model) => finiteOrNull(model.watts) ?? -1;
  return models
    .filter((model) => {
      if (room === "unassigned" && model.room) return false;
      if (room !== "all" && room !== "unassigned" && String(model.room?.id) !== room) return false;
      if (filter === "running") return model.mode === "running";
      if (filter === "standby") return model.mode === "standby";
      if (filter === "off") return model.mode === "off" || model.mode === "unavailable";
      if (filter === "alarm") return model.alarm;
      return true;
    })
    .sort((left, right) => {
      if (sort === "power-asc") return watts(left) - watts(right) || left.name.localeCompare(right.name);
      if (sort === "name") return left.name.localeCompare(right.name);
      if (sort === "room")
        return (
          clean(left.room?.name).localeCompare(clean(right.room?.name)) ||
          left.name.localeCompare(right.name)
        );
      if (sort === "state")
        return (
          (stateRank[left.mode] ?? 9) - (stateRank[right.mode] ?? 9) ||
          watts(right) - watts(left) ||
          left.name.localeCompare(right.name)
        );
      return watts(right) - watts(left) || left.name.localeCompare(right.name);
    });
}

export function sparklinePath(samples = [], width = 100, height = 28) {
  const values = samples.map((value) => Math.max(0, finiteOrNull(value) ?? 0));
  if (values.length < 2) {
    const y = height - 3;
    return { line: `M0 ${y} L${width} ${y}`, area: `M0 ${y} L${width} ${y} L${width} ${height} L0 ${height} Z` };
  }
  const max = Math.max(1, ...values);
  const top = 3;
  const bottom = height - 3;
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = bottom - (value / max) * (bottom - top);
    return [Math.round(x * 100) / 100, Math.round(y * 100) / 100];
  });
  const line = points
    .map(([x, y], index) => `${index ? "L" : "M"}${x} ${y}`)
    .join(" ");
  return {
    line,
    area: `${line} L${width} ${height} L0 ${height} Z`,
  };
}

const ICONS = {
  grid: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6"/></svg>',
  list: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="9" y1="6" x2="20.5" y2="6"/><line x1="9" y1="12" x2="20.5" y2="12"/><line x1="9" y1="18" x2="20.5" y2="18"/><circle cx="4.8" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="4.8" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="4.8" cy="18" r="1.3" fill="currentColor" stroke="none"/></svg>',
  power:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>',
  chart:
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="5" y1="20" x2="5" y2="12"/><line x1="12" y1="20" x2="12" y2="5"/><line x1="19" y1="20" x2="19" y2="9"/></svg>',
  snow: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="3" x2="12" y2="21"/><line x1="4.2" y1="7.5" x2="19.8" y2="16.5"/><line x1="19.8" y1="7.5" x2="4.2" y2="16.5"/></svg>',
  home: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10.5 12 4l8 6.5"/><path d="M6 9.5V20h12V9.5"/></svg>',
};

function heroFxMarkup(model) {
  if (model.mode === "running") {
    if (model.accent === "heat")
      return '<span class="dm-ap-fx dm-ap-fx-heat" aria-hidden="true"></span><span class="dm-ap-fx dm-ap-fx-shimmer" aria-hidden="true"><i></i><i></i><i></i></span>';
    if (model.accent === "water")
      return '<span class="dm-ap-fx dm-ap-fx-bubbles" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span>';
    if (model.artworkType === "dryer")
      return '<span class="dm-ap-fx dm-ap-fx-steam" aria-hidden="true"><i></i><i></i><i></i></span>';
    if (model.accent === "cold")
      return '<span class="dm-ap-fx dm-ap-fx-cold" aria-hidden="true"></span>';
    return '<span class="dm-ap-fx dm-ap-fx-pulse" aria-hidden="true"></span>';
  }
  if (model.continuous && model.mode === "standby")
    return '<span class="dm-ap-fx dm-ap-fx-frost" aria-hidden="true">' + ICONS.snow + "</span>";
  return "";
}

function heroMarkup(model) {
  const visual = model.visual || {};
  if (visual.kind === "image" && clean(visual.value)) {
    return `<img class="dm-ap-img" src="${esc(visual.value)}" alt="${esc(model.name)}" loading="lazy" decoding="async">`;
  }
  const artwork = applianceHeroArtwork(model.artworkType, 170, { freezer: model.freezer });
  return artwork || `<span class="dm-ap-hero-fallback" aria-hidden="true">🔌</span>`;
}

function heroHasImage(model) {
  const visual = model.visual || {};
  return visual.kind === "image" && Boolean(clean(visual.value));
}

function ringMarkup(model, labels) {
  const remaining = model.remaining || {};
  if (model.mode !== "running" || remaining.seconds == null) return "";
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const fraction = remaining.fraction;
  const offset =
    fraction == null ? circumference * 0.35 : circumference * (1 - Math.max(0.02, fraction));
  return `<div class="dm-ap-ring${fraction == null ? " indeterminate" : ""}" role="timer" aria-label="${esc(labels.left)} ${esc(remaining.label)}">
      <svg viewBox="0 0 60 60" aria-hidden="true">
        <circle class="dm-ap-ring-track" cx="30" cy="30" r="${radius}"/>
        <circle class="dm-ap-ring-bar" cx="30" cy="30" r="${radius}" stroke-dasharray="${circumference.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"/>
      </svg>
      <span class="dm-ap-ring-copy"><b>${esc(remaining.label)}</b><small>${esc(labels.left)}</small></span>
    </div>`;
}

function panelMarkup(model, labels) {
  const parts = [];
  const ring = ringMarkup(model, labels);
  const temperature = model.temperature;
  const showPower =
    (!temperature && !model.temperature2) ||
    model.mode === "running" ||
    (finiteOrNull(model.watts) != null && model.watts >= 10);
  const meters = [];
  /* Due strisce quando le temperature sono due: un frigorifero con dentro il
   * congelatore e' due vani, e leggerne uno solo non dice come sta l'altro.
   * Con una sola, l'etichetta resta quella di sempre. */
  const strisciaTemperatura = (lettura, etichetta) => {
    const width = lettura.fraction == null ? 0 : Math.round(lettura.fraction * 100);
    return `<div class="dm-ap-meter dm-ap-meter-temp">
        <div class="dm-ap-meter-row"><span>${esc(etichetta)}</span><strong>${esc(lettura.label)}</strong></div>
        <div class="dm-ap-bar cold"><span class="dm-ap-bar-ic">${ICONS.snow}</span><i style="width:${width}%"></i></div>
      </div>`;
  };
  if (temperature)
    meters.push(
      strisciaTemperatura(temperature, model.temperature2 ? labels.temperature1 : labels.temperature),
    );
  if (model.temperature2) meters.push(strisciaTemperatura(model.temperature2, labels.temperature2));
  if (showPower) {
    const width = Math.round((model.power?.fraction || 0) * 100);
    meters.push(`<div class="dm-ap-meter">
        <div class="dm-ap-meter-row"><span>${esc(labels.power)}</span><strong>${esc(model.power.label)}</strong></div>
        <div class="dm-ap-bar${model.mode === "running" ? " run" : ""}"><i style="width:${width}%"></i></div>
      </div>`);
  }
  return `<div class="dm-ap-panel${ring ? " has-ring" : ""}">${ring}<div class="dm-ap-meters">${meters.join("")}</div></div>`;
}

function cycleMarkup(model, labels) {
  const cycle = model.cycle || {};
  const cell = (label, value) =>
    `<div class="dm-ap-cycle-cell"><small>${esc(label)}</small><b>${esc(value || "—")}</b></div>`;
  return `<div class="dm-ap-cycle${cycle.live ? " live" : ""}">
      <span class="dm-ap-cycle-cap">${esc(labels.lastCycle)}</span>
      <div class="dm-ap-cycle-grid">
        ${cell(labels.start, cycle.startLabel)}
        ${cell(labels.duration, cycle.durationLabel)}
        ${cell(labels.energy, cycle.energyLabel)}
        ${cell(labels.cost, cycle.costLabel)}
      </div>
    </div>`;
}

export function buildCardMarkup(model, labels = copy()) {
  const badgeClass =
    model.mode === "running"
      ? "run"
      : model.mode === "standby"
        ? "standby"
        : model.mode === "unavailable"
          ? "unavailable"
          : "off";
  const historyEntity = clean(model.historyEntity || model.powerEntity);
  const roomName = clean(model.room?.name);
  const controls = `<span class="dm-ap-tools">
      ${
        model.action?.visible
          ? `<button type="button" class="dm-ap-tool dm-ap-power${model.action.pressed ? " on" : ""}" data-dm-power-toggle="true" data-entity="${esc(model.action.entity)}" aria-pressed="${model.action.pressed ? "true" : "false"}" title="${esc(labels.toggle)}">${ICONS.power}</button>`
          : ""
      }
      ${
        historyEntity
          ? `<button type="button" class="dm-ap-tool dm-ap-history" data-dm-history="${esc(historyEntity)}" data-dm-history-name="${esc(model.name)}" title="${esc(labels.history)}" aria-label="${esc(labels.history)}">${ICONS.chart}</button>`
          : `<button type="button" class="dm-ap-tool dm-ap-history" disabled aria-disabled="true" title="${esc(labels.history)}" aria-label="${esc(labels.history)}">${ICONS.chart}</button>`
      }
    </span>`;
  return `<article class="appl-wide-card dm-ap-card dm-ap-mech is-${badgeClass} acc-${esc(model.accent)}${model.alarm ? " has-alarm" : ""}" data-appliance-id="${esc(model.id)}" data-idx="${model.index}" data-mode="${esc(model.mode)}" data-art="${esc(model.artworkType)}" role="button" tabindex="0" aria-label="${esc(model.name)} — ${esc(model.label)}">
    <div class="dm-ap-top">
      <span class="dm-ap-chip" aria-hidden="true">${applianceArtwork(model.artworkType, 30) || "🔌"}</span>
      <span class="dm-ap-headings"><span class="dm-ap-name appl-wide-name">${esc(model.name)}</span>${roomName ? `<span class="dm-ap-room">${esc(roomName)}</span>` : ""}</span>
      <span class="dm-ap-badge ${badgeClass}"><i class="dm-ap-dot"></i>${esc(model.label)}</span>
      ${controls}
    </div>
    <div class="dm-ap-hero${heroHasImage(model) ? " has-image" : ""}">${heroMarkup(model)}${heroHasImage(model) ? heroFxMarkup(model) : ""}</div>
    ${panelMarkup(model, labels)}
    ${cycleMarkup(model, labels)}
  </article>`;
}

/* Il disegno che si muove deve restare lo stesso elemento.
 *
 * La scheda si ridisegna a ogni cambio di stato — e la potenza di un
 * elettrodomestico acceso cambia di continuo — e finora la si buttava via
 * intera per rifarla da capo. Il disegno dentro ne usciva ogni volta nuovo, e
 * un'animazione su un elemento appena nato riparte da zero: il cestello non
 * arrivava mai a fare un giro, i getti non finivano la loro passata. A occhio
 * l'illustrazione sembrava semplicemente ferma, ed e' quello che si vedeva
 * sulla plancia vera.
 *
 * Qui la scheda vecchia resta al suo posto e si prende i pezzi nuovi, tranne il
 * disegno: quello non viene mai staccato dalla pagina, e la sua animazione
 * continua da dove era. Se cambia il disegno — un altro tipo, un'altra foto —
 * non c'e' niente da salvare e si rifa' la scheda intera, come prima. */
function stessoDisegno(vecchio, nuovo) {
  if (!vecchio || !nuovo) return false;
  const vecchiaArte = vecchio.querySelector(":scope > .dm-hero-art");
  const nuovaArte = nuovo.querySelector(":scope > .dm-hero-art");
  if (vecchiaArte && nuovaArte) return vecchiaArte.dataset.dmHero === nuovaArte.dataset.dmHero;
  const vecchiaFoto = vecchio.querySelector(":scope > img.dm-ap-img");
  const nuovaFoto = nuovo.querySelector(":scope > img.dm-ap-img");
  if (vecchiaFoto && nuovaFoto) {
    return vecchiaFoto.getAttribute("src") === nuovaFoto.getAttribute("src");
  }
  return false;
}

function aggiornaTenendoIlDisegno(vecchia, nuova) {
  const vecchioHero = vecchia.querySelector(":scope > .dm-ap-hero");
  const nuovoHero = nuova.querySelector(":scope > .dm-ap-hero");
  if (!stessoDisegno(vecchioHero, nuovoHero)) return false;

  // Gli attributi della scheda dicono in che stato e': la classe .is-run e'
  // quella che accende il movimento, e va aggiornata come tutto il resto.
  for (const attributo of [...vecchia.attributes]) {
    if (!nuova.hasAttribute(attributo.name)) vecchia.removeAttribute(attributo.name);
  }
  for (const attributo of [...nuova.attributes]) {
    if (vecchia.getAttribute(attributo.name) !== attributo.value) {
      vecchia.setAttribute(attributo.name, attributo.value);
    }
  }
  // Il contorno del disegno puo' cambiare (la cornice della foto): quello si
  // rifa', il disegno dentro no.
  for (const attributo of [...nuovoHero.attributes]) {
    if (vecchioHero.getAttribute(attributo.name) !== attributo.value) {
      vecchioHero.setAttribute(attributo.name, attributo.value);
    }
  }

  // Tutto il resto della scheda arriva nuovo, nell'ordine in cui e' scritto,
  // e il disegno resta dov'e' senza essere mai staccato.
  for (const figlio of [...vecchia.children]) {
    if (figlio !== vecchioHero) figlio.remove();
  }
  let dopo = null;
  for (const figlio of [...nuova.children]) {
    if (figlio.classList.contains("dm-ap-hero")) {
      dopo = vecchioHero;
      continue;
    }
    if (dopo) dopo.after(figlio);
    else vecchioHero.before(figlio);
    dopo = figlio;
  }
  return true;
}

function cardSignature(model, view) {
  return [
    model.id,
    model.index,
    view,
    model.artworkType,
    model.name,
    model.mode,
    model.label,
    Math.round((finiteOrNull(model.watts) ?? -1) * 10),
    model.remaining?.label,
    Math.round((model.remaining?.fraction ?? -1) * 100),
    model.temperature?.label,
    model.power?.label,
    Math.round((model.power?.fraction || 0) * 100),
    model.cycle?.startLabel,
    model.cycle?.durationLabel,
    model.cycle?.energyLabel,
    model.cycle?.costLabel,
    model.alarm ? 1 : 0,
    model.action?.pressed ? 1 : 0,
    clean(model.visual?.value),
    model.room?.name,
  ].join("|");
}

/* ── skeleton ────────────────────────────────────────────────────────── */

function skeletonMarkup(labels) {
  return `<div class="dm-appl-shell" data-view="${esc(state.ui.view)}">
    <div class="dm-appl-head">
      <div class="dm-appl-brand">
        <span class="dm-appl-brand-ic" aria-hidden="true">${ICONS.home}</span>
        <div class="dm-appl-brand-copy">
          <h2>${esc(labels.title)}</h2>
          <p>${esc(labels.subtitle)}</p>
        </div>
      </div>
      <div class="dm-appl-head-actions">
        <div class="dm-appl-viewtoggle" role="group" aria-label="${esc(labels.viewToggle)}">
          <button type="button" data-dm-view="grid" class="${state.ui.view === "grid" ? "active" : ""}" aria-label="${esc(labels.gridView)}">${ICONS.grid}</button>
          <button type="button" data-dm-view="list" class="${state.ui.view === "list" ? "active" : ""}" aria-label="${esc(labels.listView)}">${ICONS.list}</button>
        </div>
      </div>
    </div>
    <div class="dm-appl-layout">
      <aside class="dm-appl-side">
        <button type="button" class="dm-side-overview" data-dm-side-overview><span aria-hidden="true">${ICONS.home}</span>${esc(labels.overview)}</button>
        <div class="dm-side-cap">${esc(labels.rooms)}</div>
        <nav class="dm-side-rooms" data-dm-rooms></nav>
        <div class="dm-side-cap">${esc(labels.stateCap)}</div>
        <nav class="dm-side-states" data-dm-states></nav>
        <div id="appl-kpi-grid" class="dm-side-total">
          <div class="glance-card dm-total-power">
            <span class="g-name">${esc(labels.total)}<span class="dm-sr-only"> · ${esc(labels.totalHidden)}</span></span>
            <span class="g-val" data-dm-total-watts>0 W</span>
          </div>
          <div class="glance-card dm-total-running">
            <span class="g-val" data-dm-total-running>0</span>
            <span class="g-name">${esc(labels.active)}<span class="dm-sr-only"> · ${esc(labels.activeHidden)}</span></span>
          </div>
          <svg class="dm-side-spark" data-dm-spark viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="dm-appl-spark-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#0ea5e9" stop-opacity="0.35"/>
                <stop offset="1" stop-color="#0ea5e9" stop-opacity="0.02"/>
              </linearGradient>
            </defs>
            <path class="dm-spark-area" d="" fill="url(#dm-appl-spark-fill)"/>
            <path class="dm-spark-line" d="" fill="none"/>
          </svg>
          <div class="glance-card dm-total-daily">
            <span class="g-name">${esc(labels.today)}<span class="dm-sr-only"> · ${esc(labels.todayHidden)}</span></span>
            <span class="g-val">— kWh</span>
          </div>
        </div>
      </aside>
      <main class="dm-appl-main">
        <div class="dm-appl-toolbar">
          <div class="dm-appl-chips" data-dm-chips>
            <button type="button" data-dm-filter="all">${esc(labels.all)}</button>
            <button type="button" data-dm-filter="running"><i class="dm-chip-dot run"></i>${esc(labels.running)}</button>
            <button type="button" data-dm-filter="standby"><i class="dm-chip-dot standby"></i>${esc(labels.standby)}</button>
            <button type="button" data-dm-filter="off"><i class="dm-chip-dot off"></i>${esc(labels.off)}</button>
          </div>
          <label class="dm-appl-sort">
            <select data-dm-sort aria-label="${esc(labels.sortPowerDesc)}">
              <option value="power-desc">${esc(labels.sortPowerDesc)}</option>
              <option value="power-asc">${esc(labels.sortPowerAsc)}</option>
              <option value="name">${esc(labels.sortName)}</option>
              <option value="room">${esc(labels.sortRoom)}</option>
              <option value="state">${esc(labels.sortState)}</option>
            </select>
          </label>
        </div>
        <div id="appl-grid-overview" class="appl-main-view active dm-appl-grid" data-dm-grid></div>
      </main>
    </div>
  </div>`;
}

function ensureSkeleton(host, labels) {
  if (host.querySelector(":scope > .dm-appl-shell")) return false;
  /* Preserve the "← Home" button injected by the legacy runtime. */
  const backBtn = host.querySelector(":scope > .back-home-btn");
  host.innerHTML = skeletonMarkup(labels);
  if (backBtn) host.insertBefore(backBtn, host.firstChild);
  const sort = host.querySelector("[data-dm-sort]");
  if (sort) sort.value = state.ui.sort;
  return true;
}

/* ── sidebar rendering ───────────────────────────────────────────────── */

function sideItem({ key, kind, icon, label, count, active, dotClass }) {
  return `<button type="button" class="dm-side-item${active ? " active" : ""}" data-dm-${kind}="${esc(key)}">
      <span class="dm-side-ic${dotClass ? ` dm-side-dot ${dotClass}` : ""}" aria-hidden="true">${dotClass ? "" : icon}</span>
      <span class="dm-side-label">${esc(label)}</span>
      <b class="dm-side-count">${count}</b>
    </button>`;
}

function renderSidebar(shell, models, counts, rooms, labels) {
  const roomsHost = shell.querySelector("[data-dm-rooms]");
  if (roomsHost) {
    const items = [
      sideItem({
        key: "all",
        kind: "room",
        icon: ICONS.grid,
        label: labels.allRooms,
        count: counts.total,
        active: state.ui.room === "all",
      }),
      ...rooms
        .filter((room) => counts.rooms.get(room.id))
        .map((room) =>
          sideItem({
            key: room.id,
            kind: "room",
            icon: esc(iconGlyph("room", room.icon || "mdi:home")),
            label: room.name,
            count: counts.rooms.get(room.id) || 0,
            active: state.ui.room === room.id,
          }),
        ),
    ];
    if (counts.unassigned)
      items.push(
        sideItem({
          key: "unassigned",
          kind: "room",
          icon: "❓",
          label: labels.noRoom,
          count: counts.unassigned,
          active: state.ui.room === "unassigned",
        }),
      );
    roomsHost.innerHTML = items.join("");
  }
  const statesHost = shell.querySelector("[data-dm-states]");
  if (statesHost) {
    statesHost.innerHTML = [
      sideItem({
        key: "running",
        kind: "state",
        dotClass: "run",
        label: labels.running,
        count: counts.running,
        active: state.ui.filter === "running",
      }),
      sideItem({
        key: "standby",
        kind: "state",
        dotClass: "standby",
        label: labels.standby,
        count: counts.standby,
        active: state.ui.filter === "standby",
      }),
      sideItem({
        key: "off",
        kind: "state",
        dotClass: "off",
        label: labels.off,
        count: counts.off,
        active: state.ui.filter === "off",
      }),
      sideItem({
        key: "alarm",
        kind: "state",
        dotClass: "alarm",
        label: labels.alarm,
        count: counts.alarm,
        active: state.ui.filter === "alarm",
      }),
    ].join("");
  }
  const overview = shell.querySelector("[data-dm-side-overview]");
  if (overview)
    overview.classList.toggle(
      "active",
      state.ui.filter === "all" && state.ui.room === "all",
    );
  const watts = shell.querySelector("[data-dm-total-watts]");
  if (watts) {
    const label = formatPowerLabel(counts.watts);
    if (watts.textContent !== label) watts.textContent = label;
  }
  const active = shell.querySelector("[data-dm-total-running]");
  if (active && active.textContent !== String(counts.running))
    active.textContent = String(counts.running);
  const spark = shell.querySelector("[data-dm-spark]");
  if (spark) {
    const { line, area } = sparklinePath(state.spark, 100, 28);
    const lineNode = spark.querySelector(".dm-spark-line");
    const areaNode = spark.querySelector(".dm-spark-area");
    if (lineNode && lineNode.getAttribute("d") !== line) lineNode.setAttribute("d", line);
    if (areaNode && areaNode.getAttribute("d") !== area) areaNode.setAttribute("d", area);
  }
}

function renderToolbar(shell) {
  shell
    .querySelectorAll("[data-dm-chips] [data-dm-filter]")
    .forEach((chip) =>
      chip.classList.toggle("active", chip.dataset.dmFilter === state.ui.filter),
    );
  shell
    .querySelectorAll("[data-dm-view]")
    .forEach((button) =>
      button.classList.toggle("active", button.dataset.dmView === state.ui.view),
    );
  shell.dataset.view = state.ui.view;
  const sort = shell.querySelector("[data-dm-sort]");
  if (sort && sort.value !== state.ui.sort) sort.value = state.ui.sort;
}

function renderGrid(shell, visible, labels) {
  const grid = shell.querySelector("[data-dm-grid]");
  if (!grid) return;
  if (!visible.length) {
    const message = devices().length ? labels.emptyFilter : labels.empty;
    const markup = `<div class="dm-appl-empty">🧺 ${esc(message)}</div>`;
    if (grid._dmEmpty !== message) {
      grid._dmEmpty = message;
      grid.innerHTML = markup;
    }
    return;
  }
  if (grid._dmEmpty) {
    grid._dmEmpty = "";
    grid.innerHTML = "";
  }
  const wanted = new Map();
  for (const model of visible) wanted.set(String(model.id), model);
  const existing = new Map();
  [...grid.querySelectorAll(":scope > [data-appliance-id]")].forEach((node) => {
    const id = node.dataset.applianceId;
    if (!wanted.has(id)) node.remove();
    else existing.set(id, node);
  });
  let cursor = null;
  for (const model of visible) {
    const id = String(model.id);
    const signature = cardSignature(model, state.ui.view);
    let node = existing.get(id);
    if (node && node.dataset.dmSig !== signature) {
      const shellNode = doc.createElement("div");
      shellNode.innerHTML = buildCardMarkup(model, labels);
      const fresh = shellNode.firstElementChild;
      fresh.dataset.dmSig = signature;
      if (aggiornaTenendoIlDisegno(node, fresh)) {
        node.dataset.dmSig = signature;
      } else {
        node.replaceWith(fresh);
        node = fresh;
      }
    } else if (!node) {
      const shellNode = doc.createElement("div");
      shellNode.innerHTML = buildCardMarkup(model, labels);
      node = shellNode.firstElementChild;
      node.dataset.dmSig = signature;
      if (cursor) cursor.after(node);
      else grid.prepend(node);
    }
    if (cursor ? cursor.nextElementSibling !== node : grid.firstElementChild !== node) {
      if (cursor) cursor.after(node);
      else grid.prepend(node);
    }
    cursor = node;
  }
}

/* ── main render ─────────────────────────────────────────────────────── */

export function renderShowcase(force) {
  const host = doc?.getElementById?.("page-appliances-main");
  if (!host) return false;
  const labels = copy();
  const built = ensureSkeleton(host, labels);
  const shell = host.querySelector(":scope > .dm-appl-shell");
  if (!shell) return false;

  const list = devices();
  const states = allStates();
  const rooms = roomList();
  const locale = activeLocale();
  const now = Date.now();
  const price = globalPriceKwh();
  const cycles = tracker();

  const preliminary = list.map((device, index) => {
    const model = createApplianceViewModel(device, states, [], locale);
    const key = deviceKey(device, index);
    return {
      id: key,
      mode: model.mode,
      watts: model.watts,
      dailyKwh: dailyEnergyKwh(device, states),
      remainingSeconds: remainingInfo(device, states, now, cycles.record(key))?.seconds,
    };
  });
  cycles.update(preliminary);

  if (now - state.sparkTs >= SPARK_SAMPLE_MS || !state.spark.length) {
    state.sparkTs = now;
    state.spark.push(
      preliminary.reduce((sum, entry) => sum + Math.max(0, finiteOrNull(entry.watts) ?? 0), 0),
    );
    if (state.spark.length > SPARK_MAX_SAMPLES) state.spark.shift();
  }

  const models = list.map((device, index) =>
    applianceCardModel(device, states, {
      rooms,
      locale,
      now,
      priceKwh: price,
      record: cycles.record(deviceKey(device, index)),
      index,
    }),
  );
  // Models keep the persisted id when present; align with the tracker key so
  // cards of id-less legacy configs stay stable.
  const keyed = models.map((model, index) =>
    model.id ? model : Object.freeze({ ...model, id: deviceKey(list[index], index) }),
  );

  const counts = showcaseCounts(keyed);
  const visible = filterShowcaseModels(keyed, state.ui);
  const signature = [
    built,
    Math.floor(now / 60000),
    state.ui.filter,
    state.ui.room,
    state.ui.sort,
    state.ui.view,
    counts.total,
    counts.running,
    counts.standby,
    counts.off,
    counts.alarm,
    Math.round(counts.watts),
    state.spark.length,
    Math.round(state.spark[state.spark.length - 1] || 0),
    rooms.map((room) => `${room.id}:${counts.rooms.get(room.id) || 0}`).join(","),
    visible.map((model) => cardSignature(model, state.ui.view)).join("§"),
  ].join("::");
  if (!force && state.signature === signature) return true;
  state.signature = signature;

  renderSidebar(shell, keyed, counts, rooms, labels);
  renderToolbar(shell);
  renderGrid(shell, visible, labels);
  // Replacing the legacy renderApplianceSection detaches the wrapper that
  // appliances-section installed on it, so re-arm its normalization pass
  // (daily KPI, power-toggle text, data-appliance-state markers) directly.
  try {
    scheduleApplianceNormalization();
  } catch (_error) {}
  return true;
}

/* ── interactions ────────────────────────────────────────────────────── */

function setUi(patch) {
  Object.assign(state.ui, patch);
  renderShowcase(true);
}

async function togglePower(button) {
  const entity = clean(button.dataset.entity);
  if (!entity || button.disabled) return;
  button.disabled = true;
  try {
    const on = allStates()[entity]?.state === "on";
    await root.dmCallHaService?.(entity.split(".")[0], on ? "turn_off" : "turn_on", {
      entity_id: entity,
    });
  } catch (_error) {
  } finally {
    root.setTimeout?.(() => {
      button.disabled = false;
      renderShowcase(true);
    }, 300);
  }
}

function onShellClick(event) {
  const host = doc?.getElementById?.("page-appliances-main");
  if (!host || !host.contains(event.target)) return;
  const target = event.target;
  const view = target.closest?.("[data-dm-view]");
  if (view) {
    setUi({ view: view.dataset.dmView === "list" ? "list" : "grid" });
    return;
  }
  const overview = target.closest?.("[data-dm-side-overview]");
  if (overview) {
    setUi({ filter: "all", room: "all" });
    return;
  }
  const roomButton = target.closest?.("[data-dm-room]");
  if (roomButton) {
    setUi({ room: roomButton.dataset.dmRoom });
    return;
  }
  const stateButton = target.closest?.("[data-dm-state]");
  if (stateButton) {
    const next = stateButton.dataset.dmState;
    setUi({ filter: state.ui.filter === next ? "all" : next });
    return;
  }
  const chip = target.closest?.("[data-dm-filter]");
  if (chip) {
    setUi({ filter: chip.dataset.dmFilter });
    return;
  }
  const power = target.closest?.('[data-dm-power-toggle="true"]');
  if (power) {
    event.stopPropagation();
    togglePower(power);
    return;
  }
  const history = target.closest?.("[data-dm-history]");
  if (history) {
    event.stopPropagation();
    root.apriStorico?.(
      event,
      clean(history.dataset.dmHistory),
      clean(history.dataset.dmHistoryName),
    );
    return;
  }
  const card = target.closest?.(".dm-ap-card[data-idx]");
  if (card) {
    root.apriApplianceDetail?.(Number(card.dataset.idx));
  }
}

function onShellChange(event) {
  const host = doc?.getElementById?.("page-appliances-main");
  if (!host || !host.contains(event.target)) return;
  const sort = event.target.closest?.("[data-dm-sort]");
  if (sort) setUi({ sort: sort.value });
}

function onShellKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") return;
  const card = event.target?.closest?.(".dm-ap-card[data-idx]");
  const host = doc?.getElementById?.("page-appliances-main");
  if (!card || !host?.contains(card) || event.target.closest("button,select,a,input")) return;
  event.preventDefault();
  root.apriApplianceDetail?.(Number(card.dataset.idx));
}

/* ── overrides / install ─────────────────────────────────────────────── */

function installOverrides() {
  const currentSection = root.renderApplianceSection;
  if (typeof currentSection !== "function" || !currentSection.__dmShowcase) {
    function showcaseRenderApplianceSection(force) {
      return renderShowcase(force);
    }
    showcaseRenderApplianceSection.__dmShowcase = true;
    showcaseRenderApplianceSection.__dmPrevious = currentSection;
    root.renderApplianceSection = showcaseRenderApplianceSection;
  }
  const currentSwitch = root.switchApplianceView;
  if (typeof currentSwitch !== "function" || !currentSwitch.__dmShowcase) {
    function showcaseSwitchApplianceView() {
      return renderShowcase(true);
    }
    showcaseSwitchApplianceView.__dmShowcase = true;
    showcaseSwitchApplianceView.__dmPrevious = currentSwitch;
    root.switchApplianceView = showcaseSwitchApplianceView;
  }
  /* Prevent the legacy render loop from overwriting the appliance detail popup.
   * The loop calls apriDettagli(null, currentPopupType) on every state change;
   * when currentPopupType is 'appliance_view' it falls through to the generic
   * monitoring-groups handler which shows "Nessun elemento attivo" because
   * GRUPPI_MONITORAGGIO has no 'appliance_view' entry. */
  const currentDettagli = root.apriDettagli;
  if (typeof currentDettagli === "function" && !currentDettagli.__dmShowcase) {
    function showcaseDettagli(event, type) {
      if (type === "appliance_view") return;
      return currentDettagli.call(root, event, type);
    }
    showcaseDettagli.__dmShowcase = true;
    root.apriDettagli = showcaseDettagli;
  }
}

export function installApplianceShowcaseSection() {
  if (!doc) return;
  installShowcaseStyle();
  installOverrides();
  if (!state.listeners) {
    state.listeners = true;
    doc.addEventListener("click", onShellClick);
    doc.addEventListener("change", onShellChange);
    doc.addEventListener("keydown", onShellKeydown);
    root.addEventListener?.("dashboardmodern:legacy-ready", () => {
      installOverrides();
      renderShowcase(true);
    });
    root.addEventListener?.("dashboardmodern:runtime-ready", installOverrides);
    root.addEventListener?.("pageshow", installOverrides);
    doc.addEventListener(
      "click",
      (event) => {
        if (
          event.target?.closest?.(
            "[data-tab='appliances-main'],.tab[data-tab='appliances-main']",
          )
        ) {
          root.queueMicrotask?.(() => renderShowcase(true));
        }
      },
      true,
    );
    // No polling: countdown, live-cycle duration and "oggi/ieri" labels are
    // refreshed by the legacy render() loop that already runs on every Home
    // Assistant state change; the render signature includes the current minute
    // so those labels advance as soon as any state event arrives.
    root.addEventListener?.("dashboardmodern:state-changed", () => {
      if (doc.getElementById("page-appliances-main")?.classList.contains("active"))
        renderShowcase(false);
    });
  }
  state.installed = true;
  if (doc.getElementById("page-appliances-main")) renderShowcase(false);
}

/* ── styles ──────────────────────────────────────────────────────────── */

function installShowcaseStyle() {
  installStyle(STYLE_ID, showcaseCss());
}

function showcaseCss() {
  return `
#page-appliances-main > .sub-tabs-container,#page-appliances-main > .appl-main-hero{display:none!important}
.dm-appl-shell,.dm-appl-shell *,.dm-appl-shell *::before,.dm-appl-shell *::after{box-sizing:border-box}
.dm-appl-shell{--dm-blue:#0ea5e9;--dm-blue-deep:#0369a1;--dm-green:#16a34a;--dm-red:#ef4444;--dm-shell-text:var(--text,#0f172a);--dm-dim:var(--text-dim,#64748b);--dm-card:var(--card-bg,#ffffff);--dm-border:var(--card-border,#e6ecf4);--dm-soft:rgba(148,163,184,.10);color:var(--dm-shell-text);display:flex;flex-direction:column;gap:16px;padding:2px}
.dm-sr-only{position:absolute!important;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
/* header (own card skin: the legacy global "header{}" rule no longer applies) */
.dm-appl-head{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;padding:16px 18px;border:1px solid var(--dm-border);border-radius:22px;background:var(--dm-card);box-shadow:0 10px 30px rgba(15,23,42,.05)}
.dm-appl-brand{display:flex;align-items:center;gap:13px;min-width:0}
.dm-appl-brand-ic{width:52px;height:52px;flex:0 0 52px;display:grid;place-items:center;border-radius:16px;background:linear-gradient(140deg,#e0f2fe,#dbeafe 55%,#ede9fe);color:var(--dm-blue-deep);box-shadow:inset 0 0 0 1px rgba(14,165,233,.14)}
.dm-appl-brand-ic svg{width:26px;height:26px}
.dm-appl-brand-copy h2{margin:0;font-size:clamp(21px,2.6vw,27px);font-weight:900;letter-spacing:-.3px}
.dm-appl-brand-copy p{margin:2px 0 0;font-size:12.5px;font-weight:600;color:var(--dm-dim)}
.dm-appl-head-actions{display:flex;align-items:center;gap:10px}
.dm-appl-viewtoggle{display:flex;gap:4px;padding:4px;border-radius:14px;background:var(--dm-card);border:1px solid var(--dm-border);box-shadow:0 4px 14px rgba(15,23,42,.05)}
.dm-appl-viewtoggle button{width:36px;height:36px;display:grid;place-items:center;border:0;border-radius:10px;background:transparent;color:var(--dm-dim);cursor:pointer}
.dm-appl-viewtoggle button.active{background:#e0f2fe;color:var(--dm-blue-deep)}
/* layout */
.dm-appl-shell{min-width:0;max-width:100%}
.dm-appl-layout{display:grid;grid-template-columns:236px minmax(0,1fr);gap:16px;align-items:start;min-width:0}
.dm-appl-main{min-width:0}
/* sidebar */
.dm-appl-side{position:sticky;top:10px;display:flex;flex-direction:column;gap:4px;padding:14px;border-radius:22px;background:var(--dm-card);border:1px solid var(--dm-border);box-shadow:0 10px 30px rgba(15,23,42,.06)}
.dm-side-cap{margin:12px 6px 6px;font-size:10px;font-weight:900;letter-spacing:1.6px;text-transform:uppercase;color:var(--dm-dim)}
.dm-side-overview,.dm-side-item{display:flex;align-items:center;gap:10px;width:100%;padding:10px 10px;border:0;border-radius:13px;background:transparent;color:inherit;font-size:13px;font-weight:750;text-align:left;cursor:pointer;transition:background .15s ease}
.dm-side-overview svg{width:17px;height:17px}
.dm-side-overview:hover,.dm-side-item:hover{background:var(--dm-soft)}
.dm-side-overview.active,.dm-side-item.active{background:#e0f2fe;color:var(--dm-blue-deep)}
.dm-side-ic{display:grid;place-items:center;width:20px;flex:0 0 20px;font-size:14px;color:var(--dm-dim)}
.dm-side-ic svg{width:16px;height:16px}
.dm-side-item.active .dm-side-ic{color:var(--dm-blue-deep)}
.dm-side-dot{width:20px}
.dm-side-dot::before{content:"";display:block;width:9px;height:9px;border-radius:50%;margin:auto}
.dm-side-dot.run::before{background:#22c55e}
.dm-side-dot.standby::before{background:#3b82f6}
.dm-side-dot.off::before{background:#94a3b8}
.dm-side-dot.alarm::before{background:#ef4444}
.dm-side-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dm-side-count{flex:0 0 auto;min-width:24px;padding:2px 7px;border-radius:999px;background:var(--dm-soft);color:var(--dm-dim);font-size:11px;font-weight:850;text-align:center}
.dm-side-item.active .dm-side-count{background:rgba(14,165,233,.16);color:var(--dm-blue-deep)}
/* total card — neutralize the legacy .glance-card skin inside the sidebar */
.dm-side-total{margin-top:14px;padding:14px 14px 10px;border-radius:18px;border:1px solid var(--dm-border);background:linear-gradient(180deg,rgba(224,242,254,.55),rgba(255,255,255,0) 70%);display:flex;flex-direction:column;gap:2px}
.dm-side-total .glance-card{display:flex;flex-direction:column;justify-content:flex-start;align-items:stretch;gap:1px;background:transparent;border:0;border-radius:0;padding:0;margin:0;cursor:pointer;text-align:left;color:inherit;box-shadow:none;overflow:visible}
.dm-side-total .glance-card::after{display:none}
.dm-side-total .glance-card:hover{transform:none;box-shadow:none;border-color:transparent}
.dm-side-total .glance-card .g-name{text-transform:none;letter-spacing:normal}
.dm-side-total .glance-card .g-val{font-family:inherit;line-height:1.15}
.dm-side-total .dm-total-power .g-name{font-size:12.5px;font-weight:850;color:var(--dm-shell-text)}
.dm-side-total .dm-total-power .g-val{font-size:26px;font-weight:950;letter-spacing:-.5px;color:var(--dm-shell-text)}
.dm-side-total .dm-total-running{flex-direction:row;align-items:baseline;gap:6px}
.dm-side-total .dm-total-running .g-val{font-size:13px;font-weight:900;color:var(--dm-green)}
.dm-side-total .dm-total-running .g-name{font-size:12px;font-weight:750;color:var(--dm-green)}
.dm-side-spark{width:100%;height:44px;margin-top:8px;border-radius:8px;overflow:visible}
.dm-side-spark .dm-spark-line{stroke:var(--dm-blue);stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}
.dm-side-total .dm-total-daily{flex-direction:row;justify-content:space-between;align-items:center;margin-top:6px;padding-top:8px;border-top:1px dashed var(--dm-border)}
.dm-side-total .dm-total-daily .g-name{font-size:11px;font-weight:850;letter-spacing:.6px;text-transform:uppercase;color:var(--dm-dim)}
.dm-side-total .dm-total-daily .g-val{font-size:13px;font-weight:900;color:var(--dm-blue-deep)}
/* toolbar */
.dm-appl-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.dm-appl-chips{display:flex;gap:8px;flex-wrap:wrap}
.dm-appl-chips button{display:inline-flex;align-items:center;gap:7px;padding:9px 16px;border:1px solid var(--dm-border);border-radius:999px;background:var(--dm-card);color:var(--dm-dim);font-size:12.5px;font-weight:800;cursor:pointer;transition:all .15s ease}
.dm-appl-chips button:hover{border-color:#bae6fd}
.dm-appl-chips button.active{background:var(--dm-blue);border-color:var(--dm-blue);color:#fff;box-shadow:0 8px 18px rgba(14,165,233,.30)}
.dm-chip-dot{width:8px;height:8px;border-radius:50%}
.dm-chip-dot.run{background:#22c55e}
.dm-chip-dot.standby{background:#3b82f6}
.dm-chip-dot.off{background:#94a3b8}
.dm-appl-chips button.active .dm-chip-dot{box-shadow:0 0 0 3px rgba(255,255,255,.25)}
.dm-appl-sort select{appearance:none;-webkit-appearance:none;padding:10px 34px 10px 15px;border:1px solid var(--dm-border);border-radius:13px;background:var(--dm-card) url("data:image/svg+xml;charset=utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' d='m1.5 1.8 4.5 4.4 4.5-4.4'/%3E%3C/svg%3E") no-repeat right 13px center;color:var(--dm-shell-text);font-size:12.5px;font-weight:750;cursor:pointer}
/* grid — the id selector outranks the legacy ".appl-main-view.active{display:block}" */
#appl-grid-overview.dm-appl-grid,.dm-appl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(285px,1fr));gap:16px}
.dm-appl-empty{grid-column:1/-1;padding:44px 20px;border:1px dashed var(--dm-border);border-radius:22px;text-align:center;color:var(--dm-dim);font-weight:750;background:var(--dm-soft)}
/* card */
.dm-appl-shell .appl-wide-card.dm-ap-card{display:flex;flex-direction:column;gap:0;margin:0;padding:0;border:1px solid var(--dm-border);border-radius:22px;background:var(--dm-card);box-shadow:0 12px 30px rgba(15,23,42,.06);overflow:hidden;cursor:pointer;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}
.dm-appl-shell .dm-ap-card:hover{transform:translateY(-3px);box-shadow:0 18px 40px rgba(15,23,42,.10)}
.dm-appl-shell .dm-ap-card.is-run{border-color:rgba(34,197,94,.28)}
.dm-appl-shell .dm-ap-card.has-alarm{border-color:rgba(239,68,68,.45)}
.dm-ap-top{display:flex;align-items:center;gap:7px;padding:12px 12px 9px}
.dm-ap-chip{width:34px;height:34px;flex:0 0 34px;display:grid;place-items:center;border-radius:11px;background:#eff6ff;box-shadow:inset 0 0 0 1px rgba(59,130,246,.10)}
.dm-ap-chip .dm-appliance-art,.dm-ap-chip svg{width:27px;height:27px}
.dm-ap-headings{display:flex;flex-direction:column;min-width:0;flex:1;gap:1px}
.dm-ap-name{font-size:13.5px;font-weight:900;letter-spacing:-.2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dm-ap-room{font-size:10px;font-weight:750;color:var(--dm-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dm-ap-badge{display:inline-flex;align-items:center;gap:4px;flex:0 0 auto;padding:4px 7px;border-radius:999px;font-size:8.5px;font-weight:900;letter-spacing:.4px;text-transform:uppercase;white-space:nowrap}
.dm-ap-badge.run{background:#dcfce7;color:#15803d}
.dm-ap-badge.standby{background:#dbeafe;color:#2563eb}
.dm-ap-badge.off{background:#f1f5f9;color:#64748b}
.dm-ap-badge.unavailable{background:#fee2e2;color:#b91c1c}
.dm-ap-dot{width:7px;height:7px;border-radius:50%;background:currentColor}
.dm-ap-badge.run .dm-ap-dot{animation:dmDotPulse 1.6s ease-out infinite}
.dm-ap-badge.standby .dm-ap-dot{animation:dmDotBreathe 2.6s ease-in-out infinite}
.dm-ap-tools{display:flex;gap:4px;flex:0 0 auto}
.dm-ap-tool{width:26px;height:26px;display:grid;place-items:center;border:1px solid var(--dm-border);border-radius:9px;background:var(--dm-card);color:var(--dm-dim);cursor:pointer;transition:all .15s ease}
.dm-ap-tool svg{width:13px;height:13px}
.dm-ap-tool:hover{border-color:#bae6fd;color:var(--dm-blue-deep)}
.dm-ap-tool:disabled{opacity:.38;cursor:not-allowed}
/* Must track the width/height in ICONS.power: CSS beats the SVG presentation
   attributes, so a smaller value here silently shrinks the markup back. */
.dm-ap-power svg{width:16px;height:16px}
.dm-ap-power.on{background:#dcfce7;border-color:rgba(34,197,94,.35);color:#15803d}
/* hero */
.dm-ap-hero{position:relative;display:grid;place-items:center;height:172px;margin:0 13px;border-radius:18px;background:radial-gradient(120% 90% at 50% 8%,rgba(224,242,254,.65),rgba(241,245,249,.35) 60%,transparent);overflow:hidden}
.dm-ap-hero .dm-appliance-art,.dm-ap-hero .dm-appliance-art svg{width:150px;height:150px;display:block}
.dm-ap-hero .dm-hero-art{display:grid;place-items:center}
.dm-ap-hero .dm-hero-art svg{width:164px;height:164px;display:block}
.dm-ap-img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;padding:8px}
.dm-ap-hero.has-image{background:#fff;box-shadow:inset 0 0 0 1px rgba(148,163,184,.16)}
[data-theme="dark"] .dm-ap-hero.has-image{background:#fff;box-shadow:inset 0 0 0 1px rgba(148,163,184,.28)}
.dm-ap-photo{padding:6px}
.dm-ap-hero-fallback{font-size:64px}
/* panel */
.dm-ap-panel{display:flex;align-items:center;gap:14px;margin:12px 13px 0;padding:13px 14px;border-radius:16px;background:var(--dm-soft)}
.dm-ap-meters{flex:1;display:flex;flex-direction:column;gap:10px;min-width:0}
.dm-ap-meter-row{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
.dm-ap-meter-row span{font-size:12px;font-weight:750;color:var(--dm-dim)}
.dm-ap-meter-row strong{font-size:15px;font-weight:950;letter-spacing:-.2px}
.dm-ap-bar{position:relative;display:flex;align-items:center;gap:7px;height:8px;margin-top:7px}
.dm-ap-bar-ic{flex:0 0 auto;display:grid;place-items:center;width:15px;height:15px;margin-top:-4px;color:var(--dm-blue)}
.dm-ap-bar::before{content:"";position:absolute;inset:0;border-radius:999px;background:rgba(148,163,184,.22)}
.dm-ap-bar.cold::before{left:22px}
.dm-ap-bar i{position:relative;z-index:1;display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#fb923c,#ef4444);min-width:0;transition:width .6s cubic-bezier(.4,0,.2,1);overflow:hidden}
.dm-ap-bar.cold i{margin-left:22px;background:linear-gradient(90deg,#7dd3fc,#0284c7)}
.dm-ap-bar.run i::after{content:"";position:absolute;inset:0;background:linear-gradient(100deg,transparent 20%,rgba(255,255,255,.55) 50%,transparent 80%);transform:translateX(-100%);animation:dmBarSheen 1.8s linear infinite}
/* ring */
.dm-ap-ring{position:relative;width:66px;height:66px;flex:0 0 66px}
.dm-ap-ring svg{width:100%;height:100%;transform:rotate(-90deg)}
.dm-ap-ring-track{fill:none;stroke:rgba(148,163,184,.25);stroke-width:6}
.dm-ap-ring-bar{fill:none;stroke:var(--dm-blue);stroke-width:6;stroke-linecap:round;transition:stroke-dashoffset .8s cubic-bezier(.4,0,.2,1)}
.acc-heat .dm-ap-ring-bar{stroke:var(--dm-red)}
.dm-ap-ring.indeterminate svg{animation:dmRingSpin 1.6s linear infinite}
.dm-ap-ring-copy{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0}
.dm-ap-ring-copy b{font-size:14px;font-weight:950;letter-spacing:-.3px}
.dm-ap-ring-copy small{font-size:6.3px;font-weight:900;letter-spacing:.8px;color:var(--dm-dim)}
/* cycle footer */
.dm-ap-cycle{margin:12px 13px 13px;padding:11px 13px 10px;border-radius:16px;background:var(--dm-soft)}
.dm-ap-cycle-cap{display:block;margin-bottom:7px;font-size:9px;font-weight:900;letter-spacing:1.4px;text-transform:uppercase;color:var(--dm-dim)}
.dm-ap-cycle.live .dm-ap-cycle-cap::after{content:"●";margin-left:6px;color:#22c55e;animation:dmDotBreathe 1.6s ease-in-out infinite}
.dm-ap-cycle-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.dm-ap-cycle-cell{display:flex;flex-direction:column;gap:2px;min-width:0}
.dm-ap-cycle-cell small{font-size:8.5px;font-weight:900;letter-spacing:.7px;text-transform:uppercase;color:var(--dm-dim)}
.dm-ap-cycle-cell b{font-size:11.5px;font-weight:850;letter-spacing:-.1px;overflow-wrap:break-word}
/* alarm */
.dm-appl-shell .dm-ap-card.has-alarm .dm-ap-chip{background:#fee2e2}
/* off state visual mute (photos keep the reference full-color look) */
.dm-appl-shell .dm-ap-card.is-off .dm-ap-hero,.dm-appl-shell .dm-ap-card.is-unavailable .dm-ap-hero{filter:grayscale(.55) opacity(.62)}
.dm-appl-shell .dm-ap-card.is-standby .dm-ap-hero{filter:saturate(.85)}
.dm-appl-shell .dm-ap-card.is-off .dm-ap-hero.has-image{filter:none}
.dm-appl-shell .dm-ap-card.is-standby .dm-ap-hero.has-image{filter:none}
.dm-appl-shell .dm-ap-card.is-unavailable .dm-ap-hero.has-image{filter:grayscale(.6) opacity(.7)}
/* ── running animations (hero mechanisms) ───────────────────────────── */
/* Le meccaniche si muovono ovunque compaia il disegno, non solo sulla scheda.
 *
 * Queste regole erano scritte su .dm-ap-card, e cosi' il disegno riportato
 * altrove — nel popup "in funzione", che mostra gli stessi elettrodomestici —
 * restava un'immagine ferma e per giunta diversa da quella della scheda. La
 * classe .dm-ap-mech dice "qui dentro c'e' un disegno animabile": la porta la
 * scheda, la porta la riga del popup, e lo stato .is-run/.is-standby decide se
 * il meccanismo gira. */
.dm-ap-mech.is-run .dm-ap-hero{background:radial-gradient(120% 90% at 50% 8%,rgba(186,230,253,.85),rgba(224,242,254,.35) 62%,transparent)}
.dm-ap-mech.is-run.acc-heat .dm-ap-hero{background:radial-gradient(120% 90% at 50% 12%,rgba(254,215,170,.75),rgba(254,226,226,.35) 62%,transparent)}
/* Idle mechanisms are hidden until the appliance actually runs. */
.dm-ap-mech:not(.is-run) .dmh-jets,.dm-ap-mech:not(.is-run) .dmh-steam,.dm-ap-mech:not(.is-run) [data-dm-hero="oven"] .dmh-ring{opacity:0}
.dm-ap-mech:not(.is-run) [data-dm-hero="oven"] .dmh-glow,.dm-ap-mech:not(.is-run) [data-dm-hero="microwave"] .dmh-glow,.dm-ap-mech:not(.is-run) [data-dm-hero="toaster"] .dmh-glow,.dm-ap-mech:not(.is-run) .dmh-zone{opacity:.16;filter:saturate(.25)}
.dm-ap-mech.is-off .dmh-light,.dm-ap-mech.is-unavailable .dmh-light{opacity:.35;filter:saturate(.4)}
.dm-ap-mech:not(.is-run) .dmh-led{opacity:.45}
.dm-ap-mech.is-standby .dmh-led{animation:dmDotBreathe 2.4s ease-in-out infinite}
/* washer / dryer: drum + accent ring spin, gentle wobble */
.dm-ap-mech.is-run [data-dm-hero="washer"] .dmh-drum,.dm-ap-mech.is-run [data-dm-hero="dryer"] .dmh-drum{transform-origin:120px 140px;animation:dmDrumSpin 1.6s linear infinite}
.dm-ap-mech.is-run [data-dm-hero="washer"] .dmh-ring,.dm-ap-mech.is-run [data-dm-hero="dryer"] .dmh-ring{transform-origin:120px 140px;animation:dmDrumSpin 2.8s linear infinite}
.dm-ap-mech.is-run [data-dm-hero="washer"] svg,.dm-ap-mech.is-run [data-dm-hero="dryer"] svg{animation:dmWobble .6s ease-in-out infinite}
/* oven: convection fan + interior glow + external heat rings */
.dm-ap-mech.is-run [data-dm-hero="oven"] .dmh-fan{transform-origin:120px 132px;animation:dmDrumSpin 1.3s linear infinite}
.dm-ap-mech.is-run [data-dm-hero="oven"] .dmh-glow{animation:dmGlowPulse 2.2s ease-in-out infinite}
.dm-ap-mech.is-run [data-dm-hero="oven"] .dmh-ring{transform-origin:120px 128px;animation:dmHeatRings 2.4s ease-in-out infinite}
/* dishwasher: pumping jets */
.dm-ap-mech.is-run [data-dm-hero="dishwasher"] .dmh-jets{transform-origin:120px 178px;animation:dmJets 1.5s ease-in-out infinite}
/* microwave: glow + rotating plate hint */
.dm-ap-mech.is-run [data-dm-hero="microwave"] .dmh-glow{animation:dmGlowPulse 1.9s ease-in-out infinite}
.dm-ap-mech.is-run [data-dm-hero="microwave"] .dmh-plate{transform-origin:100px 146px;animation:dmPlate 2.6s ease-in-out infinite}
/* cold cabinets */
.dm-ap-mech.is-run .dmh-light{animation:dmGlowPulse 2.6s ease-in-out infinite}
.dm-ap-mech.is-run [data-dm-hero="freezer"] .dmh-frost,.dm-ap-mech.is-standby [data-dm-hero="freezer"] .dmh-frost{animation:dmFrost 2.8s ease-in-out infinite}
/* cooktop zones + toaster elements */
.dm-ap-mech.is-run .dmh-zone,.dm-ap-mech.is-run [data-dm-hero="toaster"] .dmh-glow{animation:dmGlowPulse 1.8s ease-in-out infinite}
/* steam / airflow wisps */
.dm-ap-mech.is-run .dmh-steam{animation:dmSteamRise 2.6s ease-in-out infinite}
/* fan / robot / boiler / kettle / tv */
.dm-ap-mech.is-run [data-dm-hero="fan"] .dmh-fan{transform-origin:120px 102px;animation:dmDrumSpin 1s linear infinite}
.dm-ap-mech.is-run [data-dm-hero="robot-vacuum"] .dmh-ring{transform-origin:120px 126px;animation:dmDrumSpin 1.8s linear infinite}
.dm-ap-mech.is-run [data-dm-hero="robot-vacuum"] svg{animation:dmRover 2.4s ease-in-out infinite}
.dm-ap-mech.is-run [data-dm-hero="vacuum"] svg,.dm-ap-mech.is-run [data-dm-hero="iron"] svg{animation:dmSway 1.9s ease-in-out infinite}
.dm-ap-mech.is-run .dmh-water{animation:dmWaterSway 2.2s ease-in-out infinite}
.dm-ap-mech.is-run [data-dm-hero="kettle"] .dmh-frost{animation:dmBubbleUp 1.7s ease-in infinite}
.dm-ap-mech.is-run [data-dm-hero="television"] .dmh-screen{animation:dmScreen 3.4s ease-in-out infinite}
.dm-ap-mech.is-run [data-dm-hero="coffee"] .dmh-jets{animation:dmJets 1.2s ease-in-out infinite}
.dm-ap-mech.is-run .dmh-led{animation:dmDotBreathe 1.4s ease-in-out infinite}
/* custom photos: breathing + glow (mechanisms are inside the picture) */
.dm-ap-mech.is-run .dm-ap-hero>.dm-ap-img{animation:dmBreath 3.2s ease-in-out infinite}
.dm-ap-mech.is-run .dm-ap-hero.has-image .dm-ap-img{filter:drop-shadow(0 10px 22px rgba(14,165,233,.35))}
/* fx overlays */
.dm-ap-fx{position:absolute;inset:0;pointer-events:none}
.dm-ap-fx-heat{background:radial-gradient(65% 55% at 50% 62%,rgba(251,146,60,.42),rgba(239,68,68,.16) 55%,transparent 75%);animation:dmHeatPulse 2.2s ease-in-out infinite}
.dm-ap-fx-shimmer{display:flex;justify-content:center;gap:14px;align-items:flex-end;padding-bottom:12px}
.dm-ap-fx-shimmer i{width:2.5px;height:26px;border-radius:999px;background:linear-gradient(180deg,transparent,rgba(251,146,60,.65));filter:blur(.6px);animation:dmHeatRise 1.7s ease-in-out infinite}
.dm-ap-fx-shimmer i:nth-child(2){animation-delay:.4s;height:32px}
.dm-ap-fx-shimmer i:nth-child(3){animation-delay:.9s;height:22px}
.dm-ap-fx-bubbles i{position:absolute;bottom:16px;width:7px;height:7px;border-radius:50%;background:rgba(125,211,252,.75);box-shadow:inset -1px -1px 0 rgba(2,132,199,.35);animation:dmBubble 2.6s ease-in infinite}
.dm-ap-fx-bubbles i:nth-child(1){left:26%;animation-delay:0s}
.dm-ap-fx-bubbles i:nth-child(2){left:38%;width:5px;height:5px;animation-delay:.7s}
.dm-ap-fx-bubbles i:nth-child(3){left:50%;animation-delay:1.3s}
.dm-ap-fx-bubbles i:nth-child(4){left:62%;width:5px;height:5px;animation-delay:.3s}
.dm-ap-fx-bubbles i:nth-child(5){left:72%;animation-delay:1.7s}
.dm-ap-fx-bubbles i:nth-child(6){left:33%;width:4px;height:4px;animation-delay:2.1s}
.dm-ap-fx-steam i{position:absolute;top:14px;width:10px;height:26px;border-radius:999px;background:linear-gradient(180deg,rgba(148,163,184,.0),rgba(148,163,184,.4));filter:blur(3px);animation:dmSteam 2.8s ease-out infinite}
.dm-ap-fx-steam i:nth-child(1){left:34%}
.dm-ap-fx-steam i:nth-child(2){left:48%;animation-delay:.9s}
.dm-ap-fx-steam i:nth-child(3){left:60%;animation-delay:1.8s}
.dm-ap-fx-cold{background:radial-gradient(60% 50% at 50% 45%,rgba(125,211,252,.35),transparent 70%);animation:dmHeatPulse 2.6s ease-in-out infinite}
.dm-ap-fx-pulse{background:radial-gradient(58% 48% at 50% 52%,rgba(56,189,248,.28),transparent 72%);animation:dmHeatPulse 2.4s ease-in-out infinite}
.dm-ap-fx-frost{display:grid;place-items:end center;position:absolute;right:12px;top:12px;left:auto;bottom:auto;color:#38bdf8;animation:dmFrost 3s ease-in-out infinite}
/* list view */
.dm-appl-shell[data-view="list"] #appl-grid-overview.dm-appl-grid,.dm-appl-shell[data-view="list"] .dm-appl-grid{grid-template-columns:1fr;gap:10px}
.dm-appl-shell[data-view="list"] .appl-wide-card.dm-ap-card{display:grid;grid-template-columns:64px minmax(150px,.85fr) minmax(220px,1.15fr) minmax(0,1.5fr);grid-template-areas:"hero top panel cycle";align-items:center;gap:14px;padding:10px 14px}
.dm-appl-shell[data-view="list"] .dm-ap-top{grid-area:top;display:flex;flex-wrap:wrap;align-items:center;gap:7px;padding:0;min-width:0}
.dm-appl-shell[data-view="list"] .dm-ap-chip{display:none}
.dm-appl-shell[data-view="list"] .dm-ap-headings{flex:1 1 100%;min-width:0}
.dm-appl-shell[data-view="list"] .dm-ap-hero{grid-area:hero;height:56px;width:64px;margin:0;border-radius:14px}
.dm-appl-shell[data-view="list"] .dm-ap-hero .dm-appliance-art,.dm-appl-shell[data-view="list"] .dm-ap-hero .dm-appliance-art svg,.dm-appl-shell[data-view="list"] .dm-ap-hero .dm-hero-art svg{width:52px;height:52px}
.dm-appl-shell[data-view="list"] .dm-ap-hero .dm-ap-fx{display:none}
.dm-appl-shell[data-view="list"] .dm-ap-img{padding:2px}
.dm-appl-shell[data-view="list"] .dm-ap-panel{grid-area:panel;margin:0;padding:8px 12px;gap:10px}
.dm-appl-shell[data-view="list"] .dm-ap-ring{width:50px;height:50px;flex:0 0 50px}
.dm-appl-shell[data-view="list"] .dm-ap-ring-copy b{font-size:11px}
.dm-appl-shell[data-view="list"] .dm-ap-ring-copy small{font-size:5px}
.dm-appl-shell[data-view="list"] .dm-ap-cycle{grid-area:cycle;margin:0;padding:8px 12px 7px}
.dm-appl-shell[data-view="list"] .dm-ap-cycle-cap{margin-bottom:4px}
@media(max-width:1120px){
.dm-appl-shell[data-view="list"] .appl-wide-card.dm-ap-card{grid-template-columns:64px minmax(0,1fr);grid-template-areas:"hero top" "panel panel" "cycle cycle";row-gap:10px}
}
/* responsive */
@media(max-width:980px){
.dm-appl-layout{grid-template-columns:minmax(0,1fr)}
.dm-appl-side{position:static;flex-direction:row;flex-wrap:wrap;align-items:center;gap:6px;padding:10px;min-width:0;max-width:100%}
.dm-side-cap{flex:0 0 auto;margin:0 4px}
.dm-side-overview{width:auto}
.dm-side-rooms,.dm-side-states{display:flex;gap:6px;overflow-x:auto;flex:1 1 100%;min-width:0;max-width:100%;padding-bottom:2px;-webkit-overflow-scrolling:touch}
.dm-side-item{width:auto;flex:0 0 auto;padding:8px 12px}
.dm-side-label{overflow:visible}
.dm-side-total{flex:1 1 100%;min-width:0;margin-top:6px}
}
@media(max-width:640px){
.dm-appl-head{align-items:flex-start}
.dm-appl-head-actions{width:100%;justify-content:space-between}
.dm-appl-grid{grid-template-columns:1fr}
.dm-appl-toolbar{align-items:stretch}
.dm-appl-sort{width:100%}
.dm-appl-sort select{width:100%}
}
/* dark theme */
[data-theme="dark"] .dm-appl-shell{--dm-soft:rgba(148,163,184,.12)}
[data-theme="dark"] .dm-appl-brand-ic{background:linear-gradient(140deg,rgba(14,165,233,.25),rgba(99,102,241,.2));color:#7dd3fc}
[data-theme="dark"] .dm-appl-viewtoggle button.active{background:rgba(14,165,233,.22);color:#7dd3fc}
[data-theme="dark"] .dm-side-overview.active,[data-theme="dark"] .dm-side-item.active{background:rgba(14,165,233,.18);color:#7dd3fc}
[data-theme="dark"] .dm-side-item.active .dm-side-count{background:rgba(14,165,233,.25);color:#bae6fd}
[data-theme="dark"] .dm-side-total{background:linear-gradient(180deg,rgba(14,165,233,.12),transparent 70%)}
[data-theme="dark"] .dm-ap-chip{background:rgba(59,130,246,.14)}
[data-theme="dark"] .dm-ap-hero{background:radial-gradient(120% 90% at 50% 8%,rgba(14,165,233,.16),rgba(30,41,59,.25) 62%,transparent)}
[data-theme="dark"] .dm-ap-badge.run{background:rgba(34,197,94,.16);color:#4ade80}
[data-theme="dark"] .dm-ap-badge.standby{background:rgba(59,130,246,.18);color:#93c5fd}
[data-theme="dark"] .dm-ap-badge.off{background:rgba(148,163,184,.14);color:#94a3b8}
[data-theme="dark"] .dm-ap-badge.unavailable{background:rgba(239,68,68,.16);color:#fca5a5}
[data-theme="dark"] .dm-appl-chips button.active{box-shadow:0 8px 18px rgba(14,165,233,.20)}
/* A movimento ridotto si spegne la decorazione, non l'informazione.
 *
 * «Ridotto» qui spegneva TUTTO — il cestello che gira, il vapore, il led — e
 * su Windows quell'impostazione e' spesso attiva senza che nessuno l'abbia
 * scelta per questa plancia: da desktop gli elettrodomestici in funzione
 * sembravano fermi, ed e' stato segnalato tre volte come animazioni "assenti".
 * Quei movimenti dicono che la macchina sta lavorando adesso, e restano.
 * Quello che l'impostazione continua a spegnere e' il resto: il sollevamento
 * al passaggio del mouse, il luccichio della barra, la ghiera che ruota. */
@media (prefers-reduced-motion:reduce){
.dm-appl-shell .dm-ap-card{transition:none}
.dm-appl-shell .dm-ap-card:hover{transform:none;box-shadow:0 12px 30px rgba(15,23,42,.06)}
.dm-appl-shell .dm-ap-bar.run i::after{animation:none;content:none}
.dm-appl-shell .dm-ap-ring.indeterminate svg{animation:none}
}
@keyframes dmDotPulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,.45)}70%{box-shadow:0 0 0 6px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}
@keyframes dmDotBreathe{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes dmBarSheen{0%{transform:translateX(-100%)}55%,100%{transform:translateX(100%)}}
@keyframes dmRingSpin{to{transform:rotate(270deg)}}
@keyframes dmDrumSpin{to{transform:rotate(360deg)}}
@keyframes dmWobble{0%,100%{transform:translateX(0)}25%{transform:translateX(-.8px)}75%{transform:translateX(.8px)}}
@keyframes dmWaterSway{0%,100%{transform:translateX(-2px)}50%{transform:translateX(2.5px)}}
@keyframes dmGlowPulse{0%,100%{opacity:.62}50%{opacity:1}}
@keyframes dmHeatRings{0%,100%{opacity:.35;transform:scale(.97)}50%{opacity:1;transform:scale(1.02)}}
@keyframes dmJets{0%,100%{opacity:.35;transform:scaleY(.86)}50%{opacity:1;transform:scaleY(1)}}
@keyframes dmPlate{0%,100%{transform:translateX(-6px)}50%{transform:translateX(6px)}}
@keyframes dmBreath{0%,100%{transform:scale(1)}50%{transform:scale(1.02)}}
@keyframes dmHeatPulse{0%,100%{opacity:.55}50%{opacity:1}}
@keyframes dmHeatRise{0%{transform:translateY(6px);opacity:0}35%{opacity:.9}100%{transform:translateY(-16px);opacity:0}}
@keyframes dmBubble{0%{transform:translateY(0) scale(.8);opacity:0}20%{opacity:.9}100%{transform:translateY(-92px) scale(1.15);opacity:0}}
@keyframes dmBubbleUp{0%{transform:translateY(10px);opacity:0}30%{opacity:.95}100%{transform:translateY(-18px);opacity:0}}
@keyframes dmSteam{0%{transform:translateY(8px) scaleY(.7);opacity:0}30%{opacity:.75}100%{transform:translateY(-22px) scaleY(1.2);opacity:0}}
@keyframes dmSteamRise{0%{transform:translateY(8px);opacity:0}35%{opacity:.85}100%{transform:translateY(-14px);opacity:0}}
@keyframes dmRover{0%,100%{transform:translateX(-5px)}50%{transform:translateX(5px)}}
@keyframes dmSway{0%,100%{transform:rotate(-1.1deg)}50%{transform:rotate(1.1deg)}}
@keyframes dmScreen{0%,100%{filter:brightness(1)}50%{filter:brightness(1.22) saturate(1.15)}}
@keyframes dmFrost{0%,100%{transform:scale(1);opacity:.75}50%{transform:scale(1.18);opacity:1}}
`;
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", installApplianceShowcaseSection, { once: true });
} else {
  installApplianceShowcaseSection();
}
