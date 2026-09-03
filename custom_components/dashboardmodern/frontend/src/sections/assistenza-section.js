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
  clean,
  doc,
  esc,
  installStyle,
  root,
  t,
} from "./shared.js";

const WS_STATE = "dashboardmodern/chat/state";
const WS_THREAD = "dashboardmodern/chat/thread";
const WS_SEND = "dashboardmodern/chat/send";
const WS_FORGET = "dashboardmodern/chat/forget";
const WS_QUEUE = "dashboardmodern/chat/queue";
const WS_OPEN = "dashboardmodern/chat/open";
const WS_ANSWER = "dashboardmodern/chat/answer";

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
  messages: [],
  conversazioni: [],
  linea: "",
  filo: [],
  tab: "mia",
  busy: false,
  avviso: "",
};

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

export function messaggioMarkup(riga) {
  const mio = clean(riga?.da) !== "console";
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
export function filoMarkup(messaggi) {
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
    .map(messaggioMarkup)
    .join("")}</div>`;
}

function casellaMarkup(dove, quanti) {
  const rimasti = MAX_TESTO - Number(quanti || 0);
  return `
    <div class="dm-chat-campo">
      <textarea id="${dove}" rows="3" maxlength="${MAX_TESTO}" placeholder="${esc(
        t("Scrivi il tuo messaggio…", "Write your message…"),
      )}"></textarea>
      <div class="dm-chat-sotto">
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
  return `${patto}${filoMarkup(state.messages)}${casellaMarkup("dm-chat-mio", 0)}${cancella}`;
}

/* L'elenco, per chi risponde. */
function codaMarkup() {
  if (!state.conversazioni.length) {
    return `<div class="dm-chat-vuoto">${esc(
      t("Nessuna conversazione aperta.", "No open conversation."),
    )}</div>`;
  }
  return `<div class="dm-chat-coda">${state.conversazioni
    .map((voce) => {
      const linea = clean(voce?.id);
      const nome = clean(voce?.nome) || linea.slice(0, 12);
      const nonLetti = Number(voce?.non_letti) || 0;
      const note = [clean(voce?.versione), clean(voce?.ha), clean(voce?.lingua)]
        .filter(Boolean)
        .join(" · ");
      return `
        <button type="button" class="dm-chat-voce${
          state.linea === linea ? " aperta" : ""
        }" data-dm-chat-linea="${esc(linea)}">
          <div class="dm-chat-voce-testa">
            <span class="dm-chat-voce-nm">${esc(nome)}</span>
            ${nonLetti ? `<span class="dm-chat-segno">${nonLetti}</span>` : ""}
          </div>
          <div class="dm-chat-voce-ult">${esc(clean(voce?.ultimo))}</div>
          ${note ? `<div class="dm-chat-voce-note">${esc(note)}</div>` : ""}
        </button>`;
    })
    .join("")}</div>`;
}

function consoleMarkup() {
  if (!state.linea) return codaMarkup();
  return `
    <div class="dm-chat-azioni">
      <button type="button" class="dm-chat-btn chiaro" data-dm-chat="indietro">${esc(
        t("← Tutte le conversazioni", "← All conversations"),
      )}</button>
    </div>
    ${filoMarkup(state.filo)}
    ${casellaMarkup("dm-chat-console", 0)}`;
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
  modale.classList.add("show");
  disegna();
  ricarica();
}

