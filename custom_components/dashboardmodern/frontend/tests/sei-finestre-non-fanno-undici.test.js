/* «Ne ho 6 ma ne risultano 11» (#462).
 *
 * La #442 aveva corretto il nome della tessera e la didascalia: le tapparelle
 * si ALZANO, le ante si APRONO, e dirle tutte «aperte» diceva il falso. Il
 * numero grande però era rimasto la somma delle righe aperte, e una finestra
 * configurata come si configura — la tapparella più il contatto del suo
 * infisso — di righe ne porta due.
 *
 * Sei finestre con la persiana su e l'anta aperta facevano quindi undici: un
 * numero che non conta né le finestre né le tapparelle, e che chi guarda non
 * può verificare girando per casa.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { contoDelleAperture } from "../src/core/cover-kind.js";

const leggi = (rel) => readFile(new URL(rel, import.meta.url), "utf8");

/* La casa della segnalazione: sei finestre, cinque con la tapparella e una
 * senza, ognuna col contatto sull'anta. Undici righe, sei finestre. */
const casaDellaSegnalazione = () => {
  const stanze = ["Camera", "Cameretta", "Cucina", "Bagno", "Studio", "Salotto"];
  const righe = [];
  for (const [indice, stanza] of stanze.entries()) {
    if (indice > 0) righe.push({ name: stanza, soloSensore: false, open: true });
    righe.push({ name: `${stanza} · Finestra`, soloSensore: true, open: true });
  }
  return righe;
};

test("undici righe, sei finestre: il numero dice sei", () => {
  const righe = casaDellaSegnalazione();
  assert.equal(righe.length, 11);
  const conto = contoDelleAperture(righe);
  /* Il numero della tessera. Prima era `righe.filter(open).length`, cioè 11. */
  assert.equal(conto.contate.length, 6);
  assert.equal(conto.soloMotori, false);
  /* E le tapparelle non spariscono: restano cinque, e la didascalia le dice
   * per conto loro. */
  assert.equal(conto.alzate.length, 5);
});

test("l'anello misura la stessa cosa del numero", () => {
  const conto = contoDelleAperture(casaDellaSegnalazione());
  /* Il denominatore è l'insieme da cui esce il numeratore: con undici righe
   * al denominatore, sei finestre aperte su sei disegnavano un anello a
   * poco più di metà. */
  assert.equal(conto.insieme.length, 6);
  assert.equal(Math.round((conto.contate.length / conto.insieme.length) * 100), 100);
});

test("senza un solo contatto si contano i motori alzati", () => {
  const conto = contoDelleAperture([
    { name: "Camera", soloSensore: false, open: true },
    { name: "Cucina", soloSensore: false, open: true },
    { name: "Bagno", soloSensore: false, open: false },
  ]);
  assert.equal(conto.soloMotori, true);
  assert.equal(conto.contate.length, 2);
  assert.equal(conto.insieme.length, 3);
  assert.equal(conto.aperte.length, 0);
});

test("senza un solo motore si contano le ante aperte", () => {
  const conto = contoDelleAperture([
    { name: "Camera", soloSensore: true, open: true },
    { name: "Cucina", soloSensore: true, open: false },
  ]);
  assert.equal(conto.soloMotori, false);
  assert.equal(conto.contate.length, 1);
  assert.equal(conto.insieme.length, 2);
});

test("a casa chiusa il numero è zero, non il numero delle righe", () => {
  const righe = casaDellaSegnalazione().map((riga) => ({ ...riga, open: false }));
  const conto = contoDelleAperture(righe);
  assert.equal(conto.contate.length, 0);
  assert.equal(conto.alzate.length, 0);
});

test("una riga sola non può finire in tutt'e due gli insiemi", () => {
  const conto = contoDelleAperture(casaDellaSegnalazione());
  const doppie = conto.coperture.filter((riga) => conto.contatti.includes(riga));
  assert.deepEqual(doppie, []);
  assert.equal(conto.coperture.length + conto.contatti.length, 11);
});

test("niente righe, niente conti inventati", () => {
  for (const vuoto of [[], null, undefined, "sei"]) {
    const conto = contoDelleAperture(vuoto);
    assert.deepEqual(conto.contate, []);
    assert.equal(conto.soloMotori, false);
  }
  /* Una riga nulla in mezzo non fa cadere il conto né si conta. */
  const conto = contoDelleAperture([null, { name: "Camera", soloSensore: true, open: true }]);
  assert.equal(conto.contate.length, 1);
});

test("la tessera scrive quel numero, e quell'anello", async () => {
  const sorgente = await leggi("../src/sections/home-widgets-section.js");
  const dentro = sorgente.slice(
    sorgente.indexOf("function coversModel(states)"),
    sorgente.indexOf("function securityModel(states)"),
  );
  assert.match(dentro, /value: String\(contate\.length\)/);
  assert.match(dentro, /ring: Math\.round\(\(contate\.length \/ insieme\.length\) \* 100\)/);
  /* La barra sotto il meteo legge questo campo per la sua pastiglia: se qui
   * restassero tutte le righe aperte, la pastiglia direbbe undici mentre la
   * tessera dice sei, ed è il guasto peggiore dei due. */
  assert.match(dentro, /open: contate,/);
  assert.doesNotMatch(dentro, /rows\.filter\(\(row\) => row\.open\)/);
});
