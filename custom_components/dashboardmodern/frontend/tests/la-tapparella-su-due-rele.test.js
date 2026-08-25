/* La tapparella comandata da due relè (#194).
 *
 * «Ho 2 tende comandate da 2 Shelly 2PM e non riesco a inserire l'entità
 * corretta: l'entità cover che chiede la sezione non la trovo.» Uno Shelly
 * lasciato in modalità interruttore non espone una copertura: espone due
 * prese, una che manda su e una che manda giù. La casella accettava già un
 * relè singolo — acceso vuol dire aperta — ma un motore a due fili non
 * funziona così: chiudere non è spegnere la salita, è accendere la discesa.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { coverDownRelay, isRelayEntity } from "../src/core/cover-kind.js";
import { normalizeDevice } from "../src/core/device-model.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const leggi = (relativo) => readFileSync(join(SRC, relativo), "utf8");

test("un relè è uno switch, e nient'altro", () => {
  assert.equal(isRelayEntity("switch.tapparella_su"), true);
  assert.equal(isRelayEntity("cover.tapparella"), false);
  assert.equal(isRelayEntity("switch."), false);
  assert.equal(isRelayEntity(""), false);
});

test("il relè di discesa vale solo accanto a un altro relè", () => {
  assert.equal(
    coverDownRelay({ entity: "switch.tenda_su", down: "switch.tenda_giu" }),
    "switch.tenda_giu",
  );
  // Una copertura vera i due versi li ha già: il secondo relè non si applica.
  assert.equal(coverDownRelay({ entity: "cover.tenda", down: "switch.tenda_giu" }), "");
  // Né si accetta qualcosa che un relè non è.
  assert.equal(coverDownRelay({ entity: "switch.tenda_su", down: "cover.tenda" }), "");
  assert.equal(coverDownRelay({ entity: "switch.tenda_su", down: "binary_sensor.x" }), "");
  // Lo stesso relè per entrambi i versi manderebbe la tapparella contro sé
  // stessa: non è una configurazione, è un errore di battitura.
  assert.equal(coverDownRelay({ entity: "switch.tenda_su", down: "switch.tenda_su" }), "");
  assert.equal(coverDownRelay({ entity: "switch.tenda_su" }), "");
  assert.equal(coverDownRelay({}), "");
});

test("il relè di discesa sopravvive alla normalizzazione, come il preset prima di lui", () => {
  const normalizzata = normalizeDevice(
    { id: "w1", name: "Tenda", entity: "switch.tenda_su", down: "switch.tenda_giu" },
    "covers",
    { rooms: [] },
  );
  assert.equal(normalizzata.down, "switch.tenda_giu");
  const senza = normalizeDevice(
    { id: "w2", name: "Tapparella", entity: "cover.tapparella", down: "switch.tenda_giu" },
    "covers",
    { rooms: [] },
  );
  assert.equal("down" in senza, false);
});

test("la pagina traduce i servizi cover in comandi che un relè capisce", () => {
  const scena = leggi("sections/shutter-scene-section.js");
  // Il relè di discesa lo trova dalla riga di configurazione dell'entità.
  assert.match(scena, /const releGiuDi = \(entity\)/);
  assert.match(scena, /coverDownRelay\(item\)/);
  // La traduzione non è scritta qui: è una regola sola, in core, perché la
  // usa anche la tessera in Home. Qui si chiama e si eseguono i comandi
  // nell'ordine in cui escono — che è l'ordine che tiene i due contatti
  // lontani l'uno dall'altro.
  assert.match(scena, /relayCoverCommands\(servizio, entity, releGiuDi\(entity\)\)/);
  assert.match(scena, /for \(const \{ entity: bersaglio, service \} of comandi\) releSwitch/);
});

test("con due relè la card dice se sale o se scende, e non inventa dove sia", () => {
  const scena = leggi("sections/shutter-scene-section.js");
  assert.match(scena, /status = su \? "opening" : scende \? "closing" : "unknown"/);
  // La forma della card cambia col relè di discesa: la firma lo deve sapere.
  assert.match(scena, /c\.settable, c\.kind, c\.preset, c\.down/);
});

test("la casella c'è in tutti e tre gli editor, e la principale dice che accetta un relè", () => {
  const infisso = leggi("sections/shutter-window-section.js");
  assert.match(infisso, /"ed-tp-down"/);
  assert.match(infisso, /switch\.tapparella_giu/);
  assert.match(infisso, /oppure switch\.tapparella_su/);

  const crud = leggi("sections/editor-crud-section.js");
  assert.match(crud, /setField\("ed-tp-down"/);
  assert.match(crud, /coverDownRelay\(\{/);

  const modale = leggi("sections/unified-editors-section.js");
  assert.match(modale, /name="down"/);
  assert.match(modale, /data-pick-down/);
  // Un relè scritto dove non serve non si perde in silenzio: lo dice.
  assert.match(modale, /Il relè di discesa dev'essere un'entità switch\./);
});

test("i comandi del relè stanno scritti una volta sola, e li usano tutti e due", async () => {
  const { relayCoverCommands } = await import("../src/core/cover-kind.js");
  // Un relè solo: acceso apre, spento chiude, e non c'è niente da fermare.
  assert.deepEqual(relayCoverCommands("open_cover", "switch.su"), [
    { entity: "switch.su", service: "turn_on" },
  ]);
  assert.deepEqual(relayCoverCommands("close_cover", "switch.su"), [
    { entity: "switch.su", service: "turn_off" },
  ]);
  assert.deepEqual(relayCoverCommands("stop_cover", "switch.su"), []);
  // Due relè: il verso opposto si spegne per primo, sempre.
  assert.deepEqual(relayCoverCommands("open_cover", "switch.su", "switch.giu"), [
    { entity: "switch.giu", service: "turn_off" },
    { entity: "switch.su", service: "turn_on" },
  ]);
  assert.deepEqual(relayCoverCommands("close_cover", "switch.su", "switch.giu"), [
    { entity: "switch.su", service: "turn_off" },
    { entity: "switch.giu", service: "turn_on" },
  ]);
  assert.deepEqual(relayCoverCommands("stop_cover", "switch.su", "switch.giu"), [
    { entity: "switch.su", service: "turn_off" },
    { entity: "switch.giu", service: "turn_off" },
  ]);
  // Una copertura vera non passa di qui.
  assert.deepEqual(relayCoverCommands("open_cover", "cover.tapparella"), []);

  // E la regola non è scritta due volte: la usano la pagina e la tessera.
  assert.match(leggi("sections/shutter-scene-section.js"), /relayCoverCommands\(servizio, entity, releGiuDi\(entity\)\)/);
  const ponte = leggi("sections/home-widgets-section.js");
  assert.match(ponte, /relayCoverCommands\(servizio, entity, clean\(cover\.dataset\.dmWDown\)\)/);
  // La tessera mostra le frecce anche a un relè, che prima restava a guardare.
  assert.match(ponte, /row\.isCover \|\| row\.relay/);
  assert.match(ponte, /data-dm-w-down=/);
});
