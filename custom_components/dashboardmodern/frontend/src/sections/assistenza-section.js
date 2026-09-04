/* La chat di assistenza: una porta diretta, che non passa da GitHub.
 *
 * «Io avevo chiesto una chat di assistenza che non deve passare per github.
 *  E' come se fosse una chat Teams.»
 *
 * Le Segnalazioni aprono una issue pubblica, ed e' giusto: un difetto deve
 * restare scritto e ritrovabile. Chiedere aiuto e' un'altra cosa — si incolla
 * un pezzo di configurazione, il nome delle proprie entita', a volte una foto
 * di casa — e non si puo' chiedere di farlo su una pagina pubblica con un
 * account che magari non si ha.
 *
 * Questa e' quella porta. Sotto ci sta il centralino (`centralino/`), che e'
 * il punto d'incontro fra due case che altrimenti non si parlerebbero; il
 * progetto intero in `docs/CHAT.md`. Qui non arriva nessun segreto: la casa si
 * riconosce nel backend, e di qui passano solo le parole di una persona.
 *
 * Due scelte di forma, tutte e due volute.
 *
 * **Una finestra, non una pagina.** Il Cruscotto e' una pagina perche' e' una
 * coda da lavorare — si filtra, si scorre, si apre un filo per volta. Una chat
 * e' una colonna di frasi e una casella sotto: sta in una finestra, e chi
 * scrive non deve cambiare pagina per farlo.
 *
 * **La stessa finestra per tutti e due.** Chi chiede vede la propria
 * conversazione; chi risponde vede l'elenco delle conversazioni e ne apre una.
 * Sono la stessa cosa guardata dai due capi, e due finestre gemelle da tenere
 * uguali sarebbero due finestre che un giorno divergono.
 */
import {
  EVENTO_DI_CASA,
  EVENTO_STATO,
  eUnEventoDellaChat,
  statoDellaChat as letturaDelloStato,
} from "../core/avviso-chat.js";
import { getLocale } from "../core/i18n.js";
import { clean, doc, esc, installStyle, lexicalGlobal, root, t } from "./shared.js";

const WS_STATE = "dashboardmodern/chat/state";
const WS_THREAD = "dashboardmodern/chat/thread";
const WS_SEND = "dashboardmodern/chat/send";
const WS_FORGET = "dashboardmodern/chat/forget";
const WS_QUEUE = "dashboardmodern/chat/queue";
const WS_OPEN = "dashboardmodern/chat/open";
const WS_ANSWER = "dashboardmodern/chat/answer";
const WS_DROP = "dashboardmodern/chat/drop";

/* Esportati perche' una prova li tenga accanto all'allowlist del ponte. Un
 * tipo non elencato la' non arriva a Home Assistant e la finestra risponde
 * «Message type not permitted through the bridge»: e' un refuso che si vede
 * solo in un browser vero, quindi si guarda in una prova. */
export const WS_TYPES = Object.freeze([
  WS_STATE,
  WS_THREAD,
  WS_SEND,
  WS_FORGET,
  WS_QUEUE,
  WS_OPEN,
  WS_ANSWER,
  WS_DROP,
]);

/** Lo stesso tetto che il backend e il centralino applicano. */
export const MAX_TESTO = 4000;

const state = {
  installed: false,
  enabled: false,
  console: false,
  opened: false,
  name: "",
  unread: 0,
  /* L'ultima risposta non letta, in breve, e quando e' arrivata: sono quello
   * che la tessera in Home mostra prima che qualcuno apra la finestra. */
  preview: "",
  writtenAt: 0,
  messages: [],
  conversazioni: [],
  linea: "",
  filo: [],
  tab: "mia",
  busy: false,
  avviso: "",
  /* La conversazione col cestino gia' armato: il primo tocco arma, il secondo
   * cancella. Una sola, perche' armarne due insieme vorrebbe dire due tasti
   * rossi accanto e nessuno che sappia piu' quale stava per premere. */
  daButtare: "",
  /* Quello che si sta scrivendo, perche' un ridisegno non se lo porti via. */
  bozza: "",
};

/** La lingua che questa plancia sta mostrando, non quella del server. */
function lingua() {
  try {
    return clean(getLocale()) || "";
  } catch (_errore) {
    return "";
  }
}

function broker() {
  return root.DashboardModernEnergyService?.broker || null;
}

async function chiedi(type, payload = {}) {
  const canale = broker();
  if (typeof canale?.request !== "function") {
    throw new Error(t("Plancia non collegata.", "Dashboard not connected."));
  }
  return canale.request({ type, ...payload });
}

/* ─── Quello che si vede ────────────────────────────────────────────────── */

/** L'ora di un messaggio, come la si legge in una chat: breve. */
export function quando(scrittoIl) {
  const numero = Number(scrittoIl) || 0;
  if (!numero) return "";
  const data = new Date(numero);
  const oggi = new Date();
  const stessoGiorno =
    data.getFullYear() === oggi.getFullYear() &&
    data.getMonth() === oggi.getMonth() &&
    data.getDate() === oggi.getDate();
  const ora = data.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return stessoGiorno ? ora : `${data.toLocaleDateString()} ${ora}`;
}

/* Il prezzo, detto prima che qualcuno scriva la prima riga.
 *
 * Non e' una formalita' e non sta in fondo: chi sta per raccontare un guaio di
 * casa propria ha diritto di sapere dove finisce quello che scrive prima di
 * scriverlo, non dopo. E la promessa di poter cancellare e' mantenuta dal
 * tasto qui sotto, che cancella anche dal centralino — non solo dallo schermo. */
export function avvertenzaMarkup() {
  return `
    <div class="dm-chat-patto">
      <div class="dm-chat-patto-ico" aria-hidden="true">🔒</div>
      <div>${esc(
        t(
          "Quello che scrivi qui arriva a chi mantiene la plancia, e a nessun altro. Non passa da GitHub e non diventa pubblico. Insieme al messaggio partono solo la versione della plancia, quella di Home Assistant e la lingua. Puoi cancellare la conversazione quando vuoi.",
          "What you write here reaches whoever maintains the dashboard, and nobody else. It does not go through GitHub and does not become public. Along with the message only the dashboard version, the Home Assistant version and the language are sent. You can delete the conversation whenever you want.",
        ),
      )}</div>
    </div>`;
}

/* Un messaggio, dalla parte giusta.
 *
 * «Mio» dipende da chi guarda, e questa finestra la guardano in due. Nella
 * propria conversazione le proprie frasi sono quelle della casa; nella coda di
 * chi risponde sono quelle della console — e li' il verso era rovesciato: le
 * domande della casa comparivano a destra e in verde, come se se le fosse
 * scritte da solo chi stava leggendo, e le proprie risposte a sinistra e in
 * grigio. Una conversazione letta al contrario. */
