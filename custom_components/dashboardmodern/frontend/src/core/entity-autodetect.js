/* Auto-detection: what the 🪄 button behind Config actually decides.
 *
 * The vendored `wzAutoDetect` walks every entity of the instance once per slot,
 * and inside that loop it lowercases the id and the name and splits both with a
 * regular expression. With 96 slots and a few thousand entities that is a few
 * hundred thousand string splits on the main thread, which is why the button
 * freezes the page before the reload. It is also the reason it cannot afford to
 * be any smarter than it is.
 *
 * This module inverts the problem. The entity index (`entity-search-index.js`)
 * already folded and tokenized everything once, so here we add a posting list —
 * token to entities — and a slot only ever looks at the entities that share a
 * word with it. A slot label is parsed once into what it is actually asking
 * for: the unit in its parentheses, the device class the unit implies, the
 * domain a word like "Script" or "Interruttore" implies, and the period
 * ("oggi", "mese", "anno") it belongs to. That turns most of the matching into
 * constraints instead of guesses.
 *
 * The other change is how the winners are chosen. The old loop walked slots in
 * declaration order and let each one take the best entity still free, so an
 * early slot with a weak claim could take the entity a later slot matched
 * perfectly. Here every (slot, entity) pair is scored first and the assignment
 * runs over all of them by confidence, so the strongest claim wins wherever it
 * sits in the list — and a slot whose best two candidates are equally plausible
 * is reported as undecided instead of being filled with a coin flip.
 *
 * Pure: no DOM, no storage, no globals. The section around it owns the
 * fetching, the progress and the writing.
 */
import { entityTokens, foldText, tokenize } from "./entity-search-index.js";

/* ── Slot labels ──────────────────────────────────────────────────────────── */

/* The parenthesis at the end of a slot label is the most reliable thing about
 * it: "Produzione solare oggi (kWh)" states the unit, "Modalità ricarica EVCC
 * (select)" states the domain. The old detector only read units, and only
 * through a handful of regular expressions over the whole label. */
const TYPE_HINTS = Object.freeze([
  { match: /^kwh$/i, units: ["kWh", "Wh", "MWh"], dc: ["energy"], domains: ["sensor"] },
  { match: /^w$/i, units: ["W", "kW"], dc: ["power"], domains: ["sensor"] },
  { match: /^%$/, units: ["%"], dc: [], domains: ["sensor"] },
  { match: /^°c$/i, units: ["°C", "°F"], dc: ["temperature"], domains: ["sensor"] },
  { match: /^v$/i, units: ["V"], dc: ["voltage"], domains: ["sensor"] },
  { match: /^a$/i, units: ["A"], dc: ["current"], domains: ["sensor"] },
  { match: /^bar$/i, units: ["bar", "hPa", "psi"], dc: ["pressure"], domains: ["sensor"] },
  { match: /^km$/i, units: ["km", "mi"], dc: ["distance"], domains: ["sensor"] },
  { match: /^ms$/i, units: ["ms"], dc: [], domains: ["sensor"] },
  {
    match: /^mbit\/s$/i,
    units: ["Mbit/s", "Mbps", "MB/s"],
    dc: ["data_rate"],
    domains: ["sensor"],
  },
  { match: /^select$/i, units: [], dc: [], domains: ["select", "input_select"] },
  { match: /^switch/i, units: [], dc: [], domains: ["switch", "input_boolean"] },
  { match: /^binary$/i, units: [], dc: [], domains: ["binary_sensor"] },
  { match: /^cover$/i, units: [], dc: [], domains: ["cover"] },
  { match: /^testo$|^text$/i, units: [], dc: [], domains: ["sensor", "input_text"] },
  { match: /weather/i, units: [], dc: [], domains: ["weather"] },
  { match: /alarm_control_panel/i, units: [], dc: [], domains: ["alarm_control_panel"] },
  { match: /^on\/off-grid$/i, units: [], dc: [], domains: ["sensor", "binary_sensor"] },
]);

/* A leading word can be as strong as the parenthesis: every "Script …" slot
 * wants a script, every "Interruttore …" slot wants something switchable. */
const LEAD_HINTS = Object.freeze([
  { match: /^script\b/i, domains: ["script", "scene", "automation"] },
  { match: /^interruttore\b|^presa\b/i, domains: ["switch", "input_boolean"] },
  { match: /^valvola\b/i, domains: ["cover", "valve", "switch"] },
  { match: /^pompa\b/i, domains: ["switch", "input_boolean", "sensor", "binary_sensor"] },
  { match: /^centrale\s+allarme|^allarme\b/i, domains: ["alarm_control_panel"] },
  { match: /^meteo\b/i, domains: ["weather"] },
]);

