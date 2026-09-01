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
  account: { connected: false, login: "", maintainer: false },
  /* Il giro dell'autorizzazione, mentre e' in corso: il codice da digitare,
   * l'attesa che GitHub ha chiesto, e il timer che sta interrogando. */
  auth: null,
  authTimer: 0,
  queue: null,
  /* La segnalazione appena aperta, finche' non la si congeda. Serve al
   * riquadro che spiega come allegare foto e video: e' il momento in cui chi
   * ha appena scritto ha ancora il file sotto mano. */
  appena: null,
  filtro: "aperte",
  tab: "nuova",
  tipo: "bug",
  /* Quello che si sta scrivendo. Sta qui e non solo nel DOM perche' ogni
   * ridisegno rifa' il modulo da capo: senza, cambiare tipo a meta' frase
   * cancellava la frase. */
  bozza: { title: "", body: "", contact: "" },
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
const WS_AUTH_START = "dashboardmodern/tickets/auth/start";
const WS_AUTH_POLL = "dashboardmodern/tickets/auth/poll";
const WS_AUTH_FORGET = "dashboardmodern/tickets/auth/forget";

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
  WS_AUTH_START,
  WS_AUTH_POLL,
  WS_AUTH_FORGET,
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

/* I tre tipi. Ognuno porta la sua spiegazione e il suo suggerimento, perche'
 * la differenza fra «non funziona» e «vorrei che facesse» la sa chi scrive
 * solo se gliela si racconta: una segnalazione ben incasellata e' meta' del
 * lavoro di chi la legge. */
const TIPI = [
  {
    id: "bug",
    icona: "🐞",
    rgb: "220,38,38",
    nome: () => t("Non funziona", "Something is broken"),
    che: () =>
      t(
        "Qualcosa si comporta in modo diverso da come dovrebbe",
        "Something behaves differently from how it should",
      ),
    titolo: () => t("In una riga: cosa succede", "In one line: what happens"),
    corpo: () =>
      t(
        "Cosa hai fatto, cosa ti aspettavi, cosa e' successo invece.",
        "What you did, what you expected, what happened instead.",
      ),
  },
  {
    id: "feature",
    icona: "✨",
    rgb: "124,58,237",
    nome: () => t("Vorrei che facesse", "I would like it to"),
    che: () =>
      t(
        "Un'idea, una cosa che manca, un modo migliore",
        "An idea, something missing, a better way",
      ),
    titolo: () => t("In una riga: cosa vorresti", "In one line: what you would like"),
    corpo: () =>
      t(
        "A cosa ti servirebbe, e come te la immagini nella plancia.",
        "What you would need it for, and how you picture it in the dashboard.",
      ),
  },
  {
    id: "assistenza",
    icona: "💬",
    rgb: "14,165,233",
    nome: () => t("Non ci riesco", "I cannot manage"),
    che: () =>
      t("Serve una mano a configurare o a capire", "You need a hand configuring or understanding"),
    titolo: () =>
      t("In una riga: cosa stai provando a fare", "In one line: what you are trying to do"),
    corpo: () =>
      t(
        "Cosa vorresti ottenere e dove ti sei fermato.",
        "What you are trying to achieve and where you got stuck.",
      ),
  },
];

function tipoAttivo(id = state.tipo) {
  return TIPI.find((voce) => voce.id === id) || TIPI[0];
}

/* Gli stati. Il colore non porta mai da solo l'informazione: accanto c'e'
 * sempre un segno e una parola, perche' una pastiglia colorata e basta la
 * legge chi distingue i colori e nessun altro. */
const STATI = {
  bozza: { icona: "○", nome: () => t("Da inviare", "To send") },
  inviato: { icona: "●", nome: () => t("Inviata", "Sent") },
  "in-carico": { icona: "◐", nome: () => t("Presa in carico", "Being worked on") },
  risolto: { icona: "✓", nome: () => t("Risolta", "Solved") },
  chiuso: { icona: "×", nome: () => t("Archiviata", "Archived") },
};

/* Le colonne del cruscotto: tre numeri, non un grafico. Un conteggio per
 * stato e' una cifra sola per colonna, e una cifra sola si legge meglio
 * scritta grande che disegnata. */
const COLONNE = [
  {
    id: "inviato",
    icona: "📥",
    rgb: "14,165,233",
    nome: () => t("Nuove", "New"),
    tiene: (stato) => stato === "inviato",
  },
  {
    id: "in-carico",
    icona: "🔧",
    rgb: "249,115,22",
    nome: () => t("In lavorazione", "In progress"),
    tiene: (stato) => stato === "in-carico",
  },
  {
    id: "chiuse",
    icona: "✅",
    rgb: "22,163,74",
    nome: () => t("Chiuse", "Closed"),
    tiene: (stato) => stato === "risolto" || stato === "chiuso",
  },
];

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

/* ─── Il collegamento a GitHub ─────────────────────────────────────────────
 *
 * Lo stesso identico giro che HACS fa gia' fare a chiunque installi questa
 * plancia: un codice da digitare su github.com/login/device. Chi e' arrivato
 * fin qui l'ha gia' fatto una volta, e lo riconosce — ed e' la ragione per cui
 * le segnalazioni non hanno bisogno di nessun servizio di mezzo.
 *
 * Il gettone non passa mai da qui. Da questa parte si sa chi ha autorizzato e
 * se e' lui a tenere la repository; il resto lo tiene il backend. */

