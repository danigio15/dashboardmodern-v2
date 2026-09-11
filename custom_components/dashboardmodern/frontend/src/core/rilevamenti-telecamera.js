/* Cosa ha visto una telecamera, e come dirlo (#394).
 *
 * «Una notifica in home oppure tramite telefono per i rilevamenti da noi
 * impostati.» E poi, alla domanda su cosa siano: «Io utilizzo reolink, mi
 * piacerebbe appunto una volta che io imposto persona, animale, veicolo e
 * movimento — perche' reolink ti sgancia questi sensori — che la Dashboard
 * metta l'avviso con il fotogramma e in contemporanea arriva una notifica da
 * home assistant.»
 *
 * Dentro ci sono due richieste, e una delle due la plancia non deve farla.
 *
 * **Il push sul telefono lo manda Home Assistant.** Arriva da
 * `notify.mobile_app_*` con un'automazione, e rifarne uno qui vorrebbe dire un
 * secondo motore di automazioni da tenere allineato al primo — per poi
 * spedirlo peggio, perche' quello di Home Assistant gira sul server e la
 * plancia gira in un browser che di notte e' chiuso. Quello che si puo' fare
 * bene e' **consegnare l'automazione gia' scritta**, con dentro le entita' di
 * chi la chiede, da copiare e incollare: e' l'ultima funzione di questo file.
 *
 * **L'avviso in plancia** invece e' cosa nostra, ed e' il resto del file.
 *
 * Il modulo e' puro: guarda la configurazione e gli stati, e non chiama
 * niente e non disegna niente.
 */

import { pick } from "./i18n.js";

const pulito = (valore) => String(valore ?? "").trim();
const minuscolo = (valore) => pulito(valore).toLowerCase();

/** Dove si scrive quali sensori guarda ogni telecamera. */
export const CHIAVE_RILEVAMENTI = "cd_rilevamenti";

/* I quattro tipi, dal piu' importante al meno.
 *
 * L'ordine non e' un gusto: quando due sensori scattano insieme — e scattano
 * quasi sempre insieme, perche' una persona che cammina e' anche movimento —
 * la tessera ne dice UNO, e deve essere quello che aggiunge qualcosa. «Movimento
 * in giardino» sotto una persona vera e' la notizia detta peggio. */
export const TIPI_RILEVAMENTO = Object.freeze(["persona", "animale", "veicolo", "movimento"]);

const PAROLE = Object.freeze({
  persona: (locale) => pick("Persona", "Person", locale),
  animale: (locale) => pick("Animale", "Animal", locale),
  veicolo: (locale) => pick("Veicolo", "Vehicle", locale),
  movimento: (locale) => pick("Movimento", "Motion", locale),
});

/* I segni. Emoji e non disegni nostri apposta: questi finiscono nella
 * didascalia della tessera e nel corpo della notifica, che sono testo puro —
 * un disegno li' non entra, e infilarcelo vorrebbe dire stampare il nome di un
 * file invece di vederlo. */
const SEGNI = Object.freeze({
  persona: "\u{1F464}",
  animale: "\u{1F43E}",
  veicolo: "\u{1F697}",
  movimento: "\u{1F441}\u{FE0F}",
});

/** La parola di un tipo, nella lingua della plancia. */
export function parolaDelTipo(tipo, locale = "it") {
  return (PAROLE[minuscolo(tipo)] || PAROLE.movimento)(locale);
}

/** Il segno di un tipo. */
export function segnoDelTipo(tipo) {
  return SEGNI[minuscolo(tipo)] || SEGNI.movimento;
}

/* Come si riconosce un sensore di rilevamento dal suo nome.
 *
 * Home Assistant per questi non ha una `device_class` che li distingua: Reolink
 * li pubblica tutti come `motion` o `occupancy`, quindi «persona» e «veicolo»
 * sono la stessa classe e solo il nome li separa. Si guardano le parole che le
 * integrazioni usano davvero, in italiano e in inglese, e si prende la PRIMA
 * che risponde nell'ordine di gravita': un `binary_sensor.ingresso_person_motion`
 * e' una persona, non un movimento generico.
 *
 * Un nome che non dice niente resta `""`: meglio non classificarlo che
 * chiamarlo «movimento» e far scattare un avviso per la temperatura del
 * sensore. */
const FORME = Object.freeze([
  ["persona", /(^|[._\s-])(person|persone|persona|people|human|pedestri)/i],
  ["animale", /(^|[._\s-])(pet|pets|animal|animale|animali|dog|cat|cane|gatto)/i],
  ["veicolo", /(^|[._\s-])(vehicle|veicolo|veicoli|car|auto|automobile|truck|bike|motorcycle)/i],
  ["movimento", /(^|[._\s-])(motion|movimento|moviment|occupancy|presence|presenza)/i],
]);

