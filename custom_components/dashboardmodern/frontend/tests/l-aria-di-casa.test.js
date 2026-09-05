/* Com'e' l'aria di casa (#321).
 *
 * «Mi piacerebbe ci fosse un widget come quello luci che segni la qualita'
 * dell'aria relativa a un sensore.» Non c'e' niente da configurare: un sensore
 * dell'aria si riconosce da quello che Home Assistant dice di lui, come per il
 * fumo e per gli allagamenti.
 *
 * La parte da pensare e' il giudizio. «847 ppm» e' un dato; «discreta» e' una
 * risposta — e per darla servono le soglie giuste, che cambiano con la
 * sostanza e a volte con l'unita': i composti organici volatili si pubblicano
 * in microgrammi al metro cubo o in parti per miliardo, e sono numeri che
 * differiscono di mille volte.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  CLASSI_ARIA,
  GRADI,
  TONO_DEL_GRADO,
  fraseDellAria,
  eUnaMisuraDellAria,
  giudizioDellAria,
  letturaDellAria,
  parolaDelGrado,
} from "../src/core/aria-model.js";

const sensore = (device_class, state, unit_of_measurement = "") => ({
  state: String(state),
  attributes: { device_class, unit_of_measurement },
});

test("un sensore dell'aria lo dichiara Home Assistant, non il suo nome", () => {
  assert.equal(
    eUnaMisuraDellAria("sensor.salotto_co2", sensore("carbon_dioxide", 700, "ppm")),
    true,
  );
  assert.equal(eUnaMisuraDellAria("sensor.salotto_pm25", sensore("pm25", 8, "µg/m³")), true);
  /* Un termometro non e' una misura dell'aria in questo senso, e nemmeno un
   * sensore che si chiama «aria» ma dichiara altro. */
  assert.equal(eUnaMisuraDellAria("sensor.qualita_aria", sensore("temperature", 21, "°C")), false);
  /* E nemmeno un binary_sensor: quello e' il fumo, che ha gia' la sua tessera. */
  assert.equal(eUnaMisuraDellAria("binary_sensor.fumo", sensore("pm25", 8)), false);
  /* Tutte le classi dichiarate si sanno leggere. */
  for (const classe of CLASSI_ARIA)
    assert.ok(letturaDellAria("sensor.x", sensore(classe, 1)), classe);
});

test("i quattro gradini dell'anidride carbonica", () => {
  const grado = (ppm) => letturaDellAria("sensor.co2", sensore("carbon_dioxide", ppm, "ppm")).grado;
  assert.equal(grado(600), "buona");
  assert.equal(grado(800), "buona");
  assert.equal(grado(847), "discreta");
  assert.equal(grado(1200), "scarsa");
  assert.equal(grado(1800), "cattiva");
});

test("la stessa sostanza in due unita' ha due scale", () => {
  /* Trecento microgrammi al metro cubo sono il confine del buono; trecento
   * parti per miliardo sono un'altra cosa, e leggerle con la stessa soglia
   * direbbe «buona» a un'aria scarsa. */
  const perMetroCubo = letturaDellAria(
    "sensor.voc",
    sensore("volatile_organic_compounds", 300, "µg/m³"),
  );
  const perMiliardo = letturaDellAria(
    "sensor.voc",
    sensore("volatile_organic_compounds", 300, "ppb"),
  );
  assert.equal(perMetroCubo.grado, "buona");
  assert.equal(perMiliardo.grado, "scarsa");
});

test("quello che non si sa leggere non diventa una casella vuota", () => {
  assert.equal(
    letturaDellAria("sensor.co2", sensore("carbon_dioxide", "unavailable", "ppm")),
    null,
  );
  assert.equal(letturaDellAria("sensor.co2", sensore("carbon_dioxide", "", "ppm")), null);
  assert.equal(letturaDellAria("sensor.temp", sensore("temperature", 21, "°C")), null);
  /* Una virgola al posto del punto e' un numero lo stesso. */
  assert.equal(letturaDellAria("sensor.pm25", sensore("pm25", "9,4", "µg/m³")).valore, 9.4);
});

test("il giudizio e' il peggiore, non la media", () => {
  /* L'aria di una casa e' buona quando lo sono tutte le sue misure: due buone
   * e una cattiva non fanno una media discreta, fanno una casa in cui c'e'
   * qualcosa da guardare. */
  const letture = [
    letturaDellAria("sensor.pm25", sensore("pm25", 5, "µg/m³")),
    letturaDellAria("sensor.pm10", sensore("pm10", 10, "µg/m³")),
    letturaDellAria("sensor.co2", sensore("carbon_dioxide", 1800, "ppm")),
  ];
  const giudizio = giudizioDellAria(letture);
  assert.equal(giudizio.grado, "cattiva");
  assert.equal(giudizio.peggiore.entity, "sensor.co2");
  assert.equal(giudizio.quante, 3);
  /* Senza letture non c'e' giudizio: la tessera non compare, invece di
   * comparire dicendo «buona» su niente. */
  assert.equal(giudizioDellAria([]), null);
  assert.equal(giudizioDellAria([null, undefined]), null);
});

test("i gradini hanno una parola, e sono in ordine dal migliore al peggiore", () => {
  assert.deepEqual(GRADI, ["buona", "discreta", "scarsa", "cattiva"]);
  assert.equal(parolaDelGrado("buona", "it"), "Buona");
  assert.equal(parolaDelGrado("cattiva", "en"), "Bad");
  /* Un grado che non esiste non fa saltare la riga. */
  assert.equal(parolaDelGrado("", "it"), "Buona");
});

test("la frase dice quale misura sta peggio, e dove", () => {
  const letture = [
    {
      ...letturaDellAria("sensor.co2", sensore("carbon_dioxide", 1200, "ppm")),
      name: "Salotto CO₂",
    },
    { ...letturaDellAria("sensor.pm25", sensore("pm25", 6, "µg/m³")), name: "Salotto PM2.5" },
  ];
  const frase = fraseDellAria(giudizioDellAria(letture), "it");
  /* La sostanza, quanto, e in che unita': senza il numero non e' una frase. */
  assert.match(frase, /Anidride carbonica/);
  assert.match(frase, /1\.?200 ppm/);
  assert.match(frase, /Salotto CO₂/);
  assert.match(frase, /Fra 2 misure/);
  /* E dove la risposta e' ovvia, la si dice: chiunque abbia avuto sonno in una
   * stanza chiusa sa cosa fare con l'anidride carbonica alta. */
  assert.match(frase, /finestra/);

  /* Con una sola misura non si dice «fra una misura». */
  const sola = fraseDellAria(giudizioDellAria([letture[1]]), "it");
  assert.doesNotMatch(sola, /Fra 1/);
  assert.match(sola, /PM2\.5/);
  /* E quando va bene, lo dice: una finestra che non conclude niente e' una
   * finestra che si apre per niente. */
  assert.match(sola, /niente da fare/i);

  assert.equal(fraseDellAria(null), "");
});

test("i quattro gradini hanno tre colori", () => {
  /* La plancia ha tre toni ovunque — verde, ambra, rosso — e i gradini sono
   * quattro perche' «discreta» e «scarsa» dicono due cose diverse a chi legge,
   * anche quando il colore e' lo stesso. */
  assert.deepEqual(
    GRADI.map((grado) => TONO_DEL_GRADO[grado]),
    ["bene", "corso", "corso", "guarda"],
  );
});
