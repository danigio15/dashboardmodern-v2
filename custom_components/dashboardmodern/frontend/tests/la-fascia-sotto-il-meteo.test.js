/* La fascia sotto il meteo su una riga sola, e l'icona che non è nostra.
 *
 * Due cose viste nello stesso giro di segnalazioni, e qui stanno insieme
 * perché sono le due regole pure che ne sono uscite.
 *
 * ── La fascia ───────────────────────────────────────────────────────────────
 * «Deve essere su una riga, quindi da smartphone se non entra la devi rendere
 *  scorrevole o che scorre lei automaticamente.»
 *
 * Era andata a capo per la #400. Torna su una riga e si muove da sola, e il
 * movimento lo fa il foglio di stile: al foglio serve sapere quanta strada
 * c'è e quanto tempo metterci, e sono i due conti che si tengono fermi qui.
 * Il secondo è quello che conta: velocità costante, non durata costante — con
 * una durata fissa una fascia appena più larga striscerebbe e una molto più
 * larga sfreccerebbe.
 *
 * ── L'icona ─────────────────────────────────────────────────────────────────
 * «Nel menù a tendina dei dispositivi la lavastoviglie ha due icone, una non è
 *  nostra: devi eliminarla da dove la pesca.»
 *
 * Da dove: il guscio scrive l'opzione come `<option>${d.icon} ${d.name}</option>`,
 * quindi il suo testo porta dentro l'emoji, e quando il nome pulito non si
 * trova la tendina ricade su quel testo. Il ripiego resta, ma l'emoji si
 * stacca — e non si butta, perché è l'ultima cosa che dice che apparecchio sia.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { durataDellaDeriva, spazioDaPercorrere } from "../src/core/la-fascia-deriva.js";

test("una fascia che ci sta tutta non ha strada da fare", () => {
  assert.equal(spazioDaPercorrere({ scrollWidth: 300, clientWidth: 300 }), 0);
  assert.equal(spazioDaPercorrere({ scrollWidth: 280, clientWidth: 300 }), 0);
  /* Due pixel di tolleranza: gli scarti frazionari di uno schermo a densità
   * due non sono pastiglie nascoste, e una fascia non deve derivare di mezzo
   * pixel per colpa loro. */
  assert.equal(spazioDaPercorrere({ scrollWidth: 301.4, clientWidth: 300 }), 0);
  assert.equal(spazioDaPercorrere({}), 0);
});

test("quello che resta fuori è la strada da percorrere", () => {
  assert.equal(spazioDaPercorrere({ scrollWidth: 520, clientWidth: 358 }), 162);
});

test("la deriva va a velocità costante, non a durata costante", () => {
  /* È la differenza fra una cosa che si legge e una che no: il doppio di
   * strada vuole il doppio di tempo. */
  const corta = durataDellaDeriva(150);
  const lunga = durataDellaDeriva(300);
  assert.ok(corta > 0);
  assert.equal(Math.round((lunga / corta) * 10) / 10, 2);
});

test("niente strada, niente tempo: non c'è nessuna animazione da chiedere", () => {
  assert.equal(durataDellaDeriva(0), 0);
  assert.equal(durataDellaDeriva(-40), 0);
  assert.equal(durataDellaDeriva(undefined), 0);
});

test("un filo di troppo non fa una deriva lampo, e una fascia enorme non eterna", () => {
  /* I due estremi hanno un pavimento e un tetto: sotto, una pastiglia che
   * sbuca farebbe uno scatto; sopra, una fascia lunghissima non si muoverebbe
   * più in modo percepibile. */
  assert.ok(durataDellaDeriva(3) >= 4);
  assert.ok(durataDellaDeriva(100000) <= 40);
});

test("l'emoji del guscio si stacca dal nome, e resta come suggerimento", async () => {
  /* Il modulo della tendina tocca il documento all'import: la regola si prova
   * da sola, che è il motivo per cui è esportata. */
  const { nomeSenzaEmoji } = await import("../src/sections/report-tendina-dispositivi-section.js");
  assert.deepEqual(nomeSenzaEmoji("🍽️ Lavastoviglie"), {
    glifo: "🍽️",
    nome: "Lavastoviglie",
  });
  assert.deepEqual(nomeSenzaEmoji("🔌 Elettrodomestici"), {
    glifo: "🔌",
    nome: "Elettrodomestici",
  });
  /* Una famiglia e un mestiere: sequenze con giunzione e tono della pelle, che
   * un ritaglio ingenuo spezzerebbe a metà lasciando mezzo carattere nel nome. */
  assert.deepEqual(nomeSenzaEmoji("👨‍👩‍👧 Famiglia").nome, "Famiglia");
  assert.deepEqual(nomeSenzaEmoji("🧑🏽‍🔧 Tecnico").nome, "Tecnico");
});

