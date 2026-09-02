// DM-FIX-20260817A
/* Pure topology and view-model for the Energy > Flows stage.
 *
 * Beta 22 shipped a dynamic load renderer that was removed again because it
 * duplicated the five fixed bubbles baked into the legacy stage. This module is
 * that idea done properly: the number of load bubbles, their position, their
 * connector geometry and their reading are all *computed* from the canonical
 * Loads section, so eight configured loads produce eight bubbles and two
 * produce two. No DOM access, so the whole contract is unit testable and shared
 * verbatim by the Italian and English dashboards.
 *
 * Coordinates are expressed in the two viewBoxes the legacy stage already uses:
 * 1000x600 for the desktop SVG and 1000x1000 for the mobile one. The Home node
 * is the anchor of every connector, exactly where the hand-authored paths
 * started from, so a stage with the default five loads is pixel-compatible with
 * what shipped before.
 */

import { wattsFromState } from "./signed-energy.js";

export const FLOW_MAX_LOADS = 8;

/* Index -> legacy slot key. Beta 26/27 store per-slot flow-node customization
 * (name, icon, colour, subload group, enabled) under these keys, and Beta 22
 * bound canonical Loads to them in the same order. Keeping the mapping means an
 * existing customization still lands on the same load after this rewrite. */
export const FLOW_SLOT_KEYS = Object.freeze(["boiler", "wb", "clima", "lav", "cuc"]);

/* The first five entries are the legacy bubble colours; the rest extend the
 * palette for loads six to eight, which the fixed topology could never show. */
const FLOW_PALETTE = Object.freeze([
  "#ea580c",
  "#06b6d4",
  "#0ea5e9",
  "#7c3aed",
  "#e11d48",
  "#16a34a",
  "#f59e0b",
  "#6366f1",
]);

const DESKTOP = Object.freeze({
  width: 1000,
  height: 600,
  homeX: 500,
  homeY: 365,
  rowY: [445],
  rowTop: [83],
  perRow: 8,
});

const MOBILE = Object.freeze({
  width: 1000,
  height: 1000,
  homeX: 500,
  homeY: 460,
  rowY: [680, 850],
  rowTop: [68, 85],
  perRow: 4,
});

const INSTANT_THRESHOLD = 0.5;
const ENERGY_THRESHOLD = 0.0005;

const clean = (value) => String(value ?? "").trim();
const clamp01 = (value) => Math.min(1, Math.max(0, value));
const round = (value, digits) => Number(value.toFixed(digits));

function finiteOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

/* Loads that belong on the stage: visible, not a manual report row, and
 * carrying at least one thing worth rendering. Same predicate the fixed slots
 * used, only the cap moved from five to eight. */
export function flowStageLoads(loads = []) {
  return (Array.isArray(loads) ? loads : [])
    .filter(
      (item) =>
        item &&
        item.category !== "manual-report" &&
        item.show_in_dashboard !== false &&
        // An appliance inside a circle is never a circle of its own.
        !clean(item?.metadata?.beta27_subload_group) &&
        (clean(item.name) ||
          clean(item.power_entity) ||
          clean(item.daily_energy_entity) ||
          clean(item.monthly_energy_entity) ||
          clean(item.total_energy_entity) ||
          clean(item.history_entity)),
    )
    .slice()
    .sort((left, right) => (Number(left.order) || 0) - (Number(right.order) || 0))
    .slice(0, FLOW_MAX_LOADS);
}

/* The one entity whose *state* may be read as this period's consumption: an
 * explicit day/month helper, or the live power sensor for the instant view.
 *
 * The lifetime meter is deliberately not a fallback here. Its state is a
 * running total — 4134 kWh since the meter was installed — so rendering it as
 * "this month" would show a number that is wrong by years. Turning a cumulative
 * meter into a period value is the Recorder's job, as a delta between two
 * `sum` samples; see docs/ENERGY_RECORDER_PARITY.md. */
