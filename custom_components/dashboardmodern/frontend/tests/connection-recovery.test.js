import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  LEGACY_RECONNECT_DELAY_MS,
  MIN_GAP_MS,
  STALE_CONNECTING_MS,
  installConnectOwner,
  reconnectDecision,
} from "../src/sections/connection-recovery-section.js";

const CONNECTING = 0;
const OPEN = 1;
const CLOSED = 3;

test("a connected dashboard is left alone", () => {
  assert.deepEqual(reconnectDecision({ up: true, readyState: OPEN, sinceLastTry: 10 ** 6 }), {
    retry: false,
    reason: "connessa",
  });
  // Even with no socket at all: the dot is the runtime's own word for "the
  // data is arriving", and it outranks anything read from the socket.
  assert.equal(
    reconnectDecision({ up: true, readyState: null, sinceLastTry: 10 ** 6 }).retry,
    false,
  );
});

test("a page rebuilt without a socket reconnects", () => {
  // This is the reported case: iOS threw the page away, the panel rebuilt it,
  // the one connect() the runtime does threw, and nothing tried again.
  const decision = reconnectDecision({ up: false, readyState: null, sinceLastTry: 10 ** 6 });
  assert.equal(decision.retry, true);
  assert.equal(decision.reason, "nessuna presa");
});

test("a socket that is still opening is given time, then given up on", () => {
  assert.equal(
    reconnectDecision({ up: false, readyState: CONNECTING, sinceLastTry: STALE_CONNECTING_MS - 1 })
      .retry,
    false,
  );
  const stale = reconnectDecision({
    up: false,
    readyState: CONNECTING,
    sinceLastTry: STALE_CONNECTING_MS + 1,
  });
  assert.equal(stale.retry, true);
  assert.equal(stale.reason, "presa ferma");
});

test("two attempts never crowd each other", () => {
  assert.equal(
    reconnectDecision({ up: false, readyState: CLOSED, sinceLastTry: MIN_GAP_MS - 1 }).retry,
    false,
  );
  assert.equal(
    reconnectDecision({ up: false, readyState: CLOSED, sinceLastTry: MIN_GAP_MS + 1 }).retry,
    true,
  );
});

