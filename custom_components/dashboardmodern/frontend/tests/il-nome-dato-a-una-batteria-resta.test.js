/* Il nome dato a una batteria resta scritto dove lo si legge.
 *
 * «nella sezione batterie, mi vengono mostrate le entità con il loro nome, nel
 *  mio caso molto lunghe ed illegibili, sarebbe possibile mettere un'etichetta
 *  o customizzare il nome visualizzato?» (#430)
 *
 * La casella per scriverlo c'era, e quello che ci si scriveva finiva in
 * `cd_avvisi_names_extra` insieme ai nomi del Quadro Avvisi. A leggerlo pero'
 * era rimasta solo la tessera della Home: la pagina e la scheda chiedevano il
 * nome a Home Assistant, e il nome dato spariva al primo ridisegno — quello
 * del salvataggio compreso.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const magazzino = new Map();
globalThis.localStorage = {
  getItem: (k) => (magazzino.has(k) ? magazzino.get(k) : null),
  setItem: (k, v) => magazzino.set(k, String(v)),
  removeItem: (k) => magazzino.delete(k),
};
globalThis.document = undefined;

const { CHIAVE_NOMI_SCELTI, nomeDellaBatteria } = await import(
  "../src/sections/batterie-elenco-section.js"
);
const { batterieLette } = await import("../src/core/batterie-di-casa.js");

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const leggi = (relativo) => readFileSync(join(SRC, relativo), "utf8");

const ENTITA = "sensor.sensore_porta_finestra_camera_matrimoniale_batteria";
const STATI = {
  [ENTITA]: {
    entity_id: ENTITA,
    state: "62",
    attributes: {
      device_class: "battery",
      unit_of_measurement: "%",
      friendly_name: "Sensore Porta/finestra Camera matrimoniale Batteria",
    },
  },
};

test("il nome scelto vince su quello dell'integrazione", () => {
  magazzino.clear();
  // Senza scelta si legge quello che dice Home Assistant, come prima.
  assert.equal(
    nomeDellaBatteria(ENTITA, STATI),
    "Sensore Porta/finestra Camera matrimoniale Batteria",
  );

  magazzino.set(CHIAVE_NOMI_SCELTI, JSON.stringify({ [ENTITA]: "Camera" }));
  assert.equal(nomeDellaBatteria(ENTITA, STATI), "Camera");

  // Un nome cancellato torna a essere quello di Home Assistant, non il vuoto.
  magazzino.set(CHIAVE_NOMI_SCELTI, JSON.stringify({ [ENTITA]: "   " }));
  assert.equal(
    nomeDellaBatteria(ENTITA, STATI),
    "Sensore Porta/finestra Camera matrimoniale Batteria",
  );

  // E chi non dice niente si fa chiamare col suo identificativo, leggibile.
  assert.equal(nomeDellaBatteria("sensor.pila_cucina", {}), "Pila cucina");
});

test("la mappa dei nomi si passa gia' letta, e vale lo stesso", () => {
  magazzino.clear();
  const nomi = { [ENTITA]: "Camera" };
  assert.equal(nomeDellaBatteria(ENTITA, STATI, nomi), "Camera");
  // La riga letta per la pagina porta quel nome dentro di sé.
  const [riga] = batterieLette([ENTITA], STATI, {
    soglia: 20,
    nome: (entity) => nomeDellaBatteria(entity, STATI, nomi),
  });
  assert.equal(riga.name, "Camera");
  assert.equal(riga.entity, ENTITA);
});

test("la pagina, la scheda e la tessera chiedono lo stesso nome", () => {
  const pagina = leggi("sections/batterie-section.js");
  const scheda = leggi("sections/batterie-editor-section.js");
  const ponte = leggi("sections/home-widgets-section.js");
  // Nessuna delle tre torna a chiedere il nome solo a Home Assistant.
  for (const [dove, fonte] of [
    ["la pagina", pagina],
    ["la scheda", scheda],
  ]) {
    assert.doesNotMatch(fonte, /nomeDaHomeAssistant/, `${dove} salta il nome scelto`);
    assert.match(fonte, /nomeDellaBatteria\(entity, states, nomi\)/);
  }
  // La chiave dei nomi ha un padrone solo: la scheda non se la riscrive.
  assert.match(scheda, /const CHIAVE_NOMI = CHIAVE_NOMI_SCELTI;/);
  assert.equal((scheda.match(/"cd_avvisi_names_extra"/g) || []).length, 0);
  // E la tessera non ha piu' una copia della regola.
  assert.match(ponte, /return nomeDellEntita\(entity, readJson\("cd_avvisi_names_extra", \{\}\)\?\.\[entity\], states\);/);
});
