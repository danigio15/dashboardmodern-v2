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

test("la pagina disegna domani, ma non lo ripete quando è già la risposta grande", async () => {
  const sezione = await leggi("../src/sections/rifiuti-section.js");
  assert.match(sezione, /function domaniMarkup\(lettura, primo\)/);
  /* Quando il prossimo ritiro è già domani, la risposta grande lo dice:
   * scriverlo di nuovo sotto sarebbe la stessa cosa due volte. */
  assert.match(sezione, /if \(!domani\.length \|\| primo\?\.giorni === 1\) return "";/);
  assert.match(sezione, /\$\{domaniMarkup\(lettura, primo\)\}/);
});
