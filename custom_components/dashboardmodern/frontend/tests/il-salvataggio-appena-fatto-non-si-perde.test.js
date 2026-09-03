/* «Metto l'entita', faccio salva, e non me la mette nella plancia.»
 *
 * E poi, dallo stesso giorno: «se metti due calendari il primo te lo mette e
 * l'altro no», «ora vedo gli stessi carichi sui due impianti diversi». Tre
 * sezioni che non c'entrano niente l'una con l'altra, e un'unica forma: si
 * salva, e il salvataggio non resta.
 *
 * La causa e' una sola, e sta nel modo in cui due plance della stessa casa si
 * mettono d'accordo. Il conflitto si risolveva cosi': una modifica locale vince
 * solo se e' stata fatta sopra la revisione che questo dispositivo aveva gia'
 * visto; altrimenti `restore-remote`, e la copia remota — che quella modifica
 * non ce l'ha — torna sopra. In silenzio.
 *
 * Basta che un'altra plancia abbia spinto qualcosa nel frattempo. Il telefono
 * in mano e il tablet in cucina sono due dispositivi, e chi sta configurando ne
 * ha quasi sempre due aperti.
 *
 * Buttare via una modifica appena fatta non risolve il conflitto: lo nasconde.
 * Adesso si fondono.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  conLeModificheInSospeso,
  sharedReconcileAction,
} from "../src/sections/config-persistence-section.js";

const PRESE_MIE = JSON.stringify([
  { entity: "switch.lavatrice" },
  { entity: "switch.asciugatrice" },
  { entity: "switch.frigo" },
]);
const PRESE_LORO = JSON.stringify([
  { entity: "switch.lavatrice" },
  { entity: "switch.asciugatrice" },
]);

const remota = (revision, values) => ({
  revision,
  updated_at: 1_800_000_000_000,
  keys_revision: 99,
  writer_generation: 99,
  values,
});

test("una modifica appena fatta non viene buttata dalla copia remota", () => {
  /* La terza presa e' qui e non di la', e la revisione remota e' andata avanti
   * perche' un altro dispositivo ha spinto qualcosa. Prima: «restore-remote»,
   * cioe' la terza presa sparisce senza dirlo a nessuno. */
  const scelta = sharedReconcileAction({
    snapshot: remota(8, { cd_prese: PRESE_LORO }),
    local: { cd_prese: PRESE_MIE },
    localConfigured: true,
    pendingAt: Date.now(),
    syncedRevision: 7,
    chiaviDaTenere: ["cd_prese"],
  });
  assert.equal(scelta, "merge-local");
});

test("chi non ha toccato niente prende la copia remota, come prima", () => {
  /* Senza chiavi in sospeso non c'e' niente da difendere, e la regola resta
   * quella di sempre: comanda chi e' piu' avanti. */
  assert.equal(
    sharedReconcileAction({
      snapshot: remota(8, { cd_prese: PRESE_LORO }),
      local: { cd_prese: PRESE_MIE },
      localConfigured: true,
      pendingAt: Date.now(),
      syncedRevision: 7,
      chiaviDaTenere: [],
    }),
    "restore-remote",
  );
});

test("una modifica fatta sopra la revisione vista si spinge, come prima", () => {
  assert.equal(
    sharedReconcileAction({
      snapshot: remota(7, { cd_prese: PRESE_LORO }),
      local: { cd_prese: PRESE_MIE },
      localConfigured: true,
      pendingAt: Date.now(),
      syncedRevision: 7,
      chiaviDaTenere: ["cd_prese"],
    }),
    "push-local",
  );
});

test("e chi non ha modifiche in sospeso non fonde niente", () => {
  assert.equal(
    sharedReconcileAction({
      snapshot: remota(8, { cd_prese: PRESE_LORO }),
      local: { cd_prese: PRESE_MIE },
      localConfigured: true,
      pendingAt: 0,
      syncedRevision: 7,
      chiaviDaTenere: ["cd_prese"],
    }),
    "restore-remote",
  );
});

test("la fusione: la copia remota per tutto, la propria dove si e' scritto", () => {
  const fusi = conLeModificheInSospeso(
    { cd_prese: PRESE_LORO, cd_calendari: "[]", cd_stanze: '[{"id":"r1"}]' },
    { cd_prese: PRESE_MIE, cd_calendari: '[{"entity":"calendar.lavoro"}]', cd_stanze: "[]" },
    ["cd_prese"],
  );
  assert.equal(fusi.cd_prese, PRESE_MIE, "la modifica appena fatta e' andata persa");
  assert.equal(fusi.cd_calendari, "[]", "una chiave non toccata ha vinto sulla remota");
  assert.equal(fusi.cd_stanze, '[{"id":"r1"}]', "una chiave non toccata ha vinto sulla remota");
});

test("piu' chiavi toccate restano tutte", () => {
  const fusi = conLeModificheInSospeso(
    { cd_prese: PRESE_LORO, cd_calendari: "[]" },
    { cd_prese: PRESE_MIE, cd_calendari: '[{"entity":"calendar.lavoro"}]' },
    ["cd_prese", "cd_calendari"],
  );
  assert.equal(fusi.cd_prese, PRESE_MIE);
  assert.equal(fusi.cd_calendari, '[{"entity":"calendar.lavoro"}]');
});

test("una chiave cancellata qui resta cancellata anche nella fusione", () => {
  /* Se qui non c'e' piu' e' perche' e' stata tolta: rimetterla dalla copia
   * remota vorrebbe dire far resuscitare quello che si e' appena eliminato. */
  const fusi = conLeModificheInSospeso({ cd_prese: PRESE_LORO }, {}, ["cd_prese"]);
  assert.equal("cd_prese" in fusi, false);
});

test("una chiave che non e' delle nostre non si tocca", () => {
  const fusi = conLeModificheInSospeso({ cd_prese: PRESE_LORO }, { pippo: "x" }, ["pippo"]);
  assert.equal(fusi.cd_prese, PRESE_LORO);
  assert.equal("pippo" in fusi, false);
});
