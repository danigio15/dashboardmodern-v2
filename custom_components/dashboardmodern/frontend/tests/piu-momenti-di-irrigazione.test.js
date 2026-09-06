/* Piu' momenti di irrigazione nella stessa giornata (#325).
 *
 * «Una alle 05:30 del mattino e alle 20:30, se la % del sensore umidita'
 * terreno e' inferiore ad una certa % parte una seconda irrigazione di tot
 * minuti definiti dall'utente. Se invece la % e' superiore viene saltata.»
 *
 * Il conto sta tutto in `core/irrigazione-orari.js` e si prova a secco: qui
 * non c'e' orologio di sistema, l'ora entra come minuti dalla mezzanotte. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  CHIAVE_PRINCIPALE,
  elencoDegliOrari,
  minutiAlProssimo,
  minutiDelGiorno,
  orariDelProgramma,
  orarioDaAvviare,
} from "../src/core/irrigazione-orari.js";

const moduleUrl = new URL("../src/sections/pool-irrigation-scene-section.js", import.meta.url);
const ORE = (ora, minuti = 0) => ora * 60 + minuti;
const OGGI = "Sat Sep 06 2026";

test("gli orari: il primo e' quello del runtime, gli altri in fila e senza doppioni", () => {
  const orari = orariDelProgramma({
    time: "05:30",
    orari: [
      { ora: "20:30", minuti: 12, seSottoA: 40 },
      { ora: "20:30", minuti: 99 },
      { ora: "13:00" },
      { ora: "mezzogiorno" },
      { ora: "24:10" },
    ],
  });
  assert.deepEqual(elencoDegliOrari(orari), ["05:30", "13:00", "20:30"]);
  assert.equal(orari[0].principale, true);
  assert.equal(orari[0].chiave, CHIAVE_PRINCIPALE);
  assert.equal(orari[0].minuti, null, "il primo orario lascia i minuti alle zone");
  const sera = orari.at(-1);
  assert.deepEqual([sera.minuti, sera.seSottoA, sera.chiave, sera.principale], [12, 40, "20:30", false]);
  // Senza niente scritto resta l'orario di sempre del runtime.
  assert.deepEqual(elencoDegliOrari(orariDelProgramma({})), ["06:30"]);
  // Mezzanotte vale: zero minuti non e' «non e' un'ora».
  assert.equal(minutiDelGiorno("00:00"), 0);
  assert.equal(minutiDelGiorno("7:5"), null);
});

test("i valori scritti male non passano: minuti e percentuali stanno nella loro forbice", () => {
  const [, riga] = orariDelProgramma({
    orari: [{ ora: "20:30", minuti: 999, seSottoA: 140 }],
  });
  assert.equal(riga.minuti, 480);
  assert.equal(riga.seSottoA, 100);
  const [, zero] = orariDelProgramma({ orari: [{ ora: "20:30", minuti: 0, seSottoA: "" }] });
  assert.equal(zero.minuti, null, "zero minuti non e' una corsa");
  assert.equal(zero.seSottoA, null, "vuoto non e' zero per cento");
});

test("tocca alle 20:30 solo dentro la finestra, e una volta sola", () => {
  const orari = orariDelProgramma({ time: "05:30", orari: [{ ora: "20:30", minuti: 12 }] });
  const chiedi = (adesso, corse = {}) =>
    orarioDaAvviare({ orari, adesso, giorno: OGGI, corse, umidita: null });

  assert.equal(chiedi(ORE(20, 29)), null, "prima dell'ora non parte niente");
  assert.equal(chiedi(ORE(20, 30)).esito, "avvia");
  assert.equal(chiedi(ORE(20, 39)).esito, "avvia", "la scheda che si sveglia in ritardo recupera");
  assert.equal(chiedi(ORE(20, 41)), null, "a finestra chiusa non si annaffia di notte");
  assert.equal(chiedi(ORE(20, 35), { "20:30": OGGI }), null, "gia' fatto oggi");
  // La giornata di ieri non vale: domani si riparte.
  assert.equal(chiedi(ORE(20, 35), { "20:30": "Fri Sep 05 2026" }).esito, "avvia");
  // E il primo orario ha la sua chiave, quella che il runtime scrive da sempre.
  assert.equal(chiedi(ORE(5, 31), { [CHIAVE_PRINCIPALE]: OGGI }), null);
  assert.equal(chiedi(ORE(5, 31)).orario.principale, true);
});

test("col terreno bagnato la seconda corsa salta, con l'asciutto parte", () => {
  const orari = orariDelProgramma({ orari: [{ ora: "20:30", minuti: 12, seSottoA: 40 }] });
  const chiedi = (umidita) =>
    orarioDaAvviare({ orari, adesso: ORE(20, 31), giorno: OGGI, corse: {}, umidita });

  assert.equal(chiedi(55).esito, "terreno-bagnato");
  assert.equal(chiedi(55).lettura, 55);
  assert.equal(chiedi(40).esito, "terreno-bagnato", "uguale alla soglia e' gia' bagnato");
  assert.equal(chiedi(20).esito, "avvia");
  // Sensore muto: si aspetta, senza bruciare la giornata — puo' rispondere
  // ancora dentro la finestra.
  assert.equal(chiedi(null).esito, "senza-lettura");
});

test("quanto si puo' dormire prima del prossimo momento", () => {
  const orari = orariDelProgramma({ time: "05:30", orari: [{ ora: "20:30" }] });
  assert.equal(minutiAlProssimo(orari, ORE(4, 30)), 60);
  assert.equal(minutiAlProssimo(orari, ORE(20, 30)), 0);
  // Passata l'ultima corsa si guarda alla prima di domani.
  assert.equal(minutiAlProssimo(orari, ORE(21, 0)), ORE(24) - ORE(21) + ORE(5, 30));
  assert.equal(minutiAlProssimo([], ORE(9)), null);
});

test("la sezione: un padrone solo per la durata, e le chiavi-giorno separate", async () => {
  const source = await readFile(moduleUrl, "utf8");
  /* La durata dell'orario si impone dove il runtime la scrive, subito dopo di
   * lui: `CD_IRR.until` resta suo, il conto lo corregge chi ha fatto partire
   * la corsa. */
  assert.match(source, /function installDurationOwner\(\)/);
  assert.match(source, /__dmIrrDurata/);
  assert.match(source, /root\.cdIrrNext = conLaDurata/);
  assert.match(source, /runtime\.until = Date\.now\(\) \+ minuti \* 60000/);
  /* Fermare a mano chiude anche la durata imposta. */
  assert.match(source, /root\.cdIrrStopAll = conLoStop/);
  /* Il primo orario condivide la chiave-giorno del runtime: chi arriva secondo
   * trova il posto occupato e non fa partire l'acqua due volte. */
  assert.match(source, /const RUNTIME_RUN_KEY = "cd_irr_lastrun"/);
  assert.match(source, /const ORARI_RUN_KEY = "cd_irr_orari_lastrun"/);
  /* La sveglia dorme fino al momento buono, non un intervallo fisso. */
  assert.match(source, /function attesaProssima\(\)/);
  assert.match(source, /minutiAlProssimo\(orariDelProgramma\(config\), minutiAdesso\(\)\)/);
  /* Si passa dal cancello di sempre: pioggia e terreno fermano anche questa. */
  assert.match(source, /root\.cdIrrProgram\?\.\(false\);/);
});

test("l'editor: una riga per orario, con i suoi minuti e la sua soglia", async () => {
  const source = await readFile(moduleUrl, "utf8");
  for (const campo of ['data-campo="ora"', 'data-campo="minuti"', 'data-campo="seSottoA"'])
    assert.ok(source.includes(campo), campo);
  assert.match(source, /data-dm-irr-ora-piu/);
  assert.match(source, /data-dm-irr-ora-via/);
  /* Le righe si salvano MENTRE si scrivono, non quando si cambia campo: chi
   * riempie l'ultima casella e chiude l'editor non perde quello che ha messo
   * (`change` arriva solo al cambio di fuoco). */
  assert.match(source, /writeJsonIfChanged\("cd_irrigazione", next\)/);
  assert.match(source, /for \(const evento of \["input", "change"\]\)/);
  /* E il ridisegno non porta via il cursore da sotto le dita. */
  assert.match(source, /doc\.activeElement !== campo/);
});
