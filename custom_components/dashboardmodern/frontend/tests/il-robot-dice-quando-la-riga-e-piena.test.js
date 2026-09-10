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
  ESITI_ELENCO,
  bindRobotToDevice,
  conLaVoce,
  tettoDellElenco,
} from "../src/core/robot-model.js";

const pieni = Array.from({ length: COMANDI_MASSIMI }, (_, i) => `button.dreame_uno_${i}`);
const conIlComando = (comandi, nuovo) => conLaVoce(comandi, nuovo, "comandi");

test("con la riga piena il comando non entra, e l'esito lo dice", () => {
  const esito = conIlComando(pieni, "script.pulizia_cucina");
  assert.equal(esito.esito, ESITI_ELENCO.pieno);
  assert.deepEqual(esito.elenco, pieni);
});

test("con posto libero entra, ed è in fondo", () => {
  const quasi = pieni.slice(0, COMANDI_MASSIMI - 1);
  const esito = conIlComando(quasi, "script.pulizia_cucina");
  assert.equal(esito.esito, ESITI_ELENCO.aggiunto);
  assert.equal(esito.elenco.length, COMANDI_MASSIMI);
  assert.equal(esito.elenco.at(-1), "script.pulizia_cucina");
});

test("i due rifiuti che c'erano già restano distinti da quello nuovo", () => {
  /* Un doppione non è un errore di scrittura, e nessuno dei due è «pieno»:
   * tre motivi diversi meritano tre frasi diverse. */
  assert.equal(conIlComando(["script.a"], "script.a").esito, ESITI_ELENCO.gia);
  assert.equal(conIlComando([], "sensor.temperatura").esito, ESITI_ELENCO.nonValida);
  assert.equal(conIlComando([], "").esito, ESITI_ELENCO.nonValida);
});

test("mappe e letture hanno il loro tetto, e lo dicono allo stesso modo (#468)", () => {
  /* La regola e' una sola, scritta una volta: tre liste, tre tetti, e gli
   * stessi quattro esiti. Prima era scritta solo per i comandi, e quando sono
   * arrivate le mappe e le letture il rischio era riscriverla due volte —
   * cioe' due posti nuovi dove il tetto poteva tornare muto. */
  const mappe = Array.from({ length: tettoDellElenco("mappe") }, (_, i) => `image.piano_${i}`);
  assert.equal(conLaVoce(mappe, "image.mansarda", "mappe").esito, ESITI_ELENCO.pieno);
  assert.equal(conLaVoce(mappe.slice(1), "image.mansarda", "mappe").esito, ESITI_ELENCO.aggiunto);
  assert.equal(conLaVoce([], "sensor.temperatura", "mappe").esito, ESITI_ELENCO.nonValida);

  const letture = Array.from({ length: tettoDellElenco("letture") }, (_, i) => `sensor.robot_${i}`);
  assert.equal(conLaVoce(letture, "sensor.filtro", "letture").esito, ESITI_ELENCO.pieno);
  assert.equal(conLaVoce([], "sensor.filtro", "letture").esito, ESITI_ELENCO.aggiunto);
  assert.equal(conLaVoce([], "button.premi", "letture").esito, ESITI_ELENCO.nonValida);
  /* Una lista che non esiste non aggiunge niente a caso. */
  assert.equal(conLaVoce([], "sensor.filtro", "boh").esito, ESITI_ELENCO.nonValida);
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
  assert.equal(conIlComando(robot.comandi, "script.pulizia_cucina").esito, ESITI_ELENCO.pieno);
  /* Tolto uno, lo script entra: è la via d'uscita che la frase deve indicare. */
  const dopo = conIlComando(robot.comandi.slice(1), "script.pulizia_cucina");
  assert.equal(dopo.esito, ESITI_ELENCO.aggiunto);
});

test("l'editor non aggiunge più senza guardare l'esito", () => {
  /* La riga che scartava in silenzio era `elencoComandi([...comandi, nuovo])`:
   * troncava e proseguiva come se niente fosse, salvando e ridisegnando. */
  const sorgente = readFileSync(
    new URL("../src/sections/robot-editor-section.js", import.meta.url),
    "utf8",
  );
  assert.match(sorgente, /const esito = conLaVoce\(elenco, nuovo, tipo\)/);
  assert.doesNotMatch(sorgente, /elencoComandi\(\[\.\.\.comandi, nuovo\]\)/);
  /* E la frase del tetto esiste, con dentro la via d'uscita — per tutt'e tre
   * le liste che un robot si porta dietro, non solo per i comandi (#468). */
  assert.match(sorgente, /togline uno per farci stare questo/);
  assert.match(sorgente, /togline una per farci stare questa/);
});