export function messaggioMarkup(riga, dallaConsole = false) {
  const daConsole = clean(riga?.da) === "console";
  const mio = dallaConsole ? daConsole : !daConsole;
  const ora = quando(riga?.scritto_il);
  return `
    <div class="dm-chat-riga ${mio ? "mia" : "sua"}">
      <div class="dm-chat-bolla">
        <div class="dm-chat-testo">${esc(clean(riga?.testo))}</div>
        ${ora ? `<div class="dm-chat-ora">${esc(ora)}</div>` : ""}
      </div>
    </div>`;
}

/* La conversazione, o il suo posto vuoto.
 *
 * Il vuoto non e' una schermata bianca: e' l'invito a scrivere la prima riga,
 * perche' una chat vuota e una chat rotta si somigliano troppo. */
export function filoMarkup(messaggi, dallaConsole = false) {
  const righe = Array.isArray(messaggi) ? messaggi : [];
  if (!righe.length) {
    return `
      <div class="dm-chat-vuoto">
        <div class="dm-chat-vuoto-ico" aria-hidden="true">💬</div>
        <div>${esc(
          t(
            "Scrivi pure: dall'altra parte c'e' una persona, non un modulo.",
            "Go ahead and write: on the other side there is a person, not a form.",
          ),
        )}</div>
      </div>`;
  }
  return `<div class="dm-chat-filo" data-dm-chat="filo">${righe
    .map((riga) => messaggioMarkup(riga, dallaConsole))
    .join("")}</div>`;
}

/* La casella, con dentro quello che si stava scrivendo.
 *
 * La bozza si tiene nello stato e si ristampa a ogni ridisegno. Prima no: il
 * ridisegno che accende la rotella rifaceva tutto il corpo della finestra, e la
 * casella tornava vuota mentre la richiesta era ancora per aria. Se poi quella
 * falliva — Home Assistant occupato, centralino irraggiungibile — compariva
 * l'errore e sotto una casella pulita: chi aveva appena incollato mezzo file di
 * configurazione doveva riscriverlo per riprovare, che e' il modo piu' sicuro
 * di far smettere di riprovare. */
/* ─── Le emoji ──────────────────────────────────────────────────────────
 *
 * «Ecco mancano le emoji :) :) :)»
 *
 * Una chat di assistenza le vuole per la ragione per cui le vuole qualunque
 * chat: una frase scritta di corsa suona piu' secca di com'e' stata pensata, e
 * chi legge dall'altra parte non ha il tono di voce per correggerla. Un pollice
 * in su chiude uno scambio meglio di «ok».
 *
 * L'elenco e' corto e scelto, non un catalogo: in una finestra di assistenza
 * servono facce, mani, e le cose di casa di cui si sta parlando. Un catalogo
 * intero vorrebbe dire una ricerca, una tastiera e un pannello che copre la
 * conversazione — e mille segni per trovarne cinque.
 *
 * Niente tonalita' di pelle e niente sequenze composte: un'emoji sola per
 * segno, che e' quello che il campo e il centralino si passano senza sorprese.
 */
export const EMOJI_DELLA_CHAT = Object.freeze([
  "🙂",
  "😀",
  "😅",
  "😉",
  "😊",
  "🤔",
  "😐",
  "😕",
  "😢",
  "😱",
  "👍",
  "👎",
  "🙏",
  "👏",
  "💪",
  "🤝",
  "👋",
  "🤞",
  "✅",
  "❌",
  "⚠️",
  "❓",
  "❗",
  "💡",
  "🔧",
  "🔌",
  "🔋",
  "📷",
  "📎",
  "🏠",
  "🚗",
  "☀️",
  "🌧️",
  "🔥",
  "❄️",
  "💧",
  "🎉",
  "❤️",
  "⏳",
  "📅",
]);

/**
 * Il testo con dentro l'emoji, e dove va a finire il cursore.
 *
 * Si mette dove sta il cursore e non in fondo: chi ha scritto una frase e
 * torna indietro a metterci una faccia si aspetta che vada li'. Con del testo
 * selezionato l'emoji lo sostituisce, che e' quello che fa qualunque campo.
 *
 * E il tetto si rispetta prima di scrivere, non dopo: il campo ha un massimo,
 * e un'emoji che lo sfonda deve non entrare — non entrare a meta', che
 * significherebbe spezzare un segno in due pezzi che non vogliono dire niente.
 */
export function conLEmoji(testo = "", emoji = "", inizio = null, fine = null, massimo = Infinity) {
  const base = String(testo ?? "");
  const segno = String(emoji ?? "");
  const dentro = (valore, difetto) =>
    Number.isInteger(valore) && valore >= 0 ? Math.min(valore, base.length) : difetto;
  const da = dentro(inizio, base.length);
  const a = Math.max(da, dentro(fine, da));
  if (!segno) return { testo: base, cursore: a, pieno: false };
  const prossimo = `${base.slice(0, da)}${segno}${base.slice(a)}`;
  if (prossimo.length > massimo) return { testo: base, cursore: a, pieno: true };
  return { testo: prossimo, cursore: da + segno.length, pieno: false };
}

function emojiMarkup() {
  return `
    <div class="dm-chat-emoji" data-dm-chat="emoji" hidden>
      ${EMOJI_DELLA_CHAT.map(
        (segno) =>
          `<button type="button" class="dm-chat-emoji-uno" data-dm-emoji="${esc(segno)}"
             tabindex="-1" aria-label="${esc(segno)}">${esc(segno)}</button>`,
      ).join("")}
    </div>`;
}

function casellaMarkup(dove) {
  const bozza = state.bozza || "";
  const rimasti = MAX_TESTO - bozza.length;
  return `
    <div class="dm-chat-campo">
      <textarea id="${dove}" rows="3" maxlength="${MAX_TESTO}" placeholder="${esc(
        t("Scrivi il tuo messaggio…", "Write your message…"),
      )}">${esc(bozza)}</textarea>
      ${emojiMarkup()}
      <div class="dm-chat-sotto">
        <button type="button" class="dm-chat-emoji-apri" data-dm-chat="emoji-apri"
          aria-expanded="false" aria-label="${esc(t("Metti un'emoji", "Add an emoji"))}"
          title="${esc(t("Metti un'emoji", "Add an emoji"))}">🙂</button>
        <span class="dm-chat-rimasti" data-dm-chat="rimasti">${rimasti}</span>
        <button type="button" class="dm-chat-btn" data-dm-chat="manda"
          ${state.busy ? "disabled" : ""}>${esc(
            state.busy ? t("Invio…", "Sending…") : t("Manda", "Send"),
          )}</button>
      </div>
    </div>`;
}

function avvisoMarkup() {
  if (!state.avviso) return "";
  const male = state.avviso.startsWith("!");
  return `<div class="dm-chat-avviso${male ? " male" : ""}">${esc(
    male ? state.avviso.slice(1) : state.avviso,
  )}</div>`;
}

