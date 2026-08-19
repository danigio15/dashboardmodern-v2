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
import { doc, english, lexicalGlobal, root } from "./shared.js";

const KEY = "__DASHBOARDMODERN_CONNECTION_RECOVERY__";
const state = (root[KEY] ||= { installed: false, listeners: false, timer: 0, attempts: 0, lastTry: 0 });

/** Prima riprova, e il tetto oltre il quale l'attesa non cresce piu'. */
const FIRST_DELAY = 2000;
const MAX_DELAY = 30000;
/** Due tentativi non si accavallano mai piu' stretti di cosi'. */
export const MIN_GAP_MS = 4000;
/** Una presa che sta ancora aprendosi dopo tutto questo e' una presa ferma. */
export const STALE_CONNECTING_MS = 8000;

function legacyConnect() {
  const candidate = root.connect ?? lexicalGlobal("connect");
  return typeof candidate === "function" ? candidate : null;
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
export function reconnectDecision({ up, readyState, sinceLastTry, connecting = 0 }) {
  if (up) return { retry: false, reason: "connessa" };
  if (readyState === connecting && sinceLastTry < STALE_CONNECTING_MS) {
    return { retry: false, reason: "sta gia' provando" };
  }
  if (sinceLastTry < MIN_GAP_MS) return { retry: false, reason: "troppo presto" };
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
  const text = english() ? "Reconnecting…" : "Riconnessione…";
  if (label.textContent !== text) label.textContent = text;
  return true;
}

export function attemptReconnect({ force = false } = {}) {
  const decision = reconnectDecision({
    up: connectionUp(),
    readyState: socketReadyState(),
    sinceLastTry: Date.now() - state.lastTry,
    connecting: root.WebSocket?.CONNECTING ?? 0,
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
  attemptReconnect();
  watch(FIRST_DELAY);
  return true;
}

export function installConnectionRecoverySection() {
  if (!doc) return false;
  if (!state.listeners) {
    state.listeners = true;
    doc.addEventListener("visibilitychange", () => {
      if (doc.visibilityState === "visible") resume();
    });
    for (const event of ["pageshow", "focus", "online", "dashboardmodern:legacy-ready"]) {
      root.addEventListener?.(event, resume);
    }
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
