// DM-FIX-20260817D
/* Climate section redesign — the "Termica" card.
 *
 * Rebuilds #page-clima as one owner: a masthead with the zone readout, the
 * Freddo/Caldo segmented control and two card grids that put target and room
 * temperature on the same scale instead of printing two unrelated numbers.
 *
 * Contracts preserved on purpose — behaviour stays in the legacy runtime:
 * - the page keeps `.clima-zone-freddo` / `.clima-zone-caldo` and the `.show`
 *   class, plus `#clima-page-mode-freddo` / `#clima-page-mode-caldo` inside
 *   `.clima-page-mode-switch`, so `setClimaPageMode()` and the Beta 12 switch
 *   repair keep working untouched;
 * - the grids keep the ids `#clima-grid-freddo` / `#clima-grid-caldo` and the
 *   cards keep `id="card-<entity with dashes>"`, which is what every legacy
 *   caller looks up;
 * - the buttons call `setTemp()`, `toggleClima()` and `apriClimaPopup()`, so
 *   the service calls, the haptics and the HVAC/fan popup are unchanged. The
 *   card keeps its own `onclick="apriClimaPopup(...)"` so `cdAutoHide()` still
 *   finds the entity reference and hides unmapped units;
 * - the back arrow already in the page is moved back to the top of the section
 *   after every skeleton rebuild.
 *
 * The card no longer carries the legacy `.cp-card` / `.cp-header` / `.cp-body`
 * / `.cp-controls` / `.clima-premium-grid` class names. That is deliberate: the
 * Beta 4 / Beta 7 / Beta 16 / personalization layers all shipped `!important`
 * corrections for those names, so five stylesheets used to fight over one card.
 * With the new names none of those rules match any more and the page has a
 * single renderer and a single stylesheet, the same clean-up the Pool and
 * Irrigation redesign did.
 */
