/* «Radar: da errore quando non configurato, non deve uscire proprio — e anche
 * quando configurato da errore.»
 *
 * Sono due difetti nello stesso riquadro, e il primo si vede da chiunque non
 * abbia mai aperto quella casella: dentro le previsioni compariva un rettangolo
 * grigio con l'immagine rotta e scritto «il radar non sta rispondendo». Un
 * errore per una cosa che nessuno aveva chiesto.
 *
 * Il blocco nasceva sempre e poi ci si metteva `hidden`, che sembra
 * sufficiente e non lo e': `hidden` vale quanto una riga del foglio del
 * browser, e sopra c'era una regola nostra con `display:grid` che la batte. Il
 * blocco restava li', visibile, e senza `data-dm-radar` non si nascondevano
 * nemmeno l'immagine vuota e la frase dell'errore — che infatti si vedevano
 * tutte e due insieme.
 *
 * Il secondo e' del radar a tessere. «Vivo» si decideva contando i quadratini
 * CREATI, ma un quadratino che non arriva si toglie da solo dal suo `error`:
 * col servizio irraggiungibile il riquadro restava vuoto e il blocco
 * continuava a dire «vivo», che e' proprio lo stato in cui la frase che
 * spiegherebbe sta nascosta. E la firma del disegno non cambiava piu', quindi
 * non si riprovava nemmeno.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const sorgente = readFileSync(new URL("../src/sections/radar-meteo-section.js", import.meta.url), "utf8");

test("senza radar configurato il blocco non si fabbrica nemmeno", () => {
  /* Prima si guarda se c'e' qualcosa da mostrare, e solo dopo si cerca il
   * posto dove mostrarlo: `blocco()` lo crea, e chiamarlo prima voleva dire
   * fabbricare il riquadro per poi doverlo nascondere. */
  const disegna = sorgente.slice(
    sorgente.indexOf("export function disegnaRadar()"),
    sorgente.indexOf("/* ── il giro, solo mentre si guarda ─"),
  );
  const doveScelto = disegna.indexOf("if (!scelto)");
  const doveBlocco = disegna.indexOf("blocco()", disegna.indexOf("const nodo"));
  assert.ok(doveScelto > 0, "il controllo sul radar scelto deve esserci");
  assert.ok(doveBlocco > doveScelto, "il blocco si cerca dopo aver deciso che serve");
  /* E quello eventualmente rimasto da prima se ne va. */
  assert.match(disegna, /bloccoEsistente\(\)\?\.remove\(\)/);
  assert.doesNotMatch(disegna, /nodo\.hidden = true/);
});

test("e se qualcuno lo lascia indietro, hidden lo nasconde davvero", () => {
  /* La regola col display sta piu' in alto e batte l'attributo del browser:
   * serve dirlo per esteso, una volta. */
  assert.match(sorgente, /\.dm-radar-blocco\[hidden\]\{display:none!important\}/);
});

test("il radar a tessere dice «vivo» solo quando un quadratino e' arrivato", () => {
  const tessere = sorgente.slice(
    sorgente.indexOf("function daTessere("),
    sorgente.indexOf("export function disegnaRadar()"),
  );
  /* Non si conta piu' quello che si e' chiesto. */
  assert.doesNotMatch(tessere, /pezzi\.length \? "vivo"/);
  /* Si ascoltano tutte e due le risposte, non solo il fallimento. */
  assert.match(tessere, /addEventListener\("load", \(\) => segnala\(immagine, true\)/);
  assert.match(tessere, /addEventListener\("error", \(\) => segnala\(immagine, false\)/);
  /* Il primo che arriva accende; quando sono finiti e non e' arrivato
   * nessuno, il blocco lo dice. */
  assert.match(tessere, /if \(arrivati\) \{\s*nodo\.dataset\.dmRadar = "vivo";/);
  assert.match(tessere, /if \(persi >= attesi\) \{\s*nodo\.dataset\.dmRadar = "muto";/);
});

test("un radar che non risponde riprova al giro dopo", () => {
  /* La firma serve a non ridisegnare a vuoto mentre si guarda; ma se il
   * disegno e' fallito, tenerla vuol dire non riprovare mai piu'. */
  const tessere = sorgente.slice(
    sorgente.indexOf("function daTessere("),
    sorgente.indexOf("export function disegnaRadar()"),
  );
  const azzeramenti = [...tessere.matchAll(/dove\.dataset\.dmFirma = "";/g)];
  assert.ok(azzeramenti.length >= 2, "si azzera sia a zero quadratini sia a zero arrivi");
});

test("mentre i quadratini arrivano non si mostra ne' il vuoto ne' l'errore", () => {
  assert.match(sorgente, /\[data-dm-radar="attesa"\] \.dm-radar-img\{display:none\}/);
  assert.match(sorgente, /\[data-dm-radar="attesa"\] \.dm-radar-muto\{display:none\}/);
});
