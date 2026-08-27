/* La casa letta per stanza, invece che per tipo.
 *
 * «Sarebbe carino avere una sezione dove vedere le entita' raggruppate per
 * stanze, tipo una sezione divisa a pagine dove ogni pagina e' una stanza con
 * tutte le entita' della stessa.»
 *
 * Ogni sezione della plancia legge la casa per tipo: tutte le luci, tutte le
 * tapparelle, tutti gli elettrodomestici. E' il verso giusto quando si cerca
 * una cosa, ed e' quello sbagliato quando si sta in una stanza — perche' allora
 * si vuole sapere com'e' messa QUESTA stanza, non dove sta la sua luce
 * nell'elenco di tutte le luci.
 *
 * La pagina gira il verso. Non sposta niente e non riscrive niente: le
 * assegnazioni esistono gia' — luci, clima, tapparelle, elettrodomestici,
 * telecamere, carichi la stanza ce l'hanno addosso — e qui si leggono
 * dall'altro lato. Chi non ha stanza finisce in coda, sotto una pillola sua:
 * non e' un errore da nascondere, e' la sola occasione di accorgersene.
 *
 * Le card non sono nuove dove non serve che lo siano. La luce e' la card della
 * pagina Luci, la stessa: il suo tocco lo raccoglie il gestore di quella
 * sezione, che ascolta su tutto il documento e quindi funziona anche qui. Fare
 * una seconda card per la stessa luce vorrebbe dire mantenerne due.
 */
