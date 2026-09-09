/* «Cambia: non è più "Aggiungi tapparella" ma "aggiungi entità a Finestre".»
 *
 * La sezione si chiama Finestre e da un pezzo accetta molto più di una
 * tapparella: una finestra senza `cover`, una tenda, una tenda da sole, una
 * zanzariera, un contatto che dice solo aperto o chiuso. Il tasto però
 * continuava a dire «Aggiungi tapparella», ed è l'ultima cosa che si legge
 * prima di premere: chi ha una finestra e basta leggeva che lì dentro non
 * c'era posto per lei.
 *
 * La scritta sta nel guscio storico, che non si tocca a mano. La riscrive il
 * modulo, nella stessa passata che veste il resto della scheda: il tasto resta
 * il suo — stesso `onclick`, stesso `edTappAdd` — cambia solo quello che
 * dichiara di fare.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sezione = new URL("../src/sections/shutter-window-section.js", import.meta.url);
const guscio = new URL("../legacy/dashboard-runtime-it.js", import.meta.url);

test("il tasto dice che aggiunge un'entità a Finestre, non una tapparella", async () => {
  const source = await readFile(sezione, "utf8");
  assert.match(source, /function rinominaIlTastoAggiungi\(body\)/);
  assert.match(source, /t\("Aggiungi entità a Finestre", "Add an entity to Windows"\)/);
  /* Il ＋ resta: è il segno che quel tasto ha sempre avuto. */
  assert.match(source, /`＋ \$\{t\("Aggiungi entità a Finestre"/);
});

test("gira nella passata che veste già la scheda, non in un giro suo", async () => {
  const source = await readFile(sezione, "utf8");
  assert.match(
    source,
    /export function ensureContactField\(body = doc\?\.getElementById\("ed-body"\)\) \{\s*rinominaIlTastoAggiungi\(body\);/,
  );
  /* E non riscrive se non è cambiata: la passata gira a ogni ridisegno, e
   * toccare il documento per riscriverci la stessa cosa è la ventola accesa
   * per niente — questo deposito ne ha già inseguita una. */
  assert.match(source, /if \(tasto\.textContent === scritta\) return false;/);
});

test("il tasto che si rinomina è quello vero del guscio, e resta il suo", async () => {
  const [source, shell] = await Promise.all([readFile(sezione, "utf8"), readFile(guscio, "utf8")]);
  /* Il selettore non è inventato: è il markup che il guscio stampa davvero. Se
   * un giorno quel tasto cambiasse classe o gestore, questa prova lo dice —
   * altrimenti la scritta tornerebbe «Aggiungi tapparella» in silenzio. */
  assert.match(source, /\.ed-btn-add\[onclick\*='edTappAdd'\]/);
  assert.match(shell, /<button class="ed-btn-add"[^>]*onclick="edTappAdd\(\)"/);
  /* Si cambia la scritta, non il gesto: `edTappAdd` resta chi aggiunge. */
  assert.doesNotMatch(source, /tasto\.onclick\s*=/);
  assert.doesNotMatch(source, /tasto\.removeAttribute\("onclick"\)/);
});
