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
  /* Perche' la coda non e' arrivata, quando non e' arrivata. Il giro zitto
   * inghiottiva l'errore per non disturbare chi non aveva chiesto niente — ed
   * e' giusto — ma cosi' il cruscotto restava vuoto senza dire perche', e il
   * widget non compariva senza dire perche'. Il motivo non urla: aspetta nel
   * posto dove qualcuno andra' a cercarlo. */
  codaErrore: "",
  /* Le conversazioni dove qualcuno ha scritto e nessuno ha ancora aperto il
   * filo. L'elenco lo tiene il backend — il campanello lo riempie nel suo giro
   * — perche' le plance di una casa sono piu' di una: letto dal telefono vuol
   * dire letto anche per il tablet in cucina. */
  nonLetti: [],
  /* La segnalazione appena aperta, finche' non la si congeda. Serve al
   * riquadro che spiega come allegare foto e video: e' il momento in cui chi
   * ha appena scritto ha ancora il file sotto mano. */
  appena: null,
  /* I fili gia' chiesti, per numero di segnalazione. Restano aperti finche' la
   * console e' aperta: richiuderli a ogni ridisegno vorrebbe dire richiedere a
   * GitHub la stessa cosa che si e' appena letta. */
  fili: {},
  filiInCorso: {},
  filtro: "aperte",
  tipoCoda: "",
  queueAt: 0,
  syncAt: 0,
  codaTimer: 0,
  tab: "nuova",
  tipo: "bug",
  /* Quello che si sta scrivendo. Sta qui e non solo nel DOM perche' ogni
   * ridisegno rifa' il modulo da capo: senza, cambiare tipo a meta' frase
   * cancellava la frase. */
  bozza: { title: "", body: "" },
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
const WS_THREAD = "dashboardmodern/tickets/thread";
const WS_REPLY = "dashboardmodern/tickets/reply";
const WS_TAKE = "dashboardmodern/tickets/take";
const WS_UNREAD = "dashboardmodern/tickets/unread";
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
  WS_THREAD,
  WS_REPLY,
  WS_TAKE,
  WS_UNREAD,
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
    /* «Da lavorare», non «Nuove»: e' la cifra di quelle che nessuno ha ancora
     * preso, e porta lo stesso nome del tasto che le mostra qui sotto. */
    nome: () => t("Da lavorare", "To work on"),
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

/* Il codice da digitare, quando il giro e' in corso.
 *
 * Sta in cima al corpo, non dentro il modulo: si chiede l'autorizzazione nel
 * momento in cui serve — dopo che la segnalazione e' stata scritta e salvata —
 * e non prima di aver mostrato niente. Un blocco di accesso davanti a un
 * modulo vuoto e' una porta con la serratura messa davanti alla vetrina: chi
 * la trova pensa «vabbe', vado su GitHub», ed e' esattamente il contrario di
 * quello che questa finestra serve a evitare.
 */
function codiceMarkup() {
  if (!state.auth) return "";
  const codice = clean(state.auth.user_code);
  /* L'indirizzo si porta dietro il codice. GitHub non promette di
   * precompilarlo, quindi il codice resta bello grande qui sopra: se il
   * parametro viene ignorato si digita, come prima, e non si e' perso niente. */
  const dove = `${clean(state.auth.verification_uri) || "https://github.com/login/device"}?user_code=${encodeURIComponent(codice)}`;
  return `
    <div class="dm-tkt-avviso dm-tkt-device">
      <div>${esc(
        t(
          "Un passaggio solo, e non te lo chiedera' mai piu': apri github.com/login/device e digita questo codice.",
          "One step, and you will never be asked again: open github.com/login/device and type this code.",
        ),
      )}</div>
      <div class="dm-tkt-codice">${esc(codice)}</div>
      <div class="dm-tkt-azioni">
        <button type="button" class="dm-tkt-btn chiaro" data-dm-tkt="annulla">${esc(
          t("Annulla", "Cancel"),
        )}</button>
        <a class="dm-tkt-btn" href="${esc(dove)}"
           target="_blank" rel="noreferrer noopener">${esc(t("Apri GitHub", "Open GitHub"))}</a>
      </div>
    </div>`;
}

/* Il conto collegato, dove non da' fastidio: in fondo all'elenco delle
 * proprie segnalazioni, non davanti al modulo. Chi vuole collegarsi prima di
 * scrivere puo' farlo da qui; a tutti gli altri non viene chiesto niente
 * finche' non premono invia. */
function contoMarkup() {
  if (!state.delivery) return "";
  if (state.account.connected) {
    return `
      <div class="dm-tkt-conto">
        <span>${esc(t("Collegato come", "Connected as"))} <b>${esc(state.account.login)}</b></span>
        <button type="button" class="dm-tkt-tolgi" data-dm-tkt="scollega">${esc(
          t("Scollega", "Disconnect"),
        )}</button>
      </div>`;
  }
  return `
    <div class="dm-tkt-conto">
      <span>${esc(
        t(
          "Le segnalazioni partono a tuo nome: la prima volta serve un passaggio su GitHub.",
          "Reports go out under your name: the first time takes one step on GitHub.",
        ),
      )}</span>
      <button type="button" class="dm-tkt-tolgi" data-dm-tkt="collega">${esc(
        t("Collega GitHub", "Connect GitHub"),
      )}</button>
    </div>`;
}

/* `salvata` dice che si arriva qui subito dopo un invio, con la segnalazione
 * gia' al sicuro in casa. Cambia due cose, e tutte e due contano.
 *
 * L'avviso «Salvata...» non si cancella: e' la ragione per cui il codice sta
 * comparendo, e senza quella riga il codice arriverebbe senza il suo perche'.
 *
 * E se l'autorizzazione non parte — GitHub irraggiungibile, per dire — dire
 * soltanto «non riuscita» farebbe credere di aver perso quello che si era
 * appena scritto. La risposta naturale a quel messaggio e' riscrivere tutto da
 * capo, e ritrovarsi due segnalazioni uguali. */