import { canonicalClimateType } from "../core/device-model.js";
import { climateIsOff } from "../core/climate-power.js";
import { roomOrderRank } from "../core/room-overview.js";
import { chiamaClima, commutaClima } from "./climate-power-section.js";
import { climatePanelMarkup } from "./home-widgets-section.js";
import {
  activeLocale,
  allStates,
  clean,
  doc,
  english,
  esc,
  finiteOrNull,
  installStyle,
  lexicalGlobal,
  readClimateUnits,
  readJson,
  root,
  scriviSeCambia,
  section,
  t,
  wrapFunction,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_CLIMATE_THERMAL__";
const STYLE_ID = "dm-climate-thermal-style";
const state = (root[KEY] ||= {
  installed: false,
  listeners: false,
  history: new Map(),
  climaAperta: "",
  climaAscolto: false,
});

/* Scale of the rail. Cooling units are set between 16° and 30°, radiators
 * between 10° and 28°, which is the range the legacy popup already clamps to. */
const RANGE = Object.freeze({ freddo: [16, 30], caldo: [10, 28] });
const SPARK = Object.freeze({ width: 132, height: 42, pad: 6, samples: 24 });
const OFF_STATES = new Set(["off", "unavailable", "unknown", "none", ""]);

const ICONS = Object.freeze({
  snow: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 2v20M4.2 7l15.6 10M19.8 7 4.2 17"/><path d="M12 6.2 9.6 4M12 6.2 14.4 4M12 17.8 9.6 20M12 17.8l2.4 2.2"/></svg>',
  flame:
    '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.5c3.2 3 4.8 5.6 4.8 8a4.8 4.8 0 0 1-9.6 0c0-1.3.5-2.5 1.4-3.6.3 1.4 1 2.2 2 2.4-.4-2.4.1-4.7 1.4-6.8Z"/><path d="M6.4 13.5A6.6 6.6 0 0 0 12 21.5a6.6 6.6 0 0 0 5.6-8"/></svg>',
  thermo:
    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M14 13.6V5a2 2 0 1 0-4 0v8.6a4.4 4.4 0 1 0 4 0Z"/><path d="M12 9.5v6.2"/></svg>',
  power:
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><path d="M12 2v10"/></svg>',
  minus:
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>',
  plus: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14M12 5v14"/></svg>',
  sliders:
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 8h16M4 16h16"/><circle cx="9.5" cy="8" r="2.6"/><circle cx="15" cy="16" r="2.6"/></svg>',
});

const FAN_LABELS = Object.freeze({
  auto: () => t("Auto", "Auto"),
  low: () => t("Min", "Low"),
  medium: () => t("Med", "Med"),
  medium_low: () => t("Med-", "Med-"),
  medium_high: () => t("Med+", "Med+"),
  high: () => t("Max", "High"),
  turbo: () => t("Turbo", "Turbo"),
  quiet: () => t("Silenzioso", "Quiet"),
});

const MODE_LABELS = Object.freeze({
  cool: () => t("Freddo", "Cooling"),
  heat: () => t("Caldo", "Heating"),
  auto: () => t("Auto", "Auto"),
  heat_cool: () => t("Auto", "Auto"),
  dry: () => t("Deumidifica", "Dry"),
  fan_only: () => t("Ventola", "Fan"),
});

const copy = () => ({
  title: t("Sistema climatico", "Climate system"),
  cold: t("Freddo", "Cooling"),
  warm: t("Caldo", "Heating"),
  onLabel: t("Accesi", "Running"),
  ambient: t("Ambiente medio", "Average room"),
  allOn: t("Accendi tutto", "Turn all on"),
  allOff: t("Spegni tutto", "Turn all off"),
  target: t("Target", "Target"),
  room: t("Ambiente", "Room"),
  off: t("Spento", "Off"),
  modes: t("Modalità", "Mode"),
  modesAria: t("Modalità e ventola", "Mode and fan speed"),
  warmer: t("Alza il target", "Raise the target"),
  cooler: t("Abbassa il target", "Lower the target"),
  power: t("Accendi o spegni", "Turn on or off"),
  coolers: t("Condizionatori", "Air conditioners"),
  radiators: t("Termosifoni", "Radiators"),
  emptyCold: t("Nessun condizionatore configurato", "No air conditioner configured"),
  emptyWarm: t("Nessun termosifone configurato", "No radiator configured"),
  emptyHint: t(
    "Aggiungi le unità dalla Configurazione della plancia.",
    "Add the units from the dashboard configuration.",
  ),
  unitsOne: t("1 unità", "1 unit"),
  units: (value) => t(`${value} unità`, `${value} units`),
  floorsOne: t("1 piano", "1 floor"),
  floors: (value) => t(`${value} piani`, `${value} floors`),
});

/* ── model ────────────────────────────────────────────────────────────── */

export function climateZone(unit) {
  return climateZones(unit)[0];
}

/* Le zone in cui l'unita' vive. Un condizionatore sta in Freddo, un
 * termosifone in Caldo; la pompa di calore (#195) raffresca e riscalda, quindi
 * compare in tutte e due — stessa entita', due card, e il tab Caldo la accende
 * per scaldare. */
export function climateZones(unit) {
  const type = canonicalClimateType(unit?.type);
  if (type === "termo") return ["caldo"];
  if (type === "pompa") return ["freddo", "caldo"];
  return ["freddo"];
}

export function climateUnits() {
  let values = null;
  if (typeof root.getClimaUnits === "function") {
    try {
      const legacy = root.getClimaUnits();
      if (Array.isArray(legacy) && legacy.length) values = legacy;
    } catch (_error) {}
  }
  if (!values) values = readClimateUnits();
  if (!Array.isArray(values)) return [];
  let rooms = [];
  try {
    rooms = root.cdRoomList?.() || [];
  } catch (_error) {}
  return values
    .flatMap((unit, index) => {
      const entity = clean(unit?.entity || unit?.entity_id || unit?.entities?.[0]);
      if (!entity) return [];
      // La prima zona tiene l'id storico `card-<entity>`: il runtime legacy
      // (`cdAutoHide`) lo cerca per nome. La card gemella della pompa di
      // calore, nell'altra zona, prende un suffisso per non duplicare l'id.
      return climateZones(unit).map((zone, extra) => ({
        entity,
        name: clean(unit?.name) || entity,
        room: unitRoom(unit, rooms),
        zone,
        cardId: `card-${entity.replaceAll(".", "-")}${extra ? `--${zone}` : ""}`,
        index,
      }));
    })
    .filter(Boolean);
}

/* The store normalizes a unit to `room_id`, the legacy editor still writes
 * `room` — and since the canonical registry landed, `room` itself often holds
 * an id like `room_msqjk307`. Whatever the field, the card has to print the
 * name the user typed, which is also what the floor grouping asks about. */
export function unitRoom(unit, rooms = null) {
  const reference = clean(unit?.room) || clean(unit?.room_id);
  if (!reference) return "";
  let list = rooms;
  if (!Array.isArray(list)) {
    try {
      list = root.cdRoomList?.() || [];
    } catch (_error) {
      list = [];
    }
  }
  const match = list.find(
    (room) => clean(room?.id) === reference || clean(room?.name) === reference,
  );
  return clean(match?.name) || reference;
}

function resolvedState(entity, states) {
  const reference = clean(entity);
  if (!reference) return null;
  const resolved = clean(root.resolveEntity?.(reference) || reference);
  return states?.[reference] || states?.[resolved] || null;
}

/**
 * One reading of a unit. `on` follows the legacy rule — anything that is not
 * off/unavailable counts as running — so the card agrees with the popup.
 */
export function climateReading(entity, states = allStates()) {
  const entry = resolvedState(entity, states);
  const raw = clean(entry?.state).toLowerCase();
  const attributes = entry?.attributes || {};
  return {
    known: Boolean(entry),
    on: Boolean(entry) && !OFF_STATES.has(raw),
    mode: raw,
    action: clean(attributes.hvac_action).toLowerCase(),
    target: finiteOrNull(attributes.temperature),
    ambient: finiteOrNull(attributes.current_temperature),
    fan: clean(attributes.fan_mode).toLowerCase(),
  };
}

function stateLabel(reading, zone, labels) {
  if (!reading.on) return labels.off;
  if (reading.mode === "fan_only") return t("Ventilazione", "Fan only");
  if (reading.mode === "dry") return t("Deumidifica", "Drying");
  if (reading.action === "idle") return t("In pausa", "Idle");
  // La modalita' viva comanda: la card gemella della pompa di calore nel tab
  // Caldo non deve dire «Riscalda» mentre l'unita' sta raffrescando.
  if (reading.mode === "cool") return t("Raffresca", "Cooling");
  if (reading.mode === "heat" || zone === "caldo") return t("Riscalda", "Heating");
  return t("Raffresca", "Cooling");
}

function modeCaption(reading, labels) {
  if (!reading.on) return labels.modes;
  const mode = MODE_LABELS[reading.mode]?.() || labels.modes;
  const fan = reading.fan ? FAN_LABELS[reading.fan]?.() || reading.fan : "";
  return fan ? `${mode} · ${fan}` : mode;
}

function ratio(value, zone) {
  const [low, high] = RANGE[zone];
  if (value === null) return null;
  return Math.min(1, Math.max(0, (value - low) / (high - low)));
}

/* ── ambient history (kept in memory, no polling and no history API) ──── */

function pushSample(entity, ambient) {
  if (ambient === null) return false;
  const series = state.history.get(entity) || [];
  const last = series[series.length - 1];
  if (last !== undefined && Math.abs(last - ambient) < 0.05) return false;
  series.push(ambient);
  while (series.length > SPARK.samples) series.shift();
  state.history.set(entity, series);
  return true;
}

/* Il filo della temperatura si adatta al minimo e al massimo della serie: fra
 * 21 e 22 gradi il movimento c'e' e va visto. Quello dei consumi parte invece
 * da zero, ed e' un'altra funzione — avevano lo stesso nome. */
export function filoFraMinimoEMassimo(series, { width, height, pad } = SPARK) {
  if (!Array.isArray(series) || series.length < 3) return null;
  const low = Math.min(...series);
  const high = Math.max(...series);
  const span = high - low || 1;
  const points = series.map((value, index) => [
    (index / (series.length - 1)) * (width - pad) + pad / 2,
    pad + (1 - (value - low) / span) * (height - pad * 2),
  ]);
  const line = points
    .map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const last = points[points.length - 1];
  return {
    line,
    area: `${line} L${last[0].toFixed(1)} ${height} L${points[0][0].toFixed(1)} ${height} Z`,
    end: last,
  };
}

/* ── markup ───────────────────────────────────────────────────────────── */

function zoneButton(zone, labels) {
  const cold = zone === "freddo";
  return `<button type="button" class="clima-page-mode-btn dm-cl-tab${cold ? " active-freddo" : ""}"
      id="clima-page-mode-${cold ? "freddo" : "caldo"}" data-dm-cl-zone="${zone}"
      aria-pressed="${cold ? "true" : "false"}" onclick="setClimaPageMode('${zone}')">
      <span class="icon dm-cl-tab-ic">${cold ? ICONS.snow : ICONS.flame}</span>
      <span class="dm-cl-tab-tx">${esc(cold ? labels.cold : labels.warm)}</span>
      <span class="dm-cl-tab-count" data-dm-cl-count="${zone}">0</span>
    </button>`;
}

function skeletonMarkup(labels) {
  return `<div class="dm-cl-shell" data-dm-lang="${activeLocale()}">
  <div class="dm-cl-mast">
    <span class="dm-cl-mast-ic" aria-hidden="true">${ICONS.thermo}</span>
    <div class="dm-cl-mast-copy">
      <h2>${esc(labels.title)}</h2>
      <p data-dm-cl-sub></p>
    </div>
    <div class="dm-cl-summary">
      <div class="dm-cl-kpi">
        <span>${esc(labels.onLabel)}</span>
        <b data-dm-cl-running>0<small> / 0</small></b>
      </div>
      <div class="dm-cl-kpi">
        <span>${esc(labels.ambient)}</span>
        <b data-dm-cl-average>--°</b>
      </div>
      <div class="dm-cl-bulk">
        <button type="button" data-dm-cl-bulk="on">${ICONS.power}${esc(labels.allOn)}</button>
        <span class="dm-cl-bulk-div" aria-hidden="true"></span>
        <button type="button" data-dm-cl-bulk="off">${ICONS.power}${esc(labels.allOff)}</button>
      </div>
    </div>
  </div>

  <div class="clima-page-mode-switch dm-cl-switch">
    ${zoneButton("freddo", labels)}
    ${zoneButton("caldo", labels)}
  </div>

  <div class="clima-zone clima-zone-freddo show">
    <div class="dm-cl-grid" id="clima-grid-freddo"></div>
  </div>
  <div class="clima-zone clima-zone-caldo">
    <div class="dm-cl-grid" id="clima-grid-caldo"></div>
  </div>
</div>`;
}

function emptyMarkup(zone, labels) {
  return `<div class="dm-cl-empty">
      <span class="dm-cl-empty-ic" aria-hidden="true">${zone === "caldo" ? ICONS.flame : ICONS.snow}</span>
      <strong>${esc(zone === "caldo" ? labels.emptyWarm : labels.emptyCold)}</strong>
      <p>${esc(labels.emptyHint)}</p>
    </div>`;
}

function cardMarkup(unit, labels) {
  const [low, high] = RANGE[unit.zone];
  const entity = esc(unit.entity).replaceAll("'", "&#39;");
  // The family is already in the masthead, so an unassigned unit shows nothing
  // here rather than repeating "Condizionatori" on every card.
  const meta = unit.room;
  return `<article class="dm-cl-card" id="${esc(unit.cardId)}" data-dm-cl="${esc(unit.entity)}"
      data-dm-cl-zone="${unit.zone}" onclick="apriClimaPopup('${entity}', event)">
      <div class="dm-cl-head">
        <span class="dm-cl-ic" aria-hidden="true">${unit.zone === "caldo" ? ICONS.flame : ICONS.snow}</span>
        <div class="dm-cl-txt">
          <div class="dm-cl-name">${esc(unit.name)}</div>
          ${meta ? `<div class="dm-cl-meta">${esc(meta)}</div>` : ""}
        </div>
        <span class="dm-cl-state"><i aria-hidden="true"></i><span data-dm-cl-state>${esc(labels.off)}</span></span>
      </div>
      <div class="dm-cl-main">
        <div class="dm-cl-target">
          <b data-dm-cl-target>--<span class="dm-cl-deg">°</span></b>
          <span class="dm-cl-cap">${esc(labels.target)}</span>
        </div>
        <svg class="dm-cl-spark" viewBox="0 0 ${SPARK.width} ${SPARK.height}" data-dm-cl-spark hidden aria-hidden="true">
          <path class="dm-cl-spark-area" d=""></path>
          <path class="dm-cl-spark-line" d=""></path>
          <circle class="dm-cl-spark-end" cx="0" cy="0" r="3"></circle>
        </svg>
      </div>
      <div class="dm-cl-rail" aria-hidden="true">
        <span class="dm-cl-bed"></span>
        <span class="dm-cl-fill" data-dm-cl-fill></span>
        <span class="dm-cl-mark" data-dm-cl-mark hidden></span>
        <span class="dm-cl-knob" data-dm-cl-knob hidden></span>
      </div>
      <div class="dm-cl-legend">
        <span>${low}°</span>
        <span>${esc(labels.room)} <b data-dm-cl-ambient>--°</b></span>
        <span>${high}°</span>
      </div>
      <div class="dm-cl-foot">
        <button type="button" class="dm-cl-modes" data-dm-cl-modes aria-label="${esc(labels.modesAria)}"
          onclick="event.stopPropagation(); apriClimaPopup('${entity}')">
          ${ICONS.sliders}<span data-dm-cl-mode-cap>${esc(labels.modes)}</span>
        </button>
        <div class="dm-cl-actions">
          <button type="button" class="dm-cl-step" aria-label="${esc(labels.cooler)}"
            onclick="event.stopPropagation(); setTemp('${entity}', 'down')">${ICONS.minus}</button>
          <button type="button" class="dm-cl-step" aria-label="${esc(labels.warmer)}"
            onclick="event.stopPropagation(); setTemp('${entity}', 'up')">${ICONS.plus}</button>
          <button type="button" class="dm-cl-pwr" data-dm-cl-pwr aria-label="${esc(labels.power)}"
            onclick="event.stopPropagation(); toggleClima('${entity}', '${unit.zone}')">${ICONS.power}</button>
        </div>
      </div>
    </article>`;
}

/* Group by floor only. The legacy grouping printed one heading per room, which
 * on this layout means a heading above every single card; the room already has
 * its own line inside the card. */
/* Quale stanza viene prima, secondo la configurazione.
 *
 * L'ordine lo decide chi ci abita, nella scheda Stanze, e la risposta la da'
 * il nucleo: qui si legge soltanto l'elenco salvato. */
function ordineStanze() {
  try {
    return roomOrderRank(section("rooms", readJson("cd_stanze", [])) || []);
  } catch (_error) {
    return () => Number.MAX_SAFE_INTEGER;
  }
}

function floorOf(unit) {
  try {
    return clean(root.cdRoomFloorOf?.(unit.room));
  } catch (_error) {
    return "";
  }
}

function groupedMarkup(units, labels) {
  const groups = new Map();
  for (const unit of units) {
    const floor = floorOf(unit);
    if (!groups.has(floor)) groups.set(floor, []);
    groups.get(floor).push(unit);
  }
  const order = [];
  try {
    const names = root.cdFloorNames?.();
    if (Array.isArray(names)) order.push(...names.map(clean));
  } catch (_error) {}
  const keys = [...groups.keys()].sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    return (ia < 0 ? 9999 : ia) - (ib < 0 ? 9999 : ib);
  });
  /* Dentro il piano, le stanze nell'ordine scelto in configurazione.
   *
   * Qui non si ordinava affatto: le unita' uscivano nell'ordine in cui erano
   * state configurate. Chi si era messo in fila le stanze — «ho ordinato le
   * stanze ma poi l'ordinamento non me lo ritrovo da nessuna parte, tipo
   * nelle pagine delle luci, clima, tapparelle» — qui non lo ritrovava. */
  const stanza = ordineStanze();
  return keys
    .map((floor) => {
      const cards = groups
        .get(floor)
        .slice()
        .sort((sinistra, destra) => stanza(sinistra.room) - stanza(destra.room))
        .map((unit) => cardMarkup(unit, labels))
        .join("");
      const heading =
        floor && keys.length > 1 ? `<div class="dm-cl-floor">🏢 ${esc(floor)}</div>` : "";
      return `${heading}${cards}`;
    })
    .join("");
}

