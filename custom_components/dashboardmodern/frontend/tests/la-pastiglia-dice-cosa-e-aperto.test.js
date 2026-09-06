/* «Tapparella aperta», «Tenda dispiegata», «Finestra aperta» (#353).
 *
 * Due cose insieme, e vengono dalla stessa segnalazione: la pastiglia diceva
 * «Aperta» senza dire di cosa — su una finestra che ha la tapparella, la tenda
 * e il contatto erano tre pastiglie identiche — e la spunta «percentuali
 * invertite» non girava lo stato dichiarato, ma solo la posizione.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { COVER_KINDS, INFISSO, coverStateLabel } from "../src/core/cover-kind.js";
import { posizioneSecondoVerso, statoSecondoVerso } from "../src/core/verso-aperture.js";

test("ogni copertura dice il proprio nome, e la tenda da sole si dispiega", () => {
  assert.equal(coverStateLabel("tapparella", "open"), "Tapparella aperta");
  assert.equal(coverStateLabel("tapparella", "closed"), "Tapparella chiusa");
  assert.equal(coverStateLabel("tapparella", "opening"), "Tapparella in apertura");
  assert.equal(coverStateLabel("tapparella", "closing"), "Tapparella in chiusura");
  assert.equal(coverStateLabel("tenda", "open"), "Tenda aperta");
  assert.equal(coverStateLabel("tenda", "closed"), "Tenda chiusa");
  /* Una tenda da sole non si «apre»: si dispiega, e rientra. */
  assert.equal(coverStateLabel("tenda_sole", "open"), "Tenda dispiegata");
  assert.equal(coverStateLabel("tenda_sole", "closed"), "Tenda ritratta");
  assert.equal(coverStateLabel(INFISSO, "open"), "Finestra aperta");
  assert.equal(coverStateLabel(INFISSO, "closed"), "Finestra chiusa");
});

test("in inglese le stesse quattro cose", () => {
  assert.equal(coverStateLabel("tapparella", "open", "en"), "Shutter open");
  assert.equal(coverStateLabel("tenda", "closed", "en"), "Curtain closed");
  assert.equal(coverStateLabel("tenda_sole", "open", "en"), "Awning out");
  assert.equal(coverStateLabel(INFISSO, "open", "en"), "Window open");
});

test("uno stato che non si sa non si racconta, e il tipo mancante e' una tapparella", () => {
  assert.equal(coverStateLabel("tapparella", "unknown"), "");
  assert.equal(coverStateLabel("tapparella", ""), "");
  assert.equal(coverStateLabel(INFISSO, "unavailable"), "");
  /* Una finestra senza contatto non ha uno stato «in apertura»: un infisso non
   * si muove da solo, e inventargli un movimento sarebbe raccontarlo. */
  assert.equal(coverStateLabel(INFISSO, "opening"), "");
  /* Senza tipo si parla di una tapparella, che e' cio' che la sezione disegna
   * quando Home Assistant non dice altro. */
  assert.equal(coverStateLabel("", "open"), "Tapparella aperta");
  assert.equal(coverStateLabel("boh", "open"), "Tapparella aperta");
  assert.equal(COVER_KINDS[0], "tapparella");
});

test("il verso girato scambia aperto e chiuso, e i due versi del movimento", () => {
  assert.equal(statoSecondoVerso("open", true), "closed");
  assert.equal(statoSecondoVerso("closed", true), "open");
  assert.equal(statoSecondoVerso("opening", true), "closing");
  assert.equal(statoSecondoVerso("closing", true), "opening");
  /* Senza spunta non cambia niente, tranne la forma: minuscolo, come lo legge
   * chi disegna. */
  assert.equal(statoSecondoVerso("Open", false), "open");
  assert.equal(statoSecondoVerso("open", false), "open");
});

test("quello che non si sa resta quello che non si sa", () => {
  for (const stato of ["unknown", "unavailable", "", null, undefined]) {
    assert.equal(statoSecondoVerso(stato, true), String(stato ?? "").trim().toLowerCase());
  }
});

/* La tapparella della segnalazione: montata al contrario e senza
 * `current_position`. Prima la spunta non toccava niente — la parola restava
 * «open», e da «open» il cursore ricava il suo cento per cento. */
test("la tapparella girata che non pubblica la posizione ora segue la spunta", () => {
  const stato = statoSecondoVerso("open", true);
  assert.equal(stato, "closed");
  assert.equal(coverStateLabel("tapparella", stato), "Tapparella chiusa");
  /* Senza posizione il cursore la ricava dalla parola: 0 = chiusa. */
  const posizione = stato === "open" ? 100 : 0;
  assert.equal(posizione, 0);
  /* E dove la posizione c'e', le due strade portano allo stesso posto. */
  assert.equal(posizioneSecondoVerso(100, true), 0);
});