function statoCollegamento() {
  if (!state.delivery) {
    return `<div class="dm-tkt-avviso">${esc(
      t(
        "L'invio non e' configurato su questa plancia: la segnalazione resta qui e partira' da sola quando lo sara'.",
        "Sending is not configured on this dashboard: the report stays here and will be sent on its own once it is.",
      ),
    )}</div>`;
  }
  if (state.auth) {
    return `
      <div class="dm-tkt-avviso dm-tkt-device">
        <div>${esc(
          t(
            "Apri github.com/login/device e digita questo codice:",
            "Open github.com/login/device and type this code:",
          ),
        )}</div>
        <div class="dm-tkt-codice">${esc(state.auth.user_code)}</div>
        <div class="dm-tkt-azioni">
          <a class="dm-tkt-btn" href="${esc(state.auth.verification_uri)}"
             target="_blank" rel="noreferrer noopener">${esc(t("Apri GitHub", "Open GitHub"))}</a>
          <button type="button" class="dm-tkt-btn chiaro" data-dm-tkt="annulla">${esc(
            t("Annulla", "Cancel"),
          )}</button>
        </div>
      </div>`;
  }
  if (state.account.connected) {
    return `
      <div class="dm-tkt-avviso dm-tkt-collegato">
        <span>${esc(t("Collegato come", "Connected as"))} <b>${esc(state.account.login)}</b></span>
        <button type="button" class="dm-tkt-tolgi" data-dm-tkt="scollega">${esc(
          t("Scollega", "Disconnect"),
        )}</button>
      </div>`;
  }
  return `
    <div class="dm-tkt-avviso">
      <div>${esc(
        t(
          "Per inviare serve il tuo account GitHub: lo stesso che ti ha gia' chiesto HACS, con lo stesso codice da digitare.",
          "Sending needs your GitHub account: the same one HACS already asked you for, with the same code to type.",
        ),
      )}</div>
      <div class="dm-tkt-azioni">
        <button type="button" class="dm-tkt-btn" data-dm-tkt="collega">${esc(
          t("Collega GitHub", "Connect GitHub"),
        )}</button>
      </div>
    </div>`;
}

async function collega() {
  state.avviso = "";
  try {
    const avvio = await chiedi(WS_AUTH_START);
    state.auth = avvio;
    disegna();
    attendiAutorizzazione(avvio);
  } catch (errore) {
    state.avviso = `!${clean(errore?.message) || t("Non riuscita.", "It did not work.")}`;
    disegna();
  }
}

function fermaAttesa() {
  if (state.authTimer) root.clearTimeout?.(state.authTimer);
  state.authTimer = 0;
}

/* L'attesa la decide GitHub, non noi: `interval` arriva nella risposta, e
 * `slow_down` lo allunga. Insistere piu' in fretta si paga con un rifiuto. */
function attendiAutorizzazione(avvio) {
  fermaAttesa();
  const scadenza = Date.now() + (Number(avvio.expires_in) || 900) * 1000;
  const giro = async (attesa) => {
    if (!state.auth || Date.now() > scadenza) {
      state.auth = null;
      state.avviso = `!${t("Il codice e' scaduto: riprova.", "The code expired: try again.")}`;
      disegna();
      return;
    }
    try {
      const risposta = await chiedi(WS_AUTH_POLL, { device_code: avvio.device_code });
      if (risposta?.pending) {
        const prossima = Math.max(Number(risposta.interval) || attesa, 1) * 1000;
        state.authTimer = root.setTimeout?.(() => giro(prossima / 1000), prossima);
        return;
      }
      state.auth = null;
      if (risposta?.account) state.account = risposta.account;
      state.avviso = risposta?.delivered
        ? t(
            "Collegato. Le segnalazioni in attesa sono partite.",
            "Connected. Pending reports were sent.",
          )
        : t("Collegato.", "Connected.");
      await ricarica();
    } catch (errore) {
      state.auth = null;
      state.avviso = `!${clean(errore?.message) || t("Non riuscita.", "It did not work.")}`;
      disegna();
    }
  };
  const attesa = Math.max(Number(avvio.interval) || 5, 1);
  state.authTimer = root.setTimeout?.(() => giro(attesa), attesa * 1000);
}

function annullaCollegamento() {
  fermaAttesa();
  state.auth = null;
  disegna();
}

async function scollega() {
  fermaAttesa();
  try {
    await chiedi(WS_AUTH_FORGET);
    state.avviso = t(
      "Scollegato da qui. Per revocare del tutto l'accesso, toglilo anche dalle applicazioni autorizzate su github.com.",
      "Disconnected here. To revoke access entirely, remove it from your authorized apps on github.com too.",
    );
  } catch (errore) {
    state.avviso = `!${clean(errore?.message) || t("Non riuscita.", "It did not work.")}`;
  }
  await ricarica();
}

/* ─── Il foglio di stile ───────────────────────────────────────────────── */