/* Come farsi chiamare.
 *
 * Il centralino ha sempre avuto il campo, lo schema una colonna e il documento
 * la frase «chi vuole farsi chiamare per nome puo' scriverlo» — e in tutto
 * questo non c'era **nessun posto dove scriverlo**. Ogni messaggio partiva
 * senza nome, e chi risponde vedeva una coda di `casa_9f3a…` tutte uguali,
 * indistinguibili anche quando erano tre conversazioni di tre persone diverse.
 *
 * Facoltativo davvero: si lascia vuoto e non succede niente, e chi lo compila
 * non deve premere Salva — il nome parte col messaggio dopo. Sta sopra la
 * casella e non dentro un menu, perche' una cosa che si scrive una volta sola
 * nascosta in un menu non la trova nessuno. */
function nomeMarkup() {
  return `
    <div class="dm-chat-nome">
      <label for="dm-chat-comechiamo">${esc(
        t("Come ti chiami (facoltativo)", "Your name (optional)"),
      )}</label>
      <input id="dm-chat-comechiamo" type="text" maxlength="60"
        value="${esc(state.name)}" placeholder="${esc(
          t("Lascia vuoto se preferisci", "Leave empty if you prefer"),
        )}">
    </div>`;
}

/* La mia conversazione. */
function miaMarkup() {
  const patto = state.messages.length ? "" : avvertenzaMarkup();
  const cancella = state.messages.length
    ? `<div class="dm-chat-azioni">
         <button type="button" class="dm-chat-btn chiaro" data-dm-chat="cancella">${esc(
           t("Cancella la conversazione", "Delete the conversation"),
         )}</button>
       </div>`
    : "";
  return `${patto}${filoMarkup(state.messages)}${nomeMarkup()}${casellaMarkup(
    "dm-chat-mio",
  )}${cancella}`;
}

/* Il cestino di una conversazione, per chi risponde.
 *
 * Due tocchi e non uno. Una conversazione cancellata non si rimette a posto —
 * sparisce dal centralino e dalla plancia di quella casa — e un cestino che
 * cancella al primo tocco, in un elenco dove si scorre col dito, e' un cestino
 * che prima o poi butta via la conversazione sbagliata. Il primo tocco arma e
 * chiede conferma sul tasto stesso; il secondo cancella.
 *
 * `lungo` e' per quando il tasto sta da solo sopra un filo aperto, dove una
 * paletta senza parole non direbbe di quale conversazione si parla. */
function buttaMarkup(linea, lungo = false) {
  const armato = state.daButtare === linea;
  const titolo = t("Cancella la conversazione", "Delete the conversation");
  const scritta = armato ? t("Confermi?", "Confirm?") : lungo ? titolo : "🗑";
  return `
    <button type="button" class="dm-chat-butta${armato ? " armato" : ""}${
      lungo ? " lungo" : ""
    }" data-dm-chat-butta="${esc(linea)}" ${state.busy ? "disabled" : ""}
      title="${esc(titolo)}" aria-label="${esc(titolo)}">${esc(scritta)}</button>`;
}

/* L'elenco, per chi risponde.
 *
 * Prende le conversazioni invece di leggerle dallo stato — come `filoMarkup` —
 * cosi' una prova puo' chiedergli una riga e guardare cosa ne esce senza dover
 * far finta di avere una finestra aperta. */
export function codaMarkup(conversazioni = state.conversazioni) {
  const righe = Array.isArray(conversazioni) ? conversazioni : [];
  if (!righe.length) {
    return `<div class="dm-chat-vuoto">${esc(
      t("Nessuna conversazione aperta.", "No open conversation."),
    )}</div>`;
  }
  return `<div class="dm-chat-coda">${righe
    .map((voce) => {
      const linea = clean(voce?.id);
      const nome = clean(voce?.nome) || linea.slice(0, 12);
      const nonLetti = Number(voce?.non_letti) || 0;
      const note = [clean(voce?.versione), clean(voce?.ha), clean(voce?.lingua)]
        .filter(Boolean)
        .join(" · ");
      /* La riga non e' piu' un solo tasto: dentro ce ne stanno due, e un
       * tasto dentro un tasto non e' markup valido — il browser lo srotola e
       * il cestino finisce fuori dalla riga. Quindi un contenitore, e i due
       * tasti dentro. */
      return `
        <div class="dm-chat-voce${state.linea === linea ? " aperta" : ""}">
          <button type="button" class="dm-chat-voce-apri"
            data-dm-chat-linea="${esc(linea)}">
            <div class="dm-chat-voce-testa">
              <span class="dm-chat-voce-nm">${esc(nome)}</span>
              ${nonLetti ? `<span class="dm-chat-segno">${nonLetti}</span>` : ""}
            </div>
            <div class="dm-chat-voce-ult">${esc(clean(voce?.ultimo))}</div>
            ${note ? `<div class="dm-chat-voce-note">${esc(note)}</div>` : ""}
          </button>
          ${buttaMarkup(linea)}
        </div>`;
    })
    .join("")}</div>`;
}

function consoleMarkup() {
  if (!state.linea) return codaMarkup();
  return `
    <div class="dm-chat-azioni fra">
      <button type="button" class="dm-chat-btn chiaro" data-dm-chat="indietro">${esc(
        t("← Tutte le conversazioni", "← All conversations"),
      )}</button>
      ${buttaMarkup(state.linea, true)}
    </div>
    ${filoMarkup(state.filo, true)}
    ${casellaMarkup("dm-chat-console")}`;
}

