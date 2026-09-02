/* Il gruppo di continuita' dice se c'e' corrente (#256).
 *
 * «Chiedo se c'e' la possibilita' di gestire un UPS: vedere se c'e' tensione o
 * no, lo stato della batteria e il carico.»
 *
 * Tre domande, e la prima comanda le altre due: la stessa carica dell'ottanta
 * per cento e' una conferma tranquilla a rete presente e un conto alla
 * rovescia a rete caduta. Queste prove tengono ferma quella differenza — e le
 * sigle che la dichiarano, che non le scrive chi configura ma NUT.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  BATTERIA_BASSA,
  CASELLE_UPS,
  CHIAVE_UPS,
  batteriaScaricaDalloStato,
  daQuandoUps,
  entitaDellUps,
  letturaUps,
  normalizzaUps,
  reteDalloStato,
  statoUps,
} from "../src/core/ups-model.js";
import { fraseDellaTessera, verdettoDellaTessera } from "../src/core/racconto-tessera.js";
import { haOggettoWidget } from "../src/core/oggetti-widget.js";

test("le sigle le scrive NUT, non chi configura", () => {
  for (const sigla of ["OL", "ol", "online", "mains"]) assert.equal(reteDalloStato(sigla), true, sigla);
  for (const sigla of ["OB", "onbatt", "on_battery", "backup"])
    assert.equal(reteDalloStato(sigla), false, sigla);
  /* Arrivano accoppiate: «OL CHRG» e' in linea mentre carica, «OB DISCHRG» a
   * batteria mentre si scarica. Leggere la stringa intera vorrebbe dire non
   * riconoscerne nessuna delle due. */
  assert.equal(reteDalloStato("OL CHRG"), true);
  assert.equal(reteDalloStato("OB DISCHRG"), false);
  assert.equal(reteDalloStato("OL LB"), true);
  // E la batteria scarica si dichiara a parte, perche' puo' esserlo anche in linea.
  assert.equal(batteriaScaricaDalloStato("OL LB"), true);
  assert.equal(batteriaScaricaDalloStato("OB DISCHRG"), false);
  // Un binary_sensor vale come una sigla: la casella e' una sola.
  assert.equal(reteDalloStato("on"), true);
  assert.equal(reteDalloStato("off"), false);
  // Quello che non si capisce non si inventa.
  assert.equal(reteDalloStato(""), null);
  assert.equal(reteDalloStato("unavailable"), null);
});

test("un sensore di mancanza rete dice il contrario, e lo si dichiara", () => {
  const stati = { "binary_sensor.guasto": { state: "on" } };
  /* «Acceso» su un sensore di mancanza rete vuol dire che la corrente NON
   * c'e'. Dallo stato non si puo' indovinare: chi ce l'ha lo spunta. */
  assert.equal(letturaUps({ rete: "binary_sensor.guasto" }, stati).rete, true);
  assert.equal(letturaUps({ rete: "binary_sensor.guasto", invertita: true }, stati).rete, false);
  assert.equal(normalizzaUps({ invertita: "on" }).invertita, true);
  assert.equal(normalizzaUps({}).invertita, false);
});

test("con il solo stato di NUT l'UPS si legge tutto", () => {
  const lettura = letturaUps({ stato: "sensor.ups" }, { "sensor.ups": { state: "OB DISCHRG" } });
  assert.equal(lettura.rete, false);
  assert.equal(lettura.stato, "batteria");
  assert.equal(lettura.allarme, true);
  // Nessun numero inventato: quello che non e' mappato resta assente.
  assert.equal(lettura.batteria, null);
  assert.equal(lettura.carico, null);
  assert.equal(lettura.autonomia, null);
  assert.deepEqual(entitaDellUps({ stato: "sensor.ups" }), ["sensor.ups"]);
  assert.deepEqual(entitaDellUps({}), []);
});

test("la casella della rete batte lo stato, perche' e' piu' precisa", () => {
  const stati = {
    "sensor.ups": { state: "OL" },
    "binary_sensor.rete": { state: "off" },
  };
  const lettura = letturaUps({ stato: "sensor.ups", rete: "binary_sensor.rete" }, stati);
  assert.equal(lettura.rete, false);
});

test("la stessa carica vuol dire due cose diverse", () => {
  /* A rete presente l'ottanta per cento e' una conferma; a rete caduta e'
   * quello che resta. Il modello non decide come si scrive, ma dice qual e'
   * lo stato — e sono due stati diversi. */
  assert.equal(statoUps({ rete: true, batteria: 80 }), "rete");
  assert.equal(statoUps({ rete: false, batteria: 80 }), "batteria");
  assert.equal(statoUps({ rete: false, batteria: 8, scarica: true }), "scarica");
  // Sotto la soglia a rete presente non e' un allarme rosso: e' una ricarica.
  assert.equal(statoUps({ rete: true, batteria: BATTERIA_BASSA - 1 }), "ricarica");
  assert.equal(statoUps({ rete: null }), "ignoto");
  assert.equal(statoUps(), "ignoto");
});

