import assert from "node:assert/strict";
import test from "node:test";

import {
  CLIMATE_TURN_ON,
  climateIsOff,
  climatePowerCall,
  modalitaDiAccensione,
} from "../src/core/climate-power.js";

test("un termostato che ha la modalita' off si spegne mettendolo in off", () => {
  // E' il caso di Bticino MyHome e di tutte le integrazioni che non dichiarano
  // di saper fare turn_off: la chiamata cadeva nel vuoto e la zona restava
  // accesa per sempre.
  const bticino = { state: "heat", attributes: { hvac_modes: ["off", "heat"] } };
  assert.deepEqual(climatePowerCall(bticino, false), {
    service: "set_hvac_mode",
    data: { hvac_mode: "off" },
  });
});

test("chi la modalita' off non ce l'ha si spegne come si puo'", () => {
  const strano = { state: "heat", attributes: { hvac_modes: ["heat", "cool"] } };
  assert.deepEqual(climatePowerCall(strano, false), { service: "turn_off", data: {} });
  // E chi non dichiara niente: non si inventa una modalita' che non esiste.
  assert.deepEqual(climatePowerCall({ state: "heat" }, false), {
    service: "turn_off",
    data: {},
  });
});

test("riaccendere rimette la modalita' che c'era", () => {
  const stato = { state: "off", attributes: { hvac_modes: ["off", "heat", "cool"] } };
  assert.deepEqual(climatePowerCall(stato, true, "cool"), {
    service: "set_hvac_mode",
    data: { hvac_mode: "cool" },
  });
  // Una modalita' ricordata ma non piu' offerta non si usa.
  assert.deepEqual(climatePowerCall(stato, true, "dry"), {
    service: "set_hvac_mode",
    data: { hvac_mode: "heat" },
  });
  // E "off" non e' un modo di accendere.
  assert.deepEqual(climatePowerCall(stato, true, "off"), {
    service: "set_hvac_mode",
    data: { hvac_mode: "heat" },
  });
});

test("senza ricordi si sceglie la modalita' piu' prudente", () => {
  // "auto" lascia decidere al termostato: meglio che imporgli caldo o freddo.
  assert.equal(
    modalitaDiAccensione({ attributes: { hvac_modes: ["off", "cool", "auto", "heat"] } }),
    "auto",
  );
  assert.equal(modalitaDiAccensione({ attributes: { hvac_modes: ["off", "cool"] } }), "cool");
  assert.equal(modalitaDiAccensione({ attributes: { hvac_modes: ["off"] } }), "");
  assert.equal(modalitaDiAccensione({}), "");
});

test("la modalita' richiesta dal tab vince su ricordo e preferenze", () => {
  const pompa = { state: "off", attributes: { hvac_modes: ["off", "auto", "heat", "cool"] } };
  // Dal tab Caldo la pompa di calore scalda, anche se prima raffrescava.
  assert.equal(modalitaDiAccensione(pompa, "cool", "heat"), "heat");
  assert.deepEqual(climatePowerCall(pompa, true, "cool", "heat"), {
    service: "set_hvac_mode",
    data: { hvac_mode: "heat" },
  });
  // Una richiesta che l'entita' non offre non si inventa: si torna al ricordo.
  const soloFreddo = { state: "off", attributes: { hvac_modes: ["off", "cool"] } };
  assert.equal(modalitaDiAccensione(soloFreddo, "cool", "heat"), "cool");
  // E chi sa fare turn_on viene comunque messo nella modalita' chiesta:
  // turn_on riaccenderebbe com'era.
  const moderno = {
    state: "off",
    attributes: { hvac_modes: ["off", "heat", "cool"], supported_features: CLIMATE_TURN_ON },
  };
  assert.deepEqual(climatePowerCall(moderno, true, "", "heat"), {
    service: "set_hvac_mode",
    data: { hvac_mode: "heat" },
  });
});

test("chi dichiara di saper accendere da solo viene lasciato fare", () => {
  const moderno = {
    state: "off",
    attributes: { hvac_modes: ["off", "heat"], supported_features: CLIMATE_TURN_ON },
  };
  assert.deepEqual(climatePowerCall(moderno, true), { service: "turn_on", data: {} });
});

test("spento vuol dire modalita' off", () => {
  assert.equal(climateIsOff({ state: "off" }), true);
  assert.equal(climateIsOff({ state: "OFF" }), true);
  assert.equal(climateIsOff({ state: "heat" }), false);
  assert.equal(climateIsOff(null), false);
});
