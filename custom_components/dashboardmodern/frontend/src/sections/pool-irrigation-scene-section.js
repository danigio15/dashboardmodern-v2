import {
  configuredPools,
  poolRunKey,
  poolRunToday,
  poolTargetHours as modelTargetHours,
} from "../core/pool-model.js";
import { decorateEntityFields } from "./editor-slots-section.js";
import { extraPoolCommand } from "./pool-extra-section.js";
import {
  allStates,
  clean,
  doc,
  esc,
  finiteOrNull,
  installStyle,
  onEditorRedraw,
  readJson,
  root,
  scriviSeCambia,
  t,
  writeJsonIfChanged,
} from "./shared.js";

// Single visual owner for the Pool and Irrigation pages.
//
// The legacy runtime keeps every entity, service call and timer: this module
// only replaces the two paint functions (renderPiscina / renderIrrigazione) so
// the pages draw a real scene instead of a flat blue panel and a list of grey
// cards. Commands still travel through the legacy handlers (cdPoolBtn /
// cdIrrBtn), which is what keeps vibration, service domains and the filtration
// sequencer identical to before.
//
// The legacy loop repaints Pool every 2s and Irrigation every 1s while the page
// is visible. Rewriting innerHTML on each tick would restart every CSS
// animation, so both renderers build markup once per structural signature and
// afterwards only write the values that changed. That is what lets the water
// keep flowing and the sprinklers keep spraying between ticks.
const KEY = "__DASHBOARDMODERN_POOL_IRRIGATION_SCENE__";
const state = (root[KEY] ||= {
  installed: false,
  frame: 0,
  poolSignature: "",
  irrigationSignature: "",
  poolScelta: 0,
});

const POOL_MARKER = "__dmPoolSceneOwner";
const IRRIGATION_MARKER = "__dmIrrigationSceneOwner";
const MAX_LAWN_ZONES = 8;

/**
 * Numbers, with "absent" kept distinct from zero. `Number(null)` and
 * `Number("")` are both 0, which would turn an unconfigured pH threshold into a
 * real one and park the gauge pin at the far left of the track.
 */
function num(value) {
  if (value === null || value === undefined || clean(value) === "") return null;
  return finiteOrNull(value);
}

function entityNumber(entityId) {
  const reference = clean(entityId);
  if (!reference) return null;
  return num(allStates()[reference]?.state);
}

function entityActive(entityId) {
  const reference = clean(entityId);
  if (!reference) return false;
  const current = clean(allStates()[reference]?.state).toLowerCase();
  return current === "on" || current === "open" || current === "opening" || current === "running";
}

function poolConfig() {
  try {
    return root.getPool?.() || {};
  } catch (_error) {
    return {};
  }
}

/* Tutte le vasche configurate, la prima per prima.
 *
 * `getPool()` restituisce l'oggetto salvato per intero: la prima piscina sta
 * in cima, dove il runtime la cerca da sempre, e le altre nell'elenco accanto.
 * Da qui in giu' si ragiona per vasche, non per "la piscina". */
function poolsToDraw() {
  return configuredPools(poolConfig());
}

function irrigationConfig() {
  try {
    const value = root.getIrr?.() || {};
    return { ...value, zones: Array.isArray(value.zones) ? value.zones : [] };
  } catch (_error) {
    return { zones: [] };
  }
}

function hasPage(pageId) {
  return Boolean(doc?.getElementById(pageId));
}

/* L'umidita' del terreno, dal sensore configurato.
 *
 * «Nella sezione irrigazione potresti mettere la possibilita' di vedere la %
 * di umidita' del terreno mediante l'opportuna entita'»: il sensore sta nella
 * configurazione dell'irrigazione (`soilEnt`), la lettura e' una percentuale
 * 0-100, e le soglie facoltative (`soilMin`/`soilMax`) disegnano la banda
 * ideale sulla stessa scala usata da pH e cloro della piscina. */
export function soilMoisture(config = {}) {
  const entity = clean(config.soilEnt || config.soil_entity);
  if (!entity) return { entity: "", reading: null };
  const raw = entityNumber(entity);
  return { entity, reading: raw == null ? null : Math.max(0, Math.min(100, raw)) };
}

/* ─────────────────────────── shared markup bits ─────────────────────────── */

function emptyState(icon, title, hint) {
  return `<div class="dm-scene-empty"><span class="dm-scene-empty-icon" aria-hidden="true">${icon}</span>
    <strong>${esc(title)}</strong><span>${esc(hint)}</span></div>`;
}

function repeat(count, markup) {
  return Array.from({ length: count }, (_value, index) => markup(index)).join("");
}

/* ───────────────────────────────── pool ─────────────────────────────────── */

/* Le ore che una vasca deve fare oggi.
 *
 * La prima passa dal runtime, che quel conto lo fa da sempre e lo usa anche per
 * fermare la pompa da solo; le altre lo fanno con la stessa regola, scritta una
 * volta in `pool-model.js`. Ogni vasca ha un padrone e uno solo. */
function poolTargetHours(pool, index) {
  if (index === 0) {
    const value = num(root.cdPoolTargetHours?.());
    if (value && value > 0) return value;
  }
  return modelTargetHours(pool, entityNumber(pool?.tempEnt));
}

function poolRunSeconds(pool, index) {
  if (index === 0) {
    try {
      const run = root.cdPoolRunToday?.();
      return Math.max(0, num(run?.s) ?? 0);
    } catch (_error) {
      return 0;
    }
  }
  return Math.max(0, num(readRun(pool, index).s) ?? 0);
}

/** Il conteggio di oggi di una vasca in piu', dalla sua chiave. */
function readRun(pool, index) {
  const stored = readJson(poolRunKey(pool, index), {});
  return poolRunToday(stored, new Date().toDateString());
}

/**
 * Map a reading onto a 0-100 track built around its own healthy band, so pH and
 * chlorine share one gauge without hard-coding either scale.
 */
export function gaugePosition(value, min, max) {
  const reading = num(value);
  if (reading == null) return null;
  const low = num(min);
  const high = num(max);
  if (low == null || high == null || high <= low) {
    const span = Math.max(Math.abs(reading), 1) * 2;
    return Math.max(0, Math.min(100, (reading / span) * 100));
  }
  const margin = (high - low) || 1;
  const from = low - margin;
  const to = high + margin;
  return Math.max(0, Math.min(100, ((reading - from) / (to - from)) * 100));
}

export function gaugeVerdict(value, min, max) {
  const reading = num(value);
  if (reading == null) return "";
  const low = num(min);
  const high = num(max);
  if (low != null && reading < low) return "low";
  if (high != null && reading > high) return "high";
  return "ok";
}

function qualityGauge(kind, label, unit, value, min, max) {
  const reading = num(value);
  if (reading == null) return "";
  const verdict = gaugeVerdict(reading, min, max);
  const position = gaugePosition(reading, min, max) ?? 50;
  const low = num(min);
  const high = num(max);
  const margin = low != null && high != null && high > low ? (high - low) || 1 : null;
  const bandFrom = margin == null ? 25 : ((low - (low - margin)) / ((high + margin) - (low - margin))) * 100;
  const bandTo = margin == null ? 75 : ((high - (low - margin)) / ((high + margin) - (low - margin))) * 100;
  const verdictCopy = {
    ok: t("nella norma", "in range"),
    low: t("troppo basso", "too low"),
    high: t("troppo alto", "too high"),
  };
  const range = low != null && high != null ? `${low} – ${high}` : t("nessuna soglia", "no threshold");
  return `<div class="dm-gauge" data-dm-gauge="${esc(kind)}" data-verdict="${verdict}">
    <div class="dm-gauge-head">
      <span class="dm-gauge-label">${esc(label)}</span>
      <span class="dm-gauge-value" data-dm-gauge-value>${esc(reading)}${esc(unit)}</span>
    </div>
    <div class="dm-gauge-track">
      <span class="dm-gauge-band" style="left:${bandFrom.toFixed(1)}%;right:${(100 - bandTo).toFixed(1)}%"></span>
      <span class="dm-gauge-pin" data-dm-gauge-pin style="left:${position.toFixed(1)}%"></span>
    </div>
    <div class="dm-gauge-foot">
      <span class="dm-gauge-verdict" data-dm-gauge-verdict>${esc(verdictCopy[verdict] || "")}</span>
      <span class="dm-gauge-range">${esc(t("ideale", "ideal"))} ${esc(range)}</span>
    </div>
  </div>`;
}

/* Aggiorna un misuratore gia' disegnato: valore, spillo e verdetto. Serve a
 * pH e cloro della piscina e all'umidita' del terreno dell'irrigazione, che
 * condividono lo stesso disegno. `unit` accompagna il valore quando il
 * misuratore lo mostra con l'unita' (la percentuale del terreno). */
function syncGauge(gauge, reading, min, max, unit = "") {
  if (!gauge || reading == null) return;
  const verdict = gaugeVerdict(reading, min, max);
  gauge.dataset.verdict = verdict;
  const value = gauge.querySelector("[data-dm-gauge-value]");
  if (value) value.textContent = `${reading}${unit}`;
  const pin = gauge.querySelector("[data-dm-gauge-pin]");
  if (pin) pin.style.left = `${(gaugePosition(reading, min, max) ?? 50).toFixed(1)}%`;
  const note = gauge.querySelector("[data-dm-gauge-verdict]");
  if (note) {
    note.textContent = verdict === "ok"
      ? t("nella norma", "in range")
      : verdict === "low" ? t("troppo basso", "too low") : t("troppo alto", "too high");
  }
}

function poolTile(act, glyph, label) {
  return `<button type="button" class="dm-pool-tile" data-act="${esc(act)}" data-dm-pool-tile="${esc(act)}" aria-pressed="false">
    <span class="dm-pool-tile-icon" aria-hidden="true">${glyph}</span>
    <span class="dm-pool-tile-label">${esc(label)}</span>
    <span class="dm-pool-tile-state" data-dm-tile-state>${esc(t("spenta", "off"))}</span>
  </button>`;
}

function poolSceneMarkup(config) {
  return `<section class="dm-pool-stage" data-dm-pool-stage aria-hidden="true">
    <span class="dm-pool-sky"></span>
    <span class="dm-pool-sun"></span>
    <span class="dm-pool-hedge"></span>
    <span class="dm-pool-plant dm-left"></span>
    <span class="dm-pool-plant dm-right"></span>
    <span class="dm-pool-deck"></span>
    <span class="dm-pool-lounger"><i></i><b></b></span>
    <span class="dm-pool-parasol"><i></i><b></b></span>
    <div class="dm-pool-basin">
      <div class="dm-pool-water">
        <span class="dm-pool-caustics"></span>
        <span class="dm-pool-caustics dm-slow"></span>
        <span class="dm-pool-shimmer"></span>
        <span class="dm-pool-lane dm-a"></span>
        <span class="dm-pool-lane dm-b"></span>
        <span class="dm-pool-glow"></span>
        <span class="dm-pool-ripple dm-a"></span>
        <span class="dm-pool-ripple dm-b"></span>
        <span class="dm-pool-bubbles">${repeat(7, (index) => `<i style="left:${16 + index * 9.5}%;animation-delay:${(index * 0.38).toFixed(2)}s"></i>`)}</span>
      </div>
      <span class="dm-pool-steam">${repeat(3, (index) => `<i style="left:${26 + index * 22}%;animation-delay:${(index * 1.3).toFixed(1)}s"></i>`)}</span>
      <span class="dm-pool-coping"></span>
      <span class="dm-pool-steps"><i></i><i></i><i></i></span>
      <span class="dm-pool-ladder"><i></i><i></i><i></i></span>
      <span class="dm-pool-ring"></span>
    </div>
    ${config.tempEnt ? `<div class="dm-pool-readout"><span class="dm-pool-readout-value" data-dm-pool-temp>—</span>
      <span class="dm-pool-readout-label">${esc(t("Temperatura acqua", "Water temperature"))}</span></div>` : ""}
    <div class="dm-pool-flags" data-dm-pool-flags></div>
  </section>`;
}