test("una batteria sotto la soglia chiede attenzione anche a rete presente", () => {
  /* Vuol dire che non ha finito di ricaricarsi dal guasto di prima, e il
   * prossimo la trova impreparata: e' proprio il momento in cui si vuole
   * saperlo, non quando la corrente e' gia' caduta. */
  const lettura = letturaUps(
    { rete: "binary_sensor.rete", batteria: "sensor.carica" },
    { "binary_sensor.rete": { state: "on" }, "sensor.carica": { state: "11" } },
  );
  assert.equal(lettura.rete, true);
  assert.equal(lettura.scarica, true);
  assert.equal(lettura.allarme, true);
  assert.equal(lettura.stato, "ricarica");
});

test("da quanto siamo al buio lo dice l'entita' stessa", () => {
  const quando = "2026-09-01T09:46:00.000Z";
  const stati = { "binary_sensor.rete": { state: "off", last_changed: quando } };
  assert.equal(daQuandoUps({ rete: "binary_sensor.rete" }, stati), Date.parse(quando));
  // Senza entita' non c'e' un momento da raccontare: null, non adesso.
  assert.equal(daQuandoUps({}, stati), null);
  assert.equal(daQuandoUps({ rete: "binary_sensor.rete" }, {}), null);
});

test("i numeri si leggono, e le stringhe vuote non diventano zero", () => {
  const stati = {
    "sensor.carica": { state: "68" },
    "sensor.carico": { state: "34" },
    "sensor.autonomia": { state: "23" },
    "sensor.tensione": { state: "" },
    "sensor.potenza": { state: "unknown" },
  };
  const lettura = letturaUps(
    {
      batteria: "sensor.carica",
      carico: "sensor.carico",
      autonomia: "sensor.autonomia",
      tensione: "sensor.tensione",
      potenza: "sensor.potenza",
    },
    stati,
  );
  assert.equal(lettura.batteria, 68);
  assert.equal(lettura.carico, 34);
  assert.equal(lettura.autonomia, 23);
  /* Zero volt sarebbe un'affermazione — «la rete e' a terra» — e non e' quello
   * che dice una casella vuota. */
  assert.equal(lettura.tensione, null);
  assert.equal(lettura.potenza, null);
});

test("la finestra non conta caselle: dice se c'e' corrente", () => {
  const adesso = Date.parse("2026-09-01T10:00:00.000Z");
  const righe = [{}, {}, {}, {}];
  const buio = {
    key: "ups",
    rows: righe,
    alert: true,
    attiva: true,
    da: adesso - 14 * 60000,
    lettura: { rete: false, batteria: 68, autonomia: 23 },
  };
  const frase = fraseDellaTessera(buio, undefined, adesso);
  assert.match(frase, /Manca la corrente da 14 minuti/);
  assert.match(frase, /23 minuti di batteria/);
  // E non «due su quattro in funzione», che di un UPS non e' una notizia.
  assert.doesNotMatch(frase, /in funzione/);
  assert.equal(verdettoDellaTessera(buio).tono, "guarda");

  const quiete = { key: "ups", rows: righe, lettura: { rete: true, batteria: 100, carico: 34 } };
  assert.match(fraseDellaTessera(quiete), /La corrente c'e'/);
  assert.equal(verdettoDellaTessera(quiete).tono, "bene");

  const vuota = { key: "ups", rows: [] };
  assert.match(fraseDellaTessera(vuota), /non c'e' ancora niente/);
});

test("la tessera mostra l'autonomia solo quando serve davvero", async () => {
  const source = await readFile(
    new URL("../src/sections/home-widgets-section.js", import.meta.url),
    "utf8",
  );
  /* A rete caduta il numero grande e' il tempo che resta: e' l'unica cosa che
   * in quel momento si vuole sapere. A rete presente e' la carica, che e' la
   * conferma che quel tempo c'e'. */
  assert.match(source, /aBatteria && lettura\.autonomia != null/);
  // E la tessera si accende quando la casa va a batteria, non quando e' in rete.
  assert.match(source, /attiva: aBatteria/);
  // Il disegno c'e': la tessera non resta col simbolo di ripiego.
  assert.equal(haOggettoWidget("ups"), true);
});

