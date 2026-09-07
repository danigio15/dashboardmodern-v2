/* «Aprendo il widget della temperatura c'è una stanza che mostra una misura di
 * umidità pur non essendoci nessun sensore associato. Nella sezione stanze la
 * stessa stanza non presenta la misurazione» (#379).
 *
 * Non c'era nessun sensore inventato: c'era il termometro, chiamato umidità.
 * Senza entità scelta si prova la gemella per nome — `..._temperature` diventa
 * `..._humidity`, che sui multisensore è quasi sempre giusta — ma su un id che
 * quella parola non ce l'ha il `replace` restituisce lo STESSO id: si rileggeva
 * la temperatura e la si stampava col «%» addosso.
 *
 * La guardia esisteva già, sulle card della pagina Stanze (#242). La stessa
 * riga senza guardia viveva in altri tre posti — la finestra del widget e due
 * moduli beta — ed è da lì che la segnalazione è tornata. Adesso la domanda si
 * fa in un posto solo.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { humidityEntry } from "../src/core/room-overview.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

test("la gemella si prova solo se il nome cambia davvero", () => {
  /* Il multisensore: la gemella c'e' e si chiama come deve. */
  assert.equal(
    humidityEntry({ temp: "sensor.salotto_temperature" }),
    "sensor.salotto_humidity",
  );
  /* Il termometro e basta: niente gemella, e nessuno la inventa. Prima qui
   * tornava `sensor.camera_da_letto_temp` — la temperatura col «%». */
  assert.equal(humidityEntry({ temp: "sensor.camera_da_letto_temp" }), "");
  assert.equal(humidityEntry({ temp: "sensor.termometro_camera" }), "");
  /* La scelta a mano vince sempre, e non deve somigliare a niente. */
  assert.equal(
    humidityEntry({ temp: "sensor.camera_temp", hum: "sensor.igrometro_camera" }),
    "sensor.igrometro_camera",
  );
  assert.equal(humidityEntry({}), "");
  assert.equal(humidityEntry(), "");
});

test("nessuno si scrive piu' la sua copia della gemella", () => {
  for (const nome of [
    "sections/temperature-section.js",
    "sections/home-widgets-section.js",
    "sections/beta25-real-device-fixes-section.js",
    "sections/beta26-real-device-stability-section.js",
  ]) {
    const testo = readFileSync(join(SRC, nome), "utf8");
    assert.ok(
      !/replace\("_temperature", "_humidity"\)/.test(testo),
      `${nome} indovina ancora l'umidita' per conto suo`,
    );
    assert.match(testo, /humidityEntry/);
  }
});