const STOP = new Set([
  "di",
  "del",
  "della",
  "delle",
  "dei",
  "dal",
  "dalla",
  "con",
  "per",
  "nel",
  "una",
  "uno",
  "il",
  "lo",
  "la",
  "le",
  "in",
  "da",
  "al",
  "su",
  "un",
  "on",
  "of",
  "to",
  "by",
  "at",
  "and",
  "the",
  "for",
  "entita",
  "entity",
  "sensore",
  "sensor",
  "stato",
  "valore",
  "non",
  "smart",
  "che",
  "solo",
  "dispositivo",
  "manuale",
  "testo",
  "select",
  "switch",
  "binary",
  "cover",
  "weather",
  "text",
]);

/* Italian label, English entity names: without this table the detector only
 * ever finds the entities of an Italian-speaking installation. Each key is a
 * word that appears in a slot label; the values are what the same thing is
 * called in an entity id. */
const SYNONYMS = Object.freeze({
  produzione: [
    "production",
    "yield",
    "generated",
    "generation",
    "pv",
    "solar",
    "fotovoltaico",
    "photovoltaic",
  ],
  solare: ["solar", "pv", "fotovoltaico", "photovoltaic"],
  fotovoltaico: [
    "pv",
    "solar",
    "photovoltaic",
    "solarman",
    "fronius",
    "growatt",
    "solaredge",
    "huawei",
    "goodwe",
    "sungrow",
    "enphase",
    "sma",
    "victron",
  ],
  consumo: ["consumption", "load", "used", "usage", "assorbimento"],
  casa: ["house", "home"],
  prelevata: ["import", "imported", "bought", "purchased", "from_grid", "grid_consumption"],
  prelievo: ["import", "imported", "bought", "purchased", "from_grid"],
  immessa: ["export", "exported", "sold", "returned", "feed_in", "to_grid", "injected"],
  acquistata: ["bought", "import", "imported", "purchased"],
  venduta: ["sold", "export", "exported", "feed_in"],
  rete: ["grid", "mains", "net"],
  scambio: ["grid", "exchange", "external", "net"],
  batteria: [
    "battery",
    "batt",
    "soc",
    "accumulo",
    "storage",
    "bms",
    "pylontech",
    "powerwall",
    "sonnen",
  ],
  caricata: ["charged", "charge", "charging"],
  scaricata: ["discharged", "discharge"],
  usata: ["discharge", "discharged", "used"],
  carica: ["charge", "soc", "charging"],
  potenza: ["power", "watt", "watts", "active_power"],
  energia: ["energy", "kwh"],
  somma: ["sum", "total", "totale"],
  totale: ["total", "lifetime", "cumulative", "overall"],
  temperatura: ["temperature", "temp"],
  umidita: ["humidity", "hum"],
  tensione: ["voltage", "volt"],
  corrente: ["current", "amperage"],
  pressione: ["pressure"],
  inverter: ["inverter"],
  ventola: ["fan", "cooling"],
  boiler: ["boiler", "water_heater", "dhw", "acs", "scaldabagno", "termoaccumulo", "puffer"],
  resistenza: ["resistance", "heater", "element", "heating_element"],
  centralina: ["controller", "control", "regulator"],
  pompa: ["pump", "circulator"],
  sonda: ["probe", "ds18b20", "sonde"],
  delta: ["delta", "diff", "difference"],
  valvola: ["valve"],
  sicurezza: ["safety", "security"],
  clima: [
    "climate",
    "ac",
    "air_conditioner",
    "hvac",
    "condizionatore",
    "split",
    "daikin",
    "melcloud",
    "sensibo",
  ],
  condizionatori: ["climate", "ac", "air_conditioner", "hvac", "condizionatore"],
  cucina: ["kitchen"],
  lavanderia: ["laundry"],
  lavatrice: ["washing", "washer", "washing_machine"],
  centrifuga: ["spin", "spin_speed"],
  programma: ["program", "course", "cycle"],
  fase: ["phase", "cycle", "status"],
  rimanente: ["remaining", "left", "time_remaining"],
  tempo: ["time", "remaining"],
  avvio: ["start", "power", "run"],
  ciclo: ["cycle", "wash"],
  presa: ["plug", "socket", "outlet", "switch"],
  auto: ["car", "vehicle", "ev"],
  autonomia: ["range", "autonomy"],
  odometro: ["odometer", "mileage"],
  ricarica: ["charge", "charging", "charger"],
  wallbox: [
    "wallbox",
    "charger",
    "evse",
    "evcc",
    "ocpp",
    "keba",
    "wattpilot",
    "easee",
    "zappi",
    "goe",
  ],
  evcc: ["evcc", "loadpoint"],
  sessione: ["session", "charged", "charge_session"],
  limite: ["limit", "target", "threshold"],
  target: ["target", "setpoint", "limit"],
  modalita: ["mode", "modo"],
  percentuale: ["percentage", "percent", "pct"],
  km: ["km", "distance", "range", "mileage"],
  ultima: ["last", "latest"],
  cpu: ["cpu", "processor", "processore"],
  ram: ["ram", "memory", "mem"],
  disco: ["disk", "storage", "ssd", "hdd", "use"],
  uptime: ["uptime", "boot", "last_boot"],
  minipc: ["minipc", "nas", "server", "raspberry", "rpi", "proxmox", "synology", "host", "system"],
  server: ["server", "minipc", "nas", "raspberry", "rpi", "proxmox", "synology", "host", "system"],
  raspberry: ["raspberry", "rpi", "pi"],
  internet: ["internet", "wan", "online", "connectivity", "reachable", "ping"],
  ping: ["ping", "latency"],
  raggiungibilita: ["reachable", "reachability", "online", "ping"],
  google: ["google", "dns", "8_8_8_8"],
  speedtest: ["speedtest", "fast_com", "ookla"],
  download: ["download", "down"],
  upload: ["upload", "up"],
  meteo: ["weather", "forecast"],
  allarme: ["alarm", "antifurto", "alarmo", "alarm_control_panel"],
  antifurto: ["alarm", "antifurto", "security"],
  cancello: ["gate", "garage", "portone", "door_opener"],
  apertura: ["open", "opening", "apri"],
  telecamera: ["camera", "cam"],
  luce: ["light", "lamp", "led"],
  stanza: ["room", "area"],
  giornaliera: ["daily", "today", "oggi"],
  oggi: ["daily", "today", "giornalier"],
  mese: ["month", "monthly", "mensile"],
  anno: ["year", "annual", "yearly", "annuale"],
  nodo: ["node", "circuit", "linea"],
  carichi: ["load", "loads", "carico"],
  rapido: ["quick", "rapid", "fast", "express"],
  misto: ["mixed", "misto"],
  colorati: ["color", "colour", "colorati"],
});

