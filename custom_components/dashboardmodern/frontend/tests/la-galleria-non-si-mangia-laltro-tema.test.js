/* Una passata della galleria non deve portarsi via l'altro tema.
 *
 * `capture-previews.mjs` scrive due gallerie nella stessa cartella: i file
 * `-light.webp` e quelli senza suffisso, che sono lo scuro. La regola vecchia
 * diceva «una passata intera puo' svuotare la cartella», e sembrava
 * ragionevole: se riempie tutto, cancellare prima e' pulizia.
 *
 * Solo che una passata senza `--theme` non riempie tutto: scrive solo i nomi
 * senza suffisso. I `-light` li cancellava e non li riscriveva, e la galleria
 * chiara spariva dalla cartella di lavoro senza che nessuno dicesse niente —
 * quaranta minuti di fotografie, e ce ne si accorge solo guardando i file
 * mancanti in git.
 *
 * Adesso si cancella per nome: chi scrive i `-light` toglie i `-light`, chi
 * scrive gli altri toglie gli altri. Questa prova tiene ferma quella regola,
 * perche' il modo sbagliato e' anche quello che verrebbe piu' naturale
 * riscrivere.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const script = readFileSync(new URL("../../../../scripts/capture-previews.mjs", import.meta.url), "utf8");

test("si cancella solo quello che questa passata riscrive", () => {
  /* La domanda che decide cosa e' «suo»: il suffisso del nome, non il fatto
   * che la passata sia intera. */
  assert.match(
    script,
    /const suo = \(nome\) =>\s*\(THEME === "light" \? nome\.endsWith\("-light\.webp"\) : !nome\.endsWith\("-light\.webp"\)\);/,
  );
  /* E la cancellazione passa da li'. */
  assert.match(script, /presenti\.filter\(suo\)/);
});

test("la cartella si svuota tutta solo se lo si chiede con --fresh", () => {
  const svuota = [...script.matchAll(/rm\(OUT_DIR, \{ recursive: true, force: true \}\)/g)];
  assert.equal(svuota.length, 1, "un solo posto puo' svuotare la cartella intera");
  /* E quel posto sta dietro `--fresh`: senza, una passata scura tornerebbe a
   * mangiarsi la galleria chiara. */
  const prima = script.slice(0, svuota[0].index);
  assert.match(prima.slice(-160), /KEEP === false && FRESH/);
});

test("una passata con --only non cancella niente", () => {
  /* Riempie qualche casella: cancellare per nome le toglierebbe tutte e ne
   * riscriverebbe una. */
  assert.match(script, /KEEP === false && ONLY\.length === 0/);
});
