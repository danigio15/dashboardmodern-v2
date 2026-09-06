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
  /* La sottoscrizione si lascia un giro dopo: a linea caduta chiuderla puo'
   * fallire, e non deve far cadere nessuno. */
  await unGiro();
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

/* Una sottoscrizione per tipo di evento, per tutte le prese; l'istantanea
 * degli stati una volta per tutti. */
function connessioneCheConta() {
  const conn = connessioneFinta();
  conn.abbonamenti = [];
  conn.istantanee = 0;
  conn.subscribeEvents = async (callback, eventType) => {
    conn.abbonamenti.push({ callback, eventType });
    return () => conn.chiuse.push(eventType);
  };
  conn.sendMessagePromise = async (payload) => {
    if (payload.type === "get_states") {
      conn.istantanee += 1;
      return [{ entity_id: "light.sala", state: "on" }];
    }
    return { eco: payload.type };
  };
  return conn;
}

test("due prese che si abbonano allo stesso evento costano UNA sottoscrizione sul server", async () => {
  const connection = connessioneCheConta();
  const BridgeSocket = createBridgeSocket({ connection });
  const guscio = presa(BridgeSocket);
  const broker = presa(BridgeSocket);
  await unGiro();
  await guscio.socket.send(
    JSON.stringify({ id: 3, type: "subscribe_events", event_type: "state_changed" }),
  );
  await broker.socket.send(
    JSON.stringify({ id: 150006, type: "subscribe_events", event_type: "state_changed" }),
  );
  assert.equal(connection.abbonamenti.length, 1);
  /* L'evento arriva a tutte e due, ognuna col suo id. */
  connection.abbonamenti[0].callback({
    event_type: "state_changed",
    data: { entity_id: "light.sala" },
  });
  assert.deepEqual(
    guscio.messaggi.filter((m) => m.type === "event").map((m) => m.id),
    [3],
  );
  assert.deepEqual(
    broker.messaggi.filter((m) => m.type === "event").map((m) => m.id),
    [150006],
  );
  /* La prima presa che se ne va non la chiude; l'ultima si'. */
  guscio.socket.close();
  await unGiro();
  assert.deepEqual(connection.chiuse, []);
  broker.socket.close();
  await unGiro();
  assert.deepEqual(connection.chiuse, ["state_changed"]);
  /* E dopo, chi si abbona di nuovo ne apre una nuova. */
  const dopo = presa(BridgeSocket);
  await unGiro();
  await dopo.socket.send(
    JSON.stringify({ id: 9, type: "subscribe_events", event_type: "state_changed" }),
  );
  assert.equal(connection.abbonamenti.length, 2);
});

test("l'istantanea degli stati si chiede una volta per tutte le prese vicine nel tempo", async () => {
  const connection = connessioneCheConta();
  const BridgeSocket = createBridgeSocket({ connection });
  const uno = presa(BridgeSocket);
  const due = presa(BridgeSocket);
  await unGiro();
  await Promise.all([
    uno.socket.send(JSON.stringify({ id: 2, type: "get_states" })),
    due.socket.send(JSON.stringify({ id: 4, type: "get_states" })),
  ]);
  assert.equal(connection.istantanee, 1);
  assert.deepEqual(uno.messaggi.find((m) => m.id === 2).result, [
    { entity_id: "light.sala", state: "on" },
  ]);
  assert.deepEqual(due.messaggi.find((m) => m.id === 4).result, [
    { entity_id: "light.sala", state: "on" },
  ]);
});
