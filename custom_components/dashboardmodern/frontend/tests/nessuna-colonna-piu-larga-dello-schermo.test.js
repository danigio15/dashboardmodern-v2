/* «Quando apro la sezione luci, si apre più larga dello schermo e devo
 * scorrere a destra per arrivare agli interruttori. Succede anche con
 * "finestre" e "clima"» (#483).
 *
 * Chi ha segnalato ha un telefono pieghevole, e lo dice: «nel display
 * classico devi scorrere a destra; se apro il fold vedo la riga intera».
 * Ed è tutta la diagnosi, una volta che si sa cosa cercare — perché la
 * risposta di prima, «ho provato a 1440 e a 1024 e non sborda di un pixel»,
 * era vera e inutile: sopra una certa larghezza il difetto non esiste.
 *
 * Le sezioni dispongono le card con
 *
 *     grid-template-columns: repeat(auto-fit, minmax(288px, 1fr))
 *
 * che vuol dire «colonne larghe almeno 288, quante ce ne stanno». Su uno
 * schermo dove ne sta MENO DI UNA, `auto-fit` non rinuncia: fa lo stesso la
 * sua colonna da 288, e quella sborda. Misurato in un browser vero su 280
 * pixel: la card larga 288 con il bordo destro a 302, cioè ventidue oltre lo
 * schermo — e l'interruttore, che sta a destra nella card, finisce lì.
 *
 * `min(288px, 100%)` dice «almeno 288, ma mai più del posto che c'è». Sopra la
 * soglia non cambia niente: a 320 e a 360 le due scritture danno lo stesso
 * numero, misurato. È la ragione per cui la correzione si può dare a tutte le
 * griglie e non solo alle tre nominate: dove il difetto non c'è, non fa nulla.
 *
 * La prova è sul sorgente e non su un browser perché la regola è una regola:
 * una colonna a larghezza fissa in una griglia che si adatta è un errore
 * dovunque stia, e questa prova serve a impedire che ne rientri una domani.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync } from "node:fs";

/* Sotto questa quota la colonna entra anche nello schermo di copertina più
 * piccolo che si trova in giro: lì un tetto non serve, e una riga cambiata
 * senza motivo è una riga da rileggere. */
const STRETTO = 250;

const CARTELLA = new URL("../src/sections/", import.meta.url);
const sezioni = readdirSync(CARTELLA)
  .filter((nome) => nome.endsWith(".js"))
  .map((nome) => [nome, readFileSync(new URL(nome, CARTELLA), "utf8")]);

test("nessuna colonna larga è fissa: sotto il suo minimo cede il posto", () => {
  const colpevoli = [];
  for (const [nome, sorgente] of sezioni) {
    for (const pezzo of sorgente.matchAll(/minmax\((\d+)px/g)) {
      const quanto = Number(pezzo[1]);
      if (quanto < STRETTO) continue;
      const riga = sorgente.slice(0, pezzo.index).split("\n").length;
      colpevoli.push(`${nome}:${riga} minmax(${quanto}px …)`);
    }
  }
  assert.deepEqual(
    colpevoli,
    [],
    `queste colonne sbordano su un telefono stretto: scrivere minmax(min(Npx,100%), …)\n${colpevoli.join("\n")}`,
  );
});

test("le tre sezioni della segnalazione hanno davvero il tetto", () => {
  /* Luci, Finestre e Clima sono quelle nominate: se un domani qualcuno
   * riscrive una di queste griglie, questa riga glielo ricorda per nome. */
  const per = (nome) => sezioni.find(([quale]) => quale === nome)?.[1] || "";
  assert.match(per("lights-page-section.js"), /minmax\(min\(288px,100%\),1fr\)/);
  assert.match(per("shutter-section.js"), /minmax\(min\(288px,100%\),1fr\)/);
  assert.match(per("rooms-page-section.js"), /minmax\(min\(258px,100%\),1fr\)/);
});
