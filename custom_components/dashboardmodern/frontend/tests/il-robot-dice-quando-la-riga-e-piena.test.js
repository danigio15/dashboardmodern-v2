/* «Se collego il robot tramite integrazione HACS e cerco di inserire comandi
 * manuali custom, questi non vengono aggiunti. Se invece cerco di aggiungerli
 * integrando il robot manualmente, questi vengono aggiunti senza problemi.
 * Nel dettaglio sto cercando di aggiungere degli script che servono per
 * effettuare pulizie specifiche.» (#403)
 *
 * Le due strade differivano per una cosa sola: quanti comandi c'erano già. La
 * scheda ne tiene dodici, e un robot nato dall'integrazione arriva con quelli
 * che l'integrazione pubblica — su un Dreame o un Roborock sono facilmente
 * dodici, cioè il tetto. Da lì in poi il tredicesimo veniva scartato in
 * silenzio: si premeva «＋», si salvava, si ridisegnava, e non compariva
 * niente. Un rifiuto muto sembra un guasto, ed è stato segnalato come tale.
 *
 * Il tetto resta. Quello che cambia è che adesso si sa.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  COMANDI_MASSIMI,
  ESITI_COMANDO,
  bindRobotToDevice,
  conIlComando,
} from "../src/core/robot-model.js";

const pieni = Array.from({ length: COMANDI_MASSIMI }, (_, i) => `button.dreame_uno_${i}`);

test("con la riga piena il comando non entra, e l'esito lo dice", () => {
  const esito = conIlComando(pieni, "script.pulizia_cucina");
  assert.equal(esito.esito, ESITI_COMANDO.pieno);
  assert.deepEqual(esito.comandi, pieni);
});

test("con posto libero entra, ed è in fondo", () => {
  const quasi = pieni.slice(0, COMANDI_MASSIMI - 1);
  const esito = conIlComando(quasi, "script.pulizia_cucina");
  assert.equal(esito.esito, ESITI_COMANDO.aggiunto);
  assert.equal(esito.comandi.length, COMANDI_MASSIMI);
  assert.equal(esito.comandi.at(-1), "script.pulizia_cucina");
});

test("i due rifiuti che c'erano già restano distinti da quello nuovo", () => {
  /* Un doppione non è un errore di scrittura, e nessuno dei due è «pieno»:
   * tre motivi diversi meritano tre frasi diverse. */
  assert.equal(conIlComando(["script.a"], "script.a").esito, ESITI_COMANDO.gia);
  assert.equal(conIlComando([], "sensor.temperatura").esito, ESITI_COMANDO.nonComando);
  assert.equal(conIlComando([], "").esito, ESITI_COMANDO.nonComando);
});

test("è proprio l'integrazione che riempie la riga fino al tetto", () => {
  /* La riproduzione della segnalazione: un robot con molti tasti pubblicati
   * nasce già pieno, e da lì in poi non ci sta più niente. */
  const entities = Array.from({ length: 20 }, (_, i) => ({
    entity_id: `button.dreame_comando_${String(i).padStart(2, "0")}`,
  }));
  entities.push({ entity_id: "vacuum.dreame" });
  const robot = bindRobotToDevice({ device: { name: "Dreame" }, entities, index: 0 });
  assert.equal(robot.comandi.length, COMANDI_MASSIMI);
  assert.equal(conIlComando(robot.comandi, "script.pulizia_cucina").esito, ESITI_COMANDO.pieno);
  /* Tolto uno, lo script entra: è la via d'uscita che la frase deve indicare. */
  const dopo = conIlComando(robot.comandi.slice(1), "script.pulizia_cucina");
  assert.equal(dopo.esito, ESITI_COMANDO.aggiunto);
});

test("l'editor non aggiunge più senza guardare l'esito", () => {
  /* La riga che scartava in silenzio era `elencoComandi([...comandi, nuovo])`:
   * troncava e proseguiva come se niente fosse, salvando e ridisegnando. */
  const sorgente = readFileSync(
    new URL("../src/sections/robot-editor-section.js", import.meta.url),
    "utf8",
  );
  assert.match(sorgente, /const esito = conIlComando\(comandi, nuovo\)/);
  assert.doesNotMatch(sorgente, /elencoComandi\(\[\.\.\.comandi, nuovo\]\)/);
  /* E la frase del tetto esiste, con dentro la via d'uscita. */
  assert.match(sorgente, /togline uno per farci stare questo/);
});
