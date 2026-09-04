/* «In primo piano»: il ponte dei widget della Home (#201).
 *
 * Una parte della Home dedicata ai widget: tessere piccole ed eleganti — un
 * numero, un anello, una parola — una per sezione della plancia, e al tocco
 * la tessera si espande in una card larga con il dettaglio vivo di quella
 * sezione: le luci accese con l'interruttore, le zone clima col loro tasto,
 * le tapparelle con le frecce, le cose da fare con la spunta.
 *
 * Ogni widget legge la configurazione che la sua sezione ha gia' — le luci da
 * `cd_luci`, il clima da `cd_clima_units`, l'energia dal modello Energia — e
 * compare solo se quella sezione e' configurata: niente da configurare due
 * volte, niente tessere vuote.
 *
 * Le liste ToDo restano il widget che ha aperto la strada: le voci arrivano
 * da `todo.get_items` con `return_response` sulla presa WebSocket della
 * plancia, spuntarle chiama `todo.update_item`, e la configurazione viaggia
 * in `cd_todo`. Niente polling: si ridisegna sugli eventi di stato, e il
 * markup si rifa' solo quando cambia la struttura — i valori si aggiornano al
 * loro posto, cosi' l'apertura di una tessera non riparte mai da sola.
 */
import {
  normalizeTodoLists,
  parseTodoItemsResponse,
  pendingTodoItems,
} from "../core/todo-model.js";
import { createApplianceViewModel, onRunHoldExpiry } from "../core/appliance-view-model.js";
import { applianceVisualKey, canonicalClimateType } from "../core/device-model.js";
import { oggettoWidget } from "../core/oggetti-widget.js";
import {
  bricioleDellaSezione,
  fraseDellaTessera,
  parolaDelVerdetto,
  verdettoDellaTessera,
} from "../core/racconto-tessera.js";
import { analisiDellaSezione } from "../core/analisi-sezione.js";
import { nomeDellaLettura } from "../core/nome-della-lettura.js";
import { poolList } from "../core/pool-model.js";
/* La tessera delle segnalazioni chiede il suo conto a chi gia' lo tiene, invece
 * di rifare il giro verso GitHub per conto suo. */
import { sommarioConsole } from "./segnalazioni-section.js";
/* E la tessera della chat di assistenza chiede lo stato a chi lo tiene: la
 * sezione della chat, che lo annuncia quando cambia. */
import { quando as quandoScritto, statoDellaChat } from "./assistenza-section.js";
import { tesseraDellaChat } from "../core/avviso-chat.js";
import {
  SCALDABAGNI_KEY,
  entitaDiUnoScaldabagno,
  lettureScaldabagni,
} from "../core/scaldabagno-model.js";
import {
  CHIAVE_CALDAIA,
  entitaDelleCaldaie,
  lettureCaldaie,
  normalizzaCaldaie,
  verdettoPressione,
} from "../core/impianti-termici.js";
import {
  CHIAVE_UPS,
  daQuandoUps,
  entitaDellUps,
  letturaUps,
  normalizzaUps,
} from "../core/ups-model.js";
import {
  TESSERA_PER_IMPIANTO,
  TESSERE_IMPIANTI_KEY,
  comeSiVedeLEnergia,
  PRIMO_IMPIANTO,
  plantIsConfigured,
  plantKey,
  plantLabel,
  plantList,
  sommaLetture,
  sommaNumeri,
} from "../core/energy-plants.js";
import {
  CALENDARI_KEY,
  GIORNI_AVANTI,
  eventiDaQui,
  inCorso,
  minutiAllEvento,
  normalizzaCalendari,
  oraDellEvento,
  orarioDi,
  parseCalendarApiEvents,
  parseCalendarEventsResponse,
  agendaPerGiorno,
  chiaveDelGiorno,
  contoDellaTessera,
  etichettaDelGiorno,
  scadenzeDelleListe,
  voceConScadenza,
  prossimiEventi,
} from "../core/calendario-model.js";
import {
  azioneDellaCosaMarkup,
  azioneDellaScadenzaMarkup,
  azioniDellEventoMarkup,
  bozzaAperta,
  chiaveDellEvento,
  dichiaraCalendari,
  moduloMarkup,
  registraOspiteCalendario,
  registraRilettura,
  tastoNuovoMarkup,
} from "./calendario-modifica-section.js";
import { normalizzaPrese } from "../core/prese-model.js";
import { CHIAVE_MEDIA, lettoriConfigurati, lettureDeiLettori } from "../core/media-player.js";
import {
  CHIAVE_ALLERTE,
  IGNOTO,
  allerteAttive,
  almeno,
  categorieConfigurate,
  entitaDelleAllerte,
  letturaAllerte,
  livelloMassimo,
} from "../core/allerte-model.js";
import { categoriaDelleAllerte, fraseDellAllerta } from "./allerte-section.js";
import {
  CHIAVE_RIFIUTI,
  entitaDeiRifiuti,
  letturaRifiuti,
  rifiutiConfigurati,
} from "../core/rifiuti-model.js";
import { nomeDellaRiga, parolaDelQuando } from "./rifiuti-section.js";
import { comandiMediaMarkup, sottoDelLettore, titoloDelLettore } from "./media-player-section.js";
import { iconaPresaMarkup } from "./prese-section.js";
import { puntiDi, quandoArrivaLoStorico } from "./storico-condiviso-section.js";
import {
  CHIAVE_SOGLIA_CHIUSA,
  sogliaDellaCopertura,
  coverEntries,
  coverKindLabel,
  coverPositionChoices,
  coverPresetPosition,
  isRelayEntity,
  relayCoverCommands,
} from "../core/cover-kind.js";
import { doorOpenCall } from "../core/security-door-model.js";
import { configuredSecurityDoors, iconaPortaMarkup } from "./security-doors-section.js";
import { wattsFromState } from "../core/signed-energy.js";
import {
  contactEntity,
  inferriataEntity,
  isWindowOnly,
  windowOpenFromState,
} from "../core/shutter-window.js";
import {
  CHIAVE_VERSI,
  apertaSecondoVerso,
  insiemeInvertiti,
  posizioneSecondoVerso,
  versoInvertito,
} from "../core/verso-aperture.js";
import { normalizeRobots, robotStateLabel, robotView } from "../core/robot-model.js";
import { passoDellUnita, scalaDellUnita } from "../core/scala-clima.js";
import { configuredLightGroups } from "./lights-alerts-section.js";
import { floodEntities, floodIsWet } from "./flood-alerts-section.js";
import { loadCameraFrame } from "./live-ui-section.js";
import { hasConfiguredData } from "../core/dashboard-store.js";
import {
  allStates,
  clean,
  doc,
  esc,
  formatNumber,
  installStyle,
  nomeDellEntita,
  chiediAHomeAssistant,
  gettoneDiAccesso,
  lexicalGlobal,
  locale,
  readClimateUnits,
  readJson,
  root,
  section,
  siComanda,
  t,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_HOME_WIDGETS__";
const STYLE_ID = "dm-widgets-style";
export const TODO_CONFIG_KEY = "cd_todo";
export const WIDGETS_CONFIG_KEY = "cd_widgets";
/* Le entita' «In evidenza» (#236): sensori sparsi che si vogliono tenere
 * d'occhio dalla Home senza dar loro una sezione intera. La chiave e' gia'
 * registrata in persistenza, revisione 13. */
export const EVIDENZA_CONFIG_KEY = "cd_evidenza";
const STALE_MS = 30000;
/* Quanto si aspetta prima di richiedere le voci a una lista che ha appena
 * risposto con un errore — o non ha risposto affatto. */
const RETRY_MS = 20000;
/* Un appuntamento non cambia ogni mezzo minuto come una lista della spesa:
 * cinque minuti bastano, e sono cinque richieste l'ora invece di centoventi. */
const CALENDARIO_STALE_MS = 300000;
/* Quanti giorni entrano nella finestra della Home. Oltre due settimane non e'
 * piu' «cosa ho in programma»: e' un'agenda, e per quella c'e' la sezione. */
const GIORNI_NEL_PANNELLO = 14;
const MAX_VISIBLE_ITEMS = 8;
const MAX_DETAIL_ROWS = 14;

const state = (root[KEY] ||= {
  installed: false,
  frame: 0,
  expanded: "",
  signature: "",
  escape: false,
  lists: new Map(), // entity -> { items, fetchedAt, inflight }
  /* Gli eventi letti, per calendario (#259). Stanno accanto alle liste ToDo e
   * non dentro: sono due servizi diversi e due risposte diverse, e mescolarle
   * vorrebbe dire una mappa in cui meta' delle voci ha campi che non usa. */
  calendari: new Map(), // entity -> { eventi, fetchedAt, inflight, failedAt }
  cameraTimer: 0,
  cameraUrls: new Map(), // entity -> object URL della tessera, MAI quelli del muro
  /* Quali righe hanno il pannello della rotella aperto. Sta qui e non nel
   * documento perche' il corpo della finestra si ridisegna a ogni giro di
   * stati: se lo stato dell'apertura stesse solo nel documento, il pannello si
   * richiuderebbe da solo appena un termostato manda un grado nuovo. */
  aperti: new Set(),
  /* Quello che si sta scrivendo nella riga «aggiungi», per lista. Il corpo
   * della finestra si riscrive a ogni valore che cambia — e con dieci liste
   * aperte cambia spesso: se la parola a meta' stesse solo nel documento,
   * sparirebbe sotto le dita. */
  bozze: new Map(),
  /* L'ultimo corpo SCRITTO nella finestra, non quello che c'e' adesso.
   *
   * Il confronto si faceva contro `body.innerHTML`, cioe' contro il documento
   * vivo. Le miniature delle telecamere pero' nel markup nascono senza
   * fotogramma — la foto la posa dopo chi le scarica, insieme al suo
   * «pronto» — quindi il documento e il markup appena scritto erano SEMPRE
   * diversi, e il corpo si rifaceva a ogni evento di stato: i riquadri delle
   * telecamere venivano buttati via e ricaricati di continuo, che da fuori e'
   * il nero e il rinfresco senza fine. Ricordando cosa si e' scritto, il
   * confronto torna a essere fra due testi che si assomigliano davvero. */
  corpo: { chiave: "", markup: "" },
  /* Le animazioni messe in pausa mentre la finestra copre la plancia, per
   * poterle far ripartire quando si chiude. */
  ferme: [],
});

export function configuredTodoLists() {
  return normalizeTodoLists(readJson(TODO_CONFIG_KEY, []));
}

/** I calendari scelti (#259). */
export function calendariConfigurati() {
  return normalizzaCalendari(readJson(CALENDARI_KEY, []));
}

/* ── letture ──────────────────────────────────────────────────────────── */

function stateOf(states, entity) {
  const id = clean(entity);
  if (!id) return null;
  let resolved = id;
  try {
    resolved = clean(root.resolveEntity?.(id) || id);
  } catch (_error) {}
  return states[id] || states[resolved] || null;
}

function numOf(states, entity) {
  const value = Number(stateOf(states, entity)?.state);
  return Number.isFinite(value) ? value : null;
}

/* ── il filo delle liste ToDo ─────────────────────────────────────────── */

function record(entity) {
  let value = state.lists.get(entity);
  if (!value) {
    value = { items: null, fetchedAt: 0, inflight: false, failedAt: 0 };
    state.lists.set(entity, value);
  }
  return value;
}

async function fetchItems(entity, { force = false } = {}) {
  const cache = record(entity);
  const now = Date.now();
  if (cache.inflight) return;
  if (!force && cache.items && now - cache.fetchedAt < STALE_MS) return;
  /* Una richiesta fallita non ha lasciato voci, e senza voci la guardia dello
   * scaduto non ferma nessuno: col socket giu' il disegno richiedeva, la
   * richiesta falliva, il fallimento faceva ridisegnare, e il giro ripartiva
   * a ogni fotogramma. Dopo un errore si aspetta prima di riprovare. */
  if (!force && !cache.items && now - cache.failedAt < RETRY_MS) return;
  cache.inflight = true;
  let riuscita = false;
  try {
    const result = await chiediAHomeAssistant({
      type: "call_service",
      domain: "todo",
      service: "get_items",
      target: { entity_id: entity },
      return_response: true,
    });
    cache.items = parseTodoItemsResponse(result, entity);
    cache.fetchedAt = Date.now();
    cache.failedAt = 0;
    riuscita = true;
  } catch (error) {
    cache.failedAt = Date.now();
    root.console?.warn?.("[DashboardModern] todo items", error);
  }
  cache.inflight = false;
  // Un fallimento non ha cambiato niente da disegnare: ridisegnare lo stesso
  // vorrebbe dire richiedere di nuovo, subito.
  if (riuscita) schedule();
}

/* ── il filo dei calendari (#259) ──────────────────────────────────────
 *
 * Stesso mestiere del filo delle liste, altro servizio: lo stato di un
 * `calendar.*` e' `on`/`off` e negli attributi porta un evento solo, quindi
 * l'elenco lo si chiede a `calendar.get_events`. La finestra e' un mese: una
 * richiesta sola per calendario, e copre il «cosa ho questo mese». */
function schedaCalendario(entity) {
  let valore = state.calendari.get(entity);
  if (!valore) {
    valore = { eventi: null, fetchedAt: 0, inflight: false, failedAt: 0 };
    state.calendari.set(entity, valore);
  }
  return valore;
}

/* L'ora scritta come la vuole il servizio: «2026-09-01 14:00:00», locale.
 * Un ISO con la Z chiederebbe a Home Assistant una finestra spostata dal fuso
 * di chi guarda, e il primo giorno dell'elenco sarebbe quello sbagliato. */
function orarioPerIlServizio(istante) {
  const quando = new Date(istante);
  const due = (numero) => String(numero).padStart(2, "0");
  return `${quando.getFullYear()}-${due(quando.getMonth() + 1)}-${due(quando.getDate())} ${due(
    quando.getHours(),
  )}:${due(quando.getMinutes())}:${due(quando.getSeconds())}`;
}

/* Gli eventi, chiesti dove portano anche il loro nome proprio.
 *
 * Due strade, e non e' un ripiego: e' che una delle due porta l'`uid` e
 * l'altra no.
 *
 *   - `/api/calendars/<entita>` e' quella che usa il pannello Calendario di
 *     Home Assistant, e restituisce `uid` e `recurrence_id`. Senza quelli un
 *     evento si puo' guardare ma non toccare: non c'e' modo di dire QUALE
 *     modificare, e i tasti «modifica» e «elimina» non compaiono nemmeno.
 *   - il servizio `calendar.get_events` restituisce solo inizio, fine,
 *     titolo, descrizione e luogo. Basta a leggere, e funziona dove la porta
 *     HTTP non risponde.
 *
 * La porta HTTP, dentro Home Assistant, non risponde a mani nude: la plancia
 * servita dall'integrazione non possiede nessun gettone e ogni chiamata REST
 * torna 401 — e' la stessa ragione per cui la foto dell'auto viaggia sul
 * socket. Percio' il percorso si fa FIRMARE dal socket (`auth/sign_path`, lo
 * stesso che il guscio usa per le immagini) e poi si chiede firmato. Chi ha un
 * gettone lungo — la pagina servita da sola — lo usa e basta.
 *
 * Se nessuna delle due strade porta a casa qualcosa, resta il servizio: si
 * vede l'agenda per intero, si perde solo la possibilita' di scriverci.
 */
async function percorsoFirmato(percorso) {
  try {
    const risposta = await chiediAHomeAssistant({
      type: "auth/sign_path",
      path: percorso,
      expires: 30,
    });
    return clean(risposta?.path) || "";
  } catch (_error) {
    return "";
  }
}

async function eventiDallaPortaHttp(entity, da, a) {
  if (typeof root.fetch !== "function") return null;
  const percorso = `/api/calendars/${encodeURIComponent(entity)}?start=${encodeURIComponent(
    new Date(da).toISOString(),
  )}&end=${encodeURIComponent(new Date(a).toISOString())}`;
  const gettone = gettoneDiAccesso();
  const firmato = gettone ? "" : await percorsoFirmato(percorso);
  const risposta = await root.fetch(firmato || percorso, {
    headers: gettone ? { Authorization: `Bearer ${gettone}` } : {},
    credentials: "include",
    cache: "no-store",
  });
  if (!risposta.ok) return null;
  return parseCalendarApiEvents(await risposta.json(), entity);
}

async function fetchEventi(entity, { force = false } = {}) {
  const scheda = schedaCalendario(entity);
  const adesso = Date.now();
  if (scheda.inflight) return;
  if (!force && scheda.eventi && adesso - scheda.fetchedAt < CALENDARIO_STALE_MS) return;
  /* Come per le liste: dopo un errore si aspetta, o col socket giu' il disegno
   * chiederebbe, la richiesta fallirebbe, il fallimento farebbe ridisegnare, e
   * il giro ripartirebbe a ogni fotogramma. */
  if (!force && !scheda.eventi && adesso - scheda.failedAt < RETRY_MS) return;
  scheda.inflight = true;
  let riuscita = false;
  const fino = adesso + GIORNI_AVANTI * 86400000;
  try {
    let letti = null;
    try {
      letti = await eventiDallaPortaHttp(entity, adesso, fino);
    } catch (_error) {
      letti = null;
    }
    if (letti === null) {
      const result = await chiediAHomeAssistant({
        type: "call_service",
        domain: "calendar",
        service: "get_events",
        target: { entity_id: entity },
        service_data: {
          start_date_time: orarioPerIlServizio(adesso),
          end_date_time: orarioPerIlServizio(fino),
        },
        return_response: true,
      });
      letti = parseCalendarEventsResponse(result, entity);
    }
    scheda.eventi = letti;
    scheda.fetchedAt = Date.now();
    scheda.failedAt = 0;
    riuscita = true;
  } catch (error) {
    scheda.failedAt = Date.now();
    root.console?.warn?.("[DashboardModern] calendar events", error);
  }
  scheda.inflight = false;
  if (riuscita) schedule();
}

/** Gli eventi di tutti i calendari scelti, in fila. Serve anche alla pagina. */
export function eventiDeiCalendari() {
  const scelti = calendariConfigurati();
  const eventi = [];
  let inArrivo = false;
  for (const calendario of scelti) {
    const scheda = schedaCalendario(calendario.entity);
    if (scheda.eventi === null) inArrivo = true;
    for (const evento of scheda.eventi || [])
      eventi.push({
        ...evento,
        calendario: nomeDellEntita(calendario.entity, calendario.name),
        colore: calendario.colore,
      });
  }
  return { eventi, inArrivo, scelti };
}

/** Chiede gli eventi a tutti i calendari scelti. */
export function aggiornaCalendari(opzioni) {
  for (const calendario of calendariConfigurati()) fetchEventi(calendario.entity, opzioni);
}

async function callHa(domain, servizio, payload) {
  try {
    if (typeof root.dmCallHaService === "function")
      return await root.dmCallHaService(domain, servizio, payload);
    if (typeof root.callService === "function")
      return await root.callService(domain, servizio, payload);
    return await (root.hass || root._hass)?.callService?.(domain, servizio, payload);
  } catch (error) {
    root.console?.error?.("[DashboardModern] widget service", error);
    return undefined;
  }
}

async function completeItem(list, uid, summary) {
  const cache = record(list.entity);
  const item = (cache.items || []).find(
    (value) => (uid && value.uid === uid) || (!uid && value.summary === summary),
  );
  if (!item || item.status === "completed") return;
  // Ottimista: la voce si barra subito e resta visibile qualche secondo, poi
  // la rilettura la fa sparire con la verita' di Home Assistant.
  item.status = "completed";
  item.localDone = true;
  schedule();
  const payload = { entity_id: list.entity, item: item.uid || item.summary, status: "completed" };
  const esito = await callHa("todo", "update_item", payload);
  if (esito === undefined) {
    item.status = "needs_action";
    item.localDone = false;
    schedule();
    return;
  }
  root.setTimeout?.(() => fetchItems(list.entity, { force: true }), 4000);
}

/* Una voce nuova.
 *
 * Ottimista come la spunta: compare subito in fondo alla lista, e la
 * rilettura da Home Assistant qualche istante dopo la conferma — o la toglie,
 * se la chiamata non e' andata. Senza, fra il dito e la comparsa passavano i
 * secondi della rilettura, e sembrava che il tasto non avesse fatto niente. */
async function addItem(list, summary) {
  const testo = clean(summary);
  if (!testo) return;
  const cache = record(list.entity);
  cache.items = [
    ...(cache.items || []),
    { uid: "", summary: testo, status: "needs_action", due: "", localNew: true },
  ];
  state.bozze.delete(list.id);
  schedule();
  const esito = await callHa("todo", "add_item", { entity_id: list.entity, item: testo });
  if (esito === undefined) {
    cache.items = (cache.items || []).filter((voce) => !voce.localNew || voce.summary !== testo);
    schedule();
    return;
  }
  root.setTimeout?.(() => fetchItems(list.entity, { force: true }), 1200);
}

/* Togliere una voce e basta: non e' «fatta», e' «non c'entrava». */
async function removeItem(list, uid, summary) {
  const cache = record(list.entity);
  const voce = (cache.items || []).find(
    (value) => (uid && value.uid === uid) || (!uid && value.summary === summary),
  );
  if (!voce) return;
  const prima = cache.items;
  cache.items = (cache.items || []).filter((value) => value !== voce);
  schedule();
  const esito = await callHa("todo", "remove_item", {
    entity_id: list.entity,
    item: voce.uid || voce.summary,
  });
  if (esito === undefined) {
    cache.items = prima;
    schedule();
    return;
  }
  root.setTimeout?.(() => fetchItems(list.entity, { force: true }), 1200);
}

/* ── i modelli dei widget ─────────────────────────────────────────────── */

function localToday() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

function todoModel() {
  const lists = configuredTodoLists().filter((list) => widgetIncludes(list.entity));
  if (!lists.length) return null;
  let pending = 0;
  let total = 0;
  const blocks = lists.map((list) => {
    const items = record(list.entity).items;
    const open = pendingTodoItems(items || []);
    pending += open.length;
    total += (items || []).length;
    return { list, items };
  });
  const percent = total ? Math.round(((total - pending) / total) * 100) : 0;
  return {
    /* Non piu' una tessera: una delle due meta' dell'Agenda (#259). Il nome
     * dice quale parte e', non quale mattonella — mattonella non ne ha piu'
     * una sua, e lasciarle una `key` la farebbe cercare in un catalogo dove
     * non c'e'. */
    parte: "cose",
    accent: "#059669",
    icon: "✅",
    label: t("Da fare", "To-do"),
    value: String(pending),
    caption: t(`${pending} da fare`, `${pending} to do`),
    // La quota dice quanto e' stato spuntato: la tessera pero' si accende
    // quando resta qualcosa da fare, non quando e' tutto finito.
    ring: percent,
    attiva: pending > 0,
    blocks,
  };
}

/* Le parole del calendario, dette qui e non nel nucleo: il raccoglitore delle
 * traduzioni guarda le sezioni, e una `t()` scritta dentro `src/core` non
 * finirebbe nei cataloghi — «Oggi» resterebbe italiano per tutti. */
function paroleDelCalendario() {
  return {
    oggi: t("Oggi", "Today"),
    domani: t("Domani", "Tomorrow"),
    tuttoIlGiorno: t("Tutto il giorno", "All day"),
    daFare: t("Da fare", "To-do"),
    inRitardo: t("In ritardo", "Overdue"),
  };
}

/* La tessera del calendario (#259).
 *
 * «Magari visualizzando gli ultimi 2 eventi su widget che cliccandoci si apre
 * una lista giorni/giorno e un elenco tipo come gia' esistente Da Fare.»
 *
 * I due eventi stanno nella didascalia, con la loro ora davanti — e' la riga
 * che scorre, la stessa in cui le Luci dicono quali sono accese — perche' un
 * appuntamento senza il titolo non e' un appuntamento, e il titolo e' una
 * parola, non un numero. Il numero grande e' quanti ne restano oggi: quello
 * risponde a «sono libero stasera?» prima ancora di leggere.
 */
/* Le liste grezze, per chi deve contare le scadenze senza disegnare niente. */
function blocchiDelleListe() {
  const fuori = widgetExcludedEntities();
  return configuredTodoLists()
    .filter((list) => widgetIncludes(list.entity, fuori))
    .map((list) => ({ list, items: record(list.entity).items }));
}

function calendarioModel() {
  const { eventi, inArrivo, scelti } = eventiDeiCalendari();
  if (!scelti.length) return null;
  const adesso = Date.now();
  const lingua = locale();
  const parole = paroleDelCalendario();
  const restano = eventiDaQui(eventi, adesso);
  const primi = prossimiEventi(eventi, adesso, 2);
  const oggi = chiaveDelGiorno(adesso);
  /* Anche le scadenze contano: «3 oggi» sopra un'agenda che di righe per oggi
   * ne mostra quattro sarebbe un numero che smentisce quello che c'e' sotto.
   * Quanto contare, e da quale giorno, lo decide il nucleo: qui si mettono
   * soltanto le parole. */
  const conto = contoDellaTessera(eventi, scadenzeDelleListe(blocchiDelleListe()), adesso);

  /* Un evento nella didascalia: quando comincia e come si chiama. Il giorno si
   * scrive solo se non e' oggi — «Oggi 20:00» davanti a ogni riga sarebbe una
   * parola ripetuta che non distingue niente. */
  const scritto = (evento) => {
    const titolo = clean(evento.summary) || t("Senza titolo", "Untitled");
    if (inCorso(evento, adesso)) return `${t("Adesso", "Now")} · ${titolo}`;
    const giorno = chiaveDelGiorno(evento.inizio);
    /* L'ora d'inizio si chiede da sola, non tagliando l'intervallo al primo
     * spazio: in inglese «02:30 PM – 03:30 PM» perdeva il PM, e le 14:30
     * si leggevano come le due di notte. */
    const quando = evento.tuttoIlGiorno ? "" : orarioDi(evento.inizio, lingua);
    const dove =
      giorno === oggi
        ? quando
        : `${etichettaDelGiorno(giorno, adesso, parole, lingua)}${quando ? ` ${quando}` : ""}`;
    return dove ? `${dove} · ${titolo}` : titolo;
  };

  const didascalia = () => {
    if (!primi.length)
      return inArrivo
        ? t("Caricamento…", "Loading…")
        : t("Niente in programma", "Nothing scheduled");
    return primi.map(scritto).join("  ·  ");
  };

  return {
    // L'altra meta' dell'Agenda (#259): gli impegni. Vedi `todoModel` sopra.
    parte: "impegni",
    accent: "#6366f1",
    icon: "📅",
    label: t("Impegni", "Appointments"),
    /* Quanti ne restano oggi, non quanti ce ne sono in tutto: «diciotto» non
     * dice se stasera si e' liberi, «due oggi» si'. E a oggi vuoto si guarda
     * avanti invece di dire «non lo so»: vedi `contoDellaTessera`. */
    value: (() => {
      const { quante, quando } = conto;
      if (quando === "oggi") return t(`${quante} oggi`, `${quante} today`);
      if (quando === "domani") return t(`${quante} domani`, `${quante} tomorrow`);
      if (quando === "avanti") return t(`${quante} in arrivo`, `${quante} coming up`);
      /* Il trattino resta per quando non c'e' davvero niente: li' e' vero. */
      return "—";
    })(),
    caption: didascalia(),
    /* Nessun anello: una percentuale di appuntamenti non vuol dire niente, e
     * un cerchio pieno a caso e' peggio di un cerchio che non c'e'. */
    ring: null,
    // La tessera si accende mentre un evento sta succedendo.
    attiva: primi.length > 0 && inCorso(primi[0], adesso),
    primi,
    eventi: restano,
    inArrivo,
    calendari: scelti,
  };
}

function lightsModel(states) {
  let groups = [];
  try {
    groups = configuredLightGroups();
  } catch (_error) {
    return null;
  }
  const fuori = widgetExcludedEntities();
  const rows = groups.flatMap((group) =>
    group.entities
      .filter((entity) => widgetIncludes(entity, fuori))
      .map((entity) => ({
        entity,
        room: group.room,
        name: clean(group.lights?.[entity]) || entity.split(".")[1]?.replaceAll("_", " ") || entity,
        on: clean(stateOf(states, entity)?.state).toLowerCase() === "on",
        /* «Si vede ma non si comanda» vale anche qui: la tessera della Home
         * disegnava l'interruttore per tutte e il gestore chiamava il
         * servizio dritto, senza passare dal divieto. */
        comando: siComanda(entity),
      })),
  );
  if (!rows.length) return null;
  const on = rows.filter((row) => row.on);
  return {
    key: "luci",
    accent: "#f59e0b",
    icon: "💡",
    label: t("Luci", "Lights"),
    value: String(on.length),
    caption: nomiAccesi(on, () => true, t(`${on.length} accese`, `${on.length} on`)),
    ring: Math.round((on.length / rows.length) * 100),
    rows,
    on,
  };
}

/* Una riga del Clima da una unita' configurata.
 *
 * Sta fuori dal modello della tessera perche' serve anche a chi la tessera non
 * la guarda: la finestra della pagina Clima chiede il pannello di UNA unita',
 * e quell'unita' puo' benissimo essere una di quelle che l'interruttore «nel
 * widget» tiene fuori dalla Home. Passando dal modello filtrato la riga non
 * usciva e la finestra ripiegava sui cinque tasti scritti a mano nel guscio:
 * chi toglieva un termosifone dalla Home si ritrovava, in pagina, il pannello
 * vecchio. Il filtro e' una faccenda della tessera, non della riga. */
function rigaClima(states, unit) {
  const entity = clean(unit?.entity || unit?.entity_id || unit?.entities?.[0]);
  if (!entity) return null;
  const current = stateOf(states, entity);
  const raw = clean(current?.state).toLowerCase();
  const attributi = current?.attributes || {};
  const elenco = (valori) => (Array.isArray(valori) ? valori.map(clean).filter(Boolean) : []);
  const numero = (valore, difetto = null) =>
    Number.isFinite(Number(valore)) ? Number(valore) : difetto;
  const scala = scalaDellUnita(attributi);
  return {
    entity,
    name: clean(unit?.name) || entity,
    on: Boolean(current) && raw !== "off" && raw !== "unavailable" && raw !== "unknown",
    mode: raw,
    ambient: numero(attributi.current_temperature),
    target: numero(attributi.temperature),
    /* Quello che serve al pannello della rotella: cosa l'unita' accetta, e
     * dove sta adesso. Sono attributi che Home Assistant pubblica gia' —
     * il modello si limita a portarli in riga invece di farli cercare a
     * chi disegna. */
    modi: elenco(attributi.hvac_modes),
    ventole: elenco(attributi.fan_modes),
    ventola: clean(attributi.fan_mode),
    /* Fin dove il pannello lascia andare l'obiettivo: la scala e' quella che
     * l'unita' dichiara, e la regola sta nel nucleo insieme a quella della
     * pagina Clima — erano due copie della stessa cosa, e una delle due si
     * fermava a trentacinque gradi anche davanti a una pompa di calore che
     * ne dichiara settanta (#252). */
    minima: scala[0],
    massima: scala[1],
    passo: passoDellUnita(attributi, 0.5),
    umidita: numero(attributi.current_humidity),
    azione: clean(attributi.hvac_action),
    /* Che macchina e', non solo cosa sta facendo adesso: un termosifone
     * spento resta un termosifone, e il fiocco di neve sopra un
     * radiatore era il disegno di un'altra casa. */
    tipo: canonicalClimateType(unit?.type),
  };
}

function climateModel(states) {
  let units = [];
  try {
    units = readClimateUnits();
  } catch (_error) {
    return null;
  }
  const fuori = widgetExcludedEntities();
  const rows = units
    .map((unit) => rigaClima(states, unit))
    .filter((riga) => riga && widgetIncludes(riga.entity, fuori));
  if (!rows.length) return null;
  const on = rows.filter((row) => row.on);
  const ambient = rows.map((row) => row.ambient).filter((value) => value !== null);
  const average = ambient.length
    ? ambient.reduce((sum, value) => sum + value, 0) / ambient.length
    : null;
  /* L'unita' scelta al posto della media (#303). */
  const scelta = sorgenteDelWidget("clima");
  const sola = scelta ? rows.find((row) => row.entity === scelta) : null;
  return {
    key: "clima",
    accent: "#0ea5e9",
    icon: "❄️",
    label: t("Clima", "Climate"),
    value: sola
      ? sola.ambient == null
        ? sola.on
          ? t("Accesa", "On")
          : t("Spenta", "Off")
        : `${formatNumber(sola.ambient, 1)}°`
      : average == null
        ? String(on.length)
        : `${formatNumber(average, 1)}°`,
    caption: sola
      ? `${sola.name} · ${sola.on ? t("accesa", "on") : t("spenta", "off")}`
      : nomiAccesi(on, () => true, t(`${on.length} accese`, `${on.length} on`)),
    ring: Math.round((on.length / rows.length) * 100),
    rows,
  };
}

/* La riga del Clima di quell'entita', ricalcolata al momento: serve al passo
 * della temperatura, che deve sapere dove sta l'obiettivo adesso e fin dove
 * quell'unita' lo lascia andare. */
function climateRow(entity) {
  try {
    const chiave = clean(entity);
    const states = allStates();
    return (
      readClimateUnits()
        .map((voce) => rigaClima(states, voce))
        .find((riga) => riga && riga.entity === chiave) || null
    );
  } catch (_error) {
    return null;
  }
}

function coversModel(states) {
  const values = root.getTapparelle?.() || readJson("cd_tapparelle", []);
  if (!Array.isArray(values) || !values.length) return null;
  const fuori = widgetExcludedEntities();
  /* Una riga puo' portare tapparella, tenda e tenda da sole insieme: la
   * tessera ne mostrava solo la prima, e chi ha le tende in Home non le
   * vedeva. Adesso ogni copertura della riga e' una voce, col suo nome e col
   * suo rele' di discesa. */
  const rows = values
    .flatMap((item) => {
      /* Una finestra senza motori — persiane manuali, un contatto sull'anta e
       * nient'altro — non ha coperture da elencare, e qui spariva: la tessera
       * chiedeva le coperture della riga, e di coperture non ne aveva
       * nessuna. La pagina Tapparelle quella riga la disegna da tempo e sa
       * dire se la finestra e' aperta; in Home non arrivava niente, e chi ha
       * solo i sensori di apertura non aveva modo di vedere a colpo d'occhio
       * quali infissi ha lasciato aperti — che e' esattamente la cosa che si
       * vuole sapere uscendo di casa. */
      if (isWindowOnly(item)) {
        /* I contatti possono essere due (#254): l'infisso dentro e
         * l'inferriata fuori. Sono due cose che si aprono per conto loro, e in
         * Home vanno elencate separate — una grata lasciata aperta e una
         * finestra lasciata aperta non sono la stessa notizia. Chi ne ha
         * dichiarato uno solo vede una riga sola, come prima. */
        const nome = clean(item?.name);
        return [
          [contactEntity(item), nome, false],
          [inferriataEntity(item), nome, true],
        ]
          .filter(([entita]) => entita)
          .map(([entita, etichetta, grata]) => ({
            item,
            voce: { entity: entita, kind: "", down: "" },
            etichetta: grata
              ? `${etichetta || entita} · ${t("Inferriata", "Grate")}`
              : etichetta || entita,
            soloSensore: true,
          }));
      }
      return coverEntries(item).map((voce) => ({
        item,
        voce,
        etichetta:
          coverEntries(item).length > 1 && voce.kind
            ? `${clean(item?.name) || voce.entity} · ${coverKindLabel(voce.kind)}`
            : clean(item?.name) || voce.entity,
      }));
    })
    .map(({ item, voce, etichetta, soloSensore }) => {
      const entity = clean(voce.entity);
      if (!entity || !widgetIncludes(entity, fuori)) return null;
      const current = stateOf(states, entity);
      const raw = clean(current?.state).toLowerCase();
      /* Il verso (#244): la tapparella girata dichiara 100 quando e' giu', e
       * il contatto girato sta a ON quando e' chiuso. Qui si normalizza tutto
       * al verso della plancia — 100 e ON vogliono dire aperto — cosi' quello
       * che segue non deve saperne niente. */
      const girata = versoInvertito(item);
      const position = posizioneSecondoVerso(Number(current?.attributes?.current_position), girata);
      /* Il contatto parla la sua lingua — `on` e' aperto — e non ha posizione:
       * chiederla a lui vorrebbe dire inventarla. */
      /* Dove una posizione c'e', comanda lei — e sotto la soglia di casa
       * (#298) uno spiraglio e' una tapparella chiusa: «le imposto al 10%
       * per un minimo passaggio d'aria, ma il sistema le rileva aperte». Lo
       * stato di Home Assistant resta per chi la posizione non la dichiara. */
      const open = soloSensore
        ? apertaSecondoVerso(
            windowOpenFromState(current?.state),
            insiemeInvertiti(readJson(CHIAVE_VERSI, [])).has(entity),
          ) === true
        : raw === "opening" ||
          (Number.isFinite(position)
            ? position > sogliaDellaCopertura(item, readJson(CHIAVE_SOGLIA_CHIUSA, 0))
            : raw === "open");
      return {
        soloSensore: Boolean(soloSensore),
        entity,
        name: etichetta,
        open,
        invertita: girata,
        position: soloSensore || !Number.isFinite(position) ? null : Math.round(position),
        isCover: !soloSensore && /^cover\./i.test(entity),
        // Chi accetta `set_cover_position` (bit 4) si ferma dove gli si dice.
        settable: Boolean(Number(current?.attributes?.supported_features) & 4),
        preset: coverPresetPosition(item),
        /* Una tapparella dietro uno o due rele' (#194): la pagina la comanda
         * gia', e da qui doveva restare a guardare. Le frecce sono le stesse,
         * cambia solo la lingua in cui parlano. */
        relay: isRelayEntity(entity),
        down: clean(voce.down),
      };
    })
    .filter(Boolean);
  if (!rows.length) return null;
  const open = rows.filter((row) => row.open);
  return {
    key: "tapparelle",
    accent: "#8b5cf6",
    icon: "🪟",
    label: t("Finestre", "Windows"),
    value: String(open.length),
    caption: nomiAccesi(open, () => true, t(`${open.length} aperte`, `${open.length} open`)),
    ring: Math.round((open.length / rows.length) * 100),
    rows,
  };
}

function securityModel(states) {
  const fuori = widgetExcludedEntities();
  const alarm = stateOf(states, "dm.security_centrale_allarme");
  /* Le entita' delle Prese non sono porte: la lista arriva gia' filtrata. */
  const doors = configuredSecurityDoors().filter((door) => widgetIncludes(door.entity, fuori));
  // Senza antifurto e senza aperture non c'e' una sicurezza da raccontare: le
  // telecamere, da sole, sono gia' la loro tessera.
  if (!alarm && !doors.length) return null;
  const raw = clean(alarm?.state).toLowerCase();
  const triggered = raw === "triggered" || raw === "pending";
  const armed = raw.startsWith("armed");
  const value = !alarm
    ? "—"
    : triggered
      ? t("Allarme!", "Alarm!")
      : armed
        ? t("Inserito", "Armed")
        : t("Disinserito", "Disarmed");
  // La didascalia parla di quello che questa tessera comanda — l'antifurto e
  // le aperture — non delle telecamere: quelle hanno la loro tessera, con le
  // miniature, e dirle due volte era dire due volte la stessa cosa.
  return {
    key: "sicurezza",
    accent: triggered ? "#e11d48" : "#10b981",
    icon: "🛡️",
    alert: triggered,
    label: t("Sicurezza", "Security"),
    value,
    caption: doors.length ? clean(doors[0].name) || clean(doors[0].entity) : "",
    ring: armed || triggered ? 100 : 0,
    doors,
    alarm: Boolean(alarm),
    armed,
    triggered,
    mode: raw,
  };
}

/* Watt leggibili: sotto il migliaio il numero intero, sopra i kW con due
 * decimali — «1.240 W» non sta in una tessera, «1,24 kW» si'. */
function formatWatts(value) {
  if (value == null) return "—";
  const absolute = Math.abs(value);
  if (absolute >= 1000) return `${formatNumber(value / 1000, 2)} kW`;
  return `${formatNumber(value, 0)} W`;
}

function camerasModel() {
  let cameras = [];
  try {
    cameras = root.getCameras?.() || [];
  } catch (_error) {}
  const rows = (Array.isArray(cameras) ? cameras : [])
    .map((camera) => ({
      entity: clean(camera?.entity),
      name: clean(camera?.name) || clean(camera?.entity),
    }))
    .filter((row) => row.entity && widgetIncludes(row.entity));
  if (!rows.length) return null;
  return {
    key: "telecamere",
    accent: "#0284c7",
    icon: "📹",
    label: t("Telecamere", "Cameras"),
    value: String(rows.length),
    caption: rows[0].name,
    ring: null,
    rows,
  };
}

const ENERGY_SLOTS = Object.freeze([
  ["house", "power", "dm.energy_potenza_consumo_casa"],
  ["solar", "power", "dm.energy_potenza_fotovoltaico"],
  ["grid", "power", "dm.energy_potenza_scambio_rete"],
  ["battery", "power", "dm.energy_potenza_batteria"],
]);

/* La potenza di un'entita', in watt, qualunque unita' dichiari.
 *
 * La tessera leggeva il numero e basta: un contatore che pubblica in kW —
 * normale quanto uno in watt — le faceva scrivere «0 W» sopra una casa che
 * stava consumando duecentosettanta watt, perche' 0,27 arrotondato all'intero
 * e' zero. Il numero grande della tessera diceva il contrario di quello che
 * diceva il flusso, nella stessa pagina, a due dita di distanza. */
function wattsOf(states, entity) {
  return wattsFromState(stateOf(states, entity));
}

/* Le letture dei quattro gruppi di UN impianto.
 *
 * `slot` è la mappatura di sempre, e vale solo per il primo impianto: gli
 * altri non hanno slot — sono nati dopo — e leggono le entità che si sono
 * scritte nel loro gruppo. Senza questa distinzione il secondo impianto, coi
 * campi vuoti, avrebbe letto le entità del primo e detto gli stessi numeri. */
function lettureDellImpianto(states, impianto, primo) {
  const readings = ENERGY_SLOTS.map(([group, field, slot]) => ({
    group,
    watts: wattsOf(states, clean(impianto?.[group]?.[field]) || (primo ? slot : "")),
  }));
  const soc = numOf(
    states,
    clean(impianto?.battery?.soc) || (primo ? "dm.energy_stato_carica_batteria" : ""),
  );
  const rows = readings.filter((row) => row.watts != null);
  if (soc != null) {
    const batteria = rows.find((row) => row.group === "battery");
    if (batteria) batteria.soc = soc;
    else rows.push({ group: "battery", watts: null, soc });
  }
  return {
    rows,
    house: readings.find((row) => row.group === "house")?.watts ?? null,
    today: numOf(
      states,
      clean(impianto?.house?.daily_energy) || (primo ? "dm.energy_consumo_casa_oggi" : ""),
    ),
  };
}

function tesseraEnergia(rows, house, today, { key = "energia", label, impianto = "" } = {}) {
  if (house == null && !rows.length) return null;
  return {
    key,
    accent: "#f97316",
    icon: "⚡",
    label: label || t("Energia", "Energy"),
    /* Di quale impianto parla: la sua finestra porta alla sezione aperta su
     * di lui, non su quello che era rimasto acceso (#286, dal campo). */
    impianto: clean(impianto),
    value: formatWatts(house),
    caption:
      today == null
        ? t("potenza di casa", "home power")
        : `${t("Oggi", "Today")} ${formatNumber(today, 1)} kWh`,
    ring: null,
    rows,
    today,
  };
}

/* Le tessere dell'energia: una, o una per impianto (#286).
 *
 * «Ho due appartamenti uniti con due contatori separati. Tutto bene nella
 * sezione energia ma il widget in Home page è solo quello del primo impianto.»
 * Con un impianto solo esce esattamente la tessera di prima, con la stessa
 * chiave: chi non ha chiesto niente non si accorge che questa funzione è
 * cambiata. */
function energyModels(states) {
  const documento = section("energy", {}) || {};
  const impianti = plantList(documento);
  const configurati = impianti.filter(
    (impianto, indice) => indice === 0 || plantIsConfigured(impianto),
  );
  const letture = configurati.map((impianto, indice) =>
    lettureDellImpianto(states, impianto, indice === 0),
  );
  if (configurati.length < 2) {
    const sola = letture[0] || { rows: [], house: null, today: null };
    return [tesseraEnergia(sola.rows, sola.house, sola.today)].filter(Boolean);
  }
  /* La scelta è una parola, non un oggetto: si legge com'è scritta — come
   * `cd_energy_plant`, che è la casella vicina di casa. */
  if (
    comeSiVedeLEnergia(root.localStorage?.getItem?.(TESSERE_IMPIANTI_KEY)) === TESSERA_PER_IMPIANTO
  ) {
    /* Una per impianto. La prima tiene la chiave di sempre, così l'ordine e la
     * visibilità che si erano già scelti restano suoi; le altre portano il
     * loro id, come fanno le tariffe e i contatori. */
    return configurati
      .map((impianto, indice) =>
        tesseraEnergia(letture[indice].rows, letture[indice].house, letture[indice].today, {
          key: plantKey("energia", impianto, indice),
          label: plantLabel(impianto, indice, t("Impianto", "Plant")),
          impianto: clean(impianto?.id) || PRIMO_IMPIANTO,
        }),
      )
      .filter(Boolean);
  }
  /* Una sola, con la somma: è quello che una Home dice — quanto consuma la
   * casa — e chi ha unito due appartamenti ha una casa sola. */
  return [
    tesseraEnergia(
      sommaLetture(letture.map((lettura) => lettura.rows)),
      sommaNumeri(letture.map((lettura) => lettura.house)),
      sommaNumeri(letture.map((lettura) => lettura.today)),
    ),
  ].filter(Boolean);
}

function appliancesModel(states) {
  const devices = section("appliances", readJson("cd_appliances", []));
  if (!Array.isArray(devices) || !devices.length) return null;
  const fuori = widgetExcludedEntities();
  const rows = devices
    .filter((device) => device?.enabled !== false)
    .filter((device) =>
      widgetIncludes(clean(device?.power_entity || device?.entity || device?.entities?.[0]), fuori),
    )
    .map((device) => {
      const model = createApplianceViewModel(device, states, [], "it");
      return {
        id: model.id || clean(device.id),
        name: model.name,
        mode: model.mode,
        watts: model.watts,
        /* Lo stesso disegno della sua pagina.
         *
         * Qui si chiedeva al runtime storico, che conosce un elenco piu' corto
         * e risponde «generico» per tutto il resto: lo stesso apparecchio
         * aveva l'oblo' nella sezione e una bolla anonima in Home. */
        type: applianceVisualKey(device),
      };
    });
  if (!rows.length) return null;
  const running = rows.filter((row) => row.mode === "running");
  return {
    key: "elettrodomestici",
    accent: "#06b6d4",
    icon: "🫧",
    label: t("Elettrodomestici", "Appliances"),
    value: String(running.length),
    caption: nomiAccesi(running, () => true, t("in funzione", "running")),
    ring: Math.round((running.length / rows.length) * 100),
    rows,
    running,
  };
}

function temperatureModel(states) {
  const rooms = root.getStanze?.() || readJson("cd_stanze", []);
  if (!Array.isArray(rooms)) return null;
  const fuori = widgetExcludedEntities();
  const rows = rooms
    .filter((room) => clean(room?.temp) && widgetIncludes(room.temp, fuori))
    .map((room) => {
      const temperature = numOf(states, room.temp);
      const humidity = numOf(
        states,
        clean(room.hum) || clean(room.temp).replace("_temperature", "_humidity"),
      );
      /* L'entita' resta sulla riga: senza, la finestra non sa a chi chiedere
       * lo storico, e la Temperatura non poteva mai avere la sua analisi nel
       * tempo. */
      return {
        name: clean(room.name) || clean(room.id),
        entity: clean(room.temp),
        temperature,
        humidity,
      };
    })
    .filter((row) => row.temperature != null);
  if (!rows.length) return null;
  const average = rows.reduce((sum, row) => sum + row.temperature, 0) / rows.length;
  const humidities = rows.map((row) => row.humidity).filter((value) => value != null);
  const humidity = humidities.length
    ? Math.round(humidities.reduce((sum, value) => sum + value, 0) / humidities.length)
    : null;
  /* La stanza scelta al posto della media (#303): con una pompa di calore che
   * d'inverno scalda una stanza a trenta gradi, la media non dice niente. */
  const scelta = sorgenteDelWidget("temperatura");
  const sola = scelta ? rows.find((row) => row.entity === scelta) : null;
  return {
    key: "temperatura",
    accent: "#ef4444",
    icon: "🌡️",
    label: t("Temperatura", "Temperature"),
    value: `${formatNumber(sola ? sola.temperature : average, 1)}°`,
    caption: sola
      ? [sola.name, sola.humidity == null ? "" : `${t("Umidità", "Humidity")} ${Math.round(sola.humidity)}%`]
          .filter(Boolean)
          .join(" · ")
      : humidity == null
        ? ""
        : `${t("Umidità", "Humidity")} ${humidity}%`,
    ring: null,
    rows,
  };
}

/* ── le sezioni che mancavano al ponte ────────────────────────────────── */

/* «Lo switch per widget non e' presente in tutte le sezioni: EV, solare
 * termico, eccetera.» L'interruttore accanto a un'entita' dice se quel dato
 * va in Home, e non aveva senso dove una tessera non esisteva. Quindi
 * esistono: l'auto, il solare termico, la piscina e l'irrigazione hanno la
 * loro, con lo stesso mestiere delle altre — un numero, un anello, una
 * parola — e al tocco il dettaglio. */

/* Il riferimento di una entita' mappata, se la scelta la lascia passare. */
function refValue(states, ref, fuori) {
  const risolto = clean(root.resolveEntity?.(ref) || ref);
  if (!risolto || risolto === ref) return null;
  if (!widgetIncludes(risolto, fuori)) return null;
  return { entity: risolto, value: numOf(states, risolto), state: clean(states?.[risolto]?.state) };
}

/* La carica dell'auto sa rispondere a tre nomi.
 *
 * La sezione EV li accetta tutti e tre — quello storico in italiano e i due
 * piu' recenti — e la tessera guardava solo il primo: con una mappatura
 * moderna e senza autonomia configurata, la tessera dell'auto spariva del
 * tutto. Chi legge la stessa cosa deve conoscere gli stessi nomi. */
const RIF_BATTERIA_EV = Object.freeze(["dm.ev_batteria_auto", "dm.ev_battery", "dm.ev_soc"]);

/* Le vetture configurate, ognuna con la SUA mappatura.
 *
 * Il riferimento `dm.ev_batteria_auto` ne indica una sola: quella in uso. E'
 * giusto per la pagina EV — li' si guarda un'auto per volta e si sceglie quale
 * — ma la tessera in Home e' un colpo d'occhio sulla casa, e una casa con due
 * auto ne ha due da guardare. Chi ha due vetture vedeva sempre e solo quella
 * che aveva messo in uso per ultima, senza nessun modo di accorgersi che
 * l'altra era a secco.
 *
 * La mappatura di ciascuna sta nel suo profilo — e' la stessa che «Usa» copia
 * nelle chiavi globali — quindi si legge di li', senza toccare niente. */
function vetture() {
  const elenco = section("ev", readJson("cd_ev_cars", []));
  return (Array.isArray(elenco) ? elenco : []).filter((auto) => auto && typeof auto === "object");
}

/* Se l'auto e' attaccata alla presa, leggendo lo stato della ricarica.
 *
 * Cercare dentro allo stato le parole «charging» o «plug» non basta e anzi fa
 * il danno peggiore: «not_charging», «disconnected» e «unplugged» contengono
 * la stessa parola e dicono l'esatto contrario — la tessera si accendeva
 * proprio quando il cavo era staccato. Prima si guardano le negazioni, e solo
 * su quel che resta si cerca la parola buona.
 *
 * Le lettere singole sono la norma IEC 61851, che evcc pubblica cosi': A
 * nessun veicolo, B collegato, C e D in carica, E ed F guasto. */
export function autoAllaPresa(stato) {
  const testo = String(stato ?? "")
    .trim()
    .toLowerCase();
  if (!testo) return false;
  if (/^[a-f]$/.test(testo)) return testo === "b" || testo === "c" || testo === "d";
  if (SPINA_NO.test(testo)) return false;
  return SPINA_SI.test(testo);
}

const SPINA_NO =
  /(not[\s_-]*charging|dis[\s_-]*connect|un[\s_-]*plug|no[nt]?[\s_-]*(in[\s_-]*)?carica|no[nt]?[\s_-]*colleg|scolleg|staccat|no[\s_-]*vehicle|not[\s_-]*connect)/;
const SPINA_SI = /(charging|carica|plug|connect|conness|colleg)/;

function letturaVettura(states, auto, fuori, indice) {
  const mappa = auto?.ov || auto?.overrides || {} || {};
  const visti = new Set();
  const misura = (riferimento) => {
    const entity = clean(mappa[riferimento]);
    if (!entity || !widgetIncludes(entity, fuori)) return null;
    visti.add(entity);
    return { entity, value: numOf(states, entity), state: clean(states?.[entity]?.state) };
  };
  /* L'auto a benzina (#208): il livello che la tessera mostra e' il
   * carburante — stessa scala, stessa domanda. Decide il tipo di motore, non
   * quale casella e' rimasta compilata: una vettura passata a benzina puo'
   * avere ancora addosso la batteria di quando era elettrica, e la tessera
   * diceva «carica» mentre la pagina diceva serbatoio. Senza tipo, la
   * batteria se c'e', e il serbatoio solo al suo posto. */
  const aBenzina = clean(auto?.tipo) === "termica";
  let carica = null;
  let serbatoio = null;
  if (aBenzina) {
    serbatoio = misura("dm.ev_carburante");
    carica = serbatoio;
  }
  if (!carica) {
    for (const riferimento of RIF_BATTERIA_EV) {
      carica = misura(riferimento);
      if (carica) break;
    }
  }
  if (!carica) {
    serbatoio = misura("dm.ev_carburante");
    carica = serbatoio;
  }
  const autonomia = misura("dm.ev_autonomia");
  const stato = misura("dm.ev_stato_ricarica");
  if (!carica && !autonomia) return null;
  const percentuale = carica?.value == null ? null : Math.max(0, Math.min(100, carica.value));
  /* Potenza e traguardo si SBIRCIANO senza segnarli fra i visti: la potenza
   * resta anche una casella fra le altre, qui serve solo a dire quando la
   * carica finisce — «ora l'auto e' in carica ma non dice quando finisce». */
  const sbircia = (riferimento) => {
    const entity = clean(mappa[riferimento]);
    return entity && widgetIncludes(entity, fuori) ? numOf(states, entity) : null;
  };
  return {
    nome: clean(auto?.name) || clean(auto?.model) || `${t("Auto", "Car")} ${indice + 1}`,
    percentuale,
    carburante: Boolean(serbatoio),
    km: autonomia?.value == null ? null : autonomia.value,
    ricarica: stato?.state || "",
    kw: sbircia("dm.ev_potenza_ricarica"),
    target: sbircia("dm.ev_target_soc"),
    altre: altreCaselleEv(states, mappa, fuori, visti),
  };
}

/* Una riga qualunque, da una entita' qualunque.
 *
 * Serve alle sezioni fatte a caselle — l'auto, il solare, la piscina — dove
 * l'interruttore «nel widget» sta accanto a OGNI casella mappata, ma la
 * tessera ne leggeva soltanto tre o quattro scelte a mano: l'interruttore
 * poteva solo togliere, mai mettere, e acceso non faceva niente. Chi legge
 * deve conoscere le stesse caselle che l'interruttore governa.
 *
 * Cosa esce dipende da cosa dice l'entita': un numero con la sua unita', un
 * acceso/spento quando lo stato e' uno dei due, altrimenti lo stato cosi'
 * com'e'. Chi non sa dire niente — «unknown», «unavailable» — non fa riga. */
function rigaDaEntita(states, entity, glifo = "•") {
  const chiave = clean(entity);
  if (!chiave) return null;
  const stato = stateOf(states, chiave);
  const grezzo = clean(stato?.state);
  if (STATI_MUTI.test(grezzo)) return null;
  const nome = friendlyName(states, chiave);
  const numero = numOf(states, chiave);
  /* Accanto al testo che si legge, il dato grezzo per chi conta.
   *
   * La riga portava solo il valore gia' formattato — «56.2°», «Acceso» — e chi
   * doveva farci un conto trovava una stringa: `Number("56.2°")` non e' un
   * numero, e l'analisi delle sonde del solare termico non usciva mai. Il
   * testo e' per gli occhi, `raw` e `on` per i conti. */
  if (numero != null) {
    const unita = clean(stato?.attributes?.unit_of_measurement);
    const cifre = Number.isInteger(numero) || Math.abs(numero) >= 100 ? 0 : 1;
    return {
      glyph: glifo,
      /* Il nome senza la parola che il numero dice gia': «Temperatura Pannello
       * solare Temperature» diventa «Temperatura Pannello solare». La seconda
       * parola arriva dall'incastro fra il nome del dispositivo, scritto da chi
       * abita la casa, e quello dell'entita', scritto dall'integrazione. */
      name: nomeDellaLettura(nome, { unita }),
      entity: chiave,
      raw: numero,
      unit: unita,
      value: `${formatNumber(numero, cifre)}${unita ? ` ${unita}` : ""}`,
    };
  }
  /* Da quando sta cosi': Home Assistant lo sa, ed e' la differenza fra «la
   * pompa e' accesa» e «la pompa gira da quaranta minuti» — la seconda dice
   * qualcosa, la prima e' gia' scritta nel colore del cerchio. */
  const daQuando = Date.parse(stato?.last_changed ?? stato?.last_updated ?? "");
  const quando = Number.isFinite(daQuando) ? daQuando : null;
  if (STATI_ACCESI.test(grezzo))
    return {
      glyph: glifo,
      name: nome,
      entity: chiave,
      on: true,
      daQuando: quando,
      value: t("Acceso", "On"),
    };
  if (STATI_SPENTI.test(grezzo))
    return {
      glyph: glifo,
      name: nome,
      entity: chiave,
      on: false,
      daQuando: quando,
      value: t("Spento", "Off"),
    };
  return { glyph: glifo, name: nome, value: grezzo };
}

/* Il disegno di una casella dell'auto, indovinato dal nome del riferimento:
 * sono venti caselle e nessuna porta un'icona scritta da nessuna parte. */
const GLIFI_EV = Object.freeze([
  [/soc|batteria/, "🔋"],
  [/autonomia|odometro|km/, "🛣️"],
  [/cavo|stato_ricarica|modalita/, "🔌"],
  [/energia|potenza|power|prelievo|tensione/, "⚡"],
  [/temperatura/, "🌡️"],
  [/solare/, "☀️"],
]);

function glifoEv(riferimento) {
  for (const [prova, glifo] of GLIFI_EV) if (prova.test(riferimento)) return glifo;
  return "🚗";
}

/* Tutte le caselle dell'auto che sono state mappate, meno quelle gia' dette e
 * quelle che l'interruttore ha messo fuori. */
function altreCaselleEv(states, mappa, fuori, visti) {
  const righe = [];
  for (const riferimento of Object.keys(mappa || {}).sort()) {
    if (!/^dm\.ev_/.test(riferimento)) continue;
    const entity = clean(mappa[riferimento]);
    if (!entity || visti.has(entity) || !widgetIncludes(entity, fuori)) continue;
    const riga = rigaDaEntita(states, entity, glifoEv(riferimento));
    if (!riga) continue;
    visti.add(entity);
    righe.push(riga);
  }
  return righe;
}

/* La lettura dell'auto in uso, dalle chiavi globali: e' la strada di sempre, e
 * resta quella per chi di auto ne ha una sola o non ne ha profilate. */
function letturaAttiva(states, fuori) {
  const visti = new Set();
  const misura = (riferimento) => {
    const dato = refValue(states, riferimento, fuori);
    if (dato) visti.add(dato.entity);
    return dato;
  };
  let carica = null;
  for (const riferimento of RIF_BATTERIA_EV) {
    carica = misura(riferimento);
    if (carica) break;
  }
  /* L'auto a benzina (#208): senza una batteria da leggere, il livello che
   * la tessera mostra e' il carburante — stessa scala, stessa domanda. */
  const serbatoio = carica ? null : misura("dm.ev_carburante");
  if (!carica && serbatoio) carica = serbatoio;
  const autonomia = misura("dm.ev_autonomia");
  const stato = misura("dm.ev_stato_ricarica");
  if (!carica && !autonomia) return null;
  /* La mappatura dell'auto in uso e' quella canonica: le stesse caselle che
   * l'interruttore governa nella scheda EV. */
  const mappa = readJson("cd_entity_overrides", {}) || {};
  return {
    nome: "",
    percentuale: carica?.value == null ? null : Math.max(0, Math.min(100, carica.value)),
    carburante: Boolean(serbatoio),
    km: autonomia?.value == null ? null : autonomia.value,
    ricarica: stato?.state || "",
    kw: refValue(states, "dm.ev_potenza_ricarica", fuori)?.value ?? null,
    target: refValue(states, "dm.ev_target_soc", fuori)?.value ?? null,
    altre: altreCaselleEv(states, mappa, fuori, visti),
  };
}

function righeVettura(lettura, conNome) {
  const righe = [];
  const prefisso = conNome && lettura.nome ? `${lettura.nome} · ` : "";
  if (lettura.percentuale != null)
    righe.push({
      glyph: lettura.carburante ? "⛽" : "🔋",
      name: `${prefisso}${lettura.carburante ? t("Carburante", "Fuel") : t("Carica", "Charge")}`,
      value: `${Math.round(lettura.percentuale)}%`,
    });
  if (lettura.km != null)
    righe.push({
      glyph: "🛣️",
      name: `${prefisso}${t("Autonomia", "Range")}`,
      value: `${formatNumber(lettura.km, 0)} km`,
    });
  if (lettura.ricarica)
    righe.push({
      glyph: "🔌",
      name: `${prefisso}${t("Ricarica", "Charging")}`,
      /* La parola, non il codice: «C» e' il gergo della wallbox, e in una
       * casella si legge malissimo. La lettura e' la stessa di `attiva`. */
      value: autoAllaPresa(lettura.ricarica)
        ? t("In carica", "Charging")
        : t("Scollegata", "Unplugged"),
    });
  /* E tutte le altre caselle mappate di questa vettura: sono quelle su cui
   * l'interruttore «nel widget» sta acceso, e finora non uscivano. */
  for (const riga of lettura.altre || [])
    righe.push(prefisso ? { ...riga, name: `${prefisso}${riga.name}` } : riga);
  return righe;
}

function evModel(states) {
  const fuori = widgetExcludedEntities();
  const profilate = vetture()
    .map((auto, indice) => letturaVettura(states, auto, fuori, indice))
    .filter(Boolean);
  /* Il profilo comanda appena e' leggibile, anche da solo: prima, con UNA
   * vettura profilata, si leggevano solo le chiavi globali — che si riempiono
   * ai salvataggi successivi, la foto compresa — e un'auto con la batteria
   * mappata nel SUO profilo restava invisibile in Home finche' non si
   * toccava altro. Le chiavi globali restano il ripiego di chi non ha
   * profili. */
  const letture = profilate.length ? profilate : [letturaAttiva(states, fuori)].filter(Boolean);
  if (!letture.length) return null;
  const piu = letture.length > 1;
  const rows = letture.flatMap((lettura) => righeVettura(lettura, piu));
  if (!rows.length) return null;

  /* Con piu' auto la tessera mostra la piu' scarica: e' quella che chiede
   * qualcosa, ed e' la ragione per cui uno guarda la Home di sfuggita. */
  const cariche = letture.map((lettura) => lettura.percentuale).filter((valore) => valore != null);
  const percentuale = cariche.length ? Math.min(...cariche) : null;
  const kmTotali = letture.map((lettura) => lettura.km).filter((valore) => valore != null);
  const primaKm = kmTotali.length ? Math.min(...kmTotali) : null;
  const didascalia = piu
    ? letture
        .map(
          (lettura) =>
            `${lettura.nome}${lettura.percentuale == null ? "" : ` ${Math.round(lettura.percentuale)}%`}`,
        )
        .join(" · ")
    : percentuale != null && primaKm != null
      ? `${formatNumber(primaKm, 0)} km`
      : "";
  return {
    key: "ev",
    accent: "#06b6d4",
    icon: "🚗",
    label: t("Auto", "Car"),
    value: percentuale == null ? `${formatNumber(primaKm, 0)} km` : `${Math.round(percentuale)}%`,
    caption: didascalia,
    /* La quota qui e' la carica, non «quanto e' attivo»: una macchina ferma
     * al settanta per cento non e' una tessera accesa. Acceso vuol dire
     * attaccata alla presa. */
    ring: percentuale,
    attiva: letture.some((lettura) => autoAllaPresa(lettura.ricarica)),
    /* Quel che serve a dire QUANDO finisce la carica: potenza e traguardo
     * dell'auto attaccata (o della prima). Li usa il motore di analisi con la
     * stessa formula della pagina EV, cosi' i due posti dicono la stessa ora. */
    ricaricaKw:
      (letture.find((lettura) => autoAllaPresa(lettura.ricarica)) || letture[0])?.kw ?? null,
    targetSoc:
      (letture.find((lettura) => autoAllaPresa(lettura.ricarica)) || letture[0])?.target ?? null,
    /* Quante auto ci sono, detto qui e non contato dalle righe.
     *
     * Un'auto sola porta due righe — la carica e l'autonomia — e chi contava le
     * righe ne deduceva due auto: la finestra diceva «una e' in ricarica; la
     * piu' scarica e'...» a chi ne ha una. Le auto le sa questo modello, che le
     * ha appena messe in fila. */
    quante: letture.length,
    rows,
  };
}

/* La tessera degli aspirapolvere.
 *
 * Il ponte ha una tessera per ogni sezione — luci, clima, tapparelle,
 * telecamere, energia, piscina, irrigazione — e per gli aspirapolvere no: la
 * sezione e' arrivata dopo, e nessuno gliel'ha data. Chi ha un robot lo vedeva
 * in Home solo scendendo fino alla sua pagina.
 *
 * Cosa dice: quanti stanno pulendo, o la carica del piu' scarico quando sono
 * tutti fermi — che e' la domanda che si fa guardando la Home di sfuggita. */
function robotsModel(states) {
  const salvati = section("robots", null);
  const robots = normalizeRobots(
    Array.isArray(salvati) && salvati.length ? salvati : readJson("cd_robot", []),
  );
  const fuori = widgetExcludedEntities();
  const viste = robots
    .filter((robot) => clean(robot.entity) && widgetIncludes(clean(robot.entity), fuori))
    .map((robot) => robotView(robot, states));
  if (!viste.length) return null;

  /* «Al lavoro» copre entrambe le specie: chi pulisce e chi taglia. */
  const attivi = viste.filter((vista) => vista.cleaning || vista.mowing);
  const cariche = viste.map((vista) => vista.battery).filter((carica) => carica != null);
  const piuScarico = cariche.length ? Math.min(...cariche) : null;
  return {
    key: "robot",
    accent: "#7c3aed",
    icon: "🤖",
    label: t("Robot", "Robots"),
    value: attivi.length
      ? `${attivi.length}`
      : piuScarico == null
        ? `${viste.length}`
        : `${Math.round(piuScarico)}%`,
    caption: attivi.length
      ? t("al lavoro", "working")
      : piuScarico == null
        ? t("configurati", "configured")
        : t("carica più bassa", "lowest charge"),
    /* L'anello racconta la carica solo quando nessuno sta lavorando: mentre
     * puliscono la notizia e' che stanno pulendo. */
    ring: attivi.length ? null : piuScarico,
    attiva: attivi.length > 0,
    /* Come per l'irrigazione: il testo per gli occhi, i campi grezzi per chi
     * conta. Senza, un aspirapolvere che sta pulendo veniva annunciato come
     * fermo, e l'avviso di batteria scarica non poteva mai uscire. */
    rows: viste.map((vista) => ({
      glyph: vista.mowing ? "🌱" : vista.cleaning ? "🧹" : vista.charging ? "🔌" : "🤖",
      name: vista.name,
      cleaning: vista.cleaning,
      charging: vista.charging,
      state: vista.state,
      battery: vista.battery,
      entity: clean(vista.entity),
      value:
        vista.battery == null
          ? robotStateLabel(vista.state)
          : `${robotStateLabel(vista.state)} · ${Math.round(vista.battery)}%`,
    })),
  };
}

/* Quello che il solare termico ha da dire, casella per casella.
 *
 * Prima erano tre righe fisse — le sonde — chiamate «Sonda 1, 2, 3». Due cose
 * sbagliate in una. La prima: «Sonda 2» non e' il nome di niente, e chi ha il
 * pannello sopra e il boiler sotto quei numeri se li deve ricordare a memoria;
 * il nome vero ce l'ha l'entita', e si legge di li'. La seconda: tutto il
 * resto del solare — le pompe, il delta, la pressione — non entrava mai, e
 * allora l'interruttore «nel widget» acceso su quelle righe non portava
 * niente in Home. Un interruttore che si accende e non fa succedere niente e'
 * peggio di un interruttore che non c'e'.
 *
 * Adesso ogni casella mappata puo' arrivare in Home, e a decidere quali resta
 * l'interruttore. Le temperature portano il loro numero; le pompe e gli
 * interruttori portano acceso o spento, perche' di una pompa quello si
 * guarda. */
/* Quali caselle sono SONDE, e quali no.
 *
 * La finestra diceva «77,9° di salto fra la sonda piu' calda e la piu'
 * fredda» confrontando la temperatura del boiler col Delta — che non e' una
 * sonda: e' gia' una differenza, e a -3° faceva da «piu' fredda» a ogni
 * lettura. E senza il marchio sarebbero entrate nel confronto anche la
 * pressione in bar e la potenza in watt, che un numero grezzo ce l'hanno.
 * `sonda: true` sta solo su cio' che misura una temperatura in un punto. */
const CASELLE_SOLARE = Object.freeze([
  { ref: "dm.boiler_sonda_temperatura_1", glyph: "🌡️", unita: "°", cifre: 1, sonda: true },
  { ref: "dm.boiler_sonda_temperatura_2", glyph: "🌡️", unita: "°", cifre: 1, sonda: true },
  { ref: "dm.boiler_sonda_temperatura_3", glyph: "🌡️", unita: "°", cifre: 1, sonda: true },
  { ref: "dm.boiler_temperatura", glyph: "🌡️", unita: "°", cifre: 1, sonda: true },
  { ref: "dm.boiler_delta_temperatura", glyph: "📐", unita: "°", cifre: 1 },
  { ref: "dm.boiler_pressione_acqua", glyph: "💧", unita: " bar", cifre: 1 },
  { ref: "dm.boiler_potenza_resistenza_boiler", glyph: "⚡", unita: " W", cifre: 0 },
  { ref: "dm.boiler_potenza", glyph: "⚡", unita: " W", cifre: 0 },
  { ref: "dm.boiler_stato_pompa_solare", glyph: "🔄", acceso: true },
  { ref: "dm.boiler_sensore_pompa_solare", glyph: "🔄", acceso: true },
  { ref: "dm.boiler_pompa_solare", glyph: "🔄", acceso: true },
  { ref: "dm.boiler_centralina_solare_termico", glyph: "🎛️", acceso: true },
  { ref: "dm.boiler_interruttore_solare_termico", glyph: "🔌", acceso: true },
  { ref: "dm.boiler_interruttore_boiler", glyph: "🔌", acceso: true },
  { ref: "dm.boiler_valvola_di_sicurezza", glyph: "🛡️", acceso: true },
]);

const STATI_ACCESI = /^(on|true|1|running|attiva|attivo|open|aperta|heat|heating)$/i;
const STATI_SPENTI = /^(off|false|0|idle|ferma|fermo|closed|chiusa|standby)$/i;
/* «unknown» e «unavailable» sono il modo in cui Home Assistant dice «adesso
 * questa entita' non risponde», non «e' spenta». Scriverli come «Spento»
 * significherebbe raccontare per certo il contrario di quello che si sa: una
 * pompa staccata dalla rete verrebbe data per ferma, e una riga che nessuno
 * puo' leggere farebbe comunque numero. Una riga che non sa cosa dire non la
 * si scrive. */
const STATI_MUTI = /^(unknown|unavailable|none|)$/i;

function solarThermalModel(states) {
  const fuori = widgetExcludedEntities();
  const righe = [];
  const visti = new Set();
  let primaSonda = null;
  let pompa = null;
  for (const casella of CASELLE_SOLARE) {
    const dato = refValue(states, casella.ref, fuori);
    if (!dato || visti.has(dato.entity)) continue;
    if (casella.acceso) {
      if (STATI_MUTI.test(dato.state)) continue;
      const attivo = STATI_ACCESI.test(dato.state);
      if (pompa == null && casella.ref.includes("pompa")) pompa = attivo;
      visti.add(dato.entity);
      /* Accanto al testo che si legge, cio' che serve per ragionarci.
       *
       * La riga portava solo «Acceso»: chi legge la sezione per dire da quanto
       * gira la pompa cerca `on` e il momento in cui e' cambiata, non trovava
       * ne' l'uno ne' l'altro, e la frase sulla durata non usciva mai. */
      /* `dato.state` e' la stringa dello stato, non l'oggetto: il momento del
       * cambio sta sull'entita', e lo si va a prendere di la'. */
      const quando = stateOf(states, dato.entity);
      const cambiato = Date.parse(quando?.last_changed ?? quando?.last_updated ?? "");
      righe.push({
        glyph: casella.glyph,
        name: friendlyName(states, dato.entity),
        entity: dato.entity,
        on: attivo,
        daQuando: Number.isFinite(cambiato) ? cambiato : null,
        value: attivo ? t("Acceso", "On") : t("Spento", "Off"),
      });
      continue;
    }
    if (dato.value == null) continue;
    if (primaSonda == null && casella.ref.startsWith("dm.boiler_sonda")) primaSonda = dato.value;
    visti.add(dato.entity);
    righe.push({
      glyph: casella.glyph,
      name: friendlyName(states, dato.entity),
      entity: dato.entity,
      /* Il testo e' per gli occhi, `raw` per i conti: `Number("68°")` non e' un
       * numero, e l'analisi delle sonde non usciva mai. */
      raw: dato.value,
      /* Esplicito su ogni riga numerica: il confronto fra sonde legge questo,
       * e una riga senza marchio per lui e' una sonda — e' la forma che tiene
       * in piedi le righe costruite altrove, dove sono tutte sonde davvero. */
      sonda: casella.sonda === true,
      value: `${formatNumber(dato.value, casella.cifre)}${casella.unita}`,
    });
  }
  if (!righe.length) return null;
  /* Cosa scrivere in grande.
   *
   * Con una sonda e' la sua temperatura, ed e' il caso normale. Senza sonda si
   * scriveva «Attivo» comunque: chi aveva configurato la sola pompa se la
   * vedeva dichiarare attiva anche da ferma, il contrario di quello che
   * diceva la didascalia due righe sotto. Senza sonda parla la pompa; se non
   * c'e' nemmeno quella parla la prima riga, che qualcosa da dire ce l'ha. */
  const inGrande =
    primaSonda != null
      ? `${formatNumber(primaSonda, 1)}°`
      : pompa != null
        ? pompa
          ? t("Acceso", "On")
          : t("Spento", "Off")
        : righe[0].value;
  return {
    key: "solare",
    accent: "#f59e0b",
    icon: "🌞",
    label: t("Solare termico", "Solar thermal"),
    value: inGrande,
    caption:
      pompa == null
        ? ""
        : pompa
          ? t("Pompa in funzione", "Pump running")
          : t("Pompa ferma", "Pump idle"),
    ring: null,
    // La quota qui non c'e': la tessera si accende quando la pompa lavora.
    attiva: Boolean(pompa),
    rows: righe,
  };
}

/* Le caselle di una vasca che sono comandi, non letture: la pompa, il
 * riscaldamento, la luce. Si accendono e si spengono, e nella finestra devono
 * avere un interruttore invece di una scritta. */
const COMANDI_PISCINA = Object.freeze({ pumpEnt: "🔄", heatEnt: "🔥", lightEnt: "💡" });

/* La tessera dello scaldabagno (#253).
 *
 * «La card attuale e' fantastica ma pensata per il solare termico»: quella
 * guarda il salto fra le sonde, perche' li' il calore arriva dal sole e la
 * domanda e' se la pompa conviene farla girare. Qui il calore arriva da una
 * resistenza che si paga, e la domanda e' un'altra: quanto manca all'acqua
 * calda. Percio' il numero grande e' la temperatura dell'acqua e l'anello e'
 * la distanza dall'obiettivo — non una percentuale inventata.
 */
export function configuredScaldabagni() {
  return readJson(SCALDABAGNI_KEY, []);
}

const GLIFI_SCALDABAGNO = Object.freeze({
  interruttore: "🔌",
  temperatura: "🌡️",
  obiettivo: "🎯",
  potenza: "⚡",
  energia: "📅",
});

function scaldabagnoModel(states) {
  const fuori = widgetExcludedEntities();
  const letture = lettureScaldabagni(
    configuredScaldabagni(),
    states,
    root.resolveEntity || ((value) => value),
  ).filter((lettura) =>
    /* L'interruttore «nel widget»: basta che UNA delle caselle sia rimasta
     * dentro perche' la riga abbia ancora qualcosa da dire in Home. */
    entitaDiUnoScaldabagno(lettura).some((entity) => widgetIncludes(entity, fuori)),
  );
  if (!letture.length) return null;

  const piuDiUno = letture.length > 1;
  const nomeDi = (lettura, indice) =>
    clean(lettura.name) || `${t("Scaldabagno", "Water heater")} ${indice + 1}`;
  const etichetta = (lettura, indice, testo) =>
    piuDiUno ? `${nomeDi(lettura, indice)} · ${testo}` : testo;

  const rows = [];
  letture.forEach((lettura, indice) => {
    if (lettura.comandabile)
      rows.push({
        glyph: GLIFI_SCALDABAGNO.interruttore,
        name: etichetta(lettura, indice, t("Resistenza", "Heating element")),
        entity: lettura.comandabile,
        on: lettura.acceso === true,
        value: lettura.acceso === true ? t("Acceso", "On") : t("Spento", "Off"),
        /* Un interruttore, non una scritta — salvo che quella entita' sia fra
         * quelle che si guardano e basta. */
        comando: siComanda(lettura.comandabile),
      });
    const misura = (chiave, testo, valore, cifre, unita) => {
      if (valore == null) return;
      rows.push({
        glyph: GLIFI_SCALDABAGNO[chiave],
        name: etichetta(lettura, indice, testo),
        entity: clean(lettura[chiave === "temperatura" ? "entity" : chiave]) || lettura.entity,
        raw: valore,
        value: `${formatNumber(valore, cifre)}${unita}`,
      });
    };
    misura("temperatura", t("Acqua adesso", "Water now"), lettura.temperatura, 1, "°");
    misura("obiettivo", t("Obiettivo", "Target"), lettura.obiettivo, 1, "°");
    misura("potenza", t("Consumo", "Power"), lettura.potenza, 0, " W");
    misura("energia", t("Oggi", "Today"), lettura.energia, 1, " kWh");
  });
  if (!rows.length) return null;

  /* Chi parla in grande: la prima riga che ha una temperatura dell'acqua. Se
   * nessuno ce l'ha — c'e' solo il rele' — parla l'interruttore, che qualcosa
   * da dire ce l'ha. */
  const testa = letture.find((lettura) => lettura.temperatura != null) || letture[0];
  const acceso = letture.some((lettura) => lettura.acceso === true);
  const scalda = letture.some((lettura) => lettura.stato === "scalda");
  const didascalia = () => {
    if (testa.stato === "spento") return t("Spento", "Off");
    if (testa.stato === "pronto") return t("Acqua pronta", "Water ready");
    if (testa.stato === "scalda") {
      if (testa.obiettivo == null) return t("Sta scaldando", "Heating");
      /* Il numero si tira fuori prima: la chiave di traduzione deve essere una
       * frase con un buco — «Scalda verso ${meta}°» — non un pezzo di codice
       * che nessun traduttore puo' leggere. */
      const meta = formatNumber(testa.obiettivo, 0);
      return t(`Scalda verso ${meta}°`, `Heating to ${meta}°`);
    }
    return "";
  };
  return {
    key: "scaldabagno",
    accent: "#ea580c",
    icon: "🚿",
    label: t("Scaldabagno", "Water heater"),
    value:
      testa.temperatura != null
        ? `${formatNumber(testa.temperatura, 1)}°`
        : acceso
          ? t("Acceso", "On")
          : t("Spento", "Off"),
    caption: didascalia(),
    /* L'anello dice quanto manca all'acqua calda, che e' la sola cosa per cui
     * si guarda uno scaldabagno. Senza obiettivo non c'e' corsa: niente
     * anello, invece di un cerchio pieno a caso. */
    ring: testa.quota == null ? null : Math.round(testa.quota * 100),
    // La tessera si accende mentre la resistenza lavora, non quando e' finita.
    attiva: scalda,
    /* Le letture per unita', accanto alle righe: la frase della finestra parla
     * di acqua calda e di gradi che mancano, non del numero di caselle accese
     * — contando le righe direbbe «uno su otto in funzione», che di uno
     * scaldabagno non e' una notizia. */
    unita: letture,
    rows,
  };
}

/* La tessera della caldaia (#253).
 *
 * Di una caldaia non si guarda una temperatura: si guarda il SALTO fra
 * mandata e ritorno, perche' due numeri vicini su una caldaia accesa vogliono
 * dire che l'acqua gira senza scaldare niente. E si guarda la pressione, che
 * e' l'unica cosa di quell'impianto che ogni tanto chiede di alzarsi dal
 * divano: sotto il bar il pressostato blocca tutto, e accorgersene dalla Home
 * e' meglio che accorgersene da una doccia fredda. */
function caldaiaModel(states) {
  const config = readJson(CHIAVE_CALDAIA, {});
  const entita = entitaDelleCaldaie(config);
  if (!entita.length) return null;
  const fuori = widgetExcludedEntities();
  if (!entita.some((entity) => widgetIncludes(entity, fuori))) return null;
  const dati = normalizzaCaldaie(config);
  const letture = lettureCaldaie(config, states, root.resolveEntity || ((value) => value));
  /* Con piu' di una caldaia (#281) il numero grande e la didascalia sono
   * quelli della prima che ha qualcosa da dire — quella accesa, se ce n'e' una
   * — e le righe della finestra le portano tutte, col nome davanti. */
  const accesa = letture.find((riga) => riga.acceso === true || riga.fiamma === true);
  const lettura = accesa || letture[0];
  if (!lettura) return null;
  const pressione = verdettoPressione(lettura.pressione);
  const piuDiUna = letture.length > 1;

  const rows = [];
  letture.forEach((riga, indice) => {
    const dato = dati[indice] || {};
    /* Il nome davanti solo quando ce n'e' piu' d'una: con una sola sarebbe
     * ripetuto su ogni riga e non distinguerebbe niente. */
    const suo = (testo) =>
      piuDiUna
        ? `${clean(riga.name) || `${t("Caldaia", "Boiler")} ${indice + 1}`} · ${testo}`
        : testo;
    if (clean(dato.fiamma) || clean(dato.stato))
      rows.push({
        glyph: "🔥",
        name: suo(t("Bruciatore", "Burner")),
        entity: clean(dato.fiamma) || clean(dato.stato),
        on: riga.fiamma === true || riga.acceso === true,
        value:
          riga.fiamma === true || riga.acceso === true ? t("Acceso", "On") : t("Spento", "Off"),
      });
    const misura = (campo, testo, glyph, valore, cifre, unita) => {
      if (valore == null) return;
      rows.push({
        glyph,
        name: suo(testo),
        entity: clean(dato[campo]),
        raw: valore,
        value: `${formatNumber(valore, cifre)}${unita}`,
      });
    };
    misura("mandata", t("Mandata", "Flow"), "🌡️", riga.mandata, 1, "°");
    misura("ritorno", t("Ritorno", "Return"), "🌡️", riga.ritorno, 1, "°");
    misura("acquaCalda", t("Acqua calda", "Hot water"), "🚿", riga.acquaCalda, 1, "°");
    misura("pressione", t("Pressione", "Pressure"), "📊", riga.pressione, 1, " bar");
    misura("modulazione", t("Modulazione", "Modulation"), "📶", riga.modulazione, 0, "%");
  });
  if (!rows.length) return null;

  const acceso = lettura.fiamma === true || lettura.acceso === true;
  const didascalia = () => {
    if (pressione === "bassa") return t("Pressione bassa: rabbocca", "Pressure low: top it up");
    if (lettura.salto != null) {
      /* Il numero si tira fuori prima: la chiave di traduzione deve essere una
       * frase con un buco, non un pezzo di codice. */
      const salto = formatNumber(lettura.salto, 1);
      return t(`Salto ${salto}°`, `Delta ${salto}°`);
    }
    return acceso ? t("Bruciatore acceso", "Burner on") : t("Bruciatore spento", "Burner off");
  };
  return {
    key: "caldaia",
    accent: "#ef4444",
    icon: "🔥",
    label: t("Caldaia", "Boiler"),
    value:
      lettura.mandata != null
        ? `${formatNumber(lettura.mandata, 1)}°`
        : acceso
          ? t("Accesa", "On")
          : t("Spenta", "Off"),
    caption: didascalia(),
    ring: lettura.modulazione == null ? null : Math.round(lettura.modulazione),
    // La tessera si accende quando il bruciatore lavora.
    attiva: acceso,
    /* Una pressione sotto il minimo e' l'unica cosa di questa pagina che
     * chiede di fare qualcosa: la tessera lo dice col suo alone, come le
     * altre quando c'e' da guardare. */
    alert: pressione === "bassa",
    lettura,
    rows,
  };
}

/* La tessera del gruppo di continuita' (#256).
 *
 * «Vedere se c'e' tensione o no, lo stato della batteria e il carico»: tre
 * domande, e la prima comanda le altre due. A rete presente la carica e' una
 * conferma tranquilla — sta al cento per cento perche' non e' successo niente
 * — e la tessera sta zitta col numero della batteria. Quando la rete cade
 * quelle stesse cifre diventano un conto alla rovescia, e allora il numero
 * grande e' l'autonomia: e' l'unica cosa che in quel momento si vuole sapere.
 *
 * Percio' la tessera non mostra sempre lo stesso valore. Non e' un capriccio:
 * un UPS si guarda due volte in tutta la sua vita, e una delle due e' al buio.
 */
function upsModel(states) {
  const config = readJson(CHIAVE_UPS, {});
  const entita = entitaDellUps(config);
  if (!entita.length) return null;
  const fuori = widgetExcludedEntities();
  if (!entita.some((entity) => widgetIncludes(entity, fuori))) return null;
  const lettura = letturaUps(config, states, root.resolveEntity || ((value) => value));
  const dato = normalizzaUps(config);

  const rows = [];
  const casella = clean(dato.rete) || clean(dato.stato);
  if (casella)
    rows.push({
      glyph: "🔌",
      name: t("Rete elettrica", "Mains power"),
      entity: casella,
      on: lettura.rete === true,
      value:
        lettura.rete === true
          ? t("Presente", "Present")
          : lettura.rete === false
            ? t("Manca", "Missing")
            : t("Sconosciuta", "Unknown"),
    });
  const misura = (campo, testo, glyph, valore, cifre, unita) => {
    if (valore == null) return;
    rows.push({
      glyph,
      name: testo,
      entity: clean(dato[campo]),
      raw: valore,
      value: `${formatNumber(valore, cifre)}${unita}`,
    });
  };
  misura("batteria", t("Batteria", "Battery"), "🔋", lettura.batteria, 0, "%");
  misura("carico", t("Carico", "Load"), "📊", lettura.carico, 0, "%");
  misura("autonomia", t("Autonomia residua", "Runtime left"), "⏳", lettura.autonomia, 0, " min");
  misura("tensione", t("Tensione", "Voltage"), "⚡", lettura.tensione, 0, " V");
  misura("potenza", t("Potenza", "Power"), "🔥", lettura.potenza, 0, " W");
  misura("temperatura", t("Temperatura", "Temperature"), "🌡️", lettura.temperatura, 1, "°");
  if (!rows.length) return null;

  const aBatteria = lettura.rete === false;
  const didascalia = () => {
    if (aBatteria) {
      /* Il numero si tira fuori prima: la chiave di traduzione dev'essere una
       * frase con un buco, non un pezzo di codice. */
      if (lettura.batteria != null) {
        const carica = formatNumber(lettura.batteria, 0);
        return t(`Va a batteria · ${carica}%`, `On battery · ${carica}%`);
      }
      return t("Va a batteria", "On battery");
    }
    if (lettura.rete === true) {
      if (lettura.scarica) return t("Batteria scarica", "Battery low");
      if (lettura.carico != null) {
        const carico = formatNumber(lettura.carico, 0);
        return t(`Rete presente · carico ${carico}%`, `Mains present · load ${carico}%`);
      }
      return t("Rete presente", "Mains present");
    }
    return t("Non risponde", "Not answering");
  };
  return {
    key: "ups",
    accent: "#0ea5e9",
    icon: "🔋",
    label: t("Continuità", "Backup power"),
    /* A rete caduta parla l'autonomia, perche' e' il tempo che resta; a rete
     * presente parla la batteria, perche' e' la conferma che il tempo c'e'. */
    value:
      aBatteria && lettura.autonomia != null
        ? `${formatNumber(lettura.autonomia, 0)} min`
        : lettura.batteria != null
          ? `${formatNumber(lettura.batteria, 0)}%`
          : lettura.rete === true
            ? t("In rete", "On mains")
            : t("A batteria", "On battery"),
    caption: didascalia(),
    // L'anello e' la carica: quanto tempo c'e' ancora dentro quella scatola.
    ring: lettura.batteria == null ? null : Math.round(lettura.batteria),
    // La tessera si accende quando la casa sta andando a batteria.
    attiva: aBatteria,
    /* L'alone: la rete caduta, o la batteria sotto la soglia anche a rete
     * presente — che vuol dire che non ha finito di ricaricarsi dal guasto di
     * prima, e il prossimo la trova impreparata. */
    alert: lettura.allarme === true,
    lettura,
    da: daQuandoUps(config, states, root.resolveEntity || ((value) => value)),
    rows,
  };
}

/* Una cosa sola: l'agenda (#259).
 *
 * «Devono essere un'unica sezione: nel calendario ci sono gli appuntamenti,
 * invece cose da fare e' una lista. O crei un widget popup unico con tutte e
 * due le sezioni.»
 *
 * Ha ragione, ed erano due tessere che si somigliavano troppo: due mattonelle
 * vicine con la stessa faccia — un elenco di righe con un titolo sopra — che
 * chiedevano a chi guarda di ricordarsi quale era quale. Ma non sono la stessa
 * cosa, e nemmeno vanno mescolate in un elenco solo: un appuntamento succede
 * a un'ora e non si spunta, una cosa da fare si spunta e un'ora non ce l'ha.
 *
 * Percio' una tessera, e dentro due blocchi che restano riconoscibili: sopra
 * gli IMPEGNI, giorno per giorno, con la loro ora; sotto le COSE DA FARE, con
 * la loro casella da spuntare. Una finestra sola in cui si legge la giornata
 * intera invece di aprirne due per farsene un'idea.
 *
 * Il numero grande e' quello che si guarda di sfuggita — quanti impegni
 * restano oggi — e la didascalia porta i due prossimi piu' quante cose
 * restano da fare. */
function agendaModel(states) {
  const calendario = calendarioModel();
  const cose = todoModel(states);
  if (!calendario && !cose) return null;

  const daFare = cose ? contaDaFare(cose) : 0;
  const adesso = Date.now();
  const inCorsoAdesso = Boolean(calendario?.primi?.length && inCorso(calendario.primi[0], adesso));

  /* La didascalia dice le due cose insieme quando ci sono tutte e due: «17:30
   * Dentista · 4 da fare». Con una sola resta quella, senza il puntino che
   * separerebbe da niente. */
  const pezzi = [];
  if (calendario && calendario.primi.length) pezzi.push(calendario.caption);
  else if (calendario) pezzi.push(calendario.caption);
  if (daFare) pezzi.push(t(`${daFare} da fare`, `${daFare} to do`));
  else if (cose) pezzi.push(t("Tutto fatto", "All done"));

  return {
    key: "agenda",
    accent: "#6366f1",
    icon: "📅",
    label: t("Agenda", "Agenda"),
    /* Il numero grande resta quello degli impegni di oggi quando c'e' un
     * calendario; chi ha solo le liste vede quante cose gli restano, che per
     * lui e' la stessa domanda. */
    value: calendario ? calendario.value : String(daFare),
    caption: pezzi.filter(Boolean).join("  ·  "),
    /* Nessun anello: mescolare la percentuale di cose spuntate con gli
     * appuntamenti darebbe un cerchio che non risponde a niente. */
    ring: null,
    // Si accende mentre un impegno sta succedendo, o se resta qualcosa da fare.
    attiva: inCorsoAdesso || daFare > 0,
    /* I due pezzi restano interi: la finestra li disegna uno sotto l'altro, e
     * ognuno tiene i gesti che aveva — la matita sugli impegni, la spunta
     * sulle cose da fare. */
    calendario,
    cose,
    // Quello che serve al racconto della finestra, senza doverlo ripescare.
    primi: calendario?.primi || [],
    eventi: calendario?.eventi || [],
    inArrivo: Boolean(calendario?.inArrivo),
    calendari: calendario?.calendari || [],
    daFare,
    blocks: cose?.blocks || [],
  };
}

/* Quante cose restano da fare, in tutte le liste. */
function contaDaFare(tessera) {
  return (tessera.blocks || []).reduce(
    (somma, blocco) => somma + pendingTodoItems(blocco.items || []).length,
    0,
  );
}

function poolModel(states) {
  const config = root.getPool?.() || readJson("cd_piscina", {});
  if (!config || typeof config !== "object") return null;
  const fuori = widgetExcludedEntities();
  /* Tutte le vasche, non solo la prima.
   *
   * Qui si leggeva `config` cosi' com'e', che sono le caselle della PRIMA
   * vasca: le altre stanno in un elenco accanto, e la finestra della Home non
   * le ha mai viste. Chi ne ha due vedeva sempre e solo quella di sopra.
   * `poolList` e' lo stesso elenco che legge la scheda di configurazione — un
   * padrone solo per la domanda «quante vasche ci sono». */
  const vasche = poolList(config);
  const piuDiUna = vasche.length > 1;
  /* Col nome davanti solo quando serve distinguere: con una vasca sola
   * «Piscina · Acqua» sarebbe una parola in piu' a ogni riga. */
  const etichetta = (pool, index, testo) =>
    piuDiUna ? `${clean(pool.name) || `${t("Piscina", "Pool")} ${index + 1}`} · ${testo}` : testo;

  const rows = [];
  const visti = new Set();
  vasche.forEach((pool, index) => {
    const leggi = (chiave, testo, glyph, unita = "") => {
      const entity = clean(pool[chiave]);
      if (!entity || visti.has(entity) || !widgetIncludes(entity, fuori)) return;
      const valore = numOf(states, entity);
      if (valore == null) return;
      visti.add(entity);
      rows.push({
        glyph,
        name: etichetta(pool, index, testo),
        value: `${formatNumber(valore, 1)}${unita}`,
        raw: valore,
        entity,
      });
    };
    leggi("tempEnt", t("Acqua", "Water"), "🌡️", "°");
    leggi("phEnt", "pH", "🧪");
    leggi("clEnt", t("Cloro", "Chlorine"), "💧");

    /* E tutto il resto che e' stato mappato: pompa, riscaldamento, luce.
     *
     * La tessera ne leggeva tre — acqua, pH, cloro — mentre l'interruttore «nel
     * widget» sta accanto a ognuna delle caselle della scheda. Acceso su una
     * delle altre non faceva niente, perche' qui non le guardava nessuno.
     *
     * E adesso si comandano: erano scritte e basta, quindi la luce della
     * piscina si vedeva accesa e dalla finestra non si poteva spegnere. */
    for (const [chiave, glifo] of Object.entries(COMANDI_PISCINA)) {
      const entity = clean(pool[chiave]);
      if (!entity || visti.has(entity) || !widgetIncludes(entity, fuori)) continue;
      const riga = rigaDaEntita(states, entity, glifo);
      if (!riga) continue;
      visti.add(entity);
      rows.push({
        ...riga,
        name: etichetta(pool, index, riga.name),
        /* Un interruttore, non una scritta — a meno che questa entita' sia
         * fra quelle che si guardano e basta. */
        comando: siComanda(entity),
      });
    }
  });
  if (!rows.length) return null;
  const acqua = rows.find((riga) => riga.name === t("Acqua", "Water"));
  /* Sotto il numero grande sta la seconda cosa che si vuole sapere.
   *
   * Era sempre il pH, scritto anche quando la sonda del pH non c'era: la
   * tessera di una piscina con la sola pompa mappata mostrava «pH —», cioe'
   * annunciava un dato per dire che non ce l'aveva. Se il pH c'e' e' lui,
   * altrimenti parla la prima riga rimasta; se non ne resta nessuna, niente. */
  const testa = acqua || rows[0];
  const compagna =
    rows.find((riga) => riga.name === "pH" && riga !== testa) ||
    rows.find((riga) => riga !== testa);
  return {
    key: "piscina",
    accent: "#0ea5e9",
    icon: "🏊",
    label: t("Piscina", "Pool"),
    value: testa.value,
    caption: compagna ? `${compagna.name} ${compagna.value}` : "",
    ring: null,
    rows,
  };
}

const IRRIGAZIONE_ATTIVA = /^(on|true|open|opening|running|attiva)$/;

/** Se questa zona sta bagnando, comunque la sua entita' lo dica. */
function zonaInFunzione(states, zona) {
  const stato = clean(states?.[clean(zona?.entity)]?.state).toLowerCase();
  return IRRIGAZIONE_ATTIVA.test(stato);
}

/* La tessera delle Prese.
 *
 * La sezione e' nata senza, ed e' stato segnalato subito: una sezione nuova
 * entra nel ponte con la stessa logica delle altre, non alla prima
 * segnalazione. Le righe sono comandi — un interruttore per presa, come la
 * pompa della piscina — e il blocco «si vede ma non si comanda» vale anche
 * qui, perche' l'interruttore compare solo dove `siComanda` dice di si'. */
function preseModel(states) {
  const canonico = section("sockets", null);
  const grezzo = Array.isArray(canonico) && canonico.length ? canonico : readJson("cd_prese", []);
  const prese = normalizzaPrese(grezzo).filter((presa) => clean(presa.entity));
  if (!prese.length) return null;
  const fuori = widgetExcludedEntities();
  const rows = [];
  for (const presa of prese) {
    if (!widgetIncludes(presa.entity, fuori)) continue;
    const stato = stateOf(states, presa.entity);
    if (!stato) continue;
    const grezzo = clean(stato.state).toLowerCase();
    /* Assente non e' spento: `unavailable` e `unknown` dicono che lo stato
     * non si conosce, non che la presa e' spenta. La riga lo dice, e il tasto
     * non finge di poter comandare quello che non risponde. */
    const disponibile = grezzo !== "unavailable" && grezzo !== "unknown";
    rows.push({
      // Il disegno del catalogo di casa; l'emoji resta per i valori vecchi.
      glyph: iconaPresaMarkup(presa.icon, 17),
      name: clean(presa.name) || presa.entity,
      entity: presa.entity,
      on: grezzo === "on",
      comando: siComanda(presa.entity) && disponibile,
      value: !disponibile
        ? t("Non disponibile", "Unavailable")
        : grezzo === "on"
          ? t("Accesa", "On")
          : t("Spenta", "Off"),
    });
  }
  if (!rows.length) return null;
  const accese = rows.filter((row) => row.on).length;
  return {
    key: "prese",
    accent: "#475569",
    icon: "🔌",
    label: t("Prese", "Sockets"),
    value: String(accese),
    caption: accese === 1 ? t("1 accesa", "1 on") : t(`${accese} accese`, `${accese} on`),
    ring: rows.length ? Math.round((accese / rows.length) * 100) : null,
    attiva: accese > 0,
    rows,
  };
}

/* Cosa sta suonando in casa (#269).
 *
 * «Per media player pensa anche a un widget che ti dica cosa e' in
 * riproduzione»: e' la sola tessera del ponte in cui il numero grande non e'
 * la risposta. Quante casse stanno suonando si sa in un colpo d'occhio; quello
 * che si vuole sapere e' CHE COSA — e quello sta nella didascalia, che scorre
 * quando non ci sta. Con piu' di una cassa accesa la didascalia dice anche
 * dove: «Salotto: So What», perche' due titoli di fila senza il posto sono due
 * titoli e basta. */
function cosaSuona(riga, conIlPosto) {
  const pezzo = [titoloDelLettore(riga), riga.artista].filter(Boolean).join(" — ");
  return conIlPosto ? `${riga.nome}: ${pezzo}` : pezzo;
}

function mediaModel(states) {
  const lettori = lettoriConfigurati(readJson(CHIAVE_MEDIA, []));
  if (!lettori.length) return null;
  const fuori = widgetExcludedEntities();
  const dentro = lettori.filter((voce) => widgetIncludes(voce.entity, fuori));
  if (!dentro.length) return null;
  const righe = lettureDeiLettori(dentro, states, root.resolveEntity || ((valore) => valore));
  const suonano = righe.filter((riga) => riga.suona);
  const conIlPosto = suonano.length > 1;
  return {
    key: "media",
    accent: "#8b5cf6",
    icon: "🔊",
    label: t("Musica", "Media"),
    value: String(suonano.length),
    caption: suonano.length
      ? suonano.map((riga) => cosaSuona(riga, conIlPosto)).join(" · ")
      : t("Nessuno in riproduzione", "Nothing playing"),
    ring: righe.length ? Math.round((suonano.length / righe.length) * 100) : null,
    attiva: suonano.length > 0,
    /* Le letture intere viaggiano con la tessera: la finestra ci disegna un
     * lettore per cassa, con la copertina e i comandi.
     *
     * Niente `rows`, invece: le pastiglie dello stato direbbero «Salotto · SO
     * WHAT» sopra un lettore che dice gia' Salotto, So What e Miles Davis, con
     * la copertina accanto. La stessa cosa scritta due volte a due dita di
     * distanza si legge come un errore. */
    lettori: righe,
  };
}

/* Le caselle del MiniPC che la tessera sa raccontare, nell'ordine in cui
 * contano: prima quanto sta lavorando, poi quanto scotta e quanto tira, poi la
 * linea. Sono gli stessi riferimenti della sua scheda: chi li ha mappati una
 * volta non deve rimapparli qui. */
const CASELLE_MINIPC = Object.freeze([
  {
    ref: "dm.server_cpu",
    chiave: "cpu",
    it: "CPU",
    en: "CPU",
    glyph: "🧠",
    unita: "%",
    cifre: 0,
    quota: true,
  },
  {
    ref: "dm.server_ram",
    chiave: "ram",
    it: "RAM",
    en: "RAM",
    glyph: "📊",
    unita: "%",
    cifre: 0,
    quota: true,
  },
  {
    ref: "dm.server_disco",
    chiave: "disco",
    it: "Disco",
    en: "Disk",
    glyph: "💽",
    unita: "%",
    cifre: 0,
    quota: true,
  },
  {
    ref: "dm.server_temperatura_cpu",
    it: "Temperatura CPU",
    en: "CPU temperature",
    glyph: "🌡️",
    unita: "°",
    cifre: 1,
  },
  {
    ref: "dm.server_temperature",
    it: "Temperatura",
    en: "Temperature",
    glyph: "🌡️",
    unita: "°",
    cifre: 1,
  },
  {
    ref: "dm.server_potenza_raspberry_server",
    it: "Potenza",
    en: "Power",
    glyph: "⚡",
    unita: " W",
    cifre: 0,
  },
  {
    ref: "dm.server_speedtest_download",
    it: "Download",
    en: "Download",
    glyph: "⬇️",
    unita: " Mb/s",
    cifre: 0,
  },
  {
    ref: "dm.server_speedtest_upload",
    it: "Upload",
    en: "Upload",
    glyph: "⬆️",
    unita: " Mb/s",
    cifre: 0,
  },
  { ref: "dm.server_ping_internet", it: "Ping", en: "Ping", glyph: "📡", unita: " ms", cifre: 0 },
  { ref: "dm.server_stato_internet", it: "Internet", en: "Internet", glyph: "🌐", acceso: true },
  {
    ref: "dm.server_raggiungibilita_google",
    it: "Rete raggiungibile",
    en: "Network reachable",
    glyph: "🌐",
    acceso: true,
  },
]);

/* La tessera del MiniPC.
 *
 * «Nella sezione widget manca completamente minipc»: la scheda aveva la sua
 * pagina e le sue caselle, ma in Home non c'era niente — e il ponte esiste
 * proprio per dire di sfuggita come sta quello che di solito si guarda per
 * intero. In grande va la CPU, che e' la risposta alla domanda «sta
 * faticando?»; il resto sta nella finestra, e il tasto porta alla sua
 * sezione. */
export function minipcModel(states) {
  const fuori = widgetExcludedEntities();
  const rows = [];
  const visti = new Set();
  let carico = null;
  for (const casella of CASELLE_MINIPC) {
    const dato = refValue(states, casella.ref, fuori);
    if (!dato || visti.has(dato.entity)) continue;
    if (casella.acceso) {
      if (STATI_MUTI.test(dato.state)) continue;
      visti.add(dato.entity);
      const attivo = STATI_ACCESI.test(dato.state);
      rows.push({
        glyph: casella.glyph,
        name: friendlyName(states, dato.entity),
        entity: dato.entity,
        on: attivo,
        value: attivo ? t("Attivo", "Up") : t("Assente", "Down"),
      });
      continue;
    }
    if (dato.value == null) continue;
    visti.add(dato.entity);
    if (casella.quota && carico === null && casella.ref === "dm.server_cpu") carico = dato.value;
    rows.push({
      glyph: casella.glyph,
      name: t(casella.it, casella.en),
      /* Il nome della misura, non la parola tradotta.
       *
       * La didascalia sceglieva le righe leggendo l'etichetta: in arabo e in
       * giapponese quelle parole sono tradotte, e la tessera perdeva RAM e
       * disco pur avendone le letture. Chiesto in revisione. */
      chiave: casella.chiave || "",
      entity: dato.entity,
      raw: dato.value,
      value: `${formatNumber(dato.value, casella.cifre)}${casella.unita}`,
    });
  }
  if (!rows.length) return null;
  const quote = rows.filter((row) => ["cpu", "ram", "disco"].includes(row.chiave));
  return {
    key: "minipc",
    accent: "#334155",
    icon: "🖥️",
    label: t("MiniPC", "MiniPC"),
    value: carico != null ? `${formatNumber(carico, 0)}%` : rows[0].value,
    /* Le altre due quote in didascalia: sono la coppia che si guarda insieme
     * alla CPU, e cosi' la tessera dice tutto senza aprirsi. */
    caption: quote
      .filter((row) => row.chiave !== "cpu")
      .map((row) => `${row.name} ${row.value}`)
      .join(" · "),
    ring: carico != null ? Math.round(carico) : null,
    rows,
  };
}

function irrigationModel(states) {
  const config = root.getIrr?.() || readJson("cd_irrigazione", {});
  const zones = Array.isArray(config?.zones) ? config.zones : [];
  const fuori = widgetExcludedEntities();
  const attive = zones.filter((zona) => {
    const entity = clean(zona?.entity);
    return entity && widgetIncludes(entity, fuori);
  });
  if (!attive.length) return null;
  /* Una zona che irriga non dice sempre «on».
   *
   * Le zone su una valvola — `valve.*`, che la plancia accetta — dicono «open»
   * mentre stanno bagnando, e «opening» mentre si aprono. Guardando solo «on»
   * la tessera diceva che non stava irrigando niente proprio mentre l'acqua
   * usciva. */
  const inFunzione = attive.filter((zona) => zonaInFunzione(states, zona));
  const terreno = clean(config.soilEnt || config.soil_entity);
  const umidita = terreno && widgetIncludes(terreno, fuori) ? numOf(states, terreno) : null;
  return {
    key: "irrigazione",
    accent: "#10b981",
    icon: "💧",
    label: t("Irrigazione", "Irrigation"),
    value: inFunzione.length
      ? `${inFunzione.length}`
      : umidita == null
        ? `${attive.length}`
        : `${Math.round(umidita)}%`,
    caption: inFunzione.length
      ? t("zone in funzione", "zones running")
      : umidita == null
        ? t("zone configurate", "zones configured")
        : t("umidità terreno", "soil moisture"),
    ring: inFunzione.length ? null : umidita,
    attiva: inFunzione.length > 0,
    /* Accanto al testo che si legge va il dato grezzo, che serve a chi conta.
     * Le righe portavano solo «in funzione» / «ferma» tradotto, e il motore di
     * analisi — che cerca un booleano — leggeva tutte le zone come ferme
     * proprio mentre l'acqua usciva. Il testo e' per gli occhi, `on` per i
     * conti: due mestieri, due campi. */
    rows: attive.map((zona) => ({
      glyph: "🌱",
      name: clean(zona.name) || clean(zona.entity),
      on: zonaInFunzione(states, zona),
      entity: clean(zona.entity),
      value: zonaInFunzione(states, zona) ? t("in funzione", "running") : t("ferma", "idle"),
    })),
  };
}

/* Sotto l'analisi restano solo i COMANDI: gli interruttori veri.
 *
 * «Dopo la parte analisi sopra non voglio vedere quell'elenco bruttissimo di
 * entita'»: le righe di sola lettura non fanno piu' lista — le numeriche
 * diventano caselle sotto «Le misure» (`carteDalleRighe`), le acceso/spento
 * stanno gia' nelle pillole de «Lo stato», come nel progetto approvato. Qui
 * resta cio' che si preme: l'interruttore e' lo stesso delle luci —
 * `data-dm-w-light` sa chiamare il servizio giusto per qualunque dominio. */
function rowsDetail(widget) {
  return (widget.rows || [])
    .filter((row) => row.comando)
    .map((row) => {
      const livello = livelloMarkup(percentualeDellaRiga(row));
      return rowShell(
        `<span class="dm-w-glyph" data-on="${row.on === true}" aria-hidden="true">${row.glyph || "•"}</span>
         <span class="dm-w-name">${esc(row.name)}${livello}</span>
         <button type="button" class="dm-w-switch" data-dm-w-light="${esc(row.entity)}" data-on="${row.on === true}"
           aria-label="${esc(row.name)}"><i></i></button>`,
      );
    })
    .join("");
}

/* Il lettore, dentro la finestra della tessera (#269).
 *
 * La stessa copertina e gli stessi tasti della pagina, in piccolo: i tasti li
 * disegna e li ascolta il modulo della musica — il suo gestore sta sul
 * documento — quindi qui non c'e' un secondo modo di mettere in pausa. Il
 * fondo sfocato invece resta alla pagina: dentro una finestra larga un palmo
 * sarebbe una macchia di colore sotto tre righe di testo. */
function mediaDetail(widget) {
  return (widget.lettori || [])
    .map(
      (riga) => `<div class="dm-w-media" data-suona="${riga.suona}" data-muta="${riga.muto}">
      ${
        riga.copertina
          ? `<img class="dm-w-media-arte" src="${esc(riga.copertina)}" alt="" aria-hidden="true">`
          : `<span class="dm-w-media-arte dm-w-media-vuota" aria-hidden="true">${
              riga.icona ? esc(riga.icona) : oggettoWidget("media")
            }</span>`
      }
      <span class="dm-w-media-testo">
        <small class="dm-w-media-dove">${esc(riga.nome)}</small>
        <strong class="dm-w-media-titolo">${esc(titoloDelLettore(riga))}</strong>
        <small class="dm-w-media-sotto">${esc(sottoDelLettore(riga))}</small>
      </span>
      ${comandiMediaMarkup(riga)}
    </div>`,
    )
    .join("");
}

/* ── i widget del Quadro Avvisi ───────────────────────────────────────── */

/* Il ponte ha preso il posto del Quadro Avvisi, che dalla Home e' uscito del
 * tutto: le sue liste sorvegliate — batterie, allagamenti, avvisi
 * personalizzati — sono queste tessere, che come le card di prima compaiono
 * solo quando hanno qualcosa da dire. Le liste e le regole di conteggio sono
 * LE STESSE del runtime (`GRUPPI_MONITORAGGIO`, il matcher degli avvisi
 * custom), cosi' numero e voci combaciano sempre.
 *
 * Le aperture avevano la loro, ed e' stata tolta: «viene gia' gestito da
 * Finestre, se li si mette il sensore finestra dice quale e' aperto, quindi e'
 * un duplicato». Vero — la tessera Finestre legge i contatti delle coperture
 * e nomina quelle aperte — e due tessere che rispondono alla stessa domanda
 * sono due occasioni di rispondere diverso. */

/* L'elenco sorvegliato di un gruppo: quello scritto in configurazione E quello
 * che il guscio tiene in memoria.
 *
 * La lista viva (`GRUPPI_MONITORAGGIO`) si costruisce una volta sola, all'avvio,
 * leggendo `cd_gruppi_extra`. Tutto quello che arriva dopo — una pila aggiunta
 * dalla finestra di modifica degli avvisi, che scrive solo la configurazione;
 * la configurazione che un altro apparecchio ha cambiato e la sincronizzazione
 * ha portato qui; nel pannello di Home Assistant, la configurazione stessa
 * quando arriva dopo che il guscio e' partito — la lista viva non lo vede
 * finche' non si ricarica la pagina. E la tessera leggeva solo lei: «la
 * batteria attualmente e' al 1% e non compare il widget batteria scarica».
 *
 * La configurazione ha ragione: si legge lei per prima, e la lista viva si
 * somma per quello che ha in piu' (gli avvisi del `config.js`, per dirne uno).
 * Le voci tolte (`cd_gruppi_removed`) restano fuori — a meno che non siano
 * state riaggiunte dopo, perche' l'ultimo gesto fatto apposta e' l'aggiunta,
 * ed e' la stessa regola con cui `riparaAggiunteTolte` mette pace fra le due
 * liste. */
export function entitaSorvegliate(chiave, { extras, removed, vive } = {}) {
  const gruppo = clean(chiave);
  const elenco = (lista) => (Array.isArray(lista) ? lista.map(clean).filter(Boolean) : []);
  const scelte = elenco(extras?.[gruppo]);
  const tolte = new Set(elenco(removed?.[gruppo]).filter((id) => !scelte.includes(id)));
  const viste = new Set();
  const uscita = [];
  for (const id of [...scelte, ...elenco(vive)]) {
    if (tolte.has(id) || viste.has(id)) continue;
    viste.add(id);
    uscita.push(id);
  }
  return uscita;
}

function gruppoEntita(chiave) {
  try {
    let vive = [];
    try {
      vive = lexicalGlobal("GRUPPI_MONITORAGGIO")?.[chiave];
    } catch (_error) {}
    const lista = entitaSorvegliate(chiave, {
      extras: readJson("cd_gruppi_extra", {}),
      removed: readJson("cd_gruppi_removed", {}),
      vive,
    });
    const fuori = widgetExcludedEntities();
    return lista.filter((entity) => widgetIncludes(entity, fuori));
  } catch (_error) {
    return [];
  }
}

function friendlyName(states, entity) {
  /* Prima il nome che la persona ha scritto in configurazione, poi quello di
   * Home Assistant. Le tessere degli avvisi mostravano «Sensore Porta/finestra
   * Camera matrimoniale Batteria» — il nome di fabbrica — anche a chi quella
   * riga l'aveva battezzata: il nome scelto sta in `cd_avvisi_names_extra`,
   * ed e' lo stesso posto da cui lo leggono il Quadro Avvisi e gli
   * allagamenti. Un nome dato una volta vale ovunque. */
  return (
    clean(readJson("cd_avvisi_names_extra", {})?.[entity]) ||
    clean(stateOf(states, entity)?.attributes?.friendly_name) ||
    entity.split(".")[1]?.replaceAll("_", " ") ||
    entity
  );
}

function batteriesModel(states) {
  const entities = gruppoEntita("batt");
  if (!entities.length) return null;
  const rows = entities
    .map((entity) => {
      const level = Number(stateOf(states, entity)?.state);
      return {
        entity,
        name: friendlyName(states, entity),
        level: Number.isFinite(level) ? level : null,
      };
    })
    .filter((row) => row.level != null)
    .sort((a, b) => a.level - b.level);
  const low = rows.filter((row) => row.level <= 20);
  if (!low.length) return null;
  return {
    key: "batterie",
    accent: "#eab308",
    icon: "🔋",
    alert: true,
    label: t("Batterie", "Batteries"),
    value: String(low.length),
    caption: low[0] ? `${low[0].name} ${Math.round(low[0].level)}%` : "",
    ring: Math.round((low.length / rows.length) * 100),
    rows,
    low,
  };
}

function floodModel(states) {
  let entities = [];
  try {
    /* `floodEntities` risponde con l'elenco E il segno del primo avvio, e qui
     * serve l'elenco. Preso com'era — l'oggetto intero — non era mai un
     * elenco, e la tessera non compariva nemmeno col sensore bagnato (dal
     * campo: «quando attivo non segnala lo stato allagamento nei widget»). */
    ({ entities } = floodEntities(
      readJson("cd_gruppi_extra", {}),
      readJson("cd_gruppi_removed", {}),
      states,
      true,
    ));
  } catch (_error) {
    return null;
  }
  if (!Array.isArray(entities) || !entities.length) return null;
  const fuori = widgetExcludedEntities();
  const rows = entities
    .filter((entity) => widgetIncludes(entity, fuori))
    .map((entity) => ({
      entity,
      name: friendlyName(states, entity),
      on: Boolean(floodIsWet(stateOf(states, entity))),
    }));
  const wet = rows.filter((row) => row.on);
  if (!wet.length) return null;
  return {
    key: "allagamenti",
    accent: "#38bdf8",
    icon: "💧",
    alert: true,
    label: t("Allagamenti", "Floods"),
    value: String(wet.length),
    caption: wet[0] ? wet[0].name : "",
    ring: 100,
    rows: wet,
  };
}

/* Le stesse condizioni del runtime, riga per riga: un avviso personalizzato
 * deve contare qui quello che il suo popup elenca la'. */
function avvisoAttivo(avviso, current) {
  const raw = String(current?.state ?? "");
  const stato = raw.toLowerCase();
  const numero = Number.parseFloat(raw);
  const soglia = Number.parseFloat(avviso?.value);
  switch (clean(avviso?.cond)) {
    case "off":
      return [
        "off",
        "closed",
        "false",
        "no",
        "0",
        "unavailable",
        "unknown",
        "idle",
        "standby",
      ].includes(stato);
    case "eq":
      return stato === String(avviso?.value ?? "").toLowerCase();
    case "neq":
      return stato !== String(avviso?.value ?? "").toLowerCase();
    case "gt":
      return !Number.isNaN(numero) && !Number.isNaN(soglia) && numero > soglia;
    case "lt":
      return !Number.isNaN(numero) && !Number.isNaN(soglia) && numero < soglia;
    default:
      return [
        "on",
        "open",
        "opened",
        "true",
        "yes",
        "home",
        "detected",
        "heat",
        "heating",
        "cool",
        "cooling",
        "playing",
        "active",
        "armed",
        "wet",
        "motion",
        "occupied",
        "running",
      ].includes(stato);
  }
}

function customAlertModels(states) {
  const avvisi = readJson("cd_avvisi_custom", []);
  if (!Array.isArray(avvisi)) return [];
  return avvisi
    .map((avviso, index) => {
      const entities = Array.isArray(avviso?.entities)
        ? avviso.entities
        : avviso?.entity
          ? [avviso.entity]
          : [];
      const fuori = widgetExcludedEntities();
      const rows = entities
        .map(clean)
        .filter((entity) => entity && widgetIncludes(entity, fuori))
        .filter((entity) => {
          const current = stateOf(states, entity);
          return current && avvisoAttivo(avviso, current);
        })
        .map((entity) => ({
          entity,
          name: friendlyName(states, entity),
          state: clean(stateOf(states, entity)?.state),
        }));
      if (!rows.length) return null;
      return {
        key: `custom-${index}`,
        accent: "#f59e0b",
        icon: clean(avviso?.icon) || "⚠️",
        alert: true,
        label: clean(avviso?.name) || t("Avviso", "Alert"),
        value: String(rows.length),
        caption: rows[0]?.name || "",
        ring: null,
        rows,
      };
    })
    .filter(Boolean);
}

/* La tessera «In evidenza» (#236).
 *
 * Le altre tessere raccontano una sezione; questa racconta le entita' scelte a
 * mano — il quadro elettrico, la sonda del rack, la pompa del pozzo — che una
 * sezione non ce l'hanno e in Home prima non avevano un posto. La
 * configurazione sta in `cd_evidenza`: righe `{name, icon?, entity, room_id?}`
 * scritte nella scheda 🧩 Widget, e la tessera compare solo se almeno una riga
 * ha la sua entita'. Ogni riga si legge con `rigaDaEntita`, che sa gia' dare a
 * un numero la sua unita' e a un interruttore la sua parola; il nome scelto
 * dall'utente vince su quello dell'integrazione. */
/* Una voce in evidenza come riga della tessera, o `null` se non si mostra. */
function rigaInEvidenza(states, voce, fuori) {
  const entity = clean(voce?.entity);
  if (!entity || !widgetIncludes(entity, fuori)) return null;
  const glifo = clean(voce?.icon) || "⭐";
  const nome = clean(voce?.name);
  const riga = rigaDaEntita(states, entity, glifo);
  /* Un'entita' che adesso non risponde resta in tessera col suo trattino:
   * e' stata scelta apposta, e sparire in silenzio direbbe «tutto bene». */
  if (!riga)
    return { glyph: glifo, name: nome || friendlyName(states, entity), entity, value: "—" };
  return nome ? { ...riga, name: nome } : riga;
}

/* «Tessera a se'» (#303): una voce in evidenza puo' avere la sua tessera in
 * Home invece di stare nel riassunto — e al tocco si apre su di lei. */
export const eUnaTesseraSola = (voce) =>
  voce?.sola === true || voce?.sola === "true" || voce?.sola === 1 || voce?.sola === "1";

export function evidenzaModel(states) {
  const voci = readJson(EVIDENZA_CONFIG_KEY, []);
  if (!Array.isArray(voci)) return null;
  const fuori = widgetExcludedEntities();
  const rows = voci
    .filter((voce) => !eUnaTesseraSola(voce))
    .map((voce) => rigaInEvidenza(states, voce, fuori))
    .filter(Boolean);
  if (!rows.length) return null;
  return {
    key: "evidenza",
    accent: "#eab308",
    icon: "⭐",
    label: t("In evidenza", "Highlights"),
    // Il numero grande dice quante cose si stanno tenendo d'occhio; il
    // riassunto sotto le nomina una per una col loro valore.
    value: String(rows.length),
    caption: rows.map((riga) => clean(`${riga.name} ${riga.value}`)).join(" · "),
    ring: null,
    // Si accende se qualcosa fra le evidenze e' acceso davvero.
    attiva: rows.some((riga) => riga.on === true),
    rows,
  };
}

/* Le tessere «a se'» delle evidenze, una per voce che lo chiede. La chiave
 * porta l'indice della voce, e per ordine e visibilita' contano tutte come
 * «evidenza» — come gli avvisi personalizzati sotto `custom`. */
export function evidenzeSingole(states) {
  const voci = readJson(EVIDENZA_CONFIG_KEY, []);
  if (!Array.isArray(voci)) return [];
  const fuori = widgetExcludedEntities();
  let stanze = [];
  try {
    stanze = root.getStanze?.() || readJson("cd_stanze", []) || [];
  } catch (_error) {
    stanze = [];
  }
  return voci
    .map((voce, index) => {
      if (!eUnaTesseraSola(voce)) return null;
      const riga = rigaInEvidenza(states, voce, fuori);
      if (!riga) return null;
      const stanza = Array.isArray(stanze)
        ? stanze.find((room) => clean(room?.id) === clean(voce?.room_id))
        : null;
      return {
        key: `evidenza-${index}`,
        accent: "#eab308",
        icon: riga.glyph || "⭐",
        label: riga.name,
        value: riga.value,
        caption: clean(stanza?.name),
        ring: null,
        attiva: riga.on === true,
        rows: [riga],
      };
    })
    .filter(Boolean);
}

export function evidenzaModels(states) {
  return [evidenzaModel(states), ...evidenzeSingole(states)].filter(Boolean);
}

/* ── la personalizzazione (cd_widgets) ────────────────────────────────── */

/* I tre modi della compatta (#224): mai, auto, sempre. «Auto» e' il difetto,
 * e vuol dire compatta solo dove lo spazio manca — sotto i 520 pixel, deciso
 * dalla media query del foglio, non da un giro di JavaScript. */
const MODI_COMPATTO = Object.freeze(["mai", "auto", "sempre"]);

/* Le tessere che hanno cambiato nome, e cosa sono diventate.
 *
 * «Da fare» e «Calendario» erano due mattonelle e adesso sono una sola,
 * «Agenda» (#259). Chi le aveva gia' ordinate o nascoste ha i vecchi nomi
 * scritti in `cd_widgets`: senza tradurli, chi aveva nascosto «Da fare» si
 * ritroverebbe l'agenda in Home senza averla chiesta, e chi aveva messo il
 * calendario per primo se lo ritroverebbe in fondo.
 *
 * La traduzione si fa in lettura e non si riscrive la configurazione: cosi'
 * una plancia aperta con la versione vecchia continua a leggere la sua, e
 * nessuno perde niente tornando indietro. */
const TESSERE_RINOMINATE = Object.freeze({ todo: "agenda", calendario: "agenda" });

function nomeDiOggi(chiave) {
  const nome = clean(chiave);
  return TESSERE_RINOMINATE[nome] || nome;
}

/* Nascosta la nuova solo se erano nascoste TUTTE le vecchie: chi ne aveva
 * spenta una sola vuole ancora vedere l'altra meta', e quella meta' adesso
 * vive dentro l'agenda. */
function nascosteDiOggi(nascoste) {
  const dentro = new Set(nascoste.map(clean).filter(Boolean));
  const vecchie = Object.keys(TESSERE_RINOMINATE);
  const fuori = new Set(dentro);
  for (const vecchia of vecchie) fuori.delete(vecchia);
  if (vecchie.every((vecchia) => dentro.has(vecchia))) fuori.add("agenda");
  return [...fuori];
}

export function widgetPreferences() {
  const stored = readJson(WIDGETS_CONFIG_KEY, {});
  const hidden = nascosteDiOggi(
    Array.isArray(stored?.hidden) ? stored.hidden.map(clean).filter(Boolean) : [],
  );
  const order = [
    ...new Set(
      (Array.isArray(stored?.order) ? stored.order.map(clean).filter(Boolean) : []).map(nomeDiOggi),
    ),
  ];
  const excluded = Array.isArray(stored?.excluded)
    ? stored.excluded.map(clean).filter(Boolean)
    : [];
  const compatto = MODI_COMPATTO.includes(clean(stored?.compatto))
    ? clean(stored?.compatto)
    : "auto";
  /* Cosa mostra una tessera che riassume piu' cose (#303): «il widget
   * temperatura come il clima visualizzano la temperatura media, si potrebbe
   * far scegliere cosa visualizzare». Per chiave della tessera, l'entita' da
   * mettere in primo piano; senza, la media di sempre. */
  const grezze = stored?.sorgenti;
  const sorgenti =
    grezze && typeof grezze === "object" && !Array.isArray(grezze)
      ? Object.fromEntries(
          Object.entries(grezze)
            .map(([chiave, valore]) => [clean(chiave), clean(valore)])
            .filter(([chiave, valore]) => chiave && valore),
        )
      : {};
  return { hidden, order, excluded, compatto, sorgenti };
}

/** L'entita' scelta per una tessera che riassume, o «» per la media. */
export function sorgenteDelWidget(chiave, preferences = widgetPreferences()) {
  return clean(preferences?.sorgenti?.[clean(chiave)]);
}

/* Le entita' che restano fuori dai widget.
 *
 * Ogni tessera legge la configurazione della sua sezione, tutta: senza una
 * parola in contrario, quello che c'e' nella sezione finisce nel widget. La
 * parola in contrario e' questa — l'interruttore accanto a ogni entita' negli
 * editor — e si tiene in `cd_widgets`, insieme all'ordine e alle tessere
 * nascoste. Chi non e' nell'elenco e' dentro: cosi' chi non tocca niente
 * vede quello che vedeva prima. */
export function widgetExcludedEntities() {
  return new Set(widgetPreferences().excluded);
}

export function widgetIncludes(entity, excluded = widgetExcludedEntities()) {
  const id = clean(entity);
  return !id || !excluded.has(id);
}

/** L'ordine scelto prima, poi quello naturale; le tessere nascoste non escono.
 * Gli avvisi personalizzati si governano insieme, sotto la chiave `custom`. */
export function applyWidgetPreferences(models, preferences = widgetPreferences()) {
  const hidden = new Set(preferences.hidden);
  /* Le tessere energia degli altri impianti (#286) seguono la posizione di
   * «Energia»: prima solo la prima la seguiva e le altre restavano in coda. */
  const chiave = (widget) =>
    widget.key.startsWith("custom-")
      ? "custom"
      : widget.key.startsWith("evidenza-")
        ? "evidenza"
        : eUnaTesseraEnergia(widget.key)
          ? "energia"
          : widget.key;
  const rank = (widget) => {
    const nome = chiave(widget);
    const index = preferences.order.indexOf(nome);
    if (index >= 0) return index;
    /* La tessera dell'assistenza e' nata dopo che molti avevano gia' salvato un
     * ordine: fuori dall'ordine starebbe in coda, e un avviso in coda non
     * avvisa. Finche' nessuno la sposta apposta, sta per prima. */
    if (nome === "assistenza") return -1;
    return preferences.order.length + models.indexOf(widget);
  };
  return models.filter((widget) => !hidden.has(chiave(widget))).sort((a, b) => rank(a) - rank(b));
}

/* Le sezioni canoniche che dicono «questa plancia e' stata configurata». */
const SEZIONI_CONFIGURABILI = Object.freeze([
  "rooms",
  "cameras",
  "appliances",
  "loads",
  "lights",
  "climate",
  "ev",
  "covers",
  "pool",
  "irrigation",
  "energy",
  "sockets",
  "robots",
  "entityOverrides",
]);

/* Le liste legacy che una tessera legge senza passare dalle sezioni: chi ha
 * configurato SOLO queste ha comunque una plancia configurata. */
const LISTE_CONFIGURABILI = Object.freeze([
  "cd_avvisi_custom",
  TODO_CONFIG_KEY,
  EVIDENZA_CONFIG_KEY,
  "cd_security_doors",
  "cd_prese",
]);

/* I gruppi di monitoraggio che si scrivono da soli.
 *
 * `cd_gruppi_extra` tiene le entita' che l'utente ha aggiunto agli avvisi — le
 * finestre nelle Aperture, per dirne una — ed e' configurazione a tutti gli
 * effetti: si arriva li' solo scegliendo. Tranne che per tre voci, che nessuno
 * sceglie: allagamenti e fumo se li scrive il primo avvio guardando cosa c'e'
 * in casa, e `luci` e' una copia di `cd_luci` che si rinfresca da se'. Contarle
 * come configurazione voleva dire ridare per «configurata» una plancia appena
 * nata — cioe' rimettere in piedi il difetto per cui in Home comparivano gli
 * avvisi della casa di un'altra. */
const GRUPPI_CHE_NON_SI_SCELGONO = Object.freeze(new Set(["allag", "fumo", "luci"]));

/** Se qualcuno ha aggiunto a mano un'entita' a un gruppo di avvisi. */
function gruppiScelti() {
  const extras = readJson("cd_gruppi_extra", null);
  if (!extras || typeof extras !== "object") return false;
  return Object.entries(extras).some(
    ([gruppo, lista]) =>
      !GRUPPI_CHE_NON_SI_SCELGONO.has(gruppo) && Array.isArray(lista) && lista.length > 0,
  );
}

/* Se questa plancia e' stata configurata da qualcuno.
 *
 * Le tessere degli avvisi — batterie, allagamenti — non nascono dalla
 * configurazione: nascono dal rilevamento, cioe' da quello che Home Assistant
 * ha in casa. Su una plancia appena creata questo voleva dire trovarsi in Home
 * il ponte gia' acceso, con «2 batterie scariche», sotto il messaggio che dice il
 * contrario — «non hai ancora collegato le tue entita', quindi le card sono
 * nascoste» — e con dentro la casa dell'altra plancia. Chi ne apre una nuova la
 * vuole vuota: «doveva crearne una ex novo sciolta dall'altra».
 *
 * Finche' non c'e' niente di configurato qui, il ponte tace. Basta la prima
 * stanza, la prima entita' mappata, il primo avviso a mano perche' torni. */
export function planciaConfigurata() {
  for (const nome of SEZIONI_CONFIGURABILI) {
    const valore = section(nome, null);
    if (valore == null) continue;
    if (nome === "entityOverrides") {
      if (Object.values(valore || {}).some((entity) => clean(entity).includes("."))) return true;
      continue;
    }
    /* Una stanza e' configurazione anche senza sensori dentro.
     *
     * Chiesto in revisione, e ha ragione: chi apre una plancia nuova comincia
     * quasi sempre dalle stanze, e una stanza si crea col nome — i sensori
     * arrivano dopo. Chi giudica i dati «configurati» guarda pero' solo la
     * temperatura e l'umidita', e con la sola stanza avrebbe risposto di no:
     * il ponte sarebbe rimasto muto proprio dopo il primo gesto di chi
     * comincia. */
    if (nome === "rooms") {
      if (
        Array.isArray(valore) &&
        valore.some((stanza) => clean(stanza?.name) || clean(stanza?.id))
      )
        return true;
      continue;
    }
    if (hasConfiguredData(nome, valore)) return true;
  }
  for (const chiave of LISTE_CONFIGURABILI) {
    const valore = readJson(chiave, null);
    if (Array.isArray(valore) ? valore.length : valore && Object.keys(valore).length) return true;
  }
  if (gruppiScelti()) return true;
  /* Le luci vivono in una mappa `{entita: nome}` sia in sezione sia in legacy. */
  const luci = readJson("cd_luci", null);
  return Boolean(luci && Object.keys(luci).length);
}

/* La tessera delle segnalazioni, e c'e' solo per chi tiene la repository.
 *
 * `sommarioConsole()` torna `null` per chiunque altro: la tessera non esiste
 * per loro, e non e' una preferenza spenta ma una cosa che non li riguarda —
 * cosi' «solo per me» sta scritto in come e' fatta, non in un interruttore che
 * qualcuno potrebbe accendere per sbaglio.
 *
 * Il numero grande e' quello che resta da lavorare, che e' la domanda con cui
 * si guarda la Home: non quante ne sono arrivate in tutto, che e' storia. */
function segnalazioniModel() {
  const conto = sommarioConsole();
  if (!conto) return null;
  const pezzi = [];
  if (conto.bug) pezzi.push(t(`${conto.bug} difetti`, `${conto.bug} bugs`));
  if (conto.feature) pezzi.push(t(`${conto.feature} idee`, `${conto.feature} ideas`));
  if (conto.assistenza) pezzi.push(t(`${conto.assistenza} aiuto`, `${conto.assistenza} help`));
  return {
    key: "segnalazioni",
    accent: "#0ea5e9",
    icon: "🎫",
    label: t("Segnalazioni", "Reports"),
    value: String(conto.quante),
    /* Senza niente da lavorare la didascalia non elenca zeri: dice che non c'e'
     * niente, che e' la risposta. */
    caption: pezzi.length ? pezzi.join("  ·  ") : t("Niente da lavorare", "Nothing to work on"),
    ring: null,
    // Si accende quando c'e' qualcosa che aspetta una risposta.
    attiva: conto.quante > 0,
    conto,
  };
}

/* La tessera della chat di assistenza: un avviso, e c'e' solo finche' c'e'
 * una risposta da leggere.
 *
 * «Gestisci una sorta di widget avviso che, se si ricevono messaggi nella
 *  chat assistenza, compare nella home.» Compare con la prima risposta non
 * letta e se ne va quando la finestra si apre, perche' aprire la chat e'
 * leggerla. Lo stato lo tiene la sezione della chat; il modello sta nel nucleo. */
function chatModel() {
  return tesseraDellaChat(statoDellaChat());
}

/* La tessera delle allerte (#296).
 *
 * Il numero grande e' quante fonti hanno qualcosa da dire, e la tessera si
 * accende con la prima: e' l'unica cosa che una tessera deve sapere. Le righe
 * dentro portano ogni fonte con la sua frase, e il livello — che la finestra
 * usa per la sua frase — arriva dal modello, non si rifa' qui. */
export function paroleDelleFontiMute(quante) {
  const n = Number(quante) || 0;
  if (n === 1) return t("1 fonte non risponde", "1 source not responding");
  return t(`${n} fonti non rispondono`, `${n} sources not responding`);
}

function allerteModel(states) {
  const config = readJson(CHIAVE_ALLERTE, {});
  if (!categorieConfigurate(config).length) return null;
  const fuori = widgetExcludedEntities();
  if (!entitaDelleAllerte(config).some((entity) => widgetIncludes(entity, fuori))) return null;
  const letture = letturaAllerte(config, states, root.resolveEntity || ((value) => value));
  const attive = allerteAttive(letture);
  const livello = livelloMassimo(letture);
  /* Le fonti che non rispondono. Con nessuna allerta in corso la tessera
   * diceva «OK · Tutto tranquillo» anche se il sensore dei terremoti era
   * spento: e un sensore spento non e' un cielo sereno, e' una sorveglianza
   * che manca. Si dice, al posto del tutto tranquillo. */
  const mute = letture.filter((lettura) => lettura.livello === IGNOTO);
  const rows = letture.map((lettura) => ({
    glyph: categoriaDelleAllerte(lettura.chiave).icona,
    name: clean(lettura.nome) || categoriaDelleAllerte(lettura.chiave).nome,
    entity: lettura.entity,
    value: fraseDellAllerta(lettura),
    livello: lettura.livello,
  }));
  return {
    key: "allerte",
    accent: "#f59e0b",
    icon: "⚠️",
    label: t("Allerte", "Alerts"),
    value: attive.length ? String(attive.length) : mute.length ? "—" : "OK",
    caption: attive.length
      ? attive
          .map((lettura) => clean(lettura.nome) || categoriaDelleAllerte(lettura.chiave).nome)
          .join(" · ")
      : mute.length
        ? paroleDelleFontiMute(mute.length)
        : t("Tutto tranquillo", "All quiet"),
    ring: null,
    /* Accesa alla prima fonte che ha qualcosa da dire; l'alone da attenzione
     * in su, che e' quando vale la pena alzare la testa. */
    attiva: attive.length > 0,
    alert: almeno(livello, "attenzione"),
    livello,
    letture,
    rows,
  };
}

/* La tessera della raccolta differenziata (#293).
 *
 * Il numero grande e' la parola del quando — «Domani» — e la didascalia dice
 * cosa: e' la risposta alla domanda della sera. Si accende il giorno prima e
 * il giorno stesso, che sono i due momenti in cui serve vederla. */
function rifiutiModel(states) {
  const config = readJson(CHIAVE_RIFIUTI, {});
  if (!rifiutiConfigurati(config)) return null;
  const fuori = widgetExcludedEntities();
  if (!entitaDeiRifiuti(config).some((entity) => widgetIncludes(entity, fuori))) return null;
  const lettura = letturaRifiuti(config, states, root.resolveEntity || ((value) => value));
  const dalCalendario =
    lettura.calendario && lettura.calendario.giorni !== null && lettura.calendario.giorni >= 0
      ? [{ ...lettura.calendario, nome: lettura.calendario.nome }]
      : [];
  const prossimi = (lettura.prossimi.length ? lettura.prossimi : dalCalendario).map((riga) => ({
    name: nomeDellaRiga(riga) || t("Calendario dei ritiri", "Collection calendar"),
    quando: riga.quando,
    giorni: riga.giorni,
  }));
  const primo = prossimi[0] || null;
  const rigaDi = (riga, glyph) => ({
    glyph,
    name: nomeDellaRiga(riga) || t("Calendario dei ritiri", "Collection calendar"),
    entity: riga.entity,
    value: parolaDelQuando(riga),
    quando: riga.quando,
    giorni: riga.giorni,
  });
  const rows = [
    ...lettura.righe.map((riga) => rigaDi(riga, riga.icona)),
    ...(lettura.calendario ? [rigaDi(lettura.calendario, "📅")] : []),
  ];
  const primaRiga = lettura.prossimi[0] || dalCalendario[0] || null;
  return {
    key: "rifiuti",
    accent: "#22c55e",
    icon: "♻️",
    label: t("Rifiuti", "Waste"),
    value: primaRiga ? parolaDelQuando(primaRiga) : "—",
    caption: primo
      ? prossimi.map((riga) => riga.name).join(" · ")
      : t("Nessuna data in vista", "No date in sight"),
    ring: null,
    attiva: Boolean(primo && (primo.quando === "oggi" || primo.quando === "domani")),
    alert: false,
    prossimi,
    rows,
  };
}

function widgetModels(states) {
  if (!planciaConfigurata()) return [];
  return applyWidgetPreferences(
    [
      /* L'avviso dell'assistenza sta per primo: e' una risposta a chi ha
       * chiesto aiuto, e la prima tessera e' quella che si vede senza cercare.
       * Chi lo vuole altrove lo sposta dalla scheda Widget. */
      chatModel(),
      ...evidenzaModels(states),
      segnalazioniModel(),
      agendaModel(states),
      lightsModel(states),
      climateModel(states),
      coversModel(states),
      securityModel(states),
      camerasModel(states),
      ...energyModels(states),
      appliancesModel(states),
      temperatureModel(states),
      evModel(states),
      robotsModel(states),
      solarThermalModel(states),
      scaldabagnoModel(states),
      caldaiaModel(states),
      upsModel(states),
      minipcModel(states),
      poolModel(states),
      preseModel(states),
      mediaModel(states),
      allerteModel(states),
      rifiutiModel(states),
      irrigationModel(states),
      batteriesModel(states),
      floodModel(states),
      ...customAlertModels(states),
    ].filter(Boolean),
  );
}

/* Cosa e' acceso, per nome.
 *
 * «Metti il testo che scorre dentro la card, cosi' anche da fuori mostra cosa
 * e' acceso»: la didascalia diceva «3 accese», che e' un numero, non una
 * risposta. Adesso porta i nomi — e se non ci stanno scorrono, invece di
 * finire in tre puntini. */
function nomiAccesi(rows, quali = (row) => row.on, fallback = "") {
  const nomi = (rows || [])
    .filter((row) => {
      try {
        return quali(row);
      } catch (_error) {
        return false;
      }
    })
    .map((row) => clean(row?.name))
    .filter(Boolean);
  return nomi.length ? nomi.join(" · ") : fallback;
}

/* ── markup: le tessere ───────────────────────────────────────────────── */

/* Le tessere gia' viste non rientrano in scena.
 *
 * L'ingresso e' un'animazione con lo sfalsamento: bella la prima volta, un
 * tremolio se si ripete. E si ripeteva a ogni rifacimento del markup — che
 * capita da solo, perche' le tessere degli avvisi compaiono e spariscono con
 * i valori. Chi c'era gia' nasce «vista» e sta ferma; anima solo chi arriva
 * adesso. */
const viste = () => (state.viste ||= new Set());

/* Quanto e' lungo il numero grande, per deciderne la misura.
 *
 * Sulla tessera ci va di solito un numero corto — «26,3°», «2,98 kW» — e
 * ventitre pixel gli stanno bene. Ma la Sicurezza al posto del numero ci mette
 * una parola: «Disinserito» a ventitre pixel non ci sta, e si leggeva
 * «Disinse...» — cioe' nulla, perche' «disinserito» e «disinserimento in
 * corso» cominciano uguale. Il numero grande resta grande finche' e' corto; a
 * una parola si da' la misura che la fa entrare intera.
 *
 * Sta qui, a livello di modulo, e non dentro chi disegna la tessera: la misura
 * serve anche al giro che riscrive i valori, che vive in un'altra funzione. */
function misuraValore(valore) {
  const quanto = String(valore ?? "").length;
  if (quanto <= 7) return "corto";
  return quanto <= 11 ? "medio" : "lungo";
}

/* Il numero da una parte, l'unita' dall'altra.
 *
 * Il modello scrive una stringa sola — «26,3°», «2,98 kW», «Disinserito» — e
 * sulla tessera il numero va grande e l'unita' piccola accanto. Se davanti non
 * c'e' una cifra, e' una parola: resta intera e non si spezza in due. */
export function dividiValore(valore) {
  const testo = String(valore ?? "").trim();
  const pezzi = testo.match(/^([-+]?\d[\d.,\s]*)\s*(.*)$/);
  if (!pezzi) return { numero: testo, unita: "" };
  return { numero: pezzi[1].trim(), unita: pezzi[2].trim() };
}

/* La misura del mestiere.
 *
 * La quota che il modello calcola non e' la stessa cosa per tutti: per l'auto
 * e' la carica, e allora si disegna una batteria che si riempie; per le luci,
 * le tapparelle, gli elettrodomestici e' quanti su quanti, e allora si
 * disegnano i segmenti — due accesi su quattro si leggono senza il numero.
 * Per il resto una barra. Dove una quota non c'e', non si mette niente: una
 * tessera senza misura e' meglio di una misura che finge. */
export function firmaMisura(widget) {
  const quota = widget?.ring == null ? null : Math.max(0, Math.min(100, Math.round(widget.ring)));
  if (quota == null) return "";
  const totale = Array.isArray(widget?.rows) ? widget.rows.length : 0;
  if (widget?.key === "ev") return `batt:${quota}`;
  if (totale >= 2) {
    const segmenti = Math.min(totale, 6);
    const accesi = Math.min(
      segmenti,
      Math.max(quota > 0 ? 1 : 0, Math.round((quota / 100) * segmenti)),
    );
    return `punti:${accesi}/${segmenti}`;
  }
  return `barra:${quota}`;
}

function misuraMarkup(widget) {
  const firma = firmaMisura(widget);
  if (!firma) return "";
  const [tipo, dato] = firma.split(":");
  if (tipo === "batt") return `<span class="dm-tile-batt"><i style="width:${dato}%"></i></span>`;
  if (tipo === "punti") {
    const [accesi, segmenti] = dato.split("/").map(Number);
    let dentro = "";
    for (let i = 0; i < segmenti; i += 1) dentro += `<i${i < accesi ? ' data-on="true"' : ""}></i>`;
    return `<span class="dm-tile-punti">${dentro}</span>`;
  }
  return `<span class="dm-tile-scala"><i style="width:${dato}%"></i></span>`;
}

/* Il numero gira come un contatore.
 *
 * Da 20,5 a 20,9 si muove solo il 5 che diventa 9, e le cifre che cambiano
 * partono sfalsate. Prima scorreva tutto il numero e a colpo d'occhio sembrava
 * che fosse cambiato tutto. Torna vero se qualcosa e' cambiato davvero. */
function scriviNumero(nodo, nuovo, lunghezza) {
  const vecchio = nodo.dataset.dmVal ?? nodo.textContent ?? "";
  if (nodo.dataset.dmLen !== lunghezza) nodo.dataset.dmLen = lunghezza;
  if (vecchio === nuovo) return false;
  const sale =
    Number.parseFloat(String(nuovo).replace(",", ".")) >
    Number.parseFloat(String(vecchio).replace(",", "."));
  const verso = sale ? "su" : "giu";
  const prima = [...String(vecchio)];
  nodo.dataset.dmVal = nuovo;
  nodo.textContent = "";
  /* Spezzato in cifre, chi legge con la voce sentirebbe «due zero virgola
   * cinque»: il numero intero resta scritto qui, e le cifre sono solo disegno. */
  nodo.setAttribute("aria-label", nuovo);
  [...String(nuovo)].forEach((carattere, i) => {
    const cifra = doc.createElement("span");
    cifra.className = "dm-cifra";
    cifra.setAttribute("aria-hidden", "true");
    cifra.textContent = carattere;
    if (prima[i] !== carattere) {
      cifra.dataset.verso = verso;
      cifra.style.animationDelay = `${i * 30}ms`;
    }
    nodo.append(cifra);
  });
  return true;
}

/* La misura si muove quando puo', si rifa' quando deve.
 *
 * Una barra che cambia quota scorre; dei segmenti che si accendono si
 * accendono. Si riscrive da capo solo se cambia il tipo di misura — cosa che
 * capita quando una sezione perde o guadagna una riga. */
function aggiornaMisura(nodo, widget, firma) {
  const [tipo, dato] = firma.split(":");
  const barra = nodo.querySelector(".dm-tile-scala i") || nodo.querySelector(".dm-tile-batt i");
  const punti = nodo.querySelectorAll(".dm-tile-punti i");
  if ((tipo === "barra" || tipo === "batt") && barra) {
    barra.style.width = `${dato}%`;
    return;
  }
  if (tipo === "punti" && punti.length) {
    const [accesi, segmenti] = dato.split("/").map(Number);
    if (punti.length === segmenti) {
      punti.forEach((segmento, i) => {
        if (i < accesi) segmento.dataset.on = "true";
        else delete segmento.dataset.on;
      });
      return;
    }
  }
  nodo.innerHTML = misuraMarkup(widget);
}

/* Un nome non finisce mai coi puntini.
 *
 * Prima si stringe la spaziatura fra le lettere, poi si scende di corpo, e
 * solo alla fine si va a capo su due righe. «Elettrodomestici», che e' il piu'
 * lungo di tutti, entra in una riga sola anche su un telefono stretto. */
function fallaEntrare(nodo, spazioBase, corpoMinimo) {
  if (!nodo) return;
  nodo.style.letterSpacing = "";
  nodo.style.fontSize = "";
  /* La soglia e' un pixel intero di sforo, non due: nelle pillole compatte il
   * nome sfora spesso di un pixel solo — colpa degli arrotondamenti a corpo
   * 8.8 — e con la soglia larga il fitter non interveniva mai: restava il
   * taglio coi puntini, cioe' l'ellissi spuria, su nomi che un decimo di
   * corpo in meno avrebbe fatto entrare interi. */
  const stretta = () =>
    nodo.scrollWidth - nodo.clientWidth >= 1 || nodo.scrollHeight - nodo.clientHeight >= 1;
  if (!stretta()) return;
  let spazio = spazioBase;
  let corpo = Number.parseFloat(root.getComputedStyle?.(nodo)?.fontSize) || 10;
  for (let giro = 0; giro < 20 && stretta(); giro += 1) {
    if (spazio > 0.015) {
      spazio -= 0.025;
      nodo.style.letterSpacing = `${spazio.toFixed(3)}em`;
    } else if (corpo > corpoMinimo) {
      corpo -= 0.4;
      nodo.style.fontSize = `${corpo.toFixed(1)}px`;
    } else break;
  }
}

function sistemaLeScritte(dove = doc) {
  /* Il minimo scende a 6.7: nelle pillole compatte il nome parte gia' da 8.8
   * pixel, e fermarsi a 7.6 lasciava «Elettrodomestici» a meta' strada — ne'
   * intero ne' leggibile. Prima si stringe la spaziatura, poi il corpo: e'
   * l'ordine che `fallaEntrare` ha gia'. */
  for (const nome of dove?.querySelectorAll?.("[data-dm-tile-label]") || [])
    fallaEntrare(nome, 0.11, 6.7);
  /* Anche il titolo della finestra: «Elettrodomestici» a venticinque pixel
   * con due di spaziatura finiva sotto il tasto di chiusura. */
  for (const titolo of dove?.querySelectorAll?.("[data-dm-titolo]") || [])
    fallaEntrare(titolo, 0.09, 15);
}

/* Accesa o calma.
 *
 * Le sei tessere gridavano tutte allo stesso modo: sei pastiglie colorate, sei
 * aloni, sei bagliori. Quando gridano tutti non si sente nessuno. Una tessera
 * adesso nasce calma — pastiglia neutra, niente velo — e prende colore solo
 * quando il suo stato lo merita: luci accese, clima in funzione, un'apertura
 * da chiudere, l'auto attaccata alla presa.
 *
 * Il dato c'era gia': la quota che il modello calcola e' quasi sempre «quanti
 * su quanti sono attivi». Dove non lo e' — la carica dell'auto, le cose da
 * fare — il modello lo dice chiaro con «attiva». */
export function tesseraAccesa(widget) {
  if (widget?.alert) return true;
  if (typeof widget?.attiva === "boolean") return widget.attiva;
  return widget?.ring != null && widget.ring > 0;
}

/* Il grado e la percentuale stanno attaccati al numero; i chilowatt e i
 * chilometri sono parole, e vanno staccati come un'etichetta. */
function unitaSimbolo(unita) {
  return /^[°%]/.test(String(unita || ""));
}

function tileMarkup(widget, index = 0) {
  const open = state.expanded === widget.key;
  const giaVista = viste().has(widget.key) ? ' data-dm-seen="true"' : "";
  const { numero, unita } = dividiValore(widget.value);
  return `<button type="button" class="dm-tile" data-dm-widget="${widget.key}" data-open="${open}"${giaVista}
      data-alert="${Boolean(widget.alert)}" data-acceso="${tesseraAccesa(widget)}"
      style="--dm-widget-accent:${widget.accent};--dm-tile-i:${index}" aria-expanded="${open}" aria-label="${esc(widget.label)}">
      <span class="dm-tile-alone" aria-hidden="true"></span>
      <span class="dm-tile-cima">
        <span class="dm-tile-chip" aria-hidden="true">${oggettoWidget(widget.key, widget.icon)}</span>
        <span class="dm-tile-label" data-dm-tile-label>${esc(widget.label)}</span>
      </span>
      <span class="dm-tile-val"><b class="dm-tile-value" data-dm-tile-value data-dm-len="${misuraValore(widget.value)}">${esc(numero)}</b><i class="dm-tile-unit" data-dm-tile-unit data-simbolo="${unitaSimbolo(unita)}">${esc(unita)}</i></span>
      <span class="dm-tile-fondo">
        <small class="dm-tile-caption"><span class="dm-tile-scroll" data-dm-tile-caption>${esc(widget.caption)}</span></small>
        <span class="dm-tile-misura" data-dm-misura="${esc(firmaMisura(widget))}" aria-hidden="true">${misuraMarkup(widget)}</span>
      </span>
    </button>`;
}

/* ── markup: i dettagli ───────────────────────────────────────────────── */

function rowShell(inner, attrs = "") {
  return `<div class="dm-w-row" ${attrs}>${inner}</div>`;
}

/* Una percentuale si vede prima di leggerla.
 *
 * Le righe delle finestre dicevano «12%» e basta: per sapere se era poco o
 * tanto bisognava leggere il numero e pensarci. Una barra sotto il nome lo
 * dice a colpo d'occhio, e il numero resta dov'e' — la barra aggiunge, non
 * sostituisce. Si mette solo dove la percentuale ha un fondo e un pieno che
 * vogliono dire qualcosa: una carica, una posizione, un'umidita'. Sotto il
 * venti per cento cambia colore, che e' la soglia a cui la stessa
 * percentuale smette di essere un dato e diventa una cosa da guardare.
 */
function livelloMarkup(percentuale) {
  /* `Number(null)` fa zero, e uno zero passa tutti i controlli che seguono:
   * senza questa riga ogni riga senza percentuale — una temperatura, un pH,
   * un acceso/spento — si prendeva una barra rossa vuota, cioe' l'avviso di
   * «quasi scarico» sopra una cosa che una carica non ce l'ha. */
  if (percentuale == null || percentuale === "") return "";
  const valore = Number(percentuale);
  if (!Number.isFinite(valore) || valore < 0 || valore > 100) return "";
  const quota = Math.round(valore);
  return `<span class="dm-w-livello" aria-hidden="true"${quota <= 20 ? ' data-basso="true"' : ""}>
      <i style="width:${quota}%"></i>
    </span>`;
}

/* La percentuale di una riga, quando ce l'ha e vuol dire un livello. */
function percentualeDellaRiga(riga) {
  for (const campo of ["battery", "position", "level", "soc", "humidity", "percent"]) {
    /* Assente non e' zero.
     *
     * Un aspirapolvere che non dice la sua carica la porta come `null`, e
     * `Number(null)` fa zero: la riga si disegnava con la barra rossa vuota,
     * cioe' annunciava una batteria a terra per dire che non la conosceva. Chi
     * disegna la barra, dopo, non ha piu' modo di distinguere quello zero da
     * uno zero vero. */
    const grezzo = riga?.[campo];
    if (grezzo === null || grezzo === undefined || grezzo === "") continue;
    const valore = Number(grezzo);
    if (Number.isFinite(valore)) return valore;
  }
  const testo = String(riga?.value ?? "").trim();
  const trovata = /^(\d{1,3})(?:[.,]\d+)?\s*%$/.exec(testo);
  return trovata ? Number(trovata[1]) : null;
}

/* La frase della casella da spuntare, scritta una volta sola.
 *
 * Il titolo si tira fuori prima: scritta con tre nomi di variabile diversi —
 * `item`, `riga`, `evento` — il raccoglitore delle traduzioni ne farebbe tre
 * chiavi per la stessa frase, e i cataloghi tre righe da tradurre uguali. */
export function segnaFatta(titolo) {
  const nome = clean(titolo);
  return t(`Segna fatta: ${nome}`, `Mark done: ${nome}`);
}

function todoItemMarkup(list, item, today) {
  const done = item.status === "completed";
  const dueDay = item.due ? item.due.slice(0, 10) : "";
  const overdue = !done && dueDay && dueDay < today;
  const due = dueDay
    ? `<span class="dm-todo-due"${overdue ? ' data-overdue="true"' : ""}>${overdue ? "⚠️" : "📅"} ${esc(dueDay)}</span>`
    : "";
  return `<li class="dm-todo-item${done ? " is-done" : ""}">
      <button type="button" class="dm-todo-check" data-dm-todo-check data-dm-todo-list="${esc(list.id)}"
        data-dm-todo-uid="${esc(item.uid)}" data-dm-todo-summary="${esc(item.summary)}"
        aria-label="${esc(segnaFatta(item.summary))}"${done ? " disabled" : ""}></button>
      <span class="dm-todo-text">${esc(item.summary)}${due}</span>
      ${azioneDellaCosaMarkup(item, list)}
      <button type="button" class="dm-todo-del" data-dm-todo-del data-dm-todo-list="${esc(list.id)}"
        data-dm-todo-uid="${esc(item.uid)}" data-dm-todo-summary="${esc(item.summary)}"
        title="${esc(t("Togli dalla lista", "Remove from the list"))}"
        aria-label="${esc(t(`Togli dalla lista: ${item.summary}`, `Remove from the list: ${item.summary}`))}">🗑️</button>
    </li>`;
}

/* Le cose da fare, disegnate dove serve.
 *
 * La stessa lista che sta nella finestra della Home serve anche alla pagina
 * dell'Agenda: e' un pezzo solo, con gli stessi gesti — la spunta, il cestino,
 * la riga per scrivere — perche' due elenchi da spuntare sarebbero due modi di
 * spuntare, e uno dei due prima o poi si dimenticherebbe di ricaricare. */
/* Le scadenze delle liste, per chi disegna l'agenda.
 *
 * La pagina le chiede come le chiede la finestra: una cosa da fare con una
 * data e' un impegno di quel giorno, e le liste sono le stesse. */
export function scadenzeDaFare() {
  const cose = todoModel(allStates());
  return cose ? scadenzeDelleListe(cose.blocks) : [];
}

/* Le liste, col nome con cui si chiamano: servono al modulo per far scegliere
 * dove finisce una cosa nuova. */
/* Come si chiama una lista quando chi configura non le ha dato un nome.
 *
 * «TODO.LISTA_DELLA_SPESA» in cima al blocco delle cose da fare: era
 * l'entity_id crudo, per giunta gridato in maiuscolo dal vestito del titolo.
 * Il nome ce l'ha gia' Home Assistant, ed e' quello scritto di la'. */
function nomeDellaLista(list) {
  return nomeDellEntita(list?.entity, list?.name);
}

export function listeConNome() {
  return configuredTodoLists().map((list, index) => ({
    id: list.id,
    entity: list.entity,
    name: nomeDellEntita(list.entity, list.name) || `${t("Lista", "List")} ${index + 1}`,
  }));
}

export function bloccoDaFareMarkup() {
  const cose = todoModel(allStates());
  return cose ? todoDetail(cose) : "";
}

function todoDetail(widget) {
  const today = localToday();
  return widget.blocks
    .map(({ list, items }) => {
      /* Le cose con una data stanno nell'agenda, nel loro giorno (#259): qui
       * restano quelle che un giorno non ce l'hanno. Mostrarle in tutti e due
       * i posti sarebbe la stessa riga due volte nella stessa pagina. */
      const senzaData = (items || []).filter((item) => !voceConScadenza(item));
      const open = pendingTodoItems(senzaData);
      const shown = senzaData
        .filter((item) => item.status !== "completed" || item.localDone)
        .slice(0, MAX_VISIBLE_ITEMS);
      const extra = open.length - shown.filter((item) => item.status !== "completed").length;
      let body;
      if (items === null) body = `<p class="dm-w-empty">${esc(t("Caricamento…", "Loading…"))}</p>`;
      else if (!shown.length)
        body = `<p class="dm-w-empty">✨ ${esc(t("Tutto fatto", "All done"))}</p>`;
      else
        body = `<ul class="dm-todo-items">${shown.map((item) => todoItemMarkup(list, item, today)).join("")}</ul>${
          extra > 0
            ? `<p class="dm-w-empty">${esc(t(`+${extra} altre voci`, `+${extra} more items`))}</p>`
            : ""
        }`;
      /* La riga per scrivere sta in fondo alla lista a cui appartiene: con
       * piu' liste aperte, una casella sola in cima non direbbe in quale
       * finisce quello che si scrive. */
      const scrivi = `<div class="dm-todo-add">
        <input type="text" class="dm-todo-new" data-dm-todo-new="${esc(list.id)}"
          value="${esc(state.bozze.get(list.id) || "")}" maxlength="200"
          placeholder="${esc(t("Aggiungi una cosa da fare…", "Add something to do…"))}"
          aria-label="${esc(t(`Aggiungi a ${nomeDellaLista(list)}`, `Add to ${nomeDellaLista(list)}`))}">
        <button type="button" class="dm-todo-plus" data-dm-todo-add="${esc(list.id)}"
          title="${esc(t("Aggiungi", "Add"))}" aria-label="${esc(t("Aggiungi", "Add"))}">＋</button>
      </div>`;
      return `<div class="dm-w-block"><span class="dm-w-block-title">${esc(nomeDellaLista(list))}</span>${body}${scrivi}</div>`;
    })
    .join("");
}

/* Il pannello del calendario (#259): un giorno per volta.
 *
 * «Cliccandoci si apre una lista giorni/giorno e un elenco tipo come gia'
 * esistente Da Fare»: la stessa forma — un titolo di blocco e sotto le righe
 * — con la differenza che qui il titolo e' un giorno e le righe hanno un'ora.
 * Le stesse parole che si usano parlando: «Oggi», «Domani», e poi la data. */
/* Una riga dell'agenda: un appuntamento o una scadenza.
 *
 * Sono due cose diverse e si vedono diverse. L'appuntamento porta la sua ora e
 * i tasti per spostarlo o cancellarlo; la scadenza porta la casella da
 * spuntare, perche' una cosa da fare non si sposta: si fa. */
function rigaAgendaMarkup(riga, adesso, parole, lingua, piuCalendari) {
  if (riga.tipo === "scadenza")
    return `<li class="dm-cal-evento" data-scadenza="true">
      <span class="dm-cal-ora">${esc(oraDellEvento(riga, parole, lingua))}</span>
      <button type="button" class="dm-todo-check" data-dm-todo-check
        data-dm-todo-list="${esc(riga.listaId)}" data-dm-todo-uid="${esc(riga.uid)}"
        data-dm-todo-summary="${esc(riga.summary)}"
        aria-label="${esc(segnaFatta(riga.summary))}"></button>
      <span class="dm-cal-testo">
        <b>${esc(riga.summary || t("Senza titolo", "Untitled"))}</b>
        <small>${esc(riga.lista)}</small>
      </span>
      ${azioneDellaScadenzaMarkup(riga)}
    </li>`;
  const ora = inCorso(riga, adesso);
  return `<li class="dm-cal-evento" data-adesso="${ora}">
    <span class="dm-cal-ora">${esc(oraDellEvento(riga, parole, lingua))}</span>
    <span class="dm-cal-testo">
      <b>${esc(riga.summary || t("Senza titolo", "Untitled"))}</b>
      ${
        /* Il luogo e il calendario di provenienza stanno sotto, e solo se ci
         * sono: una riga vuota sotto ogni titolo farebbe un elenco alto il
         * doppio per niente. */
        riga.location || piuCalendari
          ? `<small>${esc(
              [piuCalendari ? riga.calendario : "", riga.location].filter(Boolean).join(" · "),
            )}</small>`
          : ""
      }
    </span>
    ${ora ? `<span class="dm-cal-adesso">${esc(t("Adesso", "Now"))}</span>` : ""}
    ${azioniDellEventoMarkup(riga, chiaveDellEvento(riga))}
  </li>`;
}

/* Il pannello dell'agenda (#259): un giorno per volta, appuntamenti e scadenze.
 *
 * «Cliccandoci si apre una lista giorni/giorno e un elenco tipo come gia'
 * esistente Da Fare»: la stessa forma — un titolo di blocco e sotto le righe —
 * con la differenza che qui il titolo e' un giorno. E dentro ci sono tutte e
 * due le cose che quel giorno riguardano: quello che succede a un'ora e quello
 * che scade. */
function calendarioDetail(widget, scadenze = []) {
  const adesso = Date.now();
  const lingua = locale();
  const parole = paroleDelCalendario();
  const piuCalendari = widget.calendari.length > 1;
  const { ritardo, giorni } = agendaPerGiorno(widget.eventi, scadenze, adesso);
  /* Il modulo sa quali calendari ci sono da chi lo disegna: e' lo stesso
   * elenco in Home e nella pagina, e passarglielo in un attributo vorrebbe
   * dire un JSON dentro il documento. */
  dichiaraCalendari(widget.calendari);
  const modulo = moduloMarkup(widget.calendari, listeConNome());
  /* Il tasto sta in cima e non in fondo: la finestra scorre, e in fondo a
   * un'agenda di due settimane il tasto per segnare un impegno e' un tasto che
   * non si trova. */
  const nuovo = bozzaAperta() ? "" : tastoNuovoMarkup(widget.calendari);
  const testa = nuovo ? `<div class="dm-cal-fondo">${nuovo}</div>` : "";

  /* Quello che e' scaduto sta in cima, in un blocco suo: una cosa da fare di
   * martedi' scorso non appartiene a martedi' scorso — nessuno scorre indietro
   * per trovarla — appartiene ad adesso. */
  const arretrati = ritardo.length
    ? `<div class="dm-w-block" data-dm-ritardo="true">
        <span class="dm-w-block-title">⚠️ ${esc(parole.inRitardo)}</span>
        <ul class="dm-cal-lista">${ritardo
          .map((riga) => rigaAgendaMarkup(riga, adesso, parole, lingua, piuCalendari))
          .join("")}</ul>
      </div>`
    : "";

  if (!giorni.length && !arretrati)
    return `${modulo}${testa}<p class="dm-w-empty">${esc(
      widget.inArrivo
        ? t("Caricamento…", "Loading…")
        : t("✨ Niente in programma", "✨ Nothing scheduled"),
    )}</p>`;

  const elenco = giorni
    .slice(0, GIORNI_NEL_PANNELLO)
    .map(
      ({ giorno, eventi }) =>
        `<div class="dm-w-block"><span class="dm-w-block-title">${esc(
          etichettaDelGiorno(giorno, adesso, parole, lingua),
        )}</span><ul class="dm-cal-lista">${eventi
          .map((riga) => rigaAgendaMarkup(riga, adesso, parole, lingua, piuCalendari))
          .join("")}</ul></div>`,
    )
    .join("");
  return `${modulo}${testa}${arretrati}${elenco}`;
}

function agendaDetail(widget, states) {
  /* Le scadenze delle liste entrano nell'agenda, nel loro giorno: una cosa da
   * fare con una data E' un impegno di quel giorno. */
  const scadenze = scadenzeDelleListe(widget.blocks);
  const impegni = widget.calendario
    ? calendarioDetail(widget.calendario, scadenze)
    : /* Senza calendari, le scadenze un posto ce l'hanno lo stesso: sono
       * l'agenda di chi tiene solo le liste. */
      scadenze.length
      ? calendarioDetail({ eventi: [], calendari: [], inArrivo: false }, scadenze)
      : "";
  const cose = widget.cose ? todoDetail(widget.cose) : "";
  if (!impegni) return cose;
  if (!cose) return impegni;
  return `<div class="dm-ag-parte" data-dm-ag="impegni">
      <h5 class="dm-ag-titolo">📅 ${esc(t("Impegni", "Appointments"))}</h5>
      ${impegni}
    </div>
    <div class="dm-ag-parte" data-dm-ag="cose">
      <h5 class="dm-ag-titolo">✅ ${esc(t("Da fare", "To-do"))}</h5>
      ${cose}
    </div>`;
}

function lightsDetail(widget) {
  if (!widget.on.length && !widget.rows.length) return "";
  const rows = [...widget.rows].sort((a, b) => Number(b.on) - Number(a.on)).slice(0, 14);
  return rows
    .map((row) =>
      rowShell(
        `<span class="dm-w-glyph" data-on="${row.on}" aria-hidden="true">💡</span>
         <span class="dm-w-name">${esc(row.name)}<small>${esc(row.room)}</small></span>
         ${
           row.comando === false
             ? `<span class="dm-w-bloccata" title="${esc(t("Si vede ma non si comanda", "Shown but not controllable"))}" aria-hidden="true">🔒</span>`
             : `<button type="button" class="dm-w-switch" data-dm-w-light="${esc(row.entity)}" data-on="${row.on}"
           aria-label="${esc(row.name)}"><i></i></button>`
         }`,
      ),
    )
    .join("");
}

/* L'icona racconta cosa sta facendo l'unita': fiamma quando scalda, fiocco
 * quando raffresca — la stessa lingua della pagina Clima. */
/* Il disegno di una riga del clima: prima cosa sta facendo, poi cos'e'.
 *
 * Prima guardava soltanto lo stato, e chiudeva con il fiocco di neve per
 * tutto quello che non riconosceva: «off», «auto», «heat_cool». In una casa
 * dove il clima sono i termosifoni voleva dire tutte le righe col fiocco,
 * anche d'inverno a caldaia accesa. Quando lo stato non lo dice, lo dice il
 * tipo scelto in configurazione — lo stesso che le Stanze disegnano gia'. */
const ICONE_CLIMA = Object.freeze({ termo: "🔥", pompa: "♨️", clima: "❄️" });

function climateGlyph(mode, tipo = "clima") {
  if (mode.includes("heat") && mode.includes("cool")) return ICONE_CLIMA[tipo] || "❄️";
  if (mode.includes("heat")) return "🔥";
  if (mode.includes("cool")) return "❄️";
  if (mode.includes("dry")) return "💧";
  if (mode.includes("fan")) return "🌀";
  return ICONE_CLIMA[tipo] || "❄️";
}

/* I nomi delle modalita', gli stessi che usa la scheda del Clima rapido in
 * configurazione: «cool» in faccia a chi guarda non lo dice nessuno. */
/* Il simbolo di accensione, disegnato invece che scritto.
 *
 * Il carattere «⏻» (U+23FB) sta in un blocco che i font di sistema di Android
 * non coprono: sul telefono al posto del tasto usciva il quadratino vuoto del
 * carattere che manca — un comando che non si capisce e' un comando che non si
 * preme. Due tratti in SVG non dipendono da nessun font, prendono il colore
 * della riga come tutto il resto e restano nitidi a qualunque misura. */
/* I comandi si disegnano, non si scrivono.
 *
 * Le tapparelle avevano tre caratteri di testo — «▲», «■», «▼» — e con essi le
 * loro etichette: chi legge lo schermo ad alta voce sentiva «triangolo nero
 * rivolto verso l'alto». Sono anche caratteri di ripiego, disegnati da
 * qualunque font capiti, quindi tre pesi diversi in tre telefoni diversi. Qui
 * sono tre tratti come quello dell'accensione: stesso spessore, stesso colore
 * della riga, nitidi a qualunque misura, e la parola sta nell'etichetta.
 *
 * La freccia e' una punta con la sua asta, non un triangolo pieno: dice «va
 * su» invece di «guarda in su», e accanto al quadrato dello stop le tre cose
 * si leggono come una famiglia. */
const TRATTO =
  'viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false" fill="none" ' +
  'stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"';

const GLIFO_SU = `<svg ${TRATTO}><path d="M12 19V6"/><path d="M6 11.5 12 5.5l6 6"/></svg>`;
const GLIFO_GIU = `<svg ${TRATTO}><path d="M12 5v13"/><path d="M6 12.5 12 18.5l6-6"/></svg>`;
const GLIFO_FERMA =
  '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false" ' +
  'fill="currentColor"><rect x="7" y="7" width="10" height="10" rx="2.4"/></svg>';
const GLIFO_ROTELLA =
  `<svg ${TRATTO}><circle cx="12" cy="12" r="3.1"/>` +
  '<path d="M12 3.6v2.2M12 18.2v2.2M20.4 12h-2.2M5.8 12H3.6M18 6l-1.6 1.6M7.6 16.4 6 18M18 18l-1.6-1.6M7.6 7.6 6 6"/></svg>';

const GLIFO_ACCENSIONE =
  '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" focusable="false" fill="none" ' +
  'stroke="currentColor" stroke-width="2.3" stroke-linecap="round">' +
  '<path d="M12 3v8"/><path d="M6.8 6.6a7.5 7.5 0 1 0 10.4 0"/></svg>';

const NOMI_MODO = () => ({
  off: t("Spento", "Off"),
  cool: t("Raffrescamento", "Cooling"),
  heat: t("Riscaldamento", "Heating"),
  heat_cool: t("Automatico caldo/freddo", "Heat/cool"),
  auto: t("Automatico", "Auto"),
  dry: t("Deumidificazione", "Dry"),
  fan_only: t("Solo ventola", "Fan only"),
});

const NOMI_AZIONE = () => ({
  heating: t("sta scaldando", "heating"),
  cooling: t("sta raffrescando", "cooling"),
  drying: t("sta deumidificando", "drying"),
  fan: t("sta ventilando", "fanning"),
  idle: t("in attesa", "idle"),
  off: t("spento", "off"),
});

/* Il pannello che si apre sotto la riga, con la rotella.
 *
 * Sulla riga ci stanno il nome, la temperatura e l'acceso/spento: tutto il
 * resto — in che modalita' sta, a che velocita' gira la ventola, di quanto
 * alzare l'obiettivo — prima si poteva vedere solo andando nella pagina Clima.
 * Adesso e' qui sotto, e ci sono soltanto le modalita' e le velocita' che
 * quell'unita' dichiara di accettare: un tasto che l'unita' non sa eseguire e'
 * peggio di un tasto che non c'e'. */
function climatePanel(row, solo = false) {
  const nomi = NOMI_MODO();
  const modi = row.modi?.length ? row.modi : [];
  const modiMarkup = modi.length
    ? `<div class="dm-w-panel-row">
        <span class="dm-w-panel-lbl">${esc(t("Modalità", "Mode"))}</span>
        <div class="dm-w-chips">${modi
          .map(
            (modo) =>
              `<button type="button" class="dm-w-chip" data-dm-w-mode="${esc(modo)}"
                 data-dm-w-target="${esc(row.entity)}" data-on="${modo === row.mode}">${esc(
                   nomi[modo] || modo,
                 )}</button>`,
          )
          .join("")}</div>
      </div>`
    : "";
  const gradi = row.target == null ? null : formatNumber(row.target, 1);
  const temperaturaMarkup =
    row.target == null
      ? ""
      : `<div class="dm-w-panel-row">
          <span class="dm-w-panel-lbl">${esc(t("Temperatura", "Temperature"))}</span>
          <div class="dm-w-stepper">
            <button type="button" data-dm-w-temp="-1" data-dm-w-target="${esc(row.entity)}"
              aria-label="${esc(t("Abbassa", "Lower"))}">−</button>
            <b>${gradi}°</b>
            <button type="button" data-dm-w-temp="1" data-dm-w-target="${esc(row.entity)}"
              aria-label="${esc(t("Alza", "Raise"))}">+</button>
          </div>
        </div>`;
  const ventoleMarkup = row.ventole?.length
    ? `<div class="dm-w-panel-row">
        <span class="dm-w-panel-lbl">${esc(t("Ventola", "Fan"))}</span>
        <div class="dm-w-chips">${row.ventole
          .map(
            (voce) =>
              `<button type="button" class="dm-w-chip" data-dm-w-fan="${esc(voce)}"
                 data-dm-w-target="${esc(row.entity)}" data-on="${voce === row.ventola}">${esc(
                   voce,
                 )}</button>`,
          )
          .join("")}</div>
      </div>`
    : "";
  const azione = NOMI_AZIONE()[row.azione] || "";
  const noteMarkup =
    azione || row.umidita != null
      ? `<p class="dm-w-panel-note">${[
          azione,
          row.umidita == null ? "" : `${t("umidità", "humidity")} ${Math.round(row.umidita)}%`,
        ]
          .filter(Boolean)
          .map(esc)
          .join(" · ")}</p>`
      : "";
  const dentro = `${modiMarkup}${temperaturaMarkup}${ventoleMarkup}${noteMarkup}`;
  if (!dentro) return "";
  if (solo)
    return `<div class="dm-w-panel dm-w-panel-solo" data-dm-w-panel="${esc(row.entity)}">${dentro}</div>`;
  return `<div class="dm-w-panel" data-dm-w-panel="${esc(row.entity)}"${
    state.aperti.has(row.entity) ? "" : " hidden"
  }>${dentro}</div>`;
}

/* Lo stesso pannello, per chi non e' una tessera.
 *
 * La finestra della pagina Clima aveva la sua idea di cosa un'unita' sa fare:
 * cinque modalita' scritte a mano nel guscio — freddo, caldo, ventola, secco,
 * auto — mostrate a tutti allo stesso modo, e nascoste in blocco se il nome
 * dell'entita' conteneva la parola «termosifone». Un tasto che l'unita' non sa
 * eseguire e' peggio di un tasto che non c'e', e una pompa di calore chiamata
 * in un altro modo restava senza modalita' del tutto.
 *
 * Qui il pannello e' uno solo, e lo costruisce chi legge le entita': ci sono
 * le modalita' e le ventole che QUELL unita' dichiara, e i tasti li ascolta lo
 * stesso giro che ascolta quelli della tessera — sono attaccati al documento,
 * non alla finestra. */
export function climatePanelMarkup(entity) {
  const chiave = clean(entity);
  if (!chiave) return "";
  let unita = [];
  try {
    unita = readClimateUnits();
  } catch (_error) {
    return "";
  }
  /* Si cerca fra le unita' configurate, non fra le righe della tessera: la
   * finestra della pagina deve saper aprire anche quelle tenute fuori dalla
   * Home. */
  const states = allStates();
  const riga = unita
    .map((voce) => rigaClima(states, voce))
    .find((voce) => voce && voce.entity === chiave);
  return riga ? climatePanel(riga, true) : "";
}

function climateDetail(widget) {
  return widget.rows
    .map((row) => {
      const pannello = climatePanel(row);
      const aperto = pannello && state.aperti.has(row.entity);
      /* Il pannello sta FUORI dalla riga, subito sotto, e le si ricuce addosso
       * con un margine negativo e gli angoli aperti.
       *
       * Dentro non poteva stare: la riga e' una fila flessibile, e una fila
       * che va a capo, dentro una griglia, viene misurata come se non andasse
       * a capo — la griglia le dava l'altezza di una riga sola e il pannello
       * usciva sopra a quella dopo. Fuori e' un elemento come gli altri, alto
       * quanto gli serve. */
      return (
        rowShell(
          `<span class="dm-w-glyph" data-on="${row.on}" aria-hidden="true">${climateGlyph(row.mode || "", row.tipo)}</span>
         <span class="dm-w-name">${esc(row.name)}<small>${
           row.ambient == null ? "" : `${formatNumber(row.ambient, 1)}°`
         }${row.on && row.target != null ? ` → ${formatNumber(row.target, 1)}°` : ""}</small></span>
         ${
           pannello
             ? `<button type="button" class="dm-w-more" data-dm-w-more="${esc(row.entity)}"
                  aria-expanded="${Boolean(aperto)}"
                  aria-label="${esc(t("Altre impostazioni", "More settings"))}"
                  title="${esc(t("Altre impostazioni", "More settings"))}">${GLIFO_ROTELLA}</button>`
             : ""
         }
         <button type="button" class="dm-w-power" data-dm-w-clima="${esc(row.entity)}" data-on="${row.on}"
           aria-label="${esc(row.name)}">${GLIFO_ACCENSIONE}</button>`,
          `data-dm-w-open="${Boolean(aperto)}"`,
        ) + pannello
      );
    })
    .join("");
}

/* La tendina della posizione, la stessa della pagina Tapparelle (#200): la
 * card «Tapparelle aperte» della Home non c'e' piu', e quello che offriva —
 * fermare la tapparella a una percentuale scelta — vive qui, dove ora si
 * guardano le tapparelle dalla Home. Solo per chi accetta una posizione. */
function positionSelectMarkup(row) {
  if (!row.settable) return "";
  const invito = t("Scegli la posizione", "Choose the position");
  const voci = coverPositionChoices(row.preset)
    .map((value) => {
      const coda = value === 100 ? t("Aperta", "Open") : value === 0 ? t("Chiusa", "Closed") : "";
      return `<option value="${value}">${value === row.preset ? "⭐ " : ""}${value}%${coda ? ` · ${esc(coda)}` : ""}</option>`;
    })
    .join("");
  return `<select class="dm-w-position" data-dm-w-position="${esc(row.entity)}"
      data-dm-w-verso="${row.invertita ? "1" : ""}"
      aria-label="${esc(invito)}" title="${esc(invito)}"><option value="">↕</option>${voci}</select>`;
}

/* Un comando della tapparella: il disegno dentro, la parola nell'etichetta —
 * e la parola dice cosa succede a quella tapparella, non che forma ha il
 * tasto. */
function comandoTapparella(row, servizio, glifo, parola) {
  const invito = `${parola}: ${row.name}`;
  return `<button type="button" data-dm-w-cover="${esc(row.entity)}" data-dm-w-down="${esc(row.down)}"
      data-svc="${servizio}" title="${esc(parola)}" aria-label="${esc(invito)}">${glifo}</button>`;
}

function coversDetail(widget) {
  return widget.rows
    .map((row) =>
      rowShell(
        `<span class="dm-w-glyph" data-on="${row.open}" aria-hidden="true">🪟</span>
         <span class="dm-w-name">${esc(row.name)}<small>${
           /* La finestra col solo contatto non ha una percentuale da mostrare:
            * al suo posto dice quello che sa, cioe' se e' aperta. */
           row.soloSensore
             ? esc(row.open ? t("Aperta", "Open") : t("Chiusa", "Closed"))
             : row.position == null
               ? ""
               : `${row.position}%`
         }</small></span>
         ${
           row.isCover || row.relay
             ? `<span class="dm-w-arrows">
                 ${comandoTapparella(row, "open_cover", GLIFO_SU, t("Apri", "Open"))}
                 ${comandoTapparella(row, "stop_cover", GLIFO_FERMA, t("Ferma", "Stop"))}
                 ${comandoTapparella(row, "close_cover", GLIFO_GIU, t("Chiudi", "Close"))}
               </span>${positionSelectMarkup(row)}`
             : ""
         }`,
      ),
    )
    .join("");
}

function securityDetail(widget, states) {
  const parts = [];
  if (widget.alarm) {
    // L'antifurto si comanda da qui: gli stessi servizi e lo stesso tastierino
    // PIN della pagina Sicurezza (`promptPinAndSet`), solo in formato tessera.
    const comando = (service, on, icon, label) =>
      `<button type="button" data-dm-w-alarm="${service}" data-on="${on}"
         title="${esc(label)}" aria-label="${esc(label)}">${icon}</button>`;
    parts.push(
      rowShell(
        `<span class="dm-w-glyph" data-on="${widget.armed || widget.triggered}" aria-hidden="true">🛡️</span>
         <span class="dm-w-name">${esc(t("Antifurto", "Alarm"))}<small>${esc(widget.value)}</small></span>
         <span class="dm-w-alarm">
           ${comando("alarm_arm_away", widget.mode === "armed_away", "🏠", t("Fuori", "Away"))}
           ${comando("alarm_arm_night", widget.mode === "armed_night", "🌙", t("Notte", "Night"))}
           ${comando("alarm_disarm", !widget.armed && !widget.triggered, "🔓", t("Sblocca", "Disarm"))}
         </span>`,
      ),
    );
  }
  for (const door of widget.doors) {
    const raw = clean(stateOf(states, door.entity)?.state).toLowerCase();
    const label =
      raw === "locked"
        ? t("Chiusa a chiave", "Locked")
        : raw === "unlocked"
          ? t("Sbloccata", "Unlocked")
          : raw === "open"
            ? t("Aperta", "Open")
            : "";
    /* La porta si apre anche da qui.
     *
     * La riga la disegnava e basta: nome, stato, e un lucchetto che diceva
     * soltanto «questa vuole il PIN». Dalla pagina Sicurezza la stessa porta
     * si apre, e chi arriva dalla tessera non capisce perche' qui no.
     *
     * Il tasto porta lo stesso `data-dm-door` dei tasti di quella pagina, e
     * quel gesto lo ascolta il documento intero: e' la stessa mano che apre —
     * stessa conferma, stesso tastierino del PIN, stessa chiamata. Qui non si
     * ricopia niente, si chiede a chi lo sa gia' fare. */
    const apre = doorOpenCall(door.entity, stateOf(states, door.entity));
    const invito = door.pin ? t("Apri, col PIN", "Open, with the PIN") : t("Apri", "Open");
    parts.push(
      rowShell(
        `<span class="dm-w-glyph" aria-hidden="true">${iconaPortaMarkup(door.icon)}</span>
         <span class="dm-w-name">${esc(door.name || door.entity)}<small>${esc(label)}</small></span>
         ${
           apre
             ? `<button type="button" class="dm-w-door" data-dm-door="${esc(door.id)}"
                  title="${esc(invito)}" aria-label="${esc(`${invito}: ${door.name || door.entity}`)}">${
                    door.pin ? "🔐" : "🔓"
                  }</button>`
             : door.pin
               ? '<span class="dm-w-glyph" aria-hidden="true">🔒</span>'
               : ""
         }`,
      ),
    );
  }
  return parts.join("");
}

/* Casa, Solare, Rete e Batteria sono LETTURE: escono come caselle sotto
 * «Le misure» (`carteDalleRighe`), non come elenco qui sotto. */
function energyDetail() {
  return "";
}

/* Chi lavora e' una casella de «Le misure», col suo disegno vero; qui resta
 * solo la parola per la casa tutta spenta, che una casella non ce l'ha. */
function appliancesDetail(widget) {
  if (!widget.running.length)
    return `<p class="dm-w-empty">✨ ${esc(t("Tutto spento", "Everything off"))}</p>`;
  return "";
}

/* Le stanze coi loro gradi sono caselle de «Le misure», non un elenco. */
function temperatureDetail() {
  return "";
}

/* Ogni batteria col suo livello e' una casella de «Le misure». */
function batteriesDetail() {
  return "";
}

function floodDetail(widget) {
  return widget.rows
    .map((row) =>
      rowShell(
        `<span class="dm-w-glyph" data-on="true" aria-hidden="true">💧</span>
         <span class="dm-w-name">${esc(row.name)}</span>`,
      ),
    )
    .join("");
}

/* Anche gli avvisi personalizzati sono caselle: nome e stato, in carta. */
function customDetail() {
  return "";
}

/* Le miniature: i fotogrammi non stanno nel markup — li posa
 * `aggiornaTelecamere()` sulla stessa strada del muro della Sicurezza, cosi'
 * il diff del corpo non li tocca e il riquadro non lampeggia mai. */
function camerasDetail(widget) {
  return `<div class="dm-w-cams">${widget.rows
    .map(
      (row) => `<figure class="dm-w-cam" data-dm-w-cam="${esc(row.entity)}">
        <img alt="" decoding="async" data-dm-camera-state="loading">
        <figcaption><i class="dm-w-cam-live" aria-hidden="true"></i>${esc(row.name)}</figcaption>
      </figure>`,
    )
    .join("")}</div>`;
}

/* Il riepilogo in cima alla finestra.
 *
 * La tessera in Home dice un numero solo — la media, quante ne sono accese —
 * e aprendola quel numero spariva: restava la lista, che il conto lo fa fare a
 * chi legge. Qui sopra restano tre numeri, quelli che si guardano prima di
 * mettersi a leggere le righe, e sono ricavati dalle righe stesse: non c'e'
 * niente di nuovo da tenere aggiornato.
 */
function summaryChips(widget) {
  const righe = Array.isArray(widget.rows) ? widget.rows : [];
  if (righe.length < 2) return [];
  const media = (valori) =>
    valori.length ? valori.reduce((somma, valore) => somma + valore, 0) / valori.length : null;
  const numeri = (chiave) =>
    righe.map((riga) => Number(riga?.[chiave])).filter((valore) => Number.isFinite(valore));
  const accesi = righe.filter((riga) => riga?.on).length;
  if (widget.key === "clima") {
    const ambiente = media(numeri("ambient"));
    const obiettivi = righe.filter((riga) => riga?.on).map((riga) => Number(riga?.target));
    const obiettivo = media(obiettivi.filter((valore) => Number.isFinite(valore)));
    return [
      [t("in funzione", "running"), `${accesi}/${righe.length}`],
      ambiente == null ? null : [t("in casa", "indoors"), `${formatNumber(ambiente, 1)}°`],
      obiettivo == null ? null : [t("obiettivo", "target"), `${formatNumber(obiettivo, 1)}°`],
    ].filter(Boolean);
  }
  if (widget.key === "luci")
    return [
      [t("accese", "on"), String(accesi)],
      [t("spente", "off"), String(righe.length - accesi)],
    ];
  if (widget.key === "tapparelle") {
    const posizioni = numeri("position");
    const aperte = righe.filter((riga) => Number(riga?.position) > 0).length;
    return [
      [t("aperte", "open"), `${aperte}/${righe.length}`],
      posizioni.length
        ? [t("apertura media", "average"), `${Math.round(media(posizioni))}%`]
        : null,
    ].filter(Boolean);
  }
  if (widget.key === "batterie") {
    const livelli = numeri("level");
    if (!livelli.length) return [];
    return [
      [t("la più bassa", "lowest"), `${Math.round(Math.min(...livelli))}%`],
      [t("media", "average"), `${Math.round(media(livelli))}%`],
    ];
  }
  if (widget.key === "temperatura") {
    const gradi = numeri("temperature");
    if (!gradi.length) return [];
    return [
      [t("media", "average"), `${formatNumber(media(gradi), 1)}°`],
      [t("la più fredda", "coldest"), `${formatNumber(Math.min(...gradi), 1)}°`],
      [t("la più calda", "warmest"), `${formatNumber(Math.max(...gradi), 1)}°`],
    ];
  }
  return [];
}

function summaryMarkup(widget) {
  const voci = summaryChips(widget);
  if (voci.length < 2) return "";
  return `<div class="dm-w-summary">${voci
    .map(
      ([etichetta, valore]) =>
        `<div class="dm-w-stat"><b>${esc(valore)}</b><span>${esc(etichetta)}</span></div>`,
    )
    .join("")}</div>`;
}

/* Le pillole dello stato: cosa sta lavorando e cosa no.
 *
 * Nel progetto stanno sotto «LO STATO», verdi quelle attive e smorte le altre:
 * si legge in un colpo d'occhio chi e' in funzione senza contare le righe. */
function pilloleDelloStato(widget) {
  const righe = Array.isArray(widget.rows) ? widget.rows : [];
  /* Dodici e non otto: da quando le righe acceso/spento non fanno piu' lista
   * sotto, le pillole sono l'unico posto dove si leggono — una casa con
   * undici finestre le deve vedere tutte. */
  const voci = righe
    .filter((riga) => typeof riga?.on === "boolean" && clean(riga?.name))
    .slice(0, 12);
  if (!voci.length) return "";
  return `<h4 class="dm-w-titoletto">${esc(t("Lo stato", "The state"))}</h4>
    <div class="dm-w-pillole">${voci
      .map(
        (riga) =>
          `<span class="dm-w-pillola" data-acceso="${riga.on ? "true" : "false"}">${
            riga.glyph
              ? `<span class="dm-w-pillola-ic" aria-hidden="true">${riga.glyph}</span>`
              : ""
          }<span class="dm-w-pillola-nome">${esc(clean(riga.name))}</span>${
            clean(riga.value) ? `<b>${esc(clean(riga.value))}</b>` : ""
          }</span>`,
      )
      .join("")}</div>`;
}

/* Le righe di sola lettura, fatte caselle.
 *
 * «Nel progetto dei widget non era cosi', con la lista sotto: erano tutte
 * card oltre alla parte di analisi.» Le righe numeriche o testuali — la
 * temperatura dell'acqua, l'autonomia dell'auto, i watt della casa — hanno
 * gia' glifo, valore e nome: qui cambiano vestito, da elenco a caselle. Le
 * acceso/spento restano alle pillole, i comandi restano comandi. */
const CHIAVI_A_CARTE = new Set([
  "evidenza",
  "scaldabagno",
  "caldaia",
  "ups",
  "ev",
  "solare",
  "piscina",
  "prese",
  "irrigazione",
  "robot",
  "energia",
  "temperatura",
  "batterie",
  "allerte",
  "rifiuti",
  "elettrodomestici",
]);

/* La tessera dell'energia, qualunque impianto racconti.
 *
 * Con più impianti la prima tiene la chiave di sempre e le altre portano il
 * loro id attaccato (#286): chi decideva guardando la chiave «energia» deve
 * riconoscere anche le sue sorelle, altrimenti la seconda tessera esce senza
 * caselle, senza il verso della batteria e senza il suo popup. */
const eUnaTesseraEnergia = (chiave) =>
  clean(chiave) === "energia" || clean(chiave).startsWith("energia_");

function carteDalleRighe(widget) {
  /* Una tessera «a se'» delle evidenze si disegna come la tessera madre. */
  const chiave = clean(widget.key).startsWith("evidenza-") ? "evidenza" : clean(widget.key);
  if (!(CHIAVI_A_CARTE.has(chiave) || eUnaTesseraEnergia(chiave) || chiave.startsWith("custom-")))
    return [];
  const righe = Array.isArray(widget.rows) ? widget.rows : [];
  if (eUnaTesseraEnergia(chiave)) {
    const nomi = {
      house: t("Casa", "House"),
      solar: t("Solare", "Solar"),
      grid: t("Rete", "Grid"),
      battery: t("Batteria", "Battery"),
    };
    const glifi = { house: "🏠", solar: "☀️", grid: "🔌", battery: "🔋" };
    return righe.map((riga) => ({
      glyph: glifi[riga.group] || "⚡",
      /* La batteria dice anche quanto e' piena: watt e percentuale insieme,
       * o la sola percentuale quando la potenza non e' mappata. */
      valore:
        riga.group === "battery" && riga.soc != null
          ? riga.watts == null
            ? `${Math.round(riga.soc)}%`
            : `${formatWatts(riga.watts)} · ${Math.round(riga.soc)}%`
          : formatWatts(riga.watts),
      etichetta: nomi[riga.group] || clean(riga.group),
    }));
  }
  if (chiave === "temperatura") {
    /* Due misure diverse, non una stringa sola.
     *
     * «27,4° · 50%» erano gradi e umidita' incollati nello stesso numero
     * grande — stesso corpo, stesso colore, e a stringere finivano nei
     * puntini senza sapere quale dei due era sparito: «non si capisce niente
     * tra temperatura e umidita'». Adesso i gradi restano il numero della
     * casella e l'umidita' e' la sua riga, con la goccia davanti. */
    return righe.map((riga) => ({
      glyph: "🌡️",
      valore: `${formatNumber(riga.temperature, 1)}°`,
      etichetta: clean(riga.name),
      sotto: riga.humidity == null ? "" : `💧 ${Math.round(riga.humidity)}%`,
    }));
  }
  if (chiave === "batterie") {
    return righe.map((riga) => ({
      glyph: riga.level <= 20 ? "🪫" : "🔋",
      valore: `${Math.round(riga.level)}%`,
      etichetta: clean(riga.name),
    }));
  }
  if (chiave === "elettrodomestici") {
    /* Chi sta lavorando, coi suoi watt e il suo disegno vero: la lavatrice
     * ha l'oblo', il forno lo sportello. */
    return (Array.isArray(widget.running) ? widget.running : []).map((riga) => ({
      glyph: root.cdApplianceIcon?.(riga.type, 20) || "🫧",
      valore: riga.watts == null ? t("in funzione", "running") : formatWatts(riga.watts),
      etichetta: clean(riga.name),
    }));
  }
  if (chiave.startsWith("custom-")) {
    return righe.map((riga) => ({
      glyph: clean(widget.icon) || "•",
      valore: clean(riga.state),
      etichetta: clean(riga.name),
    }));
  }
  return righe
    .filter((riga) => !riga.comando && typeof riga?.on !== "boolean")
    .map((riga) => ({
      glyph: riga.glyph || "•",
      valore: clean(riga.value) || (riga.raw == null ? "—" : String(riga.raw)),
      etichetta: clean(riga.name),
    }));
}

/* Le caselle: i riassunti di `summaryChips` («la piu' bassa», «media», «in
 * funzione») piu' le letture fatte caselle. Un titolo solo, una griglia sola. */
function caselleDelleMisure(widget) {
  const voci = [
    ...summaryChips(widget).map(([etichetta, valore]) => ({ glyph: "", valore, etichetta })),
    ...carteDalleRighe(widget),
  ].slice(0, 12);
  if (!voci.length) return "";
  return `<h4 class="dm-w-titoletto">${esc(t("Le misure", "The readings"))}</h4>
    <div class="dm-w-caselle">${voci
      .map(
        (voce) =>
          `<div class="dm-w-casella">${
            voce.glyph
              ? `<span class="dm-w-casella-ic" aria-hidden="true">${voce.glyph}</span>`
              : ""
          }<b>${esc(voce.valore)}</b>${
            voce.sotto ? `<i class="dm-w-casella-sotto">${esc(voce.sotto)}</i>` : ""
          }<span>${esc(voce.etichetta)}</span></div>`,
      )
      .join("")}</div>`;
}

/* La corsa della misura: dov'era tre ore fa, dov'e' adesso.
 *
 * «La misura con la sua corsa»: un numero da solo non dice se sta salendo o
 * scendendo, e quasi sempre e' quello che si vuole sapere. La storia la chiede
 * a Recorder lo stesso trasporto che usa il grafico delle temperature — non se
 * ne apre un secondo — e finche' non risponde la finestra sta in piedi lo
 * stesso: il numero c'e', la linea arriva dopo.
 *
 * Si tiene in memoria per qualche minuto: aprire e chiudere la stessa finestra
 * tre volte non deve chiedere tre volte la stessa cosa. */
/* Tre ore, e la scritta sotto la linea lo dice a parole.
 *
 * Il numero non entra nella frase da tradurre: una frase costruita a pezzi non
 * si puo' estrarre per le altre lingue, e resterebbe in italiano dappertutto.
 * Le due cose devono restare d'accordo, e a tenerle d'accordo c'e' una prova. */
const CORSA_ORE = 3;
const CORSA_FRESCA_PER = 4 * 60 * 1000;
const corse = new Map();
const corseInVolo = new Set();

/* Da dove si prende il numero da mettere sulla linea.
 *
 * Non basta che una riga abbia un numero: bisogna sapere se quel numero e' lo
 * stato dell'entita' o un suo attributo, perche' Recorder li serve in due modi
 * diversi. Un sensore di temperatura ha il numero nello stato; un
 * termostato lo tiene in `current_temperature`, e chiedendo lo stato si
 * riceve «heat»; una tapparella lo tiene in `current_position`, e lo stato dice
 * «open». Chiedere lo stato e basta voleva dire nessuna linea per meta' delle
 * sezioni, senza che si capisse perche'. */
const ATTRIBUTO_DELLA_CORSA = Object.freeze({
  ambient: "current_temperature",
  position: "current_position",
});
const CAMPI_DELLA_CORSA = ["raw", "level", "watts", "temperature", "ambient", "position"];

function fonteDellaCorsa(widget) {
  const righe = Array.isArray(widget.rows) ? widget.rows : [];
  for (const riga of righe) {
    const entity = clean(riga?.entity);
    if (!entity) continue;
    for (const campo of CAMPI_DELLA_CORSA) {
      if (!Number.isFinite(Number(riga?.[campo]))) continue;
      return { entity, attributo: ATTRIBUTO_DELLA_CORSA[campo] || "" };
    }
  }
  return null;
}

/* Ogni punto col suo momento.
 *
 * Recorder risponde quando lo stato cambia, non a intervalli regolari: un
 * sensore fermo per tre ore e sceso un minuto fa da' due punti. Spalmandoli a
 * distanza uguale la linea raccontava una discesa lenta di tre ore, che non e'
 * mai successa. Ogni punto va messo dove sta davvero nel tempo. */
async function chiediLaCorsa(fonte) {
  const broker = root.DashboardModernEnergyService?.broker;
  if (typeof broker?.request !== "function") return [];
  const fine = Date.now();
  const inizio = fine - CORSA_ORE * 60 * 60 * 1000;
  const conAttributi = Boolean(fonte.attributo);
  const risposta = await broker.request({
    type: "history/history_during_period",
    start_time: new Date(inizio).toISOString(),
    end_time: new Date(fine).toISOString(),
    entity_ids: [fonte.entity],
    include_start_time_state: true,
    significant_changes_only: false,
    minimal_response: !conAttributi,
    no_attributes: !conAttributi,
  });
  const grezze = Array.isArray(risposta) ? risposta[0] : risposta?.[fonte.entity];
  const momento = (riga) => {
    const quando = riga?.lu ?? riga?.last_updated ?? riga?.last_changed;
    if (typeof quando === "number") return quando * 1000;
    const letto = Date.parse(quando ?? "");
    return Number.isFinite(letto) ? letto : NaN;
  };
  return (Array.isArray(grezze) ? grezze : [])
    .map((riga) => ({
      quando: momento(riga),
      valore: Number(
        conAttributi
          ? (riga?.a ?? riga?.attributes ?? {})[fonte.attributo]
          : (riga?.s ?? riga?.state),
      ),
    }))
    .filter((punto) => Number.isFinite(punto.valore) && Number.isFinite(punto.quando))
    .map((punto) => ({
      ...punto,
      // fuori dalla finestra chiesta non si va: il primo punto puo' essere
      // quello di partenza, che Recorder data prima dell'inizio.
      quando: Math.min(Math.max(punto.quando, inizio), fine),
    }));
}

function corsaDi(fonte) {
  if (!fonte?.entity) return null;
  const chiave = `${fonte.entity}|${fonte.attributo}`;
  const avuta = corse.get(chiave);
  if (avuta && Date.now() - avuta.quando < CORSA_FRESCA_PER) return avuta.punti;
  if (corseInVolo.has(chiave)) return avuta?.punti || null;
  corseInVolo.add(chiave);
  chiediLaCorsa(fonte)
    .then((punti) => corse.set(chiave, { punti, quando: Date.now() }))
    .catch(() => corse.set(chiave, { punti: [], quando: Date.now() }))
    .finally(() => {
      corseInVolo.delete(chiave);
      /* La linea e' arrivata: si ridisegna la finestra, che intanto e' rimasta
       * aperta e leggibile senza. */
      schedule();
    });
  return avuta?.punti || null;
}

function corsaMarkup(widget) {
  const punti = corsaDi(fonteDellaCorsa(widget));
  if (!punti || punti.length < 2) return "";
  const valori = punti.map((punto) => punto.valore);
  const minimo = Math.min(...valori);
  const massimo = Math.max(...valori);
  const ampiezza = massimo - minimo || 1;
  const fine = punti[punti.length - 1].quando;
  const inizio = Math.min(punti[0].quando, fine - CORSA_ORE * 60 * 60 * 1000);
  const durata = fine - inizio || 1;
  const alto = (valore) => (26 - ((valore - minimo) / ampiezza) * 22).toFixed(2);
  const disegno = punti
    .map(
      (punto) => `${(((punto.quando - inizio) / durata) * 100).toFixed(2)},${alto(punto.valore)}`,
    )
    .join(" ");
  return `<div class="dm-w-corsa">
      <svg viewBox="0 0 100 30" preserveAspectRatio="none" role="img" aria-hidden="true">
        <polyline points="${disegno}" />
        <circle cx="100" cy="${alto(valori[valori.length - 1])}" r="1.6" />
      </svg>
      <span>${esc(t("3 ore fa", "3h ago"))}</span>
      <span>${esc(t("adesso", "now"))}</span>
    </div>`;
}

/* Il verdetto e la frase, che sono le prime due cose che si leggono.
 *
 * «Il popup smette di essere un elenco e dice cosa sta facendo l'impianto, da
 * quanto, e dove va a finire.» Il verdetto e' la pillola colorata; la frase la
 * scrive il modulo puro, che sa dire «2 zone su 5 accese, manca 1,2°» invece
 * di lasciare undici righe da mettere insieme a mente. */
/* Il verdetto e la frase, e sotto i punti che la sostengono.
 *
 * La frase la scrive il motore di analisi quando la sezione ha una lettura
 * sua — l'Energia ragiona sul bilancio, la Temperatura sulla distanza fra la
 * stanza piu' calda e la piu' fredda — e in quel caso il tono lo decide la
 * lettura, non il conteggio delle righe: una piscina col pH fuori norma e' da
 * guardare anche se non c'e' niente «acceso».
 *
 * Le sette sezioni fatte di cose che si accendono e si spengono continuano ad
 * avere la loro frase di prima, che li' e' giusta.
 */
/* L'entita' che racconta la storia di una tessera.
 *
 * E' quella del numero grande: se la finestra mostra i watt di casa, la storia
 * che interessa e' quella dei watt di casa. Dove il numero grande non viene da
 * un'entita' sola — le luci, le tapparelle, che sono elenchi — non c'e' niente
 * da chiedere, e infatti quelle sezioni una lettura nel tempo non ce l'hanno.
 */
function entitaDelRacconto(widget) {
  if (eUnaTesseraEnergia(widget?.key)) {
    const energia = section("energy", {}) || {};
    /* Mentre la batteria si carica, la domanda non e' piu' «quanto consuma la
     * casa» ma «quando e' piena». Il racconto segue allora lo stato di carica,
     * ed e' quello che permette di dire «cariche fra un'ora e venti» invece di
     * ripetere un numero che si legge gia' sopra. */
    if (widget?.soggetto === "carica")
      return clean(energia?.battery?.soc) || "dm.energy_stato_carica_batteria";
    return clean(energia?.house?.power) || "dm.energy_potenza_consumo_casa";
  }
  /* La temperatura in grande e' la MEDIA delle stanze, e una media non ha una
   * sua entita' da chiedere allo storico. Con una stanza sola la media e' quella
   * stanza, e la storia e' la sua; con due o piu' si chiedeva la storia della
   * prima e la si confrontava con la media di tutte — «piu' alto del solito»
   * detto su un numero diverso da quello scritto sopra. Meglio nessuna lettura
   * nel tempo che una che parla di un'altra cosa. */
  if (widget?.key === "temperatura")
    return (widget?.rows?.length || 0) === 1 ? clean(widget?.rows?.[0]?.entity) : "";
  if (widget?.key === "ev") return clean(widget?.rows?.[0]?.batteria || widget?.rows?.[0]?.entity);
  if (["solare", "piscina", "robot", "irrigazione"].includes(widget?.key))
    return clean(widget?.rows?.[0]?.entity);
  if (widget?.key === "elettrodomestici")
    return clean(widget?.running?.[0]?.entity || widget?.rows?.[0]?.entity);
  return "";
}

/* Le tre ore precedenti, se lo storico le ha gia' date.
 *
 * Non si aspetta: la finestra si apre subito col numero che c'e', e se la
 * storia arriva dopo la finestra si ridisegna. Una finestra che aspetta la
 * rete per aprirsi, su una casa senza Recorder, non si apre. */
function storiaDelWidget(widget) {
  const entita = entitaDelRacconto(widget);
  if (!entita) return null;
  /* Il valore di adesso va in coda alla storia: la risposta dello storico vale
   * nove minuti, e senza questa coda il modello leggerebbe come «adesso» un
   * valore vecchio fino a nove minuti — arrivando a contraddire il numero
   * grande della stessa finestra. */
  const stato = allStates()?.[entita];
  const vivo = Number(clean(stato?.state));
  return puntiDi(
    entita,
    3,
    Number.isFinite(vivo) ? { adesso: { quando: Date.now(), valore: vivo } } : {},
  );
}

function verdettoEFrase(widget) {
  /* La batteria che si carica cambia la domanda della sezione Energia: si
   * vuole sapere quando sara' piena. Il soggetto lo decide chi disegna, che
   * conosce i numeri di adesso, e il motore ci si adegua. */
  const batteria = widget?.rows?.find?.((r) => r?.group === "battery")?.watts;
  const conSoggetto =
    eUnaTesseraEnergia(widget?.key) && Number(batteria) < -10
      ? { ...widget, soggetto: "carica" }
      : widget;
  const lettura = analisiDellaSezione(
    conSoggetto,
    t,
    Date.now(),
    storiaDelWidget(conSoggetto),
    locale?.(),
  );
  const verdetto = verdettoDellaTessera(widget, t);
  const tono = lettura?.tono || verdetto.tono;
  const parola = tono === verdetto.tono ? verdetto.testo : parolaDelVerdetto(tono, t);
  const misura = clean(widget.value);
  const nota = clean(widget.caption);
  const punti = lettura?.punti?.length
    ? `<ul class="dm-w-punti">${lettura.punti.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>`
    : "";
  return `<section class="dm-w-racconto" data-dm-verdetto="${tono}">
      <span class="dm-w-verdetto">${esc(parola)}</span>
      <p class="dm-w-frase">${esc(lettura?.frase || fraseDellaTessera(widget, t))}</p>
      ${punti}
      ${
        misura
          ? `<div class="dm-w-misura"><b>${esc(misura)}</b>${
              nota ? `<small>${esc(nota)}</small>` : ""
            }</div>`
          : ""
      }
      ${corsaMarkup(widget)}
    </section>`;
}

/* Una forma sola, sempre nello stesso ordine.
 *
 * «Diciassette sezioni. Stesso ordine, sempre: il verdetto, la frase, la
 * misura con la sua corsa, le caselle, i comandi.» I comandi sono le righe di
 * prima: li' ci sono gli interruttori, e quelli non si toccano — cambia il
 * posto, non quello che fanno. */
/* La risposta dell'assistenza si legge nella sua finestra, non qui: qui c'e'
 * l'ultima frase in breve, quante ne aspettano, e la porta. Niente verdetto
 * generico sopra, per la stessa ragione delle segnalazioni: il motore che
 * legge gli stati di casa qui non ha niente da leggere. */
function chatDetail(widget) {
  const ora = widget.scrittoIl ? quandoScritto(widget.scrittoIl) : "";
  const bolla = widget.anteprima
    ? `<div class="dm-w-chat">
        <div class="dm-w-chat-testa">
          <span aria-hidden="true">💬</span>
          <b>${esc(t("L'ultima risposta", "The latest reply"))}</b>
          ${ora ? `<small class="dm-w-chat-quando">${esc(ora)}</small>` : ""}
        </div>
        <p class="dm-w-chat-testo">${esc(widget.anteprima)}</p>
      </div>`
    : "";
  return `${bolla}
      <div class="dm-w-caselle">
        <div class="dm-w-casella"><b>${Number(widget.risposte) || 0}</b><small>${esc(
          t("Da leggere", "Unread"),
        )}</small></div>
      </div>
      <button type="button" class="dm-w-porta" data-dm-apri-chat>${esc(
        t("Apri la chat", "Open the chat"),
      )}</button>`;
}

function detailBody(widget, states) {
  if (widget.key === "assistenza") return chatDetail(widget);
  /* Le segnalazioni non si lavorano da qui. La finestra della tessera e'
   * larga un palmo, e rispondere a una issue vuol dire leggere il filo, gli
   * allegati, e scrivere: il posto per farlo esiste gia' ed e' il Cruscotto.
   * Qui ci sta il conto e la porta per arrivarci — duplicare la console in
   * miniatura vorrebbe dire tenerne allineate due. */
  if (widget.key === "segnalazioni") {
    /* Niente verdetto generico qui sopra. Quella riga la scrive il motore che
     * legge gli stati di casa — «acceso», «in corso», «qui non c'e' ancora
     * niente» — e su una coda di segnalazioni non ha niente da leggere: usciva
     * «Qui non c'e' ancora niente» sopra sette segnalazioni da lavorare, cioe'
     * il contrario di quello che la finestra stessa mostrava due righe sotto.
     * Meglio dire meno che dire il falso, e il conto grande la tessera lo porta
     * gia' in copertina.
     *
     * E le segnalazioni non si lavorano da qui: questa finestra e' larga un
     * palmo, e rispondere vuol dire leggere il filo, guardare gli allegati e
     * scrivere. Il posto c'e' gia'; qui ci sta il conto e la porta. */
    const conto = widget.conto || {};
    /* La lettura del tempo, che e' la domanda che non si legge dai tre conti:
     * quante ne sono arrivate oggi, e quante stanno li' da un mese senza che
     * nessuno le abbia piu' guardate. La seconda e' quella che pesa — un conto
     * fermo non si muove da solo, e in una colonna di numeri passerebbe
     * inosservato proprio perche' non cambia mai. */
    /* Cosa e' arrivato oggi, per genere. Sapere che ne sono arrivate due non
     * dice se la giornata e' andata storta o se qualcuno ha avuto due idee: un
     * difetto e un'idea chiedono cose diverse a chi legge.
     *
     * Il conto sta dopo il nome, come sui filtri del cruscotto, e non prima:
     * «1 difetti» sarebbe sbagliato in italiano e in mezza Europa, e mettere
     * il numero in coda toglie il problema invece di raddoppiare le stringhe
     * per il singolare. */
    const oggiPerTipo = conto.oggiPerTipo || {};
    const generi = [
      ["bug", "🐞", t("Difetti", "Bugs")],
      ["feature", "✨", t("Idee", "Ideas")],
      ["assistenza", "💬", t("Aiuto", "Help")],
      ["senza", "•", t("Senza tipo", "Untyped")],
    ].filter(([id]) => Number(oggiPerTipo[id]) > 0);
    const oggiMarkup = generi.length
      ? `<div class="dm-w-oggi"><span class="dm-w-oggi-lbl">${esc(t("Oggi", "Today"))}</span>${generi
          .map(
            ([id, icona, nome]) =>
              `<span class="dm-w-genere"><span aria-hidden="true">${icona}</span>${esc(
                nome,
              )}<b>${Number(oggiPerTipo[id])}</b></span>`,
          )
          .join("")}</div>`
      : `<p class="dm-w-lettura">${esc(t("Oggi non e' arrivato niente.", "Nothing came in today."))}</p>`;
    const ferme = conto.vecchie
      ? `<p class="dm-w-lettura">${esc(
          t(`${conto.vecchie} ferme da oltre un mese`, `${conto.vecchie} stuck for over a month`),
        )}</p>`
      : "";
    /* Chi ha scritto e nessuno ha ancora letto, in cima a tutto.
     *
     * E' l'unica riga di questa finestra che chiede qualcosa: i conti dicono
     * com'e' messa la coda, questa dice che c'e' una persona che aspetta una
     * risposta. Sta sopra apposta, ed e' la sola che porta i titoli — un
     * numero da solo direbbe «due» senza dire di cosa, e per decidere se
     * aprire il cruscotto adesso o dopo cena servono i titoli.
     *
     * Tre e non tutte: questa finestra e' larga un palmo, e una giornata
     * storta la riempirebbe di righe fino a nascondere i conti. Le altre si
     * contano in coda.
     *
     * Il conto e' di **conversazioni**, non di messaggi: chi guarda vuole
     * sapere quante porte ha da aprire. Quante frasi ci siano dietro lo dice
     * il filo, che e' il posto dove si leggono. */
    const conversazioni = Array.isArray(conto.conversazioni) ? conto.conversazioni : [];
    const MOSTRATE = 3;
    const chatMarkup = conversazioni.length
      ? `<div class="dm-w-chat">
          <div class="dm-w-chat-testa">
            <span aria-hidden="true">💬</span>
            <b>${esc(
              t(
                `${conversazioni.length} con messaggi nuovi`,
                `${conversazioni.length} with new messages`,
              ),
            )}</b>
          </div>
          ${conversazioni
            .slice(-MOSTRATE)
            .reverse()
            .map(
              (voce) => `
                <div class="dm-w-chat-riga">
                  <span class="dm-w-chat-tit">${esc(
                    clean(voce?.title) || `#${Number(voce?.number) || 0}`,
                  )}</span>
                  <span class="dm-w-chat-n">${
                    voce?.opened ? "✦" : Number(voce?.messages) || 1
                  }</span>
                </div>`,
            )
            .join("")}
          ${
            conversazioni.length > MOSTRATE
              ? `<div class="dm-w-chat-altre">${esc(
                  t(
                    `e altre ${conversazioni.length - MOSTRATE}`,
                    `and ${conversazioni.length - MOSTRATE} more`,
                  ),
                )}</div>`
              : ""
          }
        </div>`
      : "";
    const righe = [
      [t("Nuove", "New"), conto.nuove],
      [t("In lavorazione", "In progress"), conto.inLavorazione],
      [t("Chiuse", "Closed"), conto.chiuse],
    ];
    return `${chatMarkup}${oggiMarkup}${ferme}
      <div class="dm-w-caselle">${righe
        .map(
          ([nome, quante]) =>
            `<div class="dm-w-casella"><b>${Number(quante) || 0}</b><small>${esc(nome)}</small></div>`,
        )
        .join("")}</div>
      <button type="button" class="dm-w-porta" data-dm-apri-cruscotto>${esc(
        t("Apri il cruscotto", "Open the console"),
      )}</button>`;
  }
  const comandi = detailRows(widget, states);
  return `${verdettoEFrase(widget)}
    ${caselleDelleMisure(widget)}
    ${pilloleDelloStato(widget)}
    ${
      comandi
        ? `${(() => {
            const titolo = titoloDelBlocco(comandi, widget.key);
            return titolo ? `<h4 class="dm-w-titoletto">${esc(titolo)}</h4>` : "";
          })()}${comandi}`
        : ""
    }`;
}

/* Il titolo dice cosa c'e' sotto, e non sempre sono comandi.
 *
 * Nella finestra dell'Energia sotto «COMANDI» stavano Casa, Solare, Rete e
 * Batteria: quattro letture, che non si comandano — non c'e' niente da
 * premere. Lo stesso per Telecamere, Solare termico e Piscina. Un titolo che
 * annuncia comandi dove non ce ne sono manda a cercare un tasto che non
 * esiste. Si guarda cosa c'e' davvero nel blocco invece di deciderlo a
 * tavolino: se c'e' qualcosa da premere sono comandi, altrimenti sono letture.
 */
function titoloDelBlocco(markup, chiave = "") {
  /* L'Agenda non porta ne' comandi ne' letture, e non porta nemmeno un titolo:
   * i suoi due pezzi — «Impegni» e «Da fare» — si annunciano da soli, e una
   * riga «AGENDA» sopra due titoli sarebbe il nome della finestra scritto una
   * seconda volta. */
  if (chiave === "agenda") return "";
  const siPreme = /<(?:button|input|select)\b|role="switch"/.test(markup);
  return siPreme ? t("Comandi", "Controls") : t("Letture", "Readings");
}

function detailRows(widget, states) {
  if (widget.key === "agenda") return agendaDetail(widget, states);
  if (widget.key === "luci") return lightsDetail(widget);
  if (widget.key === "clima") return climateDetail(widget);
  if (widget.key === "tapparelle") return coversDetail(widget);
  if (widget.key === "sicurezza") return securityDetail(widget, states);
  if (widget.key === "telecamere") return camerasDetail(widget);
  if (eUnaTesseraEnergia(widget.key)) return energyDetail(widget);
  if (widget.key === "elettrodomestici") return appliancesDetail(widget);
  if (widget.key === "temperatura") return temperatureDetail(widget);
  if (
    [
      "ev",
      "solare",
      "scaldabagno",
      "caldaia",
      "ups",
      "piscina",
      "prese",
      "irrigazione",
      "robot",
    ].includes(widget.key)
  )
    return rowsDetail(widget);
  if (widget.key === "media") return mediaDetail(widget);
  if (widget.key === "batterie") return batteriesDetail(widget);
  if (widget.key === "allagamenti") return floodDetail(widget);
  if (widget.key.startsWith("custom-")) return customDetail(widget);
  return "";
}

/* La sezione a cui una tessera appartiene.
 *
 * La finestra dice quello che sta succedendo; quando non basta si va nella
 * sezione, che e' il posto dove quella roba si comanda per intero. Prima da li'
 * si usciva solo chiudendo e cercando la voce in basso.
 *
 * Le tessere che una sezione non ce l'hanno non stanno in questo elenco, e per
 * loro il tasto non c'e': batterie, allagamenti e cose da fare vivono soltanto
 * in Home, e un tasto che non porta da nessuna parte e' una promessa che
 * nessuno mantiene. Le telecamere portano a Sicurezza, che e' la sezione che
 * le contiene davvero. */
const SEZIONE_DEL_WIDGET = Object.freeze({
  luci: "luci",
  prese: "prese",
  clima: "clima",
  tapparelle: "tapparelle",
  sicurezza: "security",
  telecamere: "security",
  energia: "energy",
  elettrodomestici: "appliances-main",
  temperatura: "temp",
  ev: "ev",
  solare: "boiler",
  scaldabagno: "boiler",
  caldaia: "boiler",
  ups: "ups",
  agenda: "calendario",
  piscina: "piscina",
  irrigazione: "irrigazione",
  robot: "robot",
  minipc: "server",
  allerte: "allerte",
  rifiuti: "rifiuti",
  media: "media",
});

/* La voce della sezione, ma solo se ci si puo' davvero andare.
 *
 * Una sezione spenta in configurazione ha la sua voce nascosta — `cdApplyNavVis`
 * le scrive `display:none` addosso — e portarci sarebbe peggio che non
 * offrirlo: si aprirebbe una pagina che l'utente ha deciso di non avere. */
function voceDellaSezione(chiave) {
  /* Ogni tessera energia porta alla sezione, non solo la prima (#286). */
  const tab = SEZIONE_DEL_WIDGET[eUnaTesseraEnergia(chiave) ? "energia" : clean(chiave)];
  if (!tab) return null;
  const voce = doc?.querySelector?.(`.tab[data-tab="${tab}"]`);
  if (!voce || voce.style?.display === "none") return null;
  return voce;
}

/* Le briciole di questa sezione, in una riga sola. Le calcola un posto solo:
 * le scrive chi apre la finestra e le riscrive chi la aggiorna, e se i due non
 * dicono la stessa cosa il secondo cancella il primo. */
function bricioleDelWidget(widget) {
  return bricioleDellaSezione(widget.key, t).join(" · ") || clean(widget.caption);
}

function detailMarkup(widget, states) {
  const vaiAllaSezione = voceDellaSezione(widget.key)
    ? `<footer class="dm-w-piede">
        <button type="button" class="dm-w-vai" data-dm-w-sezione="${esc(widget.key)}"${
          widget.impianto ? ` data-dm-w-impianto="${esc(widget.impianto)}"` : ""
        }>
          ${esc(t("Apri sezione", "Open section"))} <span aria-hidden="true">→</span>
        </button>
      </footer>`
    : "";
  return `<article class="dm-widget-detail" data-dm-widget-detail="${widget.key}"
      style="--dm-widget-accent:${widget.accent}">
      <header class="dm-w-head">
        <button type="button" class="dm-w-close" data-dm-widget-close aria-label="${esc(t("Chiudi", "Close"))}"><span aria-hidden="true">✕</span> ${esc(t("Chiudi", "Close"))}</button>
        <span class="dm-w-head-ic" aria-hidden="true">${oggettoWidget(widget.key, widget.icon)}</span>
        <strong data-dm-titolo>${esc(widget.label)}</strong>
        <small data-dm-detail-caption>${esc(bricioleDelWidget(widget))}</small>
      </header>
      <div class="dm-w-body">${detailBody(widget, states)}</div>
      ${vaiAllaSezione}
    </article>`;
}

/* ── il travaso del corpo aperto ──────────────────────────────────────────
 *
 * La finestra aperta si aggiorna a ogni valore che cambia. Buttare via il
 * corpo e riscriverlo (innerHTML) ogni due secondi era il tremolio: lo
 * scorrimento tornava in cima, la corsa disegnata lampeggiava, un campo con
 * il fuoco lo perdeva. Se la forma non e' cambiata — stessi nodi, stessi
 * tag, nello stesso ordine — si travasano testi e attributi in quello che
 * c'e' gia': niente nodi nuovi, niente salti. */
function stessaOssatura(a, b) {
  if (a.childNodes.length !== b.childNodes.length) return false;
  for (let i = 0; i < a.childNodes.length; i++) {
    const mio = a.childNodes[i];
    const suo = b.childNodes[i];
    if (mio.nodeType !== suo.nodeType) return false;
    if (mio.nodeType === 1 && (mio.tagName !== suo.tagName || !stessaOssatura(mio, suo)))
      return false;
  }
  return true;
}

/* Quello che il travaso NON deve toccare.
 *
 * Il markup fresco delle telecamere nasce senza `src` — il fotogramma lo
 * scarica dopo qualcuno — e con `data-dm-camera-state="loading"`. Ricopiando
 * alla lettera, ogni travaso strappava il fotogramma gia' arrivato: riquadro
 * nero istantaneo, blob orfano in memoria e download da rifare. E il travaso
 * scatta a ogni cambio della frase in cima, cioe' di continuo: e' questa la
 * ragione del «widget telecamere lentissimo in apertura». Chi scarica se lo
 * tiene: il fotogramma e' roba viva, non markup. */
const ATTRIBUTI_VIVI = new Set([
  "src",
  "data-dm-camera-key",
  "data-dm-camera-entity",
  "data-dm-camera-state",
]);

function ricopia(mio, suo) {
  if (mio.nodeType === 3) {
    if (mio.nodeValue !== suo.nodeValue) mio.nodeValue = suo.nodeValue;
    return;
  }
  if (mio.nodeType !== 1) return;
  const vivo = mio.tagName === "IMG" || mio.hasAttribute?.("data-dm-camera-key");
  for (const attributo of [...mio.attributes]) {
    if (vivo && ATTRIBUTI_VIVI.has(attributo.name)) continue;
    if (!suo.hasAttribute(attributo.name)) mio.removeAttribute(attributo.name);
  }
  for (const attributo of [...suo.attributes]) {
    if (vivo && ATTRIBUTI_VIVI.has(attributo.name) && mio.hasAttribute(attributo.name)) continue;
    if (mio.getAttribute(attributo.name) !== attributo.value)
      mio.setAttribute(attributo.name, attributo.value);
  }
  for (let i = 0; i < mio.childNodes.length; i++) ricopia(mio.childNodes[i], suo.childNodes[i]);
}

function travasaCorpo(body, markup) {
  const stampo = doc.createElement("template");
  stampo.innerHTML = markup;
  if (stessaOssatura(body, stampo.content)) {
    for (let i = 0; i < body.childNodes.length; i++)
      ricopia(body.childNodes[i], stampo.content.childNodes[i]);
    return;
  }
  /* Forma nuova: si riscrive, ma senza perdere il punto di lettura. */
  const scorrimento = body.scrollTop;
  body.innerHTML = markup;
  body.scrollTop = scorrimento;
}

/* ── rendering ────────────────────────────────────────────────────────── */

function ensureHost() {
  const page = doc?.getElementById?.("page-home");
  if (!page) return null;
  let host = doc.getElementById("dm-widgets");
  if (host) return host;
  host = doc.createElement("section");
  host.id = "dm-widgets";
  /* Il titolo e' un titolo di sezione, come «Azioni rapide» e come
   * «Persone»: sulla Home i blocchi si annunciano tutti allo stesso modo, e
   * una fascia con l'alone di colore in mezzo agli altri due faceva sembrare
   * i Widget un'altra cosa. Sotto, la riga che dice come sta la casa. */
  host.innerHTML = `<h3 class="section-title dm-widgets-title"></h3>
    <p class="dm-widgets-sub"></p>
    <div class="dm-widgets-grid"></div>`;
  // Sotto le persone di casa quando ci sono, altrimenti sotto le pastiglie:
  // sempre prima del Quadro Avvisi.
  const people = doc.getElementById("dm-people");
  const pills = doc.getElementById("dashboard-pills-row");
  if (people?.parentElement === page) people.after(host);
  else if (pills?.parentElement === page) pills.after(host);
  else page.prepend(host);
  return host;
}

/* La struttura e' QUALI tessere ci sono. Nient'altro.
 *
 * Ci stava dentro anche il fatto che una tessera avesse o no la barra, e la
 * barra dipende da un valore: un sensore che per un giro dice «non
 * disponibile» faceva sparire la barra, cambiare la firma, e riscrivere in
 * blocco tutte le tessere della Home. Da fuori si vede un tremolio, e
 * capitava a ogni evento di stato che passasse di li'.
 *
 * E ci stava dentro anche QUALE tessera fosse aperta — un resto dell'epoca in
 * cui il dettaglio era una tendina dentro la griglia. Ma il dettaglio vive nel
 * popup: aprire e chiudere cambiava la firma, e la firma rifaceva tutte le
 * tessere con la finestra che stava ancora salendo. Sul telefono si vede la
 * Home svuotarsi e ridisegnarsi a ogni tocco — «trema tutto» — due volte per
 * popup, all'andata e al ritorno. L'evidenza della tessera aperta e' un
 * valore, e si scrive addosso alla tessera come tutti gli altri valori. */
function structureSignature(models) {
  return models.map((widget) => widget.key).join("|");
}

export function renderHomeWidgets() {
  const states = allStates();
  const models = widgetModels(states);
  const host = doc?.getElementById?.("dm-widgets");
  if (!models.length) {
    host?.remove();
    state.signature = "";
    /* Il popup del dettaglio sta attaccato al corpo della pagina, non alle
     * tessere: togliendo le tessere — l'ultima telecamera cancellata, una
     * configurazione azzerata — restava li' aperto sopra una Home vuota, coi
     * comandi di una cosa che non esiste piu', e lo scorrimento della pagina
     * bloccato da lui. Se ne va con quello che raccontava. */
    if (state.expanded || doc?.documentElement?.classList?.contains("dm-widget-popup-open"))
      chiudiPopup();
    else fermaTimerTelecamere();
    return false;
  }
  const mounted = host || ensureHost();
  if (!mounted) return false;
  /* La modalita' compatta (#224) e' un attributo sull'ospite, e il resto lo fa
   * il foglio: «sempre» stringe subito, «auto» stringe solo sotto i 520 pixel
   * grazie alla media query, «mai» non lascia traccia. */
  const compatto = widgetPreferences().compatto;
  if (compatto === "mai") mounted.removeAttribute?.("data-dm-compatto");
  else if (mounted.getAttribute?.("data-dm-compatto") !== compatto)
    mounted.setAttribute?.("data-dm-compatto", compatto);
  const title = mounted.querySelector(".dm-widgets-title");
  if (title) title.textContent = t("Widget", "Widgets");
  /* La riga sotto il titolo diceva come si usa una tessera. Lo si capisce da
   * solo la prima volta, e da li' in poi e' una riga sprecata in cima alla
   * Home: adesso dice quante sezioni ci sono e quante chiedono attenzione,
   * che e' la sola cosa che si vuole sapere senza aprire niente. */
  const sub = mounted.querySelector(".dm-widgets-sub");
  if (sub) {
    const quante = models.length;
    const avvisi = models.filter((widget) => widget.alert).length;
    const sezioni =
      quante === 1 ? t("1 sezione", "1 section") : t(`${quante} sezioni`, `${quante} sections`);
    /* Non basta dire QUANTE chiedono attenzione: bisogna dire QUALI.
     *
     * «2 chiedono attenzione» sopra otto tessere obbliga a guardarle tutte per
     * scoprire chi sono, che e' esattamente il lavoro che una riga di
     * riepilogo dovrebbe risparmiare. I nomi in larghezza ci stanno di rado, e
     * allora la riga scorre: la stessa andatura delle didascalie delle
     * tessere, e solo quando serve davvero. */
    const nomi = models
      .filter((widget) => widget.alert)
      .map((widget) => widget.label)
      .join(", ");
    const attenzione = avvisi
      ? avvisi === 1
        ? `${t("1 chiede attenzione", "1 needs attention")}: ${nomi}`
        : `${t(`${avvisi} chiedono attenzione`, `${avvisi} need attention`)}: ${nomi}`
      : t("tutto tranquillo", "all quiet");
    const testo = `${sezioni} · ${attenzione}`;
    /* Si rimisura anche a parole ferme.
     *
     * La decisione «ci sta o non ci sta» dipende dalla larghezza, non solo dal
     * testo: girando il telefono, o entrando in schermo diviso, una riga che
     * prima ci stava viene tagliata e una che scorreva continua a scorrere di
     * una distanza che non esiste piu'. Misurare costa un conto
     * d'impaginazione, quindi lo si fa solo quando la larghezza e' cambiata
     * davvero. */
    const cambiatoTesto = sub.textContent !== testo;
    if (cambiatoTesto) sub.textContent = testo;
    const larghezza = Math.round(sub.clientWidth);
    if (cambiatoTesto || sub.dataset.dmLarghezza !== String(larghezza)) {
      sub.dataset.dmLarghezza = String(larghezza);
      scorriUnaRiga(sub);
    }
    const stato = avvisi ? "avviso" : "quiete";
    if (mounted.dataset.dmMood !== stato) mounted.dataset.dmMood = stato;
  }

  if (state.expanded && !models.some((widget) => widget.key === state.expanded))
    state.expanded = "";
  const grid = mounted.querySelector(".dm-widgets-grid");
  if (!grid) return false;

  const signature = structureSignature(models);
  /* Si misura il testo solo se qualcosa e' cambiato davvero.
   *
   * `scorriDidascalie` legge `scrollWidth`, e leggerlo obbliga il browser a
   * rifare i conti dell'impaginazione: farlo a ogni evento di stato — che in
   * una casa vera vuol dire piu' volte al secondo — e' esattamente la Home che
   * «si riaggiorna» sotto le dita. */
  let cambiato = false;
  if (state.signature !== signature || !grid.firstElementChild) {
    state.signature = signature;
    /* Prima si disegna, poi si segna.
     *
     * Il segno «gia' vista» serve a non far rientrare in scena una tessera che
     * c'era gia'. Ma si metteva PRIMA di stampare il markup, e `tileMarkup` lo
     * legge: ogni tessera nasceva marcata, compresa quella appena arrivata.
     * L'ingresso non partiva mai per nessuno — l'animazione c'era, scritta e
     * mantenuta, e non si e' mai vista.
     *
     * L'ordine giusto e' quello del racconto: si stampa leggendo chi c'era
     * prima, e solo dopo si prende nota di chi c'e' adesso. */
    grid.innerHTML = models.map((widget, index) => tileMarkup(widget, index)).join("");
    for (const widget of models) viste().add(widget.key);
    cambiato = true;
    /* Le tessere sono nuove: chi le decora deve saperlo.
     *
     * Il movimento dell'avviso — la porta che si apre, la goccia che cade —
     * lo disegna un altro modulo, che si sveglia sugli eventi di stato. Se le
     * tessere nascono DOPO l'ultima passata di quel modulo, restano ferme
     * finche' non capita un altro evento: per un avviso appena scattato puo'
     * volerci parecchio. Cosi' invece si annuncia, e chi ascolta ripassa. */
    /* I nomi vanno fatti entrare adesso, che le tessere hanno la loro
     * larghezza: prima non c'era niente da misurare. */
    sistemaLeScritte(grid);
    try {
      root.dispatchEvent?.(new CustomEvent("dashboardmodern:widgets-painted"));
    } catch (_errore) {}
  } else {
    // Solo i valori: la tessera resta dov'e', l'apertura non riparte.
    for (const widget of models) {
      const tile = grid.querySelector(`[data-dm-widget="${CSS.escape(widget.key)}"]`);
      if (!tile) continue;
      tile.style.setProperty("--dm-widget-accent", widget.accent);
      const value = tile.querySelector("[data-dm-tile-value]");
      const unita = tile.querySelector("[data-dm-tile-unit]");
      const pezzi = dividiValore(widget.value);
      if (value && scriviNumero(value, pezzi.numero, misuraValore(widget.value))) cambiato = true;
      if (unita && unita.textContent !== pezzi.unita) {
        unita.textContent = pezzi.unita;
        unita.dataset.simbolo = String(unitaSimbolo(pezzi.unita));
        cambiato = true;
      }
      const accesa = String(tesseraAccesa(widget));
      if (tile.dataset.acceso !== accesa) {
        tile.dataset.acceso = accesa;
        cambiato = true;
      }
      // L'apertura non e' struttura: si scrive qui, e la tessera resta lei.
      const aperta = String(state.expanded === widget.key);
      if (tile.dataset.open !== aperta) tile.dataset.open = aperta;
      const caption = tile.querySelector("[data-dm-tile-caption]");
      if (caption && caption.textContent !== widget.caption) {
        caption.textContent = widget.caption;
        cambiato = true;
      }
      /* L'avviso non fa piu' parte della struttura: si accende qui, come tutto
       * il resto che cambia da un momento all'altro.
       *
       * E chi decora la pastiglia col movimento dell'avviso — la porta che si
       * apre, la goccia che cade — va avvisato che deve riguardare: si tiene
       * un segno di cosa ha gia' disegnato, e finche' quel segno resta crede
       * che non ci sia niente da rifare. Prima la tessera veniva riscritta da
       * capo a ogni avviso che si accendeva, e il segno spariva col nodo
       * vecchio; adesso il nodo resta, quindi il segno lo si toglie qui. */
      const avviso = String(Boolean(widget.alert));
      if (tile.dataset.alert !== avviso) {
        const siAccende = avviso === "true";
        tile.dataset.alert = avviso;
        const pastiglia = tile.querySelector(".dm-tile-chip");
        if (pastiglia) delete pastiglia.dataset.dmAlertMotion;
        /* Il momento in cui una tessera si accende e' l'unico in cui la
         * plancia alza la voce: la lama di luce la attraversa una volta sola
         * e la pastiglia sboccia. Poi torna tutto fermo. */
        if (siAccende && pastiglia) {
          tile.dataset.dmAccende = "1";
          pastiglia.dataset.dmSboccia = "1";
          root.setTimeout?.(() => {
            delete tile.dataset.dmAccende;
            delete pastiglia.dataset.dmSboccia;
          }, 900);
        }
      }
      const misura = tile.querySelector("[data-dm-misura]");
      const firma = firmaMisura(widget);
      if (misura && misura.dataset.dmMisura !== firma) {
        aggiornaMisura(misura, widget, firma);
        misura.dataset.dmMisura = firma;
      }
      if (state.expanded === widget.key) {
        /* Sotto il titolo ci vanno le briciole della sezione, non la didascalia
         * della mattonella: sono due cose diverse, e qui si rimetteva la
         * seconda al primo cambio di stato — cioe' quasi subito, su una casa
         * viva. Le briciole si calcolano come all'apertura. */
        const captionDetail = doc.querySelector("#dm-widget-popup [data-dm-detail-caption]");
        const briciole = bricioleDelWidget(widget);
        if (captionDetail && captionDetail.textContent !== briciole)
          captionDetail.textContent = briciole;
        const body = doc.querySelector("#dm-widget-popup .dm-w-body");
        const markup = detailBody(widget, states);
        const scritto = state.corpo.chiave === widget.key && state.corpo.markup === markup;
        if (body && !scritto) {
          /* Il corpo si aggiorna a ogni valore che cambia — cioe' ogni due
           * secondi su una casa viva. Riscriverlo con innerHTML era il
           * tremolio ricomparso: lo scorrimento tornava in cima, la corsa
           * lampeggiava, il dito perdeva quello che stava toccando. Quando
           * l'ossatura e' la stessa si travasano solo testi e attributi nei
           * nodi che ci sono gia'; la riscrittura intera resta per quando
           * cambia la forma, e almeno tiene il punto di scorrimento. */
          const primoDisegno = body.dataset.dmPainted !== "true";
          travasaCorpo(body, markup);
          state.corpo = { chiave: widget.key, markup };
          body.dataset.dmPainted = "true";
          body.dataset.dmFresh = primoDisegno ? "true" : "false";
        }
      }
    }
  }

  if (cambiato) scorriDidascalie(grid);
  sincronizzaPopup(models, states);

  for (const list of configuredTodoLists()) fetchItems(list.entity);
  aggiornaCalendari();
  // La tessera delle telecamere appena disegnata (o ridisegnata) chiede i suoi
  // fotogrammi; chiusa, restituisce timer e object URL.
  if (state.expanded === "telecamere") aggiornaTelecamere();
  else fermaTimerTelecamere();
  return true;
}

/* Il dettaglio e' un popup, non una tendina.
 *
 * «Anziche' aprire tendina sui widget non e' piu' bello un popup stilizzato
 * fatto bene»: la tendina spingeva giu' mezza Home a ogni tocco e la tessera
 * aperta finiva sotto il pollice. Adesso la tessera resta al suo posto e il
 * dettaglio sale al centro, con lo sfondo sfocato — la stessa lingua degli
 * altri popup della plancia. Si chiude col tasto, toccando fuori, o con Esc. */
function popupHost() {
  let host = doc?.getElementById?.("dm-widget-popup");
  if (host) return host;
  if (!doc?.body) return null;
  host = doc.createElement("div");
  host.id = "dm-widget-popup";
  host.hidden = true;
  host.addEventListener("click", (event) => {
    if (event.target === host || event.target?.closest?.("[data-dm-widget-close]")) chiudiPopup();
  });
  doc.body.append(host);
  return host;
}

/* «Apri il cruscotto» sta dentro la finestra di questa tessera, e quella
 * finestra va chiusa prima che l'altra si apra. Le due stanno sullo stesso
 * piano — `z-index: 9999` tutte e due — e la piu' giovane copre l'altra: il
 * tasto sembrava non fare niente, perche' il cruscotto si apriva dietro.
 *
 * Chiude chi possiede: la sezione delle segnalazioni apre la propria finestra,
 * questo file chiude la propria. Toccare il DOM altrui — o importarsi a
 * vicenda, visto che e' questo file a importare quello — sarebbe la strada per
 * romperle tutte e due insieme. */
function ascoltaLaPorta() {
  doc?.addEventListener?.("click", (event) => {
    if (event.target?.closest?.("[data-dm-apri-cruscotto],[data-dm-apri-chat]")) chiudiPopup();
  });
}

/* ── dietro il velo non si muove niente ───────────────────────────────────
 *
 * Con la finestra aperta restavano vive nove animazioni infinite sotto il
 * velo: le due macchie del fondale, il puntino del «vivo», la fiamma e il
 * battito della caldaia, il respiro di due tessere, due avvisi. Nessuna di
 * quelle si vede — sono coperte — e ognuna, a ogni suo fotogramma, obbliga a
 * rifare la sfocatura di tutto lo schermo. Sessanta volte al secondo, per
 * guardare una finestra ferma: e' il lavoro che sul telefono fa saltare i
 * fotogrammi, ed e' meta' del tremolio.
 *
 * Si fermano dove sono e ripartono da li' alla chiusura: in pausa, non spente.
 *
 * Si fa da qui e non con una riga di foglio di stile perche' quelle animazioni
 * sono dichiarate `!important` da chi le possiede, e vincerla a colpi di
 * specificita' vorrebbe dire una guerra che si riapre a ogni sezione nuova.
 * Le transizioni si lasciano correre: durano un attimo e finiscono da sole.
 */

/* L'ingresso di una tessera NON si ferma (#304): parte dall'opacita' zero, e
 * fermo a meta' lasciava una tessera invisibile finche' qualcuno non la
 * toccava — «le icone spariscono e riappaiono se ci clicco sopra». Dura un
 * attimo e non costa niente: si lascia finire. Le altre si fermano, ma al
 * loro fotogramma di riposo (vedi `fermaCioCheStaDietro`). */
export const NON_SI_FERMANO = /^dmTileIn/;

/** Quali animazioni vanno fermate: quelle vive, con un nome, e fuori. */
export function animazioniDaFermare(animazioni, dentro) {
  return [...(animazioni || [])].filter((anim) => {
    if (!anim || anim.playState !== "running" || !anim.animationName) return false;
    if (NON_SI_FERMANO.test(anim.animationName)) return false;
    const bersaglio = anim.effect?.target;
    return Boolean(bersaglio) && !dentro(bersaglio);
  });
}

function fermaCioCheStaDietro(host) {
  if (!host || typeof doc?.getAnimations !== "function") return 0;
  const ferme = animazioniDaFermare(doc.getAnimations(), (nodo) => host.contains(nodo));
  for (const anim of ferme) {
    try {
      /* Al fotogramma zero, non a meta': il battito di un avviso passa
       * dall'opacita' .18, e fermo li' e' un'icona sparita (#304). Il
       * fotogramma zero e' la posa di riposo di ogni ciclo. */
      anim.currentTime = 0;
      anim.pause();
      state.ferme.push(anim);
    } catch (_error) {}
  }
  return ferme.length;
}

function riparteCioCheStaDietro() {
  for (const anim of state.ferme) {
    try {
      anim.play();
    } catch (_error) {}
  }
  state.ferme = [];
}

function chiudiPopup() {
  state.expanded = "";
  state.corpo = { chiave: "", markup: "" };
  const host = doc?.getElementById?.("dm-widget-popup");
  if (host) {
    host.hidden = true;
    host.replaceChildren();
  }
  doc?.documentElement?.classList?.remove("dm-widget-popup-open");
  riparteCioCheStaDietro();
  fermaTimerTelecamere();
  schedule();
}

function sincronizzaPopup(models, states) {
  const aperto = models.find((widget) => widget.key === state.expanded);
  const host = popupHost();
  if (!host) return false;
  if (!aperto) {
    if (!host.hidden) {
      host.hidden = true;
      host.replaceChildren();
      state.corpo = { chiave: "", markup: "" };
      doc?.documentElement?.classList?.remove("dm-widget-popup-open");
      riparteCioCheStaDietro();
    }
    return false;
  }
  /* Il segno di chi sta raccontando NON si chiama come quello delle tessere.
   *
   * Si chiamava `data-dm-widget`, lo stesso nome che porta ogni tessera della
   * griglia, e in fondo a chi ascolta i tocchi c'e' la riga che dice: se sotto
   * il dito c'e' un `[data-dm-widget]`, apri o chiudi quella tessera. Dentro
   * la finestra aperta quel nome lo portava la finestra stessa: qualunque
   * tocco che non fosse gia' stato preso da un comando — la casella della
   * lista, il tasto piu', una riga qualsiasi — risaliva fino a lei e la
   * chiudeva. Nelle prove non si vedeva perche' toccavano coi comandi, e i
   * comandi tornano indietro prima. */
  if (host.dataset.dmPopupOf !== aperto.key || host.hidden) {
    host.dataset.dmPopupOf = aperto.key;
    host.hidden = false;
    host.innerHTML = detailMarkup(aperto, states);
    /* Il titolo della finestra si fa misurare adesso che ha una larghezza:
     * «Elettrodomestici» a corpo pieno finiva sotto il tasto di chiusura. */
    sistemaLeScritte(host);
    /* La finestra e' nata adesso: quello che c'e' dentro e' quello che si e'
     * appena scritto, e da qui riparte il confronto. */
    state.corpo = { chiave: aperto.key, markup: detailBody(aperto, states) };
    doc?.documentElement?.classList?.add("dm-widget-popup-open");
    const body = host.querySelector(".dm-w-body");
    if (body) {
      body.dataset.dmPainted = "true";
      body.dataset.dmFresh = "true";
    }
  }
  /* A ogni giro, non solo all'apertura: un avviso che si accende mentre la
   * finestra e' aperta comincia a battere adesso, e nessuno l'aveva fermato. */
  fermaCioCheStaDietro(host);
  return true;
}

/* Il testo che non ci sta scorre, invece di finire in tre puntini.
 *
 * Si misura dopo il disegno: se il nastro e' piu' largo della finestra, va
 * avanti e indietro piano — la distanza da percorrere e la durata sono quelle
 * del testo, cosi' due parole scorrono in fretta e una fila di nomi con
 * calma. Chi ci sta resta fermo: niente da leggere in movimento senza
 * motivo. */
/* Una riga sola che scorre, quando non ci sta.
 *
 * Il nastro delle tessere misura il figlio dentro il padre; qui il testo sta
 * gia' nell'elemento, quindi lo si avvolge una volta sola e da li' in poi si
 * rimisura quello. Se ci sta, non si muove niente: una riga che scorre senza
 * bisogno e' solo una riga che non si riesce a leggere. */
function scorriUnaRiga(riga) {
  if (!riga) return false;
  let nastro = riga.querySelector(":scope > .dm-sub-scroll");
  if (!nastro) {
    const testo = riga.textContent;
    riga.textContent = "";
    nastro = doc.createElement("span");
    nastro.className = "dm-sub-scroll";
    nastro.textContent = testo;
    riga.append(nastro);
  }
  const eccesso = nastro.scrollWidth - riga.clientWidth;
  if (eccesso > 4) {
    nastro.dataset.dmScroll = "true";
    nastro.style.setProperty("--dm-scroll-x", `${-eccesso - 2}px`);
    nastro.style.setProperty("--dm-scroll-dur", `${Math.min(22, Math.max(7, eccesso / 11))}s`);
    return true;
  }
  delete nastro.dataset.dmScroll;
  nastro.style.removeProperty("--dm-scroll-x");
  nastro.style.removeProperty("--dm-scroll-dur");
  return false;
}

/* Se le didascalie adesso sono nascoste dalla compatta: con «sempre» lo sono
 * per forza, con «auto» solo quando la media query del foglio e' vera — e
 * `matchMedia` risponde alla stessa domanda della stessa query. */
function didascalieNascoste() {
  const modo = clean(doc?.getElementById?.("dm-widgets")?.getAttribute?.("data-dm-compatto"));
  if (modo === "sempre") return true;
  if (modo === "auto") return Boolean(root.matchMedia?.("(max-width: 520px)")?.matches);
  return false;
}

function scorriDidascalie(grid) {
  if (!grid?.querySelectorAll) return 0;
  /* Con le tessere compatte le didascalie non si vedono: misurarle lo stesso
   * sarebbe un reflow a vuoto a ogni giro di valori, su un telefono che e'
   * proprio il posto dove la compatta scatta. */
  if (didascalieNascoste()) return 0;
  let mossi = 0;
  for (const nastro of grid.querySelectorAll("[data-dm-tile-caption]")) {
    const finestra = nastro.parentElement;
    if (!finestra) continue;
    const eccesso = nastro.scrollWidth - finestra.clientWidth;
    if (eccesso > 4) {
      nastro.dataset.dmScroll = "true";
      nastro.style.setProperty("--dm-scroll-x", `${-eccesso - 2}px`);
      nastro.style.setProperty("--dm-scroll-dur", `${Math.min(18, Math.max(6, eccesso / 12))}s`);
      mossi += 1;
    } else if (nastro.dataset.dmScroll) {
      delete nastro.dataset.dmScroll;
      nastro.style.removeProperty("--dm-scroll-x");
      nastro.style.removeProperty("--dm-scroll-dur");
    }
  }
  return mossi;
}

function schedule() {
  if (state.frame) return;
  const run = () => {
    state.frame = 0;
    try {
      renderHomeWidgets();
    } catch (error) {
      root.console?.warn?.("[DashboardModern] home widgets", error);
    }
  };
  state.frame = root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 0) || 0;
}

/* ── le miniature delle telecamere ────────────────────────────────────── */

/* Un fotogramma e' un'immagine ferma chiesta di nuovo: niente in Home
 * Assistant la spinge. Dieci secondi, e SOLO mentre la tessera e' aperta
 * sulla Home di uno schermo visibile: chiusa la tessera, il timer muore e gli
 * object URL vengono restituiti. La stessa disciplina del muro della
 * Sicurezza, che di secondi ne usa quattro perche' li' le telecamere sono la
 * pagina intera. */
const CAMERA_WIDGET_REFRESH_MS = 10000;

function homeVisible() {
  return Boolean(doc?.getElementById?.("page-home")?.classList?.contains("active"));
}

function cameraWidgetOnScreen() {
  return state.expanded === "telecamere" && homeVisible() && doc?.visibilityState !== "hidden";
}

function fermaTimerTelecamere() {
  if (state.cameraTimer) {
    root.clearInterval?.(state.cameraTimer);
    state.cameraTimer = 0;
  }
  for (const url of state.cameraUrls.values()) {
    if (typeof url === "string" && url.startsWith("blob:")) {
      try {
        root.URL?.revokeObjectURL?.(url);
      } catch (_error) {}
    }
  }
  state.cameraUrls.clear();
}

async function aggiornaTelecamere() {
  if (!cameraWidgetOnScreen()) {
    fermaTimerTelecamere();
    return false;
  }
  /* Le miniature vivono dove vive il dettaglio, e il dettaglio si e' spostato
   * nel popup: cercarle solo sotto le tessere voleva dire non trovarne
   * nessuna, e un timer che si sveglia ogni tanto per non fare niente mentre
   * le telecamere restano nere. Si guarda in tutti e due i posti. */
  const figures =
    doc?.querySelectorAll?.("#dm-widgets [data-dm-w-cam],#dm-widget-popup [data-dm-w-cam]") || [];
  /* Due alla volta, non tutte insieme.
   *
   * Ogni miniatura e' uno snapshot che Home Assistant deve tirare fuori dallo
   * stream: con sei telecamere partivano sei richieste in un colpo, sei
   * flussi RTSP aperti insieme, e la finestra restava nera finche' l'ultima
   * non rispondeva. A due per volta la prima immagine arriva subito e le
   * altre la seguono — la stessa attesa totale, ma vista riempirsi. */
  const coda = [...figures];
  const IN_VOLO = 2;
  const tira = async () => {
    while (coda.length) {
      const figure = coda.shift();
      if (!figure) return;
      await loadCameraFrame(
        { entity: clean(figure.dataset.dmWCam) },
        figure.querySelector("img"),
        state.cameraUrls,
      );
    }
  };
  await Promise.all(Array.from({ length: Math.min(IN_VOLO, coda.length) }, tira));
  sincronizzaTimerTelecamere();
  return true;
}

function sincronizzaTimerTelecamere() {
  if (!cameraWidgetOnScreen()) {
    fermaTimerTelecamere();
    return false;
  }
  if (state.cameraTimer) return true;
  state.cameraTimer =
    root.setInterval?.(() => {
      if (!cameraWidgetOnScreen()) {
        fermaTimerTelecamere();
        return;
      }
      aggiornaTelecamere();
    }, CAMERA_WIDGET_REFRESH_MS) || 0;
  return Boolean(state.cameraTimer);
}

/* ── interazione ──────────────────────────────────────────────────────── */

function toggleExpand(key) {
  const prossimo = state.expanded === key ? "" : clean(key);
  state.expanded = prossimo;
  /* La griglia non cambia: il dettaglio vive nel popup. Azzerare la firma
   * rifarebbe tutte le tessere — e sarebbe il tremolio di prima. */
  schedule();
}

/* Esc chiude, come ogni altro popup della plancia. */
function bindEscape() {
  if (state.escape) return;
  state.escape = true;
  doc?.addEventListener?.("keydown", (event) => {
    if (event.key === "Escape" && state.expanded) chiudiPopup();
  });
}

/* La posizione scelta parte subito, e la tendina torna alla sua freccia: e'
 * un comando, non lo specchio di dov'e' la tapparella. */
function onChange(event) {
  const position = event.target?.closest?.("[data-dm-w-position]");
  if (!position) return;
  const scelta = clean(position.value);
  position.value = "";
  if (scelta === "") return;
  /* La tendina parla il verso della plancia (100 = aperta); alla tapparella
   * girata (#244) si scrive tradotto, con la stessa traduzione della
   * lettura. */
  callHa("cover", "set_cover_position", {
    entity_id: clean(position.dataset.dmWPosition),
    position: posizioneSecondoVerso(
      Math.round(Number(scelta) || 0),
      position.dataset.dmWVerso === "1",
    ),
  });
}

/* La lista di quel riferimento, presa dalla configurazione. */
function listaTodo(id) {
  return configuredTodoLists().find((value) => value.id === clean(id)) || null;
}

/* Quello che si sta scrivendo si ricorda qui, non nel documento: il corpo
 * della finestra si riscrive da solo a ogni valore che cambia. */
function onInput(event) {
  const casella = event.target?.closest?.("[data-dm-todo-new]");
  if (!casella) return;
  const id = clean(casella.dataset.dmTodoNew);
  if (casella.value) state.bozze.set(id, casella.value);
  else state.bozze.delete(id);
}

/* Invio aggiunge, come in ogni casella in cui si scrive una riga. */
function onKeydown(event) {
  if (event.key !== "Enter") return;
  const casella = event.target?.closest?.("[data-dm-todo-new]");
  if (!casella) return;
  event.preventDefault();
  const lista = listaTodo(casella.dataset.dmTodoNew);
  if (lista) addItem(lista, casella.value);
}

function onClick(event) {
  const aggiungi = event.target?.closest?.("[data-dm-todo-add]");
  if (aggiungi) {
    event.preventDefault();
    const id = clean(aggiungi.dataset.dmTodoAdd);
    const lista = listaTodo(id);
    const casella = aggiungi.parentElement?.querySelector?.("[data-dm-todo-new]");
    if (lista) addItem(lista, casella?.value || state.bozze.get(id) || "");
    return;
  }
  const cestino = event.target?.closest?.("[data-dm-todo-del]");
  if (cestino) {
    event.preventDefault();
    const lista = listaTodo(cestino.dataset.dmTodoList);
    if (lista)
      removeItem(lista, clean(cestino.dataset.dmTodoUid), clean(cestino.dataset.dmTodoSummary));
    return;
  }
  const check = event.target?.closest?.("[data-dm-todo-check]");
  if (check && !check.disabled) {
    event.preventDefault();
    const list = configuredTodoLists().find(
      (value) => value.id === clean(check.dataset.dmTodoList),
    );
    if (list)
      completeItem(list, clean(check.dataset.dmTodoUid), clean(check.dataset.dmTodoSummary));
    return;
  }
  /* «Apri sezione»: si chiude la finestra e si preme la voce in basso.
   *
   * L'ordine non e' un dettaglio. Finche' la finestra e' aperta il documento
   * porta `dm-widget-popup-open`, che gli blocca lo scorrimento: premere la
   * voce prima di chiudere lascerebbe la sezione nuova ferma a meta' pagina.
   * E si preme la voce vera invece di accendere la pagina a mano, perche' e'
   * il gesto che il guscio conosce — e per le pagine nate da un modulo, che
   * hanno un ascolto tutto loro, e' l'unico che funziona. */
  const sezione = event.target?.closest?.("[data-dm-w-sezione]");
  if (sezione) {
    event.preventDefault();
    const voce = voceDellaSezione(sezione.dataset.dmWSezione);
    /* La tessera di un impianto apre la sezione SU quell'impianto: chi tiene
     * le linguette lo sceglie come se fosse stata premuta la sua (#286). */
    const impianto = clean(sezione.dataset.dmWImpianto);
    if (impianto)
      root.dispatchEvent?.(
        new CustomEvent("dashboardmodern:energy-plant-requested", { detail: { plant: impianto } }),
      );
    chiudiPopup();
    voce?.click();
    return;
  }
  const light = event.target?.closest?.("[data-dm-w-light]");
  if (light) {
    event.preventDefault();
    const entity = clean(light.dataset.dmWLight);
    /* L'ultimo cancello: un interruttore rimasto da un disegno di prima non
     * deve poter comandare una cosa protetta. */
    if (!siComanda(entity)) return;
    // Ottimista: l'interruttore scatta subito, lo stato vero arriva col
    // prossimo evento e conferma o corregge.
    light.dataset.on = String(light.dataset.on !== "true");
    callHa(entity.split(".")[0] || "light", "toggle", { entity_id: entity });
    return;
  }
  /* La rotella apre e chiude il pannello della riga. Non passa da un
   * ridisegno: si tocca il documento e si segna la scelta, cosi' l'apertura e'
   * immediata e il prossimo ridisegno la ritrova. */
  const rotella = event.target?.closest?.("[data-dm-w-more]");
  if (rotella) {
    event.preventDefault();
    const entity = clean(rotella.dataset.dmWMore);
    const pannello = doc?.querySelector?.(
      `[data-dm-w-panel="${entity.replace(/["\\]/g, "\\$&")}"]`,
    );
    const apri = !state.aperti.has(entity);
    if (apri) state.aperti.add(entity);
    else state.aperti.delete(entity);
    if (pannello) pannello.hidden = !apri;
    rotella.setAttribute("aria-expanded", String(apri));
    rotella.closest(".dm-w-row")?.setAttribute("data-dm-w-open", String(apri));
    return;
  }
  const modo = event.target?.closest?.("[data-dm-w-mode]");
  if (modo) {
    event.preventDefault();
    callHa("climate", "set_hvac_mode", {
      entity_id: clean(modo.dataset.dmWTarget),
      hvac_mode: clean(modo.dataset.dmWMode),
    });
    root.setTimeout?.(schedule, 500);
    return;
  }
  const ventola = event.target?.closest?.("[data-dm-w-fan]");
  if (ventola) {
    event.preventDefault();
    callHa("climate", "set_fan_mode", {
      entity_id: clean(ventola.dataset.dmWTarget),
      fan_mode: clean(ventola.dataset.dmWFan),
    });
    root.setTimeout?.(schedule, 500);
    return;
  }
  const gradi = event.target?.closest?.("[data-dm-w-temp]");
  if (gradi) {
    event.preventDefault();
    const entity = clean(gradi.dataset.dmWTarget);
    const riga = climateRow(entity);
    if (riga && riga.target != null) {
      const passo = (Number(gradi.dataset.dmWTemp) || 0) * (riga.passo || 0.5);
      const voluta = Math.min(riga.massima, Math.max(riga.minima, riga.target + passo));
      /* Il numero si aggiorna subito sotto il dito: la conferma vera arriva
       * col prossimo giro di stati. */
      const casella = gradi.parentElement?.querySelector?.("b");
      if (casella) casella.textContent = `${formatNumber(voluta, 1)}°`;
      callHa("climate", "set_temperature", { entity_id: entity, temperature: voluta });
      root.setTimeout?.(schedule, 700);
    }
    return;
  }
  const clima = event.target?.closest?.("[data-dm-w-clima]");
  if (clima) {
    event.preventDefault();
    root.toggleClima?.(clean(clima.dataset.dmWClima));
    root.setTimeout?.(schedule, 400);
    return;
  }
  const cover = event.target?.closest?.("[data-dm-w-cover]");
  if (cover) {
    event.preventDefault();
    const entity = clean(cover.dataset.dmWCover);
    const servizio = clean(cover.dataset.svc);
    /* Un servizio cover.* su un rele' cadrebbe nel vuoto: si traduce, con la
     * stessa regola della pagina Tapparelle — discesa prima, salita poi. */
    const comandi = relayCoverCommands(servizio, entity, clean(cover.dataset.dmWDown));
    if (comandi.length) {
      for (const { entity: bersaglio, service } of comandi)
        callHa("switch", service, { entity_id: bersaglio });
      return;
    }
    if (isRelayEntity(entity)) return; // fermare un rele' solo non vuol dire niente
    callHa("cover", servizio, { entity_id: entity });
    return;
  }
  // La tendina della posizione si apre da sola: un click sulla tessera che la
  // ospita la richiuderebbe prima di poterci scegliere qualcosa.
  if (event.target?.closest?.("[data-dm-w-position]")) return;
  const alarm = event.target?.closest?.("[data-dm-w-alarm]");
  if (alarm) {
    event.preventDefault();
    // Stessa strada della pagina Sicurezza: il tastierino PIN dell'antifurto
    // chiede il codice e poi chiama lui il servizio scelto.
    root.promptPinAndSet?.(clean(alarm.dataset.dmWAlarm));
    return;
  }
  if (event.target?.closest?.("[data-dm-widget-close]")) {
    event.preventDefault();
    toggleExpand(state.expanded);
    return;
  }
  /* Solo le tessere della griglia si aprono e si chiudono col tocco: quello
   * che sta dentro la finestra ha gia' avuto le sue occasioni qui sopra. */
  const tile = event.target?.closest?.("#dm-widgets [data-dm-widget]");
  if (tile) {
    event.preventDefault();
    toggleExpand(tile.dataset.dmWidget);
  }
}

function stateChangeTouchesTodo(event) {
  const values = event?.detail?.entity_ids || [event?.detail?.entity_id];
  const changed = new Set((Array.isArray(values) ? values : [values]).map(clean).filter(Boolean));
  if (!changed.size) return false;
  return configuredTodoLists().some((list) => changed.has(list.entity));
}

/* Lo stato di un `calendar.*` cambia quando un evento comincia o finisce: e'
 * il momento in cui l'elenco e' vecchio, e va riletto senza aspettare che
 * scada da solo. */
function ilCambioTocaUnCalendario(event) {
  const valori = event?.detail?.entity_ids || [event?.detail?.entity_id];
  const cambiate = new Set((Array.isArray(valori) ? valori : [valori]).map(clean).filter(Boolean));
  if (!cambiate.size) return false;
  return calendariConfigurati().some((voce) => cambiate.has(voce.entity));
}

/* ── stile ────────────────────────────────────────────────────────────── */

function installStyles() {
  installStyle(
    STYLE_ID,
    `
/* ── il popup del dettaglio ───────────────────────────────────────────────
 *
 * Le stesse forme dei popup che la plancia ha gia': il velo chiaro sfocato
 * del modal-wrapper, la card con l'angolo largo e l'ombra profonda del
 * modal-card. Sempre al centro — anche sul telefono: un foglio che sale dal
 * fondo e' un'altra lingua, e qui si parla quella di casa. */
/* Il velo e' un elemento suo, e la card non ci sta dentro.
 *
 * «Verifica di nuovo problema flicker su apertura widget»: nel video la
 * finestra aperta perde per un paio di centesimi la card bianca E la sua
 * testata — resta il solo corpo, sospeso sul fondale sfocato — e poi torna.
 * Piu' volte al secondo.
 *
 * Non e' il disegno che si rifa': e' il compositore. Chiedendo a Chromium
 * l'elenco degli strati, con la finestra aperta, #dm-widget-popup risulta
 * un unico strato di tutto lo schermo — e ci sono dipinti dentro la card e la
 * testata, mentre il corpo, che scorre, ha uno strato suo. Lo backdrop-filter e'
 * quello che obbliga a tenerli insieme: sfocare cio' che sta dietro
 * significa ridisegnare quello strato ogni volta che dietro si muove
 * qualcosa. Quando un fotogramma arriva prima che il ridisegno sia finito,
 * di quello strato non c'e' niente — card e testata spariscono — e il corpo,
 * che ha il suo, resta. E' esattamente quello che si vede.
 *
 * Qui il velo diventa un ::before: sfoca lui, e la card gli e' sorella
 * invece che figlia. Il ridisegno del velo non puo' piu' portarsi via la
 * finestra. */
#dm-widget-popup{
  position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;
  padding:20px;background:transparent;
  animation:dmWidgetPopupIn .2s ease-out}
#dm-widget-popup::before{
  content:"";position:absolute;inset:0;
  background:color-mix(in srgb,var(--bg-sculpted,#e6ebf1) 62%,rgba(15,23,42,.34));
  backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}
:root:is([data-theme="dark"]) #dm-widget-popup::before,
html[data-theme="dark"] #dm-widget-popup::before{background:color-mix(in srgb,#060a14 74%,rgba(2,6,15,.9))}
#dm-widget-popup[hidden]{display:none}
/* Una conferma sta sopra a chi la chiede (#275).
 *
 * «Dalla home cliccando sicurezza mostra le porte per aprire, si clicca il
 * lucchetto e il popup di conferma non viene mostrato perché accavallato dal
 * primo popup.» Vero, e la ragione è scritta poco più su: due veli sullo stesso
 * piano — z-index 9999 tutti e due — e vince il più giovane nel documento.
 * Il velo delle conferme sta nel guscio vendorizzato, cioè PRIMA di questo, che
 * nasce a runtime: la conferma si apriva davvero, sotto. Il tocco sul tasto
 * «Conferma» arrivava al corpo di questa finestra.
 *
 * Chiudere questa finestra prima di chiedere sarebbe stato l'altro modo, ed è
 * peggio: annullando si perde l'elenco delle porte e bisogna riaprirlo. Una
 * domanda che aspetta una risposta sta sopra tutto, ed è vero per ogni
 * conferma e ogni tastierino, non solo per le porte. */
#confirm-modal,#custom-keypad,#dm-door-keypad{z-index:10050!important}
@keyframes dmWidgetPopupIn{from{opacity:0}to{opacity:1}}
html.dm-widget-popup-open{overflow:hidden}
/* La stessa veste delle altre finestre della plancia.
 *
 * Non passa dal foglio dei popup — questa finestra e' roba di questo modulo, e
 * la disegna lui — quindi la veste va ripetuta qui: angolo piu' misurato,
 * un'ombra che scende invece dell'alone, e il filo di colore sul bordo alto,
 * dipinto nello sfondo perche' la finestra e' lei stessa il contenitore che
 * scorre e un elemento appoggiato scorrerebbe via col contenuto.
 *
 * Via anche l'anello bianco cucito dentro il bordo: valeva solo sul tema
 * chiaro, e sullo scuro era una riga luminosa in mezzo al buio. */
#dm-widget-popup .dm-widget-detail{
  /* Chi scorre e' il corpo, non la finestra.
   *
   * La finestra deve restare a contenuto tagliato — glielo chiede la regola che
   * condivide con la tessera aperta in griglia, che sta piu' in basso in questo
   * foglio e quindi vince a parita' di peso: dirle qui di farsi scorrere non
   * ha mai avuto effetto, e la Clima con dodici termostati finiva tagliata a
   * meta' senza modo di arrivare in fondo. Cosi' invece la card e' una colonna
   * alta al massimo quanto lo schermo, l'intestazione sta ferma in cima e la
   * lista sotto scorre da sola. */
  display:flex;flex-direction:column;
  /* Sopra il velo, che adesso e' un fratello posizionato: senza questo la
   * sfocatura coprirebbe la finestra invece di starle dietro. */
  position:relative;z-index:1;
  width:min(560px,100%);max-height:min(80dvh,760px);margin:0;
  border:1px solid var(--card-border,#e8edf3);border-radius:28px;
  background:var(--card-bg,#fff);
  box-shadow:0 32px 64px -28px rgba(2,6,23,.45),0 6px 18px -12px rgba(2,6,23,.25);
  animation:dmWidgetPopupCard .28s cubic-bezier(.16,1,.3,1)}
@keyframes dmWidgetPopupCard{from{opacity:0;transform:scale(.96) translateY(12px)}to{opacity:1;transform:none}}
/* Sul telefono la card non si muove: solo dissolvenza.
 *
 * La scala con la traslazione, sopra un fondale sfocato costoso, sul
 * telefono perde fotogrammi: il video della segnalazione mostra la finestra
 * che compare gia' quasi intera in un fotogramma solo e poi si assesta per un
 * quarto di secondo — cioe' «trema» — perche' l'animazione d'ingresso viene
 * mangiata dal lavoro del primo disegno. Una dissolvenza pura non ha niente
 * che possa tremare: o si vede o non si vede ancora. L'override sta in fondo
 * al foglio, DOPO la regola dmWidgetIn che a pari specificita' vincerebbe
 * per posizione. Su desktop, dove i fotogrammi ci sono, la card sale come
 * prima. */
/* Chi ha chiesto meno movimento non lo riceve: la finestra c'e' o non c'e'. */
@media(prefers-reduced-motion:reduce){
  #dm-widget-popup,#dm-widget-popup .dm-widget-detail{animation:none}
}
/* L'intestazione parla come le altre della plancia: maiuscoletto spaziato,
 * riga di separazione, il tondo per chiudere. Il velo colorato era un
 * gradiente che partiva dall'angolo e sbiadiva a meta': adesso e' un fondo
 * appena tinto, che non contende la scena al titolo. */
/* La testata della finestra e' la stessa fascia che aprono le pagine.
 *
 * Ci sono passate due versioni sbagliate per lo stesso motivo: erano tutte e
 * due invenzioni. Il filo di tre pixel sul bordo alto era il colore detto a
 * mezza voce, e da lontano tutte le finestre erano la stessa finestra bianca;
 * la fascia di colore pieno si vedeva benissimo, ma non somigliava a niente
 * del resto della plancia.
 *
 * La forma giusta la plancia ce l'ha gia', ed e' la fascia che apre ogni
 * pagina: fondo della card, un alone del colore che entra dall'angolo in alto
 * a destra, il titolo in Oswald maiuscolo nel colore della sezione, il
 * sottotitolo in piccolo maiuscoletto spaziato, e in fondo alla fascia una
 * riga di due pixel che sfuma. Qui e' quella, con l'aggiunta della pastiglia
 * dell'icona — la stessa della tessera da cui si e' arrivati, perche' la
 * finestra e' quella tessera che si apre.
 *
 * Titolo e sottotitolo vanno incolonnati, non affiancati: affiancati, il
 * sottotitolo di una sezione con sei voci finiva sempre coi puntini. */
#dm-widget-popup .dm-widget-detail .dm-w-head{
  flex:0 0 auto;position:relative;overflow:hidden;
  /* Tre righe: «Chiudi» in cima da solo, poi l'icona col nome della sezione, e
     sotto le briciole. E' la testata del progetto: la via d'uscita si vede
     subito, il nome e' grande e colorato, e sotto c'e' scritto di cosa parla. */
  display:grid;grid-template-columns:auto minmax(0,1fr);grid-template-rows:auto auto auto;
  column-gap:15px;row-gap:5px;align-items:center;
  padding:20px 22px 19px;color:var(--text,#0f172a);border-bottom:0;box-shadow:none;
  /* Il testo a sinistra: questa e' un <header>, e da telefono il foglio della
     plancia centra il testo di ogni <header> — quello suo, in cima alla
     pagina. Qui centrava titolo e sottotitolo lasciando l'icona da una parte. */
  text-align:left;
  background:
    radial-gradient(130% 190% at 88% -60%,
      color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 22%,transparent),
      transparent 58%),
    var(--card-bg,#fff)}
/* La riga in fondo alla fascia: due pixel che partono dal colore e sfumano,
   come in cima a ogni pagina. */
#dm-widget-popup .dm-widget-detail .dm-w-head::after{
  content:"";position:absolute;inset:auto 0 0 0;height:2px;opacity:.7;
  background:linear-gradient(90deg,
    var(--dm-widget-accent,#0ea5e9),
    color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 45%,transparent) 62%,transparent)}
/* La pastiglia dell'icona: la tinta della sezione, appena posata, con l'anello
 * sottile che hanno tutte le pastiglie della plancia. */
#dm-widget-popup .dm-widget-detail .dm-w-head-ic{
  grid-column:1;grid-row:2/4;flex:0 0 48px;width:48px;height:48px;display:grid;place-items:center;
  border-radius:16px;font-size:23px;
  background:linear-gradient(140deg,
    color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 17%,var(--card-bg,#fff)),
    color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 7%,var(--card-bg,#fff)));
  box-shadow:
    inset 0 1px 0 var(--dm-vetrino,rgba(255,255,255,.72)),
    inset 0 0 0 1px color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 30%,transparent),
    inset 0 -3px 7px -4px color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 50%,transparent),
    0 9px 18px -11px color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 70%,transparent)}
/* L'oggetto disegnato dentro la pastiglia della finestra e' lo stesso della
   tessera da cui si e' arrivati, un po' piu' grande perche' qui c'e' posto. */
#dm-widget-popup .dm-widget-detail .dm-w-head-ic .dm-oggetto{
  width:30px;height:30px;display:block;filter:drop-shadow(0 2px 3px rgba(15,23,42,.22))}
/* Il selettore e' lungo apposta: le stesse righe le riscrive piu' in basso la
 * regola condivisa con la tessera aperta in griglia, che a parita' di peso
 * vincerebbe perche' viene dopo. */
#dm-widget-popup .dm-widget-detail .dm-w-head strong{
  grid-column:2;grid-row:2;min-width:0;white-space:nowrap;overflow:hidden;
  font-family:'Oswald',system-ui,sans-serif;font-weight:700;
  font-size:clamp(19px,2.4vw,25px);line-height:1.05;letter-spacing:2px;text-transform:uppercase;
  color:color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 78%,#0f172a)}
#dm-widget-popup .dm-widget-detail .dm-w-head small{
  grid-column:2;grid-row:3;flex:none;
  font-size:11px;font-weight:800;letter-spacing:1.3px;text-transform:uppercase;
  color:var(--text-dim,#64748b);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* «Chiudi» sta in cima, scritto, non un tondino in un angolo: e' la prima cosa
   che si vede e la si legge, come nel progetto. */
/* La croce per chiudere si deve vedere.
 *
 * Era un testo grigio chiaro senza sfondo, in un angolo di una finestra che ha
 * colori dappertutto: «non sono presenti sulle croci per chiudere il tab, si
 * vede poco». Adesso ha un fondo suo, un bordo e il colore del testo pieno, e
 * il bersaglio arriva a trentadue pixel di altezza — che e' la misura sotto la
 * quale un dito manca. */
/* A destra, come in tutti gli altri popup della plancia: a sinistra stava
 * addosso alla testata — «li non mi piace, e' vicino alla testata». */
#dm-widget-popup .dm-widget-detail .dm-w-close{
  grid-column:1/-1;grid-row:1;justify-self:end;
  display:inline-flex;align-items:center;gap:7px;min-height:32px;padding:0 12px 0 9px;
  border:1px solid var(--card-border,#e2e8f0);border-radius:999px;
  background:var(--card-bg,#fff);box-shadow:0 1px 3px rgba(15,23,42,.06);
  font-size:11px;font-weight:900;letter-spacing:1.4px;text-transform:uppercase;
  color:var(--text,#0f172a);cursor:pointer;
  transition:color .18s ease,background .18s ease,border-color .18s ease}
#dm-widget-popup .dm-widget-detail .dm-w-close span{font-size:15px;letter-spacing:0;line-height:1}
#dm-widget-popup .dm-widget-detail .dm-w-close:hover{
  color:#dc2626;border-color:color-mix(in srgb,#dc2626 40%,transparent);
  background:color-mix(in srgb,#dc2626 8%,var(--card-bg,#fff))}
#dm-widget-popup .dm-widget-detail .dm-w-close:focus-visible{
  outline:2px solid var(--dm-widget-accent,#0ea5e9);outline-offset:2px}
html[data-theme="dark"] #dm-widget-popup .dm-widget-detail .dm-w-close:hover{color:#fca5a5}
/* E la finestra non ha piu' bisogno del filo di colore sul bordo alto: adesso
 * il colore ce l'ha la fascia. */
#dm-widget-popup .dm-widget-detail::before{display:none}
/* ── una forma sola: il verdetto, la frase, la misura con la sua corsa ─────
 *
 * Il blocco in cima alla finestra. Prende la tinta della sezione appena
 * accennata, cosi' si capisce da lontano di cosa si sta parlando, e il verdetto
 * ci mette il suo colore: verde quando non c'e' niente da fare, ambra quando
 * qualcosa sta lavorando, rosso quando qualcuno deve guardarci. */
/* Il lettore dentro la finestra: copertina quadrata, due righe di testo e i
   tasti sotto. Su una finestra larga un palmo i tasti non ci stanno in fila
   col resto, e mandarli a capo e' meglio che stringerli. */
#dm-widget-popup .dm-w-media{
  display:grid;grid-template-columns:56px minmax(0,1fr);gap:11px;align-items:center;
  padding:11px;border-radius:16px;margin-bottom:9px;
  background:var(--bg-sculpted,#f0f4f8);border:1px solid var(--card-border,#e2e8f0)}
#dm-widget-popup .dm-w-media[data-muta="true"]{opacity:.6}
#dm-widget-popup .dm-w-media-arte{
  width:56px;height:56px;border-radius:13px;object-fit:cover;
  background:var(--card-bg,#fff);box-shadow:0 8px 16px -10px rgba(2,6,23,.6)}
#dm-widget-popup .dm-w-media-vuota{display:grid;place-items:center;font-size:24px}
#dm-widget-popup .dm-w-media-vuota .dm-oggetto{width:34px;height:34px}
#dm-widget-popup .dm-w-media-testo{display:grid;gap:2px;min-width:0}
#dm-widget-popup .dm-w-media-dove{
  font-size:10px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;
  color:var(--text-dim,#64748b)}
#dm-widget-popup .dm-w-media-titolo{
  font-size:13.5px;font-weight:800;color:var(--text,#0f172a);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#dm-widget-popup .dm-w-media-sotto{
  font-size:11px;font-weight:600;color:var(--text-dim,#64748b);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#dm-widget-popup .dm-w-media .dm-mp-comandi{
  grid-column:1/-1;display:flex;gap:7px;margin:2px 0 0;flex-wrap:wrap}
#dm-widget-popup .dm-w-racconto{
  display:grid;gap:11px;margin:0 0 18px;padding:15px 16px 14px;
  border-radius:18px;
  border:1px solid color-mix(in srgb,var(--dm-verdetto,#10b981) 24%,transparent);
  background:linear-gradient(160deg,
    color-mix(in srgb,var(--dm-verdetto,#10b981) 11%,var(--card-bg,#fff)),
    var(--card-bg,#fff) 72%)}
#dm-widget-popup .dm-w-racconto[data-dm-verdetto="bene"]{--dm-verdetto:#10b981}
#dm-widget-popup .dm-w-racconto[data-dm-verdetto="corso"]{--dm-verdetto:#f59e0b}
#dm-widget-popup .dm-w-racconto[data-dm-verdetto="guarda"]{--dm-verdetto:#e11d48}
#dm-widget-popup .dm-w-verdetto{
  justify-self:start;display:inline-flex;align-items:center;gap:6px;
  padding:4px 10px;border-radius:999px;
  background:color-mix(in srgb,var(--dm-verdetto,#10b981) 16%,transparent);
  color:color-mix(in srgb,var(--dm-verdetto,#10b981) 82%,#0f172a);
  font-size:9.5px;font-weight:900;letter-spacing:1.4px;text-transform:uppercase}
#dm-widget-popup .dm-w-verdetto::before{
  content:"";width:6px;height:6px;border-radius:50%;background:var(--dm-verdetto,#10b981)}
/* La frase e' la cosa che si legge davvero: sta grande come un testo, non come
   un'etichetta, e va a capo invece di finire in tre puntini. */
#dm-widget-popup .dm-w-frase{
  margin:0;font-size:14.5px;line-height:1.45;font-weight:700;
  color:var(--text,#0f172a);text-wrap:balance}
/* I punti che sostengono la frase: piccoli, sotto, uno per riga. La frase
 * dice la cosa; i punti dicono i numeri su cui si regge — «la batteria si
 * carica a 1,47 kW», «in rete vanno 41 W» — che nella riga grande non ci
 * starebbero senza farne un paragrafo. */
/* La barra del livello: sta sotto il nome, larga quanto la colonna, e non
   sposta niente — due pixel e mezzo di altezza dentro la riga che c'era gia'. */
#dm-widget-popup .dm-w-livello{
  display:block;margin-top:5px;height:3px;border-radius:999px;overflow:hidden;
  background:color-mix(in srgb,var(--text-dim,#94a3b8) 22%,transparent)}
#dm-widget-popup .dm-w-livello>i{
  display:block;height:100%;border-radius:inherit;
  background:var(--dm-widget-accent,#0ea5e9);
  transition:width .3s ease}
#dm-widget-popup .dm-w-livello[data-basso="true"]>i{background:#e11d48}
#dm-widget-popup .dm-w-punti{
  margin:2px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:3px}
#dm-widget-popup .dm-w-punti li{
  position:relative;padding-inline-start:13px;font-size:12.5px;line-height:1.4;
  font-weight:650;color:var(--muted,#64748b)}
#dm-widget-popup .dm-w-punti li::before{
  content:"";position:absolute;inset-inline-start:2px;top:.62em;
  width:4px;height:4px;border-radius:50%;background:currentColor;opacity:.55}
#dm-widget-popup .dm-w-misura{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
#dm-widget-popup .dm-w-misura b{
  font-family:'Oswald',system-ui,sans-serif;font-weight:300;
  font-size:clamp(30px,9vw,42px);line-height:1;letter-spacing:-.01em;
  color:var(--text,#0f172a);font-variant-numeric:tabular-nums}
#dm-widget-popup .dm-w-misura small{
  font-size:11px;font-weight:800;line-height:1.35;
  color:color-mix(in srgb,var(--dm-verdetto,#10b981) 70%,var(--text-dim,#64748b))}
/* La corsa: dov'era, dov'e' arrivata. Senza numeri sopra — quelli stanno gia'
   accanto — perche' quello che serve e' la forma. */
#dm-widget-popup .dm-w-corsa{
  display:grid;grid-template-columns:1fr 1fr;align-items:end;gap:2px 0;margin-top:2px}
#dm-widget-popup .dm-w-corsa svg{
  grid-column:1/-1;width:100%;height:34px;overflow:visible}
#dm-widget-popup .dm-w-corsa polyline{
  fill:none;stroke:var(--dm-verdetto,#10b981);stroke-width:1.6;
  stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}
#dm-widget-popup .dm-w-corsa circle{fill:var(--dm-verdetto,#10b981)}
#dm-widget-popup .dm-w-corsa span{
  font-size:9px;font-weight:800;letter-spacing:1.1px;text-transform:uppercase;
  color:var(--text-dim,#94a3b8)}
#dm-widget-popup .dm-w-corsa span:last-child{text-align:right}
/* ── le caselle e le pillole ──────────────────────────────────────────── */
#dm-widget-popup .dm-w-titoletto{
  margin:18px 0 8px;font-size:9.5px;font-weight:900;letter-spacing:1.7px;
  text-transform:uppercase;color:var(--text-dim,#94a3b8)}
#dm-widget-popup .dm-w-caselle{
  display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
/* La porta verso il cruscotto: un tasto pieno, del colore della tessera. Con
   il vestito delle righe sembrava una barra grigia — cioe' una cosa disabilitata
   invece dell'unico gesto che questa finestra offre. */
/* La lettura del tempo: una riga sola, sopra i conti, in inchiostro pieno —
   e' una frase da leggere, non un'etichetta da scorrere. */
#dm-widget-popup .dm-w-lettura{
  margin:0 0 10px;font-size:13px;font-weight:700;
  color:var(--text,#0f172a);line-height:1.35}
/* Cosa e' arrivato oggi: l'etichetta a sinistra, poi una pastiglia per genere
   con il suo conto in coda al nome — «Difetti 1», come i filtri del cruscotto,
   che toglie di mezzo il singolare e il plurale. */
#dm-widget-popup .dm-w-oggi{
  display:flex;flex-wrap:wrap;align-items:center;gap:7px;margin:0 0 10px}
#dm-widget-popup .dm-w-oggi-lbl{
  font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;
  color:var(--text-dim,#64748b)}
#dm-widget-popup .dm-w-genere{
  display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:50px;
  font-size:12px;font-weight:700;color:var(--text,#0f172a);
  background:color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 12%,transparent);
  border:1px solid color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 26%,transparent)}
#dm-widget-popup .dm-w-genere b{opacity:.8}
/* Le conversazioni che aspettano. Un riquadro suo, in inchiostro d'accento,
   perche' e' la sola cosa di questa finestra che chiede di essere aperta: alla
   pari con i conti sarebbe passata per un'altra statistica. */
#dm-widget-popup .dm-w-chat{
  margin:0 0 11px;padding:10px 11px;border-radius:14px;
  background:color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 10%,transparent);
  border:1px solid color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 28%,transparent)}
#dm-widget-popup .dm-w-chat-testa{
  display:flex;align-items:center;gap:6px;margin-bottom:7px;
  font-size:12px;color:var(--text,#0f172a)}
#dm-widget-popup .dm-w-chat-riga{
  display:flex;align-items:center;gap:8px;padding:3px 0;
  font-size:12px;color:var(--text,#0f172a)}
/* Il titolo per intero non ci sta, e mandarlo a capo farebbe righe di altezza
   diversa: si taglia, e chi vuole leggerlo apre il cruscotto. */
#dm-widget-popup .dm-w-chat-tit{
  flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#dm-widget-popup .dm-w-chat-n{
  flex:none;min-width:18px;padding:1px 6px;border-radius:50px;text-align:center;
  font-size:11px;font-weight:800;color:#fff;
  background:var(--dm-widget-accent,#0ea5e9);font-variant-numeric:tabular-nums}
#dm-widget-popup .dm-w-chat-altre{
  margin-top:5px;font-size:11px;color:var(--text-dim,#64748b)}
/* L'ultima risposta dell'assistenza, intera: e' la cosa che si e' venuti a
   leggere, e non si taglia. L'ora sta a destra, in piccolo. */
#dm-widget-popup .dm-w-chat-quando{
  margin-left:auto;font-size:11px;color:var(--text-dim,#64748b)}
#dm-widget-popup .dm-w-chat-testo{
  margin:0;font-size:13px;line-height:1.45;color:var(--text,#0f172a);
  overflow-wrap:anywhere}
#dm-widget-popup .dm-w-porta{
  width:100%;margin-top:10px;padding:11px 14px;border:0;border-radius:14px;
  cursor:pointer;font-size:13px;font-weight:800;color:#fff;
  background:var(--dm-widget-accent,#0ea5e9)}
#dm-widget-popup .dm-w-porta:hover{filter:brightness(1.08)}
#dm-widget-popup .dm-w-casella{
  display:grid;gap:2px;padding:10px 11px;border-radius:14px;
  border:1px solid var(--card-border,#e2e8f0);background:var(--card-bg,#fff)}
#dm-widget-popup .dm-w-casella-ic{font-size:15px;line-height:1}
#dm-widget-popup .dm-w-casella-ic svg{width:18px;height:18px;display:block}
#dm-widget-popup .dm-w-casella b{
  font-family:'Oswald',system-ui,sans-serif;font-weight:400;font-size:19px;line-height:1.1;
  color:var(--text,#0f172a);font-variant-numeric:tabular-nums;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* La seconda misura della casella — l'umidita' accanto ai gradi — sta sotto il
 * numero grande, in tondo e col suo colore: si legge come un'altra cosa. */
#dm-widget-popup .dm-w-casella-sotto{
  font-style:normal;font-size:11.5px;font-weight:800;line-height:1.2;
  color:color-mix(in srgb,#0ea5e9 72%,var(--text-dim,#64748b));
  font-variant-numeric:tabular-nums}
/* L'etichetta va a capo invece di finire nei puntini: «TEMPERATURA PANNELLO…»
 * non diceva piu' quale pannello. Due righe bastano a ogni nome vero. */
#dm-widget-popup .dm-w-casella span{
  font-size:8.5px;font-weight:900;letter-spacing:1.1px;text-transform:uppercase;
  color:var(--text-dim,#94a3b8);line-height:1.4;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
#dm-widget-popup .dm-w-pillole{display:flex;flex-wrap:wrap;gap:6px}
#dm-widget-popup .dm-w-pillola{
  display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:999px;
  font-size:10.5px;font-weight:800;
  border:1px solid var(--card-border,#e2e8f0);
  background:var(--surface-2,#f8fafc);color:var(--text-dim,#94a3b8)}
#dm-widget-popup .dm-w-pillola::before{
  content:"";width:5px;height:5px;border-radius:50%;background:currentColor}
#dm-widget-popup .dm-w-pillola-ic{display:inline-grid;place-items:center;font-size:12px;line-height:1}
#dm-widget-popup .dm-w-pillola-ic svg{width:14px;height:14px}
#dm-widget-popup .dm-w-pillola[data-acceso="true"]{
  border-color:color-mix(in srgb,#10b981 34%,transparent);
  background:color-mix(in srgb,#10b981 12%,transparent);
  color:color-mix(in srgb,#10b981 76%,#0f172a)}
/* Nome e stato si distinguono: il nome respira, lo stato e' la parola in
 * maiuscoletto dopo il punto — «non si capisce» era tutto sullo stesso tono. */
#dm-widget-popup .dm-w-pillola{font-size:11px}
#dm-widget-popup .dm-w-pillola-nome{
  min-width:0;max-width:210px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  color:var(--text,#0f172a);font-weight:700}
#dm-widget-popup .dm-w-pillola[data-acceso="true"] .dm-w-pillola-nome{color:inherit}
#dm-widget-popup .dm-w-pillola b{
  font-weight:900;color:inherit;text-transform:uppercase;font-size:9.5px;letter-spacing:.8px}
#dm-widget-popup .dm-w-pillola b::before{content:"·";margin-right:5px;font-size:11px}
@media(max-width:420px){
  #dm-widget-popup .dm-w-caselle{grid-template-columns:repeat(2,minmax(0,1fr))}
}
#dm-widget-popup .dm-w-piede{
  display:flex;padding:0 15px 15px;margin:0}
#dm-widget-popup .dm-w-vai{
  flex:1;display:inline-flex;align-items:center;justify-content:center;gap:8px;
  min-height:46px;padding:12px 16px;border-radius:15px;
  border:1px solid var(--divider-color,#dbe4ee);
  background:color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 12%,var(--card-bg,#fff));
  color:var(--dm-widget-accent,#0369a1);
  font:inherit;font-size:13px;font-weight:800;letter-spacing:.4px;cursor:pointer;
  transition:transform .18s ease,box-shadow .18s ease}
#dm-widget-popup .dm-w-vai:hover{
  transform:translateY(-1px);box-shadow:0 10px 22px -16px rgba(15,23,42,.7)}
#dm-widget-popup .dm-w-vai:active{transform:none}
#dm-widget-popup .dm-w-body{
  padding:16px 18px 20px;display:grid;gap:9px;
  /* L'altezza minima azzerata perche' un figlio di colonna flex, per difetto,
     non scende sotto il proprio contenuto: senza, la lista non si accorcia mai
     e non c'e' niente da scorrere. */
  flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;
  -webkit-overflow-scrolling:touch;
  /* Una barra sottile del colore della tessera: senza, su un portatile che
     nasconde le barre finche' non si scorre, una lista lunga sembrava finire
     dove finisce la finestra. */
  scrollbar-width:thin;
  scrollbar-color:color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 42%,transparent) transparent}
#dm-widget-popup .dm-w-body::-webkit-scrollbar{width:9px}
#dm-widget-popup .dm-w-body::-webkit-scrollbar-track{background:transparent}
#dm-widget-popup .dm-w-body::-webkit-scrollbar-thumb{
  border-radius:100px;border:2px solid transparent;background-clip:padding-box;
  background:color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 38%,transparent)}
/* Ogni riga e' una tessera coricata.
 *
 * La lista era una fila di pastiglie tutte uguali: un'emoji da quindici pixel,
 * un nome, e a destra il comando. Chi era acceso e chi era spento lo diceva
 * soltanto il comando, in fondo alla riga — per sapere quante luci erano
 * accese bisognava leggere gli interruttori uno per uno. E la tessera da cui
 * si arrivava, in Home, era fatta in tutt'altro modo: pastiglia dell'icona
 * tinta, valore grande, nome sotto.
 *
 * Adesso la riga e' quella tessera messa in orizzontale. L'icona sta nella
 * stessa pastiglia — tinta del colore della sezione quando la cosa e' accesa,
 * neutra quando e' spenta — il nome e' piu' grosso di quello che ha sotto, il
 * valore e' in Oswald come tutti i numeri della plancia, e la riga intera si
 * vela appena del colore quando e' accesa: da un metro di distanza si contano
 * gli accesi senza leggere niente. */
/* Il riepilogo in cima: tre numeri grandi, quelli che si guardano prima di
 * mettersi a leggere le righe. Stessa aria delle tessere della Home — numero
 * in Oswald, etichetta minuscola sotto — dentro un vassoio appena tinto del
 * colore della sezione. */
#dm-widget-popup .dm-w-summary{
  display:flex;margin:0 0 4px;border-radius:18px;
  border:1px solid color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 22%,transparent);
  background:color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 5%,var(--card-bg,#fff))}
#dm-widget-popup .dm-w-stat{
  flex:1;min-width:0;display:grid;gap:2px;justify-items:center;padding:11px 8px 10px}
/* Le colonne le separa una riga, non un buco nello sfondo: il vassoio a
   griglia con la fessura da un pixel veniva misurato piu' corto di quello che
   e' e tagliava le etichette. */
#dm-widget-popup .dm-w-stat+.dm-w-stat{
  border-left:1px solid color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 18%,transparent)}
#dm-widget-popup .dm-w-stat b{
  font-family:'Oswald',system-ui,sans-serif;font-size:21px;font-weight:600;line-height:1;
  font-variant-numeric:tabular-nums;
  color:color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 72%,#0f172a)}
#dm-widget-popup .dm-w-stat span{
  font-size:10px;font-weight:800;letter-spacing:.9px;text-transform:uppercase;
  color:var(--text-dim,#94a3b8);text-align:center}
/* La rotella: apre il pannello della riga, e quando e' aperto si tinge —
 * altrimenti, con il pannello sotto, non si capiva quale riga l'aveva
 * aperto. */
#dm-widget-popup .dm-w-row .dm-w-more{
  flex:0 0 32px;width:32px;height:32px;display:grid;place-items:center;
  border-radius:11px;font-size:14px;cursor:pointer;
  border:1px solid var(--card-border,#e8edf3);background:var(--surface-2,#f8fafc);
  transition:background .18s ease,border-color .18s ease,transform .25s ease}
#dm-widget-popup .dm-w-row[data-dm-w-open="true"] .dm-w-more{
  background:color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 14%,transparent);
  border-color:color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 40%,transparent);
  transform:rotate(60deg)}
/* Il pannello si accoda alla riga: margine negativo per chiudere lo spazio
 * fra le righe, angoli alti squadrati e nessun bordo in cima. Le due cose
 * diventano una card sola. */
:is(#dm-widget-popup,#clima-popup-overlay) .dm-w-panel{
  display:grid;gap:10px;margin:-9px 0 0;padding:14px 14px 15px;
  border:1px solid color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 40%,transparent);
  border-top:0;border-radius:0 0 18px 18px;
  background:color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 5%,var(--card-bg,#fff));
  box-shadow:0 14px 30px -22px color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 90%,transparent)}
:is(#dm-widget-popup,#clima-popup-overlay) .dm-w-panel[hidden]{display:none}
/* Da sola non e' accodata a niente: torna una card intera, con tutti e quattro
   gli angoli e il bordo in cima. */
:is(#dm-widget-popup,#clima-popup-overlay) .dm-w-panel-solo{
  margin:0;border-top:1px solid color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 40%,transparent);
  border-radius:18px}
:is(#dm-widget-popup,#clima-popup-overlay) .dm-w-panel-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
:is(#dm-widget-popup,#clima-popup-overlay) .dm-w-panel-lbl{
  flex:0 0 82px;font-size:10px;font-weight:800;letter-spacing:.9px;
  text-transform:uppercase;color:var(--text-dim,#94a3b8)}
:is(#dm-widget-popup,#clima-popup-overlay) .dm-w-chips{display:flex;flex-wrap:wrap;gap:6px;flex:1;min-width:0}
:is(#dm-widget-popup,#clima-popup-overlay) .dm-w-chip{
  padding:6px 11px;border-radius:999px;cursor:pointer;
  border:1px solid var(--card-border,#e8edf3);background:var(--card-bg,#fff);
  font:inherit;font-size:11.5px;font-weight:800;color:var(--text-dim,#64748b);
  transition:background .18s ease,border-color .18s ease,color .18s ease}
:is(#dm-widget-popup,#clima-popup-overlay) .dm-w-chip:hover{
  border-color:color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 45%,transparent)}
:is(#dm-widget-popup,#clima-popup-overlay) .dm-w-chip[data-on="true"]{
  background:var(--dm-widget-accent,#0ea5e9);border-color:transparent;color:#fff;
  box-shadow:0 6px 14px -9px color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 90%,transparent)}
/* Il passo della temperatura: meno, il numero, piu'. */
:is(#dm-widget-popup,#clima-popup-overlay) .dm-w-stepper{
  display:inline-flex;align-items:center;gap:2px;padding:2px;border-radius:12px;
  background:var(--card-bg,#fff);box-shadow:inset 0 0 0 1px var(--card-border,#e8edf3)}
:is(#dm-widget-popup,#clima-popup-overlay) .dm-w-stepper button{
  width:30px;height:28px;display:grid;place-items:center;border:0;border-radius:10px;
  background:transparent;color:var(--text,#0f172a);
  font:inherit;font-size:16px;font-weight:800;line-height:1;cursor:pointer;
  transition:background .15s ease}
:is(#dm-widget-popup,#clima-popup-overlay) .dm-w-stepper button:hover{
  background:color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 14%,transparent)}
:is(#dm-widget-popup,#clima-popup-overlay) .dm-w-stepper b{
  min-width:52px;text-align:center;
  font-family:'Oswald',system-ui,sans-serif;font-size:17px;font-weight:600;
  font-variant-numeric:tabular-nums}
:is(#dm-widget-popup,#clima-popup-overlay) .dm-w-panel-note{
  margin:0;font-size:11px;font-weight:700;color:var(--text-dim,#94a3b8)}
/* Sul telefono l'etichetta va sopra: ottantadue pixel di colonna, su
   trecentonovanta, lasciavano alle modalita' una pastiglia per riga.
   Le tre righe valgono per tutt'e due le finestre. Le ultime due erano scritte
   per la sola «#dm-widget-popup», e la gemella e' rimasta indietro: nella
   finestra del Clima la riga diventava una colonna ma l'etichetta teneva il
   suo «flex:0 0 82px», che in colonna non e' piu' una larghezza ma
   un'altezza. Misurato: la parola «Modalita'» alta ottantadue pixel, con
   sotto il vuoto — sono i buchi che si vedevano fra «MODALITA'» e le
   pastiglie, fra «TEMPERATURA» e il suo passo, fra «VENTOLA» e i numeri.
   La riga sopra le nominava gia' tutt'e due; queste due no. */
@media(max-width:600px){
  :is(#dm-widget-popup,#clima-popup-overlay) .dm-w-panel-row{flex-direction:column;align-items:stretch;gap:6px}
  :is(#dm-widget-popup,#clima-popup-overlay) .dm-w-panel-lbl{flex:none}
  :is(#dm-widget-popup,#clima-popup-overlay) .dm-w-stepper{align-self:flex-start}
}
#dm-widget-popup .dm-w-row{
  position:relative;display:flex;align-items:center;gap:12px;
  padding:10px 12px;border-radius:18px;
  border:1px solid var(--card-border,#eef2f7);
  background:var(--card-bg,#fff);margin:0;
  box-shadow:0 1px 2px rgba(15,23,42,.03);
  transition:border-color .18s ease,background .18s ease,box-shadow .18s ease}
/* Il binario di colore sul fianco non serve piu': il colore ce l'ha la
   pastiglia, e due cose colorate sulla stessa riga erano una di troppo. */
#dm-widget-popup .dm-w-row::before{display:none}
#dm-widget-popup .dm-w-row:hover{
  border-color:color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 32%,transparent);
  box-shadow:0 6px 16px -10px color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 60%,transparent)}
/* Aperta, la riga apre gli angoli in basso e lascia entrare il pannello. */
#dm-widget-popup .dm-w-row[data-dm-w-open="true"]{
  border-color:color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 40%,transparent);
  border-bottom-color:transparent;
  border-bottom-left-radius:0;border-bottom-right-radius:0;
  box-shadow:none}
/* Accesa: la velatura sulla riga. Lo stato lo dice il comando o l'icona, a
   seconda di cosa quella sezione mette in riga — si guardano tutti e tre. */
#dm-widget-popup .dm-w-row:is(
  :has(.dm-w-glyph[data-on="true"]),
  :has(.dm-w-switch[data-on="true"]),
  :has(.dm-w-power[data-on="true"])){
  background:color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 5%,var(--card-bg,#fff));
  border-color:color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 22%,var(--card-border,#eef2f7))}
/* La pastiglia dell'icona: la stessa della tessera in Home. */
#dm-widget-popup .dm-w-row .dm-w-glyph{
  flex:0 0 38px;width:38px;height:38px;display:grid;place-items:center;
  border-radius:13px;font-size:18px;filter:none;opacity:1;
  background:var(--surface-2,#f8fafc);
  box-shadow:inset 0 0 0 1px var(--card-border,#e8edf3);
  transition:background .2s ease,box-shadow .2s ease,filter .2s ease}
#dm-widget-popup .dm-w-row .dm-w-glyph[data-on="true"]{
  background:linear-gradient(150deg,
    color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 20%,#fff),
    color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 11%,#fff));
  box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 26%,transparent)}
/* Spenta: il grigio sta sulla pastiglia intera, ma il fondo e' gia' quasi
   grigio — a cambiare e' solo l'emoji, che e' quello che si vuole. */
#dm-widget-popup .dm-w-row .dm-w-glyph[data-on="false"]{filter:grayscale(1);opacity:.5}
/* Il nome pesa piu' di quello che ha sotto: prima erano quasi uguali e la riga
   si leggeva tutta insieme, senza un ordine. */
#dm-widget-popup .dm-w-row .dm-w-name{
  gap:2px;font-size:14px;font-weight:800;letter-spacing:.1px}
#dm-widget-popup .dm-w-row .dm-w-name small{
  font-size:11px;font-weight:700;letter-spacing:.2px;color:var(--text-dim,#94a3b8)}
/* I numeri in Oswald, come tutti i numeri della plancia, e incolonnabili. */
#dm-widget-popup .dm-w-row .dm-w-val{
  font-family:'Oswald',system-ui,sans-serif;font-size:18px;font-weight:600;
  font-variant-numeric:tabular-nums;color:var(--text,#0f172a)}
/* Il tasto di accensione: pastiglia quadrata come le altre, non un cerchio
   con l'alone — l'alone era l'unica cosa che si vedeva della riga. */
#dm-widget-popup .dm-w-row .dm-w-power{
  flex:0 0 36px;width:36px;height:36px;border-radius:12px;font-size:15px;
  border:1px solid var(--card-border,#e8edf3);background:var(--surface-2,#f8fafc);
  color:var(--text-dim,#94a3b8);box-shadow:none}
#dm-widget-popup .dm-w-row .dm-w-power[data-on="true"]{
  border-color:transparent;background:var(--dm-widget-accent,#0ea5e9);color:#fff;
  box-shadow:0 6px 14px -8px color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 85%,transparent)}
/* L'interruttore: un filo piu' largo, e da spento un grigio che si vede senza
   gridare. */
#dm-widget-popup .dm-w-row .dm-w-switch{
  flex:0 0 44px;width:44px;height:26px;
  background:color-mix(in srgb,var(--text-dim,#94a3b8) 26%,transparent)}
#dm-widget-popup .dm-w-row .dm-w-switch i{top:3px;left:3px;width:20px;height:20px}
#dm-widget-popup .dm-w-row .dm-w-switch[data-on="true"] i{transform:translateX(18px)}
/* I comandi minori — la tendina della posizione, le frecce — prendono la
   stessa forma della pastiglia, cosi' la riga ha un solo raggio. */
#dm-widget-popup .dm-w-row :is(.dm-w-position,.dm-w-arrows button,.dm-w-alarm button){
  border-radius:11px;background:var(--surface-2,#f8fafc);
  border:1px solid var(--card-border,#e8edf3)}
#dm-widget-popup .dm-w-row .dm-w-position{height:30px;width:38px}
#dm-widget-popup .dm-w-row .dm-w-arrows button{width:32px;height:32px}
/* Il titolo di un gruppo dentro la lista: maiuscoletto spaziato con la sua
   riga sottile, come le altre separazioni della plancia. */
/* Il tasto che apre una porta: la stessa pastiglia quadrata degli altri
 * comandi di riga, in verde perche' apre. */
#dm-widget-popup .dm-w-row .dm-w-door{
  flex:0 0 36px;width:36px;height:36px;display:grid;place-items:center;
  border-radius:12px;font-size:16px;cursor:pointer;
  border:1px solid var(--card-border,#e8edf3);background:var(--surface-2,#f8fafc);
  transition:background .18s ease,border-color .18s ease,transform .15s ease}
#dm-widget-popup .dm-w-row .dm-w-door:hover{
  background:color-mix(in srgb,var(--dm-widget-accent,#10b981) 14%,transparent);
  border-color:color-mix(in srgb,var(--dm-widget-accent,#10b981) 45%,transparent)}
#dm-widget-popup .dm-w-row .dm-w-door:active{transform:scale(.94)}
@media(prefers-reduced-motion:reduce){
  #dm-widget-popup .dm-w-row .dm-w-door{transition:none}
  #dm-widget-popup .dm-w-row .dm-w-door:active{transform:none}
}
/* La riga per scrivere: una casella e un piu', larghi quanto la lista. */
:is(#dm-widget-popup,#page-calendario) .dm-todo-add{
  display:flex;gap:8px;margin:9px 0 2px}
:is(#dm-widget-popup,#page-calendario) .dm-todo-new{
  flex:1 1 auto;min-width:0;height:38px;padding:0 13px;border-radius:13px;
  border:1px solid var(--card-border,#e8edf3);background:var(--card-bg,#fff);
  font:inherit;font-size:13px;font-weight:700;color:var(--text,#0f172a);
  transition:border-color .18s ease,box-shadow .18s ease}
:is(#dm-widget-popup,#page-calendario) .dm-todo-new::placeholder{color:var(--text-dim,#94a3b8);font-weight:600}
:is(#dm-widget-popup,#page-calendario) .dm-todo-new:focus{
  outline:none;border-color:var(--dm-widget-accent,#0ea5e9);
  box-shadow:0 0 0 3px color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 18%,transparent)}
:is(#dm-widget-popup,#page-calendario) .dm-todo-plus{
  flex:0 0 38px;width:38px;height:38px;display:grid;place-items:center;
  border:0;border-radius:13px;cursor:pointer;
  background:var(--dm-widget-accent,#0ea5e9);color:#fff;
  font:inherit;font-size:19px;font-weight:800;line-height:1;
  box-shadow:0 8px 18px -10px color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 90%,transparent);
  transition:transform .15s ease,filter .18s ease}
:is(#dm-widget-popup,#page-calendario) .dm-todo-plus:hover{filter:brightness(1.06)}
:is(#dm-widget-popup,#page-calendario) .dm-todo-plus:active{transform:scale(.94)}
/* Il cestino sta in fondo alla riga e si fa vedere quando serve: sempre sul
   telefono, dove non c'e' un puntatore da avvicinare. */
:is(#dm-widget-popup,#page-calendario) .dm-todo-del{
  flex:0 0 30px;width:30px;height:30px;display:grid;place-items:center;
  margin-left:auto;border:0;border-radius:10px;cursor:pointer;
  background:transparent;font-size:14px;line-height:1;opacity:.35;
  transition:opacity .18s ease,background .18s ease}
:is(#dm-widget-popup,#page-calendario) .dm-todo-item:hover .dm-todo-del{opacity:1}
:is(#dm-widget-popup,#page-calendario) .dm-todo-del:hover{background:#fee2e2;opacity:1}
@media(hover:none){:is(#dm-widget-popup,#page-calendario) .dm-todo-del{opacity:.7}}
@media(prefers-reduced-motion:reduce){
  :is(#dm-widget-popup,#page-calendario) .dm-todo-plus:active{transform:none}
}
#dm-widget-popup .dm-w-block-title{
  padding:10px 4px 8px;font-size:10.5px;letter-spacing:1.2px;
  border-bottom:1px solid var(--card-border,#eef2f7);margin-bottom:2px}
#dm-widget-popup .dm-w-empty{margin:6px 4px;font-size:13px}
/* Le miniature delle telecamere: lo stesso angolo delle righe. */
#dm-widget-popup .dm-w-cam{border-radius:16px}
/* Nella finestra la colonna e' larga il doppio della tessera: con la stessa
 * misura minima i riquadri raddoppiavano, e quattro telecamere diventavano
 * quattro manifesti. Qui la traccia minima e' piu' stretta, cosi' le
 * miniature restano miniature e ce ne stanno tre per riga. */
#dm-widget-popup .dm-w-cams{grid-template-columns:repeat(auto-fill,minmax(148px,1fr))}
@media(prefers-reduced-motion:reduce){
  #dm-widget-popup .dm-w-row,#dm-widget-popup .dm-w-close,
  #dm-widget-popup .dm-w-row .dm-w-more{transition:none}
  #dm-widget-popup .dm-w-row[data-dm-w-open="true"] .dm-w-more{transform:none}
  #dm-widget-popup .dm-w-close:hover{transform:none}
}
#dm-widget-popup .dm-w-name{font-size:13.5px;font-weight:800}
#dm-widget-popup .dm-w-val{font-size:14.5px;font-weight:900}
#dm-widget-popup .dm-w-glyph{font-size:17px}
@media(max-width:600px){
  #dm-widget-popup{padding:16px}
  #dm-widget-popup .dm-widget-detail{border-radius:22px;max-height:82dvh}
  #dm-widget-popup .dm-widget-detail .dm-w-head{padding:16px 16px 15px;column-gap:12px}
  #dm-widget-popup .dm-w-body{padding:13px 15px 18px}
}
/* ── «In primo piano»: il ponte dei widget della Home ─────────────────── */
#dm-widgets{display:block;margin:16px 0 6px}
/* L'intestazione e' un titolo di sezione, uguale a «Azioni rapide» e a
   «Persone»: sulla Home i blocchi si annunciano tutti allo stesso modo. Sotto,
   la riga che dice come sta la casa, e che si tinge quando qualcosa chiede
   attenzione. */
/* Come «Azioni rapide»: solo la parola, senza disegni davanti. Il simbolo che
 * c'era faceva di questa scritta un'altra cosa dalle sue sorelle. */
#dm-widgets .dm-widgets-title{
  /* L'aria sopra e' la stessa di tutte le intestazioni della Home: ventotto
   * pixel, perche' la card di sopra butta ombra per diciotto e con quindici il
   * titolo cominciava dentro l'ombra. Sta scritta anche qui, e non solo nella
   * regola comune, perche' i due fogli hanno lo stesso peso e a decidere
   * sarebbe l'ordine in cui si installano. */
  margin:28px 0 0;font-family:'Inter',sans-serif;font-size:12px;font-weight:800;
  letter-spacing:2px;text-transform:uppercase;color:var(--text-dim,#64748b)}
#dm-widgets .dm-widgets-sub{
  margin:4px 0 14px;font-size:12px;font-weight:700;letter-spacing:.2px;color:var(--text-dim,#64748b)}
#dm-widgets[data-dm-mood="avviso"] .dm-widgets-sub{color:#b45309}

/* Le tessere.
 *
 * Tre righe, e ognuna con un mestiere solo: la pastiglia col nome, il numero,
 * il dettaglio con la misura. Prima nome e misura si dividevano la stessa
 * riga e la misura vinceva sempre: con «Temperatura» al nome restavano zero
 * pixel, e finiva coi puntini. Adesso la riga del nome e' tutta sua.
 *
 * Il colore non e' una decorazione: una tessera nasce calma — pastiglia
 * neutra, niente velo — e si accende solo quando ha qualcosa da dire. Se
 * gridano tutte non si sente nessuna.
 *
 * La luce viene sempre dall'alto: filo chiaro sul bordo di sopra, filo scuro
 * su quello di sotto, ombra corta attaccata alla carta e ombra lunga sfumata
 * sotto. E' quello che fa sembrare le tessere appoggiate sulla pagina invece
 * che stampate sopra. */
:is(#dm-widgets,#dm-widget-popup){
  --dm-vetrino:rgba(255,255,255,.72);
  --dm-velo:9%;
  --dm-cuscino:15%;
  --dm-grana:.5;
  --dm-alone:.26}
html[data-theme="dark"] :is(#dm-widgets,#dm-widget-popup),
body.dark-theme :is(#dm-widgets,#dm-widget-popup){
  --dm-vetrino:rgba(255,255,255,.06);
  --dm-velo:14%;
  --dm-cuscino:22%;
  --dm-grana:.34;
  --dm-alone:.55}
:is(#dm-widgets,#dm-widget-popup) .dm-widgets-grid{
  display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px}
:is(#dm-widgets,#dm-widget-popup) .dm-tile{
  position:relative;overflow:hidden;display:flex;flex-direction:column;gap:10px;
  min-height:118px;padding:15px 16px 17px;border:0;border-radius:22px;
  background:linear-gradient(180deg,var(--card-bg,#fff),
    color-mix(in srgb,var(--card-bg,#fff) 92%,var(--bg-sculpted,#eef2f7)));
  color:var(--text,#0f172a);font:inherit;text-align:left;cursor:pointer;
  box-shadow:
    inset 0 1px 0 var(--dm-vetrino),
    inset 0 0 0 1px color-mix(in srgb,var(--text,#0f172a) 7%,transparent),
    inset 0 -1px 0 color-mix(in srgb,var(--text,#0f172a) 6%,transparent),
    0 1px 1px rgba(15,23,42,.05),0 14px 28px -18px rgba(15,23,42,.55);
  transition:transform .18s cubic-bezier(.16,1,.3,1),box-shadow .2s ease,background .45s ease}
/* La grana: la carta vera non e' mai perfettamente liscia, e senza quel velo
   le tessere sembrano vetro stampato. */
:is(#dm-widgets,#dm-widget-popup) .dm-tile::before{
  content:"";position:absolute;inset:0;pointer-events:none;border-radius:inherit;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23g)'/%3E%3C/svg%3E");
  background-size:140px 140px;mix-blend-mode:soft-light;opacity:var(--dm-grana)}
/* Accesa: il velo del suo colore, il bordo che si scalda e l'ombra lunga che
   prende la tinta della sezione. */
:is(#dm-widgets,#dm-widget-popup) .dm-tile[data-acceso="true"],
:is(#dm-widgets,#dm-widget-popup) .dm-tile[data-open="true"]{
  background:
    radial-gradient(135% 105% at 100% 0%,
      color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) var(--dm-velo),transparent),transparent 66%),
    linear-gradient(180deg,var(--card-bg,#fff),
      color-mix(in srgb,var(--card-bg,#fff) 92%,var(--bg-sculpted,#eef2f7)));
  box-shadow:
    inset 0 1px 0 var(--dm-vetrino),
    inset 0 0 0 1px color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 28%,transparent),
    inset 0 -1px 0 color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 16%,transparent),
    0 1px 1px rgba(15,23,42,.05),
    0 16px 32px -18px color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 60%,rgba(15,23,42,.5))}
/* L'alone che respira: sta dietro la tessera che chiede attenzione, e si
   spegne appena la cosa rientra. */
:is(#dm-widgets,#dm-widget-popup) .dm-tile-alone{
  position:absolute;inset:-40% -30% auto -30%;height:150%;pointer-events:none;opacity:0;
  background:radial-gradient(60% 60% at 50% 0%,
    color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 55%,transparent),transparent 70%);
  transition:opacity .5s ease}
:is(#dm-widgets,#dm-widget-popup) .dm-tile[data-alert="true"] .dm-tile-alone{
  opacity:var(--dm-alone);animation:dmTileRespiro 3.4s ease-in-out infinite}
@keyframes dmTileRespiro{
  0%,100%{opacity:calc(var(--dm-alone) * .45);transform:translateY(4px) scale(.97)}
  50%{opacity:var(--dm-alone);transform:translateY(-2px) scale(1.03)}}
/* La lama: quando una tessera si accende, una luce del suo colore la
   attraversa una volta sola. E' l'unico momento in cui la plancia alza la voce. */
:is(#dm-widgets,#dm-widget-popup) .dm-tile[data-dm-accende]::after{
  content:"";position:absolute;inset:0;pointer-events:none;border-radius:inherit;
  background:linear-gradient(105deg,transparent 30%,
    color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 26%,transparent) 48%,transparent 66%);
  transform:translateX(-120%);animation:dmTileLama .85s cubic-bezier(.3,.7,.3,1)}
@keyframes dmTileLama{to{transform:translateX(120%)}}
/* L'ingresso e' per chi entra adesso: una tessera gia' vista non rianima. */
:is(#dm-widgets,#dm-widget-popup) .dm-tile:not([data-dm-seen]){
  animation:dmTileIn .42s cubic-bezier(.16,1,.3,1) both;
  animation-delay:calc(var(--dm-tile-i,0) * 55ms)}
@keyframes dmTileIn{from{opacity:0;transform:translateY(8px) scale(.97)}to{opacity:1;transform:none}}
@media(hover:hover){
  :is(#dm-widgets,#dm-widget-popup) .dm-tile:hover{transform:translateY(-2px)}
}
:is(#dm-widgets,#dm-widget-popup) .dm-tile:active{transform:translateY(1px) scale(.995)}
:is(#dm-widgets,#dm-widget-popup) .dm-tile:focus-visible{
  outline:2px solid var(--dm-widget-accent,#0ea5e9);outline-offset:3px}

/* La prima riga: la pastiglia e il nome, e nient'altro. */
:is(#dm-widgets,#dm-widget-popup) .dm-tile-cima{
  position:relative;display:flex;align-items:center;gap:11px;min-width:0}
/* La pastiglia e' un cuscino: gradiente, anello sottile, incavo in basso, e
   l'oggetto che ci posa sopra con la sua ombra. */
:is(#dm-widgets,#dm-widget-popup) .dm-tile-chip{
  flex:0 0 41px;width:41px;height:41px;display:grid;place-items:center;border-radius:15px;font-size:20px;
  background:linear-gradient(158deg,
    color-mix(in srgb,var(--text,#0f172a) 8%,var(--card-bg,#fff)),
    color-mix(in srgb,var(--text,#0f172a) 3%,var(--card-bg,#fff)));
  box-shadow:
    inset 0 1px 0 var(--dm-vetrino),
    inset 0 0 0 1px color-mix(in srgb,var(--text,#0f172a) 7%,transparent),
    inset 0 -3px 6px -4px color-mix(in srgb,var(--text,#0f172a) 30%,transparent),
    0 5px 11px -9px rgba(15,23,42,.8);
  transition:background .5s ease,box-shadow .5s ease}
:is(#dm-widgets,#dm-widget-popup) .dm-tile[data-acceso="true"] .dm-tile-chip,
:is(#dm-widgets,#dm-widget-popup) .dm-tile[data-open="true"] .dm-tile-chip{
  background:linear-gradient(158deg,
    color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) var(--dm-cuscino),var(--card-bg,#fff)),
    color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 9%,var(--card-bg,#fff)));
  box-shadow:
    inset 0 1px 0 var(--dm-vetrino),
    inset 0 0 0 1px color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 32%,transparent),
    inset 0 -3px 7px -4px color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 55%,transparent),
    0 10px 18px -11px color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 90%,transparent)}
:is(#dm-widgets,#dm-widget-popup) .dm-tile-chip .dm-oggetto{
  width:26px;height:26px;display:block;filter:drop-shadow(0 2px 3px rgba(15,23,42,.22))}
:is(#dm-widgets,#dm-widget-popup) .dm-tile-chip[data-dm-sboccia]{
  animation:dmTileSboccia .62s cubic-bezier(.2,.9,.25,1)}
@keyframes dmTileSboccia{
  0%{transform:scale(1)}35%{transform:scale(1.2)}70%{transform:scale(.96)}100%{transform:scale(1)}}
/* Il nome non finisce mai coi puntini: se non entra si stringe la spaziatura,
   poi si scende di corpo, e solo alla fine va su due righe. Chi lo stringe e'
   il codice, qui c'e' solo il punto di partenza. */
:is(#dm-widgets,#dm-widget-popup) .dm-tile-label{
  flex:1;min-width:0;font-size:9.8px;font-weight:900;letter-spacing:.11em;line-height:1.25;
  text-transform:uppercase;color:var(--text-dim,#64748b);
  display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;
  word-break:normal;overflow-wrap:normal}

/* La seconda riga: il numero, e l'unita' che gli sta accanto senza pesare. */
:is(#dm-widgets,#dm-widget-popup) .dm-tile-val{
  /* Il numero e la sua unita' devono restare attaccati anche per chi il testo
     lo legge invece di guardarlo: due riquadri di blocco affiancati diventano
     «42 %» quando si copiano o si ascoltano. Qui sono due pezzi in riga. */
  display:block;min-width:0;line-height:1}
/* La finestra che taglia deve stare larga quanto il carattere, non quanto la
   riga.
   
   Il numero e' Oswald a quaranta con l'interlinea stretta a .92: trentasette
   pixel di riga. Ma il disegno di Oswald, fra quello che sale e quello che
   scende, a quaranta ne occupa sessantaquattro — misurati, non stimati — e
   con la finestra che taglia addosso quei ventisette pixel di troppo non
   escono: vengono tagliati, e il numero si vede con la testa mozzata.
   
   Non si e' visto per un motivo che non fa onore a nessuno: Oswald arrivava
   da Google, e dove Google non si raggiunge — la macchina delle prove, per
   dirne una — il numero cadeva su un carattere di sistema che nella riga
   stretta ci sta. Adesso Oswald arriva sempre, quindi il taglio si vede
   sempre, ed e' giusto cosi': c'era gia' per chiunque avesse una linea che
   arriva a Google, e non per la macchina che lo doveva scoprire.
   
   Quello che si vede resta identico. La riga sale a 1.6 — tanto quanto il
   carattere occupa davvero — e un margine negativo uguale e contrario la
   riporta a 36,8: la scatola esterna e' quella di prima al pixel, quindi
   niente si sposta, e dentro c'e' finalmente il posto per il disegno intero.
   L'interlinea che tiene i numeri vicini non l'ha decisa la finestra: la
   decide il margine. */
:is(#dm-widgets,#dm-widget-popup) .dm-tile-value{
  max-width:100%;overflow:hidden;padding:0;margin:-13.6px 0;
  display:inline-flex;align-items:baseline;vertical-align:baseline;
  font-family:'Oswald','Inter',sans-serif;font-weight:200;font-size:40px;line-height:1.6;
  letter-spacing:-.02em;font-variant-numeric:tabular-nums;white-space:nowrap}
/* Una parola al posto di un numero si rimpicciolisce quanto basta a entrare
   intera: meglio leggerla tutta che leggerne meta' in grande. */
:is(#dm-widgets,#dm-widget-popup) .dm-tile-value[data-dm-len="medio"]{
  font-family:'Inter',sans-serif;font-weight:800;font-size:20px;letter-spacing:-.01em}
:is(#dm-widgets,#dm-widget-popup) .dm-tile-value[data-dm-len="lungo"]{
  font-family:'Inter',sans-serif;font-weight:800;font-size:16px;letter-spacing:0;
  white-space:normal;line-height:1.15;
  display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2}
:is(#dm-widgets,#dm-widget-popup) .dm-tile-unit{
  display:inline;margin-left:6px;font-style:normal;font-size:10.5px;font-weight:900;letter-spacing:.12em;
  text-transform:uppercase;color:var(--text-dim,#94a3b8)}
/* Il grado e la percentuale sono parte del numero, non un'etichetta: stanno
   attaccati e grandi quanto basta a leggerli. */
:is(#dm-widgets,#dm-widget-popup) .dm-tile-unit[data-simbolo="true"]{
  margin-left:1px;font-size:17px;font-weight:300;letter-spacing:0;
  font-family:'Oswald','Inter',sans-serif;color:var(--text-dim,#64748b)}
:is(#dm-widgets,#dm-widget-popup) .dm-tile-unit:empty{display:none}
/* Il numero gira come un contatore: si muovono solo le cifre che cambiano. */
:is(#dm-widgets,#dm-widget-popup) .dm-tile-value .dm-cifra{display:inline-block}
:is(#dm-widgets,#dm-widget-popup) .dm-tile-value .dm-cifra[data-verso="su"]{
  animation:dmCifraSu .46s cubic-bezier(.2,.9,.25,1) both}
:is(#dm-widgets,#dm-widget-popup) .dm-tile-value .dm-cifra[data-verso="giu"]{
  animation:dmCifraGiu .46s cubic-bezier(.2,.9,.25,1) both}
@keyframes dmCifraSu{0%{transform:translateY(70%);opacity:0}100%{transform:none;opacity:1}}
@keyframes dmCifraGiu{0%{transform:translateY(-70%);opacity:0}100%{transform:none;opacity:1}}

/* La terza riga: il dettaglio, e la misura che gli sta accanto. */
:is(#dm-widgets,#dm-widget-popup) .dm-tile-fondo{
  display:flex;align-items:center;gap:10px;min-width:0;margin-top:auto}
:is(#dm-widgets,#dm-widget-popup) .dm-tile-caption{
  flex:1;min-width:0;font-size:11px;font-weight:700;color:var(--text-dim,#94a3b8);
  white-space:nowrap;overflow:hidden;
  /* Sfuma sul bordo invece di tagliare: si capisce che il testo continua. */
  mask-image:linear-gradient(90deg,#000 84%,transparent);
  -webkit-mask-image:linear-gradient(90deg,#000 84%,transparent)}
:is(#dm-widgets,#dm-widget-popup) .dm-tile-scroll{display:inline-block;white-space:nowrap}
:is(#dm-widgets,#dm-widget-popup) .dm-tile-scroll[data-dm-scroll="true"]{
  animation:dmTileScroll var(--dm-scroll-dur,10s) ease-in-out infinite alternate;
  animation-delay:1.2s}
@keyframes dmTileScroll{
  0%,12%{transform:translateX(0)}
  88%,100%{transform:translateX(var(--dm-scroll-x,0))}}
@media(prefers-reduced-motion:reduce){
  :is(#dm-widgets,#dm-widget-popup) .dm-tile-scroll[data-dm-scroll="true"]{animation:none}
}
:is(#dm-widgets,#dm-widget-popup) .dm-tile-misura{
  flex:0 0 auto;display:flex;align-items:center}
/* I segmenti: quanti su quanti, senza leggere il numero. */
:is(#dm-widgets,#dm-widget-popup) .dm-tile-punti{display:flex;gap:3px}
:is(#dm-widgets,#dm-widget-popup) .dm-tile-punti i{
  width:8px;height:18px;border-radius:4px;
  background:color-mix(in srgb,var(--text,#0f172a) 9%,transparent);
  box-shadow:inset 0 1px 0 var(--dm-vetrino);
  transition:background .4s ease,box-shadow .4s ease}
:is(#dm-widgets,#dm-widget-popup) .dm-tile-punti i[data-on="true"]{
  background:linear-gradient(180deg,
    color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 78%,#fff),var(--dm-widget-accent,#0ea5e9));
  box-shadow:0 5px 10px -6px var(--dm-widget-accent,#0ea5e9),inset 0 1px 0 rgba(255,255,255,.5)}
/* La barra: il letto incavato e il pieno lucido. */
:is(#dm-widgets,#dm-widget-popup) .dm-tile-scala{
  position:relative;width:62px;height:5px;border-radius:99px;overflow:hidden;
  background:color-mix(in srgb,var(--text,#0f172a) 10%,transparent);
  box-shadow:inset 0 1px 2px rgba(15,23,42,.16)}
:is(#dm-widgets,#dm-widget-popup) .dm-tile-scala i{
  display:block;height:100%;border-radius:99px;
  background:linear-gradient(90deg,
    color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 55%,#fff),var(--dm-widget-accent,#0ea5e9));
  transition:width .5s cubic-bezier(.16,1,.3,1)}
/* La batteria: si riempie, col vetrino sopra e il polo di lato. */
:is(#dm-widgets,#dm-widget-popup) .dm-tile-batt{
  position:relative;display:flex;align-items:center;width:37px;height:18px;border-radius:6px;padding:2.6px;
  box-shadow:inset 0 0 0 1.8px color-mix(in srgb,var(--text,#0f172a) 20%,transparent),
             inset 0 1px 0 var(--dm-vetrino)}
:is(#dm-widgets,#dm-widget-popup) .dm-tile-batt::after{
  content:"";position:absolute;right:-4.5px;top:5px;width:3.4px;height:8px;border-radius:0 2px 2px 0;
  background:color-mix(in srgb,var(--text,#0f172a) 20%,transparent)}
:is(#dm-widgets,#dm-widget-popup) .dm-tile-batt i{
  display:block;height:100%;border-radius:3px;
  background:linear-gradient(180deg,
    color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 75%,#fff),var(--dm-widget-accent,#0ea5e9));
  transition:width .5s cubic-bezier(.16,1,.3,1)}

/* Sugli schermi stretti scala tutto insieme, invece di tagliare. */
@media(max-width:768px){
  :is(#dm-widgets,#dm-widget-popup) .dm-tile{padding:13px 13px 15px;min-height:110px;gap:9px}
  :is(#dm-widgets,#dm-widget-popup) .dm-tile-chip{flex-basis:36px;width:36px;height:36px;border-radius:13px}
  :is(#dm-widgets,#dm-widget-popup) .dm-tile-chip .dm-oggetto{width:23px;height:23px}
  :is(#dm-widgets,#dm-widget-popup) .dm-tile-cima{gap:9px}
  :is(#dm-widgets,#dm-widget-popup) .dm-tile-label{font-size:9.2px;letter-spacing:.07em}
  :is(#dm-widgets,#dm-widget-popup) .dm-tile-value{font-size:34px}
  :is(#dm-widgets,#dm-widget-popup) .dm-tile-caption{font-size:10.5px}
  :is(#dm-widgets,#dm-widget-popup) .dm-tile-scala{width:44px}
  :is(#dm-widgets,#dm-widget-popup) .dm-tile-punti i{width:6px;height:15px}
  :is(#dm-widgets,#dm-widget-popup) .dm-tile-batt{width:31px;height:16px}
}
@media(prefers-reduced-motion:reduce){
  :is(#dm-widgets,#dm-widget-popup) .dm-tile-alone,
  :is(#dm-widgets,#dm-widget-popup) .dm-tile[data-dm-accende]::after,
  :is(#dm-widgets,#dm-widget-popup) .dm-tile-chip[data-dm-sboccia],
  :is(#dm-widgets,#dm-widget-popup) .dm-tile-value .dm-cifra{animation:none}
}
:is(#dm-widgets) .dm-widgets-sub{
  overflow:hidden;white-space:nowrap;text-overflow:clip}
:is(#dm-widgets) .dm-sub-scroll{display:inline-block;will-change:transform}
:is(#dm-widgets) .dm-sub-scroll[data-dm-scroll="true"]{
  animation:dmTileScroll var(--dm-scroll-dur,12s) ease-in-out infinite alternate;
  animation-delay:1.6s}
@media(prefers-reduced-motion:reduce){
  :is(#dm-widgets) .dm-sub-scroll[data-dm-scroll="true"]{animation:none}
}
:is(#dm-widgets,#dm-widget-popup) .dm-widget-detail{
  grid-column:1/-1;position:relative;overflow:hidden;
  border:1px solid color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 26%,var(--card-border,#e8edf3));
  border-radius:20px;background:var(--card-bg,#fff);
  box-shadow:0 16px 36px rgba(15,23,42,.10);
  animation:dmWidgetIn .32s cubic-bezier(.16,1,.3,1)}
:is(#dm-widgets,#dm-widget-popup) .dm-widget-detail::before{
  content:"";position:absolute;top:0;left:0;right:0;height:3px;
  background:linear-gradient(90deg,transparent,var(--dm-widget-accent,#0ea5e9) 30%,var(--dm-widget-accent,#0ea5e9) 70%,transparent)}
@keyframes dmWidgetIn{from{opacity:0;transform:translateY(-7px) scale(.985)}to{opacity:1;transform:none}}
/* Questi override stanno DOPO la regola qui sopra, che a pari specificita'
 * vincerebbe per posizione: messi prima non si applicavano mai — ne' la
 * dissolvenza del telefono, ne' il rispetto di chi ha chiesto meno movimento
 * (osservazione giusta della review). */
@media(pointer:coarse){
  :is(#dm-widgets,#dm-widget-popup) .dm-widget-detail{animation:dmWidgetPopupIn .22s ease-out}
  /* E il velo sfocato dietro la card non si anima: ricomporre il fondale
   * sfumato a ogni fotogramma della dissolvenza e' il lavoro che sul telefono
   * faceva vibrare tutto lo sfondo. Il velo c'e' o non c'e'; a dissolversi
   * e' solo la card, che e' piccola. */
  #dm-widget-popup{animation:none}
}
@media(prefers-reduced-motion:reduce){
  :is(#dm-widgets,#dm-widget-popup) .dm-widget-detail{animation:none}
}
:is(#dm-widgets,#dm-widget-popup) .dm-w-head{display:flex;align-items:center;gap:9px;padding:13px 16px 10px}
:is(#dm-widgets,#dm-widget-popup) .dm-w-head-ic{font-size:16px}
:is(#dm-widgets,#dm-widget-popup) .dm-w-head strong{
  font-size:12.5px;font-weight:900;letter-spacing:1px;text-transform:uppercase}
:is(#dm-widgets,#dm-widget-popup) .dm-w-head small{flex:1;min-width:0;font-size:11px;font-weight:700;color:var(--text-dim,#94a3b8);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* Il tondino da 28px e' della tessera in griglia: dentro la finestra di
 * dettaglio il Chiudi e' la pillola scritta della testata, e questa regola —
 * che viene dopo — la schiacciava a 28px facendo traboccare la scritta
 * («la x con chiudi ancora sballato»). */
:is(#dm-widgets,#dm-widget-popup) .dm-w-close:not(.dm-widget-detail .dm-w-close){
  flex:0 0 28px;width:28px;height:28px;display:grid;place-items:center;border:0;border-radius:9px;
  background:var(--surface-3,#f1f5f9);color:var(--text-dim,#64748b);font-size:12px;cursor:pointer}
:is(#dm-widgets,#dm-widget-popup) .dm-w-body{display:grid;gap:2px;padding:0 10px 12px}
:is(#dm-widgets,#dm-widget-popup) .dm-w-row{
  display:flex;align-items:center;gap:11px;min-height:42px;padding:5px 8px;border-radius:12px;
  animation:none;
  transition:background .2s ease}
/* Le righe non hanno un ingresso loro: entra la finestra, tutta insieme.
 *
 * L'ingresso a sfalsamento era scritto su .dm-row, un nome che nel corpo
 * non esiste — le righe sono .dm-w-row — quindi non e' mai partito, e gli
 * sfalsamenti qui sotto ritardavano un'animazione che era none. Non si
 * ripara: righe che scivolano dentro una card che sta ancora salendo sono
 * un secondo movimento sopra il primo, cioe' il tremolio. Se ne va tutto. */
:is(#dm-widgets,#dm-widget-popup) .dm-w-row:hover{background:var(--surface-3,#f1f5f9)}
:is(#dm-widgets,#dm-widget-popup) .dm-w-glyph{flex:0 0 auto;font-size:15px;transition:filter .25s ease,opacity .25s ease}
:is(#dm-widgets,#dm-widget-popup) .dm-w-glyph[data-on="false"]{filter:grayscale(1);opacity:.4}
:is(#dm-widgets,#dm-widget-popup) .dm-w-appl-ic{
  flex:0 0 auto;display:grid;place-items:center;width:24px;height:24px;
  color:var(--dm-widget-accent,#06b6d4)}
:is(#dm-widgets,#dm-widget-popup) .dm-w-appl-ic svg{width:20px;height:20px;display:block;stroke:currentColor;fill:none}
:is(#dm-widgets,#dm-widget-popup) .dm-w-appl-ic svg [stroke],:is(#dm-widgets,#dm-widget-popup) .dm-w-appl-ic svg path,
:is(#dm-widgets,#dm-widget-popup) .dm-w-appl-ic svg rect,:is(#dm-widgets,#dm-widget-popup) .dm-w-appl-ic svg circle,
:is(#dm-widgets,#dm-widget-popup) .dm-w-appl-ic svg line{stroke:currentColor}
:is(#dm-widgets,#dm-widget-popup) .dm-w-appl-ic svg [fill="currentColor"]{fill:currentColor}
:is(#dm-widgets,#dm-widget-popup) .dm-w-alarm{display:inline-flex;gap:6px;margin-left:auto}
:is(#dm-widgets,#dm-widget-popup) .dm-w-alarm button{
  width:32px;height:28px;border-radius:9px;border:1px solid var(--card-border,#e2e8f0);
  background:var(--surface-2,#f8fafc);font-size:13px;line-height:1;cursor:pointer;
  transition:transform .15s ease,background .2s ease,border-color .2s ease,box-shadow .2s ease}
:is(#dm-widgets,#dm-widget-popup) .dm-w-alarm button:hover{transform:translateY(-1px)}
:is(#dm-widgets,#dm-widget-popup) .dm-w-alarm button[data-on="true"]{
  background:color-mix(in srgb,var(--dm-widget-accent,#10b981) 16%,transparent);
  border-color:var(--dm-widget-accent,#10b981);
  box-shadow:0 0 0 3px color-mix(in srgb,var(--dm-widget-accent,#10b981) 14%,transparent)}
:is(#dm-widgets,#dm-widget-popup) .dm-w-name{min-width:0;flex:1;display:grid;gap:0;font-size:13px;font-weight:700;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
:is(#dm-widgets,#dm-widget-popup) .dm-w-name small{font-size:10.5px;font-weight:700;color:var(--text-dim,#94a3b8)}
:is(#dm-widgets,#dm-widget-popup) .dm-w-val{flex:0 0 auto;font-family:'Oswald',sans-serif;font-size:14px;font-weight:600}
:is(#dm-widgets,#dm-widget-popup) .dm-w-empty{margin:4px 8px;font-size:12.5px;font-weight:700;color:var(--text-dim,#64748b)}
:is(#dm-widgets,#dm-widget-popup) .dm-w-block{padding:4px 6px 6px}
:is(#dm-widgets,#dm-widget-popup) .dm-w-block-title{
  display:block;padding:4px 2px 7px;font-size:10.5px;font-weight:900;letter-spacing:1px;
  text-transform:uppercase;color:var(--text-dim,#64748b)}

/* L'interruttore delle luci: una pillola che scatta. */
:is(#dm-widgets,#dm-widget-popup) .dm-w-switch{
  flex:0 0 40px;width:40px;height:23px;position:relative;border:0;border-radius:999px;cursor:pointer;
  background:color-mix(in srgb,var(--text-dim,#94a3b8) 32%,transparent);transition:background .25s ease}
:is(#dm-widgets,#dm-widget-popup) .dm-w-switch i{
  position:absolute;top:2.5px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;
  box-shadow:0 2px 6px rgba(15,23,42,.25);transition:transform .25s cubic-bezier(.16,1,.3,1)}
:is(#dm-widgets,#dm-widget-popup) .dm-w-switch[data-on="true"]{background:var(--dm-widget-accent,#f59e0b)}
:is(#dm-widgets,#dm-widget-popup) .dm-w-switch[data-on="true"] i{transform:translateX(16px)}
:is(#dm-widgets,#dm-widget-popup) .dm-w-power{
  flex:0 0 32px;width:32px;height:32px;display:grid;place-items:center;border-radius:50%;cursor:pointer;
  border:1.5px solid var(--card-border,#e8edf3);background:transparent;color:var(--text-dim,#94a3b8);
  font-size:14px;transition:all .25s ease}
:is(#dm-widgets,#dm-widget-popup) .dm-w-power[data-on="true"]{
  border-color:transparent;background:var(--dm-widget-accent,#0ea5e9);color:#fff;
  box-shadow:0 4px 12px color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 40%,transparent)}
/* Il disegno dell'accensione sta al centro e prende il colore del tasto. */
:is(#dm-widgets,#dm-widget-popup) .dm-w-power svg{display:block;width:17px;height:17px}
#dm-widget-popup .dm-w-row .dm-w-power{display:grid;place-items:center}
:is(#dm-widgets,#dm-widget-popup) .dm-w-position{
  appearance:none;-webkit-appearance:none;flex:0 0 auto;margin-left:5px;height:26px;
  width:34px;text-align:center;text-align-last:center;
  padding:0;border:1px solid var(--card-border,#e2e8f0);border-radius:9px;
  background:var(--surface-2,#f8fafc);color:var(--text,#0f172a);
  font:inherit;font-size:12px;font-weight:800;line-height:1;cursor:pointer;
  transition:border-color .2s ease,background .2s ease}
:is(#dm-widgets,#dm-widget-popup) .dm-w-position:hover{border-color:var(--dm-widget-accent,#8b5cf6)}
:is(#dm-widgets,#dm-widget-popup) .dm-w-arrows{display:inline-flex;gap:5px}
:is(#dm-widgets,#dm-widget-popup) .dm-w-arrows button{
  width:29px;height:29px;display:grid;place-items:center;border-radius:9px;cursor:pointer;
  border:1px solid var(--card-border,#e8edf3);background:var(--surface-3,#f1f5f9);
  color:var(--text,#0f172a);font-size:11px;transition:all .2s ease}
/* I tre comandi sono disegni, non caratteri: qui si dice solo quanto sono
   grandi, il colore lo prendono dalla riga come tutto il resto. */
:is(#dm-widgets,#dm-widget-popup) .dm-w-arrows button svg{display:block;width:15px;height:15px}
:is(#dm-widgets,#dm-widget-popup) .dm-w-more svg{display:block;width:15px;height:15px}
:is(#dm-widgets,#dm-widget-popup) .dm-w-more{display:grid;place-items:center}
:is(#dm-widgets,#dm-widget-popup) .dm-w-arrows button:hover{
  background:var(--dm-widget-accent,#8b5cf6);border-color:transparent;color:#fff}

/* Le miniature delle telecamere: il letterbox scuro del muro, in piccolo. */
:is(#dm-widgets,#dm-widget-popup) .dm-w-cams{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;padding:2px 6px 4px}
:is(#dm-widgets,#dm-widget-popup) .dm-w-cam{position:relative;margin:0;border-radius:14px;overflow:hidden;background:#0b1220;aspect-ratio:16/9}
:is(#dm-widgets,#dm-widget-popup) .dm-w-cam img{width:100%;height:100%;object-fit:cover;display:block;opacity:0;
  transition:opacity .4s ease,transform .6s cubic-bezier(.16,1,.3,1)}
:is(#dm-widgets,#dm-widget-popup) .dm-w-cam:hover img{transform:scale(1.06)}
:is(#dm-widgets,#dm-widget-popup) .dm-w-cam-live{
  display:inline-block;width:6px;height:6px;margin-right:6px;border-radius:50%;
  background:#f87171;vertical-align:1px;animation:dmWidgetLive 1.6s steps(1) infinite}
@keyframes dmWidgetLive{0%,100%{opacity:1}50%{opacity:.25}}
:is(#dm-widgets,#dm-widget-popup) .dm-w-cam img[data-dm-camera-state="ready"]{opacity:1}
:is(#dm-widgets,#dm-widget-popup) .dm-w-cam figcaption{
  position:absolute;left:0;right:0;bottom:0;padding:5px 9px;
  font-size:10.5px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:#e2eefb;
  background:linear-gradient(0deg,rgba(2,6,15,.72),transparent)}

/* Le voci ToDo dentro il dettaglio. */
/* ── il calendario (#259): un giorno per volta ─────────────────────────
 *
 * Stesso passo delle cose da fare — stessa spaziatura, stesso blocco col suo
 * titolo — perche' e' l'elenco a cui si e' chiesto di assomigliare. L'ora sta
 * a sinistra in colonna sua: incolonnata si legge di sfuggita, in mezzo al
 * titolo va cercata. */
/* I due pezzi dell'Agenda (#259): impegni sopra, cose da fare sotto. Il
   titolo di ognuno e' quello che li tiene distinti — mescolarli in un elenco
   solo darebbe righe che si somigliano e non fanno la stessa cosa. */
:is(#dm-widgets,#dm-widget-popup) .dm-ag-parte + .dm-ag-parte{
  margin-top:18px;padding-top:16px;border-top:1px solid var(--card-border,#e2e8f0)}
:is(#dm-widgets,#dm-widget-popup) .dm-ag-titolo{
  margin:0 0 10px;font-size:12px;font-weight:900;letter-spacing:.4px;
  color:var(--text-color,#0f172a)}
:is(#dm-widgets,#dm-widget-popup,#page-calendario) .dm-cal-lista{list-style:none;margin:0;padding:0 2px;display:grid;gap:9px}
:is(#dm-widgets,#dm-widget-popup,#page-calendario) .dm-cal-evento{
  display:flex;align-items:flex-start;gap:11px;min-width:0}
:is(#dm-widgets,#dm-widget-popup,#page-calendario) .dm-cal-ora{
  flex:0 0 auto;min-width:78px;font-size:11.5px;font-weight:800;line-height:1.5;
  font-variant-numeric:tabular-nums;color:var(--text-dim,#64748b);padding-top:1px}
:is(#dm-widgets,#dm-widget-popup,#page-calendario) .dm-cal-testo{display:grid;gap:1px;min-width:0;flex:1}
:is(#dm-widgets,#dm-widget-popup,#page-calendario) .dm-cal-testo b{
  font-size:13px;font-weight:800;line-height:1.35;overflow-wrap:anywhere}
:is(#dm-widgets,#dm-widget-popup,#page-calendario) .dm-cal-testo small{
  font-size:11px;font-weight:700;color:var(--text-dim,#94a3b8);overflow-wrap:anywhere}
/* Quello che sta succedendo adesso si stacca dagli altri: e' la riga per cui
   si e' aperta la finestra. */
:is(#dm-widgets,#dm-widget-popup,#page-calendario) .dm-cal-evento[data-adesso="true"] .dm-cal-ora,
:is(#dm-widgets,#dm-widget-popup,#page-calendario) .dm-cal-evento[data-adesso="true"] .dm-cal-testo b{
  color:var(--dm-widget-accent,#6366f1)}
/* Il fondo del pannello, dove sta il tasto per segnare un impegno nuovo. */
:is(#dm-widgets,#dm-widget-popup,#page-calendario) .dm-cal-fondo{display:flex;justify-content:center;padding:6px 0 2px}
/* Una scadenza dentro l'agenda (#259): la casella al posto dei tasti, e la
   parola «Da fare» dove gli altri hanno l'ora. Si vede che e' un'altra cosa
   senza doverla leggere. */
:is(#dm-widgets,#dm-widget-popup,#page-calendario) .dm-cal-evento[data-scadenza="true"] .dm-cal-ora{
  color:var(--dm-widget-accent,#6366f1);opacity:.85}
:is(#dm-widgets,#dm-widget-popup,#page-calendario) .dm-cal-evento[data-scadenza="true"] .dm-todo-check{
  margin-top:0;flex:0 0 19px;width:19px;height:19px}
/* Quello che e' scaduto: il blocco si stacca dagli altri, perche' e' la riga
   per cui si apre l'agenda. */
:is(#dm-widgets,#dm-widget-popup,#page-calendario) .dm-w-block[data-dm-ritardo="true"] .dm-w-block-title{
  color:#b91c1c}
:is(#dm-widgets,#dm-widget-popup,#page-calendario) .dm-w-block[data-dm-ritardo="true"] .dm-cal-ora{
  color:#b91c1c;opacity:1}
:is(#dm-widgets,#dm-widget-popup,#page-calendario) .dm-cal-adesso{
  flex:0 0 auto;align-self:center;padding:3px 9px;border-radius:999px;
  font-size:9.5px;font-weight:900;letter-spacing:.8px;text-transform:uppercase;color:#fff;
  background:var(--dm-widget-accent,#6366f1)}
:is(#dm-widgets,#dm-widget-popup,#page-calendario) .dm-todo-items{list-style:none;margin:0;padding:0 2px;display:grid;gap:8px}
:is(#dm-widgets,#dm-widget-popup,#page-calendario) .dm-todo-item{display:flex;align-items:flex-start;gap:10px;min-width:0}
:is(#dm-widgets,#dm-widget-popup,#page-calendario) .dm-todo-check{
  position:relative;flex:0 0 21px;width:21px;height:21px;margin-top:1px;border-radius:50%;cursor:pointer;
  border:2px solid color-mix(in srgb,var(--text-dim,#94a3b8) 55%,transparent);background:transparent;padding:0;
  transition:border-color .2s ease,background .25s ease,transform .15s ease}
:is(#dm-widgets,#dm-widget-popup,#page-calendario) .dm-todo-check:hover{border-color:var(--dm-widget-accent,#059669);transform:scale(1.08)}
:is(#dm-widgets,#dm-widget-popup,#page-calendario) .dm-todo-check::after{
  content:"✓";position:absolute;inset:0;display:grid;place-items:center;
  color:#fff;font-size:12px;font-weight:900;opacity:0;transform:scale(.4);
  transition:opacity .2s ease,transform .25s cubic-bezier(.16,1,.3,1)}
:is(#dm-widgets,#dm-widget-popup,#page-calendario) .dm-todo-item.is-done .dm-todo-check{
  border-color:var(--dm-widget-accent,#059669);background:var(--dm-widget-accent,#059669)}
:is(#dm-widgets,#dm-widget-popup,#page-calendario) .dm-todo-item.is-done .dm-todo-check::after{opacity:1;transform:scale(1)}
/* Il testo si prende lo spazio che avanza, cosi' la matita e il cestino
   restano insieme a destra: senza, la matita resta attaccata alla parola e il
   cestino se ne va da solo in fondo. */
:is(#dm-widgets,#dm-widget-popup,#page-calendario) .dm-todo-text{flex:1;min-width:0;font-size:13.5px;font-weight:600;line-height:1.4;overflow-wrap:anywhere}
:is(#dm-widgets,#dm-widget-popup,#page-calendario) .dm-todo-item.is-done .dm-todo-text{color:var(--text-dim,#94a3b8);text-decoration:line-through}
:is(#dm-widgets,#dm-widget-popup,#page-calendario) .dm-todo-due{
  display:inline-flex;align-items:center;gap:3px;margin-left:7px;padding:1px 7px;border-radius:999px;
  background:var(--surface-3,#f1f5f9);border:1px solid var(--card-border,#e8edf3);
  font-size:10.5px;font-weight:800;color:var(--text-dim,#64748b);white-space:nowrap;vertical-align:1px}
:is(#dm-widgets,#dm-widget-popup,#page-calendario) .dm-todo-due[data-overdue="true"]{
  background:rgba(244,63,94,.10);border-color:rgba(244,63,94,.30);color:#be123c}

@media (prefers-reduced-motion:reduce){
  :is(#dm-widgets,#dm-widget-popup) .dm-tile,:is(#dm-widgets,#dm-widget-popup) .dm-tile-chevron,:is(#dm-widgets,#dm-widget-popup,#page-calendario) .dm-todo-check,
  :is(#dm-widgets,#dm-widget-popup,#page-calendario) .dm-todo-check::after,:is(#dm-widgets,#dm-widget-popup) .dm-w-switch,:is(#dm-widgets,#dm-widget-popup) .dm-w-switch i,
  :is(#dm-widgets,#dm-widget-popup) .dm-tile-chip,:is(#dm-widgets,#dm-widget-popup) .dm-w-cam img,
  :is(#dm-widgets,#dm-widget-popup) .dm-tile .dm-tile-shine{transition:none}
  :is(#dm-widgets,#dm-widget-popup) .dm-widget-detail,:is(#dm-widgets,#dm-widget-popup) .dm-tile,:is(#dm-widgets,#dm-widget-popup) .dm-w-row,
  :is(#dm-widgets,#dm-widget-popup) .dm-tile[data-alert="true"] .dm-tile-chip::after,
  :is(#dm-widgets,#dm-widget-popup) .dm-w-cam-live{animation:none}
}
@media (max-width:520px){
  :is(#dm-widgets,#dm-widget-popup) .dm-widgets-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
}
${regoleCompatte()}
`,
  );
}

/* La modalita' compatta «C4» (#224): il design approvato, riprodotto pari.
 *
 * La tessera diventa una pillola coricata: due colonne, quarantotto pixel
 * d'altezza, raggio quattordici. Dentro, tre cose sole — il chip neutro con
 * l'oggetto, il nome in maiuscoletto pieno, il valore ancorato a destra — e
 * sul fianco sinistro la tacca a semipillola col colore della sezione, fusa
 * nel bordo. Le didascalie e le misure spariscono: la pillola e' il colpo
 * d'occhio, il resto vive nel popup, che non cambia.
 *
 * Le stesse regole valgono due volte — sempre, e in «auto» solo sotto i 520
 * pixel — quindi si scrivono una volta sola qui e si stampano con la radice
 * giusta. I selettori portano `[data-acceso]` esplicito dove serve vincere in
 * specificita': le vesti di base delle tessere accese e aperte pesano
 * (1,2,1), e una radice sola non basterebbe a coprirle. */
function regoleCompatteCon(radice) {
  return `
/* Due colonne fitte: la compatta serve a far stare tutto sopra la piega. */
${radice} .dm-widgets-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
/* La pillola: piatta, una sola ombra morbida e l'hairline — niente gradienti,
   niente grana. [data-acceso] c'e' su ogni tessera, e serve a battere la
   veste colorata di quelle accese o aperte. */
${radice} .dm-tile,
${radice} .dm-tile[data-acceso],
${radice} .dm-tile[data-open]{
  flex-direction:row;align-items:center;gap:9px;
  min-height:48px;padding:0 12px 0 13px;border-radius:14px;
  background:var(--card-bg,#fff);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb,var(--text,#0f172a) 8%,transparent),
    0 10px 20px -16px rgba(15,23,42,.5)}
${radice} .dm-tile::before{display:none}
/* L'alone non sparisce: e' il respiro degli avvisi — «un avviso che non si
   sa leggere si muove lo stesso» — e spegnerlo qui lasciava le pillole
   d'avviso immobili proprio sui telefoni, dove la compatta e' di casa.
   Nella pillola si fa velo: aderisce al bordo, prende il colore d'avviso
   appena accennato e continua a pulsare con dmTileRespiro. Per le pillole
   senza avviso resta a opacita' zero com'e' sempre stato. */
${radice} .dm-tile .dm-tile-alone{
  inset:0;height:auto;border-radius:inherit;
  background:color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 14%,transparent)}
/* La tacca d'accento: una semipillola di 4×21 fusa nel bordo sinistro, col
   colore della sezione. animation:none perche' ::after e' anche la lama
   dell'accensione, che nella pillola non ha posto. */
${radice} .dm-tile[data-acceso]::after{
  content:"";position:absolute;left:0;top:50%;width:4px;height:21px;
  margin-top:-10.5px;border-radius:0 4px 4px 0;
  background:var(--dm-widget-accent,#0ea5e9);
  transform:none;animation:none;pointer-events:none}
/* La prima riga si scioglie: chip e nome diventano figli della pillola. */
${radice} .dm-tile-cima{display:contents}
/* Il chip: trenta pixel, cuscinetto neutro con la sola hairline — il colore
   nella pillola ce lo mette la tacca, non il chip. */
${radice} .dm-tile[data-acceso] .dm-tile-chip,
${radice} .dm-tile[data-open] .dm-tile-chip{
  flex:0 0 30px;width:30px;height:30px;border-radius:10px;font-size:15px;
  background:var(--surface-2,#f8fafc);
  box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--text,#0f172a) 9%,transparent)}
${radice} .dm-tile-chip .dm-oggetto{width:19px;height:19px;filter:none}
/* Il nome: maiuscoletto minuto in inchiostro pieno, non smorzato — a questa
   misura il grigio non si leggerebbe. */
${radice} .dm-tile-label{
  font-size:8.8px;line-height:1.2;letter-spacing:.09em;
  color:var(--text,#0f172a)}
/* Il valore, ancorato a destra col suo margine ottico di 12px (il cuscino
   destro della pillola). Il margine a zero annulla il -13.6px pensato per
   Oswald a corpo 40: qui il valore e' Inter, e quel margine lo decapitava. */
${radice} .dm-tile-val{
  display:flex;align-items:baseline;flex:0 0 auto;min-width:0;max-width:55%;
  margin-left:auto}
${radice} .dm-tile-value,
${radice} .dm-tile-value[data-dm-len="medio"],
${radice} .dm-tile-value[data-dm-len="lungo"]{
  display:inline-flex;margin:0;padding:0;
  font-family:'Inter',sans-serif;font-weight:800;font-size:15.5px;line-height:1.15;
  letter-spacing:-.01em;font-variant-numeric:tabular-nums;white-space:nowrap;
  -webkit-line-clamp:unset;color:var(--text,#0f172a)}
/* L'unita'-parola: otto pixel, smorzata. */
${radice} .dm-tile-unit{
  margin-left:4px;font-family:'Inter',sans-serif;font-size:8px;font-weight:800;
  letter-spacing:.08em;color:var(--text-dim,#94a3b8)}
/* Il grado e la percentuale vanno in apice, come sui quadranti veri. */
${radice} .dm-tile-unit[data-simbolo="true"]{
  align-self:flex-start;margin-left:1px;font-size:9.5px;font-weight:800;
  line-height:1.5;letter-spacing:0;color:var(--text-dim,#64748b)}
/* Didascalie e misure non ci sono: la pillola dice il nome e il numero. */
${radice} .dm-tile-fondo{display:none}
/* La pillola d'avviso: il velo piatto del colore d'avviso al 10%, l'hairline
   in tinta, la tacca piu' spessa e il valore in tinta scura. Niente gradienti
   ne' alone animato: l'avviso si legge, non lampeggia. */
${radice} .dm-tile[data-alert="true"]{
  background:color-mix(in srgb,var(--dm-widget-accent,#e11d48) 10%,var(--card-bg,#fff));
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb,var(--dm-widget-accent,#e11d48) 30%,transparent),
    0 10px 20px -16px rgba(15,23,42,.5)}
${radice} .dm-tile[data-alert="true"]::after{width:5px;height:27px;margin-top:-13.5px}
${radice} .dm-tile[data-alert="true"] .dm-tile-value{
  color:color-mix(in srgb,var(--dm-widget-accent,#e11d48) 68%,#0f172a)}`;
}

/* Le due radici della compatta: «sempre» vale ovunque, «auto» solo dove lo
 * spazio manca — la media query e' la stessa che gia' stringe la griglia. */
function regoleCompatte() {
  return `${regoleCompatteCon('#dm-widgets[data-dm-compatto="sempre"]')}
@media (max-width:520px){${regoleCompatteCon('#dm-widgets[data-dm-compatto="auto"]')}
}`;
}

export function installHomeWidgetsSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  /* Il modulo del calendario ridisegna la finestra quando si apre, si chiude o
   * si lamenta, e ci fa rileggere gli eventi dopo ogni scrittura: e' lui che
   * sa quando qualcosa e' cambiato, non noi. */
  registraOspiteCalendario(() => schedule());
  registraRilettura((opzioni) => {
    aggiornaCalendari(opzioni);
    /* Dopo una modifica si rileggono anche le voci: una scadenza spostata
     * cambia il giorno in cui la riga compare, e senza rilettura resterebbe
     * dov'era finche' non cambia qualcos'altro. */
    for (const list of configuredTodoLists()) fetchItems(list.entity, { force: true });
  });
  doc.addEventListener("click", onClick);
  bindEscape();
  doc.addEventListener("change", onChange);
  doc.addEventListener("input", onInput);
  doc.addEventListener("keydown", onKeydown);
  for (const eventName of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:persistence-restored",
    "dashboardmodern:config-reset",
    "dashboardmodern:state-changed",
    // Una tapparella appena aggiunta in configurazione deve avere la sua
    // tessera subito, non al prossimo evento di stato.
    "dashboardmodern:editor-rendered",
    /* La coda delle segnalazioni arriva da GitHub, quindi dopo che la Home si
       e' gia' disegnata: la sua tessera va messa quando la risposta atterra,
       non al primo evento che passi di li' per un'altra ragione. */
    "dashboardmodern:segnalazioni-coda",
    /* La chat di assistenza dice quando ha una risposta da leggere, e quando
       e' stata letta: la sua tessera compare e sparisce con quello. */
    "dashboardmodern:chat-stato",
  ])
    root.addEventListener?.(eventName, schedule);
  ascoltaLaPorta();
  /* La storia delle ore precedenti arriva quando arriva, e la finestra non
   * l'aspetta per aprirsi: si apre col numero che c'e' gia'. Quando la
   * risposta atterra, pero', il racconto ha due righe in piu' da dire — «piu'
   * alto del solito per quest'ora», «ci arriva fra un'ora» — e vanno mostrate
   * senza che l'utente debba chiudere e riaprire. */
  quandoArrivaLoStorico(schedule);
  // Il numero delle voci aperte E' lo stato dell'entita': quando cambia, le
  // voci vanno rilette — la spunta fatta da un altro dispositivo arriva cosi'.
  root.addEventListener?.("dashboardmodern:state-changed", (event) => {
    if (!stateChangeTouchesTodo(event)) return;
    for (const list of configuredTodoLists()) fetchItems(list.entity, { force: true });
  });
  root.addEventListener?.("dashboardmodern:state-changed", (event) => {
    if (!ilCambioTocaUnCalendario(event)) return;
    aggiornaCalendari({ force: true });
  });
  doc.addEventListener(
    "click",
    (event) => {
      if (event.target?.closest?.(".tab[data-tab]")) schedule();
    },
    true,
  );
  doc.addEventListener("visibilitychange", () => schedule());
  /* Girando il telefono le tessere cambiano larghezza: i nomi che erano stati
   * stretti per entrare vanno rimisurati, se no restano stretti per sempre. */
  let rimisura = 0;
  root.addEventListener?.("resize", () => {
    root.clearTimeout?.(rimisura);
    rimisura = root.setTimeout?.(() => sistemaLeScritte(doc.getElementById("dm-widgets")), 140);
  });
  /* Il ritardo di fine ciclo scade in silenzio: l'elettrodomestico ha smesso
   * di consumare, e nessun cambio di stato arriva ad avvisare la tessera. */
  onRunHoldExpiry(() => schedule());
  schedule();
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", () => installHomeWidgetsSection(), { once: true });
} else {
  installHomeWidgetsSection();
}
