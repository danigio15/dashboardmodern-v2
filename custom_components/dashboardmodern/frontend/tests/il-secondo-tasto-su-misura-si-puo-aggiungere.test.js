/* «Non fa inserire altri tasti oltre al primo» (#431).
 *
 * I tasti d'inserimento su misura stanno in un blocco appeso alla scheda
 * Sicurezza. Aggiungerne uno salva; salvare rifà la scheda; e il blocco se ne
 * andava con lei — il secondo «＋» non c'era più da premere.
 *
 * Il blocco delle modalità, che nasce due righe sopra e ha lo stesso problema,
 * se l'era risolto per conto suo con un osservatore sul corpo della scheda. Una
 * metà della stessa fila sapeva rimettersi in piedi e l'altra no: adesso la
 * meccanica è una sola e la usano tutte e due.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const leggi = (rel) => readFile(new URL(rel, import.meta.url), "utf8");

test("la meccanica per restare appesi alla scheda sta in un posto solo", async () => {
  const condiviso = await leggi("../src/sections/shared.js");
  assert.match(condiviso, /export function tieniIlBloccoNellaScheda\(marker, disegna\)/);
  const regola = condiviso.slice(
    condiviso.indexOf("export function tieniIlBloccoNellaScheda"),
    condiviso.indexOf("export function selectedPeriod()"),
  );
  /* Le tre cose che servono: l'annuncio di casa, l'osservatore sul corpo — che
   * è l'unico segnale che vuol dire davvero «la scheda è nuova» — e il primo
   * clic, quando il corpo può non esserci ancora. */
  assert.match(regola, /onEditorRedraw\(marker, richiama\)/);
  assert.match(regola, /new root\.MutationObserver/);
  assert.match(regola, /observe\(corpo, \{ childList: true \}\)/);
  assert.match(regola, /doc\?\.addEventListener\?\.\(\s*"click"/);
  /* L'osservatore si riattacca al corpo di ADESSO: la finestra si apre e si
   * chiude, e ogni volta il corpo è un altro. */
  assert.match(regola, /suo\?\.corpo === corpo\) return/);
  assert.match(regola, /suo\?\.osservatore\?\.disconnect\?\.\(\)/);
});

test("i due blocchi della scheda Sicurezza la usano tutti e due", async () => {
  const suMisura = await leggi("../src/sections/antifurto-su-misura-editor-section.js");
  const modalita = await leggi("../src/sections/alarm-modes-editor-section.js");
  assert.match(suMisura, /tieniIlBloccoNellaScheda\("dmAntifurtoSuMisura", ensureAntifurtoSuMisuraBlock\)/);
  assert.match(modalita, /tieniIlBloccoNellaScheda\("dmAlarmModes", ensureAlarmModesBlock\)/);
  /* E nessuno dei due si tiene più una copia sua della meccanica: due copie
   * sono il modo in cui una delle due invecchia — è appena successo. */
  assert.doesNotMatch(modalita, /new root\.MutationObserver/);
  assert.doesNotMatch(suMisura, /new root\.MutationObserver/);
  assert.doesNotMatch(modalita, /function onTabClick/);
});

test("aggiungere un tasto lascia il blocco al suo posto", async () => {
  const suMisura = await leggi("../src/sections/antifurto-su-misura-editor-section.js");
  /* Il «＋» aggiunge una riga vuota e salva: la riga vuota deve restare, o non
   * ci sarebbe modo di compilarla. Chi legge per disegnare la fila la scarta. */
  assert.match(suMisura, /salva\(\[\.\.\.grezze\(\), \{ icona: ICONA_DI_SERIE \}\]\)/);
  /* E il disegno riparte dalla firma azzerata, sennò il blocco resta com'era. */
  assert.match(suMisura, /delete blocco\.dataset\.firma/);
});
