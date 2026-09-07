/* «Vorrei uno slider per decidere il tempo che un condizionatore debba restare
 * acceso dal momento che gli do l'on, utile spesso di notte o per accensioni a
 * spot.» (#364)
 *
 * La parte delicata non è lo slider, è dove vive il conto alla rovescia: un
 * timer nel browser muore chiudendo la pagina, e chi accende il condizionatore
 * per due ore prima di dormire la pagina la chiude sempre. Qui c'è la regola;
 * il timer vero sta in Home Assistant.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  FERMI_DELLO_SLIDER,
  contoAllaRovescia,
  durataScritta,
  fermoDeiMinuti,
  minutiDelFermo,
  normalizzaIMinuti,
  quantoManca,
  scadenzaDa,
  timerVivi,
} from "../src/core/spegnimento-programmato.js";

const ADESSO = 1_700_000_000_000;
const MINUTO = 60_000;

test("lo slider ha i fermi che si scelgono davvero", () => {
  /* Nessuno accende il condizionatore per 37 minuti, e su un telefono una
   * scala continua te ne fa scegliere 37 quando ne volevi 30. */
  assert.equal(normalizzaIMinuti(37), 30);
  assert.equal(normalizzaIMinuti(100), 90);
  assert.equal(normalizzaIMinuti(9999), FERMI_DELLO_SLIDER.at(-1));
  assert.equal(normalizzaIMinuti(1), FERMI_DELLO_SLIDER[0]);
});

test("zero è una risposta valida e vuol dire «nessuno spegnimento»", () => {
  assert.equal(normalizzaIMinuti(0), 0);
  assert.equal(normalizzaIMinuti(-5), 0);
  assert.equal(normalizzaIMinuti("boh"), 0);
  assert.equal(scadenzaDa(0, ADESSO), null);
  assert.equal(fermoDeiMinuti(0), -1);
});

test("la posizione dello slider e i minuti dicono la stessa cosa", () => {
  assert.equal(minutiDelFermo(0), FERMI_DELLO_SLIDER[0]);
  assert.equal(minutiDelFermo(FERMI_DELLO_SLIDER.length - 1), FERMI_DELLO_SLIDER.at(-1));
  assert.equal(minutiDelFermo(999), FERMI_DELLO_SLIDER.at(-1), "oltre il fondo resta il fondo");
  assert.equal(fermoDeiMinuti(120), FERMI_DELLO_SLIDER.indexOf(120));
});

test("una durata si scrive come la direbbe una persona", () => {
  assert.equal(durataScritta(45), "45 min");
  assert.equal(durataScritta(120), "2 h", "le ore tonde non portano gli zeri dei minuti");
  assert.equal(durataScritta(90), "1 h 30");
  assert.equal(durataScritta(90, "en"), "1h 30m");
  assert.equal(durataScritta(0), "");
});

test("a trenta secondi dalla fine manca un minuto, non zero", () => {
  /* Zero vuol dire finito, e non è finito: si arrotonda per eccesso. */
  const fra30s = quantoManca(ADESSO + 30_000, ADESSO);
  assert.equal(fra30s.armato, true);
  assert.equal(fra30s.scaduto, false);
  assert.equal(fra30s.minuti, 1);
  assert.equal(contoAllaRovescia(ADESSO + 91 * MINUTO, ADESSO), "Ancora 1 h 31");
  assert.equal(contoAllaRovescia(ADESSO + 91 * MINUTO, ADESSO, "en"), "1h 31m left");
});

test("una scadenza che non c'è non è una scadenza appena passata", () => {
  /* Uno spegnimento non si inventa da un dato mancante. */
  assert.deepEqual(quantoManca(null, ADESSO), { armato: false, scaduto: false, restaMs: 0 });
  assert.deepEqual(quantoManca("domani", ADESSO), { armato: false, scaduto: false, restaMs: 0 });
  assert.equal(quantoManca(ADESSO - 1, ADESSO).scaduto, true);
  assert.equal(contoAllaRovescia(ADESSO - 1, ADESSO), "", "una scadenza passata non si scrive");
});

test("i timer già scaduti si buttano, non si disegnano fermi su zero", () => {
  /* Se la casa non ha ancora spento — un riavvio nel mezzo — la card torna a
   * dire quello che l'entità dice davvero, che è l'unica verità che abbiamo. */
  const vivi = timerVivi(
    {
      "climate.salone": ADESSO + 20 * MINUTO,
      "climate.camera": ADESSO - MINUTO,
      "climate.storta": "boh",
    },
    ADESSO,
  );
  assert.deepEqual(vivi, { "climate.salone": ADESSO + 20 * MINUTO });
});

test("la scadenza è la partenza più la durata, al millisecondo", () => {
  assert.equal(scadenzaDa(30, ADESSO), ADESSO + 30 * MINUTO);
  assert.equal(scadenzaDa(30, null), null);
});
