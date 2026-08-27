/* La centrale antifurto dichiara cosa sa fare, e la plancia le crede.
 *
 * Il caso vero: Ring via ring-mqtt. Accetta Casa e Fuori, la modalita' Notte
 * non ce l'ha, e un codice non lo pubblica affatto. La plancia mostrava
 * comunque i suoi tre tasti sempre uguali — Fuori, Notte, Sblocca — e Notte
 * chiedeva il PIN per poi non fare niente, mentre lo stato ARMATO · CASA
 * accendeva il tasto Fuori.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  ALARM_FEATURES,
  alarmActiveMode,
  alarmCodeNeeded,
  alarmFeatures,
  alarmModes,
} from "../src/core/alarm-panel.js";

const modi = (stateObj) => alarmModes(stateObj).map((voce) => voce.mode);

/* Ring: casa e fuori, nessun codice. */
const RING = {
  state: "armed_home",
  attributes: { supported_features: ALARM_FEATURES.home | ALARM_FEATURES.away },
};

test("una centrale che non ha la modalita' notte non ne mostra il tasto", () => {
  assert.deepEqual(modi(RING), ["home", "away", "disarm"]);
  assert.ok(!modi(RING).includes("night"));
});

test("armato in casa accende il tasto Casa, non quello Fuori", () => {
  assert.equal(alarmActiveMode("armed_home", modi(RING)), "home");
  assert.equal(alarmActiveMode("armed_away", modi(RING)), "away");
  assert.equal(alarmActiveMode("disarmed", modi(RING)), "disarm");
});

test("se il tasto Casa non e' stato disegnato si accende l'inserimento totale", () => {
  // Una centrale che dichiara solo Fuori puo' comunque riportare armed_home:
  // meglio il tasto piu' vicino che una fila tutta spenta.
  assert.equal(alarmActiveMode("armed_home", ["away", "disarm"]), "away");
});

test("in uscita e in allarme non c'e' nessun tasto da accendere", () => {
  for (const stato of ["arming", "pending", "triggered", "unavailable", "", null])
    assert.equal(alarmActiveMode(stato, modi(RING)), "");
});

test("senza codice pubblicato il tastierino non ha niente da chiedere", () => {
  assert.equal(alarmCodeNeeded(RING, "alarm_arm_away"), false);
  assert.equal(alarmCodeNeeded(RING, "alarm_disarm"), false);
});

test("chi il codice ce l'ha se lo vede chiedere", () => {
  const conCodice = { attributes: { supported_features: 3, code_format: "number" } };
  assert.equal(alarmCodeNeeded(conCodice, "alarm_arm_away"), true);
  assert.equal(alarmCodeNeeded(conCodice, "alarm_disarm"), true);
});

test("il codice solo per disinserire e' quello che dice l'entita'", () => {
  const soloDisarmo = {
    attributes: { supported_features: 7, code_format: "number", code_arm_required: false },
  };
  assert.equal(alarmCodeNeeded(soloDisarmo, "alarm_arm_night"), false);
  assert.equal(alarmCodeNeeded(soloDisarmo, "alarm_disarm"), true);
});

test("una centrale che non dichiara niente tiene i tasti di sempre", () => {
  assert.equal(alarmFeatures({ state: "disarmed" }), null);
  assert.deepEqual(modi({ state: "disarmed" }), ["away", "night", "disarm"]);
  assert.deepEqual(modi(null), ["away", "night", "disarm"]);
});

test("una maschera completa mostra tutti gli inserimenti, in ordine", () => {
  const tutto = { attributes: { supported_features: 1 | 2 | 4 | 16 | 32 } };
  assert.deepEqual(modi(tutto), ["home", "away", "night", "vacation", "custom", "disarm"]);
});

test("il bit di scatto non e' un inserimento e non diventa un tasto", () => {
  const conScatto = { attributes: { supported_features: ALARM_FEATURES.away | ALARM_FEATURES.trigger } };
  assert.deepEqual(modi(conScatto), ["away", "disarm"]);
});

test("ogni tasto porta con se' il servizio che chiamera'", () => {
  const perModo = Object.fromEntries(alarmModes({ attributes: { supported_features: 63 } }).map((v) => [v.mode, v.service]));
  assert.deepEqual(perModo, {
    home: "alarm_arm_home",
    away: "alarm_arm_away",
    night: "alarm_arm_night",
    vacation: "alarm_arm_vacation",
    custom: "alarm_arm_custom_bypass",
    disarm: "alarm_disarm",
  });
});