import { lightCommand, lightView, lightsSignature } from "../core/light-model.js";
import { roomGlyph } from "../core/personalization-catalog.js";
import {
  ROOM_ASSIGN_KEY,
  ROOM_BLOCKS,
  pickRoomPage,
  roomOverviewModel,
  roomSceneEntities,
  roomSceneSummary,
} from "../core/room-overview.js";
import { pageCardMarkup } from "./lights-page-section.js";
import { temperatureEntries } from "./beta25-real-device-fixes-section.js";
import {
  allStates,
  clean,
  doc,
  esc,
  installStyle,
  readJson,
  root,
  section,
  t,
  wrapFunction,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_ROOMS_PAGE__";
const state = (root[KEY] ||= { installed: false, frame: 0, signature: "", room: "" });

export const ROOMS_PAGE_ID = "page-stanze";
export const ROOMS_TAB = "stanze";

/* ─────────────────────────────── il modello ─────────────────────────────── */

const lista = (nome, chiave) => {
  const canonico = section(nome, null);
  if (Array.isArray(canonico) && canonico.length) return canonico;
  const legacy = readJson(chiave, []);
  return Array.isArray(legacy) ? legacy : [];
};

/* Le sorgenti da cui la pagina Stanze legge la casa. Le usa anche
 * l'assegnatore, per sapere chi la stanza ce l'ha gia' per mestiere. */
export function roomSources() {
  const canoniche = section("lights", null);
  return {
    rooms: lista("rooms", "cd_stanze"),
    lights: Array.isArray(canoniche) && canoniche.length ? canoniche : readJson("cd_luci", {}),
    lightRooms: readJson("cd_luci_rooms", {}),
    climate: lista("climate", "cd_clima_units"),
    covers: lista("covers", "cd_tapparelle"),
    appliances: lista("appliances", "cd_appliances"),
    cameras: lista("cameras", "cd_cameras"),
    loads: lista("loads", "cd_loads"),
    robots: lista("robots", "cd_robot"),
    irrigation: section("irrigation", null) || readJson("cd_irrigazione", {}),
    assigned: assignedItems(),
  };
}

export function roomPages() {
  return roomOverviewModel(roomSources());
}

/* Le entita' assegnate a mano a una stanza, da qualunque scheda.
 *
 * La mappa e' `entita' -> stanza` e la scrive l'assegnatore in configurazione.
 * Qui si trasforma in voci con un nome leggibile: quello di Home Assistant se
 * c'e', altrimenti l'entity_id — brutto da leggere ma mai una bugia. */
export function assignedItems(mappa = readJson(ROOM_ASSIGN_KEY, {}), states = allStates()) {
  if (!mappa || typeof mappa !== "object") return [];
  return Object.entries(mappa)
    .map(([entity, room]) => {
      const id = clean(entity);
      const stanza = clean(room);
      if (!id || !stanza) return null;
      return {
        entity: id,
        name: clean(states?.[id]?.attributes?.friendly_name) || id,
        room_id: stanza,
      };
    })
    .filter(Boolean);
}

/* Come si chiama ogni blocco, e con che faccia. Le parole stanno qui e non nel
 * modulo puro, che non sa che lingua si parla. */
const BLOCK_LABELS = Object.freeze({
  clima: ["Clima", "Climate", "❄️"],
  luci: ["Luci", "Lights", "💡"],
  coperture: ["Tapparelle e finestre", "Shutters and windows", "🪟"],
  elettrodomestici: ["Elettrodomestici", "Appliances", "🧺"],
  telecamere: ["Telecamere", "Cameras", "📹"],
  carichi: ["Carichi", "Loads", "🔌"],
  robot: ["Aspirapolvere", "Vacuums", "🤖"],
  irrigazione: ["Irrigazione", "Irrigation", "💧"],
  altro: ["Altro in questa stanza", "Also in this room", "📍"],
});

const nomeBlocco = (blocco) => {
  const voce = BLOCK_LABELS[blocco.key];
  return voce ? t(voce[0], voce[1]) : blocco.key;
};

const iconaBlocco = (blocco) => BLOCK_LABELS[blocco.key]?.[2] || "•";

/* Il nome di una voce, comunque sia stata configurata: quello scelto, quello
 * che dice Home Assistant, e in ultima istanza l'entita' stessa — che e' brutta
 * da leggere ma non e' mai una bugia. */
/* L'entita' che identifica una voce.
 *
 * Quasi tutte ne hanno una che comanda. Una finestra che si apre a mano no: ha
 * il solo sensore del contatto, ed e' quello che la identifica — altrimenti
 * resterebbe una riga senza nome e senza stato. */
function entitaVoce(item) {
  return clean(
    item?.entity ||
      item?.entities?.[0] ||
      item?.contact ||
      item?.contact_entity ||
      item?.tenda ||
      item?.tendaSole ||
      item?.id,
  );
}

function nomeVoce(item, states) {
  const entity = entitaVoce(item);
  return (
    clean(item?.name) || clean(states?.[entity]?.attributes?.friendly_name) || entity || "—"
  );
}

/* Cosa sta facendo, in una parola. La pagina di ogni sezione lo racconta per
 * esteso; qui serve il colpo d'occhio, e per il resto c'e' la sua pagina. */
/* Come si dicono i modi del clima, che Home Assistant manda in inglese secco. */
const MODI_CLIMA = Object.freeze({
  cool: ["Raffredda", "Cooling"],
  heat: ["Riscalda", "Heating"],
  heat_cool: ["Automatico", "Auto"],
  auto: ["Automatico", "Auto"],
  dry: ["Deumidifica", "Drying"],
  fan_only: ["Solo ventola", "Fan only"],
});

/* Cosa sta facendo, in una parola.
 *
 * «Acceso» e' giusto per una presa e sbagliato per una finestra: lo stesso `on`
 * vuol dire due cose diverse, e a distinguerle e' il blocco in cui la voce sta.
 * La pagina di ogni sezione lo racconta per esteso; qui serve il colpo
 * d'occhio, e per il resto c'e' la sua pagina. */
function statoVoce(item, states, blocco = "") {
  const entity = entitaVoce(item);
  const stato = clean(states?.[entity]?.state).toLowerCase();
  if (!entity) return "";
  if (!stato || stato === "unavailable" || stato === "unknown")
    return t("Non disponibile", "Unavailable");
  if (blocco === "coperture") {
    if (stato === "on" || stato === "open") return t("Aperta", "Open");
    if (stato === "off" || stato === "closed") return t("Chiusa", "Closed");
    if (stato === "opening") return t("In apertura", "Opening");
    if (stato === "closing") return t("In chiusura", "Closing");
  }
  const modo = MODI_CLIMA[stato];
  if (blocco === "clima" && modo) return t(modo[0], modo[1]);
  if (stato === "on") return t("Acceso", "On");
  if (stato === "off") return t("Spento", "Off");
  if (stato === "open") return t("Aperta", "Open");
  if (stato === "closed") return t("Chiusa", "Closed");
  return stato;
}

/* ──────────────────────────── la pagina e la voce ───────────────────────── */

function lastPage() {
  const pages = doc?.querySelectorAll?.(".page");
  return pages?.length ? pages[pages.length - 1] : null;
}

export function ensureRoomsPage() {
  if (!doc) return null;
  let page = doc.getElementById(ROOMS_PAGE_ID);
  if (page) return page;
  const sorella = lastPage();
  if (!sorella?.parentElement) return null;
  page = doc.createElement("section");
  page.className = "page";
  page.id = ROOMS_PAGE_ID;
  page.innerHTML = '<div class="dm-stanze-wrap" id="stanze-wrap"></div>';
  sorella.after(page);
  return page;
}

export function ensureRoomsTab() {
  if (!doc) return null;
  let tab = doc.querySelector(`.tab[data-tab="${ROOMS_TAB}"]`);
  if (tab) return tab;
  const nav = doc.querySelector("nav.tabs");
  if (!nav) return null;
  /* La voce nasce accanto a Temperature: e' la sezione che gia' si legge per
   * stanza, ed e' li' che uno la va a cercare. */
  const before =
    nav.querySelector('.tab[data-tab="temp"]') ||
    nav.querySelector('.tab[data-tab="tapparelle"]') ||
    nav.querySelector('.tab[data-tab="config"]');
  tab = doc.createElement("button");
  tab.className = "tab";
  tab.dataset.tab = ROOMS_TAB;
  tab.id = `tab-${ROOMS_TAB}`;
  /* La porta, non la casa: nella barra la casa e' Home, e due case vicine
   * sono due voci che si somigliano troppo per distinguerle al volo. La porta
   * e' la stessa che la sezione porta gia' in configurazione. */
  tab.innerHTML = `<span class="icon">🚪</span><span class="text">${esc(t("Stanze", "Rooms"))}</span>`;
  /* Il gestore che il runtime lega alle voci lo lega una volta sola, al
   * caricamento: questa arriva dopo, e il suo tocco se lo deve gestire da se'. */
  tab.addEventListener("click", () => {
    for (const node of doc.querySelectorAll(".tab")) node.classList.remove("active");
    for (const node of doc.querySelectorAll(".page")) node.classList.remove("active");
    tab.classList.add("active");
    ensureRoomsPage()?.classList.add("active");
    root.navigator?.vibrate?.(5);
    schedule();
  });
  if (before) before.before(tab);
  else nav.append(tab);
  return tab;
}

function teachNavVisibility() {
  const previous = root.cdNavVisMap;
  if (typeof previous !== "function" || previous.__dmStanze) return;
  const wrapped = function cdNavVisMap(...args) {
    const map = previous.apply(this, args) || {};
    return { ...map, [ROOMS_TAB]: ROOMS_TAB };
  };
  wrapped.__dmStanze = true;
  wrapped.__dmPrevious = previous;
  root.cdNavVisMap = wrapped;
}

/* ────────────────────────────────── markup ──────────────────────────────── */

export function pillsMarkup(pagine, scelta) {
  return `<nav class="dm-stanze-tabs" aria-label="${esc(t("Stanze", "Rooms"))}">${pagine
    .map((pagina) => {
      const nome = pagina.senzaStanza ? t("Senza stanza", "No room") : pagina.name;
      /* Le stanze la loro icona la tengono come mdi — «mdi:sofa» — e scritta
       * cosi' finiva nella linguetta come parola, sopra il nome. Qui si
       * traduce nel simbolo, che e' quello che il resto della plancia disegna
       * per la stessa stanza. */
      const icona = pagina.senzaStanza ? "📦" : roomGlyph(pagina.icon) || "🏠";
      return `<button type="button" class="sub-tab-btn dm-stanze-tab${
        pagina.id === scelta ? " active" : ""
      }" data-dm-stanza="${esc(pagina.id)}" aria-selected="${pagina.id === scelta}">
        <span class="dm-stanze-tab-icon">${esc(icona)}</span><span>${esc(nome)}</span><small>${pagina.count}</small>
      </button>`;
    })
    .join("")}</nav>`;
}

