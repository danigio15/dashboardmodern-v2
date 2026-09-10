/* Gli altri comandi di un elettrodomestico (#338).
 *
 * «Sto provando ad integrare l'asciugatrice con hOn. Non ha un'entita'
 * comando, ma da documentazione posso far partire il comando con
 * `service: hon.start_program`, `data: {program: rapid_30}`, `target:
 * {device_id: ...}`. Come posso integrare questo nella sezione
 * dell'asciugatrice?»
 *
 * Un apparecchio sapeva premere solo entita': interruttori, menu, numeri,
 * tasti. Una chiamata di servizio con i suoi parametri non e' nessuna di
 * quelle — ma avvolta in uno script diventa `script.asciugatrice_rapido_30`,
 * che lo e'. Il robot aveva gia' questo campo (#306) e le regole restano le
 * sue: qui si prova che l'elettrodomestico le usa, e che le usa dove serve.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  comandiDelDispositivo,
  comandoDelDispositivo,
  elencoComandi,
  genereDelComando,
} from "../src/core/comandi-accanto.js";

const leggi = (percorso) => readFile(new URL(`../src/${percorso}`, import.meta.url), "utf8");

test("uno script e' un comando valido per un elettrodomestico, e si accende", () => {
  /* E' la strada che l'asciugatrice prende: `hon.start_program` con il suo
   * programma non e' un'entita', uno script che la chiama si'. */
  assert.equal(genereDelComando("script.asciugatrice_rapido_30"), "tasto");
  assert.deepEqual(comandoDelDispositivo({ entity: "script.asciugatrice_rapido_30" }), {
    domain: "script",
    service: "turn_on",
    data: { entity_id: "script.asciugatrice_rapido_30" },
  });
  /* E gli altri domini che la scheda accetta fanno quello che promettono. */
  assert.equal(
    comandoDelDispositivo({ entity: "button.asciugatrice_avvio" }).service,
    "press",
    "un tasto si preme",
  );
  assert.equal(
    comandoDelDispositivo({ entity: "switch.asciugatrice_eco" }).service,
    "toggle",
    "un interruttore si inverte",
  );
  assert.deepEqual(comandoDelDispositivo({ entity: "select.asciugatrice_programma" }, "Rapido"), {
    domain: "select",
    service: "select_option",
    data: { entity_id: "select.asciugatrice_programma", option: "Rapido" },
  });
  /* Un sensore non e' un comando: non entra nell'elenco e non si preme. */
  assert.equal(genereDelComando("sensor.asciugatrice_umidita"), "");
  assert.equal(comandoDelDispositivo({ entity: "sensor.asciugatrice_umidita" }), null);
});

test("l'elenco di un elettrodomestico si legge come quello del robot", () => {
  const scelti = elencoComandi("script.rapido_30, button.avvio ,sensor.umidita,script.rapido_30");
  assert.deepEqual(scelti, ["script.rapido_30", "button.avvio"]);
  /* E la vista che la finestra disegna porta nome, genere e disponibilita'. */
  const vista = comandiDelDispositivo(
    { entity: "switch.asciugatrice", comandi: scelti },
    {
      "switch.asciugatrice": { state: "on", attributes: { friendly_name: "Asciugatrice" } },
      "script.rapido_30": {
        state: "off",
        attributes: { friendly_name: "Asciugatrice Rapido 30" },
      },
    },
  );
  assert.equal(vista.length, 2);
  /* Il nome dell'apparecchio non si ripete: la finestra ce l'ha gia' in testa. */
  assert.equal(vista[0].name, "Rapido 30");
  assert.equal(vista[0].genere, "tasto");
  assert.equal(vista[0].available, true);
  /* Un comando che Home Assistant non conosce non e' raggiungibile, e il tasto
   * lo dice invece di far finta. */
  assert.equal(vista[1].available, false);
});

test("la scheda dell'elettrodomestico ha il campo «Altri comandi» (#338)", async () => {
  const editor = await leggi("sections/appliance-editor-section.js");
  /* Le regole dei comandi sono una sola copia per tutti: stavano nel modello
   * del robot perche' li' e' arrivata la domanda per prima, adesso stanno in
   * un modulo loro che robot, elettrodomestici e lettori vedono uguale. Un
   * elenco solo, non tre. */
  assert.match(editor, /from "\.\.\/core\/comandi-accanto\.js"/);
  assert.match(editor, /comandiVicini/);
  /* Il campo: pastiglie, il «＋», e le proposte. La lente non la disegna
   * questa scheda: il campo dichiara di volere un'entita' col suo placeholder,
   * e la pastiglia «Scegli entità» di casa gliela mette addosso — una seconda
   * lente accanto sarebbero due modi di fare la stessa cosa. */
  assert.match(editor, /data-appl-comandi\b/);
  assert.match(editor, /t\("Altri comandi", "Other commands"\)/);
  assert.match(editor, /placeholder="script\.asciugatrice_rapido_30"/);
  assert.doesNotMatch(editor, /data-appl-cmd-pick/);
  assert.match(editor, /data-appl-cmd-add/);
  assert.match(editor, /data-appl-cmd-sug/);
  assert.match(editor, /data-appl-cmd-del/);
  /* Lo `script.*` e' nell'aiuto, perche' e' la strada che serve a chi ha un
   * servizio con parametri e nessuna entita' comando. */
  assert.match(editor, /hon\.start_program/);
  /* Si salva col tasto in fondo, come il collegamento all'integrazione: un
   * elenco vuoto non e' una configurazione e il campo se ne va. */
  assert.match(editor, /const comandi = elencoComandi\(values\.comandi\);/);
  assert.match(editor, /if \(comandi\.length\) next\.comandi = comandi;/);
  assert.match(editor, /else delete next\.comandi;/);
});

test("la finestra dell'elettrodomestico li disegna, e non li disegna due volte", async () => {
  const popup = await leggi("sections/appliance-detail-popup-section.js");
  /* Stesso vocabolario, stesso verbo. */
  assert.match(popup, /comandiDelDispositivo as comandiScelti/);
  assert.match(popup, /comandoDelDispositivo as servizioDelComando/);
  assert.match(popup, /function aggiungiAltriComandi/);
  assert.match(popup, /t\("Altri comandi", "Other commands"\)/);
  /* Il ponte vuole il bersaglio da una parte e i parametri dall'altra. */
  assert.match(popup, /target: \{ entity_id: bersaglio \}/);
  /* Compaiono accanto ai comandi di sempre: dopo quelli curati e dopo quelli
   * del dispositivo, prima della diagnostica. */
  assert.equal(
    (popup.match(/aggiungiAltriComandi\(lista, appliance, titoletto\);/g) || []).length,
    2,
  );
  /* E un'entita' scelta a mano esce dai comandi del dispositivo: la stessa
   * entita' con due tasti si contraddirebbe da sola. */
  assert.match(popup, /const scelti = new Set\(elencoComandi\(appliance\?\.comandi\)\);/);
  assert.match(popup, /!scelti\.has\(voce\.entity\)/);
});

test("il campo dei comandi non ruba il disegno alle pastiglie della vetrina", async () => {
  /* Le pastiglie della scheda si chiamano `dm-appl-cmd-chip`: `dm-appl-chips`
   * e' gia' della vetrina degli elettrodomestici, e due fogli che decidono lo
   * stesso `gap` sono una regola con due padroni. */
  const editor = await leggi("sections/appliance-editor-section.js");
  assert.match(editor, /\.dm-appl-cmd-chips\{/);
  assert.doesNotMatch(editor, /\.dm-appl-chips\{/);
});