/* ── rendering ────────────────────────────────────────────────────────── */

function ensureSkeleton(host, labels) {
  if (host.querySelector(":scope > .dm-cl-shell")) return false;
  const backButton = host.querySelector(":scope > .back-home-btn");
  host.innerHTML = skeletonMarkup(labels);
  // The back arrow belongs to the page, not to the shell: put it back on top.
  if (backButton) host.insertBefore(backButton, host.firstChild);
  return true;
}

function signature(units) {
  return JSON.stringify(units.map((unit) => [unit.entity, unit.name, unit.room, unit.zone]));
}

function syncGrid(grid, units, labels) {
  const current = signature(units);
  if (grid._dmClimaSig === current) return false;
  grid.innerHTML = units.length
    ? groupedMarkup(units, labels)
    : emptyMarkup(grid.dataset.dmClZone, labels);
  grid._dmClimaSig = current;
  return true;
}

function visibleZone() {
  return doc?.querySelector(".clima-zone-caldo.show") ? "caldo" : "freddo";
}

/* «Flag per invertire i dati della card: target sotto al posto di ambiente,
 * ambiente sopra al posto di target» — c'e' chi guarda la card per sapere
 * quanti gradi FA la stanza, non quanti ne chiede. Il flag e' uno per la
 * sezione, vive in `cd_clima_inverti_card` e viaggia con la configurazione. */
function cartaInvertita() {
  try {
    return root.localStorage?.getItem?.("cd_clima_inverti_card") === "1";
  } catch (_errore) {
    return false;
  }
}

function paintCard(card, unit, reading, labels) {
  const zone = unit.zone;
  card.classList.toggle("is-on", reading.on);
  card.dataset.dmClMode = reading.on ? reading.mode : "off";

  const stateChip = card.querySelector("[data-dm-cl-state]");
  if (stateChip) stateChip.textContent = stateLabel(reading, zone, labels);

  /* Col flag acceso il numero grande e' l'ambiente e la riga piccola il
   * target; le didascalie seguono i numeri, o direbbero il falso. */
  const invertita = cartaInvertita();
  const grande = invertita ? reading.ambient : reading.target;
  const piccolo = invertita ? reading.target : reading.ambient;
  const target = card.querySelector("[data-dm-cl-target]");
  if (target) {
    target.innerHTML =
      grande === null
        ? `--<span class="dm-cl-deg">°</span>`
        : `${Math.round(grande * 10) / 10}<span class="dm-cl-deg">°</span>`;
  }
  const didascalia = card.querySelector(".dm-cl-cap");
  if (didascalia) didascalia.textContent = invertita ? labels.room : labels.target;

  const ambient = card.querySelector("[data-dm-cl-ambient]");
  if (ambient) {
    ambient.textContent = piccolo === null ? "--°" : `${piccolo.toFixed(1)}°`;
    const parola = ambient.parentElement?.firstChild;
    if (parola && parola.nodeType === 3)
      parola.nodeValue = `${invertita ? labels.target : labels.room} `;
  }

  const caption = card.querySelector("[data-dm-cl-mode-cap]");
  if (caption) caption.textContent = modeCaption(reading, labels);

  const targetRatio = ratio(reading.target, zone);
  const fill = card.querySelector("[data-dm-cl-fill]");
  const knob = card.querySelector("[data-dm-cl-knob]");
  if (fill) fill.style.width = targetRatio === null ? "0%" : `${(targetRatio * 100).toFixed(1)}%`;
  if (knob) {
    knob.hidden = targetRatio === null;
    if (targetRatio !== null) knob.style.left = `${(targetRatio * 100).toFixed(1)}%`;
  }
  const ambientRatio = ratio(reading.ambient, zone);
  const mark = card.querySelector("[data-dm-cl-mark]");
  if (mark) {
    mark.hidden = ambientRatio === null;
    if (ambientRatio !== null) mark.style.left = `${(ambientRatio * 100).toFixed(1)}%`;
  }

  paintSpark(card, unit, reading);
}

function paintSpark(card, unit, reading) {
  const svg = card.querySelector("[data-dm-cl-spark]");
  if (!svg) return;
  const changed = pushSample(unit.entity, reading.ambient);
  const series = state.history.get(unit.entity) || [];
  const path = filoFraMinimoEMassimo(series);
  if (!path) {
    svg.hidden = true;
    return;
  }
  svg.hidden = false;
  if (!changed && svg.dataset.dmClDrawn === String(series.length)) return;
  svg.dataset.dmClDrawn = String(series.length);
  svg.querySelector(".dm-cl-spark-area")?.setAttribute("d", path.area);
  svg.querySelector(".dm-cl-spark-line")?.setAttribute("d", path.line);
  const end = svg.querySelector(".dm-cl-spark-end");
  if (end) {
    end.setAttribute("cx", path.end[0].toFixed(1));
    end.setAttribute("cy", path.end[1].toFixed(1));
  }
}

