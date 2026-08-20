import assert from "node:assert/strict";
import test from "node:test";

import {
  CONTACT_KEYS,
  contactEntity,
  shutterWindowModel,
  windowOpenFromState,
} from "../src/core/shutter-window.js";

test("un contatto porta e finestra sta a on quando e' aperto", () => {
  // Al contrario di quasi tutto il resto in Home Assistant, ed e' il motivo per
  // cui questa lettura sta scritta una volta sola.
  for (const aperto of ["on", "open", "Aperto", "APERTA", "true", "detected"]) {
    assert.equal(windowOpenFromState(aperto), true, aperto);
  }
  for (const chiuso of ["off", "closed", "Chiusa", "false", "clear"]) {
    assert.equal(windowOpenFromState(chiuso), false, chiuso);
  }
});

test("un sensore che non risponde non e' una finestra chiusa", () => {
  // "unavailable" vuol dire che non lo sappiamo. Chi disegna decidera' cosa
  // mostrare, ma non deve poterlo confondere con un "chiuso" misurato.
  for (const muto of ["unavailable", "unknown", "", null, undefined, "boh"]) {
    assert.equal(windowOpenFromState(muto), null, String(muto));
  }
});

test("il contatto si legge dal nome che la configurazione ha usato", () => {
  assert.equal(contactEntity({ contact: "binary_sensor.a" }), "binary_sensor.a");
  // Chi ha scritto la configurazione a mano puo' aver usato uno degli altri.
  assert.equal(contactEntity({ window_entity: "binary_sensor.b" }), "binary_sensor.b");
  assert.equal(contactEntity({ opening_entity: "binary_sensor.c" }), "binary_sensor.c");
  // L'ordine e' quello dichiarato: vince il primo che c'e'.
  assert.equal(
    contactEntity({ opening_entity: "binary_sensor.c", contact: "binary_sensor.a" }),
    "binary_sensor.a",
  );
  assert.equal(contactEntity({}), "");
  assert.equal(contactEntity({ contact: "   " }), "");
  assert.ok(CONTACT_KEYS.includes("contact"));
});

test("una tapparella senza contatto non ha una finestra da mostrare", () => {
  const senza = shutterWindowModel({ entity: "cover.a" }, {});
  assert.deepEqual(senza, { entity: "", open: null, configured: false });
});

test("il contatto passa per la risoluzione delle entita'", () => {
  // La configurazione puo' puntare a un riferimento della plancia invece che a
  // un'entita' vera: chi lo traduce e' il runtime, e la lettura lo interpella.
  const states = { "binary_sensor.vero": { state: "on" } };
  const model = shutterWindowModel({ contact: "dm.finestra" }, states, (value) =>
    value === "dm.finestra" ? "binary_sensor.vero" : value,
  );
  assert.deepEqual(model, { entity: "binary_sensor.vero", open: true, configured: true });

  // Se la traduzione esplode, resta il riferimento cosi' com'e'.
  const rotto = shutterWindowModel({ contact: "binary_sensor.vero" }, states, () => {
    throw new Error("no");
  });
  assert.equal(rotto.open, true);
});

test("un contatto configurato ma spento dice chiuso, non nulla", () => {
  const states = { "binary_sensor.a": { state: "off" } };
  assert.deepEqual(shutterWindowModel({ contact: "binary_sensor.a" }, states), {
    entity: "binary_sensor.a",
    open: false,
    configured: true,
  });
  // Configurato ma assente da Home Assistant: non lo sappiamo.
  assert.deepEqual(shutterWindowModel({ contact: "binary_sensor.mai" }, states), {
    entity: "binary_sensor.mai",
    open: null,
    configured: true,
  });
});

test("il contatto sopravvive alla normalizzazione della tapparella", async () => {
  // Il modello canonico tiene solo i campi che conosce, ed e' quello che
  // impedisce a una configurazione scritta a mano di portarsi dietro
  // spazzatura. Ma vuol dire anche che un campo nuovo, se non lo si dichiara,
  // sparisce alla prima normalizzazione: il contatto spariva appena si apriva
  // l'editor, e la finestra restava sempre chiusa.
  const { normalizeDevice } = await import("../src/core/device-model.js");
  const tapparella = normalizeDevice(
    { id: "c1", name: "Camera", entity: "cover.c1", contact: "binary_sensor.finestra" },
    "covers",
  );
  assert.equal(tapparella.contact, "binary_sensor.finestra");
  assert.equal(contactEntity(tapparella), "binary_sensor.finestra");

  // Una tapparella senza contatto non guadagna un campo vuoto.
  const senza = normalizeDevice({ id: "c2", entity: "cover.c2" }, "covers");
  assert.equal("contact" in senza, false);

  // E il campo resta delle tapparelle: un elettrodomestico non lo prende.
  const appliance = normalizeDevice({ id: "a1", contact: "binary_sensor.x" }, "appliances");
  assert.equal("contact" in appliance, false);
});
