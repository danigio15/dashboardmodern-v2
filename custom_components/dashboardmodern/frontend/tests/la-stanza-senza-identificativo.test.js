/* Una stanza senza identificativo non fa sparire le luci.
 *
 * Le assegnazioni delle luci portano l'identificativo della stanza, e quando
 * portano solo il nome — e' cosi' che le lascia l'importazione dalle aree di
 * Home Assistant — la passata sui contratti le riscrive con l'identificativo:
 * altrimenti al primo rinomino della stanza la luce si scollega.
 *
 * Solo che una stanza puo' non avere un identificativo. Il deposito tiene
 * quello che gli e' stato dato, e una configurazione scritta a mano ne ha
 * salvate parecchie col solo nome. Prendendo `resolved.id` da una di quelle si
 * scriveva `undefined` sull'assegnazione — e `undefined` in un oggetto sparisce
 * appena lo si serializza. L'assegnazione non veniva corretta: veniva
 * cancellata, e tutte le luci di quella stanza finivano fra le altre zone.
 *
 * La regola che questa prova sorveglia e' una sola, e vale per ogni riscrittura
 * automatica: si riscrive quando c'e' qualcosa di MEGLIO da scrivere. Non
 * quando si e' capito cosa c'era.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const QUI = dirname(fileURLToPath(import.meta.url));
const SORGENTE = readFileSync(
  join(QUI, "..", "src", "sections", "data-contracts-section.js"),
  "utf8",
);

test("l'assegnazione si riscrive solo con un identificativo vero", () => {
  /* La forma e' il punto: fra il momento in cui si risolve la stanza e quello
   * in cui si scrive ci deve stare un controllo sull'identificativo. */
  assert.match(
    SORGENTE,
    /const identificativo = clean\(resolved\?\.id\);/,
    "l'identificativo va preso una volta e guardato, non letto due volte da `resolved.id`",
  );
  assert.match(
    SORGENTE,
    /if \(identificativo && assignments\[entity\] !== identificativo\)/,
    "senza il controllo, una stanza senza identificativo scrive `undefined` — che sparisce, e cancella l'assegnazione",
  );
  assert.doesNotMatch(
    SORGENTE,
    /assignments\[entity\] = resolved\.id;/,
    "scrivere `resolved.id` senza guardarlo e' esattamente il difetto",
  );
});

/* E la stessa regola provata sul comportamento, con l'oggetto vero: qui non si
 * apre nessun browser, si rifa' il ragionamento che faceva la funzione. */
test("scrivere `undefined` in un'assegnazione la cancella", () => {
  /* Perche' e' un difetto silenzioso: non si vede finche' non si salva. */
  const assegnazioni = { "light.faretti": "Salone" };
  const stanzaSenzaId = { name: "Salone" };
  assegnazioni["light.faretti"] = stanzaSenzaId.id;
  assert.equal(assegnazioni["light.faretti"], undefined);
  assert.deepEqual(
    JSON.parse(JSON.stringify(assegnazioni)),
    {},
    "l'assegnazione non risulta sbagliata: risulta assente, ed e' per questo che il difetto non si vedeva",
  );
});
