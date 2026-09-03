/* Le telecamere che dormono non lasciano un quadratino rotto (#294).
 *
 * «Nella sezione Sicurezza visualizzo i riquadri ma non si vedono le live:
 * compare un quadratino azzurro. Solo cliccando il riquadro parte una live con
 * alcuni secondi di ritardo. Rispetto alla versione precedente non e' cambiato
 * molto: si blocca la visione.»
 *
 * Sono due difetti sulla stessa tessera. Il quadratino azzurro e' l'immagine
 * rotta di Safari: il flusso di una Arlo non parte al primo colpo, l'immagine
 * riceve un errore e resta li' con un indirizzo che non ha risposto — e quattro
 * secondi dopo la si richiedeva uguale. La visione che si blocca e' un MJPEG che
 * ha smesso di spingere fotogrammi senza dirlo: nessun evento, l'ultimo
 * fotogramma fermo con LIVE acceso sopra.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  FERMO_DOPO_MS,
  LATO_IMPRONTA,
  OGNI_SGUARDO_MS,
  creaSorveglianza,
  improntaDeiPixel,
} from "../src/core/flusso-fermo.js";
import {
  PAUSA_DOPO_CADUTA_MS,
  flussoInPausa,
  mettiInPausaIlFlusso,
} from "../src/core/telecamera-dal-vivo.js";

const leggi = (percorso) => readFileSync(new URL(`../src/${percorso}`, import.meta.url), "utf8");

test("un flusso caduto si mette in pausa un minuto, e poi si riprova", () => {
  const immagine = { dataset: {} };
  assert.equal(flussoInPausa(immagine, 1000), false);
  assert.equal(mettiInPausaIlFlusso(immagine, 1000), 1000 + PAUSA_DOPO_CADUTA_MS);
  assert.equal(PAUSA_DOPO_CADUTA_MS, 60_000);
  assert.equal(flussoInPausa(immagine, 1000), true);
  assert.equal(flussoInPausa(immagine, 1000 + PAUSA_DOPO_CADUTA_MS - 1), true);
  assert.equal(flussoInPausa(immagine, 1000 + PAUSA_DOPO_CADUTA_MS), false);
  /* Senza immagine non c'e' niente da segnare, e non si esplode. */
  assert.equal(mettiInPausaIlFlusso(null), 0);
  assert.equal(flussoInPausa(null), false);
  assert.equal(flussoInPausa({ dataset: { dmCameraStreamPausa: "ciao" } }), false);
});

test("l'impronta dei pixel cambia quando cambia il fotogramma", () => {
  const fermo = new Uint8ClampedArray([10, 20, 30, 255, 40, 50, 60, 255]);
  const uguale = new Uint8ClampedArray([10, 20, 30, 255, 40, 50, 60, 255]);
  const diverso = new Uint8ClampedArray([10, 20, 31, 255, 40, 50, 60, 255]);
  const scambiato = new Uint8ClampedArray([40, 50, 60, 255, 10, 20, 30, 255]);
  assert.equal(improntaDeiPixel(fermo), improntaDeiPixel(uguale));
  assert.notEqual(improntaDeiPixel(fermo), improntaDeiPixel(diverso));
  /* Gli stessi colori in un altro ordine sono un altro fotogramma. */
  assert.notEqual(improntaDeiPixel(fermo), improntaDeiPixel(scambiato));
  assert.equal(typeof improntaDeiPixel(null), "string");
  assert.equal(LATO_IMPRONTA, 16);
});

