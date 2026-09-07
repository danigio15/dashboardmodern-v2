/* «Vorrei fosse possibile con un flag magari di mesi dell'anno selezionare i
 * periodi in cui vengono mostrate le card di un clima, esempio: condizionatore
 * solo maggio-settembre, termosifoni ottobre-aprile.» (#365)
 *
 * A giugno la pagina del Clima mostra otto termosifoni che nessuno accenderà
 * per quattro mesi. Non è una configurazione sbagliata: è che metà di quello
 * che c'è scritto non riguarda oggi.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  chiSiVede,
  comeSiLeggeIlPeriodo,
  eDiStagione,
  iDodiciMesi,
  normalizzaIMesi,
} from "../src/core/stagione-del-clima.js";

const GENNAIO = new Date("2026-01-15T10:00:00");
const LUGLIO = new Date("2026-07-15T10:00:00");

test("l'intervallo che scavalca l'anno non è un caso particolare", () => {
  /* Ottobre-aprile è il primo intervallo che qualcuno scriverà: i mesi si
   * tengono come insieme, non come «da / a», così scavallare dicembre non è
   * nemmeno una domanda. */
  const termosifoni = [10, 11, 12, 1, 2, 3, 4];
  assert.equal(eDiStagione(termosifoni, GENNAIO), true);
  assert.equal(eDiStagione(termosifoni, LUGLIO), false);
  const condizionatore = [5, 6, 7, 8, 9];
  assert.equal(eDiStagione(condizionatore, LUGLIO), true);
  assert.equal(eDiStagione(condizionatore, GENNAIO), false);
});

test("chi non ha scelto niente è sempre di stagione", () => {
  // Chi non ha configurato niente vede quello che ha sempre visto.
  assert.equal(eDiStagione([], GENNAIO), true);
  assert.equal(eDiStagione(undefined, LUGLIO), true);
  assert.equal(eDiStagione("marzo", LUGLIO), true, "una scrittura storta non nasconde niente");
});

test("dodici mesi su dodici si scrivono come nessun mese", () => {
  assert.deepEqual(normalizzaIMesi([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), []);
  assert.deepEqual(normalizzaIMesi([9, 5, 5, 7]), [5, 7, 9], "ordinati e senza doppioni");
  assert.deepEqual(normalizzaIMesi([0, 13, "x", null]), [], "fuori scala non è un mese");
});

test("il periodo si legge come lo direbbe una persona", () => {
  assert.equal(comeSiLeggeIlPeriodo([5, 6, 7, 8, 9]), "Da maggio a settembre");
  // «a aprile» non si scrive: davanti a una vocale la a prende la d.
  assert.equal(comeSiLeggeIlPeriodo([10, 11, 12, 1, 2, 3, 4]), "Da ottobre ad aprile");
  assert.equal(comeSiLeggeIlPeriodo([1, 3, 7]), "gen · mar · lug", "sparsi, si elencano");
  assert.equal(comeSiLeggeIlPeriodo([]), "Tutto l'anno");
  assert.equal(comeSiLeggeIlPeriodo([10, 11, 12, 1, 2, 3, 4], "en"), "October to April");
});

test("un'unità accesa non si nasconde mai, per quanto sia fuori stagione", () => {
  /* È la differenza fra «non mi ingombra» e «non la posso più spegnere»: se il
   * condizionatore è rimasto acceso il primo di ottobre, quello è esattamente
   * il momento in cui serve vederlo. */
  const unita = [
    { entity: "climate.split", mesi: [5, 6, 7, 8, 9] },
    { entity: "climate.termo", mesi: [10, 11, 12, 1, 2, 3, 4] },
  ];
  const spente = chiSiVede(unita, { adesso: GENNAIO, accesa: () => false });
  assert.deepEqual(
    spente.dentro.map((voce) => voce.entity),
    ["climate.termo"],
  );
  assert.equal(spente.fuori.length, 1);

  const conLoSplitAcceso = chiSiVede(unita, {
    adesso: GENNAIO,
    accesa: (voce) => voce.entity === "climate.split",
  });
  assert.deepEqual(
    conLoSplitAcceso.dentro.map((voce) => voce.entity),
    ["climate.split", "climate.termo"],
  );
  assert.equal(conLoSplitAcceso.fuori.length, 0);
});

test("i dodici mesi escono pronti da disegnare", () => {
  const mesi = iDodiciMesi("it");
  assert.equal(mesi.length, 12);
  assert.deepEqual(mesi[0], { mese: 1, nome: "gennaio", sigla: "gen" });
  assert.equal(iDodiciMesi("en")[4].nome, "May");
});
