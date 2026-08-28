/* Il foglio di stile del guscio, quando non arriva.
 *
 * Segnalato con la console aperta: «this page failed to load a stylesheet from
 * a URL — dashboard-runtime-it.css», e la pagina Energia con due archi
 * tratteggiati appesi al nulla. Poi, guardando la stessa pagina: «dopo
 * parecchio tempo li ha caricati».
 *
 * Il file c'e' e pesa duecentosessantaquattro kilobyte: e' la richiesta che si
 * perde o arriva tardissimo. Finche' non arriva, quello che ha lo stile solo
 * li' — i cerchi del flusso — resta invisibile, mentre il resto della plancia
 * sembra a posto perche' i moduli portano il proprio stile con se'.
 */
import assert from "node:assert/strict";
import test from "node:test";

const KEY = "__DASHBOARDMODERN_FOGLIO_GUSCIO__";

/* Un documento finto quel tanto che basta: i `<link>` che dichiara e i fogli
 * che sono davvero arrivati sono due liste diverse, ed e' proprio quella
 * differenza che il modulo guarda. */
function casa({ dichiarati, arrivati }) {
  const aggiunti = [];
  const nodi = dichiarati.map((href) => ({
    getAttribute: (nome) => (nome === "href" ? href : null),
    after(nodo) {
      aggiunti.push(nodo);
    },
  }));
  return {
    aggiunti,
    documento: {
      readyState: "complete",
      styleSheets: arrivati.map((href) => ({ href })),
      querySelectorAll: () => nodi,
      createElement: () => ({ rel: "", href: "", dataset: {} }),
    },
  };
}

async function conDocumento(mondo, prova) {
  const precedenti = {
    doc: globalThis.document,
    stato: globalThis[KEY],
    setTimeout: globalThis.setTimeout,
  };
  globalThis.document = mondo.documento;
  delete globalThis[KEY];
  // I rinvii non devono far aspettare la prova: qui interessa il primo giro.
  globalThis.setTimeout = () => 0;
  try {
    const modulo = await import(`../src/sections/foglio-del-guscio-section.js?${Date.now()}`);
    await prova(modulo);
  } finally {
    globalThis.document = precedenti.doc;
    globalThis[KEY] = precedenti.stato;
    globalThis.setTimeout = precedenti.setTimeout;
  }
}

test("un foglio che non e' arrivato si richiede", async () => {
  const mondo = casa({
    dichiarati: ["./dashboard-runtime-it.css", "./dashboard-runtime.css"],
    // Il piccolo e' arrivato, il grosso no: e' il caso della segnalazione.
    arrivati: ["https://casa/dashboard-runtime.css"],
  });
  await conDocumento(mondo, ({ foglioArrivato, controllaFoglio }) => {
    assert.equal(foglioArrivato(), false, "il foglio grosso non e' arrivato");
    assert.equal(controllaFoglio(), false, "il modulo non se n'e' accorto");
    assert.equal(mondo.aggiunti.length, 1, "non ha richiesto niente");
    // Stesso indirizzo, coda diversa: senza, il browser ridarebbe la risposta
    // fallita che ha gia' in mano.
    assert.match(mondo.aggiunti[0].href, /dashboard-runtime-it\.css\?dm-riprova=1/);
    assert.equal(mondo.aggiunti[0].rel, "stylesheet");
  });
});

test("il foglio piccolo da solo non conta per arrivato", async () => {
  const mondo = casa({
    dichiarati: ["./dashboard-runtime.css"],
    arrivati: ["https://casa/dashboard-runtime.css"],
  });
  await conDocumento(mondo, ({ foglioArrivato, controllaFoglio }) => {
    assert.equal(foglioArrivato(), false, "dodici kilobyte non sono duecentosessantaquattro");
    // Ma se il guscio non dichiara affatto quel foglio non c'e' niente da
    // richiedere: una plancia servita in un altro modo non si tocca.
    assert.equal(controllaFoglio(), true);
    assert.equal(mondo.aggiunti.length, 0);
  });
});

test("quando il foglio c'e' non si tocca niente", async () => {
  const mondo = casa({
    dichiarati: ["./dashboard-runtime-it.css"],
    arrivati: ["https://casa/dashboard-runtime-it.css"],
  });
  await conDocumento(mondo, ({ foglioArrivato, controllaFoglio }) => {
    assert.equal(foglioArrivato(), true);
    assert.equal(controllaFoglio(), true);
    assert.equal(mondo.aggiunti.length, 0, "ha richiesto un foglio che era gia' li'");
  });
});

test("si riprova tre volte, non per sempre", async () => {
  const mondo = casa({ dichiarati: ["./dashboard-runtime-en.css"], arrivati: [] });
  await conDocumento(mondo, ({ controllaFoglio }) => {
    for (let giro = 0; giro < 6; giro += 1) controllaFoglio();
    assert.equal(mondo.aggiunti.length, 3, "insistere all'infinito non e' recupero");
    assert.deepEqual(
      mondo.aggiunti.map((n) => n.dataset.dmFoglioRiprovato),
      ["1", "2", "3"],
    );
  });
});
