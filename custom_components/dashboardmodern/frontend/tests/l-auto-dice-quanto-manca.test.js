/* I tre difetti della sezione Auto, provati senza browser.
 *
 * «Inoltre sezione ev non calcola il tempo di fine.»
 * «Non mostra i kwh della sessione pur avendo configurato entità.»
 * «Menu di scelta percentuale non è quello dell'entità: per questo va in
 *  errore e non mi cambia la percentuale.»
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  CAPACITA_DI_SERIE,
  inKilowatt,
  oraDiArrivo,
  oreEMinuti,
  tempoDellaRicarica,
} from "../src/core/il-tempo-della-ricarica.js";
import { voceDiAdesso, vociDelTarget } from "../src/core/le-voci-del-target.js";
import { capacitaDellaBatteria, normalizeVehicle } from "../src/core/vehicle-model.js";

const leggi = (nome) => readFileSync(new URL(`../src/${nome}`, import.meta.url), "utf8");

/* ── il tempo che manca ───────────────────────────────────────────────── */

test("la potenza si legge nell'unità che dichiara la colonnina", () => {
  assert.equal(inKilowatt(7400, "W"), 7.4);
  assert.equal(inKilowatt(1.61, "kW"), 1.61);
  /* Senza unità decide la grandezza: nessuna colonnina domestica eroga cento
     kilowatt, e nessuna carica utile sta sotto i cento watt. */
  assert.equal(inKilowatt(7400, ""), 7.4);
  assert.equal(inKilowatt(1.61, ""), 1.61);
  assert.equal(inKilowatt("boh", "W"), null);
});

test("in carica si conta, e il conto è quello della batteria della vettura", () => {
  /* Da 30 a 80 su una batteria da 40 kWh sono 20 kWh: a 10 kW, due ore. */
  const esito = tempoDellaRicarica({
    codice: "C",
    soc: 30,
    target: 80,
    kilowatt: 10,
    capacita: 40,
  });
  assert.deepEqual(esito, { stato: "carica", minuti: 120 });
  assert.equal(oreEMinuti(esito.minuti), "2H 0M");
  /* Sulla stessa auto col pacco di serie il tempo è un altro: è la ragione per
     cui la capacità si può dichiarare. */
  assert.equal(
    tempoDellaRicarica({ codice: "C", soc: 30, target: 80, kilowatt: 10 }).minuti,
    Math.round(((80 - 30) / 100) * CAPACITA_DI_SERIE * 6),
  );
});

test("la carica si riconosce dalla lettera del nucleo, non dal dialetto", () => {
  /* È il difetto: con 1,61 kW nel cavo la casella diceva IN ATTESA perché il
     guscio pretendeva la lettera C maiuscola della norma. */
  assert.equal(
    tempoDellaRicarica({ codice: "C", soc: 30, target: 90, kilowatt: 1.61, capacita: 70 }).stato,
    "carica",
  );
  /* Ferma: nessun numero, perché sarebbe una promessa che nessuno mantiene. */
  for (const codice of ["B", "A", "N", "F", ""])
    assert.deepEqual(tempoDellaRicarica({ codice, soc: 30, target: 90, kilowatt: 0 }), {
      stato: "attesa",
      minuti: null,
    });
});

test("arrivati al limite, e a batteria piena, non si conta più", () => {
  assert.equal(
    tempoDellaRicarica({ codice: "C", soc: 80, target: 80, kilowatt: 7 }).stato,
    "raggiunto",
  );
  assert.equal(
    tempoDellaRicarica({ codice: "C", soc: 100, target: 100, kilowatt: 7 }).stato,
    "completa",
  );
});

test("l'ora a cui si arriva è adesso più quello che manca", () => {
  const otto = new Date(2026, 7, 31, 8, 0, 0).getTime();
  const quando = oraDiArrivo(135, otto);
  assert.equal(quando.getHours(), 10);
  assert.equal(quando.getMinutes(), 15);
  assert.equal(oraDiArrivo(null, otto), null);
});

test("la capacità della batteria vive sulla vettura e sopravvive al salvataggio", () => {
  const auto = normalizeVehicle({ name: "Zoe", kwh: "52" });
  assert.equal(auto.kwh, "52");
  assert.equal(capacitaDellaBatteria(auto), 52);
  assert.equal(capacitaDellaBatteria(normalizeVehicle({ name: "Zoe", kwh: "52,5" })), 52.5);
  /* Non dichiarata, o scritta male: nessun numero, e chi conta usa i settanta
     di serie — che è quello che la plancia ha sempre assunto. */
  assert.equal(capacitaDellaBatteria(normalizeVehicle({ name: "Zoe" })), null);
  assert.equal(capacitaDellaBatteria(normalizeVehicle({ name: "Zoe", kwh: "boh" })), null);
  assert.equal(capacitaDellaBatteria(normalizeVehicle({ name: "Zoe", kwh: "0" })), null);
});

