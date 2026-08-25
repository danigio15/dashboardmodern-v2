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

test("apri accende la salita, chiudi la discesa, ferma le spegne entrambe", () => {
  const scena = leggi("sections/shutter-scene-section.js");
  assert.match(scena, /function releGiuDi|const releGiuDi/);
  assert.match(scena, /coverDownRelay\(item\)/);
  // Il verso opposto si spegne per primo: due contatti chiusi insieme su un
  // motore a due fili non devono succedere mai.
  assert.match(scena, /releSwitch\(sale \? giu : entity, "turn_off"\)/);
  assert.match(scena, /releSwitch\(sale \? entity : giu, "turn_on"\)/);
  assert.match(scena, /if \(servizio === "stop_cover"\) \{\s*\n\s*releSwitch\(entity, "turn_off"\);\s*\n\s*releSwitch\(giu, "turn_off"\);/);
  // Con un relè solo resta il comportamento di prima: acceso apre, spento
  // chiude, e non c'è niente da fermare.
  assert.match(scena, /if \(servizio === "stop_cover"\) return true; \/\/ niente da fermare/);
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
