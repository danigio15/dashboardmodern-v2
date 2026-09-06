/* Il consiglio di aprire la finestra (#330).
 *
 * «Se UmiditaStanza > Soglia allora "Apri la finestra per arieggiare".»
 * L'umidita' e' quella del sensore della stanza — «si prende solo quella, non
 * fuori». Il dato di fuori, quando c'e', si dice accanto e non decide.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  CHIAVE_SOGLIA_UMIDITA,
  MARGINE,
  SOGLIA_MASSIMA,
  SOGLIA_MINIMA,
  SOGLIA_PREDEFINITA,
  consiglioDiArieggiare,
  cosaMancaPerArieggiare,
  sogliaDellUmidita,
  sogliaDellaFinestra,
  umiditaDellaRiga,
} from "../src/core/arieggiare.js";

const consiglio = (dentro, fuori, soglia = 60) =>
  consiglioDiArieggiare({ dentro, fuori, soglia });

test("sopra la soglia si apre", () => {
  const esito = consiglio(72, 55);
  assert.equal(esito.arieggia, true);
  assert.equal(esito.motivo, "conviene");
  assert.equal(esito.fuoriPiuUmido, false);
});

test("sopra la soglia si apre anche col fuori piu' umido, e lo si dice", () => {
  /* La giornata di pioggia: la stanza sta male lo stesso. Il fuori non
   * decide — «si prende solo l'umidita' della stanza» — ma chi apre deve
   * sapere che fuori e' peggio, e la card glielo scrive accanto. */
  const esito = consiglio(72, 80);
  assert.equal(esito.arieggia, true);
  assert.equal(esito.motivo, "conviene");
  assert.equal(esito.fuoriPiuUmido, true);
  // Alla pari: uguale non e' piu' asciutto.
  assert.equal(consiglio(72, 72).fuoriPiuUmido, true);
});

test("un punto di scarto fra due igrometri non e' una differenza", () => {
  /* Due strumenti nella stessa aria danno numeri diversi di un punto: sotto il
   * margine il fuori non e' piu' asciutto, e' solo un altro sensore. */
  assert.equal(consiglio(72, 72 - MARGINE + 0.5).fuoriPiuUmido, true);
  assert.equal(consiglio(72, 72 - MARGINE - 0.5).fuoriPiuUmido, false);
});

test("sotto la soglia si tace, per quanto asciutto sia fuori", () => {
  const esito = consiglio(50, 20);
  assert.equal(esito.arieggia, false);
  assert.equal(esito.motivo, "sotto-soglia");
  // La misura si porta fuori lo stesso: la card la scrive anche senza consiglio.
  assert.equal(esito.dentro, 50);
});

test("senza la misura della stanza non si inventa un consiglio", () => {
  assert.equal(consiglio(null, 30).motivo, "senza-misura-dentro");
  // Un sensore che dice «unavailable» non e' uno zero.
  assert.equal(consiglio("unavailable", 30).motivo, "senza-misura-dentro");
  assert.equal(consiglio(null, 30).arieggia, false);
  assert.equal(consiglio(null, 30).dentro, null);
});

test("senza il dato di fuori il consiglio c'e' lo stesso: il fuori non serve", () => {
  /* Chi non ha una stazione meteo mappata vedeva sempre un silenzio: era il
   * vincolo che faceva dire «non esce nessun avviso». */
  for (const fuori of [null, "", "unknown", "unavailable"]) {
    const esito = consiglio(72, fuori);
    assert.equal(esito.arieggia, true, `fuori=${fuori}`);
    assert.equal(esito.motivo, "conviene");
    assert.equal(esito.fuori, null);
    assert.equal(esito.fuoriPiuUmido, false);
  }
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
  // Ma la misura c'e', e la card la mostra.
  assert.equal(esito.dentro, 95);
});

/* «La percentuale deve stare sotto alla creazione della singola finestra e
 * legata a ogni finestra.» */
test("ogni finestra ha la sua soglia, e chi non ce l'ha prende quella di casa", () => {
  // Il bagno vuole il cinquantacinque: la sua riga vince su casa.
  assert.equal(sogliaDellaFinestra({ umidita: 55 }, 60), 55);
  assert.equal(sogliaDellaFinestra({ umidita: "55" }, 60), 55);
  // La camera non ha scritto niente: vale casa.
  assert.equal(sogliaDellaFinestra({}, 65), 65);
  assert.equal(sogliaDellaFinestra({ umidita: "" }, 65), 65);
  assert.equal(sogliaDellaFinestra({ umidita: null }, 65), 65);
  // Casa non scritta: la quota di serie.
  assert.equal(sogliaDellaFinestra({}, null), SOGLIA_PREDEFINITA);
  // Zero sulla riga spegne QUESTA finestra, anche con casa accesa.
  assert.equal(sogliaDellaFinestra({ umidita: 0 }, 60), null);
  assert.equal(sogliaDellaFinestra({ umidita: "0" }, 60), null);
});

test("quello che si scrive nella casella della riga diventa un numero, o niente", () => {
  assert.equal(umiditaDellaRiga(""), null);
  assert.equal(umiditaDellaRiga(undefined), null);
  assert.equal(umiditaDellaRiga("abc"), null);
  assert.equal(umiditaDellaRiga("55"), 55);
  assert.equal(umiditaDellaRiga("55,6"), 56);
  assert.equal(umiditaDellaRiga("0"), 0);
  /* Fuori scala si riporta dentro, invece di buttare via in silenzio quello
   * che uno ha scritto. */
  assert.equal(umiditaDellaRiga("12"), SOGLIA_MINIMA);
  assert.equal(umiditaDellaRiga("99"), SOGLIA_MASSIMA);
});

test("la chiave della configurazione e' una sola", () => {
  assert.equal(CHIAVE_SOGLIA_UMIDITA, "cd_umidita_soglia");
});

/* «Non funziona»: e non poteva funzionare, perche' il consiglio vuole tre
 * cose insieme e ne mancava una. Tacere e' giusto; tacere senza dire cosa
 * manca e' quel che fa sembrare rotta una funzione che aspetta un sensore. */
test("una casa appena installata dice tutto quello che le manca", () => {
  assert.deepEqual(cosaMancaPerArieggiare({}), ["senza-igrometro-in-stanza"]);
});

test("con tutto a posto non manca niente, e il fuori non e' fra le cose che servono", () => {
  assert.deepEqual(
    cosaMancaPerArieggiare({
      soglia: 60,
      stanzeConUmidita: 2,
      finestreInStanzaConUmidita: 1,
    }),
    [],
  );
});

test("l'igrometro c'e' ma nessuna finestra sta in quella stanza", () => {
  /* Due silenzi diversi: «non ho la misura» e «ho la misura ma non ho la
   * finestra a cui appenderla». Chi legge deve sapere quale dei due. */
  assert.deepEqual(
    cosaMancaPerArieggiare({
      soglia: 60,
      stanzeConUmidita: 3,
      finestreInStanzaConUmidita: 0,
    }),
    ["finestra-senza-stanza"],
  );
});

test("la soglia a zero e' una scelta, e viene detta", () => {
  assert.deepEqual(
    cosaMancaPerArieggiare({
      soglia: 0,
      stanzeConUmidita: 1,
      finestreInStanzaConUmidita: 1,
    }),
    ["soglia-spenta"],
  );
});