/* The table above is written Italian-first because the slot labels are, but the
 * English build asks the same questions in English ("Photovoltaic power (W)").
 * Reading it in both directions costs one pass at load and means one table
 * instead of two that can disagree. */
const EXPANSIONS = (() => {
  const map = new Map();
  const link = (word, group) => {
    const current = map.get(word) || new Set([word]);
    for (const other of group) current.add(other);
    map.set(word, current);
  };
  for (const [key, aliases] of Object.entries(SYNONYMS)) {
    const group = [key, ...aliases];
    for (const word of group) link(word, group);
  }
  return new Map([...map.entries()].map(([word, group]) => [word, [...group].slice(0, 12)]));
})();

export function expandWord(word) {
  return EXPANSIONS.get(word) || [word];
}

const PERIODS = Object.freeze({
  d: ["oggi", "daily", "today", "giornalier", "giornaliera", "day"],
  m: ["mese", "mensile", "month", "monthly"],
  y: ["anno", "annuale", "annual", "year", "yearly"],
});

export function periodOf(text) {
  const folded = foldText(text);
  for (const [period, words] of Object.entries(PERIODS)) {
    if (words.some((word) => folded.includes(word))) return period;
  }
  return "";
}

/** Read one slot label into the constraints it is really expressing. */
export function parseSlotPlan(slot, section = "") {
  const label = String(slot?.lbl || "");
  /* Everything after an em dash is prose for the person configuring, not part
   * of what the slot is asking for. */
  const head = label.split("—")[0];
  const units = new Set();
  const deviceClasses = new Set();
  const domains = new Set();

  for (const raw of head.match(/\(([^)]*)\)/g) || []) {
    const inner = raw.slice(1, -1).trim();
    for (const hint of TYPE_HINTS) {
      if (!hint.match.test(inner)) continue;
      hint.units.forEach((unit) => units.add(unit));
      hint.dc.forEach((dc) => deviceClasses.add(dc));
      hint.domains.forEach((domain) => domains.add(domain));
      break;
    }
  }
  const bare = head.replace(/\([^)]*\)/g, " ").trim();
  for (const hint of LEAD_HINTS) {
    if (hint.match.test(bare)) {
      hint.domains.forEach((domain) => domains.add(domain));
      break;
    }
  }

  /* Two letters and single digits stay: "Temperatura AC inverter" and
   * "Temperatura DC inverter" are the same label without them, and "Sonda
   * temperatura 1" is the same as 2 and 3. Dropping them is what made those
   * slots indistinguishable, and therefore undecidable. */
  const words = tokenize(foldText(bare)).filter(
    (word) => !STOP.has(word) && (word.length >= 2 || /^[0-9]$/.test(word)),
  );
  const keys = words.map((word) => expandWord(word));

  return {
    ref: String(slot?.ref || ""),
    label,
    section,
    keys,
    units: [...units],
    deviceClasses: [...deviceClasses],
    domains: [...domains],
    period: periodOf(bare),
    cumulative: units.has("kWh") && /totale|total|lifetime|anno|annual/i.test(bare),
  };
}

