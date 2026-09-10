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
