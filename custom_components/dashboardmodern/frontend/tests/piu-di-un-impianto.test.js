/* Piu' di un impianto sotto lo stesso tetto.
 *
 * «Io ho una casa che e' l'unione di due appartamenti, quindi ho 2 misuratori di
 * consumo nei due appartamenti e ogni appartamento ha i rispettivi carichi.
 * Nella pagina energia nativa di HA e' fattibile, qui mi pare che non si possa
 * fare.»
 *
 * Due regole vengono prima di tutto, e sono quelle che questi test difendono.
 *
 * La prima: non si sposta niente. L'impianto che c'e' gia' resta dov'e', con le
 * chiavi che il runtime legge da sempre, e chi ha una casa sola non migra un bel
 * niente.
 *
 * La seconda nasce da come sono andate le auto: un id che si ricava dal nome e
 * si ricalcola a ogni salvataggio non e' un'identita', e quello che gli era
 * appeso si perde. Qui l'id nasce una volta, non cambia mai, e non torna buono
 * una seconda volta nemmeno quando l'impianto che lo portava viene cancellato.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  LOAD_PLANT_FIELD,
  PLANT_GROUPS,
  PRIMO_IMPIANTO,
  SEQ_FIELD,
  assignLoadPlant,
  configuredPlants,
  dropPlantLoads,
  loadBelongsToPlant,
  nuovoImpianto,
  nuovoImpiantoId,
  pickPlant,
  plantIsConfigured,
  plantKey,
  plantLabel,
  plantList,
  plantLoads,
  storedPlants,
} from "../src/core/energy-plants.js";

const VECCHIO = Object.freeze({
  house: { total_energy: "sensor.casa_totale" },
  grid: { power: "sensor.rete" },
  solar: {},
  battery: {},
  metadata: { semantics: 3 },
});

test("una casa sola resta una casa sola, e non migra niente", () => {
  const lista = plantList(VECCHIO);
  assert.equal(lista.length, 1);
  assert.equal(lista[0].id, PRIMO_IMPIANTO);
  assert.deepEqual(lista[0].house, { total_energy: "sensor.casa_totale" });
  // Risalvata, torna esattamente com'era: le stesse chiavi al primo livello.
  const salvato = storedPlants(lista, VECCHIO);
  for (const gruppo of PLANT_GROUPS) assert.deepEqual(salvato[gruppo], VECCHIO[gruppo]);
  assert.equal(salvato.metadata.semantics, 3);
  assert.equal("plants" in salvato, false);
});

test("il secondo impianto sta accanto al primo, non al posto suo", () => {
  const lista = plantList(VECCHIO);
  const salvato = storedPlants([...lista, nuovoImpianto(lista, "Casa Donato")], VECCHIO);
  // Il primo e' rimasto al primo livello: il runtime lo legge dove lo cercava.
  assert.deepEqual(salvato.house, VECCHIO.house);
  assert.equal(salvato.plants.length, 1);
  assert.equal(salvato.plants[0].name, "Casa Donato");
  // E rileggendo tornano tutti e due, nell'ordine.
  assert.deepEqual(
    plantList(salvato).map((plant) => plant.id),
    [PRIMO_IMPIANTO, "impianto-2"],
  );
});

test("l'id non si ricava dal nome, e rinominare non cambia identita'", () => {
  const lista = plantList(VECCHIO);
  const nato = nuovoImpianto(lista, "Casa Donato");
  const rinominato = { ...nato, name: "Casa di sotto" };
  assert.equal(rinominato.id, nato.id);
  // E non c'e' niente del nome dentro l'id: e' un numero d'ordine, non uno slug.
  assert.match(nato.id, /^impianto-\d+$/);
  assert.equal(nato.id.includes("donato"), false);
});

test("un id cancellato non torna buono una seconda volta", () => {
  /* Chi cancella l'ultimo impianto e ne aggiunge un altro si ritroverebbe lo
   * stesso id, e con esso i carichi e la tariffa di quello cancellato. Il segno
   * resta scritto anche quando l'impianto che l'ha alzato non c'e' piu'. */
  let stored = VECCHIO;
  for (const nome of ["Casa Donato", "Box"]) {
    const lista = plantList(stored);
    stored = storedPlants([...lista, nuovoImpianto(lista, nome, stored.metadata)], stored);
  }
  assert.equal(stored.metadata[SEQ_FIELD], 3);
  // Via il terzo.
  stored = storedPlants(
    plantList(stored).filter((plant) => plant.id !== "impianto-3"),
    stored,
  );
  assert.equal(stored.metadata[SEQ_FIELD], 3, "il segno non deve scendere");
  assert.equal(nuovoImpiantoId(plantList(stored), stored.metadata), "impianto-4");
});

