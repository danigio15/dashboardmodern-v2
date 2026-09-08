/* «Per cortesia mi organizzi le sezioni del config con criterio.»
 * «Dove posso inserire i binary sensor di porte e finestre? Non trovo più la
 *  sezione dove inserirli.» (#399)
 *
 * L'interruttore di ogni sezione stava dentro la scheda di quella sezione: per
 * sapere quali sezioni esistono bisognava aprirle tutte, e per sapere quali
 * erano accese anche. Ventiquattro schede da aprire per rispondere a «cosa
 * c'è», che è la domanda che si fa per prima.
 *
 * Queste prove tengono ferme le tre cose su cui poggia l'elenco: che non perde
 * nessuna sezione, che una spenta si distingue da una mai toccata, e che il
 * raggruppamento è LO STESSO delle linguette — altrimenti sono due mappe della
 * stessa casa disegnate da due persone che non si sono parlate.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { famigliaDellaScheda } from "../src/core/alberatura-del-config.js";
import {
  CHIAVI_PER_SCHEDA,
  SEZIONI,
  quanteAccese,
  sezioneAccesa,
  sezioneDellaScheda,
  sezioniPerFamiglia,
} from "../src/core/lelenco-delle-sezioni.js";

test("ogni sezione ha una scheda, una chiave e un nome in due lingue", () => {
  for (const voce of SEZIONI) {
    assert.ok(voce.scheda, "senza scheda non si raggiunge");
    assert.ok(voce.chiave, "senza chiave l'interruttore non scrive niente");
    assert.ok(voce.glifo, `${voce.scheda}: manca il glifo`);
    assert.ok(voce.it && voce.en, `${voce.scheda}: manca un nome`);
  }
  /* Due sezioni non possono condividere né la scheda né la chiave: la prima
   * vorrebbe dire due elenchi sulla stessa pagina, la seconda un interruttore
   * che ne spegne due. */
  assert.equal(new Set(SEZIONI.map((voce) => voce.scheda)).size, SEZIONI.length);
  assert.equal(new Set(SEZIONI.map((voce) => voce.chiave)).size, SEZIONI.length);
});

test("la scheda e la chiave restano due cose distinte", () => {
  /* «sez3» è dove si configura, «boiler» è cosa si accende. Nessuna delle due
   * si può inventare: la scheda la conoscono le prove e i collegamenti
   * salvati, la chiave la legge il guscio in `cd_sections`. */
  assert.equal(CHIAVI_PER_SCHEDA.sez3, "boiler");
  assert.equal(CHIAVI_PER_SCHEDA.sez6, "server");
  assert.equal(CHIAVI_PER_SCHEDA.agenda, "calendario");
  assert.equal(CHIAVI_PER_SCHEDA.doors, "porte");
  assert.equal(sezioneDellaScheda("varchi").chiave, "varchi");
  assert.equal(sezioneDellaScheda("non-esiste"), null);
});

test("quello che nessuno ha mai toccato è acceso", () => {
  /* Il guscio scrive `false` per nascondere e non scrive niente per mostrare.
   * Una sezione nuova deve comparire a chi aggiorna, non restare spenta in
   * attesa che qualcuno la scopra. */
  assert.equal(sezioneAccesa({}, "varchi"), true);
  assert.equal(sezioneAccesa(undefined, "varchi"), true);
  assert.equal(sezioneAccesa({ varchi: false }, "varchi"), false);
  assert.equal(sezioneAccesa({ varchi: true }, "varchi"), true);
  /* E il conto in cima dice la stessa cosa. */
  assert.deepEqual(quanteAccese({}), { accese: SEZIONI.length, tutte: SEZIONI.length });
  assert.deepEqual(quanteAccese({ varchi: false, home: false }), {
    accese: SEZIONI.length - 2,
    tutte: SEZIONI.length,
  });
});

test("l'elenco non perde nessuna sezione lungo la strada", () => {
  const dentro = sezioniPerFamiglia(SEZIONI).flatMap((famiglia) => famiglia.sezioni);
  assert.equal(dentro.length, SEZIONI.length);
  assert.deepEqual(
    dentro.map((voce) => voce.scheda).sort(),
    SEZIONI.map((voce) => voce.scheda).sort(),
  );
});

test("il raggruppamento è lo stesso delle linguette del Config", () => {
  /* Chi guarda l'elenco e poi apre il Config deve ritrovare le stesse insegne
   * nello stesso ordine. La famiglia non la decide questo modulo: gliela dice
   * l'alberatura, dalla scheda. */
  for (const famiglia of sezioniPerFamiglia(SEZIONI))
    for (const voce of famiglia.sezioni)
      assert.equal(famigliaDellaScheda(voce.scheda), famiglia.chiave);
  /* I varchi — la sezione che in #399 non si trovava — stanno con la
   * Sicurezza, dove uno li cerca. */
  assert.equal(famigliaDellaScheda("varchi"), "sicurezza");
});

test("una famiglia senza sezioni non si disegna", () => {
  const poche = sezioniPerFamiglia(SEZIONI.filter((voce) => voce.scheda === "sez6"));
  assert.deepEqual(
    poche.map((famiglia) => famiglia.chiave),
    ["macchine"],
  );
  assert.deepEqual(sezioniPerFamiglia([]), []);
});

test("la mappa scheda→chiave è una sola per tutto il progetto", () => {
  /* La fascia dentro ogni scheda la usava per conto suo. Due copie vogliono
   * dire che prima o poi una impara una sezione nuova e l'altra no — è già
   * successo, ed è per questo che la mappa sta nel core. */
  return import("../src/sections/config-uniformity-section.js").then((modulo) => {
    assert.equal(modulo.TAB_SECTION_KEYS, CHIAVI_PER_SCHEDA);
  });
});