function poolMarkup(config) {
  const tiles = [
    config.pumpEnt ? poolTile("pump", "🌀", t("Pompa", "Pump")) : "",
    config.heatEnt ? poolTile("heat", "🔥", t("Riscaldamento", "Heating")) : "",
    config.lightEnt ? poolTile("light", "💡", t("Luce", "Light")) : "",
  ].filter(Boolean).join("");

  const quality = [
    qualityGauge("ph", "pH", "", entityNumber(config.phEnt), config.phMin, config.phMax),
    qualityGauge("cl", t("Cloro / Redox", "Chlorine / Redox"), "", entityNumber(config.clEnt), config.clMin, config.clMax),
  ].filter(Boolean).join("");

  const filtration = config.pumpEnt
    ? `<article class="dm-pool-card dm-pool-filtration" data-dm-pool-filtration>
        <div class="dm-pool-card-head">
          <span class="dm-pool-card-title"><i aria-hidden="true">🌀</i>${esc(t("Filtrazione", "Filtration"))}</span>
          <span class="dm-pool-badge" data-dm-filter-badge>—</span>
        </div>
        <div class="dm-pool-filtration-body">
          <div class="dm-ring" data-dm-filter-ring style="--pct:0">
            <span class="dm-ring-core"><b data-dm-filter-done>0h</b><i data-dm-filter-target>/ 0h</i></span>
          </div>
          <div class="dm-pool-filtration-copy">
            <p class="dm-pool-note" data-dm-filter-note></p>
            <div class="dm-pool-actions">
              <button type="button" class="dm-btn dm-primary" data-act="fstart">▶ ${esc(t("Avvia filtrazione", "Start filtration"))}</button>
              <button type="button" class="dm-btn dm-ghost" data-act="fstop">⏹ ${esc(t("Stop", "Stop"))}</button>
            </div>
          </div>
        </div>
      </article>`
    : "";

  const qualityCard = quality
    ? `<article class="dm-pool-card dm-pool-quality">
        <div class="dm-pool-card-head">
          <span class="dm-pool-card-title"><i aria-hidden="true">🧪</i>${esc(t("Qualità acqua", "Water quality"))}</span>
        </div>
        <div class="dm-pool-gauges" data-dm-pool-gauges>${quality}</div>
      </article>`
    : "";

  return `${poolSceneMarkup(config)}
    ${tiles ? `<div class="dm-pool-tiles" data-dm-pool-tiles>${tiles}</div>` : ""}
    ${qualityCard || filtration ? `<div class="dm-pool-cards">${qualityCard}${filtration}</div>` : ""}`;
}

function poolSignature(config) {
  return [
    clean(config.tempEnt), clean(config.pumpEnt), clean(config.heatEnt), clean(config.lightEnt),
    entityNumber(config.phEnt) == null ? "" : "ph",
    entityNumber(config.clEnt) == null ? "" : "cl",
    clean(config.phMin), clean(config.phMax), clean(config.clMin), clean(config.clMax),
  ].join("|");
}

function syncPoolValues(host, config, index) {
  const temperature = entityNumber(config.tempEnt);
  const pumping = entityActive(config.pumpEnt);
  const heating = entityActive(config.heatEnt);
  const lighting = entityActive(config.lightEnt);

  host.dataset.dmPoolFiltering = String(pumping);
  host.dataset.dmPoolHeating = String(heating);
  host.dataset.dmPoolLight = String(lighting);

  const readout = host.querySelector("[data-dm-pool-temp]");
  if (readout) readout.textContent = temperature == null ? "—" : `${temperature}°`;

  const tiles = { pump: pumping, heat: heating, light: lighting };
  for (const [act, on] of Object.entries(tiles)) {
    const tile = host.querySelector(`[data-dm-pool-tile="${act}"]`);
    if (!tile) continue;
    tile.dataset.on = String(on);
    tile.setAttribute("aria-pressed", String(on));
    const label = tile.querySelector("[data-dm-tile-state]");
    if (label) label.textContent = on ? t("accesa", "on") : t("spenta", "off");
  }

  const flags = host.querySelector("[data-dm-pool-flags]");
  if (flags) {
    const chips = [
      pumping ? `<span class="dm-pool-flag dm-flow">${esc(t("Acqua in circolo", "Water circulating"))}</span>` : "",
      heating ? `<span class="dm-pool-flag dm-heat">${esc(t("Riscaldamento attivo", "Heating on"))}</span>` : "",
      lighting ? `<span class="dm-pool-flag dm-light">${esc(t("Luce accesa", "Light on"))}</span>` : "",
    ].filter(Boolean).join("");
    scriviSeCambia(flags, chips);
  }

  for (const [kind, entity, min, max] of [
    ["ph", config.phEnt, config.phMin, config.phMax],
    ["cl", config.clEnt, config.clMin, config.clMax],
  ]) {
    syncGauge(host.querySelector(`[data-dm-gauge="${kind}"]`), entityNumber(entity), min, max);
  }

  const filtration = host.querySelector("[data-dm-pool-filtration]");
  if (filtration) {
    const target = poolTargetHours(config, index);
    const doneHours = Math.round((poolRunSeconds(config, index) / 3600) * 10) / 10;
    const percent = Math.max(0, Math.min(100, Math.round((doneHours / target) * 100)));
    const ring = filtration.querySelector("[data-dm-filter-ring]");
    if (ring) ring.style.setProperty("--pct", String(percent));
    const done = filtration.querySelector("[data-dm-filter-done]");
    if (done) done.textContent = `${doneHours}h`;
    const goal = filtration.querySelector("[data-dm-filter-target]");
    if (goal) goal.textContent = `/ ${target}h`;
    const badge = filtration.querySelector("[data-dm-filter-badge]");
    if (badge) {
      badge.textContent = pumping ? t("in funzione", "running") : t("ferma", "idle");
      badge.dataset.on = String(pumping);
    }
    const note = filtration.querySelector("[data-dm-filter-note]");
    if (note) {
      const parts = [
        config.autoHours ? t("Durata automatica: temperatura / 2", "Automatic duration: temperature / 2") : "",
        config.enabled && config.filterStart ? `${t("Avvio programmato", "Scheduled start")} ${clean(config.filterStart)}` : "",
      ].filter(Boolean);
      const summary = `${t("Oggi", "Today")} ${doneHours}h ${t("su", "of")} ${target}h`;
      note.textContent = [summary, ...parts].join(" · ");
    }
  }
}

function poolName(pool) {
  return clean(pool.name) || `${t("Piscina", "Pool")} ${pool.index + 1}`;
}

function poolBlockMarkup(pool, mostrareIlNome) {
  /* Il nome compare solo quando ce n'e' piu' di una: su una vasca sola sarebbe
   * un'intestazione che ripete il titolo della sezione. Con le schede in cima
   * il nome lo dice gia' la scheda accesa, e ripeterlo sotto sarebbe due volte
   * la stessa parola in mezzo centimetro. */
  const testa = mostrareIlNome
    ? `<header class="dm-pool-name"><span class="dm-pool-name-icon" aria-hidden="true">🏊</span><strong>${esc(poolName(pool))}</strong></header>`
    : "";
  return `<article class="dm-pool-block" data-dm-pool="${esc(pool.id)}" data-dm-pool-index="${pool.index}">
    ${testa}
    ${poolMarkup(pool)}
  </article>`;
}

/* Le vasche stanno una accanto all'altra, non una sotto l'altra.
 *
 * Con due piscine la pagina le impilava: per arrivare alla seconda si
 * scorreva oltre tutta la prima — vasca, qualita' dell'acqua, filtrazione — e
 * confrontarle voleva dire andare su e giu'. Le schede in cima sono le stesse
 * che l'Energia usa per le sue viste, e si guarda una vasca per volta. */
function poolTabsMarkup(pools, scelta) {
  return `<nav class="sub-tabs-energy dm-pool-tabs" role="tablist" aria-label="${esc(t("Piscine", "Pools"))}">${pools
    .map(
      (pool) =>
        `<button type="button" class="sub-tab-btn dm-pool-tab${pool.index === scelta ? " active" : ""}" role="tab" aria-selected="${pool.index === scelta}" data-dm-pool-tab="${pool.index}">🏊 ${esc(poolName(pool))}</button>`,
    )
    .join("")}</nav>`;
}

/** La vasca da mostrare: quella scelta se c'e' ancora, altrimenti la prima. */
export function poolScelta(pools = [], scelta = 0) {
  if (!pools.length) return 0;
  return pools.some((pool) => pool.index === scelta) ? scelta : pools[0].index;
}

/** Accende la scheda scelta e mostra soltanto la sua vasca. */
function showPool(wrap, scelta) {
  for (const tab of wrap.querySelectorAll("[data-dm-pool-tab]")) {
    const mia = Number(tab.dataset.dmPoolTab) === scelta;
    tab.classList.toggle("active", mia);
    tab.setAttribute("aria-selected", String(mia));
  }
  for (const block of wrap.querySelectorAll("[data-dm-pool-index]")) {
    const mia = Number(block.dataset.dmPoolIndex) === scelta;
    block.hidden = !mia;
    /* L'attributo `hidden` da solo non basta: la scena scrive il display delle
     * vasche da un selettore con due id, che batte qualunque regola scritta
     * qui. Una dichiarazione sull'elemento non la batte nessuno. */
    if (mia) block.style.removeProperty("display");
    else block.style.setProperty("display", "none", "important");
  }
}

function renderPool() {
  const wrap = doc?.getElementById("pool-wrap");
  if (!wrap) return;
  const pools = poolsToDraw();
  wrap.dataset.dmPoolScene = "true";

  if (!pools.length) {
    if (state.poolSignature !== "empty" || !wrap.querySelector(".dm-scene-empty")) {
      state.poolSignature = "empty";
      wrap.innerHTML = emptyState("🏊", t("Nessuna piscina configurata", "No pool configured"), t("Aggiungi le entità della piscina dall'editor per vedere la vasca.", "Add the pool entities from the editor to see the basin."));
    }
    return;
  }

  // Rebuilding only on a structural change is what keeps the water animating
  // between the legacy 2s repaints; the DOM probe covers the case where another
  // owner wiped the container while the signature was still current.
  const conSchede = pools.length > 1;
  state.poolScelta = poolScelta(pools, state.poolScelta);
  const signature = pools.map((pool) => `${pool.id}~${poolSignature(pool)}`).join("//");
  if (state.poolSignature !== signature || !wrap.querySelector("[data-dm-pool-stage]")) {
    state.poolSignature = signature;
    wrap.dataset.dmPoolCount = String(pools.length);
    wrap.innerHTML =
      (conSchede ? poolTabsMarkup(pools, state.poolScelta) : "") +
      pools.map((pool) => poolBlockMarkup(pool, false)).join("");
  }
  if (conSchede) showPool(wrap, state.poolScelta);
  for (const pool of pools) {
    const block = wrap.querySelector(`[data-dm-pool-index="${pool.index}"]`);
    if (block) syncPoolValues(block, pool, pool.index);
  }
}

/* ────────────────────────────── irrigation ──────────────────────────────── */

function zoneMinutes(zone = {}) {
  const value = num(zone.mins);
  return value && value > 0 ? value : 10;
}

function zoneName(zone = {}) {
  return clean(zone.name) || clean(zone.entity) || t("Zona", "Zone");
}

/**
 * Place the sprinklers on the lawn: a back row and a front row, evenly spread
 * and slightly smaller towards the horizon so the turf reads as depth rather
 * than as a flat green rectangle.
 */
export function lawnPlacement(count, index) {
  const shown = Math.max(1, Math.min(count, MAX_LAWN_ZONES));
  const backCount = shown > 1 ? Math.ceil(shown / 2) : 0;
  const back = index < backCount;
  const rowCount = back ? backCount : shown - backCount;
  const rowIndex = back ? index : index - backCount;
  // The front row spans wider and sits lower than the back row: same trick the
  // mowing stripes use, so a flat green rectangle reads as ground with depth.
  const [from, to] = back ? [18, 82] : [9, 91];
  const x = from + ((to - from) * (rowIndex + 0.5)) / rowCount;
  return { x, y: back ? 40 : 76, scale: back ? 0.76 : 1 };
}

