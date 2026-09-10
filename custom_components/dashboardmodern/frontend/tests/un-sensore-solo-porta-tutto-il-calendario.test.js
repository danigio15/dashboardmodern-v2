/* «Molte integrazioni non forniscono un calendario vero e proprio ma dei
 *  sensori sensor.xxx. Sarebbe bello poterli usare» (#443).
 *
 * Un sensore PER MATERIALE la plancia lo legge da sempre: è la riga, con la
 * sua data. Quello che mancava è l'altro modo, che in Italia è il più
 * diffuso: UN sensore che porta l'intero elenco dei prossimi ritiri negli
 * attributi — il `sensor.savno_conegliano_prossimi_ritiri` della segnalazione
 * — dove ogni voce ha una data e il nome della frazione.
 *
 * Un dialetto solo non c'è: chi scrive queste integrazioni mette un elenco di
 * oggetti, o un elenco di frasi, o una mappa frazione → data. Qui si provano
 * tutte e tre, e si prova soprattutto quello che NON deve succedere: una voce
 * senza data non diventa una riga muta, e un elenco che non dice niente lascia
 * il campo al modo di prima invece di cancellarlo.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { letturaRifiuti, ritiriDaUnElenco } from "../src/core/rifiuti-model.js";

const ADESSO = Date.parse("2026-09-08T18:00:00Z");
const giorno = (quanti) => new Date(ADESSO + quanti * 86400000).toISOString().slice(0, 10);
const materiali = (righe) => righe.map((riga) => riga.materiale);

test("un elenco di oggetti: ogni voce ha la sua data e la sua frazione", () => {
  const righe = ritiriDaUnElenco(
    {
      state: giorno(1),
      attributes: {
        prossimi_ritiri: [
          { data: giorno(2), tipo: "Carta e cartone" },
          { data: giorno(1), tipo: "Plastica e lattine" },
          { data: giorno(4), tipo: "Secco residuo" },
        ],
      },
    },
    ADESSO,
  );
  assert.deepEqual(materiali(righe), ["plastica", "carta", "indifferenziato"]);
  assert.deepEqual(
    righe.map((riga) => riga.giorni),
    [1, 2, 4],
  );
  /* Il nome dell'integrazione non si ripete quando dice quello che dice già il
   * materiale: la riga ha il suo nome di casa. */
  assert.equal(righe[0].nome, "");
});

test("un elenco di frasi, con la data scritta dentro", () => {
  const righe = ritiriDaUnElenco(
    {
      state: "ok",
      attributes: { upcoming: [`${giorno(3)} Vetro`, `Organico ${giorno(1)}`] },
    },
    ADESSO,
  );
  assert.deepEqual(materiali(righe), ["organico", "vetro"]);
});

test("una mappa frazione → data", () => {
  const righe = ritiriDaUnElenco(
    { state: "ok", attributes: { raccolte: { plastica: giorno(5), umido: giorno(0) } } },
    ADESSO,
  );
  assert.deepEqual(materiali(righe), ["organico", "plastica"]);
  assert.equal(righe[0].quando, "oggi");
});

test("i ritiri già passati restano fuori, e di ogni materiale si tiene il primo", () => {
  const righe = ritiriDaUnElenco(
    {
      state: "ok",
      attributes: {
        prossimi_ritiri: [
          { date: giorno(-3), type: "Plastica" },
          { date: giorno(2), type: "Plastica" },
          { date: giorno(9), type: "Plastica" },
        ],
      },
    },
    ADESSO,
  );
  assert.deepEqual(materiali(righe), ["plastica"]);
  assert.equal(righe[0].giorni, 2);
});

test("una voce senza data sparisce: non diventa una riga muta", () => {
  const righe = ritiriDaUnElenco(
    {
      state: "ok",
      attributes: {
        prossimi_ritiri: [{ tipo: "Plastica" }, { data: giorno(1), tipo: "Carta" }],
      },
    },
    ADESSO,
  );
  assert.deepEqual(materiali(righe), ["carta"]);
});

test("niente attributi, niente elenco: nessuna riga inventata", () => {
  assert.deepEqual(ritiriDaUnElenco(null, ADESSO), []);
  assert.deepEqual(ritiriDaUnElenco({ state: giorno(1) }, ADESSO), []);
  assert.deepEqual(
    ritiriDaUnElenco({ state: "ok", attributes: { icon: "mdi:trash" } }, ADESSO),
    [],
  );
});