function paintSummary(shell, units, states, labels) {
  const zone = zoneWithUnits(units, visibleZone());
  // A page that opens on a zone nobody configured shows an empty grid: put it
  // on the zone that has something, through the runtime's own switch so the
  // two grids and the two buttons stay in step with it.
  if (zone !== visibleZone()) {
    try {
      root.setClimaPageMode?.(zone, true);
    } catch (_error) {}
  }
  const inZone = units.filter((unit) => unit.zone === zone);
  const readings = inZone.map((unit) => climateReading(unit.entity, states));
  const running = readings.filter((reading) => reading.on).length;
  const ambient = readings.map((reading) => reading.ambient).filter((value) => value !== null);

  const runningEl = shell.querySelector("[data-dm-cl-running]");
  if (runningEl) runningEl.innerHTML = `${running}<small> / ${inZone.length}</small>`;
  const averageEl = shell.querySelector("[data-dm-cl-average]");
  if (averageEl) {
    averageEl.textContent = ambient.length
      ? `${(ambient.reduce((sum, value) => sum + value, 0) / ambient.length).toFixed(1)}°`
      : "--°";
  }
  const subtitle = shell.querySelector("[data-dm-cl-sub]");
  if (subtitle) {
    const family = zone === "caldo" ? labels.radiators : labels.coolers;
    const count = inZone.length === 1 ? labels.unitsOne : labels.units(inZone.length);
    subtitle.textContent = inZone.length ? `${family} · ${count}` : family;
  }
  for (const button of shell.querySelectorAll("[data-dm-cl-bulk]")) {
    const wantsOn = button.dataset.dmClBulk === "on";
    button.disabled = wantsOn ? running === inZone.length : running === 0;
  }
  for (const badge of shell.querySelectorAll("[data-dm-cl-count]")) {
    badge.textContent = String(
      units.filter((unit) => unit.zone === badge.dataset.dmClCount).length,
    );
  }
  paintZoneTabs(shell, units);
  shell.dataset.dmClZone = zone;
}

/* Only the zones that have something in them.
 *
 * The page always offered both Freddo and Caldo, so a house with only air
 * conditioners had a Caldo tab that opened on nothing, and one with only
 * radiators a Freddo tab that did the same. A zone with no unit configured
 * takes its tab with it, and when a single zone is left the switch goes too:
 * there is nothing to switch between. The buttons stay in the document, with
 * their ids and their handler, because `setClimaPageMode()` writes to them. */
function paintZoneTabs(shell, units) {
  let configured = 0;
  // Only the buttons: the two grids carry the same attribute, and counting them
  // as well meant every house looked like it had both zones.
  for (const tab of shell.querySelectorAll(".clima-page-mode-btn[data-dm-cl-zone]")) {
    const zone = tab.dataset.dmClZone;
    const has = units.some((unit) => unit.zone === zone);
    if (has) configured += 1;
    const value = has ? "false" : "true";
    if (tab.dataset.dmClEmpty !== value) tab.dataset.dmClEmpty = value;
  }
  // Marked on the shell, which the render keeps, and not on the switch, which a
  // rebuild replaces.
  const zones = String(configured);
  if (shell.dataset.dmClZones !== zones) shell.dataset.dmClZones = zones;
}

/* The zone on screen has to be one that exists: a house with radiators only
 * opened on Freddo, which is empty, and the page looked broken until the user
 * found the other tab. */
function zoneWithUnits(units, current) {
  if (units.some((unit) => unit.zone === current)) return current;
  const other = current === "caldo" ? "freddo" : "caldo";
  return units.some((unit) => unit.zone === other) ? other : current;
}

export function renderClimate({ rebuild = false } = {}) {
  const host = doc?.getElementById?.("page-clima");
  if (!host) return false;
  const labels = copy();
  ensureSkeleton(host, labels);
  const shell = host.querySelector(":scope > .dm-cl-shell");
  if (!shell) return false;

  const units = climateUnits();
  // Marked here, on the shell this pass owns: paintSummary can switch the page
  // to the other zone, and the render that follows replaces the shell under it.
  paintZoneTabs(shell, units);
  for (const zone of ["freddo", "caldo"]) {
    const grid = doc.getElementById(`clima-grid-${zone}`);
    if (!grid) continue;
    grid.dataset.dmClZone = zone;
    if (rebuild) grid._dmClimaSig = "";
    syncGrid(
      grid,
      units.filter((unit) => unit.zone === zone),
      labels,
    );
  }

  const states = allStates();
  for (const unit of units) {
    const card = doc.getElementById(unit.cardId);
    if (card) paintCard(card, unit, climateReading(unit.entity, states), labels);
  }
  paintSummary(shell, units, states, labels);
  return true;
}

/* ── wiring ───────────────────────────────────────────────────────────── */

function bulkSwitch(wantsOn) {
  if (typeof root.toggleClima !== "function") return;
  const zone = visibleZone();
  const states = allStates();
  for (const unit of climateUnits()) {
    if (unit.zone !== zone) continue;
    const reading = climateReading(unit.entity, states);
    if (!reading.known || reading.on === wantsOn) continue;
    root.toggleClima(unit.entity, zone);
  }
  root.queueMicrotask?.(() => renderClimate());
}

function onClick(event) {
  const button = event.target?.closest?.("[data-dm-cl-bulk]");
  if (!button || button.disabled) return;
  event.preventDefault();
  bulkSwitch(button.dataset.dmClBulk === "on");
}

/**
 * One step, one degree — everywhere.
 *
 * The card's ± call `setTemp()`, which has moved by a whole degree since v253.
 * The HVAC popup still ships `onclick="cpSetTemp(±0.5)"` in the legacy markup,
 * so the same unit answered with half a degree there and a full one here. This
 * keeps the legacy service call and only corrects the delta it is handed: aim
 * at the whole degree above or below the value the popup is showing.
 */
export function wholeDegreeDelta(shown, delta) {
  const down = Number(delta) < 0;
  const current = Number(shown);
  if (!Number.isFinite(current)) return down ? -1 : 1;
  // A unit parked on a half degree walks to the next whole one, not past it.
  const next = down ? Math.ceil(current) - 1 : Math.floor(current) + 1;
  return next - current;
}

function installTemperatureStep() {
  const current = root.cpSetTemp;
  if (typeof current !== "function" || current.__dmClimateThermal) return;
  function cpSetTempThermal(delta) {
    const shown = parseFloat(clean(doc?.getElementById("cp-temp-val")?.textContent));
    return current.call(this, wholeDegreeDelta(shown, delta));
  }
  cpSetTempThermal.__dmClimateThermal = true;
  cpSetTempThermal.__dmPrevious = current;
  root.cpSetTemp = cpSetTempThermal;
}

/**
 * The legacy `buildClimaCards` / `updateClimaCards` are called by the editor,
 * by the store render coordinator and by the main render loop. Route all of
 * them here so nothing repaints the legacy markup underneath this page.
 */
function installOverrides() {
  const build = root.buildClimaCards;
  if (typeof build !== "function" || !build.__dmClimateThermal) {
    function buildClimaCardsThermal() {
      return renderClimate({ rebuild: true });
    }
    buildClimaCardsThermal.__dmClimateThermal = true;
    buildClimaCardsThermal.__dmPrevious = build;
    root.buildClimaCards = buildClimaCardsThermal;
  }
  const update = root.updateClimaCards;
  if (typeof update !== "function" || !update.__dmClimateThermal) {
    function updateClimaCardsThermal() {
      return renderClimate();
    }
    updateClimaCardsThermal.__dmClimateThermal = true;
    updateClimaCardsThermal.__dmPrevious = update;
    root.updateClimaCards = updateClimaCardsThermal;
  }
  installTemperatureStep();
  // Switching zone changes what the readout summarises.
  wrapFunction("setClimaPageMode", "__dmClimateThermalMode", () => renderClimate());
  installPannelloDellaFinestra();
  installClimaRapido();
}

/* Il «Clima rapido» disegnava le stanze di un'altra casa.
 *
 * Nel runtime storico c'e' un elenco scritto a mano — Matrimoniale,
 * Cameretta, Cucina, Salone, Bagno, Studio — con dentro le caselle fisse di
 * quella casa. Non e' configurabile da nessuna parte: chi ha altre stanze
 * apriva quel popup e trovava sei tasti coi nomi di casa d'altri, legati a
 * caselle che magari non ha mai riempito.
 *
 * Le unita' del clima le sa la configurazione, ed e' la stessa che disegna la
 * pagina Clima e la scheda: la griglia adesso viene di li'. Il tasto resta
 * quello di prima — stesso vestito, stesso gesto — ma parla della casa vera. */
