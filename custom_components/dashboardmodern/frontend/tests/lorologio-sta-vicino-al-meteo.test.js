/* «Sarebbe carino avere l'orologio. Magari vicino al meteo» (#272).
 *
 * Il posto è quello chiesto: il meteo sta nell'intestazione, e alla sua destra
 * c'è lo spazio che avanza. Ora e data insieme, perché su una plancia appesa al
 * muro la data serve quanto l'ora — e chi la guarda dal telefono l'ora ce l'ha
 * già in cima allo schermo, quindi lì la data se ne va e resta il numero.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  OROLOGIO_KEY,
  fraQuantoIlMinuto,
  lettureOrologio,
} from "../src/sections/orologio-section.js";

test("ora e data si leggono nella lingua della plancia", () => {
  const quando = new Date("2026-09-03T14:05:00");
  /* Le parole non sono nostre: mese e giorno li scrive `Intl`, che è l'unico
   * modo perché tredici lingue leggano una data come la leggono a casa loro. */
  const italiano = lettureOrologio(quando, "it-IT");
  assert.equal(italiano.ora, "14:05");
  assert.match(italiano.data, /set/i);
  const inglese = lettureOrologio(quando, "en-US");
  assert.match(inglese.ora, /2:05/, "in inglese l'ora è su dodici");
  assert.match(inglese.data, /Sep/i);
  /* Una lingua che non esiste non lascia la testata senza ora. */
  const storta = lettureOrologio(quando, "zz-ZZ!!");
  assert.equal(typeof storta.ora, "string");
});

test("i secondi non si mostrano, e non si contano", () => {
  /* Tenere acceso un battito al secondo per aggiornare un numero che cambia
   * una volta al minuto è lavoro sprecato su una pagina aperta tutto il
   * giorno: il prossimo giro si fissa sul minuto esatto che viene. */
  assert.equal(fraQuantoIlMinuto(new Date("2026-09-03T14:05:00.000")), 60000);
  assert.equal(fraQuantoIlMinuto(new Date("2026-09-03T14:05:30.000")), 30000);
  assert.equal(fraQuantoIlMinuto(new Date("2026-09-03T14:05:59.900")), 250, "mai un'attesa a zero");
  const sorgente = readFileSync(
    new URL("../src/sections/orologio-section.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(sorgente, /setInterval/, "un cronometro acceso non serve");
  assert.match(sorgente, /root\.setTimeout\?\.\(/);
});

test("sta nello stesso riquadro del meteo, sotto il titolo", () => {
  const sorgente = readFileSync(
    new URL("../src/sections/orologio-section.js", import.meta.url),
    "utf8",
  );
  const meteo = readFileSync(
    new URL("../src/sections/weather-in-masthead-section.js", import.meta.url),
    "utf8",
  );
  /* «Passa il titolo dashboard e sotto fai la riga con meteo e orologio, ma
   * devono stare nello stesso quadrato»: il riquadro è UNO, ed è del meteo che
   * ce l'aveva già. L'ora ci si mette dentro invece di disegnarsene un altro
   * accanto — due che se lo disegnano vorrebbe dire due riquadri sovrapposti
   * al primo giro storto. */
  assert.match(meteo, /export function rigaDellaTestata\(\)/);
  assert.match(sorgente, /const casa = rigaDellaTestata\(\) \|\| header;/);
  /* Il nome della casa si prende la sua riga e il riquadro va a capo sotto. */
  assert.match(meteo, /header\.dm-testata-col-meteo\{flex-wrap:wrap;row-gap:8px\}/);
  assert.match(meteo, /\.dm-testata-riga\{[\s\S]{0,200}flex:1 1 100%/);
  /* E dentro non ci sono altri riquadri: il meteo ci sta nudo, l'ora è
   * staccata da un filo e basta. */
  assert.match(meteo, /\.weather-widget\{[\s\S]{0,160}border:0;/);
  assert.match(sorgente, /border-left:1px solid var\(--card-border,#e8edf3\)/);
  /* Sul telefono resta il numero e la data se ne va. */
  assert.match(sorgente, /@media \(max-width:560px\)[\s\S]{0,240}dm-orologio-data\{display:none\}/);
  /* E si può spegnere: chi ha l'ora in cima allo schermo può non volerla due
   * volte. Di serie acceso — era la richiesta. */
  assert.equal(OROLOGIO_KEY, "cd_orologio");
  assert.match(sorgente, /getItem\?\.\(OROLOGIO_KEY\) !== "0"/);
});