function schedeMarkup() {
  if (!state.console) return "";
  const voci = [
    ["mia", t("La mia", "Mine")],
    ["coda", t("Conversazioni", "Conversations")],
  ];
  return `<div class="dm-chat-tabs">${voci
    .map(
      ([id, nome]) =>
        `<button type="button" class="dm-chat-tab${
          state.tab === id ? " attiva" : ""
        }" data-dm-chat-tab="${id}">${esc(nome)}</button>`,
    )
    .join("")}</div>`;
}

/* ─── La tessera e la finestra ──────────────────────────────────────────── */

function tesseraMarkup() {
  const pallino = state.unread
    ? `<span class="dm-chat-badge">${state.unread}</span>`
    : "";
  return `
    <div class="cfg-card-ico" style="--cc-rgb: 34,197,94;">💬</div>
    <div class="cfg-card-txt">
      <div class="cfg-card-nm">${esc(t("Assistenza", "Support"))}${pallino}</div>
      <div class="cfg-card-ds">${esc(
        t(
          "Scrivi a chi mantiene la plancia: conversazione privata, non passa da GitHub",
          "Write to whoever maintains the dashboard: a private conversation, not through GitHub",
        ),
      )}</div>
    </div>
    <div class="cfg-card-arrow">›</div>`;
}

/* La tessera compare solo se la chat c'e' davvero.
 *
 * Senza un centralino configurato la porta non si apre, e disegnarla vorrebbe
 * dire promettere una conversazione che nessuno ricevera'. Meglio nessuna
 * porta che una porta finta. */
function installaTessera() {
  annuncia();
  const griglia = doc?.querySelector?.("#page-config .cfg-grid");
  if (!griglia) return false;
  let tessera = doc.getElementById("dm-chat-card");
  if (!state.enabled) {
    tessera?.remove();
    return true;
  }
  if (!tessera) {
    tessera = doc.createElement("div");
    tessera.className = "cfg-card dm-chat-card";
    tessera.id = "dm-chat-card";
    tessera.addEventListener("click", () => apri());
    griglia.append(tessera);
  }
  tessera.innerHTML = tesseraMarkup();
  return true;
}

/* ─── La Home viene a saperlo ───────────────────────────────────────────
 *
 * «Gestisci una sorta di widget avviso che, se si ricevono messaggi nella
 *  chat assistenza, compare nella home.»
 *
 * La tessera la disegna la Home, con il modello di `core/avviso-chat.js`; qui
 * si tiene lo stato e si dice quando cambia — una volta per cambiamento, non a
 * ogni ridisegno, perche' la Home a ogni annuncio rifa' le sue tessere. */
let ultimoAnnuncio = "";

/** Lo stato della chat per chi lo legge da fuori: la tessera in Home. */
export function statoDellaChat() {
  return {
    enabled: state.enabled,
    unread: state.unread,
    preview: state.preview,
    writtenAt: state.writtenAt,
  };
}

function annuncia() {
  const adesso = statoDellaChat();
  const firma = JSON.stringify(adesso);
  if (firma === ultimoAnnuncio) return false;
  ultimoAnnuncio = firma;
  try {
    root.dispatchEvent?.(new CustomEvent(EVENTO_STATO, { detail: adesso }));
  } catch (_errore) {
    /* Senza `CustomEvent` (una prova senza finestra) non c'e' nemmeno una Home
     * da avvisare. */
  }
  return true;
}

/* Letta tutta: il segnalibro l'ha spostato il backend, qui si spegne quello
 * che lo mostrava. */
function lettaTutta() {
  state.unread = 0;
  state.preview = "";
  state.writtenAt = 0;
}

/* ─── L'orecchio sul bus di casa ─────────────────────────────────────────
 *
 * Il giro dei cinque minuti del backend, quando trova una risposta, la dice
 * sul bus di Home Assistant (`dashboardmodern_chat`): e' fatto per le
 * automazioni, e va benissimo anche per la pagina. Ci si mette in ascolto una
 * volta, con lo stesso socket del guscio, e a ogni evento si rilegge lo stato
 * — che non esce di casa e non sposta il segnalibro.
 *
 * Nessun battito in piu'. Il socket porta gia' gli eventi di stato, e a ognuno
 * si controlla che l'orecchio sia ancora attaccato: una riconnessione del
 * guscio butta via tutti i gestori in attesa, e senza questo controllo
 * l'ascolto morirebbe in silenzio alla prima caduta della rete. Il controllo
 * costa due letture, quindi non piu' d'una ogni dieci secondi. */
const orecchio = { id: 0, socket: null, gestore: null, controllato: 0 };
const OGNI_QUANTO_SI_CONTROLLA = 10000;

function presaDelGuscio() {
  const socket = lexicalGlobal("ws");
  const pending = lexicalGlobal("pendingWsCallbacks");
  if (!socket || socket.readyState !== 1 || !pending) return null;
  return { socket, pending };
}

/** Se l'ascolto e' vivo su QUESTO socket, con QUESTO gestore. */
export function inAscolto(presa = presaDelGuscio()) {
  return Boolean(
    presa &&
      orecchio.id &&
      presa.socket === orecchio.socket &&
      presa.pending[orecchio.id] === orecchio.gestore,
  );
}

function ascolta() {
  const presa = presaDelGuscio();
  if (!presa) return false;
  if (inAscolto(presa)) return true;
  let id;
  try {
    id = root.eval("msgId++");
  } catch (_errore) {
    return false;
  }
  if (!Number.isFinite(Number(id))) return false;
  const gestore = (messaggio) => {
    if (eUnEventoDellaChat(messaggio)) ricaricaStato();
  };
  /* Il guscio tiene in ascolto chi si marca cosi': una sottoscrizione riceve
   * piu' messaggi con lo stesso id. */
  gestore.keepAlive = true;
  presa.pending[id] = gestore;
  try {
    presa.socket.send(
      JSON.stringify({ id, type: "subscribe_events", event_type: EVENTO_DI_CASA }),
    );
  } catch (_errore) {
    delete presa.pending[id];
    return false;
  }
  orecchio.id = id;
  orecchio.socket = presa.socket;
  orecchio.gestore = gestore;
  return true;
}

function controllaLOrecchio() {
  const adesso = Date.now();
  if (adesso - orecchio.controllato < OGNI_QUANTO_SI_CONTROLLA) return;
  orecchio.controllato = adesso;
  ascolta();
}

function finestra() {
  let modale = doc?.getElementById?.("dm-chat-modal");
  if (modale) return modale;
  if (!doc?.body) return null;
  modale = doc.createElement("div");
  modale.className = "modal-wrapper";
  modale.id = "dm-chat-modal";
  modale.innerHTML = `
    <div class="modal-card dm-chat-pannello" role="dialog" aria-modal="true"
         aria-labelledby="dm-chat-titolo">
      <div class="cfg-hero dm-chat-hero">
        <div class="cfg-hero-ico" aria-hidden="true">💬</div>
        <div class="cfg-hero-txt">
          <div class="cfg-hero-title" id="dm-chat-titolo" data-dm-chat="titolo"></div>
          <div class="cfg-hero-sub" data-dm-chat="sottotitolo"></div>
        </div>
        <button class="ev-waw-close" type="button" data-dm-chat="chiudi"></button>
      </div>
      <div class="dm-chat-body" data-dm-chat="corpo"></div>
    </div>`;
  modale.addEventListener("click", (event) => {
    if (event.target === modale) chiudi();
  });
  modale
    .querySelector('[data-dm-chat="chiudi"]')
    ?.addEventListener("click", () => chiudi());
  doc.body.append(modale);
  return modale;
}

export function apri() {
  const modale = finestra();
  if (!modale) return;
  state.avviso = "";
  /* Un cestino armato non sopravvive alla finestra: riaprirla e trovare
   * «Confermi?» gia' acceso vorrebbe dire che il primo tocco cancella. */
  state.daButtare = "";
  modale.classList.add("show");
  disegna();
  ricarica();
  accendiIlGiro();
}

export function chiudi() {
  spegniIlGiro();
  state.daButtare = "";
  doc?.getElementById?.("dm-chat-modal")?.classList.remove("show");
}

/* ─── Il disegno ────────────────────────────────────────────────────────── */

function disegna() {
  const modale = doc?.getElementById?.("dm-chat-modal");
  if (!modale) return;
  modale.querySelector('[data-dm-chat="titolo"]').textContent = t(
    "Assistenza",
    "Support",
  );
  modale.querySelector('[data-dm-chat="sottotitolo"]').textContent = t(
    "Una conversazione privata con chi mantiene la plancia",
    "A private conversation with whoever maintains the dashboard",
  );
  modale.querySelector('[data-dm-chat="chiudi"]').textContent = t("Chiudi", "Close");
  const corpo = modale.querySelector('[data-dm-chat="corpo"]');
  /* Dov'era il cursore, prima che il corpo venisse rifatto.
   *
   * Il giro che porta le risposte nuove ridisegna la finestra, e ridisegnarla
   * vuol dire buttare via la casella e rifarla: senza questo, a chi stava
   * scrivendo il cursore saltava fuori dal campo a meta' frase, ogni volta che
   * dall'altra parte arrivava qualcosa. La bozza si teneva gia'; quello che si
   * perdeva era il punto in cui si era. */
  const attivo = doc?.activeElement;
  const dovEro =
    attivo?.id && corpo.contains(attivo) && typeof attivo.selectionStart === "number"
      ? { id: attivo.id, da: attivo.selectionStart, a: attivo.selectionEnd }
      : null;
  const dentro = state.console && state.tab === "coda" ? consoleMarkup() : miaMarkup();
  corpo.innerHTML = schedeMarkup() + avvisoMarkup() + dentro;
  agganciaEventi(corpo);
  if (dovEro) {
    const tornato = doc.getElementById(dovEro.id);
    if (tornato) {
      tornato.focus({ preventScroll: true });
      try {
        tornato.setSelectionRange(dovEro.da, dovEro.a);
      } catch (_errore) {
        /* Un campo che il cursore non lo tiene: basta avergli ridato il fuoco. */
      }
    }
  }
  /* La chat si legge dal fondo: l'ultima frase e' quella che interessa, e
   * aprire una conversazione lunga in cima vorrebbe dire scorrere ogni volta
   * per arrivare al punto. */
  const filo = corpo.querySelector('[data-dm-chat="filo"]');
  if (filo) filo.scrollTop = filo.scrollHeight;
}

function agganciaEventi(corpo) {
  corpo.querySelectorAll("[data-dm-chat-tab]").forEach((bottone) => {
    bottone.addEventListener("click", () => {
      state.tab = bottone.dataset.dmChatTab;
      state.linea = "";
      state.daButtare = "";
      disegna();
      if (state.tab === "coda") caricaCoda();
    });
  });
  corpo.querySelectorAll("[data-dm-chat-linea]").forEach((bottone) => {
    bottone.addEventListener("click", () => apriLinea(bottone.dataset.dmChatLinea));
  });
  corpo.querySelectorAll("[data-dm-chat-butta]").forEach((bottone) => {
    bottone.addEventListener("click", () => butta(bottone.dataset.dmChatButta));
  });
  corpo
    .querySelector('[data-dm-chat="indietro"]')
    ?.addEventListener("click", () => {
      state.linea = "";
      state.filo = [];
      state.daButtare = "";
      disegna();
      caricaCoda();
    });
  corpo.querySelector('[data-dm-chat="manda"]')?.addEventListener("click", () => manda());
  corpo
    .querySelector('[data-dm-chat="cancella"]')
    ?.addEventListener("click", () => cancella());
  const comeMiChiamo = corpo.querySelector("#dm-chat-comechiamo");
  if (comeMiChiamo) {
    comeMiChiamo.addEventListener("input", () => {
      state.name = clean(comeMiChiamo.value);
    });
  }
  const pannello = corpo.querySelector('[data-dm-chat="emoji"]');
  const apriEmoji = corpo.querySelector('[data-dm-chat="emoji-apri"]');
  const campo = corpo.querySelector("textarea");
  if (pannello && apriEmoji && campo) {
    apriEmoji.addEventListener("click", () => {
      const chiuso = pannello.hidden;
      pannello.hidden = !chiuso;
      apriEmoji.setAttribute("aria-expanded", String(chiuso));
      if (chiuso) campo.focus();
    });
    /* Un solo ascoltatore per tutte le emoji, e sul pannello: sono quaranta, e
     * quaranta ascoltatori si rifanno a ogni ridisegno. */
    pannello.addEventListener("mousedown", (evento) => {
      /* Prima del `click`, cosi' la casella non perde il fuoco e il cursore
       * resta dov'era: senza, l'emoji finirebbe sempre in fondo. */
      if (evento.target.closest("[data-dm-emoji]")) evento.preventDefault();
    });
    pannello.addEventListener("click", (evento) => {
      const scelta = evento.target.closest("[data-dm-emoji]");
      if (!scelta) return;
      const esito = conLEmoji(
        campo.value,
        scelta.dataset.dmEmoji,
        campo.selectionStart,
        campo.selectionEnd,
        MAX_TESTO,
      );
      if (esito.pieno) return;
      campo.value = esito.testo;
      campo.setSelectionRange?.(esito.cursore, esito.cursore);
      campo.focus();
      /* Lo stesso evento che scrivere a mano fa partire: da li' passano la
       * bozza tenuta da parte e il conto dei caratteri rimasti. */
      campo.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  if (campo) {
    campo.addEventListener("input", () => {
      state.bozza = campo.value;
      const rimasti = corpo.querySelector('[data-dm-chat="rimasti"]');
      if (rimasti) rimasti.textContent = String(MAX_TESTO - campo.value.length);
    });
    /* Invio manda, Maiuscolo+Invio va a capo: e' quello che le dita si
     * aspettano da una chat, e non averlo si sente a ogni frase. */
    campo.addEventListener("keydown", (evento) => {
      if (evento.key === "Enter" && !evento.shiftKey && !evento.isComposing) {
        evento.preventDefault();
        manda();
      }
    });
  }
}

/* ─── Il giro che tiene la finestra viva ────────────────────────────────── */

/* Ogni quanto la finestra aperta va a vedere se e' arrivato qualcosa.
 *
 * «La risposta non si refresh, devo uscire e rientrare»: la finestra leggeva
 * una volta all'apertura e poi restava ferma. Il giro dei cinque minuti del
 * backend c'era gia', ma quello serve al campanello — suona e basta, non
 * ridisegna niente — e cinque minuti davanti a una chat aperta sono
 * un'eternita'.
 *
 * Quindici secondi, e solo mentre la finestra e' aperta: chiusa non chiede
 * niente, perche' una plancia accesa tutto il giorno in cucina non deve
 * bussare al centralino per una conversazione che nessuno sta guardando. */
const RINFRESCO = 15000;

let giro = 0;

/* Un giro per volta, e mai due sovrapposti.
 *
 * Quindici secondi sono tanti finche' il centralino risponde. Il giorno che ci
 * mette venti, il battito successivo parte mentre il primo e' ancora per aria:
 * due richieste in volo, e vince quella che torna per ultima — che non e'
 * detto sia la piu' recente. */
let inVolo = false;

function accendiIlGiro() {
  spegniIlGiro();
  giro = root.setInterval?.(() => {
    if (!doc?.getElementById?.("dm-chat-modal")?.classList.contains("show")) {
      spegniIlGiro();
      return;
    }
    /* Pagina nascosta, giro fermo. Non e' per risparmiare: leggere la propria
     * conversazione vuol dire averla letta, e il segnalibro si sposta. Una
     * finestra dimenticata aperta in una scheda in fondo si mangiava le
     * risposte — le metteva in copia, le segnava lette, e il giro dei cinque
     * minuti che deve suonare la campanella trovava che non era arrivato
     * niente di nuovo. La risposta c'era, e nessuno lo sapeva. */
    if (doc?.hidden) return;
    rinfresca();
  }, RINFRESCO);
}

function spegniIlGiro() {
  if (giro) root.clearInterval?.(giro);
  giro = 0;
}

/** Il segno di una lista: quanti sono e dov'e' arrivata. */
const segno = (righe) =>
  `${righe.length}:${Number(righe[righe.length - 1]?.id) || 0}`;

/* Va a vedere, e ridisegna solo se c'e' qualcosa da ridisegnare.
 *
 * Il confronto non e' un risparmio di cicli: ridisegnare rifa' la casella, e
 * rifare la casella quattro volte al minuto mentre qualcuno scrive e' il modo
 * di rendere la finestra inusabile. Se non e' cambiato niente, non si tocca
 * niente. */
async function rinfresca() {
  if (state.busy || inVolo || !state.enabled) return;
  /* Da dove si e' partiti. Fra la domanda e la risposta ci sta un dito che
   * cambia scheda o apre un'altra conversazione: senza questo appunto, il filo
   * di una casa finiva sotto il nome di un'altra — la richiesta era partita per
   * A, ma quando torna la finestra sta mostrando B, e le frasi di A si
   * scrivevano li' dentro come se fossero sue. */
  const dovEro = { console: state.console, tab: state.tab, linea: state.linea };
  const stessoPosto = () =>
    state.console === dovEro.console &&
    state.tab === dovEro.tab &&
    state.linea === dovEro.linea;
  inVolo = true;
  try {
    if (dovEro.console && dovEro.tab === "coda") {
      if (dovEro.linea) {
        const filo = await chiedi(WS_OPEN, { line: dovEro.linea });
        const righe = Array.isArray(filo?.messages) ? filo.messages : [];
        if (!stessoPosto() || segno(righe) === segno(state.filo)) return;
        state.filo = righe;
      } else {
        const coda = await chiedi(WS_QUEUE);
        const righe = Array.isArray(coda?.conversations) ? coda.conversations : [];
        if (!stessoPosto()) return;
        if (JSON.stringify(righe) === JSON.stringify(state.conversazioni)) return;
        state.conversazioni = righe;
      }
    } else {
      const filo = await chiedi(WS_THREAD);
      const righe = Array.isArray(filo?.messages) ? filo.messages : [];
      if (!stessoPosto() || segno(righe) === segno(state.messages)) return;
      state.messages = righe;
      lettaTutta();
      installaTessera();
    }
  } catch (_errore) {
    /* Un giro automatico che non riesce non dice niente. Chi non ha chiesto
     * niente non deve vedersi comparire un errore da solo, e al giro dopo il
     * centralino magari risponde. */
    return;
  } finally {
    inVolo = false;
  }
  disegna();
}

/* ─── Le richieste ──────────────────────────────────────────────────────── */

/* Solo lo stato: se la chat c'e', quante risposte aspettano, come ci si
 * chiama. Non esce di casa e non tocca il segnalibro.
 *
 * All'avvio si leggeva anche il filo, e leggere il filo E' averlo letto: il
 * backend spostava il segnalibro, e il pallino si spegneva da solo a ogni
 * ricarica della pagina, prima che qualcuno avesse visto niente. Il filo si
 * legge quando la finestra si apre, che e' quando qualcuno lo legge davvero. */
async function ricaricaStato() {
  try {
    const stato = await chiedi(WS_STATE);
    state.enabled = Boolean(stato?.enabled);
    state.console = Boolean(stato?.console);
    state.opened = Boolean(stato?.opened);
    state.name = clean(stato?.name);
    const letto = letturaDelloStato(stato);
    state.unread = letto.unread;
    state.preview = letto.preview;
    state.writtenAt = letto.writtenAt;
  } catch (_errore) {
    /* La finestra si apre lo stesso: quello che c'e' da scrivere si scrive
     * anche senza aver letto lo stato, e lo stato si riprende da solo. */
    installaTessera();
    return false;
  }
  installaTessera();
  return true;
}

async function ricarica() {
  await ricaricaStato();
  if (!state.enabled) return;
  await caricaFilo();
  if (state.console && state.tab === "coda") await caricaCoda();
  disegna();
}

async function caricaFilo() {
  try {
    const filo = await chiedi(WS_THREAD);
    state.messages = Array.isArray(filo?.messages) ? filo.messages : [];
    lettaTutta();
  } catch (errore) {
    state.avviso = `!${clean(errore?.message) || t("Non riuscita.", "It did not work.")}`;
  }
  installaTessera();
}

async function caricaCoda() {
  try {
    const coda = await chiedi(WS_QUEUE);
    state.conversazioni = Array.isArray(coda?.conversations) ? coda.conversations : [];
  } catch (errore) {
    state.avviso = `!${clean(errore?.message) || t("Non riuscita.", "It did not work.")}`;
  }
  disegna();
}

async function apriLinea(linea) {
  const nome = clean(linea);
  if (!nome) return;
  state.linea = nome;
  state.filo = [];
  state.daButtare = "";
  disegna();
  try {
    const filo = await chiedi(WS_OPEN, { line: nome });
    state.filo = Array.isArray(filo?.messages) ? filo.messages : [];
  } catch (errore) {
    state.avviso = `!${clean(errore?.message) || t("Non riuscita.", "It did not work.")}`;
  }
  disegna();
}

/* Dove sta scritto quello che si sta per mandare.
 *
 * Si cerca nel documento e non dentro la finestra per la stessa ragione per
 * cui lo fa il cruscotto: gli identificativi sono unici, e cercare largo qui
 * e' cercare esatto. */
function campoDi(identificativo) {
  return clean(doc?.getElementById?.(identificativo)?.value);
}

async function manda() {
  const console_ = state.console && state.tab === "coda" && state.linea;
  const testo = campoDi(console_ ? "dm-chat-console" : "dm-chat-mio");
  if (!testo) return;
  state.busy = true;
  state.avviso = "";
  state.bozza = testo;
  disegna();
  try {
    if (console_) {
      await chiedi(WS_ANSWER, { line: state.linea, message: testo });
      state.bozza = "";
      await apriLinea(state.linea);
    } else {
      /* La lingua di CHI STA SCRIVENDO, non quella del server. In una casa dove
       * ognuno ha la sua, o dove la plancia parla una lingua diversa da Home
       * Assistant, la coda diceva la lingua sbagliata — e chi risponde si
       * ritrovava a scrivere in una lingua che quella persona non usa. */
      await chiedi(WS_SEND, { message: testo, name: state.name, locale: lingua() });
      state.bozza = "";
      await caricaFilo();
    }
  } catch (errore) {
    /* La bozza resta: chi ha appena incollato mezzo file di configurazione non
     * deve riscriverlo per riprovare. */
    state.avviso = `!${clean(errore?.message) || t("Non riuscita.", "It did not work.")}`;
  } finally {
    state.busy = false;
    disegna();
  }
}

/* Buttare via una conversazione, dalla parte di chi risponde.
 *
 * Il primo tocco arma e basta. Il secondo cancella davvero, e cancella per
 * tutti e due: la linea sparisce dal centralino, e con lei quello che si erano
 * detti. La coda si rilegge subito dopo, perche' quello che si vede in elenco
 * dev'essere quello che c'e' — non quello che questa finestra crede. */
async function butta(linea) {
  const nome = clean(linea);
  if (!nome) return;
  if (state.daButtare !== nome) {
    state.daButtare = nome;
    disegna();
    return;
  }
  state.daButtare = "";
  state.busy = true;
  state.avviso = "";
  disegna();
  try {
    await chiedi(WS_DROP, { line: nome });
    state.conversazioni = state.conversazioni.filter(
      (voce) => clean(voce?.id) !== nome,
    );
    if (state.linea === nome) {
      state.linea = "";
      state.filo = [];
    }
    state.avviso = t("Conversazione cancellata.", "Conversation deleted.");
  } catch (errore) {
    state.avviso = `!${clean(errore?.message) || t("Non riuscita.", "It did not work.")}`;
  } finally {
    state.busy = false;
    disegna();
  }
  await caricaCoda();
}

async function cancella() {
  state.busy = true;
  disegna();
  try {
    await chiedi(WS_FORGET);
    state.messages = [];
    state.unread = 0;
    state.avviso = t("Conversazione cancellata.", "Conversation deleted.");
  } catch (errore) {
    state.avviso = `!${clean(errore?.message) || t("Non riuscita.", "It did not work.")}`;
  } finally {
    state.busy = false;
    installaTessera();
    disegna();
  }
}

/* ─── Il vestito ────────────────────────────────────────────────────────── */

const CSS = `
#dm-chat-modal .modal-card.dm-chat-pannello { max-width:640px; padding:20px; }
.dm-chat-hero { position:relative; margin-bottom:16px; }
.dm-chat-hero .cfg-hero-txt { flex:1; min-width:0; }
.dm-chat-hero .ev-waw-close { flex-shrink:0; }
.dm-chat-body { display:flex; flex-direction:column; gap:12px; }

