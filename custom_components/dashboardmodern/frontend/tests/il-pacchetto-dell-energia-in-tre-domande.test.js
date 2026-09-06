/* Un aggiornamento dell'Energia costa tre archi di tempo, e arriva anche a meta'.
 *
 * Erano sette letture delle statistiche a ogni giro — giorno, mese, anno, i
 * dispositivi per ognuno dei tre, i carichi — e due coprivano tredici mesi.
 * E bastava UNA casella vuota perche' tutto venisse buttato via: dal campo
 * (la 333), aprendo il Report «Home Assistant non ha risposto in tempo alle
 * statistiche» e tutti i valori a zero, con la pagina che ci riprovava
 * quaranta volte e poi per sempre.
 *
 * Qui: chi condivide l'arco condivide la domanda, l'anno sono i mesi chiusi
 * (che non cambiano mai piu') piu' il mese aperto, il giorno sono le ore
 * chiuse piu' l'ora aperta, e quello che arriva si tiene.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { archiDelPeriodo } from "../src/core/period-service.js";

const KWH = {
  unit_of_measurement: "kWh",
  device_class: "energy",
  state_class: "total_increasing",
};
const STATI = {
  "sensor.casa_tot": { state: "1234.5", attributes: KWH },
  "sensor.fv_tot": { state: "5678.9", attributes: KWH },
  "sensor.rete_imp_tot": { state: "300.1", attributes: KWH },
  "sensor.rete_exp_tot": { state: "200.2", attributes: KWH },
  "sensor.forno_tot": { state: "44.4", attributes: KWH },
  "sensor.pompa_tot": { state: "12.0", attributes: KWH },
};
const ENERGIA = {
  house: { total_energy: "sensor.casa_tot" },
  solar: { total_energy: "sensor.fv_tot" },
  grid: {
    total_import_energy: "sensor.rete_imp_tot",
    total_export_energy: "sensor.rete_exp_tot",
  },
};

globalThis.STATES = STATI;
globalThis._RAW_STATES = STATI;
globalThis.DashboardModernModules = {
  /* Il Report risolve i dispositivi con la sua funzione: senza, un
   * elettrodomestico col solo contatore di vita non arriva mai al Recorder. */
  data: {
    canonicalReportDevices: (appliances = []) =>
      appliances.map((item) => ({
        ...item,
        entity: item.total_energy_entity,
        history: item.total_energy_entity,
        cumulative: true,
      })),
  },
  store: {
    peekSection: (nome) =>
      ({
        energy: ENERGIA,
        appliances: [
          { id: "forno", name: "Forno", total_energy_entity: "sensor.forno_tot", key: "forno" },
        ],
        loads: [],
        energyLoads: [{ id: "pompa", name: "Pompa", energy_entity: "sensor.pompa_tot" }],
        entityOverrides: {},
      })[nome],
  },
};

const energia = await import("../src/sections/energy-section.js");
const runtime = globalThis.__DASHBOARDMODERN_RUNTIME_ROOT__;
const broker = globalThis.DashboardModernEnergyService.broker;

/* Un Recorder finto: risponde con secchielli che crescono di mezzo kWh, e
 * segna cosa gli e' stato chiesto. Le entita' in `senzaStatistiche` non
 * rispondono niente — e' il contatore senza statistiche a lungo termine. */
function recorderFinto({ senzaStatistiche = [], cade = () => false } = {}) {
  const domande = [];
  broker.cache.clear();
  broker.inflight.clear();
  broker.statistics = async (ids, start, end, period) => {
    domande.push({ ids: [...ids], start: new Date(start), end: new Date(end), period });
    if (cade(period, ids)) throw new Error("Home Assistant response timeout");
    const passo =
      period === "5minute" ? 300e3 : period === "hour" ? 3600e3 : period === "day" ? 864e5 : 26e8;
    return Object.fromEntries(
      ids.map((id) => {
        if (senzaStatistiche.includes(id)) return [id, []];
        const righe = [];
        let somma = 1000;
        for (let t = new Date(start).getTime(); t < new Date(end).getTime(); t += passo) {
          righe.push({ start: t, sum: somma });
          somma += 0.5;
        }
        return [id, righe];
      }),
    );
  };
  return domande;
}

function periodoDiOggi() {
  const adesso = new Date();
  return { year: adesso.getFullYear(), month: adesso.getMonth() + 1 };
}

test("il giorno si chiede a ore per quelle chiuse e a cinque minuti solo per quella aperta", () => {
  const oggi = new Date(2026, 8, 6, 14, 37);
  const archi = archiDelPeriodo("day", oggi, oggi);
  assert.equal(archi.length, 2);
  assert.equal(archi[0].period, "hour");
  assert.deepEqual(archi[0].start, new Date(2026, 8, 6, 0, 0, 0, 0));
  assert.deepEqual(archi[0].end, new Date(2026, 8, 6, 14, 0, 0, 0));
  assert.equal(archi[1].period, "5minute");
  assert.deepEqual(archi[1].start, new Date(2026, 8, 6, 14, 0, 0, 0));
  assert.deepEqual(archi[1].end, oggi);
  /* Appena passata la mezzanotte non c'e' nessuna ora chiusa. */
  const notte = new Date(2026, 8, 6, 0, 12);
  assert.deepEqual(
    archiDelPeriodo("day", notte, notte).map((arco) => arco.period),
    ["5minute"],
  );
  /* Un giorno passato e' tutto chiuso: una domanda a ore e basta. */
  const ieri = new Date(2026, 8, 5, 10, 0);
  assert.deepEqual(
    archiDelPeriodo("day", ieri, new Date(2026, 8, 6, 14, 37)).map((arco) => arco.period),
    ["hour"],
  );
});