/* La scena della stanza: accendi tutto, spegni tutto.
 *
 * «Tutto» qui vuol dire la luce. Non il condizionatore e non la tapparella:
 * quelli hanno un verso loro — freddo o caldo, su o giu' — e decidere al posto
 * di chi guarda quale sia «acceso» sarebbe inventare un significato. La riga
 * sotto dice quante luci tocchera', cosi' non e' un tasto al buio. */
export function sceneMarkup(pagina, states) {
  const { totale, accese } = roomSceneSummary(pagina, states);
  if (!totale) return "";
  const quante =
    totale === 1 ? t("1 luce", "1 light") : t(`${totale} luci`, `${totale} lights`);
  return `<section class="dm-stanze-scena" role="group" aria-label="${esc(t("Scene della stanza", "Room scenes"))}">
    <div class="dm-stanze-scena-kpi">
      <span>${esc(t("Scene", "Scenes"))}</span>
      <b>${accese}/${totale}</b>
      <small>${esc(quante)}</small>
    </div>
    <div class="dm-stanze-scena-btns">
      <button type="button" data-dm-stanza-scena="on">💡 ${esc(t("Accendi tutto", "Turn everything on"))}</button>
      <span class="dm-stanze-scena-div" aria-hidden="true"></span>
      <button type="button" data-dm-stanza-scena="off">🌙 ${esc(t("Spegni tutto", "Turn everything off"))}</button>
    </div>
  </section>`;
}

