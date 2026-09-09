/* Il grafico delle Temperature: quale misura, e chi ci sta dentro.
 *
 * «All'interno della sezione temperatura, oltre che mostrare il grafico
 *  relativo all'andamento della temperatura di tutte le stanze, potrebbe essere
 *  interessante avere anche quello relativo all'umidità.» (#427)
 *
 * «Sarebbe utile poter togliere dal grafico alcune entità/stanze cliccandoci
 *  sopra in modo tale che diventi più leggibile la variazione. Nel mio caso il
 *  vano tecnico.» (#433)
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const {
  CHIAVE_GRAFICO_STANZE,
  conLaSerieGirata,
  laSiPuoSpegnere,
  MISURE,
  misuraDelGrafico,
  scriviIlValore,
  serieAccese,
  serieSpente,
} = await import("../src/core/il-grafico-delle-stanze.js");

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const leggi = (relativo) => readFileSync(join(SRC, relativo), "utf8");

const SERIE = [{ id: "salone" }, { id: "camera" }, { id: "vano" }];

test("le due misure si leggono da caselle diverse e con unità diverse", () => {
  const [gradi, umido] = MISURE;
  assert.equal(gradi.campo, "temp");
  assert.equal(umido.campo, "hum");
  // Un grado ha un decimale e il gradino, una percentuale nessuno dei due.
  assert.equal(scriviIlValore(21.44, gradi), "21,4°");
  assert.equal(scriviIlValore(55.2, umido), "55%");
  assert.equal(scriviIlValore(21.44, gradi, "."), "21.4°");
  assert.equal(scriviIlValore("boh", gradi), "—");
  // La fascia in cui si sta bene non è la stessa: senza una per misura,
  // guardando l'umidità si vedrebbe la banda dei gradi fra le percentuali.
  assert.deepEqual(gradi.comfort, { basso: 18, alto: 26 });
  assert.deepEqual(umido.comfort, { basso: 40, alto: 60 });
  assert.equal(misuraDelGrafico("umidita").chiave, "umidita");
  // Una misura che non esiste non svuota il grafico: si torna ai gradi.
  assert.equal(misuraDelGrafico("boh").chiave, "temperatura");
  assert.equal(misuraDelGrafico("").chiave, "temperatura");
});

test("una stanza spenta esce dal disegno, e dalla scala con lui", () => {
  const spente = serieSpente({ spente: ["vano"] });
  assert.deepEqual(
    serieAccese(SERIE, spente).map((voce) => voce.id),
    ["salone", "camera"],
  );
  // Spegnere la seconda volta la riaccende: è lo stesso tocco.
  assert.deepEqual(conLaSerieGirata({ spente: ["vano"] }, SERIE, "vano"), []);
  assert.deepEqual(conLaSerieGirata({ spente: [] }, SERIE, "vano"), ["vano"]);
  // Una configurazione senza elenco non spegne niente.
  assert.deepEqual([...serieSpente(null)], []);
  assert.deepEqual([...serieSpente({ spente: "vano" })], []);
});

test("l'ultima accesa non si spegne", () => {
  const spente = serieSpente({ spente: ["camera", "vano"] });
  assert.equal(laSiPuoSpegnere(SERIE, spente, "salone"), false);
  assert.equal(conLaSerieGirata({ spente: ["camera", "vano"] }, SERIE, "salone"), null);
  // Ma riaccenderne una si può sempre.
  assert.deepEqual(conLaSerieGirata({ spente: ["camera", "vano"] }, SERIE, "camera"), ["vano"]);
  assert.equal(conLaSerieGirata({ spente: [] }, SERIE, ""), null);
});

test("spente tutte, si torna a mostrarle tutte", () => {
  /* Una stanza rinominata, una configurazione vecchia: un grafico vuoto non
   * racconta niente, e chi lo apre non ha modo di capire che quel vuoto è una
   * sua scelta di mesi fa. */
  const tutte = serieSpente({ spente: ["salone", "camera", "vano"] });
  assert.deepEqual(
    serieAccese(SERIE, tutte).map((voce) => voce.id),
    ["salone", "camera", "vano"],
  );
});

test("il pannello legge la misura scelta e salta le spente prima dello storico", () => {
  const fonte = leggi("sections/temperature-trend-section.js");
  // La casella da cui si legge la dice la misura, non è più sempre `temp`.
  assert.match(fonte, /const campo = misura\.campo;/);
  assert.match(fonte, /entity: clean\(entry\[campo\]\)/);
  // La fascia del comfort viaggia con la misura fino al disegno.
  assert.match(fonte, /trendGeometry\(\s*withRows[\s\S]{0,120}?misura\.comfort,/);
  /* Le spente non si chiedono nemmeno a Recorder: toglierle dal disegno e
   * continuare a leggerne la storia sarebbe pagare una domanda per una linea
   * che nessuno guarda. */
  const render = fonte.slice(fonte.indexOf("export function renderTemperatureTrend"));
  assert.ok(
    render.indexOf("serieAccese(model.series, spenti)") < render.indexOf("rowsFor(item.entity"),
    "lo storico si chiede prima di togliere le spente",
  );
  // La scelta si tiene in configurazione, così vale anche sul telefono.
  assert.match(fonte, /writeJsonIfChanged\(CHIAVE_GRAFICO_STANZE, \{ \.\.\.stored, spente: prossime \}\)/);
  assert.equal(CHIAVE_GRAFICO_STANZE, "cd_grafico_stanze");
  assert.match(
    leggi("core/chiavi-di-configurazione.js"),
    /"cd_grafico_stanze",/,
    "la chiave non viaggia fra i dispositivi",
  );
  // La legenda le elenca tutte: senza la voce di una spenta non ci sarebbe
  // più modo di riaccenderla.
  assert.match(fonte, /drawLegend\(panel\.querySelector\("\.dm-trend-legend"\), geometry\.series, model\.series, spenti, misura\)/);
  assert.match(fonte, /chip\.setAttribute\("aria-pressed"/);
});
