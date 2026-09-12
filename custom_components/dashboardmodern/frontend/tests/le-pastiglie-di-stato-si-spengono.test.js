/* «Enable/disable container for status pills (boiler + burglar alarm,
 * side-by-side)» (#491).
 *
 * Le pastiglie sono la riga in cima alla Home che dice le due cose che non si
 * vedono da nessun'altra parte: la caldaia accesa e l'antifurto inserito.
 * Compaiono da sole quando hanno qualcosa da dire, e stanno in cima perché
 * sono un avviso.
 *
 * Per questo NON sono un blocco da riordinare, e la scelta è scritta nel
 * codice da prima di questa segnalazione: metterle in fila con gli altri
 * vorrebbe dire poterle mandare in fondo, cioè non vederle mai — e un avviso
 * che si trova solo scorrendo non ha avvisato nessuno.
 *
 * Spegnerle però è un'altra cosa, ed è quello che chiede la segnalazione. Chi
 * le spegne lo fa sapendo cosa sta spegnendo, una volta, in una casella che
 * dice cosa fa. Nascondere per sbaglio e nascondere apposta non sono lo stesso
 * gesto, ed è tutta la differenza fra le due risposte.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { CHIAVE_PASTIGLIE, lePastiglieSiVedono } from "../src/core/pastiglie-di-stato.js";
import { BLOCCHI_DELLA_HOME } from "../src/core/ordine-dei-blocchi.js";

const sezione = readFileSync(
  new URL("../src/sections/home-blocchi-section.js", import.meta.url),
  "utf8",
);

test("di serie si vedono: chi non ha mai toccato la casella non perde niente", () => {
  assert.equal(lePastiglieSiVedono(null), true);
  assert.equal(lePastiglieSiVedono(undefined), true);
  assert.equal(lePastiglieSiVedono(""), true);
  /* Anche quello che ci ha scritto una versione che di questa casella non
   * sapeva niente vale «sì»: si spegne solo con un no scritto. */
  assert.equal(lePastiglieSiVedono("si"), true);
  assert.equal(lePastiglieSiVedono({ boh: 1 }), true);
  assert.equal(lePastiglieSiVedono("no"), false);
  assert.equal(lePastiglieSiVedono("NO"), false);
  assert.equal(lePastiglieSiVedono("  no  "), false);
});

test("la scelta viaggia con la casa, non col dispositivo", () => {
  assert.equal(CHIAVE_PASTIGLIE, "cd_home_pastiglie");
  /* Accese sul tablet appeso al muro e spente sul telefono sarebbe la stessa
   * casa che dice due cose. La prova che la chiave viaggia sta nell'elenco
   * della configurazione, e la sorveglia `le-foto-si-travasano-una-volta-sola`. */
});

test("spegnerle non è riordinarle: restano fuori dai blocchi", () => {
  /* Se un domani finissero fra i blocchi, si potrebbero mandare in fondo — e
   * questa riga è lì per impedirlo, non per descrivere com'è oggi. */
  assert.equal(BLOCCHI_DELLA_HOME.includes("pastiglie"), false);
});

test("spente, la riga non si vede e non si toglie dal documento", () => {
  /* Non si rimuove il nodo: lo riscrive il guscio a ogni cambio di stato, e
   * toglierlo vorrebbe dire rincorrerlo per sempre. Si spegne con una regola,
   * che vale anche per quello che nasce dopo. */
  assert.match(sezione, /html\[data-dm-pastiglie="no"\] #dashboard-pills-row\{display:none!important\}/);
  assert.match(sezione, /attributoSeCambia\(radice, "data-dm-pastiglie", accese \? "si" : "no"\)/);
  /* Il «sì» si salva vuoto: così chi non ha mai toccato la casella non ha
   * niente scritto in memoria, e non risulta una casa «configurata». */
  assert.match(sezione, /writeJsonIfChanged\(CHIAVE_PASTIGLIE, casella\.checked \? null : "no"\)/);
});