const CSS = `
.dm-tkt-card { cursor: pointer; }
.dm-tkt-badge { display:inline-flex; align-items:center; justify-content:center;
  min-width:20px; height:20px; padding:0 6px; margin-left:8px; border-radius:10px;
  background:var(--accent,#0ea5e9); color:#fff; font-size:11px; font-weight:800; }

/* La finestra: larga come una pagina, perche' il cruscotto e' una pagina. */
#dm-tkt-modal .modal-card.dm-tkt-pannello { max-width:760px; padding:20px; }
.dm-tkt-hero { position:relative; margin-bottom:16px; }
.dm-tkt-hero .cfg-hero-txt { flex:1; min-width:0; }
.dm-tkt-hero .ev-waw-close { flex-shrink:0; }
.dm-tkt-body { display:flex; flex-direction:column; gap:14px; }

/* Le linguette. */
.dm-tkt-tabs { display:flex; gap:8px; flex-wrap:wrap; }
.dm-tkt-tab { flex:1 1 90px; padding:10px 12px; border-radius:14px; cursor:pointer;
  border:1px solid var(--card-border,#e2e8f0); background:var(--surface-3,#f1f5f9);
  color:var(--text,#0f172a); font-size:13px; font-weight:700; text-align:center;
  transition:transform .18s cubic-bezier(.34,1.56,.64,1), background .2s; }
.dm-tkt-tab:hover { transform:translateY(-2px); }
.dm-tkt-tab.attiva { background:var(--accent,#0ea5e9); color:#fff;
  border-color:transparent; }

/* I passi del modulo: un'etichetta piccola che dice a che punto sei. */
.dm-tkt-passo { font-size:10px; font-weight:800; letter-spacing:1.5px;
  text-transform:uppercase; color:var(--text-dim,#64748b); margin-top:4px; }

/* Le tre schede del tipo. */
.dm-tkt-tipi { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
.dm-tkt-tipo { padding:14px 10px; border-radius:18px; cursor:pointer;
  border:2px solid var(--card-border,#e2e8f0); background:var(--surface-3,#f1f5f9);
  color:var(--text,#0f172a); display:flex; flex-direction:column; align-items:center;
  gap:6px; text-align:center; transition:transform .18s cubic-bezier(.34,1.56,.64,1),
  border-color .2s, background .2s; }
.dm-tkt-tipo:hover { transform:translateY(-3px); }
.dm-tkt-tipo.attivo { border-color:rgb(var(--tk-rgb,14,165,233));
  background:rgba(var(--tk-rgb,14,165,233),0.10); }
.dm-tkt-tipo-ico { font-size:24px; line-height:1; }
.dm-tkt-tipo-nm { font-size:13px; font-weight:800; }
.dm-tkt-tipo-ds { font-size:11px; line-height:1.35; color:var(--text-dim,#64748b); }

/* I campi. */
.dm-tkt-campo { display:flex; flex-direction:column; gap:6px; }
.dm-tkt-campo label { font-size:12px; font-weight:700; color:var(--text-dim,#64748b); }
.dm-tkt-campo input, .dm-tkt-campo textarea { width:100%; box-sizing:border-box;
  padding:11px 13px; border-radius:13px; border:1px solid var(--card-border,#e2e8f0);
  background:var(--card-bg,#fff); color:var(--text,#0f172a); font-size:14px;
  font-family:inherit; }
.dm-tkt-campo input:focus, .dm-tkt-campo textarea:focus { outline:none;
  border-color:var(--accent,#0ea5e9);
  box-shadow:0 0 0 3px rgba(var(--accent-rgb,14,165,233),0.18); }
.dm-tkt-campo textarea { min-height:120px; resize:vertical; line-height:1.5; }
.dm-tkt-conta { font-size:11px; color:var(--text-dim,#64748b); text-align:right; }

/* Cosa parte. */
.dm-tkt-diag { border:1px solid var(--card-border,#e2e8f0); border-radius:13px;
  padding:10px 13px; background:var(--surface-3,#f1f5f9); }
.dm-tkt-diag summary { cursor:pointer; font-size:12px; font-weight:700;
  color:var(--text-dim,#64748b); }
.dm-tkt-diag dl { margin:10px 0 0; display:grid; grid-template-columns:auto 1fr;
  gap:4px 12px; font-size:12px; }
.dm-tkt-diag dt { color:var(--text-dim,#64748b); }
.dm-tkt-diag dd { margin:0; color:var(--text,#0f172a); word-break:break-word; }
.dm-tkt-pubblica { display:flex; gap:10px; align-items:flex-start; padding:11px 14px;
  border-radius:14px; font-size:12px; line-height:1.5;
  background:rgba(249,115,22,0.12); color:var(--text,#0f172a); }
.dm-tkt-pubblica-ico { font-size:16px; line-height:1.2; }
.dm-tkt-nota { display:flex; gap:10px; align-items:flex-start; padding:10px 13px;
  border-radius:13px; font-size:12px; line-height:1.5;
  background:var(--surface-3,#f1f5f9); color:var(--text-dim,#64748b); }
.dm-tkt-nota-ico { font-size:15px; line-height:1.25; }
.dm-tkt-aperta { display:flex; flex-direction:column; gap:11px; padding:15px 17px;
  border-radius:18px; background:rgba(22,163,74,0.12);
  border:1px solid rgba(22,163,74,0.25); }
.dm-tkt-aperta-testa { display:flex; gap:9px; align-items:center; font-size:14px;
  color:var(--text,#0f172a); }
.dm-tkt-aperta-ico { font-size:18px; line-height:1; }
.dm-tkt-aperta-testo { font-size:13px; line-height:1.55; color:var(--text,#0f172a); }

/* I tasti. */
.dm-tkt-azioni { display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap; }
.dm-tkt-btn { padding:11px 20px; border-radius:14px; border:none; cursor:pointer;
  font-size:13px; font-weight:800; background:var(--accent,#0ea5e9); color:#fff;
  transition:transform .18s cubic-bezier(.34,1.56,.64,1), filter .2s; }
.dm-tkt-btn:hover { transform:translateY(-2px); filter:brightness(1.05); }
.dm-tkt-btn[disabled] { opacity:.5; cursor:default; transform:none; }
.dm-tkt-btn.chiaro { background:var(--surface-3,#f1f5f9); color:var(--text,#0f172a);
  border:1px solid var(--card-border,#e2e8f0); }
.dm-tkt-avviso { padding:11px 14px; border-radius:14px; font-size:13px;
  line-height:1.5; font-weight:600; background:rgba(14,165,233,0.12);
  color:var(--text,#0f172a); }
.dm-tkt-avviso.male { background:rgba(220,38,38,0.12); }

/* Il collegamento a GitHub. */
.dm-tkt-device { display:flex; flex-direction:column; gap:10px; }
.dm-tkt-codice { font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
  font-size:26px; font-weight:800; letter-spacing:4px; text-align:center;
  padding:12px; border-radius:14px; background:var(--card-bg,#fff);
  color:var(--text,#0f172a); user-select:all; }
.dm-tkt-collegato { display:flex; align-items:center; gap:10px; flex-wrap:wrap;
  justify-content:space-between; }
a.dm-tkt-btn { text-decoration:none; display:inline-flex; align-items:center; }

/* L'elenco, di qua e di la'. */
.dm-tkt-elenco { display:flex; flex-direction:column; gap:12px; }
.dm-tkt-voce { border:1px solid var(--card-border,#e2e8f0); border-radius:18px;
  padding:15px 17px; background:var(--card-bg,#fff);
  box-shadow:var(--shadow-sculpted,0 4px 14px rgba(0,0,0,.05)); }
.dm-tkt-lavoro { border-left:4px solid rgb(var(--tk-rgb,14,165,233)); }
.dm-tkt-voce-testa { display:flex; align-items:center; gap:9px; flex-wrap:wrap; }
.dm-tkt-tipo-pill { font-size:18px; line-height:1; }
.dm-tkt-voce-tit { flex:1 1 auto; font-size:14px; font-weight:800;
  color:var(--text,#0f172a); word-break:break-word; }
.dm-tkt-stato { font-size:11px; font-weight:800; padding:3px 9px; border-radius:9px;
  background:var(--surface-3,#f1f5f9); color:var(--text-dim,#64748b);
  white-space:nowrap; }
.dm-tkt-stato[data-stato="risolto"] { background:rgba(22,163,74,0.15); color:#15803d; }
.dm-tkt-stato[data-stato="in-carico"] { background:rgba(249,115,22,0.15); color:#c2410c; }
.dm-tkt-stato[data-stato="inviato"] { background:rgba(14,165,233,0.15); color:#0369a1; }
.dm-tkt-stato[data-stato="bozza"] { background:rgba(100,116,139,0.15); }
.dm-tkt-voce-corpo { margin:9px 0 0; font-size:13px; line-height:1.55;
  color:var(--text-dim,#64748b); white-space:pre-wrap; word-break:break-word; }
.dm-tkt-risposta { margin-top:10px; padding:10px 13px; border-radius:13px;
  background:rgba(14,165,233,0.10); font-size:13px; line-height:1.5;
  color:var(--text,#0f172a); white-space:pre-wrap; word-break:break-word; }
.dm-tkt-voce-pie { display:flex; gap:10px; align-items:center; flex-wrap:wrap;
  margin-top:9px; font-size:11px; color:var(--text-dim,#64748b); }
.dm-tkt-link { color:var(--accent,#0ea5e9); font-weight:700; text-decoration:none; }
.dm-tkt-link:hover { text-decoration:underline; }
.dm-tkt-tolgi { background:none; border:none; cursor:pointer; padding:0;
  color:var(--text-dim,#64748b); font-size:11px; font-weight:700;
  text-decoration:underline; }
.dm-tkt-vuoto { display:flex; flex-direction:column; align-items:center; gap:12px;
  padding:34px 14px; text-align:center; font-size:13px;
  color:var(--text-dim,#64748b); }
.dm-tkt-vuoto-ico { font-size:38px; opacity:.55; }

/* Il cruscotto: i tre numeri e i filtri. */
.dm-tkt-kpi { margin-bottom:0; }
.dm-tkt-filtri { display:flex; gap:8px; flex-wrap:wrap; }
.dm-tkt-filtro { padding:7px 14px; border-radius:50px; cursor:pointer;
  border:1px solid var(--card-border,#e2e8f0); background:var(--surface-3,#f1f5f9);
  color:var(--text-dim,#64748b); font-size:12px; font-weight:700; }
.dm-tkt-filtro.attivo { background:var(--accent,#0ea5e9); color:#fff;
  border-color:transparent; }

@media (max-width:560px) {
  #dm-tkt-modal .modal-card.dm-tkt-pannello { padding:14px 12px; }
  .dm-tkt-tipi { grid-template-columns:1fr; }
  .dm-tkt-tipo { flex-direction:row; text-align:left; gap:12px; }
  .dm-tkt-tipo-ico { font-size:20px; }
  .dm-tkt-tipo-ds { display:none; }
  .dm-tkt-azioni .dm-tkt-btn { flex:1 1 auto; }
}
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
    <div class="modal-card dm-tkt-pannello" role="dialog" aria-modal="true"
         aria-labelledby="dm-tkt-titolo">
      <div class="cfg-hero dm-tkt-hero">
        <div class="cfg-hero-ico" aria-hidden="true">🎫</div>
        <div class="cfg-hero-txt">
          <div class="cfg-hero-title" id="dm-tkt-titolo"
               data-dm-tkt="titolo"></div>
          <div class="cfg-hero-sub" data-dm-tkt="sottotitolo"></div>
        </div>
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
  /* Chi chiude a meta' autorizzazione non deve lasciare dietro un timer che
   * continua a chiedere a GitHub per un quarto d'ora. */
  fermaAttesa();
  state.auth = null;
  state.appena = null;
  doc?.getElementById?.("dm-tkt-modal")?.classList.remove("show");
}

async function ricarica() {
  try {
    const risposta = await chiedi(WS_LIST);
    state.tickets = Array.isArray(risposta?.tickets) ? risposta.tickets : [];
    state.delivery = Boolean(risposta?.delivery);
    state.console = Boolean(risposta?.console);
    if (risposta?.account) state.account = risposta.account;
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
  const scelto = tipoAttivo();
  const tipi = TIPI.map(
    (tipo) => `
      <button type="button" class="dm-tkt-tipo${
        state.tipo === tipo.id ? " attivo" : ""
      }" data-dm-tipo="${tipo.id}" style="--tk-rgb:${tipo.rgb};"
        aria-pressed="${state.tipo === tipo.id}">
        <span class="dm-tkt-tipo-ico">${tipo.icona}</span>
        <span class="dm-tkt-tipo-nm">${esc(tipo.nome())}</span>
        <span class="dm-tkt-tipo-ds">${esc(tipo.che())}</span>
      </button>`,
  ).join("");
  return `
    ${statoCollegamento()}
    <div class="dm-tkt-passo">${esc(t("1 · Di che si tratta", "1 · What is it about"))}</div>
    <div class="dm-tkt-tipi">${tipi}</div>
    <div class="dm-tkt-passo">${esc(t("2 · Raccontalo", "2 · Tell it"))}</div>
    <div class="dm-tkt-campo">
      <label for="dm-tkt-titolo">${esc(t("Titolo", "Title"))}</label>
      <input id="dm-tkt-titolo" type="text" maxlength="${MAX_TITOLO}"
        autocomplete="off" placeholder="${esc(scelto.titolo())}"
        value="${esc(state.bozza.title)}">
    </div>
    <div class="dm-tkt-campo">
      <label for="dm-tkt-corpo">${esc(t("Descrizione", "Description"))}</label>
      <textarea id="dm-tkt-corpo" maxlength="${MAX_CORPO}"
        placeholder="${esc(scelto.corpo())}">${esc(state.bozza.body)}</textarea>
      <div class="dm-tkt-conta" data-dm-tkt="conta">${state.bozza.body.length} / ${MAX_CORPO}</div>
    </div>
    <div class="dm-tkt-campo">
      <label for="dm-tkt-contatto">${esc(
        t("Come ricontattarti (facoltativo)", "How to reach you (optional)"),
      )}</label>
      <input id="dm-tkt-contatto" type="text" maxlength="${MAX_CONTATTO}"
        autocomplete="off" value="${esc(state.bozza.contact)}"
        placeholder="${esc(
          t(
            "Resta in casa: non finisce nella pagina pubblica",
            "Stays at home: it does not go on the public page",
          ),
        )}">
    </div>
    <div class="dm-tkt-passo">${esc(t("3 · Cosa parte", "3 · What gets sent"))}</div>
    <details class="dm-tkt-diag">
      <summary>${esc(
        t("Le cose che la plancia sa gia'", "The things the dashboard already knows"),
      )}</summary>
      <dl data-dm-tkt="diag"></dl>
    </details>
    <div class="dm-tkt-nota">
      <span class="dm-tkt-nota-ico" aria-hidden="true">📎</span>
      <span>${esc(
        t(
          "Foto e video si aggiungono dopo, sulla pagina della segnalazione: te lo ricorda lei appena l'hai spedita.",
          "Photos and videos are added afterwards, on the report page: it reminds you as soon as you have sent it.",
        ),
      )}</span>
    </div>
    <div class="dm-tkt-pubblica">
      <span class="dm-tkt-pubblica-ico" aria-hidden="true">🌍</span>
      <span>${esc(
        t(
          "La segnalazione diventa una pagina pubblica su github.com, aperta a tuo nome: chiunque potra' leggerla. Il recapito qui sopra no: quello resta in casa.",
          "The report becomes a public page on github.com, opened under your name: anyone will be able to read it. The contact above does not: that stays at home.",
        ),
      )}</span>
    </div>
    <div class="dm-tkt-azioni">
      <button type="button" class="dm-tkt-btn" data-dm-tkt="invia" ${
        state.busy ? "disabled" : ""
      }>${esc(
        state.busy
          ? t("Invio…", "Sending…")
          : state.account.connected || !state.delivery
            ? t("Invia", "Send")
            : t("Salva e collega GitHub", "Save and connect GitHub"),
      )}</button>
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

