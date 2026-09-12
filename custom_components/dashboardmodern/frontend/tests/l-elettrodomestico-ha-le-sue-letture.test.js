/* «Come si aggiunge l'entità per la porta? Non ci sono riuscito nemmeno
 * nell'ultima versione» (#471, dopo la chiusura).
 *
 * Il campo c'era: era dentro la fisarmonica «Card avanzata», chiusa di suo su
 * un apparecchio nuovo, e il suo titolo elencava quattro cose — immagine,
 * durata, temperatura, costi — fra cui la porta non c'era. Chi legge il titolo
 * e non ci trova quello che cerca non apre il cassetto. Adesso lo nomina.
 *
 * E la richiesta larga, che era rimasta fuori: «in generale, se su ogni
 * elettrodomestico si potesse aggiungere un'entità dandole un nome — io
 * nell'asciugatrice monitoro temperatura aria e umidità residua — e sul
 * frigorifero uso sensori zigbee su entrambe le porte». Un apparecchio aveva
 * le sue caselle a nome fisso e basta. Adesso ha la fila «Altre letture», la
 * stessa che hanno il robot (#468) e i lettori (#451), con lo stesso
 * vocabolario: `core/letture-accanto.js` sa cos'è una lettura, come si chiama
 * senza il nome dell'apparecchio davanti, e con che unità si scrive.
 *
 * La seconda porta del frigorifero si risolve da sé: la prima sta nella sua
 * casella, la seconda è una lettura come le altre.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  elencoLetture,
  eUnaLettura,
  lettureDelDispositivo,
} from "../src/core/letture-accanto.js";

const leggi = (nome) => readFileSync(new URL(`../src/${nome}`, import.meta.url), "utf8");
const EDITOR = leggi("sections/appliance-editor-section.js");
const FINESTRA = leggi("sections/appliance-detail-popup-section.js");

const ASCIUGATRICE = {
  entity: "switch.asciugatrice",
  name: "Asciugatrice",
  letture: ["sensor.asciugatrice_temperatura_aria", "sensor.asciugatrice_umidita_residua"],
};

const STATI = {
  "sensor.asciugatrice_temperatura_aria": {
    entity_id: "sensor.asciugatrice_temperatura_aria",
    state: "48.4",
    attributes: {
      friendly_name: "Asciugatrice Temperatura aria",
      unit_of_measurement: "°C",
      device_class: "temperature",
    },
  },
  "sensor.asciugatrice_umidita_residua": {
    entity_id: "sensor.asciugatrice_umidita_residua",
    state: "12",
    attributes: {
      friendly_name: "Asciugatrice Umidità residua",
      unit_of_measurement: "%",
      device_class: "humidity",
    },
  },
};

test("le letture scelte si leggono col loro nome e la loro unità", () => {
  const voci = lettureDelDispositivo(ASCIUGATRICE, STATI, "it");
  assert.deepEqual(
    voci.map((voce) => voce.name),
    ["Temperatura aria", "Umidità residua"],
  );
  assert.deepEqual(
    voci.map((voce) => voce.testo),
    ["48,4 °C", "12 %"],
  );
  /* Il nome dell'apparecchio non si ripete davanti a ogni riga: la finestra è
   * già la sua. */
  for (const voce of voci) assert.doesNotMatch(voce.name, /Asciugatrice/);
});

test("l'ordine è quello in cui sono state aggiunte, senza doppioni", () => {
  const elenco = elencoLetture([
    "sensor.b",
    "sensor.a",
    "sensor.b",
    "switch.non_e_una_lettura",
    "",
  ]);
  assert.deepEqual(elenco, ["sensor.b", "sensor.a"]);
});

test("una seconda porta è una lettura come le altre", () => {
  /* «Utilizzo dei sensori zigbee su entrambe le porte, se possibile 2 sarebbe
   * graditissimo.» La prima porta ha la sua casella; la seconda entra qui. */
  assert.equal(eUnaLettura("binary_sensor.frigo_porta_congelatore"), true);
  const voci = lettureDelDispositivo(
    { entity: "switch.frigo", name: "Frigorifero", letture: ["binary_sensor.frigo_porta_2"] },
    {
      "binary_sensor.frigo_porta_2": {
        entity_id: "binary_sensor.frigo_porta_2",
        state: "on",
        attributes: { friendly_name: "Frigorifero Porta congelatore", device_class: "door" },
      },
    },
    "it",
  );
  assert.equal(voci.length, 1);
  assert.equal(voci[0].name, "Porta congelatore");
  assert.equal(voci[0].testo, "Aperta");
});