/* Le caselle in cui puo' stare il contatore di un periodo.
 *
 * «Il cerchio del carico elettrodomestici segna 0, non il valore reale
 * giornaliero e mensile»: dentro c'erano apparecchi che nella loro finestra
 * dicevano kilowattora veri. La finestra leggeva `daily`, questa funzione
 * leggeva solo `daily_energy_entity`, e un apparecchio nato dal guscio vecchio
 * ha la prima e non la seconda — quindi il cerchio non trovava niente da
 * sommare e restava a zero mentre la sua stessa finestra contava.
 *
 * E' la stessa disparita' gia' sanata per i watt, dove `campoDiPotenza`
 * guarda cinque nomi: qui i nomi erano rimasti uno. */
const CASELLE_DEL_PERIODO = Object.freeze({
  day: ["daily_energy_entity", "daily"],
  month: ["monthly_energy_entity", "monthly"],
});

export function flowPeriodEntity(load = {}, period = "instant", states = null) {
  if (period !== "day" && period !== "month") return clean(load.power_entity);
  const scritte = [];
  for (const campo of CASELLE_DEL_PERIODO[period]) {
    const id = clean(load?.[campo]);
    /* Solo un vero entity_id: qualche modello storico teneva in `daily` il
     * numero dei kilowattora, e un numero non e' un'entita' da leggere. */
    if (/^[a-z_]+\.[a-z0-9_]+$/i.test(id) && !scritte.includes(id)) scritte.push(id);
  }
  if (!scritte.length || !states) return scritte[0] || "";
  /* Fra piu' caselle scritte vince quella che un numero ce l'ha davvero, come
   * per i watt: chiedere chi risponde invece di indovinare chi dovrebbe. */
  return scritte.find((id) => stateNumber(states, id) !== null) || scritte[0];
}

/* The cumulative meter the Recorder computes a period delta from, and the
 * entity worth opening when the bubble is clicked. */
export function flowRecorderEntity(load = {}) {
  return clean(load.history_entity || load.total_energy_entity);
}

/* How many bubbles fit on one row of a given variant, and which row each index
 * lands on. Desktop keeps the single row the legacy stage had; mobile splits
 * into two so eight bubbles do not collapse into each other on a phone. */
function rowsFor(count, variant) {
  const total = Math.max(0, Math.min(FLOW_MAX_LOADS, count));
  if (!total) return [];
  const maxRows = variant.rowY.length;
  if (total <= variant.perRow || maxRows === 1) return [total];
  const rows = Math.min(maxRows, Math.ceil(total / variant.perRow));
  const base = Math.ceil(total / rows);
  const sizes = [];
  let remaining = total;
  for (let index = 0; index < rows; index += 1) {
    const size = Math.min(base, remaining - (rows - index - 1));
    sizes.push(size);
    remaining -= size;
  }
  return sizes;
}

function connectorPath(variant, x, y) {
  if (Math.abs(x - variant.homeX) < 1) return `M ${variant.homeX} ${variant.homeY} L ${x} ${y}`;
  const controlY = variant === MOBILE ? variant.homeY : Math.round((variant.homeY + y) / 2);
  return `M ${variant.homeX} ${variant.homeY} Q ${x} ${controlY} ${x} ${y}`;
}

/* Positions for `count` bubbles, in one variant. `left`/`top` are stage
 * percentages for the absolutely positioned node, `path` is the connector in
 * that variant's viewBox. */
export function flowStageLayout(count, variant = "desktop") {
  const geometry = variant === "mobile" ? MOBILE : DESKTOP;
  const sizes = rowsFor(count, geometry);
  const positions = [];
  sizes.forEach((size, rowIndex) => {
    for (let column = 0; column < size; column += 1) {
      const x = (geometry.width * (column + 1)) / (size + 1);
      positions.push({
        index: positions.length,
        row: rowIndex,
        left: round((x / geometry.width) * 100, 3),
        top: geometry.rowTop[rowIndex],
        x: round(x, 1),
        y: geometry.rowY[rowIndex],
        path: connectorPath(geometry, round(x, 1), geometry.rowY[rowIndex]),
      });
    }
  });
  return positions;
}

/* Bubbles shrink once the stage carries more than the five it was drawn for,
 * so eight loads stay legible instead of overlapping. */
export function flowNodeScale(count) {
  if (count <= 5) return 1;
  if (count === 6) return 0.92;
  if (count === 7) return 0.86;
  return 0.8;
}

