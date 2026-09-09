/* La presenza: dove c'è qualcuno adesso, e da quanto (#432).
 *
 * «Ci vorrebbe una sezione con i sensori presenza o movimento.»
 *
 * Le prove stanno sul nucleo, che è puro: quali entità sono rilevatori di
 * questa casa, come stanno, da quanto, e il conto che va in cima. Le parole e
 * il disegno li prova la sezione, più sotto, leggendo il proprio sorgente —
 * perché quello che questa richiesta chiede di non sbagliare è l'ordine delle
 * righe e la differenza fra un movimento e una presenza, non il markup.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  CHIAVE_PRESENZA,
  CLASSI_DELLA_PRESENZA,
  comeStaIlRilevatore,
  contoDellaPresenza,
  disegnoDelRilevatore,
  eUnRilevatore,
  eUnRilevatoreDiCasa,
  eUnaPresenzaStabile,
  istanteDelCambio,
  normalizzaPresenza,
  presenzaConfigurata,
  presenzaDiCasa,
  ultimoMovimento,
} from "../src/core/presenza-in-casa.js";

const leggi = (rel) => readFile(new URL(rel, import.meta.url), "utf8");

const rilevatore = (stato, classe = "motion", quando = "2026-09-09T10:00:00Z", nome = "") => ({
  state: stato,
  last_changed: quando,
  attributes: { device_class: classe, ...(nome ? { friendly_name: nome } : {}) },
});

test("un rilevatore lo dichiara Home Assistant, e vibrazione non è presenza", () => {
  assert.ok(eUnRilevatore("binary_sensor.salone", rilevatore("on", "motion")));
  assert.ok(eUnRilevatore("binary_sensor.salone", rilevatore("off", "occupancy")));
  assert.ok(eUnRilevatore("binary_sensor.radar", rilevatore("on", "moving")));
  /* Una lavatrice che vibra non è qualcuno che passa. */
  assert.equal(eUnRilevatore("binary_sensor.lavatrice", rilevatore("on", "vibration")), false);
  assert.equal(eUnRilevatore("binary_sensor.porta", rilevatore("on", "door")), false);
  /* Un `sensor.` con la classe giusta non è un rilevatore: la presenza è
   * acceso/spento, e un numero non lo è. */
  assert.equal(eUnRilevatore("sensor.movimento", rilevatore("on", "motion")), false);
  assert.deepEqual([...CLASSI_DELLA_PRESENZA], ["motion", "occupancy", "presence", "moving"]);
});

test("movimento e presenza non dicono la stessa cosa", () => {
  assert.equal(eUnaPresenzaStabile("occupancy"), true);
  assert.equal(eUnaPresenzaStabile("presence"), true);
  assert.equal(eUnaPresenzaStabile("motion"), false);
  assert.equal(eUnaPresenzaStabile("moving"), false);
  assert.equal(disegnoDelRilevatore("occupancy"), "🧍");
  assert.equal(disegnoDelRilevatore("motion"), "🏃");
  /* Una classe che non si conosce prende comunque un disegno: una riga senza
   * icona sarebbe più brutta di una icona approssimata. */
  assert.equal(disegnoDelRilevatore("boh"), "🏃");
});

test("la configurazione si ripulisce, e le tre correzioni valgono", () => {
  const scelte = normalizzaPresenza({
    escluse: ["binary_sensor.cortile", "binary_sensor.cortile", "spazzatura", 7],
    aggiunte: ["  binary_sensor.fatto_in_casa  "],
    nomi: { "binary_sensor.salone": "  Salone  ", "binary_sensor.x": "  ", niente: "Boh" },
  });
  assert.deepEqual(scelte.escluse, ["binary_sensor.cortile"]);
  assert.deepEqual(scelte.aggiunte, ["binary_sensor.fatto_in_casa"]);
  assert.deepEqual(scelte.nomi, { "binary_sensor.salone": "Salone" });
  assert.equal(CHIAVE_PRESENZA, "cd_presenza");

  /* Uno escluso non è un rilevatore per questa plancia... */
  assert.equal(
    eUnRilevatoreDiCasa("binary_sensor.cortile", rilevatore("on", "motion"), scelte),
    false,
  );
  /* ...e uno aggiunto lo è anche se Home Assistant non lo dichiara. */
  assert.equal(
    eUnRilevatoreDiCasa("binary_sensor.fatto_in_casa", { state: "on", attributes: {} }, scelte),
    true,
  );
  /* La configurazione vuota non toglie niente: chi ha un rilevatore se lo
   * ritrova senza configurare nulla. */
  assert.equal(eUnRilevatoreDiCasa("binary_sensor.salone", rilevatore("on"), {}), true);
});

