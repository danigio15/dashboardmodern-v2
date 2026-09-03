/* «Solare termico continua ad avere un solo impianto: non è stata aggiunta la
 * possibilità di gestire più impianti.»
 *
 * Era l'ultima macchina rimasta singola del locale caldaia. Gli scaldabagni
 * sono una lista da sempre, le caldaie lo sono diventate (#281), e il solare no:
 * le sue tredici caselle sono mappature `dm.boiler_*` dentro
 * `cd_entity_overrides`, e di quelle ce n'è una serie sola.
 *
 * La regola davanti a tutte è quella degli impianti dell'energia, scritta lì e
 * ripetuta qui: NON SI SPOSTA NIENTE. Chi ha un solare solo non ha una lista,
 * non ha un id, non ha niente da migrare. La lista nasce quando si aggiunge il
 * secondo, e quello che si vede in pagina resta sempre l'impianto scritto nelle
 * mappature — così la scena del guscio, la tessera della Home, la
 * sincronizzazione e il rilevamento automatico continuano a leggere l'unico
 * posto che hanno sempre letto, senza che nessuno intercetti niente.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  CASELLE_SOLARE,
  CHIAVE_SOLARE_SCELTO,
  CHIAVE_SOLARI,
  PRIMO_SOLARE,
  caselleSolariDa,
  entitaDeiSolari,
  impiantiSolari,
  nomeDelSolare,
  overridesPerSolare,
  solareCorrente,
} from "../src/core/impianti-termici.js";

const MAPPATURE = {
  "dm.boiler_sonda_temperatura_1": "sensor.pannello",
  "dm.boiler_sonda_temperatura_2": "sensor.accumulo_basso",
  "dm.boiler_pressione_acqua": "sensor.pressione",
  /* Non tutto quello che sta negli override è del solare: l'auto e il server
   * hanno le loro, e non devono finire dentro un impianto. */
  "dm.ev_soc": "sensor.auto",
  "dm.server_cpu": "sensor.cpu",
};

test("le caselle del solare sono le sue, e nessun'altra", () => {
  const caselle = caselleSolariDa(MAPPATURE);
  assert.equal(Object.keys(caselle).length, 3);
  assert.equal(caselle["dm.ev_soc"], undefined, "l'auto non è un pannello solare");
  assert.equal(caselle["dm.boiler_pressione_acqua"], "sensor.pressione");
  /* Le tredici sono quelle che la scena legge: se l'elenco si accorcia, la
   * scena resta senza numeri e nessuno se ne accorge finché non si guarda. */
  assert.equal(CASELLE_SOLARE.length, 13);
  for (const riga of CASELLE_SOLARE) {
    assert.match(riga.ref, /^dm\.boiler_/);
    assert.ok(riga.it && riga.en, `${riga.ref} senza etichetta`);
  }
});

test("chi ha un impianto solo non ha una lista, e non ha niente da migrare", () => {
  const lista = impiantiSolari([], MAPPATURE);
  assert.equal(lista.length, 1);
  assert.equal(lista[0].id, PRIMO_SOLARE);
  assert.equal(lista[0].corrente, true);
  assert.equal(lista[0].caselle["dm.boiler_sonda_temperatura_1"], "sensor.pannello");
  /* E chi non ha nemmeno quello non ha un impianto vuoto: non ha un impianto. */
  assert.deepEqual(impiantiSolari([], {}), []);
});

test("quello in pagina è quello scritto nelle mappature, non la copia in elenco", () => {
  /* La copia in elenco può essere vecchia — l'impianto acceso continua a
   * essere configurato dalle caselle del guscio e dal rilevamento automatico,
   * che scrivono negli override e non in lista. Vincono le mappature. */
  const elenco = [
    { id: "solare", nome: "Sotto", caselle: { "dm.boiler_sonda_temperatura_1": "sensor.vecchia" } },
    { id: "solare-2", nome: "Sopra", caselle: { "dm.boiler_sonda_temperatura_1": "sensor.sopra" } },
  ];
  const lista = impiantiSolari(elenco, MAPPATURE, "solare");
  assert.equal(lista[0].caselle["dm.boiler_sonda_temperatura_1"], "sensor.pannello");
  assert.equal(lista[1].caselle["dm.boiler_sonda_temperatura_1"], "sensor.sopra");
  assert.equal(solareCorrente(lista).nome, "Sotto");
  /* Scelto il secondo, è il secondo a portare le mappature. */
  const altro = impiantiSolari(elenco, MAPPATURE, "solare-2");
  assert.equal(solareCorrente(altro).nome, "Sopra");
  assert.equal(altro[1].caselle["dm.boiler_pressione_acqua"], "sensor.pressione");
  assert.equal(altro[0].caselle["dm.boiler_sonda_temperatura_1"], "sensor.vecchia");
  /* Una scelta che non esiste più — l'impianto è stato cancellato — non lascia
   * la pagina senza niente: si torna al primo. */
  assert.equal(solareCorrente(impiantiSolari(elenco, MAPPATURE, "sparito")).id, "solare");
});

