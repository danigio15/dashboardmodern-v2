/* La stampante dice se è pronta, e quanto inchiostro le resta (#469).
 *
 * «Volevo chiedere se c'era la possibilità del controllo delle tv e
 * stampanti.»
 *
 * Le due domande sono sempre quelle due, e queste prove le tengono ferme
 * tutt'e due: che gli stati arrivino nei dialetti delle integrazioni — IPP dice
 * `idle`, `printing`, `stopped`; qualcuna dice `on` e `off` — e che le
 * cartucce si trovino da sole, che è la parte che a mano nessuno scriverebbe
 * giusta la prima volta.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  CHIAVE_STAMPANTI,
  COLORE_SENZA_TINTA,
  MASSIMO_STAMPANTI,
  TINTE_DELLE_CARTUCCE,
  cartucceTrovate,
  coloreDellaCartuccia,
  tintaDellaCartuccia,
  entitaDelleStampanti,
  letturaDellaCartuccia,
  letturaDellaStampante,
  lettureDelleStampanti,
  normalizzaStampanti,
  riassuntoDelleStampanti,
  stampantiConfigurate,
  statoDellaStampante,
} from "../src/core/stampanti-model.js";
import { CONFIG_KEYS } from "../src/core/chiavi-di-configurazione.js";

const leggi = (percorso) => readFile(new URL(`../src/${percorso}`, import.meta.url), "utf8");

const CASA = {
  "sensor.laser_ufficio": { state: "idle", attributes: { friendly_name: "Laser ufficio" } },
  "sensor.laser_ufficio_nero": {
    state: "8",
    attributes: { unit_of_measurement: "%", friendly_name: "Nero" },
  },
  "sensor.laser_ufficio_ciano": {
    state: "64",
    attributes: { unit_of_measurement: "%", friendly_name: "Ciano" },
  },
  "sensor.laser_ufficio_pagine": {
    state: "1240",
    attributes: { unit_of_measurement: "pagine", friendly_name: "Pagine" },
  },
  /* Una trappola vera: il contatore delle pagine in bianco e nero ha «nero»
   * nel nome ma conta fogli, non percentuale. */
  "sensor.laser_ufficio_pagine_nero": {
    state: "980",
    attributes: { unit_of_measurement: "pagine", friendly_name: "Pagine nero" },
  },
};

test("gli stati arrivano nei dialetti delle integrazioni", () => {
  assert.equal(statoDellaStampante("idle"), "pronta");
  assert.equal(statoDellaStampante("printing"), "stampa");
  assert.equal(statoDellaStampante("stopped"), "ferma");
  assert.equal(statoDellaStampante("on"), "pronta");
  assert.equal(statoDellaStampante("off"), "spenta");
  assert.equal(statoDellaStampante("unavailable"), "muta");
  assert.equal(statoDellaStampante(""), "muta");
  /* Uno stato che non conosciamo non è un errore: è un dialetto in più, e
   * chiamarlo «ferma» vorrebbe dire accendere un rosso per niente. */
  assert.equal(statoDellaStampante("scanning"), "altro");
});

test("le cartucce si trovano da sole, e un contapagine non è una cartuccia", () => {
  const trovate = cartucceTrovate("sensor.laser_ufficio", CASA);
  assert.deepEqual(trovate, ["sensor.laser_ufficio_ciano", "sensor.laser_ufficio_nero"]);
  assert.ok(
    !trovate.includes("sensor.laser_ufficio_pagine_nero"),
    "il contapagine è entrato fra le cartucce",
  );
});

test("anche la cartuccia tricromia è una cartuccia", () => {
  /* Le stampanti a getto piccole hanno due cartucce sole: nero e «colore».
   * Cercando solo i nomi dei quattro colori, la seconda spariva — e la barra
   * che manca è peggio di nessuna barra, perché sembra che ce ne sia una sola. */
  const casa = {
    "sensor.mfp": { state: "idle", attributes: { friendly_name: "Multifunzione" } },
    "sensor.mfp_nero": {
      state: "73",
      attributes: { unit_of_measurement: "%", friendly_name: "Nero" },
    },
    "sensor.mfp_colore": {
      state: "18",
      attributes: { unit_of_measurement: "%", friendly_name: "Colore" },
    },
  };
  const lettura = letturaDellaStampante({ entity: "sensor.mfp" }, casa);
  assert.equal(lettura.cartucce.length, 2);
  assert.equal(lettura.piuScarica.quanta, 18);
});

