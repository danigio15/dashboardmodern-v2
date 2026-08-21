/* Il robot aspirapolvere.
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
 */

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

export const ROBOT_STATES = Object.freeze({
  cleaning: ["Sta pulendo", "Cleaning"],
  returning: ["Torna alla base", "Returning to dock"],
  docked: ["Alla base", "Docked"],
  idle: ["In attesa", "Idle"],
  paused: ["In pausa", "Paused"],
  error: ["Errore", "Error"],
  unavailable: ["Non raggiungibile", "Unavailable"],
  unknown: ["Sconosciuto", "Unknown"],
});

/** Come si chiama uno stato, nella lingua della plancia. */
export function robotStateLabel(state, english = false) {
  const labels = ROBOT_STATES[clean(state).toLowerCase()] || ROBOT_STATES.unknown;
  return english ? labels[1] : labels[0];
}

/** Un robot, coi campi che la configurazione conosce. */
export function normalizeRobot(input = {}, index = 0) {
  return {
    id: clean(input.id) || `robot-${index + 1}`,
    name: clean(input.name),
    entity: clean(input.entity || input.entities?.[0]),
    mapEntity: clean(input.mapEntity || input.map_entity),
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
  const current = states?.[entity];
  const raw = clean(current?.state).toLowerCase();
  const known = Object.prototype.hasOwnProperty.call(ROBOT_STATES, raw);
  const attributes = current?.attributes || {};
  const features = Number(attributes.supported_features) || 0;
  const battery = numero(attributes.battery_level);
  return {
    id: clean(robot.id),
    entity,
    name: clean(robot.name) || clean(attributes.friendly_name) || entity,
    room: clean(robot.room),
    available: Boolean(current) && raw !== "unavailable" && raw !== "",
    state: current ? (known ? raw : "unknown") : "unavailable",
    battery,
    charging: raw === "docked" && battery !== null && battery < 100,
    cleaning: raw === "cleaning",
    fanSpeed: clean(attributes.fan_speed),
    fanSpeeds: Array.isArray(attributes.fan_speed_list)
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

export function robotActions(view = {}) {
  const features = Number(view.features) || 0;
  if (!features) return ROBOT_ACTIONS;
  return ROBOT_ACTIONS.filter((action) => (features & action.feature) !== 0);
}

const SERVIZI = Object.freeze({
  start: "start",
  pause: "pause",
  stop: "stop",
  return: "return_to_base",
  spot: "clean_spot",
  locate: "locate",
});

/**
 * Il comando dietro un pulsante.
 *
 * `vacuum.start` esiste solo sui robot che dichiarano START: quelli piu'
 * vecchi si accendono con `turn_on`, ed e' la stessa cosa detta col nome di
 * prima. Chiamare il servizio sbagliato non da' errore, non fa proprio niente
 * — che e' il modo peggiore di sbagliare.
 */
export function robotCommand(action, view = {}) {
  const act = clean(action);
  const features = Number(view.features) || 0;
  if (act === "start" && features && !(features & VACUUM_FEATURES.START))
    return { domain: "vacuum", service: "turn_on", data: { entity_id: view.entity } };
  if (
    act === "stop" &&
    features &&
    !(features & VACUUM_FEATURES.STOP) &&
    features & VACUUM_FEATURES.TURN_OFF
  )
    return { domain: "vacuum", service: "turn_off", data: { entity_id: view.entity } };
  const service = SERVIZI[act];
  if (!service) return null;
  return { domain: "vacuum", service, data: { entity_id: view.entity } };
}

/** Il comando per cambiare potenza di aspirazione. */
export function robotFanCommand(view = {}, speed = "") {
  const fan = clean(speed);
  if (!fan) return null;
  return {
    domain: "vacuum",
    service: "set_fan_speed",
    data: { entity_id: view.entity, fan_speed: fan },
  };
}
