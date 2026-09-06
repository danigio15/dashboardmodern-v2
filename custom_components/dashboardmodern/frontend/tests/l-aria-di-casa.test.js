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
  nellUnitaDiRiferimento,
  normalizzaUnita,
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

test("il monossido di carbonio si giudica nell'unita' in cui arriva (#340)", () => {
  /* «Outdoor Environment CO = 156 µg/m³ … lo classifica come ARIA CATTIVA e
   * come la peggiore delle 15 misure.» Le soglie erano in ppm e si
   * applicavano a qualunque numero: 156 microgrammi sono 0,156 mg/m³, cioe'
   * una quarantina di volte sotto i 4 mg/m³ delle linee guida OMS. */
  const co = (valore, unita) => letturaDellAria("sensor.co", sensore("carbon_monoxide", valore, unita));
  const fuori = co(156, "µg/m³");
  assert.equal(fuori.grado, "buona");
  /* Quello che si mostra e' quello che si e' letto: il numero e la SUA unita'. */
  assert.equal(fuori.valore, 156);
  assert.equal(fuori.unita, "µg/m³");
  /* E quello che si e' giudicato sta nell'unita' delle soglie. */
  assert.equal(fuori.unitaDiRiferimento, "mg/m³");
  assert.ok(Math.abs(fuori.confronto - 0.156) < 1e-9);
  /* Le tre tastiere con cui si scrive la stessa unita'. */
  assert.equal(co(156, "ug/m3").grado, "buona");
  assert.equal(co(156, "μg/m³").grado, "buona");

  /* In milligrammi le soglie sono quelle dell'OMS (4 sulle 24 ore) e della
   * direttiva europea (10 sulle 8 ore): 4 e' ancora buona, 12 e' scarsa,
   * 35 e' cattiva. */
  assert.equal(co(4, "mg/m³").grado, "buona");
  assert.equal(co(7, "mg/m³").grado, "discreta");
  assert.equal(co(12, "mg/m³").grado, "scarsa");
  assert.equal(co(35, "mg/m³").grado, "cattiva");

  /* In parti per milione si converte a 25 °C: 1 ppm di CO e' 1,145 mg/m³.
   * 3 ppm (3,4 mg/m³) e' buona; 9 ppm (10,3 mg/m³) e' appena oltre gli 8 ore;
   * 30 ppm (34 mg/m³) e' cattiva. */
  assert.equal(co(3, "ppm").grado, "buona");
  assert.ok(Math.abs(co(9, "ppm").confronto - 10.31) < 0.01);
  assert.equal(co(9, "ppm").grado, "scarsa");
  assert.equal(co(30, "ppm").grado, "cattiva");
  /* Senza unita' il numero si legge nella scala delle soglie, com'e' sempre
   * stato: non si inventa niente. */
  assert.equal(co(12, "").grado, "scarsa");
});

test("gli altri gas in parti per miliardo si portano in microgrammi", () => {
  /* 60 ppb di biossido di azoto sono 113 µg/m³: sopra i 90 dell'indice
   * europeo, non sotto i 40 come li avrebbe letti la vecchia scala. */
  const no2 = letturaDellAria("sensor.no2", sensore("nitrogen_dioxide", 60, "ppb"));
  assert.equal(no2.grado, "scarsa");
  assert.ok(Math.abs(no2.confronto - 112.9) < 0.1);
  assert.equal(no2.unita, "ppb");
  /* L'ozono e l'anidride solforosa, per massa molare: 50 ppb di O₃ sono
   * 98 µg/m³ (buona), 100 ppb di SO₂ sono 262 µg/m³ (scarsa). */
  assert.equal(letturaDellAria("sensor.o3", sensore("ozone", 50, "ppb")).grado, "buona");
  assert.equal(letturaDellAria("sensor.so2", sensore("sulphur_dioxide", 100, "ppb")).grado, "scarsa");
  /* L'anidride carbonica in percento: 0,12% sono 1200 ppm. */
  assert.equal(letturaDellAria("sensor.co2", sensore("carbon_dioxide", 0.12, "%")).grado, "scarsa");
  /* Le polveri in milligrammi: 0,03 mg/m³ sono 30 µg/m³ di PM2.5. */
  const pm = letturaDellAria("sensor.pm25", sensore("pm25", 0.03, "mg/m3"));
  assert.equal(pm.grado, "scarsa");
  assert.equal(pm.confronto, 30);
});

test("le unita' si ripuliscono e si convertono una volta sola", () => {
  assert.equal(normalizzaUnita(" ug/m3 "), "µg/m³");
  assert.equal(normalizzaUnita("μg/m³"), "µg/m³");
  assert.equal(normalizzaUnita("PPM"), "ppm");
  assert.equal(normalizzaUnita(""), "");
  const misura = { unita: "mg/m³", massaMolare: 28.01 };
  assert.equal(nellUnitaDiRiferimento(4000, "µg/m³", misura), 4);
  assert.ok(Math.abs(nellUnitaDiRiferimento(1, "ppm", misura) - 1.1457) < 0.001);
  /* Un'unita' che non si conosce lascia il numero com'e'. */
  assert.equal(nellUnitaDiRiferimento(7, "boh", misura), 7);
  /* E fra le due famiglie senza massa molare non si passa: i composti
   * organici volatili hanno le loro scale, non una conversione. */
  assert.equal(nellUnitaDiRiferimento(7, "ppb", { unita: "µg/m³" }), 7);
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
