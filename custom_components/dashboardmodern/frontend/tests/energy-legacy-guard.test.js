/* I giri dell'Energia del guscio si spengono alla sorgente.
 *
 * Il documento storico ha i suoi cicli per i totali e non sa che i periodi
 * adesso li tiene un modulo con una cadenza sua: `cdTotalsRun` all'accesso e
 * poi ogni mezz'ora, `cdRefreshPeriodDeltas(true)` un secondo e mezzo dopo il
 * primo disegno e a ogni ridisegno del Report, `cdDeriveFromTotals` che ricava
 * gli stessi quattro valori del modulo leggendo lo storico via REST.
 *
 * Prima si «sopprimeva» solo la richiesta a valle, e per quindici secondi:
 * una seconda regola di freschezza accanto a quella vera, e tutti gli altri
 * giri intatti. Adesso i nomi delegano alla domanda gentile del servizio, che
 * con un pacchetto fresco in mano non chiede niente, e il timer di mezz'ora
 * non puo' nemmeno nascere.
 */
import assert from "node:assert/strict";
import test from "node:test";

async function conGuscioFinto(prova) {
  const prima = {
    servizio: globalThis.DashboardModernEnergyService,
    runtime: globalThis.__DASHBOARDMODERN_RUNTIME_ROOT__,
    guardia: globalThis.__DASHBOARDMODERN_ENERGY_LEGACY_GUARD__,
    totali: globalThis.cdTotalsRun,
    delta: globalThis.cdRefreshPeriodDeltas,
    deriva: globalThis.cdDeriveFromTotals,
  };
  const conteggi = { refresh: 0, seVecchio: 0, legacy: 0 };

  globalThis.DashboardModernEnergyService = Object.freeze({
    broker: {},
    refresh() {
      conteggi.refresh += 1;
      return true;
    },
    refreshIfStale() {
      conteggi.seVecchio += 1;
      return false;
    },
  });
  globalThis.__DASHBOARDMODERN_RUNTIME_ROOT__ = { bundle: { month: {} }, lastRefreshAt: Date.now() };
  delete globalThis.__DASHBOARDMODERN_ENERGY_LEGACY_GUARD__;
  /* Come le dichiara il guscio: funzioni sull'oggetto globale. */
  globalThis.cdTotalsRun = () => {
    conteggi.legacy += 1;
  };
  globalThis.cdRefreshPeriodDeltas = () => {
    conteggi.legacy += 1;
  };
  globalThis.cdDeriveFromTotals = async () => {
    conteggi.legacy += 1;
  };
  delete globalThis._cdTotalsTimer;

  try {
    await import(`../src/sections/energy-legacy-guard-section.js?fresh=${Date.now()}`);
    await prova(conteggi);
  } finally {
    delete globalThis._cdTotalsTimer;
    for (const [nome, valore] of [
      ["DashboardModernEnergyService", prima.servizio],
      ["__DASHBOARDMODERN_RUNTIME_ROOT__", prima.runtime],
      ["__DASHBOARDMODERN_ENERGY_LEGACY_GUARD__", prima.guardia],
      ["cdTotalsRun", prima.totali],
      ["cdRefreshPeriodDeltas", prima.delta],
      ["cdDeriveFromTotals", prima.deriva],
    ]) {
      if (valore === undefined) delete globalThis[nome];
      else globalThis[nome] = valore;
    }
  }
}

test("i giri dei totali del guscio delegano alla domanda gentile del modulo", async () => {
  await conGuscioFinto((conteggi) => {
    globalThis.cdTotalsRun();
    globalThis.cdRefreshPeriodDeltas(true);
    assert.equal(conteggi.legacy, 0, "il giro del guscio non gira piu' per conto suo");
    assert.equal(conteggi.seVecchio, 2, "si chiede al modulo, che decide se serve");
    assert.equal(conteggi.refresh, 0, "e non si forza mai una lettura del Recorder");
  });
});

test("il timer di mezz'ora non parte e non puo' rinascere", async () => {
  await conGuscioFinto(() => {
    /* Il guscio lo crea solo se non lo trova: lo trova. */
    assert.ok(globalThis._cdTotalsTimer, "la casella e' libera: il timer nascerebbe");
    /* E se ci scrive sopra, non attacca. `Reflect.set` e' quello che fa una
     * assegnazione nel documento storico, che non e' in modo rigoroso: torna
     * falso invece di lanciare, e la casella resta quella che era. */
    assert.equal(Reflect.set(globalThis, "_cdTotalsTimer", 0), false);
    assert.ok(globalThis._cdTotalsTimer, "la scrittura del guscio non deve attaccare");
  });
});

test("la derivazione dei totali del guscio non fa piu' niente", async () => {
  await conGuscioFinto(async (conteggi) => {
    assert.equal(await globalThis.cdDeriveFromTotals(), undefined);
    assert.equal(conteggi.legacy, 0);
    assert.equal(conteggi.refresh + conteggi.seVecchio, 0, "non e' un aggiornamento: e' un doppione");
  });
});

test("il servizio non viene piu' avvolto: la freschezza ha una regola sola", async () => {
  await conGuscioFinto((conteggi) => {
    /* Chi ha ragione di forzare — la maschera dei costi salvata — deve
     * continuare a poterlo fare. Erano quindici secondi decisi qui dentro,
     * accanto al minuto deciso dall'Energia. */
    assert.equal(globalThis.DashboardModernEnergyService.refresh(), true);
    assert.equal(conteggi.refresh, 1);
  });
});
