// DM-FIX-20260816A
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createCycleTracker } from "../src/core/appliance-cycle-tracker.js";

function fakeStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    dump: () => Object.fromEntries(map),
  };
}

function fakeClock(start) {
  let value = start;
  const now = () => value;
  now.advance = (ms) => {
    value += ms;
    return value;
  };
  return now;
}

const T0 = Date.parse("2026-08-16T09:55:00");

test("a full cycle produces start, duration and integrated energy", () => {
  const storage = fakeStorage();
  const clock = fakeClock(T0);
  const tracker = createCycleTracker({ storage, now: clock });

  tracker.update([{ id: "washer", mode: "running", watts: 2000 }]);
  assert.equal(tracker.record("washer").active.startMs, T0);

  for (let i = 0; i < 9; i += 1) {
    clock.advance(60000);
    tracker.update([{ id: "washer", mode: "running", watts: 2000 }]);
  }
  clock.advance(60000);
  tracker.update([{ id: "washer", mode: "off", watts: 0 }]);

  const record = tracker.record("washer");
  assert.equal(record.active, undefined);
  assert.equal(record.last.startMs, T0);
  assert.equal(record.last.durationMinutes, 10);
  // 2000 W sustained for 9 minutes of samples ≈ 0.30 kWh via trapezoids.
  assert.ok(Math.abs(record.last.kwh - 0.3) < 0.02, `kwh was ${record.last.kwh}`);
});

test("daily-energy delta wins over the power integral and survives resets", () => {
  const storage = fakeStorage();
  const clock = fakeClock(T0);
  const tracker = createCycleTracker({ storage, now: clock });

  tracker.update([{ id: "oven", mode: "running", watts: 1000, dailyKwh: 1.0 }]);
  clock.advance(30 * 60000);
  tracker.update([{ id: "oven", mode: "running", watts: 1000, dailyKwh: 1.6 }]);
  clock.advance(60000);
  tracker.update([{ id: "oven", mode: "standby", watts: 1, dailyKwh: 1.62 }]);

  const record = tracker.record("oven");
  assert.equal(record.last.durationMinutes, 31);
  assert.ok(Math.abs(record.last.kwh - 0.62) < 0.001, `kwh was ${record.last.kwh}`);
});

test("short blips without measurable energy are discarded", () => {
  const storage = fakeStorage();
  const clock = fakeClock(T0);
  const tracker = createCycleTracker({ storage, now: clock });
  tracker.update([{ id: "tv", mode: "running", watts: 40 }]);
  clock.advance(10000);
  tracker.update([{ id: "tv", mode: "off", watts: 0 }]);
  assert.equal(tracker.record("tv").last, undefined);
});

test("the max remaining seconds seen during a cycle is kept as ring total", () => {
  const storage = fakeStorage();
  const clock = fakeClock(T0);
  const tracker = createCycleTracker({ storage, now: clock });
  tracker.update([{ id: "washer", mode: "running", watts: 500, remainingSeconds: 3500 }]);
  clock.advance(60000);
  tracker.update([{ id: "washer", mode: "running", watts: 500, remainingSeconds: 3600 }]);
  clock.advance(60000);
  tracker.update([{ id: "washer", mode: "running", watts: 500, remainingSeconds: 3400 }]);
  assert.equal(tracker.record("washer").active.maxRemainingSeconds, 3600);
});

test("state persists across tracker instances via storage", () => {
  const storage = fakeStorage();
  const clock = fakeClock(T0);
  const first = createCycleTracker({ storage, now: clock });
  first.update([{ id: "washer", mode: "running", watts: 1500 }]);
  clock.advance(5 * 60000);
  first.update([{ id: "washer", mode: "running", watts: 1500 }]);

  const second = createCycleTracker({ storage, now: clock });
  clock.advance(60000);
  second.update([{ id: "washer", mode: "off", watts: 0 }]);
  assert.equal(second.record("washer").last.durationMinutes, 6);
});

test("long gaps are clamped so sleeping tabs cannot inflate the integral", () => {
  const storage = fakeStorage();
  const clock = fakeClock(T0);
  const tracker = createCycleTracker({ storage, now: clock });
  tracker.update([{ id: "washer", mode: "running", watts: 2000 }]);
  clock.advance(60 * 60000); // one silent hour
  tracker.update([{ id: "washer", mode: "running", watts: 2000 }]);
  clock.advance(60000);
  tracker.update([{ id: "washer", mode: "off", watts: 0 }]);
  // Only 5 clamped minutes + 1 minute are integrated, not the whole hour.
  assert.ok(tracker.record("washer").last.kwh < 0.25, `kwh was ${tracker.record("washer").last.kwh}`);
});

test("unavailable freezes the cycle instead of closing or integrating it", () => {
  const storage = fakeStorage();
  const clock = fakeClock(T0);
  const tracker = createCycleTracker({ storage, now: clock });
  tracker.update([{ id: "washer", mode: "running", watts: 2000 }]);
  clock.advance(60000);
  tracker.update([{ id: "washer", mode: "unavailable", watts: null }]);
  clock.advance(60000);
  tracker.update([{ id: "washer", mode: "running", watts: 2000 }]);
  assert.ok(tracker.record("washer").active, "cycle survives the unavailable gap");
  clock.advance(120000);
  tracker.update([{ id: "washer", mode: "off", watts: 0 }]);
  assert.equal(tracker.record("washer").last.startMs, T0);
});

