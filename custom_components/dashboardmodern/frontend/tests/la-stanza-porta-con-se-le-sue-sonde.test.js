/* Le sonde in piu' di una stanza devono arrivare fino a chi le disegna.
 *
 * La scheda Temperature permette da tempo di selezionare la stessa stanza piu'
 * volte, con un nome per ognuna — il comodino, il termostato a muro, la sonda
 * della veranda — e le associazioni oltre la prima vivono in
 * `metadata.temperature_entries`. La proiezione che la pagina Stanze legge
 * teneva solo alcuni campi di primo livello e buttava via `metadata` e
 * `temp_name`: chiedere le associazioni a quella proiezione dava sempre e solo
 * la prima coppia, per quante ne fossero configurate. Correggere chi disegna
 * senza correggere cosa gli arriva non cambia niente sullo schermo — ed e'
 * esattamente quello che era successo.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { roomOverviewModel } from "../src/core/room-overview.js";
import { temperatureEntries } from "../src/sections/beta25-real-device-fixes-section.js";

const STANZE = [
  {
    id: "room-salone",
    name: "Salone",
    temp: "sensor.salone_temperatura",
    hum: "sensor.salone_umidita",
    temp_name: "Termostato a muro",
    metadata: {
      temperature_entries: [
        { id: "e2", name: "Comodino", temp: "sensor.comodino_temperatura", hum: "" },
        { id: "e3", name: "Veranda", temp: "sensor.veranda_temperatura", hum: "sensor.veranda_umidita" },
      ],
    },
  },
];

const salone = () => roomOverviewModel({ rooms: STANZE }).find((p) => p.id === "room-salone");

test("la proiezione della stanza si porta dietro le associazioni e il loro nome", () => {
  const pagina = salone();
  assert.equal(pagina.temp_name, "Termostato a muro");
  assert.equal(pagina.metadata.temperature_entries.length, 2);
});

test("e chi le legge ne trova tre, non una", () => {
  const voci = temperatureEntries(salone());
  assert.equal(voci.length, 3, "la coppia sulla riga della stanza piu' le due associazioni");
  assert.deepEqual(
    voci.map((voce) => voce.temp),
    ["sensor.salone_temperatura", "sensor.comodino_temperatura", "sensor.veranda_temperatura"],
  );
  assert.deepEqual(
    voci.map((voce) => voce.name),
    ["Termostato a muro", "Comodino", "Veranda"],
  );
});

test("una stanza senza associazioni resta com'era", () => {
  const pagine = roomOverviewModel({ rooms: [{ id: "r", name: "Bagno", temp: "sensor.bagno" }] });
  const voci = temperatureEntries(pagine.find((p) => p.id === "r"));
  assert.equal(voci.length, 1);
  assert.equal(voci[0].temp, "sensor.bagno");
});
