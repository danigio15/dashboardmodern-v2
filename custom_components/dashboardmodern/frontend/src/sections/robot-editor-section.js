/* La configurazione del robot aspirapolvere.
 *
 * La scheda non esiste nel documento vendorizzato: si aggiunge qui, accanto
 * alle altre, e si comporta come le altre — l'interruttore verde della
 * sezione in cima, l'elenco di cio' che c'e', un unico salvataggio in fondo.
 *
 * La stanza si sceglie da una tendina, non si scrive: era una casella di
 * testo, e chi scriveva «salone» dove la stanza si chiama «Salone» vedeva il
 * robot sparire dalla sezione Stanze senza che nessuno dicesse perche'.
 *
 * Un robot chiede una entita' sua — un `vacuum` per gli aspirapolvere, un
 * `lawn_mower` per i tagliaerba — e poi tre elenchi di entita' che gli stanno
 * accanto: le mappe, i comandi in piu' e le altre letture. Le mappe non hanno
 * un tipo loro: chi ce l'ha le pubblica come telecamere o come immagini, ed e'
 * per questo che il campo accetta tutte e due invece di pretenderne una; e
 * sono un elenco perche' un robot che gira su due piani ne disegna due (#468).
 * La batteria e' un campo a se', facoltativo: molti tagliaerba la espongono
 * come sensore a parte, e chi lo indica la vede al posto di quella (spesso
 * assente) dell'entita' del robot.
 */
