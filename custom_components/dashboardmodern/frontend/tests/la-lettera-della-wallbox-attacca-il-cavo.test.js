/* La wallbox parla per lettere, e la fotografia non le sapeva leggere.
 *
 * Lo stato di ricarica di quasi tutte le colonnine e' un codice della norma
 * IEC 61851: A = auto non connessa, B = cavo dentro e ferma, C e D = in
 * carica, F = guasto. La pillola della pagina Auto quelle lettere le legge da
 * sempre — «🔌 Collegata», «⚡ In Carica» — mentre chi sceglie fra la foto a
 * cavo staccato e quella a cavo attaccato cercava parole. «B» non assomiglia
 * a «collegato» ne' a «scollegato»: non decideva niente, e si finiva sulla
 * potenza. Con l'auto attaccata e la batteria piena la potenza e' zero, e zero
 * viene letto come cavo staccato — quindi la foto di riposo restava a schermo
 * proprio mentre lo stato, accanto, diceva il contrario.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RADICE = join(dirname(fileURLToPath(import.meta.url)), "..");
const sezione = readFileSync(join(RADICE, "src", "sections", "ev-section.js"), "utf8");

test("le lettere della wallbox sono scritte dove si decide il cavo", () => {
  assert.match(sezione, /CODICE_STACCATO = \/\^a\$\/i/);
  assert.match(sezione, /CODICE_ATTACCATO = \/\^\[bcd\]\$\/i/);
});

test("il codice si legge prima delle parole, e prima della potenza", () => {
  const corpo = sezione.slice(
    sezione.indexOf("export function vehiclePlugged"),
    sezione.indexOf("export function activeVehiclePhoto"),
  );
  const codice = corpo.indexOf("CODICE_ATTACCATO");
  const parole = corpo.indexOf("PLUGGED_WORDS.test(status)");
  const potenza = corpo.indexOf("PLUG_REFS.slice(2)");
  assert.ok(codice > 0, "il codice va letto dentro vehiclePlugged");
  assert.ok(codice < parole, "il codice e' esatto, le parole sono indizi: prima il codice");
  assert.ok(parole < potenza, "la potenza resta l'ultimo ripiego");
});

test("le lettere che la pillola conosce sono le stesse che sceglie la foto", () => {
  /* La pillola vive nel runtime vendorizzato e ha la sua tabella. Se un giorno
   * qualcuno le aggiunge una lettera, questa prova lo fa notare qui: due
   * elenchi diversi per la stessa domanda sono il difetto di partenza. */
  const runtime = readFileSync(join(RADICE, "legacy", "dashboard-runtime-it.js"), "utf8");
  const tabella = runtime.slice(runtime.indexOf("const statiEV = {"));
  assert.match(tabella.slice(0, 200), /'A':'Non Connessa'/);
  assert.match(tabella.slice(0, 200), /'B':'\u{1F50C} Collegata'/u);
  assert.match(tabella.slice(0, 200), /'C':'⚡ In Carica'/u);
  assert.match(tabella.slice(0, 200), /'D':'⚡ In Carica'/u);
});
