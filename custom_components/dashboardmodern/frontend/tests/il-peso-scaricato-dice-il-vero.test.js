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

/* La riga «Boot» dice quando il velo se ne va, e non si corrompe da sola.
 *
 * Tre punti, tutti e tre segnalati in revisione e tutti e tre veri:
 *
 *   - `__DASHBOARDMODERN_READY__` non e' il velo. `cdHideBoot` alza quella
 *     bandiera PRIMA di mettersi ad aspettare moduli e fogli, e il velo puo'
 *     restare li' per secondi: misurarla sottostima proprio il tempo che si
 *     sente. Adesso il momento lo segna chi il velo lo toglie davvero;
 *   - la Diagnostica, aprendosi, chiede `panel.js` per sapere come arrivano i
 *     file. Quella richiesta e' una risorsa come le altre, e minuti dopo
 *     l'avvio diventerebbe «l'ultimo file», schiacciando a zero il tempo dopo
 *     la rete: la misura si corromperebbe guardando se stessa;
 *   - il documento non e' una «risorsa»: sta nella voce di navigazione. Sono
 *     centosei kB, e lasciarli fuori vorrebbe dire contarne lo scaricamento
 *     come lavoro del browser.
 */
const { tempoDiAvvio } = await import(`../legacy/modules-entry.js?boot=${Date.now()}`);

function conQuestoAvvio({ risorse = [], navigazione = null, veloVia }, prova) {
  const prima = performance.getEntriesByType;
  const primaVelo = globalThis.__DASHBOARDMODERN_VELO_VIA__;
  performance.getEntriesByType = (tipo) =>
    tipo === "resource" ? risorse : tipo === "navigation" ? (navigazione ? [navigazione] : []) : [];
  if (veloVia === undefined) delete globalThis.__DASHBOARDMODERN_VELO_VIA__;
  else globalThis.__DASHBOARDMODERN_VELO_VIA__ = veloVia;
  try {
    return prova();
  } finally {
    performance.getEntriesByType = prima;
    if (primaVelo === undefined) delete globalThis.__DASHBOARDMODERN_VELO_VIA__;
    else globalThis.__DASHBOARDMODERN_VELO_VIA__ = primaVelo;
  }
}

const fine = (nome, responseEnd) => ({ name: `${CASA}${nome}`, responseEnd });

test("il tempo e' quello del velo, non quello della bandiera", () => {
  const detto = conQuestoAvvio(
    { risorse: [fine("legacy/a.js", 2000)], veloVia: 6000 },
    tempoDiAvvio,
  );
  assert.match(detto, /velo via a 6\.0 s/, `non misura il velo: «${detto}»`);
  assert.match(detto, /4\.0 s dopo la rete/, `il conto dopo la rete non torna: «${detto}»`);
});

test("la richiesta della Diagnostica non diventa «l'ultimo file»", () => {
  /* `panel.js` chiesto quando si apre il pannello, molto dopo l'avvio. */
  const detto = conQuestoAvvio(
    { risorse: [fine("legacy/a.js", 2000), fine("panel.js", 300000)], veloVia: 6000 },
    tempoDiAvvio,
  );
  assert.match(detto, /ultimo file a 2\.0 s/, `si e' contata addosso: «${detto}»`);
  assert.match(detto, /4\.0 s dopo la rete/, `il tempo dopo la rete e' sparito: «${detto}»`);
});

test("il documento conta come rete, non come lavoro del browser", () => {
  const detto = conQuestoAvvio(
    { risorse: [fine("legacy/a.js", 1000)], navigazione: { responseEnd: 5000 }, veloVia: 6000 },
    tempoDiAvvio,
  );
  assert.match(detto, /ultimo file a 5\.0 s/, `il guscio non e' contato: «${detto}»`);
  assert.match(
    detto,
    /1\.0 s dopo la rete/,
    `il guscio finisce fra il lavoro del browser: «${detto}»`,
  );
});

test("senza il segno del velo non si inventa un tempo", () => {
  const detto = conQuestoAvvio({ risorse: [fine("legacy/a.js", 2000)] }, tempoDiAvvio);
  assert.match(detto, /velo non misurato/, `dichiara un avvio che non ha visto: «${detto}»`);
});

/* La riga non si contraddice: la risposta letta zittisce la deduzione.
 *
 * Dal campo: «4.9 MB dalla cache — non compressi · servito br». Due frasi
 * opposte sullo stesso file, una in fila all'altra. La prima e' una deduzione
 * dai pesi — e dalla cache i pesi non dicono come sia arrivato — la seconda e'
 * la risposta del server. Quando c'e' la seconda, la prima va tolta: una
 * diagnostica che si contraddice non si legge, si scavalca.
 */
const { chiediComeArrivano } = await import(`../legacy/modules-entry.js?come=${Date.now()}`);

function conRisposta(intestazione, testoIniziale, prova) {
  const nodo = { textContent: testoIniziale };
  const finto = { querySelector: (selettore) => (selettore.includes("Transfer") ? nodo : null) };
  const primaFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    headers: { get: (nome) => (nome === "content-encoding" ? intestazione : null) },
  });
  return Promise.resolve(prova(finto, nodo)).finally(() => {
    globalThis.fetch = primaFetch;
  });
}

test("quando il server risponde «br», la deduzione dai pesi si toglie", async () => {
  await conRisposta("br", "4.9 MB dalla cache — non compressi", async (finto, nodo) => {
    await chiediComeArrivano(finto);
    assert.equal(nodo.textContent, "4.9 MB dalla cache · servito br");
    assert.doesNotMatch(nodo.textContent, /non compressi/, `si contraddice: «${nodo.textContent}»`);
  });
});

test("e vale per tutte e tre le deduzioni, non solo per una", async () => {
  for (const dedotto of ["compressi", "non compressi", "peso codificato non disponibile"])
    await conRisposta("gzip", `1.2 MB di 4.9 MB — ${dedotto}`, async (finto, nodo) => {
      await chiediComeArrivano(finto);
      assert.equal(nodo.textContent, "1.2 MB di 4.9 MB · servito gzip");
    });
});

test("senza intestazione lo dice, e la deduzione se ne va lo stesso", async () => {
  /* «in chiaro» e' anch'esso una risposta letta: vale piu' della deduzione. */
  await conRisposta(null, "4.9 MB dalla cache — compressi", async (finto, nodo) => {
    await chiediComeArrivano(finto);
    assert.equal(nodo.textContent, "4.9 MB dalla cache · servito in chiaro");
  });
});
