/* Il ponte segue la connessione di casa.
 *
 * Il ponte diceva `auth_ok` appena costruito e non chiudeva mai: pallino verde
 * con Home Assistant scollegato, e al ritorno del telefono dal sonno gli stati
 * di prima, perche' nessuno dava al guscio una ragione per richiederli. Qui le
 * prese cadono quando il pannello perde la connessione, e una presa costruita
 * senza connessione si apre quando torna.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createBridgeSocket } from "../src/legacy/bridge-socket.js";

function connessioneFinta({ connected = true } = {}) {
  const ascolti = new Map();
  const chiuse = [];
  return {
    connected,
    ascolti,
    chiuse,
    addEventListener(tipo, fn) {
      ascolti.set(tipo, fn);
    },
    emetti(tipo) {
      ascolti.get(tipo)?.();
    },
    async sendMessagePromise(payload) {
      return { eco: payload.type };
    },
    async subscribeEvents(callback, eventType) {
      const chiudi = () => chiuse.push(eventType);
      return chiudi;
    },
  };
}

function presa(BridgeSocket) {
  const socket = new BridgeSocket();
  const messaggi = [];
  const eventi = { aperta: 0, chiusa: null };
  socket.onmessage = (e) => messaggi.push(JSON.parse(e.data));
  socket.onopen = () => {
    eventi.aperta += 1;
  };
  socket.onclose = (e) => {
    eventi.chiusa = e;
  };
  return { socket, messaggi, eventi };
}

const unGiro = () => new Promise((r) => setTimeout(r, 0));

test("con la connessione su la presa si apre subito, come prima", async () => {
  const connection = connessioneFinta();
  const { socket, messaggi, eventi } = presa(createBridgeSocket({ connection }));
  await unGiro();
  assert.equal(socket.readyState, 1);
  assert.equal(eventi.aperta, 1);
  assert.deepEqual(messaggi, [{ type: "auth_ok" }]);
});

test("senza connessione la presa aspetta, e si apre quando il pannello e' pronto", async () => {
  const connection = connessioneFinta({ connected: false });
  const { socket, messaggi, eventi } = presa(createBridgeSocket({ connection }));
  await unGiro();
  assert.equal(socket.readyState, 0);
  assert.equal(eventi.aperta, 0);
  assert.deepEqual(messaggi, []);
  connection.connected = true;
  connection.emetti("ready");
  assert.equal(socket.readyState, 1);
  assert.equal(eventi.aperta, 1);
  assert.deepEqual(messaggi, [{ type: "auth_ok" }]);
});

test("quando la connessione cade la presa cade con lei, e lascia le sottoscrizioni", async () => {
  const connection = connessioneFinta();
  const { socket, eventi } = presa(createBridgeSocket({ connection }));
  await unGiro();
  await socket.send(
    JSON.stringify({ id: 7, type: "subscribe_events", event_type: "state_changed" }),
  );
  connection.connected = false;
  connection.emetti("disconnected");
  assert.equal(socket.readyState, 3);
  assert.equal(eventi.chiusa?.code, 1006);
  assert.deepEqual(connection.chiuse, ["state_changed"]);
  /* Tornata la linea, la presa caduta resta caduta: e' il guscio che ne apre
   * una nuova, come farebbe con una presa vera. */
  connection.connected = true;
  connection.emetti("ready");
  assert.equal(socket.readyState, 3);
  assert.equal(eventi.aperta, 1);
});

test("una connessione senza eventi — le prove, i ponti finti — funziona come prima", async () => {
  const connection = {
    sendMessagePromise: async () => null,
    subscribeEvents: async () => () => {},
  };
  const { socket, messaggi } = presa(createBridgeSocket({ connection }));
  await unGiro();
  assert.equal(socket.readyState, 1);
  assert.deepEqual(messaggi, [{ type: "auth_ok" }]);
});