test("l'intestazione del cassetto nomina la porta", () => {
  const sommario = EDITOR.slice(EDITOR.indexOf("<summary>"), EDITOR.indexOf("</summary>"));
  assert.match(sommario, /porta/);
  assert.match(sommario, /door/);
});

test("la scheda ha la fila delle letture, con la stessa forma degli altri comandi", () => {
  /* Stessa struttura: campo nascosto con l'elenco, pastiglie scelte, casella
   * per scriverne una a mano, proposte trovate accanto. Una sezione che si
   * comporta in un altro modo è una sezione da imparare due volte. */
  assert.match(EDITOR, /<input type="hidden" name="letture"/);
  assert.match(EDITOR, /data-appl-letture-scelte/);
  assert.match(EDITOR, /data-appl-letture-proposte/);
  assert.match(EDITOR, /data-appl-lettura-nuova/);
  assert.match(EDITOR, /data-appl-let-add/);
});

test("un elenco vuoto non si salva: il campo se ne va", () => {
  /* Come per i comandi. Un apparecchio senza letture in più deve restare
   * esattamente com'era, o ogni salvataggio aggiungerebbe una casella vuota
   * al magazzino di tutti. */
  const salvataggio = EDITOR.slice(EDITOR.indexOf("const letture = elencoLetture(values.letture)"));
  assert.match(salvataggio.slice(0, 220), /if \(letture\.length\) next\.letture = letture;/);
  assert.match(salvataggio.slice(0, 220), /else delete next\.letture;/);
});

test("la finestra le disegna col vocabolario di tutti, non con uno suo", () => {
  assert.match(FINESTRA, /lettureDelDispositivo as lettureScelte,?\n\} from "\.\.\/core\/letture-accanto\.js";/);
  const blocco = FINESTRA.slice(FINESTRA.indexOf("function aggiungiAltreLetture"));
  assert.match(blocco.slice(0, 1200), /lettureScelte\(/);
  assert.match(blocco.slice(0, 1200), /Altre letture/);
  /* E si aprono nello storico come tutte le altre caselle della finestra. */
  assert.match(blocco.slice(0, 1200), /apriStorico\(event, voce\.entity, voce\.name\)/);
});

test("le letture stanno sopra i comandi, in tutti e due i rami della finestra", () => {
  /* La finestra ha due rami: l'apparecchio collegato a un'integrazione e
   * quello con le sue entità a mano. Una fila che compare in uno solo dei due
   * è una fila che metà delle persone non vedrà mai. */
  assert.equal(
    (FINESTRA.match(/aggiungiAltreLetture\(lista, appliance, titoletto\);/g) || []).length,
    2,
  );
  assert.equal(
    (FINESTRA.match(/aggiungiAltriComandi\(lista, appliance, titoletto\);/g) || []).length,
    2,
  );
  for (const pezzo of FINESTRA.split("aggiungiAltriComandi(lista, appliance, titoletto);").slice(0, 2))
    assert.match(pezzo.slice(-600), /aggiungiAltreLetture\(lista, appliance, titoletto\);/);
});

test("una lettura scelta a mano si vede una volta sola, non due", () => {
  /* L'apparecchio collegato a un'integrazione elenca «Le letture del
   * dispositivo»: tutte quelle che il dispositivo pubblica. Se una di quelle è
   * anche stata scelta a mano nella fila «Altre letture», la stessa misura
   * usciva due volte nella stessa finestra, a due caselle di distanza — e chi
   * legge due caselle uguali pensa che siano due sonde.
   *
   * Per i comandi la regola c'era già (#338) e diceva la stessa cosa: quello
   * che si è scelto a mano esce da dove lo mette l'integrazione. Qui mancava
   * la metà che riguarda le letture. */
  const blocco = FINESTRA.slice(
    FINESTRA.indexOf("function vesteIntegrazione("),
    FINESTRA.indexOf("const testa = doc.createElement(\"section\");"),
  );
  assert.match(blocco, /const scelteDaLeggere = new Set\(elencoLetture\(appliance\?\.letture\)\);/);
  assert.match(
    blocco,
    /const letture = viste\(nuove\(gruppi\.readings\)\)\.filter\(\s*\(voce\) => !scelteDaLeggere\.has\(voce\.entity\),\s*\);/,
  );
  /* E toglierle da lì non le fa sparire del tutto: se non resta altro da dire,
   * la finestra si apre lo stesso perché «Altre letture» ha ancora le sue. */
  assert.match(blocco, /!scelteDaLeggere\.size\n  \)\n    return;/);
  /* Lo stesso elenco che usa l'editor per salvarle: due modi di leggere quella
   * casella sarebbero due modi di sbagliarla. */
  assert.match(FINESTRA, /\n  elencoLetture,\n/);
});
