/* La riga «Transfer» dice il vero, anche quando mentire sarebbe comodo.
 *
 * Serve a rispondere alla domanda che e' costata un rilascio: «nulla e'
 * cambiato». Se la riga dicesse «compressi» di una plancia che arriva in
 * chiaro, sarebbe peggio di non averla — si smetterebbe di cercare proprio
 * dove il guasto e'.
 *
 * Le due bugie possibili, tutt'e due segnalate in revisione:
 *
 *   - un carico mezzo in cache. Chi era gia' in cache non ha viaggiato
 *     (`transferSize` zero) ma pesa lo stesso da disteso: ricavare la
 *     compressione dal rapporto fra trasferito e disteso fa sembrare compresso
 *     qualunque secondo avvio;
 *   - le risorse di Home Assistant intorno. Sommarle vorrebbe dire dare
 *     megabyte che non sono della plancia, e rispondere a una domanda diversa
 *     da quella che si e' fatta.
 *
 * La compressione si legge dove sta scritta: `encodedBodySize` contro
 * `decodedBodySize` — il corpo come e' arrivato contro il corpo disteso.
 */
import assert from "node:assert/strict";
import test from "node:test";

const CASA = new URL("../", import.meta.url).href;

const { pesoScaricato } = await import(`../legacy/modules-entry.js?peso=${Date.now()}`);

/* Una risorsa come la descrive il browser. `dalFilo` a zero e' la cache: il
 * corpo c'e', ma non ha viaggiato. */
function risorsa({ nome = "legacy/x.js", dalFilo, codificato, disteso }) {
  return {
    name: `${CASA}${nome}`,
    transferSize: dalFilo,
    encodedBodySize: codificato,
    decodedBodySize: disteso,
  };
}

function conQuesteRisorse(elenco, prova) {
  const prima = performance.getEntriesByType;
  performance.getEntriesByType = (tipo) => (tipo === "resource" ? elenco : []);
  try {
    return prova();
  } finally {
    performance.getEntriesByType = prima;
  }
}

const MB = 1048576;

test("meta' dalla cache non fa sembrare compressa una plancia in chiaro", () => {
  /* Questa e' la bugia comoda: al secondo avvio meta' roba viene dalla cache,
   * il trasferito crolla, e un rapporto fra trasferito e disteso griderebbe
   * «compressi» senza che un solo byte lo sia. */
  const detto = conQuesteRisorse(
    [
      risorsa({ nome: "legacy/a.js", dalFilo: 0, codificato: 2 * MB, disteso: 2 * MB }),
      risorsa({ nome: "legacy/b.js", dalFilo: 2 * MB, codificato: 2 * MB, disteso: 2 * MB }),
    ],
    pesoScaricato,
  );
  assert.match(detto, /non compressi/, `la riga mente: «${detto}»`);
});

test("quando i byte arrivano davvero compressi, lo dice", () => {
  const detto = conQuesteRisorse(
    [risorsa({ nome: "legacy/a.js", dalFilo: 1 * MB, codificato: 1 * MB, disteso: 5 * MB })],
    pesoScaricato,
  );
  assert.match(detto, /compressi/);
  assert.doesNotMatch(detto, /non compressi/, `la riga mente: «${detto}»`);
  assert.match(detto, /1\.0 MB di 5\.0 MB/, `il peso non torna: «${detto}»`);
});

test("le risorse di Home Assistant intorno non entrano nel conto", () => {
  /* La plancia sta dentro un riquadro, e li' l'elenco e' gia' solo suo. Ma non
   * e' detto che valga sempre, e un numero che comprende cio' che ha scaricato
   * il resto della pagina risponde a una domanda diversa da quella fatta. */
  const detto = conQuesteRisorse(
    [
      risorsa({ nome: "legacy/a.js", dalFilo: 1 * MB, codificato: 1 * MB, disteso: 5 * MB }),
      {
        name: "https://casa.example/frontend_latest/roba-di-home-assistant.js",
        transferSize: 40 * MB,
        encodedBodySize: 40 * MB,
        decodedBodySize: 40 * MB,
      },
    ],
    pesoScaricato,
  );
  assert.match(detto, /1\.0 MB di 5\.0 MB/, `ha contato roba non sua: «${detto}»`);
});

test("tutto dalla cache si dice, non si finge", () => {
  const detto = conQuesteRisorse(
    [risorsa({ nome: "legacy/a.js", dalFilo: 0, codificato: 1 * MB, disteso: 5 * MB })],
    pesoScaricato,
  );
  assert.match(detto, /dalla cache/, `la riga non dice che non ha viaggiato: «${detto}»`);
});

test("senza il peso codificato non si dichiara nulla, si dice che manca", () => {
  /* Il campo che dice quanto pesava il corpo com'e' arrivato non c'e' sempre.
   * Quando manca vale zero, e zero finiva nel ramo «non compressi»: la riga
   * dichiarava una cosa che non aveva misurato, ed e' cosi' che una
   * diagnostica fa cercare il guasto dalla parte sbagliata — peggio che non
   * averla. Il peso disteso invece si sa, e si dice. */
  const detto = conQuesteRisorse(
    [risorsa({ nome: "legacy/a.js", dalFilo: 0, codificato: 0, disteso: 5 * MB })],
    pesoScaricato,
  );
  assert.doesNotMatch(detto, /non compressi/, `dichiara senza aver misurato: «${detto}»`);
  assert.match(detto, /non disponibile/, `non dice che il dato manca: «${detto}»`);
  assert.match(detto, /5\.0 MB/, `perde il peso che invece conosce: «${detto}»`);
});

test("dove il browser non riempie quei campi, la riga non inventa", () => {
  /* Non tutti i browser danno `encodedBodySize` e `transferSize`. Dire «?» e'
   * la risposta onesta; inventare uno zero direbbe «non compressi» di una
   * plancia che magari lo e'. */
  const detto = conQuesteRisorse(
    [{ name: `${CASA}legacy/a.js` }, { name: `${CASA}legacy/b.js` }],
    pesoScaricato,
  );
  assert.equal(detto, "?");
});
