/* «Token is invalid» solo dalla plancia, e la tendina e' di evcc.
 *
 * Dal telefono: si sceglie 90% nella tendina del target e Home Assistant
 * risponde «Leapmotor remote control result failed: Token is invalid». Dalla
 * stessa casa, cambiando il limite altrove, funziona. E l'entita' che governa
 * quella carica non e' del costruttore: e' `number.evcc_lektrico_limit_soc`.
 *
 * Il limite lo portano in due, e il collegamento di evcc lo sa gia': un
 * comando scalza una lettura, e la casella era finita giusta. Poi pero'
 * mettere in uso la vettura riversa il profilo dell'auto dentro le mappature
 * globali, e il limite dell'auto — quello che vive nel cloud del costruttore —
 * si riprendeva la casella. La tendina mostrava le voci giuste e mandava
 * l'ordine dall'altra parte del mondo, dove un token scaduto lo rifiuta.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { eDellaWallbox, eTargetDiCasa } from "../src/core/wallbox-device-binding.js";

test("un target che si comanda e' di casa, e nessun cambio d'auto se lo porta via", () => {
  assert.equal(eTargetDiCasa("dm.ev_target_soc", "number.evcc_lektrico_limit_soc"), true);
  assert.equal(eTargetDiCasa("dm.ev_target_soc", "select.evcc_limit_soc"), true);
  assert.equal(eTargetDiCasa("dm.ev_target_soc", "input_number.limite"), true);
});

test("un target che si legge soltanto resta dell'auto", () => {
  /* Senza evcc il limite e' quello della vettura, e cambiando macchina deve
   * cambiare con lei: e' un dato del profilo, non della casa. */
  assert.equal(eTargetDiCasa("dm.ev_target_soc", "sensor.b10_charge_limit"), false);
  assert.equal(eTargetDiCasa("dm.ev_target_soc", ""), false);
  assert.equal(eTargetDiCasa("dm.ev_target_soc", undefined), false);
});

test("la regola vale per il target e per nessun'altra casella", () => {
  /* La batteria dell'auto e' dell'auto anche quando e' un `number`: qui non si
   * sta dicendo «i comandi sono di casa», si sta dicendo che IL LIMITE che
   * comanda la carica e' uno solo per la presa, non uno per vettura. */
  assert.equal(eTargetDiCasa("dm.ev_batteria_auto", "number.qualcosa"), false);
  assert.equal(eTargetDiCasa("dm.ev_autonomia", "number.qualcosa"), false);
});

test("le caselle della colonnina restano quelle di prima", () => {
  /* Il target NON entra nell'elenco della colonnina: li' dentro ci sono le
   * caselle che sono sempre e comunque della casa, e il target lo e' soltanto
   * quando porta un comando. */
  assert.equal(eDellaWallbox("dm.ev_target_soc"), false);
  assert.equal(eDellaWallbox("dm.ev_potenza_wallbox"), true);
  assert.equal(eDellaWallbox("dm.ev_cavo_collegato"), true);
});
