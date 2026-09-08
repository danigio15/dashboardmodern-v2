/* «Verifica questo codice legacy italiano e inglese ancora duplicato… fai
 * quello che vuoi ma basta con duplicati.»
 *
 * `dashboard-runtime-{it,en}.js` erano lo STESSO programma scritto due volte:
 * 9232 righe contro 9176, identiche al 92%, 465 funzioni con lo stesso nome su
 * 466. Quello che cambiava erano soltanto le parole — commenti, testo dentro le
 * stringhe, etichette dei pulsanti — e nessuna riga di logica si comportava in
 * modo diverso. Lo stesso per il foglio di stile, il debug, il tema, il
 * guardiano: cinque coppie, quasi un megabyte di sorgente scritto due volte.
 *
 * Adesso la copia inglese non e' piu' una seconda verita': e' quello che esce
 * dalla prima piu' l'elenco delle sue parole (`parole-del-guscio-en.json`).
 * Questa prova la rifa' da capo e la confronta byte per byte con quella
 * vendorizzata. Se qualcuno tocca un file inglese senza passare dall'elenco,
 * qui si vede subito; e se il guscio si aggiorna, l'elenco si riestrae e la
 * differenza resta scritta in un posto solo.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const LEGACY = fileURLToPath(new URL("../legacy/", import.meta.url));
const RADICE = fileURLToPath(new URL("../../../../", import.meta.url));
const ELENCO = JSON.parse(readFileSync(`${LEGACY}parole-del-guscio-en.json`, "utf8"));

/** Rifa' la copia inglese dall'italiana e dall'elenco dei tratti. */
function applica(testoIt, cambi) {
  const righe = testoIt.split("\n");
  const fuori = [];
  let letto = 0;
  for (const { riga, via, metti } of cambi) {
    fuori.push(...righe.slice(letto, riga));
    fuori.push(...metti);
    letto = riga + via;
  }
  fuori.push(...righe.slice(letto));
  return fuori.join("\n");
}

test("ogni file inglese del guscio si rifa' dall'italiano, byte per byte", () => {
  const nomi = Object.keys(ELENCO.file);
  /* Cinque coppie: runtime, foglio di stile, debug, tema, guardiano. Se una
   * sparisce dall'elenco la duplicazione e' tornata di soppiatto. */
  assert.equal(nomi.length, 5, "le coppie sono cinque");
  for (const [nomeEn, voce] of Object.entries(ELENCO.file)) {
    const testoIt = readFileSync(`${LEGACY}${voce.da}`, "utf8");
    const atteso = readFileSync(`${LEGACY}${nomeEn}`, "utf8");
    assert.equal(applica(testoIt, voce.cambi), atteso, `${nomeEn} non torna dall'italiano`);
  }
});

test("l'elenco delle parole e' aggiornato rispetto ai due gusci", () => {
  /* Lo stesso che fa la CI: se il guscio si e' mosso e l'elenco no, cade qui
   * invece che in un dispositivo inglese. */
  const uscita = execFileSync(
    "python3",
    [`${RADICE}scripts/parole_del_guscio_inglese.py`, "--check"],
    { encoding: "utf8" },
  );
  assert.match(uscita, /parole del guscio inglese aggiornate/);
});

test("i due gusci sono già divergenti, e di quanto si sa il numero", () => {
  /* Il senso di tutto questo non e' solo il megabyte in meno. Contando i tratti
   * si scopre che le due copie NON sono piu' lo stesso programma: in tredici
   * punti il guscio italiano ha righe che l'inglese non ha — fra cui il
   * dizionario IT/EN potenziato del rilevamento automatico, quarantasei righe —
   * e in quattro punti l'inglese ne ha che l'italiano non ha, fra cui una
   * linguetta «Overrides» che di qua non esiste. E' la deriva di cui si
   * lamentava chi ha chiesto questo lavoro: due copie che si allontanano senza
   * che nessuno se ne accorga.
   *
   * Adesso quella deriva ha un numero. Se cresce, questa prova cade, e chi
   * l'ha fatta crescere lo scopre subito invece che da una segnalazione di un
   * utente inglese sei mesi dopo. Scendere e' benvenuto: vuol dire che i due
   * gusci si sono riavvicinati, e allora si aggiorna il numero.
   *
   * Ed e' sceso: da quattro a tre. Le tre linguette che l'elenco delle PAROLE
   * si portava dietro — «Overrides», «Texts», «Export» — non erano parole:
   * erano tre pulsanti interi che in italiano non esistono, e chi aveva la
   * plancia in inglese vedeva ventuno schede invece di diciotto, tre delle
   * quali non esistevano di qua. Fuori dall'elenco: adesso le due copie hanno
   * le stesse linguette. */
  const DERIVA = {
    "dashboard-runtime-en.js": { soloIt: 13, soloEn: 3 },
    "dashboard-runtime-en.css": { soloIt: 4, soloEn: 2 },
    "dashboard-debug-en.js": { soloIt: 0, soloEn: 0 },
    "dashboard-theme-en.js": { soloIt: 0, soloEn: 0 },
    "dashboard-watchdog-en.js": { soloIt: 0, soloEn: 0 },
  };
  for (const [nomeEn, voce] of Object.entries(ELENCO.file)) {
    const soloIt = voce.cambi.filter((cambio) => cambio.metti.length === 0).length;
    const soloEn = voce.cambi.filter((cambio) => cambio.via === 0).length;
    assert.deepEqual(
      { soloIt, soloEn },
      DERIVA[nomeEn],
      `${nomeEn}: i blocchi presenti in una lingua sola sono cambiati`,
    );
  }
});