function zoneMarkup(zone, index, count) {
  const place = lawnPlacement(count, index);
  return `<div class="dm-zone" data-dm-zone="${index}" data-state="off"
      style="--zx:${place.x.toFixed(2)}%;--zy:${place.y.toFixed(2)}%;--zs:${place.scale}">
    <span class="dm-zone-wet"></span>
    <span class="dm-zone-fan"></span>
    <span class="dm-zone-mist"></span>
    <span class="dm-zone-splashes">${repeat(8, (drop) => `<i class="dm-drop-${drop}"></i>`)}</span>
    <span class="dm-zone-spray">${repeat(8, (drop) => `<i class="dm-drop-${drop}"></i>`)}</span>
    <span class="dm-sprinkler"><b></b><u></u></span>
    <span class="dm-zone-tag"><em>${esc(zoneName(zone))}</em><i data-dm-zone-timer>${zoneMinutes(zone)} min</i></span>
  </div>`;
}

function lawnMarkup(zones) {
  const shown = zones.slice(0, MAX_LAWN_ZONES);
  return `<section class="dm-lawn" data-dm-lawn aria-hidden="true">
    <span class="dm-lawn-sky"></span>
    <span class="dm-lawn-sun"></span>
    <span class="dm-lawn-hedge"></span>
    <span class="dm-lawn-tree dm-left"></span>
    <span class="dm-lawn-tree dm-right"></span>
    <div class="dm-lawn-turf">
      <span class="dm-lawn-stripes"></span>
      <span class="dm-lawn-texture"></span>
      <span class="dm-lawn-path"></span>
      <span class="dm-lawn-flowers">${repeat(9, (index) => `<i style="left:${(6 + index * 10.4).toFixed(1)}%;top:${(24 + (index % 4) * 17).toFixed(0)}%"></i>`)}</span>
      <div class="dm-lawn-zones" data-dm-lawn-zones>${shown.map((zone, index) => zoneMarkup(zone, index, shown.length)).join("")}</div>
      <span class="dm-lawn-blades">${repeat(26, (index) => `<i style="left:${(index * 4).toFixed(0)}%;height:${13 + (index % 4) * 5}px;animation-delay:${(index * -0.17).toFixed(2)}s"></i>`)}</span>
    </div>
  </section>`;
}

/* Il misuratore dell'umidita' del terreno: lo stesso disegno di pH e cloro
 * della piscina, con la banda ideale se le soglie sono configurate. Compare
 * solo quando il sensore ha una lettura; la firma della pagina sa quando la
 * lettura arriva, cosi' il misuratore non resta fuori per sempre. */
function soilGaugeMarkup(config) {
  const soil = soilMoisture(config);
  if (soil.reading == null) return "";
  return `<div class="dm-irr-soil" data-dm-irr-soil>${qualityGauge(
    "soil",
    `🌱 ${t("Umidità terreno", "Soil moisture")}`,
    "%",
    soil.reading,
    num(config.soilMin),
    num(config.soilMax),
  )}</div>`;
}

function programMarkup(config) {
  return `<article class="dm-irr-program" data-dm-irr-program>
    <div class="dm-irr-program-head">
      <span class="dm-irr-program-title"><i aria-hidden="true">💧</i>${esc(t("Programma irrigazione", "Irrigation schedule"))}</span>
      <span class="dm-irr-chip" data-dm-irr-schedule>—</span>
    </div>
    <div class="dm-irr-meta" data-dm-irr-meta></div>
    ${soilGaugeMarkup(config)}
    <div class="dm-irr-skip" data-dm-irr-skip hidden></div>
    <div class="dm-irr-actions">
      <button type="button" class="dm-btn dm-primary" data-act="pstart">▶ ${esc(t("Avvia programma", "Start schedule"))}</button>
      <button type="button" class="dm-btn dm-warn" data-act="pforce">⚡ ${esc(t("Forza (ignora pioggia)", "Force (ignore rain)"))}</button>
      <button type="button" class="dm-btn dm-ghost" data-act="stop">⏹ ${esc(t("Stop", "Stop"))}</button>
    </div>
  </article>`;
}

function zoneCardMarkup(zone, index) {
  return `<article class="dm-irr-card" data-dm-irr-card="${index}" data-state="off">
    <div class="dm-irr-card-head">
      <span class="dm-irr-card-name"><i aria-hidden="true">🌿</i>${esc(zoneName(zone))}</span>
      <span class="dm-irr-card-chip" data-dm-card-chip>${zoneMinutes(zone)} min</span>
    </div>
    ${clean(zone.room) ? `<span class="dm-irr-card-room">🏠 ${esc(zone.room)}</span>` : ""}
    <div class="dm-irr-card-bar"><b data-dm-card-bar style="width:0%"></b></div>
    <div class="dm-irr-card-actions">
      <button type="button" class="dm-btn dm-primary dm-compact" data-act="zstart" data-idx="${index}">▶ ${esc(t("Avvia", "Start"))}</button>
      <button type="button" class="dm-btn dm-ghost dm-compact" data-act="stop">⏹</button>
    </div>
  </article>`;
}

function irrigationSignature(config) {
  const soil = soilMoisture(config);
  return config.zones
    .map((zone, index) => `${index}:${zoneName(zone)}:${clean(zone.entity)}:${zoneMinutes(zone)}:${clean(zone.room)}`)
    .join("|")
    // Il misuratore del terreno entra nel disegno quando il sensore comincia a
    // rispondere: la firma deve accorgersene, o resterebbe fuori per sempre.
    .concat(`|soil:${soil.entity}:${soil.reading != null}`);
}

function runningZoneIndex() {
  const runtime = root.CD_IRR;
  if (!runtime || !Array.isArray(runtime.seq) || runtime.cur < 0) return -1;
  const index = runtime.seq[runtime.cur];
  return Number.isInteger(index) ? index : -1;
}

function countdownLabel() {
  const runtime = root.CD_IRR;
  const left = Math.max(0, (num(runtime?.until) ?? 0) - Date.now());
  const minutes = Math.floor(left / 60000);
  const seconds = Math.floor((left % 60000) / 1000);
  return { left, label: `${minutes}:${String(seconds).padStart(2, "0")}` };
}

function syncIrrigationValues(host, grid, config) {
  const sequenced = runningZoneIndex();
  const { left, label } = countdownLabel();
  // Resolved once so the sprinkler on the lawn and the card below it can never
  // disagree: a zone counts as running when the sequencer is on it or when its
  // own valve reports open.
  const running = config.zones.map(
    (zone, index) => index === sequenced || entityActive(zone.entity),
  );

  const schedule = host.querySelector("[data-dm-irr-schedule]");
  if (schedule) {
    schedule.textContent = config.enabled
      ? `⏰ ${t("ogni giorno alle", "every day at")} ${clean(config.time) || "06:30"}`
      : t("programma spento", "schedule off");
    schedule.dataset.on = String(Boolean(config.enabled));
  }

  const meta = host.querySelector("[data-dm-irr-meta]");
  if (meta) {
    const states = allStates();
    const weather = states[clean(config.weatherEnt)];
    const rain = entityNumber(config.rainEnt);
    const threshold = num(config.rainThr) ?? 60;
    const chips = [];
    if (weather) {
      const temperature = num(weather.attributes?.temperature);
      chips.push(`<span class="dm-irr-meta-chip">⛅ ${esc(weather.state)}${temperature == null ? "" : ` · ${temperature}°`}</span>`);
    }
    if (rain != null) {
      chips.push(`<span class="dm-irr-meta-chip" data-alert="${String(rain >= threshold)}">🌧️ ${t("pioggia", "rain")} ${Math.round(rain)}% · ${t("soglia", "threshold")} ${threshold}%</span>`);
    }
    const markup = chips.join("");
    scriviSeCambia(meta, markup);
    meta.hidden = !markup;
  }

  const soil = soilMoisture(config);
  syncGauge(
    host.querySelector('[data-dm-gauge="soil"]'),
    soil.reading,
    num(config.soilMin),
    num(config.soilMax),
    "%",
  );

  const skip = host.querySelector("[data-dm-irr-skip]");
  if (skip) {
    const message = clean(root.CD_IRR?.skip);
    skip.hidden = !message;
    if (skip.textContent !== message) skip.textContent = message;
  }

  host.querySelectorAll("[data-dm-zone]").forEach((node) => {
    const index = Number(node.dataset.dmZone);
    const zone = config.zones[index];
    if (!zone) return;
    node.dataset.state = running[index] ? "on" : "off";
    const timer = node.querySelector("[data-dm-zone-timer]");
    if (timer) {
      timer.textContent = index === sequenced && left > 0 ? label : `${zoneMinutes(zone)} min`;
    }
  });

  grid?.querySelectorAll("[data-dm-irr-card]").forEach((node) => {
    const index = Number(node.dataset.dmIrrCard);
    const zone = config.zones[index];
    if (!zone) return;
    const sequencing = index === sequenced && left > 0;
    node.dataset.state = running[index] ? "on" : "off";
    const chip = node.querySelector("[data-dm-card-chip]");
    if (chip) chip.textContent = sequencing ? `💦 ${label}` : `${zoneMinutes(zone)} min`;
    const bar = node.querySelector("[data-dm-card-bar]");
    if (bar) {
      const total = zoneMinutes(zone) * 60000;
      const percent = sequencing ? Math.max(0, Math.min(100, 100 - (left / total) * 100)) : 0;
      bar.style.width = `${percent.toFixed(1)}%`;
    }
  });

  host.dataset.dmIrrRunning = String(running.some(Boolean));
}

function renderIrrigation() {
  const head = doc?.getElementById("irr-head");
  const grid = doc?.getElementById("irr-grid");
  if (!head || !grid) return;
  const config = irrigationConfig();

  if (!config.zones.length) {
    if (state.irrigationSignature !== "empty" || !head.querySelector(".dm-scene-empty")) {
      state.irrigationSignature = "empty";
      head.innerHTML = emptyState("🌱", t("Nessuna zona configurata", "No zone configured"), t("Aggiungi le zone di irrigazione dall'editor per vedere il prato.", "Add the irrigation zones from the editor to see the lawn."));
      grid.innerHTML = "";
    }
    return;
  }

  const signature = irrigationSignature(config);
  if (state.irrigationSignature !== signature || !head.querySelector("[data-dm-lawn]")) {
    state.irrigationSignature = signature;
    head.innerHTML = `<div class="dm-irr" data-dm-irrigation-scene="true" data-dm-irr-running="false">
      ${lawnMarkup(config.zones)}
      ${programMarkup(config)}
      ${config.zones.length > MAX_LAWN_ZONES ? `<p class="dm-irr-overflow">${esc(t(`Il prato mostra le prime ${MAX_LAWN_ZONES} zone; sotto trovi tutte le ${config.zones.length}.`, `The lawn shows the first ${MAX_LAWN_ZONES} zones; all ${config.zones.length} are listed below.`))}</p>` : ""}
    </div>`;
    grid.innerHTML = config.zones.map((zone, index) => zoneCardMarkup(zone, index)).join("");
  }

  syncIrrigationValues(head.querySelector("[data-dm-irrigation-scene]") || head, grid, config);
}

/* ─────────────────────────────── plumbing ───────────────────────────────── */

function installRenderOwners() {
  const owners = [
    ["renderPiscina", POOL_MARKER, renderPool],
    ["renderIrrigazione", IRRIGATION_MARKER, renderIrrigation],
  ];
  for (const [name, marker, renderer] of owners) {
    const current = root[name];
    if (typeof current === "function" && current[marker]) continue;
    function owned(...args) {
      renderer(...args);
    }
    owned[marker] = true;
    owned.__dmPrevious = current;
    root[name] = owned;
  }
}

function paint() {
  state.frame = 0;
  installRenderOwners();
  if (hasPage("page-piscina")) renderPool();
  if (hasPage("page-irrigazione")) renderIrrigation();
}

function schedule() {
  if (state.frame) return;
  state.frame = root.requestAnimationFrame?.(paint) || root.setTimeout?.(paint, 0) || 0;
}

