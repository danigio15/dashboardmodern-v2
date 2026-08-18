/* Entity search that stays instant on a real Home Assistant instance.
 *
 * The picker used to rescan the whole entity list on every keystroke, and every
 * scan rebuilt the same throwaway strings: two `toLowerCase()` calls and one
 * concatenation per entity, per character typed. On an installation with a few
 * thousand entities that is tens of thousands of allocations for a single
 * letter, and it showed on a phone as the keyboard running ahead of the list.
 *
 * The fix is to pay that cost once. `buildEntityIndex` folds every id, name and
 * area to a comparable form, tokenizes it, and keeps the result until the
 * entity list itself changes. A search then does one `indexOf` per term over
 * strings that already exist, keeps only the best `limit` rows through a bounded
 * insertion instead of sorting every match, and — because extending a query can
 * only ever shrink its result set — rescans just the previous matches when the
 * user adds a character. Typing therefore gets cheaper the longer the query.
 *
 * The second half is the auto-detection. The field that opened the picker knows
 * a lot about what belongs in it: its slot reference carries a domain, its
 * placeholder and label carry words like "temperatura" or "kWh". `fieldHints`
 * turns that into expected domains, device classes and units, and the scorer
 * pushes the entities that satisfy them to the top — with an empty query too,
 * so opening the picker already proposes the right entity instead of the
 * alphabetically first one.
 *
 * Pure: no DOM, no storage, no globals. The section around it owns rendering.
 */

export const DEFAULT_LIMIT = 60;

const NON_ASCII = /[^\u0000-\u007f]/;
const COMBINING = /[\u0300-\u036f]/g;
const SPLIT = /[^a-z0-9]+/;
const UNAVAILABLE = new Set(["unavailable", "unknown", "none", ""]);

/** Lowercase and strip accents, so "città" and "citta" are the same needle. */
export function foldText(value) {
  const text = String(value ?? "").toLowerCase();
  if (!NON_ASCII.test(text)) return text;
  return text.normalize("NFD").replace(COMBINING, "");
}

export function tokenize(folded) {
  return String(folded ?? "")
    .split(SPLIT)
    .filter((token) => token.length > 0);
}

function initialsOf(tokens) {
  let initials = "";
  for (const token of tokens) initials += token[0];
  return initials;
}

/* Accepts both shapes the runtime has: the wizard metadata
 * ({id, name, dc, unit, sc, area, state}) and a raw Home Assistant state
 * object, so the index can be built from whichever list is warm first. */
export function normalizeEntry(raw) {
  if (!raw) return null;
  const id = String(raw.id || raw.entity_id || "").trim();
  if (!id || !id.includes(".")) return null;
  const attributes = raw.attributes || {};
  const dot = id.indexOf(".");
  const domain = id.slice(0, dot);
  const object = id.slice(dot + 1);
  const name = String(raw.name || attributes.friendly_name || id).trim() || id;
  const area = String(raw.area || attributes.area || "").trim();
  const idFold = foldText(id);
  const nameFold = foldText(name);
  const areaFold = area ? foldText(area) : "";
  const hay = `${idFold} ${nameFold} ${areaFold}`;
  const tokens = tokenize(hay);
  const state = String(raw.state ?? "");
  /* Both parts of the constant penalty are query-independent: an entity that is
   * currently unavailable is rarely the one being configured, and between two
   * equally good matches the shorter id is the more specific one. */
  const penalty = (UNAVAILABLE.has(state.toLowerCase()) ? -80 : 0) - Math.min(id.length, 80) * 0.25;
  return {
    id,
    name,
    domain,
    object,
    dc: String(raw.dc || attributes.device_class || "").toLowerCase(),
    unit: String(raw.unit || attributes.unit_of_measurement || ""),
    sc: String(raw.sc || attributes.state_class || "").toLowerCase(),
    area,
    state,
    penalty,
    idFold,
    objectFold: foldText(object),
    nameFold,
    areaFold,
    unitFold: foldText(raw.unit || attributes.unit_of_measurement || ""),
    hay,
    tokens,
    initials: initialsOf(tokenize(nameFold)),
  };
}

const INDEX_CACHE = new WeakMap();

function signatureOf(entries) {
  const first = entries[0];
  const last = entries[entries.length - 1];
  const firstId = first ? first.id || first.entity_id : "";
  const lastId = last ? last.id || last.entity_id : "";
  return `${entries.length}|${firstId}|${lastId}`;
}