/* Stroke width and dash speed scale with the reading, so a 3 kW wallbox reads
 * as a heavier, faster flow than a 60 W fridge on the same stage. */
export function flowIntensity(value, peak = 0) {
  const magnitude = Math.abs(finiteOrNull(value) ?? 0);
  const reference = Math.max(Math.abs(finiteOrNull(peak) ?? 0), magnitude, Number.EPSILON);
  const ratio = clamp01(magnitude / reference);
  return {
    ratio: round(ratio, 3),
    width: round(2.4 + ratio * 4.4, 2),
    duration: round(1.45 - ratio * 1, 2),
  };
}

export function formatFlowValue(value, period = "instant", locale = "it-IT") {
  const numeric = finiteOrNull(value);
  if (numeric === null) return "—";
  const digits = period === "instant" ? 0 : 1;
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(numeric);
  return `${formatted} ${period === "instant" ? "W" : "kWh"}`;
}

function stateNumber(states, entity) {
  if (!entity) return null;
  const source = states?.[entity];
  return finiteOrNull(source?.state ?? source);
}

/* I watt dell'istantanea li conta chi guarda anche l'unita': la wallbox che
 * scrive «1.61» con unita' kW finiva in bolla come «2 W» — si leggeva lo
 * stato grezzo e basta, mentre il popup dell'auto diceva 1.61 kW. Senza
 * unita' si assume il watt, come fa il runtime. */
function stateWatts(states, entity) {
  if (!entity) return null;
  const source = states?.[entity];
  if (source && typeof source === "object" && source.state !== undefined)
    return finiteOrNull(wattsFromState(source));
  return finiteOrNull(source?.state ?? source);
}

/* Day and month first ask the Recorder bundle, which already holds that
 * period's delta of the cumulative meter — the only correct way to turn a
 * lifetime counter into a period figure. Only an explicit day/month helper is
 * read from state; a load that has nothing but a lifetime meter and no bundle
 * sample reads as absent, because the alternative is printing a running total
 * as today's or this month's consumption. */
/* La potenza di chi non ha la casella canonica.
 *
 * Gli elettrodomestici configurati nel mondo vecchio portano solo
 * `entities: [...]`, senza `power_entity`: il loro popup i watt li trova
 * scandendo le entita' — e' cosi' che «il popup dello stesso elettrodomestico
 * mostra i valori corretti» — ma il cerchio che li somma leggeva solo la
 * casella canonica e restava senza valore. Stessa domanda, stessa risposta:
 * la prima entita' che parla in watt e' la potenza. */
function potenzaImplicita(load, states) {
  /* La lista `entities` e' roba mista — temperature, contatori, interruttori —
   * quindi qui l'unita' e' obbligatoria: si prende la prima che parla in watt
   * (anche «watt»/«watts», spazi tolti). */
  const parlaInWatt = (id) =>
    /^(w|kw|mw|watt|watts)$/.test(
      clean(states?.[id]?.attributes?.unit_of_measurement).toLowerCase().replaceAll(" ", ""),
    );
  for (const grezza of Array.isArray(load?.entities) ? load.entities : []) {
    const id = clean(typeof grezza === "string" ? grezza : grezza?.entity || grezza?.entity_id);
    if (id && parlaInWatt(id)) return id;
  }
  return "";
}

/* Il campo dove sta scritta la potenza, coi nomi di tutte le stagioni.
 *
 * Il popup dei sottocarichi legge `power ?? pwrLive ?? pwr ?? power_entity` e
 * non chiede nessuna unita': un sensore template senza `unit_of_measurement`
 * li' vale watt (come fa il runtime). Il cerchio invece leggeva solo
 * `power_entity` E pretendeva l'unita': gli apparecchi col sensore senza
 * unita' sparivano dalla somma e il cerchio restava sullo zero degli altri —
 * «il flusso elettrodomestici continua a restituire 0 invece della somma
 * riportata nei carichi interni». Un campo scritto apposta ci si fida. */