/* I comandi di una vasca.
 *
 * La prima passa dal runtime: e' lui che tiene i suoi secondi di filtrazione e
 * che ferma la pompa da solo quando ha finito, e togliergli il comando
 * significherebbe avere due contabilita' sulla stessa vasca. Delle altre — che
 * il runtime non sa nemmeno che esistano — si occupa `pool-extra-section.js`.
 */
function poolCommand(button) {
  const index = Number(button.closest("[data-dm-pool-index]")?.dataset.dmPoolIndex);
  if (!Number.isFinite(index) || index === 0) {
    root.cdPoolBtn?.(button);
    return;
  }
  extraPoolCommand(button, index);
}

function commandTarget(event) {
  return event.target?.closest?.("[data-act]");
}

function installListeners() {
  if (!doc) return;
  doc.addEventListener("click", (event) => {
    /* Prima dei comandi: una scheda non porta `data-act`, e il filtro qui
     * sotto scarta tutto quello che non ne ha. */
    const scheda = event.target?.closest?.("[data-dm-pool-tab]");
    if (scheda) {
      event.preventDefault();
      const wrap = scheda.closest("#pool-wrap");
      state.poolScelta = Number(scheda.dataset.dmPoolTab) || 0;
      /* Si accende la scheda e si scopre la sua vasca: non si ridisegna
       * niente, o l'acqua ripartirebbe da ferma ogni volta che si passa da una
       * piscina all'altra. */
      if (wrap) showPool(wrap, state.poolScelta);
      return;
    }
    const button = commandTarget(event);
    if (!button) return;
    if (button.closest("#pool-wrap[data-dm-pool-scene]")) {
      event.preventDefault();
      poolCommand(button);
      schedule();
      return;
    }
    if (button.closest("[data-dm-irrigation-scene]") || button.closest("#irr-grid")) {
      event.preventDefault();
      root.cdIrrBtn?.(button);
      schedule();
    }
  });

  doc.addEventListener("click", (event) => {
    if (event.target?.closest?.('.tab[data-tab="piscina"],.tab[data-tab="irrigazione"]')) {
      root.queueMicrotask?.(schedule);
    }
  }, true);

  for (const eventName of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:state-changed",
    "dashboardmodern:persistence-restored",
    "dashboardmodern:config-reset",
  ]) root.addEventListener?.(eventName, schedule);
}

