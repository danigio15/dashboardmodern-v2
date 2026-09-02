/* La finestra di una tessera dice cosa sta succedendo, non elenca.
 *
 * «Il popup smette di essere un elenco e dice cosa sta facendo l'impianto, da
 * quanto, e dove va a finire.» E una forma sola per tutte: «Diciassette
 * sezioni. Stesso ordine, sempre: il verdetto, la frase, la misura con la sua
 * corsa, le caselle, i comandi.»
 *
 * Qui si prova la parte che si ragiona — il verdetto e la frase — perche' e'
 * quella che si sbaglia in silenzio: una frase che dice «2 zone su 5» quando
 * ne sono accese tre e' sbagliata senza rompersi, e a occhio non si vede.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  bricioleDellaSezione,
  daQuanto,
  fraseDellaTessera,
  verdettoDellaTessera,
} from "../src/core/racconto-tessera.js";

test("il verdetto dice quale delle tre cose e', e in che ordine", () => {
  assert.equal(verdettoDellaTessera({}).tono, "bene");
  assert.equal(verdettoDellaTessera({ attiva: true }).tono, "corso");
  assert.equal(verdettoDellaTessera({ alert: true }).tono, "guarda");
  // Una finestra aperta batte una lavatrice in funzione: se c'e' qualcosa da
  // guardare lo si dice, anche se nel frattempo qualcos'altro sta lavorando.
  assert.equal(verdettoDellaTessera({ alert: true, attiva: true }).tono, "guarda");
});

/* La lingua non e' «italiano o inglese».
 *
 * Prima si passava un booleano, e per tutte le altre tredici lingue della
 * plancia quel booleano era falso: uno spagnolo si trovava «Tutto regolare» in
 * mezzo a comandi tradotti. Adesso si passa la funzione che traduce, la stessa
 * del resto della plancia, e chi non ha la sua parola nel catalogo vede
 * l'inglese — che e' il ripiego dichiarato del progetto. */
test("il verdetto passa da chi traduce, non da un interruttore a due posizioni", () => {
  const italiano = (it) => it;
  const inglese = (_it, en) => en;
  const spagnolo = (_it, en) => ({ "All clear": "Todo en orden" })[en] ?? en;
  assert.equal(verdettoDellaTessera({}, italiano).testo, "Tutto regolare");
  assert.equal(verdettoDellaTessera({}, inglese).testo, "All clear");
  assert.equal(verdettoDellaTessera({}, spagnolo).testo, "Todo en orden");
});

/* Luci, clima, tapparelle ed elettrodomestici non scrivono `attiva`: dicono di
 * essere in moto con l'anello acceso, ed e' la regola che usa la mattonella. */
test("il verdetto guarda l'anello, come fa la mattonella", () => {
  assert.equal(verdettoDellaTessera({ ring: 2 }).tono, "corso");
  assert.equal(verdettoDellaTessera({ ring: 0 }).tono, "bene");
  // Chi lo dice esplicitamente comanda lui.
  assert.equal(verdettoDellaTessera({ attiva: false, ring: 9 }).tono, "bene");
  assert.equal(verdettoDellaTessera({ attiva: true, ring: 0 }).tono, "corso");
});

test("il tempo si dice come lo direbbe una persona", () => {
  assert.equal(daQuanto(40), "da 40 minuti");
  assert.equal(daQuanto(1), "da 1 minuto");
  assert.equal(daQuanto(60), "da un'ora");
  assert.equal(daQuanto(80), "da un'ora e 20");
  assert.equal(daQuanto(180), "da 3 ore");
  assert.equal(daQuanto(60 * 24 * 2), "da 2 giorni");
  assert.equal(daQuanto(0), "da poco");
  assert.equal(daQuanto(80, (_it, en) => en), "for 1h 20m");
});

/* Una tapparella dice di essere aperta con `open`, non con la posizione: il
 * contatto di una finestra la posizione non ce l'ha, e `Number(null)` fa zero —
 * cosi' una finestra spalancata risultava chiusa. */
test("le tapparelle si contano da come dicono di stare, non dalla posizione", () => {
  const soloContatti = {
    key: "tapparelle",
    rows: [
      { open: true, position: null },
      { open: false, position: null },
    ],
  };
  assert.equal(fraseDellaTessera(soloContatti), "1 aperte su 2, le altre chiuse.");
  const conPosizione = {
    key: "tapparelle",
    rows: [{ position: 60 }, { position: 0 }],
  };
  assert.equal(fraseDellaTessera(conPosizione), "1 aperte su 2, le altre chiuse.");
});

/* Le cose da fare non stanno in `rows`: quella tessera tiene le liste in
 * `blocks`, e contando le righe usciva sempre «non c'e' niente da fare» anche
 * col numero della mattonella a tre. */