/* Il clima della stanza non e' un dispositivo: sono i suoi due sensori, che
 * nella configurazione stanno sulla riga della stanza stessa. Per questo la
 * card sta qui e non fra le voci: quelle sono cose dentro la stanza, questa e'
 * la stanza. */
function readingMarkup(pagina, states) {
  /* Una stanza puo' avere piu' di una coppia di sensori.
   *
   * La scheda Temperature lo permette da tempo — «la stessa stanza puo' essere
   * selezionata piu' volte», con un nome per ognuna: il comodino, il termostato
   * a muro, la sonda della veranda. Qui pero' si leggevano solo le due caselle
   * scritte sulla riga della stanza, cioe' la prima coppia: chi ne aveva tre ne
   * vedeva una, e le altre due sembravano non essere mai state configurate.
   *
   * Le associazioni le sa gia' chi le scrive, e si chiedono a lui. */
  const associazioni = temperatureEntries(pagina).filter((voce) => voce.temp || voce.hum);
  if (!associazioni.length) return "";
  const leggi = (entity, coda) => {
    const value = clean(states?.[entity]?.state);
    return value && value !== "unknown" && value !== "unavailable" ? `${value}${coda}` : "—";
  };
  const misura = (entity, etichetta, coda) =>
    entity
      ? `<div><span>${esc(etichetta)}</span><b data-dm-stanza-lettura="${esc(entity)}" data-dm-stanza-coda="${esc(coda)}">${esc(leggi(entity, coda))}</b></div>`
      : "";
  return associazioni
    .map((voce) => {
      /* Col nome suo se ce l'ha: con tre righe uguali non si saprebbe quale
       * sonda sta dicendo cosa. */
      const titolo = clean(voce.name) || clean(pagina.name);
      return `<article class="dm-stanze-card dm-stanze-clima">
    <div class="dm-stanze-card-row">
      <span class="dm-stanze-orb">🌡️</span>
      <span class="dm-stanze-title"><b>${esc(titolo)}</b><s>${esc(t("Sensori della stanza", "Room sensors"))}</s></span>
    </div>
    <div class="dm-stanze-readings">
      ${misura(voce.temp, t("Temperatura", "Temperature"), "°")}
      ${misura(voce.hum, t("Umidità", "Humidity"), "%")}
    </div>
  </article>`;
    })
    .join("");
}

/* Una voce che non e' una luce: nome, stato, e il verso per la sua pagina.
 *
 * Non si comanda da qui. Comandare un condizionatore vuol dire scegliere modo e
 * gradi, comandare una tapparella vuol dire una percentuale: rifarli qui
 * sarebbe rifare due sezioni, e tenerne aggiornate due copie. Il tocco porta
 * dove quella cosa si comanda davvero. */