test("un nome che comincia per cifra non è un'emoji e non si tocca", async () => {
  const { nomeSenzaEmoji } = await import("../src/sections/report-tendina-dispositivi-section.js");
  for (const nome of ["3 Camere", "Boiler", "Frigorifero A+++", "230V quadro"])
    assert.deepEqual(nomeSenzaEmoji(nome), { glifo: "", nome });
});

test("un'opzione fatta di sola emoji non resta senza nome", async () => {
  const { nomeSenzaEmoji } = await import("../src/sections/report-tendina-dispositivi-section.js");
  /* Togliendo tutto resterebbe una riga vuota, che è peggio dell'emoji: allora
   * l'emoji torna a fare da nome. */
  assert.equal(nomeSenzaEmoji("🍽️").nome, "🍽️");
  assert.equal(nomeSenzaEmoji("").nome, "");
});

/* La fascia ha un bordo interno, e il nastro comincia dentro di lui.
 *
 * `clientWidth` comprende l'imbottitura; il nastro no — parte dopo. Prendendo
 * quella misura così com'è, la strada risultava più corta di tutta
 * l'imbottitura: il nastro si fermava prima del proprio capo e l'ultima
 * pastiglia restava tagliata, cioè proprio quella che si stava aspettando, e
 * con il velo del bordo sopra a renderla ancora meno leggibile.
 */
test("l'imbottitura della fascia non è strada che il nastro può usare", () => {
  /* Sei pixel per parte, come li mette il foglio di stile. */
  const conImbottitura = spazioDaPercorrere({
    scrollWidth: 400,
    clientWidth: 300,
    imbottitura: 12,
  });
  assert.equal(conImbottitura, 112, "la strada cresce di quanto misura l'imbottitura");
  /* Senza dirla, resta il conto di prima: dodici pixel in meno, e la coda
   * dell'ultima pastiglia fuori dal bordo. */
  assert.equal(spazioDaPercorrere({ scrollWidth: 400, clientWidth: 300 }), 100);
});

test("una fascia che ci sta tutta non si muove, imbottitura o no", () => {
  /* 288 di spazio utile per 286 di pastiglie: dentro, e ferma. */
  assert.equal(spazioDaPercorrere({ scrollWidth: 286, clientWidth: 300, imbottitura: 12 }), 0);
  /* E l'imbottitura non può far muovere una fascia che ci sta: due pixel di
   * tolleranza restano quelli, misurati sullo spazio vero. */
  assert.equal(spazioDaPercorrere({ scrollWidth: 290, clientWidth: 300, imbottitura: 12 }), 0);
  assert.equal(spazioDaPercorrere({ scrollWidth: 291, clientWidth: 300, imbottitura: 12 }), 3);
});

test("un'imbottitura assurda non inventa strada", () => {
  /* Numeri che non sono numeri, o negativi, valgono zero: una misura sbagliata
   * non deve far partire un'animazione che nessuno ha chiesto. */
  assert.equal(spazioDaPercorrere({ scrollWidth: 100, clientWidth: 300, imbottitura: -50 }), 0);
  assert.equal(spazioDaPercorrere({ scrollWidth: 100, clientWidth: 300, imbottitura: "boh" }), 0);
});

test("la sezione dice davvero quanto misura l'imbottitura, o il conto resta teorico", () => {
  /* L'aritmetica qui sopra vale solo se chi ha il documento in mano passa la
   * misura: senza, `spazioDaPercorrere` userebbe lo zero di difetto e
   * tornerebbe esattamente il conto sbagliato di prima. */
  const sezione = readFileSync(
    new URL("../src/sections/come-sta-la-casa-section.js", import.meta.url),
    "utf8",
  );
  assert.match(sezione, /imbottitura: imbottituraDellaFascia\(riga\)/);
  assert.match(sezione, /function imbottituraDellaFascia\(riga\)/);
  assert.match(sezione, /paddingLeft/);
  assert.match(sezione, /paddingRight/);
});