test("fermo vuol dire uguale a se stesso da mezzo minuto, non da un istante", () => {
  assert.equal(FERMO_DOPO_MS, 30_000);
  assert.ok(OGNI_SGUARDO_MS < FERMO_DOPO_MS, "si guarda piu' spesso di quanto si condanna");
  const sorveglianza = creaSorveglianza();
  /* Il primo sguardo non condanna nessuno. */
  assert.equal(sorveglianza.osserva("cam-1", "a", 0), "vivo");
  /* Dieci secondi uguali sono un corridoio vuoto, non un flusso fermo. */
  assert.equal(sorveglianza.osserva("cam-1", "a", 10_000), "vivo");
  assert.equal(sorveglianza.osserva("cam-1", "a", 29_999), "vivo");
  assert.equal(sorveglianza.osserva("cam-1", "a", 30_000), "fermo");
  /* Un fotogramma nuovo azzera il conto. */
  assert.equal(sorveglianza.osserva("cam-1", "b", 31_000), "vivo");
  assert.equal(sorveglianza.osserva("cam-1", "b", 50_000), "vivo");
  assert.equal(sorveglianza.osserva("cam-1", "b", 61_000), "fermo");
  /* Due telecamere non si confondono. */
  assert.equal(sorveglianza.osserva("cam-2", "b", 61_000), "vivo");
  assert.equal(sorveglianza.quante(), 2);
  sorveglianza.dimentica("cam-1");
  assert.equal(sorveglianza.quante(), 1);
  assert.equal(sorveglianza.osserva("cam-1", "b", 62_000), "vivo");
});

test("il caricatore: l'istantanea prima del flusso, e l'istantanea dopo che il flusso cade", () => {
  const sorgente = leggi("sections/live-ui-section.js");
  /* Alla caduta: pausa, e subito l'istantanea al posto dell'immagine rotta. */
  assert.match(
    sorgente,
    /image\.onerror = \(\) => \{[\s\S]*?delete image\.dataset\.dmCameraStream;\s*mettiInPausaIlFlusso\(image\);\s*image\.dataset\.dmCameraState = "unavailable";\s*ripiegaSullIstantanea\(camera, image, registry\);/,
  );
  /* Finche' la pausa dura, la tessera vive di istantanee. */
  assert.match(sorgente, /if \(vuoleIlVivo\(camera\) && !flussoInPausa\(image\)\) \{/);
  /* E prima di chiedere il flusso a una tessera ancora vuota si mette la foto. */
  assert.match(
    sorgente,
    /await caricaIstantanea\(camera, image, registry, picture\);\s*if \(await avviaIlFlusso\(camera, image, picture, registry\)\) return true;/,
  );
  /* Il mestiere dei fotogrammi e' uno solo, e lo chiamano tutti e due. */
  assert.match(sorgente, /async function caricaIstantanea\(camera, image, registry, picture\)/);
  assert.match(sorgente, /return caricaIstantanea\(camera, image, registry, picture\);/);
});

test("il muro sorveglia i flussi fermi, dal cronometro che ha gia'", () => {
  const sorgente = leggi("sections/live-ui-section.js");
  assert.match(sorgente, /export function sorvegliaIFlussi\(/);
  /* Dallo stesso cronometro del muro: niente timer nuovo. */
  assert.match(sorgente, /sorvegliaIFlussi\(\);\s*refreshCameraThumbnails\(\);/);
  /* Chi e' fermo si molla, si mette in pausa, e torna alle istantanee. */
  assert.match(
    sorgente,
    /!== "fermo"\) continue;[\s\S]*?delete image\.dataset\.dmCameraStream;\s*mettiInPausaIlFlusso\(image, adesso\);[\s\S]*?ripiegaSullIstantanea\(camera, image, state\.cameraUrls\);/,
  );
  /* Una tela che non si lascia leggere spegne la sorveglianza, non il muro. */
  assert.match(sorgente, /state\.sorveglianzaNegata = true;/);
});

test("un fotogramma che non e' arrivato non si mostra: niente quadratino azzurro", () => {
  const sicurezza = leggi("sections/security-showcase-section.js");
  assert.match(sicurezza, /\.dm-cam-feed>img\[data-dm-camera-state="unavailable"\]\{opacity:0\}/);
  /* E al suo posto una riga che dice cosa si aspetta, nella lingua giusta. */
  assert.match(
    sicurezza,
    /\.dm-cam-feed:has\(>img\[data-dm-camera-state="unavailable"\]\)::after\{\s*content:\$\{cssString\(t\("In attesa del fotogramma", "Waiting for a frame"\)\)\}/,
  );
});
