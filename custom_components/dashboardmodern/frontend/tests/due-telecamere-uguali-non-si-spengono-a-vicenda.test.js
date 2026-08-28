/* La stessa telecamera, due volte a schermo, si spegneva da sola.
 *
 * Da quando il dettaglio dei widget vive in un popup, la stessa inquadratura
 * sta a schermo in due posti nello stesso momento: la miniatura nella tessera
 * della Home e quella grande nel popup che ci si apre sopra. Il registro degli
 * object URL era tenuto per TELECAMERA, e le due immagini si davano il cambio
 * sulla stessa casella: la seconda che finiva di scaricare revocava il blob
 * della prima — ancora appeso al suo <img> — e quel riquadro diventava nero.
 * Al giro dopo toccava all'altra. E' il «refresh continuo e schermo nero» che
 * si vede solo nel popup delle telecamere.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const leggi = (relativo) => readFileSync(join(SRC, relativo), "utf8");

test("ogni immagine si porta la sua chiave, e revoca solo quello che mostrava lei", () => {
  const vivo = leggi("sections/live-ui-section.js");
  assert.match(vivo, /function chiaveImmagine\(image, entity\)/);
  assert.match(vivo, /image\.dataset\.dmCameraKey/);
  // La revoca non passa piu' dal nome della telecamera: due immagini della
  // stessa telecamera sono due inquilini diversi della stessa casa.
  assert.doesNotMatch(vivo, /replaceCameraObjectUrl\(camera\.entity/);
  assert.match(vivo, /replaceCameraObjectUrl\(chiave, objectUrl, registry\)/);
  assert.match(vivo, /replaceCameraObjectUrl\(chiave, url, registry\)/);
});

test("il fotogramma di prima resta finche' non arriva quello nuovo", () => {
  /* La regola che ha tolto il lampo di nero dalla tessera vale ancora: si
   * dichiara «loading» solo se non c'e' gia' qualcosa a schermo. */
  const vivo = leggi("sections/live-ui-section.js");
  assert.match(vivo, /if \(!stessaTelecamera \|\| image\.dataset\.dmCameraState !== "ready"\)/);
});

test("le miniature si cercano dove vive il dettaglio, non solo sotto le tessere", () => {
  const widget = leggi("sections/home-widgets-section.js");
  assert.match(widget, /#dm-widgets \[data-dm-w-cam\],#dm-widget-popup \[data-dm-w-cam\]/);
});