export function campoDiPotenza(load, states = null) {
  const scritte = [];
  for (const campo of [
    load?.power_entity,
    load?.power,
    load?.pwrLive,
    load?.pwr,
    load?.power_sensor,
  ]) {
    const id = clean(typeof campo === "string" ? campo : campo?.entity || campo?.entity_id);
    /* Solo un vero entity_id: qualche modello storico teneva in `power` il
     * numero dei watt massimi, e un numero non e' un'entita' da leggere. */
    if (/^[a-z_]+\.[a-z0-9_]+$/i.test(id) && !scritte.includes(id)) scritte.push(id);
  }
  if (!scritte.length) return "";
  if (!states) return scritte[0];
  /* Fra piu' caselle scritte vince quella che un numero ce l'ha davvero.
   *
   * L'ordine dei campi era una scommessa: qui si guarda `power_entity` per
   * prima, il popup guardava `power` per prima. Un apparecchio con due
   * caselle — la canonica vuota o ferma, e quella viva del guscio vecchio —
   * faceva dire due numeri diversi alla stessa schermata: «0 W» nel cerchio e
   * «838 W» nella sua finestra. Chiedere chi risponde, invece di indovinare
   * chi dovrebbe, mette d'accordo le due strade senza scegliere un ordine. */
  /* E fra quelle che rispondono vince quella che dice un numero diverso da
   * zero: uno zero e' una risposta valida — la presa spenta — ma quando
   * l'altra casella dice 838, quello zero e' la casella ferma, non
   * l'apparecchio spento. Era proprio il caso segnalato: `power_entity` a zero
   * e `pwrLive` viva. Se rispondono tutte zero, o non risponde nessuna,
   * l'ordine resta quello scritto. */
  const vive = scritte.filter((id) => stateWatts(states, id) !== null);
  return vive.find((id) => stateWatts(states, id) !== 0) || vive[0] || scritte[0];
}

function periodValue(load, period, states, recorderValues, { implicita = true } = {}) {
  const canonica = flowPeriodEntity(load, period, states);
  /* `campoDiPotenza` guarda gia' `power_entity` per prima, quindi provarla a
   * parte non aggiungeva niente: toglieva soltanto la possibilita' di
   * accorgersi che quella casella non risponde e che un'altra si'. */
  const entity =
    period === "instant"
      ? campoDiPotenza(load, states) || (implicita ? potenzaImplicita(load, states) : "")
      : canonica;
  if (period !== "instant" && recorderValues) {
    const key = clean(load.id) || clean(load.name);
    const fromBundle =
      typeof recorderValues.get === "function" ? recorderValues.get(key) : recorderValues[key];
    const numeric = finiteOrNull(fromBundle);
    if (numeric !== null) return { entity: entity || flowRecorderEntity(load), value: numeric };
  }
  return {
    entity,
    value: period === "instant" ? stateWatts(states, entity) : stateNumber(states, entity),
  };
}

/* Everything filed under a circle: the appliances created inside it from the
 * Loads editor, plus the ones assigned to it from the Appliances editor. Both
 * carry the same tag, so an appliance is configured once and the circle, its
 * popup and the report all follow. */
export function subloadsOf(load = {}, loads = [], appliances = []) {
  const group = clean(load?.metadata?.flow_group) || clean(load.id);
  if (!group) return [];
  const tagged = (item) => item && clean(item?.metadata?.beta27_subload_group) === group;
  const own = (Array.isArray(loads) ? loads : []).filter(tagged);
  const known = new Set(own.map((item) => clean(item.id)));
  const fromAppliances = (Array.isArray(appliances) ? appliances : []).filter(
    (item) => tagged(item) && !known.has(clean(item.id)),
  );
  /* Il cerchio puo' essere una STANZA: «flussi raggruppati per stanza,
   * cerchio = stanza col totale». Con `flow_room` sul carico entrano tutti
   * gli elettrodomestici di quella stanza — anche quelli configurati domani,
   * senza altro da fare — tranne chi e' gia' dentro un altro cerchio, che
   * altrimenti verrebbe contato due volte. */
  const stanza = clean(load?.metadata?.flow_room).toLowerCase();
  let fromRoom = [];
  if (stanza) {
    for (const item of [...own, ...fromAppliances]) known.add(clean(item.id));
    fromRoom = (Array.isArray(appliances) ? appliances : []).filter((item) => {
      if (!item || known.has(clean(item.id))) return false;
      const suo = clean(item?.metadata?.beta27_subload_group);
      if (suo && suo !== group) return false;
      return [item.room_id, item.roomId, item.room].some(
        (voce) => clean(voce).toLowerCase() === stanza,
      );
    });
  }
  return [...own, ...fromAppliances, ...fromRoom];
}

