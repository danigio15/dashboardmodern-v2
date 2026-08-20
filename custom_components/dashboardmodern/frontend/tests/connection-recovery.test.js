import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  MIN_GAP_MS,
  STALE_CONNECTING_MS,
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
