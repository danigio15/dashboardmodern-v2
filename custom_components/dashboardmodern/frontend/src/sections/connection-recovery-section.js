/* Rientrare nell'app non deve lasciare la plancia a "CONNECTING…".
 *
 * Su iPhone il sistema butta via la pagina dell'app quando passi ad altro: al
 * rientro il pannello di Home Assistant la ricostruisce da zero. Il runtime
 * apre la presa verso Home Assistant una volta sola, all'avvio, e se
 * quell'unico tentativo non va a buon fine non ne prova altri:
 *
 *     try { ws = new WebSocket(...); } catch(e) { return; }
 *
 * Quel `return` e' un vicolo cieco. Sulla pagina appena ricostruita il ponte
 * verso il frontend ospite puo' non essere ancora pronto, il costruttore della
 * presa salta, e la plancia resta con la scritta che sta nel documento appena
 * aperto — "CONNECTING…" — con i gradi a "--" e i riquadri vuoti. Chiudere e
 * riaprire l'app la sistema, perche' e' un avvio nuovo in cui il ponte fa in
 * tempo: e' esattamente cio' che raccontava chi l'ha segnalata.
 *
 * Qui non si apre nessuna presa: si richiama `connect()`, quello del runtime,
 * quando la plancia non e' connessa — al rientro dall'altra app, al ritorno
 * della rete, e intanto a intervalli che si allargano. Da connessi non resta
 * acceso niente.
 */
