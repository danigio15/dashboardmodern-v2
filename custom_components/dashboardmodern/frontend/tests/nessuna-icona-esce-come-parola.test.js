/* «Icone stanze in home non si vedono.»
 *
 * Nella scheda della Home, sotto «Stanze in plancia», sopra il nome di ogni
 * stanza c'era scritto `mdi:sofa`, `mdi:stove`, `mdi:shower`: il NOME
 * dell'icona, stampato come parola. Non era un disegno mancante — era il
 * disegno mai chiesto. Quella riga scriveva il token dentro il markup e via.
 *
 * La regola c'era gia', e sta scritta sopra `writeIconGlyph`: «il token grezzo
 * non si stampa mai come testo». Solo che `writeIconGlyph` scrive dentro un
 * nodo, e mezza plancia disegna costruendo markup a stringhe — un pannello
 * della configurazione si rifa' tutto in una volta. Chi ne aveva bisogno se
 * l'e' riscritta per conto suo; chi se l'e' dimenticata ha stampato il nome.
 *
 * Adesso la regola ha due facce e una sola stanza: `iconGlyphHtml` torna il
 * markup, `writeIconGlyph` lo scrive nel nodo. Questa prova guarda la faccia
 * nuova e i due posti delle stanze che ci cascavano.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { iconGlyphHtml } from "../src/sections/shared.js";

const leggi = (nome) => readFileSync(new URL(`../src/${nome}`, import.meta.url), "utf8");

/* Il motore vero sta in una sezione che vuole un documento: qui basta che
 * risponda come lui — un nome mdi entra, del markup esce. */
function conIlMotore(markup, corpo) {
  const prima = globalThis.DashboardModernIconEngine;
  globalThis.DashboardModernIconEngine = markup ? { markup } : undefined;
  try {
    return corpo();
  } finally {
    if (prima === undefined) delete globalThis.DashboardModernIconEngine;
    else globalThis.DashboardModernIconEngine = prima;
  }
}

test("un nome mdi esce come disegno, mai come parola", () => {
  const uscita = conIlMotore(
    (kind, token, opzioni) => `<svg data-genere="${kind}" data-token="${token}" data-lato="${opzioni.size}"></svg>`,
    () => iconGlyphHtml("mdi:sofa", { kind: "room", size: 34 }),
  );
  assert.equal(uscita, '<svg data-genere="room" data-token="mdi:sofa" data-lato="34"></svg>');
});

test("senza motore esce il ripiego, e comunque non il nome dell'icona", () => {
  const uscita = conIlMotore(null, () => iconGlyphHtml("mdi:sofa", { kind: "room", fallback: "🛋️" }));
  assert.equal(uscita, "🛋️");
  assert.ok(!uscita.includes("mdi:"), "il nome dell'icona non esce mai come testo");
});

test("un simbolo scelto a mano resta quello che è, al riparo dal markup", () => {
  assert.equal(iconGlyphHtml("🛋️", { kind: "room" }), "🛋️");
  /* Chi sceglie l'icona scrive quello che vuole nella casella: esce come
   * markup, quindi esce protetto. */
  assert.equal(iconGlyphHtml("<b>x</b>", { kind: "room" }), "&lt;b>x&lt;/b>");
});

test("niente icona vuol dire il ripiego, non una casella vuota", () => {
  assert.equal(iconGlyphHtml("", { kind: "room", fallback: "🛋️" }), "🛋️");
  assert.equal(iconGlyphHtml(null, { kind: "room", fallback: "🛋️" }), "🛋️");
});

test("la regola sta in un posto solo: chi scrive nel nodo chiama chi torna il markup", () => {
  const sorgente = leggi("sections/shared.js");
  assert.match(
    sorgente,
    /export function writeIconGlyph\([\s\S]{0,900}?target\.innerHTML = iconGlyphHtml\(token, \{ size, fallback, kind \}\);/,
  );
});

test("i due posti delle stanze chiedono il disegno, non scrivono il nome", () => {
  /* La scheda della Home: la riga di ogni stanza sotto «Stanze in plancia». */
  const scheda = leggi("sections/home-blocchi-section.js");
  assert.match(
    scheda,
    /<span class="dm-blocco-icona" aria-hidden="true">\$\{iconGlyphHtml\(stanza\.icon, \{\s*\n\s*size: 22,\s*\n\s*kind: "room",/,
  );
  /* E la card in Home: qui il ripiego ERA il token — `disegno || esc(pagina.icon)` —
   * cioe' la stessa parola, per la stessa stanza, nell'altro posto. */
  const blocco = leggi("sections/stanze-in-plancia-section.js");
  assert.match(
    blocco,
    /function disegnoDellaStanza\(icona\) \{\s*\n\s*return iconGlyphHtml\(icona, \{ size: 34, kind: "room", fallback: "🛋️" \}\);\s*\n\}/,
  );
  assert.match(blocco, /class="dm-stanza-plancia-ic" aria-hidden="true">\$\{disegno\}</);
  assert.ok(
    !/esc\(pagina\.icon/.test(blocco),
    "il nome dell'icona non torna come ripiego della card",
  );
});