test("l'anno sono i mesi chiusi piu' il mese aperto, e su un mese passato resta una domanda sola", () => {
  const oggi = new Date(2026, 8, 6, 14, 37);
  const archi = energia.archiDellAnno(new Date(2026, 8, 1), oggi);
  assert.equal(archi.length, 2);
  assert.deepEqual(archi[0].start, new Date(2026, 0, 1));
  assert.deepEqual(archi[0].end, new Date(2026, 8, 1), "i mesi chiusi finiscono col mese in corso");
  assert.equal(archi[1].period, "day", "il pezzo aperto e' l'arco del mese, gia' chiesto");
  assert.deepEqual(archi[1].start, new Date(2026, 8, 1));
  /* Un mese passato: l'anno contiene anche i mesi che vengono dopo, e la
   * somma dei due pezzi non sarebbe l'anno. */
  const passato = energia.archiDellAnno(new Date(2026, 2, 1), oggi);
  assert.equal(passato.length, 1);
  assert.deepEqual(passato[0].start, new Date(2026, 0, 1));
});

test("fonti, dispositivi e carichi dello stesso arco costano una domanda sola", async () => {
  runtime.bundle = null;
  const domande = recorderFinto();
  const pacchetto = await energia.loadAtomicEnergyBundle(periodoDiOggi());

  /* Tre archi — il giorno, il mese, i mesi chiusi dell'anno — piu' l'ora
   * aperta, che sono dodici righe. Erano sette domande, due da tredici mesi. */
  assert.ok(domande.length <= 4, `troppe domande al Recorder: ${domande.length}`);
  const periodi = domande.map((domanda) => domanda.period).sort();
  assert.deepEqual(periodi, ["5minute", "day", "hour", "month"]);

  /* Nella domanda del mese ci sono le fonti, i dispositivi e — per il pezzo
   * aperto dell'anno — le stesse entita' una volta sola. */
  const mese = domande.find((domanda) => domanda.period === "day");
  assert.ok(mese.ids.includes("sensor.casa_tot"));
  assert.ok(mese.ids.includes("sensor.forno_tot"));
  assert.equal(new Set(mese.ids).size, mese.ids.length, "la stessa entita' chiesta due volte");
  /* E in quella del giorno ci sono anche i carichi. */
  const giorno = domande.find((domanda) => domanda.period === "hour");
  assert.ok(giorno.ids.includes("sensor.pompa_tot"));

  /* I mesi chiusi non arrivano oltre l'inizio del mese in corso. */
  const anno = domande.find((domanda) => domanda.period === "month");
  const primoDelMese = new Date();
  primoDelMese.setDate(1);
  primoDelMese.setHours(0, 0, 0, 0);
  assert.equal(anno.end.getTime(), primoDelMese.getTime());

  assert.ok(pacchetto.year.house >= pacchetto.month.house, "l'anno contiene il mese");
  assert.equal(pacchetto.mancanti.length, 0);
  assert.deepEqual(pacchetto.letti, { day: true, month: true, year: true });
});

test("un contatore senza statistiche non butta via il pacchetto: si tiene il resto e si dice quale", async () => {
  runtime.bundle = null;
  recorderFinto({ senzaStatistiche: ["sensor.fv_tot"] });
  const pacchetto = await energia.loadAtomicEnergyBundle(periodoDiOggi());

  assert.ok(pacchetto, "il pacchetto arriva lo stesso");
  assert.ok(pacchetto.day.gridImport > 0, "quello che e' arrivato si tiene");
  assert.ok(
    pacchetto.mancanti.some((voce) => voce.plan.entity === "sensor.fv_tot"),
    "la casella vuota non e' segnata",
  );
  /* E la riga che si vede dice quale sensore, e cosa gli manca. */
  const ragione = energia.spiegazioneDellErrore(energia.ragioneDelPacchetto(pacchetto));
  assert.match(ragione, /sensor\.fv_tot/);
  assert.match(ragione, /state_class/);
});

test("una domanda caduta lascia in piedi gli archi che sono arrivati", async () => {
  runtime.bundle = null;
  recorderFinto({ cade: (period) => period === "month" });
  const pacchetto = await energia.loadAtomicEnergyBundle(periodoDiOggi());

  assert.ok(pacchetto, "il giorno e il mese sono arrivati: il pacchetto vale");
  assert.equal(pacchetto.letti.day, true);
  assert.ok(pacchetto.day.house > 0);
  /* L'anno non si dipinge: sotto restano i numeri di prima, non degli zeri. */
  assert.equal(pacchetto.letti.year, false);
  assert.match(pacchetto.caduta, /timeout/);
  assert.match(energia.spiegazioneDellErrore(energia.ragioneDelPacchetto(pacchetto)), /Recorder/);
});

test("se non arriva niente e non c'e' niente in mano, l'errore esce e la ripresa se ne occupa", async () => {
  runtime.bundle = null;
  recorderFinto({ cade: () => true });
  await assert.rejects(energia.loadAtomicEnergyBundle(periodoDiOggi()), /timeout/);
});

test("con un pacchetto vecchio in mano una domanda caduta non azzera niente", async () => {
  runtime.bundle = null;
  recorderFinto();
  const buono = await energia.loadAtomicEnergyBundle(periodoDiOggi());
  runtime.bundle = buono;
  recorderFinto({ cade: () => true });
  const dopo = await energia.loadAtomicEnergyBundle(periodoDiOggi());
  assert.ok(dopo, "non si butta via il pacchetto buono che c'era");
  assert.equal(dopo.month.house, buono.month.house);
  assert.match(dopo.caduta, /timeout/);
  runtime.bundle = null;
});
