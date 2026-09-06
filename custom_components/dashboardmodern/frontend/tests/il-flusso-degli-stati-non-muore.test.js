/* Il flusso degli stati non muore.
 *
 * Dal campo (screenshot del 6/9, 12:27, dal telefono): Home aperta, pallino
 * verde, meteo «--», tessere a zero. Il broker chiedeva un'istantanea intera
 * della casa con dodici secondi di tempo, dopo il guscio che ne aveva gia'
 * chiesta una; sul telefono scadeva, e con lei moriva la sottoscrizione che
 * veniva dopo — e nessuno riprovava. Qui: la sottoscrizione parte prima,
 * l'istantanea si chiede solo a chi la vuole, e il flusso si riprende da solo.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  HomeAssistantBroker,
  RIPRESA_DEL_FLUSSO_MS,
  TEMPO_PER_L_ISTANTANEA,
} from "../src/core/period-service.js";

/* Una presa finta: risponde alle sottoscrizioni, e a `get_states` come le
 * si dice. */
function presaFinta(broker, { stati = [], istantanea = "subito" } = {}) {
  const spedite = [];
  const socket = {
    readyState: 1,
    send(raw) {
      const m = JSON.parse(raw);
      spedite.push(m);
      const rispondi = (result) =>
        broker.handleMessage(
          JSON.stringify({ type: "result", id: m.id, success: true, result }),
          () => {},
          () => {},
        );
      if (m.type === "subscribe_events") queueMicrotask(() => rispondi(null));
      if (m.type === "get_states") {
        if (istantanea === "mai") return;
        queueMicrotask(() => rispondi(stati));
      }
    },
  };
  broker.connect = async () => {
    broker.socket = socket;
    broker.authenticated = true;
    return socket;
  };
  return { socket, spedite };
}

function conRegistriPuliti(fn) {
  const prima = { STATES: globalThis.STATES, _RAW_STATES: globalThis._RAW_STATES };
  globalThis.STATES = {};
  globalThis._RAW_STATES = {};
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      globalThis.STATES = prima.STATES;
      globalThis._RAW_STATES = prima._RAW_STATES;
    });
}

test("la sottoscrizione parte prima dell'istantanea, e un'istantanea che non arriva non la uccide", () =>
  conRegistriPuliti(async () => {
    const broker = new HomeAssistantBroker({ timeout: 20 });
    const { spedite } = presaFinta(broker, { istantanea: "mai" });
    await assert.rejects(broker.startStateFeed(), /timeout/);
    assert.deepEqual(
      spedite.map((m) => m.type),
      ["subscribe_events", "get_states"],
    );
    /* La sottoscrizione e' viva: un evento arriva nei registri. */
    assert.ok(broker.subscription > 0);
    broker.handleMessage(
      JSON.stringify({
        type: "event",
        id: broker.subscription,
        event: { data: { new_state: { entity_id: "light.sala", state: "on", attributes: {} } } },
      }),
      () => {},
      () => {},
    );
    assert.equal(globalThis.STATES["light.sala"].state, "on");
  }));

test("a chi ha gia' un guscio che porta gli stati non si chiede un'altra istantanea", () =>
  conRegistriPuliti(async () => {
    const broker = new HomeAssistantBroker({ timeout: 50 });
    const { spedite } = presaFinta(broker);
    assert.equal(await broker.startStateFeed({ snapshot: false }), true);
    assert.deepEqual(
      spedite.map((m) => m.type),
      ["subscribe_events"],
    );
    assert.ok(broker.subscription > 0);
    /* E la seconda volta non si riabbona. */
    assert.equal(await broker.startStateFeed({ snapshot: false }), true);
    assert.equal(spedite.length, 1);
  }));

test("l'istantanea ha il suo tempo, largo, e riempie i registri senza un evento per stato", () =>
  conRegistriPuliti(async () => {
    const broker = new HomeAssistantBroker({ timeout: 50 });
    presaFinta(broker, {
      stati: [
        { entity_id: "sensor.a", state: "1", attributes: {} },
        { entity_id: "sensor.b", state: "2", attributes: {} },
      ],
    });
    const chieste = [];
    const originale = broker.cachedRequest.bind(broker);
    broker.cachedRequest = (payload, chiave, eta, tempo) => {
      chieste.push([payload.type, tempo]);
      return originale(payload, chiave, eta, tempo);
    };
    const eventi = [];
    const dispatch = globalThis.dispatchEvent;
    globalThis.dispatchEvent = (event) => {
      eventi.push(event);
      return true;
    };
    try {
      await broker.startStateFeed();
    } finally {
      globalThis.dispatchEvent = dispatch;
    }
    assert.deepEqual(chieste, [["get_states", TEMPO_PER_L_ISTANTANEA]]);
    assert.ok(TEMPO_PER_L_ISTANTANEA >= 60_000);
    assert.equal(globalThis.STATES["sensor.a"].state, "1");
    assert.equal(globalThis._RAW_STATES["sensor.b"].state, "2");
    assert.equal(eventi.length, 0);
  }));

test("il flusso si riprende da solo: riprova finche' non riesce, e riparte dopo una caduta", () =>
  conRegistriPuliti(async () => {
    const broker = new HomeAssistantBroker({ timeout: 20, ripresaDelFlussoMs: 5 });
    const { spedite, socket } = presaFinta(broker);
    /* Le prime due volte la presa non c'e'. */
    let mancate = 0;
    const connetti = broker.connect;
    broker.connect = async () => {
      if (mancate < 2) {
        mancate += 1;
        throw new Error("Home Assistant connection unavailable");
      }
      return connetti();
    };
    let pronti = 0;
    const errori = [];
    broker.keepStateFeedAlive({
      snapshot: false,
      onReady: () => {
        pronti += 1;
      },
      onError: (error) => errori.push(String(error?.message)),
    });
    await new Promise((r) => setTimeout(r, 80));
    assert.equal(errori.length, 2);
    assert.equal(pronti, 1);
    assert.equal(spedite.filter((m) => m.type === "subscribe_events").length, 1);
    const primaSottoscrizione = broker.subscription;
    assert.ok(primaSottoscrizione > 0);

    /* La presa cade: il broker si azzera e si riabbona sulla prossima. */
    socket.readyState = 3;
    broker.reset();
    assert.equal(broker.subscription, 0);
    await new Promise((r) => setTimeout(r, 40));
    assert.equal(pronti, 2);
    assert.equal(spedite.filter((m) => m.type === "subscribe_events").length, 2);
    assert.ok(broker.subscription > primaSottoscrizione);
    assert.ok(RIPRESA_DEL_FLUSSO_MS >= 1000);
  }));
