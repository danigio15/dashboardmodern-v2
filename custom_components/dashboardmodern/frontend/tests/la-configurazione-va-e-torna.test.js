/* Il backup della configurazione, e il suo ritorno.
 *
 * La scheda «💾 Backup» raccoglie le chiavi condivise come stringhe grezze e
 * le rimette al loro posto: qui si prova il giro completo a tavolino, e il
 * contratto — solo chiavi del perimetro, mai alert/confirm, installato col
 * runtime. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  applyBackupValues,
  BACKUP_FORMAT,
  buildBackupPayload,
  parseBackupPayload,
} from "../src/sections/backup-editor-section.js";
import { CONFIG_KEYS, CONFIG_KEYS_REVISION } from "../src/sections/config-persistence-section.js";

test("il giro completo: si raccoglie, si valida, si riscrive — identico", () => {
  const disco = new Map([
    ["cd_people", '[{"name":"Anna"}]'],
    ["cd_navbar_mode", "auto"],
    ["cd_branding", '{"title":"Casa"}'],
    ["chiave_estranea", "non deve viaggiare"],
  ]);
  const payload = buildBackupPayload((key) => disco.get(key) ?? null, new Date(0));
  assert.equal(payload.format, BACKUP_FORMAT);
  assert.equal(payload.revision, CONFIG_KEYS_REVISION);
  assert.equal(payload.values.cd_people, '[{"name":"Anna"}]');
  /* Il valore non-JSON viaggia com'e': stringhe grezze, niente da perdere. */
  assert.equal(payload.values.cd_navbar_mode, "auto");
  assert.ok(!("chiave_estranea" in payload.values));

  const esito = parseBackupPayload(JSON.stringify(payload));
  assert.equal(esito.ok, true);
  assert.equal(esito.count, 3);

  const scritto = new Map();
  const quante = applyBackupValues(esito.values, (key, value) => scritto.set(key, value));
  assert.equal(quante, 3);
  assert.deepEqual(
    [...scritto.entries()].sort(),
    [...disco.entries()].filter(([k]) => k !== "chiave_estranea").sort(),
  );
});

test("un file che non e' un backup si spiega, e uno manomesso non scrive chiavi arbitrarie", () => {
  assert.equal(parseBackupPayload("non json").error, "not-json");
  assert.equal(parseBackupPayload('{"format":"altro"}').error, "not-a-backup");
  assert.equal(parseBackupPayload(`{"format":"${BACKUP_FORMAT}"}`).error, "no-values");
  const manomesso = parseBackupPayload(
    JSON.stringify({ format: BACKUP_FORMAT, values: { evil_key: "x", cd_people: "[]" } }),
  );
  assert.equal(manomesso.ok, true);
  assert.deepEqual(Object.keys(manomesso.values), ["cd_people"]);
  /* E ogni chiave del payload appartiene al perimetro condiviso. */
  for (const key of Object.keys(manomesso.values)) assert.ok(CONFIG_KEYS.includes(key));
});

test("la scheda rispetta i contratti dell'editor", async () => {
  const source = await readFile(new URL("../src/sections/backup-editor-section.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\balert\s*\(|\bconfirm\s*\(/);
  assert.doesNotMatch(source, /setInterval\s*\(|MutationObserver/);
  assert.match(source, /data-backup-confirm/);
  const runtime = await readFile(new URL("../src/sections/section-runtime.js", import.meta.url), "utf8");
  assert.match(runtime, /installBackupEditorSection\(\)/);
  assert.match(runtime, /"backup-editor"/);
});
