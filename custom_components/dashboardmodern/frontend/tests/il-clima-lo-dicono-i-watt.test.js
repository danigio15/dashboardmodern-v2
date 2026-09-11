/* «Il condizionatore da spento mi dà 7 W di consumo e quindi mi risulta acceso.
 * È messo sotto una presa smart. Si potrebbe indicare un valore in W dopo il
 * quale diventa acceso? Oppure aggiungere nel setting del condizionatore
 * l'entità di consumo e un valore minimo che indichi lo stato di off. Credo che
 * ci sia su elettrodomestici» (#490).
 *
 * C'è, e da un pezzo: un elettrodomestico ha la sua soglia in watt, perché una
 * lavatrice spenta consuma lo stesso qualcosa. Un climatizzatore comandato da
 * una presa ha esattamente lo stesso problema, e fino a qui la plancia gli
 * credeva sulla parola del termostato.
 *
 * Il modulo che decide è puro, e il caso che conta è quello della segnalazione:
 * il termostato dice «cool», la presa dice 7 W, la soglia dice 20. Vince la
 * presa.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  accesoPerIlConsumo,
  entitaDelConsumo,
  sogliaDelConsumo,
  wattDellUnita,
} from "../src/core/consumo-del-clima.js";

const leggi = (nome) => readFileSync(new URL(`../src/${nome}`, import.meta.url), "utf8");

const PRESA = "sensor.presa_condizionatore_potenza";
const UNITA = { entity: "climate.salotto", consumo: PRESA, soglia_consumo: 20 };

const watt = (valore, unita = "W") => ({
  [PRESA]: { entity_id: PRESA, state: String(valore), attributes: { unit_of_measurement: unita } },
});

test("sette watt sotto una soglia di venti sono spento", () => {
  /* È il caso della segnalazione, alla lettera. */
  assert.equal(accesoPerIlConsumo(UNITA, watt(7)), false);
});

test("sopra la soglia è acceso, e la soglia stessa è accesa", () => {
  assert.equal(accesoPerIlConsumo(UNITA, watt(850)), true);
  /* Chi scrive 20 vuol dire «da venti in su sta lavorando»: il punto in cui si
   * passa sta dalla parte dell'acceso. */
  assert.equal(accesoPerIlConsumo(UNITA, watt(20)), true);
  assert.equal(accesoPerIlConsumo(UNITA, watt(19.9)), false);
});

test("senza soglia non si dice niente, e decide lo stato come sempre", () => {
  /* `null` non è «spento»: è «io non ho niente da dire». Tornare `false` qui
   * vorrebbe dire spegnere la card di chiunque non abbia messo la soglia. */
  assert.equal(accesoPerIlConsumo({ entity: "climate.salotto" }, watt(850)), null);
  assert.equal(accesoPerIlConsumo({ ...UNITA, soglia_consumo: "" }, watt(850)), null);
  assert.equal(accesoPerIlConsumo({ ...UNITA, soglia_consumo: "molto" }, watt(850)), null);
  assert.equal(accesoPerIlConsumo(null, watt(850)), null);
});

test("un sensore che non risponde non spegne niente", () => {
  /* L'altro modo di sbagliare, e il peggiore: una card che si spegne perché il
   * sensore tace, non perché l'unità è ferma. */
  assert.equal(accesoPerIlConsumo(UNITA, watt("unavailable")), null);
  assert.equal(accesoPerIlConsumo(UNITA, watt("unknown")), null);
  assert.equal(accesoPerIlConsumo(UNITA, {}), null);
  assert.equal(accesoPerIlConsumo({ ...UNITA, consumo: "sensor.non_esiste" }, watt(7)), null);
});

test("i kilowatt si leggono come kilowatt", () => {
  /* Una presa che pubblica kW letta come se fossero W direbbe che 0,85 kW sono
   * meno di niente: un condizionatore a pieno regime risulterebbe spento. */
  assert.equal(wattDellUnita(UNITA, watt(0.85, "kW")), 850);
  assert.equal(accesoPerIlConsumo(UNITA, watt(0.85, "kW")), true);
  assert.equal(accesoPerIlConsumo(UNITA, watt(0.007, "kW")), false);
  /* E la virgola dei decimali non fa cadere il conto. */
  assert.equal(wattDellUnita(UNITA, watt("7,5")), 7.5);
});

test("zero è una soglia scritta, non una casella vuota", () => {
  /* «Qualunque consumo è acceso» è una configurazione legittima: chi ha una
   * presa che a riposo legge zero spaccato la vuole. */
  assert.equal(sogliaDelConsumo({ soglia_consumo: 0 }), 0);
  assert.equal(sogliaDelConsumo({ soglia_consumo: "0" }), 0);
  assert.equal(sogliaDelConsumo({}), null);
  assert.equal(sogliaDelConsumo({ soglia_consumo: -5 }), null);
  assert.equal(accesoPerIlConsumo({ ...UNITA, soglia_consumo: 0 }, watt(0.4)), true);
  assert.equal(entitaDelConsumo(UNITA), PRESA);
  assert.equal(entitaDelConsumo({}), "");
});

test("la lettura della card passa dai watt, e li porta con sé", () => {
  const sorgente = leggi("sections/climate-thermal-section.js");
  const dentro = sorgente.slice(sorgente.indexOf("export function climateReading"));
  assert.match(dentro.slice(0, 1200), /accesoPerIlConsumo\(unita, states\)/);
  /* Il verdetto dei watt vince, ma solo quando c'è: `null` lascia la regola di
   * sempre. */
  assert.match(dentro.slice(0, 1200), /daiWatt === null \? Boolean\(entry\) && !OFF_STATES/);
  /* E il numero arriva alla card, o chi ha messo la soglia non saprebbe su
   * cosa l'ha messa. */
  assert.match(dentro.slice(0, 1200), /watt: wattDellUnita\(unita, states\)/);
});

test("la scheda ha le due caselle, e non salva quelle vuote", () => {
  const editor = leggi("sections/unified-editors-section.js");
  assert.match(editor, /name="consumo"/);
  assert.match(editor, /name="soglia_consumo"/);
  assert.match(editor, /if \(!list\[index\]\.consumo\) delete list\[index\]\.consumo;/);
  /* Lo zero resta: è una soglia scritta. Solo la casella vuota se ne va. */
  assert.match(editor, /if \(list\[index\]\.soglia_consumo === ""\) delete list\[index\]\.soglia_consumo;/);
});
