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
  assert.match(
    sezione,
    /field\.dataset\.evPhotoEdited === "true"\) continue;/,
    "il pannello salta ancora i campi che qualcuno sta battendo",
  );
});

test("il segno di «scritto a mano» appartiene all'auto per cui e' stato battuto", () => {
  /* La protezione «questo campo l'ha battuto una persona» resisteva anche al
   * cambio di auto: aperta la seconda vettura, nel campo c'era ancora il
   * percorso della prima, e «Salva foto» glielo scriveva addosso. E' il «le
   * foto si mischiano» tornato dal campo.
   *
   * Il pannello adesso si porta scritto di chi sta parlando: cambiata l'auto,
   * i segni cadono e i campi dicono la sua — anche quello che ha il cursore
   * dentro, perche' e' cambiata la vettura sotto le dita. */
  assert.match(sezione, /const cambiata = panelNode\.dataset\.dmAutoFoto !== diChi;/);
  assert.match(sezione, /if \(cambiata\) delete field\.dataset\.evPhotoEdited;/);
  assert.match(sezione, /panelNode\.dataset\.dmAutoFoto = diChi;/);
  /* E il nome di quell'auto e' lo stesso a cui «Salva foto» scrivera': una
   * domanda, una risposta. */
  assert.match(
    sezione,
    /const posto = vehiclePhotoTargetIndex\(elencoDelPannello\);\s*const diChi = posto >= 0 \? uidDi\(elencoDelPannello\[posto\]\) : "";/,
  );
});

test("cambiare l'auto della scheda fa ridomandare a chi la racconta", () => {
  /* Chi cambia la risposta a «di quale auto stiamo parlando» deve anche far
   * ridisegnare quello che da quella risposta dipende. Se il promemoria sta
   * nei chiamanti, prima o poi uno se ne dimentica — ed e' stata la matita,
   * che apriva la seconda vettura lasciando il pannello delle foto sulla
   * prima. Sta nel posto dove la risposta cambia. */
  const setter = sezione.slice(
    sezione.indexOf("function setEditingKey"),
    sezione.indexOf("\n}", sezione.indexOf("function setEditingKey")),
  );
  assert.match(setter, /state\.evEditingUid = value;/);
  assert.match(setter, /scheduleEvSync/, "cambiare auto ridisegna la scheda");
  /* Riaprire la configurazione ricomincia dall'auto in uso: la seduta di
   * scrittura vive in memoria, e senza questo sopravviveva alla finestra che
   * il guscio ha gia' buttato via. */
  assert.match(
    sezione,
    /wrapFunction\("apriConfigEntita", "__dmEvSection_apriConfigEntita", \(\) => \{\s*setEditingKey\(null\);/,
  );
});
