/* Il runtime vendorizzato si compila.
 *
 * Un apostrofo dentro una stringa fra apici singoli — «manca l'entita'» — la
 * chiude a meta', e da li' in poi il file non e' piu' JavaScript. Il browser
 * smette di leggerlo dove si e' rotto: tutto quello che sta sotto sparisce, la
 * plancia non finisce di avviarsi, e l'unica traccia e' un «Unexpected token»
 * nella console — che nessuno guarda, perche' la pagina resta li' a caricare.
 *
 * Le prove che aprono un browser lo notano solo perche' vanno in timeout dopo
 * due minuti e mezzo, e dicono «la plancia non si e' avviata» senza dire
 * perche'. Questa lo nota in un decimo di secondo e nomina il file.
 *
 * Si compila e basta, non si esegue: qui interessa che il file sia leggibile,
 * non cosa fa. `new Function` legge in modalita' script, che e' come lo legge
 * il browser — un modulo non permetterebbe le doppie dichiarazioni che questo
 * runtime ha da sempre, e la prova fallirebbe per un motivo che non e' un
 * difetto.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const QUI = dirname(fileURLToPath(import.meta.url));
const LEGACY = join(QUI, "..", "legacy");

/* I file che il guscio carica come script normali. I moduli hanno gia' la
 * loro prova — `ogni-modulo-si-legge` li importa davvero, e `build-info.js` e'
 * uno di quelli. */
const SCRIPT = (nome) =>
  /^dashboard-(runtime|theme|watchdog|debug)-(it|en)\.js$/.test(nome) ||
  ["storage-namespace.js", "bridge-prelude.js", "config.js"].includes(nome);

test("ogni script del runtime vendorizzato si compila", () => {
  const rotti = [];
  for (const nome of readdirSync(LEGACY).filter(SCRIPT)) {
    try {
      // eslint-disable-next-line no-new-func
      new Function(readFileSync(join(LEGACY, nome), "utf8"));
    } catch (errore) {
      rotti.push(`${nome}: ${errore.message}`);
    }
  }
  assert.deepEqual(
    rotti,
    [],
    `questi file non sono JavaScript valido, e il browser smette di leggerli dove si rompono:\n  ${rotti.join("\n  ")}`,
  );
});
