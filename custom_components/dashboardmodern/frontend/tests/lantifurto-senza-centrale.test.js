/* I tasti d'inserimento per chi una centrale non ce l'ha (#413).
 *
 * «Possibilita' di configurare i comandi di inserimento e modalita' sia nel
 * comando da lanciare che nel nome icona. Utilizzando un dispositivo tramite
 * esphome non ho il classico control_panel_alarm.»
 *
 * La fila della Sicurezza la disegna la centrale: `supported_features` dice
 * cosa accetta, e i tasti chiamano i servizi di `alarm_control_panel`. Senza
 * quell'entita' restavano i due tasti di ripiego — Fuori e Notte — che
 * chiamavano servizi che non esistono: premerli non dava errore a schermo e non
 * faceva niente. Da fuori, due tasti rotti.
 *
 * Le prove tengono ferme tre cose: il servizio si ricava dal dominio (chiamare
 * `turn_on` su un `button` e' il tasto rotto di prima), senza centrale valgono
 * solo i propri (i tasti di ripiego non chiamano niente), e con la centrale i
 * propri si aggiungono ai suoi invece di scalzarli.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  CHIAVE_ANTIFURTO_SU_MISURA,
  PREFISSO_SU_MISURA,
  chiamataDelModo,
  modoDalServizio,
  modoSuMisuraAcceso,
  normalizzaModiSuMisura,
  tastiSuMisura,
  vuoleUnOpzione,
} from "../src/core/antifurto-su-misura.js";
import {
  ALARM_DISARM,
  alarmActiveModeWithCustom,
  alarmVisibleModes,
} from "../src/core/alarm-panel.js";
import { CONFIG_KEYS } from "../src/core/chiavi-di-configurazione.js";

const ESPHOME = [
  {
    id: "fuori",
    nome: "Fuori casa",
    icona: "mdi:shield-home",
    entita: "script.antifurto_totale",
    stato: "sensor.antifurto",
    valore: "armed_away",
  },
  {
    id: "notte",
    nome: "Notte",
    icona: "mdi:weather-night",
    entita: "input_select.antifurto",
    opzione: "Notte",
  },
  { id: "spegni", nome: "Spegni", entita: "button.antifurto_off" },
];

test("la casella viaggia con la configurazione della casa", () => {
  assert.ok(
    CONFIG_KEYS.includes(CHIAVE_ANTIFURTO_SU_MISURA),
    "l'antifurto configurato sul tablet deve funzionare anche dal telefono",
  );
});

test("una riga senza entità non diventa un tasto", () => {
  const modi = normalizzaModiSuMisura([
    { nome: "Vuoto" },
    { nome: "Sbagliato", entita: "pippo" },
    { nome: "Fuori dominio", entita: "sensor.qualcosa" },
    { nome: "Buono", entita: "script.antifurto" },
  ]);
  assert.deepEqual(
    modi.map((modo) => modo.nome),
    ["Buono"],
  );
});

test("il servizio lo dice il dominio, non si indovina", () => {
  const [fuori, notte, spegni] = normalizzaModiSuMisura(ESPHOME);
  assert.deepEqual(chiamataDelModo(fuori), {
    domain: "script",
    service: "turn_on",
    entity: "script.antifurto_totale",
    data: { entity_id: "script.antifurto_totale" },
  });
  assert.deepEqual(chiamataDelModo(notte), {
    domain: "input_select",
    service: "select_option",
    entity: "input_select.antifurto",
    data: { entity_id: "input_select.antifurto", option: "Notte" },
  });
  assert.equal(
    chiamataDelModo(spegni).service,
    "press",
    "un pulsante ha solo press: turn_on su un button e' il tasto che non fa niente",
  );
});

test("un elenco senza la voce scelta non si chiama a vuoto", () => {
  const [modo] = normalizzaModiSuMisura([{ entita: "input_select.antifurto" }]);
  assert.ok(vuoleUnOpzione(modo.entita));
  assert.equal(chiamataDelModo(modo), null);
});

test("senza centrale valgono solo i tasti scritti a mano", () => {
  const tasti = alarmVisibleModes(null, [], ESPHOME);
  assert.deepEqual(
    tasti.map((voce) => voce.mode),
    ["fuori", "notte", "spegni"],
  );
  assert.ok(
    !tasti.some((voce) => voce.mode === ALARM_DISARM.mode),
    "i tasti di ripiego chiamerebbero servizi che non esistono",
  );
  assert.deepEqual(
    tasti.map((voce) => voce.label),
    ["Fuori casa", "Notte", "Spegni"],
  );
  assert.equal(tasti[0].service, `${PREFISSO_SU_MISURA}fuori`);
  assert.equal(tasti[0].icon, "🛡️", "l'icona la dà il catalogo di casa, dal nome mdi");
});

test("con la centrale i propri si aggiungono ai suoi", () => {
  const centrale = { state: "disarmed", attributes: { supported_features: 3 } };
  const tasti = alarmVisibleModes(centrale, [], ESPHOME);
  assert.deepEqual(
    tasti.map((voce) => voce.mode),
    ["home", "away", "disarm", "fuori", "notte", "spegni"],
  );
});

test("senza tasti scritti a mano non cambia niente", () => {
  const centrale = { state: "disarmed", attributes: { supported_features: 3 } };
  assert.deepEqual(alarmVisibleModes(centrale, []), alarmVisibleModes(centrale, [], []));
  assert.deepEqual(
    alarmVisibleModes(null, []).map((voce) => voce.mode),
    ["away", "night", "disarm"],
  );
});

test("il tasto acceso lo dice lo stato che gli si è indicato", () => {
  const modi = normalizzaModiSuMisura(ESPHOME);
  assert.equal(modoSuMisuraAcceso(modi, { "sensor.antifurto": { state: "armed_away" } }), "fuori");
  assert.equal(modoSuMisuraAcceso(modi, { "input_select.antifurto": { state: "Notte" } }), "notte");
  assert.equal(modoSuMisuraAcceso(modi, { "sensor.antifurto": { state: "disarmed" } }), "");
  assert.equal(
    modoSuMisuraAcceso(modi, { "sensor.antifurto": { state: "unavailable" } }),
    "",
    "chi non risponde non è inserito",
  );
});

test("uno script non resta acceso: non è uno stato, ed è meglio di uno acceso a caso", () => {
  const [fuori] = normalizzaModiSuMisura([{ id: "fuori", entita: "script.antifurto" }]);
  assert.equal(fuori.stato, "script.antifurto");
  assert.equal(modoSuMisuraAcceso([fuori], { "script.antifurto": { state: "off" } }), "");
});

test("se la centrale c'è, la sua parola vince", () => {
  const centrale = { state: "armed_home", attributes: { supported_features: 3 } };
  assert.equal(
    alarmActiveModeWithCustom(centrale, ["home", "away", "disarm"], ESPHOME, {
      "sensor.antifurto": { state: "armed_away" },
    }),
    "home",
  );
  assert.equal(
    alarmActiveModeWithCustom(null, null, ESPHOME, { "sensor.antifurto": { state: "armed_away" } }),
    "fuori",
  );
});

test("il servizio marcato si riconosce, e solo lui", () => {
  assert.equal(modoDalServizio(`${PREFISSO_SU_MISURA}fuori`), "fuori");
  assert.equal(modoDalServizio("alarm_arm_away"), "");
  assert.equal(modoDalServizio(""), "");
});

test("due righe con lo stesso identificativo diventano una", () => {
  const modi = tastiSuMisura([
    { id: "uno", nome: "Primo", entita: "script.uno" },
    { id: "uno", nome: "Secondo", entita: "script.due" },
  ]);
  assert.deepEqual(
    modi.map((voce) => voce.label),
    ["Primo"],
  );
});
