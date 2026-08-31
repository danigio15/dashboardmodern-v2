/* Le parole del popup dell'Auto, senza browser.
 *
 * «Poca analisi, l'ora di fine carica, e stati grezzi — lo stato C del
 * cavo». L'ora la si legge dal testo del guscio («2H 15M RIM.»), cosi' la
 * formula resta una sola; i codici IEC del cavo diventano parole in
 * qualunque dialetto arrivino.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  oraDiFineCarica,
  statoUmanoEV,
} from "../src/sections/il-popup-dell-auto-racconta-section.js";

test("l'ora di fine carica esce dal testo del guscio", () => {
  /* 08:00 in punto, ora locale: 2H 15M dopo sono le 10:15. */
  const otto = new Date(2026, 7, 31, 8, 0, 0).getTime();
  assert.equal(oraDiFineCarica("2H 15M RIM.", otto), "10:15");
  assert.equal(oraDiFineCarica("0H 5M RIM.", otto), "8:05");
});

test("senza un tempo leggibile, niente ora", () => {
  const adesso = new Date(2026, 7, 31, 8, 0, 0).getTime();
  for (const testo of ["IN ATTESA", "TARGET RAGGIUNTO", "CARICA COMPLETA", "", null])
    assert.equal(oraDiFineCarica(testo, adesso), "");
});

test("i codici del cavo diventano parole, in ogni dialetto", () => {
  assert.equal(statoUmanoEV("C"), "In carica");
  assert.equal(statoUmanoEV("c"), "In carica");
  assert.equal(statoUmanoEV("D"), "In carica");
  assert.equal(statoUmanoEV("charging_solar"), "In carica");
  assert.equal(statoUmanoEV("B"), "Collegata, in attesa");
  assert.equal(statoUmanoEV("wait_for_car"), "Collegata, in attesa");
  assert.equal(statoUmanoEV("A"), "Scollegata");
  assert.equal(statoUmanoEV("disconnected"), "Scollegata");
  assert.equal(statoUmanoEV("F"), "Errore");
});

test("quello che non si riconosce non si inventa", () => {
  assert.equal(statoUmanoEV("boh"), "");
  assert.equal(statoUmanoEV(""), "");
  assert.equal(statoUmanoEV("—"), "");
});