/* A circle holding appliances reads as their sum.
 *
 * A load bound to its own sensor keeps using it — a clamp meter on the kitchen
 * line is more accurate than adding up the sockets. Only when the circle has no
 * reading of its own does it become the total of what is inside it, which is
 * what makes a group circle worth having: add an appliance and the circle
 * grows, with nothing else to configure. */
/* Esportata perche' e' la regola del numero, e una prova deve poterla
 * interrogare senza costruire tutta la scena. */
export function readingFor(load, children, period, states, recorderValues) {
  /* La potenza «implicita» — il primo sensore in watt della lista — vale solo
   * per chi non ha figli: il cerchio-gruppo pescava dalla propria lista un
   * sensore a 0 W e la somma degli elettrodomestici dentro non partiva mai
   * («il cerchio dice 0 W, il popup somma 1,45 kW»). Il sensore SUO vero
   * (power_entity, la pinza sulla linea) continua a vincere sulla somma. */
  const own = periodValue(load, period, states, recorderValues, {
    implicita: !children.length,
  });
  /* Uno zero non e' una misura, e' un buco.
   *
   * Il sensore proprio del cerchio vince sulla somma, e finche' misura e'
   * giusto cosi'. Ma quando dice ZERO e dentro ci sono apparecchi che tirano
   * davvero, quello zero non e' la verita': e' una casella che non risponde.
   * E il cerchio si metteva a contraddire la propria finestra sulla stessa
   * schermata — «0 W» fuori, «838 W» dentro. A zero si guarda cosa c'e'
   * dentro; se anche dentro non tira nessuno, zero resta zero.
   *
   * Vale per i watt e basta. Nel Giorno e nel Mese uno zero e' una misura vera
   * — il contatore di stanotte, il carico che oggi non e' partito — e
   * scambiarlo per un buco vorrebbe dire mostrare al posto suo la somma dei
   * figli, cioe' dare per buono un numero che il contatore del gruppo non
   * conferma. */
  const zeroSospetto = period === "instant";
  if (own.value !== null && (own.value !== 0 || !zeroSospetto))
    return { ...own, source: "direct", children: children.length };
  if (!children.length) return { ...own, source: "direct", children: 0 };
  let total = null;
  for (const child of children) {
    const { value } = periodValue(child, period, states, recorderValues);
    if (value === null) continue;
    total = (total ?? 0) + value;
  }
  if (total === null || total === 0) return { ...own, source: "direct", children: children.length };
  return { entity: own.entity, value: total, source: "sum", children: children.length };
}

/* Only values the user actually saved override the canonical Load. The
 * normalized editor model fills every field with a legacy default, so reading
 * that instead would rename "Pompa di calore" back to "Lavanderia". */
function savedOverride(flowNodes, slotKey) {
  if (!slotKey || !flowNodes || typeof flowNodes !== "object") return null;
  const saved = flowNodes[slotKey];
  return saved && typeof saved === "object" ? saved : null;
}

/* Il cerchio della Wallbox e' l'auto.
 *
 * Toccando quel cerchio si apriva lo storico di un sensore di potenza: un
 * grafico che dice quanti kW stanno passando nel cavo. Ma il cavo e' attaccato
 * a una macchina di cui la plancia sa gia' tutto — carica, autonomia, stato
 * della presa — e quella e' la risposta che uno cerca quando tocca la Wallbox.
 *
 * Una Wallbox si riconosce da tre cose, in quest'ordine: il carico dice di
 * esserlo, oppure e' il carico Wallbox che la configurazione conosce, oppure i
 * suoi sensori sono gli stessi che la sezione Auto sta gia' leggendo. Il nome
 * conta per ultimo, e solo perche' chi crea un carico a mano lo chiama cosi'.
 *
 * Chi decide se l'auto c'e' non e' questo modulo: la sezione passa `wallbox`
 * soltanto quando c'e' un veicolo configurato e un popup da aprire. Senza auto
 * il cerchio resta quello di prima, con il suo storico. */