/**
 * Build (or reuse) the searchable index for an entity list.
 *
 * `enrich` may return extra metadata for an id — device class, unit, area —
 * when the warm list only carries ids and names. It is consulted once per
 * entity at build time, never during a search.
 */
export function buildEntityIndex(entries, { enrich = null, version = "" } = {}) {
  const list = Array.isArray(entries) ? entries : [];
  const signature = `${signatureOf(list)}|${version}`;
  const cached = INDEX_CACHE.get(list);
  if (cached && cached.signature === signature) return cached;

  const records = [];
  const domains = new Map();
  const domainList = [];
  for (const entry of list) {
    const extra = enrich ? enrich(entry?.id || entry?.entity_id, entry) : null;
    const record = normalizeEntry(extra ? { ...entry, ...extra } : entry);
    if (!record) continue;
    let slot = domains.get(record.domain);
    if (slot === undefined) {
      slot = domainList.length;
      domainList.push({ domain: record.domain, count: 0 });
      domains.set(record.domain, slot);
    }
    domainList[slot].count += 1;
    /* Counting the domains of a match set is a per-keystroke pass, so a record
     * carries the slot its domain occupies and the count becomes an integer
     * increment instead of a hash lookup. */
    record.domainSlot = slot;
    records.push(record);
  }
  const index = {
    records,
    size: records.length,
    domainList,
    domainSlots: domains,
    signature,
    buffer: new Int32Array(records.length),
    counts: new Int32Array(domainList.length),
  };
  INDEX_CACHE.set(list, index);
  return index;
}

/* ── Query planning ───────────────────────────────────────────────────────── */

export function parseQuery(query) {
  const folded = foldText(query).trim().replace(/\s+/g, " ");
  const terms = folded ? folded.split(" ").filter(Boolean) : [];
  return { folded, terms, empty: terms.length === 0 };
}

export function createSearchSession() {
  return { signature: "", query: "", matches: null, count: 0, poolA: null, poolB: null };
}

/* Two buffers, used alternately: a pass reads the previous match list while it
 * writes the next one, and neither is reallocated between keystrokes. */
function nextBuffer(session, size) {
  if (!session.poolA || session.poolA.length < size) {
    session.poolA = new Int32Array(size);
    session.poolB = new Int32Array(size);
  }
  return session.matches === session.poolA ? session.poolB : session.poolA;
}

/* ── Field auto-detection ─────────────────────────────────────────────────── */

/* Words a configuration field uses, mapped to what an entity must look like to
 * belong in it. Kept deliberately small: every entry here has to earn its place
 * by describing a field that actually exists in the editor. */