function rowMarkup(item, blocco, states) {
  const entity = entitaVoce(item);
  return `<article class="dm-stanze-card dm-stanze-voce" data-dm-stanza-vai="${esc(blocco.tab)}" data-dm-stanza-entita="${esc(entity)}" role="button" tabindex="0">
    <div class="dm-stanze-card-row">
      <span class="dm-stanze-orb">${esc(item?.emoji_icon || iconaBlocco(blocco))}</span>
      <span class="dm-stanze-title"><b>${esc(nomeVoce(item, states))}</b><s data-dm-stanza-stato="${esc(entity)}" data-dm-stanza-blocco="${esc(blocco.key)}">${esc(statoVoce(item, states, blocco.key))}</s></span>
      <span class="dm-stanze-vai" aria-hidden="true">›</span>
    </div>
  </article>`;
}

/* Dove si comanda davvero ogni tipo di cosa. */
const TAB_DI = Object.freeze({
  clima: "clima",
  luci: "luci",
  coperture: "tapparelle",
  elettrodomestici: "appliances-main",
  /* Le telecamere stanno nella pagina Sicurezza, non in Home: toccarne una
   * qui riportava alla Home, cioe' in nessun posto utile. */
  telecamere: "security",
  carichi: "energy",
  robot: "robot",
  irrigazione: "irrigazione",
  // Un'entita' assegnata a mano puo' venire da qualunque parte: il tocco la
  // riporta in Home, che e' l'unico posto che le contiene tutte.
  altro: "home",
});

export function blockMarkup(blocco, states) {
  if (!blocco.voci.length) return "";
  const conTab = { ...blocco, tab: TAB_DI[blocco.key] || "home" };
  const card =
    blocco.key === "luci"
      ? blocco.voci
          .map((luce) => {
            const entity = clean(luce.entity || luce.id);
            return pageCardMarkup(
              lightView(entity, { name: clean(luce.name), state: states?.[entity] }),
            );
          })
          .join("")
      : blocco.voci.map((item) => rowMarkup(item, conTab, states)).join("");
  return `<h2 class="dm-stanze-h"><span>${esc(nomeBlocco(blocco))}</span><span class="dm-stanze-n">${blocco.voci.length}</span></h2>
    <div class="dm-stanze-grid">${card}</div>`;
}

export function roomPageMarkup(pagine, scelta, states = {}) {
  if (!pagine.length)
    return `<div class="ed-empty dm-stanze-empty">${esc(
      t(
        "Nessuna stanza configurata. Aggiungile dalla scheda Stanze dell'editor: da lì ogni sezione può assegnare le sue entità.",
        "No rooms configured yet. Add them from the editor's Rooms tab: every section can then assign its entities to one.",
      ),
    )}</div>`;
  const pagina = pickRoomPage(pagine, scelta);
  const blocchi = pagina.blocchi.map((blocco) => blockMarkup(blocco, states)).join("");
  const vuota = blocchi
    ? ""
    : `<div class="dm-stanze-empty">${esc(
        t(
          "Questa stanza non ha ancora niente. L'assegnazione si fa nella scheda di ogni sezione.",
          "Nothing here yet. Entities are assigned from each section's own tab.",
        ),
      )}</div>`;
  return `${pillsMarkup(pagine, pagina.id)}${sceneMarkup(pagina, states)}${readingMarkup(pagina, states)}${blocchi}${vuota}`;
}

/* ─────────────────────────────────── paint ──────────────────────────────── */

function signature(pagine, scelta, states) {
  return [
    scelta,
    pagine
      .map((pagina) =>
        [
          pagina.id,
          pagina.name,
          pagina.count,
          /* Non solo quante cose ci sono: anche QUALI.
           *
           * Contando soltanto si perdevano i cambi che non cambiano il
           * numero — una tapparella rinominata, un'entita' sostituita, una
           * cosa spostata in un'altra stanza mentre un'altra ne prende il
           * posto: la pagina restava con il nome vecchio, e toccandolo si
           * andava sull'entita' vecchia, fino a un ricaricamento. */
          pagina.blocchi
            .map(
              (blocco) =>
                `${blocco.key}:${blocco.voci
                  .map((voce) => `${clean(voce?.id || voce?.entity || voce?.name)}`)
                  .join("+")}`,
            )
            .join(","),
        ].join("~"),
      )
      .join("|"),
    lightsSignature(
      roomSceneEntities(pickRoomPage(pagine, scelta)).map((entity) =>
        lightView(entity, { state: states?.[entity] }),
      ),
    ),
  ].join("§");
}

