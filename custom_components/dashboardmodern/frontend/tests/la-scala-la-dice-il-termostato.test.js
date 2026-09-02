/* La scala del clima la dichiara la macchina, non il codice (#252).
 *
 * «Ho una pompa di calore Samsung, dai 40 gradi a salire fino a 70 massimo.
 * Quando vado a inserire nel menu clima l'entita', mi mette in predefinito
 * 10-28 gradi.» Queste prove tengono ferme le due meta' della riparazione: la
 * pompa ottiene la sua scala, e chi non ne dichiara una non perde quella che
 * ha sempre avuto.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  SCALA_DI_FAMIGLIA,
  SCALA_LARGA,
  dentroLaScala,
  gradoNellaScala,
  passoDellUnita,
  quotaNellaScala,
  scalaDellUnita,
  scalaDellaZona,
  scalaDichiarata,
} from "../src/core/scala-clima.js";

test("la pompa di calore che dichiara 40-70 ottiene 40-70, in tutte e due le zone", () => {
  const pompa = { min_temp: 40, max_temp: 70 };
  assert.deepEqual([...scalaDellaZona(pompa, "caldo")], [40, 70]);
  assert.deepEqual([...scalaDellaZona(pompa, "freddo")], [40, 70]);
});

test("chi non dichiara niente tiene la scala che la plancia gli ha sempre dato", () => {
  assert.deepEqual([...scalaDellaZona({}, "caldo")], [...SCALA_DI_FAMIGLIA.caldo]);
  assert.deepEqual([...scalaDellaZona({}, "freddo")], [...SCALA_DI_FAMIGLIA.freddo]);
  assert.deepEqual([...scalaDellaZona(undefined, "caldo")], [...SCALA_DI_FAMIGLIA.caldo]);
  // Una zona che non esiste non lascia la card senza barra.
  assert.deepEqual([...scalaDellaZona({}, "pioggia")], [...SCALA_DI_FAMIGLIA.freddo]);
});

test("una scala scritta male non e' una scala", () => {
  // I due estremi uguali: la barra non avrebbe nessun grado da offrire.
  assert.equal(scalaDichiarata({ min_temp: 20, max_temp: 20 }), null);
  // Invertiti: obbedirci vorrebbe dire disegnare una corsa negativa.
  assert.equal(scalaDichiarata({ min_temp: 30, max_temp: 10 }), null);
  // Non numeri, o uno solo dei due.
  assert.equal(scalaDichiarata({ min_temp: "caldo", max_temp: 70 }), null);
  assert.equal(scalaDichiarata({ max_temp: 70 }), null);
  assert.equal(scalaDichiarata({}), null);
  // E in tutti questi casi la card ripiega, non resta senza estremi.
  assert.deepEqual([...scalaDellaZona({ min_temp: 30, max_temp: 10 }, "caldo")], [10, 28]);
});

test("il popup della Home non ha famiglia: il suo ripiego resta largo", () => {
  assert.deepEqual([...scalaDellUnita({})], [...SCALA_LARGA]);
  assert.deepEqual([...scalaDellUnita({ min_temp: 40, max_temp: 70 })], [40, 70]);
});

test("il passo e' quello dell'unita', un grado per chi non lo dice", () => {
  assert.equal(passoDellUnita({ target_temp_step: 0.5 }), 0.5);
  assert.equal(passoDellUnita({}), 1);
  // Zero e i numeri negativi non sono passi: bloccherebbero il pomello.
  assert.equal(passoDellUnita({ target_temp_step: 0 }), 1);
  assert.equal(passoDellUnita({ target_temp_step: -2 }), 1);
  // Il popup della Home chiede il suo ripiego storico da mezzo grado.
  assert.equal(passoDellUnita({}, 0.5), 0.5);
});

test("il dito sulla barra sceglie un grado che la macchina accetta", () => {
  const pompa = [40, 70];
  // A meta' corsa, cinquantacinque: prima la stessa frazione dava ventuno.
  assert.equal(gradoNellaScala(0.5, pompa, 1), 55);
  assert.equal(gradoNellaScala(0, pompa, 1), 40);
  assert.equal(gradoNellaScala(1, pompa, 1), 70);
  // Il passo scatta a partire dal minimo, non da zero.
  assert.equal(gradoNellaScala(0.17, [40, 70], 0.5), 45);
  // Un passo che non entra un numero intero di volte non porta oltre il massimo.
  assert.equal(gradoNellaScala(1, [40, 70], 0.4), 70);
  // Fuori dalla barra non si va: il dito che scappa resta agli estremi.
  assert.equal(gradoNellaScala(-3, pompa, 1), 40);
  assert.equal(gradoNellaScala(9, pompa, 1), 70);
  // I mezzi gradi restano leggibili: niente 45.00000000000001 sulla card.
  assert.equal(gradoNellaScala(1 / 3, [40, 70], 0.5), 50);
});

test("quota e ritaglio: dove sta il pomello e dove non puo' andare", () => {
  assert.equal(quotaNellaScala(45, [40, 70]), 1 / 6);
  assert.equal(quotaNellaScala(40, [40, 70]), 0);
  assert.equal(quotaNellaScala(70, [40, 70]), 1);
  // Un obiettivo fuori scala non spinge il pomello fuori dalla barra.
  assert.equal(quotaNellaScala(90, [40, 70]), 1);
  assert.equal(quotaNellaScala(10, [40, 70]), 0);
  // Una temperatura che non c'e' resta assente: non diventa zero gradi.
  assert.equal(quotaNellaScala(null, [40, 70]), null);
  assert.equal(quotaNellaScala(undefined, [40, 70]), null);
  assert.equal(dentroLaScala(90, [40, 70]), 70);
  assert.equal(dentroLaScala(null, [40, 70]), null);
});

test("la lettura di una unita' porta con se' scala e passo", async () => {
  const { climateReading } = await import(
    `../src/sections/climate-thermal-section.js?fix=${Date.now()}`
  );
  const states = {
    "climate.pompa": {
      state: "heat",
      attributes: {
        temperature: 45,
        current_temperature: 21.4,
        min_temp: 40,
        max_temp: 70,
        target_temp_step: 1,
      },
    },
  };
  const reading = climateReading("climate.pompa", states);
  assert.equal(reading.target, 45);
  assert.equal(reading.passo, 1);
  assert.deepEqual([...scalaDellaZona(reading.attributi, "caldo")], [40, 70]);
});

test("la pagina Clima non tiene piu' una copia sua della scala", async () => {
  const source = await readFile(
    new URL("../src/sections/climate-thermal-section.js", import.meta.url),
    "utf8",
  );
  // I due numeri scritti a mano vivono in un posto solo, e quel posto e' il
  // nucleo: se ricompaiono qui, la pagina ha ricominciato a decidere da sola.
  assert.ok(!/freddo:\s*\[16,\s*30\]/.test(source));
  assert.ok(!/caldo:\s*\[10,\s*28\]/.test(source));
  assert.ok(source.includes("scalaDellaZona"));
  // I due estremi della legenda si riscrivono: un'unita' che risponde tardi
  // deve poter correggere i numeri senza che la card venga rifatta.
  assert.ok(source.includes("data-dm-cl-low"));
  assert.ok(source.includes("data-dm-cl-high"));
});
