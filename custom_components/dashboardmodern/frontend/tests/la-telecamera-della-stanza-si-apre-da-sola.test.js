/* «Se vado su stanze e c'è una telecamera e ci clicco sopra dovrebbe aprire
 * solo quella e non puntare sulla scheda dove ci sono tutte le telecamere. Se
 * poi torno indietro non torna sulla stanza dov'ero» (#503).
 *
 * Le due metà sono la stessa cosa. La riga della stanza portava nella pagina
 * Sicurezza — dove ci sono TUTTE le telecamere — e portare altrove vuol dire
 * uscire dalla stanza: chi esce poi deve ritrovarla, e non la ritrovava.
 * Aprendo la finestra della singola telecamera sopra la stanza non si esce
 * affatto: si chiude la finestra e si è ancora lì.
 *
 * Qui si prova la parte che sa dire QUALE telecamera, che è una lista e niente
 * altro. Il gesto vero ha la sua prova col documento.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const magazzino = new Map();
globalThis.localStorage = {
  getItem: (k) => (magazzino.has(k) ? magazzino.get(k) : null),
  setItem: (k, v) => magazzino.set(k, String(v)),
  removeItem: (k) => magazzino.delete(k),
};
globalThis.document = undefined;

const { telecameraDellEntita } = await import("../src/sections/rooms-page-section.js");

const SORGENTE = readFileSync(
  new URL("../src/sections/rooms-page-section.js", import.meta.url),
  "utf8",
);

const CAMERE = [
  { id: "c1", name: "Ingresso", entity: "camera.ingresso" },
  { id: "c2", name: "Giardino", entity: "camera.giardino" },
  { id: "c3", name: "Garage", entity: "camera.garage" },
];

test("la telecamera si riconosce, e col suo posto nella lista", () => {
  /* Il posto serve: il guscio nomina le telecamere con «camSlug(cam, i)», e
   * quell'«i» è la posizione. Trovata la riga e persa la posizione, il nome
   * verrebbe fuori diverso da quello che il guscio ha scritto sulla sua
   * scheda, e la finestra si aprirebbe vuota. */
  assert.deepEqual(telecameraDellEntita("camera.giardino", CAMERE), {
    indice: 1,
    riga: CAMERE[1],
  });
  assert.equal(telecameraDellEntita("camera.ingresso", CAMERE).indice, 0);
});

test("quello che non è una telecamera non lo diventa", () => {
  /* La riga della stanza è la stessa per tutti: una luce, una cassa, una
   * presa. Solo il dominio «camera» apre la finestra; tutto il resto riprende
   * la strada di prima, che è la sua sezione. */
  assert.equal(telecameraDellEntita("light.salone", CAMERE), null);
  assert.equal(telecameraDellEntita("media_player.cucina", CAMERE), null);
  assert.equal(telecameraDellEntita("", CAMERE), null);
  assert.equal(telecameraDellEntita(null, CAMERE), null);
});

test("una telecamera che in configurazione non c'è più non si inventa", () => {
  /* Cancellata dalla scheda Telecamere, la riga della stanza può restare per
   * un giro: aprire una finestra su una telecamera che non esiste vorrebbe
   * dire un rettangolo nero con scritto «non trovata». Meglio la strada di
   * prima, che almeno porta in un posto che esiste. */
  assert.equal(telecameraDellEntita("camera.cancellata", CAMERE), null);
  assert.equal(telecameraDellEntita("camera.ingresso", []), null);
  assert.equal(telecameraDellEntita("camera.ingresso", null), null);
});

test("si legge anche la telecamera scritta col nome vecchio del campo", () => {
  /* Le configurazioni vecchie scrivono «camera_entity»: chi le normalizza sta
   * altrove, ma qui non si può contare sul fatto che ci sia già passato. */
  assert.equal(
    telecameraDellEntita("camera.vecchia", [{ id: "v", camera_entity: "camera.vecchia" }]).indice,
    0,
  );
});

test("il tocco apre la finestra e NON cambia pagina", () => {
  /* Il punto della segnalazione: prima si faceva `tab?.click()`, cioè si
   * usciva dalla stanza. Adesso, se la finestra si apre, il tocco finisce lì. */
  assert.match(SORGENTE, /if \(apriLaTelecamera\(entita\)\) return;/);
  /* E se non si apre, la strada di prima è ancora tutta lì: non si è tolto
   * niente a chi la telecamera non ce l'ha in configurazione. */
  assert.match(
    SORGENTE,
    /if \(apriLaTelecamera\(entita\)\) return;\n\s*const tab = doc\?\.querySelector\?\.\(/,
  );
  /* La finestra è quella del guscio, non una seconda disegnata qui: due
   * finestre per la stessa telecamera vorrebbero dire due connessioni. */
  assert.match(SORGENTE, /root\.apriCamera\(root\.camSlug\(trovata\.riga, trovata\.indice\)/);
});