function unitaDelModo(modo) {
  const freddo = clean(modo).toLowerCase() !== "caldo";
  const grezze = readClimateUnits();
  const perEntita = new Map();
  for (const grezza of Array.isArray(grezze) ? grezze : []) {
    const entity = clean(grezza?.entity || grezza?.entity_id || grezza?.entities?.[0]);
    if (entity && !perEntita.has(entity)) perEntita.set(entity, grezza);
  }
  const viste = new Set();
  return climateUnits().filter((unita) => {
    if (viste.has(unita.entity)) return false;
    const zone = climateZones(perEntita.get(unita.entity) || {});
    if (!zone.includes(freddo ? "freddo" : "caldo")) return false;
    viste.add(unita.entity);
    return true;
  });
}

/* Il disegno di casa della stanza di un'unita', se la stanza ha un'icona.
 *
 * La stanza si cerca prima dal riferimento dell'unita', e poi — dal campo:
 * «Bagno e Camera da Letto non sono congrue, esce la fiamma» — dal NOME
 * dell'unita': chi chiama l'unita' come la stanza non ha configurato il
 * legame, ma la stanza e' evidentemente quella. */
function disegnoDellaStanza(riferimento, nomeUnita) {
  let stanze = [];
  try {
    stanze = root.cdRoomList?.() || [];
  } catch (_error) {
    stanze = [];
  }
  const cerca = (chiave) =>
    chiave
      ? stanze.find(
          (voce) =>
            clean(voce?.id) === chiave || clean(voce?.name).toLowerCase() === chiave.toLowerCase(),
        )
      : null;
  const stanza = cerca(clean(riferimento)) || cerca(clean(nomeUnita));
  const icona = clean(stanza?.icon);
  if (!icona) return "";
  try {
    return root.DashboardModernIconEngine?.markup?.("room", icona, { size: 46 }) || "";
  } catch (_error) {
    return "";
  }
}

/* Il ripiego quando la stanza non c'e' o non ha disegno: il termosifone o il
 * fiocco di neve del catalogo di casa, non l'emoji nuda — la fiamma gigante
 * di sistema stonava con tutto il resto della plancia. L'emoji resta solo
 * come ultima spiaggia, se il motore dei disegni non risponde. */
function disegnoDelModo(freddo) {
  try {
    return (
      root.DashboardModernIconEngine?.markup?.(
        "action",
        freddo ? "mdi:snowflake" : "mdi:radiator",
        {
          size: 46,
        },
      ) || ""
    );
  } catch (_error) {
    return "";
  }
}

/* Il tocco della parte Caldo, per chi e' un termostato vero.
 *
 * Il runtime storico accende il Caldo con `nsToggleTerm`, che parla solo la
 * lingua degli input_boolean: per i termosifoni pilotati da un'automazione va
 * benissimo, ma un'unita' Caldo che e' una entita' climate.* riceveva una
 * chiamata che il suo dominio non conosce — e il Tasto Clima rapido, appena
 * diventato per-unita', dalla parte Caldo non parlava proprio. Qui il
 * termostato si accende coi SUOI passi (ripiego: riscaldamento, senza toccare
 * altro) e si spegne con la stessa regola dei pulsanti della pagina. */
function toccoCaldoTermostato(entity) {
  const stato = allStates()?.[entity] || null;
  root.navigator?.vibrate?.(15);
  if (stato && !climateIsOff(stato)) {
    commutaClima(entity, false, "caldo");
  } else {
    let passi = null;
    try {
      passi = root.dmQuickClimateSteps?.(entity, "caldo");
    } catch (_error) {
      passi = null;
    }
    if (!Array.isArray(passi) || !passi.length)
      passi = [{ service: "set_hvac_mode", data: { hvac_mode: "heat" } }];
    /* Distanziati nel tempo come nel ramo Freddo: mandare la temperatura a
     * un'unita' ancora spenta la fa cadere nel vuoto. */
    passi.forEach((passo, indice) => {
      const manda = () => chiamaClima(entity, passo.service, passo.data);
      if (indice === 0) manda();
      else root.setTimeout?.(manda, indice * 700);
    });
  }
  root.setTimeout?.(() => root.renderQuickClima?.(), 500);
}

function tastoRapido(unita, states) {
  const stato = states?.[unita.entity];
  const grezzo = clean(stato?.state).toLowerCase();
  const acceso = Boolean(grezzo) && !["off", "unavailable", "unknown"].includes(grezzo);
  const modo = clean(lexicalGlobal("currentClimaMode")).toLowerCase() || "freddo";
  const freddo = modo !== "caldo";
  let gradi = "";
  if (freddo && stato) {
    const obiettivo = stato.attributes?.temperature;
    const ambiente = stato.attributes?.current_temperature;
    if (acceso && obiettivo !== undefined) gradi = `${obiettivo}°`;
    else if (ambiente !== undefined) gradi = `${Math.round(ambiente)}°`;
  }
  const tasto = doc.createElement("button");
  tasto.type = "button";
  tasto.className = `ns-clima-btn${acceso ? (freddo ? " on-clima" : " on-heat") : ""}`;
  tasto.setAttribute("data-entity", unita.entity);
  tasto.onclick = () => {
    if (freddo) root.nsToggleClima?.(unita.entity);
    else if (clean(unita.entity).startsWith("climate.")) toccoCaldoTermostato(unita.entity);
    else root.nsToggleTerm?.(unita.entity);
  };
  const nome = clean(unita.name) || clean(unita.room) || unita.entity;
  /* L'icona e' quella della STANZA, dal catalogo dei disegni di casa: prima
   * bastava avere una stanza per ritrovarsi una porta (🚪) — «che c'entra
   * l'icona porta nel clima». Senza stanza (nemmeno per nome), o senza
   * disegno, parla il modo — ma col disegno di casa, non con l'emoji. */
  const disegno = disegnoDellaStanza(unita.room, unita.name) || disegnoDelModo(freddo);
  const icona = freddo ? "❄️" : "🔥";
  tasto.innerHTML =
    `${gradi ? `<span class="ns-clima-btn-temp">${esc(gradi)}</span>` : ""}` +
    `<span class="ns-clima-btn-icon">${disegno || esc(icona)}</span>` +
    `<span class="ns-clima-btn-name">${esc(nome)}</span>`;
  return tasto;
}

export function disegnaClimaRapido() {
  const griglia = doc?.getElementById?.("quick-clima-grid");
  if (!griglia) return false;
  /* Senza nemmeno un'unita' configurata non c'e' niente di meglio da mettere:
   * si lascia quello che il runtime ha disegnato. */
  if (!climateUnits().length) return false;
  const modo = clean(lexicalGlobal("currentClimaMode")).toLowerCase() || "freddo";
  const unita = unitaDelModo(modo);
  const states = allStates();
  griglia.replaceChildren();
  if (!unita.length) {
    const vuoto = doc.createElement("p");
    vuoto.className = "ns-clima-empty";
    vuoto.textContent =
      modo === "caldo"
        ? t("Nessun termosifone configurato", "No radiator configured")
        : t("Nessun condizionatore configurato", "No air conditioner configured");
    griglia.append(vuoto);
    return true;
  }
  for (const voce of unita) griglia.append(tastoRapido(voce, states));
  return true;
}

function installClimaRapido() {
  wrapFunction("renderQuickClima", "__dmClimaRapidoStanze", () => disegnaClimaRapido());
}

/* La finestra della pagina Clima prende il pannello della tessera.
 *
 * Nel guscio le modalita' sono cinque, scritte a mano: freddo, caldo, ventola,
 * secco, auto — le stesse per tutti, e nascoste in blocco quando il nome
 * dell'entita' contiene la parola «termosifone». Un tasto che l'unita' non sa
 * eseguire e' peggio di un tasto che non c'e', e una pompa di calore chiamata
 * in un altro modo restava senza modalita' del tutto.
 *
 * Il pannello della tessera quelle cose le sa gia': legge `hvac_modes` e
 * `fan_modes` dell'unita' aperta e offre solo quelle. Qui si mette al posto
 * delle due sezioni scritte a mano. I tasti li ascolta il giro dei widget, che
 * ascolta il documento e non la finestra: non c'e' niente da ricucire. */
