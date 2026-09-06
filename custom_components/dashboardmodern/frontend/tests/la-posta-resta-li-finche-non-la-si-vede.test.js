/* La posta arriva mentre non guardi (#357).
 *
 * «Animazione quando arriva Posta attivato da un sensore contact.»
 *
 * Il contatto sulla cassetta scatta quando il postino apre lo sportello e
 * torna a riposo quando lo richiude: l'apertura dura pochi secondi, e in quei
 * pochi secondi non c'e' nessuno davanti alla plancia. Guardare soltanto com'e'
 * adesso vorrebbe dire non accorgersene mai — e un'animazione di due secondi
 * mentre si e' al lavoro non l'ha vista nessuno.
 *
 * Qui si prova la memoria: due scatti a confronto dicono che in mezzo c'e'
 * stata un'apertura, anche se nessuno l'ha vista succedere. L'orologio non si
 * tocca: i momenti li passa chi chiama.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { passoDellaPosta, postaRitirata } from "../src/core/come-sta-la-casa.js";

test("il primo sguardo su una cassetta chiusa non annuncia niente", () => {
  const passo = passoDellaPosta({}, { aperto: false, cambiatoIl: 1000 });
  assert.equal(passo.arrivata, false);
  assert.equal(passo.arrivo, 0);
  // Ma lo scatto si tiene: e' quello con cui si riconoscera' la prossima volta.
  assert.deepEqual(passo.memoria, { aperto: false, cambiatoIl: 1000, arrivo: 0, vista: 0 });
  assert.equal(passo.cambiata, true);
});

test("una cassetta gia' aperta al primo sguardo e' posta che aspetta", () => {
  const passo = passoDellaPosta({}, { aperto: true, cambiatoIl: 1000 });
  assert.equal(passo.arrivata, true);
  assert.equal(passo.arrivo, 1000);
});

test("lo sportello che si apre sotto gli occhi annuncia la posta", () => {
  const prima = passoDellaPosta({}, { aperto: false, cambiatoIl: 1000 });
  const dopo = passoDellaPosta(prima.memoria, { aperto: true, cambiatoIl: 2000 });
  assert.equal(dopo.arrivata, true);
  assert.equal(dopo.arrivo, 2000);
});

test("aperta e richiusa mentre nessuno guardava: si riconosce dopo", () => {
  /* Lo stato e' lo stesso di prima — chiusa — ma il momento in cui e'
   * diventato chiusa e' piu' recente di quello che ci ricordavamo: in mezzo
   * c'e' stata un'apertura, ed e' esattamente il caso che conta. */
  const prima = passoDellaPosta({}, { aperto: false, cambiatoIl: 1000 });
  const dopo = passoDellaPosta(prima.memoria, { aperto: false, cambiatoIl: 5000 });
  assert.equal(dopo.arrivata, true);
  assert.equal(dopo.arrivo, 5000);
});

test("una cassetta ferma non annuncia niente e non fa riscrivere la memoria", () => {
  const prima = passoDellaPosta({}, { aperto: false, cambiatoIl: 1000 });
  const dopo = passoDellaPosta(prima.memoria, { aperto: false, cambiatoIl: 1000 });
  assert.equal(dopo.arrivata, false);
  assert.equal(
    dopo.cambiata,
    false,
    "questo passo gira a ogni giro di disegno: senza questo controllo si riscriverebbe la memoria molte volte al minuto",
  );
});

test("l'avviso resta finche' non lo si e' visto, giro dopo giro", () => {
  let memoria = passoDellaPosta({}, { aperto: false, cambiatoIl: 1000 }).memoria;
  memoria = passoDellaPosta(memoria, { aperto: true, cambiatoIl: 2000 }).memoria;
  memoria = passoDellaPosta(memoria, { aperto: false, cambiatoIl: 2100 }).memoria;
  /* Lo sportello si e' gia' richiuso, ma la posta e' dentro: dieci giri dopo
   * la pastiglia e' ancora li'. */
  for (let giro = 0; giro < 10; giro += 1) {
    const passo = passoDellaPosta(memoria, { aperto: false, cambiatoIl: 2100 });
    assert.equal(passo.arrivata, true);
    memoria = passo.memoria;
  }
});

test("«l'ho ritirata» spegne l'avviso, e il prossimo arrivo lo riaccende", () => {
  const arrivo = passoDellaPosta({}, { aperto: true, cambiatoIl: 2000 });
  const ritirata = postaRitirata(arrivo.memoria, 3000);
  assert.equal(passoDellaPosta(ritirata, { aperto: true, cambiatoIl: 2000 }).arrivata, false);
  // Chiudere lo sportello dopo averla ritirata non e' una notizia nuova.
  const chiusa = passoDellaPosta(ritirata, { aperto: false, cambiatoIl: 3200 });
  assert.equal(chiusa.arrivata, false);
  // La posta del giorno dopo si', quella si annuncia.
  assert.equal(passoDellaPosta(chiusa.memoria, { aperto: true, cambiatoIl: 90000 }).arrivata, true);
});

test("un orologio indietro non lascia la pastiglia incollata li'", () => {
  /* Se il dispositivo e' indietro rispetto a Home Assistant, «adesso» sarebbe
   * piu' vecchio dell'arrivo e la pastiglia resterebbe a ripetere la stessa
   * cosa dopo che uno l'ha gia' ritirata. */
  const arrivo = passoDellaPosta({}, { aperto: true, cambiatoIl: 9000 });
  const ritirata = postaRitirata(arrivo.memoria, 100);
  assert.equal(passoDellaPosta(ritirata, { aperto: true, cambiatoIl: 9000 }).arrivata, false);
});

test("senza cassetta configurata non succede niente, e quello che si sapeva resta", () => {
  const arrivo = passoDellaPosta({}, { aperto: true, cambiatoIl: 2000 });
  const muta = passoDellaPosta(arrivo.memoria, null);
  assert.equal(muta.arrivata, true, "l'entita' che non risponde non ritira la posta");
  assert.equal(muta.cambiata, false);
  assert.deepEqual(passoDellaPosta({}, null), {
    arrivata: false,
    arrivo: 0,
    memoria: {},
    cambiata: false,
  });
});
