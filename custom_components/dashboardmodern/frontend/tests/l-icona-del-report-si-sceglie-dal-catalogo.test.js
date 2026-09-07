/* «Modifica voce Report»: l'icona si sceglie, non si scrive a memoria.
 *
 * La finestra che apre la riga del Report aveva tre campi: l'etichetta,
 * l'entità dello storico — con la sua lente — e l'icona, una casella di testo
 * nuda. Per cambiarla bisognava sapere a memoria il nome di un disegno
 * (`mdi:...`) o incollarci dentro un'emoji, mentre in tutto il resto della
 * plancia l'icona si sceglie dal catalogo di casa.
 *
 * Il tasto non può vestire la classe della lente. `.dm-entity-picker` accanto
 * a un campo lo marca come entità — è così che la guardia riconosce i campi da
 * completare — e sopra al catalogo delle icone si sarebbe aperta la ricerca
 * delle entità. Il catalogo è lo stesso di tutti; il tasto è nostro.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const sorgente = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "src", "sections", "report-editor-section.js"),
  "utf8",
);

test("la finestra della voce apre il catalogo delle icone di casa", () => {
  assert.match(sorgente, /import \{ openIconPicker \} from "\.\/icon-engine-section\.js";/);
  assert.match(sorgente, /data-dm-report-icona/);
  assert.match(sorgente, /openIconPicker\(form\.elements\.icon, "action"\)/);
});

test("il tasto dell'icona non si spaccia per una lente delle entita'", () => {
  const riga = sorgente.split("\n").find((testo) => testo.includes("data-dm-report-icona"));
  assert.ok(riga, "la casella dell'icona ha il suo tasto");
  assert.ok(
    !riga.includes("dm-entity-picker"),
    "il tasto del catalogo non porta la classe della lente: marcherebbe il campo come entita'",
  );
  assert.match(riga, /class="dm-report-icon-btn"/);
});

/* E, dietro la stessa finestra, la domanda che decideva se la voce si poteva
 * salvare: «questo e' un contatore di vita?».
 *
 * Ce n'erano due copie private — una nella riga della configurazione, una
 * nella finestra — e tutte e due chiedevano gli stati a `root.STATES`. Ma
 * `STATES` e `_RAW_STATES` sono binding lessicali del guscio: da un modulo
 * `root.STATES` e' sempre `undefined`, e quelle due copie non hanno mai letto
 * uno `state_class` in vita loro. Decidevano solo dal nome, e un contatore
 * vero che nel nome non porta la parola «total» — `sensor.lavastoviglie_
 * energia`, `total_increasing` — si prendeva «l'entita' non sembra
 * cumulativa» e non si salvava. */

test("il contatore di vita si riconosce dallo stato, non solo dal nome", async () => {
  const precedenti = globalThis.STATES;
  globalThis.STATES = {
    "sensor.lavastoviglie_energia": {
      entity_id: "sensor.lavastoviglie_energia",
      state: "12.5",
      attributes: { unit_of_measurement: "kWh", device_class: "energy", state_class: "total_increasing" },
    },
    "sensor.lavastoviglie_potenza": {
      entity_id: "sensor.lavastoviglie_potenza",
      state: "1800",
      attributes: { unit_of_measurement: "W", device_class: "power", state_class: "measurement" },
    },
  };
  try {
    const { isLifetimeMeter } = await import("../src/sections/shared.js");
    assert.equal(isLifetimeMeter("sensor.lavastoviglie_energia"), true);
    /* I watt non sono energia: quello non e' un contatore, e non lo diventa. */
    assert.equal(isLifetimeMeter("sensor.lavastoviglie_potenza"), false);
    assert.equal(isLifetimeMeter(""), false);
  } finally {
    if (precedenti === undefined) delete globalThis.STATES;
    else globalThis.STATES = precedenti;
  }
});

/* Una domanda sola: le due copie non devono tornare. */
test("la domanda sul contatore non ha copie private nelle sezioni", () => {
  for (const nome of ["report-editor-section.js", "editor-crud-section.js"]) {
    const testo = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "..", "src", "sections", nome),
      "utf8",
    );
    assert.ok(!/function cumulativeEntity\b/.test(testo), `${nome} ha ancora la sua copia`);
    assert.ok(!/root\.STATES/.test(testo), `${nome} chiede ancora gli stati a root.STATES`);
  }
});
