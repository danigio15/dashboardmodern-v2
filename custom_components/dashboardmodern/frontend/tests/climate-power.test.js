import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

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

/* «La sezione Clima non funziona tanto bene: impostando correttamente le
 * entità non si accendono» — segnalazione di un utente, via Messenger. */

test("il tab da cui si preme decide il verso, quando non c'è niente da ricordare", () => {
  const condizionatore = {
    state: "off",
    attributes: { hvac_modes: ["off", "cool", "heat"] },
  };
  // Senza suggerimento vinceva la scala generale, che mette "heat" prima di
  // "cool": un condizionatore acceso dal tab Freddo partiva a scaldare.
  assert.equal(modalitaDiAccensione(condizionatore), "heat");
  assert.equal(modalitaDiAccensione(condizionatore, "", "", "cool"), "cool");
  assert.equal(modalitaDiAccensione(condizionatore, "", "", "heat"), "heat");
  // Il suggerimento non batte la modalità di ieri: chi lasciava il
  // condizionatore in deumidificazione lo ritrova così.
  const conDry = { state: "off", attributes: { hvac_modes: ["off", "cool", "dry"] } };
  assert.equal(modalitaDiAccensione(conDry, "dry", "", "cool"), "dry");
  // Né una modalità che quel termostato non offre.
  assert.equal(modalitaDiAccensione(conDry, "", "", "heat"), "cool");
  // E l'ordine perentorio della pompa resta il primo di tutti.
  assert.equal(modalitaDiAccensione(condizionatore, "cool", "heat", "cool"), "heat");
  // Il suggerimento arriva fino alla chiamata.
  assert.deepEqual(climatePowerCall(condizionatore, true, "", "", "cool"), {
    service: "set_hvac_mode",
    data: { hvac_mode: "cool" },
  });
});

test("il comando del clima passa dalla presa vera della plancia", async () => {
  const sorgente = await readFile(
    new URL("../src/sections/climate-power-section.js", import.meta.url),
    "utf8",
  );
  /* Si provavano tre strade e nessuna delle tre esiste: `cdCallServiceJson` e
   * `callService` non sono definite da nessuna parte, e `hass` c'è solo dentro
   * il pannello. Il tasto non chiamava niente, in silenzio. */
  const primaVia = sorgente.indexOf('typeof root.dmCallHaService === "function"');
  assert.ok(primaVia > 0, "dmCallHaService è la presa da provare");
  for (const tarda of [
    'typeof root.cdCallServiceJson === "function"',
    'typeof root.callService === "function"',
    "root.hass || root._hass",
  ]) {
    assert.ok(sorgente.indexOf(tarda) > primaVia, `${tarda} viene dopo dmCallHaService`);
  }
  // E chi non trova nessuno lo dice, così la strada di riserva parte davvero.
  assert.match(sorgente, /if \(!chiama\(id, chiamata\.service, chiamata\.data\)\) return null;/);
  assert.match(sorgente, /return false;/);
});
