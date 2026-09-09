/* «Nella home il chip indica 6 finestre aperte ma in realtà sono 6 tapparelle,
 *  le finestre (tramite sensori di apertura/chiusura) andrebbero specificate
 *  come finestre in un altro chip» (#442).
 *
 * La sezione Finestre porta dentro due cose diverse: i motori — tapparelle,
 * tende, tende da sole — che si ALZANO, e i contatti sull'anta, che si APRONO.
 * La tessera le sommava e le chiamava tutte «aperte»: sei tapparelle tirate su
 * sono una casa normale, sei finestre aperte sono una casa da chiudere.
 *
 * L'altro chip che chiede c'è già e si chiama Varchi: i contatti li trova da
 * sé. Qui si prova la parola, che è il pezzo che diceva il falso.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const leggi = (rel) => readFile(new URL(rel, import.meta.url), "utf8");

/* La tessera si legge dal sorgente: `coversModel` chiede al guscio le
 * tapparelle di casa e la mappa dei versi, e montarne uno per una parola
 * costerebbe più di quel che prova. Le prove sul comportamento intero stanno
 * nell'e2e, che la plancia la accende davvero. */
const modello = async () => {
  const sorgente = await leggi("../src/sections/home-widgets-section.js");
  const dentro = sorgente.slice(
    sorgente.indexOf("function coversModel(states)"),
    sorgente.indexOf("function securityModel(states)"),
  );
  assert.ok(dentro, "coversModel non si trova più dove questa prova lo cerca");
  return dentro;
};

test("le coperture e i contatti si contano separati", async () => {
  const dentro = await modello();
  assert.match(dentro, /const coperture = rows\.filter\(\(row\) => !row\.soloSensore\)/);
  assert.match(dentro, /const contatti = rows\.filter\(\(row\) => row\.soloSensore\)/);
  assert.match(dentro, /const alzate = coperture\.filter\(\(row\) => row\.open\)/);
  assert.match(dentro, /const aperte = contatti\.filter\(\(row\) => row\.open\)/);
});

test("senza un solo contatto la tessera si chiama come quello che conta", async () => {
  const dentro = await modello();
  assert.match(dentro, /label: soloMotori \? t\("Tapparelle", "Shutters"\) : t\("Finestre", "Windows"\)/);
  /* E la didascalia dice «alzate», non «aperte»: è la parola per cui questa
   * segnalazione esiste. */
  assert.match(dentro, /t\(`\$\{alzate\.length\} alzate`, `\$\{alzate\.length\} up`\)/);
  assert.match(dentro, /t\("Tutte abbassate", "All down"\)/);
});

test("con le due famiglie insieme la didascalia le dice separate", async () => {
  const dentro = await modello();
  /* Non si sommano in silenzio: «Camera · 6 alzate» dice due cose vere,
   * «7 aperte» ne diceva una falsa.
   *
   * Le finestre aperte si nominano — è la ragione per cui la tessera delle
   * «aperture» non esiste più, le diceva questa per nome — e le tapparelle si
   * contano, perché quali siano su non è una notizia. */
  assert.match(dentro, /nomiAccesi\(aperte, \(\) => true, ""\)/);
  assert.match(dentro, /alzate\.length \? t\(`\$\{alzate\.length\} alzate`/);
  assert.match(dentro, /pezzi\.join\(" · "\)/);
  /* A casa chiusa lo dice, invece di scrivere «0 aperte». */
  assert.match(dentro, /t\("Tutto chiuso", "All closed"\)/);
  /* E la vecchia riga che chiamava tutto «aperte» non c'è più. */
  assert.doesNotMatch(dentro, /nomiAccesi\(open, \(\) => true/);
});

test("un motore senza percentuale dice se sta su o giù, non se è aperto", async () => {
  const sorgente = await leggi("../src/sections/home-widgets-section.js");
  const dettaglio = sorgente.slice(
    sorgente.indexOf("function coversDetail(widget)"),
    sorgente.indexOf("function securityDetail(widget, states)"),
  );
  assert.ok(dettaglio, "coversDetail non si trova più dove questa prova lo cerca");
  /* Il contatto continua a dire la sua parola: quello si apre davvero. */
  assert.match(dettaglio, /t\("Aperta", "Open"\) : t\("Chiusa", "Closed"\)/);
  /* Il motore dice la sua: prima, senza percentuale, non diceva niente. */
  assert.match(dettaglio, /t\("Alzata", "Up"\) : t\("Abbassata", "Down"\)/);
});

test("i contatti hanno già il loro chip, e non è questo", async () => {
  const sorgente = await leggi("../src/sections/home-widgets-section.js");
  /* La tessera dei Varchi conta i contatti di porte e finestre di TUTTA la
   * casa, trovati dal `device_class`: è l'«altro chip» della segnalazione, e
   * c'era già. Se sparisse, questa correzione lascerebbe le finestre senza
   * nessuno che le conti. */
  assert.match(sorgente, /key: "varchi"/);
  assert.match(sorgente, /varchiModel\(states\)/);
});
