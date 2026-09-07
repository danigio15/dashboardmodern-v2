/* Cinque difetti trovati dalla revisione automatica sulla PR della 1.4.13.
 *
 * Non erano cinque cose diverse: erano cinque volte lo stesso modo di
 * sbagliare — una verità tenuta in due posti, o un esito buttato via. Qui si
 * fissa che restino corrette.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { CONFIG_KEYS } from "../src/core/chiavi-di-configurazione.js";
import { installStateEventGate } from "../src/core/state-event-gate.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const leggi = (relativo) => readFileSync(join(SRC, relativo), "utf8");

/* ── il cancello degli stati ─────────────────────────────────────────────── */

test("il cancello non si tiene una copia a mano delle chiavi", () => {
  const sorgente = leggi("core/state-event-gate.js");
  assert.equal(
    sorgente.includes("LEGACY_CONFIG_KEYS"),
    false,
    "l'elenco delle chiavi non si scrive due volte: gliele passa chi lo installa",
  );
  const installa = leggi("sections/section-runtime.js");
  assert.match(
    installa,
    /installStateEventGate\([^)]*root,\s*\{\s*chiavi: CONFIG_KEYS,/s,
    "chi installa il cancello gli passa CONFIG_KEYS",
  );
});

test("le chiavi nuove sono nell'elenco che il cancello riceve", () => {
  for (const chiave of ["cd_varchi", "cd_macchine", "cd_vmc"])
    assert.ok(CONFIG_KEYS.includes(chiave), `${chiave} deve stare in CONFIG_KEYS`);
});

/* La prova vera: un'entità che sta SOLO in una delle chiavi nuove deve passare
 * il cancello. Prima non passava — la copia a mano non conosceva quelle chiavi
 * — e la tessera della ventilazione restava ferma sull'ultimo valore letto. */
test("una entita' che sta solo nelle chiavi nuove passa il cancello", async () => {
  const eventi = [];
  const deposito = {
    cd_vmc: JSON.stringify({ mandata: "sensor.vmc_mandata" }),
    cd_stanze: JSON.stringify([{ id: "r1", temp: "sensor.cucina" }]),
  };
  class FintoEvento {
    constructor(tipo, init = {}) {
      this.type = tipo;
      this.detail = init.detail;
    }
  }
  const root = {
    CustomEvent: FintoEvento,
    addEventListener() {},
    dispatchEvent(evento) {
      eventi.push(evento);
      return true;
    },
    localStorage: {
      getItem: (chiave) => deposito[chiave] ?? null,
      setItem(chiave, valore) {
        deposito[chiave] = String(valore);
      },
      removeItem(chiave) {
        delete deposito[chiave];
      },
    },
    setTimeout,
    queueMicrotask,
  };
  const broker = {
    statesStarted: true,
    subscription: 7,
    ingestState(stato, { emitEvent = true } = {}) {
      if (emitEvent) root.dispatchEvent(new FintoEvento("dashboardmodern:state-changed", {}));
      return true;
    },
  };
  installStateEventGate(broker, root, { delay: 1, chiavi: CONFIG_KEYS });

  broker.ingestState({ entity_id: "sensor.vmc_mandata", state: "21", attributes: {} });
  await new Promise((risolvi) => setTimeout(risolvi, 12));
  assert.deepEqual(eventi.at(-1)?.detail?.entity_ids, ["sensor.vmc_mandata"]);

  /* E quello che non è configurato continua a non passare: il cancello serve
   * ancora a qualcosa. */
  const quanti = eventi.length;
  broker.ingestState({ entity_id: "sensor.chiacchiera", state: "1", attributes: {} });
  await new Promise((risolvi) => setTimeout(risolvi, 12));
  assert.equal(eventi.length, quanti);
});

/* ── la scheda delle allerte ─────────────────────────────────────────────── */

test("i gesti dell'aria non buttano via quello che c'e' nelle caselle", () => {
  const sorgente = leggi("sections/allerte-editor-section.js");
  assert.match(
    sorgente,
    /function salvaAria\(prossima, body\) \{\n\s+const tutto = versaLeCaselle\(configurazione\(\), body\);/,
    "salvaAria versa le caselle prima di scrivere e ridisegnare",
  );
  /* Il tasto Salva e il confine scritto a mano usano lo stesso versatore: una
   * seconda raccolta scritta a parte tornerebbe a divergere. */
  const quante = [...sorgente.matchAll(/versaLeCaselle\(/g)].length;
  assert.equal(quante, 4, "un versatore solo, e i suoi tre usi");
  assert.equal(
    sorgente.includes("data-dm-allerte-fonte][data-dm-allerte-campo]"),
    true,
    "le caselle si trovano ancora dai loro attributi",
  );
  assert.equal(
    [...sorgente.matchAll(/data-dm-allerte-fonte\]\[data-dm-allerte-campo\]/g)].length,
    1,
    "e si trovano in un posto solo",
  );
});

/* ── lo spegnimento programmato ──────────────────────────────────────────── */

test("l'accensione con durata configurata dice se il timer non e' partito", () => {
  const sorgente = leggi("sections/climate-power-section.js");
  assert.match(
    sorgente,
    /Promise\.resolve\(programmaSpegnimento\(entita, minuti\)\)\s*\.then\(\(messo\) => \{\s*if \(!messo\) avvisaCheNonSiPuo\(\);/,
    "l'esito non si butta: se il timer non e' partito, si dice",
  );
});

test("l'avviso dello spegnimento e' scritto una volta sola", () => {
  const dove = leggi("sections/spegnimento-programmato-section.js");
  assert.match(dove, /export function avvisaCheNonSiPuo\(\)/);
  const clima = leggi("sections/climate-thermal-section.js");
  assert.equal(
    clima.includes("function avvisaCheNonSiPuo()"),
    false,
    "il clima importa l'avviso, non se ne tiene una copia",
  );
  assert.match(clima, /avvisaCheNonSiPuo,\n\s+programmaSpegnimento,/);
});
