/* Le animazioni degli elettrodomestici, dove girano davvero.
 *
 * Questa prova guardava il foglio della vecchia scheda alta: chiedeva che
 * dentro ci fossero i fotogrammi e una animazione per famiglia. Le trovava, e
 * passava. Solo che quella scheda non la disegna piu' nessuno da quando la
 * sezione si costruisce le proprie: erano venti regole che non trovavano
 * niente, e la prova le difendeva. Le animazioni che si vedono sul telefono
 * sono sempre state le altre, quelle della sezione.
 *
 * Adesso la prova guarda quelle. Se domani qualcuno le toglie, si accorge chi
 * di dovere — e non un foglio morto al posto suo. */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const vetrina = fs.readFileSync(
  new URL("../src/sections/appliance-showcase-section.js", import.meta.url),
  "utf8",
);
const finestra = fs.readFileSync(
  new URL("../src/sections/appliance-layout-section.js", import.meta.url),
  "utf8",
);

test("ogni famiglia di elettrodomestici ha il suo movimento", () => {
  const famiglie = {
    washer: "dmDrumSpin",
    dryer: "dmDrumSpin",
    oven: "dmDrumSpin",
    dishwasher: "dmJets",
    microwave: "dmPlate",
    fan: "dmDrumSpin",
    "robot-vacuum": "dmRover",
    vacuum: "dmSway",
    iron: "dmSway",
    kettle: "dmBubbleUp",
    television: "dmScreen",
    coffee: "dmJets",
    freezer: "dmFrost",
  };
  for (const [famiglia, fotogrammi] of Object.entries(famiglie)) {
    const regola = new RegExp(
      `\\.dm-ap-mech\\.is-(run|standby)[^{]*\\[data-dm-hero="${famiglia}"\\][^{]*\\{[^}]*animation:${fotogrammi}`,
    );
    assert.match(vetrina, regola, famiglia);
    assert.match(vetrina, new RegExp(`@keyframes ${fotogrammi}\\b`), fotogrammi);
  }
});

test("in funzione e in attesa si distinguono a occhio", () => {
  assert.match(vetrina, /\.dm-ap-badge\.run \.dm-ap-dot\{animation:dmDotPulse/);
  assert.match(vetrina, /\.dm-ap-badge\.standby \.dm-ap-dot\{animation:dmDotBreathe/);
  assert.match(vetrina, /\.dm-ap-mech\.is-standby \.dmh-led\{animation:dmDotBreathe/);
});

/* Il ramo a movimento ridotto puo' spegnere la decorazione — il sollevamento
 * al passaggio del mouse, il luccichio della barra, la ghiera che gira — mai i
 * disegni di stato: su molti desktop quell'impostazione e' attiva a insaputa
 * di chi guarda, e «in funzione» senza movimento e' stato segnalato tre volte
 * come animazioni assenti. */
test("a movimento ridotto si spegne la decorazione, non lo stato", () => {
  const blocco = vetrina.match(/@media \(prefers-reduced-motion:reduce\)\{([\s\S]*?)\n\}/);
  assert.ok(blocco, "manca il ramo a movimento ridotto");
  assert.doesNotMatch(blocco[1], /dm-ap-mech/);
  assert.doesNotMatch(blocco[1], /dmh-/);
});

/* Il modulo che una volta disegnava la scheda adesso fa una cosa sola, e non
 * deve tornare a spiare il documento per farla. */
test("la finestra dei consumi si aggiorna sugli eventi, senza osservare il documento", () => {
  assert.doesNotMatch(finestra, /MutationObserver/);
  assert.match(finestra, /dashboardmodern:state-changed/);
  assert.match(finestra, /dm-appliance-daily-visual/);
});