function installStyles() {
  installStyle("dm-pool-irrigation-scene-style", `
    /* Le schede delle piscine: le stesse dell'Energia, che stanno in cima alla
       loro pagina e si scorrono di lato quando le vasche sono tante. */
    .dm-pool-tabs{display:flex;gap:8px;overflow-x:auto;-webkit-overflow-scrolling:touch;margin:0 0 12px;padding:4px;scrollbar-width:none}
    .dm-pool-tabs::-webkit-scrollbar{display:none}
    .dm-pool-tabs .dm-pool-tab{flex:0 0 auto;white-space:nowrap}
    #pool-wrap .dm-pool-block[hidden]{display:none!important}

    #page-piscina #pool-wrap[data-dm-pool-scene]{
      box-sizing:border-box!important;position:static!important;width:min(100%,1040px)!important;max-width:1040px!important;
      margin:0 auto!important;padding:0 4px 18px!important;display:grid!important;gap:14px!important
    }
    /* Ogni vasca e' un blocco per conto suo: con una sola non si vede nessuna
     * differenza, con due la seconda comincia dove finisce la prima invece di
     * incastrarsi fra le sue schede. */
    #page-piscina #pool-wrap[data-dm-pool-scene] .dm-pool-block{display:grid!important;gap:14px!important;min-width:0!important}
    #page-piscina #pool-wrap[data-dm-pool-scene][data-dm-pool-count="1"] .dm-pool-block{gap:inherit!important}
    #page-piscina .dm-pool-name{display:flex!important;align-items:center!important;gap:9px!important;margin:2px 2px -2px!important}
    #page-piscina .dm-pool-name strong{font-size:15px!important;font-weight:900!important;letter-spacing:.01em!important;color:var(--text,#0f172a)!important}
    #page-piscina .dm-pool-name-icon{font-size:17px!important}
    #page-irrigazione .dm-irr{display:grid!important;gap:14px!important;width:100%!important;margin:0 0 14px!important}
    #page-irrigazione #irr-grid{grid-template-columns:repeat(auto-fill,minmax(232px,1fr))!important;gap:12px!important;padding:0 4px 18px!important}

    /* ── shared atoms ─────────────────────────────────────────────────── */
    .dm-scene-empty{display:grid;justify-items:center;gap:6px;padding:44px 20px;border:1px dashed var(--card-border,#dbe4ee);border-radius:24px;background:var(--card-bg,#fff);color:var(--text-dim,#64748b);text-align:center}
    .dm-scene-empty-icon{font-size:38px;line-height:1}
    .dm-scene-empty strong{color:var(--text,#0f172a);font-size:15px}
    .dm-scene-empty span{font-size:12.5px;max-width:38ch}
    .dm-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;box-sizing:border-box;min-height:44px;padding:9px 14px;border:1px solid transparent;border-radius:14px;font-family:inherit;font-size:13px;font-weight:800;line-height:1.1;cursor:pointer;transition:transform .16s ease,box-shadow .16s ease,filter .16s ease}
    .dm-btn.dm-compact{min-height:38px;padding:7px 10px;font-size:12px;border-radius:12px}
    .dm-btn.dm-primary{background:linear-gradient(140deg,#22c1e8,#0369a1);color:#fff;box-shadow:0 8px 20px rgba(3,105,161,.26)}
    .dm-btn.dm-warn{background:linear-gradient(140deg,#fbbf24,#f97316);color:#3b1d05;box-shadow:0 8px 20px rgba(249,115,22,.24)}
    .dm-btn.dm-ghost{background:var(--surface-2,#f1f5f9);color:var(--text,#0f172a);border-color:var(--card-border,#dbe4ee)}
    .dm-btn:hover{transform:translateY(-1px);filter:saturate(1.06)}
    .dm-btn:active{transform:translateY(0)}
    .dm-btn:focus-visible{outline:3px solid var(--accent,#0ea5e9);outline-offset:2px}

    /* ── pool scene ───────────────────────────────────────────────────── */
    .dm-pool-stage{
      position:relative;box-sizing:border-box;width:100%;height:clamp(268px,30vw,392px);overflow:hidden;
      border:1px solid var(--card-border,#dbe4ee);border-radius:28px;isolation:isolate;
      box-shadow:var(--shadow-sculpted,0 10px 30px rgba(15,23,42,.10))
    }
    .dm-pool-stage>*{position:absolute}
    .dm-pool-sky{inset:0 0 66% 0;background:linear-gradient(180deg,#6cc0f2 0%,#a9dcf9 52%,#dcf1ff 100%)}
    .dm-pool-sun{left:60%;top:6%;width:70px;height:70px;border-radius:50%;background:radial-gradient(circle,#fff6cf 0 32%,rgba(255,236,160,.65) 48%,rgba(255,236,160,0) 72%);filter:blur(.3px)}
    .dm-pool-hedge{
      inset:auto 0 66% 0;height:10%;
      background:
        radial-gradient(ellipse 4.5% 92% at 8% 100%,#3a8f5c 0 100%,transparent 0),
        radial-gradient(ellipse 5.5% 100% at 26% 100%,#2f7c4e 0 100%,transparent 0),
        radial-gradient(ellipse 4% 84% at 46% 100%,#3a8f5c 0 100%,transparent 0),
        radial-gradient(ellipse 5% 96% at 64% 100%,#2f7c4e 0 100%,transparent 0),
        radial-gradient(ellipse 4.5% 90% at 84% 100%,#3a8f5c 0 100%,transparent 0),
        linear-gradient(180deg,transparent 62%,#2a7247 63%)
    }
    .dm-pool-plant{bottom:66%;width:66px;height:78px;background:
      radial-gradient(ellipse at 50% 100%,#1f6b46 0 42%,transparent 43%),
      radial-gradient(ellipse at 22% 78%,#2c8b58 0 32%,transparent 33%),
      radial-gradient(ellipse at 78% 74%,#2c8b58 0 30%,transparent 31%);
      filter:drop-shadow(0 6px 8px rgba(15,23,42,.16))}
    .dm-pool-plant.dm-left{left:2%}
    .dm-pool-plant.dm-right{right:3%;transform:scaleX(-1) scale(.86)}
    .dm-pool-deck{
      inset:34% 0 0 0;
      background:
        repeating-linear-gradient(92deg,rgba(255,255,255,.28) 0 1px,transparent 1px 46px),
        linear-gradient(180deg,#efe3d2 0%,#e3d3bd 45%,#d8c5ab 100%)
    }
    .dm-pool-lounger{right:6%;bottom:6%;width:96px;height:40px}
    .dm-pool-lounger i{position:absolute;inset:auto 0 8px 0;height:12px;border-radius:8px;background:linear-gradient(180deg,#fdfdfd,#e2e8f0);box-shadow:0 5px 10px rgba(15,23,42,.18)}
    .dm-pool-lounger b{position:absolute;left:0;bottom:16px;width:44px;height:26px;border-radius:10px 14px 4px 4px;background:linear-gradient(160deg,#fdfdfd,#dfe7ef);transform:rotate(-16deg);transform-origin:left bottom}
    .dm-pool-parasol{right:9%;bottom:30%;width:96px;height:96px}
    .dm-pool-parasol i{position:absolute;left:50%;bottom:0;width:4px;height:64px;margin-left:-2px;border-radius:3px;background:linear-gradient(180deg,#cbd5e1,#94a3b8)}
    .dm-pool-parasol b{position:absolute;left:0;top:0;width:100%;height:36px;border-radius:60px 60px 6px 6px;background:conic-gradient(from 200deg,#f97316 0 25%,#fff7ed 0 50%,#f97316 0 75%,#fff7ed 0);clip-path:ellipse(50% 100% at 50% 100%);filter:drop-shadow(0 6px 10px rgba(15,23,42,.20))}

    /* A shallow rotateX is what turns a blue rectangle into a basin you look
       across: the coping, ladder and floats inherit the same plane, so the
       perspective stays consistent without a single extra element. */
    .dm-pool-basin{
      left:8%;right:29%;top:44%;bottom:10%;border-radius:20px 22px 34px 32px;overflow:visible;
      transform:perspective(760px) rotateX(22deg);transform-origin:50% 100%
    }
    .dm-pool-basin>*{position:absolute}
    .dm-pool-coping{inset:-11px;border:11px solid #f6f1e8;border-radius:30px;box-shadow:inset 0 0 0 1px rgba(15,23,42,.07),0 16px 30px rgba(15,23,42,.20);pointer-events:none}
    .dm-pool-water{
      position:absolute;inset:0;overflow:hidden;border-radius:inherit;
      background:
        linear-gradient(170deg,rgba(255,255,255,.34) 0 12%,transparent 34%),
        linear-gradient(160deg,#5fe0ee 0%,#20b8e0 38%,#0b84c6 74%,#0668a8 100%);
      box-shadow:inset 0 0 0 3px rgba(255,255,255,.34),inset 0 -26px 46px rgba(3,80,130,.36)
    }
    .dm-pool-water>*{position:absolute}
    .dm-pool-caustics{
      inset:-20%;opacity:.5;mix-blend-mode:screen;
      background:
        radial-gradient(ellipse 60px 26px at 20% 30%,rgba(255,255,255,.55),transparent 60%),
        radial-gradient(ellipse 46px 20px at 62% 58%,rgba(255,255,255,.42),transparent 60%),
        radial-gradient(ellipse 70px 24px at 84% 24%,rgba(255,255,255,.38),transparent 60%),
        repeating-linear-gradient(118deg,rgba(255,255,255,.20) 0 2px,transparent 2px 26px);
      animation:dmPoolCaustics 9s linear infinite
    }
    .dm-pool-caustics.dm-slow{opacity:.3;animation-duration:16s;animation-direction:reverse;filter:blur(1px)}
    .dm-pool-shimmer{inset:0;background:linear-gradient(105deg,transparent 38%,rgba(255,255,255,.30) 50%,transparent 62%);background-size:240% 100%;animation:dmPoolShimmer 7s linear infinite}
    .dm-pool-lane{left:6%;right:6%;height:2px;border-radius:2px;background:rgba(236,254,255,.5);box-shadow:0 0 10px rgba(255,255,255,.45)}
    .dm-pool-lane.dm-a{top:38%}
    .dm-pool-lane.dm-b{top:68%}
    .dm-pool-ripple{left:-10%;right:-10%;height:14px;opacity:.5;background:radial-gradient(circle at 14px 15px,transparent 11px,rgba(255,255,255,.42) 12px,transparent 13px) repeat-x;background-size:30px 14px;animation:dmPoolRipple 6s linear infinite}
    .dm-pool-ripple.dm-a{top:16%}
    .dm-pool-ripple.dm-b{top:56%;opacity:.3;animation-duration:9s;animation-direction:reverse}
    .dm-pool-glow{inset:0;opacity:0;background:radial-gradient(ellipse at 50% 62%,rgba(255,241,186,.62),rgba(255,214,120,.20) 42%,transparent 72%);transition:opacity .6s ease}
    .dm-pool-bubbles{inset:0;opacity:0;transition:opacity .4s ease}
    .dm-pool-bubbles i{position:absolute;bottom:-8px;width:7px;height:7px;border-radius:50%;background:radial-gradient(circle at 32% 30%,rgba(255,255,255,.95),rgba(255,255,255,.28));animation:dmPoolBubble 3.4s ease-in infinite}
    .dm-pool-steam{position:absolute;inset:auto 0 58% 0;height:0;opacity:0;transition:opacity .5s ease;pointer-events:none}
    .dm-pool-steam i{position:absolute;bottom:0;width:26px;height:26px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.6),transparent 66%);filter:blur(4px);animation:dmPoolSteam 5.2s ease-out infinite}

    .dm-pool-steps{left:8px;bottom:8px;display:grid;gap:5px;width:76px;z-index:3}
    .dm-pool-steps i{display:block;height:9px;border-radius:0 12px 12px 0;background:rgba(240,253,255,.72);box-shadow:inset 0 0 0 1px rgba(255,255,255,.7)}
    .dm-pool-steps i:nth-child(2){width:60px}
    .dm-pool-steps i:nth-child(3){width:44px}
    .dm-pool-ladder{right:26px;top:-22px;width:40px;height:56px;border-left:5px solid #f2fafd;border-right:5px solid #f2fafd;border-radius:18px 18px 0 0;z-index:4;filter:drop-shadow(0 4px 6px rgba(15,23,42,.30))}
    .dm-pool-ladder i{display:block;width:100%;height:4px;margin-top:12px;background:#f2fafd}
    .dm-pool-ring{right:22%;top:26%;width:46px;height:46px;border-radius:50%;border:9px solid #fb7185;background:radial-gradient(circle,transparent 0 44%,rgba(255,255,255,.4) 45% 52%,transparent 53%);box-shadow:0 8px 16px rgba(3,80,130,.30);animation:dmPoolFloat 6.5s ease-in-out infinite;z-index:3}

    .dm-pool-readout{
      right:5%;top:8%;display:grid;place-items:center;gap:2px;width:clamp(96px,10vw,124px);aspect-ratio:1;
      border:1px solid rgba(255,255,255,.7);border-radius:50%;background:rgba(8,71,110,.30);
      color:#fff;text-align:center;backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px);
      box-shadow:0 12px 26px rgba(3,80,130,.24),inset 0 0 0 6px rgba(255,255,255,.12)
    }
    .dm-pool-readout-value{font-family:Oswald,Inter,sans-serif;font-size:clamp(24px,2.6vw,34px);font-weight:700;line-height:1;text-shadow:0 2px 10px rgba(3,80,130,.5)}
    .dm-pool-readout-label{max-width:88%;font-size:10px;font-weight:800;letter-spacing:.3px;opacity:.92;text-shadow:0 1px 5px rgba(3,80,130,.6)}
    .dm-pool-flags{left:4%;top:5%;display:flex;flex-wrap:wrap;gap:6px;max-width:56%}
    .dm-pool-flag{padding:4px 10px;border-radius:999px;background:rgba(255,255,255,.86);color:#0f172a;font-size:11px;font-weight:800;box-shadow:0 6px 14px rgba(15,23,42,.14)}
    .dm-pool-flag.dm-heat{background:rgba(254,215,170,.94);color:#9a3412}
    .dm-pool-flag.dm-light{background:rgba(254,240,138,.94);color:#854d0e}

    [data-dm-pool-filtering="true"] .dm-pool-bubbles{opacity:1}
    [data-dm-pool-heating="true"] .dm-pool-steam{opacity:1}
    [data-dm-pool-light="true"] .dm-pool-glow{opacity:1}
    [data-dm-pool-light="true"] .dm-pool-water{box-shadow:inset 0 0 0 3px rgba(255,255,255,.42),inset 0 -26px 46px rgba(3,80,130,.30),0 0 34px rgba(255,214,120,.30)}

    /* ── pool controls & cards ────────────────────────────────────────── */
    .dm-pool-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
    .dm-pool-tile{
      display:grid;grid-template-columns:44px minmax(0,1fr);grid-template-rows:auto auto;align-items:center;gap:2px 11px;
      box-sizing:border-box;min-height:66px;padding:11px 14px;border:1px solid var(--card-border,#dbe4ee);border-radius:18px;
      background:var(--card-bg,#fff);color:var(--text,#0f172a);font-family:inherit;text-align:left;cursor:pointer;
      box-shadow:var(--shadow-sculpted,0 6px 18px rgba(15,23,42,.07));transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease,background .18s ease
    }
    .dm-pool-tile-icon{grid-row:1/3;display:grid;place-items:center;width:44px;height:44px;border-radius:14px;background:var(--surface-2,#f1f5f9);font-size:21px}
    .dm-pool-tile-label{font-size:13.5px;font-weight:850}
    .dm-pool-tile-state{color:var(--text-dim,#64748b);font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:.4px}
    .dm-pool-tile:hover{transform:translateY(-2px);box-shadow:var(--shadow-hover,0 14px 32px rgba(15,23,42,.12))}
    .dm-pool-tile:focus-visible{outline:3px solid var(--accent,#0ea5e9);outline-offset:2px}
    .dm-pool-tile[data-on="true"]{border-color:rgba(14,165,233,.48);background:linear-gradient(150deg,rgba(224,247,255,.96),rgba(240,250,255,.9))}
    .dm-pool-tile[data-on="true"] .dm-pool-tile-icon{background:linear-gradient(150deg,#38bdf8,#0369a1);box-shadow:0 6px 14px rgba(3,105,161,.32)}
    .dm-pool-tile[data-on="true"] .dm-pool-tile-state{color:#0369a1}
    .dm-pool-tile[data-dm-pool-tile="heat"][data-on="true"]{border-color:rgba(249,115,22,.45);background:linear-gradient(150deg,rgba(255,237,213,.96),rgba(255,247,237,.9))}
    .dm-pool-tile[data-dm-pool-tile="heat"][data-on="true"] .dm-pool-tile-icon{background:linear-gradient(150deg,#fb923c,#ea580c);box-shadow:0 6px 14px rgba(234,88,12,.30)}
    .dm-pool-tile[data-dm-pool-tile="heat"][data-on="true"] .dm-pool-tile-state{color:#c2410c}
    .dm-pool-tile[data-dm-pool-tile="light"][data-on="true"]{border-color:rgba(245,158,11,.45);background:linear-gradient(150deg,rgba(254,249,195,.96),rgba(255,252,232,.9))}
    .dm-pool-tile[data-dm-pool-tile="light"][data-on="true"] .dm-pool-tile-icon{background:linear-gradient(150deg,#fde047,#f59e0b);box-shadow:0 6px 14px rgba(245,158,11,.30)}
    .dm-pool-tile[data-dm-pool-tile="light"][data-on="true"] .dm-pool-tile-state{color:#a16207}

    .dm-pool-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(298px,1fr));gap:12px;align-items:start}
    .dm-pool-card{box-sizing:border-box;display:grid;gap:12px;padding:16px;border:1px solid var(--card-border,#dbe4ee);border-radius:22px;background:var(--card-bg,#fff);box-shadow:var(--shadow-sculpted,0 6px 18px rgba(15,23,42,.07))}
    .dm-pool-card-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
    .dm-pool-card-title{display:flex;align-items:center;gap:8px;color:var(--text,#0f172a);font-size:14px;font-weight:900}
    .dm-pool-card-title i{font-style:normal;font-size:17px}
    .dm-pool-badge{padding:4px 11px;border-radius:999px;background:var(--surface-2,#f1f5f9);color:var(--text-dim,#64748b);font-size:11px;font-weight:850;text-transform:uppercase;letter-spacing:.4px}
    .dm-pool-badge[data-on="true"]{background:rgba(16,185,129,.16);color:#059669}
    .dm-pool-gauges{display:grid;gap:14px}
    .dm-gauge{display:grid;gap:7px}
    .dm-gauge-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
    .dm-gauge-label{color:var(--text,#0f172a);font-size:12.5px;font-weight:800}
    .dm-gauge-value{font-family:Oswald,Inter,sans-serif;font-size:19px;font-weight:700;color:var(--text,#0f172a)}
    .dm-gauge-track{position:relative;height:9px;border-radius:999px;background:linear-gradient(90deg,#fca5a5,#fcd34d 26%,#86efac 50%,#fcd34d 74%,#fca5a5)}
    .dm-gauge-band{position:absolute;top:-2px;bottom:-2px;border-radius:999px;background:rgba(255,255,255,.30);box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.85)}
    .dm-gauge-pin{position:absolute;top:50%;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;background:var(--card-bg,#fff);box-shadow:0 0 0 3px currentColor,0 4px 10px rgba(15,23,42,.25);color:#16a34a;transition:left .5s cubic-bezier(.2,.8,.2,1)}
    .dm-gauge[data-verdict="low"] .dm-gauge-pin,.dm-gauge[data-verdict="high"] .dm-gauge-pin{color:#f59e0b}
    .dm-gauge-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11.5px;font-weight:750}
    .dm-gauge-verdict{color:#059669;text-transform:uppercase;letter-spacing:.3px}
    .dm-gauge[data-verdict="low"] .dm-gauge-verdict,.dm-gauge[data-verdict="high"] .dm-gauge-verdict{color:#b45309}
    .dm-gauge-range{color:var(--text-dim,#64748b)}

    .dm-pool-filtration-body{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:16px}
    .dm-ring{
      display:grid;place-items:center;width:104px;height:104px;border-radius:50%;
      background:conic-gradient(from -90deg,#38bdf8 0 calc(var(--pct,0) * 1%),var(--surface-3,#e2e8f0) 0);
      transition:background .8s linear
    }
    .dm-ring-core{display:grid;place-items:center;gap:1px;width:78px;height:78px;border-radius:50%;background:var(--card-bg,#fff);box-shadow:inset 0 0 0 1px var(--card-border,#dbe4ee)}
    .dm-ring-core b{font-family:Oswald,Inter,sans-serif;font-size:22px;font-weight:700;color:var(--text,#0f172a)}
    .dm-ring-core i{font-style:normal;font-size:11px;font-weight:800;color:var(--text-dim,#64748b)}
    .dm-pool-filtration-copy{display:grid;gap:10px;min-width:0}
    .dm-pool-note{margin:0;color:var(--text-dim,#64748b);font-size:12px;font-weight:700;line-height:1.45}
    .dm-pool-actions{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:8px}

    /* ── irrigation lawn ──────────────────────────────────────────────── */
    .dm-lawn{
      position:relative;box-sizing:border-box;width:100%;height:clamp(288px,32vw,410px);overflow:hidden;
      border:1px solid var(--card-border,#dbe4ee);border-radius:28px;isolation:isolate;
      box-shadow:var(--shadow-sculpted,0 10px 30px rgba(15,23,42,.10))
    }
    .dm-lawn>*{position:absolute}
    .dm-lawn-sky{inset:0 0 74% 0;background:linear-gradient(180deg,#8ed2f6 0%,#c7e9fb 60%,#e8f6ff 100%)}
    .dm-lawn-sun{left:8%;top:8%;width:58px;height:58px;border-radius:50%;background:radial-gradient(circle,#fff8d6 0 34%,rgba(255,238,170,.6) 50%,rgba(255,238,170,0) 74%)}
    .dm-lawn-hedge{
      inset:auto 0 74% 0;height:9%;
      background:
        radial-gradient(ellipse 4% 88% at 6% 100%,#3a8f5c 0 100%,transparent 0),
        radial-gradient(ellipse 5% 100% at 20% 100%,#2f7c4e 0 100%,transparent 0),
        radial-gradient(ellipse 3.6% 80% at 34% 100%,#3a8f5c 0 100%,transparent 0),
        radial-gradient(ellipse 4.6% 96% at 48% 100%,#2f7c4e 0 100%,transparent 0),
        radial-gradient(ellipse 4% 86% at 62% 100%,#3a8f5c 0 100%,transparent 0),
        radial-gradient(ellipse 5% 100% at 76% 100%,#2f7c4e 0 100%,transparent 0),
        radial-gradient(ellipse 3.8% 84% at 90% 100%,#3a8f5c 0 100%,transparent 0),
        linear-gradient(180deg,transparent 64%,#2a7247 65%)
    }
    .dm-lawn-tree{bottom:74%;width:80px;height:92px;background:
      radial-gradient(ellipse 46% 34% at 50% 26%,#3d9a5e 0 100%,transparent 0),
      radial-gradient(ellipse 40% 30% at 26% 52%,#2f7c4e 0 100%,transparent 0),
      radial-gradient(ellipse 40% 30% at 74% 50%,#43a465 0 100%,transparent 0),
      radial-gradient(ellipse 34% 26% at 50% 72%,#2a7247 0 100%,transparent 0);
      filter:drop-shadow(0 8px 10px rgba(15,23,42,.18))}
    .dm-lawn-tree.dm-left{left:1%}
    .dm-lawn-tree.dm-right{right:2%;transform:scaleX(-1) scale(.82)}
    .dm-lawn-turf{
      inset:26% 0 0 0;overflow:hidden;
      background:
        radial-gradient(ellipse at 50% -8%,rgba(255,255,255,.30),transparent 44%),
        radial-gradient(ellipse at 50% 118%,rgba(9,48,20,.30),transparent 52%),
        linear-gradient(180deg,#55a959 0%,#3f9049 44%,#2c7135 100%)
    }
    .dm-lawn-turf>*{position:absolute}
    .dm-lawn-stripes{inset:0;opacity:.55;background:repeating-linear-gradient(97deg,rgba(255,255,255,.11) 0 34px,rgba(0,0,0,.05) 34px 68px)}
    .dm-lawn-texture{inset:0;opacity:.5;background:repeating-linear-gradient(84deg,rgba(9,60,25,.16) 0 2px,transparent 2px 6px),repeating-linear-gradient(-78deg,rgba(255,255,255,.08) 0 2px,transparent 2px 9px)}
    .dm-lawn-path{left:-12%;right:70%;bottom:-46%;height:66%;border-radius:50%;background:linear-gradient(150deg,#e9dcc4,#cfbe9e);opacity:.8;box-shadow:inset 0 3px 0 rgba(255,255,255,.4)}
    .dm-lawn-flowers{inset:0;pointer-events:none}
    .dm-lawn-flowers i{position:absolute;width:7px;height:7px;border-radius:50%;background:radial-gradient(circle,#fff 0 34%,#fbbf24 35% 70%,rgba(251,191,36,0) 71%);opacity:.85}
    .dm-lawn-flowers i:nth-child(3n){background:radial-gradient(circle,#fff 0 34%,#f472b6 35% 70%,rgba(244,114,182,0) 71%)}
    .dm-lawn-flowers i:nth-child(4n){background:radial-gradient(circle,#fff 0 34%,#c084fc 35% 70%,rgba(192,132,252,0) 71%)}
    .dm-lawn-blades{inset:auto 0 0 0;height:26px}
    .dm-lawn-blades i{
      position:absolute;bottom:-3px;width:7px;
      border-radius:60% 60% 0 0/90% 90% 0 0;background:linear-gradient(180deg,#5fb85f,#2c6f36);transform-origin:50% 100%;
      animation:dmBladeSway 3.6s ease-in-out infinite
    }
    .dm-lawn-zones{inset:0}

    /* ── sprinklers and the splashes on the grass ─────────────────────── */
    .dm-zone{
      position:absolute;left:var(--zx,50%);top:var(--zy,60%);width:0;height:0;
      font-size:calc(clamp(11px,1.35vw,16px) * var(--zs,1))
    }
    .dm-zone>*{position:absolute;left:0;top:0}
    .dm-sprinkler{width:1.5em;height:2.1em;margin:-2.1em 0 0 -.75em;z-index:4}
    .dm-sprinkler b{position:absolute;left:.35em;bottom:0;width:.8em;height:1.5em;border-radius:.3em .3em .12em .12em;background:linear-gradient(180deg,#e2e8f0,#94a3b8);box-shadow:0 .1em .25em rgba(15,23,42,.35)}
    .dm-sprinkler u{position:absolute;left:0;top:0;width:1.5em;height:.72em;border-radius:.4em;background:linear-gradient(150deg,#f8fafc,#64748b);box-shadow:0 .1em .2em rgba(15,23,42,.35)}
    .dm-zone[data-state="on"] .dm-sprinkler u{background:linear-gradient(150deg,#e0f2fe,#0ea5e9);box-shadow:0 0 .7em rgba(56,189,248,.85)}

    .dm-zone-wet{width:17em;height:6em;margin:-2.4em 0 0 -8.5em;border-radius:50%;opacity:0;
      background:radial-gradient(ellipse at 50% 50%,rgba(4,52,20,.62),rgba(4,52,20,.32) 44%,transparent 74%);
      transition:opacity .8s ease;z-index:1}
    .dm-zone-mist{width:13em;height:8em;margin:-6.6em 0 0 -6.5em;border-radius:50%;opacity:0;
      background:radial-gradient(ellipse at 50% 62%,rgba(255,255,255,.62),rgba(186,230,253,.28) 48%,transparent 70%);filter:blur(.32em);
      transition:opacity .6s ease;z-index:2}
    .dm-zone-fan{
      width:14em;height:7.2em;margin:-9em 0 0 -7em;opacity:0;transform-origin:50% 100%;
      clip-path:polygon(50% 100%,2% 4%,98% 4%);
      background:radial-gradient(ellipse 62% 96% at 50% 100%,rgba(255,255,255,.72),rgba(186,230,253,.34) 52%,rgba(186,230,253,0) 82%);
      filter:blur(.34em);z-index:3;transition:opacity .5s ease
    }
    .dm-zone-spray{z-index:5}
    .dm-zone-spray i{position:absolute;left:0;top:-2.1em;width:.56em;height:.84em;margin:0 0 0 -.28em;border-radius:50% 50% 42% 42%;background:linear-gradient(180deg,#fff,rgba(125,211,252,.95));box-shadow:0 0 .45em rgba(224,247,255,.95);opacity:0}
    .dm-zone-splashes{z-index:2}
    .dm-zone-splashes i{position:absolute;top:-.25em;width:2.8em;height:1.05em;margin:0 0 0 -1.4em;border-radius:50%;border:.2em solid rgba(255,255,255,.92);box-shadow:0 0 .5em rgba(255,255,255,.5),inset 0 0 .4em rgba(186,230,253,.6);opacity:0}

    .dm-zone[data-state="on"] .dm-zone-wet{opacity:1;animation:dmWetBreathe 5s ease-in-out infinite}
    .dm-zone[data-state="on"] .dm-zone-mist{opacity:.85;animation:dmMist 4.2s ease-in-out infinite}
    .dm-zone[data-state="on"] .dm-zone-fan{opacity:.55;animation:dmFanSweep 3.4s ease-in-out infinite alternate}
    /* Longhands on purpose: the per-droplet rules below carry only the delay,
       and an "animation" shorthand here would reset every one of them to 0 —
       the whole fan would then leave the head in a single clump. */
    .dm-zone[data-state="on"] .dm-zone-spray i{
      animation-name:var(--drop-path);animation-duration:1.2s;animation-timing-function:linear;animation-iteration-count:infinite
    }
    .dm-zone[data-state="on"] .dm-zone-splashes i{
      animation-name:dmSplash;animation-duration:1.2s;animation-timing-function:ease-out;animation-iteration-count:infinite
    }

    .dm-zone-spray .dm-drop-0{--drop-path:dmDrop0;animation-delay:0s}
    .dm-zone-spray .dm-drop-1{--drop-path:dmDrop1;animation-delay:0.15s}
    .dm-zone-spray .dm-drop-2{--drop-path:dmDrop2;animation-delay:0.3s}
    .dm-zone-spray .dm-drop-3{--drop-path:dmDrop3;animation-delay:0.45s}
    .dm-zone-spray .dm-drop-4{--drop-path:dmDrop4;animation-delay:0.6s}
    .dm-zone-spray .dm-drop-5{--drop-path:dmDrop5;animation-delay:0.75s}
    .dm-zone-spray .dm-drop-6{--drop-path:dmDrop6;animation-delay:0.9s}
    .dm-zone-spray .dm-drop-7{--drop-path:dmDrop7;animation-delay:1.05s}

    .dm-zone-splashes .dm-drop-0{left:5.6em;animation-delay:1.02s}
    .dm-zone-splashes .dm-drop-1{left:-5.2em;animation-delay:1.17s}
    .dm-zone-splashes .dm-drop-2{left:3.4em;animation-delay:1.32s}
    .dm-zone-splashes .dm-drop-3{left:-3.2em;animation-delay:1.47s}
    .dm-zone-splashes .dm-drop-4{left:7.2em;animation-delay:1.62s}
    .dm-zone-splashes .dm-drop-5{left:-6.8em;animation-delay:1.77s}
    .dm-zone-splashes .dm-drop-6{left:1.4em;animation-delay:1.92s}
    .dm-zone-splashes .dm-drop-7{left:-1.2em;animation-delay:2.07s}

    .dm-zone-tag{
      display:inline-flex;align-items:center;gap:.5em;white-space:nowrap;padding:.34em .72em;margin:1.1em 0 0 -3.6em;
      border-radius:999px;background:rgba(255,255,255,.9);color:#14532d;font-size:.95em;font-weight:850;
      box-shadow:0 .3em .7em rgba(15,23,42,.2);z-index:6;transition:background .3s ease,color .3s ease
    }
    .dm-zone-tag em{font-style:normal;max-width:9em;overflow:hidden;text-overflow:ellipsis}
    .dm-zone-tag i{font-style:normal;padding:.1em .45em;border-radius:999px;background:rgba(15,118,110,.14);font-variant-numeric:tabular-nums}
    .dm-zone[data-state="on"] .dm-zone-tag{background:linear-gradient(140deg,#0ea5e9,#0369a1);color:#fff}
    .dm-zone[data-state="on"] .dm-zone-tag i{background:rgba(255,255,255,.24)}

    /* ── irrigation program & zone cards ──────────────────────────────── */
    .dm-irr-program{box-sizing:border-box;display:grid;gap:11px;padding:16px;border:1px solid var(--card-border,#dbe4ee);border-radius:22px;background:var(--card-bg,#fff);box-shadow:var(--shadow-sculpted,0 6px 18px rgba(15,23,42,.07))}
    .dm-irr-program-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
    .dm-irr-program-title{display:flex;align-items:center;gap:8px;color:var(--text,#0f172a);font-size:14.5px;font-weight:900}
    .dm-irr-program-title i{font-style:normal;font-size:17px}
    .dm-irr-chip{padding:4px 11px;border-radius:999px;background:var(--surface-2,#f1f5f9);color:var(--text-dim,#64748b);font-size:11.5px;font-weight:850}
    .dm-irr-chip[data-on="true"]{background:rgba(22,163,74,.15);color:#15803d}
    .dm-irr-meta{display:flex;flex-wrap:wrap;gap:7px}
    /* Il misuratore del terreno: stesso disegno di pH e cloro, un filo d'aria
       sopra per staccarlo dalle spille del meteo. */
    .dm-irr-soil{padding:2px 2px 0}
    /* Le caselle del sensore nella scheda di configurazione. */
    #ed-body [data-dm-irr-soil-fields]{display:grid;gap:8px;margin:8px 0}
    #ed-body [data-dm-irr-soil-fields] .ed-slot{display:grid;gap:4px;margin:0}
    #ed-body [data-dm-irr-soil-fields] .ed-form-row{display:flex;gap:8px;min-width:0}
    #ed-body [data-dm-irr-soil-fields] .ed-form-row>input{flex:1 1 auto;min-width:0}
    #ed-body .dm-irr-soil-band{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .dm-irr-meta-chip{padding:5px 11px;border-radius:12px;background:var(--surface-2,#f1f5f9);color:var(--text,#0f172a);font-size:12px;font-weight:750}
    .dm-irr-meta-chip[data-alert="true"]{background:rgba(245,158,11,.16);color:#b45309}
    .dm-irr-skip{padding:9px 12px;border-radius:12px;background:rgba(245,158,11,.14);color:#b45309;font-size:12.5px;font-weight:800}
    .dm-irr-actions{display:grid;grid-template-columns:repeat(auto-fit,minmax(146px,1fr));gap:8px}
    .dm-irr-overflow{margin:0;color:var(--text-dim,#64748b);font-size:12px;font-weight:700;text-align:center}

    .dm-irr-card{box-sizing:border-box;display:grid;gap:9px;padding:14px;border:1px solid var(--card-border,#dbe4ee);border-radius:20px;background:var(--card-bg,#fff);box-shadow:var(--shadow-sculpted,0 6px 18px rgba(15,23,42,.07));transition:border-color .25s ease,box-shadow .25s ease,transform .25s ease}
    .dm-irr-card[data-state="on"]{border-color:rgba(14,165,233,.5);box-shadow:0 12px 28px rgba(14,165,233,.20);transform:translateY(-2px)}
    .dm-irr-card-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
    .dm-irr-card-name{display:flex;align-items:center;gap:7px;min-width:0;color:var(--text,#0f172a);font-size:13.5px;font-weight:850}
    .dm-irr-card-name i{font-style:normal;font-size:16px}
    .dm-irr-card-chip{flex:0 0 auto;padding:3px 9px;border-radius:999px;background:var(--surface-2,#f1f5f9);color:var(--text-dim,#64748b);font-size:11.5px;font-weight:850;font-variant-numeric:tabular-nums}
    .dm-irr-card[data-state="on"] .dm-irr-card-chip{background:rgba(14,165,233,.18);color:#0369a1}
    .dm-irr-card-room{color:var(--text-dim,#64748b);font-size:11.5px;font-weight:750}
    .dm-irr-card-bar{height:7px;border-radius:999px;background:var(--surface-3,#e2e8f0);overflow:hidden}
    .dm-irr-card-bar b{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#7dd3fc,#0369a1);transition:width 1s linear}
    .dm-irr-card-actions{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:7px}

    /* ── animations ───────────────────────────────────────────────────── */
    @keyframes dmPoolCaustics{to{transform:translate3d(28px,-14px,0)}}
    @keyframes dmPoolShimmer{to{background-position:-240% 0}}
    @keyframes dmPoolRipple{to{transform:translateX(26px)}}
    @keyframes dmPoolBubble{0%{transform:translateY(0) scale(.55);opacity:0}18%{opacity:.85}100%{transform:translateY(-108px) scale(1.1);opacity:0}}
    @keyframes dmPoolSteam{0%{transform:translateY(0) scale(.6);opacity:0}25%{opacity:.55}100%{transform:translateY(-46px) scale(1.7);opacity:0}}
    @keyframes dmPoolFloat{0%,100%{transform:translate(0,0) rotate(-6deg)}50%{transform:translate(9px,-6px) rotate(7deg)}}
    @keyframes dmBladeSway{0%,100%{transform:rotate(-7deg)}50%{transform:rotate(8deg)}}
    @keyframes dmFanSweep{from{transform:rotate(-26deg)}to{transform:rotate(26deg)}}
    @keyframes dmMist{0%,100%{opacity:.55;transform:scale(.94)}50%{opacity:.9;transform:scale(1.06)}}
    @keyframes dmWetBreathe{0%,100%{opacity:.78}50%{opacity:1}}
    @keyframes dmSplash{0%{transform:scale(.25);opacity:0}18%{opacity:.95}100%{transform:scale(1.25);opacity:0}}
    @keyframes dmDrop0{0%{transform:translate(0,0) scale(.5);opacity:0}12%{opacity:1}50%{transform:translate(2.8em,-4.2em) scale(1)}100%{transform:translate(5.6em,.6em) scale(.55);opacity:0}}
    @keyframes dmDrop1{0%{transform:translate(0,0) scale(.5);opacity:0}12%{opacity:1}50%{transform:translate(-2.6em,-4em) scale(1)}100%{transform:translate(-5.2em,.6em) scale(.55);opacity:0}}
    @keyframes dmDrop2{0%{transform:translate(0,0) scale(.5);opacity:0}12%{opacity:1}50%{transform:translate(1.7em,-4.8em) scale(1)}100%{transform:translate(3.4em,.5em) scale(.55);opacity:0}}
    @keyframes dmDrop3{0%{transform:translate(0,0) scale(.5);opacity:0}12%{opacity:1}50%{transform:translate(-1.6em,-4.6em) scale(1)}100%{transform:translate(-3.2em,.5em) scale(.55);opacity:0}}
    @keyframes dmDrop4{0%{transform:translate(0,0) scale(.5);opacity:0}12%{opacity:1}50%{transform:translate(3.6em,-3.4em) scale(1)}100%{transform:translate(7.2em,.8em) scale(.55);opacity:0}}
    @keyframes dmDrop5{0%{transform:translate(0,0) scale(.5);opacity:0}12%{opacity:1}50%{transform:translate(-3.4em,-3.2em) scale(1)}100%{transform:translate(-6.8em,.8em) scale(.55);opacity:0}}
    @keyframes dmDrop6{0%{transform:translate(0,0) scale(.5);opacity:0}12%{opacity:1}50%{transform:translate(.7em,-5.2em) scale(1)}100%{transform:translate(1.4em,.4em) scale(.55);opacity:0}}
    @keyframes dmDrop7{0%{transform:translate(0,0) scale(.5);opacity:0}12%{opacity:1}50%{transform:translate(-.6em,-5em) scale(1)}100%{transform:translate(-1.2em,.4em) scale(.55);opacity:0}}

    /* ── dark theme ───────────────────────────────────────────────────── */
    html[data-theme="dark"] .dm-pool-sky{background:linear-gradient(180deg,#0b1b33 0%,#123153 58%,#1a4468 100%)}
    html[data-theme="dark"] .dm-pool-sun{background:radial-gradient(circle,#e8f4ff 0 26%,rgba(191,219,254,.42) 44%,rgba(191,219,254,0) 70%)}
    html[data-theme="dark"] .dm-pool-deck{background:repeating-linear-gradient(92deg,rgba(255,255,255,.08) 0 1px,transparent 1px 46px),linear-gradient(180deg,#3a3730 0%,#2e2b26 45%,#26241f 100%)}
    html[data-theme="dark"] .dm-pool-coping{border-color:#4a4a45}
    html[data-theme="dark"] .dm-pool-water{background:linear-gradient(170deg,rgba(255,255,255,.16) 0 12%,transparent 34%),linear-gradient(160deg,#1a8ba6 0%,#0d6f96 38%,#08507c 74%,#053a5e 100%)}
    html[data-theme="dark"] .dm-lawn-sky{background:linear-gradient(180deg,#0d1e35 0%,#16375a 62%,#1f4a6e 100%)}
    html[data-theme="dark"] .dm-lawn-sun{background:radial-gradient(circle,#eaf4ff 0 28%,rgba(191,219,254,.38) 46%,rgba(191,219,254,0) 72%)}
    html[data-theme="dark"] .dm-lawn-turf{background:radial-gradient(ellipse at 50% -10%,rgba(255,255,255,.12),transparent 46%),linear-gradient(180deg,#2c6b36 0%,#22562c 42%,#1a4423 100%)}
    html[data-theme="dark"] .dm-lawn-path{background:linear-gradient(180deg,#5b5347,#443f37)}
    html[data-theme="dark"] .dm-zone-tag{background:rgba(15,23,42,.82);color:#dbeafe}
    html[data-theme="dark"] .dm-pool-flag{background:rgba(15,23,42,.86);color:#e2e8f0}
    html[data-theme="dark"] .dm-gauge-track{background:linear-gradient(90deg,#b91c1c,#b45309 26%,#15803d 50%,#b45309 74%,#b91c1c)}
    html[data-theme="dark"] .dm-pool-hedge,html[data-theme="dark"] .dm-lawn-hedge{filter:brightness(.52) saturate(.8)}
    html[data-theme="dark"] .dm-pool-plant,html[data-theme="dark"] .dm-lawn-tree{filter:brightness(.55) saturate(.8) drop-shadow(0 8px 10px rgba(0,0,0,.4))}
    html[data-theme="dark"] .dm-pool-tile[data-on="true"]{background:linear-gradient(150deg,rgba(14,165,233,.24),rgba(3,105,161,.16))}
    html[data-theme="dark"] .dm-pool-tile[data-on="true"] .dm-pool-tile-state{color:#7dd3fc}
    html[data-theme="dark"] .dm-pool-tile[data-dm-pool-tile="heat"][data-on="true"]{background:linear-gradient(150deg,rgba(249,115,22,.26),rgba(194,65,12,.16))}
    html[data-theme="dark"] .dm-pool-tile[data-dm-pool-tile="heat"][data-on="true"] .dm-pool-tile-state{color:#fdba74}
    html[data-theme="dark"] .dm-pool-tile[data-dm-pool-tile="light"][data-on="true"]{background:linear-gradient(150deg,rgba(245,158,11,.26),rgba(161,98,7,.16))}
    html[data-theme="dark"] .dm-pool-tile[data-dm-pool-tile="light"][data-on="true"] .dm-pool-tile-state{color:#fcd34d}
    html[data-theme="dark"] .dm-gauge-band{background:rgba(255,255,255,.12);box-shadow:inset 0 0 0 1.5px rgba(226,232,240,.55)}
    html[data-theme="dark"] .dm-btn.dm-warn{color:#1f1204}

    /* ── responsive ───────────────────────────────────────────────────── */
    @media (max-width:760px){
      #page-piscina #pool-wrap[data-dm-pool-scene]{padding:0 2px 16px!important;gap:12px!important}
      .dm-pool-stage{height:clamp(224px,58vw,278px);border-radius:24px}
      .dm-pool-basin{left:5%;right:5%;top:46%;bottom:9%;transform:perspective(520px) rotateX(18deg)}
      .dm-pool-readout{right:4%;top:5%;width:82px}
      .dm-pool-readout-label{font-size:9px}
      .dm-pool-flags{max-width:52%;gap:4px}
      .dm-pool-flag{padding:3px 8px;font-size:10px}
      .dm-pool-lounger,.dm-pool-parasol,.dm-pool-plant{display:none}
      .dm-pool-ladder{right:12px;width:30px;height:58px}
      .dm-pool-ring{right:22%;width:34px;height:34px;border-width:7px}
      .dm-pool-tiles{grid-template-columns:repeat(auto-fit,minmax(104px,1fr));gap:8px}
      .dm-pool-tile{grid-template-columns:1fr;grid-template-rows:auto auto auto;justify-items:center;gap:4px;min-height:96px;padding:12px 8px;text-align:center}
      .dm-pool-tile-icon{grid-row:auto}
      .dm-pool-cards{grid-template-columns:minmax(0,1fr)}
      .dm-pool-filtration-body{grid-template-columns:minmax(0,1fr);justify-items:center;text-align:center}
      .dm-pool-actions{width:100%}
      .dm-lawn{height:clamp(250px,62vw,320px);border-radius:24px}
      .dm-lawn-tree{display:none}
      .dm-zone-tag em{max-width:6em}
      .dm-irr-actions{grid-template-columns:repeat(auto-fit,minmax(112px,1fr))}
      #page-irrigazione #irr-grid{grid-template-columns:repeat(auto-fill,minmax(160px,1fr))!important}
    }

    @media (prefers-reduced-motion:reduce){
      .dm-pool-caustics,.dm-pool-shimmer,.dm-pool-ripple,.dm-pool-bubbles i,.dm-pool-steam i,.dm-pool-ring,
      .dm-lawn-blades i,.dm-zone-fan,.dm-zone-mist,.dm-zone-wet,.dm-zone-spray i,.dm-zone-splashes i{animation:none!important}
      .dm-zone[data-state="on"] .dm-zone-spray i{opacity:.9;transform:translate(0,-3em)}
    }
  `);
}