.dm-chat-tabs { display:flex; gap:8px; }
.dm-chat-tab { flex:1 1 0; padding:10px 12px; border-radius:14px; cursor:pointer;
  border:1px solid var(--card-border,#e2e8f0); background:var(--surface-3,#f1f5f9);
  color:var(--text,#0f172a); font-size:13px; font-weight:700; text-align:center; }
.dm-chat-tab.attiva { background:var(--accent,#22c55e); color:#fff;
  border-color:transparent; }

/* Il patto: si legge una volta sola, prima della prima riga. */
.dm-chat-patto { display:flex; gap:10px; padding:12px 14px; border-radius:16px;
  background:var(--surface-3,#f1f5f9); border:1px solid var(--card-border,#e2e8f0);
  color:var(--text-dim,#64748b); font-size:12px; line-height:1.5; }
.dm-chat-patto-ico { flex-shrink:0; font-size:16px; }

/* Il filo: alto quanto basta, e si legge dal fondo. */
.dm-chat-filo { display:flex; flex-direction:column; gap:8px; max-height:46vh;
  overflow-y:auto; padding:4px 2px; }
.dm-chat-riga { display:flex; }
.dm-chat-riga.mia { justify-content:flex-end; }
.dm-chat-bolla { max-width:78%; padding:9px 13px; border-radius:18px;
  background:var(--surface-3,#f1f5f9); border:1px solid var(--card-border,#e2e8f0); }
.dm-chat-riga.mia .dm-chat-bolla { background:var(--accent,#22c55e); color:#fff;
  border-color:transparent; }
.dm-chat-testo { font-size:13px; line-height:1.5; white-space:pre-wrap;
  word-break:break-word; }
.dm-chat-ora { margin-top:3px; font-size:10px; opacity:.7; text-align:right; }

.dm-chat-vuoto { display:grid; gap:8px; justify-items:center; padding:26px 18px;
  border:1px dashed var(--card-border,#e2e8f0); border-radius:18px;
  color:var(--text-dim,#64748b); font-size:13px; text-align:center; }
.dm-chat-vuoto-ico { font-size:26px; }

.dm-chat-nome { display:grid; gap:5px; }
.dm-chat-nome label { font-size:11px; font-weight:700; color:var(--text-dim,#64748b); }
.dm-chat-nome input { width:100%; box-sizing:border-box; padding:9px 13px;
  border-radius:14px; border:1px solid var(--card-border,#e2e8f0);
  background:var(--surface-2,#fff); color:var(--text,#0f172a); font:inherit;
  font-size:13px; }
.dm-chat-campo textarea { width:100%; box-sizing:border-box; padding:11px 13px;
  border-radius:14px; border:1px solid var(--card-border,#e2e8f0);
  background:var(--surface-2,#fff); color:var(--text,#0f172a); font:inherit;
  font-size:13px; resize:vertical; }
.dm-chat-sotto { display:flex; align-items:center; justify-content:space-between;
  gap:10px; margin-top:8px; }
.dm-chat-emoji-apri { width:34px; height:34px; padding:0; flex:0 0 auto;
  border-radius:50%; border:1px solid var(--card-border,#e2e8f0);
  background:var(--surface-3,#f1f5f9); font-size:17px; line-height:1;
  cursor:pointer; }
.dm-chat-emoji-apri[aria-expanded="true"] { background:var(--accent,#22c55e);
  border-color:transparent; }
/* Il conto dei caratteri prende lo spazio in mezzo, cosi' il tasto delle
   emoji resta a sinistra e «Manda» a destra dove sono sempre stati. */
.dm-chat-sotto .dm-chat-rimasti { flex:1 1 auto; text-align:right; }
.dm-chat-emoji { display:flex; flex-wrap:wrap; gap:4px; margin-top:8px;
  padding:8px; border-radius:14px; background:var(--surface-3,#f1f5f9);
  border:1px solid var(--card-border,#e2e8f0); max-height:148px;
  overflow-y:auto; }
.dm-chat-emoji[hidden] { display:none; }
.dm-chat-emoji-uno { width:34px; height:34px; padding:0; border:0;
  border-radius:10px; background:transparent; font-size:19px; line-height:1;
  cursor:pointer; }
.dm-chat-emoji-uno:hover { background:var(--surface-2,#fff); }
.dm-chat-rimasti { font-size:11px; color:var(--text-dim,#64748b); }
.dm-chat-btn { padding:9px 18px; border-radius:50px; cursor:pointer; border:0;
  background:var(--accent,#22c55e); color:#fff; font-size:13px; font-weight:700; }
.dm-chat-btn[disabled] { opacity:.6; cursor:default; }
.dm-chat-btn.chiaro { background:var(--surface-3,#f1f5f9);
  color:var(--text-dim,#64748b); border:1px solid var(--card-border,#e2e8f0); }
.dm-chat-azioni { display:flex; justify-content:flex-end; align-items:center;
  gap:10px; }
.dm-chat-azioni.fra { justify-content:space-between; }

.dm-chat-avviso { padding:9px 13px; border-radius:14px; font-size:12px;
  background:rgba(34,197,94,0.12); color:#15803d; }
.dm-chat-avviso.male { background:rgba(239,68,68,0.12); color:#b91c1c; }

/* L'elenco di chi risponde. */
.dm-chat-coda { display:flex; flex-direction:column; gap:8px; max-height:52vh;
  overflow-y:auto; }
.dm-chat-voce { display:flex; align-items:center; gap:8px; padding:11px 13px;
  border-radius:16px; border:1px solid var(--card-border,#e2e8f0);
  background:var(--surface-3,#f1f5f9); color:var(--text,#0f172a); }
.dm-chat-voce.aperta { border-color:var(--accent,#22c55e); }
/* Il tasto che apre prende tutta la riga tranne il cestino;
   min-width:0 e' quello che lascia accorciare l'ultima frase invece di far
   debordare la riga. */
.dm-chat-voce-apri { flex:1 1 auto; min-width:0; display:grid; gap:3px; padding:0;
  border:0; background:none; color:inherit; font:inherit; text-align:left;
  cursor:pointer; }
.dm-chat-voce-testa { display:flex; align-items:center; gap:8px; }
.dm-chat-voce-nm { font-size:13px; font-weight:800; }
.dm-chat-voce-ult { font-size:12px; color:var(--text-dim,#64748b);
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dm-chat-voce-note { font-size:10px; color:var(--text-dim,#64748b); opacity:.8; }
/* Il cestino: grigio finche' e' solo un tasto, rosso quando e' armato e il
   tocco dopo cancella per davvero. */
.dm-chat-butta { flex-shrink:0; padding:7px 11px; border-radius:12px;
  cursor:pointer; font:inherit; font-size:12px; font-weight:700; line-height:1;
  border:1px solid var(--card-border,#e2e8f0); background:var(--surface-2,#fff);
  color:var(--text-dim,#64748b); }
.dm-chat-butta.lungo { padding:9px 16px; border-radius:50px; }
.dm-chat-butta.armato { background:rgba(239,68,68,0.12); color:#b91c1c;
  border-color:rgba(239,68,68,0.35); }
.dm-chat-butta[disabled] { opacity:.6; cursor:default; }

.dm-chat-segno, .dm-chat-badge { min-width:18px; height:18px; padding:0 6px;
  border-radius:999px; background:var(--accent,#22c55e); color:#fff;
  font-size:10px; font-weight:900; display:inline-grid; place-items:center; }
.dm-chat-badge { margin-left:7px; }
`;

/* ─── Installazione ─────────────────────────────────────────────────────── */

export function installAssistenzaSection() {
  if (!doc || state.installed) return state;
  state.installed = true;
  installStyle("dm-chat-style", CSS);
  /* Lo stato si legge sempre, non solo con la Configurazione davanti: la
   * tessera in Home ne ha bisogno prima che qualcuno apra quella pagina. E'
   * una lettura locale, senza centralino, e non sposta il segnalibro. */
  const prova = () => {
    ricaricaStato();
    ascolta();
  };
  root.addEventListener?.("dashboardmodern:legacy-ready", prova);
  root.addEventListener?.("dashboardmodern:runtime-ready", prova);
  root.addEventListener?.("dashboardmodern:states-ready", prova);
  /* A ogni stato che cambia si guarda solo che l'orecchio sia ancora
   * attaccato: dopo una riconnessione non lo e' piu'. */
  root.addEventListener?.("dashboardmodern:state-changed", controllaLOrecchio);
  /* Una plancia a muro che torna visibile rilegge: se nel frattempo e'
   * arrivata una risposta e l'evento e' passato con la pagina nascosta, e'
   * qui che la tessera compare. */
  doc.addEventListener("visibilitychange", () => {
    if (!doc.hidden) prova();
  });
  doc.addEventListener(
    "click",
    (event) => {
      if (event.target?.closest?.('[data-tab="config"]')) root.setTimeout?.(prova, 0);
    },
    true,
  );
  /* La porta dalla Home: la tessera dell'avviso porta un tasto con questo
   * segno, e chi lo tocca vuole leggere. Apre chi possiede la finestra. */
  doc.addEventListener("click", (event) => {
    if (event.target?.closest?.("[data-dm-apri-chat]")) apri();
  });
  prova();
  root.DashboardModernAssistenza = Object.freeze({ apri, chiudi });
  return state;
}

/** Seme per le prove: dimentica l'installazione e la finestra. */
export function uninstallAssistenzaSection() {
  spegniIlGiro();
  inVolo = false;
  doc?.getElementById?.("dm-chat-modal")?.remove();
  doc?.getElementById?.("dm-chat-card")?.remove();
  state.installed = false;
  state.enabled = false;
  state.console = false;
  lettaTutta();
  ultimoAnnuncio = "";
  orecchio.id = 0;
  orecchio.socket = null;
  orecchio.gestore = null;
  orecchio.controllato = 0;
  state.messages = [];
  state.conversazioni = [];
  state.linea = "";
  state.filo = [];
  state.tab = "mia";
  state.daButtare = "";
  state.busy = false;
  state.avviso = "";
  state.bozza = "";
}

installAssistenzaSection();
