/* «Ho controllato che l'entità abbia lo state class su total... ma la sezione
 * all'inizio mi scrive in giallo che devo verificare l'entità che deve avere il
 * "total"» (#485).
 *
 * L'avviso elencava le due condizioni — `state_class` e unità kWh — e lasciava
 * a chi legge il compito di indovinare QUALE delle due mancasse. Chi ne
 * controlla una, la trova giusta e conclude che l'avviso ha torto: e quasi
 * sempre a mancare era l'altra. Una segnalazione che nasce da un avviso che non
 * dice cosa ha visto è un avviso che non ha avvisato.
 *
 * La plancia quel sensore ce l'ha in mano — la sua `state_class` e la sua unità
 * stanno negli stati — e adesso le dice. E quando tornano tutt'e due, la regola
 * non c'entra: le statistiche non coprono ancora il periodo chiesto, e va detto
 * quello invece di mandare a ricontrollare una cosa già giusta.
 */
import assert from "node:assert/strict";
import test from "node:test";

const magazzino = new Map();
globalThis.localStorage = {
  getItem: (k) => (magazzino.has(k) ? magazzino.get(k) : null),
  setItem: (k, v) => magazzino.set(k, String(v)),
  removeItem: (k) => magazzino.delete(k),
};
globalThis.document = undefined;

const { spiegazioneDellErrore } = await import("../src/sections/energy-section.js");

const ERRORE = "Incomplete Home Assistant statistics: day:solar.total_energy:sensor.fv_oggi";

const stato = (attributes) => ({ "sensor.fv_oggi": { state: "12.4", attributes } });

test("dice quale delle due condizioni manca, non tutte e due", () => {
  /* La state_class è giusta, l'unità no: è il caso di chi ha controllato la
   * prima e si è sentito dire di controllarla di nuovo. */
  const riga = spiegazioneDellErrore(
    ERRORE,
    stato({ state_class: "total", unit_of_measurement: "W" }),
  );
  assert.match(riga, /sensor\.fv_oggi/);
  assert.match(riga, /unità/i, "deve dire che il problema è l'unità");
  assert.match(riga, /«W»/, "e deve dire quale unità ha visto");
  assert.doesNotMatch(
    riga,
    /state_class è/,
    "non deve mandare a ricontrollare una state_class che è giusta",
  );
});

test("e quando manca la state_class lo dice, con quella che ha trovato", () => {
  const riga = spiegazioneDellErrore(
    ERRORE,
    stato({ state_class: "measurement", unit_of_measurement: "kWh" }),
  );
  assert.match(riga, /state_class è «measurement»/);
  assert.match(riga, /total_increasing/);
  assert.doesNotMatch(riga, /l'unità è/, "l'unità è giusta e non si nomina");
});

test("una state_class vuota si dice vuota, non si tace", () => {
  const riga = spiegazioneDellErrore(ERRORE, stato({ unit_of_measurement: "kWh" }));
  assert.match(riga, /state_class è «vuota»/);
});

test("quando tornano tutt'e due, il problema è un altro e lo si dice", () => {
  /* Un sensore nato ieri non ha un mese di statistiche: mandare a
   * ricontrollare la state_class sarebbe far perdere tempo su una cosa giusta. */
  const riga = spiegazioneDellErrore(
    ERRORE,
    stato({ state_class: "total_increasing", unit_of_measurement: "kWh" }),
  );
  assert.match(riga, /state_class total_increasing/);
  assert.match(riga, /non coprono ancora il periodo/);
  assert.doesNotMatch(riga, /serve total/);
});

test("un'entità che Home Assistant non ha si dice così", () => {
  /* È il caso di chi ha rinominato o cancellato un sensore e non se lo
   * ricorda: «controlla la state_class» di una cosa che non esiste non porta
   * da nessuna parte. */
  const riga = spiegazioneDellErrore(ERRORE, {});
  assert.match(riga, /non ha questa entità/);
});

test("l'avviso resta quello che era: quale sensore, e che intanto si vedono gli istantanei", () => {
  const riga = spiegazioneDellErrore(ERRORE, stato({ state_class: "total" }));
  assert.match(riga, /Statistiche a lungo termine mancanti/);
  assert.match(riga, /valori istantanei/);
});

test("gli altri errori non cambiano", () => {
  assert.match(spiegazioneDellErrore("timeout waiting for recorder"), /Recorder/);
  assert.equal(spiegazioneDellErrore(""), "");
  assert.equal(spiegazioneDellErrore("boh"), "boh");
});