/* ── il sensore del terreno nel pannello di configurazione ───────────────── */

/* La scheda Irrigazione e' ancora tutta del runtime: le caselle del sensore si
 * aggiungono sotto quella della pioggia — lo stesso giro del contatto
 * dell'infisso — e il salvataggio si aggancia a `edIrrSaveCfg`, che riscrive
 * la configurazione senza sapere di questi campi. */
function activeEditorTab() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

function casellaSoil() {
  const holder = doc.createElement("div");
  holder.dataset.dmIrrSoilFields = "true";
  holder.innerHTML = `<label class="ed-slot dm-irr-soil-slot"><span class="ed-slot-lbl">${t("Sensore umidità terreno", "Soil moisture sensor")}</span>
      <span class="ed-form-row"><input id="ed-irr-soil" class="ed-input mono" autocomplete="off" data-entity-input="true" placeholder="sensor.umidita_terreno"><button type="button" class="dm-entity-picker" data-entity-target="ed-irr-soil" aria-label="${t("Seleziona entità", "Select entity")}">🔍</button></span>
      <small>${t("La % di umidità del terreno compare nella card del programma.", "The soil moisture % appears on the schedule card.")}</small></label>
    <div class="dm-irr-soil-band">
      <label class="ed-slot"><span class="ed-slot-lbl">${t("Umidità ideale min (%)", "Ideal moisture min (%)")}</span><input id="ed-irr-soil-min" class="ed-input" type="number" min="0" max="100" step="1" placeholder="30"></label>
      <label class="ed-slot"><span class="ed-slot-lbl">${t("Umidità ideale max (%)", "Ideal moisture max (%)")}</span><input id="ed-irr-soil-max" class="ed-input" type="number" min="0" max="100" step="1" placeholder="60"></label>
    </div>
    <div class="dm-irr-soil-band">
      <label class="ed-slot"><span class="ed-slot-lbl">${t("Salta il programma se ≥ (%)", "Skip the program if ≥ (%)")}</span><input id="ed-irr-soil-skip" class="ed-input" type="number" min="0" max="100" step="1" placeholder="60"></label>
      <label class="ed-slot"><span class="ed-slot-lbl">${t("Avvia da solo se < (%)", "Start on its own if < (%)")}</span><input id="ed-irr-soil-start" class="ed-input" type="number" min="0" max="100" step="1" placeholder="5"></label>
    </div>
    <small>${t(
      "Col terreno già bagnato il programma delle ore fisse salta (con l'avviso in card); sotto la soglia bassa parte da solo, una volta al giorno.",
      "With the ground already wet the scheduled program skips (with the notice on the card); below the low threshold it starts on its own, once a day.",
    )}</small>`;
  return holder;
}

