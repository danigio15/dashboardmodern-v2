/* Il centralino, provato per intero: una Request vera entra, una Response vera
 * esce, e in mezzo c'e' SQLite col vero schema.
 *
 * Le cose che qui si controllano sono quelle che, sbagliate, non si vedrebbero
 * da fuori: che il segreto di una casa non apra quella di un'altra, che una
 * lettura non fabbrichi linee, che i limiti valgano davvero, e che cancellare
 * cancelli.
 */
import assert from "node:assert/strict";
import test from "node:test";

import centralino, { perLeProve } from "../src/index.js";
import { d1Finto } from "./d1-finto.js";

const CHIAVE_CONSOLE = "chiave-della-console-lunga-abbastanza-per-essere-una-chiave";
const CASA = `casa_${"a1b2c3d4".repeat(4)}`;
const ALTRA = `casa_${"9f9f9f9f".repeat(4)}`;
const SEGRETO = "segreto-di-casa-lungo-almeno-trentadue-caratteri";
const INDIRIZZO = "https://centralino.esempio.workers.dev";

function ambiente() {
  return { DB: d1Finto(), CHIAVE_CONSOLE };
}

async function chiama(env, { via, metodo = "GET", casa, segreto, chiave, corpo, note = {} }) {
  const intestazioni = new Headers();
  if (casa) intestazioni.set("x-casa", casa);
  if (segreto) intestazioni.set("authorization", `Bearer ${segreto}`);
  if (chiave) intestazioni.set("authorization", `Bearer ${chiave}`);
  for (const [nome, valore] of Object.entries(note)) intestazioni.set(nome, valore);
  const richiesta = new Request(`${INDIRIZZO}${via}`, {
    method: metodo,
    headers: intestazioni,
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const risposta = await centralino.fetch(richiesta, env);
  return { stato: risposta.status, corpo: await risposta.json() };
}

const scrive = (env, testo, chi = CASA, segreto = SEGRETO, note = {}) =>
  chiama(env, {
    via: "/casa/messaggi",
    metodo: "POST",
    casa: chi,
    segreto,
    corpo: { testo },
    note,
  });

const legge = (env, dopo = 0, chi = CASA, segreto = SEGRETO) =>
  chiama(env, { via: `/casa/messaggi?dopo=${dopo}`, casa: chi, segreto });

/* ─── Che sia vivo ───────────────────────────────────────────────────────── */

test("dice di essere vivo, e per quello non chiede niente", async () => {
  const { stato, corpo } = await chiama(ambiente(), { via: "/salute" });
  assert.equal(stato, 200);
  assert.deepEqual(corpo, { vivo: true });
});

test("a una via che non esiste risponde che non c'è niente", async () => {
  const { stato } = await chiama(ambiente(), { via: "/qualunque-altra-cosa" });
  assert.equal(stato, 404);
});

/* ─── Lo sportello della casa ────────────────────────────────────────────── */

test("il primo messaggio apre la linea e resta scritto", async () => {
  const env = ambiente();
  const mandato = await scrive(env, "non mi si vede la temperatura in salotto");
  assert.equal(mandato.stato, 200);
  assert.equal(mandato.corpo.messaggio.da, "casa");

  const letto = await legge(env);
  assert.equal(letto.corpo.aperta, true);
  assert.deepEqual(
    letto.corpo.messaggi.map((m) => m.testo),
    ["non mi si vede la temperatura in salotto"],
  );
});

test("una lettura non apre nessuna linea", async () => {
  /* Se leggere aprisse, chiunque potrebbe fabbricare un milione di stanze
   * vuote con un milione di GET senza aver mai detto niente. */
  const env = ambiente();
  const letto = await legge(env);
  assert.equal(letto.stato, 200);
  assert.deepEqual(letto.corpo, { messaggi: [], aperta: false });
  assert.equal(env.DB.interroga("SELECT COUNT(*) AS q FROM linee")[0].q, 0);
});

test("il segreto di una casa non apre quella di un'altra", async () => {
  const env = ambiente();
  await scrive(env, "la mia");
  const intruso = await legge(env, 0, CASA, "un-altro-segreto-lungo-abbastanza-per-provarci");
  assert.equal(intruso.stato, 403);
  const scrittura = await scrive(env, "scrivo io", CASA, "un-altro-segreto-lungo-abbastanza-ok");
  assert.equal(scrittura.stato, 403);
});

test("due case non si vedono i messaggi", async () => {
  const env = ambiente();
  await scrive(env, "la mia domanda");
  await scrive(env, "la sua domanda", ALTRA, "segreto-della-seconda-casa-abbastanza-lungo");
  const mia = await legge(env);
  assert.deepEqual(
    mia.corpo.messaggi.map((m) => m.testo),
    ["la mia domanda"],
  );
});

test("un messaggio vuoto non è un messaggio", async () => {
  const env = ambiente();
  assert.equal((await scrive(env, "   ")).stato, 400);
  assert.equal(env.DB.interroga("SELECT COUNT(*) AS q FROM linee")[0].q, 0);
});

test("un identificativo che non è un identificativo non arriva al database", async () => {
  const env = ambiente();
  for (const finto of ["", "casa_", "pippo", `casa_${"z".repeat(32)}`, "'; DROP TABLE linee;--"]) {
    const { stato } = await scrive(env, "ciao", finto);
    assert.equal(stato, 400, `"${finto}" è passato`);
  }
  assert.equal(env.DB.interroga("SELECT COUNT(*) AS q FROM linee").length, 1);
});

test("un segreto corto non è un segreto", async () => {
  const { stato } = await scrive(ambiente(), "ciao", CASA, "corto");
  assert.equal(stato, 401);
});

test("il segreto non resta scritto in chiaro da nessuna parte", async () => {
  /* Chi si trovasse in mano l'archivio non deve poter scrivere a nome di
   * nessuno: qui c'è l'impronta, e da quella non si torna indietro. */
  const env = ambiente();
  await scrive(env, "ciao");
  const [riga] = env.DB.interroga("SELECT segreto FROM linee");
  assert.notEqual(riga.segreto, SEGRETO);
  assert.equal(riga.segreto, await perLeProve.impronta(SEGRETO));
});

test("il messaggio lungo si taglia invece di essere rifiutato", async () => {
  /* Chi ha incollato mezzo file di log ha comunque una domanda: si prende
   * quello che ci sta, invece di rispondere «no» e perdere tutto. */
  const env = ambiente();
  await scrive(env, "x".repeat(perLeProve.LIMITI.testo + 500));
  const { corpo } = await legge(env);
  assert.equal(corpo.messaggi[0].testo.length, perLeProve.LIMITI.testo);
});

test("venti messaggi in un'ora bastano", async () => {
  const env = ambiente();
  for (let i = 0; i < perLeProve.LIMITI.alOra; i += 1) {
    assert.equal((await scrive(env, `numero ${i}`)).stato, 200, `il ${i} è stato rifiutato`);
  }
  const troppo = await scrive(env, "e questo no");
  assert.equal(troppo.stato, 429);
});

const casaACaso = () =>
  `casa_${[...Array(32)].map(() => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("")}`;

test("non si possono fabbricare linee all'infinito", async () => {
  /* Il buco che il limite orario da solo non chiudeva: chi si inventa un
   * identificativo nuovo a ogni richiesta prendeva ogni volta il ramo «linea
   * assente», dove i venti messaggi all'ora non venivano nemmeno guardati. Un
   * cliente solo, senza nessun segreto, poteva riempire il database di stanze
   * finte finché la quota non finiva — e a quel punto la chat non funzionava
   * più per nessuna casa vera. */
  const env = ambiente();
  for (let i = 0; i < perLeProve.LIMITI.nuoveAllOra; i += 1) {
    const esito = await scrive(env, `apro la ${i}`, casaACaso(), SEGRETO);
    assert.equal(esito.stato, 200, `la linea ${i} è stata rifiutata`);
  }
  const oltre = await scrive(env, "e questa no", casaACaso(), SEGRETO);
  assert.equal(oltre.stato, 429);
  assert.equal(
    env.DB.interroga("SELECT COUNT(*) AS q FROM linee")[0].q,
    perLeProve.LIMITI.nuoveAllOra,
  );
});

test("il tetto sulle linee nuove non ferma chi ce l'ha già", async () => {
  /* Il limite è sulle nascite, non sulle conversazioni: una casa che scrive da
   * ieri non deve trovare la porta chiusa perché oggi qualcuno ha aperto
   * sessanta linee. */
  const env = ambiente();
  await scrive(env, "la mia prima");
  env.DB.interroga("UPDATE linee SET aperta_il = ?", Date.now() - 2 * 60 * 60 * 1000);
  for (let i = 0; i < perLeProve.LIMITI.nuoveAllOra; i += 1) {
    await scrive(env, `rumore ${i}`, casaACaso(), SEGRETO);
  }
  const mia = await scrive(env, "la mia seconda");
  assert.equal(mia.stato, 200, "una linea già aperta è stata bloccata dal tetto");
});

test("la conversazione non diventa un archivio", async () => {
  const env = ambiente();
  /* Si scrive dalla console per non incontrare il limite orario della casa:
   * qui si prova la storia, non la frequenza. */
  await scrive(env, "apro io");
  for (let i = 0; i < perLeProve.LIMITI.storia + 10; i += 1) {
    await chiama(env, {
      via: `/console/conversazioni/${CASA}`,
      metodo: "POST",
      chiave: CHIAVE_CONSOLE,
      corpo: { testo: `risposta ${i}` },
    });
  }
  const [conto] = env.DB.interroga("SELECT COUNT(*) AS q FROM messaggi");
  assert.equal(conto.q, perLeProve.LIMITI.storia);
});

test("cancellare cancella davvero, non solo dallo schermo", async () => {
  const env = ambiente();
  await scrive(env, "poi ho risolto da solo");
  const via = await chiama(env, {
    via: "/casa/messaggi",
    metodo: "DELETE",
    casa: CASA,
    segreto: SEGRETO,
  });
  assert.equal(via.corpo.cancellata, true);
  assert.equal(env.DB.interroga("SELECT COUNT(*) AS q FROM messaggi")[0].q, 0);
  assert.equal(env.DB.interroga("SELECT COUNT(*) AS q FROM linee")[0].q, 0);
});

test("«dopo» torna solo quello che è arrivato dopo", async () => {
  const env = ambiente();
  await scrive(env, "prima");
  const primo = await legge(env);
  const ultimo = primo.corpo.messaggi.at(-1).id;
  await scrive(env, "seconda");
  const nuovi = await legge(env, ultimo);
  assert.deepEqual(
    nuovi.corpo.messaggi.map((m) => m.testo),
    ["seconda"],
  );
});

/* ─── Lo sportello della console ─────────────────────────────────────────── */

test("senza la chiave la console non vede niente", async () => {
  const env = ambiente();
  await scrive(env, "una domanda");
  for (const chiave of ["", "sbagliata", `${CHIAVE_CONSOLE}x`]) {
    const { stato } = await chiama(env, { via: "/console/conversazioni", chiave });
    assert.equal(stato, 403, `"${chiave}" è passata`);
  }
});

test("la console vede l'elenco, con i non letti e l'ultima cosa detta", async () => {
  const env = ambiente();
  await scrive(env, "la prima domanda", CASA, SEGRETO, {
    "x-versione": "1.4.5-beta.12",
    "x-ha": "2026.8.3",
    "x-lingua": "it",
    "x-nome": "Giovanni",
  });
  const { corpo } = await chiama(env, { via: "/console/conversazioni", chiave: CHIAVE_CONSOLE });
  assert.equal(corpo.conversazioni.length, 1);
  const riga = corpo.conversazioni[0];
  assert.equal(riga.id, CASA);
  assert.equal(riga.nome, "Giovanni");
  assert.equal(riga.versione, "1.4.5-beta.12");
  assert.equal(riga.ha, "2026.8.3");
  assert.equal(riga.non_letti, 1);
  assert.equal(riga.ultimo, "la prima domanda");
});

test("aprire un filo spegne il non letto della console", async () => {
  const env = ambiente();
  await scrive(env, "domanda");
  await chiama(env, { via: `/console/conversazioni/${CASA}`, chiave: CHIAVE_CONSOLE });
  const { corpo } = await chiama(env, { via: "/console/conversazioni", chiave: CHIAVE_CONSOLE });
  assert.equal(corpo.conversazioni[0].non_letti, 0);
});

test("la risposta della console arriva alla casa", async () => {
  const env = ambiente();
  await scrive(env, "come metto la temperatura in salotto?");
  const risposta = await chiama(env, {
    via: `/console/conversazioni/${CASA}`,
    metodo: "POST",
    chiave: CHIAVE_CONSOLE,
    corpo: { testo: "dalla scheda Stanze, riga Salone" },
  });
  assert.equal(risposta.stato, 200);
  const { corpo } = await legge(env);
  assert.deepEqual(
    corpo.messaggi.map((m) => [m.da, m.testo]),
    [
      ["casa", "come metto la temperatura in salotto?"],
      ["console", "dalla scheda Stanze, riga Salone"],
    ],
  );
});

test("la console non risponde a una linea che non esiste", async () => {
  const { stato } = await chiama(ambiente(), {
    via: `/console/conversazioni/${CASA}`,
    metodo: "POST",
    chiave: CHIAVE_CONSOLE,
    corpo: { testo: "ciao?" },
  });
  assert.equal(stato, 404);
});

/* ─── Le linee che non parlano più ───────────────────────────────────────── */

test("una linea ferma da sei mesi se ne va, conversazione compresa", async () => {
  const env = ambiente();
  await scrive(env, "domanda di gennaio");
  const vecchio = Date.now() - perLeProve.LIMITI.silenzio - 1000;
  env.DB.interroga("UPDATE linee SET vista_il = ? WHERE id = ?", vecchio, CASA);
  await centralino.scheduled({}, env);
  assert.equal(env.DB.interroga("SELECT COUNT(*) AS q FROM linee")[0].q, 0);
  assert.equal(env.DB.interroga("SELECT COUNT(*) AS q FROM messaggi")[0].q, 0);
});

test("una linea viva non se ne va", async () => {
  const env = ambiente();
  await scrive(env, "domanda di stamattina");
  await centralino.scheduled({}, env);
  assert.equal(env.DB.interroga("SELECT COUNT(*) AS q FROM linee")[0].q, 1);
});
