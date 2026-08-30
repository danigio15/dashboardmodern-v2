/* Ogni nodo che il guscio scrive ha un padrone solo fra i moduli.
 *
 * Il difetto che questa prova impedisce si vedeva a occhio nudo: nel flusso
 * dell'Energia il numero della batteria cambiava faccia da solo, «▼ 1796 W /
 * SOC 75%» e poi «-1796 W / 75 %», avanti e indietro a ogni cambio di stato.
 * Non era un'animazione: erano quattro moduli che scrivevano lo stesso nodo
 * con tre formati diversi, piu' il guscio col suo.
 *
 * La regola e' una sola, e vale per i sessantaquattro nodi che il guscio
 * scrive con `setTxt`/`setHtml`: chi li scrive dal lato dei moduli dev'essere
 * uno, e deve passare dal delegato di `shared.js`. Il delegato lascia sul
 * nodo il cartello `data-dm-padrone="moduli"`, e il guscio quel nodo non lo
 * tocca piu'. Scriverlo a mano — `nodo.textContent = ...` — salta il
 * cartello, il guscio non se ne accorge e i due si riscrivono addosso: e'
 * esattamente com'era nata questa.
 *
 * La prova legge i sorgenti invece di aprire un browser perche' il difetto e'
 * nella struttura, non nel disegno: due padroni sono due padroni anche
 * quando, per un caso di ordini, oggi finiscono per scrivere la stessa cosa.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const QUI = dirname(fileURLToPath(import.meta.url));
const RADICE = join(QUI, "..");
const GUSCIO = join(RADICE, "legacy", "dashboard-runtime-it.js");
const MODULI = join(RADICE, "src", "sections");

/* Il delegato stesso, e chi non disegna ma smista. */
const DELEGATI = new Set(["shared.js", "section-runtime.js"]);

function nodiDelGuscio() {
  const testo = readFileSync(GUSCIO, "utf8");
  const trovati = new Set();
  for (const m of testo.matchAll(/set(?:Txt|Html)\(\s*['"]([\w-]+)['"]/g)) trovati.add(m[1]);
  return trovati;
}

function moduli() {
  return readdirSync(MODULI)
    .filter((n) => n.endsWith(".js") && !DELEGATI.has(n))
    .map((nome) => ({ nome, testo: readFileSync(join(MODULI, nome), "utf8") }));
}

test("nessun nodo del guscio ha due padroni fra i moduli", () => {
  const nodi = nodiDelGuscio();
  assert.ok(
    nodi.size > 40,
    `il guscio dovrebbe scrivere decine di nodi, ne ho contati ${nodi.size}`,
  );
  const elenco = moduli();
  const contesi = [];
  for (const nodo of nodi) {
    const cerca = new RegExp(`['"\`]#?${nodo}['"\`,\\]]`);
    const padroni = elenco.filter((m) => cerca.test(m.testo)).map((m) => m.nome);
    if (padroni.length > 1) contesi.push(`#${nodo}: ${padroni.join(", ")}`);
  }
  assert.deepEqual(
    contesi,
    [],
    `questi nodi del guscio hanno piu' di un padrone fra i moduli:\n  ${contesi.join("\n  ")}`,
  );
});

/* Chi prende un nodo del guscio e se lo mette in una variabile.
 *
 * Si guarda la variabile, non il file: un modulo puo' nominare un nodo del
 * guscio per spostarlo o per leggerlo senza esserne il padrone — la striscia
 * del meteo, per dire, prende `#w-temp` e la porta dentro l'intestazione, ma
 * il numero continua a scriverlo il guscio. Quello non e' un secondo padrone.
 * Lo diventa quando a quella variabile ci scrive addosso. */
function preseDelNodo(testo, nodo) {
  const prese = [];
  const modi = [
    new RegExp(`(?:const|let|var)\\s+([\\w$]+)\\s*=[^;\\n]*getElementById\\(\\s*["'\`]${nodo}["'\`]`, "g"),
    new RegExp(`(?:const|let|var)\\s+([\\w$]+)\\s*=[^;\\n]*querySelector\\(\\s*["'\`][^"'\`]*#${nodo}\\b`, "g"),
  ];
  for (const modo of modi) for (const m of testo.matchAll(modo)) prese.push(m[1]);
  return prese;
}

test("chi scrive un nodo del guscio passa dal delegato che lo rivendica", () => {
  const nodi = nodiDelGuscio();
  const senzaCartello = [];
  for (const { nome, testo } of moduli()) {
    for (const nodo of nodi) {
      for (const variabile of preseDelNodo(testo, nodo)) {
        const aMano = new RegExp(`\\b${variabile}\\.(?:textContent|innerHTML)\\s*=[^=]`);
        const riga = testo.split("\n").findIndex((r) => aMano.test(r));
        if (riga >= 0)
          senzaCartello.push(`${nome}:${riga + 1} scrive #${nodo} a mano (\`${variabile}\`)`);
      }
    }
  }
  assert.deepEqual(
    senzaCartello,
    [],
    `questi moduli scrivono un nodo del guscio senza rivendicarlo, quindi il guscio ` +
      `continuera' a riscriverglielo sopra:\n  ${senzaCartello.join("\n  ")}`,
  );
});

/* Il cartello vale per TUTTE le mani del guscio, `edSetText` compresa.
 *
 * `setTxt` e `setHtml` lo rispettavano; `edSetText` — la mano con cui i due
 * render del Report scrivono i KPI e la griglia finanziaria — no. Il modulo
 * rivendicava i nodi e il guscio ci riscriveva sopra a ogni giro: 473 e 586,
 * 81%% e 84%%, gli euro calcolati e «0,00», avanti e indietro. Idem il
 * cerchio dell'anello, scritto con `setAttribute` diretto. */
test("anche edSetText e l'anello rispettano il cartello dei moduli", () => {
  for (const variante of ["dashboard-runtime-it.js", "dashboard-runtime-en.js"]) {
    const guscio = readFileSync(join(RADICE, "legacy", variante), "utf8");
    assert.match(
      guscio,
      /function edSetText\(id, html\) \{[\s\S]{0,400}?cdPresoDaiModuli\(el\)/,
      `${variante}: edSetText scrive senza guardare il cartello`,
    );
    assert.doesNotMatch(
      guscio,
      /if \(circle\) circle\.setAttribute\('stroke-dasharray'/,
      `${variante}: l'anello si scrive senza guardare il cartello`,
    );
  }
});

/* Le tariffe hanno gli stessi default da tutte le parti: 0.25 e 0.10.
 * Il guscio partiva da questi, i moduli da zero, e nel Report gli euro si
 * alternavano tra calcolati e «0,00 €». */
test("le tariffe dei moduli hanno i default del guscio", () => {
  const energia = readFileSync(join(MODULI, "energy-section.js"), "utf8");
  const polish = readFileSync(join(MODULI, "energy-report-polish-section.js"), "utf8");
  assert.match(energia, /importPrice > 0 \? importPrice : 0\.25/);
  assert.match(energia, /exportPrice > 0 \? exportPrice : 0\.1/);
  assert.match(polish, /rateOrDefault\("cd_costo_kwh", 0\.25\)/);
  assert.match(polish, /rateOrDefault\("cd_prezzo_immissione", 0\.1\)/);
});