/* ── Posting lists ────────────────────────────────────────────────────────── */

/**
 * token → entities, plus a four-letter prefix bucket so "temperatur" still
 * reaches "temperatura" and "temperature" without scanning the instance.
 */
export function buildPostings(records) {
  const exact = new Map();
  const prefix = new Map();
  records.forEach((record, position) => {
    const seen = new Set();
    for (const token of entityTokens(record)) {
      if (seen.has(token)) continue;
      seen.add(token);
      let list = exact.get(token);
      if (!list) exact.set(token, (list = []));
      list.push(position);
      if (token.length < 4) continue;
      const head = token.slice(0, 4);
      let bucket = prefix.get(head);
      if (!bucket) prefix.set(head, (bucket = []));
      if (bucket[bucket.length - 1] !== position) bucket.push(position);
    }
  });
  return { exact, prefix, size: records.length };
}

/* Candidates are gathered with a stamp array instead of a Set: the same list is
 * rebuilt once per slot, and allocating a Set per slot is the kind of cost this
 * module exists to remove. */
function gatherCandidates(plan, postings, stamps, stamp, out) {
  out.length = 0;
  for (const aliases of plan.keys) {
    for (const alias of aliases) {
      const lists = [postings.exact.get(alias)];
      if (alias.length >= 4) lists.push(postings.prefix.get(alias.slice(0, 4)));
      for (const list of lists) {
        if (!list) continue;
        for (const position of list) {
          if (stamps[position] === stamp) continue;
          stamps[position] = stamp;
          out.push(position);
        }
      }
    }
  }
  return out;
}

/* ── Scoring ──────────────────────────────────────────────────────────────── */

const UNAVAILABLE = new Set(["unavailable", "unknown", "none", ""]);

function tokenMatches(tokens, alias) {
  for (const token of tokens) {
    if (token === alias || (alias.length >= 4 && token.startsWith(alias))) return true;
  }
  return false;
}

/**
 * Score one entity against one slot. `-Infinity` means the entity cannot belong
 * to the slot at all: a wrong domain, or a "mese" sensor under an "oggi" slot.
 */
export function scoreSlotCandidate(record, plan) {
  if (plan.domains.length && !plan.domains.includes(record.domain)) return -Infinity;
  if (plan.period) {
    const entityPeriod = periodOf(record.hay);
    if (entityPeriod && entityPeriod !== plan.period) return -Infinity;
  }

  let score = 0;
  let covered = 0;
  let idHits = 0;
  for (const aliases of plan.keys) {
    let hit = 0;
    for (const alias of aliases) {
      if (tokenMatches(record.idTokens, alias)) {
        hit = 3.2;
        idHits += 1;
        break;
      }
      if (tokenMatches(record.nameTokens, alias)) hit = Math.max(hit, 2);
      else if (record.areaFold && tokenMatches(record.areaTokens, alias)) hit = Math.max(hit, 1.4);
    }
    if (hit > 0) {
      covered += 1;
      score += hit;
    }
  }
  const needed = Math.max(1, Math.ceil(plan.keys.length * 0.6) - (hasNarrowDomain(plan) ? 1 : 0));
  if (covered < needed) return -Infinity;

  if (plan.deviceClasses.length) {
    if (record.dc && plan.deviceClasses.includes(record.dc)) score += 6;
    else if (record.dc) score -= 2.5;
  }
  if (plan.units.length) {
    if (record.unit && plan.units.includes(record.unit)) score += 5;
    else if (record.unit) return -Infinity; /* a slot in kWh is never a sensor in °C */
    else score -= 1.5;
  }
  if (plan.cumulative && (record.sc === "total" || record.sc === "total_increasing")) score += 2.5;
  if (UNAVAILABLE.has(String(record.state).toLowerCase())) score -= 2;
  score -= Math.min(record.id.length, 80) * 0.02;
  return score + idHits * 0.2;
}