/* «Alcune volte la durata dell'ultimo ciclo non rimane memorizzata... questa
 *  mattina la lavatrice è stata accesa per più di un'ora, dopo la fine del
 *  ciclo indicava la durata giusta e un costo coerente con il consumo. Dopo
 *  qualche ora ho notato che era tutto azzerato.» (#518)
 *
 * Non è un ciclo contato male: è un ciclo contato bene e poi cancellato da chi
 * non lo aveva visto. La mappa si leggeva una volta sola, all'accensione, e da
 * lì in poi ogni scrittura la sovrascriveva intera con quella copia. Basta una
 * seconda scheda del browser rimasta aperta — il Config a parte, una linguetta
 * lasciata indietro, il telefono che non si chiude mai — perché la sua copia
 * di un'ora prima finisca sopra il ciclo appena registrato dall'altra.
 */
test("una seconda scheda non cancella il ciclo registrato dalla prima", () => {
  const storage = fakeStorage();
  const clock = fakeClock(T0);
  /* Due schede sullo stesso browser: stesso magazzino, due memorie. */
  const prima = createCycleTracker({ storage, now: clock });
  const seconda = createCycleTracker({ storage, now: clock });

  /* La seconda scheda ha guardato una volta e poi è rimasta lì. */
  seconda.update([{ id: "washer", mode: "off", watts: 0 }]);

  /* Intanto la prima segue il ciclo intero e lo chiude. */
  prima.update([{ id: "washer", mode: "running", watts: 2000 }]);
  for (let i = 0; i < 70; i += 1) {
    clock.advance(60000);
    prima.update([{ id: "washer", mode: "running", watts: 2000 }]);
  }
  clock.advance(60000);
  prima.update([{ id: "washer", mode: "off", watts: 0 }]);
  const registrato = prima.record("washer").last;
  assert.equal(registrato.durationMinutes, 71);

  /* Ore dopo, la seconda scheda si sveglia su una raffica qualunque. Prima
   * riscriveva la sua mappa di allora, e il ciclo spariva. */
  clock.advance(3 * 3600000);
  seconda.update([{ id: "washer", mode: "off", watts: 0 }]);

  const salvato = JSON.parse(storage.dump().dm_appliance_cycles);
  assert.deepEqual(
    salvato.washer.last,
    registrato,
    "la scheda rimasta indietro ha cancellato il ciclo dell'altra",
  );
  /* E lo vede anche lei, senza dover ricaricare niente. */
  assert.deepEqual(seconda.record("washer").last, registrato);
});

test("e il ciclo aperto resta di chi lo sta misurando", () => {
  /* Rileggere il magazzino non deve far perdere il ciclo in corso: quello lo
   * segue chi campiona, campione per campione, e la copia salvata da un'altra
   * scheda è ferma a quando l'ha scritta. */
  const storage = fakeStorage();
  const clock = fakeClock(T0);
  const prima = createCycleTracker({ storage, now: clock });
  const seconda = createCycleTracker({ storage, now: clock });

  prima.update([{ id: "washer", mode: "running", watts: 2000 }]);
  clock.advance(60000);
  /* L'altra scheda scrive qualcosa di suo su un apparecchio diverso. */
  seconda.update([{ id: "dryer", mode: "off", watts: 0 }]);

  clock.advance(60000);
  prima.update([{ id: "washer", mode: "running", watts: 2000 }]);
  assert.equal(prima.record("washer").active.startMs, T0, "il ciclo in corso si è perso");

  clock.advance(60000);
  prima.update([{ id: "washer", mode: "off", watts: 0 }]);
  assert.equal(prima.record("washer").last.durationMinutes, 3);
  /* E quello che l'altra aveva scritto non è stato buttato via. */
  assert.ok("dryer" in JSON.parse(storage.dump().dm_appliance_cycles));
});

test("e l'aggancio alla raffica di stati si riprova quando il guscio è pronto", () => {
  /* «L'orario di inizio ciclo parte solo quando apro la scheda.»
   *
   * Il contatore non guarda le schede: guarda `render`, che gira a ogni
   * raffica di stati qualunque pagina si stia guardando. Ma l'aggancio era un
   * colpo solo, e `render` è del guscio storico — un altro documento, che si
   * accende quando si accende. Se non c'era ancora, non si agganciava niente e
   * non lo sapeva nessuno: da lì in poi il contatore non vedeva più una
   * raffica in vita sua. Riprovare quando il guscio dice di essere pronto
   * costa una riga e non fa niente se l'aggancio c'è già. */
  const sorgente = readFileSync(
    new URL("../src/sections/appliance-showcase-section.js", import.meta.url),
    "utf8",
  );
  const agganci = [...sorgente.matchAll(/wrapFunction\("render", "__dmApplianceCycles"/g)];
  assert.ok(agganci.length >= 3, "l'aggancio si tenta una volta sola");
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:runtime-ready"])
    assert.match(
      sorgente,
      new RegExp(
        `addEventListener\\?\\.\\("${evento}", \\(\\) => \\{[\\s\\S]{0,700}?wrapFunction\\("render", "__dmApplianceCycles"`,
      ),
      `l'aggancio non si riprova su ${evento}`,
    );
});
