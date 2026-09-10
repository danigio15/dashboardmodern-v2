/* «Si chiede di mostrare il rifiuto di "domani".» (#409)
 *
 * Quando il prossimo ritiro è oggi, la risposta grande dice «Oggi» e finisce
 * lì: cosa mettere fuori STASERA per domani mattina non lo dice nessuno, ed è
 * la domanda che ci si fa la sera.
 *
 * Il dato c'era già — la lettura porta `oggi` e `domani` da quando esiste il
 * turno di casa (#366) — e mancava soltanto di disegnarlo.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { letturaRifiuti } from "../src/core/rifiuti-model.js";

const leggi = (rel) => readFile(new URL(rel, import.meta.url), "utf8");

const ADESSO = Date.parse("2026-09-08T18:00:00Z");
const giorno = (quanti) => new Date(ADESSO + quanti * 86400000).toISOString().slice(0, 10);

const CONFIG = {
  righe: [
    { materiale: "organico", entity: "sensor.organico" },
    { materiale: "plastica", entity: "sensor.plastica" },
    { materiale: "carta", entity: "sensor.carta" },
  ],
};

const STATI = {
  "sensor.organico": { state: giorno(0) },
  "sensor.plastica": { state: giorno(1) },
  "sensor.carta": { state: giorno(5) },
};

test("la lettura separa già quello di oggi da quello di domani", () => {
  const lettura = letturaRifiuti(CONFIG, STATI, (v) => v, ADESSO);
  assert.deepEqual(
    lettura.oggi.map((riga) => riga.materiale),
    ["organico"],
  );
  assert.deepEqual(
    lettura.domani.map((riga) => riga.materiale),
    ["plastica"],
  );
  /* E il prossimo resta quello di oggi: domani non lo scavalca. */
  assert.deepEqual(
    lettura.prossimi.map((riga) => riga.materiale),
    ["organico"],
  );
});

test("senza niente domani, non c'è niente da dire", () => {
  const lettura = letturaRifiuti(
    { righe: [{ materiale: "carta", entity: "sensor.carta" }] },
    { "sensor.carta": { state: giorno(5) } },
    (v) => v,
    ADESSO,
  );
  assert.deepEqual(lettura.domani, []);
});

test("la pagina dice il gesto della sera, e non ripete i bidoni già scritti grandi", async () => {
  /* «Sarebbe più comodo penso per tutti che lo segnasse un giorno prima, in
   *  modo da metterli fuori la sera» (#441). Il dato c'era e si disegnava; era
   *  la parola a essere sbagliata. «Domani» è un'informazione, e chi legge deve
   *  ancora fare da sé il passo che conta; «Da mettere fuori stasera» è il
   *  gesto, e chi legge ha finito. */
  const sezione = await leggi("../src/sections/rifiuti-section.js");
  assert.match(sezione, /function seraMarkup\(lettura, primo\)/);
  assert.match(sezione, /Da mettere fuori stasera/);
  assert.doesNotMatch(sezione, /function domaniMarkup/);
  /* Quando il prossimo ritiro è già domani i bidoni stanno grandi nella
   * risposta sopra: sotto resta il gesto, non l'elenco una seconda volta. */
  assert.match(sezione, /if \(primo\?\.giorni === 1\)/);
  assert.match(sezione, /\$\{seraMarkup\(lettura, primo\)\}/);
});

test("anche la tessera della Home dice il gesto, non solo il giorno", async () => {
  const home = await leggi("../src/sections/home-widgets-section.js");
  assert.match(home, /primo\.quando === "domani"/);
  assert.match(home, /Da mettere fuori stasera/);
});
