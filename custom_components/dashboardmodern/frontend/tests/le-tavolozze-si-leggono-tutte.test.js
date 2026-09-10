/* «Quando è possibile avere qualche tema in più, grazie» (#436).
 *
 * I temi erano due, chiaro e scuro, più «auto». Non era pigrizia: finché metà
 * delle regole non passava dai token — la famiglia di difetti della #425 — un
 * tema nuovo sarebbe stato un tema nuovo per metà schermo, e l'altra metà
 * sarebbe rimasta vestita da ieri.
 *
 * Adesso una tavolozza è un elenco di valori, e proprio per questo si può
 * provare a tavolino: il contrasto fra una scritta e il fondo su cui cade è
 * aritmetica sui numeri, non qualcosa da guardare. Le tre cose che una
 * tavolozza può sbagliare sono tutte qui:
 *
 *  1. dimenticare un token, ed ereditare dalla famiglia il colore di prima —
 *     cioè un fondo nuovo col testo vecchio sopra;
 *  2. essere illeggibile, che è il difetto della #425 rifatto a mano;
 *  3. sostituire la famiglia invece di accompagnarla, e perdere in un colpo
 *     tutte le regole del foglio storico che poggiano su `data-theme`.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  TAVOLOZZE,
  TOKEN_DI_UNA_TAVOLOZZA,
  famigliaDaVestire,
  foglioDelleTavolozze,
  tavolozzaDi,
} from "../src/core/tavolozze.js";

/* Il contrasto come lo definisce la regola d'accessibilità. */
const canale = (valore) => (valore <= 0.03928 ? valore / 12.92 : ((valore + 0.055) / 1.055) ** 2.4);
function luce(esadecimale) {
  const numero = Number.parseInt(esadecimale.slice(1), 16);
  const rosso = (numero >> 16) & 255;
  const verde = (numero >> 8) & 255;
  const blu = numero & 255;
  return 0.2126 * canale(rosso / 255) + 0.7152 * canale(verde / 255) + 0.0722 * canale(blu / 255);
}
function contrasto(davanti, dietro) {
  const uno = luce(davanti);
  const due = luce(dietro);
  return (Math.max(uno, due) + 0.05) / (Math.min(uno, due) + 0.05);
}

test("ce ne sono davvero di più, e ogni chiave è una sola", () => {
  assert.ok(TAVOLOZZE.length >= 4, "«qualche tema in più» vuol dire più di uno");
  const chiavi = TAVOLOZZE.map((voce) => voce.chiave);
  assert.equal(new Set(chiavi).size, chiavi.length);
});

test("nessuna tavolozza dimentica un token", () => {
  /* Una che ne dimenticasse uno lo erediterebbe dalla famiglia, ed è il caso
   * brutto: un fondo nuovo con sopra il testo del fondo vecchio. */
  for (const voce of TAVOLOZZE)
    for (const token of TOKEN_DI_UNA_TAVOLOZZA)
      assert.ok(voce.token[token], `${voce.chiave}: manca ${token}`);
});

test("ogni tavolozza si legge: testo, testo tenue e accento sul suo fondo", () => {
  for (const voce of TAVOLOZZE) {
    const carta = voce.token["--card-bg"];
    const fondo = voce.token["--bg-sculpted"];
    for (const [nome, davanti, dietro] of [
      ["testo su card", voce.token["--text"], carta],
      ["testo su fondo", voce.token["--text"], fondo],
      ["testo tenue su card", voce.token["--text-dim"], carta],
      ["accento su card", voce.token["--accent"], carta],
    ]) {
      const misura = Math.round(contrasto(davanti, dietro) * 100) / 100;
      assert.ok(misura >= 4.5, `${voce.chiave}: ${nome} sta a ${misura}, sotto 4,5`);
    }
  }
});

test("una tavolozza scura ha davvero il fondo scuro, e una chiara chiaro", () => {
  /* La famiglia non è un'etichetta: decide `color-scheme` e tutte le regole
   * del foglio storico. Dichiararla al contrario del proprio fondo sarebbe il
   * modo più veloce di avere una casa incoerente. */
  for (const voce of TAVOLOZZE) {
    const chiara = luce(voce.token["--bg-sculpted"]) > 0.4;
    assert.equal(chiara, voce.famiglia === "chiaro", `${voce.chiave}: famiglia e fondo non vanno d'accordo`);
  }
});

test("la famiglia da vestire: la porta la tavolozza, altrimenti il dispositivo", () => {
  assert.equal(famigliaDaVestire("notte", "chiaro"), "scuro");
  assert.equal(famigliaDaVestire("sabbia", "scuro"), "chiaro");
  assert.equal(famigliaDaVestire("", "scuro"), "scuro");
  assert.equal(famigliaDaVestire("", "chiaro"), "chiaro");
  /* Un nome che non esiste — un salvataggio vecchio, un refuso — non inventa
   * una famiglia: resta quella del dispositivo. */
  assert.equal(famigliaDaVestire("tavolozza-che-non-c-e", "scuro"), "scuro");
  assert.equal(tavolozzaDi("tavolozza-che-non-c-e"), null);
});

test("il foglio scrive un blocco per tavolozza, accanto alla famiglia e non al suo posto", () => {
  const foglio = foglioDelleTavolozze();
  for (const voce of TAVOLOZZE) {
    assert.match(foglio, new RegExp(`html\\[data-dm-tavolozza="${voce.chiave}"\\]`));
    assert.match(
      foglio,
      new RegExp(`data-dm-tavolozza="${voce.chiave}"\\][^}]*color-scheme:${voce.famiglia === "scuro" ? "dark" : "light"}`),
    );
  }
  /* Il marcatore della famiglia non si tocca: su quello poggiano centinaia di
   * regole del foglio storico. */
  assert.doesNotMatch(foglio, /data-theme=/);
});