/* ─── Foto e video ──────────────────────────────────────────────────────────
 *
 * GitHub non ha un'API per allegare file a una issue, e non e' una svista: e'
 * una scelta loro, per contenere gli abusi. Gli aggiri che circolano
 * replicano il flusso del browser su endpoint non documentati — il giorno che
 * GitHub li chiude si romperebbero tutte le installazioni insieme, e questa
 * plancia sta su troppe case per correre quel rischio.
 *
 * Quindi la strada e' quella che GitHub sostiene davvero: la segnalazione
 * parte da qui, e la foto si aggiunge sulla sua pagina. Il momento buono per
 * dirlo e' adesso — appena spedita, quando chi ha scritto ha ancora il file
 * sotto mano — non in una nota che nessuno legge prima.
 */

export function appenaApertaMarkup(appena = state.appena) {
  if (!appena) return "";
  const numero = appena.numero ? `#${esc(appena.numero)}` : "";
  return `
    <div class="dm-tkt-aperta">
      <div class="dm-tkt-aperta-testa">
        <span class="dm-tkt-aperta-ico" aria-hidden="true">✅</span>
        <span><b>${esc(t("Segnalazione aperta", "Report opened"))}</b> ${numero}</span>
      </div>
      <div class="dm-tkt-aperta-testo">${esc(
        t(
          "Una foto o un video valgono dieci righe di descrizione. Aprila su GitHub e trascinali nel riquadro della risposta: da qui non si possono spedire, GitHub non lo permette a nessun programma.",
          "A photo or a video is worth ten lines of description. Open it on GitHub and drag them into the reply box: they cannot be sent from here, GitHub allows no program to do that.",
        ),
      )}</div>
      <div class="dm-tkt-azioni">
        <button type="button" class="dm-tkt-btn chiaro" data-dm-tkt="congeda">${esc(
          t("Va bene cosi'", "It is fine as it is"),
        )}</button>
        <a class="dm-tkt-btn" href="${esc(appena.url)}"
           target="_blank" rel="noreferrer noopener">${esc(
             t("Aggiungi foto o video", "Add a photo or a video"),
           )}</a>
      </div>
    </div>`;
}

