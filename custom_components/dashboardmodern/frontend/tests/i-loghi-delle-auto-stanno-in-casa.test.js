/* I loghi dei marchi auto stanno nel repository.
 *
 * Venivano scaricati da un CDN a ogni caricamento della pagina. Tre cose non
 * andavano, e tutte e tre si vedevano.
 *
 * Una plancia di Home Assistant sta su una rete di casa, e molte non escono su
 * internet: li' i loghi non arrivavano MAI — tutti, non alcuni.
 *
 * Simple Icons ha tolto i marchi delle auto dal pacchetto per ragioni di
 * marchio registrato, e otto dei nostri indirizzi puntavano gia' a file che non
 * esistono. Nessuno se n'era accorto perche' un'immagine che non arriva non fa
 * rumore: resta un buco, e un buco non si segnala da solo.
 *
 * E un file che non e' nostro non si puo' ritoccare.
 */

import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

import {
  CAR_BRANDS,
  carBrandColor,
  carBrandImageSource,
  carBrandVisual,
} from "../src/core/personalization-catalog.js";

const CARTELLA = new URL("../brands/", import.meta.url);
const leggi = (percorso) => readFile(new URL(percorso, import.meta.url), "utf8");

const loghi = async () =>
  (await readdir(CARTELLA)).filter((nome) => nome.endsWith(".svg")).map((nome) => nome.slice(0, -4));

test("nessun indirizzo remoto: i file sono dentro l'integrazione", async () => {
  const catalogo = await leggi("../src/core/personalization-catalog.js");
  assert.doesNotMatch(catalogo, /https?:\/\//);
  for (const marchio of CAR_BRANDS) {
    const indirizzo = carBrandImageSource(marchio.name);
    if (indirizzo) assert.doesNotMatch(indirizzo, /^https?:/, marchio.name);
  }
});

test("l'elenco dei loghi e la cartella dicono la stessa cosa", async () => {
  /* E' il modo in cui questo si romperebbe di nuovo in silenzio: qualcuno
   * aggiunge un file e si dimentica l'elenco, o toglie l'elenco e lascia il
   * file. In tutti e due i casi il logo non compare, e nessuno lo sa. */
  const presenti = new Set(await loghi());
  const dichiarati = new Set(
    CAR_BRANDS.map((marchio) => carBrandImageSource(marchio.name))
      .filter(Boolean)
      .map((indirizzo) => indirizzo.replace(/^.*\//, "").replace(/\.svg$/, "")),
  );
  assert.deepEqual([...dichiarati].sort(), [...presenti].sort());
});

test("ogni logo dichiarato ha davvero il suo file, e disegna qualcosa", async () => {
  const presenti = await loghi();
  assert.ok(presenti.length >= 25, `troppi pochi loghi: ${presenti.length}`);
  for (const id of presenti) {
    const svg = await readFile(new URL(`${id}.svg`, CARTELLA), "utf8");
    assert.match(svg, /<svg/, id);
    assert.match(svg, /<path/, id);
    /* Il colore lo decide il tema, non il file: Simple Icons li distribuisce
     * neri pieni, e su fondo scuro sparivano. */
    assert.match(svg, /fill="currentColor"/, id);
  }
});

test("nessun marchio resta senza il suo segno", () => {
  /* Sette non sono mai stati nel pacchetto e uno l'hanno tolto: quelli li
   * abbiamo disegnati noi o ripescati dalla versione che ce li aveva. L'unico
   * senza file e' Leapmotor, che il suo marchio ce l'ha dentro al codice. */
  const senza = CAR_BRANDS.filter(
    (marchio) => !carBrandImageSource(marchio.name) && marchio.id !== "leapmotor",
  );
  assert.deepEqual(senza.map((marchio) => marchio.name), []);
  for (const marchio of CAR_BRANDS) assert.ok(marchio.initials, `${marchio.name} senza iniziali`);
});

test("ogni marchio porta la sua tinta, e il nero lo lascia decidere al tema", () => {
  /* Erano tutti dello stesso azzurro, e non per scelta: il logo era un `<img>`,
   * e un SVG dentro un `<img>` e' un documento a parte in cui `currentColor`
   * non vede niente. Con la maschera il colore lo mette la plancia. */
  const conTinta = CAR_BRANDS.filter((marchio) => carBrandColor(marchio.name));
  assert.ok(conTinta.length >= 20, `troppe poche tinte: ${conTinta.length}`);
  assert.equal(carBrandColor("Tesla"), "#CC0000");
  assert.equal(carBrandColor("Renault"), "#FFCC33");
  /* Il marchio nero non prende il nero: sparirebbe sul tema scuro. Segue il
   * tema, e lo fa per una ragione detta invece che per dimenticanza. */
  assert.equal(carBrandColor("MINI"), "");
  const marchio = carBrandVisual("Tesla", 40);
  assert.match(marchio, /color:#CC0000/);
  assert.match(marchio, /mask-image:url\('/);
  assert.match(marchio, /background:currentColor/);
  // Un `<img>` non ci sta piu': era il motivo per cui il colore non arrivava.
  assert.doesNotMatch(marchio, /<img/);
});

test("la cartella dichiara da dove vengono i file e a che condizioni", async () => {
  const licenza = await readFile(new URL("LICENSE.txt", CARTELLA), "utf8");
  assert.match(licenza, /Simple Icons/);
  assert.match(licenza, /CC0/);
  // I marchi appartengono ai titolari: dirlo e' il minimo.
  assert.match(licenza, /rispettivi titolari/);
});

test("l'integrazione serve la cartella, fuori dalla versione", async () => {
  const python = await leggi("../../frontend.py");
  assert.match(python, /BRAND_DIR = FRONTEND_DIR \/ "brands"/);
  assert.match(python, /url_path=BRAND_URL_PATH/);
});

test("lo script di build esiste e non tiene il pacchetto come dipendenza", async () => {
  const script = await leggi("../../../../scripts/costruisci-loghi-auto.mjs");
  assert.match(script, /npm", \["pack"/);
  // Si scarica, si prende quello che serve, si butta.
  assert.match(script, /rmSync\(cartella, \{ recursive: true, force: true \}\)/);
  const pacchetto = JSON.parse(await leggi("../../../../package.json"));
  const dipendenze = { ...pacchetto.dependencies, ...pacchetto.devDependencies };
  assert.equal("simple-icons" in dipendenze, false);
});