async function collega({ salvata = false } = {}) {
  if (!salvata) state.avviso = "";
  try {
    const avvio = await chiedi(WS_AUTH_START);
    state.auth = avvio;
    disegna();
    attendiAutorizzazione(avvio);
  } catch (errore) {
    const guasto = clean(errore?.message) || t("Non riuscita.", "It did not work.");
    state.avviso = salvata
      ? `!${t("Salvata, ma l'autorizzazione non e' partita:", "Saved, but the authorization did not start:")} ${guasto} ${t("Riprova da «Le mie».", "Try again from «Mine».")}`
      : `!${guasto}`;
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
/* Spento vuol dire spento anche quando il tasto e' quello pieno: la sola
   trasparenza lasciava un rettangolo azzurro su fondo scuro, che continua a
   leggersi come «premimi». Perde il colore e prende quello neutro, cosi' la
   differenza fra «non ancora» e «adesso si'» si vede da lontano. */
.dm-tkt-btn[disabled] { opacity:.55; cursor:default; transform:none; filter:none;
  background:var(--surface-3,#f1f5f9); color:var(--text-dim,#64748b);
  border:1px solid var(--card-border,#e2e8f0); }
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

/* La scheda tecnica: le versioni in evidenza, il resto sottovoce. */
.dm-tkt-scheda { display:flex; flex-wrap:wrap; gap:6px; margin:8px 0 0; }
.dm-tkt-versione { display:inline-flex; align-items:center; gap:5px;
  padding:3px 9px; border-radius:50px; font-size:11px; font-weight:800;
  background:rgba(14,165,233,0.14); color:var(--text,#0f172a);
  border:1px solid rgba(14,165,233,0.3); }
.dm-tkt-versione b { opacity:.7; font-size:10px; letter-spacing:.06em; }
.dm-tkt-dato { padding:3px 9px; border-radius:50px; font-size:11px; font-weight:600;
  background:var(--surface-3,#f1f5f9); color:var(--text-dim,#64748b);
  border:1px solid var(--card-border,#e2e8f0); }

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
.dm-tkt-conto { display:flex; align-items:center; gap:10px; flex-wrap:wrap;
  justify-content:space-between; padding:10px 13px; border-radius:13px;
  background:var(--surface-3,#f1f5f9); color:var(--text-dim,#64748b);
  font-size:12px; line-height:1.45; }

/* Il cruscotto: i tre numeri e i filtri. */
.dm-tkt-kpi { margin-bottom:0; }
/* Due file: lo stato sopra, il tipo sotto. La seconda sta piu' vicina alla
   prima che all'elenco, cosi' si legge come una coppia e non come due cose
   che capitano di seguito. */
.dm-tkt-filtri { display:flex; gap:8px; flex-wrap:wrap; }
.dm-tkt-filtri + .dm-tkt-filtri { margin-top:6px; }
.dm-tkt-filtro { padding:7px 14px; border-radius:50px; cursor:pointer;
  border:1px solid var(--card-border,#e2e8f0); background:var(--surface-3,#f1f5f9);
  color:var(--text-dim,#64748b); font-size:12px; font-weight:700;
  display:inline-flex; align-items:center; gap:7px; }
.dm-tkt-filtro.attivo { background:var(--accent,#0ea5e9); color:#fff;
  border-color:transparent; }
/* Il conto: dentro il tasto, ma di peso minore del nome — e' un dato, non
   un'etichetta, e non deve rubare la lettura. */
.dm-tkt-quanti { font-size:11px; font-weight:800; opacity:.75;
  padding:1px 6px; border-radius:50px; background:rgba(100,116,139,.18); }
.dm-tkt-filtro.attivo .dm-tkt-quanti { background:rgba(255,255,255,.25); opacity:1; }

/* I segni sulla scheda, e il filo che si apre sotto. */
.dm-tkt-segno { font-size:11px; font-weight:800; padding:3px 8px; border-radius:9px;
  background:var(--surface-3,#f1f5f9); color:var(--text-dim,#64748b);
  white-space:nowrap; }
/* Il segno di «c'e' qualcosa da leggere» prende il colore d'accento: gli altri
   segni sono contorno — quanti allegati, chi ce l'ha in carico — e questo
   invece chiede di essere aperto. Alla pari con loro sarebbe stato l'unico che
   chiede qualcosa vestito come quelli che non chiedono niente. */
.dm-tkt-segno.nuovo { background:color-mix(in srgb, var(--accent,#38bdf8) 20%, transparent);
  color:var(--accent,#38bdf8); }
.dm-tkt-filo { display:flex; flex-direction:column; gap:10px; margin-top:11px; }
.dm-tkt-filo-attesa { padding:14px; text-align:center; font-size:12px;
  color:var(--text-dim,#64748b); }
.dm-tkt-commento { padding:11px 13px; border-radius:14px;
  background:var(--surface-3,#f1f5f9); }
.dm-tkt-commento.originale { background:transparent; padding:0; }
.dm-tkt-commento.mio { background:rgba(14,165,233,0.10); }
.dm-tkt-commento-testa { display:flex; gap:8px; align-items:center; flex-wrap:wrap;
  font-size:11px; color:var(--text-dim,#64748b); }
.dm-tkt-commento .dm-tkt-voce-corpo { margin-top:6px; }
.dm-tkt-allegati { display:flex; gap:10px; flex-wrap:wrap; margin-top:9px; }
.dm-tkt-allegato { display:flex; flex-direction:column; gap:5px; max-width:200px;
  padding:8px; border-radius:12px; border:1px solid var(--card-border,#e2e8f0);
  background:var(--card-bg,#fff); color:var(--text-dim,#64748b); font-size:11px;
  font-weight:700; text-decoration:none; }
.dm-tkt-allegato img { width:100%; max-height:150px; object-fit:cover;
  border-radius:8px; display:block; background:var(--surface-3,#f1f5f9); }
.dm-tkt-allegato span { word-break:break-word; }
.dm-tkt-allegato.solo-link, .dm-tkt-allegato.rotto { flex-direction:row;
  align-items:center; }

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

/* Il Cruscotto non ha l'interruttore, e non e' una dimenticanza.
 *
 * Ce l'aveva, in cima alla finestra delle segnalazioni: la stessa fascia verde
 * di tutte le altre sezioni. Ma quella fascia serve a scegliere fra vedere una
 * voce e non vederla, e qui la scelta non c'e': «solo a me esce il cruscotto
 * nella navbar, ad utenti normali non esce e quindi quel pulsante non ha
 * senso». La voce compare a chi tiene la repository e a nessun altro — e chi
 * la tiene la vuole. Un interruttore che una persona sola al mondo puo'
 * toccare, per spegnere la pagina che quella stessa persona ha chiesto, e' una
 * riga di interfaccia che non decide niente.
 *
 * `insegnaLaVisibilitaDelCruscotto` resta: insegna la chiave al guscio, cosi'
 * una preferenza gia' scritta da chi la fascia l'aveva toccata continua a
 * valere e nessuno si ritrova la voce riaccesa dall'aggiornamento.
 */

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

export function apri(dove = "") {
  const modale = finestra();
  if (!modale) return;
  state.avviso = "";
  /* La linguetta si sceglie da fuori solo se esiste per chi guarda: la console
   * la vede il manutentore, e chiederla senza averla lascerebbe la finestra su
   * una scheda che non c'e'. */
  if (dove === "mie" || dove === "nuova") state.tab = dove;
  modale.classList.add("show");
  disegna();
  ricarica();
  /* E si va a vedere se nel frattempo qualcuno ha risposto.
   *
   * `ricarica()` legge quello che c'e' in casa: le risposte scritte su GitHub
   * non ci sono ancora, e ci arrivavano solo premendo «Aggiorna» o al giro di
   * mezz'ora. Chi apriva le sue segnalazioni per vedere se c'era una risposta
   * — cioe' l'unico motivo per cui uno le apre — trovava quello che gia'
   * sapeva, e doveva chiudere e riaprire. */
  sincronizza({ zitta: true });
}

export function chiudi() {
  /* Chi chiude a meta' autorizzazione non deve lasciare dietro un timer che
   * continua a chiedere a GitHub per un quarto d'ora. */
  fermaAttesa();
  state.auth = null;
  state.appena = null;
  doc?.getElementById?.("dm-tkt-modal")?.classList.remove("show");
}

/* Ogni quanto la coda si va a riprendere da sola, per il widget in Home. Dieci
 * minuti: le segnalazioni non arrivano al secondo, e ogni giro e' una chiamata
 * a GitHub. Aprire la console la riprende comunque, quindi chi la guarda vede
 * sempre l'ultima. */
const CODA_FRESCA = 10 * 60 * 1000;

/* E qualcuno che li conti, quei dieci minuti.
 *
 * La soglia da sola e' un freno, non un orologio: dice «non richiedere se hai
 * gia' chiesto da poco», e in una plancia lasciata aperta su un tablet nessuno
 * chiedeva piu' niente. I conti restavano fermi per ore, con l'aria di essere
 * quelli di adesso — e una segnalazione arrivata a mezzogiorno non si sarebbe
 * vista fino a che qualcuno non toccava qualcosa.
 *
 * Il battito parte solo per chi ha la console: per tutti gli altri non c'e'
 * nessuna tessera da tenere fresca, e sarebbe una chiamata a vuoto ogni dieci
 * minuti per sempre. */
function battitoDellaCoda() {
  fermaBattito();
  state.codaTimer = root.setInterval?.(async () => {
    /* Fermo mentre la pagina non si vede: una plancia in secondo piano non ha
     * nessuno che la guardi, e chiedere a GitHub per una tessera che nessuno
     * sta leggendo e' una chiamata buttata ogni dieci minuti per sempre. Al
     * ritorno la coda e' vecchia di un giro, e il giro dopo la riprende. */
    if (!state.console || doc?.hidden) return;
    await caricaCoda({ zitta: true });
    root.dispatchEvent?.(new CustomEvent("dashboardmodern:segnalazioni-coda"));
  }, CODA_FRESCA);
}

function fermaBattito() {
  if (state.codaTimer) root.clearInterval?.(state.codaTimer);
  state.codaTimer = 0;
}

/* Quello che il widget della Home ha bisogno di sapere, e nient'altro.
 *
 * Torna `null` per chiunque non tenga la repository: la tessera non esiste per
 * loro, e non e' una preferenza da spegnere ma una cosa che non li riguarda.
 * Cosi' «solo per me» e' garantito da come e' fatto, non da un interruttore
 * che qualcuno potrebbe accendere. */
/* Da quanti giorni una segnalazione aperta si considera ferma. Trenta: sotto
 * quel mese c'e' ancora l'aria di una cosa in corso, sopra e' una che nessuno
 * ha piu' guardato — ed e' quella che il cruscotto deve far notare. */
const GIORNI_VECCHIA = 30;

/* I tipi che un nome ce l'hanno. Quello che non e' fra questi non e' un errore:
 * e' una issue aperta a mano su GitHub, dove il tipo non si scrive. */
const TIPI_NOTI = ["bug", "feature", "assistenza"];

/* Il giorno di un istante nel fuso di chi guarda, come chiave.
 *
 * «Oggi» si decide confrontando due date di calendario, non due numeri di
 * millisecondi: sottrarre ventiquattro ore sbaglia nei giorni in cui l'ora
 * cambia — un giorno ne dura venticinque, un altro ventitre' — ed e' la stessa
 * trappola gia' trovata sulla tessera dell'Agenda. */
function giornoDi(istante) {
  const quando = new Date(istante);
  if (!Number.isFinite(quando.getTime())) return "";
  const mese = String(quando.getMonth() + 1).padStart(2, "0");
  const giorno = String(quando.getDate()).padStart(2, "0");
  return `${quando.getFullYear()}-${mese}-${giorno}`;
}

export function sommarioConsole() {
  if (!state.console || !Array.isArray(state.queue)) return null;
  const daLavorare = state.queue.filter((ticket) => !CHIUSA.includes(clean(ticket.state)));
  const perTipo = (tipo) => daLavorare.filter((ticket) => clean(ticket.type) === tipo).length;
  const adesso = Date.now();
  const oggi = giornoDi(adesso);
  const nate = (ticket) => Date.parse(clean(ticket.created_at));
  /* La soglia delle ferme e' una durata, non un confine di calendario: qui i
   * millisecondi vanno bene, ed e' il motivo per cui «oggi» invece no. */
  const limite = adesso - GIORNI_VECCHIA * 86400000;
  const diOggi = state.queue.filter((ticket) => {
    const quando = nate(ticket);
    return Number.isFinite(quando) && giornoDi(quando) === oggi;
  });
  return {
    /* Chi non porta la data non si conta ne' fra le nuove di oggi ne' fra le
     * ferme: non sapere quando e' nata non la rende vecchia. */
    oggi: diOggi.length,
    /* Di che genere sono quelle di oggi. Sapere che ne sono arrivate due non
     * dice se la giornata e' andata storta o se qualcuno ha avuto due idee:
     * un difetto e un'idea chiedono cose diverse a chi legge. */
    oggiPerTipo: {
      bug: diOggi.filter((ticket) => clean(ticket.type) === "bug").length,
      feature: diOggi.filter((ticket) => clean(ticket.type) === "feature").length,
      assistenza: diOggi.filter((ticket) => clean(ticket.type) === "assistenza").length,
      /* Le arrivate oggi senza tipo hanno un posto anche loro. Sommare i tre
       * generi e fermarsi li' vorrebbe dire dire «oggi niente» in una giornata
       * in cui sono arrivate due issue aperte a mano su GitHub, che un tipo
       * non ce l'hanno: il conto grande direbbe due e l'elenco sotto zero. */
      senza: diOggi.filter((ticket) => !TIPI_NOTI.includes(clean(ticket.type))).length,
    },
    vecchie: daLavorare.filter((ticket) => {
      const quando = nate(ticket);
      return Number.isFinite(quando) && quando < limite;
    }).length,
    quante: daLavorare.length,
    nuove: daLavorare.filter((ticket) => clean(ticket.state) === "inviato").length,
    inLavorazione: daLavorare.filter((ticket) => clean(ticket.state) === "in-carico").length,
    chiuse: state.queue.length - daLavorare.length,
    bug: perTipo("bug"),
    feature: perTipo("feature"),
    assistenza: perTipo("assistenza"),
    /* Chi ha scritto e nessuno ha ancora letto. E' l'unica riga del sommario
     * che non si ricava dalla coda: la coda dice quante segnalazioni ci sono,
     * non se sotto una di quelle e' comparso un messaggio da ieri sera. Quello
     * lo sa il campanello, e lo tiene lui.
     *
     * Conversazioni, non messaggi: chi guarda vuole sapere quante porte ha da
     * aprire, non quante frasi ci sono dietro. Quante siano lo dice il filo. */
    nonLetti: state.nonLetti.length,
    conversazioni: state.nonLetti.map((voce) => ({
      number: Number(voce?.number) || 0,
      title: clean(voce?.title),
      messages: Number(voce?.messages) || 1,
      opened: Boolean(voce?.opened),
    })),
  };
}

async function ricarica() {
  try {
    const risposta = await chiedi(WS_LIST);
    state.tickets = Array.isArray(risposta?.tickets) ? risposta.tickets : [];
    state.delivery = Boolean(risposta?.delivery);
    state.console = Boolean(risposta?.console);
    if (risposta?.account) state.account = risposta.account;
    /* La pagina della barra si mette qui, appena si sa chi guarda.
     *
     * Prima non la metteva nessuno. `sistemaIlCruscotto` era scritta,
     * esportata e appesa a `DashboardModernSegnalazioni.sistema`, e da li' la
     * chiamava soltanto lo script che fa le fotografie della galleria: nelle
     * foto il cruscotto c'era, in una casa vera non e' mai comparso. E' il modo
     * peggiore di sbagliare, perche' la prova che avrebbe dovuto accorgersene
     * era proprio quella che faceva il lavoro al posto dell'applicazione.
     *
     * Va prima della coda e non dopo: la voce nella barra si puo' mettere
     * subito, e aspettare la risposta di GitHub per disegnare un pulsante
     * vorrebbe dire che una rete lenta la fa comparire con dieci secondi di
     * ritardo — o non comparire affatto se quella richiesta fallisce. */
    sistemaIlCruscotto();
    /* Chi ha la console porta anche la coda, perche' il widget in Home la
     * mostra senza che nessuno abbia aperto niente. Non a ogni giro pero': una
     * chiamata a GitHub per ogni ridisegno sarebbe uno spreco, e la coda non
     * cambia da un secondo all'altro. */
    if (state.console) {
      await caricaCoda({ zitta: true });
      /* La Home si e' gia' disegnata mentre questa richiesta era per aria, e a
       * quel punto il sommario era ancora nullo: la tessera non e' stata messa.
       * Senza questo avviso restava fuori fino al primo evento che facesse
       * ridisegnare la griglia per un'altra ragione — cioe' comparire per caso,
       * che e' peggio del non comparire. */
      root.dispatchEvent?.(new CustomEvent("dashboardmodern:segnalazioni-coda"));
      if (!state.codaTimer) battitoDellaCoda();
    }
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
  const nonConfigurato = state.delivery
    ? ""
    : `<div class="dm-tkt-nota"><span class="dm-tkt-nota-ico" aria-hidden="true">💤</span><span>${esc(
        t(
          "L'invio non e' configurato su questa plancia: la segnalazione resta qui e partira' da sola quando lo sara'.",
          "Sending is not configured on this dashboard: the report stays here and will be sent on its own once it is.",
        ),
      )}</span></div>`;
  return `
    ${nonConfigurato}
    <div class="dm-tkt-passo">${esc(t("1 · Di che si tratta", "1 · What is it about"))}</div>
    <div class="dm-tkt-tipi">${tipi}</div>
    <div class="dm-tkt-passo">${esc(t("2 · Raccontalo", "2 · Tell it"))}</div>
    <div class="dm-tkt-campo">
      <label for="dm-tkt-campo-titolo">${esc(t("Titolo", "Title"))}</label>
      <input id="dm-tkt-campo-titolo" type="text" maxlength="${MAX_TITOLO}"
        autocomplete="off" placeholder="${esc(scelto.titolo())}"
        value="${esc(state.bozza.title)}">
    </div>
    <div class="dm-tkt-campo">
      <label for="dm-tkt-corpo">${esc(t("Descrizione", "Description"))}</label>
      <textarea id="dm-tkt-corpo" maxlength="${MAX_CORPO}"
        placeholder="${esc(scelto.corpo())}">${esc(state.bozza.body)}</textarea>
      <div class="dm-tkt-conta" data-dm-tkt="conta">${state.bozza.body.length} / ${MAX_CORPO}</div>
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
          "La segnalazione diventa una pagina pubblica su github.com, aperta a tuo nome: chiunque potra' leggerla. La risposta arriva qui, sotto la discussione.",
          "The report becomes a public page on github.com, opened under your name: anyone will be able to read it. The reply comes back here, under the discussion.",
        ),
      )}</span>
    </div>
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

/* La meta' che mancava: da qui si risponde, senza uscire.
 *
 * Fino a ieri il filo si poteva leggere ma non scrivere. Chi aveva segnalato
 * leggeva la risposta del manutentore dentro la propria plancia e poi, per
 * dire «ho provato, non funziona lo stesso», doveva aprire github.com — cioe'
 * uscire proprio dal posto che questa finestra esiste per non fargli lasciare.
 *
 * Compare solo col filo aperto: una casella di scrittura sotto ognuna delle
 * dodici segnalazioni dell'elenco sarebbe stata dodici caselle vuote. E solo
 * a chi ha collegato GitHub, perche' il commento parte a nome suo: senza
 * firma non c'e' niente da mandare, e un tasto che risponde «collega GitHub»
 * dopo che hai scritto e' un tasto che ti fa perdere quello che hai scritto.
 */
function mioCampoMarkup(numero) {
  if (!numero || !state.fili[numero]) return "";
  if (!state.account.connected) {
    return `<div class="dm-tkt-filo-attesa">${esc(
      t(
        "Collega GitHub per scrivere sotto questa segnalazione.",
        "Connect GitHub to write under this report.",
      ),
    )}</div>`;
  }
  return `
    <div class="dm-tkt-campo">
      <textarea id="dm-tkt-mio-${numero}" rows="3" placeholder="${esc(
        t(
          "Scrivi qui: il messaggio finisce sotto la segnalazione, a nome tuo.",
          "Write here: the message goes under the report, under your name.",
        ),
      )}"></textarea>
    </div>
    <div class="dm-tkt-azioni">
      <button type="button" class="dm-tkt-btn" data-dm-scrivi="${numero}"
        data-dm-serve-testo="${numero}" data-dm-campo="dm-tkt-mio-${numero}" disabled>${esc(
          t("Manda il messaggio", "Send the message"),
        )}</button>
    </div>`;
}

export function voceMarkup(ticket) {
  const tipo = TIPI.find((voce) => voce.id === ticket.type) || TIPI[0];
  const data = ticket.created_at ? new Date(ticket.created_at).toLocaleDateString() : "";
  const risposta = ticket.reply ? `<div class="dm-tkt-risposta">${esc(ticket.reply)}</div>` : "";
  const errore = ticket.delivery_error
    ? `<div class="dm-tkt-voce-pie">⚠︎ ${esc(ticket.delivery_error)}</div>`
    : "";
  /* La discussione si apre qui, non su github.com. Portare fuori chi voleva
   * solo leggere la risposta vorrebbe dire mandarlo via proprio dal posto che
   * questa finestra esiste per non fargli lasciare — e la risposta la si legge
   * senza permessi, perche' la issue e' una pagina pubblica. Il rimando a
   * GitHub resta, ma accanto, per chi ci vuole andare davvero. */
  const numero = Number(ticket.remote_id) || 0;
  const aperto = Boolean(state.fili[numero] || state.filiInCorso[numero]);
  const issue = numero
    ? `<button type="button" class="dm-tkt-tolgi" data-dm-filo="${numero}"
         aria-expanded="${aperto}">${esc(
           aperto
             ? t("Nascondi tutto", "Hide everything")
             : t("Vedi la discussione", "See the discussion"),
         )}</button>
       <a class="dm-tkt-link" href="${esc(
         clean(ticket.issue_url),
       )}" target="_blank" rel="noreferrer noopener">${esc(
         t("Apri su GitHub", "Open on GitHub"),
       )}</a>`
    : "";
  return `
    <div class="dm-tkt-voce">
      <div class="dm-tkt-voce-testa">
        <span>${tipo.icona}</span>
        <span class="dm-tkt-voce-tit">${esc(ticket.title)}</span>
        ${
          nonLetto(numero)
            ? `<span class="dm-tkt-segno nuovo" title="${esc(
                t("Messaggi nuovi", "New messages"),
              )}">🔵 ${esc(t("risposta", "reply"))}</span>`
            : ""
        }
        ${statoMarkup(ticket.state)}
      </div>
      ${
        aperto
          ? `${filoMarkup(numero)}${mioCampoMarkup(numero)}`
          : `<p class="dm-tkt-voce-corpo">${esc(ticket.body)}</p>${diagnosticaMarkup(
              ticket.diagnostics,
            )}${risposta}`
      }
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
      </div>
      ${contoMarkup()}`;
  }
  return `
    ${appenaApertaMarkup()}
    <div class="dm-tkt-elenco">${state.tickets.map(voceMarkup).join("")}</div>
    ${contoMarkup()}
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

/* Due domande, due file di tasti.
 *
 * Stavano tutti su una riga sola, a scelta singola, e quello faceva sembrare
 * «Da lavorare» e «Difetti» due risposte alla stessa domanda. Non lo sono:
 * premendo «Difetti» si perdeva lo stato e arrivavano anche i difetti gia'
 * chiusi — mentre la cosa che si cerca aprendo la console e' quasi sempre
 * «i difetti **aperti**», che con una riga sola non si poteva chiedere.
 *
 * Adesso lo stato e il tipo sono due assi che si incrociano, e sotto ogni
 * tasto del tipo c'e' il suo conto, calcolato dentro lo stato scelto: si vede
 * quanto c'e' da lavorare per genere prima ancora di premere. */
export const FILTRI_STATO_ID = Object.freeze(["aperte", "in-carico", "chiuse", "tutte"]);
export const FILTRI_TIPO_ID = Object.freeze(["", "bug", "feature", "assistenza"]);

const FILTRI_STATO = [
  /* Gli stessi nomi delle cifre grandi qui sopra, apposta: premere «Da
   * lavorare» mostra esattamente quelle contate li'. */
  { id: "aperte", nome: () => t("Da lavorare", "To work on") },
  { id: "in-carico", nome: () => t("In lavorazione", "Being worked on") },
  { id: "chiuse", nome: () => t("Chiuse", "Closed") },
  { id: "tutte", nome: () => t("Tutte", "All") },
];

const FILTRI_TIPO = [
  { id: "", nome: () => t("Ogni tipo", "Any type") },
  { id: "bug", nome: () => t("Difetti", "Bugs") },
  { id: "feature", nome: () => t("Idee", "Ideas") },
  { id: "assistenza", nome: () => t("Aiuto", "Help") },
];

/* Una segnalazione aperta a mano su GitHub non ha nessun tipo scritto da
 * nessuna parte. Mostrarla come un difetto sarebbe comodo e falso: prende una
 * pastiglia grigia che non dice niente, che e' esattamente quello che si sa. */
const TIPO_IGNOTO = {
  id: "",
  icona: "•",
  rgb: "113,113,122",
  nome: () => t("Senza tipo", "Untyped"),
};

function tipoInCoda(id) {
  return TIPI.find((voce) => voce.id === id) || TIPO_IGNOTO;
}

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

const CHIUSA = ["risolto", "chiuso"];

/* «Voglio capire cosa ho preso in carico e quelle ancora da prendere in
 * carico.» Le cifre grandi in cima dicono 3 da lavorare e 5 in lavorazione, e
 * i tasti qui sotto sono esattamente quelle cifre: premere «Da lavorare»
 * lascia le tre lette un dito piu' su, premere «In lavorazione» le cinque.
 *
 * «Da lavorare» un tempo le metteva insieme — tutte le aperte — e accanto
 * c'era un terzo tasto, «Nuove», per le sole non prese. Segnalato cosi': «il
 * filtro da lavorare / in lavorazione non va, ci sono richieste prese in
 * carico ed esce da lavorare». Aveva ragione: una segnalazione che qualcuno
 * ha gia' preso in carico non e' piu' da lavorare, e' in lavorazione. Il
 * tasto adesso dice quello che il suo nome promette, e quello in piu' — che
 * diceva la stessa cosa con un'altra parola — se n'e' andato. */
function perStato(coda, filtro) {
  const aperte = coda.filter((ticket) => !CHIUSA.includes(clean(ticket.state)));
  /* Presa in carico vuol dire assegnata: e' la stessa regola con cui la coda
   * calcola lo stato, e con cui il conto grande qui sopra conta. */
  if (filtro === "in-carico") {
    return aperte.filter((ticket) => clean(ticket.state) === "in-carico");
  }
  /* «nuove» e' il nome vecchio dello stesso tasto: chi l'aveva ancora sotto il
   * dito trova le stesse righe. */
  if (filtro === "aperte" || filtro === "nuove") {
    return aperte.filter((ticket) => clean(ticket.state) !== "in-carico");
  }
  if (filtro === "chiuse") {
    return coda.filter((ticket) => CHIUSA.includes(clean(ticket.state)));
  }
  return coda;
}

function filaMarkup(voci, scelto, attributo) {
  return `<div class="dm-tkt-filtri">${voci
    .map((filtro) => {
      const attivo = scelto === filtro.id;
      /* Il conto sta sotto i tasti del tipo e non sotto quelli dello stato:
       * li' lo direbbe due volte, perche' le tre cifre grandi qui sopra sono
       * gia' il conto per stato. */
      const conto = Number.isFinite(filtro.quante)
        ? `<span class="dm-tkt-quanti">${filtro.quante}</span>`
        : "";
      return `<button type="button" class="dm-tkt-filtro${attivo ? " attivo" : ""}"
        ${attributo}="${filtro.id}" aria-pressed="${attivo}">${esc(
          filtro.nome(),
        )}${conto}</button>`;
    })
    .join("")}</div>`;
}

function filtriMarkup(coda) {
  /* I conti del tipo si contano DENTRO lo stato scelto: con «Da lavorare»
   * acceso, «Difetti 6» vuol dire sei difetti da lavorare, non sei difetti in
   * tutta la storia della repository. E' il numero che serve a decidere cosa
   * premere. */
  const dentroLoStato = perStato(coda, state.filtro);
  const conIlConto = FILTRI_TIPO.map((filtro) => ({
    ...filtro,
    quante: filtro.id
      ? dentroLoStato.filter((ticket) => clean(ticket.type) === filtro.id).length
      : dentroLoStato.length,
  }));
  return (
    filaMarkup(FILTRI_STATO, state.filtro, "data-dm-filtro") +
    filaMarkup(conIlConto, state.tipoCoda, "data-dm-tipo-coda")
  );
}

export function filtra(coda, filtro = state.filtro, tipo = state.tipoCoda) {
  const perLoStato = perStato(coda, filtro);
  /* Tipo vuoto vuol dire «ogni tipo», non «quelle senza tipo»: le seconde si
   * riconoscono dalla pastiglia grigia, e nasconderle dietro il tasto che
   * significa «non filtrare» le renderebbe irraggiungibili. */
  if (!tipo) return perLoStato;
  return perLoStato.filter((ticket) => clean(ticket.type) === tipo);
}

function quandoMarkup(ticket) {
  const numero = Number(ticket.number) || 0;
  const chi = clean(ticket.author);
  return `#${numero}${chi ? ` · ${esc(chi)}` : ""}`;
}

/* Il segno che dice quali segnalazioni valga la pena aprire. Il conto arriva
 * dalla coda, senza chiedere niente in piu' a GitHub: una segnalazione che
 * sembra nuda e invece ha dentro una schermata e' esattamente quella che si
 * salta. */
function segniMarkup(ticket) {
  const allegati = Number(ticket.attachments) || 0;
  const commenti = Number(ticket.comments) || 0;
  const segni = [];
  if (allegati) {
    segni.push(
      `<span class="dm-tkt-segno" title="${esc(
        t("Allegati", "Attachments"),
      )}">📎 ${allegati}</span>`,
    );
  }
  if (commenti) {
    segni.push(
      `<span class="dm-tkt-segno" title="${esc(t("Commenti", "Comments"))}">💬 ${commenti}</span>`,
    );
  }
  if (nonLetto(ticket.number)) {
    /* Il pallino sulla riga, e non solo il conto nel widget: aperto il
     * cruscotto, quello che aspetta risposta si deve vedere senza cercarlo
     * riga per riga. Si spegne aprendo il filo, che e' il gesto che lo legge. */
    segni.push(
      `<span class="dm-tkt-segno nuovo" title="${esc(
        t("Messaggi nuovi", "New messages"),
      )}">🔵 ${esc(t("nuovo", "new"))}</span>`,
    );
  }
  const incaricati = Array.isArray(ticket.assignees) ? ticket.assignees.map(clean) : [];
  if (incaricati.length) {
    /* Il nome, e non solo il simbolo: il giorno che i manutentori sono due,
     * «presa in carico» senza dire da chi e' l'informazione a meta'. */
    segni.push(
      `<span class="dm-tkt-segno" title="${esc(t("Presa in carico", "Taken"))}">🙋 ${esc(
        incaricati.join(", "),
      )}</span>`,
    );
  }
  return segni.join("");
}

export function allegatiMarkup(allegati) {
  if (!Array.isArray(allegati) || !allegati.length) return "";
  return `<div class="dm-tkt-allegati">${allegati
    .map((allegato) => {
      const url = clean(allegato?.url);
      if (!url.startsWith("https://")) return "";
      const nome = clean(allegato?.name);
      if (allegato?.kind === "image") {
        /* Si prova a mostrarla. Se la CSP di Home Assistant non lascia
         * passare l'immagine — o se GitHub non risponde — resta il rimando,
         * che e' sempre meglio di un riquadro rotto. */
        return `
          <a class="dm-tkt-allegato" href="${esc(url)}"
             target="_blank" rel="noreferrer noopener">
            <img src="${esc(url)}" alt="${esc(nome || t("Allegato", "Attachment"))}"
                 loading="lazy"
                 onerror="const p=this.parentElement;this.remove();p&&p.classList.add('rotto')">
            <span>${esc(nome || t("Apri l'immagine", "Open the image"))}</span>
          </a>`;
      }
      return `
        <a class="dm-tkt-allegato solo-link" href="${esc(url)}"
           target="_blank" rel="noreferrer noopener">
          <span>🎬 ${esc(nome || t("Apri l'allegato", "Open the attachment"))}</span>
        </a>`;
    })
    .join("")}</div>`;
}

function quandoLeggibile(iso) {
  const quando = Date.parse(clean(iso));
  return Number.isFinite(quando) ? new Date(quando).toLocaleString() : "";
}

function filoMarkup(numero) {
  if (state.filiInCorso[numero]) {
    return `<div class="dm-tkt-filo-attesa">${esc(
      t("Leggo la segnalazione…", "Reading the report…"),
    )}</div>`;
  }
  const filo = state.fili[numero];
  if (!filo) return "";
  const commenti = Array.isArray(filo.comments) ? filo.comments : [];
  const corpo = `
    <div class="dm-tkt-commento originale">
      <div class="dm-tkt-commento-testa">${esc(
        t("Il testo della segnalazione", "The text of the report"),
      )}</div>
      <p class="dm-tkt-voce-corpo">${esc(clean(filo.body))}</p>
      ${diagnosticaMarkup(filo.diagnostics)}
      ${allegatiMarkup(filo.attachments)}
    </div>`;
  const filaCommenti = commenti.length
    ? commenti
        .map(
          (commento) => `
            <div class="dm-tkt-commento${commento.maintainer ? " mio" : ""}">
              <div class="dm-tkt-commento-testa">
                <b>${esc(clean(commento.author))}</b>
                ${
                  commento.maintainer
                    ? `<span class="dm-tkt-segno">${esc(
                        /* «tu» solo a chi tiene la repository. Da quando il
                         * filo lo legge anche chi ha segnalato, quella
                         * pastiglia gli diceva che la risposta del manutentore
                         * l'aveva scritta lui. */
                        state.console ? t("tu", "you") : t("manutentore", "maintainer"),
                      )}</span>`
                    : ""
                }
                <span>${esc(quandoLeggibile(commento.at))}</span>
              </div>
              <p class="dm-tkt-voce-corpo">${esc(clean(commento.body))}</p>
              ${allegatiMarkup(commento.attachments)}
            </div>`,
        )
        .join("")
    : `<div class="dm-tkt-filo-attesa">${esc(
        t("Nessuno ha ancora scritto niente.", "Nobody has written anything yet."),
      )}</div>`;
  return `<div class="dm-tkt-filo">${corpo}${filaCommenti}</div>`;
}

/* Dove finisce la risposta. Su una segnalazione nata dalla plancia chi ha
 * scritto se la ritrova anche dentro la sua dashboard, al primo giro di sync;
 * su una aperta a mano su GitHub la trovera' solo su GitHub, dove l'ha
 * scritta. Cambia come raggiungi la persona, non cosa puoi fare qui. */
function provenienzaMarkup(ticket) {
  if (clean(ticket.origin) === "plancia") {
    return `<span class="dm-tkt-segno" title="${esc(
      t(
        "Arrivata da una dashboard: la risposta le torna dentro",
        "Came from a dashboard: the reply goes back into it",
      ),
    )}">🏠 ${esc(t("dalla plancia", "from a dashboard"))}</span>`;
  }
  return `<span class="dm-tkt-segno" title="${esc(
    t(
      "Aperta direttamente su GitHub: la risposta resta li'",
      "Opened directly on GitHub: the reply stays there",
    ),
  )}">🐙 ${esc(t("da GitHub", "from GitHub"))}</span>`;
}

/* Il segnaposto dice dove va a finire quello che si sta per scrivere, e su una
 * issue aperta a mano su GitHub la risposta li' resta: promettere che chi ha
 * segnalato «la trova nella sua plancia» sarebbe falso proprio per le voci che
 * questa versione ha appena aggiunto, e farebbe credere al manutentore di aver
 * avvisato qualcuno che invece non e' stato avvisato. */
function invitoRisposta(ticket) {
  if (clean(ticket.origin) === "plancia") {
    return t(
      "La risposta finisce sotto la segnalazione, e chi l'ha aperta la trova nella sua plancia.",
      "The reply goes under the report, and whoever opened it finds it in their own dashboard.",
    );
  }
  return t(
    "La risposta finisce sotto la segnalazione, su GitHub: chi l'ha aperta la legge li'.",
    "The reply goes under the report, on GitHub: whoever opened it reads it there.",
  );
}

/* La scheda tecnica, in ordine di quanto serve.
 *
 * Chi legge una segnalazione ha due domande, e in quest'ordine: «che versione
 * ha» e «dove stava». Il resto — la lingua, il browser — serve una volta su
 * venti, e messo alla pari copriva le prime due: cinque righe uguali fra loro,
 * con l'unica che conta in mezzo.
 *
 * Le due che contano prendono una pastiglia con la loro etichetta breve; le
 * altre restano sotto, piu' piccole. Lo `user_agent` non si mostra intero — e'
 * lungo quanto tutto il resto insieme — ma il nome del browser si legge da
 * solo, e per il resto c'e' la pagina della issue. */
const VERSIONI = [
  ["integration_version", "DM"],
  ["ha_version", "HA"],
];

function nomeDelBrowser(agente) {
  const teste = [
    [/edg\/([\d.]+)/i, "Edge"],
    [/opr\/([\d.]+)/i, "Opera"],
    [/firefox\/([\d.]+)/i, "Firefox"],
    [/chrome\/([\d.]+)/i, "Chrome"],
    [/version\/([\d.]+).*safari/i, "Safari"],
  ];
  for (const [forma, nome] of teste) {
    const trovato = forma.exec(agente);
    /* Solo la prima cifra: «Chrome 152» dice quello che serve, «152.0.0.0» in
     * piu' dice soltanto degli zeri. */
    if (trovato) return `${nome} ${String(trovato[1]).split(".")[0]}`;
  }
  return "";
}

export function diagnosticaMarkup(diagnostica) {
  if (!diagnostica || typeof diagnostica !== "object") return "";
  const preso = new Set();
  const forti = VERSIONI.filter(([chiave]) => clean(diagnostica[chiave])).map(([chiave, breve]) => {
    preso.add(chiave);
    return `<span class="dm-tkt-versione"><b>${esc(breve)}</b>${esc(
      clean(diagnostica[chiave]),
    )}</span>`;
  });
  const deboli = [];
  for (const [chiave, valore] of Object.entries(diagnostica)) {
    if (preso.has(chiave)) continue;
    const testo = clean(valore);
    if (!testo) continue;
    /* Il browser al posto della sua carta d'identita' completa. */
    const corto = chiave === "user_agent" ? nomeDelBrowser(testo) : testo;
    if (corto) deboli.push(`<span class="dm-tkt-dato">${esc(corto)}</span>`);
  }
  if (!forti.length && !deboli.length) return "";
  return `<div class="dm-tkt-scheda">${forti.join("")}${deboli.join("")}</div>`;
}

export function codaVoceMarkup(ticket) {
  const numero = Number(ticket.number) || 0;
  const tipo = tipoInCoda(clean(ticket.type));
  const chiusa = CHIUSA.includes(clean(ticket.state));
  const aperto = Boolean(state.fili[numero] || state.filiInCorso[numero]);
  /* I tasti che scrivono partono spenti e si accendono quando c'e' del testo.
   * Prima erano sempre premibili e rispondevano «Scrivi una risposta»: un
   * rimprovero al posto di un invito, per un errore che il tasto poteva
   * semplicemente non lasciar commettere.
   *
   * Quelli che chiudono e basta restano accesi: chiudere senza scrivere e' un
   * gesto legittimo — «non e' un difetto», «era gia' risolta» — e pretendere un
   * commento per farlo vorrebbe dire chiedere di scrivere per forza. */
  const scrive = ` data-dm-serve-testo="${numero}" disabled`;
  /* Prendere in carico e' l'assegnazione di GitHub, non un'etichetta
   * inventata qui: chi passa dalla pagina della issue lo vede senza che
   * nessuno glielo scriva, e il cruscotto e la repository dicono la stessa
   * cosa. Su una chiusa il tasto non c'e': non si prende in carico quello che
   * e' gia' finito. */
  const incaricati = Array.isArray(ticket.assignees) ? ticket.assignees.map(clean) : [];
  const presa = incaricati.length > 0;
  const carico = chiusa
    ? ""
    : `<button type="button" class="dm-tkt-btn${presa ? "" : " chiaro"}"
          data-dm-carico="${numero}" data-dm-prendi="${presa ? "" : "1"}"
          aria-pressed="${presa}" title="${esc(
            presa
              ? `${t("In carico a", "Taken by")} ${incaricati.join(", ")}`
              : t(
                  "Assegna la segnalazione a te su GitHub",
                  "Assign the report to yourself on GitHub",
                ),
          )}">${esc(
            presa ? t("Lascia", "Release") : t("Prendo in carico", "I'll take it"),
          )}</button>`;
  const azioni = chiusa
    ? `<button type="button" class="dm-tkt-btn chiaro"
         data-dm-rispondi="${numero}" data-dm-chiudi=""${scrive}>${esc(
           t("Aggiungi una risposta", "Add a reply"),
         )}</button>`
    : `
      <button type="button" class="dm-tkt-btn chiaro"
        data-dm-rispondi="${numero}" data-dm-chiudi=""${scrive}>${esc(
          t("Rispondi", "Reply"),
        )}</button>
      <button type="button" class="dm-tkt-btn"
        data-dm-rispondi="${numero}" data-dm-chiudi="risolto"${scrive}>${esc(
          t("Rispondi e risolvi", "Reply and solve"),
        )}</button>
      <button type="button" class="dm-tkt-btn chiaro"
        data-dm-rispondi="${numero}" data-dm-chiudi="risolto">${esc(t("Risolvi", "Solve"))}</button>
      <button type="button" class="dm-tkt-btn chiaro"
        data-dm-rispondi="${numero}" data-dm-chiudi="chiuso">${esc(
          t("Archivia", "Archive"),
        )}</button>`;
  return `
    <div class="dm-tkt-voce dm-tkt-lavoro" style="--tk-rgb:${tipo.rgb};">
      <div class="dm-tkt-voce-testa">
        <span class="dm-tkt-tipo-pill" role="img" aria-label="${esc(
          tipo.nome(),
        )}" title="${esc(tipo.nome())}">${tipo.icona}</span>
        <span class="dm-tkt-voce-tit">${esc(clean(ticket.title))}</span>
        ${segniMarkup(ticket)}
        ${statoMarkup(clean(ticket.state) || "inviato")}
      </div>
      <div class="dm-tkt-voce-pie">
        <span>${quandoMarkup(ticket)}</span>
        ${provenienzaMarkup(ticket)}
        <button type="button" class="dm-tkt-tolgi" data-dm-filo="${numero}"
          aria-expanded="${aperto}">${esc(
            aperto ? t("Nascondi tutto", "Hide everything") : t("Vedi tutto", "See everything"),
          )}</button>
        <a class="dm-tkt-link" href="${esc(clean(ticket.issue_url))}"
           target="_blank" rel="noreferrer noopener">${esc(
             t("Apri su GitHub", "Open on GitHub"),
           )}</a>
      </div>
      ${
        aperto
          ? filoMarkup(numero)
          : `<p class="dm-tkt-voce-corpo">${esc(clean(ticket.body))}</p>${diagnosticaMarkup(
              ticket.diagnostics,
            )}`
      }
      <div class="dm-tkt-campo">
        <textarea id="dm-tkt-risposta-${numero}" rows="3"
          placeholder="${esc(invitoRisposta(ticket))}"></textarea>
      </div>
      <div class="dm-tkt-azioni">${carico}${azioni}</div>
    </div>`;
}

function vuotoMarkup() {
  /* Col tipo acceso il vuoto e' quasi sempre colpa sua, non dello stato:
   * dirlo evita di guardare una coda vuota chiedendosi dove siano finite le
   * altre trentanove. */
  if (state.tipoCoda) {
    return t("Niente di questo tipo, qui.", "Nothing of this kind here.");
  }
  if (state.filtro === "aperte") {
    return t("Nessuna segnalazione da lavorare. Buon per te.", "Nothing to work on. Good for you.");
  }
  if (state.filtro === "nuove") {
    return t(
      "Nessuna segnalazione ancora da prendere in carico.",
      "No report left to take on.",
    );
  }
  if (state.filtro === "in-carico") {
    return t("Non hai niente in lavorazione.", "You have nothing in progress.");
  }
  if (state.filtro === "chiuse") {
    return t("Ancora niente di chiuso.", "Nothing closed yet.");
  }
  return t("Niente con questo filtro.", "Nothing under this filter.");
}

function consoleMarkup() {
  if (state.queue === null) {
    return `<div class="dm-tkt-vuoto">${esc(t("Carico la coda…", "Loading the queue…"))}</div>`;
  }
  const coda = state.queue;
  const scelte = filtra(coda);
  const elenco = scelte.length
    ? `<div class="dm-tkt-elenco">${scelte.map(codaVoceMarkup).join("")}</div>`
    : `<div class="dm-tkt-vuoto">${esc(vuotoMarkup())}</div>`;
  return `
    ${colonneMarkup(coda)}
    ${filtriMarkup(coda)}
    ${elenco}
    <div class="dm-tkt-azioni">
      <button type="button" class="dm-tkt-btn chiaro" data-dm-tkt="ricarica-coda" ${
        state.busy ? "disabled" : ""
      }>${esc(t("Aggiorna", "Refresh"))}</button>
    </div>`;
}

/** La riga sotto il titolo: dove sei, e con che account. */
/* ─── Il cruscotto: una pagina, non una finestra ──────────────────────────
 *
 * Stava dentro il popup delle segnalazioni, come terza linguetta. Ma la coda
 * del manutentore non e' una cosa che si sbircia: si legge un titolo, si apre
 * il filo, si guarda una foto, si scrive una risposta — e tutto questo dentro
 * un riquadro largo un palmo vuol dire scorrere per fare qualunque cosa.
 *
 * Adesso e' una pagina sua, con la sua voce nella barra, e ci sta tutto a
 * schermo intero. La voce c'e' **solo per chi tiene la repository**: non e'
 * un'impostazione da spegnere, e' che per gli altri quella pagina non ha niente
 * dentro. Chi ce l'ha la puo' nascondere come tutte le altre.
 */

const CRUSCOTTO_TAB = "cruscotto";
const CRUSCOTTO_PAGE_ID = "page-cruscotto";

function ultimaPagina() {
  const pagine = doc?.querySelectorAll?.(".page");
  return pagine?.length ? pagine[pagine.length - 1] : null;
}

function creaPaginaCruscotto() {
  if (!doc) return null;
  const gia = doc.getElementById(CRUSCOTTO_PAGE_ID);
  if (gia) return gia;
  const sorella = ultimaPagina();
  if (!sorella?.parentElement) return null;
  const pagina = doc.createElement("section");
  pagina.className = "page";
  pagina.id = CRUSCOTTO_PAGE_ID;
  pagina.innerHTML = `<div class="dm-tkt-plancia" data-dm-cruscotto></div>`;
  sorella.after(pagina);
  return pagina;
}

function creaVoceCruscotto() {
  if (!doc) return null;
  const gia = doc.querySelector(`.tab[data-tab="${CRUSCOTTO_TAB}"]`);
  if (gia) return gia;
  const barra = doc.querySelector("nav.tabs");
  if (!barra) return null;
  const voce = doc.createElement("button");
  voce.className = "tab";
  voce.dataset.tab = CRUSCOTTO_TAB;
  voce.id = `tab-${CRUSCOTTO_TAB}`;
  voce.innerHTML = `<span class="icon">🎫</span><span class="text">${esc(
    t("Cruscotto", "Console"),
  )}</span>`;
  /* Il gestore che il runtime lega alle voci lo lega una volta sola, al
   * caricamento: questa arriva dopo e il suo tocco se lo gestisce da se'. Fa la
   * stessa identica cosa, perche' due modi di cambiare pagina sarebbero due
   * pagine attive quando non tornano. */
  voce.addEventListener("click", () => {
    for (const nodo of doc.querySelectorAll(".tab")) nodo.classList.remove("active");
    for (const nodo of doc.querySelectorAll(".page")) nodo.classList.remove("active");
    voce.classList.add("active");
    creaPaginaCruscotto()?.classList.add("active");
    if (root.navigator?.vibrate) root.navigator.vibrate(5);
    /* Aprendola si va a vedere se e' cambiato qualcosa: e' il gesto con cui si
     * chiede «cosa c'e' di nuovo», e rispondere con quello di dieci minuti fa
     * sarebbe rispondere a un'altra domanda. */
    caricaCoda({ zitta: true });
    disegnaCruscotto();
  });
  barra.append(voce);
  return voce;
}

/* La voce si nasconde come tutte le altre: `cdApplyNavVis` sa quali voci
 * esistono da una mappa sua, e una che non c'e' resta sempre accesa qualunque
 * cosa dica la configurazione. */
function insegnaLaVisibilitaDelCruscotto() {
  const precedente = root.cdNavVisMap;
  if (typeof precedente !== "function" || precedente.__dmCruscotto) return;
  const avvolta = function cdNavVisMap(...args) {
    const mappa = precedente.apply(this, args) || {};
    return { ...mappa, [CRUSCOTTO_TAB]: CRUSCOTTO_TAB };
  };
  avvolta.__dmCruscotto = true;
  avvolta.__dmPrevious = precedente;
  root.cdNavVisMap = avvolta;
}

/* La pagina esiste solo per chi tiene la repository, e sparisce se quel
 * riconoscimento cade — chi si scollega non deve restare con una voce nella
 * barra che apre una pagina vuota. */
export function sistemaIlCruscotto() {
  if (!doc) return;
  if (!state.console) {
    doc.querySelector(`.tab[data-tab="${CRUSCOTTO_TAB}"]`)?.remove();
    doc.getElementById(CRUSCOTTO_PAGE_ID)?.remove();
    return;
  }
  creaPaginaCruscotto();
  creaVoceCruscotto();
  insegnaLaVisibilitaDelCruscotto();
  /* E si riapplica la visibilita' salvata, adesso che la mappa conosce questa
   * voce e la voce esiste. Il guscio la applica una volta sola, all'avvio;
   * questa arriva dopo — la crea `ricarica()`, quando GitHub ha detto chi
   * guarda — e senza questa riga chi l'aveva nascosta se la ritrovava nella
   * barra a ogni ricarica della pagina, fino a un gesto qualunque che facesse
   * ripassare il guscio. Cioe' un interruttore che sembra non funzionare. */
  root.cdApplyNavVis?.();
  disegnaCruscotto();
}

/* Il motivo per cui la coda non e' arrivata, quando non e' arrivata.
 *
 * Sta sopra l'elenco e non al posto suo, perche' i due casi sono diversi e
 * tutti e due veri. Alla prima accensione non c'e' niente da mostrare, e resta
 * solo il motivo. Ma se una coda era gia' arrivata e a fallire e' stata la
 * rilettura, l'elenco vecchio si tiene — meglio numeri di dieci minuti fa che
 * una pagina bianca — e allora bisogna dire che sono di dieci minuti fa. Prima
 * l'elenco vecchio restava li' con l'aria di essere fresco e il motivo non lo
 * leggeva nessuno. */
function guastoDellaCoda() {
  if (!state.codaErrore) return "";
  const cache = Array.isArray(state.queue)
    ? ` ${t(
        "I numeri qui sotto sono quelli dell'ultima lettura riuscita.",
        "The numbers below are from the last successful read.",
      )}`
    : "";
  return `<div class="dm-tkt-vuoto">${esc(
    `${t("Non sono riuscito a leggere la coda:", "I could not read the queue:")} ${state.codaErrore}${cache}`,
  )}</div>`;
}

function disegnaCruscotto() {
  const dentro = doc?.querySelector?.("[data-dm-cruscotto]");
  if (!dentro) return;
  const quante = Array.isArray(state.queue) ? state.queue.length : 0;
  dentro.innerHTML = `
    <div class="cfg-hero dm-tkt-hero">
      <div class="cfg-hero-ico" aria-hidden="true">🎫</div>
      <div class="cfg-hero-txt">
        <div class="cfg-hero-title">${esc(t("Cruscotto", "Console"))}</div>
        <div class="cfg-hero-sub">${esc(
          `${t("Tutto quello che c'e' sulla repository", "Everything on the repository")} · ${quante}`,
        )}</div>
      </div>
    </div>
    ${avvisoMarkup()}
    ${guastoDellaCoda()}
    ${
      Array.isArray(state.queue)
        ? consoleMarkup()
        : state.codaErrore
          ? ""
          : `<div class="dm-tkt-vuoto">${esc(t("Sto leggendo la coda…", "Reading the queue…"))}</div>`
    }`;
  agganciaEventi(dentro);
}

function sottotitolo() {
  /* Il pezzo che cambia si attacca FUORI da `t()`. Dentro finirebbe nella
   * chiave — una chiave diversa per ogni conteggio e per ogni login — e a
   * runtime nessun catalogo l'avrebbe mai contenuta: ogni lingua ricadrebbe
   * sull'inglese proprio in questa riga. */
  if (state.account.connected) {
    return `${t("Le tue richieste", "Your requests")} · ${state.account.login}`;
  }
  return t(
    "Segnala un difetto, proponi un'idea, chiedi aiuto",
    "Report a bug, suggest an idea, ask for help",
  );
}

function disegnaLaFinestra() {
  const modale = doc?.getElementById?.("dm-tkt-modal");
  if (!modale) return;
  modale.querySelector('[data-dm-tkt="titolo"]').textContent = t("Segnalazioni", "Reports");
  modale.querySelector('[data-dm-tkt="sottotitolo"]').textContent = sottotitolo();
  modale.querySelector('[data-dm-tkt="chiudi"]').textContent = t("Chiudi", "Close");
  const corpo = modale.querySelector('[data-dm-tkt="corpo"]');
  const pannello = state.tab === "mie" ? elencoMarkup() : moduloMarkup();
  corpo.innerHTML = schede() + avvisoMarkup() + codiceMarkup() + pannello;
  agganciaEventi(corpo);
  if (state.tab === "nuova") mostraDiagnostica(corpo);
}

/* Ridisegnare vuol dire ridisegnare tutti e due i posti, e nessuno dei due
 * comanda sull'altro.
 *
 * «Tab nel cruscotto non funziona, non mi fa selezionare Difetti e nemmeno In
 * lavorazione.» I tasti erano collegati e il tocco arrivava: metteva
 * `state.filtro` e chiamava questa. Ma questa cominciava cercando
 * `#dm-tkt-modal` e, non trovandolo, tornava indietro alla riga dopo — mentre
 * il cruscotto lo ridisegnava l’ultima riga, quella che non veniva mai
 * eseguita.
 *
 * La finestra delle segnalazioni la costruisce `apri()`, che parte dalla
 * tessera in Configurazione. Chi apre il cruscotto dalla barra quella tessera
 * non la tocca: nel documento non c’è nessun `#dm-tkt-modal`, e non ci deve
 * essere. Cioè il filtro non rispondeva mai a chi usava la pagina per quello
 * per cui esiste; rispondeva soltanto a chi, nella stessa sessione, avesse
 * aperto e chiuso la finestra almeno una volta.
 *
 * E il difetto era largo quanto la funzione: dietro `disegna()` ci stanno
 * anche il filo che si apre, la risposta appena mandata, la segnalazione
 * chiusa. Sul cruscotto nessuna di quelle si vedeva finire.
 *
 * Adesso la finestra e la pagina sono due disegni indipendenti: ciascuno
 * guarda se ha un posto dove stare, e chi non ce l’ha non impedisce all’altro
 * di esistere. */
function disegna() {
  disegnaLaFinestra();
  disegnaCruscotto();
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

/** Metti in salvo quello che c'e' scritto, prima di rifare il modulo.
 *
 * La guardia guarda il campo del titolo perche' e' il primo del modulo: se non
 * c'e' quello, il modulo non e' sulla pagina — si sta guardando «Le mie» o la
 * console — e raccogliere vorrebbe dire scrivere tre stringhe vuote sopra una
 * bozza che invece esiste.
 */
function raccogliBozza() {
  const modale = doc?.getElementById?.("dm-tkt-modal");
  if (!modale?.querySelector("#dm-tkt-campo-titolo")) return;
  state.bozza = {
    title: modale.querySelector("#dm-tkt-campo-titolo")?.value ?? "",
    body: modale.querySelector("#dm-tkt-corpo")?.value ?? "",
  };
}

function agganciaEventi(corpo) {
  corpo.querySelectorAll("[data-dm-tab]").forEach((bottone) => {
    bottone.addEventListener("click", () => {
      raccogliBozza();
      state.tab = bottone.dataset.dmTab;
      state.avviso = "";
      disegna();
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
  /* Si accendono mentre si scrive, e non a un ridisegno: rifare il markup a
   * ogni tasto premuto vorrebbe dire perdere il punto del cursore e la
   * selezione, cioe' rompere proprio la cosa che si sta usando. Qui si tocca
   * solo `disabled`, che il testo non lo sfiora. */
  corpo.querySelectorAll("[data-dm-serve-testo]").forEach((bottone) => {
    const numero = bottone.dataset.dmServeTesto;
    /* Il campo della console e quello di chi ha segnalato sono due, e il
     * secondo lo dice il tasto: senza, la casella nuova sarebbe rimasta con un
     * tasto che si accende guardando il campo di un'altra. */
    const campo = corpo.querySelector(`#${bottone.dataset.dmCampo || `dm-tkt-risposta-${numero}`}`);
    if (!campo) return;
    const aggiorna = () => {
      bottone.disabled = !clean(campo.value);
    };
    campo.addEventListener("input", aggiorna);
    aggiorna();
  });
  corpo.querySelectorAll("[data-dm-tipo-coda]").forEach((bottone) => {
    bottone.addEventListener("click", () => {
      state.tipoCoda = bottone.dataset.dmTipoCoda;
      disegna();
    });
  });
  corpo.querySelector('[data-dm-tkt="invia"]')?.addEventListener("click", invia);
  /* Senza la lambda l'ascoltatore passerebbe l'Event come opzioni: oggi
   * funzionerebbe per caso — un Event non ha `zitta`, quindi vale il difetto —
   * ma e' un caso, e il giorno che l'opzione cambia nome smette di essere
   * fortunato senza che niente lo dica. */
  corpo.querySelector('[data-dm-tkt="aggiorna"]')?.addEventListener("click", () => sincronizza());
  /* Il tasto «Aggiorna» del cruscotto era disegnato e non collegato a niente:
   * «se premo aggiorna non mi carica le nuove, devo chiudere e riaprire».
   * Quello della finestra rilegge le proprie segnalazioni; questo rilegge la
   * coda, ad alta voce — con la rotella, e se GitHub non risponde lo dice. */
  corpo
    .querySelector('[data-dm-tkt="ricarica-coda"]')
    ?.addEventListener("click", () => caricaCoda());
  corpo.querySelectorAll("[data-dm-tolgi]").forEach((bottone) => {
    bottone.addEventListener("click", () => elimina(bottone.dataset.dmTolgi));
  });
  corpo.querySelectorAll("[data-dm-filo]").forEach((bottone) => {
    bottone.addEventListener("click", () => apriFilo(bottone.dataset.dmFilo));
  });
  corpo.querySelectorAll("[data-dm-rispondi]").forEach((bottone) => {
    bottone.addEventListener("click", () =>
      rispondi(bottone.dataset.dmRispondi, bottone.dataset.dmChiudi),
    );
  });
  corpo.querySelectorAll("[data-dm-scrivi]").forEach((bottone) => {
    bottone.addEventListener("click", () => scrivi(bottone.dataset.dmScrivi));
  });
  corpo.querySelectorAll("[data-dm-carico]").forEach((bottone) => {
    bottone.addEventListener("click", () =>
      prendiInCarico(bottone.dataset.dmCarico, bottone.dataset.dmPrendi === "1"),
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
  let chiediAutorizzazione = false;
  disegna();
  try {
    const risposta = await chiedi(WS_CREATE, {
      ticket_type: state.tipo,
      title: titolo,
      body: corpo,
      diagnostics: await diagnostica(),
    });
    state.bozza = { title: "", body: "" };
    const aperta = risposta?.ticket || {};
    state.appena =
      risposta?.delivered && aperta.issue_url
        ? { numero: clean(aperta.remote_id), url: clean(aperta.issue_url) }
        : null;
    /* Tre esiti, e uno solo chiede qualcosa.
     *
     * Partita: fatto. Salvata e basta — l'invio non e' configurato, o la rete
     * non c'era: riparte da sola. Salvata ma manca la firma: si chiede
     * l'autorizzazione ADESSO, che e' il momento in cui ha un motivo, e con la
     * segnalazione gia' al sicuro. Chi si ferma qui non perde niente: parte da
     * sola appena collega. */
    if (risposta?.delivered) {
      state.avviso = t("Inviata. Grazie.", "Sent. Thank you.");
    } else if (state.delivery && !state.account.connected) {
      state.avviso = t(
        "Salvata. Manca solo la firma: autorizza GitHub e parte.",
        "Saved. Only the signature is missing: authorize GitHub and it goes.",
      );
      chiediAutorizzazione = true;
    } else {
      state.avviso = t(
        "Salvata. Partira' da sola appena l'invio sara' configurato.",
        "Saved. It will be sent on its own once sending is configured.",
      );
    }
    state.tab = "mie";
  } catch (errore) {
    state.avviso = `!${clean(errore?.message) || t("Non riuscita.", "It did not work.")}`;
  } finally {
    state.busy = false;
    await ricarica();
    if (chiediAutorizzazione) await collega({ salvata: true });
  }
}

/* Ogni quanto le risposte si vanno a riprendere da sole all'apertura. Un
 * minuto: aprire e richiudere la finestra tre volte di fila non deve voler dire
 * tre giri completi verso GitHub, e in un minuto non e' cambiato niente. */
const RISPOSTE_FRESCHE = 60 * 1000;

async function sincronizza({ zitta = false } = {}) {
  /* Zitta e' il giro che la finestra fa da sola quando si apre: si salta se e'
   * appena stato fatto, non accende la rotella e se la rete e' giu' non dice
   * niente — chi ha solo aperto una finestra non ha chiesto niente, e un avviso
   * rosso in faccia all'apertura sarebbe una risposta a una domanda che nessuno
   * ha fatto. Ad alta voce e' il tasto «Aggiorna», dove qualcuno ha chiesto. */
  if (zitta && Date.now() - state.syncAt < RISPOSTE_FRESCHE) return;
  if (!zitta) {
    state.busy = true;
    disegna();
  }
  try {
    const risposta = await chiedi(WS_SYNC);
    state.tickets = Array.isArray(risposta?.tickets) ? risposta.tickets : state.tickets;
    state.delivery = Boolean(risposta?.delivery);
    state.syncAt = Date.now();
    await caricaNonLetti();
  } catch (errore) {
    if (!zitta) {
      state.avviso = `!${clean(errore?.message) || t("Non riuscita.", "It did not work.")}`;
    }
  } finally {
    state.busy = false;
    installaTessera();
    disegna();
  }
}

/* Chi ha scritto, e nessuno ha ancora letto.
 *
 * Non chiede niente a GitHub: e' l'elenco che il campanello ha gia' riempito
 * nel suo giro da cinque minuti. Sta accanto agli altri due giri invece che in
 * uno suo perche' costa quanto una lettura di un file, e perche' serve a
 * entrambi i lati — a chi tiene la repository e a chi aspetta una risposta.
 *
 * Zitta sempre: e' un contorno, e se non arriva non c'e' niente da dire. */
async function caricaNonLetti() {
  try {
    const risposta = await chiedi(WS_UNREAD);
    state.nonLetti = Array.isArray(risposta?.messages) ? risposta.messages : [];
  } catch {
    /* Nessun avviso: un pallino che non compare e' meno peggio di un errore
     * rosso per una cosa che nessuno ha chiesto. */
  }
}

/** Se sotto questa segnalazione c'e' un messaggio non ancora letto. */
function nonLetto(numero) {
  return state.nonLetti.some((voce) => Number(voce?.number) === Number(numero));
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

/* Un giro solo per due mestieri, perche' due funzioni che chiedono la stessa
 * cosa a GitHub finiscono sempre per rispondere in modo diverso.
 *
 * `zitta` e' il giro che la Home fa da sola per il widget: si salta se la coda
 * e' ancora fresca, e se GitHub non risponde non dice niente — chi non ha
 * chiesto niente non deve vedersi comparire un avviso. Ad alta voce e' il giro
 * della console, dove qualcuno sta guardando e vuole sapere. */
async function caricaCoda({ zitta = false } = {}) {
  if (zitta && Array.isArray(state.queue) && Date.now() - state.queueAt < CODA_FRESCA) return;
  try {
    const risposta = await chiedi(WS_QUEUE);
    state.queue = Array.isArray(risposta?.tickets) ? risposta.tickets : [];
    state.queueAt = Date.now();
    state.codaErrore = "";
    await caricaNonLetti();
  } catch (errore) {
    const motivo = clean(errore?.message) || t("Coda non raggiungibile.", "Queue unreachable.");
    /* Il motivo si scrive sempre, anche nel giro zitto. Zitto vuol dire «non
     * mettere un avviso rosso in faccia a chi non ha chiesto niente», non
     * «fai finta che vada tutto bene»: senza questa riga il cruscotto restava
     * una pagina vuota e la tessera in Home non compariva, tutte e due senza
     * una parola su cosa fosse andato storto. */
    state.codaErrore = motivo;
    if (zitta) return;
    state.queue = [];
    state.avviso = `!${motivo}`;
  }
  if (zitta) aggiornaIlCruscotto();
  else disegna();
}

/* Il ridisegno del cruscotto dopo un giro zitto.
 *
 * «Zitto» voleva dire «non ridisegnare», e per la finestra va bene: nessuno
 * l'ha aperta. Ma il cruscotto e' una pagina, e puo' essere aperta davanti
 * agli occhi mentre il battito da dieci minuti porta la coda nuova: restava
 * ferma su quella vecchia a tempo indefinito. Anche aprendola: il tocco
 * disegna subito con quello che c'e' e chiede la coda, che arriva dopo.
 *
 * Non si ridisegna sopra le dita di nessuno. Se in una casella c'e' del testo,
 * qualcuno sta scrivendo una risposta: rifare il markup vorrebbe dire
 * cancellargliela. La coda nuova aspetta il ridisegno successivo — che arriva
 * appena manda, perche' quello e' un giro ad alta voce. */
function aggiornaIlCruscotto() {
  const dentro = doc?.querySelector?.("[data-dm-cruscotto]");
  if (!dentro) return;
  const scrivendo = [...dentro.querySelectorAll("textarea")].some((campo) => clean(campo.value));
  if (scrivendo) return;
  disegnaCruscotto();
}

/**
 * Apri o richiudi il filo di una segnalazione.
 *
 * Una richiesta sola, e solo la prima volta: quello che si e' gia' letto resta
 * a disposizione finche' la console e' aperta, invece di richiederlo a GitHub
 * ogni volta che si apre e si chiude la stessa segnalazione.
 */
async function apriFilo(numero) {
  const chiave = String(Number(numero) || 0);
  if (chiave === "0") return;
  if (state.fili[chiave]) {
    delete state.fili[chiave];
    disegna();
    return;
  }
  if (state.filiInCorso[chiave]) return;
  state.filiInCorso[chiave] = true;
  disegna();
  try {
    state.fili[chiave] = await chiedi(WS_THREAD, { number: Number(chiave) });
    /* Il backend l'ha gia' segnata letta: qui si toglie il pallino subito,
     * invece di lasciarlo acceso sotto gli occhi di chi sta leggendo fino al
     * prossimo giro. */
    state.nonLetti = state.nonLetti.filter((voce) => Number(voce?.number) !== Number(chiave));
  } catch (errore) {
    state.avviso = `!${clean(errore?.message) || t("Non riuscita.", "It did not work.")}`;
  } finally {
    delete state.filiInCorso[chiave];
    disegna();
  }
}

/* Dove sta scritto quello che si sta per mandare.
 *
 * Si cerca nel documento e non dentro la finestra, perche' da quando il
 * cruscotto e' una pagina della barra il campo della console **non e' piu'
 * dentro `#dm-tkt-modal`**: cercarlo li' tornava sempre vuoto, e «Rispondi»
 * usciva dalla funzione alla riga dopo senza dire niente. I tasti che
 * chiudevano e basta continuavano a funzionare, il che rendeva il guasto
 * ancora piu' difficile da vedere. Gli identificativi sono unici nel
 * documento, quindi cercare largo qui e' cercare esatto. */
function campoDi(identificativo) {
  return clean(doc?.getElementById?.(identificativo)?.value);
}

async function scrivi(numero) {
  const issue = Number(numero) || 0;
  if (!issue) return;
  const testo = campoDi(`dm-tkt-mio-${issue}`);
  if (!testo) return;
  state.busy = true;
  disegna();
  try {
    await chiedi(WS_REPLY, { number: issue, message: testo });
    state.avviso = t("Messaggio mandato.", "Message sent.");
    /* Il filo letto un attimo fa non contiene la riga appena scritta: si
     * butta, e si rilegge aprendolo. Rimetterla a mano nell'elenco vorrebbe
     * dire mostrare una versione della conversazione che non e' quella vera. */
    delete state.fili[String(issue)];
  } catch (errore) {
    state.avviso = `!${clean(errore?.message) || t("Non riuscita.", "It did not work.")}`;
  } finally {
    state.busy = false;
    disegna();
  }
}

async function prendiInCarico(numero, prendi) {
  const issue = Number(numero) || 0;
  if (!issue) return;
  state.busy = true;
  disegna();
  try {
    await chiedi(WS_TAKE, { number: issue, take: Boolean(prendi) });
    state.avviso = prendi ? t("Presa in carico.", "Taken.") : t("Lasciata libera.", "Released.");
    /* La coda va riletta: l'assegnazione la porta GitHub, e riscriverla qui a
     * mano vorrebbe dire un cruscotto che dice una cosa e la repository
     * un'altra al primo aggiornamento andato storto. */
    state.queue = null;
  } catch (errore) {
    state.avviso = `!${clean(errore?.message) || t("Non riuscita.", "It did not work.")}`;
  } finally {
    state.busy = false;
    if (state.queue === null) await caricaCoda();
    else disegna();
  }
}

async function rispondi(numero, chiusura) {
  const issue = Number(numero) || 0;
  if (!issue) return;
  const testo = campoDi(`dm-tkt-risposta-${issue}`);
  /* Chiudere senza scrivere ha senso — «non e' un difetto», «era gia'
   * risolta». Rispondere senza testo no: sarebbe un commento vuoto sotto la
   * segnalazione di qualcuno. I tasti che scrivono nascono spenti apposta, e
   * questa riga resta come rete: un tasto premuto da tastiera o da un'altra
   * strada non deve poter pubblicare il vuoto. */
  if (!testo && !chiusura) return;
  state.busy = true;
  disegna();
  try {
    await chiedi(WS_ANSWER, { number: issue, reply: testo, close: chiusura || "" });
    state.avviso = t("Risposta pubblicata.", "Reply published.");
    /* Il filo appena letto non contiene la risposta che si e' appena
     * scritta: si butta, e si rilegge quando serve. */
    delete state.fili[String(issue)];
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
  /* Il tasto sta dentro la finestra di una tessera della Home, che e' roba di
   * un altro modulo. Ad ascoltarlo pero' e' questa sezione, perche' e' lei che
   * possiede il cruscotto: il widget disegna la porta, non la apre. */
  doc.addEventListener("click", (event) => {
    if (!event.target?.closest?.("[data-dm-apri-cruscotto]")) return;
    /* Il cruscotto adesso e' una pagina: si va li', invece di aprire una
     * finestra sopra la Home. Il tocco sulla voce fa gia' tutto — cambia
     * pagina, rilegge la coda, ridisegna — e rifarlo qui vorrebbe dire due
     * strade da tenere uguali. */
    doc.querySelector(`.tab[data-tab="${CRUSCOTTO_TAB}"]`)?.click();
  });
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
  root.DashboardModernSegnalazioni = Object.freeze({
    apri,
    chiudi,
    // Serve al generatore delle anteprime: semina lo stato, poi chiede la pagina.
    sistema: sistemaIlCruscotto,
  });
  return state;
}

/** Seme per le prove: dimentica l'installazione e la finestra. */
export function uninstallSegnalazioniSection() {
  fermaAttesa();
  fermaBattito();
  state.auth = null;
  doc?.getElementById?.("dm-tkt-modal")?.remove();
  doc?.getElementById?.("dm-tkt-card")?.remove();
  state.installed = false;
  state.tickets = [];
  state.queue = null;
  state.tab = "nuova";
}

installSegnalazioniSection();