function elencoMarkup() {
  if (!state.tickets.length) {
    return `
      <div class="dm-tkt-vuoto">
        <div class="dm-tkt-vuoto-ico" aria-hidden="true">🎫</div>
        <div>${esc(
          t("Non hai ancora aperto nessuna segnalazione.", "You have not opened any report yet."),
        )}</div>
        <button type="button" class="dm-tkt-btn" data-dm-tab="nuova">${esc(
          t("Aprine una", "Open one"),
        )}</button>
      </div>`;
  }
  return `
    ${appenaApertaMarkup()}
    <div class="dm-tkt-elenco">${state.tickets.map(voceMarkup).join("")}</div>
    <div class="dm-tkt-azioni">
      <button type="button" class="dm-tkt-btn chiaro" data-dm-tkt="aggiorna" ${
        state.busy ? "disabled" : ""
      }>${esc(t("Aggiorna", "Refresh"))}</button>
    </div>`;
}

/* ─── Il cruscotto ──────────────────────────────────────────────────────────
 *
 * Quello che serve a chi la coda la lavora: quante ne sono arrivate, quali
 * aspettano una risposta, e la possibilita' di darla senza aprire un'altra
 * finestra.
 *
 * Tre numeri e un elenco, e nessun grafico: un conteggio per stato e' una
 * cifra sola per colonna, e una cifra sola si legge meglio scritta grande che
 * disegnata. */