/** Che tipo di rilevamento e' questo sensore, o `""` se non lo e'. */
export function tipoDelSensore(entity, stato = null) {
  const id = pulito(entity);
  if (!id.startsWith("binary_sensor.")) return "";
  const nome = `${id} ${pulito(stato?.attributes?.friendly_name)}`;
  for (const [tipo, forma] of FORME) if (forma.test(nome)) return tipo;
  /* Il nome non dice niente, ma la classe dice che e' un rilevatore: allora
   * e' movimento, che e' il tipo generico. Senza nemmeno quella, non lo e'. */
  const classe = minuscolo(stato?.attributes?.device_class);
  return classe === "motion" || classe === "occupancy" ? "movimento" : "";
}

/**
 * I sensori di rilevamento che stanno sullo stesso apparecchio di una
 * telecamera, per tipo.
 *
 * La telecamera e' `camera.ingresso`, i suoi sensori sono
 * `binary_sensor.ingresso_person` e compagnia: stessa radice, che e' come
 * Reolink, Frigate, Unifi e le altre li chiamano. Si cerca per radice e non
 * per apparecchio perche' la radice sta negli stati, che la plancia ha gia',
 * mentre l'apparecchio va chiesto al registro — una domanda in piu' per una
 * risposta che quasi sempre e' la stessa.
 *
 * Chi ha nomi che non si somigliano li scrive a mano: e' la ragione per cui la
 * scheda ha quattro caselle e non un interruttore.
 */
export function sensoriDellaTelecamera(camera, states = {}) {
  const id = pulito(camera);
  const radice = id.includes(".") ? id.split(".")[1] : id;
  if (!radice) return {};
  const trovati = {};
  for (const [entity, stato] of Object.entries(states || {})) {
    if (!entity.startsWith("binary_sensor.")) continue;
    const suo = entity.split(".")[1] || "";
    if (!suo.startsWith(radice)) continue;
    const tipo = tipoDelSensore(entity, stato);
    /* Il primo che risponde per ogni tipo: due sensori dello stesso tipo sulla
     * stessa telecamera sono la stessa notizia detta due volte. */
    if (tipo && !trovati[tipo]) trovati[tipo] = entity;
  }
  return trovati;
}

/** La configurazione ripulita: per ogni telecamera, un'entita' per tipo. */
export function normalizzaRilevamenti(stored) {
  const grezzo = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  const pulita = {};
  for (const [camera, voci] of Object.entries(grezzo)) {
    const id = pulito(camera);
    if (!id.includes(".")) continue;
    const sua = {};
    for (const tipo of TIPI_RILEVAMENTO) {
      const entity = pulito(voci?.[tipo]);
      if (entity.includes(".")) sua[tipo] = entity;
    }
    if (Object.keys(sua).length) pulita[id] = sua;
  }
  return pulita;
}

/* Se un sensore sta dicendo di si' adesso. `unavailable` e `unknown` non sono
 * un no: sono un sensore che non risponde, e un avviso che si accende perche'
 * un sensore tace e' il peggiore dei falsi allarmi. */
function acceso(stato) {
  return minuscolo(stato?.state) === "on";
}

/* Quando questo sensore e' diventato cosi'. Dopo un riavvio di Home Assistant
 * `last_changed` riparte dall'istante del riavvio: e' una proprieta' di Home
 * Assistant, non nostra, e qui si riporta quello che dice. */
function istante(stato) {
  const quando = Date.parse(pulito(stato?.last_changed) || pulito(stato?.last_updated) || "");
  return Number.isFinite(quando) ? quando : null;
}

/**
 * Cosa sta vedendo la casa adesso, una riga per rilevamento acceso.
 *
 * `telecamere` serve solo per i nomi: senza, una riga direbbe
 * `camera.ingresso_sub` a chi quella telecamera l'ha chiamata «Ingresso».
 *
 * L'ordine e' per gravita' e poi per quanto e' recente: la prima riga e' quella
 * che la tessera racconta, e deve essere la piu' importante fra le piu' fresche.
 */
export function rilevamentiAccesi(config, states = {}, telecamere = [], locale = "it") {
  const scelte = normalizzaRilevamenti(config);
  const nomi = new Map(
    (Array.isArray(telecamere) ? telecamere : [])
      .map((camera) => [pulito(camera?.entity), pulito(camera?.name)])
      .filter(([entity]) => entity),
  );
  const righe = [];
  for (const [camera, voci] of Object.entries(scelte)) {
    for (const tipo of TIPI_RILEVAMENTO) {
      const entity = voci[tipo];
      if (!entity) continue;
      const stato = states?.[entity];
      if (!acceso(stato)) continue;
      righe.push({
        camera,
        nome: nomi.get(camera) || camera,
        tipo,
        parola: parolaDelTipo(tipo, locale),
        segno: segnoDelTipo(tipo),
        entity,
        quando: istante(stato),
      });
    }
  }
  righe.sort((uno, altro) => {
    const gravita = TIPI_RILEVAMENTO.indexOf(uno.tipo) - TIPI_RILEVAMENTO.indexOf(altro.tipo);
    if (gravita) return gravita;
    return (altro.quando || 0) - (uno.quando || 0);
  });
  return righe;
}

