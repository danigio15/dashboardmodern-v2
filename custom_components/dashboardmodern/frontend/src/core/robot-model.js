/* Il robot aspirapolvere — e il tagliaerba.
 *
 * Un robot non e' un interruttore: ha uno stato che racconta cosa sta facendo,
 * una batteria che si consuma mentre lo fa, una potenza di aspirazione da
 * scegliere e una mappa della casa che disegna mentre gira. La plancia non
 * aveva niente di tutto questo.
 *
 * Qui c'e' cio' che si puo' decidere guardando solo i dati: come si chiama uno
 * stato, quale comando risponde a un pulsante, quali pulsanti ha senso mostrare
 * per quel robot. Il modulo e' puro: non parla con Home Assistant e non tocca
 * il DOM, cosi' le regole si possono provare senza accendere niente.
 *
 * I robot sono di due specie, e a dirlo e' l'entita' stessa: `vacuum.*` e' un
 * aspirapolvere, `lawn_mower.*` un tagliaerba. Le due specie parlano dialetti
 * diversi — servizi, stati e numeri delle capacita' non coincidono — e la
 * specie decide quale dialetto si usa, senza che chi disegna debba saperlo.
 */

import { SOURCE_LOCALE, getLocale, pick } from "./i18n.js";

const clean = (value) => String(value ?? "").trim();

const numero = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/* Cosa sa fare un aspirapolvere, come lo dice Home Assistant. I numeri sono i
 * suoi, non nostri: cambiarli qui vorrebbe dire leggere male ogni robot. */
export const VACUUM_FEATURES = Object.freeze({
  TURN_ON: 1,
  TURN_OFF: 2,
  PAUSE: 4,
  STOP: 8,
  RETURN_HOME: 16,
  FAN_SPEED: 32,
  BATTERY: 64,
  STATUS: 128,
  SEND_COMMAND: 256,
  LOCATE: 512,
  CLEAN_SPOT: 1024,
  MAP: 2048,
  STATE: 4096,
  START: 8192,
});

/* Cosa sa fare un tagliaerba. Anche questi numeri sono di Home Assistant
 * (`LawnMowerEntityFeature`): un dialetto piu' povero, tre capacita' in tutto,
 * e nessuna parentela coi numeri dei vacuum. */
export const MOWER_FEATURES = Object.freeze({
  START_MOWING: 1,
  PAUSE: 2,
  DOCK: 4,
});

/* La specie di un robot la dice il prefisso della sua entita'. Chi non ha
 * ancora un'entita' — un robot appena aggiunto — e' un aspirapolvere finche'
 * non si dichiara, che e' la specie di sempre. */
export function robotSpecies(entity) {
  return clean(entity).toLowerCase().startsWith("lawn_mower.") ? "lawn_mower" : "vacuum";
}

export const SPECIES_LABELS = Object.freeze({
  vacuum: ["Aspirapolvere", "Vacuum"],
  lawn_mower: ["Tagliaerba", "Lawn mower"],
});

export const ROBOT_STATES = Object.freeze({
  cleaning: ["Sta pulendo", "Cleaning"],
  mowing: ["Sta tagliando", "Mowing"],
  returning: ["Torna alla base", "Returning to dock"],
  docked: ["Alla base", "Docked"],
  idle: ["In attesa", "Idle"],
  paused: ["In pausa", "Paused"],
  error: ["Errore", "Error"],
  unavailable: ["Non raggiungibile", "Unavailable"],
  unknown: ["Sconosciuto", "Unknown"],
});

/* Come si chiama uno stato, nella lingua della plancia.
 *
 * Il secondo argomento era un booleano "inglese si'/no", che dava italiano a
 * chiunque non fosse inglese. Ora e' la lingua: `true` continua a valere
 * inglese, perche' e' cosi' che lo chiamava chi c'era prima. */
export function robotStateLabel(state, locale = getLocale()) {
  const labels = ROBOT_STATES[clean(state).toLowerCase()] || ROBOT_STATES.unknown;
  const code = locale === true ? "en" : locale === false ? SOURCE_LOCALE : locale;
  return pick(labels[0], labels[1], code);
}

