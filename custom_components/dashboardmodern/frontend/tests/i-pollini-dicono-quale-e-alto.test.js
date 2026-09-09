/* I pollini dicono quale è alto, e il disagio termico ha più di un indice.
 *
 * «Ad ora, ad esempio, Pollini mostra solo il numero della concentrazione senza
 *  testo che spiega cosa stia succedendo. Potrebbe essere bello avere un campo
 *  dove aggiungere un sensor che dice le tipologie di minacce come polline di
 *  oggi, oltre quelli che specificano il rischio preso singolarmente per erba,
 *  erbacce e albero. Restituiscono valori numerici quindi un valore 1 è
 *  indicativo di rischio molto basso, valore 2 basso, valore 3 medio e valore 4
 *  alto. Oltre allo stato, questi sensori espongono Category con il label del
 *  rischio, Advice con testi riassuntivi e Description con conseguenze del
 *  clima attuale.»
 *
 * «Per quanto riguarda il confort termico, attualmente si può esporre solo un
 *  sensore… si potrebbe aggiungere la possibilità di avere altri campi, come
 *  humidex, indice di calore e rischio gelo. Inoltre attualmente anche se il
 *  sensore espone uno stato scritto in italiano, la dashboard prende l'opzione
 *  dell'attributo scritta in lowcase ed in inglese.» (#428)
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const { CATEGORIE, laPiuGrave, letturaAllerte } = await import("../src/core/allerte-model.js");

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const leggi = (relativo) => readFileSync(join(SRC, relativo), "utf8");

const stato = (id, valore, attributes = {}) => ({
  entity_id: id,
  state: String(valore),
  attributes,
});

function pollini(config, states) {
  return letturaAllerte({ pollini: config }, states).find((voce) => voce.chiave === "pollini");
}
function comfort(config, states) {
  return letturaAllerte({ comfort: config }, states).find((voce) => voce.chiave === "comfort");
}

test("le caselle nuove esistono, e la principale resta la prima", () => {
  const perChiave = Object.fromEntries(CATEGORIE.map((voce) => [voce.chiave, voce.caselle]));
  assert.deepEqual(perChiave.pollini, ["entity", "erba", "erbacce", "albero"]);
  assert.deepEqual(perChiave.comfort, ["entity", "humidex", "calore", "gelo"]);
});

test("un polline alto alza la sezione anche se la giornata è tranquilla", () => {
  /* È il caso che rende la richiesta utile: chi è allergico alle graminacee
   * deve vedere l'allerta quando la media del bollettino dice «basso». */
  const lettura = pollini(
    { entity: "sensor.pollini_oggi", erba: "sensor.erba", albero: "sensor.albero" },
    {
      "sensor.pollini_oggi": stato("sensor.pollini_oggi", 1),
      "sensor.erba": stato("sensor.erba", 4, {
        Category: "Alto",
        Advice: "Resta in casa nelle ore centrali.",
        Description: "Il caldo secco favorisce la dispersione.",
      }),
      "sensor.albero": stato("sensor.albero", 1),
    },
  );
  assert.equal(lettura.livello, "allarme");
  const erba = lettura.voci.find((voce) => voce.chiave === "erba");
  assert.equal(erba.indice, 4);
  assert.equal(erba.livello, "allarme");
  assert.equal(erba.categoria, "Alto");
  assert.equal(erba.consiglio, "Resta in casa nelle ore centrali.");
  assert.equal(erba.descrizione, "Il caldo secco favorisce la dispersione.");
  // L'albero c'è e sta tranquillo; le erbacce non sono configurate.
  assert.deepEqual(
    lettura.voci.map((voce) => voce.chiave),
    ["erba", "albero"],
  );
});

test("il gradino da uno a quattro è quello dei bollettini", () => {
  const per = (valore) =>
    pollini(
      { entity: "sensor.pollini_oggi", erba: "sensor.erba" },
      {
        "sensor.pollini_oggi": stato("sensor.pollini_oggi", 0),
        "sensor.erba": stato("sensor.erba", valore),
      },
    ).voci[0].livello;
  assert.equal(per(1), "quiete");
  assert.equal(per(2), "nota");
  assert.equal(per(3), "attenzione");
  assert.equal(per(4), "allarme");
});