const HINT_RULES = Object.freeze([
  {
    words: ["temperatura", "temperature", "temp", "termometro", "sonda"],
    dc: ["temperature"],
    units: ["°C", "°F"],
    domains: ["sensor"],
  },
  { words: ["umidita", "humidity", "hum"], dc: ["humidity"], units: ["%"], domains: ["sensor"] },
  {
    words: ["potenza", "power", "watt", "istantanea", "istantaneo", "assorbimento"],
    dc: ["power"],
    units: ["W", "kW"],
    domains: ["sensor"],
  },
  {
    words: [
      "energia",
      "energy",
      "kwh",
      "consumo",
      "consumi",
      "produzione",
      "prelievo",
      "immissione",
      "prelevata",
      "immessa",
      "acquistata",
      "venduta",
      "giornaliera",
      "mensile",
      "annuale",
    ],
    dc: ["energy"],
    units: ["kWh", "Wh", "MWh"],
    domains: ["sensor"],
  },
  {
    words: ["batteria", "battery", "soc", "carica", "accumulo"],
    dc: ["battery"],
    units: ["%"],
    domains: ["sensor"],
  },
  { words: ["tensione", "voltage", "volt"], dc: ["voltage"], units: ["V"], domains: ["sensor"] },
  { words: ["corrente", "current", "ampere"], dc: ["current"], units: ["A"], domains: ["sensor"] },
  {
    words: ["pressione", "pressure"],
    dc: ["pressure", "atmospheric_pressure"],
    units: ["bar", "hPa", "psi"],
    domains: ["sensor"],
  },
  {
    words: ["illuminamento", "illuminance", "lux", "luminosita"],
    dc: ["illuminance"],
    units: ["lx"],
    domains: ["sensor"],
  },
  {
    words: ["pioggia", "rain", "precipitazioni"],
    dc: ["precipitation", "precipitation_intensity"],
    units: ["mm"],
    domains: ["sensor"],
  },
  { words: ["vento", "wind"], dc: ["wind_speed"], units: ["km/h", "m/s"], domains: ["sensor"] },
  { words: ["acqua", "water", "portata"], dc: ["water"], units: ["L", "m³"], domains: ["sensor"] },
  { words: ["gas", "metano"], dc: ["gas"], units: ["m³"], domains: ["sensor"] },
  {
    words: ["prezzo", "price", "costo", "tariffa"],
    dc: ["monetary"],
    units: ["€", "EUR", "€/kWh"],
    domains: ["sensor"],
  },
  {
    /* A light field accepts a relay too: a lamp behind a `switch.` is
     * configured in the Luci tab exactly like a `light.`, so the picker has to
     * propose both or the switch never gets suggested for the field that wants
     * it. */
    words: ["luce", "luci", "light", "lampada", "lampadario", "faretti", "led"],
    dc: [],
    units: [],
    domains: ["light", "switch"],
  },
  {
    words: [
      "clima",
      "climate",
      "condizionatore",
      "termostato",
      "termosifone",
      "riscaldamento",
      "hvac",
      "split",
    ],
    dc: [],
    units: [],
    domains: ["climate"],
  },
  { words: ["telecamera", "camera", "videocamera", "cam"], dc: [], units: [], domains: ["camera"] },
  {
    words: [
      "tapparella",
      "tapparelle",
      "serranda",
      "serrande",
      "cover",
      "shutter",
      "blind",
      "tenda",
    ],
    dc: [],
    units: [],
    domains: ["cover"],
  },
  {
    words: ["presa", "plug", "socket", "interruttore", "switch", "relay", "rele"],
    dc: [],
    units: [],
    domains: ["switch", "input_boolean"],
  },
  {
    words: ["porta", "door", "finestra", "window", "contatto", "apertura"],
    dc: ["door", "window", "opening", "garage_door"],
    units: [],
    domains: ["binary_sensor"],
  },
  {
    words: ["movimento", "motion", "presenza", "presence", "occupancy", "pir"],
    dc: ["motion", "occupancy", "presence"],
    units: [],
    domains: ["binary_sensor"],
  },
  {
    words: ["allagamento", "leak", "perdita"],
    dc: ["moisture"],
    units: [],
    domains: ["binary_sensor"],
  },
  { words: ["fumo", "smoke"], dc: ["smoke"], units: [], domains: ["binary_sensor"] },
  { words: ["meteo", "weather", "previsioni"], dc: [], units: [], domains: ["weather"] },
  { words: ["scena", "scene"], dc: [], units: [], domains: ["scene"] },
  { words: ["script", "azione"], dc: [], units: [], domains: ["script"] },
  { words: ["automazione", "automation"], dc: [], units: [], domains: ["automation"] },
  { words: ["allarme", "alarm", "antifurto"], dc: [], units: [], domains: ["alarm_control_panel"] },
  {
    words: ["pompa", "pump", "irrigazione", "irrigation", "valvola", "valve", "elettrovalvola"],
    dc: [],
    units: [],
    domains: ["switch", "valve"],
  },
  { words: ["ventilatore", "fan", "ventola", "aspiratore"], dc: [], units: [], domains: ["fan"] },
  {
    words: ["serratura", "lock", "cancello", "gate", "garage"],
    dc: ["garage", "door"],
    units: [],
    domains: ["lock", "cover"],
  },
]);

const HINT_STOP = new Set([
  "entita",
  "entity",
  "id",
  "sensore",
  "sensor",
  "seleziona",
  "scegli",
  "campo",
  "opzionale",
  "oppure",
  "esempio",
  "the",
  "and",
  "for",
  "del",
  "della",
  "delle",
  "dei",
  "con",
  "per",
  "nel",
  "una",
  "uno",
  "che",
  "lo",
  "la",
  "il",
  "di",
  "da",
]);

const KNOWN_DOMAINS = new Set([
  "sensor",
  "binary_sensor",
  "switch",
  "light",
  "cover",
  "climate",
  "camera",
  "weather",
  "automation",
  "script",
  "scene",
  "select",
  "number",
  "fan",
  "lock",
  "vacuum",
  "media_player",
  "water_heater",
  "valve",
  "button",
  "person",
  "device_tracker",
  "alarm_control_panel",
  "sun",
  "input_boolean",
  "input_number",
  "input_select",
  "input_text",
  "input_datetime",
  "counter",
  "humidifier",
]);