/** Un robot, coi campi che la configurazione conosce. */
export function normalizeRobot(input = {}, index = 0) {
  return {
    id: clean(input.id) || `robot-${index + 1}`,
    name: clean(input.name),
    entity: clean(input.entity || input.entities?.[0]),
    mapEntity: clean(input.mapEntity || input.map_entity),
    /* La batteria puo' essere un sensore a parte: molti tagliaerba la
     * pubblicano cosi', fuori dall'entita' del robot. Il campo e' facoltativo
     * e deve sopravvivere alla normalizzazione, o sparirebbe a ogni salvataggio. */
    battery: clean(input.battery || input.battery_entity || input.batteryEntity),
    room: clean(input.room || input.room_id),
  };
}

/* L'elenco dei robot, messo in ordine.
 *
 * Mettere in ordine non e' scegliere: un robot appena aggiunto non ha ancora
 * un'entita', e buttarlo via qui vorrebbe dire che premere "Aggiungi" non fa
 * niente. Lo stesso robot due volte invece e' sempre un errore, e quello si
 * toglie. Chi disegna decide da se' cosa vale la pena mostrare. */
export function normalizeRobots(input = []) {
  const list = Array.isArray(input) ? input : input && typeof input === "object" ? [input] : [];
  const visti = new Set();
  return list
    .map((item, index) => normalizeRobot(item, index))
    .filter((robot) => {
      if (!robot.entity) return true;
      if (visti.has(robot.entity)) return false;
      visti.add(robot.entity);
      return true;
    });
}

/** I robot che vale la pena disegnare: quelli che hanno un'entita'. */
export const drawableRobots = (robots = []) =>
  normalizeRobots(robots).filter((robot) => Boolean(robot.entity));

/* La mappa.
 *
 * Home Assistant non ha un'entita' "mappa": chi ce l'ha la pubblica come una
 * telecamera (e' cosi' che fanno Valetudo e le integrazioni Xiaomi) o come
 * un'immagine. In tutti e due i casi l'indirizzo del disegno sta in
 * `entity_picture`, e cambia a ogni aggiornamento. */
export function robotMapPicture(states = {}, mapEntity = "") {
  const reference = clean(mapEntity);
  if (!reference) return "";
  return clean(states?.[reference]?.attributes?.entity_picture);
}

/**
 * Quello che c'e' da mostrare di un robot, adesso.
 *
 * Uno stato che Home Assistant non conosce e uno che non e' arrivato sono due
 * cose diverse: la prima si mostra com'e', la seconda dice che il robot non
 * risponde, e confonderle vorrebbe dire scrivere "in attesa" su un robot
 * scollegato.
 */
export function robotView(robot = {}, states = {}) {
  const entity = clean(robot.entity);
  const species = robotSpecies(entity);
  const current = states?.[entity];
  const raw = clean(current?.state).toLowerCase();
  const known = Object.prototype.hasOwnProperty.call(ROBOT_STATES, raw);
  const attributes = current?.attributes || {};
  const features = Number(attributes.supported_features) || 0;
  /* La batteria configurata a parte vince su quella dell'attributo: chi l'ha
   * indicata l'ha fatto perche' il robot non la dice da se'. Se pero' il
   * sensore tace — non ancora arrivato, non raggiungibile — si torna
   * all'attributo, che e' meglio di niente. */
  const batteryEntity = clean(robot.battery);
  const separata = batteryEntity ? numero(states?.[batteryEntity]?.state) : null;
  const battery = separata !== null ? separata : numero(attributes.battery_level);
  return {
    id: clean(robot.id),
    entity,
    species,
    name: clean(robot.name) || clean(attributes.friendly_name) || entity,
    room: clean(robot.room),
    available: Boolean(current) && raw !== "unavailable" && raw !== "",
    state: current ? (known ? raw : "unknown") : "unavailable",
    battery,
    batteryEntity,
    charging: raw === "docked" && battery !== null && battery < 100,
    cleaning: raw === "cleaning",
    mowing: raw === "mowing",
    /* Un tagliaerba non ha potenza di aspirazione, qualunque cosa dicano i
     * suoi attributi: senza velocita' il disegno non mostra la tendina. */
    fanSpeed: species === "lawn_mower" ? "" : clean(attributes.fan_speed),
    fanSpeeds:
      species !== "lawn_mower" && Array.isArray(attributes.fan_speed_list)
        ? attributes.fan_speed_list.map(clean).filter(Boolean)
        : [],
    features,
    error: clean(attributes.error),
    mapEntity: clean(robot.mapEntity),
    mapPicture: robotMapPicture(states, robot.mapEntity),
  };
}