import {
  doc,
  english,
  lexicalGlobal,
  root,
  scriviTestoSeCambia,
  t,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_CONNECTION_RECOVERY__";
const state = (root[KEY] ||= {
  installed: false,
  listeners: false,
  timer: 0,
  attempts: 0,
  lastTry: 0,
  /* Il timer del guscio che questa sezione ha spento, contato. */
  legacyTimersCancelled: 0,
});

/** Prima riprova, e il tetto oltre il quale l'attesa non cresce piu'. */
const FIRST_DELAY = 2000;
const MAX_DELAY = 30000;
/** Due tentativi non si accavallano mai piu' stretti di cosi'. */
export const MIN_GAP_MS = 4000;
/** Una presa che sta ancora aprendosi dopo tutto questo e' una presa ferma. */
export const STALE_CONNECTING_MS = 8000;
/** L'attesa fissa con cui il runtime richiamava connect() dopo una chiusura. */
export const LEGACY_RECONNECT_DELAY_MS = 5000;

function legacyConnect() {
  const candidate = root.connect ?? lexicalGlobal("connect");
  return typeof candidate === "function" ? candidate : null;
}

function socketConstant(name, fallback) {
  const value = root.WebSocket?.[name];
  return typeof value === "number" ? value : fallback;
}

/* Un padrone solo per la riconnessione.
 *
 * Il runtime, alla chiusura della presa, arma `setTimeout(connect, 5000)`;
 * e `connect()` apre una presa nuova senza chiudere la vecchia. Con questa
 * sezione che riprova per conto suo — deve, perche' il primo tentativo del
 * runtime puo' saltare senza nessuna chiusura da cui ripartire — dopo una
 * caduta si arrivava a due giri che chiamavano connect(): due prese aperte in
 * parallelo, due sottoscrizioni agli stati, e ognuna che alla sua chiusura
 * ne riarmava un'altra.
 *
 * Qui il padrone e' questa sezione, e il timer del runtime non nasce: la
 * chiusura della presa passa di qui, e il `setTimeout` da cinque secondi con
 * dentro `connect` viene lasciato cadere prima di essere armato. Al suo
 * posto si arma la scala di questa sezione (2, 4, 8… 30 s, e subito al
 * rientro). E `connect()` non apre mai una presa sopra una viva: se quella
 * che c'e' e' aperta non fa niente; se sta ancora aprendosi da poco la
 * lascia finire; se e' ferma la chiude prima di aprirne un'altra. Una presa
 * sostituita che si chiude non dice piu' niente: il pallino e i gestori in
 * attesa sono della presa nuova. */
function adoptSocket(socket) {
  if (!socket || typeof socket !== "object" || socket.__dmRecoveryOwned) return false;
  socket.__dmRecoveryOwned = true;
  socket.__dmOpenedAt = Date.now();
  const legacyClose = socket.onclose;
  if (typeof legacyClose !== "function") return false;
  socket.onclose = function ownedClose(event) {
    /* Una presa che non e' piu' quella corrente e' stata sostituita da
     * connect(): la sua chiusura non riguarda nessuno. */
    if (socket.__dmSuperseded || (lexicalGlobal("ws") ?? root.ws) !== socket) return undefined;
    const originalSetTimeout = root.setTimeout;
    const record = (root.__DASHBOARDMODERN_LEGACY_RECONNECT__ ||= {
      timer: 0,
      callback: null,
      args: [],
      captured: false,
      cancelled: false,
    });
    function droppingSetTimeout(handler, delay, ...rest) {
      if (Number(delay) === LEGACY_RECONNECT_DELAY_MS && handler === root.connect) {
        record.captured = true;
        record.cancelled = true;
        record.timer = 0;
        record.callback = null;
        record.args = [];
        state.legacyTimersCancelled += 1;
        return 0;
      }
      return originalSetTimeout.call(root, handler, delay, ...rest);
    }
    root.setTimeout = droppingSetTimeout;
    try {
      return legacyClose.call(this, event);
    } finally {
      if (root.setTimeout === droppingSetTimeout) root.setTimeout = originalSetTimeout;
      watch(FIRST_DELAY);
    }
  };
  return true;
}

export function installConnectOwner() {
  const current = root.connect;
  if (typeof current !== "function" || current.__dmConnectionRecovery) return false;
  function connectOwned(...args) {
    const previous = lexicalGlobal("ws") ?? root.ws;
    if (previous && typeof previous === "object") {
      const readyState = previous.readyState;
      if (readyState === socketConstant("OPEN", 1)) return undefined;
      const fresh = Date.now() - (Number(previous.__dmOpenedAt) || 0) < STALE_CONNECTING_MS;
      if (readyState === socketConstant("CONNECTING", 0) && fresh) return undefined;
      if (readyState !== socketConstant("CLOSED", 3)) {
        previous.__dmSuperseded = true;
        try {
          previous.close();
        } catch (_error) {}
      }
    }
    const result = current.apply(this, args);
    adoptSocket(lexicalGlobal("ws") ?? root.ws);
    return result;
  }
  Object.assign(connectOwned, current);
  connectOwned.__dmConnectionRecovery = true;
  connectOwned.__dmPrevious = current;
  root.connect = connectOwned;
  /* La presa che il runtime ha aperto all'avvio, prima che questa sezione
   * esistesse: anche la sua chiusura passa di qui. */
  adoptSocket(lexicalGlobal("ws") ?? root.ws);
  return true;
}

/* Connessa vuol dire autenticata, non "la presa esiste".
 *
 * Il pallino prende la classe quando Home Assistant risponde `auth_ok` e la
 * perde alla chiusura: e' l'unico segnale che dice se i dati arrivano davvero,
 * ed e' scritto dal runtime, non da qui. */
export function connectionUp(scope = doc) {
  return Boolean(scope?.getElementById?.("live-dot")?.classList?.contains("connected"));
}

/** Lo stato della presa del runtime, `null` quando non ce n'e' una. */
export function socketReadyState() {
  const value = lexicalGlobal("ws")?.readyState;
  return typeof value === "number" ? value : null;
}

/* Se valga la pena richiamare connect(), e perche'.
 *
 * Separata dal resto perche' e' l'unico punto dove si decide qualcosa: il
 * contorno legge il documento e guarda l'orologio, questa no. */
export function reconnectDecision({ up, readyState, sinceLastTry, connecting = 0, eager = false }) {
  if (up) return { retry: false, reason: "connessa" };
  if (readyState === connecting && sinceLastTry < STALE_CONNECTING_MS) {
    return { retry: false, reason: "sta gia' provando" };
  }
  /* Chi ha appena riaperto l'app non aspetta il turno.
   *
   * La pausa fra due tentativi serve a non impilare prese mentre nessuno
   * guarda. Al rientro qualcuno sta guardando lo schermo adesso: la prova si fa
   * subito, e l'unico freno che resta e' quello che conta davvero — non
   * aprirne una seconda sopra una che si sta ancora aprendo. */
  if (!eager && sinceLastTry < MIN_GAP_MS) return { retry: false, reason: "troppo presto" };
  return { retry: true, reason: readyState == null ? "nessuna presa" : "presa ferma" };
}

/* La scritta dice cosa sta succedendo.
 *
 * Il documento nasce con "CONNECTING…" e nessuno la riscrive finche' la presa
 * non si apre: chi guarda non ha modo di distinguere "sto provando adesso" da
 * "sono fermo qui da dieci minuti". Da connessi non si tocca niente: quella
 * scritta appartiene al runtime. */
function announceRetry() {
  const label = doc?.getElementById("conn-text");
  if (!label || connectionUp()) return false;
  const text = t("Riconnessione…", "Reconnecting…");
  scriviTestoSeCambia(label, text);
  return true;
}

export function attemptReconnect({ force = false, eager = false } = {}) {
  const decision = reconnectDecision({
    up: connectionUp(),
    readyState: socketReadyState(),
    sinceLastTry: Date.now() - state.lastTry,
    connecting: root.WebSocket?.CONNECTING ?? 0,
    eager,
  });
  if (!force && !decision.retry) return false;
  const connect = legacyConnect();
  if (!connect) return false;
  state.lastTry = Date.now();
  state.attempts += 1;
  announceRetry();
  try {
    connect();
  } catch (_error) {
    return false;
  }
  return true;
}

/* Un solo timer, e solo mentre serve. */
function watch(delay = FIRST_DELAY) {
  if (!doc || state.timer) return false;
  state.timer = root.setTimeout?.(() => {
    state.timer = 0;
    if (connectionUp()) {
      state.attempts = 0;
      return;
    }
    attemptReconnect();
    watch(Math.min(MAX_DELAY, Math.max(FIRST_DELAY, delay * 2)));
  }, Math.max(0, delay));
  return Boolean(state.timer);
}

/* Il rientro azzera l'attesa: chi ha appena riaperto l'app la sta guardando. */
function resume() {
  if (connectionUp()) return false;
  state.attempts = 0;
  attemptReconnect({ eager: true });
  watch(FIRST_DELAY);
  return true;
}

export function installConnectionRecoverySection() {
  if (!doc) return false;
  installConnectOwner();
  if (!state.listeners) {
    state.listeners = true;
    doc.addEventListener("visibilitychange", () => {
      if (doc.visibilityState === "visible") resume();
    });
    for (const event of ["pageshow", "focus", "online", "dashboardmodern:legacy-ready"]) {
      root.addEventListener?.(event, resume);
    }
    /* Il guscio dichiara le sue funzioni anche dopo di noi, nella plancia
     * ospitata: il padrone di connect() si prende appena c'e'. */
    root.addEventListener?.("dashboardmodern:legacy-ready", installConnectOwner);
  }
  watch(FIRST_DELAY);
  state.installed = true;
  return true;
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", installConnectionRecoverySection, { once: true });
} else if (doc) {
  installConnectionRecoverySection();
}