test("un sensore che non risponde non conta, e non spegne gli altri", () => {
  const lettura = pollini(
    { entity: "sensor.pollini_oggi", erba: "sensor.erba", erbacce: "sensor.erbacce" },
    {
      "sensor.pollini_oggi": stato("sensor.pollini_oggi", 2),
      "sensor.erba": stato("sensor.erba", "unavailable"),
      "sensor.erbacce": stato("sensor.erbacce", 3),
    },
  );
  assert.deepEqual(
    lettura.voci.map((voce) => voce.chiave),
    ["erbacce"],
  );
  assert.equal(lettura.livello, "attenzione");
});

test("il rischio gelo alto si vede anche dietro una percezione tranquilla", () => {
  const lettura = comfort(
    { entity: "sensor.percezione", gelo: "sensor.gelo", humidex: "sensor.humidex" },
    {
      "sensor.percezione": stato("sensor.percezione", "comfortable"),
      "sensor.gelo": stato("sensor.gelo", "high"),
      "sensor.humidex": stato("sensor.humidex", "no_discomfort"),
    },
  );
  assert.equal(lettura.livello, "attenzione");
  assert.deepEqual(
    lettura.voci.map((voce) => voce.chiave),
    ["humidex", "gelo"],
  );
  assert.equal(lettura.voci.find((voce) => voce.chiave === "gelo").codice, "high");
});

test("lo stato scritto in italiano resta in italiano", () => {
  /* Il difetto: la plancia riduceva la parola a un codice — minuscolo, coi
   * trattini bassi — e poi scriveva quello. Adesso il codice serve a giudicare
   * il livello e il testo del sensore a leggerlo. */
  const lettura = comfort(
    { entity: "sensor.percezione" },
    { "sensor.percezione": stato("sensor.percezione", "Leggermente caldo") },
  );
  assert.equal(lettura.codice, "leggermente_caldo");
  assert.equal(lettura.scritto, "Leggermente caldo");
  // E il livello lo ha capito comunque, dalla parola «caldo».
  assert.equal(lettura.livello, "nota");

  const fonte = leggi("sections/allerte-section.js");
  // Chi disegna prova il vocabolario, poi il testo del sensore, e solo per
  // ultimo il codice — con l'iniziale grande, non in minuscolo.
  assert.match(fonte, /const conosciuta = voci\[clean\(codice\)\];/);
  assert.match(fonte, /const suo = clean\(scritto\);\n  if \(suo\) return suo;/);
  assert.match(fonte, /parolaDelComfort\(lettura\.codice, lettura\.scritto\)/);
});

test("la voce più grave si sceglie in un posto solo", () => {
  assert.equal(laPiuGrave([]), null);
  assert.equal(laPiuGrave(), null);
  assert.equal(
    laPiuGrave([{ livello: "nota" }, { livello: "allarme" }, { livello: "quiete" }]).livello,
    "allarme",
  );
  // A pari livello resta la prima: l'ordine di configurazione è una scelta.
  const primo = { livello: "nota", chiave: "a" };
  assert.equal(laPiuGrave([primo, { livello: "nota", chiave: "b" }]), primo);
  /* La regola sta nel modello, dove sta il peso dei livelli: i due lettori e
   * chi disegna la frase la chiedono a lei invece di rifarne il conto. */
  const modello = leggi("core/allerte-model.js");
  assert.equal((modello.match(/laPiuGrave\(/g) || []).length, 3);
});

test("la scheda del Config chiede le sette caselle", () => {
  const scheda = leggi("sections/allerte-editor-section.js");
  for (const campo of ["erba", "erbacce", "albero", "humidex", "calore", "gelo"])
    assert.match(scheda, new RegExp(`"${campo}",`), `manca la casella ${campo}`);
});