export function renderRoomsPage() {
  return paint();
}

function paint() {
  const wrap = doc?.getElementById("stanze-wrap");
  if (!wrap) return;
  const pagine = roomPages();
  const states = allStates();
  if (!pagine.some((pagina) => pagina.id === state.room)) state.room = pagine[0]?.id || "";
  const firma = signature(pagine, state.room, states);
  if (firma !== state.signature) {
    state.signature = firma;
    wrap.innerHTML = roomPageMarkup(pagine, state.room, states);
    return;
  }
  /* Struttura uguale: si riscrivono solo i valori. Rifare l'HTML a ogni giro
   * spegnerebbe il dito posato su un cursore e farebbe ripartire ogni
   * animazione da capo. */
  for (const node of wrap.querySelectorAll("[data-dm-stanza-lettura]")) {
    const entity = node.getAttribute("data-dm-stanza-lettura");
    const valore = clean(states?.[entity]?.state);
    /* L'unita' la porta la riga che l'ha disegnata. Prima si deduceva
     * confrontando l'entita' con l'umidita' della stanza: con piu' coppie di
     * sensori quel confronto sbagliava tutte le righe tranne la prima, e le
     * umidita' delle altre uscivano in gradi. */
    const coda = node.getAttribute("data-dm-stanza-coda") || "°";
    const testo = valore && valore !== "unknown" && valore !== "unavailable" ? `${valore}${coda}` : "—";
    if (node.textContent !== testo) node.textContent = testo;
  }
  for (const node of wrap.querySelectorAll("[data-dm-stanza-stato]")) {
    const testo = statoVoce(
      { entity: node.getAttribute("data-dm-stanza-stato") },
      states,
      node.getAttribute("data-dm-stanza-blocco") || "",
    );
    if (node.textContent !== testo) node.textContent = testo;
  }
}

function repaint() {
  state.frame = 0;
  ensureRoomsPage();
  ensureRoomsTab();
  teachNavVisibility();
  paint();
}

function schedule() {
  if (state.frame) return;
  state.frame = root.requestAnimationFrame?.(repaint) || root.setTimeout?.(repaint, 0) || 0;
}

/* ─────────────────────────────────── ascolto ────────────────────────────── */

function callService(command) {
  if (!command) return false;
  try {
    if (typeof root.cdCallServiceJson === "function") {
      root.cdCallServiceJson(command.domain, command.service, command.data);
      return true;
    }
    if (typeof root.dmCallHaService === "function") {
      root.dmCallHaService(command.domain, command.service, command.data)?.catch?.(() => {});
      return true;
    }
    if (typeof root.callService === "function") {
      root.callService(command.domain, command.service, command.data);
      return true;
    }
  } catch (_error) {}
  return false;
}

function runScene(on) {
  const states = allStates();
  const pagina = pickRoomPage(roomPages(), state.room);
  root.navigator?.vibrate?.(15);
  for (const entity of roomSceneEntities(pagina)) {
    const view = lightView(entity, { state: states[entity] });
    if (view.on === on || !view.available) continue;
    callService(lightCommand(view, { power: on }));
  }
  state.signature = "";
  schedule();
}

function handleClick(event) {
  const pillola = event.target?.closest?.("[data-dm-stanza]");
  if (pillola) {
    state.room = pillola.getAttribute("data-dm-stanza") || "";
    state.signature = "";
    root.navigator?.vibrate?.(8);
    schedule();
    return;
  }
  const scena = event.target?.closest?.("[data-dm-stanza-scena]");
  if (scena) {
    runScene(scena.getAttribute("data-dm-stanza-scena") === "on");
    return;
  }
  const vai = event.target?.closest?.("[data-dm-stanza-vai]");
  if (vai) {
    const tab = doc?.querySelector?.(`.tab[data-tab="${vai.getAttribute("data-dm-stanza-vai")}"]`);
    tab?.click?.();
  }
}