/* A stated domain that only a handful of entities in a house can satisfy —
 * `weather`, `script`, `alarm_control_panel`, `select` — is evidence in itself,
 * worth about one word of the label. Without it "Centrale allarme
 * (alarm_control_panel)" rejects the only alarm panel there is, because the
 * entity is called "Antifurto" and so matches one of the label's two words. */
function hasNarrowDomain(plan) {
  return plan.domains.length > 0 && !plan.domains.includes("sensor");
}

function minimumScore(plan) {
  let base = plan.keys.length === 1 ? 3 : Math.max(5, plan.keys.length * 2);
  /* A unit or a device class is evidence the words alone cannot give, so a slot
   * that carries one can accept a slightly thinner word match. */
  if (plan.units.length || plan.deviceClasses.length) base -= 1.5;
  if (hasNarrowDomain(plan)) base -= 2.5;
  /* The floor cannot sit above what a single friendly-name match is worth, or a
   * one-word slot like "Meteo (entità weather)" rejects the only weather entity
   * in the house for being called "Meteo casa" rather than "meteo". */
  return Math.max(1.5, base);
}

/* ── Assignment ───────────────────────────────────────────────────────────── */

const CANDIDATES_PER_SLOT = 4;

/**
 * Propose one entity per slot.
 *
 * Every slot's best few candidates are scored first, then the assignment walks
 * all of them by confidence: the strongest claim on an entity wins no matter
 * where its slot sits in the list. A slot whose two best candidates are within
 * `margin` of each other is left undecided and reported, because filling it
 * with the first of two equally good answers is how a configuration ends up
 * quietly wrong.
 */
export function detectSlots(
  records,
  plans,
  { taken = new Set(), postings = null, margin = 1.2 } = {},
) {
  const lists = postings || buildPostings(records);
  const stamps = new Int32Array(records.length);
  const buffer = [];
  const pairs = [];
  const runnerUp = new Map();
  let stamp = 0;

  for (const plan of plans) {
    if (!plan.keys.length) continue;
    stamp += 1;
    const candidates = gatherCandidates(plan, lists, stamps, stamp, buffer);
    const best = [];
    const floor = minimumScore(plan);
    for (const position of candidates) {
      const record = records[position];
      if (taken.has(record.id)) continue;
      const score = scoreSlotCandidate(record, plan);
      if (score === -Infinity || score < floor) continue;
      best.push({ position, score });
    }
    if (!best.length) continue;
    best.sort(
      (left, right) =>
        right.score - left.score ||
        records[left.position].id.length - records[right.position].id.length,
    );
    runnerUp.set(plan.ref, best.length > 1 ? best[1].score : -Infinity);
    for (const entry of best.slice(0, CANDIDATES_PER_SLOT)) {
      pairs.push({ ref: plan.ref, plan, position: entry.position, score: entry.score });
    }
  }

  pairs.sort(
    (left, right) =>
      right.score - left.score ||
      records[left.position].id.length - records[right.position].id.length ||
      (left.ref < right.ref ? -1 : left.ref > right.ref ? 1 : 0),
  );

  const assignments = [];
  const undecided = [];
  const assigned = new Set();
  const used = new Set(taken);
  const ambiguous = new Set();
  for (const pair of pairs) {
    if (assigned.has(pair.ref) || ambiguous.has(pair.ref)) continue;
    const record = records[pair.position];
    if (used.has(record.id)) continue;
    const second = runnerUp.get(pair.ref);
    if (Number.isFinite(second) && pair.score - second < margin) {
      ambiguous.add(pair.ref);
      undecided.push({
        ref: pair.ref,
        label: pair.plan.label,
        reason: "ambiguous",
        best: record.id,
        score: pair.score,
      });
      continue;
    }
    assigned.add(pair.ref);
    used.add(record.id);
    assignments.push({
      ref: pair.ref,
      label: pair.plan.label,
      section: pair.plan.section,
      id: record.id,
      name: record.name,
      score: Math.round(pair.score * 10) / 10,
    });
  }
  return { assignments, undecided, scanned: pairs.length };
}

