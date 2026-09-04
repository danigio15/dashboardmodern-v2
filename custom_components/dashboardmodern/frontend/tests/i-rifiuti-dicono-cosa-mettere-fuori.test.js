/* I rifiuti dicono cosa mettere fuori stasera (#293).
 *
 * «Sarebbe carino anche integrare un sistema per la raccolta differenziata
 * rifiuti.»
 *
 * Le date arrivano nei dialetti delle integrazioni: una data ISO nello stato,
 * un attributo `date`, un `start_time` di calendario, «domani», «in 3 giorni»,
 * un numero di giorni. Queste prove le tengono ferme tutte, e tengono fermo il
 * conto dei giorni sul calendario — non sui millisecondi, che nel giorno in cui
 * cambia l'ora sbagliano di uno.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  CHIAVE_RIFIUTI,
  MASSIMO_RIGHE,
  MATERIALI,
  dataDelRitiro,
  entitaDeiRifiuti,
  giorniFra,
  leggiData,
  letturaRifiuti,
  materialeDalNome,
  materialeDiSerie,
  normalizzaRifiuti,
  quandoCodice,
  rifiutiConfigurati,
} from "../src/core/rifiuti-model.js";
import { haOggettoWidget } from "../src/core/oggetti-widget.js";
import { bricioleDellaSezione, fraseDellaTessera } from "../src/core/racconto-tessera.js";

const leggi = (percorso) => readFile(new URL(`../src/${percorso}`, import.meta.url), "utf8");
const EN = (_it, en) => en;
/* Una sera fissa, costruita nel fuso di chi esegue la prova: le date dei
 * ritiri sono giorni di calendario, non istanti. */
const ADESSO = new Date(2026, 8, 3, 22, 30).getTime();

test("i materiali hanno un colore e un simbolo, e si indovinano dal nome", () => {
  assert.equal(materialeDiSerie("vetro").colore, "#22c55e");
  assert.equal(materialeDiSerie("boh").chiave, "altro");
  assert.equal(materialeDalNome("Raccolta plastica e lattine"), "plastica");
  assert.equal(materialeDalNome("Carta e cartone"), "carta");
  assert.equal(materialeDalNome("Umido"), "organico");
  assert.equal(materialeDalNome("Secco residuo"), "indifferenziato");
  assert.equal(materialeDalNome("Glass"), "vetro");
  assert.equal(materialeDalNome(""), "altro");
  assert.ok(MATERIALI.length >= 8);
});

test("la configurazione: le righe con la loro entita', e le vuote se ne vanno", () => {
  const dato = normalizzaRifiuti({
    righe: [
      { materiale: "plastica", entity: " sensor.plastica " },
      { materiale: "carta", nome: "Cartone" },
      {},
      null,
    ],
    calendario: "calendar.rifiuti",
  });
  assert.equal(dato.righe.length, 2);
  assert.equal(dato.righe[0].entity, "sensor.plastica");
  assert.equal(dato.righe[0].icona, "🧴");
  assert.equal(dato.righe[1].nome, "Cartone");
  assert.deepEqual(entitaDeiRifiuti(dato), ["sensor.plastica", "calendar.rifiuti"]);
  assert.equal(rifiutiConfigurati(dato), true);
  assert.equal(rifiutiConfigurati({ righe: [{ materiale: "carta" }] }), false);
  assert.equal(rifiutiConfigurati({ calendario: "calendar.rifiuti" }), true);
  assert.equal(
    normalizzaRifiuti({ righe: Array(20).fill({ materiale: "vetro" }) }).righe.length,
    MASSIMO_RIGHE,
  );
  assert.equal(CHIAVE_RIFIUTI, "cd_rifiuti");
});

