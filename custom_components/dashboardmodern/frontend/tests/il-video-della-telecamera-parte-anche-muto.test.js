/* «Telecamere nemmeno va»: il popup resta su «Connessione WebRTC…».
 *
 * Nella foto della segnalazione si vede tutto: l'istantanea della telecamera
 * dietro, in mezzo il triangolo di play che disegna il browser, e sotto il velo
 * con la scritta. Il negoziato era andato a buon fine — il flusso era arrivato
 * — e mancava l'ultimo passo.
 *
 * Nessun browser di telefono lascia partire da solo un video con l'audio
 * acceso. Il popup del guscio accende l'audio prima ancora che il flusso
 * arrivi, e poi aspetta l'evento `playing` per togliere il velo: chiedendo
 * `play()` con l'audio acceso si riceve un rifiuto, `playing` non arriva mai, e
 * il velo resta lì per sempre sopra un fotogramma fermo.
 *
 * Il guscio quel rifiuto lo sapeva gestire. Questo modulo, che sostituisce il
 * suo negoziato per portarci i TURN di casa, nel cambio se l'era perso.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { faiPartireIlVideo } from "../src/sections/telecamera-webrtc-section.js";

const SORGENTE = readFileSync(
  new URL("../src/sections/telecamera-webrtc-section.js", import.meta.url),
  "utf8",
);

/* Un video finto che si comporta come quello del browser: `play()` rifiuta
 * finché l'audio è acceso, e accetta appena è muto. */
function videoDelTelefono({ ancheMuto = true } = {}) {
  const attributi = new Set();
  return {
    muted: false,
    volume: 0,
    partenze: [],
    setAttribute(nome) {
      attributi.add(nome);
    },
    removeAttribute(nome) {
      attributi.delete(nome);
    },
    haAttributo: (nome) => attributi.has(nome),
    play() {
      this.partenze.push({ muted: this.muted });
      if (!this.muted) return Promise.reject(new Error("NotAllowedError"));
      if (!ancheMuto) return Promise.reject(new Error("NotSupportedError"));
      return Promise.resolve();
    },
  };
}

test("nel popup si prova con l'audio, e al rifiuto si riparte muti", async () => {
  const video = videoDelTelefono();
  assert.equal(await faiPartireIlVideo(video, { conAudio: true }), "muto");
  assert.deepEqual(
    video.partenze.map((partenza) => partenza.muted),
    [false, true],
    "prima con l'audio, perché chi apre un popup di solito lo vuole",
  );
  assert.equal(video.muted, true);
  assert.equal(video.haAttributo("muted"), true, "anche l'attributo, non solo la proprietà");
});

test("se l'audio passa, resta acceso e non si tocca niente", async () => {
  const video = videoDelTelefono();
  video.play = function () {
    this.partenze.push({ muted: this.muted });
    return Promise.resolve();
  };
  assert.equal(await faiPartireIlVideo(video, { conAudio: true }), "audio");
  assert.equal(video.muted, false);
  assert.equal(video.volume, 1);
  assert.deepEqual(
    video.partenze.map((partenza) => partenza.muted),
    [false],
    "una sola partenza: la seconda sarebbe un video mutato per niente",
  );
});

test("le tessere del muro non ci provano nemmeno, con l'audio", async () => {
  /* Una parete di telecamere che parlano tutte insieme non la vuole nessuno. */
  const video = videoDelTelefono();
  assert.equal(await faiPartireIlVideo(video, { conAudio: false }), "muto");
  assert.deepEqual(
    video.partenze.map((partenza) => partenza.muted),
    [true],
  );
});

test("un video che non parte nemmeno muto lo dice, invece di far finta", async () => {
  const video = videoDelTelefono({ ancheMuto: false });
  assert.equal(await faiPartireIlVideo(video, { conAudio: true }), "fermo");
});

test("senza un video da far partire non si esplode", async () => {
  assert.equal(await faiPartireIlVideo(null, { conAudio: true }), "");
  assert.equal(await faiPartireIlVideo({}, { conAudio: true }), "");
});

test("il negoziato non ingoia più il rifiuto dell'autoplay", () => {
  /* Era `video.play?.()?.catch?.(() => {})`: il rifiuto spariva, e con lui
   * l'unica occasione di riprovare muti. */
  assert.doesNotMatch(SORGENTE, /video\.play\?\.\(\)\?\.catch\?\./);
  assert.match(SORGENTE, /faiPartireIlVideo\(video, \{ conAudio \}\)/);
  assert.match(SORGENTE, /faiPartireIlVideo\(video, \{ conAudio: false \}\)/);
});

test("il popup chiede l'audio, le tessere no", () => {
  /* Il popup pulisce l'`entity_id` una volta sola, in cima — gli serve anche
   * per spegnere la tessera della stessa telecamera — e poi lo passa di lì. */
  assert.match(SORGENTE, /avviaWebRtcNativo\(entity, videoEl, \{[\s\S]{0,120}conAudio: true/);
  assert.match(
    SORGENTE,
    /avviaWebRtcNativo\(entity, video, \{ attesa: attesaDelVideo\(stato\) \}\)/,
    "la tessera non passa conAudio: il valore di serie è muto",
  );
});
