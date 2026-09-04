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
    /* I comandi a parte del robot (#306): tasti, tendine e interruttori che
     * l'integrazione pubblica accanto a lui. Sopravvivono alla normalizzazione
     * come la batteria, o sparirebbero a ogni salvataggio. */
    comandi: elencoComandi(input.comandi ?? input.commands),
  };
}

/* ── i comandi a parte del robot (#306) ──────────────────────────────────
 *
 * «Le varie entita' del robot continuano a non essere visibili: da solo la
 * modalita' aspirazione. Comandi mancanti: button.roborock_..._asp_e_lav,
 * ..._pulizia_completa, ..._solo_aspirazione, ..._solo_lavaggio.»
 *
 * Un robot che lava non e' solo un `vacuum`. L'integrazione pubblica accanto a
 * lui i suoi programmi come tasti, le sue regolazioni — il mocio, l'acqua —
 * come tendine, le sue funzioni come interruttori: sono entita' a parte, e la
 * scheda del robot non le vedeva perche' guardava solo la sua. Qui si dice
 * quali entita' possono stare sulla scheda come comandi, come si chiamano
 * senza ripetere il nome del robot, e cosa fa ognuna quando la si tocca. Chi
 * configura le sceglie; chi disegna le mostra nell'ordine in cui sono scritte.
 */
export const DOMINI_COMANDO = Object.freeze({
  button: "tasto",
  input_button: "tasto",
  script: "tasto",
  scene: "tasto",
  switch: "interruttore",
  input_boolean: "interruttore",
  select: "tendina",
  input_select: "tendina",
});

/* Dodici: una scheda e' una scheda, non la pagina delle impostazioni. */
export const COMANDI_MASSIMI = 12;

/** Che genere di comando e' quell'entita': tasto, tendina, interruttore — o niente. */
export function genereDelComando(entity) {
  return DOMINI_COMANDO[clean(entity).split(".")[0]] || "";
}

/** L'elenco pulito: solo entita' comandabili, una volta sola, non piu' di dodici. */
export function elencoComandi(input) {
  const grezzi = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(/[\s,;]+/)
      : [];
  const visti = new Set();
  const fuori = [];
  for (const voce of grezzi) {
    const entity = clean(voce && typeof voce === "object" ? voce.entity : voce);
    if (!entity || !genereDelComando(entity) || visti.has(entity)) continue;
    visti.add(entity);
    fuori.push(entity);
    if (fuori.length >= COMANDI_MASSIMI) break;
  }
  return fuori;
}

const umano = (testo) => {
  const pulito = clean(testo).replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return pulito ? pulito[0].toUpperCase() + pulito.slice(1) : "";
};

/* Il nome di un comando, senza il nome del robot davanti.
 *
 * Home Assistant chiama le entita' di un dispositivo «Nome del dispositivo
 * Nome dell'entita'»: su una scheda che porta gia' «Roborock Qrevo Edge» in
 * testa, un tasto «Roborock Qrevo Edge Asp e lav» ripete tre parole per dirne
 * tre. Si toglie il prefisso quando c'e'; senza `friendly_name` si legge la
 * coda dell'id, che e' comunque una parola scritta da qualcuno. */
export function nomeDelComando(entity, robot = {}, states = {}) {
  const voce = clean(entity);
  const proprio = clean(states?.[voce]?.attributes?.friendly_name);
  const delRobot = clean(states?.[clean(robot?.entity)]?.attributes?.friendly_name);
  if (proprio) {
    if (
      delRobot &&
      proprio.length > delRobot.length &&
      proprio.toLowerCase().startsWith(delRobot.toLowerCase())
    ) {
      const coda = proprio.slice(delRobot.length).replace(/^[\s:·\-–—]+/, "");
      if (coda) return umano(coda);
    }
    return proprio;
  }
  const oggetto = voce.split(".")[1] || voce;
  const radice = clean(robot?.entity).split(".")[1] || "";
  const coda =
    radice && oggetto.startsWith(`${radice}_`) ? oggetto.slice(radice.length + 1) : oggetto;
  return umano(coda);
}

