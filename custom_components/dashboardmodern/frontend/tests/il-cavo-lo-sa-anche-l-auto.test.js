/* «In questo momento e' collegato e dice non in carica.»
 *
 * Dal telefono, con la vettura attaccata alla colonnina: la pastiglia
 * sull'eroe diceva «Non in carica». Non e' la pastiglia a sbagliare — dice
 * esattamente quello che sa — e' che nessuno le aveva detto del cavo.
 *
 * Il sensore del cavo lo mappava soltanto il legame della COLONNINA. Chi
 * aggiunge l'auto da un'integrazione e la wallbox non ce l'ha collegata non
 * aveva nessuna casella riempita: uno stato di carica a `off`, senza cavo e
 * senza potenza, e' «non in carica» ed e' la risposta giusta alla domanda
 * sbagliata. Il cavo pero' lo sa anche la vettura, e quasi tutte le
 * integrazioni delle auto lo pubblicano.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { legaLAutoAlDispositivo } from "../src/core/auto-device-binding.js";
import { cavoDalloStato, codiceDellaRicarica } from "../src/core/stato-della-ricarica.js";

const voce = (entity_id, name, extra = {}) => ({ entity_id, name, ...extra });

test("il cavo dell'auto finisce nella casella del cavo", () => {
  const { mappa } = legaLAutoAlDispositivo({
    entities: [
      voce("binary_sensor.b10_charger_connected", "Charger connected"),
      voce("binary_sensor.b10_charging", "Charging"),
      voce("sensor.b10_soc", "Battery", { unit: "%" }),
    ],
  });
  assert.equal(mappa["dm.ev_cavo_collegato"], "binary_sensor.b10_charger_connected");
  /* E lo stato della ricarica resta quello della ricarica: le due caselle non
   * si contendono la stessa entita'. */
  assert.equal(mappa["dm.ev_stato_ricarica"], "binary_sensor.b10_charging");
});

test("un sensore della carica non diventa il cavo", () => {
  /* E' la confusione da cui parte tutto: se «Charging» finisse nella casella
   * del cavo, a carica ferma la plancia direbbe «Non connessa» con la
   * macchina attaccata — peggio di prima. */
  const { mappa } = legaLAutoAlDispositivo({
    entities: [voce("binary_sensor.b10_charging", "Charging")],
  });
  assert.equal(mappa["dm.ev_cavo_collegato"], undefined);
});

test("«charger connected» e' un cavo, anche se dentro «charger» c'e' «charg»", () => {
  /* La regola vecchia della colonnina buttava via qualunque nome contenesse
   * «charg», e cosi' scartava il nome del cavo piu' comune che ci sia. Vale la
   * parola piu' forte: «connected» dice il cavo. */
  for (const nome of [
    "Charger connected",
    "Charging cable connected",
    "Plug status",
    "Cavo collegato",
  ]) {
    const { mappa } = legaLAutoAlDispositivo({
      entities: [voce("binary_sensor.prova", nome)],
    });
    assert.equal(mappa["dm.ev_cavo_collegato"], "binary_sensor.prova", nome);
  }
});

test("con il cavo dentro, una carica ferma e' «collegata», non «non in carica»", () => {
  /* E' il giro completo della segnalazione: le stesse due entita' di sopra,
   * lette come le legge la pastiglia. */
  const stati = {
    "binary_sensor.b10_charger_connected": { state: "on" },
    "binary_sensor.b10_charging": { state: "off" },
  };
  const { mappa } = legaLAutoAlDispositivo({
    entities: [
      voce("binary_sensor.b10_charger_connected", "Charger connected"),
      voce("binary_sensor.b10_charging", "Charging"),
    ],
  });
  const codice = codiceDellaRicarica({
    stato: stati[mappa["dm.ev_stato_ricarica"]].state,
    collegata: cavoDalloStato(stati[mappa["dm.ev_cavo_collegato"]].state),
    potenza: null,
  });
  assert.equal(codice, "B");
});

test("senza nessun sensore del cavo la casella resta vuota, e non si inventa", () => {
  const { mappa } = legaLAutoAlDispositivo({
    entities: [voce("binary_sensor.b10_charging", "Charging")],
  });
  assert.equal(mappa["dm.ev_cavo_collegato"], undefined);
});

/* ── e le lettere della norma ──────────────────────────────────────────── */

test("le lettere dicono anche il cavo: A fuori, B e C dentro", () => {
  assert.equal(cavoDalloStato("A"), false);
  assert.equal(cavoDalloStato("B"), true);
  assert.equal(cavoDalloStato("C"), true);
  assert.equal(cavoDalloStato("D"), true);
  /* F e' un guasto: di dov'e' il cavo non dice niente, e non si inventa. */
  assert.equal(cavoDalloStato("F"), null);
});

test("un «vehicle status» che pubblica la lettera vale come sensore del cavo", () => {
  /* KEBA, go-e e openWB pubblicano la lettera in un sensore, non in un
   * binary_sensor: pretendere il binary_sensor lasciava fuori proprio le
   * colonnine che la lettera la dicono per bene. */
  const { mappa } = legaLAutoAlDispositivo({
    entities: [voce("sensor.wb_vehicle_status", "Vehicle status")],
    states: { "sensor.wb_vehicle_status": { state: "B" } },
  });
  assert.equal(mappa["dm.ev_cavo_collegato"], "sensor.wb_vehicle_status");
});

test("un sensore che parla del cavo ma dice altro non entra nella casella", () => {
  /* Senza la lettera e senza essere un binary_sensor non e' il verdetto del
   * cavo: e' un testo qualunque, e la casella resta vuota. */
  const { mappa } = legaLAutoAlDispositivo({
    entities: [voce("sensor.wb_vehicle_status", "Vehicle status")],
    states: { "sensor.wb_vehicle_status": { state: "Pronta" } },
  });
  assert.equal(mappa["dm.ev_cavo_collegato"], undefined);
});
