import assert from "node:assert/strict";
import test from "node:test";

import { readLegacyLocaleBundle } from "./legacy-source.js";

const glossary = [
  ["No room", "Nessuna stanza"],
  ["Overview", "Panoramica"],
  ["Power", "Potenza"],
  ["Energy", "Energia"],
  ["Duration", "Durata"],
  ["History", "Storico"],
  ["Running", "In funzione"],
  ["On", "Acceso"],
  ["Off", "Spento"],
  ["Not configured", "Non configurato"],
  ["Choose entity", "Scegli entità"],
  ["Edit camera", "Modifica telecamera"],
  ["Current consumption", "Consumo attuale"],
  ["Daily consumption", "Consumo giornaliero"],
  ["Monthly consumption", "Consumo mensile"],
  ["Total", "Totale"],
  ["Camera", "Telecamera"],
  ["Room", "Stanza"],
  ["Cameras", "Telecamere"],
  ["Rooms", "Stanze"],
];
const completeWord = (value) =>
  new RegExp(`(?<![A-Za-zÀ-ÿ_])${value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}(?![A-Za-zÀ-ÿ_])`);

test("Italian dashboard contains none of the audited English UI glossary", () => {
  const source = readLegacyLocaleBundle("dashboard.html", "it");
  for (const [english] of glossary)
    assert.equal(completeWord(english).test(source), false, english);
});

test("English dashboard contains none of the audited Italian UI glossary", () => {
  const source = readLegacyLocaleBundle("dashboard-en.html", "en");
  for (const [, italian] of glossary)
    assert.equal(completeWord(italian).test(source), false, italian);
});