test("un rilevatore muto non è una stanza vuota", () => {
  assert.equal(comeStaIlRilevatore(rilevatore("on")), "attivo");
  assert.equal(comeStaIlRilevatore(rilevatore("off")), "libero");
  assert.equal(comeStaIlRilevatore(rilevatore("unavailable")), "");
  assert.equal(comeStaIlRilevatore(rilevatore("unknown")), "");
  assert.equal(comeStaIlRilevatore(null), "");
  /* `last_changed` e non `last_updated`: il secondo si muove anche quando
   * cambia solo un attributo, e direbbe «libera da un minuto» di una stanza
   * vuota da ieri. */
  assert.equal(
    istanteDelCambio({ last_changed: "2026-09-09T10:00:00Z", last_updated: "2026-09-09T12:00:00Z" }),
    Date.parse("2026-09-09T10:00:00Z"),
  );
  assert.equal(istanteDelCambio({ last_changed: "boh" }), null);
  assert.equal(istanteDelCambio(null), null);
});

test("le righe stanno in ordine: prima chi rileva qualcuno, in fondo la quiete", () => {
  const states = {
    "binary_sensor.zeta": rilevatore("off", "motion", "2026-09-09T09:00:00Z"),
    "binary_sensor.alfa": rilevatore("off", "motion", "2026-09-09T09:30:00Z"),
    "binary_sensor.muto": rilevatore("unavailable", "motion", "2026-09-09T08:00:00Z"),
    "binary_sensor.salone": rilevatore("on", "occupancy", "2026-09-09T10:00:00Z"),
    "light.non_centra": { state: "on", attributes: {} },
  };
  const righe = presenzaDiCasa(states, {}, (entity) => entity.split(".")[1]);
  assert.deepEqual(
    righe.map((riga) => [riga.name, riga.stato]),
    [
      ["salone", "attivo"],
      ["muto", ""],
      ["alfa", "libero"],
      ["zeta", "libero"],
    ],
  );
  assert.equal(righe[0].stabile, true);
  assert.equal(righe[0].glifo, "🧍");
  assert.equal(righe[3].stabile, false);
});

test("il nome scelto batte quello dell'integrazione", () => {
  const states = { "binary_sensor.motion_3c": rilevatore("on", "motion") };
  const righe = presenzaDiCasa(states, { nomi: { "binary_sensor.motion_3c": "Corridoio" } }, () => "Motion 3C");
  assert.equal(righe[0].name, "Corridoio");
  /* Senza un nome scelto resta quello di Home Assistant, e senza nemmeno
   * quello l'identificativo: una riga senza titolo non si legge. */
  assert.equal(presenzaDiCasa(states, {}, () => "Motion 3C")[0].name, "Motion 3C");
  assert.equal(presenzaDiCasa(states, {}, () => "")[0].name, "binary_sensor.motion_3c");
});

test("il conto non conta libero chi non risponde", () => {
  const righe = presenzaDiCasa(
    {
      "binary_sensor.salone": rilevatore("on", "occupancy", "2026-09-09T10:00:00Z"),
      "binary_sensor.cucina": rilevatore("on", "motion", "2026-09-09T10:30:00Z"),
      "binary_sensor.bagno": rilevatore("off", "motion", "2026-09-09T09:00:00Z"),
      "binary_sensor.garage": rilevatore("unavailable", "motion", "2026-09-09T08:00:00Z"),
    },
    {},
    (entity) => entity.split(".")[1],
  );
  const conto = contoDellaPresenza(righe);
  assert.equal(conto.attivi, 2);
  assert.equal(conto.liberi, 1);
  assert.equal(conto.muti, 1);
  assert.equal(conto.totale, 4);
  /* Contare il muto fra i liberi sarebbe una bugia tranquillizzante: 2+1 non
   * fa 4, ed è giusto che non lo faccia. */
  assert.notEqual(conto.attivi + conto.liberi, conto.totale);
  assert.deepEqual(conto.nomi, ["cucina", "salone"]);
  assert.deepEqual(contoDellaPresenza([]), {
    attivi: 0,
    liberi: 0,
    muti: 0,
    totale: 0,
    nomi: [],
  });
});

test("a casa libera la notizia è l'ultima volta che c'è stato qualcuno", () => {
  const righe = [
    { stato: "libero", da: Date.parse("2026-09-09T09:00:00Z") },
    { stato: "libero", da: Date.parse("2026-09-09T10:30:00Z") },
    { stato: "libero", da: null },
  ];
  assert.equal(ultimoMovimento(righe), Date.parse("2026-09-09T10:30:00Z"));
  /* Nessuna storia, nessuna scritta: inventare «da poco» sarebbe una bugia. */
  assert.equal(ultimoMovimento([{ stato: "libero", da: null }]), null);
  assert.equal(ultimoMovimento([]), null);
});

test("un rilevatore che va giù non è un movimento", () => {
  /* Passare a `unavailable` è un cambio di stato, e il suo `last_changed` è
   * adesso. Contandolo, una casa in cui l'unica cosa successa era un sensore
   * andato giù leggeva «Ultimo movimento · appena adesso»: la notizia più
   * tranquillizzante possibile, detta proprio quando la sorveglianza manca. */
  const righe = [
    { stato: "libero", da: Date.parse("2026-09-09T07:00:00Z") },
    { stato: "", da: Date.parse("2026-09-09T11:59:00Z") },
  ];
  assert.equal(ultimoMovimento(righe), Date.parse("2026-09-09T07:00:00Z"));
  /* E chi si sta muovendo adesso conta: il suo cambio è un movimento vero. */
  assert.equal(
    ultimoMovimento([{ stato: "attivo", da: Date.parse("2026-09-09T12:00:00Z") }]),
    Date.parse("2026-09-09T12:00:00Z"),
  );
  /* Con i soli muti non c'è niente da dire. */
  assert.equal(ultimoMovimento([{ stato: "", da: Date.parse("2026-09-09T11:59:00Z") }]), null);
});

