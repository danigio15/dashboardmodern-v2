/* «Telecamere continua a dare problema, vedi che parte doppia connessione
 * insieme» — con la foto del popup che mostra due cose sovrapposte: un
 * fotogramma sotto, il segnaposto di un `<video>` fermo sopra, e in fondo il
 * velo «Connessione WebRTC…» che non se ne va.
 *
 * Il popup può chiedere di aprire due volte la stessa telecamera senza che
 * nessuno abbia sbagliato: la strada ricordata ha un permesso di tempo corto, e
 * quando scade la plancia riparte con la fila intera del guscio — che rifà lo
 * stesso negoziato. Il primo però non si fermava, perché finché non riesce non
 * c'è niente da chiudere in mano a nessuno: la pulizia del guscio chiude quello
 * che trova nella sua variabile, e lì dentro ci arriva solo una connessione
 * RIUSCITA.
 *
 * Due trattative aperte sulla stessa telecamera, due `<video>` di cui uno già
 * staccato dalla pagina, e il velo agganciato a quello staccato.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const WEBRTC = readFileSync(
  new URL("../src/sections/telecamera-webrtc-section.js", import.meta.url),
  "utf8",
);
const SUBITO = readFileSync(
  new URL("../src/sections/telecamera-subito-section.js", import.meta.url),
  "utf8",
);

test("il negoziato si può chiudere da subito, non solo quando riesce", () => {
  assert.match(WEBRTC, /quandoSiPuoChiudere = null/);
  assert.match(
    WEBRTC,
    /quandoSiPuoChiudere\?\.\(\(\.\.\.argomenti\) => chiudiPresto\(\.\.\.argomenti\)\)/,
  );
  /* E appena la chiusura vera esiste, prende il posto di quella di ripiego. */
  assert.match(WEBRTC, /chiudiPresto = chiudi;/);
});

test("un'apertura nuova chiude quella di prima prima di cominciare", () => {
  const apertura = WEBRTC.slice(
    WEBRTC.indexOf("async function avviaPerIlPopup"),
    WEBRTC.indexOf("root.__dmWebRtcPc = sessione.pc;"),
  );
  assert.match(apertura, /chiudiIlNegoziatoDelPopup\?\.\(\)/);
  assert.match(apertura, /chiudiIlNegoziatoDelPopup = null;/);
  /* E si tiene il modo di chiudere anche questa, per la volta dopo. */
  assert.match(apertura, /quandoSiPuoChiudere: \(chiudi\) => \{/);
});

test("e spegne la tessera della stessa telecamera, che nessuno sta guardando", () => {
  /* Il popup si apre sopra la tessera: per una telecamera che regge un flusso
   * solo, due sono uno di troppo. */
  const apertura = WEBRTC.slice(
    WEBRTC.indexOf("async function avviaPerIlPopup"),
    WEBRTC.indexOf("root.__dmWebRtcPc = sessione.pc;"),
  );
  assert.match(apertura, /spegniSessione\(entity, \{ pausa: false \}\)/);
});

test("la scorciatoia che scade ferma il suo negoziato prima di riprovare", () => {
  /* È il caso che capita davvero: la strada ricordata ha un permesso corto,
   * scade mentre la trattativa è ancora aperta, e la fila intera ne apre una
   * seconda. */
  assert.match(
    SUBITO,
    /import \{ fermaIlNegoziatoDelPopup \} from "\.\/telecamera-webrtc-section\.js";/,
  );
  const pulizia = SUBITO.slice(SUBITO.indexOf("function ripulisci()"));
  const corpo = pulizia.slice(0, pulizia.indexOf("\n}"));
  assert.match(corpo, /fermaIlNegoziatoDelPopup\(\)/);
  /* Prima del guscio: la sua pulizia non vede una trattativa in volo. */
  assert.ok(corpo.indexOf("fermaIlNegoziatoDelPopup()") < corpo.indexOf("dmCleanupWebRTC"));
});

test("chiudere il popup ferma anche la trattativa in volo", () => {
  assert.match(WEBRTC, /const pulizia = root\.dmCamCleanup;/);
  assert.match(WEBRTC, /fermaIlNegoziatoDelPopup\(\);\s*return pulizia\.apply\(root, argomenti\);/);
  /* Una sola volta: avvolgere l'avvolto a ogni giro farebbe una catena. */
  assert.match(WEBRTC, /!pulizia\.__dmTelecameraWebRtc/);
});
