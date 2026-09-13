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

/* Una finestra col solo contatto: aperta o chiusa. */
const infisso = (status) => ({ soloInfisso: true, status });
/* Una tapparella: alzata sopra la sua soglia, giù sotto. */
const motore = (position) => ({ hasPosition: true, position, status: position > 0 ? "open" : "closed" });

test("il conto è quello delle cose APERTE, non di quelle configurate", () => {
  /* «2 finestre significa quelle aperte non totale. Quello è un avviso di cose
   * aperte o chiuse.» Prima contava i pezzi, e sopra una stanza con due
   * finestre scriveva «2 finestre» tanto con tutte e due spalancate quanto con
   * tutte e due chiuse: un numero che non cambia mai non è un avviso. */
  const conto = contoDelGruppo([infisso("open"), infisso("closed")]);
  assert.equal(conto.finestre, 1, "aperta ce n'è una sola");
  assert.equal(conto.quanteFinestre, 2, "ma la stanza ne ha due");

  assert.equal(contoDelGruppo([infisso("closed"), infisso("closed")]).finestre, 0);
  assert.equal(contoDelGruppo([infisso("open"), infisso("open")]).finestre, 2);
});

test("si contano sia le finestre aperte sia le tapparelle alzate", () => {
  /* «Devi segnalare sia quante finestre aperte sia quante tapparelle.» */
  const conto = contoDelGruppo([
    infisso("open"),
    infisso("open"),
    motore(80),
    motore(0),
  ]);
  assert.equal(conto.finestre, 2);
  assert.equal(conto.tapparelle, 1, "una sola è alzata");
  assert.equal(conto.quanteTapparelle, 2);
});

test("le due specie restano separate (#299)", () => {
  /* «Nell'intestazione della finestra viene mostrata etichetta numero di
   * tapparelle anche se è impostato solo sensore di contatto»: una persiana a
   * mano col suo contatto non è una tapparella, e non va contata come tale. */
  assert.equal(contoDelGruppo([infisso("open")]).tapparelle, 0);
  assert.equal(contoDelGruppo([motore(90)]).finestre, 0);
  assert.deepEqual(contoDelGruppo([]), {
    tapparelle: 0,
    finestre: 0,
    quanteTapparelle: 0,
    quanteFinestre: 0,
  });
  assert.deepEqual(contoDelGruppo(null), {
    tapparelle: 0,
    finestre: 0,
    quanteTapparelle: 0,
    quanteFinestre: 0,
  });
});

test("le parole dicono aperto, e dicono anche quando non c'è niente di aperto", () => {
  assert.equal(paroleDelConto({ tapparelle: 0, finestre: 1 }), "1 finestra aperta");
  assert.equal(paroleDelConto({ tapparelle: 1, finestre: 0 }), "1 tapparella alzata");
  assert.equal(
    paroleDelConto({ tapparelle: 2, finestre: 2 }),
    "2 tapparelle alzate · 2 finestre aperte",
  );
  /* Niente di aperto è la metà della domanda «aperto o chiuso»: senza scritta
   * la stanza sembrerebbe non avere risposta. */
  assert.equal(paroleDelConto({ tapparelle: 0, finestre: 0 }), "Tutto chiuso");
  /* Chi passava ancora un numero secco continua a essere capito. */
  assert.equal(paroleDelConto(3), "3 tapparelle alzate");
});

test("la griglia conta ogni gruppo con il conto separato", async () => {
  const source = await readFile(new URL("../src/sections/shutter-scene-section.js", import.meta.url), "utf8");
  /* Il conto della scritta viene dalle card di QUEL gruppo, non da tutte: e'
   * la cosa che questa prova tiene ferma. Il nome della variabile che porta la
   * chiave non c'entra — cambiarlo non e' una regressione. */
  assert.match(
    source,
    /groupMarkup\(\s*view,\s*contoDelGruppo\(views\.filter\(\(other\) => groupKey\(other\) === \w+\)\),?\s*\)/,
  );
  assert.match(source, /\$\{esc\(paroleDelConto\(conto\)\)\}/);
});