export const FILTRI_ID = Object.freeze([
  "aperte",
  "tutte",
  "bug",
  "feature",
  "assistenza",
]);

const FILTRI = [
  { id: "aperte", nome: () => t("Da lavorare", "To work on") },
  { id: "tutte", nome: () => t("Tutte", "All") },
  { id: "bug", nome: () => t("Difetti", "Bugs") },
  { id: "feature", nome: () => t("Idee", "Ideas") },
  { id: "assistenza", nome: () => t("Aiuto", "Help") },
];

export function contaColonne(coda) {
  return COLONNE.map((colonna) => ({
    ...colonna,
    quante: coda.filter((ticket) => colonna.tiene(clean(ticket.state))).length,
  }));
}

function colonneMarkup(coda) {
  return `<div class="ed-kpi-banner dm-tkt-kpi">${contaColonne(coda)
    .map(
      (colonna) => `
        <div class="ed-kpi-item" style="--kpi-rgb:${colonna.rgb};">
          <div class="ed-kpi-icon" aria-hidden="true">${colonna.icona}</div>
          <div class="ed-kpi-val">${colonna.quante}</div>
          <div class="ed-kpi-label">${esc(colonna.nome())}</div>
        </div>`,
    )
    .join("")}</div>`;
}

function filtriMarkup() {
  return `<div class="dm-tkt-filtri">${FILTRI.map(
    (filtro) =>
      `<button type="button" class="dm-tkt-filtro${
        state.filtro === filtro.id ? " attivo" : ""
      }" data-dm-filtro="${filtro.id}" aria-pressed="${
        state.filtro === filtro.id
      }">${esc(filtro.nome())}</button>`,
  ).join("")}</div>`;
}

export function filtra(coda, filtro = state.filtro) {
  if (filtro === "tutte") return coda;
  if (filtro === "aperte") {
    return coda.filter((ticket) => {
      const stato = clean(ticket.state);
      return stato !== "risolto" && stato !== "chiuso";
    });
  }
  return coda.filter((ticket) => clean(ticket.type) === filtro);
}

function quandoMarkup(ticket) {
  const numero = Number(ticket.number) || 0;
  const chi = clean(ticket.author);
  return `#${numero}${chi ? ` · ${esc(chi)}` : ""}`;
}