export function chiudi() {
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
  const dentro = state.console && state.tab === "coda" ? consoleMarkup() : miaMarkup();
  corpo.innerHTML = schedeMarkup() + avvisoMarkup() + dentro;
  agganciaEventi(corpo);
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
      disegna();
      if (state.tab === "coda") caricaCoda();
    });
  });
  corpo.querySelectorAll("[data-dm-chat-linea]").forEach((bottone) => {
    bottone.addEventListener("click", () => apriLinea(bottone.dataset.dmChatLinea));
  });
  corpo
    .querySelector('[data-dm-chat="indietro"]')
    ?.addEventListener("click", () => {
      state.linea = "";
      state.filo = [];
      disegna();
      caricaCoda();
    });
  corpo.querySelector('[data-dm-chat="manda"]')?.addEventListener("click", () => manda());
  corpo
    .querySelector('[data-dm-chat="cancella"]')
    ?.addEventListener("click", () => cancella());
  const campo = corpo.querySelector("textarea");
  if (campo) {
    campo.addEventListener("input", () => {
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

/* ─── Le richieste ──────────────────────────────────────────────────────── */

async function ricarica() {
  try {
    const stato = await chiedi(WS_STATE);
    state.enabled = Boolean(stato?.enabled);
    state.console = Boolean(stato?.console);
    state.opened = Boolean(stato?.opened);
    state.name = clean(stato?.name);
    state.unread = Number(stato?.unread) || 0;
  } catch (_errore) {
    /* La finestra si apre lo stesso: quello che c'e' da scrivere si scrive
     * anche senza aver letto lo stato, e lo stato si riprende da solo. */
  }
  installaTessera();
  if (!state.enabled) return;
  await caricaFilo();
  if (state.console && state.tab === "coda") await caricaCoda();
  disegna();
}

async function caricaFilo() {
  try {
    const filo = await chiedi(WS_THREAD);
    state.messages = Array.isArray(filo?.messages) ? filo.messages : [];
    state.unread = 0;
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
  disegna();
  try {
    if (console_) {
      await chiedi(WS_ANSWER, { line: state.linea, message: testo });
      await apriLinea(state.linea);
    } else {
      await chiedi(WS_SEND, { message: testo, name: state.name });
      await caricaFilo();
    }
  } catch (errore) {
    state.avviso = `!${clean(errore?.message) || t("Non riuscita.", "It did not work.")}`;
  } finally {
    state.busy = false;
    disegna();
  }
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

.dm-chat-campo textarea { width:100%; box-sizing:border-box; padding:11px 13px;
  border-radius:14px; border:1px solid var(--card-border,#e2e8f0);
  background:var(--surface-2,#fff); color:var(--text,#0f172a); font:inherit;
  font-size:13px; resize:vertical; }
.dm-chat-sotto { display:flex; align-items:center; justify-content:space-between;
  gap:10px; margin-top:8px; }
.dm-chat-rimasti { font-size:11px; color:var(--text-dim,#64748b); }
.dm-chat-btn { padding:9px 18px; border-radius:50px; cursor:pointer; border:0;
  background:var(--accent,#22c55e); color:#fff; font-size:13px; font-weight:700; }
.dm-chat-btn[disabled] { opacity:.6; cursor:default; }
.dm-chat-btn.chiaro { background:var(--surface-3,#f1f5f9);
  color:var(--text-dim,#64748b); border:1px solid var(--card-border,#e2e8f0); }
.dm-chat-azioni { display:flex; justify-content:flex-end; }

.dm-chat-avviso { padding:9px 13px; border-radius:14px; font-size:12px;
  background:rgba(34,197,94,0.12); color:#15803d; }
.dm-chat-avviso.male { background:rgba(239,68,68,0.12); color:#b91c1c; }

/* L'elenco di chi risponde. */
.dm-chat-coda { display:flex; flex-direction:column; gap:8px; max-height:52vh;
  overflow-y:auto; }
.dm-chat-voce { display:grid; gap:3px; padding:11px 13px; border-radius:16px;
  cursor:pointer; text-align:left; font:inherit;
  border:1px solid var(--card-border,#e2e8f0); background:var(--surface-3,#f1f5f9);
  color:var(--text,#0f172a); }
.dm-chat-voce.aperta { border-color:var(--accent,#22c55e); }
.dm-chat-voce-testa { display:flex; align-items:center; gap:8px; }
.dm-chat-voce-nm { font-size:13px; font-weight:800; }
.dm-chat-voce-ult { font-size:12px; color:var(--text-dim,#64748b);
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dm-chat-voce-note { font-size:10px; color:var(--text-dim,#64748b); opacity:.8; }
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
  const prova = () => {
    if (doc.querySelector("#page-config .cfg-grid")) ricarica();
  };
  root.addEventListener?.("dashboardmodern:legacy-ready", prova);
  root.addEventListener?.("dashboardmodern:runtime-ready", prova);
  doc.addEventListener(
    "click",
    (event) => {
      if (event.target?.closest?.('[data-tab="config"]')) root.setTimeout?.(prova, 0);
    },
    true,
  );
  prova();
  root.DashboardModernAssistenza = Object.freeze({ apri, chiudi });
  return state;
}

/** Seme per le prove: dimentica l'installazione e la finestra. */
export function uninstallAssistenzaSection() {
  doc?.getElementById?.("dm-chat-modal")?.remove();
  doc?.getElementById?.("dm-chat-card")?.remove();
  state.installed = false;
  state.enabled = false;
  state.console = false;
  state.messages = [];
  state.conversazioni = [];
  state.linea = "";
  state.filo = [];
  state.tab = "mia";
}

installAssistenzaSection();
