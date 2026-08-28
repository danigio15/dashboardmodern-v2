/* Nel catalogo di serie non c'e' piu' una sola emoji.
 *
 * «Le icone non sono stilizzate nello stesso modo: crea un catalogo
 * proprietario nostro e crea le icone sullo stesso stile degli
 * elettrodomestici, su tutto il catalogo non ci devono essere differenze.»
 *
 * Nella stessa schermata convivevano tre stili: la scocca blu notte degli
 * elettrodomestici, il tratto sottile delle stanze e — per le stanze nel
 * selettore dei carichi, per le azioni, per i carichi — le emoji del sistema,
 * che per giunta cambiano faccia da un telefono a un altro: la stessa plancia
 * non era uguale nemmeno a se stessa.
 *
 * Questa prova pretende che ogni voce dei tre cataloghi abbia il suo disegno.
 * Aggiungerne una senza disegnarla fa cadere la prova, ed e' l'unico modo
 * perche' fra sei mesi non ricompaia una faccina in mezzo alle scocche.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTION_ICON_CATALOG,
  LOAD_ICON_CATALOG,
  ROOM_CATALOG,
} from "../src/core/personalization-catalog.js";
import { canonicalArtworkType } from "../src/core/appliance-artwork.js";
import { chiaveDelDisegno, chiaviDisegnate } from "../src/core/catalogo-disegni.js";

const disegnata = (voce, prefisso = "") => {
  const chiave = prefisso ? `${prefisso}${voce.id}` : voce.id;
  return Boolean(
    canonicalArtworkType(chiave) ||
      canonicalArtworkType(voce.id) ||
      canonicalArtworkType(voce.mdi) ||
      chiaveDelDisegno(chiave) ||
      chiaveDelDisegno(voce.id) ||
      chiaveDelDisegno(voce.mdi),
  );
};

test("ogni stanza del catalogo ha il suo disegno", () => {
  const senza = ROOM_CATALOG.filter((voce) => !disegnata(voce, "room-")).map((voce) => voce.id);
  assert.deepEqual(senza, [], `stanze senza disegno: ${senza.join(", ")}`);
});

test("ogni azione rapida ha il suo disegno", () => {
  const senza = ACTION_ICON_CATALOG.filter((voce) => !disegnata(voce)).map((voce) => voce.id);
  assert.deepEqual(senza, [], `azioni senza disegno: ${senza.join(", ")}`);
});

test("ogni carico ha il suo disegno", () => {
  const senza = LOAD_ICON_CATALOG.filter((voce) => !disegnata(voce)).map((voce) => voce.id);
  assert.deepEqual(senza, [], `carichi senza disegno: ${senza.join(", ")}`);
});

/* E i disegni sono davvero della stessa famiglia: stesso riquadro, stessa
 * tavolozza. Un disegno fatto a occhio con altri colori passerebbe le prove
 * qui sopra e sarebbe di nuovo «non stilizzato nello stesso modo». */
test("i disegni nuovi usano il riquadro e la tavolozza degli elettrodomestici", async () => {
  const { disegnoDelCatalogo } = await import("../src/core/catalogo-disegni.js");
  const consentiti = new Set([
    "#e0f2fe", // il fondo
    "#ffffff", // il riflesso
    "#0f2942", // la scocca
    "#f8fafc", // il frontale
    "#8be2ff", // il vetro
    "#0ea5e9", // l'accento
    "#94a3b8", // lo spento
    "#fbbf24", // il caldo
    "#22c55e", // il verde
    "none",
  ]);
  for (const chiave of chiaviDisegnate()) {
    const disegno = disegnoDelCatalogo(chiave, 96);
    assert.match(disegno, /viewBox="0 0 96 96"/, chiave);
    assert.match(disegno, /class="dm-art-panel"/, `${chiave} non ha il riquadro di famiglia`);
    for (const colore of disegno.match(/(?:fill|stroke)="([^"]+)"/g) || []) {
      const valore = colore.split('"')[1].toLowerCase();
      if (valore.startsWith("url(")) continue;
      assert.equal(consentiti.has(valore), true, `${chiave} usa un colore fuori tavolozza: ${valore}`);
    }
  }
});
