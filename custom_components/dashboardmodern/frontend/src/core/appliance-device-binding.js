/* L'elettrodomestico che arriva da un'integrazione.
 *
 * «Ho una lavatrice Hoover, uso l'integrazione hOn da HACS, e mi espone tutti
 * i dati: dalla sezione voglio prendere le integrazioni, cosi' ogni
 * elettrodomestico avra' sicuramente tutte le sue informazioni.» La scheda
 * degli elettrodomestici sapeva di entita' prese una per una — un
 * interruttore, un sensore di potenza — e chi aveva un apparecchio connesso
 * doveva cercarsi le sue venti entita' nel cercatore e scriverle nelle caselle
 * giuste, a mano, sapendo gia' quale fosse il tempo rimanente e quale la fase.
 *
 * Qui sta la parte che ragiona: dato un dispositivo di Home Assistant con le
 * sue entita', dire di che apparecchio si tratta, quale entita' fa da potenza
 * e quale da tempo rimanente, e come si raggruppano tutte le altre nella
 * finestra del dettaglio. Niente DOM, niente socket: dati dentro, dati fuori,
 * cosi' si prova su una lavatrice di hOn finta senza accendere niente.
 *
 * Gli indizi si leggono in tre posti: l'id dell'entita', il suo nome e la
 * chiave di traduzione. La terza e' la piu' fedele — hOn chiama
 * `remaining_time` il tempo che manca in qualunque lingua sia Home Assistant —
 * e per questo pesa quanto le altre due messe insieme.
 */
import { APPLIANCE_BINDING_FIELDS, APPLIANCE_CATALOG } from "./device-model.js";
import { CAMPI_SCELTI } from "./energy-loads-config.js";
import { pick } from "./i18n.js";

const clean = (value) => String(value ?? "").trim();
const lower = (value) => clean(value).toLowerCase();
const domainOf = (entityId) => lower(entityId).split(".")[0];

/* Un nome ridotto all'osso, per confrontarne due: minuscolo, senza accenti,
 * senza separatori. Serve a riconoscere l'interruttore che porta il nome del
 * dispositivo, che e' una cosa che le integrazioni fanno tutte e che nessuna
 * lista di parole puo' sapere in anticipo. */