/* ── le voci del limite di carica ─────────────────────────────────────── */

test("una tendina porta le sue opzioni, tali e quali", () => {
  const stato = {
    state: "95",
    attributes: { options: ["55", "60", "65", "70", "75", "80", "85", "90", "95", "100"] },
  };
  const { voci, padrone } = vociDelTarget(stato);
  assert.equal(padrone, true);
  assert.equal(voci.length, 10);
  assert.deepEqual(voci[0], { valore: "55", testo: "55%" });
  /* Il valore si rimanda com'è scritto: è quello che l'entità accetta. */
  assert.equal(voceDiAdesso(voci, "95"), "95");
  assert.equal(voceDiAdesso(voci, "95.0"), "95");
});

test("un'opzione che non è un numero resta la sua parola", () => {
  const { voci } = vociDelTarget({ state: "90 %", attributes: { options: ["80 %", "90 %"] } });
  assert.deepEqual(voci[1], { valore: "90 %", testo: "90 %" });
  assert.equal(voceDiAdesso(voci, "90 %"), "90 %");
});

test("un numero porta i suoi min, max e passo — e il passo si allarga, non si inventa", () => {
  const fine = vociDelTarget({ state: "80", attributes: { min: 50, max: 100, step: 10 } });
  assert.deepEqual(
    fine.voci.map((voce) => voce.valore),
    ["50", "60", "70", "80", "90", "100"],
  );
  /* Da 0 a 100 col passo di 1 sono centouno voci: si dirada di cinque in
     cinque, che è un multiplo del suo passo — quindi ogni valore proposto
     resta un valore che l'entità accetta. Prima qui cadeva il ripiego con i
     sei numeri di serie, ed è da lì che nasceva il rifiuto. */
  const fitto = vociDelTarget({ state: "90", attributes: { min: 0, max: 100, step: 1 } });
  assert.equal(fitto.padrone, true);
  assert.deepEqual(fitto.voci[0], { valore: "0", testo: "0%" });
  assert.deepEqual(fitto.voci[1], { valore: "5", testo: "5%" });
  assert.equal(fitto.voci[fitto.voci.length - 1].valore, "100");
  assert.ok(fitto.voci.length <= 26, `troppe voci: ${fitto.voci.length}`);
});

test("un'entità che non dice niente lascia stare la tendina del guscio", () => {
  for (const stato of [null, { state: "80" }, { state: "80", attributes: {} }]) {
    const esito = vociDelTarget(stato);
    assert.equal(esito.padrone, false);
    assert.deepEqual(esito.voci, []);
  }
});

test("il ripiego dei sei numeri di serie non esiste più", () => {
  const sorgente = leggi("sections/ev-stato-e-target-section.js");
  assert.doesNotMatch(sorgente, /VOCI_DI_SERIE/);
  /* E il cartello «ci penso io» si mette solo quando le voci sono davvero
     dell'entità: metterlo sul ripiego impediva per sempre al guscio di
     riempire la tendina con le opzioni vere. */
  const corpo = sorgente.slice(sorgente.indexOf("function assicuraLeVoci"));
  assert.ok(corpo.indexOf("if (!padrone) return;") < corpo.indexOf('dataset.populated = "true"'));
});

/* ── la casella della capacità, nella configurazione ──────────────────── */

test("la capacità si scrive nella scheda Auto, accanto al motore", () => {
  const sorgente = leggi("sections/auto-termica-section.js");
  /* Sta nella stessa riga della tendina del motore: sono le due cose che si
     sanno della VETTURA e non delle sue entità, e si salvano per la stessa
     strada. */
  assert.match(sorgente, /data-ev-kwh-riga/);
  assert.match(sorgente, /Capacità della batteria \(kWh\)/);
  assert.match(sorgente, /ensureCasellaCapacita\(casella\)/);
  /* Muovere la casella SCRIVE, come per la tendina: chi preme «Salva sezione»
     non deve perdere la scelta. */
  assert.match(sorgente, /scriviLaCapacita\(campo\.value\)/);
  assert.match(sorgente, /VEHICLE_CAPACITY_FIELD\]: nuovo/);
  /* E si vede solo per le auto che si ricaricano. */
  assert.match(sorgente, /siRicarica\(auto\)/);
});

test("chi conta il tempo legge la capacità dell'auto in uso", () => {
  const sorgente = leggi("sections/il-popup-dell-auto-racconta-section.js");
  assert.match(sorgente, /capacita: capacitaDellAutoInUso\(\)/);
  /* La lettera e la potenza vengono da chi le legge già per la pastiglia: una
     lettura sola, un verdetto solo. */
  assert.match(sorgente, /codice: codiceDellaRicaricaAdesso\(\)/);
  assert.match(sorgente, /kilowatt: kilowattDellaColonnina\(\)/);
  /* E l'energia della sessione passa dalla conversione dell'Energia, che è
     una sola in tutta la plancia. */
  assert.match(sorgente, /inKilowattora\(/);
});