export function installRoomsPageSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  ensureRoomsPage();
  ensureRoomsTab();
  teachNavVisibility();
  doc.addEventListener("click", handleClick);
  doc.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (event.target?.closest?.("[data-dm-stanza-vai]")) handleClick(event);
  });
  for (const name of ["render", "cdApplyNavVis"]) wrapFunction(name, "__dmRoomsPageSection", schedule);
  for (const event of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:state-changed",
    "dashboardmodern:persistence-restored",
    "dashboardmodern:config-reset",
  ])
    root.addEventListener?.(event, schedule);
  schedule();
}

function installStyles() {
  installStyle(
    "dm-stanze-style",
    `
      #page-stanze .dm-stanze-wrap{box-sizing:border-box;width:100%;max-width:var(--dm-page-room,none);margin:0 auto;padding:0 4px 18px;display:grid;gap:10px}

      /* Le pillole sono quelle di Temperature: stessa forma, stesso font, stesso
       * conteggio. Due modi di disegnare la stessa cosa sarebbero due cose. */
      #page-stanze .dm-stanze-tabs{display:flex;align-items:center;gap:10px;width:100%;margin:6px 0 4px;overflow-x:auto;scrollbar-width:none}
      #page-stanze .dm-stanze-tabs::-webkit-scrollbar{display:none}
      #page-stanze .dm-stanze-tab{font-family:inherit;display:inline-flex;align-items:center;gap:8px;flex:0 0 auto;min-height:44px;padding:9px 16px;border:1.5px solid var(--divider-color,#dbe4ee);border-radius:100px;background:var(--card-bg,#fff);color:var(--text-dim,#64748b);font-size:12px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;cursor:pointer;box-shadow:0 8px 20px -12px rgba(15,23,42,.28)}
      #page-stanze .dm-stanze-tab.active{border-color:color-mix(in srgb,var(--primary-color,#0ea5e9) 46%,transparent);background:color-mix(in srgb,var(--primary-color,#0ea5e9) 12%,var(--card-bg,#fff));color:var(--primary-color,#0284c7)}
      #page-stanze .dm-stanze-tab>span:not(.dm-stanze-tab-icon){max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      #page-stanze .dm-stanze-tab-icon{display:grid;place-items:center;width:24px;height:24px;font-size:20px;line-height:1}
      #page-stanze .dm-stanze-tab small{display:grid;place-items:center;min-width:19px;height:19px;padding:0 5px;border-radius:999px;background:color-mix(in srgb,currentColor 15%,transparent);font-size:9px;font-weight:900}

      /* La scena, nella forma della fascia di Luci: la lettura a sinistra, i due
       * comandi in un solo controllo segmentato. */
      #page-stanze .dm-stanze-scena{display:flex;align-items:stretch;gap:10px;flex-wrap:wrap;margin:2px 0 4px}
      #page-stanze .dm-stanze-scena-kpi{display:flex;flex-direction:column;justify-content:center;gap:1px;min-width:118px;padding:10px 17px;border:1px solid var(--divider-color,#dbe4ee);border-radius:18px;background:var(--card-bg,#fff);box-shadow:0 12px 28px -22px rgba(15,23,42,.5)}
      #page-stanze .dm-stanze-scena-kpi>span{font-size:9px;font-weight:800;letter-spacing:1.3px;text-transform:uppercase;color:var(--secondary-text-color,#64748b)}
      #page-stanze .dm-stanze-scena-kpi>b{font-size:17px;font-weight:900;letter-spacing:-.2px;color:var(--text,#0f172a)}
      #page-stanze .dm-stanze-scena-kpi>small{font-size:10px;font-weight:800;letter-spacing:.5px;color:var(--secondary-text-color,#94a3b8)}
      #page-stanze .dm-stanze-scena-btns{display:flex;align-items:stretch;flex:1 1 260px;border:1px solid var(--divider-color,#dbe4ee);border-radius:18px;background:var(--card-bg,#fff);box-shadow:0 12px 28px -22px rgba(15,23,42,.5);overflow:hidden}
      #page-stanze .dm-stanze-scena-btns button{flex:1 1 0;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 16px;border:0;background:transparent;cursor:pointer;font:inherit;font-size:12px;font-weight:800;letter-spacing:.5px;color:var(--secondary-text-color,#64748b);transition:color .25s ease,background .25s ease}
      #page-stanze .dm-stanze-scena-btns button[data-dm-stanza-scena="on"]:hover{color:#b45309;background:color-mix(in srgb,#f59e0b 14%,transparent)}
      #page-stanze .dm-stanze-scena-btns button[data-dm-stanza-scena="off"]:hover{color:var(--text,#0f172a);background:color-mix(in srgb,#64748b 12%,transparent)}
      #page-stanze .dm-stanze-scena-btns button:active{transform:scale(.97)}
      #page-stanze .dm-stanze-scena-div{width:1px;margin:9px 0;background:var(--divider-color,#dbe4ee)}

      #page-stanze .dm-stanze-h{display:flex;align-items:center;gap:10px;margin:12px 2px 0;color:var(--secondary-text-color,#64748b);font-size:11px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase}
      #page-stanze .dm-stanze-h::after{content:"";flex:1 1 auto;height:1px;background:linear-gradient(90deg,var(--divider-color,#dbe4ee),transparent)}
      #page-stanze .dm-stanze-n{flex:0 0 auto;order:0;padding:2px 9px;border:1px solid var(--divider-color,#dbe4ee);border-radius:999px;font-size:10px;letter-spacing:.6px}

      #page-stanze .dm-stanze-grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(258px,1fr))}
      #page-stanze .dm-stanze-card{position:relative;display:grid;align-content:start;overflow:hidden;border:1px solid var(--divider-color,#dbe4ee);border-radius:22px;background:linear-gradient(180deg,var(--card-bg,#fff) 0%,color-mix(in srgb,#94a3b8 4%,var(--card-bg,#fff)) 100%);box-shadow:0 16px 32px -24px rgba(15,23,42,.45)}
      #page-stanze .dm-stanze-card-row{display:flex;align-items:center;gap:12px;padding:14px}
      #page-stanze .dm-stanze-orb{display:grid;place-items:center;flex:0 0 auto;width:50px;height:50px;border-radius:17px;background:linear-gradient(160deg,var(--secondary-background-color,#eef3f8),color-mix(in srgb,#94a3b8 14%,var(--secondary-background-color,#eef3f8)));font-size:24px;line-height:1}
      #page-stanze .dm-stanze-title{display:grid;gap:2px;min-width:0;flex:1 1 auto}
      #page-stanze .dm-stanze-title b{font-size:15px;font-weight:900;letter-spacing:-.2px;overflow-wrap:anywhere}
      #page-stanze .dm-stanze-title s{text-decoration:none;font-size:9.5px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--secondary-text-color,#94a3b8)}
      #page-stanze .dm-stanze-voce{cursor:pointer}
      #page-stanze .dm-stanze-voce:active{transform:scale(.985)}
      #page-stanze .dm-stanze-vai{flex:0 0 auto;color:var(--secondary-text-color,#cbd5e1);font-size:20px;font-weight:900;line-height:1}
      #page-stanze .dm-stanze-readings{display:flex;gap:20px;padding:0 14px 14px}
      #page-stanze .dm-stanze-readings div{display:grid;gap:2px}
      #page-stanze .dm-stanze-readings span{font-size:9px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:var(--secondary-text-color,#64748b)}
      #page-stanze .dm-stanze-readings b{font-size:26px;font-weight:900;letter-spacing:-.5px;color:var(--text,#0f172a)}
      #page-stanze .dm-stanze-empty{margin:8px 2px;padding:18px;border:1px dashed var(--divider-color,#cfdae7);border-radius:16px;color:var(--secondary-text-color,#94a3b8);font-size:12.5px;font-weight:700;text-align:center;line-height:1.5}

      @media(min-width:900px){
        #page-stanze .dm-stanze-grid{display:flex;flex-wrap:wrap}
        #page-stanze .dm-stanze-card,#page-stanze .dm-lucip-card{flex:1 1 272px;max-width:384px}
        #page-stanze .dm-stanze-scena-btns{flex:0 1 560px}
      }
      @media(max-width:560px){
        #page-stanze .dm-stanze-grid{grid-template-columns:1fr}
        #page-stanze .dm-stanze-scena-btns button{padding:11px 10px}
      }
    `,
  );
}