/** I comandi di un robot come stanno adesso: nome, genere, stato, opzioni. */
export function comandiDelRobot(robot = {}, states = {}) {
  return elencoComandi(robot?.comandi).map((entity) => {
    const genere = genereDelComando(entity);
    const corrente = states?.[entity];
    const attributi = corrente?.attributes || {};
    const stato = clean(corrente?.state).toLowerCase();
    return {
      entity,
      genere,
      name: nomeDelComando(entity, robot, states),
      /* Un tasto mai premuto sta su «unknown», ed e' un tasto che funziona:
       * non raggiungibile e' solo chi lo dice. */
      available: Boolean(corrente) && stato !== "unavailable",
      acceso: genere === "interruttore" ? stato === "on" : null,
      opzioni:
        genere === "tendina" && Array.isArray(attributi.options)
          ? attributi.options.map(clean).filter(Boolean)
          : [],
      scelta: genere === "tendina" ? clean(corrente?.state) : "",
    };
  });
}

/**
 * Il servizio dietro un comando.
 *
 * Un tasto si preme, uno script e una scena si accendono, un interruttore si
 * inverte, una tendina sceglie: quattro verbi per otto domini, e nessun
 * servizio inventato — sono quelli che Home Assistant ha per quelle entita'.
 */
export function comandoDelRobot(voce = {}, valore = "") {
  const entity = clean(voce?.entity);
  const dominio = entity.split(".")[0];
  const genere = genereDelComando(entity);
  if (!genere) return null;
  if (genere === "tendina") {
    const opzione = clean(valore);
    if (!opzione) return null;
    return {
      domain: dominio,
      service: "select_option",
      data: { entity_id: entity, option: opzione },
    };
  }
  if (genere === "interruttore")
    return { domain: dominio, service: "toggle", data: { entity_id: entity } };
  if (dominio === "button" || dominio === "input_button")
    return { domain: dominio, service: "press", data: { entity_id: entity } };
  return { domain: dominio, service: "turn_on", data: { entity_id: entity } };
}

/* I comandi che stanno accanto al robot, da proporre a chi configura.
 *
 * Le entita' di uno stesso dispositivo si riconoscono da come Home Assistant
 * le chiama: l'id comincia con l'id del robot — `vacuum.roborock_qrevo` e
 * `button.roborock_qrevo_asp_e_lav` — oppure il nome comincia col nome del
 * robot. Sono proposte, non scelte: un robot pubblica anche i tasti che
 * azzerano i contatori dei filtri, e nessuno li vuole sotto il pollice senza
 * averlo detto. Chi configura li vede in scheda e tocca quelli che vuole. */
export function comandiSuggeriti(robot = {}, states = {}) {
  const entity = clean(robot?.entity);
  const radice = entity.split(".")[1] || "";
  if (!radice) return [];
  const nome = clean(states?.[entity]?.attributes?.friendly_name).toLowerCase();
  const gia = new Set(elencoComandi(robot?.comandi));
  const trovati = [];
  for (const [id, corrente] of Object.entries(states || {})) {
    if (gia.has(id) || !genereDelComando(id)) continue;
    const oggetto = id.split(".")[1] || "";
    const stessoId = oggetto.startsWith(`${radice}_`);
    const suoNome = clean(corrente?.attributes?.friendly_name).toLowerCase();
    const stessoNome = Boolean(nome) && suoNome.startsWith(`${nome} `);
    if (stessoId || stessoNome) trovati.push(id);
  }
  const ordine = { tasto: 0, tendina: 1, interruttore: 2 };
  return trovati.sort(
    (a, b) => ordine[genereDelComando(a)] - ordine[genereDelComando(b)] || a.localeCompare(b),
  );
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
    /* I comandi a parte (#306), come stanno adesso. */
    comandi: comandiDelRobot(robot, states),
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