test("le cose da fare si contano da dove stanno davvero", () => {
  const conListe = {
    key: "todo",
    blocks: [
      { items: [{ status: "needs_action" }, { status: "completed" }] },
      { items: [{ status: "needs_action" }] },
    ],
  };
  assert.equal(fraseDellaTessera(conListe), "2 cose ancora da fare.");
  assert.equal(fraseDellaTessera({ key: "todo", blocks: [{ items: [] }] }), "Non c'e' niente da fare.");
});

/* Non tutte le righe dicono `on`: un elettrodomestico dice `mode: "running"`,
 * un aspirapolvere dice il suo stato. Guardando solo `on`, una lavastoviglie in
 * funzione risultava ferma. */
test("una riga in funzione la si riconosce comunque lo dica", () => {
  assert.equal(
    fraseDellaTessera({ key: "elettrodomestici", rows: [{ mode: "running" }, { mode: "idle" }] }),
    "1 su 2 in funzione.",
  );
  assert.equal(
    fraseDellaTessera({ key: "robot", rows: [{ state: "cleaning" }, { state: "docked" }] }),
    "1 su 2 in funzione.",
  );
});

test("la frase conta quello che c'e' davvero", () => {
  const luci = {
    key: "luci",
    rows: [
      { on: true, name: "Lampadario Salone" },
      { on: true, name: "Faretti Cucina" },
      { on: false, name: "Piantana" },
      { on: false, name: "Bagno" },
      { on: false, name: "Ingresso" },
    ],
  };
  assert.equal(
    fraseDellaTessera(luci),
    "2 luci accese su 5: Lampadario Salone e Faretti Cucina e altre.".replace(" e altre", ""),
  );
  assert.equal(fraseDellaTessera({ key: "luci", rows: [{ on: false }, { on: false }] }), "Sono tutte spente.");
});

test("il clima dice quanto manca all'obiettivo, e quando non manca niente lo dice", () => {
  const vicino = {
    key: "clima",
    rows: [
      { on: true, name: "Salotto", ambient: 21.9, target: 22 },
      { on: false, name: "Camera", ambient: 19, target: 21 },
    ],
  };
  assert.match(fraseDellaTessera(vicino), /gia' all'obiettivo/);
  const lontano = {
    key: "clima",
    rows: [
      { on: true, name: "Salotto", ambient: 20, target: 22 },
      { on: true, name: "Camera", ambient: 20, target: 22 },
      { on: false, name: "Studio", ambient: 19, target: 21 },
    ],
  };
  assert.match(fraseDellaTessera(lontano), /^2 zone accese su 3\./);
  assert.match(fraseDellaTessera(lontano), /2,0° all'obiettivo/);
});

test("le sonde che non trovano acqua lo dicono in positivo", () => {
  const asciutto = { key: "allagamenti", rows: Array.from({ length: 6 }, () => ({ on: false })) };
  assert.equal(fraseDellaTessera(asciutto), "Nessuna perdita. Tutte e 6 le sonde hanno risposto.");
  const bagnato = {
    key: "allagamenti",
    rows: [{ on: true, name: "Lavanderia" }, { on: false, name: "Bagno" }],
  };
  assert.match(fraseDellaTessera(bagnato), /C'e' acqua: Lavanderia\./);
});

test("le batterie dicono qual e' la piu' bassa, col suo nome", () => {
  const batterie = {
    key: "batterie",
    rows: [
      { name: "Garage", level: 12 },
      { name: "Ingresso", level: 88 },
      { name: "Cantina", level: 41 },
    ],
  };
  assert.equal(fraseDellaTessera(batterie), "La piu' bassa e' Garage al 12%, su 3.");
});

/* Una sezione senza una frase sua non resta muta, e una sezione vuota lo dice
 * invece di far vedere un buco. */
test("chi non ha una frase sua ne ha comunque una", () => {
  assert.match(fraseDellaTessera({ key: "piscina", rows: [{ on: true }, { on: false }] }), /1 su 2/);
  assert.equal(fraseDellaTessera({ key: "piscina", rows: [] }), "Qui non c'e' ancora niente.");
});

/* Le briciole sotto il titolo sono quelle del progetto approvato. */
test("le briciole del solare termico sono quelle disegnate", () => {
  assert.deepEqual(bricioleDellaSezione("solare"), [
    "Circuito primario",
    "Boiler",
    "Ricircolo sanitario",
  ]);
  assert.deepEqual(bricioleDellaSezione("energia"), ["Produzione", "Consumi", "Report"]);
  /* La tessera adesso si chiama «Porte/Finestre» — «altrimenti si confonde con
   * le altre aperture» — e la briciola non ripete il titolo: dice cosa sta
   * guardando, che sono i contatti. */
  assert.deepEqual(bricioleDellaSezione("aperture", (_it, en) => en), ["Contacts", "Watch"]);
});
