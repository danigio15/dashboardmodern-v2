/* «Problema telecamere Arlo» (#385).
 *
 * Nei registri allegati: `[Cam] ✓ HLS` e subito dopo uno stallo con due
 * millesimi di secondo in pancia. La strada era stata dichiarata buona perche'
 * era arrivata l'intestazione del flusso — `loadedmetadata`, il primo dei
 * quattro eventi che il guscio accetta — e di immagini non ne era arrivata
 * nessuna. Dichiarandola buona non si provava piu' niente altro: sotto c'erano
 * il flusso del proxy e le istantanee, che sono proprio la modalita' fatta per
 * le telecamere che trasmettono su richiesta.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  aspettaCheSiMuova,
  siEMosso,
} from "../src/sections/telecamera-il-video-si-muove-section.js";

/* Un video finto: `readyState` e `currentTime` sono le due cose che si leggono. */
function video(passi) {
  const letture = [...passi];
  return {
    readyState: 1,
    get currentTime() {
      return letture.length > 1 ? letture.shift() : letture[0];
    },
  };
}

const subito = () => Promise.resolve();

test("un flusso dal vivo si posiziona sul bordo: «maggiore di zero» non basta", () => {
  /* Agganciato il flusso, `currentTime` diventa subito un numero grande senza
   * che sia stato mostrato niente. La domanda e' se si MUOVE. */
  assert.equal(siEMosso(12.5, 12.5), false);
  assert.equal(siEMosso(0, 0), false);
  assert.equal(siEMosso(12.5, 13.1), true);
  /* Un tremolio da niente non e' partire. */
  assert.equal(siEMosso(12.5, 12.52), false);
  assert.equal(siEMosso(Number.NaN, 3), false);
  assert.equal(siEMosso(3, Number.NaN), false);
});

test("il video che si muove passa, e non aspetta la fine dell'attesa", async () => {
  const v = video([10, 10.4, 10.9]);
  assert.equal(await aspettaCheSiMuova(v, { attesa: 4000, passo: 100, dormi: subito }), true);
});

test("il video che ha gia' abbastanza per andare passa subito", async () => {
  const v = video([0]);
  v.readyState = 3;
  assert.equal(await aspettaCheSiMuova(v, { attesa: 4000, passo: 100, dormi: subito }), true);
});

test("il video fermo sul bordo solleva, e la catena scende alla strada dopo", async () => {
  /* E' il caso della Arlo: l'intestazione c'e', il tempo sta fermo. */
  const v = video([12.5]);
  await assert.rejects(
    () => aspettaCheSiMuova(v, { attesa: 800, passo: 100, dormi: subito }),
    (errore) => {
      /* Il messaggio finisce nell'elenco che il guscio scrive quando nessuna
       * strada regge: deve dire cosa e' successo, non «errore». */
      assert.match(errore.message, /HLS/);
      assert.match(errore.message, /immagini|pictures/);
      return true;
    },
  );
});

test("senza nessun video non si inventa un fallimento", async () => {
  /* Se l'HLS non e' la strada che ha disegnato, non c'e' niente da giudicare. */
  assert.equal(await aspettaCheSiMuova(null, { attesa: 400, passo: 100, dormi: subito }), true);
});

test("il guscio si avvolge una volta sola, e ricorda chi c'era prima", async () => {
  const { readFileSync } = await import("node:fs");
  const { dirname, join } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const qui = dirname(fileURLToPath(import.meta.url));
  const sorgente = readFileSync(
    join(qui, "..", "src/sections/telecamera-il-video-si-muove-section.js"),
    "utf8",
  );
  assert.match(sorgente, /precedente\.__dmVideoSiMuove/);
  assert.match(sorgente, /avvolta\.__dmPrevious = precedente/);
  /* Il guscio storico non si tocca: si avvolge la sua funzione. */
  assert.match(sorgente, /root\.dmCamHLS = avvolta/);
  const runtime = readFileSync(join(qui, "..", "src/sections/section-runtime.js"), "utf8");
  assert.match(runtime, /installVideoSiMuove\(\);/);
});