test("the section opens no socket of its own and stops when connected", () => {
  const source = readFileSync(
    new URL("../src/sections/connection-recovery-section.js", import.meta.url),
    "utf8",
  );
  // It calls the runtime's connect(); it never constructs a socket, and never
  // touches the token or the URL the runtime resolves. Read past the header:
  // that comment quotes the runtime line this module exists because of.
  const body = source.slice(source.indexOf('\nimport {'));
  assert.doesNotMatch(body, /new WebSocket/);
  assert.doesNotMatch(body, /access_token|LONG_LIVED_TOKEN|api\/websocket/);
  // No standing timer once the dashboard is connected.
  assert.match(source, /if \(connectionUp\(\)\) \{\s*state\.attempts = 0;\s*return;/);
  assert.doesNotMatch(source, /setInterval/);
  // The doors a returning app actually comes through.
  for (const event of ["visibilitychange", "pageshow", "focus", "online"]) {
    assert.match(source, new RegExp(event), event);
  }
});

test("the runtime registry installs it", () => {
  const runtime = readFileSync(
    new URL("../src/sections/section-runtime.js", import.meta.url),
    "utf8",
  );
  assert.match(runtime, /connection-recovery-section\.js/);
  assert.match(runtime, /installConnectionRecoverySection\(\)/);
});

/* Un padrone solo per la riconnessione.
 *
 * Il runtime richiama connect() cinque secondi dopo ogni chiusura, e connect()
 * apre una presa nuova senza chiudere la vecchia: con questa sezione che
 * riprova per conto suo si arrivava a due prese aperte in parallelo. */
test("connect() never stacks a socket on a live one and closes a stale one first", () => {
  const veroSetTimeout = globalThis.setTimeout;
  const attese = [];
  globalThis.setTimeout = (fn, ms) => {
    attese.push({ fn, ms });
    return attese.length;
  };
  globalThis.WebSocket = { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 };
  const prese = [];
  class PresaFinta {
    constructor() {
      this.readyState = 0;
      this.chiusure = 0;
      prese.push(this);
    }
    close() {
      this.chiusure += 1;
      this.readyState = 3;
    }
  }
  let chiusureDelGuscio = 0;
  /* Come il runtime: alla chiusura arma `setTimeout(connect, 5000)`. Li'
   * `connect` e' una dichiarazione globale, quindi risolve a window.connect —
   * cioe' all'involucro; qui si scrive per esteso per la stessa ragione. */
  function connect() {
    const presa = new PresaFinta();
    globalThis.ws = presa;
    presa.onclose = () => {
      chiusureDelGuscio += 1;
      globalThis.setTimeout(globalThis.connect, 5000);
    };
  }
  globalThis.connect = connect;
  try {
    connect(); // l'avvio del guscio, prima che la sezione esista
    assert.equal(installConnectOwner(), true);
    assert.equal(globalThis.connect.__dmConnectionRecovery, true);
    assert.equal(installConnectOwner(), false, "si installa una volta sola");
    assert.equal(prese[0].__dmRecoveryOwned, true, "anche la presa dell'avvio passa di qui");

    // Sopra una presa aperta non si apre niente.
    prese[0].readyState = 1;
    globalThis.connect();
    assert.equal(prese.length, 1);
    // Una che si sta aprendo da poco si lascia finire.
    prese[0].readyState = 0;
    globalThis.connect();
    assert.equal(prese.length, 1);
    // Una ferma da troppo si chiude prima di aprirne un'altra.
    prese[0].__dmOpenedAt = Date.now() - STALE_CONNECTING_MS - 1;
    globalThis.connect();
    assert.equal(prese.length, 2);
    assert.equal(prese[0].chiusure, 1);
    assert.equal(prese[0].__dmSuperseded, true);
    assert.equal(globalThis.ws, prese[1]);

    // La chiusura della presa sostituita non dice niente al guscio.
    prese[0].onclose({ code: 1006 });
    assert.equal(chiusureDelGuscio, 0);

    // La chiusura di quella corrente passa dal guscio, ma il suo timer da
    // cinque secondi non nasce: la riconnessione ha un padrone solo.
    prese[1].readyState = 3;
    prese[1].onclose({ code: 1006 });
    assert.equal(chiusureDelGuscio, 1);
    assert.equal(
      attese.some((a) => a.ms === LEGACY_RECONNECT_DELAY_MS),
      false,
    );
    assert.equal(globalThis.__DASHBOARDMODERN_LEGACY_RECONNECT__.cancelled, true);
    assert.equal(globalThis.__DASHBOARDMODERN_CONNECTION_RECOVERY__.legacyTimersCancelled, 1);
    assert.equal(globalThis.setTimeout.name, "", "il setTimeout di prima torna al suo posto");

    // E da chiusa si riapre.
    globalThis.connect();
    assert.equal(prese.length, 3);
  } finally {
    globalThis.setTimeout = veroSetTimeout;
    delete globalThis.connect;
    delete globalThis.ws;
    delete globalThis.WebSocket;
  }
});

test("coming back to the app does not wait for the throttle", () => {
  // La pausa fra due tentativi serve a non impilare prese mentre nessuno
  // guarda. Al rientro qualcuno sta guardando adesso.
  const justTried = { up: false, readyState: CLOSED, sinceLastTry: 10 };
  assert.equal(reconnectDecision(justTried).retry, false);
  assert.equal(reconnectDecision({ ...justTried, eager: true }).retry, true);

  // Il freno che resta e' quello che conta: non una seconda presa sopra una
  // che si sta ancora aprendo.
  assert.equal(
    reconnectDecision({ up: false, readyState: CONNECTING, sinceLastTry: 10, eager: true }).retry,
    false,
  );
  // E da connessi non si tocca niente, per quanto si insista.
  assert.equal(
    reconnectDecision({ up: true, readyState: CLOSED, sinceLastTry: 10, eager: true }).retry,
    false,
  );
});
