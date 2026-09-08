import assert from "node:assert/strict";
import test from "node:test";

import {
  COVER_KINDS,
  coverClosedPercent,
  coverIsSideways,
  coverKind,
  coverKindLabel,
  declaredCoverKind,
} from "../src/core/cover-kind.js";
import { normalizeDevice } from "../src/core/device-model.js";

test("chi non sceglie niente ha quello che dice Home Assistant", () => {
  assert.equal(coverKind({}, { attributes: { device_class: "curtain" } }), "tenda");
  assert.equal(coverKind({}, { attributes: { device_class: "awning" } }), "tenda_sole");
  assert.equal(coverKind({}, { attributes: { device_class: "shutter" } }), "tapparella");
});

test("solo cio' che si scosta di lato e' una tenda (#396)", () => {
  /* «5 tapparelle configurate allo stesso modo, 2 vengono mostrate come tende
   * sia nell'animazione che nel titolo»: erano quelle che la loro integrazione
   * dichiara `blind` o `shade`. Una veneziana e una tenda a rullo scendono
   * dall'alto — non si aprono al centro — e disegnarle di lato era mostrare un
   * movimento che in casa non succede. */
  for (const deviceClass of ["blind", "shade"]) {
    assert.equal(coverKind({}, { attributes: { device_class: deviceClass } }), "tapparella");
    assert.equal(coverIsSideways(coverKind({}, { attributes: { device_class: deviceClass } })), false);
  }
  /* `curtain` resta l'unica che si scosta davvero. */
  assert.equal(coverIsSideways(coverKind({}, { attributes: { device_class: "curtain" } })), true);
  /* E chi la vuole tenda lo dice, con la sua casella: la scelta vince sempre. */
  assert.equal(coverKind({ kind: "tenda" }, { attributes: { device_class: "blind" } }), "tenda");
});

test("cio' che non e' ne' tapparella ne' tenda resta disegnato come prima", () => {
  // Una porta di garage o un cancello non hanno un disegno loro: la finestra
  // con la tapparella e' il meno sbagliato, e cambiarlo sarebbe una sorpresa.
  for (const deviceClass of ["garage", "gate", "door", "window", "damper", ""])
    assert.equal(coverKind({}, { attributes: { device_class: deviceClass } }), "tapparella");
  assert.equal(coverKind({}, null), "tapparella");
});

test("la scelta dell'utente vince su quello che dice Home Assistant", () => {
  assert.equal(coverKind({ kind: "tenda" }, { attributes: { device_class: "shutter" } }), "tenda");
  assert.equal(
    coverKind({ kind: "tapparella" }, { attributes: { device_class: "curtain" } }),
    "tapparella",
  );
});

test("una scelta che non sappiamo disegnare non conta come scelta", () => {
  assert.equal(declaredCoverKind({ kind: "veneziana" }), "");
  assert.equal(coverKind({ kind: "veneziana" }, { attributes: { device_class: "curtain" } }), "tenda");
});

test("solo la tenda si scosta di lato", () => {
  assert.equal(coverIsSideways("tenda"), true);
  assert.equal(coverIsSideways("tapparella"), false);
  assert.equal(coverIsSideways("tenda_sole"), false);
});

test("quanto e' coperta la finestra, sempre fra zero e cento", () => {
  assert.equal(coverClosedPercent(100), 0);
  assert.equal(coverClosedPercent(0), 100);
  assert.equal(coverClosedPercent(30), 70);
  assert.equal(coverClosedPercent(140), 0);
  assert.equal(coverClosedPercent(-5), 100);
  assert.equal(coverClosedPercent("boh"), 0);
});

test("ogni tipo ha un nome, nelle due lingue", () => {
  for (const kind of COVER_KINDS) {
    assert.ok(coverKindLabel(kind).length > 0);
    assert.ok(coverKindLabel(kind, true).length > 0);
  }
  assert.equal(coverKindLabel("tenda"), "Tenda");
  assert.equal(coverKindLabel("tenda", true), "Curtain");
});

test("il tipo scelto sopravvive alla normalizzazione", () => {
  // Il modello tiene solo i campi che conosce: un campo non dichiarato sparisce
  // alla prima apertura dell'editor, come era gia' successo al contatto.
  const device = normalizeDevice({ entity: "cover.salotto", name: "Salotto", kind: "tenda" }, "covers");
  assert.equal(device.kind, "tenda");
  const senza = normalizeDevice({ entity: "cover.salotto", name: "Salotto" }, "covers");
  assert.equal("kind" in senza, false);
});
