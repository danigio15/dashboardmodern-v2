/* «Scusami ma non riesco a trovare questa sezione, c'è scritto solo quella
 * della soglia attiva» (#392) — e subito dopo un secondo: «anch'io ho lo stesso
 * problema, e non vedo questa sezione "ritardo fine ciclo" in config.
 * elettrodomestici».
 *
 * Il campo c'era, e avevo risposto che c'era. Stava però nella fisarmonica
 * «Card avanzata — immagine, ciclo, temperatura, costi», chiusa di suo, in
 * mezzo alle foto e ai costi.
 *
 * Chi cerca «quanto deve stare sotto soglia prima che il ciclo sia finito» lo
 * cerca accanto alla soglia, perché è la stessa domanda: sopra questa potenza
 * sta lavorando, sotto quest'altra è in standby, dopo questi minuti ha finito.
 * Tre numeri di una regola sola, spezzati in due posti di cui uno chiuso e
 * intitolato a un'altra cosa.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const SORGENTE = readFileSync(
  new URL("../src/sections/appliance-editor-section.js", import.meta.url),
  "utf8",
);

/* Il pezzo di modulo sempre aperto: dal `dm-appliance-main-fields` fino alla
 * sua chiusura. */
const MODULO_PRINCIPALE = (() => {
  const inizio = SORGENTE.indexOf("dm-modal-grid dm-appliance-main-fields");
  assert.ok(inizio > 0, "il modulo principale esiste");
  const fine = SORGENTE.indexOf("</div>", inizio);
  return SORGENTE.slice(inizio, fine);
})();

const CARD_AVANZATA = (() => {
  const inizio = SORGENTE.indexOf("function cardFieldsMarkup");
  const fine = SORGENTE.indexOf("\n}", inizio);
  return SORGENTE.slice(inizio, fine);
})();

test("le tre soglie del ciclo stanno nel modulo che si vede subito", () => {
  assert.match(MODULO_PRINCIPALE, /\$\{soglieMarkup\(device\)\}/);
  assert.match(SORGENTE, /function soglieMarkup\(device = \{\}\) \{/);
  const soglie = SORGENTE.slice(SORGENTE.indexOf("function soglieMarkup"));
  assert.match(soglie, /name="threshold_run"/);
  assert.match(soglie, /"threshold_standby"/);
  assert.match(soglie, /"off_delay_minutes"/);
});

test("e non sono più sepolte nella fisarmonica chiusa", () => {
  assert.doesNotMatch(CARD_AVANZATA, /"off_delay_minutes"/);
  assert.doesNotMatch(CARD_AVANZATA, /"threshold_standby"/);
});

test("un ritardo già impostato non apre più la card avanzata da solo", () => {
  /* `CARD_FIELD_KEYS` decide se la fisarmonica nasce aperta: un campo che non
   * sta più lì dentro non deve più deciderlo. */
  const elenco = SORGENTE.slice(
    SORGENTE.indexOf("const CARD_FIELD_KEYS = ["),
    SORGENTE.indexOf("];", SORGENTE.indexOf("const CARD_FIELD_KEYS = [")),
  );
  assert.doesNotMatch(elenco, /off_delay_minutes/);
  assert.match(elenco, /temperature_entity/, "gli altri campi restano");
});

test("l'intestazione della fisarmonica non promette più il ciclo", () => {
  /* Diceva «immagine, ciclo, temperatura, costi» mentre il ciclo se n'è
   * andato: un'etichetta che promette quello che non c'è è come il campo
   * nascosto, fa cercare nel posto sbagliato. */
  const sommario = SORGENTE.slice(SORGENTE.indexOf("<summary>"), SORGENTE.indexOf("</summary>"));
  assert.doesNotMatch(sommario, /immagine, ciclo, temperatura, costi/);
  assert.match(sommario, /Card avanzata — immagine, durata, temperatura, porta, costi/);
  assert.match(sommario, /Advanced card — image, duration, temperature, door, costs/);
  /* E nomina la porta, che è quello che si va a cercare li' dentro: «come si
   * aggiunge l'entità per la porta, non ci sono riuscito nemmeno nell'ultima
   * versione» (#471). Il campo c'era; il cassetto era chiuso e il suo titolo
   * elencava quattro cose, e la porta non era fra quelle. */
  assert.match(sommario, /porta/);
});

test("il valore di serie dello standby resta quello dei metadati", () => {
  /* La soglia standby nasceva dai metadati del tipo quando la casella era
   * vuota, e continua a nascere da lì: spostare un campo non è cambiarlo. */
  const soglie = SORGENTE.slice(SORGENTE.indexOf("function soglieMarkup"));
  assert.match(soglie, /device\.metadata\?\.threshold_standby \?\? ""/);
  assert.match(soglie, /device\.threshold_run \?\? device\.metadata\?\.threshold_run \?\? 5/);
});