/** Tutte le entita' sorvegliate, per chi deve sapere cosa guardare. */
export function entitaSorvegliate(config) {
  const scelte = normalizzaRilevamenti(config);
  const tutte = [];
  for (const voci of Object.values(scelte))
    for (const tipo of TIPI_RILEVAMENTO) if (voci[tipo]) tutte.push(voci[tipo]);
  return [...new Set(tutte)];
}

/* ── l'automazione per il telefono ───────────────────────────────────────── */

/* «E in contemporanea arriva una notifica da home assistant.»
 *
 * Questa la scrive Home Assistant, non la plancia — ma scriverla a mano, con
 * sei entita' e un allegato, e' la parte in cui ci si arrende. Qui esce gia'
 * fatta, con dentro le entita' che sono state scelte: si copia e si incolla in
 * `automations.yaml`, oppure in Impostazioni → Automazioni → ⋮ → «Modifica in
 * YAML».
 *
 * L'allegato e' il fotogramma della telecamera che ha visto: `entity_id` sotto
 * `data.image`, che l'app risolve da se' chiedendolo a Home Assistant. Un
 * indirizzo scritto a mano non funzionerebbe da fuori casa, ed e' proprio
 * quando si e' fuori che una notifica serve.
 *
 * Niente `${}` che compongano parole tradotte: qui si scrive YAML, che e'
 * uguale in tutte le lingue. Le sole parole che cambiano sono i commenti in
 * cima, e quelle arrivano gia' scelte da chi chiama.
 */

/* Il testo di un nodo YAML, con gli apici quando servono: un nome con i due
 * punti dentro spezza il documento, e «Ingresso: cancello» e' un nome
 * normale. */
function testoYaml(valore) {
  const testo = pulito(valore);
  if (!testo) return '""';
  if (/^[\w .\-/]+$/.test(testo) && !/^\d/.test(testo)) return testo;
  return `"${testo.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

/**
 * L'automazione di Home Assistant che manda il push, scritta per intero.
 *
 * @param {object} config la configurazione dei rilevamenti
 * @param {object} opzioni `{ telecamere, servizio, titolo, locale }`
 * @returns {string} il documento YAML, o "" se non c'e' niente da sorvegliare
 */
export function automazioneDiHomeAssistant(config, opzioni = {}) {
  const scelte = normalizzaRilevamenti(config);
  const camere = Object.keys(scelte);
  if (!camere.length) return "";
  const locale = opzioni.locale || "it";
  const servizio = pulito(opzioni.servizio) || "notify.mobile_app_telefono";
  const nomi = new Map(
    (Array.isArray(opzioni.telecamere) ? opzioni.telecamere : [])
      .map((camera) => [pulito(camera?.entity), pulito(camera?.name)])
      .filter(([entity]) => entity),
  );
  const righe = [];
  righe.push(
    `# ${pick(
      "Rilevamenti delle telecamere: una notifica sul telefono, con il fotogramma.",
      "Camera detections: a phone notification, with the frame.",
      locale,
    )}`,
  );
  righe.push(
    `# ${pick(
      "Scritta da DashboardModern con le entità che hai scelto.",
      "Written by DashboardModern with the entities you picked.",
      locale,
    )}`,
  );
  righe.push(
    `# ${pick(
      "Sostituisci il servizio qui sotto con quello del tuo telefono.",
      "Replace the service below with your phone's.",
      locale,
    )}`,
  );
  righe.push("- alias: " + testoYaml(pick("Rilevamenti telecamere", "Camera detections", locale)));
  righe.push("  mode: parallel");
  righe.push("  max: 10");
  righe.push("  triggers:");
  for (const camera of camere) {
    for (const tipo of TIPI_RILEVAMENTO) {
      const entity = scelte[camera][tipo];
      if (!entity) continue;
      righe.push(`    - trigger: state`);
      righe.push(`      entity_id: ${entity}`);
      righe.push(`      to: "on"`);
      righe.push(`      id: ${camera}|${tipo}`);
    }
  }
  righe.push("  actions:");
  righe.push("    - choose:");
  for (const camera of camere) {
    const nome = nomi.get(camera) || camera;
    for (const tipo of TIPI_RILEVAMENTO) {
      if (!scelte[camera][tipo]) continue;
      righe.push(`        - conditions:`);
      righe.push(`            - condition: trigger`);
      righe.push(`              id: ${camera}|${tipo}`);
      righe.push(`          sequence:`);
      righe.push(`            - action: ${servizio}`);
      righe.push(`              data:`);
      righe.push(`                title: ${testoYaml(nome)}`);
      righe.push(
        `                message: ${testoYaml(`${segnoDelTipo(tipo)} ${parolaDelTipo(tipo, locale)}`)}`,
      );
      righe.push(`                data:`);
      /* Il fotogramma: l'app lo chiede a Home Assistant per entita', cosi'
       * arriva anche da fuori casa — che e' quando una notifica serve. */
      righe.push(`                  image: /api/camera_proxy/${camera}`);
      righe.push(`                  tag: ${camera}`);
    }
  }
  return `${righe.join("\n")}\n`;
}