export function codaVoceMarkup(ticket) {
  const numero = Number(ticket.number) || 0;
  const tipo = tipoAttivo(clean(ticket.type));
  const chiusa = ["risolto", "chiuso"].includes(clean(ticket.state));
  const azioni = chiusa
    ? `<button type="button" class="dm-tkt-btn chiaro"
         data-dm-rispondi="${numero}" data-dm-chiudi="">${esc(
           t("Aggiungi una risposta", "Add a reply"),
         )}</button>`
    : `
      <button type="button" class="dm-tkt-btn chiaro"
        data-dm-rispondi="${numero}" data-dm-chiudi="">${esc(t("Rispondi", "Reply"))}</button>
      <button type="button" class="dm-tkt-btn"
        data-dm-rispondi="${numero}" data-dm-chiudi="risolto">${esc(
          t("Rispondi e risolvi", "Reply and solve"),
        )}</button>
      <button type="button" class="dm-tkt-btn chiaro"
        data-dm-rispondi="${numero}" data-dm-chiudi="chiuso">${esc(
          t("Archivia", "Archive"),
        )}</button>`;
  return `
    <div class="dm-tkt-voce dm-tkt-lavoro" style="--tk-rgb:${tipo.rgb};">
      <div class="dm-tkt-voce-testa">
        <span class="dm-tkt-tipo-pill" aria-hidden="true">${tipo.icona}</span>
        <span class="dm-tkt-voce-tit">${esc(clean(ticket.title))}</span>
        ${statoMarkup(clean(ticket.state) || "inviato")}
      </div>
      <div class="dm-tkt-voce-pie">
        <span>${quandoMarkup(ticket)}</span>
        <a class="dm-tkt-link" href="${esc(clean(ticket.issue_url))}"
           target="_blank" rel="noreferrer noopener">${esc(
             t("Apri su GitHub", "Open on GitHub"),
           )}</a>
      </div>
      <p class="dm-tkt-voce-corpo">${esc(clean(ticket.body))}</p>
      <div class="dm-tkt-campo">
        <textarea id="dm-tkt-risposta-${numero}" rows="3"
          placeholder="${esc(
            t(
              "La risposta finisce sotto la segnalazione, e chi l'ha aperta la trova nella sua plancia.",
              "The reply goes under the report, and whoever opened it finds it in their own dashboard.",
            ),
          )}"></textarea>
      </div>
      <div class="dm-tkt-azioni">${azioni}</div>
    </div>`;
}

function consoleMarkup() {
  if (state.queue === null) {
    return `<div class="dm-tkt-vuoto">${esc(t("Carico la coda…", "Loading the queue…"))}</div>`;
  }
  const coda = state.queue;
  const scelte = filtra(coda);
  const elenco = scelte.length
    ? `<div class="dm-tkt-elenco">${scelte.map(codaVoceMarkup).join("")}</div>`
    : `<div class="dm-tkt-vuoto">${esc(
        state.filtro === "aperte"
          ? t("Nessuna segnalazione da lavorare. Buon per te.", "Nothing to work on. Good for you.")
          : t("Niente con questo filtro.", "Nothing under this filter."),
      )}</div>`;
  return `
    ${colonneMarkup(coda)}
    ${filtriMarkup()}
    ${elenco}
    <div class="dm-tkt-azioni">
      <button type="button" class="dm-tkt-btn chiaro" data-dm-tkt="ricarica-coda" ${
        state.busy ? "disabled" : ""
      }>${esc(t("Aggiorna", "Refresh"))}</button>
    </div>`;
}

/** La riga sotto il titolo: dove sei, e con che account. */
function sottotitolo() {
  /* Il pezzo che cambia si attacca FUORI da `t()`. Dentro finirebbe nella
   * chiave — una chiave diversa per ogni conteggio e per ogni login — e a
   * runtime nessun catalogo l'avrebbe mai contenuta: ogni lingua ricadrebbe
   * sull'inglese proprio in questa riga. */
  if (state.tab === "console") {
    const quante = Array.isArray(state.queue) ? state.queue.length : 0;
    const testa = t(
      "Le segnalazioni arrivate dalle plance",
      "Reports arrived from the dashboards",
    );
    return `${testa} · ${quante}`;
  }
  if (state.account.connected) {
    return `${t("Le tue richieste", "Your requests")} · ${state.account.login}`;
  }
  return t(
    "Segnala un difetto, proponi un'idea, chiedi aiuto",
    "Report a bug, suggest an idea, ask for help",
  );
}