/* ── Categories ───────────────────────────────────────────────────────────── */

const TERMO = /termo|radiat|riscald|heat|valve|trv/i;
const OPENING_CLASSES = new Set(["door", "window", "opening", "garage_door"]);

function withArea(name, area) {
  if (!area) return name;
  return foldText(name).includes(foldText(area)) ? name : `${area} - ${name}`;
}

function isTemperature(record) {
  return (
    record.domain === "sensor" &&
    (record.dc === "temperature" || /temperatur/.test(record.idFold)) &&
    (record.unit.includes("°") || record.dc === "temperature")
  );
}

function isHumidity(record) {
  return (
    record.domain === "sensor" &&
    (record.dc === "humidity" || /umidit|humidity/.test(record.idFold))
  );
}

/**
 * The whole-section proposals: lights, rooms, climate units and cameras.
 *
 * Rooms come from the Home Assistant areas first — one room per area, with the
 * temperature sensor that lives there and its humidity twin — and only fall
 * back to reading names when an area has nothing or a sensor has no area. That
 * order was already the intent of the vendored detector, but the registry it
 * needed never arrived in time to be used (its socket closes on the states
 * reply, before the area, device and entity registries come back), so in
 * practice every installation went down the name-guessing path.
 */
export function detectCategories(
  records,
  { maxLights = 300, maxRooms = 24, maxFallbackRooms = 14 } = {},
) {
  const lights = {};
  const climate = [];
  const cameras = [];
  const groups = { win: [], batt: [], luci: [], clima: [], risc: [] };
  const climateNames = new Set();
  const temperatures = [];
  const humidities = [];

  for (const record of records) {
    switch (record.domain) {
      case "light":
        if (Object.keys(lights).length < maxLights)
          lights[record.id] = withArea(record.name, record.area);
        groups.luci.push(record.id);
        break;
      case "camera":
        cameras.push({ name: withArea(record.name, record.area), entity: record.id });
        break;
      case "climate": {
        const heating = TERMO.test(`${record.id} ${record.name}`);
        const stripped = record.name
          .replace(/termosifone|radiator|thermostat|condizionatore|clima/gi, "")
          .trim();
        /* The area is the name the house already uses, properly cased; the
         * stripped entity name is only a fallback, and only it can tell two
         * units in the same room apart. */
        let name = record.area || stripped || record.name;
        if (climateNames.has(foldText(name))) name = stripped || record.name;
        climateNames.add(foldText(name));
        climate.push({ name, entity: record.id, type: heating ? "termo" : "clima" });
        groups[heating ? "risc" : "clima"].push(record.id);
        break;
      }
      case "binary_sensor":
        if (
          (OPENING_CLASSES.has(record.dc) ||
            /finestra|porta|window|door|contact/.test(record.hay)) &&
          !/bypass/.test(record.hay)
        ) {
          groups.win.push(record.id);
        }
        break;
      case "sensor":
        if (record.dc === "battery" && record.unit === "%") groups.batt.push(record.id);
        if (isTemperature(record)) temperatures.push(record);
        else if (isHumidity(record)) humidities.push(record);
        break;
      default:
        break;
    }
  }

  const rooms = [];
  const usedTemperature = new Set();
  const byArea = new Map();
  for (const record of temperatures) {
    if (!record.area || byArea.has(record.area)) continue;
    byArea.set(record.area, record);
  }
  for (const [area, record] of [...byArea.entries()].slice(0, maxRooms)) {
    usedTemperature.add(record.id);
    const twin = humidities.find((humidity) => humidity.area === area);
    const room = { name: area, icon: "🌡️", temp: record.id };
    if (twin) room.hum = twin.id;
    rooms.push(room);
  }

  for (const record of temperatures) {
    if (rooms.length >= Math.max(maxFallbackRooms, byArea.size)) break;
    if (usedTemperature.has(record.id) || record.area) continue;
    const base = record.id.replace(/_?temperatur[ae]?/i, "");
    const twin = humidities.find(
      (humidity) => humidity.id.replace(/_?(umidita|humidity)/i, "") === base,
    );
    const room = {
      name: record.name.replace(/temperatura|temperature|sensore?/gi, "").trim() || record.name,
      icon: "🌡️",
      temp: record.id,
    };
    if (twin) room.hum = twin.id;
    rooms.push(room);
  }

  return { lights, rooms, climate, cameras, groups };
}