function collectDomains(text, into) {
  const matcher = /\b([a-z_]+)\./g;
  let match;
  while ((match = matcher.exec(text))) {
    if (KNOWN_DOMAINS.has(match[1])) into.add(match[1]);
  }
}

/**
 * Read what a configuration field expects from the way it is described.
 *
 * `descriptor` collects everything the DOM already knows about the field: its
 * slot reference, id, placeholder, visible label, current value and any
 * `data-domain`. Nothing here touches the DOM — the caller gathers the strings.
 */
export function fieldHints(descriptor = {}) {
  const ref = String(descriptor.ref || "").trim();
  const value = String(descriptor.value || "").trim();
  const domains = new Set();
  const deviceClasses = new Set();
  const units = new Set();
  const keywords = [];

  for (const domain of String(descriptor.domain || "").split(/[,\s]+/)) {
    if (KNOWN_DOMAINS.has(domain)) domains.add(domain);
  }
  const text = foldText(
    [ref, descriptor.id, descriptor.placeholder, descriptor.label, value].filter(Boolean).join(" "),
  );
  collectDomains(text, domains);

  const unitMatch = /\((w|kw|wh|kwh|mwh|v|a|%|°c|°f|bar|lx|mm|m3|km\/h|m\/s)\)/i.exec(text);
  if (unitMatch) {
    const unit = unitMatch[1].toLowerCase();
    const canonical = {
      w: "W",
      kw: "kW",
      wh: "Wh",
      kwh: "kWh",
      mwh: "MWh",
      v: "V",
      a: "A",
      "%": "%",
      "°c": "°C",
      "°f": "°F",
      bar: "bar",
      lx: "lx",
      mm: "mm",
      m3: "m³",
      "km/h": "km/h",
      "m/s": "m/s",
    }[unit];
    if (canonical) units.add(canonical);
  }

  const words = tokenize(text).filter(
    (word) => word.length >= 3 && !HINT_STOP.has(word) && !KNOWN_DOMAINS.has(word),
  );
  for (const rule of HINT_RULES) {
    if (
      !rule.words.some((word) =>
        words.some(
          (candidate) => candidate === word || (word.length >= 4 && candidate.startsWith(word)),
        ),
      )
    )
      continue;
    for (const domain of rule.domains) domains.add(domain);
    for (const dc of rule.dc) deviceClasses.add(dc);
    for (const unit of rule.units) units.add(unit);
  }
  for (const word of words) {
    if (keywords.length >= 6) break;
    if (!keywords.includes(word)) keywords.push(word);
  }

  const area = foldText(descriptor.area || "");
  return {
    domains,
    deviceClasses,
    units,
    keywords,
    area,
    current: value.includes(".") ? value : "",
    empty:
      domains.size === 0 && deviceClasses.size === 0 && units.size === 0 && keywords.length === 0,
  };
}

/* ── Scoring ──────────────────────────────────────────────────────────────── */

/* `strong` is what earns the suggested badge: belonging to the expected domain
 * is a weak signal on its own — most of an instance is `sensor.` — while the
 * device class, the unit, the area or one of the field's own words is evidence
 * that this entity is the one the field is asking for. */
function hintDetail(record, hints) {
  if (!hints || hints.empty) return { score: 0, strong: false };
  let score = 0;
  let strong = false;
  if (hints.domains.size) score += hints.domains.has(record.domain) ? 150 : -35;
  if (hints.deviceClasses.size && record.dc && hints.deviceClasses.has(record.dc)) {
    score += 110;
    strong = true;
  }
  if (hints.units.size && record.unit) {
    if (hints.units.has(record.unit)) {
      score += 70;
      strong = true;
    } else score -= 20;
  }
  if (hints.area && record.areaFold && record.areaFold === hints.area) {
    score += 45;
    strong = true;
  }
  let matched = 0;
  for (const keyword of hints.keywords) {
    if (matched >= 3) break;
    for (const token of record.tokens) {
      if (token === keyword || (keyword.length >= 4 && token.startsWith(keyword))) {
        score += 28;
        matched += 1;
        strong = true;
        break;
      }
    }
  }
  /* A field that knows its domain cannot be satisfied by another one: a light
   * whose name happens to contain the room word is not a temperature sensor,
   * and badging it as suggested would make the badge mean nothing. */
  if (strong && hints.domains.size && !hints.domains.has(record.domain)) strong = false;
  return { score, strong };
}