test("le date, nei dialetti in cui le scrivono", () => {
  assert.equal(leggiData("2026-09-05").getDate(), 5);
  assert.equal(leggiData("2026-09-05 06:00:00").getHours(), 6);
  assert.equal(leggiData("05/09/2026").getMonth(), 8);
  assert.equal(leggiData("2026-09-05T06:00:00+02:00") instanceof Date, true);
  assert.equal(leggiData("3"), null, "un numero non e' una data");
  assert.equal(leggiData("domani"), null);
  assert.equal(leggiData(""), null);

  const giorni = (stato) => giorniFra(ADESSO, dataDelRitiro(stato, ADESSO));
  /* Lo stato: una data, una parola, un conto. */
  assert.equal(giorni({ state: "2026-09-04" }), 1);
  assert.equal(giorni({ state: "domani" }), 1);
  assert.equal(giorni({ state: "Tomorrow" }), 1);
  assert.equal(giorni({ state: "oggi" }), 0);
  assert.equal(giorni({ state: "in 3 giorni" }), 3);
  assert.equal(giorni({ state: "in 2 days" }), 2);
  assert.equal(giorni({ state: "4", attributes: { unit_of_measurement: "d" } }), 4);
  assert.equal(
    dataDelRitiro({ state: "4" }, ADESSO),
    null,
    "senza unita' un numero non dice niente",
  );
  /* Gli attributi vincono sullo stato, che spesso e' una frase. */
  assert.equal(giorni({ state: "Plastica", attributes: { date: "2026-09-06" } }), 3);
  assert.equal(giorni({ state: "Plastica", attributes: { daysTo: 2 } }), 2);
  /* Il calendario: `start_time` del prossimo evento. */
  assert.equal(
    giorni({ state: "off", attributes: { start_time: "2026-09-05 00:00:00", message: "Vetro" } }),
    2,
  );
  assert.equal(dataDelRitiro(null, ADESSO), null);
});

test("i giorni si contano sul calendario: alle undici di sera domani e' domani", () => {
  /* Un ritiro alle sei del mattino di domani dista sette ore e mezza, non
   * ventiquattro: e' «domani» lo stesso. */
  assert.equal(giorniFra(ADESSO, new Date(2026, 8, 4, 6, 0)), 1);
  assert.equal(giorniFra(ADESSO, new Date(2026, 8, 3, 6, 0)), 0);
  assert.equal(giorniFra(ADESSO, new Date(2026, 8, 2, 23, 59)), -1);
  assert.equal(quandoCodice(0), "oggi");
  assert.equal(quandoCodice(1), "domani");
  assert.equal(quandoCodice(2), "dopodomani");
  assert.equal(quandoCodice(5), "giorni");
  assert.equal(quandoCodice(7), "settimana");
  assert.equal(quandoCodice(-1), "passato");
  assert.equal(quandoCodice(null), "mai");
});

test("la lettura: chi viene prima sta prima, e chi esce insieme esce insieme", () => {
  const config = {
    righe: [
      { materiale: "vetro", entity: "sensor.vetro" },
      { materiale: "plastica", entity: "sensor.plastica" },
      { materiale: "carta", entity: "sensor.carta" },
      { materiale: "organico", entity: "sensor.organico" },
    ],
    calendario: "calendar.rifiuti",
  };
  const states = {
    "sensor.vetro": { state: "2026-09-10" },
    "sensor.plastica": { state: "2026-09-04" },
    "sensor.carta": { state: "Domani" },
    "sensor.organico": { state: "unknown" },
    "calendar.rifiuti": {
      state: "off",
      attributes: { message: "Raccolta metalli", start_time: "2026-09-05 00:00:00" },
    },
  };
  const lettura = letturaRifiuti(config, states, (v) => v, ADESSO);
  assert.deepEqual(
    lettura.righe.map((riga) => [riga.materiale, riga.giorni, riga.quando]),
    [
      ["plastica", 1, "domani"],
      ["carta", 1, "domani"],
      ["vetro", 7, "settimana"],
      ["organico", null, "mai"],
    ],
  );
  assert.deepEqual(
    lettura.prossimi.map((riga) => riga.materiale),
    ["plastica", "carta"],
  );
  assert.deepEqual(
    lettura.domani.map((riga) => riga.materiale),
    ["plastica", "carta"],
  );
  assert.deepEqual(lettura.oggi, []);
  assert.equal(lettura.calendario.nome, "Raccolta metalli");
  assert.equal(lettura.calendario.materiale, "metalli");
  assert.equal(lettura.calendario.giorni, 2);
  /* Un'entita' che non c'e' e' muta, non una data mancante. */
  const muta = letturaRifiuti(
    { righe: [{ materiale: "vetro", entity: "sensor.x" }] },
    {},
    (v) => v,
    ADESSO,
  );
  assert.equal(muta.righe[0].muto, true);
  assert.deepEqual(muta.prossimi, []);
});