function pannelloNellaFinestra(entity) {
  const finestra = doc?.querySelector?.("#clima-popup-overlay .clima-popup");
  if (!finestra) return false;
  const modalita = doc.getElementById("cp-mode-section");
  const ventola = doc.getElementById("cp-fan-section");
  const markup = climatePanelMarkup(entity);
  let ospite = finestra.querySelector("[data-dm-cl-panel]");
  /* Si scrive `display`, non `hidden`: le due sezioni del guscio se lo
   * scrivono da sole a ogni apertura, in linea, e una regola in linea batte
   * l'attributo. */
  if (!markup) {
    ospite?.remove();
    /* Senza pannello si torna a quello che c'era: e' meglio di niente. */
    for (const nodo of [modalita, ventola]) nodo?.style?.removeProperty("display");
    return false;
  }
  for (const nodo of [modalita, ventola]) nodo?.style?.setProperty("display", "none", "important");
  if (!ospite) {
    ospite = doc.createElement("div");
    ospite.setAttribute("data-dm-cl-panel", "");
    (modalita || ventola)?.before(ospite);
    if (!ospite.isConnected) finestra.append(ospite);
  }
  scriviSeCambia(ospite, markup);
  intestazioneDellaFinestra(entity);
  return true;
}

/* E il nome in cima alla finestra e' quello che si e' scelto.
 *
 * Nel guscio c'e' una tabella scritta a mano che traduce dieci entita' — le
 * dieci della casa di chi ha scritto la plancia — in «Condizionatore Salone» e
 * simili; per tutte le altre resta il pezzo dopo il punto dell'entita'. In una
 * casa qualunque vuol dire aprire «Pompa Salone» e leggere «pompa». Il nome
 * vero e la stanza stanno nella configurazione, che e' dove li si e' scritti. */
const ICONE_CLIMA = Object.freeze({ termo: "🔥", pompa: "♨️", clima: "❄️" });

function intestazioneDellaFinestra(entity) {
  const chiave = clean(entity);
  const grezza = readClimateUnits().find(
    (voce) => clean(voce?.entity || voce?.entity_id || voce?.entities?.[0]) === chiave,
  );
  const unita = climateUnits().find((voce) => voce.entity === chiave);
  if (!unita) return false;
  const nome = doc?.getElementById?.("cp-name");
  const stanza = doc?.getElementById?.("cp-room");
  const glifo = ICONE_CLIMA[canonicalClimateType(grezza?.type)] || "🌡️";
  if (nome && clean(unita.name)) nome.textContent = unita.name;
  if (stanza) stanza.textContent = `${glifo} ${clean(unita.room) || t("Clima", "Climate")}`;
  return true;
}

/* Qui non basta `wrapFunction`: quello richiama a cose fatte ma senza dire con
 * che argomenti, e l'entita' aperta e' proprio l'argomento. */
function installPannelloDellaFinestra() {
  const originale = root.apriClimaPopup;
  if (typeof originale !== "function" || originale.__dmClimaPopupPanel) return false;
  function avvolto(entity, ...resto) {
    const esito = originale.call(this, entity, ...resto);
    state.climaAperta = clean(entity);
    root.queueMicrotask?.(() => pannelloNellaFinestra(state.climaAperta));
    return esito;
  }
  Object.assign(avvolto, originale);
  avvolto.__dmClimaPopupPanel = true;
  avvolto.__dmPrevious = originale;
  root.apriClimaPopup = avvolto;
  /* Finche' la finestra e' aperta il pannello segue i gradi: cambia l'unita',
   * cambia quello che c'e' scritto sui tasti. */
  if (!state.climaAscolto) {
    state.climaAscolto = true;
    root.addEventListener?.("dashboardmodern:state-changed", () => {
      const velo = doc?.getElementById?.("clima-popup-overlay");
      if (velo?.classList?.contains("show") && state.climaAperta)
        pannelloNellaFinestra(state.climaAperta);
    });
  }
  return true;
}

/* La casella nella scheda Clima della configurazione: un flag solo per
 * tutta la sezione. Si monta quando la scheda c'e' (si riconosce dal suo
 * campo stanza) e non c'e' gia'. */
function montaFlagCarta() {
  const corpo = doc?.getElementById?.("ed-body");
  if (!corpo || !corpo.querySelector("#ed-cl-room")) return false;
  if (corpo.querySelector("[data-dm-cl-inverti]")) return true;
  const blocco = doc.createElement("label");
  blocco.className = "ed-check dm-cl-inverti";
  blocco.dataset.dmClInverti = "";
  blocco.innerHTML =
    `<input type="checkbox"${cartaInvertita() ? " checked" : ""}> ` +
    t(
      "Nelle card mostra grande l'ambiente (target sotto)",
      "On cards show the room temperature big (target below)",
    );
  blocco.querySelector("input").addEventListener("change", (evento) => {
    try {
      root.localStorage?.setItem?.("cd_clima_inverti_card", evento.target.checked ? "1" : "0");
      root.cdMarkDirty?.();
      root.cdSyncPush?.();
    } catch (_errore) {}
    renderClimate({ rebuild: true });
  });
  corpo.append(blocco);
  return true;
}

export function installClimateThermalSection() {
  if (!doc) return;
  installStyle(STYLE_ID, climateCss());
  installStyle("dm-clima-rapido-taglia-style", climaRapidoCss());
  installOverrides();
  if (!state.listeners) {
    state.listeners = true;
    doc.addEventListener("click", onClick);
    for (const eventName of [
      "dashboardmodern:legacy-ready",
      "dashboardmodern:runtime-ready",
      "pageshow",
    ]) {
      root.addEventListener?.(eventName, () => {
        installOverrides();
        renderClimate({ rebuild: true });
      });
    }
    // The legacy runtime builds its own cards on DOMContentLoaded through a
    // direct reference, so that one call cannot be intercepted: repaint after it.
    if (doc.readyState === "loading") {
      doc.addEventListener("DOMContentLoaded", () => renderClimate({ rebuild: true }), {
        once: true,
      });
    }
    root.addEventListener?.("dashboardmodern:state-changed", () => renderClimate());
    for (const eventoEditor of [
      "dashboardmodern:editor-rendered",
      "dashboardmodern:legacy-ready",
      "dashboardmodern:runtime-ready",
    ])
      root.addEventListener?.(eventoEditor, () => montaFlagCarta());
    doc.addEventListener(
      "click",
      (evento) => {
        if (evento.target?.closest?.('.ed-tab[data-tab], [data-tab="clima"]'))
          root.setTimeout?.(montaFlagCarta, 0);
      },
      true,
    );
  }
  state.installed = true;
  renderClimate({ rebuild: true });
}

/* ── styles ───────────────────────────────────────────────────────────── */

/* Il popup del Clima rapido, rimesso in taglia.
 *
 * Dal campo, con la foto: «le card sono troppo grandi» — la griglia del
 * guscio e' due (o tre) colonne da un frazionario senza tetto, e su una
 * scheda larga ogni stanza diventava un quadrato da duecentocinquanta pixel
 * — e «le icone non si vedono bene, troppo piccole»: il disegno di casa
 * usciva a 34 pixel dentro una casella pensata per un'emoji da 50, per
 * giunta sbiadito dal grigio dello stato spento. Le stanze ora sono
 * pastiglie da 150 al massimo, centrate, e il disegno resta leggibile anche
 * da spento: lo stato lo dice il colore del bordo, non la nebbia. */
function climaRapidoCss() {
  return `
#quick-clima-modal .ns-clima-grid{
  grid-template-columns:repeat(auto-fit,minmax(112px,150px))!important;
  justify-content:center!important}
#quick-clima-modal .ns-clima-btn-icon{filter:saturate(.55) opacity(.85)!important}
#quick-clima-modal .ns-clima-btn.on-clima .ns-clima-btn-icon,
#quick-clima-modal .ns-clima-btn.on-heat .ns-clima-btn-icon{filter:none!important}
#quick-clima-modal .ns-clima-btn-icon svg{display:block}
`;
}