function hintScore(record, hints) {
  return hintDetail(record, hints).score;
}

/* The first thing a term does is reject, thousands of times per keystroke, so
 * rejection has to cost exactly one `indexOf` over a string that already
 * exists. Only a record that survives it pays for the ranking detail below. */
function termScore(record, term) {
  if (record.hay.indexOf(term) < 0) {
    return term.length >= 2 && record.initials.indexOf(term) >= 0 ? 18 : -1;
  }
  if (record.idFold.startsWith(term)) return 100;
  if (record.objectFold.startsWith(term)) return 92;
  if (record.nameFold.startsWith(term)) return 88;
  for (const token of record.tokens) {
    if (token.startsWith(term)) return 70;
  }
  const inId = record.idFold.indexOf(term) >= 0;
  if (inId) return 40;
  if (record.nameFold.indexOf(term) >= 0) return 34;
  if (record.areaFold && record.areaFold.indexOf(term) >= 0) return 26;
  if (term.length >= 2 && record.initials.indexOf(term) >= 0) return 18;
  return -1;
}

/**
 * Score one record against a parsed query, ignoring the field hints. Returns
 * `-Infinity` when a term does not match at all: matching and ranking are the
 * same single pass over the record's precomputed strings.
 */
export function queryScore(record, plan) {
  let score = record.penalty;
  for (const term of plan.terms) {
    const value = termScore(record, term);
    if (value < 0) return -Infinity;
    score += value;
  }
  if (plan.terms.length > 1 && record.idFold.indexOf(plan.folded) >= 0) score += 30;
  if (plan.folded && record.idFold === plan.folded) score += 400;
  return score;
}

/** Full score, hints included. The hot loop uses the precomputed hint table. */
export function scoreRecord(record, plan, hints = null) {
  const base = queryScore(record, plan);
  if (base === -Infinity) return base;
  return (
    base +
    hintDetail(record, hints).score +
    (hints?.current && record.id === hints.current ? 220 : 0)
  );
}

/* The hint part of a score does not depend on the query, so it is computed once
 * per (index, field) pair when the picker opens and read back as an array
 * lookup while the user types. Without this, every keystroke would re-walk the
 * field's keywords against every entity's tokens. */
const HINT_TABLES = new WeakMap();

export function prepareHints(index, hints) {
  if (!index || !hints || hints.empty) return null;
  let perIndex = HINT_TABLES.get(hints);
  if (!perIndex) {
    perIndex = new WeakMap();
    HINT_TABLES.set(hints, perIndex);
  }
  const cached = perIndex.get(index);
  if (cached && cached.signature === index.signature) return cached;
  const scores = new Float32Array(index.size);
  const strong = new Uint8Array(index.size);
  for (let position = 0; position < index.size; position += 1) {
    const record = index.records[position];
    const detail = hintDetail(record, hints);
    scores[position] = detail.score + (hints.current && record.id === hints.current ? 220 : 0);
    strong[position] = detail.strong ? 1 : 0;
  }
  const table = { scores, strong, signature: index.signature };
  perIndex.set(index, table);
  return table;
}

/* Bounded top-K: keeping only `limit` rows costs one comparison per match in
 * the common case, where sorting every match costs an allocation per match and
 * an O(n log n) pass. With 4000 matching entities and 60 visible rows that is
 * the difference between a visible hitch and nothing at all. */
function pushTop(top, limit, entry) {
  const full = top.length >= limit;
  /* The comparison is the full ranking, not the score alone: a page boundary
   * that fell inside a group of equal scores would otherwise be resolved by
   * scan order, and the next page — ranked over a different cut — would repeat
   * some rows and lose others. */
  if (full && byRank(entry, top[limit - 1]) >= 0) return;
  let position = full ? limit - 1 : top.length;
  if (!full) top.push(entry);
  while (position > 0 && byRank(entry, top[position - 1]) < 0) {
    top[position] = top[position - 1];
    position -= 1;
  }
  top[position] = entry;
}

/* Ties are broken by shorter id then alphabetically, so the same query always
 * produces the same order — a picker that reshuffles under the finger is worse
 * than a slow one. */
function byRank(left, right) {
  return (
    right.score - left.score ||
    left.record.id.length - right.record.id.length ||
    (left.record.id < right.record.id ? -1 : left.record.id > right.record.id ? 1 : 0)
  );
}

