/* Il browser deve sapere subito quali file gli serviranno.
 *
 * La plancia e' fatta di centosessantacinque moduli e la catena degli import e'
 * profonda dieci livelli: un browser scopre un modulo solo quando ha finito di
 * leggere quello che lo importa, quindi senza un elenco davanti servono dieci
 * giri di rete uno dopo l'altro. In quei secondi si vede la plancia com'e'
 * disegnata dal guscio — il meteo grande in mezzo alla pagina, le azioni
 * rapide senza il loro ripiano — e poi tutto si sposta sotto gli occhi.
 * Segnalato cosi': «come se ci fosse una versione vecchia sotto».
 *
 * L'elenco lo scrive uno script camminando sul grafo vero, perche' a mano
 * invecchia in una settimana: basta un import nuovo e quel modulo torna a
 * essere scoperto per ultimo, senza che nessuno se ne accorga. Questa prova
 * fa girare lo script in sola lettura: se l'elenco non e' piu' quello del
 * grafo, cade e dice cosa eseguire.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const RADICE = fileURLToPath(new URL("../../../../", import.meta.url));

test("l'elenco dei moduli in anticipo e' quello del grafo vero", () => {
  const esito = execFileSync(
    process.execPath,
    ["scripts/porta-avanti-i-moduli.mjs", "--check"],
    { cwd: RADICE, encoding: "utf8" },
  );
  assert.match(esito, /aggiornato/);
});

for (const guscio of ["dashboard.html", "dashboard-en.html"]) {
  test(`${guscio} chiede in anticipo il grosso della plancia`, () => {
    const testo = readFileSync(new URL(`../legacy/${guscio}`, import.meta.url), "utf8");
    const quanti = (testo.match(/rel="modulepreload"/g) || []).length;
    // Non un numero esatto — cresce col progetto — ma il grosso deve esserci:
    // con una dozzina di righe si sarebbe tornati alla scoperta a livelli.
    assert.ok(quanti > 120, `solo ${quanti} moduli chiesti in anticipo`);
    // E il primo di tutti deve essere li': e' quello da cui parte il resto.
    assert.match(testo, /rel="modulepreload" href="\.\.\/src\/sections\/section-runtime\.js"/);
  });
}
