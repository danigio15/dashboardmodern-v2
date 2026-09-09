/* Ogni sezione con una pagina sua ha il cappello, quindi il tasto per tornare.
 *
 * «Presenza: manca il tasto HOME» (#452). E infatti: il tasto per tornare in
 * Home lo disegna il cappello della pagina, e il cappello lo disegna a chi sta
 * nell'elenco di `page-masthead-section`. La Presenza — sezione nuova della
 * 1.4.16 — in quell'elenco non c'era: la pagina si apriva e non se ne usciva
 * più.
 *
 * Il difetto non è una riga sbagliata, è una riga mancante — e una riga
 * mancante non la trova nessuna prova che guardi solo il codice che c'è.
 * Percio' questa prova parte dall'altro capo: prende le pagine che le sezioni
 * dichiarano di avere, e pretende che ognuna sia nell'elenco del cappello. Una
 * sezione nuova che si dimentica di iscriversi la fa cadere il giorno che
 * nasce, invece del giorno che qualcuno se ne accorge.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SEZIONI = join(dirname(fileURLToPath(import.meta.url)), "../src/sections");

const leggi = (file) => readFileSync(join(SEZIONI, file), "utf8");

const CAPPELLO = leggi("page-masthead-section.js");

/* Le pagine iscritte al cappello, lette dall'elenco stesso. */
const ISCRITTE = new Set([...CAPPELLO.matchAll(/id:\s*"(page-[\w-]+)"/g)].map(([, id]) => id));

/* Le pagine che le sezioni dichiarano: una costante `*_PAGE_ID` con dentro un
 * `page-...`. È il modo in cui una sezione dice «questa pagina è mia», e la
 * Presenza lo diceva già — solo che nessuno confrontava le due liste. */
function pagineDichiarate() {
  const trovate = new Map();
  for (const file of readdirSync(SEZIONI)) {
    if (!file.endsWith(".js") || file === "page-masthead-section.js") continue;
    const testo = leggi(file);
    for (const [, id] of testo.matchAll(/PAGE_ID\s*=\s*"(page-[\w-]+)"/g)) trovate.set(id, file);
  }
  return trovate;
}

test("ogni pagina dichiarata da una sezione sta nell'elenco del cappello", () => {
  const dichiarate = pagineDichiarate();
  assert.ok(dichiarate.size > 0, "nessuna pagina dichiarata: la prova non guarda niente");
  const senzaCappello = [...dichiarate]
    .filter(([id]) => !ISCRITTE.has(id))
    .map(([id, file]) => `${id} (${file})`);
  assert.deepEqual(
    senzaCappello,
    [],
    "queste pagine si aprono senza il tasto per tornare in Home: " +
      "vanno aggiunte all'elenco di page-masthead-section",
  );
});

test("la Presenza c'e', col suo nome e la sua sottotitolatura in due lingue", () => {
  /* Non basta l'identificativo: senza le parole il cappello esce muto, e una
   * pagina senza nome non si distingue da un errore. */
  assert.ok(ISCRITTE.has("page-presenza"));
  const pezzo = CAPPELLO.slice(CAPPELLO.indexOf('id: "page-presenza"'));
  const voce = pezzo.slice(0, pezzo.indexOf("},"));
  assert.match(voce, /it:\s*\["Presenza",\s*"[^"]+"\]/);
  assert.match(voce, /en:\s*\["Presence",\s*"[^"]+"\]/);
  assert.match(voce, /tint:\s*\["[\d,]+",\s*"[\d,]+"\]/);
});
