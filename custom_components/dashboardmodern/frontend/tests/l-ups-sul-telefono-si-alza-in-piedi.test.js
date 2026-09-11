/* «Aprendo la sezione dal cellulare la scheda la si vede compressa, non c'è
 *  modo di scalarle?» (#390)
 *
 * La scena dell'UPS mette tre oggetti in fila — traliccio, scatola, casa —
 * larghi in tutto più di quattrocento pixel, e li ancora a percentuali del
 * palco. Su un telefono da trecentosessanta il palco è più stretto della fila:
 * gli oggetti si passano l'uno sopra l'altro e le targhette gli finiscono
 * addosso. Rimpicciolire tutto farebbe entrare la fila con le etichette a
 * cinque pixel, che leggibile non è lo stesso: sotto i 520 la fila si alza in
 * piedi, e i numeri vanno in una griglia sotto.
 *
 * Il modulo si installa da sé appena importato: qui si legge il sorgente.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const sorgente = readFileSync(new URL("../src/sections/ups-section.js", import.meta.url), "utf8");

/** Il blocco di regole che vale sotto i 520, dal suo `@media` alla graffa che lo chiude. */
function inColonna() {
  const inizio = sorgente.indexOf("@media (max-width:520px){");
  assert.ok(inizio > 0, "manca la regola della colonna");
  const fine = sorgente.indexOf("\n    }", inizio);
  assert.ok(fine > inizio, "il blocco non si chiude");
  return sorgente.slice(inizio, fine);
}

test("ogni pezzo della scena dice qual è il suo posto", () => {
  /* In colonna l'ordine non lo può dare la percentuale: serve un nome addosso
   * a ogni nodo, ed è lo stesso nome della mappa dei posti. */
  for (const posto of ["rete", "scatola", "casa", "verdetto"])
    assert.ok(
      sorgente.includes(`data-dm-ups-posto="${posto}"`),
      `il nodo «${posto}» non dice il suo posto`,
    );
  assert.match(sorgente, /data-dm-ups-posto="\$\{esc\(posto\)\}"/);
  // Le targhette chiedono il posto per nome, e la mappa resta l'unica a sapere
  // dove quel posto stia.
  for (const posto of ["carico", "autonomia", "tensione", "potenza", "temperatura"])
    assert.match(sorgente, new RegExp(`targhetta\\(\\s*"${posto}"`), `la targhetta «${posto}» non ha posto`);
  assert.match(sorgente, /style="\$\{POSTI\[posto\]\}"/);
});

test("finché la scena è un palco, il quadro delle targhette non esiste", () => {
  /* Le cinque targhette stanno insieme in una scatola perché in colonna
   * diventano una griglia sola. Sul palco quella scatola non deve esistere, o
   * le targhette si posizionerebbero rispetto a lei invece che rispetto alla
   * scena. */
  assert.match(sorgente, /\.dm-ups-quadro\{display:contents\}/);
  const quadro = sorgente.indexOf('<div class="dm-ups-quadro">');
  const verdetto = sorgente.indexOf('data-dm-ups-posto="verdetto"');
  assert.ok(quadro > 0 && quadro < verdetto, "il quadro sta fra la casa e il verdetto");
});

test("sotto i 520 la fila si alza in piedi", () => {
  const colonna = inColonna();
  // Il palco smette di essere alto per forza e la scena smette di essere un palco.
  assert.match(colonna, /\.dm-ups-stage\{height:auto/);
  assert.match(colonna, /\.dm-ups-scena\{\s*position:static;display:flex;flex-direction:column/);
  assert.match(colonna, /\.dm-ups-nodo\{position:static;transform:none/);
  // Rete, UPS e casa in quest'ordine, poi i numeri, poi la frase.
  for (const [posto, ordine] of [
    ["rete", 1],
    ["scatola", 2],
    ["casa", 3],
  ])
    assert.match(colonna, new RegExp(`\\[data-dm-ups-posto="${posto}"\\]\\{order:${ordine}\\}`));
  assert.match(colonna, /\.dm-ups-quadro\{\s*order:4;display:grid/);
  assert.match(colonna, /\.dm-ups-nodo-verdetto\{order:5/);
  // I cavi disegnati univano due punti che in colonna non ci sono più.
  assert.match(colonna, /\.dm-ups-cavi\{display:none\}/);
  // E la frase, senza più un angolo tutto suo, va a capo.
  assert.match(colonna, /\.dm-ups-verdetto\{white-space:normal/);
});

test("in colonna la corrente scende, e a corrente caduta il cavo di monte è spento", () => {
  const colonna = inColonna();
  // Il tratto verticale nasce sotto la rete e sotto la scatola, non sotto la casa.
  assert.match(
    colonna,
    /\[data-dm-ups-posto="rete"\]::after,\s*\$\{P\} \.dm-ups-nodo\[data-dm-ups-posto="scatola"\]::after\{/,
  );
  assert.ok(
    !/data-dm-ups-posto="casa"\]::after/.test(colonna),
    "sotto la casa non c'è niente da unire",
  );
  // Con la rete: verde sopra, azzurro sotto, come i due cavi del palco.
  assert.match(
    colonna,
    /\[data-rete="true"\][^\n]*\[data-dm-ups-posto="rete"\]::after\{\s*--dm-ups-corrente:#22c55e/,
  );
  assert.match(
    colonna,
    /\[data-rete="true"\][^\n]*\[data-dm-ups-posto="scatola"\]::after\{\s*--dm-ups-corrente:#38bdf8/,
  );
  /* Senza rete il cavo di monte resta spento — è tutta la notizia — e quello di
   * valle porta l'ambra della batteria, più in fretta. */
  assert.match(
    colonna,
    /\[data-buio="true"\][^\n]*\[data-dm-ups-posto="scatola"\]::after\{\s*--dm-ups-corrente:#fbbf24;animation:dmUpsScende 1\.5s/,
  );
  assert.ok(
    !/\[data-buio="true"\][^\n]*\[data-dm-ups-posto="rete"\]::after\{[^}]*--dm-ups-corrente:#[0-9a-f]/.test(
      colonna,
    ),
    "a corrente caduta il cavo di monte non deve scorrere",
  );
  // Chi ha chiesto di non vedere animazioni non le vede nemmeno qui.
  assert.match(sorgente, /@keyframes dmUpsScende\{/);
  assert.match(
    sorgente,
    /@media \(prefers-reduced-motion:reduce\)\{\s*\$\{P\} \.dm-ups-nodo::after\{animation:none!important\}/,
  );
});