test("il primo impianto tiene le chiavi di runtime che ha sempre avuto", () => {
  /* Lo storico di chi c'era prima non deve ripartire da zero: la tariffa del
   * primo impianto resta `cd_costo_kwh`, e solo gli altri portano il loro id. */
  const [primo, secondo] = plantList(storedPlants(
    [...plantList(VECCHIO), nuovoImpianto(plantList(VECCHIO), "Casa Donato")],
    VECCHIO,
  ));
  assert.equal(plantKey("cd_costo_kwh", primo, 0), "cd_costo_kwh");
  assert.equal(plantKey("cd_costo_kwh", secondo, 1), "cd_costo_kwh_impianto-2");
});

test("un carico senza impianto scritto appartiene al primo, sempre", () => {
  /* E' cio' che permette a otto carichi gia' configurati di restare dove sono
   * il giorno in cui questo campo compare. */
  const carichi = [
    { id: "a", name: "Pompa di calore" },
    { id: "b", name: "Forno", [LOAD_PLANT_FIELD]: "impianto-2" },
  ];
  const [primo, secondo] = [{ id: PRIMO_IMPIANTO }, { id: "impianto-2" }];
  assert.deepEqual(plantLoads(carichi, primo, 0).map((load) => load.id), ["a"]);
  assert.deepEqual(plantLoads(carichi, secondo, 1).map((load) => load.id), ["b"]);
  assert.equal(loadBelongsToPlant({}, primo, 0), true);
  assert.equal(loadBelongsToPlant({}, secondo, 1), false);
});

test("spostare un carico sul primo impianto svuota il campo, non ci scrive dentro", () => {
  /* Scriverci `impianto` renderebbe due configurazioni identiche diverse fra
   * loro: quella di chi non ha mai visto questa schermata, e quella di chi ha
   * spostato un carico avanti e indietro. */
  const carichi = [{ id: "a", [LOAD_PLANT_FIELD]: "impianto-2" }];
  assert.equal(assignLoadPlant(carichi, "a", PRIMO_IMPIANTO)[0][LOAD_PLANT_FIELD], "");
  assert.equal(assignLoadPlant(carichi, "a", "impianto-3")[0][LOAD_PLANT_FIELD], "impianto-3");
});

test("cancellare un impianto porta via i suoi carichi, e nessun altro", () => {
  const carichi = [
    { id: "a" },
    { id: "b", [LOAD_PLANT_FIELD]: "impianto-2" },
    { id: "c", [LOAD_PLANT_FIELD]: "impianto-3" },
  ];
  assert.deepEqual(dropPlantLoads(carichi, "impianto-2").map((load) => load.id), ["a", "c"]);
  // Il primo impianto non si cancella: portarne via i carichi sarebbe svuotare
  // la configurazione di chi non ha mai chiesto piu' di un impianto.
  assert.deepEqual(dropPlantLoads(carichi, PRIMO_IMPIANTO).map((load) => load.id), ["a", "b", "c"]);
});

test("un impianto vuoto non e' configurato, ma il primo si disegna lo stesso", () => {
  assert.equal(plantIsConfigured({ house: {}, grid: {} }), false);
  assert.equal(plantIsConfigured({ grid: { power: "sensor.x" } }), true);
  // Una plancia appena installata mostra la sua pagina vuota, non nessuna pagina.
  assert.equal(configuredPlants({}).length, 1);
  assert.equal(configuredPlants(VECCHIO).length, 1);
});

test("un impianto senza nome ne ha comunque uno da mostrare", () => {
  assert.equal(plantLabel({}, 0, "Impianto"), "Impianto");
  assert.equal(plantLabel({}, 1, "Impianto"), "Impianto 2");
  assert.equal(plantLabel({ name: "Casa Donato" }, 1, "Impianto"), "Casa Donato");
});

test("una configurazione gia' scritta come elenco non perde il primo", () => {
  const lista = plantList([{ id: "impianto", house: { total_energy: "sensor.x" } }, { id: "impianto-2" }]);
  assert.equal(lista.length, 2);
  assert.deepEqual(lista[0].house, { total_energy: "sensor.x" });
});

test("l'impianto scelto, o il primo che c'e'", () => {
  const lista = plantList(storedPlants(
    [...plantList(VECCHIO), nuovoImpianto(plantList(VECCHIO), "Casa Donato")],
    VECCHIO,
  ));
  assert.equal(pickPlant(lista, "impianto-2").name, "Casa Donato");
  assert.equal(pickPlant(lista, "impianto-99").id, PRIMO_IMPIANTO);
  assert.equal(pickPlant([], "qualunque"), null);
});

