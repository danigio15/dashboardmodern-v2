/* «Per chi ha una stazione meteo sarebbe utile vedere il rain rate e la
 * pioggia caduta nella giornata. Questo potrebbe integrarsi anche su gestione
 * irrigazione.» (#478)
 *
 * Due letture nuove sotto il meteo, e la seconda che serve anche altrove:
 * l'irrigazione una regola sulla pioggia ce l'aveva già, ma guarda un'altra
 * cosa — la PROBABILITÀ che piova, secondo le previsioni. Un pluviometro dice
 * un fatto più forte: quanta acqua è caduta davvero. Le due non si
 * sostituiscono, e infatti qui stanno insieme.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  PIOGGIA_CHE_BASTA_MM,
  inMillimetri,
  siPuoSaltare,
  stapiovendo,
  verdettoDellaPioggia,
} from "../src/core/pioggia-caduta.js";

test("sta piovendo lo dice il pluviometro, non un'oscillazione attorno allo zero", () => {
  assert.equal(stapiovendo(1.4), true);
  assert.equal(stapiovendo(0.2), true);
  /* Un decimo di millimetro all'ora è il rumore di una stazione economica con
   * l'imbuto bagnato: chiamarlo pioggia vorrebbe dire saltare l'irrigazione
   * per un'ombra. */
  assert.equal(stapiovendo(0.1), false);
  assert.equal(stapiovendo(0), false);
  assert.equal(stapiovendo(null), false);
  assert.equal(stapiovendo("non un numero"), false);
});

test("tre esiti, non due: piove, ha già piovuto, asciutto", () => {
  assert.equal(verdettoDellaPioggia({ intensita: 2.2, oggi: 0.4 }).chiave, "piove");
  assert.equal(verdettoDellaPioggia({ intensita: 0, oggi: 12 }).chiave, "bagnato");
  assert.equal(verdettoDellaPioggia({ intensita: 0, oggi: 1.2 }).chiave, "asciutto");
  /* «Sta piovendo» e «ha piovuto abbastanza» sono due ragioni diverse per
   * saltare il giro, e chi legge la pagina vuole sapere quale delle due è. */
  assert.equal(siPuoSaltare(verdettoDellaPioggia({ intensita: 2.2 })), true);
  assert.equal(siPuoSaltare(verdettoDellaPioggia({ oggi: 12 })), true);
  assert.equal(siPuoSaltare(verdettoDellaPioggia({ oggi: 1.2 })), false);
});

test("senza pluviometro non si dice «asciutto»: non si sa", () => {
  /* Dire asciutto senza sensore sarebbe inventarselo, e su quell'invenzione
   * la pagina proporrebbe di innaffiare un prato appena bagnato. */
  assert.equal(verdettoDellaPioggia({}), null);
  assert.equal(verdettoDellaPioggia({ intensita: "", oggi: "" }), null);
  assert.equal(siPuoSaltare(null), false);
  /* Con uno solo dei due invece un verdetto c'è. */
  assert.equal(verdettoDellaPioggia({ oggi: 0 }).chiave, "asciutto");
});

test("la soglia è quella di un giro d'impianto, e si può cambiare", () => {
  /* Un impianto da giardino mette fra i tre e i sei millimetri per giro:
   * cinque di pioggia sono un giro già fatto dal cielo. */
  assert.equal(PIOGGIA_CHE_BASTA_MM, 5);
  assert.equal(verdettoDellaPioggia({ oggi: 5 }).chiave, "bagnato");
  assert.equal(verdettoDellaPioggia({ oggi: 4.9 }).chiave, "asciutto");
  assert.equal(verdettoDellaPioggia({ oggi: 3, soglia: 2 }).chiave, "bagnato");
  /* La virgola decimale di chi scrive all'italiana non rompe il conto. */
  assert.equal(verdettoDellaPioggia({ oggi: "7,5" }).chiave, "bagnato");
});

test("i due sensori si scrivono una volta sola, sotto il meteo", async () => {
  const barra = await readFile(
    new URL("../src/sections/come-sta-la-casa-section.js", import.meta.url),
    "utf8",
  );
  /* Le due caselle stanno nella scheda della barra, con le altre due letture. */
  assert.match(barra, /campoDellaMisura\(\s*"pioggia",/);
  assert.match(barra, /campoDellaMisura\(\s*"pioggiaOggi",/);
  /* E si leggono da fuori: è così che l'irrigazione le usa senza averne di sue. */
  assert.match(barra, /export function letturePioggia\(/);

  const irrigazione = await readFile(
    new URL("../src/sections/pool-irrigation-scene-section.js", import.meta.url),
    "utf8",
  );
  assert.match(irrigazione, /import \{ letturePioggia \} from "\.\/come-sta-la-casa-section\.js"/);
  assert.match(irrigazione, /data-dm-irr-caduta/);
  /* Il gettone della probabilità resta dov'era: le due cose stanno insieme. */
  assert.match(irrigazione, /const rain = entityNumber\(config\.rainEnt\)/);
  /* E nessuna seconda casella per lo stesso pluviometro. */
  assert.doesNotMatch(irrigazione, /ed-irr-pioggia-oggi/);
});

/* ── quello che la revisione della #481 ha trovato ─────────────────────── */

test("i pollici diventano millimetri prima del giudizio", () => {
  /* Chi ha Home Assistant in unità imperiali ha un pluviometro che scrive
   * `in`: zero virgola tre pollici sono sette millimetri e mezzo, cioè un giro
   * di irrigazione già fatto dal cielo. Confrontati con cinque senza
   * convertirli diventavano «asciutto», e sotto al meteo si leggeva «0,3 mm». */
  assert.equal(Math.round(inMillimetri(0.3, "in") * 10) / 10, 7.6);
  assert.equal(Math.round(inMillimetri(0.5, "in/h") * 10) / 10, 12.7);
  assert.equal(inMillimetri(4.2, "mm"), 4.2, "i millimetri restano quelli");
  assert.equal(inMillimetri(4.2, ""), 4.2, "e chi non dichiara l'unità scrive millimetri");
  assert.equal(inMillimetri("", "in"), null);

  const verdetto = verdettoDellaPioggia({ oggi: inMillimetri(0.3, "in") });
  assert.equal(verdetto.chiave, "bagnato");
  assert.equal(siPuoSaltare(verdetto), true);
});

test("il verdetto della pioggia ferma il programma, e il tasto a mano no", async () => {
  /* «Questo potrebbe integrarsi anche su gestione irrigazione»: prima la
   * pastiglia scriveva «terreno bagnato» e un istante dopo l'impianto partiva
   * lo stesso, perché il cancello guardava solo la previsione e il terreno. */
  const sezione = await readFile(
    new URL("../src/sections/pool-irrigation-scene-section.js", import.meta.url),
    "utf8",
  );
  assert.match(sezione, /function pioggiaDiOggi\(states\)/);
  assert.match(sezione, /const pioggia = pioggiaDiOggi\(allStates\(\)\);\s*\n\s*if \(siPuoSaltare\(pioggia\)\)/);
  /* Dentro `if (!force)`: il tasto che fa partire a mano passa comunque. */
  assert.match(sezione, /if \(!force\) \{[\s\S]{0,400}pioggiaDiOggi\(allStates\(\)\)/);
  /* E i millimetri si convertono prima, una volta sola per tutt'e due. */
  assert.match(sezione, /inMillimetri\(dalCielo\.intensita\?\.valore, dalCielo\.intensita\?\.unita\)/);
});