test("una cartuccia porta il colore vero del suo nome", () => {
  assert.equal(coloreDellaCartuccia("Nero"), "#0f2942");
  assert.equal(coloreDellaCartuccia("sensor.hp_cyan_ink"), "#06b6d4");
  assert.equal(coloreDellaCartuccia("Magenta"), "#d946ef");
  assert.equal(coloreDellaCartuccia("Giallo"), "#eab308");
  /* Quello che non si riconosce prende l'accento, non il nero: un colore
   * sbagliato dice una cosa falsa, l'accento dice «non lo so». */
  assert.equal(coloreDellaCartuccia("Serbatoio"), "#0ea5e9");
  const nero = letturaDellaCartuccia("sensor.laser_ufficio_nero", CASA);
  assert.equal(nero.quanta, 8);
  assert.equal(nero.agliSgoccioli, true);
  assert.equal(nero.scarsa, true);
});

test("la lettura mette insieme stato, cartucce e pagine", () => {
  const lettura = letturaDellaStampante(
    { entity: "sensor.laser_ufficio", pagine: "sensor.laser_ufficio_pagine" },
    CASA,
  );
  assert.equal(lettura.stato, "pronta");
  assert.equal(lettura.nome, "Laser ufficio");
  assert.equal(lettura.cartucce.length, 2);
  assert.equal(lettura.piuScarica.quanta, 8);
  assert.equal(lettura.pagine, 1240);
  /* Una stampante che non risponde non è una stampante pronta. */
  const muta = letturaDellaStampante({ entity: "sensor.mai_vista" }, CASA);
  assert.equal(muta.stato, "muta");
  assert.equal(muta.muta, true);
});

test("le cartucce scritte a mano vincono sull'indovinello", () => {
  const lettura = letturaDellaStampante(
    { entity: "sensor.laser_ufficio", cartucce: ["sensor.laser_ufficio_ciano"] },
    CASA,
  );
  assert.deepEqual(
    lettura.cartucce.map((voce) => voce.entity),
    ["sensor.laser_ufficio_ciano"],
  );
});

test("il verdetto della tessera segue l'ordine di chi fa alzare la testa", () => {
  const ferma = { ferma: true, stampa: false, muta: false, piuScarica: null };
  const sgoccioli = {
    ferma: false,
    stampa: false,
    muta: false,
    piuScarica: { quanta: 4, agliSgoccioli: true },
  };
  const stampa = { ferma: false, stampa: true, muta: false, piuScarica: null };
  const pronta = { ferma: false, stampa: false, muta: false, piuScarica: null };
  assert.equal(riassuntoDelleStampanti([ferma, sgoccioli, stampa]).verdetto, "ferma");
  assert.equal(riassuntoDelleStampanti([sgoccioli, stampa, pronta]).verdetto, "inchiostro");
  assert.equal(riassuntoDelleStampanti([stampa, pronta]).verdetto, "stampa");
  assert.equal(riassuntoDelleStampanti([pronta]).verdetto, "pronta");
  assert.equal(riassuntoDelleStampanti([]).verdetto, "pronta");
});

test("la configurazione non tiene doppioni, righe vuote né file infinite", () => {
  const righe = normalizzaStampanti([
    { entity: "sensor.a" },
    { entity: "sensor.a", nome: "doppia" },
    { entity: "" },
    ...Array.from({ length: 20 }, (_, i) => ({ entity: `sensor.b${i}` })),
  ]);
  assert.equal(righe.length, MASSIMO_STAMPANTI);
  assert.equal(righe[0].entity, "sensor.a");
  assert.equal(stampantiConfigurate([]), false);
  assert.equal(stampantiConfigurate([{ entity: "sensor.a" }]), true);
});