test("nella lettura le voci dell'elenco diventano righe come le altre", () => {
  const lettura = letturaRifiuti(
    { calendario: "sensor.savno_prossimi_ritiri" },
    {
      "sensor.savno_prossimi_ritiri": {
        state: giorno(1),
        attributes: {
          prossimi_ritiri: [
            { data: giorno(1), tipo: "Plastica" },
            { data: giorno(3), tipo: "Vetro" },
          ],
        },
      },
    },
    (v) => v,
    ADESSO,
  );
  assert.deepEqual(materiali(lettura.righe), ["plastica", "vetro"]);
  assert.deepEqual(materiali(lettura.domani), ["plastica"]);
  /* E la riga unica del «Calendario dei ritiri» non si aggiunge sopra: direbbe
   * una seconda volta la prima delle righe. */
  assert.equal(lettura.calendario, null);
});

test("un sensore che dice una data sola continua a leggersi come prima", () => {
  /* La correzione non toglie niente a chi funzionava: un `calendar.*` con il
   * suo `start_time`, o un sensore la cui data sta nello stato, restano la
   * riga unica di sempre. */
  const lettura = letturaRifiuti(
    { calendario: "calendar.rifiuti" },
    {
      "calendar.rifiuti": {
        state: "off",
        attributes: { start_time: `${giorno(2)} 06:00:00`, message: "Raccolta carta" },
      },
    },
    (v) => v,
    ADESSO,
  );
  assert.ok(lettura.calendario, "la riga del calendario c'è ancora");
  assert.equal(lettura.calendario.materiale, "carta");
  assert.equal(lettura.calendario.giorni, 2);
});

test("un materiale che ha già il suo sensore non si ripete dall'elenco", () => {
  const lettura = letturaRifiuti(
    {
      calendario: "sensor.elenco",
      righe: [{ materiale: "plastica", entity: "sensor.plastica" }],
    },
    {
      "sensor.plastica": { state: giorno(6) },
      "sensor.elenco": {
        state: "ok",
        attributes: {
          prossimi_ritiri: [
            { data: giorno(1), tipo: "Plastica" },
            { data: giorno(2), tipo: "Carta" },
          ],
        },
      },
    },
    (v) => v,
    ADESSO,
  );
  const plastiche = lettura.righe.filter((riga) => riga.materiale === "plastica");
  assert.equal(plastiche.length, 1);
  assert.equal(plastiche[0].entity, "sensor.plastica");
  assert.equal(plastiche[0].giorni, 6);
});

/* Il materiale dedotto conta come materiale, anche per l'esclusione.
 *
 * Chi configura un sensore per materiale ma non sceglie QUALE materiale lascia
 * «altro», e il materiale vero lo dice il sensore: Waste Collection Schedule
 * scrive `types`, altri `waste_type`, altri ancora solo il nome amichevole.
 * Quella traduzione la faceva soltanto il disegno delle righe; l'elenco delle
 * esclusioni, che decide se il calendario può portare la SUA plastica, restava
 * fermo su «altro».
 *
 * Risultato: due righe dello stesso bidone — una dal sensore, una dal
 * calendario — con due date diverse. Che è precisamente la cosa che
 * l'esclusione esiste per impedire.
 */
test("un sensore col materiale dedotto zittisce il calendario su quel materiale", () => {
  const lettura = letturaRifiuti(
    {
      calendario: "sensor.savno_prossimi_ritiri",
      righe: [{ entity: "sensor.raccolta_plastica", materiale: "altro" }],
    },
    {
      /* Il sensore non dice «plastica» nella configurazione: lo dice da sé. */
      "sensor.raccolta_plastica": {
        state: giorno(4),
        attributes: { friendly_name: "Raccolta plastica", waste_type: "Plastica" },
      },
      "sensor.savno_prossimi_ritiri": {
        state: giorno(1),
        attributes: {
          prossimi_ritiri: [
            { data: giorno(1), tipo: "Plastica" },
            { data: giorno(3), tipo: "Vetro" },
          ],
        },
      },
    },
    (v) => v,
    ADESSO,
  );
  const plastiche = lettura.righe.filter((riga) => riga.materiale === "plastica");
  assert.equal(
    plastiche.length,
    1,
    "due plastiche con due date diverse: l'esclusione ha guardato «altro» invece del materiale vero",
  );
  /* E quella che resta è quella del sensore, che sa la data vera. */
  assert.equal(plastiche[0].entity, "sensor.raccolta_plastica");
  /* Il vetro invece il sensore non ce l'ha, e il calendario lo porta. */
  assert.ok(materiali(lettura.righe).includes("vetro"));
});
