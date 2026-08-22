/* Config sta in fondo, sempre.
 *
 * L'ordine della barra e' salvato in `cd_navbar_order`. Chi lo applica accoda
 * ogni scheda che quell'elenco non nomina, e l'elenco di chi aggiorna e' quello
 * salvato prima che la sezione Aspirapolvere esistesse: la scheda nuova finiva
 * dopo Config. Segnalato dal telefono, con la barra che leggeva
 * «… PIPPO · CONFIG · ASPIRAPOLVERE».
 */

import assert from "node:assert/strict";
import test from "node:test";

import { CONFIG_TAB, ordineConConfigInFondo } from "../src/sections/navigation-section.js";

test("una chiave sconosciuta accodata dopo config le passa davanti", () => {
  const applicato = ["home", "energy", "config", "aspirapolvere"];
  assert.deepEqual(ordineConConfigInFondo(applicato), [
    "home",
    "energy",
    "aspirapolvere",
    "config",
  ]);
});

test("l'ordine di tutto il resto non si tocca", () => {
  const scelto = ["piscina", "temp", "config", "server", "home"];
  assert.deepEqual(ordineConConfigInFondo(scelto), [
    "piscina",
    "temp",
    "server",
    "home",
    "config",
  ]);
});

test("se config e' gia' ultima non cambia niente", () => {
  const gia = ["home", "energy", CONFIG_TAB];
  assert.deepEqual(ordineConConfigInFondo(gia), gia);
});

test("una barra senza config resta com'e'", () => {
  const senza = ["home", "energy", "piscina"];
  assert.deepEqual(ordineConConfigInFondo(senza), senza);
});

test("un elenco vuoto non inventa niente", () => {
  assert.deepEqual(ordineConConfigInFondo([]), []);
});