test("le entità delle stampanti passano il cancello degli stati", () => {
  /* Quello che non è configurato non merita un ridisegno: se le cartucce
   * trovate non entrassero in questo elenco, le barre resterebbero ferme
   * sull'ultimo valore finché non si muove qualcos'altro. */
  const elenco = entitaDelleStampanti(
    [{ entity: "sensor.laser_ufficio", pagine: "sensor.laser_ufficio_pagine" }],
    CASA,
  );
  assert.ok(elenco.includes("sensor.laser_ufficio"));
  assert.ok(elenco.includes("sensor.laser_ufficio_nero"));
  assert.ok(elenco.includes("sensor.laser_ufficio_pagine"));
  assert.ok(CONFIG_KEYS.includes(CHIAVE_STAMPANTI));
});

test("la sezione e la scheda esistono, e il modello resta puro", async () => {
  const modello = await leggi("core/stampanti-model.js");
  /* Un modulo puro che sputa markup non si può più provare senza un
   * documento: qui dentro non ci va HTML. */
  assert.ok(!modello.includes("<span"), "nel modello è finito del markup");
  assert.ok(!/\bdocument\.|\bwindow\./.test(modello), "il modello guarda il documento");
  const pagina = await leggi("sections/stampanti-section.js");
  assert.ok(pagina.includes("page-stampanti"));
  assert.ok(pagina.includes('disegnoDelCatalogo("printer"'), "la pagina non usa il nostro disegno");
  const scheda = await leggi("sections/stampanti-editor-section.js");
  assert.ok(scheda.includes("wzPickEntity"), "la scheda non fa scegliere l'entità");
  /* La lente manda un `change` senza bolle: senza la cattura, l'entità scelta
   * col dito non verrebbe mai salvata. */
  assert.ok(
    scheda.includes('doc.addEventListener("change", onChange, true)'),
    "il cambio non è preso in cattura",
  );
  assert.equal(lettureDelleStampanti([], CASA).length, 0);
});

/* ── quello che la revisione della #481 ha trovato ─────────────────────── */

test("una stampante ferma e agli sgoccioli si conta una volta sola", async () => {
  /* Stava in tutt'e due gli elenchi, e sommarli la contava due volte: la
   * tessera diceva «2» con sotto scritto «1 ferma», e chi legge si chiede quale
   * sia l'altra. Sono le stampanti che hanno qualcosa da dire, non le ragioni
   * per dirlo. */
  const tessere = await readFile(
    new URL("../src/sections/home-widgets-section.js", import.meta.url),
    "utf8",
  );
  assert.match(
    tessere,
    /const daDire = new Set\(\s*\n?\s*\[\.\.\.riassunto\.ferme, \.\.\.riassunto\.sgoccioli\]\.map\(\(lettura\) => lettura\.entity\),\s*\n?\s*\)\.size;/,
  );
});

/* ── «per i due colori uno mi fa la slide colorata e l'altra no» ───────── */

