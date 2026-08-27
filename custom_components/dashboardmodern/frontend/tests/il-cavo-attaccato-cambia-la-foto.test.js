/* «Quando il cavo e' collegato non cambia foto.»
 *
 * La sezione Auto si ridisegna quando cambia lo stato di un'entita' che le
 * interessa, e quali le interessino se lo chiedeva guardando dentro i profili
 * delle vetture. Ma le caselle da cui si capisce se il cavo e' attaccato —
 * stato di ricarica, sensore del cavo, potenza del wallbox — sono canoniche:
 * chi ha una macchina sola le riempie nella mappatura generale della plancia,
 * non nella scheda dell'auto. Quel wallbox che passava a «in carica» non
 * risvegliava nessuno, e la foto col cavo attaccato non arrivava mai: si
 * vedeva soltanto riaprendo la pagina, che e' il momento in cui il disegno
 * riparte da capo per conto suo.
 */
import assert from "node:assert/strict";
import test from "node:test";

const MEMORIA = new Map();
globalThis.localStorage = {
  getItem: (chiave) => (MEMORIA.has(chiave) ? MEMORIA.get(chiave) : null),
  setItem: (chiave, valore) => MEMORIA.set(chiave, String(valore)),
  removeItem: (chiave) => MEMORIA.delete(chiave),
};

/* Una casa con una vettura sola, e la vettura non porta nessuna entita': la
 * mappatura sta tutta nelle caselle generali, com'e' per chi non ha mai avuto
 * bisogno di due profili. */
MEMORIA.set(
  "cd_ev_cars",
  JSON.stringify([{ uid: "auto-1", name: "Cooper SE", img: "/local/auto.png" }]),
);

/* Quello che la plancia risponde quando le si chiede a chi corrisponde una
 * casella canonica. */
const MAPPATURA = {
  "dm.ev_stato_ricarica": "sensor.wallbox_stato",
  "dm.ev_potenza_wallbox": "sensor.wallbox_potenza",
};
globalThis.resolveEntity = (riferimento) => MAPPATURA[riferimento] || "";

const { stateChangeAffectsEv } = await import("../src/sections/ev-section.js");

const cambio = (...entita) => ({ detail: { entity_ids: entita } });

test("il sensore del wallbox risveglia la sezione anche se l'auto non lo nomina", () => {
  assert.equal(stateChangeAffectsEv(cambio("sensor.wallbox_stato")), true);
  assert.equal(stateChangeAffectsEv(cambio("sensor.wallbox_potenza")), true);
});

test("quello che non c'entra continua a non svegliare nessuno", () => {
  assert.equal(stateChangeAffectsEv(cambio("light.salone")), false);
  assert.equal(stateChangeAffectsEv(cambio("sensor.lavatrice_potenza")), false);
});

test("la casella non riempita non conta come entita'", () => {
  /* `dm.ev_cavo_collegato` qui non e' mappata: il riferimento canonico non
   * deve finire nell'elenco come se fosse un'entita' vera, altrimenti un
   * evento che lo nominasse per sbaglio risveglierebbe la sezione a vuoto. */
  assert.equal(stateChangeAffectsEv(cambio("dm.ev_cavo_collegato")), false);
});