function disegna() {
  const modale = doc?.getElementById?.("dm-tkt-modal");
  if (!modale) return;
  modale.querySelector('[data-dm-tkt="titolo"]').textContent =
    state.tab === "console" ? t("Cruscotto", "Console") : t("Segnalazioni", "Reports");
  modale.querySelector('[data-dm-tkt="sottotitolo"]').textContent = sottotitolo();
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

/** Metti in salvo quello che c'e' scritto, prima di rifare il modulo. */
function raccogliBozza() {
  const modale = doc?.getElementById?.("dm-tkt-modal");
  if (!modale?.querySelector("#dm-tkt-titolo")) return;
  state.bozza = {
    title: modale.querySelector("#dm-tkt-titolo")?.value ?? "",
    body: modale.querySelector("#dm-tkt-corpo")?.value ?? "",
    contact: modale.querySelector("#dm-tkt-contatto")?.value ?? "",
  };
}

function agganciaEventi(corpo) {
  corpo.querySelectorAll("[data-dm-tab]").forEach((bottone) => {
    bottone.addEventListener("click", () => {
      raccogliBozza();
      state.tab = bottone.dataset.dmTab;
      state.avviso = "";
      disegna();
      if (state.tab === "console" && state.queue === null) caricaCoda();
    });
  });
  corpo.querySelectorAll("[data-dm-tipo]").forEach((bottone) => {
    bottone.addEventListener("click", () => {
      raccogliBozza();
      state.tipo = bottone.dataset.dmTipo;
      disegna();
    });
  });
  corpo.querySelectorAll("[data-dm-filtro]").forEach((bottone) => {
    bottone.addEventListener("click", () => {
      state.filtro = bottone.dataset.dmFiltro;
      disegna();
    });
  });
  corpo.querySelector('[data-dm-tkt="invia"]')?.addEventListener("click", invia);
  corpo.querySelector('[data-dm-tkt="aggiorna"]')?.addEventListener("click", sincronizza);
  corpo.querySelectorAll("[data-dm-tolgi]").forEach((bottone) => {
    bottone.addEventListener("click", () => elimina(bottone.dataset.dmTolgi));
  });
  corpo.querySelectorAll("[data-dm-rispondi]").forEach((bottone) => {
    bottone.addEventListener("click", () =>
      rispondi(bottone.dataset.dmRispondi, bottone.dataset.dmChiudi),
    );
  });
  corpo.querySelector('[data-dm-tkt="congeda"]')?.addEventListener("click", () => {
    state.appena = null;
    disegna();
  });
  corpo.querySelector('[data-dm-tkt="collega"]')?.addEventListener("click", collega);
  corpo.querySelector('[data-dm-tkt="annulla"]')?.addEventListener("click", annullaCollegamento);
  corpo.querySelector('[data-dm-tkt="scollega"]')?.addEventListener("click", scollega);
  const corpoTesto = corpo.querySelector("#dm-tkt-corpo");
  const conta = corpo.querySelector('[data-dm-tkt="conta"]');
  if (corpoTesto && conta) {
    corpoTesto.addEventListener("input", () => {
      conta.textContent = `${corpoTesto.value.length} / ${MAX_CORPO}`;
    });
  }
}

async function invia() {
  raccogliBozza();
  const titolo = clean(state.bozza.title);
  const corpo = clean(state.bozza.body);
  const contatto = clean(state.bozza.contact);
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
    state.bozza = { title: "", body: "", contact: "" };
    const aperta = risposta?.ticket || {};
    state.appena =
      risposta?.delivered && aperta.issue_url
        ? { numero: clean(aperta.remote_id), url: clean(aperta.issue_url) }
        : null;
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

async function rispondi(numero, chiusura) {
  const issue = Number(numero) || 0;
  if (!issue) return;
  const modale = doc?.getElementById?.("dm-tkt-modal");
  const testo = clean(modale?.querySelector(`#dm-tkt-risposta-${issue}`)?.value);
  /* Archiviare senza scrivere niente ha senso — «non e' un difetto» — ma
   * rispondere senza testo no: sarebbe un commento vuoto sotto la
   * segnalazione di qualcuno. */
  if (!testo && !chiusura) {
    state.avviso = `!${t("Scrivi una risposta.", "Write a reply.")}`;
    disegna();
    return;
  }
  state.busy = true;
  disegna();
  try {
    await chiedi(WS_ANSWER, { number: issue, reply: testo, close: chiusura || "" });
    state.avviso = t("Risposta pubblicata.", "Reply published.");
    state.queue = null;
  } catch (errore) {
    state.avviso = `!${clean(errore?.message) || t("Non riuscita.", "It did not work.")}`;
  } finally {
    state.busy = false;
    if (state.queue === null) await caricaCoda();
    else disegna();
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
  fermaAttesa();
  state.auth = null;
  doc?.getElementById?.("dm-tkt-modal")?.remove();
  doc?.getElementById?.("dm-tkt-card")?.remove();
  state.installed = false;
  state.tickets = [];
  state.queue = null;
  state.tab = "nuova";
}

installSegnalazioniSection();
