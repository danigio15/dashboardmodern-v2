/* Tre difetti trovati dalla revisione, e sono tutti e tre della stessa
 * famiglia: una cosa messa in attesa che poi finisce sulla persona sbagliata,
 * al momento sbagliato, o che non se ne va più.
 *
 * Non sono difetti visibili subito — nessuno dei tre rompe il giro normale —
 * e proprio per questo si difendono da qui: il giro normale continuerà a
 * funzionare anche il giorno in cui qualcuno li riscrive.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const leggi = (nome) => readFileSync(new URL(`../src/${nome}`, import.meta.url), "utf8");

test("la riprova del meteo segue l'ultimo fallimento, non il primo", () => {
  /* Tenere la prima riprova e scartare le successive sembra la cosa prudente,
   * e invece le mangia. Cade una domanda e si programma la riprova; si cambia
   * l'entità del meteo e cade anche la seconda, che però non può programmare
   * niente perché la prima è ancora appesa; quando la prima scade, la seconda
   * ha appena rimesso il riposo da capo e `chiediLePrevisioni` esce senza
   * chiedere e senza riprogrammare. Da lì nessuna previsione finché non passa
   * un disegno per conto suo — cioè il difetto che la riprova doveva chiudere. */
  const sorgente = leggi("sections/la-card-del-meteo-section.js");
  assert.match(sorgente, /clearTimeout\(state\.riprova\);\s*\n\s*state\.riprova = setTimeout\(/);
  assert.doesNotMatch(sorgente, /if \(!state\.riprova\)\s*\n?\s*state\.riprova = setTimeout/);
});

test("la capacità di una bozza abbandonata non finisce su un'altra auto", () => {
  /* Chiusa la bozza, `editedVehicle()` risponde con quella che la scheda sta
   * guardando adesso — che, se la bozza è stata abbandonata aprendo un'auto
   * che c'era già, è quella. Il numero scritto per una vettura mai nata
   * cambiava in silenzio la capacità di un'altra. */
  const sorgente = leggi("sections/auto-termica-section.js");
  /* Chi c'era prima della bozza si segna quando la bozza comincia… */
  assert.match(sorgente, /state\.autoPrimaDellaBozza = new Set\(/);
  /* …e chi c'era prima non è l'auto nata dalla bozza: il numero non è suo. */
  assert.match(sorgente, /if \(nate instanceof Set && nate\.has\(uid\)\) return;/);
  /* E la mano si svuota in ogni caso, salvata o abbandonata che sia. */
  assert.match(sorgente, /state\.capacitaInBozza = "";\s*\n\s*state\.autoPrimaDellaBozza = null;/);
});

test("l'ascolto del catalogo muore con la scheda che lo ha aperto", () => {
  /* Si toglieva da solo, ma solo al catalogo SUCCESSIVO: nel giro normale il
   * catalogo arriva mentre la scheda è ancora aperta, quel giro ridisegna e
   * non toglie niente, e chiudendo la scheda l'ascolto resta attaccato a una
   * finestra staccata dal documento — che quindi non si può buttare. Col
   * catalogo già in memoria un giro successivo può non arrivare mai. */
  const sorgente = leggi("sections/appliance-editor-section.js");
  assert.match(sorgente, /const stacca = new AbortController\(\);/);
  assert.match(
    sorgente,
    /addEventListener\?\.\(EVENTO_CATALOGO, alCatalogo, \{ signal: stacca\.signal \}\)/,
  );
  /* E la finestra si chiude da una porta sola, che è quella che interrompe. */
  assert.match(sorgente, /export function chiudiLaScheda\(modal\)/);
  assert.match(sorgente, /const close = \(\) => chiudiLaScheda\(modal\);/);
  /* Anche riaprendola sopra una già aperta: è lì che se ne accumulavano. */
  assert.match(sorgente, /chiudiLaScheda\(doc\?\.getElementById\("dm-appliance-editor-modal"\)\);/);
  /* L'unico `remove()` rimasto sulla finestra è dentro quella porta. */
  const rimozioni = [...sorgente.matchAll(/modal\.remove\(\)/g)];
  assert.equal(rimozioni.length, 1, "la finestra si toglie da più di un posto");
});

test("l'allerta del sovraccarico si rifà rientrando in Home", () => {
  /* Vive solo in Home e fuori si toglie da sé. Ma il sovraccarico comincia
   * quando comincia: se comincia mentre si sta in Energia, il disegno di quel
   * momento la toglie — giustamente — e tornando in Home non c'era niente che
   * la rimettesse finché non passava un'altra notizia della casa. Su un
   * contatore che sta per saltare, «finché non passa» è troppo. */
  const sorgente = leggi("sections/la-soglia-della-potenza-section.js");
  assert.match(sorgente, /quandoSiCambiaPagina\(schedule\);/);
  assert.match(sorgente, /^\s*quandoSiCambiaPagina,$/m);
});
