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
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ACTION_ICON_CATALOG,
  LOAD_ICON_CATALOG,
  ROOM_CATALOG,
} from "../src/core/personalization-catalog.js";
import {
  actionCatalogMatch,
  loadCatalogMatch,
  roomCatalogMatch,
} from "../src/core/personalization-catalog.js";
import { canonicalArtworkType } from "../src/core/appliance-artwork.js";
import { chiaveDelDisegno, chiaviDaProvare, chiaviDisegnate } from "../src/core/catalogo-disegni.js";

/* Si cerca il disegno partendo da dove parte lo schermo: dal nome mdi salvato
 * nella configurazione, con lo stesso giro che fa il motore delle icone.
 *
 * Prima si partiva dall'identificativo della voce, che pero' lo schermo non ce
 * l'ha: bastava che il catalogo non sapesse risalire dal nome mdi alla voce
 * perche' la prova restasse verde e la faccina tornasse in mezzo alle scocche.
 * E' successo per tredici voci. */
const disegnata = (kind, voce) => {
  const trovata =
    kind === "room"
      ? roomCatalogMatch(voce.mdi)
      : kind === "load"
        ? loadCatalogMatch(voce.mdi)
        : actionCatalogMatch(voce.mdi);
  return chiaviDaProvare(kind, voce.mdi, trovata).some(
    (chiave) => canonicalArtworkType(chiave) || chiaveDelDisegno(chiave),
  );
};

test("ogni stanza del catalogo ha il suo disegno", () => {
  const senza = ROOM_CATALOG.filter((voce) => !disegnata("room", voce)).map((voce) => voce.id);
  assert.deepEqual(senza, [], `stanze senza disegno: ${senza.join(", ")}`);
});

test("ogni azione rapida ha il suo disegno", () => {
  const senza = ACTION_ICON_CATALOG.filter((voce) => !disegnata("action", voce)).map(
    (voce) => voce.id,
  );
  assert.deepEqual(senza, [], `azioni senza disegno: ${senza.join(", ")}`);
});

test("ogni carico ha il suo disegno", () => {
  const senza = LOAD_ICON_CATALOG.filter((voce) => !disegnata("load", voce)).map((voce) => voce.id);
  assert.deepEqual(senza, [], `carichi senza disegno: ${senza.join(", ")}`);
});

/* «A qualsiasi parte viene richiesta una icona deve puntare sempre ed
 * esclusivamente al nostro catalogo»: il guscio aveva un selettore suo, una
 * griglia piatta di emoji di sistema, agganciato a cinque caselle — stanze,
 * temperature, piani, report. Adesso quelle caselle passano dal catalogo di
 * casa, e la funzione del guscio e' dirottata a monte, dove sono scritti gli
 * `onclick` del markup vendorizzato. */
test("il selettore emoji del guscio e' dirottato sul catalogo di casa", () => {
  const motore = readFileSync(
    new URL("../src/sections/icon-engine-section.js", import.meta.url),
    "utf8",
  );
  assert.match(motore, /root\.wzPickIcon = scegliDalCatalogo/);
  for (const campo of [
    "ed-st-icon",
    "ed-st2-icon",
    "ed-st2-flicon",
    "wz-st-icon",
    "ed-rep2-icon",
  ])
    assert.ok(motore.includes(`"${campo}"`), `casella non dirottata: ${campo}`);
  /* Le linguette dei piani stampano l'icona come testo nudo: li' si scrive il
   * segno, non il nome mdi, o si legge «mdi:home» per esteso. */
  assert.match(motore, /"ed-st2-flicon": \{ kind: "room", glifo: true \}/);
});

/* E il nome mdi va alla sua voce, non alla prima che gli somiglia: `mdi:home`
 * apriva la soffitta. */
test("il nome mdi porta alla sua voce, non a una che le somiglia", () => {
  for (const voce of ROOM_CATALOG) assert.equal(roomCatalogMatch(voce.mdi)?.id, voce.id);
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
