/*
 * Le segnalazioni, dalla parte di chi le scrive.
 *
 * Una tessera in Configurazione, e dietro una finestra con tre cose da dire —
 * un difetto, un'idea, una richiesta di aiuto — piu' l'elenco di quelle gia'
 * aperte, con lo stato che torna indietro da solo.
 *
 * Due scelte spiegano il resto del file.
 *
 * **La diagnostica la compila la plancia.** Le prime tre domande dei moduli su
 * GitHub — versione dell'integrazione, versione di Home Assistant, come e'
 * stata installata — sono le uniche a cui l'utente non sa rispondere, ed e'
 * per questo che i moduli le chiedono per primi: la strada lunga le perde per
 * via. Qui non c'e' niente da chiedere, sono gia' scritte. E si vedono prima
 * di premere invia: cosa esce di casa non e' una cosa da far scoprire dopo.
 *
 * **La convalida sta da tutte e due le parti, e non e' una ripetizione.**
 * Quella qui e' per chi scrive — dice subito «manca il titolo», nella sua
 * lingua, senza un giro sulla rete. Quella nel backend e' il cancello, e vale
 * anche per chi questo file non lo esegue affatto.
 */

import { clean, doc, esc, installStyle, root, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_SEGNALAZIONI__";
const state = (root[KEY] ||= {
  installed: false,
  tickets: [],
  delivery: false,
  console: false,
  queue: null,
  tab: "nuova",
  tipo: "bug",
  busy: false,
  avviso: "",
  config: null,
});

const WS_LIST = "dashboardmodern/tickets/list";
const WS_CREATE = "dashboardmodern/tickets/create";
const WS_DELETE = "dashboardmodern/tickets/delete";
const WS_SYNC = "dashboardmodern/tickets/sync";
const WS_QUEUE = "dashboardmodern/tickets/queue";
const WS_ANSWER = "dashboardmodern/tickets/answer";

/* Esportati perche' una prova li tenga accanto all'allowlist del ponte. Un
 * tipo non elencato la' non arriva a Home Assistant e la finestra risponde
 * «Message type not permitted through the bridge»: e' un refuso che si vede
 * solo in un browser vero, quindi si guarda qui. */
export const WS_TYPES = Object.freeze([
  WS_LIST,
  WS_CREATE,
  WS_DELETE,
  WS_SYNC,
  WS_QUEUE,
  WS_ANSWER,
]);

/* Le sole chiavi che questa finestra puo' mettere nella diagnostica. Il
 * backend ha la sua lista e butta via il resto: questa serve a non mandare
 * nemmeno quello che verrebbe buttato, e a poterlo mostrare all'utente. */
export const DIAGNOSTIC_KEYS = Object.freeze([
  "integration_version",
  "ha_version",
  "locale",
  "panel_section",
  "user_agent",
]);

/* Gli stessi tetti del backend. Ripetuti apposta: qui servono a fermare la
 * mano prima dell'invio, li' a fermare la richiesta. */
const MAX_TITOLO = 120;
const MAX_CORPO = 4000;
const MAX_CONTATTO = 190;

const TIPI = [
  { id: "bug", icona: "🐞", nome: () => t("Un difetto", "A bug") },
  { id: "feature", icona: "✨", nome: () => t("Un'idea", "An idea") },
  { id: "assistenza", icona: "💬", nome: () => t("Aiuto", "Help") },
];

const STATI = {
  bozza: { icona: "○", nome: () => t("Da inviare", "To send") },
  inviato: { icona: "●", nome: () => t("Inviata", "Sent") },
  "in-carico": { icona: "◐", nome: () => t("Presa in carico", "Being worked on") },
  risolto: { icona: "✓", nome: () => t("Risolta", "Solved") },
  chiuso: { icona: "×", nome: () => t("Chiusa", "Closed") },
};

/* ─── Il canale verso Home Assistant ──────────────────────────────────────
 *
 * Lo stesso di tutto il resto della plancia: il ponte, non una fetch. La
 * plancia servita dall'integrazione non possiede nessun token, e una chiamata
 * REST del browser risponderebbe 401. */
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

/* ─── Quello che la plancia sa e l'utente no ───────────────────────────── */

async function haVersion() {
  if (state.config) return state.config;
  try {
    const config = await chiedi("get_config");
    state.config = clean(config?.version);
  } catch (_error) {
    state.config = "";
  }
  return state.config;
}

function versioneIntegrazione() {
  const info = root.DashboardModernModules?.diagnostics?.BUILD_INFO;
  return clean(info?.integrationVersion || info?.dashboardVersion || "");
}

function paginaAttiva() {
  const attiva = doc?.querySelector?.(".page.active");
  return clean(attiva?.id || "").replace(/^page-/, "");
}

async function diagnostica() {
  /* La lista e' chiusa anche qui, e coincide con quella del backend. Se una
   * delle due cambia, quella che conta e' l'altra: il backend butta via
   * qualunque chiave non abbia dichiarato. */
  const raccolta = {
    integration_version: versioneIntegrazione(),
    ha_version: await haVersion(),
    locale: clean(doc?.documentElement?.lang),
    panel_section: paginaAttiva(),
    user_agent: clean(root.navigator?.userAgent).slice(0, 190),
  };
  return Object.fromEntries(
    Object.entries(raccolta).filter(
      ([chiave, valore]) => valore && DIAGNOSTIC_KEYS.includes(chiave),
    ),
  );
}

/* ─── Il foglio di stile ───────────────────────────────────────────────── */

const CSS = `
.dm-tkt-card { cursor: pointer; }
.dm-tkt-badge { display:inline-flex; align-items:center; justify-content:center;
  min-width:20px; height:20px; padding:0 6px; margin-left:8px; border-radius:10px;
  background:var(--accent,#0ea5e9); color:#fff; font-size:11px; font-weight:800; }
.dm-tkt-body { display:flex; flex-direction:column; gap:16px; }
.dm-tkt-tabs { display:flex; gap:8px; flex-wrap:wrap; }
.dm-tkt-tab { flex:1 1 90px; padding:10px 12px; border-radius:14px; cursor:pointer;
  border:1px solid var(--card-border,#e2e8f0); background:var(--surface-3,#f1f5f9);
  color:var(--text,#0f172a); font-size:13px; font-weight:700; text-align:center; }
.dm-tkt-tab.attiva { background:var(--accent,#0ea5e9); color:#fff; border-color:transparent; }
.dm-tkt-tipi { display:flex; gap:8px; flex-wrap:wrap; }
.dm-tkt-tipo { flex:1 1 90px; padding:14px 8px; border-radius:16px; cursor:pointer;
  border:2px solid var(--card-border,#e2e8f0); background:var(--surface-3,#f1f5f9);
  color:var(--text,#0f172a); display:flex; flex-direction:column; align-items:center; gap:6px;
  font-size:12px; font-weight:700; }
.dm-tkt-tipo.attivo { border-color:var(--accent,#0ea5e9); background:rgba(14,165,233,0.12); }
.dm-tkt-tipo .dm-tkt-tipo-ico { font-size:22px; line-height:1; }
.dm-tkt-campo { display:flex; flex-direction:column; gap:6px; }
.dm-tkt-campo label { font-size:12px; font-weight:700; color:var(--text-dim,#64748b); }
.dm-tkt-campo input, .dm-tkt-campo textarea { width:100%; box-sizing:border-box;
  padding:11px 13px; border-radius:13px; border:1px solid var(--card-border,#e2e8f0);
  background:var(--card-bg,#fff); color:var(--text,#0f172a); font-size:14px;
  font-family:inherit; }
.dm-tkt-campo textarea { min-height:120px; resize:vertical; }
.dm-tkt-conta { font-size:11px; color:var(--text-dim,#64748b); text-align:right; }
.dm-tkt-diag { border:1px solid var(--card-border,#e2e8f0); border-radius:13px; padding:10px 13px;
  background:var(--surface-3,#f1f5f9); }
.dm-tkt-diag summary { cursor:pointer; font-size:12px; font-weight:700;
  color:var(--text-dim,#64748b); }
.dm-tkt-diag dl { margin:10px 0 0; display:grid; grid-template-columns:auto 1fr;
  gap:4px 12px; font-size:12px; }
.dm-tkt-diag dt { color:var(--text-dim,#64748b); }
.dm-tkt-diag dd { margin:0; color:var(--text,#0f172a); word-break:break-word; }
.dm-tkt-azioni { display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap; }
.dm-tkt-btn { padding:11px 20px; border-radius:14px; border:none; cursor:pointer;
  font-size:13px; font-weight:800; background:var(--accent,#0ea5e9); color:#fff; }
.dm-tkt-btn[disabled] { opacity:0.5; cursor:default; }
.dm-tkt-btn.chiaro { background:var(--surface-3,#f1f5f9); color:var(--text,#0f172a);
  border:1px solid var(--card-border,#e2e8f0); }
.dm-tkt-avviso { padding:10px 13px; border-radius:13px; font-size:13px; font-weight:600;
  background:rgba(14,165,233,0.12); color:var(--text,#0f172a); }
.dm-tkt-avviso.male { background:rgba(220,38,38,0.12); }
.dm-tkt-elenco { display:flex; flex-direction:column; gap:10px; }
.dm-tkt-voce { border:1px solid var(--card-border,#e2e8f0); border-radius:16px;
  padding:13px 15px; background:var(--card-bg,#fff); }
.dm-tkt-voce-testa { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.dm-tkt-voce-tit { flex:1 1 auto; font-size:14px; font-weight:800; color:var(--text,#0f172a);
  word-break:break-word; }
.dm-tkt-stato { font-size:11px; font-weight:800; padding:3px 9px; border-radius:9px;
  background:var(--surface-3,#f1f5f9); color:var(--text-dim,#64748b); white-space:nowrap; }
.dm-tkt-stato[data-stato="risolto"] { background:rgba(21,128,61,0.15); color:#15803d; }
.dm-tkt-stato[data-stato="in-carico"] { background:rgba(249,115,22,0.15); color:#c2410c; }
.dm-tkt-stato[data-stato="bozza"] { background:rgba(100,116,139,0.15); }
.dm-tkt-voce-corpo { margin:8px 0 0; font-size:13px; color:var(--text-dim,#64748b);
  white-space:pre-wrap; word-break:break-word; }
.dm-tkt-risposta { margin-top:9px; padding:9px 12px; border-radius:12px;
  background:rgba(14,165,233,0.10); font-size:13px; color:var(--text,#0f172a);
  white-space:pre-wrap; word-break:break-word; }
.dm-tkt-voce-pie { display:flex; gap:10px; align-items:center; flex-wrap:wrap;
  margin-top:9px; font-size:11px; color:var(--text-dim,#64748b); }
.dm-tkt-link { color:var(--accent,#0ea5e9); font-weight:700; text-decoration:none; }
.dm-tkt-tolgi { background:none; border:none; cursor:pointer; padding:0;
  color:var(--text-dim,#64748b); font-size:11px; font-weight:700; text-decoration:underline; }
.dm-tkt-vuoto { padding:26px 10px; text-align:center; font-size:13px;
  color:var(--text-dim,#64748b); }
@media (max-width:520px) { .dm-tkt-tipo { flex-basis:calc(33% - 8px); } }
`;

/* ─── La tessera in Configurazione ─────────────────────────────────────── */

function tesseraMarkup() {
  const daInviare = state.tickets.filter((ticket) => ticket.state === "bozza").length;
  const pallino = daInviare ? `<span class="dm-tkt-badge">${daInviare}</span>` : "";
  return `
    <div class="cfg-card-ico" style="--cc-rgb: 14,165,233;">🎫</div>
    <div class="cfg-card-txt">
      <div class="cfg-card-nm">${esc(t("Segnalazioni", "Reports"))}${pallino}</div>
      <div class="cfg-card-ds">${esc(
        t(
          "Segnala un difetto, proponi un'idea o chiedi aiuto senza uscire dalla plancia",
          "Report a bug, suggest an idea or ask for help without leaving the dashboard",
        ),
      )}</div>
    </div>
    <div class="cfg-card-arrow">›</div>`;
}

function installaTessera() {
  const griglia = doc?.querySelector?.("#page-config .cfg-grid");
  if (!griglia) return false;
  let tessera = doc.getElementById("dm-tkt-card");
  if (!tessera) {
    tessera = doc.createElement("div");
    tessera.className = "cfg-card dm-tkt-card";
    tessera.id = "dm-tkt-card";
    tessera.addEventListener("click", () => apri());
    griglia.append(tessera);
  }
  tessera.innerHTML = tesseraMarkup();
  return true;
}

/* ─── La finestra ──────────────────────────────────────────────────────── */

function finestra() {
  let modale = doc?.getElementById?.("dm-tkt-modal");
  if (modale) return modale;
  if (!doc?.body) return null;
  modale = doc.createElement("div");
  modale.className = "modal-wrapper";
  modale.id = "dm-tkt-modal";
  modale.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true">
      <div class="ev-waw-header">
        <h3 class="ev-waw-title">🎫 <span data-dm-tkt="titolo"></span></h3>
        <button class="ev-waw-close" type="button" data-dm-tkt="chiudi"></button>
      </div>
      <div class="dm-tkt-body" data-dm-tkt="corpo"></div>
    </div>`;
  modale.addEventListener("click", (event) => {
    if (event.target === modale) chiudi();
  });
  modale.querySelector('[data-dm-tkt="chiudi"]')?.addEventListener("click", () => chiudi());
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
  doc?.getElementById?.("dm-tkt-modal")?.classList.remove("show");
}

async function ricarica() {
  try {
    const risposta = await chiedi(WS_LIST);
    state.tickets = Array.isArray(risposta?.tickets) ? risposta.tickets : [];
    state.delivery = Boolean(risposta?.delivery);
    state.console = Boolean(risposta?.console);
  } catch (_error) {
    /* La finestra si apre lo stesso: quello che c'e' da scrivere si scrive
     * anche senza aver letto l'elenco, e l'elenco si riprende da solo. */
  }
  installaTessera();
  disegna();
}

/* ─── Il disegno ───────────────────────────────────────────────────────── */

function schede() {
  const voci = [
    ["nuova", t("Nuova", "New")],
    ["mie", t("Le mie", "Mine")],
  ];
  if (state.console) voci.push(["console", t("Console", "Console")]);
  return `<div class="dm-tkt-tabs">${voci
    .map(
      ([id, nome]) =>
        `<button type="button" class="dm-tkt-tab${
          state.tab === id ? " attiva" : ""
        }" data-dm-tab="${id}">${esc(nome)}</button>`,
    )
    .join("")}</div>`;
}

function avvisoMarkup() {
  if (!state.avviso) return "";
  const male = state.avviso.startsWith("!");
  return `<div class="dm-tkt-avviso${male ? " male" : ""}">${esc(
    male ? state.avviso.slice(1) : state.avviso,
  )}</div>`;
}

function moduloMarkup() {
  const tipi = TIPI.map(
    (tipo) => `
      <button type="button" class="dm-tkt-tipo${
        state.tipo === tipo.id ? " attivo" : ""
      }" data-dm-tipo="${tipo.id}">
        <span class="dm-tkt-tipo-ico">${tipo.icona}</span>
        <span>${esc(tipo.nome())}</span>
      </button>`,
  ).join("");
  const avvisoConsegna = state.delivery
    ? ""
    : `<div class="dm-tkt-avviso">${esc(
        t(
          "Il servizio non e' configurato: la segnalazione resta qui e partira' da sola quando lo sara'.",
          "The service is not configured: the report stays here and will be sent on its own once it is.",
        ),
      )}</div>`;
  return `
    ${avvisoConsegna}
    <div class="dm-tkt-tipi">${tipi}</div>
    <div class="dm-tkt-campo">
      <label for="dm-tkt-titolo">${esc(t("Titolo", "Title"))}</label>
      <input id="dm-tkt-titolo" type="text" maxlength="${MAX_TITOLO}"
        placeholder="${esc(t("In una riga: cosa succede", "In one line: what happens"))}">
    </div>
    <div class="dm-tkt-campo">
      <label for="dm-tkt-corpo">${esc(t("Descrizione", "Description"))}</label>
      <textarea id="dm-tkt-corpo" maxlength="${MAX_CORPO}"
        placeholder="${esc(
          t(
            "Cosa hai fatto, cosa ti aspettavi, cosa e' successo invece.",
            "What you did, what you expected, what happened instead.",
          ),
        )}"></textarea>
      <div class="dm-tkt-conta" data-dm-tkt="conta">0 / ${MAX_CORPO}</div>
    </div>
    <div class="dm-tkt-campo">
      <label for="dm-tkt-contatto">${esc(
        t("Come ricontattarti (facoltativo)", "How to reach you (optional)"),
      )}</label>
      <input id="dm-tkt-contatto" type="text" maxlength="${MAX_CONTATTO}"
        placeholder="${esc(t("Lascia vuoto se non vuoi", "Leave empty if you prefer"))}">
    </div>
    <details class="dm-tkt-diag">
      <summary>${esc(t("Cosa viene inviato", "What gets sent"))}</summary>
      <dl data-dm-tkt="diag"></dl>
    </details>
    <div class="dm-tkt-azioni">
      <button type="button" class="dm-tkt-btn" data-dm-tkt="invia" ${
        state.busy ? "disabled" : ""
      }>${esc(state.busy ? t("Invio…", "Sending…") : t("Invia", "Send"))}</button>
    </div>`;
}

function statoMarkup(stato) {
  const voce = STATI[stato] || STATI.bozza;
  return `<span class="dm-tkt-stato" data-stato="${esc(stato)}">${
    voce.icona
  } ${esc(voce.nome())}</span>`;
}

export function voceMarkup(ticket) {
  const tipo = TIPI.find((voce) => voce.id === ticket.type) || TIPI[0];
  const data = ticket.created_at ? new Date(ticket.created_at).toLocaleDateString() : "";
  const risposta = ticket.reply ? `<div class="dm-tkt-risposta">${esc(ticket.reply)}</div>` : "";
  const errore = ticket.delivery_error
    ? `<div class="dm-tkt-voce-pie">⚠︎ ${esc(ticket.delivery_error)}</div>`
    : "";
  const issue = ticket.issue_url
    ? `<a class="dm-tkt-link" href="${esc(
        ticket.issue_url,
      )}" target="_blank" rel="noreferrer noopener">${esc(
        t("Vedi la discussione", "See the discussion"),
      )}</a>`
    : "";
  return `
    <div class="dm-tkt-voce">
      <div class="dm-tkt-voce-testa">
        <span>${tipo.icona}</span>
        <span class="dm-tkt-voce-tit">${esc(ticket.title)}</span>
        ${statoMarkup(ticket.state)}
      </div>
      <p class="dm-tkt-voce-corpo">${esc(ticket.body)}</p>
      ${risposta}
      ${errore}
      <div class="dm-tkt-voce-pie">
        <span>${esc(data)}</span>
        ${issue}
        <button type="button" class="dm-tkt-tolgi" data-dm-tolgi="${esc(
          ticket.id,
        )}">${esc(t("Elimina", "Delete"))}</button>
      </div>
    </div>`;
}

function elencoMarkup() {
  if (!state.tickets.length) {
    return `<div class="dm-tkt-vuoto">${esc(
      t("Non hai ancora aperto nessuna segnalazione.", "You have not opened any report yet."),
    )}</div>`;
  }
  return `
    <div class="dm-tkt-elenco">${state.tickets.map(voceMarkup).join("")}</div>
    <div class="dm-tkt-azioni">
      <button type="button" class="dm-tkt-btn chiaro" data-dm-tkt="aggiorna" ${
        state.busy ? "disabled" : ""
      }>${esc(t("Aggiorna", "Refresh"))}</button>
    </div>`;
}

function consoleMarkup() {
  if (state.queue === null) {
    return `<div class="dm-tkt-vuoto">${esc(t("Carico la coda…", "Loading the queue…"))}</div>`;
  }
  if (!state.queue.length) {
    return `<div class="dm-tkt-vuoto">${esc(t("Coda vuota.", "The queue is empty."))}</div>`;
  }
  return `<div class="dm-tkt-elenco">${state.queue
    .map((ticket) => {
      const tipo = TIPI.find((voce) => voce.id === ticket.type) || TIPI[0];
      const remoto = esc(clean(ticket.remote_id));
      const scelte = ["in-carico", "risolto", "chiuso"]
        .map(
          (stato) =>
            `<button type="button" class="dm-tkt-tolgi" data-dm-stato="${stato}"
              data-dm-remoto="${remoto}">${esc(STATI[stato].nome())}</button>`,
        )
        .join("");
      return `
        <div class="dm-tkt-voce">
          <div class="dm-tkt-voce-testa">
            <span>${tipo.icona}</span>
            <span class="dm-tkt-voce-tit">${esc(clean(ticket.title))}</span>
            ${statoMarkup(clean(ticket.state) || "inviato")}
          </div>
          <p class="dm-tkt-voce-corpo">${esc(clean(ticket.body))}</p>
          <div class="dm-tkt-voce-pie">${scelte}</div>
        </div>`;
    })
    .join("")}</div>`;
}

function disegna() {
  const modale = doc?.getElementById?.("dm-tkt-modal");
  if (!modale) return;
  modale.querySelector('[data-dm-tkt="titolo"]').textContent = t("Segnalazioni", "Reports");
  modale.querySelector('[data-dm-tkt="chiudi"]').textContent = t("Chiudi", "Close");
  const corpo = modale.querySelector('[data-dm-tkt="corpo"]');
  let pannello = "";
  if (state.tab === "mie") pannello = elencoMarkup();
  else if (state.tab === "console") pannello = consoleMarkup();
  else pannello = moduloMarkup();
  corpo.innerHTML = schede() + avvisoMarkup() + pannello;
  agganciaEventi(corpo);
  if (state.tab === "nuova") mostraDiagnostica(corpo);
}

async function mostraDiagnostica(corpo) {
  const lista = corpo.querySelector('[data-dm-tkt="diag"]');
  if (!lista) return;
  const voci = await diagnostica();
  const nomi = {
    integration_version: t("Versione plancia", "Dashboard version"),
    ha_version: t("Versione Home Assistant", "Home Assistant version"),
    locale: t("Lingua", "Language"),
    panel_section: t("Pagina", "Page"),
    user_agent: t("Browser", "Browser"),
  };
  lista.innerHTML = Object.entries(voci)
    .map(([chiave, valore]) => `<dt>${esc(nomi[chiave] || chiave)}</dt><dd>${esc(valore)}</dd>`)
    .join("");
}

/* ─── I gesti ──────────────────────────────────────────────────────────── */

function agganciaEventi(corpo) {
  corpo.querySelectorAll("[data-dm-tab]").forEach((bottone) => {
    bottone.addEventListener("click", () => {
      state.tab = bottone.dataset.dmTab;
      state.avviso = "";
      disegna();
      if (state.tab === "console" && state.queue === null) caricaCoda();
    });
  });
  corpo.querySelectorAll("[data-dm-tipo]").forEach((bottone) => {
    bottone.addEventListener("click", () => {
      state.tipo = bottone.dataset.dmTipo;
      disegna();
    });
  });
  corpo.querySelector('[data-dm-tkt="invia"]')?.addEventListener("click", invia);
  corpo.querySelector('[data-dm-tkt="aggiorna"]')?.addEventListener("click", sincronizza);
  corpo.querySelectorAll("[data-dm-tolgi]").forEach((bottone) => {
    bottone.addEventListener("click", () => elimina(bottone.dataset.dmTolgi));
  });
  corpo.querySelectorAll("[data-dm-stato]").forEach((bottone) => {
    bottone.addEventListener("click", () =>
      rispondi(bottone.dataset.dmRemoto, bottone.dataset.dmStato),
    );
  });
  const corpoTesto = corpo.querySelector("#dm-tkt-corpo");
  const conta = corpo.querySelector('[data-dm-tkt="conta"]');
  if (corpoTesto && conta) {
    corpoTesto.addEventListener("input", () => {
      conta.textContent = `${corpoTesto.value.length} / ${MAX_CORPO}`;
    });
  }
}

async function invia() {
  const modale = doc?.getElementById?.("dm-tkt-modal");
  const titolo = clean(modale?.querySelector("#dm-tkt-titolo")?.value);
  const corpo = clean(modale?.querySelector("#dm-tkt-corpo")?.value);
  const contatto = clean(modale?.querySelector("#dm-tkt-contatto")?.value);
  /* Il primo filtro e' qui, e serve a chi scrive: la stessa risposta dal
   * backend arriverebbe in italiano e dopo un giro sulla rete. */
  if (!titolo) {
    state.avviso = `!${t("Manca il titolo.", "The title is missing.")}`;
    disegna();
    return;
  }
  if (!corpo) {
    state.avviso = `!${t("Manca la descrizione.", "The description is missing.")}`;
    disegna();
    return;
  }
  state.busy = true;
  state.avviso = "";
  disegna();
  try {
    const risposta = await chiedi(WS_CREATE, {
      ticket_type: state.tipo,
      title: titolo,
      body: corpo,
      contact: contatto,
      diagnostics: await diagnostica(),
    });
    state.avviso = risposta?.delivered
      ? t("Inviata. Grazie.", "Sent. Thank you.")
      : t(
          "Salvata. Partira' da sola appena il servizio risponde.",
          "Saved. It will be sent as soon as the service answers.",
        );
    state.tab = "mie";
  } catch (errore) {
    state.avviso = `!${clean(errore?.message) || t("Non riuscita.", "It did not work.")}`;
  } finally {
    state.busy = false;
    await ricarica();
  }
}

async function sincronizza() {
  state.busy = true;
  disegna();
  try {
    const risposta = await chiedi(WS_SYNC);
    state.tickets = Array.isArray(risposta?.tickets) ? risposta.tickets : state.tickets;
    state.delivery = Boolean(risposta?.delivery);
  } catch (errore) {
    state.avviso = `!${clean(errore?.message) || t("Non riuscita.", "It did not work.")}`;
  } finally {
    state.busy = false;
    installaTessera();
    disegna();
  }
}

async function elimina(id) {
  if (!id) return;
  try {
    await chiedi(WS_DELETE, { ticket_id: id });
  } catch (errore) {
    state.avviso = `!${clean(errore?.message) || t("Non riuscita.", "It did not work.")}`;
  }
  await ricarica();
}

async function caricaCoda() {
  try {
    const risposta = await chiedi(WS_QUEUE);
    state.queue = Array.isArray(risposta?.tickets) ? risposta.tickets : [];
  } catch (errore) {
    state.queue = [];
    state.avviso = `!${clean(errore?.message) || t("Coda non raggiungibile.", "Queue unreachable.")}`;
  }
  disegna();
}

async function rispondi(remoteId, stato) {
  if (!remoteId) return;
  try {
    await chiedi(WS_ANSWER, { remote_id: remoteId, state: stato });
    state.queue = null;
    await caricaCoda();
  } catch (errore) {
    state.avviso = `!${clean(errore?.message) || t("Non riuscita.", "It did not work.")}`;
    disegna();
  }
}

/* ─── Installazione ────────────────────────────────────────────────────── */

export function installSegnalazioniSection() {
  if (!doc || state.installed) return state;
  state.installed = true;
  installStyle("dm-tkt-style", CSS);
  const prova = () => {
    if (installaTessera()) ricarica();
  };
  root.addEventListener?.("dashboardmodern:legacy-ready", prova);
  root.addEventListener?.("dashboardmodern:runtime-ready", prova);
  /* La pagina Configurazione esiste dall'inizio nel documento, ma la griglia
   * viene riempita dal runtime: si riprova quando la si apre. */
  doc.addEventListener(
    "click",
    (event) => {
      if (event.target?.closest?.('[data-tab="config"]')) {
        root.setTimeout?.(prova, 0);
      }
    },
    true,
  );
  prova();
  root.DashboardModernSegnalazioni = Object.freeze({ apri, chiudi });
  return state;
}

/** Seme per le prove: dimentica l'installazione e la finestra. */
export function uninstallSegnalazioniSection() {
  doc?.getElementById?.("dm-tkt-modal")?.remove();
  doc?.getElementById?.("dm-tkt-card")?.remove();
  state.installed = false;
  state.tickets = [];
  state.queue = null;
  state.tab = "nuova";
}

installSegnalazioniSection();
