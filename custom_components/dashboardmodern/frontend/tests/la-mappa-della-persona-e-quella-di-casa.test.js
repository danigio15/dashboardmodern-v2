/* «Intendevo la mappa interna di HA... adesso punta su googlemap.» (#438)
 *
 * Il luogo sulla card si toccava e apriva Google Maps con l'indirizzo scritto
 * dentro: un altro sito, che di questa casa non sa niente. La mappa che serve
 * ce l'ha Home Assistant, e la mostra in due posti — la scheda dell'entità,
 * col segnaposto di QUESTA persona, e il pannello Mappa.
 *
 * Il tocco prova la prima. La plancia gira dentro una cornice, la cornice sta
 * nell'ombra del pannello, e da lì un annuncio `composed` attraversa il
 * confine e arriva a chi apre le schede: è la stessa strada che usa qualunque
 * card di Home Assistant. Quando intorno non c'è nessuna Home Assistant —
 * la plancia aperta per conto suo — non si annuncia a nessuno, e resta il
 * link, che porta al pannello Mappa.
 */
import assert from "node:assert/strict";
import test from "node:test";

const magazzino = new Map();
globalThis.localStorage = {
  getItem: (k) => (magazzino.has(k) ? magazzino.get(k) : null),
  setItem: (k, v) => magazzino.set(k, String(v)),
  removeItem: (k) => magazzino.delete(k),
};

const { apriLaMappaDiCasa } = await import("../src/sections/people-section.js");

/** Una Home Assistant finta intorno alla plancia, con il suo pannello. */
function casaIntorno({ ce = true } = {}) {
  const annunci = [];
  const ospite = {
    ownerDocument: { defaultView: { CustomEvent } },
    dispatchEvent: (evento) => {
      annunci.push(evento);
      return true;
    },
  };
  globalThis.frameElement = { getRootNode: () => ({ host: ospite }) };
  globalThis.parent = {
    document: { querySelector: (selettore) => (ce && selettore === "home-assistant" ? {} : null) },
  };
  return annunci;
}

function senzaCornice() {
  delete globalThis.frameElement;
  delete globalThis.parent;
}

test("il tocco chiede a Home Assistant la scheda di QUESTA persona", () => {
  const annunci = casaIntorno();
  assert.equal(apriLaMappaDiCasa("person.giovanni"), true);
  assert.equal(annunci.length, 1);
  const annuncio = annunci[0];
  assert.equal(annuncio.type, "hass-more-info");
  assert.deepEqual(annuncio.detail, { entityId: "person.giovanni" });
  /* Senza `composed` l'annuncio si ferma al confine dell'ombra del pannello, e
   * chi apre le schede non lo sente mai. */
  assert.equal(annuncio.composed, true);
  assert.equal(annuncio.bubbles, true);
  senzaCornice();
});

test("senza Home Assistant intorno non si annuncia a nessuno", () => {
  /* Un annuncio che non arriva a nessuno, col link annullato, sarebbe un tocco
   * che non fa niente: meglio lasciar fare al link. */
  const annunci = casaIntorno({ ce: false });
  assert.equal(apriLaMappaDiCasa("person.giovanni"), false);
  assert.equal(annunci.length, 0);
  senzaCornice();
});

test("senza cornice — la plancia aperta per conto suo — resta il link", () => {
  senzaCornice();
  assert.equal(apriLaMappaDiCasa("person.giovanni"), false);
});

test("senza entità non c'è nessuna scheda da chiedere", () => {
  const annunci = casaIntorno();
  assert.equal(apriLaMappaDiCasa(""), false);
  assert.equal(apriLaMappaDiCasa(null), false);
  assert.equal(apriLaMappaDiCasa("   "), false);
  assert.equal(annunci.length, 0);
  senzaCornice();
});

test("un pannello che non sa ascoltare non fa cadere il tocco", () => {
  /* Qui non si sa cosa ci sia dall'altra parte: se non si può annunciare si
   * risponde di no, e il link fa il suo mestiere. */
  globalThis.frameElement = { getRootNode: () => ({ host: {} }) };
  globalThis.parent = { document: { querySelector: () => ({}) } };
  assert.equal(apriLaMappaDiCasa("person.giovanni"), false);
  globalThis.frameElement = {
    getRootNode: () => ({
      host: {
        ownerDocument: { defaultView: { CustomEvent } },
        dispatchEvent: () => {
          throw new Error("niente da fare");
        },
      },
    }),
  };
  assert.equal(apriLaMappaDiCasa("person.giovanni"), false);
  senzaCornice();
});
