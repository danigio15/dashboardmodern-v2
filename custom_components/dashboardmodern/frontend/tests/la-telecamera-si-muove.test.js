/* «Le telecamere che configura sono delle Arlo, ma dalla sezione Sicurezza vede
 * solo un'istantanea: il video non si muove, né dalla card né quando apre il
 * popup. Con una card YAML fatta così — `camera_view: live` — riesce a vederlo
 * sempre in trasmissione.»
 *
 * Due cose separate, e questa prova tiene ferme tutte e due.
 *
 * La tessera del muro chiedeva fotogrammi e basta: uno ogni quattro secondi,
 * dal `camera_proxy`. Adesso una telecamera si può mettere «dal vivo» e allora
 * chiede il flusso continuo — `camera_proxy_stream`, la stessa porta con un
 * nome diverso, che è esattamente quello che fa `camera_view: live`.
 *
 * Il popup un video ce l'ha, e lo cerca su quattro strade; ma a chi dorme —
 * Arlo, Ring, Nest — il flusso continuo veniva saltato *prima* ancora di
 * provare l'HLS, e quel salto valeva soltanto quando l'HLS aveva appena
 * fallito: cioè nel momento in cui un'altra strada dal vivo è l'unica cosa
 * rimasta. Quella prova sta accanto al motore, in `strategie-telecamera`.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  PORTA_FLUSSO,
  PORTA_ISTANTANEA,
  flussoDaIstantanea,
  percorsoDelFlusso,
  stessoFlusso,
  vuoleIlVivo,
} from "../src/core/telecamera-dal-vivo.js";
import { normalizeDevice } from "../src/core/device-model.js";

const FOTO = "/api/camera_proxy/camera.giardino?token=abc123";

test("il flusso è la stessa porta con un nome diverso, e si porta dietro il gettone", () => {
  /* `entity_picture` ha già il gettone della telecamera, e quel gettone vale
   * anche per il flusso: un `<img>` non può portare un'intestazione
   * `Authorization`, quindi è l'unica strada che regge. */
  assert.equal(flussoDaIstantanea(FOTO), "/api/camera_proxy_stream/camera.giardino?token=abc123");
  assert.match(flussoDaIstantanea(FOTO), new RegExp(`^${PORTA_FLUSSO}`));
  assert.ok(PORTA_ISTANTANEA !== PORTA_FLUSSO);
  /* Una foto che non viene dal proxy delle telecamere non è un flusso: meglio
   * niente che un indirizzo inventato. */
  assert.equal(flussoDaIstantanea("/local/giardino.png"), "");
  assert.equal(flussoDaIstantanea(""), "");
  assert.equal(flussoDaIstantanea(null), "");
});

test("senza foto resta il percorso da far firmare", () => {
  assert.equal(percorsoDelFlusso("camera.giardino"), "/api/camera_proxy_stream/camera.giardino");
  assert.equal(percorsoDelFlusso(""), "");
  /* Un'entità con caratteri strani non rompe l'indirizzo. */
  assert.equal(percorsoDelFlusso("camera.a b"), "/api/camera_proxy_stream/camera.a%20b");
});

test("«dal vivo» è una scelta, e vale solo se è stata fatta", () => {
  assert.equal(vuoleIlVivo({ vivo: true }), true);
  assert.equal(vuoleIlVivo({ vivo: "true" }), true, "torna da JSON come stringa");
  assert.equal(vuoleIlVivo({ vivo: false }), false);
  assert.equal(vuoleIlVivo({}), false, "chi non ha scelto resta com'era: istantanee");
  assert.equal(vuoleIlVivo(), false);
});

test("un flusso già appeso non si riattacca", () => {
  /* Un MJPEG è una risposta che non finisce mai: riassegnare `src` la chiude e
   * la riapre, e il cronometro del muro passa ogni quattro secondi — sarebbe
   * un lampeggio e una connessione nuova ogni quattro secondi. */
  const url = flussoDaIstantanea(FOTO);
  assert.equal(stessoFlusso({ dataset: { dmCameraStream: url } }, url), true);
  assert.equal(stessoFlusso({ dataset: { dmCameraStream: "" } }, url), false);
  /* Quando Home Assistant rinnova il gettone l'indirizzo cambia davvero, e
   * allora si riattacca. */
  assert.equal(
    stessoFlusso({ dataset: { dmCameraStream: url } }, url.replace("abc123", "zzz999")),
    false,
  );
  assert.equal(stessoFlusso(null, url), false);
});

test("la scelta sopravvive al modello, accesa e spenta", () => {
  /* È la quinta volta che un campo non dichiarato sparisce alla prima
   * normalizzazione. E spento non è «campo assente»: una telecamera che era
   * dal vivo e non lo è più deve restare spenta anche dopo un ricarico. */
  const acceso = normalizeDevice(
    { name: "Giardino", entity: "camera.giardino", vivo: true },
    "cameras",
  );
  assert.equal(acceso.vivo, true);
  const spento = normalizeDevice(
    { name: "Giardino", entity: "camera.giardino", vivo: false },
    "cameras",
  );
  assert.equal(spento.vivo, false);
  /* Chi non ha mai scelto non si porta dietro un campo che non ha. */
  const mai = normalizeDevice({ name: "Giardino", entity: "camera.giardino" }, "cameras");
  assert.equal("vivo" in mai, false);
});

test("il muro chiede il flusso a chi è dal vivo, e fotogrammi a tutti gli altri", () => {
  const sorgente = readFileSync(
    new URL("../src/sections/live-ui-section.js", import.meta.url),
    "utf8",
  );
  /* Il ramo sta davanti al caricatore dei fotogrammi: chi è dal vivo non passa
   * di lì, e chi non lo è non cambia niente. */
  assert.match(sorgente, /if \(vuoleIlVivo\(camera\) && \(await avviaIlFlusso\(/);
  /* E il flusso non si riattacca a ogni giro del cronometro. */
  assert.match(sorgente, /if \(stessoFlusso\(image, indirizzo\)\) return true;/);
  /* Se il flusso non parte, l'istantanea resta la rete sotto: il segno se ne
   * va e al giro dopo il caricatore ci ricasca da solo. */
  assert.match(sorgente, /delete image\.dataset\.dmCameraStream;/);
});

test("la casella sta nella scheda, e racconta la telecamera che si sta guardando", () => {
  const sorgente = readFileSync(
    new URL("../src/sections/telecamera-vivo-section.js", import.meta.url),
    "utf8",
  );
  /* Il valore entra nel record passando dall'unica porta che scrive le
   * telecamere, prima che il salvataggio parta: niente seconda scrittura da
   * inseguire. */
  assert.match(sorgente, /root\.dmSaveCameras = nostro;/);
  /* E la matita su un'altra telecamera rilegge la spunta: senza, restava
   * quella di prima e la si sarebbe salvata sulla nuova senza toccarla. */
  assert.match(sorgente, /wrapFunction\("edEditCamera", "__dmVivoRilegge", rileggi\)/);
});
