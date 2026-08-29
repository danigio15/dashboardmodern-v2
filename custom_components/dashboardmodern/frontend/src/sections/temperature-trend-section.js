// The Temperature page answers "how is it now". This panel answers "how has it
// been": one chart under the cards, following the room tabs above them. Picking
// a room draws its probes; "all" compares the rooms against each other.
//
// It is drawn as plain SVG from the same history Home Assistant already serves
// to the card popup — no chart library, so it costs nothing to load and scales
// to any width the page happens to have.
import { temperatureEntries } from "./beta25-real-device-fixes-section.js";
import { quandoArrivaLoStorico, serieDi } from "./storico-condiviso-section.js";
import { clean, doc, english, installStyle, locale, root, section, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_TEMPERATURE_TREND__";
const state = (root[KEY] ||= {
  installed: false,
  listeners: false,
  frame: 0,
  hours: 24,
  signature: "",
});

const VIEW = Object.freeze({ width: 720, height: 250, left: 38, right: 54, top: 14, bottom: 24 });

/* The chart is drawn one unit per pixel: a fixed viewBox stretched to the panel
 * width would distort every label and tick with it. */
function viewFor(panel) {
  const plot = panel?.querySelector?.(".dm-trend-plot");
  const width = Math.max(320, Math.round(plot?.clientWidth || VIEW.width));
  /* Il disegno cresce con la pagina.
   *
   * Il pannello si fermava a mille e ventiquattro pixel e il grafico a
   * duecentocinquanta di altezza: su uno schermo largo restava una striscia
   * bassa in mezzo alla sezione, con le linee tutte schiacciate le une sulle
   * altre. Adesso il pannello e' largo quanto tutto il resto e il disegno
   * cresce con lui, cosi' due gradi di differenza si vedono come due gradi. */
  const height = width < 520 ? 210 : width < 900 ? VIEW.height : 320;
  return { ...VIEW, width, height, left: width < 520 ? VIEW.left : 44 };
}
const COMFORT = Object.freeze({ low: 18, high: 26 });
/* Nessuna stanza uguale a un'altra, nemmeno la settima.
 *
 * Le tinte erano sei e le stanze si prendevano il colore col resto della
 * divisione: la settima ripartiva dalla prima. In una casa con sette stanze
 * uscivano due linee dello stesso azzurro — il salone e il bagno piccolo — e
 * nella legenda due pallini identici. Non e' un dettaglio estetico: sono due
 * righe che non si possono distinguere, ed e' meta' del «non si capisce
 * nulla».
 *
 * Cercare dodici tinte tutte diverse a occhio non funziona: oltre la sesta si
 * finisce comunque con due azzurri o due viola che si somigliano. Quindi le
 * tinte restano sei, scelte lontane, e a cambiare e' il tratto: piena, poi
 * tratteggiata, poi punteggiata. Diciotto stanze prima che due linee si
 * assomiglino in tutto e due le cose, e a quel punto c'e' la linguetta della
 * singola stanza. Il tratto si vede anche nella legenda, cosi' il pallino
 * dice la stessa cosa della linea. */
const SERIES_COLOURS = Object.freeze([
  "14,165,233",
  "244,63,94",
  "16,185,129",
  "168,85,247",
  "249,115,22",
  "234,179,8",
]);
const SERIES_STROKES = Object.freeze(["", "7 5", "1.5 4"]);

function vestitoDellaSerie(index) {
  return {
    colour: SERIES_COLOURS[index % SERIES_COLOURS.length],
    stroke: SERIES_STROKES[Math.floor(index / SERIES_COLOURS.length) % SERIES_STROKES.length],
  };
}

function rooms() {
  const values = section("rooms", []);
  return Array.isArray(values) ? values : [];
}

/* The tab strip is the single owner of the room selection, so the panel reads
 * the active tab from the DOM instead of keeping a second copy of that state. */
export function activeRoomId() {
  const active = doc?.querySelector?.(
    "#dm-beta16-temperature-tabs .dm-beta27-temperature-tab.active[data-room-filter]",
  );
  return clean(active?.dataset?.roomFilter) || "all";
}

/* What the chart should draw right now: one series per probe of the selected
 * room, or one per room when the selection is "all". */
export function trendSeriesModel(roomValues = rooms(), roomId = "all") {
  const configured = roomValues.filter((room) => temperatureEntries(room).length > 0);
  if (roomId && roomId !== "all") {
    const room = configured.find((item) => clean(item.id) === roomId);
    if (!room) return { title: "", series: [] };
    return {
      title: clean(room.name) || (t("Stanza", "Room")),
      series: temperatureEntries(room)
        .filter((entry) => clean(entry.temp))
        .map((entry, index) => ({
          id: `${clean(room.id)}::${clean(entry.id) || "primary"}`,
          name:
            clean(entry.name) ||
            clean(room.temp_name) ||
            clean(room.name) ||
            (t("Temperatura", "Temperature")),
          entity: clean(entry.temp),
          ...vestitoDellaSerie(index),
        })),
    };
  }
  return {
    title: t("Tutte le stanze", "All rooms"),
    series: configured
      .map((room, index) => {
        const entry = temperatureEntries(room).find((item) => clean(item.temp));
        if (!entry) return null;
        return {
          id: clean(room.id),
          name: clean(room.name) || (t("Stanza", "Room")),
          entity: clean(entry.temp),
          ...vestitoDellaSerie(index),
        };
      })
      .filter(Boolean),
  };
}

/* Rows in, drawable geometry out. Everything is mapped into a fixed viewBox so
 * the drawing stretches to the card width without recomputing on resize. */
export function trendGeometry(series, window, view = VIEW) {
  const plotWidth = view.width - view.left - view.right;
  const plotHeight = view.height - view.top - view.bottom;
  const drawn = series
    .map((item) => ({
      ...item,
      points: (item.rows || [])
        .map((row) => ({ value: Number.parseFloat(row?.state), time: Number(row?.time) }))
        .filter((point) => Number.isFinite(point.value) && Number.isFinite(point.time))
        .filter((point) => point.time >= window.start && point.time <= window.end)
        .sort((left, right) => left.time - right.time),
    }))
    .filter((item) => item.points.length > 1);
  if (!drawn.length) return null;

  const values = drawn.flatMap((item) => item.points.map((point) => point.value));
  // Scale to the readings, not to the comfort band: a room that spent the day
  // between 26° and 32° deserves the whole height, and the band is then drawn
  // only where it actually reaches into view.
  const low = Math.min(...values);
  const high = Math.max(...values);
  const padding = Math.max(0.4, (high - low) * 0.12);
  const min = low - padding;
  const max = high + padding;
  const span = max - min || 1;
  const x = (time) => view.left + ((time - window.start) / (window.end - window.start)) * plotWidth;
  const y = (value) => view.top + (1 - (value - min) / span) * plotHeight;

  return {
    min,
    max,
    x,
    y,
    plotWidth,
    plotHeight,
    band: (() => {
      const top = Math.max(view.top, y(Math.min(COMFORT.high, max)));
      const bottom = Math.min(view.height - view.bottom, y(Math.max(COMFORT.low, min)));
      const visible = COMFORT.low < max && COMFORT.high > min && bottom - top > 2;
      return { top, bottom, visible };
    })(),
    series: drawn.map((item) => {
      const line = item.points
        .map((point, index) => `${index ? "L" : "M"}${x(point.time).toFixed(1)} ${y(point.value).toFixed(1)}`)
        .join(" ");
      const last = item.points[item.points.length - 1];
      const seriesValues = item.points.map((point) => point.value);
      return {
        ...item,
        line,
        area: `${line} L${x(last.time).toFixed(1)} ${(view.height - view.bottom).toFixed(1)} L${x(item.points[0].time).toFixed(1)} ${(view.height - view.bottom).toFixed(1)} Z`,
        last: { x: x(last.time), y: y(last.value), value: last.value },
        low: Math.min(...seriesValues),
        high: Math.max(...seriesValues),
      };
    }),
  };
}

/* Le righe orizzontali della scala, a numeri tondi.
 *
 * Ce n'erano al massimo due, e solo se 18 o 26 gradi cadevano dentro il
 * disegno. In una giornata d'estate fra 25 e 29 gradi ne restava una sola: si
 * vedevano sette linee che salgono e scendono senza un solo numero accanto a
 * cui misurarle. «Poco leggibile, non si capisce nulla» — e con un riferimento
 * solo e' vero.
 *
 * Adesso la scala si prende un passo tondo — mezzo grado, uno, due, cinque —
 * scelto perche' ne escano fra le quattro e le sette: abbastanza per leggere,
 * poche abbastanza da non diventare una grata. */
/* A che altezza sta il numero in coda a ogni linea, e chi il numero non ce
 * l'ha.
 *
 * Ognuno starebbe all'altezza della sua linea, e in una casa dove le stanze
 * viaggiano tutte fra i 27 e i 28 gradi finivano uno sopra l'altro: cinque
 * numeri impilati in dieci pixel, illeggibili, e per giunta coprivano le linee.
 * Si allontanano quel tanto che basta a starci, partendo dal basso, cosi'
 * l'ordine resta quello delle linee.
 *
 * Se le stanze sono tante lo spazio non basta. Prima le due passate si
 * limitavano a spingere, la seconda ripartiva dall'orlo alto senza piu'
 * guardare quello basso, e gli ultimi numeri finivano sull'asse delle ore o
 * fuori dal disegno, tagliati: sul telefono bastano quattordici stanze. Adesso
 * il passo si stringe fino a dove il numero si legge ancora, e chi non ci sta
 * il numero non ce l'ha — resta la sua linea, col suo colore e il suo tratto, e
 * la legenda che lo dice. Meglio un numero in meno che un numero tagliato.
 *
 * Si tengono quelli piu' distanti fra loro, presi a passo costante lungo
 * l'ordine delle linee: cosi' quello che si legge copre tutta l'altezza del
 * disegno invece di ammucchiarsi da una parte. */
export const ALTEZZA_ETICHETTA = 13;
export const ALTEZZA_MINIMA_ETICHETTA = 9;

export function altezzeDelleCode(altezze, { cima, fondo }) {
  const code = altezze
    .map((y, indice) => ({ indice, y: y + 3.5 }))
    .sort((primo, secondo) => secondo.y - primo.y);
  if (!code.length) return new Map();
  const spazio = Math.max(0, fondo - cima);
  const quanteStanno =
    spazio >= ALTEZZA_MINIMA_ETICHETTA
      ? Math.min(code.length, Math.floor(spazio / ALTEZZA_MINIMA_ETICHETTA) + 1)
      : 1;
  const tenute =
    quanteStanno >= code.length
      ? code
      : Array.from({ length: quanteStanno }, (_niente, posto) =>
          code[Math.round((posto * (code.length - 1)) / (quanteStanno - 1 || 1))],
        );
  const passo =
    tenute.length > 1
      ? Math.max(
          ALTEZZA_MINIMA_ETICHETTA,
          Math.min(ALTEZZA_ETICHETTA, spazio / (tenute.length - 1)),
        )
      : ALTEZZA_ETICHETTA;

  let limite = fondo;
  for (const coda of tenute) {
    coda.y = Math.min(coda.y, limite);
    limite = coda.y - passo;
  }
  // Se il mucchio ha sfondato in alto, si ridiscende dall'orlo superiore — e
  // senza perdere di vista quello basso, che e' il pezzo che mancava.
  let minimo = cima;
  for (const coda of [...tenute].reverse()) {
    coda.y = Math.min(Math.max(coda.y, minimo), fondo);
    minimo = coda.y + passo;
  }
  return new Map(tenute.map((coda) => [coda.indice, coda.y]));
}

export function tacche(min, max) {
  const ampiezza = max - min;
  if (!Number.isFinite(ampiezza) || ampiezza <= 0) return [];
  const passi = [0.5, 1, 2, 5, 10, 20];
  const passo = passi.find((valore) => ampiezza / valore <= 7) || passi[passi.length - 1];
  const valori = [];
  const primo = Math.ceil(min / passo) * passo;
  /* Una riga esattamente sul bordo si confonde con la base del disegno e non
   * aggiunge niente: si parte dalla prima che sta dentro davvero. */
  for (let valore = primo; valore < max - 1e-9; valore += passo) {
    const tondo = Math.round(valore * 10) / 10;
    if (tondo > min + 1e-9) valori.push(tondo);
  }
  return valori;
}

function degrees(value) {
  return `${value.toFixed(1).replace(".", t(",", "."))}°`;
}

/* Lo storico lo chiede il modulo condiviso, non piu' questo.
 *
 * Qui c'erano la domanda a Recorder e la sua cache. Quando anche la finestra
 * di una tessera ha avuto bisogno delle stesse letture, tenerle qui avrebbe
 * voluto dire copiarle di la': due cache che non si parlano, due domande per
 * la stessa entita', e la certezza che prima o poi una delle due scada con una
 * regola diversa. Adesso il padrone e' uno, e quando risponde avvisa: da li'
 * riparte il disegno. */
function rowsFor(entity, hours) {
  return serieDi(entity, hours);
}

function svg(name, attributes = {}) {
  const node = doc.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

function element(tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function hourLabels(window) {
  const labels = [];
  const step = window.hours > 48 ? 24 : 6;
  const first = new Date(window.start);
  first.setMinutes(0, 0, 0);
  for (let time = first.getTime(); time <= window.end; time += step * 60 * 60 * 1000) {
    if (time < window.start) continue;
    const date = new Date(time);
    labels.push({
      time,
      text:
        window.hours > 48
          ? date.toLocaleDateString(locale(), { weekday: "short" })
          : `${String(date.getHours()).padStart(2, "0")}:00`,
    });
  }
  return labels;
}

function ensurePanel() {
  const grid = doc?.getElementById?.("temp-grid");
  if (!grid?.parentElement) return null;
  let panel = doc.getElementById("dm-temperature-trend");
  if (panel) {
    if (panel.previousElementSibling !== grid) grid.after(panel);
    return panel;
  }
  panel = element("section", "dm-trend");
  panel.id = "dm-temperature-trend";
  panel.innerHTML = "";

  const head = element("header", "dm-trend-head");
  const titles = element("div", "dm-trend-titles");
  titles.append(
    element("span", "dm-trend-kicker", t("Andamento", "Trend")),
    element("h3", "dm-trend-title", ""),
  );
  const ranges = element("div", "dm-trend-ranges");
  for (const hours of [24, 168]) {
    const button = element(
      "button",
      "dm-trend-range",
      hours === 24 ? (t("24 h", "24 h")) : t("7 giorni", "7 days"),
    );
    button.type = "button";
    button.dataset.hours = String(hours);
    button.addEventListener("click", () => {
      state.hours = hours;
      state.signature = "";
      schedule();
    });
    ranges.append(button);
  }
  head.append(titles, ranges);

  const plot = element("div", "dm-trend-plot");
  plot.append(
    svg("svg", {
      class: "dm-trend-chart",
      viewBox: `0 0 ${VIEW.width} ${VIEW.height}`,
      role: "img",
    }),
  );
  const legend = element("div", "dm-trend-legend");
  const empty = element(
    "p",
    "dm-trend-empty",
    t("Nessuno storico disponibile per questa stanza.", "No history yet for this room."),
  );
  panel.append(head, plot, legend, empty);
  grid.after(panel);
  return panel;
}

function drawChart(chart, geometry, window, view) {
  chart.replaceChildren();
  const baseline = view.height - view.bottom;

  // Night hours as quiet bands: the shape of a day reads without a legend.
  const night = svg("g", { class: "dm-trend-night" });
  for (let time = window.start; time <= window.end; time += 60 * 60 * 1000) {
    const hour = new Date(time).getHours();
    if (hour >= 7 && hour < 20) continue;
    const from = geometry.x(time);
    const to = geometry.x(Math.min(time + 60 * 60 * 1000, window.end));
    night.append(
      svg("rect", { x: from, y: view.top, width: Math.max(0, to - from), height: geometry.plotHeight }),
    );
  }
  chart.append(night);

  if (geometry.band.visible)
    chart.append(
      svg("rect", {
        class: "dm-trend-band",
        x: view.left,
        y: geometry.band.top,
        width: geometry.plotWidth,
        height: Math.max(0, geometry.band.bottom - geometry.band.top),
        rx: 3,
      }),
    );

  if (geometry.band.visible) {
    const bandLabel = svg("text", {
      class: "dm-trend-band-label",
      x: view.left + 6,
      y: Math.min(geometry.band.bottom - 5, geometry.band.top + 11),
    });
    bandLabel.textContent = "comfort";
    chart.append(bandLabel);
  }

  const axis = svg("g", { class: "dm-trend-axis" });
  for (const value of tacche(geometry.min, geometry.max)) {
    const y = geometry.y(value);
    axis.append(svg("line", { x1: view.left, x2: view.width - view.right, y1: y, y2: y }));
    const label = svg("text", { x: view.left - 7, y: y + 3, class: "dm-trend-tick" });
    label.textContent = `${Number.isInteger(value) ? value : value.toFixed(1).replace(".", t(",", "."))}°`;
    axis.append(label);
  }
  axis.append(
    svg("line", {
      class: "dm-trend-baseline",
      x1: view.left,
      x2: view.width - view.right,
      y1: baseline,
      y2: baseline,
    }),
  );
  for (const mark of hourLabels(window)) {
    const x = geometry.x(mark.time);
    const label = svg("text", { x, y: view.height - 6, class: "dm-trend-time" });
    label.textContent = mark.text;
    axis.append(label);
  }
  chart.append(axis);

  const single = geometry.series.length === 1;
  const altezzaCoda = altezzeDelleCode(
    geometry.series.map((item) => item.last.y),
    { cima: view.top + 4, fondo: view.height - view.bottom - 2 },
  );

  geometry.series.forEach((item, indice) => {
    const group = svg("g", { class: "dm-trend-series", style: `--dm-series:${item.colour}` });
    if (single) group.append(svg("path", { class: "dm-trend-area", d: item.area }));
    group.append(
      svg("path", {
        class: "dm-trend-line",
        d: item.line,
        ...(item.stroke ? { "stroke-dasharray": item.stroke } : {}),
      }),
      svg("circle", { class: "dm-trend-dot", cx: item.last.x, cy: item.last.y, r: 3.4 }),
    );
    // the current reading rides at the end of its own line
    const y = altezzaCoda.get(indice);
    if (y != null) {
      const tag = svg("text", {
        class: "dm-trend-value",
        x: Math.min(item.last.x + 7, view.width - 4),
        y,
      });
      tag.textContent = degrees(item.last.value);
      group.append(tag);
    }
    chart.append(group);
  });
}

function drawLegend(legend, geometry) {
  legend.replaceChildren();
  for (const item of geometry.series) {
    const chip = element("span", "dm-trend-chip");
    chip.style.setProperty("--dm-series", item.colour);
    const pallino = element("i", "dm-trend-swatch");
    // Lo stesso vestito della linea: chi ha il tratteggio lo porta anche qui.
    if (item.stroke) pallino.dataset.dmTratto = item.stroke === "7 5" ? "tratti" : "punti";
    chip.append(
      pallino,
      element("b", "dm-trend-chip-name", item.name),
      element("span", "dm-trend-chip-now", degrees(item.last.value)),
      element("small", "dm-trend-chip-range", `${degrees(item.low)} · ${degrees(item.high)}`),
    );
    legend.append(chip);
  }
}

export function renderTemperatureTrend() {
  const panel = ensurePanel();
  if (!panel) return false;
  const roomId = activeRoomId();
  const model = trendSeriesModel(rooms(), roomId);
  const hours = state.hours;
  panel.querySelectorAll(".dm-trend-range").forEach((button) =>
    button.classList.toggle("active", Number(button.dataset.hours) === hours),
  );
  panel.querySelector(".dm-trend-title").textContent = model.title;

  if (!model.series.length) {
    panel.dataset.state = "empty";
    return false;
  }

  const end = Date.now();
  const window = { start: end - hours * 60 * 60 * 1000, end, hours };
  const withRows = model.series.map((item) => ({ ...item, rows: rowsFor(item.entity, hours) }));
  if (withRows.some((item) => item.rows === null)) panel.dataset.state = "loading";

  const view = viewFor(panel);
  const chart = panel.querySelector(".dm-trend-chart");
  chart.setAttribute("viewBox", `0 0 ${view.width} ${view.height}`);
  chart.style.height = `${view.height}px`;
  const geometry = trendGeometry(
    withRows.filter((item) => Array.isArray(item.rows)),
    window,
    view,
  );
  if (!geometry) {
    panel.dataset.state = panel.dataset.state === "loading" ? "loading" : "empty";
    return false;
  }

  drawChart(chart, geometry, window, view);
  drawLegend(panel.querySelector(".dm-trend-legend"), geometry);
  panel.dataset.state = "ready";
  return true;
}

function schedule() {
  if (state.frame) return;
  state.frame =
    root.requestAnimationFrame?.(() => {
      state.frame = 0;
      renderTemperatureTrend();
    }) || 0;
}

/* The panel lives beside the grid, not inside it: a card rebuild changes
 * nothing it draws. What moves it is the room selection — a tap on the tab
 * strip — plus the runtime events and the history reads themselves, so it needs
 * no observer of its own. ensurePanel() puts it back after the grid if some
 * other layer ever reorders the page. */

function installStyles() {
  installStyle(
    "dm-temperature-trend-style",
    `
    #dm-temperature-trend{--dm-trend-surface:var(--ha-card-background,var(--card-bg,#fff));box-sizing:border-box!important;display:grid!important;gap:12px!important;width:calc(100% - 36px)!important;margin:6px 18px 30px!important;padding:18px 22px 16px!important;border:1px solid var(--card-border,var(--divider-color,#e2e8f0))!important;border-radius:24px!important;background:linear-gradient(180deg,var(--dm-trend-surface),color-mix(in srgb,var(--primary-color,#0ea5e9) 3%,var(--dm-trend-surface)))!important;box-shadow:0 16px 34px -22px rgba(15,23,42,.5)!important}
    #dm-temperature-trend[data-state="empty"] .dm-trend-plot,#dm-temperature-trend[data-state="empty"] .dm-trend-legend,#dm-temperature-trend[data-state="loading"] .dm-trend-plot,#dm-temperature-trend[data-state="loading"] .dm-trend-legend{display:none!important}
    #dm-temperature-trend[data-state="ready"] .dm-trend-empty{display:none!important}
    #dm-temperature-trend .dm-trend-empty{margin:2px 0 4px!important;color:var(--text-dim,#64748b)!important;font-size:12.5px!important;font-weight:750!important}
    #dm-temperature-trend .dm-trend-head{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important;flex-wrap:wrap!important}
    #dm-temperature-trend .dm-trend-titles{display:grid!important;gap:2px!important;min-width:0!important}
    #dm-temperature-trend .dm-trend-kicker{font-size:8.5px!important;font-weight:900!important;letter-spacing:.16em!important;text-transform:uppercase!important;color:var(--primary-color,#0284c7)!important}
    #dm-temperature-trend .dm-trend-title{margin:0!important;font-size:17px!important;font-weight:900!important;letter-spacing:-.3px!important;line-height:1.15!important;color:var(--text,#0f172a)!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
    #dm-temperature-trend .dm-trend-ranges{display:inline-flex!important;gap:4px!important;padding:3px!important;border-radius:999px!important;background:color-mix(in srgb,var(--text-dim,#64748b) 10%,transparent)!important}
    #dm-temperature-trend .dm-trend-range{min-height:30px!important;padding:6px 12px!important;border:0!important;border-radius:999px!important;background:transparent!important;color:var(--text-dim,#64748b)!important;font:inherit!important;font-size:11.5px!important;font-weight:850!important;cursor:pointer!important}
    #dm-temperature-trend .dm-trend-range.active{background:var(--dm-trend-surface)!important;color:var(--text,#0f172a)!important;box-shadow:0 4px 12px -6px rgba(15,23,42,.5)!important}
    #dm-temperature-trend .dm-trend-plot{width:100%!important;min-width:0!important}
    #dm-temperature-trend .dm-trend-chart{display:block!important;width:100%!important;height:250px!important}
    @media(min-width:900px){#dm-temperature-trend .dm-trend-chart{height:320px!important}}
    #dm-temperature-trend .dm-trend-night rect{fill:color-mix(in srgb,var(--text-dim,#64748b) 8%,transparent)!important}
    #dm-temperature-trend .dm-trend-band{fill:color-mix(in srgb,var(--success-color,#10b981) 12%,transparent)!important}
    #dm-temperature-trend .dm-trend-axis line{stroke:color-mix(in srgb,var(--text-dim,#64748b) 24%,transparent)!important;stroke-width:1!important;stroke-dasharray:3 4!important;vector-effect:non-scaling-stroke!important}
    #dm-temperature-trend .dm-trend-axis line.dm-trend-baseline{stroke-dasharray:none!important;stroke:color-mix(in srgb,var(--text-dim,#64748b) 30%,transparent)!important}
    #dm-temperature-trend .dm-trend-tick,#dm-temperature-trend .dm-trend-time{fill:var(--text-dim,#64748b)!important;font-size:11px!important;font-weight:800!important;font-variant-numeric:tabular-nums!important}
    #dm-temperature-trend .dm-trend-tick{text-anchor:end!important}
    #dm-temperature-trend .dm-trend-band-label{fill:var(--success-color,#10b981)!important;font-size:8.5px!important;font-weight:900!important;letter-spacing:.14em!important;text-transform:uppercase!important}
    #dm-temperature-trend .dm-trend-value{fill:rgb(var(--dm-series))!important;font-size:12.5px!important;font-weight:900!important;font-variant-numeric:tabular-nums!important;paint-order:stroke!important;stroke:var(--dm-trend-surface)!important;stroke-width:3.5!important;stroke-linejoin:round!important}
    #dm-temperature-trend .dm-trend-time{text-anchor:middle!important}
    #dm-temperature-trend .dm-trend-area{fill:color-mix(in srgb,rgb(var(--dm-series)) 18%,transparent)!important}
    #dm-temperature-trend .dm-trend-line{fill:none!important;stroke:rgb(var(--dm-series))!important;stroke-width:2.6!important;stroke-linecap:round!important;stroke-linejoin:round!important;vector-effect:non-scaling-stroke!important}
    #dm-temperature-trend .dm-trend-dot{fill:rgb(var(--dm-series))!important;stroke:var(--dm-trend-surface)!important;stroke-width:2!important;vector-effect:non-scaling-stroke!important}
    #dm-temperature-trend .dm-trend-legend{display:flex!important;flex-wrap:wrap!important;gap:8px!important}
    #dm-temperature-trend .dm-trend-chip{display:inline-flex!important;align-items:baseline!important;gap:7px!important;padding:7px 11px!important;border:1px solid color-mix(in srgb,rgb(var(--dm-series)) 26%,transparent)!important;border-radius:13px!important;background:color-mix(in srgb,rgb(var(--dm-series)) 8%,var(--dm-trend-surface))!important}
    #dm-temperature-trend .dm-trend-swatch{width:9px!important;height:9px!important;border-radius:3px!important;background:rgb(var(--dm-series))!important;align-self:center!important}
    /* Il pallino della legenda dice lo stesso della linea: pieno, a tratti,
       a puntini. Senza, due stanze dello stesso colore sarebbero uguali qui
       anche quando nel disegno si distinguono benissimo. */
    #dm-temperature-trend .dm-trend-swatch[data-dm-tratto="tratti"]{background:repeating-linear-gradient(90deg,rgb(var(--dm-series)) 0 3px,transparent 3px 5px)!important}
    #dm-temperature-trend .dm-trend-swatch[data-dm-tratto="punti"]{background:repeating-linear-gradient(90deg,rgb(var(--dm-series)) 0 1.5px,transparent 1.5px 4px)!important}
    #dm-temperature-trend .dm-trend-chip-name{font-size:12px!important;font-weight:850!important;color:var(--text,#0f172a)!important;max-width:150px!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
    #dm-temperature-trend .dm-trend-chip-now{font-size:14px!important;font-weight:900!important;color:rgb(var(--dm-series))!important;font-variant-numeric:tabular-nums!important}
    #dm-temperature-trend .dm-trend-chip-range{font-size:9.5px!important;font-weight:800!important;color:var(--text-dim,#64748b)!important;font-variant-numeric:tabular-nums!important}
    @media(max-width:680px){#dm-temperature-trend{width:calc(100% - 28px)!important;margin:4px 14px 26px!important;padding:14px 14px 12px!important;border-radius:20px!important}#dm-temperature-trend .dm-trend-chart{height:210px!important}#dm-temperature-trend .dm-trend-title{font-size:15.5px!important}}
  `,
  );
}

/* La risposta allo storico arriva quando arriva: da li' si ridisegna. Prima
 * lo faceva la coda della domanda, che stava in questo modulo; adesso la
 * domanda e' del modulo condiviso, e chi vuole saperlo si iscrive. */
export function installTemperatureTrendSection() {
  if (!doc) return false;
  installStyles();
  renderTemperatureTrend();
  if (!state.listeners) {
    state.listeners = true;
    quandoArrivaLoStorico(schedule);
    for (const eventName of [
      "dashboardmodern:legacy-ready",
      "dashboardmodern:runtime-ready",
      "dashboardmodern:states-ready",
      "dashboardmodern:persistence-restored",
    ])
      root.addEventListener?.(eventName, schedule);
    doc.addEventListener(
      "click",
      (event) => {
        if (event.target?.closest?.("#dm-beta16-temperature-tabs,[data-tab='temp'],[data-tab='temperature'],#page-temp"))
          schedule();
      },
      true,
    );
  }
  state.installed = true;
  return true;
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installTemperatureTrendSection, { once: true });
else installTemperatureTrendSection();