test("la voce compare solo con qualcosa da mostrare", () => {
  assert.equal(presenzaConfigurata({}, {}), false);
  assert.equal(presenzaConfigurata({ "light.salone": { state: "on", attributes: {} } }, {}), false);
  assert.equal(presenzaConfigurata({ "binary_sensor.x": rilevatore("on") }, {}), true);
  /* L'unico rilevatore escluso spegne la sezione: una pagina vuota che
   * compare comunque è peggio di una voce che non c'è. */
  assert.equal(
    presenzaConfigurata({ "binary_sensor.x": rilevatore("on") }, { escluse: ["binary_sensor.x"] }),
    false,
  );
});

test("la pagina è fatta con lo stesso impianto dei Varchi", async () => {
  const presenza = await leggi("../src/sections/presenza-section.js");
  const varchi = await leggi("../src/sections/varchi-section.js");
  /* «Le sezioni devono essere tutte strutturate nella stessa maniera, mai
   * differenti»: chi ha imparato i Varchi non deve imparare la Presenza. */
  for (const pezzo of [
    "function sezioneAccesa()",
    "function accendiLaVoce()",
    "function schedule()",
    "function svegliamiQuandoCambia(righe)",
    "function installStyles()",
    "quandoSiCambiaPagina(schedule)",
    "dashboardmodern:persistence-restored",
  ]) {
    assert.ok(varchi.includes(pezzo), `i Varchi non hanno più ${pezzo}`);
    assert.ok(presenza.includes(pezzo), `la Presenza non ha ${pezzo}`);
  }
  /* La scala dei tempi è una sola, e sta fuori da entrambe. */
  assert.match(presenza, /quantoTempoInParole/);
  assert.match(varchi, /quantoTempoInParole/);
  assert.doesNotMatch(presenza, /function quantoTempo\(/);
  /* A pagina chiusa non si disegna, come i Varchi. */
  assert.match(presenza, /if \(!paginaVisibile\(PRESENZA_PAGE_ID\)\) return;/);
  /* Nella firma ci va anche la scritta che cambia da sola, sennò il «da 5
   * minuti» resta lì per ore su una plancia appesa al muro. */
  assert.match(presenza, /righe\.map\(daQuandoTesto\)/);
});

test("la scheda del Config è quella dei Varchi, con le stesse tre correzioni", async () => {
  const scheda = await leggi("../src/sections/presenza-editor-section.js");
  for (const gesto of [
    "data-dm-presenza-escludi",
    "data-dm-presenza-riprendi",
    "data-dm-presenza-nome",
    "data-dm-presenza-aggiungi",
    "data-dm-presenza-pick",
  ])
    assert.ok(scheda.includes(gesto), `manca il gesto ${gesto}`);
  /* Le escluse si chiedono al modello SENZA il filtro, e si togliono dopo:
   * chieste già filtrate non ci sarebbe modo di rimetterle dentro. */
  assert.match(scheda, /escluse: \[\] \}/);
  assert.match(scheda, /filter\(\(riga\) => !scelte\.escluse\.includes\(riga\.entity\)\)/);
  /* Il nome si salva senza ridisegnare, sennò il cursore salta via. */
  assert.match(scheda, /function onInput\(event\)/);
  assert.doesNotMatch(scheda.slice(scheda.indexOf("function onInput")), /^\s+ridisegna\(\);/m);
});

test("la tessera della Home non si accende: chi è in casa non è un allarme", async () => {
  const home = await leggi("../src/sections/home-widgets-section.js");
  const tessera = home.slice(
    home.indexOf("function presenzaModel(states)"),
    home.indexOf("/* Le macchine del server e la rete"),
  );
  assert.ok(tessera, "presenzaModel non si trova più dove questa prova lo cerca");
  assert.match(tessera, /key: "presenza"/);
  /* La scelta «nel widget» vale per QUESTA tessera (#431 di prima): la sua
   * chiave le passa accanto, non un elenco globale. */
  assert.match(tessera, /widgetExcludedEntities\("presenza"\)/);
  /* Nessun `alert`: la tessera dei Varchi si accende rossa quando qualcosa è
   * aperto, questa no — qualcuno in casa è la normalità, non una notizia da
   * far lampeggiare. */
  assert.doesNotMatch(tessera, /alert:/);
  assert.match(tessera, /tono: riga\.stato === "attivo" \? "acceso"/);
  /* E il tono «acceso» esiste davvero: una pastiglia con un tono che nessuna
   * regola disegna resterebbe grigia in silenzio. */
  assert.match(home, /\.dm-w-pillola\[data-tono="acceso"\]/);
});