test("il modulo e' puro: non sa cos'e' una pagina ne' dove si salva", async () => {
  const modello = await readFile(new URL("../src/core/energy-plants.js", import.meta.url), "utf8");
  assert.doesNotMatch(modello, /\bdocument\.|\blocalStorage\.|getContext|createElement/);
});

test("la sezione legge l'impianto scelto, e con una casa sola non cambia niente", async () => {
  const sezione = await readFile(
    new URL("../src/sections/energy-section.js", import.meta.url),
    "utf8",
  );
  /* `energyModel()` e' il collo di bottiglia da cui tutta la sezione legge la
   * configurazione: e' li' che l'impianto si sceglie, una volta sola, invece
   * che in ognuno dei posti che leggono. */
  const helper = sezione.match(/function energyModel\(\)[\s\S]*?\n\}/)[0];
  assert.match(helper, /pickPlant\(plantList\(salvato\)/);
  // Si sostituiscono i quattro gruppi e nient'altro: i metadati restano.
  assert.match(helper, /\.\.\.salvato,/);
  assert.match(helper, /PLANT_GROUPS\.map\(/);
  /* La linguetta aperta non e' configurazione: sta fuori dal modello, come il
   * periodo scelto. Tenerla dentro vorrebbe dire sporcare un salvataggio ogni
   * volta che si guarda l'altro impianto. */
  assert.match(sezione, /IMPIANTO_SCELTO_KEY = "cd_energy_plant"/);
  assert.doesNotMatch(helper, /writeEnergyField|persistEnergy/);
});

test("le linguette compaiono solo quando c'e' davvero una scelta", async () => {
  const sezione = await readFile(
    new URL("../src/sections/energy-plants-section.js", import.meta.url),
    "utf8",
  );
  /* Con una casa sola una linguetta non offre nessuna scelta: e' un ingombro,
   * e chi non ha chiesto due misuratori non deve vederla. */
  assert.match(sezione, /if \(lista\.length < 2\) \{\s*riga\?\.remove\(\);/);
  // La riga si posa SOPRA la barra che c'e' gia': la pagina non cambia.
  assert.match(sezione, /barra\.before\(riga\)/);
  assert.match(sezione, /\.sub-tabs-container/);
  /* La scheda si ridisegna da capo a ogni giro e portava via la riga con se':
   * chi la ridisegna lo dice, e ci si aggancia li'. */
  assert.match(sezione, /onEditorRedraw\("__dmEnergyPlantsSection", schedule\)/);
});

test("rinominare un impianto non ne cambia l'identita'", async () => {
  const sezione = await readFile(
    new URL("../src/sections/energy-plants-section.js", import.meta.url),
    "utf8",
  );
  const rinomina = sezione.match(/async function rinomina[\s\S]*?\n\}/)[0];
  /* Si tocca il nome e nient'altro: la voce si copia per intero e le si
   * riscrive una chiave sola. Un `id:` fra le chiavi scritte vorrebbe dire
   * ricalcolare l'identita' rinominando — che e' esattamente cio' che alle auto
   * ha fatto perdere le foto. */
  assert.match(rinomina, /\{ \.\.\.voce, name: clean\(nome\) \}/);
  const scritte = rinomina.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(scritte, /\bid:/);
});

test("il primo impianto non si elimina, e il salvataggio va su quello aperto", async () => {
  const sezione = await readFile(
    new URL("../src/sections/energy-plants-section.js", import.meta.url),
    "utf8",
  );
  assert.match(sezione, /if \(clean\(id\) === PRIMO_IMPIANTO\) return;/);
  const energia = await readFile(
    new URL("../src/sections/energy-section.js", import.meta.url),
    "utf8",
  );
  /* Il gemello della lettura: la maschera mostra i campi dell'impianto scelto,
   * e senza questo il salvataggio li poserebbe sul primo — cancellando le
   * entita' di una casa con quelle di un'altra. */
  assert.match(energia, /writeEnergyField\(dashboardStore\(\), group, key, value, impiantoScelto\(\)\)/);
  assert.match(energia, /const impianto = pickPlant\(plantList\(grezzo\), impiantoScelto\(\)\)/);
});

test("una scrittura sul primo impianto resta esattamente dov'era", async () => {
  /* E' la garanzia di retrocompatibilita' scritta come test: con il primo
   * impianto — cioe' per chiunque non abbia chiesto due misuratori — la
   * scrittura tocca il primo livello e non crea nessun elenco. */
  const writer = await readFile(
    new URL("../src/core/energy-writer.js", import.meta.url),
    "utf8",
  );
  const dove = writer.match(/function scriviNellImpianto[\s\S]*?\n\}/)[0];
  assert.match(dove, /if \(!impianto \|\| impianto\.id === PRIMO_IMPIANTO\) \{\s*muta\(model\);/);
  assert.match(dove, /storedPlants\(/);
});
