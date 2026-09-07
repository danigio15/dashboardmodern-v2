/* «Si potrebbe mettere per il controllo della qualità dell'aria un'entità
 * sulla scheda principale — io per esempio ho questa
 * sensor.controllo_della_qualita_dell_aria_indoor_air_quality — e poi aprendo
 * la scheda qualche valore tipo monossido, polveri, composti volatili?» (#375)
 *
 * Di serie in copertina va la misura messa peggio, ed è la risposta giusta
 * quando non si dice niente: l'aria di una casa è buona quando lo sono tutte le
 * sue misure. Ma chi ha una centralina che pubblica già il suo indice vuole
 * vedere quello in grande. Le due cose restano separate apposta: il numero
 * grande è quello che si è chiesto di vedere, il giudizio resta della peggiore.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { giudizioDellAria, normalizzaAria } from "../src/core/aria-model.js";

const LETTURE = [
  { entity: "sensor.iaq", misura: "IAQ", valore: 42, grado: "buona" },
  { entity: "sensor.pm25", misura: "PM2.5", valore: 74, grado: "cattiva" },
  { entity: "sensor.co2", misura: "CO₂", valore: 900, grado: "discreta" },
];

test("senza scelta la copertina e' la misura peggiore, come prima", () => {
  const giudizio = giudizioDellAria(LETTURE);
  assert.equal(giudizio.grado, "cattiva");
  assert.equal(giudizio.copertina.entity, "sensor.pm25");
  assert.equal(giudizio.peggiore.entity, "sensor.pm25");
});

test("la misura scelta va in copertina, e il giudizio resta della peggiore", () => {
  const giudizio = giudizioDellAria(LETTURE, "sensor.iaq");
  assert.equal(giudizio.copertina.entity, "sensor.iaq");
  /* Il colore e l'avviso non seguono la copertina: un indice che dice «buona»
   * non copre una polvere che dice «cattiva». */
  assert.equal(giudizio.grado, "cattiva");
  assert.equal(giudizio.peggiore.entity, "sensor.pm25");
});

test("una copertina che non c'e' non fa sparire la tessera", () => {
  /* Il sensore scelto puo' essere spento, tolto dai conti o non disponibile:
   * in quel caso si torna alla peggiore invece di non mostrare niente. */
  const giudizio = giudizioDellAria(LETTURE, "sensor.mai_esistito");
  assert.equal(giudizio.copertina.entity, "sensor.pm25");
});

test("la copertina si salva solo se e' un'entita'", () => {
  assert.equal(normalizzaAria({ principale: "sensor.iaq" }).principale, "sensor.iaq");
  assert.equal(normalizzaAria({ principale: "  sensor.iaq  " }).principale, "sensor.iaq");
  assert.equal(normalizzaAria({ principale: "iaq" }).principale, "");
  assert.equal(normalizzaAria({}).principale, "");
  assert.equal(normalizzaAria(null).principale, "");
});