test("la barra del nero si vede anche sulla plancia scura", async () => {
  /* Una HP DeskJet 4100 ha due cartucce: il nero e la tricromia. Il colore del
   * nero è `#0f2942`, cioè quasi il fondo di una tavolozza scura — e la barra
   * del nero spariva dentro la sua stessa pista, mentre quella a colori si
   * vedeva benissimo. Due cartucce, una barra sola. */
  const nera = letturaDellaCartuccia("sensor.hp_deskjet_4100_series_black_ink", {
    "sensor.hp_deskjet_4100_series_black_ink": {
      state: "60",
      attributes: { unit_of_measurement: "%", friendly_name: "Black ink" },
    },
  });
  const colori = letturaDellaCartuccia("sensor.hp_deskjet_4100_series_tri_color_ink", {
    "sensor.hp_deskjet_4100_series_tri_color_ink": {
      state: "50",
      attributes: { unit_of_measurement: "%", friendly_name: "Tri-color ink" },
    },
  });
  assert.equal(nera.tinta, "nero");
  assert.equal(colori.tinta, "colore");
  /* Il colore vero resta quello: sul chiaro il nero è nero. Sta nell'elenco,
   * non nella lettura — a disegnarlo ci pensa il foglio di stile. */
  assert.equal(coloreDellaCartuccia("sensor.hp_deskjet_4100_series_black_ink"), "#0f2942");

  const pagina = await leggi("sections/stampanti-section.js");
  assert.ok(
    pagina.includes('data-tinta="${esc(cartuccia.tinta)}"'),
    "la barra non dice quale cartuccia sta disegnando",
  );
  /* Questa è la prova che la prima volta è mancata: la regola del fondo scuro
   * c'era già, e non valeva niente. Un colore scritto nell'attributo `style`
   * della riga vince su qualunque regola del foglio — è una regola della
   * cascata, non una svista del browser — e la barra del nero restava nera su
   * fondo nero. Finché la riga non porta un colore addosso, la regola vale. */
  assert.ok(
    !/style="--dm-cart/.test(pagina),
    "la riga si scrive il colore addosso: nessuna regola potrà più cambiarlo",
  );
  /* `${P}` in mezzo porta una graffa: le regole si cercano a pezzi, non con
   * un\'espressione che si ferma alla prima. */
  const righe = pagina.split("\n");
  const chiaro = righe.findIndex((riga) =>
    riga.includes('.dm-stampante-cart[data-tinta="${tinta}"]{--dm-cart:${colore}}'),
  );
  assert.ok(chiaro >= 0, "il colore della tinta non lo scrive il foglio di stile");
  const scuro = righe.findIndex(
    (riga) =>
      riga.includes('html[data-theme="dark"]') &&
      riga.includes('.dm-stampante-cart[data-tinta="nero"]'),
  );
  assert.ok(scuro >= 0, "sul fondo scuro non c\'e\' una regola per il nero");
  /* E dopo, non prima: a parità di peso vince l'ultima scritta. */
  assert.ok(scuro > chiaro, "la regola del fondo scuro viene prima di quella che deve scavalcare");
  assert.match(
    righe.slice(scuro, scuro + 3).join("\n"),
    /--dm-cart:#e2e8f0/,
    "sul fondo scuro il nero resta nero, e non si vede",
  );
});

test("il colore della cartuccia non finisce mai nella lettura", () => {
  /* La lettura dice che cartuccia è; di che colore si disegna lo sa il foglio
   * di stile. Se il colore torna nella lettura, torna anche l'attributo
   * `style` che se lo scrive addosso, e con quello il bug. */
  const nera = letturaDellaCartuccia("sensor.stampante_nero", {
    "sensor.stampante_nero": {
      state: "40",
      attributes: { unit_of_measurement: "%", friendly_name: "Nero" },
    },
  });
  assert.equal(nera.tinta, "nero");
  assert.ok(!("colore" in nera), "la lettura si porta dietro un colore che nessuno disegna");
});

test("la tinta e il colore escono dallo stesso elenco", async () => {
  /* Erano due elenchi da tenere allineati a mano: il giorno che se ne aggiunge
   * una, una delle due dimentica. */
  const modello = await leggi("core/stampanti-model.js");
  assert.equal((modello.match(/nero\|black\|k/g) || []).length, 1);
  for (const nome of ["nero", "ciano", "magenta", "giallo", "colore", "foto"]) {
    assert.equal(tintaDellaCartuccia(`sensor.stampante ${nome}`), nome);
  }
  assert.equal(tintaDellaCartuccia("sensor.stampante boh"), "altra");
  assert.equal(coloreDellaCartuccia("sensor.stampante boh"), COLORE_SENZA_TINTA);
  /* L'elenco che va a disegnarsi è lo stesso, non una copia da tenere allineata. */
  assert.deepEqual(
    TINTE_DELLE_CARTUCCE.map(({ tinta }) => tinta),
    ["nero", "ciano", "magenta", "giallo", "colore", "foto"],
  );
  for (const { tinta, colore } of TINTE_DELLE_CARTUCCE) {
    assert.equal(coloreDellaCartuccia(`sensor.stampante ${tinta}`), colore);
  }
});
