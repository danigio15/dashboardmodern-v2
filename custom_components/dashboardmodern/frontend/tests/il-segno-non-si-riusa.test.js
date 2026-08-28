/* Un identificativo non si riusa mai.
 *
 * Chi cancella l'ultimo impianto e ne aggiunge un altro non deve ritrovarsi lo
 * stesso id: se lo ritrovasse, il nuovo erediterebbe in silenzio i carichi e la
 * tariffa di quello cancellato. Per le auto vale uguale, con le foto.
 *
 * La regola era scritta due volte, con lo stesso nome, in due moduli che non si
 * parlano. Adesso e' scritta una volta, e questa prova la guarda da tutte e tre
 * le parti: la regola per conto suo, gli impianti, le auto.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { prossimoIdentificativo, segnoPiuAlto } from "../src/core/segno-progressivo.js";
import { PRIMO_IMPIANTO, altoSegnoImpianti, nuovoImpiantoId } from "../src/core/energy-plants.js";
import { altoSegnoVeicoli, nuovoVeicoloId } from "../src/core/vehicle-model.js";

const impianti = (...id) => id.map((valore) => ({ id: valore }));
const auto = (...uid) => uid.map((valore) => ({ uid: valore }));

test("il segno tiene conto anche di chi non c'e' piu'", () => {
  const richiesta = {
    elenco: [{ id: "casa-2" }],
    metadata: { seq: 5 },
    prefisso: "casa",
    campoSegno: "seq",
    minimo: 1,
  };
  assert.equal(segnoPiuAlto(richiesta), 5);
  assert.equal(prossimoIdentificativo(richiesta), "casa-6");
});

test("senza segno scritto vale il piu' alto fra quelli vivi", () => {
  assert.equal(segnoPiuAlto({ elenco: [{ id: "casa-4" }, { id: "casa-2" }], prefisso: "casa" }), 4);
});

test("un elenco vuoto non scende sotto il minimo", () => {
  assert.equal(segnoPiuAlto({ prefisso: "casa", minimo: 1 }), 1);
  assert.equal(segnoPiuAlto({ prefisso: "auto", minimo: 0 }), 0);
});

test("roba storta non fa saltare il conto", () => {
  const strana = {
    elenco: [null, { id: "casa" }, { id: "casa-x" }, { id: "altro-9" }],
    metadata: "non un oggetto",
    prefisso: "casa",
    minimo: 1,
  };
  assert.equal(segnoPiuAlto(strana), 1);
});

test("gli impianti partono da uno e non riusano l'id di chi e' stato cancellato", () => {
  assert.equal(altoSegnoImpianti([], {}), 1);
  assert.equal(nuovoImpiantoId([], {}), `${PRIMO_IMPIANTO}-2`);
  // Cancellato il terzo, il segno resta scritto: il prossimo e' il quarto.
  assert.equal(
    nuovoImpiantoId(impianti(PRIMO_IMPIANTO, `${PRIMO_IMPIANTO}-2`), { plant_seq: 3 }),
    `${PRIMO_IMPIANTO}-4`,
  );
});

test("le auto partono da zero e non riusano l'uid di chi e' stata cancellata", () => {
  assert.equal(altoSegnoVeicoli([], {}), 0);
  assert.equal(nuovoVeicoloId([], {}), "auto-1");
  assert.equal(nuovoVeicoloId(auto("auto-1"), { vehicle_seq: 3 }), "auto-4");
});
