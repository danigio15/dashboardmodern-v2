/* Le valvole TRV dicono quanto sono aperte (#300).
 *
 * «Nella sezione riscaldamento dare la possibilita' di inserire valvole TRV
 * mostrando percentuale apertura e percentuale chiusura valvola.» La valvola
 * e' dell'unita' clima: una casella in piu' nella sua scheda, e sulla card la
 * riga che dice quanto e' aperta e quanto chiusa — dall'entita' scelta, o
 * dagli attributi che l'unita' porta gia'.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  ATTRIBUTI_VALVOLA,
  CAMPO_VALVOLA,
  aperturaDaStato,
  aperturaDagliAttributi,
  letturaValvola,
  percentuale,
} from "../src/core/valvola-trv.js";

const leggi = (percorso) => readFile(new URL(`../src/${percorso}`, import.meta.url), "utf8");

test("una percentuale da 0 a 100, da un numero o da una parola", () => {
  assert.equal(percentuale("62"), 62);
  assert.equal(percentuale(62.4), 62);
  assert.equal(percentuale("62 %"), 62);
  assert.equal(percentuale("140"), 100);
  assert.equal(percentuale("-3"), 0);
  assert.equal(percentuale("open"), 100);
  assert.equal(percentuale("Chiusa"), 0);
  assert.equal(percentuale("unavailable"), null);
  assert.equal(percentuale(""), null);
  assert.equal(percentuale("boh"), null);
  assert.equal(CAMPO_VALVOLA, "valvola");
});

test("la valvola si legge dall'entita' a parte, o dagli attributi dell'unita'", () => {
  assert.equal(aperturaDaStato({ state: "35" }), 35);
  assert.equal(aperturaDaStato(null), null);
  assert.equal(ATTRIBUTI_VALVOLA[0], "valve_position");
  assert.equal(aperturaDagliAttributi({ valve_position: 40, pi_heating_demand: 90 }), 40);
  assert.equal(aperturaDagliAttributi({ pi_heating_demand: "90" }), 90);
  assert.equal(aperturaDagliAttributi({ position: "unknown", heating_demand: 12 }), 12);
  assert.equal(aperturaDagliAttributi({ temperature: 21 }), null);
  assert.equal(aperturaDagliAttributi(null), null);
  /* L'entita' scelta vince sull'attributo; senza niente, niente riga. */
  assert.deepEqual(letturaValvola({ stato: { state: "30" }, attributi: { valve_position: 80 } }), { aperta: 30, chiusa: 70 });
  assert.deepEqual(letturaValvola({ stato: null, attributi: { valve_position: 80 } }), { aperta: 80, chiusa: 20 });
  assert.deepEqual(letturaValvola({ stato: { state: "unavailable" }, attributi: { valve_position: 25 } }), { aperta: 25, chiusa: 75 });
  assert.equal(letturaValvola({}), null);
  assert.equal(letturaValvola(), null);
});

test("la valvola resta nell'unita' quando la si normalizza, e la card la disegna", async () => {
  const modello = await leggi("core/device-model.js");
  assert.match(modello, /if \(section === "climate"\) \{[\s\S]{0,400}if \(input\.valvola\) base\.valvola = String\(input\.valvola\);/);
  const clima = await leggi("sections/climate-thermal-section.js");
  assert.match(clima, /valvola: clean\(unit\?\.valvola\),/);
  assert.match(clima, /data-dm-cl-valvola hidden/);
  assert.match(clima, /function paintValvola\(card, unit, reading\)/);
  assert.match(clima, /letturaValvola\(\{\s*stato: unit\.valvola \? resolvedState\(unit\.valvola, allStates\(\)\) : null,\s*attributi: reading\?\.attributi,/);
  /* Il cambio di valvola rifa' la card: sta nella firma. */
  assert.match(clima, /unit\.zone, unit\.valvola \|\| ""\]/);
});

test("la casella sta nelle due schede dell'unita': il form del guscio e la matita", async () => {
  const trv = await leggi("sections/trv-editor-section.js");
  assert.match(trv, /const CAMPO_ID = "ed-cl-valvola";/);
  assert.match(trv, /root\.edAddClima = conValvola;/);
  assert.match(trv, /lista\[lista\.length - 1\] = \{ \.\.\.lista\[lista\.length - 1\], valvola \};/);
  const matita = await leggi("sections/unified-editors-section.js");
  assert.match(matita, /name="valvola"/);
  assert.match(matita, /valvola: clean\(form\.elements\.valvola\?\.value\),/);
  const runtime = await leggi("sections/section-runtime.js");
  const rapido = runtime.indexOf("installQuickClimateEditorSection();");
  const trvInstall = runtime.indexOf("installTrvEditor();");
  assert.ok(rapido > 0 && trvInstall > rapido, "la valvola si aggancia dopo il tasto rapido");
  assert.match(runtime, /"trv-editor",/);
});
