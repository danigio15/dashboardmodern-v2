/* Il consiglio di aprire la finestra (#330).
 *
 * «Se UmiditaStanza > Soglia e se UmiditaEsterna < UmiditaStanza allora "Apri
 * la finestra per arieggiare".» Le due condizioni valgono insieme: la seconda
 * e' quella che tiene onesto il consiglio, perche' con novanta dentro e
 * novantacinque fuori aprire non asciuga — bagna.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  CHIAVE_SOGLIA_UMIDITA,
  MARGINE,
  SOGLIA_PREDEFINITA,
  consiglioDiArieggiare,
  sogliaDellUmidita,
} from "../src/core/arieggiare.js";

const consiglio = (dentro, fuori, soglia = 60) =>
  consiglioDiArieggiare({ dentro, fuori, soglia });

test("sopra la soglia e con il fuori piu' asciutto, si apre", () => {
  const esito = consiglio(72, 55);
  assert.equal(esito.arieggia, true);
  assert.equal(esito.motivo, "conviene");
});

test("sopra la soglia ma col fuori piu' umido, non si apre", () => {
  /* La giornata di piova: dentro si sta male, ma aprire peggiora. */
  assert.deepEqual(
    { arieggia: consiglio(72, 80).arieggia, motivo: consiglio(72, 80).motivo },
    { arieggia: false, motivo: "fuori-piu-umido" },
  );
  // Nemmeno alla pari: uguale non e' piu' asciutto.
  assert.equal(consiglio(72, 72).arieggia, false);
});

test("un punto di scarto fra due igrometri non e' una differenza", () => {
  /* Due strumenti nella stessa aria danno numeri diversi di un punto: sotto il
   * margine il fuori non e' piu' asciutto, e' solo un altro sensore. */
  assert.equal(consiglio(72, 72 - MARGINE + 0.5).arieggia, false);
  assert.equal(consiglio(72, 72 - MARGINE - 0.5).arieggia, true);
});

test("sotto la soglia si tace, per quanto asciutto sia fuori", () => {
  const esito = consiglio(50, 20);
  assert.equal(esito.arieggia, false);
  assert.equal(esito.motivo, "sotto-soglia");
});

test("senza una misura non si inventa un consiglio", () => {
  assert.equal(consiglio(null, 30).motivo, "senza-misura-dentro");
  assert.equal(consiglio(72, null).motivo, "senza-misura-fuori");
  assert.equal(consiglio(72, "").motivo, "senza-misura-fuori");
  // Un sensore che dice «unavailable» non e' uno zero.
  assert.equal(consiglio("unavailable", 30).motivo, "senza-misura-dentro");
  assert.equal(consiglio(72, "unknown").motivo, "senza-misura-fuori");
  for (const caso of [
    [null, 30],
    [72, null],
    ["unavailable", 30],
  ])
    assert.equal(consiglio(...caso).arieggia, false);
});

test("i numeri arrivano come li scrive Home Assistant, anche con la virgola", () => {
  assert.equal(consiglio("72,4", "55,1").arieggia, true);
  assert.equal(consiglio("72.4", "55.1").arieggia, true);
});

test("la soglia: quella scritta, quella di casa, e quella che spegne", () => {
  assert.equal(sogliaDellUmidita(65), 65);
  assert.equal(sogliaDellUmidita("65"), 65);
  // Non scritta: vale quella di casa.
  assert.equal(sogliaDellUmidita(undefined), SOGLIA_PREDEFINITA);
  assert.equal(sogliaDellUmidita(""), SOGLIA_PREDEFINITA);
  assert.equal(sogliaDellUmidita("niente"), SOGLIA_PREDEFINITA);
  /* Zero spegne il consiglio invece di farlo scattare sempre: «apri la
   * finestra comunque» non e' un suggerimento. */
  assert.equal(sogliaDellUmidita(0), null);
  // Fuori scala: nessuna casa vive al dieci per cento, e al novantanove il
  // consiglio non arriverebbe mai. Si considera non scritta.
  assert.equal(sogliaDellUmidita(10), null);
  assert.equal(sogliaDellUmidita(99), null);
});

test("una soglia spenta tace, anche con la stanza fradicia", () => {
  const esito = consiglioDiArieggiare({ dentro: 95, fuori: 20, soglia: null });
  assert.equal(esito.arieggia, false);
  assert.equal(esito.motivo, "senza-soglia");
});

test("la chiave della configurazione e' una sola", () => {
  assert.equal(CHIAVE_SOGLIA_UMIDITA, "cd_umidita_soglia");
});