test("passare a un altro impianto riscrive solo le sue caselle", () => {
  const scelto = {
    caselle: { "dm.boiler_sonda_temperatura_1": "sensor.sopra", "dm.boiler_delta_temperatura": "sensor.dt" },
  };
  const prossime = overridesPerSolare(MAPPATURE, scelto);
  assert.equal(prossime["dm.boiler_sonda_temperatura_1"], "sensor.sopra");
  assert.equal(prossime["dm.boiler_delta_temperatura"], "sensor.dt");
  /* Le caselle che il nuovo impianto non usa se ne vanno: lasciarle vorrebbe
   * dire una scena che mostra la sonda del vicino accanto alla propria. */
  assert.equal("dm.boiler_sonda_temperatura_2" in prossime, false);
  assert.equal("dm.boiler_pressione_acqua" in prossime, false);
  /* E quello che non è del solare resta dov'era. */
  assert.equal(prossime["dm.ev_soc"], "sensor.auto");
  assert.equal(prossime["dm.server_cpu"], "sensor.cpu");
});

test("un impianto ha sempre un nome, anche quando non gliene è stato dato uno", () => {
  assert.equal(nomeDelSolare({ nome: "Casa di sopra" }, 1), "Casa di sopra");
  assert.equal(nomeDelSolare({}, 0), "Solare termico");
  assert.equal(nomeDelSolare({}, 1), "Solare termico 2");
});

test("le entità di tutti gli impianti si contano insieme", () => {
  /* Servono a chi decide se il solare è configurato e a chi si iscrive agli
   * aggiornamenti: un impianto parcheggiato ha entità vive lo stesso. */
  const lista = impiantiSolari(
    [
      { id: "solare", caselle: { "dm.boiler_sonda_temperatura_1": "sensor.a" } },
      { id: "solare-2", caselle: { "dm.boiler_sonda_temperatura_1": "sensor.b" } },
    ],
    { "dm.boiler_sonda_temperatura_1": "sensor.a" },
    "solare",
  );
  assert.deepEqual(entitaDeiSolari(lista).sort(), ["sensor.a", "sensor.b"]);
  assert.deepEqual(entitaDeiSolari(null), []);
});

test("l'elenco e la scelta viaggiano insieme", () => {
  /* Le mappature viaggiano da sempre. Se la scelta restasse su un dispositivo
   * solo, il telefono mostrerebbe l'impianto del tablet chiamandolo con
   * l'altro nome — e chi lo riconfigura lo scrive addosso a quello sbagliato. */
  const persistenza = readFileSync(
    new URL("../src/sections/config-persistence-section.js", import.meta.url),
    "utf8",
  );
  assert.match(persistenza, new RegExp(`"${CHIAVE_SOLARI}"`));
  assert.match(persistenza, new RegExp(`"${CHIAVE_SOLARE_SCELTO}"`));
});

test("nessuno intercetta la scena: si riscrive il posto che legge già", () => {
  const pagina = readFileSync(
    new URL("../src/sections/impianti-termici-section.js", import.meta.url),
    "utf8",
  );
  /* Passare impianto vuol dire scrivere le mappature e rimettere al guscio la
   * copia che tiene in memoria — è quella che il proxy degli stati consulta a
   * ogni lettura, e senza rimettergliela la scena resterebbe su quella di
   * prima fino al ricarico. */
  assert.match(pagina, /writeJsonIfChanged\("cd_entity_overrides", prossime\)/);
  assert.match(pagina, /root\.cdApplyCanonicalOverrides\?\.\(prossime\)/);
  /* E la fila compare solo quando c'è più di un impianto: un selettore fra una
   * cosa sola è un tasto che non sceglie niente. */
  assert.match(pagina, /if \(lista\.length < 2\) return "";/);
});