function climateCss() {
  return `
.dm-cl-shell,.dm-cl-shell *,.dm-cl-shell *::before,.dm-cl-shell *::after{box-sizing:border-box}
.dm-cl-shell{
  --dm-cl-cold:14,165,233;--dm-cl-warm:234,88,12;--dm-cl-off:148,163,184;
  --dm-cl-card:var(--card-bg,#fff);--dm-cl-line:var(--card-border,#e6ecf3);
  --dm-cl-text:var(--text,#0f172a);--dm-cl-dim:var(--text-dim,#64748b);
  --dm-cl-soft:var(--surface-2,#f7f9fc);--dm-cl-sunk:var(--surface-3,#eef2f8);
  --dm-cl-shadow:0 4px 20px rgba(15,23,42,.06),0 1px 4px rgba(15,23,42,.04);
  --dm-cl-zone:var(--dm-cl-cold);
  display:flex;flex-direction:column;gap:18px;width:100%;max-width:1250px;margin:0 auto;
  color:var(--dm-cl-text)
}
.dm-cl-shell[data-dm-cl-zone="caldo"]{--dm-cl-zone:var(--dm-cl-warm)}
.dm-cl-shell button{font:inherit;color:inherit}

/* ── masthead ─────────────────────────────────────────────────────────── */
.dm-cl-mast{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:2px 2px 0}
.dm-cl-mast-ic{
  width:48px;height:48px;flex:0 0 48px;display:grid;place-items:center;border-radius:16px;
  background:rgba(var(--dm-cl-zone),.12);color:rgb(var(--dm-cl-zone));transition:background .4s ease,color .4s ease
}
.dm-cl-mast-copy{flex:1 1 220px;min-width:0}
.dm-cl-mast-copy h2{
  margin:0;font-family:"Oswald",system-ui,sans-serif;font-size:clamp(20px,2.6vw,26px);font-weight:700;
  letter-spacing:1.6px;text-transform:uppercase;color:var(--dm-cl-text)
}
.dm-cl-mast-copy p{margin:2px 0 0;font-size:12.5px;font-weight:600;color:var(--dm-cl-dim)}
.dm-cl-summary{display:flex;align-items:stretch;gap:10px;flex-wrap:wrap}
.dm-cl-kpi{
  display:flex;flex-direction:column;justify-content:center;gap:1px;min-width:96px;padding:9px 15px;
  border:1px solid var(--dm-cl-line);border-radius:16px;background:var(--dm-cl-card);box-shadow:var(--dm-cl-shadow)
}
.dm-cl-kpi span{font-size:9px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:var(--dm-cl-dim)}
.dm-cl-kpi b{font-size:19px;font-weight:800;letter-spacing:-.4px;font-variant-numeric:tabular-nums}
.dm-cl-kpi b small{font-size:12px;font-weight:700;color:var(--dm-cl-dim);letter-spacing:0}
.dm-cl-bulk{
  display:flex;align-items:stretch;border:1px solid var(--dm-cl-line);border-radius:16px;
  background:var(--dm-cl-card);box-shadow:var(--dm-cl-shadow);overflow:hidden
}
.dm-cl-bulk button{
  display:inline-flex;align-items:center;gap:8px;padding:11px 16px;border:0;background:transparent;cursor:pointer;
  font-size:12px;font-weight:800;letter-spacing:.4px;color:var(--dm-cl-dim);
  transition:color .25s ease,background .25s ease
}
.dm-cl-bulk button[data-dm-cl-bulk="on"]:hover:not(:disabled){color:rgb(var(--dm-cl-zone));background:rgba(var(--dm-cl-zone),.09)}
.dm-cl-bulk button[data-dm-cl-bulk="off"]:hover:not(:disabled){color:var(--dm-cl-text);background:var(--dm-cl-sunk)}
.dm-cl-bulk button:disabled{opacity:.4;cursor:default}
.dm-cl-bulk-div{width:1px;margin:8px 0;background:var(--dm-cl-line)}

/* ── Freddo / Caldo switch (ids and classes kept for setClimaPageMode) ── */
#page-clima .dm-cl-shell .clima-page-mode-switch.dm-cl-switch{
  display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:4px!important;
  width:100%!important;max-width:none!important;margin:0!important;padding:5px!important;
  border:1px solid var(--dm-cl-line)!important;border-radius:20px!important;
  background:var(--dm-cl-card)!important;box-shadow:var(--dm-cl-shadow)!important;overflow:hidden!important
}
#page-clima .dm-cl-shell .clima-page-mode-switch.dm-cl-switch .clima-page-mode-btn{
  display:flex!important;align-items:center!important;justify-content:center!important;gap:9px!important;
  min-height:0!important;padding:13px 10px!important;margin:0!important;border:0!important;border-radius:15px!important;
  background:transparent!important;color:var(--dm-cl-dim)!important;cursor:pointer!important;
  font-family:inherit!important;font-size:13px!important;font-weight:800!important;letter-spacing:1.2px!important;
  text-transform:uppercase!important;box-shadow:none!important;transition:background .3s ease,color .3s ease!important
}
#page-clima .dm-cl-shell .clima-page-mode-switch.dm-cl-switch .clima-page-mode-btn .icon{
  display:inline-flex!important;align-items:center!important;font-size:0!important;line-height:0!important
}
/* A zone nobody configured has no tab, and a page with one zone has no switch:
   the buttons stay in the document for setClimaPageMode(), out of sight. */
#page-clima .dm-cl-shell .clima-page-mode-btn[data-dm-cl-empty="true"]{display:none!important}
#page-clima .dm-cl-shell[data-dm-cl-zones="1"] .clima-page-mode-switch,
#page-clima .dm-cl-shell[data-dm-cl-zones="0"] .clima-page-mode-switch{display:none!important}
.dm-cl-tab-count{
  padding:2px 8px;border-radius:999px;background:var(--dm-cl-sunk);color:var(--dm-cl-dim);
  font-size:10px;font-weight:800;letter-spacing:.4px;font-variant-numeric:tabular-nums
}
#page-clima .dm-cl-shell #clima-page-mode-freddo.active-freddo{
  background:linear-gradient(135deg,rgb(var(--dm-cl-cold)),rgba(var(--dm-cl-cold),.78))!important;color:#fff!important;
  box-shadow:0 8px 20px rgba(var(--dm-cl-cold),.34)!important
}
#page-clima .dm-cl-shell #clima-page-mode-caldo.active-caldo{
  background:linear-gradient(135deg,rgb(var(--dm-cl-warm)),rgba(var(--dm-cl-warm),.78))!important;color:#fff!important;
  box-shadow:0 8px 20px rgba(var(--dm-cl-warm),.34)!important
}
#page-clima .dm-cl-shell .clima-page-mode-btn.active-freddo .dm-cl-tab-count,
#page-clima .dm-cl-shell .clima-page-mode-btn.active-caldo .dm-cl-tab-count{background:rgba(255,255,255,.24);color:#fff}

/* ── grids ────────────────────────────────────────────────────────────── */
.dm-cl-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;align-items:start}
.dm-cl-floor{
  grid-column:1/-1;display:flex;align-items:center;gap:12px;padding:6px 2px 0;
  font-size:10px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;color:var(--dm-cl-dim)
}
.dm-cl-floor::after{content:"";flex:1;height:1px;background:var(--dm-cl-line)}
.dm-cl-empty{
  grid-column:1/-1;display:flex;flex-direction:column;align-items:center;gap:6px;padding:34px 18px;
  border:1px dashed var(--dm-cl-line);border-radius:22px;background:var(--dm-cl-soft);text-align:center
}
.dm-cl-empty-ic{display:grid;place-items:center;width:44px;height:44px;border-radius:14px;background:var(--dm-cl-sunk);color:var(--dm-cl-dim)}
.dm-cl-empty strong{font-size:14px;font-weight:800}
.dm-cl-empty p{margin:0;font-size:12.5px;color:var(--dm-cl-dim)}

/* ── card ─────────────────────────────────────────────────────────────── */
.dm-cl-card{
  --dm-cl-u:var(--dm-cl-off);
  position:relative;overflow:hidden;display:flex;flex-direction:column;gap:13px;padding:16px 18px 18px;
  border:1px solid var(--dm-cl-line);border-radius:22px;background:var(--dm-cl-card);
  box-shadow:var(--dm-cl-shadow);cursor:pointer;
  transition:border-color .4s ease,box-shadow .4s ease,transform .4s ease
}
.dm-cl-card[data-dm-cl-zone="freddo"].is-on{--dm-cl-u:var(--dm-cl-cold)}
.dm-cl-card[data-dm-cl-zone="caldo"].is-on{--dm-cl-u:var(--dm-cl-warm)}
.dm-cl-card::before{
  content:"";position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .5s ease;
  background:radial-gradient(125% 95% at 86% -20%,rgba(var(--dm-cl-u),.22),transparent 60%)
}
.dm-cl-card.is-on{border-color:rgba(var(--dm-cl-u),.34)}
.dm-cl-card.is-on::before{opacity:1}
.dm-cl-card:hover{transform:translateY(-3px);box-shadow:0 16px 38px rgba(15,23,42,.11)}
.dm-cl-card>*{position:relative}

.dm-cl-head{display:flex;align-items:center;gap:11px}
.dm-cl-ic{
  width:34px;height:34px;flex:0 0 34px;display:grid;place-items:center;border-radius:12px;
  background:var(--dm-cl-sunk);color:var(--dm-cl-dim);transition:background .4s ease,color .4s ease
}
.dm-cl-card.is-on .dm-cl-ic{background:rgba(var(--dm-cl-u),.14);color:rgb(var(--dm-cl-u))}
.dm-cl-txt{flex:1;min-width:0}
.dm-cl-name{font-size:14.5px;font-weight:800;letter-spacing:.1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dm-cl-meta{margin-top:1px;font-size:11px;font-weight:600;color:var(--dm-cl-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dm-cl-state{
  display:inline-flex;align-items:center;gap:5px;flex:0 0 auto;padding:4px 9px;border-radius:8px;
  background:var(--dm-cl-sunk);color:var(--dm-cl-dim);
  font-size:9.5px;font-weight:800;letter-spacing:1px;text-transform:uppercase;
  transition:background .35s ease,color .35s ease
}
.dm-cl-state i{display:none;width:5px;height:5px;border-radius:50%;background:currentColor}
.dm-cl-card.is-on .dm-cl-state{background:rgba(var(--dm-cl-u),.14);color:rgb(var(--dm-cl-u))}
.dm-cl-card.is-on .dm-cl-state i{display:block}

.dm-cl-main{display:flex;align-items:center;justify-content:space-between;gap:12px}
.dm-cl-target{display:flex;align-items:baseline;gap:9px;min-width:0}
.dm-cl-target b{
  font-size:44px;font-weight:800;line-height:.92;letter-spacing:-1.6px;font-variant-numeric:tabular-nums;
  color:var(--dm-cl-dim);transition:color .4s ease
}
.dm-cl-card.is-on .dm-cl-target b{color:rgb(var(--dm-cl-u))}
.dm-cl-deg{font-size:.62em;font-weight:700;letter-spacing:0}
.dm-cl-cap{font-size:9px;font-weight:800;letter-spacing:1.3px;text-transform:uppercase;color:var(--dm-cl-dim)}
.dm-cl-spark{width:132px;height:42px;flex:0 0 auto;overflow:visible}
.dm-cl-spark[hidden]{display:none}
.dm-cl-spark-area{fill:rgba(var(--dm-cl-u),.14)}
.dm-cl-spark-line{fill:none;stroke:rgb(var(--dm-cl-u));stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.dm-cl-spark-end{fill:rgb(var(--dm-cl-u));stroke:var(--dm-cl-card);stroke-width:2}

.dm-cl-rail{position:relative;height:22px;display:flex;align-items:center}
.dm-cl-bed{position:absolute;left:0;right:0;height:8px;border-radius:999px;background:var(--dm-cl-sunk)}
.dm-cl-fill{
  position:absolute;left:0;height:8px;border-radius:999px;width:0;
  background:linear-gradient(90deg,rgba(var(--dm-cl-u),.32),rgb(var(--dm-cl-u)));
  transition:width .5s ease,background .4s ease
}
.dm-cl-mark{
  position:absolute;width:3px;height:20px;border-radius:2px;background:var(--dm-cl-text);
  transform:translateX(-50%);box-shadow:0 0 0 3px var(--dm-cl-card);transition:left .5s ease
}
.dm-cl-knob{
  position:absolute;width:18px;height:18px;border-radius:50%;background:var(--dm-cl-card);
  border:3.5px solid rgba(var(--dm-cl-off),.9);transform:translateX(-50%);
  box-shadow:0 3px 8px rgba(15,23,42,.18);transition:left .5s ease,border-color .4s ease
}
.dm-cl-card.is-on .dm-cl-knob{border-color:rgb(var(--dm-cl-u))}
.dm-cl-mark[hidden],.dm-cl-knob[hidden]{display:none}
.dm-cl-legend{
  display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:-4px;
  font-size:10px;font-weight:700;color:var(--dm-cl-dim);font-variant-numeric:tabular-nums
}
/* L'Ambiente con la sua temperatura si deve leggere: «e' troppo piccolo»,
 * detto proprio della riga dentro la card. I due estremi della scala restano
 * piccoli, che sono contorno. */
.dm-cl-legend>span:nth-child(2){font-size:12.5px}
.dm-cl-legend b{color:var(--dm-cl-text);font-weight:800;font-size:13.5px}

.dm-cl-foot{display:flex;align-items:center;justify-content:space-between;gap:10px}
.dm-cl-modes{
  display:inline-flex;align-items:center;gap:7px;min-width:0;flex:0 1 auto;padding:8px 13px 8px 10px;cursor:pointer;
  border:1px solid var(--dm-cl-line);border-radius:999px;background:var(--dm-cl-soft);color:var(--dm-cl-dim);
  font-size:10.5px;font-weight:800;letter-spacing:.9px;text-transform:uppercase;
  transition:color .25s ease,border-color .25s ease,background .25s ease
}
.dm-cl-modes span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dm-cl-modes:hover{color:var(--dm-cl-text);background:var(--dm-cl-sunk)}
.dm-cl-card.is-on .dm-cl-modes{border-color:rgba(var(--dm-cl-u),.34);color:rgb(var(--dm-cl-u));background:rgba(var(--dm-cl-u),.1)}
.dm-cl-actions{display:flex;align-items:center;gap:7px;flex:0 0 auto}
.dm-cl-step{
  width:38px;height:38px;display:grid;place-items:center;cursor:pointer;border-radius:50%;
  border:1px solid var(--dm-cl-line);background:var(--dm-cl-soft);color:var(--dm-cl-dim);
  transition:background .2s ease,color .2s ease,transform .12s ease
}
.dm-cl-step:hover{background:var(--dm-cl-sunk);color:var(--dm-cl-text)}
.dm-cl-step:active{transform:scale(.9)}
.dm-cl-pwr{
  width:38px;height:38px;display:grid;place-items:center;cursor:pointer;border:0;border-radius:50%;
  background:var(--dm-cl-sunk);color:var(--dm-cl-dim);
  transition:background .3s ease,color .3s ease,box-shadow .3s ease,transform .12s ease
}
.dm-cl-pwr:active{transform:scale(.95)}
.dm-cl-card.is-on .dm-cl-pwr{background:rgb(var(--dm-cl-u));color:#fff;box-shadow:0 6px 16px rgba(var(--dm-cl-u),.34)}

/* ── dark theme ───────────────────────────────────────────────────────── */
html[data-theme="dark"] .dm-cl-shell{
  --dm-cl-cold:56,189,248;--dm-cl-warm:251,146,60;--dm-cl-off:100,116,139;
  --dm-cl-shadow:0 4px 20px rgba(0,0,0,.38),0 1px 4px rgba(0,0,0,.26)
}
html[data-theme="dark"] .dm-cl-card:hover{box-shadow:0 16px 38px rgba(0,0,0,.5)}
html[data-theme="dark"] .dm-cl-knob{box-shadow:0 3px 8px rgba(0,0,0,.45)}

/* ── phone: one card per row, compact enough to stay under the beta.5
      layout guard (a climate card must not grow past 260px) ───────────── */
@media(max-width:760px){
  #page-clima .dm-cl-shell .dm-cl-grid{grid-template-columns:1fr!important;gap:12px!important}
  #page-clima .dm-cl-shell .dm-cl-card{padding:13px 14px 14px!important;gap:9px!important;border-radius:20px!important}
  #page-clima .dm-cl-shell .dm-cl-target b{font-size:34px!important}
  #page-clima .dm-cl-shell .dm-cl-spark{display:none!important}
  #page-clima .dm-cl-shell .dm-cl-rail{height:18px!important}
  #page-clima .dm-cl-shell .dm-cl-step,#page-clima .dm-cl-shell .dm-cl-pwr{width:34px!important;height:34px!important}
  #page-clima .dm-cl-shell .clima-page-mode-switch.dm-cl-switch .clima-page-mode-btn{padding:11px 8px!important;font-size:12px!important;letter-spacing:1px!important}
  .dm-cl-summary{width:100%}
  .dm-cl-bulk{flex:1 1 auto}
  .dm-cl-bulk button{flex:1 1 auto;justify-content:center;padding:11px 10px}
}

@media(prefers-reduced-motion:reduce){
  .dm-cl-shell *{transition:none!important;animation:none!important}
}
`;
}