/* The badge itself is only needed on the rows that are actually drawn, so this
 * runs on the page; the match set's own count comes from the hint table. */
function annotateHints(rows, hints, table = null) {
  let hinted = 0;
  const active = Boolean(hints && !hints.empty);
  for (const row of rows) {
    row.hinted =
      active &&
      (table && row.position !== undefined
        ? table.strong[row.position] === 1
        : hintDetail(row.record, hints).strong);
    if (row.hinted) hinted += 1;
  }
  return hinted;
}

/**
 * Search the index.
 *
 * `session` (from `createSearchSession`) makes consecutive keystrokes cheap:
 * extending a query can only shrink its match set, so the next pass rescans the
 * previous matches instead of the whole instance. `scanned` reports how many
 * records the pass actually looked at.
 */
export function searchEntityIndex(index, query, options = {}) {
  const {
    limit = DEFAULT_LIMIT,
    domain = "",
    hints = null,
    session = null,
    withDomains = false,
    hintedOnly = false,
  } = options;
  const records = index?.records || [];
  const plan = parseQuery(query);
  const total = records.length;

  const reusable =
    session &&
    session.matches &&
    session.signature === index.signature &&
    session.query &&
    plan.folded.startsWith(session.query);
  const source = reusable ? session.matches : null;
  const sourceCount = reusable ? session.count : total;

  if (!index.buffer || index.buffer.length < total) index.buffer = new Int32Array(total);
  const nextMatches = session ? nextBuffer(session, total) : index.buffer;
  const hintTable = prepareHints(index, hints);
  const hintScores = hintTable?.scores || null;
  const top = [];
  let matched = 0;
  let visible = 0;
  let hinted = 0;

  for (let cursor = 0; cursor < sourceCount; cursor += 1) {
    const position = source ? source[cursor] : cursor;
    const record = records[position];
    const base = queryScore(record, plan);
    if (base === -Infinity) continue;
    nextMatches[matched] = position;
    matched += 1;
    const strong = hintTable ? hintTable.strong[position] === 1 : false;
    if (strong) hinted += 1;
    if (domain && record.domain !== domain) continue;
    /* `matched` stays the full text match set even when a filter is on: it is
     * what the next keystroke narrows from, and dropping rows here would make
     * the filter permanent. */
    if (hintedOnly && !strong) continue;
    visible += 1;
    pushTop(top, limit, {
      record,
      score: hintScores ? base + hintScores[position] : base,
      position,
    });
  }

  if (session) {
    session.matches = nextMatches;
    session.count = matched;
    session.query = plan.folded;
    session.signature = index.signature;
  }

  top.sort(byRank);
  annotateHints(top, hints, hintTable);

  let domainCounts = null;
  if (withDomains) {
    const counts = index.counts;
    counts.fill(0);
    for (let cursor = 0; cursor < matched; cursor += 1)
      counts[records[nextMatches[cursor]].domainSlot] += 1;
    domainCounts = new Map();
    for (let slot = 0; slot < index.domainList.length; slot += 1) {
      if (counts[slot] > 0) domainCounts.set(index.domainList[slot].domain, counts[slot]);
    }
  }

  return {
    rows: top,
    matched,
    filtered: visible,
    hinted,
    scanned: sourceCount,
    total,
    truncated: matched > top.length,
    domains: domainCounts,
    plan,
  };
}

/**
 * Rows for a match set beyond the first page, used by the picker when the user
 * scrolls. The ordering matches `searchEntityIndex`, so paging never repeats or
 * skips a row.
 */
export function rankMatches(
  index,
  session,
  {
    offset = 0,
    limit = DEFAULT_LIMIT,
    domain = "",
    hints = null,
    query = "",
    hintedOnly = false,
  } = {},
) {
  const plan = parseQuery(query);
  const wanted = offset + limit;
  const table = prepareHints(index, hints);
  const top = [];
  for (let cursor = 0; cursor < session.count; cursor += 1) {
    const position = session.matches[cursor];
    const record = index.records[position];
    if (domain && record.domain !== domain) continue;
    if (hintedOnly && table?.strong[position] !== 1) continue;
    const base = queryScore(record, plan);
    pushTop(top, wanted, { record, position, score: table ? base + table.scores[position] : base });
  }
  top.sort(byRank);
  const page = top.slice(offset, wanted);
  annotateHints(page, hints, table);
  return page;
}
