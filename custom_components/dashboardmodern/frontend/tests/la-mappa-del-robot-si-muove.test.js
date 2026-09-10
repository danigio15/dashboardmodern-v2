/* «Nella mappa il robot non si muove» (#456).
 *
 * La mappa si ridisegnava quando cambiava `entity_picture`, e il commento
 * diceva che quell'indirizzo cambia a ogni aggiornamento. Per una parte delle
 * integrazioni è vero; per le altre no, ed è la segnalazione.
 *
 * Su Valetudo, su Roborock e sui derivati del Xiaomi map card la mappa è una
 * TELECAMERA, e l'indirizzo di una telecamera porta un gettone che cambia
 * quando scade il gettone — non quando cambia il disegno. Il disegno cambia
 * dieci volte al minuto e l'indirizzo resta identico per un'ora: fidarsi
 * dell'indirizzo vuol dire guardare la fotografia del momento in cui si è
 * aperta la pagina, per tutto il tempo in cui il robot pulisce. Che è
 * esattamente il momento in cui la mappa serve.
 *
 * La correzione non aggiunge un timer: il giro di disegno della pagina passa
 * di lì ogni tre secondi da sempre, e basta non dirgli di no mentre il robot
 * gira. Il battito muore da solo quando il robot si ferma o quando la pagina
 * non è quella guardata — la stessa disciplina delle telecamere.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const sezione = await readFile(new URL("../src/sections/robot-section.js", import.meta.url), "utf8");

test("mentre il robot gira la mappa si richiede a tempo, non solo se cambia indirizzo", () => {
  assert.match(sezione, /const inMoto = Boolean\(view\.cleaning \|\| view\.mowing\)/);
  assert.match(sezione, /const scaduta =\s*inMoto &&/);
  assert.match(sezione, /if \(gia && !scaduta\) return;/);
});

test("fermo resta la regola di prima: niente richieste inutili", () => {
  /* `scaduta` può essere vera solo con `inMoto`: a robot fermo il disegno non
   * cambia, e richiederlo vorrebbe dire far lavorare Home Assistant per
   * niente — che è la ragione per cui la regola esisteva. */
  const riga = sezione.match(/const scaduta =[^;]+;/)[0];
  assert.match(riga, /^const scaduta =\s*inMoto &&/);
});

test("il passo è un giro sì e uno no, non ogni beat", () => {
  const passo = Number(sezione.match(/const MAPPA_OGNI_MS = (\d+);/)[1]);
  assert.ok(passo >= 3000, "più fitto del giro di disegno non servirebbe a niente");
  assert.ok(passo <= 10_000, "più lento e il robot fa mezza stanza fra un disegno e l'altro");
});

test("senza gettone non si gira a vuoto a ogni beat", () => {
  /* Per indirizzo la mappa non si può rinfrescare — riscrivere la stessa
   * `src` non fa succedere niente — e cambiarlo romperebbe la firma del
   * gettone. Lì la regola di prima resta, e si esce subito. */
  assert.match(sezione, /if \(gia && !conGettone\) return;/);
});

test("il momento si segna prima della risposta, non dopo", () => {
  /* Una richiesta che fallisce non deve tornare al beat dopo: su una rete
   * lenta si accoderebbero. */
  const dentro = sezione.slice(sezione.indexOf("if (conGettone) {"));
  /* La chiave e' quella della MAPPA, non del robot: da #468 un robot puo'
   * averne piu' d'una, e il momento dell'ultima richiesta e' di ognuna. */
  const segna = dentro.indexOf("mappeChieste.set(chiave, Date.now())");
  const chiede = dentro.indexOf("await root.fetch(picture");
  assert.ok(segna > 0 && chiede > 0);
  assert.ok(segna < chiede, "il momento si segna prima di chiedere");
});

test("niente timer nuovo: il battito è quello del disegno", () => {
  assert.doesNotMatch(sezione, /setInterval/);
});

/* ── quello che la revisione della #481 ha trovato ─────────────────────── */

test("una mappa che arriva quando non è più quella guardata se ne va in silenzio", () => {
  /* Le due mappe di un robot condividono lo stesso riquadro: chi tocca la
   * linguetta mentre il disegno di prima è ancora per strada se lo vedeva
   * arrivare sopra quello giusto — e il suo `onload` metteva a memoria
   * «pronta» sotto il nome sbagliato, così i giri successivi accettavano il
   * disegno scambiato per sempre. */
  assert.match(sezione, /image\.dataset\.dmMappa = chiave;/);
  assert.match(sezione, /const suaAncora = \(\) => image\.dataset\.dmMappa === chiave;/);
  /* Il controllo sta in tutt'e quattro i punti in cui si scrive qualcosa. */
  const quante = (sezione.match(/suaAncora\(\)/g) || []).length;
  assert.ok(quante >= 4, `il controllo si fa in ogni ritorno, non solo in uno (${quante})`);
  /* E il disegno inutile non resta in memoria. */
  assert.match(sezione, /revokeObjectURL\?\.\(objectUrl\)/);
});