function ensureSoilFields() {
  if (activeEditorTab() !== "irr") return false;
  const body = doc?.getElementById("ed-body");
  const rain = body?.querySelector?.("#ed-irr-rain");
  if (!body || !rain) return false;
  /* MAI subito dopo l'input nudo: la lente della pioggia vive da fratello
   * successivo del suo campo, e un holder infilato in mezzo la separa per
   * sempre dalla riga (la veste uniforme cerca la lente proprio li'). Se il
   * campo non ha una riga sua, ci si mette dopo la lente. */
  const lente = rain.nextElementSibling?.matches?.(".dm-entity-picker") ? rain.nextElementSibling : null;
  const ancora = rain.closest("label, .ed-slot, .dm-entity-picker-row") || lente || rain;
  let holder = body.querySelector("[data-dm-irr-soil-fields]");
  if (!holder) {
    holder = casellaSoil();
    ancora.after(holder);
    /* La veste della riga entita' si mette qui, nello stesso giro che monta il
     * campo: la passata generale corre per conto suo, e un campo nato dopo di
     * lei resterebbe una casella nuda per qualche frame — l'uniformita' degli
     * editor e' un contratto, non una media. */
    decorateEntityFields(holder);
  } else if (ancora.nextElementSibling !== holder) {
    // Si rimette in fila a ogni giro, come le caselle dell'infisso.
    ancora.after(holder);
  }
  const config = irrigationConfig();
  for (const [id, value] of [
    ["ed-irr-soil", clean(config.soilEnt || config.soil_entity)],
    ["ed-irr-soil-min", num(config.soilMin) ?? ""],
    ["ed-irr-soil-max", num(config.soilMax) ?? ""],
    ["ed-irr-soil-skip", num(config.soilSkipAbove) ?? ""],
    ["ed-irr-soil-start", num(config.soilStartBelow) ?? ""],
  ]) {
    const input = doc.getElementById(id);
    // Mai sotto le dita: il ridisegno non riscrive il campo che si sta usando.
    if (input && doc.activeElement !== input && clean(input.value) !== String(value))
      input.value = String(value);
  }
  return true;
}