test("la chiave nuova viaggia con la configurazione", async () => {
  const persistenza = await readFile(
    new URL("../src/sections/config-persistence-section.js", import.meta.url),
    "utf8",
  );
  assert.match(persistenza, /"cd_ups"/);
  assert.equal(CHIAVE_UPS, "cd_ups");
  for (const { campo } of CASELLE_UPS) assert.equal(typeof normalizzaUps({})[campo], "string");
});

test("l'UPS ha una pagina sua, non solo una tessera", async () => {
  const sezione = await readFile(
    new URL("../src/sections/ups-section.js", import.meta.url),
    "utf8",
  );
  /* «Crea sempre una sezione a se', non solo il widget col popup»: un UPS e'
   * una macchina della casa come la caldaia o l'auto, e ognuna di quelle ha la
   * sua pagina. La pagina e la voce nascono a runtime, come quelle delle Prese
   * e delle Luci: il guscio non le conosce. */
  assert.match(sezione, /export const UPS_PAGE_ID = "page-ups"/);
  assert.match(sezione, /pagina\.className = "page"/);
  assert.match(sezione, /barra\.querySelector\('\.tab\[data-tab="energy"\]'\)/);
  /* Il gestore del guscio lega le voci una volta sola, al caricamento: questa
   * arriva dopo e il suo tocco se lo deve gestire da se'. */
  assert.match(sezione, /voce\.addEventListener\("click"/);
  /* Senza un UPS configurato la voce non c'e': portare a una pagina vuota e'
   * peggio che non offrirla. */
  assert.match(sezione, /const serve = upsConfigurato\(\) && sezioneAccesa\(\)/);
  assert.match(sezione, /voce\.style\.setProperty\("display", "none", "important"\)/);
  /* E il `display` di quella voce ha un padrone solo. `cdApplyNavVis` del
   * guscio, per ogni voce che conosce, TOGLIE la riga di stile: insegnargli
   * anche la nostra vorrebbe dire lui che la cancella ogni tre secondi e noi
   * che la riscriviamo al giro dopo — con la voce che lampeggia nel mezzo.
   * La sezione spenta a mano la si legge dalla stessa configurazione che
   * legge lui, invece di lasciargliela applicare. */
  assert.doesNotMatch(sezione, /cdNavVisMap/);
  assert.match(sezione, /readJson\("cd_sections", \{\}\)/);
  // E la scena cambia verso: dalla rete quando c'e', dalla batteria quando manca.
  assert.match(sezione, /data-buio="\$\{buio\}"/);
  assert.match(sezione, /\.dm-ups-scena\[data-buio="true"\] \.dm-ups-corrente-uscita/);

  // La pagina ha la sua intestazione, come tutte le altre della plancia.
  const testate = await readFile(
    new URL("../src/sections/page-masthead-section.js", import.meta.url),
    "utf8",
  );
  assert.match(testate, /id: "page-ups"/);
});

test("una scatola senza sonde disegna quello che sa, non quello che le manca", async () => {
  const sezione = await readFile(
    new URL("../src/sections/ups-section.js", import.meta.url),
    "utf8",
  );
  /* Chi ha solo lo stato di NUT non ha carica ne' carico: la cella si riempie
   * tutta e parla il colore. Disegnarla vuota direbbe «non c'e' riserva», che
   * e' un'affermazione e non un'assenza di dati. */
  assert.match(sezione, /if \(dato\.batteria == null\) return 100;/);
  // E una targhetta senza numero non nasce proprio.
  assert.match(sezione, /function targhetta\([^)]*\)\s*\{\s*if \(valore == null\) return "";/);
});

test("le caselle si configurano in una scheda loro, non fra i widget", async () => {
  const editor = await readFile(
    new URL("../src/sections/ups-editor-section.js", import.meta.url),
    "utf8",
  );
  /* Un UPS non e' un widget: nella scheda dei widget si sceglie SE mostrare la
   * tessera, qui si dice COSA guardare. Le caselle erano una coda della scheda
   * «Energia» — «nel config manca completamente la parte per configurare il
   * gruppo di continuita'» — e li' non le trovava nessuno; adesso hanno una
   * scheda loro, con in cima l'interruttore della sezione, che dalla coda
   * dell'Energia non poteva esserci: quella fascia e' dell'Energia. */
  assert.match(editor, /export const UPS_EDITOR_TAB = "ups"/);
  assert.match(editor, /const CHIAVE_SEZIONE = "ups"/);
  assert.match(editor, /cdSecToggleHtml\?\.\(CHIAVE_SEZIONE\)/);
  assert.doesNotMatch(editor, /"sez1"/);
  // E ogni casella del modello ha la sua etichetta: nessuna resta senza.
  for (const { campo } of CASELLE_UPS)
    assert.ok(new RegExp(`^\\s{2}${campo}: \\[`, "m").test(editor), campo);
});