import {
  ESITI_ELENCO,
  bindRobotToDevice,
  conLaVoce,
  elencoMappe,
  mappeSuggerite,
  normalizeRobots,
  robotSpecies,
  tettoDellElenco,
} from "../core/robot-model.js";
import {
  comandiVicini,
  elencoComandi,
  genereDelComando,
} from "../core/comandi-accanto.js";
import { nomeAccantoAlDispositivo } from "../core/nome-accanto-al-dispositivo.js";
import { elencoLetture, lettureVicine } from "../core/letture-accanto.js";
import { apriMenuIntegrazioni } from "./appliance-integration-section.js";
import {
  allStates,
  clean,
  dashboardStore,
  doc,
  esc,
  installStyle,
  onEditorRedraw,
  readJson,
  root,
  roomOptionsMarkup,
  t,
  wrapFunction,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_ROBOT_EDITOR__";
const state = (root[KEY] ||= { installed: false, aperto: -1 });

export const ROBOT_EDITOR_TAB = "robot";

function lista() {
  const store = dashboardStore();
  const canonical = store?.getSection ? store.getSection("robots") : null;
  if (Array.isArray(canonical) && canonical.length) return normalizeRobots(canonical);
  return normalizeRobots(readJson("cd_robot", []));
}

async function salva(robots) {
  const valore = normalizeRobots(robots);
  const store = dashboardStore();
  if (store?.replaceSection) {
    try {
      await store.replaceSection("robots", valore);
      return;
    } catch (error) {
      root.console?.warn?.("[DashboardModern] robot save", error);
    }
  }
  writeJsonIfChanged("cd_robot", valore);
}

function activeTab() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

function nomeDi(robot, index) {
  return clean(robot.name) || clean(robot.entity) || `${t("Robot", "Robot")} ${index + 1}`;
}

function campo(id, label, value, placeholder, hint) {
  return `<label class="ed-slot dm-robot-field"><span class="ed-slot-lbl">${esc(label)}</span>
    <span class="ed-form-row"><input id="${esc(id)}" class="ed-input mono" data-robot-field="${esc(id.split("-").at(-1))}" value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="off" spellcheck="false"><button type="button" class="dm-robot-pick" data-robot-pick="${esc(id)}" aria-label="${t("Scegli entità", "Choose entity")}">🔍</button></span>
    ${hint ? `<small>${esc(hint)}</small>` : ""}</label>`;
}

/* Le tre liste che un robot si porta dietro: comandi, mappe, letture.
 *
 * I comandi a parte (#306): «Le varie entita' del robot continuano a non
 * essere visibili: da solo la modalita' aspirazione. Comandi mancanti:
 * button.roborock_..._asp_e_lav, ..._pulizia_completa…» Le mappe (#468): «Io
 * ho due mappe e mi visualizza solo una.» Le altre letture (#468): «Sarebbe
 * possibile aggiungere piu' valori tra quelli che mostra?»
 *
 * Tre richieste diverse, un gesto solo: un elenco di entita' che stanno
 * accanto al robot, quelle vicine proposte da sole con un tocco per
 * aggiungerle, la lente per qualunque altra, la croce per toglierne una. Si
 * scrive una volta e si usa tre volte: tre copie vorrebbero dire tre posti
 * dove il tetto torna a essere muto, che e' il difetto gia' corretto una
 * volta (#403).
 */
const LISTE = Object.freeze({
  comandi: {
    elenco: elencoComandi,
    suggerite: comandiVicini,
    genere: genereDelComando,
    segnaposto: "button.robot_pulizia_completa",
  },
  mappe: {
    elenco: elencoMappe,
    suggerite: mappeSuggerite,
    genere: () => "mappa",
    segnaposto: "image.robot_mappa",
  },
  letture: {
    elenco: elencoLetture,
    suggerite: lettureVicine,
    genere: () => "lettura",
    segnaposto: "sensor.robot_durata_filtro",
  },
});

/* Le parole di ogni lista: cosa c'e' scritto sopra, cosa si legge quando e'
 * vuota, cosa si spiega sotto. Stanno insieme perche' vanno lette insieme. */
function paroleDellaLista(tipo) {
  if (tipo === "mappe")
    return {
      etichetta: t("Mappe", "Maps"),
      vuoto: t(
        "Nessuna mappa: la scheda mostra stato, batteria e comandi.",
        "No map: the card shows state, battery and controls.",
      ),
      invito: t(
        "Trovate accanto al robot — un tocco le aggiunge:",
        "Found next to the robot — one tap adds them:",
      ),
      aiuto: t(
        "La mappa arriva da una telecamera o da un'immagine: camera.* o image.*. Un robot che gira su due piani ne pubblica una per piano: aggiungile tutte e sulla scheda compaiono le linguette per passare dall'una all'altra.",
        "The map comes from a camera or an image: camera.* or image.*. A robot working on two floors publishes one map per floor: add them all and the card shows tabs to switch between them.",
      ),
    };
  if (tipo === "letture")
    return {
      etichetta: t("Altre letture", "Other readings"),
      vuoto: t(
        "Nessuna lettura in più: la scheda dice stato e batteria.",
        "No extra reading: the card shows state and battery.",
      ),
      invito: t(
        "Trovate accanto al robot — un tocco le aggiunge:",
        "Found next to the robot — one tap adds them:",
      ),
      aiuto: t(
        "I sensori che il robot pubblica accanto a sé — durata del filtro, spazzola principale e laterale, area pulita, pulizie fatte: entità sensor.*, binary_sensor.*, number.*. Compaiono sulla scheda sotto i comandi, col loro nome e la loro unità, nell'ordine in cui le aggiungi.",
        "The sensors the robot publishes next to itself — filter life, main and side brush, area cleaned, cleaning count: sensor.*, binary_sensor.*, number.* entities. They appear on the card under the controls, with their own name and unit, in the order you add them.",
      ),
    };
  return {
    etichetta: t("Altri comandi del robot", "Other robot commands"),
    vuoto: t(
      "Nessun comando in più: la scheda ha quelli del robot e basta.",
      "No extra command: the card carries the robot's own and nothing else.",
    ),
    invito: t(
      "Trovati accanto al robot — un tocco li aggiunge:",
      "Found next to the robot — one tap adds them:",
    ),
    aiuto: t(
      "I programmi e le regolazioni che l'integrazione pubblica a parte — pulizia completa, solo lavaggio, modalità del mocio…: entità button.*, select.*, switch.* (e input_*, script.*, scene.*). Compaiono sulla scheda del robot nell'ordine in cui li aggiungi: le tendine accanto all'aspirazione, i tasti sotto i comandi.",
      "The programs and settings the integration publishes separately — full clean, mop only, mop mode…: button.*, select.*, switch.* entities (plus input_*, script.*, scene.*). They appear on the robot card in the order you add them: dropdowns next to suction, buttons under the controls.",
    ),
  };
}

/* Una pastiglia: il nome dell'entita' senza il nome del robot davanti, e il
 * segno di cosa fa toccarla — il piu' aggiunge, la croce toglie. */
function chipMarkup(entity, tipo, azione, segno, robot, states) {
  return `<button type="button" class="dm-robot-chip" data-robot-chip-${esc(azione)}="${esc(entity)}" data-robot-chip-tipo="${esc(tipo)}" data-genere="${esc(LISTE[tipo].genere(entity))}" title="${esc(entity)}"><span>${esc(nomeAccantoAlDispositivo(entity, robot, states))}</span><i aria-hidden="true">${segno}</i></button>`;
}

/* Perche' una voce non e' entrata. Tre motivi, tre frasi (#403).
 *
 * La piu' importante e' la terza: prima non c'era, e il tocco spariva. */
function spiegazione(esito, tipo) {
  if (esito === ESITI_ELENCO.gia)
    return tipo === "mappe"
      ? t("Questa mappa c'è già.", "That map is already there.")
      : tipo === "letture"
        ? t("Questa lettura c'è già.", "That reading is already there.")
        : t("Questo comando c'è già.", "That command is already there.");
  if (esito === ESITI_ELENCO.pieno)
    return tipo === "mappe"
      ? t(
          "La scheda tiene quattro mappe, e ci sono tutte: togline una per farci stare questa.",
          "The card holds four maps and they are all taken: remove one to make room.",
        )
      : tipo === "letture"
        ? t(
            "La scheda tiene dieci letture, e ci sono tutte: togline una per farci stare questa.",
            "The card holds ten readings and they are all taken: remove one to make room.",
          )
        : t(
            "La scheda tiene dodici comandi, e ci sono tutti: togline uno per farci stare questo. Un robot arrivato da un'integrazione parte spesso già pieno di quelli che pubblica lei.",
            "The card holds twelve commands and they are all taken: remove one to make room. A robot that came from an integration often starts out full of the ones it publishes.",
          );
  if (tipo === "mappe")
    return t(
      "Serve un'entità camera.* o image.*.",
      "A camera.* or image.* entity is required.",
    );
  if (tipo === "letture")
    return t(
      "Serve un'entità sensor.*, binary_sensor.* o number.* — oppure input_number, input_text.",
      "A sensor.*, binary_sensor.* or number.* entity is required — or input_number, input_text.",
    );
  return t(
    "Serve un'entità button.*, select.* o switch.* — oppure input_button, input_select, input_boolean, script, scene.",
    "A button.*, select.* or switch.* entity is required — or input_button, input_select, input_boolean, script, scene.",
  );
}

function listaMarkup(tipo, robot, index) {
  const states = allStates();
  const regola = LISTE[tipo];
  const parole = paroleDellaLista(tipo);
  const tetto = tettoDellElenco(tipo);
  const scelte = regola.elenco(robot[tipo]);
  const proposte = regola.suggerite(robot, states).slice(0, 24);
  return `<div class="ed-slot dm-robot-field dm-robot-lista" data-robot-lista="${esc(tipo)}">
    <span class="ed-slot-lbl">${esc(parole.etichetta)} <b class="dm-robot-quanti"${scelte.length >= tetto ? ' data-pieno="true"' : ""}>${esc(String(scelte.length))}/${esc(String(tetto))}</b></span>
    <input type="hidden" data-robot-field="${esc(tipo)}" value="${esc(scelte.join(","))}">
    <div class="dm-robot-chips" data-robot-chips-scelti>${
      scelte.length
        ? scelte.map((entity) => chipMarkup(entity, tipo, "del", "✕", robot, states)).join("")
        : `<small class="dm-robot-chips-vuoto">${esc(parole.vuoto)}</small>`
    }</div>
    <span class="ed-form-row"><input id="dm-robot-${index}-${esc(tipo)}" class="ed-input mono" data-robot-chip-nuovo placeholder="${esc(regola.segnaposto)}" autocomplete="off" spellcheck="false"><button type="button" class="dm-robot-pick" data-robot-pick="dm-robot-${index}-${esc(tipo)}" aria-label="${t("Scegli entità", "Choose entity")}">🔍</button><button type="button" class="dm-robot-pick dm-robot-aggiungi" data-robot-chip-add="${esc(tipo)}" aria-label="${t("Aggiungi", "Add")}" title="${t("Aggiungi", "Add")}">＋</button></span>
    ${
      proposte.length
        ? `<small>${esc(parole.invito)}</small>
    <div class="dm-robot-chips dm-robot-proposte" data-robot-chips-proposti>${proposte.map((entity) => chipMarkup(entity, tipo, "sug", "＋", robot, states)).join("")}</div>`
        : ""
    }
    <small>${esc(parole.aiuto)}</small>
  </div>`;
}

function rigaMarkup(robot, index) {
  const aperto = state.aperto === index;
  /* L'icona della riga dice la specie: chi ha un aspirapolvere e un tagliaerba
   * li distingue dall'elenco, senza aprire le righe. */
  const icona = robotSpecies(robot.entity) === "lawn_mower" ? "🌱" : "🤖";
  return `<article class="ed-row dm-robot-row" data-robot-index="${index}" data-open="${aperto}">
    <div class="dm-robot-row-head">
      <span class="dm-robot-row-icon" aria-hidden="true">${icona}</span>
      <span class="ed-row-main"><strong class="ed-row-new">${esc(nomeDi(robot, index))}</strong><small class="ed-row-old mono">${esc(clean(robot.entity) || t("nessuna entità", "no entity"))}</small></span>
      <button type="button" class="ed-del dm-robot-edit" data-robot-edit aria-label="${t("Modifica", "Edit")}">✏️</button>
      <button type="button" class="ed-del dm-robot-del" data-robot-del aria-label="${t("Elimina", "Remove")}">🗑️</button>
    </div>
    <div class="dm-robot-row-body"${aperto ? "" : " hidden"}>
      <label class="ed-slot dm-robot-field"><span class="ed-slot-lbl">${t("Nome", "Name")}</span><span class="ed-form-row"><input id="dm-robot-${index}-name" class="ed-input" data-robot-field="name" value="${esc(clean(robot.name))}" placeholder="${t("Robot del piano terra", "Ground floor robot")}"></span></label>
      ${campo(`dm-robot-${index}-entity`, t("Entità del robot", "Robot entity"), robot.entity, "vacuum.robot", t("È l'entità vacuum.* (aspirapolvere) o lawn_mower.* (tagliaerba) che Home Assistant espone per il robot.", "The vacuum.* (vacuum) or lawn_mower.* (lawn mower) entity Home Assistant exposes for the robot."))}
      ${listaMarkup("mappe", robot, index)}
      ${campo(`dm-robot-${index}-battery`, t("Batteria", "Battery"), robot.battery, "sensor.robot_batteria", t("Facoltativa: il sensore che dice la carica, se il robot la pubblica a parte — capita spesso coi tagliaerba. Se indicata, vince sulla batteria dell'entità del robot.", "Optional: the sensor reporting the charge, when the robot publishes it separately — common with lawn mowers. When set, it wins over the robot entity's own battery."))}
      ${listaMarkup("comandi", robot, index)}
      ${listaMarkup("letture", robot, index)}
      <label class="ed-slot dm-robot-field"><span class="ed-slot-lbl">${t("Stanza", "Room")}</span><span class="ed-form-row"><select id="dm-robot-${index}-room" class="ed-input" data-robot-field="room">${roomOptionsMarkup(clean(robot.room), t("Nessuna stanza", "No room"))}</select></span></label>
      <output class="dm-robot-error" data-robot-error></output>
      <button type="button" class="ed-save-btn" data-robot-save>💾 ${t("Salva robot", "Save robot")}</button>
    </div>
  </article>`;
}

function bodyMarkup(robots) {
  const banner = (() => {
    try {
      return root.cdSecToggleHtml?.("robot") || "";
    } catch (_error) {
      return "";
    }
  })();
  return `${banner}
    <div class="ed-intro">${t(
      "I robot di casa — aspirapolvere e tagliaerba: stato, batteria, comandi e mappa. Ogni robot ha la sua scheda nella sezione Robot.",
      "The home robots — vacuums and lawn mowers: state, battery, controls and map. Each robot gets its own card in the Robot section.",
    )}</div>
    <div class="ed-list dm-robot-list">${
      robots.length
        ? robots.map((robot, index) => rigaMarkup(robot, index)).join("")
        : `<div class="ed-empty">${t("Nessun robot configurato", "No robot configured")}</div>`
    }</div>
    <div class="dm-robot-invito">
      <button type="button" class="ed-btn-add dm-robot-integ" data-robot-integ>🔗 ${t("Aggiungi da un'integrazione", "Add from an integration")}</button>
      <small>${t(
        "Roborock, Dreame, Ecovacs, Husqvarna… scegli il dispositivo e il robot arriva già fatto: la sua entità, le sue mappe, la batteria, i suoi programmi e le sue letture. Oppure, qui sotto, una casella alla volta.",
        "Roborock, Dreame, Ecovacs, Husqvarna… pick the device and the robot arrives ready-made: its entity, its maps, the battery, its programs and its readings. Or, below, one field at a time.",
      )}</small>
    </div>
    <button type="button" class="ed-btn-add" data-robot-add>＋ ${t("Aggiungi robot", "Add robot")}</button>`;
}

function leggiRiga(riga, robot) {
  const next = { ...robot };
  for (const input of riga.querySelectorAll("[data-robot-field]"))
    next[clean(input.dataset.robotField)] = clean(input.value);
  return next;
}

/* Cosa il dispositivo ha lasciato capire, prima di confermare.
 *
 * La finestra delle integrazioni e' la stessa degli elettrodomestici — le
 * integrazioni, i dispositivi, la ricerca sono uguali per chiunque colleghi
 * qualcosa — e questo e' l'unico pezzo che sa di robot. */
function anteprimaRobot({ device, entities }) {
  const robot = bindRobotToDevice({ device, entities, states: allStates() });
  const riga = (etichetta, valore) =>
    `<div class="dm-integ-casella"><span>${esc(etichetta)}</span><b class="mono">${esc(valore) || "—"}</b></div>`;
  const comandi = elencoComandi(robot.comandi);
  const mappe = elencoMappe(robot.mappe);
  const letture = elencoLetture(robot.letture);
  return {
    etichetta:
      robotSpecies(robot.entity) === "lawn_mower"
        ? t("Tagliaerba", "Lawn mower")
        : t("Aspirapolvere", "Vacuum"),
    corpo: `<div class="dm-integ-caselle">
        ${riga(t("Entità del robot", "Robot entity"), robot.entity)}
        ${riga(t("Mappe", "Maps"), mappe.join(", "))}
        ${riga(t("Batteria", "Battery"), robot.battery)}
        ${riga(
          t("Programmi e regolazioni", "Programs and settings"),
          comandi.length
            ? `${comandi.length} — ${comandi.map((voce) => nomeAccantoAlDispositivo(voce, robot, allStates())).join(", ")}`
            : "",
        )}
        ${riga(
          t("Altre letture", "Other readings"),
          letture.length
            ? `${letture.length} — ${letture.map((voce) => nomeAccantoAlDispositivo(voce, robot, allStates())).join(", ")}`
            : "",
        )}
      </div>`,
  };
}

/* Il robot nuovo, nato dal dispositivo scelto: si salva e si apre, cosi' chi
 * l'ha appena creato vede subito cosa gli e' stato assegnato. */
async function creaDaDispositivo({ device, entities, integration }) {
  const robots = lista();
  const nato = bindRobotToDevice({
    device,
    entities,
    states: allStates(),
    index: robots.length,
  });
  /* La stanza la sa gia' Home Assistant: se l'area del dispositivo ha lo
   * stesso nome di una stanza configurata, il robot ci va dentro da solo. */
  const stanze = readJson("cd_stanze", []);
  const area = clean(device?.area);
  const stanza = (Array.isArray(stanze) ? stanze : []).find(
    (voce) => clean(voce?.name).toLowerCase() === area.toLowerCase(),
  );
  if (stanza) nato.room = clean(stanza.id) || clean(stanza.name);
  /* Un dispositivo che robot non e' non diventa un robot.
   *
   * La finestra delle integrazioni mostra TUTTI i dispositivi — e' la stessa
   * degli elettrodomestici — quindi da li' puo' arrivare un termostato. Senza
   * un `vacuum.*` o un `lawn_mower.*` il legame esce senza entita', e la riga
   * si salvava lo stesso: il messaggio diceva «aggiunto», la scheda mostrava
   * una riga vuota e in pagina non compariva niente, perche' chi disegna una
   * riga senza entita' la salta. Meglio dirlo subito e lasciare la finestra
   * aperta su un altro dispositivo. */
  if (!clean(nato.entity)) {
    root.alert?.(
      t(
        "Da questo dispositivo non si riconosce nessun robot: serve un'entità vacuum.* o lawn_mower.*.",
        "No robot can be recognised from this device: a vacuum.* or lawn_mower.* entity is needed.",
      ),
    );
    return;
  }
  state.aperto = robots.length;
  await salva([...robots, nato]);
  ridisegna();
  const daChi = clean(integration?.name) || t("un'integrazione", "an integration");
  root.edToast?.(`${nato.name || device.name} — ${t("aggiunto da", "added from")} ${daChi}`);
}

export function ensureRobotEditor() {
  const body = doc?.getElementById("ed-body");
  if (!body || activeTab() !== ROBOT_EDITOR_TAB) return false;
  const robots = lista();
  /* La fascia della visibilita' fa parte della scheda.
   *
   * La firma diceva solo quali robot ci sono: toccando «Sezione visibile in
   * dashboard» la preferenza cambiava davvero, ma qui non era cambiato niente
   * da ridisegnare e la fascia restava verde. Per vederla diventare grigia
   * bisognava uscire dalla linguetta e rientrarci — cioe' proprio il «non si
   * vede in tempo reale» che e' stato segnalato. */
  const nascosta = (() => {
    try {
      return root.cdCfg?.("cd_sections")?.robot === false;
    } catch (_error) {
      return false;
    }
  })();
  const firma = [
    state.aperto,
    nascosta,
    ...robots.map(
      (robot) =>
        `${robot.id}~${robot.name}~${robot.entity}~${(robot.comandi || []).join(",")}~${(robot.mappe || []).join(",")}~${(robot.letture || []).join(",")}`,
    ),
  ].join("|");
  if (body.dataset.dmRobotEditor === firma && body.querySelector(".dm-robot-list")) return true;
  body.dataset.dmRobotEditor = firma;
  body.innerHTML = bodyMarkup(robots);
  body.dataset.renderer = "robot";
  return true;
}

async function onClick(event) {
  const body = doc?.getElementById("ed-body");
  if (!body || activeTab() !== ROBOT_EDITOR_TAB || !body.contains(event.target)) return;
  const robots = lista();

  if (event.target.closest("[data-robot-integ]")) {
    event.preventDefault();
    apriMenuIntegrazioni({
      titolo: t("Aggiungi un robot da un'integrazione", "Add a robot from an integration"),
      intro: t(
        "Le integrazioni di Home Assistant, ufficiali o da HACS, con i dispositivi che portano. Scegli il tuo robot: la sua entità, le sue mappe, la batteria, i suoi programmi e le sue letture entrano da soli.",
        "Home Assistant integrations, official or from HACS, with the devices they bring. Pick your robot: its entity, its maps, the battery, its programs and its readings come along by themselves.",
      ),
      anteprima: anteprimaRobot,
      onScelto: (scelta) => creaDaDispositivo(scelta),
    });
    return;
  }
  if (event.target.closest("[data-robot-add]")) {
    event.preventDefault();
    state.aperto = robots.length;
    await salva([...robots, { id: `robot-${robots.length + 1}`, name: "", entity: "" }]);
    ridisegna();
    return;
  }
  const pick = event.target.closest("[data-robot-pick]");
  if (pick) {
    event.preventDefault();
    const input = body.querySelector(`#${CSS.escape(clean(pick.dataset.robotPick))}`);
    if (input) root.wzPickEntity?.(input);
    return;
  }
  const riga = event.target.closest("[data-robot-index]");
  if (!riga) return;
  const index = Number(riga.dataset.robotIndex);
  if (!Number.isFinite(index) || !robots[index]) return;

  if (event.target.closest("[data-robot-edit]")) {
    event.preventDefault();
    state.aperto = state.aperto === index ? -1 : index;
    ridisegna();
    return;
  }
  /* Le tre liste (#306, #468): aggiungere una proposta, aggiungere quella
   * scritta nella casella, toglierne una scelta. Si salva subito — con quello
   * che c'e' scritto nelle altre caselle, cosi' un nome battuto e non ancora
   * salvato non va perso — e la scheda del robot cambia mentre si guarda. */
  const proposta = event.target.closest("[data-robot-chip-sug]");
  const togli = event.target.closest("[data-robot-chip-del]");
  const aggiungi = event.target.closest("[data-robot-chip-add]");
  if (proposta || togli || aggiungi) {
    event.preventDefault();
    const tocco = proposta || togli || aggiungi;
    const tipo = clean(tocco.dataset.robotChipTipo || tocco.dataset.robotChipAdd);
    if (!LISTE[tipo]) return;
    const casella = tocco.closest(`[data-robot-lista="${CSS.escape(tipo)}"]`);
    const letta = leggiRiga(riga, robots[index]);
    /* Un'entita' del robot battuta a meta' non si salva per sbaglio da qui:
     * quella la giudica il tasto «Salva robot», come sempre. */
    if (!/^(?:vacuum|lawn_mower)\.[a-z0-9_]+$/i.test(letta.entity))
      letta.entity = robots[index].entity;
    const errore = riga.querySelector("[data-robot-error]");
    let elenco = LISTE[tipo].elenco(letta[tipo]);
    if (togli) {
      elenco = elenco.filter((entity) => entity !== clean(togli.dataset.robotChipDel));
    } else {
      const nuovo = proposta
        ? clean(proposta.dataset.robotChipSug)
        : clean(casella?.querySelector("[data-robot-chip-nuovo]")?.value);
      /* Il tetto non si scavalca, ma nemmeno si tace (#403): un robot nato
       * dall'integrazione arriva con la riga gia' piena, e chi ci aggiungeva
       * il suo script vedeva sparire il tocco senza una parola. */
      const esito = conLaVoce(elenco, nuovo, tipo);
      if (esito.esito !== ESITI_ELENCO.aggiunto) {
        if (errore) errore.textContent = spiegazione(esito.esito, tipo);
        return;
      }
      elenco = esito.elenco;
    }
    if (errore) errore.textContent = "";
    const next = robots.slice();
    next[index] = { ...letta, [tipo]: elenco };
    await salva(next);
    ridisegna();
    return;
  }
  if (event.target.closest("[data-robot-del]")) {
    event.preventDefault();
    const domanda = t(
      `Elimino "${nomeDi(robots[index], index)}"?`,
      `Remove "${nomeDi(robots[index], index)}"?`,
    );
    if (root.confirm && !root.confirm(domanda)) return;
    state.aperto = -1;
    await salva(robots.filter((_robot, position) => position !== index));
    ridisegna();
    return;
  }
  if (event.target.closest("[data-robot-save]")) {
    event.preventDefault();
    const next = robots.slice();
    next[index] = leggiRiga(riga, robots[index]);
    const errore = riga.querySelector("[data-robot-error]");
    /* Un'entita' che non e' un `vacuum` ne' un `lawn_mower` non e' un robot:
     * salvarla vorrebbe dire una scheda che non risponde a nessun comando,
     * senza dire perche'. */
    if (!/^(?:vacuum|lawn_mower)\.[a-z0-9_]+$/i.test(next[index].entity)) {
      if (errore)
        errore.textContent = t(
          "Serve un'entità vacuum.* o lawn_mower.* valida.",
          "A valid vacuum.* or lawn_mower.* entity is required.",
        );
      return;
    }
    if (errore) errore.textContent = "";
    await salva(next);
    ridisegna();
    root.edToast?.(t("💾 Robot salvato", "💾 Robot saved"));
  }
}

function ridisegna() {
  const body = doc?.getElementById("ed-body");
  if (body) delete body.dataset.dmRobotEditor;
  ensureRobotEditor();
}

/* La voce nella barra della configurazione.
 *
 * Le voci sono scritte nel documento vendorizzato e questa non c'e': si
 * aggiunge accanto alle altre, con lo stesso gestore, cosi' si comporta come
 * loro senza che nessuno debba sapere che e' arrivata dopo. */
export function ensureRobotEditorTab() {
  const tabs = doc?.querySelector(".ed-tab")?.parentElement;
  if (!tabs || tabs.querySelector(`.ed-tab[data-tab="${ROBOT_EDITOR_TAB}"]`)) return false;
  const tab = doc.createElement("button");
  tab.className = "ed-tab";
  tab.dataset.tab = ROBOT_EDITOR_TAB;
  tab.textContent = `🤖 ${t("Robot", "Robots")}`;
  tab.addEventListener("click", () => root.editorSwitch?.(ROBOT_EDITOR_TAB));
  const prima = tabs.querySelector('.ed-tab[data-tab="runtime"]');
  if (prima) prima.before(tab);
  else tabs.append(tab);
  return true;
}

function installStyles() {
  installStyle(
    "dm-robot-editor-style",
    `
      #ed-body .dm-robot-list{display:grid;gap:8px;margin-bottom:10px}
      #ed-body .dm-robot-row{display:block!important;padding:0!important;overflow:hidden}
      #ed-body .dm-robot-row-head{display:flex;align-items:center;gap:10px;padding:10px 12px}
      #ed-body .dm-robot-row-icon{font-size:18px}
      #ed-body .dm-robot-row-body{display:grid;gap:8px;padding:0 12px 12px}
      #ed-body .dm-robot-row-body[hidden]{display:none!important}
      #ed-body .dm-robot-field{display:grid;gap:4px;margin:0}
      #ed-body .dm-robot-invito{display:grid;gap:6px;margin:0 0 12px;padding:12px;border-radius:14px;border:1px dashed color-mix(in srgb,#0ea5e9 45%,transparent);background:color-mix(in srgb,#0ea5e9 7%,transparent)}
      #ed-body .dm-robot-invito .dm-robot-integ{margin:0!important;background:linear-gradient(135deg,#0369a1,#075985)!important;color:#fff!important}
      #ed-body .dm-robot-invito small{font-size:11px;line-height:1.45;color:var(--text-dim,#64748b);font-weight:600}
      .dm-integ-caselle{display:grid;gap:6px;margin:10px 0}
      .dm-integ-casella{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:7px 10px;border-radius:10px;background:color-mix(in srgb,#0ea5e9 6%,transparent)}
      .dm-integ-casella>span{font-size:11px;font-weight:800;letter-spacing:.3px;text-transform:uppercase;color:var(--text-dim,#64748b)}
      .dm-integ-casella>b{min-width:0;font-size:12px;text-align:right;overflow-wrap:anywhere}
      #ed-body .dm-robot-field .ed-form-row{display:flex;gap:8px;min-width:0}
      #ed-body .dm-robot-field .ed-form-row>input{flex:1 1 auto;min-width:0}
      #ed-body .dm-robot-pick{flex:0 0 38px;height:38px;border:none;border-radius:10px;background:linear-gradient(135deg,#0ea5e9,#0369a1);color:#fff;font-size:14px;cursor:pointer}
      #ed-body .dm-robot-error:not(:empty){color:var(--error-color,#dc2626);font-size:12px;font-weight:800}
      /* I comandi a parte (#306): pastiglie, quelle scelte con la croce e
         quelle proposte col piu'; la tendina si riconosce dal bordo tratteggiato. */
      #ed-body .dm-robot-chips{display:flex;flex-wrap:wrap;gap:6px}
      #ed-body .dm-robot-chip{display:inline-flex;align-items:center;gap:6px;max-width:100%;padding:5px 10px;border:1px solid var(--divider-color,#dbe4ee);border-radius:999px;background:var(--card-bg,#fff);font:inherit;font-size:12px;font-weight:800;color:var(--text,#0f172a);cursor:pointer}
      #ed-body .dm-robot-chip>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      #ed-body .dm-robot-chip>i{font-style:normal;opacity:.7}
      #ed-body .dm-robot-chip[data-genere="tendina"]{border-style:dashed}
      #ed-body .dm-robot-proposte .dm-robot-chip{border-color:#0ea5e9;color:#0369a1}
      #ed-body .dm-robot-chips-vuoto{opacity:.75}
      /* Quanti comandi ci stanno ancora, prima di provarci (#403). */
      #ed-body .dm-robot-quanti{margin-left:6px;font-size:10.5px;font-weight:900;opacity:.6;font-variant-numeric:tabular-nums}
      #ed-body .dm-robot-quanti[data-pieno="true"]{opacity:1;color:var(--warning-color,#f59e0b)}
      #ed-body .dm-robot-aggiungi{background:linear-gradient(135deg,#10b981,#047857)}
    `,
  );
}

export function installRobotEditorSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  ensureRobotEditorTab();
  doc.addEventListener("click", onClick);
  onEditorRedraw("__dmRobotEditor", () => {
    root.queueMicrotask?.(() => {
      ensureRobotEditorTab();
      ensureRobotEditor();
    });
  });
  for (const event of ["dashboardmodern:legacy-ready", "dashboardmodern:editor-rendered"])
    root.addEventListener?.(event, () => {
      root.queueMicrotask?.(() => {
        ensureRobotEditorTab();
        ensureRobotEditor();
      });
    });
  ensureRobotEditor();
}