const CAMPI_SOIL = Object.freeze([
  ["ed-irr-soil-min", "soilMin"],
  ["ed-irr-soil-max", "soilMax"],
  ["ed-irr-soil-skip", "soilSkipAbove"],
  ["ed-irr-soil-start", "soilStartBelow"],
]);

/* Quello che c'e' scritto nelle nostre caselle, adesso.
 *
 * Si legge PRIMA di lasciar salvare il runtime: `edIrrSaveCfg` finisce con
 * `editorSwitch('irr')`, che rifa' `#ed-body` da capo. Leggendo dopo si
 * leggono caselle nuove di zecca, riempite da `ensureSoilFields` col valore
 * salvato — cioe' quello vecchio — e la modifica appena scritta a mano
 * sparirebbe senza dire niente. */
function leggiSoil() {
  const campo = doc?.getElementById("ed-irr-soil");
  if (!campo) return null;
  const raccolto = { soilEnt: clean(campo.value) };
  for (const [id, field] of CAMPI_SOIL) raccolto[field] = num(doc?.getElementById(id)?.value);
  return raccolto;
}

/* Dopo che il runtime ha riscritto `cd_irrigazione` coi suoi campi, i nostri
 * tornano al loro posto: vuoto vuol dire «niente sensore», mai zero. */
function salvaSoil(raccolto) {
  if (!raccolto) return;
  const stored = readJson("cd_irrigazione", {});
  const next = stored && typeof stored === "object" && !Array.isArray(stored) ? { ...stored } : {};
  if (raccolto.soilEnt) next.soilEnt = raccolto.soilEnt;
  else {
    delete next.soilEnt;
    delete next.soil_entity;
  }
  for (const [, field] of CAMPI_SOIL) {
    const value = raccolto[field];
    if (value == null) delete next[field];
    else next[field] = Math.max(0, Math.min(100, value));
  }
  writeJsonIfChanged("cd_irrigazione", next);
  schedule();
}

/* Non `wrapFunction`: quello corre solo dopo, e dopo le caselle non ci sono
 * piu'. Qui si legge prima, si lascia salvare il runtime, e si riscrive. */
function armaSoilEditor() {
  const originale = root.edIrrSaveCfg;
  if (typeof originale === "function" && !originale.__dmIrrSoilSave) {
    const salvataggio = function (...args) {
      const raccolto = leggiSoil();
      const esito = originale.apply(this, args);
      salvaSoil(raccolto);
      return esito;
    };
    Object.assign(salvataggio, originale);
    salvataggio.__dmIrrSoilSave = true;
    root.edIrrSaveCfg = salvataggio;
  }
  ensureSoilFields();
}

/* ── L'irrigazione guarda il terreno ─────────────────────────────────────
 *
 * «Se il terreno è uguale o sopra una % salta l'irrigazione, se è al di
 * sotto del 5% parte, con degli avvisi.» Il cancello sta sopra
 * `cdIrrProgram`: e' li' che gia' vive lo skip per pioggia, con lo stesso
 * avviso in card (`CD_IRR.skip`). L'override — non `wrapFunction`, che corre
 * DOPO l'originale e non puo' fermarlo — lascia passare il tasto «forza». */
function installProgramGate() {
  const current = root.cdIrrProgram;
  if (typeof current !== "function" || current.__dmIrrSoilGate) return false;
  function gated(force) {
    try {
      if (!force) {
        const config = irrigationConfig();
        const soglia = num(config.soilSkipAbove);
        const soil = soilMoisture(config);
        if (soglia != null && soil.reading != null && soil.reading >= soglia) {
          if (root.CD_IRR)
            root.CD_IRR.skip = `🌱 ${t("Terreno al", "Soil at")} ${Math.round(soil.reading)}% — ${t("programma saltato", "program skipped")}`;
          try {
            root.renderIrrigazione?.();
          } catch (_error) {}
          root.edToast?.(clean(root.CD_IRR?.skip) || t("Programma saltato", "Program skipped"));
          return undefined;
        }
      }
    } catch (_error) {}
    return current.apply(this, arguments);
  }
  gated.__dmIrrSoilGate = true;
  gated.__dmPrevious = current;
  root.cdIrrProgram = gated;
  return true;
}

/* Sotto la soglia bassa il programma parte da solo, una volta al giorno: la
 * chiave e' NOSTRA (`cd_irr_soil_lastrun`), separata da quella delle ore
 * fisse, e si scrive solo quando la sequenza e' partita davvero — cosi' uno
 * skip per pioggia non brucia il giorno. Si valuta a ogni cambio di stato:
 * niente orologi nostri, il sensore detta il passo. */
const SOIL_RUN_KEY = "cd_irr_soil_lastrun";

function valutaTerreno() {
  try {
    const config = irrigationConfig();
    if (!config.enabled || !config.zones.length) return;
    const soglia = num(config.soilStartBelow);
    if (soglia == null) return;
    const soil = soilMoisture(config);
    if (soil.reading == null || soil.reading >= soglia) return;
    if ((root.CD_IRR?.cur ?? -1) >= 0) return;
    const oggi = new Date().toDateString();
    if (root.localStorage?.getItem?.(SOIL_RUN_KEY) === oggi) return;
    root.cdIrrProgram?.(false);
    if ((root.CD_IRR?.cur ?? -1) >= 0) {
      root.localStorage?.setItem?.(SOIL_RUN_KEY, oggi);
      root.edToast?.(
        `🌱 ${t("Terreno al", "Soil at")} ${Math.round(soil.reading)}% — ${t("irrigazione avviata", "watering started")}`,
      );
    }
  } catch (_error) {}
}

export function installPoolIrrigationSceneSection() {
  if (!doc) return;
  installStyles();
  installRenderOwners();
  if (!state.installed) {
    state.installed = true;
    installListeners();
    onEditorRedraw("__dmIrrSoil", () => {
      root.queueMicrotask?.(armaSoilEditor);
    });
    for (const eventName of ["dashboardmodern:legacy-ready", "dashboardmodern:editor-rendered"])
      root.addEventListener?.(eventName, () => {
        root.queueMicrotask?.(armaSoilEditor);
      });
    armaSoilEditor();
    for (const eventName of [
      "dashboardmodern:legacy-ready",
      "dashboardmodern:states-ready",
      "dashboardmodern:state-changed",
    ])
      root.addEventListener?.(eventName, () => {
        installProgramGate();
        valutaTerreno();
      });
    installProgramGate();
  }
  schedule();
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", installPoolIrrigationSceneSection, { once: true });
} else {
  installPoolIrrigationSceneSection();
}