const WALLBOX_NAME = /wallbox|colonnina|ev[ _-]?charger|car[ _-]?charger/i;

export function isWallboxLoad(load = {}, override = null, entities = []) {
  if (clean(load?.metadata?.flow_kind) === "ev") return true;
  if (clean(load.id) === "load-wallbox") return true;
  const known = new Set(entities.map(clean).filter(Boolean));
  if (known.size) {
    for (const value of [
      load.power_entity,
      load.daily_energy_entity,
      load.monthly_energy_entity,
      load.total_energy_entity,
      load.history_entity,
    ]) {
      if (clean(value) && known.has(clean(value))) return true;
    }
  }
  return WALLBOX_NAME.test(clean(override?.name) || clean(load.name));
}

/* A circle holding appliances opens the popup listing them; the group is the
 * circle itself, so there is nothing to bind by hand. Only a circle with none
 * falls back to the history of its own entity. */
function clickTarget(load, override, period, name, children = 0, wallbox = null) {
  if (wallbox && isWallboxLoad(load, override, wallbox.entities)) return { kind: "ev" };
  const group = children
    ? clean(load?.metadata?.flow_group) || clean(load.id)
    : clean(override?.group ?? load?.group);
  if (group)
    return { kind: "subloads", target: period === "instant" ? group : `${group}_${period}` };
  // History reads a series, so there the cumulative meter is the better source.
  const entity = clean(
    period === "instant"
      ? load?.power_entity || flowRecorderEntity(load)
      : flowPeriodEntity(load, period) || flowRecorderEntity(load),
  );
  return entity ? { kind: "history", entity, title: name } : null;
}

/* The whole stage for one period: which bubbles exist, what they read, where
 * they sit and how their connector should animate. The DOM renderer only
 * applies this. */
export function flowStageModel(options = {}) {
  const {
    loads = [],
    appliances = [],
    flowNodes = null,
    states = {},
    period = "instant",
    recorderValues = null,
    locale = "it-IT",
    wallbox = null,
  } = options;

  const eligible = flowStageLoads(loads);
  const visible = [];
  eligible.forEach((load, index) => {
    const slotKey = FLOW_SLOT_KEYS[index] || "";
    const override = savedOverride(flowNodes, slotKey);
    if (override?.enabled === false) return;
    visible.push({ load, slotKey, override, order: index });
  });

  const desktop = flowStageLayout(visible.length, "desktop");
  const mobile = flowStageLayout(visible.length, "mobile");
  const threshold = period === "instant" ? INSTANT_THRESHOLD : ENERGY_THRESHOLD;
  const readings = visible.map(({ load }) =>
    readingFor(load, subloadsOf(load, loads, appliances), period, states, recorderValues),
  );
  const peak = readings.reduce((top, item) => Math.max(top, Math.abs(item.value ?? 0)), 0);

  const nodes = visible.map(({ load, slotKey, override, order }, index) => {
    const name = clean(override?.name) || clean(load.name) || "Carico";
    const { entity, value, source, children } = readings[index];
    const active = value !== null && Math.abs(value) > threshold;
    return {
      id: clean(load.id) || `${slotKey || "flow-load"}-${index}`,
      slotKey,
      order,
      name,
      icon: clean(override?.icon) || clean(load.emoji_icon || load.icon) || "🔌",
      color:
        clean(override?.color) || clean(load.color) || FLOW_PALETTE[index % FLOW_PALETTE.length],
      entity,
      value,
      // `sum` means the circle is the total of the appliances inside it rather
      // than a sensor of its own; the popup and the editor both say so.
      source,
      children,
      text: formatFlowValue(value, period, locale),
      active,
      intensity: flowIntensity(active ? value : 0, peak),
      desktop: desktop[index],
      mobile: mobile[index],
      click: clickTarget(load, override, period, name, children, wallbox),
    };
  });

  return {
    period,
    count: nodes.length,
    scale: flowNodeScale(nodes.length),
    peak: round(peak, 3),
    nodes,
  };
}