/* I pulsanti che hanno senso su quel robot.
 *
 * Mostrarli tutti a tutti vuol dire offrire comandi che non fanno niente:
 * Home Assistant dice gia' cosa quel robot sa fare, e si guarda quello. Un
 * robot che non dichiara niente — capita con le integrazioni fatte in casa —
 * li ha tutti, perche' negarglieli sulla base di un silenzio sarebbe peggio. */
export const ROBOT_ACTIONS = Object.freeze([
  { act: "start", glyph: "▶", it: "Avvia", en: "Start", feature: VACUUM_FEATURES.START },
  { act: "pause", glyph: "⏸", it: "Pausa", en: "Pause", feature: VACUUM_FEATURES.PAUSE },
  { act: "stop", glyph: "⏹", it: "Ferma", en: "Stop", feature: VACUUM_FEATURES.STOP },
  { act: "return", glyph: "🏠", it: "Alla base", en: "Dock", feature: VACUUM_FEATURES.RETURN_HOME },
  {
    act: "spot",
    glyph: "🌀",
    it: "Pulizia mirata",
    en: "Spot clean",
    feature: VACUUM_FEATURES.CLEAN_SPOT,
  },
  { act: "locate", glyph: "🔔", it: "Trovalo", en: "Locate", feature: VACUUM_FEATURES.LOCATE },
]);

/* I pulsanti del tagliaerba: tre in tutto, come i suoi servizi. Non c'e' uno
 * «stop» — un tagliaerba fermo in mezzo al prato non e' uno stato che Home
 * Assistant conosca — e non c'e' pulizia mirata ne' «trovalo». */
export const MOWER_ACTIONS = Object.freeze([
  { act: "start", glyph: "▶", it: "Avvia", en: "Start", feature: MOWER_FEATURES.START_MOWING },
  { act: "pause", glyph: "⏸", it: "Pausa", en: "Pause", feature: MOWER_FEATURES.PAUSE },
  { act: "return", glyph: "🏠", it: "Alla base", en: "Dock", feature: MOWER_FEATURES.DOCK },
]);

export function robotActions(view = {}) {
  const catalogo = robotSpecies(view.entity) === "lawn_mower" ? MOWER_ACTIONS : ROBOT_ACTIONS;
  const features = Number(view.features) || 0;
  if (!features) return catalogo;
  return catalogo.filter((action) => (features & action.feature) !== 0);
}

/* Ogni specie ha il suo dizionario pulsante → servizio, nel dominio che porta
 * il suo stesso nome. */
const SERVIZI = Object.freeze({
  vacuum: Object.freeze({
    start: "start",
    pause: "pause",
    stop: "stop",
    return: "return_to_base",
    spot: "clean_spot",
    locate: "locate",
  }),
  lawn_mower: Object.freeze({
    start: "start_mowing",
    pause: "pause",
    return: "dock",
  }),
});

/**
 * Il comando dietro un pulsante.
 *
 * `vacuum.start` esiste solo sui robot che dichiarano START: quelli piu'
 * vecchi si accendono con `turn_on`, ed e' la stessa cosa detta col nome di
 * prima. Chiamare il servizio sbagliato non da' errore, non fa proprio niente
 * — che e' il modo peggiore di sbagliare.
 *
 * Il ripiego su `turn_on`/`turn_off` e' un fatto dei vacuum: i tagliaerba non
 * hanno mai avuto quei servizi, e offrirli vorrebbe dire proprio il comando
 * che non fa niente.
 */
export function robotCommand(action, view = {}) {
  const act = clean(action);
  const species = robotSpecies(view.entity);
  const features = Number(view.features) || 0;
  if (species === "vacuum") {
    if (act === "start" && features && !(features & VACUUM_FEATURES.START))
      return { domain: "vacuum", service: "turn_on", data: { entity_id: view.entity } };
    if (
      act === "stop" &&
      features &&
      !(features & VACUUM_FEATURES.STOP) &&
      features & VACUUM_FEATURES.TURN_OFF
    )
      return { domain: "vacuum", service: "turn_off", data: { entity_id: view.entity } };
  }
  const service = SERVIZI[species][act];
  if (!service) return null;
  return { domain: species, service, data: { entity_id: view.entity } };
}

/** Il comando per cambiare potenza di aspirazione. Un tagliaerba non ne ha. */
export function robotFanCommand(view = {}, speed = "") {
  const fan = clean(speed);
  if (!fan || robotSpecies(view.entity) === "lawn_mower") return null;
  return {
    domain: "vacuum",
    service: "set_fan_speed",
    data: { entity_id: view.entity, fan_speed: fan },
  };
}