test("la pagina, la scheda e la tessera sono presentate a tutti i posti che le contano", async () => {
  const sezione = await leggi("sections/rifiuti-section.js");
  const editor = await leggi("sections/rifiuti-editor-section.js");
  assert.match(sezione, /sezioni\[RIFIUTI_TAB\] === false/);
  assert.match(editor, /cdSecToggleHtml\?\.\("rifiuti"\)/);
  /* Accanto all'Agenda: un ritiro e' un impegno con una data. */
  assert.match(sezione, /\.tab\[data-tab="calendario"\]/);
  const runtime = await leggi("sections/section-runtime.js");
  assert.match(runtime, /installRifiuti\(\);/);
  assert.match(runtime, /installRifiutiEditor\(\);/);
  assert.match(await leggi("sections/page-masthead-section.js"), /id: "page-rifiuti"/);
  assert.match(await leggi("sections/navigation-section.js"), /rifiuti: "rifiuti",/);
  assert.match(await leggi("sections/config-uniformity-section.js"), /rifiuti: "rifiuti",/);
  assert.match(await leggi("sections/todo-editor-section.js"), /\["rifiuti", "♻️"/);
  assert.match(await leggi("sections/home-widgets-section.js"), /key: "rifiuti",/);
  assert.match(await leggi("sections/config-persistence-section.js"), /"cd_rifiuti"/);
  assert.equal(haOggettoWidget("rifiuti"), true);
  assert.deepEqual(bricioleDellaSezione("rifiuti", EN), [
    "Materials",
    "Next collection",
    "Calendar",
  ]);
});

test("la frase della tessera e' la risposta alla domanda della sera", () => {
  assert.equal(
    fraseDellaTessera(
      { key: "rifiuti", prossimi: [{ name: "Plastic", quando: "domani" }], value: "Tomorrow" },
      EN,
    ),
    "Tomorrow they collect Plastic: it goes out tonight.",
  );
  assert.equal(
    fraseDellaTessera(
      {
        key: "rifiuti",
        prossimi: [
          { name: "Glass", quando: "oggi" },
          { name: "Paper", quando: "oggi" },
        ],
        value: "Today",
      },
      EN,
    ),
    "Today they collect Glass, Paper.",
  );
  assert.equal(
    fraseDellaTessera(
      {
        key: "rifiuti",
        prossimi: [{ name: "Glass", quando: "settimana" }],
        value: "Thursday 10 Sep",
      },
      EN,
    ),
    "Next collection Thursday 10 Sep: Glass.",
  );
  assert.equal(fraseDellaTessera({ key: "rifiuti", prossimi: [] }, EN), "No collection in sight.");
});

/* Il ritiro di oggi diceva un trattino (#309).
 *
 * «Ho un calendario con i giorni configurati per ogni rifiuto; mi aspettavo
 * di vedere il rifiuto di oggi "Umido" ma vedo un trattino.»
 *
 * Un evento di tutto il giorno non e' un istante: e' una casella sul
 * calendario, e il fuso che Home Assistant gli scrive accanto —
 * `2026-09-04T00:00:00+02:00` — non la sposta. Si leggeva come un istante, e
 * chi guardava da un fuso piu' indietro se lo vedeva scivolare al giorno
 * prima: il ritiro di oggi finiva fra quelli passati, il conto lo scartava
 * perche' tiene solo i giorni da zero in su, e la tessera restava con un
 * trattino proprio il giorno in cui il bidone andava messo fuori.
 */
const ORE_DIECI = new Date(2026, 8, 4, 10, 0, 0).getTime();
const calendarioDi = (attributi, state = "on") => ({
  "calendar.rifiuti": { state, attributes: { message: "Umido", ...attributi } },
});
const soloCalendario = { calendario: "calendar.rifiuti", righe: [] };

test("un evento di tutto il giorno col fuso resta il giorno che dice", () => {
  const data = dataDelRitiro(
    { state: "on", attributes: { all_day: true, start_time: "2026-09-04T00:00:00+02:00" } },
    ORE_DIECI,
  );
  assert.equal(giorniFra(ORE_DIECI, data), 0);
});

test("il ritiro di oggi non e' un trattino: esce come oggi", () => {
  for (const [nome, attributi] of [
    [
      "mezzanotte col fuso",
      {
        all_day: true,
        start_time: "2026-09-04T00:00:00+02:00",
        end_time: "2026-09-05T00:00:00+02:00",
      },
    ],
    [
      "mezzanotte senza fuso",
      { all_day: true, start_time: "2026-09-04 00:00:00", end_time: "2026-09-05 00:00:00" },
    ],
    ["solo la data", { all_day: true, start_time: "2026-09-04" }],
    ["in Z", { all_day: true, start_time: "2026-09-04T00:00:00Z" }],
  ]) {
    const lettura = letturaRifiuti(soloCalendario, calendarioDi(attributi), (v) => v, ORE_DIECI);
    assert.equal(lettura.calendario.quando, "oggi", nome);
    assert.equal(lettura.oggi.length, 1, nome);
    assert.equal(lettura.prossimi.length, 1, nome);
  }
});

test("un ritiro cominciato ieri e non ancora finito e' di adesso, non del passato", () => {
  /* Un evento scritto a mano puo' durare da ieri sera a domani mattina: il
   * suo avvio e' nel passato, ma il bidone e' fuori adesso. */
  const lettura = letturaRifiuti(
    soloCalendario,
    calendarioDi({ start_time: "2026-09-03 20:00:00", end_time: "2026-09-05 08:00:00" }),
    (v) => v,
    ORE_DIECI,
  );
  assert.equal(lettura.calendario.quando, "oggi");
  assert.equal(lettura.prossimi.length, 1);
});

test("un evento a orario gia' finito oggi resta di oggi, e domani resta domani", () => {
  const finito = letturaRifiuti(
    soloCalendario,
    calendarioDi({ start_time: "2026-09-04 06:00:00", end_time: "2026-09-04 07:00:00" }, "off"),
    (v) => v,
    ORE_DIECI,
  );
  assert.equal(finito.calendario.quando, "oggi");
  const domani = letturaRifiuti(
    soloCalendario,
    calendarioDi({ all_day: true, start_time: "2026-09-05T00:00:00+02:00" }, "off"),
    (v) => v,
    ORE_DIECI,
  );
  assert.equal(domani.calendario.quando, "domani");
});

test("un istante vero conserva il suo fuso: solo il giorno intero lo ignora", () => {
  /* La correzione non deve diventare «i fusi non contano»: un ritiro alle
   * 23:30 di un fuso avanti puo' essere davvero il giorno dopo per chi
   * guarda, e quella lettura resta com'era. */
  const conOra = leggiData("2026-09-04T23:30:00+02:00");
  assert.equal(conOra.getTime(), new Date("2026-09-04T23:30:00+02:00").getTime());
  const giornoIntero = leggiData("2026-09-04T00:00:00+02:00", { giornoIntero: true });
  assert.equal(giornoIntero.getFullYear(), 2026);
  assert.equal(giornoIntero.getMonth(), 8);
  assert.equal(giornoIntero.getDate(), 4);
});
