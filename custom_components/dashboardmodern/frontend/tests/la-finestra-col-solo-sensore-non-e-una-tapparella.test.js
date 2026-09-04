/* La finestra col solo sensore non e' una tapparella (#299).
 *
 * «Nell'intestazione della finestra viene mostrata etichetta numero di
 * tapparelle anche se e' impostato solo sensore di contatto.» Il conto in cima
 * a ogni gruppo — piano, stanza — contava tutte le card, e una persiana a mano
 * col suo contatto leggeva «1 tapparella». Le tapparelle e le finestre si
 * contano a parte, e ognuna compare solo se c'e'.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { contoDelGruppo, paroleDelConto } from "../src/sections/shutter-scene-section.js";

test("il conto separa le tapparelle dalle finestre col solo sensore", () => {
  assert.deepEqual(contoDelGruppo([{ soloInfisso: true }]), { tapparelle: 0, finestre: 1 });
  assert.deepEqual(contoDelGruppo([{}, {}, { soloInfisso: true }]), { tapparelle: 2, finestre: 1 });
  assert.deepEqual(contoDelGruppo([]), { tapparelle: 0, finestre: 0 });
  assert.deepEqual(contoDelGruppo(null), { tapparelle: 0, finestre: 0 });
});

test("le parole dicono solo quello che c'e'", () => {
  assert.equal(paroleDelConto({ tapparelle: 0, finestre: 1 }), "1 finestra");
  assert.equal(paroleDelConto({ tapparelle: 1, finestre: 0 }), "1 tapparella");
  assert.equal(paroleDelConto({ tapparelle: 2, finestre: 2 }), "2 tapparelle · 2 finestre");
  assert.equal(paroleDelConto({ tapparelle: 0, finestre: 0 }), "");
  /* Chi passava ancora un numero secco ottiene quello che otteneva prima. */
  assert.equal(paroleDelConto(3), "3 tapparelle");
});

test("la griglia conta ogni gruppo con il conto separato", async () => {
  const source = await readFile(new URL("../src/sections/shutter-scene-section.js", import.meta.url), "utf8");
  assert.match(source, /groupMarkup\(view, contoDelGruppo\(views\.filter\(\(other\) => groupKey\(other\) === lastKey\)\)\)/);
  assert.match(source, /\$\{esc\(paroleDelConto\(conto\)\)\}/);
});
