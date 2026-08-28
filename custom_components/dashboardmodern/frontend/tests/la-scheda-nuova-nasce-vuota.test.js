/* «＋ Nuova auto» svuota tutto, foto comprese.
 *
 * Il gesto e' «riparto da zero», e la scheda si svuota in un punto solo: il
 * nome, le caselle delle entita', la marca, il modello. Le foto erano
 * l'eccezione: si contava che le ripulisse la passata che ridisegna il
 * pannello, riconoscendo dal titolo che l'auto di destinazione era cambiata.
 *
 * Quella passata arriva quasi sempre prima che uno se ne accorga — ma «quasi
 * sempre» non e' «sempre». Quando arrivava dopo, la scheda nuova restava
 * vestita con le foto dell'auto in uso, e «Salva foto» gliele riscriveva
 * addosso: il percorso battuto per la vettura che sta nascendo finiva su
 * un'altra.
 *
 * Sulla prova del browser questo si vedeva come un rosso ogni tanto, sempre
 * sullo stesso controllo e mai riproducibile a comando. Rieseguendo lo stesso
 * identico commit passava. Non era la prova a traballare: era questa corsa.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const sezione = readFileSync(join(SRC, "sections", "ev-section.js"), "utf8");

/* Il corpo del gesto: da dove si dichiara il tasto a dove si mette a fuoco il
 * nome, che e' l'ultima cosa che fa. */
function gesto() {
  const inizio = sezione.indexOf('aggiungi.dataset.evAddNew = "true"');
  const fine = sezione.indexOf("campo.focus();", inizio);
  assert.ok(inizio > 0 && fine > inizio, "il gesto «＋ Nuova auto» non si trova piu'");
  return sezione.slice(inizio, fine);
}

test("il gesto svuota anche le foto, nello stesso punto in cui svuota il resto", () => {
  const corpo = gesto();
  // Quello che gia' faceva: la scheda diventa una bozza e i campi si azzerano.
  assert.match(corpo, /setEditingKey\(""\)/);
  assert.match(corpo, /for \(const slot of contenitore\.querySelectorAll/);
  // E adesso anche le foto, qui, senza aspettare nessuno.
  assert.match(corpo, /\[data-ev-photos\]/, "il gesto non tocca il pannello delle foto");
  assert.match(corpo, /delete casella\.dataset\.evPhotoEdited/);
  assert.match(corpo, /if \(dentro\) dentro\.value = ""/);
  assert.match(corpo, /paintPhotoPreview\(casella\)/);
});

test("il segno di «scritto a mano» si toglie, altrimenti il campo resta immune", () => {
  /* Un campo con `evPhotoEdited` addosso viene saltato da ogni passata
   * successiva — e' la regola che protegge quello che si sta battendo. Se il
   * gesto non lo togliesse, la bozza si porterebbe dietro la protezione del
   * percorso vecchio e non si ripulirebbe piu'. */
  const corpo = gesto();
  const primaDelValore = corpo.indexOf("delete casella.dataset.evPhotoEdited");
  const valore = corpo.indexOf('dentro.value = ""');
  assert.ok(primaDelValore > 0 && valore > primaDelValore, "si toglie il segno prima di svuotare");
  // E la regola che salta i campi segnati e' ancora quella, nel pannello.
  assert.match(sezione, /if \(field\.dataset\.evPhotoEdited === "true"\) continue;/);
});