const nomeRidotto = (value) =>
  lower(value)
    .normalize("NFKD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .replaceAll(/[^a-z0-9]+/g, " ")
    .trim();

const ENERGY_UNITS = new Set(["kwh", "wh", "mwh"]);
const POWER_UNITS = new Set(["w", "kw"]);

/* Le parole di un'entita', cosi' come le cerca ogni regola. */
export function entityClues(entity = {}) {
  const parts = [
    lower(entity.entity_id).split(".").slice(1).join("."),
    lower(entity.name),
    lower(entity.translation_key),
    lower(entity.translation_key),
  ];
  return ` ${parts.join(" ").replaceAll(/[_\-./]+/g, " ")} `;
}

function unitOf(entity, states) {
  return lower(entity.unit) || lower(states?.[entity.entity_id]?.attributes?.unit_of_measurement);
}

function deviceClassOf(entity, states) {
  return lower(entity.device_class) || lower(states?.[entity.entity_id]?.attributes?.device_class);
}

function stateClassOf(entity, states) {
  return lower(entity.state_class) || lower(states?.[entity.entity_id]?.attributes?.state_class);
}

const isEnergy = (entity, states) =>
  ENERGY_UNITS.has(unitOf(entity, states)) || deviceClassOf(entity, states) === "energy";
const isPower = (entity, states) =>
  POWER_UNITS.has(unitOf(entity, states)) || deviceClassOf(entity, states) === "power";

const DAILY = /\b(today|daily|oggi|giorno|giornalier[ao]|day)\b/;
const MONTHLY = /\b(month|monthly|mese|mensile)\b/;
const YEARLY = /\b(year|yearly|annual|anno|annuale)\b/;
const CYCLE = /\b(cycle|ciclo|current|corrente|last|ultimo|program|programma|run)\b/;
const TOTAL = /\b(total|totale|lifetime|meter|contatore|consumption|consumo|cumulative)\b/;
const DELAY = /\b(delay|delayed|ritard[oa]|start in|timer)\b/;
const DIAGNOSTIC_ONLY = /\b(rssi|signal|wifi|ip|mac|firmware|version|uptime|battery)\b/;

/* Un ruolo: dove va cercato, e quanto vale ogni indizio.
 *
 * L'ordine e' quello in cui si assegnano: un'entita' presa da un ruolo non
 * viene offerta ai successivi, e i ruoli piu' stretti stanno prima perche' il
 * «contatore totale» e' l'ultimo a scegliere fra le energie, non il primo. */
const ROLES = Object.freeze([
  {
    key: "power_entity",
    score(entity, clues, states) {
      if (domainOf(entity.entity_id) !== "sensor" || !isPower(entity, states)) return null;
      let score = 10;
      if (/\b(power|potenza|watt)\b/.test(clues)) score += 3;
      if (/\b(voltage|current|apparent|reactive|factor|tension|amper)\b/.test(clues)) score -= 3;
      if (entity.category === "diagnostic") score -= 5;
      return score;
    },
  },
  {
    key: "daily_energy_entity",
    score(entity, clues, states) {
      if (domainOf(entity.entity_id) !== "sensor" || !isEnergy(entity, states)) return null;
      return DAILY.test(clues) ? 10 : null;
    },
  },
  {
    key: "monthly_energy_entity",
    score(entity, clues, states) {
      if (domainOf(entity.entity_id) !== "sensor" || !isEnergy(entity, states)) return null;
      return MONTHLY.test(clues) ? 10 : null;
    },
  },
  {
    key: "last_energy_entity",
    score(entity, clues, states) {
      if (domainOf(entity.entity_id) !== "sensor" || !isEnergy(entity, states)) return null;
      if (YEARLY.test(clues) || TOTAL.test(clues)) return null;
      return CYCLE.test(clues) ? 8 : null;
    },
  },
  {
    key: "total_energy_entity",
    score(entity, clues, states) {
      if (domainOf(entity.entity_id) !== "sensor" || !isEnergy(entity, states)) return null;
      if (YEARLY.test(clues) || CYCLE.test(clues)) return null;
      let score = 2;
      if (stateClassOf(entity, states) === "total_increasing") score += 6;
      else if (stateClassOf(entity, states) === "total") score += 4;
      if (TOTAL.test(clues)) score += 4;
      return score;
    },
  },
  {
    key: "state_entity",
    score(entity, clues, states) {
      const domain = domainOf(entity.entity_id);
      if (domain === "binary_sensor") {
        return /\b(running|active|working|operating|in funzione|attiv[oa])\b/.test(clues)
          ? 4
          : null;
      }
      if (domain !== "sensor" || unitOf(entity, states)) return null;
      if (/\b(remote|door|connection|connectivity|lock|error|fault)\b/.test(clues)) return null;
      if (
        /\b(machine (state|status)|machine_(state|status)|operation (state|status))\b/.test(clues)
      )
        return 9;
      if (/\b(program (phase|status)|phase|fase)\b/.test(clues)) return 8;
      if (/\b(status|stato|state|mode|modalita)\b/.test(clues)) return 5;
      return null;
    },
  },
  {
    key: "remaining_entity",
    score(entity, clues, states) {
      if (domainOf(entity.entity_id) !== "sensor" || DELAY.test(clues)) return null;
      if (!/\b(remaining|remain|rimanente|rimanenti|left|end time|finish|fine)\b/.test(clues))
        return null;
      let score = 8;
      const unit = unitOf(entity, states);
      if (["min", "minutes", "s", "h", "sec"].includes(unit)) score += 3;
      if (["duration", "timestamp"].includes(deviceClassOf(entity, states))) score += 2;
      return score;
    },
  },
  {
    key: "cycle_duration_entity",
    score(entity, clues, states) {
      if (domainOf(entity.entity_id) !== "sensor" || DELAY.test(clues)) return null;
      if (/\b(remaining|elapsed|trascors[oa])\b/.test(clues)) return null;
      if (!/\b(duration|durata|total time|program time|cycle time)\b/.test(clues)) return null;
      return ["min", "minutes", "s", "h"].includes(unitOf(entity, states)) ? 9 : 6;
    },
  },
  {
    key: "temperature_entity",
    cold: true,
    score(entity, clues, states) {
      if (domainOf(entity.entity_id) !== "sensor") return null;
      if (deviceClassOf(entity, states) !== "temperature" && !/°/.test(unitOf(entity, states)))
        return null;
      if (/\b(target|setpoint|obiettivo|desired|set)\b/.test(clues)) return null;
      let score = 6;
      if (/\b(fridge|frigo|refrigerator|frigorifero|cooler)\b/.test(clues)) score += 4;
      if (/\b(freezer|congelatore)\b/.test(clues)) score -= 2;
      if (/\b(ambient|room|ambiente|external|esterna)\b/.test(clues)) score -= 3;
      return score;
    },
  },
  {
    key: "temperature_entity_2",
    cold: true,
    score(entity, clues, states) {
      if (domainOf(entity.entity_id) !== "sensor") return null;
      if (deviceClassOf(entity, states) !== "temperature" && !/°/.test(unitOf(entity, states)))
        return null;
      if (/\b(target|setpoint|obiettivo|desired|set)\b/.test(clues)) return null;
      if (/\b(ambient|room|ambiente|external|esterna)\b/.test(clues)) return null;
      return /\b(freezer|congelatore)\b/.test(clues) ? 10 : 3;
    },
  },
  {
    key: "control_entity",
    /* Il tasto acceso/spento, che e' il piu' difficile da indovinare.
     *
     * Una lavatrice connessa espone dieci interruttori — pausa, prelavaggio,
     * acquaplus, un risciacquo in piu', due, il vapore, le ore notturne — e
     * uno solo accende la macchina. Le liste di parole sotto sono utili ma
     * parlano una lingua: su una casa italiana, «Pausa» non e' `pause` e
     * «Prelavaggio» non e' `prewash`, e tutti gli interruttori finivano a
     * pari punteggio, col tasto scelto in pratica a sorte.
     *
     * Il segnale che non dipende dalla lingua e' un altro: l'interruttore
     * principale porta il nome del dispositivo. hOn chiama «Lavatrice»
     * l'interruttore della lavatrice, Home Connect chiama «Forno» quello del
     * forno; le opzioni del programma no, quelle hanno il loro nome. Vale
     * piu' di ogni parola, quindi pesa piu' di ogni parola. */
    score(entity, clues, states, contesto) {
      const domain = domainOf(entity.entity_id);
      if (!["switch", "light", "fan", "input_boolean"].includes(domain)) return null;
      let score = domain === "switch" ? 6 : 3;
      const suo = nomeRidotto(entity.name);
      const del = nomeRidotto(contesto?.deviceName);
      if (suo && del && suo === del) score += 9;
      if (
        /\b(wash|start|run|power|on off|onoff|main|operation|dry|cook|oven|dish|remote start|working|avvio|avvia|accensione|accendi|marcia|funzionamento)\b/.test(
          clues,
        )
      )
        score += 5;
      if (
        /\b(pause|child lock|lock|eco|steam|delay|extra|silent|anti|dose|dosage|led|light|buzzer|sound|remote control|keep fresh|night|standby|auto)\b/.test(
          clues,
        )
      )
        score -= 4;
      /* Le stesse, come le scrive un Home Assistant in italiano. Radici e non
       * parole intere: «risciacquo» e «risciacqui» sono la stessa opzione. */
      if (
        /(pausa|prelavagg|risciacqu|vapore|acquaplus|ammollo|notturn|blocco|bambin|antipiega|stiro|detersiv|ritard|sporco|silenzios|centrifug|temperatur|programm|efficienz|capacit|carico|lingua)/.test(
          clues,
        )
      )
        score -= 4;
      if (entity.category) score -= 6;
      return score;
    },
  },
  {
    key: "alert_entity",
    score(entity, clues, states) {
      if (domainOf(entity.entity_id) !== "binary_sensor") return null;
      if (deviceClassOf(entity, states) === "problem") return 9;
      return /\b(error|errore|fault|guasto|problem|problema|anomal|alarm|allarme)\b/.test(clues)
        ? 6
        : null;
    },
  },
  {
    key: "last_start_entity",
    score(entity, clues, states) {
      if (domainOf(entity.entity_id) !== "sensor" || DELAY.test(clues)) return null;
      if (!/\b(start time|started|last start|avvio|begin|inizio)\b/.test(clues)) return null;
      return deviceClassOf(entity, states) === "timestamp" ? 9 : 5;
    },
  },
  {
    key: "last_cost_entity",
    score(entity, clues, states) {
      if (domainOf(entity.entity_id) !== "sensor") return null;
      if (!/\b(cost|costo)\b/.test(clues)) return null;
      return /€|eur|\$|£/.test(unitOf(entity, states)) ? 9 : 4;
    },
  },
]);

/* Gli apparecchi che tengono il freddo: solo per loro la temperatura e' una
 * barra della card al posto della potenza. Su una lavatrice la «temperatura»
 * e' quella del programma, e una barra al posto dei watt non racconta niente. */
const COLD_TYPES = new Set(["frigo", "congelatore"]);

export const ROLE_KEYS = Object.freeze(ROLES.map((role) => role.key));

/* Le entita' che si possono proporre: accese in Home Assistant, e non quelle
 * che parlano della radio invece che dell'apparecchio. */
function candidates(entities = []) {
  return entities.filter(
    (entity) =>
      entity &&
      clean(entity.entity_id).includes(".") &&
      !entity.disabled &&
      !DIAGNOSTIC_ONLY.test(entityClues(entity)),
  );
}

/**
 * Propone, per ogni ruolo della card, l'entita' del dispositivo che lo fa.
 *
 * Restituisce solo i ruoli trovati. Un'entita' serve un ruolo solo; a pari
 * punteggio vince quella con l'id piu' corto, che di solito e' la piu'
 * semplice — «energy_total» prima di «energy_total_water».
 */
export function proposeRoles(entities = [], states = {}, { type = "", deviceName = "" } = {}) {
  const cold = COLD_TYPES.has(lower(type));
  const contesto = { deviceName };
  const taken = new Set();
  const proposal = {};
  for (const role of ROLES) {
    if (role.cold && !cold) continue;
    let best = null;
    for (const entity of candidates(entities)) {
      if (taken.has(entity.entity_id)) continue;
      const score = role.score(entity, entityClues(entity), states, contesto);
      if (score == null || score <= 0) continue;
      if (
        !best ||
        score > best.score ||
        (score === best.score && entity.entity_id.length < best.entity.entity_id.length)
      )
        best = { entity, score };
    }
    if (!best) continue;
    taken.add(best.entity.entity_id);
    proposal[role.key] = best.entity.entity_id;
  }
  return proposal;
}

/* Che apparecchio e', letto da nome, modello e dalle sue entita'. */
const TYPE_CLUES = Object.freeze([
  ["lavatrice", /\b(washer dryer|lavasciuga)\b/],
  ["asciugatrice", /\b(dryer|tumble|asciugatrice|asciug)\b/],
  ["lavatrice", /\b(washing machine|washer|washing|lavatrice|lavatr|wash)\b/],
  ["lavastoviglie", /\b(dishwasher|dish|lavastoviglie|lavastov)\b/],
  ["forno", /\b(oven|forno|cooker)\b/],
  ["microonde", /\b(microwave|microonde)\b/],
  ["congelatore", /\b(freezer|congelatore)\b/],
  ["frigo", /\b(fridge|refrigerator|frigorifero|frigo|cooler)\b/],
  ["piano_cottura", /\b(hob|cooktop|induction|piano cottura|induzione)\b/],
  ["cappa", /\b(hood|cappa|extractor)\b/],
  ["caffe", /\b(coffee|caffe|espresso)\b/],
  [
    "condizionatore",
    /\b(air conditioner|air conditioning|conditioner|condizionatore|clima|ac unit)\b/,
  ],
  ["robot", /\b(robot|vacuum|aspirapolvere)\b/],
  ["scaldabagno", /\b(water heater|scaldabagno|boiler)\b/],
  ["tv", /\b(tv|television|televisore)\b/],
  ["bollitore", /\b(kettle|bollitore)\b/],
  ["friggitrice", /\b(air fryer|fryer|friggitrice)\b/],
  ["ferro", /\b(iron|ferro da stiro)\b/],
  ["ventilatore", /\b(fan|ventilatore)\b/],
]);

const ENTITY_TYPE_CLUES = Object.freeze([
  ["asciugatrice", /\b(dry level|dryness|drying|tumble)\b/],
  ["lavatrice", /\b(spin speed|spin|rinse|detergent|softener|prewash|wash)\b/],
  ["lavastoviglie", /\b(rinse aid|salt|tabs|half load|dishwasher)\b/],
  ["forno", /\b(oven|preheat|cavity|meat probe)\b/],
  ["frigo", /\b(fridge|refrigerator|super cool|freezer)\b/],
]);

export function guessApplianceType({ name, model, manufacturer, entities = [] } = {}) {
  const words = ` ${[name, model, manufacturer]
    .map(lower)
    .join(" ")
    .replaceAll(/[_\-./]+/g, " ")} `;
  const known = new Set(APPLIANCE_CATALOG.map((item) => item.key));
  for (const [key, pattern] of TYPE_CLUES) {
    if (pattern.test(words) && known.has(key)) return key;
  }
  const clues = entities.map(entityClues).join(" ");
  for (const [key, pattern] of ENTITY_TYPE_CLUES) {
    if (pattern.test(clues) && known.has(key)) return key;
  }
  return "generico";
}

/* La stanza della plancia che porta lo stesso nome dell'area di Home Assistant. */
export function roomForArea(area, rooms = []) {
  const wanted = lower(area).normalize("NFKD").replaceAll(/[̀-ͯ]/g, "");
  if (!wanted) return "";
  const found = rooms.find(
    (room) => lower(room?.name).normalize("NFKD").replaceAll(/[̀-ͯ]/g, "") === wanted,
  );
  return found ? clean(found.id || found.name) : "";
}

/* Le integrazioni con dentro i loro dispositivi, come le vuole un menu. */
export function integrationsWithDevices(catalog = {}) {
  const devices = (catalog.devices || []).filter((device) => device && device.entities > 0);
  return (catalog.integrations || [])
    .map((integration) => ({
      ...integration,
      devices: devices.filter((device) => device.integration === integration.domain),
    }))
    .filter((integration) => integration.devices.length)
    .sort((a, b) => lower(a.name).localeCompare(lower(b.name)));
}

export function bindingLabel(appliance = {}, locale = "it") {
  const integration = clean(appliance.integration_name) || clean(appliance.integration);
  const maker = [appliance.device_manufacturer, appliance.device_model].map(clean).filter(Boolean);
  const count = Array.isArray(appliance.device_entities) ? appliance.device_entities.length : 0;
  const parts = [integration, maker.join(" ")].filter(Boolean);
  if (count)
    parts.push(
      count === 1
        ? pick("1 entità", "1 entity", locale)
        : `${count} ${pick("entità", "entities", locale)}`,
    );
  return parts.join(" · ");
}

/**
 * Collega un apparecchio a un dispositivo: scrive il collegamento, propone il
 * tipo, la stanza e le entita' dei ruoli — senza toccare quello che chi
 * configura ha gia' scritto a mano.
 */
export function bindApplianceToDevice(
  appliance = {},
  { device = {}, entities = [], integration = null, states = {}, rooms = [] } = {},
) {
  /* Chi collega un dispositivo ha detto tutto, comprese le caselle lasciate
   * vuote: la passata che indovina le entita' dal nome dell'apparecchio —
   * «Lavatrice» prende ogni `sensor.lavatrice_*` della casa — riempirebbe
   * `entities` con tutto il dispositivo, e la parte curata del dettaglio
   * mostrerebbe venti righe invece delle cinque della card. Il flag e' lo
   * stesso che scrive chi passa dalla maschera dei carichi. */
  const next = {
    ...appliance,
    metadata: { ...(appliance.metadata || {}), [CAMPI_SCELTI]: true },
  };
  const enabled = candidates(entities).map((entity) => entity.entity_id);
  next.device_id = clean(device.id);
  next.integration = clean(integration?.domain || device.integration);
  next.integration_name = clean(integration?.name) || next.integration;
  next.device_name = clean(device.name);
  next.device_manufacturer = clean(device.manufacturer);
  next.device_model = clean(device.model);
  /* Le entita' accese: quelle spente in Home Assistant non hanno uno stato
   * da mostrare, e il numero deve essere lo stesso che il menu ha promesso. */
  next.device_entities = [
    ...new Set(
      entities
        .filter((entity) => !entity?.disabled)
        .map((entity) => clean(entity.entity_id))
        .filter(Boolean),
    ),
  ];

  if (!clean(next.name)) next.name = clean(device.name);
  const currentType = lower(next.visual_key || next.device_type || next.icon);
  if (!currentType || currentType === "generico" || currentType === "appliance") {
    const type = guessApplianceType({
      name: device.name,
      model: device.model,
      manufacturer: device.manufacturer,
      entities,
    });
    next.icon = type;
    next.visual_key = type;
    next.device_type = type;
    next.visual_type = "asset";
  }
  if (!clean(next.room_id)) {
    const room = roomForArea(device.area, rooms);
    if (room) next.room_id = room;
  }

  const proposal = proposeRoles(entities, states, {
    type: next.visual_key,
    deviceName: device.name,
  });
  const filled = [];
  const kept = [];
  for (const [role, entity] of Object.entries(proposal)) {
    if (clean(next[role])) {
      kept.push(role);
      continue;
    }
    next[role] = entity;
    filled.push(role);
  }
  const total = clean(next.total_energy_entity);
  if (total) {
    if (!clean(next.history_entity)) next.history_entity = total;
    if (!clean(next.report_entity)) next.report_entity = total;
  }
  if (!clean(next.energy_entity))
    next.energy_entity =
      total || clean(next.monthly_energy_entity) || clean(next.daily_energy_entity);
  next.entities = [
    ...new Set(
      [
        ...(Array.isArray(appliance.entities) ? appliance.entities : []).map((entry) =>
          clean(typeof entry === "string" ? entry : entry?.entity || entry?.entity_id),
        ),
        ...ROLE_KEYS.map((role) => clean(next[role])),
      ].filter((entity) => entity.includes(".")),
    ),
  ];
  return { appliance: next, filled, kept, enabled };
}

/* Toglie il collegamento e basta: le caselle restano come sono. */
export function unbindAppliance(appliance = {}) {
  const next = { ...appliance };
  for (const key of APPLIANCE_BINDING_FIELDS) delete next[key];
  delete next.device_entities;
  return next;
}

const MUTE = /^(unknown|unavailable|none|)$/i;
const INTERACTIVE = new Set([
  "switch",
  "select",
  "number",
  "button",
  "input_boolean",
  "light",
  "fan",
]);

function readableName(entity, states) {
  const own = clean(entity.name);
  if (own) return own.charAt(0).toUpperCase() + own.slice(1);
  const friendly = clean(states?.[entity.entity_id]?.attributes?.friendly_name);
  if (friendly) return friendly;
  const tail = clean(entity.entity_id).split(".").slice(1).join(".").replaceAll("_", " ");
  return tail.charAt(0).toUpperCase() + tail.slice(1);
}

function readableValue(entity, states, locale) {
  const state = states?.[entity.entity_id];
  const raw = clean(state?.state);
  /* Senza uno stato da leggere si giudica dall'unita': un sensore in giri al
   * minuto e' una lettura anche quando la lavatrice e' spenta e non lo dice. */
  if (!state || MUTE.test(raw))
    return { value: "—", numeric: Boolean(clean(entity.unit)), on: false };
  const unit = clean(state.attributes?.unit_of_measurement) || clean(entity.unit);
  const number = Number.parseFloat(raw.replace(",", "."));
  if (Number.isFinite(number) && /^-?\d+([.,]\d+)?$/.test(raw))
    return { value: `${raw}${unit ? ` ${unit}` : ""}`, numeric: true, on: false };
  if (/^(on|off)$/i.test(raw))
    return {
      value:
        raw.toLowerCase() === "on" ? pick("Acceso", "On", locale) : pick("Spento", "Off", locale),
      numeric: false,
      on: raw.toLowerCase() === "on",
    };
  return {
    value: raw.replaceAll("_", " "),
    numeric: false,
    on: /^(open|running|active|cleaning|heating|cooling|playing)$/i.test(raw),
  };
}

/**
 * Le entita' del dispositivo divise per la finestra del dettaglio.
 *
 * Quattro famiglie: lo stato (sensori di testo e binari), le letture (numeri),
 * i comandi (interruttori, menu, numeri e tasti) e la diagnostica, che sta in
 * fondo perche' la potenza del Wi-Fi non e' una notizia sulla lavatrice.
 * `mapped` sono le entita' che la finestra mostra gia' nella parte curata:
 * qui si segnano e basta, cosi' chi disegna decide se ripeterle.
 */
export function deviceEntityGroups(
  entities = [],
  states = {},
  { mapped = [], locale = "it", readOnly = false } = {},
) {
  const already = new Set((mapped || []).map(clean));
  const groups = { state: [], readings: [], controls: [], diagnostics: [] };
  for (const entity of entities) {
    const id = clean(entity?.entity_id);
    if (!id.includes(".") || entity.disabled) continue;
    const domain = domainOf(id);
    const { value, numeric, on } = readableValue(entity, states, locale);
    const row = {
      entity: id,
      domain,
      name: readableName(entity, states),
      value,
      on,
      mapped: already.has(id),
      category: clean(entity.category),
      control: null,
    };
    if (INTERACTIVE.has(domain) && !readOnly) {
      const attributes = states?.[id]?.attributes || {};
      if (domain === "select")
        row.control = {
          kind: "select",
          options: Array.isArray(attributes.options) ? attributes.options.map(clean) : [],
          current: clean(states?.[id]?.state),
        };
      else if (domain === "number")
        row.control = {
          kind: "number",
          min: attributes.min,
          max: attributes.max,
          step: attributes.step,
          current: clean(states?.[id]?.state),
        };
      else if (domain === "button") row.control = { kind: "press" };
      else row.control = { kind: "toggle", on };
    }
    if (entity.category === "diagnostic") groups.diagnostics.push(row);
    else if (row.control) groups.controls.push(row);
    else if (numeric) groups.readings.push(row);
    else groups.state.push(row);
  }
  for (const list of Object.values(groups))
    list.sort((a, b) => a.name.localeCompare(b.name, locale));
  return groups;
}
